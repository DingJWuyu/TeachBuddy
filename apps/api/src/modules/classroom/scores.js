import { fail } from './schema.js';
// Scores have at most two decimals; compare and sum integer cents so float error cannot break ties or range checks.
export const cents = n => Math.round(n * 100);
export const issue = (severity, code, message, fields = {}) => ({
  severity,
  code,
  sourceRow: null,
  column: null,
  studentId: null,
  questionId: null,
  message,
  ...fields
});
export function validateScores(exam, rows, {
  draft = false
} = {}) {
  const issues = [],
    seen = new Set(),
    qids = new Set(exam.questions.map(q => q.id));
  const error = (code, message, r, questionId = null) => {
    const fields = {
      sourceRow: r.sourceRow ?? null,
      studentId: r.studentId,
      questionId
    };
    issues.push(issue('error', code, message, fields));
  };
  for (const row of rows) {
    if (row.ignored) {
      continue;
    }
    if (!row.studentId) {
      error('student-match-required', '请明确匹配学生。', row);
    } else if (seen.has(row.studentId)) {
      error('duplicate-student', '同一学生不能重复出现。', row);
    } else {
      seen.add(row.studentId);
    }
    for (const [qid, value] of Object.entries(row.scores)) {
      if (!qids.has(qid)) {
        error('unknown-question', '分数对应的计分题不存在。', row, qid);
      } else if (value !== null && cents(value) > cents(exam.questions.find(q => q.id === qid).maxScore)) {
        error('score-out-of-range', '逐题分数超过满分。', row, qid);
      }
    }
    if (row.totalScore !== null && cents(row.totalScore) > cents(exam.totalMax)) {
      error('total-out-of-range', '总分超过考试满分。', row);
    }
    if (row.status !== 'present' && (row.totalScore !== null || Object.values(row.scores).some(v => v !== null))) {
      error('attendance-score-conflict', '缺考和未录入不能带有分数。', row);
    }
    if (row.status === 'present' && row.totalScore === null) {
      issues.push(issue('warning', 'missing-total', '没有总分，这次不参与排名', {
        sourceRow: row.sourceRow ?? null,
        studentId: row.studentId
      }));
    }
    const known = exam.questions.filter(q => row.scores[q.id] !== null && row.scores[q.id] !== undefined);
    if (row.status === 'present' && known.length < exam.questions.length) {
      issues.push(issue('warning', 'missing-question-score', '部分题目缺分，统计只使用已知分数。', {
        sourceRow: row.sourceRow ?? null,
        studentId: row.studentId
      }));
    }
    const sum = known.reduce((s, q) => s + cents(row.scores[q.id]), 0),
      max = exam.questions.reduce((s, q) => s + cents(q.maxScore), 0);
    if (row.status === 'present' && known.length === exam.questions.length && max === cents(exam.totalMax) && row.totalScore !== null && sum !== cents(row.totalScore)) {
      issues.push(issue('warning', 'total-mismatch', '总分与逐题和不一致，保留校对总分用于排名。', {
        sourceRow: row.sourceRow ?? null,
        studentId: row.studentId
      }));
    }
  }
  if (exam.questions.reduce((s, q) => s + cents(q.maxScore), 0) !== cents(exam.totalMax)) {
    issues.push(issue('warning', 'partial-question-coverage', '计分题满分合计未覆盖整卷总分。'));
  }
  if (!exam.source.length) {
    issues.push(issue('warning', 'source-not-ready', '未上传原卷，看题时缺少证据。'));
  } else if (exam.source.some(s => s.renditionFileId === null) || exam.questions.some(q => !q.locations.length)) {
    issues.push(issue('warning', 'location-not-ready', '部分原题尚未定位，可从原卷回看。'));
  }
  if (!draft && issues.some(i => i.severity === 'error')) {
    fail('/rows');
  }
  return issues;
}
export function canonicalRow(exam, row, student) {
  return {
    studentId: student.id,
    studentSnapshot: {
      name: student.name,
      studentNumber: student.studentNumber
    },
    status: row.status,
    totalScore: row.totalScore,
    scores: Object.fromEntries(exam.questions.map(q => [q.id, row.scores[q.id] ?? null]))
  };
}
