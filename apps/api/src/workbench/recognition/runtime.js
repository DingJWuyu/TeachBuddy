import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const worker = fileURLToPath(new URL("./worker.py", import.meta.url));
const contentCheck = fileURLToPath(new URL("./content_check.py", import.meta.url));
const GiB = 1024 ** 3;

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

async function checkResources(workDirectory, signal) {
  const available = Number(
    fs.readFileSync("/proc/meminfo", "utf8").match(/^MemAvailable:\s+(\d+)/m)?.[1],
  ) * 1024;
  const disk = fs.statfsSync(workDirectory);
  let gpu;
  try {
    const { stdout } = await execute("/usr/bin/nvidia-smi", [
      "--query-gpu=index,memory.free",
      "--format=csv,noheader,nounits",
    ], { timeout: 5000, maxBuffer: 4096, signal });
    gpu = stdout.split("\n").map(line => line.split(",").map(Number))
      .find(([index]) => index === 0)?.[1];
  } catch {
    signal?.throwIfAborted();
    throw failure("recognition-unavailable", "本地识别环境暂不可用。");
  }
  if (!(available >= 6.5 * GiB && gpu >= 7 * 1024 && disk.bavail * disk.bsize >= 25 * GiB))
    throw failure("recognition-resources", "当前可用资源不足，请稍后重试识别。");
}

function command(home, input, output, unit) {
  const args = [
    "--user", "--unit", unit, "--scope", "--quiet",
    "-p", "MemoryMax=6G", "-p", "MemorySwapMax=0",
    "/usr/bin/timeout", "--foreground", "--kill-after=5", "295",
    "/usr/bin/bwrap", "--die-with-parent", "--unshare-all",
    "--cap-drop", "ALL", "--clearenv",
    "--ro-bind", "/usr", "/usr",
    "--symlink", "usr/bin", "/bin",
    "--symlink", "usr/lib", "/lib",
    "--symlink", "usr/lib64", "/lib64",
    "--ro-bind", "/etc/passwd", "/etc/passwd",
    "--proc", "/proc", "--ro-bind", "/sys", "/sys",
    "--dev", "/dev", "--tmpfs", "/tmp",
  ];
  for (const device of ["nvidia0", "nvidiactl", "nvidia-uvm"])
    args.push("--dev-bind", `/dev/${device}`, `/dev/${device}`);
  for (const name of ["python", "venv", "models"])
    args.push("--ro-bind", path.join(home, name), path.join(home, name));
  args.push("--ro-bind", path.join(home, "manifest.json"), path.join(home, "manifest.json"));
  args.push("--ro-bind", path.join(home, "requirements.freeze.txt"), path.join(home, "requirements.freeze.txt"));
  args.push(
    "--ro-bind", worker, "/worker.py",
    "--ro-bind", contentCheck, "/content_check.py",
    "--ro-bind", input, "/input",
    "--bind", output, "/output",
    "--setenv", "PATH", "/usr/bin",
    "--setenv", "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True",
    "--setenv", "PADDLE_PDX_CACHE_HOME", "/tmp/paddlex",
    "--setenv", "HF_HUB_OFFLINE", "1",
    "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
    "--chdir", "/tmp",
    path.join(home, "venv/bin/python"), "/worker.py", home,
  );
  return args;
}

async function stopScope(unit) {
  const name = `${unit}.scope`;
  try {
    await execute("/usr/bin/systemctl", ["--user", "kill", "--signal=KILL", name], { timeout: 5000 });
  } catch {}
  try {
    // stop waits for this scope's remaining descendants to leave, including
    // GPU teardown after the launcher has already closed its pipes.
    await execute("/usr/bin/systemctl", ["--user", "stop", name], { timeout: 10000 });
  } catch (error) {
    if (error.code !== 5) // An already collected transient scope is stopped.
      throw failure("recognition-cleanup", "识别进程尚未完成清理，请稍后重试。");
  }
}

