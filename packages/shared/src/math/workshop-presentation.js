import { visibleWorkshopFormulas } from './workshop.js';

export const workshopPresentationCss = `*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:'Noto Sans SC',system-ui,sans-serif;color:#18243a;background:#f4f6fa}main{max-width:1500px;margin:auto;padding:24px}h1{font-size:22px;margin:0 0 20px}.math-content{background:white;border-radius:12px;padding:20px}.formula-row{text-align:center;margin:8px 0}.formula-row svg{max-width:100%;height:auto}.graph{position:relative;overflow:hidden;width:100%;max-width:100%;height:min(65vh,760px);max-height:min(65vh,760px);min-height:360px}.classroom-graph-host{position:relative;overflow:hidden;width:100%;height:100%}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:16px}button,select{font:inherit;border:1px solid #d5dce8;background:white;border-radius:7px;padding:8px 14px;color:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:wait}button[aria-pressed=true]{background:#e5edff;border-color:#7498e8}.parameter{display:flex;align-items:center;gap:8px}.parameter input{width:170px}.step-description{white-space:pre-wrap;line-height:1.6;margin-top:12px}.credit{font-size:13px;color:#657184;margin-top:18px}.status{line-height:1.6;white-space:pre-wrap} @media(max-width:700px){main{padding:12px}.math-content{padding:12px}.graph{min-height:320px}.parameter input{width:140px}}`;

