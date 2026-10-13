/** Compile-time implementations for the shared v4 catalog. */
export const moduleImplementations = Object.freeze({
  classroom: Object.freeze({ factory: () => import('../modules/classroom/index.js'), migrations: () => import('../modules/classroom/migrations/index.js') }),
  questions: Object.freeze({ factory: () => import('../modules/questions/index.js'), migrations: () => import('../modules/questions/migrations/index.js') }),
  math: Object.freeze({ factory: () => import('../modules/math/index.js'), migrations: () => import('../modules/math/migrations.js') }),
  resources: Object.freeze({ factory: () => import('../modules/resources/index.js'), migrations: () => import('../modules/resources/migrations/index.js') }),
  schedule: Object.freeze({ factory: () => import('./teachingTime.js'), migrations: () => import('./teachingTime.js') })
});
