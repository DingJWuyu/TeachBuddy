import express from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { buildManifest } from '@refatos/shared';
import { ensureObject, ensureStringArray, optionalTrimmedString } from '../../core/validation.js';

const manifest = buildManifest({
  id: 'resource-vault'
});

function toPublicResource(item) {
  if (!item) return item;
  const { ownerId, ...publicItem } = item;
  return {
    ...publicItem,
    downloadPath: `/modules/resource-vault/${item.id}/file`
  };
}

export const moduleDefinition = {
  manifest,
  register({ app, eventBus, dataStore }) {
    const router = express.Router();
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, dataStore.paths.uploadDir),
      filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
        cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
      }
    });
    const upload = multer({ storage });

    router.get('/', (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      res.json({ items: accountStore.list('resources').map(toPublicResource) });
    });

    router.get('/:id/file', (req, res, next) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const item = accountStore.get('resources', req.params.id);
      if (!item || !item.path) return res.status(404).json({ message: 'Resource file not found.' });

      const filePath = path.join(dataStore.paths.uploadDir, path.basename(item.path));
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Resource file not found.' });

      const originalName = String(item.originalName || 'resource-file').replace(/[\r\n"]/g, '_');
      const fallbackName = originalName.replace(/[^\x20-\x7E]/g, '_') || 'resource-file';
      res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`);
      return res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) next(error);
      });
    });

    router.post('/upload', upload.single('file'), (req, res) => {
      if (!req.file) {
        return res.status(400).json({ message: 'A file upload is required.' });
      }

      try {
        const body = ensureObject(req.body, 'Upload metadata is required.');
        const tags = ensureStringArray(body.tags, 'Tags');
        const moduleLinks = ensureStringArray(body.moduleLinks, 'Module links');
        const accountStore = dataStore.forAccount(req.user.sub);
        const item = accountStore.create('resources', {
          title: optionalTrimmedString(body.title, { label: 'Title', maxLength: 160 }) || req.file.originalname,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          tags,
          moduleLinks,
          path: `/uploads/${path.basename(req.file.path)}`
        });
        eventBus.emitEvent('resource.created', { moduleId: manifest.id, accountId: req.user.sub, item });
        return res.status(201).json(toPublicResource(item));
      } catch (error) {
        fs.rmSync(req.file.path, { force: true });
        throw error;
      }
    });

    router.put('/:id', express.json(), (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const body = ensureObject(req.body);
      const updates = {};

      if (body.title !== undefined) {
        updates.title = optionalTrimmedString(body.title, { label: 'Title', maxLength: 160 });
      }
      if (body.tags !== undefined) {
        updates.tags = ensureStringArray(body.tags, 'Tags');
      }
      if (body.moduleLinks !== undefined) {
        updates.moduleLinks = ensureStringArray(body.moduleLinks, 'Module links');
      }

      const item = accountStore.update('resources', req.params.id, updates);
      if (!item) return res.status(404).json({ message: 'Resource not found.' });
      eventBus.emitEvent('resource.updated', { moduleId: manifest.id, accountId: req.user.sub, item });
      return res.json(toPublicResource(item));
    });

    router.delete('/:id', (req, res) => {
      const accountStore = dataStore.forAccount(req.user.sub);
      const item = accountStore.remove('resources', req.params.id);
      if (!item) return res.status(404).json({ message: 'Resource not found.' });
      if (item.path) {
        const filePath = path.join(dataStore.paths.uploadDir, path.basename(item.path));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      eventBus.emitEvent('resource.deleted', { moduleId: manifest.id, accountId: req.user.sub, item });
      return res.json({ success: true, item: toPublicResource(item) });
    });

    app.use(manifest.routesBasePath, router);
  }
};
