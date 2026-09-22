import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createIntegration } from "./fixtures/auth-integration/harness.js";
async function register(world, email) {
  const client = world.client();
  await client.request("POST", "/api/auth/session", {
    body: { action: "bootstrap" },
  });
  const code = await client.request("POST", "/api/auth/registration-codes", {
    body: { email },
  });
  const result = await client.request("POST", "/api/auth/register", {
    body: {
      email,
      nickname: "材料教师",
      password: "materials-password",
      termsAccepted: true,
      rememberMe: true,
      challengeId: code.json.challengeId,
      verificationCode: world.mailer.lastCode("registration", email),
    },
  });
  assert.equal(result.status, 201, result.text);
  assert.equal(
    (
      await client.request("POST", "/api/auth/session", {
        body: {
          action: "activate",
          sessionId: result.json.id,
          rememberMe: true,
        },
      })
    ).status,
    200,
  );
  return { client, session: result.json };
}
test("real A11 HTTPS page identity protects previews, crops and jobs across restart and logout", async (t) => {
  const root = path.resolve("test-results/r31-complete/auth");
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, "case-"));
  let world = await createIntegration({ directory });
  t.after(() => world.close());
  const a = await register(world, "materials-a@example.test"),
    b = await register(world, "materials-b@example.test");
  const bytes = await sharp({
    create: { width: 120, height: 80, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  const rawBody = Buffer.concat([
    Buffer.from(
      '--r31\r\nContent-Disposition: form-data; name="file"; filename="source.png"\r\nContent-Type: image/png\r\n\r\n',
    ),
    bytes,
    Buffer.from("\r\n--r31--\r\n"),
  ]);
  const file = await a.client.request("POST", "/api/workbench/files", {
    rawBody,
    contentType: "multipart/form-data; boundary=r31",
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(file.status, 201, file.text);
  const route = `/api/workbench/files/${file.json.id}/preview`;
  const accepted = await a.client.request("POST", route, {
    body: {},
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(accepted.status, 202, accepted.text);
  let job;
  for (let i = 0; i < 100; i++) {
    job = await a.client.request(
      "GET",
      `/api/workbench/jobs/${accepted.json.id}`,
    );
    if (job.json.state === "succeeded") break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(job.json.state, "succeeded");
  const preview = (await a.client.request("GET", route)).json;
  const crop = await a.client.request("POST", "/api/workbench/files/crops", {
    body: {
      location: {
        kind: "page",
        fileId: file.json.id,
        renditionFileId: preview.renditionFileId,
        page: 1,
        box: { x: 0, y: 0, width: 0.5, height: 1 },
      },
    },
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(crop.status, 201, crop.text);
  const routes = [
    route,
    `/api/workbench/jobs/${job.json.id}`,
    `/api/workbench/files/${crop.json.id}/content`,
    `/api/workbench/files/${preview.pages[0].imageFileId}/content`,
  ];
  for (const route of routes) {
    assert.equal((await b.client.request("GET", route)).status, 404);
    assert.equal(
      (await a.client.request("GET", route, { page: null })).status,
      401,
    );
  }
  await world.close();
  world = await createIntegration({ directory });
  const restored = world.client();
  restored.jar = a.client.jar;
  assert.equal(
    (
      await restored.request("POST", "/api/auth/session", {
        body: { action: "restore", sessionId: a.session.id },
      })
    ).status,
    200,
  );
  assert.deepEqual((await restored.request("GET", route)).json, preview);
  assert.equal(
    (
      await restored.request("POST", "/api/auth/logout", {
        body: { sessionId: a.session.id },
      })
    ).status,
    204,
  );
  for (const route of routes)
    assert.equal((await restored.request("GET", route)).status, 401);
});
