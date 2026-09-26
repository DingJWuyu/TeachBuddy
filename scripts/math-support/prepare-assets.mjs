import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const mathAssetsDirectory = fileURLToPath(new URL('../../apps/web/public/vendor/math/', import.meta.url));

/** Copy the pinned distribution, including lazy loaders, fonts and licenses. */
export async function prepareMathAssets(destination = mathAssetsDirectory) {
  const mathjax = path.dirname(require.resolve('mathjax/package.json'));
  const font = path.dirname(require.resolve('@fontsource/noto-sans-sc/package.json'));
  const version = JSON.parse(await fs.readFile(path.join(mathjax, 'package.json'), 'utf8')).version;
  if (version !== '3.2.2') throw new Error(`Expected MathJax 3.2.2, got ${version}`);
  await fs.mkdir(destination, { recursive: true });
  await fs.cp(path.join(mathjax, 'es5'), path.join(destination, 'mathjax-3.2.2'), { recursive: true });
  await fs.copyFile(path.join(mathjax, 'LICENSE'), path.join(destination, 'mathjax-3.2.2', 'LICENSE'));
  const fontTarget = path.join(destination, 'noto-sans-sc');
  await fs.mkdir(path.join(fontTarget, 'files'), { recursive: true });
  await fs.copyFile(path.join(font, 'chinese-simplified-400.css'), path.join(fontTarget, '400.css'));
  for (const extension of ['woff', 'woff2']) {
    const name = `noto-sans-sc-chinese-simplified-400-normal.${extension}`;
    await fs.copyFile(path.join(font, 'files', name), path.join(fontTarget, 'files', name));
  }
  await fs.copyFile(path.join(font, 'LICENSE'), path.join(fontTarget, 'LICENSE'));
  const licenses = path.join(destination, 'licenses');
  await fs.mkdir(licenses, { recursive: true });
  await fs.copyFile(path.join(path.dirname(require.resolve('mathlive')), 'LICENSE.txt'), path.join(licenses, 'mathlive.txt'));
  await fs.copyFile(path.resolve(path.dirname(require.resolve('zundo')), '../LICENSE'), path.join(licenses, 'zundo.txt'));
  console.log(`Local MathJax ${version} and Noto Sans SC assets: ${destination}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareMathAssets();
}
