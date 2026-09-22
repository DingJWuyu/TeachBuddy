/**
 * Test-only module whose migration always fails.
 */
import express from 'express';

export function createWorkbenchBrokenModule() {
  return { router: express.Router(), port: {} };
}
