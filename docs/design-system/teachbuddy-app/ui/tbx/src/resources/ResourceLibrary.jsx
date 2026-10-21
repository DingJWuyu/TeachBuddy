import { h, Fragment } from '../shim.js';
import { tb, useEffect, useLayoutEffect, useRef, useState, cx, tx, useLocale, monthDay } from '../react.js';
import { Rail, RailSection, RailItem, RailAction, PaneTitle } from '../kit/rail.jsx';
import { Popover } from '../kit/popover.jsx';
import { Segmented } from '../kit/segmented.jsx';
import { FilterMenu } from '../kit/filter.jsx';
import { ConfirmButton, ConfirmDialog, ConfirmMenuItem } from '../kit/confirm.jsx';
import { LABEL_COLORS, colorOf } from '../kit/colors.js';

/*
 * Resource library, rebuilt. Same props and behaviour as the app's Library
 * (search, folders, tags, type filter, grid/list, selection, upload) laid out
 * like the rest of the workbench: the files card on the left and the shared
 * rail on the right (folders, tags, archive).
 *
 * It should feel like a file manager: drag files onto a folder, a tag or the
 * archive; drag a box over empty space to select; folders nest and fold; a
 * second click on the open folder goes back to everything. Writes go through
 * the page's own queue (onWrite), so messages, conflicts and state stay one system.
 */

const ROOT = '/api/modules/resources';

/* file kinds: what the type filter offers, and the tint each kind wears */
const KINDS = [
  { id: 'pdf', name: 'PDF', hue: '#e0352b' },
  { id: 'ppt', name: '演示文稿', hue: '#c96f00' },
  { id: 'doc', name: '文档', hue: '#0071e3' },
  { id: 'img', name: '图片', hue: '#1f9d55' },
  { id: 'html', name: '网页', hue: '#8e44ad' },
];
const KIND_BY_TYPE = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
  'application/msword': 'doc',
  'image/png': 'img',
  'image/jpeg': 'img',
  'image/webp': 'img',
  'image/gif': 'img',
  'text/html': 'html',
};
const KIND_BY_EXT = { pdf: 'pdf', ppt: 'ppt', pptx: 'ppt', key: 'ppt', doc: 'doc', docx: 'doc', png: 'img', jpg: 'img', jpeg: 'img', webp: 'img', gif: 'img', html: 'html', htm: 'html' };

const Icon = ({ name, size = 17, stroke = 1.9 }) => {
  const { Icon2 } = tb();
  return <Icon2 name={name} size={size} strokeWidth={stroke} />;
};

const extOf = (file) => (file?.name?.split('.').pop() || '').toLowerCase();
const kindOf = (file) => KIND_BY_TYPE[file?.mediaType] ?? KIND_BY_EXT[extOf(file)] ?? null;
const sizeOf = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
const dayOf = (iso) => (iso ? monthDay(iso.slice(0, 10)) : '');
const KindMark = ({ kind }) => (
  <span className="tbx-filter-mark" style={{ color: KINDS.find((k) => k.id === kind)?.hue }}><Icon name="fileType" size={15} stroke={2} /></span>
);

/* Thumbnails are kept once loaded, so a card that leaves the list during a
   search and comes back shows its picture at once instead of flashing. */
const urls = new Map();
const loading = new Map();
function useFileUrl(client, id) {
  const [url, setUrl] = useState(() => (id && urls.get(id)) || '');
  useEffect(() => {
    if (!id) return undefined;
    if (urls.has(id)) { setUrl(urls.get(id)); return undefined; }
    let live = true;
    let job = loading.get(id);
    if (!job) {
      job = client.request(`/api/workbench/files/${id}/content`, { blob: true }).then((blob) => {
        const u = URL.createObjectURL(blob);
        urls.set(id, u);
        return u;
      });
      loading.set(id, job);
      job.catch(() => loading.delete(id));
    }
    job.then((u) => { if (live) setUrl(u); }).catch(() => {});
    return () => { live = false; };
  }, [id]);
  return url;
}

function UploadButton({ onUpload, disabled, big }) {
  const input = useRef(null);
  return (
    <>
      <button
        type="button"
        className={cx('tbx-primary tbx-res-upload', big && 'is-big', disabled && 'is-disabled')}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" size={big ? 18 : 16} stroke={2.1} />
        <span>{tx('上传资料')}</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        disabled={disabled}
        aria-label={tx('上传资料')}
        onChange={(e) => { onUpload(Array.from(e.target.files)); e.target.value = ''; }}
      />
    </>
  );
}

function Thumb({ client, preview, file, title, error }) {
  const ext = extOf(file);
  const kind = kindOf(file) ?? 'file';
  const page = preview?.pages?.[0];
  const url = useFileUrl(client, page?.imageFileId);
  return (
    <span className={cx('tbx-res-thumb', `is-${kind}`, !page && 'is-blank')}>
      {page ? (
        url ? <img src={url} alt={tx('{{title}} 缩略图', { title })} draggable={false} /> : null
      ) : (
        <span className="tbx-res-thumb-mark">
          <Icon name="file" size={26} stroke={1.6} />
          <em>{ext ? ext.toUpperCase() : tx('文件')}</em>
        </span>
      )}
      {ext && page && <span className="tbx-res-badge">{ext.toUpperCase()}</span>}
      {error && <span className="tbx-res-thumb-error">{error}</span>}
    </span>
  );
}

/* a tag as it appears on a file: a coloured dot and the name */
const TagDot = ({ tag, index }) => (
  <span className="tbx-res-tag" style={{ '--tag': colorOf(tag, index) }}><i />{tag.name}</span>
);

