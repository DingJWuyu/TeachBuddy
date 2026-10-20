import i18n from "../../../i18n/index.js";
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: "workbench", ...options });
import { tx } from '../../../i18n/presentation.js';
import { useScene } from '../../../platform/device/useScene.js';
import { useWorkbenchShell } from '../shellContext.js';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createDragChip } from './dragChip.js';
import { Icon } from '../../../components/icons.jsx';
import { navigate, routeClick, withSearch } from './routes.js';
import { workbenchModules, moduleDisplayName } from '../../modules/moduleRegistry.js';

/* ------------------------------------------------------------------ search */

const searchGroups = () => [
  {
    group: t("功能模块"),
    items: [
      ...workbenchModules.map((item) => ({ id: 'm-' + item.id, name: moduleDisplayName(item), hint: item.id === 'schedule' ? t("课程、时间段与待办") : t("个人教学工作台"), icon: item.icon, route: item.path }))
    ]
  },

];

export function SearchModal({ onClose, onAnnounce }) {
  const { t } = useTranslation("workbench");
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return searchGroups()
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${item.name}${item.hint}`.toLowerCase().includes(needle))
      }))
      .filter((group) => group.items.length > 0);
  }, [query, i18n.resolvedLanguage]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, i18n.resolvedLanguage]);

  /*
   * Results navigate to the destination they name, so search leaves the shell
   * showing the page the user picked instead of only announcing it.
   */
  function openItem(item) {
    onAnnounce(t("已打开「{{name}}」", { name: item.name }));
    onClose();
    navigate(item.route);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (flat.length === 0 ? 0 : (current + 1) % flat.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (flat.length === 0 ? 0 : (current - 1 + flat.length) % flat.length));
    } else if (event.key === 'Enter' && event.target === inputRef.current && flat[activeIndex]) {
      event.preventDefault();
      openItem(flat[activeIndex]);
    }
  }

  let cursor = -1;

  return (
    <div className="tb-search-layer">
      <div className="tb-search-backdrop" onPointerDown={onClose} />
      <div
        className="tb-search-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tb-search-title"
        onKeyDown={handleKeyDown}
      >
        <h2 className="sr-only" id="tb-search-title">{t("全局搜索")}</h2>
        <div className="tb-search-input-row">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            className="tb-search-input"
            type="search"
            value={query}
            placeholder={t("搜索模块…")}
            aria-label={t("搜索模块")}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="tb-search-close" aria-label={t("关闭搜索")} onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="tb-search-results">
          {flat.length === 0 && (
            <div className="tb-search-empty">
              <Icon name="search" size={20} />
              <p>{t("没有匹配「")}{query}{t("」的结果")}</p>
              <span>{t("试试模块名称。")}</span>
            </div>
          )}
          {groups.map((group) => (
            <div className="tb-search-group" key={group.group}>
              <div className="tb-search-group-label">{group.group}</div>
              {group.items.map((item) => {
                cursor += 1;
                const index = cursor;
                return (
                  <a
                    href={withSearch(item.route)}
                    key={item.id}
                    className={`tb-search-item${index === activeIndex ? ' is-active' : ''}`}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={(event) => {
                      routeClick(event, item.route);
                      if (event.defaultPrevented) {
                        onAnnounce(t("已打开「{{name}}」", { name: item.name }));
                        onClose();
                      }
                    }}
                  >
                    {item.icon
                      ? <Icon name={item.icon} size={16} />
                      : <span className="tb-search-dot" style={{ background: item.dot }} />}
                    <span className="tb-search-item-name">{item.name}</span>
                    <span className="tb-search-item-hint">{item.hint}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- notifications */

// Schedule reminders come from WorkspaceProvider. Reading one opens its event;
// read status never means a teaching task is completed.

export function NotificationPanel({ items, onChange, onAnnounce, onOpenItem, feedback }) {
  const { t } = useTranslation("workbench");
  /*
   * Which notification is in flight, and whether it is over the trash. A drag
   * that has not reached the trash yet must not lose anything: removal happens
   * on drop, and only for the row that is actually being dragged.
   */
  const [draggingId, setDraggingId] = useState(null);
  const [overTrash, setOverTrash] = useState(false);
  const [pendingDrop, setPendingDrop] = useState(null);
  useEffect(() => {
    if (!pendingDrop) return;
    const timer = setTimeout(() => setPendingDrop(null), 3200);
    return () => clearTimeout(timer);
  }, [pendingDrop]);
  // The drag image in flight. A row is wider than the trash it is aimed at, so
  // without a smaller image the trash is covered at the exact moment it should
  // be confirming the drop.
  const dragChipRef = useRef(null);
  const unread = items.filter((item) => !item.read).length;

  function setRead(id, read) {
    onChange(items.map((item) => (item.id === id ? { ...item, read } : item)));
  }

  /** Drops the chip that is following the pointer. Safe to call twice. */
  function removeChip() {
    dragChipRef.current?.remove();
    dragChipRef.current = null;
  }

  // Last resort: an empty list has no drag left to end, and a panel that is
  // closed or navigated away from must not leave the disc behind either.
  useEffect(() => removeChip, []);

  function confirmDrop() {
    const dragged = items.find(item => item.id === pendingDrop);
    setPendingDrop(null);
    if (dragged) {
      onChange(items.filter(item => item.id !== dragged.id));
      onAnnounce(t("通知已删除"));
    }
  }

  function removeDragged() {
    const dragged = items.find((item) => item.id === draggingId);
    if (dragged) setPendingDrop(dragged.id);
    setDraggingId(null);
    setOverTrash(false);
    /* A removed source cannot receive dragend; remove the chip at drop and on unmount too. */
    removeChip();
  }

  return (
    <div
      className={`tb-popover tb-popover-notifications${draggingId ? ' is-dragging' : ''}${overTrash ? ' is-over-trash' : ''}`}
      role="dialog"
      aria-labelledby="tb-notifications-title"
    >
      <div className="tb-popover-head">
        <h2 id="tb-notifications-title">{t("通知")}</h2>
        {unread > 0 && (
          <button
            type="button"
            className="tb-popover-action"
            onClick={() => {
              onChange(items.map((item) => ({ ...item, read: true })));
              onAnnounce(t("已全部标为已读"));
            }}
          > {t("全部已读")} </button>
        )}
      </div>
      {feedback}
      {items.length === 0 ? (
        <div className="tb-popover-empty">
          <Icon name="bell" size={20} />
          <p>{t("暂无通知")}</p>
        </div>
      ) : (
        /*
         * The chip is torn down on the list rather than on each row. `dragend`
         * bubbles, and the list outlives the row, so a row that is deleted by its
         * own drop still ends its drag here.
         */
        <div className="tb-popover-list" onDragEnd={removeChip}>
          {items.map((item) => (
            <button
              type="button"
              className={`tb-row tb-notification${item.eventId ? ' is-reminder' : ''}${item.read ? ' is-read' : ''}${draggingId === item.id ? ' is-dragging' : ''}`}
              key={item.id}
              draggable={item.read}
              aria-pressed={item.read}
              title={item.eventId && !item.read ? t("查看对应时间段") : item.read ? t("点击标为未读，或拖到垃圾桶删除") : t("点击标为已读")}
              onClick={() => {
                setRead(item.id, !item.read);
                onAnnounce(item.read ? t("「{{text}}」已标为未读", { text: item.text }) : t("「{{text}}」已标为已读", { text: item.text }));
              }}
              onDragStart={(event) => {
                setDraggingId(item.id);
                event.dataTransfer.setData('text/plain', item.id);
                event.dataTransfer.effectAllowed = 'move';
                dragChipRef.current?.remove();
                dragChipRef.current = createDragChip({ icon: item.icon });
                dragChipRef.current.set(event);
                dragChipRef.current.moveTo(event.clientX, event.clientY);
              }}
              onDrag={(event) => dragChipRef.current?.moveTo(event.clientX, event.clientY)}
              onDragEnd={() => {
                setDraggingId(null);
                setOverTrash(false);
                dragChipRef.current?.remove();
                dragChipRef.current = null;
              }}
            >
              <span className="tb-row-icon"><Icon name={item.icon} size={16} /></span>
              <span className="tb-row-label"><span className="tb-row-text">{item.text}</span></span>
              <span className="tb-row-meta">{item.time}</span>
              {item.eventId && <span className="tb-notification-open" role="button" tabIndex={0}
                aria-label={tx('在日程中查看')} title={tx('在日程中查看')}
                onClick={event => { event.stopPropagation(); onOpenItem?.(item); }}
                onKeyDown={event => {
                  if (!['Enter', ' '].includes(event.key)) return;
                  event.preventDefault(); event.stopPropagation(); onOpenItem?.(item);
                }}><Icon name="chevron" size={14} /></span>}
            </button>
          ))}
        </div>
      )}
      {/*
       * The trash is always present so the delete affordance does not appear only
       * once something is already being dragged. Unread rows are not draggable,
       * so it sits idle until a read one is picked up.
       */}
      <div
        className={`tb-notification-trash${pendingDrop ? ' is-armed' : ''}`}
        role={pendingDrop ? 'button' : undefined}
        tabIndex={pendingDrop ? 0 : undefined}
        onClick={pendingDrop ? confirmDrop : undefined}
        onKeyDown={event => {
          if (pendingDrop && ['Enter', ' '].includes(event.key)) { event.preventDefault(); confirmDrop(); }
        }}
        onDragOver={(event) => {
          if (!draggingId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setOverTrash(true);
        }}
        onDragLeave={() => setOverTrash(false)}
        onDrop={(event) => {
          event.preventDefault();
          removeDragged();
        }}
      >
        <span className="tb-notification-trash-icon"><Icon name="trash" size={16} /></span>
        <span>{pendingDrop ? tx('确认删除') : t("删除消息")}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- feedback */

const FEEDBACK_REPLIES = {
  建议: { title: '好主意，收到了。', note: '每一条建议，我们都会认真读完。' },
  错误报告: { title: '谢谢你帮我们找到它。', note: '我们会尽快修好这个问题。' },
  问题: { title: '你的问题，我们收到了。', note: '我们会尽快给你答复。' },
  赞扬: { title: '这句话，我们会记很久。', note: '谢谢你，这对我们意义重大。' },
};

const FEEDBACK_TYPES = [
  { label: '建议', color: '#7c3aed', tint: 'rgba(124, 58, 237, .1)' },
  { label: '错误报告', color: '#e5484d', tint: 'rgba(229, 72, 77, .1)' },
  { label: '问题', color: '#c2740a', tint: 'rgba(194, 116, 10, .12)' },
  { label: '赞扬', color: '#16a34a', tint: 'rgba(22, 163, 74, .1)' }
];

export function FeedbackPanel({ onAnnounce, onClose }) {
  const { t } = useTranslation("workbench");
  const [type, setType] = useState("建议");
  const { accountKey } = useWorkbenchShell();
  const [feedback, patchFeedback] = useScene(accountKey, 'feedback', { body: '', records: [] });
  const body = feedback.body;
  const setBody = body => patchFeedback({ body });
  const [sent, setSent] = useState(false);
  const [files, setFiles] = useState([]);
  const addFiles = list => setFiles(current => [...current,
    ...Array.from(list || [], file => ({ name: file.name || tx('截图'), size: file.size }))].slice(0, 5));
  const canSend = body.trim().length > 0;

  if (sent) {
    return (
      <div className="tb-popover tb-popover-feedback" role="dialog" aria-labelledby="tb-feedback-title">
        <div className="tb-feedback-sent">
          <span className="tb-feedback-sent-mark"><Icon name="check" size={20} /></span>
          <h2 id="tb-feedback-title">{tx(FEEDBACK_REPLIES[type].title)}</h2>
          <p className="tbx-feedback-note">{tx(FEEDBACK_REPLIES[type].note)}</p>
          {/* The acknowledgement replaces the form, so it has to carry its own
              way out; otherwise the only exits are Escape and a click outside. */}
          <button type="button" className="tb-feedback-dismiss" onClick={onClose}>{t("知道了")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tb-popover tb-popover-feedback" role="dialog" aria-labelledby="tb-feedback-title">
      <div className="tb-popover-head">
        <h2 id="tb-feedback-title">{t("发送反馈")}</h2>
        <div className="tb-feedback-types" role="group" aria-label={t("反馈类型")}>
          {FEEDBACK_TYPES.map((item) => (
            <button
              type="button"
              key={t(item.label)}
              className={`tb-chip${item.label === type ? ' is-current' : ''}`}
              style={{ '--tb-chip-color': item.color, '--tb-chip-tint': item.tint }}
              aria-pressed={item.label === type}
              onClick={() => setType(item.label)}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="tb-feedback-body"
        value={body}
        placeholder={t("说说你的想法，或者遇到的问题…")}
        aria-label={t("反馈内容")}
        onPaste={event => {
          if (!event.clipboardData?.files?.length) return;
          event.preventDefault(); addFiles(event.clipboardData.files);
        }}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="tb-feedback-foot">
        <div className="tb-feedback-attach">
          <label className="tb-feedback-clip" title={tx('可以直接粘贴截图')}>
            <Icon name="paperclip" size={16} /><span>{files.length ? tx('继续添加') : tx('附上截图或文件')}</span>
            <input type="file" hidden multiple accept="image/*,.pdf" onChange={event => {
              addFiles(event.target.files); event.target.value = '';
            }} />
          </label>
          {files.map((file, index) => <span className="tb-feedback-file" title={file.name} key={index}>
            <span>{file.name}</span><button type="button" aria-label={tx('移除附件')}
              onClick={() => setFiles(list => list.filter((_, at) => at !== index))}><Icon name="close" size={11} /></button>
          </span>)}
        </div>
        <button
          type="button"
          className="tb-button-primary"
          disabled={!canSend}
          onClick={() => {
            patchFeedback({ body: '', records: [...feedback.records, { type, body, attachments: files, createdAt: new Date().toISOString() }] });
            setFiles([]);
            setSent(true);
            onAnnounce(t("反馈已记录"));
          }}
        > {t("发送")} </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- tutorial */

export function TutorialPanel({ modules, completed, onComplete, onAnnounce }) {
  const { t } = useTranslation("workbench");
  const done = modules.filter((module) => completed.includes(module.id)).length;

  return (
    <div className="tb-popover tb-popover-tutorial" role="dialog" aria-labelledby="tb-tutorial-title">
      <h2 id="tb-tutorial-title">{t("快速上手")}</h2>
      <p className="tb-popover-desc">{t("选一个功能，看看它怎么用。")}</p>
      <div className="tb-progress">
        <span className="tb-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={modules.length} aria-valuenow={done} aria-label={t("教程完成进度")}>
          <span className="tb-progress-fill" style={{ width: `${modules.length ? (done / modules.length) * 100 : 0}%` }} />
        </span>
        <span className="tb-progress-label">{t("已完成")} {done} / {modules.length}</span>
      </div>
      <div className="tb-popover-list">
        {modules.map((module) => {
          const isDone = completed.includes(module.id);
          return (
            <button
              type="button"
              className={`tb-row${isDone ? ' is-done' : ''}`}
              key={module.id}
              onClick={() => {
                onComplete(module.id);
                onAnnounce(isDone ? t("「{{value}}」教程已重置", { value: moduleDisplayName(module) }) : t("已完成「{{value}}」教程", { value: moduleDisplayName(module) }));
              }}
            >
              <span className="tb-row-check" aria-hidden="true">{isDone && <Icon name="check" size={12} />}</span>
              <span className="tb-row-icon"><Icon name={module.icon} size={16} /></span>
              <span className="tb-row-label">{moduleDisplayName(module)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- privacy */

export function PrivacyPanel() {
  useTranslation("workbench");
  return (
    <div className="tb-popover tb-popover-privacy" role="dialog" aria-labelledby="tb-privacy-title">
      <span className="tb-privacy-mark" aria-hidden="true"><Icon name="shield" size={20} /></span>
      <h2 id="tb-privacy-title">Trusted, Secure &amp; Private</h2>
    </div>
  );
}

/* --------------------------------------------------------------- coach mark */

export function CoachMark({ onDismiss }) {
  const { t } = useTranslation("workbench");
  return (
    <div className="tb-coach" role="dialog" aria-labelledby="tb-coach-text">
      <span className="tb-coach-caret" aria-hidden="true" />
      <p id="tb-coach-text">{t("想了解什么功能，就点击对应项来学习吧～")}</p>
      <button type="button" className="tb-coach-dismiss" onClick={onDismiss}>{t("知道了")}</button>
    </div>
  );
}
