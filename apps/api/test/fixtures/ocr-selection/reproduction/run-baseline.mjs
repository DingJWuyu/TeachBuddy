import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
const bundle = path.dirname(fileURLToPath(import.meta.url));
const snapshot = filename => path.join(bundle, "baseline", path.basename(filename));
import { monitorResources, sampleResources } from "./baseline-resources.mjs";
const execute = promisify(execFile);

const args = process.argv.slice(2);
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const mode = "ab";
assert(value("--home"), "Pass an explicit --home");
assert(value("--repo"), "Pass an explicit --repo");
assert(value("--out"), "Pass an explicit fresh --out");
const out = path.resolve(value("--out"));
assert(!fs.existsSync(out), "Use a fresh --out directory");
const home = fs.realpathSync(value("--home"));
const repo = fs.realpathSync(value("--repo"));
const manifest = JSON.parse(fs.readFileSync(path.join(bundle, "development-inputs.json"), "utf8"));
const inputs = manifest.order.map(id => {
  const page = manifest.pages.find(page => page.id === id);
  return { id, path: path.resolve(repo, page.image), sha256: page.sha256 };
});
fs.mkdirSync(out, { recursive: true });
const save = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2));
const prepared = [];
for (const input of inputs) {
  const bytes = fs.readFileSync(input.path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), input.sha256);
  const metadata = await sharp(bytes).metadata();
  prepared.push({ ...input, bytes, width: metadata.width, height: metadata.height });
}
save("configuration.json", { mode, inputs, modelHome: home, maxPixels: 802816, layoutShapeMode: "rect",
  memoryMax: "6G", memorySwapMax: 0 });
