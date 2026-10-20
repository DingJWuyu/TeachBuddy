import { useEffect, useRef, useState } from 'react';
import { workbenchPost } from '../../platform/http/apiClient.js';
import { isDeletedAccount } from '../../platform/device/storage.js';

// Old cards may settle only the exact requests already authorized on this device.
export function useLegacyCardAction(agent, cardKey, card, enabled) {
  const storageKey = enabled && cardKey ? agent.prefix + 'card-action:' + cardKey : null;
  const slots = card.kind === 'plan' ? ['plan'] : card.kind === 'variant' ? ['question:0']
    : card.kind === 'practice' ? card.items.map((_, index) => `question:${index}`) : [];
  const path = card.kind === 'plan' ? '/api/modules/schedule/entries' : '/api/modules/questions/v2/items';
  function read() {
    if (!storageKey) return null;
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      if (!value || !value.requests || typeof value.requests !== 'object' || Array.isArray(value.requests)) return null;
      if (Object.entries(value.requests).some(([slot, request]) => !slots.includes(slot)
        || !request || request.path !== path || typeof request.key !== 'string' || !request.key.trim()
        || !request.body || typeof request.body !== 'object' || Array.isArray(request.body))) return null;
      return value;
    } catch { return null; }
  }
  const [record, setRecord] = useState(read);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const running = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, [storageKey]);
  const confirmed = record?.confirmed ?? {};
  const pending = Object.keys(record?.requests ?? {}).filter(slot => !Object.hasOwn(confirmed, slot));
  const done = record?.state === 'done';
  async function confirm() {
    if (running.current || done || !live.current || isDeletedAccount(agent.accountKey)) return;
    running.current = true; setBusy(true);
    try {
      for (const slot of slots) {
        const current = read();
        if (!current || current.state === 'done') break;
        const request = current.requests[slot];
        if (!request || Object.hasOwn(current.confirmed ?? {}, slot)) continue;
        const { body: result } = await workbenchPost(request.path, request.body, request.key);
        if (!live.current || isDeletedAccount(agent.accountKey)) return;
        const latest = read();
        if (!latest || JSON.stringify(latest.requests[slot]) !== JSON.stringify(request)) return;
        const next = { ...latest, confirmed: { ...latest.confirmed, [slot]: result } };
        if (slots.every(value => Object.hasOwn(next.confirmed, value))) next.state = 'done';
        localStorage.setItem(storageKey, JSON.stringify(next));
        setRecord(next);
      }
    } catch { /* Retain the original request for explicit confirmation retry. */ }
    finally { running.current = false; if (live.current) setBusy(false); }
  }
  return {
    state: done ? 'done' : busy ? 'busy' : 'readonly',
    legacyPending: !done && pending.length > 0,
    confirming: busy,
    confirm,
    operations: slots.flatMap((slot, index) => Object.hasOwn(confirmed, slot)
      ? [{ proposalSource: { slot: index }, state: 'confirmed' }] : []),
  };
}
