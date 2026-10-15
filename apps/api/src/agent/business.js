import { legacyArguments } from './schema.js';

// All writes still enter the owning module's schema and idempotent transaction.
// Legacy calls remain replayable; current documents are never flattened to v1.
export function connectBusinessOperations(loader) {
  const questions = loader.get('questions');
  const legacy = { ...questions?.operations };
  const current = { ...questions?.port?.operations };
  const names = {
    listQuestions: 'listQuestionsV2', getQuestion: 'getQuestionV2',
    createQuestion: 'createQuestionV2', updateQuestion: 'updateQuestionV2',
    copyQuestion: 'copyQuestionV2', setQuestionDeletion: 'setQuestionDeletionV2',
    listDerivatives: 'listQuestionCopiesForAgent',
  };
  return Object.fromEntries(Object.entries(legacy).map(([name, operation]) => [name, input => {
    if (legacyArguments(name, input.arguments)) {
      try { return operation(input); }
      catch (error) {
        if (error.problem?.reason !== 'unsupported-content-version' || !names[name]) throw error;
      }
    }
    const target = current[names[name]];
    if (!target) return operation(input);
    const args = input.arguments;
    return target({ principal: input.principal, key: input.key, id: args.id, input: args.body, query: args.query });
  }]));
}
