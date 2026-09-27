import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const root = fileURLToPath(new URL('../../', import.meta.url));
function buildRecord() {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  let record = { version: JSON.parse(readFileSync(new URL('../../package.json', import.meta.url))).version,
    commit: 'unknown', tag: '', dirty: false, changes: [] };
  try {
    record.commit = git('rev-parse', 'HEAD');
    record.tag = git('tag', '--points-at', 'HEAD');
    record.dirty = Boolean(git('status', '--porcelain', '--', 'apps', 'packages', 'package.json', 'package-lock.json'));
    record.changes = git('log', '-16', '--format=%H%x09%cI%x09%s', '--', 'apps', 'packages').split('\n').filter(Boolean).map(line => {
      const [sha, date, title] = line.split('\t'); return { sha, date, title };
    });
  } catch { /* Source archives can build without Git metadata. */ }
  return { name: 'teachbuddy-build-record', resolveId(id) { if (id === 'virtual:teachbuddy-build') return '\0' + id; },
    load(id) { if (id === '\0virtual:teachbuddy-build') return 'export default ' + JSON.stringify(record); } };
}

export default defineConfig({
  plugins: [react(), buildRecord(), viteStaticCopy({
    targets: ['cmaps', 'standard_fonts'].map(directory => ({
      src: fileURLToPath(new URL(`../../node_modules/pdfjs-dist/${directory}/*`, import.meta.url)),
      dest: `resources-pdf/${directory}`,
      rename: { stripBase: true },
    })),
  })],
  server: {
    port: 5173
  }
});
