import { useEffect, useRef, useState } from 'react';
import { cx } from '../../../components/ui/classNames.js';
import { tx, useLocale } from '../../../i18n/presentation.js';
import { useFlip } from '../../../components/ui/motion.js';
import { ConfirmMenuItem, ConfirmHost } from '../../../components/ui/confirm.jsx';
import { Icon } from '../../../components/icons.jsx';
import { workbenchModules as workbenchModulesAll, moduleDisplayName } from '../../modules/moduleRegistry.js';
import { groupDisplayName } from './displayNames.js';
import { followAnchor } from '../routes.js';
import { modulePath, withSearch, HOME_PATH } from './routes.js';
import { SUPPORT_MENU_ITEMS } from './SupportMenu.jsx';
import SidebarHead from './SidebarHead.jsx';
import NavigationStatus from './NavigationStatus.jsx';
export { useLayoutModel } from './useLayoutModel.js';

/*
 * The navigation panel, rebuilt.
 *
 * Data and every operation still come from the app's own layout model
 * (groups, moving, hiding, restoring); this file owns only how it looks and
 * how it moves:
 *   - groups read as quiet sections, like a Finder sidebar
 *   - collapsing to the rail folds the account details, the semester and the
 *     section headings upward while the module icons glide up to their rail
 *     positions; nothing jumps sideways
 *   - dragging is pointer-driven: a compact, translucent copy of the row
 *     follows the pointer; nothing else moves. A blue line with a small ring
 *     marks where it will land; the rows glide into place only after the drop
 *   - folding a group is a pure CSS height transition (no FLIP), so nothing
 *     pops in before it slides
 *   - the bin is a full-width row that opens downward in place
 */

const tw = tx;
const DRAG_SLOP = 5;
const TOUCH_HOLD = 320;

function Glyph({ name, size = 20 }) {
  return <Icon name={name} size={size} strokeWidth={1.75} />;
}

function useModules() {
  const list = workbenchModulesAll.filter((m) => m.navigation === 'sidebar');
  return { list, byId: (id) => list.find((m) => m.id === id) };
}

function GroupMenu({ at, onRename, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const down = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('.tbx-group-more')) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);
  return (
    <div className="tbx-side-menu" role="menu" ref={ref} style={{ left: at.x, top: at.y }}>
      <button type="button" role="menuitem" className="tbx-mi" onClick={onRename}><Glyph name="pencil" size={16} />{tw('重命名分组')}</button>
      <ConfirmMenuItem className="tbx-mi" icon={<Glyph name="close" size={16} />} label={tw('解散分组')} confirmLabel={tw('确认解散')} onConfirm={onDelete} />
    </div>
  );
}

