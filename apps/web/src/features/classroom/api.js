import { workbenchBlob } from '../../platform/http/apiClient.js';
import { problemFromResponse, unconfirmedProblem } from '../../platform/http/problems.js';
import { sendHttpRequest, readHttpBody, fileFormData } from '../../platform/http/request.js';
import { readLocal, writeLocal, removeLocal } from '../../platform/device/storage.js';
import { deviceRequestStore, clearDeviceRequestAccount } from '../../platform/device/deviceRequestStore.js';
import { tx } from '../../i18n/presentation.js';

const BASE = '/api/modules/classroom';
const PENDING = 'pending:classroom';
const binaryStore = (account, action, value) => deviceRequestStore({ database: 'teachbuddy-classroom-pending', storeName: 'requests', account, name: 'pending:classroom-upload', action, value });
export const clearClassroomDeviceData = account => clearDeviceRequestAccount({ database: 'teachbuddy-classroom-pending', storeName: 'requests', account });
const query = params => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params || {})) if (value != null && value !== '' && (!Array.isArray(value) || value.length)) search.set(name, Array.isArray(value) ? value.join(',') : value);
  return search.size ? `?${search}` : '';
};
const nullable = value => value?.trim() || null;
const seatView = seating => ({ ...seating, cols: seating.columns, seats: seating.seats.map(s => ({ ...s, row: s.row - 1, col: s.column - 1 })) });
const studentView = s => ({ ...s, studentNo: s.studentNumber, personality: s.description });
const recordView = r => ({ ...r, date: r.occurredOn, body: r.text, subject: { kind: r.scope, id: r.subjectId } });
const questionView = q => ({ ...q, group: q.groupLabel || '', fullScore: q.maxScore, known: q.observedCells, missing: q.missingCount, state: q.reason || 'ok' });
const mappingBody = m => ({ sheetIndex: m.sheet, headerRow: m.headerRow, firstDataRow: m.firstRow, lastDataRow: m.lastRow, nameColumn: m.nameCol, studentNumberColumn: m.numberCol, totalColumn: m.totalCol, attendanceColumn: m.absentCol, questionColumns: Object.entries(m.questionCols).map(([questionId, column]) => ({ questionId, column })), ignoredRows: [] });
const rowBody = row => ({ sourceRow: row.sourceRow, studentId: row.studentId, status: row.status, totalScore: row.status === 'present' ? row.total : null, scores: row.status === 'present' ? row.scores : {}, ignored: row.ignored });
const importIssueView = issue => ({
  ...issue,
  code: ['score-out-of-range', 'total-out-of-range'].includes(issue.code) ? 'out-of-range' : issue.code,
  level: issue.severity,
  field: issue.questionId || (issue.code === 'total-out-of-range' || issue.field === 'totalScore' ? 'total' : issue.field),
});


/** Owns the classroom DTO translation and one exact persisted logical write.
 * Replaying after reload retains its request key, payload and account scope. */
