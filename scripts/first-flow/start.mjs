/**
 * Start the isolated first-flow runner (real Web/API on one HTTPS origin).
 *
 *   node scripts/first-flow/start.mjs --reset
 *   node scripts/first-flow/start.mjs                 # restart, keeps the database
 */
import {
  parseArgs,
  runnerSummary,
  startFirstFlowRunner,
  usage
} from './lib/runner.mjs';

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  console.log(usage());
  process.exit(0);
}

let runner;
try {
  runner = await startFirstFlowRunner(options);
} catch (error) {
  console.error(`[first-flow] startup failed: ${error.message}`);
  process.exit(1);
}

console.log(runnerSummary(runner, options.dataDir));

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`[first-flow] ${signal} received, closing cleanly`);
  await runner.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
