import { useTranslation } from 'react-i18next';

import React, { useState } from "react";
import { ToolPanel } from './WorkspaceControls.jsx';
import { ModuleDisclosure } from '../workbench/ModuleMotion.jsx';
import {
  addParameter,
  updateParameter,
  removeParameter,
  parameterError,
  updateDrag,
} from "./editing.js";

function ParameterEditor({ source, index, Fields, onChange, edits, onEdits, confirm }) {
  const { t } = useTranslation('math');
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
          {t("应用参数")} {index + 1}
        </button>
        <button
          onClick={async () => {
            if (
              await confirm(
                t("移除参数 {{name}}，公式中的该参数将固定为初值 {{initial}}。是否继续？", { name: parameter.name, initial: parameter.initial }),
              )
            )
              onChange(removeParameter(source, index), cleared());
          }}
        >
          {t("移除参数")} {parameter.name}
        </button>
      </div>
      {changed && (
        <p className="math-hint">
          {t("应用后同步公式和步骤取值，超出范围的取值移至最近刻度。")}
        </p>
      )}
    </section>
  );
}
export default function DynamicTools({
  active,
  expanded,
  onExpanded,
  source,
  onChange,
  Fields,
  edits = {},
  onEdits,
  confirm,
}) {
  const { t } = useTranslation('math');
  const set = (key, value) => onChange({ ...source, [key]: value });
  const unbound = source.scene.elements.filter(
    (e) => e.type === "point" && !e.construction && !source.drags.some((d) => d.pointId === e.id),
  );
  return (
    <>
      <ToolPanel name="parameters" active={active}>
        <div>
          {source.parameters.map((p, i) => (
            <ModuleDisclosure key={i} title={p.label ? `${p.name} · ${p.label}` : p.name}
              open={expanded[`parameter-${i}`] ?? i === 0} onOpenChange={open => onExpanded(`parameter-${i}`, open)} className="math-parameter-group">
            <ParameterEditor
              key={p.name}
              source={source}
              index={i}
              Fields={Fields}
              onChange={onChange}
              edits={edits}
              onEdits={onEdits}
              confirm={confirm}
            /></ModuleDisclosure>
          ))}
          <button
            disabled={source.parameters.length >= 20}
            onClick={() => { onExpanded(`parameter-${source.parameters.length}`, true); onChange(addParameter(source)); }}
          >
            {t("添加参数")}
          </button>
        </div>
        <ModuleDisclosure title={t("自动播放与轨迹")} open={!!expanded.animation} onOpenChange={open => onExpanded('animation', open)}>
          <div className="math-dynamic-fields">
            {source.parameters.length > 0 && <>
              <label>{t("播放参数")}<select aria-label={t("播放参数")} value={source.animation?.parameter ?? source.parameters[0].name} onChange={e => set('animation', { seconds: 8, mode: 'bounce', ...source.animation, parameter: e.target.value })}>{source.parameters.map(p => <option key={p.name} value={p.name}>{p.label}</option>)}</select></label>
              <label>{t("单程秒数")}<input aria-label={t("单程秒数")} type="number" min="1" max="120" value={source.animation?.seconds ?? 8} onChange={e => set('animation', { parameter: source.parameters[0].name, mode: 'bounce', ...source.animation, seconds: Number(e.target.value) })}/></label>
              <label>{t("播放方式")}<select aria-label={t("播放方式")} value={source.animation?.mode ?? 'bounce'} onChange={e => set('animation', { parameter: source.parameters[0].name, seconds: 8, ...source.animation, mode: e.target.value })}><option value="bounce">{t("往返")}</option><option value="loop">{t("循环")}</option><option value="once">{t("播放一次")}</option></select></label>
            </>}
            <fieldset><legend>{t("记录点的采样轨迹")}</legend>{source.scene.elements.filter(e => e.type === 'point').map(p => <label key={p.id}><input type="checkbox" checked={(source.traceIds ?? []).includes(p.id)} disabled={!(source.traceIds ?? []).includes(p.id) && (source.traceIds?.length ?? 0) >= 10} onChange={e => set('traceIds', e.target.checked ? [...(source.traceIds ?? []), p.id] : source.traceIds.filter(id => id !== p.id))}/>{p.id} {t("的轨迹")}</label>)}</fieldset>
            <p className="math-hint">{t("播放和轨迹只用于试演，重置或换步骤后清空轨迹。下载的演示保留相同设置。")}</p>
          </div>
        </ModuleDisclosure>
        <details>
          <summary>{t("拖动图上的点")}</summary>
          {source.drags.map((drag, i) => (
            <section className="math-dynamic-fields" key={i}>
              <label>
                {t("拖动点")}
                <select
                  aria-label={t("拖动 {{number}} 点", { number: i + 1 })}
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
                        e.type === "point" && !e.construction &&
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
                    aria-label={t("拖动 {{number}} {{axis}}", { number: i + 1, axis: axis })}
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
                    <option value="">{t("锁定")}</option>
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
                {t("移除拖动")} {i + 1}
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
            {t("添加拖动")}
          </button>
        </details>
      </ToolPanel>
      <ToolPanel name="steps" active={active}>
        <div>
          {source.steps.length > 0 && (
            <label>
              {t("初始步骤")}
              <select
                aria-label={t("初始步骤")}
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
              <ModuleDisclosure key={step.id} title={t("{{number}} · {{title}}", { number: i + 1, title: step.title || t("未命名步骤") })}
                open={expanded[`step-${step.id}`] ?? i === 0} onOpenChange={open => onExpanded(`step-${step.id}`, open)} className="math-parameter-group">
              <section className="math-dynamic-fields">
                <label>
                  {t("步骤标题")}
                  <input
                    aria-label={t("步骤 {{number}} 标题", { number: i + 1 })}
                    value={step.title}
                    maxLength={200}
                    onChange={(e) => update({ ...step, title: e.target.value })}
                  />
                </label>
                <label>
                  {t("步骤说明")}
                  <textarea
                    aria-label={t("步骤 {{number}} 说明", { number: i + 1 })}
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
                      aria-label={t("步骤 {{number}} {{name}}", { number: i + 1, name: p.name })}
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
                  <legend>{t("显示对象")}</legend>
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
                    {t("上移步骤")} {i + 1}
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
                    {t("移除步骤")} {i + 1}
                  </button>
                </div>
              </section></ModuleDisclosure>
            );
          })}
          <button
            disabled={source.steps.length >= 30}
            onClick={() => {
              const id = `step${Date.now()}`;
              onExpanded(`step-${id}`, true);
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
            {t("添加步骤")}
          </button>
        </div>
      </ToolPanel>
    </>
  );
}
