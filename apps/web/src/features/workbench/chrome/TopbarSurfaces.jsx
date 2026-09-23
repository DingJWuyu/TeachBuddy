
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

