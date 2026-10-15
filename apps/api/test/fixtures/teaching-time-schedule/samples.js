/**
 * Fixed schedule samples; behavior cases are in docs/acceptance/schedule-cases.md.
 * Machine exchange samples live in test/fixtures/contracts/schedule-v1-samples.json.
 */
export const SAMPLE_IDS = Object.freeze({
  questionOne: '20000000-0000-4000-8000-000000000002',
  entryOne: '40000000-0000-4000-8000-000000000001',
  itemOne: '50000000-0000-4000-8000-000000000001',
  itemTwo: '50000000-0000-4000-8000-000000000002'
});

export function unscheduledEntry(overrides = {}) {
  return {
    title: '',
    items: [{ id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' }],
    time: null,
    repeat: null,
    reminder: null,
    ...overrides
  };
}

export function timedEntry(overrides = {}) {
  return {
    title: '备课',
    items: [{ id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' }],
    time: { date: '2026-09-21', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 90 },
    repeat: null,
    reminder: null,
    ...overrides
  };
}

export function weeklyEntry(overrides = {}) {
  return timedEntry({
    repeat: { until: '2026-10-05' },
    ...overrides
  });
}

export function overrideContent(overrides = {}) {
  return {
    title: '备课',
    items: [{ id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' }],
    time: { date: '2026-09-29', startTime: '16:00', timeZone: 'Asia/Shanghai', durationMinutes: 90 },
    reminder: null,
    ...overrides
  };
}
