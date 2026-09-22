import path from 'node:path';
import { startFixture } from './fixture.mjs';
const args = process.argv.slice(2);
const value = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback);
const fixture = await startFixture({
  dataDir: value('--data-dir', 'test-results/r31-foundation/data'),
  port: Number(value('--port', '47331')),
  webDist: path.resolve('test-results/r31-foundation/web'),
  reset: args.includes('--reset')
});
console.log(`R31 fixture: ${fixture.origin}/fixture/session`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await fixture.close();
    process.exit(0);
  });
