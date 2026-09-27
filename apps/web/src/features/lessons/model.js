/**
 * Lesson editor input <-> contract payload, plus the structural edits the UX
 * requires (sections, references, moving and adopting versions).
 *
 * References are sent as `{id, questionId, questionVersion, note}` only: the
 * server owns snapshots, so client-side snapshot data is never sent back.
 */

import { emptyDocument } from "../workbench/documents.js";
import { newRequestKey } from "../workbench/uuid.js";

export function emptyLessonInput() {
  return {
    title: "未命名备课",
    intro: emptyDocument(),
    sections: [],
    materials: [],
  };
}

export function referenceInputFrom(reference) {
  return {
    id: reference.id,
    kind: reference.kind ?? "question",
    [(reference.kind === "math" ? "work" : reference.kind ?? "question") + "Id"]:
      reference[(reference.kind === "math" ? "work" : reference.kind ?? "question") + "Id"],
    [(reference.kind === "math" ? "work" : reference.kind ?? "question") + "Version"]:
      reference[(reference.kind === "math" ? "work" : reference.kind ?? "question") + "Version"],
    note: reference.note || "",
    afterBlock: reference.afterBlock ?? null,
  };
}

/**
 * Editor state keeps the server-owned display fields (snapshot, source state,
 * current version) so a reference can be read and compared before any save;
 * only `referenceInputFrom` is ever sent.
 */
function referenceStateFrom(reference) {
  return {
    ...referenceInputFrom(reference),
    snapshot: reference.snapshot,
    sourceState: reference.sourceState,
    latestVersion: reference.latestVersion,
  };
}

export function lessonInputFrom(lesson) {
  return {
    title: lesson.title,
    intro: lesson.intro,
    sections: (lesson.sections || []).map((section) => ({
      id: section.id,
      title: section.title,
      content: section.content,
      ...(section.pageSource ? { pageSource: section.pageSource } : {}),
      references: (section.references || []).map(referenceStateFrom),
    })),
    materials: (lesson.materials || []).map(referenceStateFrom),
  };
}

export function validateLessonInput(input) {
  // Documents from a newer content version stay read-only and are never saved
  // back through this editor.
  const documents = [
    ["/intro", input?.intro],
    ...(input?.sections || []).map((section, index) => [
      `/sections/${index}/content`,
      section.content,
    ]),
  ];
  const unsupported = documents.find(
    ([, document]) => ![1, 2].includes(document?.version),
  );
  if (unsupported) {
    return {
      kind: "invalid",
      field: unsupported[0],
      reason: "unsupported-content-version",
      message: `这段内容来自更新的文档版本 ${unsupported[1]?.version}，本版本不能保存`,
    };
  }
  if (!input || !String(input.title || "").trim()) {
    return {
      kind: "invalid",
      field: "/title",
      reason: "out-of-range",
      message: "课题不能为空",
    };
  }
  if (String(input.title).length > 200) {
    return {
      kind: "invalid",
      field: "/title",
      reason: "out-of-range",
      message: "课题超出允许范围",
    };
  }
  const badSection = (input.sections || []).findIndex(
    (section) => !String(section.title || "").trim(),
  );
  if (badSection >= 0) {
    return {
      kind: "invalid",
      field: `/sections/${badSection}/title`,
      reason: "out-of-range",
      message: "环节名称不能为空",
    };
  }
  const ids = new Set();
  const collect = (references) => {
    for (const reference of references || []) {
      if (ids.has(reference.id)) {
        return {
          kind: "invalid",
          field: "/sections",
          reason: "duplicate-id",
          message: "引用 ID 重复",
        };
      }
      ids.add(reference.id);
    }
    return null;
  };
  for (const section of input.sections || []) {
    const problem = collect(section.references);
    if (problem) return problem;
  }
  return collect(input.materials);
}

export function buildCreateLessonPayload(input) {
  return {
    title: String(input.title),
    intro: input.intro,
    sections: (input.sections || []).map((section) => ({
      id: section.id,
      title: String(section.title),
      content: section.content,
      references: (section.references || []).map(referenceInputFrom),
    })),
    materials: (input.materials || []).map(referenceInputFrom),
  };
}

export function buildUpdateLessonPayload(input, baseline) {
  return {
    baseVersion: baseline.version,
    ...buildCreateLessonPayload(input),
  };
}

