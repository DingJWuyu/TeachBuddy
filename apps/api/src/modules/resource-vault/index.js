import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { buildManifest } from '@refatos/shared';
import { ensureObject, ensureStringArray, optionalTrimmedString } from '../../core/validation.js';

const manifest = buildManifest({
  id: 'resource-vault'
});

export const moduleDefinition = {
  manifest,
  register({ app, eventBus, dataStore }) {
    const router = express.Router();
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, dataStore.paths.uploadDir),
      filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
        cb(null, `${Date.now()}-${safeName}`);
      }
    });
    const upload = multer({ storage });

    router.get('/', (req, res) => {
      res.json({ items: dataStore.list('resources') });
    });

    router.post('/upload', upload.single('file'), (req, res) => {
      if (!req.file) {
        return res.status(400).json({ message: 'A file upload is required.' });
      }

      const body = ensureObject(req.body, 'Upload metadata is required.');
      const tags = ensureStringArray(body.tags, 'Tags');
      const moduleLinks = ensureStringArray(body.moduleLinks, 'Module links');
      const item = dataStore.create('resources', {
        title: optionalTrimmedString(body.title, { label: 'Title', maxLength: 160 }) || req.file.originalname,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        tags,
        moduleLinks,
        path: `/uploads/${path.basename(req.file.path)}`
      });
      eventBus.emitEvent('resource.created', { moduleId: manifest.id, item });
      res.status(201).json(item);
    });

    router.put('/:id', express.json(), (req, res) => {
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

      const item = dataStore.update('resources', req.params.id, updates);
      if (!item) return res.status(404).json({ message: 'Resource not found.' });
      eventBus.emitEvent('resource.updated', { moduleId: manifest.id, item });
      return res.json(item);
    });

    router.delete('/:id', (req, res) => {
      const item = dataStore.remove('resources', req.params.id);
      if (!item) return res.status(404).json({ message: 'Resource not found.' });
      if (item.path) {
        const filePath = path.join(dataStore.paths.uploadDir, path.basename(item.path));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      eventBus.emitEvent('resource.deleted', { moduleId: manifest.id, item });
      return res.json({ success: true, item });
    });

    app.use(manifest.routesBasePath, router);
  }
};
