import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1664, height: 2500 } });
  for (let i = 0; i < 3; i++) {
    const source = path.join(out, 'green', `long-${i}.png`);
    await page.setContent(`<body style="margin:32px;background:white"><img src="data:image/png;base64,${fs.readFileSync(source).toString('base64')}"/></body>`);
    await page.locator('img').evaluate(img => img.decode());
    await page.screenshot({ path: path.join(out, 'green', `long-${i}-white-view.png`), fullPage: true });
  }
} finally { await browser.close(); }
