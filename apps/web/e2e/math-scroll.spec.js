import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, save } from './fixtures/math-scroll/helpers.mjs';
import { wheelTo, clickTool, fillTool, openSection, showTools, closeTools, layout } from './fixtures/math-scroll/interactions.mjs';

const evidence = path.resolve(process.env.M43_SCROLL_EVIDENCE || 'docs/acceptance/evidence/M43/v1/scroll-fix/green');
for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
  test(`tools ordinary editing and persistence ${viewport.width}x${viewport.height}`, async ({ page, context, browser }) => {
    await page.setViewportSize(viewport);
    const out = path.join(evidence, `${viewport.width}x${viewport.height}`);
    fs.mkdirSync(out, { recursive: true });
    const world = await createIntegration();
    const records = { browser: browser.version(), directory: world.directory, origin: world.origin, viewport, edits: [] };
    const button = name => page.getByRole('button', { name, exact: true });
    async function create(kind, title) {
      await showTools(page);
      await clickTool(page, button(`新建${kind}`).last());
      await closeTools(page);
      await page.getByLabel('作品名称').fill(title);
      await showTools(page);
    }
    async function saveBaseline() {
      await closeTools(page);
      expect((await save(page)).version).toBe(1);
      await showTools(page);
    }
    async function persist(title) {
      await closeTools(page);
      const result = await save(page);
      expect(result.version).toBe(2);
      records.edits.push({ title, id: result.id, version: result.version, source: result.source });
      await page.reload();
      await expect(page.getByLabel('作品名称')).toHaveValue(title);
      await showTools(page);
      return result;
    }
    try {
      await register(page, world, 'scroll@example.test');
      await create('演示', '滚动动态');
      await saveBaseline();
      const before = await layout(page);
      const steps = await openSection(page, '步骤');
      const after = await layout(page);
      expect(after.regions.find(r => r.name === 'math-tools-panel').top).toBeGreaterThan(0);
      for (const region of before.regions.filter(r => r.name !== 'math-tools-panel')) {
        const current = after.regions.find(r => r.name === region.name);
        expect([current.top, current.left, current.rect]).toEqual([region.top, region.left, region.rect]);
      }
      expect(after.window).toEqual(before.window);
      records.scroll = { before, after };
      // Traverse the actual tab order from the summary into the step fields.
      await steps.click(); // collapse
      await page.keyboard.press('Enter'); // expand, with keyboard focus on summary
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('初始步骤')).toBeFocused();
      await page.keyboard.press('Tab');
      const titleInput = page.getByLabel('步骤 1 标题');
      await expect(titleInput).toBeFocused();
      await expect(titleInput).toBeInViewport({ ratio: 1 });
      expect((await titleInput.boundingBox()).width).toBeGreaterThan(100);
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type('滚动可编辑步骤');
      await fillTool(page, '步骤 2 标题', '平移与定位');
      await clickTool(page, button('上移步骤 3'));
      await openSection(page, '拖动绑定');
      await clickTool(page, page.getByLabel('拖动 1 y', { exact: true }));
      await page.getByLabel('拖动 1 y', { exact: true }).selectOption('');
      const dynamic = await persist('滚动动态');
      expect(dynamic.source.steps.map(s => s.id)).toEqual(['base', 'full', 'translate']);
      expect(dynamic.source.drags[0].yParameter).toBeNull();
      await openSection(page, '步骤');
      await wheelTo(page, titleInput);
      await expect(titleInput).toHaveValue('滚动可编辑步骤');
      const objectToggle = titleInput.locator('..').locator('..').getByLabel('P', { exact: true });
      await wheelTo(page, objectToggle);
      expect((await objectToggle.boundingBox()).width).toBeLessThan(30);
      await page.screenshot({ path: path.join(out, 'dynamic-steps.png') });
      // AI and tools still share one right panel, including unsent draft preservation.
      await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
      await page.getByLabel('AI 输入').fill('保留的未发送草稿');
      await page.getByRole('tab', { name: '作品与工具', exact: true }).click();
      await openSection(page, '步骤');
      await expect(titleInput).toHaveValue('滚动可编辑步骤');
      await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
      await expect(page.getByLabel('AI 输入')).toHaveValue('保留的未发送草稿');
      await expect(page.locator('.wb-aux')).toHaveCount(1);
      await page.screenshot({ path: path.join(out, 'ai-panel.png') });
      await showTools(page);

      await create('平面图形', '滚动函数');
      await clickTool(page, button('添加函数'));
      await saveBaseline();
      await fillTool(page, 'expression', 'x^2-2*x-2');
      await openSection(page, '坐标窗');
      await fillTool(page, 'xMin', '-8');
      await fillTool(page, 'xMax', '8');
      await fillTool(page, 'yMin', '-4');
      const fn = await persist('滚动函数');
      expect(fn.source.scene.viewport).toMatchObject({ xMin: -8, xMax: 8, yMin: -4 });
      await openSection(page, '坐标窗');
      await wheelTo(page, page.getByLabel('xMin', { exact: true }));
      await expect(page.getByLabel('xMin', { exact: true })).toHaveValue('-8');
      await page.screenshot({ path: path.join(out, 'function-window.png') });

      await create('平面图形', '滚动顶点');
      await clickTool(page, button('添加多边形'));
      await saveBaseline();
      await clickTool(page, button('添加顶点'));
      await fillTool(page, 'points-3-x', '-2');
      await fillTool(page, 'points-3-y', '1');
      const plane = await persist('滚动顶点');
      expect(plane.source.scene.elements[0].points).toHaveLength(4);
      expect(plane.source.scene.elements[0].points[3]).toEqual({ x: '-2', y: '1' });
      await wheelTo(page, page.getByLabel('points-3-y', { exact: true }));
      await expect(page.getByLabel('points-3-y', { exact: true })).toHaveValue('1');
      await page.screenshot({ path: path.join(out, 'plane-vertex.png') });

      await create('空间图形', '滚动立体');
      await clickTool(page, button('正方体起点'));
      await saveBaseline();
      await clickTool(page, button('添加棱'));
      await openSection(page, '棱');
      await fillTool(page, 'edge-12-to', 'C1');
      await clickTool(page, page.getByLabel('edge-12-style-dash', { exact: true }));
      await page.getByLabel('edge-12-style-dash', { exact: true }).selectOption('dashed');
      const space = await persist('滚动立体');
      expect(space.source.edges).toHaveLength(13);
      expect(space.source.edges[12]).toMatchObject({ from: 'A', to: 'C1', style: { dash: 'dashed' } });
      await openSection(page, '棱');
      await wheelTo(page, page.getByLabel('edge-12-style-dash', { exact: true }));
      await expect(page.getByLabel('edge-12-to', { exact: true })).toHaveValue('C1');
      await expect(page.getByLabel('edge-12-style-dash', { exact: true })).toHaveValue('dashed');
      await page.screenshot({ path: path.join(out, 'space-edge.png') });
      const bounds = await page.locator('.math-tools-panel').boundingBox();
      await page.mouse.move(bounds.x + bounds.width - 20, bounds.y + bounds.height / 2);
      await page.mouse.wheel(0, 2000);
      await expect.poll(() => page.locator('.math-tools-panel').evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop))).toBeLessThan(2);
      const bottom = await layout(page);
      await page.mouse.wheel(0, 2000);
      await page.keyboard.press('Tab');
      const contained = await layout(page);
      expect(contained.window).toEqual(bottom.window);
      expect(contained.regions.filter(r => r.name !== 'math-tools-panel')).toEqual(bottom.regions.filter(r => r.name !== 'math-tools-panel'));
      records.bottomContainment = contained;

      await closeTools(page);
      await expect(page.getByRole('img', { name: '当前数学图形预览' })).toBeVisible();
      await page.screenshot({ path: path.join(out, 'canvas.png') });
      records.finalLayout = await layout(page);
      expect(records.finalLayout.window).toEqual([0, 0]);
      records.passed = true;
    } finally {
      fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(records, null, 2));
      await context.close();
      await world.close();
    }
  });
}

