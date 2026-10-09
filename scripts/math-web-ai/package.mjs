import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
// Explicit distributable list excludes test fixtures and local task artifacts.
const files = ['manifest.json', 'background.js', 'workbench.js', 'deepseek.js', 'INSTALL.txt'];
export async function packageMathWebAiExtension(publicDir = join(repo, 'apps/web/public')) {
  const zip = new JSZip();
  const date = new Date('1980-01-01T00:00:00Z');
  for (const file of files) {
    const content = await readFile(join(repo, 'extensions/math-web-ai', file));
    zip.file(`teachbuddy-math-web-ai/${file}`, content, { date, createFolders: false });
  }
  const output = resolve(publicDir, 'downloads');
  await mkdir(output, { recursive: true });
  const destination = join(output, 'teachbuddy-math-web-ai.zip');
  await writeFile(destination, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE',
    compressionOptions: { level: 9 }, platform: 'UNIX' }));
  return destination;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`数学 AI 扩展安装包：${await packageMathWebAiExtension(process.argv[2])}`);
}
