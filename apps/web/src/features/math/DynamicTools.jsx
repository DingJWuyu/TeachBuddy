import React from "react";
export default function DynamicTools({ source, onChange, Fields }) {
  const set = (key, value) => onChange({ ...source, [key]: value });
  return (
    <>
      <details open>
        <summary>参数</summary>
        {source.parameters.map((p, i) => (
          <section className="math-dynamic-fields" key={i}>
            <Fields
              value={p}
              prefix={`parameter-${i}-`}
              onChange={(next) =>
                set(
                  "parameters",
                  source.parameters.map((v, j) => (i === j ? next : v)),
                )
              }
            />
            <button
              onClick={() =>
                set(
                  "parameters",
                  source.parameters.filter((_, j) => j !== i),
                )
              }
            >
              移除参数 {p.name}
            </button>
          </section>
        ))}
        <button
          onClick={() =>
            set("parameters", [
              ...source.parameters,
              {
                name: `p${Date.now()}`,
                label: "新参数",
                min: -5,
                max: 5,
                step: 1,
                initial: 0,
              },
            ])
          }
        >
          添加参数
        </button>
      </details>
      <details>
        <summary>步骤</summary>
        <label>
          初始步骤
          <select
            aria-label="初始步骤"
            value={source.initialStepId ?? ""}
            onChange={(e) => set("initialStepId", e.target.value || null)}
          >
            <option value="">无步骤</option>
            {source.steps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        {source.steps.map((step, i) => {
          const update = (next) =>
            set(
              "steps",
              source.steps.map((s, j) => (i === j ? next : s)),
            );
          return (
            <section className="math-dynamic-fields" key={i}>
              <label>
                步骤标题
                <input
                  aria-label={`步骤 ${i + 1} 标题`}
                  value={step.title}
                  onChange={(e) => update({ ...step, title: e.target.value })}
                />
              </label>
              {source.parameters.map((p) => (
                <label key={p.name}>
                  {p.name}
                  <input
                    type="number"
                    aria-label={`步骤 ${i + 1} ${p.name}`}
                    value={
                      step.values.find((v) => v.name === p.name)?.value ?? ""
                    }
                    onChange={(e) =>
                      update({
                        ...step,
                        values: [
                          ...step.values.filter((v) => v.name !== p.name),
                          { name: p.name, value: Number(e.target.value) },
                        ],
                      })
                    }
                  />
                </label>
              ))}
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
            </section>
          );
        })}
        <button
          onClick={() => {
            const id = `step${Date.now()}`;
            onChange({
              ...source,
              initialStepId: source.initialStepId ?? id,
              steps: [
                ...source.steps,
                {
                  id,
                  title: "新步骤",
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
                  set(
                    "drags",
                    source.drags.map((v, j) =>
                      j === i ? { ...v, pointId: e.target.value } : v,
                    ),
                  )
                }
              >
                {source.scene.elements
                  .filter((e) => e.type === "point")
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
                  onChange={(e) =>
                    set(
                      "drags",
                      source.drags.map((v, j) =>
                        j === i
                          ? {
                              ...v,
                              [`${axis}Parameter`]: e.target.value || null,
                            }
                          : v,
                      ),
                    )
                  }
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
          onClick={() =>
            set("drags", [
              ...source.drags,
              {
                pointId:
                  source.scene.elements.find((e) => e.type === "point")?.id ??
                  "",
                xParameter: null,
                yParameter: null,
              },
            ])
          }
        >
          添加拖动
        </button>
      </details>
    </>
  );
}
