import { deviceRequestStore, clearDeviceRequestAccount } from '../../platform/device/deviceRequestStore.js';
export function uploadDraft(account, action, value) {
  return deviceRequestStore({ database: 'teachbuddy.math.uploads', storeName: 'pending',
    account, name: 'pending:math-upload', action, value });
}

export async function clearMathDeviceData(account) {
  localStorage.removeItem(`teachbuddy.math.${account}`);
  await clearDeviceRequestAccount({ database: 'teachbuddy.math.uploads', storeName: 'pending', account });
}
