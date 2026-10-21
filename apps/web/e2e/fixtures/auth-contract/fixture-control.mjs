/*
 * Test-side control for the account-contract substitute: lifecycle, state
 * inspection, fault injection and fake-mail reading. Every helper talks to the
 * fixture process over HTTP; nothing reaches into the server's memory.
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'substitute-server.mjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function healthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/__fixture/health`);
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.ok === true;
  } catch {
    return false;
  }
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
  const child = spawn(process.execPath, [SERVER, '--port', String(port)], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 1200; attempt += 1) {
    if (await healthy(port)) break;
    if (child.exitCode !== null || child.signalCode !== null) break;
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
      if (child.exitCode !== null || child.signalCode !== null) return;
      const stopped = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await stopped;
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
    if (child.exitCode !== null || child.signalCode !== null) break;
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
      if (child.exitCode !== null || child.signalCode !== null) return;
      const stopped = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await stopped;
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
