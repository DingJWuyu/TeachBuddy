import express from 'express';
import { buildManifest } from '@refatos/shared';
import { ensureObject, ensureStringArray, ensureTrimmedString, optionalTrimmedString } from '../../core/validation.js';

const manifest = buildManifest({
  id: 'lesson-planner'
});

function createDraftFromLesson(item) {
  const marks = 15;
  const questionCount = 5;
  return {
    title: `${item.topic} - Auto Worksheet`,
    className: item.className,
    format: 'O-Level structured',
    topic: item.topic,
    marks,
    duration: item.duration || '35 min',
    instructions: 'Answer all questions. Show all working. Use dotted answer spaces and blank space for diagrams.',
    questionCount,
    generatedFromLessonId: item.id,
    resourceIds: item.resourceIds || [],
    questionItems: [
      { number: 1, type: 'starter-recall', prompt: `State one fact about ${item.topic}.`, marks: 2, lines: 2 },
      { number: 2, type: 'objective-check', prompt: item.objective || `Explain the main idea of ${item.topic}.`, marks: 3, lines: 4 },
      { number: 3, type: 'method', prompt: item.mainActivity || 'Describe the method used in class.', marks: 4, lines: 5 },
      { number: 4, type: 'diagram', prompt: `Draw and label a diagram related to ${item.topic}.`, marks: 3, lines: 0, diagramSpace: true },
      { number: 5, type: 'assessment', prompt: item.assessment || 'Answer the final checkpoint question.', marks: 3, lines: 4 }
    ]
  };
}

function sanitizeLessonPayload(payload) {
  const body = ensureObject(payload);
  return {
    topic: ensureTrimmedString(body.topic, 'Topic', { maxLength: 160 }),
    className: ensureTrimmedString(body.className, 'Class', { maxLength: 80 }),
    objective: ensureTrimmedString(body.objective, 'Objective', { maxLength: 800 }),
    duration: ensureTrimmedString(body.duration, 'Duration', { maxLength: 40 }),
    materials: optionalTrimmedString(body.materials, { label: 'Materials', maxLength: 800 }),
    starter: optionalTrimmedString(body.starter, { label: 'Starter', maxLength: 800 }),
    mainActivity: optionalTrimmedString(body.mainActivity, { label: 'Main activity', maxLength: 1200 }),
    assessment: optionalTrimmedString(body.assessment, { label: 'Assessment', maxLength: 800 }),
    resourceIds: ensureStringArray(body.resourceIds, 'Resource IDs')
  };
}

function toPublicLessonPlan(item) {
  if (!item) return item;
  const { ownerId, ...publicItem } = item;
  return publicItem;
}

export const moduleDefinition = {
  manifest,
  register({ app, eventBus, dataStore }) {
    const router = express.Router();

    router.get('/', (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      res.json({ items: accountStore.list('lessonPlans').map(toPublicLessonPlan) });
    });

    router.get('/:id', (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const item = accountStore.get('lessonPlans', req.params.id);
      if (!item) return res.status(404).json({ message: 'Lesson plan not found.' });
      return res.json(toPublicLessonPlan(item));
    });

    router.post('/', express.json(), (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const item = accountStore.create('lessonPlans', sanitizeLessonPayload(req.body));
      eventBus.emitEvent('lesson.plan.created', { moduleId: manifest.id, accountId: req.user.sub, item });
      res.status(201).json(toPublicLessonPlan(item));
    });

    router.put('/:id', express.json(), (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const item = accountStore.update('lessonPlans', req.params.id, sanitizeLessonPayload(req.body));
      if (!item) return res.status(404).json({ message: 'Lesson plan not found.' });
      eventBus.emitEvent('lesson.plan.updated', { moduleId: manifest.id, item });
      return res.json(toPublicLessonPlan(item));
    });

    router.post('/:id/generate-worksheet-draft', (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const lesson = accountStore.get('lessonPlans', req.params.id);
      if (!lesson) return res.status(404).json({ message: 'Lesson plan not found.' });
      const payload = createDraftFromLesson(lesson);
      const draft = dataStore.create('worksheetDrafts', payload);
      eventBus.emitEvent('worksheet.draft.created', { moduleId: 'worksheet-designer', item: draft, sourceLesson: lesson });
      return res.status(201).json(draft);
    });

    router.delete('/:id', (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const item = accountStore.remove('lessonPlans', req.params.id);
      if (!item) return res.status(404).json({ message: 'Lesson plan not found.' });
      eventBus.emitEvent('lesson.plan.deleted', { moduleId: manifest.id, item });
      return res.json({ success: true, item: toPublicLessonPlan(item) });
    });

    app.use(manifest.routesBasePath, router);
  }
};
