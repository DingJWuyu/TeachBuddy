import { randomUUID } from 'node:crypto';
import { account, required, active, version, changed, timestamp, listed, conflict } from './problems.js';
import { fail } from './schema.js';
import { canonicalRow, validateScores } from './scores.js';
const sourceTypes = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/webp']);
export function validateExamFiles(files, p, exam) {
  const sources = new Map();
  for (const [i, s] of exam.source.entries()) {
    if (sources.has(s.fileId)) {
      fail('/source/' + i + '/fileId', 'duplicate-id');
    }
    const metadata = files.read(p, s.fileId);
    if (!sourceTypes.has(metadata.mediaType)) {
      fail('/source/' + i + '/fileId');
    }
    if (s.renditionFileId !== null) {
      files.readRendition(p, s);
    }
    sources.set(s.fileId, s);
  }
  for (const [i, q] of exam.questions.entries()) {
    for (const [j, l] of q.locations.entries()) {
      const source = sources.get(l.fileId),
        field = `/questions/${i}/locations/${j}`;
      if (!source || source.renditionFileId !== l.renditionFileId) {
        fail(field + '/fileId');
      }
      const fixed = files.readRendition(p, l);
      if (!fixed.pages.some(page => page.page === l.page || page.pageNumber === l.page)) {
        fail(field + '/page');
      }
    }
  }
}
export function createAssessment({
  repository: r,
  files,
  clock,
  imports
}) {
  const save = (kind, p, v) => r.write(kind, account(p), v);
  const get = (kind, p, id) => required(r, kind, p, id);
  function examValue(p, body, old) {
    const seen = new Set();
    const questions = body.questions.map((q, i) => {
      if (q.id && (!old || !old.questions.some(x => x.id === q.id))) {
        fail('/questions/' + i + '/id');
      }
      const id = q.id ?? randomUUID();
      if (seen.has(id)) {
        fail('/questions/' + i + '/id', 'duplicate-id');
      }
      seen.add(id);
      if (new Set(q.tagIds).size !== q.tagIds.length) {
        fail('/questions/' + i + '/tagIds', 'duplicate-id');
      }
      for (const tagId of q.tagIds) {
        const t = get('tags', p, tagId);
        if (t.mergedIntoId) {
          throw conflict('tag-merged', {
            targetId: t.mergedIntoId
          });
        }
      }
      return {
        ...q,
        id
      };
    });
    const value = {
      name: body.name,
      subject: body.subject,
      occurredOn: body.occurredOn,
      totalMax: body.totalMax,
      source: body.source,
      questions
    };
    validateExamFiles(files, p, value);
    if (old) {
      for (const result of r.list('results', account(p)).filter(x => x.examId === old.id)) {
        for (const row of result.rows) {
          for (const [qid, s] of Object.entries(row.scores)) {
            if (s !== null && !seen.has(qid)) {
              throw conflict('question-in-use', {
                questionId: qid
              });
            }
          }
        }
        const kept = result.rows.map(row => ({
          ...row,
          scores: Object.fromEntries(Object.entries(row.scores).filter(([qid]) => seen.has(qid)))
        }));
        validateScores(value, kept);
        if (kept.some((row, i) => Object.keys(row.scores).length !== Object.keys(result.rows[i].scores).length)) {
          save('results', p, changed(result, clock, {
            rows: kept
          }));
        }
      }
    }
    return value;
  }
  return {
    get,
    list(kind, p, q = {}) {
      if (q.examId) {
        get('exams', p, q.examId);
      }
      if (q.classId) {
        get('classes', p, q.classId);
      }
      return listed(r.list(kind, account(p)).filter(v => !q.examId || v.examId === q.examId).filter(v => !q.classId || v.classId === q.classId), q);
    },
    createExam(p, body) {
      const now = timestamp(clock);
      return save('exams', p, {
        id: randomUUID(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...examValue(p, body)
      });
    },
    updateExam(p, id, body) {
      const old = get('exams', p, id);
      version(old, body.baseVersion);
      active(old);
      return save('exams', p, changed(old, clock, examValue(p, body, old)));
    },
    updateResult(p, id, body) {
      const old = get('results', p, id);
      version(old, body.baseVersion);
      active(old);
      const exam = active(get('exams', p, old.examId));
      version(exam, body.examVersion);
      active(get('classes', p, old.classId));
      const previous = new Map(old.rows.map(s => [s.studentId, s]));
      const ids = new Set(body.rows.map(s => s.studentId));
      for (const sid of previous.keys()) {
        if (!ids.has(sid)) {
          fail('/rows');
        }
      }
      const warnings = validateScores(exam, body.rows);
      const rows = body.rows.map((row, i) => {
        const student = get('students', p, row.studentId);
        if (!previous.has(student.id) && (student.classId !== old.classId || student.deletedAt)) {
          fail('/rows/' + i + '/studentId');
        }
        return canonicalRow(exam, row, previous.has(student.id) ? {
          id: student.id,
          ...previous.get(student.id).studentSnapshot
        } : student);
      });
      const result = save('results', p, changed(old, clock, {
        rows,
        examVersionAtConfirmation: exam.version,
        provenance: {
          ...old.provenance,
          correctedAt: timestamp(clock)
        }
      }));
      return {
        result,
        warnings
      };
    },
    deletion(kind, p, id, body) {
      const old = get(kind, p, id);
      version(old, body.baseVersion);
      return save(kind, p, changed(old, clock, {
        deletedAt: body.deleted ? timestamp(clock) : null
      }));
    },
    confirmImport(p, id, body) {
      const imp = get('imports', p, id);
      version(imp, body.baseVersion);
      active(imp);
      if (imp.state === 'confirmed') {
        throw conflict('import-confirmed', {
          resultId: imp.confirmedResultId
        });
      }
      const exam = active(get('exams', p, imp.examId)),
        cls = active(get('classes', p, imp.classId));
      version(exam, imp.baselines.examVersion);
      version(cls, imp.baselines.classVersion);
      const students = r.list('students', account(p)).filter(s => s.classId === cls.id && !s.deletedAt);
      const baselines = new Map(imp.baselines.students.map(s => [s.id, s.version]));
      if (students.length !== baselines.size || students.some(s => baselines.get(s.id) !== s.version)) {
        throw conflict('import-baseline-conflict');
      }
      const existing = r.list('results', account(p)).find(v => v.examId === exam.id && v.classId === cls.id);
      if ((existing?.version ?? null) !== imp.baselines.resultVersion) {
        throw conflict('import-baseline-conflict');
      }
      if (existing) {
        active(existing);
      }
      files.read(p, imp.sourceFileId);
      if (files.read(p, imp.sourceFileId).sha256 !== imp.sourceSha256) {
        throw conflict('import-source-changed');
      }
      validateExamFiles(files, p, exam);
      if (!exam.source.length || !exam.questions.length) {
        throw conflict('exam-material-required');
      }
      const issues = imports.review(p, imp);
      if (issues.some(i => i.severity === 'error')) {
        throw conflict('import-review-required', {
          issues
        });
      }
      const matched = new Map(imp.rows.filter(row => !row.ignored).map(row => [row.studentId, row]));
      const rows = students.map(s => canonicalRow(exam, matched.get(s.id) ?? {
        status: 'unrecorded',
        totalScore: null,
        scores: {}
      }, s));
      const currentStudentIds = new Set(students.map(student => student.id));
      for (const historicalRow of existing?.rows ?? []) {
        if (!currentStudentIds.has(historicalRow.studentId)) {
          rows.push(historicalRow);
        }
      }
      validateScores(exam, rows);
      const fields = {
        examId: exam.id,
        classId: cls.id,
        rows,
        provenance: {
          importId: imp.id,
          sourceFileId: imp.sourceFileId
        },
        examVersionAtConfirmation: exam.version
      };
      const now = timestamp(clock);
      const result = save('results', p, existing ? changed(existing, clock, fields) : {
        id: randomUUID(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...fields
      });
      const confirmed = save('imports', p, changed(imp, clock, {
        state: 'confirmed',
        confirmedResultId: result.id,
        issues
      }));
      return {
        import: confirmed,
        result,
        warnings: issues.filter(i => i.severity === 'warning')
      };
    }
  };
}
