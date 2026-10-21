import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { contractError, problems, invalidInput } from '../problems.js';
import { validateSchema } from '../content/schema.js';

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function storageError() {
  return Object.assign(new Error('Managed file storage unavailable'), {
    status: 503,
    problem: {
      type: '/problems/materials/storage-unavailable',
      field: '',
      detail: '文件暂时不可读取或保存，请保留原请求重试。'
    }
  });
}
function account(principal) {
  if (!principal?.accountKey) throw contractError(problems.unauthenticated());
  return principal.accountKey;
}
function syncDirectory(directory) {
  const fd = fs.openSync(directory, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
async function detect(bytes) {
  let detected;
  try {
    detected = await fileTypeFromBuffer(bytes);
  } catch {
    /* opaque files remain downloadable */
  }
  if (detected?.mime === 'application/x-cfb') {
    if (bytes.includes(Buffer.from('PowerPoint Document', 'utf16le'))) return 'application/vnd.ms-powerpoint';
    if (bytes.includes(Buffer.from('WordDocument', 'utf16le'))) return 'application/msword';
  }
  if (detected) return detected.mime;
  const text = bytes.toString('utf8');
  if (!text.includes('\u0000') && Buffer.from(text).equals(bytes)) {
    return /^\s*(?:<!doctype\s+html|<html\b|<script\b)/i.test(text) ? 'text/html' : 'text/plain';
  }
  return 'application/octet-stream';
}

export function createFiles({ db, mutations, directory, clock = () => new Date() }) {
  const staging = path.join(directory, 'staging');
  const blobs = path.join(directory, 'blobs');
  function initialize() {
    fs.mkdirSync(staging, { recursive: true });
    fs.mkdirSync(blobs, { recursive: true });
    // Only uncommitted staging files belong to cleanup. Committed/orphan blobs stay.
    for (const name of fs.readdirSync(staging)) {
      if (/^[0-9a-f-]{36}\.part$/.test(name)) fs.unlinkSync(path.join(staging, name));
    }
  }
  function row(principal, id) {
    validateSchema('Id', id, '/path/id');
    const result = db
      .prepare('SELECT * FROM materials_files WHERE accountKey = ? AND id = ?')
      .get(account(principal), id);
    if (!result) throw contractError(problems.notFound());
    return result;
  }
  function read(principal, id) {
    const metadata = JSON.parse(row(principal, id).metadata);
    readBytes(principal, id);
    return metadata;
  }
  function readBytes(principal, id) {
    const record = row(principal, id);
    try {
      const bytes = fs.readFileSync(path.join(blobs, record.blobName));
      const metadata = JSON.parse(record.metadata);
      if (bytes.length !== metadata.byteLength || digest(bytes) !== metadata.sha256)
        throw storageError();
      return bytes;
    } catch {
      throw storageError();
    }
  }
  async function store(principal, { name, bytes }, mutation) {
    const accountKey = account(principal);
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array))
      throw invalidInput('/file', 'invalid-type');
    bytes = Buffer.from(bytes);
    if (bytes.length > MAX_FILE_BYTES) throw contractError(problems.payloadTooLarge());
    const mediaType = await detect(bytes);
    const sha256 = digest(bytes);
    const id = randomUUID();
    const metadata = {
      id,
      name,
      mediaType,
      byteLength: bytes.length,
      sha256,
      createdAt: clock().toISOString(),
      duplicateOfFileId: null
    };
    validateSchema('File', metadata);
    if (imageTypes.has(mediaType)) {
      try {
        await sharp(bytes, { limitInputPixels: 40000000 }).raw().toBuffer();
      } catch {
        throw invalidInput('/file', 'out-of-range');
      }
    }
    validateSchema('Id', mutation?.key, '/headers/Idempotency-Key');
    let result;
    try {
      result = mutations.execute(
        {
          principal,
          key: mutation.key,
          method: mutation.method,
          path: mutation.path,
          body: { name, mediaType, sha256 }
        },
        () => {
          const duplicate = db
            .prepare(
              'SELECT id FROM materials_files WHERE accountKey = ? AND sha256 = ? ORDER BY rowid LIMIT 1'
            )
            .get(accountKey, sha256);
          if (duplicate) {
            readBytes(principal, duplicate.id);
            metadata.duplicateOfFileId = duplicate.id;
          }
          const temporary = path.join(staging, `${id}.part`);
          const blobName = `${id}.blob`;
          let fd;
          try {
            fd = fs.openSync(temporary, 'wx', 0o600);
            fs.writeFileSync(fd, bytes);
            fs.fsyncSync(fd);
            fs.closeSync(fd);
            fd = undefined;
            const written = fs.readFileSync(temporary);
            if (written.length !== bytes.length || digest(written) !== sha256) throw storageError();
            fs.renameSync(temporary, path.join(blobs, blobName));
            syncDirectory(blobs);
            syncDirectory(staging);
            db.prepare('INSERT INTO materials_files VALUES (?, ?, ?, ?, ?)').run(
              id,
              accountKey,
              JSON.stringify(metadata),
              blobName,
              sha256
            );
            return { status: 201, body: metadata };
          } finally {
            if (fd !== undefined) fs.closeSync(fd);
            fs.rmSync(temporary, { force: true });
          }
        }
      );
    } catch (error) {
      if (error.problem) throw error;
      throw storageError();
    }
    // A committed response is replayable, but cannot claim a damaged blob is usable.
    readBytes(principal, result.body.id);
    return result.body;
  }
  return {
    accountWorkDirectory(principal) {
      mutations.assertAccountActive(principal);
      const target = path.join(directory, 'work', digest(Buffer.from(principal.accountKey)));
      fs.mkdirSync(target, { recursive: true, mode: 0o700 });
      return target;
    },
    temporaryDirectory(principal, prefix) {
      const target = this.accountWorkDirectory(principal);
      return fs.mkdtempSync(path.join(target, prefix));
    },
    accountFileNames(accountKey) {
      return db.prepare('SELECT DISTINCT blobName FROM materials_files WHERE accountKey=?').all(accountKey)
        .map(row => row.blobName);
    },
    removeAccountFiles(accountKey, names) {
      for (const name of names) {
        if (!/^[0-9a-f-]+\.blob$/.test(name)) throw storageError();
        if (db.prepare('SELECT 1 FROM materials_files WHERE blobName=? AND accountKey<>?').get(name, accountKey)) continue;
        fs.rmSync(path.join(blobs, name), { force: true });
      }
      fs.rmSync(path.join(directory, 'work', digest(Buffer.from(accountKey))), { recursive: true, force: true });
      syncDirectory(blobs);
    },
    initialize,
    readBytes,
    store,
    read,
    open: async (principal, id) => Readable.from(readBytes(principal, id))
  };
}
