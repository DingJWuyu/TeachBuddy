import { executeOperation } from './operations.js';
import { GeoGebraError } from './controller.js';
import { workshopPerspective, workshopToolMode, savedWorkshopPlaneViewport, captureWorkshopPlaneViewport, fitWorkshopPlaneViewport } from '../../../../../../packages/shared/src/math/workshop-runtime.js';

let loaderPromise;
let nextId = 0;
function localLoader() {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = '/vendor/math/geogebra/loader.js'; script.async = true;
    const timer = setTimeout(() => finish(new GeoGebraError('load', '本地数学引擎加载超时，请重试。')), 30000);
    function finish(error) {
      clearTimeout(timer); script.onload = script.onerror = null;
      if (error) { script.remove(); loaderPromise = undefined; reject(error); }
      else resolve(window.GGBApplet);
    }
    script.onload = () => finish(window.GGBApplet ? null : new GeoGebraError('load', '本地数学引擎未提供启动接口。'));
    script.onerror = () => finish(new GeoGebraError('load', '本地数学引擎资源缺失，请重试。'));
    document.head.append(script);
  });
  return loaderPromise;
}
export function readWorkshopObjects(api) {
  return Array.from(api.getAllObjectNames()).map(name => {
    const type = api.getObjectType(name);
    const xml = new DOMParser().parseFromString(api.getXML(name), 'application/xml');
    const slider = xml.querySelector('slider');
    const object = {
      name, type, definition: String(api.getDefinitionString(name)), command: String(api.getCommandString(name, false)),
      value: String(api.getValueString(name, false)), defined: api.isDefined(name), independent: api.isIndependent(name),
      movable: api.isMoveable(name), visible: api.getVisible(name), color: api.getColor(name),
      lineThickness: api.getLineThickness(name), lineStyle: api.getLineStyle(name),
      labelVisible: api.getLabelVisible(name), labelStyle: api.getLabelStyle(name), caption: String(api.getCaption(name, false)),
      slider: slider ? { min: slider.getAttribute('min'), max: slider.getAttribute('max'), step: xml.querySelector('animation')?.getAttribute('step') ?? null } : null,
    };
    if (['numeric', 'angle', 'boolean'].includes(type)) object.numericValue = api.isDefined(name) ? api.getValue(name) : null;
    if (['point', 'vector'].includes(type)) object.coords = [api.getXcoord(name), api.getYcoord(name), api.getZcoord(name)];
    if (type === 'point') object.pointSize = api.getPointSize(name);
    return object;
  });
}
/** Private GGB seam. WorkshopEditor alone owns content revisions and history. */
export async function mountWorkshopGraph(container, { base64 = '', view = 'plane', language = 'zh-CN', signal, onChange, onSelect, onBeforeLayout, onLayout, onError } = {}) {
  const GGBApplet = await localLoader();
  if (signal?.aborted) throw new DOMException('编辑器已关闭。', 'AbortError');
  const lifetime = new AbortController();
  const host = document.createElement('div'); host.id = `teacher_workshop_${++nextId}`;
  host.style.cssText = 'width:100%;height:100%;min-height:200px'; container.replaceChildren(host);
  let disposed = false, muted = 0, api, observer;
  let planeViewport = null, spaceViewport = null, layoutPending = false, pendingFingerprint = '', layoutEpoch = 0;
  let layoutPromise = Promise.resolve(), size = { width: 0, height: 0 };
  const listeners = [];
  const externalAbort = () => destroy();
  signal?.addEventListener('abort', externalAbort, { once: true });
  function assertLive() { if (disposed || signal?.aborted) throw new GeoGebraError('disposed', '编辑器已关闭。'); }
  const documentXML = () => new DOMParser().parseFromString(api.getXML(), 'application/xml');
  function fingerprint() {
    assertLive();
    if (layoutPending) return pendingFingerprint;
    const xml = documentXML();
    xml.querySelectorAll('gui, euclidianView > size, euclidianView3D > size').forEach(node => node.remove());
    return new XMLSerializer().serializeToString(xml);
  }
  function captureSpaceViewport() {
    // getViewProperties only supports 2D. Native Corner reads 3D dimensions
    // without introducing a construction object or a second camera model.
    const scale = Number(documentXML().querySelector('euclidianView3D > coordSystem')?.getAttribute('scale'));
    const width = api.getValue('x(Corner(-1,9))'), height = api.getValue('y(Corner(-1,9))');
    return width > 0 && height > 0 && scale > 0 ? { width, height, scale } : null;
  }
  function savedViewports(content) {
    planeViewport = spaceViewport = null;
    if (!content) return;
    // The pinned local GGB runtime already exposes its ZIP implementation.
    const files = window.fflate.unzipSync(Uint8Array.from(atob(content), char => char.charCodeAt(0)), { filter: entry => entry.name === 'geogebra.xml' });
    const xml = new DOMParser().parseFromString(window.fflate.strFromU8(files['geogebra.xml']), 'application/xml');
    planeViewport = savedWorkshopPlaneViewport(xml);
    const space = xml.querySelector('gui view[id="512"]'), plane = xml.querySelector('gui view[id="1"]');
    const windowSize = xml.querySelector('gui > window'), pane = xml.querySelector('gui pane');
    const scale = Number(xml.querySelector('euclidianView3D > coordSystem')?.getAttribute('scale'));
    const vertical = pane ? pane.getAttribute('orientation') === '0' : space?.getAttribute('location') === '2';
    const split = plane?.getAttribute('visible') === 'true' && space?.getAttribute('visible') === 'true';
    const alone = space?.getAttribute('visible') === 'true' && !split;
    const width = alone ? Number(windowSize?.getAttribute('width')) : !vertical ? Number(space?.getAttribute('size')) : planeViewport?.width;
    const height = alone ? Number(windowSize?.getAttribute('height')) - 2 : vertical ? Number(space?.getAttribute('size')) : planeViewport?.height;
    if (width > 0 && height > 0 && scale > 0) spaceViewport = { width, height, scale };
  }
  async function waitForLayout(nextView, vertical, epoch) {
    const deadline = performance.now() + 3000;
    let previous = '', stable = 0;
    while (true) {
      await new Promise(resolve => requestAnimationFrame(resolve)); assertLive();
      if (epoch !== layoutEpoch) return;
      const bounds = host.getBoundingClientRect();
      const boxes = Array.from(host.querySelectorAll('canvas'), canvas => canvas.getBoundingClientRect()).filter(box => box.width > 1 && box.height > 1);
      const inside = boxes.every(box => box.left >= bounds.left - 2 && box.top >= bounds.top - 2 && box.right <= bounds.right + 2 && box.bottom <= bounds.bottom + 2);
      const aligned = boxes.length === (nextView === 'split' ? 2 : 1) && (nextView !== 'split' || Math.abs(vertical ? boxes[0].left - boxes[1].left : boxes[0].top - boxes[1].top) < 2);
      const signature = boxes.map(box => [box.x, box.y, box.width, box.height].map(Math.round).join(',')).join(';');
      stable = inside && aligned && signature === previous ? stable + 1 : 0; previous = signature;
      if (stable >= 2) return;
      if (performance.now() > deadline) throw new GeoGebraError('layout', '数学视图未完成布局，请重新打开作品。');
    }
  }
  async function fitSpaceViewport(epoch) {
    const actual = captureSpaceViewport();
    if (!spaceViewport) { spaceViewport = actual; return; }
    if (!actual) return;
    const target = spaceViewport.scale * Math.min(actual.width / spaceViewport.width, actual.height / spaceViewport.height);
    if (Math.abs(target - actual.scale) < 1e-7) return;
    api.evalCommand('SetActiveView(-1)');
    api.evalCommand(`ZoomIn(${target / actual.scale})`);
    // Native 3D ZoomIn animates. Finish against the actual scale, never a sleep.
    const deadline = performance.now() + 3000;
    while (true) {
      await new Promise(resolve => requestAnimationFrame(resolve)); assertLive();
      if (epoch !== layoutEpoch) return;
      const scale = Number(documentXML().querySelector('euclidianView3D > coordSystem')?.getAttribute('scale'));
      if (Math.abs(scale - target) < 1e-7) break;
      if (performance.now() > deadline) throw new GeoGebraError('layout', '三维视图未完成缩放，请重新打开作品。');
    }
    if (view !== 'space') api.evalCommand('SetActiveView(1)');
  }
  function layout(nextView, width, height) {
    if (!layoutPending) {
      onBeforeLayout?.(); pendingFingerprint = fingerprint();
      layoutPending = true; muted++; host.inert = true;
    }
    const epoch = ++layoutEpoch;
    size = { width, height };
    const preceding = layoutPromise;
    layoutPromise = preceding.catch(() => {}).then(async () => {
      if (disposed || epoch !== layoutEpoch) return;
      const vertical = nextView === 'split' && width < 600;
      api.setSize(width, height);
      api.setPerspective(vertical ? 'G/T' : workshopPerspective(nextView));
      api.showToolBar(false); api.showMenuBar(false); api.showAlgebraInput(false);
      await waitForLayout(nextView, vertical, epoch);
      if (epoch !== layoutEpoch) return;
      if (nextView !== 'space') planeViewport = fitWorkshopPlaneViewport(api, planeViewport);
      if (nextView !== 'plane') await fitSpaceViewport(epoch);
      // Repaint emits view-change events after native coordinates reach their
      // target. Keep those layout events out of manual edit synchronization.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      assertLive();
    }).finally(() => {
      if (epoch === layoutEpoch) {
        layoutPending = false; muted--; host.inert = false;
        if (!disposed) onLayout?.();
      }
    });
    return layoutPromise;
  }
  async function settleLayout() {
    let pending;
    do { pending = layoutPromise; await pending; assertLive(); } while (pending !== layoutPromise);
  }
  function callback(invoke, message, timeout = 20000) {
    assertLive();
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => finish(new GeoGebraError('file', message)), timeout);
      const abort = () => finish(new DOMException('编辑器已关闭。', 'AbortError'));
      function finish(error, value) {
        if (done) { if (value?.remove) value.remove(); return; } done = true;
        clearTimeout(timer); lifetime.signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value);
      }
      lifetime.signal.addEventListener('abort', abort, { once: true });
      try { const pending = invoke(value => finish(null, value)); pending?.catch?.(error => finish(error)); } catch (error) { finish(error); }
    });
  }
  function listen(method, listener) { api[`register${method}`](listener); listeners.push([method, listener]); }
  function register() {
    for (const [method, listener] of listeners) api[`unregister${method}`](listener);
    listeners.length = 0;
    const changed = () => { if (!disposed && !muted) onChange?.(); };
    for (const method of ['AddListener', 'RemoveListener', 'UpdateListener', 'RenameListener', 'ClearListener', 'StoreUndoListener']) listen(method, changed);
    listen('ClickListener', name => { if (!disposed && !muted) onSelect?.(name); });
    listen('ClientListener', event => {
      if (disposed || muted) return;
      if (event.type === 'viewChanged2D') planeViewport = captureWorkshopPlaneViewport(api);
      if (event.type === 'viewChanged3D') spaceViewport = captureSpaceViewport();
      if (event.type === 'select') onSelect?.(event.target);
      if (event.type === 'deselect' && !event.target) onSelect?.(null);
      if (['updateStyle', 'viewChanged2D', 'viewChanged3D', 'dragEnd', 'movedGeos', 'editorStop'].includes(event.type)) changed();
    });
  }
  function destroy() {
    if (disposed) return; disposed = true;
    lifetime.abort(); observer?.disconnect();
    if (api) {
      for (const [method, listener] of listeners) { try { api[`unregister${method}`](listener); } catch { /* already removed by GGB */ } }
      try { api.stopAnimation(); api.remove(); } catch { /* late load owns its cleanup */ }
    }
    host.remove(); signal?.removeEventListener('abort', externalAbort);
  }
  try {
    api = await callback(done => {
      const applet = new GGBApplet({ id: host.id, appName: 'classic', perspective: workshopPerspective(view),
        width: Math.max(200, container.clientWidth || 800), height: Math.max(200, container.clientHeight || 500),
        language: String(language).split('-')[0], showToolBar: false, showAlgebraInput: false, showMenuBar: false,
        showResetIcon: false, showZoomButtons: false, showFullscreenButton: false, allowStyleBar: false,
        enableUndoRedo: false, enableRightClick: false, enableLabelDrags: false,
        enableFileFeatures: false, useBrowserForJS: true, disableJavaScript: true, randomize: false,
        preventFocus: true, disableAutoScale: true, ...(base64 ? { ggbBase64: base64 } : {}), appletOnLoad: done }, true);
      return applet.inject(host.id);
    }, '数学画布加载超时，请重试。', 90000);
    assertLive(); api.stopAnimation(); api.setMode(0); savedViewports(base64);
    if (!base64) api.setGridVisible(false);
    observer = new ResizeObserver(entries => {
      if (disposed) return;
      const rect = entries[0].contentRect;
      if (rect.width < 1 || rect.height < 1) return;
      const width = Math.max(200, Math.floor(rect.width)), height = Math.max(200, Math.floor(rect.height));
      if (width === size.width && height === size.height) return;
      layout(view, width, height).catch(error => { if (!disposed) onError?.(error); });
    });
    observer.observe(container);
    await layout(view, Math.max(200, container.clientWidth || 800), Math.max(200, container.clientHeight || 500));
    await settleLayout();
    register();
  } catch (error) { destroy(); throw error; }
  async function setView(next) {
    await settleLayout();
    if (next === view) return;
    view = next;
    await layout(view, Math.max(200, container.clientWidth), Math.max(200, container.clientHeight));
    await settleLayout();
  }
  function select(name) {
    assertLive(); muted++;
    try { api.evalCommand(name ? `SelectObjects(${name})` : 'SelectObjects()'); }
    finally { muted--; }
  }
  function captureNow() {
    assertLive();
    // A real content commit makes the current native framing the new saved
    // reference. Layout-only captures stay in WorkshopEditor's existing source.
    if (!layoutPending) {
      if (view !== 'space') planeViewport = captureWorkshopPlaneViewport(api);
      if (view !== 'plane') spaceViewport = captureSpaceViewport();
    }
    const result = api.getBase64();
    if (typeof result !== 'string' || !result) throw new GeoGebraError('file', '数学引擎未返回完整作品，请重试。');
    return result;
  }
  async function load(content, nextView) {
    await settleLayout(); muted++;
    try { await callback(done => api.setBase64(content, done), '作品恢复未完成，请保留内容后重试。'); assertLive(); api.stopAnimation(); api.setMode(0); savedViewports(content); view = nextView; await layout(view, Math.max(200, container.clientWidth), Math.max(200, container.clientHeight)); await settleLayout(); register(); }
    finally { muted--; }
  }
  async function exportImage({ format = 'png', view: targetView = view, scale = 2, transparent = false } = {}) {
    await settleLayout();
    if (!['png', 'svg'].includes(format) || !['plane', 'space'].includes(targetView)) throw new GeoGebraError('export', '请选择平面或三维的 PNG，平面还支持 SVG。');
    if (!Number.isFinite(scale) || scale < 0.1 || scale > 8) throw new GeoGebraError('export', '图片倍率需要 0.1 至 8。');
    if (format === 'svg' && targetView === 'space') throw new GeoGebraError('export', '三维视图支持 PNG，不能导出矢量 SVG。');
    const previousView = view;
    const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    muted++;
    try {
      if (view !== targetView) { await setView(targetView); await nextPaint(); assertLive(); }
      // Scripting commands have no result labels, so evalCommand may return false
      // even when the active view changed successfully (GgbAPI implementation).
      api.evalCommand(`SetActiveView(${targetView === 'space' ? -1 : 1})`);
      if (format === 'svg') {
        const svg = await callback(done => api.exportSVG(done), '平面 SVG 导出未完成。');
        if (typeof svg !== 'string' || !/<svg[\s>]/.test(svg)) throw new GeoGebraError('export', '数学引擎未提供矢量 SVG。');
        return { format, mediaType: 'image/svg+xml', content: svg };
      }
      const png = api.getPNGBase64(scale, transparent, 96 * scale, false, false);
      if (typeof png !== 'string' || !png) throw new GeoGebraError('export', '数学引擎未提供图片。');
      return { format, mediaType: 'image/png', base64: png.replace(/^data:image\/png;base64,/, '') };
    } finally {
      if (!disposed && view !== previousView) { await setView(previousView); await nextPaint(); }
      muted--;
    }
  }
  return {
    fingerprint, settleLayout, objects: () => { assertLive(); return readWorkshopObjects(api); },
    views: () => {
      assertLive(); const raw = api.getViewProperties(1); const plane = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const xml = new DOMParser().parseFromString(api.getXML(), 'application/xml');
      const view3d = xml.querySelector('euclidianView3D');
      const attributes = node => node ? Object.fromEntries(Array.from(node.attributes).map(attribute => [attribute.name, attribute.value !== '' && Number.isFinite(Number(attribute.value)) ? Number(attribute.value) : attribute.value])) : null;
      return { plane, space: view3d ? { coordSystem: attributes(view3d.querySelector('coordSystem')), size: attributes(view3d.querySelector('size')) } : null };
    },
    captureNow, load, setView, select, execute: operation => { assertLive(); return executeOperation(api, operation); }, exportImage,
    setTool: tool => { assertLive(); api.setMode(workshopToolMode(tool)); },
    setTraces: names => { assertLive(); for (const name of names) api.setTrace(name, true); },
    setLanguage: value => { assertLive(); api.setLanguage(String(value).split('-')[0]); },
    mute: value => { muted += value ? 1 : -1; },
    stopAnimation: () => { if (!disposed) api.stopAnimation(); },
    setRepainting: value => { assertLive(); api.setRepaintingActive(value); api.setErrorDialogsActive(value); },
    destroy,
  };
}
