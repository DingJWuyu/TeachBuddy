import { account, required } from './records.js';

import { cents } from './scores.js';
const score = value => value / 100;
const known = value => typeof value === 'number' && Number.isFinite(value);
const active = value => !value.deletedAt;
const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;
const versionOf = value => ({ id: value.id, version: value.version });
const classInfo = value => ({ id: value.id, name: value.name, version: value.version, deletedAt: value.deletedAt });
const examInfo = exam => ({ id: exam.id, name: exam.name, subject: exam.subject,
  occurredOn: exam.occurredOn, totalMax: exam.totalMax, version: exam.version, source: exam.source });

function rankedRows(rows) {
  const ordered = rows.filter(row => row.status === 'present' && known(row.totalScore))
    .sort((a, b) => cents(b.totalScore) - cents(a.totalScore));
  const ranks = new Map();
  let rank = 0;
  ordered.forEach((row, index) => {
    if (!index || cents(row.totalScore) !== cents(ordered[index - 1].totalScore)) rank = index + 1;
    ranks.set(row.studentId, rank);
  });
  return { ordered, ranks };
}

function overall(exam, rows) {
  const { ordered } = rankedRows(rows);
  const totals = ordered.map(row => cents(row.totalScore));
  const sum = totals.reduce((a, b) => a + b, 0);
  const count = totals.length;
  const median = !count ? null : count % 2 ? score(totals[(count - 1) / 2])
    : score((totals[count / 2 - 1] + totals[count / 2]) / 2);
  const distribution = Array.from({ length: 10 }, (_, index) => ({
    from: index / 10, to: (index + 1) / 10, upperInclusive: index === 9, count: 0, studentIds: []
  }));
  for (const row of ordered) {
    const index = Math.min(9, Math.floor(cents(row.totalScore) * 10 / cents(exam.totalMax)));
    distribution[index].count++;
    distribution[index].studentIds.push(row.studentId);
  }
  const presentCount = rows.filter(row => row.status === 'present').length;
  return { rosterCount: rows.length, presentCount,
    absentCount: rows.filter(row => row.status === 'absent').length,
    unrecordedCount: rows.filter(row => row.status === 'unrecorded').length,
    missingTotalCount: presentCount - count, scoredCount: count, rankedCount: count,
    scoreSum: score(sum), maxSum: score(count * cents(exam.totalMax)),
    mean: count ? score(sum / count) : null, median,
    min: count ? score(totals[count - 1]) : null, max: count ? score(totals[0]) : null,
    rate: ratio(sum, count * cents(exam.totalMax)), distribution };
}

function evidence(questions, rows) {
  const present = rows.filter(row => row.status === 'present');
  let sum = 0;
  let max = 0;
  let observed = 0;
  for (const row of present) {
    for (const question of questions) {
      if (!known(row.scores[question.id])) continue;
      sum += cents(row.scores[question.id]);
      max += cents(question.maxScore);
      observed++;
    }
  }
  const eligible = present.length * questions.length;
  const possibleMax = present.length * questions.reduce((sum, question) => sum + cents(question.maxScore), 0);
  return { questionIds: questions.map(question => question.id), questionCount: questions.length,
    scoreSum: score(sum), maxSum: score(max),
    possibleMax: score(possibleMax),
    observedCells: observed, eligibleCells: eligible, missingCount: eligible - observed,
    absentCount: rows.filter(row => row.status === 'absent').length,
    unrecordedCount: rows.filter(row => row.status === 'unrecorded').length,
    coverage: ratio(observed, eligible), rate: ratio(sum, max),
    reason: !questions.length ? 'not-assessed' : !observed ? 'missing-scores' : null };
}

function details(exam, rows, tags, tagIds) {
  const questions = exam.questions.map(question => {
    const values = evidence([question], rows);
    return { ...question, ...values, observedCount: values.observedCells,
      eligibleCount: values.eligibleCells,
      mean: values.observedCells ? values.scoreSum / values.observedCells : null };
  });
  const relevantIds = [...new Set([...exam.questions.flatMap(question => question.tagIds), ...(tagIds ?? [])])];
  const summaries = relevantIds.map(id => ({ id, name: tags.get(id)?.name ?? null,
    version: tags.get(id)?.version ?? null,
    ...evidence(exam.questions.filter(question => question.tagIds.includes(id)), rows) }));
  const selected = tagIds?.length ? exam.questions.filter(question => question.tagIds.some(id => tagIds.includes(id)))
    : exam.questions;
  return { questions, tags: summaries, tagSelection: { tagIds: tagIds ?? [], ...evidence(selected, rows) } };
}

function rowEvidence(exam, row) {
  const values = evidence(exam.questions, [row]);
  const complete = row.status === 'present' && values.observedCells === exam.questions.length
    && cents(values.possibleMax) === cents(exam.totalMax);
  return { sumOfKnownScores: values.scoreSum, knownQuestionCount: values.observedCells,
    totalMismatch: complete && known(row.totalScore) && cents(row.totalScore) !== cents(values.scoreSum) };
}

