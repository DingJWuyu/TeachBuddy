import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const worker = fileURLToPath(new URL("./worker.py", import.meta.url));
const GiB = 1024 ** 3;
const revision = "mineru-pro-2605/document-6";
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const ownedName = new RegExp(`^(page|generation)-(${uuid})$`);
const deadlineMs = 300_000;
const idleMs = 60_000;

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}
const cleanupFailure = () => failure("recognition-cleanup", "识别进程尚未完成清理，请稍后重试。");
const interrupted = () => failure("recognition-cancelled", "识别已停止，原稿仍保留。");

function atomicJSON(filename, value) {
  fs.writeFileSync(`${filename}.tmp`, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(`${filename}.tmp`, filename);
}

async function checkResources(workDirectory, signal, cold) {
  const disk = fs.statfsSync(workDirectory);
  if (disk.bavail * disk.bsize < 25 * GiB)
    throw failure("recognition-resources", "当前可用资源不足，请稍后重试识别。");
  if (!cold) return;
  const available = Number(fs.readFileSync("/proc/meminfo", "utf8").match(/^MemAvailable:\s+(\d+)/m)?.[1]) * 1024;
  let gpu;
  try {
    const { stdout } = await execute("/usr/bin/nvidia-smi", [
      "--query-gpu=index,memory.free", "--format=csv,noheader,nounits",
    ], { timeout: 5000, maxBuffer: 4096, signal });
    gpu = stdout.split("\n").map(line => line.split(",").map(Number)).find(([index]) => index === 0)?.[1];
  } catch {
    signal?.throwIfAborted();
    throw failure("recognition-unavailable", "本地识别环境暂不可用。");
  }
  if (!(available >= 6.5 * GiB && gpu >= 3 * 1024))
    throw failure("recognition-resources", "当前可用资源不足，请稍后重试识别。");
}

function command(home, input, output, unit) {
  const args = [
    "--user", "--unit", unit, "--scope", "--quiet",
    "-p", "MemoryMax=6G", "-p", "MemorySwapMax=0",
    "/usr/bin/bwrap", "--die-with-parent", "--unshare-all", "--as-pid-1",
    "--cap-drop", "ALL", "--clearenv",
    "--ro-bind", "/usr", "/usr", "--symlink", "usr/bin", "/bin",
    "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64",
    "--ro-bind", "/etc/passwd", "/etc/passwd",
    "--proc", "/proc", "--ro-bind", "/sys", "/sys", "--dev", "/dev", "--tmpfs", "/tmp",
  ];
  for (const device of ["nvidia0", "nvidiactl", "nvidia-uvm"])
    args.push("--dev-bind", `/dev/${device}`, `/dev/${device}`);
  for (const name of ["python", "venv", "models", "llama", "cudart", "fonts", "manifest.json", "requirements.freeze.txt"])
    args.push("--ro-bind", path.join(home, name), path.join(home, name));
  args.push(
    // Official local ModelPath still takes transient locks. Only that empty
    // lock directory is writable; the fixed model inventory stays read-only.
    "--tmpfs", path.join(home, "models/.locks"),
    "--ro-bind", worker, "/worker.py",
    "--ro-bind", fileURLToPath(new URL("./mineru_adapter.py", import.meta.url)), "/mineru_adapter.py",
    "--tmpfs", "/usr/share/fonts", "--dir", "/usr/share/fonts/truetype", "--dir", "/usr/share/fonts/truetype/dejavu",
    "--ro-bind", path.join(home, "fonts/DejaVuSans.ttf"), "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "--ro-bind", input, "/input", "--bind", output, "/output",
    "--setenv", "PATH", "/usr/bin", "--setenv", "HOME", "/tmp",
    "--setenv", "XDG_CACHE_HOME", "/tmp/cache", "--setenv", "HF_HUB_OFFLINE", "1",
    "--setenv", "PYTHONDONTWRITEBYTECODE", "1", "--chdir", "/tmp",
    path.join(home, "venv/bin/python"), "/worker.py", home,
  );
  return args;
}

async function scopeState(unit) {
  try {
    const { stdout } = await execute("/usr/bin/systemctl", ["--user", "show", `${unit}.scope`,
      "--property=LoadState", "--property=ActiveState", "--property=ControlGroup"], { timeout: 5000 });
    return Object.fromEntries(stdout.trim().split("\n").map(line => {
      const position = line.indexOf("=");
      return [line.slice(0, position), line.slice(position + 1)];
    }));
  } catch (error) {
    // systemctl show can return exit 1 together with the explicit not-found
    // state. Bus failures and permission errors are never evidence of a stop.
    if (/^LoadState=not-found$/m.test(error.stdout ?? "")) return { LoadState: "not-found" };
    throw cleanupFailure();
  }
}

async function scopeEmpty(unit, previousGroup) {
  const state = await scopeState(unit);
  const group = state.ControlGroup || previousGroup;
  if (group) {
    if (!group.startsWith("/") || group.split("/").includes("..")) throw cleanupFailure();
    try {
      const events = fs.readFileSync(path.join("/sys/fs/cgroup", group, "cgroup.events"), "utf8");
      if (!/^populated 0$/m.test(events)) return false;
    } catch (error) {
      if (error.code !== "ENOENT") throw cleanupFailure();
    }
  }
  return state.LoadState === "not-found" || ["inactive", "failed"].includes(state.ActiveState);
}

async function stopScope(unit) {
  const state = await scopeState(unit);
  if (await scopeEmpty(unit, state.ControlGroup)) return;
  // Kill applies to all descendants in the owned cgroup, including a parser
  // blocked in native teardown. The stop command alone is not confirmation.
  try { await execute("/usr/bin/systemctl", ["--user", "kill", "--kill-whom=all", "--signal=KILL", `${unit}.scope`], { timeout: 5000 }); } catch {}
  try { await execute("/usr/bin/systemctl", ["--user", "stop", `${unit}.scope`], { timeout: 10000 }); } catch {}
  if (!await scopeEmpty(unit, state.ControlGroup)) throw cleanupFailure();
}

function readFileWithin(directory, name) {
  if (typeof name !== "string" || !name || name.includes("\\") || path.isAbsolute(name) || name.split("/").some(part => part === ".."))
    throw failure("recognition-invalid-output", "识别附件路径无效。");
  const filename = path.resolve(directory, name);
  const actual = fs.realpathSync(filename);
  if (!actual.startsWith(`${directory}${path.sep}`) || !fs.statSync(actual).isFile())
    throw failure("recognition-invalid-output", "识别附件路径无效。");
  return fs.readFileSync(actual);
}

function readAsset(output, item) {
  if (typeof item?.name !== "string" || !item.name) throw failure("recognition-invalid-output", "识别附件名称无效。");
  const bytes = readFileWithin(output, item.file);
  if (item.sha256 !== undefined && createHash("sha256").update(bytes).digest("hex") !== item.sha256)
    throw failure("recognition-invalid-output", "识别附件摘要无效。");
  return { ...item, bytes };
}

function readResult(request) {
  const result = JSON.parse(readFileWithin(request.output, "result.json"));
  if (result.requestId !== request.id || result.inputSha256 !== request.inputSha256 ||
      result.width !== request.width || result.height !== request.height ||
      !Array.isArray(result.pageBlocks) || !Array.isArray(result.assets) ||
      !Array.isArray(result.originalAssets) || !Array.isArray(result.derivations))
    throw failure("recognition-invalid-output", "识别结果归属、尺寸或附件无效。");
  return {
    raw: JSON.parse(readFileWithin(request.output, "raw.json")),
    pageBlocks: result.pageBlocks,
    markdown: fs.existsSync(path.join(request.output, "page.md")) ? readFileWithin(request.output, "page.md").toString("utf8") : "",
    assets: result.assets.map(item => readAsset(request.output, item)),
    originalAssets: result.originalAssets.map(item => readAsset(request.output, item)),
    derivations: result.derivations, width: request.width, height: request.height,
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** One fixed local engine, bound to one account generation and one in-flight page. */
export function createRecognizer({ home, workDirectory } = {}) {
  if (!workDirectory) return null;
  const configuredRoot = path.resolve(workDirectory);
  let directory, available = false;
  try {
    directory = fs.realpathSync(path.resolve(home));
    const python = fs.realpathSync(path.join(directory, "venv/bin/python"));
    if (!python.startsWith(`${directory}${path.sep}`)) throw new Error("Invalid Python path");
    for (const name of ["python", "venv", "models", "llama", "cudart"])
      if (!fs.statSync(path.join(directory, name)).isDirectory()) throw new Error("Missing model environment");
    for (const name of ["manifest.json", "requirements.freeze.txt", "fonts/DejaVuSans.ttf"])
      if (!fs.statSync(path.join(directory, name)).isFile()) throw new Error("Missing environment manifest");
    available = true;
  } catch {}
  let generation, currentRun, idleTimer, closing, closed = false, recovered = false;
  const cleaning = new Set();

  function workRoot(create = false) {
    if (create) fs.mkdirSync(configuredRoot, { recursive: true, mode: 0o700 });
    try {
      if (!fs.lstatSync(configuredRoot).isDirectory()) throw cleanupFailure();
      return fs.realpathSync(configuredRoot);
    } catch (error) {
      if (error.code === "ENOENT" && !create) return null;
      throw cleanupFailure();
    }
  }
  function accountDirectory(accountKey, create = false) {
    if (typeof accountKey !== "string" || !accountKey) throw failure("recognition-invalid-input", "识别任务缺少账户归属。");
    const root = workRoot(create);
    if (!root) return null;
    const target = path.join(root, createHash("sha256").update(accountKey).digest("hex"));
    try {
      if (create) fs.mkdirSync(target, { mode: 0o700 });
      if (!fs.lstatSync(target).isDirectory() || fs.realpathSync(target) !== target) throw cleanupFailure();
      return target;
    } catch (error) {
      if (create && error.code === "EEXIST") return accountDirectory(accountKey);
      if (!create && error.code === "ENOENT") return null;
      throw cleanupFailure();
    }
  }
  function owners(root, accountKey) {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const records = [];
    for (const entry of entries) {
      if (entry.isDirectory() && ownedName.test(entry.name) && entries.some(item => item.name === `${entry.name}.owner.json`)) {
        if (fs.realpathSync(path.join(root, entry.name)) !== path.join(root, entry.name)) throw cleanupFailure();
        continue;
      }
      const name = entry.name.replace(/\.owner\.json(?:\.tmp)?$/, "");
      const match = ownedName.exec(name);
      if (!entry.isFile() || !match || name === entry.name) throw cleanupFailure();
      const record = path.join(root, entry.name), work = path.join(root, name);
      if (entry.name.endsWith(".tmp")) {
        if (fs.existsSync(work)) {
          if (fs.existsSync(`${work}.owner.json`)) continue;
          throw cleanupFailure();
        }
        fs.unlinkSync(record);
        continue;
      }
      const owner = JSON.parse(fs.readFileSync(record, "utf8"));
      if (typeof owner.accountKey !== "string" || owner.accountKey !== (accountKey ?? owner.accountKey) ||
          createHash("sha256").update(owner.accountKey).digest("hex") !== path.basename(root) ||
          owner.workRoot !== path.dirname(root) || owner.unit !== `teachbuddy-ocr-${match[2]}` ||
          (match[1] === "generation" && (owner.generation !== match[2] || owner.version !== 2))) throw cleanupFailure();
      records.push({ owner, record, work });
    }
    return records;
  }
  async function recover() {
    if (recovered) return;
    const root = workRoot();
    if (root) {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory() || !/^[0-9a-f]{64}$/.test(entry.name)) throw cleanupFailure();
        const accountRoot = path.join(root, entry.name);
        if (fs.realpathSync(accountRoot) !== accountRoot) throw cleanupFailure();
        for (const saved of owners(accountRoot)) {
          await stopScope(saved.owner.unit);
          // Unreturned complete or partial output stays as restart evidence.
          // It is never replayed as a successful page of a new generation.
          atomicJSON(saved.record, { ...saved.owner, stopped: true });
        }
      }
    }
    recovered = true;
  }

  function clearIdle() { clearTimeout(idleTimer); idleTimer = undefined; }
  async function stop(gen, reason = interrupted()) {
    clearIdle();
    if (!gen || gen.stopped) return;
    if (gen.stopPromise) return gen.stopPromise;
    gen.stopping = true;
    gen.failure ??= reason;
    gen.ready.reject(gen.failure);
    gen.request?.completion.reject(gen.failure);
    gen.stopPromise = (async () => {
      gen.child?.stdin.end();
      // Stop the owned launcher as well, before checking the scope. Otherwise
      // cancellation during systemd registration could observe not-found and
      // allow the launcher to create a scope after that check.
      if (gen.child?.pid && !gen.exited) {
        try { process.kill(-gen.child.pid, "SIGKILL"); } catch {}
      }
      await stopScope(gen.unit);
      if (gen.child && !gen.exited) {
        try { process.kill(-gen.child.pid, "SIGKILL"); } catch {}
        await Promise.race([gen.exit.promise, new Promise((_, reject) => {
          const timer = setTimeout(() => reject(cleanupFailure()), 5000);
          timer.unref();
          gen.exit.promise.finally(() => clearTimeout(timer));
        })]);
      }
      gen.stopped = true;
      atomicJSON(gen.ownerFile, { ...gen.owner, stopped: true });
    })().finally(() => {
      // Retain only the bounded private failure tail, next to its owned scope
      // evidence. HTTP responses never include model logs or private paths.
      if (gen.stderr && (!gen.stopped || (typeof gen.failure?.code === "string" && gen.failure.code !== "recognition-cancelled"))) {
        try { fs.writeFileSync(path.join(gen.work, "worker.stderr.log"), gen.stderr, { mode: 0o600 }); } catch {}
      }
    });
    try { await gen.stopPromise; }
    catch (error) { gen.stopPromise = undefined; throw error?.code === "recognition-cleanup" ? error : cleanupFailure(); }
  }
  function removeEmptyGeneration(gen) {
    if (!gen?.stopped || gen.request) return;
    if (!fs.existsSync(gen.work)) {
      fs.rmSync(gen.ownerFile, { force: true });
      fs.rmSync(`${gen.ownerFile}.tmp`, { force: true });
      if (generation === gen) generation = undefined;
      return;
    }
    if (fs.readdirSync(gen.input).length || fs.readdirSync(gen.output).length || fs.readdirSync(gen.work).some(name => !["input", "output"].includes(name))) return;
    fs.rmSync(gen.work, { recursive: true });
    fs.unlinkSync(gen.ownerFile);
    fs.rmSync(`${gen.ownerFile}.tmp`, { force: true });
    const accountRoot = path.dirname(gen.work);
    if (!fs.readdirSync(accountRoot).length) fs.rmdirSync(accountRoot);
    if (generation === gen) generation = undefined;
  }
  function idle(gen) {
    if (closed || gen.stopping || gen.stopped) return;
    idleTimer = setTimeout(() => {
      stop(gen).then(() => removeEmptyGeneration(gen)).catch(() => { /* owner retains the failed stop for the next explicit action */ });
    }, idleMs);
    idleTimer.unref();
  }

  async function start(accountKey, signal) {
    const root = accountDirectory(accountKey, true);
    await checkResources(root, signal, true);
    signal?.throwIfAborted();
    if (closed || cleaning.has(accountKey)) throw interrupted();
    const id = randomUUID(), unit = `teachbuddy-ocr-${id}`, work = path.join(root, `generation-${id}`);
    const owner = { version: 2, accountKey, workRoot: path.dirname(root), unit, generation: id };
    const gen = { id, unit, accountKey, work, owner, ownerFile: `${work}.owner.json`,
      input: path.join(work, "input"), output: path.join(work, "output"), ready: deferred(), exit: deferred() };
    atomicJSON(gen.ownerFile, owner);
    fs.mkdirSync(work, { mode: 0o700 });
    fs.mkdirSync(gen.input, { mode: 0o700 }); fs.mkdirSync(gen.output, { mode: 0o700 });
    generation = gen;
    const child = gen.child = spawn("/usr/bin/systemd-run", command(directory, gen.input, gen.output, unit), {
      detached: true, stdio: ["pipe", "pipe", "pipe"],
    });
    let buffer = "", stderr = "";
    const badProtocol = () => stop(gen, failure("recognition-invalid-output", "识别进程协议校验未通过。"));
    child.stdout.on("data", chunk => {
      buffer += chunk.toString("utf8");
      try {
        if (buffer.length > 64 * 1024) throw new Error("Protocol line too long");
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const message = JSON.parse(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
          const expectedKeys = message?.event === "ready" ? ["event", "revision"] : message?.event === "failed" ? ["code", "event", "requestId"] : ["event", "requestId"];
          if (!message || Object.keys(message).sort().join(",") !== expectedKeys.join(",")) throw new Error("Invalid protocol fields");
          if (gen.stopping) continue;
          if (message.event === "ready" && !gen.isReady && !gen.request && message.revision === revision) {
            gen.isReady = true; gen.ready.resolve();
          } else if (["done", "failed"].includes(message.event) && gen.isReady && gen.request &&
              !gen.request.responded && message.requestId === gen.request.id) {
            gen.request.responded = true;
            if (message.event === "done") gen.request.completion.resolve();
            else gen.request.completion.reject(failure(/^recognition-[a-z-]+$/.test(message.code) ? message.code : "recognition-failed", "本页识别未完成，原稿仍保留。"));
          } else throw new Error("Unexpected recognition message");
        }
      } catch { badProtocol().catch(() => {}); }
    });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-8000); gen.stderr = stderr; });
    child.stdin.on("error", () => stop(gen, failure("recognition-failed", "本地识别通信已中断。")).catch(() => {}));
    child.once("error", () => stop(gen, failure("recognition-unavailable", "本地识别进程无法启动。")).catch(() => {}));
    child.once("close", () => {
      gen.exited = true; gen.exit.resolve();
      if (!gen.stopping) {
        const resourceError = /out of memory|ResourceExhaustedError|MemoryError/i.test(stderr);
        stop(gen, failure(resourceError ? "recognition-resources" : "recognition-failed", "本地识别进程已中断，原稿仍保留。")).catch(() => {});
      }
    });
    const abort = () => stop(gen, signal.reason ?? interrupted()).catch(() => {});
    const timer = setTimeout(() => stop(gen, failure("recognition-timeout", "本地识别启动超时，可以稍后重试。")).catch(() => {}), deadlineMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    try { await gen.ready.promise; }
    catch (error) { await stop(gen, error); throw error; }
    finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
    return gen;
  }

  async function run({ accountKey, bytes, signal, width, height }) {
    signal?.throwIfAborted();
    if (closed) throw interrupted();
    if (currentRun || cleaning.size) throw failure("recognition-busy", "已有页面正在识别或清理，请稍后重试。");
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 64 * 1024 ** 2 ||
        !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width * height > 40_000_000)
      throw failure("recognition-invalid-input", "识别页的图片或尺寸无效。");
    accountDirectory(accountKey);
    const done = deferred(); currentRun = { accountKey, done: done.promise };
    clearIdle();
    let gen, request, output, termination, timer, abort;
    try {
      await recover();
      if (!available) throw failure("recognition-unavailable", "本地识别环境暂不可用。");
      if (generation && (generation.accountKey !== accountKey || generation.stopping || generation.stopped)) {
        await stop(generation);
        removeEmptyGeneration(generation);
        generation = undefined;
      }
      gen = generation ?? await start(accountKey, signal);
      await checkResources(gen.work, signal, false);
      signal?.throwIfAborted();
      if (closed || gen.stopping) throw gen.failure ?? interrupted();
      const id = randomUUID(), inputSha256 = createHash("sha256").update(bytes).digest("hex");
      request = { id, inputSha256, width, height, input: path.join(gen.input, id), output: path.join(gen.output, id),
        ownerFile: path.join(gen.work, `page-${id}.owner.json`), completion: deferred() };
      atomicJSON(request.ownerFile, { accountKey, generation: gen.id, requestId: id, inputSha256, width, height });
      fs.mkdirSync(request.input, { mode: 0o700 }); fs.mkdirSync(request.output, { mode: 0o700 });
      fs.writeFileSync(path.join(request.input, "page.png"), bytes, { mode: 0o400 });
      gen.request = request;
      const terminate = reason => {
        termination ??= reason;
        stop(gen, reason).catch(() => {});
      };
      abort = () => terminate(signal.reason ?? interrupted());
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => terminate(failure("recognition-timeout", "本页识别超时，可以稍后重试。")), deadlineMs);
      if (signal?.aborted) abort();
      else childWrite(gen, { event: "page", requestId: id, inputSha256, width, height });
      try { await request.completion.promise; }
      catch (error) {
        termination ??= error;
        await stop(gen, error);
        if (!fs.existsSync(path.join(request.output, "result.json"))) throw error;
      }
      if (gen.stopping || signal?.aborted || closed) {
        termination ??= gen.failure ?? signal?.reason ?? interrupted();
        await stop(gen, termination);
      }
      output = readResult(request);
      if (termination) output.termination = { code: typeof termination.code === "string" && termination.code.startsWith("recognition-") ? termination.code : "recognition-cancelled" };
      return output;
    } catch (error) {
      if (gen && !gen.stopped) await stop(gen, error);
      if (error?.code === "recognition-cleanup") throw error;
      if (error?.code === "recognition-timeout") throw error;
      if (signal?.aborted) throw signal.reason;
      if (typeof error?.code === "string" && error.code.startsWith("recognition-")) throw error;
      throw failure("recognition-failed", "本页识别未完成，原稿仍保留。");
    } finally {
      clearTimeout(timer); signal?.removeEventListener("abort", abort);
      try {
        if (request && output) {
          fs.rmSync(request.input, { recursive: true, force: true });
          fs.rmSync(request.output, { recursive: true, force: true });
          fs.rmSync(request.ownerFile, { force: true });
        }
        if (gen) {
          gen.request = undefined;
          if (gen.stopped) removeEmptyGeneration(gen);
          else idle(gen);
        }
      } catch {
        if (gen && !gen.stopped) await stop(gen, cleanupFailure());
        // Cleanup failure takes precedence: callers must not assume the worker stopped.
        // oxlint-disable-next-line no-unsafe-finally
        throw cleanupFailure();
      } finally { currentRun = undefined; done.resolve(); }
    }
  }
  function childWrite(gen, message) {
    gen.child.stdin.write(`${JSON.stringify(message)}\n`, error => {
      if (error) stop(gen, failure("recognition-failed", "本地识别通信已中断。")).catch(() => {});
    });
  }

  return {
    revision, available, run,
    async stopAccountAndWait(accountKey) {
      if (generation?.accountKey === accountKey) await stop(generation);
      if (currentRun?.accountKey === accountKey) await currentRun.done;
      if (generation?.accountKey === accountKey) removeEmptyGeneration(generation);
    },
    async cleanupAccount(accountKey) {
      if (cleaning.has(accountKey)) throw cleanupFailure();
      cleaning.add(accountKey);
      try {
        if (currentRun?.accountKey === accountKey) {
          await stop(generation);
          await currentRun?.done;
        }
        if (generation?.accountKey === accountKey) {
          await stop(generation);
          generation = undefined;
        }
        const root = accountDirectory(accountKey);
        if (!root) return;
        for (const saved of owners(root, accountKey)) {
          await stopScope(saved.owner.unit);
          fs.rmSync(saved.work, { recursive: true, force: true });
          fs.unlinkSync(saved.record);
          fs.rmSync(`${saved.record}.tmp`, { force: true });
        }
        fs.rmdirSync(root);
      } catch (error) {
        throw error?.code === "recognition-cleanup" ? error : cleanupFailure();
      } finally { cleaning.delete(accountKey); }
    },
    close() {
      if (closing) return closing;
      closed = true; clearIdle();
      closing = (async () => {
        await stop(generation);
        await currentRun?.done;
        await recover();
        removeEmptyGeneration(generation);
      })();
      closing.catch(() => { closing = undefined; });
      return closing;
    },
  };
}
