import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { createEnv, env as defaultEnv } from './config/env.js';
import { createDataStore } from './core/dataStore.js';
import {
  createToken,
  generatePasswordRecoveryCode,
  hashPassword,
  hashPasswordRecoveryCode,
  verifyPassword,
  verifyPasswordRecoveryCode
} from './core/auth.js';
import { createRecoveryMailSender, PASSWORD_RECOVERY_SUBJECT } from './core/mail.js';
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

function toPublicTemplate(item) {
  if (!item) return item;
  const { ownerId, ...publicItem } = item;
  return publicItem;
}

const PASSWORD_RECOVERY_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RECOVERY_RESPONSE = 'If an account exists for that email, a password recovery code has been sent.';
const PASSWORD_RECOVERY_FAILURE = 'Invalid or expired password recovery code.';

function resolveNow(options) {
  const configuredNow = options.now ?? options.clock?.now;
  return () => {
    const value = typeof configuredNow === 'function' ? configuredNow() : configuredNow ?? new Date();
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Configured application clock returned an invalid date.');
    }
    return date;
  };
}

function sendMail(mailSender, message) {
  if (typeof mailSender === 'function') return mailSender(message);
  if (mailSender && typeof mailSender.send === 'function') return mailSender.send(message);
  throw new Error('A password recovery mail sender is not configured.');
}

export function createApp(options = {}) {
  const runtimeEnv = options.env ? createEnv(options.env) : defaultEnv;
  const eventBus = options.eventBus ?? new ModuleEventBus();
  const dataStore = options.dataStore ?? createDataStore(runtimeEnv);
  const now = resolveNow(options);
  const mailSender = options.mailSender ?? options.emailSender ?? createRecoveryMailSender(runtimeEnv);
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
    const user = dataStore.findUserByEmail(email);
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

    if (dataStore.findUserByEmail(email)) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    let user;
    try {
      user = dataStore.createUser({
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

  app.post('/api/auth/password-reset/request', async (req, res) => {
    const body = ensureObject(req.body);
    const email = ensureTrimmedString(body.email, 'Email', { maxLength: 120 }).toLowerCase();
    const user = findUserByEmail(dataStore, email);

    if (!user) {
      return res.status(202).json({ message: PASSWORD_RECOVERY_RESPONSE });
    }

    const code = generatePasswordRecoveryCode();
    const codeSalt = crypto.randomBytes(16).toString('hex');
    const message = {
      to: user.email,
      subject: PASSWORD_RECOVERY_SUBJECT,
      text: `Your RefatOS password recovery code is ${code}. It expires in 10 minutes.`
    };

    await sendMail(mailSender, message);

    const requestedAt = now();
    for (const previousCode of dataStore.list('passwordResetCodes')) {
      if (previousCode.userId === user.id && !previousCode.usedAt) {
        dataStore.update('passwordResetCodes', previousCode.id, { usedAt: requestedAt.toISOString() });
      }
    }

    dataStore.create('passwordResetCodes', {
      userId: user.id,
      codeHash: hashPasswordRecoveryCode(code, codeSalt, runtimeEnv.authSecret),
      codeSalt,
      expiresAt: new Date(requestedAt.getTime() + PASSWORD_RECOVERY_TTL_MS).toISOString(),
      usedAt: null
    });

    return res.status(202).json({ message: PASSWORD_RECOVERY_RESPONSE });
  });

  app.post('/api/auth/password-reset/confirm', (req, res) => {
    const body = ensureObject(req.body);
    const email = ensureTrimmedString(body.email, 'Email', { maxLength: 120 }).toLowerCase();
    const code = ensureTrimmedString(body.code, 'Recovery code', { maxLength: 6 });
    const password = ensureTrimmedString(body.password, 'Password', { maxLength: 120 });
    const passwordConfirmation = ensureTrimmedString(
      body.passwordConfirmation,
      'Password confirmation',
      { maxLength: 120 }
    );

    if (!/^\d{6}$/.test(code)) {
      badRequest('Recovery code must be a 6-digit number.');
    }
    if (password !== passwordConfirmation) {
      badRequest('Passwords do not match.');
    }

    const user = findUserByEmail(dataStore, email);
    const currentTime = now();
    const recoveryCode = user && dataStore
      .list('passwordResetCodes')
      .find((item) => item.userId === user.id
        && !item.usedAt
        && Date.parse(item.expiresAt) > currentTime.getTime()
        && verifyPasswordRecoveryCode(code, item.codeHash, item.codeSalt, runtimeEnv.authSecret));

    if (!user || !recoveryCode) {
      return res.status(400).json({ message: PASSWORD_RECOVERY_FAILURE });
    }

    dataStore.update('users', user.id, { passwordHash: hashPassword(password) });
    dataStore.update('passwordResetCodes', recoveryCode.id, { usedAt: currentTime.toISOString() });
    return res.json({ message: 'Password reset successfully.' });
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
    const accountStore = dataStore.forAccount(req.user.sub);
    const moduleId = req.query.moduleId;
    const items = accountStore.list('templates');
    res.json({ items: (moduleId ? items.filter((item) => item.moduleId === moduleId) : items).map(toPublicTemplate) });
  });

  app.post('/api/templates', (req, res) => {
    const body = ensureObject(req.body);
    const accountStore = dataStore.forAccount(req.user.sub);
    const item = accountStore.create('templates', {
      moduleId: ensureTrimmedString(body.moduleId, 'Module ID', { maxLength: 80 }),
      name: ensureTrimmedString(body.name, 'Template name', { maxLength: 120 }),
      payload: ensureObject(body.payload, 'Template payload must be an object.')
    });
    eventBus.emitEvent('template.created', { accountId: req.user.sub, item });
    res.status(201).json(toPublicTemplate(item));
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

    const accountStore = dataStore.forAccount(req.user.sub);
    const item = accountStore.update('templates', req.params.id, updates);
    if (!item) return res.status(404).json({ message: 'Template not found.' });
    eventBus.emitEvent('template.updated', { accountId: req.user.sub, item });
    return res.json(toPublicTemplate(item));
  });

  app.delete('/api/templates/:id', (req, res) => {
    const accountStore = dataStore.forAccount(req.user.sub);
    const item = accountStore.remove('templates', req.params.id);
    if (!item) return res.status(404).json({ message: 'Template not found.' });
    eventBus.emitEvent('template.deleted', { accountId: req.user.sub, item });
    return res.json({ success: true, item: toPublicTemplate(item) });
  });

  registerModules({ app, eventBus, dataStore });
  app.use(notFound);
  app.use(errorHandler);

  return { app, dataStore, eventBus, env: runtimeEnv };
}
