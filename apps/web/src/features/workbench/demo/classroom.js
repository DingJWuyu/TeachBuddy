import data from './classroom-data.json';

const C = '/api/modules/classroom';
const scores = [
  [0, 0, new URL('./assets/scores-0.xlsx', import.meta.url)],
  [0, 1, new URL('./assets/scores-1.xlsx', import.meta.url)],
  [0, 2, new URL('./assets/scores-2.xlsx', import.meta.url)],
  [1, 0, new URL('./assets/scores-3.xlsx', import.meta.url)],
  [1, 1, new URL('./assets/scores-4.xlsx', import.meta.url)],
];
async function upload(job, step, url, name, type) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Sample asset unavailable');
  const fd = new FormData(); fd.append('file', new File([await response.blob()], name, { type }));
  return job.write(step, 'POST', '/api/workbench/files', fd);
}
export async function seedClassroom(job) {
  const tags = new Map();
  const existing = (await job.get(`${C}/tags`)).items;
  for (const tag of data.tags) {
    const saved = existing.find(item => item.name === tag.name) ?? await job.write(`classroom:tag:${tag.id}`, 'POST', `${C}/tags`, { name: tag.name });
    tags.set(tag.id, saved.id);
  }
  const exams = [];
  for (const [index, exam] of data.exams.entries()) {
    exams.push(await job.write(`classroom:exam:${index}`, 'POST', `${C}/exams`, {
      name: exam.name, subject: exam.subject, occurredOn: exam.date, totalMax: exam.fullScore,
      source: [],
      questions: exam.questions.map(q => ({ label: q.label, groupLabel: q.group || null, maxScore: q.fullScore, tagIds: q.tagIds.map(id => tags.get(id)), locations: [] })),
    }));
  }
  const identities = new Map();
  const classes = [];
  for (const [index, cls] of data.classes.entries()) {
    const saved = await job.write(`classroom:class:${index}`, 'POST', `${C}/classes`, { name: cls.name, term: cls.term });
    identities.set(cls.id, saved.id); classes.push(saved);
    for (const [studentIndex, student] of cls.students.entries()) {
      const person = await job.write(`classroom:student:${index}:${studentIndex}`, 'POST', `${C}/students`, {
        classId: saved.id, name: student.name, studentNumber: student.studentNo, birthday: student.birthday,
        interests: student.interests, description: student.personality,
      });
      identities.set(student.id, person.id);
    }
    const fresh = await job.get(`${C}/classes/${saved.id}`);
    await job.write(`classroom:seating:${index}`, 'PUT', `${C}/classes/${saved.id}/seating`, {
      baseVersion: fresh.version, seating: { rows: cls.seating.rows, columns: cls.seating.cols, seats: cls.seating.seats.map(seat => ({ row: seat.row + 1, column: seat.col + 1, studentId: identities.get(seat.studentId) })) },
    });
  }
  for (const [index, [classIndex, examIndex, url]] of scores.entries()) {
    const exam = exams[examIndex], cls = classes[classIndex];
    const file = await upload(job, `classroom:scores-file:${index}`, url, `${data.classes[classIndex].name}${data.exams[examIndex].name}成绩.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const created = await job.write(`classroom:import:${index}`, 'POST', `${C}/imports`, { classId: cls.id, examId: exam.id, sourceFileId: file.id });
    const draft = await job.get(`${C}/imports/${created.id}`);
    if (draft.state === 'confirmed') continue;
    const n = exam.questions.length;
    await job.write(`classroom:mapping:${index}`, 'PUT', `${C}/imports/${created.id}`, {
      baseVersion: draft.version,
      mapping: { sheetIndex: 0, headerRow: 1, firstDataRow: 2, lastDataRow: data.classes[classIndex].students.length + 1, studentNumberColumn: 1, nameColumn: 2, totalColumn: n + 3, attendanceColumn: n + 4,
        questionColumns: exam.questions.map((q, i) => ({ questionId: q.id, column: i + 3 })), ignoredRows: [] }, rows: null,
    });
    const review = await job.get(`${C}/imports/${created.id}`);
    const checked = await job.write(`classroom:review:${index}`, 'PUT', `${C}/imports/${created.id}`, {
      baseVersion: review.version, mapping: review.mapping,
      rows: review.rows.map(row => ({ sourceRow: row.sourceRow, studentId: row.studentId, status: row.status, totalScore: row.totalScore, scores: row.scores, ignored: row.ignored })),
    });
    await job.write(`classroom:confirm:${index}`, 'POST', `${C}/imports/${created.id}/confirmation`, { baseVersion: checked.version });
  }
  for (const [index, record] of data.records.entries()) {
    const saved = await job.write(`classroom:record:${index}`, 'POST', `${C}/records`, {
      scope: record.subject.kind, subjectId: identities.get(record.subject.id), occurredOn: record.date, text: record.body,
    });
    if (record.archived) await job.write(`classroom:record-archive:${index}`, 'PUT', `${C}/records/${saved.id}/deletion`, { baseVersion: saved.version, deleted: true });
  }
}