async function runWorker(args, unit, output, signal) {
  await new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/systemd-run", args, {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let timedOut = false;
    const kill = () => {
      if (!child.pid) return;
      try { process.kill(-child.pid, "SIGKILL"); } catch {}
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, 305000);
    const abort = () => {
      // Once the atomic result exists, inference is finished. Let Python and
      // the namespace reaper exit normally so cancellation retains that page.
      if (!fs.existsSync(path.join(output, "result.json"))) kill();
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.resume();
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-8000); });
    const clear = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    child.once("error", () => {
      clear();
      reject(failure("recognition-unavailable", "本地识别进程无法启动。"));
    });
    child.once("close", async code => {
      clear();
      try { await stopScope(unit); } catch (error) { error.scope = unit; reject(error); return; }
      if (signal?.aborted) {
        // A completed page may arrive just before cancellation. Let the owner
        // retain the evidence while deciding whether the request is cancelled.
        return fs.existsSync(path.join(output, "result.json")) ? resolve() : reject(signal.reason);
      }
      if (timedOut || code === 124)
        return reject(failure("recognition-timeout", "本页识别超时，可以稍后重试。"));
      if (code !== 0) {
        try {
          const detail = JSON.parse(fs.readFileSync(path.join(output, "failure.json"), "utf8"));
          if (["recognition-invalid-input", "recognition-environment-changed", "recognition-invalid-output"].includes(detail.code))
            return reject(failure(detail.code, "识别输入、环境或结果校验未通过，原稿仍保留。"));
        } catch {}
        const resourceError = /out of memory|ResourceExhaustedError|MemoryError/i.test(stderr);
        return reject(failure(resourceError ? "recognition-resources" : "recognition-failed",
          resourceError ? "识别时可用资源不足，请稍后重试。" : "本页识别未完成，原稿仍保留。"));
      }
      resolve();
    });
  });
}

function readAsset(output, item) {
  if (typeof item?.name !== "string" || typeof item?.file !== "string" ||
      !item.name || !item.file || item.file.includes("\\") ||
      path.isAbsolute(item.file) || item.file.split("/").some(part => part === ".."))
    throw failure("recognition-invalid-output", "识别附件路径无效。");
  const filename = path.resolve(output, item.file);
  if (!fs.realpathSync(filename).startsWith(`${output}${path.sep}`))
    throw failure("recognition-invalid-output", "识别附件路径无效。");
  return { name: item.name, bytes: fs.readFileSync(filename) };
}

