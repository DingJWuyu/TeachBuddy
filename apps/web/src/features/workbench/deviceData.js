import { pendingStore } from '../resources/client.js';
import { uploadDraft } from '../math/uploadDraft.js';
import { currentEditorBranch, listLocalNames, resetLocalReaders, selectLocalSnapshots } from './storage.js';
const retiredScene = name => /(?:^|:)class(?:-|:)|classes|course-feedback|lesson|material-navigation|math-return|questions-return-focus/.test(name);
const prefix = account => `tb.workbench.v1:${account}:`;
const moduleOf = name => /question/.test(name) ? 'questions'
  : /resource/.test(name) ? 'resources' : /math/.test(name) ? 'math'
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
      if (entry.name.startsWith('branch:') && entry.value?.formatVersion === 2) {
        entry.branch = entry.value.editorBranchId;
        entry.logicalName = entry.value.name;
        entry.updatedAt = entry.value.updatedAt;
        entry.value = entry.value.value;
      }
      entry.unreadable = entry.value?.formatVersion > 2;
      entry.pending = (!entry.name.startsWith('head:') && /pending/.test(entry.name) && Boolean(entry.value)) || hasPending(entry.value);
      entry.draft = /draft/.test(entry.name) || Boolean((entry.value?.draft && entry.value.status !== '已保存') || (entry.value?.editor && JSON.stringify(entry.value.editor.drafts) !== JSON.stringify(entry.value.editor.baseline)) || Object.keys(entry.value?.drafts ?? {}).length || ((entry.value?.creating || entry.value?.renaming) && entry.value.name));
    } catch { entry.unreadable = true; }
  }
  const [resourcePending, mathPending] = await Promise.all([pendingStore(account), uploadDraft(account, 'get')]);
  const protectedModules = new Set(entries.filter(entry => entry.pending || entry.unreadable).map(entry => entry.module));
  if (resourcePending) protectedModules.add('resources');
  if (mathPending) protectedModules.add('math');
  for (const entry of entries) entry.keep = entry.unreadable || protectedModules.has(entry.module);
  const unique = [...new Map(entries.filter(entry => !entry.name.startsWith('head:')).map(entry => [JSON.stringify([entry.name.replace(/^branch:[^:]+:/, ''), entry.value]), entry])).values()];
  const groups = new Map();
  for (const entry of entries.filter(entry => entry.branch && entry.branch !== currentEditorBranch() && !entry.unreadable && !retiredScene(entry.logicalName ?? entry.name))) {
    const id = `${entry.branch}:${entry.module}`;
    if (!groups.has(id)) groups.set(id, { id, module: entry.module, updatedAt: entry.updatedAt, entries: [] });
    const group = groups.get(id); group.entries.push(entry);
    if (entry.updatedAt > group.updatedAt) group.updatedAt = entry.updatedAt;
  }
  const candidates = [...groups.values()].filter(group => group.entries.some(entry => entry.draft || entry.pending))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const signatures = new Set();
  const recoveryCandidates = candidates.filter(group => {
    const signature = JSON.stringify(group.entries.map(entry => [entry.logicalName, entry.value]).sort((a, b) => a[0].localeCompare(b[0])));
    if (signatures.has(signature)) return false;
    signatures.add(signature); return true;
  });
  const extraPending = Number(Boolean(resourcePending) && !unique.some(entry => entry.module === 'resources' && entry.pending))
    + Number(Boolean(mathPending) && !unique.some(entry => entry.module === 'math' && entry.pending));
  return { entries, recoveryCandidates, pendingCount: unique.filter(entry => entry.pending).length + extraPending,
    unreadableCount: unique.filter(entry => entry.unreadable).length,
    draftCount: unique.filter(entry => entry.draft).length,
    removableCount: entries.filter(entry => !entry.keep).length,
    retainedCount: entries.filter(entry => entry.keep).length + Number(Boolean(resourcePending)) + Number(Boolean(mathPending)) };
}
export function resumeDeviceCandidate(account, inventory, candidate) {
  const names = [...new Set(inventory.entries.filter(entry => entry.module === candidate.module && !entry.name.startsWith('head:'))
    .map(entry => entry.logicalName ?? entry.name))];
  selectLocalSnapshots(account, names, candidate.entries);
  return ({ questions: '/questions', resources: '/resources', math: '/math',
    schedule: '/calendar', preferences: '/settings', shell: '/' })[candidate.module] ?? '/';
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
  store.setItem(`tb.device.clear:${account}`, crypto.randomUUID());
  resetLocalReaders(account);
  return inventory;
}
export function downloadDeviceData(account, inventory) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ accountKey: account,
    savedAt: new Date().toISOString(), records: inventory.entries.map(({ name, raw }) => ({ name, raw })) }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'teachbuddy-device-drafts.json'; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
