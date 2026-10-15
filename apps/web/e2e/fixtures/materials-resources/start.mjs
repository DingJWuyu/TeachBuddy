import path from "node:path";
import { startResourcesFixture } from "../../../../api/test/fixtures/resources/server.mjs";
const fixture = await startResourcesFixture({
  dataDir: path.resolve(
    process.env.R32_DATA_DIR ?? "test-results/r32-browser/data",
  ),
  port: Number(process.env.R32_PORT ?? 48433),
  webDist: path.resolve("test-results/r32-browser/web"),
});
console.log(fixture.origin + "/fixture/session");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await fixture.close();
    process.exit(0);
  });
