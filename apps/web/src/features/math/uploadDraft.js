import { deviceRequestStore, clearDeviceRequestAccount } from '../../platform/device/deviceRequestStore.js';
export function uploadDraft(account, action, value) {
  return deviceRequestStore({ identity: 'math', account, action, value });
}

export async function clearMathDeviceData(account) {
  localStorage.removeItem(`teachbuddy.math.${account}`);
  await clearDeviceRequestAccount({ identity: 'math', account });
}
