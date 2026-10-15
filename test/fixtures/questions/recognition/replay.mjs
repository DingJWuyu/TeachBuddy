import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const pageNames = ['I-1', 'I-2', 'I-3', 'PS-4'];
export const sourceImage = page => fs.readFileSync(new URL(`${page}/page.png`, import.meta.url));
const digest = async bytes => createHash('sha256').update(await sharp(bytes).removeAlpha().raw().toBuffer()).digest('hex');

// Actual captured model output, gated by exact decoded input pixels. These
// tests verify the consumer and persistence, never model accuracy or latency.
export async function replayRecognizer({ beforePage = async () => {} } = {}) {
  const pages = new Map();
  for (const name of pageNames) {
    const at = file => new URL(`${name}/${file}`, import.meta.url);
    const raw = JSON.parse(fs.readFileSync(at('raw.json')));
    const derivations = JSON.parse(fs.readFileSync(at('derivations.json')));
    pages.set(await digest(sourceImage(name)), { name, result: {
      raw, markdown: fs.readFileSync(at('page.md'), 'utf8'),
      width: raw.width, height: raw.height, derivations,
      assets: derivations.map(d => ({name: d.name, bytes: fs.readFileSync(at(`derived/${d.name.replace(/\.[^.]+$/, '.png')}`))})),
      originalAssets: derivations.map(d => ({name: d.name, bytes: fs.readFileSync(at(`originals/${d.name}`))})),
    }});
  }
  const calls = [];
  return { revision: 'real-raw-replay-1', calls, async run({bytes, signal}) {
    signal.throwIfAborted();
    const page = pages.get(await digest(bytes));
    if (!page) throw new Error('Replay input differs from captured source pixels');
    calls.push(page.name);
    await beforePage(page.name, signal);
    signal.throwIfAborted();
    return structuredClone(page.result);
  }};
}
