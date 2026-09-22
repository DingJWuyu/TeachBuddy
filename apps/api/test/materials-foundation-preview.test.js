import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { startFixture } from "../../../scripts/materials/fixture.mjs";

export async function harness(t, options = {}) {
  const root = path.resolve("test-results/r31-complete/api");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "case-"));
  let runtime = await startFixture({ dataDir: dir, port: 0, ...options });
  t.after(() => runtime.close());
  async function request(
    route,
    { method = "GET", body, key = randomUUID(), who = "r31-a" } = {},
  ) {
    const response = await fetch(
      `http://localhost:${runtime.server.address().port}${route}`,
      {
        method,
        body:
          body instanceof FormData
            ? body
            : body === undefined
              ? undefined
              : JSON.stringify(body),
        headers: {
          Cookie: runtime.workbench.identity
            .testPrincipalCookie(who)
            .header.split(";")[0],
          Origin: "http://localhost:0",
          "X-TeachBuddy-Request": "1",
          "Idempotency-Key": key,
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
      },
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      body: response.headers.get("content-type")?.includes("json")
        ? JSON.parse(bytes)
        : bytes,
    };
  }
  return {
    dir,
    request,
    get runtime() {
      return runtime;
    },
    async restart() {
      await runtime.close();
      runtime = await startFixture({ dataDir: dir, port: 0, ...options });
    },
    async upload(bytes, name = "page.png") {
      const body = new FormData();
      body.append("file", new Blob([bytes]), name);
      const result = await request("/api/workbench/files", {
        method: "POST",
        body,
      });
      assert.equal(result.status, 201);
      return result.body;
    },
    async finish(id) {
      for (let n = 0; n < 300; n++) {
        const r = await request(`/api/workbench/jobs/${id}`);
        assert.equal(r.status, 200);
        if (!["queued", "running", "cancelling"].includes(r.body.state))
          return r.body;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error("Job timeout");
    },
  };
}
test("HTTP image preview, crop, deduplicated acceptance and restart retain authorized bytes", async (t) => {
  const h = await harness(t);
  const file = await h.upload(
    await sharp({
      create: { width: 200, height: 100, channels: 3, background: "#f00" },
    })
      .png()
      .toBuffer(),
  );
  const route = `/api/workbench/files/${file.id}/preview`;
  assert.equal((await h.request(route)).body.state, "pending");
  const accepted = await h.request(route, { method: "POST", body: {} });
  assert.equal(accepted.status, 202);
  assert.equal((await h.finish(accepted.body.id)).state, "succeeded");
  assert.equal(
    (await h.request(route, { method: "POST", body: {} })).body.id,
    accepted.body.id,
  );
  const preview = (await h.request(route)).body;
  assert.equal(preview.state, "ready");
  assert.equal(preview.pageCount, 1);
  const input = {
    location: {
      kind: "page",
      fileId: file.id,
      renditionFileId: preview.renditionFileId,
      page: 1,
      box: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 },
    },
  };
  const key = randomUUID();
  const crop = await h.request("/api/workbench/files/crops", {
    method: "POST",
    body: input,
    key,
  });
  assert.equal(crop.status, 201);
  const bytes = (
    await h.request(`/api/workbench/files/${crop.body.id}/content`)
  ).body;
  const dimensions = await sharp(bytes).metadata();
  assert.equal(dimensions.width, 100);
  assert.equal(dimensions.height, 60);
  for (const p of [
    route,
    `/api/workbench/jobs/${accepted.body.id}`,
    `/api/workbench/files/${crop.body.id}/content`,
    `/api/workbench/files/${preview.pages[0].imageFileId}/content`,
  ])
    assert.equal((await h.request(p, { who: "r31-b" })).status, 404);
  await h.restart();
  assert.deepEqual((await h.request(route)).body, preview);
  assert.equal(
    (
      await h.request("/api/workbench/files/crops", {
        method: "POST",
        body: input,
        key,
      })
    ).body.id,
    crop.body.id,
  );
  assert.equal(
    (
      await h.request("/api/workbench/files/crops", {
        method: "POST",
        body: { location: { ...input.location, box: null } },
      })
    ).status,
    422,
  );
});

