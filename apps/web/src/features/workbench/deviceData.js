import { pendingStore } from '../resources/client.js';
import { uploadDraft } from '../math/uploadDraft.js';
import { listLocalNames, resetLocalReaders } from './storage.js';
const prefix = account => `tb.workbench.v1:${account}:`;
const moduleOf = name => /question/.test(name) ? 'questions' : /lesson/.test(name) ? 'lessons'
  : /resource/.test(name) ? 'resources' : /math/.test(name) ? 'math' : /class|record/.test(name) ? 'classes'
    : /schedule|notification|feedback/.test(name) ? 'schedule' : /preference/.test(name) ? 'preferences' : 'shell';
function hasPending(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) =>
    (['pending', 'pendingRequest', 'pendingUpload'].includes(key) && Boolean(item)) || hasPending(item));
}
export async function inspectDeviceData(account) {
  const store = window.localStorage;
  const names = listLocalNames(account);
  const entries = names.map(name => ({ name, key: prefix(account) + name, module: moduleOf(name) }));
  const math = `teachbuddy.math.${account}`;
  if (store.getItem(math) !== null) entries.push({ name: 'math', key: math, module: 'math' });
  for (const entry of entries) {
    entry.raw = store.getItem(entry.key);
    try {
      entry.value = JSON.parse(entry.raw);
      if (entry.name.startsWith('branch:') && entry.value?.formatVersion === 2) entry.value = entry.value.value;
      entry.unreadable = entry.value?.formatVersion > 2;
      entry.pending = (!entry.name.startsWith('head:') && /pending/.test(entry.name) && Boolean(entry.value)) || hasPending(entry.value);
      entry.draft = /draft/.test(entry.name) || Boolean(entry.value?.draft || entry.value?.editor || Object.keys(entry.value?.drafts ?? {}).length);
    } catch { entry.unreadable = true; }
  }
  const [resourcePending, mathPending] = await Promise.all([pendingStore(account), uploadDraft(account, 'get')]);
  const protectedModules = new Set(entries.filter(entry => entry.pending || entry.unreadable).map(entry => entry.module));
  if (resourcePending) protectedModules.add('resources');
  if (mathPending) protectedModules.add('math');
  for (const entry of entries) entry.keep = entry.unreadable || protectedModules.has(entry.module);
  const unique = [...new Map(entries.filter(entry => !entry.name.startsWith('head:')).map(entry => [JSON.stringify([entry.name.replace(/^branch:[^:]+:/, ''), entry.value]), entry])).values()];
  return { entries, pendingCount: unique.filter(entry => entry.pending).length + Number(Boolean(resourcePending)) + Number(Boolean(mathPending)),
    unreadableCount: unique.filter(entry => entry.unreadable).length,
    draftCount: unique.filter(entry => entry.draft).length,
    removableCount: entries.filter(entry => !entry.keep).length,
    retainedCount: entries.filter(entry => entry.keep).length + Number(Boolean(resourcePending)) + Number(Boolean(mathPending)) };
}
export async function clearDeviceData(account) {
  // Re-read immediately before removing: never delete a newly pending operation.
  const inventory = await inspectDeviceData(account);
  const store = window.localStorage;
  for (const entry of inventory.entries.filter(entry => !entry.keep)) {
    if (store.getItem(entry.key) !== entry.raw) throw new Error('设备现场已变化，请重新检查后清理。');
    store.removeItem(entry.key);
    if (store.getItem(entry.key) !== null) throw new Error('浏览器未能清除设备资料，请重试。');
  }
  resetLocalReaders(account);
  return inventory;
}
export function downloadDeviceData(account, inventory) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ accountKey: account,
    savedAt: new Date().toISOString(), records: inventory.entries.map(({ name, raw }) => ({ name, raw })) }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'teachbuddy-device-drafts.json'; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
