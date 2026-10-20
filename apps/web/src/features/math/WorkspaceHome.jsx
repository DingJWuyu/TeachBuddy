import i18n from '../../i18n/index.js';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ShellContext, useAuxiliaryAssistant } from '../workbench/shellContext.js';
import { MathWebAssistant } from './web-ai/MathWebAssistant.jsx';
import { Icon } from '../../components/icons.jsx';
import { cx } from '../../components/ui/classNames.js';
import { tx, useLocale, monthDay } from '../../i18n/presentation.js';
import { Rail, RailSection, RailItem, RailHint, PaneTitle, PrimaryButton } from '../../components/ui/rail.jsx';
import { Segmented } from '../../components/ui/segmented.jsx';
const t = (key, options) => i18n.t(key, { ns: 'math', ...options });
const MathMark = ({ size = 20 }) => <Icon name="math" size={size} strokeWidth={2} />;

export function mathStatusLabel(status) {
  const labels = {
    '已保存': t('已保存'), '未保存': t('未保存'), '保存结果待确认': t('保存结果待确认'),
    '保存中': t('保存中'), '保存失败': t('保存失败'),
  };
  return labels[status] ?? status;
}

export function WorkIllustration({ kind }) {
  return <svg className="math-work-illustration" viewBox="0 0 220 100" fill="none" aria-hidden="true">
    {kind === 'formula' ? <g fill="currentColor" fontFamily="serif" textAnchor="middle">
      <text x="48" y="58" fontSize="23">x =</text><text x="139" y="38" fontSize="22">−b ± √(b²−4ac)</text>
      <path d="M76 48H204" stroke="currentColor"/><text x="139" y="74" fontSize="22">2a</text>
    </g> : kind === 'space' ? <g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="m67 29 57-18 36 25v48l-57 8-36-24zM67 29l36 24 57-17M103 53v39"/>
      <path d="M124 11v48l-57 9M124 59l36 25" strokeDasharray="4 4" opacity=".45"/>
    </g> : <g stroke="currentColor" strokeWidth="1.6">
      <path d="M32 72h158M101 88V10" opacity=".22"/>
      <path d="M48 16Q101 128 154 16"/>
      {kind === 'dynamic' && <><path d="M80 16Q133 92 186 16" strokeDasharray="4 4" opacity=".4"/>
        <path d="M65 91h98" strokeWidth="3" opacity=".25"/><circle cx="128" cy="91" r="5" fill="currentColor"/></>}
    </g>}
  </svg>;
}

const viewKey = accountKey => `teachbuddy.${accountKey}.math.view`;

const readView = (VIEW_KEY) => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } };
const saveView = (VIEW_KEY, v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } };

/* what a work is, in one word */
function kindOf(item) {
  const s = item.source || {};
  if (s.kind === 'html') return 'html';
  if (s.kind === 'workshop') return s.graph ? 'graph' : 'formula';
  if (s.kind === 'formula') return 'formula';
  if (s.kind === 'space') return 'space';
  if (s.kind === 'dynamic') return 'dynamic';
  return 'graph';
}
const KIND_LABEL = { formula: '公式', graph: '图形', space: '立体图形', dynamic: '动态演示', html: '网页演示' };
const FILTERS = [
  ['all', '全部作品', 'grid'],
  ['made', '公式与图形', 'math'],
  ['html', '网页演示', 'file'],
];
const matches = (filter, item) => filter === 'all' || (filter === 'html' ? kindOf(item) === 'html' : kindOf(item) !== 'html');

/* ideas handed to the assistant, each with the drawing that suggests it */
const IDEAS = [
  ['graph', '画一条可调节的抛物线', 'is-blue'],
  ['space', '演示正方体的展开', 'is-orange'],
  ['formula', '推导一元二次方程的求根公式', 'is-green'],
];

const Illustration = ({ kind }) => <WorkIllustration kind={kind === 'html' ? 'dynamic' : kind} />;

/* formulas typeset live, so they stay sharp at any size */
function Formulas({ list }) {
  return (
    <span className="tbx-mw-formulas" aria-hidden="true">
      {list.slice(0, 2).map((f) => (
        <Markdown key={f.id} remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]} skipHtml>
          {`$$\n${f.latex}\n$$`}
        </Markdown>
      ))}
    </span>
  );
}

