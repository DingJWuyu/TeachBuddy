import { useEffect, useRef, useState } from 'react';
import { defaultNavigation, includeNewNavigationModules, validNavigation } from '@teachbuddy/shared';
import { workbenchGet, workbenchPut, WorkbenchError } from '../../platform/http/apiClient.js';
import { unconfirmedProblem } from '../../platform/http/problems.js';
import { readLocal } from '../../platform/device/storage.js';
import { useSavableDocument } from '../../platform/saving/useSavableDocument.js';
import { useScene } from '../../platform/device/useScene.js';

const path = '/api/workbench/navigation';
function checked(value, submitted) {
  if (!value || value.id !== 'navigation' || !Number.isSafeInteger(value.version) || value.version < 1 ||
      !validNavigation(value.layout) || !(value.updatedAt === null || (typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)))) ||
      (submitted && (value.updatedAt === null || value.version !== submitted.baseVersion + 1 || JSON.stringify(value.layout) !== JSON.stringify(submitted.layout))))
    throw new WorkbenchError(unconfirmedProblem('导航布局返回内容无法确认'));
  return value;
}
function fromLegacy(legacy) {
  if (!legacy) return null;
  const value = { structureVersion: 1, defaultLayoutVersion: 1,
    groups: legacy.groups?.map(({ id, name, moduleIds }) => ({ id, name, moduleIds })), hiddenModuleIds: legacy.hiddenModuleIds };
  if (!validNavigation(value)) throw new WorkbenchError(unconfirmedProblem('此设备的原导航无法读取，原布局已保留'));
  return includeNewNavigationModules(value);
}

export function useNavigation(accountKey, generation) {
  const [legacy] = useState(() => readLocal(accountKey, 'scene:restored-navigation')?.layout);
  const [device, patchDevice] = useScene(accountKey, 'navigation-view', {
    collapsed: Object.fromEntries((legacy?.groups ?? []).map(g => [g.id, Boolean(g.collapsed)]))
  });
  const [reload, setReload] = useState(0);
  const initialized = useRef(false);
  const approvedVersion = useRef(null);
  const savable = useSavableDocument({ accountKey, generation: `${generation}:${reload}`, kind: 'navigation', draftId: 'account',
    load: async () => {
      const value = checked((await workbenchGet(path)).body);
      // An unreadable device layout fails the read, so the default is never saved over it.
      if (value.updatedAt === null) fromLegacy(legacy);
      return value;
    },
    update: async ({ key, payload }) => checked((await workbenchPut(path, payload, key)).body, payload),
    inputFromObject: value => value.layout,
    buildUpdate: (layout, baseline) => ({ baseVersion: approvedVersion.current ?? baseline.version, layout })
  });
  useEffect(() => {
    // Claim an unsaved account only after a successful read. The version check
    // protects simultaneous first-use imports from two older devices.
    if (savable.loadState !== 'ready') return;
    if (!initialized.current && savable.status === 'clean' && savable.baseline?.updatedAt === null) {
      initialized.current = true;
      const input = fromLegacy(legacy) ?? savable.input;
      savable.setInput(input);
      void savable.save({ input });
    } else if (savable.status === 'dirty' && savable.baseline && !savable.pending) void savable.save();
  }, [savable.loadState, savable.status, savable.input, savable.baseline, savable.pending, savable.save, savable.setInput, legacy]);
  useEffect(() => {
    if (savable.status === 'conflict' && !savable.pending) void savable.refreshServer();
  }, [savable.status, savable.pending, savable.refreshServer]);

  const raw = includeNewNavigationModules(savable.input ?? defaultNavigation());
  return {
    ...savable, raw, device,
    editable: savable.loadState === 'ready' && Boolean(savable.baseline) && savable.status !== 'identity',
    change: recipe => savable.setInput(current => {
      const next = structuredClone(includeNewNavigationModules(current));
      recipe(next);
      return next;
    }),
    reset: () => savable.setInput(defaultNavigation()),
    toggleGroup: id => patchDevice(current => ({ collapsed: { ...current.collapsed, [id]: !current.collapsed[id] } })),
    retryLoad: () => setReload(value => value + 1),
    keepLocal: async () => {
      if (!savable.serverObject || savable.pending) return;
      // Keep the local layout against the version the teacher compared; a newer change elsewhere conflicts again.
      approvedVersion.current = savable.serverObject.version;
      try { await savable.save(); } finally { approvedVersion.current = null; }
    }
  };
}
