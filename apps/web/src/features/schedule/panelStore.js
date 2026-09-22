/**
 * Schedule panel store.
 *
 * The shell renders the registered aux tool outside the module page, so the two
 * need one small shared source for "what is being edited". The page owns the
 * state and publishes a snapshot after each commit; the aux tool subscribes. No
 * business state is duplicated: the page remains the only writer.
 */
const listeners = new Set();
let snapshot = { active: false, scope: null, draft: null, instance: null, saveState: null, actions: null };

export function publishSchedulePanel(next) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribeSchedulePanel(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function schedulePanelSnapshot() {
  return snapshot;
}
