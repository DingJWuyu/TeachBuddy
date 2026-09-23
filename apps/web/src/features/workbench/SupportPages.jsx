import { useEffect, useRef, useState } from 'react';
import { followAnchor, navigate, useRoute } from './routes.js';
import { useScene } from './useScene.js';
import { useScrollRestore } from './useScrollRestore.js';
import { useWorkbenchShell } from './shellContext.js';
import { Icon } from './chrome/icons.jsx';
import { Presence } from './chrome/Presence.jsx';
import { helpTopics } from './helpContent.js';
import './support-shell.css';

const topicPath = topic => `/help/${topic.id}`;
const articlePath = (topic, article) => `${topicPath(topic)}/${article.id}`;
function HelpLink({ href, children, onNavigate, ...props }) {
  return <a {...props} href={href} onClick={event => followAnchor(event, href, { onNavigate })}>{children}</a>;
}

function HelpSearch({ query, setQuery, onClose }) {
  const dialog = useRef(null);
  const input = useRef(null);
  const [selected, setSelected] = useState(0);
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.length ? helpTopics.flatMap(topic => topic.articles
    .filter(article => terms.every(term => `${topic.label} ${article.title} ${article.body}`.toLocaleLowerCase().includes(term)))
    .map(article => ({ topic, article }))) : [];
  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    node.showModal();
    input.current.focus();
    return () => { node.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    dialog.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  // Presence keeps a closing dialog mounted. Reversing its inert exit must
  // restore keyboard focus once the surface becomes interactive again.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const node = dialog.current;
      if (node?.dataset.presence === 'entered' && !node.contains(document.activeElement)) input.current.focus();
    });
    return () => cancelAnimationFrame(frame);
  });
  const open = item => { if (item) { navigate(articlePath(item.topic, item.article)); onClose(); } };
  return <dialog className="help-search-dialog" ref={dialog} aria-label="搜索帮助文档"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <div className="help-search-input"><Icon name="search" /><input ref={input} role="combobox" aria-label="搜索帮助文档" aria-autocomplete="list" aria-expanded="true" aria-controls="help-results" aria-activedescendant={matches[selected] ? `help-result-${selected}` : undefined}
      placeholder="搜索文章…" value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setSelected(index => matches.length ? (index + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length : 0); }
        if (event.key === 'Enter') { event.preventDefault(); open(matches[selected]); }
      }} /><button type="button" aria-label="关闭搜索" onClick={onClose}><Icon name="close" size={16} /></button></div>
    <div id="help-results" className="help-results" role="listbox" aria-label="搜索结果">
      {matches.map(({ topic, article }, index) => <div key={articlePath(topic, article)} role="option" id={`help-result-${index}`} aria-selected={index === selected}
        onPointerMove={() => setSelected(index)} onClick={() => open({ topic, article })}>
        <div><strong>{article.title}</strong><span>{topic.label}</span></div><p>{article.body}</p>
      </div>)}
    </div>
    {!matches.length && <p className="help-search-empty" role="status">{terms.length ? '未找到相关文章，试试其他关键词。' : '输入关键词，搜索帮助文档。'}</p>}
  </dialog>;
}

function HelpBody({ topic, article, invalid, scene, patch, openSearch }) {
  const key = article ? articlePath(topic, article) : topic ? topicPath(topic) : '/help';
  const scroll = useScrollRestore(scene.positions[key] || 0, top => patch(current => ({ positions: { ...current.positions, [key]: top } })), key);
  const next = article && topic.articles[topic.articles.indexOf(article) + 1];
  return <div className="help-body" {...scroll}><div className="help-content">
    {invalid ? <><h1>未找到这篇文章</h1><HelpLink href="/help">返回帮助首页</HelpLink></> : !topic ? <>
      <header className="help-hero"><h1>有什么可以帮您？</h1><form className="help-home-search" onSubmit={event => { event.preventDefault(); openSearch(); }}>
        <Icon name="search" size={22} /><input aria-label="搜索文章" placeholder="搜索文章…" value={scene.query} onChange={event => patch({ query: event.target.value })} /><button type="submit" aria-label="搜索"><kbd>Enter</kbd></button>
      </form></header>
      <section className="help-popular"><h2>热门主题</h2><div className="help-topic-grid">{helpTopics.map(item => <HelpLink key={item.id} href={topicPath(item)} className="help-topic-card">
        <span className="help-topic-icon"><Icon name={item.icon} size={24} /></span><div><h3>{item.label}</h3><p>{item.description}</p></div>
      </HelpLink>)}</div></section>
    </> : <>
      <nav className="help-breadcrumb" aria-label="文章位置"><HelpLink href="/help">帮助</HelpLink><Icon name="arrowRight" size={12} />{article ? <><HelpLink href={topicPath(topic)}>{topic.label}</HelpLink><Icon name="arrowRight" size={12} /><span>{article.title}</span></> : <span>{topic.label}</span>}</nav>
      <h1>{article?.title || topic.label}</h1>
      <div className="help-summary"><span className="help-topic-icon"><Icon name={topic.icon} size={28} /></span><div><h4>{article ? '本文内容' : '本章内容'}</h4><p>{topic.description}</p></div></div>
      {article ? <article className="help-article"><p>{article.body}</p><HelpLink className="help-action" href={topic.destination}>{topic.action}<Icon name="arrowRight" size={16} /></HelpLink>
        {next && <HelpLink className="help-next" href={articlePath(topic, next)}><small>下一篇</small><h2>{next.title}</h2><p>{next.body}</p><span>继续阅读 <Icon name="arrowRight" size={16} /></span></HelpLink>}
      </article> : <section className="help-chapter"><h2>文章</h2>{topic.articles.map(item => <HelpLink key={item.id} className="help-article-card" href={articlePath(topic, item)}><h3>{item.title}</h3><p>{item.body}</p><Icon name="arrowRight" size={18} /></HelpLink>)}</section>}
    </>}
    {!invalid && <footer className="help-footer"><Icon name="circleHelp" size={25} /><div><h2>还有疑问？</h2><p><HelpLink href="/help/recovery">查看常见问题</HelpLink>，了解保存与资料恢复。</p></div></footer>}
  </div></div>;
}

