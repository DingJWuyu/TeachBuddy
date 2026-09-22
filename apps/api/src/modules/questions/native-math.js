// Conservative notation conversion, not a solver. Chinese prose and unknown
// notation stay visible in the source for review; no missing values are inferred.
const scripts = [
  ["⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ", "0123456789+-=()n", "^"],
  ["₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎", "0123456789+-=()", "_"],
];
export function normalizeMath(source) {
  let s = source
    .replaceAll("−", "-")
    .replaceAll("×", "\\times ")
    .replaceAll("÷", "\\div ");
  for (const [from, to, op] of scripts)
    s = s.replace(
      new RegExp(`[${from}]+`, "gu"),
      (m) => `${op}{${[...m].map((c) => to[from.indexOf(c)]).join("")}}`,
    );
  for (const [from, to] of Object.entries({
    "∞": "\\infty ",
    "≥": "\\ge ",
    "≤": "\\le ",
    "≠": "\\ne ",
    "∪": "\\cup ",
    "∩": "\\cap ",
    "∠": "\\angle ",
    "°": "^{\\circ}",
  }))
    s = s.replaceAll(from, to);
  // Parentheses may be nested, so consume balanced radicands rather than a
  // sample-specific expression or a regex ending at the first closing bracket.
  for (let i = s.indexOf("√"); i >= 0; i = s.indexOf("√", i + 1)) {
    let end = i + 1,
      rad;
    if (s[end] === "(") {
      let depth = 1;
      end++;
      const start = end;
      while (end < s.length && depth) {
        if (s[end] === "(") depth++;
        if (s[end] === ")") depth--;
        end++;
      }
      if (depth) continue;
      rad = s.slice(start, end - 1);
    } else {
      const m = s.slice(end).match(/^(?:[a-zA-Z]|\d+(?:\.\d+)?)/);
      if (!m) continue;
      rad = m[0];
      end += rad.length;
    }
    s = s.slice(0, i) + `\\sqrt{${rad}}` + s.slice(end);
  }
  // Plain braced branches require at least two expression/condition pairs.
  // Nested TeX groups are handled with a depth counter.
  for (let start = 0; start < s.length; start++)
    if (s[start] === "{") {
      let depth = 1,
        end = start + 1;
      for (; end < s.length && depth; end++) {
        if (s[end] === "{") depth++;
        if (s[end] === "}") depth--;
      }
      if (depth) break;
      const inner = s.slice(start + 1, end - 1),
        rows = inner.split(";");
      if (
        rows.length > 1 &&
        rows.every((r) => r.includes(",") && /[<>=]|\\(?:ge|le)/.test(r))
      ) {
        s =
          s.slice(0, start) +
          `\\begin{cases}${rows.map((r) => r.trim().replace(/,\s*/, " & ")).join(" \\\\ ")}\\end{cases}` +
          s.slice(end);
        break;
      }
    }
  // Slash fractions accept atomic numbers, balanced groups and root atoms.
  const atomBefore = (at) => {
    let i = at - 1;
    if (s[i] === ")" || s[i] === "}") {
      const close = s[i],
        open = close === ")" ? "(" : "{";
      let depth = 1;
      i--;
      while (i >= 0 && depth) {
        if (s[i] === close) depth++;
        if (s[i] === open) depth--;
        i--;
      }
      if (depth) return null;
      let start = i + 1;
      if (open === "{") {
        const m = s.slice(0, start).match(/\\sqrt$/);
        if (m) start -= m[0].length;
        else return null;
      }
      return start;
    }
    const m = s.slice(0, at).match(/(?:\d+(?:\.\d+)?|[a-zA-Z])$/);
    return m ? at - m[0].length : null;
  };
  const atomAfter = (at) => {
    let i = at + 1;
    if (s[i] === "(") {
      let depth = 1;
      i++;
      while (i < s.length && depth) {
        if (s[i] === "(") depth++;
        if (s[i] === ")") depth--;
        i++;
      }
      return depth ? null : i;
    }
    const m = s.slice(i).match(/^(?:\d+(?:\.\d+)?|[a-zA-Z])/);
    return m ? i + m[0].length : null;
  };
  // A slash beside powers/subscripts already has a faithful editable TeX
  // representation. Keep it unless the complete operands can be identified;
  // rewriting a suffix of a power would change precedence.
  for (
    let at = /[\^_]/.test(s) ? -1 : s.indexOf("/");
    at >= 0;
    at = s.indexOf("/", at + 1)
  ) {
    const a = atomBefore(at),
      b = atomAfter(at);
    if (a === null || b === null) continue;
    const unwrap = (x) =>
      x.startsWith("(") && x.endsWith(")") ? x.slice(1, -1) : x;
    const replacement = `\\frac{${unwrap(s.slice(a, at))}}{${unwrap(s.slice(at + 1, b))}}`;
    s = s.slice(0, a) + replacement + s.slice(b);
    at = a + replacement.length - 1;
  }
  s = s
    .replace(/\{(log|sin|cos|tan|ln)\}/g, "$1")
    .replace(/(?<![a-zA-Z\\])(log|sin|cos|tan|ln)(?![a-zA-Z])/g, "\\$1 ");
  return s.trim();
}
export function nativeMathRuns(text) {
  const runs = [];
  // Explicit math stays explicit. For unmarked text only convert spans that
  // contain mathematical notation, never arbitrary Latin prose or choice labels.
  const expression =
    /[A-Za-z0-9√∠(（\[+−-][A-Za-z0-9\s²³⁰¹⁴⁵⁶⁷⁸⁹ⁿ₀₁₂₃₄₅₆₇₈₉√∠°∞≥≤≠∪∩×÷+−\-*/=<>^_.,()（）\[\]{};|]*/g;
  let end = 0;
  for (const m of text.matchAll(expression)) {
    const raw = m[0].trimEnd();
    if (
      !/[=<>√∠²³⁰¹⁴⁵⁶⁷⁸⁹ⁿ₀₁₂₃₄₅₆₇₈₉≥≤≠∪∩∞^_]|(?:\b[A-Za-z]|\d)\s*[/+−*×÷-]\s*(?:[A-Za-z]\b|\d)|\b[A-Za-z]+\([^()]*\)|[（(][+−-]?\d+,\s*[+−-]?\d+[)）]|\b(?:tan|sin|cos|log|ln)\b/.test(
        raw,
      )
    )
      continue;
    if (m.index > end)
      runs.push({ type: "text", text: text.slice(end, m.index) });
    runs.push({ type: "math", latex: normalizeMath(raw) });
    end = m.index + raw.length;
  }
  if (end < text.length) runs.push({ type: "text", text: text.slice(end) });
  return runs;
}
