// C27 browser entry: retained SQLite, real Cookie auth, fake mail, no model calls unless configured.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { createApp } from '../../../src/app.js';
import { generateSelfSignedCertificate } from '../auth-contract/harness.js';
const directory=path.resolve(process.argv[2]??'test-results/c26-review');
const port=Number(process.argv[3]??44626);
fs.mkdirSync(directory,{recursive:true});
const origin=`https://localhost:${port}`;
const context=createApp({env:{nodeEnv:'test',port,sqlitePath:path.join(directory,'workspace.sqlite'),authCodeSecret:'isolated-c26-test-secret',workbench:{publicOrigin:origin,webDist:path.resolve('apps/web/dist')}},sendCode:async()=>{throw Error('External mail disabled in C26 review entry');}});
await context.workbench.initialize();
const server=https.createServer(generateSelfSignedCertificate(directory),context.app);
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
console.log(JSON.stringify({origin,directory,identity:'real-api/fake-mail',models:context.workbench.agent.runtime.configured?'configured':'unconfigured'}));
process.once('SIGTERM',()=>{server.closeAllConnections();server.close(()=>{context.workbench.close();process.exit(0);});});
