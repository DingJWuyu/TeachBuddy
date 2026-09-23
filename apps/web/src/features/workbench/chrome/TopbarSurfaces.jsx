import { useScene } from '../useScene.js';
import { useWorkbenchShell } from '../shellContext.js';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createDragChip } from './dragChip.js';
import { Icon } from './icons.jsx';
import { modulePath, navigate, routeClick, withSearch } from './routes.js';
const WORKBENCH_MODULES = [{id:'questions',name:'题库',icon:'lessons'},{id:'lessons',name:'备课',icon:'pencil'},{id:'math',name:'数学工坊',icon:'graph'},{id:'resources',name:'资源库',icon:'folder'},{id:'classes',name:'班级教学',icon:'classes'}];

/* ------------------------------------------------------------------ search */

const SEARCH_GROUPS = [
  {
    group: '功能模块',
    items: [
      ...WORKBENCH_MODULES.map((item) => ({ id: 'm-' + item.id, name: item.name, hint: '个人教学工作台', icon: item.icon, route: modulePath(item.id) })),
      { id: 'm-schedule', name: '日程', hint: '课程、时间段与待办', icon: 'calendar', route: '/calendar' }
    ]
  },

];

export function SearchModal({ onClose, onAnnounce }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SEARCH_GROUPS;
    return SEARCH_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${item.name}${item.hint}`.toLowerCase().includes(needle))
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  /*
   * Results navigate to the destination they name, so search leaves the shell
   * showing the page the user picked instead of only announcing it.
   */
  function openItem(item) {
    onAnnounce(`已打开「${item.name}」`);
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
        <h2 className="sr-only" id="tb-search-title">全局搜索</h2>
        <div className="tb-search-input-row">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            className="tb-search-input"
            type="search"
            value={query}
            placeholder="搜索模块、班级、备课…"
            aria-label="搜索模块、班级、备课"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="tb-search-close" aria-label="关闭搜索" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="tb-search-results">
          {flat.length === 0 && (
            <div className="tb-search-empty">
              <Icon name="search" size={20} />
              <p>没有匹配「{query}」的结果</p>
              <span>试试模块、班级或备课名称。</span>
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
                        onAnnounce(`已打开「${item.name}」`);
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

export function NotificationPanel({ items, onChange, onAnnounce, onOpenItem }) {
  /*
   * Which notification is in flight, and whether it is over the trash. A drag
   * that has not reached the trash yet must not lose anything: removal happens
   * on drop, and only for the row that is actually being dragged.
   */
  const [draggingId, setDraggingId] = useState(null);
  const [overTrash, setOverTrash] = useState(false);
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

  function removeDragged() {
    const dragged = items.find((item) => item.id === draggingId);
    if (dragged) {
      onChange(items.filter((item) => item.id !== dragged.id));
      onAnnounce('通知已删除');
    }
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
        <h2 id="tb-notifications-title">通知</h2>
        {unread > 0 && (
          <button
            type="button"
            className="tb-popover-action"
            onClick={() => {
              onChange(items.map((item) => ({ ...item, read: true })));
              onAnnounce('已全部标为已读');
            }}
          >
            全部已读
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="tb-popover-empty">
          <Icon name="bell" size={20} />
          <p>暂无通知</p>
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
              aria-pressed={item.eventId ? undefined : item.read}
              title={item.eventId ? '查看对应时间段' : item.read ? '点击标为未读，或拖到垃圾桶删除' : '点击标为已读'}
              onClick={() => {
                if (item.eventId) { onOpenItem?.(item); return; }
                setRead(item.id, !item.read);
                onAnnounce(item.read ? `「${item.text}」已标为未读` : `「${item.text}」已标为已读`);
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
        className="tb-notification-trash"
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
        <span>删除消息</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- feedback */

const FEEDBACK_TYPES = [
  { label: '建议', color: '#7c3aed', tint: 'rgba(124, 58, 237, .1)' },
  { label: '错误报告', color: '#e5484d', tint: 'rgba(229, 72, 77, .1)' },
  { label: '问题', color: '#c2740a', tint: 'rgba(194, 116, 10, .12)' },
  { label: '赞扬', color: '#16a34a', tint: 'rgba(22, 163, 74, .1)' }
];

export function FeedbackPanel({ onAnnounce, onClose }) {
  const [type, setType] = useState('建议');
  const { accountKey } = useWorkbenchShell();
  const [feedback, patchFeedback] = useScene(accountKey, 'feedback', { body: '', records: [] });
  const body = feedback.body;
  const setBody = body => patchFeedback({ body });
  const [sent, setSent] = useState(false);
  const canSend = body.trim().length > 0;

  if (sent) {
    return (
      <div className="tb-popover tb-popover-feedback" role="dialog" aria-labelledby="tb-feedback-title">
        <div className="tb-feedback-sent">
          <span className="tb-feedback-sent-mark"><Icon name="check" size={20} /></span>
          <h2 id="tb-feedback-title">已记录，谢谢你的反馈！</h2>
          {/* The acknowledgement replaces the form, so it has to carry its own
              way out; otherwise the only exits are Escape and a click outside. */}
          <button type="button" className="tb-feedback-dismiss" onClick={onClose}>知道了</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tb-popover tb-popover-feedback" role="dialog" aria-labelledby="tb-feedback-title">
      <div className="tb-popover-head">
        <h2 id="tb-feedback-title">发送反馈</h2>
        <div className="tb-feedback-types" role="group" aria-label="反馈类型">
          {FEEDBACK_TYPES.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`tb-chip${item.label === type ? ' is-current' : ''}`}
              style={{ '--tb-chip-color': item.color, '--tb-chip-tint': item.tint }}
              aria-pressed={item.label === type}
              onClick={() => setType(item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="tb-feedback-body"
        value={body}
        placeholder="说说你的想法，或者遇到的问题…"
        aria-label="反馈内容"
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="tb-feedback-foot">
        <p className="tb-feedback-hint">
          粘贴截图：
          <kbd>Win</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
        </p>
        <button
          type="button"
          className="tb-button-primary"
          disabled={!canSend}
          onClick={() => {
            patchFeedback({ body: '', records: [...feedback.records, { type, body, createdAt: new Date().toISOString() }] });
            setSent(true);
            onAnnounce('反馈已记录');
          }}
        >
          发送
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- tutorial */

export function TutorialPanel({ modules, completed, onComplete, onAnnounce }) {
  const done = modules.filter((module) => completed.includes(module.id)).length;

  return (
    <div className="tb-popover tb-popover-tutorial" role="dialog" aria-labelledby="tb-tutorial-title">
      <h2 id="tb-tutorial-title">快速上手</h2>
      <p className="tb-popover-desc">选一个功能，看看它怎么用。</p>
      <div className="tb-progress">
        <span className="tb-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={modules.length} aria-valuenow={done} aria-label="教程完成进度">
          <span className="tb-progress-fill" style={{ width: `${modules.length ? (done / modules.length) * 100 : 0}%` }} />
        </span>
        <span className="tb-progress-label">已完成 {done} / {modules.length}</span>
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
                onAnnounce(isDone ? `「${module.name}」教程已重置` : `已完成「${module.name}」教程`);
              }}
            >
              <span className="tb-row-check" aria-hidden="true">{isDone && <Icon name="check" size={12} />}</span>
              <span className="tb-row-icon"><Icon name={module.icon} size={16} /></span>
              <span className="tb-row-label">{module.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- privacy */

export function PrivacyPanel() {
  return (
    <div className="tb-popover tb-popover-privacy" role="dialog" aria-labelledby="tb-privacy-title">
      <span className="tb-privacy-mark" aria-hidden="true"><Icon name="shield" size={20} /></span>
      <h2 id="tb-privacy-title">Trusted, Secure &amp; Private</h2>
    </div>
  );
}

/* --------------------------------------------------------------- coach mark */

export function CoachMark({ onDismiss }) {
  return (
    <div className="tb-coach" role="dialog" aria-labelledby="tb-coach-text">
      <span className="tb-coach-caret" aria-hidden="true" />
      <p id="tb-coach-text">想了解什么功能，就点击对应项来学习吧～</p>
      <button type="button" className="tb-coach-dismiss" onClick={onDismiss}>知道了</button>
    </div>
  );
}

/* ------------------------------------------------------------- celebration */

const BURSTS = [
  { x: 20, y: 30, delay: 0, color: '#fe9a00' },
  { x: 78, y: 26, delay: .45, color: '#7160a7' },
  { x: 50, y: 14, delay: .9, color: '#fb2c36' },
  { x: 28, y: 70, delay: 1.35, color: '#16a34a' },
  { x: 72, y: 74, delay: 1.8, color: '#2563eb' }
];
const PARTICLES = 14;

export function TutorialCelebration({ onClose }) {
  return (
    <div className="tb-celebration" role="dialog" aria-modal="true" aria-labelledby="tb-celebration-title">
      <div className="tb-celebration-scrim" onPointerDown={onClose} />
      <div className="tb-celebration-sky" aria-hidden="true">
        {BURSTS.map((burst) => (
          <span
            className="tb-firework"
            key={`${burst.x}-${burst.y}`}
            style={{ left: `${burst.x}%`, top: `${burst.y}%`, color: burst.color, '--tb-flash-delay': `${burst.delay}s` }}
          >
            {Array.from({ length: PARTICLES }, (_, index) => (
              <span
                className="tb-firework-particle"
                key={index}
                style={{
                  '--tb-angle': `${(360 / PARTICLES) * index}deg`,
                  '--tb-distance': `${52 + (index % 4) * 10}px`,
                  '--tb-delay': `${(burst.delay + index * 0.025).toFixed(3)}s`
                }}
              />
            ))}
          </span>
        ))}
      </div>
      <div className="tb-celebration-card">
        <span className="tb-celebration-mark" aria-hidden="true"><Icon name="tutorial" size={24} /></span>
        <h2 id="tb-celebration-title">恭喜您完成了所有引导！</h2>
        <p>请尽情享受吧～</p>
        <button type="button" className="tb-button-primary" onClick={onClose}>好的</button>
      </div>
    </div>
  );
}
