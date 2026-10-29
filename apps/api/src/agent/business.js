import { contractError, problems } from '../workbench/problems.js';

// Tools translate their envelope; each owning module selects its representation.
export function connectBusinessOperations(loader) {
  const questions = loader.get('questions')?.port;
  const resources = loader.get('resources')?.port;
  const schedule = loader.get('schedule')?.port;
  const adapters = Object.fromEntries(Object.entries(questions?.businessOperations ?? {}).map(([name, operation]) => [name,
    ({ principal, key, arguments: args }) => operation({ principal, key, id: args.id, input: args.body, query: args.query })]));
  if (schedule) adapters.createEntry = ({ principal, key, arguments: args }) => schedule.operations.createEntry({ principal, key, input: args.body });
  return { ...adapters,
    readReference(principal, ref) {
      if (ref.kind === 'question' && questions) return { object: questions.businessOperations.getQuestion({ principal, id: ref.id }).body };
      if (ref.kind === 'resource' && resources) return { object: resources.readReference(principal, ref.id) };
      if (ref.kind === 'entry' && schedule) {
        const snapshot = schedule.readReference(principal, ref);
        return { object: snapshot.entry, snapshot };
      }
      throw contractError(problems.notFound());
    }
  };
}
