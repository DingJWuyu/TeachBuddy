import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startMaterialsHttp } from "../../web/e2e/fixtures/materials-integration/server.mjs";
import { question, doc } from "./teaching-time-classes-materials-fixture.js";

const base = "/api/modules/lessons/v3";
test("archived lesson purge is owner/version guarded, atomic, replayable and preserves source content", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lessons-archive-"));
  let world = await startMaterialsHttp(directory);
  let passed = false;
  async function request(
    method,
    route,
    body,
    { owner = "integration-a", key = randomUUID() } = {},
  ) {
    const response = await fetch(world.origin + route, {
      method,
      headers: {
        Cookie: world.workbench.identity
          .testPrincipalCookie(owner)
          .header.split(";")[0],
        Origin: "http://localhost",
        "X-TeachBuddy-Request": "1",
        "Idempotency-Key": key,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    const source = await request(
      "POST",
      "/api/modules/questions/v2/items",
      question("保留来源题目"),
    );
    assert.equal(source.status, 201);
    const input = {
      title: "归档课稿",
      intro: doc("讲课思路"),
      sections: [
        {
          id: randomUUID(),
          title: "练习",
          content: doc("讨论"),
          references: [
            {
              id: randomUUID(),
              kind: "question",
              questionId: source.body.id,
              questionVersion: 1,
              note: "本课备注",
            },
          ],
        },
      ],
      materials: [],
    };
    const lesson = (await request("POST", base, input)).body;
    const other = (
      await request("POST", base, { ...input, title: "保留另一份课稿" })
    ).body;
    const route = `${base}/${lesson.id}`;
    assert.equal(
      (await request("POST", `${route}/purge`, { baseVersion: 1 })).status,
      422,
    );
    assert.equal(
      (
        await request(
          "POST",
          `${route}/purge`,
          { baseVersion: 1 },
          { owner: "integration-b" },
        )
      ).status,
      404,
    );
    const order = (await request("GET", `${base}/order`)).body;
    await request("PUT", `${base}/order`, {
      baseVersion: order.version,
      lessonIds: [lesson.id, other.id],
    });
    const output = await request("POST", `${route}/exports`, {
      baseVersion: 1,
      kind: "lesson-plan",
      format: "docx",
      includeAnswers: false,
      includeTeacherNotes: false,
      sectionIds: [input.sections[0].id],
      materialReferenceIds: [],
      answerSpaceLines: 0,
    });
    assert.equal(output.status, 202, JSON.stringify(output.body));
    const archived = await request("POST", `${route}/deletion`, {
      baseVersion: 1,
      deleted: true,
    });
    assert.equal(archived.status, 200);
    assert.deepEqual(
      (await request("GET", `${base}?state=deleted`)).body.items.map(
        (x) => x.id,
      ),
      [lesson.id],
    );
    assert.equal(
      (await request("PUT", route, { ...input, baseVersion: 2 })).status,
      409,
    );
    assert.equal(
      (await request("POST", `${route}/purge`, { baseVersion: 1 })).status,
      409,
    );
    assert.equal(
      (
        await request(
          "POST",
          `${route}/purge`,
          { baseVersion: 2 },
          { owner: "integration-b" },
        )
      ).status,
      404,
    );
    const restored = await request("POST", `${route}/deletion`, {
      baseVersion: 2,
      deleted: false,
    });
    assert.equal(restored.status, 200);
    assert.deepEqual(restored.body.sections, archived.body.sections);
    await request("POST", `${route}/deletion`, {
      baseVersion: 3,
      deleted: true,
    });
    const key = randomUUID(),
      payload = { baseVersion: 4 };
    const purged = await request("POST", `${route}/purge`, payload, { key });
    assert.equal(purged.status, 200, JSON.stringify(purged.body));
    assert.deepEqual(purged.body, { id: lesson.id, permanentlyDeleted: true });
    for (const [table, column] of [
      ["lesson_items", "id"],
      ["lesson_sections", "lessonId"],
      ["lesson_references", "lessonId"],
      ["lesson_exports", "lessonId"],
    ])
      assert.equal(
        world.workbench.db
          .prepare(`SELECT count(*) AS count FROM ${table} WHERE ${column}=?`)
          .get(lesson.id).count,
        0,
        table,
      );
    assert.equal((await request("GET", route)).status, 404);
    assert.equal(
      (
        await request("POST", `${route}/deletion`, {
          baseVersion: 4,
          deleted: false,
        })
      ).status,
      404,
    );
    assert.deepEqual((await request("GET", `${base}/order`)).body.lessonIds, [
      other.id,
    ]);
    assert.equal(
      (await request("GET", `${base}/${other.id}`)).body.sections[0]
        .references[0].snapshot.title,
      "保留来源题目",
    );
    assert.equal(
      (
        await request(
          "GET",
          `/api/modules/questions/v2/items/${source.body.id}`,
        )
      ).status,
      200,
    );
    const job = (
      await request("GET", `/api/workbench/jobs/${output.body.jobId}`)
    ).body;
    assert.ok(
      ["cancelling", "cancelled", "succeeded", "failed"].includes(job.state),
      job.state,
    );
    await world.close();
    world = await startMaterialsHttp(directory);
    assert.deepEqual(
      await request("POST", `${route}/purge`, payload, { key }),
      purged,
    );
    assert.equal((await request("GET", route)).status, 404);
    assert.equal(
      (await request("GET", `${base}?state=deleted`)).body.items.length,
      0,
    );
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});
