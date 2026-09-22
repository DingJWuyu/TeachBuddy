import { createHash } from "node:crypto";
// Internal file writes have stable keys independent of the user's accepted key.
export function stableRequestKey(owner, unit) {
  const hex = createHash("sha256")
    .update(owner + ":" + unit)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