/**
 * References currently placed in one target of a lesson (server object or
 * editor input - both carry `sections[].references` and `materials`).
 */
/** Human label of a picking/placement target. */
export function targetLabel(input, target) {
  if (!target || target.type === "materials") return "本课材料";
  return (
    (input.sections || []).find((section) => section.id === target.sectionId)
      ?.title || "环节"
  );
}

/** Select value <-> target object, so the encoding lives in one place. */
export function targetValue(target) {
  return target?.type === "section"
    ? `section:${target.sectionId}`
    : "materials";
}

export function targetFromValue(value) {
  return value === "materials"
    ? { type: "materials", sectionId: null }
    : { type: "section", sectionId: String(value).slice("section:".length) };
}

export function targetReferences(lessonObject, target) {
  if (!lessonObject) return [];
  if (target.type === "materials") return lessonObject.materials || [];
  return (
    (lessonObject.sections || []).find(
      (section) => section.id === target.sectionId,
    )?.references || []
  );
}

/**
 * Full UpdateLesson body that appends references to one position of a server
 * lesson, used when the question bank adds to an existing lesson.
 */
export function appendReferencesToLesson(lessonObject, target, references) {
  const sections = (lessonObject.sections || []).map((section) => ({
    id: section.id,
    title: section.title,
    content: section.content,
    references: (section.references || []).map(referenceInputFrom),
  }));
  const materials = (lessonObject.materials || []).map(referenceInputFrom);
  const inputs = references.map(referenceInputFrom);
  if (target.type === "materials") {
    materials.push(...inputs);
  } else {
    const section = sections.find((item) => item.id === target.sectionId);
    if (!section) return null;
    section.references.push(...inputs);
  }
  return {
    baseVersion: lessonObject.version,
    title: lessonObject.title,
    intro: lessonObject.intro,
    sections,
    materials,
  };
}

export function newSection(title = "新环节") {
  return {
    id: newRequestKey(),
    title,
    content: emptyDocument(),
    references: [],
  };
}

export function newReference(question, note = "", kind = "question") {
  return {
    id: newRequestKey(),
    kind,
    [`${kind === "math" ? "work" : kind}Id`]: question.id,
    [`${kind === "math" ? "work" : kind}Version`]: question.version,
    note,
    snapshot: question.snapshot ?? {
      title: question.title,
      body: question.body,
      solution: question.solution,
      answerStatus: question.answerStatus,
    },
    sourceState: "active",
    latestVersion: question.version,
  };
}

/**
 * Copy-on-write editor state. Nested objects are copied too: mutating a
 * reference that is still shared with the previous state would make the save
 * lifecycle read the edit as "no change" and drop it.
 */
function updateInput(input, mutate) {
  const next = {
    ...input,
    sections: (input.sections || []).map((section) => ({
      ...section,
      references: (section.references || []).map((reference) => ({
        ...reference,
      })),
    })),
    materials: (input.materials || []).map((reference) => ({ ...reference })),
  };
  mutate(next);
  return next;
}

export function renameSection(input, sectionId, title) {
  return updateInput(input, (next) => {
    const section = next.sections.find((item) => item.id === sectionId);
    if (section) section.title = title;
  });
}

export function moveSection(input, sectionId, offset) {
  return updateInput(input, (next) => {
    const index = next.sections.findIndex((item) => item.id === sectionId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= next.sections.length) return;
    [next.sections[index], next.sections[target]] = [
      next.sections[target],
      next.sections[index],
    ];
  });
}

export function reorderReference(input, referenceId, offset) {
  return updateInput(input, (next) => {
    const references = [next.materials, ...next.sections.map(section => section.references)]
      .find(items => items.some(reference => reference.id === referenceId));
    if (!references) return;
    const index = references.findIndex(reference => reference.id === referenceId);
    const target = index + offset;
    if (target < 0 || target >= references.length) return;
    [references[index].afterBlock, references[target].afterBlock] = [references[target].afterBlock, references[index].afterBlock];
    [references[index], references[target]] = [references[target], references[index]];
  });
}

