import { createQuestionsRepository } from './repository.js';
import { createMaterialsStore } from './materials-store.js';
import { inspectDocuments } from '../../workbench/reliability/inspection.js';
import { portableObject, readableContent, reference } from '../../workbench/reliability/portable-records.js';

const labels = {"body": "题干", "solution": "答案解析", "note": "备注", "noteFragments": "教学笔记摘录", "source": "来源与源码", "snapshot": "已采用的历史快照", "references": "关联资料", "draft": "已保存输入", "content": "内容", "text": "正文", "items": "条目", "origin": "来源"};
const record = (kind, value, options) => portableObject(kind, value, { html: readableContent(value, labels), ...options });

export function snapshot(db, principal) {
  const store = createMaterialsStore(db, createQuestionsRepository(db));
  const imports = store.list('imports', principal);
  const objects = store.questions(principal).map(value => {
    const relations = [];
    if (value.source?.kind === 'copy') relations.push(reference('question', value.source.questionId, 'copy-source', 'source', value.source.questionVersion ?? null, Boolean(value.source.snapshot)));
    if (value.source?.kind === 'import') relations.push(reference('import', value.source.importId, 'origin', 'source/importId', null, true));
    return record('question', value, { label: '题目', relations });
  });
  objects.push(record('question-taxonomy', store.taxonomy(principal), { label: '题目分类' }));
  objects.push(...imports.map(value => record('import', value, { label: '收录' })));
  const recognitionEvidence = store.list('tasks', principal)
    .filter(task => Object.keys(task.lateResults ?? {}).length || Object.keys(task.nativeWordSources ?? {}).length)
    .map(task => ({ jobId: task.id, importId: task.importId, lateResults: task.lateResults, nativeWordSources: task.nativeWordSources, originalDocuments: task.originalDocuments }));
  return { objects, supplemental: { questionRecognitionEvidence: recognitionEvidence } };
}
export function validateStorage(db) {
  const records = [];
  for (const row of db.prepare('SELECT * FROM question_items').all()) {
    for (const column of ['body', 'solution', 'source']) records.push({ accountKey: row.accountKey, value: row[column] });
    if (row.sourceQuestionId) {
      const source = db.prepare('SELECT accountKey FROM question_items WHERE id=?').get(row.sourceQuestionId);
      const snapshot = JSON.parse(row.source).snapshot;
      if (source ? source.accountKey !== row.accountKey : !snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Missing or foreign object reference');
    }
  }
  for (const table of ['questions_materials_meta', 'questions_materials_imports', 'questions_materials_tasks']) records.push(...db.prepare(`SELECT accountKey,value FROM ${table}`).all());
  return inspectDocuments(db, records);
}
export function deleteAccountData(db, accountKey) {
  for (const table of ['question_items', 'questions_materials_meta', 'questions_materials_imports', 'questions_materials_taxonomy', 'questions_materials_tasks']) db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
}
