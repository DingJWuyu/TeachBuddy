import { navigationLayoutSchema } from '@teachbuddy/shared';

// GET/PUT /api/workbench/navigation. Cookie + PageContext and the shared
// workbench Problem/Idempotency-Key rules apply to both operations.
export const navigationUpdateSchema = {
  type: 'object', additionalProperties: false, required: ['baseVersion', 'layout'],
  properties: {
    baseVersion: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    layout: navigationLayoutSchema
  }
};

export const navigationResponseSchema = {
  type: 'object', required: ['id', 'version', 'layout', 'updatedAt'],
  properties: {
    id: { type: 'string', const: 'navigation' },
    version: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    layout: navigationLayoutSchema,
    updatedAt: { anyOf: [{ type: 'null' }, { type: 'string', format: 'date-time' }] }
  }
};
