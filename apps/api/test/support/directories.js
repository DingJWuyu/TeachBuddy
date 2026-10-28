import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../test-results/runtime/', import.meta.url));

// Keep failed application data inside the existing CI diagnostics artifact.
// Each caller still owns closing and removing its successful test directory.
export function createTestDirectory(prefix) {
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, prefix));
}
