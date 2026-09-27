import {
  Point,
  Line,
  Segment,
  Circle,
  Vector,
  Polygon,
} from "@flatten-js/core";
import { Vector3, Plane, Line3 } from "three";
import { finiteCoordinate, MathSourceError } from "./expression.js";

export const constructionKinds = {
  midpoint: { type: "point", inputs: ["point", "point"], label: "中点" },
  projection: { type: "point", inputs: ["point", "line"], label: "垂足" },
  intersection: {
    type: "point",
    inputs: ["round-or-line", "round-or-line"],
    label: "交点",
  },
  segment: { type: "line", inputs: ["point", "point"], label: "连接两点" },
  parallel: { type: "line", inputs: ["point", "line"], label: "平行线" },
  perpendicular: { type: "line", inputs: ["point", "line"], label: "垂线" },
  circle: { type: "ellipse", inputs: ["point", "point"], label: "过点圆" },
};
export const acceptsConstructionInput = (type, element) =>
  type === "round-or-line"
    ? ["line", "ellipse"].includes(element?.type)
    : element?.type === type;
export function constructionIssue(elements) {
  const byId = new Map(elements.map((e) => [e.id, e])),
    done = new Set(),
    visiting = new Set();
  function visit(e) {
    if (done.has(e.id)) return null;
    if (visiting.has(e.id)) return e.id;
    visiting.add(e.id);
    const c = e.construction;
    if (c) {
      const rule = constructionKinds[c.kind];
      if (
        !rule ||
        rule.type !== e.type ||
        c.refs.length !== rule.inputs.length ||
        new Set(c.refs).size !== c.refs.length
      )
        return e.id;
      for (const [i, ref] of c.refs.entries()) {
        const parent = byId.get(ref);
        if (!acceptsConstructionInput(rule.inputs[i], parent) || visit(parent))
          return e.id;
      }
    }
    visiting.delete(e.id);
    done.add(e.id);
    return null;
  }
  return elements.map(visit).find(Boolean) ?? null;
}
const invalid = (message) => {
  throw new MathSourceError("invalid-geometry", message);
};
const serialized = (p) => ({ x: String(p.x), y: String(p.y) });
export function resolveElements(
  elements,
  values = {},
  { tolerant = false, visibleIds, viewport } = {},
) {
  const byId = new Map(elements.map((e) => [e.id, e])),
    resolved = new Map(),
    visiting = new Set();
  const point = (at) =>
    new Point(finiteCoordinate(at.x, values), finiteCoordinate(at.y, values));
  function resolve(id) {
    if (resolved.has(id)) {
      const result = resolved.get(id);
      if (!result) invalid(`${id} 此取值下无定义`);
      return result;
    }
    const original = byId.get(id);
    if (!original || visiting.has(id)) invalid("构造引用缺失或形成循环");
    visiting.add(id);
    try {
      const e = structuredClone(original),
        c = e.construction;
      delete e.construction;
      if (c) {
        const parents = c.refs.map(resolve);
        const at = (p) => point(p.at);
        const straight = (e) => {
          const a = point(e.from),
            b = point(e.to);
          if (a.equalTo(b)) invalid("直线的两点不能重合");
          return new Line(a, b);
        };
        const shape = (e) => {
          if (e.type === "line") return straight(e);
          const rx = finiteCoordinate(e.rx),
            ry = finiteCoordinate(e.ry);
          if (rx <= 0 || Math.abs(rx - ry) > 1e-9 * Math.max(rx, ry))
            invalid("交点构造目前支持直线和圆");
          return new Circle(point(e.center), rx);
        };
        switch (c.kind) {
          case "midpoint":
            e.at = serialized(
              new Segment(at(parents[0]), at(parents[1])).middle(),
            );
            break;
          case "projection":
            e.at = serialized(
              at(parents[0]).projectionOn(straight(parents[1])),
            );
            break;
          case "intersection": {
            const hits = shape(parents[0])
              .intersect(shape(parents[1]))
              .sort((a, b) => a.x - b.x || a.y - b.y);
            const hit = hits[c.branch ?? 0];
            if (!hit) invalid("所选对象在此取值下没有该交点");
            e.at = serialized(hit);
            break;
          }
          case "segment":
            e.from = serialized(at(parents[0]));
            e.to = serialized(at(parents[1]));
            break;
          case "parallel":
          case "perpendicular": {
            const origin = at(parents[0]);
            straight(parents[1]);
            let direction = new Vector(
              point(parents[1].from),
              point(parents[1].to),
            ).normalize();
            if (c.kind === "perpendicular")
              direction = direction.rotate(Math.PI / 2);
            const v = viewport ?? { xMin: -6, xMax: 6, yMin: -5, yMax: 5 };
            const length =
              Math.hypot(v.xMax - v.xMin, v.yMax - v.yMin) +
              Math.hypot(origin.x - v.xMin, origin.y - v.yMin);
            e.from = serialized(origin.translate(direction.multiply(-length)));
            e.to = serialized(origin.translate(direction.multiply(length)));
            break;
          }
          case "circle": {
            const center = at(parents[0]),
              radius = center.distanceTo(at(parents[1]))[0];
            if (radius <= 0) invalid("圆心与圆上点不能重合");
            e.center = serialized(center);
            e.rx = e.ry = String(radius);
            break;
          }
          default:
            invalid("不支持此构造");
        }
      } else {
        for (const key of ["at", "from", "to", "center"])
          if (e[key]) e[key] = serialized(point(e[key]));
        if (e.points) e.points = e.points.map((p) => serialized(point(p)));
        if (e.rx !== undefined) {
          e.rx = String(finiteCoordinate(e.rx, values));
          e.ry = String(finiteCoordinate(e.ry, values));
        }
      }
      resolved.set(id, e);
      return e;
    } catch (error) {
      resolved.set(id, null);
      if (error instanceof MathSourceError) throw error;
      invalid(`${id} 的几何构造无法确定，请检查输入点和直线`);
    } finally {
      visiting.delete(id);
    }
  }
  const result = [],
    undefinedIds = [];
  for (const e of elements) {
    if (visibleIds && !visibleIds.includes(e.id)) continue;
    try {
      result.push(resolve(e.id));
    } catch (error) {
      if (!tolerant) throw error;
      undefinedIds.push(e.id);
    }
  }
  return { elements: result, undefinedIds };
}

