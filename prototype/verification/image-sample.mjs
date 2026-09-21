// Reports the dominant colours inside a region of a PNG, decoded in a headless
// browser canvas. Useful for reading an element's effective background without
// guessing from a single pixel.
//
//   node image-sample.mjs <a.png> <x> <y> <w> <h> [topN]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [pngPath, x, y, w, h, topN = '6'] = process.argv.slice(2);
if (!pngPath) {
  console.error('usage: node image-sample.mjs <a.png> <x> <y> <w> <h> [topN]');
  process.exit(2);
}

const dataUrl = `data:image/png;base64,${readFileSync(resolve(pngPath)).toString('base64')}`;
const browser = await chromium.launch();
const page = await browser.newPage();

const result = await page.evaluate(async ({ src, region, topN }) => {
  const img = await new Promise((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error('decode failed'));
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(region.x, region.y, region.w, region.h).data;

  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = data.length / 4;
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([rgb, n]) => ({ rgb, hex: '#' + rgb.split(',').map((v) => (+v).toString(16).padStart(2, '0')).join(''), percent: +((n / total) * 100).toFixed(1) }));
  return { imageSize: { w: img.width, h: img.height }, region, sampledPixels: total, top };
}, { src: dataUrl, region: { x: +x, y: +y, w: +w, h: +h }, topN: +topN });

console.log(JSON.stringify(result, null, 2));
await browser.close();