function studentOverall(exam, result, row, klass) {
  const { ordered, ranks } = rankedRows(result.rows);
  return { status: row.status, totalScore: row.totalScore,
    rate: row.status === 'present' && known(row.totalScore) ? ratio(cents(row.totalScore), cents(exam.totalMax)) : null,
    rank: ranks.get(row.studentId) ?? null, rankedCount: ordered.length,
    ...rowEvidence(exam, row),
    studentSnapshot: row.studentSnapshot,
    classReference: { ...classInfo(klass), overall: overall(exam, result.rows) } };
}

export function createClassroomStatistics({ repository }) {
  function facts(principal, filters = {}) {
    const accountKey = account(principal);
    if (filters.examId) required(repository, 'exams', principal, filters.examId);
    for (const id of filters.tagIds ?? []) required(repository, 'tags', principal, id);
    const matchingExams = repository.list('exams', accountKey).filter(active)
      .filter(exam => !filters.examId || exam.id === filters.examId)
      .filter(exam => !filters.from || exam.occurredOn >= filters.from)
      .filter(exam => !filters.to || exam.occurredOn <= filters.to);
    const exams = new Map(matchingExams.map(exam => [exam.id, exam]));
    const results = repository.list('results', accountKey).filter(active)
      .filter(result => exams.has(result.examId));
    const tags = new Map(repository.list('tags', accountKey).map(tag => [tag.id, tag]));
    return { exams, results, tags };
  }
  function versions(points, tags, tagIds = []) {
    const exams = new Map();
    const results = new Map();
    const usedTags = new Set(tagIds);
    for (const point of points) {
      exams.set(point.exam.id, { id: point.exam.id, version: point.exam.version });
      results.set(point.resultId, { id: point.resultId, version: point.resultVersion });
      for (const question of point.questions) {
        for (const id of question.tagIds) usedTags.add(id);
      }
    }
    return { exam: [...exams.values()], results: [...results.values()],
      tags: [...usedTags].map(id => tags.get(id)).filter(Boolean).map(versionOf) };
  }
  const orderedPoints = points => points.sort((a, b) => a.exam.occurredOn.localeCompare(b.exam.occurredOn)
    || a.exam.id.localeCompare(b.exam.id) || a.resultId.localeCompare(b.resultId));
  function classPoint(exam, result, tags, tagIds) {
    const scoreEvidence = result.rows.map(row => ({ studentId: row.studentId, ...rowEvidence(exam, row) }));
    return { exam: examInfo(exam), resultId: result.id, resultVersion: result.version,
      examVersionAtConfirmation: result.examVersionAtConfirmation,
      overall: overall(exam, result.rows), scoreEvidence,
      warnings: scoreEvidence.filter(row => row.totalMismatch).map(row => ({ code: 'total-mismatch', studentId: row.studentId })),
      ...details(exam, result.rows, tags, tagIds) };
  }
  return {
    studentStatistics(principal, studentId, filters = {}) {
      const student = required(repository, 'students', principal, studentId);
      const { exams, results, tags } = facts(principal, filters);
      const points = [];
      for (const result of results) {
        const row = result.rows.find(row => row.studentId === studentId);
        if (!row) continue;
        const exam = exams.get(result.examId);
        const klass = required(repository, 'classes', principal, result.classId);
        points.push({ exam: examInfo(exam), resultId: result.id, resultVersion: result.version,
          examVersionAtConfirmation: result.examVersionAtConfirmation,
          overall: studentOverall(exam, result, row, klass), ...details(exam, [row], tags, filters.tagIds) });
      }
      return { scope: { type: 'student', studentId, name: student.name, version: student.version, deletedAt: student.deletedAt },
        points: orderedPoints(points), dataVersions: versions(points, tags, filters.tagIds) };
    },
    classStatistics(principal, classId, filters = {}) {
      const klass = required(repository, 'classes', principal, classId);
      const { exams, results, tags } = facts(principal, filters);
      const points = orderedPoints(results.filter(result => result.classId === classId)
        .map(result => classPoint(exams.get(result.examId), result, tags, filters.tagIds)));
      return { scope: { type: 'class', ...classInfo(klass) }, points,
        dataVersions: versions(points, tags, filters.tagIds) };
    },
    compareExam(principal, examId, { classIds, tagIds } = {}) {
      const exam = required(repository, 'exams', principal, examId);
      const { results, tags } = facts(principal, { examId, tagIds });
      const classes = classIds.map(id => {
        const klass = required(repository, 'classes', principal, id);
        const result = results.find(result => result.classId === id);
        return { class: classInfo(klass), state: result ? 'recorded' : 'no-result',
          point: result ? classPoint(exam, result, tags, tagIds) : null };
      });
      const dataVersions = versions(classes.map(value => value.point).filter(Boolean), tags, tagIds);
      dataVersions.exam = [versionOf(exam)];
      return { scope: { type: 'comparison', examId, classIds }, exam: examInfo(exam), classes, dataVersions };
    }
  };
}