const vector3 = (p) => new Vector3(p.x, p.y, p.z);
function facePlane(points) {
  const origin = points[0],
    normal = new Vector3();
  for (let i = 1; i < points.length - 1; i++) {
    normal.crossVectors(
      points[i].clone().sub(origin),
      points[i + 1].clone().sub(origin),
    );
    if (normal.lengthSq() > 1e-18) break;
  }
  if (normal.lengthSq() <= 1e-18) invalid("面的顶点不能共线");
  const plane = new Plane().setFromNormalAndCoplanarPoint(
    normal.normalize(),
    origin,
  );
  const scale = Math.max(1, ...points.map((p) => p.distanceTo(origin)));
  if (points.some((p) => Math.abs(plane.distanceToPoint(p)) > scale * 1e-8))
    invalid("面的顶点必须共面");
  const u = points
      .find((p) => p.distanceTo(origin) > 1e-9)
      .clone()
      .sub(origin)
      .normalize(),
    v = new Vector3().crossVectors(plane.normal, u);
  const polygon = new Polygon(
    points.map((p) => {
      const d = p.clone().sub(origin);
      return [d.dot(u), d.dot(v)];
    }),
  );
  if (!polygon.isValid() || polygon.area() <= 1e-12)
    invalid("面的顶点须沿边界顺序排列，不能自交");
  return plane;
}
export function spatialSurfaces(source) {
  const points = new Map(source.points.map((p) => [p.id, vector3(p)]));
  const faces = (source.faces ?? []).map((face) => {
    const vertices = face.vertices.map((id) => points.get(id));
    if (vertices.some((p) => !p)) invalid("面引用了不存在的顶点");
    return {
      ...face,
      points: vertices,
      plane: facePlane(vertices),
      kind: "face",
    };
  });
  const sections = (source.sections ?? []).map((section) => {
    // A closed convex shell is required. A wireframe alone does not define a solid.
    if (faces.length < 4) invalid("生成截面需要封闭凸多面体的面");
    const edges = new Map();
    for (const face of faces)
      for (let i = 0; i < face.vertices.length; i++) {
        const a = face.vertices[i],
          b = face.vertices[(i + 1) % face.vertices.length],
          key = [a, b].sort().join("\u0000");
        const edge = edges.get(key) ?? { a, b, count: 0 };
        edge.count++;
        edges.set(key, edge);
      }
    if ([...edges.values()].some((e) => e.count !== 2))
      invalid("截面需要封闭的多面体，每条边应连接两个面");
    const vertexIds = new Set(faces.flatMap((f) => f.vertices));
    const vertices = [...vertexIds].map((id) => points.get(id));
    if (
      vertices.every((p) => Math.abs(faces[0].plane.distanceToPoint(p)) < 1e-8)
    )
      invalid("多面体不能退化为平面");
    for (const face of faces) {
      const distances = vertices.map((p) => face.plane.distanceToPoint(p));
      if (distances.some((d) => d > 1e-7) && distances.some((d) => d < -1e-7))
        invalid("当前截面支持凸多面体");
    }
    const { a, b, c, d } = section.plane;
    const normal = new Vector3(a, b, c);
    if (normal.lengthSq() < 1e-18) invalid("截平面的法向量不能为零");
    const plane = new Plane(normal, -d).normalize(),
      hits = [];
    const add = (p) => {
      if (p && !hits.some((q) => q.distanceTo(p) < 1e-7)) hits.push(p.clone());
    };
    for (const { a, b } of edges.values()) {
      const start = points.get(a),
        end = points.get(b);
      if (Math.abs(plane.distanceToPoint(start)) < 1e-8) add(start);
      if (Math.abs(plane.distanceToPoint(end)) < 1e-8) add(end);
      add(plane.intersectLine(new Line3(start, end), new Vector3()));
    }
    if (hits.length < 3) invalid("截平面未切出有面积的截面");
    const center = hits
      .reduce((sum, p) => sum.add(p), new Vector3())
      .divideScalar(hits.length);
    const u = hits[0].clone().sub(center).normalize(),
      v = new Vector3().crossVectors(plane.normal, u);
    hits.sort((a, b) => {
      const aa = a.clone().sub(center),
        bb = b.clone().sub(center);
      return (
        Math.atan2(aa.dot(v), aa.dot(u)) - Math.atan2(bb.dot(v), bb.dot(u))
      );
    });
    facePlane(hits);
    return { ...section, points: hits, kind: "section" };
  });
  return { faces, sections };
}
