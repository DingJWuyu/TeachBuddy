import express from 'express';
import { buildManifest } from '@refatos/shared';
import { ensureEnum, ensureIsoDate, ensureObject, ensurePositiveInteger, ensureTrimmedString, optionalTrimmedString } from '../../core/validation.js';

const manifest = buildManifest({
  id: 'reminder-center',
  name: 'Reminder Center',
  category: 'productivity',
  routesBasePath: '/api/modules/reminder-center'
});

function incrementDate(isoDate, recurrence = 'none', interval = 1) {
  const date = new Date(isoDate);
  const value = Number(interval || 1);
  if (recurrence === 'daily') date.setDate(date.getDate() + value);
  if (recurrence === 'weekly') date.setDate(date.getDate() + 7 * value);
  if (recurrence === 'monthly') date.setMonth(date.getMonth() + value);
  return date.toISOString();
}

function createNextOccurrence(dataStore, item) {
  if (!item || !item.recurrence || item.recurrence === 'none') return null;
  return dataStore.create('reminders', {
    title: item.title,
    dueAt: incrementDate(item.dueAt, item.recurrence, item.recurrenceInterval),
    priority: item.priority,
    status: 'pending',
    linkedTo: item.linkedTo || null,
    source: item.source || 'manual',
    recurrence: item.recurrence,
    recurrenceInterval: Number(item.recurrenceInterval || 1),
    parentReminderId: item.parentReminderId || item.id
  });
}

function sanitizeReminderPayload(payload) {
  const body = ensureObject(payload);
  return {
    title: ensureTrimmedString(body.title, 'Title', { maxLength: 160 }),
    dueAt: ensureIsoDate(body.dueAt, 'Due date'),
    priority: ensureEnum(body.priority ?? 'medium', ['low', 'medium', 'high'], 'Priority'),
    status: ensureEnum(body.status ?? 'pending', ['pending', 'done'], 'Status'),
    linkedTo: optionalTrimmedString(body.linkedTo, { label: 'Linked item', maxLength: 120 }) || null,
    source: optionalTrimmedString(body.source, { label: 'Source', maxLength: 80 }) || 'manual',
    recurrence: ensureEnum(body.recurrence ?? 'none', ['none', 'daily', 'weekly', 'monthly'], 'Recurrence'),
    recurrenceInterval: ensurePositiveInteger(body.recurrenceInterval ?? 1, 'Recurrence interval', { min: 1, max: 365 })
  };
}

export const moduleDefinition = {
  manifest,
  register({ app, eventBus, dataStore }) {
    const router = express.Router();

    eventBus.onEvent('lesson.plan.created', ({ item }) => {
      dataStore.create('reminders', {
        title: `Review lesson plan: ${item.topic}`,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        priority: 'medium',
        status: 'pending',
        linkedTo: item.id,
        source: 'lesson-planner',
        recurrence: 'none',
        recurrenceInterval: 1
      });
    });

    router.get('/', (req, res) => {
      res.json({ items: dataStore.list('reminders') });
    });

    router.post('/', express.json(), (req, res) => {
      const payload = sanitizeReminderPayload({ recurrence: 'none', recurrenceInterval: 1, ...req.body });
      const item = dataStore.create('reminders', payload);
      eventBus.emitEvent('reminder.created', { moduleId: manifest.id, item });
      res.status(201).json(item);
    });

    router.put('/:id', express.json(), (req, res) => {
      const item = dataStore.update('reminders', req.params.id, sanitizeReminderPayload(req.body));
      if (!item) return res.status(404).json({ message: 'Reminder not found.' });
      eventBus.emitEvent('reminder.updated', { moduleId: manifest.id, item });
      return res.json(item);
    });

    router.post('/:id/complete', (req, res) => {
      const current = dataStore.get('reminders', req.params.id);
      if (!current) return res.status(404).json({ message: 'Reminder not found.' });
      const item = dataStore.update('reminders', req.params.id, { status: 'done' });
      const nextOccurrence = createNextOccurrence(dataStore, item);
      return res.json({ item, nextOccurrence });
    });

    router.delete('/:id', (req, res) => {
      const item = dataStore.remove('reminders', req.params.id);
      if (!item) return res.status(404).json({ message: 'Reminder not found.' });
      eventBus.emitEvent('reminder.deleted', { moduleId: manifest.id, item });
      return res.json({ success: true, item });
    });

    app.use(manifest.routesBasePath, router);
  }
};
