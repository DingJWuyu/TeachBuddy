import { Fragment } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cx } from '../../../components/ui/classNames.js';
import { tx, useLocale, isEnglish } from '../../../i18n/presentation.js';
import { Icon2 } from '../../../components/icons.jsx';
import { followAnchor, navigate, useRoute } from '../routes.js';
import { useScene } from '../../../platform/device/useScene.js';
import { useWorkbenchShell } from '../shellContext.js';
import * as ZH from './content.zh.js';
import * as EN from './content.en.js';
import { Figure, FigureThumb } from './Figure.jsx';

/*
 * Help center. Keeps the two-column frame (a directory on the left, the page
 * on the right) and replaces everything inside it:
 *   /help                  home: search, start here, topics, common questions
 *   /help/:topic           a topic: its articles as one quiet list
 *   /help/:topic/:article  an article: reading column, “on this page”, a small pager
 * Articles live in content.zh.js / content.en.js (same ids and blocks).
 */

const content = () => (isEnglish() ? EN : ZH);
const topicPath = (t) => `/help/${t.id}`;
const articlePath = (t, a) => `/help/${t.id}/${a.id}`;
const FIGURE_FOR = { start: 'home', questions: 'question', schedule: 'board', assistant: 'assistant', math: 'math', resources: 'resources', account: 'shell' };

const Icon = ({ name, size = 18, stroke = 1.8 }) => {
  return <Icon2 name={name} size={size} strokeWidth={stroke} />;
};

function Link({ to, className, children, onNavigate, ...rest }) {
  return (
    <a {...rest} href={to} className={className} onClick={(e) => { followAnchor(e, to); onNavigate?.(); }}>
      {children}
    </a>
  );
}

const Tile = ({ topic, size = 'm' }) => (
  <span className={cx('tbx-help-tile', `is-${topic.hue}`, `is-${size}`)} aria-hidden="true">
    <Icon name={topic.icon} size={size === 's' ? 13 : size === 'l' ? 28 : 19} stroke={size === 's' ? 2.1 : 1.9} />
  </span>
);

/* **bold** for interface names, `key` for keys and code */
function Inline({ text, mark }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('**')) return <strong key={i}>{highlight(p.slice(2, -2), mark)}</strong>;
    if (p.startsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
    return <Fragment key={i}>{highlight(p, mark)}</Fragment>;
  });
}

