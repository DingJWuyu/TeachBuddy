import { deviceRequestStore } from '../workbench/deviceRequestStore.js';
export function uploadDraft(account, action, value) {
  return deviceRequestStore({ database: 'teachbuddy.math.uploads', storeName: 'pending',
    account, name: 'pending:math-upload', action, value });
}
