import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Outputs belong to this run. Selected design inputs are maintained separately.
export function evidencePaths(suite) {
  const parent = process.env.PROTOTYPE_TEMP_DIR || tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = process.env.PROTOTYPE_EVIDENCE_DIR && process.env.PROTOTYPE_RESULTS_DIR
    ? null : mkdtempSync(path.join(parent, `${suite}-`));
  const screenshots = path.resolve(process.env.PROTOTYPE_EVIDENCE_DIR || path.join(root, 'screenshots'));
  const results = path.resolve(process.env.PROTOTYPE_RESULTS_DIR || path.join(root, 'results'));
  mkdirSync(screenshots, { recursive: true });
  mkdirSync(results, { recursive: true });
  console.error(`Staged screenshots: ${screenshots}\nStaged results: ${results}`);
  return { screenshots, results };
}