test("HTTP DOCX makes real PDF pages and an immutable crop, while unsupported originals remain downloadable", async (t) => {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const h = await harness(t);
  const bytes = await Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun("R31 material preview 中文数学")],
            }),
          ],
        },
      ],
    }),
  );
  const file = await h.upload(bytes, "lesson.docx");
  const route = `/api/workbench/files/${file.id}/preview`;
  const job = (await h.request(route, { method: "POST", body: {} })).body;
  assert.equal((await h.finish(job.id)).state, "succeeded");
  const preview = (await h.request(route)).body;
  assert.equal(preview.pageCount, 1);
  assert.notEqual(preview.renditionFileId, file.id);
  const pdf = (
    await h.request(`/api/workbench/files/${preview.renditionFileId}/content`)
  ).body;
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(preview.pages[0].height > preview.pages[0].width);
  const html = await h.upload(Buffer.from("unsupported text"), "notes.txt");
  const failed = (
    await h.request(`/api/workbench/files/${html.id}/preview`, {
      method: "POST",
      body: {},
    })
  ).body;
  assert.equal((await h.finish(failed.id)).state, "failed");
  assert.equal(
    (await h.request(`/api/workbench/files/${html.id}/content`)).status,
    200,
  );
  const retry = await h.request(`/api/workbench/jobs/${failed.id}/retry`, {
    method: "POST",
    body: { unitIds: [] },
  });
  assert.equal(retry.status, 202);
  assert.equal(retry.body.attemptOf, failed.id);
});

test("HTTP real PDF/PPTX/PPT and legacy DOC retain every page and legacy risk on retry", async (t) => {
  const h = await harness(t);
  const base = fileURLToPath(
    new URL("../../web/e2e/fixtures/materials/samples", import.meta.url),
  );
  for (const [name, count, state] of [
    ["c22.pdf", 3, "ready"],
    ["c22.pptx", 3, "ready"],
    ["c22.ppt", 3, "ready"],
    ["w.doc", 4, "limited"],
  ]) {
    const file = await h.upload(
      fs.readFileSync(path.join(base, name)),
      name.split("/").at(-1),
    );
    const route = `/api/workbench/files/${file.id}/preview`;
    const job = (await h.request(route, { method: "POST", body: {} })).body;
    await h.finish(job.id);
    const preview = (await h.request(route)).body;
    assert.equal(preview.state, state, JSON.stringify(preview));
    assert.equal(preview.pageCount, count);
    for (const page of preview.pages) {
      const bytes = (
        await h.request(`/api/workbench/files/${page.imageFileId}/content`)
      ).body;
      const stats = await sharp(bytes).stats();
      assert.ok(
        stats.channels.some((c) => c.stdev > 5),
        "actual page is not blank",
      );
    }
    if (state === "limited") {
      const retry = await h.request(`/api/workbench/jobs/${job.id}/retry`, {
        method: "POST",
        body: { unitIds: [] },
      });
      assert.equal(retry.status, 202);
      await h.finish(retry.body.id);
      assert.deepEqual((await h.request(route)).body.issues, [
        "legacy-object-loss",
      ]);
    }
  }
});

test("HTTP rejects external relationships, archive expansion and conversion deadlines while preserving originals", async (t) => {
  const { Document, Packer, Paragraph } = await import("docx");
  const base = await Packer.toBuffer(
    new Document({
      sections: [{ children: [new Paragraph("Security source")] }],
    }),
  );
  const h = await harness(t);
  for (const kind of ["external", "macro", "expanded"]) {
    const bytes = execFileSync(
      "python",
      [
        "-c",
        `import io,sys,zipfile
source=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
out=io.BytesIO()
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
 for item in source.infolist():
  data=source.read(item.filename)
  if '${kind}'=='external' and item.filename=='word/_rels/document.xml.rels': data=data.replace(b'</Relationships>',b'<Relationship Id="external" Type="image" Target="file:///etc/passwd" TargetMode="External"/></Relationships>')
  target.writestr(item.filename,data)
 if '${kind}'=='macro': target.writestr('word/vbaProject.bin',b'macro probe')
 if '${kind}'=='expanded':
  with target.open('word/bomb.bin','w') as f:
   for i in range(513): f.write(bytes(1024*1024))
sys.stdout.buffer.write(out.getvalue())`,
      ],
      { input: base, maxBuffer: 3 * 1024 * 1024 },
    );
    const file = await h.upload(bytes, `${kind}.docx`);
    const accepted = (
      await h.request(`/api/workbench/files/${file.id}/preview`, {
        method: "POST",
        body: {},
      })
    ).body;
    assert.equal((await h.finish(accepted.id)).state, "failed", kind);
    assert.deepEqual(
      (await h.request(`/api/workbench/files/${file.id}/content`)).body,
      bytes,
    );
  }
  const limited = await harness(t, { conversion: { timeoutMs: 1 } });
  const file = await limited.upload(base, "timeout.docx");
  const accepted = (
    await limited.request(`/api/workbench/files/${file.id}/preview`, {
      method: "POST",
      body: {},
    })
  ).body;
  assert.equal((await limited.finish(accepted.id)).state, "failed");
  const failures = fs
    .readdirSync(path.join(limited.dir, "files/conversions"))
    .map((dir) =>
      fs.readFileSync(
        path.join(limited.dir, "files/conversions", dir, "failure.txt"),
        "utf8",
      ),
    );
  assert.ok(failures.some((x) => x.includes("deadline")));
  assert.equal(
    (await limited.request(`/api/workbench/files/${file.id}/content`)).status,
    200,
  );
});