export function createClassroomApi({ accountKey, transport, getSignal, onIdentityLost }) {
  let classes = [], students = [], activeWrite = null;
  const exams = new Map(), imports = new Map(), files = new Map();
  async function json(method, path, body, key) {
    const signal = getSignal();
    let response, value;
    try {
      response = await sendHttpRequest(transport, path, { method, signal, timeoutMs: 20000, headers: { Accept: 'application/json', ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-TeachBuddy-Request': '1', 'Idempotency-Key': key }) }, body: body === undefined ? undefined : JSON.stringify(body) });
      value = await readHttpBody(response, 'optional-json', signal);
    } catch {
      const problem = unconfirmedProblem(tx('操作结果未确认'));
      throw Object.assign(new Error(problem.message), { problem });
    }
    if (response.status === 401) onIdentityLost?.();
    if (!response.ok) {
      let problem = problemFromResponse(response.status, value);
      if (response.status === 409 && value?.type?.startsWith('/problems/workbench/classroom-')) {
        const copy = {
          'restore-class-required': '请先恢复所属班级', 'restore-student-required': '请先恢复所属学生',
          'student-number-conflict': '同班学号不能重复', 'tag-name-conflict': '标签名称已存在', 'tag-merged': '标签已合并，请重新选择',
          'question-in-use': '这道题已有成绩，不能移除', 'import-baseline-conflict': '内容已在别处更新，请刷新后再试。',
          'import-review-required': '还有需要校对的问题', 'import-confirmed': '成绩已保存',
        };
        const code = value.type.slice('/problems/workbench/classroom-'.length);
        problem = { ...problem, kind: 'conflict', message: tx(copy[code] || '内容已在别处更新，请刷新后再试。') };
      }
      throw Object.assign(new Error(problem.message), { status: response.status, problem: { ...value, ...problem } });
    }
    if (!value || typeof value !== 'object') { const problem = unconfirmedProblem(tx('操作结果未确认')); throw Object.assign(new Error(problem.message), { problem }); }
    return value;
  }
  const rawGet = (path, params) => json('GET', BASE + path + query(params));
  async function fileInfo(id) {
    if (!files.has(id)) files.set(id, await json('GET', `/api/workbench/files/${id}`));
    return files.get(id);
  }
  async function examView(e) {
    exams.set(e.id, e);
    return { ...e, date: e.occurredOn, fullScore: e.totalMax, questions: (e.questions || []).map(questionView), source: { files: await Promise.all((e.source || []).map(async s => ({ ...await fileInfo(s.fileId), ...s }))) } };
  }
  function importView(d) {
    imports.set(d.id, d);
    const m = d.mapping, roster = students.filter(s => s.classId === d.classId);
    const issues = d.issues || [];
    const sheets = d.workbook.sheets.map(sheet => ({ ...sheet, rows: Array.from({ length: Math.max(0, ...sheet.rows.map(r => r.rowNumber)) }, (_, i) => {
      const row = sheet.rows.find(r => r.rowNumber === i + 1);
      return Array.from({ length: Math.max(0, ...(row?.cells || []).map(c => c.column)) }, (_, c) => { const cell = row?.cells.find(x => x.column === c + 1); return cell ? { ...cell, text: cell.display, kind: cell.type } : null; });
    }) }));
    const rows = d.rows.map(row => {
      const source = d.workbook.sheets[m?.sheetIndex || 0].rows.find(r => r.rowNumber === row.sourceRow);
      const display = col => source?.cells.find(c => c.column === col)?.display || '';
      return { ...row, total: row.totalScore, source: { name: display(m?.nameColumn), studentNo: display(m?.studentNumberColumn) }, issues: issues.filter(i => i.sourceRow == null || i.sourceRow === row.sourceRow).map(importIssueView) };
    });
    return { ...d, mapping: m ? { sheet: m.sheetIndex, headerRow: m.headerRow, firstRow: m.firstDataRow, lastRow: m.lastDataRow, nameCol: m.nameColumn, numberCol: m.studentNumberColumn, totalCol: m.totalColumn, absentCol: m.attendanceColumn, questionCols: Object.fromEntries(m.questionColumns.map(q => [q.questionId, q.column])) } : null, fileName: files.get(d.sourceFileId)?.name || '', workbook: { ...d.workbook, sheets }, rows,
      unrecorded: roster.filter(s => !rows.some(r => !r.ignored && r.studentId === s.id)).map(s => s.id),
      summary: { rows: rows.length, errors: issues.filter(i => i.severity === 'error').length, warnings: issues.filter(i => i.severity === 'warning').length, ignored: rows.filter(r => r.ignored).length } };
  }
  async function adapt(path, value) {
    if (path.endsWith('/confirmation') || path.endsWith('/merge')) return value;
    const kind = path.split('/')[1];
    const one = async item => kind === 'classes' ? { ...item, seating: seatView(item.seating) } : kind === 'students' ? studentView(item) : kind === 'records' ? recordView(item) : kind === 'exams' ? examView(item) : kind === 'imports' ? (await fileInfo(item.sourceFileId), importView(item)) : item;
    if (value.items) return { ...value, items: await Promise.all(value.items.map(one)) };
    return one(value);
  }
  async function execute(pending) {
    try {
      const result = await json(pending.method, BASE + pending.path, pending.body, pending.key);
      removeLocal(accountKey, PENDING);
      if (pending.path.startsWith('/imports') && result.id && result.state === 'draft') writeLocal(accountKey, 'draft:classroom-import', { id: result.id, examId: result.examId, classId: result.classId });
      if (pending.path.endsWith('/confirmation')) removeLocal(accountKey, 'draft:classroom-import');
      return adapt(pending.path, result);
    } catch (error) {
      if (!['unconfirmed', 'identity'].includes(error.problem?.kind)) removeLocal(accountKey, PENDING);
      error.status = error.problem?.status;
      throw error;
    }
  }
  async function write(method, path, body) {
    if (activeWrite) throw new Error(tx('操作没有完成，请再试一次。'));
    const previous = readLocal(accountKey, PENDING);
    if (previous && (previous.method !== method || previous.path !== path || JSON.stringify(previous.body) !== JSON.stringify(body))) throw new Error(tx('上次操作的结果未确认，请重试确认'));
    const pending = previous || { method, path, body, key: crypto.randomUUID() };
    if (!writeLocal(accountKey, PENDING, pending)) throw new Error(tx('无法保留原请求，请检查浏览器存储权限'));
    activeWrite = execute(pending);
    try { return await activeWrite; } finally { activeWrite = null; }
  }
  async function classPoint(p, result) {
    const ranked = (result?.rows || []).filter(r => r.status === 'present' && r.totalScore != null).sort((a,b) => b.totalScore - a.totalScore);
    let rank = 0;
    const people = ranked.map((r, i) => { if (!i || r.totalScore !== ranked[i - 1].totalScore) rank = i + 1; return { ...r, total: r.totalScore, name: r.studentSnapshot.name, studentNo: r.studentSnapshot.studentNumber, rate: r.totalScore / p.exam.totalMax, rank }; });
    people.push(...(result?.rows || []).filter(r => r.status !== 'present' || r.totalScore == null).map(r => ({ ...r, total: r.totalScore, name: r.studentSnapshot.name, studentNo: r.studentSnapshot.studentNumber, rate: null, rank: null })));
    people.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.name.localeCompare(b.name, 'zh'));
    return { ...p, ...p.overall, distribution: p.overall.distribution.map((bin, index) => ({ ...bin, bin: index })), state: 'ok', exam: await examView({ ...exams.get(p.exam.id), ...p.exam, questions: p.questions }), present: p.overall.presentCount, absent: p.overall.absentCount, unrecorded: p.overall.unrecordedCount, missingTotal: p.overall.missingTotalCount, students: people, questions: p.questions.map(questionView), tags: p.tags.map(t => ({ ...t, state: t.reason || 'ok' })) };
  }
  async function statistics(path, params) {
    const selected = params.examId || [], filters = { ...params, tagIds: params.tagId }; delete filters.tagId; delete filters.examId;
    if (!Array.isArray(selected) && selected) filters.examId = selected;
    const value = await rawGet(path, filters);
    if (Array.isArray(selected) && selected.length) value.points = value.points.filter(p => selected.includes(p.exam.id));
    if (path.startsWith('/classes/')) {
      const classId = path.split('/')[2];
      const results = await rawGet('/results', { classId });
      const points = await Promise.all(value.points.map(p => classPoint(p, results.items.find(r => r.id === p.resultId))));
      const ids = new Set(points.map(p => p.exam.id));
      for (const e of exams.values()) if (!e.deletedAt && !ids.has(e.id) && (!selected.length || selected.includes(e.id))) points.push({ exam: await examView(e), state: 'no-result' });
      points.sort((a,b) => a.exam.date.localeCompare(b.exam.date) || a.exam.id.localeCompare(b.exam.id));
      if (params.tagId?.length) for (const point of points) if (point.tags) point.tags = point.tags.filter(t => params.tagId.includes(t.id));
      return { ...value, points };
    }
    const points = await Promise.all(value.points.map(async p => {
      const reference = await rawGet(`/classes/${p.overall.classReference.id}/statistics`, { examId: p.exam.id });
      const ref = reference.points[0];
      return { ...p, ...p.overall, exam: await examView({ ...p.exam, questions: p.questions }), total: p.overall.totalScore, className: p.overall.classReference.name, classMean: p.overall.classReference.overall.mean, rankCount: p.overall.rankedCount,
        questions: p.questions.map(q => ({ ...questionView(q), score: q.observedCells ? q.scoreSum : null, classRate: ref?.questions.find(x => x.id === q.id)?.rate ?? null })), tags: p.tags.map(t => ({ ...t, state: t.reason || 'ok' })) };
    }));
    return { ...value, points };
  }
  async function get(path, params = {}) {
    if (path.endsWith('/statistics')) return statistics(path, params);
    if (path.endsWith('/comparison')) {
      const value = await rawGet(path, { classIds: classes.map(c => c.id) });
      return { ...value, classes: await Promise.all(value.classes.map(async c => c.point ? { ...await classPoint(c.point), classId: c.class.id, name: c.class.name } : { ...c, classId: c.class.id, name: c.class.name })) };
    }
    if (params.state === 'deleted') { params = { ...params, deleted: 'deleted' }; delete params.state; }
    if (path === '/students' && !params.classId && !params.deleted) {
      const groups = await Promise.all(classes.map(c => rawGet(path, { ...params, classId: c.id })));
      const items = groups.flatMap(g => g.items).map(studentView);
      if (!params.deleted) students = items;
      return { items };
    }
    if (path === '/records' && (params.classId || params.studentId)) {
      params = { ...params, scope: params.classId ? 'class' : 'student', subjectId: params.classId || params.studentId }; delete params.classId; delete params.studentId;
    }
    const value = await rawGet(path, params);
    if (path === '/classes' && !params.deleted) classes = value.items;
    return adapt(path, value);
  }
  async function bodyFor(path, body) {
    const b = { ...body }, kind = path.split('/')[1], id = path.split('/')[2];
    if (path.endsWith('/deletion') || path.endsWith('/merge') || path.endsWith('/confirmation')) return b;
    if (path.endsWith('/seating')) return { baseVersion: b.baseVersion, seating: { rows: b.rows, columns: b.cols, seats: b.seats.map(s => ({ row: s.row + 1, column: s.col + 1, studentId: s.studentId })) } };
    if (kind === 'students') { b.studentNumber = nullable(b.studentNo); b.description = b.personality; delete b.studentNo; delete b.personality; }
    if (kind === 'records') { if (b.subject) { b.scope = b.subject.kind; b.subjectId = b.subject.id; delete b.subject; } b.occurredOn = b.date; b.text = b.body; delete b.date; delete b.body; }
    if (kind === 'exams') {
      const old = id ? await rawGet(path) : { source: [], questions: [] };
      return { ...(id ? { baseVersion: b.baseVersion } : {}), name: b.name ?? old.name, subject: b.subject ?? old.subject, occurredOn: b.date ?? old.occurredOn, totalMax: b.fullScore ?? old.totalMax,
        source: b.source ? b.source.files.map(f => ({ fileId: f.fileId, renditionFileId: f.renditionFileId ?? null })) : old.source,
        questions: b.questions ? b.questions.map(q => ({ ...(q.id ? { id: q.id } : {}), label: q.label, groupLabel: nullable(q.group), maxScore: q.fullScore, tagIds: q.tagIds, locations: old.questions.find(x => x.id === q.id)?.locations || [] })) : old.questions };
    }
    if (kind === 'imports') {
      if (b.fileId) { b.sourceFileId = b.fileId; delete b.fileId; }
      if (id) {
        const old = imports.get(id) || await rawGet(path);
        return { baseVersion: b.baseVersion, mapping: b.mapping ? mappingBody(b.mapping) : old.mapping, rows: b.rows == null ? null : b.rows.map(rowBody) };
      }
    }
    return b;
  }
  return {
    get,
    post: async (path, body = {}) => write('POST', path, await bodyFor(path, body)),
    put: async (path, body) => write('PUT', path, await bodyFor(path, body)),
    remove: (collection, item, deleted = true) => write('PUT', `/${collection}/${item.id}/deletion`, { baseVersion: item.version, deleted }),
    async recover() { const pending = readLocal(accountKey, PENDING); if (pending) await execute(pending); },
    async upload(file) {
      let pending = await binaryStore(accountKey, 'get');
      if (pending) {
        const hash = async blob => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].join(',');
        if (file.name !== pending.input.name || file.size !== pending.input.size || await hash(file) !== await hash(pending.input)) throw new Error(tx('请重新选择原文件'));
      } else pending = await binaryStore(accountKey, 'put', { key: crypto.randomUUID(), input: file });
      const signal = getSignal();
      const response = await sendHttpRequest(transport, '/api/workbench/files', { method: 'POST', body: fileFormData(pending.input), signal, timeoutMs: 60000, headers: { 'Idempotency-Key': pending.key, 'X-TeachBuddy-Request': '1' } });
      const value = await readHttpBody(response, 'json', signal);
      if (!response.ok) { if (response.status === 401) onIdentityLost?.(); if (response.status < 500 && response.status !== 401) await binaryStore(accountKey, 'delete'); throw new Error(value.detail || tx('操作没有完成，请再试一次。')); }
      await binaryStore(accountKey, 'delete'); files.set(value.id, value); return value;
    },
    async fileBlob(id) { return workbenchBlob(`/api/workbench/files/${id}/content`); },
  };
}
