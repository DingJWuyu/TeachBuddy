import { executeOperation, validateOperations } from './operations.js';

const deployUrl = 'https://www.geogebra.org/apps/deployggb.js';
let deployPromise;
let nextId = 0;

export class GeoGebraError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'GeoGebraError'; this.code = code; Object.assign(this, details); }
}

function loadDeploy() {
  if (window.GGBApplet) return Promise.resolve(window.GGBApplet);
  if (deployPromise) return deployPromise;
  deployPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = deployUrl; script.async = true;
    const timeout = setTimeout(() => finish(new GeoGebraError('load', 'GeoGebra 加载超时，请检查网络后重试。')), 30000);
    function finish(error) {
      clearTimeout(timeout); script.onload = null; script.onerror = null;
      if (error) { script.remove(); deployPromise = undefined; reject(error); }
      else resolve(window.GGBApplet);
    }
    script.onload = () => finish(window.GGBApplet ? null : new GeoGebraError('load', 'GeoGebra 启动脚本未提供编辑器。'));
    script.onerror = () => finish(new GeoGebraError('load', '无法连接 GeoGebra，请检查网络后重试。'));
    document.head.append(script);
  });
  return deployPromise;
}

function fileCallback(invoke, message, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new GeoGebraError('file', message)), 20000);
    const abort = () => finish(new GeoGebraError('disposed', '编辑器已关闭。'));
    function finish(error, value) {
      clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value);
    }
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    try { invoke(value => finish(null, value)); } catch (error) { finish(error); }
  });
}

function readObjects(api) {
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
    };
    if (['numeric', 'angle', 'boolean'].includes(type)) object.numericValue = api.isDefined(name) ? api.getValue(name) : null;
    if (['point', 'vector'].includes(type)) object.coords = [api.getXcoord(name), api.getYcoord(name), api.getZcoord(name)];
    if (slider) object.slider = {
      min: slider.getAttribute('min'), max: slider.getAttribute('max'),
      step: xml.querySelector('animation')?.getAttribute('step') ?? null,
    };
    return object;
  });
}

