import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
const root = path.resolve(process.argv[2]);
const output = path.join(root, 'pages');
fs.mkdirSync(output, { recursive: true });
const summary = [];
for (const name of fs.readdirSync(path.join(root, 'http')).filter(n => n.endsWith('.pdf'))) {
  const stem = name.slice(0, -4);
  const pdf = path.join(root, 'http', name);
  execFileSync('pdftoppm', ['-scale-to', '1000', '-png', pdf, path.join(output, stem)]);
  const pages = fs.readdirSync(output).filter(n => n.startsWith(stem + '-') && !n.includes('overview'));
  const tiles = [];
  for (const [i, page] of pages.entries()) {
    const input = await sharp(path.join(output, page)).resize({ width: 450 }).toBuffer();
    tiles.push({ input, top: Math.floor(i / 2) * 650, left: (i % 2) * 460 });
  }
  await sharp({ create: { width: 920, height: Math.ceil(pages.length / 2) * 650, channels: 3, background: '#ccc' } })
    .composite(tiles).png().toFile(path.join(output, `${stem}-overview.png`));
  summary.push({ name, pages: pages.length });
}
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
