import { h, Fragment } from '../shim.js';
import { ConfirmMenuItem } from '../kit/confirm.jsx';
import { Popover } from '../kit/popover.jsx';
import { tb, useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, t, cx, tx, useLocale, isEnglish, monthDay } from '../react.js';
import { seedDemo } from '../demo/seed.js';
import { Prose, Inline } from './Prose.jsx';
import { whenLabel } from './script.js';

/*
 * The teaching assistant, shared by the home page and the side panel.
 *
 * Shaped after t3code's chat: the answer is plain reading text with no bubble
 * or avatar; the work the assistant did sits above it as quiet one-line rows
 * that fold into “查阅了 2 处 · 4 秒” once the answer starts; what it found
 * comes back as cards you can act on; and the composer is a glass slab with a
 * context drawer tucked under it.
 */
const ta = tx;

const MODELS = [
  { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek', get note() { return tx('快速、擅长推理'); } },
  { id: 'z-ai/glm-5.3-flash', name: 'GLM', get note() { return tx('中文表达自然'); } },
];

export const SUGGESTIONS = [
  { icon: 'list', title: '梳理一节课的讲解顺序', prompt: '帮我梳理一节二次函数图像与性质的讲解顺序' },
  { icon: 'chat', title: '讨论一道题的不同讲法', prompt: '这道三角形全等的证明题，有哪几种讲法？' },
  { icon: 'graph', title: '构思一个数学演示', prompt: '构思一个演示，让学生看到抛物线开口方向如何随 a 变化' },
  { icon: 'layers', title: '设计一组分层练习', prompt: '为分数加减法设计一组由易到难的分层练习' },
];

const KIND = {
  question: { glyph: 'book', get label() { return tx('题目'); }, hue: 'orange' },
  entry: { glyph: 'calendar', get label() { return tx('日程'); }, hue: 'indigo' },
  resource: { glyph: 'folder', get label() { return tx('资料'); }, hue: 'blue' },
};

/* ---------- glyphs ---------- */
const PATHS = {
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  chat: 'M20.5 11.6a8.1 8.1 0 0 1-11.8 7.2L3.8 20l1.3-4.4A8.1 8.1 0 1 1 20.5 11.6Z',
  graph: 'M3 12.8h3.2l3.1 7.2 5.2-16H21',
  layers: 'm12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5ZM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5',
  spark: 'M12 3.5c.5 3.9 2.6 6 6.5 6.5-3.9.5-6 2.6-6.5 6.5-.5-3.9-2.6-6-6.5-6.5 3.9-.5 6-2.6 6.5-6.5Z',
  plus: 'M12 5.5v13M5.5 12h13',
  arrowUp: 'M12 19V5.5M6.5 11 12 5.5l5.5 5.5',
  arrowDown: 'M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5',
  stop: 'M8 8h8v8H8z',
  chevron: 'm7.5 10 4.5 4.5 4.5-4.5',
  chevronRight: 'm10 7.5 4.5 4.5-4.5 4.5',
  check: 'm5.5 12.5 4 4 9-9.5',
  alert: 'M12 8.5v4.5M12 16.4h.01M10.3 4 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z',
  book: 'M6.5 3.5h11.2c.7 0 1.3.6 1.3 1.3v13.4c0 .7-.6 1.3-1.3 1.3H6.5A2.5 2.5 0 0 1 4 17V6a2.5 2.5 0 0 1 2.5-2.5ZM4 17a2.5 2.5 0 0 1 2.5-2.5H19',
  calendar: 'M6.5 5h11a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3ZM3.5 10h17M8 3v4M16 3v4',
  folder: 'M3.5 7.5a2 2 0 0 1 2-2h4.2l2 2.2h6.8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2ZM3.5 10.6h17',
  close: 'm7 7 10 10M17 7 7 17',
  back: 'm14 6-6 6 6 6',
  search: 'M10.8 17.6a6.8 6.8 0 1 1 0-13.6 6.8 6.8 0 0 1 0 13.6Zm9.7 2.9-4.9-4.9',
  copy: 'M9 9h9.5a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19v-8.5A1.5 1.5 0 0 1 9 9ZM16.5 9V5A1.5 1.5 0 0 0 15 3.5H5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h2.5',
  retry: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.8h3.8',
  compose: 'M12 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V12M17.8 3.8l2.4 2.4-7.7 7.7-3.1.7.7-3.1 7.7-7.7Z',
  expand: 'M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5l-6 6M4.5 19.5l6-6',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  pin: 'M9 4.5h6M10 4.5v5.2l-3 3.3h10l-3-3.3V4.5M12 13v6.5',
  pencil: 'm15.6 4.6 3.8 3.8L8.7 19.1l-4.6.8.8-4.6zM13.6 6.6l3.8 3.8',
  at: 'M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm0 0v1.3a2.7 2.7 0 0 0 5.2 1A8.6 8.6 0 1 0 17 19',
  open: 'M14 4.5h5.5V10M19.5 4.5 11 13M17 13.5v4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4',
  quote: 'M5 11.5h4.5V17H5zM5 11.5C5 8.5 6.5 6.6 9 6M14.5 11.5H19V17h-4.5zM14.5 11.5c0-3 1.5-4.9 4-5.5',
};
export function Glyph({ name, size = 18, stroke = 1.75 }) {
  return (
    <svg className="tbx-glyph" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {globalThis.__tbx?.glyphs?.[name] ?? <path d={PATHS[name] || PATHS.spark} />}
    </svg>
  );
}

/* ---------- small helpers ---------- */
const uuid = () => crypto.randomUUID();
async function call(method, path, body) {
  const init = { method, headers: { 'Idempotency-Key': uuid() } };
  if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  const res = await fetch(path, init);
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(String(res.status)), { body: json });
  return json;
}
const toDoc = (text) => ({ version: 2, blocks: String(text).split('\n').filter(Boolean).map((line) => {
  const runs = [];
  let end = 0;
  for (const m of line.matchAll(/\$([^$]+)\$/g)) {
    if (m.index > end) runs.push({ type: 'text', text: line.slice(end, m.index) });
    runs.push({ type: 'math', latex: m[1] });
    end = m.index + m[0].length;
  }
  if (end < line.length) runs.push({ type: 'text', text: line.slice(end) });
  return { type: 'paragraph', runs };
}) });

function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return tx('刚刚');
  if (diff < 3600) return tx('{{n}} 分钟', { n: Math.floor(diff / 60) });
  if (diff < 86400) return tx('{{n}} 小时', { n: Math.floor(diff / 3600) });
  const d = new Date(iso);
  return monthDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
}
const clock = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function bucket(iso) {
  const d = new Date(iso).getTime();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d >= start) return tx('今天');
  if (d >= start - 86400000) return tx('昨天');
  if (d >= start - 6 * 86400000) return tx('最近 7 天');
  return tx('更早');
}
// The service names fresh threads “新对话”; show that in the interface language.
const threadTitle = (title) => (!title || title === '新对话' ? tx('新对话') : title);
function greeting() {
  const hour = new Date().getHours();
  return tx(hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 13 ? '中午好' : hour < 18 ? '下午好' : '晚上好');
}

function useRoute() {
  const read = () => globalThis.__teachbuddyLocation?.pathname ?? '/';
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener('tb:navigate', on);
    window.addEventListener('popstate', on);
    return () => { window.removeEventListener('tb:navigate', on); window.removeEventListener('popstate', on); };
  }, []);
  return path;
}