/** An instance owns its construction. Callers persist base64, never a global ggbApplet. */
export async function mountGeoGebra(container, { base64 = '', appName = 'graphing', language = 'zh-CN', onChange, onError, signal } = {}) {
  const normalizeLanguage = value => String(value || 'zh-CN').split('-')[0];
  let currentLanguage = normalizeLanguage(language);
  const lifetime = new AbortController();
  const abort = () => lifetime.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) lifetime.abort();
  const GGBApplet = await loadDeploy();
  if (lifetime.signal.aborted) throw new GeoGebraError('disposed', '编辑器已关闭。');
  const id = `teacher_ggb_${++nextId}`;
  const host = document.createElement('div'); host.id = id;
  container.replaceChildren(host);
  const width = Math.max(320, Math.floor(container.clientWidth || 800));
  const height = Math.max(320, Math.floor(container.clientHeight || 600));
  const api = await new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => finish(new GeoGebraError('load', 'GeoGebra 画布加载超时，请检查网络后重试。')), 60000);
    const canceled = () => finish(new GeoGebraError('disposed', '编辑器已关闭。'));
    function finish(error, value) {
      if (done) { value?.remove(); return; } done = true;
      clearTimeout(timer); lifetime.signal.removeEventListener('abort', canceled);
      if (error) { host.remove(); reject(error); } else resolve(value);
    }
    lifetime.signal.addEventListener('abort', canceled, { once: true });
    try {
      const applet = new GGBApplet({ id, appName, width, height, language: currentLanguage, showToolBar: true, showAlgebraInput: true,
        showMenuBar: false, showResetIcon: false, enableUndoRedo: true, useBrowserForJS: true, randomize: false,
        enableFileFeatures: false, showLogging: false, preventFocus: true, disableJavaScript: true, disableAutoScale: true, ...(base64 ? { ggbBase64: base64 } : {}),
        appletOnLoad: value => finish(null, value) }, true);
      applet.inject(host.id);
    } catch (error) { finish(error); }
  });
  let revision = 0; let busy = false; let disposed = false;
  let fingerprint = api.getXML(); let notifyTimer;
  const listeners = [];
  function assertLive() { if (disposed || lifetime.signal.aborted) throw new GeoGebraError('disposed', '编辑器已关闭。'); }
  function sync() {
    const next = api.getXML();
    if (next !== fingerprint) { revision += 1; fingerprint = next; return true; }
    return false;
  }
  function read() {
    assertLive();
    if (busy) throw new GeoGebraError('busy', '正在修改作品，请稍后读取。');
    sync();
    const view = api.getViewProperties(appName === '3d' ? 512 : 1);
    return { revision, objects: readObjects(api), view: typeof view === 'string' ? JSON.parse(view) : view, appName };
  }
  function notify(origin) {
    clearTimeout(notifyTimer);
    if (disposed) return;
    try { onChange?.({ ...read(), origin }); } catch (error) { onError?.(error); }
  }
  function change() {
    if (disposed || busy) return;
    sync(); clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => notify('manual'), 120);
  }
  function registerListeners() {
    for (const [method, callback] of listeners) api[`unregister${method}`](callback);
    listeners.length = 0;
    for (const method of ['AddListener', 'RemoveListener', 'UpdateListener', 'RenameListener', 'ClearListener', 'StoreUndoListener']) {
      api[`register${method}`](change); listeners.push([method, change]);
    }
    const client = event => { if (['updateStyle', 'viewChanged2D', 'viewChanged3D', 'undo', 'redo', 'dragEnd', 'editorStop'].includes(event.type)) change(); };
    api.registerClientListener(client); listeners.push(['ClientListener', client]);
  }
  registerListeners();
  api.setUndoPoint();
  const observer = new ResizeObserver(entries => {
    if (disposed) return;
    const rect = entries[0].contentRect;
    if (rect.width > 0 && rect.height > 0) api.setSize(Math.max(320, Math.floor(rect.width)), Math.max(320, Math.floor(rect.height)));
  });
  observer.observe(container);
  function check(expected) {
    assertLive(); sync();
    if (busy) throw new GeoGebraError('busy', '正在修改作品，请稍后再试。');
    if (!Number.isInteger(expected) || expected !== revision) throw new GeoGebraError('conflict', '画布已有新的修改，请重新读取当前作品后继续。', { revision });
  }
  async function serialize() {
    assertLive();
    if (busy) throw new GeoGebraError('busy', '正在修改作品，请稍后保存。');
    sync(); const expected = revision;
    const content = await fileCallback(callback => api.getBase64(callback), '无法读取完整作品，请重试保存。', lifetime.signal);
    assertLive(); sync();
    if (revision !== expected) throw new GeoGebraError('conflict', '读取作品时画布发生修改，请重新保存。', { revision });
    if (typeof content !== 'string' || !content) throw new GeoGebraError('file', 'GeoGebra 未返回完整作品。');
    return { revision, base64: content };
  }
  async function load(content) {
    await fileCallback(callback => api.setBase64(content, callback), '作品恢复未完成，请保留原稿后重试。', lifetime.signal);
    assertLive(); registerListeners(); api.setUndoPoint();
  }
  async function apply({ revision: expected, operations }) {
    check(expected);
    try { validateOperations(operations, api.getAllObjectNames()); }
    catch (error) { throw new GeoGebraError('operation', error.message); }
    const before = await serialize();
    check(expected);
    busy = true; const previousInert = container.inert; container.inert = true;
    api.stopAnimation(); api.setErrorDialogsActive(false); api.setRepaintingActive(false);
    let failure;
    try {
      for (let index = 0; index < operations.length; index += 1) {
        let timer;
        try {
          await Promise.race([
            executeOperation(api, operations[index]),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new GeoGebraError('command-timeout', 'GeoGebra 构造未完成，请重新加载画布后继续。')), 30000); }),
          ]);
          assertLive();
        } catch (error) {
          throw new GeoGebraError(error.code === 'command-timeout' ? 'command-timeout' : 'operation', error.message || String(error), { operationIndex: index });
        } finally { clearTimeout(timer); }
      }
      api.setUndoPoint();
    } catch (error) {
      failure = error;
      if (error.code === 'command-timeout') {
        // An official lazy command may still complete later. Remove this instance
        // rather than let that late command alter a recovered construction.
        failure.recoveryBase64 = before.base64; destroy(); onError?.(failure);
      } else {
        try { await load(before.base64); }
        catch (rollbackError) { failure = new GeoGebraError('rollback', '修改失败，恢复也未完成。请保留原稿并重新打开。', { cause: error, rollbackError, recoveryBase64: before.base64 }); destroy(); onError?.(failure); }
      }
    } finally {
      if (!disposed) { api.setRepaintingActive(true); api.setErrorDialogsActive(true); }
      busy = false; container.inert = previousInert;
      if (!disposed) { sync(); notify(failure ? 'rollback' : 'assistant'); }
    }
    if (failure) throw failure;
    return read();
  }
  async function restore(content, { revision: expected } = {}) {
    check(expected);
    if (typeof content !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) throw new GeoGebraError('file', '作品内容不是有效的 GGB 文件。');
    const before = await serialize(); check(expected);
    busy = true; const previousInert = container.inert; container.inert = true;
    try { await load(content); }
    catch (error) { await load(before.base64); throw error; }
    finally { busy = false; container.inert = previousInert; sync(); notify('restore'); }
    return read();
  }
  function history(action) {
    assertLive(); if (busy) throw new GeoGebraError('busy', '正在修改作品，请稍后再试。');
    api[action](); registerListeners(); sync(); notify(action); return read();
  }
  function destroy() {
    if (disposed) return; disposed = true;
    clearTimeout(notifyTimer); observer.disconnect();
    for (const [method, callback] of listeners) api[`unregister${method}`](callback);
    api.stopAnimation(); api.remove(); host.remove(); lifetime.abort(); signal?.removeEventListener('abort', abort);
  }
  function setLanguage(value) {
    assertLive();
    const next = normalizeLanguage(value);
    if (next !== currentLanguage) { api.setLanguage(next); currentLanguage = next; }
  }
  lifetime.signal.addEventListener('abort', destroy, { once: true });
  return { read, serialize, apply, restore, undo: () => history('undo'), redo: () => history('redo'), setLanguage, destroy };
}
