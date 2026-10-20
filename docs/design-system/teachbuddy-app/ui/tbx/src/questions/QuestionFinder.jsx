import { h, Fragment } from '../shim.js';
import { tb, useEffect, useRef, useState, cx, tx, useLocale } from '../react.js';
import { Rail, RailSection, RailItem, RailAction, RailTags, PaneTitle } from '../kit/rail.jsx';

/*
 * Question bank on the shared module layout: the list and the app's own
 * reading page form one card on the left (like Mail), and the rail on the
 * right holds what to show — all, starred, types, tags, archive. Types and
 * tags are managed in the rail itself, so the side panel is only the
 * assistant. The finder takes over the app's <aside class="q-finder"> and
 * keeps all of its behaviour: server-side filters, scroll restore, imports,
 * drafts.
 */

const Icon = ({ name, size = 17, stroke = 1.9 }) => {
  const { Icon2 } = tb();
  return <Icon2 name={name} size={size} strokeWidth={stroke} />;
};
const QIcon = ({ name, size = 16 }) => {
  const Q = tb().questionKit?.QuestionIcon;
  return Q ? <Q name={name} size={size} /> : null;
};

/* one hue per question type, by its position in the list */
export const TYPE_HUES = ['orange', 'blue', 'purple', 'green', 'pink', 'teal'];
const hueOf = (types, id) => {
  const i = types.findIndex((x) => x.id === id);
  return i < 0 ? 'grey' : TYPE_HUES[i % TYPE_HUES.length];
};

