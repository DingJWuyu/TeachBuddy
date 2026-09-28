import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';

// Explicit replay of genuine E7/page-crop evidence, never a new model run.
// Source databases are read-only. Only the parent result and its own files
// are copied to the isolated test account; the child runs through real Jobs,
// preview and normalization with the recorded raw response.
export function loadRegionReplay(root = process.env.LESSONS_REGION_REPLAY_ROOT) {
  assert(root, 'Set LESSONS_REGION_REPLAY_ROOT to the preview .scratch directory');
  const parentDirectory = path.join(root, 'ocr-quality/real-http/data');
  const cropDirectory = path.join(root, 'ocr-quality/real-http/pages/E7-table');
  const child = JSON.parse(fs.readFileSync(path.join(cropDirectory, 'result.json')));
  const raw = JSON.parse(fs.readFileSync(path.join(cropDirectory, 'raw.json')));
  const binding = { fileId: 'c541d3dc-7286-4798-9cbd-2ad630941cbe', renditionFileId: 'c541d3dc-7286-4798-9cbd-2ad630941cbe', page: 7 };
  const parentResultId = '62120256-b63b-4ca1-b14d-3b50f5f09938';
  const imageId = 'fd76ed2a-832f-482a-b2ed-98c2f6526a6d';
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(child.inputHash, '0cb40b5e637df8adc5741152359aa2e1236af99e685000ab3b691c66919dd083');
  const evidence = { binding, parentResultId, imageId, child, replays: 0, beforeReplay: null };
  evidence.recognizer = { revision: child.revision, async run(input) {
    assert.equal(digest(input.bytes), child.inputHash, 'Replay must match the genuine crop preview bytes');
    assert.equal(input.width, 471); assert.equal(input.height, 199);
    evidence.replays++;
    await evidence.beforeReplay?.(input);
    return { width: 471, height: 199, assets: [], raw: structuredClone(raw) };
  } };
  evidence.seed = (world, accountKey) => {
    const source = new Database(path.join(parentDirectory, 'workspace.sqlite'), { readonly: true, fileMustExist: true });
    try {
      const row = source.prepare('SELECT * FROM materials_recognition_results WHERE id=?').get(parentResultId);
      const parent = JSON.parse(row.value);
      assert.equal(parent.inputHash, '934c2731ee57be52daabe03572f57389747866f45c79e8fde3bc3c08bab8f774');
      assert.equal(parent.document.blocks[0].rows[2][1].blocks[3].fileId, imageId);
      const rendition = source.prepare('SELECT value FROM materials_renditions WHERE fileId=? AND renditionId=?').get(binding.fileId, binding.renditionFileId);
      const preview = { ...JSON.parse(rendition.value), jobId: null };
      const needed = new Set([binding.fileId, binding.renditionFileId, parent.rawFileId, ...parent.assetFileIds, ...preview.pages.map(p => p.imageFileId)]);
      const blobs = path.join(world.directory, 'files/blobs'); fs.mkdirSync(blobs, { recursive: true });
      for (const id of needed) {
        const file = source.prepare('SELECT * FROM materials_files WHERE id=?').get(id);
        assert.equal(file.accountKey, row.accountKey);
        const bytes = fs.readFileSync(path.join(parentDirectory, 'files/blobs', file.blobName));
        assert.equal(digest(bytes), file.sha256);
        if (id === binding.fileId) assert.equal(file.sha256, 'b8d34a6aa76a59adfee125c8efb0a12620dffbb797666cbcc6c41b07390d082a');
        if (id === imageId) assert.equal(file.sha256, 'ddee3e0408bc9163f9cb6baaeb51bfc684364c63f7b6479b143a9cee15aa870b');
        fs.writeFileSync(path.join(blobs, file.blobName), bytes);
        world.workbench.db.prepare('INSERT INTO materials_files VALUES (?,?,?,?,?)')
          .run(id, accountKey, file.metadata, file.blobName, file.sha256);
      }
      assert.equal(source.prepare('SELECT sha256 FROM materials_files WHERE id=?').get(preview.pages[6].imageFileId).sha256, parent.inputHash);
      world.workbench.db.prepare('INSERT INTO materials_previews VALUES (?,?,?)').run(binding.fileId, accountKey, JSON.stringify(preview));
      world.workbench.db.prepare('INSERT INTO materials_renditions VALUES (?,?,?,?)').run(binding.fileId, binding.renditionFileId, accountKey, JSON.stringify(preview));
      world.workbench.db.prepare('INSERT INTO materials_recognition_results VALUES (?,?,?,?,?)').run(row.id, accountKey, row.inputHash, row.revision, row.value);
      return { parent, preview };
    } finally { source.close(); }
  };
  return evidence;
}

export function blankCells(document) {
  return document.blocks[0].rows.flat().filter(cell => cell.blocks.every(block => !(block.runs ?? []).some(run => (run.text ?? run.latex ?? '').trim()))).length;
}
