import { validateCreateQuestion, validateUpdateQuestion, validateCopyQuestion } from './schema.js';

// Preserve the accepted protocol's original mutation path and receipt. Reads
// may use the current representation when the frozen protocol cannot express it.
export function createQuestionBusinessOperations({ legacy, current }) {
  const names = {
    listQuestions: 'listQuestionsV2', getQuestion: 'getQuestionV2',
    createQuestion: 'createQuestionV2', updateQuestion: 'updateQuestionV2',
    copyQuestion: 'copyQuestionV2', setQuestionDeletion: 'setQuestionDeletionV2',
    listDerivatives: 'listQuestionCopiesForAgent',
  };
  const legacyBodies = { createQuestion: validateCreateQuestion, updateQuestion: validateUpdateQuestion, copyQuestion: validateCopyQuestion };
  const operations = Object.fromEntries(Object.entries(names).map(([name, target]) => [name, input => {
    let legacyInput = true;
    if (legacyBodies[name]) {
      try { legacyBodies[name](input.input); }
      catch (error) {
        if (error.problem?.type !== '/problems/workbench/invalid-input') throw error;
        legacyInput = false;
      }
    }
    if (legacyInput) {
      try { return legacy[name]({ principal: input.principal, key: input.key, arguments: { id: input.id, body: input.input, query: input.query } }); }
      catch (error) {
        if (error.problem?.reason !== 'unsupported-content-version') throw error;
      }
    }
    return current[target](input);
  }]));
  return { ...operations, createQuestionV2: current.createQuestionV2 };
}
