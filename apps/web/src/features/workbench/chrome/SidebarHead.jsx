import { useTranslation } from 'react-i18next';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useScene } from '../../../platform/device/useScene.js';
import { useWorkbenchShell } from '../shellContext.js';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';
import { routeClick } from './routes.js';
import {
  COPYABLE_ITEMS, LANGUAGES,
  copyNotice, formatSemesterRange, nextSemesterId
} from './sidebarHeadData.js';

const SETTINGS_HREF = '/settings';
const FLAGS = import.meta.glob('./flags/*.svg', { eager: true, query: '?url', import: 'default' });

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
  useTranslation("workbench");
  return <img className={className} src={FLAGS[`./flags/${flag}.svg`]} alt="" aria-hidden="true" />;
}

export function LanguageMenu({ current, onSelect, onClose, triggerRef }) {
  useTranslation("workbench");
  const menuRef = useRef(null);
  const dismiss = useDismiss(true, onClose, [menuRef, triggerRef]);
  useEffect(() => { menuRef.current?.querySelector('[aria-checked="true"]')?.focus(); }, []);
  return (
    <div className="tb-language-menu tb-head-surface" role="menu" ref={menuRef} onKeyDown={event => {
      dismiss(event);
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const options = [...menuRef.current.querySelectorAll('[role="menuitemradio"]')];
      const index = options.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next]?.focus();
    }}>
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
  const { t } = useTranslation("workbench");
  const popoverRef = useRef(null);
  const dismiss = useDismiss(true, onClose, [popoverRef, triggerRef]);
  useEffect(() => { popoverRef.current?.querySelector('[aria-selected="true"]')?.focus(); }, []);
  return (
    <div className="tb-semester-popover tb-head-surface" role="dialog" aria-label={t("学期")} ref={popoverRef} onKeyDown={dismiss}>
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
              aria-label={t("编辑{{name}}", { name: semester.name })}
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
          <span>{t("新学期")}</span>
        </button>
      </div>
    </div>
  );
}

/* The copy panel is shared: creating offers it as one of two starting modes,
 * editing always shows it and adds the note about existing data. */
