
import { Icon } from './icons.jsx';

/**
 * The body of a destination that has no design yet. It carries the page title
 * without feature content, on the same 48px content inset the home page uses, so
 * moving between pages does not shift the shell's alignment.
 */
export function EmptyPage({ title, icon }) {
  return (
    <main className="tb-main tb-main-empty">
      <div className="tb-empty-page">
        <span className="tb-empty-page-mark" aria-hidden="true"><Icon name={icon} size={22} /></span>
        <h1>{title}</h1>
      </div>
    </main>
  );
}

/** The body for a path the shell has no destination for. */
export function UnknownPage({ path }) {
  return (
    <main className="tb-main tb-main-empty">
      <div className="tb-empty-page">
        <span className="tb-empty-page-mark" aria-hidden="true"><Icon name="inbox" size={22} /></span>
        <h1>页面不存在</h1>
        <p>工作台里没有 <code>{path}</code> 这个地址。</p>
      </div>
    </main>
  );
}