function Poster({ item, client, mini }) {
  const [url, setUrl] = useState(null);
  const kind = kindOf(item);
  const formulas = item.source?.kind === 'workshop' && !item.source.graph ? item.source.formulas : item.source?.kind === 'formula' && item.source.latex ? [{ id: 'f', latex: item.source.latex }] : null;
  const id = formulas?.length ? null : item.render?.posterFileId;
  useEffect(() => {
    let live = true;
    let objectUrl;
    setUrl(null);
    if (id && client) {
      client.blob(`/api/workbench/files/${id}/content`).then((blob) => {
        if (!live) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }).catch(() => {});
    }
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, client]);
  if (mini) {
    return (
      <span className={cx('tbx-mw-thumb is-mini', `is-${kind}`)} aria-hidden="true">
        {kind === 'html' ? <Icon name="file" size={18} strokeWidth={1.9} /> : kind === 'formula' ? <MathMark size={18} /> : <Icon name="graph" size={18} strokeWidth={1.9} />}
      </span>
    );
  }
  return (
    <span className={cx('tbx-mw-thumb', `is-${kind}`)}>
      {formulas?.length
        ? <Formulas list={formulas} />
        : url
        ? <img src={url} alt="" onError={() => setUrl(null)} />
        : kind === 'html'
          ? (
            <span className="tbx-mw-window" aria-hidden="true">
              <i /><i /><i />
              <Illustration kind="dynamic" />
            </span>
          )
          : <span className="tbx-mw-art" aria-hidden="true"><Illustration kind={kind} /></span>}
      <span className="tbx-mw-badge">{tx(KIND_LABEL[kind])}</span>
    </span>
  );
}

