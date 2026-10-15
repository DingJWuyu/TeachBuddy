import { useTranslation } from 'react-i18next';

import { useState } from "react";
import {
  constructionKinds,
  acceptsConstructionInput,
  constructionIssue,
  resolveElements,
} from "@teachbuddy/shared/math/geometry";
import { dynamicState } from "@teachbuddy/shared/math/dynamic";
import { newElement } from "./model.js";
import { updateObjects } from "./editing.js";

const inputLabels = {
  midpoint: ["第一个点", "第二个点"],
  segment: ["起点", "终点"],
  projection: ["给定点", "目标直线"],
  parallel: ["经过点", "参考直线"],
  perpendicular: ["经过点", "参考直线"],
  intersection: ["第一个对象", "第二个对象"],
  circle: ["圆心", "圆上点"],
};
export function ConstructionFields({ construction, elements, id, onChange }) {
  const { t } = useTranslation('math');
  const rule = constructionKinds[construction.kind];
  return (
    <div className="math-fields">
      {rule.inputs.map((type, i) => (
        <label key={i}>
          {t(inputLabels[construction.kind][i])}
          <select
            aria-label={t(inputLabels[construction.kind][i])}
            value={construction.refs[i] ?? ""}
            onChange={(e) =>
              onChange({
                ...construction,
                refs: construction.refs.map((r, j) =>
                  j === i ? e.target.value : r,
                ),
              })
            }
          >
            <option value="">{t("请选择")}</option>
            {elements
              .filter((e) => e.id !== id && acceptsConstructionInput(type, e))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id}
                </option>
              ))}
          </select>
        </label>
      ))}
      {construction.kind === "intersection" && (
        <label>
          {t("交点分支")}
          <select
            aria-label={t("交点分支")}
            value={construction.branch ?? 0}
            onChange={(e) =>
              onChange({ ...construction, branch: Number(e.target.value) })
            }
          >
            <option value={0}>{t("第一个交点")}</option>
            <option value={1}>{t("第二个交点")}</option>
          </select>
        </label>
      )}
    </div>
  );
}
export default function ConstructionTools({ source, onChange, onSelect }) {
  const { t } = useTranslation('math');
  const [construction, setConstruction] = useState({
      kind: "midpoint",
      refs: ["", ""],
    }),
    [error, setError] = useState("");
  function add() {
    const elements = source.scene.elements;
    let i = 1;
    while (elements.some((e) => e.id === `C${i}`)) i++;
    const rule = constructionKinds[construction.kind],
      element = { ...newElement(rule.type, `C${i}`), construction };
    try {
      const next = [...elements, element];
      if (constructionIssue(next))
        throw new Error(t("请为构造选择两个不同且有效的对象"));
      resolveElements(
        next,
        source.kind === "dynamic" ? dynamicState(source).values : {},
        { visibleIds: [element.id], viewport: source.scene.viewport },
      );
      onChange(updateObjects(source, next));
      onSelect(`object:${elements.length}`);
      setError("");
    } catch (e) {
      setError(e);
    }
  }
  return (
    <div className="math-fields">
      <p className="math-hint">
        {t("选择已有点、直线或圆，构造随原对象变化的图形。")}
      </p>
      <label>
        {t("构造方式")}
        <select
          aria-label={t("构造方式")}
          value={construction.kind}
          onChange={(e) => {
            setConstruction({ kind: e.target.value, refs: ["", ""] });
            setError("");
          }}
        >
          {Object.entries(constructionKinds).map(([kind, rule]) => (
            <option key={kind} value={kind}>
              {t(`construction.${kind}`)}
            </option>
          ))}
        </select>
      </label>
      <ConstructionFields
        construction={construction}
        elements={source.scene.elements}
        onChange={setConstruction}
      />
      {["parallel", "perpendicular", "projection", "intersection"].includes(
        construction.kind,
      ) && <p className="math-hint">{t("线段按所在直线计算；交点支持直线与圆。")}</p>}
      <button
        className="math-primary"
        disabled={
          construction.refs.some((r) => !r) ||
          source.scene.elements.length >= 200
        }
        onClick={add}
      >
        {t("添加")}{t(`construction.${construction.kind}`)}
      </button>
      {error && (
        <p role="alert" className="math-message" title={error.message}>
          {error.reason === 'invalid-geometry' ? t('sourceError.geometry')
            : error.reason === 'invalid-expression' ? t('sourceError.expression') : error.message}
        </p>
      )}
    </div>
  );
}
