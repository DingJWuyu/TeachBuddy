/*
 * Sidebar head block: the account row, the language switch and the semester
 * combobox, plus the surfaces they open.
 *
 * Observable behavior and geometry are owned by ../behavior/sidebar-head.md.
 *
 * PROTOTYPE: the semester list lives in component state. Creating, editing and
 * copying change this session only; a refresh restores the fixtures, and no
 * request leaves the page.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';
import { routeClick } from './routes.js';
import {
  ACTIVE_SEMESTER_ID, COPYABLE_ITEMS, LANGUAGES, SEMESTERS,
  copyNotice, formatSemesterRange, nextSemesterId
} from './sidebarHeadData.js';

const SETTINGS_HREF = '/settings';
const FLAGS = import.meta.glob('../flags/*.svg', { eager: true, query: '?url', import: 'default' });

/* Escape bubbles from the focused surface, so a submenu consumes it before its
 * parent. Outside presses close without stealing the destination's focus. */
function useDismiss(open, close, refs) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      const inside = refs.some((ref) => ref.current && ref.current.contains(event.target));
      if (!inside) close();
    };
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open, close, refs]);
  return (event) => {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close({ restoreFocus: true });
    }
  };
}

function Flag({ flag, className }) {
  return <img className={className} src={FLAGS[`../flags/${flag}.svg`]} alt="" aria-hidden="true" />;
}

export function LanguageMenu({ current, onSelect, onClose, triggerRef }) {
  const menuRef = useRef(null);
  const dismiss = useDismiss(true, onClose, [menuRef, triggerRef]);
  useEffect(() => { menuRef.current?.querySelector('[aria-checked="true"]')?.focus(); }, []);
  return (
    <div className="tb-language-menu tb-head-surface" role="menu" ref={menuRef} onKeyDown={dismiss}>
      {LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          role="menuitemradio"
          aria-checked={language.code === current.code}
          className={`tb-language-option${language.code === current.code ? ' is-current' : ''}`}
          onClick={() => onSelect(language)}
        >
          <Flag flag={language.flag} className="tb-language-option-flag" />
          <span className="tb-language-option-name">
            <span className="tb-language-native">{language.native}</span>
            {language.english ? <span className="tb-language-english">{language.english}</span> : null}
          </span>
          {language.code === current.code ? <Icon name="check" size={16} className="tb-language-check" /> : null}
        </button>
      ))}
    </div>
  );
}

