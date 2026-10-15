import { useTranslation } from 'react-i18next';

import { useEffect, useState, useRef } from "react";
import {
  piecewiseRows,
  piecewiseExpression,
} from "@teachbuddy/shared/math/expression";

const readRows = (text) => {
  try {
    return piecewiseRows(text);
  } catch {
    return null;
  }
};
export default function FunctionInput({ expression, onChange }) {
  const { t } = useTranslation('math');
  const [rows, setRows] = useState(() => readRows(expression));
  const [mode, setMode] = useState(() =>
    readRows(expression) ? "pieces" : "expression",
  );
  const last = useRef(expression);
  useEffect(() => {
    if (expression === last.current) return;
    last.current = expression;
    const next = readRows(expression);
    setRows(next);
    setMode(next ? "pieces" : "expression");
  }, [expression]);
  const update = (next) => {
    setRows(next);
    last.current = piecewiseExpression(next);
    onChange(last.current);
  };
  return (
    <div className="math-function-input">
      {mode === "pieces" && rows ? (
        <>
          <p className="math-hint">
            {t("从上到下判断条件，使用第一个满足条件的表达式。")}
          </p>
          {rows.map((row, i) => (
            <div className="math-piece-row" key={i}>
              <label>
                {t("第")} {i + 1} {t("段表达式")}
                <input
                  aria-label={t("第 {{number}} 段表达式", { number: i + 1 })}
                  value={row.expression}
                  onChange={(e) =>
                    update(
                      rows.map((r, j) =>
                        j === i ? { ...r, expression: e.target.value } : r,
                      ),
                    )
                  }
                />
              </label>
              {i < rows.length - 1 ? (
                <label>
                  {t("成立条件")}
                  <input
                    aria-label={t("第 {{number}} 段条件", { number: i + 1 })}
                    value={row.condition}
                    placeholder={t("例如 x < 0")}
                    onChange={(e) =>
                      update(
                        rows.map((r, j) =>
                          j === i ? { ...r, condition: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
              ) : (
                <span className="math-hint">{t("其余情况")}</span>
              )}
              {i < rows.length - 1 && (
                <button onClick={() => update(rows.filter((_, j) => j !== i))}>
                  {t("移除第")} {i + 1} {t("段")}
                </button>
              )}
            </div>
          ))}
          <div className="math-add">
            <button
              disabled={rows.length >= 8}
              onClick={() =>
                update([
                  ...rows.slice(0, -1),
                  { condition: "x < 1", expression: "x" },
                  rows.at(-1),
                ])
              }
            >
              {t("添加一段")}
            </button>
            <button onClick={() => setMode("expression")}>
              {t("编辑完整表达式")}
            </button>
          </div>
        </>
      ) : (
        <>
          <label>
            {t("表达式")}
            <input
              aria-label="expression"
              value={expression}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
          <p className="math-hint">
            {t("可写 2x、x²、sin(x)。ln 为自然对数，log\n            为常用对数；除式有歧义时请加括号。")}
          </p>
          <button
            onClick={() => {
              const next = readRows(expression) ?? [
                { condition: "x < 0", expression },
                { condition: "", expression },
              ];
              setMode("pieces");
              update(next);
            }}
          >
            {t("分段设置")}
          </button>
        </>
      )}
    </div>
  );
}
