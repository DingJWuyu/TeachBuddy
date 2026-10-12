import { useTranslation } from 'react-i18next';
/**
 * Shared right-hand auxiliary panel.
 *
 * One panel instance serves every module: tools registered by the current page
 * and the AI workspace switch inside it, navigation never steals it, and the
 * open state, mode and width are restored per account.
 */

import { useRef } from 'react';
import { Icon } from './icons.jsx';
import { AgentWorkspace } from '../agent/AgentWorkspace.jsx';
import { useWorkbenchShell } from './shellContext.js';

export function AiWorkspace({ variant = 'panel' }) {
  useTranslation("workbench");
  return <AgentWorkspace variant={variant} />;
}

const MIN_WIDTH = 260;
const MAX_WIDTH = 520;

export function AuxiliaryPanel({ hidden = false }) {
  const { t } = useTranslation("workbench");
  const shell = useWorkbenchShell();
  const { tools } = shell;
  const activeTool = tools.find((tool) => tool.id === shell.panelMode);
  const mode = activeTool ? activeTool.id : 'ai';
  const dragRef = useRef(null);

  function startResize(event) {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: shell.panelWidth };
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
  }

  function moveResize(event) {
    if (!dragRef.current) return;
    const delta = dragRef.current.startX - event.clientX;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startWidth + delta));
    shell.setPanelWidth(next);
  }

  function endResize(event) {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <aside
      hidden={hidden}
      style={hidden ? { display: 'none' } : { '--wb-aux-width': `${shell.panelWidth}px` }}
      className="wb-aux"
      data-region="auxiliary"
      aria-label={t("辅助栏")}
    >
      <div
        className="wb-aux-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label={t("调整辅助栏宽度")}
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
      <header className="wb-aux-head">
        <div className="wb-tabs" role="tablist" aria-label={t("辅助栏内容")}>
          <button
            type="button"
            role="tab"
            className={`wb-tab${mode === 'ai' ? ' is-active' : ''}`}
            aria-selected={mode === 'ai'}
            onClick={() => shell.setPanelMode('ai')}
          > {t("AI 助理")} </button>
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              role="tab"
              className={`wb-tab${mode === tool.id ? ' is-active' : ''}`}
              aria-selected={mode === tool.id}
              onClick={() => shell.setPanelMode(tool.id)}
            >
              {tool.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="wb-icon-button"
          aria-label={t("关闭辅助栏")}
          title={t("关闭辅助栏")}
          onClick={() => shell.closePanel()}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="wb-aux-body">
        <div hidden={mode !== 'ai'} style={mode !== 'ai' ? { display: 'none' } : { height: '100%' }}>{shell.assistant ? shell.assistant() : <AiWorkspace />}</div>
        {mode !== 'ai' && activeTool.render()}
      </div>
    </aside>
  );
}
