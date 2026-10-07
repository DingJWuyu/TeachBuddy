"""Fixed offline MinerU worker: stdlib namespace supervisor and parser child."""
import hashlib
import importlib.metadata
import json
import os
import re
import selectors
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

REVISION = "mineru-pro-2605/document-6"
DEPENDENCIES = {"mineru": "4.0.10", "mineru-vl-utils": "2.0.5", "docvortex": "0.5.10",
                "onnxruntime": "1.30.0", "pillow": "12.3.0"}
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
PROMPTS = {"[default]": "\nText Recognition:", "table": "\nTable Recognition:\nTranscribe the complete table using the original OTSL table format. Preserve all rows, columns, merged cells, nested table content, and image placeholder text. Write every mathematical expression inside each cell in LaTeX delimited by \\( and \\). Preserve superscripts, subscripts, fractions, radical scope, and all conditions exactly as shown. Do not solve, simplify, or explain."}
SERVER_FLAGS = ["--alias", "mineru-2605", "--host", "127.0.0.1", "--port", "8112", "--parallel", "1",
                "--ctx-size", "16384", "--n-gpu-layers", "all", "--mmproj-offload", "--fit", "off",
                "--threads", "2", "--threads-batch", "2", "--temp", "0", "--no-cache-prompt",
                "--cache-ram", "0", "--cache-reuse", "0", "--no-warmup", "--no-context-shift",
                "--no-ui", "--special", "--log-verbosity", "4"]


def emit(stream, event, **fields):
    stream.write(json.dumps({"event": event, **fields}, ensure_ascii=False) + "\n")
    stream.flush()


def verify_environment(home):
    manifest = json.loads((home / "manifest.json").read_text())
    if (manifest.get("revision") != REVISION or manifest.get("prompts") != PROMPTS
            or manifest.get("serverFlags") != SERVER_FLAGS or manifest.get("dependencies") != DEPENDENCIES
            or sys.version_info[:3] != (3, 12, 14)):
        raise ValueError("Fixed runtime configuration mismatch")
    files = manifest.get("files", {})
    if not isinstance(files, dict) or "requirements.freeze.txt" not in files:
        raise ValueError("Invalid file inventory")
    for name, expected in files.items():
        file = (home / name).resolve()
        if (not file.is_relative_to(home) or not file.is_file()
                or not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected)):
            raise ValueError("Invalid runtime file")
        with file.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
                raise ValueError("Runtime file digest mismatch")
    for folder in ("models", "llama", "cudart"):
        inventory = {str(p.relative_to(home)) for p in (home / folder).rglob("*") if p.is_file()}
        if inventory != {name for name in files if name.startswith(folder + "/")}:
            raise ValueError("Runtime inventory mismatch")
    for name, expected in DEPENDENCIES.items():
        if importlib.metadata.version(name) != expected:
            raise ValueError("Runtime dependency mismatch")
    # Hooks are intentionally tied to these exact official sources.
    site = home / "venv/lib/python3.12/site-packages"
    for name, expected in {**manifest.get("sourceFiles", {}), **manifest.get("resourceFiles", {})}.items():
        file = (site / name).resolve()
        if not file.is_relative_to(site) or not file.is_file():
            raise ValueError("Missing fixed adapter source")
        with file.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
                raise ValueError("Fixed adapter source changed")
    if not manifest.get("sourceFiles"):
        raise ValueError("Missing adapter source inventory")
    for line in (home / 'requirements.freeze.txt').read_text().splitlines():
        if line and not line.startswith((' ', '#')):
            name, expected = line.split()[0].split('==', 1)
            if importlib.metadata.version(name) != expected:
                raise ValueError('Frozen dependency changed')


def validate_request(request):
    if (not isinstance(request, dict) or set(request) != {"event", "requestId", "inputSha256", "width", "height"}
            or request["event"] != "page" or not isinstance(request["requestId"], str)
            or not UUID.fullmatch(request["requestId"])
            or not isinstance(request["inputSha256"], str)
            or not re.fullmatch(r"[0-9a-f]{64}", request["inputSha256"])
            or any(type(request[key]) is not int or not 0 < request[key] <= 50000 for key in ("width", "height"))):
        raise ValueError("Invalid page protocol")
    return request["requestId"]


def configure(home):
    for key in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "MINERU_INTRA_OP_NUM_THREADS"):
        os.environ[key] = "2"
    os.environ.update(MINERU_INTER_OP_NUM_THREADS="1", TOKENIZERS_PARALLELISM="false",
                      MINERU_DEVICE_MODE="cpu", MINERU_MODEL_SMALL_BACKEND="onnx",
                      MINERU_MODEL_SOURCE="local", MINERU_MODEL_BASE_DIR=str(home / "models"), HF_HUB_OFFLINE="1")
    for key in list(os.environ):
        if key.lower().endswith("_proxy"):
            os.environ.pop(key)


