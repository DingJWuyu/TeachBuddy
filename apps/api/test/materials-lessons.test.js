import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createEnv } from "../src/config/env.js";
import { createLessonsModule } from "../src/modules/lessons/index.js";
import {
  referenceAdapters,
  examples,
} from "../../web/e2e/fixtures/materials-lessons/adapters.mjs";

export async function harness() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "r34-lessons-"));
  const adapters = referenceAdapters();
  const env = createEnv({
    nodeEnv: "test",
    authSecret: "r34-isolated-test-secret",
    sqlitePath: path.join(dir, "db.sqlite"),
    workbench: {
      mode: "test-principal",
      testPrincipals: ["r34-a", "r34-b"],
      sessionSecret: "r34-session-secret",
      trustedOrigins: ["http://localhost:48434"],
      logDir: path.join(dir, "logs"),
      extraImplementations: {
        lessons: {
          factory: async () => ({
            createLessonsModule: (deps) =>
              createLessonsModule({
                ...deps,
                questions: { ...deps.questions, ...adapters.questionPort },
                resources: adapters.resourcePort,
              }),
          }),
          migrations: () =>
            import("../src/modules/lessons/migrations/index.js"),
        },
      },
    },
  });
  let runtime;
  const start = async () => {
    runtime = createApp({ env });
    await runtime.workbench.initialize();
  };
  await start();
  const send = async (
    method,
    url,
    body,
    key = randomUUID(),
    account = "r34-a",
  ) => {
    let req = request(runtime.app)
      [method](url)
      .set(
        "Cookie",
        runtime.workbench.identity
          .testPrincipalCookie(account)
          .header.split(";")[0],
      )
      .set("Origin", "http://localhost:48434")
      .set("X-TeachBuddy-Request", "1")
      .set("Idempotency-Key", key);
    if (body !== undefined) req = req.send(body);
    return req;
  };
  return {
    adapters,
    send,
    dir,
    runtime: () => runtime,
    restart: async () => {
      runtime.dataStore.close();
      await start();
    },
    close: () => {
      runtime.dataStore.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
const base = "/api/modules/lessons/v2/items";
test("MC14/16: save adopted resource, move it and retain its snapshot across source update and restart", async () => {
  const h = await harness();
  try {
    const input = structuredClone(examples.CreateLessonV2);

    for (const r of input.sections
      .flatMap((s) => s.references)
      .concat(input.materials)) {
      const kind = r.kind;
      const snapshot =
        kind === "resource"
          ? {
              title: "旧资源",
              fileId: randomUUID(),
              fileName: "lesson.pdf",
              mediaType: "application/pdf",
              supplementPreviewFileId: null,
            }
          : {
              title: "旧题目",
              body: {
                version: 1,
                blocks: [
                  { type: "paragraph", runs: [{ type: "text", text: "题面" }] },
                ],
              },
              solution: { version: 1, blocks: [] },
              answerStatus: "absent",
            };
      h.adapters[kind === "resource" ? "resources" : "questions"].set(
        r[`${kind}Id`],
        {
          id: r[`${kind}Id`],
          version: r[`${kind}Version`],
          deletedAt: null,
          snapshot,
        },
      );
    }
    const created = await h.send("post", base, input);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const lesson = created.body;
    assert.equal(
      lesson.sections[0].references[0].kind,
      input.sections[0].references[0].kind,
    );
    const resource = h.adapters.resources.values().next().value;
    resource.version = 2;
    resource.snapshot.title = "新版资源";
    const refreshed = (await h.send("get", `${base}/${lesson.id}`)).body;
    assert.equal(refreshed.sections[0].references[1].latestVersion, 2);
    assert.equal(refreshed.sections[0].references[1].snapshot.title, "旧资源");
    const moved = structuredClone(input);
    moved.materials.push(moved.sections[0].references.pop());
    const updated = await h.send("put", `${base}/${lesson.id}`, {
      baseVersion: lesson.version,
      ...moved,
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.materials[0].snapshot.title, "旧资源");
    const conflict = await h.send("post", base, input);
    assert.equal(conflict.status, 409);
    assert.equal(
      conflict.body.type,
      "/problems/materials/reference-version-conflict",
    );
    await h.restart();
    const read = await h.send("get", `${base}/${lesson.id}`);
    assert.deepEqual(read.body, updated.body);
  } finally {
    h.close();
  }
});
test("MC17/18: accepted export creates a real DOCX with editable formulas and no student answer or note leakage", async () => {
  const h = await harness();
  try {
    const qid = randomUUID(),
      rid = randomUUID(),
      sid = randomUUID();
    h.adapters.questions.set(qid, {
      id: qid,
      version: 1,
      deletedAt: null,
      snapshot: {
        title: "函数",
        body: {
          version: 2,
          blocks: [
            {
              type: "paragraph",
              runs: [
                { type: "text", text: "求定义域" },
                { type: "math", latex: "\\frac{2x-1}{x+3}" },
              ],
            },
            {
              type: "math",
              latex: "f(x)=\\begin{cases}x^2&x<0\\\\x+1&x\\ge0\\end{cases}",
            },
          ],
        },
        solution: {
          version: 2,
          blocks: [
            {
              type: "paragraph",
              runs: [{ type: "text", text: "ANSWER-ONLY 配方法" }],
            },
          ],
        },
        answerStatus: "present",
      },
    });
    const input = {
      title: "函数教学",
      intro: { version: 2, blocks: [] },
      sections: [
        {
          id: sid,
          title: "探究",
          content: {
            version: 2,
            blocks: [
              {
                type: "teacher-note",
                blocks: [
                  {
                    type: "paragraph",
                    runs: [{ type: "text", text: "TEACHER-ONLY" }],
                  },
                ],
              },
            ],
          },
          references: [
            {
              id: rid,
              kind: "question",
              questionId: qid,
              questionVersion: 1,
              note: "LESSON-NOTE",
            },
          ],
        },
      ],
      materials: [],
    };
    const created = await h.send("post", base, input);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const accepted = await h.send(
      "post",
      `${base}/${created.body.id}/exports`,
      {
        baseVersion: 1,
        kind: "handout",
        format: "docx",
        includeAnswers: false,
        includeTeacherNotes: false,
        sectionIds: [sid],
        materialReferenceIds: [],
        answerSpaceLines: 3,
      },
    );
    assert.equal(accepted.status, 202, JSON.stringify(accepted.body));
    let job;
    const deadline = Date.now() + 30000;
    do {
      job = (await h.send("get", `/api/workbench/jobs/${accepted.body.jobId}`))
        .body;
      if (!["queued", "running"].includes(job.state)) break;
      await new Promise((r) => setTimeout(r, 50));
    } while (Date.now() < deadline);
    assert.equal(job.state, "succeeded", JSON.stringify(job));
    const output = (await h.send("get", `${base}/${created.body.id}/exports`))
      .body.items[0];
    assert.ok(output.fileId);
    const stream = await h
      .runtime()
      .workbench.files.open({ accountKey: "r34-a" }, output.fileId);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const zip = (await import("jszip")).default;
    const archive = await zip.loadAsync(Buffer.concat(chunks));
    const xml = await archive.file("word/document.xml").async("string");
    assert.match(xml, /<m:f>/);
    assert.match(xml, /<m:m>/);
    assert.match(xml, /求定义域/);
    assert.doesNotMatch(xml, /ANSWER-ONLY|TEACHER-ONLY|LESSON-NOTE/);
  } finally {
    h.close();
  }
});
test("MC11: B11 refuses a v2 lesson without lossy projection or overwrite", async () => {
  const h = await harness();
  try {
    const input = {
      title: "新版文稿",
      intro: {
        version: 2,
        blocks: [
          { type: "heading", level: 1, runs: [{ type: "text", text: "标题" }] },
        ],
      },
      sections: [],
      materials: [],
    };
    const created = await h.send("post", base, input);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const old = await h.send(
      "get",
      `/api/modules/lessons/items/${created.body.id}`,
    );
    assert.equal(old.status, 422);
    assert.equal(old.body.reason, "unsupported-content-version");
    const overwrite = await h.send(
      "put",
      `/api/modules/lessons/items/${created.body.id}`,
      { ...input, baseVersion: 1, intro: { version: 1, blocks: [] } },
    );
    assert.equal(overwrite.status, 422);
    assert.equal(
      (await h.send("get", `${base}/${created.body.id}`)).body.version,
      1,
    );
  } finally {
    h.close();
  }
});
test("MC19/21/22: unsupported formula rejects before acceptance, failed conversion preserves old output, export retry is rejected", async () => {
  const h = await harness();
  try {
    const input = {
      title: "失败恢复",
      intro: {
        version: 2,
        blocks: [{ type: "math", latex: "\\frac{x+1}{2}" }],
      },
      sections: [],
      materials: [],
    };
    const lesson = (await h.send("post", base, input)).body;
    const options = {
      baseVersion: 1,
      kind: "lesson-plan",
      format: "docx",
      includeAnswers: false,
      includeTeacherNotes: false,
      sectionIds: [],
      materialReferenceIds: [],
      answerSpaceLines: 0,
    };
    const wait = async (id) => {
      let job;
      const end = Date.now() + 30000;
      do {
        job = (await h.send("get", `/api/workbench/jobs/${id}`)).body;
        if (!["queued", "running"].includes(job.state)) return job;
        await new Promise((r) => setTimeout(r, 30));
      } while (Date.now() < end);
      return job;
    };
    const key = randomUUID(),
      url = `${base}/${lesson.id}/exports`;
    const first = await h.send("post", url, options, key);
    assert.equal(first.status, 202);
    const success = await wait(first.body.jobId);
    assert.equal(success.state, "succeeded");
    const bad = await h.send("put", `${base}/${lesson.id}`, {
      ...input,
      baseVersion: 1,
      intro: {
        version: 2,
        blocks: [{ type: "math", latex: "\\unknownR34{x}" }],
      },
    });
    assert.equal(bad.status, 200);
    const rejected = await h.send("post", url, { ...options, baseVersion: 2 });
    assert.equal(rejected.status, 422);
    assert.equal(rejected.body.type, "/problems/materials/unsupported-formula");
    assert.equal((await h.send("get", url)).body.items.length, 1);
    const fixed = await h.send("put", `${base}/${lesson.id}`, {
      ...input,
      baseVersion: 2,
    });
    assert.equal(fixed.status, 200);
    const original = process.env.MATERIALS_OFFICE_ROOT;
    process.env.MATERIALS_OFFICE_ROOT = path.join(h.dir, "missing-office");
    const failure = await h.send("post", url, { ...options, baseVersion: 3 });
    const failed = await wait(failure.body.jobId);
    if (original === undefined) delete process.env.MATERIALS_OFFICE_ROOT;
    else process.env.MATERIALS_OFFICE_ROOT = original;
    assert.equal(failed.state, "failed");
    assert.deepEqual(failed.outputFileIds, []);
    const retry = await h.send(
      "post",
      `/api/workbench/jobs/${failed.id}/retry`,
      { unitIds: [] },
    );
    assert.equal(retry.status, 409, JSON.stringify(retry.body));
    const list = (await h.send("get", url)).body.items;
    assert.equal(list.find((r) => r.id === failure.body.id).fileId, null);
    assert.ok(list.find((r) => r.id === first.body.id).fileId);
    await h.restart();
    const replay = await h.send("post", url, options, key);
    assert.deepEqual(replay.body, first.body);
    const foreign = await h.send("get", url, undefined, randomUUID(), "r34-b");
    assert.equal(foreign.status, 404);
    const foreignFile = await h.send(
      "get",
      `/api/workbench/files/${success.outputFileIds[0]}`,
      undefined,
      randomUUID(),
      "r34-b",
    );
    assert.equal(foreignFile.status, 404);
  } finally {
    h.close();
  }
});
test("MC17/21: accepted snapshot is fixed; storage failure and missing output recover without losing prior successes", async () => {
  const h = await harness();
  try {
    const input = {
      title: "受理时标题",
      intro: {
        version: 2,
        blocks: [
          { type: "paragraph", runs: [{ type: "text", text: "受理时正文" }] },
        ],
      },
      sections: [],
      materials: [],
    };
    const lesson = (await h.send("post", base, input)).body,
      url = `${base}/${lesson.id}/exports`;
    const options = {
      baseVersion: 1,
      kind: "lesson-plan",
      format: "docx",
      includeAnswers: false,
      includeTeacherNotes: false,
      sectionIds: [],
      materialReferenceIds: [],
      answerSpaceLines: 0,
    };
    const wait = async (id) => {
      let job;
      do {
        job = (await h.send("get", `/api/workbench/jobs/${id}`)).body;
        if (!["queued", "running"].includes(job.state)) return job;
        await new Promise((r) => setTimeout(r, 30));
      } while (true);
    };
    const accepted = await h.send("post", url, options);
    await h.send("put", `${base}/${lesson.id}`, {
      ...input,
      title: "后来修改",
      baseVersion: 1,
    });
    const success = await wait(accepted.body.jobId);
    assert.equal(success.state, "succeeded");
    const file = success.outputFileIds[0],
      download = await h.send("get", `/api/workbench/files/${file}/content`);
    assert.equal(download.status, 200);
    const fileDirectory = path.join(h.dir, "files");
    fs.renameSync(fileDirectory, `${fileDirectory}-held`);
    const missing = await h.send("get", `/api/workbench/files/${file}/content`);
    assert.equal(missing.status, 503);
    fs.renameSync(`${fileDirectory}-held`, fileDirectory);
    assert.equal(
      (await h.send("get", `/api/workbench/files/${file}/content`)).status,
      200,
    );
    // A real SQLite write rejection at the durable file commit simulates a full
    // storage device, while all HTTP, conversion and file staging remain real.
    h.runtime().workbench.db.exec(
      "CREATE TRIGGER r34_fail_file_commit BEFORE INSERT ON materials_files BEGIN SELECT RAISE(ABORT, 'database or disk is full'); END",
    );
    const failure = await h.send("post", url, { ...options, baseVersion: 2 });
    const failed = await wait(failure.body.jobId);
    assert.equal(failed.state, "failed");
    assert.equal(failed.issues[0].code, "disk-full");
    h.runtime().workbench.db.exec("DROP TRIGGER r34_fail_file_commit");
    const retry = await h.send("post", url, { ...options, baseVersion: 2 });
    assert.equal((await wait(retry.body.jobId)).state, "succeeded");
    const outputs = (await h.send("get", url)).body.items;
    assert.equal(outputs.filter((r) => r.fileId).length, 2);
  } finally {
    h.close();
  }
});
test("MC11/15/16: old lesson keeps v1 content, explicit repeated references and deleted sources retain snapshots and usages", async () => {
  const h = await harness();
  try {
    const oldInput = {
        title: "旧版备课",
        intro: { version: 1, blocks: [] },
        sections: [],
        materials: [],
      },
      key = randomUUID();
    const old = await h.send(
      "post",
      "/api/modules/lessons/items",
      oldInput,
      key,
    );
    assert.equal(old.status, 201);
    const migrated = (await h.send("get", `${base}/${old.body.id}`)).body;
    assert.equal(migrated.id, old.body.id);
    assert.equal(migrated.intro.version, 1);
    assert.equal(migrated.version, 1);
    const qid = randomUUID();
    h.adapters.questions.set(qid, {
      id: qid,
      version: 1,
      deletedAt: null,
      snapshot: {
        title: "保留快照",
        body: {
          version: 1,
          blocks: [
            { type: "paragraph", runs: [{ type: "text", text: "已采用题面" }] },
          ],
        },
        solution: { version: 1, blocks: [] },
        answerStatus: "absent",
      },
    });
    const refs = [
      {
        id: randomUUID(),
        kind: "question",
        questionId: qid,
        questionVersion: 1,
        note: "第一次",
      },
      {
        id: randomUUID(),
        kind: "question",
        questionId: qid,
        questionVersion: 1,
        note: "第二次",
      },
    ];
    const update = await h.send("put", `${base}/${old.body.id}`, {
      ...oldInput,
      baseVersion: 1,
      materials: refs,
    });
    assert.equal(update.status, 200);
    h.adapters.questions.get(qid).deletedAt = new Date().toISOString();
    const stillSaved = await h.send("put", `${base}/${old.body.id}`, {
      ...oldInput,
      baseVersion: 2,
      materials: refs,
    });
    assert.equal(stillSaved.status, 200);
    assert.equal(stillSaved.body.materials[0].sourceState, "deleted");
    const usagePath = `/api/modules/lessons/v2/question-usages/${qid}`;
    assert.equal((await h.send("get", usagePath)).body.items.length, 2);
    const deleted = await h.send("post", `${base}/${old.body.id}/deletion`, {
      baseVersion: 3,
      deleted: true,
    });
    assert.equal(deleted.status, 200);
    assert.equal((await h.send("get", usagePath)).body.items.length, 0);
    const restored = await h.send("post", `${base}/${old.body.id}/deletion`, {
      baseVersion: 4,
      deleted: false,
    });
    assert.equal(restored.status, 200);
    assert.equal((await h.send("get", usagePath)).body.items.length, 2);
    assert.deepEqual(
      (await h.send("post", "/api/modules/lessons/items", oldInput, key)).body,
      old.body,
    );
  } finally {
    h.close();
  }
});
test('MC17/19: interrupted and cancelled export tasks recover only through a fresh explicit export',async()=>{
 const h=await harness();try{
  const lesson=(await h.send('post',base,{title:'重启恢复',intro:{version:2,blocks:[{type:'math',latex:'\\frac{x+2}{x-1}'}]},sections:[],materials:[]})).body;
  const url=`${base}/${lesson.id}/exports`,options={baseVersion:1,kind:'lesson-plan',format:'docx',includeAnswers:false,includeTeacherNotes:false,sectionIds:[],materialReferenceIds:[],answerSpaceLines:0};
  const waitFor=async(id,states)=>{const deadline=Date.now()+30000;while(Date.now()<deadline){const job=(await h.send('get',`/api/workbench/jobs/${id}`)).body;if(states.includes(job.state))return job;await new Promise(r=>setTimeout(r,10));}throw new Error('Job deadline');};
  const first=await h.send('post',url,options);await waitFor(first.body.jobId,['running']);await h.restart();
  const interrupted=await waitFor(first.body.jobId,['interrupted']);assert.deepEqual(interrupted.outputFileIds,[]);assert.equal((await h.send('get',url)).body.items[0].fileId,null);
  const second=await h.send('post',url,options);await waitFor(second.body.jobId,['running']);const cancel=await h.send('post',`/api/workbench/jobs/${second.body.jobId}/cancel`,{});assert.equal(cancel.status,200);await waitFor(second.body.jobId,['cancelled']);
  const third=await h.send('post',url,options);const success=await waitFor(third.body.jobId,['succeeded','failed']);assert.equal(success.state,'succeeded');
  assert.equal((await h.send('get',url)).body.items.filter(r=>r.fileId).length,1);
 }finally{h.close();}
});