test('formula tools and shared lesson return remain usable', async ({ page, context }) => {
  const world = await createIntegration();
  try {
    await register(page, world, 'scroll-return@example.test');
    await closeTools(page);
    await page.locator('.wb-sidebar').getByRole('link', { name: '备课', exact: true }).click();
    await page.getByRole('button', { name: '新建备课', exact: true }).click();
    await page.getByLabel('课题', { exact: true }).fill('滚动修复直接回归');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('已保存');
    await page.getByRole('button', { name: '添加环节', exact: true }).click();
    await page.getByLabel('环节名称 1').fill('未保存环节');
    await page.locator('[data-section-id]').getByRole('button', { name: '制作数学作品', exact: true }).click();
    await showTools(page);
    await clickTool(page, page.getByRole('button', { name: '新建公式', exact: true }).last());
    await closeTools(page);
    await page.getByLabel('作品名称').fill('带回公式');
    await page.getByLabel('LaTeX', { exact: true }).fill('a^2+b^2=c^2');
    await save(page);
    await page.getByRole('button', { name: '带回备课', exact: true }).click();
    await expect(page.locator('[data-reference-id]')).toHaveCount(1);
    await expect(page.getByRole('status').first()).toContainText('已保存');
    await expect(page.getByLabel('环节名称 1')).toHaveValue('未保存环节');
    await page.reload();
    await expect(page.locator('[data-reference-id]')).toContainText('带回公式');
    await page.screenshot({ path: path.join(evidence, 'lesson-return.png') });
  } finally {
    await context.close();
    await world.close();
  }
});