def parser_main(home, protocol_fd):
    # Native writes to stdout and Python/library logs must never reach the API.
    protocol = os.fdopen(protocol_fd, "w", buffering=1)
    os.dup2(2, 1)
    configure(home)
    from mineru_adapter import FixedMinerU
    engine = FixedMinerU(PROMPTS)
    emit(protocol, "ready", revision=REVISION)
    seen = set()
    for line in sys.stdin:
        request = json.loads(line)
        request_id = validate_request(request)
        if request_id in seen:
            raise ValueError("Duplicate page request")
        seen.add(request_id)
        output = Path("/output") / request_id
        try:
            source = Path("/input") / request_id / "page.png"
            if source.is_symlink() or not source.is_file():
                raise ValueError("Missing page input")
            with source.open("rb") as stream:
                if hashlib.file_digest(stream, "sha256").hexdigest() != request["inputSha256"]:
                    raise ValueError("Page input digest mismatch")
            if output.is_symlink() or output.exists() and (not output.is_dir() or any(output.iterdir())):
                raise ValueError("Page output is not an empty owned directory")
            output.mkdir(exist_ok=True)
            payload = engine.parse(source, output, request)
            payload.update({key: request[key] for key in ("requestId", "inputSha256", "width", "height")})
            temporary = output / "result.json.tmp"
            with temporary.open("w") as stream:
                json.dump(payload, stream, ensure_ascii=False)
                stream.flush()
                os.fsync(stream.fileno())
            temporary.replace(output / "result.json")
            emit(protocol, "done", requestId=request_id)
        except Exception as error:
            # Preserve partial captures, but publish no result marker.
            print(f"Recognition page failed: {type(error).__name__}", file=sys.stderr, flush=True)
            emit(protocol, "failed", requestId=request_id, code="recognition-output")
            return 1
    return 0


def supervisor(home):
    children = []
    def finish(status=0):
        # As namespace PID 1, _exit tears down every namespace descendant, even
        # if native model threads or Python atexit handlers are stuck.
        for child in children:
            if child.poll() is None:
                child.kill()
        deadline = time.monotonic() + 2
        for child in children:
            try:
                child.wait(timeout=max(0.01, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                pass
        os._exit(status)
    signal.signal(signal.SIGTERM, lambda *_: finish(0))
    signal.signal(signal.SIGINT, lambda *_: finish(0))
    selector = selectors.DefaultSelector()
    # Poll EOF also during verification/server startup; the supervisor owns no
    # model libraries and its small reader can terminate independently.
    import threading
    from queue import Queue
    requests = Queue()
    def read_api():
        while True:
            line = sys.stdin.buffer.readline(65537)
            if not line:
                finish(0)
            if len(line) > 65536 or not line.endswith(b"\n"):
                finish(1)
            requests.put(line)
    # stdin now has exactly one reader.
    threading.Thread(target=read_api, daemon=True).start()
    try:
        verify_environment(home)
        configure(home)
        model = home / "models/MinerU2.5-Pro-2605-1.2B-GGUF"
        environment = os.environ.copy()
        environment["LD_LIBRARY_PATH"] = f"{home / 'cudart'}:{home / 'llama'}"
        llama = subprocess.Popen([str(home / "llama/llama-server"), "-m", str(model / "MinerU2.5-Pro-2605-1.2B-Q8_0.gguf"),
                                  "--mmproj", str(model / "mmproj-MinerU2.5-Pro-2605-1.2B-Q8_0.gguf"), *SERVER_FLAGS],
                                 stdin=subprocess.DEVNULL, stdout=sys.stderr, stderr=sys.stderr, env=environment, close_fds=True)
        children.append(llama)
        deadline = time.monotonic() + 295
        while True:
            if llama.poll() is not None or time.monotonic() >= deadline:
                raise ValueError("Model startup failed")
            try:
                with urllib.request.urlopen("http://127.0.0.1:8112/health", timeout=0.5) as response:
                    if response.status == 200:
                        break
            except (OSError, ValueError):
                time.sleep(0.05)
        read_fd, write_fd = os.pipe()
        parser = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--parser", str(home), str(write_fd)],
                                  stdin=subprocess.PIPE, stdout=sys.stderr, stderr=sys.stderr, pass_fds=(write_fd,), close_fds=True)
        children.append(parser)
        os.close(write_fd)
        os.set_blocking(read_fd, False)
        selector.register(read_fd, selectors.EVENT_READ, "parser")
        buffer = b""
        ready = False
        active = None
        seen = set()
        while True:
            if llama.poll() is not None:
                raise ValueError("Model child exited unexpectedly")
            while not requests.empty():
                line = requests.get_nowait()
                request = json.loads(line)
                request_id = validate_request(request)
                if not ready or active is not None or request_id in seen:
                    raise ValueError("Unexpected page request")
                seen.add(request_id)
                active = request_id
                parser.stdin.write(line)
                parser.stdin.flush()
            for key, _ in selector.select(0.05):
                chunk = os.read(key.fd, 65536)
                if not chunk:
                    raise ValueError("Parser protocol closed")
                buffer += chunk
                if len(buffer) > 65536:
                    raise ValueError("Parser protocol too long")
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    event = json.loads(line)
                    if not ready:
                        if event != {"event": "ready", "revision": REVISION}:
                            raise ValueError("Invalid parser readiness")
                        ready = True
                    elif (event.get("event") not in ("done", "failed") or event.get("requestId") != active
                          or active is None or set(event) != ({"event", "requestId", "code"} if event["event"] == "failed" else {"event", "requestId"})):
                        raise ValueError("Invalid parser completion")
                    else:
                        active = None
                    emit(sys.stdout, event.pop("event"), **event)
            if parser.poll() is not None:
                raise ValueError("Parser child exited unexpectedly")
    except Exception as error:
        print(f"Recognition worker stopped: {type(error).__name__}", file=sys.stderr, flush=True)
        finish(1)


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--parser":
        # Avoid native atexit on normal protocol EOF too. Supervisor confirms
        # scope termination, rather than trusting this child's clean exit.
        try:
            status = parser_main(Path(sys.argv[2]).resolve(), int(sys.argv[3]))
        except Exception as error:
            print(f"Recognition parser stopped: {type(error).__name__}", file=sys.stderr, flush=True)
            status = 1
        os._exit(status)
    elif len(sys.argv) == 2:
        supervisor(Path(sys.argv[1]).resolve())
    else:
        raise SystemExit(2)
