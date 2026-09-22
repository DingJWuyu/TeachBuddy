/*
 * Test-side control for the account-contract substitute: lifecycle, state
 * inspection, fault injection and fake-mail reading. Every helper talks to the
 * fixture process over HTTP; nothing reaches into the server's memory.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildHarness, harnessBuilt } from './harness-build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'substitute-server.mjs');
const BUILD_LOCK = path.join(os.tmpdir(), 'auth-contract-harness-build.lock');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function healthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/__fixture/health`);
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.ok === true;
  } catch {
    return false;
  }
}

async function buildWithLock() {
  if (harnessBuilt()) return;
  let locked = false;
  try {
    const handle = fs.openSync(BUILD_LOCK, 'wx');
    fs.closeSync(handle);
    locked = true;
  } catch {
    locked = false;
  }
  if (locked) {
    try {
      await buildHarness({ force: true });
    } finally {
      fs.rmSync(BUILD_LOCK, { force: true });
    }
    return;
  }
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (harnessBuilt()) return;
    await sleep(100);
  }
  await buildHarness({ force: true });
}

/*
 * Returns a handle for the substitute on `port`. If one is already listening
 * (for example the Playwright webServer), it is reused; otherwise this helper
 * starts and later stops its own process.
 */
export async function ensureSubstitute({ port = 47182 } = {}) {
  if (await healthy(port)) {
    return { port, ownProcess: false, stop: async () => {} };
  }
  await buildWithLock();
  const child = spawn(process.execPath, [SERVER, '--port', String(port)], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await healthy(port)) break;
    await sleep(100);
  }
  if (!(await healthy(port))) {
    child.kill('SIGKILL');
    throw new Error(`auth-contract substitute did not start on port ${port}`);
  }
  return {
    port,
    ownProcess: true,
    stop: async () => {
      child.kill('SIGTERM');
      await sleep(100);
    },
  };
}

/*
 * Starts a page on another origin that posts to the substitute, so a real
 * browser supplies the cross-site Origin header.
 */
export async function ensureForeignOrigin({ port, target }) {
  if (await healthy(port)) {
    return { port, ownProcess: false, stop: async () => {} };
  }
  const child = spawn(process.execPath, [SERVER, '--port', String(port), '--foreign', target], {
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await healthy(port)) break;
    await sleep(100);
  }
  if (!(await healthy(port))) {
    child.kill('SIGKILL');
    throw new Error(`foreign-origin fixture did not start on port ${port}`);
  }
  return {
    port,
    ownProcess: true,
    stop: async () => {
      child.kill('SIGTERM');
      await sleep(100);
    },
  };
}

async function post(port, pathname, body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return response.json();
}

export const resetState = (port) => post(port, '/__fixture/reset');

export const seedAccount = (port, account) => post(port, '/__fixture/seed', account);

export const setConfig = (port, config) => post(port, '/__fixture/config', config);

export const armFault = (port, fault) => post(port, '/__fixture/faults', fault);

export const revokeAccount = (port, email) => fetch(
  `http://127.0.0.1:${port}/__fixture/revoke-account?email=${encodeURIComponent(email)}`,
).then((response) => response.json());

export const revokeSession = (port, sessionId) => fetch(
  `http://127.0.0.1:${port}/__fixture/revoke?session=${encodeURIComponent(sessionId)}`,
).then((response) => response.json());

export async function readState(port) {
  const response = await fetch(`http://127.0.0.1:${port}/__fixture/state`);
  return response.json();
}

export async function readRequests(port) {
  const response = await fetch(`http://127.0.0.1:${port}/__fixture/requests`);
  const payload = await response.json();
  return payload.requests;
}

export async function requestsFor(port, { method, path: pathname }) {
  const requests = await readRequests(port);
  return requests.filter((request) => (
    (!method || request.method === method) && (!pathname || request.path === pathname)
  ));
}

export async function latestMail(port, email) {
  const state = await readState(port);
  const messages = state.mail.filter((message) => message.email === email);
  return messages[messages.length - 1] || null;
}

export const clearFaults = (port) => post(port, '/__fixture/faults/clear');
