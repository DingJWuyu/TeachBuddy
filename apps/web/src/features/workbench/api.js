import { workbenchGet } from '../../platform/http/apiClient.js';

export function getWorkbenchContext() {
  return workbenchGet('/api/workbench/context');
}
