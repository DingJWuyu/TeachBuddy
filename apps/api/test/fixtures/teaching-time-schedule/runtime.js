/**
 * T52 fixture runtime.
 *
 * The schedule module takes `clock` and `beforeChange` from the composition
 * root, which T53 owns. This fixture injects a controllable server clock and a
 * recording `beforeChange` so the isolated T52 suites can observe the settlement
 * order, replay behaviour and rollback without touching production wiring.
 */
import { contractError, problems } from '../../../src/workbench/problems.js';

export const FIXTURE_START = '2026-09-21T06:00:00Z';

const state = {
  nowMs: Date.parse(FIXTURE_START),
  beforeChangeCalls: [],
  failBeforeChange: false
};

export function resetFixtureRuntime({ now = FIXTURE_START } = {}) {
  state.nowMs = typeof now === 'number' ? now : Date.parse(now);
  state.beforeChangeCalls = [];
  state.failBeforeChange = false;
}

export function setFixtureNow(instant) {
  state.nowMs = instant instanceof Date ? instant.getTime() : Date.parse(String(instant));
}

export function advanceFixtureNow(minutes) {
  state.nowMs += minutes * 60_000;
}

export function fixtureNowIso() {
  return new Date(state.nowMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export const fixtureClock = {
  now() {
    return new Date(state.nowMs);
  }
};

export function failNextBeforeChange() {
  state.failBeforeChange = true;
}

export function beforeChangeCalls() {
  return state.beforeChangeCalls.map((call) => ({ ...call }));
}

export function clearBeforeChangeCalls() {
  state.beforeChangeCalls = [];
}

export function fixtureBeforeChange(principal, now) {
  state.beforeChangeCalls.push({ accountKey: principal.accountKey, now });
  if (state.failBeforeChange) {
    state.failBeforeChange = false;
    throw contractError(problems.temporarilyUnavailable());
  }
}