test("same conversion sandbox cannot read a host sentinel or reach the host network", async (t) => {
  const { createServer } = await import("node:http");
  const { Document, Packer, Paragraph } = await import("docx");
  const root = path.resolve("test-results/r31-complete/sandbox");
  fs.mkdirSync(root, { recursive: true });
  const officeRoot = fs.mkdtempSync(path.join(root, "probe-"));
  fs.mkdirSync(path.join(officeRoot, "program"));
  const sentinel = path.join(root, "host-only.txt");
  fs.writeFileSync(sentinel, "private host marker");
  let hits = 0;
  const server = createServer((req, res) => {
    hits++;
    res.end("unexpected");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  fs.copyFileSync(
    fileURLToPath(
      new URL(
        "../../web/e2e/fixtures/materials/samples/c22.pdf",
        import.meta.url,
      ),
    ),
    path.join(officeRoot, "sample.pdf"),
  );
  fs.writeFileSync(
    path.join(officeRoot, "program/soffice"),
    `#!/bin/sh\nset -eu\ntest ! -e '${sentinel}'\nif /usr/bin/curl --connect-timeout 1 --max-time 1 http://127.0.0.1:${server.address().port}; then exit 13; fi\ncp /office/sample.pdf /output/source.pdf\n`,
    { mode: 0o700 },
  );
  const h = await harness(t, { conversion: { officeRoot } });
  const file = await h.upload(
    await Packer.toBuffer(
      new Document({
        sections: [{ children: [new Paragraph("sandbox probe")] }],
      }),
    ),
    "probe.docx",
  );
  const accepted = (
    await h.request(`/api/workbench/files/${file.id}/preview`, {
      method: "POST",
      body: {},
    })
  ).body;
  assert.equal((await h.finish(accepted.id)).state, "succeeded");
  assert.equal(hits, 0);
  assert.equal(fs.readFileSync(sentinel, "utf8"), "private host marker");
});

test("HTML is rendered as literal source pixels and never as an executable page", async (t) => {
  const h = await harness(t);
  const source = Buffer.from(
    '<html><script>throw new Error("must not execute")</script><h1>原始HTML</h1></html>',
  );
  const file = await h.upload(source, "page.html");
  const job = (
    await h.request(`/api/workbench/files/${file.id}/preview`, {
      method: "POST",
      body: {},
    })
  ).body;
  assert.equal((await h.finish(job.id)).state, "succeeded");
  const preview = (await h.request(`/api/workbench/files/${file.id}/preview`))
    .body;
  assert.equal(preview.state, "ready");
  assert.notEqual(preview.renditionFileId, file.id);
  const image = await h.request(
    `/api/workbench/files/${preview.pages[0].imageFileId}/content`,
  );
  assert.equal((await sharp(image.body).metadata()).format, "png");
  assert.deepEqual(
    (await h.request(`/api/workbench/files/${file.id}/content`)).body,
    source,
  );
});

test("JPEG orientation and WebP produce actual pages; 501-page PDF is retained but rejected", async (t) => {
  const h = await harness(t);
  const source = sharp({
    create: { width: 200, height: 100, channels: 3, background: "#37a" },
  });
  for (const [bytes, name, width, height] of [
    [
      await source.clone().jpeg().withMetadata({ orientation: 6 }).toBuffer(),
      "rotate.jpg",
      100,
      200,
    ],
    [await source.clone().webp().toBuffer(), "image.webp", 200, 100],
  ]) {
    const file = await h.upload(bytes, name);
    const route = `/api/workbench/files/${file.id}/preview`;
    const job = (await h.request(route, { method: "POST", body: {} })).body;
    assert.equal((await h.finish(job.id)).state, "succeeded");
    const page = (await h.request(route)).body.pages[0];
    assert.equal(page.width, width);
    assert.equal(page.height, height);
  }
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count 501 /Kids [${Array.from({ length: 501 }, (_, i) => `${i + 3} 0 R`).join(" ")}] >>`,
    ...Array.from(
      { length: 501 },
      () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    ),
  ];
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = Buffer.from(pdf),
    file = await h.upload(bytes, "501-pages.pdf");
  const job = (
    await h.request(`/api/workbench/files/${file.id}/preview`, {
      method: "POST",
      body: {},
    })
  ).body;
  assert.equal((await h.finish(job.id)).state, "failed");
  assert.deepEqual(
    (await h.request(`/api/workbench/files/${file.id}/content`)).body,
    bytes,
  );
});
