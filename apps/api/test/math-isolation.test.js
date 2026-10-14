import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import {
  startRealMath,
  registerMath,
} from "../../web/e2e/fixtures/math-static/real.mjs";
const root = "/api/modules/math/v1/works";
const fixture = fs.readFileSync(
  new URL(
    "../../web/e2e/fixtures/math-dynamic/mx-model-revised.html",
    import.meta.url,
  ),
);
test("real HTML upload, original/current bytes, large/broken assets, cross-account, persistent receipts and cold offline HTML", { timeout: 90000 }, async () => {
  let world = await startRealMath();
  const directory = world.directory;
  const evidenceRoot = path.resolve(process.env.M42_EVIDENCE_DIR ?? 'test-results/math-isolation');
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const evidence = fs.mkdtempSync(path.join(evidenceRoot, 'html-artifacts-'));
  let browser;
  let passed = false;
  try {
    let { client, session } = await registerMath(
      world,
      "html-api@example.test",
    );
    const other = await registerMath(world, "html-other@example.test");
    const write = (method, url, body, key = randomUUID(), c = client) =>
      c.request(method, url, { body, headers: { "Idempotency-Key": key } });
    async function upload(bytes, name = "source.html") {
      const boundary = "m42boundary";
      const rawBody = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/html\r\n\r\n`,
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const result = await client.request("POST", "/api/workbench/files", {
        rawBody,
        contentType: `multipart/form-data; boundary=${boundary}`,
        headers: { "Idempotency-Key": randomUUID() },
      });
      assert.equal(result.status, 201, result.text);
      return result.json;
    }
    const original = await upload(fixture);
    const input = {
      title: "C23",
      source: { schemaVersion: 1, kind: "html", fileId: original.id },
      originalFileId: original.id,
    };
    const key = randomUUID();
    const created = await write("POST", root, input, key);
    assert.equal(created.status, 201, created.text);
    const route = `${root}/${created.json.id}`;
    const editedBytes = Buffer.from(
      fixture
        .toString()
        .replace(/正比例函数斜率探究/g, "源码标题")
        .replace('min="-8"', 'min="-10"'),
    );
    const edited = await upload(editedBytes);
    const update = {
        baseVersion: 1,
        title: "目录名称",
        source: { ...input.source, fileId: edited.id },
      },
      updateKey = randomUUID();
    const changed = await write("PUT", route, update, updateKey);
    assert.equal(changed.status, 200, changed.text);
    assert.equal(changed.json.originalFileId, original.id);
    assert.equal(
      (
        await client.request(
          "GET",
          `/api/workbench/files/${original.id}/content`,
        )
      ).text,
      fixture.toString(),
    );
    const exported = await write("POST", `${route}/exports`, {
      version: 2,
      format: "source",
      width: 1600,
      background: "transparent",
    });
    assert.equal(exported.status, 201, exported.text);
    assert.equal(
      (
        await client.request(
          "GET",
          `/api/workbench/files/${exported.json.file.id}/content`,
        )
      ).text,
      editedBytes.toString(),
    );
    const html = await write("POST", `${route}/exports`, {
      version: 2,
      format: "html",
      width: 1600,
      background: "transparent",
    });
    assert.equal(html.json.offline, "unverified");
    assert.equal(html.json.file.id, changed.json.render.presentationFileId);
    const bytes = await client.request(
      "GET",
      `/api/workbench/files/${original.id}/content`,
    );
    assert.match(bytes.headers["content-disposition"], /^attachment/);
    assert.equal(bytes.headers["x-content-type-options"], "nosniff");
    for (const data of [
      Buffer.alloc(1024 * 1024 + 1, 65),
      Buffer.from([0xff, 0xfe, 0xfd]),
    ]) {
      const file = await upload(data);
      const result = await write("POST", root, {
        ...input,
        source: { ...input.source, fileId: file.id },
        originalFileId: file.id,
      });
      assert.equal(result.status, 201, result.text);
      assert.equal(result.json.render.presentationFileId, null);
      assert.equal(
        (
          await write("POST", `${root}/${result.json.id}/exports`, {
            version: 1,
            format: "html",
            width: 1600,
            background: "transparent",
          })
        ).status,
        422,
      );
      const stream = await world.workbench.files.open(session.account, file.id);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      assert.deepEqual(Buffer.concat(chunks), data);
    }
    assert.equal(
      (await write("POST", root, input, randomUUID(), other.client)).status,
      404,
    );
    assert.equal(
      (await client.request("GET", route, { page: null })).status,
      401,
    );
    assert.equal(
      (await write("POST", root, { ...input, originalFileId: edited.id }))
        .status,
      422,
    );
    const pdf = await upload(Buffer.from("%PDF-1.7\n%%EOF"), "not-html.html");
    assert.equal(
      (
        await write("POST", root, {
          ...input,
          source: { ...input.source, fileId: pdf.id },
          originalFileId: pdf.id,
        })
      ).status,
      415,
    );
    for (let i = 0; i < 2; i++) {
      const jar = client.jar;
      await world.close();
      world = await startRealMath({ directory });
      client = world.client();
      client.jar = jar;
      assert.deepEqual(
        (await write("PUT", route, update, updateKey)).json,
        changed.json,
      );
      assert.equal(
        (
          await client.request(
            "GET",
            `/api/workbench/files/${original.id}/content`,
          )
        ).text,
        fixture.toString(),
      );
    }
    const downloaded = await client.request('GET', `/api/workbench/files/${html.json.file.id}/content`);
    assert.equal(downloaded.status, 200, downloaded.text);
    assert.match(downloaded.headers['content-type'], /^text\/html/);
    const htmlPath = path.join(evidence, 'external.html');
    fs.writeFileSync(htmlPath, downloaded.text);
    await world.close();
    world = null;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.goto(pathToFileURL(htmlPath).href);
    const frame = page.frameLocator('iframe');
    await frame.locator('svg,canvas').first().waitFor({ state: 'visible' });
    const slider = frame.getByLabel('正比例函数系数 k', { exact: true });
    assert.equal(await slider.getAttribute('min'), '-10');
    await slider.focus(); await page.keyboard.press('Home');
    assert.equal(await frame.locator('#eq').textContent(), 'y = -10x');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    assert.equal(await frame.locator('#eq').textContent(), 'y = 0x');
    await page.keyboard.press('End');
    assert.equal(await frame.locator('#eq').textContent(), 'y = 8x');
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    await page.screenshot({ path: path.join(evidence, 'external-offline.png') });
    fs.writeFileSync(path.join(evidence, 'external-offline.json'), JSON.stringify({
      serviceStopped: true, freshBrowser: true, offline: true, errors, requests,
      slider: { minimum: -10, intermediate: 0, maximum: 8 },
    }, null, 2));
    fs.writeFileSync(
      path.join(evidence, "html-api.json"),
      JSON.stringify(
        {
          original,
          edited,
          created: created.json,
          changed: changed.json,
          html: html.json,
          restarts: 2,
        },
        null,
        2,
      ),
    );
    passed = true;
  } finally {
    await browser?.close();
    await world?.close();
    if (passed) {
      fs.rmSync(evidence, { recursive: true, force: true });
      fs.rmSync(directory, { recursive: true, force: true });
    } else console.log('保留 HTML 测试现场：' + directory + '；证据：' + evidence);
  }
});
