/** Compile-time implementations for the shared v4 catalog. */
export const moduleImplementations = Object.freeze({
  classroom: Object.freeze({ maintenance: () => import('../modules/classroom/lifecycle.js'), factory: () => import('../modules/classroom/index.js'), migrations: () => import('../modules/classroom/migrations/index.js') }),
  questions: Object.freeze({ maintenance: () => import('../modules/questions/lifecycle.js'), factory: () => import('../modules/questions/index.js'), migrations: () => import('../modules/questions/migrations/index.js') }),
  math: Object.freeze({ maintenance: () => import('../modules/math/lifecycle.js'), factory: () => import('../modules/math/index.js'), migrations: () => import('../modules/math/migrations.js') }),
  resources: Object.freeze({ maintenance: () => import('../modules/resources/lifecycle.js'), factory: () => import('../modules/resources/index.js'), migrations: () => import('../modules/resources/migrations/index.js') }),
  schedule: Object.freeze({ maintenance: () => import('../modules/schedule/lifecycle.js'), factory: () => import('../modules/schedule/index.js'), migrations: () => import('../modules/schedule/index.js') })
});
