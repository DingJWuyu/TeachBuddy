// Pixel comparison for two PNG captures, decoded in a headless browser canvas.
//
//   node pixel-diff.mjs <a.png> <b.png> [x y w h]
//
// Both images must share the same dimensions. The optional region is in pixels
// of the captured image. Prints the number of differing pixels, the largest
// per-channel delta, and the bounding box of the differences.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [aPath, bPath, rx, ry, rw, rh] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error('usage: node pixel-diff.mjs <a.png> <b.png> [x y w h]');
  process.exit(2);
}

const toDataUrl = (p) => `data:image/png;base64,${readFileSync(resolve(p)).toString('base64')}`;
const region = rx !== undefined ? { x: +rx, y: +ry, w: +rw, h: +rh } : null;

const browser = await chromium.launch();
const page = await browser.newPage();

const result = await page.evaluate(async ({ a, b, region }) => {
  const load = (src) => new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(`decode failed: ${src.slice(0, 40)}`));
    img.src = src;
  });
  const [imgA, imgB] = await Promise.all([load(a), load(b)]);
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    return { error: `size mismatch: ${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}` };
  }
  const w = imgA.width, h = imgA.height;
  const ctx = (img) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    return cx.getImageData(0, 0, w, h).data;
  };
  const dataA = ctx(imgA), dataB = ctx(imgB);

  const x0 = region ? region.x : 0;
  const y0 = region ? region.y : 0;
  const x1 = region ? Math.min(w, region.x + region.w) : w;
  const y1 = region ? Math.min(h, region.y + region.h) : h;

  let differing = 0, maxDelta = 0, totalDelta = 0;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const sample = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      const d = Math.max(
        Math.abs(dataA[i] - dataB[i]),
        Math.abs(dataA[i + 1] - dataB[i + 1]),
        Math.abs(dataA[i + 2] - dataB[i + 2]),
        Math.abs(dataA[i + 3] - dataB[i + 3])
      );
      if (d > 0) {
        differing++;
        totalDelta += d;
        if (d > maxDelta) maxDelta = d;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (sample.length < 5) {
          sample.push({
            x, y,
            a: [dataA[i], dataA[i + 1], dataA[i + 2]],
            b: [dataB[i], dataB[i + 1], dataB[i + 2]]
          });
        }
      }
    }
  }
  const area = (x1 - x0) * (y1 - y0);
  return {
    imageSize: { w, h },
    region: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    differingPixels: differing,
    differingPercent: +((differing / area) * 100).toFixed(3),
    maxChannelDelta: maxDelta,
    meanDeltaOnDiff: differing ? +(totalDelta / differing).toFixed(2) : 0,
    diffBounds: differing ? { x: minX, y: minY, right: maxX, bottom: maxY } : null,
    samples: sample
  };
}, { a: toDataUrl(aPath), b: toDataUrl(bPath), region });

console.log(JSON.stringify(result, null, 2));
await browser.close();
