// The shell keeps this neutral registration seam while the current module
// directory remains empty.
export const frontendModules = Object.freeze([]);

export function getFrontendModule(moduleId) {
  return frontendModules.find((moduleItem) => moduleItem.id === moduleId);
}