function CopyPanel({ candidates, source, onPickSource, picked, onToggle, notice, sourceOpen, setSourceOpen, sourceButtonRef }) {
  const { t } = useTranslation("workbench");
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
          <span className="tb-field-label">{t("复制来源")}</span>
          <div className="tb-copy-source-wrap" ref={sourceRef} onKeyDown={dismiss}>
            <button
              type="button"
              className="tb-copy-source"
              ref={sourceButtonRef}
              aria-haspopup="listbox"
              aria-expanded={sourceOpen}
              aria-label={source ? t("复制来源：{{name}}", { name: source.name }) : t("复制来源")}
              onClick={() => setSourceOpen((open) => !open)}
            >
              <span className={source ? undefined : 'tb-copy-source-placeholder'}>
                {source ? source.name : t("选择学期...")}
              </span>
              <Icon name="chevron" size={16} />
            </button>
            {sourceOpen ? (
              <div className="tb-copy-source-menu" role="listbox" aria-label={t("复制来源")}>
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
        <span className="tb-field-label">{t("复制内容")}</span>
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
            <p>{t("选择来源学期，查看可导入的内容。")}</p>
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
  const { t } = useTranslation("workbench");
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
  const [sourceId, setSourceId] = useState(semester?.sourceId ?? null);
  const [picked, setPicked] = useState(semester?.picked ?? []);

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
    : (isEdit ? { tone: 'warn', text: t("导入的项目将添加到此学期，现有数据不会被移除。") } : null);

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
            <button type="button" className="tb-dialog-close" onClick={onClose} aria-label={t("取消")}>
              <Icon name="close" size={16} />
            </button>
            <div className="tb-dialog-title-row">
              <h2 id="tb-semester-dialog-title" className="tb-dialog-title">
                {isEdit ? t("编辑学期") : t("创建学期")}
              </h2>
              {isEdit ? (
                <div className="tb-dialog-more-wrap" ref={moreRef} onKeyDown={dismissMore}>
                  <button
                    type="button"
                    className="tb-dialog-more"
                    ref={moreButtonRef}
                    aria-label={t("更多")}
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
                      > {t("删除")} </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="tb-dialog-desc">{isEdit ? t("更新学期详情。") : t("为新学期定义名称和日期范围。")}</p>
          </div>

          <div className="tb-dialog-body">
            <div className="tb-field">
              <label className="tb-field-label" htmlFor="tb-semester-name">{t("名称 *")}</label>
              <input
                id="tb-semester-name"
                className="tb-field-input"
                placeholder={t("例如：2026年秋季学期")}
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="tb-field-dates">
              <div className="tb-field">
                <label className="tb-field-label" htmlFor="tb-semester-start">{t("开始日期 *")}</label>
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
                <label className="tb-field-label" htmlFor="tb-semester-end">{t("结束日期 *")}</label>
                <input
                  id="tb-semester-end"
                  min={start || undefined}
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
                <span className="tb-field-label">{t("起始方式")}</span>
                <div className="tb-mode-cards">
                  <button
                    type="button"
                    className={`tb-mode-card${startMode === 'fresh' ? ' is-selected' : ''}`}
                    aria-pressed={startMode === 'fresh'}
                    onClick={() => { setStartMode('fresh'); setSourceOpen(false); }}
                  >
                    <span className="tb-mode-card-head"><Icon name="sparkles" size={16} /><span>{t("从头开始")}</span></span>
                    <p className="tb-mode-card-note">{t("使用默认设置的空学期。")}</p>
                  </button>
                  <button
                    type="button"
                    className={`tb-mode-card${startMode === 'copy' ? ' is-selected' : ''}`}
                    aria-pressed={startMode === 'copy'}
                    onClick={() => setStartMode('copy')}
                  >
                    <span className="tb-mode-card-head"><Icon name="copy" size={16} /><span>{t("从已有学期复制")}</span></span>
                    <p className="tb-mode-card-note">{t("从其他学期导入数据。")}</p>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="tb-dialog-preview">
          <div className="tb-dialog-preview-head">
            <h3>{showCopy ? t("从其他学期复制") : t("全新开始")}</h3>
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
                <p>{t("您的新学期将以空白状态开始。您可以从零开始添加内容，或随时切换到「从已有学期复制」。")}</p>
              </div>
            </div>
          )}
        </div>
        <div className="tb-dialog-foot">
          <button type="submit" className="tb-dialog-submit">{isEdit ? t("保存更改") : t("创建学期")}</button>
          <button type="button" className="tb-dialog-cancel" onClick={onClose}>{t("取消")}</button>
        </div>
      </form>
    </dialog>,
    document.querySelector('.tb-prototype')
  );
}

export default function SidebarHead({ accountName, onAnnounce, openSurface, onToggleSurface, onOpenSurface, onCloseSurface, visible }) {
  const { t } = useTranslation("workbench");
  const { accountKey, appearance, locale, setLocale, preferences } = useWorkbenchShell();
  const language = LANGUAGES.find(item => item.code === locale) || LANGUAGES.find(item => item.code === 'zh-CN');
  const setLanguage = item => setLocale(item.code);
  const languageOpen = openSurface === 'language';
  const semesterOpen = openSurface === 'semester';
  const [termState, patchTerms] = useScene(accountKey, 'semester-navigation', { semesters: [], activeId: null });
  const semesters = termState.semesters;
  const activeSemesterId = termState.activeId;
  const setSemesters = value => patchTerms(current => ({ semesters: typeof value === 'function' ? value(current.semesters) : value }));
  const setActiveSemesterId = activeId => patchTerms({ activeId });
  const [dialogData, setDialogData] = useState(null);
  const dialog = openSurface === 'semester-dialog' ? dialogData : null;
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const languageButtonRef = useRef(null);
  const semesterButtonRef = useRef(null);
  useEffect(() => {
    if (!visible && ['language', 'semester', 'semester-dialog'].includes(openSurface)) onCloseSurface();
  }, [visible, openSurface, onCloseSurface]);

  const close = ({ restoreFocus = false } = {}) => {
    onCloseSurface();
    if (restoreFocus) (languageOpen ? languageButtonRef : semesterButtonRef).current?.focus();
  };
  const closeDialog = () => close({ restoreFocus: true });

  const activeSemester = semesters.find((item) => item.id === activeSemesterId) ?? semesters[0] ?? { name: t("创建学期") };

  const announce = (message) => {
    if (typeof onAnnounce === 'function') onAnnounce(message);
  };

  function deleteSemester(semester) {
    const remaining = semesters.filter((item) => item.id !== semester.id);
    setSemesters(remaining);
    if (semester.id === activeSemesterId) setActiveSemesterId(remaining[0]?.id ?? null);
    closeDialog();
    announce(t("已删除 {{name}}", { name: semester.name }));
  }

  function submitDialog(values) {
    const copied = values.sourceId && values.picked.length ? t("，已保留复制选项") : '';
    if (dialog.mode === 'edit') {
      setSemesters((list) => list.map((item) => (
        item.id === dialog.semester.id
          ? { ...item, name: values.name, start: values.start, end: values.end, sourceId: values.sourceId, picked: values.picked }
          : item
      )));
      announce(t("已保存 {{name}}{{copied}}", { name: values.name, copied: copied }));
    } else {
      const created = {
        id: nextSemesterId(semesters),
        name: values.name,
        start: values.start,
        end: values.end,
        sourceId: values.sourceId, picked: values.picked
      };
      setSemesters((list) => [...list, created]);
      setActiveSemesterId(created.id);
      announce(t("已创建 {{name}}{{copied}}", { name: values.name, copied: copied }));
    }
    closeDialog();
  }

  return (
    <>
      <div className="tb-account-block">
        <a className="tb-account-row" href={SETTINGS_HREF} aria-label={t("账户：{{accountName}}", { accountName: accountName })} title={accountName} onClick={(event) => routeClick(event, SETTINGS_HREF)}>
          <span className="tb-avatar" data-slot="avatar">{appearance.avatar ? <img src={appearance.avatar} alt={t("账户头像")} /> : Array.from(accountName)[0] || t("师")}</span>
          <p className="tb-account-name">{accountName}</p>
        </a>
        <button
          type="button"
          ref={languageButtonRef}
          className="tb-language-row"
          disabled={!preferences.baseline || preferences.status === 'identity'}
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
              announce(t("已选择语言： {{native}}", { native: next.native }));
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
          {tooltipOpen && !semesterOpen ? <span className="tb-term-tooltip" role="tooltip">{t("切换学期")}</span> : null}
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
              announce(t("已切换到 {{name}}", { name: semester.name }));
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