/* New / edit tag: the schedule's label dialog, for resource tags. */
function TagDialog({ tag, tax, busy, onWrite, onClose }) {
  const { scheduleKit: K } = tb();
  const index = tag ? tax.tags.findIndex((t) => t.id === tag.id) : tax.tags.length;
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(colorOf(tag, index));
  const trimmed = name.trim();
  const clash = tax.tags.some((t) => t.id !== tag?.id && t.name.trim().toLowerCase() === trimmed.toLowerCase());
  const write = async (tags) => {
    if (await onWrite(`${ROOT}/taxonomy`, { baseVersion: tax.version, folders: tax.folders, tags }, 'taxonomy')) onClose();
  };
  const save = () => {
    if (!trimmed || clash) return;
    const next = { ...(tag || { id: crypto.randomUUID() }), name: trimmed, color };
    write(tag ? tax.tags.map((t) => (t.id === tag.id ? next : t)) : [...tax.tags, next]);
  };
  return (
    <K.CalendarDialog title={tag ? tx('编辑标签') : tx('新建标签')} onClose={onClose}>
      <label className="cal-field">
        {tx('名称')}
        <input aria-label={tx('标签名称')} maxLength="60" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {clash && <p className="cal-error" role="alert">{tx('已经有叫“{{name}}”的标签了', { name: trimmed })}</p>}
      <fieldset className="cal-label-colors">
        <legend>{tx('颜色')}</legend>
        {LABEL_COLORS.map((value) => (
          <button key={value} type="button" aria-label={tx('颜色 {{value}}', { value })} aria-pressed={color === value} style={{ background: value }} onClick={() => setColor(value)}>
            {value === color && <Icon name="check" size={16} stroke={2.4} />}
          </button>
        ))}
      </fieldset>
      <footer>
        {tag && <ConfirmButton className="cal-label-delete" label={tx('删除标签')} text={tx('删除标签')} disabled={busy} onConfirm={() => write(tax.tags.filter((t) => t.id !== tag.id))} />}
        <button type="button" onClick={onClose}>{tx('取消')}</button>
        <button type="button" className="is-primary" data-dialog-confirm="" disabled={!trimmed || clash || busy} onClick={save}>{tx('保存')}</button>
      </footer>
    </K.CalendarDialog>
  );
}

/* Tags for the picked files: every tag with its state across the selection —
   on all (✓), on some (–), on none. A click puts it on all of them, or takes it
   off all of them when they all have it. */
function SelectionTags({ anchor, open, onClose, picked, tax, busy, onAdd, onRemove, onNew }) {
  return (
    <Popover anchor={anchor} open={open} onClose={onClose} align="center" role="menu" label={tx('标签')} className="tbx-res-tagmenu">
      <div className="tbx-popover-label">{tx('给 {{n}} 份资料加标签或去掉标签', { n: picked.length })}</div>
      {tax.tags.map((t, i) => {
        const have = picked.filter((r) => r.tagIds.includes(t.id)).length;
        const all = have === picked.length && have > 0;
        return (
          <button key={t.id} type="button" role="menuitemcheckbox" aria-checked={all ? 'true' : have ? 'mixed' : 'false'} disabled={busy} onClick={() => (all ? onRemove(t.id) : onAdd(t.id))}>
            <i className="tbx-filter-dot" style={{ background: colorOf(t, i) }} />
            <span className="tbx-res-tagmenu-name">{t.name}</span>
            {have > 0 && !all && <small>{have}/{picked.length}</small>}
            {(all || have > 0) && <span className="tbx-pop-check"><Icon name={all ? 'check' : 'minus'} size={14} stroke={2.4} /></span>}
          </button>
        );
      })}
      {tax.tags.length > 0 && <div className="tbx-popover-sep" />}
      <button type="button" role="menuitem" onClick={onNew}><Icon name="plus" size={15} stroke={2.2} />{tx('新建标签…')}</button>
    </Popover>
  );
}

