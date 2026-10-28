import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { application, upload, readFixture, download, importFiles, preview, json, importsPath, textOf } from './helpers.js';

for (const name of ['W.docx', 'P.pdf']) {
  test(`C1 ${name} 原生提取保留已有答案、公式、题图及可回读原件`, { timeout: 180000 }, async t => {
    const world = await application(t);
    const { client } = world;
    const bytes = readFixture(`questions/${name}`);
    const file = await upload(client, name, bytes);
    const material = await importFiles(client, [file.id], name);
    assert.equal(material.drafts.length, 6, '六道原题应各保留一个校对候选');
    const all = textOf(material.drafts);
    assert.match(all, /sqrt|√/, '原生数学内容必须保留根式');
    const domain = material.drafts.find(draft => /定义域/.test(textOf(draft.body)));
    assert.ok(domain, '定义域题须保留');
    assert.match(textOf(domain.body), /sqrt|√/, '定义域题的分子根式不得从原生公式中丢失');
    assert.match(textOf(domain.body), /x.?[-−]\s*2/, '定义域题须保留不为零的分母');
    assert.match(all, /x.*2|2.*x/, '原生数学内容必须保留函数变量与系数');
    const withoutAnswers = material.drafts.filter(draft => draft.answerStatus === 'absent');
    assert.equal(withoutAnswers.length, 1, '只有原件未给答案的 Q6 保持无答案');
    assert.match(textOf(withoutAnswers[0].body), /正方体|ABCD/);
    assert.deepEqual(withoutAnswers[0].solution.blocks, [], '提取不可生成 Q6 解答');
    const figures = material.drafts.flatMap(draft => draft.body.blocks.filter(block => block.type === 'image'));
    assert.ok(figures.length >= 3, '抛物线、三角形和正方体必须保留实际配图');
    for (const figure of figures) {
      const metadata = await sharp(await download(client, figure.fileId)).metadata();
      assert.ok(metadata.width > 20 && metadata.height > 20, '题图必须可实际解码');
    }
    for (const draft of material.drafts) {
      assert.ok(draft.parts.length > 0, '每道题须保留原稿位置');
      assert.ok(draft.parts.every(part => part.locations.every(location => location.fileId === file.id)), '定位必须关联本次不可变原件');
    }
    assert.deepEqual(await download(client, file.id), bytes, '原生提取不得改写上传原件');
    const reviewed = await json(client, 'PUT', `${importsPath}/${material.id}`, {
      baseVersion: material.version,
      drafts: material.drafts.map(draft => ({ ...draft, issues: draft.issues.map(issue => ({ ...issue, resolution: 'corrected' })) })),
      fragments: material.fragments,
    });
    const chosen = reviewed.drafts[0];
    const committed = await json(client, 'POST', `${importsPath}/${material.id}/commit`, { baseVersion: reviewed.version, draftIds: [chosen.id] });
    const saved = await json(client, 'GET', `/api/modules/questions/v2/items/${committed.questions[0].id}`);
    assert.deepEqual(saved.body, chosen.body, '入库须保留校对后的丰富文稿');
    assert.deepEqual(saved.solution, chosen.solution, '原件已有答案须与题面分别保存');
    world.complete();
  });
}

test('C1 真实 Office 预览产生可读页，旧 DOC 风险不被成功转换抹去', { timeout: 180000 }, async t => {
  const world = await application(t);
  for (const name of ['c22.pptx', 'c22.ppt', 'w.doc']) {
    const bytes = readFixture(`materials/${name}`);
    const file = await upload(world.client, name, bytes);
    const view = await preview(world.client, file.id, name.endsWith('.doc') ? 'partial' : 'succeeded');
    assert.ok(['ready', 'limited'].includes(view.state), `${name} 应产生真实预览`);
    assert.ok(view.pages.length >= (name.endsWith('.doc') ? 1 : 3), `${name} 不得丢失课件页面`);
    const pdfPath = path.join(world.directory, `${name}.pdf`);
    fs.writeFileSync(pdfPath, await download(world.client, view.renditionFileId));
    const contents = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
    if (name.endsWith('.doc')) assert.match(contents, /正方体/, '旧 DOC 预览须保留原稿题目正文');
    else for (const word of ['二次函数', '教学目标', 'Q2', 'Q5'])
      assert.ok(contents.includes(word), `课件预览不得丢失教学内容：${word}`);
    for (const page of view.pages) {
      const png = await download(world.client, page.imageFileId);
      const metadata = await sharp(png).metadata();
      const stats = await sharp(png).stats();
      assert.ok(metadata.width > 300 && metadata.height > 300, '预览页必须达到可读尺寸');
      assert.ok(stats.channels.some(channel => channel.stdev > 5), '预览页不得为空白图片');
    }
    if (name.endsWith('.doc')) {
      assert.equal(view.state, 'limited');
      assert.match(textOf(view), /legacy-object-loss/, '旧 DOC 成功转换仍需显示对象丢失风险');
    }
    assert.deepEqual(await download(world.client, file.id), bytes);
  }
  world.complete();
});