/** Standalone classroom controls. The source and trusted SVGs contain no account data. */
export async function mountWorkshopPresentation(root, source, { formulas, title, applyView }) {
  let api;
  let objects = [];
  let stepId = source.initialStepId;
  let running = false;
  let frame;
  let changing = false;
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
  const heading = el('h1', '', title || '数学作品');
  const content = el('div', 'math-content');
  const formulaBand = el('div', 'formulas');
  const graph = el('div', 'graph');
  const graphHost = el('div', 'classroom-graph-host');
  const status = el('p', 'status');
  const controls = el('div', 'controls');
  const parameters = el('div', 'controls');
  const description = el('div', 'step-description');
  root.replaceChildren(heading, content, controls, parameters, description, status);
  content.append(formulaBand);
  const renderFormulas = () => {
    formulaBand.replaceChildren(...visibleWorkshopFormulas(source, stepId).map(formula => {
      const row = el('div', 'formula-row');
      row.innerHTML = formulas.find(asset => asset.id === formula.id)?.svg || '';
      return row;
    }));
    description.textContent = source.steps.find(step => step.id === stepId)?.description || '';
  };
  const pause = () => { running = false; cancelAnimationFrame(frame); if (play) { play.textContent = '播放'; play.setAttribute('aria-pressed', 'false'); } };
  let play;
  let select;
  const sliders = new Map();
  const syncSliders = () => { for (const [name, { input, output }] of sliders) { const value = api.getValue(name); input.value = value; output.textContent = Number(value.toPrecision(8)).toString(); } };
  const loadBase = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('作品恢复超时，请重新打开文件。')), 20000);
    api.setBase64(source.graph.base64, () => { clearTimeout(timer); api.stopAnimation(); api.setSize(Math.max(320, graph.clientWidth), Math.max(320, graph.clientHeight)); resolve(); });
  });
  const applyStep = async nextId => {
    pause(); if (changing) return;
    changing = true; controls.inert = parameters.inert = true;
    try {
      if (api) {
        await loadBase();
        const step = source.steps.find(item => item.id === nextId);
        if (step) {
          for (const [name, value] of Object.entries(step.values)) api.setValue(name, value);
          for (const name of api.getAllObjectNames()) api.setVisible(name, step.visibleObjects.includes(name));
        }
        await applyView(api, step?.view ?? source.view);
        for (const name of source.traceObjects) api.setTrace?.(name, true);
      }
      stepId = nextId; renderFormulas(); if (select) select.value = stepId; if (api) syncSliders();
    } catch (error) { status.textContent = error.message; }
    finally { changing = false; controls.inert = parameters.inert = false; }
  };
  renderFormulas();
  if (source.steps.length) {
    select = el('select'); select.setAttribute('aria-label', '教学步骤');
    for (const step of source.steps) { const option = el('option', '', step.title); option.value = step.id; select.append(option); }
    select.value = stepId; select.addEventListener('change', () => applyStep(select.value)); controls.append(select);
  }
  const reset = el('button', '', '重置'); reset.addEventListener('click', () => applyStep(stepId)); controls.append(reset);
  if (!source.graph) return;
  content.append(graph); graph.append(graphHost); graphHost.id = 'workshop-graph';
  status.textContent = '正在打开数学作品…';
  try {
    api = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('数学引擎未能启动，请保留解压后的完整文件夹。')), 30000);
      const applet = new window.GGBApplet({ width: Math.max(320, graph.clientWidth), height: Math.max(360, graph.clientHeight), appName: 'classic',
        ggbBase64: source.graph.base64, disableJavaScript: true, useBrowserForJS: false, enableFileFeatures: false, randomize: false,
        appletOnLoad: value => { clearTimeout(timer); value.stopAnimation(); resolve(value); } });
      Promise.resolve(applet.inject(graphHost.id)).catch(error => { clearTimeout(timer); reject(error); });
    });
    objects = Array.from(api.getAllObjectNames()).map(name => {
      const xml = new DOMParser().parseFromString(api.getXML(name), 'application/xml'); const slider = xml.querySelector('slider');
      return { name, type: api.getObjectType(name), slider: slider ? { min: Number(slider.getAttribute('min')), max: Number(slider.getAttribute('max')), step: Number(xml.querySelector('animation')?.getAttribute('step') || 0.1) } : null };
    });
    for (const object of objects.filter(item => item.slider)) {
      const label = el('label', 'parameter', `${object.name} `); const input = el('input'); input.type = 'range'; input.min = object.slider.min; input.max = object.slider.max; input.step = object.slider.step; input.setAttribute('aria-label', object.name); const output = el('output');
      input.addEventListener('input', () => { pause(); api.setValue(object.name, Number(input.value)); syncSliders(); }); label.append(input, output); parameters.append(label); sliders.set(object.name, { input, output });
    }
    const animated = objects.find(item => item.name === source.animation?.parameter) ?? objects.find(item => item.slider);
    if (animated) {
      play = el('button', '', '播放'); play.setAttribute('aria-pressed', 'false');
      play.addEventListener('click', () => {
        if (running) { pause(); return; }
        const duration = (source.animation?.seconds ?? 8) * 1000;
        const mode = source.animation?.mode ?? 'bounce'; const start = performance.now(); const low = animated.slider.min; const high = animated.slider.max;
        running = true; play.textContent = '暂停'; play.setAttribute('aria-pressed', 'true');
        const tick = now => {
          if (!running) return;
          const elapsed = Math.max(0, (now - start) / duration);
          const progress = Math.max(0, Math.min(1, mode === 'bounce' ? 1 - Math.abs((elapsed % 2) - 1) : mode === 'loop' ? elapsed % 1 : elapsed));
          const value = Math.max(low, Math.min(high, low + Math.round(progress * (high - low) / animated.slider.step) * animated.slider.step));
          api.setValue(animated.name, value); syncSliders();
          if (mode === 'once' && elapsed >= 1) pause(); else frame = requestAnimationFrame(tick);
        }; frame = requestAnimationFrame(tick);
      }); controls.append(play);
    }
    await applyStep(stepId); status.textContent = '';
    const resize = new ResizeObserver(() => api.setSize(Math.max(320, graph.clientWidth), Math.max(320, graph.clientHeight)));
    resize.observe(graph);
    root.append(el('div', 'credit', '图形由 GeoGebra 提供。第三方许可见包内 LICENSES 和 runtime/licenses，说明见 runtime/NOTICE.txt。'));
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', () => { pause(); resize.disconnect(); api.stopAnimation(); api.remove(); }, { once: true });
  } catch (error) { status.textContent = error.message; }
}