export function ResourceLibrary(props) {
  useLocale();
  const {
    scene, patchScene, items, allItems, tax, files, previews, fileErrors = {}, client, busy, loading: listLoading,
    searchInfo, onRetrySearch, listRef, breadcrumbs, onOpen, onUpload, onManage, onOrganize, onWrite,
  } = props;
  const { scheduleKit: K } = tb();
  const [drop, setDrop] = useState(false); // files from the computer over the card
  const deleted = scene.state === 'deleted';
  const active = allItems.filter((i) => !i.deletedAt);
  const archived = allItems.filter((i) => i.deletedAt);
  const kinds = scene.kinds || [];
  const unfiled = Boolean(scene.unfiled) && !deleted;
  const filtered = Boolean(scene.q || scene.folderId || unfiled || kinds.length || scene.tagIds.length);
  const firstVisit = !listLoading && !active.length && !deleted && !filtered;
  const select = scene.selectionMode;
  const folder = tax.folders.find((f) => f.id === scene.folderId);
  const tagIndex = (id) => tax.tags.findIndex((t) => t.id === id);
  const tagOf = (id) => tax.tags.find((t) => t.id === id);
  const folderName = (id) => tax.folders.find((f) => f.id === id)?.name;
  const go = (patch) => patchScene({ selected: [], selectionMode: false, ...patch });
  const clear = () => { setQ(''); sent.current = ''; patchScene({ q: '', folderId: '', unfiled: false, tagIds: [], mediaType: '', kinds: [] }); };
  const toggleTag = (id) => patchScene({ tagIds: scene.tagIds.includes(id) ? scene.tagIds.filter((x) => x !== id) : [...scene.tagIds, id] });

  // an older saved view may still carry one media type: it becomes a kind
  useEffect(() => {
    if (!scene.mediaType) return;
    const kind = KIND_BY_TYPE[scene.mediaType];
    patchScene({ mediaType: '', kinds: kind ? [kind] : [] });
  }, [scene.mediaType]);

  // types are filtered here, so several can be picked at once
  const byKind = kinds.length ? items.filter((r) => { const k = kindOf(files[r.fileId]); return !k ? !files[r.fileId] : kinds.includes(k); }) : items;
  // "未分组" holds the files that sit in no folder
  const shown = unfiled ? byKind.filter((r) => !r.folderId) : byKind;
  const byId = new Map(allItems.map((r) => [r.id, r]));

  /* ---------- search: typed here, sent when the typing pauses ---------- */
  const [q, setQ] = useState(scene.q);
  const sent = useRef(scene.q);
  useEffect(() => {
    if (scene.q !== sent.current) { sent.current = scene.q; setQ(scene.q); }
  }, [scene.q]);
  useEffect(() => {
    if (q === sent.current) return undefined;
    const timer = setTimeout(() => { sent.current = q; patchScene({ q }); }, 280);
    return () => clearTimeout(timer);
  }, [q]);

  /* ---------- folders as a tree that folds ---------- */
  const closed = new Set(scene.foldersClosed || []);
  const kids = (parentId) => tax.folders.filter((f) => (f.parentId ?? null) === parentId);
  const inside = (id) => { const out = new Set([id]); let grew = true; while (grew) { grew = false; tax.folders.forEach((f) => { if (out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; } }); } return out; };
  const countIn = (id) => { const set = inside(id); return active.filter((i) => set.has(i.folderId)).length; };
  const tagged = (id) => active.filter((i) => i.tagIds.includes(id)).length;
  const toggleFold = (id) => patchScene({ foldersClosed: closed.has(id) ? [...closed].filter((x) => x !== id) : [...closed, id] });
  const openFolder = (id) => (!deleted && scene.folderId === id ? go({ state: 'active', folderId: '', unfiled: false }) : go({ state: 'active', folderId: id, unfiled: false }));
  const writeTax = (folders, tags) => onWrite(`${ROOT}/taxonomy`, { baseVersion: tax.version, folders, tags }, 'taxonomy');

  /* new folder / rename: the row turns into its own field, like the sidebar's 新建分组 */
  const [editing, setEditing] = useState(null); // { mode: 'new', parentId } | { mode: 'rename', id }
  const [draft, setDraft] = useState('');
  const [nameError, setNameError] = useState('');
  const startNew = (parentId = null) => {
    setEditing({ mode: 'new', parentId }); setDraft(''); setNameError('');
    if (parentId && closed.has(parentId)) patchScene({ foldersClosed: [...closed].filter((id) => id !== parentId) });
  };
  const startRename = (f) => { setEditing({ mode: 'rename', id: f.id }); setDraft(f.name); setNameError(''); };
  const stopEditing = () => { setEditing(null); setDraft(''); setNameError(''); };
  const folderProblem = (name) => {
    const n = name.trim().toLowerCase();
    if (!n) return tx('名称不能为空');
    if ([tx('未分组'), '未分组', 'ungrouped'].map((x) => x.toLowerCase()).includes(n)) return tx('“未分组”是保留的名称');
    const parentId = editing.mode === 'new' ? editing.parentId : tax.folders.find((f) => f.id === editing.id)?.parentId ?? null;
    if (tax.folders.some((f) => f.id !== editing.id && (f.parentId ?? null) === parentId && f.name.trim().toLowerCase() === n)) return tx('已经有叫“{{name}}”的文件夹了', { name: name.trim() });
    return '';
  };
  async function commitName(leaving = false) {
    if (!editing) return;
    const problem = folderProblem(draft);
    if (problem) {
      if (leaving) stopEditing();
      else setNameError(problem);
      return;
    }
    const name = draft.trim();
    const current = editing;
    stopEditing();
    if (current.mode === 'new') await writeTax([...tax.folders, { id: crypto.randomUUID(), name, parentId: current.parentId }], tax.tags);
    else if (tax.folders.find((f) => f.id === current.id)?.name !== name) await writeTax(tax.folders.map((f) => (f.id === current.id ? { ...f, name } : f)), tax.tags);
  }
  const nameField = (depth) => (
    <div className="tbx-rail-editing" style={{ '--depth': depth }}>
      <form className={cx('tbx-new-group', nameError && 'is-invalid')} onSubmit={(e) => { e.preventDefault(); commitName(); }}>
        <Icon name="folder" size={16} stroke={2} />
        <input
          autoFocus
          value={draft}
          maxLength={80}
          placeholder={tx('文件夹名称')}
          aria-label={editing?.mode === 'new' ? tx('新文件夹名称') : tx('重命名文件夹')}
          aria-invalid={nameError ? true : undefined}
          onFocus={(e) => e.target.select()}
          onChange={(e) => { setDraft(e.target.value); setNameError(''); }}
          onBlur={() => commitName(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); stopEditing(); } }}
        />
      </form>
      {nameError && <p className="tbx-name-error" role="alert">{nameError}</p>}
    </div>
  );

  /* Folder actions preserve the tree. Removed folders send all descendant files
     to Ungrouped in the taxonomy adapter; moving a folder keeps its contents. */
  const [folderMenu, setFolderMenu] = useState(null); // { folder, anchor }
  const [folderMove, setFolderMove] = useState(null); // { folder, anchor }
  const folderPath = (f) => {
    const path = [f.name];
    const visited = new Set([f.id]);
    let parent = f.parentId;
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      const p = tax.folders.find((x) => x.id === parent);
      if (!p) break;
      path.unshift(p.name);
      parent = p.parentId;
    }
    return path.join(' / ');
  };
  const canMoveFolder = (f, parentId) => {
    if (inside(f.id).has(parentId)) return false;
    return !tax.folders.some((sibling) => sibling.id !== f.id && (sibling.parentId ?? null) === parentId && sibling.name.trim().toLowerCase() === f.name.trim().toLowerCase());
  };
  const moveFolder = async (f, parentId) => {
    setFolderMove(null);
    if ((f.parentId ?? null) === parentId || !canMoveFolder(f, parentId)) return;
    await writeTax(tax.folders.map((x) => x.id === f.id ? { ...x, parentId } : x), tax.tags);
  };
  const deleteFolder = async (f) => {
    setFolderMenu(null);
    const branch = inside(f.id);
    const ok = await writeTax(tax.folders.filter((x) => !branch.has(x.id)), tax.tags);
    if (ok && branch.has(scene.folderId)) go({ folderId: '', unfiled: false });
  };
  const archiveFolder = async (f) => {
    const branch = inside(f.id);
    const contents = active.filter((item) => branch.has(item.folderId));
    if (contents.length && !await organize('archive', contents)) return;
    const ok = await writeTax(tax.folders.filter((x) => !branch.has(x.id)), tax.tags);
    if (ok && branch.has(scene.folderId)) go({ folderId: '', unfiled: false });
  };

  /* dragging rows of the rail: a folder into another folder (or onto 未分组 to put
     it back at the top level), a tag up or down the list. Same drag as the sidebar:
     the row dims, a compact copy follows the pointer where it was grabbed, other
     rows stay still, and the landing place lights up or shows the blue line. */
  const [railDrag, setRailDrag] = useState(null);
  const tagList = useRef(null);
  function startRailDrag(e, kind, item) {
    if (e.button !== 0 || deleted || busy || !onWrite || editing || e.target.closest('.tbx-rail-more, .tbx-rail-toggle, input')) return;
    const row = e.currentTarget;
    const r = row.getBoundingClientRect();
    const label = row.querySelector('.tbx-rail-label');
    const compact = label ? Math.min(r.width, label.getBoundingClientRect().right - r.left + 14) : r.width;
    const grab = { dx: Math.min(e.clientX - r.left, compact - 16), dy: e.clientY - r.top };
    const sx = e.clientX;
    const sy = e.clientY;
    const blocked = kind === 'folder' ? inside(item.id) : null;
    let on = false;
    let target = null;
    let index = null;
    const mark = (el) => { if (target === el) return; target?.classList.remove('is-drop'); target = el; target?.classList.add('is-drop'); };
    const move = (ev) => {
      if (!on && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      if (!on) { on = true; document.documentElement.classList.add('tbx-dragging'); }
      let line = null;
      if (kind === 'folder') {
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drop]');
        const where = hit?.dataset.drop;
        const id = where?.startsWith('folder:') ? where.slice(7) : null;
        const allowed = where === 'archive' || (id !== null && !blocked.has(id) && id !== (item.parentId ?? '') && canMoveFolder(item, id || null));
        mark(hit && allowed ? hit : null);
      } else {
        const box = tagList.current;
        const rows = [...box.querySelectorAll(':scope > .tbx-rail-drag')];
        const b = box.getBoundingClientRect();
        index = rows.findIndex((el) => { const rr = el.getBoundingClientRect(); return ev.clientY < rr.top + rr.height / 2; });
        if (index < 0) index = rows.length;
        const edge = index < rows.length ? rows[index].getBoundingClientRect().top : rows[rows.length - 1].getBoundingClientRect().bottom;
        line = edge - b.top;
      }
      setRailDrag({ kind, item, x: ev.clientX, y: ev.clientY, ...grab, line });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.documentElement.classList.remove('tbx-dragging');
      const where = target?.dataset.drop;
      mark(null);
      setRailDrag(null);
      if (!on) return;
      // the press that ended a drag is not also a click on the row
      const swallow = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      if (kind === 'folder' && where) {
        if (where === 'archive') archiveFolder(item);
        else if (where.startsWith('folder:')) moveFolder(item, where.slice(7) || null);
      }
      if (kind === 'tag' && index != null) {
        const from = tax.tags.findIndex((t) => t.id === item.id);
        const to = index > from ? index - 1 : index;
        if (to !== from) {
          // Legacy tags without explicit colors used an index-based fallback.
          // Materialize their current colors before changing only their order.
          const painted = tax.tags.map((t, i) => ({ ...t, color: colorOf(t, i) }));
          const next = painted.filter((t) => t.id !== item.id);
          next.splice(to, 0, painted[from]);
          writeTax(tax.folders, next);
        }
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const folderRows = (parentId, depth) => kids(parentId).map((f) => {
    const children = kids(f.id);
    const isOpen = !closed.has(f.id);
    const current = !deleted && scene.folderId === f.id;
    return (
      <Fragment key={f.id}>
        {editing?.mode === 'rename' && editing.id === f.id ? nameField(depth) : (
          <div className={cx('tbx-rail-drag', railDrag?.item.id === f.id && 'is-origin')} onPointerDown={(e) => startRailDrag(e, 'folder', f)}>
            <RailItem
              className="is-tree"
              icon={current ? 'folderOpen' : 'folder'}
              label={f.name}
              depth={depth}
              count={countIn(f.id)}
              current={current}
              drop={deleted ? undefined : `folder:${f.id}`}
              onClick={() => openFolder(f.id)}
              toggle={children.length ? { open: isOpen, label: isOpen ? tx('收起') : tx('展开'), onClick: () => toggleFold(f.id) } : null}
              more={onWrite && !deleted ? { label: tx('文件夹选项'), onClick: (e) => { const el = e.currentTarget; setFolderMenu((m) => (m?.folder.id === f.id ? null : { folder: f, anchor: { current: el } })); } } : null}
            />
          </div>
        )}
        {(children.length > 0 || (editing?.mode === 'new' && editing.parentId === f.id)) && (
          <div className={cx('tbx-rail-fold', !isOpen && 'is-closed')} inert={isOpen ? undefined : ''}>
            <div>
              {folderRows(f.id, depth + 1)}
              {editing?.mode === 'new' && editing.parentId === f.id && nameField(depth + 1)}
            </div>
          </div>
        )}
      </Fragment>
    );
  });

  const title = deleted ? tx('已归档') : folder ? folder.name : unfiled ? tx('未分组') : tx('全部资料');

  useEffect(() => {
    const el = listRef.current;
    if (el && scene.scroll) el.scrollTop = scene.scroll;
  }, []);

  /* ---------- selection ---------- */
  const [band, setBand] = useState(null); // the box being dragged over empty space
  const selected = band ? band.ids : scene.selected;
  const isPicked = (id) => selected.includes(id);
  const picked = scene.selected.map((id) => byId.get(id)).filter(Boolean);
  async function downloadPicked() {
    // Reuse the resource detail's original-file downloader. No panel opens.
    for (const item of picked) {
      try {
        await client.download(item.fileId, files[item.fileId]?.name || item.title);
      } catch (error) {
        console.error('Resource download failed:', error);
        break;
      }
    }
  }
  const allPicked = shown.length > 0 && shown.slice(0, 100).every((r) => scene.selected.includes(r.id));
  const pick = (id) => patchScene({ selected: scene.selected.includes(id) ? scene.selected.filter((x) => x !== id) : [...scene.selected, id] });

  const scrollRef = useRef(null);
  const setScrollRef = (el) => { scrollRef.current = el; if (typeof listRef === 'function') listRef(el); else if (listRef) listRef.current = el; };

  function startBand(e) {
    if (e.button !== 0 || e.target.closest('.tbx-res-card, .tbx-res-thead, .tbx-res-empty button, a, input, label')) return;
    const box = scrollRef.current;
    if (!box || !shown.length) return;
    const start = { x: e.clientX, y: e.clientY, top: box.scrollTop };
    const base = e.shiftKey || e.metaKey || e.ctrlKey ? scene.selected : [];
    let moved = false;
    let last = { x: e.clientX, y: e.clientY };
    let frame = 0;
    const update = () => {
      const r = box.getBoundingClientRect();
      const y0 = start.y - (box.scrollTop - start.top);
      const rect = { left: Math.min(start.x, last.x), right: Math.max(start.x, last.x), top: Math.min(y0, last.y), bottom: Math.max(y0, last.y) };
      const ids = [...base];
      box.querySelectorAll('.tbx-res-card[data-id]').forEach((el) => {
        const c = el.getBoundingClientRect();
        if (c.right > rect.left && c.left < rect.right && c.bottom > rect.top && c.top < rect.bottom && !ids.includes(el.dataset.id)) ids.push(el.dataset.id);
      });
      setBand({ ids, x: rect.left - r.left, y: rect.top - r.top + box.scrollTop, w: rect.right - rect.left, h: rect.bottom - rect.top });
    };
    const tick = () => {
      const r = box.getBoundingClientRect();
      const edge = 36;
      const speed = last.y < r.top + edge ? -(r.top + edge - last.y) / 2 : last.y > r.bottom - edge ? (last.y - (r.bottom - edge)) / 2 : 0;
      if (speed) { box.scrollTop += Math.max(-18, Math.min(18, speed)); update(); }
      frame = requestAnimationFrame(tick);
    };
    const move = (ev) => {
      last = { x: ev.clientX, y: ev.clientY };
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
      if (!moved) { moved = true; document.documentElement.classList.add('tbx-banding'); frame = requestAnimationFrame(tick); }
      update();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove('tbx-banding');
      setBand((b) => {
        if (moved && b) patchScene({ selectionMode: true, selected: b.ids.slice(0, 100) });
        else if (!moved && select && !base.length) patchScene({ selected: [] });
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /* ---------- dragging files onto the rail ---------- */
  const [drag, setDrag] = useState(null);
  const dragging = useRef(false);
  const suppressClick = useRef(false);
  function organize(action, list, extra = {}) {
    if (!onWrite || !list.length) return Promise.resolve(false);
    return onWrite(`${ROOT}/items/organize`, {
      action,
      items: list.map((r) => ({ id: r.id, baseVersion: r.version })),
      folderId: null,
      tagIds: [],
      ...extra,
    }, 'organize', 'POST');
  }
  function startDrag(e, r) {
    if (e.button !== 0 || deleted || !onWrite || busy) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const ids = select && scene.selected.includes(r.id) ? scene.selected : [r.id];
    let on = false;
    let target = null;
    const mark = (el) => {
      if (target === el) return;
      target?.classList.remove('is-drop');
      target = el;
      target?.classList.add('is-drop');
    };
    const move = (ev) => {
      if (!on && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      if (!on) { on = true; dragging.current = true; document.documentElement.classList.add('tbx-dragging'); }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drop]');
      mark(hit && !hit.querySelector('.tbx-rail-hit:disabled') ? hit : null);
      setDrag({ x: ev.clientX, y: ev.clientY, ids, item: r });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.documentElement.classList.remove('tbx-dragging');
      const where = target?.dataset.drop;
      mark(null);
      setDrag(null);
      dragging.current = false;
      if (!on) return;
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 0);
      const list = ids.map((id) => byId.get(id)).filter(Boolean);
      if (!where) return;
      const [kind, id] = where.split(':');
      if (kind === 'folder') organize('move', list.filter((x) => (x.folderId || '') !== id), { folderId: id || null });
      if (kind === 'tag') organize('add-tags', list.filter((x) => !x.tagIds.includes(id)), { tagIds: [id] });
      if (kind === 'archive') organize('archive', list);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /* ---------- the selection bar's tag menu and permanent delete ---------- */
  const tagButton = useRef(null);
  const [tagMenu, setTagMenu] = useState(false);
  const [tagDialog, setTagDialog] = useState(null); // { tag } | { tag: null }
  const [purging, setPurging] = useState(false);
  async function removeTag(id) {
    for (const r of picked.filter((x) => x.tagIds.includes(id))) {
      const ok = await onWrite(`${ROOT}/items/${r.id}`, { baseVersion: r.version, title: r.title, folderId: r.folderId, tagIds: r.tagIds.filter((t) => t !== id), note: r.note }, 'metadata');
      if (!ok) break;
    }
  }
  async function purge() {
    for (const r of picked) {
      const ok = await onWrite(`${ROOT}/items/${r.id}/purge`, { baseVersion: r.version }, 'purge', 'POST');
      if (!ok) break;
    }
    setPurging(false);
    patchScene({ selected: [] });
  }

  const view = scene.view === 'list' ? 'list' : 'grid';
  const dragged = drag?.item;

  return (
    <section
      className="tbx-res tbx-split"
      hidden={!!scene.openId}
      onDragOver={(e) => { if (!deleted && !dragging.current && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDrop(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDrop(false); }}
      onDrop={(e) => { if (!deleted && e.dataTransfer?.files?.length) { e.preventDefault(); setDrop(false); onUpload(Array.from(e.dataTransfer.files)); } }}
    >
      {/* ---------- files ---------- */}
      <div className={cx('tbx-res-main', drop && 'is-drop')} aria-busy={listLoading}>
        <header className="tbx-res-bar">
          <PaneTitle
            icon={<Icon name={deleted ? 'trash' : folder ? 'folderOpen' : 'folder'} size={20} stroke={2} />}
            title={title}
            sub={(
              <>
                {breadcrumbs.length > 1 && !deleted && (
                  <nav className="tbx-res-crumbs" aria-label={tx('当前资料文件夹')}>
                    {breadcrumbs.slice(0, -1).map((b) => (
                      <button key={b.id} type="button" onClick={() => go({ folderId: b.id })}>{b.name}<Icon name="chevron" size={12} stroke={2.2} /></button>
                    ))}
                  </nav>
                )}
                {listLoading && !items.length && !filtered ? tx('正在读取…') : tx('{{n}} 份资料', { n: shown.length })}
              </>
            )}
          />
          {!firstVisit && (
            <div className="tbx-res-tools">
              <label className="tbx-res-search">
                <Icon name="search" size={16} stroke={2} />
                <input
                  aria-label={tx('搜索资料')}
                  placeholder={tx('搜索名称、备注或正文')}
                  maxLength={200}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { sent.current = q; patchScene({ q }); } }}
                />
                {q && <button type="button" className="tbx-res-clear" aria-label={tx('清除搜索')} onClick={() => { setQ(''); sent.current = ''; patchScene({ q: '' }); }}><Icon name="close" size={11} stroke={2.8} /></button>}
              </label>
              <FilterMenu
                label={tx('类型')}
                allLabel={tx('全部类型')}
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>}
                options={KINDS.map((k) => ({ id: k.id, name: tx(k.name), mark: <KindMark kind={k.id} /> }))}
                value={kinds}
                onChange={(next) => patchScene({ kinds: next, mediaType: '', selected: [] })}
              />
              <Segmented
                iconOnly
                label={tx('资料显示方式')}
                value={view}
                onChange={(v) => patchScene({ view: v })}
                options={[
                  { value: 'grid', label: tx('缩略图视图'), icon: <Icon name="grid" size={15} stroke={2} /> },
                  { value: 'list', label: tx('列表视图'), icon: <Icon name="list" size={16} stroke={2} /> },
                ]}
              />
              <button type="button" className={cx('tbx-res-chipbtn', select && 'is-on')} aria-pressed={Boolean(select)} disabled={!select && !shown.length} onClick={() => patchScene({ selectionMode: !select, selected: [] })}>
                {select ? tx('完成') : tx('选择')}
              </button>
              {!deleted && <UploadButton onUpload={onUpload} disabled={busy} />}
            </div>
          )}
        </header>

        {(kinds.length > 0 || scene.tagIds.length > 0 || Boolean(scene.q && searchInfo && (searchInfo.pending || searchInfo.interrupted || searchInfo.failed || searchInfo.ocr?.pendingPages))) && (
          <div className="tbx-res-filters">
            {kinds.map((id) => (
              <button key={id} type="button" className="tbx-res-filter is-kind" aria-label={tx('移除筛选：{{name}}', { name: tx(KINDS.find((k) => k.id === id)?.name) })} onClick={() => patchScene({ kinds: kinds.filter((x) => x !== id) })}>
                <Icon name="fileType" size={12} stroke={2.2} />{tx(KINDS.find((k) => k.id === id)?.name)}<Icon name="close" size={10} stroke={2.8} />
              </button>
            ))}
            {scene.tagIds.map((id) => tagOf(id) && (
              <button key={id} type="button" className="tbx-res-filter is-tag" style={{ '--tag': colorOf(tagOf(id), tagIndex(id)) }} aria-label={tx('移除筛选：{{name}}', { name: tagOf(id).name })} onClick={() => toggleTag(id)}>
                <i />{tagOf(id).name}<Icon name="close" size={10} stroke={2.8} />
              </button>
            ))}
            {scene.q && searchInfo?.pending > 0 && <span className="tbx-res-status"><span className="tbx-spinner is-small" />{tx('正在读取 {{n}} 份资料的正文，结果会自动补充…', { n: searchInfo.pending })}</span>}
            {scene.q && searchInfo?.ocr?.pendingPages > 0 && <span className="tbx-res-status"><span className="tbx-spinner is-small" />{tx('正在识别 {{n}} 页…', { n: searchInfo.ocr.pendingPages })}</span>}
            {scene.q && (searchInfo?.interrupted || searchInfo?.failed > 0) && <span className="tbx-res-status is-warn">{tx('部分正文没有读到。')}<button type="button" onClick={onRetrySearch}>{tx('重试')}</button></span>}
          </div>
        )}

        <div
          className={cx('tbx-res-scroll', `is-${view}`, select && 'is-selecting')}
          ref={setScrollRef}
          onScroll={(e) => patchScene({ scroll: e.currentTarget.scrollTop })}
          onPointerDown={startBand}
        >
          {shown.length > 0 && view === 'list' && (
            <div className="tbx-res-thead" aria-hidden="true">
              <span>{tx('名称')}</span><span>{tx('文件夹')}</span><span>{tx('修改日期')}</span><span>{tx('大小')}</span>
            </div>
          )}
          {shown.length > 0 && <div className={cx('tbx-res-items', select && 'is-selecting')} key={view}>
            {shown.map((r, i) => {
              const file = files[r.fileId];
              const on = isPicked(r.id);
              const match = searchInfo?.matches?.[r.id];
              const tags = r.tagIds.map(tagOf).filter(Boolean);
              const where = folderName(r.folderId);
              const open = (e) => {
                if (suppressClick.current) return;
                if (select) pick(r.id);
                else onOpen(r.id, e);
              };
              return (
                <article
                  key={r.id}
                  data-id={r.id}
                  className={cx('tbx-res-card', on && 'is-picked', drag?.ids.includes(r.id) && 'is-origin')}
                  style={{ '--i': Math.min(i, 12) }}
                  onPointerDown={(e) => startDrag(e, r)}
                >
                  <button type="button" className="tbx-res-open" onClick={open} aria-pressed={select ? on : undefined}>
                    <Thumb client={client} preview={previews[r.fileId]} file={file} title={r.title} error={fileErrors[r.fileId] ? tx('文件读取失败') : ['limited', 'failed'].includes(previews[r.fileId]?.state) ? tx('无法预览') : ''} />
                    <span className="tbx-res-copy">
                      <strong title={r.title}>{r.title}</strong>
                      {match ? (
                        <small className="tbx-res-excerpt">{match.page ? tx('第 {{page}} 页 · ', { page: match.page }) : tx('正文 · ')}{match.excerpt}</small>
                      ) : view === 'list' ? (
                        <small className="tbx-res-meta">
                          <span className="tbx-res-file">{file?.name}</span>
                          {tags.map((t) => <TagDot key={t.id} tag={t} index={tagIndex(t.id)} />)}
                        </small>
                      ) : (
                        <small className="tbx-res-meta">
                          {where
                            ? <span className="tbx-res-where"><Icon name="folder" size={12} stroke={2} />{where}</span>
                            : !tags.length && <span className="tbx-res-where is-none">{tx('未归入文件夹')}</span>}
                          {tags.map((t) => <TagDot key={t.id} tag={t} index={tagIndex(t.id)} />)}
                        </small>
                      )}
                    </span>
                    {view === 'list' && (
                      <>
                        <span className={cx('tbx-res-col', !where && 'is-none')}>{where || tx('未归入文件夹')}</span>
                        <span className="tbx-res-col tbx-num">{dayOf(r.updatedAt)}</span>
                        <span className="tbx-res-col tbx-num">{sizeOf(file?.byteLength)}</span>
                      </>
                    )}
                  </button>
                  {select && (
                    <span className={cx('tbx-res-check', on && 'is-on')} aria-hidden="true"><Icon name="check" size={13} stroke={3} /></span>
                  )}
                </article>
              );
            })}
          </div>}
          {band && <div className="tbx-res-band" style={{ transform: `translate(${band.x}px, ${band.y}px)`, width: band.w, height: band.h }} aria-hidden="true" />}

          {!shown.length && (
            <div className="tbx-res-empty">
              {firstVisit ? (
                <>
                  <div className="tbx-res-empty-art" aria-hidden="true">
                    <span className="is-a" /><span className="is-b" /><span className="is-c"><Icon name="upload" size={22} stroke={2} /></span>
                  </div>
                  <h3>{tx('把常用的资料放在这里')}</h3>
                  <p>{tx('课件、试卷、讲义和图片，上传后随时预览、搜索正文和复用。也可以直接把文件拖进来。')}</p>
                  <UploadButton onUpload={onUpload} disabled={busy} big />
                </>
              ) : listLoading && !filtered ? (
                <>
                  <span className="tbx-res-empty-icon"><span className="tbx-spinner" /></span>
                  <h3>{tx('正在读取资料')}</h3>
                </>
              ) : (
                <>
                  <span className="tbx-res-empty-icon"><Icon name={filtered ? 'search' : deleted ? 'trash' : 'folder'} size={24} stroke={1.8} /></span>
                  <h3>{filtered ? tx('没有符合条件的资料') : deleted ? tx('没有归档的资料') : tx('这个文件夹还是空的')}</h3>
                  <p>{filtered ? tx('换个关键词，或者清除筛选再看看。') : deleted ? tx('归档的资料会放在这里，随时可以恢复。') : tx('把资料拖进来，或者上传一份。')}</p>
                  {filtered && <button type="button" className="tbx-res-chipbtn" onClick={clear}>{tx('清除筛选')}</button>}
                </>
              )}
            </div>
          )}
        </div>

        {drop && (
          <div className="tbx-res-drop" aria-hidden="true">
            <span><Icon name="upload" size={26} stroke={2} /></span>
            <strong>{tx('松开即可上传')}</strong>
            <small>{folder ? tx('放进“{{name}}”', { name: folder.name }) : tx('放进资源库')}</small>
          </div>
        )}

        {select && (
          <div className="tbx-res-selbar" role="toolbar" aria-label={tx('已选资料操作')}>
            <span className="tbx-res-selcount">{tx('已选 {{n}} 份', { n: scene.selected.length })}</span>
            <button type="button" className={cx(allPicked && 'is-on')} aria-pressed={allPicked} disabled={!shown.length} onClick={() => patchScene({ selected: allPicked ? [] : shown.slice(0, 100).map((x) => x.id) })}>
              {allPicked ? tx('取消全选') : tx('全选')}
            </button>
            <span className="tbx-res-selsep" />
            <button type="button" disabled={busy || !picked.length} onClick={() => downloadPicked()}><Icon name="arrowDown" size={15} stroke={2} />{tx('下载')}</button>
            {!deleted && <button type="button" disabled={busy || !picked.length} onClick={() => onOrganize('move')}><Icon name="folder" size={15} stroke={2} />{tx('移动')}</button>}
            {!deleted && (
              <button type="button" ref={tagButton} className={cx(tagMenu && 'is-open')} aria-haspopup="menu" aria-expanded={tagMenu} disabled={!picked.length} onClick={() => setTagMenu((o) => !o)}>
                <Icon name="tag" size={15} stroke={2} />{tx('标签')}
              </button>
            )}
            {deleted ? (
              <>
                <button type="button" disabled={busy || !picked.length} onClick={() => onOrganize('restore')}><Icon name="restore" size={15} stroke={2} />{tx('恢复')}</button>
                <button type="button" className="is-danger" disabled={busy || !picked.length} onClick={() => setPurging(true)}><Icon name="trash" size={15} stroke={2} />{tx('彻底删除')}</button>
              </>
            ) : (
              <button type="button" className="is-danger" disabled={busy || !picked.length} onClick={() => onOrganize('archive')}><Icon name="trash" size={15} stroke={2} />{tx('归档')}</button>
            )}
          </div>
        )}
        <SelectionTags
          anchor={tagButton}
          open={tagMenu && select && !deleted}
          onClose={() => setTagMenu(false)}
          picked={picked}
          tax={tax}
          busy={busy}
          onAdd={(id) => organize('add-tags', picked.filter((x) => !x.tagIds.includes(id)), { tagIds: [id] })}
          onRemove={removeTag}
          onNew={() => { setTagMenu(false); setTagDialog({ tag: null }); }}
        />
      </div>

      {/* ---------- rail: folders, tags, archive ---------- */}
      <Rail
        label={tx('资源库导航')}
        footer={<RailItem icon="trash" label={tx('已归档')} count={archived.length} current={deleted} drop={deleted ? undefined : 'archive'} onClick={() => go({ state: deleted ? 'active' : 'deleted', q: '', folderId: '', unfiled: false, mediaType: '', kinds: [], tagIds: [] })} />}
      >
        <RailSection title={tx('资源库')} count={active.length || ''}>
          <RailItem icon="grid" label={tx('全部资料')} count={active.length} current={!deleted && !scene.folderId && !unfiled} onClick={() => go({ state: 'active', folderId: '', unfiled: false })} />
        </RailSection>
        <RailSection
          title={tx('文件夹', { context: 'res' })}
          actions={onWrite && <RailAction icon="plus" label={tx('新建文件夹')} disabled={busy || deleted} onClick={() => startNew()} />}
        >
          {folderRows(null, 0)}
          {editing?.mode === 'new' && editing.parentId === null && nameField(0)}
          {/* always there, never edited: the files that sit in no folder */}
          <RailItem
            className="is-tree"
            icon={unfiled ? 'folderOpen' : 'folder'}
            label={railDrag?.kind === 'folder' ? tx('回到根目录') : tx('未分组')}
            count={active.filter((r) => !r.folderId).length}
            current={unfiled}
            drop={deleted ? undefined : 'folder:'}
            onClick={() => (unfiled ? go({ state: 'active', unfiled: false }) : go({ state: 'active', folderId: '', unfiled: true }))}
          />
        </RailSection>
        <RailSection
          title={tx('标签', { context: 'res' })}
          actions={<RailAction icon="plus" label={tx('新建标签')} disabled={busy || !onWrite} onClick={() => setTagDialog({ tag: null })} />}
        >
          {tax.tags.length === 0 && <p className="tbx-rail-empty">{tx('给资料加上标签，之后更容易找到。')}</p>}
          <div className="tbx-rail-list" ref={tagList}>
            {tax.tags.map((t, i) => (
              <div key={t.id} className={cx('tbx-rail-drag', railDrag?.item.id === t.id && 'is-origin')} onPointerDown={(e) => startRailDrag(e, 'tag', t)}>
                <RailItem
                  mark={<i className="tbx-rail-dot" style={{ '--hue': colorOf(t, i) }} />}
                  label={t.name}
                  count={tagged(t.id)}
                  current={!deleted && scene.tagIds.includes(t.id)}
                  disabled={deleted}
                  drop={deleted ? undefined : `tag:${t.id}`}
                  onClick={() => toggleTag(t.id)}
                  more={onWrite && !deleted ? { label: tx('编辑标签 {{name}}', { name: t.name }), onClick: () => setTagDialog({ tag: t }) } : null}
                />
              </div>
            ))}
            {railDrag?.kind === 'tag' && railDrag.line != null && <div className="tbx-drop-line" style={{ transform: `translateY(${railDrag.line}px)` }} aria-hidden="true" />}
          </div>
        </RailSection>
      </Rail>

      {railDrag && (
        <div className="tbx-drag-ghost" style={{ transform: `translate(${railDrag.x - railDrag.dx}px, ${railDrag.y - railDrag.dy}px)` }} aria-hidden="true">
          {railDrag.kind === 'folder'
            ? <span className="tbx-rail-icon"><Icon name="folder" size={15} stroke={2} /></span>
            : <i className="tbx-rail-dot" style={{ '--hue': colorOf(railDrag.item, tagIndex(railDrag.item.id)) }} />}
          <span>{railDrag.item.name}</span>
        </div>
      )}
      <Popover anchor={folderMenu?.anchor || { current: null }} open={Boolean(folderMenu)} onClose={() => setFolderMenu(null)} align="start" role="menu" label={tx('文件夹选项')}>
        {folderMenu && (
          <>
            <button type="button" role="menuitem" onClick={() => { const f = folderMenu.folder; setFolderMenu(null); startNew(f.id); }}><Icon name="plus" size={16} stroke={1.9} />{tx('新建子文件夹')}</button>
            <button type="button" role="menuitem" onClick={() => { const value = folderMenu; setFolderMenu(null); setFolderMove(value); }}><Icon name="folder" size={16} stroke={1.9} />{tx('移到其他文件夹')}</button>
            <button type="button" role="menuitem" onClick={() => { const f = folderMenu.folder; setFolderMenu(null); startRename(f); }}><Icon name="pencil" size={16} stroke={1.9} />{tx('重命名文件夹')}</button>
            <ConfirmMenuItem icon={<Icon name="trash" size={16} stroke={1.9} />} label={tx('删除文件夹')} confirmLabel={tx('确认删除')} onConfirm={() => deleteFolder(folderMenu.folder)} />
          </>
        )}
      </Popover>
      <Popover anchor={folderMove?.anchor || { current: null }} open={Boolean(folderMove)} onClose={() => setFolderMove(null)} align="start" role="menu" label={tx('移到其他文件夹')} className="tbx-res-folder-move">
        {folderMove && (
          <>
            <div className="tbx-popover-label">{tx('移到其他文件夹')}</div>
            <button type="button" role="menuitem" disabled={!canMoveFolder(folderMove.folder, null) || !folderMove.folder.parentId} onClick={() => moveFolder(folderMove.folder, null)}>
              <Icon name="folder" size={16} stroke={1.9} />{tx('根目录')}
              {!folderMove.folder.parentId && <span className="tbx-pop-check"><Icon name="check" size={14} stroke={2.4} /></span>}
            </button>
            {tax.folders.some((f) => !inside(folderMove.folder.id).has(f.id)) && <div className="tbx-popover-sep" />}
            {tax.folders.filter((f) => !inside(folderMove.folder.id).has(f.id)).map((f) => (
              <button key={f.id} type="button" role="menuitem" title={folderPath(f)} disabled={!canMoveFolder(folderMove.folder, f.id) || folderMove.folder.parentId === f.id} onClick={() => moveFolder(folderMove.folder, f.id)}>
                <Icon name="folder" size={16} stroke={1.9} /><span className="tbx-res-folder-path">{folderPath(f)}</span>
                {folderMove.folder.parentId === f.id && <span className="tbx-pop-check"><Icon name="check" size={14} stroke={2.4} /></span>}
              </button>
            ))}
          </>
        )}
      </Popover>
      {dragged && (
        <div className="tbx-drag-ghost is-file" style={{ transform: `translate(${drag.x - 22}px, ${drag.y - 18}px)` }} aria-hidden="true">
          <span className={cx('tbx-res-ghost-thumb', drag.ids.length > 1 && 'is-stack')}><Icon name="file" size={15} stroke={2} /></span>
          <span>{drag.ids.length > 1 ? tx('{{n}} 份资料', { n: drag.ids.length }) : dragged.title}</span>
        </div>
      )}

      {K && (
        <K.CalendarOverlay present={Boolean(tagDialog)}>
          {tagDialog && <TagDialog tag={tagDialog.tag} tax={tax} busy={busy} onWrite={onWrite} onClose={() => setTagDialog(null)} />}
        </K.CalendarOverlay>
      )}
      {purging && (
        <ConfirmDialog
          title={tx('彻底删除 {{n}} 份资料？', { n: picked.length })}
          message={tx('删除后无法恢复。')}
          confirmLabel={tx('彻底删除')}
          busy={busy}
          onCancel={() => setPurging(false)}
          onConfirm={purge}
        />
      )}
    </section>
  );
}
