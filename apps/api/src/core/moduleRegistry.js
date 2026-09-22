/**
 * Legacy workspace-shell registry.
 *
 * The workspace-layout routes validate module ids against this list, and it is
 * empty: the first-flow catalog lives in `@refatos/shared` and is projected by
 * the workbench composition (`apps/api/src/workbench/`), which owns the exact
 * `GET /api/modules` contract path and mounts modules under
 * `/api/modules/<id>`. Filling this with stub modules to satisfy a check would
 * be wrong.
 */
const registeredModules = [];

export function getModuleManifests() {
  return registeredModules.map((moduleItem) => ({ ...moduleItem.manifest }));
}

export function registerModules(context) {
  for (const moduleItem of registeredModules) {
    moduleItem.register(context);
  }
}
