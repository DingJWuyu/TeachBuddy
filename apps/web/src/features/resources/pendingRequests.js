import { deviceRequestStore, clearDeviceRequestAccount } from "../../platform/device/deviceRequestStore.js";

export function pendingStore(accountKey, value) {
  return deviceRequestStore({
    database: "teachbuddy-resources-pending",
    storeName: "requests",
    account: accountKey,
    name: "pending:resources",
    action: value === undefined ? "get" : value === null ? "delete" : "put",
    value,
  });
}

export async function clearResourceDeviceData(account) {
  await clearDeviceRequestAccount({ database: 'teachbuddy-resources-pending', storeName: 'requests', account });
}
