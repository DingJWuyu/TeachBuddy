import { executeOperation } from './operations.js';
import { GeoGebraError } from './controller.js';
import { workshopPerspective, applyWorkshopView, workshopToolMode } from '../../../../../../packages/shared/src/math/workshop-runtime.js';

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
export async function mountWorkshopGraph(container, { base64 = '', view = 'plane', language = 'zh-CN', signal, onChange, onSelect, onLayout } = {}) {
  const GGBApplet = await localLoader();
  if (signal?.aborted) throw new DOMException('编辑器已关闭。', 'AbortError');
  const lifetime = new AbortController();
  const host = document.createElement('div'); host.id = `teacher_workshop_${++nextId}`;
  host.style.cssText = 'width:100%;height:100%;min-height:200px'; container.replaceChildren(host);
  let disposed = false, muted = 0, api, observer;
  const listeners = [];
  const externalAbort = () => destroy();
  signal?.addEventListener('abort', externalAbort, { once: true });
  function assertLive() { if (disposed || signal?.aborted) throw new GeoGebraError('disposed', '编辑器已关闭。'); }
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
    assertLive(); api.stopAnimation(); api.setMode(0); api.setPerspective(workshopPerspective(view));
    if (!base64) api.setGridVisible(false);
    register();
    observer = new ResizeObserver(entries => {
      if (disposed) return;
      const rect = entries[0].contentRect;
      if (rect.width < 1 || rect.height < 1) return;
      muted++;
      try { api.setSize(Math.max(200, Math.floor(rect.width)), Math.max(200, Math.floor(rect.height))); }
      finally { muted--; onLayout?.(); }
    });
    observer.observe(container);
  } catch (error) { destroy(); throw error; }
  function setView(next) { assertLive(); applyWorkshopView(api, next); view = next; }
  function select(name) {
    assertLive(); muted++;
    try { api.evalCommand(name ? `SelectObjects(${name})` : 'SelectObjects()'); }
    finally { muted--; }
  }
  function captureNow() {
    assertLive(); const result = api.getBase64();
    if (typeof result !== 'string' || !result) throw new GeoGebraError('file', '数学引擎未返回完整作品，请重试。');
    return result;
  }
  async function load(content, nextView) {
    assertLive(); muted++;
    try { await callback(done => api.setBase64(content, done), '作品恢复未完成，请保留内容后重试。'); assertLive(); api.stopAnimation(); api.setMode(0); register(); setView(nextView); }
    finally { muted--; }
  }
  async function exportImage({ format = 'png', view: targetView = view, scale = 2, transparent = false } = {}) {
    assertLive();
    if (!['png', 'svg'].includes(format) || !['plane', 'space'].includes(targetView)) throw new GeoGebraError('export', '请选择平面或三维的 PNG，平面还支持 SVG。');
    if (!Number.isFinite(scale) || scale < 0.1 || scale > 8) throw new GeoGebraError('export', '图片倍率需要 0.1 至 8。');
    if (format === 'svg' && targetView === 'space') throw new GeoGebraError('export', '三维视图支持 PNG，不能导出矢量 SVG。');
    const previousView = view;
    const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    muted++;
    try {
      if (view !== targetView) { setView(targetView); await nextPaint(); assertLive(); }
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
      if (!disposed && view !== previousView) { setView(previousView); await nextPaint(); }
      muted--;
    }
  }
  return {
    fingerprint: () => { assertLive(); const xml = new DOMParser().parseFromString(api.getXML(), 'application/xml'); xml.querySelectorAll('gui, euclidianView > size, euclidianView3D > size').forEach(node => node.remove()); return new XMLSerializer().serializeToString(xml); }, objects: () => { assertLive(); return readWorkshopObjects(api); },
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
