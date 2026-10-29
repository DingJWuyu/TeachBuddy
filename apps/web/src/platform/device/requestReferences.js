import { inspectLocalRecord } from './storage.js';

export const archivePrefix = account => `teachbuddy:data-recovery-archive:${account}:`;

export function readArchive(raw) {
  const archive = JSON.parse(raw);
  if (!archive || archive.formatVersion !== undefined || typeof archive.to !== 'string' || !archive.records ||
      typeof archive.records !== 'object' || Array.isArray(archive.records))
    throw new Error('Unknown recovery archive');
  return archive;
}

function references(account, records, binding) {
  const keys = new Set();
  let unknown = false;
  for (const [name, raw] of Object.entries(records)) {
    try {
      const record = inspectLocalRecord(account, name, raw);
      if (!record) continue;
      const owns = binding.slots ? record.name.startsWith(binding.name) : record.name === binding.name;
      if (!owns) continue;
      const key = record.value?.idbKey;
      if (typeof key !== 'string' || !key.startsWith(`${account}:`)) { unknown = true; continue; }
      keys.add(key);
    } catch { unknown = true; }
  }
  return { keys, unknown };
}

export function archivedRequestKeys(account, archive, binding) {
  return references(account, archive?.records ?? {}, binding).keys;
}

/** An unreadable owner is not evidence that the original bytes are unused. */
export function canReclaimRequest(account, binding, key) {
  try {
    const active = {};
    for (const name of Object.keys(localStorage)) {
      if (name.startsWith(`tb.workbench.v1:${account}:`)) active[name] = localStorage.getItem(name);
      if (name.startsWith(archivePrefix(account))) {
        const archive = readArchive(localStorage.getItem(name));
        const owners = references(account, archive.records, binding);
        if (owners.unknown || owners.keys.has(key)) return false;
      }
    }
    const owners = references(account, active, binding);
    return !owners.unknown && !owners.keys.has(key);
  } catch { return false; }
}
