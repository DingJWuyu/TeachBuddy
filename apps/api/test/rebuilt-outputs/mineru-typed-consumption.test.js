import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { application, upload, download, preview, json, finished, importFiles, filesPath } from './helpers.js';

const fixtures = new URL('../fixtures/mineru-recognition/', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pixels = async bytes => sha(await sharp(bytes).removeAlpha().raw().toBuffer());
const blocks = value => value.flatMap(block => [block,
  ...(block.type === 'table' ? block.rows.flatMap(row => row.flatMap(cell => blocks(cell.blocks))) : []),
  ...(block.type === 'list' ? block.items.flatMap(item => blocks(item.blocks)) : []),
]);

test('C typed 官方 D2/D8 保留行内公式和表格 eq，受控 typed 列表保留项目与子公式', { timeout: 180000 }, async t => {
  const provenance = JSON.parse(fs.readFileSync(new URL('provenance.json', fixtures)));
  const inputs = [
    { id: 'D2', bytes: fs.readFileSync(new URL('../../../../test/fixtures/questions/recognition-document-4/I-2/page.png', import.meta.url)) },
    { id: 'D8', bytes: fs.readFileSync(new URL('../fixtures/ocr-selection/pages/D8.png', import.meta.url)) },
  ];
  for (const input of inputs) {
    const recorded = fs.readFileSync(new URL(`${input.id}/middle_json.json`, fixtures));
    assert.equal(sha(recorded), provenance.files[`${input.id}/middle_json.json`], '官方录制保持冻结摘要');
    input.raw = JSON.parse(recorded);
    const assets = new URL(`${input.id}/images/`, fixtures);
    input.originalAssets = fs.existsSync(assets) ? fs.readdirSync(assets).map(name => ({ name: `images/${name}`, bytes: fs.readFileSync(new URL(name, assets)) })) : [];
  }
  // D2/D8 contain no typed list. This visible authored page and controlled
  // output cover that branch separately; they are not an official recording.
  const list = { type: 'list', bbox: [.05, .1, .95, .9], content: [
    { type: 'text', content: [{ type: 'text', content: '教师活动：观察 ' }, { type: 'equation_inline', content: 'f(x)=x^2' }] },
    { type: 'text', content: [{ type: 'text', content: '教学点评：比较 ' }, { type: 'equation_inline', content: 'g(x)=x^3' }] },
  ] };
  inputs.push({ id: 'authored-list', bytes: await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300"><rect width="1000" height="300" fill="white"/><g font-family="sans-serif" font-size="32" fill="black"><text x="30" y="90">教师活动：观察 f(x)=x²</text><text x="30" y="180">教学点评：比较 g(x)=x³</text></g></svg>')).png().toBuffer(),
    raw: { metadata: { fixture: 'self-authored controlled typed list' }, pages: [{ blocks: [list] }] }, originalAssets: [] });
  const byPixels = new Map();
  for (const input of inputs) byPixels.set(await pixels(input.bytes), input);
  const calls = [];
  const recognizer = { revision: 'mineru-pro-2605/document-6', available: true, async run({ bytes, width, height }) {
    const input = byPixels.get(await pixels(bytes));
    assert.ok(input, 'typed 回放必须绑定实际固定原页像素');
    calls.push(input.id);
    return { raw: input.raw, pageBlocks: input.raw.pages[0].blocks, width, height, assets: [], originalAssets: input.originalAssets, derivations: [] };
  } };
  const world = await application(t, { workbench: { recognition: { recognizer } } });
  for (const input of inputs) {
    const file = await upload(world.client, `${input.id}.png`, input.bytes);
    const view = await preview(world.client, file.id);
    const endpoint = `${filesPath}/${file.id}/recognition`;
    const job = await json(world.client, 'POST', endpoint, { renditionFileId: view.renditionFileId, pages: [1] }, 202);
    assert.equal((await finished(world.client, job.id)).state, 'succeeded');
    const pageUrl = `${endpoint}/pages/1?renditionFileId=${view.renditionFileId}`;
    const page = await json(world.client, 'GET', pageUrl);
    assert.equal(page.state, 'ready');
    assert.deepEqual(JSON.parse(await download(world.client, page.rawFileId)), input.raw, '官方原 raw 和受控原 raw 分别无损保存');
    const material = await importFiles(world.client, [file.id], `typed-${input.id}`);
    if (input.id === 'D2') {
      const originalCases = input.raw.pages[0].blocks[1].content.find(span => span.type === 'equation_inline').content;
      const runs = page.blocks[1].document.blocks[0].runs;
      assert.equal(runs[1].type, 'math');
      assert.equal(runs[1].latex, originalCases, '官方两行分段 LaTeX 不能扁平化成文字或图片');
      assert.equal(material.drafts.length, 2);
      const adoptedMath = material.drafts.flatMap(draft => blocks(draft.body.blocks).flatMap(block => block.runs ?? [])).filter(run => run.type === 'math');
      assert.ok(adoptedMath.some(run => run.latex === originalCases), '题库须消费实际分段公式节点');
      assert.ok(adoptedMath.some(run => run.latex === String.raw`\log_2(x - 1) \leq 1`), '对数不等式的源和关系号须保持');
    } else if (input.id === 'D8') {
      const table = page.document.blocks.find(block => block.type === 'table');
      assert.ok(table, '官方 table_body 必须成为真正表格');
      assert.equal(table.rows.length, 6);
      assert.ok(table.rows.every(row => row.length === 3));
      assert.deepEqual(table.rows[0].map(cell => cell.blocks[0].runs[0].text), ['环节', '学生记录', '教师追问']);
      assert.deepEqual(table.rows[2][1].blocks[0].runs, [{ type: 'math', latex: 'a_n = 18 + 3(n-1)' }], 'table eq 必须保留可编辑通项公式');
      assert.deepEqual(table.rows[4][1].blocks[0].runs, [{ type: 'math', latex: String.raw`S_{12} = \frac{12(18+51)}{2} = 414` }], '求和公式及414结论须保持同一单元格');
      const fragmentTable = material.fragments.flatMap(fragment => fragment.document?.blocks ?? []).find(block => block.type === 'table');
      assert.deepEqual(fragmentTable, table, '归属待校对的官方表须以结构片段保留');
      assert.equal(blocks(page.document.blocks).filter(block => block.type === 'image').length, 0, '官方公式/表格证据截图不能冒充可编辑内容');
      assert.deepEqual(page.document.blocks.filter(block => block.type === 'math').map(block => block.latex), input.raw.pages[0].blocks.filter(block => block.type === 'equation').map(block => block.content), '官方独立公式必须保持为数学块及原 LaTeX');
      assert.equal(page.originalAssetFileIds.length, 5);
      for (const id of page.originalAssetFileIds) assert.equal((await sharp(await download(world.client, id)).metadata()).format, 'jpeg');
    } else {
      const actual = page.document.blocks[0];
      assert.equal(actual.type, 'list');
      assert.equal(actual.items.length, 2);
      assert.deepEqual(actual.items.map(item => item.blocks[0].runs), [
        [{ type: 'text', text: '教师活动：观察 ' }, { type: 'math', latex: 'f(x)=x^2' }],
        [{ type: 'text', text: '教学点评：比较 ' }, { type: 'math', latex: 'g(x)=x^3' }],
      ], 'typed 列表项目次序和各自子公式不能丢失或串项');
      assert.deepEqual(material.fragments.flatMap(fragment => fragment.document.blocks.flatMap(block => block.type === 'list' ? block.items : [])), actual.items, '人工分配片段须保留原列表子结构');
    }
    const reread = await json(world.client, 'GET', pageUrl);
    assert.deepEqual(reread.document, page.document, '题库消费不能覆写机器文稿');
    assert.deepEqual(JSON.parse(await download(world.client, reread.rawFileId)), input.raw);
  }
  assert.deepEqual(calls, ['D2', 'D8', 'authored-list'], '已完成 typed 页的消费者不得再次请求识别');
  world.complete();
});
