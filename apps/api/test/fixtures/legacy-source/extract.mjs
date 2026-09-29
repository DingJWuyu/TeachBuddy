import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

// Execute exact historical sources with their own workspace package and today's
// installed third-party dependencies. No Git objects or external checkout needed.
export function extractLegacySource(name, directory) {
  const manifest = JSON.parse(fs.readFileSync(new URL('./provenance.json', import.meta.url), 'utf8'));
  const fixture = manifest.fixtures[name];
  assert.ok(fixture, `Unknown legacy source: ${name}`);
  const packed = fs.readFileSync(new URL(fixture.archive, import.meta.url));
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest(packed), fixture.gzipSha256, `${name} compressed archive checksum`);
  const archive = gunzipSync(packed);
  assert.equal(digest(archive), fixture.tarSha256, `${name} source archive checksum`);
  fs.mkdirSync(directory, { recursive: true });
  execFileSync('tar', ['-x', '-C', directory], { input: archive });
  const installed = fileURLToPath(new URL('../../../../../node_modules/', import.meta.url));
  fs.mkdirSync(path.join(directory, 'node_modules/@refatos'), { recursive: true });
  for (const entry of fs.readdirSync(installed)) {
    if (entry !== '@refatos') fs.symlinkSync(path.join(installed, entry), path.join(directory, 'node_modules', entry));
  }
  fs.symlinkSync(path.join(directory, 'packages/shared'), path.join(directory, 'node_modules/@refatos/shared'), 'dir');
  return directory;
}
