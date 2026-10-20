import { Fragment, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { ConfirmMenuItem } from '../../components/ui/confirm.jsx';
import { Icon } from '../../components/icons.jsx';
import { cx } from '../../components/ui/classNames.js';
import { tx, useLocale, isEnglish, monthDay } from '../../i18n/presentation.js';
import { workbenchGet, workbenchPost } from '../../platform/http/apiClient.js';
import { isDeletedAccount, readLocal } from '../../platform/device/storage.js';
import { navigate } from '../workbench/routes.js';
import { usePresentationAgent as useAgent } from './AgentPresentation.jsx';
import { Prose, Inline } from './Prose.jsx';
import { whenLabel } from './demoScript.js';
import { ToolCard } from './ToolCard.jsx';
import { useAuth } from '../auth/index.jsx';
import { seedSampleWeek } from '../workbench/demo/seed.js';
import './agent.css';
/*
 * The teaching assistant, shared by the home page and the side panel.
 *
 * The answer is plain reading text with no bubble
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
export function Glyph({ name, size = 18, stroke = 1.75 }) { return <Icon name={name} size={size} strokeWidth={stroke} className="tbx-glyph" />; }

/* ---------- small helpers ---------- */
const uuid = () => crypto.randomUUID();
const call = async (method, path, body) => (method === 'GET' ? await workbenchGet(path) : await workbenchPost(path, body, uuid())).body;
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
  const read = () => window.location.pathname ?? '/';
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
    const key = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open]);
}

/* Upcoming lessons, read once per mount from the schedule. */
async function loadLessons(read = path => call('GET', path)) {
  try {
    const { items } = await read('/api/modules/schedule/entries');
    const today = new Date();
    const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = `${key(today)} ${today.toTimeString().slice(0, 5)}`;
    return items
      .filter((e) => e.time?.date && /数学|课/.test(e.title) && `${e.time.date} ${e.time.startTime}` >= now)
      .map((e) => ({ id: e.id, title: e.title, date: e.time.date, start: e.time.startTime, todo: (e.items ?? []).map((i) => i.text) }))
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
      .slice(0, 6);
  } catch {
    return [];
  }
}
function useLessons(revision, agent) {
  const [lessons, setLessons] = useState([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    loadLessons(agent.read).then((l) => live && setLessons(l));
    const again = () => setTick((n) => n + 1);
    window.addEventListener('tb:navigate', again);
    window.addEventListener('focus', again);
    return () => { live = false; window.removeEventListener('tb:navigate', again); window.removeEventListener('focus', again); };
  }, [revision, tick, agent.accountKey, agent.isDemo]);
  return [lessons, () => setTick((n) => n + 1)];
}

/* Display titles for references in the draft (the draft itself stores ids). */
function useRefTitles(refs, agent) {
  const [titles, setTitles] = useState({});
  useEffect(() => {
    let live = true; setTitles({});
    for (const r of refs) {
      const where = r.kind === 'question' ? '/api/modules/questions/v2/items/' : r.kind === 'entry' ? '/api/modules/schedule/entries/' : '/api/modules/resources/items/';
      agent.read(where + encodeURIComponent(r.id)).then(o => { if (live) setTitles(previous => ({ ...previous, [`${r.kind}:${r.id}`]: { title: o.title || KIND[r.kind]?.label } })); }).catch(() => {});
    }
    return () => { live = false; };
  }, [agent.accountKey, agent.isDemo, refs.map(r => `${r.kind}:${r.id}:${r.version}`).join(',')]);
  return titles;
}

