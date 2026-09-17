import express from 'express';
import cors from 'cors';
import { createEnv, env as defaultEnv } from './config/env.js';
import { createDataStore } from './core/dataStore.js';
import { createToken, hashPassword, verifyPassword } from './core/auth.js';
import { badRequest, ensureObject, ensureTrimmedString } from './core/validation.js';
import { getModuleManifests, registerModules } from './core/moduleRegistry.js';
import { ModuleEventBus } from './events/eventBus.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import { readWorkspaceLayout, saveWorkspaceLayout } from './core/workspaceLayout.js';

function normalizeOriginValue(value) {
  if (!value) return '';

  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return String(value)
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }
}

function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function findUserByEmail(dataStore, email) {
  const normalizedEmail = email.toLowerCase();
  return dataStore.list('users').find((item) => item.email?.toLowerCase() === normalizedEmail);
}

export function createApp(options = {}) {
  const runtimeEnv = options.env ? createEnv(options.env) : defaultEnv;
  const eventBus = options.eventBus ?? new ModuleEventBus();
  const dataStore = options.dataStore ?? createDataStore(runtimeEnv);
  const app = express();
  const allowedOriginHosts = new Set(runtimeEnv.corsOrigins.map((origin) => normalizeOriginValue(origin)).filter(Boolean));

  const corsOptions = runtimeEnv.corsOrigins.length
    ? {
        origin(origin, callback) {
          const normalizedOrigin = normalizeOriginValue(origin);
          if (!origin || runtimeEnv.corsOrigins.includes(origin) || allowedOriginHosts.has(normalizedOrigin)) {
            callback(null, true);
            return;
          }
          callback(new Error(`Origin ${origin} is not allowed by CORS.`));
        }
      }
    : {};

  app.use(cors(corsOptions));
  app.use(express.json());
  app.use('/uploads', express.static(runtimeEnv.uploadDir));

  app.get('/api/health', (req, res) => {
    res.json({
      app: runtimeEnv.appName,
      status: 'ok',
      environment: runtimeEnv.nodeEnv,
      modulesLoaded: getModuleManifests().length
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const body = ensureObject(req.body);
    const email = ensureTrimmedString(body.email, 'Email', { maxLength: 120 }).toLowerCase();
    const password = ensureTrimmedString(body.password, 'Password', { maxLength: 120 });
    const user = findUserByEmail(dataStore, email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const token = createToken(user);
    return res.json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/register', (req, res) => {
    const body = ensureObject(req.body);
    const name = ensureTrimmedString(body.name, 'Name', { maxLength: 120 });
    const email = ensureTrimmedString(body.email, 'Email', { maxLength: 120 }).toLowerCase();
    const password = ensureTrimmedString(body.password, 'Password', { maxLength: 120 });
    const passwordConfirmation = ensureTrimmedString(
      body.passwordConfirmation,
      'Password confirmation',
      { maxLength: 120 }
    );

    if (password !== passwordConfirmation) {
      badRequest('Passwords do not match.');
    }

    if (findUserByEmail(dataStore, email)) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    let user;
    try {
      user = dataStore.create('users', {
        name,
        email,
        passwordHash: hashPassword(password),
        role: 'teacher'
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ message: 'An account with that email already exists.' });
      }
      throw error;
    }

    const publicUser = toPublicUser(user);
    const token = createToken(publicUser);
    return res.status(201).json({ token, user: publicUser });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  app.use('/api', requireAuth);

  app.get('/api/modules', (req, res) => {
    res.json({ items: getModuleManifests() });
  });

  app.get('/api/workspace/layout', (req, res) => {
    const moduleIds = getModuleManifests().map((moduleItem) => moduleItem.id);
    return res.json(readWorkspaceLayout(dataStore, req.user.sub, moduleIds));
  });

  app.put('/api/workspace/layout', (req, res) => {
    const moduleIds = getModuleManifests().map((moduleItem) => moduleItem.id);
    const layout = saveWorkspaceLayout(dataStore, req.user.sub, req.body, moduleIds);
    return res.json(layout);
  });

  app.get('/api/templates', (req, res) => {
    const moduleId = req.query.moduleId;
    const items = moduleId ? dataStore.listWhere('templates', (item) => item.moduleId === moduleId) : dataStore.list('templates');
    res.json({ items });
  });

  app.post('/api/templates', (req, res) => {
    const body = ensureObject(req.body);
    const item = dataStore.create('templates', {
      moduleId: ensureTrimmedString(body.moduleId, 'Module ID', { maxLength: 80 }),
      name: ensureTrimmedString(body.name, 'Template name', { maxLength: 120 }),
      payload: ensureObject(body.payload, 'Template payload must be an object.')
    });
    eventBus.emitEvent('template.created', { item });
    res.status(201).json(item);
  });

  app.put('/api/templates/:id', (req, res) => {
    const body = ensureObject(req.body);
    const updates = {};

    if (body.moduleId !== undefined) {
      updates.moduleId = ensureTrimmedString(body.moduleId, 'Module ID', { maxLength: 80 });
    }
    if (body.name !== undefined) {
      updates.name = ensureTrimmedString(body.name, 'Template name', { maxLength: 120 });
    }
    if (body.payload !== undefined) {
      updates.payload = ensureObject(body.payload, 'Template payload must be an object.');
    }

    const item = dataStore.update('templates', req.params.id, updates);
    if (!item) return res.status(404).json({ message: 'Template not found.' });
    eventBus.emitEvent('template.updated', { item });
    return res.json(item);
  });

  app.delete('/api/templates/:id', (req, res) => {
    const item = dataStore.remove('templates', req.params.id);
    if (!item) return res.status(404).json({ message: 'Template not found.' });
    eventBus.emitEvent('template.deleted', { item });
    return res.json({ success: true, item });
  });

  registerModules({ app, eventBus, dataStore });
  app.use(notFound);
  app.use(errorHandler);

  return { app, dataStore, eventBus, env: runtimeEnv };
}
