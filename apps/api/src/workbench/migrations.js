/**
 * Module migration runner.
 *
 * Every module owns `migrations/index.js` exporting an ordered
 * `migrations` array of `{id, up(db)}`; IDs are stable, prefixed with the
 * module ID, and append-only. The runner applies pending migrations in order,
 * writes the ledger row in the same transaction as the migration, and never
 * re-runs an applied ID. Startup calls this before the first request, so a
 * broken migration stops startup instead of serving a half-migrated database.
 *
 * The ledger is also an integrity check: an applied ID that the current
 * process no longer defines means the schema no longer matches the data, which
 * is a startup failure rather than a silent skip.
 */
import { moduleCatalogIdPattern } from '@teachbuddy/shared';

export function prefixForModule(moduleId) {
  return `${moduleId.replaceAll('-', '_')}_`;
}

function validateAndFlatten(moduleMigrations) {
  const flattened = [];
  const seen = new Map();

  for (const entry of moduleMigrations) {
    const moduleId = entry?.moduleId;
    if (typeof moduleId !== 'string' || !moduleCatalogIdPattern.test(moduleId)) {
      throw new Error(`Invalid migration module ID: ${String(moduleId)}`);
    }
    if (!Array.isArray(entry.migrations)) {
      throw new Error(`Module ${moduleId} must export an array of migrations.`);
    }
    const prefix = prefixForModule(moduleId);
    for (const migration of entry.migrations) {
      if (typeof migration?.id !== 'string' || !migration.id) {
        throw new Error(`Module ${moduleId} has a migration without a string ID.`);
      }
      if (!migration.id.startsWith(prefix)) {
        throw new Error(`Migration ${migration.id} must use the ${moduleId} prefix ${prefix}`);
      }
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${migration.id} must export a synchronous up(db).`);
      }
      if (seen.has(migration.id)) {
        throw new Error(`Duplicate migration ID ${migration.id} in ${moduleId} and ${seen.get(migration.id)}.`);
      }
      seen.set(migration.id, moduleId);
      flattened.push({ id: migration.id, moduleId, up: migration.up });
    }
  }

  return flattened;
}

export function createMigrationRunner({ db, clock = () => new Date() }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workbench_migrations (
      id TEXT PRIMARY KEY,
      moduleId TEXT NOT NULL,
      appliedAt TEXT NOT NULL
    );
  `);

  const selectApplied = db.prepare('SELECT id, moduleId FROM workbench_migrations ORDER BY rowid');
  const insertApplied = db.prepare(
    'INSERT INTO workbench_migrations (id, moduleId, appliedAt) VALUES (@id, @moduleId, @appliedAt)'
  );

  function appliedIds() {
    return selectApplied.all().map((row) => row.id);
  }

  return {
    appliedIds,

    /**
     * Apply every pending migration. Returns `{applied, skipped}` with the
     * migration IDs; throws on the first failure after rolling that migration
     * back, leaving the ledger consistent with the database.
     *
     * `knownModuleIds` are the module IDs the current catalog knows. An applied
     * migration whose module is no longer known (for example a test fixture
     * database started without its fixture set) is left untouched instead of
     * blocking startup; a migration removed from a still-known module is
     * append-only drift and stops startup.
     */
    run(moduleMigrations, { knownModuleIds = null } = {}) {
      const flattened = validateAndFlatten(moduleMigrations);
      const applied = selectApplied.all();
      const appliedSet = new Set(applied.map((row) => row.id));
      const defined = new Set(flattened.map((migration) => migration.id));
      const known = knownModuleIds ? new Set(knownModuleIds) : null;

      const missing = applied
        .filter((row) => !defined.has(row.id))
        .filter((row) => !known || known.has(row.moduleId))
        .map((row) => row.id);
      if (missing.length) {
        throw new Error(
          `Applied migrations are no longer defined: ${missing.join(', ')}. `
          + 'Module migrations are append-only; restore the definition or fix the database.'
        );
      }

      const result = { applied: [], skipped: [] };
      for (const migration of flattened) {
        if (appliedSet.has(migration.id)) {
          result.skipped.push(migration.id);
          continue;
        }

        const applyOne = db.transaction(() => {
          const returned = migration.up(db);
          if (returned && typeof returned.then === 'function') {
            throw new Error(`Migration ${migration.id} must be synchronous.`);
          }
          insertApplied.run({
            id: migration.id,
            moduleId: migration.moduleId,
            appliedAt: clock().toISOString()
          });
        });

        applyOne.immediate();
        result.applied.push(migration.id);
      }

      return result;
    }
  };
}
