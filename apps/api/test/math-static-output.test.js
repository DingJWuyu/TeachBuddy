import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { startMathFixture } from "../../web/e2e/fixtures/math-static/server.mjs";
const samples = JSON.parse(
  fs.readFileSync(
    new URL(
      "./fixtures/contracts/math-samples.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
test("actual HTTP SVG/PNG: Q2 coordinates, Q5 labels, Q6 explicit edge", async () => {
  const dataDir = "test-results/m41/output";
  fs.mkdirSync(dataDir, { recursive: true });
  const f = await startMathFixture({ dataDir, port: 47414 });
  const cookie = f.workbench.identity
    .testPrincipalCookie("m41-a")
    .header.split(";")[0];
  const request = async (path, input) => {
    const r = await fetch(f.origin + "/api/modules/math/v1/works" + path, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: f.origin,
        "X-TeachBuddy-Request": "1",
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(input),
    });
    const body = await r.json();
    assert.equal(r.status, 201, JSON.stringify(body));
    return body;
  };
  try {
    for (const [name, sample] of [
      ["Q2", "create-plane"],
      ["Q5", "create-triangle"],
      ["Q6", "create-space"],
    ]) {
      const input = structuredClone(samples.find((s) => s.id === sample).value);
      input.title = name;
      if (name === "Q2") {
        const elements = input.source.scene.elements;
        elements[0].expression = "x^2-2*x-2";
        elements[0].label.text = "y=x²-2x-2";
        elements[1].at.y = "-3";
        elements[1].label.text = "顶点 (1,-3)";
        elements[2].at.x = "1-sqrt(3)";
        elements[2].label.text = "1-√3";
        elements[3].at.x = "1+sqrt(3)";
        elements[3].label.text = "1+√3";
      }
      if (name === "Q5") {
        input.source.scene.elements[6].style.stroke = "#cc2222";
        input.source.scene.elements[7].at.x = "-0.5";
      }
      if (name === "Q6") input.source.edges.at(-1).style.dash = "dashed";
      const work = await request("", input);
      const outputs = {};
      for (const format of ["svg", "png"]) {
        const exported = await request(`/${work.id}/exports`, {
          version: 1,
          format,
          width: 1600,
          background: "transparent",
        });
        const response = await fetch(
          `${f.origin}/api/workbench/files/${exported.file.id}/content`,
          { headers: { Cookie: cookie } },
        );
        assert.equal(response.status, 200);
        const bytes = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(`${dataDir}/${name}.${format}`, bytes);
        outputs[format] = bytes;
      }
      const svg = outputs.svg.toString();
      assert.doesNotMatch(svg.replace(/<style>[\s\S]*?<\/style>/g, ""), /NaN|Infinity/);
      if (name === "Q2") {
        // Frozen viewport 800x720, x[-5,5], y[-6,6], 34px inset:
        // scale=652/12. Expected vertex pixel (454.33333,523).
        assert.match(svg, /<circle cx="454\.33333" cy="523"/);
        const curve = svg.match(/data-object="f">([\s\S]*?)<\/g>/)[1];
        const curvePoints = [
          ...curve.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g),
        ].map((m) => [+m[1], +m[2]]);
        function distance(x, y) {
          return Math.min(
            ...curvePoints.slice(1).map((b, i) => {
              const a = curvePoints[i],
                dx = b[0] - a[0],
                dy = b[1] - a[1],
                t = Math.max(
                  0,
                  Math.min(
                    1,
                    ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy),
                  ),
                );
              return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
            }),
          );
        }
        assert(distance(454.33333, 523) < 0.35);
        for (const x of [1 - Math.sqrt(3), 1 + Math.sqrt(3)])
          assert(distance(400 + (x * 652) / 12, 360) < 0.35);
      }
      if (name === "Q5") {
        assert.match(svg, />4<\/tspan>/);
        assert.match(svg, />3<\/tspan>/);
        assert.match(svg, /fill="#cc2222"/);
        assert.match(svg, /M156 543 L644 543/);
        assert.match(svg, /M156 543 L156 177/);
      }
      if (name === "Q6") {
        assert.match(svg, /stroke-dasharray="8 5"/);
        assert.match(svg, />C1<\/tspan>/);
        assert.match(svg, /M400 360 L696\.88285 196\.64819/);
      }
      fs.writeFileSync(
        `${dataDir}/${name}.json`,
        JSON.stringify(work, null, 2),
      );
    }
  } finally {
    await f.close();
  }
});
