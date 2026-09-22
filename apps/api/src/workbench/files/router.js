import { materialJsonRoute, materialErrors } from '../jobs/router.js';
import express from 'express';
import busboy from 'busboy';
import { pipeline } from 'node:stream/promises';
import {
  createGuards,
  asyncHandler,
  readIdempotencyKey,
  canonicalRequestPath,
  createWorkbenchErrorHandler
} from '../http.js';
import { contractError, problems, invalidInput, sendProblem } from '../problems.js';
import { MAX_FILE_BYTES } from './index.js';

function upload(req) {
  if (!/^multipart\/form-data(?:;|$)/i.test(req.get('content-type') ?? ''))
    throw contractError(problems.unsupportedMediaType());
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = busboy({
        headers: req.headers,
        defParamCharset: 'utf8',
        limits: { files: 1, fields: 0, parts: 2, fileSize: MAX_FILE_BYTES + 1 }
      });
    } catch {
      reject(contractError(problems.malformedJson()));
      return;
    }
    let file, error;
    const fail = (value) => {
      error ??= value;
    };
    parser.on('file', (field, stream, info) => {
      if (field !== 'file') fail(invalidInput(`/${field}`, 'unknown-field'));
      const chunks = [];
      stream.on('data', (chunk) => {
        if (!error) chunks.push(chunk);
      });
      stream.on('limit', () => fail(contractError(problems.payloadTooLarge())));
      stream.on('error', reject);
      stream.on('end', () => {
        file = { name: info.filename, bytes: Buffer.concat(chunks) };
      });
    });
    parser.on('fieldsLimit', () => fail(invalidInput('/file', 'unknown-field')));
    parser.on('filesLimit', () => fail(invalidInput('/file', 'out-of-range')));
    parser.on('partsLimit', () => fail(invalidInput('/file', 'out-of-range')));
    parser.on('error', () => reject(contractError(problems.malformedJson())));
    req.once('aborted', () => {
      parser.destroy();
      reject(contractError(problems.malformedJson()));
    });
    parser.on('close', () =>
      error ? reject(error) : file ? resolve(file) : reject(invalidInput('/file', 'required'))
    );
    req.pipe(parser);
  });
}
export function createFilesRouter({ identity, trustedOrigins, files, ready, logger }) {
  const router = express.Router();
  const guards = createGuards({ identity, trustedOrigins });
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post(
    '/',
    guards.originGuard,
    guards.protectionGuard,
    guards.identityGuard,
    asyncHandler(async (req, res) => {
      await ready();
      const input = await upload(req);
      const key = readIdempotencyKey(req);
      const value = await files.store(req.workbenchPrincipal, input, {
        key,
        method: 'POST',
        path: canonicalRequestPath(req)
      });
      res.status(201).json(value);
    })
  );
  materialJsonRoute(router, '/crops', { guards, ready }, 'CropInput', 201, (req,m) => files.crop(req.workbenchPrincipal, req.body, m));
  materialJsonRoute(router, '/:id/preview', { guards, ready }, 'Empty', 202, (req,m) => files.requestPreview(req.workbenchPrincipal, req.params.id, m));
  router.get('/:id/preview', guards.identityGuard, asyncHandler(async (req,res) => { await ready(); res.json(files.preview(req.workbenchPrincipal, req.params.id)); }));
  router.get(
    '/:id',
    guards.identityGuard,
    asyncHandler(async (req, res) => {
      await ready();
      res.json(files.read(req.workbenchPrincipal, req.params.id));
    })
  );
  router.get(
    '/:id/content',
    guards.identityGuard,
    asyncHandler(async (req, res) => {
      await ready();
      const metadata = files.read(req.workbenchPrincipal, req.params.id);
      const stream = await files.open(req.workbenchPrincipal, req.params.id);
      res.set({
        'Content-Type': metadata.mediaType,
        'Content-Length': String(metadata.byteLength),
        'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(metadata.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'"
      });
      await pipeline(stream, res);
    })
  );
  router.use((error, req, res, next) =>
    error.problem?.type === '/problems/materials/storage-unavailable'
      ? sendProblem(res, error.status, error.problem)
      : next(error)
  );
  materialErrors(router, logger);
  return router;
}
