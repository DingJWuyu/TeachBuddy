import { randomUUID } from 'node:crypto';
import { valid } from './schema.js';

// The proposal stays human-readable; execution builds the same editable document
// that the prototype saves, then validates it against the owning business schema.
function document(text) {
  return { version: 2, blocks: text.split('\n').filter(Boolean).map(line => {
    const runs = []; let end = 0;
    for (const match of line.matchAll(/\$([^$]+)\$/g)) {
      if (match.index > end) runs.push({ type: 'text', text: line.slice(end, match.index) });
      runs.push({ type: 'math', latex: match[1] }); end = match.index + match[0].length;
    }
    if (end < line.length) runs.push({ type: 'text', text: line.slice(end) });
    return { type: 'paragraph', runs };
  }) };
}
export function proposalSize(card) { return card.kind === 'practice' ? card.items.length : 1; }
export function proposalRequest(card, slot) {
  if (card.kind === 'plan') return { operationId: 'createEntry', arguments: { body: {
    title: card.entryTitle,
    items: card.steps.map(text => ({ id: randomUUID(), text, priority: 'normal', completed: false })),
    time: null, repeat: null, reminder: null
  } } };
  const q = card.kind === 'variant' ? card.item : card.items[slot];
  return { operationId: 'createQuestionV2', arguments: { body: {
    title: q.title, body: document(q.body), solution: document(q.solution), answerStatus: 'present',
    note: '', starred: false, source: { kind: 'manual' }, typeId: q.typeId ?? null, tagIds: q.tagIds ?? []
  } } };
}
export function validProposal(card) {
  return Array.from({ length: proposalSize(card) }, (_, slot) => proposalRequest(card, slot))
    .every(request => valid('Tool_' + request.operationId, request.arguments));
}