function useOutside(open, ref, close) {
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (!ref.current?.contains(e.target)) close(); };
    const key = (e) => {
      if (e.key !== 'Escape') return;
      ref.current?.querySelector('button')?.focus();
      close();
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open]);
}

/* Upcoming lessons, read once per mount from the schedule. */
let lessonCache = null;
async function loadLessons(force = false) {
  if (lessonCache && !force) return lessonCache;
  try {
    const { items } = await call('GET', '/api/modules/schedule/entries');
    const today = new Date();
    const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = `${key(today)} ${today.toTimeString().slice(0, 5)}`;
    lessonCache = items
      .filter((e) => e.time?.date && /数学|课/.test(e.title) && `${e.time.date} ${e.time.startTime}` >= now)
      .map((e) => ({ id: e.id, title: e.title, date: e.time.date, start: e.time.startTime, todo: (e.items ?? []).map((i) => i.text) }))
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
      .slice(0, 6);
  } catch {
    lessonCache = [];
  }
  return lessonCache;
}
function useLessons(revision) {
  const [lessons, setLessons] = useState(lessonCache ?? []);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    loadLessons(true).then((l) => live && setLessons(l));
    const again = () => setTick((n) => n + 1);
    window.addEventListener('tb:navigate', again);
    window.addEventListener('focus', again);
    return () => { live = false; window.removeEventListener('tb:navigate', again); window.removeEventListener('focus', again); };
  }, [revision, tick]);
  return [lessons, () => setTick((n) => n + 1)];
}

/* Display titles for references in the draft (the draft itself stores ids). */
const REF_TITLES = new Map();
const remember = (r) => { if (r?.id) REF_TITLES.set(`${r.kind}:${r.id}`, { title: r.title, note: r.note }); };
function useRefTitles(refs) {
  const [, bump] = useState(0);
  useEffect(() => {
    let live = true;
    for (const r of refs) {
      const key = `${r.kind}:${r.id}`;
      if (REF_TITLES.has(key)) continue;
      REF_TITLES.set(key, { title: KIND[r.kind]?.label ?? tx('引用') });
      const where = r.kind === 'question' ? '/api/modules/questions/v2/items/' : r.kind === 'entry' ? '/api/modules/schedule/entries/' : '/api/modules/resources/items/';
      call('GET', where + encodeURIComponent(r.id)).then((o) => {
        REF_TITLES.set(key, { title: o.title || KIND[r.kind]?.label, note: r.kind === 'entry' && o.time?.date ? whenLabel({ date: o.time.date, start: o.time.startTime }) : undefined });
        if (live) bump((n) => n + 1);
      }).catch(() => {});
    }
    return () => { live = false; };
  }, [refs.map((r) => r.id).join(',')]);
}

/* What the teacher is looking at right now, offered as context. */
const titleCache = new Map();
function selectedQuestionId() {
  // The question bank keeps its selection in its own stored scene, not the URL.
  try {
    const store = globalThis.__teachbuddyLocalStorage;
    const key = Object.keys(store).find((k) => k.endsWith(':questions-materials-scene') && !k.includes(':branch:') && !k.includes(':head:'));
    const scene = key ? JSON.parse(store.getItem(key)) : null;
    return scene?.kind === 'question' && scene.id ? scene.id : null;
  } catch {
    return null;
  }
}
function selectedResourceId() {
  try {
    const store = globalThis.__teachbuddyLocalStorage;
    const key = Object.keys(store).find((k) => k.endsWith(':scene:resources') && !k.includes(':branch:') && !k.includes(':head:'));
    const scene = key ? JSON.parse(store.getItem(key)) : null;
    return scene?.openId ?? null;
  } catch {
    return null;
  }
}
function useCurrentContext(enabled) {
  const path = useRoute();
  const [ctx, setCtx] = useState(null);
  const [picked, setPicked] = useState(null);
  useEffect(() => {
    if (!enabled || !/^\/(questions|resources)(?:\/|$)/.test(path)) { setPicked(null); return undefined; }
    const read = () => setPicked(path.startsWith('/resources') ? selectedResourceId() : selectedQuestionId());
    read();
    const id = setInterval(read, 700);
    return () => clearInterval(id);
  }, [path, enabled]);
  useEffect(() => {
    if (!enabled) { setCtx(null); return undefined; }
    let live = true;
    const m = /^\/(questions|resources)\/([^/]+)$/.exec(path);
    // Resource deep links are consumed once; later browsing is owned by its scene.
    const target = m && (m[1] !== 'resources' || picked === decodeURIComponent(m[2]))
      ? { kind: m[1] === 'questions' ? 'question' : 'resource', id: decodeURIComponent(m[2]), area: m[1] }
      : picked && path.startsWith('/questions') ? { kind: 'question', id: picked, area: 'questions' } : null;
    (async () => {
      if (target) {
        const where = target.kind === 'question' ? '/api/modules/questions/v2/items/' : '/api/modules/resources/items/';
        try {
          const cached = titleCache.get(target.id) ?? await call('GET', where + encodeURIComponent(target.id));
          titleCache.set(target.id, cached);
          if (live) setCtx({ ...target, version: cached.version, title: cached.title || KIND[target.kind].label });
        } catch { if (live) setCtx({ area: target.area }); }
      } else if (path.startsWith('/calendar')) {
        const [next] = await loadLessons(true);
        if (live) setCtx(next ? { kind: 'entry', id: next.id, title: next.title, note: whenLabel(next), area: 'calendar' } : { area: 'calendar' });
      } else if (live) setCtx({ area: path.split('/')[1] || 'home' });
    })();
    return () => { live = false; };
  }, [path, enabled, picked]);
  return ctx;
}

/* The app drops a send that lands while the draft is still autosaving, so try
   again a moment later until the turn has started or the text has changed. */
const latestAgent = { current: null };
function sendReliably() {
  const first = latestAgent.current;
  if (!first?.draft) return;
  const text = first.draft.text;
  let tries = 0;
  const attempt = () => {
    const a = latestAgent.current;
    if (!a?.draft || a.draft.text !== text || a.snapshot?.turns.some((x) => x.state === 'running') || tries > 5) return;
    tries += 1;
    void a.send();
    setTimeout(attempt, 750);
  };
  attempt();
}

/* ---------- conversations: rename, pin, delete ---------- */
const patchThread = (id, body) => call('PATCH', `/api/agent/conversations/${encodeURIComponent(id)}`, body);
const deleteThread = (id) => call('DELETE', `/api/agent/conversations/${encodeURIComponent(id)}`);

function ThreadMenu({ item, agent, onRename, onClose }) {
  const ref = useRef(null);
  useOutside(true, ref, onClose);
  return (
    <div className="tbx-menu is-thread" ref={ref} role="menu" onClick={(e) => e.stopPropagation()}>
      <button role="menuitem" onClick={async () => { onClose(); await patchThread(item.id, { pinned: !item.pinned }); await agent.retry(); }}>
        <Glyph name="pin" size={16} />{item.pinned ? tx('取消置顶') : tx('置顶')}
      </button>
      <button role="menuitem" onClick={() => { onClose(); onRename(); }}><Glyph name="pencil" size={16} />{tx('重命名')}</button>
      <ConfirmMenuItem
        icon={<Glyph name="trash" size={16} />}
        label={tx('删除')}
        onConfirm={async () => {
          onClose();
          try {
            await deleteThread(item.id);
            await agent.retry();
            if (agent.id === item.id) {
              const next = agent.list.find((x) => x.id !== item.id);
              if (next) agent.select(next.id); else void agent.create();
            }
          } catch { /* a running thread can't be deleted */ }
        }}
      />
    </div>
  );
}

