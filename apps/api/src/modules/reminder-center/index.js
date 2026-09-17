import express from 'express';
import { buildManifest } from '@refatos/shared';
import { ensureEnum, ensureIsoDate, ensureObject, ensurePositiveInteger, ensureTrimmedString, optionalTrimmedString } from '../../core/validation.js';

const manifest = buildManifest({
  id: 'reminder-center'
});

function incrementDate(isoDate, recurrence = 'none', interval = 1) {
  const date = new Date(isoDate);
  const value = Number(interval || 1);
  if (recurrence === 'daily') date.setDate(date.getDate() + value);
  if (recurrence === 'weekly') date.setDate(date.getDate() + 7 * value);
  if (recurrence === 'monthly') date.setMonth(date.getMonth() + value);
  return date.toISOString();
}

function toPublicReminder(item) {
  if (!item) return item;
  const { ownerId, ...publicItem } = item;
  return publicItem;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

function ensureLinkedItemBelongsToAccount(dataStore, accountId, linkedTo) {
  if (!linkedTo) return;

  for (const key of ['lessonPlans', 'reminders', 'scheduleItems']) {
    const item = dataStore.get(key, linkedTo);
    if (item && item.ownerId !== accountId) {
      throw createNotFoundError('Linked item not found.');
    }
  }
}

function createNextOccurrence(accountStore, item) {
  if (!item || !item.recurrence || item.recurrence === 'none') return null;
  return accountStore.create('reminders', {
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

    eventBus.onEvent('lesson.plan.created', ({ item, accountId }) => {
      const ownerId = item?.ownerId || accountId;
      if (!ownerId) return;

      const accountStore = dataStore.forAccount(ownerId);
      if (!accountStore.get('lessonPlans', item.id)) return;

      accountStore.create('reminders', {
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
      const accountStore = dataStore.forAccount(req.user.sub);
      res.json({ items: accountStore.list('reminders').map(toPublicReminder) });
    });

    router.get('/:id', (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const item = accountStore.get('reminders', req.params.id);
      if (!item) return res.status(404).json({ message: 'Reminder not found.' });
      return res.json(toPublicReminder(item));
    });

    router.post('/', express.json(), (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const payload = sanitizeReminderPayload({ recurrence: 'none', recurrenceInterval: 1, ...req.body });
      ensureLinkedItemBelongsToAccount(dataStore, req.user.sub, payload.linkedTo);
      const item = accountStore.create('reminders', payload);
      eventBus.emitEvent('reminder.created', { moduleId: manifest.id, item });
      res.status(201).json(toPublicReminder(item));
    });

    router.put('/:id', express.json(), (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const payload = sanitizeReminderPayload(req.body);
      ensureLinkedItemBelongsToAccount(dataStore, req.user.sub, payload.linkedTo);
      const item = accountStore.update('reminders', req.params.id, payload);
      if (!item) return res.status(404).json({ message: 'Reminder not found.' });
      eventBus.emitEvent('reminder.updated', { moduleId: manifest.id, item });
      return res.json(toPublicReminder(item));
    });

    router.post('/:id/complete', (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const current = accountStore.get('reminders', req.params.id);
      if (!current) return res.status(404).json({ message: 'Reminder not found.' });
      const item = accountStore.update('reminders', req.params.id, { status: 'done' });
      const nextOccurrence = createNextOccurrence(accountStore, item);
      return res.json({ item: toPublicReminder(item), nextOccurrence: toPublicReminder(nextOccurrence) });
    });

    router.delete('/:id', (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const item = accountStore.remove('reminders', req.params.id);
      if (!item) return res.status(404).json({ message: 'Reminder not found.' });
      eventBus.emitEvent('reminder.deleted', { moduleId: manifest.id, item });
      return res.json({ success: true, item: toPublicReminder(item) });
    });

    app.use(manifest.routesBasePath, router);
  }
};
