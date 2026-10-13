// Explicit unconnected adapters. These never claim business success.
export function unconnectedHandlers() {
  const make = () => ({
    fixture: true,
    async run() {
      return {
        state: "failed",
        outputFileIds: [],
        issues: [
          {
            code: "provider-unavailable",
            unitId: null,
            field: null,
            detail: "业务处理器尚未接入。",
          },
        ],
      };
    },
    retry() {
      throw new Error("Business handler is not connected");
    },
  });
  return { extraction: make(), "question-asset": make() };
}
