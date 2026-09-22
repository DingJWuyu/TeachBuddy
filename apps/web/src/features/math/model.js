export const defaultStyle = () => ({
  stroke: "#2855a6",
  fill: null,
  width: 2,
  dash: "solid",
  fontSize: 18,
});
export const defaultViewport = () => ({
  xMin: -6,
  xMax: 6,
  yMin: -5,
  yMax: 5,
  width: 960,
  height: 720,
  axes: true,
  grid: true,
});
export function emptySource(kind) {
  if (kind === "formula")
    return {
      schemaVersion: 1,
      kind,
      latex: "",
      caption: "",
      includeCaption: true,
      color: "#1e293b",
      fontSize: 32,
    };
  if (kind === "plane")
    return {
      schemaVersion: 1,
      kind,
      scene: { viewport: defaultViewport(), elements: [] },
    };
  return {
    schemaVersion: 1,
    kind,
    viewport: { ...defaultViewport(), axes: false, grid: false },
    azimuth: 30,
    elevation: 20,
    points: [],
    edges: [],
  };
}
export function newElement(type, id) {
  const base = { id, type, style: defaultStyle() },
    at = { x: "0", y: "0" },
    label = { text: "", dx: 10, dy: -10 };
  switch (type) {
    case "function":
      return { ...base, expression: "x", domain: { min: -6, max: 6 }, label };
    case "point":
      return { ...base, at, label: { ...label, text: id } };
    case "line":
      return { ...base, from: at, to: { x: "2", y: "2" }, arrow: "none" };
    case "ellipse":
      return { ...base, center: at, rx: "2", ry: "2" };
    case "polyline":
      return {
        ...base,
        points: [at, { x: "2", y: "0" }, { x: "0", y: "2" }],
        closed: true,
      };
    case "text":
      return { ...base, at, text: "标注" };
  }
}
export function cubeSource(size = 2) {
  const source = emptySource("space");
  source.points = ["A", "B", "C", "D", "A1", "B1", "C1", "D1"].map((id, i) => ({
    id,
    x: [0, size, size, 0][i % 4],
    y: [0, 0, size, size][i % 4],
    z: i > 3 ? size : 0,
    label: { text: id, dx: 10, dy: -10 },
    style: defaultStyle(),
  }));
  source.edges = [
    ["A", "B"],
    ["B", "C"],
    ["C", "D"],
    ["D", "A"],
    ["A1", "B1"],
    ["B1", "C1"],
    ["C1", "D1"],
    ["D1", "A1"],
    ["A", "A1"],
    ["B", "B1"],
    ["C", "C1"],
    ["D", "D1"],
  ].map(([from, to]) => ({ id: from + to, from, to, style: defaultStyle() }));
  return source;
}

export function pyramidSource() {
  const source = cubeSource();
  source.points = source.points.slice(0, 4);
  source.points.push({
    id: "S",
    x: 1,
    y: 1,
    z: 3,
    label: { text: "S", dx: 10, dy: -10 },
    style: defaultStyle(),
  });
  source.edges = source.edges.slice(0, 4);
  for (const from of ["A", "B", "C", "D"])
    source.edges.push({ id: `${from}S`, from, to: "S", style: defaultStyle() });
  return source;
}

export function dynamicSource() {
  const source = {
    schemaVersion: 1,
    kind: "dynamic",
    scene: { viewport: defaultViewport(), elements: [] },
    parameters: [
      { name: "a", label: "系数 a", min: -3, max: 3, step: 0.5, initial: 1 },
      {
        name: "h",
        label: "水平平移 h",
        min: -4,
        max: 4,
        step: 0.5,
        initial: 1,
      },
      {
        name: "k",
        label: "竖直平移 k",
        min: -4,
        max: 4,
        step: 0.5,
        initial: -4,
      },
    ],
    drags: [{ pointId: "P", xParameter: "h", yParameter: "k" }],
    steps: [],
    initialStepId: "base",
  };
  const curve = {
    ...newElement("function", "f"),
    expression: "a*(x-h)^2+k",
    label: { text: "y={a}(x-({h}))²+({k})", dx: -250, dy: -15 },
  };
  // The neutral label remains correct for a=0, when the graph is a line.
  const point = {
    ...newElement("point", "P"),
    at: { x: "h", y: "k" },
    label: { text: "定位点 ({h},{k})", dx: 12, dy: -12 },
  };
  source.scene.elements = [curve, point];
  source.steps = [
    ["base", "母函数", 1, 0, 0],
    ["translate", "平移后曲线", 1, 1, -4],
    ["full", "带系数完整式", -2, 0, 1],
  ].map(([id, title, a, h, k]) => ({
    id,
    title,
    visibleIds: ["f", "P"],
    values: [
      { name: "a", value: a },
      { name: "h", value: h },
      { name: "k", value: k },
    ],
  }));
  return source;
}
