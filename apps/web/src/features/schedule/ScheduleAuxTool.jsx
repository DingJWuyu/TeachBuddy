/**
 * The schedule tool rendered inside the shared auxiliary panel.
 *
 * It subscribes to the page-owned panel snapshot, so the editor shown here is
 * the same editor the page would render inline; the AI tab keeps its own draft
 * while the panel switches.
 */
import { ModulePresence } from '../workbench/ModuleMotion.jsx';
import { useSyncExternalStore } from 'react';
import EntryEditor from './EntryEditor.jsx';
import { schedulePanelSnapshot, subscribeSchedulePanel } from './panelStore.js';

export default function ScheduleAuxTool() {
  const panel = useSyncExternalStore(subscribeSchedulePanel, schedulePanelSnapshot);
  return (
    <div className="wb-module sch-aux" data-region="schedule-tool">
      <ModulePresence present={Boolean(panel.active)}>
        {panel.active && <EntryEditor {...panel.editor} {...panel.actions} />}
      </ModulePresence>
      {!panel.active && <p className="wb-muted">未选择安排</p>}
    </div>
  );
}
