import { useLayoutEffect, useRef, useState } from "react";
import { createStore, useStore } from "zustand";
import { temporal } from "zundo";

/** The saved document remains owned by useSavableDocument. Zundo tracks only
 * this editor's unsaved input; confirmed saves/server replacements start anew. */
export function useLessonHistory(document) {
  const [store] = useState(() => createStore(temporal(() => ({ input: null }), {
    limit: 100,
    equality: (a, b) => a.input === b.input,
  })));
  const canUndo = useStore(store.temporal, state => state.pastStates.length > 0);
  const canRedo = useStore(store.temporal, state => state.futureStates.length > 0);
  const latest = useRef(document);
  latest.current = document;
  const group = useRef(null);
  const baseline = useRef(null);
  const endGroup = () => { group.current = null; };
  useLayoutEffect(() => {
    const identity = `${document.baseline?.id}:${document.baseline?.version}`;
    if (store.getState().input !== document.input || identity !== baseline.current) {
      const history = store.temporal.getState();
      history.pause();
      store.setState({ input: document.input });
      history.clear();
      history.resume();
      baseline.current = identity;
      endGroup();
    }
  }, [document.input, document.baseline?.id, document.baseline?.version, store]);

  function setInput(updater) {
    latest.current.setInput(current => {
      const input = typeof updater === "function" ? updater(current) : updater;
      if (JSON.stringify(input) === JSON.stringify(current)) return current;
      const field = window.document.activeElement;
      const typing = field?.matches('textarea, input:not([type="checkbox"]):not([type="radio"])');
      const now = Date.now();
      const history = store.temporal.getState();
      const grouped = typing && group.current?.field === field && now - group.current.at < 750;
      if (grouped) history.pause();
      store.setState({ input });
      if (grouped) history.resume();
      group.current = typing ? { field, at: now } : null;
      return input;
    });
  }
  const busy = document.pending || ["saving", "conflict", "identity", "deleted", "loading"].includes(document.status);
  function travel(direction) {
    if (busy) return;
    endGroup();
    store.temporal.getState()[direction]();
    latest.current.setInput(store.getState().input);
  }
  function keydown(event) {
    if (event.nativeEvent?.isComposing || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    if (event.target.closest('[role="dialog"], [role="menu"]')) return;
    event.preventDefault();
    const direction = key === "y" || event.shiftKey ? "redo" : "undo";
    travel(direction);
  }
  return { ...document, setInput, history: {
    canUndo: canUndo && !busy, canRedo: canRedo && !busy,
    undo: () => travel("undo"), redo: () => travel("redo"), keydown, endGroup,
  } };
}
