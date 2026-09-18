import { moduleCatalog } from '@refatos/shared';

// The module directory is intentionally empty in the workspace baseline.
// Keeping registration as a small seam lets a future module contribute its
// manifest and private backend routes without changing the application shell.
const registeredModules = [];

export function getModuleManifests() {
  return registeredModules.map((moduleItem) => ({ ...moduleItem.manifest }));
}

export function registerModules(context) {
  for (const moduleItem of registeredModules) {
    moduleItem.register(context);
  }
}

// Make an accidental catalog/registry mismatch explicit when a module is
// introduced without its backend contribution.
if (registeredModules.length !== moduleCatalog.length) {
  throw new Error('The module directory and shared module catalog must agree.');
}
