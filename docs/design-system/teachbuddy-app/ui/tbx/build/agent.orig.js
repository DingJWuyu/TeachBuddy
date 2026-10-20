var TeachBuddyAdapters;
(TeachBuddyAdapters ||= {}).agent = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // prototype/current-ui/data/data/agent.js
  var agent_exports = {};
  __export(agent_exports, {
    handleAgent: () => handleAgent
  });
  var MODEL_IDS = ["deepseek/deepseek-v4.1-flash", "z-ai/glm-5.3-flash"];
  var emptyUsage = () => ({ input: null, output: null, cacheRead: null, cacheWrite: null, reasoning: null, totalTokens: null, requestsStarted: 0, requestsReported: 0, complete: false, actualCost: null });
  var copy = (value) => structuredClone(value);
  function agentFailure(code, extra = {}) {
    const status = ["draft-conflict", "reference-conflict", "turn-active", "pending-operation", "cursor-ahead"].includes(code) ? 409 : code === "model-not-allowed" ? 422 : 503;
    const title = { "draft-conflict": "\u8349\u7A3F\u5DF2\u5728\u5176\u4ED6\u8BBE\u5907\u4FEE\u6539", "reference-conflict": "\u5F15\u7528\u5185\u5BB9\u5DF2\u53D8\u66F4", "model-unavailable": "AI \u6682\u4E0D\u53EF\u7528" }[code] ?? "\u6682\u65F6\u65E0\u6CD5\u5B8C\u6210\u64CD\u4F5C";
    return Object.assign(new Error(title), { status, problem: { type: `/problems/agent/${code}`, status, title, ...extra } });
  }
  function workbenchFailure(code, status = 422, extra = {}) {
    return Object.assign(new Error(code), { status, problem: { type: `/problems/workbench/${code}`, ...extra } });
  }
  function invalid(field, reason = "invalid-type") {
    return workbenchFailure("invalid-input", 422, { field, reason });
  }
  function answerFor(text) {
    if (/二次函数|抛物线/.test(text)) return "\u8BB2\u89E3\u4E8C\u6B21\u51FD\u6570\u65F6\uFF0C\u53EF\u4EE5\u4ECE\u56FE\u50CF\u5165\u624B\uFF0C\u5F15\u5BFC\u5B66\u751F\u89C2\u5BDF\u5F00\u53E3\u65B9\u5411\u3001\u5BF9\u79F0\u8F74\u548C\u9876\u70B9\uFF0C\u518D\u628A\u8FD9\u4E9B\u7279\u5F81\u4E0E\u8868\u8FBE\u5F0F\u4E2D\u7684\u7CFB\u6570\u5BF9\u5E94\u3002\u8BFE\u5802\u4E0A\u5148\u6BD4\u8F83\u4E24\u6761\u629B\u7269\u7EBF\uFF0C\u968F\u540E\u5B89\u6392\u4E00\u9053\u53D8\u5F0F\u9898\uFF0C\u8BA9\u5B66\u751F\u8BF4\u660E\u81EA\u5DF1\u7684\u5224\u65AD\u4F9D\u636E\u3002";
    if (/分数/.test(text)) return "\u53EF\u4EE5\u5148\u7528\u6570\u8F74\u6216\u56FE\u5F62\u8BF4\u660E\u5206\u6570\u7684\u610F\u4E49\uFF0C\u518D\u8BA9\u5B66\u751F\u6BD4\u8F83\u4E0D\u540C\u8868\u793A\u65B9\u6CD5\u3002\u7EC3\u4E60\u65F6\u4ECE\u540C\u5206\u6BCD\u60C5\u5883\u5F00\u59CB\uFF0C\u9010\u6B65\u8FC7\u6E21\u5230\u901A\u5206\uFF0C\u5E76\u8BF7\u5B66\u751F\u89E3\u91CA\u6BCF\u4E00\u6B65\u4E3A\u4EC0\u4E48\u4FDD\u6301\u6570\u503C\u4E0D\u53D8\u3002";
    if (/几何|三角形|圆/.test(text)) return "\u53EF\u4EE5\u5148\u8BA9\u5B66\u751F\u753B\u56FE\u5E76\u6807\u51FA\u5DF2\u77E5\u6761\u4EF6\uFF0C\u518D\u8BA8\u8BBA\u80FD\u591F\u4F7F\u7528\u7684\u6027\u8D28\u3002\u8BB2\u89E3\u65F6\u628A\u63A8\u7406\u8FC7\u7A0B\u5206\u6210\u51E0\u4E2A\u5C0F\u6B65\u9AA4\uFF0C\u6BCF\u4E00\u6B65\u90FD\u8BF4\u660E\u4F9D\u636E\uFF0C\u6700\u540E\u7528\u4E00\u9053\u6761\u4EF6\u7565\u6709\u53D8\u5316\u7684\u9898\u76EE\u68C0\u67E5\u7406\u89E3\u3002";
    return "\u53EF\u4EE5\u628A\u8FD9\u9879\u6559\u5B66\u51C6\u5907\u5206\u6210\u4E09\u6B65\uFF1A\u5148\u660E\u786E\u5B66\u751F\u9700\u8981\u638C\u63E1\u7684\u6838\u5FC3\u77E5\u8BC6\uFF0C\u518D\u7528\u4E00\u4E2A\u5177\u4F53\u4F8B\u5B50\u5F15\u5BFC\u601D\u8003\uFF0C\u6700\u540E\u5B89\u6392\u7531\u57FA\u7840\u5230\u5E94\u7528\u7684\u7EC3\u4E60\u3002\u8BFE\u5802\u4E2D\u8BF7\u5B66\u751F\u8BF4\u51FA\u89E3\u9898\u4F9D\u636E\uFF0C\u5E76\u6839\u636E\u4ED6\u4EEC\u7684\u56DE\u7B54\u8C03\u6574\u8BB2\u89E3\u8282\u594F\u3002";
  }
  async function handleAgent(req, ctx) {
    const base = "/api/agent";
    if (req.path !== base && !req.path.startsWith(`${base}/`)) return void 0;
    const state = ctx.state.agent ??= { conversations: {}, events: {}, subscribers: /* @__PURE__ */ new Map(), runs: /* @__PURE__ */ new Map(), receipts: {} };
    const stamp = () => {
      const value = ctx.now();
      return value instanceof Date ? value.toISOString() : typeof value === "number" ? new Date(value).toISOString() : String(value);
    };
    const list = () => Object.values(state.conversations);
    const active = () => list().flatMap((doc) => doc.turns).find((turn) => turn.state === "running");
    const read = (id) => {
      const doc = state.conversations[id];
      if (!doc) throw workbenchFailure("not-found", 404);
      return doc;
    };
    function emit(doc, type, value) {
      const conversationId = doc.conversation.id;
      const event = { seq: ++doc.lastEventSeq, conversationId, type, value: copy(value) };
      (state.events[conversationId] ??= []).push(event);
      for (const subscriber of state.subscribers.get(conversationId) ?? []) subscriber(event);
    }
    function updated(doc) {
      doc.conversation.updatedAt = stamp();
      emit(doc, "conversation", doc.conversation);
    }
    function finish(doc, turn, stopped = false) {
      const run = state.runs.get(turn.id);
      if (run) clearTimeout(run.timer);
      state.runs.delete(turn.id);
      if (turn.state !== "running") return;
      turn.state = stopped ? "stopped" : "completed";
      turn.reason = stopped ? "user-stop" : null;
      turn.endedAt = stamp();
      emit(doc, "turn", turn);
      for (const message of doc.messages.filter((message2) => message2.turnId === turn.id && message2.role === "assistant")) {
        message.state = stopped ? "partial" : "complete";
        emit(doc, "message", message);
      }
      updated(doc);
    }
    function startReply(doc, turn, prompt) {
      const characters = Array.from(answerFor(prompt));
      const message = { id: ctx.id(), turnId: turn.id, role: "assistant", text: "", references: [], state: "streaming", createdAt: stamp() };
      const run = { timer: null, offset: 0 };
      state.runs.set(turn.id, run);
      function advance() {
        if (turn.state !== "running") return;
        if (!doc.messages.some((item) => item.id === message.id)) doc.messages.push(message);
        run.offset = Math.min(run.offset + 7, characters.length);
        message.text = characters.slice(0, run.offset).join("");
        emit(doc, "message", message);
        updated(doc);
        if (run.offset === characters.length) finish(doc, turn);
        else run.timer = setTimeout(advance, 110);
      }
      run.timer = setTimeout(advance, 400);
    }
    async function references(inputs, sending) {
      if (!Array.isArray(inputs)) throw invalid("/body/references");
      const seen = /* @__PURE__ */ new Set();
      const result = [];
      for (const [index, input] of inputs.entries()) {
        const key = `${input.kind}:${input.id}:${input.sectionId ?? ""}`;
        if (input.kind !== "question" || seen.has(key)) throw invalid(`/body/references/${index}`);
        seen.add(key);
        const response = await fetch(`/api/modules/questions/v2/items/${encodeURIComponent(input.id)}`);
        if (!response.ok) throw workbenchFailure("not-found", 404);
        const object = await response.json();
        if (sending && (object.version !== input.version || object.deletedAt !== null || input.sectionId && !object.sections.some((section) => section.id === input.sectionId))) throw agentFailure("reference-conflict", { field: `/body/references/${index}`, currentVersion: object.version });
        result.push({ input: copy(input), title: object.title, snapshot: object, capturedAt: stamp() });
      }
      return result;
    }
    const path = req.path.slice(base.length);
    const method = req.method.toUpperCase();
    const body = req.body;
    const receiptKey = req.headers.get("Idempotency-Key");
    const fingerprint = JSON.stringify([method, req.path, body]);
    const reply = (value, status = 200) => {
      if (method !== "GET" && receiptKey) state.receipts[receiptKey] = { fingerprint, body: copy(value), status };
      return ctx.json(value, status);
    };
    try {
      if (method !== "GET" && receiptKey && state.receipts[receiptKey]) {
        const receipt = state.receipts[receiptKey];
        if (receipt.fingerprint !== fingerprint) throw workbenchFailure("idempotency-key-reused", 409);
        return ctx.json(receipt.body, receipt.status);
      }
      if (!path.endsWith("/events") && req.url.search) throw invalid(`/query/${req.url.searchParams.keys().next().value}`, "unknown-field");
      if (path === "/configuration" && method === "GET") {
        const turn = active();
        return reply({ models: MODEL_IDS.map((id2) => ({ id: id2, state: "ready" })), defaultModelId: MODEL_IDS[0], activeTurn: turn ? { conversationId: turn.conversationId, turnId: turn.id } : null, billing: { actualCost: null, balance: null } });
      }
      if (path === "/conversations") {
        if (method === "GET") return reply({ items: list().map((doc2) => doc2.conversation).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)) });
        if (method === "POST") {
          const now = stamp();
          const id2 = ctx.id();
          const snapshot = { conversation: { id: id2, title: "\u65B0\u5BF9\u8BDD", createdAt: now, updatedAt: now }, draft: { version: 1, text: "", references: [], updatedAt: now }, messages: [], turns: [], operations: [], toolCalls: [], lastEventSeq: 0 };
          state.conversations[id2] = snapshot;
          state.events[id2] = [];
          return reply(snapshot, 201);
        }
      }
      const match = /^\/conversations\/([^/]+)(?:\/(.*))?$/.exec(path);
      if (!match) throw workbenchFailure("not-found", 404);
      const [, id, action] = match;
      const doc = read(id);
      if (!action && method === "GET") return reply(doc);
      if (action === "events" && method === "GET") {
        const params = [...req.url.searchParams];
        const after = req.url.searchParams.get("after") ?? "0";
        if (params.some(([key]) => key !== "after") || params.length > 1 || !/^\d+$/.test(after) || !Number.isSafeInteger(Number(after))) throw invalid("/query/after");
        let cursor = Number(after);
        if (cursor > doc.lastEventSeq) throw agentFailure("cursor-ahead");
        const encoder = new TextEncoder();
        let remove = () => {
        };
        const stream = new ReadableStream({
          start(controller) {
            let closed = false;
            let heartbeat;
            const subscribers = state.subscribers.get(id) ?? /* @__PURE__ */ new Set();
            state.subscribers.set(id, subscribers);
            remove = () => {
              if (closed) return;
              closed = true;
              clearInterval(heartbeat);
              subscribers.delete(send);
              if (!subscribers.size) state.subscribers.delete(id);
              req.signal?.removeEventListener("abort", remove);
              try {
                controller.close();
              } catch {
              }
            };
            const send = (event) => {
              if (closed || event.seq <= cursor) return;
              try {
                controller.enqueue(encoder.encode(`id: ${event.seq}
event: change
data: ${JSON.stringify(event)}

`));
                cursor = event.seq;
              } catch {
                remove();
              }
            };
            subscribers.add(send);
            for (const event of state.events[id] ?? []) send(event);
            heartbeat = setInterval(() => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(": heartbeat\n\n"));
              } catch {
                remove();
              }
            }, 1e4);
            req.signal?.addEventListener("abort", remove, { once: true });
            if (req.signal?.aborted) remove();
          },
          cancel() {
            remove();
          }
        });
        return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
      }
      if (action === "draft" && method === "PUT") {
        if (!body || typeof body.text !== "string" || !Number.isInteger(body.baseVersion)) throw invalid("/body");
        if (doc.draft.version !== body.baseVersion) throw agentFailure("draft-conflict", { currentVersion: doc.draft.version });
        await references(body.references, false);
        if (doc.draft.version !== body.baseVersion) throw agentFailure("draft-conflict", { currentVersion: doc.draft.version });
        doc.draft = { version: doc.draft.version + 1, text: body.text, references: copy(body.references), updatedAt: stamp() };
        emit(doc, "draft", doc.draft);
        updated(doc);
        return reply(doc.draft);
      }
      if (action === "turns" && method === "POST") {
        if (!MODEL_IDS.includes(body?.modelId)) throw agentFailure("model-not-allowed");
        if (active()) throw agentFailure("turn-active");
        if (list().some((doc2) => doc2.operations.some((operation) => ["executing", "unconfirmed"].includes(operation.state)))) throw agentFailure("pending-operation");
        const draft = copy(doc.draft);
        if (draft.version !== body.draftVersion) throw agentFailure("draft-conflict", { currentVersion: draft.version });
        if (!draft.text.trim()) throw invalid("/body/text", "required");
        const refs = await references(draft.references, true);
        if (active()) throw agentFailure("turn-active");
        if (doc.draft.version !== draft.version) throw agentFailure("draft-conflict", { currentVersion: doc.draft.version });
        const now = stamp();
        const turnId = ctx.id();
        const message = { id: ctx.id(), turnId, role: "user", text: draft.text, references: refs, state: "complete", createdAt: now };
        const turn = { id: turnId, conversationId: id, userMessageId: message.id, modelId: body.modelId, state: "running", reason: null, createdAt: now, endedAt: null, usage: emptyUsage() };
        if (!doc.messages.length) doc.conversation.title = Array.from(draft.text).slice(0, 32).join("");
        doc.messages.push(message);
        doc.turns.push(turn);
        doc.draft = { version: draft.version + 1, text: "", references: [], updatedAt: now };
        emit(doc, "message", message);
        emit(doc, "turn", turn);
        emit(doc, "draft", doc.draft);
        updated(doc);
        const result = reply({ turn, message, draft: doc.draft }, 202);
        startReply(doc, turn, draft.text);
        return result;
      }
      const stop = /^turns\/([^/]+)\/stop$/.exec(action ?? "");
      if (stop && method === "POST") {
        const turn = doc.turns.find((turn2) => turn2.id === stop[1]);
        if (!turn) throw workbenchFailure("not-found", 404);
        finish(doc, turn, true);
        return reply(turn);
      }
      const reconcile = /^operations\/([^/]+)\/reconcile$/.exec(action ?? "");
      if (reconcile && method === "POST") {
        const operation = doc.operations.find((operation2) => operation2.id === reconcile[1]);
        if (!operation) throw workbenchFailure("not-found", 404);
        if (active()) throw agentFailure("turn-active");
        return reply(operation);
      }
      throw workbenchFailure("not-found", 404);
    } catch (error) {
      if (error.problem) return ctx.problem(error.problem.type, error.status, error.problem);
      throw error;
    }
  }
  return __toCommonJS(agent_exports);
})();
