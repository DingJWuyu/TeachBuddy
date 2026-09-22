/**
 * Playwright webServer entry for the isolated first-flow HTTPS runner.
 *
 * Started by playwright.config.mjs when FIRST_FLOW_E2E=1. It serves the built
 * Web assets and the API from one HTTPS origin with two runner-bound test
 * identities. The web build must exist (npm run build:web with
 * VITE_API_BASE_URL=/api); the runner refuses to start otherwise.
 *
 * Env:
 *   FIRST_FLOW_DATA_DIR  isolated data directory (default test-results/first-flow/e2e-data)
 *   FIRST_FLOW_RESET     "0" keeps the previous database (default resets)
 */
import {
  parseArgs,
  runnerSummary,
  startFirstFlowRunner
} from './lib/runner.mjs';

const dataDir = process.env.FIRST_FLOW_DATA_DIR ?? 'test-results/first-flow/e2e-data';

const runner = await startFirstFlowRunner({
  ...parseArgs(['--data-dir', dataDir, '--port', String(process.env.FIRST_FLOW_PORT ?? 47112)]),
  reset: process.env.FIRST_FLOW_RESET !== '0'
});

console.log(runnerSummary(runner, dataDir));

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await runner.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
