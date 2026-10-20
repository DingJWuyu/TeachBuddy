var TeachBuddyAdapters;
(TeachBuddyAdapters ||= {}).auth = (() => {
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

  // prototype/current-ui/data/data/auth.js
  var auth_exports = {};
  __export(auth_exports, {
    handleAuth: () => handleAuth
  });
  var VERIFICATION_CODE = "123456";
  var EMAIL = /^(?=.{1,254}$)(?=.{1,64}@)[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$(?![\s\S])/;
  var ID = /^[A-Za-z0-9_-]{1,200}$(?![\s\S])/;
  var SHAPES = {
    login: { email: "string", password: "string", rememberMe: "boolean" },
    "registration-codes": { email: "string" },
    register: { email: "string", nickname: "string", password: "string", challengeId: "string", verificationCode: "string", termsAccepted: "boolean", rememberMe: "boolean" },
    "password-reset-codes": { email: "string" },
    "password-reset": { verificationCode: "string", password: "string", challengeId: "string", email: "string" },
    profile: { nickname: "string" },
    logout: { sessionId: "nullable-string" },
    "account-deletion": { requestId: "string", sessionId: "string", email: "string" }
  };
  async function handleAuth(req, ctx) {
    const endpoint = req.path.replace(/^\/api\/auth\//, "");
    if (!req.path.startsWith("/api/auth/") || !SHAPES[endpoint] && endpoint !== "session") return void 0;
    if (req.method !== "POST" && !(endpoint === "session" && req.method === "GET")) return void 0;
    const state = ctx.state;
    const local = state.authLocal ??= {
      accounts: /* @__PURE__ */ new Map(),
      challenges: /* @__PURE__ */ new Map(),
      deletions: /* @__PURE__ */ new Map(),
      browserReady: false
    };
    const now = () => Date.parse(ctx.now());
    const iso = (value) => new Date(value).toISOString();
    const fail = (type, field, extra = {}, status2 = 422) => {
      throw { authProblem: true, type, status: status2, extra: { ...extra, ...field ? { field } : {} } };
    };
    const shape = (body, schema) => {
      if (!body || typeof body !== "object" || Array.isArray(body) || body instanceof FormData) fail("invalid-request-body");
      for (const key of Object.keys(body)) if (!(key in schema)) fail("unknown-field");
      for (const key of Object.keys(schema)) if (!(key in body)) fail("required-field", key);
      for (const [key, type] of Object.entries(schema)) {
        if (!(type === "nullable-string" ? body[key] === null || typeof body[key] === "string" : typeof body[key] === type)) fail("invalid-field-type", key);
      }
      return body;
    };
    const emailValue = (value) => {
      const email = value.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase());
      if (!email) fail("email-empty", "email");
      if (!EMAIL.test(email)) fail("email-invalid-format", "email");
      return email;
    };
    const nicknameValue = (value) => {
      const nickname = value.trim();
      if (!nickname) fail("nickname-empty", "nickname");
      if (Array.from(nickname).length > 40) fail("nickname-too-long", "nickname");
      return nickname;
    };
    const passwordValue = (value) => {
      if (Array.from(value).length < 8) fail("password-too-short", "password");
      if (Array.from(value).length > 128) fail("password-too-long", "password");
      return value;
    };
    const idValue = (value, field) => {
      if (!ID.test(value)) fail("invalid-field-value", field);
      return value;
    };
    const accountFor = (email, password = null, nickname = null) => {
      let entry = local.accounts.get(email);
      if (!entry) {
        entry = { account: { accountKey: ctx.id(), email, nickname: nickname || Array.from(email.split("@")[0]).slice(0, 40).join("") }, password };
        local.accounts.set(email, entry);
      }
      return entry;
    };
    const currentSession = () => {
      if (state.session?.expiresAt && now() >= Date.parse(state.session.expiresAt)) state.session = null;
      return state.session ?? null;
    };
    const status = () => {
      const session = currentSession();
      return {
        browserReady: local.browserReady,
        registrationOpen: true,
        session,
        rememberedSession: session?.state === "active" && session.persistence === "remembered" ? { id: session.id, expiresAt: session.expiresAt } : null,
        serverTime: ctx.now()
      };
    };
    const pendingSession = (account, rememberMe) => {
      local.browserReady = true;
      state.account = account;
      state.session = {
        id: ctx.id(),
        account,
        state: "pending",
        persistence: "page",
        rememberRequested: rememberMe,
        issuedAt: ctx.now(),
        expiresAt: rememberMe ? iso(now() + 30 * 24 * 60 * 60 * 1e3) : null
      };
      return state.session;
    };
    const requireSession = (sessionId) => {
      const session = currentSession();
      if (!session || sessionId && session.id !== sessionId) fail("session-invalid", null, {}, 401);
      return session;
    };
    const issueChallenge = (email, purpose) => {
      const previous = [...local.challenges.values()].reverse().find((value) => value.email === email && value.purpose === purpose);
      const at = now();
      if (previous && at < Date.parse(previous.resendAt)) {
        fail("code-send-cooldown", null, { retryAfterSeconds: Math.ceil((Date.parse(previous.resendAt) - at) / 1e3), resendAt: previous.resendAt }, 429);
      }
      if (previous && !previous.consumedAt) previous.replacedAt = ctx.now();
      const challenge = {
        challengeId: ctx.id(),
        purpose,
        email,
        issuedAt: iso(at),
        expiresAt: iso(at + 6e5),
        resendAt: iso(at + 3e4),
        serverTime: iso(at),
        remainingAttempts: 5
      };
      local.challenges.set(challenge.challengeId, challenge);
      return { ...challenge };
    };
    const verifyChallenge = (body, email, purpose) => {
      if (body.challengeId === "") fail("verification-code-missing", "verificationCode");
      idValue(body.challengeId, "challengeId");
      if (!/^[0-9]{6}$(?![\s\S])/.test(body.verificationCode)) fail("verification-code-invalid-format", "verificationCode");
      const challenge = local.challenges.get(body.challengeId);
      if (!challenge) fail("verification-code-missing", "verificationCode");
      if (challenge.email !== email || challenge.purpose !== purpose) fail("verification-code-binding-mismatch", "verificationCode");
      if (challenge.consumedAt) fail("verification-code-consumed", "verificationCode");
      if (challenge.replacedAt) fail("verification-code-replaced", "verificationCode");
      if (now() >= Date.parse(challenge.expiresAt)) fail("verification-code-expired", "verificationCode");
      if (challenge.remainingAttempts <= 0) fail("verification-code-exhausted", "verificationCode", { remainingAttempts: 0 });
      if (body.verificationCode !== VERIFICATION_CODE) {
        challenge.remainingAttempts -= 1;
        fail(challenge.remainingAttempts ? "verification-code-incorrect" : "verification-code-exhausted", "verificationCode", { remainingAttempts: challenge.remainingAttempts });
      }
      return challenge;
    };
    const empty = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    try {
      if (endpoint === "session") {
        if (req.method === "GET") return ctx.json(status());
        const body2 = req.body;
        if (!body2 || typeof body2 !== "object" || Array.isArray(body2)) fail("invalid-request-body");
        for (const key of Object.keys(body2)) if (!["action", "sessionId", "rememberMe"].includes(key)) fail("unknown-field");
        if (!("action" in body2)) fail("required-field", "action");
        if (typeof body2.action !== "string") fail("invalid-field-type", "action");
        const schema = { bootstrap: { action: "string" }, activate: { action: "string", sessionId: "string", rememberMe: "boolean" }, restore: { action: "string", sessionId: "string" } }[body2.action];
        if (!schema) fail("invalid-field-value", "action");
        shape(body2, schema);
        if (body2.action === "bootstrap") {
          local.browserReady = true;
          return ctx.json(status());
        }
        idValue(body2.sessionId, "sessionId");
        const session = requireSession(body2.sessionId);
        if (body2.action === "restore") {
          if (session.state !== "active" || session.persistence !== "remembered") fail("session-invalid", null, {}, 401);
        } else {
          const persistence = body2.rememberMe ? "remembered" : "page";
          if (session.state === "active" && session.persistence !== persistence || body2.rememberMe && !session.rememberRequested) fail("session-state-conflict", null, {}, 409);
          session.state = "active";
          session.persistence = persistence;
          if (!body2.rememberMe) session.expiresAt = null;
        }
        state.account = session.account;
        return ctx.json(status());
      }
      const body = shape(req.body, SHAPES[endpoint]);
      if (endpoint === "login") {
        const email = emailValue(body.email);
        const password = passwordValue(body.password);
        const entry = accountFor(email, password);
        if (entry.password !== null && entry.password !== password) fail("credentials-rejected", null, {}, 401);
        entry.password = password;
        return ctx.json(pendingSession(entry.account, body.rememberMe));
      }
      if (endpoint === "registration-codes" || endpoint === "password-reset-codes") {
        const email = emailValue(body.email);
        if (endpoint === "registration-codes" && local.accounts.has(email)) fail("email-already-registered", "email", {}, 409);
        if (endpoint === "password-reset-codes") accountFor(email);
        return ctx.json(issueChallenge(email, endpoint === "registration-codes" ? "registration" : "password-reset"));
      }
      if (endpoint === "register") {
        const email = emailValue(body.email);
        const nickname = nicknameValue(body.nickname);
        const password = passwordValue(body.password);
        if (!body.termsAccepted) fail("terms-not-accepted", "termsAccepted");
        const challenge = verifyChallenge(body, email, "registration");
        if (local.accounts.has(email)) fail("email-already-registered", "email", {}, 409);
        const entry = accountFor(email, password, nickname);
        challenge.consumedAt = ctx.now();
        return ctx.json(pendingSession(entry.account, body.rememberMe), 201);
      }
      if (endpoint === "password-reset") {
        const email = emailValue(body.email);
        const password = passwordValue(body.password);
        const challenge = verifyChallenge(body, email, "password-reset");
        accountFor(email).password = password;
        challenge.consumedAt = ctx.now();
        if (state.session?.account.email === email) {
          state.session = null;
          state.account = null;
        }
        return empty();
      }
      if (endpoint === "logout") {
        if (body.sessionId !== null) idValue(body.sessionId, "sessionId");
        if (body.sessionId === state.session?.id) {
          state.session = null;
          state.account = null;
        }
        return empty();
      }
      if (endpoint === "profile") {
        const nickname = nicknameValue(body.nickname);
        const session = requireSession();
        if (session.state !== "active") fail("session-invalid", null, {}, 401);
        session.account.nickname = nickname;
        state.account = session.account;
        return ctx.json(session.account);
      }
      if (endpoint === "account-deletion") {
        if (!/^[0-9a-f]{64}$(?![\s\S])/.test(body.requestId)) fail("invalid-field-value", "requestId");
        idValue(body.sessionId, "sessionId");
        const email = emailValue(body.email);
        const proof = JSON.stringify([body.sessionId, email]);
        if (local.deletions.has(body.requestId)) {
          if (local.deletions.get(body.requestId) !== proof) fail("session-invalid", null, {}, 401);
          return empty();
        }
        const session = requireSession(body.sessionId);
        if (session.state !== "active") fail("session-invalid", null, {}, 401);
        if (session.account.email !== email) fail("deletion-confirmation-mismatch", "email");
        local.deletions.set(body.requestId, proof);
        local.accounts.delete(email);
        for (const [id, challenge] of local.challenges) if (challenge.email === email) local.challenges.delete(id);
        state.deletedAccountKey = session.account.accountKey;
        state.account = null;
        state.session = null;
        return empty();
      }
    } catch (error) {
      if (!error?.authProblem) throw error;
      return ctx.problem("/problems/auth/" + error.type, error.status, error.extra);
    }
    return void 0;
  }
  return __toCommonJS(auth_exports);
})();