export function SemesterPopover({
  semesters, activeId, onPick, onEdit, onCreate, onClose, triggerRef
}) {
  const popoverRef = useRef(null);
  const dismiss = useDismiss(true, onClose, [popoverRef, triggerRef]);
  useEffect(() => { popoverRef.current?.querySelector('[aria-selected="true"]')?.focus(); }, []);
  return (
    <div className="tb-semester-popover tb-head-surface" role="dialog" aria-label="学期" ref={popoverRef} onKeyDown={dismiss}>
      <div className="tb-semester-list" role="listbox">
        {semesters.map((semester) => (
          <div
            key={semester.id}
            role="option"
            tabIndex={0}
            aria-selected={semester.id === activeId}
            className="tb-semester-option"
            onClick={() => onPick(semester)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPick(semester);
              }
            }}
          >
            <span className="tb-semester-option-body">
              <span className="tb-semester-option-name">
                {semester.id === activeId ? <Icon name="check" size={14} /> : null}
                <span className="tb-semester-name">{semester.name}</span>
              </span>
              <p className="tb-semester-range">{formatSemesterRange(semester)}</p>
            </span>
            <button
              type="button"
              className="tb-semester-edit"
              aria-label={`编辑${semester.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onEdit(semester);
              }}
            >
              <Icon name="pencil" size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="tb-semester-create-row">
        <button type="button" className="tb-semester-create" onClick={onCreate}>
          <Icon name="plus" size={14} />
          <span>新学期</span>
        </button>
      </div>
    </div>
  );
}

/* The copy panel is shared: creating offers it as one of two starting modes,
 * editing always shows it and adds the note about existing data. */
function CopyPanel({ candidates, source, onPickSource, picked, onToggle, notice, sourceOpen, setSourceOpen, sourceButtonRef }) {
  const sourceRef = useRef(null);
  const closeSource = ({ restoreFocus = false } = {}) => {
    setSourceOpen(false);
    if (restoreFocus) sourceButtonRef.current?.focus();
  };
  const dismiss = useDismiss(sourceOpen, closeSource, [sourceRef]);
  useEffect(() => {
    if (sourceOpen) sourceRef.current?.querySelector('[role="option"]')?.focus();
  }, [sourceOpen]);

  return (
    <div className="tb-copy-panel">
      <div className="tb-copy-source-block">
        <div className="tb-copy-field">
          <span className="tb-field-label">复制来源</span>
          <div className="tb-copy-source-wrap" ref={sourceRef} onKeyDown={dismiss}>
            <button
              type="button"
              className="tb-copy-source"
              ref={sourceButtonRef}
              aria-haspopup="listbox"
              aria-expanded={sourceOpen}
              aria-label={source ? `复制来源：${source.name}` : '复制来源'}
              onClick={() => setSourceOpen((open) => !open)}
            >
              <span className={source ? undefined : 'tb-copy-source-placeholder'}>
                {source ? source.name : '选择学期...'}
              </span>
              <Icon name="chevron" size={16} />
            </button>
            {sourceOpen ? (
              <div className="tb-copy-source-menu" role="listbox" aria-label="复制来源">
                {candidates.map((semester) => (
                  <button
                    key={semester.id}
                    type="button"
                    role="option"
                    aria-selected={semester.id === source?.id}
                    className="tb-copy-source-option"
                    onClick={() => {
                      onPickSource(semester);
                      closeSource({ restoreFocus: true });
                    }}
                  >
                    <span className="tb-copy-source-mark">
                      {semester.id === source?.id ? <Icon name="check" size={14} /> : null}
                    </span>
                    <span>{semester.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <span className="tb-field-label">复制内容</span>
      </div>

      <div className="tb-copy-body">
        {source ? (
          <div className="tb-copy-list">
            {COPYABLE_ITEMS.map((item) => {
              const disabled = item.count === 0;
              const checked = picked.includes(item.id);
              return (
                <label key={item.id} className={`tb-copy-item${disabled ? ' is-disabled' : ''}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={item.label}
                    disabled={disabled}
                    className={`tb-checkbox${checked ? ' is-checked' : ''}`}
                    onClick={() => onToggle(item.id)}
                  >
                    {checked ? <Icon name="check" size={12} /> : null}
                  </button>
                  <span className="tb-copy-item-icon"><Icon name={item.icon} size={15} /></span>
                  <span className="tb-copy-item-name">{item.label}</span>
                  <span className="tb-copy-item-count">{item.count} {item.unit}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="tb-copy-empty">
            <p>选择来源学期，查看可导入的内容。</p>
          </div>
        )}
      </div>

      {notice ? (
        <div className="tb-copy-note-row">
          <div className={`tb-copy-note is-${notice.tone}`}>
            <Icon name="info" size={16} />
            <p>{notice.text}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SemesterDialog({ mode, semester, semesters, onClose, onSubmit, onDelete }) {
  const isEdit = mode === 'edit';
  const [moreOpen, setMoreOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceButtonRef = useRef(null);
  const moreRef = useRef(null);
  const moreButtonRef = useRef(null);
  const modalRef = useRef(null);
  const closeMore = ({ restoreFocus = false } = {}) => {
    setMoreOpen(false);
    if (restoreFocus) moreButtonRef.current?.focus();
  };
  const dismissMore = useDismiss(moreOpen, closeMore, [moreRef]);
  useEffect(() => {
    if (moreOpen) moreRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
  }, [moreOpen]);
  const [startMode, setStartMode] = useState('fresh');
  const [name, setName] = useState(isEdit && semester ? semester.name : '');
  const [start, setStart] = useState(isEdit && semester ? semester.start : '');
  const [end, setEnd] = useState(isEdit && semester ? semester.end : '');
  const [sourceId, setSourceId] = useState(null);
  const [picked, setPicked] = useState([]);

  useLayoutEffect(() => {
    const modal = modalRef.current;
    modal.showModal();
    modal.querySelector('#tb-semester-name')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const candidates = semesters.filter((item) => item.id !== semester?.id);
  const source = candidates.find((item) => item.id === sourceId) ?? null;
  const showCopy = isEdit || startMode === 'copy';

  const closeLayer = () => {
    if (moreOpen) closeMore({ restoreFocus: true });
    else if (showCopy && sourceOpen) {
      setSourceOpen(false);
      sourceButtonRef.current?.focus();
    } else onClose();
  };

  const notice = source
    ? { tone: 'info', text: copyNotice(source.name) }
    : (isEdit ? { tone: 'warn', text: '导入的项目将添加到此学期，现有数据不会被移除。' } : null);

  return createPortal(
    <dialog
      ref={modalRef}
      className="tb-dialog-layer tb-head-surface"
      aria-labelledby="tb-semester-dialog-title"
      onCancel={(event) => { event.preventDefault(); closeLayer(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
            .filter((node) => node.getClientRects().length > 0);
          const edge = event.shiftKey ? items[0] : items.at(-1);
          if (document.activeElement === edge) {
            event.preventDefault();
            (event.shiftKey ? items.at(-1) : items[0])?.focus();
          }
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeLayer();
        }
      }}
    >
      <form
        className="tb-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ name: name.trim(), start, end, sourceId: showCopy ? sourceId : null, picked: showCopy ? picked : [] });
        }}
      >
        <div className="tb-dialog-form">
          <div className="tb-dialog-head">
            <button type="button" className="tb-dialog-close" onClick={onClose} aria-label="取消">
              <Icon name="close" size={16} />
            </button>
            <div className="tb-dialog-title-row">
              <h2 id="tb-semester-dialog-title" className="tb-dialog-title">
                {isEdit ? '编辑学期' : '创建学期'}
              </h2>
              {isEdit ? (
                <div className="tb-dialog-more-wrap" ref={moreRef} onKeyDown={dismissMore}>
                  <button
                    type="button"
                    className="tb-dialog-more"
                    ref={moreButtonRef}
                    aria-label="更多"
                    aria-haspopup="menu"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen((open) => !open)}
                  >
                    <Icon name="more" size={16} />
                  </button>
                  {moreOpen ? (
                    <div className="tb-dialog-more-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="tb-dialog-more-item"
                        disabled={semesters.length <= 1}
                        onClick={() => {
                          setMoreOpen(false);
                          onDelete(semester);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="tb-dialog-desc">{isEdit ? '更新学期详情。' : '为新学期定义名称和日期范围。'}</p>
          </div>

          <div className="tb-dialog-body">
            <div className="tb-field">
              <label className="tb-field-label" htmlFor="tb-semester-name">名称 *</label>
              <input
                id="tb-semester-name"
                className="tb-field-input"
                placeholder="例如：2026年秋季学期"
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="tb-field-dates">
              <div className="tb-field">
                <label className="tb-field-label" htmlFor="tb-semester-start">开始日期 *</label>
                <input
                  id="tb-semester-start"
                  className="tb-field-input"
                  type="date"
                  required
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="tb-field">
                <label className="tb-field-label" htmlFor="tb-semester-end">结束日期 *</label>
                <input
                  id="tb-semester-end"
                  className="tb-field-input"
                  type="date"
                  required
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </div>
            </div>
            {isEdit ? null : (
              <div className="tb-field-mode">
                <span className="tb-field-label">起始方式</span>
                <div className="tb-mode-cards">
                  <button
                    type="button"
                    className={`tb-mode-card${startMode === 'fresh' ? ' is-selected' : ''}`}
                    aria-pressed={startMode === 'fresh'}
                    onClick={() => { setStartMode('fresh'); setSourceOpen(false); }}
                  >
                    <span className="tb-mode-card-head"><Icon name="sparkles" size={16} /><span>从头开始</span></span>
                    <p className="tb-mode-card-note">使用默认设置的空学期。</p>
                  </button>
                  <button
                    type="button"
                    className={`tb-mode-card${startMode === 'copy' ? ' is-selected' : ''}`}
                    aria-pressed={startMode === 'copy'}
                    onClick={() => setStartMode('copy')}
                  >
                    <span className="tb-mode-card-head"><Icon name="copy" size={16} /><span>从已有学期复制</span></span>
                    <p className="tb-mode-card-note">从其他学期导入数据。</p>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="tb-dialog-preview">
          <div className="tb-dialog-preview-head">
            <h3>{showCopy ? '从其他学期复制' : '全新开始'}</h3>
          </div>
          {showCopy ? (
            <CopyPanel
              sourceOpen={sourceOpen}
              setSourceOpen={setSourceOpen}
              sourceButtonRef={sourceButtonRef}
              candidates={candidates}
              source={source}
              picked={picked}
              notice={notice}
              onPickSource={(next) => {
                setSourceId(next.id);
                setPicked([]);
              }}
              onToggle={(id) => setPicked((list) => (
                list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]
              ))}
            />
          ) : (
            <div className="tb-dialog-preview-body">
              <div className="tb-preview-card">
                <div className="tb-preview-mark"><Icon name="sparkles" size={24} /></div>
                <p>您的新学期将以空白状态开始。您可以从零开始添加班级、学生和课程，或随时切换到「从已有学期复制」。</p>
              </div>
            </div>
          )}
        </div>
        <div className="tb-dialog-foot">
          <button type="submit" className="tb-dialog-submit">{isEdit ? '保存更改' : '创建学期'}</button>
          <button type="button" className="tb-dialog-cancel" onClick={onClose}>取消</button>
        </div>
      </form>
    </dialog>,
    document.querySelector('.tb-prototype')
  );
}

export default function SidebarHead({ accountName = '林老师', onAnnounce, openSurface, onToggleSurface, onOpenSurface, onCloseSurface, visible }) {
  const [language, setLanguage] = useState(() => LANGUAGES.find((item) => item.code === 'zh-CN'));
  const languageOpen = openSurface === 'language';
  const semesterOpen = openSurface === 'semester';
  const [semesters, setSemesters] = useState(SEMESTERS);
  const [activeSemesterId, setActiveSemesterId] = useState(ACTIVE_SEMESTER_ID);
  const [dialogData, setDialogData] = useState(null);
  const dialog = openSurface === 'semester-dialog' ? dialogData : null;
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const languageButtonRef = useRef(null);
  const semesterButtonRef = useRef(null);
  useEffect(() => {
    if (!visible && ['language', 'semester', 'semester-dialog'].includes(openSurface)) onCloseSurface();
  }, [visible, openSurface, onCloseSurface]);

  const close = (options) => onCloseSurface(options);
  const closeDialog = () => close({ restoreFocus: true });

  const activeSemester = semesters.find((item) => item.id === activeSemesterId) ?? semesters[0];

  const announce = (message) => {
    if (typeof onAnnounce === 'function') onAnnounce(message);
  };

  function deleteSemester(semester) {
    const remaining = semesters.filter((item) => item.id !== semester.id);
    setSemesters(remaining);
    if (semester.id === activeSemesterId) setActiveSemesterId(remaining[0].id);
    closeDialog();
    announce(`已删除 ${semester.name}`);
  }

  function submitDialog(values) {
    const copied = values.sourceId && values.picked.length ? '，并复制了所选内容' : '';
    if (dialog.mode === 'edit') {
      setSemesters((list) => list.map((item) => (
        item.id === dialog.semester.id
          ? { ...item, name: values.name, start: values.start, end: values.end }
          : item
      )));
      announce(`已保存 ${values.name}${copied}`);
    } else {
      const created = {
        id: nextSemesterId(semesters),
        name: values.name,
        start: values.start,
        end: values.end
      };
      setSemesters((list) => [...list, created]);
      setActiveSemesterId(created.id);
      announce(`已创建 ${values.name}${copied}`);
    }
    closeDialog();
  }

  return (
    <>
      <div className="tb-account-block">
        <a className="tb-account-row" href={SETTINGS_HREF} onClick={(event) => routeClick(event, SETTINGS_HREF)}>
          <span className="tb-avatar" data-slot="avatar">{accountName.slice(0, 1)}</span>
          <p className="tb-account-name">{accountName}</p>
        </a>
        <button
          type="button"
          ref={languageButtonRef}
          className="tb-language-row"
          data-surface="language"
          aria-label={language.native}
          aria-haspopup="menu"
          aria-expanded={languageOpen}
          onClick={() => onToggleSurface('language')}
        >
          <Icon name="language" size={20} />
          <Flag flag={language.flag} className="tb-language-flag" />
        </button>
        {languageOpen ? (
          <LanguageMenu
            current={language}
            triggerRef={languageButtonRef}
            onClose={close}
            onSelect={(next) => {
              setLanguage(next);
              close({ restoreFocus: true });
              announce(`界面语言已切换为 ${next.native}`);
            }}
          />
        ) : null}
      </div>

      <div className="tb-term-wrap">
        <button
          type="button"
          ref={semesterButtonRef}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={semesterOpen}
          aria-label={activeSemester.name}
          className="tb-term-button"
          data-surface="semester"
          onClick={() => onToggleSurface('semester')}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onBlur={() => setTooltipOpen(false)}
        >
          <Icon name="calendar" size={14} />
          <span className="tb-term-name">{activeSemester.name}</span>
          <Icon name="select" size={14} />
          {tooltipOpen && !semesterOpen ? <span className="tb-term-tooltip" role="tooltip">切换学期</span> : null}
        </button>

        {semesterOpen ? (
          <SemesterPopover
            semesters={semesters}
            activeId={activeSemesterId}
            triggerRef={semesterButtonRef}
            onClose={close}
            onPick={(semester) => {
              setActiveSemesterId(semester.id);
              close({ restoreFocus: true });
              announce(`已切换到 ${semester.name}`);
            }}
            onEdit={(semester) => {
              setDialogData({ mode: 'edit', semester });
              onOpenSurface('semester-dialog');
            }}
            onCreate={() => {
              setDialogData({ mode: 'create', semester: null });
              onOpenSurface('semester-dialog');
            }}
          />
        ) : null}
      </div>

      {dialog ? (
        <SemesterDialog
          key={`${dialog.mode}-${dialog.semester?.id ?? 'new'}`}
          mode={dialog.mode}
          semester={dialog.semester}
          semesters={semesters}
          onClose={closeDialog}
          onSubmit={submitDialog}
          onDelete={deleteSemester}
        />
      ) : null}
    </>
  );
}
