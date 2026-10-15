/**
 * Test-only fixture sets for the B12 public-seam evidence.
 *
 * Fixtures are never part of `@teachbuddy/shared`'s catalog or the production
 * build. The isolated runner and the API tests enable a set explicitly, with a
 * catalog override and extra implementation mapping; production refuses both.
 */
export const fixtureSets = Object.freeze({
  'workbench-probe': Object.freeze({
    implementations: {
      'workbench-probe': {
        factory: () => import('./modules/workbench-probe/index.js'),
        migrations: () => import('./modules/workbench-probe/migrations/index.js')
      }
    },
    entries: [
      {
        id: 'workbench-probe',
        name: '底座探针',
        path: '/workbench-probe',
        navigation: 'sidebar',
        auxiliaryPanel: false,
        webEnabled: true,
        requires: []
      }
    ]
  }),

  // A module whose migration always fails: proves a broken migration stops
  // startup instead of serving a half-migrated database.
  'workbench-broken': Object.freeze({
    implementations: {
      'workbench-broken': {
        factory: () => import('./broken/workbench-broken/index.js'),
        migrations: () => import('./broken/workbench-broken/migrations/index.js')
      }
    },
    entries: [
      {
        id: 'workbench-broken',
        name: '底座坏迁移',
        path: '/workbench-broken',
        navigation: 'sidebar',
        auxiliaryPanel: false,
        webEnabled: true,
        requires: []
      }
    ]
  })
});

export function resolveFixtureSets(names) {
  const implementations = {};
  const entries = [];
  for (const name of names) {
    const set = fixtureSets[name];
    if (!set) throw new Error(`Unknown fixture set: ${name}`);
    Object.assign(implementations, set.implementations);
    entries.push(...set.entries);
  }
  return { implementations, entries };
}
