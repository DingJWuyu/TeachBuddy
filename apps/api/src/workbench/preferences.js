/**
 * Account preferences: GET/PUT /api/reliability/v1/preferences.
 *
 * One versioned document per account, saved under the shared workbench
 * identity, Idempotency-Key and version-conflict protocol (workbench.openapi.yaml).
 * An account that never saved reads the defaults with version 1 and
 * updatedAt null; every successful PUT adds 1. Stored values are merged over
 * the defaults on read, and a PUT merges its values over the stored ones, so an
 * old client that omits newer fields keeps them.
 *
 * Current settings: theme, background (custom uses backgroundImage), avatar and
 * locale. readingSize, motion and externalAi are compatibility fields with no
 * settings UI; every PUT must still send them.
 * - avatar: WebP data URL of at most 131072 characters, decoded as one frame of
 *   at most 256 x 256; the client crops it, the original is never stored. An
 *   empty string removes it.
 * - backgroundImage: JPEG or WebP data URL of at most 3145728 characters, one
 *   frame within 4096 x 4096 input pixels, fully decoded before it is accepted.
 * - The request body limit is 3400 KiB instead of the shared 2 MiB so that a
 *   background image fits.
 */
import express from 'express';
import sharp from 'sharp';
import { createGuards, asyncHandler, createMutationHandler, createWorkbenchErrorHandler } from './http.js';
import { contractError, problems, invalidInput } from './problems.js';

export const preferenceMigrations = [{ moduleId: 'reliability-preferences', migrations: [{
  id: 'reliability_preferences_001',
  up(db) { db.exec(`CREATE TABLE reliability_preferences (
    accountKey TEXT PRIMARY KEY, version INTEGER NOT NULL, valuesJson TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`); }
}] }];

const defaults = { readingSize: 'standard', motion: 'system', externalAi: 'deepseek', theme: 'light', background: 'grid', backgroundImage: '', avatar: '', locale: 'zh-CN' };
function validate(body, request) {
  if (Object.keys(request.query).length) throw invalidInput('/query', 'unknown-field');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalidInput('/', 'invalid-type');
  for (const name of Object.keys(body)) if (!['baseVersion', 'values'].includes(name)) throw invalidInput(`/${name}`, 'unknown-field');
  if (!Number.isSafeInteger(body.baseVersion) || body.baseVersion < 1) throw invalidInput('/baseVersion', 'out-of-range');
  const values = body.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw invalidInput('/values', 'invalid-type');
  for (const name of Object.keys(values)) if (!Object.hasOwn(defaults, name)) throw invalidInput(`/values/${name}`, 'unknown-field');
  for (const [name, choices] of Object.entries({ readingSize: ['standard', 'large'], motion: ['system', 'reduce'], externalAi: ['deepseek', 'doubao'] })) {
    if (!choices.includes(values[name])) throw invalidInput(`/values/${name}`, 'out-of-range');
  }
  for (const [name, choices] of Object.entries({ theme: ['light', 'dark'], background: ['grid', 'parchment', 'circles', 'stripes', 'custom'], locale: ['zh-CN', 'en'] })) {
    if (Object.hasOwn(values, name) && !choices.includes(values[name])) throw invalidInput(`/values/${name}`, 'out-of-range');
  }
  if (Object.hasOwn(values, 'avatar') && (typeof values.avatar !== 'string' || values.avatar.length > 131072)) throw invalidInput('/values/avatar', 'out-of-range');
  return body;
}

async function validateAvatar(avatar) {
  if (avatar === undefined || avatar === '') return;
  if (typeof avatar !== 'string' || avatar.length > 131072 || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar)) throw invalidInput('/values/avatar', 'out-of-range');
  try {
    const bytes = Buffer.from(avatar.slice(23), 'base64');
    const metadata = await sharp(bytes, { limitInputPixels: 256 * 256, animated: true }).metadata();
    if (metadata.format !== 'webp' || metadata.width > 256 || metadata.height > 256 || (metadata.pages || 1) !== 1) throw new Error('Invalid avatar');
  } catch {
    throw invalidInput('/values/avatar', 'out-of-range');
  }
}

async function validateBackground(image) {
  if (image === undefined || image === '') return;
  const match = typeof image === 'string' && image.length <= 3145728 && image.match(/^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw invalidInput('/values/backgroundImage', 'out-of-range');
  try {
    const bytes = Buffer.from(match[2], 'base64');
    const metadata = await sharp(bytes, { limitInputPixels: 4096 * 4096, animated: true }).metadata();
    if (metadata.format !== match[1] || (metadata.pages || 1) !== 1) throw new Error('Invalid background');
    await sharp(bytes, { limitInputPixels: 4096 * 4096 }).stats();
  } catch {
    throw invalidInput('/values/backgroundImage', 'out-of-range');
  }
}

export function createPreferencesRouter({ db, mutations, identity, trustedOrigins, ready, logger, clock = () => new Date() }) {
  const router = express.Router();
  const guards = createGuards({ identity, trustedOrigins });
  function read(principal) {
    const row = db.prepare('SELECT * FROM reliability_preferences WHERE accountKey = ?').get(principal.accountKey);
    return row ? { version: row.version, values: { ...defaults, ...JSON.parse(row.valuesJson) }, updatedAt: row.updatedAt }
      : { version: 1, values: { ...defaults }, updatedAt: null };
  }
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/preferences', guards.identityGuard, asyncHandler(async (req, res) => {
    await ready();
    if (Object.keys(req.query).length) throw invalidInput('/query', 'unknown-field');
    res.json(read(req.workbenchPrincipal));
  }));
  router.put('/preferences', guards.originGuard, guards.protectionGuard, guards.identityGuard,
    // Images are decoded before the receipt lookup; a replay resends the same valid images, so its result is unchanged.
    express.json({ limit: '3400kb' }), asyncHandler(async (req, res, next) => { await ready(); await validateAvatar(req.body?.values?.avatar); await validateBackground(req.body?.values?.backgroundImage); next(); }),
    createMutationHandler({ mutations, method: 'PUT', validate, write({ principal, body }) {
      const current = read(principal);
      if (body.baseVersion !== current.version) throw contractError(problems.versionConflict(current.version));
      const next = { version: current.version + 1, values: { ...current.values, ...body.values }, updatedAt: clock().toISOString() };
      db.prepare(`INSERT INTO reliability_preferences VALUES (?, ?, ?, ?)
        ON CONFLICT(accountKey) DO UPDATE SET version=excluded.version, valuesJson=excluded.valuesJson, updatedAt=excluded.updatedAt`)
        .run(principal.accountKey, next.version, JSON.stringify(next.values), next.updatedAt);
      return { status: 200, body: next };
    } }));
  router.use(createWorkbenchErrorHandler({ logger }));
  return router;
}
