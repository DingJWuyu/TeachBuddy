import os from 'node:os';
import path from 'node:path';
import base from '../../../../../apps/web/e2e/manual-data/manual-data.config.mjs';

export default {
  ...base,
  testDir: '.',
  testMatch: 'recovery-existing.spec.mjs',
  outputDir: path.join(os.tmpdir(), 'recovery-existing-results'),
};
