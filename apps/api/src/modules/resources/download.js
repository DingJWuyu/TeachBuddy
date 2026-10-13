import fs from 'node:fs';
import path from 'node:path';
import { pipeline, finished } from 'node:stream/promises';
import { ZipFile } from 'yazl';
import { validateSchema } from '../../workbench/content/schema.js';
import { validateNoQuery } from '../../workbench/schema.js';
import { asyncHandler } from '../../workbench/http.js';
import { contractError, problems, invalidInput } from '../../workbench/problems.js';
import { storageError } from '../../workbench/files/index.js';

function entryName(original, used) {
  const safe = original.replace(/[\\/\x00-\x1f<>:"|?*]/g, '_').replace(/[. ]+$/g, '') || 'file';
  const extension = path.extname(safe), stem = safe.slice(0, safe.length - extension.length);
  let name = safe, count = 1;
  while (used.has(name.normalize('NFC').toLowerCase())) name = `${stem} (${++count})${extension}`;
  used.add(name.normalize('NFC').toLowerCase());
  return name;
}

export function mountResourceDownload(router, { db, files, read }) {
  router.post('/items/download', asyncHandler(async (req, res) => {
    if (!req.is('application/json')) throw contractError(problems.unsupportedMediaType());
    validateNoQuery(req.query);
    validateSchema('DownloadResources', req.body);
    const selection = req.body.items;
    if (new Set(selection.map(item => item.id)).size !== selection.length) throw invalidInput('/items', 'duplicate-id');
    const principal = req.workbenchPrincipal;
    // Resolve one consistent version selection before touching binary storage.
    const selected = db.transaction(() => selection.map(({ id, baseVersion }) => {
      const item = read(principal, id);
      if (item.version !== baseVersion) throw contractError(problems.versionConflict(item.version));
      return item.fileId;
    }))();
    const abort = new AbortController();
    const stop = () => { if (!res.writableFinished) abort.abort(); };
    res.on('close', stop);
    let directory;
    let zip;
    const inputs = new Set();
    try {
      directory = files.downloadDirectory(principal);
      const used = new Set(), entries = [];
      for (const [index, id] of selected.entries()) {
        abort.signal.throwIfAborted();
        const target = path.join(directory, String(index));
        const file = await files.copyVerified(principal, id, target, abort.signal);
        entries.push({ target, name: entryName(file.name, used), size: file.byteLength });
      }
      // A complete temporary ZIP makes failures before download explicit and
      // provides Content-Length, so truncated transfers cannot become a Blob.
      const target = path.join(directory, 'resources.zip');
      zip = new ZipFile();
      zip.on('error', error => zip.outputStream.destroy(error));
      const writing = pipeline(zip.outputStream, fs.createWriteStream(target, { flags: 'wx', mode: 0o600 }), { signal: abort.signal });
      for (const entry of entries) zip.addReadStreamLazy(entry.name, { compress: false, size: entry.size }, callback => {
        if (abort.signal.aborted) { callback(new Error('Download interrupted')); return; }
        const input = fs.createReadStream(entry.target);
        inputs.add(input);
        input.on('close', () => inputs.delete(input));
        callback(null, input);
      });
      zip.end();
      await writing;
      res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="resources.zip"',
        'Content-Length': String(fs.statSync(target).size), 'Cache-Control': 'no-store' });
      await pipeline(fs.createReadStream(target), res, { signal: abort.signal });
    } catch (error) {
      zip?.outputStream.destroy();
      if (res.headersSent || abort.signal.aborted) { res.destroy(); return; }
      if (error.problem) throw error;
      throw storageError();
    } finally {
      res.off('close', stop);
      const opened = [...inputs];
      for (const input of opened) input.destroy();
      await Promise.allSettled(opened.map(input => finished(input)));
      if (directory) fs.rmSync(directory, { recursive: true, force: true });
    }
  }));
}
