import { viewportTransform } from "./graphics.js";
// The same runtime is bundled into standalone native presentations.
export function mountDynamic(
  root,
  source,
  render,
  stateFor,
  resolve,
  snap,
  fontStyle = "",
  options = {},
) {
  let state = stateFor(source, source.steps.some(step => step.id === options.initialState?.stepId) ? options.initialState.stepId : undefined);
  if (options.initialState?.values) for (const parameter of source.parameters) {
    const value = options.initialState.values[parameter.name];
    if (Number.isFinite(value)) state.values[parameter.name] = snap(parameter, value);
  }
  root.innerHTML =
    '<div class="scene-actions"><nav aria-label="演示步骤"></nav><div class="playback"></div></div><p class="step-description"></p><div class="plot"></div><div class="controls"></div><p class="notice" role="status"></p>';
  const plot = root.querySelector(".plot"),
    controls = root.querySelector(".controls");
  const sliders = new Map(), traces = new Map();
  const lifecycle = new AbortController();
  let frame = null, playing = false, destroyed = false, lastTime = 0, phase = 0;
  const animation = source.animation ?? { parameter: source.parameters[0]?.name, seconds: 8, mode: 'bounce' };
  const animated = Number.isFinite(animation.seconds) && animation.seconds >= 1 && animation.seconds <= 120 ? source.parameters.find(p => p.name === animation.parameter) : null;
  const playback = root.querySelector('.playback');
  const play = document.createElement('button');
  function pause() {
    playing = false;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; play.textContent = '播放'; play.setAttribute('aria-pressed', 'false');
    if (!destroyed) options.onState?.(structuredClone(state));
  }
  function tick(time) {
    if (!playing || destroyed) return;
    if (!root.isConnected || !root.getClientRects().length || document.hidden) { pause(); return; }
    if (time - lastTime >= 40) {
      const elapsed = Math.min((time - lastTime) / 1000, 0.15); lastTime = time;
      phase += elapsed / animation.seconds;
      let progress;
      if (animation.mode === 'once') progress = Math.min(1, phase);
      else if (animation.mode === 'loop') progress = phase % 1;
      else { const cycle = phase % 2; progress = cycle <= 1 ? cycle : 2 - cycle; }
      state.values[animated.name] = snap(animated, animated.min + progress * (animated.max - animated.min));
      draw(false);
      if (animation.mode === 'once' && phase >= 1) { pause(); return; }
    }
    frame = requestAnimationFrame(tick);
  }
  if (animated) {
    const caption = document.createElement('span'); caption.textContent = `自动演示 · ${animated.label}`;
    play.textContent = '播放'; play.setAttribute('aria-pressed', 'false');
    play.onclick = () => {
      if (playing) { pause(); return; }
      phase = (state.values[animated.name] - animated.min) / (animated.max - animated.min);
      if (animation.mode === 'once' && phase >= 1) { phase = 0; traces.clear(); }
      playing = true; play.textContent = '暂停'; play.setAttribute('aria-pressed', 'true');
      lastTime = performance.now(); frame = requestAnimationFrame(tick);
    };
    playback.append(caption, play);
  }
  if (source.traceIds?.length) {
    const clear = document.createElement('button'); clear.textContent = '清除轨迹';
    clear.onclick = () => { traces.clear(); draw(true, false); };
    playback.append(clear);
  }
  playback.hidden = !playback.childElementCount;
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal: lifecycle.signal });
  window.addEventListener('blur', pause, { signal: lifecycle.signal });
  const change = (name, value) => {
    pause();
    const p = source.parameters.find((p) => p.name === name);
    state.values[name] = snap(p, value);
    draw();
  };
  for (const p of source.parameters) {
    const label = document.createElement("label");
    label.textContent = p.label;
    for (const type of ["range", "number"]) {
      const input = document.createElement("input");
      input.type = type;
      input.min = p.min;
      input.max = p.max;
      input.step = p.step;
      input.setAttribute(
        "aria-label",
        `${p.name} ${type === "range" ? "滑杆" : "数值"}`,
      );
      input.addEventListener("input", () => {
        if (input.value !== "" && Number.isFinite(Number(input.value)))
          change(p.name, Number(input.value));
      });
      label.append(input);
      sliders.set(`${p.name}-${type}`, input);
    }
    controls.append(label);
  }
  const nav = root.querySelector("nav");
  for (const step of source.steps) {
    const button = document.createElement("button");
    button.textContent = step.title;
    button.onclick = () => {
      pause(); traces.clear();
      state = stateFor(source, step.id);
      draw();
    };
    nav.append(button);
  }
  const reset = document.createElement("button");
  reset.textContent = "重置";
  reset.onclick = () => {
    pause(); traces.clear();
    state = stateFor(source, state.stepId);
    draw();
  };
  nav.append(reset);
  let drag = null;
  plot.addEventListener("pointerdown", (event) => {
    const id = event.target
      .closest("[data-object]")
      ?.getAttribute("data-object");
    drag = source.drags.find((d) => d.pointId === id);
    if (drag) {
      pause();
      plot.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
  plot.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const svg = plot.querySelector("svg");
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.getScreenCTM().inverse(),
    );
    const [x, y] = viewportTransform(source.scene.viewport).unmap([
      point.x,
      point.y,
    ]);
    const values = { x, y };
    for (const axis of ["x", "y"])
      if (drag[`${axis}Parameter`]) {
        const p = source.parameters.find(
          (p) => p.name === drag[`${axis}Parameter`],
        );
        state.values[p.name] = snap(p, values[axis]);
      }
    draw();
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    plot.addEventListener(event, () => {
      drag = null;
    });
  function draw(persist = true, recordTrace = true) {
    if (persist) options.onState?.(structuredClone(state));
    try {
      const description = root.querySelector(".step-description");
      description.textContent =
        source.steps.find((step) => step.id === state.stepId)?.description ??
        "";
      description.hidden = !description.textContent;
      description.style.whiteSpace = "pre-wrap";
      const { plane, undefinedIds } = resolve(source, state, true);
      plot.innerHTML = render(plane, { parameters: state.values }).replace(
        /(<svg[^>]*>)/,
        `$1${fontStyle}`,
      );
      const svg = plot.querySelector('svg');
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('data-traces', ''); group.setAttribute('pointer-events', 'none');
      for (const id of source.traceIds ?? []) {
        const e = plane.scene.elements.find(e => e.id === id && e.type === 'point');
        const points = traces.get(id) ?? [];
        if (e && recordTrace) {
          const p = viewportTransform(source.scene.viewport).map([Number(e.at.x), Number(e.at.y)]);
          if (p.every(Number.isFinite) && (!points.length || Math.hypot(p[0] - points.at(-1)[0], p[1] - points.at(-1)[1]) > 0.5)) { points.push(p); if (points.length > 600) points.shift(); }
        }
        traces.set(id, points);
        if (!points.length) continue;
        const trail = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        trail.setAttribute('data-trace', id);
        trail.setAttribute('fill', e?.style.stroke ?? source.scene.elements.find(e => e.id === id)?.style.stroke ?? '#2855a6');
        trail.setAttribute('opacity', '0.65');
        for (const [x, y] of points) {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', x.toFixed(3)); dot.setAttribute('cy', y.toFixed(3)); dot.setAttribute('r', '2'); trail.append(dot);
        }
        group.append(trail);
      }
      svg?.append(group);
      root.querySelector(".notice").textContent = undefinedIds.length
        ? `此取值下无定义：${undefinedIds.join("、")}`
        : "";
      for (const p of source.parameters)
        for (const type of ["range", "number"])
          sliders.get(`${p.name}-${type}`).value = state.values[p.name];
      [...nav.children].forEach((button, index) =>
        button.setAttribute(
          "aria-pressed",
          String(source.steps[index]?.id === state.stepId),
        ),
      );
      for (const binding of source.drags) {
        const dot = [...plot.querySelectorAll("[data-object]")]
          .find((e) => e.getAttribute("data-object") === binding.pointId)
          ?.querySelector("circle");
        if (dot) {
          dot.setAttribute("r", "7");
          dot.style.cursor = "grab";
        }
      }
    } catch (error) {
      plot.replaceChildren();
      root.querySelector(".notice").textContent = error.message;
    }
  }
  draw();
  return { getState: () => structuredClone(state), pause, destroy: () => { pause(); destroyed = true; lifecycle.abort(); root.replaceChildren(); } };
}
export const presentationCss = `body{margin:0;background:#f5f6f8;color:#1e293b;font:14px/1.5 sans-serif}*{box-sizing:border-box}main{max-width:1100px;margin:auto;padding:12px}nav,.controls,.playback{display:flex;gap:8px;flex-wrap:wrap}.scene-actions{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}.playback{align-items:center}.playback[hidden]{display:none}button,input{font:inherit}button{border:1px solid #dce1e8;background:white;border-radius:6px;padding:4px 10px;cursor:pointer}button[aria-pressed=true]{background:#e8efff}.plot{background:white;margin:10px 0;touch-action:none}.plot svg{display:block;width:100%;height:auto;max-height:70vh}.controls label{display:flex;align-items:center;gap:8px}.controls input[type=number]{width:80px}.notice{color:#a33}`;
