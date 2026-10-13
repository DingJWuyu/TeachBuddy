import { uuidPattern, validateIdPath } from '../../workbench/schema.js';
import { invalidInput } from '../../workbench/problems.js';
import { account } from './problems.js';
import { validateWrite, query, fail } from './schema.js';
const names = {
  classes: ['Classes', 'Class'],
  students: ['Students', 'Student'],
  records: ['Records', 'Record'],
  exams: ['Exams', 'Exam'],
  tags: ['Tags', 'Tag'],
  imports: ['Imports', 'Import'],
  results: ['Results', 'Result']
};
export const routes = [];
for (const kind of ['classes', 'students', 'records', 'exams', 'tags', 'imports', 'results']) {
  const [plural, singular] = names[kind];
  routes.push([`list${plural}`, 'GET', `/${kind}`, kind, 'list'], [`get${singular}`, 'GET', `/${kind}/:id`, kind, 'get']);
  if (!['results'].includes(kind)) {
    routes.push([`create${singular}`, 'POST', `/${kind}`, kind, 'create']);
  }
  routes.push([`update${singular}`, 'PUT', `/${kind}/:id`, kind, 'update']);
  if (kind !== 'tags') {
    routes.push([`set${singular}Deletion`, 'PUT', `/${kind}/:id/deletion`, kind, 'deletion']);
  }
}
routes.push(['setSeating', 'PUT', '/classes/:id/seating', 'classes', 'seating'], ['mergeTags', 'POST', '/tags/:id/merge', 'tags', 'merge'], ['confirmImport', 'POST', '/imports/:id/confirmation', 'imports', 'confirmation'], ['studentStatistics', 'GET', '/students/:id/statistics', 'students', 'statistics'], ['classStatistics', 'GET', '/classes/:id/statistics', 'classes', 'statistics'], ['compareExam', 'GET', '/exams/:id/comparison', 'exams', 'comparison']);
const listQueries = {
  classes: ['deleted', 'q'],
  students: ['classId', 'deleted', 'q'],
  records: ['scope', 'subjectId', 'from', 'to', 'q', 'deleted'],
  exams: ['from', 'to', 'q', 'deleted'],
  tags: ['q'],
  imports: ['examId', 'classId', 'state', 'deleted'],
  results: ['examId', 'classId', 'deleted']
};
export function createClassroomOperations({
  roster,
  assessment,
  imports,
  tags,
  statistics,
  mutations
}) {
  const operations = {};
  for (const [name, method, path, kind, action] of routes) {
    operations[name] = async ({
      principal,
      arguments: args = {},
      requestPath,
      key
    }) => {
      account(principal);
      if (args.id !== undefined) {
        validateIdPath(args.id);
      }
      const q = args.query ?? {};
      let allowedQuery = [];
      if (action === 'list') {
        allowedQuery = listQueries[kind];
      }
      if (action === 'statistics') {
        allowedQuery = ['from', 'to', 'examId', 'tagIds'];
      }
      if (action === 'comparison') {
        allowedQuery = ['classIds', 'tagIds'];
      }
      query(q, allowedQuery);
      if (action === 'list') {
        if (kind === 'students' && !q.classId) {
          fail('/query/classId', 'required');
        }
        if (kind === 'records') {
          if (!q.scope) {
            fail('/query/scope', 'required');
          }
          if (!q.subjectId) {
            fail('/query/subjectId', 'required');
          }
        }
        if (kind === 'results' && !q.examId && !q.classId) {
          fail('/query/examId', 'required');
        }
        let body;
        if (['classes', 'students', 'records'].includes(kind)) {
          body = roster.list(kind, principal, q);
        } else if (kind === 'tags') {
          body = tags.list(principal, q);
        } else if (kind === 'imports') {
          body = imports.list(principal, q);
        } else {
          body = assessment.list(kind, principal, q);
        }
        return {
          status: 200,
          body
        };
      }
      if (action === 'get') {
        let body;
        if (['classes', 'students', 'records'].includes(kind)) {
          body = roster.get(kind, principal, args.id);
        } else if (kind === 'imports') {
          body = imports.get(principal, args.id);
        } else {
          body = assessment.get(kind, principal, args.id);
        }
        return {
          status: 200,
          body
        };
      }
      if (action === 'statistics' || action === 'comparison') {
        const filters = {
          ...q
        };
        for (const field of ['tagIds', 'classIds']) {
          if (q[field] !== undefined) {
            filters[field] = q[field].split(',');
          }
        }
        if (action === 'comparison' && !filters.classIds) {
          fail('/query/classIds', 'required');
        }
        let body;
        if (action === 'comparison') {
          body = statistics.compareExam(principal, args.id, filters);
        } else if (kind === 'students') {
          body = statistics.studentStatistics(principal, args.id, filters);
        } else {
          body = statistics.classStatistics(principal, args.id, filters);
        }
        return {
          status: 200,
          body
        };
      }
      validateWrite(kind, action, args.body);
      const checkedKey = typeof key === 'function' ? key() : key;
      if (!uuidPattern.test(checkedKey ?? '')) {
        throw invalidInput('/headers/Idempotency-Key', checkedKey ? 'invalid-type' : 'required');
      }
      const mutation = {
        principal,
        key: checkedKey,
        method,
        path: requestPath ?? '/api/modules/classroom' + path.replace(':id', args.id),
        body: args.body
      };
      let prepared;
      if (kind === 'imports' && action === 'create') {
        const replay = mutations.peek(mutation);
        if (replay) {
          return replay;
        }
        prepared = await imports.prepareImport(principal, args.body);
      }
      return mutations.execute(mutation, () => {
        let body;
        if (action === 'seating') {
          body = roster.setSeating(principal, args.id, args.body);
        } else if (action === 'merge') {
          body = tags.merge(principal, args.id, args.body);
        } else if (action === 'confirmation') {
          body = assessment.confirmImport(principal, args.id, args.body);
        } else if (['classes', 'students', 'records'].includes(kind)) {
          if (action === 'create') {
            body = roster.create(kind, principal, args.body);
          } else if (action === 'update') {
            body = roster.update(kind, principal, args.id, args.body);
          } else {
            body = roster.deletion(kind, principal, args.id, args.body);
          }
        } else if (kind === 'tags') {
          if (action === 'create') {
            body = tags.create(principal, args.body);
          } else {
            body = tags.update(principal, args.id, args.body);
          }
        } else if (kind === 'imports') {
          if (action === 'create') {
            body = imports.createImport(principal, prepared);
          } else if (action === 'update') {
            body = imports.updateImport(principal, args.id, args.body);
          } else {
            body = imports.deletion(principal, args.id, args.body);
          }
        } else if (action === 'deletion') {
          body = assessment.deletion(kind, principal, args.id, args.body);
        } else if (kind === 'exams') {
          if (action === 'create') {
            body = assessment.createExam(principal, args.body);
          } else {
            body = assessment.updateExam(principal, args.id, args.body);
          }
        } else {
          body = assessment.updateResult(principal, args.id, args.body);
        }
        return {
          status: action === 'create' ? 201 : 200,
          body
        };
      });
    };
  }
  return operations;
}
