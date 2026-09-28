import { useTranslation } from 'react-i18next';

import { defaultStyle } from "./model.js";

export function addSurface(source, kind) {
  const key = kind === "face" ? "faces" : "sections",
    items = source[key] ?? [];
  let n = 1;
  while (items.some((e) => e.id === `${kind === "face" ? "F" : "S"}${n}`)) n++;
  const id = `${kind === "face" ? "F" : "S"}${n}`;
  const style = {
    ...defaultStyle(),
    fill: kind === "face" ? "#91acd1" : "#e9a23b",
    stroke: kind === "face" ? "#2855a6" : "#b66c13",
  };
  const item =
    kind === "face"
      ? { id, vertices: source.points.slice(0, 3).map((p) => p.id), style }
      : {
          id,
          plane: {
            a: 0,
            b: 0,
            c: 1,
            d:
              (Math.min(...source.points.map((p) => p.z)) +
                Math.max(...source.points.map((p) => p.z))) /
              2,
          },
          style,
        };
  return { ...source, [key]: [...items, item] };
}
export default function SurfaceProperties({
  value,
  kind,
  source,
  onChange,
  Fields,
}) {
  const { t } = useTranslation('math');
  return (
    <div className="math-fields">
      <Fields
        value={{ id: value.id }}
        onChange={(next) => onChange({ ...value, ...next })}
      />
      {kind === "face" ? (
        <>
          <p className="math-hint">{t("沿面的边界依次选择顶点，所有顶点须共面。")}</p>
          {value.vertices.map((id, i) => (
            <div className="math-surface-vertex" key={i}>
              <label>
                {t("顶点")} {i + 1}
                <select
                  aria-label={t("面顶点 {{number}}", { number: i + 1 })}
                  value={id}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      vertices: value.vertices.map((v, j) =>
                        j === i ? e.target.value : v,
                      ),
                    })
                  }
                >
                  {source.points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={value.vertices.length <= 3}
                onClick={() =>
                  onChange({
                    ...value,
                    vertices: value.vertices.filter((_, j) => j !== i),
                  })
                }
              >
                {t("移除")}
              </button>
            </div>
          ))}
          <button
            disabled={
              value.vertices.length >= source.points.length ||
              value.vertices.length >= 30
            }
            onClick={() =>
              onChange({
                ...value,
                vertices: [
                  ...value.vertices,
                  source.points.find((p) => !value.vertices.includes(p.id)).id,
                ],
              })
            }
          >
            {t("添加面顶点")}
          </button>
        </>
      ) : (
        <>
          <p className="math-hint">
            {t("截平面：ax + by + cz = d。随顶点和系数变化重新计算。")}
          </p>
          <Fields
            value={value.plane}
            prefix="section-"
            onChange={(plane) => onChange({ ...value, plane })}
          />
          <p className="math-hint">
            {t("适用于已定义完整面的封闭凸多面体，正方体与棱锥示例可直接使用。")}
          </p>
        </>
      )}
    </div>
  );
}
