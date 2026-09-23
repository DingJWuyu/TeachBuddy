import React, { useState } from "react";
import {
  addParameter,
  updateParameter,
  removeParameter,
  parameterError,
  updateDrag,
} from "./editing.js";

function ParameterEditor({ source, index, Fields, onChange, edits, onEdits }) {
  const parameter = source.parameters[index];
  const draft = edits[parameter.name] ?? parameter;
  const setDraft = (next) =>
    onEdits(
      JSON.stringify(next) === JSON.stringify(parameter)
        ? cleared()
        : { ...edits, [parameter.name]: next },
    );
  const cleared = () =>
    Object.fromEntries(
      Object.entries(edits).filter(([name]) => name !== parameter.name),
    );
  const [error, setError] = useState("");
  const changed = JSON.stringify(draft) !== JSON.stringify(parameter);
  return (
    <section className="math-dynamic-fields">
      <Fields
        value={draft}
        prefix={`parameter-${index}-`}
        onChange={setDraft}
      />
      {error && <p role="alert">{error}</p>}
      <div className="math-add">
        <button
          disabled={!changed}
          onClick={() => {
            const message = parameterError(source, draft, index);
            setError(message);
            if (!message)
              onChange(updateParameter(source, index, draft), cleared());
          }}
        >
          应用参数 {index + 1}
        </button>
        <button
          onClick={() => {
            if (
              window.confirm(
                `移除参数 ${parameter.name}，公式中的该参数将固定为初值 ${parameter.initial}。是否继续？`,
              )
            )
              onChange(removeParameter(source, index), cleared());
          }}
        >
          移除参数 {parameter.name}
        </button>
      </div>
      {changed && (
        <p className="math-hint">
          应用后同步公式和步骤取值，超出范围的取值移至最近刻度。
        </p>
      )}
    </section>
  );
}
export default function DynamicTools({
  source,
  onChange,
  Fields,
  edits = {},
  onEdits,
}) {
  const set = (key, value) => onChange({ ...source, [key]: value });
  const unbound = source.scene.elements.filter(
    (e) => e.type === "point" && !source.drags.some((d) => d.pointId === e.id),
  );
  return (
    <>
      <details open>
        <summary>参数</summary>
        {source.parameters.map((p, i) => (
          <ParameterEditor
            key={p.name}
            source={source}
            index={i}
            Fields={Fields}
            onChange={onChange}
            edits={edits}
            onEdits={onEdits}
          />
        ))}
        <button
          disabled={source.parameters.length >= 20}
          onClick={() => onChange(addParameter(source))}
        >
          添加参数
        </button>
      </details>
      <details>
        <summary>步骤</summary>
        {source.steps.length > 0 && (
          <label>
            初始步骤
            <select
              aria-label="初始步骤"
              value={source.initialStepId ?? ""}
              onChange={(e) => set("initialStepId", e.target.value)}
            >
              {source.steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {source.steps.map((step, i) => {
          const update = (next) =>
            set(
              "steps",
              source.steps.map((s, j) => (i === j ? next : s)),
            );
          return (
            <section className="math-dynamic-fields" key={step.id}>
              <label>
                步骤标题
                <input
                  aria-label={`步骤 ${i + 1} 标题`}
                  value={step.title}
                  maxLength={200}
                  onChange={(e) => update({ ...step, title: e.target.value })}
                />
              </label>
              <label>
                步骤说明
                <textarea
                  aria-label={`步骤 ${i + 1} 说明`}
                  value={step.description ?? ""}
                  maxLength={2000}
                  onChange={(e) =>
                    update({ ...step, description: e.target.value })
                  }
                />
              </label>
              {source.parameters.map((p) => (
                <label key={p.name}>
                  {p.label} ({p.name})
                  <input
                    type="number"
                    aria-label={`步骤 ${i + 1} ${p.name}`}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={
                      step.values.find((v) => v.name === p.name)?.value ?? ""
                    }
                    onChange={(e) =>
                      update({
                        ...step,
                        values: step.values.map((v) =>
                          v.name === p.name
                            ? { ...v, value: Number(e.target.value) }
                            : v,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <fieldset>
                <legend>显示对象</legend>
                {source.scene.elements.map((object) => (
                  <label key={object.id}>
                    <input
                      type="checkbox"
                      checked={step.visibleIds.includes(object.id)}
                      onChange={(e) =>
                        update({
                          ...step,
                          visibleIds: e.target.checked
                            ? [...step.visibleIds, object.id]
                            : step.visibleIds.filter((id) => id !== object.id),
                        })
                      }
                    />
                    {object.id}
                  </label>
                ))}
              </fieldset>
              <div className="math-add">
                <button
                  disabled={i === 0}
                  onClick={() => {
                    const steps = [...source.steps];
                    [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
                    set("steps", steps);
                  }}
                >
                  上移步骤 {i + 1}
                </button>
                <button
                  onClick={() =>
                    onChange({
                      ...source,
                      steps: source.steps.filter((_, j) => j !== i),
                      initialStepId:
                        source.initialStepId === step.id
                          ? (source.steps.find((s) => s.id !== step.id)?.id ??
                            null)
                          : source.initialStepId,
                    })
                  }
                >
                  移除步骤 {i + 1}
                </button>
              </div>
            </section>
          );
        })}
        <button
          disabled={source.steps.length >= 30}
          onClick={() => {
            const id = `step${Date.now()}`;
            onChange({
              ...source,
              initialStepId: source.initialStepId ?? id,
              steps: [
                ...source.steps,
                {
                  id,
                  title: `步骤 ${source.steps.length + 1}`,
                  description: "",
                  visibleIds: source.scene.elements.map((e) => e.id),
                  values: source.parameters.map((p) => ({
                    name: p.name,
                    value: p.initial,
                  })),
                },
              ],
            });
          }}
        >
          添加步骤
        </button>
      </details>
      <details>
        <summary>拖动绑定</summary>
        {source.drags.map((drag, i) => (
          <section className="math-dynamic-fields" key={i}>
            <label>
              拖动点
              <select
                aria-label={`拖动 ${i + 1} 点`}
                value={drag.pointId}
                onChange={(e) =>
                  onChange(
                    updateDrag(source, i, { ...drag, pointId: e.target.value }),
                  )
                }
              >
                {source.scene.elements
                  .filter(
                    (e) =>
                      e.type === "point" &&
                      (e.id === drag.pointId ||
                        !source.drags.some((d) => d.pointId === e.id)),
                  )
                  .map((e) => (
                    <option key={e.id}>{e.id}</option>
                  ))}
              </select>
            </label>
            {["x", "y"].map((axis) => (
              <label key={axis}>
                {axis}
                <select
                  aria-label={`拖动 ${i + 1} ${axis}`}
                  value={drag[`${axis}Parameter`] ?? ""}
                  onChange={(e) => {
                    const next = {
                      ...drag,
                      [`${axis}Parameter`]: e.target.value || null,
                    };
                    if (!next.xParameter && !next.yParameter)
                      set(
                        "drags",
                        source.drags.filter((_, j) => j !== i),
                      );
                    else onChange(updateDrag(source, i, next));
                  }}
                >
                  <option value="">锁定</option>
                  {source.parameters.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
              </label>
            ))}
            <button
              onClick={() =>
                set(
                  "drags",
                  source.drags.filter((_, j) => j !== i),
                )
              }
            >
              移除拖动 {i + 1}
            </button>
          </section>
        ))}
        <button
          disabled={
            !unbound.length ||
            !source.parameters.length ||
            source.drags.length >= 30
          }
          onClick={() => {
            const drag = {
              pointId: unbound[0].id,
              xParameter: source.parameters[0].name,
              yParameter: null,
            };
            onChange(
              updateDrag(
                { ...source, drags: [...source.drags, drag] },
                source.drags.length,
                drag,
              ),
            );
          }}
        >
          添加拖动
        </button>
      </details>
    </>
  );
}
