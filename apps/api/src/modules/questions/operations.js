import { validateCopyQuestion, validateCreateQuestion, validateDerivativesQuery, validateQuestionsQuery, validateSetDeletion, validateUpdateQuestion } from '../questions/schema.js';
import { validateIdPath, validateNoQuery } from '../../workbench/schema.js';
import { uuidPattern } from '../../workbench/schema.js';
import { contractError, problems } from '../../workbench/problems.js';

export const routes = [['listQuestions', 'GET', '/items'], ['createQuestion', 'POST', '/items'], ['getQuestion', 'GET', '/items/:id'], ['updateQuestion', 'PUT', '/items/:id'], ['listDerivatives', 'GET', '/items/:id/copies'], ['copyQuestion', 'POST', '/items/:id/copies'], ['setQuestionDeletion', 'POST', '/items/:id/deletion']];

export function createQuestionsOperations({ service, mutations }) {
  return {
    listQuestions({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      const query = { ...args.query };
      if (typeof query.starred === 'boolean') query.starred = String(query.starred);
      validateQuestionsQuery(query);
      return { status: 200, body: service.listQuestions(principal, query) };
    },
    createQuestion({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateCreateQuestion(args.body);
      const checkedKey = typeof key === 'function' ? key() : key;
      if (!uuidPattern.test(checkedKey ?? '')) throw contractError(problems.invalidInput('/headers/Idempotency-Key', checkedKey ? 'invalid-type' : 'required'));
      return mutations.execute({ principal, key: checkedKey, method: 'POST', path: `/api/modules/questions/items`, body: args.body }, () => ({ status: 201, body: service.createQuestion(principal, args.body) }));
    },
    getQuestion({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateIdPath(args.id, '/path/id');
      return { status: 200, body: service.getQuestion(principal, args.id) };
    },
    updateQuestion({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateIdPath(args.id, '/path/id');
      validateUpdateQuestion(args.body);
      const checkedKey = typeof key === 'function' ? key() : key;
      if (!uuidPattern.test(checkedKey ?? '')) throw contractError(problems.invalidInput('/headers/Idempotency-Key', checkedKey ? 'invalid-type' : 'required'));
      return mutations.execute({ principal, key: checkedKey, method: 'PUT', path: `/api/modules/questions/items/${args.id}`, body: args.body }, () => ({ status: 200, body: service.updateQuestion(principal, args.id, args.body) }));
    },
    listDerivatives({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateIdPath(args.id, '/path/id');
      validateDerivativesQuery(args.query ?? {});
      return { status: 200, body: service.listDerivatives(principal, args.id, args.query ?? {}) };
    },
    copyQuestion({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateIdPath(args.id, '/path/id');
      validateCopyQuestion(args.body);
      const checkedKey = typeof key === 'function' ? key() : key;
      if (!uuidPattern.test(checkedKey ?? '')) throw contractError(problems.invalidInput('/headers/Idempotency-Key', checkedKey ? 'invalid-type' : 'required'));
      return mutations.execute({ principal, key: checkedKey, method: 'POST', path: `/api/modules/questions/items/${args.id}/copies`, body: args.body }, () => ({ status: 201, body: service.copyQuestion(principal, args.id, args.body) }));
    },
    setQuestionDeletion({ principal, arguments: args, key }) {
      if (!principal?.accountKey) throw contractError(problems.unauthenticated());
      validateIdPath(args.id, '/path/id');
      validateSetDeletion(args.body);
      const checkedKey = typeof key === 'function' ? key() : key;
      if (!uuidPattern.test(checkedKey ?? '')) throw contractError(problems.invalidInput('/headers/Idempotency-Key', checkedKey ? 'invalid-type' : 'required'));
      return mutations.execute({ principal, key: checkedKey, method: 'POST', path: `/api/modules/questions/items/${args.id}/deletion`, body: args.body }, () => ({ status: 200, body: service.setQuestionDeletion(principal, args.id, args.body) }));
    },
  };
}
