import { randomUUID } from 'node:crypto';
import { validateSchema } from '../content/schema.js';
import { contractError, problems, invalidInput } from '../problems.js';
import { materialsError } from '../jobs/index.js';
import { normalizeRecognition } from './document.js';

const active = new Set(['queued', 'running', 'cancelling']);
const defaultRevision = 'mineru-pro-2605/document-6';

/** Owns immutable machine results. Consumers own every subsequent human edit. */
export function createRecognition({ db, files, readBytes, mutations, jobs, content, recognizer }) {
  const revision = recognizer?.revision ?? defaultRevision;
  const available = recognizer?.available ?? Boolean(recognizer);
  const inFlight = new Map();
  let closed = false, closing;

  function source(principal, { fileId, renditionFileId }) {
    files.read(principal, fileId);
    if (!renditionFileId) renditionFileId = files.preview(principal, fileId).renditionFileId;
    if (!renditionFileId) throw materialsError('preview-required', 409);
    const rendition = files.readRendition(principal, { fileId, renditionFileId });
    return { fileId, renditionFileId, pages: rendition.pages };
  }

  function pageSource(principal, input) {
    if (!Number.isInteger(input.page) || input.page < 1) throw invalidInput('/page', 'out-of-range');
    const frozen = source(principal, input);
    const page = frozen.pages.find(page => page.page === input.page);
    if (!page) throw invalidInput('/page', 'out-of-range');
    const image = files.read(principal, page.imageFileId);
    return { ...page, inputHash: image.sha256,
      location: { kind: 'page', fileId: frozen.fileId, renditionFileId: frozen.renditionFileId, page: page.page, box: null } };
  }

  function result(principal, inputHash) {
    if (!available) {
      const saved = db.prepare(`SELECT value FROM materials_recognition_results WHERE accountKey=? AND inputHash=?
        ORDER BY json_extract(value,'$.state')='ready' DESC,rowid DESC LIMIT 1`).get(principal.accountKey, inputHash);
      return saved ? JSON.parse(saved.value) : null;
    }
    const row = db.prepare('SELECT value FROM materials_recognition_results WHERE accountKey=? AND inputHash=? AND revision=?')
      .get(principal.accountKey, inputHash, revision);
    return row ? JSON.parse(row.value) : null;
  }
  function save(principal, value) {
    db.prepare(`INSERT INTO materials_recognition_results VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(accountKey,inputHash,revision) DO UPDATE SET value=excluded.value`)
      .run(value.resultId, principal.accountKey, value.inputHash, value.revision, JSON.stringify(value));
    return value;
  }
  function latestRequest(principal, frozen) {
    const row = db.prepare('SELECT jobId,value FROM materials_recognition_requests WHERE accountKey=? AND fileId=? AND renditionFileId=? ORDER BY rowid DESC LIMIT 1')
      .get(principal.accountKey, frozen.fileId, frozen.renditionFileId);
    return row ? { ...JSON.parse(row.value), job: jobs.get(principal, row.jobId) } : null;
  }

  function bindResult(principal, value, page) {
    if (value?.state === 'ready') {
      files.read(principal, value.rawFileId);
      value.assetFileIds.forEach(id => files.read(principal, id));
    }
    return { ...(value ?? { state: 'unprocessed', resultId: null, issues: [] }), location: page.location,
      imageFileId: page.imageFileId, width: page.width, height: page.height };
  }
  function readPage(principal, input) {
    const page = pageSource(principal, input);
    return bindResult(principal, result(principal, page.inputHash), page);
  }
  function get(principal, input) {
    const frozen = source(principal, input), request = latestRequest(principal, frozen);
    return { available, revision, fileId: frozen.fileId, renditionFileId: frozen.renditionFileId,
      jobId: request?.job.id ?? null,
      pages: frozen.pages.map(page => {
        const value = readPage(principal, { ...frozen, page: page.page });
        const requested = request?.pages.includes(page.page) && active.has(request.job.state);
        return { page: page.page, state: value.state === 'ready' ? 'ready' : requested ? request.job.state : value.state,
          resultId: value.resultId, issues: value.issues };
      }) };
  }

  function accept(principal, frozen, pages, mutation) {
    const job = jobs.enqueue({ principal, kind: 'recognition', target: { kind: 'file', id: frozen.fileId, version: null } }, mutation);
    db.prepare('INSERT INTO materials_recognition_requests VALUES (?, ?, ?, ?, ?)')
      .run(job.id, principal.accountKey, frozen.fileId, frozen.renditionFileId, JSON.stringify({
        fileId: frozen.fileId, renditionFileId: frozen.renditionFileId, pages, revision,
      }));
    return job;
  }
  function request(principal, input, mutation) {
    const { fileId, ...body } = input;
    validateSchema('RecognitionInput', body);
    const frozen = source(principal, input);
    if (new Set(input.pages).size !== input.pages.length || input.pages.some(number => !frozen.pages.some(page => page.page === number)))
      throw invalidInput('/pages', 'out-of-range');
    return mutations.execute({ principal, ...mutation, body }, () => {
      const existing = latestRequest(principal, frozen);
      if (existing && active.has(existing.job.state)) {
        if (input.pages.every(page => existing.pages.includes(page))) return { status: 202, body: existing.job };
        throw materialsError('job-running', 409);
      }
      const missing = input.pages.some(page => readPage(principal, { ...frozen, page }).state !== 'ready');
      if (missing && !available) throw materialsError('recognition-unavailable', 503);
      return { status: 202, body: accept(principal, frozen, input.pages, mutation) };
    }).body;
  }

  // Only a currently executing materials Job calls this method. In particular,
  // extraction must not enqueue a child Job and wait on the same serial pump.
  async function ensurePage(principal, input, { signal, retry = false } = {}) {
    signal?.throwIfAborted();
    if (closed) throw Object.assign(new Error('Recognition is closing'), { code: 'recognition-cancelled' });
    const page = pageSource(principal, input);
    const current = result(principal, page.inputHash);
    if (current?.state === 'ready') return readPage(principal, input);
    const key = `${principal.accountKey}/${page.inputHash}/${revision}`;
    if (inFlight.has(key)) return (await inFlight.get(key), readPage(principal, input));
    if (current && !retry) return readPage(principal, input);
    if (!available) return { ...readPage(principal, input), state: 'unavailable' };
    const work = (async () => {
      const value = save(principal, { resultId: current?.resultId ?? randomUUID(), revision,
        inputHash: page.inputHash, state: 'running', issues: [] });
      let abortStop;
      const stopAfterAbort = () => {
        abortStop ??= Promise.resolve().then(() => recognizer?.stopAccountAndWait?.(principal.accountKey));
        abortStop.catch(() => {});
      };
      // Runtime's page listener ends when it hands back the complete bytes.
      // Keep ownership cancellation connected while those bytes are persisted.
      signal?.addEventListener('abort', stopAfterAbort, { once: true });
      if (signal?.aborted) stopAfterAbort();
      try {
        const output = await recognizer.run({ accountKey: principal.accountKey, bytes: readBytes(principal, page.imageFileId), signal,
          width: page.width, height: page.height });
        // A completed late response is evidence, even after explicit cancel.
        // Persist it before the cancellation checkpoint; never publish it ready.
        if (!db.open) throw new Error('Recognition storage closed');
        const savedAssets = new Map();
        const storeAsset = async (name, bytes) => {
          return files.store(principal, { name, bytes }, { key: randomUUID(), method: 'POST', path: `/internal/recognition/${value.resultId}` });
        };
        const rawFile = await storeAsset('recognition.json', Buffer.from(JSON.stringify(output.raw)));
        value.rawFileId = rawFile.id;
        value.assetFileIds = [];
        value.originalAssetFileIds = [];
        for (const asset of output.assets ?? []) {
          const saved = await storeAsset(asset.name, asset.bytes);
          savedAssets.set(asset.name, saved);
          value.assetFileIds.push(saved.id);
        }
        for (const asset of output.originalAssets ?? [])
          value.originalAssetFileIds.push((await storeAsset(asset.name, asset.bytes)).id);
        value.assetFileIds.push(...value.originalAssetFileIds);
        value.derivations = output.derivations ?? [];
        if (output.termination) throw Object.assign(new Error('Recognition terminated after complete output'), { code: output.termination.code });
        signal?.throwIfAborted();
        const normalized = await normalizeRecognition({ result: output, storeAsset: async name => savedAssets.get(name) });
        if (!normalized.text.trim() && !normalized.assetFileIds.length)
          throw Object.assign(new Error('No recognized content'), { code: 'empty-response' });
        content.validate(principal, normalized.document);
        signal?.throwIfAborted();
        save(principal, { ...value, ...normalized, rawFileId: rawFile.id, state: 'ready',
          issues: [...normalized.issues, ...value.derivations.flatMap(derivation =>
            (derivation.issues ?? []).map(issue => ({ ...issue, assetName: derivation.name })))],
          assetFileIds: value.assetFileIds, originalAssetFileIds: value.originalAssetFileIds,
          derivations: output.derivations ?? [] });
        return readPage(principal, input);
      } catch (error) {
        try { await abortStop; } catch (stopError) { error = stopError; }
        const cleanupFailed = error?.code === 'recognition-cleanup';
        const timedOut = error?.code === 'recognition-timeout';
        if (db.open) save(principal, { ...value, state: (signal?.aborted || error?.code === 'recognition-cancelled') && !cleanupFailed && !timedOut ? 'interrupted' : 'failed',
          issues: [{ code: cleanupFailed || timedOut ? error.code : signal?.aborted ? 'interrupted' : error.code ?? 'recognition-failed',
            detail: cleanupFailed ? '尚未确认识别进程停止，请稍后重试。' : '本页未完成识别，原稿仍保留。' }] });
        if (cleanupFailed) throw error;
        if (signal?.aborted) throw signal.reason;
        return readPage(principal, input);
      } finally {
        signal?.removeEventListener('abort', stopAfterAbort);
      }
    })();
    inFlight.set(key, work);
    try { return await work; } finally { inFlight.delete(key); }
  }

  function readResult(principal, id, input) {
    validateSchema('Id', id);
    const page = pageSource(principal, input);
    const row = db.prepare('SELECT value FROM materials_recognition_results WHERE id=? AND accountKey=? AND inputHash=?')
      .get(id, principal.accountKey, page.inputHash);
    const value = row ? JSON.parse(row.value) : null;
    if (value?.state !== 'ready') throw contractError(problems.notFound());
    return bindResult(principal, value, page);
  }
  const handler = {
    async run({ principal, job, signal, reportProgress }) {
      const row = db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=? AND accountKey=?').get(job.id, principal.accountKey);
      if (!row) throw new Error('Missing recognition request');
      const input = JSON.parse(row.value);
      if (input.revision !== revision) return { state: 'failed', outputFileIds: [], issues: [{ code: 'provider-unavailable', unitId: null, field: null, detail: '识别环境已变更，请重新发起识别。' }] };
      const issues = [], outputFileIds = [];
      const bindLate = (page, late) => {
        if (!late.rawFileId) return;
        input.lateResult = { page, rawFileId: late.rawFileId, assetFileIds: late.assetFileIds ?? [],
          originalAssetFileIds: late.originalAssetFileIds ?? [], derivations: late.derivations ?? [] };
        db.prepare('UPDATE materials_recognition_requests SET value=? WHERE jobId=? AND accountKey=?')
          .run(JSON.stringify(input), job.id, principal.accountKey);
        outputFileIds.push(late.rawFileId);
      };
      let completed = 0, readyPages = 0;
      for (const page of input.pages) {
        let value;
        try {
          signal.throwIfAborted();
          value = await ensurePage(principal, { ...input, page }, { signal, retry: true });
          signal.throwIfAborted();
        } catch (error) {
          if (error?.code === 'recognition-cleanup') throw error;
          if (!signal.aborted || !db.open) throw error;
          const late = readPage(principal, { ...input, page });
          bindLate(page, late);
          issues.push({ code: 'cancelled', unitId: `page:${page}`, field: null, detail: '识别已停止，返回的原始结果仅保留为任务证据。' });
          return { state: outputFileIds.length ? 'partial' : 'failed', outputFileIds, issues };
        }
        const terminated = value.issues?.some(issue => ['recognition-timeout', 'recognition-cancelled'].includes(issue.code));
        if (value.state === 'ready') { outputFileIds.push(value.rawFileId); readyPages++; }
        else {
          if (terminated) bindLate(page, value);
          issues.push({ code: 'conversion-failed', unitId: `page:${page}`, field: null, detail: '本页未完成识别，可重试。' });
        }
        reportProgress({ completed: ++completed, total: input.pages.length, unit: 'pages' });
        if (terminated) return { state: readyPages ? 'partial' : 'failed', outputFileIds, issues };
      }
      return { state: !issues.length ? 'succeeded' : readyPages ? 'partial' : 'failed', outputFileIds, issues };
    },
    retry({ principal, job, unitIds, mutation }) {
      const row = db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=? AND accountKey=?').get(job.id, principal.accountKey);
      if (!row) throw contractError(problems.notFound());
      const input = JSON.parse(row.value), frozen = source(principal, input);
      if (input.revision !== revision) throw materialsError('job-not-retryable', 409, '', '识别环境已变更，请重新发起识别。');
      const existing = latestRequest(principal, frozen);
      if (existing && active.has(existing.job.state)) throw materialsError('job-running', 409);
      if (!available) throw materialsError('recognition-unavailable', 503);
      const pages = input.pages.filter(page => (!unitIds.length || unitIds.includes(`page:${page}`)) && readPage(principal, { ...input, page }).state !== 'ready');
      if (!pages.length) throw materialsError('job-not-retryable', 409);
      return accept(principal, frozen, pages, mutation);
    },
  };
  return { get, readPage, readResult, request, ensurePage, jobHandlers: { recognition: handler },
    async cleanupAccount(accountKey) {
      await Promise.allSettled([...inFlight.entries()]
        .filter(([key]) => key.startsWith(`${accountKey}/`)).map(([, work]) => work));
      await recognizer?.cleanupAccount?.(accountKey);
    },
    close() {
      if (closing) return closing;
      closed = true;
      closing = (async () => {
        let stopError;
        try { await recognizer?.close?.(); } catch (error) { stopError = error; }
        const settled = await Promise.allSettled([...inFlight.values()]);
        const failedCleanup = settled.find(value => value.status === 'rejected' && value.reason?.code === 'recognition-cleanup');
        if (stopError) throw stopError;
        if (failedCleanup) throw failedCleanup.reason;
      })();
      closing.catch(() => { closing = undefined; });
      return closing;
    },
    initialize() {
      for (const row of db.prepare("SELECT accountKey,value FROM materials_recognition_results WHERE json_extract(value,'$.state')='running'").all()) {
        const value = JSON.parse(row.value);
        save({ accountKey: row.accountKey }, { ...value, state: 'interrupted', issues: [{ code: 'interrupted', detail: '服务重启，未自动重发。' }] });
      }
    },
  };
}
