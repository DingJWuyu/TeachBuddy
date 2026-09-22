import fs from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const fontfile = require.resolve('@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff');
export async function registerAndReadFont() {
  // Register the pinned font with fontconfig for librsvg as well as embedding
  // it in standalone SVG. Host-installed Chinese fonts are not required.
  await sharp({ text: { text: '数学', font: 'Noto Sans SC 16', fontfile, rgba: true } }).png().toBuffer();
  return fs.readFileSync(fontfile).toString('base64');
}