function highlight(text, terms) {
  if (!terms?.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return String(text).split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

const plain = (s) => String(s).replace(/\*\*|`/g, '');
const blockText = (b) => (Array.isArray(b[1]) ? b[1].map((x) => (Array.isArray(x) ? x.join(' ') : x)).join(' ') : `${b[1] ?? ''} ${b[2] ?? ''}`);

/* ---------- article body ---------- */

function Blocks({ blocks }) {
  let h2 = 0;
  return blocks.map((b, i) => {
    switch (b[0]) {
      case 'p': return <p key={i}><Inline text={b[1]} /></p>;
      case 'h2': return <h2 key={i} id={`s${h2++}`}>{b[1]}</h2>;
      case 'list': return <ul key={i}>{b[1].map((x) => <li key={x}><Inline text={x} /></li>)}</ul>;
      case 'steps': return (
        <ol key={i} className="tbx-help-steps">
          {b[1].map((x, n) => <li key={x}><span className="tbx-num">{n + 1}</span><div><Inline text={x} /></div></li>)}
        </ol>
      );
      case 'tip':
      case 'note': return (
        <aside key={i} className={cx('tbx-help-callout', `is-${b[0]}`)}>
          <span className="tbx-help-callout-icon"><Icon name={b[0] === 'tip' ? 'sparkles' : 'info'} size={16} stroke={2} /></span>
          <div><strong>{b[0] === 'tip' ? tx('小技巧') : tx('请注意')}</strong><p><Inline text={b[1]} /></p></div>
        </aside>
      );
      case 'keys': return (
        <dl key={i} className="tbx-help-keys">
          {b[1].map(([k, d]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>)}
        </dl>
      );
      case 'figure': return <Figure key={i} kind={b[1]} caption={b[2]} />;
      default: return null;
    }
  });
}

function Helpful({ id }) {
  const [vote, setVote] = useState(null);
  useEffect(() => setVote(null), [id]);
  return (
    <div className="tbx-help-helpful" role="group" aria-label={tx('这篇文章有帮助吗？')}>
      {vote
        ? <span className="tbx-help-helpful-thanks"><Icon name="check" size={15} stroke={2.2} />{vote === 'yes' ? tx('谢谢，很高兴帮到你。') : tx('谢谢，我们会把它写得更清楚。')}</span>
        : (
          <>
            <span>{tx('这篇文章有帮助吗？')}</span>
            <button type="button" onClick={() => setVote('yes')}>{tx('有帮助')}</button>
            <button type="button" onClick={() => setVote('no')}>{tx('没帮助')}</button>
          </>
        )}
    </div>
  );
}

function Article({ topic, article, scroller }) {
  const all = content().TOPICS.flatMap((t) => t.articles.map((a) => ({ t, a })));
  const index = all.findIndex((x) => x.t === topic && x.a === article);
  const prev = all[index - 1];
  const next = all[index + 1];
  const heads = article.blocks.filter((b) => b[0] === 'h2').map((b) => b[1]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const root = scroller.current;
    if (!root || heads.length < 2) return undefined;
    const spy = () => {
      const line = root.getBoundingClientRect().top + 120;
      let current = 0;
      root.querySelectorAll('.tbx-help-prose h2').forEach((el, i) => { if (el.getBoundingClientRect().top <= line) current = i; });
      setActive(current);
    };
    root.addEventListener('scroll', spy, { passive: true });
    return () => root.removeEventListener('scroll', spy);
  }, [article]);
  const jump = (i) => {
    const root = scroller.current;
    const el = root?.querySelector(`#s${i}`);
    if (el) root.scrollTo({ top: el.offsetTop - 28, behavior: 'smooth' });
  };
  return (
    <div className={cx('tbx-help-article', `is-${topic.hue}`, heads.length > 1 && 'has-toc')}>
      <article className="tbx-help-prose">
        <Link to={topicPath(topic)} className={cx('tbx-help-eyebrow', `is-${topic.hue}`)}><Tile topic={topic} size="s" />{topic.title}</Link>
        <h1>{article.title}</h1>
        <p className="tbx-help-lead">{article.summary}</p>
        <p className="tbx-help-meta">{tx('{{n}} 分钟阅读', { n: article.minutes })}<span aria-hidden="true">·</span>{tx('2026 年 10 月更新')}</p>
        <Blocks blocks={article.blocks} />
        <Helpful id={article.id} />
        <nav className="tbx-help-pager" aria-label={tx('上一篇和下一篇')}>
          {prev ? <Link to={articlePath(prev.t, prev.a)} className="is-prev"><small>{tx('上一篇')}</small><span>{prev.a.title}</span></Link> : <span />}
          {next ? <Link to={articlePath(next.t, next.a)} className="is-next"><small>{tx('下一篇')}</small><span>{next.a.title}</span></Link> : <span />}
        </nav>
      </article>
      {heads.length > 1 && (
        <aside className="tbx-help-toc" aria-label={tx('本页内容')}>
          <h4>{tx('本页内容')}</h4>
          {heads.map((title, i) => (
            <button key={title} type="button" className={cx(active === i && 'is-active')} onClick={() => jump(i)}>{title}</button>
          ))}
        </aside>
      )}
    </div>
  );
}

/* ---------- topic ---------- */

function Topic({ topic }) {
  const minutes = topic.articles.reduce((s, a) => s + a.minutes, 0);
  const others = content().TOPICS.filter((t) => t !== topic);
  return (
    <div className="tbx-help-topic">
      <header className={cx('tbx-help-topic-head', `is-${topic.hue}`)}>
        <Tile topic={topic} size="l" />
        <h1>{topic.title}</h1>
        <p>{topic.blurb}</p>
        <span className="tbx-help-meta">{tx('{{n}} 篇文章', { n: topic.articles.length })}<span aria-hidden="true">·</span>{tx('约 {{n}} 分钟读完', { n: minutes })}</span>
      </header>
      <ol className="tbx-help-rows">
        {topic.articles.map((a, i) => (
          <li key={a.id}>
            <Link to={articlePath(topic, a)} className="tbx-help-row" style={{ '--i': i }}>
              <span className="tbx-help-row-num tbx-num">{i + 1}</span>
              <span className="tbx-help-row-copy"><strong>{a.title}</strong><small>{a.summary}</small></span>
              <span className="tbx-help-row-meta">{tx('{{n}} 分钟', { n: a.minutes })}</span>
              <Icon name="chevron" size={16} />
            </Link>
          </li>
        ))}
      </ol>
      <section className="tbx-help-more">
        <h2>{tx('其他主题')}</h2>
        <div>
          {others.map((t) => <Link key={t.id} to={topicPath(t)} className="tbx-help-chip"><Tile topic={t} size="s" />{t.title}</Link>)}
        </div>
      </section>
    </div>
  );
}

/* ---------- home ---------- */

function Home({ openSearch }) {
  const { TOPICS, HOME } = content();
  const find = ([tid, aid]) => {
    const t = TOPICS.find((x) => x.id === tid);
    return { t, a: t?.articles.find((x) => x.id === aid) };
  };
  return (
    <div className="tbx-help-home">
      <header className="tbx-help-hero">
        <span className="tbx-help-hero-eyebrow">{tx('TeachBuddy 帮助')}</span>
        <h1>{tx('有什么可以帮你？', { context: 'help' })}</h1>
        <button type="button" className="tbx-help-hero-search" onClick={() => openSearch('')}>
          <Icon name="search" size={19} stroke={2} />
          <span>{tx('搜索帮助文章')}</span>
          <kbd>{navigator.platform.includes('Mac') ? '⌘ K' : 'Ctrl K'}</kbd>
        </button>
        <div className="tbx-help-suggest">
          <span>{tx('大家常搜')}</span>
          {HOME.searches.map((q) => <button key={q} type="button" onClick={() => openSearch(q)}>{q}</button>)}
        </div>
      </header>

      <section className="tbx-help-section">
        <h2>{tx('从这里开始')}</h2>
        <div className="tbx-help-featured">
          {HOME.featured.map(find).filter((x) => x.a).map(({ t, a }, i) => (
            <Link key={a.id} to={articlePath(t, a)} className={cx('tbx-help-feature', `is-${t.hue}`)} style={{ '--i': i }}>
              <span className="tbx-help-feature-art"><FigureThumb kind={a.blocks.find((b) => b[0] === 'figure')?.[1] ?? FIGURE_FOR[t.id]} /></span>
              <span className="tbx-help-feature-copy">
                <small className={cx('tbx-help-eyebrow', `is-${t.hue}`)}>{t.title}</small>
                <strong>{a.title}</strong>
                <span>{a.summary}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="tbx-help-section">
        <h2>{tx('按主题浏览')}</h2>
        <div className="tbx-help-topics">
          {TOPICS.map((t, i) => (
            <Link key={t.id} to={topicPath(t)} className="tbx-help-topic-card" style={{ '--i': i }}>
              <Tile topic={t} />
              <strong>{t.title}</strong>
              <span>{t.blurb}</span>
              <small>{tx('{{n}} 篇文章', { n: t.articles.length })}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="tbx-help-section">
        <h2>{tx('常见问题')}</h2>
        <ul className="tbx-help-rows is-compact">
          {HOME.popular.map(find).filter((x) => x.a).map(({ t, a }) => (
            <li key={`${t.id}/${a.id}`}>
              <Link to={articlePath(t, a)} className="tbx-help-row">
                <Tile topic={t} size="s" />
                <span className="tbx-help-row-copy"><strong>{a.title}</strong></span>
                <span className="tbx-help-row-meta">{t.title}</span>
                <Icon name="chevron" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- search ---------- */

function useIndex() {
  return useMemo(() => content().TOPICS.flatMap((t) => t.articles.map((a) => ({
    t, a,
    title: a.title.toLowerCase(),
    summary: a.summary.toLowerCase(),
    body: a.blocks.map((b) => plain(blockText(b))).join(' '),
  }))), [isEnglish()]);
}

function snippet(body, terms) {
  const lower = body.toLowerCase();
  const at = Math.min(...terms.map((t) => { const i = lower.indexOf(t); return i < 0 ? Infinity : i; }));
  if (!Number.isFinite(at)) return '';
  const start = Math.max(0, at - 24);
  return `${start > 0 ? '…' : ''}${body.slice(start, start + 96)}${start + 96 < body.length ? '…' : ''}`;
}

function Search({ initial, onClose }) {
  const { TOPICS, HOME } = content();
  const dialog = useRef(null);
  const input = useRef(null);
  const [query, setQuery] = useState(initial);
  const [active, setActive] = useState(0);
  const index = useIndex();
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    if (!terms.length) return HOME.popular.map(([tid, aid]) => index.find((x) => x.t.id === tid && x.a.id === aid)).filter(Boolean).map((x) => ({ ...x, snip: '' }));
    return index
      .map((x) => {
        const hay = `${x.title} ${x.summary} ${x.body.toLowerCase()} ${x.t.title.toLowerCase()}`;
        if (!terms.every((term) => hay.includes(term))) return null;
        const score = terms.reduce((s, term) => s + (x.title.includes(term) ? 6 : 0) + (x.summary.includes(term) ? 3 : 0) + 1, 0);
        const inTitle = terms.every((term) => x.title.includes(term));
        return { ...x, score, snip: inTitle ? x.a.summary : snippet(x.body, terms) || x.a.summary };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }, [query, index]);

  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    input.current.focus();
    input.current.setSelectionRange(initial.length, initial.length);
    return () => node.close();
  }, []);
  useEffect(() => setActive(0), [query]);
  useEffect(() => { dialog.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const open = (r) => { if (!r) return; navigate(articlePath(r.t, r.a)); onClose(); };
  const groups = [];
  results.forEach((r, i) => {
    const g = terms.length ? groups.find((x) => x.t === r.t) : groups[0];
    if (g) g.items.push({ r, i });
    else groups.push({ t: terms.length ? r.t : null, items: [{ r, i }] });
  });

  return (
    <dialog
      ref={dialog}
      className="tbx-help-search"
      aria-label={tx('搜索帮助文章')}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialog.current) onClose(); }}
    >
      <div className="tbx-hs-panel">
        <div className="tbx-hs-field">
          <Icon name="search" size={20} stroke={2} />
          <input
            ref={input}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="tbx-hs-results"
            aria-activedescendant={results[active] ? `tbx-hs-${active}` : undefined}
            placeholder={tx('搜索帮助文章')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const n = results.length;
                if (n) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
              }
              if (e.key === 'Enter') { e.preventDefault(); open(results[active]); }
            }}
          />
          {query && <button type="button" className="tbx-hs-clear" aria-label={tx('清除')} onClick={() => { setQuery(''); input.current.focus(); }}><Icon name="close" size={12} stroke={2.6} /></button>}
          <button type="button" className="tbx-hs-esc" onClick={onClose}>{tx('取消')}</button>
        </div>
        <div className="tbx-hs-body" id="tbx-hs-results" role="listbox">
          {results.length === 0 ? (
            <div className="tbx-hs-empty">
              <span className="tbx-hs-empty-icon"><Icon name="search" size={22} stroke={1.8} /></span>
              <strong>{tx('没有找到“{{q}}”', { q: query.trim() })}</strong>
              <p>{tx('换个说法试试，或者从主题开始找。')}</p>
              <div>{TOPICS.map((t) => <button key={t.id} type="button" className="tbx-help-chip" onClick={() => { navigate(topicPath(t)); onClose(); }}><Tile topic={t} size="s" />{t.title}</button>)}</div>
            </div>
          ) : groups.map((g) => (
            <section key={g.t?.id ?? 'popular'} className="tbx-hs-group">
              <h3>{g.t ? g.t.title : tx('常见问题')}</h3>
              {g.items.map(({ r, i }) => (
                <div
                  key={`${r.t.id}/${r.a.id}`}
                  id={`tbx-hs-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={cx('tbx-hs-item', i === active && 'is-active')}
                  onPointerMove={() => setActive(i)}
                  onClick={() => open(r)}
                >
                  <Tile topic={r.t} size="s" />
                  <span className="tbx-hs-copy">
                    <strong>{highlight(r.a.title, terms)}</strong>
                    {(r.snip || !terms.length) && <small>{highlight(r.snip || r.a.summary, terms)}</small>}
                  </span>
                  <span className="tbx-hs-enter" aria-hidden="true"><Icon name="chevron" size={15} /></span>
                </div>
              ))}
            </section>
          ))}
        </div>
        <footer className="tbx-hs-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd>{tx('选择')}</span>
          <span><kbd>↵</kbd>{tx('打开')}</span>
          <span><kbd>esc</kbd>{tx('关闭')}</span>
        </footer>
      </div>
    </dialog>
  );
}

/* ---------- directory ---------- */

function Directory({ topic, article, expanded, toggle, openSearch, onNavigate }) {
  const { TOPICS } = content();
  return (
    <nav className="tbx-help-dir-inner" aria-label={tx('帮助目录')}>
      <button type="button" className="tbx-help-dir-search" onClick={() => openSearch('')}>
        <Icon name="search" size={15} stroke={2} />
        <span>{tx('搜索')}</span>
        <kbd>{navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <Link to="/help" className="tbx-help-dir-home" aria-current={!topic ? 'page' : undefined} onNavigate={onNavigate}>
        <span className="tbx-help-dir-home-icon"><Icon name="home" size={15} stroke={2} /></span>{tx('帮助首页')}
      </Link>
      <h4>{tx('主题')}</h4>
      {TOPICS.map((t) => {
        const open = Boolean(expanded[t.id]);
        return (
          <div key={t.id} className={cx('tbx-help-dir-group', open && 'is-open', topic === t && 'is-current')}>
            <button type="button" className="tbx-help-dir-topic" aria-expanded={open} onClick={() => toggle(t.id)}>
              <Tile topic={t} size="s" />
              <span>{t.title}</span>
              <span className="tbx-help-dir-chevron"><Icon name="chevron" size={13} stroke={2.2} /></span>
            </button>
            <div className="tbx-help-dir-fold" inert={!open}>
              <div>
                <Link to={topicPath(t)} aria-current={topic === t && !article ? 'page' : undefined} onNavigate={onNavigate}>{tx('概览')}</Link>
                {t.articles.map((a) => (
                  <Link key={a.id} to={articlePath(t, a)} aria-current={topic === t && article === a ? 'page' : undefined} onNavigate={onNavigate}>{a.title}</Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/* ---------- the page ---------- */

export function HelpCenter() {
  useLocale();
  const route = useRoute();
  const shell = useWorkbenchShell();
  const [scene, patch] = useScene(shell.accountKey, 'help', { query: '', expanded: {}, positions: {}, searchOpen: false, mobileOpen: false });
  const [search, setSearch] = useState(null);
  const scroller = useRef(null);
  const { TOPICS } = content();
  const topic = TOPICS.find((t) => t.id === route.topicId);
  const article = topic?.articles.find((a) => a.id === route.articleId);
  const invalid = Boolean((route.topicId && !topic) || (route.articleId && !article));
  const expanded = { ...scene.expanded, ...(topic && scene.expanded[topic.id] === undefined ? { [topic.id]: true } : {}) };

  // moving to another topic opens it in the directory and folds the rest
  useEffect(() => {
    if (topic) patch({ expanded: { [topic.id]: true } });
  }, [topic?.id]);

  // each page remembers where you were
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = scene.positions?.[route.path] || 0;
    patch({ mobileOpen: false });
  }, [route.path]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    let t = 0;
    const save = () => { clearTimeout(t); t = setTimeout(() => patch((c) => ({ positions: { ...c.positions, [route.path]: el.scrollTop } })), 150); };
    el.addEventListener('scroll', save, { passive: true });
    return () => { clearTimeout(t); el.removeEventListener('scroll', save); };
  }, [route.path]);

  // ⌘K searches help while you're here
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSearch((s) => (s === null ? '' : null));
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);

  const toggle = (id) => patch((c) => ({ expanded: { ...c.expanded, [id]: !(c.expanded[id] ?? (topic?.id === id)) } }));

  return (
    <div className="tbx-help" data-region="help">
      <button type="button" className="tbx-help-mobile" aria-expanded={Boolean(scene.mobileOpen)} onClick={() => patch({ mobileOpen: !scene.mobileOpen })}>
        <Icon name="menu" size={17} />{topic ? topic.title : tx('帮助首页')}<Icon name="chevron" size={14} />
      </button>
      <aside className="tbx-help-dir" data-open={Boolean(scene.mobileOpen)}>
        <Directory topic={topic} article={article} expanded={expanded} toggle={toggle} openSearch={setSearch} onNavigate={() => patch({ mobileOpen: false })} />
      </aside>
      <main className="tbx-help-main" ref={scroller}>
        <div className="tbx-help-page" key={route.path}>
          {invalid ? (
            <div className="tbx-help-missing">
              <span className="tbx-hs-empty-icon"><Icon name="search" size={22} /></span>
              <h1>{tx('没有找到这篇文章')}</h1>
              <p>{tx('它可能换了位置。试试搜索，或者回到帮助首页。')}</p>
              <div>
                <button type="button" className="tbx-help-btn is-primary" onClick={() => setSearch('')}>{tx('搜索帮助')}</button>
                <Link to="/help" className="tbx-help-btn">{tx('帮助首页')}</Link>
              </div>
            </div>
          ) : article ? <Article topic={topic} article={article} scroller={scroller} />
            : topic ? <Topic topic={topic} />
              : <Home openSearch={setSearch} />}
        </div>
      </main>
      {search !== null && <Search initial={search} onClose={() => setSearch(null)} />}
    </div>
  );
}
