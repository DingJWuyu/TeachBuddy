import { useTranslation } from 'react-i18next';

import { useState } from "react";
import { findFunctionPoints } from "@teachbuddy/shared/math/analysis";
import { dynamicState } from "@teachbuddy/shared/math/dynamic";
import { newElement } from "./model.js";
import { updateObjects } from "./editing.js";

export default function AnalysisTools({ source, onChange, onSelect }) {
  const { t } = useTranslation('math');
  const curves = source.scene.elements.filter((e) => e.type === "function");
  const [first, setFirst] = useState(curves[0]?.id ?? "");
  const [second, setSecond] = useState("");
  const [range, setRange] = useState({
    min: source.scene.viewport.xMin,
    max: source.scene.viewport.xMax,
  });
  const [result, setResult] = useState(null),
    [error, setError] = useState("");
  const signature = JSON.stringify([source, first, second, range]);
  const current = result?.signature === signature;
  function calculate() {
    try {
      const f = curves.find((e) => e.id === first),
        g = second ? curves.find((e) => e.id === second) : null;
      if (!f || (second && !g)) throw new Error(t("请先添加并选择函数"));
      const points = findFunctionPoints(f, g, {
        min: Number(range.min),
        max: Number(range.max),
        values: source.kind === "dynamic" ? dynamicState(source).values : {},
      });
      setResult({ points, signature });
      setError("");
    } catch (error) {
      setResult(null);
      setError(error);
    }
  }
  function addPoints() {
    const elements = [...source.scene.elements];
    for (const p of result.points) {
      let n = 1;
      while (elements.some((e) => e.id === `R${n}`)) n++;
      const point = newElement("point", `R${n}`);
      point.at = { x: String(p.x), y: String(p.y) };
      point.label.text = `(${format(p.x)}, ${format(p.y)})`;
      elements.push(point);
    }
    onChange(updateObjects(source, elements));
    onSelect(`object:${source.scene.elements.length}`);
  }
  const format = (value) => Number(value.toPrecision(8)).toString();
  return (
    <div className="math-fields">
      <p className="math-hint">
        {t("查找指定范围内的零点或交点。动态作品按保存的开场值计算。")}
      </p>
      <label>
        {t("函数")}
        <select
          aria-label={t("分析函数")}
          value={first}
          onChange={(e) => setFirst(e.target.value)}
        >
          <option value="">{t("选择函数")}</option>
          {curves.map((f) => (
            <option key={f.id} value={f.id}>
              {f.id} · {f.expression}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("与谁相交")}
        <select
          aria-label={t("相交对象")}
          value={second}
          onChange={(e) => setSecond(e.target.value)}
        >
          <option value="">{t("x 轴（求零点）")}</option>
          {curves
            .filter((f) => f.id !== first)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.id} · {f.expression}
              </option>
            ))}
        </select>
      </label>
      <div className="math-analysis-range">
        {[
          ["min", t("查找起点")],
          ["max", t("查找终点")],
        ].map(([key, name]) => (
          <label key={key}>
            {name}
            <input
              aria-label={name}
              type="number"
              value={range[key]}
              onChange={(e) => setRange({ ...range, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <button
        className="math-primary"
        disabled={!curves.length}
        onClick={calculate}
      >
        {t("查找")}{second ? t("交点") : t("零点")}
      </button>
      {error && (
        <p role="alert" className="math-message" title={error.message}>
          {error.reason === 'invalid-geometry' ? t('sourceError.analysisRange')
            : error.reason === 'invalid-expression' ? t('sourceError.expression') : error.message}
        </p>
      )}
      {current && (
        <div className="math-analysis-results" aria-label={t("分析结果")}>
          <p>
            {result.points.length
              ? t("找到 {{count}} 个候选点（近似值）", { count: result.points.length })
              : t("此范围内未找到孤立的候选点")}
          </p>
          {result.points.map((p, i) => (
            <p key={i}>
              ({format(p.x)}, {format(p.y)})
            </p>
          ))}
          {!!result.points.length && (
            <button
              disabled={
                source.scene.elements.length + result.points.length > 200
              }
              onClick={addPoints}
            >
              {t("作为固定点加入图形")}
            </button>
          )}
        </div>
      )}
      {result && !current && (
        <p className="math-hint">{t("函数或范围已变化，请重新查找。")}</p>
      )}
      <p className="math-hint">
        {t("数值查找可能遗漏密集或极窄的交点，可缩小范围再查。加入的点固定于本次结果。")}
      </p>
    </div>
  );
}