/** Deleting a section never lets the server guess: references move explicitly. */
export function deleteSection(
  input,
  sectionId,
  { keepReferences = true } = {},
) {
  return updateInput(input, (next) => {
    const index = next.sections.findIndex((item) => item.id === sectionId);
    if (index < 0) return;
    const [section] = next.sections.splice(index, 1);
    if (keepReferences) next.materials.push(...section.references);
  });
}

export function removeReference(input, referenceId) {
  return updateInput(input, (next) => {
    next.sections.forEach((section) => {
      section.references = section.references.filter(
        (reference) => reference.id !== referenceId,
      );
    });
    next.materials = next.materials.filter(
      (reference) => reference.id !== referenceId,
    );
  });
}

/** Move one reference between positions, keeping its id, snapshot and note. */
export function replaceReference(input, referenceId, replacement) {
  return updateInput(input, next => {
    for (const references of [next.materials, ...next.sections.map(section => section.references)]) {
      const index = references.findIndex(reference => reference.id === referenceId);
      if (index !== -1) references.splice(index, 1, replacement);
    }
  });
}

export function moveReference(input, referenceId, target) {
  return updateInput(input, (next) => {
    let found = null;
    next.sections.forEach((section) => {
      const index = section.references.findIndex(
        (reference) => reference.id === referenceId,
      );
      if (index >= 0) {
        [found] = section.references.splice(index, 1);
      }
    });
    const materialIndex = next.materials.findIndex(
      (reference) => reference.id === referenceId,
    );
    if (materialIndex >= 0) {
      [found] = next.materials.splice(materialIndex, 1);
    }
    if (!found) return;
    found.afterBlock = null;
    if (target.type === "materials") next.materials.push(found);
    else {
      const section = next.sections.find(
        (item) => item.id === target.sectionId,
      );
      if (section) section.references.push(found);
      else next.materials.push(found);
    }
  });
}

export function placeReference(input, referenceId, afterBlock) {
  return updateInput(input, next => {
    for (const section of next.sections) {
      const reference = section.references.find(r => r.id === referenceId);
      if (!reference) continue;
      reference.afterBlock = afterBlock;
      section.references.sort((a, b) => (a.afterBlock ?? section.content.blocks.length) - (b.afterBlock ?? section.content.blocks.length));
    }
  });
}

export function changeSectionContent(input, sectionId, content, edit) {
  return updateInput(input, next => {
    const section = next.sections.find(s => s.id === sectionId);
    if (!section) return;
    for (const reference of section.references) {
      const position = reference.afterBlock;
      if (position == null) continue;
      if (edit?.moveTo !== undefined) {
        if (position === edit.index + 1) reference.afterBlock = edit.moveTo + 1;
        else if (position === edit.moveTo + 1) reference.afterBlock = edit.index + 1;
      } else if (edit && position > edit.index) {
        reference.afterBlock = Math.max(edit.index, position - edit.remove) + edit.insert;
      }
      reference.afterBlock = Math.min(reference.afterBlock, content.blocks.length);
    }
    section.content = content;
    section.references.sort((a, b) => (a.afterBlock ?? content.blocks.length) - (b.afterBlock ?? content.blocks.length));
  });
}

export function addReferences(input, target, references) {
  return updateInput(input, (next) => {
    if (target.type === "materials") next.materials.push(...references);
    else {
      const section = next.sections.find(
        (item) => item.id === target.sectionId,
      );
      if (section) section.references.push(...references);
      else next.materials.push(...references);
    }
  });
}

export function setReferenceNote(input, referenceId, note) {
  return updateInput(input, (next) => {
    const all = [
      ...next.materials,
      ...next.sections.flatMap((section) => section.references),
    ];
    const reference = all.find((item) => item.id === referenceId);
    if (reference) reference.note = note;
  });
}

/** Explicitly adopt the question's current version for one reference only. */
export function adoptReferenceVersion(input, referenceId, latestVersion, snapshot) {
  return updateInput(input, (next) => {
    const all = [
      ...next.materials,
      ...next.sections.flatMap((section) => section.references),
    ];
    const reference = all.find((item) => item.id === referenceId);
    if (reference) {
      reference[`${reference.kind === "math" ? "work" : reference.kind ?? "question"}Version`] = latestVersion;
      if (snapshot) reference.snapshot = snapshot;
      reference.latestVersion = latestVersion;
      reference.sourceState = "active";
    }
  });
}
