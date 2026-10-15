import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

/**
 * Startup path for a real process.
 *
 * Module discovery and pending migrations run before the socket opens, so a
 * catalog/dependency/migration failure stops startup instead of serving a
 * half-prepared database. The same origin serves the API and, when configured,
 * the built Web assets; HTTPS is used whenever a certificate is configured.
 */
export function createHttpServer(context) {
  const tls = context.env.workbench?.tls;
  if (tls?.cert && tls?.key) {
    return https.createServer(
      { cert: fs.readFileSync(tls.cert), key: fs.readFileSync(tls.key) },
      context.app
    );
  }
  if (context.env.nodeEnv !== 'test' || context.env.workbench.mode !== 'test-principal') {
    throw new Error('WORKBENCH_TLS_CERT and WORKBENCH_TLS_KEY are required for the same-origin HTTPS server.');
  }
  return http.createServer(context.app);
}

export async function startServer(options = {}) {
  let vite;
  let context;
  try {
    context = createApp({
      ...options,
      ...(options.dev ? { webMiddleware: (req, res, next) => vite.middlewares(req, res, next) } : {})
    });
  } catch (error) {
    await error.cleanup;
    throw error;
  }

  let server;
  try {
    await context.workbench.initialize();
    await context.authModule?.resumePendingDeletions();
    server = createHttpServer(context);
    if (options.dev) {
      const { createServer } = await import('vite');
      vite = await createServer({
        root: fileURLToPath(new URL('../../web/', import.meta.url)),
        // Native JS config avoids temporary bundles triggering Node's watcher.
        configLoader: 'native',
        server: { middlewareMode: true, ws: { server } }
      });
    }
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(context.env.port, resolve);
    });
  } catch (error) {
    await vite?.close();
    server?.close();
    await context.close();
    throw error;
  }

  const scheme = context.env.workbench?.tls ? 'https' : 'http';
  const origin = `${scheme}://localhost:${server.address().port}`;
  console.log(`${context.env.appName} running on ${origin}`);

  let closing;
  function close() {
    closing ??= (async () => {
      // Close HMR sockets before waiting for HTTPS to drain during watch restarts.
      await vite?.close();
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      });
      await context.close();
    })();
    closing.catch(() => { closing = undefined; });
    return closing;
  }

  return { ...context, server, origin, close };
}

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  startServer({ dev: process.argv.includes('--dev') }).then(context => {
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      context.close().catch(error => {
        fs.writeSync(2, `[shutdown] ${error?.stack ?? error}\n`);
        process.exitCode = 1;
      });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }).catch((error) => {
    // Write synchronously so the failure reason survives process.exit.
    fs.writeSync(2, `[startup] ${error?.stack ?? error?.message ?? String(error)}\n`);
    process.exit(1);
  });
}
