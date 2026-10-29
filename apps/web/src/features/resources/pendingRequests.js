import { deviceRequestStore, clearDeviceRequestAccount } from "../../platform/device/deviceRequestStore.js";

export function pendingStore(accountKey, value) {
  return deviceRequestStore({
    identity: "resources",
    account: accountKey,
    action: value === undefined ? "get" : value === null ? "delete" : "put",
    value,
  });
}

export async function clearResourceDeviceData(account) {
  await clearDeviceRequestAccount({ identity: 'resources', account });
}
