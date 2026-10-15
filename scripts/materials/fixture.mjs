import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer } from 'node:http';
import { createApp } from '../../apps/api/src/app.js';
import {
  createGuards,
  asyncHandler,
  createMutationHandler,
  createWorkbenchErrorHandler
} from '../../apps/api/src/workbench/http.js';

export async function startFixture({ dataDir, port = 47331, webDist, reset = false, jobHandlers, conversion } = {}) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Materials fixture is not a production entry');
  if (!dataDir) throw new Error('Explicit isolated dataDir required');
  dataDir = path.resolve(dataDir);
  const marker = path.join(dataDir, '.r31-fixture');
  if (reset && fs.existsSync(dataDir)) {
    if (!fs.existsSync(marker))
      throw new Error('Refusing reset of a directory not owned by R31 fixture');
    fs.rmSync(dataDir, { recursive: true });
  }
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(marker, 'R31-FOUNDATION@1\n');
  const origin = `http://localhost:${port}`;
  const context = createApp({
    env: {
      nodeEnv: 'test',
      sqlitePath: path.join(dataDir, 'workbench.sqlite'),
      workbench: {
        jobHandlers, conversion,
        mode: 'test-principal',
        testPrincipals: ['r31-a', 'r31-b'],
        sessionSecret: 'isolated-r31-fixture',
        trustedOrigins: [origin],
        filesDir: path.join(dataDir, 'files'),
        logDir: path.join(dataDir, 'logs')
      }
    }
  });
  await context.workbench.initialize();
  const { db, identity, mutations, content } = context.workbench;
  // This table and save route exist exclusively in this executable test fixture.
  db.exec(
    'CREATE TABLE IF NOT EXISTS fixture_documents (accountKey TEXT PRIMARY KEY, value TEXT NOT NULL)'
  );
  const app = express();
  const guards = createGuards({ identity, trustedOrigins: [origin] });
  app.get('/fixture/session', (req, res) => {
    res.set('Set-Cookie', identity.testPrincipalCookie('r31-a').header);
    res.redirect('/');
  });
  app.use('/fixture/document', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/fixture/document', guards.identityGuard, (req, res) => {
    const row = db
      .prepare('SELECT value FROM fixture_documents WHERE accountKey=?')
      .get(req.workbenchPrincipal.accountKey);
    res.json(
      row
        ? JSON.parse(row.value)
        : {
            version: 2,
            blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '已知原稿' }] }]
          }
    );
  });
  app.put(
    '/fixture/document',
    guards.originGuard,
    guards.protectionGuard,
    guards.identityGuard,
    express.json({ limit: '2mb' }),
    createMutationHandler({
      mutations,
      method: 'PUT',
      validate: (value) => value,
      write: ({ principal, body }) => {
        content.validate(principal, body);
        db.prepare(
          'INSERT INTO fixture_documents VALUES (?, ?) ON CONFLICT(accountKey) DO UPDATE SET value=excluded.value'
        ).run(principal.accountKey, JSON.stringify(body));
        return { status: 200, body };
      }
    })
  );
  app.use('/fixture', createWorkbenchErrorHandler());
  app.use(context.app);
  // createApp ends in its 404 handler, so serve the review page before it.
  if (webDist) {
    const staticApp = express();
    staticApp.use(express.static(path.resolve(webDist)));
    staticApp.use(app);
    return listen(staticApp);
  }
  return listen(app);
  async function listen(application) {
    const server = createServer(application);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, 'localhost', resolve);
    });
    return {
      ...context,
      server,
      origin,
      close: async () => {
        await new Promise((resolve) => server.close(resolve));
        await context.close();
      }
    };
  }
}
