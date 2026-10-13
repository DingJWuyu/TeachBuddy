import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readScoreWorkbook, WorkbookInputError } from './workbook.js';
import { account, required, active, version, changed, timestamp, listed, conflict } from './problems.js';
import { fail } from './schema.js';
import { issue, validateScores } from './scores.js';
export function createImports({
  repository: r,
  files,
  clock
}) {
  const get = (p, id) => required(r, 'imports', p, id);
  function context(p, examId, classId) {
    const exam = active(required(r, 'exams', p, examId)),
      cls = active(required(r, 'classes', p, classId));
    const students = r.list('students', account(p)).filter(s => s.classId === classId && !s.deletedAt);
    const result = r.list('results', account(p)).find(x => x.examId === examId && x.classId === classId);
    if (result) {
      active(result);
    }
    return {
      exam,
      cls,
      students,
      baselines: {
        examVersion: exam.version,
        classVersion: cls.version,
        resultVersion: result?.version ?? null,
        students: students.map(s => ({
          id: s.id,
          version: s.version
        }))
      }
    };
  }
  function candidates(p, imp) {
    const {
        exam,
        students
      } = context(p, imp.examId, imp.classId),
      m = imp.mapping;
    if (m === null) {
      return {
        rows: [],
        issues: [issue('error', 'mapping-required', '请选择工作表、行范围及成绩列。')]
      };
    }
    const sheet = imp.workbook.sheets[m.sheetIndex];
    if (!sheet) {
      fail('/mapping/sheetIndex');
    }
    const columns = [m.nameColumn, m.studentNumberColumn, m.totalColumn, m.attendanceColumn, ...m.questionColumns.map(q => q.column)].filter(x => x !== null);
    if (new Set(columns).size !== columns.length) {
      fail('/mapping', 'duplicate-id');
    }
    const qids = new Set(exam.questions.map(q => q.id));
    if (new Set(m.questionColumns.map(q => q.questionId)).size !== m.questionColumns.length) {
      fail('/mapping/questionColumns', 'duplicate-id');
    }
    for (const q of m.questionColumns) {
      if (!qids.has(q.questionId)) {
        fail('/mapping/questionColumns');
      }
    }
    if (new Set(m.ignoredRows).size !== m.ignoredRows.length || m.ignoredRows.some(row => row < m.firstDataRow || row > m.lastDataRow)) {
      fail('/mapping/ignoredRows');
    }
    const rows = [],
      issues = [];
    const cell = (sourceRow, column) => sheet.rows.find(r => r.rowNumber === sourceRow)?.cells.find(c => c.column === column);
    const shown = c => c?.display?.trim() ?? '';
    for (let n = m.firstDataRow; n <= m.lastDataRow; n++) {
      const name = shown(cell(n, m.nameColumn)),
        num = m.studentNumberColumn === null ? '' : shown(cell(n, m.studentNumberColumn));
      const byNum = num ? students.filter(s => s.studentNumber === num) : [],
        byName = name ? students.filter(s => s.name.trim() === name) : [];
      let match = null;
      if (num && byNum.length === 1 && (!name || byNum[0].name.trim() === name)) {
        match = byNum[0];
      }
      if (!num && byName.length === 1) {
        match = byName[0];
      }
      const ignored = m.ignoredRows.includes(n),
        attendance = m.attendanceColumn === null ? '' : shown(cell(n, m.attendanceColumn));
      const status = ['缺考', 'absent'].includes(attendance) ? 'absent' : ['未录入', 'unrecorded'].includes(attendance) ? 'unrecorded' : 'present';
      if (attendance && !['缺考', 'absent', '未录入', 'unrecorded', '参考', 'present', '出考', '正常'].includes(attendance)) {
        issues.push(issue('error', 'attendance-review-required', '请校对参考状态。', {
          sourceRow: n,
          column: m.attendanceColumn
        }));
      }
      function numeric(column, questionId = null) {
        const c = cell(n, column);
        if (!c) {
          return null;
        }
        if (c.formula && (c.type !== 'number' || c.value === null)) {
          issues.push(issue('error', 'score-cell-review-required', '公式没有可用数值缓存，请人工校对。', {
            sourceRow: n,
            column,
            questionId
          }));
          return null;
        }
        if (c.type === 'blank' || !shown(c)) {
          return null;
        }
        const numericDisplay = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(shown(c));
        const formatting = !numericDisplay;
        if (c.type !== 'number' || c.value === null || formatting || c.value < 0 || c.value > 100000 || Math.abs(c.value * 100 - Math.round(c.value * 100)) > 1e-7) {
          issues.push(issue('error', 'score-cell-review-required', '计分格不是可用分数，请人工校对。', {
            sourceRow: n,
            column,
            questionId
          }));
          return null;
        }
        if (c.formula) {
          issues.push(issue('warning', 'cached-formula', '使用公式已缓存的数值，未执行公式。', {
            sourceRow: n,
            column,
            questionId
          }));
        }
        return c.value;
      }
      const totalScore = numeric(m.totalColumn),
        scores = Object.fromEntries(m.questionColumns.map(q => [q.questionId, numeric(q.column, q.questionId)]));
      rows.push({
        sourceRow: n,
        studentId: match?.id ?? null,
        status,
        totalScore,
        scores,
        ignored
      });
    }
    return {
      rows,
      issues
    };
  }
  function review(p, imp) {
    const generated = candidates(p, imp),
      {
        exam,
        students
      } = context(p, imp.examId, imp.classId),
      byRow = new Map(imp.rows.map(row => [row.sourceRow, row]));
    const issues = [];
    if (imp.mapping === null) {
      return generated.issues;
    }
    if (byRow.size !== imp.rows.length) {
      issues.push(issue('error', 'duplicate-source-row', '来源行不能重复。'));
    }
    for (const row of imp.rows) {
      if (row.sourceRow < imp.mapping.firstDataRow || row.sourceRow > imp.mapping.lastDataRow) {
        issues.push(issue('error', 'source-row-outside-mapping', '校对行不属于选定范围。', {
          sourceRow: row.sourceRow
        }));
      }
    }
    for (const generatedRow of generated.rows) {
      const row = byRow.get(generatedRow.sourceRow);
      if (!row) {
        issues.push(issue('error', 'missing-source-row', '原成绩行不能静默丢失，请明确忽略。', {
          sourceRow: generatedRow.sourceRow
        }));
        continue;
      }
      if (row.ignored) {
        continue;
      }
      if (row.studentId && !students.some(s => s.id === row.studentId)) {
        issues.push(issue('error', 'student-not-in-class', '学生不属于当前活动名单。', {
          sourceRow: row.sourceRow,
          studentId: row.studentId
        }));
      }
      for (const i of generated.issues.filter(i => i.sourceRow === row.sourceRow)) {
        if (i.severity === 'error' && (imp.reviewedSourceRows ?? []).includes(row.sourceRow)) {
          continue;
        }
        if (i.severity === 'warning') {
          issues.push(i);
          continue;
        }
        const value = i.questionId ? row.scores[i.questionId] : row.totalScore;
        if (i.code === 'attendance-review-required') {
          if (row.status === generatedRow.status) {
            issues.push(i);
          }
        } else if (value === null || value === undefined) {
          issues.push(i);
        }
      }
    }
    return [...issues, ...validateScores(exam, imp.rows, {
      draft: true
    })];
  }
  return {
    get,
    list(p, q = {}) {
      return listed(r.list('imports', account(p)).filter(i => !q.examId || i.examId === q.examId).filter(i => !q.classId || i.classId === q.classId).filter(i => !q.state || i.state === q.state), q);
    },
    async prepareImport(p, body) {
      context(p, body.examId, body.classId);
      const metadata = files.read(p, body.sourceFileId);
      const chunks = [];
      let size = 0;
      for await (const chunk of await files.open(p, body.sourceFileId)) {
        size += chunk.length;
        if (size > 10 * 1024 * 1024) {
          fail('/sourceFileId');
        }
        chunks.push(chunk);
      }
      let workbook;
      try {
        workbook = await readScoreWorkbook(Buffer.concat(chunks));
      } catch (error) {
        if (error instanceof WorkbookInputError) {
          throw Object.assign(new Error(error.detail), {
            status: 422,
            problem: {
              type: '/problems/workbench/classroom-workbook-input',
              code: error.code,
              field: '/sourceFileId',
              detail: error.detail
            }
          });
        }
        throw error;
      }
      return {
        ...body,
        sourceSha256: metadata.sha256,
        workbook
      };
    },
    createImport(p, prepared) {
      const {
          baselines
        } = context(p, prepared.examId, prepared.classId),
        metadata = files.read(p, prepared.sourceFileId);
      if (metadata.sha256 !== prepared.sourceSha256) {
        throw conflict('import-source-changed');
      }
      const now = timestamp(clock),
        value = {
          id: randomUUID(),
          version: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          ...prepared,
          state: 'draft',
          mapping: null,
          rows: [],
          issues: [issue('error', 'mapping-required', '请选择成绩列与学生对应。')],
          baselines,
          confirmedResultId: null,
          reviewedSourceRows: []
        };
      return r.write('imports', account(p), value);
    },
    updateImport(p, id, body) {
      const old = get(p, id);
      version(old, body.baseVersion);
      active(old);
      if (old.state === 'confirmed') {
        throw conflict('import-confirmed', {
          resultId: old.confirmedResultId
        });
      }
      const {
        baselines
      } = context(p, old.examId, old.classId);
      files.read(p, old.sourceFileId);
      let value = changed(old, clock, {
        mapping: body.mapping,
        rows: body.rows ?? [],
        reviewedSourceRows: body.mapping === null || body.rows === null || !isDeepStrictEqual(body.mapping, old.mapping) ? [] : body.rows.filter(row => !row.ignored && row.sourceRow >= body.mapping.firstDataRow && row.sourceRow <= body.mapping.lastDataRow).map(row => row.sourceRow),
        baselines
      });
      if (body.rows === null) {
        value.rows = candidates(p, value).rows;
      }
      value.issues = review(p, value);
      return r.write('imports', account(p), value);
    },
    review,
    deletion(p, id, body) {
      const old = get(p, id);
      version(old, body.baseVersion);
      if (old.state === 'confirmed') {
        throw conflict('import-confirmed', {
          resultId: old.confirmedResultId
        });
      }
      return r.write('imports', account(p), changed(old, clock, {
        deletedAt: body.deleted ? timestamp(clock) : null
      }));
    }
  };
}
