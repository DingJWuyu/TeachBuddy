import { create, parseDependencies } from "mathjs/number";

const { parse } = create({ parseDependencies });
export class MathSourceError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}
const functions = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log10: Math.log10,
  log: (x, base = 10) => Math.log(x) / Math.log(base),
};
const operators = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
  "^": (a, b) => a ** b,
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
};
const comparisons = {
  smaller: "<",
  smallerEq: "<=",
  larger: ">",
  largerEq: ">=",
  equal: "==",
  unequal: "!=",
};
const superscripts = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
  "⁺": "+",
};
export function expressionTree(source, maxLength = 1000) {
  if (typeof source !== "string" || source.length > maxLength)
    throw new MathSourceError("invalid-expression", "表达式过长");
  const normalized = source
    .replace(
      /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g,
      (s) => `^(${[...s].map((c) => superscripts[c]).join("")})`,
    )
    .replace(
      /[π×÷−≤≥≠]/g,
      (c) =>
        ({
          π: " pi ",
          "×": "*",
          "÷": "/",
          "−": "-",
          "≤": "<=",
          "≥": ">=",
          "≠": "!=",
        })[c],
    );
  try {
    return parse(normalized);
  } catch {
    throw new MathSourceError(
      "invalid-expression",
      "请检查表达式的括号、运算符和分段条件",
    );
  }
}
const cache = new Map();
// Math.js owns parsing and precedence. Only this small, bounded real-number
// subset is interpreted; assignments, accessors and arbitrary function calls never run.
export function parseExpression(source, variables = ["x"]) {
  const key = JSON.stringify([source, variables]);
  if (cache.has(key)) return cache.get(key);
  const fail = (message = "表达式含不支持的语法或超过复杂度限制") => {
    throw new MathSourceError("invalid-expression", message);
  };
  let count = 0;
  function compile(node, depth = 0) {
    if (++count > 200 || depth > 32) fail();
    const child = (n) => compile(n, depth + 1);
    if (node.isParenthesisNode) return child(node.content);
    if (node.isConstantNode && typeof node.value === "number")
      return () => node.value;
    if (node.isSymbolNode) {
      if (node.name === "pi" || node.name === "e")
        return () => (node.name === "pi" ? Math.PI : Math.E);
      if (!variables.includes(node.name))
        fail(`未知变量 ${node.name}，请先添加对应滑杆`);
      return (values) =>
        Object.hasOwn(values, node.name) ? values[node.name] : NaN;
    }
    if (node.isFunctionNode && node.fn.isSymbolNode) {
      const name = node.fn.name,
        args = node.args.map(child);
      if (
        Object.hasOwn(functions, name) &&
        (args.length === 1 || (name === "log" && args.length === 2))
      )
        return (values) => functions[name](...args.map((f) => f(values)));
      // A named coordinate followed by parentheses is multiplication, e.g. x(x+1).
      if (variables.includes(name) && args.length === 1)
        return (values) => values[name] * args[0](values);
      fail(`不支持函数 ${name}`);
    }
    if (node.isOperatorNode) {
      const args = node.args.map(child),
        op = node.op;
      if (args.length === 1 && ["+", "-"].includes(op))
        return (v) => (op === "-" ? -args[0](v) : +args[0](v));
      if (args.length === 2 && Object.hasOwn(operators, op))
        return (v) => operators[op](args[0](v), args[1](v));
      if (args.length === 2 && ["and", "or"].includes(op))
        return (v) =>
          op === "and"
            ? Boolean(args[0](v) && args[1](v))
            : Boolean(args[0](v) || args[1](v));
    }
    if (node.isRelationalNode) {
      const args = node.params.map(child);
      if (!node.conditionals.every((op) => Object.hasOwn(comparisons, op)))
        fail();
      return (v) =>
        node.conditionals.every((op, i) =>
          operators[comparisons[op]](args[i](v), args[i + 1](v)),
        );
    }
    if (node.isConditionalNode) {
      const condition = child(node.condition),
        yes = child(node.trueExpr),
        no = child(node.falseExpr);
      return (v) => (condition(v) ? yes(v) : no(v));
    }
    fail();
  }
  if (typeof source !== "string" || source.length > 1000) fail();
  // Existing sources may use math.js keywords as parameter names. Escape only
  // declared identifiers so adopting the parser cannot reinterpret those works.
  let prefix = "twv";
  while (source.includes(prefix)) prefix += "v";
  const reserved = new Set([
    "and",
    "or",
    "not",
    "xor",
    "mod",
    "to",
    "in",
    "true",
    "false",
  ]);
  const aliases = new Map(
    variables
      .filter((name) => reserved.has(name))
      .map((name, i) => [name, `${prefix}${i}`]),
  );
  const text = source.replace(
    /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*/g,
    (token) => aliases.get(token) ?? token,
  );
  const tree = expressionTree(text, 10000);
  tree.traverse((node) => {
    if (node.isSymbolNode)
      for (const [name, alias] of aliases)
        if (node.name === alias) node.name = name;
  });
  const evaluate = compile(tree);
  const result = (values = {}) => {
    const value = evaluate(values);
    return typeof value === "number" ? value : NaN;
  };
  if (cache.size >= 256) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}
export function finiteCoordinate(source, values = {}) {
  const result = parseExpression(source, Object.keys(values))(values);
  if (!Number.isFinite(result))
    throw new MathSourceError("invalid-geometry", "坐标必须为有限数");
  return result;
}

// Used by the form editor; serialization stays a single ordinary expression.
export function piecewiseRows(source) {
  const rows = [];
  let node = expressionTree(source);
  const unwrap = (n) => (n.isParenthesisNode ? unwrap(n.content) : n);
  node = unwrap(node);
  while (node.isConditionalNode) {
    rows.push({
      condition: unwrap(node.condition).toString(),
      expression: unwrap(node.trueExpr).toString(),
    });
    node = unwrap(node.falseExpr);
  }
  if (!rows.length) return null;
  rows.push({ condition: "", expression: node.toString() });
  return rows;
}
export function piecewiseExpression(rows) {
  return rows
    .map((row, i) =>
      i === rows.length - 1
        ? `(${row.expression})`
        : `(${row.condition}) ? (${row.expression}) : `,
    )
    .join("");
}

// Simple interval comparisons expose their boundary for open/closed end markers.
// General conditions such as sin(x)>0 are still evaluated normally.
export function expressionBoundaries(source, values = {}) {
  const points = [];
  const unwrap = (n) => (n.isParenthesisNode ? unwrap(n.content) : n);
  const pair = (left, right) => {
    left = unwrap(left);
    right = unwrap(right);
    const other =
      left.isSymbolNode && left.name === "x"
        ? right
        : right.isSymbolNode && right.name === "x"
          ? left
          : null;
    if (!other) return;
    try {
      const x = parseExpression(other.toString(), Object.keys(values))(values);
      if (Number.isFinite(x) && !points.includes(x)) points.push(x);
    } catch {
      /* A boundary that depends on x is not a simple interval. */
    }
  };
  expressionTree(source).traverse((node) => {
    if (
      node.isOperatorNode &&
      ["<", "<=", ">", ">=", "==", "!="].includes(node.op)
    )
      pair(...node.args);
    if (node.isRelationalNode)
      for (let i = 0; i < node.params.length - 1; i++)
        pair(node.params[i], node.params[i + 1]);
  });
  return points.slice(0, 32);
}
