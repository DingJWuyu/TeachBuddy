import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createIntegration } from "./fixtures/auth-integration/harness.js";
import { registerMath } from "../../web/e2e/fixtures/math-static/real.mjs";
import { backup, restore, activate } from '../src/workbench/reliability/backup.js';

const base = "/api/workbench/files";
const image = fs.readFileSync(new URL("../../web/e2e/fixtures/materials-questions/figure.png", import.meta.url));
async function upload(client, name = "scan.png") {
  const boundary = `ocr-${randomUUID()}`;
  const response = await client.request("POST", base, {
    headers: { "Idempotency-Key": randomUUID() },
    contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`),
      image, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(response.status, 201, response.text);
  return response.json;
}
async function write(client, url, body, key = randomUUID()) {
  return client.request("POST", url, { body, headers: { "Idempotency-Key": key } });
}
async function waitJob(client, id) {
  for (let i = 0; i < 200; i++) {
    const result = await client.request("GET", `/api/workbench/jobs/${id}`);
    assert.equal(result.status, 200, result.text);
    if (!["queued", "running", "cancelling"].includes(result.json.state)) return result.json;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error("Recognition job did not finish");
}
async function preview(client, file) {
  const accepted = await write(client, `${base}/${file.id}/preview`, {});
  assert.equal(accepted.status, 202, accepted.text);
  assert.equal((await waitJob(client, accepted.json.id)).state, "succeeded");
  return (await client.request("GET", `${base}/${file.id}/preview`)).json;
}
function machinePage() {
  const text = "原稿中文 $\\frac{1}{x-2}$，未经校对。";
  return { width: 240, height: 160, raw: { width: 240, height: 160, parsing_res_list: [
    { block_id: 0, block_label: "text", block_content: text, block_bbox: [10, 10, 200, 50], block_order: 1 },
  ] }, markdown: text, assets: [] };
}

// The injected recognizer only exercises persistence/recovery. Real model
// fidelity and the complete upload-to-module path are verified separately.
test("real-auth page recognition replays acceptance, shares completed pixels and preserves source ownership", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "materials-recognition-"));
  let calls = 0;
  const recognizer = { revision: "integration-1", async run({ bytes, signal }) {
    signal.throwIfAborted();
    assert(bytes.length > 0);
    calls++;
    return machinePage();
  } };
  let world, passed = false;
  try {
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    const { client, session } = await registerMath(world, "recognition-a@example.test");
    const other = (await registerMath(world, "recognition-b@example.test")).client;
    const file = await upload(client), source = await preview(client, file);
    const endpoint = `${base}/${file.id}/recognition`;
    const query = `?renditionFileId=${source.renditionFileId}`;
    const before = await client.request("GET", endpoint + query);
    assert.equal(before.status, 200, before.text);
    assert.equal(before.json.pages[0].state, "unprocessed");
    assert.equal(calls, 0, "reading never runs the model");
    const body = { renditionFileId: source.renditionFileId, pages: [1] }, key = randomUUID();
    const accepted = await write(client, endpoint, body, key);
    assert.equal(accepted.status, 202, accepted.text);
    assert.equal((await write(client, endpoint, body, key)).json.id, accepted.json.id);
    assert.equal((await waitJob(client, accepted.json.id)).state, "succeeded");
    const page = (await client.request("GET", `${endpoint}/pages/1${query}`)).json;
    assert.equal(page.state, "ready");
    assert.match(page.text, /原稿中文/);
    assert.equal(page.document.version, 2);
    assert(page.document.blocks.some(block => block.runs?.some(run => run.type === "math" && run.latex === "\\frac{1}{x-2}")));
    assert.equal(page.location.fileId, file.id);
    assert.equal(page.location.page, 1);
    assert.equal(calls, 1);
    assert.equal((await client.request("GET", `${base}/${page.rawFileId}/content`)).status, 200);
    assert.equal((await other.request("GET", endpoint + query)).status, 404);
    assert.equal((await write(other, endpoint, body)).status, 404);

    const duplicate = await upload(client, "same-pixels.png"), duplicatePreview = await preview(client, duplicate);
    const second = await write(client, `${base}/${duplicate.id}/recognition`, { renditionFileId: duplicatePreview.renditionFileId, pages: [1] });
    assert.equal(second.status, 202, second.text);
    assert.equal((await waitJob(client, second.json.id)).state, "succeeded");
    const copy = (await client.request("GET", `${base}/${duplicate.id}/recognition/pages/1?renditionFileId=${duplicatePreview.renditionFileId}`)).json;
    assert.equal(copy.resultId, page.resultId, "the same owned pixels reuse one machine result");
    assert.equal(copy.location.fileId, duplicate.id, "location binds to the actual source being read");
    assert.equal(calls, 1);
    await world.close();
    world = null;
    await backup({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), target: `${directory}-backup`, stopped: true });
    restore({ source: `${directory}-backup`, target: `${directory}-restored`, stopped: true });
    activate({ target: `${directory}-restored`, stopped: true });
    world = await createIntegration({ directory: `${directory}-restored` });
    const restored = world.workbench.recognition.readResult({ accountKey: session.account.accountKey }, page.resultId,
      { fileId: file.id, renditionFileId: source.renditionFileId, page: 1 });
    assert.deepEqual(restored.document, page.document);
    assert.equal(world.workbench.recognition.get({ accountKey: session.account.accountKey }, { fileId: file.id, renditionFileId: source.renditionFileId }).pages[0].state, 'ready', 'saved OCR remains readable with the engine unconfigured');
    assert.equal(calls, 1);
    passed = true;
  } finally {
    await world?.close();
    if (passed) for (const target of [directory, `${directory}-backup`, `${directory}-restored`]) fs.rmSync(target, { recursive: true, force: true });
  }
});

test("recognition failure and cancellation need explicit retry; service restart never resends a page", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "materials-recognition-recovery-"));
  let mode = "fail", calls = 0, entered;
  const recognizer = { revision: "integration-recovery-1", async run({ signal }) {
    calls++;
    entered?.();
    if (mode === "fail") throw new Error("Model unavailable");
    if (mode === "wait") await new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      if (signal.aborted) reject(signal.reason);
    });
    return machinePage();
  } };
  let world, passed = false;
  try {
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    let { client } = await registerMath(world, "recognition-recovery@example.test");
    const file = await upload(client), source = await preview(client, file);
    const endpoint = `${base}/${file.id}/recognition`;
    const query = `?renditionFileId=${source.renditionFileId}`;
    const body = { renditionFileId: source.renditionFileId, pages: [1] };
    const failed = await write(client, endpoint, body);
    assert.equal((await waitJob(client, failed.json.id)).state, "failed");
    assert.equal((await client.request("GET", `${endpoint}/pages/1${query}`)).json.state, "failed");
    assert.equal(calls, 1);
    assert.equal((await client.request("GET", endpoint + query)).json.pages[0].state, "failed");
    assert.equal(calls, 1);
    mode = "wait";
    let started = new Promise(resolve => { entered = resolve; });
    const retry = await write(client, `/api/workbench/jobs/${failed.json.id}/retry`, { unitIds: ["page:1"] });
    assert.equal(retry.status, 202, retry.text);
    await started;
    assert.equal((await write(client, `/api/workbench/jobs/${retry.json.id}/cancel`, {})).status, 200);
    assert.equal((await waitJob(client, retry.json.id)).state, "cancelled");
    assert.equal(calls, 2);

    started = new Promise(resolve => { entered = resolve; });
    const interrupted = await write(client, endpoint, body);
    await started;
    const jar = client.jar;
    await world.close();
    world = null;
    // Reconnect with the same authenticated cookie on a fresh TCP connection.
    // A new ephemeral port avoids reusing a socket closed by the old server.
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    client = world.client();
    client.jar = jar;
    assert.equal((await client.request("GET", `/api/workbench/jobs/${interrupted.json.id}`)).json.state, "interrupted");
    assert.equal((await client.request("GET", `${endpoint}/pages/1${query}`)).json.state, "interrupted");
    assert.equal(calls, 3);
    mode = "success";
    const resumed = await write(client, `/api/workbench/jobs/${interrupted.json.id}/retry`, { unitIds: [] });
    assert.equal(resumed.status, 202, resumed.text);
    assert.equal((await waitJob(client, resumed.json.id)).state, "succeeded");
    assert.equal(calls, 4);
    assert.equal((await client.request("GET", `${endpoint}/pages/1${query}`)).json.state, "ready");
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});