export function SupportHelp() {
  const shell = useWorkbenchShell();
  const route = useRoute();
  const [scene, patch] = useScene(shell.accountKey, 'help', { query: '', expanded: {}, positions: {}, searchOpen: false, mobileOpen: false });
  const topic = helpTopics.find(item => item.id === route.topicId);
  const article = topic?.articles.find(item => item.id === route.articleId);
  useEffect(() => {
    if (route.topicId) patch(current => ({ expanded: { ...current.expanded, [route.topicId]: true } }));
    patch({ mobileOpen: false });
  }, [route.path, route.topicId, patch]);
  useEffect(() => {
    const shortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); event.stopImmediatePropagation(); patch(current => ({ searchOpen: !current.searchOpen }));
      }
    };
    window.addEventListener('keydown', shortcut, true);
    return () => window.removeEventListener('keydown', shortcut, true);
  }, [patch]);
  const openSearch = () => patch({ searchOpen: true });
  return <div className="help-center" data-region="help">
    <button className="help-mobile-toggle" aria-expanded={scene.mobileOpen} aria-controls="help-directory" onClick={() => patch({ mobileOpen: !scene.mobileOpen })}><Icon name="menu" size={18} />帮助目录<Icon name="chevron" size={16} /></button>
    <aside className="help-directory" id="help-directory" data-open={scene.mobileOpen}>
      <nav aria-label="帮助目录"><button className="help-directory-search" onClick={openSearch}><Icon name="search" size={16} />搜索…<kbd>{navigator.platform.includes('Mac') ? '⌘ K' : 'Ctrl K'}</kbd></button>
        <HelpLink className="help-directory-home" href="/help" aria-current={!topic && !route.topicId ? 'page' : undefined}>参考文档</HelpLink>
        {helpTopics.map(item => <div className="help-directory-group" key={item.id}>
          <button aria-expanded={Boolean(scene.expanded[item.id])} aria-controls={`help-group-${item.id}`} onClick={() => patch(current => ({ expanded: { ...current.expanded, [item.id]: !current.expanded[item.id] } }))}><Icon name="arrowRight" size={14} /><span>{item.label}</span></button>
          <div className="help-directory-fold" data-open={Boolean(scene.expanded[item.id])} inert={!scene.expanded[item.id]} id={`help-group-${item.id}`}><div>{item.articles.map(entry => <HelpLink key={entry.id} href={articlePath(item, entry)} aria-current={topic === item && article === entry ? 'page' : undefined}>{entry.title}</HelpLink>)}<HelpLink href={topicPath(item)} aria-current={topic === item && !article ? 'page' : undefined}>查看全部</HelpLink></div></div>
        </div>)}
      </nav>
    </aside>
    <HelpBody key={route.path} topic={topic} article={article} invalid={Boolean(route.topicId && !topic || route.articleId && !article)} scene={scene} patch={patch} openSearch={openSearch} />
    <Presence show={scene.searchOpen}><HelpSearch query={scene.query} setQuery={query => patch({ query })} onClose={() => patch({ searchOpen: false })} /></Presence>
  </div>;
}

export function SupportReleases() {
  return <div className="support-releases-placeholder" data-region="releases" role="img" aria-label="更新日志占位"><Icon name="newspaper" size={44} strokeWidth={1.4} /></div>;
}