/* ---------- thread list (home) ---------- */
export function ThreadList({ onPick }) {
  useLocale();
  const { useAgent } = tb();
  const agent = useAgent();
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const running = agent.configuration?.activeTurn?.conversationId;
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = agent.list.filter((c) => !q || `${c.title} ${c.preview ?? ''}`.toLowerCase().includes(q));
    const out = [];
    const pinned = items.filter((c) => c.pinned);
    if (pinned.length) out.push({ label: tx('已置顶'), items: pinned });
    for (const item of items.filter((c) => !c.pinned)) {
      const label = bucket(item.updatedAt);
      let group = out.find((g) => g.label === label);
      if (!group) out.push(group = { label, items: [] });
      group.items.push(item);
    }
    return out;
  }, [agent.list, query]);

  async function commitRename(item) {
    const title = draftTitle.trim();
    setRenaming(null);
    if (title && title !== item.title) { await patchThread(item.id, { title }); await agent.retry(); }
  }

  return (
    <aside className="tbx-threads" aria-label={tx('对话')}>
      <div className="tbx-threads-head">
        <label className="tbx-thread-search">
          <Glyph name="search" size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx('搜索对话')} aria-label={tx('搜索对话')} />
        </label>
        <button className="tbx-icon-btn tbx-compose" title={tx('新对话 ⌘N')} aria-label={tx('新对话')} onClick={() => { void agent.create(); onPick?.(); }} disabled={agent.busy}>
          <Glyph name="compose" size={18} />
        </button>
      </div>
      <div className="tbx-thread-scroll">
        {agent.list.length === 0 && <p className="tbx-threads-empty">{tx('还没有对话。')}<br />{tx('从右边开始第一段吧。')}</p>}
        {agent.list.length > 0 && groups.length === 0 && <p className="tbx-threads-empty">{tx('没有找到相关的对话。')}</p>}
        {groups.map((group) => (
          <section key={group.label} className="tbx-thread-group">
            <h3>{group.label}</h3>
            {group.items.map((item, i) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                style={{ '--i': i }}
                className={cx('tbx-thread', item.id === agent.id && 'is-active', menu?.id === item.id && 'is-menu')}
                onClick={() => { if (renaming !== item.id) { agent.select(item.id); onPick?.(); } }}
                onKeyDown={(e) => { if (e.key === 'Enter' && renaming !== item.id) agent.select(item.id); }}
                aria-current={item.id === agent.id ? 'true' : undefined}
              >
                <span className="tbx-thread-line">
                  {renaming === item.id ? (
                    <input
                      className="tbx-thread-rename"
                      autoFocus
                      value={draftTitle}
                      maxLength={80}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onBlur={() => commitRename(item)}
                      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitRename(item); if (e.key === 'Escape') setRenaming(null); }}
                    />
                  ) : <span className="tbx-thread-title">{threadTitle(item.title)}</span>}
                  {running === item.id
                    ? <span className="tbx-spinner" aria-label={tx('生成中')} />
                    : <span className="tbx-thread-time">{item.pinned && <Glyph name="pin" size={12} />}{relativeTime(item.updatedAt)}</span>}
                </span>
                <span className="tbx-thread-preview">{running === item.id ? tx('正在回答…') : item.preview || tx('还没有回答')}</span>
                <button
                  className="tbx-thread-more"
                  aria-label={tx('对话选项')}
                  onClick={(e) => { e.stopPropagation(); setMenu(menu?.id === item.id ? null : { id: item.id }); }}
                ></button>
                {menu?.id === item.id && (
                  <ThreadMenu item={item} agent={agent} onClose={() => setMenu(null)} onRename={() => { setDraftTitle(item.title); setRenaming(item.id); }} />
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

/* ---------- the work log ---------- */
const TOOL = {
  'questions.search': { glyph: 'search', verb: '在题库里找', live: '正在题库里找' },
  'questions.read': { glyph: 'book', verb: '读了题目', live: '正在读题目' },
  'schedule.read': { glyph: 'calendar', verb: '看了日程', live: '正在看日程' },
};
function Elapsed({ from, to }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (to) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [to]);
  const s = Math.max(0, Math.round(((to ? new Date(to) : new Date()) - new Date(from)) / 1000));
  return <span className="tbx-num">{s < 60 ? tx('{{s}} 秒', { s }) : tx('{{m}} 分 {{s}} 秒', { m: Math.floor(s / 60), s: s % 60 })}</span>;
}
function Shimmer({ children }) {
  return <span className="tbx-shine" data-text={typeof children === 'string' ? children : undefined}>{children}</span>;
}
function WorkRow({ call }) {
  const tool = TOOL[call.name] ?? { glyph: 'spark', verb: call.name };
  const live = call.state === 'executing';
  const failed = call.state === 'failed';
  const verb = tx(live ? tool.live ?? tool.verb : failed ? '没有读到' : tool.verb);
  return (
    <div className={cx('tbx-work-row', live && 'is-live', failed && 'is-failed')}>
      <span className="tbx-work-icon"><Glyph name={failed ? 'alert' : tool.glyph} size={15} /></span>
      <span className="tbx-work-label">
        {live ? <Shimmer>{verb}</Shimmer> : <strong>{verb}</strong>}
        {call.detail && <span className="tbx-work-detail">{call.detail}</span>}
      </span>
    </div>
  );
}
function WorkLog({ calls, turn, answered }) {
  const live = turn.state === 'running' && !answered;
  const [open, setOpen] = useState(false);
  if (!calls.length) return null;
  const end = calls[calls.length - 1].endedAt ?? null;
  if (live) {
    return <div className="tbx-work">{calls.map((c) => <WorkRow key={c.toolCallId} call={c} />)}</div>;
  }
  return (
    <div className={cx('tbx-work is-folded', open && 'is-open')}>
      <button className="tbx-work-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{tx('查阅了 {{n}} 处 · 用时', { n: calls.length })} <Elapsed from={turn.createdAt} to={end ?? turn.endedAt ?? turn.createdAt} /></span>
        <Glyph name="chevronRight" size={14} />
      </button>
      <div className="tbx-work-fold"><div>{calls.map((c) => <WorkRow key={c.toolCallId} call={c} />)}</div></div>
    </div>
  );
}

/* ---------- result cards ---------- */
const done = new Map();
function useDone(key) {
  const [state, setState] = useState(done.get(key) ?? 'idle');
  const set = (v) => { done.set(key, v); setState(v); };
  return [state, set];
}
function CardHead({ glyph, hue, title, meta, children }) {
  return (
    <div className="tbx-card-head">
      <span className={cx('tbx-card-tile', `is-${hue}`)}><Glyph name={glyph} size={16} /></span>
      <span className="tbx-card-title"><strong>{title}</strong>{meta && <small>{meta}</small>}</span>
      {children}
    </div>
  );
}
function ActionButton({ state, onRun, idle, doneLabel, doneTo }) {
  const { navigate } = tb();
  if (state === 'done') {
    return (
      <button className="tbx-pill is-done" onClick={() => doneTo && navigate(doneTo)}>
        <Glyph name="check" size={14} stroke={2.2} />{doneLabel}{doneTo && <Glyph name="chevronRight" size={13} />}
      </button>
    );
  }
  return (
    <button className="tbx-pill" disabled={state === 'busy'} onClick={onRun}>
      {state === 'busy' ? <span className="tbx-spinner is-small" /> : null}{state === 'error' ? tx('没成功，再试一次') : idle}
    </button>
  );
}
function QuestionRows({ items, agent }) {
  const { navigate } = tb();
  return (
    <div className="tbx-card-rows">
      {items.map((q, i) => (
        <div className="tbx-card-row" key={q.id} style={{ '--i': i }}>
          <button className="tbx-card-row-main" onClick={() => navigate(`/questions/${q.id}`)}>
            <span className="tbx-card-row-title">{q.title}</span>
            {q.excerpt && <span className="tbx-card-row-text"><Inline text={q.excerpt} /></span>}
          </button>
          <span className="tbx-card-row-tags">{q.tags.map((tag) => <span key={tag}>{tag}</span>)}</span>
          <button className="tbx-row-act" title={tx('引用到对话')} aria-label={tx('引用到对话')} onClick={() => agent.addReference?.('question', q.id)}><Glyph name="quote" size={15} /></button>
        </div>
      ))}
    </div>
  );
}
function ResultCard({ card, cardKey, agent }) {
  const { navigate } = tb();
  const [state, setState] = useDone(cardKey);
  const [expanded, setExpanded] = useState(false);
  const run = async (task) => { setState('busy'); try { await task(); setState('done'); } catch { setState('error'); } };

  if (card.kind === 'questions') {
    return (
      <div className="tbx-card">
        <CardHead glyph="book" hue="orange" title={card.title} meta={tx('点开查看，或引用到对话里继续聊')} />
        <QuestionRows items={card.items} agent={agent} />
      </div>
    );
  }
  if (card.kind === 'plan') {
    return (
      <div className="tbx-card">
        <CardHead glyph="list" hue="indigo" title={card.title} meta={card.meta}>
          <ActionButton state={state} idle={tx('加到日程')} doneLabel={tx('已加到待安排')} doneTo="/calendar" onRun={() => run(() => call('POST', '/api/modules/schedule/entries', {
            title: card.entryTitle,
            items: card.steps.map((text) => ({ id: uuid(), text, priority: 'normal', completed: false })),
            time: null, repeat: null, reminder: null,
            calendar: { allDay: false, notes: '', tags: [] },
          }))} />
        </CardHead>
        <ol className="tbx-card-steps">{card.steps.map((s, i) => <li key={i} style={{ '--i': i }}><span><Inline text={s} /></span></li>)}</ol>
      </div>
    );
  }
  if (card.kind === 'practice' || card.kind === 'variant') {
    const items = card.kind === 'variant' ? [card.item] : card.items;
    const shown = expanded ? items : items.slice(0, 3);
    return (
      <div className="tbx-card">
        <CardHead glyph="layers" hue="orange" title={card.title} meta={card.meta}>
          <ActionButton state={state} idle={card.kind === 'variant' ? tx('存进题库') : tx('存进题库 · {{n}} 道', { n: items.length })} doneLabel={tx('已存进题库')} doneTo="/questions" onRun={() => run(async () => {
            for (const q of items) {
              await call('POST', '/api/modules/questions/v2/items', { title: q.title, body: toDoc(q.body), solution: toDoc(q.solution), answerStatus: 'present', typeId: q.typeId ?? null, tagIds: q.tagIds ?? [] });
            }
          })} />
        </CardHead>
        <div className="tbx-card-rows">
          {shown.map((q, i) => (
            <div className="tbx-card-row is-static is-problem" key={i} style={{ '--i': i }}>
              {q.tier && <span className="tbx-card-tier">{q.tier.split(' · ')[0]}</span>}
              <span className="tbx-card-row-title"><Inline text={q.body} /></span>
              <span className="tbx-card-answer"><Inline text={q.solution} /></span>
            </div>
          ))}
        </div>
        {items.length > 3 && (
          <button className="tbx-card-more" onClick={() => setExpanded(!expanded)}>{expanded ? tx('收起') : tx('展开其余 {{n}} 道', { n: items.length - 3 })}<Glyph name="chevron" size={14} /></button>
        )}
      </div>
    );
  }
  if (card.kind === 'lessons') {
    return (
      <div className="tbx-card">
        <CardHead glyph="calendar" hue="indigo" title={card.title} meta={tx('{{n}} 件事', { n: card.items.length })}>
          <button className="tbx-pill is-quiet" onClick={() => navigate('/calendar')}>{tx('打开日程')}<Glyph name="chevronRight" size={13} /></button>
        </CardHead>
        <div className="tbx-card-rows">
          {card.items.map((e, i) => (
            <div className="tbx-card-row is-static is-time" key={e.id} style={{ '--i': i }}>
              <span className="tbx-card-time tbx-num">{e.when}</span>
              <span className="tbx-card-row-title">{e.title}</span>
              {e.label && <span className="tbx-card-row-tags"><span>{e.label}</span></span>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (card.kind === 'link') {
    return (
      <button className="tbx-card is-link" onClick={() => navigate(card.route)}>
        <CardHead glyph={card.icon ?? 'open'} hue="lavender" title={card.title} meta={card.meta}>
          <span className="tbx-card-go"><Glyph name="chevronRight" size={16} /></span>
        </CardHead>
      </button>
    );
  }
  return null;
}

/* ---------- messages ---------- */
function RefChip({ r, onRemove, suggest, onAdd }) {
  const { navigate } = tb();
  const kind = KIND[r.kind] ?? KIND.question;
  const open = () => {
    if (r.kind === 'question') navigate(`/questions/${r.id}`);
    else if (r.kind === 'resource') navigate(`/resources/${r.id}`);
    else navigate('/calendar');
  };
  return (
    <span className={cx('tbx-chip', `is-${kind.hue}`, suggest && 'is-suggest')}>
      <Glyph name={suggest ? 'plus' : kind.glyph} size={13} stroke={2} />
      <button type="button" onClick={suggest ? onAdd : open} title={suggest ? tx('把「{{title}}」带进对话', { title: r.title }) : r.title}>{r.title}</button>
      {r.note && <small>{r.note}</small>}
      {onRemove && (
        <button type="button" className="tbx-chip-x" aria-label={ta('移除引用')} onClick={onRemove}><Glyph name="close" size={11} stroke={2.2} /></button>
      )}
    </span>
  );
}

function UserMessage({ m }) {
  return (
    <article className="tbx-msg is-user">
      <div className="tbx-bubble">
        <p>{m.text}</p>
        {m.references.length > 0 && (
          <div className="tbx-chips is-sent">
            {m.references.map((r, i) => <RefChip key={i} r={{ kind: r.input.kind, id: r.input.id, title: r.title }} />)}
          </div>
        )}
      </div>
    </article>
  );
}

function CopyButton({ text, onError }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const reset = useRef(null);
  useEffect(() => () => clearTimeout(reset.current), []);
  async function copy() {
    clearTimeout(reset.current);
    setCopied(false);
    setCopying(true);
    onError(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      reset.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      onError(true);
    } finally {
      setCopying(false);
    }
  }
  return (
    <button className={cx('tbx-meta-btn', copied && 'is-done')} aria-label={tx('复制')} title={copied ? tx('已复制') : tx('复制')} disabled={copying} onClick={copy}>
      <span className="tbx-morph"><Glyph name="copy" size={15} /><Glyph name="check" size={15} stroke={2.2} /></span>
    </button>
  );
}

function AssistantMessage({ m, agent, last, onRegenerate, model }) {
  const [copyError, setCopyError] = useState(false);
  const streaming = m.state === 'streaming';
  return (
    <article className={cx('tbx-msg is-assistant', streaming && 'is-streaming', last && 'is-last')}>
      <Prose text={m.text} />
      {streaming && <span className="tbx-typing" aria-hidden="true" />}
      {(m.cards ?? []).length > 0 && (
        <div className="tbx-cards">
          {m.cards.map((c, i) => <ResultCard key={i} card={c} cardKey={`${m.id}:${i}`} agent={agent} />)}
        </div>
      )}
      {m.state === 'partial' && <p className="tbx-msg-note">{tx('回答被停止了，只保留了前面的部分。')}</p>}
      {!streaming && m.text && (
        <div className="tbx-meta">
          <CopyButton text={m.text} onError={setCopyError} />
          {last && onRegenerate && (
            <button className="tbx-meta-btn" aria-label={tx('重新回答')} title={tx('重新回答')} onClick={onRegenerate}><Glyph name="retry" size={15} /></button>
          )}
          <span className="tbx-meta-text tbx-num">{clock(m.createdAt)}{model ? ` · ${model}` : ''}</span>
        </div>
      )}
      {copyError && <div className="tbx-notice is-error" role="alert">{tx('复制失败，请重试')}</div>}
    </article>
  );
}

function Divider({ children, tone }) {
  return <div className={cx('tbx-divider', tone && `is-${tone}`)}><span>{children}</span></div>;
}

/* ---------- composer ---------- */
function ModelPicker({ agent }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(open, ref, () => setOpen(false));
  const current = MODELS.find((m) => m.id === agent.model) || MODELS[0];
  return (
    <span className="tbx-model" ref={ref}>
      <button type="button" className="tbx-model-button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label={ta('选择模型')}>
        <span className="tbx-model-dot" />{current.name}<Glyph name="chevron" size={13} />
      </button>
      {open && (
        <div className="tbx-model-menu" role="listbox">
          {MODELS.map((m) => {
            const ready = agent.configuration?.models.find((x) => x.id === m.id)?.state === 'ready';
            return (
              <button key={m.id} type="button" role="option" aria-selected={m.id === agent.model} disabled={!ready}
                className={cx('tbx-model-option', m.id === agent.model && 'is-selected')}
                onClick={() => { ref.current?.querySelector('.tbx-model-button')?.focus(); agent.setModel(m.id); setOpen(false); }}>
                <span><strong>{m.name}</strong><small>{ready ? m.note : tx('暂不可用')}</small></span>
                {m.id === agent.model && <Glyph name="check" size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

/* The @ menu: questions, upcoming lessons and resources, searchable. */
function MentionMenu({ query, onPick, onClose, anchor }) {
  const [rows, setRows] = useState(null);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let live = true;
    const q = query.trim();
    (async () => {
      const [questions, lessons, resources] = await Promise.all([
        call('GET', `/api/modules/questions/v2/items${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => r.items).catch(() => []),
        loadLessons(true),
        call('GET', '/api/modules/resources/items').then((r) => r.items ?? r).catch(() => []),
      ]);
      const match = (s) => !q || String(s).toLowerCase().includes(q.toLowerCase());
      const out = [
        ...questions.slice(0, 5).map((x) => ({ kind: 'question', id: x.id, version: x.version, title: x.title || tx('未命名题目') })),
        ...lessons.filter((x) => match(x.title)).slice(0, 4).map((x) => ({ kind: 'entry', id: x.id, title: x.title, note: whenLabel(x) })),
        ...(Array.isArray(resources) ? resources : []).filter((x) => match(x.title)).slice(0, 4).map((x) => ({ kind: 'resource', id: x.id, title: x.title || tx('资料') })),
      ];
      if (live) { setRows(out); setActive(0); }
    })();
    return () => { live = false; };
  }, [query]);
  useEffect(() => {
    const key = (e) => {
      if (!rows?.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % rows.length); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + rows.length) % rows.length); }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); onPick(rows[active]); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [rows, active]);
  let lastKind = null;
  return (
    <Popover anchor={anchor} open onClose={onClose} className="tbx-agent-popover" role="listbox" label={tx('引用工作台里的内容')} offset={10}>
    <div className="tbx-mention" ref={ref}>
      {rows === null && <p className="tbx-mention-empty">{tx('正在找…')}</p>}
      {rows?.length === 0 && <p className="tbx-mention-empty">{query ? tx('没有找到“{{query}}”。', { query }) : tx('没有找到可以引用的内容。')}</p>}
      {rows?.map((r, i) => {
        const head = r.kind !== lastKind ? KIND[r.kind].label : null;
        lastKind = r.kind;
        return (
          <Fragment key={`${r.kind}:${r.id}`}>
            {head && <h4>{head}</h4>}
            <button type="button" role="option" aria-selected={i === active} className={cx('tbx-mention-row', i === active && 'is-active')} onMouseEnter={() => setActive(i)} onClick={() => onPick(r)}>
              <span className={cx('tbx-mention-icon', `is-${KIND[r.kind].hue}`)}><Glyph name={KIND[r.kind].glyph} size={14} /></span>
              <span className="tbx-mention-title">{r.title}</span>
              {r.note && <small>{r.note}</small>}
            </button>
          </Fragment>
        );
      })}
    </div>
    </Popover>
  );
}

function Composer({ agent, running, ready, variant, autoFocus, focusKey, context }) {
  const { draft } = agent;
  const area = useRef(null);
  const mentionAnchor = useRef(null);
  const [mention, setMention] = useState(null);
  const pendingCaret = useRef(null);
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !area.current) return;
    area.current.focus();
    area.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [draft?.text]);
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, variant === 'panel' ? 180 : 240)}px`;
  }, [draft?.text, variant]);
  useEffect(() => { if (autoFocus || focusKey) area.current?.focus(); }, [autoFocus, focusKey, Boolean(draft)]);
  if (!draft) return null;
  const refs = draft.references;
  const canSend = ready && !agent.busy && !agent.conflict && draft.text.trim();
  useRefTitles(refs);
  const suggest = context?.id && !refs.some((r) => r.kind === context.kind && r.id === context.id) ? context : null;

  function addRef(r) {
    const input = r.kind === 'question' ? { kind: r.kind, id: r.id, version: r.version } : { kind: r.kind, id: r.id };
    remember(r);
    agent.edit({ references: [...refs.filter((x) => !(x.kind === r.kind && x.id === r.id)), input] });
  }
  function pick(r) {
    if (r) addRef(r);
    const text = mention?.start === undefined ? draft.text : draft.text.slice(0, mention.start) + draft.text.slice(mention.end);
    pendingCaret.current = mention?.start ?? area.current?.selectionStart ?? draft.text.length;
    if (text !== draft.text) agent.edit({ text });
    setMention(null);
    area.current?.focus();
    if (text === draft.text && area.current) {
      area.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }

  return (
    <div className={cx('tbx-composer-shell', (refs.length || suggest) && 'has-drawer')}>
      <form className={cx('tbx-composer', running && 'is-running')} onSubmit={(e) => { e.preventDefault(); if (canSend && !running) sendReliably(); }}>
        {mention && <MentionMenu anchor={mentionAnchor} query={mention.query} onPick={pick} onClose={() => setMention(null)} />}
        <textarea
          ref={area}
          className="tbx-input"
          aria-label={ta('AI 输入')}
          placeholder={tx(variant === 'panel' ? '问一个问题，或输入 @ 引用题目、日程' : '描述你想准备的课、想讨论的题，输入 @ 引用工作台里的内容')}
          value={draft.text}
          rows={1}
          onChange={(e) => {
            const text = e.target.value;
            agent.edit({ text });
            const m = /@([^\s@]*)$/.exec(text.slice(0, e.target.selectionStart));
            setMention(m ? { query: m[1], start: m.index, end: e.target.selectionStart } : null);
          }}
          onKeyDown={(e) => {
            if (mention && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) return;
            if (e.key === 'Escape' && mention) { setMention(null); return; }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!running && canSend) sendReliably();
            }
          }}
        />
        <div className="tbx-composer-bar">
          <ModelPicker agent={agent} />
          <button ref={mentionAnchor} type="button" className="tbx-tool-btn" aria-label={tx('引用工作台里的内容')} title={tx('引用题目、日程或资料')} onClick={() => setMention(mention ? null : { query: '' })}>
            <Glyph name="at" size={17} />
          </button>
          {running ? (
            <button type="button" className="tbx-send is-stop" onClick={() => agent.stop(running)} aria-label={ta('停止')} title={tx('停止')}>
              <Glyph name="stop" size={13} stroke={0} />
            </button>
          ) : (
            <button type="submit" className="tbx-send" disabled={!canSend} aria-label={ta('发送')} title={tx('发送')}>
              <Glyph name="arrowUp" size={17} stroke={2.2} />
            </button>
          )}
        </div>
      </form>
      {(refs.length > 0 || suggest) && (
        <div className="tbx-drawer">
          {refs.map((r, i) => {
            const known = REF_TITLES.get(`${r.kind}:${r.id}`) ?? (context?.id === r.id ? context : null);
            return <RefChip key={`${r.kind}:${r.id}`} r={{ ...r, title: known?.title ?? KIND[r.kind]?.label ?? tx('引用'), note: known?.note }} onRemove={() => agent.edit({ references: refs.filter((_, j) => j !== i) })} />;
          })}
          {suggest && (
            <Fragment>
              {!refs.length && <span className="tbx-drawer-label">{tx('正在看')}</span>}
              <RefChip r={suggest} suggest onAdd={() => addRef(suggest)} />
            </Fragment>
          )}
        </div>
      )}
      {!ready && agent.configuration && <div className="tbx-composer-note">{ta('AI 暂不可用')}</div>}
      {agent.configuration?.activeTurn && agent.configuration.activeTurn.conversationId !== agent.id && (
        <button className="tbx-composer-note is-link" type="button" onClick={() => agent.select(agent.configuration.activeTurn.conversationId)}>
          {tx('另一段对话正在回答，去看看')}
        </button>
      )}
    </div>
  );
}

/* ---------- empty states ---------- */
function LessonPicker({ lessons, lesson, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(open, ref, () => setOpen(false));
  function choose(next) {
    ref.current?.querySelector('.tbx-inline-button')?.focus();
    onChange(next);
    setOpen(false);
  }
  return (
    <span className="tbx-inline-pick" ref={ref}>
      <button type="button" className="tbx-inline-button" onClick={() => setOpen(!open)} aria-expanded={open}>
        {lesson ? lesson.title : tx('哪节课')}
      </button>
      {open && (
        <div className="tbx-pick-menu" role="listbox">
          <h4>{tx('接下来的课')}</h4>
          {lessons.map((l) => (
            <button key={l.id} role="option" aria-selected={lesson?.id === l.id} className={cx('tbx-pick-row', lesson?.id === l.id && 'is-selected')} onClick={() => choose(l)}>
              <span className="tbx-pick-when tbx-num">{whenLabel(l)}</span>
              <span className="tbx-pick-title">{l.title}{l.todo[0] ? <small>{l.todo[0]}</small> : null}</span>
              {lesson?.id === l.id && <Glyph name="check" size={15} />}
            </button>
          ))}
          <button className={cx('tbx-pick-row is-plain', !lesson && 'is-selected')} onClick={() => choose(null)}>
            <span className="tbx-pick-title">{tx('不针对某节课')}</span>
            {!lesson && <Glyph name="check" size={15} />}
          </button>
        </div>
      )}
    </span>
  );
}

function lessonSuggestions(lesson) {
  const topic = `${lesson.title} ${lesson.todo.join(' ')}`;
  const func = /二次函数|抛物线|顶点/.test(topic);
  return [
    { icon: 'list', title: '梳理这节课的讲解顺序', prompt: '帮我梳理这节课的讲解顺序' },
    { icon: 'search', title: '找几道课堂练习题', prompt: '为这节课找 3 道课堂练习题' },
    func
      ? { icon: 'graph', title: '构思一个课堂演示', prompt: '为这节课构思一个抛物线演示' }
      : { icon: 'chat', title: '讨论一道题的不同讲法', prompt: '这节课的例题，有哪几种讲法？' },
    { icon: 'layers', title: '设计一组分层作业', prompt: '为这节课设计一组分层作业' },
  ];
}

function Hero({ lessons, lesson, setLesson }) {
  return (
    <div className="tbx-hero">
      <div className="tbx-welcome-mark" aria-hidden="true">
        <span className="tbx-dot is-yellow" /><span className="tbx-dot is-blue" /><span className="tbx-dot is-coral" />
      </div>
      {lessons.length ? (
        isEnglish()
          ? <h1>{greeting()}. {tx('What shall we prepare for')} <LessonPicker lessons={lessons} lesson={lesson} onChange={setLesson} /><span className="tbx-nowrap">?</span></h1>
          : <h1>{greeting()}，想为 <LessonPicker lessons={lessons} lesson={lesson} onChange={setLesson} /> <span className="tbx-nowrap">准备点什么？</span></h1>
      ) : (
        <h1>{isEnglish() ? `${greeting()}. ${tx('今天想准备什么？')}` : `${greeting()}，今天想准备什么？`}</h1>
      )}
      <p>{lesson ? `${whenLabel(lesson)} · ${lesson.todo.length ? lesson.todo.join(isEnglish() ? ', ' : '、') : tx('还没有写准备事项')}` : tx('备课思路、一道题的讲法、一个课堂演示，都可以从这里开始。')}</p>
    </div>
  );
}

function PanelWelcome({ context, onPrompt, busy }) {
  const list = context?.kind === 'question'
    ? [['chat', '这道题怎么讲'], ['search', '找几道相似的题'], ['layers', '出一道变式题']]
    : context?.area === 'calendar'
      ? [['calendar', '明天有什么课'], ['list', '帮我备下一节课'], ['layers', '为下一节课设计分层作业']]
      : context?.area === 'math'
        ? [['graph', '构思一个抛物线演示'], ['chat', '怎么讲二次函数的平移']]
        : [['list', '梳理一节课的讲解顺序'], ['search', '找几道压轴题'], ['calendar', '今天有什么安排']];
  return (
    <div className="tbx-panel-welcome">
      <h2>{tx('有什么可以帮你？')}</h2>
      <p>{context?.title ? tx('我能看到你正在看「{{title}}」。', { title: context.title }) : tx('问一个问题，或者从下面开始。')}</p>
      <div className="tbx-quick">
        {list.map(([icon, text], i) => (
          <button key={text} style={{ '--i': i }} disabled={busy} onClick={() => onPrompt(tx(text), context?.id && context.kind !== 'resource' ? context : null)}>
            <Glyph name={icon} size={15} />{tx(text)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Prototype convenience: every reload starts empty, so offer a full sample week. */
function DemoSeed({ onSeeded }) {
  const { navigate } = tb();
  const [state, setState] = useState(globalThis.__tbxSeeded ? 'done' : 'idle');
  async function run() {
    setState('running');
    try {
      await seedDemo();
      globalThis.__tbxSeeded = true;
      setState('done');
      onSeeded?.();
    } catch {
      setState('error');
    }
  }
  if (state === 'done') {
    return (
      <p className="tbx-demo is-done">
        <Glyph name="check" size={15} />{tx('示例数据已就绪：7 道题、4 份资料和一周的课表。')}
        <button onClick={() => navigate('/questions')}>{tx('去题库')}</button>
        <button onClick={() => navigate('/calendar')}>{tx('看日程')}</button>
      </p>
    );
  }
  return (
    <p className="tbx-demo">
      {tx('第一次来？')}
      <button onClick={run} disabled={state === 'running'}>{state === 'running' ? tx('正在载入…') : tx('载入一周的示例数据')}</button>
      {tx('，看看工作台装满时的样子。')}{state === 'error' ? tx('载入没有完成，请再试一次。') : ''}
    </p>
  );
}

function Suggestions({ items, busy, onPrompt }) {
  return (
    <div className="tbx-suggestions">
      {items.map((s, i) => (
        <button key={s.title} className="tbx-suggestion" style={{ '--i': i }} disabled={busy} onClick={() => onPrompt(tx(s.prompt))}>
          <span className="tbx-suggestion-icon"><Glyph name={s.icon} size={17} /></span>
          <span className="tbx-suggestion-title">{tx(s.title)}</span>
          <span className="tbx-suggestion-prompt">{tx(s.prompt)}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- panel header ---------- */
function PanelHead({ agent }) {
  const { navigate } = tb();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(open, ref, () => setOpen(false));
  const title = agent.snapshot?.messages?.length ? threadTitle(agent.snapshot.conversation.title) : tx('新对话');
  return (
    <header className="tbx-agent-head">
      <span className="tbx-switch" ref={ref}>
        <button className="tbx-switch-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
          <span>{title}</span><Glyph name="chevron" size={14} />
        </button>
        {open && (
          <div className="tbx-switch-menu" role="listbox">
            <h4>{tx('最近的对话')}</h4>
            {agent.list.length === 0 && <p className="tbx-mention-empty">{tx('还没有对话。')}</p>}
            {agent.list.slice(0, 8).map((item) => (
              <button key={item.id} role="option" aria-selected={item.id === agent.id} className={cx('tbx-switch-row', item.id === agent.id && 'is-selected')} onClick={() => { ref.current?.querySelector('.tbx-switch-button')?.focus(); agent.select(item.id); setOpen(false); }}>
                <span><strong>{threadTitle(item.title)}</strong><small>{item.preview || tx('还没有回答')}</small></span>
                <span className="tbx-thread-time">{relativeTime(item.updatedAt)}</span>
              </button>
            ))}
            {agent.list.length > 0 && <button className="tbx-switch-all" onClick={() => { setOpen(false); navigate('/'); }}>{tx('在首页查看全部对话')}<Glyph name="chevronRight" size={13} /></button>}
          </div>
        )}
      </span>
      <button className="tbx-icon-btn" title={tx('新对话')} aria-label={tx('新对话')} onClick={agent.create} disabled={agent.busy}><Glyph name="compose" size={17} /></button>
      <button className="tbx-icon-btn" title={tx('在首页打开')} aria-label={tx('在首页打开')} onClick={() => navigate('/')}><Glyph name="expand" size={16} /></button>
    </header>
  );
}

/* ---------- the workspace ---------- */
export function AgentWorkspace({ variant = 'panel' }) {
  useLocale();
  const { useAgent, agentLabels, isDeletedAccount } = tb();
  const agent = useAgent();
  latestAgent.current = agent;
  const thread = useRef(null);
  const dockRef = useRef(null);
  const nearBottom = useRef(true);
  const pending = useRef(null);
  const [newMessages, setNewMessages] = useState(false);
  const [focusComposer, setFocusComposer] = useState(0);
  const [dockH, setDockH] = useState(140);
  const [lessons, refreshLessons] = useLessons(agent.businessRevision);
  const [lesson, setLesson] = useState(null);
  const lessonReference = useRef(null);
  const context = useCurrentContext(variant === 'panel');
  const { snapshot, draft } = agent;

  useEffect(() => {
    const area = thread.current;
    if (!area) return;
    try { area.scrollTop = Number(globalThis.__teachbuddyLocalStorage.getItem(agent.prefix + agent.id + ':scroll') ?? area.scrollHeight); } catch {}
    nearBottom.current = area.scrollHeight - area.clientHeight - area.scrollTop < 160;
  }, [agent.id, Boolean(snapshot)]);
  const seenSeq = useRef({ id: null, seq: 0 });
  const autoScroll = useRef(false);
  // Only real growth of the conversation counts as “new”, not draft or title events.
  const lastMsg = snapshot?.messages?.[snapshot.messages.length - 1];
  const growth = `${snapshot?.messages?.length ?? 0}:${lastMsg?.text?.length ?? 0}:${lastMsg?.cards?.length ?? 0}:${snapshot?.toolCalls?.length ?? 0}`;
  useEffect(() => {
    if (!thread.current) return;
    const first = seenSeq.current.id !== agent.id;
    seenSeq.current = { id: agent.id, seq: snapshot?.lastEventSeq ?? 0 };
    if (first) return;
    if (nearBottom.current) {
      autoScroll.current = true;
      thread.current.scrollTop = thread.current.scrollHeight;
      setNewMessages(false);
    } else setNewMessages(true);
  }, [growth]);
  useEffect(() => {
    if (!agent.draft || pending.current === null) return;
    const { text, refs, lessonId } = pending.current;
    if (lessonId) lessonReference.current = { conversationId: agent.id, id: lessonId };
    pending.current = null;
    agent.edit({ text, ...(refs ? { references: refs } : {}) });
    setFocusComposer((n) => n + 1);
  }, [Boolean(agent.draft), agent.id]);
  useLayoutEffect(() => {
    const el = dockRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });

  const running = snapshot?.turns.find((x) => x.state === 'running');
  const ready = agent.configuration?.models.find((m) => m.id === agent.model)?.state === 'ready';
  const empty = !snapshot?.messages?.length;
  const modelName = (id) => MODELS.find((m) => m.id === id)?.name;

  const lessonRef = lesson ? { kind: 'entry', id: lesson.id } : null;
  if (lesson) remember({ kind: 'entry', id: lesson.id, title: lesson.title, note: whenLabel(lesson) });

  function prompt(text, ctx) {
    const refFrom = (c) => (c.kind === 'question' ? { kind: 'question', id: c.id, version: c.version } : { kind: c.kind, id: c.id });
    if (ctx) remember(ctx);
    const extra = ctx ? refFrom(ctx) : lessonRef;
    if (agent.draft) {
      const refs = agent.draft.references.filter((r) => !(extra && r.kind === extra.kind && r.id === extra.id));
      agent.edit({ text, references: extra ? [...refs, extra] : refs });
      setFocusComposer((n) => n + 1);
    } else {
      pending.current = { text, refs: extra ? [extra] : null, lessonId: !ctx ? lessonRef?.id : null };
      void agent.create();
    }
  }
  function regenerate(turn) {
    const user = snapshot.messages.find((m) => m.id === turn.userMessageId);
    if (!user) return;
    agent.edit({ text: user.text, references: user.references.map((r) => r.input) });
    setTimeout(sendReliably, 0);
  }
  // Only references introduced by this picker belong to its cancel/replace action.
  useEffect(() => {
    if (!agent.draft || !empty) { lessonReference.current = null; return; }
    const owned = lessonReference.current?.conversationId === agent.id ? lessonReference.current : null;
    const refs = agent.draft.references;
    let next = owned && owned.id !== lesson?.id ? refs.filter(r => !(r.kind === 'entry' && r.id === owned.id)) : refs;
    if (owned?.id !== lesson?.id) lessonReference.current = null;
    if (lesson && !next.some(r => r.kind === 'entry' && r.id === lesson.id)) {
      next = [...next, lessonRef];
      lessonReference.current = { conversationId: agent.id, id: lesson.id };
    }
    if (next !== refs) agent.edit({ references: next });
  }, [lesson?.id, Boolean(agent.draft), agent.id]);

  const lastTurn = snapshot?.turns[snapshot.turns.length - 1];
  const dock = (
    <div className="tbx-dock" ref={dockRef}>
      {agent.sendPending && (
        <div className="tbx-notice">{ta('发送结果待确认')}<button className="tbx-btn is-small" onClick={agent.send} disabled={agent.busy}>{ta('确认发送结果')}</button></div>
      )}
      {agent.error && (
        <div className="tbx-notice is-error" role="alert">{agent.error}<button className="tbx-btn is-small" onClick={() => (draft?.dirty ? agent.save() : agent.retry())}>{ta('重试')}</button></div>
      )}
      {agent.conflict && (
        <div className="tbx-notice is-conflict">
          <strong>{ta('草稿已在其他设备修改')}</strong>
          <p>{ta('本机：')}{draft.text}</p>
          <p>{ta('已保存：')}{agent.conflict.text}</p>
          <div>
            <button className="tbx-btn is-small" onClick={() => agent.chooseDraft(true)}>{ta('保留本机内容')}</button>
            <button className="tbx-btn is-small" onClick={() => agent.chooseDraft(false)}>{ta('采用已保存内容')}</button>
          </div>
        </div>
      )}
      {draft ? (
        <Composer agent={agent} running={running} ready={ready} variant={variant} autoFocus={variant === 'home'} focusKey={focusComposer} context={context} />
      ) : (
        <div className="tbx-composer-shell">
          <button className="tbx-composer is-placeholder" onClick={() => { setFocusComposer((n) => n + 1); pending.current = lessonRef ? { text: '', refs: [lessonRef], lessonId: lessonRef.id } : null; void agent.create(); }} disabled={agent.busy}>
            <span className="tbx-input-placeholder">{tx(variant === 'panel' ? '问一个问题，或输入 @ 引用题目、日程' : '描述你想准备的课、想讨论的题，输入 @ 引用工作台里的内容')}</span>
            <span className="tbx-composer-bar"><span /><span className="tbx-send" aria-hidden="true"><Glyph name="arrowUp" size={17} stroke={2.2} /></span></span>
          </button>
        </div>
      )}
    </div>
  );

  const heroSuggestions = lesson ? lessonSuggestions(lesson) : SUGGESTIONS;

  return (
    <section className={cx('tbx-agent', empty && 'is-empty')} data-region="ai-workspace" data-variant={variant} style={{ '--dock-h': `${dockH}px` }}>
      {variant === 'panel' && <PanelHead agent={agent} />}

      {empty && variant === 'home' ? (
        <div className="tbx-empty-stage">
          <Hero lessons={lessons} lesson={lesson} setLesson={setLesson} />
          {dock}
          <Suggestions items={heroSuggestions} busy={agent.busy} onPrompt={(text) => prompt(text)} />
          <DemoSeed onSeeded={refreshLessons} />
        </div>
      ) : (
        <Fragment>
          <div
            className="tbx-thread-area"
            ref={thread}
            aria-label={ta('AI 对话')}
            onScroll={() => {
              const area = thread.current;
              // Our own pinning to the bottom is not the teacher scrolling away.
              if (autoScroll.current) { autoScroll.current = false; nearBottom.current = true; return; }
              nearBottom.current = area.scrollHeight - area.clientHeight - area.scrollTop < 160;
              if (nearBottom.current) setNewMessages(false);
              try { if (!isDeletedAccount(agent.accountKey)) globalThis.__teachbuddyLocalStorage.setItem(agent.prefix + agent.id + ':scroll', String(area.scrollTop)); } catch {}
            }}
          >
            <div className="tbx-thread-inner">
              {empty && <PanelWelcome context={context} busy={agent.busy} onPrompt={prompt} />}
              {snapshot?.turns.map((turn) => {
                const assistant = snapshot.messages.filter((m) => m.turnId === turn.id && m.role === 'assistant');
                const calls = snapshot.toolCalls.filter((c) => c.turnId === turn.id).sort((a, b) => a.ordinal - b.ordinal);
                const answered = assistant.some((m) => m.text);
                const working = turn.state === 'running' && !answered && !calls.some((c) => c.state === 'executing');
                return (
                  <section className="tbx-turn" key={turn.id}>
                    {snapshot.messages.filter((m) => m.turnId === turn.id && m.role === 'user').map((m) => <UserMessage key={m.id} m={m} />)}
                    <WorkLog calls={calls} turn={turn} answered={answered} />
                    {working && (
                      <div className="tbx-working"><Shimmer>{calls.length ? tx('正在整理') : tx('正在思考')}</Shimmer><span className="tbx-working-time">· <Elapsed from={turn.createdAt} /></span></div>
                    )}
                    {assistant.filter((m) => m.text || m.state !== 'streaming').map((m) => (
                      <AssistantMessage key={m.id} m={m} agent={agent} model={modelName(turn.modelId)} last={turn === lastTurn && !running} onRegenerate={() => regenerate(turn)} />
                    ))}
                    {turn.state !== 'running' && turn.state !== 'completed' && (
                      <Divider tone="muted">{agentLabels.reasons[turn.reason] ? tx(agentLabels.reasons[turn.reason]) : tx('已停止')}</Divider>
                    )}
                  </section>
                );
              })}
            </div>
          </div>

          {newMessages && (
            <button className="tbx-new-messages" onClick={() => {
              thread.current.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' });
              nearBottom.current = true;
              setNewMessages(false);
            }}><Glyph name="arrowDown" size={14} stroke={2.2} />{tx('新消息')}</button>
          )}
          {dock}
        </Fragment>
      )}
    </section>
  );
}

/* ---------- the home page ---------- */
export function Home({ returnPath }) {
  useLocale();
  const { useAgent, navigate } = tb();
  const agent = useAgent();
  const [threadsOpen, setThreadsOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        void agent.create();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [agent.create]);
  const hasMessages = Boolean(agent.snapshot?.messages?.length);
  return (
    <div className={cx('tbx-home', threadsOpen && 'is-threads-open')}>
      <ThreadList onPick={() => setThreadsOpen(false)} />
      <div className="tbx-home-main">
        <div className="tbx-home-bar">
          <button className="tbx-icon-btn tbx-threads-toggle" onClick={() => setThreadsOpen(!threadsOpen)} aria-label={tx('对话列表')}>
            <Glyph name="list" size={17} />
          </button>
          <span className="tbx-home-title">{hasMessages ? threadTitle(agent.snapshot.conversation.title) : ''}</span>
          {returnPath && (
            <button className="tbx-btn is-ghost is-small" onClick={() => navigate(returnPath)}>
              <Glyph name="back" size={14} />{tx('返回工作')}
            </button>
          )}
        </div>
        <AgentWorkspace variant="home" />
      </div>
    </div>
  );
}