save("source-hashes.json", Object.fromEntries([
  "worker.py", "content_check.py", "manifest.json", "requirements.freeze.txt",
].map(filename => [filename, createHash("sha256").update(fs.readFileSync(snapshot(filename))).digest("hex")])));
const stopMonitor = monitorResources(path.join(out, "resources.jsonl"));
const records = [];
const started = performance.now();
try {
  const runs = prepared.map(page => [page]);
  for (const [index, pages] of runs.entries()) {
    const pageReadyAt = performance.now();
    const pageReadyEpochMs = Date.now();
    const resource = await sampleResources();
    const disk = fs.statfsSync(out);
    assert(resource.memory.MemAvailable >= 6.5 * 1024 ** 3, "Less than 6.5 GiB available RAM");
    assert(Number(resource.gpu.split(",")[1]) >= 7 * 1024, "Less than 7 GiB free GPU memory");
    assert(disk.bavail * disk.bsize >= 25 * 1024 ** 3, "Less than 25 GiB free disk");
    const directory = path.join(out, `run-${index + 1}`);
    const input = path.join(directory, "input"), output = path.join(directory, "output");
    fs.mkdirSync(input, { recursive: true }); fs.mkdirSync(output);
    const batch = false;
    for (const [pageIndex, page] of pages.entries())
      fs.writeFileSync(path.join(input, batch ? `page-${pageIndex + 1}.png` : "page.png"), page.bytes);
    fs.writeFileSync(path.join(input, "request.json"), JSON.stringify({ width: pages[0].width, height: pages[0].height }));
    fs.writeFileSync(path.join(input, "batch.json"), JSON.stringify(pages.map((page, pageIndex) => ({ file: `page-${pageIndex + 1}.png`, width: page.width, height: page.height }))));
    const unit = `teachbuddy-ocr-benchmark-${randomUUID()}`;
    const command = [
      "--user", "--unit", unit, "--scope", "--quiet", "-p", "MemoryMax=6G", "-p", "MemorySwapMax=0",
      "/usr/bin/timeout", "--foreground", "--kill-after=5", "295",
      "/usr/bin/bwrap", "--die-with-parent", "--unshare-all", "--cap-drop", "ALL", "--clearenv",
      "--ro-bind", "/usr", "/usr", "--symlink", "usr/bin", "/bin", "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64",
      "--ro-bind", "/etc/passwd", "/etc/passwd", "--proc", "/proc", "--ro-bind", "/sys", "/sys", "--dev", "/dev", "--tmpfs", "/tmp",
    ];
    for (const device of ["nvidia0", "nvidiactl", "nvidia-uvm"]) command.push("--dev-bind", `/dev/${device}`, `/dev/${device}`);
    for (const name of ["python", "venv", "models", "manifest.json", "requirements.freeze.txt"]) command.push("--ro-bind", path.join(home, name), path.join(home, name));
    for (const [filename, mounted] of [
      ["apps/api/src/workbench/recognition/worker.py", "/worker.py"],
      ["apps/api/src/workbench/recognition/content_check.py", "/content_check.py"],
    ]) command.push("--ro-bind", snapshot(filename), mounted);
    command.push("--ro-bind", input, "/input", "--bind", output, "/output",
      "--setenv", "PATH", "/usr/bin", "--setenv", "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True",
      "--setenv", "PADDLE_PDX_CACHE_HOME", "/tmp/paddlex", "--setenv", "HF_HUB_OFFLINE", "1", "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
      "--chdir", "/tmp", path.join(home, "venv/bin/python"), "/worker.py", home);
    fs.writeFileSync(path.join(directory, "command.json"), JSON.stringify({ executable: "/usr/bin/systemd-run", arguments: command }, null, 2));
    const runStarted = performance.now();
    const runStartedEpochMs = Date.now();
    const stdout = fs.openSync(path.join(directory, "stdout.log"), "w"), stderr = fs.openSync(path.join(directory, "stderr.log"), "w");
    const events = [];
    let code;
    try {
      code = await new Promise((resolve, reject) => {
        const process = spawn("/usr/bin/systemd-run", command, { stdio: ["ignore", "pipe", stderr] });
        let pending = "";
        process.stdout.on("data", chunk => {
          fs.writeSync(stdout, chunk);
          pending += chunk.toString();
          const lines = pending.split("\n"); pending = lines.pop();
          for (const line of lines) if (line.startsWith('{"event": "raw-ready"')) {
            const event = JSON.parse(line);
            events.push({ ...event, secondsFromRunStart: (performance.now() - runStarted) / 1000,
              secondsFromPageReady: (performance.now() - pageReadyAt) / 1000 });
            fs.writeFileSync(path.join(directory, "events.json"), JSON.stringify(events, null, 2));
          }
        });
        process.once("error", reject); process.once("close", resolve);
      });
    } finally {
      fs.closeSync(stdout); fs.closeSync(stderr);
      try { await execute("systemctl", ["--user", "stop", `${unit}.scope`], { timeout: 10000 }); }
      // A scope that cannot stop invalidates the reproduction, even after another failure.
      // oxlint-disable-next-line no-unsafe-finally
      catch (error) { if (error.code !== 5) throw error; }
    }
    const finishedEpochMs = Date.now();
    const record = { index, pageReadyEpochMs, runStartedEpochMs, finishedEpochMs, inputIds: pages.map(page => page.id), seconds: (performance.now() - runStarted) / 1000,
      secondsFromPageReady: (performance.now() - pageReadyAt) / 1000, events, code };
    records.push(record); save("runs.json", records); console.log(JSON.stringify(record));
    assert.equal(code, 0, `Inference failed; see ${directory}/stderr.log`);
    if (mode === "ab") {
      const raw = JSON.parse(fs.readFileSync(path.join(output, "raw.json"), "utf8"));
      assert(raw.parsing_res_list?.length > 0, "A raw blocks are empty");
      assert(raw.content_check?.raw, "B raw output is missing");
      const result = JSON.parse(fs.readFileSync(path.join(output, "result.json"), "utf8"));
      assert.equal(result.width, pages[0].width); assert.equal(result.height, pages[0].height);
      record.rawBlocks = raw.parsing_res_list.length;
      save("runs.json", records);
    }
  }
  save("result.json", { mode, seconds: (performance.now() - started) / 1000, records });
} finally { await stopMonitor(); }
