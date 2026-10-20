import { cx } from '../../components/ui/classNames.js';
import { tx, useLocale } from '../../i18n/presentation.js';
import { Icon } from '../../components/icons.jsx';
import { AgentWorkspace } from '../agent/AgentWorkspace.jsx';
import { useWorkbenchShell } from './shellContext.js';

/*
 * The right-hand panel frame. It stays mounted on every module that has one,
 * so opening and closing can animate. Its width is fixed and matches the
 * schedule's own right column: on the calendar it slides in over that column
 * instead of squeezing the page, elsewhere it eases the page aside.
 */
const tw = tx;

export function AuxiliaryPanel({ hidden = false, available = true }) {
  useLocale();
  const shell = useWorkbenchShell();
  const { tools } = shell;
  const activeTool = tools.find((tool) => tool.id === shell.panelMode);
  const mode = activeTool ? activeTool.id : 'ai';
  const open = !hidden && available;
  return (
    <aside
      className={cx('wb-aux tbx-aux', open && 'is-open')}
      data-region="auxiliary"
      aria-label={tw('辅助栏')}
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      <div className="tbx-aux-inner">
        <header className="wb-aux-head tbx-aux-head">
          <div className="wb-tabs tbx-aux-tabs" role="tablist" aria-label={tw('辅助栏内容')}>
            <button type="button" role="tab" className={cx('wb-tab', mode === 'ai' && 'is-active')} aria-selected={mode === 'ai'} onClick={() => shell.setPanelMode('ai')}>
              {tw('AI 助理')}
            </button>
            {tools.map((tool) => (
              <button key={tool.id} type="button" role="tab" className={cx('wb-tab', mode === tool.id && 'is-active')} aria-selected={mode === tool.id} onClick={() => shell.setPanelMode(tool.id)}>
                {tool.label}
              </button>
            ))}
          </div>
          <button type="button" className="tbx-aux-close" aria-label={tw('关闭辅助栏')} title={tw('关闭辅助栏')} onClick={() => shell.closePanel()}>
            <Icon name="close" size={16} strokeWidth={1.75} />
          </button>
        </header>
        <div className="wb-aux-body tbx-aux-body">
          <div hidden={mode !== 'ai'} style={mode !== 'ai' ? { display: 'none' } : { height: '100%' }}>
            {shell.assistant ? shell.assistant() : <AgentWorkspace variant="panel" />}
          </div>
          {mode !== 'ai' && activeTool.render()}
        </div>
      </div>
    </aside>
  );
}

export function AiWorkspace({ variant = 'panel' }) {
  return <AgentWorkspace variant={variant} />;
}
