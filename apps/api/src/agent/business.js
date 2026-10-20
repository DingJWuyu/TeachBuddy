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
  const adapters = Object.fromEntries(Object.entries(legacy).map(([name, operation]) => [name, input => {
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
  return { ...adapters,
    createQuestionV2: ({ principal, key, arguments: args }) => current.createQuestionV2({ principal, key, input: args.body }),
    createEntry: ({ principal, key, arguments: args }) => loader.get('schedule').port.operations.createEntry({ principal, key, input: args.body }),
    readReference(principal, ref) {
      if (ref.kind === 'question') return { object: adapters.getQuestion({ principal, arguments: { id: ref.id } }).body };
      if (ref.kind === 'resource') return { object: loader.get('resources').port.readReference(principal, ref.id) };
      const snapshot = loader.get('schedule').port.readReference(principal, ref);
      return { object: snapshot.entry, snapshot };
    }
  };
}