export default function Sidebar({
  modulePaths = {}, model, routePath, onNavigate, mobileOpen, onCloseMobile, isNarrow, railCollapsed, onExpand,
  openSurface, onToggleSurface, onOpenSurface, onCloseSurface, accountName,
}) {
  useLocale();
  const modules = useModules();
  const editable = model.navigation.editable;
  const hiddenIds = model.layout.hiddenModuleIds;
  const hidden = new Set(hiddenIds);

  const [drag, setDrag] = useState(null); // { type, id, from, x, y, dx, dy, w, h }
  const [target, setTarget] = useState(null); // { kind: 'slot', groupId, index } | { kind: 'group', index } | { kind: 'trash' }
  const [line, setLine] = useState(null); // where the drop line sits, in the list's own coordinates
  const dragRef = useRef(null);
  const targetRef = useRef(null);
  const suppressClick = useRef(false);
  const navRef = useRef(null);
  const trashRef = useRef(null);
  const holdTimer = useRef(0);
  const expandTimer = useRef({ id: null, timer: 0 });
  const handlers = useRef(null);
  const stable = useRef({
    move: (e) => handlers.current?.onMove(e),
    up: (e) => handlers.current?.onUp(e),
    cancel: (e) => handlers.current?.onCancel(e),
  });

  const [trashOpen, setTrashOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [nameError, setNameError] = useState('');
  const [menu, setMenu] = useState(null);
  const [tip, setTip] = useState(null);
  const [mobileSupport, setMobileSupport] = useState(false);

  useEffect(() => { setTip(null); }, [railCollapsed, routePath]);

  function moduleHref(id) {
    const path = modulePath(id);
    const remembered = modulePaths[id];
    return remembered && (remembered === path || remembered.startsWith(path + '/') || remembered.startsWith(path + '?')) ? remembered : path;
  }

  /* ----- the layout ----- */
  const groups = model.layout.groups.map((g) => ({ ...g, visible: g.moduleIds.filter((id) => !hidden.has(id) && modules.byId(id)) }));
  const baseGroups = groups;
  const moduleDrag = drag?.type === 'module' && drag.active ? drag : null;
  // Rows glide only after an order change we started (capture() before the
  // model call). Folding a group is left entirely to its CSS transition.
  const flipRef = useFlip(null);
  const act = (fn) => { flipRef.capture(); return fn(); };

  /* ----- group names: no blanks, no duplicates, never the reserved "Ungrouped" ----- */
  const norm = (v) => String(v || '').normalize('NFKC').trim().toLowerCase();
  function nameProblem(name, selfId) {
    const n = norm(name);
    if (!n) return null;
    const reserved = [tw('未分组'), '未分组', 'ungrouped'].map(norm);
    if (reserved.includes(n)) return tw('“{{name}}”是系统保留的名称，换一个吧', { name: name.trim() });
    if (baseGroups.some((g) => g.id !== selfId && norm(groupDisplayName(g)) === n)) return tw('已经有叫“{{name}}”的分组了', { name: name.trim() });
    return null;
  }

  /* ----- pointer-driven drag ----- */
  function beginPress(e, payload) {
    if (!editable || isNarrow || e.button > 0) return;
    if (e.target.closest('input, .tbx-group-more, .tbx-trash-restore')) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    // The floating copy is only as wide as icon + label, so the pointer keeps
    // hold of it near the start even if the row was grabbed on its far side.
    let compact = r.width;
    const label = el.querySelector('.tbx-row-label, .tbx-group-name');
    if (label?.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      compact = Math.min(r.width, Math.max(text.right - r.left + 14, 80));
    }
    const press = {
      ...payload,
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      dx: Math.min(e.clientX - r.left, compact - 16),
      dy: e.clientY - r.top,
      w: r.width,
      h: r.height,
      active: false,
      touch: e.pointerType !== 'mouse',
      ready: e.pointerType === 'mouse',
    };
    dragRef.current = press;
    if (press.touch) {
      clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(() => {
        if (dragRef.current === press) { press.ready = true; activate(e.clientX, e.clientY); }
      }, TOUCH_HOLD);
    }
    window.addEventListener('pointermove', stable.current.move, { passive: false });
    window.addEventListener('pointerup', stable.current.up);
    window.addEventListener('pointercancel', stable.current.cancel);
  }
  function activate(x, y) {
    const d = dragRef.current;
    if (!d || d.active) return;
    d.active = true;
    suppressClick.current = true;
    document.documentElement.classList.add('tbx-dragging');
    d.origin = originOf(d);
    setDrag({ ...d, x, y });
    // "Ungrouped" may appear as a drop target; measure after it has rendered
    requestAnimationFrame(() => track(x, y));
  }
  function originOf(d) {
    if (d.type === 'group') {
      const movable = baseGroups.filter((g) => !g.fixed);
      return { index: Math.max(0, movable.findIndex((g) => g.id === d.id)) };
    }
    if (d.from === 'trash') return null;
    const g = baseGroups.find((x) => x.visible.includes(d.id));
    return g ? { groupId: g.id, index: g.visible.indexOf(d.id) } : null;
  }
  function onMove(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      const far = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > DRAG_SLOP;
      if (d.touch && !d.ready) { if (far) cleanup(); return; }
      if (!far) return;
      activate(e.clientX, e.clientY);
      return;
    }
    e.preventDefault();
    setDrag((cur) => (cur ? { ...cur, x: e.clientX, y: e.clientY } : cur));
    track(e.clientX, e.clientY);
  }
  function track(x, y) {
    const d = dragRef.current;
    if (!d?.active) return;
    const next = hitTest(d, x, y);
    if (next === undefined) return;
    if (JSON.stringify(next) !== JSON.stringify(targetRef.current)) {
      targetRef.current = next;
      setTarget(next);
    }
    const l = lineFor(d, next);
    setLine((cur) => (cur?.top === l?.top ? cur : l));
  }
  // Where an element sits in the list, ignoring transforms in flight.
  function box(el) {
    const nav = navRef.current;
    let top = 0;
    let n = el;
    while (n && n !== nav) { top += n.offsetTop; n = n.offsetParent; }
    if (n !== nav) return el.getBoundingClientRect();
    const t = nav.getBoundingClientRect().top + nav.clientTop - nav.scrollTop + top;
    return { top: t, bottom: t + el.offsetHeight, height: el.offsetHeight };
  }
  function hitTest(d, x, y) {
    const trash = trashRef.current?.getBoundingClientRect();
    if (trash && y >= trash.top - 6 && y <= trash.bottom + 6 && x >= trash.left - 40 && x <= trash.right + 60) return { kind: 'trash' };
    const nav = navRef.current?.getBoundingClientRect();
    if (!nav || x < nav.left - 60 || x > nav.right + 80) return undefined;
    const sections = [...navRef.current.querySelectorAll('[data-group]')];
    if (!sections.length) return undefined;
    if (d.type === 'group') {
      const movable = sections.filter((s) => s.dataset.fixed !== 'true' && s.dataset.group !== d.id);
      let index = 0;
      for (const s of movable) {
        const r = box(s);
        if (y > r.top + Math.min(r.height, 40) / 2) index += 1;
      }
      return { kind: 'group', index };
    }
    let i = sections.length - 1;
    for (let k = 0; k < sections.length; k += 1) {
      if (y < box(sections[k]).bottom) { i = k; break; }
    }
    const section = sections[i];
    const head = section.querySelector('.tbx-group-head');
    if (head && i > 0) {
      const h = box(head);
      // the upper half of a heading still belongs to the end of the group above
      if (y < h.top + h.height / 2) {
        const prev = baseGroups.find((g) => g.id === sections[i - 1].dataset.group);
        if (prev && !prev.collapsed) {
          armExpand(null);
          return { kind: 'slot', groupId: prev.id, index: prev.visible.filter((id) => id !== d.id).length };
        }
      }
    }
    const groupId = section.dataset.group;
    const g = baseGroups.find((x) => x.id === groupId);
    if (!g) return undefined;
    if (g.collapsed) {
      armExpand(groupId);
      return { kind: 'slot', groupId, index: g.visible.filter((id) => id !== d.id).length };
    }
    armExpand(null);
    const rows = [...section.querySelectorAll('[data-row]')].filter((r) => r.dataset.row !== d.id);
    let index = 0;
    for (const r of rows) {
      const b = box(r);
      if (y > b.top + b.height / 2) index += 1;
    }
    return { kind: 'slot', groupId, index };
  }
  // The drop line: a short blue rule with a ring at its start, between rows.
  function lineFor(d, to) {
    const nav = navRef.current;
    if (!nav || !to || to.kind === 'trash') return null;
    const origin = nav.getBoundingClientRect().top + nav.clientTop - nav.scrollTop;
    let y = null;
    if (to.kind === 'group') {
      if (d.origin && to.index === d.origin.index) return null;
      const movable = [...nav.querySelectorAll('[data-group]')].filter((s) => s.dataset.fixed !== 'true' && s.dataset.group !== d.id);
      if (to.index < movable.length) y = box(movable[to.index]).top - 2;
      else {
        const fixed = nav.querySelector('[data-group][data-fixed="true"]');
        y = fixed ? box(fixed).top - 2 : movable.length ? box(movable[movable.length - 1]).bottom + 2 : null;
      }
    } else {
      const o = d.origin;
      if (o && d.from !== 'trash' && o.groupId === to.groupId && o.index === to.index) return null;
      const section = [...nav.querySelectorAll('[data-group]')].find((s) => s.dataset.group === to.groupId);
      if (!section) return null;
      if (section.classList.contains('is-collapsed')) {
        const head = section.querySelector('.tbx-group-head');
        y = head ? box(head).bottom + 1 : box(section).top;
      } else {
        const rows = [...section.querySelectorAll('[data-row]')].filter((r) => r.dataset.row !== d.id);
        if (!rows.length) return null; // an empty group lights up its own drop area instead
        y = to.index < rows.length ? box(rows[to.index]).top - 1 : box(rows[rows.length - 1]).bottom + 1;
      }
    }
    return y == null ? null : { top: Math.round(y - origin) };
  }
  // Hovering a folded section while dragging opens it after a beat.
  function armExpand(groupId) {
    const cur = expandTimer.current;
    if (cur.id === groupId) return;
    clearTimeout(cur.timer);
    expandTimer.current = { id: groupId, timer: groupId ? setTimeout(() => model.toggleGroup(groupId), 650) : 0 };
  }
  function onUp(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.active) commit(d, targetRef.current);
    cleanup();
  }
  function onCancel() { cleanup(); }
  function cleanup() {
    clearTimeout(holdTimer.current);
    armExpand(null);
    dragRef.current = null;
    targetRef.current = null;
    setDrag(null);
    setTarget(null);
    setLine(null);
    document.documentElement.classList.remove('tbx-dragging');
    window.removeEventListener('pointermove', stable.current.move);
    window.removeEventListener('pointerup', stable.current.up);
    window.removeEventListener('pointercancel', stable.current.cancel);
    setTimeout(() => { suppressClick.current = false; }, 0);
  }
  function commit(d, to) {
    if (!to) return;
    if (to.kind === 'trash') {
      if (d.type === 'module' && d.from !== 'trash') act(() => model.hideModule(d.id));
      if (d.type === 'group') act(() => model.hideGroup(d.id));
      return;
    }
    if (d.type === 'group' && to.kind === 'group') {
      if (d.origin && to.index === d.origin.index) return;
      const order = baseGroups.filter((g) => !g.fixed && g.id !== d.id);
      const before = order[to.index]?.id ?? baseGroups.find((g) => g.fixed)?.id;
      if (before && before !== d.id) act(() => model.moveGroup(d.id, before));
      return;
    }
    if (d.type === 'module' && to.kind === 'slot') {
      const g = baseGroups.find((x) => x.id === to.groupId);
      const list = g.visible.filter((id) => id !== d.id);
      const o = d.origin;
      if (o && o.groupId === to.groupId && o.index === to.index && d.from !== 'trash') return;
      act(() => {
        if (to.index < list.length) model.moveModule(d.id, to.groupId, list[to.index], 'before');
        else if (list.length) model.moveModule(d.id, to.groupId, list[list.length - 1], 'after');
        else model.moveModule(d.id, to.groupId, null, 'after');
      });
    }
  }
  // Window listeners are stable wrappers around the latest closures.
  handlers.current = { onMove, onUp, onCancel, cleanup };
  useEffect(() => () => handlers.current.cleanup(), []);

  /* ----- rail tooltips ----- */
  function showTip(e, label) {
    if (!railCollapsed || drag) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, left: r.right + 12, top: r.top + r.height / 2 });
  }

  function handleRowKey(e, id) {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act(() => model.hideModule(id)); return; }
    if (!e.altKey) return;
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
    if (dir) { e.preventDefault(); act(() => model.moveModuleByKeyboard(id, dir)); }
  }

  function createGroup() {
    const problem = nameProblem(draftName);
    if (problem) { setNameError(problem); return; }
    if (act(() => model.createGroup(draftName))) { setDraftName(''); setAdding(false); setNameError(''); }
  }
  function startRename(g) { setRenaming(g.id); setRenameDraft(groupDisplayName(g)); setNameError(''); }
  function commitRename(groupId, { leaving = false } = {}) {
    const problem = nameProblem(renameDraft, groupId);
    if (problem) {
      if (leaving) { setRenaming(null); setNameError(''); } else setNameError(problem);
      return;
    }
    if (model.renameGroup(groupId, renameDraft) || leaving) { setRenaming(null); setNameError(''); }
  }
  function toggle(g) {
    if (suppressClick.current || renaming === g.id) return;
    model.toggleGroup(g.id);
  }

  const isGroupDragging = drag?.active && drag.type === 'group';
  const showFixedWhenEmpty = drag?.active && drag.type === 'module';

  const row = (id, groupId) => {
    const m = modules.byId(id);
    if (!m) return null;
    const label = moduleDisplayName(m);
    const active = modulePath(id) === routePath;
    const origin = moduleDrag && moduleDrag.id === id;
    return (
      <a
        key={id}
        ref={flipRef(`m:${id}`)}
        href={moduleHref(id)}
        className={cx('tbx-row', active && 'is-active', origin && 'is-origin')}
        data-row={id}
        data-label={label}
        data-module={id}
        draggable={false}
        aria-current={active ? 'page' : undefined}
        aria-label={`${label}。${tw('可拖动排序；Alt 加方向键移动；Delete 移到垃圾桶')}`}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={(e) => beginPress(e, { type: 'module', id, from: 'nav', groupId })}
        onPointerEnter={(e) => showTip(e, label)}
        onPointerLeave={() => setTip(null)}
        onFocus={(e) => showTip(e, label)}
        onBlur={() => setTip(null)}
        onKeyDown={(e) => handleRowKey(e, id)}
        onClick={(e) => {
          if (suppressClick.current) { e.preventDefault(); return; }
          followAnchor(e, moduleHref(id));
          onNavigate();
        }}
      >
        <span className="tbx-row-icon"><Glyph name={m.icon} /></span>
        <span className="tbx-row-label">{label}</span>
      </a>
    );
  };

  return (
    <>
      <button
        hidden={!mobileOpen}
        aria-hidden={!mobileOpen}
        className={cx('tb-mobile-scrim', mobileOpen && 'is-visible')}
        aria-label={tw('关闭工作台导航')}
        onClick={onCloseMobile}
      />
      <aside
        className={cx('tb-sidebar tbx-side', mobileOpen && 'is-mobile-open', railCollapsed && 'is-rail-collapsed', drag?.active && 'is-dragging')}
        aria-label={tw('工作台导航')}
        aria-hidden={isNarrow && !mobileOpen ? true : undefined}
        inert={isNarrow && !mobileOpen}
      >
        {isNarrow && (
          <div className="tbx-side-mobile-head">
            <strong>TeachBuddy</strong>
            <button type="button" onClick={onCloseMobile} aria-label={tw('关闭')}><Glyph name="close" size={18} /></button>
          </div>
        )}

        <div className="tbx-side-head">
          <SidebarHead
            accountName={accountName}
            onAnnounce={model.announce}
            openSurface={openSurface}
            onToggleSurface={onToggleSurface}
            onOpenSurface={onOpenSurface}
            onCloseSurface={onCloseSurface}
            visible={isNarrow ? mobileOpen : !railCollapsed}
          />
        </div>

        {isNarrow && (
          <nav className="tbx-side-mobile-nav" aria-label={tw('全局导航')}>
            <a className={cx('tbx-row', routePath === HOME_PATH && 'is-active')} href={withSearch(HOME_PATH)} aria-current={routePath === HOME_PATH ? 'page' : undefined} onClick={(e) => { followAnchor(e, HOME_PATH); onCloseMobile(); }}>
              <span className="tbx-row-icon"><Glyph name="home" /></span>
              <span className="tbx-row-label">{tw('首页')}</span>
            </a>
            {workbenchModulesAll.filter((m) => m.navigation === 'top').map((m) => (
              <a key={m.id} className={cx('tbx-row', routePath === m.path && 'is-active')} href={m.path} aria-current={routePath === m.path ? 'page' : undefined} onClick={(e) => { followAnchor(e, m.path); onCloseMobile(); }}>
                <span className="tbx-row-icon"><Glyph name={m.icon || 'calendar'} /></span>
                <span className="tbx-row-label">{moduleDisplayName(m)}</span>
              </a>
            ))}
            <button type="button" className="tbx-row" aria-expanded={mobileSupport} onClick={() => setMobileSupport((v) => !v)}>
              <span className="tbx-row-icon"><Glyph name="circleHelp" /></span>
              <span className="tbx-row-label">{tw('支持')}</span>
              <span className={cx('tbx-chevron', mobileSupport && 'is-open')}><Glyph name="chevron" size={16} /></span>
            </button>
            {mobileSupport && SUPPORT_MENU_ITEMS.map((item) => (
              <a key={item.label} className={cx('tbx-row is-sub', routePath === item.route && 'is-active')} href={withSearch(item.route)} onClick={(e) => { followAnchor(e, item.route); onCloseMobile(); }}>
                <span className="tbx-row-icon"><Glyph name={item.icon} size={18} /></span>
                <span className="tbx-row-label">{tw(item.label)}</span>
              </a>
            ))}
          </nav>
        )}

        <NavigationStatus navigation={model.navigation} railCollapsed={railCollapsed} onExpand={onExpand} />

        <nav className={cx('tbx-side-nav', isGroupDragging && 'is-group-drag')} aria-label={tw('功能模块')} ref={navRef}>
          {groups.map((g) => {
            const empty = g.visible.length === 0;
            // "Ungrouped" shows whenever it holds modules, and as a drop target while dragging
            if (g.fixed && empty && !showFixedWhenEmpty) return null;
            const isTarget = target?.kind === 'slot' && target.groupId === g.id;
            const lifted = isGroupDragging && drag.id === g.id;
            const name = groupDisplayName(g);
            const editing = renaming === g.id;
            return (
              <section
                key={g.id}
                ref={flipRef(`g:${g.id}`)}
                className={cx('tbx-group', g.collapsed && 'is-collapsed', isTarget && 'is-target', lifted && 'is-lifted', empty && 'is-empty')}
                data-group={g.id}
                data-fixed={g.fixed ? 'true' : 'false'}
              >
                <div className="tbx-fold tbx-group-fold">
                  <div>
                    <div
                      className={cx('tbx-group-head', editing && 'is-editing')}
                      role="button"
                      tabIndex={editing ? -1 : 0}
                      aria-expanded={!g.collapsed}
                      aria-label={name}
                      onPointerDown={g.fixed || editing ? undefined : (e) => beginPress(e, { type: 'group', id: g.id })}
                      onClick={(e) => { if (!e.target.closest('.tbx-group-more, input')) toggle(g); }}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(g); }
                      }}
                      onContextMenu={(e) => {
                        if (g.fixed || !editable) return;
                        e.preventDefault();
                        setMenu({ group: g, at: { x: Math.min(e.clientX, innerWidth - 220), y: Math.min(e.clientY, innerHeight - 110) } });
                      }}
                    >
                      {editing ? (
                        <input
                          autoFocus
                          className="tbx-group-rename"
                          maxLength={80}
                          value={renameDraft}
                          aria-label={tw('重命名分组')}
                          aria-invalid={nameError ? true : undefined}
                          onChange={(e) => { setRenameDraft(e.target.value); setNameError(''); }}
                          onBlur={() => commitRename(g.id, { leaving: true })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(g.id);
                            if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); setNameError(''); }
                          }}
                        />
                      ) : (
                        <span className="tbx-group-title">
                          <span className="tbx-group-name">{name}</span>
                          <span className="tbx-chevron"><Glyph name="chevron" size={14} /></span>
                        </span>
                      )}
                      {!g.fixed && editable && !editing && (
                        <button
                          type="button"
                          className="tbx-group-more"
                          aria-label={tw('分组选项')}
                          onClick={(e) => {
                            e.stopPropagation();
                            const r = e.currentTarget.getBoundingClientRect();
                            setMenu((m) => (m?.group.id === g.id ? null : { group: g, at: { x: r.right + 6, y: r.top } }));
                          }}
                        >
                          <Glyph name="more" size={16} />
                        </button>
                      )}
                    </div>
                    {editing && nameError && <p className="tbx-name-error" role="alert">{nameError}</p>}
                  </div>
                </div>
                <div className="tbx-group-body">
                  <div className="tbx-group-rows">
                    {g.visible.map((id) => row(id, g.id))}
                    {empty && (showFixedWhenEmpty
                      ? <div className={cx('tbx-drop-hint', isTarget && 'is-on')}>{tw('放到这里')}</div>
                      : !g.fixed && <div className="tbx-fold tbx-hint-fold"><div className="tbx-drop-hint is-idle">{tw('把模块拖到这里')}</div></div>)}
                  </div>
                </div>
              </section>
            );
          })}
          {line && <div className="tbx-drop-line" style={{ transform: `translateY(${line.top}px)` }} aria-hidden="true" />}

          <div className="tbx-fold tbx-new-group-fold" ref={flipRef('new-group')}>
            <div>
              {adding ? (
                <form className={cx('tbx-new-group', nameError && 'is-invalid')} onSubmit={(e) => { e.preventDefault(); createGroup(); }}>
                  <Glyph name="folder" size={18} />
                  <input
                    autoFocus
                    value={draftName}
                    maxLength={80}
                    placeholder={tw('分组名称')}
                    aria-label={tw('新分组名称')}
                    aria-invalid={nameError ? true : undefined}
                    onChange={(e) => { setDraftName(e.target.value); setNameError(''); }}
                    onBlur={() => { if (!draftName.trim() || nameError) { setDraftName(''); setAdding(false); setNameError(''); } }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setDraftName(''); setAdding(false); setNameError(''); } }}
                  />
                </form>
              ) : (
                <button type="button" className="tbx-new-group-button" disabled={!editable} onClick={() => { setAdding(true); setNameError(''); }}>
                  <Glyph name="plus" size={16} />
                  <span>{tw('新建分组')}</span>
                </button>
              )}
              {adding && nameError && <p className="tbx-name-error" role="alert">{nameError}</p>}
            </div>
          </div>
        </nav>

        <div className={cx('tbx-side-foot', trashOpen && 'is-open')}>
          <button
            type="button"
            ref={trashRef}
            className={cx('tbx-row tbx-trash', target?.kind === 'trash' && 'is-drop', drag?.active && 'is-armed')}
            aria-expanded={trashOpen}
            data-label={tw('垃圾桶')}
            onPointerEnter={(e) => showTip(e, hiddenIds.length ? `${tw('垃圾桶')} · ${hiddenIds.length}` : tw('垃圾桶'))}
            onPointerLeave={() => setTip(null)}
            onClick={() => { if (railCollapsed) onExpand(); setTrashOpen((v) => (railCollapsed ? true : !v)); }}
          >
            <span className="tbx-row-icon"><Glyph name="trash" /></span>
            <span className="tbx-row-label">{target?.kind === 'trash' ? tw('松开，移到垃圾桶') : tw('垃圾桶')}</span>
            {hiddenIds.length > 0 && <span className="tbx-count">{hiddenIds.length}</span>}
            <span className="tbx-chevron"><Glyph name="chevron" size={14} /></span>
          </button>
          <div className="tbx-trash-drawer">
            <div className="tbx-trash-list">
              {hiddenIds.length === 0 && <p className="tbx-trash-empty">{tw('垃圾桶是空的。把不常用的模块拖到这里，界面会更清爽。')}</p>}
              {hiddenIds.map((id) => {
                const m = modules.byId(id);
                if (!m) return null;
                return (
                  <div
                    key={id}
                    className={cx('tbx-trash-item', drag?.active && drag.id === id && 'is-lifted')}
                    onPointerDown={(e) => beginPress(e, { type: 'module', id, from: 'trash' })}
                  >
                    <span className="tbx-row-icon"><Glyph name={m.icon} size={18} /></span>
                    <span className="tbx-row-label">{moduleDisplayName(m)}</span>
                    <button type="button" className="tbx-trash-restore" onClick={() => act(() => model.restoreModule(id))} aria-label={`${tw('恢复')} ${moduleDisplayName(m)}`}>
                      <Glyph name="restore" size={15} />{tw('恢复')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {drag?.active && (
        <div
          className={cx('tbx-drag-ghost', drag.type === 'group' && 'is-group', target?.kind === 'trash' && 'is-trash')}
          style={{ transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px)` }}
          aria-hidden="true"
        >
          {drag.type === 'module' ? (
            <>
              <span className="tbx-row-icon"><Glyph name={modules.byId(drag.id)?.icon} /></span>
              <span>{moduleDisplayName(modules.byId(drag.id))}</span>
            </>
          ) : (
            <>
              <span className="tbx-row-icon"><Glyph name="folder" size={18} /></span>
              <span>{groupDisplayName(baseGroups.find((g) => g.id === drag.id) || {})}</span>
            </>
          )}
        </div>
      )}
      {menu && (
        <GroupMenu
          at={menu.at}
          onClose={() => setMenu(null)}
          onRename={() => { startRename(menu.group); setMenu(null); }}
          onDelete={() => { act(() => model.deleteGroup(menu.group.id)); setMenu(null); }}
        />
      )}
      <ConfirmHost />
      {railCollapsed && tip && <span className="tb-rail-tooltip tbx-tip" role="tooltip" style={{ left: tip.left, top: tip.top }}>{tip.label}</span>}
    </>
  );
}
