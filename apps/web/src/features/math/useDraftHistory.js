import { useMemo, useRef } from 'react';
import { createStore, useStore } from 'zustand';
import { temporal } from 'zundo';

// Only editable content travels through history. Server identity/version and
// pending request receipts always belong to the current work.
const content = draft => draft ? {
  title: draft.title, source: draft.source,
  htmlText: draft.htmlText, htmlUploadKey: draft.htmlUploadKey,
  parameterEdits: draft.parameterEdits,
} : null;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function useDraftHistory() {
  const store = useMemo(() => createStore(temporal(() => ({ content: null }), { limit: 100, equality: equal })), []);
  const canUndo = useStore(store.temporal, state => state.pastStates.length > 0);
  const canRedo = useStore(store.temporal, state => state.futureStates.length > 0);
  const group = useRef(null);
  function reset(draft) {
    const timeline = store.temporal.getState();
    timeline.pause(); store.setState({ content: content(draft) }); timeline.clear(); timeline.resume();
    group.current = null;
  }
  function record(before, after) {
    if (!equal(store.getState().content, content(before))) reset(before);
    const focused = document.activeElement;
    const typing = focused?.matches('input:not([type="checkbox"], [type="range"], [type="color"]), textarea, math-field');
    const now = Date.now();
    const grouped = typing && group.current?.field === focused && now - group.current.time < 700;
    const timeline = store.temporal.getState();
    if (grouped) timeline.pause();
    store.setState({ content: content(after) });
    if (grouped) timeline.resume();
    group.current = typing ? { field: focused, time: now } : null;
  }
  function move(direction, draft) {
    group.current = null;
    store.temporal.getState()[direction]();
    return { ...draft, ...store.getState().content };
  }
  return { canUndo, canRedo, record, reset, move };
}
