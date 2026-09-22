/**
 * The schedule tool rendered inside the shared auxiliary panel.
 *
 * It subscribes to the page-owned panel snapshot, so the editor shown here is
 * the same editor the page would render inline; the AI tab keeps its own draft
 * while the panel switches.
 */
import { useSyncExternalStore } from 'react';
import EntryEditor from './EntryEditor.jsx';
import { schedulePanelSnapshot, subscribeSchedulePanel } from './panelStore.js';

export default function ScheduleAuxTool() {
  const panel = useSyncExternalStore(subscribeSchedulePanel, schedulePanelSnapshot);
  if (!panel.active) {
    return (
      <div className="sch-aux" data-region="schedule-tool">
        <p className="wb-muted">未选择安排</p>
      </div>
    );
  }
  return (
    <div className="sch-aux" data-region="schedule-tool">
      <EntryEditor {...panel.editor} {...panel.actions} />
    </div>
  );
}
