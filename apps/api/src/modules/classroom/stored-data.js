import { kinds, createClassroomRepository } from './repository.js';
import { validateWrite, id, integer, object, mapping, rows, text, array, enumValue } from './schema.js';
import { normalizeTag } from './tags.js';
import { validateScores } from './scores.js';
import { validateExamFiles } from './assessment.js';
const fields = {
  classes: ['name', 'term', 'seating'],
  students: ['classId', 'name', 'studentNumber', 'birthday', 'interests', 'description'],
  records: ['scope', 'subjectId', 'occurredOn', 'text'],
  exams: ['name', 'subject', 'occurredOn', 'totalMax', 'source', 'questions'],
  tags: ['name']
};
export function validateStoredData(db, {
  readFile,
  readRendition
}) {
  const repository = createClassroomRepository(db);
  const accounts = new Set(kinds.flatMap(kind => db.prepare(`SELECT DISTINCT accountKey FROM classroom_${kind}`).all().map(row => row.accountKey)));
  for (const accountKey of accounts) {
    const principal = {
        accountKey
      },
      data = Object.fromEntries(kinds.map(kind => [kind, repository.list(kind, accountKey)]));
    const find = (kind, value) => {
      const found = data[kind].find(v => v.id === value);
      if (!found) {
        throw new Error(`Invalid classroom ${kind} reference`);
      }
      return found;
    };
    const fixedFiles = {
      read: readFile,
      readRendition
    };
    for (const kind of kinds) {
      for (const value of data[kind]) {
        id(value.id, '/id');
        integer(value.version, '/version');
        for (const f of ['createdAt', 'updatedAt']) {
          if (typeof value[f] !== 'string' || !Number.isFinite(Date.parse(value[f]))) {
            throw new Error('Invalid classroom timestamp');
          }
        }
        if (value.deletedAt !== null && !Number.isFinite(Date.parse(value.deletedAt))) {
          throw new Error('Invalid classroom deletion');
        }
        const stored = db.prepare(`SELECT * FROM classroom_${kind} WHERE accountKey=? AND id=?`).get(accountKey, value.id);
        for (const [column, entry] of Object.entries(stored)) {
          if (['accountKey', 'id', 'version', 'value'].includes(column)) {
            continue;
          }
          if ((value[column] ?? null) !== entry) {
            throw new Error('Invalid classroom query projection');
          }
        }
        const extraFields = {
          results: ['examId', 'classId', 'rows', 'provenance', 'examVersionAtConfirmation'],
          imports: ['examId', 'classId', 'sourceFileId', 'sourceSha256', 'state', 'workbook', 'mapping', 'rows', 'issues', 'baselines', 'confirmedResultId', 'reviewedSourceRows'],
          tags: ['normalizedName', 'mergedIntoId']
        };
        const valueFields = ['id', 'version', 'createdAt', 'updatedAt', 'deletedAt', ...(fields[kind] ?? []), ...(extraFields[kind] ?? [])];
        object(value, valueFields, valueFields.filter(f => f !== 'reviewedSourceRows'));
        if (stored.version !== value.version) {
          throw new Error('Invalid classroom version');
        }
        if (fields[kind]) {
          const body = Object.fromEntries(fields[kind].map(f => [f, value[f]]));
          if (kind === 'exams') {
            body.questions = body.questions.map(q => {
              id(q.id, '/questions/id');
              const {
                id: qid,
                ...content
              } = q;
              return content;
            });
          }
          validateWrite(kind, 'create', body);
        }
        if (kind === 'classes') {
          const coords = new Set(),
            students = new Set();
          for (const s of value.seating.seats) {
            const student = find('students', s.studentId);
            if (student.classId !== value.id || student.deletedAt || coords.has(`${s.row}:${s.column}`) || students.has(s.studentId)) {
              throw new Error('Invalid classroom seat');
            }
            coords.add(`${s.row}:${s.column}`);
            students.add(s.studentId);
          }
        }
        if (kind === 'students') {
          find('classes', value.classId);
        }
        if (kind === 'records') {
          find(value.scope === 'class' ? 'classes' : 'students', value.subjectId);
        }
        if (kind === 'tags') {
          if (value.normalizedName !== normalizeTag(value.name)) {
            throw new Error('Invalid classroom tag name');
          }
          if (value.mergedIntoId) {
            const target = find('tags', value.mergedIntoId);
            if (target.mergedIntoId || target.id === value.id) {
              throw new Error('Invalid classroom merged tag');
            }
          }
        }
        if (kind === 'exams') {
          if (new Set(value.questions.map(q => q.id)).size !== value.questions.length) {
            throw new Error('Invalid classroom question IDs');
          }
          for (const q of value.questions) {
            if (new Set(q.tagIds).size !== q.tagIds.length) {
              throw new Error('Invalid classroom duplicate tags');
            }
            for (const tagId of q.tagIds) {
              if (find('tags', tagId).mergedIntoId) {
                throw new Error('Invalid classroom merged tag reference');
              }
            }
          }
          validateExamFiles(fixedFiles, principal, value);
        }
        if (kind === 'results') {
          const exam = find('exams', value.examId);
          find('classes', value.classId);
          integer(value.examVersionAtConfirmation, '/examVersionAtConfirmation');
          const canonical = value.rows.map(row => {
            find('students', row.studentId);
            object(row.studentSnapshot, ['name', 'studentNumber']);
            text(row.studentSnapshot.name, '/studentSnapshot/name', 120, true);
            if (row.studentSnapshot.studentNumber !== null) {
              text(row.studentSnapshot.studentNumber, '/studentSnapshot/studentNumber', 80);
            }
            const {
              studentSnapshot,
              ...content
            } = row;
            return content;
          });
          rows(canonical);
          validateScores(exam, canonical);
          object(value.provenance, ['importId', 'sourceFileId', 'correctedAt'], ['importId', 'sourceFileId']);
          if (value.examVersionAtConfirmation > exam.version) {
            throw new Error('Invalid classroom confirmation version');
          }
          if (value.provenance.importId) {
            find('imports', value.provenance.importId);
          }
          if (value.provenance.sourceFileId) {
            readFile(principal, value.provenance.sourceFileId);
          }
        }
        if (kind === 'imports') {
          find('exams', value.examId);
          find('classes', value.classId);
          if (!['draft', 'confirmed'].includes(value.state)) {
            throw new Error('Invalid classroom import state');
          }
          const file = readFile(principal, value.sourceFileId);
          if (file.sha256 !== value.sourceSha256) {
            throw new Error('Invalid classroom import source');
          }
          mapping(value.mapping);
          rows(value.rows, true);
          validateImportEvidence(value, find);
          if (value.state === 'confirmed' && value.deletedAt) {
            throw new Error('Invalid classroom deleted import evidence');
          }
          if (value.confirmedResultId) {
            const result = find('results', value.confirmedResultId);
            if (value.state !== 'confirmed' || result.examId !== value.examId || result.classId !== value.classId) {
              throw new Error('Invalid classroom import result');
            }
          } else if (value.state === 'confirmed') {
            throw new Error('Invalid classroom confirmed import');
          }
        }
      }
    }
  }
  return true;
}
function validateImportEvidence(value, find) {
  for (const row of value.rows) {
    if (row.studentId !== null) {
      find('students', row.studentId);
    }
  }
  const reviewedRows = array(value.reviewedSourceRows ?? [], '/reviewedSourceRows', 1000);
  reviewedRows.forEach(row => integer(row, '/reviewedSourceRows', 1, 2000));
  if (new Set(reviewedRows).size !== reviewedRows.length || reviewedRows.some(number => !value.mapping || number < value.mapping.firstDataRow || number > value.mapping.lastDataRow || !value.rows.some(row => row.sourceRow === number && !row.ignored))) {
    throw new Error('Invalid classroom reviewed source rows');
  }
  for (const issue of array(value.issues, '/issues')) {
    object(issue, ['severity', 'code', 'sourceRow', 'column', 'studentId', 'questionId', 'message']);
    enumValue(issue.severity, ['error', 'warning'], '/issues/severity');
    text(issue.code, '/issues/code', 120, true);
    text(issue.message, '/issues/message', 2000);
    if (issue.sourceRow !== null) {
      integer(issue.sourceRow, '/issues/sourceRow', 1, 2000);
    }
    if (issue.column !== null) {
      integer(issue.column, '/issues/column', 1, 256);
    }
    if (issue.studentId !== null) {
      id(issue.studentId, '/issues/studentId');
      find('students', issue.studentId);
    }
    if (issue.questionId !== null) {
      id(issue.questionId, '/issues/questionId');
    }
  }
  object(value.baselines, ['examVersion', 'classVersion', 'resultVersion', 'students']);
  integer(value.baselines.examVersion, '/baselines/examVersion');
  integer(value.baselines.classVersion, '/baselines/classVersion');
  if (value.baselines.resultVersion !== null) {
    integer(value.baselines.resultVersion, '/baselines/resultVersion');
  }
  for (const student of array(value.baselines.students, '/baselines/students', 1000)) {
    object(student, ['id', 'version']);
    find('students', student.id);
    integer(student.version, '/baselines/students/version');
  }
  object(value.workbook, ['format', 'sheets']);
  enumValue(value.workbook.format, ['xlsx', 'xls'], '/workbook/format');
  for (const sheet of array(value.workbook.sheets, '/workbook/sheets', 20)) {
    object(sheet, ['name', 'range', 'merges', 'rows', 'issues']);
    text(sheet.name, '/workbook/sheets/name', 255, true);
    if (sheet.range !== null) {
      text(sheet.range, '/workbook/sheets/range', 80);
    }
    for (const merge of array(sheet.merges, '/workbook/merges', 100000)) {
      object(merge, ['start', 'end']);
      for (const position of [merge.start, merge.end]) {
        object(position, ['row', 'column']);
        integer(position.row, '/workbook/merge/row', 1, 2000);
        integer(position.column, '/workbook/merge/column', 1, 256);
      }
      if (merge.start.row > merge.end.row || merge.start.column > merge.end.column) {
        throw new Error('Invalid classroom workbook merge');
      }
    }
    for (const issue of array(sheet.issues, '/workbook/issues', 100000)) {
      object(issue, ['code', 'sheet', 'row', 'column', 'address', 'detail']);
      text(issue.code, '/workbook/issues/code', 120, true);
      if (issue.sheet !== sheet.name) {
        throw new Error('Invalid classroom workbook issue sheet');
      }
      integer(issue.row, '/workbook/issues/row', 1, 2000);
      integer(issue.column, '/workbook/issues/column', 1, 256);
      text(issue.address, '/workbook/issues/address', 80, true);
      text(issue.detail, '/workbook/issues/detail', 2000);
    }
    for (const row of array(sheet.rows, '/workbook/sheets/rows', 2000)) {
      object(row, ['rowNumber', 'cells']);
      integer(row.rowNumber, '/workbook/rowNumber', 1, 2000);
      for (const cell of array(row.cells, '/workbook/cells', 256)) {
        object(cell, ['address', 'column', 'type', 'value', 'display', 'formula']);
        text(cell.address, '/workbook/address', 80, true);
        integer(cell.column, '/workbook/column', 1, 256);
        enumValue(cell.type, ['number', 'string', 'boolean', 'error', 'blank'], '/workbook/type');
        if (cell.value !== null && !['number', 'string', 'boolean'].includes(typeof cell.value)) {
          throw new Error('Invalid classroom workbook value');
        }
        if (typeof cell.value === 'number' && !Number.isFinite(cell.value)) {
          throw new Error('Invalid classroom workbook number');
        }
        text(cell.display, '/workbook/display', 32767);
        if (cell.formula !== null) {
          text(cell.formula, '/workbook/formula', 32767);
        }
      }
    }
  }
}
