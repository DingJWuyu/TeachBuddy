import { expect } from '@playwright/test';

// Wheel only: inspection never scrolls or focuses the target for the user.
export async function wheelTo(page, target) {
  const panel = page.locator('.math-tools-panel');
  await expect(target).toBeVisible();
  for (let i = 0; i < 45; i++) {
    const [box, area] = await Promise.all([target.boundingBox(), panel.boundingBox()]);
    if (box.y >= area.y + 3 && box.y + box.height <= area.y + area.height - 3) {
      await expect(target).toBeInViewport({ ratio: 1 });
      return;
    }
    const before = await panel.evaluate(e => e.scrollTop);
    await page.mouse.move(area.x + area.width - 20, area.y + area.height / 2);
    await page.mouse.wheel(0, box.y < area.y ? -240 : 240);
    await expect.poll(() => panel.evaluate(e => e.scrollTop)).not.toBe(before);
  }
  throw new Error('Control is unreachable by ordinary wheel');
}

export async function clickTool(page, target) {
  await wheelTo(page, target);
  await target.click();
}

export async function fillTool(page, name, value) {
  const input = page.getByLabel(name, { exact: true });
  await clickTool(page, input);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(value);
}

export async function openSection(page, name) {
  const summary = page.locator('.math-tools-panel summary').filter({ hasText: new RegExp(`^${name}$`) });
  await wheelTo(page, summary);
  if (!await summary.evaluate(e => e.parentElement.open)) await summary.click();
  return summary;
}

export async function showTools(page) {
  if (!await page.locator('.math-tools-panel').count()) {
    if (await page.getByRole('tab', { name: '作品与工具', exact: true }).count()) {
      await page.getByRole('tab', { name: '作品与工具', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '作品与工具', exact: true }).click();
    }
  }
}

export async function closeTools(page) {
  await page.locator('.wb-aux').getByRole('button', { name: '关闭辅助栏', exact: true }).click();
}

export async function layout(page) {
  return page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    window: [scrollX, scrollY],
    regions: [...document.querySelectorAll('.wb-main,.wb-sidebar,.wb-aux-body,.math-canvas,.math-tools-panel')].map(e => ({
      name: e.className, top: e.scrollTop, left: e.scrollLeft,
      height: e.clientHeight, contentHeight: e.scrollHeight,
      width: e.clientWidth, contentWidth: e.scrollWidth,
      overflowY: getComputedStyle(e).overflowY,
      rect: e.getBoundingClientRect().toJSON(),
    })),
  }));
}
