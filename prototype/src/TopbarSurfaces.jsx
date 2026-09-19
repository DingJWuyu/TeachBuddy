/*
 * Top-bar entry surfaces for the workbench prototype.
 *
 * Geometry and type come from docs/reference/emstudio-topbar-measured-spec.md:
 *   - popovers anchor to the trigger's right edge, 8px below a 32px trigger
 *   - panel padding is 16px 20px with a 1px #e3e3e3 border and the card shadow
 *   - the search surface is a viewport-centred 512px modal over a 50% scrim
 *   - row pitch is 36px and row labels are 14px/20px
 *
 * PROTOTYPE: memory-only. Nothing here talks to a backend, and the notification
 * and search contents are fixtures standing in for module-contributed data.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

/* ------------------------------------------------------------------ search */

const SEARCH_GROUPS = [
  {
    group: '功能模块',
    items: [
      { id: 'm-timetable', name: '课程表', hint: '班级 · 周视图', icon: 'calendar' },
      { id: 'm-planner', name: '规划器', hint: '周计划与迷你月历', icon: 'planner' },
      { id: 'm-students', name: '学生', hint: '9 名学生', icon: 'students' }
    ]
  },
  {
    group: '班级',
    items: [
      { id: 'c-8a', name: '八年级 A 班', hint: '32 名学生', dot: '#94a3b8' },
      { id: 'c-club', name: '数学兴趣小组', hint: '18 名学生', dot: '#94a3b8' }
    ]
  },
  {
    group: '课程',
    items: [
      { id: 'l-fn', name: '八年级数学 · 一次函数', hint: '本周四 10:20', icon: 'lessons' }
    ]
  }
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

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (flat.length === 0 ? 0 : (current + 1) % flat.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (flat.length === 0 ? 0 : (current - 1 + flat.length) % flat.length));
    } else if (event.key === 'Enter' && flat[activeIndex]) {
      event.preventDefault();
      onAnnounce(`已打开「${flat[activeIndex].name}」`);
      onClose();
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
            placeholder="搜索学生、班级、课程…"
            aria-label="搜索学生、班级、课程"
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
              <span>试试学生姓名、班级名或课程名。</span>
            </div>
          )}
          {groups.map((group) => (
            <div className="tb-search-group" key={group.group}>
              <div className="tb-search-group-label">{group.group}</div>
              {group.items.map((item) => {
                cursor += 1;
                const index = cursor;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`tb-search-item${index === activeIndex ? ' is-active' : ''}`}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onAnnounce(`已打开「${item.name}」`);
                      onClose();
                    }}
                  >
                    {item.icon
                      ? <Icon name={item.icon} size={16} />
                      : <span className="tb-search-dot" style={{ background: item.dot }} />}
                    <span className="tb-search-item-name">{item.name}</span>
                    <span className="tb-search-item-hint">{item.hint}</span>
                  </button>
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

const NOTIFICATIONS = [
  { id: 'n1', module: 'grades', icon: 'grades', text: '「9 月月考」成绩待录入', time: '今天', unread: true },
  { id: 'n2', module: 'classwork', icon: 'classwork', text: '「八年级数学」作业明天截止', time: '明天', unread: true },
  { id: 'n3', module: 'timetable', icon: 'calendar', text: '「数学兴趣小组」课程时间调整', time: '周三', unread: false }
];

export function NotificationPanel({ onAnnounce }) {
  const [items, setItems] = useState(NOTIFICATIONS);
  const unread = items.filter((item) => item.unread).length;

  return (
    <div className="tb-popover tb-popover-notifications" role="dialog" aria-labelledby="tb-notifications-title">
      <div className="tb-popover-head">
        <h2 id="tb-notifications-title">通知</h2>
        {unread > 0 && (
          <button
            type="button"
            className="tb-popover-action"
            onClick={() => {
              setItems((current) => current.map((item) => ({ ...item, unread: false })));
              onAnnounce('已全部标为已读');
            }}
          >
            全部已读
          </button>
        )}
      </div>
      <p className="tb-popover-desc">功能模块有需要你处理的事情时会出现在这里。</p>
      {items.length === 0 ? (
        <div className="tb-popover-empty">
          <Icon name="bell" size={20} />
          <p>暂无通知</p>
        </div>
      ) : (
        <div className="tb-popover-list">
          {items.map((item) => (
            <button
              type="button"
              className={`tb-row${item.unread ? ' is-unread' : ''}`}
              key={item.id}
              onClick={() => {
                setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, unread: false } : entry)));
                onAnnounce(item.text);
              }}
            >
              <span className="tb-row-icon"><Icon name={item.icon} size={16} /></span>
              <span className="tb-row-label">{item.text}</span>
              <span className="tb-row-meta">{item.time}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- feedback */

/*
 * Each feedback type owns a colour, applied only while it is the chosen one;
 * every other chip stays grey. The reference only ever shows its first chip
 * selected, so the violet is the one colour taken from it and the other three
 * are chosen here as ordinary semantic colours.
 */
const FEEDBACK_TYPES = [
  { label: '建议', color: '#7c3aed', tint: 'rgba(124, 58, 237, .1)' },
  { label: '错误报告', color: '#e5484d', tint: 'rgba(229, 72, 77, .1)' },
  { label: '问题', color: '#c2740a', tint: 'rgba(194, 116, 10, .12)' },
  { label: '赞扬', color: '#16a34a', tint: 'rgba(22, 163, 74, .1)' }
];

export function FeedbackPanel({ onAnnounce }) {
  const [type, setType] = useState('建议');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const canSend = body.trim().length > 0;

  if (sent) {
    return (
      <div className="tb-popover tb-popover-feedback" role="dialog" aria-labelledby="tb-feedback-title">
        <div className="tb-feedback-sent">
          <span className="tb-feedback-sent-mark"><Icon name="check" size={20} /></span>
          <h2 id="tb-feedback-title">已收到，谢谢你的反馈！</h2>
          <p>这是一条原型演示，不会真的发送任何内容。</p>
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

/*
 * Shown once the last tutorial is completed. TeachBuddy's celebration uses
 * fireworks and a card with the popover grammar and amber accent.
 */
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
