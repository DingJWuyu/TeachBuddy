import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

// A controlled parent document wraps a genuine, digest-bound E7 numeric-table
// crop response. This verifies consumers, not full-page OCR or a new model run.
// An override points directly at the portable fixture directory, never a DB.
export function loadRegionReplay(root = process.env.LESSONS_REGION_REPLAY_ROOT ?? fileURLToPath(new URL('./lessons-region/', import.meta.url))) {
  const read = name => fs.readFileSync(path.join(root, name));
  const child = JSON.parse(read('expected.json'));
  const raw = JSON.parse(read('raw.json'));
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest(read('recognizer-input.png')), child.inputHash);
  const fileId = randomUUID(), imageId = randomUUID(), parentResultId = randomUUID();
  const binding = { fileId, renditionFileId: fileId, page: 7 };
  const evidence = { binding, parentResultId, imageId, child, replays: 0, beforeReplay: null };
  evidence.recognizer = { revision: child.revision, async run(input) {
    assert.equal(digest(input.bytes), child.inputHash, 'Replay must match the genuine crop preview bytes');
    assert.equal(input.width, 471); assert.equal(input.height, 199);
    evidence.replays++;
    await evidence.beforeReplay?.(input);
    return { width: 471, height: 199, assets: [], raw: structuredClone(raw) };
  } };
  evidence.seed = (world, accountKey) => {
    const blobs = path.join(world.directory, 'files/blobs'); fs.mkdirSync(blobs, { recursive: true });
    const add = (name, mediaType, bytes, id = randomUUID()) => {
      const sha256 = digest(bytes), blobName = `${id}.blob`;
      const metadata = { id, name, mediaType, byteLength: bytes.length, sha256,
        createdAt: '2026-09-29T00:00:00.000Z', duplicateOfFileId: null };
      fs.writeFileSync(path.join(blobs, blobName), bytes);
      world.workbench.db.prepare('INSERT INTO materials_files VALUES (?,?,?,?,?)')
        .run(id, accountKey, JSON.stringify(metadata), blobName, sha256);
      return id;
    };
    add('controlled-lesson.pdf', 'application/pdf', read('source.pdf'), fileId);
    add('recorded-table.png', 'image/png', read('table.png'), imageId);
    const originalId = add('unselected-original.png', 'image/png', read('table.png'));
    const pages = Array.from({ length: 8 }, (_, i) => ({ page: i + 1, width: 707, height: 1000,
      imageFileId: add(`page-${i + 1}.png`, 'image/png', read(`page-${i + 1}.png`)) }));
    const preview = { fileId, renditionFileId: fileId, jobId: null, state: 'ready', pageCount: 8, pages, issues: [] };
    const document = { version: 2, blocks: [{ type: 'image', fileId: imageId, alt: '数值表', widthMm: 125 }] };
    const parent = { resultId: parentResultId, revision: child.revision, inputHash: digest(read('page-7.png')),
      state: 'ready', issues: [], rawFileId: add('controlled-parent.json', 'application/json', Buffer.from(JSON.stringify({ kind: 'controlled-parent', document }))),
      assetFileIds: [imageId, originalId], originalAssetFileIds: [originalId], derivations: [], document,
      text: '', blocks: [] };
    world.workbench.db.prepare('INSERT INTO materials_previews VALUES (?,?,?)').run(fileId, accountKey, JSON.stringify(preview));
    world.workbench.db.prepare('INSERT INTO materials_renditions VALUES (?,?,?,?)').run(fileId, fileId, accountKey, JSON.stringify(preview));
    world.workbench.db.prepare('INSERT INTO materials_recognition_results VALUES (?,?,?,?,?)')
      .run(parentResultId, accountKey, parent.inputHash, parent.revision, JSON.stringify(parent));
    return { parent, preview };
  };
  return evidence;
}

export function blankCells(document) {
  return document.blocks[0].rows.flat().filter(cell => cell.blocks.every(block => !(block.runs ?? []).some(run => (run.text ?? run.latex ?? '').trim()))).length;
}
