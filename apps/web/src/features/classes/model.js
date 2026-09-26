/**
 * Classes feature model: record input shapes, display projections and the
 * account-today default.
 *
 * The business date is never the browser's local date: the T52 account timezone
 * defaults to Asia/Shanghai until the settings page is joined, so the quick
 * record form defaults to that calendar day.
 */

export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';

export function todayInZone(timeZone = DEFAULT_TIME_ZONE) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (error) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }
}

export function emptyRecordInput(classId, recordedOn) {
  return {
    classId,
    recordedOn,
    note: '',
    position: '',
    unfinished: '',
    commonIssues: '',
    nextNote: '',
    sources: []
  };
}

/** Editable input derived from a stored record; links keep their display data. */
export function recordInputFromRecord(record) {
  return {
    classId: record.classId,
    recordedOn: record.recordedOn,
    note: record.note,
    position: record.position,
    unfinished: record.unfinished,
    commonIssues: record.commonIssues,
    nextNote: record.nextNote,
    sources: (record.sources || []).map((source) => ({
      kind: source.kind,
      id: source.id,
      label: source.currentLabel,
      savedLabel: source.labelAtLink,
      unavailable: source.unavailable,
      deleted: source.deleted
    }))
  };
}

export function recordUpdatePayload(input, baseline) {
  return {
    expectedVersion: baseline.version,
    classId: baseline.classId,
    recordedOn: input.recordedOn,
    note: input.note,
    position: input.position,
    unfinished: input.unfinished,
    commonIssues: input.commonIssues,
    nextNote: input.nextNote,
    sources: input.sources.map((source) => ({ kind: source.kind, id: source.id }))
  };
}

export function recordCreatePayload(input) {
  return {
    classId: input.classId,
    recordedOn: input.recordedOn,
    note: input.note,
    position: input.position,
    unfinished: input.unfinished,
    commonIssues: input.commonIssues,
    nextNote: input.nextNote,
    sources: input.sources.map((source) => ({ kind: source.kind, id: source.id }))
  };
}

export function hasAnyRecordText(input) {
  return [input.note, input.position, input.unfinished, input.commonIssues, input.nextNote]
    .some((value) => String(value ?? '').trim() !== '');
}

/** The excerpt shown for one record: its text, or the first non-empty field. */
export function recordExcerpt(record) {
  const candidates = [record.note, record.position, record.unfinished, record.commonIssues, record.nextNote];
  for (const candidate of candidates) {
    const text = String(candidate ?? '').trim();
    if (text !== '') return text;
  }
  return '';
}

/**
 * The class's actual position: the first active record with a position, or the
 * most recent record's excerpt when none has one. Records arrive in list order.
 */
export function latestPosition(records) {
  for (const record of records) {
    const position = String(record.position ?? '').trim();
    if (position !== '') return { kind: 'position', text: position, record };
  }
  if (records.length > 0) return { kind: 'excerpt', text: recordExcerpt(records[0]), record: records[0] };
  return null;
}

export function formatRecordedOn(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return String(value ?? '');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

export function sourceKindLabel(kind) {
  return { question: '题目', lesson: '备课', math: '作品' }[kind];
}

export function sourceFallbackLabel(kind) {
  return { question: '未命名题目', lesson: '未命名备课', math: '未命名作品' }[kind];
}

/**
 * A source item arrives in two shapes: the stored record projection
 * (`labelAtLink`/`currentLabel`) and the editor input built from it
 * (`savedLabel`/`label`). A stored title may legitimately be empty (a question
 * saved without a title), so display always falls back to the kind's name.
 */
export function sourceLabel(source) {
  const label = source.label ?? source.currentLabel;
  const text = String(label ?? '').trim();
  return text === '' ? sourceFallbackLabel(source.kind) : text;
}

export function sourceSavedLabel(source) {
  return source.savedLabel ?? source.labelAtLink ?? null;
}

/** `记录时：…` is only shown when a non-empty stored title differs from now. */
export function sourceHistoryHint(source) {
  if (!source || source.deleted) return null;
  const saved = sourceSavedLabel(source);
  if (!saved) return null;
  const label = sourceLabel(source);
  if (saved === label) return null;
  return `记录时：${saved}`;
}

/** Product path of a source, so a saved link can be opened from the record. */
export function sourcePath(kind, id) {
  if (kind === 'math') return `/math?workId=${encodeURIComponent(id)}`;
  return kind === 'question' ? `/questions/${id}` : `/lessons/${id}`;
}
