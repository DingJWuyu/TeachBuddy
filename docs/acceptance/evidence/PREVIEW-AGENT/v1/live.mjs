// Explicit one-window browser verification. Refuses to overwrite its ledger.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { InMemoryCredentialStore } from '@earendil-works/pi-ai';
import { streamSimple } from '@earendil-works/pi-ai/api/openai-completions';
import { createIntegration } from '../../../../../apps/api/test/fixtures/c26/harness.js';
const evidence = path.dirname(fileURLToPath(import.meta.url));
const ledgerPath = path.join(evidence, 'live-ledger.json');
const correcting = process.argv.includes('--correct-placement');
if (fs.existsSync(ledgerPath) && !correcting) throw Error('This verification window already has a ledger; do not restart it');
if (correcting && !fs.existsSync(ledgerPath)) throw Error('Correction requires the original ledger');
const settings = parseEnv(fs.readFileSync('/home/liam_t/项目/TeacherWorkspace-mvp/.env', 'utf8'));
if (!settings.COMMANDCODE_API_KEY || settings.COMMANDCODE_BASE_URL !== 'https://api.commandcode.ai/provider/v1') throw Error('Authorized server configuration unavailable');
const modelId = 'deepseek/deepseek-v4.1-flash';
const directory = path.resolve('test-results/preview-agent-live');
fs.mkdirSync(directory, { recursive: true });
const initialReport = { task: 'PREVIEW-AGENT@1', startedAt: new Date().toISOString(), modelId, directory, identity: 'real-auth/fake-mail', requestLimit: 6, completionLimit: 48000, requests: [], status: 'started' };
const report = correcting ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : initialReport;
if (correcting) {
  if (report.requests.length !== 4 || report.correctionStartedAt) throw Error('No fresh correction allowance');
  report.initialVerification = { status: report.status, error: report.verificationError, snapshot: report.snapshot, lesson: report.lesson };
  report.correctionStartedAt = new Date().toISOString();
  delete report.verificationError;
}
const save = () => fs.writeFileSync(ledgerPath, JSON.stringify(report, null, 2));
save();
const runtime = await ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
runtime.registerProvider('commandcode', {
  baseUrl: settings.COMMANDCODE_BASE_URL, api: 'openai-completions', apiKey: settings.COMMANDCODE_API_KEY,
  models: [modelId, 'z-ai/glm-5.3-flash'].map(id => ({ id, name: id, reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8000 })),
  streamSimple(model, context, options) {
    if (model.id !== modelId || report.requests.length >= 6) throw Error('Verification request window exhausted');
    return streamSimple(model, context, { ...options, apiKey: settings.COMMANDCODE_API_KEY, maxTokens: 8000, maxRetries: 0,
      onPayload(payload) {
        if (report.requests.length >= 6) throw Error('Verification request window exhausted');
        const maximum = payload.max_completion_tokens ?? payload.max_tokens;
        assert.equal(maximum, 8000);
        report.requests.push({ ordinal: report.requests.length + 1, startedAt: new Date().toISOString(), model: payload.model, maxCompletionTokens: maximum });
        save();
      },
    });
  },
});
let world = await createIntegration({ directory, agent: { apiKey: settings.COMMANDCODE_API_KEY, baseUrl: settings.COMMANDCODE_BASE_URL, modelRuntime: runtime } });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
let pageId;
page.on('request', request => { pageId = request.headers()['x-teachbuddy-page'] ?? pageId; });
const document = text => ({ version: 2, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text }] }] });
async function request(method, url, data) {
  const response = await page.request.fetch(world.origin + url, { method, headers: { Origin: world.origin, 'X-TeachBuddy-Request': '1', 'X-TeachBuddy-Page': pageId, 'Idempotency-Key': randomUUID() }, ...(data ? { data } : {}) });
  assert.ok(response.ok(), `Business HTTP ${response.status()}: ${await response.text()}`);
  return response.json();
}
try {
  await page.goto(world.origin);
  if (correcting) {
    await page.getByLabel('邮箱', { exact: true }).fill('preview-agent-live@example.test');
    await page.getByLabel('密码', { exact: true }).fill('preview-agent-local-password');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.getByRole('textbox', { name: 'AI 输入' }).waitFor();
  } else {
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('预览验证老师');
  await page.getByLabel('邮箱', { exact: true }).fill('preview-agent-live@example.test');
  await page.getByLabel('密码', { exact: true }).fill('preview-agent-local-password');
  await page.getByLabel('确认密码', { exact: true }).fill('preview-agent-local-password');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await page.getByLabel('邮箱验证码').waitFor();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', 'preview-agent-live@example.test'));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await page.locator('.wb-shell').waitFor();
  report.originalQuestion = await request('POST', '/api/modules/questions/v2/items', { title: '预览原题：等差数列', body: document('等差数列首项为3，公差为2，求前10项和。'), solution: document('前10项和为120。'), answerStatus: 'present', note: '原题备注必须保留', starred: false, typeId: null, tagIds: [], source: { kind: 'manual' } });
  report.originalLesson = await request('POST', '/api/modules/lessons/v3', { title: '预览备课：数列探索', intro: document('保留导入文稿'), sections: [{ id: randomUUID(), title: '课堂热身', content: document('保留热身内容'), references: [] }, { id: randomUUID(), title: '小组挑战', content: document('保留挑战说明'), references: [] }], materials: [] });
  await page.getByRole('button', { name: '新对话', exact: true }).click();
  }
  const prompt = correcting ? '上次实际把副本放在了全局 materials，并未放入小组挑战。请根据上次工具已返回的备课version 2完整数据，在一次wb_update_lesson调用中把这条已有引用从全局materials移到标题为小组挑战的sections条目的references，保留引用ID、其他环节及文稿，不创建新题目。当前对话中已有完整保存结果，无需再次查询。保存后核对工具结果中的sections位置，再简要报告。' : '找到题目“预览原题：等差数列”，保留原题，复制改编为首项5、公差3、求前8项和的新题，给出正确答案124；副本标题为“预览改编题：数列进阶”。再把副本加入备课“预览备课：数列探索”的“小组挑战”环节，保留其他全部内容、文稿和备注。请实际保存，并简要报告结果。';
  await page.getByRole('textbox', { name: 'AI 输入' }).fill(prompt);
  await page.getByText('草稿已保存', { exact: true }).waitFor();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.agent-turn-status') && !document.querySelector('button[aria-label="停止"]'), { timeout: 195000 }).catch(() => {});
  const until = Date.now() + 195000;
  while (Date.now() < until) {
    const row = world.workbench.db.prepare('SELECT accountKey,id FROM agent_conversations LIMIT 1').get();
    if (row) {
      const data = world.workbench.agent.store.read(row.accountKey, row.id);
      report.snapshot = data.snapshot; report.productRequests = data.requests;
      save();
      if (data.snapshot.turns.at(-1) && data.snapshot.turns.at(-1).state !== 'running') break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  report.questions = await request('GET', '/api/modules/questions/v2/items');
  report.lesson = await request('GET', '/api/modules/lessons/v3/' + report.originalLesson.id);
  report.status = report.snapshot.turns.at(-1).state;
  await page.screenshot({ path: path.join(evidence, 'live-home.png') });
  assert.equal(report.status, 'completed');
  assert.deepEqual(report.questions.items.find(q => q.id === report.originalQuestion.id), report.originalQuestion);
  const copy = report.questions.items.find(q => q.title === '预览改编题：数列进阶');
  assert.ok(copy); assert.match(JSON.stringify(copy.solution), /124/);
  assert.equal(report.lesson.sections[1].references[0].questionId, copy.id);
  assert.deepEqual(report.lesson.intro, report.originalLesson.intro);
  assert.deepEqual(report.lesson.sections.map(s => s.content), report.originalLesson.sections.map(s => s.content));
  await page.locator('.agent-tool[data-tool-state="confirmed"]').first().getByRole('button', { name: /打开题目/ }).click();
  await page.getByRole('textbox', { name: '题目标题' }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: '题目标题' }).inputValue(), copy.title);
  await page.screenshot({ path: path.join(evidence, 'live-copy.png') });
  await page.locator('.wb-ai-entry').click();
  await page.locator('.agent-tool[data-tool-state="confirmed"]').last().getByRole('button', { name: /打开备课/ }).click();
  await page.getByRole('textbox', { name: '环节名称 2' }).waitFor();
  await page.screenshot({ path: path.join(evidence, 'live-lesson.png') });
  report.browserBusiness = 'PASS';
} catch (error) { report.verificationError = error.message; }
finally {
  const row = world.workbench.db.prepare('SELECT accountKey,id FROM agent_conversations LIMIT 1').get();
  if (row) { const data = world.workbench.agent.store.read(row.accountKey, row.id); report.snapshot = data.snapshot; report.productRequests = data.requests; }
  report.finishedAt = new Date().toISOString(); save();
  await browser.close(); await world.close();
}
console.log(JSON.stringify({ status: report.status, requests: report.requests.length, usage: report.snapshot?.turns.map(t => t.usage), browserBusiness: report.browserBusiness, error: report.verificationError }));