export default function WorkspaceHome(props) {
  useLocale();
  const shell = useContext(ShellContext);
  const { items, search, deleted, busy, client, accountKey, onSearch, onDeleted, onNew, onOpen, onImport, onImportSource, onRestore, onPurge } = props;
  const [view, setView] = useState(() => readView(viewKey(accountKey)));
  const [filter, setFilter] = useState('all');
  const known = useRef({ all: 0, made: 0, html: 0 });

  // the side panel's assistant starts a new work from a request, as before
  const actions = useRef({ onNew, busy });
  actions.current = { onNew, busy };
  useAuxiliaryAssistant(useCallback(
    () => (<MathWebAssistant key={accountKey} accountKey={accountKey} onStart={(request) => { if (!actions.current.busy) return actions.current.onNew(request); return undefined; }} />),
    [accountKey],
  ));

  if (!deleted && !search) {
    known.current = {
      all: items.length,
      made: items.filter((i) => matches('made', i)).length,
      html: items.filter((i) => matches('html', i)).length,
    };
  }
  const shown = deleted ? items : items.filter((i) => matches(filter, i));
  const title = deleted ? tx('已归档') : tx(FILTERS.find(([k]) => k === filter)[1]);
  const starting = !deleted && !search && filter === 'all';
  const go = (next) => { setFilter(next); if (deleted) onDeleted(false); };
  const pickView = (v) => { setView(v); saveView(viewKey(accountKey), v); };
  const date = (iso) => (iso ? monthDay(new Date(iso).toLocaleDateString('sv')) : '');

  return (
    <section className="tbx-mw tbx-split">
      {/* ---------- works ---------- */}
      <div className="tbx-mw-main" aria-busy={busy}>
        <header className="tbx-mw-bar">
          <PaneTitle
            icon={<MathMark size={21} />}
            tone="purple"
            id="math-start-heading"
            title={title}
            sub={tx('{{n}} 个作品', { n: shown.length, count: shown.length })}
          />
          <div className="tbx-mw-tools">
            <label className="tbx-mw-search">
              <Icon name="search" size={16} strokeWidth={2} />
              <input aria-label={tx('搜索作品')} placeholder={tx('搜索作品')} maxLength={200} value={search} onChange={(e) => onSearch(e.target.value)} />
              {search && <button type="button" className="tbx-mw-clear" aria-label={tx('清除搜索')} onClick={() => onSearch('')}><Icon name="close" size={11} strokeWidth={2.8} /></button>}
            </label>
            <Segmented
              iconOnly
              label={tx('作品显示方式')}
              value={view}
              onChange={pickView}
              options={[
                { value: 'grid', label: tx('缩略图视图'), icon: <Icon name="grid" size={15} strokeWidth={2} /> },
                { value: 'list', label: tx('列表视图'), icon: <Icon name="list" size={16} strokeWidth={2} /> },
              ]}
            />
            {!deleted && <PrimaryButton label={tx('新建作品')} disabled={busy} onClick={() => onNew()} />}
          </div>
        </header>

        <div className={cx('tbx-mw-scroll', `is-${view}`)}>
          {starting && (
            <section className="tbx-mw-start" aria-label={tx('开始制作')}>
              {IDEAS.map(([kind, prompt, hue]) => (
                <button key={prompt} type="button" className={cx('tbx-mw-idea', hue)} disabled={busy} onClick={() => onNew(tx(prompt))}>
                  <span className="tbx-mw-idea-art"><Illustration kind={kind} /></span>
                  <span className="tbx-mw-idea-copy">
                    <strong>{tx(prompt)}</strong>
                    <small><Icon name="sparkles" size={12} strokeWidth={2} />{tx('交给助理起个头')}</small>
                  </span>
                </button>
              ))}
            </section>
          )}

          {starting && shown.length > 0 && <h3 className="tbx-mw-section">{tx('最近编辑')}</h3>}

          {shown.length > 0 && view === 'list' && (
            <div className="tbx-mw-thead" aria-hidden="true">
              <span>{tx('名称')}</span><span>{tx('类型')}</span><span>{deleted ? '' : tx('修改日期')}</span>
            </div>
          )}

          {shown.length > 0 && (
            <div className="tbx-mw-items" key={view}>
              {shown.map((item, i) => (
                <article key={item.id} className={cx('tbx-mw-card', deleted && 'is-archived')} style={{ '--i': Math.min(i, 12) }}>
                  <button type="button" className="tbx-mw-open" disabled={busy} onClick={() => onOpen(item)}>
                    <Poster item={item} client={client} mini={view === 'list'} />
                    <span className="tbx-mw-copy">
                      <strong title={item.title}>{item.title}</strong>
                      <small>{view === 'list' ? tx(KIND_LABEL[kindOf(item)]) : (item.updatedAt ? tx(deleted ? '{{date}} 归档' : '{{date}} 编辑', { date: date(item.updatedAt) }) : tx('数学作品'))}</small>
                    </span>
                    {view === 'list' && <span className="tbx-mw-col">{tx(KIND_LABEL[kindOf(item)])}</span>}
                    {view === 'list' && !deleted && <span className="tbx-mw-col tbx-num">{date(item.updatedAt)}</span>}
                  </button>
                  {deleted && (
                    <div className="tbx-mw-archive">
                      <button type="button" disabled={busy} onClick={() => onRestore(item)}><Icon name="restore" size={14} strokeWidth={2} />{tx('恢复')}</button>
                      <button type="button" className="is-danger" disabled={busy} onClick={() => onPurge(item)}>{tx('彻底删除')}</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {!shown.length && (
            <div className={cx('tbx-mw-empty', starting && 'is-quiet')}>
              <span className="tbx-mw-empty-icon">
                {search ? <Icon name="search" size={24} strokeWidth={1.8} /> : deleted ? <Icon name="trash" size={24} strokeWidth={1.8} /> : <MathMark size={26} />}
              </span>
              <h3>{tx(search ? '没有找到作品' : deleted ? '没有归档作品' : starting ? '还没有作品' : '这里还是空的')}</h3>
              <p>{tx(search ? '试试其他名称。' : deleted ? '归档的作品会放在这里，随时可以恢复。' : starting ? '从上面挑一种方式开始，做好的作品会出现在这里。' : '换个分类看看，或者新建一个作品。')}</p>
              {search && <button type="button" className="tbx-mw-chipbtn" onClick={() => onSearch('')}>{tx('清除搜索')}</button>}
            </div>
          )}
        </div>
      </div>

      {/* ---------- rail: what to show, ways in, the assistant ---------- */}
      <Rail label={tx('数学工坊导航')} footer={<RailItem icon="trash" label={tx('已归档')} current={deleted} onClick={() => onDeleted(!deleted)} />}>
        <RailSection title={tx('数学工坊')} count={known.current.all || ''}>
          {FILTERS.map(([key, label, icon]) => (
            <RailItem key={key} icon={icon} label={tx(label)} count={known.current[key]} current={!deleted && filter === key} onClick={() => go(key)} />
          ))}
        </RailSection>
        <RailSection title={tx('导入')}>
          <RailItem icon="upload" label={tx('导入作品')} count=".json" disabled={busy} onClick={onImportSource} />
          <RailItem icon="link" label={tx('导入网页')} count=".html" disabled={busy} onClick={onImport} />
        </RailSection>
        <RailHint tone="purple" onClick={() => shell?.openPanel('assistant')}>{tx('说说想做什么，助理会帮你搭好作品。')}</RailHint>
      </Rail>
    </section>
  );
}
