import { invalidInput } from '../../workbench/problems.js';
import { validateIdPath } from '../../workbench/schema.js';
export const fail = (field, reason = 'out-of-range') => {
  throw invalidInput(field, reason);
};
export function object(value, fields, required = fields, p = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(p, 'invalid-type');
  }
  for (const key of Object.keys(value).sort()) {
    if (!fields.includes(key)) {
      fail(`${p}/${key}`, 'unknown-field');
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      fail(`${p}/${key}`, 'required');
    }
  }
  return value;
}
export function text(v, p, max, nonblank = false) {
  if (typeof v !== 'string') {
    fail(p, 'invalid-type');
  }
  if ([...v].length > max || nonblank && !v.trim()) {
    fail(p);
  }
  return v;
}
export function integer(v, p, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(v)) {
    fail(p, 'invalid-type');
  }
  if (v < min || v > max) {
    fail(p);
  }
  return v;
}
function date(v, p) {
  text(v, p, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v + 'T00:00:00Z')) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) {
    fail(p);
  }
  return v;
}
export function isScoreValue(value, positive = false) {
  return typeof value === 'number' && Number.isFinite(value) && value >= (positive ? 0.01 : 0) && value <= 100000 && value === Math.round(value * 100) / 100;
}
function score(v, p, positive = false) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    fail(p, 'invalid-type');
  }
  if (!isScoreValue(v, positive)) {
    fail(p);
  }
  return v;
}
export function array(v, p, max) {
  if (!Array.isArray(v)) {
    fail(p, 'invalid-type');
  }
  if (v.length > max) {
    fail(p);
  }
  return v;
}
export function id(v, p) {
  return validateIdPath(v, p);
}
export function enumValue(v, options, p) {
  if (!options.includes(v)) {
    fail(p);
  }
  return v;
}
const nullableText = (v, p, max) => v === null ? null : text(v, p, max);
function seating(v, p = '/seating') {
  object(v, ['rows', 'columns', 'seats'], undefined, p);
  integer(v.rows, p + '/rows', 1, 50);
  integer(v.columns, p + '/columns', 1, 50);
  array(v.seats, p + '/seats', 1000).forEach((s, i) => {
    const f = p + '/seats/' + i;
    object(s, ['row', 'column', 'studentId'], undefined, f);
    integer(s.row, f + '/row', 1, v.rows);
    integer(s.column, f + '/column', 1, v.columns);
    id(s.studentId, f + '/studentId');
  });
  return v;
}
function question(v, p) {
  object(v, ['id', 'label', 'groupLabel', 'maxScore', 'tagIds', 'locations'], ['label', 'groupLabel', 'maxScore', 'tagIds', 'locations'], p);
  if (v.id !== undefined) {
    id(v.id, p + '/id');
  }
  text(v.label, p + '/label', 80, true);
  nullableText(v.groupLabel, p + '/groupLabel', 80);
  score(v.maxScore, p + '/maxScore', true);
  array(v.tagIds, p + '/tagIds', 20).forEach((x, i) => id(x, p + '/tagIds/' + i));
  array(v.locations, p + '/locations', 20).forEach((l, i) => {
    const f = p + '/locations/' + i;
    object(l, ['fileId', 'renditionFileId', 'page', 'box'], undefined, f);
    id(l.fileId, f + '/fileId');
    id(l.renditionFileId, f + '/renditionFileId');
    integer(l.page, f + '/page');
    if (l.box !== null) {
      object(l.box, ['x', 'y', 'width', 'height'], undefined, f + '/box');
      for (const k of ['x', 'y', 'width', 'height']) {
        if (typeof l.box[k] !== 'number' || !Number.isFinite(l.box[k])) {
          fail(f + '/box/' + k, 'invalid-type');
        }
      }
      const b = l.box;
      if (b.x < 0 || b.y < 0 || b.x >= 1 || b.y >= 1 || b.width <= 0 || b.height <= 0 || b.x + b.width > 1 + 1e-10 || b.y + b.height > 1 + 1e-10) {
        fail(f + '/box');
      }
    }
  });
  return v;
}
export function mapping(v, p = '/mapping') {
  if (v === null) {
    return v;
  }
  object(v, ['sheetIndex', 'headerRow', 'firstDataRow', 'lastDataRow', 'nameColumn', 'studentNumberColumn', 'totalColumn', 'attendanceColumn', 'questionColumns', 'ignoredRows'], undefined, p);
  integer(v.sheetIndex, p + '/sheetIndex', 0, 19);
  for (const k of ['headerRow', 'firstDataRow', 'lastDataRow']) {
    integer(v[k], p + '/' + k, 1, 2000);
  }
  for (const k of ['nameColumn', 'totalColumn', 'studentNumberColumn', 'attendanceColumn']) {
    if (v[k] !== null) {
      integer(v[k], p + '/' + k, 1, 256);
    }
  }
  if (v.nameColumn === null && v.studentNumberColumn === null) {
    fail(p + '/nameColumn', 'required');
  }
  array(v.questionColumns, p + '/questionColumns', 300).forEach((x, i) => {
    object(x, ['column', 'questionId'], undefined, p + '/questionColumns/' + i);
    integer(x.column, p + '/questionColumns/' + i + '/column', 1, 256);
    id(x.questionId, p + '/questionColumns/' + i + '/questionId');
  });
  array(v.ignoredRows, p + '/ignoredRows', 1000).forEach((x, i) => integer(x, p + '/ignoredRows/' + i, 1, 2000));
  if (v.firstDataRow <= v.headerRow || v.lastDataRow < v.firstDataRow || v.lastDataRow - v.firstDataRow >= 1000) {
    fail(p);
  }
  return v;
}
export function rows(v, draft = false, p = '/rows') {
  return array(v, p, draft ? 1000 : undefined).map((r, i) => {
    const f = p + '/' + i;
    const fields = draft ? ['sourceRow', 'studentId', 'status', 'totalScore', 'scores', 'ignored'] : ['studentId', 'status', 'totalScore', 'scores'];
    object(r, fields, undefined, f);
    if (draft) {
      integer(r.sourceRow, f + '/sourceRow', 1, 2000);
      if (typeof r.ignored !== 'boolean') {
        fail(f + '/ignored', 'invalid-type');
      }
    }
    if (!draft || r.studentId !== null) {
      id(r.studentId, f + '/studentId');
    }
    enumValue(r.status, ['present', 'absent', 'unrecorded'], f + '/status');
    if (r.totalScore !== null) {
      score(r.totalScore, f + '/totalScore');
    }
    if (!r.scores || typeof r.scores !== 'object' || Array.isArray(r.scores)) {
      fail(f + '/scores', 'invalid-type');
    }
    for (const [qid, s] of Object.entries(r.scores)) {
      id(qid, f + '/scores/' + qid);
      if (s !== null) {
        score(s, f + '/scores/' + qid);
      }
    }
    return r;
  });
}
export function validateWrite(kind, action, body) {
  if (action === 'deletion') {
    object(body, ['baseVersion', 'deleted']);
    integer(body.baseVersion, '/baseVersion');
    if (typeof body.deleted !== 'boolean') {
      fail('/deleted', 'invalid-type');
    }
    return body;
  }
  if (action === 'confirmation') {
    object(body, ['baseVersion']);
    integer(body.baseVersion, '/baseVersion');
    return body;
  }
  if (action === 'merge') {
    object(body, ['baseVersion', 'targetId', 'targetVersion']);
    integer(body.baseVersion, '/baseVersion');
    integer(body.targetVersion, '/targetVersion');
    id(body.targetId, '/targetId');
    return body;
  }
  if (action === 'seating') {
    object(body, ['baseVersion', 'seating']);
    integer(body.baseVersion, '/baseVersion');
    seating(body.seating);
    return body;
  }
  const update = action === 'update';
  const fields = {
    classes: ['name', 'term', 'seating'],
    students: ['classId', 'name', 'studentNumber', 'birthday', 'interests', 'description'],
    records: ['scope', 'subjectId', 'occurredOn', 'text'],
    exams: ['name', 'subject', 'occurredOn', 'totalMax', 'source', 'questions'],
    tags: ['name'],
    imports: update ? ['mapping', 'rows'] : ['examId', 'classId', 'sourceFileId'],
    results: ['examVersion', 'rows']
  }[kind];
  let allowed = fields;
  if (update && kind === 'classes') {
    allowed = ['name', 'term'];
  }
  if (update && kind === 'records') {
    allowed = ['occurredOn', 'text'];
  }
  const required = kind === 'classes' && !update ? ['name'] : allowed;
  object(body, [...allowed, ...(update ? ['baseVersion'] : [])], [...required, ...(update ? ['baseVersion'] : [])]);
  if (update) {
    integer(body.baseVersion, '/baseVersion');
  }
  for (const k of ['name', 'subject']) {
    if (body[k] !== undefined) {
      text(body[k], '/' + k, 120, true);
    }
  }
  if (body.term !== undefined) {
    nullableText(body.term, '/term', 120);
  }
  if (body.seating !== undefined) {
    seating(body.seating);
  }
  for (const k of ['classId', 'subjectId', 'examId', 'sourceFileId']) {
    if (body[k] !== undefined) {
      id(body[k], '/' + k);
    }
  }
  if (kind === 'students') {
    nullableText(body.studentNumber, '/studentNumber', 80);
    if (body.birthday !== null) {
      date(body.birthday, '/birthday');
    }
    text(body.interests, '/interests', 2000);
    text(body.description, '/description', 2000);
  }
  if (body.occurredOn !== undefined) {
    date(body.occurredOn, '/occurredOn');
  }
  if (body.text !== undefined) {
    text(body.text, '/text', 20000, true);
  }
  if (body.scope !== undefined) {
    enumValue(body.scope, ['class', 'student'], '/scope');
  }
  if (kind === 'exams') {
    score(body.totalMax, '/totalMax', true);
    array(body.source, '/source', 100).forEach((x, i) => {
      object(x, ['fileId', 'renditionFileId'], undefined, '/source/' + i);
      id(x.fileId, '/source/' + i + '/fileId');
      if (x.renditionFileId !== null) {
        id(x.renditionFileId, '/source/' + i + '/renditionFileId');
      }
    });
    array(body.questions, '/questions', 300).forEach((x, i) => question(x, '/questions/' + i));
  }
  if (kind === 'imports' && update) {
    mapping(body.mapping);
    if (body.rows !== null) {
      rows(body.rows, true);
    }
  }
  if (kind === 'results') {
    integer(body.examVersion, '/examVersion');
    rows(body.rows);
  }
  return body;
}
export function query(input, allowed) {
  for (const key of Object.keys(input ?? {}).sort()) {
    if (!allowed.includes(key)) {
      fail('/query/' + key, 'unknown-field');
    }
    if (typeof input[key] !== 'string') {
      fail('/query/' + key, 'invalid-type');
    }
  }
  if (input.deleted !== undefined) {
    enumValue(input.deleted, ['active', 'deleted', 'all'], '/query/deleted');
  }
  for (const k of ['classId', 'subjectId', 'examId']) {
    if (input[k] !== undefined) {
      id(input[k], '/query/' + k);
    }
  }
  for (const k of ['from', 'to']) {
    if (input[k] !== undefined) {
      date(input[k], '/query/' + k);
    }
  }
  if (input.from && input.to && input.from > input.to) {
    fail('/query/from');
  }
  if (input.scope !== undefined) {
    enumValue(input.scope, ['class', 'student'], '/query/scope');
  }
  if (input.state !== undefined) {
    enumValue(input.state, ['draft', 'confirmed'], '/query/state');
  }
  for (const k of ['classIds', 'tagIds']) {
    if (input[k] !== undefined) {
      const values = input[k].split(',');
      array(values, '/query/' + k, k === 'classIds' ? 20 : 100);
      values.forEach((v, i) => id(v, '/query/' + k + '/' + i));
      if (new Set(values).size !== values.length) {
        fail('/query/' + k, 'duplicate-id');
      }
    }
  }
  return input;
}