export function QuestionFinder(props) {
  useLocale();
  const {
    archived, items, imports, taxonomy, scene, patchScene, hasFilters, listState, reload, open, startCapture,
    resumeNewDraft, hasNewDraft, showTaxonomy, returnToLibrary, listNode, listRestored,
    taxonomyTools, busy,
  } = props;
  const { questionKit } = tb();
  const DocumentView = questionKit?.DocumentView;
  const ImportList = questionKit?.ImportList;
  const sourceText = questionKit?.sourceText ?? (() => '');
  const figure = (q) => questionKit?.documentAssets?.(q.body)?.figures?.[0];

  // counts are known whenever the full library is on screen
  const known = useRef({ all: 0, starred: 0, types: {} });
  if (!archived && !scene.q && !scene.typeId && !scene.starred && !scene.tagIds?.length) {
    const types = {};
    for (const q of items) if (q.typeId) types[q.typeId] = (types[q.typeId] || 0) + 1;
    known.current = { all: items.length, starred: items.filter((q) => q.starred).length, types };
  }

  const place = archived ? 'archive' : scene.starred ? 'starred' : scene.typeId ? `type:${scene.typeId}` : 'all';
  const go = (patch) => {
    if (archived) returnToLibrary('active', true);
    patchScene({ starred: false, typeId: '', ...patch });
  };
  const toggleTag = (id) => patchScene({ tagIds: scene.tagIds?.includes(id) ? scene.tagIds.filter((x) => x !== id) : [...(scene.tagIds ?? []), id] });
  const typeName = (id) => taxonomy.types.find((x) => x.id === id)?.name;
  const tagName = (id) => taxonomy.tags.find((x) => x.id === id)?.name;
  const title = archived ? tx('已归档') : scene.starred ? tx('已标记') : scene.typeId ? typeName(scene.typeId) || tx('全部题目') : tx('全部题目');
  const count = archived ? items.length + imports.length : items.length;
  // types and tags are edited in place: the rail turns into the editor
  const [managing, setManaging] = useState(false);
  const manage = () => { showTaxonomy(); setManaging(true); };
  // saving the editor gives the taxonomy a new version: back to browsing
  const version = useRef(taxonomy.version);
  useEffect(() => {
    if (version.current !== taxonomy.version) setManaging(false);
    version.current = taxonomy.version;
  }, [taxonomy.version]);
  const touch = () => { listRestored.current = true; };

  return (
    <>
      {/* ---------- rail ---------- */}
      <Rail
        label={tx('题库导航')}
        className="tbx-qn-rail"
        footer={!managing && <RailItem icon="trash" label={tx('已归档')} current={archived} onClick={() => returnToLibrary(archived ? 'active' : 'deleted', true)} />}
      >
        {managing ? (
          <RailSection title={tx('管理题型与标签')} actions={<RailAction icon="close" label={tx('取消')} onClick={() => setManaging(false)} />}>
            <div className="tbx-qn-manage-body">{taxonomyTools}</div>
          </RailSection>
        ) : (
          <>
            <RailSection title={tx('题库')} count={known.current.all || ''}>
              <RailItem icon="grid" label={tx('全部题目')} count={known.current.all} current={place === 'all'} onClick={() => go({})} />
              <RailItem mark={<span className="tbx-rail-icon is-star"><QIcon name="star" size={14} /></span>} label={tx('已标记')} count={known.current.starred} current={place === 'starred'} onClick={() => go({ starred: true })} />
            </RailSection>
            <RailSection title={tx('题型')} actions={<RailAction icon="pencil" label={tx('管理题型与标签')} onClick={manage} />}>
              {taxonomy.types.length === 0 && <p className="tbx-rail-empty">{tx('还没有题型')}</p>}
              {taxonomy.types.map((t) => (
                <RailItem
                  key={t.id}
                  mark={<span className={cx('tbx-rail-dot', `is-${hueOf(taxonomy.types, t.id)}`)} aria-hidden="true" />}
                  label={t.name}
                  count={known.current.types[t.id]}
                  current={place === `type:${t.id}`}
                  onClick={() => go({ typeId: t.id })}
                />
              ))}
            </RailSection>
            {taxonomy.tags.length > 0 && (
              <RailSection title={tx('标签', { context: 'res' })}>
                <RailTags tags={taxonomy.tags} selected={scene.tagIds ?? []} onToggle={toggleTag} />
              </RailSection>
            )}
          </>
        )}
      </Rail>

      {/* ---------- list ---------- */}
      <div className="tbx-qn-list">
        <header className="tbx-qn-bar">
          <div className="tbx-qn-bar-top">
            <PaneTitle icon={<Icon name="book" size={20} stroke={2} />} tone="orange" title={title} sub={tx('{{n}} 道题', { n: count, count })} />
            {!archived && (
              <span className="tbx-qn-bar-actions">
                <RailAction icon="upload" label={tx('从资料收录')} disabled={busy} onClick={startCapture} />
                <RailAction primary icon="plus" label={tx('新建题目')} disabled={busy} onClick={() => open('new', null)} />
              </span>
            )}
          </div>
          <label className="tbx-qn-search">
            <Icon name="search" size={16} stroke={2} />
            <input
              aria-label={tx('搜索题目')}
              placeholder={scene.searchAnswers ? tx('搜索题目、答案或笔记') : tx('搜索题干、公式或笔记')}
              value={scene.q ?? ''}
              onChange={(e) => patchScene({ q: e.target.value })}
            />
            {scene.q && <button type="button" className="tbx-qn-clear" aria-label={tx('清除搜索')} onClick={() => patchScene({ q: '' })}><Icon name="close" size={11} stroke={2.8} /></button>}
          </label>
          {(scene.q || scene.searchAnswers) && (
            <button type="button" className={cx('tbx-qn-chip', scene.searchAnswers && 'is-on')} aria-pressed={Boolean(scene.searchAnswers)} onClick={() => patchScene({ searchAnswers: !scene.searchAnswers })}>
              {scene.searchAnswers && <Icon name="check" size={13} stroke={2.6} />}
              {tx('也搜索答案与解析')}
            </button>
          )}
          {scene.tagIds?.length > 0 && (
            <div className="tbx-qn-filters">
              {scene.tagIds.map((id) => (
                <button key={id} type="button" className="tbx-qn-filter" onClick={() => toggleTag(id)}>
                  <Icon name="tag" size={11} stroke={2.2} />{tagName(id)}<Icon name="close" size={10} stroke={2.8} />
                </button>
              ))}
            </div>
          )}
        </header>

        {!archived && hasNewDraft && scene.kind !== 'new' && (
          <button type="button" className="tbx-qn-draft" onClick={resumeNewDraft}>
            <span className="tbx-qn-draft-icon"><QIcon name="edit" size={15} /></span>
            <span>{tx('继续未完成的题目')}</span>
            <Icon name="chevron" size={14} stroke={2.2} />
          </button>
        )}

        <div
          className="q-list tbx-qn-scroll"
          ref={listNode}
          onWheel={touch}
          onPointerDown={touch}
          onKeyDown={touch}
          onScroll={(e) => { if (listRestored.current) patchScene({ listScroll: e.currentTarget.scrollTop }); }}
        >
          {ImportList && <ImportList imports={imports} archived={archived} selectedId={scene.id} onOpen={(id) => open('import', id)} />}
          {listState === 'loading' ? (
            <p className="tbx-qn-empty" role="status"><span className="tbx-spinner is-small" />{tx('正在读取题库…')}</p>
          ) : listState === 'error' ? (
            <div className="tbx-qn-empty">
              <p>{tx('题库暂时无法读取')}</p>
              <button type="button" className="tbx-qn-chip" onClick={reload}>{tx('重新加载')}</button>
            </div>
          ) : items.length === 0 && (
            <div className="tbx-qn-empty">
              <span className="tbx-qn-empty-icon">{hasFilters ? <Icon name="search" size={20} stroke={1.9} /> : archived ? <Icon name="trash" size={20} stroke={1.9} /> : <Icon name="book" size={22} stroke={1.9} />}</span>
              <p>{hasFilters ? tx('没有符合条件的题目，试试调整筛选。') : archived ? tx('没有归档的题目。') : imports.length ? tx('材料确认入库后，题目会出现在这里。') : tx('收录第一道题，开始积累。')}</p>
              {hasFilters && <button type="button" className="tbx-qn-chip" onClick={() => patchScene({ q: '', typeId: '', tagIds: [], starred: false, searchAnswers: false })}>{tx('清除条件')}</button>}
            </div>
          )}
          {items.map((q, i) => {
            const fig = figure(q);
            const tags = (q.tagIds || []).map(tagName).filter(Boolean);
            return (
              <button
                key={q.id}
                type="button"
                className={cx('tbx-qn-row', scene.id === q.id && 'selected')}
                style={{ '--i': Math.min(i, 12) }}
                aria-current={scene.id === q.id ? 'true' : undefined}
                onClick={() => open('question', q.id)}
              >
                <span className="tbx-qn-row-text">
                  <strong>
                    <span>{q.title || sourceText(q.body).slice(0, 36) || tx('未命名题目')}</span>
                    {q.starred && <span className="tbx-qn-star" aria-label={tx('已标记')}><QIcon name="star" size={13} /></span>}
                  </strong>
                  <span className="tbx-qn-excerpt">
                    {DocumentView && <DocumentView value={{ version: q.body.version, blocks: q.body.blocks.filter((b) => b.type !== 'image').slice(0, 1) }} />}
                  </span>
                  {(q.typeId || tags.length > 0) && (
                    <span className="tbx-qn-meta">
                      {q.typeId && typeName(q.typeId) && <span className={cx('tbx-qn-type', `is-${hueOf(taxonomy.types, q.typeId)}`)}>{typeName(q.typeId)}</span>}
                      {tags.slice(0, 2).map((name) => <span key={name} className="tbx-qn-tag">{name}</span>)}
                      {tags.length > 2 && <span className="tbx-qn-tag">+{tags.length - 2}</span>}
                    </span>
                  )}
                </span>
                {fig && DocumentView && <span className="tbx-qn-figure"><DocumentView value={{ version: 2, blocks: [fig] }} /></span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* The reading pane before a question is chosen. */
export function QuestionWelcome({ onCapture, onCreate, hasItems }) {
  useLocale();
  return (
    <div className="q-welcome tbx-qn-welcome">
      <div className="tbx-qn-welcome-art" aria-hidden="true">
        <span className="is-back" />
        <span className="is-mid" />
        <span className="is-front">
          <i /><i /><i className="is-formula">x² − 4x + 3 = 0</i><i /><i className="is-short" />
        </span>
      </div>
      <h2>{hasItems ? tx('选一道题，开始准备下一节课') : tx('把好题留下来，随时用起来')}</h2>
      <p>{hasItems ? tx('从列表里选一道题，查看答案、改编，或导出成图片放进课件。') : tx('收录试卷、截图或文字里的题目，之后随时查找、改编和导出。')}</p>
      {!hasItems && (
        <div className="tbx-qn-welcome-actions">
          <button type="button" className="tbx-qn-btn is-primary" onClick={onCreate}><Icon name="plus" size={15} stroke={2.2} />{tx('新建题目')}</button>
          <button type="button" className="tbx-qn-btn" onClick={onCapture}><Icon name="upload" size={15} stroke={2} />{tx('从资料收录')}</button>
        </div>
      )}
    </div>
  );
}
