/**
 * Fixed T52 samples from the contract cases. IDs match the machine samples in
 * docs/contracts/teaching-time-cases.md so a failure can be replayed verbatim.
 */
export const SAMPLE_IDS = Object.freeze({
  classOne: '10000000-0000-4000-8000-000000000001',
  classTwo: '10000000-0000-4000-8000-000000000002',
  questionOne: '20000000-0000-4000-8000-000000000002',
  recordOne: '30000000-0000-4000-8000-000000000001',
  entryOne: '40000000-0000-4000-8000-000000000001',
  itemOne: '50000000-0000-4000-8000-000000000001',
  itemTwo: '50000000-0000-4000-8000-000000000002'
});

export function emptyCourse(overrides = {}) {
  return { classId: null, recordIds: [], ...overrides };
}

export function unscheduledEntry(overrides = {}) {
  return {
    title: '',
    items: [{ id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' }],
    time: null,
    repeat: null,
    course: emptyCourse(),
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
    course: emptyCourse(),
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
    course: emptyCourse(),
    reminder: null,
    ...overrides
  };
}
