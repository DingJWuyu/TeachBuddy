import express from 'express';
import { buildManifest } from '@refatos/shared';
import { ensureObject, ensureTimeString, ensureTrimmedString, optionalTrimmedString } from '../../core/validation.js';

const manifest = buildManifest({
  id: 'schedule-organizer'
});

function hasClash(dataStore, incomingItem, currentId = null) {
  const items = dataStore.list('scheduleItems');
  return items.some((item) => {
    if (currentId && item.id === currentId) return false;
    if (item.day !== incomingItem.day) return false;

    const startA = incomingItem.startTime;
    const endA = incomingItem.endTime;
    const startB = item.startTime;
    const endB = item.endTime;

    return startA < endB && endA > startB;
  });
}

function sanitizeSchedulePayload(payload) {
  const body = ensureObject(payload);
  const item = {
    day: ensureTrimmedString(body.day, 'Day', { maxLength: 20 }),
    startTime: ensureTimeString(body.startTime, 'Start time'),
    endTime: ensureTimeString(body.endTime, 'End time'),
    subject: ensureTrimmedString(body.subject, 'Subject', { maxLength: 120 }),
    className: ensureTrimmedString(body.className, 'Class', { maxLength: 80 }),
    room: optionalTrimmedString(body.room, { label: 'Room', maxLength: 80 }),
    note: optionalTrimmedString(body.note, { label: 'Note', maxLength: 500 })
  };

  if (item.startTime >= item.endTime) {
    const error = new Error('End time must be later than start time.');
    error.status = 400;
    throw error;
  }

  return item;
}

export const moduleDefinition = {
  manifest,
  register({ app, eventBus, dataStore }) {
    const router = express.Router();

    router.get('/', (req, res) => {
      res.json({ items: dataStore.list('scheduleItems') });
    });

    router.post('/', express.json(), (req, res) => {
      const payload = sanitizeSchedulePayload(req.body);
      if (hasClash(dataStore, payload)) {
        return res.status(409).json({ message: 'This time slot clashes with an existing class.' });
      }

      const item = dataStore.create('scheduleItems', payload);
      eventBus.emitEvent('schedule.created', { moduleId: manifest.id, item });
      return res.status(201).json(item);
    });

    router.put('/:id', express.json(), (req, res) => {
      const payload = sanitizeSchedulePayload(req.body);
      if (hasClash(dataStore, payload, req.params.id)) {
        return res.status(409).json({ message: 'Updated slot clashes with another class.' });
      }

      const item = dataStore.update('scheduleItems', req.params.id, payload);
      if (!item) {
        return res.status(404).json({ message: 'Schedule item not found.' });
      }

      eventBus.emitEvent('schedule.updated', { moduleId: manifest.id, item });
      return res.json(item);
    });

    router.delete('/:id', (req, res) => {
      const item = dataStore.remove('scheduleItems', req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Schedule item not found.' });
      }

      eventBus.emitEvent('schedule.deleted', { moduleId: manifest.id, item });
      return res.json({ success: true, item });
    });

    app.use(manifest.routesBasePath, router);
  }
};
