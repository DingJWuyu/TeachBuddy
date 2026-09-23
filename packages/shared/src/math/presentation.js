import { viewportTransform } from "./graphics.js";
// This function is also embedded verbatim in standalone native presentations.
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
    '<nav aria-label="演示步骤"></nav><p class="step-description"></p><div class="plot"></div><div class="controls"></div><p class="notice" role="status"></p>';
  const plot = root.querySelector(".plot"),
    controls = root.querySelector(".controls");
  const sliders = new Map();
  const change = (name, value) => {
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
      state = stateFor(source, step.id);
      draw();
    };
    nav.append(button);
  }
  const reset = document.createElement("button");
  reset.textContent = "重置";
  reset.onclick = () => {
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
  function draw() {
    options.onState?.(structuredClone(state));
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
  return { getState: () => structuredClone(state) };
}
export const presentationCss = `body{margin:0;background:#f5f6f8;color:#1e293b;font:14px/1.5 sans-serif}*{box-sizing:border-box}main{max-width:1100px;margin:auto;padding:12px}nav,.controls{display:flex;gap:8px;flex-wrap:wrap}button,input{font:inherit}button{border:1px solid #dce1e8;background:white;border-radius:6px;padding:4px 10px;cursor:pointer}button[aria-pressed=true]{background:#e8efff}.plot{background:white;margin:10px 0;touch-action:none}.plot svg{display:block;width:100%;height:auto;max-height:70vh}.controls label{display:flex;align-items:center;gap:8px}.controls input[type=number]{width:80px}.notice{color:#a33}`;
