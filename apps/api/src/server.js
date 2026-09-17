import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

export function startServer(options = {}) {
  const context = createApp(options);
  const server = context.app.listen(context.env.port, () => {
    console.log(`${context.env.appName} running on http://localhost:${context.env.port}`);
  });
  return { ...context, server };
}

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  startServer();
}