/* What the teacher is looking at right now, offered as context. */
function selectedQuestionId(accountKey) {
  const scene = readLocal(accountKey, 'questions-materials-scene');
  return scene?.kind === 'question' && scene.id ? scene.id : null;
}
function useCurrentContext(enabled, accountKey) {
  const path = useRoute();
  const [ctx, setCtx] = useState(null);
  const [picked, setPicked] = useState(null);
  useEffect(() => {
    if (!enabled || !path.startsWith('/questions')) { setPicked(null); return undefined; }
    const read = () => setPicked(selectedQuestionId(accountKey));
    read();
    const id = setInterval(read, 700);
    return () => clearInterval(id);
  }, [path, enabled, accountKey]);
  useEffect(() => {
    if (!enabled) { setCtx(null); return undefined; }
    let live = true;
    const m = /^\/(questions|resources)\/([^/]+)$/.exec(path);
    const target = m ? { kind: m[1] === 'questions' ? 'question' : 'resource', id: decodeURIComponent(m[2]), area: m[1] }
      : picked ? { kind: 'question', id: picked, area: 'questions' } : null;
    (async () => {
      if (target) {
        const where = target.kind === 'question' ? '/api/modules/questions/v2/items/' : '/api/modules/resources/items/';
        try {
          const cached = await call('GET', where + encodeURIComponent(target.id));

          if (live) setCtx({ ...target, version: cached.version, title: cached.title || KIND[target.kind].label });
        } catch { if (live) setCtx({ area: target.area }); }
      } else if (path.startsWith('/calendar')) {
        const [next] = await loadLessons();
        if (live) setCtx(next ? { kind: 'entry', id: next.id, title: next.title, note: whenLabel(next), area: 'calendar' } : { area: 'calendar' });
      } else if (live) setCtx({ area: path.split('/')[1] || 'home' });
    })();
    return () => { live = false; };
  }, [path, enabled, picked]);
  return ctx;
}

/* ---------- conversations: rename, pin, delete ---------- */


