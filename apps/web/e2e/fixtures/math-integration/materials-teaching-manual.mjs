import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from '../math-static/real.mjs';
import { http, seedRich, seedLegacy, C, R, record } from '../../../../api/test/teaching-time-classes-materials-fixture.js';

if (!process.env.MTA_DATA_DIR) throw new Error('Set MTA_DATA_DIR to your own isolated data directory.');
const directory = path.resolve(process.env.MTA_DATA_DIR);
fs.mkdirSync(directory, { recursive: true });
const world = await createIntegration({ directory });
const email = 'mta@example.test';
try {
  if (!world.workbench.db.prepare('SELECT id FROM auth_accounts WHERE email=?').get(email)) {
    const { client } = await registerMath(world, email);
    const call = http(client);
    const { rich } = await seedRich(client);
    const { lesson, math } = await seedLegacy(client);
    for (const [name, note] of [['高一一班', '零点需要再练'], ['高一二班', '配方法需要补讲']]) {
      const classroom = await call('POST', C, { name }, 201);
      await call('POST', R, record(classroom.id, [
        { kind: 'question', id: rich.id }, { kind: 'lesson', id: lesson.id }, { kind: 'math', id: math.id }
      ], note), 201);
    }
  }
  console.log(`${world.origin}\nreal-auth / fake-mail / fixed text import, no model provider\n${email} / math-password\n${directory}`);
} catch (error) {
  await world.close();
  throw error;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  await world.close();
  process.exit(0);
});
