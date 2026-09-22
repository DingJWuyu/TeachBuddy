import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { STATE } from "mathjax-full/js/core/MathItem.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";
import { materialsError } from "../../workbench/jobs/index.js";
import { checkFormula } from "../../../../../packages/shared/src/math/formula.js";
RegisterHTMLHandler(liteAdaptor());
const document = mathjax.document("", {
  InputJax: new TeX({
    packages: ["base", "ams"],
    maxBuffer: 10000,
    maxMacros: 1000,
    formatError: (_jax, error) => {
      throw error;
    },
  }),
  OutputJax: new SVG(),
});
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const tag = (name, body) => `<m:${name}>${body}</m:${name}>`;
const run = (text) =>
  tag(
    "r",
    `<m:rPr><m:sty m:val="p"/></m:rPr><m:t xml:space="preserve">${escape(text)}</m:t>`,
  );
// MathJax parses general input. This adapter translates the resulting semantic
// tree; no specimen formula or source-string substitution participates.
function translate(node) {
  const children = node.childNodes ?? [],
    all = () => children.map(translate).join(""),
    child = (i) => translate(children[i]);
  switch (node.kind) {
    case "math":
    case "TeXAtom":
    case "mstyle":
    case "mpadded":
      return all();
    case "mrow":
    case "inferredMrow": {
      const first = children[0],
        last = children.at(-1);
      if (
        children.length >= 3 &&
        first.kind === "mo" &&
        last.kind === "mo" &&
        first.attributes.get("fence") &&
        last.attributes.get("fence")
      )
        return tag(
          "d",
          `<m:dPr><m:begChr m:val="${escape(first.getText())}"/><m:endChr m:val="${escape(last.getText())}"/><m:grow m:val="1"/></m:dPr>` +
            tag("e", children.slice(1, -1).map(translate).join("")),
        );
      return all();
    }
    case "mi":
    case "mn":
    case "mo":
    case "mtext":
      return run(node.getText());
    case "mspace":
      return run(" ");
    case "mfrac":
      return tag("f", tag("num", child(0)) + tag("den", child(1)));
    case "msqrt":
      return tag(
        "rad",
        '<m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>' + tag("e", all()),
      );
    case "mroot":
      return tag("rad", tag("deg", child(1)) + tag("e", child(0)));
    case "msub":
      return tag("sSub", tag("e", child(0)) + tag("sub", child(1)));
    case "msup":
      return tag("sSup", tag("e", child(0)) + tag("sup", child(1)));
    case "msubsup":
      return tag(
        "sSubSup",
        tag("e", child(0)) + tag("sub", child(1)) + tag("sup", child(2)),
      );
    case "mtable":
      return tag(
        "m",
        children
          .map((row) =>
            tag(
              "mr",
              row.childNodes.map((cell) => tag("e", translate(cell))).join(""),
            ),
          )
          .join(""),
      );
    case "mtd":
      return all();
    default:
      throw new Error(`Unsupported mathematical structure: ${node.kind}`);
  }
}
export function formulaOmml(latex, field = "") {
  try {
    checkFormula(latex);
    if (
      /\\(?:def|gdef|edef|xdef|let|newcommand|renewcommand|require|href|url|html\w*|style|class|cssId|include|input|write|read|unicode)\b/.test(
        latex,
      )
    )
      throw new Error("Unsupported command");
    const tree = document.convert(latex, { end: STATE.COMPILED });
    return `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${translate(tree)}</m:oMath>`;
  } catch {
    throw materialsError(
      "unsupported-formula",
      422,
      field,
      "此公式无法生成可编辑 Word，请修正源后重试。",
    );
  }
}
