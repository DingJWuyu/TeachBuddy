import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import sharp from "sharp";

const bundle = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
for (const flag of ["--repo", "--home", "--out"]) assert(value(flag), `Pass ${flag}`);
const repo = fs.realpathSync(value("--repo"));
const home = fs.realpathSync(value("--home"));
const out = path.resolve(value("--out"));
assert(!fs.existsSync(out), "Use a fresh --out directory");
const expected = JSON.parse(fs.readFileSync(path.join(bundle, "candidate-source-hashes.json"), "utf8"));
for (const [filename, hash] of Object.entries(expected))
  assert.equal(createHash("sha256").update(fs.readFileSync(path.join(repo, filename))).digest("hex"), hash, `Candidate source changed: ${filename}`);
const { createRecognizer } = await import(pathToFileURL(path.join(repo, "apps/api/src/workbench/recognition/runtime.js")));
const manifest = JSON.parse(fs.readFileSync(path.join(bundle, "development-inputs.json"), "utf8"));
const prepared = manifest.order.map(id => {
  const page = manifest.pages.find(page => page.id === id);
  const bytes = fs.readFileSync(path.join(repo, page.image));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), page.sha256, `Input changed: ${id}`);
  return { ...page, bytes };
});
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "source-hashes.json"), JSON.stringify(expected, null, 2));
const recognizer = createRecognizer({ home, workDirectory: path.join(out, "runtime-work") });
assert(recognizer?.available, "Prepare the fixed product model home first");
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => controller.abort(new Error(signal)));
const records = [];
const saveRecords = () => fs.writeFileSync(path.join(out, "runs.json"), JSON.stringify(records, null, 2));
const batchStarted = performance.now();
try {
  for (const [index, page] of prepared.entries()) {
    const metadata = await sharp(page.bytes).metadata();
    assert.equal(metadata.width, page.imageSize[0]); assert.equal(metadata.height, page.imageSize[1]);
    const directory = path.join(out, `${String(index + 1).padStart(2, "0")}-${page.id}`);
    fs.mkdirSync(directory);
    const started = performance.now();
    const record = { id: page.id, sha256: page.sha256, startedEpochMs: Date.now() };
    records.push(record); saveRecords();
    try {
      const result = await recognizer.run({ accountKey: "ocr-reproduction", bytes: page.bytes,
        width: metadata.width, height: metadata.height, signal: controller.signal });
      record.secondsToResult = (performance.now() - started) / 1000;
      for (const [filename, content] of [["raw.json", result.raw], ["page-blocks.json", result.pageBlocks],
        ["derivations.json", result.derivations]])
        fs.writeFileSync(path.join(directory, filename), JSON.stringify(content, null, 2));
      if (typeof result.markdown === "string")
        fs.writeFileSync(path.join(directory, "page.md"), result.markdown);
      for (const [prefix, assets] of [["derived", result.assets], ["original", result.originalAssets]])
        for (const { bytes, ...asset } of assets) {
          const filename = path.resolve(directory, prefix, asset.name);
          assert(filename.startsWith(`${directory}${path.sep}`), "Asset escaped output directory");
          fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, bytes);
        }
      fs.writeFileSync(path.join(directory, "result.json"), JSON.stringify({ ...result,
        raw: undefined, assets: result.assets.map(({ bytes, ...asset }) => asset),
        originalAssets: result.originalAssets.map(({ bytes, ...asset }) => asset) }, null, 2));
      if (result.termination) throw Object.assign(new Error("Runtime returned a terminated page"), result.termination);
      record.status = "complete"; saveRecords();
      console.log(JSON.stringify(record));
    } catch (error) {
      record.secondsToFailure = (performance.now() - started) / 1000;
      record.status = "failed"; record.failure = { code: error.code, message: error.message }; saveRecords(); throw error;
    }
  }
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify({ revision: recognizer.revision,
    secondsToLastResult: (performance.now() - batchStarted) / 1000, records }, null, 2));
} finally {
  const started = performance.now();
  try {
    await recognizer.close();
    fs.writeFileSync(path.join(out, "close.json"), JSON.stringify({ status: "complete", seconds: (performance.now() - started) / 1000 }));
  } catch (error) {
    fs.writeFileSync(path.join(out, "close.json"), JSON.stringify({ status: "failed", seconds: (performance.now() - started) / 1000, code: error.code, message: error.message }));
    throw error;
  }
}