function ThreadMenu({ item, agent, onRename, onClose }) {
  const ref = useRef(null);
  useOutside(true, ref, onClose);
  return (
    <div className="tbx-menu is-thread" ref={ref} role="menu" onClick={(e) => e.stopPropagation()}>
      <button role="menuitem" onClick={async () => { onClose(); await agent.patchThread(item.id, { pinned: !item.pinned }); await agent.retry(); }}>
        <Glyph name="pin" size={16} />{item.pinned ? tx('取消置顶') : tx('置顶')}
      </button>
      <button role="menuitem" onClick={() => { onClose(); onRename(); }}><Glyph name="pencil" size={16} />{tx('重命名')}</button>
      <ConfirmMenuItem
        icon={<Glyph name="trash" size={16} />}
        label={tx('删除')}
        onConfirm={async () => {
          onClose();
          try {
            await agent.deleteThread(item.id);
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
    if (title && title !== item.title) { await agent.patchThread(item.id, { title }); await agent.retry(); }
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
                ><Glyph name="more" size={15} /></button>
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
function useCardAction(agent, cardKey) {
  const storageKey = agent.prefix + 'card-action:' + cardKey;
  const record = useRef(null);
  if (!record.current) {
    try { record.current = JSON.parse(localStorage.getItem(storageKey)); } catch { /* A new card starts without an action. */ }
    record.current ??= { state: 'idle', requests: {} };
  }
  const [state, setState] = useState(record.current.state);
  function persist(next) {
    if (isDeletedAccount(agent.accountKey)) throw new Error('Account unavailable');
    localStorage.setItem(storageKey, JSON.stringify(next));
    record.current = next;
  }
  async function write(slot, path, body) {
    let pending = record.current.requests[slot];
    if (!pending) {
      pending = { key: uuid(), path, body };
      persist({ ...record.current, requests: { ...record.current.requests, [slot]: pending } });
    }
    return (await workbenchPost(pending.path, pending.body, pending.key)).body;
  }
  async function run(task) {
    if (state === 'busy' || state === 'done') return;
    setState('busy');
    try { await task(write); persist({ ...record.current, state: 'done' }); setState('done'); }
    catch { setState('error'); }
  }
  return [state, run];
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
  return (
    <div className="tbx-card-rows">
      {items.map((q, i) => (
        <div className="tbx-card-row" key={q.id} style={{ '--i': i }}>
          <button className="tbx-card-row-main" onClick={() => navigate(`/questions/${q.id}`)}>
            <span className="tbx-card-row-title">{q.title}</span>
            {q.excerpt && <span className="tbx-card-row-text"><Inline text={q.excerpt} /></span>}
          </button>
          <span className="tbx-card-row-tags">{(q.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</span>
          <button className="tbx-row-act" title={tx('引用到对话')} aria-label={tx('引用到对话')} onClick={() => agent.isDemo ? agent.edit({ references: [...agent.draft.references.filter(r => r.id !== q.id), { kind: 'question', id: q.id, version: q.version ?? 1 }] }) : agent.addReference?.('question', q.id)}><Glyph name="quote" size={15} /></button>
        </div>
      ))}
    </div>
  );
}
function ResultCard({ card, cardKey, agent }) {
  const [state, run] = useCardAction(agent, cardKey);
  const [expanded, setExpanded] = useState(false);

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
          <ActionButton state={state} idle={tx('加到日程')} doneLabel={tx('已加到待安排')} doneTo="/calendar" onRun={() => run(write => write('plan', '/api/modules/schedule/entries', {
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
          <ActionButton state={state} idle={card.kind === 'variant' ? tx('存进题库') : tx('存进题库 · {{n}} 道', { n: items.length })} doneLabel={tx('已存进题库')} doneTo="/questions" onRun={() => run(async write => {
            for (const [index, q] of items.entries()) {
              await write(`question:${index}`, '/api/modules/questions/v2/items', { title: q.title, body: toDoc(q.body), solution: toDoc(q.solution), answerStatus: 'present', note: '', starred: false, source: { kind: 'manual' }, typeId: q.typeId ?? null, tagIds: q.tagIds ?? [] });
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
  const agent = useAgent();
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

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className={cx('tbx-meta-btn', copied && 'is-done')} aria-label={tx('复制')} title={copied ? tx('已复制') : tx('复制')} onClick={() => {
      navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }}>
      <span className="tbx-morph"><Glyph name="copy" size={15} /><Glyph name="check" size={15} stroke={2.2} /></span>
    </button>
  );
}

function AssistantMessage({ m, agent, last, onRegenerate, model }) {
  const streaming = m.state === 'streaming' || (m.state === 'partial' && agent.snapshot?.turns.some(t => t.id === m.turnId && t.state === 'running'));
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
          <CopyButton text={m.text} />
          {last && onRegenerate && (
            <button className="tbx-meta-btn" aria-label={tx('重新回答')} title={tx('重新回答')} onClick={onRegenerate}><Glyph name="retry" size={15} /></button>
          )}
          <span className="tbx-meta-text tbx-num">{clock(m.createdAt)}{model ? ` · ${model}` : ''}</span>
        </div>
      )}
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
                onClick={() => { agent.setModel(m.id); setOpen(false); }}>
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
function MentionMenu({ query, onPick, onClose, agent }) {
  const [rows, setRows] = useState(null);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  useOutside(true, ref, onClose);
  useEffect(() => {
    let live = true;
    const q = query.trim();
    (async () => {
      const [questions, lessons, resources] = await Promise.all([
        agent.read(`/api/modules/questions/v2/items${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => r.items).catch(() => []),
        loadLessons(agent.read),
        agent.read('/api/modules/resources/items').then((r) => r.items ?? r).catch(() => []),
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
    <div className="tbx-mention" ref={ref} role="listbox" aria-label={tx('引用工作台里的内容')}>
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
  );
}

function Composer({ agent, running, ready, variant, autoFocus, focusKey, context }) {
  const { draft } = agent;
  const area = useRef(null);
  const [mention, setMention] = useState(null);
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, variant === 'panel' ? 180 : 240)}px`;
  }, [draft?.text, variant]);
  useEffect(() => { if (autoFocus || focusKey) area.current?.focus(); }, [autoFocus, focusKey, Boolean(draft)]);
  const refs = draft?.references ?? [];
  const canSend = ready && !agent.busy && !agent.conflict && draft?.text.trim();
  const refTitles = useRefTitles(refs, agent);
  if (!draft) return null;
  const suggest = context?.id && !refs.some((r) => r.kind === context.kind && r.id === context.id) ? context : null;

  function addRef(r) {
    const input = r.kind === 'question' ? { kind: r.kind, id: r.id, version: r.version } : { kind: r.kind, id: r.id };
    if (r.kind !== 'question' && !agent.isDemo) { agent.startDemo(draft.text, [...refs.filter(x => !(x.kind === input.kind && x.id === input.id)), input]); return; }
    agent.edit({ references: [...refs.filter((x) => !(x.kind === r.kind && x.id === r.id)), input] });
  }
  function pick(r) {
    const text = draft.text.replace(/@([^\s@]*)$/, '');
    if (r && r.kind !== 'question' && !agent.isDemo) {
      void agent.startDemo(text, [...refs.filter(x => !(x.kind === r.kind && x.id === r.id)), { kind: r.kind, id: r.id }]);
    } else {
      if (r) addRef(r);
      if (text !== draft.text) agent.edit({ text });
    }
    setMention(null);
    area.current?.focus();
  }

  return (
    <div className={cx('tbx-composer-shell', (refs.length || suggest) && 'has-drawer')}>
      <form className={cx('tbx-composer', running && 'is-running')} onSubmit={(e) => { e.preventDefault(); if (canSend && !running) void agent.send(); }}>
        {mention && <MentionMenu agent={agent} query={mention.query} onPick={pick} onClose={() => setMention(null)} />}
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
            setMention(m ? { query: m[1] } : null);
          }}
          onKeyDown={(e) => {
            if (mention && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) return;
            if (e.key === 'Escape' && mention) { setMention(null); return; }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!running && canSend) void agent.send();
            }
          }}
        />
        <div className="tbx-composer-bar">
          <ModelPicker agent={agent} />
          <button type="button" className="tbx-tool-btn" aria-label={tx('引用工作台里的内容')} title={tx('引用题目、日程或资料')} onClick={() => setMention(mention ? null : { query: '' })}>
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
      {!agent.isDemo && <span className="tbx-composer-hint" role="status">{agent.status}</span>}
      </form>
      {(refs.length > 0 || suggest) && (
        <div className="tbx-drawer">
          {refs.map((r, i) => {
            const known = refTitles[`${r.kind}:${r.id}`] ?? (context?.id === r.id ? context : null);
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
  return (
    <span className="tbx-inline-pick" ref={ref}>
      <button type="button" className="tbx-inline-button" onClick={() => setOpen(!open)} aria-expanded={open}>
        {lesson ? lesson.title : tx('哪节课')}
      </button>
      {open && (
        <div className="tbx-pick-menu" role="listbox">
          <h4>{tx('接下来的课')}</h4>
          {lessons.map((l) => (
            <button key={l.id} role="option" aria-selected={lesson?.id === l.id} className={cx('tbx-pick-row', lesson?.id === l.id && 'is-selected')} onClick={() => { onChange(l); setOpen(false); }}>
              <span className="tbx-pick-when tbx-num">{whenLabel(l)}</span>
              <span className="tbx-pick-title">{l.title}{l.todo[0] ? <small>{l.todo[0]}</small> : null}</span>
              {lesson?.id === l.id && <Glyph name="check" size={15} />}
            </button>
          ))}
          <button className={cx('tbx-pick-row is-plain', !lesson && 'is-selected')} onClick={() => { onChange(null); setOpen(false); }}>
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
  const agent = useAgent();
  const { request: transport } = useAuth();
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const seededKey = agent.prefix + 'sample-seeded';
  const [state, setState] = useState(() => { try { return localStorage.getItem(seededKey) === 'true' ? 'done' : 'idle'; } catch { return 'idle'; } });
  async function run() {
    setState('running');
    try {
      controller.current = new AbortController();
      await seedSampleWeek({ accountKey: agent.accountKey, transport, signal: controller.current.signal });
      if (!isDeletedAccount(agent.accountKey)) localStorage.setItem(seededKey, 'true');
      setState('done'); onSeeded?.();
    } catch { setState('error'); }
  }
  if (state === 'done') return <p className="tbx-demo is-done"><Glyph name="check" size={15} />{tx('示例数据已就绪：7 道题、4 份资料和一周的课表。')}<button onClick={() => navigate('/questions')}>{tx('去题库')}</button><button onClick={() => navigate('/calendar')}>{tx('看日程')}</button></p>;
  return <p className="tbx-demo">{tx('第一次来？')}<button onClick={run} disabled={state === 'running'}>{state === 'running' ? tx('正在载入…') : tx('载入一周的示例数据')}</button>{tx('，看看工作台装满时的样子。')}{state === 'error' ? tx('载入没有完成，请再试一次。') : ''}</p>;
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
              <button key={item.id} role="option" aria-selected={item.id === agent.id} className={cx('tbx-switch-row', item.id === agent.id && 'is-selected')} onClick={() => { agent.select(item.id); setOpen(false); }}>
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
  const agent = useAgent();
  const thread = useRef(null);
  const dockRef = useRef(null);
  const nearBottom = useRef(true);
  const pending = useRef(null);
  const [newMessages, setNewMessages] = useState(false);
  const [focusComposer, setFocusComposer] = useState(0);
  const [dockH, setDockH] = useState(140);
  const [lessons, refreshLessons] = useLessons(agent.businessRevision, agent);
  const [lesson, setLesson] = useState(null);
  const context = useCurrentContext(variant === 'panel', agent.accountKey);
  const { snapshot, draft } = agent;

  useEffect(() => {
    const area = thread.current;
    if (!area) return;
    try { area.scrollTop = Number(localStorage.getItem(agent.prefix + agent.id + ':scroll') ?? area.scrollHeight); } catch {}
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
    const { text, refs } = pending.current;
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

  const lessonRef = lesson && agent.isDemo ? { kind: 'entry', id: lesson.id } : null;

  function prompt(text, ctx) {
    const refFrom = (c) => (c.kind === 'question' ? { kind: 'question', id: c.id, version: c.version } : { kind: c.kind, id: c.id });
    const extra = ctx ? refFrom(ctx) : lessonRef;
    if (extra && extra.kind !== 'question' && !agent.isDemo) { agent.startDemo(text, [...(agent.draft?.references ?? []).filter(r => !(r.kind === extra.kind && r.id === extra.id)), extra]); return; }
    if (agent.draft) {
      const refs = agent.draft.references.filter((r) => !(extra && r.kind === extra.kind && r.id === extra.id));
      agent.edit({ text, references: extra ? [...refs, extra] : refs });
      setFocusComposer((n) => n + 1);
    } else {
      pending.current = { text, refs: extra ? [extra] : null };
      void agent.create();
    }
  }
  function regenerate(turn) {
    const user = snapshot.messages.find((m) => m.id === turn.userMessageId);
    if (!user) return;
    agent.edit({ text: user.text, references: user.references.map((r) => r.input) });
    setTimeout(() => void agent.send(), 0);
  }
  // A lesson picked on the home page rides along with the first message.
  useEffect(() => {
    if (!lesson || !agent.isDemo || !agent.draft || !empty) return;
    if (agent.draft.references.some((r) => r.kind === 'entry' && r.id === lesson.id)) return;
    agent.edit({ references: [...agent.draft.references.filter((r) => r.kind !== 'entry'), lessonRef] });
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
          <button className="tbx-composer is-placeholder" onClick={() => { setFocusComposer((n) => n + 1); pending.current = lessonRef ? { text: '', refs: [lessonRef] } : null; void agent.create(); }} disabled={agent.busy}>
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
          <Hero lessons={lessons} lesson={lesson} setLesson={next => { setLesson(next); if (next && !agent.isDemo) void agent.startDemo(agent.draft?.text ?? '', [...(agent.draft?.references ?? []).filter(r => r.kind !== 'entry'), { kind: 'entry', id: next.id }]); }} />
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
              try { if (!isDeletedAccount(agent.accountKey)) localStorage.setItem(agent.prefix + agent.id + ':scroll', String(area.scrollTop)); } catch {}
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
                    {!agent.isDemo && calls.map(call => <ToolCard key={call.toolCallId} call={call} calls={snapshot.toolCalls} reconcile={agent.reconcile} />)}
                    {working && (
                      <div className="tbx-working"><Shimmer>{calls.length ? tx('正在整理') : tx('正在思考')}</Shimmer><span className="tbx-working-time">· <Elapsed from={turn.createdAt} /></span></div>
                    )}
                    {assistant.filter((m) => m.text || m.state !== 'streaming').map((m) => (
                      <AssistantMessage key={m.id} m={m} agent={agent} model={modelName(turn.modelId)} last={turn === lastTurn && !running} onRegenerate={() => regenerate(turn)} />
                    ))}
                    {!agent.isDemo && turn.usage && <details className="tbx-turn-usage"><summary>{tx('用量')}</summary><p>{turn.usage.totalTokens ?? tx('未知')} tokens · {tx(turn.usage.complete ? '用量已报告' : '用量不完整')} · {tx('实际费用未知')}</p></details>}
                    {turn.state !== 'running' && turn.state !== 'completed' && (
                      <Divider tone="muted">{tx(({ 'server-restart': '上次生成已中断', 'user-stop': '已停止', 'provider-error': '模型连接失败', 'tool-unconfirmed': '请确认写入结果', 'provider-quota': '模型调用被拒绝', 'model-unavailable': 'AI 暂不可用', 'context-limit': '这段对话过长，请新建对话并重新选择引用' })[turn.reason] ?? '操作未完成，请查看结果')}</Divider>
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
