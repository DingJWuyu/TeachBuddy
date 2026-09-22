import { checkFormula } from "../../../../../packages/shared/src/math/formula.js";
import { materialsError } from "../../workbench/jobs/index.js";
import { pandocDocument, runPandocSync } from "./pandoc.js";

export function validateFormulas(formulas) {
  const unsupported = (field) => materialsError(
    "unsupported-formula", 422, field,
    "此公式无法生成可编辑 Word，请修正源后重试。",
  );
  for (const { latex, field } of formulas) {
    try {
      checkFormula(latex);
      if (/\\(?:def|gdef|edef|xdef|let|newcommand|renewcommand|require|href|url|html\w*|style|class|cssId|include|input|write|read|unicode)\b/.test(latex))
        throw new Error("Unsupported command");
    } catch { throw unsupported(field); }
  }
  if (!formulas.length) return;
  const document = (items) => pandocDocument(items.map(({ latex }) => ({
    t: "Para", c: [{ t: "Math", c: [{ t: "InlineMath" }, latex] }],
  })));
  // Use the same writer as the real output. On failure isolate the field, while
  // the normal path checks the whole filtered document in one invocation.
  try { runPandocSync(document(formulas)); }
  catch (error) {
    if (!error.formulaWarning) throw error;
    for (const formula of formulas) {
      try { runPandocSync(document([formula])); }
      catch (failure) {
        if (!failure.formulaWarning) throw failure;
        throw unsupported(formula.field);
      }
    }
    throw unsupported(formulas[0].field);
  }
}
