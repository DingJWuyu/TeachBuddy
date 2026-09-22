import { validateCreateLesson, validateLessonsQuery, validateSetDeletion, validateUpdateLesson } from '../questions/schema.js';
import { validateIdPath, validateNoQuery } from '../../workbench/schema.js';
import { uuidPattern } from '../../workbench/schema.js';
import { contractError, problems } from '../../workbench/problems.js';

export const routes = [['listLessons', 'GET', '/items'], ['createLesson', 'POST', '/items'], ['getLesson', 'GET', '/items/:id'], ['updateLesson', 'PUT', '/items/:id'], ['setLessonDeletion', 'POST', '/items/:id/deletion'], ['listQuestionUsages', 'GET', '/question-usages/:questionId']];

export function createLessonsOperations({ service, mutations }) {
  return {
    listLessons({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateLessonsQuery(args.query ?? {});
      return { status: 200, body: service.listLessons(principal, args.query ?? {}) };
    },
    createLesson({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateCreateLesson(args.body);
      const checkedKey = typeof key === 'function' ? key() : key;
      if (!uuidPattern.test(checkedKey ?? '')) throw contractError(problems.invalidInput('/headers/Idempotency-Key', checkedKey ? 'invalid-type' : 'required'));
      return mutations.execute({ principal, key: checkedKey, method: 'POST', path: `/api/modules/lessons/items`, body: args.body }, () => ({ status: 201, body: service.createLesson(principal, args.body) }));
    },
    getLesson({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateIdPath(args.id, '/path/id');
      return { status: 200, body: service.getLesson(principal, args.id) };
    },
    updateLesson({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateIdPath(args.id, '/path/id');
      validateUpdateLesson(args.body);
      const checkedKey = typeof key === 'function' ? key() : key;
      if (!uuidPattern.test(checkedKey ?? '')) throw contractError(problems.invalidInput('/headers/Idempotency-Key', checkedKey ? 'invalid-type' : 'required'));
      return mutations.execute({ principal, key: checkedKey, method: 'PUT', path: `/api/modules/lessons/items/${args.id}`, body: args.body }, () => ({ status: 200, body: service.updateLesson(principal, args.id, args.body) }));
    },
    setLessonDeletion({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateIdPath(args.id, '/path/id');
      validateSetDeletion(args.body);
      const checkedKey = typeof key === 'function' ? key() : key;
      if (!uuidPattern.test(checkedKey ?? '')) throw contractError(problems.invalidInput('/headers/Idempotency-Key', checkedKey ? 'invalid-type' : 'required'));
      return mutations.execute({ principal, key: checkedKey, method: 'POST', path: `/api/modules/lessons/items/${args.id}/deletion`, body: args.body }, () => ({ status: 200, body: service.setLessonDeletion(principal, args.id, args.body) }));
    },
    listQuestionUsages({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateIdPath(args.questionId, '/path/questionId');
      return { status: 200, body: service.listQuestionUsages(principal, args.questionId) };
    },
  };
}