/** A fixed local page engine. Scheduling and result persistence belong to the caller. */
export function createRecognizer({ home, workDirectory } = {}) {
  if (!workDirectory) return null;
  const workRoot = path.resolve(workDirectory);
  let directory;
  let available = false;
  try {
    directory = fs.realpathSync(path.resolve(home));
    const python = fs.realpathSync(path.join(directory, "venv/bin/python"));
    if (!python.startsWith(`${directory}${path.sep}`)) throw new Error("Invalid Python path");
    for (const name of ["python", "models/PP-DocLayoutV3", "models/PaddleOCR-VL-1.6", "models/PP-OCRv5_mobile_det", "models/PP-OCRv5_mobile_rec"])
      if (!fs.statSync(path.join(directory, name)).isDirectory()) throw new Error("Missing model");
    if (!fs.statSync(path.join(directory, "manifest.json")).isFile()) throw new Error("Missing manifest");
    if (!fs.statSync(path.join(directory, "requirements.freeze.txt")).isFile()) throw new Error("Missing dependencies");
    available = true;
  } catch {}
  const revision = "paddleocr-vl-1.6/document-5";
  let running = false;
  let runningAccount;
  let pendingScope;
  const cleaning = new Set();

  function accountDirectory(accountKey, create = false) {
    if (typeof accountKey !== "string" || !accountKey)
      throw failure("recognition-invalid-input", "识别任务缺少账户归属。");
    const target = path.join(workRoot, createHash("sha256").update(accountKey).digest("hex"));
    try {
      if (create) fs.mkdirSync(target, { recursive: true, mode: 0o700 });
      const stat = fs.lstatSync(target);
      const actual = fs.realpathSync(target);
      if (stat.isDirectory() && actual === path.join(fs.realpathSync(workRoot), path.basename(target))) return actual;
    } catch (error) {
      if (error.code === "ENOENT" && !create) return null;
      throw failure("recognition-cleanup", "识别临时目录归属未能确认。");
    }
    throw failure("recognition-cleanup", "识别临时目录归属未能确认。");
  }

  async function cleanupAccount(accountKey) {
    const root = accountDirectory(accountKey);
    if (runningAccount === accountKey || cleaning.has(accountKey))
      throw failure("recognition-cleanup", "识别任务尚未停止，请稍后重试清理。");
    if (!root) return;
    cleaning.add(accountKey);
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      const pageName = /^page-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      for (const entry of entries) {
        if (entry.isDirectory() && pageName.test(entry.name) && entries.some(item => item.name === `${entry.name}.owner.json`)) continue;
        const name = entry.name.replace(/\.owner\.json(?:\.tmp)?$/, "");
        if (!entry.isFile() || !pageName.test(name) || name === entry.name)
          throw failure("recognition-cleanup", "识别临时目录归属未能确认。");
        const record = path.join(root, entry.name);
        const work = path.join(root, name);
        if (entry.name.endsWith(".tmp")) {
          // The page directory and worker are created only after this record's
          // atomic rename. A interrupted record write cannot contain an input.
          try { fs.lstatSync(work); }
          catch (error) {
            if (error.code !== "ENOENT") throw error;
            fs.unlinkSync(record);
            continue;
          }
          throw failure("recognition-cleanup", "识别临时目录归属未能确认。");
        }
        const owner = JSON.parse(fs.readFileSync(record, "utf8"));
        const unit = `teachbuddy-ocr-${name.slice(5)}`;
        if (owner.accountKey !== accountKey || owner.unit !== unit || owner.workRoot !== path.dirname(root))
          throw failure("recognition-cleanup", "识别临时目录归属未能确认。");
        await stopScope(unit);
        fs.rmSync(work, { recursive: true, force: true });
        fs.unlinkSync(record);
        if (pendingScope === unit) pendingScope = undefined;
      }
      fs.rmdirSync(root);
    } catch (error) {
      if (error?.code === "recognition-cleanup") throw error;
      throw failure("recognition-cleanup", "识别临时数据未完成清理，请稍后重试。");
    } finally { cleaning.delete(accountKey); }
  }
  return {
    revision, available, cleanupAccount,
    async run({ accountKey, bytes, signal, width, height }) {
      signal?.throwIfAborted();
      if (!available) throw failure("recognition-unavailable", "本地识别环境暂不可用。");
      accountDirectory(accountKey);
      if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 64 * 1024 ** 2 ||
          !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
          width <= 0 || height <= 0 || width * height > 40_000_000)
        throw failure("recognition-invalid-input", "识别页的图片或尺寸无效。");
      if (running || cleaning.has(accountKey)) throw failure("recognition-busy", "已有页面正在识别或清理，请稍后重试。");
      running = true;
      runningAccount = accountKey;
      let work;
      let ownerFile;
      let safeToRemove = true;
      try {
        // A previous cleanup failure must be resolved before admitting another
        // model process. Retry only on an explicit caller request.
        if (pendingScope) {
          await stopScope(pendingScope);
          pendingScope = undefined;
        }
        const accountRoot = accountDirectory(accountKey, true);
        await checkResources(accountRoot, signal);
        signal?.throwIfAborted();
        const id = randomUUID();
        const unit = `teachbuddy-ocr-${id}`;
        work = path.join(accountRoot, `page-${id}`);
        ownerFile = `${work}.owner.json`;
        fs.writeFileSync(`${ownerFile}.tmp`, JSON.stringify({ accountKey, unit, workRoot: path.dirname(accountRoot) }), { mode: 0o600 });
        fs.renameSync(`${ownerFile}.tmp`, ownerFile);
        fs.mkdirSync(work, { mode: 0o700 });
        const input = path.join(work, "input"), output = path.join(work, "output");
        fs.mkdirSync(input); fs.mkdirSync(output);
        fs.writeFileSync(path.join(input, "page.png"), bytes, { mode: 0o400 });
        fs.writeFileSync(path.join(input, "request.json"), JSON.stringify({ width, height }), { mode: 0o400 });
        await runWorker(command(directory, input, output, unit), unit, output, signal);
        const result = JSON.parse(fs.readFileSync(path.join(output, "result.json"), "utf8"));
        if (result.width !== width || result.height !== height ||
            !Array.isArray(result.assets) || !Array.isArray(result.originalAssets))
          throw failure("recognition-invalid-output", "识别结果尺寸或附件无效。");
        return {
          raw: JSON.parse(fs.readFileSync(path.join(output, "raw.json"), "utf8")),
          markdown: fs.readFileSync(path.join(output, "page.md"), "utf8"),
          assets: result.assets.map(item => readAsset(output, item)),
          originalAssets: result.originalAssets.map(item => readAsset(output, item)),
          derivations: result.derivations,
          width, height,
        };
      } catch (error) {
        if (error?.code === "recognition-cleanup") {
          safeToRemove = false;
          pendingScope = error.scope ?? pendingScope;
          throw error;
        }
        if (signal?.aborted) throw signal.reason;
        if (typeof error?.code === "string" && error.code.startsWith("recognition-")) throw error;
        throw failure("recognition-failed", "本页识别未完成，原稿仍保留。");
      } finally {
        running = false;
        runningAccount = undefined;
        if (work && safeToRemove) {
          try {
            fs.rmSync(work, { recursive: true, force: true });
            fs.rmSync(ownerFile, { force: true });
            fs.rmSync(`${ownerFile}.tmp`, { force: true });
          }
          catch { throw failure("recognition-cleanup", "识别临时数据未完成清理，请稍后重试。"); }
        }
      }
    },
  };
}
