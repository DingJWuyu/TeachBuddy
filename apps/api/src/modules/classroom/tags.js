import { randomUUID } from 'node:crypto';
import { account, required, version, changed, timestamp, conflict } from './problems.js';
export const normalizeTag = name => name.trim().normalize('NFKC').replace(/\s+/gu, ' ');
export function createTags({
  repository: r,
  clock
}) {
  function checkName(p, name, exceptId) {
    const n = normalizeTag(name);
    const old = r.list('tags', account(p)).find(t => t.normalizedName === n && t.id !== exceptId);
    if (old) {
      throw conflict('tag-name-conflict', {
        tagId: old.id
      });
    }
    return n;
  }
  return {
    list(p, q = {}) {
      const items = r.list('tags', account(p)).filter(t => !t.mergedIntoId).filter(t => !q.q || t.normalizedName.toLocaleLowerCase().includes(normalizeTag(q.q).toLocaleLowerCase())).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      return {
        items,
        total: items.length
      };
    },
    create(p, {
      name
    }) {
      const now = timestamp(clock);
      return r.write('tags', account(p), {
        id: randomUUID(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        name: name.trim(),
        normalizedName: checkName(p, name),
        mergedIntoId: null
      });
    },
    update(p, id, {
      baseVersion,
      name
    }) {
      const old = required(r, 'tags', p, id);
      version(old, baseVersion);
      if (old.mergedIntoId) {
        throw conflict('tag-merged', {
          targetId: old.mergedIntoId
        });
      }
      return r.write('tags', account(p), changed(old, clock, {
        name: name.trim(),
        normalizedName: checkName(p, name, id)
      }));
    },
    merge(p, id, {
      baseVersion,
      targetId,
      targetVersion
    }) {
      const source = required(r, 'tags', p, id),
        target = required(r, 'tags', p, targetId);
      version(source, baseVersion);
      version(target, targetVersion);
      if (source.mergedIntoId) {
        throw conflict('tag-merged', {
          targetId: source.mergedIntoId
        });
      }
      if (target.mergedIntoId) {
        throw conflict('tag-merged', {
          targetId: target.mergedIntoId
        });
      }
      if (id === targetId) {
        throw conflict('invalid-tag-merge');
      }
      const affectedExamIds = [];
      for (const e of r.list('exams', account(p))) {
        if (e.questions.some(q => q.tagIds.includes(id))) {
          const questions = e.questions.map(q => ({
            ...q,
            tagIds: [...new Set(q.tagIds.map(t => t === id ? targetId : t))]
          }));
          r.write('exams', account(p), changed(e, clock, {
            questions
          }));
          affectedExamIds.push(e.id);
        }
      }
      // Keep previously merged names as direct references to the surviving tag.
      for (const alias of r.list('tags', account(p))) {
        if (alias.mergedIntoId === id) {
          r.write('tags', account(p), changed(alias, clock, {
            mergedIntoId: targetId
          }));
        }
      }
      return {
        source: r.write('tags', account(p), changed(source, clock, {
          mergedIntoId: targetId
        })),
        target,
        affectedExamIds
      };
    }
  };
}
