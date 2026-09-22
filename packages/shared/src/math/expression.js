// Closed arithmetic grammar shared by the preview and server renderer.
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
};
export function parseExpression(source, variables = ["x"]) {
  const fail = () => {
    throw new MathSourceError(
      "invalid-expression",
      "表达式不符合数学语法或超过复杂度限制",
    );
  };
  if (typeof source !== "string" || source.length > 1000) fail();
  const tokens =
    source.match(
      /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*|[^\s]/g,
    ) ?? [];
  let position = 0,
    nodes = 0;
  function node(value) {
    if (++nodes > 200) fail();
    return value;
  }
  function expression(min = 0, depth = 0) {
    if (depth > 32) fail();
    const token = tokens[position++];
    let left;
    if (token === "+" || token === "-")
      left = node({
        op: token === "+" ? "positive" : "negative",
        a: expression(3, depth + 1),
      });
    else if (token === "(") {
      left = expression(0, depth + 1);
      if (tokens[position++] !== ")") fail();
    } else if (/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token ?? ""))
      left = node({ value: Number(token) });
    else if (Object.hasOwn(functions, token ?? "")) {
      if (tokens[position++] !== "(") fail();
      left = node({ op: token, a: expression(0, depth + 1) });
      if (tokens[position++] !== ")") fail();
    } else if (token === "pi" || token === "e")
      left = node({ value: token === "pi" ? Math.PI : Math.E });
    else if (variables.includes(token)) left = node({ variable: token });
    else fail();
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };
    while (
      Object.hasOwn(precedence, tokens[position]) &&
      precedence[tokens[position]] >= min
    ) {
      const op = tokens[position++],
        p = precedence[op];
      left = node({
        op,
        a: left,
        b: expression(op === "^" ? p : p + 1, depth + 1),
      });
    }
    return left;
  }
  const tree = expression();
  if (position !== tokens.length) fail();
  const treeDepth = (n) =>
    n ? 1 + Math.max(treeDepth(n.a), treeDepth(n.b)) : 0;
  if (treeDepth(tree) > 32) fail();
  function evaluate(n, values) {
    if ("value" in n) return n.value;
    if (n.variable) return values[n.variable];
    const a = evaluate(n.a, values);
    if (functions[n.op]) return functions[n.op](a);
    if (n.op === "negative") return -a;
    if (n.op === "positive") return a;
    const b = evaluate(n.b, values);
    switch (n.op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return a / b;
      case "^":
        return a ** b;
    }
  }
  return (values = {}) => evaluate(tree, values);
}
export function finiteCoordinate(source) {
  const result = parseExpression(source, [])();
  if (!Number.isFinite(result))
    throw new MathSourceError("invalid-geometry", "坐标必须为有限数");
  return result;
}
