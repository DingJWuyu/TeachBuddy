(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // docs/design-system/teachbuddy-app/ui/tbx/src/shim.js
  function h(type, props, ...children) {
    return globalThis.__tb.React.createElement(type, props, ...children);
  }
  function Fragment(props) {
    return props.children ?? null;
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/react.js
  var R = () => globalThis.__tb.React;
  var tb = () => globalThis.__tb;
  var useState = (...a) => R().useState(...a);
  var useEffect = (...a) => R().useEffect(...a);
  var useLayoutEffect = (...a) => R().useLayoutEffect(...a);
  var useRef = (...a) => R().useRef(...a);
  var useMemo = (...a) => R().useMemo(...a);
  var useCallback = (...a) => R().useCallback(...a);
  var cx = (...parts) => parts.filter(Boolean).join(" ");
  var NS = ["tbx", "workbench", "agent", "schedule", "reliability", "questions", "resources", "math"];
  var tx = (key2, options) => {
    const i = globalThis.__tb?.i18n;
    if (!i) return key2;
    globalThis.__tbx?.installLocales?.(i);
    const count = options && options.count === void 0 && typeof options.n === "number" ? { count: options.n } : null;
    return i.t(key2, { ns: NS, lngs: [i.language], nsSeparator: false, ...options, ...count });
  };
  var isEnglish = () => (globalThis.__tb?.i18n?.language || "").startsWith("en");
  var useLocale = () => tb().useTranslation("workbench").i18n.language;
  var dayUTC = (date) => /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
  var monthDay = (date) => isEnglish() ? dayUTC(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : `${Number(date.slice(5, 7))}\u6708${Number(date.slice(8, 10))}\u65E5`;
  var weekdayName = (date) => isEnglish() ? dayUTC(date).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) : `\u5468${"\u65E5\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D"[dayUTC(date).getUTCDay()]}`;

  // docs/design-system/teachbuddy-app/ui/tbx/src/auth/Cast.jsx
  var ACTORS = ["teacher", "black", "yellow", "orange"];
  var STUDENTS = ["black", "yellow", "orange"];
  var LINES = {
    idle: {
      teacher: ["\u540C\u5B66\u4EEC\u597D\uFF5E", "\u4ECA\u5929\u8BB2\u4E8C\u6B21\u51FD\u6570", "\u4F5C\u4E1A\u90FD\u4EA4\u4E86\u5417\uFF1F"],
      black: ["\u8001\u5E08\u6211\u4F1A\uFF01", "\u4E0B\u8BFE\u6253\u7403\u53BB\uFF1F", "\u8FD9\u9898\u9009 C\uFF01"],
      yellow: ["\u8BA9\u6211\u60F3\u60F3\u2026\u2026", "\u8FD9\u9898\u597D\u50CF\u89C1\u8FC7", "\u8001\u5E08\uFF0C\u6211\u6709\u95EE\u9898"],
      orange: ["\u563F\u563F", "\u6211\u5148\u4E3E\u624B\uFF01", "\u4ECA\u5929\u4E5F\u8981\u52A0\u6CB9\u9E2D"]
    },
    password: {
      teacher: ["\u4E0D\u8BB8\u5077\u770B\u54E6", "\u773C\u775B\u770B\u9ED1\u677F", "\u55EF\uFF1F\u8C01\u5728\u770B\uFF1F"],
      black: ["\u6211\u6CA1\u770B\uFF01\u771F\u7684\uFF01", "\u5C31\u770B\u4E00\u773C\u2026\u2026", "\u770B\u4E0D\u6E05\u770B\u4E0D\u6E05"],
      yellow: ["\u6211\u53EA\u662F\u8DEF\u8FC7", "\u6211\u4EC0\u4E48\u4E5F\u6CA1\u770B\u89C1"],
      orange: ["\u6211\u95ED\u773C\u4E86\uFF01", "\u6211\u662F\u597D\u5B66\u751F"]
    },
    shy: {
      teacher: ["\u5BC6\u7801\u8981\u85CF\u597D\u5440", "\u5927\u5BB6\u8F6C\u8FC7\u53BB\uFF5E"],
      black: ["\u6211\u770B\u5230\u5566\uFF5E", "\u8BB0\u4E0D\u4F4F\u8BB0\u4E0D\u4F4F"],
      yellow: ["\u54C7\uFF0C\u597D\u957F", "\u6211\u8F6C\u8FC7\u53BB\u4E86"],
      orange: ["\u6211\u6342\u773C\u775B\u4E86\uFF01", "\u6CA1\u770B\u6CA1\u770B"]
    },
    error: {
      teacher: ["\u518D\u68C0\u67E5\u4E00\u4E0B\uFF1F", "\u522B\u6025\uFF0C\u6162\u6162\u6765"],
      black: ["\u54CE\u5440", "\u5DEE\u4E00\u70B9\u70B9"],
      yellow: ["\u662F\u4E0D\u662F\u54EA\u91CC\u9519\u4E86\uFF1F"],
      orange: ["\u6CA1\u5173\u7CFB\uFF01\u518D\u6765\uFF01"]
    },
    success: {
      teacher: ["\u6B22\u8FCE\u56DE\u6765\uFF01", "\u4E0A\u8BFE\u5566\uFF5E"],
      black: ["\u8036\uFF01", "\u51B2\u9E2D\uFF01"],
      yellow: ["\u592A\u597D\u4E86\uFF01"],
      orange: ["\u5F00\u5FC3\uFF01"]
    }
  };
  var clamp = (v) => Math.max(-1, Math.min(1, v));
  var pick = (list) => list[Math.floor(Math.random() * list.length)];
  var measure = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  function caretPoint(input) {
    if (!measure || !input || input.tagName !== "INPUT" || input.type === "checkbox") return null;
    const r = input.getBoundingClientRect();
    const s = getComputedStyle(input);
    measure.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    let text = input.value.slice(0, input.selectionStart ?? input.value.length);
    if (input.type === "password") text = "\u2022".repeat(text.length);
    const x = r.left + parseFloat(s.paddingLeft) + measure.measureText(text).width - input.scrollLeft;
    return { x: Math.min(x, r.right - parseFloat(s.paddingRight)), y: r.top + r.height / 2 };
  }
  function replay(el, attr, value, ms) {
    if (!el) return;
    el.removeAttribute(attr);
    void el.getBoundingClientRect();
    el.setAttribute(attr, value);
    clearTimeout(el[`__${attr}`]);
    el[`__${attr}`] = setTimeout(() => el.removeAttribute(attr), ms);
  }
  function Cast({ trackingRef, field, expression = "idle", passwordVisible }) {
    useLocale();
    const sceneRef = useRef(null);
    const [speech, setSpeech] = useState(null);
    const pose = passwordVisible ? "shy" : expression !== "idle" ? expression : field === "password" ? "password" : field === "text" ? "attentive" : "idle";
    const poseRef = useRef(pose);
    poseRef.current = pose;
    useEffect(() => {
      const scene = sceneRef.current;
      const frame = trackingRef?.current;
      if (!scene || !frame) return void 0;
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      const fine = matchMedia("(hover: hover) and (pointer: fine)");
      let raf = 0, point = null;
      const props = ["--look-x", "--look-y", "--face-x", "--face-y", "--lean"];
      const reset = () => {
        cancelAnimationFrame(raf);
        raf = 0;
        point = null;
        props.forEach((p) => scene.style.removeProperty(p));
      };
      const draw = () => {
        raf = 0;
        if (!point) return;
        const b = scene.getBoundingClientRect();
        if (!b.width) return;
        const x = clamp((point.x - b.left - b.width / 2) / (b.width * 0.65));
        const y = clamp((point.y - b.top - b.height / 2) / (b.height * 0.65));
        scene.style.setProperty("--look-x", `${(x * 3.2).toFixed(2)}px`);
        scene.style.setProperty("--look-y", `${(y * 2.6).toFixed(2)}px`);
        scene.style.setProperty("--face-x", `${(x * 13).toFixed(2)}px`);
        scene.style.setProperty("--face-y", `${(y * 7).toFixed(2)}px`);
        scene.style.setProperty("--lean", `${(-x * 5).toFixed(2)}deg`);
      };
      const aim = (p) => {
        if (motion.matches || !p) return;
        point = p;
        if (!raf) raf = requestAnimationFrame(draw);
      };
      const follow = (e) => {
        if (!fine.matches || e.pointerType === "touch") return;
        aim({ x: e.clientX, y: e.clientY });
      };
      const read = (e) => {
        aim(caretPoint(e.target));
        if (e.type === "input" && e.target.type !== "checkbox" && !motion.matches) {
          replay(scene, "data-nod", pick(STUDENTS), 260);
          replay(scene, "data-typing", "true", 320);
        }
      };
      const change = (e) => {
        if (e.target.type === "checkbox" && !motion.matches) replay(scene, "data-react", e.target.checked ? "approve" : "shrug", 900);
      };
      const leave = () => {
        if (!frame.contains(document.activeElement)) reset();
      };
      frame.addEventListener("pointermove", follow, { passive: true });
      frame.addEventListener("pointerleave", leave);
      ["input", "keyup", "click", "focusin"].forEach((t2) => frame.addEventListener(t2, read));
      frame.addEventListener("change", change);
      const pause = () => {
        scene.dataset.paused = String(document.hidden || motion.matches);
      };
      pause();
      document.addEventListener("visibilitychange", pause);
      return () => {
        reset();
        frame.removeEventListener("pointermove", follow);
        frame.removeEventListener("pointerleave", leave);
        ["input", "keyup", "click", "focusin"].forEach((t2) => frame.removeEventListener(t2, read));
        frame.removeEventListener("change", change);
        document.removeEventListener("visibilitychange", pause);
      };
    }, [trackingRef]);
    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene || matchMedia("(prefers-reduced-motion: reduce)").matches) return void 0;
      let timer = 0;
      const next = () => {
        timer = setTimeout(() => {
          if (!document.hidden && (poseRef.current === "idle" || poseRef.current === "attentive")) {
            replay(scene, "data-fidget", pick(ACTORS), 1200);
          }
          next();
        }, 2400 + Math.random() * 2800);
      };
      next();
      return () => clearTimeout(timer);
    }, []);
    useEffect(() => {
      if (!speech) return void 0;
      const t2 = setTimeout(() => setSpeech(null), 2300);
      return () => clearTimeout(t2);
    }, [speech]);
    function poke(who) {
      const set = LINES[pose] || LINES.idle;
      setSpeech({ who, text: tx(pick(set[who] || LINES.idle[who])), key: Date.now() });
      replay(sceneRef.current, "data-poke", who, 650);
    }
    const actor = (who) => ({
      className: `tc-actor tc-${who}`,
      onPointerDown: (e) => {
        e.preventDefault();
        poke(who);
      },
      onPointerEnter: () => sceneRef.current?.setAttribute("data-hover", who),
      onPointerLeave: () => sceneRef.current?.removeAttribute("data-hover")
    });
    return /* @__PURE__ */ h("div", { className: "ae-characters tc-cast", "aria-hidden": "true" }, /* @__PURE__ */ h("div", { className: "tc-frame" }, speech && /* @__PURE__ */ h("div", { key: speech.key, className: `tc-speech is-${speech.who}` }, speech.text), /* @__PURE__ */ h("svg", { className: "tc-scene", viewBox: "-28 -28 560 500", fill: "none", focusable: "false", ref: sceneRef, "data-pose": pose }, /* @__PURE__ */ h("ellipse", { className: "tc-ground", cx: "246", cy: "446", rx: "262", ry: "12" }), /* @__PURE__ */ h("g", { className: "tc-enter tc-enter-teacher" }, /* @__PURE__ */ h("g", { ...actor("teacher") }, /* @__PURE__ */ h("g", { className: "tc-hop" }, /* @__PURE__ */ h("g", { className: "tc-char tc-char-teacher" }, /* @__PURE__ */ h("g", { className: "tc-bun" }, /* @__PURE__ */ h("circle", { cx: "246", cy: "30", r: "21" }), /* @__PURE__ */ h("path", { className: "tc-bun-band", d: "M228 42Q246 50 264 42" })), /* @__PURE__ */ h("path", { className: "tc-shape tc-teacher-shape", d: "M124 444C124 300 124 150 124 64C124 46 138 32 156 32L284 32C302 32 316 46 316 64C316 150 316 300 316 444Z" }), /* @__PURE__ */ h("g", { className: "tc-face tc-teacher-face" }, /* @__PURE__ */ h("g", { className: "tc-eyes" }, /* @__PURE__ */ h("circle", { className: "tc-eye-white", cx: "218", cy: "62", r: "6.5" }), /* @__PURE__ */ h("circle", { className: "tc-eye-white", cx: "274", cy: "62", r: "6.5" }), /* @__PURE__ */ h("g", { className: "tc-pupils" }, /* @__PURE__ */ h("circle", { cx: "218", cy: "62", r: "3.2" }), /* @__PURE__ */ h("circle", { cx: "274", cy: "62", r: "3.2" }))), /* @__PURE__ */ h("path", { className: "tc-closed", d: "M212 63q6 -5 12 0m44 0q6 -5 12 0" }), /* @__PURE__ */ h("g", { className: "tc-glasses" }, /* @__PURE__ */ h("circle", { cx: "218", cy: "62", r: "14" }), /* @__PURE__ */ h("circle", { cx: "274", cy: "62", r: "14" }), /* @__PURE__ */ h("path", { d: "M232 60Q246 52 260 60" }), /* @__PURE__ */ h("path", { className: "tc-glint", d: "M208 56l6 -6M264 56l6 -6" })), /* @__PURE__ */ h("circle", { className: "tc-blush", cx: "206", cy: "86", r: "7" }), /* @__PURE__ */ h("circle", { className: "tc-blush", cx: "286", cy: "86", r: "7" }), /* @__PURE__ */ h("path", { className: "tc-mouth tc-teacher-mouth", d: "M234 84Q246 93 258 84Q246 100 234 84Z" }), /* @__PURE__ */ h("path", { className: "tc-sweat", d: "M300 34q7 10 0 15q-7 -5 0 -15Z" })))))), /* @__PURE__ */ h("g", { className: "tc-enter tc-enter-black" }, /* @__PURE__ */ h("g", { ...actor("black") }, /* @__PURE__ */ h("g", { className: "tc-hop" }, /* @__PURE__ */ h("g", { className: "tc-char tc-char-black" }, /* @__PURE__ */ h("path", { className: "tc-shape tc-black-shape", d: "M260 444L260 174C260 161 271 150 284 150L352 150C365 150 376 161 376 174L376 444Z" }), /* @__PURE__ */ h("g", { className: "tc-scarf" }, /* @__PURE__ */ h("path", { d: "M294 214L342 214L318 232Z" }), /* @__PURE__ */ h("path", { d: "M312 228L300 262L318 252Z" }), /* @__PURE__ */ h("path", { d: "M324 228L338 260L318 252Z" })), /* @__PURE__ */ h("g", { className: "tc-face tc-black-face" }, /* @__PURE__ */ h("g", { className: "tc-eyes" }, /* @__PURE__ */ h("circle", { className: "tc-eye-white", cx: "304", cy: "182", r: "9.5" }), /* @__PURE__ */ h("circle", { className: "tc-eye-white", cx: "336", cy: "182", r: "9.5" }), /* @__PURE__ */ h("g", { className: "tc-pupils" }, /* @__PURE__ */ h("circle", { cx: "304", cy: "182", r: "5" }), /* @__PURE__ */ h("circle", { cx: "336", cy: "182", r: "5" }))), /* @__PURE__ */ h("path", { className: "tc-closed is-light", d: "M297 183q7 -6 14 0m18 0q7 -6 14 0" }), /* @__PURE__ */ h("circle", { className: "tc-blush", cx: "294", cy: "200", r: "5.5" }), /* @__PURE__ */ h("circle", { className: "tc-blush", cx: "346", cy: "200", r: "5.5" }), /* @__PURE__ */ h("path", { className: "tc-mouth tc-black-mouth", d: "M312 200Q320 207 328 200" })))))), /* @__PURE__ */ h("g", { className: "tc-enter tc-enter-yellow" }, /* @__PURE__ */ h("g", { ...actor("yellow") }, /* @__PURE__ */ h("g", { className: "tc-hop" }, /* @__PURE__ */ h("g", { className: "tc-char tc-char-yellow" }, /* @__PURE__ */ h("path", { className: "tc-cowlick", d: "M414 234C410 220 416 210 426 212C434 214 432 224 424 224" }), /* @__PURE__ */ h("path", { className: "tc-shape tc-yellow-shape", d: "M348 444V298A67 67 0 0 1 482 298V444Z" }), /* @__PURE__ */ h("g", { className: "tc-face tc-yellow-face" }, /* @__PURE__ */ h("circle", { className: "tc-eyes tc-dot-eye", cx: "400", cy: "281", r: "5" }), /* @__PURE__ */ h("path", { className: "tc-closed", d: "M394 282q6 -5 12 0" }), /* @__PURE__ */ h("circle", { className: "tc-blush", cx: "388", cy: "300", r: "6" }), /* @__PURE__ */ h("path", { className: "tc-mouth tc-yellow-mouth", d: "M424 305H504" })))))), /* @__PURE__ */ h("g", { className: "tc-enter tc-enter-orange" }, /* @__PURE__ */ h("g", { ...actor("orange") }, /* @__PURE__ */ h("g", { className: "tc-hop" }, /* @__PURE__ */ h("g", { className: "tc-char tc-char-orange" }, /* @__PURE__ */ h("g", { className: "tc-sprout" }, /* @__PURE__ */ h("path", { className: "tc-stem", d: "M170 292C170 280 172 270 176 262" }), /* @__PURE__ */ h("path", { className: "tc-leaf", d: "M174 268C164 256 150 256 146 264C154 272 166 272 174 268Z" }), /* @__PURE__ */ h("path", { className: "tc-leaf", d: "M176 264C182 250 196 246 204 252C198 262 186 268 176 264Z" })), /* @__PURE__ */ h("path", { className: "tc-shape tc-orange-shape", d: "M0 444A158 158 0 0 1 316 444Z" }), /* @__PURE__ */ h("g", { className: "tc-face tc-orange-face" }, /* @__PURE__ */ h("g", { className: "tc-eyes" }, /* @__PURE__ */ h("circle", { cx: "154", cy: "378", r: "8" }), /* @__PURE__ */ h("circle", { cx: "228", cy: "378", r: "8" })), /* @__PURE__ */ h("path", { className: "tc-closed", d: "M146 380q8 -8 16 0m58 0q8 -8 16 0" }), /* @__PURE__ */ h("circle", { className: "tc-blush", cx: "134", cy: "398", r: "9" }), /* @__PURE__ */ h("circle", { className: "tc-blush", cx: "248", cy: "398", r: "9" }), /* @__PURE__ */ h("path", { className: "tc-mouth tc-orange-mouth", d: "M177 392H208A15.5 15.5 0 0 1 177 392Z" })))))), /* @__PURE__ */ h("g", { className: "tc-confetti" }, /* @__PURE__ */ h("rect", { x: "96", y: "120", width: "10", height: "16", rx: "3", style: { "--dx": "-60px", "--dy": "-90px", "--r": "-120deg" } }), /* @__PURE__ */ h("rect", { x: "200", y: "60", width: "10", height: "16", rx: "3", style: { "--dx": "-20px", "--dy": "-110px", "--r": "160deg" } }), /* @__PURE__ */ h("circle", { cx: "300", cy: "110", r: "6", style: { "--dx": "30px", "--dy": "-120px", "--r": "0deg" } }), /* @__PURE__ */ h("rect", { x: "380", y: "150", width: "10", height: "16", rx: "3", style: { "--dx": "70px", "--dy": "-80px", "--r": "200deg" } }), /* @__PURE__ */ h("circle", { cx: "450", cy: "200", r: "6", style: { "--dx": "90px", "--dy": "-60px", "--r": "0deg" } }), /* @__PURE__ */ h("rect", { x: "150", y: "200", width: "8", height: "14", rx: "3", style: { "--dx": "-90px", "--dy": "-40px", "--r": "90deg" } }), /* @__PURE__ */ h("circle", { cx: "250", cy: "180", r: "5", style: { "--dx": "10px", "--dy": "-150px", "--r": "0deg" } }), /* @__PURE__ */ h("rect", { x: "330", y: "90", width: "8", height: "14", rx: "3", style: { "--dx": "50px", "--dy": "-130px", "--r": "-200deg" } })))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/auth/EntryLayout.jsx
  var SUBTITLES = {
    login: "\u6559\u5B66\u7684\u4E00\u5207\uFF0C\u90FD\u5728\u8FD9\u91CC\u3002",
    register: "\u4E00\u4E2A\u8D26\u6237\uFF0C\u5F00\u542F\u4F60\u7684\u5168\u90E8\u6559\u5B66\u3002",
    "recovery-request": "\u6211\u4EEC\u4F1A\u628A\u9A8C\u8BC1\u7801\u53D1\u5230\u4F60\u7684\u90AE\u7BB1\u3002",
    "recovery-confirm": "\u65B0\u5BC6\u7801\u81F3\u5C11 8 \u4F4D\u3002"
  };
  function EntryLayout({ children, surface, expression = "idle", passwordVisible = false }) {
    useLocale();
    const frameRef = useRef(null);
    const [focus, setFocus] = useState({ surface, field: "none" });
    const field = focus.surface === surface ? focus.field : "none";
    function reflectFocus(target) {
      const password = target?.closest?.(".ae-password") || target?.id === "ae-password-confirmation";
      const text = target?.matches?.('input:not([type="checkbox"])');
      setFocus({ surface, field: password ? "password" : text ? "text" : "none" });
    }
    return /* @__PURE__ */ h("div", { className: "ae-page ae-entry tbx-entry", "data-auth-surface": surface }, /* @__PURE__ */ h("div", { className: "ae-entry-frame tbx-entry-frame", ref: frameRef }, /* @__PURE__ */ h("section", { className: "tbx-stage" }, /* @__PURE__ */ h(Cast, { trackingRef: frameRef, field, expression, passwordVisible })), /* @__PURE__ */ h(
      "div",
      {
        className: "ae-entry-panel tbx-entry-panel",
        onFocusCapture: (e) => reflectFocus(e.target),
        onBlurCapture: (e) => reflectFocus(e.currentTarget.contains(e.relatedTarget) ? e.relatedTarget : null)
      },
      children
    )));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/shell/BrandMark.jsx
  var SPARK = "M32 9.2C32.9 16.3 34.2 17.6 41.3 18.5C34.2 19.4 32.9 20.7 32 27.8C31.1 20.7 29.8 19.4 22.7 18.5C29.8 17.6 31.1 16.3 32 9.2Z";
  var PAGE_L = "M11.5 33.2C18.6 29.9 25.6 30 30.6 34.3V52.6C25.6 48.8 18.6 48.6 11.5 51.6Z";
  var PAGE_R = "M52.5 33.2C45.4 29.9 38.4 30 33.4 34.3V52.6C38.4 48.8 45.4 48.6 52.5 51.6Z";
  var uid = 0;
  function Mark({ size = 28, className = "" }) {
    const id = `tbx-mark-hi-${++uid}`;
    return /* @__PURE__ */ h("svg", { className: `tbx-mark ${className}`, width: size, height: size, viewBox: "0 0 64 64", "aria-hidden": "true", focusable: "false" }, /* @__PURE__ */ h("defs", null, /* @__PURE__ */ h("linearGradient", { id, x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ h("stop", { offset: "0", stopColor: "#fff", stopOpacity: "0.16" }), /* @__PURE__ */ h("stop", { offset: "1", stopColor: "#fff", stopOpacity: "0" }))), /* @__PURE__ */ h("rect", { className: "tbx-mark-tile", width: "64", height: "64", rx: "14.5" }), /* @__PURE__ */ h("rect", { width: "64", height: "64", rx: "14.5", fill: `url(#${id})` }), /* @__PURE__ */ h("path", { className: "tbx-mark-page", d: PAGE_L }), /* @__PURE__ */ h("path", { className: "tbx-mark-page", d: PAGE_R }), /* @__PURE__ */ h("path", { className: "tbx-mark-spark", d: SPARK }));
  }
  function BrandMark({ wordmark = "TeachBuddy" }) {
    return /* @__PURE__ */ h("span", { className: "ae-brand-lockup tbx-lockup" }, /* @__PURE__ */ h(Mark, { size: 48 }), wordmark ? /* @__PURE__ */ h("span", { className: "ae-brand-wordmark tbx-wordmark" }, wordmark) : null);
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/shell/Celebration.jsx
  var PALETTES = [
    ["#ffd60a", "#ff9f0a", "#fff4c2"],
    ["#0a84ff", "#64d2ff", "#e1f3ff"],
    ["#ff375f", "#ff6482", "#ffd1dc"],
    ["#30d158", "#a6f4c5", "#e8fff0"],
    ["#bf5af2", "#da8fff", "#f3e3ff"],
    ["#ff9f0a", "#ffd60a", "#ff375f"]
  ];
  var pick2 = (a) => a[Math.random() * a.length | 0];
  function show(canvas) {
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h2 = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h2 = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h2 * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const G2 = 0.06;
    const rockets = [];
    const sparks = [];
    const plan = [0, 90, 160, 520, 900, 1250, 1500, 1900, 2300, 2600, 3e3, 3350, 3700, 3760, 3820, 3900, 3980, 4100].map((at) => ({ at, done: false }));
    const start = performance.now();
    let last = start;
    let raf = 0;
    const launch = () => {
      const x = w * (0.15 + Math.random() * 0.7);
      const ty = h2 * (0.12 + Math.random() * 0.32);
      const vy = -Math.sqrt(2 * G2 * 4 * (h2 - ty));
      rockets.push({ x, y: h2 + 6, vx: (Math.random() - 0.5) * 1.6, vy, palette: pick2(PALETTES), trail: [], wob: Math.random() * 6 });
    };
    const spark = (x, y, angle, speed, o) => sparks.push({
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.01 + Math.random() * 8e-3,
      drag: 0.965,
      grav: 1,
      size: 1.8,
      color: "#fff",
      twinkle: false,
      split: 0,
      ...o
    });
    const burst = (x, y, palette) => {
      const r = Math.random();
      const [c1, c2, c3] = palette;
      if (r < 0.32) {
        const n = 150;
        for (let i = 0; i < n; i += 1) spark(x, y, Math.random() * Math.PI * 2, Math.pow(Math.random(), 0.45) * 7.4, { color: i % 4 ? c1 : c2, twinkle: Math.random() < 0.35 });
        for (let i = 0; i < 30; i += 1) spark(x, y, Math.random() * Math.PI * 2, Math.random() * 2.2, { color: c3, decay: 0.03, size: 1.4 });
      } else if (r < 0.56) {
        const tilt = Math.random() * Math.PI;
        const squash = 0.55 + Math.random() * 0.45;
        [[6.6, c1, 84], [3.8, c2, 56]].forEach(([sp, color, n]) => {
          for (let i = 0; i < n; i += 1) {
            const a = Math.PI * 2 * i / n;
            const ex = Math.cos(a) * sp, ey = Math.sin(a) * sp * squash;
            spark(x, y, Math.atan2(ex * Math.sin(tilt) + ey * Math.cos(tilt), ex * Math.cos(tilt) - ey * Math.sin(tilt)), Math.hypot(ex, ey), { color, decay: 0.013, size: 2 });
          }
        });
      } else if (r < 0.76) {
        for (let i = 0; i < 90; i += 1) spark(x, y, Math.random() * Math.PI * 2, 1.8 + Math.random() * 4.8, { color: i % 3 ? "#ffcf6b" : "#fff1c9", drag: 0.975, grav: 0.55, decay: 55e-4 + Math.random() * 4e-3, size: 1.5, twinkle: true });
      } else if (r < 0.94) {
        for (let i = 0; i < 10; i += 1) spark(x, y, Math.PI * 2 * i / 10 + Math.random() * 0.2, 5.4, { color: c1, decay: 0.022, size: 2.4, split: 1, palette });
      } else {
        for (let i = 0; i < 90; i += 1) {
          const t2 = Math.PI * 2 * i / 90;
          const hx = 16 * Math.pow(Math.sin(t2), 3);
          const hy = -(13 * Math.cos(t2) - 5 * Math.cos(2 * t2) - 2 * Math.cos(3 * t2) - Math.cos(4 * t2));
          spark(x, y, Math.atan2(hy, hx), Math.hypot(hx, hy) * 0.4, { color: i % 2 ? "#ff375f" : "#ff8fa8", decay: 0.012, size: 2, drag: 0.955, grav: 0.5 });
        }
      }
      sparks.push({ x, y, life: 1, decay: 0.07, flash: true, size: 46, color: c3 });
    };
    const frame = (now) => {
      const dt = Math.min(3, (now - last) / 16.667);
      last = now;
      const t2 = now - start;
      plan.forEach((p) => {
        if (!p.done && t2 >= p.at) {
          p.done = true;
          launch();
        }
      });
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.78, dt)})`;
      ctx.fillRect(0, 0, w, h2);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const r = rockets[i];
        r.wob += 0.3 * dt;
        const ox = r.x, oy = r.y;
        r.x += (r.vx + Math.sin(r.wob) * 0.25) * dt;
        r.y += r.vy * dt;
        r.vy += G2 * 4 * dt;
        ctx.strokeStyle = r.palette[2];
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();
        if (Math.random() < 0.6 * dt) sparks.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: (Math.random() - 0.5) * 0.6, vy: Math.random() * 0.8, life: 0.7, decay: 0.05, drag: 0.9, grav: 1, size: 1.1, color: "#ffd9a0" });
        if (r.vy >= -0.5) {
          burst(r.x, r.y, r.palette);
          rockets.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const s = sparks[i];
        s.life -= s.decay * dt;
        if (s.life <= 0) {
          if (s.split) for (let k = 0; k < 7; k += 1) spark(s.x, s.y, Math.random() * Math.PI * 2, 1.2 + Math.random() * 1.6, { color: pick2(s.palette), decay: 0.024, size: 1.4, twinkle: true });
          sparks.splice(i, 1);
          continue;
        }
        if (s.flash) {
          const rad = s.size * (1.6 - s.life * 0.6);
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
          g.addColorStop(0, `rgba(255,255,255,${0.55 * s.life})`);
          g.addColorStop(0.4, `rgba(255,240,210,${0.18 * s.life})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = 1;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        s.px = s.x;
        s.py = s.y;
        const d = Math.pow(s.drag, dt);
        s.vx *= d;
        s.vy = s.vy * d + 0.05 * s.grav * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        let a = Math.min(1, s.life * 1.4);
        if (s.twinkle && s.life < 0.55 && Math.random() < 0.45) a *= 0.15;
        ctx.globalAlpha = a;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size * (0.5 + s.life * 0.7);
        ctx.beginPath();
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(s.x + 0.01, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (t2 < 7e3 || sparks.length || rockets.length) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }
  function Celebration({ onClose }) {
    useLocale();
    const canvasRef = useRef(null);
    const buttonRef = useRef(null);
    useEffect(() => {
      buttonRef.current?.focus();
      const key2 = (e) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", key2);
      let stop = () => {
      };
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches && canvasRef.current) stop = show(canvasRef.current);
      return () => {
        stop();
        document.removeEventListener("keydown", key2);
      };
    }, [onClose]);
    return /* @__PURE__ */ h("div", { className: "tbx-celebrate", role: "dialog", "aria-modal": "true", "aria-labelledby": "tbx-celebrate-title" }, /* @__PURE__ */ h("div", { className: "tbx-celebrate-scrim", onPointerDown: onClose }), /* @__PURE__ */ h("canvas", { className: "tbx-celebrate-sky", ref: canvasRef, "aria-hidden": "true" }), /* @__PURE__ */ h("div", { className: "tbx-celebrate-card" }, /* @__PURE__ */ h("span", { className: "tbx-celebrate-mark", "aria-hidden": "true" }, /* @__PURE__ */ h("svg", { viewBox: "0 0 24 24", width: "28", height: "28", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ h("path", { d: "m5 12.5 4.5 4.5L19 7.5" }))), /* @__PURE__ */ h("h2", { id: "tbx-celebrate-title" }, tx("\u4E00\u5207\u5C31\u7EEA\u3002")), /* @__PURE__ */ h("p", null, tx("TeachBuddy \u7684\u6BCF\u4E2A\u89D2\u843D\uFF0C\u4F60\u90FD\u53BB\u8FC7\u4E86\u3002")), /* @__PURE__ */ h("button", { type: "button", className: "tbx-celebrate-go", ref: buttonRef, onClick: onClose }, tx("\u5F00\u59CB\u5427"))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/shell/Topbar.jsx
  var tw = tx;
  function useSlidingThumb(navRef, deps) {
    const [thumb, setThumb] = useState(null);
    useLayoutEffect(() => {
      const nav = navRef.current;
      if (!nav) return void 0;
      const measure2 = () => {
        const current = nav.querySelector(".is-current");
        if (!current) {
          setThumb((v) => v ? { ...v, hidden: true } : null);
          return;
        }
        setThumb({ left: current.offsetLeft, width: current.offsetWidth, hidden: false });
      };
      measure2();
      const ro = new ResizeObserver(measure2);
      ro.observe(nav);
      return () => ro.disconnect();
    }, deps);
    return thumb;
  }
  function Topbar({ route, collapsed, toggleSidebar, surface, setSurface, assistantOpen, onToggleAssistant, children }) {
    useLocale();
    const {
      useWorkbenchShell,
      useScene,
      followAnchor,
      workbenchModules,
      moduleDisplayName,
      Icon2: Icon22,
      SearchModal,
      Notifications,
      FeedbackPanel,
      TutorialPanel,
      PrivacyPanel,
      SupportMenu,
      CoachMark
    } = tb();
    const modules = workbenchModules.filter((m) => m.navigation === "sidebar");
    const topModules = workbenchModules.filter((m) => m.navigation === "top");
    const ref = useRef(null);
    const navRef = useRef(null);
    const { accountKey, narrow } = useWorkbenchShell();
    const [scene, patch] = useScene(accountKey, "topbar", { completed: [], coachDismissed: false });
    const [announcement, announce] = useState("");
    const [celebrating, celebrate] = useState(false);
    const dismissCoach = () => patch({ coachDismissed: true });
    const thumb = useSlidingThumb(navRef, [route.name, route.moduleId, surface === "support"]);
    useEffect(() => {
      const close = (e) => {
        if (e.type === "keydown" && e.key === "Escape") {
          celebrate(false);
          if (!scene.coachDismissed) dismissCoach();
        }
        if (e.type === "keydown" && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setSurface("search");
          return;
        }
        if (!["support", "search", "feedback", "tutorial", "privacy", "notifications"].includes(surface)) return;
        if (e.type === "keydown" ? e.key === "Escape" : surface === "notifications" ? !e.target.closest("[data-topbar-surface=notifications]") : !ref.current?.contains(e.target)) setSurface(null);
      };
      document.addEventListener("pointerdown", close);
      document.addEventListener("keydown", close);
      return () => {
        document.removeEventListener("pointerdown", close);
        document.removeEventListener("keydown", close);
      };
    }, [surface, setSurface, scene.coachDismissed]);
    const toggle = (value) => setSurface(surface === value ? null : value);
    const entry = (name, icon, label, content2, badge) => /* @__PURE__ */ h("span", { className: `tb-entry-wrap${name === "tutorial" && !scene.coachDismissed ? " is-coached" : ""}` }, /* @__PURE__ */ h("button", { className: "tb-entry", "aria-label": label, "aria-haspopup": "dialog", "aria-expanded": surface === name, onClick: () => toggle(name) }, /* @__PURE__ */ h(Icon22, { name: icon, size: 20, strokeWidth: 1.8 }), badge > 0 && /* @__PURE__ */ h("span", { className: "tb-badge is-amber" }, badge)), name === "tutorial" && !scene.coachDismissed && /* @__PURE__ */ h(CoachMark, { onDismiss: dismissCoach }), surface !== name && (name !== "tutorial" || scene.coachDismissed) && /* @__PURE__ */ h("span", { className: "tb-tooltip", "aria-hidden": "true" }, label), surface === name && content2);
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    return /* @__PURE__ */ h("header", { className: "tb-topbar tbx-topbar", ref }, /* @__PURE__ */ h("div", { className: "tb-brand-slot tbx-brand-slot" }, /* @__PURE__ */ h("button", { className: "tb-mobile-menu", onClick: toggleSidebar, "aria-label": tw("\u6253\u5F00\u5DE5\u4F5C\u53F0\u5BFC\u822A") }, /* @__PURE__ */ h(Icon22, { name: "menu" })), /* @__PURE__ */ h("a", { className: "tb-brand tbx-brand", href: "/", onClick: (e) => followAnchor(e, "/"), "aria-label": "TeachBuddy" }, /* @__PURE__ */ h(Mark, { size: 30 }), /* @__PURE__ */ h("span", { className: "tbx-wordmark" }, "TeachBuddy"))), /* @__PURE__ */ h("div", { className: "tbx-bar" }, /* @__PURE__ */ h(
      "button",
      {
        className: "tb-sidebar-toggle tbx-sidebar-toggle",
        "aria-label": collapsed ? tw("\u5C55\u5F00\u4FA7\u680F") : tw("\u6536\u8D77\u4FA7\u680F"),
        title: collapsed ? tw("\u5C55\u5F00\u4FA7\u680F") : tw("\u6536\u8D77\u4FA7\u680F"),
        onClick: toggleSidebar
      },
      /* @__PURE__ */ h(Icon22, { name: "sidebarLeft", size: 20, strokeWidth: 1.75 })
    ), /* @__PURE__ */ h("nav", { className: "tb-global-nav tbx-segmented", "aria-label": tw("\u5168\u5C40\u5BFC\u822A"), ref: navRef }, thumb && /* @__PURE__ */ h(
      "span",
      {
        className: `tbx-segmented-thumb${thumb.hidden ? " is-hidden" : ""}`,
        style: { transform: `translateX(${thumb.left}px)`, width: `${thumb.width}px` },
        "aria-hidden": "true"
      }
    ), /* @__PURE__ */ h("a", { className: `tb-nav-item${route.name === "home" ? " is-current" : ""}`, href: "/", onClick: (e) => followAnchor(e, "/") }, tw("\u9996\u9875")), topModules.map((m) => /* @__PURE__ */ h("a", { key: m.id, className: `tb-nav-item${route.moduleId === m.id ? " is-current" : ""}`, href: m.path, onClick: (e) => followAnchor(e, m.path) }, moduleDisplayName(m))), /* @__PURE__ */ h(SupportMenu, { open: surface === "support", onOpen: () => setSurface("support"), onClose: () => setSurface(null), onSelect: () => {
    } })), /* @__PURE__ */ h("div", { className: "tb-top-actions tbx-actions" }, /* @__PURE__ */ h("button", { className: "tbx-search-pill", onClick: () => setSurface("search"), "aria-label": tw("\u5168\u5C40\u641C\u7D22") }, /* @__PURE__ */ h(Icon22, { name: "search", size: 16, strokeWidth: 2 }), /* @__PURE__ */ h("span", { className: "tbx-search-label" }, tx("\u641C\u7D22\u529F\u80FD\u6A21\u5757")), /* @__PURE__ */ h("kbd", null, isMac ? "\u2318" : "Ctrl", " K")), /* @__PURE__ */ h(Notifications, { open: surface === "notifications", onToggle: () => toggle("notifications"), onClose: () => setSurface(null), onAnnounce: announce }), entry("feedback", "feedback", tw("\u53D1\u9001\u53CD\u9988"), /* @__PURE__ */ h(FeedbackPanel, { onAnnounce: announce, onClose: () => setSurface(null) })), entry("tutorial", "tutorial", tw("\u4F7F\u7528\u6559\u7A0B"), /* @__PURE__ */ h(
      TutorialPanel,
      {
        modules,
        completed: scene.completed,
        onAnnounce: announce,
        onComplete: (id) => {
          const completed = scene.completed.includes(id) ? scene.completed.filter((x) => x !== id) : [...scene.completed, id];
          patch({ completed });
          if (completed.length === modules.length) celebrate(true);
        }
      }
    ), modules.length - scene.completed.length), entry("privacy", "shield", tw("\u9690\u79C1\u4E0E\u6570\u636E\u4FDD\u62A4"), /* @__PURE__ */ h(PrivacyPanel, null)), children, onToggleAssistant ? /* @__PURE__ */ h("span", { className: "tb-entry-wrap tbx-panel-wrap" }, /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: `tb-entry tbx-panel-toggle${assistantOpen ? " is-on" : ""}`,
        "aria-label": assistantOpen ? tw("\u6536\u8D77 AI \u52A9\u7406") : tw("\u6253\u5F00 AI \u52A9\u7406"),
        "aria-expanded": assistantOpen,
        onClick: onToggleAssistant
      },
      /* @__PURE__ */ h(Icon22, { name: "sparkles", size: 20, strokeWidth: 1.75 })
    ), /* @__PURE__ */ h("span", { className: "tb-tooltip", "aria-hidden": "true" }, assistantOpen ? tw("\u6536\u8D77 AI \u52A9\u7406") : tw("\u6253\u5F00 AI \u52A9\u7406"))) : null)), surface === "search" && /* @__PURE__ */ h(SearchModal, { onClose: () => setSurface(null), onAnnounce: announce }), !scene.coachDismissed && /* @__PURE__ */ h("span", { className: "tb-coach-scrim", onPointerDown: dismissCoach }), celebrating && /* @__PURE__ */ h(Celebration, { onClose: () => celebrate(false) }), /* @__PURE__ */ h("span", { className: "sr-only", role: "status" }, announcement));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/kit/motion.js
  var EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  function useFlip(signature, { duration = 300 } = {}) {
    const els = useRef(/* @__PURE__ */ new Map());
    const rects = useRef(/* @__PURE__ */ new Map());
    const last = useRef(signature);
    const captured = useRef(null);
    const measure2 = () => {
      const out = /* @__PURE__ */ new Map();
      els.current.forEach((el, key2) => {
        if (el.isConnected) out.set(key2, el.getBoundingClientRect());
      });
      return out;
    };
    useLayoutEffect(() => {
      const manual = signature === null;
      const changed = manual ? Boolean(captured.current) : last.current !== signature;
      const before = captured.current || rects.current;
      captured.current = null;
      last.current = signature;
      const now = measure2();
      if (changed) {
        now.forEach((r, key2) => {
          const el = els.current.get(key2);
          const p = before.get(key2);
          if (!p || el.dataset.flip === "off") return;
          const dy = p.top - r.top;
          if (Math.abs(dy) < 1) return;
          el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration, easing: EASE });
        });
      }
      if (!manual) rects.current = now;
    });
    const ref = (key2) => (el) => {
      if (el) els.current.set(key2, el);
      else els.current.delete(key2);
    };
    ref.capture = () => {
      captured.current = measure2();
    };
    return ref;
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/kit/confirm.jsx
  var ARM_MS = 3200;
  function Glyph({ name, size = 16, stroke = 1.9 }) {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: stroke });
  }
  function useArmed(ref) {
    const [armed, setArmed] = useState(false);
    useEffect(() => {
      if (!armed) return void 0;
      const timer = setTimeout(() => setArmed(false), ARM_MS);
      const away = (e) => {
        if (!ref.current?.contains(e.target)) setArmed(false);
      };
      const key2 = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setArmed(false);
        }
      };
      document.addEventListener("pointerdown", away, true);
      document.addEventListener("keydown", key2, true);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("pointerdown", away, true);
        document.removeEventListener("keydown", key2, true);
      };
    }, [armed]);
    return [armed, setArmed];
  }
  function ConfirmButton({
    label,
    confirmLabel,
    onConfirm,
    icon = "trash",
    text,
    size = "md",
    disabled,
    className,
    quiet
  }) {
    useLocale();
    const ref = useRef(null);
    const [armed, setArmed] = useArmed(ref);
    const confirmText = confirmLabel || tx("\u786E\u8BA4\u5220\u9664");
    return /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        ref,
        className: cx("tbx-confirm-btn", `is-${size}`, armed && "is-armed", text && "has-text", quiet && "is-quiet", className),
        disabled,
        "aria-label": armed ? confirmText : label,
        title: armed ? void 0 : label,
        onClick: (e) => {
          e.stopPropagation();
          if (armed) {
            setArmed(false);
            onConfirm();
          } else setArmed(true);
        }
      },
      /* @__PURE__ */ h(Glyph, { name: icon, size: size === "sm" ? 14 : 16 }),
      text && /* @__PURE__ */ h("span", { className: "tbx-confirm-idle" }, text),
      /* @__PURE__ */ h("span", { className: "tbx-confirm-text", "aria-hidden": !armed }, confirmText)
    );
  }
  function ConfirmMenuItem({ icon, label, confirmLabel, onConfirm, className, disabled }) {
    useLocale();
    const ref = useRef(null);
    const [armed, setArmed] = useArmed(ref);
    return /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        role: "menuitem",
        ref,
        disabled,
        className: cx("tbx-confirm-mi", "is-danger", armed && "is-armed", className),
        onClick: (e) => {
          e.stopPropagation();
          if (armed) {
            setArmed(false);
            onConfirm();
          } else setArmed(true);
        }
      },
      icon || /* @__PURE__ */ h(Glyph, { name: "trash" }),
      /* @__PURE__ */ h("span", null, armed ? confirmLabel || tx("\u786E\u8BA4\u5220\u9664") : label)
    );
  }
  function shellRoot() {
    return document.querySelector(".wb-shell") || document.body;
  }
  function ConfirmDialog({
    title,
    message,
    confirmLabel,
    cancelLabel,
    danger = true,
    icon,
    onConfirm,
    onCancel,
    children,
    busy,
    disabled,
    secondaryLabel,
    onSecondary
  }) {
    useLocale();
    const { createPortal } = tb();
    const ref = useRef(null);
    const [working, setWorking] = useState(false);
    useEffect(() => {
      const prev = document.activeElement;
      ref.current?.querySelector("[data-autofocus], .tbx-confirm-actions button:last-child")?.focus();
      const key2 = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      };
      document.addEventListener("keydown", key2, true);
      return () => {
        document.removeEventListener("keydown", key2, true);
        prev?.focus?.();
      };
    }, []);
    const run = async () => {
      setWorking(true);
      try {
        await onConfirm();
      } finally {
        setWorking(false);
      }
    };
    const node = /* @__PURE__ */ h("div", { className: "tbx-confirm-scrim", onPointerDown: (e) => {
      if (e.target === e.currentTarget) onCancel();
    } }, /* @__PURE__ */ h("div", { className: cx("tbx-confirm", danger && "is-danger"), role: "alertdialog", "aria-modal": "true", "aria-labelledby": "tbx-confirm-title", ref }, /* @__PURE__ */ h("span", { className: "tbx-confirm-icon", "aria-hidden": "true" }, /* @__PURE__ */ h(Glyph, { name: icon || (danger ? "trash" : "info"), size: 22 })), /* @__PURE__ */ h("h2", { id: "tbx-confirm-title" }, title), message && /* @__PURE__ */ h("p", null, message), children, /* @__PURE__ */ h("div", { className: "tbx-confirm-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "tbx-confirm-cancel", onClick: onCancel }, cancelLabel || tx("\u53D6\u6D88")), secondaryLabel && /* @__PURE__ */ h("button", { type: "button", className: "tbx-confirm-secondary", onClick: onSecondary }, secondaryLabel), /* @__PURE__ */ h("button", { type: "button", className: "tbx-confirm-ok", disabled: busy || working || disabled, onClick: run }, confirmLabel || tx("\u5220\u9664")))));
    return createPortal ? createPortal(node, shellRoot()) : node;
  }
  var DESTRUCTIVE = /删除|移除|清空|解散|丢弃|放弃|delete|remove|discard/i;
  function AppConfirmDialog({ title, message, confirmLabel, secondaryLabel, onSecondary, onConfirm, onCancel }) {
    const danger = DESTRUCTIVE.test(`${confirmLabel || ""} ${title || ""}`);
    return /* @__PURE__ */ h(
      ConfirmDialog,
      {
        title,
        message,
        confirmLabel: confirmLabel || tx("\u786E\u8BA4"),
        danger,
        secondaryLabel,
        onSecondary,
        onConfirm,
        onCancel
      }
    );
  }
  var pending = null;
  var listeners = /* @__PURE__ */ new Set();
  function confirmDialog(options) {
    return new Promise((resolve) => {
      pending?.resolve(false);
      pending = { ...options, resolve };
      listeners.forEach((fn) => fn(pending));
    });
  }
  function ConfirmHost() {
    const [req, setReq] = useState(pending);
    useEffect(() => {
      listeners.add(setReq);
      return () => listeners.delete(setReq);
    }, []);
    if (!req) return null;
    const done3 = (ok) => {
      req.resolve(ok);
      if (pending === req) pending = null;
      setReq(null);
    };
    return /* @__PURE__ */ h(ConfirmDialog, { ...req, onConfirm: () => done3(true), onCancel: () => done3(false) });
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/shell/Sidebar.jsx
  var tw2 = tx;
  var DRAG_SLOP = 5;
  var TOUCH_HOLD = 320;
  function Glyph2({ name, size = 20 }) {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: 1.75 });
  }
  function useModules() {
    const { workbenchModulesAll } = tb();
    const list = workbenchModulesAll.filter((m) => m.navigation === "sidebar");
    return { list, byId: (id) => list.find((m) => m.id === id) };
  }
  function GroupMenu({ at, onRename, onDelete, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
      ref.current?.querySelector("button")?.focus();
      const down = (e) => {
        if (!ref.current?.contains(e.target) && !e.target.closest?.(".tbx-group-more")) onClose();
      };
      const key2 = (e) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("pointerdown", down, true);
      document.addEventListener("keydown", key2);
      return () => {
        document.removeEventListener("pointerdown", down, true);
        document.removeEventListener("keydown", key2);
      };
    }, [onClose]);
    return /* @__PURE__ */ h("div", { className: "tbx-side-menu", role: "menu", ref, style: { left: at.x, top: at.y } }, /* @__PURE__ */ h("button", { type: "button", role: "menuitem", className: "tbx-mi", onClick: onRename }, /* @__PURE__ */ h(Glyph2, { name: "pencil", size: 16 }), tw2("\u91CD\u547D\u540D\u5206\u7EC4")), /* @__PURE__ */ h(ConfirmMenuItem, { className: "tbx-mi", icon: /* @__PURE__ */ h(Glyph2, { name: "close", size: 16 }), label: tw2("\u89E3\u6563\u5206\u7EC4"), confirmLabel: tw2("\u786E\u8BA4\u89E3\u6563"), onConfirm: onDelete }));
  }
  function Sidebar({
    modulePaths = {},
    model,
    routePath,
    onNavigate,
    mobileOpen,
    onCloseMobile,
    isNarrow,
    railCollapsed,
    onExpand,
    openSurface,
    onToggleSurface,
    onOpenSurface,
    onCloseSurface,
    accountName
  }) {
    useLocale();
    const {
      SidebarHead,
      NavigationStatus,
      followAnchor,
      groupDisplayName,
      modulePath,
      withSearch,
      HOME_PATH,
      SUPPORT_MENU_ITEMS,
      workbenchModulesAll,
      moduleDisplayName
    } = tb();
    const modules = useModules();
    const editable = model.navigation.editable;
    const hiddenIds = model.layout.hiddenModuleIds;
    const hidden = new Set(hiddenIds);
    const [drag, setDrag] = useState(null);
    const [target, setTarget] = useState(null);
    const [line, setLine] = useState(null);
    const dragRef = useRef(null);
    const targetRef = useRef(null);
    const suppressClick = useRef(false);
    const navRef = useRef(null);
    const trashRef = useRef(null);
    const holdTimer = useRef(0);
    const expandTimer = useRef({ id: null, timer: 0 });
    const handlers = useRef(null);
    const stable = useRef({
      move: (e) => handlers.current?.onMove(e),
      up: (e) => handlers.current?.onUp(e),
      cancel: (e) => handlers.current?.onCancel(e)
    });
    const [trashOpen, setTrashOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [renaming, setRenaming] = useState(null);
    const [renameDraft, setRenameDraft] = useState("");
    const [nameError, setNameError] = useState("");
    const [menu, setMenu] = useState(null);
    const [tip, setTip] = useState(null);
    const [mobileSupport, setMobileSupport] = useState(false);
    useEffect(() => {
      setTip(null);
    }, [railCollapsed, routePath]);
    function moduleHref(id) {
      const path2 = modulePath(id);
      const remembered = modulePaths[id];
      return remembered && (remembered === path2 || remembered.startsWith(path2 + "/") || remembered.startsWith(path2 + "?")) ? remembered : path2;
    }
    const groups = model.layout.groups.map((g) => ({ ...g, visible: g.moduleIds.filter((id) => !hidden.has(id) && modules.byId(id)) }));
    const baseGroups = groups;
    const moduleDrag = drag?.type === "module" && drag.active ? drag : null;
    const flipRef = useFlip(null);
    const act = (fn) => {
      flipRef.capture();
      return fn();
    };
    const norm = (v) => String(v || "").normalize("NFKC").trim().toLowerCase();
    function nameProblem(name, selfId) {
      const n = norm(name);
      if (!n) return null;
      const reserved = [tw2("\u672A\u5206\u7EC4"), "\u672A\u5206\u7EC4", "ungrouped"].map(norm);
      if (reserved.includes(n)) return tw2("\u201C{{name}}\u201D\u662F\u7CFB\u7EDF\u4FDD\u7559\u7684\u540D\u79F0\uFF0C\u6362\u4E00\u4E2A\u5427", { name: name.trim() });
      if (baseGroups.some((g) => g.id !== selfId && norm(groupDisplayName(g)) === n)) return tw2("\u5DF2\u7ECF\u6709\u53EB\u201C{{name}}\u201D\u7684\u5206\u7EC4\u4E86", { name: name.trim() });
      return null;
    }
    function beginPress(e, payload) {
      if (!editable || isNarrow || e.button > 0) return;
      if (e.target.closest("input, .tbx-group-more, .tbx-trash-restore")) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      let compact = r.width;
      const label = el.querySelector(".tbx-row-label, .tbx-group-name");
      if (label?.firstChild) {
        const range = document.createRange();
        range.selectNodeContents(label);
        const text = range.getBoundingClientRect();
        compact = Math.min(r.width, Math.max(text.right - r.left + 14, 80));
      }
      const press = {
        ...payload,
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        dx: Math.min(e.clientX - r.left, compact - 16),
        dy: e.clientY - r.top,
        w: r.width,
        h: r.height,
        active: false,
        touch: e.pointerType !== "mouse",
        ready: e.pointerType === "mouse"
      };
      dragRef.current = press;
      if (press.touch) {
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => {
          if (dragRef.current === press) {
            press.ready = true;
            activate(e.clientX, e.clientY);
          }
        }, TOUCH_HOLD);
      }
      window.addEventListener("pointermove", stable.current.move, { passive: false });
      window.addEventListener("pointerup", stable.current.up);
      window.addEventListener("pointercancel", stable.current.cancel);
    }
    function activate(x, y) {
      const d = dragRef.current;
      if (!d || d.active) return;
      d.active = true;
      suppressClick.current = true;
      document.documentElement.classList.add("tbx-dragging");
      d.origin = originOf(d);
      setDrag({ ...d, x, y });
      requestAnimationFrame(() => track(x, y));
    }
    function originOf(d) {
      if (d.type === "group") {
        const movable = baseGroups.filter((g2) => !g2.fixed);
        return { index: Math.max(0, movable.findIndex((g2) => g2.id === d.id)) };
      }
      if (d.from === "trash") return null;
      const g = baseGroups.find((x) => x.visible.includes(d.id));
      return g ? { groupId: g.id, index: g.visible.indexOf(d.id) } : null;
    }
    function onMove(e) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.active) {
        const far = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > DRAG_SLOP;
        if (d.touch && !d.ready) {
          if (far) cleanup();
          return;
        }
        if (!far) return;
        activate(e.clientX, e.clientY);
        return;
      }
      e.preventDefault();
      setDrag((cur) => cur ? { ...cur, x: e.clientX, y: e.clientY } : cur);
      track(e.clientX, e.clientY);
    }
    function track(x, y) {
      const d = dragRef.current;
      if (!d?.active) return;
      const next = hitTest(d, x, y);
      if (next === void 0) return;
      if (JSON.stringify(next) !== JSON.stringify(targetRef.current)) {
        targetRef.current = next;
        setTarget(next);
      }
      const l = lineFor(d, next);
      setLine((cur) => cur?.top === l?.top ? cur : l);
    }
    function box(el) {
      const nav = navRef.current;
      let top = 0;
      let n = el;
      while (n && n !== nav) {
        top += n.offsetTop;
        n = n.offsetParent;
      }
      if (n !== nav) return el.getBoundingClientRect();
      const t2 = nav.getBoundingClientRect().top + nav.clientTop - nav.scrollTop + top;
      return { top: t2, bottom: t2 + el.offsetHeight, height: el.offsetHeight };
    }
    function hitTest(d, x, y) {
      const trash = trashRef.current?.getBoundingClientRect();
      if (trash && y >= trash.top - 6 && y <= trash.bottom + 6 && x >= trash.left - 40 && x <= trash.right + 60) return { kind: "trash" };
      const nav = navRef.current?.getBoundingClientRect();
      if (!nav || x < nav.left - 60 || x > nav.right + 80) return void 0;
      const sections = [...navRef.current.querySelectorAll("[data-group]")];
      if (!sections.length) return void 0;
      if (d.type === "group") {
        const movable = sections.filter((s) => s.dataset.fixed !== "true" && s.dataset.group !== d.id);
        let index2 = 0;
        for (const s of movable) {
          const r = box(s);
          if (y > r.top + Math.min(r.height, 40) / 2) index2 += 1;
        }
        return { kind: "group", index: index2 };
      }
      let i = sections.length - 1;
      for (let k = 0; k < sections.length; k += 1) {
        if (y < box(sections[k]).bottom) {
          i = k;
          break;
        }
      }
      const section = sections[i];
      const head = section.querySelector(".tbx-group-head");
      if (head && i > 0) {
        const h2 = box(head);
        if (y < h2.top + h2.height / 2) {
          const prev = baseGroups.find((g2) => g2.id === sections[i - 1].dataset.group);
          if (prev && !prev.collapsed) {
            armExpand(null);
            return { kind: "slot", groupId: prev.id, index: prev.visible.filter((id) => id !== d.id).length };
          }
        }
      }
      const groupId = section.dataset.group;
      const g = baseGroups.find((x2) => x2.id === groupId);
      if (!g) return void 0;
      if (g.collapsed) {
        armExpand(groupId);
        return { kind: "slot", groupId, index: g.visible.filter((id) => id !== d.id).length };
      }
      armExpand(null);
      const rows = [...section.querySelectorAll("[data-row]")].filter((r) => r.dataset.row !== d.id);
      let index = 0;
      for (const r of rows) {
        const b = box(r);
        if (y > b.top + b.height / 2) index += 1;
      }
      return { kind: "slot", groupId, index };
    }
    function lineFor(d, to) {
      const nav = navRef.current;
      if (!nav || !to || to.kind === "trash") return null;
      const origin = nav.getBoundingClientRect().top + nav.clientTop - nav.scrollTop;
      let y = null;
      if (to.kind === "group") {
        if (d.origin && to.index === d.origin.index) return null;
        const movable = [...nav.querySelectorAll("[data-group]")].filter((s) => s.dataset.fixed !== "true" && s.dataset.group !== d.id);
        if (to.index < movable.length) y = box(movable[to.index]).top - 2;
        else {
          const fixed = nav.querySelector('[data-group][data-fixed="true"]');
          y = fixed ? box(fixed).top - 2 : movable.length ? box(movable[movable.length - 1]).bottom + 2 : null;
        }
      } else {
        const o = d.origin;
        if (o && d.from !== "trash" && o.groupId === to.groupId && o.index === to.index) return null;
        const section = [...nav.querySelectorAll("[data-group]")].find((s) => s.dataset.group === to.groupId);
        if (!section) return null;
        if (section.classList.contains("is-collapsed")) {
          const head = section.querySelector(".tbx-group-head");
          y = head ? box(head).bottom + 1 : box(section).top;
        } else {
          const rows = [...section.querySelectorAll("[data-row]")].filter((r) => r.dataset.row !== d.id);
          if (!rows.length) return null;
          y = to.index < rows.length ? box(rows[to.index]).top - 1 : box(rows[rows.length - 1]).bottom + 1;
        }
      }
      return y == null ? null : { top: Math.round(y - origin) };
    }
    function armExpand(groupId) {
      const cur = expandTimer.current;
      if (cur.id === groupId) return;
      clearTimeout(cur.timer);
      expandTimer.current = { id: groupId, timer: groupId ? setTimeout(() => model.toggleGroup(groupId), 650) : 0 };
    }
    function onUp(e) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (d.active) commit(d, targetRef.current);
      cleanup();
    }
    function onCancel() {
      cleanup();
    }
    function cleanup() {
      clearTimeout(holdTimer.current);
      armExpand(null);
      dragRef.current = null;
      targetRef.current = null;
      setDrag(null);
      setTarget(null);
      setLine(null);
      document.documentElement.classList.remove("tbx-dragging");
      window.removeEventListener("pointermove", stable.current.move);
      window.removeEventListener("pointerup", stable.current.up);
      window.removeEventListener("pointercancel", stable.current.cancel);
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    function commit(d, to) {
      if (!to) return;
      if (to.kind === "trash") {
        if (d.type === "module" && d.from !== "trash") act(() => model.hideModule(d.id));
        if (d.type === "group") act(() => model.hideGroup(d.id));
        return;
      }
      if (d.type === "group" && to.kind === "group") {
        if (d.origin && to.index === d.origin.index) return;
        const order = baseGroups.filter((g) => !g.fixed && g.id !== d.id);
        const before = order[to.index]?.id ?? baseGroups.find((g) => g.fixed)?.id;
        if (before && before !== d.id) act(() => model.moveGroup(d.id, before));
        return;
      }
      if (d.type === "module" && to.kind === "slot") {
        const g = baseGroups.find((x) => x.id === to.groupId);
        const list = g.visible.filter((id) => id !== d.id);
        const o = d.origin;
        if (o && o.groupId === to.groupId && o.index === to.index && d.from !== "trash") return;
        act(() => {
          if (to.index < list.length) model.moveModule(d.id, to.groupId, list[to.index], "before");
          else if (list.length) model.moveModule(d.id, to.groupId, list[list.length - 1], "after");
          else model.moveModule(d.id, to.groupId, null, "after");
        });
      }
    }
    handlers.current = { onMove, onUp, onCancel, cleanup };
    useEffect(() => () => handlers.current.cleanup(), []);
    function showTip(e, label) {
      if (!railCollapsed || drag) return;
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ label, left: r.right + 12, top: r.top + r.height / 2 });
    }
    function handleRowKey(e, id) {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        act(() => model.hideModule(id));
        return;
      }
      if (!e.altKey) return;
      const dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key];
      if (dir) {
        e.preventDefault();
        act(() => model.moveModuleByKeyboard(id, dir));
      }
    }
    function createGroup() {
      const problem = nameProblem(draftName);
      if (problem) {
        setNameError(problem);
        return;
      }
      if (act(() => model.createGroup(draftName))) {
        setDraftName("");
        setAdding(false);
        setNameError("");
      }
    }
    function startRename(g) {
      setRenaming(g.id);
      setRenameDraft(groupDisplayName(g));
      setNameError("");
    }
    function commitRename(groupId, { leaving = false } = {}) {
      const problem = nameProblem(renameDraft, groupId);
      if (problem) {
        if (leaving) {
          setRenaming(null);
          setNameError("");
        } else setNameError(problem);
        return;
      }
      if (model.renameGroup(groupId, renameDraft) || leaving) {
        setRenaming(null);
        setNameError("");
      }
    }
    function toggle(g) {
      if (suppressClick.current || renaming === g.id) return;
      model.toggleGroup(g.id);
    }
    const isGroupDragging = drag?.active && drag.type === "group";
    const showFixedWhenEmpty = drag?.active && drag.type === "module";
    const row = (id, groupId) => {
      const m = modules.byId(id);
      if (!m) return null;
      const label = moduleDisplayName(m);
      const active = modulePath(id) === routePath;
      const origin = moduleDrag && moduleDrag.id === id;
      return /* @__PURE__ */ h(
        "a",
        {
          key: id,
          ref: flipRef(`m:${id}`),
          href: moduleHref(id),
          className: cx("tbx-row", active && "is-active", origin && "is-origin"),
          "data-row": id,
          "data-label": label,
          "data-module": id,
          draggable: false,
          "aria-current": active ? "page" : void 0,
          "aria-label": `${label}\u3002${tw2("\u53EF\u62D6\u52A8\u6392\u5E8F\uFF1BAlt \u52A0\u65B9\u5411\u952E\u79FB\u52A8\uFF1BDelete \u79FB\u5230\u5783\u573E\u6876")}`,
          onDragStart: (e) => e.preventDefault(),
          onPointerDown: (e) => beginPress(e, { type: "module", id, from: "nav", groupId }),
          onPointerEnter: (e) => showTip(e, label),
          onPointerLeave: () => setTip(null),
          onFocus: (e) => showTip(e, label),
          onBlur: () => setTip(null),
          onKeyDown: (e) => handleRowKey(e, id),
          onClick: (e) => {
            if (suppressClick.current) {
              e.preventDefault();
              return;
            }
            followAnchor(e, moduleHref(id));
            onNavigate();
          }
        },
        /* @__PURE__ */ h("span", { className: "tbx-row-icon" }, /* @__PURE__ */ h(Glyph2, { name: m.icon })),
        /* @__PURE__ */ h("span", { className: "tbx-row-label" }, label)
      );
    };
    return /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(
      "button",
      {
        hidden: !mobileOpen,
        "aria-hidden": !mobileOpen,
        className: cx("tb-mobile-scrim", mobileOpen && "is-visible"),
        "aria-label": tw2("\u5173\u95ED\u5DE5\u4F5C\u53F0\u5BFC\u822A"),
        onClick: onCloseMobile
      }
    ), /* @__PURE__ */ h(
      "aside",
      {
        className: cx("tb-sidebar tbx-side", mobileOpen && "is-mobile-open", railCollapsed && "is-rail-collapsed", drag?.active && "is-dragging"),
        "aria-label": tw2("\u5DE5\u4F5C\u53F0\u5BFC\u822A"),
        "aria-hidden": isNarrow && !mobileOpen ? true : void 0,
        inert: isNarrow && !mobileOpen ? "" : void 0
      },
      isNarrow && /* @__PURE__ */ h("div", { className: "tbx-side-mobile-head" }, /* @__PURE__ */ h("strong", null, "TeachBuddy"), /* @__PURE__ */ h("button", { type: "button", onClick: onCloseMobile, "aria-label": tw2("\u5173\u95ED") }, /* @__PURE__ */ h(Glyph2, { name: "close", size: 18 }))),
      /* @__PURE__ */ h("div", { className: "tbx-side-head" }, /* @__PURE__ */ h(
        SidebarHead,
        {
          accountName,
          onAnnounce: model.announce,
          openSurface,
          onToggleSurface,
          onOpenSurface,
          onCloseSurface,
          visible: isNarrow ? mobileOpen : !railCollapsed
        }
      )),
      isNarrow && /* @__PURE__ */ h("nav", { className: "tbx-side-mobile-nav", "aria-label": tw2("\u5168\u5C40\u5BFC\u822A") }, /* @__PURE__ */ h("a", { className: cx("tbx-row", routePath === HOME_PATH && "is-active"), href: withSearch(HOME_PATH), onClick: (e) => {
        followAnchor(e, HOME_PATH);
        onCloseMobile();
      } }, /* @__PURE__ */ h("span", { className: "tbx-row-icon" }, /* @__PURE__ */ h(Glyph2, { name: "home" })), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, tw2("\u9996\u9875"))), workbenchModulesAll.filter((m) => m.navigation === "top").map((m) => /* @__PURE__ */ h("a", { key: m.id, className: cx("tbx-row", routePath === m.path && "is-active"), href: m.path, onClick: (e) => {
        followAnchor(e, m.path);
        onCloseMobile();
      } }, /* @__PURE__ */ h("span", { className: "tbx-row-icon" }, /* @__PURE__ */ h(Glyph2, { name: m.icon || "calendar" })), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, moduleDisplayName(m)))), /* @__PURE__ */ h("button", { type: "button", className: "tbx-row", "aria-expanded": mobileSupport, onClick: () => setMobileSupport((v) => !v) }, /* @__PURE__ */ h("span", { className: "tbx-row-icon" }, /* @__PURE__ */ h(Glyph2, { name: "circleHelp" })), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, tw2("\u652F\u6301")), /* @__PURE__ */ h("span", { className: cx("tbx-chevron", mobileSupport && "is-open") }, /* @__PURE__ */ h(Glyph2, { name: "chevron", size: 16 }))), mobileSupport && SUPPORT_MENU_ITEMS.map((item) => /* @__PURE__ */ h("a", { key: item.label, className: cx("tbx-row is-sub", routePath === item.route && "is-active"), href: withSearch(item.route), onClick: (e) => {
        followAnchor(e, item.route);
        onCloseMobile();
      } }, /* @__PURE__ */ h("span", { className: "tbx-row-icon" }, /* @__PURE__ */ h(Glyph2, { name: item.icon, size: 18 })), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, tw2(item.label))))),
      /* @__PURE__ */ h(NavigationStatus, { navigation: model.navigation, railCollapsed, onExpand }),
      /* @__PURE__ */ h("nav", { className: cx("tbx-side-nav", isGroupDragging && "is-group-drag"), "aria-label": tw2("\u529F\u80FD\u6A21\u5757"), ref: navRef }, groups.map((g) => {
        const empty = g.visible.length === 0;
        if (g.fixed && empty && !showFixedWhenEmpty) return null;
        const isTarget = target?.kind === "slot" && target.groupId === g.id;
        const lifted = isGroupDragging && drag.id === g.id;
        const name = groupDisplayName(g);
        const editing = renaming === g.id;
        return /* @__PURE__ */ h(
          "section",
          {
            key: g.id,
            ref: flipRef(`g:${g.id}`),
            className: cx("tbx-group", g.collapsed && "is-collapsed", isTarget && "is-target", lifted && "is-lifted", empty && "is-empty"),
            "data-group": g.id,
            "data-fixed": g.fixed ? "true" : "false"
          },
          /* @__PURE__ */ h("div", { className: "tbx-fold tbx-group-fold" }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h(
            "div",
            {
              className: cx("tbx-group-head", editing && "is-editing"),
              role: "button",
              tabIndex: editing ? -1 : 0,
              "aria-expanded": !g.collapsed,
              "aria-label": name,
              onPointerDown: g.fixed || editing ? void 0 : (e) => beginPress(e, { type: "group", id: g.id }),
              onClick: (e) => {
                if (!e.target.closest(".tbx-group-more, input")) toggle(g);
              },
              onKeyDown: (e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(g);
                }
              },
              onContextMenu: (e) => {
                if (g.fixed || !editable) return;
                e.preventDefault();
                setMenu({ group: g, at: { x: Math.min(e.clientX, innerWidth - 220), y: Math.min(e.clientY, innerHeight - 110) } });
              }
            },
            editing ? /* @__PURE__ */ h(
              "input",
              {
                autoFocus: true,
                className: "tbx-group-rename",
                maxLength: 80,
                value: renameDraft,
                "aria-label": tw2("\u91CD\u547D\u540D\u5206\u7EC4"),
                "aria-invalid": nameError ? true : void 0,
                onChange: (e) => {
                  setRenameDraft(e.target.value);
                  setNameError("");
                },
                onBlur: () => commitRename(g.id, { leaving: true }),
                onKeyDown: (e) => {
                  if (e.key === "Enter") commitRename(g.id);
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setRenaming(null);
                    setNameError("");
                  }
                }
              }
            ) : /* @__PURE__ */ h("span", { className: "tbx-group-title" }, /* @__PURE__ */ h("span", { className: "tbx-group-name" }, name), /* @__PURE__ */ h("span", { className: "tbx-chevron" }, /* @__PURE__ */ h(Glyph2, { name: "chevron", size: 14 }))),
            !g.fixed && editable && !editing && /* @__PURE__ */ h(
              "button",
              {
                type: "button",
                className: "tbx-group-more",
                "aria-label": tw2("\u5206\u7EC4\u9009\u9879"),
                onClick: (e) => {
                  e.stopPropagation();
                  const r = e.currentTarget.getBoundingClientRect();
                  setMenu((m) => m?.group.id === g.id ? null : { group: g, at: { x: r.right + 6, y: r.top } });
                }
              },
              /* @__PURE__ */ h(Glyph2, { name: "more", size: 16 })
            )
          ), editing && nameError && /* @__PURE__ */ h("p", { className: "tbx-name-error", role: "alert" }, nameError))),
          /* @__PURE__ */ h("div", { className: "tbx-group-body" }, /* @__PURE__ */ h("div", { className: "tbx-group-rows" }, g.visible.map((id) => row(id, g.id)), empty && (showFixedWhenEmpty ? /* @__PURE__ */ h("div", { className: cx("tbx-drop-hint", isTarget && "is-on") }, tw2("\u653E\u5230\u8FD9\u91CC")) : !g.fixed && /* @__PURE__ */ h("div", { className: "tbx-fold tbx-hint-fold" }, /* @__PURE__ */ h("div", { className: "tbx-drop-hint is-idle" }, tw2("\u628A\u6A21\u5757\u62D6\u5230\u8FD9\u91CC"))))))
        );
      }), line && /* @__PURE__ */ h("div", { className: "tbx-drop-line", style: { transform: `translateY(${line.top}px)` }, "aria-hidden": "true" }), /* @__PURE__ */ h("div", { className: "tbx-fold tbx-new-group-fold", ref: flipRef("new-group") }, /* @__PURE__ */ h("div", null, adding ? /* @__PURE__ */ h("form", { className: cx("tbx-new-group", nameError && "is-invalid"), onSubmit: (e) => {
        e.preventDefault();
        createGroup();
      } }, /* @__PURE__ */ h(Glyph2, { name: "folder", size: 18 }), /* @__PURE__ */ h(
        "input",
        {
          autoFocus: true,
          value: draftName,
          maxLength: 80,
          placeholder: tw2("\u5206\u7EC4\u540D\u79F0"),
          "aria-label": tw2("\u65B0\u5206\u7EC4\u540D\u79F0"),
          "aria-invalid": nameError ? true : void 0,
          onChange: (e) => {
            setDraftName(e.target.value);
            setNameError("");
          },
          onBlur: () => {
            if (!draftName.trim() || nameError) {
              setDraftName("");
              setAdding(false);
              setNameError("");
            }
          },
          onKeyDown: (e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setDraftName("");
              setAdding(false);
              setNameError("");
            }
          }
        }
      )) : /* @__PURE__ */ h("button", { type: "button", className: "tbx-new-group-button", disabled: !editable, onClick: () => {
        setAdding(true);
        setNameError("");
      } }, /* @__PURE__ */ h(Glyph2, { name: "plus", size: 16 }), /* @__PURE__ */ h("span", null, tw2("\u65B0\u5EFA\u5206\u7EC4"))), adding && nameError && /* @__PURE__ */ h("p", { className: "tbx-name-error", role: "alert" }, nameError)))),
      /* @__PURE__ */ h("div", { className: cx("tbx-side-foot", trashOpen && "is-open") }, /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          ref: trashRef,
          className: cx("tbx-row tbx-trash", target?.kind === "trash" && "is-drop", drag?.active && "is-armed"),
          "aria-expanded": trashOpen,
          "data-label": tw2("\u5783\u573E\u6876"),
          onPointerEnter: (e) => showTip(e, hiddenIds.length ? `${tw2("\u5783\u573E\u6876")} \xB7 ${hiddenIds.length}` : tw2("\u5783\u573E\u6876")),
          onPointerLeave: () => setTip(null),
          onClick: () => {
            if (railCollapsed) onExpand();
            setTrashOpen((v) => railCollapsed ? true : !v);
          }
        },
        /* @__PURE__ */ h("span", { className: "tbx-row-icon" }, /* @__PURE__ */ h(Glyph2, { name: "trash" })),
        /* @__PURE__ */ h("span", { className: "tbx-row-label" }, target?.kind === "trash" ? tw2("\u677E\u5F00\uFF0C\u79FB\u5230\u5783\u573E\u6876") : tw2("\u5783\u573E\u6876")),
        hiddenIds.length > 0 && /* @__PURE__ */ h("span", { className: "tbx-count" }, hiddenIds.length),
        /* @__PURE__ */ h("span", { className: "tbx-chevron" }, /* @__PURE__ */ h(Glyph2, { name: "chevron", size: 14 }))
      ), /* @__PURE__ */ h("div", { className: "tbx-trash-drawer" }, /* @__PURE__ */ h("div", { className: "tbx-trash-list" }, hiddenIds.length === 0 && /* @__PURE__ */ h("p", { className: "tbx-trash-empty" }, tw2("\u5783\u573E\u6876\u662F\u7A7A\u7684\u3002\u628A\u4E0D\u5E38\u7528\u7684\u6A21\u5757\u62D6\u5230\u8FD9\u91CC\uFF0C\u754C\u9762\u4F1A\u66F4\u6E05\u723D\u3002")), hiddenIds.map((id) => {
        const m = modules.byId(id);
        if (!m) return null;
        return /* @__PURE__ */ h(
          "div",
          {
            key: id,
            className: cx("tbx-trash-item", drag?.active && drag.id === id && "is-lifted"),
            onPointerDown: (e) => beginPress(e, { type: "module", id, from: "trash" })
          },
          /* @__PURE__ */ h("span", { className: "tbx-row-icon" }, /* @__PURE__ */ h(Glyph2, { name: m.icon, size: 18 })),
          /* @__PURE__ */ h("span", { className: "tbx-row-label" }, moduleDisplayName(m)),
          /* @__PURE__ */ h("button", { type: "button", className: "tbx-trash-restore", onClick: () => act(() => model.restoreModule(id)), "aria-label": `${tw2("\u6062\u590D")} ${moduleDisplayName(m)}` }, /* @__PURE__ */ h(Glyph2, { name: "restore", size: 15 }), tw2("\u6062\u590D"))
        );
      }))))
    ), drag?.active && /* @__PURE__ */ h(
      "div",
      {
        className: cx("tbx-drag-ghost", drag.type === "group" && "is-group", target?.kind === "trash" && "is-trash"),
        style: { transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px)` },
        "aria-hidden": "true"
      },
      drag.type === "module" ? /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: "tbx-row-icon" }, /* @__PURE__ */ h(Glyph2, { name: modules.byId(drag.id)?.icon })), /* @__PURE__ */ h("span", null, moduleDisplayName(modules.byId(drag.id)))) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: "tbx-row-icon" }, /* @__PURE__ */ h(Glyph2, { name: "folder", size: 18 })), /* @__PURE__ */ h("span", null, groupDisplayName(baseGroups.find((g) => g.id === drag.id) || {})))
    ), menu && /* @__PURE__ */ h(
      GroupMenu,
      {
        at: menu.at,
        onClose: () => setMenu(null),
        onRename: () => {
          startRename(menu.group);
          setMenu(null);
        },
        onDelete: () => {
          act(() => model.deleteGroup(menu.group.id));
          setMenu(null);
        }
      }
    ), /* @__PURE__ */ h(ConfirmHost, null), railCollapsed && tip && /* @__PURE__ */ h("span", { className: "tb-rail-tooltip tbx-tip", role: "tooltip", style: { left: tip.left, top: tip.top } }, tip.label));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/demo/seed.js
  async function seedDemo() {
    const uid2 = () => crypto.randomUUID();
    const log = [];
    async function call3(method, path2, body) {
      const init = { method, headers: { "Idempotency-Key": uid2() } };
      if (body instanceof FormData) init.body = body;
      else if (body !== void 0) {
        init.body = JSON.stringify(body);
        init.headers["Content-Type"] = "application/json";
      }
      const res = await fetch(path2, init);
      const json = res.status === 204 ? null : await res.json().catch(() => null);
      if (!res.ok) log.push(`${method} ${path2} -> ${res.status} ${JSON.stringify(json).slice(0, 160)}`);
      return json;
    }
    const doc = (text) => ({ version: 2, blocks: String(text).split("\n").filter(Boolean).map((line) => {
      const runs = [];
      let end = 0;
      for (const m of line.matchAll(/\$([^$]+)\$/g)) {
        if (m.index > end) runs.push({ type: "text", text: line.slice(end, m.index) });
        runs.push({ type: "math", latex: m[1] });
        end = m.index + m[0].length;
      }
      if (end < line.length) runs.push({ type: "text", text: line.slice(end) });
      return { type: "paragraph", runs };
    }) });
    const qtax = await call3("GET", "/api/modules/questions/v2/taxonomy");
    const types = [["t-choice", "\u9009\u62E9\u9898"], ["t-fill", "\u586B\u7A7A\u9898"], ["t-solve", "\u89E3\u7B54\u9898"], ["t-proof", "\u8BC1\u660E\u9898"]].map(([id, name]) => ({ id, name }));
    const tags = [["g-func", "\u4E8C\u6B21\u51FD\u6570"], ["g-geo", "\u5168\u7B49\u4E09\u89D2\u5F62"], ["g-frac", "\u5206\u5F0F"], ["g-eq", "\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B"], ["g-hard", "\u538B\u8F74"], ["g-mistake", "\u6613\u9519"]].map(([id, name]) => ({ id, name }));
    await call3("PUT", "/api/modules/questions/v2/taxonomy", { baseVersion: qtax.version, types, tags });
    const questions = [
      ["\u4E8C\u6B21\u51FD\u6570\u7684\u9876\u70B9\u4E0E\u5BF9\u79F0\u8F74", "\u5DF2\u77E5\u629B\u7269\u7EBF $y=x^2-4x+3$\uFF0C\u6C42\u5B83\u7684\u9876\u70B9\u5750\u6807\u3001\u5BF9\u79F0\u8F74\uFF0C\u5E76\u8BF4\u660E\u5F00\u53E3\u65B9\u5411\u3002", "\u914D\u65B9\u5F97 $y=(x-2)^2-1$\uFF0C\u9876\u70B9 $(2,-1)$\uFF0C\u5BF9\u79F0\u8F74 $x=2$\uFF0C\u5F00\u53E3\u5411\u4E0A\u3002", "t-solve", ["g-func"]],
      ["\u5224\u522B\u5F0F\u4E0E\u6839\u7684\u4E2A\u6570", "\u5173\u4E8E $x$ \u7684\u65B9\u7A0B $x^2+2x+k=0$ \u6709\u4E24\u4E2A\u4E0D\u76F8\u7B49\u7684\u5B9E\u6570\u6839\uFF0C\u6C42 $k$ \u7684\u53D6\u503C\u8303\u56F4\u3002", "$\\Delta=4-4k>0$\uFF0C\u6240\u4EE5 $k<1$\u3002", "t-fill", ["g-eq", "g-mistake"]],
      ["SAS \u8BC1\u660E\u5168\u7B49", "\u5982\u56FE\uFF0C$AB=AD$\uFF0C$\\angle BAC=\\angle DAC$\u3002\u6C42\u8BC1\uFF1A$\\triangle ABC\\cong\\triangle ADC$\u3002", "$AB=AD$\uFF0C$\\angle BAC=\\angle DAC$\uFF0C$AC=AC$\uFF0C\u7531 SAS \u5F97\u8BC1\u3002", "t-proof", ["g-geo"]],
      ["\u5206\u5F0F\u65B9\u7A0B\u7684\u589E\u6839", "\u89E3\u65B9\u7A0B $\\dfrac{x}{x-2}-\\dfrac{4}{x^2-4}=1$\uFF0C\u5E76\u68C0\u9A8C\u3002", "\u53BB\u5206\u6BCD\u5F97 $x(x+2)-4=x^2-4$\uFF0C\u89E3\u5F97 $x=0$\uFF0C\u68C0\u9A8C\u6210\u7ACB\u3002", "t-solve", ["g-frac", "g-mistake"]],
      ["\u629B\u7269\u7EBF\u4E0E x \u8F74\u4EA4\u70B9", "\u629B\u7269\u7EBF $y=-x^2+bx+3$ \u7ECF\u8FC7\u70B9 $(1,4)$\uFF0C\u6C42\u5B83\u4E0E $x$ \u8F74\u7684\u4EA4\u70B9\u3002", "\u4EE3\u5165\u5F97 $b=2$\uFF0C\u4EE4 $y=0$ \u5F97 $x=3$ \u6216 $x=-1$\u3002", "t-solve", ["g-func", "g-hard"]],
      ["\u4E8C\u6B21\u51FD\u6570\u56FE\u50CF\u5E73\u79FB", "\u628A $y=2x^2$ \u7684\u56FE\u50CF\u5411\u53F3\u5E73\u79FB 3 \u4E2A\u5355\u4F4D\uFF0C\u518D\u5411\u4E0A\u5E73\u79FB 1 \u4E2A\u5355\u4F4D\uFF0C\u6240\u5F97\u89E3\u6790\u5F0F\u662F\uFF08 \uFF09", "$y=2(x-3)^2+1$", "t-choice", ["g-func"]],
      ["\u6700\u503C\u5E94\u7528\u9898", "\u67D0\u5546\u54C1\u8FDB\u4EF7 40 \u5143\uFF0C\u552E\u4EF7 $x$ \u5143\u65F6\u65E5\u9500\u91CF\u4E3A $(100-x)$ \u4EF6\u3002\u552E\u4EF7\u5B9A\u4E3A\u591A\u5C11\u65F6\u65E5\u5229\u6DA6\u6700\u5927\uFF1F", "\u5229\u6DA6 $W=(x-40)(100-x)$\uFF0C\u5F53 $x=70$ \u65F6\u6700\u5927\uFF0C\u4E3A 900 \u5143\u3002", "t-solve", ["g-func", "g-hard"]]
    ];
    for (const [title, body, solution, typeId, tagIds] of questions) {
      await call3("POST", "/api/modules/questions/v2/items", { title, body: doc(body), solution: doc(solution), answerStatus: "present", typeId, tagIds });
    }
    const settings = await call3("GET", "/api/modules/schedule/settings");
    const tz = settings?.timeZone || "UTC";
    const labelDefs = [["\u521D\u4E09\uFF082\uFF09\u73ED", "#0a84ff"], ["\u521D\u4E09\uFF085\uFF09\u73ED", "#af52de"], ["\u6559\u7814", "#ff9500"], ["\u5BB6\u957F", "#34c759"]];
    const labels = [];
    for (const [name, color] of labelDefs) {
      const l = await call3("POST", "/api/modules/schedule/labels", { name, color });
      if (l?.id) labels.push(l);
    }
    const today2 = /* @__PURE__ */ new Date();
    const iso2 = (d) => d.toISOString().slice(0, 10);
    const day = (offset) => {
      const d = new Date(Date.UTC(today2.getUTCFullYear(), today2.getUTCMonth(), today2.getUTCDate() + offset));
      return iso2(d);
    };
    const entry = (title, date, startTime, durationMinutes, tagIndex, items = [], notes = "") => ({
      title,
      items: items.map(([text, priority = "normal", completed = false]) => ({ id: uid2(), text, priority, completed })),
      time: date ? { date, startTime, timeZone: tz, durationMinutes } : null,
      repeat: null,
      reminder: null,
      calendar: { allDay: false, notes, tags: tagIndex == null || !labels[tagIndex] ? [] : [labels[tagIndex].id] }
    });
    const plan = [
      entry("\u521D\u4E09\uFF082\uFF09\u73ED \u6570\u5B66", day(0), "08:00", 45, 0, [["\u8BB2\u4E8C\u6B21\u51FD\u6570\u9876\u70B9\u5F0F"], ["\u5F53\u5802\u7EC3\u4E60 3 \u9898", "high"]]),
      entry("\u521D\u4E09\uFF085\uFF09\u73ED \u6570\u5B66", day(0), "10:10", 45, 1, [["\u590D\u4E60\u5224\u522B\u5F0F"]]),
      entry("\u6570\u5B66\u7EC4\u6559\u7814", day(0), "14:30", 90, 2, [["\u5206\u4EAB\u5206\u5C42\u4F5C\u4E1A\u8BBE\u8BA1", "high"], ["\u542C\u8BFE\u53CD\u9988"]], "\u4E09\u697C\u4F1A\u8BAE\u5BA4"),
      entry("\u665A\u81EA\u4E60\u7B54\u7591", day(0), "19:00", 60, 0),
      entry("\u521D\u4E09\uFF082\uFF09\u73ED \u6570\u5B66", day(1), "08:00", 45, 0, [["\u8BB2\u5168\u7B49\u4E09\u89D2\u5F62\u5224\u5B9A"]]),
      entry("\u5BB6\u957F\u4F1A\u51C6\u5907", day(1), "16:00", 60, 3, [["\u6210\u7EE9\u5206\u6790 PPT", "high"], ["\u6253\u5370\u5EA7\u4F4D\u8868"]]),
      entry("\u521D\u4E09\uFF085\uFF09\u73ED \u6570\u5B66", day(2), "09:00", 45, 1),
      entry("\u516C\u5F00\u8BFE\u8BD5\u8BB2", day(2), "15:00", 60, 2, [["\u629B\u7269\u7EBF\u52A8\u6001\u6F14\u793A"], ["\u8BF7\u738B\u8001\u5E08\u542C\u8BFE"]]),
      entry("\u521D\u4E09\uFF082\uFF09\u73ED \u6570\u5B66", day(3), "08:00", 45, 0),
      entry("\u5468\u6D4B\u9605\u5377", day(3), "13:30", 120, null, [["\u9605 2 \u73ED\u8BD5\u5377"], ["\u9605 5 \u73ED\u8BD5\u5377"], ["\u7EDF\u8BA1\u9519\u9898"]]),
      entry("\u521D\u4E09\uFF085\uFF09\u73ED \u6570\u5B66", day(4), "10:10", 45, 1),
      entry("\u6279\u6539\u7B2C\u4E09\u5355\u5143\u4F5C\u4E1A", null, null, null, null, [["2 \u73ED\u4F5C\u4E1A", "high"], ["5 \u73ED\u4F5C\u4E1A", "high"], ["\u767B\u8BB0\u672A\u4EA4\u540D\u5355"]]),
      entry("\u51C6\u5907\u4E8C\u6B21\u51FD\u6570\u590D\u4E60\u8BFE", null, null, null, null, [["\u6574\u7406 10 \u9053\u5178\u578B\u9898"], ["\u505A\u629B\u7269\u7EBF\u5E73\u79FB\u52A8\u753B", "high"], ["\u5199\u5BFC\u5B66\u6848"]]),
      entry("\u8054\u7CFB\u5C0F\u9648\u5BB6\u957F", null, null, null, 3, [["\u7EA6\u5468\u56DB\u653E\u5B66\u540E\u9762\u8C08", "low"]]),
      entry("", null, null, null, null, [["\u8BA2\u4E0B\u5B66\u671F\u7EC3\u4E60\u518C", "low"], ["\u66F4\u65B0\u73ED\u7EA7\u7FA4\u516C\u544A"]])
    ];
    for (const e of plan) await call3("POST", "/api/modules/schedule/entries", e);
    const rtax = await call3("GET", "/api/modules/resources/taxonomy");
    const folders = [["f-lesson", "\u8BFE\u4EF6", null], ["f-paper", "\u8BD5\u5377", null], ["f-unit", "\u7B2C\u4E8C\u5355\u5143", "f-lesson"]].map(([id, name, parentId]) => ({ id, name, parentId }));
    const rtags = [["r-func", "\u4E8C\u6B21\u51FD\u6570"], ["r-exam", "\u671F\u4E2D"], ["r-share", "\u7EC4\u5185\u5171\u4EAB"]].map(([id, name]) => ({ id, name }));
    await call3("PUT", "/api/modules/resources/taxonomy", { baseVersion: rtax?.version ?? 1, folders, tags: rtags });
    async function slide(title, sub, bg, ink) {
      const c = new OffscreenCanvas(1280, 720);
      const g = c.getContext("2d");
      g.fillStyle = bg;
      g.fillRect(0, 0, 1280, 720);
      g.strokeStyle = ink;
      g.globalAlpha = 0.25;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(760, 140);
      g.quadraticCurveTo(940, 820, 1120, 140);
      g.stroke();
      g.beginPath();
      g.moveTo(700, 480);
      g.lineTo(1180, 480);
      g.moveTo(940, 600);
      g.lineTo(940, 120);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = ink;
      g.font = "bold 64px sans-serif";
      g.fillText(title, 90, 330);
      g.font = "32px sans-serif";
      g.globalAlpha = 0.7;
      g.fillText(sub, 90, 400);
      return new File([await c.convertToBlob({ type: "image/png" })], `${title}.png`, { type: "image/png" });
    }
    const files = [
      [await slide("\u4E8C\u6B21\u51FD\u6570\u7684\u56FE\u50CF", "\u7B2C\u4E8C\u5355\u5143 \u7B2C 1 \u8BFE\u65F6", "#1d1d1f", "#f5f5f7"), "\u4E8C\u6B21\u51FD\u6570\u7684\u56FE\u50CF\uFF08\u8BFE\u4EF6\u5C01\u9762\uFF09", "f-unit", ["r-func"]],
      [await slide("\u9876\u70B9\u5F0F\u4E0E\u5E73\u79FB", "\u7B2C\u4E8C\u5355\u5143 \u7B2C 2 \u8BFE\u65F6", "#fff8db", "#1d1d1f"), "\u9876\u70B9\u5F0F\u4E0E\u5E73\u79FB", "f-unit", ["r-func", "r-share"]],
      [await slide("\u671F\u4E2D\u590D\u4E60", "\u521D\u4E09\u6570\u5B66 \xB7 \u91CD\u70B9\u68B3\u7406", "#eef5fd", "#1d1d1f"), "\u671F\u4E2D\u590D\u4E60\u63D0\u7EB2", "f-paper", ["r-exam"]],
      [await slide("\u9519\u9898\u56DE\u987E", "\u5224\u522B\u5F0F\u4E0E\u6839\u7684\u4E2A\u6570", "#f5f2fd", "#1d1d1f"), "\u9519\u9898\u56DE\u987E\uFF1A\u5224\u522B\u5F0F", null, []]
    ];
    for (const [file, title, folderId, tagIds] of files) {
      const fd2 = new FormData();
      fd2.append("file", file);
      const stored = await call3("POST", "/api/workbench/files", fd2);
      if (stored?.id) await call3("POST", "/api/modules/resources/items", { fileId: stored.id, title, folderId, tagIds, note: "" });
    }
    const formula = (id, latex, caption = "") => ({ id, latex, caption, includeCaption: Boolean(caption), color: "#1d1d1f", fontSize: 30 });
    const workshop = (formulas) => ({ schemaVersion: 1, kind: "workshop", formulas, graph: null, view: "plane", steps: [], initialStepId: null, animation: null, traceObjects: [] });
    const works = [
      ["\u7B49\u5DEE\u6570\u5217\u6C42\u548C", [formula("f1", "S_n=\\frac{n(a_1+a_n)}{2}"), formula("f2", "a_n=a_1+(n-1)d")]],
      ["\u52FE\u80A1\u5B9A\u7406", [formula("f1", "a^2+b^2=c^2")]],
      ["\u4E8C\u6B21\u51FD\u6570\u9876\u70B9\u5F0F", [formula("f1", "y=a(x-h)^2+k"), formula("f2", "y=x^2-4x+3=(x-2)^2-1")]],
      ["\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B\u6C42\u6839\u516C\u5F0F", [formula("f1", "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}"), formula("f2", "\\Delta=b^2-4ac")]]
    ];
    for (const [title, formulas] of works) await call3("POST", "/api/modules/math/v1/works", { title, source: workshop(formulas) });
    const page = `<!doctype html><meta charset="utf-8"><title>\u629B\u7269\u7EBF\u5E73\u79FB</title><body style="margin:0;display:grid;place-items:center;height:100vh;font-family:sans-serif"><svg viewBox="-6 -2 12 10" width="480"><path d="M-6 6H6M0 -2V8" stroke="#ccc" stroke-width=".05"/><path id="p" d="M-3 -1Q0 11 3 -1" fill="none" stroke="#af52de" stroke-width=".12"><animateTransform attributeName="transform" type="translate" values="-2 0;2 0;-2 0" dur="4s" repeatCount="indefinite"/></path></svg></body>`;
    const fd = new FormData();
    fd.append("file", new File([page], "\u629B\u7269\u7EBF\u5E73\u79FB.html", { type: "text/html" }));
    const html = await call3("POST", "/api/workbench/files", fd);
    if (html?.id) await call3("POST", "/api/modules/math/v1/works", { title: "\u629B\u7269\u7EBF\u5E73\u79FB\u52A8\u753B", source: { schemaVersion: 1, kind: "html", fileId: html.id }, originalFileId: html.id });
    const old = await call3("POST", "/api/modules/math/v1/works", { title: "\u65E7\u7248\uFF1A\u5206\u5F0F\u5316\u7B80", source: workshop([formula("f1", "\\frac{x^2-4}{x+2}=x-2")]) });
    if (old?.id) await call3("POST", `/api/modules/math/v1/works/${old.id}/deletion`, { baseVersion: old.version, deleted: true });
    {
      let zip2 = function(files2) {
        const enc = new TextEncoder();
        const parts = [];
        const central = [];
        let offset = 0;
        for (const [name, text] of files2) {
          const nb = enc.encode(name), data = enc.encode(text), sum2 = crc(data);
          const l = new DataView(new ArrayBuffer(30));
          l.setUint32(0, 67324752, true);
          l.setUint16(4, 20, true);
          l.setUint32(14, sum2, true);
          l.setUint32(18, data.length, true);
          l.setUint32(22, data.length, true);
          l.setUint16(26, nb.length, true);
          parts.push(new Uint8Array(l.buffer), nb, data);
          const e = new DataView(new ArrayBuffer(46));
          e.setUint32(0, 33639248, true);
          e.setUint16(4, 20, true);
          e.setUint16(6, 20, true);
          e.setUint32(16, sum2, true);
          e.setUint32(20, data.length, true);
          e.setUint32(24, data.length, true);
          e.setUint16(28, nb.length, true);
          e.setUint32(42, offset, true);
          central.push(new Uint8Array(e.buffer), nb);
          offset += 30 + nb.length + data.length;
        }
        const size = central.reduce((a, p) => a + p.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 101010256, true);
        end.setUint16(8, files2.length, true);
        end.setUint16(10, files2.length, true);
        end.setUint32(12, size, true);
        end.setUint32(16, offset, true);
        return new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
      };
      const C = "/api/modules/classroom";
      let seed = 20261018;
      const rand = () => {
        seed = seed * 1664525 + 1013904223 >>> 0;
        return seed / 2 ** 32;
      };
      const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
      const tagNames = ["\u4E8C\u6B21\u51FD\u6570", "\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B", "\u5224\u522B\u5F0F", "\u914D\u65B9\u6CD5", "\u56FE\u50CF\u4E0E\u6027\u8D28", "\u5E94\u7528\u9898", "\u5168\u7B49\u4E09\u89D2\u5F62", "\u8BA1\u7B97"];
      const tag = {};
      for (const name of tagNames) {
        const t2 = await call3("POST", `${C}/tags`, { name });
        if (t2?.id) tag[name] = t2.id;
      }
      const q = (group, label, fullScore, tags2) => ({ group, label, fullScore, tagIds: tags2.map((n) => tag[n]).filter(Boolean) });
      const examDefs = [
        ["\u7B2C\u4E00\u5355\u5143\u6D4B\u9A8C", "2026-09-12", 100, [
          ...[1, 2, 3, 4, 5].map((i) => q("\u9009\u62E9\u9898", `\u7B2C ${i} \u9898`, 4, [["\u8BA1\u7B97"], ["\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B"], ["\u5224\u522B\u5F0F"], ["\u914D\u65B9\u6CD5"], ["\u56FE\u50CF\u4E0E\u6027\u8D28"]][i - 1])),
          ...[6, 7, 8, 9].map((i) => q("\u586B\u7A7A\u9898", `\u7B2C ${i} \u9898`, 5, [["\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B"], ["\u5224\u522B\u5F0F"], ["\u914D\u65B9\u6CD5"], ["\u8BA1\u7B97"]][i - 6])),
          q("\u89E3\u7B54\u9898", "\u7B2C 10 \u9898", 12, ["\u914D\u65B9\u6CD5", "\u8BA1\u7B97"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 11 \u9898", 14, ["\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 12 \u9898", 16, ["\u5E94\u7528\u9898", "\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 13 \u9898", 18, ["\u5224\u522B\u5F0F", "\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B"])
        ]],
        ["\u4E5D\u6708\u6708\u8003", "2026-09-26", 120, [
          ...[1, 2, 3, 4, 5, 6].map((i) => q("\u9009\u62E9\u9898", `\u7B2C ${i} \u9898`, 4, [["\u8BA1\u7B97"], ["\u56FE\u50CF\u4E0E\u6027\u8D28"], ["\u5224\u522B\u5F0F"], ["\u5168\u7B49\u4E09\u89D2\u5F62"], ["\u4E8C\u6B21\u51FD\u6570"], ["\u914D\u65B9\u6CD5"]][i - 1])),
          ...[7, 8, 9, 10].map((i) => q("\u586B\u7A7A\u9898", `\u7B2C ${i} \u9898`, 4, [["\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B"], ["\u4E8C\u6B21\u51FD\u6570"], ["\u5168\u7B49\u4E09\u89D2\u5F62"], ["\u56FE\u50CF\u4E0E\u6027\u8D28"]][i - 7])),
          q("\u89E3\u7B54\u9898", "\u7B2C 11 \u9898", 14, ["\u8BA1\u7B97", "\u914D\u65B9\u6CD5"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 12 \u9898", 16, ["\u5168\u7B49\u4E09\u89D2\u5F62"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 13 \u9898", 18, ["\u5E94\u7528\u9898", "\u4E8C\u6B21\u51FD\u6570"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 14 \u9898", 16, ["\u4E8C\u6B21\u51FD\u6570", "\u56FE\u50CF\u4E0E\u6027\u8D28"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 15 \u9898", 16, ["\u4E8C\u6B21\u51FD\u6570", "\u5224\u522B\u5F0F"])
        ]],
        ["\u5341\u6708\u6708\u8003", "2026-10-14", 120, [
          ...[1, 2, 3, 4, 5, 6].map((i) => q("\u9009\u62E9\u9898", `\u7B2C ${i} \u9898`, 4, [["\u4E8C\u6B21\u51FD\u6570"], ["\u56FE\u50CF\u4E0E\u6027\u8D28"], ["\u8BA1\u7B97"], ["\u5168\u7B49\u4E09\u89D2\u5F62"], ["\u5224\u522B\u5F0F"], ["\u4E8C\u6B21\u51FD\u6570"]][i - 1])),
          ...[7, 8, 9, 10].map((i) => q("\u586B\u7A7A\u9898", `\u7B2C ${i} \u9898`, 4, [["\u56FE\u50CF\u4E0E\u6027\u8D28"], ["\u4E8C\u6B21\u51FD\u6570"], ["\u914D\u65B9\u6CD5"], ["\u5168\u7B49\u4E09\u89D2\u5F62"]][i - 7])),
          q("\u89E3\u7B54\u9898", "\u7B2C 11 \u9898", 14, ["\u8BA1\u7B97"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 12 \u9898", 16, ["\u5168\u7B49\u4E09\u89D2\u5F62"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 13 \u9898", 18, ["\u5E94\u7528\u9898", "\u4E8C\u6B21\u51FD\u6570"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 14 \u9898", 16, ["\u56FE\u50CF\u4E0E\u6027\u8D28", "\u4E8C\u6B21\u51FD\u6570"]),
          q("\u89E3\u7B54\u9898", "\u7B2C 15 \u9898", 16, ["\u4E8C\u6B21\u51FD\u6570", "\u5E94\u7528\u9898"])
        ]]
      ];
      const exams = [];
      for (const [name, date, fullScore, questions2] of examDefs) {
        const e = await call3("POST", `${C}/exams`, { name, date, subject: "\u6570\u5B66", fullScore, questions: questions2 });
        if (e?.id) exams.push(e);
      }
      const difficulty = (exam, i) => {
        const qn = exam.questions[i];
        if (qn.group === "\u9009\u62E9\u9898") return 0.88;
        if (qn.group === "\u586B\u7A7A\u9898") return 0.78;
        return 0.74 - i / exam.questions.length * 0.32 + (qn.tagIds.includes(tag["\u5E94\u7528\u9898"]) ? -0.08 : 0);
      };
      const classDefs = [
        ["\u521D\u4E09\uFF082\uFF09\u73ED", "2026 \u79CB\u5B63\u5B66\u671F", 5, 6, ["\u6797\u5C0F\u96E8", "\u9648\u5B50\u58A8", "\u738B\u601D\u8FDC", "\u8D75\u4E00\u8BFA", "\u5468\u96E8\u6850", "\u5434\u6D69\u7136", "\u5B59\u53EF\u6B23", "\u674E\u5609\u8C6A", "\u90D1\u4E66\u7476", "\u9EC4\u4FCA\u7199", "\u5F90\u6893\u6DB5", "\u9A6C\u5929\u5B87", "\u6731\u6653\u5F64", "\u80E1\u660E\u8F69", "\u90ED\u6B23\u6021", "\u4F55\u5B87\u822A", "\u9AD8\u96C5\u742A", "\u7F57\u5B50\u8F69", "\u6881\u8BD7\u6DB5", "\u5B8B\u6587\u535A", "\u5510\u82E5\u66E6", "\u97E9\u9038\u98DE", "\u51AF\u4F73\u6021", "\u66F9\u777F\u54F2", "\u5F6D\u8BED\u5AE3", "\u8463\u5B50\u8C6A"]],
        ["\u521D\u4E09\uFF085\uFF09\u73ED", "2026 \u79CB\u5B63\u5B66\u671F", 4, 6, ["\u8BB8\u5B89\u7136", "\u9093\u601D\u742A", "\u8427\u666F\u884C", "\u7530\u96E8\u8431", "\u6F58\u5FD7\u8FDC", "\u848B\u68A6\u7476", "\u8C22\u5B87\u8F69", "\u4F59\u53EF\u99A8", "\u675C\u627F\u6CFD", "\u53F6\u6E05\u6B22", "\u7A0B\u6D69\u5B87", "\u82CF\u82B7\u82E5", "\u5415\u535A\u6587", "\u4E01\u4E00\u7136", "\u9B4F\u6668\u66E6", "\u6C88\u5BB6\u4E50", "\u4EFB\u601D\u5F64", "\u59DA\u5B50\u9ED8"]]
      ];
      const profiles = {
        \u6797\u5C0F\u96E8: ["\u753B\u753B\u3001\u5929\u6587\uFF0C\u8BFE\u95F4\u5E38\u5728\u672C\u5B50\u4E0A\u753B\u661F\u56FE", "\u5B89\u9759\u7EC6\u5FC3\uFF0C\u4F5C\u4E1A\u5DE5\u6574\u3002\u4E0D\u592A\u4E3B\u52A8\u63D0\u95EE\uFF0C\u4F46\u79C1\u4E0B\u95EE\u95EE\u9898\u65F6\u601D\u8DEF\u5F88\u6E05\u695A\u3002\u9002\u5408\u591A\u7ED9\u4E00\u70B9\u5C55\u793A\u7684\u673A\u4F1A\u3002"],
        \u9648\u5B50\u58A8: ["\u7BEE\u7403\u3001\u9B54\u65B9", "\u53CD\u5E94\u5FEB\uFF0C\u559C\u6B22\u62A2\u7B54\uFF0C\u8BA1\u7B97\u5076\u5C14\u7C97\u5FC3\u3002\u6700\u8FD1\u5728\u7EC3\u4E60\u5148\u68C0\u67E5\u518D\u4EA4\u5377\u3002"],
        \u8D75\u4E00\u8BFA: ["\u94A2\u7434\u3001\u79D1\u5E7B\u5C0F\u8BF4", "\u76EE\u6807\u660E\u786E\uFF0C\u51E0\u4F55\u8BC1\u660E\u5199\u5F97\u89C4\u8303\u3002\u5BF9\u81EA\u5DF1\u8981\u6C42\u9AD8\uFF0C\u8003\u5DEE\u4E86\u4F1A\u96BE\u8FC7\uFF0C\u9700\u8981\u53CA\u65F6\u9F13\u52B1\u3002"],
        \u5434\u6D69\u7136: ["\u8DB3\u7403\u3001\u4E50\u9AD8", "\u4E0A\u8BFE\u5BB9\u6613\u8D70\u795E\uFF0C\u4F46\u5BF9\u52A8\u624B\u7684\u5185\u5BB9\u5F88\u6295\u5165\u3002\u5750\u524D\u6392\u6548\u679C\u66F4\u597D\u3002"],
        \u90D1\u4E66\u7476: ["\u5199\u4F5C\u3001\u8FA9\u8BBA", "\u8868\u8FBE\u597D\uFF0C\u6570\u5B66\u4E0A\u559C\u6B22\u8FFD\u95EE\u201C\u4E3A\u4EC0\u4E48\u201D\uFF0C\u662F\u8BFE\u5802\u8BA8\u8BBA\u7684\u5E26\u52A8\u8005\u3002"],
        \u9A6C\u5929\u5B87: ["\u7F16\u7A0B\u3001\u56F4\u68CB", "\u538B\u8F74\u9898\u601D\u8DEF\u5F88\u597D\uFF0C\u57FA\u7840\u9898\u53CD\u800C\u5BB9\u6613\u5931\u5206\u3002"],
        \u8BB8\u5B89\u7136: ["\u7FBD\u6BDB\u7403\u3001\u6444\u5F71", "\u8BFE\u4EE3\u8868\uFF0C\u8D23\u4EFB\u5FC3\u5F3A\uFF0C\u5E38\u5E2E\u540C\u5B66\u8BB2\u9898\u3002"],
        \u8427\u666F\u884C: ["\u822A\u6A21", "\u57FA\u7840\u8584\u5F31\u4F46\u5F88\u52AA\u529B\uFF0C\u4E5D\u6708\u4EE5\u6765\u8FDB\u6B65\u660E\u663E\u3002"]
      };
      const classes = [];
      for (const [name, term, rows, cols, names] of classDefs) {
        const cls = await call3("POST", `${C}/classes`, { name, term });
        if (!cls?.id) continue;
        const students = [];
        for (const [i, sname] of names.entries()) {
          const no = String(i + 1).padStart(2, "0");
          const [interests, personality] = profiles[sname] || ["", ""];
          const month = 1 + Math.floor(rand() * 12), day2 = 1 + Math.floor(rand() * 27);
          const s = await call3("POST", `${C}/students`, { classId: cls.id, name: sname, studentNo: `${name.includes("2") ? "2" : "5"}${no}`, birthday: `2011-${String(month).padStart(2, "0")}-${String(day2).padStart(2, "0")}`, interests, personality });
          if (s?.id) students.push({ ...s, ability: Math.max(0.3, Math.min(0.97, 0.76 + gauss() * 0.2)), trend: gauss() * 0.05 });
        }
        const arc = { \u8427\u666F\u884C: [0.42, 0.06], \u8D75\u4E00\u8BFA: [0.93, 0], \u5434\u6D69\u7136: [0.6, -0.04], \u9A6C\u5929\u5B87: [0.86, 0.01], \u6797\u5C0F\u96E8: [0.8, 0.03] };
        for (const s of students) if (arc[s.name]) [s.ability, s.trend] = arc[s.name];
        const seats = students.slice(0, Math.min(students.length - 2, rows * cols)).map((s, i) => ({ studentId: s.id, row: Math.floor(i / cols), col: i % cols }));
        const fresh = await call3("GET", `${C}/classes/${cls.id}`);
        await call3("PUT", `${C}/classes/${cls.id}/seating`, { baseVersion: fresh.version, rows, cols, seats });
        classes.push({ cls, students });
      }
      const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      const crcTable = Array.from({ length: 256 }, (_, n) => {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        return c >>> 0;
      });
      const crc = (b) => {
        let c = 4294967295;
        for (const x of b) c = crcTable[(c ^ x) & 255] ^ c >>> 8;
        return (c ^ 4294967295) >>> 0;
      };
      const col = (i) => {
        let s = "";
        i += 1;
        while (i) {
          const m = (i - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          i = Math.floor((i - 1) / 26);
        }
        return s;
      };
      const sheet = (rows) => {
        const body = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => v == null || v === "" ? "" : typeof v === "number" ? `<c r="${col(c)}${r + 1}"><v>${v}</v></c>` : `<c r="${col(c)}${r + 1}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`).join("")}</row>`).join("");
        return zip2([
          ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
          ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
          ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="\u6210\u7EE9" sheetId="1" r:id="rId1"/></sheets></workbook>'],
          ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
          ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`]
        ]);
      };
      const imports = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]];
      for (const [ci, ei] of imports) {
        const { cls, students } = classes[ci] || {};
        const exam = exams[ei];
        if (!cls || !exam) continue;
        const header = ["\u5B66\u53F7", "\u59D3\u540D", ...exam.questions.map((x) => x.label.replace(/\s/g, "")), "\u603B\u5206", "\u7F3A\u8003"];
        const rows = [header];
        for (const s of students) {
          const absent = ei === 1 && s.name === "\u5434\u6D69\u7136" || ei === 0 && s.name === "\u4E01\u4E00\u7136";
          if (absent) {
            rows.push([s.studentNo, s.name, ...exam.questions.map(() => null), null, "\u7F3A\u8003"]);
            continue;
          }
          const level = s.ability + s.trend * ei + [0.02, -0.05, 0.06][ei] + (ci === 1 ? -0.04 : 0);
          const scores = exam.questions.map((qn, i) => {
            const p = Math.max(0, Math.min(1, level * (difficulty(exam, i) / 0.72) + gauss() * 0.16));
            const step = qn.fullScore <= 5 ? qn.fullScore : 1;
            return qn.fullScore <= 5 ? rand() < p ? qn.fullScore : 0 : Math.round(p * qn.fullScore / step) * step;
          });
          rows.push([s.studentNo, s.name, ...scores, scores.reduce((a, v) => a + v, 0), null]);
        }
        const fd2 = new FormData();
        fd2.append("file", new File([sheet(rows)], `${cls.name}${exam.name}\u6210\u7EE9.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
        const file = await call3("POST", "/api/workbench/files", fd2);
        if (!file?.id) continue;
        let imp = await call3("POST", `${C}/imports`, { examId: exam.id, classId: cls.id, fileId: file.id });
        if (!imp?.id) continue;
        const n = exam.questions.length;
        imp = await call3("PUT", `${C}/imports/${imp.id}`, { baseVersion: imp.version, mapping: { sheet: 0, headerRow: 1, firstRow: 2, numberCol: 1, nameCol: 2, totalCol: 3 + n, absentCol: 4 + n, questionCols: Object.fromEntries(exam.questions.map((x, i) => [x.id, 3 + i])) } });
        if (imp?.id) await call3("POST", `${C}/imports/${imp.id}/confirmation`, { baseVersion: imp.version });
      }
      const note = (kind, id, date, body) => call3("POST", `${C}/records`, { subject: { kind, id }, date, body });
      const [c2, c5] = classes;
      if (c2) {
        const by = Object.fromEntries(c2.students.map((s) => [s.name, s.id]));
        await note("class", c2.cls.id, "2026-09-08", "\u5F00\u5B66\u7B2C\u4E00\u8BFE\uFF1A\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B\u590D\u4E60\u3002\u5927\u90E8\u5206\u540C\u5B66\u914D\u65B9\u6CD5\u5DF2\u7ECF\u719F\u7EC3\uFF0C\u4F46\u201C\u4E8C\u6B21\u9879\u7CFB\u6570\u4E0D\u4E3A 1\u201D\u65F6\u8FD8\u662F\u4F1A\u6F0F\u9664\u3002\u4E0B\u8282\u8BFE\u5148\u7528 5 \u5206\u949F\u5C0F\u7EC3\u3002");
        await note("class", c2.cls.id, "2026-09-15", "\u5355\u5143\u6D4B\u9A8C\u8BB2\u8BC4\u3002\u5224\u522B\u5F0F\u90A3\u9053\u9898\uFF08\u7B2C 13 \u9898\uFF09\u5168\u73ED\u5F97\u5206\u7387\u4E0D\u5230\u4E00\u534A\uFF0C\u95EE\u9898\u96C6\u4E2D\u5728\u201C\u65B9\u7A0B\u6709\u5B9E\u6839\u201D\u65F6\u5FD8\u4E86\u8BA8\u8BBA\u4E8C\u6B21\u9879\u7CFB\u6570\u4E3A 0\u3002");
        await note("class", c2.cls.id, "2026-09-29", "\u4E5D\u6708\u6708\u8003\u540E\u8C03\u4E86\u5EA7\u4F4D\uFF1A\u8BA9\u5434\u6D69\u7136\u3001\u8427\u540C\u5B66\u5750\u5230\u524D\u4E24\u6392\uFF0C\u90D1\u4E66\u7476\u548C\u9648\u5B50\u58A8\u540C\u684C\uFF0C\u8BA8\u8BBA\u65F6\u4E92\u8865\u3002");
        await note("class", c2.cls.id, "2026-10-09", "\u4E8C\u6B21\u51FD\u6570\u56FE\u50CF\uFF1A\u7528\u6570\u5B66\u5DE5\u574A\u7684\u52A8\u753B\u6F14\u793A\u5E73\u79FB\uFF0C\u6548\u679C\u5F88\u597D\uFF0C\u5F88\u591A\u540C\u5B66\u7B2C\u4E00\u6B21\u771F\u6B63\u201C\u770B\u89C1\u201D\u4E86\u9876\u70B9\u5F0F\u7684\u610F\u4E49\u3002");
        await note("class", c2.cls.id, "2026-10-16", "\u5341\u6708\u6708\u8003\u8BB2\u8BC4\u3002\u5E94\u7528\u9898\uFF08\u7B2C 13\u300115 \u9898\uFF09\u4ECD\u662F\u5931\u5206\u6700\u591A\u7684\u5730\u65B9\uFF0C\u5BA1\u9898\u548C\u8BBE\u672A\u77E5\u6570\u9700\u8981\u4E13\u95E8\u7EC3\u3002\u4E0B\u5468\u5B89\u6392\u4E24\u8282\u5E94\u7528\u9898\u4E13\u9898\u8BFE\u3002");
        if (by["\u6797\u5C0F\u96E8"]) {
          await note("student", by["\u6797\u5C0F\u96E8"], "2026-09-17", "\u4E3B\u52A8\u6765\u95EE\u5224\u522B\u5F0F\u7684\u9898\uFF0C\u81EA\u5DF1\u53D1\u73B0\u4E86\u6F0F\u8BA8\u8BBA a=0 \u7684\u60C5\u51B5\u3002\u53EF\u4EE5\u8BF7\u5979\u5728\u8BFE\u4E0A\u5206\u4EAB\u8FD9\u4E2A\u201C\u5751\u201D\u3002");
          await note("student", by["\u6797\u5C0F\u96E8"], "2026-10-15", "\u5341\u6708\u6708\u8003\u8FDB\u6B65\u660E\u663E\u3002\u548C\u5979\u804A\u4E86\u804A\uFF0C\u8BF4\u6700\u8FD1\u5728\u7528\u9519\u9898\u672C\uFF0C\u6BCF\u5468\u81EA\u5DF1\u590D\u76D8\u4E00\u6B21\u3002");
        }
        if (by["\u5434\u6D69\u7136"]) {
          await note("student", by["\u5434\u6D69\u7136"], "2026-09-26", "\u4E5D\u6708\u6708\u8003\u8BF7\u4E86\u75C5\u5047\uFF0C\u7F3A\u8003\u3002\u5DF2\u7ECF\u628A\u8BD5\u5377\u53D1\u7ED9\u4ED6\uFF0C\u5468\u4E00\u4EA4\u3002");
          await note("student", by["\u5434\u6D69\u7136"], "2026-10-12", "\u6700\u8FD1\u4E0A\u8BFE\u6CE8\u610F\u529B\u4E0D\u592A\u96C6\u4E2D\uFF0C\u4F5C\u4E1A\u5B8C\u6210\u7387\u4E0B\u964D\u3002\u4E0B\u5468\u627E\u65F6\u95F4\u548C\u5BB6\u957F\u6C9F\u901A\u4E00\u4E0B\u3002");
        }
        if (by["\u8D75\u4E00\u8BFA"]) await note("student", by["\u8D75\u4E00\u8BFA"], "2026-10-15", "\u5341\u6708\u6708\u8003\u7B2C\u4E00\u3002\u51E0\u4F55\u8BC1\u660E\u6B65\u9AA4\u5B8C\u6574\uFF0C\u53EF\u4EE5\u4F5C\u4E3A\u8303\u4F8B\u5C55\u793A\uFF08\u5DF2\u5F81\u5F97\u540C\u610F\uFF09\u3002");
      }
      if (c5) {
        const by = Object.fromEntries(c5.students.map((s) => [s.name, s.id]));
        await note("class", c5.cls.id, "2026-09-10", "5 \u73ED\u6574\u4F53\u57FA\u7840\u6BD4 2 \u73ED\u5F31\u4E00\u4E9B\uFF0C\u8BA1\u7B97\u9898\u6B63\u786E\u7387\u504F\u4F4E\u3002\u6BCF\u8282\u8BFE\u524D\u52A0 3 \u9053\u53E3\u7B97\u3002");
        await note("class", c5.cls.id, "2026-10-10", "\u8BFE\u5802\u6C14\u6C1B\u6D3B\u8DC3\u4E86\u5F88\u591A\u3002\u8BB8\u5B89\u7136\u7EC4\u7EC7\u7684\u201C\u5C0F\u8001\u5E08\u201D\u8BB2\u9898\u6548\u679C\u4E0D\u9519\uFF0C\u4E0B\u5468\u7EE7\u7EED\u3002");
        if (by["\u8427\u666F\u884C"]) await note("student", by["\u8427\u666F\u884C"], "2026-10-02", "\u4E5D\u6708\u6708\u8003\u6BD4\u5355\u5143\u6D4B\u9A8C\u63D0\u9AD8\u4E86\u4E0D\u5C11\uFF0C\u8BFE\u540E\u7559\u4E0B\u6765\u95EE\u4E86\u4E24\u9053\u5E94\u7528\u9898\u3002\u591A\u80AF\u5B9A\u4ED6\u3002");
      }
      if (c2) {
        const r = await note("class", c2.cls.id, "2026-09-05", "\uFF08\u8349\u7A3F\uFF09\u5F00\u5B66\u524D\u5907\u8BFE\uFF1A\u5148\u590D\u4E60\u8FD8\u662F\u76F4\u63A5\u65B0\u8BFE\uFF1F");
        if (r?.id) await call3("PUT", `${C}/records/${r.id}/deletion`, { baseVersion: r.version, deleted: true });
      }
    }
    return log.length ? log.join("\n") : "ok";
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/agent/Prose.jsx
  function splitBlocks(text) {
    const lines = text.split("\n");
    const out = [];
    let buf = [];
    const flush = () => {
      if (buf.length) {
        out.push({ type: "md", text: buf.join("\n") });
        buf = [];
      }
    };
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\s*\|.*\|\s*$/.test(lines[i])) {
        flush();
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          rows.push(lines[i]);
          i += 1;
        }
        i -= 1;
        const cells = (row) => row.trim().slice(1, -1).split("|").map((c) => c.trim());
        const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(cells);
        out.push({ type: "table", head: body[0] ?? [], rows: body.slice(1) });
      } else buf.push(lines[i]);
    }
    flush();
    return out;
  }
  function Inline({ text }) {
    const { Markdown, remarkMath, rehypeKatex, agentMarkdown } = tb();
    return /* @__PURE__ */ h(Markdown, { remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }]], skipHtml: true, components: { p: ({ children }) => /* @__PURE__ */ h(Fragment, null, children) } }, agentMarkdown(text));
  }
  function Prose({ text, className = "tbx-prose" }) {
    const { Markdown, remarkMath, rehypeKatex, agentMarkdown } = tb();
    const blocks = splitBlocks(text || "");
    return /* @__PURE__ */ h("div", { className }, blocks.map((b, i) => b.type === "table" ? /* @__PURE__ */ h("div", { className: "tbx-table", key: i }, /* @__PURE__ */ h("table", null, /* @__PURE__ */ h("thead", null, /* @__PURE__ */ h("tr", null, b.head.map((c, j) => /* @__PURE__ */ h("th", { key: j }, /* @__PURE__ */ h(Inline, { text: c }))))), /* @__PURE__ */ h("tbody", null, b.rows.map((r, k) => /* @__PURE__ */ h("tr", { key: k }, r.map((c, j) => /* @__PURE__ */ h("td", { key: j }, /* @__PURE__ */ h(Inline, { text: c })))))))) : /* @__PURE__ */ h(Markdown, { key: i, remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }]], skipHtml: true }, agentMarkdown(b.text))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/agent/script.js
  var sleep = (run, ms) => new Promise((resolve) => {
    run.timer = setTimeout(resolve, ms);
  });
  async function api(path2) {
    const res = await fetch(path2);
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }
  function docText(doc) {
    const out = [];
    for (const block of doc?.blocks ?? []) {
      if (block.runs) out.push(block.runs.map((run) => run.type === "math" ? `$${run.latex}$` : run.text ?? "").join(""));
      else if (block.latex) out.push(`$$${block.latex}$$`);
    }
    return out.join("\n");
  }
  async function questionTags() {
    try {
      const tax = await api("/api/modules/questions/v2/taxonomy");
      return new Map([...tax.tags ?? [], ...tax.types ?? []].map((t2) => [t2.id, t2.name]));
    } catch {
      return /* @__PURE__ */ new Map();
    }
  }
  function slim(q, names) {
    return {
      id: q.id,
      title: q.title || "\u672A\u547D\u540D\u9898\u76EE",
      excerpt: docText(q.body).split("\n")[0] ?? "",
      tags: [q.typeId, ...q.tagIds ?? []].map((id) => names.get(id)).filter(Boolean).slice(0, 3)
    };
  }
  async function searchQuestions(words) {
    const names = await questionTags();
    const seen = /* @__PURE__ */ new Map();
    for (const word of words) {
      try {
        const { items } = await api(`/api/modules/questions/v2/items?q=${encodeURIComponent(word)}&searchAnswers=true`);
        for (const q of items) if (!seen.has(q.id)) seen.set(q.id, slim(q, names));
      } catch {
      }
    }
    return [...seen.values()];
  }
  async function readQuestion(id) {
    const names = await questionTags();
    const q = await api(`/api/modules/questions/v2/items/${encodeURIComponent(id)}`);
    return { ...slim(q, names), body: docText(q.body), solution: docText(q.solution), tagIds: q.tagIds ?? [], typeId: q.typeId };
  }
  var dayKey = (offset = 0) => {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  async function readSchedule() {
    try {
      const [{ items }, labels] = await Promise.all([api("/api/modules/schedule/entries"), api("/api/modules/schedule/labels").catch(() => ({ items: [] }))]);
      const names = new Map((labels.items ?? labels ?? []).map((l) => [l.id, l.name]));
      return items.map((e) => ({
        id: e.id,
        title: e.title || "\u672A\u547D\u540D\u4E8B\u9879",
        date: e.time?.date ?? null,
        start: e.time?.startTime ?? null,
        minutes: e.time?.durationMinutes ?? null,
        label: (e.calendar?.tags ?? []).map((id) => names.get(id)).filter(Boolean)[0] ?? null,
        todo: (e.items ?? []).map((i) => i.text).filter(Boolean)
      }));
    } catch {
      return [];
    }
  }
  var isLesson = (e) => /数学|课/.test(e.title) && e.date;
  function nextLesson(entries) {
    const now = `${dayKey(0)} ${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 5)}`;
    return entries.filter(isLesson).filter((e) => `${e.date} ${e.start}` >= now).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0] ?? null;
  }
  function whenLabel(e) {
    if (!e?.date) return tx("\u5F85\u5B89\u6392");
    const offset = Math.round((/* @__PURE__ */ new Date(`${e.date}T00:00`) - /* @__PURE__ */ new Date(`${dayKey(0)}T00:00`)) / 864e5);
    const day = offset === 0 ? tx("\u4ECA\u5929") : offset === 1 ? tx("\u660E\u5929") : offset === 2 ? tx("\u540E\u5929") : monthDay(e.date);
    return e.start ? `${day} ${e.start}` : day;
  }
  var TOPICS = [
    { key: "func", test: /二次函数|抛物线|顶点|对称轴|开口|quadratic|parabola|vertex/i, name: "\u4E8C\u6B21\u51FD\u6570\u56FE\u50CF\u4E0E\u6027\u8D28", words: ["\u4E8C\u6B21\u51FD\u6570", "\u629B\u7269\u7EBF"], tag: "g-func" },
    { key: "geo", test: /全等|三角形|SAS|ASA|SSS|congruen|triangle/i, name: "\u5168\u7B49\u4E09\u89D2\u5F62\u7684\u5224\u5B9A", words: ["\u5168\u7B49", "\u4E09\u89D2\u5F62"], tag: "g-geo" },
    { key: "frac", test: /分数|fraction/i, name: "\u5206\u6570\u52A0\u51CF\u6CD5", words: ["\u5206\u6570"], tag: null },
    { key: "rational", test: /分式|增根|rational/i, name: "\u5206\u5F0F\u65B9\u7A0B", words: ["\u5206\u5F0F"], tag: "g-frac" },
    { key: "eq", test: /判别式|一元二次方程|根的个数|discriminant/i, name: "\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B\u7684\u5224\u522B\u5F0F", words: ["\u5224\u522B\u5F0F", "\u65B9\u7A0B"], tag: "g-eq" }
  ];
  var topicOf = (text) => TOPICS.find((t2) => t2.test.test(text)) ?? null;
  var LESSON = {
    func: {
      intro: "\u8FD9\u8282\u8BFE\u7684\u6838\u5FC3\uFF0C\u662F\u8BA9\u5B66\u751F\u81EA\u5DF1\u770B\u51FA $y=a(x-h)^2+k$ \u91CC\u6BCF\u4E2A\u5B57\u6BCD\u5728\u56FE\u50CF\u4E0A\u201C\u7BA1\u201D\u4EC0\u4E48\u3002\u987A\u5E8F\u4E0A\u5148\u770B\u56FE\u3001\u518D\u5F52\u7EB3\u3001\u6700\u540E\u7528\u5F0F\u5B50\u8BF4\u8BDD\u3002",
      steps: [
        ["\u60C5\u5883\u5F15\u5165", 5, "\u6295\u51FA\u4E24\u6761\u5F00\u53E3\u65B9\u5411\u4E0D\u540C\u7684\u629B\u7269\u7EBF\uFF0C\u8BF7\u5B66\u751F\u8BF4\u51FA\u5B83\u4EEC\u201C\u54EA\u91CC\u4E0D\u4E00\u6837\u201D\u3002\u5148\u4E0D\u7ED9\u672F\u8BED\uFF0C\u53EA\u6536\u96C6\u8BF4\u6CD5\u3002"],
        ["\u63A2\u7A76 $a$ \u7684\u4F5C\u7528", 10, "\u56FA\u5B9A $h=0,\\ k=0$\uFF0C\u8BA9 $a$ \u4ECE $2$ \u53D8\u5230 $-2$\u3002\u5B66\u751F\u4F1A\u53D1\u73B0\uFF1A$a>0$ \u5F00\u53E3\u5411\u4E0A\uFF0C$|a|$ \u8D8A\u5927\u5F00\u53E3\u8D8A\u7A84\u3002"],
        ["\u63A2\u7A76 $h$ \u4E0E $k$", 12, "\u5206\u522B\u62D6\u52A8 $h$\u3001$k$\uFF0C\u8BB0\u5F55\u9876\u70B9\u7684\u53D8\u5316\uFF0C\u5F52\u7EB3\u51FA\u9876\u70B9 $(h,k)$ \u4E0E\u5BF9\u79F0\u8F74 $x=h$\u3002"],
        ["\u914D\u65B9\u4E0E\u9876\u70B9\u5F0F", 10, "\u4EE5 $y=x^2-4x+3$ \u4E3A\u4F8B\u914D\u65B9\u5F97 $y=(x-2)^2-1$\uFF0C\u628A\u201C\u4E00\u822C\u5F0F\u201D\u548C\u201C\u9876\u70B9\u5F0F\u201D\u8FDE\u8D77\u6765\u3002"],
        ["\u5F53\u5802\u7EC3\u4E60\u4E0E\u5C0F\u7ED3", 8, "\u4E09\u9053\u9898\u7531\u6D45\u5165\u6DF1\uFF0C\u6700\u540E\u8BF7\u5B66\u751F\u7528\u4E00\u53E5\u8BDD\u8BF4\u51FA $a$\u3001$h$\u3001$k$ \u5404\u81EA\u7684\u4F5C\u7528\u3002"]
      ],
      tip: "**\u8BFE\u5802\u63D0\u793A** \u5B66\u751F\u6700\u5BB9\u6613\u628A $y=(x-2)^2$ \u7684\u5E73\u79FB\u65B9\u5411\u8BB0\u53CD\u3002\u8BA9\u4ED6\u4EEC\u4EE3\u5165 $x=2$ \u7B97\u4E00\u6B21\uFF0C\u6BD4\u8BB2\u4E09\u904D\u201C\u5DE6\u52A0\u53F3\u51CF\u201D\u7BA1\u7528\u3002"
    },
    geo: {
      intro: "\u5224\u5B9A\u5B9A\u7406\u672C\u8EAB\u4E0D\u96BE\uFF0C\u96BE\u7684\u662F\u5B66\u751F\u4E0D\u77E5\u9053\u8BE5\u627E\u54EA\u7EC4\u6761\u4EF6\u3002\u987A\u5E8F\u4E0A\u5148\u52A8\u624B\u3001\u518D\u5F52\u7EB3\u3001\u6700\u540E\u7EC3\u201C\u627E\u6761\u4EF6\u201D\u3002",
      steps: [
        ["\u52A8\u624B\u53E0\u4E00\u53E0", 6, "\u6BCF\u4EBA\u526A\u4E24\u4E2A\u4E09\u89D2\u5F62\uFF0C\u53EA\u544A\u8BC9\u5BF9\u65B9\u4E24\u8FB9\u4E00\u89D2\uFF0C\u770B\u80FD\u4E0D\u80FD\u526A\u5F97\u4E00\u6837\u3002"],
        ["\u5F52\u7EB3 SAS", 10, "\u5F3A\u8C03\u201C\u5939\u89D2\u201D\u3002\u7528\u53CD\u4F8B\u8BF4\u660E SSA \u4E0D\u6210\u7ACB\u3002"],
        ["ASA \u4E0E AAS", 10, "\u4ECE SAS \u7C7B\u6BD4\u51FA\u6765\uFF0C\u8BA9\u5B66\u751F\u81EA\u5DF1\u5199\u51FA\u6761\u4EF6\u3002"],
        ["\u627E\u6761\u4EF6\u7EC3\u4E60", 12, "\u7ED9\u56FE\uFF0C\u53EA\u95EE\u201C\u8FD8\u5DEE\u54EA\u4E2A\u6761\u4EF6\u201D\uFF0C\u4E0D\u6025\u7740\u5199\u8BC1\u660E\u3002"],
        ["\u89C4\u8303\u4E66\u5199", 7, "\u793A\u8303\u4E00\u6B21\u5B8C\u6574\u8BC1\u660E\u7684\u683C\u5F0F\uFF0C\u6807\u51FA\u6BCF\u4E00\u6B65\u7684\u4F9D\u636E\u3002"]
      ],
      tip: "**\u8BFE\u5802\u63D0\u793A** \u8BA9\u5B66\u751F\u5728\u56FE\u4E0A\u7528\u540C\u4E00\u79CD\u989C\u8272\u6807\u51FA\u5BF9\u5E94\u7684\u8FB9\u548C\u89D2\uFF0C\u201C\u627E\u6761\u4EF6\u201D\u4F1A\u5FEB\u5F88\u591A\u3002"
    }
  };
  function lessonAnswer(topic, lesson, found) {
    const plan = LESSON[topic?.key] ?? LESSON.func;
    const name = topic?.name ?? "\u8FD9\u8282\u8BFE";
    const total = plan.steps.reduce((sum2, [, m]) => sum2 + m, 0);
    const lines = [
      lesson ? `\u4E0B\u4E00\u8282\u662F **${lesson.title}**\uFF08${whenLabel(lesson)}\uFF09\u3002${plan.intro}` : plan.intro,
      "",
      `## ${name} \xB7 ${total} \u5206\u949F`,
      "",
      ...plan.steps.map(([title, minutes, text], i) => `${i + 1}. **${title}** \xB7 ${minutes} \u5206\u949F  
${text}`),
      ""
    ];
    if (found.length) {
      lines.push("## \u9898\u5E93\u91CC\u80FD\u76F4\u63A5\u7528\u7684\u9898", "");
      for (const q of found.slice(0, 3)) lines.push(`- **${q.title}** \u2014 ${q.excerpt}`);
      lines.push("");
    }
    lines.push(`> ${plan.tip}`);
    return { text: lines.join("\n"), steps: plan.steps, total, name };
  }
  var METHODS = {
    geo: [
      "\u8FD9\u9053\u9898\u81F3\u5C11\u6709\u4E09\u79CD\u8BB2\u6CD5\uFF0C\u9002\u5408\u4E0D\u540C\u7684\u5B66\u751F\u3002",
      "",
      "## \u4E09\u79CD\u8BB2\u6CD5",
      "",
      "### 1. \u987A\u7740\u6761\u4EF6\u8D70\uFF08\u7EFC\u5408\u6CD5\uFF09",
      "\u4ECE\u5DF2\u77E5\u51FA\u53D1\uFF1A$AB=AD$\uFF0C$\\angle BAC=\\angle DAC$\uFF0C\u518D\u627E\u516C\u5171\u8FB9 $AC=AC$\uFF0C\u76F4\u63A5\u7528 SAS\u3002\u6700\u5FEB\uFF0C\u9002\u5408\u57FA\u7840\u597D\u7684\u5B66\u751F\u3002",
      "",
      "### 2. \u5012\u7740\u627E\u6761\u4EF6\uFF08\u5206\u6790\u6CD5\uFF09",
      "\u5148\u95EE\u201C\u8981\u8BC1\u5168\u7B49\uFF0C\u8FD8\u7F3A\u4EC0\u4E48\uFF1F\u201D\uFF0C\u4ECE\u7ED3\u8BBA\u5F80\u56DE\u63A8\u3002\u6162\u4E00\u70B9\uFF0C\u4F46\u80FD\u6559\u4F1A\u5B66\u751F**\u600E\u4E48\u60F3\u5230**\u516C\u5171\u8FB9\u3002",
      "",
      "### 3. \u5148\u52A8\u624B\u518D\u8BC1\u660E",
      "\u8BA9\u5B66\u751F\u628A\u56FE\u6CBF $AC$ \u5BF9\u6298\uFF0C\u770B\u4E24\u4E2A\u4E09\u89D2\u5F62\u662F\u5426\u91CD\u5408\uFF0C\u518D\u628A\u201C\u91CD\u5408\u201D\u7FFB\u8BD1\u6210\u8BC1\u660E\u3002\u9002\u5408\u51E0\u4F55\u76F4\u89C9\u5F31\u7684\u5B66\u751F\u3002",
      "",
      "| \u8BB2\u6CD5 | \u9002\u5408 | \u7528\u65F6 | \u7559\u610F |",
      "| --- | --- | --- | --- |",
      "| \u7EFC\u5408\u6CD5 | \u57FA\u7840\u597D\u7684\u5B66\u751F | 5 \u5206\u949F | \u5BB9\u6613\u8DF3\u6B65 |",
      "| \u5206\u6790\u6CD5 | \u5927\u591A\u6570\u5B66\u751F | 10 \u5206\u949F | \u677F\u4E66\u8981\u6E05\u695A |",
      "| \u5148\u52A8\u624B | \u76F4\u89C9\u5F31\u7684\u5B66\u751F | 12 \u5206\u949F | \u51C6\u5907\u597D\u7EB8 |",
      "",
      "> **\u8BFE\u5802\u63D0\u793A** \u4E0D\u7BA1\u7528\u54EA\u79CD\u8BB2\u6CD5\uFF0C\u6700\u540E\u90FD\u8BF7\u5B66\u751F\u8BF4\u51FA\uFF1A\u516C\u5171\u8FB9\u662F**\u600E\u4E48\u88AB\u627E\u5230\u7684**\u3002"
    ]
  };
  var FUNC_TIERS = [
    ["\u57FA\u7840 \xB7 \u8BFB\u56FE\u50CF", [["\u629B\u7269\u7EBF $y=2(x-1)^2+3$ \u7684\u9876\u70B9\u5750\u6807\u662F\u4EC0\u4E48\uFF1F", "$(1,3)$"], ["$y=-x^2+4$ \u7684\u5F00\u53E3\u65B9\u5411\u548C\u5BF9\u79F0\u8F74\u662F\u4EC0\u4E48\uFF1F", "\u5F00\u53E3\u5411\u4E0B\uFF0C\u5BF9\u79F0\u8F74 $x=0$"], ["\u628A $y=x^2$ \u5411\u5DE6\u5E73\u79FB $2$ \u4E2A\u5355\u4F4D\uFF0C\u5F97\u5230\u4EC0\u4E48\uFF1F", "$y=(x+2)^2$"]]],
    ["\u63D0\u9AD8 \xB7 \u914D\u65B9", [["\u628A $y=x^2-6x+5$ \u5316\u6210\u9876\u70B9\u5F0F\u3002", "$y=(x-3)^2-4$"], ["\u6C42 $y=2x^2+8x+1$ \u7684\u6700\u5C0F\u503C\u3002", "\u5F53 $x=-2$ \u65F6\u6700\u5C0F\uFF0C\u4E3A $-7$"], ["$y=x^2+bx+3$ \u7684\u5BF9\u79F0\u8F74\u662F $x=2$\uFF0C\u6C42 $b$\u3002", "$b=-4$"]]],
    ["\u6311\u6218 \xB7 \u5E94\u7528", [["\u7528 $20$ \u7C73\u7BF1\u7B06\u56F4\u4E00\u4E2A\u77E9\u5F62\u83DC\u5730\uFF0C\u4E00\u8FB9\u9760\u5899\uFF0C\u9762\u79EF\u6700\u5927\u662F\u591A\u5C11\uFF1F", "$50$ \u5E73\u65B9\u7C73"], ["\u67D0\u5546\u54C1\u6BCF\u6DA8\u4EF7 $1$ \u5143\uFF0C\u9500\u91CF\u5C11 $10$ \u4EF6\uFF0C\u5982\u4F55\u5B9A\u4EF7\u5229\u6DA6\u6700\u5927\uFF1F", "\u5217\u51FA $W=(x-a)(b-10x)$ \u540E\u914D\u65B9"], ["\u629B\u7269\u7EBF $y=x^2-2mx+m^2-1$ \u4E0E $x$ \u8F74\u7684\u4E24\u4E2A\u4EA4\u70B9\u8DDD\u79BB\u662F\u591A\u5C11\uFF1F", "$2$\uFF0C\u4E0E $m$ \u65E0\u5173"]]]
  ];
  function practiceAnswer(topic) {
    if (topic?.key === "func") {
      const lines2 = ["\u6309\u201C\u8BFB\u56FE\u50CF \u2192 \u914D\u65B9 \u2192 \u5E94\u7528\u201D\u4E09\u5C42\u6392\uFF0C\u6BCF\u5C42 3 \u9053\uFF0C\u6700\u540E\u4E00\u5C42\u53EF\u4EE5\u7559\u4F5C\u9009\u505A\u3002", ""];
      FUNC_TIERS.forEach(([title, items3]) => {
        lines2.push(`### ${title}`, "");
        items3.forEach(([q], i) => lines2.push(`${i + 1}. ${q}`));
        lines2.push("");
      });
      lines2.push("> **\u8BFE\u5802\u63D0\u793A** \u914D\u65B9\u662F\u8FD9\u8282\u8BFE\u7684\u95E8\u69DB\u3002\u7B2C\u4E8C\u5C42\u505A\u4E0D\u51FA\u6765\u7684\u5B66\u751F\uFF0C\u5148\u56DE\u5230 $y=(x-h)^2+k$ \u7684\u5C55\u5F00\uFF0C\u5012\u7740\u770B\u4E00\u904D\u3002");
      const items2 = FUNC_TIERS.flatMap(([tier, list]) => list.map(([body, solution], i) => ({ tier, title: `\u4E8C\u6B21\u51FD\u6570 \xB7 ${tier.split(" \xB7 ")[0]} ${i + 1}`, body, solution })));
      return { text: lines2.join("\n"), items: items2 };
    }
    const tiers = [
      ["\u57FA\u7840 \xB7 \u540C\u5206\u6BCD", [["$\\dfrac{2}{7}+\\dfrac{3}{7}$", "$\\dfrac{5}{7}$"], ["$\\dfrac{5}{9}-\\dfrac{2}{9}$", "$\\dfrac{1}{3}$"], ["$1-\\dfrac{3}{8}$", "$\\dfrac{5}{8}$"]]],
      ["\u63D0\u9AD8 \xB7 \u5F02\u5206\u6BCD", [["$\\dfrac{1}{3}+\\dfrac{1}{4}$", "$\\dfrac{7}{12}$"], ["$\\dfrac{5}{6}-\\dfrac{3}{8}$", "$\\dfrac{11}{24}$"], ["$\\dfrac{2}{5}+\\dfrac{1}{3}-\\dfrac{1}{6}$", "$\\dfrac{17}{30}$"]]],
      ["\u6311\u6218 \xB7 \u751F\u6D3B\u60C5\u5883", [["\u4E00\u6876\u6CB9\u7528\u53BB $\\dfrac{2}{5}$\uFF0C\u53C8\u7528\u53BB $\\dfrac{1}{4}$\uFF0C\u8FD8\u5269\u51E0\u5206\u4E4B\u51E0\uFF1F", "$\\dfrac{7}{20}$"], ["\u5C0F\u660E\u8BFB\u4E86\u5168\u4E66\u7684 $\\dfrac{3}{8}$\uFF0C\u5C0F\u7EA2\u6BD4\u4ED6\u591A\u8BFB $\\dfrac{1}{6}$\uFF0C\u5C0F\u7EA2\u8BFB\u4E86\u51E0\u5206\u4E4B\u51E0\uFF1F", "$\\dfrac{13}{24}$"], ["$\\dfrac{1}{2}+\\dfrac{1}{6}+\\dfrac{1}{12}+\\dfrac{1}{20}$ \u6709\u6CA1\u6709\u7B80\u4FBF\u7B97\u6CD5\uFF1F", "$\\dfrac{4}{5}$\uFF0C\u88C2\u9879\u76F8\u6D88"]]]
    ];
    const lines = ["\u6309\u201C\u540C\u5206\u6BCD \u2192 \u5F02\u5206\u6BCD \u2192 \u60C5\u5883\u201D\u4E09\u5C42\u6392\uFF0C\u6BCF\u5C42 3 \u9053\uFF0C\u96BE\u5EA6\u4E00\u6B65\u4E00\u6B65\u5F80\u4E0A\u8D70\u3002", ""];
    tiers.forEach(([title, items2]) => {
      lines.push(`### ${title}`, "");
      items2.forEach(([q], i) => lines.push(`${i + 1}. ${q}`));
      lines.push("");
    });
    lines.push("> **\u8BFE\u5802\u63D0\u793A** \u7B2C\u4E8C\u5C42\u662F\u5206\u6C34\u5CAD\u3002\u5361\u4F4F\u7684\u5B66\u751F\uFF0C\u5148\u8BA9\u4ED6\u4EEC\u53EA\u5199\u51FA\u516C\u5206\u6BCD\uFF0C\u4E0D\u6025\u7740\u7B97\u3002");
    const items = tiers.flatMap(([tier, list]) => list.map(([body, solution], i) => ({ tier, title: `\u5206\u6570\u52A0\u51CF\u6CD5 \xB7 ${tier.split(" \xB7 ")[0]} ${i + 1}`, body, solution })));
    return { text: lines.join("\n"), items };
  }
  function demoAnswer() {
    return [
      "\u7528\u4E00\u4E2A\u53EF\u4EE5\u62D6\u52A8\u7684\u53C2\u6570 $a$\uFF0C\u8BA9\u5B66\u751F\u4EB2\u773C\u770B\u5230\u5F00\u53E3\u65B9\u5411\u548C\u5F00\u53E3\u5927\u5C0F\u662F\u600E\u4E48\u53D8\u7684\u3002",
      "",
      "## \u6F14\u793A\u8BBE\u8BA1",
      "",
      "1. **\u753B\u51FA $y=ax^2$**\uFF0C\u7ED9 $a$ \u4E00\u4E2A\u6ED1\u5757\uFF0C\u8303\u56F4 $-3$ \u5230 $3$\uFF0C\u6B65\u957F $0.1$\u3002",
      "2. **\u4FDD\u7559\u8F68\u8FF9**\uFF1A\u6BCF\u505C\u4E00\u6B21\uFF0C\u7559\u4E0B\u4E00\u6761\u6DE1\u8272\u7684\u65E7\u56FE\u50CF\uFF0C\u65B9\u4FBF\u5BF9\u6BD4\u3002",
      "3. **\u5728 $a=0$ \u505C\u4E00\u4E0B**\uFF1A\u56FE\u50CF\u53D8\u6210\u76F4\u7EBF $y=0$\uFF0C\u95EE\u5B66\u751F\u201C\u8FD9\u65F6\u8FD8\u662F\u4E8C\u6B21\u51FD\u6570\u5417\uFF1F\u201D",
      "4. **\u52A0\u4E00\u4E2A\u70B9 $P(1,a)$**\uFF1A\u8BA9\u5B66\u751F\u53D1\u73B0 $a$ \u5C31\u662F $x=1$ \u65F6\u7684\u51FD\u6570\u503C\u3002",
      "",
      "## \u5B66\u751F\u5E94\u8BE5\u770B\u51FA\u7684\u4E09\u4EF6\u4E8B",
      "",
      "- $a>0$ \u5F00\u53E3\u5411\u4E0A\uFF0C$a<0$ \u5F00\u53E3\u5411\u4E0B\uFF1B",
      "- $|a|$ \u8D8A\u5927\uFF0C\u5F00\u53E3\u8D8A\u7A84\uFF1B",
      "- \u4E0D\u8BBA $a$ \u600E\u4E48\u53D8\uFF0C\u9876\u70B9\u90FD\u5728\u539F\u70B9\u3002",
      "",
      "> **\u8BFE\u5802\u63D0\u793A** \u5148\u8BA9\u5B66\u751F\u9884\u6D4B\uFF0C\u518D\u62D6\u6ED1\u5757\u9A8C\u8BC1\u3002\u201C\u731C\u9519\u4E86\u201D\u7684\u90A3\u4E00\u523B\uFF0C\u8BB0\u5F97\u6700\u7262\u3002"
    ].join("\n");
  }
  function questionAnswer(q) {
    const hard = /最值|利润|压轴/.test(q.title + q.tags.join(""));
    return [
      `\u8FD9\u9053 **${q.title}** ${hard ? "\u662F\u4E00\u9053\u628A\u51FD\u6570\u548C\u5B9E\u9645\u95EE\u9898\u8FDE\u8D77\u6765\u7684\u9898" : "\u8003\u7684\u662F\u57FA\u672C\u65B9\u6CD5\u7684\u719F\u7EC3\u7A0B\u5EA6"}\u3002`,
      "",
      "## \u8BB2\u7684\u65F6\u5019\u5206\u4E09\u6B65",
      "",
      "1. **\u5148\u8BFB\u61C2\u9898**\uFF1A\u8BA9\u5B66\u751F\u7528\u81EA\u5DF1\u7684\u8BDD\u590D\u8FF0\u5DF2\u77E5\u548C\u6240\u6C42\uFF0C\u5708\u51FA\u5173\u952E\u91CF\u3002",
      `2. **\u518D\u627E\u65B9\u6CD5**\uFF1A${hard ? "\u628A\u6587\u5B57\u5173\u7CFB\u7FFB\u8BD1\u6210\u51FD\u6570\u5173\u7CFB\u5F0F\uFF0C\u518D\u7528\u9876\u70B9\u5F0F\u6C42\u6700\u503C\u3002" : "\u5148\u56DE\u5FC6\u76F8\u5173\u7684\u5B9A\u4E49\u6216\u516C\u5F0F\uFF0C\u518D\u5224\u65AD\u7528\u54EA\u4E00\u4E2A\u3002"}`,
      `3. **\u6700\u540E\u5BF9\u7B54\u6848**\uFF1A\u53C2\u8003\u7B54\u6848\u662F ${q.solution || "\uFF08\u9898\u5E93\u91CC\u8FD8\u6CA1\u6709\u7B54\u6848\uFF09"}\uFF0C\u8BF7\u5B66\u751F\u8BF4\u51FA\u6BCF\u4E00\u6B65\u7684\u4F9D\u636E\u3002`,
      "",
      "## \u5B66\u751F\u5BB9\u6613\u51FA\u9519\u7684\u5730\u65B9",
      "",
      hard ? "- \u5FD8\u4E86\u5199\u81EA\u53D8\u91CF\u7684\u53D6\u503C\u8303\u56F4\uFF1B\n- \u6C42\u51FA\u9876\u70B9\u540E\u5FD8\u8BB0\u56DE\u7B54\u201C\u552E\u4EF7\u5B9A\u4E3A\u591A\u5C11\u201D\u3002" : "- \u8BA1\u7B97\u6B65\u9AA4\u8DF3\u5F97\u592A\u5FEB\uFF0C\u7B26\u53F7\u51FA\u9519\uFF1B\n- \u6CA1\u6709\u68C0\u9A8C\u7ED3\u679C\u662F\u5426\u7B26\u5408\u9898\u610F\u3002",
      "",
      "## \u4E00\u9053\u53D8\u5F0F",
      "",
      hard ? "\u628A\u9898\u76EE\u6539\u6210\u201C\u8FDB\u4EF7 $50$ \u5143\uFF0C\u65E5\u9500\u91CF\u4E3A $(120-x)$ \u4EF6\u201D\uFF0C\u6700\u5927\u5229\u6DA6\u662F\u591A\u5C11\uFF1F\u7B54\u6848\uFF1A\u5F53 $x=85$ \u65F6\uFF0C$W$ \u6700\u5927\u4E3A $1225$ \u5143\u3002" : "\u628A\u9898\u76EE\u4E2D\u7684\u6570\u5B57\u6362\u4E00\u7EC4\uFF0C\u518D\u8BA9\u5B66\u751F\u72EC\u7ACB\u5B8C\u6210\u4E00\u6B21\uFF0C\u68C0\u9A8C\u662F\u5426\u771F\u7684\u638C\u63E1\u3002"
    ].join("\n");
  }
  function scheduleAnswer(entries, offset) {
    const day = dayKey(offset);
    const list = entries.filter((e) => e.date === day).sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
    const name = offset === 0 ? "\u4ECA\u5929" : offset === 1 ? "\u660E\u5929" : "\u8FD9\u4E00\u5929";
    if (!list.length) return { text: `${name}\u6CA1\u6709\u5B89\u6392\u3002\u53EF\u4EE5\u8D81\u8FD9\u6BB5\u65F6\u95F4\uFF0C\u628A\u201C\u5F85\u5B89\u6392\u201D\u91CC\u7684\u4E8B\u60C5\u5904\u7406\u6389\u4E00\u4E24\u4EF6\u3002`, list };
    const lessons = list.filter(isLesson).length;
    const lines = [`${name}\u4E00\u5171 **${list.length} \u4EF6\u4E8B**\uFF0C\u5176\u4E2D ${lessons} \u8282\u8BFE\u3002`, ""];
    for (const e of list) lines.push(`- **${e.start ?? "\u5168\u5929"}** ${e.title}${e.todo.length ? ` \u2014 ${e.todo.join("\u3001")}` : ""}`);
    const busy = list.find((e) => e.todo.length >= 2);
    if (busy) lines.push("", `> **\u63D0\u9192** \u201C${busy.title}\u201D\u8FD8\u6709 ${busy.todo.length} \u4EF6\u51C6\u5907\u5DE5\u4F5C\u6CA1\u505A\u5B8C\uFF0C\u6700\u597D\u63D0\u524D\u5904\u7406\u3002`);
    return { text: lines.join("\n"), list };
  }
  function generalAnswer(prompt, topic) {
    const name = topic?.name ?? "\u8FD9\u4EF6\u4E8B";
    return [
      `\u53EF\u4EE5\u628A${name}\u62C6\u6210\u4E09\u6B65\u6765\u51C6\u5907\u3002`,
      "",
      "1. **\u60F3\u6E05\u695A\u76EE\u6807**\uFF1A\u5B66\u751F\u5B66\u5B8C\u4EE5\u540E\uFF0C\u5E94\u8BE5\u80FD\u72EC\u7ACB\u505A\u5230\u4EC0\u4E48\uFF1F\u5199\u6210\u4E00\u53E5\u8BDD\u3002",
      "2. **\u627E\u4E00\u4E2A\u597D\u4F8B\u5B50**\uFF1A\u4E00\u4E2A\u5177\u4F53\u3001\u5B66\u751F\u719F\u6089\u7684\u4F8B\u5B50\uFF0C\u6BD4\u4E09\u6BB5\u8BB2\u89E3\u66F4\u6709\u7528\u3002",
      "3. **\u5B89\u6392\u7531\u6D45\u5165\u6DF1\u7684\u7EC3\u4E60**\uFF1A\u5148\u6A21\u4EFF\uFF0C\u518D\u53D8\u5F0F\uFF0C\u6700\u540E\u7EFC\u5408\u3002",
      "",
      "\u5982\u679C\u4F60\u544A\u8BC9\u6211\u662F\u54EA\u4E2A\u73ED\u3001\u54EA\u4E00\u8282\u8BFE\uFF0C\u6211\u53EF\u4EE5\u5E2E\u4F60\u628A\u8BB2\u89E3\u987A\u5E8F\u548C\u7EC3\u4E60\u4E00\u8D77\u6392\u597D\u3002"
    ].join("\n");
  }
  function tokens(text) {
    const out = [];
    const re = /(\$\$[\s\S]+?\$\$|^> .*$\n?|\$[^$\n]+\$|\*\*[^*\n]+\*\*|^\|.*\|$\n?)/gm;
    let last = 0;
    for (const m of text.matchAll(re)) {
      for (const ch of Array.from(text.slice(last, m.index))) out.push(ch);
      out.push(m[0]);
      last = m.index + m[0].length;
    }
    for (const ch of Array.from(text.slice(last))) out.push(ch);
    return out;
  }
  var agentScript = {
    async run({ doc, turn, prompt, references, emit, updated, finish, stamp, id, runs }) {
      const run = { timer: null };
      runs.set(turn.id, run);
      const alive = () => turn.state === "running";
      let ordinal = 0;
      async function step(name, args, exec, describe) {
        const call3 = { toolCallId: id(), turnId: turn.id, ordinal: ordinal += 1, name, arguments: args, state: "executing", result: null, startedAt: stamp(), endedAt: null, detail: describe?.(null) ?? null };
        doc.toolCalls.push(call3);
        emit(doc, "toolCall", call3);
        updated(doc);
        const started = Date.now();
        let result = null;
        try {
          result = await exec();
          call3.state = "read";
        } catch {
          call3.state = "failed";
        }
        await sleep(run, Math.max(0, 650 + Math.random() * 450 - (Date.now() - started)));
        if (!alive()) return result;
        call3.result = result;
        call3.endedAt = stamp();
        call3.detail = describe?.(result) ?? null;
        emit(doc, "toolCall", call3);
        updated(doc);
        return result;
      }
      const earlier = doc.messages.filter((m) => m.role === "user" && m.turnId !== turn.id && m.references?.length).pop()?.references ?? [];
      const refQuestion = references.find((r) => r.input?.kind === "question");
      const ownEntry = references.find((r) => r.input?.kind === "entry");
      const refEntry = ownEntry ?? (refQuestion ? null : earlier.find((r) => r.input?.kind === "entry"));
      const topic = topicOf(`${prompt} ${refEntry?.title ?? ""} ${(refEntry?.snapshot?.items ?? []).map((i) => i.text).join(" ")} ${refQuestion?.title ?? ""}`);
      let text = "";
      const cards = [];
      await sleep(run, 450);
      if (!alive()) return;
      if (refQuestion) {
        const q = await step("questions.read", { id: refQuestion.input.id }, () => readQuestion(refQuestion.input.id), (r) => r?.title ?? refQuestion.title);
        if (!alive()) return;
        if (/找|相似|类似|similar|find/i.test(prompt)) {
          const words = topic?.words ?? [q?.tags?.[0] ?? q?.title?.slice(0, 2) ?? ""];
          const found = await step("questions.search", { words }, () => searchQuestions(words), (r) => r ? `${words.join("\u3001")} \xB7 ${r.filter((x) => x.id !== q?.id).length} \u9053` : words.join("\u3001")) ?? [];
          const others = found.filter((x) => x.id !== q?.id);
          text = others.length ? `\u9898\u5E93\u91CC\u548C **${q?.title}** \u76F8\u8FD1\u7684\u9898\u6709 ${others.length} \u9053\uFF0C\u6309\u76F8\u4F3C\u7A0B\u5EA6\u6392\u597D\u4E86\u3002` : "\u9898\u5E93\u91CC\u6682\u65F6\u6CA1\u6709\u76F8\u8FD1\u7684\u9898\u3002\u53EF\u4EE5\u8BA9\u6211\u6309\u8FD9\u9053\u9898\u51FA\u4E00\u9053\u53D8\u5F0F\u3002";
          if (others.length) cards.push({ kind: "questions", title: `\u76F8\u8FD1\u7684\u9898 \xB7 ${others.length} \u9053`, items: others.slice(0, 5) });
        } else {
          text = questionAnswer(q ?? { title: refQuestion.title, tags: [], solution: "" });
          if (q && /最值|利润|压轴/.test(q.title + q.tags.join(""))) {
            cards.push({ kind: "variant", title: "\u53D8\u5F0F\u9898\u5DF2\u5907\u597D", meta: "\u5B58\u8FDB\u9898\u5E93\uFF0C\u4E0B\u6B21\u76F4\u63A5\u7528", item: { title: `${q.title} \xB7 \u53D8\u5F0F`, body: "\u67D0\u5546\u54C1\u8FDB\u4EF7 $50$ \u5143\uFF0C\u552E\u4EF7 $x$ \u5143\u65F6\u65E5\u9500\u91CF\u4E3A $(120-x)$ \u4EF6\u3002\u552E\u4EF7\u5B9A\u4E3A\u591A\u5C11\u65F6\u65E5\u5229\u6DA6\u6700\u5927\uFF1F", solution: "\u5229\u6DA6 $W=(x-50)(120-x)$\uFF0C\u5F53 $x=85$ \u65F6\u6700\u5927\uFF0C\u4E3A $1225$ \u5143\u3002", tagIds: q.tagIds, typeId: q.typeId } });
          }
        }
      } else if (/明天|今天|这周|本周|日程|课表|有什么课|安排|tomorrow|today|this week|schedule|timetable|classes/i.test(prompt) && !/讲|梳理|设计|teach|plan|design/i.test(prompt)) {
        const offset2 = /明天|tomorrow/i.test(prompt) ? 1 : 0;
        const entries = await step("schedule.read", { day: dayKey(offset2) }, readSchedule, (r) => r ? `${offset2 ? "\u660E\u5929" : "\u4ECA\u5929"} \xB7 ${r.filter((e) => e.date === dayKey(offset2)).length} \u4EF6\u4E8B` : offset2 ? "\u660E\u5929" : "\u4ECA\u5929") ?? [];
        if (!alive()) return;
        const { text: t2, list } = scheduleAnswer(entries, offset2);
        text = t2;
        if (list.length) cards.push({ kind: "lessons", title: offset2 ? "\u660E\u5929\u7684\u5B89\u6392" : "\u4ECA\u5929\u7684\u5B89\u6392", items: list.map((e) => ({ id: e.id, when: e.start ?? "\u5168\u5929", title: e.title, label: e.label })) });
      } else if (/分层|作业|tiered|homework/i.test(prompt) && !/找|find/i.test(prompt)) {
        const words = topic?.words ?? ["\u5206\u6570"];
        await step("questions.search", { words }, () => searchQuestions(words), (r) => r ? `${words.join("\u3001")} \xB7 ${r.length} \u9053` : words.join("\u3001"));
        if (!alive()) return;
        const p = practiceAnswer(topic);
        text = p.text;
        cards.push({ kind: "practice", title: `${topic?.key === "func" ? "\u4E8C\u6B21\u51FD\u6570" : "\u5206\u6570\u52A0\u51CF\u6CD5"}\u5206\u5C42\u7EC3\u4E60 \xB7 9 \u9053`, meta: "\u4E09\u4E2A\u5C42\u6B21\uFF0C\u5404 3 \u9053", items: p.items });
      } else if (/找|搜|几道|压轴|题目|相似|find|search|questions|challeng|similar/i.test(prompt)) {
        const words = topic?.words ?? (/压轴|challeng/i.test(prompt) ? ["\u538B\u8F74", "\u6700\u503C"] : ["\u51FD\u6570"]);
        const found = await step("questions.search", { words }, () => searchQuestions(words), (r) => r ? `${words.join("\u3001")} \xB7 ${r.length} \u9053` : words.join("\u3001")) ?? [];
        if (!alive()) return;
        const hard = /压轴|难|challeng|hard/i.test(prompt) ? found.filter((q) => q.tags.some((t2) => /压轴|解答/.test(t2))) : found;
        const list = (hard.length ? hard : found).slice(0, 5);
        text = list.length ? `\u627E\u5230 **${list.length} \u9053**${topic ? topic.name.replace(/的.*$/, "") : ""}\u9898\u3002${list.length > 1 ? `\u6309\u96BE\u5EA6\u6392\u597D\u4E86\uFF0C\u7B2C\u4E00\u9053 **${list[0].title}** \u9002\u5408\u653E\u5728\u8BFE\u5802\u5F00\u5934\u3002` : ""}` : "\u9898\u5E93\u91CC\u6682\u65F6\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u9898\u3002\u53EF\u4EE5\u5148\u5728\u9996\u9875\u8F7D\u5165\u793A\u4F8B\u6570\u636E\uFF0C\u6216\u8005\u544A\u8BC9\u6211\u9898\u76EE\u8981\u6C42\uFF0C\u6211\u6765\u5E2E\u4F60\u51FA\u3002";
        if (list.length) cards.push({ kind: "questions", title: `\u627E\u5230 ${list.length} \u9053\u9898`, items: list });
      } else if (/演示|动画|动态|滑块|demo|animat|slider/i.test(prompt)) {
        text = demoAnswer();
        cards.push({ kind: "link", title: "\u5728\u6570\u5B66\u5DE5\u574A\u91CC\u505A\u8FD9\u4E2A\u6F14\u793A", meta: "\u53C2\u6570\u6ED1\u5757\u3001\u8F68\u8FF9\u548C\u70B9\u90FD\u80FD\u76F4\u63A5\u52A0", route: "/math", icon: "math" });
      } else if (/讲法|怎么证|证明|ways to teach|approach|prove|proof/i.test(prompt)) {
        const words = topic?.words ?? ["\u5168\u7B49"];
        const found = await step("questions.search", { words }, () => searchQuestions(words), (r) => r ? `${words.join("\u3001")} \xB7 ${r.length} \u9053` : words.join("\u3001")) ?? [];
        if (!alive()) return;
        text = (METHODS[topic?.key] ?? METHODS.geo).join("\n");
        if (found.length) cards.push({ kind: "questions", title: "\u9898\u5E93\u91CC\u7684\u8FD9\u9053\u9898", items: found.slice(0, 2) });
      } else if (/讲解顺序|梳理|怎么讲|备课|教学设计|这节课|teaching order|plan|how to teach|lesson/i.test(prompt) || ownEntry) {
        const entries = await step("schedule.read", { upcoming: true }, readSchedule, (r) => {
          const n = refEntry ? null : r && nextLesson(r);
          return refEntry ? refEntry.title : n ? `\u4E0B\u4E00\u8282\uFF1A${whenLabel(n)} ${n.title}` : "\u6CA1\u6709\u627E\u5230\u6392\u597D\u7684\u8BFE";
        }) ?? [];
        if (!alive()) return;
        const lesson = refEntry ? { title: refEntry.title, ...entries.find((e) => e.id === refEntry.input.id) ?? {} } : nextLesson(entries);
        const words = topic?.words ?? ["\u4E8C\u6B21\u51FD\u6570"];
        const found = await step("questions.search", { words }, () => searchQuestions(words), (r) => r ? `${words.join("\u3001")} \xB7 ${r.length} \u9053` : words.join("\u3001")) ?? [];
        if (!alive()) return;
        const plan = lessonAnswer(topic ?? TOPICS[0], lesson, found);
        text = plan.text;
        cards.push({ kind: "plan", title: `${plan.name} \xB7 \u8BB2\u89E3\u987A\u5E8F`, meta: `${plan.steps.length} \u4E2A\u73AF\u8282 \xB7 ${plan.total} \u5206\u949F`, entryTitle: `\u5907\u8BFE\uFF1A${plan.name}`, steps: plan.steps.map(([title, minutes]) => `${title}\uFF08${minutes} \u5206\u949F\uFF09`) });
        if (found.length) cards.push({ kind: "questions", title: `\u53EF\u4EE5\u7528\u7684\u9898 \xB7 ${Math.min(found.length, 3)} \u9053`, items: found.slice(0, 3) });
      } else {
        text = generalAnswer(prompt, topic);
      }
      if (!alive()) return;
      const message = { id: id(), turnId: turn.id, role: "assistant", text: "", references: [], state: "streaming", createdAt: stamp(), cards: [] };
      doc.messages.push(message);
      const parts = tokens(text);
      let offset = 0;
      while (offset < parts.length) {
        if (!alive()) return;
        const n = 3 + Math.floor(Math.random() * 4);
        offset = Math.min(parts.length, offset + n);
        message.text = parts.slice(0, offset).join("");
        emit(doc, "message", message);
        updated(doc);
        await sleep(run, 34);
      }
      if (!alive()) return;
      message.cards = cards;
      emit(doc, "message", message);
      await sleep(run, 120);
      if (alive()) finish(doc, turn);
    }
  };

  // docs/design-system/teachbuddy-app/ui/tbx/src/agent/AgentWorkspace.jsx
  var ta = tx;
  var MODELS = [
    { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek", get note() {
      return tx("\u5FEB\u901F\u3001\u64C5\u957F\u63A8\u7406");
    } },
    { id: "z-ai/glm-5.3-flash", name: "GLM", get note() {
      return tx("\u4E2D\u6587\u8868\u8FBE\u81EA\u7136");
    } }
  ];
  var SUGGESTIONS = [
    { icon: "list", title: "\u68B3\u7406\u4E00\u8282\u8BFE\u7684\u8BB2\u89E3\u987A\u5E8F", prompt: "\u5E2E\u6211\u68B3\u7406\u4E00\u8282\u4E8C\u6B21\u51FD\u6570\u56FE\u50CF\u4E0E\u6027\u8D28\u7684\u8BB2\u89E3\u987A\u5E8F" },
    { icon: "chat", title: "\u8BA8\u8BBA\u4E00\u9053\u9898\u7684\u4E0D\u540C\u8BB2\u6CD5", prompt: "\u8FD9\u9053\u4E09\u89D2\u5F62\u5168\u7B49\u7684\u8BC1\u660E\u9898\uFF0C\u6709\u54EA\u51E0\u79CD\u8BB2\u6CD5\uFF1F" },
    { icon: "graph", title: "\u6784\u601D\u4E00\u4E2A\u6570\u5B66\u6F14\u793A", prompt: "\u6784\u601D\u4E00\u4E2A\u6F14\u793A\uFF0C\u8BA9\u5B66\u751F\u770B\u5230\u629B\u7269\u7EBF\u5F00\u53E3\u65B9\u5411\u5982\u4F55\u968F a \u53D8\u5316" },
    { icon: "layers", title: "\u8BBE\u8BA1\u4E00\u7EC4\u5206\u5C42\u7EC3\u4E60", prompt: "\u4E3A\u5206\u6570\u52A0\u51CF\u6CD5\u8BBE\u8BA1\u4E00\u7EC4\u7531\u6613\u5230\u96BE\u7684\u5206\u5C42\u7EC3\u4E60" }
  ];
  var KIND = {
    question: { glyph: "book", get label() {
      return tx("\u9898\u76EE");
    }, hue: "orange" },
    entry: { glyph: "calendar", get label() {
      return tx("\u65E5\u7A0B");
    }, hue: "indigo" },
    resource: { glyph: "folder", get label() {
      return tx("\u8D44\u6599");
    }, hue: "blue" }
  };
  var PATHS = {
    list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
    chat: "M20.5 11.6a8.1 8.1 0 0 1-11.8 7.2L3.8 20l1.3-4.4A8.1 8.1 0 1 1 20.5 11.6Z",
    graph: "M3 12.8h3.2l3.1 7.2 5.2-16H21",
    layers: "m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5ZM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5",
    spark: "M12 3.5c.5 3.9 2.6 6 6.5 6.5-3.9.5-6 2.6-6.5 6.5-.5-3.9-2.6-6-6.5-6.5 3.9-.5 6-2.6 6.5-6.5Z",
    plus: "M12 5.5v13M5.5 12h13",
    arrowUp: "M12 19V5.5M6.5 11 12 5.5l5.5 5.5",
    arrowDown: "M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5",
    stop: "M8 8h8v8H8z",
    chevron: "m7.5 10 4.5 4.5 4.5-4.5",
    chevronRight: "m10 7.5 4.5 4.5-4.5 4.5",
    check: "m5.5 12.5 4 4 9-9.5",
    alert: "M12 8.5v4.5M12 16.4h.01M10.3 4 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z",
    book: "M6.5 3.5h11.2c.7 0 1.3.6 1.3 1.3v13.4c0 .7-.6 1.3-1.3 1.3H6.5A2.5 2.5 0 0 1 4 17V6a2.5 2.5 0 0 1 2.5-2.5ZM4 17a2.5 2.5 0 0 1 2.5-2.5H19",
    calendar: "M6.5 5h11a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3ZM3.5 10h17M8 3v4M16 3v4",
    folder: "M3.5 7.5a2 2 0 0 1 2-2h4.2l2 2.2h6.8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2ZM3.5 10.6h17",
    close: "m7 7 10 10M17 7 7 17",
    back: "m14 6-6 6 6 6",
    search: "M10.8 17.6a6.8 6.8 0 1 1 0-13.6 6.8 6.8 0 0 1 0 13.6Zm9.7 2.9-4.9-4.9",
    copy: "M9 9h9.5a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19v-8.5A1.5 1.5 0 0 1 9 9ZM16.5 9V5A1.5 1.5 0 0 0 15 3.5H5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h2.5",
    retry: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.8h3.8",
    compose: "M12 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V12M17.8 3.8l2.4 2.4-7.7 7.7-3.1.7.7-3.1 7.7-7.7Z",
    expand: "M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5l-6 6M4.5 19.5l6-6",
    more: "M6 12h.01M12 12h.01M18 12h.01",
    pin: "M9 4.5h6M10 4.5v5.2l-3 3.3h10l-3-3.3V4.5M12 13v6.5",
    pencil: "m15.6 4.6 3.8 3.8L8.7 19.1l-4.6.8.8-4.6zM13.6 6.6l3.8 3.8",
    at: "M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm0 0v1.3a2.7 2.7 0 0 0 5.2 1A8.6 8.6 0 1 0 17 19",
    open: "M14 4.5h5.5V10M19.5 4.5 11 13M17 13.5v4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4",
    quote: "M5 11.5h4.5V17H5zM5 11.5C5 8.5 6.5 6.6 9 6M14.5 11.5H19V17h-4.5zM14.5 11.5c0-3 1.5-4.9 4-5.5"
  };
  function Glyph3({ name, size = 18, stroke = 1.75 }) {
    return /* @__PURE__ */ h("svg", { className: "tbx-glyph", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, globalThis.__tbx?.glyphs?.[name] ?? /* @__PURE__ */ h("path", { d: PATHS[name] || PATHS.spark }));
  }
  var uuid = () => crypto.randomUUID();
  async function call(method, path2, body) {
    const init = { method, headers: { "Idempotency-Key": uuid() } };
    if (body !== void 0) {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] = "application/json";
    }
    const res = await fetch(path2, init);
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(String(res.status)), { body: json });
    return json;
  }
  var toDoc = (text) => ({ version: 2, blocks: String(text).split("\n").filter(Boolean).map((line) => {
    const runs = [];
    let end = 0;
    for (const m of line.matchAll(/\$([^$]+)\$/g)) {
      if (m.index > end) runs.push({ type: "text", text: line.slice(end, m.index) });
      runs.push({ type: "math", latex: m[1] });
      end = m.index + m[0].length;
    }
    if (end < line.length) runs.push({ type: "text", text: line.slice(end) });
    return { type: "paragraph", runs };
  }) });
  function relativeTime(iso2) {
    const diff = (Date.now() - new Date(iso2).getTime()) / 1e3;
    if (diff < 60) return tx("\u521A\u521A");
    if (diff < 3600) return tx("{{n}} \u5206\u949F", { n: Math.floor(diff / 60) });
    if (diff < 86400) return tx("{{n}} \u5C0F\u65F6", { n: Math.floor(diff / 3600) });
    const d = new Date(iso2);
    return monthDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  var clock = (iso2) => {
    const d = new Date(iso2);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  function bucket(iso2) {
    const d = new Date(iso2).getTime();
    const now = /* @__PURE__ */ new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (d >= start) return tx("\u4ECA\u5929");
    if (d >= start - 864e5) return tx("\u6628\u5929");
    if (d >= start - 6 * 864e5) return tx("\u6700\u8FD1 7 \u5929");
    return tx("\u66F4\u65E9");
  }
  var threadTitle = (title) => !title || title === "\u65B0\u5BF9\u8BDD" ? tx("\u65B0\u5BF9\u8BDD") : title;
  function greeting() {
    const hour = (/* @__PURE__ */ new Date()).getHours();
    return tx(hour < 5 ? "\u591C\u6DF1\u4E86" : hour < 11 ? "\u65E9\u4E0A\u597D" : hour < 13 ? "\u4E2D\u5348\u597D" : hour < 18 ? "\u4E0B\u5348\u597D" : "\u665A\u4E0A\u597D");
  }
  function useRoute() {
    const read = () => globalThis.__teachbuddyLocation?.pathname ?? "/";
    const [path2, setPath] = useState(read);
    useEffect(() => {
      const on = () => setPath(read());
      window.addEventListener("tb:navigate", on);
      window.addEventListener("popstate", on);
      return () => {
        window.removeEventListener("tb:navigate", on);
        window.removeEventListener("popstate", on);
      };
    }, []);
    return path2;
  }
  function useOutside(open, ref, close) {
    useEffect(() => {
      if (!open) return void 0;
      const down = (e) => {
        if (!ref.current?.contains(e.target)) close();
      };
      const key2 = (e) => {
        if (e.key === "Escape") close();
      };
      document.addEventListener("pointerdown", down);
      document.addEventListener("keydown", key2);
      return () => {
        document.removeEventListener("pointerdown", down);
        document.removeEventListener("keydown", key2);
      };
    }, [open]);
  }
  var lessonCache = null;
  async function loadLessons(force = false) {
    if (lessonCache && !force) return lessonCache;
    try {
      const { items } = await call("GET", "/api/modules/schedule/entries");
      const today2 = /* @__PURE__ */ new Date();
      const key2 = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const now = `${key2(today2)} ${today2.toTimeString().slice(0, 5)}`;
      lessonCache = items.filter((e) => e.time?.date && /数学|课/.test(e.title) && `${e.time.date} ${e.time.startTime}` >= now).map((e) => ({ id: e.id, title: e.title, date: e.time.date, start: e.time.startTime, todo: (e.items ?? []).map((i) => i.text) })).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)).slice(0, 6);
    } catch {
      lessonCache = [];
    }
    return lessonCache;
  }
  function useLessons(revision) {
    const [lessons, setLessons] = useState(lessonCache ?? []);
    const [tick, setTick] = useState(0);
    useEffect(() => {
      let live = true;
      loadLessons(true).then((l) => live && setLessons(l));
      const again = () => setTick((n) => n + 1);
      window.addEventListener("tb:navigate", again);
      window.addEventListener("focus", again);
      return () => {
        live = false;
        window.removeEventListener("tb:navigate", again);
        window.removeEventListener("focus", again);
      };
    }, [revision, tick]);
    return [lessons, () => setTick((n) => n + 1)];
  }
  var REF_TITLES = /* @__PURE__ */ new Map();
  var remember = (r) => {
    if (r?.id) REF_TITLES.set(`${r.kind}:${r.id}`, { title: r.title, note: r.note });
  };
  function useRefTitles(refs) {
    const [, bump] = useState(0);
    useEffect(() => {
      let live = true;
      for (const r of refs) {
        const key2 = `${r.kind}:${r.id}`;
        if (REF_TITLES.has(key2)) continue;
        REF_TITLES.set(key2, { title: KIND[r.kind]?.label ?? tx("\u5F15\u7528") });
        const where = r.kind === "question" ? "/api/modules/questions/v2/items/" : r.kind === "entry" ? "/api/modules/schedule/entries/" : "/api/modules/resources/items/";
        call("GET", where + encodeURIComponent(r.id)).then((o) => {
          REF_TITLES.set(key2, { title: o.title || KIND[r.kind]?.label, note: r.kind === "entry" && o.time?.date ? whenLabel({ date: o.time.date, start: o.time.startTime }) : void 0 });
          if (live) bump((n) => n + 1);
        }).catch(() => {
        });
      }
      return () => {
        live = false;
      };
    }, [refs.map((r) => r.id).join(",")]);
  }
  var titleCache = /* @__PURE__ */ new Map();
  function selectedQuestionId() {
    try {
      const store = globalThis.__teachbuddyLocalStorage;
      const key2 = Object.keys(store).find((k) => k.endsWith(":questions-materials-scene") && !k.includes(":branch:") && !k.includes(":head:"));
      const scene = key2 ? JSON.parse(store.getItem(key2)) : null;
      return scene?.kind === "question" && scene.id ? scene.id : null;
    } catch {
      return null;
    }
  }
  function useCurrentContext(enabled) {
    const path2 = useRoute();
    const [ctx, setCtx] = useState(null);
    const [picked, setPicked] = useState(null);
    useEffect(() => {
      if (!enabled || !path2.startsWith("/questions")) {
        setPicked(null);
        return void 0;
      }
      const read = () => setPicked(selectedQuestionId());
      read();
      const id = setInterval(read, 700);
      return () => clearInterval(id);
    }, [path2, enabled]);
    useEffect(() => {
      if (!enabled) {
        setCtx(null);
        return void 0;
      }
      let live = true;
      const m = /^\/(questions|resources)\/([^/]+)$/.exec(path2);
      const target = m ? { kind: m[1] === "questions" ? "question" : "resource", id: decodeURIComponent(m[2]), area: m[1] } : picked ? { kind: "question", id: picked, area: "questions" } : null;
      (async () => {
        if (target) {
          const where = target.kind === "question" ? "/api/modules/questions/v2/items/" : "/api/modules/resources/items/";
          try {
            const cached = titleCache.get(target.id) ?? await call("GET", where + encodeURIComponent(target.id));
            titleCache.set(target.id, cached);
            if (live) setCtx({ ...target, version: cached.version, title: cached.title || KIND[target.kind].label });
          } catch {
            if (live) setCtx({ area: target.area });
          }
        } else if (path2.startsWith("/calendar")) {
          const [next] = await loadLessons(true);
          if (live) setCtx(next ? { kind: "entry", id: next.id, title: next.title, note: whenLabel(next), area: "calendar" } : { area: "calendar" });
        } else if (live) setCtx({ area: path2.split("/")[1] || "home" });
      })();
      return () => {
        live = false;
      };
    }, [path2, enabled, picked]);
    return ctx;
  }
  var latestAgent = { current: null };
  function sendReliably() {
    const first = latestAgent.current;
    if (!first?.draft) return;
    const text = first.draft.text;
    let tries = 0;
    const attempt = () => {
      const a = latestAgent.current;
      if (!a?.draft || a.draft.text !== text || a.snapshot?.turns.some((x) => x.state === "running") || tries > 5) return;
      tries += 1;
      void a.send();
      setTimeout(attempt, 750);
    };
    attempt();
  }
  var patchThread = (id, body) => call("PATCH", `/api/agent/conversations/${encodeURIComponent(id)}`, body);
  var deleteThread = (id) => call("DELETE", `/api/agent/conversations/${encodeURIComponent(id)}`);
  function ThreadMenu({ item, agent, onRename, onClose }) {
    const ref = useRef(null);
    useOutside(true, ref, onClose);
    return /* @__PURE__ */ h("div", { className: "tbx-menu is-thread", ref, role: "menu", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ h("button", { role: "menuitem", onClick: async () => {
      onClose();
      await patchThread(item.id, { pinned: !item.pinned });
      await agent.retry();
    } }, /* @__PURE__ */ h(Glyph3, { name: "pin", size: 16 }), item.pinned ? tx("\u53D6\u6D88\u7F6E\u9876") : tx("\u7F6E\u9876")), /* @__PURE__ */ h("button", { role: "menuitem", onClick: () => {
      onClose();
      onRename();
    } }, /* @__PURE__ */ h(Glyph3, { name: "pencil", size: 16 }), tx("\u91CD\u547D\u540D")), /* @__PURE__ */ h(
      ConfirmMenuItem,
      {
        icon: /* @__PURE__ */ h(Glyph3, { name: "trash", size: 16 }),
        label: tx("\u5220\u9664"),
        onConfirm: async () => {
          onClose();
          try {
            await deleteThread(item.id);
            await agent.retry();
            if (agent.id === item.id) {
              const next = agent.list.find((x) => x.id !== item.id);
              if (next) agent.select(next.id);
              else void agent.create();
            }
          } catch {
          }
        }
      }
    ));
  }
  function ThreadList({ onPick }) {
    useLocale();
    const { useAgent } = tb();
    const agent = useAgent();
    const [query, setQuery] = useState("");
    const [menu, setMenu] = useState(null);
    const [renaming, setRenaming] = useState(null);
    const [draftTitle, setDraftTitle] = useState("");
    const running = agent.configuration?.activeTurn?.conversationId;
    const groups = useMemo(() => {
      const q = query.trim().toLowerCase();
      const items = agent.list.filter((c) => !q || `${c.title} ${c.preview ?? ""}`.toLowerCase().includes(q));
      const out = [];
      const pinned = items.filter((c) => c.pinned);
      if (pinned.length) out.push({ label: tx("\u5DF2\u7F6E\u9876"), items: pinned });
      for (const item of items.filter((c) => !c.pinned)) {
        const label = bucket(item.updatedAt);
        let group = out.find((g) => g.label === label);
        if (!group) out.push(group = { label, items: [] });
        group.items.push(item);
      }
      return out;
    }, [agent.list, query]);
    async function commitRename(item) {
      const title = draftTitle.trim();
      setRenaming(null);
      if (title && title !== item.title) {
        await patchThread(item.id, { title });
        await agent.retry();
      }
    }
    return /* @__PURE__ */ h("aside", { className: "tbx-threads", "aria-label": tx("\u5BF9\u8BDD") }, /* @__PURE__ */ h("div", { className: "tbx-threads-head" }, /* @__PURE__ */ h("label", { className: "tbx-thread-search" }, /* @__PURE__ */ h(Glyph3, { name: "search", size: 15 }), /* @__PURE__ */ h("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: tx("\u641C\u7D22\u5BF9\u8BDD"), "aria-label": tx("\u641C\u7D22\u5BF9\u8BDD") })), /* @__PURE__ */ h("button", { className: "tbx-icon-btn tbx-compose", title: tx("\u65B0\u5BF9\u8BDD \u2318N"), "aria-label": tx("\u65B0\u5BF9\u8BDD"), onClick: () => {
      void agent.create();
      onPick?.();
    }, disabled: agent.busy }, /* @__PURE__ */ h(Glyph3, { name: "compose", size: 18 }))), /* @__PURE__ */ h("div", { className: "tbx-thread-scroll" }, agent.list.length === 0 && /* @__PURE__ */ h("p", { className: "tbx-threads-empty" }, tx("\u8FD8\u6CA1\u6709\u5BF9\u8BDD\u3002"), /* @__PURE__ */ h("br", null), tx("\u4ECE\u53F3\u8FB9\u5F00\u59CB\u7B2C\u4E00\u6BB5\u5427\u3002")), agent.list.length > 0 && groups.length === 0 && /* @__PURE__ */ h("p", { className: "tbx-threads-empty" }, tx("\u6CA1\u6709\u627E\u5230\u76F8\u5173\u7684\u5BF9\u8BDD\u3002")), groups.map((group) => /* @__PURE__ */ h("section", { key: group.label, className: "tbx-thread-group" }, /* @__PURE__ */ h("h3", null, group.label), group.items.map((item, i) => /* @__PURE__ */ h(
      "div",
      {
        key: item.id,
        role: "button",
        tabIndex: 0,
        style: { "--i": i },
        className: cx("tbx-thread", item.id === agent.id && "is-active", menu?.id === item.id && "is-menu"),
        onClick: () => {
          if (renaming !== item.id) {
            agent.select(item.id);
            onPick?.();
          }
        },
        onKeyDown: (e) => {
          if (e.key === "Enter" && renaming !== item.id) agent.select(item.id);
        },
        "aria-current": item.id === agent.id ? "true" : void 0
      },
      /* @__PURE__ */ h("span", { className: "tbx-thread-line" }, renaming === item.id ? /* @__PURE__ */ h(
        "input",
        {
          className: "tbx-thread-rename",
          autoFocus: true,
          value: draftTitle,
          maxLength: 80,
          onClick: (e) => e.stopPropagation(),
          onChange: (e) => setDraftTitle(e.target.value),
          onBlur: () => commitRename(item),
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitRename(item);
            if (e.key === "Escape") setRenaming(null);
          }
        }
      ) : /* @__PURE__ */ h("span", { className: "tbx-thread-title" }, threadTitle(item.title)), running === item.id ? /* @__PURE__ */ h("span", { className: "tbx-spinner", "aria-label": tx("\u751F\u6210\u4E2D") }) : /* @__PURE__ */ h("span", { className: "tbx-thread-time" }, item.pinned && /* @__PURE__ */ h(Glyph3, { name: "pin", size: 12 }), relativeTime(item.updatedAt))),
      /* @__PURE__ */ h("span", { className: "tbx-thread-preview" }, running === item.id ? tx("\u6B63\u5728\u56DE\u7B54\u2026") : item.preview || tx("\u8FD8\u6CA1\u6709\u56DE\u7B54")),
      /* @__PURE__ */ h(
        "button",
        {
          className: "tbx-thread-more",
          "aria-label": tx("\u5BF9\u8BDD\u9009\u9879"),
          onClick: (e) => {
            e.stopPropagation();
            setMenu(menu?.id === item.id ? null : { id: item.id });
          }
        }
      ),
      menu?.id === item.id && /* @__PURE__ */ h(ThreadMenu, { item, agent, onClose: () => setMenu(null), onRename: () => {
        setDraftTitle(item.title);
        setRenaming(item.id);
      } })
    ))))));
  }
  var TOOL = {
    "questions.search": { glyph: "search", verb: "\u5728\u9898\u5E93\u91CC\u627E", live: "\u6B63\u5728\u9898\u5E93\u91CC\u627E" },
    "questions.read": { glyph: "book", verb: "\u8BFB\u4E86\u9898\u76EE", live: "\u6B63\u5728\u8BFB\u9898\u76EE" },
    "schedule.read": { glyph: "calendar", verb: "\u770B\u4E86\u65E5\u7A0B", live: "\u6B63\u5728\u770B\u65E5\u7A0B" }
  };
  function Elapsed({ from, to }) {
    const [, tick] = useState(0);
    useEffect(() => {
      if (to) return void 0;
      const id = setInterval(() => tick((n) => n + 1), 1e3);
      return () => clearInterval(id);
    }, [to]);
    const s = Math.max(0, Math.round(((to ? new Date(to) : /* @__PURE__ */ new Date()) - new Date(from)) / 1e3));
    return /* @__PURE__ */ h("span", { className: "tbx-num" }, s < 60 ? tx("{{s}} \u79D2", { s }) : tx("{{m}} \u5206 {{s}} \u79D2", { m: Math.floor(s / 60), s: s % 60 }));
  }
  function Shimmer({ children }) {
    return /* @__PURE__ */ h("span", { className: "tbx-shine", "data-text": typeof children === "string" ? children : void 0 }, children);
  }
  function WorkRow({ call: call3 }) {
    const tool = TOOL[call3.name] ?? { glyph: "spark", verb: call3.name };
    const live = call3.state === "executing";
    const failed = call3.state === "failed";
    const verb = tx(live ? tool.live ?? tool.verb : failed ? "\u6CA1\u6709\u8BFB\u5230" : tool.verb);
    return /* @__PURE__ */ h("div", { className: cx("tbx-work-row", live && "is-live", failed && "is-failed") }, /* @__PURE__ */ h("span", { className: "tbx-work-icon" }, /* @__PURE__ */ h(Glyph3, { name: failed ? "alert" : tool.glyph, size: 15 })), /* @__PURE__ */ h("span", { className: "tbx-work-label" }, live ? /* @__PURE__ */ h(Shimmer, null, verb) : /* @__PURE__ */ h("strong", null, verb), call3.detail && /* @__PURE__ */ h("span", { className: "tbx-work-detail" }, call3.detail)));
  }
  function WorkLog({ calls, turn, answered }) {
    const live = turn.state === "running" && !answered;
    const [open, setOpen] = useState(false);
    if (!calls.length) return null;
    const end = calls[calls.length - 1].endedAt ?? null;
    if (live) {
      return /* @__PURE__ */ h("div", { className: "tbx-work" }, calls.map((c) => /* @__PURE__ */ h(WorkRow, { key: c.toolCallId, call: c })));
    }
    return /* @__PURE__ */ h("div", { className: cx("tbx-work is-folded", open && "is-open") }, /* @__PURE__ */ h("button", { className: "tbx-work-summary", onClick: () => setOpen(!open), "aria-expanded": open }, /* @__PURE__ */ h("span", null, tx("\u67E5\u9605\u4E86 {{n}} \u5904 \xB7 \u7528\u65F6", { n: calls.length }), " ", /* @__PURE__ */ h(Elapsed, { from: turn.createdAt, to: end ?? turn.endedAt ?? turn.createdAt })), /* @__PURE__ */ h(Glyph3, { name: "chevronRight", size: 14 })), /* @__PURE__ */ h("div", { className: "tbx-work-fold" }, /* @__PURE__ */ h("div", null, calls.map((c) => /* @__PURE__ */ h(WorkRow, { key: c.toolCallId, call: c })))));
  }
  var done = /* @__PURE__ */ new Map();
  function useDone(key2) {
    const [state, setState] = useState(done.get(key2) ?? "idle");
    const set = (v) => {
      done.set(key2, v);
      setState(v);
    };
    return [state, set];
  }
  function CardHead({ glyph, hue, title, meta, children }) {
    return /* @__PURE__ */ h("div", { className: "tbx-card-head" }, /* @__PURE__ */ h("span", { className: cx("tbx-card-tile", `is-${hue}`) }, /* @__PURE__ */ h(Glyph3, { name: glyph, size: 16 })), /* @__PURE__ */ h("span", { className: "tbx-card-title" }, /* @__PURE__ */ h("strong", null, title), meta && /* @__PURE__ */ h("small", null, meta)), children);
  }
  function ActionButton({ state, onRun, idle, doneLabel, doneTo }) {
    const { navigate } = tb();
    if (state === "done") {
      return /* @__PURE__ */ h("button", { className: "tbx-pill is-done", onClick: () => doneTo && navigate(doneTo) }, /* @__PURE__ */ h(Glyph3, { name: "check", size: 14, stroke: 2.2 }), doneLabel, doneTo && /* @__PURE__ */ h(Glyph3, { name: "chevronRight", size: 13 }));
    }
    return /* @__PURE__ */ h("button", { className: "tbx-pill", disabled: state === "busy", onClick: onRun }, state === "busy" ? /* @__PURE__ */ h("span", { className: "tbx-spinner is-small" }) : null, state === "error" ? tx("\u6CA1\u6210\u529F\uFF0C\u518D\u8BD5\u4E00\u6B21") : idle);
  }
  function QuestionRows({ items, agent }) {
    const { navigate } = tb();
    return /* @__PURE__ */ h("div", { className: "tbx-card-rows" }, items.map((q, i) => /* @__PURE__ */ h("div", { className: "tbx-card-row", key: q.id, style: { "--i": i } }, /* @__PURE__ */ h("button", { className: "tbx-card-row-main", onClick: () => navigate(`/questions/${q.id}`) }, /* @__PURE__ */ h("span", { className: "tbx-card-row-title" }, q.title), q.excerpt && /* @__PURE__ */ h("span", { className: "tbx-card-row-text" }, /* @__PURE__ */ h(Inline, { text: q.excerpt }))), /* @__PURE__ */ h("span", { className: "tbx-card-row-tags" }, q.tags.map((tag) => /* @__PURE__ */ h("span", { key: tag }, tag))), /* @__PURE__ */ h("button", { className: "tbx-row-act", title: tx("\u5F15\u7528\u5230\u5BF9\u8BDD"), "aria-label": tx("\u5F15\u7528\u5230\u5BF9\u8BDD"), onClick: () => agent.addReference?.("question", q.id) }, /* @__PURE__ */ h(Glyph3, { name: "quote", size: 15 })))));
  }
  function ResultCard({ card, cardKey, agent }) {
    const { navigate } = tb();
    const [state, setState] = useDone(cardKey);
    const [expanded, setExpanded] = useState(false);
    const run = async (task) => {
      setState("busy");
      try {
        await task();
        setState("done");
      } catch {
        setState("error");
      }
    };
    if (card.kind === "questions") {
      return /* @__PURE__ */ h("div", { className: "tbx-card" }, /* @__PURE__ */ h(CardHead, { glyph: "book", hue: "orange", title: card.title, meta: tx("\u70B9\u5F00\u67E5\u770B\uFF0C\u6216\u5F15\u7528\u5230\u5BF9\u8BDD\u91CC\u7EE7\u7EED\u804A") }), /* @__PURE__ */ h(QuestionRows, { items: card.items, agent }));
    }
    if (card.kind === "plan") {
      return /* @__PURE__ */ h("div", { className: "tbx-card" }, /* @__PURE__ */ h(CardHead, { glyph: "list", hue: "indigo", title: card.title, meta: card.meta }, /* @__PURE__ */ h(ActionButton, { state, idle: tx("\u52A0\u5230\u65E5\u7A0B"), doneLabel: tx("\u5DF2\u52A0\u5230\u5F85\u5B89\u6392"), doneTo: "/calendar", onRun: () => run(() => call("POST", "/api/modules/schedule/entries", {
        title: card.entryTitle,
        items: card.steps.map((text) => ({ id: uuid(), text, priority: "normal", completed: false })),
        time: null,
        repeat: null,
        reminder: null,
        calendar: { allDay: false, notes: "", tags: [] }
      })) })), /* @__PURE__ */ h("ol", { className: "tbx-card-steps" }, card.steps.map((s, i) => /* @__PURE__ */ h("li", { key: i, style: { "--i": i } }, /* @__PURE__ */ h("span", null, /* @__PURE__ */ h(Inline, { text: s }))))));
    }
    if (card.kind === "practice" || card.kind === "variant") {
      const items = card.kind === "variant" ? [card.item] : card.items;
      const shown = expanded ? items : items.slice(0, 3);
      return /* @__PURE__ */ h("div", { className: "tbx-card" }, /* @__PURE__ */ h(CardHead, { glyph: "layers", hue: "orange", title: card.title, meta: card.meta }, /* @__PURE__ */ h(ActionButton, { state, idle: card.kind === "variant" ? tx("\u5B58\u8FDB\u9898\u5E93") : tx("\u5B58\u8FDB\u9898\u5E93 \xB7 {{n}} \u9053", { n: items.length }), doneLabel: tx("\u5DF2\u5B58\u8FDB\u9898\u5E93"), doneTo: "/questions", onRun: () => run(async () => {
        for (const q of items) {
          await call("POST", "/api/modules/questions/v2/items", { title: q.title, body: toDoc(q.body), solution: toDoc(q.solution), answerStatus: "present", typeId: q.typeId ?? null, tagIds: q.tagIds ?? [] });
        }
      }) })), /* @__PURE__ */ h("div", { className: "tbx-card-rows" }, shown.map((q, i) => /* @__PURE__ */ h("div", { className: "tbx-card-row is-static is-problem", key: i, style: { "--i": i } }, q.tier && /* @__PURE__ */ h("span", { className: "tbx-card-tier" }, q.tier.split(" \xB7 ")[0]), /* @__PURE__ */ h("span", { className: "tbx-card-row-title" }, /* @__PURE__ */ h(Inline, { text: q.body })), /* @__PURE__ */ h("span", { className: "tbx-card-answer" }, /* @__PURE__ */ h(Inline, { text: q.solution }))))), items.length > 3 && /* @__PURE__ */ h("button", { className: "tbx-card-more", onClick: () => setExpanded(!expanded) }, expanded ? tx("\u6536\u8D77") : tx("\u5C55\u5F00\u5176\u4F59 {{n}} \u9053", { n: items.length - 3 }), /* @__PURE__ */ h(Glyph3, { name: "chevron", size: 14 })));
    }
    if (card.kind === "lessons") {
      return /* @__PURE__ */ h("div", { className: "tbx-card" }, /* @__PURE__ */ h(CardHead, { glyph: "calendar", hue: "indigo", title: card.title, meta: tx("{{n}} \u4EF6\u4E8B", { n: card.items.length }) }, /* @__PURE__ */ h("button", { className: "tbx-pill is-quiet", onClick: () => navigate("/calendar") }, tx("\u6253\u5F00\u65E5\u7A0B"), /* @__PURE__ */ h(Glyph3, { name: "chevronRight", size: 13 }))), /* @__PURE__ */ h("div", { className: "tbx-card-rows" }, card.items.map((e, i) => /* @__PURE__ */ h("div", { className: "tbx-card-row is-static is-time", key: e.id, style: { "--i": i } }, /* @__PURE__ */ h("span", { className: "tbx-card-time tbx-num" }, e.when), /* @__PURE__ */ h("span", { className: "tbx-card-row-title" }, e.title), e.label && /* @__PURE__ */ h("span", { className: "tbx-card-row-tags" }, /* @__PURE__ */ h("span", null, e.label))))));
    }
    if (card.kind === "link") {
      return /* @__PURE__ */ h("button", { className: "tbx-card is-link", onClick: () => navigate(card.route) }, /* @__PURE__ */ h(CardHead, { glyph: card.icon ?? "open", hue: "lavender", title: card.title, meta: card.meta }, /* @__PURE__ */ h("span", { className: "tbx-card-go" }, /* @__PURE__ */ h(Glyph3, { name: "chevronRight", size: 16 }))));
    }
    return null;
  }
  function RefChip({ r, onRemove, suggest, onAdd }) {
    const { navigate } = tb();
    const kind = KIND[r.kind] ?? KIND.question;
    const open = () => {
      if (r.kind === "question") navigate(`/questions/${r.id}`);
      else if (r.kind === "resource") navigate(`/resources/${r.id}`);
      else navigate("/calendar");
    };
    return /* @__PURE__ */ h("span", { className: cx("tbx-chip", `is-${kind.hue}`, suggest && "is-suggest") }, /* @__PURE__ */ h(Glyph3, { name: suggest ? "plus" : kind.glyph, size: 13, stroke: 2 }), /* @__PURE__ */ h("button", { type: "button", onClick: suggest ? onAdd : open, title: suggest ? tx("\u628A\u300C{{title}}\u300D\u5E26\u8FDB\u5BF9\u8BDD", { title: r.title }) : r.title }, r.title), r.note && /* @__PURE__ */ h("small", null, r.note), onRemove && /* @__PURE__ */ h("button", { type: "button", className: "tbx-chip-x", "aria-label": ta("\u79FB\u9664\u5F15\u7528"), onClick: onRemove }, /* @__PURE__ */ h(Glyph3, { name: "close", size: 11, stroke: 2.2 })));
  }
  function UserMessage({ m }) {
    return /* @__PURE__ */ h("article", { className: "tbx-msg is-user" }, /* @__PURE__ */ h("div", { className: "tbx-bubble" }, /* @__PURE__ */ h("p", null, m.text), m.references.length > 0 && /* @__PURE__ */ h("div", { className: "tbx-chips is-sent" }, m.references.map((r, i) => /* @__PURE__ */ h(RefChip, { key: i, r: { kind: r.input.kind, id: r.input.id, title: r.title } })))));
  }
  function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    return /* @__PURE__ */ h("button", { className: cx("tbx-meta-btn", copied && "is-done"), "aria-label": tx("\u590D\u5236"), title: copied ? tx("\u5DF2\u590D\u5236") : tx("\u590D\u5236"), onClick: () => {
      navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } }, /* @__PURE__ */ h("span", { className: "tbx-morph" }, /* @__PURE__ */ h(Glyph3, { name: "copy", size: 15 }), /* @__PURE__ */ h(Glyph3, { name: "check", size: 15, stroke: 2.2 })));
  }
  function AssistantMessage({ m, agent, last, onRegenerate, model }) {
    const streaming = m.state === "streaming";
    return /* @__PURE__ */ h("article", { className: cx("tbx-msg is-assistant", streaming && "is-streaming", last && "is-last") }, /* @__PURE__ */ h(Prose, { text: m.text }), streaming && /* @__PURE__ */ h("span", { className: "tbx-typing", "aria-hidden": "true" }), (m.cards ?? []).length > 0 && /* @__PURE__ */ h("div", { className: "tbx-cards" }, m.cards.map((c, i) => /* @__PURE__ */ h(ResultCard, { key: i, card: c, cardKey: `${m.id}:${i}`, agent }))), m.state === "partial" && /* @__PURE__ */ h("p", { className: "tbx-msg-note" }, tx("\u56DE\u7B54\u88AB\u505C\u6B62\u4E86\uFF0C\u53EA\u4FDD\u7559\u4E86\u524D\u9762\u7684\u90E8\u5206\u3002")), !streaming && m.text && /* @__PURE__ */ h("div", { className: "tbx-meta" }, /* @__PURE__ */ h(CopyButton, { text: m.text }), last && onRegenerate && /* @__PURE__ */ h("button", { className: "tbx-meta-btn", "aria-label": tx("\u91CD\u65B0\u56DE\u7B54"), title: tx("\u91CD\u65B0\u56DE\u7B54"), onClick: onRegenerate }, /* @__PURE__ */ h(Glyph3, { name: "retry", size: 15 })), /* @__PURE__ */ h("span", { className: "tbx-meta-text tbx-num" }, clock(m.createdAt), model ? ` \xB7 ${model}` : "")));
  }
  function Divider({ children, tone }) {
    return /* @__PURE__ */ h("div", { className: cx("tbx-divider", tone && `is-${tone}`) }, /* @__PURE__ */ h("span", null, children));
  }
  function ModelPicker({ agent }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useOutside(open, ref, () => setOpen(false));
    const current = MODELS.find((m) => m.id === agent.model) || MODELS[0];
    return /* @__PURE__ */ h("span", { className: "tbx-model", ref }, /* @__PURE__ */ h("button", { type: "button", className: "tbx-model-button", onClick: () => setOpen(!open), "aria-haspopup": "listbox", "aria-expanded": open, "aria-label": ta("\u9009\u62E9\u6A21\u578B") }, /* @__PURE__ */ h("span", { className: "tbx-model-dot" }), current.name, /* @__PURE__ */ h(Glyph3, { name: "chevron", size: 13 })), open && /* @__PURE__ */ h("div", { className: "tbx-model-menu", role: "listbox" }, MODELS.map((m) => {
      const ready = agent.configuration?.models.find((x) => x.id === m.id)?.state === "ready";
      return /* @__PURE__ */ h(
        "button",
        {
          key: m.id,
          type: "button",
          role: "option",
          "aria-selected": m.id === agent.model,
          disabled: !ready,
          className: cx("tbx-model-option", m.id === agent.model && "is-selected"),
          onClick: () => {
            agent.setModel(m.id);
            setOpen(false);
          }
        },
        /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("strong", null, m.name), /* @__PURE__ */ h("small", null, ready ? m.note : tx("\u6682\u4E0D\u53EF\u7528"))),
        m.id === agent.model && /* @__PURE__ */ h(Glyph3, { name: "check", size: 15 })
      );
    })));
  }
  function MentionMenu({ query, onPick, onClose }) {
    const [rows, setRows] = useState(null);
    const [active, setActive] = useState(0);
    const ref = useRef(null);
    useOutside(true, ref, onClose);
    useEffect(() => {
      let live = true;
      const q = query.trim();
      (async () => {
        const [questions, lessons, resources] = await Promise.all([
          call("GET", `/api/modules/questions/v2/items${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => r.items).catch(() => []),
          loadLessons(true),
          call("GET", "/api/modules/resources/items").then((r) => r.items ?? r).catch(() => [])
        ]);
        const match = (s) => !q || String(s).toLowerCase().includes(q.toLowerCase());
        const out = [
          ...questions.slice(0, 5).map((x) => ({ kind: "question", id: x.id, version: x.version, title: x.title || tx("\u672A\u547D\u540D\u9898\u76EE") })),
          ...lessons.filter((x) => match(x.title)).slice(0, 4).map((x) => ({ kind: "entry", id: x.id, title: x.title, note: whenLabel(x) })),
          ...(Array.isArray(resources) ? resources : []).filter((x) => match(x.title)).slice(0, 4).map((x) => ({ kind: "resource", id: x.id, title: x.title || tx("\u8D44\u6599") }))
        ];
        if (live) {
          setRows(out);
          setActive(0);
        }
      })();
      return () => {
        live = false;
      };
    }, [query]);
    useEffect(() => {
      const key2 = (e) => {
        if (!rows?.length) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((a) => (a + 1) % rows.length);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((a) => (a - 1 + rows.length) % rows.length);
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          onPick(rows[active]);
        }
      };
      document.addEventListener("keydown", key2, true);
      return () => document.removeEventListener("keydown", key2, true);
    }, [rows, active]);
    let lastKind = null;
    return /* @__PURE__ */ h("div", { className: "tbx-mention", ref, role: "listbox", "aria-label": tx("\u5F15\u7528\u5DE5\u4F5C\u53F0\u91CC\u7684\u5185\u5BB9") }, rows === null && /* @__PURE__ */ h("p", { className: "tbx-mention-empty" }, tx("\u6B63\u5728\u627E\u2026")), rows?.length === 0 && /* @__PURE__ */ h("p", { className: "tbx-mention-empty" }, query ? tx("\u6CA1\u6709\u627E\u5230\u201C{{query}}\u201D\u3002", { query }) : tx("\u6CA1\u6709\u627E\u5230\u53EF\u4EE5\u5F15\u7528\u7684\u5185\u5BB9\u3002")), rows?.map((r, i) => {
      const head = r.kind !== lastKind ? KIND[r.kind].label : null;
      lastKind = r.kind;
      return /* @__PURE__ */ h(Fragment, { key: `${r.kind}:${r.id}` }, head && /* @__PURE__ */ h("h4", null, head), /* @__PURE__ */ h("button", { type: "button", role: "option", "aria-selected": i === active, className: cx("tbx-mention-row", i === active && "is-active"), onMouseEnter: () => setActive(i), onClick: () => onPick(r) }, /* @__PURE__ */ h("span", { className: cx("tbx-mention-icon", `is-${KIND[r.kind].hue}`) }, /* @__PURE__ */ h(Glyph3, { name: KIND[r.kind].glyph, size: 14 })), /* @__PURE__ */ h("span", { className: "tbx-mention-title" }, r.title), r.note && /* @__PURE__ */ h("small", null, r.note)));
    }));
  }
  function Composer({ agent, running, ready, variant, autoFocus, focusKey, context }) {
    const { draft } = agent;
    const area = useRef(null);
    const [mention, setMention] = useState(null);
    useLayoutEffect(() => {
      const el = area.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, variant === "panel" ? 180 : 240)}px`;
    }, [draft?.text, variant]);
    useEffect(() => {
      if (autoFocus || focusKey) area.current?.focus();
    }, [autoFocus, focusKey, Boolean(draft)]);
    if (!draft) return null;
    const refs = draft.references;
    const canSend = ready && !agent.busy && !agent.conflict && draft.text.trim();
    useRefTitles(refs);
    const suggest = context?.id && !refs.some((r) => r.kind === context.kind && r.id === context.id) ? context : null;
    function addRef(r) {
      const input = r.kind === "question" ? { kind: r.kind, id: r.id, version: r.version } : { kind: r.kind, id: r.id };
      remember(r);
      agent.edit({ references: [...refs.filter((x) => !(x.kind === r.kind && x.id === r.id)), input] });
    }
    function pick3(r) {
      if (r) addRef(r);
      const text = draft.text.replace(/@([^\s@]*)$/, "");
      if (text !== draft.text) agent.edit({ text });
      setMention(null);
      area.current?.focus();
    }
    return /* @__PURE__ */ h("div", { className: cx("tbx-composer-shell", (refs.length || suggest) && "has-drawer") }, /* @__PURE__ */ h("form", { className: cx("tbx-composer", running && "is-running"), onSubmit: (e) => {
      e.preventDefault();
      if (canSend && !running) sendReliably();
    } }, mention && /* @__PURE__ */ h(MentionMenu, { query: mention.query, onPick: pick3, onClose: () => setMention(null) }), /* @__PURE__ */ h(
      "textarea",
      {
        ref: area,
        className: "tbx-input",
        "aria-label": ta("AI \u8F93\u5165"),
        placeholder: tx(variant === "panel" ? "\u95EE\u4E00\u4E2A\u95EE\u9898\uFF0C\u6216\u8F93\u5165 @ \u5F15\u7528\u9898\u76EE\u3001\u65E5\u7A0B" : "\u63CF\u8FF0\u4F60\u60F3\u51C6\u5907\u7684\u8BFE\u3001\u60F3\u8BA8\u8BBA\u7684\u9898\uFF0C\u8F93\u5165 @ \u5F15\u7528\u5DE5\u4F5C\u53F0\u91CC\u7684\u5185\u5BB9"),
        value: draft.text,
        rows: 1,
        onChange: (e) => {
          const text = e.target.value;
          agent.edit({ text });
          const m = /@([^\s@]*)$/.exec(text.slice(0, e.target.selectionStart));
          setMention(m ? { query: m[1] } : null);
        },
        onKeyDown: (e) => {
          if (mention && ["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(e.key)) return;
          if (e.key === "Escape" && mention) {
            setMention(null);
            return;
          }
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!running && canSend) sendReliably();
          }
        }
      }
    ), /* @__PURE__ */ h("div", { className: "tbx-composer-bar" }, /* @__PURE__ */ h(ModelPicker, { agent }), /* @__PURE__ */ h("button", { type: "button", className: "tbx-tool-btn", "aria-label": tx("\u5F15\u7528\u5DE5\u4F5C\u53F0\u91CC\u7684\u5185\u5BB9"), title: tx("\u5F15\u7528\u9898\u76EE\u3001\u65E5\u7A0B\u6216\u8D44\u6599"), onClick: () => setMention(mention ? null : { query: "" }) }, /* @__PURE__ */ h(Glyph3, { name: "at", size: 17 })), running ? /* @__PURE__ */ h("button", { type: "button", className: "tbx-send is-stop", onClick: () => agent.stop(running), "aria-label": ta("\u505C\u6B62"), title: tx("\u505C\u6B62") }, /* @__PURE__ */ h(Glyph3, { name: "stop", size: 13, stroke: 0 })) : /* @__PURE__ */ h("button", { type: "submit", className: "tbx-send", disabled: !canSend, "aria-label": ta("\u53D1\u9001"), title: tx("\u53D1\u9001") }, /* @__PURE__ */ h(Glyph3, { name: "arrowUp", size: 17, stroke: 2.2 })))), (refs.length > 0 || suggest) && /* @__PURE__ */ h("div", { className: "tbx-drawer" }, refs.map((r, i) => {
      const known = REF_TITLES.get(`${r.kind}:${r.id}`) ?? (context?.id === r.id ? context : null);
      return /* @__PURE__ */ h(RefChip, { key: `${r.kind}:${r.id}`, r: { ...r, title: known?.title ?? KIND[r.kind]?.label ?? tx("\u5F15\u7528"), note: known?.note }, onRemove: () => agent.edit({ references: refs.filter((_, j) => j !== i) }) });
    }), suggest && /* @__PURE__ */ h(Fragment, null, !refs.length && /* @__PURE__ */ h("span", { className: "tbx-drawer-label" }, tx("\u6B63\u5728\u770B")), /* @__PURE__ */ h(RefChip, { r: suggest, suggest: true, onAdd: () => addRef(suggest) }))), !ready && agent.configuration && /* @__PURE__ */ h("div", { className: "tbx-composer-note" }, ta("AI \u6682\u4E0D\u53EF\u7528")), agent.configuration?.activeTurn && agent.configuration.activeTurn.conversationId !== agent.id && /* @__PURE__ */ h("button", { className: "tbx-composer-note is-link", type: "button", onClick: () => agent.select(agent.configuration.activeTurn.conversationId) }, tx("\u53E6\u4E00\u6BB5\u5BF9\u8BDD\u6B63\u5728\u56DE\u7B54\uFF0C\u53BB\u770B\u770B")));
  }
  function LessonPicker({ lessons, lesson, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useOutside(open, ref, () => setOpen(false));
    return /* @__PURE__ */ h("span", { className: "tbx-inline-pick", ref }, /* @__PURE__ */ h("button", { type: "button", className: "tbx-inline-button", onClick: () => setOpen(!open), "aria-expanded": open }, lesson ? lesson.title : tx("\u54EA\u8282\u8BFE")), open && /* @__PURE__ */ h("div", { className: "tbx-pick-menu", role: "listbox" }, /* @__PURE__ */ h("h4", null, tx("\u63A5\u4E0B\u6765\u7684\u8BFE")), lessons.map((l) => /* @__PURE__ */ h("button", { key: l.id, role: "option", "aria-selected": lesson?.id === l.id, className: cx("tbx-pick-row", lesson?.id === l.id && "is-selected"), onClick: () => {
      onChange(l);
      setOpen(false);
    } }, /* @__PURE__ */ h("span", { className: "tbx-pick-when tbx-num" }, whenLabel(l)), /* @__PURE__ */ h("span", { className: "tbx-pick-title" }, l.title, l.todo[0] ? /* @__PURE__ */ h("small", null, l.todo[0]) : null), lesson?.id === l.id && /* @__PURE__ */ h(Glyph3, { name: "check", size: 15 }))), /* @__PURE__ */ h("button", { className: cx("tbx-pick-row is-plain", !lesson && "is-selected"), onClick: () => {
      onChange(null);
      setOpen(false);
    } }, /* @__PURE__ */ h("span", { className: "tbx-pick-title" }, tx("\u4E0D\u9488\u5BF9\u67D0\u8282\u8BFE")), !lesson && /* @__PURE__ */ h(Glyph3, { name: "check", size: 15 }))));
  }
  function lessonSuggestions(lesson) {
    const topic = `${lesson.title} ${lesson.todo.join(" ")}`;
    const func = /二次函数|抛物线|顶点/.test(topic);
    return [
      { icon: "list", title: "\u68B3\u7406\u8FD9\u8282\u8BFE\u7684\u8BB2\u89E3\u987A\u5E8F", prompt: "\u5E2E\u6211\u68B3\u7406\u8FD9\u8282\u8BFE\u7684\u8BB2\u89E3\u987A\u5E8F" },
      { icon: "search", title: "\u627E\u51E0\u9053\u8BFE\u5802\u7EC3\u4E60\u9898", prompt: "\u4E3A\u8FD9\u8282\u8BFE\u627E 3 \u9053\u8BFE\u5802\u7EC3\u4E60\u9898" },
      func ? { icon: "graph", title: "\u6784\u601D\u4E00\u4E2A\u8BFE\u5802\u6F14\u793A", prompt: "\u4E3A\u8FD9\u8282\u8BFE\u6784\u601D\u4E00\u4E2A\u629B\u7269\u7EBF\u6F14\u793A" } : { icon: "chat", title: "\u8BA8\u8BBA\u4E00\u9053\u9898\u7684\u4E0D\u540C\u8BB2\u6CD5", prompt: "\u8FD9\u8282\u8BFE\u7684\u4F8B\u9898\uFF0C\u6709\u54EA\u51E0\u79CD\u8BB2\u6CD5\uFF1F" },
      { icon: "layers", title: "\u8BBE\u8BA1\u4E00\u7EC4\u5206\u5C42\u4F5C\u4E1A", prompt: "\u4E3A\u8FD9\u8282\u8BFE\u8BBE\u8BA1\u4E00\u7EC4\u5206\u5C42\u4F5C\u4E1A" }
    ];
  }
  function Hero({ lessons, lesson, setLesson }) {
    return /* @__PURE__ */ h("div", { className: "tbx-hero" }, /* @__PURE__ */ h("div", { className: "tbx-welcome-mark", "aria-hidden": "true" }, /* @__PURE__ */ h("span", { className: "tbx-dot is-yellow" }), /* @__PURE__ */ h("span", { className: "tbx-dot is-blue" }), /* @__PURE__ */ h("span", { className: "tbx-dot is-coral" })), lessons.length ? isEnglish() ? /* @__PURE__ */ h("h1", null, greeting(), ". ", tx("What shall we prepare for"), " ", /* @__PURE__ */ h(LessonPicker, { lessons, lesson, onChange: setLesson }), /* @__PURE__ */ h("span", { className: "tbx-nowrap" }, "?")) : /* @__PURE__ */ h("h1", null, greeting(), "\uFF0C\u60F3\u4E3A ", /* @__PURE__ */ h(LessonPicker, { lessons, lesson, onChange: setLesson }), " ", /* @__PURE__ */ h("span", { className: "tbx-nowrap" }, "\u51C6\u5907\u70B9\u4EC0\u4E48\uFF1F")) : /* @__PURE__ */ h("h1", null, isEnglish() ? `${greeting()}. ${tx("\u4ECA\u5929\u60F3\u51C6\u5907\u4EC0\u4E48\uFF1F")}` : `${greeting()}\uFF0C\u4ECA\u5929\u60F3\u51C6\u5907\u4EC0\u4E48\uFF1F`), /* @__PURE__ */ h("p", null, lesson ? `${whenLabel(lesson)} \xB7 ${lesson.todo.length ? lesson.todo.join(isEnglish() ? ", " : "\u3001") : tx("\u8FD8\u6CA1\u6709\u5199\u51C6\u5907\u4E8B\u9879")}` : tx("\u5907\u8BFE\u601D\u8DEF\u3001\u4E00\u9053\u9898\u7684\u8BB2\u6CD5\u3001\u4E00\u4E2A\u8BFE\u5802\u6F14\u793A\uFF0C\u90FD\u53EF\u4EE5\u4ECE\u8FD9\u91CC\u5F00\u59CB\u3002")));
  }
  function PanelWelcome({ context, onPrompt, busy }) {
    const list = context?.kind === "question" ? [["chat", "\u8FD9\u9053\u9898\u600E\u4E48\u8BB2"], ["search", "\u627E\u51E0\u9053\u76F8\u4F3C\u7684\u9898"], ["layers", "\u51FA\u4E00\u9053\u53D8\u5F0F\u9898"]] : context?.area === "calendar" ? [["calendar", "\u660E\u5929\u6709\u4EC0\u4E48\u8BFE"], ["list", "\u5E2E\u6211\u5907\u4E0B\u4E00\u8282\u8BFE"], ["layers", "\u4E3A\u4E0B\u4E00\u8282\u8BFE\u8BBE\u8BA1\u5206\u5C42\u4F5C\u4E1A"]] : context?.area === "math" ? [["graph", "\u6784\u601D\u4E00\u4E2A\u629B\u7269\u7EBF\u6F14\u793A"], ["chat", "\u600E\u4E48\u8BB2\u4E8C\u6B21\u51FD\u6570\u7684\u5E73\u79FB"]] : [["list", "\u68B3\u7406\u4E00\u8282\u8BFE\u7684\u8BB2\u89E3\u987A\u5E8F"], ["search", "\u627E\u51E0\u9053\u538B\u8F74\u9898"], ["calendar", "\u4ECA\u5929\u6709\u4EC0\u4E48\u5B89\u6392"]];
    return /* @__PURE__ */ h("div", { className: "tbx-panel-welcome" }, /* @__PURE__ */ h("h2", null, tx("\u6709\u4EC0\u4E48\u53EF\u4EE5\u5E2E\u4F60\uFF1F")), /* @__PURE__ */ h("p", null, context?.title ? tx("\u6211\u80FD\u770B\u5230\u4F60\u6B63\u5728\u770B\u300C{{title}}\u300D\u3002", { title: context.title }) : tx("\u95EE\u4E00\u4E2A\u95EE\u9898\uFF0C\u6216\u8005\u4ECE\u4E0B\u9762\u5F00\u59CB\u3002")), /* @__PURE__ */ h("div", { className: "tbx-quick" }, list.map(([icon, text], i) => /* @__PURE__ */ h("button", { key: text, style: { "--i": i }, disabled: busy, onClick: () => onPrompt(tx(text), context?.id && context.kind !== "resource" ? context : null) }, /* @__PURE__ */ h(Glyph3, { name: icon, size: 15 }), tx(text)))));
  }
  function DemoSeed({ onSeeded }) {
    const { navigate } = tb();
    const [state, setState] = useState(globalThis.__tbxSeeded ? "done" : "idle");
    async function run() {
      setState("running");
      try {
        await seedDemo();
        globalThis.__tbxSeeded = true;
        setState("done");
        onSeeded?.();
      } catch {
        setState("error");
      }
    }
    if (state === "done") {
      return /* @__PURE__ */ h("p", { className: "tbx-demo is-done" }, /* @__PURE__ */ h(Glyph3, { name: "check", size: 15 }), tx("\u793A\u4F8B\u6570\u636E\u5DF2\u5C31\u7EEA\uFF1A7 \u9053\u9898\u30014 \u4EFD\u8D44\u6599\u548C\u4E00\u5468\u7684\u8BFE\u8868\u3002"), /* @__PURE__ */ h("button", { onClick: () => navigate("/questions") }, tx("\u53BB\u9898\u5E93")), /* @__PURE__ */ h("button", { onClick: () => navigate("/calendar") }, tx("\u770B\u65E5\u7A0B")));
    }
    return /* @__PURE__ */ h("p", { className: "tbx-demo" }, tx("\u7B2C\u4E00\u6B21\u6765\uFF1F"), /* @__PURE__ */ h("button", { onClick: run, disabled: state === "running" }, state === "running" ? tx("\u6B63\u5728\u8F7D\u5165\u2026") : tx("\u8F7D\u5165\u4E00\u5468\u7684\u793A\u4F8B\u6570\u636E")), tx("\uFF0C\u770B\u770B\u5DE5\u4F5C\u53F0\u88C5\u6EE1\u65F6\u7684\u6837\u5B50\u3002"), state === "error" ? tx("\u8F7D\u5165\u6CA1\u6709\u5B8C\u6210\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002") : "");
  }
  function Suggestions({ items, busy, onPrompt }) {
    return /* @__PURE__ */ h("div", { className: "tbx-suggestions" }, items.map((s, i) => /* @__PURE__ */ h("button", { key: s.title, className: "tbx-suggestion", style: { "--i": i }, disabled: busy, onClick: () => onPrompt(tx(s.prompt)) }, /* @__PURE__ */ h("span", { className: "tbx-suggestion-icon" }, /* @__PURE__ */ h(Glyph3, { name: s.icon, size: 17 })), /* @__PURE__ */ h("span", { className: "tbx-suggestion-title" }, tx(s.title)), /* @__PURE__ */ h("span", { className: "tbx-suggestion-prompt" }, tx(s.prompt)))));
  }
  function PanelHead({ agent }) {
    const { navigate } = tb();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useOutside(open, ref, () => setOpen(false));
    const title = agent.snapshot?.messages?.length ? threadTitle(agent.snapshot.conversation.title) : tx("\u65B0\u5BF9\u8BDD");
    return /* @__PURE__ */ h("header", { className: "tbx-agent-head" }, /* @__PURE__ */ h("span", { className: "tbx-switch", ref }, /* @__PURE__ */ h("button", { className: "tbx-switch-button", onClick: () => setOpen(!open), "aria-expanded": open, "aria-haspopup": "listbox" }, /* @__PURE__ */ h("span", null, title), /* @__PURE__ */ h(Glyph3, { name: "chevron", size: 14 })), open && /* @__PURE__ */ h("div", { className: "tbx-switch-menu", role: "listbox" }, /* @__PURE__ */ h("h4", null, tx("\u6700\u8FD1\u7684\u5BF9\u8BDD")), agent.list.length === 0 && /* @__PURE__ */ h("p", { className: "tbx-mention-empty" }, tx("\u8FD8\u6CA1\u6709\u5BF9\u8BDD\u3002")), agent.list.slice(0, 8).map((item) => /* @__PURE__ */ h("button", { key: item.id, role: "option", "aria-selected": item.id === agent.id, className: cx("tbx-switch-row", item.id === agent.id && "is-selected"), onClick: () => {
      agent.select(item.id);
      setOpen(false);
    } }, /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("strong", null, threadTitle(item.title)), /* @__PURE__ */ h("small", null, item.preview || tx("\u8FD8\u6CA1\u6709\u56DE\u7B54"))), /* @__PURE__ */ h("span", { className: "tbx-thread-time" }, relativeTime(item.updatedAt)))), agent.list.length > 0 && /* @__PURE__ */ h("button", { className: "tbx-switch-all", onClick: () => {
      setOpen(false);
      navigate("/");
    } }, tx("\u5728\u9996\u9875\u67E5\u770B\u5168\u90E8\u5BF9\u8BDD"), /* @__PURE__ */ h(Glyph3, { name: "chevronRight", size: 13 })))), /* @__PURE__ */ h("button", { className: "tbx-icon-btn", title: tx("\u65B0\u5BF9\u8BDD"), "aria-label": tx("\u65B0\u5BF9\u8BDD"), onClick: agent.create, disabled: agent.busy }, /* @__PURE__ */ h(Glyph3, { name: "compose", size: 17 })), /* @__PURE__ */ h("button", { className: "tbx-icon-btn", title: tx("\u5728\u9996\u9875\u6253\u5F00"), "aria-label": tx("\u5728\u9996\u9875\u6253\u5F00"), onClick: () => navigate("/") }, /* @__PURE__ */ h(Glyph3, { name: "expand", size: 16 })));
  }
  function AgentWorkspace({ variant = "panel" }) {
    useLocale();
    const { useAgent, agentLabels, isDeletedAccount } = tb();
    const agent = useAgent();
    latestAgent.current = agent;
    const thread = useRef(null);
    const dockRef = useRef(null);
    const nearBottom = useRef(true);
    const pending2 = useRef(null);
    const [newMessages, setNewMessages] = useState(false);
    const [focusComposer, setFocusComposer] = useState(0);
    const [dockH, setDockH] = useState(140);
    const [lessons, refreshLessons] = useLessons(agent.businessRevision);
    const [lesson, setLesson] = useState(null);
    const context = useCurrentContext(variant === "panel");
    const { snapshot, draft } = agent;
    useEffect(() => {
      const area = thread.current;
      if (!area) return;
      try {
        area.scrollTop = Number(globalThis.__teachbuddyLocalStorage.getItem(agent.prefix + agent.id + ":scroll") ?? area.scrollHeight);
      } catch {
      }
      nearBottom.current = area.scrollHeight - area.clientHeight - area.scrollTop < 160;
    }, [agent.id, Boolean(snapshot)]);
    const seenSeq = useRef({ id: null, seq: 0 });
    const autoScroll = useRef(false);
    const lastMsg = snapshot?.messages?.[snapshot.messages.length - 1];
    const growth = `${snapshot?.messages?.length ?? 0}:${lastMsg?.text?.length ?? 0}:${lastMsg?.cards?.length ?? 0}:${snapshot?.toolCalls?.length ?? 0}`;
    useEffect(() => {
      if (!thread.current) return;
      const first = seenSeq.current.id !== agent.id;
      seenSeq.current = { id: agent.id, seq: snapshot?.lastEventSeq ?? 0 };
      if (first) return;
      if (nearBottom.current) {
        autoScroll.current = true;
        thread.current.scrollTop = thread.current.scrollHeight;
        setNewMessages(false);
      } else setNewMessages(true);
    }, [growth]);
    useEffect(() => {
      if (!agent.draft || pending2.current === null) return;
      const { text, refs } = pending2.current;
      pending2.current = null;
      agent.edit({ text, ...refs ? { references: refs } : {} });
      setFocusComposer((n) => n + 1);
    }, [Boolean(agent.draft), agent.id]);
    useLayoutEffect(() => {
      const el = dockRef.current;
      if (!el || typeof ResizeObserver === "undefined") return void 0;
      const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
      ro.observe(el);
      return () => ro.disconnect();
    });
    const running = snapshot?.turns.find((x) => x.state === "running");
    const ready = agent.configuration?.models.find((m) => m.id === agent.model)?.state === "ready";
    const empty = !snapshot?.messages?.length;
    const modelName = (id) => MODELS.find((m) => m.id === id)?.name;
    const lessonRef = lesson ? { kind: "entry", id: lesson.id } : null;
    if (lesson) remember({ kind: "entry", id: lesson.id, title: lesson.title, note: whenLabel(lesson) });
    function prompt(text, ctx) {
      const refFrom = (c) => c.kind === "question" ? { kind: "question", id: c.id, version: c.version } : { kind: c.kind, id: c.id };
      if (ctx) remember(ctx);
      const extra = ctx ? refFrom(ctx) : lessonRef;
      if (agent.draft) {
        const refs = agent.draft.references.filter((r) => !(extra && r.kind === extra.kind && r.id === extra.id));
        agent.edit({ text, references: extra ? [...refs, extra] : refs });
        setFocusComposer((n) => n + 1);
      } else {
        pending2.current = { text, refs: extra ? [extra] : null };
        void agent.create();
      }
    }
    function regenerate(turn) {
      const user = snapshot.messages.find((m) => m.id === turn.userMessageId);
      if (!user) return;
      agent.edit({ text: user.text, references: user.references.map((r) => r.input) });
      setTimeout(sendReliably, 0);
    }
    useEffect(() => {
      if (!lesson || !agent.draft || !empty) return;
      if (agent.draft.references.some((r) => r.kind === "entry" && r.id === lesson.id)) return;
      agent.edit({ references: [...agent.draft.references.filter((r) => r.kind !== "entry"), lessonRef] });
    }, [lesson?.id, Boolean(agent.draft), agent.id]);
    const lastTurn = snapshot?.turns[snapshot.turns.length - 1];
    const dock = /* @__PURE__ */ h("div", { className: "tbx-dock", ref: dockRef }, agent.sendPending && /* @__PURE__ */ h("div", { className: "tbx-notice" }, ta("\u53D1\u9001\u7ED3\u679C\u5F85\u786E\u8BA4"), /* @__PURE__ */ h("button", { className: "tbx-btn is-small", onClick: agent.send, disabled: agent.busy }, ta("\u786E\u8BA4\u53D1\u9001\u7ED3\u679C"))), agent.error && /* @__PURE__ */ h("div", { className: "tbx-notice is-error", role: "alert" }, agent.error, /* @__PURE__ */ h("button", { className: "tbx-btn is-small", onClick: () => draft?.dirty ? agent.save() : agent.retry() }, ta("\u91CD\u8BD5"))), agent.conflict && /* @__PURE__ */ h("div", { className: "tbx-notice is-conflict" }, /* @__PURE__ */ h("strong", null, ta("\u8349\u7A3F\u5DF2\u5728\u5176\u4ED6\u8BBE\u5907\u4FEE\u6539")), /* @__PURE__ */ h("p", null, ta("\u672C\u673A\uFF1A"), draft.text), /* @__PURE__ */ h("p", null, ta("\u5DF2\u4FDD\u5B58\uFF1A"), agent.conflict.text), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("button", { className: "tbx-btn is-small", onClick: () => agent.chooseDraft(true) }, ta("\u4FDD\u7559\u672C\u673A\u5185\u5BB9")), /* @__PURE__ */ h("button", { className: "tbx-btn is-small", onClick: () => agent.chooseDraft(false) }, ta("\u91C7\u7528\u5DF2\u4FDD\u5B58\u5185\u5BB9")))), draft ? /* @__PURE__ */ h(Composer, { agent, running, ready, variant, autoFocus: variant === "home", focusKey: focusComposer, context }) : /* @__PURE__ */ h("div", { className: "tbx-composer-shell" }, /* @__PURE__ */ h("button", { className: "tbx-composer is-placeholder", onClick: () => {
      setFocusComposer((n) => n + 1);
      pending2.current = lessonRef ? { text: "", refs: [lessonRef] } : null;
      void agent.create();
    }, disabled: agent.busy }, /* @__PURE__ */ h("span", { className: "tbx-input-placeholder" }, tx(variant === "panel" ? "\u95EE\u4E00\u4E2A\u95EE\u9898\uFF0C\u6216\u8F93\u5165 @ \u5F15\u7528\u9898\u76EE\u3001\u65E5\u7A0B" : "\u63CF\u8FF0\u4F60\u60F3\u51C6\u5907\u7684\u8BFE\u3001\u60F3\u8BA8\u8BBA\u7684\u9898\uFF0C\u8F93\u5165 @ \u5F15\u7528\u5DE5\u4F5C\u53F0\u91CC\u7684\u5185\u5BB9")), /* @__PURE__ */ h("span", { className: "tbx-composer-bar" }, /* @__PURE__ */ h("span", null), /* @__PURE__ */ h("span", { className: "tbx-send", "aria-hidden": "true" }, /* @__PURE__ */ h(Glyph3, { name: "arrowUp", size: 17, stroke: 2.2 }))))));
    const heroSuggestions = lesson ? lessonSuggestions(lesson) : SUGGESTIONS;
    return /* @__PURE__ */ h("section", { className: cx("tbx-agent", empty && "is-empty"), "data-region": "ai-workspace", "data-variant": variant, style: { "--dock-h": `${dockH}px` } }, variant === "panel" && /* @__PURE__ */ h(PanelHead, { agent }), empty && variant === "home" ? /* @__PURE__ */ h("div", { className: "tbx-empty-stage" }, /* @__PURE__ */ h(Hero, { lessons, lesson, setLesson }), dock, /* @__PURE__ */ h(Suggestions, { items: heroSuggestions, busy: agent.busy, onPrompt: (text) => prompt(text) }), /* @__PURE__ */ h(DemoSeed, { onSeeded: refreshLessons })) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(
      "div",
      {
        className: "tbx-thread-area",
        ref: thread,
        "aria-label": ta("AI \u5BF9\u8BDD"),
        onScroll: () => {
          const area = thread.current;
          if (autoScroll.current) {
            autoScroll.current = false;
            nearBottom.current = true;
            return;
          }
          nearBottom.current = area.scrollHeight - area.clientHeight - area.scrollTop < 160;
          if (nearBottom.current) setNewMessages(false);
          try {
            if (!isDeletedAccount(agent.accountKey)) globalThis.__teachbuddyLocalStorage.setItem(agent.prefix + agent.id + ":scroll", String(area.scrollTop));
          } catch {
          }
        }
      },
      /* @__PURE__ */ h("div", { className: "tbx-thread-inner" }, empty && /* @__PURE__ */ h(PanelWelcome, { context, busy: agent.busy, onPrompt: prompt }), snapshot?.turns.map((turn) => {
        const assistant = snapshot.messages.filter((m) => m.turnId === turn.id && m.role === "assistant");
        const calls = snapshot.toolCalls.filter((c) => c.turnId === turn.id).sort((a, b) => a.ordinal - b.ordinal);
        const answered = assistant.some((m) => m.text);
        const working = turn.state === "running" && !answered && !calls.some((c) => c.state === "executing");
        return /* @__PURE__ */ h("section", { className: "tbx-turn", key: turn.id }, snapshot.messages.filter((m) => m.turnId === turn.id && m.role === "user").map((m) => /* @__PURE__ */ h(UserMessage, { key: m.id, m })), /* @__PURE__ */ h(WorkLog, { calls, turn, answered }), working && /* @__PURE__ */ h("div", { className: "tbx-working" }, /* @__PURE__ */ h(Shimmer, null, calls.length ? tx("\u6B63\u5728\u6574\u7406") : tx("\u6B63\u5728\u601D\u8003")), /* @__PURE__ */ h("span", { className: "tbx-working-time" }, "\xB7 ", /* @__PURE__ */ h(Elapsed, { from: turn.createdAt }))), assistant.filter((m) => m.text || m.state !== "streaming").map((m) => /* @__PURE__ */ h(AssistantMessage, { key: m.id, m, agent, model: modelName(turn.modelId), last: turn === lastTurn && !running, onRegenerate: () => regenerate(turn) })), turn.state !== "running" && turn.state !== "completed" && /* @__PURE__ */ h(Divider, { tone: "muted" }, agentLabels.reasons[turn.reason] ? tx(agentLabels.reasons[turn.reason]) : tx("\u5DF2\u505C\u6B62")));
      }))
    ), newMessages && /* @__PURE__ */ h("button", { className: "tbx-new-messages", onClick: () => {
      thread.current.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" });
      nearBottom.current = true;
      setNewMessages(false);
    } }, /* @__PURE__ */ h(Glyph3, { name: "arrowDown", size: 14, stroke: 2.2 }), tx("\u65B0\u6D88\u606F")), dock));
  }
  function Home({ returnPath }) {
    useLocale();
    const { useAgent, navigate } = tb();
    const agent = useAgent();
    const [threadsOpen, setThreadsOpen] = useState(false);
    useEffect(() => {
      const onKey = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && !e.shiftKey) {
          e.preventDefault();
          void agent.create();
        }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [agent.create]);
    const hasMessages = Boolean(agent.snapshot?.messages?.length);
    return /* @__PURE__ */ h("div", { className: cx("tbx-home", threadsOpen && "is-threads-open") }, /* @__PURE__ */ h(ThreadList, { onPick: () => setThreadsOpen(false) }), /* @__PURE__ */ h("div", { className: "tbx-home-main" }, /* @__PURE__ */ h("div", { className: "tbx-home-bar" }, /* @__PURE__ */ h("button", { className: "tbx-icon-btn tbx-threads-toggle", onClick: () => setThreadsOpen(!threadsOpen), "aria-label": tx("\u5BF9\u8BDD\u5217\u8868") }, /* @__PURE__ */ h(Glyph3, { name: "list", size: 17 })), /* @__PURE__ */ h("span", { className: "tbx-home-title" }, hasMessages ? threadTitle(agent.snapshot.conversation.title) : ""), returnPath && /* @__PURE__ */ h("button", { className: "tbx-btn is-ghost is-small", onClick: () => navigate(returnPath) }, /* @__PURE__ */ h(Glyph3, { name: "back", size: 14 }), tx("\u8FD4\u56DE\u5DE5\u4F5C"))), /* @__PURE__ */ h(AgentWorkspace, { variant: "home" })));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/shell/AuxPanel.jsx
  var tw3 = tx;
  function AuxPanel({ hidden = false, available = true }) {
    useLocale();
    const { useWorkbenchShell, Icon2: Icon22 } = tb();
    const shell = useWorkbenchShell();
    const { tools } = shell;
    const activeTool = tools.find((tool) => tool.id === shell.panelMode);
    const mode = activeTool ? activeTool.id : "ai";
    const open = !hidden && available;
    return /* @__PURE__ */ h(
      "aside",
      {
        className: cx("wb-aux tbx-aux", open && "is-open"),
        "data-region": "auxiliary",
        "aria-label": tw3("\u8F85\u52A9\u680F"),
        "aria-hidden": open ? void 0 : true,
        inert: open ? void 0 : ""
      },
      /* @__PURE__ */ h("div", { className: "tbx-aux-inner" }, /* @__PURE__ */ h("header", { className: "wb-aux-head tbx-aux-head" }, /* @__PURE__ */ h("div", { className: "wb-tabs tbx-aux-tabs", role: "tablist", "aria-label": tw3("\u8F85\u52A9\u680F\u5185\u5BB9") }, /* @__PURE__ */ h("button", { type: "button", role: "tab", className: cx("wb-tab", mode === "ai" && "is-active"), "aria-selected": mode === "ai", onClick: () => shell.setPanelMode("ai") }, tw3("AI \u52A9\u7406")), tools.map((tool) => /* @__PURE__ */ h("button", { key: tool.id, type: "button", role: "tab", className: cx("wb-tab", mode === tool.id && "is-active"), "aria-selected": mode === tool.id, onClick: () => shell.setPanelMode(tool.id) }, tool.label))), /* @__PURE__ */ h("button", { type: "button", className: "tbx-aux-close", "aria-label": tw3("\u5173\u95ED\u8F85\u52A9\u680F"), title: tw3("\u5173\u95ED\u8F85\u52A9\u680F"), onClick: () => shell.closePanel() }, /* @__PURE__ */ h(Icon22, { name: "close", size: 16, strokeWidth: 1.75 }))), /* @__PURE__ */ h("div", { className: "wb-aux-body tbx-aux-body" }, /* @__PURE__ */ h("div", { hidden: mode !== "ai", style: mode !== "ai" ? { display: "none" } : { height: "100%" } }, shell.assistant ? shell.assistant() : /* @__PURE__ */ h(AgentWorkspace, { variant: "panel" })), mode !== "ai" && activeTool.render()))
    );
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/shell/glyphs.jsx
  function buildGlyphs() {
    const sidebarLeft = /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("rect", { x: "3", y: "4.5", width: "18", height: "15", rx: "3.5" }), /* @__PURE__ */ h("path", { d: "M9.5 4.5v15" }), /* @__PURE__ */ h("path", { d: "M5.6 8.2h1.5M5.6 10.9h1.5M5.6 13.6h1.5" }));
    const sidebarRight = /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("rect", { x: "3", y: "4.5", width: "18", height: "15", rx: "3.5" }), /* @__PURE__ */ h("path", { d: "M14.5 4.5v15" }), /* @__PURE__ */ h("path", { d: "M16.9 8.2h1.5M16.9 10.9h1.5M16.9 13.6h1.5" }));
    return {
      panelOpen: sidebarLeft,
      panelClose: sidebarLeft,
      sidebarLeft,
      sidebarRight,
      bell: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.6 1.7H4.9z" }), /* @__PURE__ */ h("path", { d: "M10 20.4a2.3 2.3 0 0 0 4 0" })),
      feedback: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M6 5h12a3 3 0 0 1 3 3v6.5a3 3 0 0 1-3 3h-6.2L7.5 20.6v-3.1H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" }), /* @__PURE__ */ h("path", { d: "M8 10h8M8 13h5" })),
      tutorial: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M12 3.2a6 6 0 0 0-3.7 10.7c.7.6 1.2 1.4 1.2 2.3h5c0-.9.5-1.7 1.2-2.3A6 6 0 0 0 12 3.2Z" }), /* @__PURE__ */ h("path", { d: "M9.6 18.6h4.8M10.6 21h2.8" })),
      shield: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M12 3.2 19 6v5.3c0 4.4-2.9 8-7 9.6-4.1-1.6-7-5.2-7-9.6V6z" }), /* @__PURE__ */ h("path", { d: "m9 12.1 2.1 2.1 4-4.4" })),
      trash: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M4.5 6.6h15" }), /* @__PURE__ */ h("path", { d: "M9.4 6.6V5.1c0-.9.7-1.6 1.6-1.6h2c.9 0 1.6.7 1.6 1.6v1.5" }), /* @__PURE__ */ h("path", { d: "m6.4 6.6.8 12.1a2 2 0 0 0 2 1.8h5.6a2 2 0 0 0 2-1.8l.8-12.1" }), /* @__PURE__ */ h("path", { d: "M10.1 10.6v5.8M13.9 10.6v5.8" })),
      calendar: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("rect", { x: "3.5", y: "5", width: "17", height: "15.5", rx: "3.5" }), /* @__PURE__ */ h("path", { d: "M3.5 10h17M8 3v4M16 3v4" }), /* @__PURE__ */ h("path", { d: "M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" })),
      book: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M6.5 3.5h11.2c.7 0 1.3.6 1.3 1.3v13.4c0 .7-.6 1.3-1.3 1.3H6.5A2.5 2.5 0 0 1 4 17V6a2.5 2.5 0 0 1 2.5-2.5Z" }), /* @__PURE__ */ h("path", { d: "M4 17a2.5 2.5 0 0 1 2.5-2.5H19" }), /* @__PURE__ */ h("path", { d: "M8.5 7.6h6M8.5 10.6h4" })),
      graph: /* @__PURE__ */ h("path", { d: "M3 12.8h3.2l3.1 7.2 5.2-16H21" }),
      /* narrowing a list: three lines, each shorter than the last */
      filter: /* @__PURE__ */ h("path", { d: "M4.5 7h15M7.5 12h9M10.5 17h3" }),
      paperclip: /* @__PURE__ */ h("path", { d: "m20 11.6-7.8 7.8a5.2 5.2 0 0 1-7.4-7.4l8.1-8.1a3.5 3.5 0 0 1 4.9 4.9l-8 8a1.75 1.75 0 0 1-2.5-2.5l7.3-7.3" }),
      /* the Math workshop's mark: a radical with x under it, everywhere the module appears */
      math: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M2.8 13.4h2.7l2.7 6.4 4.5-15.3H21.2" }), /* @__PURE__ */ h("path", { d: "m14.6 10.6 5 6.2M19.6 10.6l-5 6.2" })),
      folder: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M3.5 7.5a2 2 0 0 1 2-2h4.2l2 2.2h6.8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" }), /* @__PURE__ */ h("path", { d: "M3.5 10.6h17" })),
      // the same folder, its front flap tipped open (a folder you are inside)
      folderOpen: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M3.5 17.5V7.5a2 2 0 0 1 2-2h4.2l2 2.2h6.3a2 2 0 0 1 2 2v1" }), /* @__PURE__ */ h("path", { d: "M3.5 18.2 6 11.9a1.6 1.6 0 0 1 1.5-1h13a1 1 0 0 1 .94 1.35L19 18.7a2 2 0 0 1-1.88 1.3H5.4a1.9 1.9 0 0 1-1.9-1.8Z" })),
      // a kind of file (PDF, slides, image…): a page with a folded corner
      fileType: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" }), /* @__PURE__ */ h("path", { d: "M14 3.5V8h4.5" })),
      plus: /* @__PURE__ */ h("path", { d: "M12 5.5v13M5.5 12h13" }),
      minus: /* @__PURE__ */ h("path", { d: "M5.5 12h13" }),
      close: /* @__PURE__ */ h("path", { d: "m7 7 10 10M17 7 7 17" }),
      chevron: /* @__PURE__ */ h("path", { d: "m7.5 10 4.5 4.5 4.5-4.5" }),
      /* the assistant's mark, wherever the assistant is offered */
      sparkles: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M11 3.8c.7 4.3 2.9 6.5 7.2 7.2-4.3.7-6.5 2.9-7.2 7.2-.7-4.3-2.9-6.5-7.2-7.2 4.3-.7 6.5-2.9 7.2-7.2Z" }), /* @__PURE__ */ h("path", { d: "M18.6 15.6c.3 1.6 1 2.3 2.6 2.6-1.6.3-2.3 1-2.6 2.6-.3-1.6-1-2.3-2.6-2.6 1.6-.3 2.3-1 2.6-2.6Z" })),
      forward: /* @__PURE__ */ h("path", { d: "m10 7 5 5-5 5" }),
      select: /* @__PURE__ */ h("path", { d: "m8 9.5 4-4 4 4M8 14.5l4 4 4-4" }),
      home: /* @__PURE__ */ h("path", { d: "M4.5 10.6 12 4.4l7.5 6.2V19c0 .8-.7 1.5-1.5 1.5h-3.5v-6h-5v6H6c-.8 0-1.5-.7-1.5-1.5Z" }),
      language: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("circle", { cx: "12", cy: "12", r: "8.5" }), /* @__PURE__ */ h("path", { d: "M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5M12 3.5C9.6 5.9 8.6 8.7 8.6 12s1 6.1 3.4 8.5" })),
      pencil: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "m15.6 4.6 3.8 3.8L8.7 19.1l-4.6.8.8-4.6z" }), /* @__PURE__ */ h("path", { d: "m13.6 6.6 3.8 3.8" })),
      more: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("circle", { cx: "6", cy: "12", r: "1.2" }), /* @__PURE__ */ h("circle", { cx: "12", cy: "12", r: "1.2" }), /* @__PURE__ */ h("circle", { cx: "18", cy: "12", r: "1.2" })),
      restore: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3" }), /* @__PURE__ */ h("path", { d: "M4.5 4.5v3.8h3.8" })),
      undo: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M9 14.5 4.5 10 9 5.5" }), /* @__PURE__ */ h("path", { d: "M4.5 10H14a5.5 5.5 0 0 1 0 11h-3" })),
      redo: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "M15 14.5 19.5 10 15 5.5" }), /* @__PURE__ */ h("path", { d: "M19.5 10H10a5.5 5.5 0 0 0 0 11h3" })),
      play: /* @__PURE__ */ h("path", { d: "M7.5 5.6v12.8a1 1 0 0 0 1.5.86l10.6-6.4a1 1 0 0 0 0-1.72L9 4.74a1 1 0 0 0-1.5.86z" }),
      layers: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("path", { d: "m12 4 8.5 4.2L12 12.4 3.5 8.2z" }), /* @__PURE__ */ h("path", { d: "m3.5 12.2 8.5 4.2 8.5-4.2" }), /* @__PURE__ */ h("path", { d: "m3.5 16.1 8.5 4.2 8.5-4.2" })),
      students: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("circle", { cx: "9", cy: "8.2", r: "3.2" }), /* @__PURE__ */ h("path", { d: "M3.4 19.2c.6-3.2 2.8-5 5.6-5s5 1.8 5.6 5" }), /* @__PURE__ */ h("path", { d: "M15.6 5.4a3 3 0 0 1 0 5.6" }), /* @__PURE__ */ h("path", { d: "M17.2 14.4c1.9.5 3.1 2.1 3.4 4.8" })),
      grip: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("circle", { cx: "9.5", cy: "7", r: "1" }), /* @__PURE__ */ h("circle", { cx: "14.5", cy: "7", r: "1" }), /* @__PURE__ */ h("circle", { cx: "9.5", cy: "12", r: "1" }), /* @__PURE__ */ h("circle", { cx: "14.5", cy: "12", r: "1" }), /* @__PURE__ */ h("circle", { cx: "9.5", cy: "17", r: "1" }), /* @__PURE__ */ h("circle", { cx: "14.5", cy: "17", r: "1" }))
    };
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/kit/popover.jsx
  var MARGIN = 12;
  function shellRoot2() {
    return document.querySelector(".wb-shell") || document.body;
  }
  function useDismiss(open, refs, onClose) {
    useEffect(() => {
      if (!open) return void 0;
      const inside = (target) => refs.some((r) => r.current?.contains(target));
      const down = (e) => {
        if (!inside(e.target)) onClose();
      };
      const key2 = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      };
      document.addEventListener("pointerdown", down, true);
      document.addEventListener("keydown", key2, true);
      return () => {
        document.removeEventListener("pointerdown", down, true);
        document.removeEventListener("keydown", key2, true);
      };
    }, [open]);
  }
  function Popover({ anchor, open, onClose, children, className, align = "start", offset = 6, label, role = "dialog" }) {
    const { createPortal } = tb();
    const ref = useRef(null);
    const [pos, setPos] = useState(null);
    useDismiss(open, [ref, anchor], onClose);
    useLayoutEffect(() => {
      if (!open) {
        setPos(null);
        return void 0;
      }
      const place = () => {
        const a = anchor.current?.getBoundingClientRect();
        const el = ref.current;
        if (!a || !el) return;
        const w = el.offsetWidth;
        const hgt = el.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left = align === "end" ? a.right - w : align === "center" ? a.left + a.width / 2 - w / 2 : a.left;
        left = Math.max(MARGIN, Math.min(left, vw - MARGIN - w));
        let top = a.bottom + offset;
        let above = false;
        if (top + hgt > vh - MARGIN) {
          if (a.top - offset - hgt >= MARGIN) {
            top = a.top - offset - hgt;
            above = true;
          } else top = Math.max(MARGIN, vh - MARGIN - hgt);
        }
        setPos({ left: Math.round(left), top: Math.round(top), above, maxHeight: vh - 2 * MARGIN });
      };
      place();
      const ro = new ResizeObserver(place);
      if (ref.current) ro.observe(ref.current);
      window.addEventListener("resize", place);
      window.addEventListener("scroll", place, true);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", place, true);
      };
    }, [open]);
    if (!open) return null;
    const node = /* @__PURE__ */ h(
      "div",
      {
        ref,
        role,
        "aria-label": label,
        className: cx("tbx-popover", pos?.above && "is-above", className),
        style: { left: pos?.left ?? -9999, top: pos?.top ?? 0, maxHeight: pos?.maxHeight, visibility: pos ? "visible" : "hidden" }
      },
      children
    );
    return createPortal ? createPortal(node, shellRoot2()) : node;
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/kit/filter.jsx
  var Check = () => {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h("span", { className: "tbx-pop-check" }, /* @__PURE__ */ h(Icon22, { name: "check", size: 14, strokeWidth: 2.4 }));
  };
  function FilterMenu({ label, allLabel, options, value, onChange, icon, className, menuClassName, button, check, menuLabel }) {
    const ref = useRef(null);
    const [open, setOpen] = useState(false);
    const active = value.length > 0;
    const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    const tick = check || /* @__PURE__ */ h(Check, null);
    return /* @__PURE__ */ h(Fragment, null, button ? button({ ref, open, toggle: () => setOpen((o) => !o), active, count: value.length }) : /* @__PURE__ */ h(
      "button",
      {
        ref,
        type: "button",
        className: cx("tbx-filter-btn", active && "is-active", open && "is-open", className),
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-label": active ? tx("{{label}}\uFF1A\u5DF2\u9009 {{n}} \u9879", { label, n: value.length }) : label,
        title: label,
        onClick: () => setOpen((o) => !o)
      },
      icon,
      /* @__PURE__ */ h("span", { className: "tbx-filter-btn-text" }, /* @__PURE__ */ h("span", { "aria-hidden": active }, label), /* @__PURE__ */ h("span", { "aria-hidden": !active }, value.length || ""))
    ), /* @__PURE__ */ h(Popover, { anchor: ref, open, onClose: () => setOpen(false), align: "end", role: "menu", label: menuLabel || label, className: menuClassName || "tbx-filter-menu" }, /* @__PURE__ */ h("button", { type: "button", role: "menuitemradio", "aria-checked": !active, onClick: () => onChange([]) }, allLabel, !active && tick), /* @__PURE__ */ h("div", { className: "tbx-popover-sep" }), options.map((o) => /* @__PURE__ */ h("button", { key: o.id, type: "button", role: "menuitemcheckbox", "aria-checked": value.includes(o.id), onClick: () => toggle(o.id) }, o.mark, o.name, value.includes(o.id) && tick))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/kit/datetime.jsx
  var pad = (n) => String(n).padStart(2, "0");
  var toDate = (s) => /* @__PURE__ */ new Date(`${s}T12:00:00Z`);
  var iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  var addDays = (s, n) => {
    const d = toDate(s);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
  };
  function Glyph4({ name, size = 16 }) {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: 2 });
  }
  function monthTitle(month) {
    const [y, m] = month.split("-").map(Number);
    return isEnglish() ? new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : `${y}\u5E74${m}\u6708`;
  }
  var monthName = (m) => isEnglish() ? new Date(Date.UTC(2e3, m - 1, 15)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) : `${m}\u6708`;
  var yearName = (y) => isEnglish() ? String(y) : `${y}\u5E74`;
  function DatePicker({ value, min, today: today2, onChange }) {
    const [month, setMonth] = useState((value || today2).slice(0, 7));
    const [level, setLevel] = useState("days");
    const [y, m] = month.split("-").map(Number);
    const first = `${month}-01`;
    const lead = (toDate(first).getUTCDay() + 6) % 7;
    const start = addDays(first, -lead);
    const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const shift = (n) => {
      const d = new Date(Date.UTC(y, m - 1 + n, 1));
      setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
    };
    const step = level === "days" ? 1 : level === "months" ? 12 : 144;
    const pageStart = y - (y % 12 + 12) % 12;
    const weekdays = isEnglish() ? ["M", "T", "W", "T", "F", "S", "S"] : ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"];
    const pickedMonth = value?.slice(0, 7);
    const minMonth = min?.slice(0, 7);
    const title = level === "days" ? monthTitle(month) : level === "months" ? yearName(y) : `${pageStart} \u2013 ${pageStart + 11}`;
    return /* @__PURE__ */ h("div", { className: "tbx-datepicker", "data-level": level }, /* @__PURE__ */ h("header", null, /* @__PURE__ */ h("button", { type: "button", className: "tbx-datepicker-title", disabled: level === "years", "aria-label": level === "days" ? tx("\u9009\u62E9\u5E74\u6708") : tx("\u9009\u62E9\u5E74\u4EFD"), onClick: () => setLevel(level === "days" ? "months" : "years") }, /* @__PURE__ */ h("strong", null, title), level !== "years" && /* @__PURE__ */ h(Glyph4, { name: "chevron", size: 13 })), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("button", { type: "button", "aria-label": tx(level === "days" ? "\u4E0A\u4E2A\u6708" : "\u4E0A\u4E00\u9875"), onClick: () => shift(-step) }, /* @__PURE__ */ h(Glyph4, { name: "chevron", size: 15 })), /* @__PURE__ */ h("button", { type: "button", "aria-label": tx(level === "days" ? "\u4E0B\u4E2A\u6708" : "\u4E0B\u4E00\u9875"), onClick: () => shift(step) }, /* @__PURE__ */ h(Glyph4, { name: "chevron", size: 15 })))), level === "days" && /* @__PURE__ */ h("div", { className: "tbx-datepicker-grid", role: "grid", key: `d${month}` }, weekdays.map((w, i) => /* @__PURE__ */ h("span", { key: `w${i}`, className: "tbx-datepicker-weekday" }, w)), days.map((d) => /* @__PURE__ */ h(
      "button",
      {
        key: d,
        type: "button",
        disabled: Boolean(min && d < min),
        className: cx(d.slice(0, 7) !== month && "is-outside", d === today2 && "is-today", d === value && "is-selected"),
        "aria-pressed": d === value,
        "aria-label": d,
        onClick: () => onChange(d)
      },
      Number(d.slice(8))
    ))), level === "months" && /* @__PURE__ */ h("div", { className: "tbx-datepicker-cells", key: `m${y}` }, Array.from({ length: 12 }, (_, i) => {
      const key2 = `${y}-${pad(i + 1)}`;
      return /* @__PURE__ */ h("button", { key: key2, type: "button", disabled: Boolean(minMonth && key2 < minMonth), className: cx(key2 === pickedMonth && "is-selected", key2 === today2?.slice(0, 7) && "is-today"), onClick: () => {
        setMonth(key2);
        setLevel("days");
      } }, monthName(i + 1));
    })), level === "years" && /* @__PURE__ */ h("div", { className: "tbx-datepicker-cells", key: `y${pageStart}` }, Array.from({ length: 12 }, (_, i) => {
      const year = pageStart + i;
      return /* @__PURE__ */ h("button", { key: year, type: "button", disabled: Boolean(min && year < Number(min.slice(0, 4))), className: cx(year === Number(value?.slice(0, 4)) && "is-selected", year === Number(today2?.slice(0, 4)) && "is-today"), onClick: () => {
        setMonth(`${year}-${pad(m)}`);
        setLevel("months");
      } }, year);
    })), today2 && /* @__PURE__ */ h("footer", null, /* @__PURE__ */ h("button", { type: "button", onClick: () => onChange(today2), disabled: Boolean(min && today2 < min) }, tx("\u4ECA\u5929"))));
  }
  function TimePicker({ value, onChange, onDone }) {
    const [hh, mm] = (value || "09:00").split(":");
    const hours = useRef(null);
    const minutes = useRef(null);
    useLayoutEffect(() => {
      for (const col of [hours.current, minutes.current]) {
        const el = col?.querySelector('[aria-selected="true"]');
        if (el) col.scrollTop = el.offsetTop - col.clientHeight / 2 + el.offsetHeight / 2;
      }
    }, []);
    const column = (ref, count, current, pick3, label) => /* @__PURE__ */ h("div", { className: "tbx-timepicker-col", ref, role: "listbox", "aria-label": label }, Array.from({ length: count }, (_, i) => pad(i)).map((n) => /* @__PURE__ */ h("button", { key: n, type: "button", role: "option", "aria-selected": n === current, className: cx(n === current && "is-selected"), onClick: () => pick3(n) }, n)));
    return /* @__PURE__ */ h("div", { className: "tbx-timepicker", role: "group", "aria-label": tx("\u65F6\u95F4") }, column(hours, 24, hh, (h2) => onChange(`${h2}:${mm}`), tx("\u65F6")), column(minutes, 60, mm, (m) => {
      onChange(`${hh}:${m}`);
      onDone?.();
    }, tx("\u5206")));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/schedule/EntryEditor.jsx
  var PRIORITIES = [
    { id: "high", label: "\u91CD\u8981" },
    { id: "normal", label: "\u666E\u901A" },
    { id: "low", label: "\u7A0D\u540E" }
  ];
  var PATH = {
    close: "m7 7 10 10M17 7 7 17",
    more: "M6 12h.01M12 12h.01M18 12h.01",
    calendar: "M6.5 5h11a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3ZM3.5 10h17M8 3v4M16 3v4",
    clock: "M12 20.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17ZM12 7.5V12l3 2",
    sun: "M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8ZM12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1",
    repeat: "M4.5 11V9.5a3 3 0 0 1 3-3h11M15.5 3.5l3 3-3 3M19.5 13v1.5a3 3 0 0 1-3 3h-11M8.5 20.5l-3-3 3-3",
    bell: "M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.6 1.7H4.9zM10 20.4a2.3 2.3 0 0 0 4 0",
    chevron: "m10 7.5 4.5 4.5-4.5 4.5",
    plus: "M12 5.5v13M5.5 12h13",
    inbox: "M3.5 13.5 6 5.5h12l2.5 8M3.5 13.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.5M3.5 13.5h5l1 2h5l1-2h5",
    flag: "M5.5 20.5v-16M5.5 4.5h11l-2 4 2 4h-11",
    grip: "M9.5 7h.01M14.5 7h.01M9.5 12h.01M14.5 12h.01M9.5 17h.01M14.5 17h.01",
    // trash, calendar, bell, more, grip and pencil come from the shared set (shell/glyphs.jsx)
    move: "M14 4.5h5.5V10M19.5 4.5 11 13M17 13.5v4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4",
    check: "m5.5 12.5 4 4 9-9.5",
    tag: "M3.5 12.6V5a1.5 1.5 0 0 1 1.5-1.5h7.6l8 8a1.5 1.5 0 0 1 0 2.1l-7.5 7.5a1.5 1.5 0 0 1-2.1 0zM8 8h.01",
    list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"
  };
  function G({ name, size = 16, stroke = 1.8 }) {
    return /* @__PURE__ */ h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, globalThis.__tbx?.glyphs?.[name] ?? /* @__PURE__ */ h("path", { d: PATH[name] }));
  }
  function fit(el) {
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }
  function useAutoHeight(ref, value) {
    useLayoutEffect(() => fit(ref.current), [value]);
    useEffect(() => {
      const el = ref.current;
      if (!el || typeof ResizeObserver === "undefined") return void 0;
      let width = el.clientWidth;
      const ro = new ResizeObserver(() => {
        if (el.clientWidth !== width) {
          width = el.clientWidth;
          fit(el);
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);
  }
  function dateLabel(date, today2) {
    if (!date) return "";
    const d = /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
    const t2 = /* @__PURE__ */ new Date(`${today2}T12:00:00Z`);
    const diff = Math.round((d - t2) / 864e5);
    const md = monthDay(date);
    const name = diff === 0 ? tx("\u4ECA\u5929") : diff === 1 ? tx("\u660E\u5929") : diff === 2 ? tx("\u540E\u5929") : diff === -1 ? tx("\u6628\u5929") : weekdayName(date);
    return `${name} \xB7 ${md}`;
  }
  function Pill({ type, value, onChange, invalid, min, children, label, today: today2 }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    return /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("button", { type: "button", ref, className: cx("tbx-pill-input", invalid && "is-invalid", open && "is-open"), "aria-label": label, "aria-haspopup": "dialog", "aria-expanded": open, onClick: () => setOpen(!open) }, /* @__PURE__ */ h("span", null, children)), /* @__PURE__ */ h(Popover, { anchor: ref, open, onClose: () => setOpen(false), align: "end", label }, type === "date" ? /* @__PURE__ */ h(DatePicker, { value, min, today: today2, onChange: (v) => {
      onChange(v);
      setOpen(false);
    } }) : /* @__PURE__ */ h(TimePicker, { value, onChange, onDone: () => setOpen(false) })));
  }
  function Toggle({ on, onChange, label }) {
    return /* @__PURE__ */ h("button", { type: "button", role: "switch", "aria-checked": on, "aria-label": label, className: cx("tbx-switch", on && "is-on"), onClick: () => onChange(!on) }, /* @__PURE__ */ h("span", null));
  }
  var REPEATS = [["none", "\u4E0D\u91CD\u590D"], ["daily", "\u6BCF\u5929"], ["weekdays", "\u6BCF\u4E2A\u5DE5\u4F5C\u65E5"], ["weekly", "\u6BCF\u5468"], ["biweekly", "\u6BCF\u4E24\u5468"], ["monthly", "\u6BCF\u6708\uFF08\u65E5\u671F\uFF09"]];
  function Checklist({ items, onChange, repeating, onMove }) {
    const root = useRef(null);
    const focusId = useRef(null);
    const [adding, setAdding] = useState("");
    const [menu, setMenu] = useState(null);
    const [drag, setDrag] = useState(null);
    const done3 = items.filter((i) => i.completed).length;
    const flipRef = useFlip(null);
    const menuAnchor = useRef(null);
    useLayoutEffect(() => {
      if (!focusId.current) return;
      const el = root.current?.querySelector(`[data-item="${focusId.current}"] input`);
      if (el) {
        el.focus();
        const n = el.value.length;
        el.setSelectionRange(n, n);
      }
      focusId.current = null;
    });
    const commit = (next) => {
      flipRef.capture();
      onChange(next);
    };
    const patch = (id, value) => onChange(items.map((x) => x.id === id ? { ...x, ...value } : x));
    const remove = (id) => commit(items.filter((x) => x.id !== id));
    const insertAfter = (id) => {
      const at = items.findIndex((x) => x.id === id);
      const fresh = { id: crypto.randomUUID(), text: "", priority: "normal" };
      focusId.current = fresh.id;
      onChange([...items.slice(0, at + 1), fresh, ...items.slice(at + 1)]);
    };
    const commitAdd = () => {
      const text = adding.trim();
      if (!text || items.length >= 200) return;
      onChange([...items.filter((x) => x.text.trim()), { id: crypto.randomUUID(), text, priority: "normal" }]);
      setAdding("");
    };
    function startDrag(e, id) {
      if (e.button !== 0) return;
      e.preventDefault();
      const list = root.current.querySelector(".tbx-list-rows");
      const rowEl = root.current.querySelector(`[data-item="${id}"]`);
      const r = rowEl.getBoundingClientRect();
      const rows = [...root.current.querySelectorAll("[data-item]")].map((el) => ({ id: el.dataset.item, top: el.offsetTop, h: el.offsetHeight }));
      const from = rows.findIndex((x) => x.id === id);
      const sx = e.clientX;
      const sy = e.clientY;
      let state = null;
      const move = (ev) => {
        if (!state && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        const listTop = list.getBoundingClientRect().top;
        const y = ev.clientY - listTop;
        let index = 0;
        for (const row of rows) if (y > row.top + row.h / 2) index += 1;
        const noop = index === from || index === from + 1;
        const line = noop ? null : index < rows.length ? rows[index].top - 1 : rows[rows.length - 1].top + rows[rows.length - 1].h + 1;
        state = { id, x: ev.clientX, y: ev.clientY, dx: Math.min(sx - r.left, 40), dy: sy - r.top, index, line };
        setDrag(state);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.documentElement.classList.remove("tbx-dragging");
        if (state && state.line != null) {
          const rest = items.filter((x) => x.id !== id);
          const at = state.index > from ? state.index - 1 : state.index;
          commit([...rest.slice(0, at), items[from], ...rest.slice(at)]);
        }
        setDrag(null);
      };
      document.documentElement.classList.add("tbx-dragging");
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
    const dragged = drag && items.find((x) => x.id === drag.id);
    return /* @__PURE__ */ h("section", { className: "tbx-list", ref: root }, /* @__PURE__ */ h("header", { className: "tbx-list-head" }, /* @__PURE__ */ h("h3", null, tx("\u4E8B\u9879")), items.length > 0 && /* @__PURE__ */ h("span", { className: "tbx-list-count" }, /* @__PURE__ */ h("span", { className: "tbx-list-bar" }, /* @__PURE__ */ h("i", { style: { width: `${items.length ? done3 / items.length * 100 : 0}%` } })), done3, "/", items.length)), /* @__PURE__ */ h("div", { className: "tbx-list-rows" }, items.map((item, index) => {
      const pr = PRIORITIES.find((p) => p.id === item.priority && p.id !== "normal");
      return /* @__PURE__ */ h(
        "div",
        {
          key: item.id,
          ref: flipRef(item.id),
          "data-item": item.id,
          className: cx("tbx-item", item.completed && "is-done", drag?.id === item.id && "is-origin", menu === item.id && "is-menu")
        },
        /* @__PURE__ */ h("span", { className: "tbx-item-grip", onPointerDown: (e) => startDrag(e, item.id), "aria-hidden": "true" }, /* @__PURE__ */ h(G, { name: "grip", size: 14, stroke: 2.6 })),
        /* @__PURE__ */ h("button", { type: "button", className: "tbx-item-check", "aria-pressed": Boolean(item.completed), "aria-label": item.completed ? tx("\u6807\u4E3A\u672A\u5B8C\u6210") : tx("\u5B8C\u6210"), onClick: () => patch(item.id, { completed: !item.completed }) }, /* @__PURE__ */ h("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, /* @__PURE__ */ h("path", { d: "m5.5 12.5 4 4 9-9.5" }))),
        /* @__PURE__ */ h(
          "input",
          {
            className: "tbx-item-text",
            value: item.text,
            maxLength: 4e3,
            placeholder: tx("\u5199\u4E00\u4EF6\u8981\u505A\u7684\u4E8B"),
            "aria-label": tx("\u4E8B\u9879 {{n}}", { n: index + 1 }),
            onChange: (e) => patch(item.id, { text: e.target.value }),
            onKeyDown: (e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                if (item.text.trim() && items.length < 200) insertAfter(item.id);
                else e.currentTarget.blur();
              }
              if (e.key === "Backspace" && !item.text) {
                e.preventDefault();
                const prev = items[items.findIndex((x) => x.id === item.id) - 1];
                if (prev) focusId.current = prev.id;
                onChange(items.filter((x) => x.id !== item.id));
              }
              if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                e.preventDefault();
                const i = items.findIndex((x) => x.id === item.id);
                const j = i + (e.key === "ArrowUp" ? -1 : 1);
                if (j < 0 || j >= items.length) return;
                const next = [...items];
                [next[i], next[j]] = [next[j], next[i]];
                focusId.current = item.id;
                commit(next);
              }
            },
            onBlur: (e) => {
              if (!e.currentTarget.value.trim() && !e.relatedTarget?.closest(".tbx-popover")) onChange(items.filter((x) => x.id !== item.id));
            }
          }
        ),
        /* @__PURE__ */ h("span", { className: "tbx-item-tail" }, pr && /* @__PURE__ */ h("span", { className: cx("tbx-prio", `is-${pr.id}`) }, tx(pr.label)), /* @__PURE__ */ h(
          "button",
          {
            type: "button",
            className: "tbx-item-more",
            "aria-label": tx("\u4E8B\u9879\u9009\u9879"),
            "aria-haspopup": "menu",
            "aria-expanded": menu === item.id,
            onClick: (e) => {
              menuAnchor.current = e.currentTarget;
              setMenu(menu === item.id ? null : item.id);
            }
          },
          /* @__PURE__ */ h(G, { name: "more", size: 16, stroke: 2.6 })
        ))
      );
    }), drag?.line != null && /* @__PURE__ */ h("div", { className: "tbx-drop-line is-list", style: { transform: `translateY(${drag.line}px)` }, "aria-hidden": "true" }), /* @__PURE__ */ h("div", { className: "tbx-item is-add" }, /* @__PURE__ */ h("span", { className: "tbx-item-grip", "aria-hidden": "true" }), /* @__PURE__ */ h("span", { className: "tbx-item-plus", "aria-hidden": "true" }, /* @__PURE__ */ h(G, { name: "plus", size: 13, stroke: 2.4 })), /* @__PURE__ */ h(
      "input",
      {
        className: "tbx-item-text",
        value: adding,
        placeholder: items.length ? tx("\u6DFB\u52A0\u4E8B\u9879") : tx("\u6DFB\u52A0\u7B2C\u4E00\u4EF6\u8981\u505A\u7684\u4E8B"),
        "aria-label": tx("\u6DFB\u52A0\u4E8B\u9879"),
        disabled: items.length >= 200,
        onChange: (e) => setAdding(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            commitAdd();
          }
        },
        onBlur: commitAdd
      }
    ))), dragged && /* @__PURE__ */ h("div", { className: "tbx-drag-ghost is-item", style: { transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px)` }, "aria-hidden": "true" }, /* @__PURE__ */ h("span", { className: cx("tbx-item-check", dragged.completed && "is-done") }), /* @__PURE__ */ h("span", null, dragged.text || tx("\u5199\u4E00\u4EF6\u8981\u505A\u7684\u4E8B"))), (() => {
      const item = items.find((x) => x.id === menu);
      return /* @__PURE__ */ h(Popover, { anchor: menuAnchor, open: Boolean(item), onClose: () => setMenu(null), align: "end", role: "menu", className: "tbx-item-menu" }, item && /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("div", { className: "tbx-item-prio", role: "radiogroup", "aria-label": tx("\u4F18\u5148\u7EA7") }, PRIORITIES.map((p) => /* @__PURE__ */ h("button", { key: p.id, type: "button", role: "radio", "aria-checked": (item.priority || "normal") === p.id, className: cx(`is-${p.id}`, (item.priority || "normal") === p.id && "is-on"), onClick: () => {
        patch(item.id, { priority: p.id });
        setMenu(null);
      } }, tx(p.label)))), !repeating && onMove && item.text.trim() && /* @__PURE__ */ h("button", { type: "button", role: "menuitem", onClick: () => {
        setMenu(null);
        onMove(item.id);
      } }, /* @__PURE__ */ h(G, { name: "move" }), tx("\u79FB\u5230\u5176\u4ED6\u5B89\u6392\u2026")), /* @__PURE__ */ h(ConfirmMenuItem, { icon: /* @__PURE__ */ h(G, { name: "trash" }), label: tx("\u5220\u9664\u4E8B\u9879"), onConfirm: () => {
        setMenu(null);
        remove(item.id);
      } })));
    })());
  }
  function Labels({ tags, labels, onChange, onLabels, accountKey }) {
    const { scheduleKit: K } = tb();
    const [editing, setEditing] = useState(null);
    const tagsRef = useRef(tags);
    tagsRef.current = tags;
    return /* @__PURE__ */ h("section", { className: "tbx-labels", "aria-label": tx("\u6807\u7B7E") }, labels.map((l) => {
      const on = tags.includes(l.id);
      return /* @__PURE__ */ h(
        "button",
        {
          key: l.id,
          type: "button",
          className: cx("tbx-label", on && "is-on"),
          style: { "--c": l.color },
          "aria-pressed": on,
          onClick: () => onChange(on ? tags.filter((x) => x !== l.id) : [...tags, l.id]),
          onDoubleClick: () => setEditing({ ...l, clientId: crypto.randomUUID() }),
          title: tx("\u53CC\u51FB\u7F16\u8F91\u6807\u7B7E")
        },
        /* @__PURE__ */ h("i", null),
        l.name
      );
    }), /* @__PURE__ */ h("button", { type: "button", className: "tbx-label is-new", onClick: () => setEditing({ clientId: crypto.randomUUID() }), disabled: tags.length >= 30 }, /* @__PURE__ */ h(G, { name: "plus", size: 12, stroke: 2.4 }), tx("\u65B0\u6807\u7B7E")), /* @__PURE__ */ h(K.CalendarOverlay, { present: Boolean(editing) }, editing && /* @__PURE__ */ h(K.LabelDialog, { key: editing.clientId, label: editing.id ? editing : null, accountKey, onClose: () => setEditing(null), onSaved: (label, select) => {
      onLabels(label);
      if (select && tagsRef.current.length < 30 && !tagsRef.current.includes(label.id)) onChange([...tagsRef.current, label.id]);
    } })));
  }
  function EntryEditor(props) {
    const { draft, onPatch, onClose, onConfirm, onDelete, onRemove, onMoveItem, locked, labels, onLabels, accountKey, status, onRetry, onReload, onAdoptServer, error, Original } = props;
    useLocale();
    const { scheduleKit: K } = tb();
    const content2 = draft.content;
    const titleRef = useRef(null);
    const notesRef = useRef(null);
    const sheetRef = useRef(null);
    const [dialog, setDialog] = useState(null);
    const [repeatMenu, setRepeatMenu] = useState(false);
    const repeatRef = useRef(null);
    const beforeAllDay = useRef(null);
    useEffect(() => {
      if (!draft.id) titleRef.current?.focus({ preventScroll: true });
    }, [draft.clientId]);
    useAutoHeight(titleRef, content2.title);
    useAutoHeight(notesRef, content2.calendar.notes);
    if (locked || draft.readOnly || !K) return /* @__PURE__ */ h(Original, { ...props });
    const time = content2.time;
    const allDay = content2.calendar.allDay;
    const end = time ? K.endOf(content2) : null;
    const endIssue = K.endTimeProblem(content2);
    const adjustment = time ? K.dstAdjustment(content2) : null;
    const today2 = K.todayInZone(draft.zone);
    const patchCalendar = (v) => onPatch({ calendar: { ...content2.calendar, ...v } });
    const patchTime = (v) => onPatch({ time: { ...time, ...v } });
    const setRepeat = (repeat, date = time.date) => {
      onPatch({ repeat, time: { ...time, date } }, true);
      setRepeatMenu(false);
      setDialog(null);
    };
    const anchor = draft.forceSeries ? time?.date : draft.entry?.time?.date ?? time?.date;
    const kind = tx(time ? draft.id ? "\u4EFB\u52A1" : "\u65B0\u4EFB\u52A1" : draft.id ? "\u5F85\u5B89\u6392" : "\u65B0\u7684\u5F85\u5B89\u6392");
    const confirmKey = (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
      e.preventDefault();
      e.currentTarget.blur();
      onConfirm();
    };
    const morning = () => ({ ...K.defaultTime(draft.zone), date: today2, startTime: "09:00", durationMinutes: 60 });
    const toggleAllDay = (on) => {
      const t2 = time ?? morning();
      if (on) {
        if (!allDay) beforeAllDay.current = { startTime: t2.startTime, durationMinutes: t2.durationMinutes };
        onPatch({ calendar: { ...content2.calendar, allDay: true }, time: { ...t2, startTime: "00:00", durationMinutes: Math.max(1440, Math.ceil(t2.durationMinutes / 1440) * 1440) } });
        return;
      }
      const saved = beforeAllDay.current;
      const base = draft.id && draft.baseline?.time && !draft.baseline.calendar?.allDay ? draft.baseline.time : null;
      const back = draft.id ? saved || base && { startTime: base.startTime, durationMinutes: base.durationMinutes } : null;
      onPatch({ calendar: { ...content2.calendar, allDay: false }, time: { ...t2, startTime: back?.startTime ?? "09:00", durationMinutes: back?.durationMinutes ?? 60 } });
    };
    const closingRef = useRef(false);
    const close = async () => {
      if (closingRef.current) return;
      const sheet = sheetRef.current;
      const side = sheet?.closest(".cal-sidebar");
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const onBoard = side && !reduced && sheet.closest(".cal-page")?.dataset.focus === "tasks" && matchMedia("(min-width: 1081px)").matches;
      if (!onBoard) return onClose();
      closingRef.current = true;
      const r = side.getBoundingClientRect();
      const host = document.createElement("div");
      host.className = "tbx-sheet-leaving";
      host.setAttribute("aria-hidden", "true");
      host.inert = true;
      Object.assign(host.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      const copy = sheet.cloneNode(true);
      copy.removeAttribute("data-region");
      copy.style.width = `${sheet.offsetWidth}px`;
      copy.style.animation = "none";
      const typed = sheet.querySelectorAll("textarea, input");
      copy.querySelectorAll("textarea, input").forEach((el, i) => {
        el.value = typed[i]?.value ?? "";
      });
      host.appendChild(copy);
      (sheet.closest(".wb-shell") || document.body).appendChild(host);
      side.classList.add("is-leaving");
      try {
        await onClose();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (sheet.isConnected) return;
        const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
        const narrowing = host.animate(
          [{ width: `${r.width}px`, left: `${r.left}px` }, { width: "0px", left: `${r.right}px` }],
          { duration: 460, easing: ease, fill: "forwards" }
        );
        const content3 = copy.animate(
          [{ transform: "none", opacity: 1 }, { transform: "translateX(28px)", opacity: 1, offset: 0.55 }, { transform: "translateX(28px)", opacity: 0 }],
          { duration: 460, easing: ease, fill: "forwards" }
        );
        await Promise.all([narrowing.finished.catch(() => {
        }), content3.finished.catch(() => {
        })]);
      } finally {
        host.remove();
        side.classList.remove("is-leaving");
        closingRef.current = false;
      }
    };
    const repeating = Boolean(draft.id && draft.entry?.repeat);
    const saving = status === "running";
    return /* @__PURE__ */ h("section", { ref: sheetRef, className: cx("tbx-sheet", time ? "is-task" : "is-inbox"), "data-region": "entry-editor" }, error && error !== endIssue && /* @__PURE__ */ h("div", { className: "tbx-sheet-error", role: "alert" }, /* @__PURE__ */ h("span", null, error), /* @__PURE__ */ h("span", null, onReload && /* @__PURE__ */ h("button", { type: "button", onClick: onReload }, tx("\u8BFB\u53D6\u6700\u65B0\u7248\u672C")), /* @__PURE__ */ h("button", { type: "button", onClick: onRetry, disabled: saving }, status === "unconfirmed" ? tx("\u91CD\u8BD5\u786E\u8BA4") : tx("\u91CD\u65B0\u4FDD\u5B58")))), /* @__PURE__ */ h("header", { className: "tbx-sheet-head" }, /* @__PURE__ */ h("span", { className: "tbx-sheet-kind" }, /* @__PURE__ */ h(G, { name: time ? "calendar" : "inbox", size: 14 }), kind), /* @__PURE__ */ h("span", { className: "tbx-sheet-actions" }, time && /* @__PURE__ */ h("button", { type: "button", className: "tbx-sheet-icon has-text", title: tx("\u79FB\u56DE\u5F85\u5B89\u6392"), "aria-label": tx("\u79FB\u56DE\u5F85\u5B89\u6392"), onClick: () => setDialog("unschedule") }, /* @__PURE__ */ h(G, { name: "inbox", size: 15 }), /* @__PURE__ */ h("span", { className: "tbx-sheet-btn-text" }, tx("\u79FB\u56DE\u5F85\u5B89\u6392"))), repeating ? /* @__PURE__ */ h("button", { type: "button", className: "tbx-sheet-icon is-danger", "aria-label": tx("\u5220\u9664"), title: tx("\u5220\u9664"), onClick: () => setDialog("delete") }, /* @__PURE__ */ h(G, { name: "trash", size: 16 })) : /* @__PURE__ */ h(
      ConfirmButton,
      {
        className: "tbx-sheet-delete",
        label: draft.id ? tx("\u5220\u9664") : tx("\u653E\u5F03"),
        confirmLabel: draft.id ? tx("\u786E\u8BA4\u5220\u9664") : tx("\u786E\u8BA4\u653E\u5F03"),
        onConfirm: () => onRemove ? onRemove("series") : onDelete()
      }
    ), /* @__PURE__ */ h("button", { type: "button", className: "tbx-sheet-icon", "aria-label": tx("\u5173\u95ED"), title: tx("\u5173\u95ED"), onClick: close }, /* @__PURE__ */ h(G, { name: "close", size: 16, stroke: 2.2 })))), /* @__PURE__ */ h("div", { className: "tbx-sheet-body" }, /* @__PURE__ */ h(
      "textarea",
      {
        ref: titleRef,
        id: "calendar-entry-title",
        className: "tbx-sheet-title",
        rows: 1,
        maxLength: 300,
        placeholder: time ? tx("\u8981\u505A\u4EC0\u4E48\uFF1F") : tx("\u5148\u8BB0\u4E0B\u6765\u2026"),
        value: content2.title,
        onChange: (e) => onPatch({ title: e.target.value.replace(/\n/g, " ") }),
        onKeyDown: confirmKey
      }
    ), /* @__PURE__ */ h(
      "textarea",
      {
        ref: notesRef,
        className: "tbx-sheet-notes",
        rows: 1,
        placeholder: tx("\u5907\u6CE8"),
        "aria-label": tx("\u5907\u6CE8"),
        value: content2.calendar.notes,
        onChange: (e) => patchCalendar({ notes: e.target.value })
      }
    ), time ? /* @__PURE__ */ h("div", { className: "tbx-inset" }, /* @__PURE__ */ h("div", { className: "tbx-row" }, /* @__PURE__ */ h("span", { className: "tbx-row-icon is-red" }, /* @__PURE__ */ h(G, { name: "calendar", size: 15 })), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, tx("\u65E5\u671F")), /* @__PURE__ */ h("span", { className: "tbx-row-value" }, /* @__PURE__ */ h(Pill, { type: "date", today: today2, label: tx("\u5F00\u59CB\u65E5\u671F"), value: time.date, onChange: (v) => patchTime({ date: v }) }, dateLabel(time.date, today2)))), (allDay || end.date !== time.date) && /* @__PURE__ */ h("div", { className: "tbx-row" }, /* @__PURE__ */ h("span", { className: "tbx-row-icon is-clear" }), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, tx("\u7ED3\u675F")), /* @__PURE__ */ h("span", { className: "tbx-row-value" }, /* @__PURE__ */ h(Pill, { type: "date", today: today2, label: tx("\u7ED3\u675F\u65E5\u671F"), min: time.date, invalid: allDay && endIssue, value: end.date, onChange: (v) => onPatch({ time: K.changeEnd(content2, v, end.time) }) }, dateLabel(end.date, today2)))), !allDay && /* @__PURE__ */ h("div", { className: "tbx-row" }, /* @__PURE__ */ h("span", { className: "tbx-row-icon is-blue" }, /* @__PURE__ */ h(G, { name: "clock", size: 15 })), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, tx("\u65F6\u95F4")), /* @__PURE__ */ h("span", { className: "tbx-row-value tbx-range" }, /* @__PURE__ */ h(Pill, { type: "time", label: tx("\u5F00\u59CB\u65F6\u95F4"), value: time.startTime, onChange: (v) => patchTime({ startTime: v }) }, time.startTime), /* @__PURE__ */ h("i", null, "\u2013"), /* @__PURE__ */ h(Pill, { type: "time", label: tx("\u7ED3\u675F\u65F6\u95F4"), invalid: Boolean(endIssue), value: end.time, onChange: (v) => onPatch({ time: K.changeEnd(content2, end.date, v) }) }, end.time))), /* @__PURE__ */ h("div", { className: "tbx-row" }, /* @__PURE__ */ h("span", { className: "tbx-row-icon is-orange" }, /* @__PURE__ */ h(G, { name: "sun", size: 15 })), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, tx("\u5168\u5929")), /* @__PURE__ */ h("span", { className: "tbx-row-value" }, /* @__PURE__ */ h(Toggle, { on: allDay, onChange: toggleAllDay, label: tx("\u5168\u5929") }))), /* @__PURE__ */ h("div", { className: "tbx-row is-button" }, /* @__PURE__ */ h("button", { type: "button", ref: repeatRef, className: "tbx-row-hit", onClick: () => setRepeatMenu(!repeatMenu), "aria-haspopup": "menu", "aria-expanded": repeatMenu }, /* @__PURE__ */ h("span", { className: "tbx-row-icon is-gray" }, /* @__PURE__ */ h(G, { name: "repeat", size: 15 })), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, tx("\u91CD\u590D")), /* @__PURE__ */ h("span", { className: "tbx-row-value is-text" }, content2.repeat ? K.repeatLabel(content2.repeat, anchor) : tx("\u4E0D\u91CD\u590D"), /* @__PURE__ */ h(G, { name: "chevron", size: 14 }))), /* @__PURE__ */ h(Popover, { anchor: repeatRef, open: repeatMenu, onClose: () => setRepeatMenu(false), align: "end", role: "menu", label: tx("\u91CD\u590D") }, REPEATS.map(([id, label]) => {
      const on = id === "none" ? !content2.repeat : Boolean(content2.repeat) && K.repeatLabel(content2.repeat, anchor) === K.repeatLabel(K.presetRepeat(id, time.date), anchor);
      return /* @__PURE__ */ h("button", { key: id, type: "button", role: "menuitemradio", "aria-checked": on, onClick: () => setRepeat(id === "none" ? null : K.presetRepeat(id, time.date)) }, tx(label), on && /* @__PURE__ */ h("span", { className: "tbx-pop-check" }, /* @__PURE__ */ h(G, { name: "check", size: 14 })));
    }), /* @__PURE__ */ h("div", { className: "tbx-popover-sep" }), /* @__PURE__ */ h("button", { type: "button", role: "menuitem", onClick: () => {
      setRepeatMenu(false);
      setDialog("repeat");
    } }, tx("\u81EA\u5B9A\u4E49\u2026")))), /* @__PURE__ */ h("div", { className: "tbx-row is-button" }, /* @__PURE__ */ h("button", { type: "button", className: "tbx-row-hit", onClick: () => setDialog("reminder") }, /* @__PURE__ */ h("span", { className: "tbx-row-icon is-purple" }, /* @__PURE__ */ h(G, { name: "bell", size: 15 })), /* @__PURE__ */ h("span", { className: "tbx-row-label" }, tx("\u63D0\u9192")), /* @__PURE__ */ h("span", { className: "tbx-row-value is-text" }, content2.reminder ? K.reminderLabel(content2.reminder) : tx("\u65E0"), /* @__PURE__ */ h(G, { name: "chevron", size: 14 }))))) : /* @__PURE__ */ h("button", { type: "button", className: "tbx-when-add", onClick: () => onPatch({ time: morning(), calendar: { ...content2.calendar, allDay: false } }) }, /* @__PURE__ */ h("span", { className: "tbx-row-icon is-red" }, /* @__PURE__ */ h(G, { name: "calendar", size: 15 })), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("strong", null, tx("\u653E\u8FDB\u65E5\u5386\uFF0C\u53D8\u6210\u4EFB\u52A1"))), /* @__PURE__ */ h(G, { name: "chevron", size: 14 })), endIssue && /* @__PURE__ */ h("p", { className: "tbx-sheet-hint is-error", role: "alert" }, tx("\u7ED3\u675F\u65F6\u95F4\u8981\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4\u3002")), adjustment && /* @__PURE__ */ h("p", { className: "tbx-sheet-hint" }, tx("\u590F\u4EE4\u65F6\u8DF3\u65F6\uFF0C\u8FD9\u6B21\u5B9E\u9645\u5F00\u59CB\u4E8E {{date}} {{time}}\uFF08{{zone}}\uFF09\u3002", { date: adjustment.date, time: adjustment.startTime, zone: adjustment.timeZone })), time && time.timeZone !== draft.zone && /* @__PURE__ */ h("p", { className: "tbx-sheet-hint" }, tx("\u6392\u8BFE\u65F6\u533A\uFF1A{{zone}}", { zone: time.timeZone })), /* @__PURE__ */ h(Labels, { tags: content2.calendar.tags, labels, onChange: (tags) => patchCalendar({ tags }), onLabels, accountKey }), /* @__PURE__ */ h(
      Checklist,
      {
        items: content2.items,
        repeating: Boolean(content2.repeat),
        onChange: (items) => onPatch({ items }),
        onMove: draft.id || content2.title.trim() ? onMoveItem : null
      }
    ), draft.savePaused && /* @__PURE__ */ h(K.ConflictPreview, { content: draft.baseline, labels, onAdopt: () => setDialog("adopt") })), /* @__PURE__ */ h("footer", { className: "tbx-sheet-foot" }, /* @__PURE__ */ h("span", { className: cx("tbx-sheet-status", saving && "is-saving") }, tx(saving ? "\u6B63\u5728\u4FDD\u5B58\u2026" : draft.id ? "\u81EA\u52A8\u4FDD\u5B58" : content2.title.trim() ? "\u9A6C\u4E0A\u4FDD\u5B58" : "\u5199\u4E0B\u6807\u9898\u5C31\u4F1A\u4FDD\u5B58")), /* @__PURE__ */ h("button", { type: "button", className: "tbx-sheet-done", onClick: close }, tx("\u5B8C\u6210"))), /* @__PURE__ */ h(K.CalendarOverlay, { present: ["repeat", "reminder", "adopt"].includes(dialog) }, dialog === "repeat" && /* @__PURE__ */ h(K.RepeatDialog, { value: content2.repeat, date: time.date, anchor, onSave: setRepeat, onClose: () => setDialog(null) }), dialog === "reminder" && /* @__PURE__ */ h(K.ReminderDialog, { value: content2.reminder, onClose: () => setDialog(null), onSave: (reminder) => {
      onPatch({ reminder });
      setDialog(null);
    } }), dialog === "adopt" && /* @__PURE__ */ h(K.CalendarDialog, { title: tx("\u91C7\u7528\u670D\u52A1\u5668\u5185\u5BB9"), onClose: () => setDialog(null) }, /* @__PURE__ */ h("p", null, tx("\u7528\u670D\u52A1\u5668\u5185\u5BB9\u66FF\u6362\u5F53\u524D\u672C\u5730\u8F93\u5165\uFF1F\u672A\u4FDD\u5B58\u7684\u672C\u5730\u4FEE\u6539\u5C06\u88AB\u4E22\u5F03\u3002")), /* @__PURE__ */ h("footer", null, /* @__PURE__ */ h("button", { onClick: () => setDialog(null) }, tx("\u53D6\u6D88")), /* @__PURE__ */ h("button", { className: "is-primary", "data-dialog-confirm": "", onClick: () => {
      onAdoptServer();
      setDialog(null);
    } }, tx("\u91C7\u7528"))))), dialog === "unschedule" && /* @__PURE__ */ h(
      ConfirmDialog,
      {
        danger: false,
        icon: "inbox",
        title: tx("\u79FB\u56DE\u5F85\u5B89\u6392\uFF1F"),
        message: tx("\u4F1A\u53BB\u6389\u8FD9\u4EF6\u4E8B\u7684\u65F6\u95F4\u548C\u63D0\u9192\uFF0C\u5B83\u4F1A\u56DE\u5230\u201C\u5F85\u5B89\u6392\u201D\u3002"),
        confirmLabel: tx("\u79FB\u56DE\u5F85\u5B89\u6392"),
        onCancel: () => setDialog(null),
        onConfirm: () => {
          onPatch({ time: null, repeat: null, reminder: null, calendar: { ...content2.calendar, allDay: false } });
          setDialog(null);
        }
      }
    ), dialog === "delete" && /* @__PURE__ */ h(
      ConfirmDialog,
      {
        title: tx("\u5220\u9664\u91CD\u590D\u7684\u4EFB\u52A1\uFF1F"),
        message: tx("\u53EF\u4EE5\u53EA\u5220\u6389\u8FD9\u4E00\u6B21\uFF0C\u4E5F\u53EF\u4EE5\u628A\u6574\u7EC4\u91CD\u590D\u7684\u4EFB\u52A1\u4E00\u8D77\u5220\u6389\u3002"),
        confirmLabel: tx("\u53EA\u5220\u8FD9\u4E00\u6B21"),
        secondaryLabel: tx("\u5220\u9664\u5168\u90E8"),
        onSecondary: () => {
          setDialog(null);
          onRemove ? onRemove("series") : onDelete();
        },
        onCancel: () => setDialog(null),
        onConfirm: () => {
          setDialog(null);
          onRemove ? onRemove("instance") : onDelete();
        }
      }
    ));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/schedule/TaskBoard.jsx
  function FocusToggle({ value = "calendar", onChange }) {
    useLocale();
    const ref = useRef(null);
    const [thumb, setThumb] = useState(null);
    useLayoutEffect(() => {
      const el = ref.current?.querySelector('[aria-pressed="true"]');
      if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    }, [value]);
    function pick3(next) {
      if (next === value) return;
      const root = document.documentElement;
      root.dataset.tbxFocusSwitch = "";
      setTimeout(() => {
        delete root.dataset.tbxFocusSwitch;
      }, 700);
      const run = () => {
        onChange(next);
        return new Promise((resolve) => setTimeout(resolve, 50));
      };
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (document.startViewTransition && !reduced) document.startViewTransition(run);
      else run();
    }
    return /* @__PURE__ */ h("div", { className: "tbx-focus", ref, role: "group", "aria-label": tx("\u89C6\u56FE") }, thumb && /* @__PURE__ */ h("span", { className: "tbx-focus-thumb", style: { transform: `translateX(${thumb.left}px)`, width: `${thumb.width}px` } }), /* @__PURE__ */ h("button", { type: "button", "aria-pressed": value !== "tasks", onClick: () => pick3("calendar") }, /* @__PURE__ */ h("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": "true" }, /* @__PURE__ */ h("rect", { x: "3.5", y: "5", width: "17", height: "15", rx: "3" }), /* @__PURE__ */ h("path", { d: "M3.5 10h17M8 3v4M16 3v4" })), tx("\u65E5\u5386")), /* @__PURE__ */ h("button", { type: "button", "aria-pressed": value === "tasks", onClick: () => pick3("tasks") }, /* @__PURE__ */ h("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": "true" }, /* @__PURE__ */ h("rect", { x: "3.5", y: "4", width: "5", height: "16", rx: "2" }), /* @__PURE__ */ h("rect", { x: "10.5", y: "4", width: "5", height: "10", rx: "2" }), /* @__PURE__ */ h("rect", { x: "17.5", y: "4", width: "3", height: "13", rx: "1.5" })), tx("\u4EFB\u52A1")));
  }
  var PRIORITY = { high: "\u91CD\u8981", low: "\u7A0D\u540E" };
  function Progress({ done: done3, total }) {
    if (!total) return null;
    const r = 9, c = 2 * Math.PI * r, p = done3 / total;
    return /* @__PURE__ */ h("span", { className: cx("tbx-progress", done3 === total && "is-done"), title: tx("\u5DF2\u5B8C\u6210 {{done}}/{{total}}", { done: done3, total }) }, /* @__PURE__ */ h("svg", { width: "24", height: "24", viewBox: "0 0 24 24", "aria-hidden": "true" }, /* @__PURE__ */ h("circle", { cx: "12", cy: "12", r, className: "tbx-progress-track" }), /* @__PURE__ */ h("circle", { cx: "12", cy: "12", r, className: "tbx-progress-fill", strokeDasharray: c, strokeDashoffset: c * (1 - p), transform: "rotate(-90 12 12)" })), /* @__PURE__ */ h("span", null, done3, "/", total));
  }
  function TaskCard({ value, labels, onOpen, onClose, onToggle, timeLabel, index, active, flipRef }) {
    const occurrence = value.key ? value : null;
    const id = occurrence?.key.entryId ?? value.id;
    const origin = occurrence?.key.originDate ?? null;
    const tags = labels.filter((l) => value.calendar?.tags?.includes(l.id));
    const items = value.items || [];
    const done3 = items.filter((i) => i.completed).length;
    const title = value.title?.trim() || items[0]?.text || tx("\u672A\u547D\u540D");
    const listed = value.title?.trim() ? items : items.slice(1);
    const open = () => active && onClose ? onClose() : onOpen(id, origin);
    return /* @__PURE__ */ h(
      "div",
      {
        ref: flipRef,
        role: "button",
        tabIndex: 0,
        "aria-expanded": active,
        className: cx("tbx-task", active && "is-active", done3 && done3 === items.length && "is-complete"),
        style: { "--i": index, "--tag": tags[0]?.color || "var(--tb-faint)" },
        onClick: open,
        onKeyDown: (e) => {
          if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault();
            open();
          }
        }
      },
      /* @__PURE__ */ h("span", { className: "tbx-task-top" }, tags.length > 0 ? /* @__PURE__ */ h("span", { className: "tbx-task-tags" }, /* @__PURE__ */ h("span", { className: "tbx-task-tag" }, /* @__PURE__ */ h("i", null), /* @__PURE__ */ h("span", null, tags[0].name)), tags.length > 1 && /* @__PURE__ */ h("span", { className: "tbx-task-more", title: tags.slice(1).map((t2) => t2.name).join("\u3001") }, "+", tags.length - 1)) : /* @__PURE__ */ h("span", { className: "tbx-task-tag is-none" }, /* @__PURE__ */ h("i", null), tx("\u65E0\u6807\u7B7E")), timeLabel && /* @__PURE__ */ h("time", null, timeLabel)),
      /* @__PURE__ */ h("strong", { className: "tbx-task-title" }, title),
      listed.length > 0 && /* @__PURE__ */ h("ul", { className: "tbx-task-items" }, listed.slice(0, 5).map((item) => /* @__PURE__ */ h("li", { key: item.id, className: cx(item.completed && "is-done", item.priority === "high" && "is-high") }, /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          className: "tbx-task-item",
          "aria-pressed": Boolean(item.completed),
          title: item.completed ? tx("\u6807\u4E3A\u672A\u5B8C\u6210") : tx("\u5212\u6389"),
          onClick: (e) => {
            e.stopPropagation();
            onToggle(value, item.id);
          }
        },
        /* @__PURE__ */ h("span", { className: "tbx-check", "aria-hidden": "true" }, /* @__PURE__ */ h("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3.6", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ h("path", { d: "m5.5 12.5 4 4 9-9.5" }))),
        /* @__PURE__ */ h("span", { className: "tbx-item-text" }, item.text),
        PRIORITY[item.priority] && !item.completed && /* @__PURE__ */ h("em", { className: `is-${item.priority}` }, tx(PRIORITY[item.priority]))
      ))), listed.length > 5 && /* @__PURE__ */ h("li", { className: "tbx-more" }, tx("\u8FD8\u6709 {{n}} \u9879", { n: listed.length - 5 }))),
      /* @__PURE__ */ h("span", { className: "tbx-task-foot" }, /* @__PURE__ */ h(Progress, { done: done3, total: items.length }), value.calendar?.notes ? /* @__PURE__ */ h("span", { className: "tbx-task-note" }, value.calendar.notes) : null)
    );
  }
  var NO_TAG = "__none";
  var FILTER_KEY = "tbx-board-filters";
  var passes = (value, filter) => !filter.length || (value.calendar?.tags?.length ? value.calendar.tags.some((t2) => filter.includes(t2)) : filter.includes(NO_TAG));
  function TagFilter({ labels, value, onChange, title }) {
    const check = /* @__PURE__ */ h("span", { className: "tbx-pop-check" }, /* @__PURE__ */ h(G, { name: "check", size: 14 }));
    return /* @__PURE__ */ h(
      FilterMenu,
      {
        label: tx("\u6309\u6807\u7B7E\u7B5B\u9009"),
        menuLabel: tx("\u6309\u6807\u7B7E\u7B5B\u9009"),
        menuClassName: "tbx-tag-filter",
        allLabel: tx("\u6240\u6709\u6807\u7B7E"),
        check,
        value,
        onChange,
        options: [
          ...labels.map((l) => ({ id: l.id, name: l.name, mark: /* @__PURE__ */ h("i", { className: "tbx-filter-dot", style: { background: l.color } }) })),
          { id: NO_TAG, name: tx("\u65E0\u6807\u7B7E"), mark: /* @__PURE__ */ h("i", { className: "tbx-filter-dot is-none" }) }
        ],
        button: ({ ref, open, toggle, active, count }) => /* @__PURE__ */ h(
          "button",
          {
            ref,
            type: "button",
            className: cx("tbx-col-tool tbx-col-filter", active && "is-active", open && "is-open"),
            "aria-haspopup": "menu",
            "aria-expanded": open,
            "aria-label": tx("\u6309\u6807\u7B7E\u7B5B\u9009\u201C{{title}}\u201D", { title }),
            title: tx("\u6309\u6807\u7B7E\u7B5B\u9009"),
            onClick: toggle
          },
          /* @__PURE__ */ h(G, { name: "filter", size: 16, stroke: 2.1 }),
          /* @__PURE__ */ h("span", { className: "tbx-col-filter-count", "aria-hidden": !active }, count || "")
        )
      }
    );
  }
  function Column({ title, count, total, tone, children, onNew, empty, filter, onClearFilter }) {
    const filtered = total > 0 && count === 0;
    return /* @__PURE__ */ h("section", { className: cx("tbx-col", tone && `is-${tone}`) }, /* @__PURE__ */ h("header", { className: "tbx-col-head" }, /* @__PURE__ */ h("h3", null, title, /* @__PURE__ */ h("span", null, count)), /* @__PURE__ */ h("span", { className: "tbx-col-tools" }, filter, onNew && /* @__PURE__ */ h("button", { type: "button", className: "tbx-col-add", onClick: onNew, "aria-label": tx("\u5728\u201C{{title}}\u201D\u65B0\u5EFA", { title }) }, /* @__PURE__ */ h("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", "aria-hidden": "true" }, /* @__PURE__ */ h("path", { d: "M12 5v14M5 12h14" }))))), /* @__PURE__ */ h("div", { className: "tbx-col-body" }, filtered ? /* @__PURE__ */ h("div", { className: "tbx-col-empty is-filtered" }, tx("\u6CA1\u6709\u7B26\u5408\u7B5B\u9009\u7684\u4EFB\u52A1"), /* @__PURE__ */ h("button", { type: "button", className: "tbx-col-clear", onClick: onClearFilter }, tx("\u663E\u793A\u5168\u90E8"))) : count === 0 ? /* @__PURE__ */ h("div", { className: "tbx-col-empty" }, empty) : children));
  }
  async function writeItems(value, entries, items) {
    const uuid2 = () => crypto.randomUUID();
    const send = async (method, path2, body) => {
      const res = await fetch(path2, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": uuid2() }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
    };
    const id = value.key ? value.key.entryId : value.id;
    const origin = value.key?.originDate ?? null;
    const entry = entries.find((e) => e.id === id);
    if (origin) {
      const version = value.entryVersion ?? entry?.version;
      await send("PUT", `/api/modules/schedule/entries/${id}/exceptions/${origin}`, {
        expectedVersion: version,
        mode: "override",
        content: { title: value.title, items, time: value.time, reminder: value.reminder ?? null, calendar: value.calendar }
      });
    } else {
      const base = entry ?? value;
      await send("PUT", `/api/modules/schedule/entries/${id}`, {
        title: base.title,
        items,
        time: base.time ?? null,
        repeat: base.repeat ?? null,
        reminder: base.reminder ?? null,
        calendar: base.calendar,
        expectedVersion: entry?.version ?? value.entryVersion
      });
    }
  }
  function TaskBoard({ entries, occurrences, daily, labels, zone, now, today: today2, draft, draftId, onOpen, onClose, onNew, onPatchDraft, onChanged, helpers }) {
    useLocale();
    const { localParts, formatClock } = helpers;
    const clock2 = (iso2) => formatClock(localParts(zone, Date.parse(iso2)).minutes);
    const range = (o) => o.calendar?.allDay ? tx("\u5168\u5929") : `${clock2(o.startsAt)} \u2013 ${clock2(o.endsAt)}`;
    const dateOf = (iso2) => localParts(zone, Date.parse(iso2)).date;
    const dayLabel = (date) => {
      const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today2}T00:00:00Z`)) / 864e5);
      const md = monthDay(date);
      return { name: diff === 1 ? tx("\u660E\u5929") : diff === 2 ? tx("\u540E\u5929") : weekdayName(date), md };
    };
    const [ticks, setTicks] = useState({});
    useEffect(() => {
      setTicks({});
    }, [entries, occurrences, daily]);
    const withTicks = (v) => {
      const key2 = v.key ? `${v.key.entryId}:${v.key.originDate}` : v.id;
      const t2 = ticks[key2];
      return t2 ? { ...v, items: (v.items || []).map((i) => i.id in t2 ? { ...i, completed: t2[i.id] } : i) } : v;
    };
    async function toggle(value, itemId) {
      const key2 = value.key ? `${value.key.entryId}:${value.key.originDate}` : value.id;
      const items = (value.items || []).map((i) => i.id === itemId ? { ...i, completed: !i.completed } : i);
      const next = items.find((i) => i.id === itemId).completed;
      setTicks((t2) => ({ ...t2, [key2]: { ...t2[key2] || {}, [itemId]: next } }));
      const id = value.key ? value.key.entryId : value.id;
      const origin = value.key?.originDate ?? null;
      try {
        if (draft && draft.id === id && (draft.origin ?? null) === origin && onPatchDraft) {
          onPatchDraft({ items: draft.content.items.map((i) => i.id === itemId ? { ...i, completed: next } : i) });
        } else {
          await writeItems(value, entries, items);
          await onChanged?.();
        }
      } catch {
        setTicks((t2) => ({ ...t2, [key2]: { ...t2[key2] || {}, [itemId]: !next } }));
      }
    }
    const { todayItems, laterGroups, unscheduled } = useMemo(() => {
      const sort = (a, b) => a.startsAt.localeCompare(b.startsAt);
      const todayItems2 = daily.filter((o) => Date.parse(o.endsAt) > now).sort(sort);
      const later = occurrences.filter((o) => dateOf(o.startsAt) > today2).sort(sort);
      const laterGroups2 = [];
      for (const o of later) {
        const d = dateOf(o.startsAt);
        let g = laterGroups2.find((x) => x.date === d);
        if (!g) laterGroups2.push(g = { date: d, items: [] });
        g.items.push(o);
      }
      const unscheduled2 = entries.filter((e) => !e.time).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { todayItems: todayItems2, laterGroups: laterGroups2, unscheduled: unscheduled2 };
    }, [entries, occurrences, daily, now, today2, zone]);
    const [filters, setFilterState] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem(FILTER_KEY)) || {};
      } catch {
        return {};
      }
    });
    const known = /* @__PURE__ */ new Set([...labels.map((l) => l.id), NO_TAG]);
    const filterOf = (col) => (filters[col] || []).filter((id) => known.has(id));
    const setFilter = (col, value) => {
      flipRef.capture();
      setFilterState((f) => {
        const next = { ...f, [col]: value };
        try {
          localStorage.setItem(FILTER_KEY, JSON.stringify(next));
        } catch {
        }
        return next;
      });
    };
    const flipRef = useFlip(null);
    const [settled, setSettled] = useState(false);
    useEffect(() => {
      const t2 = setTimeout(() => setSettled(true), 1200);
      return () => clearTimeout(t2);
    }, []);
    const shownToday = todayItems.filter((o) => passes(o, filterOf("today")));
    const shownLater = laterGroups.map((g) => ({ ...g, items: g.items.filter((o) => passes(o, filterOf("later"))) })).filter((g) => g.items.length);
    const shownInbox = unscheduled.filter((e) => passes(e, filterOf("inbox")));
    const laterTotal = laterGroups.reduce((n, g) => n + g.items.length, 0);
    const laterCount = shownLater.reduce((n, g) => n + g.items.length, 0);
    const isActive = (v) => (v.key ? v.key.entryId : v.id) === draftId && (draft?.origin ?? null) === (v.key?.originDate ?? null);
    const live = (v) => isActive(v) && draft?.content ? { ...v, title: draft.content.title, items: draft.content.items, calendar: { ...v.calendar, ...draft.content.calendar } } : withTicks(v);
    let index = 0;
    const card = (v, timeLabel, key2) => /* @__PURE__ */ h(TaskCard, { key: key2, value: live(v), labels, onOpen, onClose, onToggle: toggle, active: isActive(v), timeLabel, index: index++, flipRef: flipRef(key2) });
    const filterFor = (col, title) => labels.length > 0 && /* @__PURE__ */ h(TagFilter, { labels, title, value: filterOf(col), onChange: (v) => setFilter(col, v) });
    return /* @__PURE__ */ h("div", { className: cx("tbx-board", settled && "is-settled") }, /* @__PURE__ */ h("div", { className: "tbx-columns" }, /* @__PURE__ */ h(Column, { title: tx("\u4ECA\u5929"), count: shownToday.length, total: todayItems.length, tone: "today", onNew: () => onNew(false), empty: tx("\u4ECA\u5929\u7684\u5B89\u6392\u90FD\u7ED3\u675F\u4E86\uFF0C\u559D\u53E3\u6C34\u5427\u3002"), filter: filterFor("today", tx("\u4ECA\u5929")), onClearFilter: () => setFilter("today", []) }, shownToday.map((o) => card(o, range(o), `${o.key.entryId}:${o.key.originDate}`))), /* @__PURE__ */ h(Column, { title: tx("\u63A5\u4E0B\u6765"), count: laterCount, total: laterTotal, empty: tx("\u8FD9\u51E0\u5929\u8FD8\u6CA1\u6709\u522B\u7684\u5B89\u6392\u3002"), filter: filterFor("later", tx("\u63A5\u4E0B\u6765")), onClearFilter: () => setFilter("later", []) }, shownLater.map((g) => /* @__PURE__ */ h("div", { className: "tbx-day", key: g.date }, /* @__PURE__ */ h("h4", null, dayLabel(g.date).name, /* @__PURE__ */ h("span", null, dayLabel(g.date).md)), g.items.map((o) => card(o, range(o), `${o.key.entryId}:${o.key.originDate}`))))), /* @__PURE__ */ h(Column, { title: tx("\u5F85\u5B89\u6392"), count: shownInbox.length, total: unscheduled.length, tone: "inbox", onNew: () => onNew(true), empty: tx("\u6536\u4EF6\u7BB1\u7A7A\u4E86\u3002\u60F3\u5230\u8981\u505A\u7684\u4E8B\uFF0C\u968F\u624B\u8BB0\u5728\u8FD9\u91CC\u3002"), filter: filterFor("inbox", tx("\u5F85\u5B89\u6392")), onClearFilter: () => setFilter("inbox", []) }, shownInbox.map((e) => card(e, null, e.id)))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/help/content.zh.js
  var content_zh_exports = {};
  __export(content_zh_exports, {
    HOME: () => HOME,
    TOPICS: () => TOPICS2
  });
  var TOPICS2 = [
    {
      id: "start",
      icon: "sparkles",
      hue: "teal",
      title: "\u5F00\u59CB\u4F7F\u7528",
      blurb: "\u8BA4\u8BC6\u5DE5\u4F5C\u53F0\uFF0C\u51E0\u5206\u949F\u5C31\u80FD\u4E0A\u624B\u3002",
      articles: [
        {
          id: "welcome",
          title: "\u6B22\u8FCE\u4F7F\u7528 TeachBuddy",
          summary: "\u9898\u5E93\u3001\u65E5\u7A0B\u3001\u8D44\u6599\u548C\u6559\u5B66\u52A9\u7406\uFF0C\u653E\u5728\u540C\u4E00\u4E2A\u5730\u65B9\u3002",
          minutes: 3,
          blocks: [
            ["p", "TeachBuddy \u662F\u4E3A\u8001\u5E08\u51C6\u5907\u7684\u5DE5\u4F5C\u53F0\u3002\u5907\u8BFE\u7528\u7684\u9898\u76EE\u3001\u6BCF\u5468\u7684\u8BFE\u8868\u3001\u8BFE\u4EF6\u548C\u8BB2\u4E49\uFF0C\u8FD8\u6709\u4E00\u4F4D\u968F\u65F6\u53EF\u4EE5\u5546\u91CF\u7684\u6559\u5B66\u52A9\u7406\uFF0C\u90FD\u5728\u8FD9\u91CC\uFF0C\u5F7C\u6B64\u8FD8\u80FD\u4E92\u76F8\u5F15\u7528\u3002"],
            ["figure", "home", "\u9996\u9875\uFF1A\u95EE\u52A9\u7406\u4E00\u4E2A\u95EE\u9898\uFF0C\u6216\u8005\u4ECE\u5EFA\u8BAE\u5F00\u59CB\u3002"],
            ["h2", "\u56DB\u4E2A\u6A21\u5757"],
            ["list", [
              "**\u9898\u5E93**\uFF1A\u5F55\u5165\u6216\u4ECE\u8D44\u6599\u91CC\u6536\u5F55\u9898\u76EE\uFF0C\u6309\u9898\u578B\u548C\u6807\u7B7E\u6574\u7406\uFF0C\u968F\u65F6\u627E\u5230\u3002",
              "**\u65E5\u7A0B**\uFF1A\u8BFE\u7A0B\u3001\u6559\u7814\u3001\u8981\u505A\u7684\u4E8B\uFF0C\u90FD\u5728\u4E00\u4E2A\u65E5\u5386\u91CC\uFF1B\u4EFB\u52A1\u89C6\u56FE\u628A\u4E00\u5468\u644A\u5F00\u6765\u770B\u3002",
              "**\u8D44\u6E90\u5E93**\uFF1A\u8BFE\u4EF6\u3001\u8BD5\u5377\u3001\u56FE\u7247\uFF0C\u4E0A\u4F20\u540E\u53EF\u4EE5\u9884\u89C8\u548C\u590D\u7528\u3002",
              "**\u6570\u5B66\u5DE5\u574A**\uFF1A\u505A\u516C\u5F0F\u3001\u51FD\u6570\u56FE\u50CF\u548C\u8BFE\u5802\u6F14\u793A\uFF0C\u5BFC\u51FA\u540E\u76F4\u63A5\u653E\u8FDB\u8BFE\u4EF6\u3002"
            ]],
            ["h2", "\u6559\u5B66\u52A9\u7406"],
            ["p", "\u9996\u9875\u5C31\u662F\u52A9\u7406\u3002\u4F60\u53EF\u4EE5\u8BA9\u5B83\u68B3\u7406\u4E00\u8282\u8BFE\u7684\u8BB2\u89E3\u987A\u5E8F\u3001\u627E\u51E0\u9053\u7EC3\u4E60\u9898\uFF0C\u6216\u8005\u8BBE\u8BA1\u4E00\u7EC4\u5206\u5C42\u4F5C\u4E1A\u3002\u5B83\u4F1A\u53BB\u9898\u5E93\u548C\u65E5\u7A0B\u91CC\u67E5\uFF0C\u518D\u628A\u7ED3\u679C\u505A\u6210\u80FD\u76F4\u63A5\u7528\u7684\u5361\u7247\u3002"],
            ["tip", "\u7B2C\u4E00\u6B21\u6765\uFF0C\u53EF\u4EE5\u5728\u9996\u9875\u70B9 **\u8F7D\u5165\u4E00\u5468\u7684\u793A\u4F8B\u6570\u636E**\uFF0C\u770B\u770B\u5DE5\u4F5C\u53F0\u88C5\u6EE1\u65F6\u7684\u6837\u5B50\u3002"]
          ]
        },
        {
          id: "workspace",
          title: "\u8BA4\u8BC6\u5DE5\u4F5C\u53F0",
          summary: "\u4FA7\u680F\u3001\u9876\u680F\u548C\u8F85\u52A9\u680F\u5404\u7BA1\u4EC0\u4E48\u3002",
          minutes: 4,
          blocks: [
            ["p", "\u5DE5\u4F5C\u53F0\u5206\u4E09\u5757\uFF1A\u5DE6\u8FB9\u7684\u4FA7\u680F\u653E\u6A21\u5757\uFF0C\u9876\u90E8\u662F\u5BFC\u822A\u548C\u5168\u5C40\u5DE5\u5177\uFF0C\u53F3\u8FB9\u7684\u8F85\u52A9\u680F\u968F\u65F6\u628A\u52A9\u7406\u8BF7\u51FA\u6765\u3002"],
            ["figure", "shell", "\u4FA7\u680F\u3001\u9876\u680F\u548C\u8F85\u52A9\u680F\u3002"],
            ["h2", "\u4FA7\u680F"],
            ["list", [
              "\u6A21\u5757\u53EF\u4EE5\u62D6\u52A8\u6392\u5E8F\uFF0C\u4E5F\u53EF\u4EE5\u62D6\u8FDB\u4F60\u5EFA\u7684\u5206\u7EC4\u3002",
              "\u4E0D\u5E38\u7528\u7684\u6A21\u5757\u62D6\u5230 **\u5783\u573E\u6876**\uFF0C\u754C\u9762\u4F1A\u6E05\u723D\u5F88\u591A\uFF1B\u9700\u8981\u65F6\u518D\u6062\u590D\u3002",
              "\u70B9\u9876\u680F\u5DE6\u4FA7\u7684\u4FA7\u680F\u6309\u94AE\uFF0C\u53EF\u4EE5\u628A\u4FA7\u680F\u6536\u6210\u4E00\u5217\u56FE\u6807\u3002"
            ]],
            ["h2", "\u9876\u680F"],
            ["p", "\u4E2D\u95F4\u662F **\u9996\u9875**\u3001**\u65E5\u7A0B** \u548C **\u652F\u6301**\u3002\u53F3\u8FB9\u4F9D\u6B21\u662F\u641C\u7D22\u3001\u901A\u77E5\u3001\u53CD\u9988\u3001\u6559\u7A0B\u548C\u9690\u79C1\u3002"],
            ["h2", "\u8F85\u52A9\u680F"],
            ["p", "\u5728\u9898\u5E93\u3001\u65E5\u7A0B\u8FD9\u4E9B\u9875\u9762\uFF0C\u70B9\u53F3\u4E0A\u89D2\u7684\u8F85\u52A9\u680F\u6309\u94AE\uFF0C\u52A9\u7406\u4F1A\u51FA\u73B0\u5728\u53F3\u8FB9\u3002\u5B83\u770B\u5F97\u5230\u4F60\u6B63\u5728\u770B\u7684\u90A3\u9053\u9898\u6216\u90A3\u8282\u8BFE\u3002"],
            ["keys", [["\u2318K", "\u641C\u7D22\u9898\u76EE\u3001\u8D44\u6599\u548C\u4F5C\u54C1"], ["\u2318N", "\u5728\u52A9\u7406\u91CC\u65B0\u5EFA\u5BF9\u8BDD"], ["Esc", "\u5173\u95ED\u5F39\u7A97\u6216\u83DC\u5355"]]]
          ]
        },
        {
          id: "sample-data",
          title: "\u8F7D\u5165\u793A\u4F8B\u6570\u636E",
          summary: "\u7528\u4E00\u5468\u7684\u793A\u4F8B\u8BFE\u8868\u548C\u9898\u76EE\uFF0C\u5148\u628A\u6BCF\u4E2A\u529F\u80FD\u8BD5\u4E00\u904D\u3002",
          minutes: 2,
          blocks: [
            ["p", "\u7A7A\u7684\u5DE5\u4F5C\u53F0\u5F88\u96BE\u60F3\u8C61\u7528\u8D77\u6765\u7684\u6837\u5B50\u3002\u793A\u4F8B\u6570\u636E\u4F1A\u653E\u8FDB 7 \u9053\u9898\u30014 \u4EFD\u8D44\u6599\u548C\u4E00\u5468\u7684\u8BFE\u8868\uFF0C\u4F60\u53EF\u4EE5\u968F\u610F\u4FEE\u6539\u3001\u5220\u9664\u3002"],
            ["steps", [
              "\u6253\u5F00 **\u9996\u9875**\u3002",
              "\u5728\u8F93\u5165\u6846\u4E0B\u65B9\u70B9 **\u8F7D\u5165\u4E00\u5468\u7684\u793A\u4F8B\u6570\u636E**\u3002",
              "\u8F7D\u5165\u5B8C\u6210\u540E\uFF0C\u53BB **\u9898\u5E93** \u6216 **\u65E5\u7A0B** \u770B\u770B\u3002"
            ]],
            ["note", "\u793A\u4F8B\u6570\u636E\u548C\u4F60\u81EA\u5DF1\u7684\u5185\u5BB9\u653E\u5728\u4E00\u8D77\u3002\u4E0D\u9700\u8981\u65F6\uFF0C\u9010\u6761\u5220\u9664\u5373\u53EF\u3002"]
          ]
        }
      ]
    },
    {
      id: "questions",
      icon: "book",
      hue: "orange",
      title: "\u9898\u5E93",
      blurb: "\u5F55\u5165\u3001\u6536\u5F55\u548C\u6574\u7406\u9898\u76EE\uFF0C\u8BA9\u6BCF\u9053\u597D\u9898\u90FD\u627E\u5F97\u5230\u3002",
      articles: [
        {
          id: "enter",
          title: "\u5F55\u5165\u4E00\u9053\u9898",
          summary: "\u7528\u6B63\u6587\u3001\u516C\u5F0F\u548C\u56FE\u7247\u5199\u4E00\u9053\u9898\uFF0C\u518D\u8865\u4E0A\u7B54\u6848\u4E0E\u89E3\u6790\u3002",
          minutes: 3,
          blocks: [
            ["p", "\u624B\u52A8\u5F55\u9898\u9002\u5408\u4F60\u81EA\u5DF1\u51FA\u7684\u9898\uFF0C\u6216\u8005\u9700\u8981\u4ED4\u7EC6\u6392\u7248\u7684\u9898\u3002"],
            ["steps", [
              "\u5728\u9898\u5E93\u70B9 **\u624B\u52A8\u5F55\u9898**\u3002",
              "\u5199\u9898\u5E72\u3002\u516C\u5F0F\u7528 `$` \u5305\u8D77\u6765\uFF0C\u4F8B\u5982 `$y=ax^2+bx+c$`\uFF1B\u56FE\u7247\u53EF\u4EE5\u76F4\u63A5\u7C98\u8D34\u3002",
              "\u9009\u62E9 **\u9898\u578B**\uFF0C\u52A0\u4E0A\u51E0\u4E2A **\u6807\u7B7E**\uFF0C\u6BD4\u5982\u201C\u4E8C\u6B21\u51FD\u6570\u201D\u201C\u538B\u8F74\u201D\u3002",
              "\u5728\u4E0B\u65B9\u8865\u4E0A **\u7B54\u6848** \u548C **\u89E3\u6790**\uFF0C\u7136\u540E\u4FDD\u5B58\u3002"
            ]],
            ["figure", "question", "\u9898\u76EE\u7F16\u8F91\uFF1A\u9898\u5E72\u3001\u7B54\u6848\u4E0E\u89E3\u6790\u3002"],
            ["tip", "\u6807\u7B7E\u8D8A\u5177\u4F53\uFF0C\u4EE5\u540E\u8D8A\u597D\u627E\u3002\u4E00\u9053\u9898\u53EF\u4EE5\u6709\u591A\u4E2A\u6807\u7B7E\u3002"]
          ]
        },
        {
          id: "import",
          title: "\u4ECE\u8D44\u6599\u6536\u5F55\u9898\u76EE",
          summary: "\u628A\u8BD5\u5377\u6216\u8BB2\u4E49\u91CC\u7684\u9898\u76EE\u6279\u91CF\u6536\u8FDB\u9898\u5E93\u3002",
          minutes: 4,
          blocks: [
            ["p", "\u5DF2\u7ECF\u6709\u7535\u5B50\u7248\u8BD5\u5377\u6216\u8BB2\u4E49\uFF1F\u4E0D\u7528\u4E00\u9053\u9053\u91CD\u65B0\u6253\u3002\u4E0A\u4F20\u8D44\u6599\u540E\uFF0CTeachBuddy \u4F1A\u628A\u9898\u76EE\u62C6\u51FA\u6765\uFF0C\u4F60\u53EA\u9700\u8981\u6821\u5BF9\u3002"],
            ["steps", [
              "\u5728\u9898\u5E93\u70B9 **\u4ECE\u8D44\u6599\u6536\u5F55**\uFF0C\u9009\u62E9 PDF \u6216\u56FE\u7247\u3002",
              "\u7B49\u62C6\u5206\u5B8C\u6210\uFF0C\u9010\u9898\u5BF9\u7167\u539F\u7A3F\u68C0\u67E5\u9898\u5E72\u548C\u516C\u5F0F\u3002",
              "\u786E\u8BA4\u65E0\u8BEF\u7684\u9898\u76EE\uFF0C\u70B9 **\u5165\u5E93**\u3002"
            ]],
            ["note", "\u8BC6\u522B\u96BE\u514D\u51FA\u9519\uFF0C\u5C24\u5176\u662F\u624B\u5199\u548C\u590D\u6742\u516C\u5F0F\u3002\u5165\u5E93\u524D\u8BF7\u52A1\u5FC5\u5BF9\u7167\u539F\u7A3F\u3002"]
          ]
        },
        {
          id: "find",
          title: "\u67E5\u627E\u3001\u7B5B\u9009\u548C\u5F15\u7528\u9898\u76EE",
          summary: "\u6309\u9898\u578B\u3001\u6807\u7B7E\u548C\u5173\u952E\u8BCD\u627E\u9898\uFF0C\u518D\u628A\u9898\u5E26\u8FDB\u5BF9\u8BDD\u3002",
          minutes: 3,
          blocks: [
            ["p", "\u9898\u5E93\u9876\u90E8\u7684\u641C\u7D22\u4F1A\u540C\u65F6\u67E5\u9898\u5E72\u3001\u516C\u5F0F\u548C\u5907\u6CE8\u3002\u53F3\u8FB9\u7684\u7B5B\u9009\u6309\u94AE\u53EF\u4EE5\u6309\u9898\u578B\u548C\u6807\u7B7E\u7F29\u5C0F\u8303\u56F4\u3002"],
            ["h2", "\u628A\u9898\u5E26\u8FDB\u5BF9\u8BDD"],
            ["p", "\u6253\u5F00\u4E00\u9053\u9898\uFF0C\u518D\u6253\u5F00\u8F85\u52A9\u680F\uFF0C\u52A9\u7406\u5C31\u80FD\u770B\u5230\u8FD9\u9053\u9898\u3002\u70B9\u8F93\u5165\u6846\u4E0B\u65B9\u7684 **\u6B63\u5728\u770B**\uFF0C\u628A\u5B83\u5E26\u8FDB\u5BF9\u8BDD\uFF0C\u7136\u540E\u95EE\u201C\u8FD9\u9053\u9898\u600E\u4E48\u8BB2\u201D\u6216\u201C\u51FA\u4E00\u9053\u53D8\u5F0F\u9898\u201D\u3002"],
            ["tip", "\u5728\u52A9\u7406\u7684\u8F93\u5165\u6846\u91CC\u8F93\u5165 `@`\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u641C\u7D22\u5E76\u5F15\u7528\u9898\u76EE\u3002"]
          ]
        }
      ]
    },
    {
      id: "schedule",
      icon: "calendar",
      hue: "red",
      title: "\u65E5\u7A0B",
      blurb: "\u8BFE\u7A0B\u3001\u6559\u7814\u548C\u5F85\u529E\uFF0C\u4E00\u4E2A\u65E5\u5386\u5168\u88C5\u4E0B\u3002",
      articles: [
        {
          id: "tasks",
          title: "\u65B0\u5EFA\u4EFB\u52A1\u548C\u5F85\u5B89\u6392",
          summary: "\u6709\u65F6\u95F4\u7684\u653E\u8FDB\u65E5\u5386\uFF0C\u8FD8\u6CA1\u5B9A\u7684\u5148\u8BB0\u4E0B\u6765\u3002",
          minutes: 3,
          blocks: [
            ["p", "\u65E5\u7A0B\u91CC\u6709\u4E24\u79CD\u4E1C\u897F\uFF1A\u6709\u5177\u4F53\u65F6\u95F4\u7684 **\u4EFB\u52A1**\uFF0C\u548C\u8FD8\u6CA1\u5B9A\u65F6\u95F4\u7684 **\u5F85\u5B89\u6392**\u3002"],
            ["steps", [
              "\u5728\u65E5\u5386\u4E0A\u62D6\u51FA\u4E00\u6BB5\u65F6\u95F4\uFF0C\u6216\u70B9 **\uFF0B** \u65B0\u5EFA\u4EFB\u52A1\u3002",
              "\u5199\u6807\u9898\uFF0C\u9700\u8981\u7684\u8BDD\u52A0\u4E0A\u5907\u6CE8\u548C\u6807\u7B7E\u3002",
              "\u5728 **\u4E8B\u9879** \u91CC\u5217\u51FA\u8981\u505A\u7684\u5C0F\u4E8B\uFF0C\u505A\u5B8C\u4E00\u4EF6\u5212\u6389\u4E00\u4EF6\u3002",
              "\u70B9 **\u5B8C\u6210**\u3002\u5185\u5BB9\u4F1A\u81EA\u52A8\u4FDD\u5B58\u3002"
            ]],
            ["figure", "task", "\u4EFB\u52A1\uFF1A\u65F6\u95F4\u3001\u6807\u7B7E\u548C\u4E8B\u9879\u6E05\u5355\u3002"],
            ["p", "\u60F3\u5230\u4E00\u4EF6\u4E8B\u4F46\u8FD8\u6CA1\u5B9A\u65F6\u95F4\uFF1F\u5728 **\u5F85\u5B89\u6392** \u91CC\u70B9 **\uFF0B** \u5148\u8BB0\u4E0B\u6765\uFF0C\u4E4B\u540E\u518D\u70B9 **\u5B89\u6392\u65F6\u95F4** \u653E\u8FDB\u65E5\u5386\u3002"],
            ["tip", "\u4E8B\u9879\u53EF\u4EE5\u8BBE **\u91CD\u8981** \u6216 **\u7A0D\u540E**\uFF0C\u5B83\u4EEC\u4F1A\u4EE5\u5C0F\u6807\u8BB0\u51FA\u73B0\u5728\u4EFB\u52A1\u770B\u677F\u4E0A\u3002"]
          ]
        },
        {
          id: "repeat",
          title: "\u91CD\u590D\u8BFE\u7A0B\u4E0E\u63D0\u9192",
          summary: "\u6BCF\u5468\u7684\u8BFE\u53EA\u5EFA\u4E00\u6B21\uFF1B\u63D0\u9192\u4F1A\u51FA\u73B0\u5728\u9876\u680F\u7684\u901A\u77E5\u91CC\u3002",
          minutes: 3,
          blocks: [
            ["p", "\u6BCF\u5468\u56FA\u5B9A\u7684\u8BFE\uFF0C\u5EFA\u4E00\u6B21\u5C31\u591F\u4E86\u3002"],
            ["steps", [
              "\u6253\u5F00\u8BFE\u7A0B\uFF0C\u70B9 **\u91CD\u590D**\uFF0C\u9009\u62E9 **\u6BCF\u5468** \u6216 **\u6BCF\u4E2A\u5DE5\u4F5C\u65E5**\u3002",
              "\u9700\u8981\u66F4\u7EC6\u7684\u89C4\u5219\uFF0C\u9009 **\u81EA\u5B9A\u4E49\u2026**\uFF0C\u8BBE\u7F6E\u95F4\u9694\u548C\u7ED3\u675F\u65E5\u671F\u3002",
              "\u5728 **\u63D0\u9192** \u91CC\u9009\u62E9\u63D0\u524D\u591A\u4E45\u901A\u77E5\u4F60\u3002"
            ]],
            ["p", "\u53EA\u8C03\u6574\u67D0\u4E00\u6B21\u8BFE\u65F6\uFF0C\u76F4\u63A5\u6539\u90A3\u4E00\u6B21\uFF0C\u5176\u4ED6\u5468\u4FDD\u6301\u539F\u6837\u3002"],
            ["note", "\u63D0\u9192\u53EA\u51FA\u73B0\u5728 TeachBuddy \u9876\u680F\u7684\u901A\u77E5\u91CC\uFF0C\u4E0D\u4F1A\u53D1\u9001\u90AE\u4EF6\u6216\u77ED\u4FE1\u3002"]
          ]
        },
        {
          id: "board",
          title: "\u7528\u4EFB\u52A1\u770B\u677F\u5B89\u6392\u4E00\u5468",
          summary: "\u4ECA\u5929\u3001\u63A5\u4E0B\u6765\u3001\u5F85\u5B89\u6392\uFF0C\u4E00\u773C\u770B\u6E05\u3002",
          minutes: 2,
          blocks: [
            ["p", "\u5728\u65E5\u7A0B\u9876\u90E8\u5207\u6362\u5230 **\u4EFB\u52A1**\uFF0C\u4E00\u5468\u7684\u5B89\u6392\u4F1A\u6392\u6210\u4E09\u5217\uFF1A**\u4ECA\u5929**\u3001**\u63A5\u4E0B\u6765** \u548C **\u5F85\u5B89\u6392**\u3002"],
            ["list", [
              "\u5361\u7247\u4E0A\u7684\u4E8B\u9879\u53EF\u4EE5\u76F4\u63A5\u5212\u6389\uFF0C\u4E0D\u7528\u6253\u5F00\u3002",
              "\u6BCF\u5F20\u5361\u7247\u663E\u793A\u65F6\u95F4\u6BB5\u548C\u6807\u7B7E\uFF0C\u91CD\u8981\u7684\u4E8B\u9879\u5E26\u7EA2\u8272\u6807\u8BB0\u3002",
              "\u70B9\u5361\u7247\uFF0C\u53F3\u8FB9\u4F1A\u6253\u5F00\u7F16\u8F91\u9762\u677F\u3002"
            ]],
            ["figure", "board", "\u4EFB\u52A1\u770B\u677F\u3002"]
          ]
        }
      ]
    },
    {
      id: "assistant",
      icon: "assistant",
      hue: "indigo",
      title: "\u6559\u5B66\u52A9\u7406",
      blurb: "\u548C\u52A9\u7406\u5546\u91CF\u5907\u8BFE\uFF0C\u8BA9\u5B83\u53BB\u9898\u5E93\u548C\u65E5\u7A0B\u91CC\u67E5\u3002",
      articles: [
        {
          id: "plan",
          title: "\u7528\u52A9\u7406\u5907\u4E00\u8282\u8BFE",
          summary: "\u4ECE\u8BB2\u89E3\u987A\u5E8F\u5230\u8BFE\u5802\u7EC3\u4E60\uFF0C\u4E00\u6BB5\u5BF9\u8BDD\u5C31\u80FD\u7406\u6E05\u3002",
          minutes: 4,
          blocks: [
            ["p", "\u5728\u9996\u9875\u7684\u6807\u9898\u91CC\u9009\u4E00\u8282\u63A5\u4E0B\u6765\u7684\u8BFE\uFF0C\u4E0B\u9762\u7684\u5EFA\u8BAE\u4F1A\u6362\u6210\u8FD9\u8282\u8BFE\u7684\uFF1A\u68B3\u7406\u8BB2\u89E3\u987A\u5E8F\u3001\u627E\u7EC3\u4E60\u9898\u3001\u6784\u601D\u6F14\u793A\u3001\u8BBE\u8BA1\u5206\u5C42\u4F5C\u4E1A\u3002"],
            ["figure", "assistant", "\u52A9\u7406\u5148\u67E5\u9898\u5E93\u548C\u65E5\u7A0B\uFF0C\u518D\u7ED9\u51FA\u80FD\u76F4\u63A5\u7528\u7684\u7ED3\u679C\u3002"],
            ["h2", "\u56DE\u7B54\u91CC\u7684\u5361\u7247"],
            ["list", [
              "**\u8BB2\u89E3\u987A\u5E8F**\uFF1A\u70B9 **\u52A0\u5230\u65E5\u7A0B**\uFF0C\u53D8\u6210\u5F85\u5B89\u6392\u91CC\u7684\u4E00\u9879\uFF0C\u6B65\u9AA4\u6210\u4E3A\u4E8B\u9879\u6E05\u5355\u3002",
              "**\u627E\u5230\u7684\u9898**\uFF1A\u70B9\u5F00\u53BB\u9898\u5E93\uFF0C\u6216\u5F15\u7528\u5230\u5BF9\u8BDD\u91CC\u7EE7\u7EED\u804A\u3002",
              "**\u5206\u5C42\u7EC3\u4E60\u548C\u53D8\u5F0F\u9898**\uFF1A\u70B9 **\u5B58\u8FDB\u9898\u5E93**\u3002"
            ]],
            ["tip", "\u56DE\u7B54\u4E0D\u6EE1\u610F\uFF1F\u70B9\u56DE\u7B54\u4E0B\u65B9\u7684 **\u91CD\u65B0\u56DE\u7B54**\uFF0C\u6216\u8005\u76F4\u63A5\u544A\u8BC9\u5B83\u54EA\u91CC\u8981\u6539\u3002"]
          ]
        },
        {
          id: "reference",
          title: "\u5F15\u7528\u9898\u76EE\u3001\u65E5\u7A0B\u548C\u8D44\u6599",
          summary: "\u7528 @ \u628A\u5DE5\u4F5C\u53F0\u91CC\u7684\u5185\u5BB9\u5E26\u8FDB\u5BF9\u8BDD\u3002",
          minutes: 2,
          blocks: [
            ["p", "\u5728\u8F93\u5165\u6846\u91CC\u8F93\u5165 `@`\uFF0C\u6216\u70B9\u8F93\u5165\u6846\u5DE6\u4E0B\u7684 **@** \u6309\u94AE\uFF0C\u5C31\u80FD\u641C\u7D22\u9898\u76EE\u3001\u65E5\u7A0B\u548C\u8D44\u6599\u3002\u9009\u4E2D\u7684\u5185\u5BB9\u4F1A\u4EE5\u5F69\u8272\u5C0F\u6807\u7B7E\u51FA\u73B0\u5728\u8F93\u5165\u6846\u4E0B\u65B9\u3002"],
            ["list", [
              "\u6A59\u8272\u662F\u9898\u76EE\uFF0C\u975B\u84DD\u662F\u65E5\u7A0B\uFF0C\u84DD\u8272\u662F\u8D44\u6599\u3002",
              "\u70B9\u6807\u7B7E\u4E0A\u7684 **\xD7** \u53EF\u4EE5\u79FB\u9664\u3002"
            ]],
            ["note", "\u5728\u8F85\u52A9\u680F\u91CC\uFF0C\u52A9\u7406\u4F1A\u63D0\u793A\u4F60 **\u6B63\u5728\u770B** \u7684\u5185\u5BB9\uFF0C\u4F46\u53EA\u6709\u4F60\u70B9\u4E86\u624D\u4F1A\u5E26\u8FDB\u5BF9\u8BDD\u3002"]
          ]
        },
        {
          id: "threads",
          title: "\u7BA1\u7406\u5BF9\u8BDD",
          summary: "\u7F6E\u9876\u3001\u91CD\u547D\u540D\u548C\u5220\u9664\u5BF9\u8BDD\u3002",
          minutes: 2,
          blocks: [
            ["p", "\u9996\u9875\u5DE6\u8FB9\u662F\u5168\u90E8\u5BF9\u8BDD\uFF0C\u6309\u4ECA\u5929\u3001\u6628\u5929\u3001\u6700\u8FD1 7 \u5929\u5206\u7EC4\u3002\u60AC\u505C\u5728\u4E00\u6BB5\u5BF9\u8BDD\u4E0A\uFF0C\u70B9 **\u2026**\uFF1A"],
            ["list", ["**\u7F6E\u9876**\uFF1A\u56FA\u5B9A\u5728\u5217\u8868\u6700\u4E0A\u9762\u3002", "**\u91CD\u547D\u540D**\uFF1A\u8D77\u4E00\u4E2A\u597D\u627E\u7684\u540D\u5B57\u3002", "**\u5220\u9664**\uFF1A\u9700\u8981\u518D\u70B9\u4E00\u6B21\u786E\u8BA4\u3002"]],
            ["keys", [["\u2318N", "\u65B0\u5BF9\u8BDD"]]]
          ]
        }
      ]
    },
    {
      id: "math",
      icon: "math",
      hue: "purple",
      title: "\u6570\u5B66\u5DE5\u574A",
      blurb: "\u505A\u516C\u5F0F\u3001\u56FE\u50CF\u548C\u8BFE\u5802\u6F14\u793A\uFF0C\u5BFC\u51FA\u540E\u76F4\u63A5\u7528\u3002",
      articles: [
        {
          id: "create",
          title: "\u521B\u5EFA\u7B2C\u4E00\u4E2A\u4F5C\u54C1",
          summary: "\u516C\u5F0F\u3001\u51FD\u6570\u3001\u5E73\u9762\u56FE\u5F62\u3001\u7A7A\u95F4\u56FE\u5F62\u548C\u6F14\u793A\u3002",
          minutes: 3,
          blocks: [
            ["p", "\u6570\u5B66\u5DE5\u574A\u91CC\u7684\u6BCF\u4E00\u4EFD\u5185\u5BB9\u53EB\u4E00\u4E2A **\u4F5C\u54C1**\u3002"],
            ["steps", [
              "\u70B9 **\u65B0\u5EFA\u4F5C\u54C1**\uFF0C\u9009\u62E9\u7C7B\u578B\u3002",
              "\u5728\u53F3\u8FB9\u7684\u5DE5\u5177\u91CC\u8C03\u6574\u53C2\u6570\u548C\u6837\u5F0F\uFF0C\u753B\u5E03\u5B9E\u65F6\u66F4\u65B0\u3002",
              "\u8D77\u4E2A\u540D\u5B57\uFF0C\u4FDD\u5B58\u3002"
            ]],
            ["figure", "math", "\u4E00\u4E2A\u629B\u7269\u7EBF\u6F14\u793A\uFF1A\u62D6\u52A8\u6ED1\u5757\u6539\u53D8 a \u7684\u503C\u3002"],
            ["tip", "\u6F14\u793A\u9002\u5408\u653E\u6ED1\u5757\uFF1A\u5B66\u751F\u80FD\u4EB2\u773C\u770B\u5230\u53C2\u6570\u53D8\u5316\u5E26\u6765\u7684\u7ED3\u679C\u3002"]
          ]
        },
        {
          id: "export",
          title: "\u5BFC\u51FA\u5230\u8BFE\u4EF6",
          summary: "PNG\u3001SVG \u6216\u53EF\u79BB\u7EBF\u6253\u5F00\u7684 HTML\u3002",
          minutes: 2,
          blocks: [
            ["list", [
              "**PNG**\uFF1A\u76F4\u63A5\u8D34\u8FDB\u5E7B\u706F\u7247\u3002",
              "**SVG**\uFF1A\u653E\u5927\u4E5F\u6E05\u6670\uFF0C\u9002\u5408\u6253\u5370\u3002",
              "**HTML**\uFF1A\u6F14\u793A\u53EF\u4EE5\u79BB\u7EBF\u6253\u5F00\uFF0C\u5728\u8BFE\u5802\u4E0A\u76F4\u63A5\u64CD\u4F5C\u3002"
            ]],
            ["note", "\u5BFC\u51FA\u540E\u5148\u5728\u672C\u5730\u6253\u5F00\u68C0\u67E5\u4E00\u904D\u663E\u793A\u6548\u679C\uFF0C\u518D\u5E26\u8FDB\u8BFE\u5802\u3002"]
          ]
        }
      ]
    },
    {
      id: "resources",
      icon: "folder",
      hue: "blue",
      title: "\u8D44\u6E90\u5E93",
      blurb: "\u4E0A\u4F20\u3001\u9884\u89C8\u548C\u590D\u7528\u8BFE\u4EF6\u3001\u8BD5\u5377\u4E0E\u56FE\u7247\u3002",
      articles: [
        {
          id: "upload",
          title: "\u4E0A\u4F20\u4E0E\u6574\u7406\u8D44\u6599",
          summary: "\u7528\u6587\u4EF6\u5939\u548C\u6807\u7B7E\u7BA1\u7406\uFF0C\u7528\u641C\u7D22\u5FEB\u901F\u627E\u5230\u3002",
          minutes: 3,
          blocks: [
            ["steps", [
              "\u5728\u8D44\u6E90\u5E93\u70B9 **\u4E0A\u4F20\u8D44\u6599**\uFF0C\u9009\u62E9\u6587\u4EF6\u3002",
              "\u586B\u5199\u540D\u79F0\uFF0C\u653E\u8FDB\u6587\u4EF6\u5939\uFF0C\u52A0\u4E0A\u6807\u7B7E\u548C\u5907\u6CE8\u3002",
              "\u4FDD\u5B58\u540E\u70B9\u5361\u7247\u5373\u53EF\u9884\u89C8\uFF0C\u6216\u4E0B\u8F7D\u539F\u6587\u4EF6\u3002"
            ]],
            ["figure", "resources", "\u8D44\u6E90\u5E93\uFF1A\u7F51\u683C\u89C6\u56FE\u3002"],
            ["tip", "\u7528 **\u6587\u4EF6\u5939\u4E0E\u6807\u7B7E** \u7EDF\u4E00\u7BA1\u7406\u5206\u7C7B\uFF1B\u5207\u6362\u5230\u5217\u8868\u89C6\u56FE\u80FD\u770B\u5230\u66F4\u591A\u4FE1\u606F\u3002"]
          ]
        },
        {
          id: "replace",
          title: "\u66FF\u6362\u6587\u4EF6",
          summary: "\u6362\u6389\u6587\u4EF6\uFF0C\u540D\u79F0\u3001\u6587\u4EF6\u5939\u548C\u5907\u6CE8\u90FD\u4FDD\u7559\u3002",
          minutes: 1,
          blocks: [
            ["p", "\u8BFE\u4EF6\u6539\u4E86\u4E00\u7248\uFF1F\u6253\u5F00\u8D44\u6599\uFF0C\u70B9 **\u66FF\u6362\u6587\u4EF6**\uFF0C\u9009\u65B0\u7684\u6587\u4EF6\u5373\u53EF\u3002\u540D\u79F0\u3001\u6587\u4EF6\u5939\u3001\u6807\u7B7E\u548C\u5907\u6CE8\u90FD\u4E0D\u53D8\u3002"],
            ["note", "\u4E0A\u4F20\u8FD8\u6CA1\u5B8C\u6210\u5C31\u5173\u6389\u4E86\u9875\u9762\uFF1F\u91CD\u65B0\u6253\u5F00\u540E\u6309\u63D0\u793A\u91CD\u9009\u540C\u4E00\u4E2A\u6587\u4EF6\uFF0C\u518D\u786E\u8BA4\u4E0A\u4F20\u7ED3\u679C\u3002"]
          ]
        }
      ]
    },
    {
      id: "account",
      icon: "shield",
      hue: "green",
      title: "\u8D26\u6237\u4E0E\u6570\u636E",
      blurb: "\u4FDD\u5B58\u72B6\u6001\u3001\u5BFC\u51FA\u8D44\u6599\uFF0C\u4EE5\u53CA\u5916\u89C2\u548C\u8BED\u8A00\u3002",
      articles: [
        {
          id: "saving",
          title: "\u4FDD\u5B58\u72B6\u6001\u4E0E\u7248\u672C\u51B2\u7A81",
          summary: "\u201C\u5DF2\u4FDD\u5B58\u201D\u662F\u4EC0\u4E48\u610F\u601D\uFF0C\u5185\u5BB9\u5728\u522B\u5904\u88AB\u6539\u4E86\u600E\u4E48\u529E\u3002",
          minutes: 3,
          blocks: [
            ["p", "\u4F60\u7684\u4FEE\u6539\u4F1A\u81EA\u52A8\u4FDD\u5B58\u3002\u770B\u5230 **\u5DF2\u4FDD\u5B58**\uFF0C\u8868\u793A\u670D\u52A1\u5668\u5DF2\u7ECF\u786E\u8BA4\u3002"],
            ["h2", "\u6682\u65F6\u6CA1\u6CD5\u786E\u8BA4"],
            ["p", "\u7F51\u7EDC\u4E0D\u597D\u65F6\u4F1A\u663E\u793A **\u6682\u65F6\u65E0\u6CD5\u786E\u8BA4\u662F\u5426\u4FDD\u5B58**\u3002\u5148\u70B9 **\u91CD\u8BD5\u786E\u8BA4**\uFF0C\u7CFB\u7EDF\u4F1A\u7528\u539F\u6765\u7684\u8BF7\u6C42\u6838\u5B9E\u7ED3\u679C\uFF0C\u4E0D\u4F1A\u91CD\u590D\u521B\u5EFA\u3002"],
            ["h2", "\u5185\u5BB9\u5DF2\u5728\u522B\u5904\u4FEE\u6539"],
            ["p", "\u540C\u4E00\u4EFD\u5185\u5BB9\u5728\u53E6\u4E00\u53F0\u8BBE\u5907\u4E0A\u6539\u8FC7\uFF0C\u4F1A\u51FA\u73B0\u51B2\u7A81\u63D0\u793A\u3002\u5148\u770B\u770B\u670D\u52A1\u5668\u4E0A\u7684\u7248\u672C\uFF0C\u518D\u51B3\u5B9A\u4FDD\u7559\u54EA\u4E00\u4EFD\u3002\u9700\u8981\u4FDD\u7559\u7684\u672C\u5730\u5185\u5BB9\uFF0C\u5148\u590D\u5236\u4E0B\u6765\u3002"],
            ["note", "\u4E0D\u8981\u901A\u8FC7\u6E05\u9664\u6D4F\u89C8\u5668\u6570\u636E\u6765\u5904\u7406\u4FDD\u5B58\u95EE\u9898\uFF0C\u90A3\u4F1A\u4E22\u6389\u8FD8\u6CA1\u4FDD\u5B58\u7684\u8349\u7A3F\u3002"]
          ]
        },
        {
          id: "export",
          title: "\u5BFC\u51FA\u4E0E\u5220\u9664\u6570\u636E",
          summary: "\u628A\u5168\u90E8\u8D44\u6599\u6253\u5305\u5E26\u8D70\uFF0C\u6216\u8005\u5220\u9664\u8D26\u6237\u3002",
          minutes: 2,
          blocks: [
            ["steps", [
              "\u6253\u5F00 **\u8BBE\u7F6E**\uFF0C\u5728 **\u60A8\u7684\u6570\u636E** \u4E00\u884C\u70B9 **\u5BFC\u51FA\u6570\u636E**\u3002",
              "\u8D44\u6599\u5305\u751F\u6210\u540E\u70B9 **\u4E0B\u8F7D**\uFF0C\u89E3\u538B\u540E\u6253\u5F00 `index.html` \u9605\u8BFB\u3002",
              "\u4E0D\u518D\u9700\u8981\u7684\u8D44\u6599\u5305\uFF0C\u70B9\u65C1\u8FB9\u7684\u5783\u573E\u6876\u5220\u9664\u3002"
            ]],
            ["p", "\u8981\u5220\u9664\u8D26\u6237\uFF0C\u5728\u8BBE\u7F6E\u6700\u4E0B\u65B9\u7684 **\u5371\u9669\u64CD\u4F5C** \u91CC\u70B9 **\u5220\u9664\u8D26\u6237\u2026**\uFF0C\u8F93\u5165\u90AE\u7BB1\u786E\u8BA4\u3002\u8FD9\u4E00\u6B65\u65E0\u6CD5\u64A4\u9500\u3002"],
            ["note", "\u5DF2\u7ECF\u4E0B\u8F7D\u5230\u672C\u5730\u7684\u6587\u4EF6\u4E0D\u4F1A\u56E0\u4E3A\u5220\u9664\u8D26\u6237\u800C\u6D88\u5931\u3002"]
          ]
        },
        {
          id: "appearance",
          title: "\u5916\u89C2\u3001\u8BED\u8A00\u4E0E\u80CC\u666F",
          summary: "\u6D45\u8272\u6216\u6DF1\u8272\u3001\u4E2D\u6587\u6216\u82F1\u6587\uFF0C\u4EE5\u53CA\u4F60\u81EA\u5DF1\u7684\u80CC\u666F\u56FE\u3002",
          minutes: 2,
          blocks: [
            ["p", "\u5728 **\u8BBE\u7F6E** \u91CC\uFF1A"],
            ["list", [
              "**\u5916\u89C2**\uFF1A\u6D45\u8272\u6216\u6DF1\u8272\u3002",
              "**\u8BED\u8A00**\uFF1A\u7B80\u4F53\u4E2D\u6587\u6216 English\uFF0C\u754C\u9762\u7ACB\u5373\u5207\u6362\u3002",
              "**\u5185\u5BB9\u80CC\u666F**\uFF1A\u7F51\u683C\u3001\u7F8A\u76AE\u7EB8\u3001\u5706\u5F62\uFF0C\u6216\u70B9 **\u81EA\u5B9A\u4E49** \u4E0A\u4F20\u4E00\u5F20\u81EA\u5DF1\u7684\u56FE\u7247\u3002"
            ]],
            ["tip", "\u81EA\u5B9A\u4E49\u80CC\u666F\u4E0A\u4F1A\u76D6\u4E00\u5C42\u6DE1\u6DE1\u7684\u753B\u5E03\u8272\uFF0C\u6587\u5B57\u59CB\u7EC8\u770B\u5F97\u6E05\u3002"]
          ]
        }
      ]
    }
  ];
  var HOME = {
    featured: [["start", "welcome"], ["assistant", "plan"], ["questions", "import"]],
    popular: [["schedule", "repeat"], ["account", "saving"], ["math", "export"], ["questions", "find"], ["account", "export"]],
    searches: ["\u91CD\u590D\u8BFE\u7A0B", "\u5BFC\u51FA\u8D44\u6599", "\u516C\u5F0F", "\u63D0\u9192", "\u6536\u5F55"]
  };

  // docs/design-system/teachbuddy-app/ui/tbx/src/help/content.en.js
  var content_en_exports = {};
  __export(content_en_exports, {
    HOME: () => HOME2,
    TOPICS: () => TOPICS3
  });
  var TOPICS3 = [
    {
      id: "start",
      icon: "sparkles",
      hue: "teal",
      title: "Get Started",
      blurb: "Meet the workbench and be up and running in minutes.",
      articles: [
        {
          id: "welcome",
          title: "Welcome to TeachBuddy",
          summary: "Questions, schedule, files and an assistant, all in one place.",
          minutes: 3,
          blocks: [
            ["p", "TeachBuddy is a workbench made for teachers. The questions you teach with, your weekly timetable, slides and handouts, and an assistant you can think things through with all live here, and each can reference the others."],
            ["figure", "home", "Home: ask the assistant something, or start with a suggestion."],
            ["h2", "Four modules"],
            ["list", [
              "**Question Bank**: enter questions or import them from files, organize by type and tag, and find them in seconds.",
              "**Schedule**: classes, meetings and to-dos in one calendar. The task view lays out your whole week.",
              "**Resource Library**: slides, tests and images you can preview and reuse.",
              "**Math Workshop**: formulas, graphs and classroom demos you can drop straight into slides."
            ]],
            ["h2", "The assistant"],
            ["p", "Home is the assistant. Ask it to plan a lesson\u2019s teaching order, find practice questions, or design tiered homework. It checks your question bank and schedule, then turns the results into cards you can use right away."],
            ["tip", "New here? On Home, click **Load a week of sample data** to see the workbench in full swing."]
          ]
        },
        {
          id: "workspace",
          title: "Find Your Way Around",
          summary: "What the sidebar, top bar and side panel are for.",
          minutes: 4,
          blocks: [
            ["p", "The workbench has three parts: the sidebar on the left holds your modules, the top bar carries navigation and global tools, and the side panel brings the assistant in whenever you need it."],
            ["figure", "shell", "Sidebar, top bar and side panel."],
            ["h2", "Sidebar"],
            ["list", [
              "Drag modules to reorder them, or into groups you create.",
              "Drag modules you rarely use to **Trash** to keep things tidy. Restore them anytime.",
              "Click the sidebar button in the top bar to shrink the sidebar to icons."
            ]],
            ["h2", "Top bar"],
            ["p", "In the middle are **Home**, **Schedule** and **Support**. On the right: search, notifications, feedback, tutorial and privacy."],
            ["h2", "Side panel"],
            ["p", "On pages like Question Bank and Schedule, click the side panel button at the top right and the assistant appears beside your work. It can see the question or lesson you\u2019re looking at."],
            ["keys", [["\u2318K", "Search questions, files and works"], ["\u2318N", "New chat with the assistant"], ["Esc", "Close a dialog or menu"]]]
          ]
        },
        {
          id: "sample-data",
          title: "Load Sample Data",
          summary: "Try every feature with a sample week of classes and questions.",
          minutes: 2,
          blocks: [
            ["p", "An empty workbench is hard to picture. Sample data adds 7 questions, 4 files and a week of classes that you can edit or delete freely."],
            ["steps", ["Open **Home**.", "Below the input, click **Load a week of sample data**.", "When it\u2019s done, take a look at **Question Bank** or **Schedule**."]],
            ["note", "Sample data sits alongside your own content. Delete items one by one when you no longer need them."]
          ]
        }
      ]
    },
    {
      id: "questions",
      icon: "book",
      hue: "orange",
      title: "Question Bank",
      blurb: "Enter, import and organize questions so every good one is easy to find.",
      articles: [
        {
          id: "enter",
          title: "Enter a Question",
          summary: "Write a question with text, formulas and images, then add the answer.",
          minutes: 3,
          blocks: [
            ["p", "Entering a question by hand works best for questions you write yourself, or ones that need careful layout."],
            ["steps", [
              "In Question Bank, click **New Question**.",
              "Write the stem. Wrap formulas in `$`, like `$y=ax^2+bx+c$`, and paste images directly.",
              "Choose a **type** and add a few **tags**, such as \u201CQuadratics\u201D or \u201CChallenging\u201D.",
              "Add the **answer** and **explanation** below, then save."
            ]],
            ["figure", "question", "Editing a question: stem, answer and explanation."],
            ["tip", "The more specific your tags, the easier questions are to find later. A question can have several."]
          ]
        },
        {
          id: "import",
          title: "Import Questions from Files",
          summary: "Bring a whole test or handout into the bank at once.",
          minutes: 4,
          blocks: [
            ["p", "Already have a test or handout as a file? No need to retype it. Upload it, TeachBuddy splits it into questions, and you just check them."],
            ["steps", ["In Question Bank, click **Import** and choose a PDF or image.", "When splitting finishes, compare each question and formula with the original.", "For questions that look right, click **Add to Bank**."]],
            ["note", "Recognition can make mistakes, especially with handwriting and complex formulas. Always check against the original first."]
          ]
        },
        {
          id: "find",
          title: "Find, Filter and Reference Questions",
          summary: "Search by type, tag and keyword, then bring a question into the chat.",
          minutes: 3,
          blocks: [
            ["p", "Search at the top of Question Bank looks through stems, formulas and notes. The filter button beside it narrows results by type and tag."],
            ["h2", "Bring a question into the chat"],
            ["p", "Open a question, then open the side panel, and the assistant can see it. Click **Looking at** below the input to bring it into the conversation, then ask \u201CHow should I teach this?\u201D or \u201CWrite a variant.\u201D"],
            ["tip", "You can also type `@` in the assistant\u2019s input to search for and reference a question."]
          ]
        }
      ]
    },
    {
      id: "schedule",
      icon: "calendar",
      hue: "red",
      title: "Schedule",
      blurb: "Classes, meetings and to-dos, all in one calendar.",
      articles: [
        {
          id: "tasks",
          title: "Create Tasks and Unscheduled Items",
          summary: "Put timed things on the calendar; jot down the rest for later.",
          minutes: 3,
          blocks: [
            ["p", "Schedule holds two kinds of things: **tasks** with a set time, and **unscheduled** items that don\u2019t have one yet."],
            ["steps", [
              "Drag across the calendar, or click **\uFF0B** to create a task.",
              "Add a title, plus notes and labels if you like.",
              "List small steps under **Checklist** and check them off as you go.",
              "Click **Done**. Everything saves automatically."
            ]],
            ["figure", "task", "A task: time, labels and checklist."],
            ["p", "Thought of something but not sure when? Click **\uFF0B** in **Unscheduled** to jot it down, then **Add a time** later."],
            ["tip", "Mark checklist items **High** or **Later**. They show as small badges on the task board."]
          ]
        },
        {
          id: "repeat",
          title: "Repeating Classes and Reminders",
          summary: "Create a weekly class once. Reminders appear in your notifications.",
          minutes: 3,
          blocks: [
            ["p", "A class that meets every week only needs to be created once."],
            ["steps", ["Open the class, click **Repeat**, and choose **Weekly** or **Every weekday**.", "For finer control, choose **Custom\u2026** and set the interval and end date.", "Under **Reminder**, choose how far ahead to be notified."]],
            ["p", "To change just one class, edit that one. The other weeks stay as they are."],
            ["note", "Reminders appear only in TeachBuddy\u2019s notifications. No email or text messages are sent."]
          ]
        },
        {
          id: "board",
          title: "Plan Your Week on the Task Board",
          summary: "Today, Coming up and Unscheduled at a glance.",
          minutes: 2,
          blocks: [
            ["p", "Switch to **Task** at the top of Schedule and your week lays out in three columns: **Today**, **Coming up** and **Unscheduled**."],
            ["list", ["Check off items right on the card without opening it.", "Each card shows its time range and labels; important items carry a red badge.", "Click a card to edit it in the panel on the right."]],
            ["figure", "board", "The task board."]
          ]
        }
      ]
    },
    {
      id: "assistant",
      icon: "assistant",
      hue: "indigo",
      title: "Assistant",
      blurb: "Plan lessons together; let it check your bank and schedule.",
      articles: [
        {
          id: "plan",
          title: "Plan a Lesson with the Assistant",
          summary: "From teaching order to practice questions in one conversation.",
          minutes: 4,
          blocks: [
            ["p", "Pick an upcoming lesson in the title on Home, and the suggestions below change to match it: plan the teaching order, find practice questions, design a demo, build tiered homework."],
            ["figure", "assistant", "The assistant checks your bank and schedule first, then gives you results you can use."],
            ["h2", "Cards in an answer"],
            ["list", [
              "**Teaching order**: click **Add to Schedule** to turn it into an unscheduled item with the steps as a checklist.",
              "**Questions found**: open one in Question Bank, or add it to the chat.",
              "**Tiered practice and variants**: click **Save to Question Bank**."
            ]],
            ["tip", "Not quite right? Click **Regenerate** below the answer, or just tell it what to change."]
          ]
        },
        {
          id: "reference",
          title: "Reference Questions, Events and Files",
          summary: "Use @ to bring things from your workbench into the chat.",
          minutes: 2,
          blocks: [
            ["p", "Type `@` in the input, or click the **@** button at its lower left, to search questions, events and files. Your picks appear as colored chips below the input."],
            ["list", ["Orange is a question, indigo an event, blue a file.", "Click **\xD7** on a chip to remove it."]],
            ["note", "In the side panel, the assistant suggests what you\u2019re **Looking at**, but only brings it into the chat when you click it."]
          ]
        },
        {
          id: "threads",
          title: "Manage Conversations",
          summary: "Pin, rename and delete conversations.",
          minutes: 2,
          blocks: [
            ["p", "All your conversations are on the left of Home, grouped by Today, Yesterday and Previous 7 days. Hover over one and click **\u2026**:"],
            ["list", ["**Pin**: keep it at the top.", "**Rename**: give it a name that\u2019s easy to find.", "**Delete**: click again to confirm."]],
            ["keys", [["\u2318N", "New chat"]]]
          ]
        }
      ]
    },
    {
      id: "math",
      icon: "math",
      hue: "purple",
      title: "Math Workshop",
      blurb: "Make formulas, graphs and classroom demos ready to use.",
      articles: [
        {
          id: "create",
          title: "Create Your First Work",
          summary: "Formulas, functions, plane and solid figures, and demos.",
          minutes: 3,
          blocks: [
            ["p", "Everything you make in Math Workshop is called a **work**."],
            ["steps", ["Click **New work** and choose a type.", "Adjust parameters and style in the tools on the right. The canvas updates as you go.", "Give it a name and save."]],
            ["figure", "math", "A parabola demo: drag the slider to change a."],
            ["tip", "Demos shine with sliders: students see for themselves what a parameter changes."]
          ]
        },
        {
          id: "export",
          title: "Export to Your Slides",
          summary: "PNG, SVG, or HTML that opens offline.",
          minutes: 2,
          blocks: [
            ["list", ["**PNG**: paste straight into a slide.", "**SVG**: stays sharp at any size; good for printing.", "**HTML**: demos open offline and stay interactive in class."]],
            ["note", "Open the exported file once on your own computer to check it before class."]
          ]
        }
      ]
    },
    {
      id: "resources",
      icon: "folder",
      hue: "blue",
      title: "Resource Library",
      blurb: "Upload, preview and reuse slides, tests and images.",
      articles: [
        {
          id: "upload",
          title: "Upload and Organize Files",
          summary: "Folders and tags to organize; search to find.",
          minutes: 3,
          blocks: [
            ["steps", ["In Resource Library, click **Upload materials** and choose a file.", "Give it a name, put it in a folder, and add tags and notes.", "After saving, click the card to preview it or download the original."]],
            ["figure", "resources", "Resource Library in grid view."],
            ["tip", "Manage categories in one place with **Folders and tags**. Switch to list view to see more detail."]
          ]
        },
        {
          id: "replace",
          title: "Replace a File",
          summary: "Swap the file; keep its name, folder and notes.",
          minutes: 1,
          blocks: [
            ["p", "Updated your slides? Open the file, click **Replace file**, and choose the new version. Name, folder, tags and notes all stay."],
            ["note", "Closed the page before an upload finished? When you come back, choose the same file again when asked, then confirm the result."]
          ]
        }
      ]
    },
    {
      id: "account",
      icon: "shield",
      hue: "green",
      title: "Account & Data",
      blurb: "Saving, exporting your data, appearance and language.",
      articles: [
        {
          id: "saving",
          title: "Saving and Version Conflicts",
          summary: "What \u201CSaved\u201D means, and what to do when something changed elsewhere.",
          minutes: 3,
          blocks: [
            ["p", "Your changes save automatically. **Saved** means the server has confirmed them."],
            ["h2", "Can\u2019t confirm right now"],
            ["p", "On a weak connection you may see **Can\u2019t confirm whether this was saved**. Click **Retry confirmation** first. TeachBuddy checks the original request, so nothing is created twice."],
            ["h2", "Changed somewhere else"],
            ["p", "If the same item was edited on another device, you\u2019ll see a conflict. Look at the server\u2019s version first, then decide which to keep. Copy any local text you want to hold on to."],
            ["note", "Don\u2019t clear your browser data to fix saving problems. You\u2019ll lose drafts that haven\u2019t been saved yet."]
          ]
        },
        {
          id: "export",
          title: "Export and Delete Your Data",
          summary: "Take everything with you, or delete your account.",
          minutes: 2,
          blocks: [
            ["steps", ["Open **Settings** and click **Export data** in the **Your data** row.", "When the package is ready, click **Download**, unzip it and open `index.html`.", "Delete packages you no longer need with the trash button beside them."]],
            ["p", "To delete your account, click **Delete Account\u2026** in the **Danger Zone** at the bottom of Settings and confirm with your email. This can\u2019t be undone."],
            ["note", "Files you\u2019ve already downloaded stay on your computer after your account is deleted."]
          ]
        },
        {
          id: "appearance",
          title: "Appearance, Language and Background",
          summary: "Light or dark, Chinese or English, and a background of your own.",
          minutes: 2,
          blocks: [
            ["p", "In **Settings**:"],
            ["list", ["**Appearance**: Light or Dark.", "**Language**: \u7B80\u4F53\u4E2D\u6587 or English. The interface switches right away.", "**Content background**: Grid, Parchment, Circles, or click **Custom** to upload your own picture."]],
            ["tip", "A custom background gets a soft veil of the canvas color so text always stays readable."]
          ]
        }
      ]
    }
  ];
  var HOME2 = {
    featured: [["start", "welcome"], ["assistant", "plan"], ["questions", "import"]],
    popular: [["schedule", "repeat"], ["account", "saving"], ["math", "export"], ["questions", "find"], ["account", "export"]],
    searches: ["repeat", "export", "formula", "reminder", "import"]
  };

  // docs/design-system/teachbuddy-app/ui/tbx/src/help/Figure.jsx
  var W = 640;
  var H = 360;
  var Line = ({ x, y, w, h: ht = 7, o = 1, accent }) => /* @__PURE__ */ h("rect", { x, y, width: w, height: ht, rx: ht / 2, fill: accent ? "var(--fig-accent)" : "var(--fig-ink)", opacity: accent ? 0.9 : 0.16 * o });
  var Box = ({ x, y, w, h: ht, r = 12, fill = "var(--fig-card)", stroke = true, tint }) => /* @__PURE__ */ h("rect", { x, y, width: w, height: ht, rx: r, fill: tint ? "var(--fig-tint)" : fill, stroke: stroke ? "var(--fig-line)" : "none" });
  var Dot = ({ x, y, r = 5, accent, fill }) => /* @__PURE__ */ h("circle", { cx: x, cy: y, r, fill: fill ?? (accent ? "var(--fig-accent)" : "var(--fig-ink)"), opacity: accent || fill ? 1 : 0.18 });
  var Ring = ({ x, y, r = 6, done: done3 }) => /* @__PURE__ */ h("circle", { cx: x, cy: y, r, fill: done3 ? "var(--fig-accent)" : "none", stroke: done3 ? "var(--fig-accent)" : "var(--fig-ink)", strokeOpacity: done3 ? 1 : 0.28, strokeWidth: "1.6" });
  function Frame({ children, side = true, panel = false, highlight: highlight2 }) {
    const hl = (part) => highlight2 === part;
    return /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("rect", { x: "0", y: "0", width: W, height: H, rx: "18", fill: "var(--fig-canvas)" }), side && /* @__PURE__ */ h("g", null, /* @__PURE__ */ h(Box, { x: 12, y: 12, w: 128, h: H - 24, r: 14, tint: hl("side") }), /* @__PURE__ */ h(Line, { x: 28, y: 32, w: 60, h: 8, o: 1.4 }), /* @__PURE__ */ h(Box, { x: 24, y: 56, w: 104, h: 22, r: 7, fill: "var(--fig-fill)", stroke: false }), [96, 120, 144].map((y, i) => /* @__PURE__ */ h("g", { key: y }, /* @__PURE__ */ h(Dot, { x: 34, y, r: 5, accent: i === 0 && hl("side") }), /* @__PURE__ */ h(Line, { x: 46, y: y - 3.5, w: 56 - i * 8 }))), /* @__PURE__ */ h(Line, { x: 28, y: 178, w: 40, h: 6, o: 0.6 })), /* @__PURE__ */ h("g", null, /* @__PURE__ */ h(Box, { x: side ? 152 : 12, y: 14, w: 130, h: 24, r: 12, fill: hl("top") ? "var(--fig-tint)" : "var(--fig-fill)", stroke: false }), /* @__PURE__ */ h(Box, { x: W - (panel ? 260 : 196), y: 14, w: 120, h: 24, r: 12, fill: hl("top") ? "var(--fig-tint)" : "var(--fig-card)" }), [0, 1, 2].map((i) => /* @__PURE__ */ h(Dot, { key: i, x: W - (panel ? 122 : 58) + i * 18, y: 26, r: 5, accent: hl("top") && i === 0 }))), panel && /* @__PURE__ */ h(Box, { x: W - 128, y: 48, w: 116, h: H - 60, r: 14, tint: hl("panel") }), children);
  }
  var Main = ({ x = 152, w, children }) => /* @__PURE__ */ h("g", null, /* @__PURE__ */ h(Box, { x, y: 48, w, h: H - 60, r: 14 }), children);
  var SCENES = {
    home: () => /* @__PURE__ */ h(Frame, null, /* @__PURE__ */ h(Main, { w: 476 }, [0, 1, 2].map((i) => /* @__PURE__ */ h(Dot, { key: i, x: 372 + i * 16, y: 96, r: 5, fill: ["#ffd60a", "#0a84ff", "#af52de"][i] })), /* @__PURE__ */ h(Line, { x: 300, y: 116, w: 176, h: 12, o: 1.8 }), /* @__PURE__ */ h(Line, { x: 326, y: 138, w: 124, h: 7, o: 0.8 }), /* @__PURE__ */ h(Box, { x: 232, y: 162, w: 312, h: 52, r: 18 }), /* @__PURE__ */ h(Line, { x: 248, y: 178, w: 150, h: 7, o: 0.7 }), /* @__PURE__ */ h(Dot, { x: 528, y: 200, r: 8, accent: true }), [[232, 226], [392, 226], [232, 268], [392, 268]].map(([x, y]) => /* @__PURE__ */ h("g", { key: `${x}${y}` }, /* @__PURE__ */ h(Box, { x, y, w: 152, h: 34, r: 10 }), /* @__PURE__ */ h(Box, { x: x + 10, y: y + 9, w: 16, h: 16, r: 5, tint: true, stroke: false }), /* @__PURE__ */ h(Line, { x: x + 34, y: y + 13, w: 84, h: 7 }))))),
    shell: () => /* @__PURE__ */ h(Frame, { panel: true, highlight: "side" }, /* @__PURE__ */ h(Main, { w: 348 }, /* @__PURE__ */ h(Line, { x: 172, y: 72, w: 120, h: 11, o: 1.6 }), [100, 158, 216].map((y) => /* @__PURE__ */ h("g", { key: y }, /* @__PURE__ */ h(Box, { x: 172, y, w: 308, h: 46, r: 10, fill: "var(--fig-fill)", stroke: false }), /* @__PURE__ */ h(Line, { x: 186, y: y + 12, w: 150 }), /* @__PURE__ */ h(Line, { x: 186, y: y + 26, w: 220, o: 0.6 })))), /* @__PURE__ */ h(Line, { x: W - 112, y: 72, w: 64, h: 8, o: 1.2 }), /* @__PURE__ */ h(Line, { x: W - 112, y: 96, w: 84, h: 6, o: 0.6 }), /* @__PURE__ */ h(Line, { x: W - 112, y: 110, w: 70, h: 6, o: 0.6 }), /* @__PURE__ */ h(Box, { x: W - 118, y: H - 64, w: 96, h: 40, r: 14 })),
    question: () => /* @__PURE__ */ h(Frame, null, /* @__PURE__ */ h(Main, { w: 476 }, /* @__PURE__ */ h(Line, { x: 176, y: 74, w: 140, h: 12, o: 1.8 }), /* @__PURE__ */ h(Line, { x: 176, y: 106, w: 400 }), /* @__PURE__ */ h(Line, { x: 176, y: 122, w: 360 }), /* @__PURE__ */ h("rect", { x: 176, y: 140, width: 150, height: 22, rx: 6, fill: "var(--fig-tint)" }), /* @__PURE__ */ h("text", { x: 186, y: 156, fontSize: "13", fontStyle: "italic", fill: "var(--fig-accent)", fontFamily: "Georgia, serif" }, "y = ax\xB2 + bx + c"), [[176, 46], [230, 64], [302, 40]].map(([x, w], i) => /* @__PURE__ */ h("rect", { key: x, x, y: 176, width: w, height: 18, rx: 9, fill: i === 0 ? "var(--fig-tint)" : "var(--fig-fill)" })), /* @__PURE__ */ h("line", { x1: 176, y1: 214, x2: 604, y2: 214, stroke: "var(--fig-line)" }), /* @__PURE__ */ h(Line, { x: 176, y: 232, w: 60, h: 8, o: 1.2 }), /* @__PURE__ */ h(Line, { x: 176, y: 252, w: 380, o: 0.7 }), /* @__PURE__ */ h(Line, { x: 176, y: 268, w: 300, o: 0.7 }), /* @__PURE__ */ h("rect", { x: 520, y: 304, width: 84, height: 26, rx: 13, fill: "var(--fig-accent)" }))),
    task: () => /* @__PURE__ */ h(Frame, null, /* @__PURE__ */ h(Main, { w: 272 }, [72, 150, 228].map((y, i) => /* @__PURE__ */ h("g", { key: y }, /* @__PURE__ */ h(Box, { x: 168, y, w: 240, h: 62, r: 12, fill: "var(--fig-fill)", stroke: false }), /* @__PURE__ */ h(Line, { x: 182, y: y + 14, w: 110, h: 8, o: 1.4 }), /* @__PURE__ */ h(Ring, { x: 188, y: y + 40, r: 5, done: i === 0 }), /* @__PURE__ */ h(Line, { x: 200, y: y + 37, w: 120, o: 0.7 })))), /* @__PURE__ */ h(Box, { x: 436, y: 48, w: 192, h: H - 60, r: 14 }), /* @__PURE__ */ h("rect", { x: 450, y: 62, width: 50, height: 18, rx: 9, fill: "var(--fig-tint)" }), /* @__PURE__ */ h(Line, { x: 450, y: 94, w: 120, h: 11, o: 1.8 }), /* @__PURE__ */ h(Box, { x: 450, y: 118, w: 164, h: 92, r: 12, fill: "var(--fig-fill)", stroke: false }), [0, 1, 2].map((i) => /* @__PURE__ */ h("g", { key: i }, /* @__PURE__ */ h("rect", { x: 460, y: 128 + i * 28, width: 14, height: 14, rx: 4, fill: ["#ff3b30", "#0a84ff", "#ff9500"][i] }), /* @__PURE__ */ h(Line, { x: 482, y: 131 + i * 28, w: 40 }), /* @__PURE__ */ h(Line, { x: 566, y: 131 + i * 28, w: 36, o: 0.6 }))), /* @__PURE__ */ h(Line, { x: 450, y: 226, w: 50, h: 8, o: 1.4 }), [0, 1, 2].map((i) => /* @__PURE__ */ h("g", { key: i }, /* @__PURE__ */ h(Ring, { x: 458, y: 252 + i * 24, r: 6, done: i === 0 }), /* @__PURE__ */ h(Line, { x: 472, y: 249 + i * 24, w: [96, 120, 80][i], o: 0.8 }))), /* @__PURE__ */ h("rect", { x: 560, y: 316, width: 54, height: 20, rx: 10, fill: "var(--fig-accent)" })),
    board: () => /* @__PURE__ */ h(Frame, { side: false }, [0, 1, 2].map((c) => {
      const x = 20 + c * 204;
      return /* @__PURE__ */ h("g", { key: c }, /* @__PURE__ */ h(Box, { x, y: 48, w: 192, h: H - 60, r: 14, fill: c === 0 ? "var(--fig-tint)" : "var(--fig-fill)", stroke: false }), /* @__PURE__ */ h(Line, { x: x + 14, y: 66, w: 56, h: 9, o: 1.6 }), [0, 1, 2].slice(0, 3 - (c === 2 ? 1 : 0)).map((r) => /* @__PURE__ */ h("g", { key: r }, /* @__PURE__ */ h(Box, { x: x + 10, y: 90 + r * 82, w: 172, h: 72, r: 12 }), /* @__PURE__ */ h(Dot, { x: x + 24, y: 104 + r * 82, r: 4, accent: r === 0 }), /* @__PURE__ */ h(Line, { x: x + 34, y: 101 + r * 82, w: 40, h: 6, o: 0.7 }), /* @__PURE__ */ h("rect", { x: x + 120, y: 98 + r * 82, width: 50, height: 12, rx: 6, fill: "var(--fig-fill)" }), /* @__PURE__ */ h(Line, { x: x + 20, y: 118 + r * 82, w: 100, h: 8, o: 1.4 }), /* @__PURE__ */ h(Ring, { x: x + 26, y: 142 + r * 82, r: 5, done: r === 1 }), /* @__PURE__ */ h(Line, { x: x + 38, y: 139 + r * 82, w: 80, h: 6, o: 0.6 }), r === 0 && c !== 1 && /* @__PURE__ */ h("rect", { x: x + 138, y: 136 + r * 82, width: 32, height: 12, rx: 6, fill: "#ff3b30", opacity: "0.85" }))));
    })),
    assistant: () => /* @__PURE__ */ h(Frame, null, /* @__PURE__ */ h(Main, { w: 476 }, /* @__PURE__ */ h("rect", { x: 430, y: 68, width: 170, height: 28, rx: 14, fill: "var(--fig-fill)" }), [0, 1].map((i) => /* @__PURE__ */ h("g", { key: i }, /* @__PURE__ */ h("circle", { cx: 186, cy: 120 + i * 22, r: 5, fill: "none", stroke: "var(--fig-accent)", strokeWidth: "1.6" }), /* @__PURE__ */ h(Line, { x: 198, y: 117 + i * 22, w: [150, 110][i], h: 6, o: 0.8 }))), /* @__PURE__ */ h(Line, { x: 176, y: 174, w: 380 }), /* @__PURE__ */ h(Line, { x: 176, y: 190, w: 400 }), /* @__PURE__ */ h(Line, { x: 176, y: 206, w: 260 }), /* @__PURE__ */ h(Box, { x: 176, y: 226, w: 424, h: 74, r: 16, fill: "var(--fig-fill)", stroke: false }), /* @__PURE__ */ h("rect", { x: 190, y: 240, width: 28, height: 28, rx: 8, fill: "var(--fig-tint)" }), /* @__PURE__ */ h(Line, { x: 228, y: 244, w: 140, h: 8, o: 1.4 }), /* @__PURE__ */ h(Line, { x: 228, y: 260, w: 90, h: 6, o: 0.6 }), /* @__PURE__ */ h("rect", { x: 510, y: 244, width: 76, height: 24, rx: 12, fill: "var(--fig-card)", stroke: "var(--fig-line)" }), /* @__PURE__ */ h(Line, { x: 524, y: 253, w: 48, h: 6, accent: true }))),
    math: () => /* @__PURE__ */ h(Frame, null, /* @__PURE__ */ h(Main, { w: 476 }, /* @__PURE__ */ h("line", { x1: 190, y1: 250, x2: 470, y2: 250, stroke: "var(--fig-ink)", strokeOpacity: "0.3" }), /* @__PURE__ */ h("line", { x1: 330, y1: 72, x2: 330, y2: 300, stroke: "var(--fig-ink)", strokeOpacity: "0.3" }), /* @__PURE__ */ h("path", { d: "M206 92 Q330 400 454 92", fill: "none", stroke: "var(--fig-accent)", strokeWidth: "3", strokeLinecap: "round" }), /* @__PURE__ */ h("path", { d: "M226 92 Q330 330 434 92", fill: "none", stroke: "var(--fig-accent)", strokeOpacity: "0.3", strokeWidth: "2", strokeDasharray: "4 5" }), /* @__PURE__ */ h("circle", { cx: 330, cy: 246, r: 5, fill: "var(--fig-accent)" }), /* @__PURE__ */ h(Box, { x: 490, y: 72, w: 124, h: 110, r: 12, fill: "var(--fig-fill)", stroke: false }), /* @__PURE__ */ h(Line, { x: 502, y: 88, w: 30, h: 8, o: 1.4 }), /* @__PURE__ */ h("rect", { x: 502, y: 112, width: 100, height: 4, rx: 2, fill: "var(--fig-ink)", opacity: "0.16" }), /* @__PURE__ */ h("rect", { x: 502, y: 112, width: 64, height: 4, rx: 2, fill: "var(--fig-accent)" }), /* @__PURE__ */ h("circle", { cx: 566, cy: 114, r: 8, fill: "var(--fig-card)", stroke: "var(--fig-line)" }), /* @__PURE__ */ h(Line, { x: 502, y: 140, w: 30, h: 8, o: 1.4 }), /* @__PURE__ */ h("rect", { x: 502, y: 160, width: 100, height: 4, rx: 2, fill: "var(--fig-ink)", opacity: "0.16" }), /* @__PURE__ */ h("circle", { cx: 540, cy: 162, r: 8, fill: "var(--fig-card)", stroke: "var(--fig-line)" }))),
    resources: () => /* @__PURE__ */ h(Frame, null, /* @__PURE__ */ h(Main, { w: 476 }, /* @__PURE__ */ h(Line, { x: 176, y: 72, w: 130, h: 12, o: 1.8 }), /* @__PURE__ */ h("rect", { x: 500, y: 66, width: 104, height: 24, rx: 12, fill: "var(--fig-accent)" }), [0, 1, 2, 3].map((i) => {
      const x = 176 + i % 2 * 216;
      const y = 108 + Math.floor(i / 2) * 116;
      return /* @__PURE__ */ h("g", { key: i }, /* @__PURE__ */ h("rect", { x, y, width: 204, height: 74, rx: 12, fill: i === 1 ? "var(--fig-tint)" : "var(--fig-fill)" }), /* @__PURE__ */ h("path", { d: `M${x + 120} ${y + 10} Q${x + 160} ${y + 120} ${x + 196} ${y + 10}`, fill: "none", stroke: "var(--fig-ink)", strokeOpacity: "0.2" }), /* @__PURE__ */ h(Line, { x: x + 12, y: y + 30, w: 70, h: 9, o: 1.4 }), /* @__PURE__ */ h(Line, { x, y: y + 86, w: 120, h: 8, o: 1.2 }));
    })))
  };
  function Figure({ kind, caption }) {
    const Scene = SCENES[kind];
    if (!Scene) return null;
    return /* @__PURE__ */ h("figure", { className: "tbx-fig" }, /* @__PURE__ */ h("div", { className: "tbx-fig-stage" }, /* @__PURE__ */ h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": caption }, /* @__PURE__ */ h(Scene, null))), caption && /* @__PURE__ */ h("figcaption", null, caption));
  }
  function FigureThumb({ kind }) {
    const Scene = SCENES[kind];
    if (!Scene) return null;
    return /* @__PURE__ */ h("svg", { className: "tbx-fig-thumb", viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true", preserveAspectRatio: "xMidYMid slice" }, /* @__PURE__ */ h(Scene, null));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/help/HelpCenter.jsx
  var content = () => isEnglish() ? content_en_exports : content_zh_exports;
  var topicPath = (t2) => `/help/${t2.id}`;
  var articlePath = (t2, a) => `/help/${t2.id}/${a.id}`;
  var FIGURE_FOR = { start: "home", questions: "question", schedule: "board", assistant: "assistant", math: "math", resources: "resources", account: "shell" };
  var Icon = ({ name, size = 18, stroke = 1.8 }) => {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: stroke });
  };
  function Link({ to, className, children, onNavigate, ...rest }) {
    const { followAnchor } = tb();
    return /* @__PURE__ */ h("a", { ...rest, href: to, className, onClick: (e) => {
      followAnchor(e, to);
      onNavigate?.();
    } }, children);
  }
  var Tile = ({ topic, size = "m" }) => /* @__PURE__ */ h("span", { className: cx("tbx-help-tile", `is-${topic.hue}`, `is-${size}`), "aria-hidden": "true" }, /* @__PURE__ */ h(Icon, { name: topic.icon, size: size === "s" ? 13 : size === "l" ? 28 : 19, stroke: size === "s" ? 2.1 : 1.9 }));
  function Inline2({ text, mark }) {
    const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return parts.map((p, i) => {
      if (p.startsWith("**")) return /* @__PURE__ */ h("strong", { key: i }, highlight(p.slice(2, -2), mark));
      if (p.startsWith("`")) return /* @__PURE__ */ h("code", { key: i }, p.slice(1, -1));
      return /* @__PURE__ */ h(Fragment, { key: i }, highlight(p, mark));
    });
  }
  function highlight(text, terms) {
    if (!terms?.length) return text;
    const re = new RegExp(`(${terms.map((t2) => t2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    return String(text).split(re).map((p, i) => i % 2 ? /* @__PURE__ */ h("mark", { key: i }, p) : p);
  }
  var plain = (s) => String(s).replace(/\*\*|`/g, "");
  var blockText = (b) => Array.isArray(b[1]) ? b[1].map((x) => Array.isArray(x) ? x.join(" ") : x).join(" ") : `${b[1] ?? ""} ${b[2] ?? ""}`;
  function Blocks({ blocks }) {
    let h2 = 0;
    return blocks.map((b, i) => {
      switch (b[0]) {
        case "p":
          return /* @__PURE__ */ h("p", { key: i }, /* @__PURE__ */ h(Inline2, { text: b[1] }));
        case "h2":
          return /* @__PURE__ */ h("h2", { key: i, id: `s${h2++}` }, b[1]);
        case "list":
          return /* @__PURE__ */ h("ul", { key: i }, b[1].map((x) => /* @__PURE__ */ h("li", { key: x }, /* @__PURE__ */ h(Inline2, { text: x }))));
        case "steps":
          return /* @__PURE__ */ h("ol", { key: i, className: "tbx-help-steps" }, b[1].map((x, n) => /* @__PURE__ */ h("li", { key: x }, /* @__PURE__ */ h("span", { className: "tbx-num" }, n + 1), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h(Inline2, { text: x })))));
        case "tip":
        case "note":
          return /* @__PURE__ */ h("aside", { key: i, className: cx("tbx-help-callout", `is-${b[0]}`) }, /* @__PURE__ */ h("span", { className: "tbx-help-callout-icon" }, /* @__PURE__ */ h(Icon, { name: b[0] === "tip" ? "sparkles" : "info", size: 16, stroke: 2 })), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("strong", null, b[0] === "tip" ? tx("\u5C0F\u6280\u5DE7") : tx("\u8BF7\u6CE8\u610F")), /* @__PURE__ */ h("p", null, /* @__PURE__ */ h(Inline2, { text: b[1] }))));
        case "keys":
          return /* @__PURE__ */ h("dl", { key: i, className: "tbx-help-keys" }, b[1].map(([k, d]) => /* @__PURE__ */ h("div", { key: k }, /* @__PURE__ */ h("dt", null, /* @__PURE__ */ h("kbd", null, k)), /* @__PURE__ */ h("dd", null, d))));
        case "figure":
          return /* @__PURE__ */ h(Figure, { key: i, kind: b[1], caption: b[2] });
        default:
          return null;
      }
    });
  }
  function Helpful({ id }) {
    const [vote, setVote] = useState(null);
    useEffect(() => setVote(null), [id]);
    return /* @__PURE__ */ h("div", { className: "tbx-help-helpful", role: "group", "aria-label": tx("\u8FD9\u7BC7\u6587\u7AE0\u6709\u5E2E\u52A9\u5417\uFF1F") }, vote ? /* @__PURE__ */ h("span", { className: "tbx-help-helpful-thanks" }, /* @__PURE__ */ h(Icon, { name: "check", size: 15, stroke: 2.2 }), vote === "yes" ? tx("\u8C22\u8C22\uFF0C\u5F88\u9AD8\u5174\u5E2E\u5230\u4F60\u3002") : tx("\u8C22\u8C22\uFF0C\u6211\u4EEC\u4F1A\u628A\u5B83\u5199\u5F97\u66F4\u6E05\u695A\u3002")) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", null, tx("\u8FD9\u7BC7\u6587\u7AE0\u6709\u5E2E\u52A9\u5417\uFF1F")), /* @__PURE__ */ h("button", { type: "button", onClick: () => setVote("yes") }, tx("\u6709\u5E2E\u52A9")), /* @__PURE__ */ h("button", { type: "button", onClick: () => setVote("no") }, tx("\u6CA1\u5E2E\u52A9"))));
  }
  function Article({ topic, article, scroller }) {
    const all = content().TOPICS.flatMap((t2) => t2.articles.map((a) => ({ t: t2, a })));
    const index = all.findIndex((x) => x.t === topic && x.a === article);
    const prev = all[index - 1];
    const next = all[index + 1];
    const heads = article.blocks.filter((b) => b[0] === "h2").map((b) => b[1]);
    const [active, setActive] = useState(0);
    useEffect(() => {
      const root = scroller.current;
      if (!root || heads.length < 2) return void 0;
      const spy = () => {
        const line = root.getBoundingClientRect().top + 120;
        let current = 0;
        root.querySelectorAll(".tbx-help-prose h2").forEach((el, i) => {
          if (el.getBoundingClientRect().top <= line) current = i;
        });
        setActive(current);
      };
      root.addEventListener("scroll", spy, { passive: true });
      return () => root.removeEventListener("scroll", spy);
    }, [article]);
    const jump = (i) => {
      const root = scroller.current;
      const el = root?.querySelector(`#s${i}`);
      if (el) root.scrollTo({ top: el.offsetTop - 28, behavior: "smooth" });
    };
    return /* @__PURE__ */ h("div", { className: cx("tbx-help-article", `is-${topic.hue}`, heads.length > 1 && "has-toc") }, /* @__PURE__ */ h("article", { className: "tbx-help-prose" }, /* @__PURE__ */ h(Link, { to: topicPath(topic), className: cx("tbx-help-eyebrow", `is-${topic.hue}`) }, /* @__PURE__ */ h(Tile, { topic, size: "s" }), topic.title), /* @__PURE__ */ h("h1", null, article.title), /* @__PURE__ */ h("p", { className: "tbx-help-lead" }, article.summary), /* @__PURE__ */ h("p", { className: "tbx-help-meta" }, tx("{{n}} \u5206\u949F\u9605\u8BFB", { n: article.minutes }), /* @__PURE__ */ h("span", { "aria-hidden": "true" }, "\xB7"), tx("2026 \u5E74 10 \u6708\u66F4\u65B0")), /* @__PURE__ */ h(Blocks, { blocks: article.blocks }), /* @__PURE__ */ h(Helpful, { id: article.id }), /* @__PURE__ */ h("nav", { className: "tbx-help-pager", "aria-label": tx("\u4E0A\u4E00\u7BC7\u548C\u4E0B\u4E00\u7BC7") }, prev ? /* @__PURE__ */ h(Link, { to: articlePath(prev.t, prev.a), className: "is-prev" }, /* @__PURE__ */ h("small", null, tx("\u4E0A\u4E00\u7BC7")), /* @__PURE__ */ h("span", null, prev.a.title)) : /* @__PURE__ */ h("span", null), next ? /* @__PURE__ */ h(Link, { to: articlePath(next.t, next.a), className: "is-next" }, /* @__PURE__ */ h("small", null, tx("\u4E0B\u4E00\u7BC7")), /* @__PURE__ */ h("span", null, next.a.title)) : /* @__PURE__ */ h("span", null))), heads.length > 1 && /* @__PURE__ */ h("aside", { className: "tbx-help-toc", "aria-label": tx("\u672C\u9875\u5185\u5BB9") }, /* @__PURE__ */ h("h4", null, tx("\u672C\u9875\u5185\u5BB9")), heads.map((title, i) => /* @__PURE__ */ h("button", { key: title, type: "button", className: cx(active === i && "is-active"), onClick: () => jump(i) }, title))));
  }
  function Topic({ topic }) {
    const minutes = topic.articles.reduce((s, a) => s + a.minutes, 0);
    const others = content().TOPICS.filter((t2) => t2 !== topic);
    return /* @__PURE__ */ h("div", { className: "tbx-help-topic" }, /* @__PURE__ */ h("header", { className: cx("tbx-help-topic-head", `is-${topic.hue}`) }, /* @__PURE__ */ h(Tile, { topic, size: "l" }), /* @__PURE__ */ h("h1", null, topic.title), /* @__PURE__ */ h("p", null, topic.blurb), /* @__PURE__ */ h("span", { className: "tbx-help-meta" }, tx("{{n}} \u7BC7\u6587\u7AE0", { n: topic.articles.length }), /* @__PURE__ */ h("span", { "aria-hidden": "true" }, "\xB7"), tx("\u7EA6 {{n}} \u5206\u949F\u8BFB\u5B8C", { n: minutes }))), /* @__PURE__ */ h("ol", { className: "tbx-help-rows" }, topic.articles.map((a, i) => /* @__PURE__ */ h("li", { key: a.id }, /* @__PURE__ */ h(Link, { to: articlePath(topic, a), className: "tbx-help-row", style: { "--i": i } }, /* @__PURE__ */ h("span", { className: "tbx-help-row-num tbx-num" }, i + 1), /* @__PURE__ */ h("span", { className: "tbx-help-row-copy" }, /* @__PURE__ */ h("strong", null, a.title), /* @__PURE__ */ h("small", null, a.summary)), /* @__PURE__ */ h("span", { className: "tbx-help-row-meta" }, tx("{{n}} \u5206\u949F", { n: a.minutes })), /* @__PURE__ */ h(Icon, { name: "chevron", size: 16 }))))), /* @__PURE__ */ h("section", { className: "tbx-help-more" }, /* @__PURE__ */ h("h2", null, tx("\u5176\u4ED6\u4E3B\u9898")), /* @__PURE__ */ h("div", null, others.map((t2) => /* @__PURE__ */ h(Link, { key: t2.id, to: topicPath(t2), className: "tbx-help-chip" }, /* @__PURE__ */ h(Tile, { topic: t2, size: "s" }), t2.title)))));
  }
  function Home2({ openSearch }) {
    const { TOPICS: TOPICS4, HOME: HOME3 } = content();
    const find = ([tid, aid]) => {
      const t2 = TOPICS4.find((x) => x.id === tid);
      return { t: t2, a: t2?.articles.find((x) => x.id === aid) };
    };
    return /* @__PURE__ */ h("div", { className: "tbx-help-home" }, /* @__PURE__ */ h("header", { className: "tbx-help-hero" }, /* @__PURE__ */ h("span", { className: "tbx-help-hero-eyebrow" }, tx("TeachBuddy \u5E2E\u52A9")), /* @__PURE__ */ h("h1", null, tx("\u6709\u4EC0\u4E48\u53EF\u4EE5\u5E2E\u4F60\uFF1F", { context: "help" })), /* @__PURE__ */ h("button", { type: "button", className: "tbx-help-hero-search", onClick: () => openSearch("") }, /* @__PURE__ */ h(Icon, { name: "search", size: 19, stroke: 2 }), /* @__PURE__ */ h("span", null, tx("\u641C\u7D22\u5E2E\u52A9\u6587\u7AE0")), /* @__PURE__ */ h("kbd", null, navigator.platform.includes("Mac") ? "\u2318 K" : "Ctrl K")), /* @__PURE__ */ h("div", { className: "tbx-help-suggest" }, /* @__PURE__ */ h("span", null, tx("\u5927\u5BB6\u5E38\u641C")), HOME3.searches.map((q) => /* @__PURE__ */ h("button", { key: q, type: "button", onClick: () => openSearch(q) }, q)))), /* @__PURE__ */ h("section", { className: "tbx-help-section" }, /* @__PURE__ */ h("h2", null, tx("\u4ECE\u8FD9\u91CC\u5F00\u59CB")), /* @__PURE__ */ h("div", { className: "tbx-help-featured" }, HOME3.featured.map(find).filter((x) => x.a).map(({ t: t2, a }, i) => /* @__PURE__ */ h(Link, { key: a.id, to: articlePath(t2, a), className: cx("tbx-help-feature", `is-${t2.hue}`), style: { "--i": i } }, /* @__PURE__ */ h("span", { className: "tbx-help-feature-art" }, /* @__PURE__ */ h(FigureThumb, { kind: a.blocks.find((b) => b[0] === "figure")?.[1] ?? FIGURE_FOR[t2.id] })), /* @__PURE__ */ h("span", { className: "tbx-help-feature-copy" }, /* @__PURE__ */ h("small", { className: cx("tbx-help-eyebrow", `is-${t2.hue}`) }, t2.title), /* @__PURE__ */ h("strong", null, a.title), /* @__PURE__ */ h("span", null, a.summary)))))), /* @__PURE__ */ h("section", { className: "tbx-help-section" }, /* @__PURE__ */ h("h2", null, tx("\u6309\u4E3B\u9898\u6D4F\u89C8")), /* @__PURE__ */ h("div", { className: "tbx-help-topics" }, TOPICS4.map((t2, i) => /* @__PURE__ */ h(Link, { key: t2.id, to: topicPath(t2), className: "tbx-help-topic-card", style: { "--i": i } }, /* @__PURE__ */ h(Tile, { topic: t2 }), /* @__PURE__ */ h("strong", null, t2.title), /* @__PURE__ */ h("span", null, t2.blurb), /* @__PURE__ */ h("small", null, tx("{{n}} \u7BC7\u6587\u7AE0", { n: t2.articles.length })))))), /* @__PURE__ */ h("section", { className: "tbx-help-section" }, /* @__PURE__ */ h("h2", null, tx("\u5E38\u89C1\u95EE\u9898")), /* @__PURE__ */ h("ul", { className: "tbx-help-rows is-compact" }, HOME3.popular.map(find).filter((x) => x.a).map(({ t: t2, a }) => /* @__PURE__ */ h("li", { key: `${t2.id}/${a.id}` }, /* @__PURE__ */ h(Link, { to: articlePath(t2, a), className: "tbx-help-row" }, /* @__PURE__ */ h(Tile, { topic: t2, size: "s" }), /* @__PURE__ */ h("span", { className: "tbx-help-row-copy" }, /* @__PURE__ */ h("strong", null, a.title)), /* @__PURE__ */ h("span", { className: "tbx-help-row-meta" }, t2.title), /* @__PURE__ */ h(Icon, { name: "chevron", size: 16 })))))));
  }
  function useIndex() {
    return useMemo(() => content().TOPICS.flatMap((t2) => t2.articles.map((a) => ({
      t: t2,
      a,
      title: a.title.toLowerCase(),
      summary: a.summary.toLowerCase(),
      body: a.blocks.map((b) => plain(blockText(b))).join(" ")
    }))), [isEnglish()]);
  }
  function snippet(body, terms) {
    const lower = body.toLowerCase();
    const at = Math.min(...terms.map((t2) => {
      const i = lower.indexOf(t2);
      return i < 0 ? Infinity : i;
    }));
    if (!Number.isFinite(at)) return "";
    const start = Math.max(0, at - 24);
    return `${start > 0 ? "\u2026" : ""}${body.slice(start, start + 96)}${start + 96 < body.length ? "\u2026" : ""}`;
  }
  function Search({ initial, onClose }) {
    const { navigate } = tb();
    const { TOPICS: TOPICS4, HOME: HOME3 } = content();
    const dialog = useRef(null);
    const input = useRef(null);
    const [query, setQuery] = useState(initial);
    const [active, setActive] = useState(0);
    const index = useIndex();
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const results = useMemo(() => {
      if (!terms.length) return HOME3.popular.map(([tid, aid]) => index.find((x) => x.t.id === tid && x.a.id === aid)).filter(Boolean).map((x) => ({ ...x, snip: "" }));
      return index.map((x) => {
        const hay = `${x.title} ${x.summary} ${x.body.toLowerCase()} ${x.t.title.toLowerCase()}`;
        if (!terms.every((term) => hay.includes(term))) return null;
        const score = terms.reduce((s, term) => s + (x.title.includes(term) ? 6 : 0) + (x.summary.includes(term) ? 3 : 0) + 1, 0);
        const inTitle = terms.every((term) => x.title.includes(term));
        return { ...x, score, snip: inTitle ? x.a.summary : snippet(x.body, terms) || x.a.summary };
      }).filter(Boolean).sort((a, b) => b.score - a.score);
    }, [query, index]);
    useEffect(() => {
      const node = dialog.current;
      node.showModal();
      input.current.focus();
      input.current.setSelectionRange(initial.length, initial.length);
      return () => node.close();
    }, []);
    useEffect(() => setActive(0), [query]);
    useEffect(() => {
      dialog.current?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
    }, [active]);
    const open = (r) => {
      if (!r) return;
      navigate(articlePath(r.t, r.a));
      onClose();
    };
    const groups = [];
    results.forEach((r, i) => {
      const g = terms.length ? groups.find((x) => x.t === r.t) : groups[0];
      if (g) g.items.push({ r, i });
      else groups.push({ t: terms.length ? r.t : null, items: [{ r, i }] });
    });
    return /* @__PURE__ */ h(
      "dialog",
      {
        ref: dialog,
        className: "tbx-help-search",
        "aria-label": tx("\u641C\u7D22\u5E2E\u52A9\u6587\u7AE0"),
        onCancel: (e) => {
          e.preventDefault();
          onClose();
        },
        onClick: (e) => {
          if (e.target === dialog.current) onClose();
        }
      },
      /* @__PURE__ */ h("div", { className: "tbx-hs-panel" }, /* @__PURE__ */ h("div", { className: "tbx-hs-field" }, /* @__PURE__ */ h(Icon, { name: "search", size: 20, stroke: 2 }), /* @__PURE__ */ h(
        "input",
        {
          ref: input,
          value: query,
          role: "combobox",
          "aria-expanded": "true",
          "aria-controls": "tbx-hs-results",
          "aria-activedescendant": results[active] ? `tbx-hs-${active}` : void 0,
          placeholder: tx("\u641C\u7D22\u5E2E\u52A9\u6587\u7AE0"),
          onChange: (e) => setQuery(e.target.value),
          onKeyDown: (e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const n = results.length;
              if (n) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
            }
            if (e.key === "Enter") {
              e.preventDefault();
              open(results[active]);
            }
          }
        }
      ), query && /* @__PURE__ */ h("button", { type: "button", className: "tbx-hs-clear", "aria-label": tx("\u6E05\u9664"), onClick: () => {
        setQuery("");
        input.current.focus();
      } }, /* @__PURE__ */ h(Icon, { name: "close", size: 12, stroke: 2.6 })), /* @__PURE__ */ h("button", { type: "button", className: "tbx-hs-esc", onClick: onClose }, tx("\u53D6\u6D88"))), /* @__PURE__ */ h("div", { className: "tbx-hs-body", id: "tbx-hs-results", role: "listbox" }, results.length === 0 ? /* @__PURE__ */ h("div", { className: "tbx-hs-empty" }, /* @__PURE__ */ h("span", { className: "tbx-hs-empty-icon" }, /* @__PURE__ */ h(Icon, { name: "search", size: 22, stroke: 1.8 })), /* @__PURE__ */ h("strong", null, tx("\u6CA1\u6709\u627E\u5230\u201C{{q}}\u201D", { q: query.trim() })), /* @__PURE__ */ h("p", null, tx("\u6362\u4E2A\u8BF4\u6CD5\u8BD5\u8BD5\uFF0C\u6216\u8005\u4ECE\u4E3B\u9898\u5F00\u59CB\u627E\u3002")), /* @__PURE__ */ h("div", null, TOPICS4.map((t2) => /* @__PURE__ */ h("button", { key: t2.id, type: "button", className: "tbx-help-chip", onClick: () => {
        navigate(topicPath(t2));
        onClose();
      } }, /* @__PURE__ */ h(Tile, { topic: t2, size: "s" }), t2.title)))) : groups.map((g) => /* @__PURE__ */ h("section", { key: g.t?.id ?? "popular", className: "tbx-hs-group" }, /* @__PURE__ */ h("h3", null, g.t ? g.t.title : tx("\u5E38\u89C1\u95EE\u9898")), g.items.map(({ r, i }) => /* @__PURE__ */ h(
        "div",
        {
          key: `${r.t.id}/${r.a.id}`,
          id: `tbx-hs-${i}`,
          role: "option",
          "aria-selected": i === active,
          className: cx("tbx-hs-item", i === active && "is-active"),
          onPointerMove: () => setActive(i),
          onClick: () => open(r)
        },
        /* @__PURE__ */ h(Tile, { topic: r.t, size: "s" }),
        /* @__PURE__ */ h("span", { className: "tbx-hs-copy" }, /* @__PURE__ */ h("strong", null, highlight(r.a.title, terms)), (r.snip || !terms.length) && /* @__PURE__ */ h("small", null, highlight(r.snip || r.a.summary, terms))),
        /* @__PURE__ */ h("span", { className: "tbx-hs-enter", "aria-hidden": "true" }, /* @__PURE__ */ h(Icon, { name: "chevron", size: 15 }))
      ))))), /* @__PURE__ */ h("footer", { className: "tbx-hs-foot" }, /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("kbd", null, "\u2191"), /* @__PURE__ */ h("kbd", null, "\u2193"), tx("\u9009\u62E9")), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("kbd", null, "\u21B5"), tx("\u6253\u5F00")), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("kbd", null, "esc"), tx("\u5173\u95ED"))))
    );
  }
  function Directory({ topic, article, expanded, toggle, openSearch, onNavigate }) {
    const { TOPICS: TOPICS4 } = content();
    return /* @__PURE__ */ h("nav", { className: "tbx-help-dir-inner", "aria-label": tx("\u5E2E\u52A9\u76EE\u5F55") }, /* @__PURE__ */ h("button", { type: "button", className: "tbx-help-dir-search", onClick: () => openSearch("") }, /* @__PURE__ */ h(Icon, { name: "search", size: 15, stroke: 2 }), /* @__PURE__ */ h("span", null, tx("\u641C\u7D22")), /* @__PURE__ */ h("kbd", null, navigator.platform.includes("Mac") ? "\u2318K" : "Ctrl K")), /* @__PURE__ */ h(Link, { to: "/help", className: "tbx-help-dir-home", "aria-current": !topic ? "page" : void 0, onNavigate }, /* @__PURE__ */ h("span", { className: "tbx-help-dir-home-icon" }, /* @__PURE__ */ h(Icon, { name: "home", size: 15, stroke: 2 })), tx("\u5E2E\u52A9\u9996\u9875")), /* @__PURE__ */ h("h4", null, tx("\u4E3B\u9898")), TOPICS4.map((t2) => {
      const open = Boolean(expanded[t2.id]);
      return /* @__PURE__ */ h("div", { key: t2.id, className: cx("tbx-help-dir-group", open && "is-open", topic === t2 && "is-current") }, /* @__PURE__ */ h("button", { type: "button", className: "tbx-help-dir-topic", "aria-expanded": open, onClick: () => toggle(t2.id) }, /* @__PURE__ */ h(Tile, { topic: t2, size: "s" }), /* @__PURE__ */ h("span", null, t2.title), /* @__PURE__ */ h("span", { className: "tbx-help-dir-chevron" }, /* @__PURE__ */ h(Icon, { name: "chevron", size: 13, stroke: 2.2 }))), /* @__PURE__ */ h("div", { className: "tbx-help-dir-fold", inert: !open ? "" : void 0 }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h(Link, { to: topicPath(t2), "aria-current": topic === t2 && !article ? "page" : void 0, onNavigate }, tx("\u6982\u89C8")), t2.articles.map((a) => /* @__PURE__ */ h(Link, { key: a.id, to: articlePath(t2, a), "aria-current": topic === t2 && article === a ? "page" : void 0, onNavigate }, a.title)))));
    }));
  }
  function HelpCenter() {
    useLocale();
    const { useRoute: useRoute2, useScene, useWorkbenchShell } = tb();
    const route = useRoute2();
    const shell = useWorkbenchShell();
    const [scene, patch] = useScene(shell.accountKey, "help", { query: "", expanded: {}, positions: {}, searchOpen: false, mobileOpen: false });
    const [search, setSearch] = useState(null);
    const scroller = useRef(null);
    const { TOPICS: TOPICS4 } = content();
    const topic = TOPICS4.find((t2) => t2.id === route.topicId);
    const article = topic?.articles.find((a) => a.id === route.articleId);
    const invalid = Boolean(route.topicId && !topic || route.articleId && !article);
    const expanded = { ...scene.expanded, ...topic && scene.expanded[topic.id] === void 0 ? { [topic.id]: true } : {} };
    useEffect(() => {
      if (topic) patch({ expanded: { [topic.id]: true } });
    }, [topic?.id]);
    useLayoutEffect(() => {
      const el = scroller.current;
      if (el) el.scrollTop = scene.positions?.[route.path] || 0;
      patch({ mobileOpen: false });
    }, [route.path]);
    useEffect(() => {
      const el = scroller.current;
      if (!el) return void 0;
      let t2 = 0;
      const save = () => {
        clearTimeout(t2);
        t2 = setTimeout(() => patch((c) => ({ positions: { ...c.positions, [route.path]: el.scrollTop } })), 150);
      };
      el.addEventListener("scroll", save, { passive: true });
      return () => {
        clearTimeout(t2);
        el.removeEventListener("scroll", save);
      };
    }, [route.path]);
    useEffect(() => {
      const key2 = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setSearch((s) => s === null ? "" : null);
        }
      };
      window.addEventListener("keydown", key2, true);
      return () => window.removeEventListener("keydown", key2, true);
    }, []);
    const toggle = (id) => patch((c) => ({ expanded: { ...c.expanded, [id]: !(c.expanded[id] ?? topic?.id === id) } }));
    return /* @__PURE__ */ h("div", { className: "tbx-help", "data-region": "help" }, /* @__PURE__ */ h("button", { type: "button", className: "tbx-help-mobile", "aria-expanded": Boolean(scene.mobileOpen), onClick: () => patch({ mobileOpen: !scene.mobileOpen }) }, /* @__PURE__ */ h(Icon, { name: "menu", size: 17 }), topic ? topic.title : tx("\u5E2E\u52A9\u9996\u9875"), /* @__PURE__ */ h(Icon, { name: "chevron", size: 14 })), /* @__PURE__ */ h("aside", { className: "tbx-help-dir", "data-open": Boolean(scene.mobileOpen) }, /* @__PURE__ */ h(Directory, { topic, article, expanded, toggle, openSearch: setSearch, onNavigate: () => patch({ mobileOpen: false }) })), /* @__PURE__ */ h("main", { className: "tbx-help-main", ref: scroller }, /* @__PURE__ */ h("div", { className: "tbx-help-page", key: route.path }, invalid ? /* @__PURE__ */ h("div", { className: "tbx-help-missing" }, /* @__PURE__ */ h("span", { className: "tbx-hs-empty-icon" }, /* @__PURE__ */ h(Icon, { name: "search", size: 22 })), /* @__PURE__ */ h("h1", null, tx("\u6CA1\u6709\u627E\u5230\u8FD9\u7BC7\u6587\u7AE0")), /* @__PURE__ */ h("p", null, tx("\u5B83\u53EF\u80FD\u6362\u4E86\u4F4D\u7F6E\u3002\u8BD5\u8BD5\u641C\u7D22\uFF0C\u6216\u8005\u56DE\u5230\u5E2E\u52A9\u9996\u9875\u3002")), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("button", { type: "button", className: "tbx-help-btn is-primary", onClick: () => setSearch("") }, tx("\u641C\u7D22\u5E2E\u52A9")), /* @__PURE__ */ h(Link, { to: "/help", className: "tbx-help-btn" }, tx("\u5E2E\u52A9\u9996\u9875")))) : article ? /* @__PURE__ */ h(Article, { topic, article, scroller }) : topic ? /* @__PURE__ */ h(Topic, { topic }) : /* @__PURE__ */ h(Home2, { openSearch: setSearch }))), search !== null && /* @__PURE__ */ h(Search, { initial: search, onClose: () => setSearch(null) }));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/kit/rail.jsx
  var Icon2 = ({ name, size = 16, stroke = 2 }) => {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: stroke });
  };
  function Rail({ label, children, footer, className, ...rest }) {
    return /* @__PURE__ */ h("aside", { className: cx("tbx-rail", className), "aria-label": label, ...rest }, /* @__PURE__ */ h("div", { className: "tbx-rail-scroll" }, children), footer && /* @__PURE__ */ h("div", { className: "tbx-rail-foot" }, footer));
  }
  function RailSection({ title, count, actions, children, className }) {
    return /* @__PURE__ */ h("section", { className: cx("tbx-rail-section", className) }, (title || actions) && /* @__PURE__ */ h("header", { className: "tbx-rail-head" }, title && /* @__PURE__ */ h("h2", null, title, count != null && count !== "" && /* @__PURE__ */ h("span", null, count)), actions && /* @__PURE__ */ h("span", { className: "tbx-rail-actions" }, actions)), children);
  }
  function RailAction({ icon, label, onClick, primary, disabled, pressed }) {
    return /* @__PURE__ */ h("button", { type: "button", className: cx("tbx-rail-action", primary && "is-primary", pressed && "is-on"), "aria-label": label, title: label, "aria-pressed": pressed, disabled, onClick }, /* @__PURE__ */ h(Icon2, { name: icon, size: primary ? 17 : 16, stroke: primary ? 2.3 : 2 }));
  }
  function RailItem({ icon, mark, label, count, current, onClick, disabled, more, depth, className, title, drop, toggle }) {
    return /* @__PURE__ */ h("div", { className: cx("tbx-rail-item", current && "is-current", more && "has-more", toggle && "has-toggle", className), style: depth ? { "--depth": depth } : void 0, "data-drop": drop }, toggle && /* @__PURE__ */ h("button", { type: "button", className: cx("tbx-rail-toggle", toggle.open && "is-open"), "aria-expanded": toggle.open, "aria-label": toggle.label, title: toggle.label, onClick: toggle.onClick }, /* @__PURE__ */ h(Icon2, { name: "chevron", size: 12, stroke: 2.4 })), /* @__PURE__ */ h("button", { type: "button", className: "tbx-rail-hit", "aria-current": current ? "true" : void 0, disabled, onClick, title }, mark || /* @__PURE__ */ h("span", { className: "tbx-rail-icon" }, /* @__PURE__ */ h(Icon2, { name: icon, size: 15 })), /* @__PURE__ */ h("span", { className: "tbx-rail-label" }, label), count != null && count !== "" && count !== 0 && /* @__PURE__ */ h("small", null, count)), more && /* @__PURE__ */ h("button", { type: "button", className: "tbx-rail-more", "aria-label": more.label, title: more.label, disabled, onClick: more.onClick }, /* @__PURE__ */ h(Icon2, { name: "more", size: 15 })));
  }
  function RailTags({ tags, selected = [], onToggle, disabled }) {
    return /* @__PURE__ */ h("div", { className: "tbx-rail-tags" }, tags.map((t2) => /* @__PURE__ */ h("button", { key: t2.id, type: "button", "aria-pressed": selected.includes(t2.id), disabled, onClick: () => onToggle(t2.id) }, /* @__PURE__ */ h(Icon2, { name: "tag", size: 12, stroke: 2.2 }), t2.name)));
  }
  function RailHint({ children, tone }) {
    const { useWorkbenchShell } = tb();
    const shell = useWorkbenchShell();
    return /* @__PURE__ */ h("button", { type: "button", className: cx("tbx-rail-hint", tone && `is-${tone}`), onClick: () => shell.openPanel?.("ai") }, /* @__PURE__ */ h(Icon2, { name: "sparkles", size: 16, stroke: 1.9 }), /* @__PURE__ */ h("span", null, children), /* @__PURE__ */ h(Icon2, { name: "forward", size: 13, stroke: 2.2 }));
  }
  function PaneTitle({ icon, tone, title, sub, id, children }) {
    return /* @__PURE__ */ h("div", { className: "tbx-pane-title" }, /* @__PURE__ */ h("span", { className: cx("tbx-mod-icon", tone && `is-${tone}`), "aria-hidden": "true" }, icon), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h1", { id, tabIndex: -1 }, title), sub != null && /* @__PURE__ */ h("span", null, sub)), children);
  }
  function PrimaryButton({ icon = "plus", label, onClick, disabled, compact }) {
    return /* @__PURE__ */ h("button", { type: "button", className: cx("tbx-primary", compact && "is-compact"), disabled, onClick, "aria-label": compact ? label : void 0, title: compact ? label : void 0 }, /* @__PURE__ */ h(Icon2, { name: icon, size: 16, stroke: 2.3 }), !compact && /* @__PURE__ */ h("span", null, label));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/kit/segmented.jsx
  function useSlidingThumb2(ref, selector, deps) {
    const [thumb, setThumb] = useState(null);
    useLayoutEffect(() => {
      const box = ref.current;
      if (!box) return void 0;
      const measure2 = () => {
        const el = box.querySelector(selector);
        setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
      };
      measure2();
      const ro = new ResizeObserver(measure2);
      ro.observe(box);
      return () => ro.disconnect();
    }, deps);
    return thumb;
  }
  function Segmented({ value, options, onChange, label, className, iconOnly }) {
    const ref = useRef(null);
    const thumb = useSlidingThumb2(ref, '[aria-pressed="true"]', [value, options.length]);
    return /* @__PURE__ */ h("div", { className: cx("tbx-seg", iconOnly && "is-icons", className), ref, role: "group", "aria-label": label }, thumb && /* @__PURE__ */ h("span", { className: "tbx-seg-thumb", style: { transform: `translateX(${thumb.left}px)`, width: `${thumb.width}px` }, "aria-hidden": "true" }), options.map((o) => /* @__PURE__ */ h("button", { key: o.value, type: "button", "aria-pressed": o.value === value, "aria-label": iconOnly ? o.label : void 0, title: iconOnly ? o.label : void 0, onClick: () => o.value !== value && onChange(o.value) }, o.icon, !iconOnly && /* @__PURE__ */ h("span", null, o.label))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/kit/colors.js
  var LABEL_COLORS = ["#ff6b75", "#3edc81", "#5b9cf5", "#a78bfa", "#ffb454", "#f27ab8", "#43c6c6", "#9ba0aa"];
  var colorOf = (item, index = 0) => item?.color || LABEL_COLORS[(index % LABEL_COLORS.length + LABEL_COLORS.length) % LABEL_COLORS.length];

  // docs/design-system/teachbuddy-app/ui/tbx/src/resources/ResourceLibrary.jsx
  var ROOT = "/api/modules/resources";
  var KINDS = [
    { id: "pdf", name: "PDF", hue: "#e0352b" },
    { id: "ppt", name: "\u6F14\u793A\u6587\u7A3F", hue: "#c96f00" },
    { id: "doc", name: "\u6587\u6863", hue: "#0071e3" },
    { id: "img", name: "\u56FE\u7247", hue: "#1f9d55" },
    { id: "html", name: "\u7F51\u9875", hue: "#8e44ad" }
  ];
  var KIND_BY_TYPE = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "doc",
    "application/msword": "doc",
    "image/png": "img",
    "image/jpeg": "img",
    "image/webp": "img",
    "image/gif": "img",
    "text/html": "html"
  };
  var KIND_BY_EXT = { pdf: "pdf", ppt: "ppt", pptx: "ppt", key: "ppt", doc: "doc", docx: "doc", png: "img", jpg: "img", jpeg: "img", webp: "img", gif: "img", html: "html", htm: "html" };
  var Icon3 = ({ name, size = 17, stroke = 1.9 }) => {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: stroke });
  };
  var extOf = (file) => (file?.name?.split(".").pop() || "").toLowerCase();
  var kindOf = (file) => KIND_BY_TYPE[file?.mediaType] ?? KIND_BY_EXT[extOf(file)] ?? null;
  var sizeOf = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };
  var dayOf = (iso2) => iso2 ? monthDay(iso2.slice(0, 10)) : "";
  var KindMark = ({ kind }) => /* @__PURE__ */ h("span", { className: "tbx-filter-mark", style: { color: KINDS.find((k) => k.id === kind)?.hue } }, /* @__PURE__ */ h(Icon3, { name: "fileType", size: 15, stroke: 2 }));
  var urls = /* @__PURE__ */ new Map();
  var loading = /* @__PURE__ */ new Map();
  function useFileUrl(client, id) {
    const [url, setUrl] = useState(() => id && urls.get(id) || "");
    useEffect(() => {
      if (!id) return void 0;
      if (urls.has(id)) {
        setUrl(urls.get(id));
        return void 0;
      }
      let live = true;
      let job = loading.get(id);
      if (!job) {
        job = client.request(`/api/workbench/files/${id}/content`, { blob: true }).then((blob) => {
          const u = URL.createObjectURL(blob);
          urls.set(id, u);
          return u;
        });
        loading.set(id, job);
        job.catch(() => loading.delete(id));
      }
      job.then((u) => {
        if (live) setUrl(u);
      }).catch(() => {
      });
      return () => {
        live = false;
      };
    }, [id]);
    return url;
  }
  function UploadButton({ onUpload, disabled, big }) {
    return /* @__PURE__ */ h("label", { className: cx("tbx-primary tbx-res-upload", big && "is-big", disabled && "is-disabled") }, /* @__PURE__ */ h(Icon3, { name: "upload", size: big ? 18 : 16, stroke: 2.1 }), /* @__PURE__ */ h("span", null, tx("\u4E0A\u4F20\u8D44\u6599")), /* @__PURE__ */ h(
      "input",
      {
        type: "file",
        multiple: true,
        hidden: true,
        disabled,
        "aria-label": tx("\u4E0A\u4F20\u8D44\u6599"),
        onChange: (e) => {
          onUpload(Array.from(e.target.files));
          e.target.value = "";
        }
      }
    ));
  }
  function Thumb({ client, preview, file, title, error }) {
    const ext = extOf(file);
    const kind = kindOf(file) ?? "file";
    const page = preview?.pages?.[0];
    const url = useFileUrl(client, page?.imageFileId);
    return /* @__PURE__ */ h("span", { className: cx("tbx-res-thumb", `is-${kind}`, !page && "is-blank") }, page ? url ? /* @__PURE__ */ h("img", { src: url, alt: tx("{{title}} \u7F29\u7565\u56FE", { title }), draggable: false }) : null : /* @__PURE__ */ h("span", { className: "tbx-res-thumb-mark" }, /* @__PURE__ */ h(Icon3, { name: "file", size: 26, stroke: 1.6 }), /* @__PURE__ */ h("em", null, ext ? ext.toUpperCase() : tx("\u6587\u4EF6"))), ext && page && /* @__PURE__ */ h("span", { className: "tbx-res-badge" }, ext.toUpperCase()), error && /* @__PURE__ */ h("span", { className: "tbx-res-thumb-error" }, error));
  }
  var TagDot = ({ tag, index }) => /* @__PURE__ */ h("span", { className: "tbx-res-tag", style: { "--tag": colorOf(tag, index) } }, /* @__PURE__ */ h("i", null), tag.name);
  function TagDialog({ tag, tax, busy, onWrite, onClose }) {
    const { scheduleKit: K } = tb();
    const index = tag ? tax.tags.findIndex((t2) => t2.id === tag.id) : tax.tags.length;
    const [name, setName] = useState(tag?.name ?? "");
    const [color, setColor] = useState(colorOf(tag, index));
    const trimmed = name.trim();
    const clash = tax.tags.some((t2) => t2.id !== tag?.id && t2.name.trim().toLowerCase() === trimmed.toLowerCase());
    const write = async (tags) => {
      if (await onWrite(`${ROOT}/taxonomy`, { baseVersion: tax.version, folders: tax.folders, tags }, "taxonomy")) onClose();
    };
    const save = () => {
      if (!trimmed || clash) return;
      const next = { ...tag || { id: crypto.randomUUID() }, name: trimmed, color };
      write(tag ? tax.tags.map((t2) => t2.id === tag.id ? next : t2) : [...tax.tags, next]);
    };
    return /* @__PURE__ */ h(K.CalendarDialog, { title: tag ? tx("\u7F16\u8F91\u6807\u7B7E") : tx("\u65B0\u5EFA\u6807\u7B7E"), onClose }, /* @__PURE__ */ h("label", { className: "cal-field" }, tx("\u540D\u79F0"), /* @__PURE__ */ h("input", { "aria-label": tx("\u6807\u7B7E\u540D\u79F0"), maxLength: "60", value: name, onChange: (e) => setName(e.target.value) })), clash && /* @__PURE__ */ h("p", { className: "cal-error", role: "alert" }, tx("\u5DF2\u7ECF\u6709\u53EB\u201C{{name}}\u201D\u7684\u6807\u7B7E\u4E86", { name: trimmed })), /* @__PURE__ */ h("fieldset", { className: "cal-label-colors" }, /* @__PURE__ */ h("legend", null, tx("\u989C\u8272")), LABEL_COLORS.map((value) => /* @__PURE__ */ h("button", { key: value, type: "button", "aria-label": tx("\u989C\u8272 {{value}}", { value }), "aria-pressed": color === value, style: { background: value }, onClick: () => setColor(value) }, value === color && /* @__PURE__ */ h(Icon3, { name: "check", size: 16, stroke: 2.4 })))), /* @__PURE__ */ h("footer", null, tag && /* @__PURE__ */ h(ConfirmButton, { className: "cal-label-delete", label: tx("\u5220\u9664\u6807\u7B7E"), text: tx("\u5220\u9664\u6807\u7B7E"), disabled: busy, onConfirm: () => write(tax.tags.filter((t2) => t2.id !== tag.id)) }), /* @__PURE__ */ h("button", { type: "button", onClick: onClose }, tx("\u53D6\u6D88")), /* @__PURE__ */ h("button", { type: "button", className: "is-primary", "data-dialog-confirm": "", disabled: !trimmed || clash || busy, onClick: save }, tx("\u4FDD\u5B58"))));
  }
  function SelectionTags({ anchor, open, onClose, picked, tax, busy, onAdd, onRemove, onNew }) {
    return /* @__PURE__ */ h(Popover, { anchor, open, onClose, align: "center", role: "menu", label: tx("\u6807\u7B7E"), className: "tbx-res-tagmenu" }, /* @__PURE__ */ h("div", { className: "tbx-popover-label" }, tx("\u7ED9 {{n}} \u4EFD\u8D44\u6599\u52A0\u6807\u7B7E\u6216\u53BB\u6389\u6807\u7B7E", { n: picked.length })), tax.tags.map((t2, i) => {
      const have = picked.filter((r) => r.tagIds.includes(t2.id)).length;
      const all = have === picked.length && have > 0;
      return /* @__PURE__ */ h("button", { key: t2.id, type: "button", role: "menuitemcheckbox", "aria-checked": all ? "true" : have ? "mixed" : "false", disabled: busy, onClick: () => all ? onRemove(t2.id) : onAdd(t2.id) }, /* @__PURE__ */ h("i", { className: "tbx-filter-dot", style: { background: colorOf(t2, i) } }), /* @__PURE__ */ h("span", { className: "tbx-res-tagmenu-name" }, t2.name), have > 0 && !all && /* @__PURE__ */ h("small", null, have, "/", picked.length), (all || have > 0) && /* @__PURE__ */ h("span", { className: "tbx-pop-check" }, /* @__PURE__ */ h(Icon3, { name: all ? "check" : "minus", size: 14, stroke: 2.4 })));
    }), tax.tags.length > 0 && /* @__PURE__ */ h("div", { className: "tbx-popover-sep" }), /* @__PURE__ */ h("button", { type: "button", role: "menuitem", onClick: onNew }, /* @__PURE__ */ h(Icon3, { name: "plus", size: 15, stroke: 2.2 }), tx("\u65B0\u5EFA\u6807\u7B7E\u2026")));
  }
  function ResourceLibrary(props) {
    useLocale();
    const {
      scene,
      patchScene,
      items,
      allItems,
      tax,
      files,
      previews,
      fileErrors = {},
      client,
      busy,
      loading: listLoading,
      searchInfo,
      onRetrySearch,
      listRef,
      breadcrumbs,
      onOpen,
      onUpload,
      onManage,
      onOrganize,
      onWrite
    } = props;
    const { scheduleKit: K } = tb();
    const [drop, setDrop] = useState(false);
    const deleted = scene.state === "deleted";
    const active = allItems.filter((i) => !i.deletedAt);
    const archived = allItems.filter((i) => i.deletedAt);
    const kinds = scene.kinds || [];
    const unfiled = Boolean(scene.unfiled) && !deleted;
    const filtered = Boolean(scene.q || scene.folderId || unfiled || kinds.length || scene.tagIds.length);
    const firstVisit = !listLoading && !active.length && !deleted && !filtered;
    const select = scene.selectionMode;
    const folder = tax.folders.find((f) => f.id === scene.folderId);
    const tagIndex = (id) => tax.tags.findIndex((t2) => t2.id === id);
    const tagOf = (id) => tax.tags.find((t2) => t2.id === id);
    const folderName = (id) => tax.folders.find((f) => f.id === id)?.name;
    const go = (patch) => patchScene({ selected: [], selectionMode: false, ...patch });
    const clear = () => {
      setQ("");
      sent.current = "";
      patchScene({ q: "", folderId: "", unfiled: false, tagIds: [], mediaType: "", kinds: [] });
    };
    const toggleTag = (id) => patchScene({ tagIds: scene.tagIds.includes(id) ? scene.tagIds.filter((x) => x !== id) : [...scene.tagIds, id] });
    useEffect(() => {
      if (!scene.mediaType) return;
      const kind = KIND_BY_TYPE[scene.mediaType];
      patchScene({ mediaType: "", kinds: kind ? [kind] : [] });
    }, [scene.mediaType]);
    const byKind = kinds.length ? items.filter((r) => {
      const k = kindOf(files[r.fileId]);
      return !k ? !files[r.fileId] : kinds.includes(k);
    }) : items;
    const shown = unfiled ? byKind.filter((r) => !r.folderId) : byKind;
    const byId = new Map(allItems.map((r) => [r.id, r]));
    const [q, setQ] = useState(scene.q);
    const sent = useRef(scene.q);
    useEffect(() => {
      if (scene.q !== sent.current) {
        sent.current = scene.q;
        setQ(scene.q);
      }
    }, [scene.q]);
    useEffect(() => {
      if (q === sent.current) return void 0;
      const timer = setTimeout(() => {
        sent.current = q;
        patchScene({ q });
      }, 280);
      return () => clearTimeout(timer);
    }, [q]);
    const closed = new Set(scene.foldersClosed || []);
    const kids = (parentId) => tax.folders.filter((f) => (f.parentId ?? null) === parentId);
    const inside = (id) => {
      const out = /* @__PURE__ */ new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        tax.folders.forEach((f) => {
          if (out.has(f.parentId) && !out.has(f.id)) {
            out.add(f.id);
            grew = true;
          }
        });
      }
      return out;
    };
    const countIn = (id) => {
      const set = inside(id);
      return active.filter((i) => set.has(i.folderId)).length;
    };
    const tagged = (id) => active.filter((i) => i.tagIds.includes(id)).length;
    const toggleFold = (id) => patchScene({ foldersClosed: closed.has(id) ? [...closed].filter((x) => x !== id) : [...closed, id] });
    const openFolder = (id) => !deleted && scene.folderId === id ? go({ state: "active", folderId: "", unfiled: false }) : go({ state: "active", folderId: id, unfiled: false });
    const writeTax = (folders, tags) => onWrite(`${ROOT}/taxonomy`, { baseVersion: tax.version, folders, tags }, "taxonomy");
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState("");
    const [nameError, setNameError] = useState("");
    const startNew = (parentId = null) => {
      setEditing({ mode: "new", parentId });
      setDraft("");
      setNameError("");
      if (parentId && closed.has(parentId)) patchScene({ foldersClosed: [...closed].filter((id) => id !== parentId) });
    };
    const startRename = (f) => {
      setEditing({ mode: "rename", id: f.id });
      setDraft(f.name);
      setNameError("");
    };
    const stopEditing = () => {
      setEditing(null);
      setDraft("");
      setNameError("");
    };
    const folderProblem = (name) => {
      const n = name.trim().toLowerCase();
      if (!n) return tx("\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
      if ([tx("\u672A\u5206\u7EC4"), "\u672A\u5206\u7EC4", "ungrouped"].map((x) => x.toLowerCase()).includes(n)) return tx("\u201C\u672A\u5206\u7EC4\u201D\u662F\u4FDD\u7559\u7684\u540D\u79F0");
      const parentId = editing.mode === "new" ? editing.parentId : tax.folders.find((f) => f.id === editing.id)?.parentId ?? null;
      if (tax.folders.some((f) => f.id !== editing.id && (f.parentId ?? null) === parentId && f.name.trim().toLowerCase() === n)) return tx("\u5DF2\u7ECF\u6709\u53EB\u201C{{name}}\u201D\u7684\u6587\u4EF6\u5939\u4E86", { name: name.trim() });
      return "";
    };
    async function commitName(leaving = false) {
      if (!editing) return;
      const problem = folderProblem(draft);
      if (problem) {
        if (leaving) stopEditing();
        else setNameError(problem);
        return;
      }
      const name = draft.trim();
      const current = editing;
      stopEditing();
      if (current.mode === "new") await writeTax([...tax.folders, { id: crypto.randomUUID(), name, parentId: current.parentId }], tax.tags);
      else if (tax.folders.find((f) => f.id === current.id)?.name !== name) await writeTax(tax.folders.map((f) => f.id === current.id ? { ...f, name } : f), tax.tags);
    }
    const nameField = (depth) => /* @__PURE__ */ h("div", { className: "tbx-rail-editing", style: { "--depth": depth } }, /* @__PURE__ */ h("form", { className: cx("tbx-new-group", nameError && "is-invalid"), onSubmit: (e) => {
      e.preventDefault();
      commitName();
    } }, /* @__PURE__ */ h(Icon3, { name: "folder", size: 16, stroke: 2 }), /* @__PURE__ */ h(
      "input",
      {
        autoFocus: true,
        value: draft,
        maxLength: 80,
        placeholder: tx("\u6587\u4EF6\u5939\u540D\u79F0"),
        "aria-label": editing?.mode === "new" ? tx("\u65B0\u6587\u4EF6\u5939\u540D\u79F0") : tx("\u91CD\u547D\u540D\u6587\u4EF6\u5939"),
        "aria-invalid": nameError ? true : void 0,
        onFocus: (e) => e.target.select(),
        onChange: (e) => {
          setDraft(e.target.value);
          setNameError("");
        },
        onBlur: () => commitName(true),
        onKeyDown: (e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            stopEditing();
          }
        }
      }
    )), nameError && /* @__PURE__ */ h("p", { className: "tbx-name-error", role: "alert" }, nameError));
    const [folderMenu, setFolderMenu] = useState(null);
    const [folderMove, setFolderMove] = useState(null);
    const folderPath = (f) => {
      const path2 = [f.name];
      const visited = /* @__PURE__ */ new Set([f.id]);
      let parent = f.parentId;
      while (parent && !visited.has(parent)) {
        visited.add(parent);
        const p = tax.folders.find((x) => x.id === parent);
        if (!p) break;
        path2.unshift(p.name);
        parent = p.parentId;
      }
      return path2.join(" / ");
    };
    const canMoveFolder = (f, parentId) => {
      if (inside(f.id).has(parentId)) return false;
      return !tax.folders.some((sibling) => sibling.id !== f.id && (sibling.parentId ?? null) === parentId && sibling.name.trim().toLowerCase() === f.name.trim().toLowerCase());
    };
    const moveFolder = async (f, parentId) => {
      setFolderMove(null);
      if ((f.parentId ?? null) === parentId || !canMoveFolder(f, parentId)) return;
      await writeTax(tax.folders.map((x) => x.id === f.id ? { ...x, parentId } : x), tax.tags);
    };
    const deleteFolder = async (f) => {
      setFolderMenu(null);
      const branch = inside(f.id);
      const ok = await writeTax(tax.folders.filter((x) => !branch.has(x.id)), tax.tags);
      if (ok && branch.has(scene.folderId)) go({ folderId: "", unfiled: false });
    };
    const archiveFolder = async (f) => {
      const branch = inside(f.id);
      const contents = active.filter((item) => branch.has(item.folderId));
      if (contents.length && !await organize("archive", contents)) return;
      const ok = await writeTax(tax.folders.filter((x) => !branch.has(x.id)), tax.tags);
      if (ok && branch.has(scene.folderId)) go({ folderId: "", unfiled: false });
    };
    const [railDrag, setRailDrag] = useState(null);
    const tagList = useRef(null);
    function startRailDrag(e, kind, item) {
      if (e.button !== 0 || deleted || busy || !onWrite || editing || e.target.closest(".tbx-rail-more, .tbx-rail-toggle, input")) return;
      const row = e.currentTarget;
      const r = row.getBoundingClientRect();
      const label = row.querySelector(".tbx-rail-label");
      const compact = label ? Math.min(r.width, label.getBoundingClientRect().right - r.left + 14) : r.width;
      const grab = { dx: Math.min(e.clientX - r.left, compact - 16), dy: e.clientY - r.top };
      const sx = e.clientX;
      const sy = e.clientY;
      const blocked = kind === "folder" ? inside(item.id) : null;
      let on = false;
      let target = null;
      let index = null;
      const mark = (el) => {
        if (target === el) return;
        target?.classList.remove("is-drop");
        target = el;
        target?.classList.add("is-drop");
      };
      const move = (ev) => {
        if (!on && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        if (!on) {
          on = true;
          document.documentElement.classList.add("tbx-dragging");
        }
        let line = null;
        if (kind === "folder") {
          const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-drop]");
          const where = hit?.dataset.drop;
          const id = where?.startsWith("folder:") ? where.slice(7) : null;
          const allowed = where === "archive" || id !== null && !blocked.has(id) && id !== (item.parentId ?? "") && canMoveFolder(item, id || null);
          mark(hit && allowed ? hit : null);
        } else {
          const box = tagList.current;
          const rows = [...box.querySelectorAll(":scope > .tbx-rail-drag")];
          const b = box.getBoundingClientRect();
          index = rows.findIndex((el) => {
            const rr = el.getBoundingClientRect();
            return ev.clientY < rr.top + rr.height / 2;
          });
          if (index < 0) index = rows.length;
          const edge = index < rows.length ? rows[index].getBoundingClientRect().top : rows[rows.length - 1].getBoundingClientRect().bottom;
          line = edge - b.top;
        }
        setRailDrag({ kind, item, x: ev.clientX, y: ev.clientY, ...grab, line });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.documentElement.classList.remove("tbx-dragging");
        const where = target?.dataset.drop;
        mark(null);
        setRailDrag(null);
        if (!on) return;
        const swallow = (ce) => {
          ce.stopPropagation();
          ce.preventDefault();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
        if (kind === "folder" && where) {
          if (where === "archive") archiveFolder(item);
          else if (where.startsWith("folder:")) moveFolder(item, where.slice(7) || null);
        }
        if (kind === "tag" && index != null) {
          const from = tax.tags.findIndex((t2) => t2.id === item.id);
          const to = index > from ? index - 1 : index;
          if (to !== from) {
            const painted = tax.tags.map((t2, i) => ({ ...t2, color: colorOf(t2, i) }));
            const next = painted.filter((t2) => t2.id !== item.id);
            next.splice(to, 0, painted[from]);
            writeTax(tax.folders, next);
          }
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
    const folderRows = (parentId, depth) => kids(parentId).map((f) => {
      const children = kids(f.id);
      const isOpen = !closed.has(f.id);
      const current = !deleted && scene.folderId === f.id;
      return /* @__PURE__ */ h(Fragment, { key: f.id }, editing?.mode === "rename" && editing.id === f.id ? nameField(depth) : /* @__PURE__ */ h("div", { className: cx("tbx-rail-drag", railDrag?.item.id === f.id && "is-origin"), onPointerDown: (e) => startRailDrag(e, "folder", f) }, /* @__PURE__ */ h(
        RailItem,
        {
          className: "is-tree",
          icon: current ? "folderOpen" : "folder",
          label: f.name,
          depth,
          count: countIn(f.id),
          current,
          drop: deleted ? void 0 : `folder:${f.id}`,
          onClick: () => openFolder(f.id),
          toggle: children.length ? { open: isOpen, label: isOpen ? tx("\u6536\u8D77") : tx("\u5C55\u5F00"), onClick: () => toggleFold(f.id) } : null,
          more: onWrite && !deleted ? { label: tx("\u6587\u4EF6\u5939\u9009\u9879"), onClick: (e) => {
            const el = e.currentTarget;
            setFolderMenu((m) => m?.folder.id === f.id ? null : { folder: f, anchor: { current: el } });
          } } : null
        }
      )), (children.length > 0 || editing?.mode === "new" && editing.parentId === f.id) && /* @__PURE__ */ h("div", { className: cx("tbx-rail-fold", !isOpen && "is-closed"), inert: isOpen ? void 0 : "" }, /* @__PURE__ */ h("div", null, folderRows(f.id, depth + 1), editing?.mode === "new" && editing.parentId === f.id && nameField(depth + 1))));
    });
    const title = deleted ? tx("\u5DF2\u5F52\u6863") : folder ? folder.name : unfiled ? tx("\u672A\u5206\u7EC4") : tx("\u5168\u90E8\u8D44\u6599");
    useEffect(() => {
      const el = listRef.current;
      if (el && scene.scroll) el.scrollTop = scene.scroll;
    }, []);
    const [band, setBand] = useState(null);
    const selected = band ? band.ids : scene.selected;
    const isPicked = (id) => selected.includes(id);
    const picked = scene.selected.map((id) => byId.get(id)).filter(Boolean);
    async function downloadPicked() {
      for (const item of picked) {
        try {
          await client.download(item.fileId, files[item.fileId]?.name || item.title);
        } catch (error) {
          console.error("Resource download failed:", error);
          break;
        }
      }
    }
    const allPicked = shown.length > 0 && shown.slice(0, 100).every((r) => scene.selected.includes(r.id));
    const pick3 = (id) => patchScene({ selected: scene.selected.includes(id) ? scene.selected.filter((x) => x !== id) : [...scene.selected, id] });
    const scrollRef = useRef(null);
    const setScrollRef = (el) => {
      scrollRef.current = el;
      if (typeof listRef === "function") listRef(el);
      else if (listRef) listRef.current = el;
    };
    function startBand(e) {
      if (e.button !== 0 || e.target.closest(".tbx-res-card, .tbx-res-thead, .tbx-res-empty button, a, input, label")) return;
      const box = scrollRef.current;
      if (!box || !shown.length) return;
      const start = { x: e.clientX, y: e.clientY, top: box.scrollTop };
      const base = e.shiftKey || e.metaKey || e.ctrlKey ? scene.selected : [];
      let moved = false;
      let last = { x: e.clientX, y: e.clientY };
      let frame = 0;
      const update = () => {
        const r = box.getBoundingClientRect();
        const y0 = start.y - (box.scrollTop - start.top);
        const rect = { left: Math.min(start.x, last.x), right: Math.max(start.x, last.x), top: Math.min(y0, last.y), bottom: Math.max(y0, last.y) };
        const ids = [...base];
        box.querySelectorAll(".tbx-res-card[data-id]").forEach((el) => {
          const c = el.getBoundingClientRect();
          if (c.right > rect.left && c.left < rect.right && c.bottom > rect.top && c.top < rect.bottom && !ids.includes(el.dataset.id)) ids.push(el.dataset.id);
        });
        setBand({ ids, x: rect.left - r.left, y: rect.top - r.top + box.scrollTop, w: rect.right - rect.left, h: rect.bottom - rect.top });
      };
      const tick = () => {
        const r = box.getBoundingClientRect();
        const edge = 36;
        const speed = last.y < r.top + edge ? -(r.top + edge - last.y) / 2 : last.y > r.bottom - edge ? (last.y - (r.bottom - edge)) / 2 : 0;
        if (speed) {
          box.scrollTop += Math.max(-18, Math.min(18, speed));
          update();
        }
        frame = requestAnimationFrame(tick);
      };
      const move = (ev) => {
        last = { x: ev.clientX, y: ev.clientY };
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
        if (!moved) {
          moved = true;
          document.documentElement.classList.add("tbx-banding");
          frame = requestAnimationFrame(tick);
        }
        update();
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        cancelAnimationFrame(frame);
        document.documentElement.classList.remove("tbx-banding");
        setBand((b) => {
          if (moved && b) patchScene({ selectionMode: true, selected: b.ids.slice(0, 100) });
          else if (!moved && select && !base.length) patchScene({ selected: [] });
          return null;
        });
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
    const [drag, setDrag] = useState(null);
    const dragging = useRef(false);
    const suppressClick = useRef(false);
    function organize(action, list, extra = {}) {
      if (!onWrite || !list.length) return Promise.resolve(false);
      return onWrite(`${ROOT}/items/organize`, {
        action,
        items: list.map((r) => ({ id: r.id, baseVersion: r.version })),
        folderId: null,
        tagIds: [],
        ...extra
      }, "organize", "POST");
    }
    function startDrag(e, r) {
      if (e.button !== 0 || deleted || !onWrite || busy) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const ids = select && scene.selected.includes(r.id) ? scene.selected : [r.id];
      let on = false;
      let target = null;
      const mark = (el) => {
        if (target === el) return;
        target?.classList.remove("is-drop");
        target = el;
        target?.classList.add("is-drop");
      };
      const move = (ev) => {
        if (!on && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        if (!on) {
          on = true;
          dragging.current = true;
          document.documentElement.classList.add("tbx-dragging");
        }
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-drop]");
        mark(hit && !hit.querySelector(".tbx-rail-hit:disabled") ? hit : null);
        setDrag({ x: ev.clientX, y: ev.clientY, ids, item: r });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.documentElement.classList.remove("tbx-dragging");
        const where = target?.dataset.drop;
        mark(null);
        setDrag(null);
        dragging.current = false;
        if (!on) return;
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        const list = ids.map((id2) => byId.get(id2)).filter(Boolean);
        if (!where) return;
        const [kind, id] = where.split(":");
        if (kind === "folder") organize("move", list.filter((x) => (x.folderId || "") !== id), { folderId: id || null });
        if (kind === "tag") organize("add-tags", list.filter((x) => !x.tagIds.includes(id)), { tagIds: [id] });
        if (kind === "archive") organize("archive", list);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
    const tagButton = useRef(null);
    const [tagMenu, setTagMenu] = useState(false);
    const [tagDialog, setTagDialog] = useState(null);
    const [purging, setPurging] = useState(false);
    async function removeTag(id) {
      for (const r of picked.filter((x) => x.tagIds.includes(id))) {
        const ok = await onWrite(`${ROOT}/items/${r.id}`, { baseVersion: r.version, title: r.title, folderId: r.folderId, tagIds: r.tagIds.filter((t2) => t2 !== id), note: r.note }, "metadata");
        if (!ok) break;
      }
    }
    async function purge() {
      for (const r of picked) {
        const ok = await onWrite(`${ROOT}/items/${r.id}/purge`, { baseVersion: r.version }, "purge", "POST");
        if (!ok) break;
      }
      setPurging(false);
      patchScene({ selected: [] });
    }
    const view = scene.view === "list" ? "list" : "grid";
    const dragged = drag?.item;
    return /* @__PURE__ */ h(
      "section",
      {
        className: "tbx-res tbx-split",
        hidden: !!scene.openId,
        onDragOver: (e) => {
          if (!deleted && !dragging.current && e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault();
            setDrop(true);
          }
        },
        onDragLeave: (e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDrop(false);
        },
        onDrop: (e) => {
          if (!deleted && e.dataTransfer?.files?.length) {
            e.preventDefault();
            setDrop(false);
            onUpload(Array.from(e.dataTransfer.files));
          }
        }
      },
      /* @__PURE__ */ h("div", { className: cx("tbx-res-main", drop && "is-drop"), "aria-busy": listLoading }, /* @__PURE__ */ h("header", { className: "tbx-res-bar" }, /* @__PURE__ */ h(
        PaneTitle,
        {
          icon: /* @__PURE__ */ h(Icon3, { name: deleted ? "trash" : folder ? "folderOpen" : "folder", size: 20, stroke: 2 }),
          title,
          sub: /* @__PURE__ */ h(Fragment, null, breadcrumbs.length > 1 && !deleted && /* @__PURE__ */ h("nav", { className: "tbx-res-crumbs", "aria-label": tx("\u5F53\u524D\u8D44\u6599\u6587\u4EF6\u5939") }, breadcrumbs.slice(0, -1).map((b) => /* @__PURE__ */ h("button", { key: b.id, type: "button", onClick: () => go({ folderId: b.id }) }, b.name, /* @__PURE__ */ h(Icon3, { name: "chevron", size: 12, stroke: 2.2 })))), listLoading && !items.length && !filtered ? tx("\u6B63\u5728\u8BFB\u53D6\u2026") : tx("{{n}} \u4EFD\u8D44\u6599", { n: shown.length }))
        }
      ), !firstVisit && /* @__PURE__ */ h("div", { className: "tbx-res-tools" }, /* @__PURE__ */ h("label", { className: "tbx-res-search" }, /* @__PURE__ */ h(Icon3, { name: "search", size: 16, stroke: 2 }), /* @__PURE__ */ h(
        "input",
        {
          "aria-label": tx("\u641C\u7D22\u8D44\u6599"),
          placeholder: tx("\u641C\u7D22\u540D\u79F0\u3001\u5907\u6CE8\u6216\u6B63\u6587"),
          maxLength: 200,
          value: q,
          onChange: (e) => setQ(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              sent.current = q;
              patchScene({ q });
            }
          }
        }
      ), q && /* @__PURE__ */ h("button", { type: "button", className: "tbx-res-clear", "aria-label": tx("\u6E05\u9664\u641C\u7D22"), onClick: () => {
        setQ("");
        sent.current = "";
        patchScene({ q: "" });
      } }, /* @__PURE__ */ h(Icon3, { name: "close", size: 11, stroke: 2.8 }))), /* @__PURE__ */ h(
        FilterMenu,
        {
          label: tx("\u7C7B\u578B"),
          allLabel: tx("\u5168\u90E8\u7C7B\u578B"),
          icon: /* @__PURE__ */ h("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": "true" }, /* @__PURE__ */ h("path", { d: "M4 6h16M7 12h10M10 18h4" })),
          options: KINDS.map((k) => ({ id: k.id, name: tx(k.name), mark: /* @__PURE__ */ h(KindMark, { kind: k.id }) })),
          value: kinds,
          onChange: (next) => patchScene({ kinds: next, mediaType: "", selected: [] })
        }
      ), /* @__PURE__ */ h(
        Segmented,
        {
          iconOnly: true,
          label: tx("\u8D44\u6599\u663E\u793A\u65B9\u5F0F"),
          value: view,
          onChange: (v) => patchScene({ view: v }),
          options: [
            { value: "grid", label: tx("\u7F29\u7565\u56FE\u89C6\u56FE"), icon: /* @__PURE__ */ h(Icon3, { name: "grid", size: 15, stroke: 2 }) },
            { value: "list", label: tx("\u5217\u8868\u89C6\u56FE"), icon: /* @__PURE__ */ h(Icon3, { name: "list", size: 16, stroke: 2 }) }
          ]
        }
      ), /* @__PURE__ */ h("button", { type: "button", className: cx("tbx-res-chipbtn", select && "is-on"), "aria-pressed": Boolean(select), disabled: !select && !shown.length, onClick: () => patchScene({ selectionMode: !select, selected: [] }) }, select ? tx("\u5B8C\u6210") : tx("\u9009\u62E9")), !deleted && /* @__PURE__ */ h(UploadButton, { onUpload, disabled: busy }))), (kinds.length > 0 || scene.tagIds.length > 0 || Boolean(scene.q && searchInfo && (searchInfo.pending || searchInfo.interrupted || searchInfo.failed || searchInfo.ocr?.pendingPages))) && /* @__PURE__ */ h("div", { className: "tbx-res-filters" }, kinds.map((id) => /* @__PURE__ */ h("button", { key: id, type: "button", className: "tbx-res-filter is-kind", "aria-label": tx("\u79FB\u9664\u7B5B\u9009\uFF1A{{name}}", { name: tx(KINDS.find((k) => k.id === id)?.name) }), onClick: () => patchScene({ kinds: kinds.filter((x) => x !== id) }) }, /* @__PURE__ */ h(Icon3, { name: "fileType", size: 12, stroke: 2.2 }), tx(KINDS.find((k) => k.id === id)?.name), /* @__PURE__ */ h(Icon3, { name: "close", size: 10, stroke: 2.8 }))), scene.tagIds.map((id) => tagOf(id) && /* @__PURE__ */ h("button", { key: id, type: "button", className: "tbx-res-filter is-tag", style: { "--tag": colorOf(tagOf(id), tagIndex(id)) }, "aria-label": tx("\u79FB\u9664\u7B5B\u9009\uFF1A{{name}}", { name: tagOf(id).name }), onClick: () => toggleTag(id) }, /* @__PURE__ */ h("i", null), tagOf(id).name, /* @__PURE__ */ h(Icon3, { name: "close", size: 10, stroke: 2.8 }))), scene.q && searchInfo?.pending > 0 && /* @__PURE__ */ h("span", { className: "tbx-res-status" }, /* @__PURE__ */ h("span", { className: "tbx-spinner is-small" }), tx("\u6B63\u5728\u8BFB\u53D6 {{n}} \u4EFD\u8D44\u6599\u7684\u6B63\u6587\uFF0C\u7ED3\u679C\u4F1A\u81EA\u52A8\u8865\u5145\u2026", { n: searchInfo.pending })), scene.q && searchInfo?.ocr?.pendingPages > 0 && /* @__PURE__ */ h("span", { className: "tbx-res-status" }, /* @__PURE__ */ h("span", { className: "tbx-spinner is-small" }), tx("\u6B63\u5728\u8BC6\u522B {{n}} \u9875\u2026", { n: searchInfo.ocr.pendingPages })), scene.q && (searchInfo?.interrupted || searchInfo?.failed > 0) && /* @__PURE__ */ h("span", { className: "tbx-res-status is-warn" }, tx("\u90E8\u5206\u6B63\u6587\u6CA1\u6709\u8BFB\u5230\u3002"), /* @__PURE__ */ h("button", { type: "button", onClick: onRetrySearch }, tx("\u91CD\u8BD5")))), /* @__PURE__ */ h(
        "div",
        {
          className: cx("tbx-res-scroll", `is-${view}`, select && "is-selecting"),
          ref: setScrollRef,
          onScroll: (e) => patchScene({ scroll: e.currentTarget.scrollTop }),
          onPointerDown: startBand
        },
        shown.length > 0 && view === "list" && /* @__PURE__ */ h("div", { className: "tbx-res-thead", "aria-hidden": "true" }, /* @__PURE__ */ h("span", null, tx("\u540D\u79F0")), /* @__PURE__ */ h("span", null, tx("\u6587\u4EF6\u5939")), /* @__PURE__ */ h("span", null, tx("\u4FEE\u6539\u65E5\u671F")), /* @__PURE__ */ h("span", null, tx("\u5927\u5C0F"))),
        shown.length > 0 && /* @__PURE__ */ h("div", { className: cx("tbx-res-items", select && "is-selecting"), key: view }, shown.map((r, i) => {
          const file = files[r.fileId];
          const on = isPicked(r.id);
          const match = searchInfo?.matches?.[r.id];
          const tags = r.tagIds.map(tagOf).filter(Boolean);
          const where = folderName(r.folderId);
          const open = (e) => {
            if (suppressClick.current) return;
            if (select) pick3(r.id);
            else onOpen(r.id, e);
          };
          return /* @__PURE__ */ h(
            "article",
            {
              key: r.id,
              "data-id": r.id,
              className: cx("tbx-res-card", on && "is-picked", drag?.ids.includes(r.id) && "is-origin"),
              style: { "--i": Math.min(i, 12) },
              onPointerDown: (e) => startDrag(e, r)
            },
            /* @__PURE__ */ h("button", { type: "button", className: "tbx-res-open", onClick: open, "aria-pressed": select ? on : void 0 }, /* @__PURE__ */ h(Thumb, { client, preview: previews[r.fileId], file, title: r.title, error: fileErrors[r.fileId] ? tx("\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25") : ["limited", "failed"].includes(previews[r.fileId]?.state) ? tx("\u65E0\u6CD5\u9884\u89C8") : "" }), /* @__PURE__ */ h("span", { className: "tbx-res-copy" }, /* @__PURE__ */ h("strong", { title: r.title }, r.title), match ? /* @__PURE__ */ h("small", { className: "tbx-res-excerpt" }, match.page ? tx("\u7B2C {{page}} \u9875 \xB7 ", { page: match.page }) : tx("\u6B63\u6587 \xB7 "), match.excerpt) : view === "list" ? /* @__PURE__ */ h("small", { className: "tbx-res-meta" }, /* @__PURE__ */ h("span", { className: "tbx-res-file" }, file?.name), tags.map((t2) => /* @__PURE__ */ h(TagDot, { key: t2.id, tag: t2, index: tagIndex(t2.id) }))) : /* @__PURE__ */ h("small", { className: "tbx-res-meta" }, where ? /* @__PURE__ */ h("span", { className: "tbx-res-where" }, /* @__PURE__ */ h(Icon3, { name: "folder", size: 12, stroke: 2 }), where) : !tags.length && /* @__PURE__ */ h("span", { className: "tbx-res-where is-none" }, tx("\u672A\u5F52\u5165\u6587\u4EF6\u5939")), tags.map((t2) => /* @__PURE__ */ h(TagDot, { key: t2.id, tag: t2, index: tagIndex(t2.id) })))), view === "list" && /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: cx("tbx-res-col", !where && "is-none") }, where || tx("\u672A\u5F52\u5165\u6587\u4EF6\u5939")), /* @__PURE__ */ h("span", { className: "tbx-res-col tbx-num" }, dayOf(r.updatedAt)), /* @__PURE__ */ h("span", { className: "tbx-res-col tbx-num" }, sizeOf(file?.byteLength)))),
            select && /* @__PURE__ */ h("span", { className: cx("tbx-res-check", on && "is-on"), "aria-hidden": "true" }, /* @__PURE__ */ h(Icon3, { name: "check", size: 13, stroke: 3 }))
          );
        })),
        band && /* @__PURE__ */ h("div", { className: "tbx-res-band", style: { transform: `translate(${band.x}px, ${band.y}px)`, width: band.w, height: band.h }, "aria-hidden": "true" }),
        !shown.length && /* @__PURE__ */ h("div", { className: "tbx-res-empty" }, firstVisit ? /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("div", { className: "tbx-res-empty-art", "aria-hidden": "true" }, /* @__PURE__ */ h("span", { className: "is-a" }), /* @__PURE__ */ h("span", { className: "is-b" }), /* @__PURE__ */ h("span", { className: "is-c" }, /* @__PURE__ */ h(Icon3, { name: "upload", size: 22, stroke: 2 }))), /* @__PURE__ */ h("h3", null, tx("\u628A\u5E38\u7528\u7684\u8D44\u6599\u653E\u5728\u8FD9\u91CC")), /* @__PURE__ */ h("p", null, tx("\u8BFE\u4EF6\u3001\u8BD5\u5377\u3001\u8BB2\u4E49\u548C\u56FE\u7247\uFF0C\u4E0A\u4F20\u540E\u968F\u65F6\u9884\u89C8\u3001\u641C\u7D22\u6B63\u6587\u548C\u590D\u7528\u3002\u4E5F\u53EF\u4EE5\u76F4\u63A5\u628A\u6587\u4EF6\u62D6\u8FDB\u6765\u3002")), /* @__PURE__ */ h(UploadButton, { onUpload, disabled: busy, big: true })) : listLoading && !filtered ? /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: "tbx-res-empty-icon" }, /* @__PURE__ */ h("span", { className: "tbx-spinner" })), /* @__PURE__ */ h("h3", null, tx("\u6B63\u5728\u8BFB\u53D6\u8D44\u6599"))) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: "tbx-res-empty-icon" }, /* @__PURE__ */ h(Icon3, { name: filtered ? "search" : deleted ? "trash" : "folder", size: 24, stroke: 1.8 })), /* @__PURE__ */ h("h3", null, filtered ? tx("\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8D44\u6599") : deleted ? tx("\u6CA1\u6709\u5F52\u6863\u7684\u8D44\u6599") : tx("\u8FD9\u4E2A\u6587\u4EF6\u5939\u8FD8\u662F\u7A7A\u7684")), /* @__PURE__ */ h("p", null, filtered ? tx("\u6362\u4E2A\u5173\u952E\u8BCD\uFF0C\u6216\u8005\u6E05\u9664\u7B5B\u9009\u518D\u770B\u770B\u3002") : deleted ? tx("\u5F52\u6863\u7684\u8D44\u6599\u4F1A\u653E\u5728\u8FD9\u91CC\uFF0C\u968F\u65F6\u53EF\u4EE5\u6062\u590D\u3002") : tx("\u628A\u8D44\u6599\u62D6\u8FDB\u6765\uFF0C\u6216\u8005\u4E0A\u4F20\u4E00\u4EFD\u3002")), filtered && /* @__PURE__ */ h("button", { type: "button", className: "tbx-res-chipbtn", onClick: clear }, tx("\u6E05\u9664\u7B5B\u9009"))))
      ), drop && /* @__PURE__ */ h("div", { className: "tbx-res-drop", "aria-hidden": "true" }, /* @__PURE__ */ h("span", null, /* @__PURE__ */ h(Icon3, { name: "upload", size: 26, stroke: 2 })), /* @__PURE__ */ h("strong", null, tx("\u677E\u5F00\u5373\u53EF\u4E0A\u4F20")), /* @__PURE__ */ h("small", null, folder ? tx("\u653E\u8FDB\u201C{{name}}\u201D", { name: folder.name }) : tx("\u653E\u8FDB\u8D44\u6E90\u5E93"))), select && /* @__PURE__ */ h("div", { className: "tbx-res-selbar", role: "toolbar", "aria-label": tx("\u5DF2\u9009\u8D44\u6599\u64CD\u4F5C") }, /* @__PURE__ */ h("span", { className: "tbx-res-selcount" }, tx("\u5DF2\u9009 {{n}} \u4EFD", { n: scene.selected.length })), /* @__PURE__ */ h("button", { type: "button", className: cx(allPicked && "is-on"), "aria-pressed": allPicked, disabled: !shown.length, onClick: () => patchScene({ selected: allPicked ? [] : shown.slice(0, 100).map((x) => x.id) }) }, allPicked ? tx("\u53D6\u6D88\u5168\u9009") : tx("\u5168\u9009")), /* @__PURE__ */ h("span", { className: "tbx-res-selsep" }), /* @__PURE__ */ h("button", { type: "button", disabled: busy || !picked.length, onClick: () => downloadPicked() }, /* @__PURE__ */ h(Icon3, { name: "arrowDown", size: 15, stroke: 2 }), tx("\u4E0B\u8F7D")), !deleted && /* @__PURE__ */ h("button", { type: "button", disabled: busy || !picked.length, onClick: () => onOrganize("move") }, /* @__PURE__ */ h(Icon3, { name: "folder", size: 15, stroke: 2 }), tx("\u79FB\u52A8")), !deleted && /* @__PURE__ */ h("button", { type: "button", ref: tagButton, className: cx(tagMenu && "is-open"), "aria-haspopup": "menu", "aria-expanded": tagMenu, disabled: !picked.length, onClick: () => setTagMenu((o) => !o) }, /* @__PURE__ */ h(Icon3, { name: "tag", size: 15, stroke: 2 }), tx("\u6807\u7B7E")), deleted ? /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("button", { type: "button", disabled: busy || !picked.length, onClick: () => onOrganize("restore") }, /* @__PURE__ */ h(Icon3, { name: "restore", size: 15, stroke: 2 }), tx("\u6062\u590D")), /* @__PURE__ */ h("button", { type: "button", className: "is-danger", disabled: busy || !picked.length, onClick: () => setPurging(true) }, /* @__PURE__ */ h(Icon3, { name: "trash", size: 15, stroke: 2 }), tx("\u5F7B\u5E95\u5220\u9664"))) : /* @__PURE__ */ h("button", { type: "button", className: "is-danger", disabled: busy || !picked.length, onClick: () => onOrganize("archive") }, /* @__PURE__ */ h(Icon3, { name: "trash", size: 15, stroke: 2 }), tx("\u5F52\u6863"))), /* @__PURE__ */ h(
        SelectionTags,
        {
          anchor: tagButton,
          open: tagMenu && select && !deleted,
          onClose: () => setTagMenu(false),
          picked,
          tax,
          busy,
          onAdd: (id) => organize("add-tags", picked.filter((x) => !x.tagIds.includes(id)), { tagIds: [id] }),
          onRemove: removeTag,
          onNew: () => {
            setTagMenu(false);
            setTagDialog({ tag: null });
          }
        }
      )),
      /* @__PURE__ */ h(
        Rail,
        {
          label: tx("\u8D44\u6E90\u5E93\u5BFC\u822A"),
          footer: /* @__PURE__ */ h(RailItem, { icon: "trash", label: tx("\u5DF2\u5F52\u6863"), count: archived.length, current: deleted, drop: deleted ? void 0 : "archive", onClick: () => go({ state: deleted ? "active" : "deleted", q: "", folderId: "", unfiled: false, mediaType: "", kinds: [], tagIds: [] }) })
        },
        /* @__PURE__ */ h(RailSection, { title: tx("\u8D44\u6E90\u5E93"), count: active.length || "" }, /* @__PURE__ */ h(RailItem, { icon: "grid", label: tx("\u5168\u90E8\u8D44\u6599"), count: active.length, current: !deleted && !scene.folderId && !unfiled, onClick: () => go({ state: "active", folderId: "", unfiled: false }) })),
        /* @__PURE__ */ h(
          RailSection,
          {
            title: tx("\u6587\u4EF6\u5939", { context: "res" }),
            actions: onWrite && /* @__PURE__ */ h(RailAction, { icon: "plus", label: tx("\u65B0\u5EFA\u6587\u4EF6\u5939"), disabled: busy || deleted, onClick: () => startNew() })
          },
          folderRows(null, 0),
          editing?.mode === "new" && editing.parentId === null && nameField(0),
          /* @__PURE__ */ h(
            RailItem,
            {
              className: "is-tree",
              icon: unfiled ? "folderOpen" : "folder",
              label: railDrag?.kind === "folder" ? tx("\u56DE\u5230\u6839\u76EE\u5F55") : tx("\u672A\u5206\u7EC4"),
              count: active.filter((r) => !r.folderId).length,
              current: unfiled,
              drop: deleted ? void 0 : "folder:",
              onClick: () => unfiled ? go({ state: "active", unfiled: false }) : go({ state: "active", folderId: "", unfiled: true })
            }
          )
        ),
        /* @__PURE__ */ h(
          RailSection,
          {
            title: tx("\u6807\u7B7E", { context: "res" }),
            actions: /* @__PURE__ */ h(RailAction, { icon: "plus", label: tx("\u65B0\u5EFA\u6807\u7B7E"), disabled: busy || !onWrite, onClick: () => setTagDialog({ tag: null }) })
          },
          tax.tags.length === 0 && /* @__PURE__ */ h("p", { className: "tbx-rail-empty" }, tx("\u7ED9\u8D44\u6599\u52A0\u4E0A\u6807\u7B7E\uFF0C\u4E4B\u540E\u66F4\u5BB9\u6613\u627E\u5230\u3002")),
          /* @__PURE__ */ h("div", { className: "tbx-rail-list", ref: tagList }, tax.tags.map((t2, i) => /* @__PURE__ */ h("div", { key: t2.id, className: cx("tbx-rail-drag", railDrag?.item.id === t2.id && "is-origin"), onPointerDown: (e) => startRailDrag(e, "tag", t2) }, /* @__PURE__ */ h(
            RailItem,
            {
              mark: /* @__PURE__ */ h("i", { className: "tbx-rail-dot", style: { "--hue": colorOf(t2, i) } }),
              label: t2.name,
              count: tagged(t2.id),
              current: !deleted && scene.tagIds.includes(t2.id),
              disabled: deleted,
              drop: deleted ? void 0 : `tag:${t2.id}`,
              onClick: () => toggleTag(t2.id),
              more: onWrite && !deleted ? { label: tx("\u7F16\u8F91\u6807\u7B7E {{name}}", { name: t2.name }), onClick: () => setTagDialog({ tag: t2 }) } : null
            }
          ))), railDrag?.kind === "tag" && railDrag.line != null && /* @__PURE__ */ h("div", { className: "tbx-drop-line", style: { transform: `translateY(${railDrag.line}px)` }, "aria-hidden": "true" }))
        )
      ),
      railDrag && /* @__PURE__ */ h("div", { className: "tbx-drag-ghost", style: { transform: `translate(${railDrag.x - railDrag.dx}px, ${railDrag.y - railDrag.dy}px)` }, "aria-hidden": "true" }, railDrag.kind === "folder" ? /* @__PURE__ */ h("span", { className: "tbx-rail-icon" }, /* @__PURE__ */ h(Icon3, { name: "folder", size: 15, stroke: 2 })) : /* @__PURE__ */ h("i", { className: "tbx-rail-dot", style: { "--hue": colorOf(railDrag.item, tagIndex(railDrag.item.id)) } }), /* @__PURE__ */ h("span", null, railDrag.item.name)),
      /* @__PURE__ */ h(Popover, { anchor: folderMenu?.anchor || { current: null }, open: Boolean(folderMenu), onClose: () => setFolderMenu(null), align: "start", role: "menu", label: tx("\u6587\u4EF6\u5939\u9009\u9879") }, folderMenu && /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("button", { type: "button", role: "menuitem", onClick: () => {
        const f = folderMenu.folder;
        setFolderMenu(null);
        startNew(f.id);
      } }, /* @__PURE__ */ h(Icon3, { name: "plus", size: 16, stroke: 1.9 }), tx("\u65B0\u5EFA\u5B50\u6587\u4EF6\u5939")), /* @__PURE__ */ h("button", { type: "button", role: "menuitem", onClick: () => {
        const value = folderMenu;
        setFolderMenu(null);
        setFolderMove(value);
      } }, /* @__PURE__ */ h(Icon3, { name: "folder", size: 16, stroke: 1.9 }), tx("\u79FB\u5230\u5176\u4ED6\u6587\u4EF6\u5939")), /* @__PURE__ */ h("button", { type: "button", role: "menuitem", onClick: () => {
        const f = folderMenu.folder;
        setFolderMenu(null);
        startRename(f);
      } }, /* @__PURE__ */ h(Icon3, { name: "pencil", size: 16, stroke: 1.9 }), tx("\u91CD\u547D\u540D\u6587\u4EF6\u5939")), /* @__PURE__ */ h(ConfirmMenuItem, { icon: /* @__PURE__ */ h(Icon3, { name: "trash", size: 16, stroke: 1.9 }), label: tx("\u5220\u9664\u6587\u4EF6\u5939"), confirmLabel: tx("\u786E\u8BA4\u5220\u9664"), onConfirm: () => deleteFolder(folderMenu.folder) }))),
      /* @__PURE__ */ h(Popover, { anchor: folderMove?.anchor || { current: null }, open: Boolean(folderMove), onClose: () => setFolderMove(null), align: "start", role: "menu", label: tx("\u79FB\u5230\u5176\u4ED6\u6587\u4EF6\u5939"), className: "tbx-res-folder-move" }, folderMove && /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("div", { className: "tbx-popover-label" }, tx("\u79FB\u5230\u5176\u4ED6\u6587\u4EF6\u5939")), /* @__PURE__ */ h("button", { type: "button", role: "menuitem", disabled: !canMoveFolder(folderMove.folder, null) || !folderMove.folder.parentId, onClick: () => moveFolder(folderMove.folder, null) }, /* @__PURE__ */ h(Icon3, { name: "folder", size: 16, stroke: 1.9 }), tx("\u6839\u76EE\u5F55"), !folderMove.folder.parentId && /* @__PURE__ */ h("span", { className: "tbx-pop-check" }, /* @__PURE__ */ h(Icon3, { name: "check", size: 14, stroke: 2.4 }))), tax.folders.some((f) => !inside(folderMove.folder.id).has(f.id)) && /* @__PURE__ */ h("div", { className: "tbx-popover-sep" }), tax.folders.filter((f) => !inside(folderMove.folder.id).has(f.id)).map((f) => /* @__PURE__ */ h("button", { key: f.id, type: "button", role: "menuitem", title: folderPath(f), disabled: !canMoveFolder(folderMove.folder, f.id) || folderMove.folder.parentId === f.id, onClick: () => moveFolder(folderMove.folder, f.id) }, /* @__PURE__ */ h(Icon3, { name: "folder", size: 16, stroke: 1.9 }), /* @__PURE__ */ h("span", { className: "tbx-res-folder-path" }, folderPath(f)), folderMove.folder.parentId === f.id && /* @__PURE__ */ h("span", { className: "tbx-pop-check" }, /* @__PURE__ */ h(Icon3, { name: "check", size: 14, stroke: 2.4 })))))),
      dragged && /* @__PURE__ */ h("div", { className: "tbx-drag-ghost is-file", style: { transform: `translate(${drag.x - 22}px, ${drag.y - 18}px)` }, "aria-hidden": "true" }, /* @__PURE__ */ h("span", { className: cx("tbx-res-ghost-thumb", drag.ids.length > 1 && "is-stack") }, /* @__PURE__ */ h(Icon3, { name: "file", size: 15, stroke: 2 })), /* @__PURE__ */ h("span", null, drag.ids.length > 1 ? tx("{{n}} \u4EFD\u8D44\u6599", { n: drag.ids.length }) : dragged.title)),
      K && /* @__PURE__ */ h(K.CalendarOverlay, { present: Boolean(tagDialog) }, tagDialog && /* @__PURE__ */ h(TagDialog, { tag: tagDialog.tag, tax, busy, onWrite, onClose: () => setTagDialog(null) })),
      purging && /* @__PURE__ */ h(
        ConfirmDialog,
        {
          title: tx("\u5F7B\u5E95\u5220\u9664 {{n}} \u4EFD\u8D44\u6599\uFF1F", { n: picked.length }),
          message: tx("\u5220\u9664\u540E\u65E0\u6CD5\u6062\u590D\u3002"),
          confirmLabel: tx("\u5F7B\u5E95\u5220\u9664"),
          busy,
          onCancel: () => setPurging(false),
          onConfirm: purge
        }
      )
    );
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/math/MathHome.jsx
  var Icon4 = ({ name, size = 17, stroke = 1.9 }) => {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: stroke });
  };
  var MathMark = ({ size = 20 }) => /* @__PURE__ */ h(Icon4, { name: "math", size, stroke: 2 });
  var VIEW_KEY = "tbx.math.view";
  var readView = () => {
    try {
      return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  };
  var saveView = (v) => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
    }
  };
  function kindOf2(item) {
    const s = item.source || {};
    if (s.kind === "html") return "html";
    if (s.kind === "workshop") return s.graph ? "graph" : "formula";
    if (s.kind === "formula") return "formula";
    if (s.kind === "space") return "space";
    if (s.kind === "dynamic") return "dynamic";
    return "graph";
  }
  var KIND_LABEL = { formula: "\u516C\u5F0F", graph: "\u56FE\u5F62", space: "\u7ACB\u4F53\u56FE\u5F62", dynamic: "\u52A8\u6001\u6F14\u793A", html: "\u7F51\u9875\u6F14\u793A" };
  var FILTERS = [
    ["all", "\u5168\u90E8\u4F5C\u54C1", "grid"],
    ["made", "\u516C\u5F0F\u4E0E\u56FE\u5F62", "math"],
    ["html", "\u7F51\u9875\u6F14\u793A", "file"]
  ];
  var matches = (filter, item) => filter === "all" || (filter === "html" ? kindOf2(item) === "html" : kindOf2(item) !== "html");
  var IDEAS = [
    ["graph", "\u753B\u4E00\u6761\u53EF\u8C03\u8282\u7684\u629B\u7269\u7EBF", "is-blue"],
    ["space", "\u6F14\u793A\u6B63\u65B9\u4F53\u7684\u5C55\u5F00", "is-orange"],
    ["formula", "\u63A8\u5BFC\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B\u7684\u6C42\u6839\u516C\u5F0F", "is-green"]
  ];
  function Illustration({ kind }) {
    const { mathKit } = tb();
    const Art = mathKit?.WorkIllustration;
    return Art ? /* @__PURE__ */ h(Art, { kind: kind === "html" ? "dynamic" : kind }) : null;
  }
  function Formulas({ list }) {
    const { Markdown, remarkMath, rehypeKatex } = tb();
    if (!Markdown) return null;
    return /* @__PURE__ */ h("span", { className: "tbx-mw-formulas", "aria-hidden": "true" }, list.slice(0, 2).map((f) => /* @__PURE__ */ h(Markdown, { key: f.id, remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }]], skipHtml: true }, `$$
${f.latex}
$$`)));
  }
  function Poster({ item, client, mini }) {
    const [url, setUrl] = useState(null);
    const kind = kindOf2(item);
    const formulas = item.source?.kind === "workshop" && !item.source.graph ? item.source.formulas : item.source?.kind === "formula" && item.source.latex ? [{ id: "f", latex: item.source.latex }] : null;
    const id = formulas?.length ? null : item.render?.posterFileId;
    useEffect(() => {
      let live = true;
      let objectUrl;
      setUrl(null);
      if (id && client) {
        client.blob(`/api/workbench/files/${id}/content`).then((blob) => {
          if (!live) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }).catch(() => {
        });
      }
      return () => {
        live = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [id, client]);
    if (mini) {
      return /* @__PURE__ */ h("span", { className: cx("tbx-mw-thumb is-mini", `is-${kind}`), "aria-hidden": "true" }, kind === "html" ? /* @__PURE__ */ h(Icon4, { name: "file", size: 18, stroke: 1.9 }) : kind === "formula" ? /* @__PURE__ */ h(MathMark, { size: 18 }) : /* @__PURE__ */ h(Icon4, { name: "graph", size: 18, stroke: 1.9 }));
    }
    return /* @__PURE__ */ h("span", { className: cx("tbx-mw-thumb", `is-${kind}`) }, formulas?.length ? /* @__PURE__ */ h(Formulas, { list: formulas }) : url ? /* @__PURE__ */ h("img", { src: url, alt: "", onError: () => setUrl(null) }) : kind === "html" ? /* @__PURE__ */ h("span", { className: "tbx-mw-window", "aria-hidden": "true" }, /* @__PURE__ */ h("i", null), /* @__PURE__ */ h("i", null), /* @__PURE__ */ h("i", null), /* @__PURE__ */ h(Illustration, { kind: "dynamic" })) : /* @__PURE__ */ h("span", { className: "tbx-mw-art", "aria-hidden": "true" }, /* @__PURE__ */ h(Illustration, { kind })), /* @__PURE__ */ h("span", { className: "tbx-mw-badge" }, tx(KIND_LABEL[kind])));
  }
  function MathHome(props) {
    useLocale();
    const { items, search, deleted, busy, client, accountKey, onSearch, onDeleted, onNew, onOpen, onImport, onImportSource, onRestore, onPurge } = props;
    const { mathKit } = tb();
    const [view, setView] = useState(readView);
    const [filter, setFilter] = useState("all");
    const known = useRef({ all: 0, made: 0, html: 0 });
    const actions = useRef({ onNew, busy });
    actions.current = { onNew, busy };
    const Assistant = mathKit?.MathWebAssistant;
    mathKit?.useAuxiliaryAssistant?.(useCallback(
      () => Assistant ? /* @__PURE__ */ h(Assistant, { key: accountKey, accountKey, onStart: (request) => {
        if (!actions.current.busy) return actions.current.onNew(request);
        return void 0;
      } }) : null,
      [accountKey]
    ));
    if (!deleted && !search) {
      known.current = {
        all: items.length,
        made: items.filter((i) => matches("made", i)).length,
        html: items.filter((i) => matches("html", i)).length
      };
    }
    const shown = deleted ? items : items.filter((i) => matches(filter, i));
    const title = deleted ? tx("\u5DF2\u5F52\u6863") : tx(FILTERS.find(([k]) => k === filter)[1]);
    const starting = !deleted && !search && filter === "all";
    const go = (next) => {
      setFilter(next);
      if (deleted) onDeleted(false);
    };
    const pickView = (v) => {
      setView(v);
      saveView(v);
    };
    const date = (iso2) => iso2 ? monthDay(new Date(iso2).toLocaleDateString("sv")) : "";
    return /* @__PURE__ */ h("section", { className: "tbx-mw tbx-split" }, /* @__PURE__ */ h("div", { className: "tbx-mw-main", "aria-busy": busy }, /* @__PURE__ */ h("header", { className: "tbx-mw-bar" }, /* @__PURE__ */ h(
      PaneTitle,
      {
        icon: /* @__PURE__ */ h(MathMark, { size: 21 }),
        tone: "purple",
        id: "math-start-heading",
        title,
        sub: tx("{{n}} \u4E2A\u4F5C\u54C1", { n: shown.length, count: shown.length })
      }
    ), /* @__PURE__ */ h("div", { className: "tbx-mw-tools" }, /* @__PURE__ */ h("label", { className: "tbx-mw-search" }, /* @__PURE__ */ h(Icon4, { name: "search", size: 16, stroke: 2 }), /* @__PURE__ */ h("input", { "aria-label": tx("\u641C\u7D22\u4F5C\u54C1"), placeholder: tx("\u641C\u7D22\u4F5C\u54C1"), maxLength: 200, value: search, onChange: (e) => onSearch(e.target.value) }), search && /* @__PURE__ */ h("button", { type: "button", className: "tbx-mw-clear", "aria-label": tx("\u6E05\u9664\u641C\u7D22"), onClick: () => onSearch("") }, /* @__PURE__ */ h(Icon4, { name: "close", size: 11, stroke: 2.8 }))), /* @__PURE__ */ h(
      Segmented,
      {
        iconOnly: true,
        label: tx("\u4F5C\u54C1\u663E\u793A\u65B9\u5F0F"),
        value: view,
        onChange: pickView,
        options: [
          { value: "grid", label: tx("\u7F29\u7565\u56FE\u89C6\u56FE"), icon: /* @__PURE__ */ h(Icon4, { name: "grid", size: 15, stroke: 2 }) },
          { value: "list", label: tx("\u5217\u8868\u89C6\u56FE"), icon: /* @__PURE__ */ h(Icon4, { name: "list", size: 16, stroke: 2 }) }
        ]
      }
    ), !deleted && /* @__PURE__ */ h(PrimaryButton, { label: tx("\u65B0\u5EFA\u4F5C\u54C1"), disabled: busy, onClick: () => onNew() }))), /* @__PURE__ */ h("div", { className: cx("tbx-mw-scroll", `is-${view}`) }, starting && /* @__PURE__ */ h("section", { className: "tbx-mw-start", "aria-label": tx("\u5F00\u59CB\u5236\u4F5C") }, IDEAS.map(([kind, prompt, hue]) => /* @__PURE__ */ h("button", { key: prompt, type: "button", className: cx("tbx-mw-idea", hue), disabled: busy, onClick: () => onNew(tx(prompt)) }, /* @__PURE__ */ h("span", { className: "tbx-mw-idea-art" }, /* @__PURE__ */ h(Illustration, { kind })), /* @__PURE__ */ h("span", { className: "tbx-mw-idea-copy" }, /* @__PURE__ */ h("strong", null, tx(prompt)), /* @__PURE__ */ h("small", null, /* @__PURE__ */ h(Icon4, { name: "sparkles", size: 12, stroke: 2 }), tx("\u4EA4\u7ED9\u52A9\u7406\u8D77\u4E2A\u5934")))))), starting && shown.length > 0 && /* @__PURE__ */ h("h3", { className: "tbx-mw-section" }, tx("\u6700\u8FD1\u7F16\u8F91")), shown.length > 0 && view === "list" && /* @__PURE__ */ h("div", { className: "tbx-mw-thead", "aria-hidden": "true" }, /* @__PURE__ */ h("span", null, tx("\u540D\u79F0")), /* @__PURE__ */ h("span", null, tx("\u7C7B\u578B")), /* @__PURE__ */ h("span", null, deleted ? "" : tx("\u4FEE\u6539\u65E5\u671F"))), shown.length > 0 && /* @__PURE__ */ h("div", { className: "tbx-mw-items", key: view }, shown.map((item, i) => /* @__PURE__ */ h("article", { key: item.id, className: cx("tbx-mw-card", deleted && "is-archived"), style: { "--i": Math.min(i, 12) } }, /* @__PURE__ */ h("button", { type: "button", className: "tbx-mw-open", disabled: busy, onClick: () => onOpen(item) }, /* @__PURE__ */ h(Poster, { item, client, mini: view === "list" }), /* @__PURE__ */ h("span", { className: "tbx-mw-copy" }, /* @__PURE__ */ h("strong", { title: item.title }, item.title), /* @__PURE__ */ h("small", null, view === "list" ? tx(KIND_LABEL[kindOf2(item)]) : item.updatedAt ? tx(deleted ? "{{date}} \u5F52\u6863" : "{{date}} \u7F16\u8F91", { date: date(item.updatedAt) }) : tx("\u6570\u5B66\u4F5C\u54C1"))), view === "list" && /* @__PURE__ */ h("span", { className: "tbx-mw-col" }, tx(KIND_LABEL[kindOf2(item)])), view === "list" && !deleted && /* @__PURE__ */ h("span", { className: "tbx-mw-col tbx-num" }, date(item.updatedAt))), deleted && /* @__PURE__ */ h("div", { className: "tbx-mw-archive" }, /* @__PURE__ */ h("button", { type: "button", disabled: busy, onClick: () => onRestore(item) }, /* @__PURE__ */ h(Icon4, { name: "restore", size: 14, stroke: 2 }), tx("\u6062\u590D")), /* @__PURE__ */ h("button", { type: "button", className: "is-danger", disabled: busy, onClick: () => onPurge(item) }, tx("\u5F7B\u5E95\u5220\u9664")))))), !shown.length && /* @__PURE__ */ h("div", { className: cx("tbx-mw-empty", starting && "is-quiet") }, /* @__PURE__ */ h("span", { className: "tbx-mw-empty-icon" }, search ? /* @__PURE__ */ h(Icon4, { name: "search", size: 24, stroke: 1.8 }) : deleted ? /* @__PURE__ */ h(Icon4, { name: "trash", size: 24, stroke: 1.8 }) : /* @__PURE__ */ h(MathMark, { size: 26 })), /* @__PURE__ */ h("h3", null, tx(search ? "\u6CA1\u6709\u627E\u5230\u4F5C\u54C1" : deleted ? "\u6CA1\u6709\u5F52\u6863\u4F5C\u54C1" : starting ? "\u8FD8\u6CA1\u6709\u4F5C\u54C1" : "\u8FD9\u91CC\u8FD8\u662F\u7A7A\u7684")), /* @__PURE__ */ h("p", null, tx(search ? "\u8BD5\u8BD5\u5176\u4ED6\u540D\u79F0\u3002" : deleted ? "\u5F52\u6863\u7684\u4F5C\u54C1\u4F1A\u653E\u5728\u8FD9\u91CC\uFF0C\u968F\u65F6\u53EF\u4EE5\u6062\u590D\u3002" : starting ? "\u4ECE\u4E0A\u9762\u6311\u4E00\u79CD\u65B9\u5F0F\u5F00\u59CB\uFF0C\u505A\u597D\u7684\u4F5C\u54C1\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" : "\u6362\u4E2A\u5206\u7C7B\u770B\u770B\uFF0C\u6216\u8005\u65B0\u5EFA\u4E00\u4E2A\u4F5C\u54C1\u3002")), search && /* @__PURE__ */ h("button", { type: "button", className: "tbx-mw-chipbtn", onClick: () => onSearch("") }, tx("\u6E05\u9664\u641C\u7D22"))))), /* @__PURE__ */ h(Rail, { label: tx("\u6570\u5B66\u5DE5\u574A\u5BFC\u822A"), footer: /* @__PURE__ */ h(RailItem, { icon: "trash", label: tx("\u5DF2\u5F52\u6863"), current: deleted, onClick: () => onDeleted(!deleted) }) }, /* @__PURE__ */ h(RailSection, { title: tx("\u6570\u5B66\u5DE5\u574A"), count: known.current.all || "" }, FILTERS.map(([key2, label, icon]) => /* @__PURE__ */ h(RailItem, { key: key2, icon, label: tx(label), count: known.current[key2], current: !deleted && filter === key2, onClick: () => go(key2) }))), /* @__PURE__ */ h(RailSection, { title: tx("\u5BFC\u5165") }, /* @__PURE__ */ h(RailItem, { icon: "upload", label: tx("\u5BFC\u5165\u4F5C\u54C1"), count: ".json", disabled: busy, onClick: onImportSource }), /* @__PURE__ */ h(RailItem, { icon: "link", label: tx("\u5BFC\u5165\u7F51\u9875"), count: ".html", disabled: busy, onClick: onImport })), /* @__PURE__ */ h(RailHint, { tone: "purple" }, tx("\u8BF4\u8BF4\u60F3\u505A\u4EC0\u4E48\uFF0C\u52A9\u7406\u4F1A\u5E2E\u4F60\u642D\u597D\u4F5C\u54C1\u3002"))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/questions/QuestionFinder.jsx
  var Icon5 = ({ name, size = 17, stroke = 1.9 }) => {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: stroke });
  };
  var QIcon = ({ name, size = 16 }) => {
    const Q = tb().questionKit?.QuestionIcon;
    return Q ? /* @__PURE__ */ h(Q, { name, size }) : null;
  };
  var TYPE_HUES = ["orange", "blue", "purple", "green", "pink", "teal"];
  var hueOf = (types, id) => {
    const i = types.findIndex((x) => x.id === id);
    return i < 0 ? "grey" : TYPE_HUES[i % TYPE_HUES.length];
  };
  function QuestionFinder(props) {
    useLocale();
    const {
      archived,
      items,
      imports,
      taxonomy,
      scene,
      patchScene,
      hasFilters,
      listState,
      reload,
      open,
      startCapture,
      resumeNewDraft,
      hasNewDraft,
      showTaxonomy,
      returnToLibrary,
      listNode,
      listRestored,
      taxonomyTools,
      busy
    } = props;
    const { questionKit } = tb();
    const DocumentView = questionKit?.DocumentView;
    const ImportList = questionKit?.ImportList;
    const sourceText = questionKit?.sourceText ?? (() => "");
    const figure = (q) => questionKit?.documentAssets?.(q.body)?.figures?.[0];
    const known = useRef({ all: 0, starred: 0, types: {} });
    if (!archived && !scene.q && !scene.typeId && !scene.starred && !scene.tagIds?.length) {
      const types = {};
      for (const q of items) if (q.typeId) types[q.typeId] = (types[q.typeId] || 0) + 1;
      known.current = { all: items.length, starred: items.filter((q) => q.starred).length, types };
    }
    const place = archived ? "archive" : scene.starred ? "starred" : scene.typeId ? `type:${scene.typeId}` : "all";
    const go = (patch) => {
      if (archived) returnToLibrary("active", true);
      patchScene({ starred: false, typeId: "", ...patch });
    };
    const toggleTag = (id) => patchScene({ tagIds: scene.tagIds?.includes(id) ? scene.tagIds.filter((x) => x !== id) : [...scene.tagIds ?? [], id] });
    const typeName = (id) => taxonomy.types.find((x) => x.id === id)?.name;
    const tagName = (id) => taxonomy.tags.find((x) => x.id === id)?.name;
    const title = archived ? tx("\u5DF2\u5F52\u6863") : scene.starred ? tx("\u5DF2\u6807\u8BB0") : scene.typeId ? typeName(scene.typeId) || tx("\u5168\u90E8\u9898\u76EE") : tx("\u5168\u90E8\u9898\u76EE");
    const count = archived ? items.length + imports.length : items.length;
    const [managing, setManaging] = useState(false);
    const manage = () => {
      showTaxonomy();
      setManaging(true);
    };
    const version = useRef(taxonomy.version);
    useEffect(() => {
      if (version.current !== taxonomy.version) setManaging(false);
      version.current = taxonomy.version;
    }, [taxonomy.version]);
    const touch = () => {
      listRestored.current = true;
    };
    return /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(
      Rail,
      {
        label: tx("\u9898\u5E93\u5BFC\u822A"),
        className: "tbx-qn-rail",
        footer: !managing && /* @__PURE__ */ h(RailItem, { icon: "trash", label: tx("\u5DF2\u5F52\u6863"), current: archived, onClick: () => returnToLibrary(archived ? "active" : "deleted", true) })
      },
      managing ? /* @__PURE__ */ h(RailSection, { title: tx("\u7BA1\u7406\u9898\u578B\u4E0E\u6807\u7B7E"), actions: /* @__PURE__ */ h(RailAction, { icon: "close", label: tx("\u53D6\u6D88"), onClick: () => setManaging(false) }) }, /* @__PURE__ */ h("div", { className: "tbx-qn-manage-body" }, taxonomyTools)) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(RailSection, { title: tx("\u9898\u5E93"), count: known.current.all || "" }, /* @__PURE__ */ h(RailItem, { icon: "grid", label: tx("\u5168\u90E8\u9898\u76EE"), count: known.current.all, current: place === "all", onClick: () => go({}) }), /* @__PURE__ */ h(RailItem, { mark: /* @__PURE__ */ h("span", { className: "tbx-rail-icon is-star" }, /* @__PURE__ */ h(QIcon, { name: "star", size: 14 })), label: tx("\u5DF2\u6807\u8BB0"), count: known.current.starred, current: place === "starred", onClick: () => go({ starred: true }) })), /* @__PURE__ */ h(RailSection, { title: tx("\u9898\u578B"), actions: /* @__PURE__ */ h(RailAction, { icon: "pencil", label: tx("\u7BA1\u7406\u9898\u578B\u4E0E\u6807\u7B7E"), onClick: manage }) }, taxonomy.types.length === 0 && /* @__PURE__ */ h("p", { className: "tbx-rail-empty" }, tx("\u8FD8\u6CA1\u6709\u9898\u578B")), taxonomy.types.map((t2) => /* @__PURE__ */ h(
        RailItem,
        {
          key: t2.id,
          mark: /* @__PURE__ */ h("span", { className: cx("tbx-rail-dot", `is-${hueOf(taxonomy.types, t2.id)}`), "aria-hidden": "true" }),
          label: t2.name,
          count: known.current.types[t2.id],
          current: place === `type:${t2.id}`,
          onClick: () => go({ typeId: t2.id })
        }
      ))), taxonomy.tags.length > 0 && /* @__PURE__ */ h(RailSection, { title: tx("\u6807\u7B7E", { context: "res" }) }, /* @__PURE__ */ h(RailTags, { tags: taxonomy.tags, selected: scene.tagIds ?? [], onToggle: toggleTag })))
    ), /* @__PURE__ */ h("div", { className: "tbx-qn-list" }, /* @__PURE__ */ h("header", { className: "tbx-qn-bar" }, /* @__PURE__ */ h("div", { className: "tbx-qn-bar-top" }, /* @__PURE__ */ h(PaneTitle, { icon: /* @__PURE__ */ h(Icon5, { name: "book", size: 20, stroke: 2 }), tone: "orange", title, sub: tx("{{n}} \u9053\u9898", { n: count, count }) }), !archived && /* @__PURE__ */ h("span", { className: "tbx-qn-bar-actions" }, /* @__PURE__ */ h(RailAction, { icon: "upload", label: tx("\u4ECE\u8D44\u6599\u6536\u5F55"), disabled: busy, onClick: startCapture }), /* @__PURE__ */ h(RailAction, { primary: true, icon: "plus", label: tx("\u65B0\u5EFA\u9898\u76EE"), disabled: busy, onClick: () => open("new", null) }))), /* @__PURE__ */ h("label", { className: "tbx-qn-search" }, /* @__PURE__ */ h(Icon5, { name: "search", size: 16, stroke: 2 }), /* @__PURE__ */ h(
      "input",
      {
        "aria-label": tx("\u641C\u7D22\u9898\u76EE"),
        placeholder: scene.searchAnswers ? tx("\u641C\u7D22\u9898\u76EE\u3001\u7B54\u6848\u6216\u7B14\u8BB0") : tx("\u641C\u7D22\u9898\u5E72\u3001\u516C\u5F0F\u6216\u7B14\u8BB0"),
        value: scene.q ?? "",
        onChange: (e) => patchScene({ q: e.target.value })
      }
    ), scene.q && /* @__PURE__ */ h("button", { type: "button", className: "tbx-qn-clear", "aria-label": tx("\u6E05\u9664\u641C\u7D22"), onClick: () => patchScene({ q: "" }) }, /* @__PURE__ */ h(Icon5, { name: "close", size: 11, stroke: 2.8 }))), (scene.q || scene.searchAnswers) && /* @__PURE__ */ h("button", { type: "button", className: cx("tbx-qn-chip", scene.searchAnswers && "is-on"), "aria-pressed": Boolean(scene.searchAnswers), onClick: () => patchScene({ searchAnswers: !scene.searchAnswers }) }, scene.searchAnswers && /* @__PURE__ */ h(Icon5, { name: "check", size: 13, stroke: 2.6 }), tx("\u4E5F\u641C\u7D22\u7B54\u6848\u4E0E\u89E3\u6790")), scene.tagIds?.length > 0 && /* @__PURE__ */ h("div", { className: "tbx-qn-filters" }, scene.tagIds.map((id) => /* @__PURE__ */ h("button", { key: id, type: "button", className: "tbx-qn-filter", onClick: () => toggleTag(id) }, /* @__PURE__ */ h(Icon5, { name: "tag", size: 11, stroke: 2.2 }), tagName(id), /* @__PURE__ */ h(Icon5, { name: "close", size: 10, stroke: 2.8 }))))), !archived && hasNewDraft && scene.kind !== "new" && /* @__PURE__ */ h("button", { type: "button", className: "tbx-qn-draft", onClick: resumeNewDraft }, /* @__PURE__ */ h("span", { className: "tbx-qn-draft-icon" }, /* @__PURE__ */ h(QIcon, { name: "edit", size: 15 })), /* @__PURE__ */ h("span", null, tx("\u7EE7\u7EED\u672A\u5B8C\u6210\u7684\u9898\u76EE")), /* @__PURE__ */ h(Icon5, { name: "chevron", size: 14, stroke: 2.2 })), /* @__PURE__ */ h(
      "div",
      {
        className: "q-list tbx-qn-scroll",
        ref: listNode,
        onWheel: touch,
        onPointerDown: touch,
        onKeyDown: touch,
        onScroll: (e) => {
          if (listRestored.current) patchScene({ listScroll: e.currentTarget.scrollTop });
        }
      },
      ImportList && /* @__PURE__ */ h(ImportList, { imports, archived, selectedId: scene.id, onOpen: (id) => open("import", id) }),
      listState === "loading" ? /* @__PURE__ */ h("p", { className: "tbx-qn-empty", role: "status" }, /* @__PURE__ */ h("span", { className: "tbx-spinner is-small" }), tx("\u6B63\u5728\u8BFB\u53D6\u9898\u5E93\u2026")) : listState === "error" ? /* @__PURE__ */ h("div", { className: "tbx-qn-empty" }, /* @__PURE__ */ h("p", null, tx("\u9898\u5E93\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6")), /* @__PURE__ */ h("button", { type: "button", className: "tbx-qn-chip", onClick: reload }, tx("\u91CD\u65B0\u52A0\u8F7D"))) : items.length === 0 && /* @__PURE__ */ h("div", { className: "tbx-qn-empty" }, /* @__PURE__ */ h("span", { className: "tbx-qn-empty-icon" }, hasFilters ? /* @__PURE__ */ h(Icon5, { name: "search", size: 20, stroke: 1.9 }) : archived ? /* @__PURE__ */ h(Icon5, { name: "trash", size: 20, stroke: 1.9 }) : /* @__PURE__ */ h(Icon5, { name: "book", size: 22, stroke: 1.9 })), /* @__PURE__ */ h("p", null, hasFilters ? tx("\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u9898\u76EE\uFF0C\u8BD5\u8BD5\u8C03\u6574\u7B5B\u9009\u3002") : archived ? tx("\u6CA1\u6709\u5F52\u6863\u7684\u9898\u76EE\u3002") : imports.length ? tx("\u6750\u6599\u786E\u8BA4\u5165\u5E93\u540E\uFF0C\u9898\u76EE\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002") : tx("\u6536\u5F55\u7B2C\u4E00\u9053\u9898\uFF0C\u5F00\u59CB\u79EF\u7D2F\u3002")), hasFilters && /* @__PURE__ */ h("button", { type: "button", className: "tbx-qn-chip", onClick: () => patchScene({ q: "", typeId: "", tagIds: [], starred: false, searchAnswers: false }) }, tx("\u6E05\u9664\u6761\u4EF6"))),
      items.map((q, i) => {
        const fig = figure(q);
        const tags = (q.tagIds || []).map(tagName).filter(Boolean);
        return /* @__PURE__ */ h(
          "button",
          {
            key: q.id,
            type: "button",
            className: cx("tbx-qn-row", scene.id === q.id && "selected"),
            style: { "--i": Math.min(i, 12) },
            "aria-current": scene.id === q.id ? "true" : void 0,
            onClick: () => open("question", q.id)
          },
          /* @__PURE__ */ h("span", { className: "tbx-qn-row-text" }, /* @__PURE__ */ h("strong", null, /* @__PURE__ */ h("span", null, q.title || sourceText(q.body).slice(0, 36) || tx("\u672A\u547D\u540D\u9898\u76EE")), q.starred && /* @__PURE__ */ h("span", { className: "tbx-qn-star", "aria-label": tx("\u5DF2\u6807\u8BB0") }, /* @__PURE__ */ h(QIcon, { name: "star", size: 13 }))), /* @__PURE__ */ h("span", { className: "tbx-qn-excerpt" }, DocumentView && /* @__PURE__ */ h(DocumentView, { value: { version: q.body.version, blocks: q.body.blocks.filter((b) => b.type !== "image").slice(0, 1) } })), (q.typeId || tags.length > 0) && /* @__PURE__ */ h("span", { className: "tbx-qn-meta" }, q.typeId && typeName(q.typeId) && /* @__PURE__ */ h("span", { className: cx("tbx-qn-type", `is-${hueOf(taxonomy.types, q.typeId)}`) }, typeName(q.typeId)), tags.slice(0, 2).map((name) => /* @__PURE__ */ h("span", { key: name, className: "tbx-qn-tag" }, name)), tags.length > 2 && /* @__PURE__ */ h("span", { className: "tbx-qn-tag" }, "+", tags.length - 2))),
          fig && DocumentView && /* @__PURE__ */ h("span", { className: "tbx-qn-figure" }, /* @__PURE__ */ h(DocumentView, { value: { version: 2, blocks: [fig] } }))
        );
      })
    )));
  }
  function QuestionWelcome({ onCapture, onCreate, hasItems }) {
    useLocale();
    return /* @__PURE__ */ h("div", { className: "q-welcome tbx-qn-welcome" }, /* @__PURE__ */ h("div", { className: "tbx-qn-welcome-art", "aria-hidden": "true" }, /* @__PURE__ */ h("span", { className: "is-back" }), /* @__PURE__ */ h("span", { className: "is-mid" }), /* @__PURE__ */ h("span", { className: "is-front" }, /* @__PURE__ */ h("i", null), /* @__PURE__ */ h("i", null), /* @__PURE__ */ h("i", { className: "is-formula" }, "x\xB2 \u2212 4x + 3 = 0"), /* @__PURE__ */ h("i", null), /* @__PURE__ */ h("i", { className: "is-short" }))), /* @__PURE__ */ h("h2", null, hasItems ? tx("\u9009\u4E00\u9053\u9898\uFF0C\u5F00\u59CB\u51C6\u5907\u4E0B\u4E00\u8282\u8BFE") : tx("\u628A\u597D\u9898\u7559\u4E0B\u6765\uFF0C\u968F\u65F6\u7528\u8D77\u6765")), /* @__PURE__ */ h("p", null, hasItems ? tx("\u4ECE\u5217\u8868\u91CC\u9009\u4E00\u9053\u9898\uFF0C\u67E5\u770B\u7B54\u6848\u3001\u6539\u7F16\uFF0C\u6216\u5BFC\u51FA\u6210\u56FE\u7247\u653E\u8FDB\u8BFE\u4EF6\u3002") : tx("\u6536\u5F55\u8BD5\u5377\u3001\u622A\u56FE\u6216\u6587\u5B57\u91CC\u7684\u9898\u76EE\uFF0C\u4E4B\u540E\u968F\u65F6\u67E5\u627E\u3001\u6539\u7F16\u548C\u5BFC\u51FA\u3002")), !hasItems && /* @__PURE__ */ h("div", { className: "tbx-qn-welcome-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "tbx-qn-btn is-primary", onClick: onCreate }, /* @__PURE__ */ h(Icon5, { name: "plus", size: 15, stroke: 2.2 }), tx("\u65B0\u5EFA\u9898\u76EE")), /* @__PURE__ */ h("button", { type: "button", className: "tbx-qn-btn", onClick: onCapture }, /* @__PURE__ */ h(Icon5, { name: "upload", size: 15, stroke: 2 }), tx("\u4ECE\u8D44\u6599\u6536\u5F55"))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/api.js
  var BASE = "/api/modules/classroom";
  var key = () => crypto.randomUUID();
  var ApiError = class extends Error {
    constructor(status, problem) {
      super(problem?.detail || (status === 409 ? tx("\u5185\u5BB9\u5DF2\u5728\u522B\u5904\u66F4\u65B0\uFF0C\u8BF7\u5237\u65B0\u540E\u518D\u8BD5\u3002") : tx("\u64CD\u4F5C\u6CA1\u6709\u5B8C\u6210\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002")));
      this.status = status;
      this.problem = problem || {};
    }
  };
  async function call2(method, path2, body) {
    const init = { method, headers: {} };
    if (method !== "GET") init.headers["Idempotency-Key"] = key();
    if (body !== void 0) {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] = "application/json";
    }
    const res = await fetch(BASE + path2, init);
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, json);
    return json;
  }
  var qs = (params = {}) => {
    const search = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      if (value == null || value === "") continue;
      for (const v of Array.isArray(value) ? value : [value]) search.append(name, v);
    }
    const s = search.toString();
    return s ? `?${s}` : "";
  };
  var api2 = {
    get: (path2, params) => call2("GET", path2 + qs(params)),
    post: (path2, body) => call2("POST", path2, body ?? {}),
    put: (path2, body) => call2("PUT", path2, body),
    remove: (collection, item, deleted = true) => call2("PUT", `/${collection}/${item.id}/deletion`, { baseVersion: item.version, deleted }),
    async upload(file) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/workbench/files", { method: "POST", body: fd, headers: { "Idempotency-Key": key() } });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, json);
      return json;
    },
    fileUrl: (id) => `/api/workbench/files/${id}/content`
  };

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/util.js
  function initials(name = "") {
    const n = name.trim();
    if (!n) return "?";
    if (/[一-鿿]/.test(n)) return n.length > 2 ? n.slice(-2) : n;
    return n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }
  var HUES = ["blue", "green", "orange", "purple", "pink", "teal", "indigo", "yellow"];
  function hueOf2(seed = "") {
    let h2 = 0;
    for (const c of String(seed)) h2 = h2 * 31 + c.charCodeAt(0) >>> 0;
    return HUES[h2 % HUES.length];
  }
  var pad2 = (n) => String(n).padStart(2, "0");
  var today = () => {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  function longDate(date) {
    if (!date) return "";
    const year = date.slice(0, 4);
    const thisYear = String((/* @__PURE__ */ new Date()).getFullYear());
    if (isEnglish()) {
      const d = /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...year !== thisYear ? { year: "numeric" } : {}, timeZone: "UTC" });
    }
    return (year !== thisYear ? `${year}\u5E74` : "") + monthDay(date);
  }
  function monthLabel(date) {
    if (isEnglish()) return (/* @__PURE__ */ new Date(`${date.slice(0, 7)}-15T12:00:00Z`)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    return `${date.slice(0, 4)}\u5E74${Number(date.slice(5, 7))}\u6708`;
  }
  function age(birthday) {
    if (!birthday) return null;
    const b = /* @__PURE__ */ new Date(`${birthday}T00:00:00`);
    const now = /* @__PURE__ */ new Date();
    let a = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || now.getMonth() === b.getMonth() && now.getDate() < b.getDate()) a--;
    return a;
  }
  var fmt = (n) => n == null ? "\u2014" : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  var pct = (rate, digits = 0) => rate == null ? "\u2014" : `${(rate * 100).toFixed(digits)}%`;
  var sum = (list) => list.reduce((a, v) => a + v, 0);
  var CRC = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      table[n] = c >>> 0;
    }
    return (bytes) => {
      let c = 4294967295;
      for (const b of bytes) c = table[(c ^ b) & 255] ^ c >>> 8;
      return (c ^ 4294967295) >>> 0;
    };
  })();
  function zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const [name, content2] of files) {
      const nameBytes = enc.encode(name);
      const data = enc.encode(content2);
      const crc = CRC(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 67324752, true);
      local.setUint16(4, 20, true);
      local.setUint16(8, 0, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, nameBytes.length, true);
      parts.push(new Uint8Array(local.buffer), nameBytes, data);
      const entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 33639248, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, data.length, true);
      entry.setUint32(24, data.length, true);
      entry.setUint16(28, nameBytes.length, true);
      entry.setUint32(42, offset, true);
      central.push(new Uint8Array(entry.buffer), nameBytes);
      offset += 30 + nameBytes.length + data.length;
    }
    const size = central.reduce((a, p) => a + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 101010256, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  var esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  var colName = (i) => {
    let s = "";
    i += 1;
    while (i) {
      const m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  };
  function xlsx(rows, sheetName = "Sheet1") {
    const body = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => {
      if (v == null || v === "") return "";
      const ref = `${colName(c)}${r + 1}`;
      return typeof v === "number" ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    return zip([
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
      ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`]
    ]);
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2e3);
  }
  var classMark = (name = "") => name.match(/[（(]\s*(\d+)\s*[)）]/)?.[1] || name.match(/\d+/)?.[0] || name.trim().slice(0, 1);

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/ui.jsx
  var Icon6 = ({ name, size = 17, stroke = 1.9 }) => {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: stroke });
  };
  function Avatar({ name, id, size = "md", className }) {
    return /* @__PURE__ */ h("span", { className: cx("cr-avatar", `is-${size}`, `is-${hueOf2(id || name)}`, className), "aria-hidden": "true" }, size === "sm" ? /[一-鿿]/.test(name || "") ? initials(name).slice(-1) : initials(name).slice(0, 1) : initials(name));
  }
  function Seg({ value, options, onChange, label, className }) {
    return /* @__PURE__ */ h("div", { className: cx("cr-seg", className), role: "tablist", "aria-label": label }, options.map(([key2, text, icon]) => /* @__PURE__ */ h("button", { key: key2, type: "button", role: "tab", "aria-selected": value === key2, className: cx(value === key2 && "is-on"), onClick: () => onChange(key2) }, icon && /* @__PURE__ */ h(Icon6, { name: icon, size: 15, stroke: 2 }), /* @__PURE__ */ h("span", null, text))));
  }
  function useOutside2(open, ref, close) {
    useEffect(() => {
      if (!open) return void 0;
      const down = (e) => {
        if (!ref.current?.contains(e.target)) close();
      };
      const key2 = (e) => {
        if (e.key === "Escape") close();
      };
      document.addEventListener("pointerdown", down, true);
      document.addEventListener("keydown", key2, true);
      return () => {
        document.removeEventListener("pointerdown", down, true);
        document.removeEventListener("keydown", key2, true);
      };
    }, [open]);
  }
  function Menu({ label, icon = "more", items, align = "end", className, trigger }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useOutside2(open, ref, () => setOpen(false));
    return /* @__PURE__ */ h("span", { className: cx("cr-menuwrap", className), ref }, trigger ? trigger({ open, toggle: () => setOpen(!open) }) : /* @__PURE__ */ h("button", { type: "button", className: cx("cr-icon-btn", open && "is-on"), "aria-label": label, title: label, "aria-haspopup": "menu", "aria-expanded": open, onClick: () => setOpen(!open) }, /* @__PURE__ */ h(Icon6, { name: icon, size: 17 })), open && /* @__PURE__ */ h("div", { className: cx("cr-menu", `is-${align}`), role: "menu", "aria-label": label }, items.filter(Boolean).map((item, i) => item === "-" ? /* @__PURE__ */ h("div", { key: i, className: "cr-menu-sep" }) : /* @__PURE__ */ h("button", { key: i, type: "button", role: "menuitem", className: cx(item.danger && "is-danger"), disabled: item.disabled, onClick: () => {
      if (!item.keep) setOpen(false);
      item.onClick();
    } }, item.icon && /* @__PURE__ */ h(Icon6, { name: item.icon, size: 15, stroke: 2 }), /* @__PURE__ */ h("span", null, item.label), item.check && /* @__PURE__ */ h(Icon6, { name: "check", size: 14, stroke: 2.4 })))));
  }
  function Dialog({ title, subtitle, onClose, children, footer, wide, className }) {
    const ref = useRef(null);
    useEffect(() => {
      const key2 = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      };
      document.addEventListener("keydown", key2);
      const first = ref.current?.querySelector("input:not([type=hidden]), textarea, select");
      first?.focus({ preventScroll: true });
      return () => document.removeEventListener("keydown", key2);
    }, []);
    return /* @__PURE__ */ h("div", { className: "cr-scrim", onPointerDown: (e) => {
      if (e.target === e.currentTarget) onClose();
    } }, /* @__PURE__ */ h("section", { ref, className: cx("cr-dialog", wide && "is-wide", className), role: "dialog", "aria-modal": "true", "aria-label": title }, /* @__PURE__ */ h("header", { className: "cr-dialog-head" }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h2", null, title), subtitle && /* @__PURE__ */ h("p", null, subtitle)), /* @__PURE__ */ h("button", { type: "button", className: "cr-icon-btn is-filled", "aria-label": tx("\u5173\u95ED"), onClick: onClose }, /* @__PURE__ */ h(Icon6, { name: "close", size: 13, stroke: 2.4 }))), /* @__PURE__ */ h("div", { className: "cr-dialog-body" }, children), footer && /* @__PURE__ */ h("footer", { className: "cr-dialog-foot" }, footer)));
  }
  function Confirm({ title, message, confirmLabel, danger, icon, onConfirm, onClose }) {
    return /* @__PURE__ */ h(
      ConfirmDialog,
      {
        title,
        message,
        confirmLabel,
        danger: Boolean(danger),
        icon: icon || "trash",
        onConfirm: async () => {
          await onConfirm();
          onClose();
        },
        onCancel: onClose
      }
    );
  }
  function Field({ label, hint, children, className }) {
    return /* @__PURE__ */ h("label", { className: cx("cr-field", className) }, /* @__PURE__ */ h("span", { className: "cr-field-label" }, label, hint && /* @__PURE__ */ h("em", null, hint)), children);
  }
  function Empty({ art, icon, title, text, children, compact }) {
    return /* @__PURE__ */ h("div", { className: cx("cr-empty", compact && "is-compact") }, art || icon && /* @__PURE__ */ h("span", { className: "cr-empty-icon" }, /* @__PURE__ */ h(Icon6, { name: icon, size: 22, stroke: 1.9 })), /* @__PURE__ */ h("h3", null, title), text && /* @__PURE__ */ h("p", null, text), children && /* @__PURE__ */ h("div", { className: "cr-empty-actions" }, children));
  }
  function Search2({ value, onChange, placeholder, label }) {
    return /* @__PURE__ */ h("label", { className: "cr-search" }, /* @__PURE__ */ h(Icon6, { name: "search", size: 16, stroke: 2 }), /* @__PURE__ */ h("input", { "aria-label": label || placeholder, placeholder, value, onChange: (e) => onChange(e.target.value) }), value && /* @__PURE__ */ h("button", { type: "button", className: "cr-search-clear", "aria-label": tx("\u6E05\u9664\u641C\u7D22"), onClick: () => onChange("") }, /* @__PURE__ */ h(Icon6, { name: "close", size: 11, stroke: 2.8 })));
  }
  var Spinner = ({ small }) => /* @__PURE__ */ h("span", { className: cx("tbx-spinner", small && "is-small"), "aria-hidden": "true" });
  function useToast() {
    const [toast, setToast] = useState(null);
    const timer = useRef(0);
    const show2 = (text, kind = "ok") => {
      clearTimeout(timer.current);
      setToast({ text, kind, key: Date.now() });
      timer.current = setTimeout(() => setToast(null), kind === "error" ? 5200 : 2600);
    };
    const node = toast && /* @__PURE__ */ h("div", { key: toast.key, className: cx("cr-toast", `is-${toast.kind}`), role: "status" }, /* @__PURE__ */ h(Icon6, { name: toast.kind === "error" ? "info" : "check", size: 15, stroke: 2.2 }), /* @__PURE__ */ h("span", null, toast.text));
    return [node, show2];
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/Seating.jsx
  var SPRING = "cubic-bezier(0.34, 1.32, 0.64, 1)";
  function Seating({ ctx, cls, students }) {
    const [seating, setSeating] = useState(cls.seating);
    const [version, setVersion] = useState(cls.version);
    const [drag, setDrag] = useState(null);
    const [target, setTarget] = useState(null);
    const root = useRef(null);
    const rects = useRef(/* @__PURE__ */ new Map());
    const press = useRef(null);
    useEffect(() => {
      setSeating(cls.seating);
      setVersion(cls.version);
    }, [cls.id, cls.version]);
    const byId = new Map(students.map((s) => [s.id, s]));
    const seats = seating.seats.filter((s) => byId.has(s.studentId));
    const at = new Map(seats.map((s) => [`${s.row}:${s.col}`, s.studentId]));
    const seated = new Set(seats.map((s) => s.studentId));
    const unseated = students.filter((s) => !seated.has(s.id));
    const snapshot = () => {
      rects.current = new Map([...root.current?.querySelectorAll("[data-student]") ?? []].map((el) => [el.dataset.student, el.getBoundingClientRect()]));
    };
    useLayoutEffect(() => {
      const before = rects.current;
      if (!before.size) return;
      rects.current = /* @__PURE__ */ new Map();
      for (const el of root.current?.querySelectorAll("[data-student]") ?? []) {
        const was = before.get(el.dataset.student);
        if (!was) continue;
        const now = el.getBoundingClientRect();
        const dx = was.left - now.left, dy = was.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 520, easing: SPRING });
      }
    }, [seating]);
    async function save(next, message) {
      snapshot();
      const previous = seating;
      setSeating(next);
      try {
        const saved = await api2.put(`/classes/${cls.id}/seating`, { baseVersion: version, rows: next.rows, cols: next.cols, seats: next.seats });
        setVersion(saved.version);
        ctx.reload();
        if (message) ctx.toast(message);
      } catch (err) {
        snapshot();
        setSeating(previous);
        ctx.toast(err.message, "error");
        if (err.status === 409) ctx.reload();
      }
    }
    function place(studentId, cell) {
      const from = seats.find((s) => s.studentId === studentId);
      let next = seats.filter((s) => s.studentId !== studentId);
      if (cell === "tray") return save({ ...seating, seats: next });
      const occupant = at.get(`${cell.row}:${cell.col}`);
      if (occupant === studentId) return void 0;
      next = next.filter((s) => s.studentId !== occupant);
      next.push({ studentId, row: cell.row, col: cell.col });
      if (occupant && from) next.push({ studentId: occupant, row: from.row, col: from.col });
      return save({ ...seating, seats: next });
    }
    function resize(rows, cols) {
      rows = Math.max(1, Math.min(15, rows));
      cols = Math.max(1, Math.min(15, cols));
      const keep = seats.filter((s) => s.row < rows && s.col < cols);
      const dropped = seats.length - keep.length;
      save({ rows, cols, seats: keep }, dropped ? tx("{{n}} \u4F4D\u5B66\u751F\u56DE\u5230\u4E86\u201C\u8FD8\u6CA1\u6709\u5EA7\u4F4D\u201D", { n: dropped }) : null);
    }
    function autofill() {
      const free = [];
      for (let r = 0; r < seating.rows; r++) for (let c = 0; c < seating.cols; c++) if (!at.has(`${r}:${c}`)) free.push({ row: r, col: c });
      const queue = [...unseated].sort((a, b) => (a.studentNo || "~").localeCompare(b.studentNo || "~"));
      const added = queue.slice(0, free.length).map((s, i) => ({ studentId: s.id, ...free[i] }));
      if (!added.length) return;
      save({ ...seating, seats: [...seats, ...added] }, tx("\u5DF2\u4E3A {{n}} \u4F4D\u5B66\u751F\u5B89\u6392\u5EA7\u4F4D", { n: added.length }));
    }
    function onPointerDown(e, studentId) {
      if (e.button !== 0) return;
      const box = root.current.getBoundingClientRect();
      const card = e.currentTarget.getBoundingClientRect();
      press.current = { studentId, x: e.clientX, y: e.clientY, ox: e.clientX - card.left, oy: e.clientY - card.top, w: card.width, h: card.height, box, moved: false, pointer: e.pointerId };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    function onPointerMove(e) {
      const p = press.current;
      if (!p) return;
      if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
      p.moved = true;
      const box = root.current.getBoundingClientRect();
      setDrag({ studentId: p.studentId, x: e.clientX - box.left - p.ox, y: e.clientY - box.top - p.oy + root.current.scrollTop, w: p.w, h: p.h });
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const seat = el?.closest?.("[data-seat]");
      const tray = el?.closest?.("[data-tray]");
      setTarget(seat ? seat.dataset.seat : tray ? "tray" : null);
    }
    function onPointerUp(e) {
      const p = press.current;
      press.current = null;
      if (!p) return;
      if (!p.moved) {
        ctx.go({ studentId: p.studentId });
        return;
      }
      const t2 = target;
      setDrag(null);
      setTarget(null);
      if (!t2) return;
      if (t2 === "tray") place(p.studentId, "tray");
      else {
        const [row, col] = t2.split(":").map(Number);
        place(p.studentId, { row, col });
      }
    }
    const handlers = (id) => ({
      "data-student": id,
      onPointerDown: (e) => onPointerDown(e, id),
      onPointerMove,
      onPointerUp,
      onPointerCancel: () => {
        press.current = null;
        setDrag(null);
        setTarget(null);
      },
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ctx.go({ studentId: id });
        }
      }
    });
    if (!students.length) {
      return /* @__PURE__ */ h(Empty, { icon: "students", title: tx("\u5148\u628A\u5B66\u751F\u52A0\u8FDB\u6765"), text: tx("\u6709\u4E86\u540D\u5355\uFF0C\u5C31\u53EF\u4EE5\u6309\u6559\u5BA4\u7684\u6837\u5B50\u6392\u5EA7\u4F4D\u3002") }, /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", onClick: () => ctx.open("student", { classId: cls.id }) }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 15, stroke: 2.2 }), tx("\u6DFB\u52A0\u5B66\u751F")));
    }
    const cells = [];
    for (let r = 0; r < seating.rows; r++) {
      for (let c = 0; c < seating.cols; c++) {
        const key2 = `${r}:${c}`;
        const id = at.get(key2);
        const s = id && byId.get(id);
        cells.push(
          /* @__PURE__ */ h("div", { key: key2, className: cx("cr-seat", !s && "is-empty", target === key2 && "is-target", drag?.studentId === id && "is-lifted"), "data-seat": key2, style: { "--i": r * seating.cols + c } }, s && /* @__PURE__ */ h("button", { type: "button", className: "cr-desk", ...handlers(s.id), "aria-label": tx("{{name}}\uFF0C\u7B2C {{row}} \u6392\u7B2C {{col}} \u5EA7", { name: s.name, row: r + 1, col: c + 1 }) }, /* @__PURE__ */ h(Avatar, { name: s.name, id: s.id }), /* @__PURE__ */ h("span", { className: "cr-desk-name" }, s.name), s.studentNo && /* @__PURE__ */ h("small", null, s.studentNo)))
        );
      }
    }
    const lifted = drag && byId.get(drag.studentId);
    return /* @__PURE__ */ h("div", { className: cx("cr-seating", drag && "is-dragging"), ref: root }, /* @__PURE__ */ h("div", { className: "cr-seating-bar" }, /* @__PURE__ */ h("p", { className: "cr-muted" }, /* @__PURE__ */ h(Icon6, { name: "grip", size: 14, stroke: 2 }), tx("\u62D6\u52A8\u5B66\u751F\u6362\u5EA7\u4F4D\uFF0C\u70B9\u4E00\u4E0B\u67E5\u770B\u5B66\u751F")), /* @__PURE__ */ h("div", { className: "cr-seating-tools" }, unseated.length > 0 && /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-small", onClick: autofill }, /* @__PURE__ */ h(Icon6, { name: "sparkles", size: 14, stroke: 2 }), tx("\u6309\u5B66\u53F7\u8865\u9F50\u7A7A\u4F4D")), /* @__PURE__ */ h(
      Menu,
      {
        label: tx("\u6559\u5BA4\u5927\u5C0F"),
        trigger: ({ open, toggle }) => /* @__PURE__ */ h("button", { type: "button", className: cx("cr-btn is-small", open && "is-on"), "aria-expanded": open, onClick: toggle }, /* @__PURE__ */ h(Icon6, { name: "grid", size: 14, stroke: 2 }), tx("{{r}} \u6392 \xD7 {{c}} \u5217", { r: seating.rows, c: seating.cols })),
        items: [
          { label: tx("\u589E\u52A0\u4E00\u6392"), icon: "plus", disabled: seating.rows >= 15, onClick: () => resize(seating.rows + 1, seating.cols) },
          { label: tx("\u51CF\u5C11\u4E00\u6392"), icon: "minus", disabled: seating.rows <= 1, onClick: () => resize(seating.rows - 1, seating.cols) },
          "-",
          { label: tx("\u589E\u52A0\u4E00\u5217"), icon: "plus", disabled: seating.cols >= 15, onClick: () => resize(seating.rows, seating.cols + 1) },
          { label: tx("\u51CF\u5C11\u4E00\u5217"), icon: "minus", disabled: seating.cols <= 1, onClick: () => resize(seating.rows, seating.cols - 1) }
        ]
      }
    ))), /* @__PURE__ */ h("div", { className: "cr-room" }, /* @__PURE__ */ h("div", { className: "cr-board" }, /* @__PURE__ */ h("span", null, tx("\u8BB2\u53F0"))), /* @__PURE__ */ h("div", { className: "cr-grid", style: { "--cols": seating.cols } }, cells)), /* @__PURE__ */ h("div", { className: cx("cr-tray", target === "tray" && "is-target", !unseated.length && "is-empty"), "data-tray": "" }, /* @__PURE__ */ h("div", { className: "cr-tray-head" }, /* @__PURE__ */ h("strong", null, tx("\u8FD8\u6CA1\u6709\u5EA7\u4F4D")), /* @__PURE__ */ h("span", null, unseated.length ? tx("{{n}} \u4EBA", { n: unseated.length }) : tx("\u6BCF\u4E2A\u4EBA\u90FD\u6709\u5EA7\u4F4D\u4E86"))), /* @__PURE__ */ h("div", { className: "cr-tray-list" }, unseated.map((s) => /* @__PURE__ */ h("button", { key: s.id, type: "button", className: cx("cr-chip-student", drag?.studentId === s.id && "is-lifted"), ...handlers(s.id) }, /* @__PURE__ */ h(Avatar, { name: s.name, id: s.id, size: "sm" }), /* @__PURE__ */ h("span", null, s.name))), !unseated.length && /* @__PURE__ */ h("p", { className: "cr-muted" }, tx("\u628A\u5B66\u751F\u62D6\u5230\u8FD9\u91CC\uFF0C\u5C31\u662F\u6682\u65F6\u4E0D\u6392\u5EA7\u3002")))), lifted && /* @__PURE__ */ h("div", { className: "cr-ghost", style: { transform: `translate(${drag.x}px, ${drag.y}px)`, width: drag.w, height: drag.h }, "aria-hidden": "true" }, /* @__PURE__ */ h("div", { className: "cr-desk is-ghost" }, /* @__PURE__ */ h(Avatar, { name: lifted.name, id: lifted.id }), /* @__PURE__ */ h("span", { className: "cr-desk-name" }, lifted.name))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/charts.jsx
  function useWidth() {
    const ref = useRef(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
      const el = ref.current;
      if (!el) return void 0;
      const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
      ro.observe(el);
      return () => ro.disconnect();
    }, []);
    return [ref, width];
  }
  var path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  function smooth(pts) {
    if (pts.length < 3) return path(pts);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }
  function TrendChart({ points, series, selected, onSelect, height = 220, bandLabel, label }) {
    const [ref, width] = useWidth();
    const [hover, setHover] = useState(null);
    const pad3 = { l: 40, r: 18, t: 16, b: 34 };
    const w = Math.max(width, 280);
    const innerW = w - pad3.l - pad3.r;
    const innerH = height - pad3.t - pad3.b;
    const n = points.length;
    const x = (i) => pad3.l + (n === 1 ? innerW / 2 : innerW * i / (n - 1));
    const y = (rate) => pad3.t + innerH * (1 - rate);
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    const active = hover ?? points.findIndex((p) => p.key === selected);
    const move = (e) => {
      const box = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - box.left;
      let best = 0;
      points.forEach((_, i) => {
        if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
      });
      setHover(best);
    };
    const band = points.map((p, i) => p.band && [x(i), y(p.band[1]), y(p.band[0])]).filter(Boolean);
    const tip = hover != null ? points[hover] : null;
    return /* @__PURE__ */ h("figure", { className: "cr-chart", "aria-label": label }, series.length > 1 && /* @__PURE__ */ h("figcaption", { className: "cr-legend" }, series.map((s) => /* @__PURE__ */ h("span", { key: s.key, className: cx("cr-legend-item", `is-${s.tone}`, s.dashed && "is-dashed") }, /* @__PURE__ */ h("i", null), s.label)), bandLabel && /* @__PURE__ */ h("span", { className: "cr-legend-item is-band" }, /* @__PURE__ */ h("i", null), bandLabel)), /* @__PURE__ */ h("div", { className: "cr-chart-plot", ref, style: { height } }, width > 0 && /* @__PURE__ */ h("svg", { width: w, height, role: "img", onPointerMove: move, onPointerLeave: () => setHover(null), onClick: () => hover != null && onSelect?.(points[hover].key) }, ticks.map((t2) => /* @__PURE__ */ h("g", { key: t2, className: "cr-grid" }, /* @__PURE__ */ h("line", { x1: pad3.l, x2: w - pad3.r, y1: y(t2), y2: y(t2) }), /* @__PURE__ */ h("text", { x: pad3.l - 8, y: y(t2) + 4, textAnchor: "end" }, Math.round(t2 * 100), "%"))), points.map((p, i) => /* @__PURE__ */ h("text", { key: p.key, className: cx("cr-axis-label", i === active && "is-on"), x: x(i), y: height - 10, textAnchor: n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle" }, p.title)), band.length > 1 && /* @__PURE__ */ h("path", { className: "cr-band", d: `${path(band.map((b) => [b[0], b[1]]))} L${band.slice().reverse().map((b) => `${b[0].toFixed(1)},${b[2].toFixed(1)}`).join(" L")} Z` }), active >= 0 && /* @__PURE__ */ h("line", { className: "cr-crosshair", x1: x(active), x2: x(active), y1: pad3.t, y2: pad3.t + innerH }), series.map((s) => {
      const pts = points.map((p, i) => p.values[s.key] == null ? null : [x(i), y(p.values[s.key])]).filter(Boolean);
      return /* @__PURE__ */ h("g", { key: s.key, className: cx("cr-series", `is-${s.tone}`, s.dashed && "is-dashed") }, pts.length > 1 && /* @__PURE__ */ h("path", { className: "cr-line", d: smooth(pts), pathLength: s.dashed ? void 0 : 1 }), points.map((p, i) => p.values[s.key] != null && /* @__PURE__ */ h("circle", { key: p.key, className: cx("cr-dot", i === active && "is-on"), cx: x(i), cy: y(p.values[s.key]), r: i === active ? 5.5 : 4, style: { "--i": i } })));
    })), tip && /* @__PURE__ */ h("div", { className: "cr-tip", style: { left: Math.min(Math.max(x(hover), 90), w - 90), top: 4 } }, /* @__PURE__ */ h("strong", null, tip.name || tip.title), /* @__PURE__ */ h("small", null, longDate(tip.date)), series.map((s) => /* @__PURE__ */ h("span", { key: s.key, className: cx("cr-tip-row", `is-${s.tone}`) }, /* @__PURE__ */ h("i", null), s.label, /* @__PURE__ */ h("b", null, pct(tip.values[s.key])))), tip.band && bandLabel && /* @__PURE__ */ h("span", { className: "cr-tip-row is-band" }, /* @__PURE__ */ h("i", null), bandLabel, /* @__PURE__ */ h("b", null, pct(tip.band[0]), " \u2013 ", pct(tip.band[1]))), tip.note && /* @__PURE__ */ h("em", null, tip.note))));
  }
  function Histogram({ bins, selected, onSelect, label }) {
    const max = Math.max(1, ...bins.map((b) => b.count));
    return /* @__PURE__ */ h("div", { className: "cr-hist", role: "list", "aria-label": label }, bins.map((b) => /* @__PURE__ */ h(
      "button",
      {
        key: b.bin,
        type: "button",
        role: "listitem",
        className: cx("cr-hist-bar", selected === b.bin && "is-on", !b.count && "is-zero"),
        style: { "--h": b.count / max, "--i": b.bin },
        disabled: !b.count,
        onClick: () => onSelect?.(selected === b.bin ? null : b.bin),
        "aria-label": tx("{{from}}\u2013{{to}} \u533A\u95F4 {{n}} \u4EBA", { from: b.bin * 10 + "%", to: (b.bin === 9 ? 100 : b.bin * 10 + 10) + "%", n: b.count })
      },
      /* @__PURE__ */ h("span", { className: "cr-hist-count" }, b.count || ""),
      /* @__PURE__ */ h("span", { className: "cr-hist-fill" }),
      /* @__PURE__ */ h("span", { className: "cr-hist-label" }, b.bin * 10)
    )));
  }
  function RateBars({ rows, onSelect, selected, compareKey }) {
    return /* @__PURE__ */ h("ul", { className: "cr-rates" }, rows.map((r, i) => /* @__PURE__ */ h("li", { key: r.id, style: { "--i": i } }, /* @__PURE__ */ h("button", { type: "button", className: cx("cr-rate", selected === r.id && "is-on"), disabled: !onSelect, onClick: () => onSelect?.(r.id) }, /* @__PURE__ */ h("span", { className: "cr-rate-label", title: r.label }, r.label), /* @__PURE__ */ h("span", { className: "cr-rate-track" }, r.rate != null && /* @__PURE__ */ h("span", { className: cx("cr-rate-fill", r.rate < 0.6 && "is-low"), style: { "--w": r.rate } }), compareKey && r[compareKey] != null && /* @__PURE__ */ h("span", { className: "cr-rate-mark", style: { "--w": r[compareKey] } })), /* @__PURE__ */ h("span", { className: "cr-rate-value" }, r.rate == null ? tx(r.state === "not-assessed" ? "\u672A\u8003\u5230" : "\u7F3A\u5206") : pct(r.rate)), r.meta && /* @__PURE__ */ h("small", { className: "cr-rate-meta" }, r.meta)))));
  }
  function Stat({ label, value, sub, tone }) {
    return /* @__PURE__ */ h("div", { className: cx("cr-stat", tone && `is-${tone}`) }, /* @__PURE__ */ h("span", null, label), /* @__PURE__ */ h("strong", null, value), sub && /* @__PURE__ */ h("small", null, sub));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/Records.jsx
  var RANGES = [["all", "\u5168\u90E8\u65F6\u95F4"], ["7", "\u6700\u8FD1 7 \u5929"], ["30", "\u6700\u8FD1 30 \u5929"], ["90", "\u6700\u8FD1 3 \u4E2A\u6708"]];
  var daysAgo = (n) => {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  function Composer2({ placeholder, onSave, initial, onCancel, autoFocus }) {
    const [body, setBody] = useState(initial?.body ?? "");
    const [date, setDate] = useState(initial?.date ?? today());
    const [busy, setBusy] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
    }, [body]);
    useEffect(() => {
      if (autoFocus) ref.current?.focus();
    }, []);
    const save = async () => {
      if (!body.trim() || busy) return;
      setBusy(true);
      try {
        await onSave({ body, date });
        if (!initial) {
          setBody("");
          setDate(today());
        }
      } finally {
        setBusy(false);
      }
    };
    return /* @__PURE__ */ h("div", { className: cx("cr-composer", initial && "is-editing") }, /* @__PURE__ */ h(
      "textarea",
      {
        ref,
        rows: 2,
        value: body,
        placeholder,
        maxLength: 2e4,
        "aria-label": placeholder,
        onChange: (e) => setBody(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape" && onCancel) onCancel();
        }
      }
    ), /* @__PURE__ */ h("div", { className: "cr-composer-bar" }, /* @__PURE__ */ h("label", { className: "cr-date-pill" }, /* @__PURE__ */ h(Icon6, { name: "calendar", size: 14, stroke: 2 }), /* @__PURE__ */ h("input", { type: "date", value: date, max: today(), onChange: (e) => setDate(e.target.value || today()), "aria-label": tx("\u65E5\u671F") })), /* @__PURE__ */ h("span", { className: "cr-grow" }), onCancel && /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-small", onClick: onCancel }, tx("\u53D6\u6D88")), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary is-small", disabled: !body.trim() || busy, onClick: save }, initial ? tx("\u4FDD\u5B58") : tx("\u8BB0\u4E0B"))));
  }
  function Journal({ ctx, subject, placeholder }) {
    const [items, setItems] = useState(null);
    const [q, setQ] = useState("");
    const [range, setRange] = useState("all");
    const [editing, setEditing] = useState(null);
    const [fresh, setFresh] = useState(null);
    const key2 = subject.kind === "student" ? "studentId" : "classId";
    const load = async () => {
      try {
        const res = await api2.get("/records", { [key2]: subject.id, q: q.trim(), from: range === "all" ? "" : daysAgo(Number(range)) });
        setItems(res.items);
      } catch (err) {
        setItems([]);
        ctx.toast(err.message, "error");
      }
    };
    useEffect(() => {
      const t2 = setTimeout(load, q ? 220 : 0);
      return () => clearTimeout(t2);
    }, [subject.id, q, range]);
    const create = async ({ body, date }) => {
      try {
        const saved = await api2.post("/records", { subject, date, body });
        setFresh(saved.id);
        await load();
      } catch (err) {
        ctx.toast(err.message, "error");
        throw err;
      }
    };
    const update = async (item, { body, date }) => {
      try {
        await api2.put(`/records/${item.id}`, { baseVersion: item.version, body, date });
        setEditing(null);
        await load();
        ctx.toast(tx("\u5DF2\u4FDD\u5B58"));
      } catch (err) {
        ctx.toast(err.message, "error");
      }
    };
    const archive = async (item) => {
      try {
        await api2.remove("records", item);
        await load();
        ctx.toast(tx("\u8BB0\u5F55\u5DF2\u5F52\u6863"));
      } catch (err) {
        ctx.toast(err.message, "error");
      }
    };
    const groups = [];
    for (const item of items || []) {
      const month = item.date.slice(0, 7);
      if (!groups.length || groups.at(-1).month !== month) groups.push({ month, items: [] });
      groups.at(-1).items.push(item);
    }
    const filtered = Boolean(q.trim() || range !== "all");
    return /* @__PURE__ */ h("div", { className: "cr-journal" }, /* @__PURE__ */ h(Composer2, { placeholder, onSave: create }), /* @__PURE__ */ h("div", { className: "cr-toolbar is-quiet" }, /* @__PURE__ */ h(Search2, { value: q, onChange: setQ, placeholder: tx("\u641C\u7D22\u8BB0\u5F55\u91CC\u7684\u6587\u5B57") }), /* @__PURE__ */ h(
      Menu,
      {
        label: tx("\u65F6\u95F4\u8303\u56F4"),
        trigger: ({ open, toggle }) => /* @__PURE__ */ h("button", { type: "button", className: cx("cr-btn is-small", (open || range !== "all") && "is-on"), onClick: toggle, "aria-expanded": open }, /* @__PURE__ */ h(Icon6, { name: "calendar", size: 14, stroke: 2 }), tx(RANGES.find(([k]) => k === range)[1])),
        items: RANGES.map(([k, label]) => ({ label: tx(label), check: range === k, onClick: () => setRange(k) }))
      }
    ), /* @__PURE__ */ h("span", { className: "cr-grow" }), items && /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("{{n}} \u6761", { n: items.length }))), !items ? /* @__PURE__ */ h("div", { className: "cr-loading is-inline" }, /* @__PURE__ */ h(Spinner, null)) : !items.length ? filtered ? /* @__PURE__ */ h(Empty, { compact: true, icon: "search", title: tx("\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8BB0\u5F55"), text: tx("\u6362\u4E2A\u5173\u952E\u8BCD\u6216\u65F6\u95F4\u8303\u56F4\u770B\u770B\u3002") }) : /* @__PURE__ */ h(Empty, { compact: true, icon: "pencil", title: tx("\u8FD8\u6CA1\u6709\u8BB0\u5F55"), text: subject.kind === "student" ? tx("\u4E00\u53E5\u8BDD\u3001\u4E00\u6B21\u8C08\u8BDD\u3001\u4E00\u4E2A\u7EA6\u5B9A\uFF0C\u90FD\u503C\u5F97\u8BB0\u4E0B\u6765\u3002") : tx("\u6559\u5230\u54EA\u91CC\u3001\u5171\u540C\u7684\u95EE\u9898\u3001\u4E0B\u4E00\u8282\u8BFE\u7684\u60F3\u6CD5\uFF0C\u5199\u6210\u4E00\u6761\u5C31\u597D\u3002") }) : /* @__PURE__ */ h("ol", { className: "cr-timeline" }, groups.map((g) => /* @__PURE__ */ h("li", { key: g.month, className: "cr-month" }, /* @__PURE__ */ h("h4", null, monthLabel(g.month)), /* @__PURE__ */ h("ol", null, g.items.map((item) => /* @__PURE__ */ h("li", { key: item.id, className: cx("cr-entry", fresh === item.id && "is-fresh") }, /* @__PURE__ */ h("div", { className: "cr-entry-date" }, /* @__PURE__ */ h("strong", null, Number(item.date.slice(8, 10))), /* @__PURE__ */ h("small", null, weekdayName(item.date))), editing === item.id ? /* @__PURE__ */ h(Composer2, { initial: item, autoFocus: true, onSave: (v) => update(item, v), onCancel: () => setEditing(null) }) : /* @__PURE__ */ h("article", { className: "cr-entry-card" }, /* @__PURE__ */ h("p", null, item.body), /* @__PURE__ */ h("div", { className: "cr-entry-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "cr-icon-btn is-small", "aria-label": tx("\u7F16\u8F91"), title: tx("\u7F16\u8F91"), onClick: () => setEditing(item.id) }, /* @__PURE__ */ h(Icon6, { name: "pencil", size: 14, stroke: 2 })), /* @__PURE__ */ h("button", { type: "button", className: "cr-icon-btn is-small", "aria-label": tx("\u5F52\u6863"), title: tx("\u5F52\u6863"), onClick: () => archive(item) }, /* @__PURE__ */ h(Icon6, { name: "trash", size: 14, stroke: 2 })))))))))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/Students.jsx
  function StudentForm({ ctx, classId, initial, onClose }) {
    const [form, setForm] = useState({
      name: initial?.name ?? "",
      studentNo: initial?.studentNo ?? "",
      birthday: initial?.birthday ?? "",
      interests: initial?.interests ?? "",
      personality: initial?.personality ?? "",
      classId: initial?.classId ?? classId
    });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [more, setMore] = useState(Boolean(initial));
    const set = (key2) => (e) => setForm({ ...form, [key2]: e.target.value });
    const save = async (again) => {
      setBusy(true);
      setError("");
      try {
        const body = { name: form.name, studentNo: form.studentNo, birthday: form.birthday || null, interests: form.interests, personality: form.personality };
        if (initial) await api2.put(`/students/${initial.id}`, { baseVersion: initial.version, ...body, classId: form.classId });
        else await api2.post("/students", { ...body, classId });
        await ctx.reload();
        ctx.toast(initial ? tx("\u5DF2\u4FDD\u5B58") : tx("\u5DF2\u6DFB\u52A0 {{name}}", { name: form.name.trim() }));
        if (again) setForm({ ...form, name: "", studentNo: "", birthday: "", interests: "", personality: "" });
        else onClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    };
    const moving = initial && form.classId !== initial.classId;
    return /* @__PURE__ */ h(
      Dialog,
      {
        title: initial ? tx("\u5B66\u751F\u8D44\u6599") : tx("\u6DFB\u52A0\u5B66\u751F"),
        subtitle: initial ? null : tx("\u53EA\u6709\u59D3\u540D\u662F\u5FC5\u586B\u7684\u3002\u6027\u683C\u3001\u5174\u8DA3\u60F3\u5230\u518D\u5199\uFF0C\u4E0D\u5FC5\u4E00\u6B21\u586B\u5B8C\u3002"),
        onClose,
        footer: /* @__PURE__ */ h(Fragment, null, !initial && /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-quiet", disabled: busy || !form.name.trim(), onClick: () => save(true) }, tx("\u4FDD\u5B58\u5E76\u7EE7\u7EED\u6DFB\u52A0")), /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: onClose }, tx("\u53D6\u6D88")), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", disabled: busy || !form.name.trim(), onClick: () => save(false) }, initial ? tx("\u4FDD\u5B58") : tx("\u6DFB\u52A0")))
      },
      /* @__PURE__ */ h("form", { className: "cr-form", onSubmit: (e) => {
        e.preventDefault();
        save(!initial);
      } }, /* @__PURE__ */ h("div", { className: "cr-form-row" }, /* @__PURE__ */ h(Field, { label: tx("\u59D3\u540D") }, /* @__PURE__ */ h("input", { value: form.name, maxLength: 40, onChange: set("name") })), /* @__PURE__ */ h(Field, { label: tx("\u5B66\u53F7"), hint: tx("\u9009\u586B") }, /* @__PURE__ */ h("input", { value: form.studentNo, maxLength: 32, inputMode: "numeric", onChange: set("studentNo") }))), !more && /* @__PURE__ */ h("button", { type: "button", className: "cr-link", onClick: () => setMore(true) }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 13, stroke: 2.4 }), tx("\u751F\u65E5\u3001\u5174\u8DA3\u4E0E\u6027\u683C")), more && /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(Field, { label: tx("\u751F\u65E5"), hint: tx("\u9009\u586B") }, /* @__PURE__ */ h("input", { type: "date", value: form.birthday || "", onChange: set("birthday") })), /* @__PURE__ */ h(Field, { label: tx("\u5174\u8DA3"), hint: tx("\u9009\u586B") }, /* @__PURE__ */ h("input", { value: form.interests, maxLength: 400, placeholder: tx("\u4F8B\u5982\uFF1A\u7BEE\u7403\u3001\u79D1\u5E7B\u5C0F\u8BF4\u3001\u753B\u753B"), onChange: set("interests") })), /* @__PURE__ */ h(Field, { label: tx("\u6027\u683C"), hint: tx("\u9009\u586B\uFF0C\u7528\u4F60\u81EA\u5DF1\u7684\u8BDD\u5199") }, /* @__PURE__ */ h("textarea", { rows: 3, value: form.personality, maxLength: 1e3, placeholder: tx("\u4F8B\u5982\uFF1A\u5B89\u9759\uFF0C\u4F46\u8BB2\u5230\u611F\u5174\u8DA3\u7684\u9898\u4F1A\u62A2\u7740\u56DE\u7B54"), onChange: set("personality") }))), initial && /* @__PURE__ */ h(Field, { label: tx("\u6240\u5728\u73ED\u7EA7") }, /* @__PURE__ */ h("select", { value: form.classId, onChange: set("classId") }, ctx.data.classes.map((c) => /* @__PURE__ */ h("option", { key: c.id, value: c.id }, c.name)))), moving && /* @__PURE__ */ h("p", { className: "cr-note" }, /* @__PURE__ */ h(Icon6, { name: "info", size: 14, stroke: 2 }), tx("\u6362\u73ED\u540E\uFF0C\u8BB0\u5F55\u8DDF\u7740\u5B66\u751F\u8D70\uFF1B\u4EE5\u524D\u7684\u6210\u7EE9\u4ECD\u5C5E\u4E8E\u5F53\u65F6\u7684\u73ED\u7EA7\uFF0C\u5EA7\u4F4D\u4F1A\u7A7A\u51FA\u6765\u3002")), error && /* @__PURE__ */ h("p", { className: "cr-error" }, error))
    );
  }
  function Roster({ ctx, cls, students }) {
    const [q, setQ] = useState("");
    const [latest, setLatest] = useState(null);
    useEffect(() => {
      let live = true;
      api2.get(`/classes/${cls.id}/statistics`).then((s) => {
        const last = [...s.points].reverse().find((p) => p.state === "ok");
        if (live) setLatest(last ? { exam: last.exam, byStudent: new Map(last.students.map((x) => [x.studentId, x])) } : false);
      }).catch(() => live && setLatest(false));
      return () => {
        live = false;
      };
    }, [cls.id, cls.version]);
    const seat = new Map(cls.seating.seats.map((s) => [s.studentId, s]));
    const shown = students.filter((s) => !q || s.name.includes(q.trim()) || (s.studentNo || "").includes(q.trim()));
    return /* @__PURE__ */ h("div", { className: "cr-roster" }, /* @__PURE__ */ h("div", { className: "cr-toolbar" }, /* @__PURE__ */ h(Search2, { value: q, onChange: setQ, placeholder: tx("\u641C\u7D22\u59D3\u540D\u6216\u5B66\u53F7") }), latest && /* @__PURE__ */ h("span", { className: "cr-muted cr-toolbar-note" }, tx("\u5206\u6570\u6765\u81EA\u6700\u8FD1\u4E00\u573A\uFF1A{{name}}", { name: latest.exam.name })), /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", onClick: () => ctx.open("student", { classId: cls.id }) }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 15, stroke: 2.2 }), tx("\u6DFB\u52A0\u5B66\u751F"))), !students.length ? /* @__PURE__ */ h(Empty, { icon: "students", title: tx("\u73ED\u91CC\u8FD8\u6CA1\u6709\u5B66\u751F"), text: tx("\u5148\u628A\u540D\u5355\u52A0\u8FDB\u6765\u3002\u4E4B\u540E\u7684\u5EA7\u4F4D\u3001\u8BB0\u5F55\u548C\u6210\u7EE9\u90FD\u56F4\u7ED5\u4ED6\u4EEC\u3002") }, /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", onClick: () => ctx.open("student", { classId: cls.id }) }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 15, stroke: 2.2 }), tx("\u6DFB\u52A0\u5B66\u751F"))) : !shown.length ? /* @__PURE__ */ h(Empty, { compact: true, icon: "search", title: tx("\u6CA1\u6709\u627E\u5230\u8FD9\u4F4D\u5B66\u751F"), text: tx("\u6362\u4E2A\u540D\u5B57\u6216\u5B66\u53F7\u8BD5\u8BD5\u3002") }) : /* @__PURE__ */ h("div", { className: "cr-cards" }, shown.map((s, i) => {
      const r = latest && latest.byStudent.get(s.id);
      const where = seat.get(s.id);
      return /* @__PURE__ */ h("button", { key: s.id, type: "button", className: "cr-card", style: { "--i": Math.min(i, 16) }, onClick: () => ctx.go({ studentId: s.id }) }, /* @__PURE__ */ h(Avatar, { name: s.name, id: s.id, size: "lg" }), /* @__PURE__ */ h("span", { className: "cr-card-text" }, /* @__PURE__ */ h("strong", null, s.name), /* @__PURE__ */ h("small", null, [s.studentNo, where ? tx("\u7B2C {{r}} \u6392\u7B2C {{c}} \u5EA7", { r: where.row + 1, c: where.col + 1 }) : tx("\u672A\u6392\u5EA7")].filter(Boolean).join(" \xB7 ")), s.interests && /* @__PURE__ */ h("span", { className: "cr-card-note" }, s.interests)), r && /* @__PURE__ */ h("span", { className: cx("cr-score-pill", r.status !== "present" && "is-muted") }, r.status === "present" && r.rate != null ? pct(r.rate) : r.status === "absent" ? tx("\u7F3A\u8003") : tx("\u672A\u8BB0\u5F55"), r.rank && /* @__PURE__ */ h("small", null, tx("\u7B2C {{n}}", { n: r.rank }))));
    })));
  }
  function StudentDetail({ ctx, student, cls }) {
    const [tab, setTab] = useState("records");
    const years = age(student.birthday);
    const archive = () => ctx.open("confirm", {
      title: tx("\u5F52\u6863 {{name}}\uFF1F", { name: student.name }),
      message: tx("\u5B66\u751F\u4F1A\u79FB\u5230\u201C\u5DF2\u5F52\u6863\u201D\uFF0C\u5EA7\u4F4D\u7A7A\u51FA\u6765\uFF1B\u8BB0\u5F55\u548C\u5386\u53F2\u6210\u7EE9\u90FD\u4FDD\u7559\u3002\u6062\u590D\u540E\u4E0D\u4F1A\u81EA\u52A8\u5750\u56DE\u539F\u6765\u7684\u5EA7\u4F4D\u3002"),
      confirmLabel: tx("\u5F52\u6863"),
      onConfirm: async () => {
        await api2.remove("students", student);
        ctx.go({ studentId: null });
        await ctx.reload();
        ctx.toast(tx("\u5DF2\u5F52\u6863"));
      }
    });
    return /* @__PURE__ */ h("div", { className: "cr-student" }, /* @__PURE__ */ h("header", { className: "cr-student-head" }, /* @__PURE__ */ h("button", { type: "button", className: "cr-back", onClick: () => ctx.go({ studentId: null }) }, /* @__PURE__ */ h(Icon6, { name: "arrowLeft", size: 16, stroke: 2.2 }), /* @__PURE__ */ h("span", null, cls.name)), /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: () => ctx.open("student", { initial: student }) }, /* @__PURE__ */ h(Icon6, { name: "pencil", size: 14, stroke: 2 }), tx("\u7F16\u8F91\u8D44\u6599")), /* @__PURE__ */ h(Menu, { label: tx("\u5B66\u751F\u64CD\u4F5C"), items: [{ label: tx("\u5F52\u6863\u5B66\u751F"), icon: "trash", danger: true, onClick: archive }] })), /* @__PURE__ */ h("div", { className: "cr-student-scroll" }, /* @__PURE__ */ h("section", { className: "cr-profile" }, /* @__PURE__ */ h(Avatar, { name: student.name, id: student.id, size: "xl" }), /* @__PURE__ */ h("div", { className: "cr-profile-text" }, /* @__PURE__ */ h("h2", null, student.name), /* @__PURE__ */ h("p", null, [student.studentNo && tx("\u5B66\u53F7 {{n}}", { n: student.studentNo }), student.birthday && (years != null ? tx("{{date}} \xB7 {{n}} \u5C81", { date: longDate(student.birthday), n: years }) : longDate(student.birthday))].filter(Boolean).join(" \xB7 ") || tx("\u8FD8\u6CA1\u6709\u586B\u5B66\u53F7\u548C\u751F\u65E5")))), /* @__PURE__ */ h("div", { className: "cr-traits" }, /* @__PURE__ */ h("button", { type: "button", className: cx("cr-trait", !student.interests && "is-empty"), onClick: () => ctx.open("student", { initial: student }) }, /* @__PURE__ */ h("span", { className: "cr-trait-label" }, /* @__PURE__ */ h(Icon6, { name: "sparkles", size: 14, stroke: 2 }), tx("\u5174\u8DA3")), /* @__PURE__ */ h("p", null, student.interests || tx("\u8FD8\u6CA1\u5199\u3002\u60F3\u5230\u4E86\u5C31\u8BB0\u4E00\u7B14\u3002"))), /* @__PURE__ */ h("button", { type: "button", className: cx("cr-trait", !student.personality && "is-empty"), onClick: () => ctx.open("student", { initial: student }) }, /* @__PURE__ */ h("span", { className: "cr-trait-label" }, /* @__PURE__ */ h(Icon6, { name: "info", size: 14, stroke: 2 }), tx("\u6027\u683C")), /* @__PURE__ */ h("p", null, student.personality || tx("\u7528\u4F60\u81EA\u5DF1\u7684\u8BDD\u63CF\u8FF0\uFF0C\u4E0D\u5FC5\u9762\u9762\u4FF1\u5230\u3002")))), /* @__PURE__ */ h(Seg, { className: "cr-subtabs", label: tx("\u5B66\u751F\u89C6\u56FE"), value: tab, onChange: setTab, options: [["records", tx("\u8BB0\u5F55"), "pencil"], ["scores", tx("\u6210\u7EE9"), "graph"]] }), /* @__PURE__ */ h("div", { className: "cr-view", key: tab }, tab === "records" && /* @__PURE__ */ h(Journal, { ctx, subject: { kind: "student", id: student.id }, placeholder: tx("\u8BB0\u4E0B\u5173\u4E8E{{name}}\u7684\u4E00\u4EF6\u4E8B\uFF1A\u8BF4\u8FC7\u7684\u8BDD\u3001\u4E00\u6B21\u4EA4\u6D41\u3001\u4E00\u4E2A\u7EA6\u5B9A\u2026\u2026", { name: student.name }) }), tab === "scores" && /* @__PURE__ */ h(StudentScores, { ctx, student }))));
  }
  function StudentScores({ ctx, student }) {
    const [stats, setStats] = useState(null);
    const [open, setOpen] = useState(null);
    useEffect(() => {
      let live = true;
      api2.get(`/students/${student.id}/statistics`).then((s) => live && setStats(s)).catch((err) => live && setStats({ error: err }));
      return () => {
        live = false;
      };
    }, [student.id]);
    const tagName = useMemo(() => new Map(ctx.data.tags.map((t2) => [t2.id, t2.name])), [ctx.data.tags]);
    if (!stats) return /* @__PURE__ */ h("div", { className: "cr-loading is-inline" }, /* @__PURE__ */ h(Spinner, null));
    if (stats.error) return /* @__PURE__ */ h(Empty, { compact: true, icon: "info", title: tx("\u6210\u7EE9\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6"), text: stats.error.message });
    if (!stats.points.length) return /* @__PURE__ */ h(Empty, { compact: true, icon: "graph", title: tx("\u8FD8\u6CA1\u6709\u8003\u8BD5\u6210\u7EE9"), text: tx("\u5BFC\u5165\u4E00\u573A\u8003\u8BD5\u7684\u6210\u7EE9\u8868\u540E\uFF0C\u8FD9\u91CC\u4F1A\u6309\u65F6\u95F4\u5217\u51FA\u6BCF\u4E00\u573A\u3002") });
    const pts = stats.points.map((p) => ({ key: p.exam.id, title: p.exam.name, name: p.exam.name, date: p.exam.date, values: { me: p.rate, cls: p.classMean != null ? p.classMean / p.exam.fullScore : null }, note: p.status === "absent" ? tx("\u7F3A\u8003") : p.status === "unrecorded" ? tx("\u672A\u8BB0\u5F55") : null }));
    const current = stats.points.find((p) => p.exam.id === open) || stats.points.at(-1);
    return /* @__PURE__ */ h("div", { className: "cr-scores-student" }, /* @__PURE__ */ h("div", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("\u5386\u6B21\u5F97\u5206\u7387")), /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("\u5404\u573A\u6EE1\u5206\u548C\u96BE\u5EA6\u4E0D\u540C\uFF0C\u66F2\u7EBF\u53EA\u662F\u53C2\u8003\uFF0C\u4E0D\u4EE3\u8868\u80FD\u529B\u7684\u5347\u964D\u3002"))), /* @__PURE__ */ h(
      TrendChart,
      {
        label: tx("\u5386\u6B21\u5F97\u5206\u7387"),
        points: pts,
        selected: current.exam.id,
        onSelect: setOpen,
        series: [{ key: "me", label: student.name, tone: "blue" }, { key: "cls", label: tx("\u73ED\u7EA7\u5E73\u5747"), tone: "grey", dashed: true }]
      }
    )), /* @__PURE__ */ h("div", { className: "cr-exam-rows" }, [...stats.points].reverse().map((p) => /* @__PURE__ */ h("button", { key: p.exam.id, type: "button", className: cx("cr-exam-row", current.exam.id === p.exam.id && "is-on"), onClick: () => setOpen(p.exam.id) }, /* @__PURE__ */ h("span", { className: "cr-exam-row-title" }, /* @__PURE__ */ h("strong", null, p.exam.name), /* @__PURE__ */ h("small", null, [longDate(p.exam.date), p.exam.subject, p.className].filter(Boolean).join(" \xB7 "))), /* @__PURE__ */ h("span", { className: "cr-exam-row-score" }, p.status === "present" ? /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("b", null, fmt(p.total)), /* @__PURE__ */ h("small", null, "/ ", fmt(p.exam.fullScore))) : /* @__PURE__ */ h("em", null, p.status === "absent" ? tx("\u7F3A\u8003") : tx("\u672A\u8BB0\u5F55"))), /* @__PURE__ */ h("span", { className: "cr-exam-row-rank" }, p.rank ? tx("\u7B2C {{rank}} / {{n}}", { rank: p.rank, n: p.rankCount }) : "\u2014"), /* @__PURE__ */ h("span", { className: "cr-exam-row-mean" }, tx("\u73ED\u5747 {{v}}", { v: fmt(p.classMean) }))))), current.status === "present" && /* @__PURE__ */ h("div", { className: "cr-panel", key: current.exam.id }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("{{name}} \xB7 \u5404\u9898", { name: current.exam.name })), /* @__PURE__ */ h("span", { className: "cr-legend-inline" }, /* @__PURE__ */ h("i", { className: "is-fill" }), tx("{{name}}\u7684\u5F97\u5206\u7387", { name: student.name }), /* @__PURE__ */ h("i", { className: "is-mark" }), tx("\u73ED\u7EA7\u5F97\u5206\u7387"))), /* @__PURE__ */ h(RateBars, { compareKey: "classRate", rows: current.questions.map((q) => ({ id: q.id, label: q.label, rate: q.score == null ? null : q.score / q.fullScore, classRate: q.classRate, meta: q.score == null ? tx("\u7F3A\u5206") : `${fmt(q.score)} / ${fmt(q.fullScore)}`, state: "missing-scores" })) }), current.tags.length > 0 && /* @__PURE__ */ h("div", { className: "cr-tagline" }, current.tags.map((t2) => /* @__PURE__ */ h("span", { key: t2.id, className: "cr-tagstat" }, /* @__PURE__ */ h(Icon6, { name: "tag", size: 12, stroke: 2.2 }), tagName.get(t2.id) || t2.name, /* @__PURE__ */ h("b", null, t2.rate == null ? tx("\u7F3A\u5206") : pct(t2.rate))))), /* @__PURE__ */ h("p", { className: "cr-footnote" }, tx("\u9898\u76EE\u5F97\u5206\u7387\u63CF\u8FF0\u7684\u662F\u8FD9\u573A\u8003\u8BD5\u7684\u8BC1\u636E\uFF0C\u4E0D\u7B49\u4E8E\u77E5\u8BC6\u638C\u63E1\u5EA6\u3002"))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/Scores.jsx
  function ClassScores({ ctx, cls }) {
    const [examIds, setExamIds] = useState([]);
    const [tagIds, setTagIds] = useState([]);
    const [stats, setStats] = useState(null);
    const [focus, setFocus] = useState(null);
    const [bin, setBin] = useState(null);
    const exams = ctx.data.exams;
    const tags = ctx.data.tags;
    useEffect(() => {
      let live = true;
      setStats(null);
      api2.get(`/classes/${cls.id}/statistics`, { examId: examIds, tagId: tagIds }).then((s) => live && setStats(s)).catch((err) => live && setStats({ error: err }));
      return () => {
        live = false;
      };
    }, [cls.id, cls.version, examIds.join(), tagIds.join(), exams.length]);
    const importButton = /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", onClick: () => ctx.open("import", { classId: cls.id }) }, /* @__PURE__ */ h(Icon6, { name: "upload", size: 15, stroke: 2 }), tx("\u5BFC\u5165\u6210\u7EE9"));
    if (!exams.length) {
      return /* @__PURE__ */ h(Empty, { icon: "file", title: tx("\u8FD8\u6CA1\u6709\u8003\u8BD5"), text: tx("\u5148\u5EFA\u4E00\u573A\u8003\u8BD5\uFF1A\u540D\u79F0\u3001\u65E5\u671F\u3001\u6BCF\u9053\u8BA1\u5206\u9898\u7684\u6EE1\u5206\u3002\u4E4B\u540E\u628A\u6210\u7EE9\u8868\u5BFC\u8FDB\u6765\uFF0C\u5C31\u80FD\u770B\u5230\u5168\u73ED\u7684\u6837\u5B50\u3002") }, /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", onClick: () => ctx.open("exam") }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 15, stroke: 2.2 }), tx("\u65B0\u5EFA\u8003\u8BD5")));
    }
    if (!stats) return /* @__PURE__ */ h("div", { className: "cr-loading is-inline" }, /* @__PURE__ */ h(Spinner, null));
    if (stats.error) return /* @__PURE__ */ h(Empty, { compact: true, icon: "info", title: tx("\u6210\u7EE9\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6"), text: stats.error.message });
    const ok = stats.points.filter((p) => p.state === "ok");
    const none = stats.points.filter((p) => p.state !== "ok");
    const current = ok.find((p) => p.exam.id === focus) || ok.at(-1);
    const toggle = (list, set, id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    const filters = /* @__PURE__ */ h("div", { className: "cr-toolbar" }, /* @__PURE__ */ h(
      Menu,
      {
        label: tx("\u8003\u8BD5"),
        trigger: ({ open, toggle: t2 }) => /* @__PURE__ */ h("button", { type: "button", className: cx("cr-btn is-small", (open || examIds.length) && "is-on"), onClick: t2, "aria-expanded": open }, /* @__PURE__ */ h(Icon6, { name: "file", size: 14, stroke: 2 }), examIds.length ? tx("{{n}} \u573A\u8003\u8BD5", { n: examIds.length }) : tx("\u5168\u90E8\u8003\u8BD5")),
        items: [
          { label: tx("\u5168\u90E8\u8003\u8BD5"), check: !examIds.length, onClick: () => setExamIds([]) },
          "-",
          ...[...exams].sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ label: `${e.name} \xB7 ${longDate(e.date)}`, check: examIds.includes(e.id), keep: true, onClick: () => toggle(examIds, setExamIds, e.id) }))
        ]
      }
    ), tags.length > 0 && /* @__PURE__ */ h(
      Menu,
      {
        label: tx("\u9898\u76EE\u6807\u7B7E"),
        trigger: ({ open, toggle: t2 }) => /* @__PURE__ */ h("button", { type: "button", className: cx("cr-btn is-small", (open || tagIds.length) && "is-on"), onClick: t2, "aria-expanded": open }, /* @__PURE__ */ h(Icon6, { name: "tag", size: 14, stroke: 2 }), tagIds.length === 1 ? tags.find((x) => x.id === tagIds[0])?.name : tagIds.length ? tx("{{n}} \u4E2A\u6807\u7B7E", { n: tagIds.length, count: tagIds.length }) : tx("\u5168\u90E8\u6807\u7B7E")),
        items: [
          { label: tx("\u5168\u90E8\u6807\u7B7E"), check: !tagIds.length, onClick: () => setTagIds([]) },
          "-",
          ...tags.map((t2) => ({ label: t2.name, check: tagIds.includes(t2.id), keep: true, onClick: () => toggle(tagIds, setTagIds, t2.id) }))
        ]
      }
    ), /* @__PURE__ */ h("span", { className: "cr-grow" }), importButton);
    if (!ok.length) {
      return /* @__PURE__ */ h("div", { className: "cr-scores" }, filters, /* @__PURE__ */ h(Empty, { icon: "graph", title: examIds.length ? tx("\u6240\u9009\u8003\u8BD5\u91CC\uFF0C\u8FD9\u4E2A\u73ED\u8FD8\u6CA1\u6709\u6210\u7EE9") : tx("\u8FD9\u4E2A\u73ED\u8FD8\u6CA1\u6709\u6210\u7EE9"), text: tx("\u628A\u4E00\u573A\u8003\u8BD5\u7684\u6210\u7EE9\u8868\uFF08Excel\uFF09\u5BFC\u8FDB\u6765\uFF1A\u9009\u5DE5\u4F5C\u8868\u3001\u5BF9\u5E94\u59D3\u540D\u548C\u5206\u6570\u5217\uFF0C\u6821\u5BF9\u540E\u786E\u8BA4\u3002") }, importButton));
    }
    const full = current.exam.fullScore;
    const binStudents = bin != null ? current.distribution[bin].studentIds.map((id) => current.students.find((s) => s.studentId === id)).filter(Boolean) : [];
    const lowest = [...current.questions].filter((q) => q.rate != null).sort((a, b) => a.rate - b.rate)[0];
    return /* @__PURE__ */ h("div", { className: "cr-scores" }, filters, /* @__PURE__ */ h("div", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("\u5168\u73ED\u7684\u53D8\u5316")), /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("\u70B9\u4E00\u573A\u8003\u8BD5\uFF0C\u4E0B\u9762\u6362\u6210\u90A3\u4E00\u573A\u3002\u5404\u573A\u6EE1\u5206\u548C\u96BE\u5EA6\u4E0D\u540C\uFF0C\u66F2\u7EBF\u53EA\u4F5C\u53C2\u8003\u3002"))), /* @__PURE__ */ h(
      TrendChart,
      {
        label: tx("\u5168\u73ED\u7684\u53D8\u5316"),
        points: ok.map((p) => ({ key: p.exam.id, title: p.exam.name, name: p.exam.name, date: p.exam.date, values: { mean: p.mean / p.exam.fullScore, median: p.median / p.exam.fullScore }, band: p.min != null ? [p.min / p.exam.fullScore, p.max / p.exam.fullScore] : null })),
        selected: current.exam.id,
        onSelect: (id) => {
          setFocus(id);
          setBin(null);
        },
        series: [{ key: "mean", label: tx("\u5E73\u5747\u5F97\u5206\u7387"), tone: "green" }, { key: "median", label: tx("\u4E2D\u4F4D\u6570"), tone: "grey", dashed: true }],
        bandLabel: tx("\u6700\u9AD8\u5230\u6700\u4F4E")
      }
    ), none.length > 0 && /* @__PURE__ */ h("p", { className: "cr-footnote" }, tx("\u8FD8\u6CA1\u6709\u8FD9\u4E2A\u73ED\u6210\u7EE9\u7684\u8003\u8BD5\uFF1A{{list}}", { list: none.map((p) => p.exam.name).join("\u3001") }))), /* @__PURE__ */ h("div", { className: "cr-focus", key: current.exam.id }, /* @__PURE__ */ h("div", { className: "cr-focus-head" }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h3", null, current.exam.name), /* @__PURE__ */ h("span", { className: "cr-muted" }, [longDate(current.exam.date), current.exam.subject, tx("\u6EE1\u5206 {{n}}", { n: fmt(full) })].filter(Boolean).join(" \xB7 "))), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-small", onClick: () => ctx.go({ view: "exams", examId: current.exam.id }) }, tx("\u8BD5\u5377\u4E0E\u540C\u573A\u6BD4\u8F83"), /* @__PURE__ */ h(Icon6, { name: "chevron", size: 13, stroke: 2.2 }))), /* @__PURE__ */ h("div", { className: "cr-stats" }, /* @__PURE__ */ h(Stat, { label: tx("\u5E73\u5747\u5206"), value: fmt(current.mean), sub: pct(current.mean / full), tone: "green" }), /* @__PURE__ */ h(Stat, { label: tx("\u4E2D\u4F4D\u6570"), value: fmt(current.median), sub: pct(current.median / full) }), /* @__PURE__ */ h(Stat, { label: tx("\u6700\u9AD8 / \u6700\u4F4E"), value: `${fmt(current.max)} / ${fmt(current.min)}` }), /* @__PURE__ */ h(Stat, { label: tx("\u53C2\u52A0"), value: tx("{{n}} \u4EBA", { n: current.present }), sub: [current.absent && tx("\u7F3A\u8003 {{n}}", { n: current.absent }), current.unrecorded && tx("\u672A\u8BB0\u5F55 {{n}}", { n: current.unrecorded }), current.missingTotal && tx("\u65E0\u603B\u5206 {{n}}", { n: current.missingTotal })].filter(Boolean).join(" \xB7 ") || tx("\u5168\u90E8\u5230\u9F50") })), /* @__PURE__ */ h("div", { className: "cr-split" }, /* @__PURE__ */ h("div", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("\u5F97\u5206\u7387\u5206\u5E03")), /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("\u70B9\u4E00\u6863\u770B\u662F\u8C01"))), /* @__PURE__ */ h(Histogram, { label: tx("\u5F97\u5206\u7387\u5206\u5E03"), bins: current.distribution, selected: bin, onSelect: setBin }), /* @__PURE__ */ h("p", { className: "cr-axis-note" }, tx("\u5F97\u5206\u7387\uFF08%\uFF09\xB7 \u7F3A\u8003\u548C\u6CA1\u6709\u603B\u5206\u7684\u4E0D\u8BA1\u5165")), bin != null && /* @__PURE__ */ h("div", { className: "cr-bin-students" }, /* @__PURE__ */ h("strong", null, tx("{{from}}\u2013{{to}}% \xB7 {{n}} \u4EBA", { from: bin * 10, to: bin === 9 ? 100 : bin * 10 + 9, n: binStudents.length })), /* @__PURE__ */ h("div", null, binStudents.map((s) => /* @__PURE__ */ h("button", { key: s.studentId, type: "button", className: "cr-chip-student", onClick: () => ctx.go({ view: "class", tab: "scores", studentId: s.studentId }) }, /* @__PURE__ */ h(Avatar, { name: s.name, id: s.studentId, size: "sm" }), /* @__PURE__ */ h("span", null, s.name), /* @__PURE__ */ h("b", null, fmt(s.total))))))), /* @__PURE__ */ h("div", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("\u6392\u540D")), /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("\u540C\u5206\u5E76\u5217"))), /* @__PURE__ */ h("ol", { className: "cr-ranking" }, current.students.map((s, i) => /* @__PURE__ */ h("li", { key: s.studentId, style: { "--i": Math.min(i, 20) } }, /* @__PURE__ */ h("button", { type: "button", onClick: () => ctx.go({ studentId: s.studentId }) }, /* @__PURE__ */ h("span", { className: cx("cr-rank", s.rank && s.rank <= 3 && `is-top is-${s.rank}`) }, s.rank ?? "\u2014"), /* @__PURE__ */ h(Avatar, { name: s.name, id: s.studentId, size: "sm" }), /* @__PURE__ */ h("span", { className: "cr-ranking-name" }, s.name), s.status === "present" ? /* @__PURE__ */ h("span", { className: "cr-ranking-score" }, /* @__PURE__ */ h("b", null, fmt(s.total)), /* @__PURE__ */ h("small", null, pct(s.rate))) : /* @__PURE__ */ h("em", null, s.status === "absent" ? tx("\u7F3A\u8003") : tx("\u672A\u8BB0\u5F55")))))))), /* @__PURE__ */ h("div", { className: "cr-split" }, /* @__PURE__ */ h("div", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("\u5404\u9898\u5F97\u5206\u7387")), lowest && /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("\u6700\u4F4E\uFF1A{{q}} {{r}}", { q: lowest.label, r: pct(lowest.rate) }))), /* @__PURE__ */ h(RateBars, { rows: current.questions.map((q) => ({ id: q.id, label: q.group ? `${q.group} ${q.label}` : q.label, rate: q.rate, state: "missing-scores", meta: q.missing ? tx("\u5DF2\u77E5 {{k}} \xB7 \u7F3A {{m}}", { k: q.known, m: q.missing }) : null })) })), /* @__PURE__ */ h("div", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("\u6807\u7B7E")), /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("\u591A\u4E2A\u6807\u7B7E\u6309\u9898\u76EE\u5408\u5E76\uFF0C\u540C\u4E00\u9898\u53EA\u7B97\u4E00\u6B21"))), current.tags.length ? /* @__PURE__ */ h(RateBars, { rows: current.tags.map((t2) => ({ id: t2.id, label: t2.name, rate: t2.rate, state: t2.state, meta: t2.state === "ok" ? tx("{{n}} \u9053\u9898", { n: t2.questionIds.length }) : null })) }) : /* @__PURE__ */ h("p", { className: "cr-muted cr-pad" }, tx("\u8FD9\u573A\u8003\u8BD5\u7684\u9898\u76EE\u8FD8\u6CA1\u6709\u6807\u7B7E\u3002\u7ED9\u9898\u76EE\u8D34\u4E0A\u6807\u7B7E\uFF0C\u5C31\u80FD\u770B\u5230\u8FD9\u4E00\u7C7B\u9898\u7684\u5F97\u5206\u3002")), /* @__PURE__ */ h("p", { className: "cr-footnote" }, tx("\u5F97\u5206\u7387\u63CF\u8FF0\u7684\u662F\u8FD9\u573A\u8003\u8BD5\u7684\u8BC1\u636E\uFF0C\u4E0D\u7B49\u4E8E\u77E5\u8BC6\u638C\u63E1\u5EA6\uFF1B\u6CA1\u8003\u5230\u7684\u6807\u7B7E\u4E0D\u8BB0\u96F6\u3002"))))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/Exams.jsx
  var imported = (imports) => {
    const map = /* @__PURE__ */ new Map();
    for (const i of imports) if (i.state === "confirmed") map.set(`${i.examId}:${i.classId}`, i);
    return map;
  };
  function ExamList({ ctx }) {
    const [imports, setImports] = useState([]);
    useEffect(() => {
      api2.get("/imports").then((r) => setImports(r.items)).catch(() => {
      });
    }, [ctx.data.exams.length]);
    const done3 = imported(imports);
    const exams = ctx.data.exams;
    return /* @__PURE__ */ h("div", { className: "cr-page" }, /* @__PURE__ */ h("header", { className: "cr-head" }, /* @__PURE__ */ h("div", { className: "cr-head-title is-plain" }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h2", null, tx("\u8003\u8BD5")), /* @__PURE__ */ h("span", null, tx("{{n}} \u573A \xB7 \u4E00\u4EFD\u8BD5\u5377\u53EF\u4EE5\u7ED9\u591A\u4E2A\u73ED\u7528", { n: exams.length })))), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", onClick: () => ctx.open("exam") }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 15, stroke: 2.2 }), tx("\u65B0\u5EFA\u8003\u8BD5"))), /* @__PURE__ */ h("div", { className: "cr-page-scroll" }, !exams.length ? /* @__PURE__ */ h(Empty, { icon: "file", title: tx("\u8FD8\u6CA1\u6709\u8003\u8BD5"), text: tx("\u4E00\u573A\u8003\u8BD5\u5C31\u662F\u540C\u4E00\u6B21\u3001\u540C\u4E00\u4EFD\u8BD5\u5377\uFF1A\u540D\u79F0\u3001\u65E5\u671F\u3001\u6BCF\u9053\u8BA1\u5206\u9898\u7684\u6EE1\u5206\u3002\u5EFA\u597D\u540E\u628A\u5404\u73ED\u7684\u6210\u7EE9\u8868\u5BFC\u8FDB\u6765\u3002") }, /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", onClick: () => ctx.open("exam") }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 15, stroke: 2.2 }), tx("\u65B0\u5EFA\u8003\u8BD5"))) : /* @__PURE__ */ h("div", { className: "cr-exams" }, exams.map((e, i) => /* @__PURE__ */ h("button", { key: e.id, type: "button", className: "cr-exam-card", style: { "--i": i }, onClick: () => ctx.go({ examId: e.id }) }, /* @__PURE__ */ h("span", { className: "cr-datebox" }, /* @__PURE__ */ h("small", null, isEnglish() ? (/* @__PURE__ */ new Date(`${e.date}T12:00:00Z`)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) : tx("{{m}} \u6708", { m: Number(e.date.slice(5, 7)) })), /* @__PURE__ */ h("strong", null, Number(e.date.slice(8, 10)))), /* @__PURE__ */ h("span", { className: "cr-exam-card-text" }, /* @__PURE__ */ h("strong", null, e.name), /* @__PURE__ */ h("small", null, [e.subject, tx("\u6EE1\u5206 {{n}}", { n: fmt(e.fullScore) }), tx("{{n}} \u9053\u8BA1\u5206\u9898", { n: e.questions.length }), e.source.files.length ? tx("\u6709\u539F\u5377") : null].filter(Boolean).join(" \xB7 ")), /* @__PURE__ */ h("span", { className: "cr-class-chips" }, ctx.data.classes.map((c) => /* @__PURE__ */ h("span", { key: c.id, className: cx("cr-class-chip", done3.has(`${e.id}:${c.id}`) ? "is-done" : "is-todo") }, done3.has(`${e.id}:${c.id}`) ? /* @__PURE__ */ h(Icon6, { name: "check", size: 11, stroke: 2.6 }) : /* @__PURE__ */ h("i", null), c.name)))), /* @__PURE__ */ h(Icon6, { name: "chevron", size: 15, stroke: 2 }))))));
  }
  function TagPicker({ ctx, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return void 0;
      const down = (e) => {
        if (!ref.current?.contains(e.target)) setOpen(false);
      };
      document.addEventListener("pointerdown", down, true);
      return () => document.removeEventListener("pointerdown", down, true);
    }, [open]);
    const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
    const add = async (e) => {
      e.preventDefault();
      const n = name.trim();
      if (!n) return;
      try {
        const tag = await api2.post("/tags", { name: n });
        await ctx.reload();
        onChange([...value, tag.id]);
      } catch (err) {
        if (err.problem?.tagId) onChange([.../* @__PURE__ */ new Set([...value, err.problem.tagId])]);
        else ctx.toast(err.message, "error");
      }
      setName("");
    };
    return /* @__PURE__ */ h("span", { className: "cr-menuwrap", ref }, /* @__PURE__ */ h("button", { type: "button", className: cx("cr-tagcell", open && "is-on"), onClick: () => setOpen(!open), "aria-expanded": open }, value.length ? value.map((id) => /* @__PURE__ */ h("span", { key: id, className: "cr-tagmini" }, ctx.data.tags.find((t2) => t2.id === id)?.name)) : /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("\u6DFB\u52A0\u6807\u7B7E"))), open && /* @__PURE__ */ h("div", { className: "cr-menu is-end cr-tagmenu", role: "menu", "aria-label": tx("\u6807\u7B7E") }, ctx.data.tags.map((t2) => /* @__PURE__ */ h("button", { key: t2.id, type: "button", role: "menuitemcheckbox", "aria-checked": value.includes(t2.id), onClick: () => toggle(t2.id) }, /* @__PURE__ */ h("span", null, t2.name), value.includes(t2.id) && /* @__PURE__ */ h(Icon6, { name: "check", size: 14, stroke: 2.4 }))), ctx.data.tags.length > 0 && /* @__PURE__ */ h("div", { className: "cr-menu-sep" }), /* @__PURE__ */ h("form", { className: "cr-tagmenu-new", onSubmit: add }, /* @__PURE__ */ h("input", { value: name, maxLength: 40, placeholder: tx("\u65B0\u6807\u7B7E"), "aria-label": tx("\u65B0\u6807\u7B7E"), onChange: (e) => setName(e.target.value) }), /* @__PURE__ */ h("button", { type: "submit", className: "cr-icon-btn is-small is-filled", "aria-label": tx("\u6DFB\u52A0"), disabled: !name.trim() }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 12, stroke: 2.6 })))));
  }
  function ExamForm({ ctx, initial, onClose }) {
    const [form, setForm] = useState({
      name: initial?.name ?? "",
      date: initial?.date ?? today(),
      subject: initial?.subject ?? tx("\u6570\u5B66"),
      fullScore: initial ? String(initial.fullScore) : "",
      questions: initial?.questions.map((q) => ({ ...q, fullScore: String(q.fullScore) })) ?? []
    });
    const [bulk, setBulk] = useState({ count: "10", score: "10" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const set = (key2) => (e) => setForm({ ...form, [key2]: e.target.value });
    const total = sum(form.questions.map((q) => Number(q.fullScore) || 0));
    const patchQ = (i, patch) => setForm({ ...form, questions: form.questions.map((q, j) => j === i ? { ...q, ...patch } : q) });
    const addMany = () => {
      const n = Math.min(100, Math.max(1, Number(bulk.count) || 0));
      const start = form.questions.length;
      setForm({ ...form, questions: [...form.questions, ...Array.from({ length: n }, (_, i) => ({ label: String(start + i + 1), group: "", fullScore: bulk.score, tagIds: [] }))] });
    };
    const save = async () => {
      setBusy(true);
      setError("");
      try {
        const body = {
          name: form.name,
          date: form.date,
          subject: form.subject,
          fullScore: form.fullScore ? Number(form.fullScore) : total,
          questions: form.questions.map((q) => ({ ...q.id ? { id: q.id } : {}, label: q.label, group: q.group || "", fullScore: Number(q.fullScore), tagIds: q.tagIds }))
        };
        const saved = initial ? await api2.put(`/exams/${initial.id}`, { baseVersion: initial.version, ...body }) : await api2.post("/exams", body);
        await ctx.reload();
        ctx.toast(initial ? tx("\u5DF2\u4FDD\u5B58") : tx("\u8003\u8BD5\u5DF2\u521B\u5EFA"));
        ctx.go({ view: "exams", examId: saved.id });
        onClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    };
    const covered = form.fullScore && total && Number(form.fullScore) !== total;
    return /* @__PURE__ */ h(
      Dialog,
      {
        wide: true,
        title: initial ? tx("\u7F16\u8F91\u8003\u8BD5") : tx("\u65B0\u5EFA\u8003\u8BD5"),
        subtitle: tx("\u8BA1\u5206\u9898\u662F\u6700\u5C0F\u7684\u8BA1\u5206\u5355\u4F4D\uFF0C\u53EF\u4EE5\u662F\u5C0F\u95EE\u3002\u5927\u9898\u6807\u9898\u5199\u5728\u201C\u5206\u7EC4\u201D\u91CC\uFF0C\u4E0D\u4F1A\u518D\u7B97\u4E00\u6B21\u5206\u3002"),
        onClose,
        footer: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("{{n}} \u9053\u9898\uFF0C\u5408\u8BA1 {{s}} \u5206", { n: form.questions.length, s: fmt(total) })), /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: onClose }, tx("\u53D6\u6D88")), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", disabled: busy || !form.name.trim() || !form.questions.length, onClick: save }, initial ? tx("\u4FDD\u5B58") : tx("\u521B\u5EFA\u8003\u8BD5")))
      },
      /* @__PURE__ */ h("div", { className: "cr-form" }, /* @__PURE__ */ h("div", { className: "cr-form-row is-exam" }, /* @__PURE__ */ h(Field, { label: tx("\u8003\u8BD5\u540D\u79F0") }, /* @__PURE__ */ h("input", { value: form.name, maxLength: 80, placeholder: tx("\u4F8B\u5982\uFF1A\u671F\u4E2D\u8003\u8BD5"), onChange: set("name") })), /* @__PURE__ */ h(Field, { label: tx("\u65E5\u671F") }, /* @__PURE__ */ h("input", { type: "date", value: form.date, onChange: set("date") })), /* @__PURE__ */ h(Field, { label: tx("\u5B66\u79D1") }, /* @__PURE__ */ h("input", { value: form.subject, maxLength: 40, onChange: set("subject") })), /* @__PURE__ */ h(Field, { label: tx("\u603B\u6EE1\u5206"), hint: tx("\u9009\u586B") }, /* @__PURE__ */ h("input", { inputMode: "decimal", value: form.fullScore, placeholder: total ? fmt(total) : "100", title: tx("\u7559\u7A7A\u5C31\u7528\u8BA1\u5206\u9898\u5408\u8BA1"), onChange: set("fullScore") }))), covered && /* @__PURE__ */ h("p", { className: "cr-note" }, /* @__PURE__ */ h(Icon6, { name: "info", size: 14, stroke: 2 }), tx("\u8BA1\u5206\u9898\u5408\u8BA1 {{s}}\uFF0C\u548C\u603B\u6EE1\u5206 {{f}} \u4E0D\u540C\u3002\u53EA\u6709\u9010\u9898\u5B8C\u6574\u8986\u76D6\u6574\u5377\u65F6\uFF0C\u624D\u4F1A\u68C0\u67E5\u603B\u5206\u548C\u9010\u9898\u4E4B\u548C\u662F\u5426\u4E00\u81F4\u3002", { s: fmt(total), f: form.fullScore })), /* @__PURE__ */ h("div", { className: "cr-qtable" }, form.questions.length > 0 && /* @__PURE__ */ h("div", { className: "cr-qtable-head" }, /* @__PURE__ */ h("span", null, tx("\u5206\u7EC4")), /* @__PURE__ */ h("span", null, tx("\u9898\u53F7")), /* @__PURE__ */ h("span", null, tx("\u6EE1\u5206")), /* @__PURE__ */ h("span", null, tx("\u6807\u7B7E")), /* @__PURE__ */ h("span", null)), form.questions.map((q, i) => /* @__PURE__ */ h("div", { key: q.id || i, className: "cr-qrow" }, /* @__PURE__ */ h("input", { "aria-label": tx("\u5206\u7EC4"), value: q.group, placeholder: tx("\u5982\uFF1A\u4E00\u3001\u9009\u62E9\u9898"), onChange: (e) => patchQ(i, { group: e.target.value }) }), /* @__PURE__ */ h("input", { "aria-label": tx("\u9898\u53F7"), value: q.label, onChange: (e) => patchQ(i, { label: e.target.value }) }), /* @__PURE__ */ h("input", { "aria-label": tx("\u6EE1\u5206"), inputMode: "decimal", value: q.fullScore, onChange: (e) => patchQ(i, { fullScore: e.target.value }) }), /* @__PURE__ */ h(TagPicker, { ctx, value: q.tagIds, onChange: (tagIds) => patchQ(i, { tagIds }) }), /* @__PURE__ */ h("button", { type: "button", className: "cr-icon-btn is-small", "aria-label": tx("\u79FB\u9664\u8FD9\u9053\u9898"), onClick: () => setForm({ ...form, questions: form.questions.filter((_, j) => j !== i) }) }, /* @__PURE__ */ h(Icon6, { name: "close", size: 12, stroke: 2.4 })))), /* @__PURE__ */ h("div", { className: "cr-qadd" }, /* @__PURE__ */ h("span", null, tx("\u6DFB\u52A0")), /* @__PURE__ */ h("input", { "aria-label": tx("\u9898\u6570"), inputMode: "numeric", value: bulk.count, onChange: (e) => setBulk({ ...bulk, count: e.target.value }) }), /* @__PURE__ */ h("span", null, tx("\u9053\u9898\uFF0C\u6BCF\u9898")), /* @__PURE__ */ h("input", { "aria-label": tx("\u6BCF\u9898\u6EE1\u5206"), inputMode: "decimal", value: bulk.score, onChange: (e) => setBulk({ ...bulk, score: e.target.value }) }), /* @__PURE__ */ h("span", null, tx("\u5206")), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-small", onClick: addMany }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 13, stroke: 2.4 }), tx("\u6DFB\u52A0")))), error && /* @__PURE__ */ h("p", { className: "cr-error" }, error))
    );
  }
  function ExamDetail({ ctx, exam }) {
    const [comparison, setComparison] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
      let live = true;
      api2.get(`/exams/${exam.id}/comparison`).then((c) => live && setComparison(c)).catch(() => live && setComparison(false));
      return () => {
        live = false;
      };
    }, [exam.id, exam.version]);
    const tagName = useMemo(() => new Map(ctx.data.tags.map((t2) => [t2.id, t2.name])), [ctx.data.tags]);
    const groups = [];
    for (const q of exam.questions) {
      if (!groups.length || groups.at(-1).group !== q.group) groups.push({ group: q.group, items: [] });
      groups.at(-1).items.push(q);
    }
    const total = sum(exam.questions.map((q) => q.fullScore));
    const upload = async (files) => {
      if (!files.length) return;
      setBusy(true);
      try {
        const stored = [];
        for (const f of files) stored.push(await api2.upload(f));
        await api2.put(`/exams/${exam.id}`, { baseVersion: exam.version, source: { files: [...exam.source.files, ...stored.map((s) => ({ fileId: s.id }))] } });
        await ctx.reload();
        ctx.toast(tx("\u539F\u5377\u5DF2\u4E0A\u4F20"));
      } catch (err) {
        ctx.toast(err.message, "error");
      } finally {
        setBusy(false);
      }
    };
    const removeFile = async (fileId) => {
      try {
        await api2.put(`/exams/${exam.id}`, { baseVersion: exam.version, source: { files: exam.source.files.filter((f) => f.fileId !== fileId) } });
        await ctx.reload();
      } catch (err) {
        ctx.toast(err.message, "error");
      }
    };
    const classes = comparison?.classes ?? [];
    const shown = classes.filter((c) => c.state === "ok");
    return /* @__PURE__ */ h("div", { className: "cr-page" }, /* @__PURE__ */ h("header", { className: "cr-head" }, /* @__PURE__ */ h("button", { type: "button", className: "cr-back", onClick: () => ctx.go({ examId: null }) }, /* @__PURE__ */ h(Icon6, { name: "arrowLeft", size: 16, stroke: 2.2 }), /* @__PURE__ */ h("span", null, tx("\u8003\u8BD5"))), /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: () => ctx.open("exam", { initial: exam }) }, /* @__PURE__ */ h(Icon6, { name: "pencil", size: 14, stroke: 2 }), tx("\u7F16\u8F91")), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", onClick: () => ctx.open("import", { examId: exam.id }) }, /* @__PURE__ */ h(Icon6, { name: "upload", size: 14, stroke: 2 }), tx("\u5BFC\u5165\u6210\u7EE9")), /* @__PURE__ */ h(Menu, { label: tx("\u8003\u8BD5\u64CD\u4F5C"), items: [{ label: tx("\u5F52\u6863\u8003\u8BD5"), icon: "trash", danger: true, onClick: () => ctx.open("confirm", {
      title: tx("\u5F52\u6863\u201C{{name}}\u201D\uFF1F", { name: exam.name }),
      message: tx("\u5F52\u6863\u540E\u8FD9\u573A\u8003\u8BD5\u9000\u51FA\u7EDF\u8BA1\uFF1B\u6062\u590D\u540E\uFF0C\u539F\u6765\u7684\u6210\u7EE9\u4F1A\u91CD\u65B0\u53C2\u4E0E\u3002"),
      confirmLabel: tx("\u5F52\u6863"),
      onConfirm: async () => {
        await api2.remove("exams", exam);
        ctx.go({ examId: null });
        await ctx.reload();
        ctx.toast(tx("\u5DF2\u5F52\u6863"));
      }
    }) }] })), /* @__PURE__ */ h("div", { className: "cr-page-scroll" }, /* @__PURE__ */ h("section", { className: "cr-exam-hero" }, /* @__PURE__ */ h("span", { className: "cr-datebox is-big" }, /* @__PURE__ */ h("small", null, isEnglish() ? (/* @__PURE__ */ new Date(`${exam.date}T12:00:00Z`)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) : tx("{{m}} \u6708", { m: Number(exam.date.slice(5, 7)) })), /* @__PURE__ */ h("strong", null, Number(exam.date.slice(8, 10)))), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h2", null, exam.name), /* @__PURE__ */ h("p", null, [longDate(exam.date), exam.subject, tx("\u6EE1\u5206 {{n}}", { n: fmt(exam.fullScore) }), tx("{{n}} \u9053\u8BA1\u5206\u9898", { n: exam.questions.length })].filter(Boolean).join(" \xB7 ")))), /* @__PURE__ */ h("div", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("\u540C\u573A\u6BD4\u8F83")), /* @__PURE__ */ h("span", { className: "cr-muted" }, tx("\u540C\u4E00\u4EFD\u8BD5\u5377\u3001\u540C\u4E00\u5957\u53E3\u5F84\uFF1B\u6CA1\u6709\u6210\u7EE9\u7684\u73ED\u7EA7\u4E0D\u8BB0\u96F6\u3002"))), comparison === null ? /* @__PURE__ */ h("div", { className: "cr-loading is-inline" }, /* @__PURE__ */ h(Spinner, null)) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("ul", { className: "cr-compare" }, classes.map((c, i) => /* @__PURE__ */ h("li", { key: c.classId, style: { "--i": i }, className: cx(c.state !== "ok" && "is-none") }, /* @__PURE__ */ h("span", { className: cx("cr-place-dot", `is-${hueOf2(c.classId)}`) }, classMark(c.name)), /* @__PURE__ */ h("strong", null, c.name), c.state === "ok" ? /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: "cr-rate-track is-big" }, /* @__PURE__ */ h("span", { className: "cr-rate-fill", style: { "--w": c.mean / exam.fullScore } })), /* @__PURE__ */ h("span", { className: "cr-compare-num" }, /* @__PURE__ */ h("b", null, fmt(c.mean)), /* @__PURE__ */ h("small", null, tx("\u5E73\u5747 \xB7 {{r}}", { r: pct(c.mean / exam.fullScore) }))), /* @__PURE__ */ h("span", { className: "cr-compare-num" }, /* @__PURE__ */ h("b", null, fmt(c.median)), /* @__PURE__ */ h("small", null, tx("\u4E2D\u4F4D\u6570"))), /* @__PURE__ */ h("span", { className: "cr-compare-num" }, /* @__PURE__ */ h("b", null, c.present), /* @__PURE__ */ h("small", null, c.absent ? tx("\u7F3A\u8003 {{n}}", { n: c.absent }) : tx("\u53C2\u52A0")))) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: "cr-none" }, tx("\u65E0\u7ED3\u679C")), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-small", onClick: () => ctx.open("import", { examId: exam.id, classId: c.classId }) }, /* @__PURE__ */ h(Icon6, { name: "upload", size: 13, stroke: 2 }), tx("\u5BFC\u5165\u8FD9\u4E2A\u73ED")))))), shown.length > 0 && /* @__PURE__ */ h("div", { className: "cr-qcompare", style: { "--n": shown.length } }, /* @__PURE__ */ h("div", { className: "cr-qcompare-row is-head" }, /* @__PURE__ */ h("span", null, tx("\u9898\u76EE")), shown.map((c) => /* @__PURE__ */ h("span", { key: c.classId }, c.name))), exam.questions.map((q) => /* @__PURE__ */ h("div", { key: q.id, className: "cr-qcompare-row" }, /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("b", null, q.group ? `${q.group} ${q.label}` : q.label), /* @__PURE__ */ h("small", null, fmt(q.fullScore), " ", tx("\u5206"))), shown.map((c) => {
      const r = c.questions.find((x) => x.id === q.id)?.rate;
      return /* @__PURE__ */ h("span", { key: c.classId, className: "cr-qcompare-cell" }, /* @__PURE__ */ h("span", { className: "cr-rate-track" }, /* @__PURE__ */ h("span", { className: cx("cr-rate-fill", r != null && r < 0.6 && "is-low"), style: { "--w": r ?? 0 } })), /* @__PURE__ */ h("small", null, pct(r)));
    })))))), /* @__PURE__ */ h("div", { className: "cr-split" }, /* @__PURE__ */ h("div", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("\u8BA1\u5206\u9898")), /* @__PURE__ */ h("span", { className: cx("cr-muted", total !== exam.fullScore && "is-warn") }, total === exam.fullScore ? tx("\u5408\u8BA1 {{s}}\uFF0C\u8986\u76D6\u6574\u5377", { s: fmt(total) }) : tx("\u5408\u8BA1 {{s}} / \u6EE1\u5206 {{f}}", { s: fmt(total), f: fmt(exam.fullScore) }))), /* @__PURE__ */ h("div", { className: "cr-qlist" }, groups.map((g, gi) => /* @__PURE__ */ h("div", { key: gi, className: "cr-qgroup" }, g.group && /* @__PURE__ */ h("h4", null, g.group), g.items.map((q) => /* @__PURE__ */ h("div", { key: q.id, className: "cr-qitem" }, /* @__PURE__ */ h("strong", null, q.label), /* @__PURE__ */ h("span", { className: "cr-qitem-tags" }, q.tagIds.map((id) => /* @__PURE__ */ h("span", { key: id, className: "cr-tagmini" }, tagName.get(id)))), /* @__PURE__ */ h("small", null, tx("{{n}} \u5206", { n: fmt(q.fullScore) })))))))), /* @__PURE__ */ h("div", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, tx("\u539F\u5377")), /* @__PURE__ */ h("label", { className: cx("cr-btn is-small", busy && "is-disabled") }, /* @__PURE__ */ h(Icon6, { name: "upload", size: 13, stroke: 2 }), tx("\u4E0A\u4F20"), /* @__PURE__ */ h("input", { type: "file", hidden: true, multiple: true, accept: ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp", onChange: (e) => {
      upload([...e.target.files]);
      e.target.value = "";
    } }))), exam.source.files.length ? /* @__PURE__ */ h("ul", { className: "cr-files" }, exam.source.files.map((f) => /* @__PURE__ */ h("li", { key: f.fileId }, f.mediaType?.startsWith("image/") ? /* @__PURE__ */ h("img", { src: api2.fileUrl(f.fileId), alt: "" }) : /* @__PURE__ */ h("span", { className: "cr-file-icon" }, /* @__PURE__ */ h(Icon6, { name: "file", size: 18, stroke: 1.8 }), /* @__PURE__ */ h("em", null, (f.name.split(".").pop() || "").toUpperCase())), /* @__PURE__ */ h("a", { href: api2.fileUrl(f.fileId), target: "_blank", rel: "noreferrer" }, f.name), /* @__PURE__ */ h("button", { type: "button", className: "cr-icon-btn is-small", "aria-label": tx("\u79FB\u9664"), onClick: () => removeFile(f.fileId) }, /* @__PURE__ */ h(Icon6, { name: "close", size: 12, stroke: 2.4 }))))) : /* @__PURE__ */ h("p", { className: "cr-muted cr-pad" }, tx("Word\u3001PDF \u6216\u56FE\u7247\u90FD\u53EF\u4EE5\u3002\u6CA1\u6709\u539F\u5377\uFF0C\u6210\u7EE9\u4E5F\u80FD\u7167\u5E38\u4FDD\u5B58\uFF1B\u53EA\u662F\u770B\u9898\u65F6\u5C11\u4E86\u8BC1\u636E\u3002"))))));
  }
  function TagManager({ ctx }) {
    const [name, setName] = useState("");
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState("");
    const usage = /* @__PURE__ */ new Map();
    for (const e of ctx.data.exams) for (const q of e.questions) for (const id of q.tagIds) usage.set(id, (usage.get(id) || 0) + 1);
    const create = async (e) => {
      e.preventDefault();
      if (!name.trim()) return;
      try {
        await api2.post("/tags", { name });
        setName("");
        await ctx.reload();
      } catch (err) {
        ctx.toast(err.message, "error");
      }
    };
    const rename = async (tag) => {
      try {
        await api2.put(`/tags/${tag.id}`, { baseVersion: tag.version, name: draft });
        setEditing(null);
        await ctx.reload();
      } catch (err) {
        ctx.toast(err.message, "error");
      }
    };
    const merge = (tag, target) => ctx.open("confirm", {
      title: tx("\u628A\u201C{{a}}\u201D\u5408\u5E76\u5230\u201C{{b}}\u201D\uFF1F", { a: tag.name, b: target.name }),
      message: tx("\u6240\u6709\u9898\u76EE\u4E0A\u7684\u201C{{a}}\u201D\u4F1A\u6362\u6210\u201C{{b}}\u201D\uFF0C\u4E4B\u540E\u53EA\u5269\u201C{{b}}\u201D\u3002", { a: tag.name, b: target.name }),
      confirmLabel: tx("\u5408\u5E76"),
      onConfirm: async () => {
        await api2.post(`/tags/${tag.id}/merge`, { baseVersion: tag.version, targetId: target.id, targetVersion: target.version });
        await ctx.reload();
        ctx.toast(tx("\u5DF2\u5408\u5E76"));
      }
    });
    return /* @__PURE__ */ h("div", { className: "cr-page" }, /* @__PURE__ */ h("header", { className: "cr-head" }, /* @__PURE__ */ h("div", { className: "cr-head-title is-plain" }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h2", null, tx("\u9898\u76EE\u6807\u7B7E")), /* @__PURE__ */ h("span", null, tx("\u7528\u4F60\u81EA\u5DF1\u7684\u8BDD\u7ED9\u9898\u76EE\u5206\u7C7B\uFF0C\u957F\u671F\u590D\u7528\uFF1B\u53EF\u4EE5\u6539\u540D\uFF0C\u4E5F\u53EF\u4EE5\u5408\u5E76\u3002"))))), /* @__PURE__ */ h("div", { className: "cr-page-scroll" }, /* @__PURE__ */ h("form", { className: "cr-tagnew", onSubmit: create }, /* @__PURE__ */ h(Icon6, { name: "tag", size: 15, stroke: 2 }), /* @__PURE__ */ h("input", { value: name, maxLength: 40, placeholder: tx("\u65B0\u6807\u7B7E\uFF0C\u4F8B\u5982\uFF1A\u4E8C\u6B21\u51FD\u6570\u3001\u51E0\u4F55\u8BC1\u660E"), "aria-label": tx("\u65B0\u6807\u7B7E"), onChange: (e) => setName(e.target.value) }), /* @__PURE__ */ h("button", { type: "submit", className: "cr-btn is-primary is-small", disabled: !name.trim() }, tx("\u6DFB\u52A0"))), !ctx.data.tags.length ? /* @__PURE__ */ h(Empty, { compact: true, icon: "tag", title: tx("\u8FD8\u6CA1\u6709\u6807\u7B7E"), text: tx("\u6807\u7B7E\u8D34\u5728\u8BD5\u5377\u7684\u9898\u76EE\u4E0A\uFF0C\u4E00\u6B21\u6807\u6CE8\uFF0C\u5168\u73ED\u5171\u7528\u3002") }) : /* @__PURE__ */ h("ul", { className: "cr-tags" }, ctx.data.tags.map((t2, i) => /* @__PURE__ */ h("li", { key: t2.id, style: { "--i": i } }, /* @__PURE__ */ h("span", { className: "cr-tag-icon" }, /* @__PURE__ */ h(Icon6, { name: "tag", size: 14, stroke: 2 })), editing === t2.id ? /* @__PURE__ */ h("form", { className: "cr-tag-edit", onSubmit: (e) => {
      e.preventDefault();
      rename(t2);
    } }, /* @__PURE__ */ h("input", { autoFocus: true, value: draft, maxLength: 40, "aria-label": tx("\u6807\u7B7E\u540D\u79F0"), onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => e.key === "Escape" && setEditing(null) }), /* @__PURE__ */ h("button", { type: "submit", className: "cr-btn is-primary is-small" }, tx("\u4FDD\u5B58"))) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("strong", null, t2.name), /* @__PURE__ */ h("small", null, usage.get(t2.id) ? tx("{{n}} \u9053\u9898", { n: usage.get(t2.id) }) : tx("\u8FD8\u6CA1\u7528\u8FC7")), /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h(Menu, { label: tx("\u6807\u7B7E\u64CD\u4F5C"), items: [
      { label: tx("\u6539\u540D"), icon: "pencil", onClick: () => {
        setEditing(t2.id);
        setDraft(t2.name);
      } },
      ...ctx.data.tags.length > 1 ? ["-", ...ctx.data.tags.filter((x) => x.id !== t2.id).map((x) => ({ label: tx("\u5408\u5E76\u5230\u201C{{b}}\u201D", { b: x.name }), onClick: () => merge(t2, x) }))] : []
    ] })))))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/Import.jsx
  var STEPS = ["\u9009\u62E9\u6210\u7EE9\u8868", "\u5BF9\u5E94\u8868\u683C\u7684\u5217", "\u9010\u884C\u6821\u5BF9"];
  var letter = (n) => {
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  var clean = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase();
  function guess(sheet, exam) {
    const rows = sheet.rows;
    let header = rows.findIndex((r) => r?.some((c) => /姓名|学号|name/i.test(c?.text ?? "")));
    if (header < 0) header = 0;
    const head = (rows[header] || []).map((c) => clean(c?.text));
    const find = (re) => {
      const i = head.findIndex((t2) => re.test(t2));
      return i >= 0 ? i + 1 : null;
    };
    const core = (t2) => clean(t2).toLowerCase().replace(/^(第|q|question)/, "").replace(/(小题|题)$/, "");
    const questionCols = {};
    const used = /* @__PURE__ */ new Set();
    for (const q of exam.questions) {
      const keys = [core(q.label), core(`${q.group}${q.label}`), clean(`${q.group}${q.label}`)].filter(Boolean);
      const i = head.findIndex((t2, at) => !used.has(at) && t2 && (keys.includes(core(t2)) || keys.includes(t2)));
      if (i >= 0) {
        questionCols[q.id] = i + 1;
        used.add(i);
      }
    }
    let absentCol = find(/缺考|absent/);
    if (!absentCol) {
      const width = Math.max(0, ...rows.map((r) => r?.length || 0));
      for (let c = 0; c < width && !absentCol; c++) {
        if (rows.slice(header + 1).some((r) => /^(缺考|缺|absent)$/i.test(clean(r?.[c]?.text)))) absentCol = c + 1;
      }
    }
    return {
      sheet: 0,
      headerRow: header + 1,
      firstRow: header + 2,
      lastRow: rows.length,
      nameCol: find(/姓名|^name$/),
      numberCol: find(/学号|考号|^id$|number/),
      totalCol: find(/总分|合计|total/),
      absentCol,
      questionCols
    };
  }
  function ImportDialog({ ctx, examId: givenExam, classId: givenClass, onClose }) {
    const [step, setStep] = useState(0);
    const [examId, setExamId] = useState(givenExam || ctx.data.exams[0]?.id || "");
    const [classId, setClassId] = useState(givenClass || ctx.data.classes[0]?.id || "");
    const [draft, setDraft] = useState(null);
    const [mapping, setMapping] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [drop, setDrop] = useState(false);
    const [filter, setFilter] = useState("issues");
    const [done3, setDone] = useState(null);
    const exam = ctx.data.exams.find((e) => e.id === examId);
    const cls = ctx.data.classes.find((c) => c.id === classId);
    const roster = ctx.data.students.filter((s) => s.classId === classId);
    const template = () => {
      const head = [tx("\u5B66\u53F7"), tx("\u59D3\u540D"), tx("\u7F3A\u8003"), ...exam.questions.map((q) => q.label), tx("\u603B\u5206")];
      const rows2 = [...roster].sort((a, b) => (a.studentNo || "~").localeCompare(b.studentNo || "~")).map((s) => [s.studentNo || "", s.name]);
      download(xlsx([head, ...rows2], tx("\u6210\u7EE9")), `${cls.name}-${exam.name}.xlsx`);
    };
    const choose = async (file) => {
      if (!file) return;
      setBusy(true);
      setError("");
      try {
        const stored = await api2.upload(file);
        const created = await api2.post("/imports", { examId, classId, fileId: stored.id });
        setDraft(created);
        setMapping(guess(created.workbook.sheets[0], exam));
        setStep(1);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    };
    const build = async () => {
      setBusy(true);
      setError("");
      try {
        const next = await api2.put(`/imports/${draft.id}`, { baseVersion: draft.version, mapping, rows: null });
        setDraft(next);
        setFilter(next.summary.errors || next.summary.warnings ? "issues" : "all");
        setStep(2);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    };
    const queue = useRef(Promise.resolve());
    const edit = (row, change) => {
      const patch = change.scores ? { ...change, scores: { ...row.scores, ...change.scores } } : change;
      const body2 = { sourceRow: row.sourceRow, studentId: row.studentId, status: row.status, total: row.total, scores: row.scores, ignored: row.ignored, ...patch };
      setDraft((d) => ({ ...d, rows: d.rows.map((r) => r.sourceRow === row.sourceRow ? { ...r, ...patch } : r) }));
      queue.current = queue.current.then(async () => {
        try {
          const latest = await api2.get(`/imports/${draft.id}`);
          const next = await api2.put(`/imports/${draft.id}`, { baseVersion: latest.version, rows: [body2] });
          setDraft(next);
        } catch (err) {
          setError(err.message);
        }
      });
    };
    const confirm = async () => {
      setBusy(true);
      setError("");
      try {
        await queue.current;
        const latest = await api2.get(`/imports/${draft.id}`);
        await api2.post(`/imports/${draft.id}/confirmation`, { baseVersion: latest.version });
        await ctx.reload();
        setDone({ present: latest.rows.filter((r) => !r.ignored && r.studentId && r.status === "present").length, absent: latest.rows.filter((r) => !r.ignored && r.studentId && r.status === "absent").length, unrecorded: latest.unrecorded.length });
        setStep(3);
      } catch (err) {
        setError(err.problem?.errors ? tx("\u8FD8\u6709 {{n}} \u5904\u9700\u8981\u5904\u7406", { n: err.problem.errors.length }) : err.message);
        const latest = await api2.get(`/imports/${draft.id}`).catch(() => null);
        if (latest) setDraft(latest);
      } finally {
        setBusy(false);
      }
    };
    const sheet = draft && mapping && draft.workbook.sheets[mapping.sheet];
    const width = sheet ? Math.max(0, ...sheet.rows.map((r) => r?.length || 0)) : 0;
    const header = sheet && (sheet.rows[(mapping.headerRow || 1) - 1] || []);
    const columns = Array.from({ length: width }, (_, i) => [i + 1, `${letter(i + 1)}${header?.[i]?.text ? ` \xB7 ${header[i].text}` : ""}`]);
    const ColSelect = ({ value, onChange, label, optional }) => /* @__PURE__ */ h(Field, { label, hint: optional ? tx("\u9009\u586B") : null }, /* @__PURE__ */ h("select", { value: value ?? "", onChange: (e) => onChange(e.target.value ? Number(e.target.value) : null) }, /* @__PURE__ */ h("option", { value: "" }, optional ? tx("\u6CA1\u6709\u8FD9\u4E00\u5217") : tx("\u9009\u62E9\u4E00\u5217")), columns.map(([n, text]) => /* @__PURE__ */ h("option", { key: n, value: n }, text))));
    const mappedCols = /* @__PURE__ */ new Map();
    if (mapping) {
      if (mapping.nameCol) mappedCols.set(mapping.nameCol, tx("\u59D3\u540D"));
      if (mapping.numberCol) mappedCols.set(mapping.numberCol, tx("\u5B66\u53F7"));
      if (mapping.totalCol) mappedCols.set(mapping.totalCol, tx("\u603B\u5206"));
      if (mapping.absentCol) mappedCols.set(mapping.absentCol, tx("\u7F3A\u8003"));
      for (const q of exam?.questions || []) if (mapping.questionCols[q.id]) mappedCols.set(mapping.questionCols[q.id], q.label);
    }
    const rows = draft?.rows || [];
    const errorsOf = (r) => (r.issues || []).filter((i) => i.level === "error");
    const shownRows = rows.filter((r) => filter === "all" || filter === "issues" && (r.issues || []).length || filter === "ignored" && r.ignored);
    const unrecorded = (draft?.unrecorded || []).map((id) => roster.find((s) => s.id === id)).filter(Boolean);
    let body, footer;
    if (step === 0) {
      body = /* @__PURE__ */ h("div", { className: "cr-import-start" }, /* @__PURE__ */ h("div", { className: "cr-form-row" }, /* @__PURE__ */ h(Field, { label: tx("\u8003\u8BD5") }, /* @__PURE__ */ h("select", { value: examId, onChange: (e) => setExamId(e.target.value), disabled: Boolean(givenExam) }, ctx.data.exams.map((e) => /* @__PURE__ */ h("option", { key: e.id, value: e.id }, e.name)))), /* @__PURE__ */ h(Field, { label: tx("\u54EA\u4E2A\u73ED") }, /* @__PURE__ */ h("select", { value: classId, onChange: (e) => setClassId(e.target.value), disabled: Boolean(givenClass) }, ctx.data.classes.map((c) => /* @__PURE__ */ h("option", { key: c.id, value: c.id }, c.name))))), !exam ? /* @__PURE__ */ h("p", { className: "cr-note" }, /* @__PURE__ */ h(Icon6, { name: "info", size: 14, stroke: 2 }), tx("\u5148\u65B0\u5EFA\u4E00\u573A\u8003\u8BD5\uFF0C\u5199\u597D\u6BCF\u9053\u8BA1\u5206\u9898\u7684\u6EE1\u5206\u3002")) : /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(
        "label",
        {
          className: cx("cr-drop", drop && "is-over", busy && "is-busy"),
          onDragOver: (e) => {
            e.preventDefault();
            setDrop(true);
          },
          onDragLeave: () => setDrop(false),
          onDrop: (e) => {
            e.preventDefault();
            setDrop(false);
            choose(e.dataTransfer.files[0]);
          }
        },
        /* @__PURE__ */ h("span", { className: "cr-drop-icon" }, busy ? /* @__PURE__ */ h(Spinner, null) : /* @__PURE__ */ h(Icon6, { name: "upload", size: 22, stroke: 2 })),
        /* @__PURE__ */ h("strong", null, busy ? tx("\u6B63\u5728\u8BFB\u53D6\u8868\u683C\u2026") : tx("\u628A\u6210\u7EE9\u8868\u62D6\u5230\u8FD9\u91CC\uFF0C\u6216\u70B9\u4E00\u4E0B\u9009\u62E9")),
        /* @__PURE__ */ h("small", null, tx("Excel\uFF08.xlsx\uFF09\uFF0C\u6700\u5927 10 MB\u3002\u6709\u9010\u9898\u5F97\u5206\u5C31\u4E00\u8D77\u5BFC\u5165\uFF1B\u53EA\u6709\u603B\u5206\u4E5F\u53EF\u4EE5\u3002")),
        /* @__PURE__ */ h("input", { type: "file", hidden: true, accept: ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel", disabled: busy || !classId, onChange: (e) => {
          choose(e.target.files[0]);
          e.target.value = "";
        } })
      ), roster.length > 0 && /* @__PURE__ */ h("button", { type: "button", className: "cr-link", onClick: template }, /* @__PURE__ */ h(Icon6, { name: "arrowDown", size: 13, stroke: 2.2 }), tx("\u6CA1\u6709\u73B0\u6210\u7684\u8868\uFF1F\u4E0B\u8F7D\u4E00\u4EFD\u5E26{{cls}}\u540D\u5355\u7684\u6A21\u677F", { cls: cls?.name }))));
      footer = /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: onClose }, tx("\u53D6\u6D88")));
    } else if (step === 1) {
      body = /* @__PURE__ */ h("div", { className: "cr-import-map" }, /* @__PURE__ */ h("div", { className: "cr-import-file" }, /* @__PURE__ */ h(Icon6, { name: "file", size: 16, stroke: 2 }), /* @__PURE__ */ h("strong", null, draft.fileName), /* @__PURE__ */ h("small", null, tx("{{n}} \u4E2A\u5DE5\u4F5C\u8868", { n: draft.workbook.sheets.length }))), draft.workbook.sheets.length > 1 && /* @__PURE__ */ h(Seg, { label: tx("\u5DE5\u4F5C\u8868"), value: String(mapping.sheet), onChange: (v) => setMapping(guess(draft.workbook.sheets[Number(v)], exam) && { ...guess(draft.workbook.sheets[Number(v)], exam), sheet: Number(v) }), options: draft.workbook.sheets.map((s, i) => [String(i), s.name]) }), /* @__PURE__ */ h("div", { className: "cr-form-row is-3" }, /* @__PURE__ */ h(Field, { label: tx("\u8868\u5934\u5728\u7B2C\u51E0\u884C") }, /* @__PURE__ */ h("input", { inputMode: "numeric", value: mapping.headerRow ?? "", onChange: (e) => setMapping({ ...mapping, headerRow: Number(e.target.value) || null }) })), /* @__PURE__ */ h(Field, { label: tx("\u4ECE\u7B2C\u51E0\u884C\u5F00\u59CB") }, /* @__PURE__ */ h("input", { inputMode: "numeric", value: mapping.firstRow, onChange: (e) => setMapping({ ...mapping, firstRow: Math.max(1, Number(e.target.value) || 1) }) })), /* @__PURE__ */ h(Field, { label: tx("\u5230\u7B2C\u51E0\u884C") }, /* @__PURE__ */ h("input", { inputMode: "numeric", value: mapping.lastRow ?? "", onChange: (e) => setMapping({ ...mapping, lastRow: Number(e.target.value) || null }) }))), /* @__PURE__ */ h("div", { className: "cr-form-row is-4" }, /* @__PURE__ */ h(ColSelect, { label: tx("\u59D3\u540D"), value: mapping.nameCol, onChange: (v) => setMapping({ ...mapping, nameCol: v }) }), /* @__PURE__ */ h(ColSelect, { label: tx("\u5B66\u53F7"), optional: true, value: mapping.numberCol, onChange: (v) => setMapping({ ...mapping, numberCol: v }) }), /* @__PURE__ */ h(ColSelect, { label: tx("\u603B\u5206"), value: mapping.totalCol, onChange: (v) => setMapping({ ...mapping, totalCol: v }) }), /* @__PURE__ */ h(ColSelect, { label: tx("\u7F3A\u8003"), optional: true, value: mapping.absentCol, onChange: (v) => setMapping({ ...mapping, absentCol: v }) })), /* @__PURE__ */ h("details", { className: "cr-import-questions", open: Object.keys(mapping.questionCols).length > 0 && Object.keys(mapping.questionCols).length < exam.questions.length }, /* @__PURE__ */ h("summary", null, tx("\u9010\u9898\u5F97\u5206\uFF1A\u5DF2\u5BF9\u5E94 {{a}} / {{b}} \u9898", { a: Object.keys(mapping.questionCols).length, b: exam.questions.length })), /* @__PURE__ */ h("div", { className: "cr-form-row is-6" }, exam.questions.map((q) => /* @__PURE__ */ h(ColSelect, { key: q.id, optional: true, label: q.group ? `${q.group} ${q.label}` : q.label, value: mapping.questionCols[q.id], onChange: (v) => {
        const qc = { ...mapping.questionCols };
        if (v) qc[q.id] = v;
        else delete qc[q.id];
        setMapping({ ...mapping, questionCols: qc });
      } })))), /* @__PURE__ */ h("div", { className: "cr-sheet-preview" }, /* @__PURE__ */ h("table", null, /* @__PURE__ */ h("thead", null, /* @__PURE__ */ h("tr", null, /* @__PURE__ */ h("th", null), columns.map(([n]) => /* @__PURE__ */ h("th", { key: n, className: cx(mappedCols.has(n) && "is-mapped") }, mappedCols.get(n) || letter(n))))), /* @__PURE__ */ h("tbody", null, sheet.rows.slice(0, 12).map((r, i) => /* @__PURE__ */ h("tr", { key: i, className: cx(i + 1 === mapping.headerRow && "is-header", i + 1 >= mapping.firstRow && (!mapping.lastRow || i + 1 <= mapping.lastRow) && "is-data") }, /* @__PURE__ */ h("th", null, i + 1), columns.map(([n]) => /* @__PURE__ */ h("td", { key: n, className: cx(mappedCols.has(n) && "is-mapped", r?.[n - 1]?.kind === "error" && "is-error") }, r?.[n - 1]?.text ?? ""))))))), /* @__PURE__ */ h("p", { className: "cr-muted" }, tx("\u7A7A\u767D\u662F\u7F3A\u5931\uFF0C0 \u5C31\u662F 0\uFF1B\u516C\u5F0F\u53EA\u7528\u8868\u91CC\u5DF2\u6709\u7684\u7ED3\u679C\u3002")));
      footer = /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: () => setStep(0) }, tx("\u6362\u4E00\u4E2A\u6587\u4EF6")), /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", disabled: busy || !mapping.nameCol && !mapping.numberCol, onClick: build }, busy ? /* @__PURE__ */ h(Spinner, { small: true }) : null, tx("\u751F\u6210\u6821\u5BF9\u8868")));
    } else if (step === 2) {
      const s = draft.summary || {};
      body = /* @__PURE__ */ h("div", { className: "cr-review" }, /* @__PURE__ */ h("div", { className: "cr-review-summary" }, /* @__PURE__ */ h("span", { className: "cr-pill" }, tx("{{n}} \u884C", { n: s.rows })), /* @__PURE__ */ h("span", { className: cx("cr-pill", s.errors ? "is-error" : "is-ok") }, s.errors ? tx("{{n}} \u5904\u9700\u8981\u5904\u7406", { n: s.errors }) : tx("\u6CA1\u6709\u9700\u8981\u5904\u7406\u7684\u95EE\u9898")), s.warnings > 0 && /* @__PURE__ */ h("span", { className: "cr-pill is-warn" }, tx("{{n}} \u4E2A\u63D0\u9192", { n: s.warnings })), s.ignored > 0 && /* @__PURE__ */ h("span", { className: "cr-pill" }, tx("\u5FFD\u7565 {{n}} \u884C", { n: s.ignored })), /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h(Seg, { label: tx("\u663E\u793A"), value: filter, onChange: setFilter, options: [["issues", tx("\u9700\u8981\u770B\u7684")], ["all", tx("\u5168\u90E8")], ["ignored", tx("\u5DF2\u5FFD\u7565")]] })), /* @__PURE__ */ h("div", { className: "cr-review-table" }, /* @__PURE__ */ h("div", { className: "cr-review-row is-head" }, /* @__PURE__ */ h("span", null, tx("\u884C")), /* @__PURE__ */ h("span", null, tx("\u8868\u4E2D")), /* @__PURE__ */ h("span", null, tx("\u5BF9\u5E94\u5B66\u751F")), /* @__PURE__ */ h("span", null, tx("\u72B6\u6001")), /* @__PURE__ */ h("span", null, tx("\u603B\u5206")), /* @__PURE__ */ h("span", null)), !shownRows.length && /* @__PURE__ */ h("p", { className: "cr-muted cr-pad" }, filter === "issues" ? tx("\u6BCF\u4E00\u884C\u90FD\u5BF9\u4E0A\u4E86\u3002") : tx("\u6CA1\u6709\u8FD9\u6837\u7684\u884C\u3002")), shownRows.map((r) => {
        const errs = errorsOf(r);
        return /* @__PURE__ */ h("div", { key: r.sourceRow, className: cx("cr-review-row", r.ignored && "is-ignored", errs.length && "has-error") }, /* @__PURE__ */ h("span", { className: "cr-review-num" }, r.sourceRow), /* @__PURE__ */ h("span", { className: "cr-review-src" }, /* @__PURE__ */ h("b", null, r.source.name || "\u2014"), /* @__PURE__ */ h("small", null, r.source.studentNo)), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("select", { "aria-label": tx("\u5BF9\u5E94\u5B66\u751F"), value: r.studentId || "", disabled: r.ignored, onChange: (e) => edit(r, { studentId: e.target.value || null }) }, /* @__PURE__ */ h("option", { value: "" }, tx("\u9009\u62E9\u5B66\u751F")), roster.map((st) => /* @__PURE__ */ h("option", { key: st.id, value: st.id }, st.name, st.studentNo ? ` \xB7 ${st.studentNo}` : "")))), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("button", { type: "button", className: cx("cr-status", r.status === "absent" && "is-absent"), disabled: r.ignored, onClick: () => edit(r, { status: r.status === "absent" ? "present" : "absent" }) }, r.status === "absent" ? tx("\u7F3A\u8003") : tx("\u53C2\u52A0"))), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("input", { "aria-label": tx("\u603B\u5206"), inputMode: "decimal", defaultValue: r.total ?? "", key: `${r.sourceRow}:${r.total}:${r.status}`, disabled: r.ignored || r.status === "absent", onBlur: (e) => {
          const v = e.target.value.trim();
          if (String(r.total ?? "") !== v) edit(r, { total: v === "" ? null : Number(v) });
        } })), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-small is-quiet", onClick: () => edit(r, { ignored: !r.ignored }) }, r.ignored ? tx("\u6062\u590D") : tx("\u5FFD\u7565"))), (r.issues || []).length > 0 && /* @__PURE__ */ h("ul", { className: "cr-issues" }, r.issues.map((i, k) => /* @__PURE__ */ h("li", { key: k, className: `is-${i.level}` }, /* @__PURE__ */ h(Icon6, { name: "info", size: 12, stroke: 2.2 }), i.template ? tx(i.template, i.params) : i.message, i.code === "out-of-range" && i.field && i.field !== "total" && /* @__PURE__ */ h("input", { className: "cr-fix", "aria-label": tx("\u6539\u6210"), inputMode: "decimal", defaultValue: r.scores?.[i.field] ?? "", placeholder: tx("\u6539\u6210"), onKeyDown: (e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }, onBlur: (e) => {
          const v = e.target.value.trim();
          if (String(r.scores?.[i.field] ?? "") !== v) edit(r, { scores: { [i.field]: v === "" ? null : Number(v) } });
        } }), i.code === "name-number-conflict" && r.studentId && /* @__PURE__ */ h("button", { type: "button", className: "cr-link", onClick: () => edit(r, { studentId: r.studentId }) }, tx("\u5C31\u662F {{name}}", { name: roster.find((st) => st.id === r.studentId)?.name }))))));
      })), unrecorded.length > 0 && /* @__PURE__ */ h("div", { className: "cr-unrecorded" }, /* @__PURE__ */ h("strong", null, tx("\u8868\u91CC\u6CA1\u6709\u7684\u5B66\u751F \xB7 {{n}} \u4EBA", { n: unrecorded.length })), /* @__PURE__ */ h("p", { className: "cr-muted" }, tx("\u4ED6\u4EEC\u4F1A\u8BB0\u4E3A\u201C\u672A\u8BB0\u5F55\u201D\uFF0C\u4E0D\u8BA1\u5206\uFF0C\u4E5F\u4E0D\u7B97\u7F3A\u8003\u3002")), /* @__PURE__ */ h("div", null, unrecorded.map((st) => /* @__PURE__ */ h("span", { key: st.id, className: "cr-chip-student is-static" }, /* @__PURE__ */ h(Avatar, { name: st.name, id: st.id, size: "sm" }), /* @__PURE__ */ h("span", null, st.name))))));
      footer = /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: () => setStep(1) }, tx("\u91CD\u65B0\u5BF9\u5E94\u5217")), /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", disabled: busy || (draft.summary?.errors ?? 0) > 0, onClick: confirm }, busy ? /* @__PURE__ */ h(Spinner, { small: true }) : /* @__PURE__ */ h(Icon6, { name: "check", size: 14, stroke: 2.4 }), tx("\u786E\u8BA4\u5165\u5E93")));
    } else {
      body = /* @__PURE__ */ h("div", { className: "cr-import-done" }, /* @__PURE__ */ h("span", { className: "cr-done-mark" }, /* @__PURE__ */ h(Icon6, { name: "check", size: 30, stroke: 2.6 })), /* @__PURE__ */ h("h3", null, tx("\u6210\u7EE9\u5DF2\u4FDD\u5B58")), /* @__PURE__ */ h("p", null, tx("{{cls}} \xB7 {{exam}}\uFF1A{{a}} \u4EBA\u53C2\u52A0\uFF0C{{b}} \u4EBA\u7F3A\u8003\uFF0C{{c}} \u4EBA\u672A\u8BB0\u5F55\u3002", { cls: cls.name, exam: exam.name, a: done3.present, b: done3.absent, c: done3.unrecorded })), /* @__PURE__ */ h("p", { className: "cr-muted" }, tx("\u539F\u8868\u548C\u6821\u5BF9\u7ED3\u679C\u90FD\u7559\u7740\uFF1B\u4E4B\u540E\u53D1\u73B0\u9519\u4E86\uFF0C\u53EF\u4EE5\u5728\u5B66\u751F\u7684\u6210\u7EE9\u91CC\u4FEE\u6B63\u3002")));
      footer = /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", { className: "cr-grow" }), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: onClose }, tx("\u5B8C\u6210")), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", onClick: () => {
        ctx.go({ view: "class", classId, tab: "scores", studentId: null });
        onClose();
      } }, tx("\u770B\u770B\u6210\u7EE9")));
    }
    return /* @__PURE__ */ h(Dialog, { wide: true, className: "cr-import", title: tx("\u5BFC\u5165\u6210\u7EE9"), subtitle: exam && cls ? `${exam.name} \xB7 ${cls.name}` : null, onClose, footer: /* @__PURE__ */ h(Fragment, null, error && /* @__PURE__ */ h("span", { className: "cr-error is-inline" }, error), footer) }, step < 3 && /* @__PURE__ */ h("ol", { className: "cr-steps" }, STEPS.map((label, i) => /* @__PURE__ */ h("li", { key: label, className: cx(i === step && "is-current", i < step && "is-done") }, /* @__PURE__ */ h("span", null, i < step ? /* @__PURE__ */ h(Icon6, { name: "check", size: 11, stroke: 3 }) : i + 1), tx(label)))), /* @__PURE__ */ h("div", { className: "cr-step", key: step }, body));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/Archive.jsx
  function Archive({ ctx }) {
    const [items, setItems] = useState(null);
    const load = async () => {
      const [c, s, e, r] = await Promise.all(["classes", "students", "exams", "records"].map((n) => api2.get(`/${n}`, { state: "deleted" })));
      const recordStudents = new Map([...ctx.data.students, ...s.items].map((student) => [student.id, student]));
      const missing = [...new Set(r.items.filter((record) => record.subject.kind === "student" && !recordStudents.has(record.subject.id)).map((record) => record.subject.id))];
      const parents = await Promise.all(missing.map((id) => api2.get(`/students/${id}`)));
      for (const student of parents) recordStudents.set(student.id, student);
      setItems({ classes: c.items, students: s.items, exams: e.items, records: r.items, recordStudents });
    };
    useEffect(() => {
      load().catch(() => setItems({ classes: [], students: [], exams: [], records: [] }));
    }, []);
    const restore = async (collection, item) => {
      try {
        await api2.remove(collection, item, false);
        await Promise.all([load(), ctx.reload()]);
        ctx.toast(tx("\u5DF2\u6062\u590D"));
      } catch (err) {
        ctx.toast(err.message, "error");
      }
    };
    const className = (id) => ctx.data.classes.find((c) => c.id === id)?.name || items?.classes.find((c) => c.id === id)?.name || "";
    const restoreReason = (collection, item) => {
      const student = collection === "students" ? item : collection === "records" && item.subject.kind === "student" ? items.recordStudents.get(item.subject.id) : null;
      const classId = student?.classId || (collection === "records" && item.subject.kind === "class" ? item.subject.id : null);
      if (classId && items.classes.some((cls) => cls.id === classId)) return tx("\u8BF7\u5148\u6062\u590D\u6240\u5C5E\u73ED\u7EA7");
      if (collection === "records" && student?.deletedAt) return tx("\u8BF7\u5148\u6062\u590D\u6240\u5C5E\u5B66\u751F");
      return "";
    };
    const empty = items && !items.classes.length && !items.students.length && !items.exams.length && !items.records.length;
    const section = (title, collection, list, render) => list.length > 0 && /* @__PURE__ */ h("section", { className: "cr-panel" }, /* @__PURE__ */ h("div", { className: "cr-panel-head" }, /* @__PURE__ */ h("h3", null, title), /* @__PURE__ */ h("span", { className: "cr-muted" }, list.length)), /* @__PURE__ */ h("ul", { className: "cr-archive" }, list.map((item) => /* @__PURE__ */ h("li", { key: item.id }, render(item), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-small", disabled: Boolean(restoreReason(collection, item)), onClick: () => restore(collection, item) }, /* @__PURE__ */ h(Icon6, { name: "restore", size: 13, stroke: 2 }), tx("\u6062\u590D"))))));
    return /* @__PURE__ */ h("div", { className: "cr-page" }, /* @__PURE__ */ h("header", { className: "cr-head" }, /* @__PURE__ */ h("div", { className: "cr-head-title is-plain" }, /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h2", null, tx("\u5DF2\u5F52\u6863")), /* @__PURE__ */ h("span", null, tx("\u5F52\u6863\u7684\u5185\u5BB9\u90FD\u5728\u8FD9\u91CC\uFF0C\u5173\u7CFB\u548C\u5386\u53F2\u6210\u7EE9\u539F\u6837\u4FDD\u7559\u3002"))))), /* @__PURE__ */ h("div", { className: "cr-page-scroll" }, !items ? /* @__PURE__ */ h("div", { className: "cr-loading is-inline" }, /* @__PURE__ */ h(Spinner, null)) : empty ? /* @__PURE__ */ h(Empty, { icon: "trash", title: tx("\u6CA1\u6709\u5F52\u6863\u7684\u5185\u5BB9"), text: tx("\u5F52\u6863\u7684\u73ED\u7EA7\u3001\u5B66\u751F\u3001\u8003\u8BD5\u548C\u8BB0\u5F55\u4F1A\u653E\u5728\u8FD9\u91CC\uFF0C\u968F\u65F6\u53EF\u4EE5\u6062\u590D\u3002") }) : /* @__PURE__ */ h(Fragment, null, section(tx("\u73ED\u7EA7"), "classes", items.classes, (c) => /* @__PURE__ */ h("span", { className: "cr-archive-text" }, /* @__PURE__ */ h("strong", null, c.name), /* @__PURE__ */ h("small", null, c.term))), section(tx("\u5B66\u751F"), "students", items.students, (s) => /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h(Avatar, { name: s.name, id: s.id, size: "sm" }), /* @__PURE__ */ h("span", { className: "cr-archive-text" }, /* @__PURE__ */ h("strong", null, s.name), /* @__PURE__ */ h("small", null, className(s.classId)), restoreReason("students", s) && /* @__PURE__ */ h("small", null, restoreReason("students", s))))), section(tx("\u8003\u8BD5"), "exams", items.exams, (e) => /* @__PURE__ */ h("span", { className: "cr-archive-text" }, /* @__PURE__ */ h("strong", null, e.name), /* @__PURE__ */ h("small", null, longDate(e.date)))), section(tx("\u8BB0\u5F55"), "records", items.records, (r) => /* @__PURE__ */ h("span", { className: "cr-archive-text" }, /* @__PURE__ */ h("strong", { className: "is-clamp" }, r.body), /* @__PURE__ */ h("small", null, longDate(r.date)), restoreReason("records", r) && /* @__PURE__ */ h("small", null, restoreReason("records", r)))))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/classroom/ClassroomPage.jsx
  var memory = { view: "class", tab: "seats" };
  function useData() {
    const [data, setData] = useState({ classes: [], students: [], exams: [], tags: [], loaded: false, error: null });
    const load = useCallback(async () => {
      try {
        const [c, s, e, t2] = await Promise.all([api2.get("/classes"), api2.get("/students"), api2.get("/exams"), api2.get("/tags")]);
        setData({ classes: c.items, students: s.items, exams: e.items, tags: t2.items.filter((x) => !x.mergedInto), loaded: true, error: null });
      } catch (error) {
        setData((d) => ({ ...d, loaded: true, error }));
      }
    }, []);
    useEffect(() => {
      load();
    }, []);
    return [data, load];
  }
  function ClassForm({ initial, onClose, onSaved }) {
    const [name, setName] = useState(initial?.name ?? "");
    const [term, setTerm] = useState(initial?.term ?? "");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const save = async (e) => {
      e?.preventDefault();
      setBusy(true);
      setError("");
      try {
        const saved = initial ? await api2.put(`/classes/${initial.id}`, { baseVersion: initial.version, name, term }) : await api2.post("/classes", { name, term });
        onSaved(saved);
        onClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    };
    return /* @__PURE__ */ h(
      Dialog,
      {
        title: initial ? tx("\u73ED\u7EA7\u4FE1\u606F") : tx("\u65B0\u5EFA\u73ED\u7EA7"),
        subtitle: initial ? null : tx("\u5EFA\u597D\u540E\uFF0C\u628A\u5B66\u751F\u52A0\u8FDB\u6765\uFF0C\u518D\u6392\u4E00\u6392\u5EA7\u4F4D\u3002"),
        onClose,
        footer: /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: onClose }, tx("\u53D6\u6D88")), /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary", disabled: busy || !name.trim(), onClick: save }, initial ? tx("\u4FDD\u5B58") : tx("\u521B\u5EFA\u73ED\u7EA7")))
      },
      /* @__PURE__ */ h("form", { className: "cr-form", onSubmit: save }, /* @__PURE__ */ h(Field, { label: tx("\u73ED\u7EA7\u540D\u79F0") }, /* @__PURE__ */ h("input", { value: name, maxLength: 60, placeholder: tx("\u4F8B\u5982\uFF1A\u521D\u4E09\uFF082\uFF09\u73ED"), onChange: (e) => setName(e.target.value) })), /* @__PURE__ */ h(Field, { label: tx("\u5B66\u671F"), hint: tx("\u9009\u586B") }, /* @__PURE__ */ h("input", { value: term, maxLength: 60, placeholder: tx("\u4F8B\u5982\uFF1A2026 \u79CB\u5B63\u5B66\u671F"), onChange: (e) => setTerm(e.target.value) })), error && /* @__PURE__ */ h("p", { className: "cr-error" }, error))
    );
  }
  function ClassroomPage() {
    useLocale();
    const [data, reload] = useData();
    const [scene, setScene] = useState(memory);
    const [dialog, setDialog] = useState(null);
    const [toastNode, toast] = useToast();
    const go = (patch) => setScene((s) => {
      const next = { ...s, ...patch };
      memory = next;
      return next;
    });
    const open = (name, props = {}) => setDialog({ name, props });
    const close = () => setDialog(null);
    const classes = data.classes;
    const current = classes.find((c) => c.id === scene.classId) || (scene.view === "class" ? classes[0] : null);
    useEffect(() => {
      if (data.loaded && scene.view === "class" && current && current.id !== scene.classId) go({ classId: current.id });
    }, [data.loaded, current?.id]);
    const roster = (classId) => data.students.filter((s) => s.classId === classId);
    const ctx = { data, reload, toast, go, open, close, scene };
    const student = scene.studentId && data.students.find((s) => s.id === scene.studentId);
    const exam = scene.examId && data.exams.find((e) => e.id === scene.examId);
    let main;
    if (!data.loaded) main = /* @__PURE__ */ h("div", { className: "cr-loading" }, /* @__PURE__ */ h("span", { className: "tbx-spinner" }));
    else if (data.error) main = /* @__PURE__ */ h(Empty, { icon: "info", title: tx("\u73ED\u7EA7\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6"), text: data.error.message }, /* @__PURE__ */ h("button", { type: "button", className: "cr-btn", onClick: reload }, tx("\u91CD\u65B0\u52A0\u8F7D")));
    else if (scene.view === "exams") main = exam ? /* @__PURE__ */ h(ExamDetail, { key: exam.id, ctx, exam }) : /* @__PURE__ */ h(ExamList, { ctx });
    else if (scene.view === "tags") main = /* @__PURE__ */ h(TagManager, { ctx });
    else if (scene.view === "archive") main = /* @__PURE__ */ h(Archive, { ctx });
    else if (!current) {
      main = /* @__PURE__ */ h(
        Empty,
        {
          art: /* @__PURE__ */ h(ClassArt, null),
          title: tx("\u628A\u4F60\u6559\u7684\u73ED\u7EA7\u653E\u5728\u8FD9\u91CC"),
          text: tx("\u8BB0\u4F4F\u73ED\u91CC\u7684\u6BCF\u4E2A\u4EBA\uFF1A\u4ED6\u4EEC\u7684\u5EA7\u4F4D\u3001\u8BF4\u8FC7\u7684\u8BDD\u3001\u6BCF\u6B21\u8003\u8BD5\u7684\u6837\u5B50\u3002\u8BFE\u540E\u6574\u7406\u3001\u56DE\u987E\u548C\u601D\u8003\uFF0C\u90FD\u4ECE\u8FD9\u91CC\u5F00\u59CB\u3002")
        },
        /* @__PURE__ */ h("button", { type: "button", className: "cr-btn is-primary is-big", onClick: () => open("class") }, /* @__PURE__ */ h(Icon6, { name: "plus", size: 16, stroke: 2.2 }), tx("\u65B0\u5EFA\u73ED\u7EA7"))
      );
    } else if (student && student.classId === current.id) {
      main = /* @__PURE__ */ h(StudentDetail, { key: student.id, ctx, student, cls: current });
    } else {
      const kids = roster(current.id);
      const tab = scene.tab || "seats";
      main = /* @__PURE__ */ h("div", { className: "cr-class", key: current.id }, /* @__PURE__ */ h("header", { className: "cr-head" }, /* @__PURE__ */ h("div", { className: "cr-head-title" }, /* @__PURE__ */ h("span", { className: cx("cr-class-badge", `is-${hueOf2(current.id)}`) }, classMark(current.name)), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h2", null, current.name), /* @__PURE__ */ h("span", null, [current.term, tx("{{n}} \u540D\u5B66\u751F", { n: kids.length, count: kids.length })].filter(Boolean).join(" \xB7 ")))), /* @__PURE__ */ h(
        Seg,
        {
          className: "cr-tabs",
          label: tx("\u73ED\u7EA7\u89C6\u56FE"),
          value: tab,
          onChange: (t2) => go({ tab: t2 }),
          options: [["seats", tx("\u5EA7\u4F4D"), "grid"], ["students", tx("\u5B66\u751F"), "students"], ["scores", tx("\u6210\u7EE9"), "graph"], ["records", tx("\u8BB0\u5F55"), "pencil"]]
        }
      ), /* @__PURE__ */ h(
        Menu,
        {
          label: tx("\u73ED\u7EA7\u64CD\u4F5C"),
          items: [
            { label: tx("\u73ED\u7EA7\u4FE1\u606F"), icon: "pencil", onClick: () => open("class", { initial: current }) },
            { label: tx("\u5BFC\u5165\u6210\u7EE9"), icon: "upload", onClick: () => open("import", { classId: current.id }) },
            "-",
            { label: tx("\u5F52\u6863\u73ED\u7EA7"), icon: "trash", danger: true, onClick: () => open("confirm", {
              title: tx("\u5F52\u6863\u201C{{name}}\u201D\uFF1F", { name: current.name }),
              message: tx("\u73ED\u7EA7\u4F1A\u79FB\u5230\u201C\u5DF2\u5F52\u6863\u201D\uFF0C\u5B66\u751F\u3001\u8BB0\u5F55\u548C\u6210\u7EE9\u90FD\u539F\u6837\u4FDD\u7559\uFF0C\u968F\u65F6\u53EF\u4EE5\u6062\u590D\u3002"),
              confirmLabel: tx("\u5F52\u6863"),
              onConfirm: async () => {
                await api2.remove("classes", current);
                go({ classId: null });
                await reload();
                toast(tx("\u5DF2\u5F52\u6863"));
              }
            }) }
          ]
        }
      )), /* @__PURE__ */ h("div", { className: "cr-view", key: tab, "data-tab": tab }, tab === "seats" && /* @__PURE__ */ h(Seating, { ctx, cls: current, students: kids }), tab === "students" && /* @__PURE__ */ h(Roster, { ctx, cls: current, students: kids }), tab === "scores" && /* @__PURE__ */ h(ClassScores, { ctx, cls: current, students: kids }), tab === "records" && /* @__PURE__ */ h(Journal, { ctx, subject: { kind: "class", id: current.id }, placeholder: tx("\u4ECA\u5929\u8BB2\u5230\u54EA\u91CC\u4E86\uFF1F\u6709\u4EC0\u4E48\u5171\u540C\u7684\u95EE\u9898\u3001\u8BB2\u89E3\u7684\u6548\u679C\uFF0C\u6216\u4E0B\u4E00\u8282\u8BFE\u60F3\u505A\u7684\u4E8B\u2026\u2026") })));
    }
    const place = scene.view === "class" ? `class:${current?.id}` : scene.view;
    return /* @__PURE__ */ h("section", { className: "tbx-cr tbx-split" }, /* @__PURE__ */ h("div", { className: "cr-main" }, main), /* @__PURE__ */ h(
      Rail,
      {
        label: tx("\u73ED\u7EA7\u5BFC\u822A"),
        footer: /* @__PURE__ */ h(RailItem, { icon: "trash", label: tx("\u5DF2\u5F52\u6863"), current: place === "archive", onClick: () => go({ view: "archive" }) })
      },
      /* @__PURE__ */ h(
        RailSection,
        {
          title: tx("\u6211\u7684\u73ED\u7EA7"),
          count: classes.length || "",
          actions: /* @__PURE__ */ h(RailAction, { primary: true, icon: "plus", label: tx("\u65B0\u5EFA\u73ED\u7EA7"), onClick: () => open("class") })
        },
        classes.length === 0 && /* @__PURE__ */ h("p", { className: "tbx-rail-empty" }, tx("\u8FD8\u6CA1\u6709\u73ED\u7EA7")),
        classes.map((c) => /* @__PURE__ */ h(
          RailItem,
          {
            key: c.id,
            mark: /* @__PURE__ */ h("span", { className: cx("cr-place-dot", `is-${hueOf2(c.id)}`) }, classMark(c.name)),
            label: c.name,
            count: roster(c.id).length,
            current: place === `class:${c.id}`,
            onClick: () => go({ view: "class", classId: c.id, studentId: null })
          }
        ))
      ),
      /* @__PURE__ */ h(RailSection, { title: tx("\u8003\u8BD5\u4E0E\u6807\u7B7E") }, /* @__PURE__ */ h(RailItem, { icon: "file", label: tx("\u8003\u8BD5"), count: data.exams.length, current: place === "exams", onClick: () => go({ view: "exams", examId: null }) }), /* @__PURE__ */ h(RailItem, { icon: "tag", label: tx("\u9898\u76EE\u6807\u7B7E"), count: data.tags.length, current: place === "tags", onClick: () => go({ view: "tags" }) })),
      /* @__PURE__ */ h(RailHint, { tone: "green" }, tx("\u60F3\u77E5\u9053\u8C01\u6700\u8FD1\u8FDB\u6B65\u4E86\u3001\u54EA\u7C7B\u9898\u5931\u5206\u591A\uFF1F\u95EE\u95EE\u52A9\u7406\u3002"))
    ), dialog?.name === "class" && /* @__PURE__ */ h(ClassForm, { ...dialog.props, onClose: close, onSaved: async (c) => {
      await reload();
      go({ view: "class", classId: c.id, studentId: null });
      toast(dialog.props.initial ? tx("\u5DF2\u4FDD\u5B58") : tx("\u73ED\u7EA7\u5DF2\u521B\u5EFA"));
    } }), dialog?.name === "student" && /* @__PURE__ */ h(StudentForm, { ctx, ...dialog.props, onClose: close }), dialog?.name === "exam" && /* @__PURE__ */ h(ExamForm, { ctx, ...dialog.props, onClose: close }), dialog?.name === "import" && /* @__PURE__ */ h(ImportDialog, { ctx, ...dialog.props, onClose: close }), dialog?.name === "confirm" && /* @__PURE__ */ h(Confirm, { ...dialog.props, onClose: close }), toastNode);
  }
  function ClassArt() {
    return /* @__PURE__ */ h("div", { className: "cr-art", "aria-hidden": "true" }, /* @__PURE__ */ h("span", { className: "cr-art-board" }), Array.from({ length: 9 }, (_, i) => /* @__PURE__ */ h("span", { key: i, className: cx("cr-art-desk", `is-${["blue", "green", "orange", "purple", "pink", "teal", "indigo", "yellow", "blue"][i]}`), style: { "--i": i } })));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/settings/Settings.jsx
  var Icon7 = ({ name, size = 18, stroke = 1.8 }) => {
    const { Icon2: Icon22 } = tb();
    return /* @__PURE__ */ h(Icon22, { name, size, strokeWidth: stroke });
  };
  var MAX_EDGE = 2400;
  var MAX_CHARS = 3 * 1024 * 1024;
  async function encodeBackground(file) {
    const bitmap = await createImageBitmap(file);
    try {
      for (const [edge, quality] of [[MAX_EDGE, 0.86], [1920, 0.8], [1600, 0.74], [1280, 0.7]]) {
        const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg", quality);
        if (url.length <= MAX_CHARS) return url;
      }
      throw new Error("too-large");
    } finally {
      bitmap.close?.();
    }
  }
  function BackgroundChoices({ value, image, disabled, onChange, choices }) {
    useLocale();
    const input = useRef(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const custom = value === "custom" && image;
    async function choose(event) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) {
        setError(tx("\u8BF7\u9009\u62E9\u4E0D\u8D85\u8FC7 20 MB \u7684 JPG\u3001PNG \u6216 WebP \u56FE\u7247\u3002"));
        return;
      }
      setError("");
      setBusy(true);
      try {
        onChange({ background: "custom", backgroundImage: await encodeBackground(file) });
      } catch {
        setError(tx("\u8FD9\u5F20\u56FE\u7247\u8BFB\u4E0D\u51FA\u6765\uFF0C\u6362\u4E00\u5F20\u8BD5\u8BD5\u3002"));
      } finally {
        setBusy(false);
      }
    }
    return /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("div", { className: "settings-background-options tbx-bg-options", role: "group", "aria-label": tx("\u5185\u5BB9\u80CC\u666F") }, choices.map(([id, label]) => /* @__PURE__ */ h("button", { key: id, type: "button", disabled, "aria-label": label, "aria-pressed": value === id || id === "grid" && value === "custom" && !image, onClick: () => onChange({ background: id }) }, /* @__PURE__ */ h("span", { className: "settings-background-swatch", "data-pattern": id }), /* @__PURE__ */ h("span", null, label))), /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: cx("tbx-bg-custom", image && "has-image"),
        disabled: disabled || busy,
        "aria-pressed": Boolean(custom),
        "aria-label": image ? tx("\u81EA\u5B9A\u4E49\u80CC\u666F") : tx("\u4E0A\u4F20\u80CC\u666F\u56FE\u7247"),
        title: custom ? tx("\u70B9\u6309\u66F4\u6362\u56FE\u7247") : void 0,
        onClick: () => image && !custom ? onChange({ background: "custom" }) : input.current?.click()
      },
      /* @__PURE__ */ h("span", { className: "settings-background-swatch", "data-pattern": "custom", style: image ? { backgroundImage: `url("${image}")` } : void 0 }, /* @__PURE__ */ h("span", { className: "tbx-bg-upload" }, busy ? /* @__PURE__ */ h("span", { className: "tbx-spinner" }) : /* @__PURE__ */ h(Icon7, { name: "upload", size: image ? 16 : 20, stroke: 1.9 }), !image && !busy && /* @__PURE__ */ h("em", null, tx("\u4E0A\u4F20\u56FE\u7247")), custom && !busy && /* @__PURE__ */ h("em", null, tx("\u66F4\u6362")))),
      /* @__PURE__ */ h("span", null, tx("\u81EA\u5B9A\u4E49"))
    ), /* @__PURE__ */ h("input", { ref: input, type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true, onChange: choose })), error && /* @__PURE__ */ h("p", { className: "tbx-bg-error", role: "alert" }, error));
  }
  function ExportItem({ item, date, state, busy, working, onDownload, onDelete }) {
    useLocale();
    const pending2 = ["queued", "running"].includes(item.state);
    return /* @__PURE__ */ h("li", { className: cx("tbx-export", working && "is-working") }, /* @__PURE__ */ h("span", { className: "tbx-export-icon", "aria-hidden": "true" }, /* @__PURE__ */ h(Icon7, { name: "file", size: 18 })), /* @__PURE__ */ h("span", { className: "tbx-export-copy" }, /* @__PURE__ */ h("strong", { className: "tbx-num" }, date), /* @__PURE__ */ h("small", { className: `is-${item.state}` }, pending2 && /* @__PURE__ */ h("span", { className: "tbx-spinner is-small" }), state), item.problem && /* @__PURE__ */ h("small", { className: "is-failed" }, item.problem.detail)), /* @__PURE__ */ h("span", { className: "tbx-export-actions" }, item.state === "ready" && /* @__PURE__ */ h("button", { type: "button", className: "tbx-export-btn", disabled: busy, onClick: onDownload }, /* @__PURE__ */ h(Icon7, { name: "arrowDown", size: 15, stroke: 2 }), tx("\u4E0B\u8F7D")), /* @__PURE__ */ h(ConfirmButton, { label: tx("\u5220\u9664\u8D44\u6599\u5305"), disabled: busy || pending2, onConfirm: onDelete, quiet: true })));
  }
  var SECTIONS = [
    {
      id: "scope",
      title: "\u9002\u7528\u8303\u56F4",
      body: [
        "\u672C\u534F\u8BAE\u9002\u7528\u4E8E\u4F60\u5728 TeachBuddy \u4E2D\u521B\u5EFA\u3001\u4E0A\u4F20\u548C\u4FDD\u5B58\u7684\u5168\u90E8\u5185\u5BB9\uFF0C\u5305\u62EC\u9898\u76EE\u3001\u8D44\u6599\u3001\u65E5\u7A0B\u3001\u6570\u5B66\u4F5C\u54C1\u548C\u4E0E\u6559\u5B66\u52A9\u7406\u7684\u5BF9\u8BDD\u3002",
        "\u5728\u672C\u534F\u8BAE\u4E2D\uFF0C\u4F60\u662F\u6570\u636E\u7684\u201C\u63A7\u5236\u8005\u201D\uFF0C\u51B3\u5B9A\u8FD9\u4E9B\u6570\u636E\u4E3A\u4F55\u4EE5\u53CA\u5982\u4F55\u88AB\u4F7F\u7528\uFF1BTeachBuddy \u662F\u201C\u5904\u7406\u8005\u201D\uFF0C\u53EA\u6309\u4F60\u7684\u6307\u793A\u5904\u7406\u5B83\u4EEC\u3002"
      ]
    },
    {
      id: "purpose",
      title: "\u5904\u7406\u76EE\u7684",
      body: [
        "\u6211\u4EEC\u53EA\u4E3A\u5411\u4F60\u63D0\u4F9B TeachBuddy \u7684\u529F\u80FD\u800C\u5904\u7406\u6570\u636E\uFF1A\u4FDD\u5B58\u4E0E\u540C\u6B65\u3001\u641C\u7D22\u3001\u751F\u6210\u9884\u89C8\uFF0C\u4EE5\u53CA\u5728\u4F60\u4E3B\u52A8\u63D0\u95EE\u65F6\u7531\u6559\u5B66\u52A9\u7406\u8BFB\u53D6\u76F8\u5173\u5185\u5BB9\u3002",
        "\u6211\u4EEC\u4E0D\u4F1A\u51FA\u552E\u4F60\u7684\u6570\u636E\uFF0C\u4E0D\u4F1A\u7528\u5B83\u6295\u653E\u5E7F\u544A\uFF0C\u4E5F\u4E0D\u4F1A\u5728\u672A\u7ECF\u4F60\u540C\u610F\u7684\u60C5\u51B5\u4E0B\u7528\u5B83\u8BAD\u7EC3\u6A21\u578B\u3002"
      ]
    },
    {
      id: "security",
      title: "\u5B89\u5168\u63AA\u65BD",
      list: ["\u4F20\u8F93\u4E0E\u5B58\u50A8\u5168\u7A0B\u52A0\u5BC6", "\u6309\u6700\u5C0F\u6743\u9650\u539F\u5219\u63A7\u5236\u5185\u90E8\u8BBF\u95EE\uFF0C\u5E76\u7559\u5B58\u8BBF\u95EE\u8BB0\u5F55", "\u5B9A\u671F\u5907\u4EFD\uFF0C\u5E76\u6F14\u7EC3\u4ECE\u5907\u4EFD\u4E2D\u6062\u590D"]
    },
    {
      id: "vendors",
      title: "\u5B50\u5904\u7406\u65B9",
      body: ["\u6211\u4EEC\u53EF\u80FD\u59D4\u6258\u4E91\u670D\u52A1\u4E0E\u6A21\u578B\u670D\u52A1\u63D0\u4F9B\u65B9\u534F\u52A9\u5904\u7406\u6570\u636E\u3002\u6BCF\u4E00\u5BB6\u90FD\u987B\u7B7E\u7F72\u4E0D\u4F4E\u4E8E\u672C\u534F\u8BAE\u6807\u51C6\u7684\u4E66\u9762\u534F\u8BAE\uFF0C\u53D8\u66F4\u524D\u6211\u4EEC\u4F1A\u63D0\u524D\u901A\u77E5\u4F60\u3002"]
    },
    {
      id: "retention",
      title: "\u4FDD\u7559\u4E0E\u5220\u9664",
      body: [
        "\u4F60\u53EF\u4EE5\u968F\u65F6\u5728\u201C\u8BBE\u7F6E\u201D\u4E2D\u5BFC\u51FA\u5168\u90E8\u6570\u636E\uFF0C\u6216\u5220\u9664\u8D26\u6237\u3002\u5220\u9664\u540E\uFF0C\u6570\u636E\u4F1A\u5728 30 \u5929\u5185\u4ECE\u5728\u7EBF\u7CFB\u7EDF\u4E2D\u6E05\u9664\uFF0C\u5E76\u5728\u4E0B\u4E00\u4E2A\u5907\u4EFD\u5468\u671F\u7ED3\u675F\u540E\u4ECE\u5907\u4EFD\u4E2D\u6E05\u9664\u3002"
      ]
    },
    {
      id: "rights",
      title: "\u4F60\u7684\u6743\u5229",
      list: ["\u67E5\u9605\u548C\u5BFC\u51FA\u4F60\u7684\u6570\u636E", "\u66F4\u6B63\u4E0D\u51C6\u786E\u7684\u4FE1\u606F", "\u5220\u9664\u6570\u636E\u6216\u6CE8\u9500\u8D26\u6237", "\u5C31\u6570\u636E\u5904\u7406\u65B9\u5F0F\u63D0\u51FA\u7591\u95EE\u6216\u6295\u8BC9"]
    }
  ];
  var HIGHLIGHTS = [
    ["folder", "\u4F60\u7684\u8D44\u6599\u5F52\u4F60\u6240\u6709", "\u6211\u4EEC\u53EA\u6309\u4F60\u7684\u6307\u793A\u4FDD\u5B58\u548C\u5904\u7406\u3002"],
    ["shield", "\u4E0D\u51FA\u552E\uFF0C\u4E0D\u6295\u653E\u5E7F\u544A", "\u4E5F\u4E0D\u4F1A\u672A\u7ECF\u540C\u610F\u7528\u4E8E\u8BAD\u7EC3\u6A21\u578B\u3002"],
    ["upload", "\u968F\u65F6\u5E26\u8D70", "\u5BFC\u51FA\u5168\u90E8\u6570\u636E\uFF0C\u6216\u4E00\u952E\u5220\u9664\u8D26\u6237\u3002"]
  ];
  function AgreementPaper() {
    useLocale();
    const scroller = useRef(null);
    const [active, setActive] = useState(SECTIONS[0].id);
    const lock = useRef(0);
    useEffect(() => {
      const root = scroller.current?.closest(".settings-confirm-copy");
      if (!root) return void 0;
      const spy = () => {
        if (Date.now() < lock.current) return;
        const box = root.getBoundingClientRect();
        const max = root.scrollHeight - root.clientHeight;
        const p = max > 0 ? root.scrollTop / max : 0;
        const slide = Math.max(0, (p - 0.55) / 0.45);
        const line = box.top + 96 + slide * Math.max(0, root.clientHeight - 120);
        let current = SECTIONS[0].id;
        for (const s of SECTIONS) {
          const el = root.querySelector(`[data-section="${s.id}"]`);
          if (el && el.getBoundingClientRect().top <= line) current = s.id;
        }
        if (max > 0 && root.scrollTop >= max - 2) current = SECTIONS[SECTIONS.length - 1].id;
        setActive(current);
      };
      root.addEventListener("scroll", spy, { passive: true });
      return () => root.removeEventListener("scroll", spy);
    }, []);
    const jump = (id) => {
      const root = scroller.current?.closest(".settings-confirm-copy");
      const el = root?.querySelector(`[data-section="${id}"]`);
      setActive(id);
      lock.current = Date.now() + 700;
      if (root && el) root.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
    };
    return /* @__PURE__ */ h("div", { className: "tbx-dpa", ref: scroller }, /* @__PURE__ */ h("nav", { className: "tbx-dpa-toc", "aria-label": tx("\u76EE\u5F55") }, /* @__PURE__ */ h("span", { className: "tbx-dpa-toc-label" }, tx("\u76EE\u5F55")), SECTIONS.map((s, i) => /* @__PURE__ */ h("button", { key: s.id, type: "button", className: cx(active === s.id && "is-active"), onClick: () => jump(s.id) }, /* @__PURE__ */ h("span", { className: "tbx-num" }, i + 1), tx(s.title)))), /* @__PURE__ */ h("article", { className: "tbx-dpa-paper" }, /* @__PURE__ */ h("header", { className: "tbx-dpa-head" }, /* @__PURE__ */ h("span", { className: "tbx-dpa-badge" }, tx("\u793A\u4F8B")), /* @__PURE__ */ h("h3", null, tx("TeachBuddy \u6570\u636E\u5904\u7406\u534F\u8BAE")), /* @__PURE__ */ h("p", { className: "tbx-dpa-meta" }, tx("\u7248\u672C 0.1 \xB7 \u751F\u6548\u65E5\u671F 2026 \u5E74 9 \u6708 1 \u65E5")), /* @__PURE__ */ h("p", { className: "tbx-dpa-lead" }, tx("\u8FD9\u4EFD\u534F\u8BAE\u8BF4\u660E TeachBuddy \u5982\u4F55\u4EE3\u4F60\u5904\u7406\u6559\u5B66\u6570\u636E\uFF1A\u5904\u7406\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48\u5904\u7406\uFF0C\u4EE5\u53CA\u4F60\u59CB\u7EC8\u62E5\u6709\u54EA\u4E9B\u6743\u5229\u3002"))), /* @__PURE__ */ h("ul", { className: "tbx-dpa-highlights" }, HIGHLIGHTS.map(([icon, title, note]) => /* @__PURE__ */ h("li", { key: title }, /* @__PURE__ */ h("span", { className: "tbx-dpa-hl-icon" }, /* @__PURE__ */ h(Icon7, { name: icon, size: 18 })), /* @__PURE__ */ h("strong", null, tx(title)), /* @__PURE__ */ h("small", null, tx(note))))), SECTIONS.map((s, i) => /* @__PURE__ */ h("section", { key: s.id, "data-section": s.id, className: "tbx-dpa-section" }, /* @__PURE__ */ h("h4", null, /* @__PURE__ */ h("span", { className: "tbx-num" }, String(i + 1).padStart(2, "0")), tx(s.title)), s.body?.map((p) => /* @__PURE__ */ h("p", { key: p }, tx(p))), s.list && /* @__PURE__ */ h("ul", null, s.list.map((x) => /* @__PURE__ */ h("li", { key: x }, tx(x)))))), /* @__PURE__ */ h("aside", { className: "tbx-dpa-note", role: "note" }, /* @__PURE__ */ h(Icon7, { name: "info", size: 18 }), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("strong", null, tx("\u8FD9\u662F\u4E00\u4EFD\u6A21\u62DF\u534F\u8BAE")), /* @__PURE__ */ h("p", null, tx("TeachBuddy \u76EE\u524D\u8FD8\u6CA1\u6709\u6B63\u5F0F\u7684\u6570\u636E\u5904\u7406\u534F\u8BAE\u3002\u4EE5\u4E0A\u5185\u5BB9\u4EC5\u7528\u4E8E\u5C55\u793A\u9875\u9762\u6392\u7248\uFF0C\u4E0D\u6784\u6210\u4EFB\u4F55\u627F\u8BFA\uFF0C\u4E5F\u4E0D\u5177\u5907\u6CD5\u5F8B\u6548\u529B\u3002\u6B63\u5F0F\u534F\u8BAE\u53D1\u5E03\u540E\uFF0C\u4F1A\u5728\u8FD9\u91CC\u66FF\u6362\u5E76\u901A\u77E5\u4F60\u3002"))))));
  }
  function DangerZone({ onDelete }) {
    useLocale();
    return /* @__PURE__ */ h("section", { className: "settings-sheet tbx-danger", "aria-labelledby": "tbx-danger-title" }, /* @__PURE__ */ h("header", { className: "tbx-danger-head" }, /* @__PURE__ */ h("span", { className: "tbx-danger-icon", "aria-hidden": "true" }, /* @__PURE__ */ h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ h("path", { d: "M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" }), /* @__PURE__ */ h("path", { d: "M12 9v4m0 4h.01" }))), /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("h2", { id: "tbx-danger-title" }, tx("\u5371\u9669\u64CD\u4F5C")), /* @__PURE__ */ h("p", null, tx("\u8FD9\u91CC\u7684\u64CD\u4F5C\u65E0\u6CD5\u64A4\u9500\uFF0C\u8BF7\u786E\u8BA4\u540E\u518D\u7EE7\u7EED\u3002")))), /* @__PURE__ */ h("div", { className: "tbx-danger-row" }, /* @__PURE__ */ h("div", { className: "tbx-danger-copy" }, /* @__PURE__ */ h("h3", null, tx("\u5220\u9664\u8D26\u6237")), /* @__PURE__ */ h("p", null, tx("\u6C38\u4E45\u5220\u9664\u8D26\u6237\u548C\u5168\u90E8\u6570\u636E\uFF0C\u5305\u62EC\u9898\u5E93\u3001\u65E5\u7A0B\u3001\u8D44\u6599\u4E0E\u52A9\u7406\u5BF9\u8BDD\u3002"))), /* @__PURE__ */ h("button", { type: "button", className: "tbx-danger-btn", onClick: onDelete }, /* @__PURE__ */ h(Icon7, { name: "trash", size: 16 }), tx("\u5220\u9664\u8D26\u6237\u2026"))));
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/locales/en.js
  var EN = {
    "\u8BF7\u5148\u6062\u590D\u6240\u5C5E\u73ED\u7EA7": "Restore the class first",
    "\u8BF7\u5148\u6062\u590D\u6240\u5C5E\u5B66\u751F": "Restore the student first",
    /* ---------- date & time pickers ---------- */
    "\u9009\u62E9\u5E74\u6708": "Choose month and year",
    "\u9009\u62E9\u5E74\u4EFD": "Choose year",
    "\u4E0A\u4E00\u9875": "Previous",
    "\u4E0B\u4E00\u9875": "Next",
    "\u65F6": "Hour",
    /* ---------- resources: types, tags, selection ---------- */
    "\u6F14\u793A\u6587\u7A3F": "Slides",
    "\u6587\u6863": "Documents",
    "\u56FE\u7247": "Images",
    "\u7F51\u9875": "Web pages",
    "\u79FB\u9664\u7B5B\u9009\uFF1A{{name}}": "Remove filter: {{name}}",
    "\u53D6\u6D88\u5168\u9009": "Deselect All",
    "\u5F7B\u5E95\u5220\u9664 {{n}} \u4EFD\u8D44\u6599\uFF1F": "Permanently delete {{n}} files?",
    "\u5220\u9664\u540E\u65E0\u6CD5\u6062\u590D\u3002": "This can\u2019t be undone.",
    "\u7ED9 {{n}} \u4EFD\u8D44\u6599\u52A0\u6807\u7B7E\u6216\u53BB\u6389\u6807\u7B7E": "Tag or untag {{n}} files",
    "\u65B0\u5EFA\u6807\u7B7E\u2026": "New Tag\u2026",
    "\u7F16\u8F91\u6807\u7B7E {{name}}": "Edit tag {{name}}",
    "\u65B0\u5EFA\u6807\u7B7E": "New Tag",
    "\u7F16\u8F91\u6807\u7B7E": "Edit Tag",
    "\u989C\u8272": "Color",
    "\u989C\u8272 {{value}}": "Color {{value}}",
    "\u5220\u9664\u6807\u7B7E": "Delete Tag",
    "\u5DF2\u7ECF\u6709\u53EB\u201C{{name}}\u201D\u7684\u6807\u7B7E\u4E86": "There\u2019s already a tag called \u201C{{name}}\u201D",
    "\u6536\u8D77": "Collapse",
    "\u5C55\u5F00": "Expand",
    "{{label}}\uFF1A\u5DF2\u9009 {{n}} \u9879": "{{label}}: {{n}} selected",
    "\u7BA1\u7406\u6587\u4EF6\u5939 {{name}}": "Manage folder {{name}}",
    "\u6587\u4EF6\u5939\u540D\u79F0": "Folder name",
    "\u65B0\u6587\u4EF6\u5939\u540D\u79F0": "New folder name",
    "\u91CD\u547D\u540D\u6587\u4EF6\u5939": "Rename Folder",
    "\u65B0\u5EFA\u5B50\u6587\u4EF6\u5939": "New Subfolder",
    "\u79FB\u5230\u5176\u4ED6\u6587\u4EF6\u5939": "Move to Folder",
    "\u56DE\u5230\u6839\u76EE\u5F55": "Move to Root",
    "\u6839\u76EE\u5F55": "Root",
    "\u5220\u9664\u6587\u4EF6\u5939": "Delete Folder",
    "\u6587\u4EF6\u5939\u9009\u9879": "Folder options",
    "\u672A\u5206\u7EC4": "Ungrouped",
    "\u201C\u672A\u5206\u7EC4\u201D\u662F\u4FDD\u7559\u7684\u540D\u79F0": "\u201CUngrouped\u201D is reserved",
    "\u5DF2\u7ECF\u6709\u53EB\u201C{{name}}\u201D\u7684\u6587\u4EF6\u5939\u4E86": "There\u2019s already a folder called \u201C{{name}}\u201D",
    "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A": "Enter a name",
    /* ---------- shell ---------- */
    "\u641C\u7D22\u9898\u76EE\u3001\u8D44\u6599\u3001\u4F5C\u54C1": "Search questions, files, works",
    "\u8F85\u52A9\u680F": "Side panel",
    "\u8F85\u52A9\u680F\u5185\u5BB9": "Side panel content",
    "\u5173\u95ED\u8F85\u52A9\u680F": "Close side panel",
    "\u6536\u8D77\u8F85\u52A9\u680F": "Hide side panel",
    "\u6253\u5F00\u8F85\u52A9\u680F": "Show side panel",
    "\u6253\u5F00 AI \u52A9\u7406": "Open Assistant",
    "\u6536\u8D77 AI \u52A9\u7406": "Hide Assistant",
    "AI \u52A9\u7406": "Assistant",
    "\u4F18\u5148\u7EA7": "Priority",
    "\u89E3\u6563\u5206\u7EC4": "Ungroup",
    "\u53EF\u62D6\u52A8\u6392\u5E8F\uFF1BAlt \u52A0\u65B9\u5411\u952E\u79FB\u52A8\uFF1BDelete \u79FB\u5230\u5783\u573E\u6876": "Drag to reorder; Alt + arrow keys to move; Delete to move to Trash",
    "\u5206\u7EC4\u9009\u9879": "Group options",
    "\u653E\u5230\u8FD9\u91CC": "Drop here",
    "\u628A\u6A21\u5757\u62D6\u5230\u8FD9\u91CC": "Drag modules here",
    "\u677E\u5F00\uFF0C\u79FB\u5230\u5783\u573E\u6876": "Release to move to Trash",
    "\u5783\u573E\u6876\u662F\u7A7A\u7684\u3002\u628A\u4E0D\u5E38\u7528\u7684\u6A21\u5757\u62D6\u5230\u8FD9\u91CC\uFF0C\u754C\u9762\u4F1A\u66F4\u6E05\u723D\u3002": "Trash is empty. Drag modules you rarely use here to keep things tidy.",
    "\u4E00\u5207\u5C31\u7EEA\u3002": "You\u2019re all set.",
    "TeachBuddy \u7684\u6BCF\u4E2A\u89D2\u843D\uFF0C\u4F60\u90FD\u53BB\u8FC7\u4E86\u3002": "You\u2019ve been to every corner of TeachBuddy.",
    "\u5F00\u59CB\u5427": "Let\u2019s go",
    /* ---------- sign-in ---------- */
    "\u6559\u5B66\u7684\u4E00\u5207\uFF0C\u90FD\u5728\u8FD9\u91CC\u3002": "Everything for teaching, all in one place.",
    "\u4E00\u4E2A\u8D26\u6237\uFF0C\u5F00\u542F\u4F60\u7684\u5168\u90E8\u6559\u5B66\u3002": "One account for all of your teaching.",
    "\u6211\u4EEC\u4F1A\u628A\u9A8C\u8BC1\u7801\u53D1\u5230\u4F60\u7684\u90AE\u7BB1\u3002": "We\u2019ll email you a verification code.",
    "\u65B0\u5BC6\u7801\u81F3\u5C11 8 \u4F4D\u3002": "Use at least 8 characters.",
    "\u540C\u5B66\u4EEC\u597D\uFF5E": "Morning, class!",
    "\u4ECA\u5929\u8BB2\u4E8C\u6B21\u51FD\u6570": "Quadratics today",
    "\u4F5C\u4E1A\u90FD\u4EA4\u4E86\u5417\uFF1F": "Homework all in?",
    "\u8001\u5E08\u6211\u4F1A\uFF01": "I know this one!",
    "\u4E0B\u8BFE\u6253\u7403\u53BB\uFF1F": "Ball after class?",
    "\u8FD9\u9898\u9009 C\uFF01": "It\u2019s C!",
    "\u8BA9\u6211\u60F3\u60F3\u2026\u2026": "Let me think\u2026",
    "\u8FD9\u9898\u597D\u50CF\u89C1\u8FC7": "Seen this before",
    "\u8001\u5E08\uFF0C\u6211\u6709\u95EE\u9898": "I have a question!",
    "\u563F\u563F": "Hehe",
    "\u6211\u5148\u4E3E\u624B\uFF01": "Me first!",
    "\u4ECA\u5929\u4E5F\u8981\u52A0\u6CB9\u9E2D": "We\u2019ve got this!",
    "\u4E0D\u8BB8\u5077\u770B\u54E6": "No peeking!",
    "\u773C\u775B\u770B\u9ED1\u677F": "Eyes on the board",
    "\u55EF\uFF1F\u8C01\u5728\u770B\uFF1F": "Hm? Who\u2019s looking?",
    "\u6211\u6CA1\u770B\uFF01\u771F\u7684\uFF01": "Not looking! Really!",
    "\u5C31\u770B\u4E00\u773C\u2026\u2026": "Just one peek\u2026",
    "\u770B\u4E0D\u6E05\u770B\u4E0D\u6E05": "Can\u2019t see a thing",
    "\u6211\u53EA\u662F\u8DEF\u8FC7": "Just passing by",
    "\u6211\u4EC0\u4E48\u4E5F\u6CA1\u770B\u89C1": "Saw nothing",
    "\u6211\u95ED\u773C\u4E86\uFF01": "Eyes closed!",
    "\u6211\u662F\u597D\u5B66\u751F": "I\u2019m a good student",
    "\u5BC6\u7801\u8981\u85CF\u597D\u5440": "Keep it secret",
    "\u5927\u5BB6\u8F6C\u8FC7\u53BB\uFF5E": "Everyone, turn around",
    "\u6211\u770B\u5230\u5566\uFF5E": "I saw it~",
    "\u8BB0\u4E0D\u4F4F\u8BB0\u4E0D\u4F4F": "Already forgot",
    "\u54C7\uFF0C\u597D\u957F": "Whoa, long one",
    "\u6211\u8F6C\u8FC7\u53BB\u4E86": "Turned around",
    "\u6211\u6342\u773C\u775B\u4E86\uFF01": "Covering my eyes!",
    "\u6CA1\u770B\u6CA1\u770B": "Didn\u2019t look",
    "\u518D\u68C0\u67E5\u4E00\u4E0B\uFF1F": "Check it once more?",
    "\u522B\u6025\uFF0C\u6162\u6162\u6765": "No rush",
    "\u54CE\u5440": "Oops",
    "\u5DEE\u4E00\u70B9\u70B9": "So close",
    "\u662F\u4E0D\u662F\u54EA\u91CC\u9519\u4E86\uFF1F": "Something off?",
    "\u6CA1\u5173\u7CFB\uFF01\u518D\u6765\uFF01": "It\u2019s okay! Again!",
    "\u6B22\u8FCE\u56DE\u6765\uFF01": "Welcome back!",
    "\u4E0A\u8BFE\u5566\uFF5E": "Class is on!",
    "\u8036\uFF01": "Yay!",
    "\u51B2\u9E2D\uFF01": "Let\u2019s go!",
    "\u592A\u597D\u4E86\uFF01": "Great!",
    "\u5F00\u5FC3\uFF01": "Happy!",
    /* ---------- feedback ---------- */
    "\u597D\u4E3B\u610F\uFF0C\u6536\u5230\u4E86\u3002": "Great idea. Got it.",
    "\u6BCF\u4E00\u6761\u5EFA\u8BAE\uFF0C\u6211\u4EEC\u90FD\u4F1A\u8BA4\u771F\u8BFB\u5B8C\u3002": "We read every suggestion, start to finish.",
    "\u8C22\u8C22\u4F60\u5E2E\u6211\u4EEC\u627E\u5230\u5B83\u3002": "Thanks for finding that.",
    "\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u4FEE\u597D\u8FD9\u4E2A\u95EE\u9898\u3002": "We\u2019ll fix it as soon as we can.",
    "\u4F60\u7684\u95EE\u9898\uFF0C\u6211\u4EEC\u6536\u5230\u4E86\u3002": "We got your question.",
    "\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u7ED9\u4F60\u7B54\u590D\u3002": "We\u2019ll get back to you soon.",
    "\u8FD9\u53E5\u8BDD\uFF0C\u6211\u4EEC\u4F1A\u8BB0\u5F88\u4E45\u3002": "We\u2019ll remember this one.",
    "\u8C22\u8C22\u4F60\uFF0C\u8FD9\u5BF9\u6211\u4EEC\u610F\u4E49\u91CD\u5927\u3002": "Thank you. It means a lot.",
    /* ---------- dates ---------- */
    "\u4ECA\u5929": "Today",
    "\u660E\u5929": "Tomorrow",
    "\u540E\u5929": "In 2 days",
    "\u6628\u5929": "Yesterday",
    "\u521A\u521A": "Just now",
    "{{n}} \u5206\u949F": "{{n}} min",
    "{{n}} \u5C0F\u65F6": "{{n}} hr",
    "\u6700\u8FD1 7 \u5929": "Previous 7 days",
    "\u66F4\u65E9": "Earlier",
    "{{s}} \u79D2": "{{s}}s",
    "{{m}} \u5206 {{s}} \u79D2": "{{m}}m {{s}}s",
    /* ---------- assistant ---------- */
    "\u5FEB\u901F\u3001\u64C5\u957F\u63A8\u7406": "Fast, strong at reasoning",
    "\u4E2D\u6587\u8868\u8FBE\u81EA\u7136": "Natural Chinese writing",
    "\u9898\u76EE": "Question",
    "\u65E5\u7A0B": "Schedule",
    "\u8D44\u6599": "File",
    "\u5F15\u7528": "Reference",
    "\u53D6\u6D88\u7F6E\u9876": "Unpin",
    "\u7F6E\u9876": "Pin",
    "\u91CD\u547D\u540D": "Rename",
    "\u518D\u70B9\u4E00\u6B21\uFF0C\u786E\u8BA4\u5220\u9664": "Click again to delete",
    "\u5DF2\u7F6E\u9876": "Pinned",
    "\u5BF9\u8BDD": "Conversations",
    "\u641C\u7D22\u5BF9\u8BDD": "Search conversations",
    "\u65B0\u5BF9\u8BDD": "New chat",
    "\u65B0\u5BF9\u8BDD \u2318N": "New chat \u2318N",
    "\u8FD8\u6CA1\u6709\u5BF9\u8BDD\u3002": "No conversations yet.",
    "\u4ECE\u53F3\u8FB9\u5F00\u59CB\u7B2C\u4E00\u6BB5\u5427\u3002": "Start your first one on the right.",
    "\u6CA1\u6709\u627E\u5230\u76F8\u5173\u7684\u5BF9\u8BDD\u3002": "No matching conversations.",
    "\u6B63\u5728\u56DE\u7B54\u2026": "Answering\u2026",
    "\u8FD8\u6CA1\u6709\u56DE\u7B54": "No answer yet",
    "\u5BF9\u8BDD\u9009\u9879": "Conversation options",
    "\u5BF9\u8BDD\u5217\u8868": "Conversations",
    "\u67E5\u9605\u4E86 {{n}} \u5904 \xB7 \u7528\u65F6": "Checked {{n}} sources \xB7",
    "\u5728\u9898\u5E93\u91CC\u627E": "Searched the question bank",
    "\u6B63\u5728\u9898\u5E93\u91CC\u627E": "Searching the question bank",
    "\u8BFB\u4E86\u9898\u76EE": "Read the question",
    "\u6B63\u5728\u8BFB\u9898\u76EE": "Reading the question",
    "\u770B\u4E86\u65E5\u7A0B": "Checked the schedule",
    "\u6B63\u5728\u770B\u65E5\u7A0B": "Checking the schedule",
    "\u6CA1\u6709\u8BFB\u5230": "Couldn\u2019t read",
    "\u6B63\u5728\u601D\u8003": "Thinking",
    "\u6B63\u5728\u6574\u7406": "Writing",
    "\u6CA1\u6210\u529F\uFF0C\u518D\u8BD5\u4E00\u6B21": "Didn\u2019t work. Try again",
    "\u5F15\u7528\u5230\u5BF9\u8BDD": "Add to chat",
    "\u70B9\u5F00\u67E5\u770B\uFF0C\u6216\u5F15\u7528\u5230\u5BF9\u8BDD\u91CC\u7EE7\u7EED\u804A": "Open one, or add it to the chat",
    "\u52A0\u5230\u65E5\u7A0B": "Add to Schedule",
    "\u5DF2\u52A0\u5230\u5F85\u5B89\u6392": "Added to Unscheduled",
    "\u5B58\u8FDB\u9898\u5E93": "Save to Question Bank",
    "\u5B58\u8FDB\u9898\u5E93 \xB7 {{n}} \u9053": "Save {{n}} to Question Bank",
    "\u5DF2\u5B58\u8FDB\u9898\u5E93": "Saved to Question Bank",
    "\u5C55\u5F00\u5176\u4F59 {{n}} \u9053": "Show {{n}} more",
    "{{n}} \u4EF6\u4E8B": "{{n}} items",
    "\u6253\u5F00\u65E5\u7A0B": "Open Schedule",
    "\u628A\u300C{{title}}\u300D\u5E26\u8FDB\u5BF9\u8BDD": "Bring \u201C{{title}}\u201D into the chat",
    "\u590D\u5236": "Copy",
    "\u56DE\u7B54\u88AB\u505C\u6B62\u4E86\uFF0C\u53EA\u4FDD\u7559\u4E86\u524D\u9762\u7684\u90E8\u5206\u3002": "Stopped. Only the first part was kept.",
    "\u91CD\u65B0\u56DE\u7B54": "Regenerate",
    "\u6682\u4E0D\u53EF\u7528": "Unavailable",
    "\u5F15\u7528\u5DE5\u4F5C\u53F0\u91CC\u7684\u5185\u5BB9": "Reference something in your workbench",
    "\u5F15\u7528\u9898\u76EE\u3001\u65E5\u7A0B\u6216\u8D44\u6599": "Reference a question, event or file",
    "\u6B63\u5728\u627E\u2026": "Searching\u2026",
    "\u6CA1\u6709\u627E\u5230\u201C{{query}}\u201D\u3002": "Nothing found for \u201C{{query}}\u201D.",
    "\u6CA1\u6709\u627E\u5230\u53EF\u4EE5\u5F15\u7528\u7684\u5185\u5BB9\u3002": "Nothing to reference yet.",
    "\u6B63\u5728\u770B": "Looking at",
    "\u53E6\u4E00\u6BB5\u5BF9\u8BDD\u6B63\u5728\u56DE\u7B54\uFF0C\u53BB\u770B\u770B": "Another chat is still answering. View it",
    "\u54EA\u8282\u8BFE": "which lesson",
    "\u63A5\u4E0B\u6765\u7684\u8BFE": "Coming up",
    "\u4E0D\u9488\u5BF9\u67D0\u8282\u8BFE": "No particular lesson",
    "What shall we prepare for": "What shall we prepare for",
    "\u4ECA\u5929\u60F3\u51C6\u5907\u4EC0\u4E48\uFF1F": "What would you like to prepare today?",
    "\u8FD8\u6CA1\u6709\u5199\u51C6\u5907\u4E8B\u9879": "No prep notes yet",
    "\u5907\u8BFE\u601D\u8DEF\u3001\u4E00\u9053\u9898\u7684\u8BB2\u6CD5\u3001\u4E00\u4E2A\u8BFE\u5802\u6F14\u793A\uFF0C\u90FD\u53EF\u4EE5\u4ECE\u8FD9\u91CC\u5F00\u59CB\u3002": "Lesson ideas, ways to explain a question, a classroom demo. Start any of them here.",
    "\u6709\u4EC0\u4E48\u53EF\u4EE5\u5E2E\u4F60\uFF1F": "How can I help?",
    "\u6211\u80FD\u770B\u5230\u4F60\u6B63\u5728\u770B\u300C{{title}}\u300D\u3002": "I can see you\u2019re looking at \u201C{{title}}\u201D.",
    "\u95EE\u4E00\u4E2A\u95EE\u9898\uFF0C\u6216\u8005\u4ECE\u4E0B\u9762\u5F00\u59CB\u3002": "Ask a question, or start with one below.",
    "\u793A\u4F8B\u6570\u636E\u5DF2\u5C31\u7EEA\uFF1A7 \u9053\u9898\u30014 \u4EFD\u8D44\u6599\u548C\u4E00\u5468\u7684\u8BFE\u8868\u3002": "Sample data is ready: 7 questions, 4 files and a week of classes.",
    "\u53BB\u9898\u5E93": "Question Bank",
    "\u770B\u65E5\u7A0B": "Schedule",
    "\u7B2C\u4E00\u6B21\u6765\uFF1F": "New here?",
    "\u6B63\u5728\u8F7D\u5165\u2026": "Loading\u2026",
    "\u8F7D\u5165\u4E00\u5468\u7684\u793A\u4F8B\u6570\u636E": "Load a week of sample data",
    "\uFF0C\u770B\u770B\u5DE5\u4F5C\u53F0\u88C5\u6EE1\u65F6\u7684\u6837\u5B50\u3002": " to see the workbench in full swing.",
    "\u8F7D\u5165\u6CA1\u6709\u5B8C\u6210\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002": "Loading didn\u2019t finish. Please try again.",
    "\u6700\u8FD1\u7684\u5BF9\u8BDD": "Recent",
    "\u5728\u9996\u9875\u67E5\u770B\u5168\u90E8\u5BF9\u8BDD": "See all on Home",
    "\u5728\u9996\u9875\u6253\u5F00": "Open on Home",
    "\u65B0\u6D88\u606F": "New messages",
    "\u591C\u6DF1\u4E86": "Working late",
    "\u65E9\u4E0A\u597D": "Good morning",
    "\u4E2D\u5348\u597D": "Good afternoon",
    "\u4E0B\u5348\u597D": "Good afternoon",
    "\u665A\u4E0A\u597D": "Good evening",
    "\u95EE\u4E00\u4E2A\u95EE\u9898\uFF0C\u6216\u8F93\u5165 @ \u5F15\u7528\u9898\u76EE\u3001\u65E5\u7A0B": "Ask anything. Type @ to reference a question or event",
    "\u63CF\u8FF0\u4F60\u60F3\u51C6\u5907\u7684\u8BFE\u3001\u60F3\u8BA8\u8BBA\u7684\u9898\uFF0C\u8F93\u5165 @ \u5F15\u7528\u5DE5\u4F5C\u53F0\u91CC\u7684\u5185\u5BB9": "Describe a lesson to prepare or a question to discuss. Type @ to reference your workbench",
    "\u8FD4\u56DE\u5DE5\u4F5C": "Back",
    /* suggestions (prompts carry English keywords the demo understands) */
    "\u68B3\u7406\u4E00\u8282\u8BFE\u7684\u8BB2\u89E3\u987A\u5E8F": "Plan a lesson\u2019s teaching order",
    "\u5E2E\u6211\u68B3\u7406\u4E00\u8282\u4E8C\u6B21\u51FD\u6570\u56FE\u50CF\u4E0E\u6027\u8D28\u7684\u8BB2\u89E3\u987A\u5E8F": "Plan the teaching order for a lesson on graphs of quadratic functions",
    "\u8BA8\u8BBA\u4E00\u9053\u9898\u7684\u4E0D\u540C\u8BB2\u6CD5": "Ways to teach a question",
    "\u8FD9\u9053\u4E09\u89D2\u5F62\u5168\u7B49\u7684\u8BC1\u660E\u9898\uFF0C\u6709\u54EA\u51E0\u79CD\u8BB2\u6CD5\uFF1F": "What are the different ways to teach this congruent triangles proof?",
    "\u6784\u601D\u4E00\u4E2A\u6570\u5B66\u6F14\u793A": "Design a math demo",
    "\u6784\u601D\u4E00\u4E2A\u6F14\u793A\uFF0C\u8BA9\u5B66\u751F\u770B\u5230\u629B\u7269\u7EBF\u5F00\u53E3\u65B9\u5411\u5982\u4F55\u968F a \u53D8\u5316": "Design a demo showing how a parabola opens as a changes",
    "\u8BBE\u8BA1\u4E00\u7EC4\u5206\u5C42\u7EC3\u4E60": "Build tiered practice",
    "\u4E3A\u5206\u6570\u52A0\u51CF\u6CD5\u8BBE\u8BA1\u4E00\u7EC4\u7531\u6613\u5230\u96BE\u7684\u5206\u5C42\u7EC3\u4E60": "Design tiered homework on adding and subtracting fractions, easy to hard",
    "\u68B3\u7406\u8FD9\u8282\u8BFE\u7684\u8BB2\u89E3\u987A\u5E8F": "Plan this lesson\u2019s teaching order",
    "\u5E2E\u6211\u68B3\u7406\u8FD9\u8282\u8BFE\u7684\u8BB2\u89E3\u987A\u5E8F": "Plan the teaching order for this lesson",
    "\u627E\u51E0\u9053\u8BFE\u5802\u7EC3\u4E60\u9898": "Find practice questions",
    "\u4E3A\u8FD9\u8282\u8BFE\u627E 3 \u9053\u8BFE\u5802\u7EC3\u4E60\u9898": "Find 3 practice questions for this lesson",
    "\u6784\u601D\u4E00\u4E2A\u8BFE\u5802\u6F14\u793A": "Design a classroom demo",
    "\u4E3A\u8FD9\u8282\u8BFE\u6784\u601D\u4E00\u4E2A\u629B\u7269\u7EBF\u6F14\u793A": "Design a parabola demo for this lesson",
    "\u8FD9\u8282\u8BFE\u7684\u4F8B\u9898\uFF0C\u6709\u54EA\u51E0\u79CD\u8BB2\u6CD5\uFF1F": "What are the ways to teach this lesson\u2019s example?",
    "\u8BBE\u8BA1\u4E00\u7EC4\u5206\u5C42\u4F5C\u4E1A": "Build tiered homework",
    "\u4E3A\u8FD9\u8282\u8BFE\u8BBE\u8BA1\u4E00\u7EC4\u5206\u5C42\u4F5C\u4E1A": "Design tiered homework for this lesson",
    "\u8FD9\u9053\u9898\u600E\u4E48\u8BB2": "How to teach this one",
    "\u627E\u51E0\u9053\u76F8\u4F3C\u7684\u9898": "Find similar questions",
    "\u51FA\u4E00\u9053\u53D8\u5F0F\u9898": "Write a variant",
    "\u660E\u5929\u6709\u4EC0\u4E48\u8BFE": "Tomorrow\u2019s classes",
    "\u5E2E\u6211\u5907\u4E0B\u4E00\u8282\u8BFE": "Plan my next lesson",
    "\u4E3A\u4E0B\u4E00\u8282\u8BFE\u8BBE\u8BA1\u5206\u5C42\u4F5C\u4E1A": "Tiered homework for my next lesson",
    "\u6784\u601D\u4E00\u4E2A\u629B\u7269\u7EBF\u6F14\u793A": "Design a parabola demo",
    "\u600E\u4E48\u8BB2\u4E8C\u6B21\u51FD\u6570\u7684\u5E73\u79FB": "How to teach quadratic shifts",
    "\u627E\u51E0\u9053\u538B\u8F74\u9898": "Find challenging questions",
    "\u4ECA\u5929\u6709\u4EC0\u4E48\u5B89\u6392": "What\u2019s on today",
    /* ---------- schedule ---------- */
    "\u89C6\u56FE": "View",
    "\u65E5\u5386": "Calendar",
    "\u4EFB\u52A1": "Task",
    "\u65B0\u4EFB\u52A1": "New task",
    "\u5F85\u5B89\u6392": "Unscheduled",
    "\u65B0\u7684\u5F85\u5B89\u6392": "New unscheduled",
    "\u5DF2\u5B8C\u6210 {{done}}/{{total}}": "{{done}} of {{total}} done",
    "\u5212\u6389": "Check off",
    "\u5728\u201C{{title}}\u201D\u65B0\u5EFA": "New in \u201C{{title}}\u201D",
    "\u63A5\u4E0B\u6765": "Coming up",
    "\u4ECA\u5929\u7684\u5B89\u6392\u90FD\u7ED3\u675F\u4E86\uFF0C\u559D\u53E3\u6C34\u5427\u3002": "That\u2019s everything for today. Time for some water.",
    "\u8FD9\u51E0\u5929\u8FD8\u6CA1\u6709\u522B\u7684\u5B89\u6392\u3002": "Nothing else in the next few days.",
    "\u6536\u4EF6\u7BB1\u7A7A\u4E86\u3002\u60F3\u5230\u8981\u505A\u7684\u4E8B\uFF0C\u968F\u624B\u8BB0\u5728\u8FD9\u91CC\u3002": "Inbox zero. Jot things down here as they come to mind.",
    "\u8FD8\u6709 {{n}} \u9879": "{{n}} more",
    "\u91CD\u8981": "High",
    "\u666E\u901A": "Normal",
    "\u7A0D\u540E": "Later",
    "\u4E8B\u9879": "Checklist",
    "\u4E8B\u9879 {{n}}": "Item {{n}}",
    "\u4E8B\u9879\u9009\u9879": "Item options",
    "\u5199\u4E00\u4EF6\u8981\u505A\u7684\u4E8B": "Something to do",
    "\u6DFB\u52A0\u4E8B\u9879": "Add item",
    "\u6DFB\u52A0\u7B2C\u4E00\u4EF6\u8981\u505A\u7684\u4E8B": "Add the first thing to do",
    "\u79FB\u5230\u5176\u4ED6\u5B89\u6392\u2026": "Move to\u2026",
    "\u5220\u9664\u4E8B\u9879": "Delete item",
    "\u53CC\u51FB\u7F16\u8F91\u6807\u7B7E": "Double-click to edit labels",
    "\u65B0\u6807\u7B7E": "New label",
    "\u79FB\u56DE\u5F85\u5B89\u6392": "Move to Unscheduled",
    "\u4F1A\u53BB\u6389\u8FD9\u4EF6\u4E8B\u7684\u65F6\u95F4\u548C\u63D0\u9192\uFF0C\u5B83\u4F1A\u56DE\u5230\u201C\u5F85\u5B89\u6392\u201D\u3002": "This removes its time and reminder and moves it back to Unscheduled.",
    "\u653E\u5F03": "Discard",
    "\u8981\u505A\u4EC0\u4E48\uFF1F": "What needs doing?",
    "\u5148\u8BB0\u4E0B\u6765\u2026": "Jot it down\u2026",
    "\u5907\u6CE8": "Notes",
    "\u65E5\u671F": "Date",
    "\u7ED3\u675F": "Ends",
    "\u5168\u5929": "All day",
    "\u5B89\u6392\u65F6\u95F4": "Add a time",
    "\u653E\u8FDB\u65E5\u5386\uFF0C\u5230\u70B9\u4F1A\u51FA\u73B0\u5728\u4ECA\u5929": "Puts it on the calendar and in Today when it\u2019s due",
    "\u7ED3\u675F\u65F6\u95F4\u8981\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4\u3002": "End time must be after the start time.",
    "\u590F\u4EE4\u65F6\u8DF3\u65F6\uFF0C\u8FD9\u6B21\u5B9E\u9645\u5F00\u59CB\u4E8E {{date}} {{time}}\uFF08{{zone}}\uFF09\u3002": "Because of daylight saving time, this one starts at {{date}} {{time}} ({{zone}}).",
    "\u6392\u8BFE\u65F6\u533A\uFF1A{{zone}}": "Time zone: {{zone}}",
    "\u6B63\u5728\u4FDD\u5B58\u2026": "Saving\u2026",
    "\u81EA\u52A8\u4FDD\u5B58": "Saved automatically",
    "\u9A6C\u4E0A\u4FDD\u5B58": "Saving shortly",
    "\u5199\u4E0B\u6807\u9898\u5C31\u4F1A\u4FDD\u5B58": "Add a title to save",
    "\u6BCF\u6708\uFF08\u65E5\u671F\uFF09": "Monthly (same date)",
    "\u79FB\u5230\u5176\u4ED6\u5B89\u6392": "Move to\u2026",
    /* ---------- help ---------- */
    "TeachBuddy \u5E2E\u52A9": "TeachBuddy Help",
    "\u6709\u4EC0\u4E48\u53EF\u4EE5\u5E2E\u4F60\uFF1F_help": "How can we help?",
    "\u641C\u7D22\u5E2E\u52A9\u6587\u7AE0": "Search help articles",
    "\u641C\u7D22\u5E2E\u52A9": "Search Help",
    "\u5927\u5BB6\u5E38\u641C": "Popular",
    "\u4ECE\u8FD9\u91CC\u5F00\u59CB": "Start Here",
    "\u6309\u4E3B\u9898\u6D4F\u89C8": "Browse by Topic",
    "\u5E38\u89C1\u95EE\u9898": "Common Questions",
    "\u5E2E\u52A9\u76EE\u5F55": "Help contents",
    "\u5E2E\u52A9\u9996\u9875": "Help Home",
    "\u4E3B\u9898": "Topics",
    "\u6982\u89C8": "Overview",
    "\u5176\u4ED6\u4E3B\u9898": "Other topics",
    "{{n}} \u7BC7\u6587\u7AE0": "{{n}} articles",
    "\u7EA6 {{n}} \u5206\u949F\u8BFB\u5B8C": "About {{n}} min to read",
    "{{n}} \u5206\u949F\u9605\u8BFB": "{{n}} min read",
    "2026 \u5E74 10 \u6708\u66F4\u65B0": "Updated October 2026",
    "\u5C0F\u6280\u5DE7": "Tip",
    "\u8BF7\u6CE8\u610F": "Note",
    "\u8FD9\u7BC7\u6587\u7AE0\u6709\u5E2E\u52A9\u5417\uFF1F": "Was this article helpful?",
    "\u6709\u5E2E\u52A9": "Yes",
    "\u6CA1\u5E2E\u52A9": "No",
    "\u8C22\u8C22\uFF0C\u5F88\u9AD8\u5174\u5E2E\u5230\u4F60\u3002": "Thanks. Glad it helped.",
    "\u8C22\u8C22\uFF0C\u6211\u4EEC\u4F1A\u628A\u5B83\u5199\u5F97\u66F4\u6E05\u695A\u3002": "Thanks. We\u2019ll make it clearer.",
    "\u4E0A\u4E00\u7BC7": "Previous",
    "\u4E0B\u4E00\u7BC7": "Next",
    "\u4E0A\u4E00\u7BC7\u548C\u4E0B\u4E00\u7BC7": "Previous and next",
    "\u672C\u9875\u5185\u5BB9": "On This Page",
    "\u6CA1\u6709\u627E\u5230\u201C{{q}}\u201D": "No results for \u201C{{q}}\u201D",
    "\u6362\u4E2A\u8BF4\u6CD5\u8BD5\u8BD5\uFF0C\u6216\u8005\u4ECE\u4E3B\u9898\u5F00\u59CB\u627E\u3002": "Try different words, or start from a topic.",
    "\u6CA1\u6709\u627E\u5230\u8FD9\u7BC7\u6587\u7AE0": "Article not found",
    "\u5B83\u53EF\u80FD\u6362\u4E86\u4F4D\u7F6E\u3002\u8BD5\u8BD5\u641C\u7D22\uFF0C\u6216\u8005\u56DE\u5230\u5E2E\u52A9\u9996\u9875\u3002": "It may have moved. Try searching, or go back to Help Home.",
    "\u6E05\u9664": "Clear",
    "\u9009\u62E9": "Select",
    "\u6253\u5F00": "Open",
    "\u641C\u7D22": "Search",
    /* ---------- resource library ---------- */
    "\u8D44\u6E90\u5E93": "Resources",
    "\u8D44\u6E90\u5E93\u5BFC\u822A": "Resource Library navigation",
    "{{n}} \u4EFD\u8D44\u6599": "{{n}} items",
    "\u4E0A\u4F20\u8D44\u6599": "Upload",
    "\u5168\u90E8\u8D44\u6599": "All Items",
    "\u6587\u4EF6\u5939_res": "Folders",
    "\u6807\u7B7E_res": "Tags",
    "\u7BA1\u7406": "Edit",
    "\u8FD8\u6CA1\u6709\u6587\u4EF6\u5939": "No folders yet",
    "\u5DF2\u5F52\u6863": "Archived",
    "\u5F53\u524D\u8D44\u6599\u6587\u4EF6\u5939": "Current folder",
    "\u641C\u7D22\u8D44\u6599": "Search materials",
    "\u641C\u7D22\u540D\u79F0\u3001\u5907\u6CE8\u6216\u6B63\u6587": "Search names, notes or text",
    "\u6E05\u9664\u641C\u7D22": "Clear search",
    "\u6587\u4EF6\u7C7B\u578B": "File type",
    "\u7C7B\u578B": "Type",
    "\u5168\u90E8\u7C7B\u578B": "All types",
    "\u56FE\u7247 (.png)": "Image (.png)",
    "\u56FE\u7247 (.jpg)": "Image (.jpg)",
    "\u56FE\u7247 (.webp)": "Image (.webp)",
    "\u8D44\u6599\u663E\u793A\u65B9\u5F0F": "View",
    "\u7F29\u7565\u56FE\u89C6\u56FE": "Thumbnails",
    "\u5217\u8868\u89C6\u56FE": "List",
    "\u540D\u79F0": "Name",
    "\u4FEE\u6539\u65E5\u671F": "Modified",
    "\u5927\u5C0F": "Size",
    "\u672A\u5F52\u5165\u6587\u4EF6\u5939": "No folder",
    "\u6587\u4EF6": "File",
    "{{title}} \u7F29\u7565\u56FE": "Thumbnail of {{title}}",
    "\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25": "Can\u2019t read file",
    "\u65E0\u6CD5\u9884\u89C8": "No preview",
    "\u7B2C {{page}} \u9875 \xB7 ": "Page {{page}} \xB7 ",
    "\u6B63\u6587 \xB7 ": "Text \xB7 ",
    "\u6B63\u5728\u8BFB\u53D6 {{n}} \u4EFD\u8D44\u6599\u7684\u6B63\u6587\uFF0C\u7ED3\u679C\u4F1A\u81EA\u52A8\u8865\u5145\u2026": "Reading the text of {{n}} items; more results will appear\u2026",
    "\u6B63\u5728\u8BC6\u522B {{n}} \u9875\u2026": "Recognizing {{n}} pages\u2026",
    "\u90E8\u5206\u6B63\u6587\u6CA1\u6709\u8BFB\u5230\u3002": "Some text couldn\u2019t be read.",
    "\u6B63\u5728\u8BFB\u53D6\u2026": "Loading\u2026",
    "\u6B63\u5728\u8BFB\u53D6\u8D44\u6599": "Loading materials",
    "\u628A\u5E38\u7528\u7684\u8D44\u6599\u653E\u5728\u8FD9\u91CC": "Keep your teaching materials here",
    "\u8BFE\u4EF6\u3001\u8BD5\u5377\u3001\u8BB2\u4E49\u548C\u56FE\u7247\uFF0C\u4E0A\u4F20\u540E\u968F\u65F6\u9884\u89C8\u3001\u641C\u7D22\u6B63\u6587\u548C\u590D\u7528\u3002\u4E5F\u53EF\u4EE5\u76F4\u63A5\u628A\u6587\u4EF6\u62D6\u8FDB\u6765\u3002": "Slides, tests, handouts and images. Preview them, search their text and reuse them anytime. You can also drag files in.",
    "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8D44\u6599": "No matching materials",
    "\u6362\u4E2A\u5173\u952E\u8BCD\uFF0C\u6216\u8005\u6E05\u9664\u7B5B\u9009\u518D\u770B\u770B\u3002": "Try other words, or clear the filters.",
    "\u6CA1\u6709\u5F52\u6863\u7684\u8D44\u6599": "Nothing archived",
    "\u5F52\u6863\u7684\u8D44\u6599\u4F1A\u653E\u5728\u8FD9\u91CC\uFF0C\u968F\u65F6\u53EF\u4EE5\u6062\u590D\u3002": "Archived materials wait here, ready to restore.",
    "\u8FD9\u4E2A\u6587\u4EF6\u5939\u8FD8\u662F\u7A7A\u7684": "This folder is empty",
    "\u628A\u8D44\u6599\u62D6\u8FDB\u6765\uFF0C\u6216\u8005\u4E0A\u4F20\u4E00\u4EFD\u3002": "Drag materials in, or upload one.",
    "\u6E05\u9664\u7B5B\u9009": "Clear filters",
    "\u677E\u5F00\u5373\u53EF\u4E0A\u4F20": "Drop to upload",
    "\u653E\u8FDB\u201C{{name}}\u201D": "Into \u201C{{name}}\u201D",
    "\u653E\u8FDB\u8D44\u6E90\u5E93": "Into your library",
    "\u5DF2\u9009\u8D44\u6599\u64CD\u4F5C": "Selected materials",
    "\u5DF2\u9009 {{n}} \u4EFD": "{{n}} selected",
    "\u5168\u9009": "Select all",
    "\u79FB\u52A8": "Move",
    "\u52A0\u6807\u7B7E": "Tag",
    "\u5F52\u6863": "Archive",
    "\u6062\u590D": "Restore",
    /* ---------- settings ---------- */
    "\u5185\u5BB9\u80CC\u666F": "Content background",
    "\u81EA\u5B9A\u4E49": "Custom",
    "\u81EA\u5B9A\u4E49\u80CC\u666F": "Custom background",
    "\u4E0A\u4F20\u80CC\u666F\u56FE\u7247": "Upload a background image",
    "\u4E0A\u4F20\u56FE\u7247": "Upload",
    "\u66F4\u6362": "Replace",
    "\u70B9\u6309\u66F4\u6362\u56FE\u7247": "Click to choose another picture",
    "\u8BF7\u9009\u62E9\u4E0D\u8D85\u8FC7 20 MB \u7684 JPG\u3001PNG \u6216 WebP \u56FE\u7247\u3002": "Choose a JPG, PNG or WebP image up to 20 MB.",
    "\u8FD9\u5F20\u56FE\u7247\u8BFB\u4E0D\u51FA\u6765\uFF0C\u6362\u4E00\u5F20\u8BD5\u8BD5\u3002": "That picture couldn\u2019t be read. Try another one.",
    "\u4E0B\u8F7D": "Download",
    "\u5220\u9664\u8D44\u6599\u5305": "Delete package",
    "\u786E\u8BA4\u5220\u9664\u8FD9\u4E2A\u8D44\u6599\u5305": "Confirm deleting this package",
    "\u786E\u8BA4\u5220\u9664": "Delete",
    "\u76EE\u5F55": "Contents",
    "\u793A\u4F8B": "Sample",
    "TeachBuddy \u6570\u636E\u5904\u7406\u534F\u8BAE": "TeachBuddy Data Processing Agreement",
    "\u7248\u672C 0.1 \xB7 \u751F\u6548\u65E5\u671F 2026 \u5E74 9 \u6708 1 \u65E5": "Version 0.1 \xB7 Effective September 1, 2026",
    "\u8FD9\u4EFD\u534F\u8BAE\u8BF4\u660E TeachBuddy \u5982\u4F55\u4EE3\u4F60\u5904\u7406\u6559\u5B66\u6570\u636E\uFF1A\u5904\u7406\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48\u5904\u7406\uFF0C\u4EE5\u53CA\u4F60\u59CB\u7EC8\u62E5\u6709\u54EA\u4E9B\u6743\u5229\u3002": "This agreement explains how TeachBuddy handles your teaching data on your behalf: what we process, why, and the rights you always keep.",
    "\u4F60\u7684\u8D44\u6599\u5F52\u4F60\u6240\u6709": "Your data is yours",
    "\u6211\u4EEC\u53EA\u6309\u4F60\u7684\u6307\u793A\u4FDD\u5B58\u548C\u5904\u7406\u3002": "We store and process it only as you direct.",
    "\u4E0D\u51FA\u552E\uFF0C\u4E0D\u6295\u653E\u5E7F\u544A": "Never sold, never used for ads",
    "\u4E5F\u4E0D\u4F1A\u672A\u7ECF\u540C\u610F\u7528\u4E8E\u8BAD\u7EC3\u6A21\u578B\u3002": "And never used to train models without your consent.",
    "\u968F\u65F6\u5E26\u8D70": "Take it with you",
    "\u5BFC\u51FA\u5168\u90E8\u6570\u636E\uFF0C\u6216\u4E00\u952E\u5220\u9664\u8D26\u6237\u3002": "Export everything, or delete your account in one step.",
    "\u9002\u7528\u8303\u56F4": "Scope",
    "\u672C\u534F\u8BAE\u9002\u7528\u4E8E\u4F60\u5728 TeachBuddy \u4E2D\u521B\u5EFA\u3001\u4E0A\u4F20\u548C\u4FDD\u5B58\u7684\u5168\u90E8\u5185\u5BB9\uFF0C\u5305\u62EC\u9898\u76EE\u3001\u8D44\u6599\u3001\u65E5\u7A0B\u3001\u6570\u5B66\u4F5C\u54C1\u548C\u4E0E\u6559\u5B66\u52A9\u7406\u7684\u5BF9\u8BDD\u3002": "This agreement covers everything you create, upload and save in TeachBuddy, including questions, files, schedules, math works and conversations with the assistant.",
    "\u5728\u672C\u534F\u8BAE\u4E2D\uFF0C\u4F60\u662F\u6570\u636E\u7684\u201C\u63A7\u5236\u8005\u201D\uFF0C\u51B3\u5B9A\u8FD9\u4E9B\u6570\u636E\u4E3A\u4F55\u4EE5\u53CA\u5982\u4F55\u88AB\u4F7F\u7528\uFF1BTeachBuddy \u662F\u201C\u5904\u7406\u8005\u201D\uFF0C\u53EA\u6309\u4F60\u7684\u6307\u793A\u5904\u7406\u5B83\u4EEC\u3002": "You are the controller of this data and decide why and how it is used. TeachBuddy is the processor and handles it only on your instructions.",
    "\u5904\u7406\u76EE\u7684": "Purpose",
    "\u6211\u4EEC\u53EA\u4E3A\u5411\u4F60\u63D0\u4F9B TeachBuddy \u7684\u529F\u80FD\u800C\u5904\u7406\u6570\u636E\uFF1A\u4FDD\u5B58\u4E0E\u540C\u6B65\u3001\u641C\u7D22\u3001\u751F\u6210\u9884\u89C8\uFF0C\u4EE5\u53CA\u5728\u4F60\u4E3B\u52A8\u63D0\u95EE\u65F6\u7531\u6559\u5B66\u52A9\u7406\u8BFB\u53D6\u76F8\u5173\u5185\u5BB9\u3002": "We process data only to provide TeachBuddy: saving and syncing, search, previews, and letting the assistant read relevant content when you ask it something.",
    "\u6211\u4EEC\u4E0D\u4F1A\u51FA\u552E\u4F60\u7684\u6570\u636E\uFF0C\u4E0D\u4F1A\u7528\u5B83\u6295\u653E\u5E7F\u544A\uFF0C\u4E5F\u4E0D\u4F1A\u5728\u672A\u7ECF\u4F60\u540C\u610F\u7684\u60C5\u51B5\u4E0B\u7528\u5B83\u8BAD\u7EC3\u6A21\u578B\u3002": "We never sell your data, never use it for advertising, and never use it to train models without your consent.",
    "\u5B89\u5168\u63AA\u65BD": "Security",
    "\u4F20\u8F93\u4E0E\u5B58\u50A8\u5168\u7A0B\u52A0\u5BC6": "Encrypted in transit and at rest",
    "\u6309\u6700\u5C0F\u6743\u9650\u539F\u5219\u63A7\u5236\u5185\u90E8\u8BBF\u95EE\uFF0C\u5E76\u7559\u5B58\u8BBF\u95EE\u8BB0\u5F55": "Least-privilege internal access, with access logs kept",
    "\u5B9A\u671F\u5907\u4EFD\uFF0C\u5E76\u6F14\u7EC3\u4ECE\u5907\u4EFD\u4E2D\u6062\u590D": "Regular backups, with restore drills",
    "\u5B50\u5904\u7406\u65B9": "Subprocessors",
    "\u6211\u4EEC\u53EF\u80FD\u59D4\u6258\u4E91\u670D\u52A1\u4E0E\u6A21\u578B\u670D\u52A1\u63D0\u4F9B\u65B9\u534F\u52A9\u5904\u7406\u6570\u636E\u3002\u6BCF\u4E00\u5BB6\u90FD\u987B\u7B7E\u7F72\u4E0D\u4F4E\u4E8E\u672C\u534F\u8BAE\u6807\u51C6\u7684\u4E66\u9762\u534F\u8BAE\uFF0C\u53D8\u66F4\u524D\u6211\u4EEC\u4F1A\u63D0\u524D\u901A\u77E5\u4F60\u3002": "We may use cloud and model providers to help process data. Each must sign a written agreement at least as strict as this one, and we\u2019ll notify you before any change.",
    "\u4FDD\u7559\u4E0E\u5220\u9664": "Retention and deletion",
    "\u4F60\u53EF\u4EE5\u968F\u65F6\u5728\u201C\u8BBE\u7F6E\u201D\u4E2D\u5BFC\u51FA\u5168\u90E8\u6570\u636E\uFF0C\u6216\u5220\u9664\u8D26\u6237\u3002\u5220\u9664\u540E\uFF0C\u6570\u636E\u4F1A\u5728 30 \u5929\u5185\u4ECE\u5728\u7EBF\u7CFB\u7EDF\u4E2D\u6E05\u9664\uFF0C\u5E76\u5728\u4E0B\u4E00\u4E2A\u5907\u4EFD\u5468\u671F\u7ED3\u675F\u540E\u4ECE\u5907\u4EFD\u4E2D\u6E05\u9664\u3002": "You can export all your data or delete your account in Settings at any time. After deletion, data is removed from live systems within 30 days and from backups at the end of the next backup cycle.",
    "\u4F60\u7684\u6743\u5229": "Your rights",
    "\u67E5\u9605\u548C\u5BFC\u51FA\u4F60\u7684\u6570\u636E": "See and export your data",
    "\u66F4\u6B63\u4E0D\u51C6\u786E\u7684\u4FE1\u606F": "Correct inaccurate information",
    "\u5220\u9664\u6570\u636E\u6216\u6CE8\u9500\u8D26\u6237": "Delete data or close your account",
    "\u5C31\u6570\u636E\u5904\u7406\u65B9\u5F0F\u63D0\u51FA\u7591\u95EE\u6216\u6295\u8BC9": "Ask questions or raise complaints about processing",
    "\u8FD9\u662F\u4E00\u4EFD\u6A21\u62DF\u534F\u8BAE": "This is a sample agreement",
    "TeachBuddy \u76EE\u524D\u8FD8\u6CA1\u6709\u6B63\u5F0F\u7684\u6570\u636E\u5904\u7406\u534F\u8BAE\u3002\u4EE5\u4E0A\u5185\u5BB9\u4EC5\u7528\u4E8E\u5C55\u793A\u9875\u9762\u6392\u7248\uFF0C\u4E0D\u6784\u6210\u4EFB\u4F55\u627F\u8BFA\uFF0C\u4E5F\u4E0D\u5177\u5907\u6CD5\u5F8B\u6548\u529B\u3002\u6B63\u5F0F\u534F\u8BAE\u53D1\u5E03\u540E\uFF0C\u4F1A\u5728\u8FD9\u91CC\u66FF\u6362\u5E76\u901A\u77E5\u4F60\u3002": "TeachBuddy doesn\u2019t have a formal data processing agreement yet. The text above only shows how this page will look. It makes no commitments and has no legal effect. When the real agreement is ready, it will replace this one and we\u2019ll let you know.",
    "\u5371\u9669\u64CD\u4F5C": "Danger Zone",
    "\u8FD9\u91CC\u7684\u64CD\u4F5C\u65E0\u6CD5\u64A4\u9500\uFF0C\u8BF7\u786E\u8BA4\u540E\u518D\u7EE7\u7EED\u3002": "These actions can\u2019t be undone. Be sure before you continue.",
    "\u5220\u9664\u8D26\u6237": "Delete Account",
    "\u6C38\u4E45\u5220\u9664\u8D26\u6237\u548C\u5168\u90E8\u6570\u636E\uFF0C\u5305\u62EC\u9898\u5E93\u3001\u65E5\u7A0B\u3001\u8D44\u6599\u4E0E\u52A9\u7406\u5BF9\u8BDD\u3002": "Permanently deletes your account and all data, including questions, schedule, files and assistant chats.",
    "\u5220\u9664\u8D26\u6237\u2026": "Delete Account\u2026",
    // question bank
    "{{n}} \u9053\u9898": "{{n}} questions",
    "{{n}} \u9053\u9898_one": "{{n}} question",
    "{{n}} \u9053\u9898_other": "{{n}} questions",
    "\u4E5F\u641C\u7D22\u7B54\u6848\u4E0E\u89E3\u6790": "Include answers",
    "\u4ECE\u5217\u8868\u91CC\u9009\u4E00\u9053\u9898\uFF0C\u67E5\u770B\u7B54\u6848\u3001\u6539\u7F16\uFF0C\u6216\u5BFC\u51FA\u6210\u56FE\u7247\u653E\u8FDB\u8BFE\u4EF6\u3002": "Pick a question from the list to see the answer, adapt it, or export it as an image for your slides.",
    "\u5168\u90E8\u9898\u76EE": "All Questions",
    "\u6536\u5F55\u8BD5\u5377\u3001\u622A\u56FE\u6216\u6587\u5B57\u91CC\u7684\u9898\u76EE\uFF0C\u4E4B\u540E\u968F\u65F6\u67E5\u627E\u3001\u6539\u7F16\u548C\u5BFC\u51FA\u3002": "Import questions from papers, screenshots or text, then find, adapt and export them anytime.",
    "\u65B0\u5EFA\u9898\u76EE": "New Question",
    "\u8FD8\u6CA1\u6709\u9898\u578B": "No types yet",
    "\u9898\u5E93\u5BFC\u822A": "Question bank navigation",
    "\u9898\u578B": "Types",
    "\u5DF2\u6807\u8BB0": "Starred",
    "\u641C\u7D22\u9898\u5E72\u3001\u516C\u5F0F\u6216\u7B14\u8BB0": "Search questions",
    "\u641C\u7D22\u9898\u76EE\u3001\u7B54\u6848\u6216\u7B14\u8BB0": "Search questions and answers",
    // math workshop
    "{{n}} \u4E2A\u4F5C\u54C1": "{{n}} works",
    "{{n}} \u4E2A\u4F5C\u54C1_one": "{{n}} work",
    "{{n}} \u4E2A\u4F5C\u54C1_other": "{{n}} works",
    "\u5F7B\u5E95\u5220\u9664": "Delete",
    "\u4EA4\u7ED9\u52A9\u7406\u8D77\u4E2A\u5934": "Let the assistant start it",
    "\u4ECE\u4E0A\u9762\u6311\u4E00\u79CD\u65B9\u5F0F\u5F00\u59CB\uFF0C\u505A\u597D\u7684\u4F5C\u54C1\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002": "Pick a way to start above. Your works will show up here.",
    "\u4ECE\u516C\u5F0F\u3001\u56FE\u5F62\u6216\u53C2\u6570\u5F00\u59CB": "Start with a formula, graph or slider",
    "\u4F5C\u54C1\u663E\u793A\u65B9\u5F0F": "Works view",
    "\u5168\u90E8\u4F5C\u54C1": "All Works",
    "\u516C\u5F0F\u4E0E\u56FE\u5F62": "Interactive",
    "\u5BFC\u5165\u4F5C\u54C1": "Import Work",
    "\u5BFC\u5165\u7F51\u9875": "Import HTML",
    "\u5728\u53F3\u4FA7\u52A9\u7406\u91CC\u8BF4\u8BF4\u60F3\u505A\u4EC0\u4E48\uFF0C\u5B83\u4F1A\u5E2E\u4F60\u642D\u597D\u4F5C\u54C1\u3002": "Tell the assistant on the right what you want to make, and it will set the work up for you.",
    "\u5BFC\u5165": "Import",
    "\u5F52\u6863\u7684\u4F5C\u54C1\u4F1A\u653E\u5728\u8FD9\u91CC\uFF0C\u968F\u65F6\u53EF\u4EE5\u6062\u590D\u3002": "Archived works stay here. You can restore them anytime.",
    "\u6362\u4E2A\u5206\u7C7B\u770B\u770B\uFF0C\u6216\u8005\u65B0\u5EFA\u4E00\u4E2A\u4F5C\u54C1\u3002": "Try another category, or create a new work.",
    "\u63A8\u5BFC\u4E00\u5143\u4E8C\u6B21\u65B9\u7A0B\u7684\u6C42\u6839\u516C\u5F0F": "Derive the quadratic formula",
    "\u6F14\u793A\u6B63\u65B9\u4F53\u7684\u5C55\u5F00": "Show how a cube unfolds",
    "\u6570\u5B66\u5DE5\u574A\u5BFC\u822A": "Math Workshop navigation",
    "\u6700\u8FD1\u7F16\u8F91": "Recently Edited",
    "\u7A7A\u767D\u4F5C\u54C1": "Blank Work",
    "\u8FD9\u91CC\u8FD8\u662F\u7A7A\u7684": "Nothing here yet",
    "{{date}} \u7F16\u8F91": "Edited {{date}}",
    "{{date}} \u5F52\u6863": "Archived {{date}}",
    "\u516C\u5F0F": "Formula",
    "\u56FE\u5F62": "Graph",
    // classroom
    "\u73ED\u7EA7": "Classes",
    "\u54EA\u4E2A\u73ED": "Class",
    "\u5355\u5143\u683C\u6709\u9519\u8BEF\u6216\u516C\u5F0F\u6CA1\u6709\u7ED3\u679C": "This cell has an error, or a formula with no result",
    "\u201C{{text}}\u201D\u4E0D\u662F\u5206\u6570": "\u201C{{text}}\u201D isn\u2019t a score",
    "\u5206\u6570\u6700\u591A\u4E24\u4F4D\u5C0F\u6570": "Scores can have at most two decimals",
    "\u5B66\u53F7 {{no}} \u662F {{name}}\uFF0C\u8868\u4E2D\u5199\u7684\u662F {{sheet}}": "No. {{no}} is {{name}}, but the sheet says {{sheet}}",
    "\u672C\u73ED\u6CA1\u6709\u5B66\u53F7 {{no}}": "No student numbered {{no}} in this class",
    "\u8868\u4E2D\u6CA1\u6709\u5B66\u53F7\uFF0C\u6309\u59D3\u540D\u5339\u914D": "No student number in the sheet; matched by name",
    "\u672C\u73ED\u6709 {{n}} \u4F4D {{name}}\uFF0C\u8BF7\u9009\u62E9\u662F\u54EA\u4E00\u4F4D": "{{n}} students named {{name}} \u2014 choose which one",
    "\u672C\u73ED\u6CA1\u6709 {{name}}": "No {{name}} in this class",
    "\u8FD9\u4E00\u884C\u6CA1\u6709\u59D3\u540D\u6216\u5B66\u53F7": "This row has no name or number",
    "\u8BF7\u9009\u62E9\u8FD9\u4E00\u884C\u662F\u54EA\u4F4D\u5B66\u751F\uFF0C\u6216\u5FFD\u7565\u8FD9\u4E00\u884C": "Choose the student for this row, or skip it",
    "\u6240\u9009\u5B66\u751F\u4E0D\u5728\u672C\u73ED\u5F53\u524D\u540D\u5355\u4E2D": "That student isn\u2019t on this class\u2019s roster",
    "{{label}} \u7684 {{v}} \u8D85\u51FA\u6EE1\u5206 {{full}}": "{{label}}: {{v}} is more than the full {{full}}",
    "\u603B\u5206 {{v}} \u8D85\u51FA\u6EE1\u5206 {{full}}": "Total {{v}} is more than the full {{full}}",
    "\u9010\u9898\u5408\u8BA1 {{sum}}\uFF0C\u603B\u5206\u5199\u7684\u662F {{total}}\uFF1B\u6392\u540D\u7528\u8868\u4E2D\u7684\u603B\u5206": "Questions add up to {{sum}} but the total says {{total}}; ranking uses the total",
    "\u6CA1\u6709\u603B\u5206\uFF0C\u8FD9\u6B21\u4E0D\u53C2\u4E0E\u6392\u540D": "No total, so not ranked this time",
    "\u540C\u4E00\u4F4D\u5B66\u751F\u51FA\u73B0\u5728\u591A\u884C\uFF0C\u8BF7\u4FDD\u7559\u4E00\u884C": "This student appears in more than one row \u2014 keep one",
    "\u672A\u8003\u5230": "Not tested",
    "\u9009\u62E9\u6210\u7EE9\u8868": "Choose Sheet",
    "\u5BF9\u5E94\u8868\u683C\u7684\u5217": "Match Columns",
    "\u9010\u884C\u6821\u5BF9": "Review Rows",
    "\u5168\u90E8\u65F6\u95F4": "All Time",
    "\u6700\u8FD1 30 \u5929": "Last 30 Days",
    "\u6700\u8FD1 3 \u4E2A\u6708": "Last 3 Months",
    "Excel\uFF08.xlsx\uFF09\uFF0C\u6700\u5927 10 MB\u3002\u6709\u9010\u9898\u5F97\u5206\u5C31\u4E00\u8D77\u5BFC\u5165\uFF1B\u53EA\u6709\u603B\u5206\u4E5F\u53EF\u4EE5\u3002": "Excel (.xlsx), up to 10 MB. Per-question scores come along if the sheet has them; totals alone work too.",
    "Word\u3001PDF \u6216\u56FE\u7247\u90FD\u53EF\u4EE5\u3002\u6CA1\u6709\u539F\u5377\uFF0C\u6210\u7EE9\u4E5F\u80FD\u7167\u5E38\u4FDD\u5B58\uFF1B\u53EA\u662F\u770B\u9898\u65F6\u5C11\u4E86\u8BC1\u636E\u3002": "Word, PDF or images. Scores save fine without the paper; you just won\u2019t have it to look back at.",
    "{{cls}} \xB7 {{exam}}\uFF1A{{a}} \u4EBA\u53C2\u52A0\uFF0C{{b}} \u4EBA\u7F3A\u8003\uFF0C{{c}} \u4EBA\u672A\u8BB0\u5F55\u3002": "{{cls}} \xB7 {{exam}}: {{a}} took it, {{b}} absent, {{c}} not recorded.",
    "{{date}} \xB7 {{n}} \u5C81": "{{date}} \xB7 age {{n}}",
    "{{from}}\u2013{{to}} \u533A\u95F4 {{n}} \u4EBA": "{{from}}\u2013{{to}}: {{n}} students",
    "{{from}}\u2013{{to}} \u533A\u95F4 {{n}} \u4EBA_one": "{{from}}\u2013{{to}}: {{n}} student",
    "{{from}}\u2013{{to}} \u533A\u95F4 {{n}} \u4EBA_other": "{{from}}\u2013{{to}}: {{n}} students",
    "{{from}}\u2013{{to}}% \xB7 {{n}} \u4EBA": "{{from}}\u2013{{to}}% \xB7 {{n}} students",
    "{{from}}\u2013{{to}}% \xB7 {{n}} \u4EBA_one": "{{from}}\u2013{{to}}% \xB7 {{n}} student",
    "{{from}}\u2013{{to}}% \xB7 {{n}} \u4EBA_other": "{{from}}\u2013{{to}}% \xB7 {{n}} students",
    "{{m}} \u6708": "{{m}}",
    "{{name}} \xB7 \u5404\u9898": "{{name}} \xB7 By Question",
    "{{name}}\u7684\u5F97\u5206\u7387": "{{name}}\u2019s rate",
    "{{name}}\uFF0C\u7B2C {{row}} \u6392\u7B2C {{col}} \u5EA7": "{{name}}, row {{row}}, seat {{col}}",
    "{{n}} \u4E2A\u5DE5\u4F5C\u8868": "{{n}} sheets",
    "{{n}} \u4E2A\u5DE5\u4F5C\u8868_one": "{{n}} sheet",
    "{{n}} \u4E2A\u5DE5\u4F5C\u8868_other": "{{n}} sheets",
    "{{n}} \u4E2A\u63D0\u9192": "{{n}} notes",
    "{{n}} \u4E2A\u63D0\u9192_one": "{{n}} note",
    "{{n}} \u4E2A\u63D0\u9192_other": "{{n}} notes",
    "{{n}} \u4E2A\u6807\u7B7E": "{{n}} tags",
    "{{n}} \u4E2A\u6807\u7B7E_one": "{{n}} tag",
    "{{n}} \u4E2A\u6807\u7B7E_other": "{{n}} tags",
    "{{n}} \u4E2A\u73ED \xB7 {{m}} \u540D\u5B66\u751F": "{{n}} classes \xB7 {{m}} students",
    "{{n}} \u4E2A\u73ED \xB7 {{m}} \u540D\u5B66\u751F_one": "{{n}} class \xB7 {{m}} students",
    "{{n}} \u4E2A\u73ED \xB7 {{m}} \u540D\u5B66\u751F_other": "{{n}} classes \xB7 {{m}} students",
    "{{n}} \u4EBA": "{{n}} students",
    "{{n}} \u4EBA_one": "{{n}} student",
    "{{n}} \u4EBA_other": "{{n}} students",
    "{{n}} \u4F4D\u5B66\u751F\u56DE\u5230\u4E86\u201C\u8FD8\u6CA1\u6709\u5EA7\u4F4D\u201D": "{{n}} students moved back to \u201CNo seat yet\u201D",
    "{{n}} \u4F4D\u5B66\u751F\u56DE\u5230\u4E86\u201C\u8FD8\u6CA1\u6709\u5EA7\u4F4D\u201D_one": "{{n}} student moved back to \u201CNo seat yet\u201D",
    "{{n}} \u4F4D\u5B66\u751F\u56DE\u5230\u4E86\u201C\u8FD8\u6CA1\u6709\u5EA7\u4F4D\u201D_other": "{{n}} students moved back to \u201CNo seat yet\u201D",
    "{{n}} \u5206": "{{n}} pts",
    "{{n}} \u540D\u5B66\u751F": "{{n}} students",
    "{{n}} \u540D\u5B66\u751F_one": "{{n}} student",
    "{{n}} \u540D\u5B66\u751F_other": "{{n}} students",
    "{{n}} \u573A \xB7 \u4E00\u4EFD\u8BD5\u5377\u53EF\u4EE5\u7ED9\u591A\u4E2A\u73ED\u7528": "{{n}} exams \xB7 one paper can serve several classes",
    "{{n}} \u573A \xB7 \u4E00\u4EFD\u8BD5\u5377\u53EF\u4EE5\u7ED9\u591A\u4E2A\u73ED\u7528_one": "{{n}} exam \xB7 one paper can serve several classes",
    "{{n}} \u573A \xB7 \u4E00\u4EFD\u8BD5\u5377\u53EF\u4EE5\u7ED9\u591A\u4E2A\u73ED\u7528_other": "{{n}} exams \xB7 one paper can serve several classes",
    "{{n}} \u573A\u8003\u8BD5": "{{n}} exams",
    "{{n}} \u573A\u8003\u8BD5_one": "{{n}} exam",
    "{{n}} \u573A\u8003\u8BD5_other": "{{n}} exams",
    "{{n}} \u5904\u9700\u8981\u5904\u7406": "{{n}} to fix",
    "{{n}} \u6761": "{{n}} notes",
    "{{n}} \u6761_one": "{{n}} note",
    "{{n}} \u6761_other": "{{n}} notes",
    "{{n}} \u884C": "{{n}} rows",
    "{{n}} \u884C_one": "{{n}} row",
    "{{n}} \u884C_other": "{{n}} rows",
    "{{n}} \u9053\u8BA1\u5206\u9898": "{{n}} scored questions",
    "{{n}} \u9053\u8BA1\u5206\u9898_one": "{{n}} scored question",
    "{{n}} \u9053\u8BA1\u5206\u9898_other": "{{n}} scored questions",
    "{{n}} \u9053\u9898\uFF0C\u5408\u8BA1 {{s}} \u5206": "{{n}} questions, {{s}} points in all",
    "{{n}} \u9053\u9898\uFF0C\u5408\u8BA1 {{s}} \u5206_one": "{{n}} question, {{s}} points in all",
    "{{n}} \u9053\u9898\uFF0C\u5408\u8BA1 {{s}} \u5206_other": "{{n}} questions, {{s}} points in all",
    "{{r}} \u6392 \xD7 {{c}} \u5217": "{{r}} rows \xD7 {{c}} seats",
    "\u4E00\u53E5\u8BDD\u3001\u4E00\u6B21\u8C08\u8BDD\u3001\u4E00\u4E2A\u7EA6\u5B9A\uFF0C\u90FD\u503C\u5F97\u8BB0\u4E0B\u6765\u3002": "Something they said, a conversation, a promise \u2014 it\u2019s all worth writing down.",
    "\u4E00\u573A\u8003\u8BD5\u5C31\u662F\u540C\u4E00\u6B21\u3001\u540C\u4E00\u4EFD\u8BD5\u5377\uFF1A\u540D\u79F0\u3001\u65E5\u671F\u3001\u6BCF\u9053\u8BA1\u5206\u9898\u7684\u6EE1\u5206\u3002\u5EFA\u597D\u540E\u628A\u5404\u73ED\u7684\u6210\u7EE9\u8868\u5BFC\u8FDB\u6765\u3002": "An exam is one sitting of one paper: a name, a date, and the full marks of each scored question. Then bring in each class\u2019s score sheet.",
    "\u4E0A\u4F20": "Upload",
    "\u4E2D\u4F4D\u6570": "Median",
    "\u4ECA\u5929\u8BB2\u5230\u54EA\u91CC\u4E86\uFF1F\u6709\u4EC0\u4E48\u5171\u540C\u7684\u95EE\u9898\u3001\u8BB2\u89E3\u7684\u6548\u679C\uFF0C\u6216\u4E0B\u4E00\u8282\u8BFE\u60F3\u505A\u7684\u4E8B\u2026\u2026": "Where did you get to today? Common mistakes, what worked, what to try next lesson\u2026",
    "\u4ECE\u7B2C\u51E0\u884C\u5F00\u59CB": "First data row",
    "\u4ED6\u4EEC\u4F1A\u8BB0\u4E3A\u201C\u672A\u8BB0\u5F55\u201D\uFF0C\u4E0D\u8BA1\u5206\uFF0C\u4E5F\u4E0D\u7B97\u7F3A\u8003\u3002": "They\u2019ll be marked \u201CNot recorded\u201D \u2014 no score, and not counted as absent.",
    "\u4F8B\u5982\uFF1A2026 \u79CB\u5B63\u5B66\u671F": "e.g. Fall 2026",
    "\u4F8B\u5982\uFF1A\u521D\u4E09\uFF082\uFF09\u73ED": "e.g. Grade 9, Class 2",
    "\u4F8B\u5982\uFF1A\u5B89\u9759\uFF0C\u4F46\u8BB2\u5230\u611F\u5174\u8DA3\u7684\u9898\u4F1A\u62A2\u7740\u56DE\u7B54": "e.g. Quiet, but jumps in when a problem catches their interest",
    "\u4F8B\u5982\uFF1A\u671F\u4E2D\u8003\u8BD5": "e.g. Midterm",
    "\u4F8B\u5982\uFF1A\u7BEE\u7403\u3001\u79D1\u5E7B\u5C0F\u8BF4\u3001\u753B\u753B": "e.g. Basketball, sci-fi, drawing",
    "\u4FDD\u5B58": "Save",
    "\u4FDD\u5B58\u5E76\u7EE7\u7EED\u6DFB\u52A0": "Save and Add Another",
    "\u5148\u5EFA\u4E00\u573A\u8003\u8BD5\uFF1A\u540D\u79F0\u3001\u65E5\u671F\u3001\u6BCF\u9053\u8BA1\u5206\u9898\u7684\u6EE1\u5206\u3002\u4E4B\u540E\u628A\u6210\u7EE9\u8868\u5BFC\u8FDB\u6765\uFF0C\u5C31\u80FD\u770B\u5230\u5168\u73ED\u7684\u6837\u5B50\u3002": "Start with an exam: a name, a date and the full marks of each question. Bring in the score sheet and you\u2019ll see how the class did.",
    "\u5148\u628A\u540D\u5355\u52A0\u8FDB\u6765\u3002\u4E4B\u540E\u7684\u5EA7\u4F4D\u3001\u8BB0\u5F55\u548C\u6210\u7EE9\u90FD\u56F4\u7ED5\u4ED6\u4EEC\u3002": "Add your roster first. Seats, notes and scores all build on it.",
    "\u5148\u628A\u5B66\u751F\u52A0\u8FDB\u6765": "Add students first",
    "\u5148\u65B0\u5EFA\u4E00\u573A\u8003\u8BD5\uFF0C\u5199\u597D\u6BCF\u9053\u8BA1\u5206\u9898\u7684\u6EE1\u5206\u3002": "Create an exam first, with the full marks of each scored question.",
    "\u5168\u73ED\u7684\u53D8\u5316": "How the Class Is Doing",
    "\u5168\u90E8": "All",
    "\u5168\u90E8\u5230\u9F50": "Everyone took it",
    "\u5168\u90E8\u6807\u7B7E": "All Tags",
    "\u5168\u90E8\u8003\u8BD5": "All Exams",
    "\u5173\u95ED": "Close",
    "\u5174\u8DA3": "Interests",
    "\u5185\u5BB9\u5DF2\u5728\u522B\u5904\u66F4\u65B0\uFF0C\u8BF7\u5237\u65B0\u540E\u518D\u8BD5\u3002": "This was changed somewhere else. Refresh and try again.",
    "\u51CF\u5C11\u4E00\u5217": "Remove a Column",
    "\u51CF\u5C11\u4E00\u6392": "Remove a Row",
    "\u5206": "pts",
    "\u5206\u6570\u6765\u81EA\u6700\u8FD1\u4E00\u573A\uFF1A{{name}}": "Scores from the latest exam: {{name}}",
    "\u5206\u7EC4": "Section",
    "\u521B\u5EFA\u73ED\u7EA7": "Create Class",
    "\u521B\u5EFA\u8003\u8BD5": "Create Exam",
    "\u5230\u7B2C\u51E0\u884C": "Last row",
    "\u5386\u6B21\u5F97\u5206\u7387": "Score Rate Over Time",
    "\u539F\u5377": "Exam Paper",
    "\u539F\u5377\u5DF2\u4E0A\u4F20": "Paper uploaded",
    "\u539F\u8868\u548C\u6821\u5BF9\u7ED3\u679C\u90FD\u7559\u7740\uFF1B\u4E4B\u540E\u53D1\u73B0\u9519\u4E86\uFF0C\u53EF\u4EE5\u5728\u5B66\u751F\u7684\u6210\u7EE9\u91CC\u4FEE\u6B63\u3002": "The original sheet and your review are kept. If you spot a mistake later, fix it in the student\u2019s scores.",
    "\u53C2\u52A0": "Took it",
    "\u53D6\u6D88": "Cancel",
    "\u53EA\u6709\u59D3\u540D\u662F\u5FC5\u586B\u7684\u3002\u6027\u683C\u3001\u5174\u8DA3\u60F3\u5230\u518D\u5199\uFF0C\u4E0D\u5FC5\u4E00\u6B21\u586B\u5B8C\u3002": "Only the name is required. Add personality and interests whenever they come to mind.",
    "\u5404\u573A\u6EE1\u5206\u548C\u96BE\u5EA6\u4E0D\u540C\uFF0C\u66F2\u7EBF\u53EA\u662F\u53C2\u8003\uFF0C\u4E0D\u4EE3\u8868\u80FD\u529B\u7684\u5347\u964D\u3002": "Exams differ in full marks and difficulty, so the line is a guide, not a measure of ability.",
    "\u5404\u9898\u5F97\u5206\u7387": "Score Rate by Question",
    "\u5408\u5E76": "Merge",
    "\u5408\u5E76\u5230\u201C{{b}}\u201D": "Merge into \u201C{{b}}\u201D",
    "\u5408\u8BA1 {{s}} / \u6EE1\u5206 {{f}}": "{{s}} of {{f}} points",
    "\u5408\u8BA1 {{s}}\uFF0C\u8986\u76D6\u6574\u5377": "{{s}} points, covers the whole paper",
    "\u540C\u4E00\u4EFD\u8BD5\u5377\u3001\u540C\u4E00\u5957\u53E3\u5F84\uFF1B\u6CA1\u6709\u6210\u7EE9\u7684\u73ED\u7EA7\u4E0D\u8BB0\u96F6\u3002": "Same paper, same rules. Classes without results aren\u2019t counted as zero.",
    "\u540C\u5206\u5E76\u5217": "Ties share a rank",
    "\u540C\u573A\u6BD4\u8F83": "Class Comparison",
    "\u589E\u52A0\u4E00\u5217": "Add a Column",
    "\u589E\u52A0\u4E00\u6392": "Add a Row",
    "\u591A\u4E2A\u6807\u7B7E\u6309\u9898\u76EE\u5408\u5E76\uFF0C\u540C\u4E00\u9898\u53EA\u7B97\u4E00\u6B21": "Each question counts once, even with several tags",
    "\u5982\uFF1A\u4E00\u3001\u9009\u62E9\u9898": "e.g. Part 1: Multiple choice",
    "\u59D3\u540D": "Name",
    "\u5B66\u53F7": "Student No.",
    "\u5B66\u53F7 {{n}}": "No. {{n}}",
    "\u5B66\u671F": "Term",
    "\u5B66\u751F": "Students",
    "\u5B66\u751F\u4F1A\u79FB\u5230\u201C\u5DF2\u5F52\u6863\u201D\uFF0C\u5EA7\u4F4D\u7A7A\u51FA\u6765\uFF1B\u8BB0\u5F55\u548C\u5386\u53F2\u6210\u7EE9\u90FD\u4FDD\u7559\u3002\u6062\u590D\u540E\u4E0D\u4F1A\u81EA\u52A8\u5750\u56DE\u539F\u6765\u7684\u5EA7\u4F4D\u3002": "The student moves to Archived and their seat opens up. Notes and past scores are kept. Restoring doesn\u2019t put them back in their old seat.",
    "\u5B66\u751F\u64CD\u4F5C": "Student actions",
    "\u5B66\u751F\u89C6\u56FE": "Student view",
    "\u5B66\u751F\u8D44\u6599": "Student Profile",
    "\u5B66\u79D1": "Subject",
    "\u5B8C\u6210": "Done",
    "\u5BF9\u5E94\u5B66\u751F": "Student",
    "\u5BFC\u5165\u4E00\u573A\u8003\u8BD5\u7684\u6210\u7EE9\u8868\u540E\uFF0C\u8FD9\u91CC\u4F1A\u6309\u65F6\u95F4\u5217\u51FA\u6BCF\u4E00\u573A\u3002": "Once you bring in a score sheet, each exam shows up here in order.",
    "\u5BFC\u5165\u6210\u7EE9": "Import Scores",
    "\u5BFC\u5165\u8FD9\u4E2A\u73ED": "Import for This Class",
    "\u5C31\u662F {{name}}": "Yes, it\u2019s {{name}}",
    "\u5DE5\u4F5C\u8868": "Sheet",
    "\u5DF2\u4E3A {{n}} \u4F4D\u5B66\u751F\u5B89\u6392\u5EA7\u4F4D": "Seated {{n}} students",
    "\u5DF2\u4E3A {{n}} \u4F4D\u5B66\u751F\u5B89\u6392\u5EA7\u4F4D_one": "Seated {{n}} student",
    "\u5DF2\u4E3A {{n}} \u4F4D\u5B66\u751F\u5B89\u6392\u5EA7\u4F4D_other": "Seated {{n}} students",
    "\u5DF2\u4FDD\u5B58": "Saved",
    "\u5DF2\u5408\u5E76": "Merged",
    "\u5DF2\u5FFD\u7565": "Skipped",
    "\u5DF2\u6062\u590D": "Restored",
    "\u5DF2\u6DFB\u52A0 {{name}}": "Added {{name}}",
    "\u5DF2\u77E5 {{k}} \xB7 \u7F3A {{m}}": "{{k}} known \xB7 {{m}} missing",
    "\u5E73\u5747 \xB7 {{r}}": "Mean \xB7 {{r}}",
    "\u5E73\u5747\u5206": "Mean",
    "\u5E73\u5747\u5F97\u5206\u7387": "Mean rate",
    "\u5EA7\u4F4D": "Seats",
    "\u5EFA\u597D\u540E\uFF0C\u628A\u5B66\u751F\u52A0\u8FDB\u6765\uFF0C\u518D\u6392\u4E00\u6392\u5EA7\u4F4D\u3002": "Then add your students and arrange the seats.",
    "\u5F52\u6863 {{name}}\uFF1F": "Archive {{name}}?",
    "\u5F52\u6863\u201C{{name}}\u201D\uFF1F": "Archive \u201C{{name}}\u201D?",
    "\u5F52\u6863\u540E\u8FD9\u573A\u8003\u8BD5\u9000\u51FA\u7EDF\u8BA1\uFF1B\u6062\u590D\u540E\uFF0C\u539F\u6765\u7684\u6210\u7EE9\u4F1A\u91CD\u65B0\u53C2\u4E0E\u3002": "Archived exams leave the statistics. Restore it and its scores count again.",
    "\u5F52\u6863\u5B66\u751F": "Archive Student",
    "\u5F52\u6863\u73ED\u7EA7": "Archive Class",
    "\u5F52\u6863\u7684\u5185\u5BB9\u90FD\u5728\u8FD9\u91CC\uFF0C\u5173\u7CFB\u548C\u5386\u53F2\u6210\u7EE9\u539F\u6837\u4FDD\u7559\u3002": "Everything you\u2019ve archived, with its links and past scores intact.",
    "\u5F52\u6863\u7684\u73ED\u7EA7\u3001\u5B66\u751F\u3001\u8003\u8BD5\u548C\u8BB0\u5F55\u4F1A\u653E\u5728\u8FD9\u91CC\uFF0C\u968F\u65F6\u53EF\u4EE5\u6062\u590D\u3002": "Archived classes, students, exams and notes stay here. You can restore them anytime.",
    "\u5F52\u6863\u8003\u8BD5": "Archive Exam",
    "\u5F97\u5206\u7387\u5206\u5E03": "Score Distribution",
    "\u5F97\u5206\u7387\u63CF\u8FF0\u7684\u662F\u8FD9\u573A\u8003\u8BD5\u7684\u8BC1\u636E\uFF0C\u4E0D\u7B49\u4E8E\u77E5\u8BC6\u638C\u63E1\u5EA6\uFF1B\u6CA1\u8003\u5230\u7684\u6807\u7B7E\u4E0D\u8BB0\u96F6\u3002": "Score rates describe this exam, not overall mastery. Tags the exam didn\u2019t cover aren\u2019t counted as zero.",
    "\u5F97\u5206\u7387\uFF08%\uFF09\xB7 \u7F3A\u8003\u548C\u6CA1\u6709\u603B\u5206\u7684\u4E0D\u8BA1\u5165": "Score rate (%) \xB7 absent and missing totals not included",
    "\u5FFD\u7565": "Skip",
    "\u5FFD\u7565 {{n}} \u884C": "{{n}} rows skipped",
    "\u5FFD\u7565 {{n}} \u884C_one": "{{n}} row skipped",
    "\u5FFD\u7565 {{n}} \u884C_other": "{{n}} rows skipped",
    "\u6027\u683C": "Personality",
    "\u603B\u5206": "Total",
    "\u603B\u6EE1\u5206": "Full Marks",
    "\u60F3\u77E5\u9053\u8C01\u6700\u8FD1\u8FDB\u6B65\u4E86\u3001\u54EA\u7C7B\u9898\u5931\u5206\u591A\uFF1F\u5728\u53F3\u4FA7\u95EE\u95EE\u52A9\u7406\u3002": "Wondering who\u2019s improving, or which kinds of questions lose the most points? Ask the assistant on the right.",
    "\u6210\u7EE9": "Scores",
    "\u6210\u7EE9\u5DF2\u4FDD\u5B58": "Scores Saved",
    "\u6210\u7EE9\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6": "Scores can\u2019t be loaded right now",
    "\u6211\u7684\u73ED\u7EA7": "My Classes",
    "\u6240\u5728\u73ED\u7EA7": "Class",
    "\u6240\u6709\u9898\u76EE\u4E0A\u7684\u201C{{a}}\u201D\u4F1A\u6362\u6210\u201C{{b}}\u201D\uFF0C\u4E4B\u540E\u53EA\u5269\u201C{{b}}\u201D\u3002": "Every \u201C{{a}}\u201D on every question becomes \u201C{{b}}\u201D. Only \u201C{{b}}\u201D remains.",
    "\u6240\u9009\u8003\u8BD5\u91CC\uFF0C\u8FD9\u4E2A\u73ED\u8FD8\u6CA1\u6709\u6210\u7EE9": "This class has no scores in the selected exams",
    "\u628A\u201C{{a}}\u201D\u5408\u5E76\u5230\u201C{{b}}\u201D\uFF1F": "Merge \u201C{{a}}\u201D into \u201C{{b}}\u201D?",
    "\u628A\u4E00\u573A\u8003\u8BD5\u7684\u6210\u7EE9\u8868\uFF08Excel\uFF09\u5BFC\u8FDB\u6765\uFF1A\u9009\u5DE5\u4F5C\u8868\u3001\u5BF9\u5E94\u59D3\u540D\u548C\u5206\u6570\u5217\uFF0C\u6821\u5BF9\u540E\u786E\u8BA4\u3002": "Bring in an exam\u2019s score sheet (Excel): pick the sheet, match the name and score columns, review and confirm.",
    "\u628A\u4F60\u6559\u7684\u73ED\u7EA7\u653E\u5728\u8FD9\u91CC": "Keep the classes you teach here",
    "\u628A\u5B66\u751F\u62D6\u5230\u8FD9\u91CC\uFF0C\u5C31\u662F\u6682\u65F6\u4E0D\u6392\u5EA7\u3002": "Drag a student here to leave them unseated for now.",
    "\u628A\u6210\u7EE9\u8868\u62D6\u5230\u8FD9\u91CC\uFF0C\u6216\u70B9\u4E00\u4E0B\u9009\u62E9": "Drop the score sheet here, or click to choose",
    "\u62D6\u52A8\u5B66\u751F\u6362\u5EA7\u4F4D\uFF0C\u70B9\u4E00\u4E0B\u67E5\u770B\u5B66\u751F": "Drag to swap seats. Click a student to open them.",
    "\u6309\u5B66\u53F7\u8865\u9F50\u7A7A\u4F4D": "Fill Seats by Number",
    "\u6362\u4E00\u4E2A\u6587\u4EF6": "Choose Another File",
    "\u6362\u4E2A\u5173\u952E\u8BCD\u6216\u65F6\u95F4\u8303\u56F4\u770B\u770B\u3002": "Try other words or another time range.",
    "\u6362\u4E2A\u540D\u5B57\u6216\u5B66\u53F7\u8BD5\u8BD5\u3002": "Try another name or number.",
    "\u6362\u73ED\u540E\uFF0C\u8BB0\u5F55\u8DDF\u7740\u5B66\u751F\u8D70\uFF1B\u4EE5\u524D\u7684\u6210\u7EE9\u4ECD\u5C5E\u4E8E\u5F53\u65F6\u7684\u73ED\u7EA7\uFF0C\u5EA7\u4F4D\u4F1A\u7A7A\u51FA\u6765\u3002": "Notes go with the student. Past scores stay with the old class, and their seat opens up.",
    "\u6392\u540D": "Ranking",
    "\u641C\u7D22\u59D3\u540D\u6216\u5B66\u53F7": "Search name or number",
    "\u641C\u7D22\u8BB0\u5F55\u91CC\u7684\u6587\u5B57": "Search notes",
    "\u64CD\u4F5C\u6CA1\u6709\u5B8C\u6210\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21\u3002": "That didn\u2019t go through. Please try again.",
    "\u6539\u540D": "Rename",
    "\u6539\u6210": "Change to",
    "\u6559\u5230\u54EA\u91CC\u3001\u5171\u540C\u7684\u95EE\u9898\u3001\u4E0B\u4E00\u8282\u8BFE\u7684\u60F3\u6CD5\uFF0C\u5199\u6210\u4E00\u6761\u5C31\u597D\u3002": "Where you got to, common mistakes, ideas for next lesson \u2014 one note is enough.",
    "\u6559\u5BA4\u5927\u5C0F": "Room Size",
    "\u6570\u5B66": "Math",
    "\u65B0\u5EFA\u73ED\u7EA7": "New Class",
    "\u65B0\u5EFA\u8003\u8BD5": "New Exam",
    "\u65B0\u6807\u7B7E\uFF0C\u4F8B\u5982\uFF1A\u4E8C\u6B21\u51FD\u6570\u3001\u51E0\u4F55\u8BC1\u660E": "New tag, e.g. Quadratics, Proofs",
    "\u65E0\u603B\u5206 {{n}}": "{{n}} no total",
    "\u65E0\u7ED3\u679C": "No results",
    "\u65F6\u95F4\u8303\u56F4": "Time Range",
    "\u663E\u793A": "Show",
    "\u6700\u4F4E\uFF1A{{q}} {{r}}": "Lowest: {{q}} {{r}}",
    "\u6700\u9AD8 / \u6700\u4F4E": "High / Low",
    "\u6700\u9AD8\u5230\u6700\u4F4E": "Range",
    "\u6709\u4E86\u540D\u5355\uFF0C\u5C31\u53EF\u4EE5\u6309\u6559\u5BA4\u7684\u6837\u5B50\u6392\u5EA7\u4F4D\u3002": "Once you have a roster, arrange seats the way your room looks.",
    "\u6709\u539F\u5377": "Paper attached",
    "\u672A\u6392\u5EA7": "Unseated",
    "\u672A\u8BB0\u5F55": "Not recorded",
    "\u672A\u8BB0\u5F55 {{n}}": "{{n}} not recorded",
    "\u6807\u7B7E": "Tags",
    "\u6807\u7B7E\u540D\u79F0": "Tag name",
    "\u6807\u7B7E\u64CD\u4F5C": "Tag actions",
    "\u6807\u7B7E\u8D34\u5728\u8BD5\u5377\u7684\u9898\u76EE\u4E0A\uFF0C\u4E00\u6B21\u6807\u6CE8\uFF0C\u5168\u73ED\u5171\u7528\u3002": "Tags go on exam questions. Tag once, and every class uses it.",
    "\u6B63\u5728\u8BFB\u53D6\u8868\u683C\u2026": "Reading the sheet\u2026",
    "\u6BCF\u4E00\u884C\u90FD\u5BF9\u4E0A\u4E86\u3002": "Every row matches.",
    "\u6BCF\u4E2A\u4EBA\u90FD\u6709\u5EA7\u4F4D\u4E86": "Everyone has a seat",
    "\u6BCF\u9898\u6EE1\u5206": "Points each",
    "\u6CA1\u6709\u5F52\u6863\u7684\u5185\u5BB9": "Nothing archived",
    "\u6CA1\u6709\u627E\u5230\u8FD9\u4F4D\u5B66\u751F": "No student found",
    "\u6CA1\u6709\u73B0\u6210\u7684\u8868\uFF1F\u4E0B\u8F7D\u4E00\u4EFD\u5E26{{cls}}\u540D\u5355\u7684\u6A21\u677F": "No sheet yet? Download a template with the {{cls}} roster",
    "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8BB0\u5F55": "No matching notes",
    "\u6CA1\u6709\u8FD9\u4E00\u5217": "Not in sheet",
    "\u6CA1\u6709\u8FD9\u6837\u7684\u884C\u3002": "No rows like that.",
    "\u6CA1\u6709\u9700\u8981\u5904\u7406\u7684\u95EE\u9898": "Nothing to fix",
    "\u6DFB\u52A0": "Add",
    "\u6DFB\u52A0\u5B66\u751F": "Add Student",
    "\u6DFB\u52A0\u6807\u7B7E": "Add Tag",
    "\u6EE1\u5206": "Full",
    "\u6EE1\u5206 {{n}}": "Out of {{n}}",
    "\u70B9\u4E00\u573A\u8003\u8BD5\uFF0C\u4E0B\u9762\u6362\u6210\u90A3\u4E00\u573A\u3002\u5404\u573A\u6EE1\u5206\u548C\u96BE\u5EA6\u4E0D\u540C\uFF0C\u66F2\u7EBF\u53EA\u4F5C\u53C2\u8003\u3002": "Click an exam to see it below. Exams differ in full marks and difficulty, so the line is only a guide.",
    "\u70B9\u4E00\u6863\u770B\u662F\u8C01": "Click a bar to see who",
    "\u72B6\u6001": "Status",
    "\u73ED\u5747 {{v}}": "Class mean {{v}}",
    "\u73ED\u7EA7\u4F1A\u79FB\u5230\u201C\u5DF2\u5F52\u6863\u201D\uFF0C\u5B66\u751F\u3001\u8BB0\u5F55\u548C\u6210\u7EE9\u90FD\u539F\u6837\u4FDD\u7559\uFF0C\u968F\u65F6\u53EF\u4EE5\u6062\u590D\u3002": "The class moves to Archived with its students, notes and scores intact. You can restore it anytime.",
    "\u73ED\u7EA7\u4FE1\u606F": "Class Info",
    "\u73ED\u7EA7\u540D\u79F0": "Class name",
    "\u73ED\u7EA7\u5BFC\u822A": "Classes navigation",
    "\u73ED\u7EA7\u5DF2\u521B\u5EFA": "Class created",
    "\u73ED\u7EA7\u5E73\u5747": "Class mean",
    "\u73ED\u7EA7\u5F97\u5206\u7387": "Class rate",
    "\u73ED\u7EA7\u64CD\u4F5C": "Class actions",
    "\u73ED\u7EA7\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6": "Classes can\u2019t be loaded right now",
    "\u73ED\u7EA7\u89C6\u56FE": "Class view",
    "\u73ED\u91CC\u8FD8\u6CA1\u6709\u5B66\u751F": "No students yet",
    "\u751F\u6210\u6821\u5BF9\u8868": "Review Rows",
    "\u751F\u65E5": "Birthday",
    "\u751F\u65E5\u3001\u5174\u8DA3\u4E0E\u6027\u683C": "Birthday, interests and personality",
    "\u7528\u4F60\u81EA\u5DF1\u7684\u8BDD\u63CF\u8FF0\uFF0C\u4E0D\u5FC5\u9762\u9762\u4FF1\u5230\u3002": "In your own words. It doesn\u2019t need to be complete.",
    "\u7528\u4F60\u81EA\u5DF1\u7684\u8BDD\u7ED9\u9898\u76EE\u5206\u7C7B\uFF0C\u957F\u671F\u590D\u7528\uFF1B\u53EF\u4EE5\u6539\u540D\uFF0C\u4E5F\u53EF\u4EE5\u5408\u5E76\u3002": "Sort questions in your own words and reuse them. Rename or merge anytime.",
    "\u7559\u7A7A\u5C31\u7528\u8BA1\u5206\u9898\u5408\u8BA1": "Leave blank to use the sum of the questions",
    "\u770B\u770B\u6210\u7EE9": "See Scores",
    "\u786E\u8BA4\u5165\u5E93": "Save Scores",
    "\u79FB\u9664": "Remove",
    "\u79FB\u9664\u8FD9\u9053\u9898": "Remove this question",
    "\u7A7A\u767D\u662F\u7F3A\u5931\uFF0C0 \u5C31\u662F 0\uFF1B\u516C\u5F0F\u53EA\u7528\u8868\u91CC\u5DF2\u6709\u7684\u7ED3\u679C\u3002": "Blank means missing and 0 means 0. Formulas use the values already in the sheet.",
    "\u7B2C {{n}}": "#{{n}}",
    "\u7B2C {{rank}} / {{n}}": "#{{rank}} of {{n}}",
    "\u7B2C {{r}} \u6392\u7B2C {{c}} \u5EA7": "Row {{r}}, seat {{c}}",
    "\u7F16\u8F91": "Edit",
    "\u7F16\u8F91\u8003\u8BD5": "Edit Exam",
    "\u7F16\u8F91\u8D44\u6599": "Edit Profile",
    "\u7F3A\u5206": "Missing",
    "\u7F3A\u8003": "Absent",
    "\u7F3A\u8003 {{n}}": "{{n}} absent",
    "\u8003\u8BD5": "Exams",
    "\u8003\u8BD5\u4E0E\u6807\u7B7E": "Exams & Tags",
    "\u8003\u8BD5\u540D\u79F0": "Exam name",
    "\u8003\u8BD5\u5DF2\u521B\u5EFA": "Exam created",
    "\u8003\u8BD5\u64CD\u4F5C": "Exam actions",
    "\u884C": "Row",
    "\u8868\u4E2D": "In Sheet",
    "\u8868\u5934\u5728\u7B2C\u51E0\u884C": "Header row",
    "\u8868\u91CC\u6CA1\u6709\u7684\u5B66\u751F \xB7 {{n}} \u4EBA": "Not in the sheet \xB7 {{n}} students",
    "\u8868\u91CC\u6CA1\u6709\u7684\u5B66\u751F \xB7 {{n}} \u4EBA_one": "Not in the sheet \xB7 {{n}} student",
    "\u8868\u91CC\u6CA1\u6709\u7684\u5B66\u751F \xB7 {{n}} \u4EBA_other": "Not in the sheet \xB7 {{n}} students",
    "\u8BA1\u5206\u9898": "Scored Questions",
    "\u8BA1\u5206\u9898\u5408\u8BA1 {{s}}\uFF0C\u548C\u603B\u6EE1\u5206 {{f}} \u4E0D\u540C\u3002\u53EA\u6709\u9010\u9898\u5B8C\u6574\u8986\u76D6\u6574\u5377\u65F6\uFF0C\u624D\u4F1A\u68C0\u67E5\u603B\u5206\u548C\u9010\u9898\u4E4B\u548C\u662F\u5426\u4E00\u81F4\u3002": "The questions add up to {{s}}, not the full marks of {{f}}. Totals are only checked against question scores when the questions cover the whole paper.",
    "\u8BA1\u5206\u9898\u662F\u6700\u5C0F\u7684\u8BA1\u5206\u5355\u4F4D\uFF0C\u53EF\u4EE5\u662F\u5C0F\u95EE\u3002\u5927\u9898\u6807\u9898\u5199\u5728\u201C\u5206\u7EC4\u201D\u91CC\uFF0C\u4E0D\u4F1A\u518D\u7B97\u4E00\u6B21\u5206\u3002": "A scored question is the smallest unit that gets points \u2014 it can be a sub-question. Put part titles in \u201CSection\u201D; they aren\u2019t scored again.",
    "\u8BB0\u4E0B": "Add Note",
    "\u8BB0\u4E0B\u5173\u4E8E{{name}}\u7684\u4E00\u4EF6\u4E8B\uFF1A\u8BF4\u8FC7\u7684\u8BDD\u3001\u4E00\u6B21\u4EA4\u6D41\u3001\u4E00\u4E2A\u7EA6\u5B9A\u2026\u2026": "Write something about {{name}}: something they said, a conversation, a promise\u2026",
    "\u8BB0\u4F4F\u73ED\u91CC\u7684\u6BCF\u4E2A\u4EBA\uFF1A\u4ED6\u4EEC\u7684\u5EA7\u4F4D\u3001\u8BF4\u8FC7\u7684\u8BDD\u3001\u6BCF\u6B21\u8003\u8BD5\u7684\u6837\u5B50\u3002\u8BFE\u540E\u6574\u7406\u3001\u56DE\u987E\u548C\u601D\u8003\uFF0C\u90FD\u4ECE\u8FD9\u91CC\u5F00\u59CB\u3002": "Remember everyone in your class \u2014 where they sit, what they said, how each exam went. Reflection after class starts here.",
    "\u8BB0\u5F55": "Notes",
    "\u8BB0\u5F55\u5DF2\u5F52\u6863": "Note archived",
    "\u8BB2\u53F0": "FRONT",
    "\u8BD5\u5377\u4E0E\u540C\u573A\u6BD4\u8F83": "Paper & Comparison",
    "\u8FD8\u6709 {{n}} \u5904\u9700\u8981\u5904\u7406": "{{n}} still to fix",
    "\u8FD8\u6CA1\u5199\u3002\u60F3\u5230\u4E86\u5C31\u8BB0\u4E00\u7B14\u3002": "Nothing yet. Jot it down when it comes to mind.",
    "\u8FD8\u6CA1\u6709\u586B\u5B66\u53F7\u548C\u751F\u65E5": "No number or birthday yet",
    "\u8FD8\u6CA1\u6709\u5EA7\u4F4D": "No seat yet",
    "\u8FD8\u6CA1\u6709\u6807\u7B7E": "No tags yet",
    "\u8FD8\u6CA1\u6709\u8003\u8BD5": "No exams yet",
    "\u8FD8\u6CA1\u6709\u8003\u8BD5\u6210\u7EE9": "No exam scores yet",
    "\u8FD8\u6CA1\u6709\u8BB0\u5F55": "No notes yet",
    "\u8FD8\u6CA1\u6709\u8FD9\u4E2A\u73ED\u6210\u7EE9\u7684\u8003\u8BD5\uFF1A{{list}}": "No scores for this class yet: {{list}}",
    "\u8FD8\u6CA1\u7528\u8FC7": "Not used yet",
    "\u8FD9\u4E2A\u73ED\u8FD8\u6CA1\u6709\u6210\u7EE9": "No scores for this class yet",
    "\u8FD9\u573A\u8003\u8BD5\u7684\u9898\u76EE\u8FD8\u6CA1\u6709\u6807\u7B7E\u3002\u7ED9\u9898\u76EE\u8D34\u4E0A\u6807\u7B7E\uFF0C\u5C31\u80FD\u770B\u5230\u8FD9\u4E00\u7C7B\u9898\u7684\u5F97\u5206\u3002": "This exam\u2019s questions have no tags yet. Tag them to see how each kind of question went.",
    "\u9009\u586B": "optional",
    "\u9009\u586B\uFF0C\u7528\u4F60\u81EA\u5DF1\u7684\u8BDD\u5199": "Optional, in your own words",
    "\u9009\u62E9\u4E00\u5217": "Choose a column",
    "\u9009\u62E9\u5B66\u751F": "Choose a student",
    "\u9010\u9898\u5F97\u5206\uFF1A\u5DF2\u5BF9\u5E94 {{a}} / {{b}} \u9898": "Question scores: {{a}} of {{b}} matched",
    "\u9053\u9898\uFF0C\u6BCF\u9898": "questions, each worth",
    "\u91CD\u65B0\u52A0\u8F7D": "Reload",
    "\u91CD\u65B0\u5BF9\u5E94\u5217": "Match Columns Again",
    "\u9700\u8981\u770B\u7684": "Needs a Look",
    "\u9898\u53F7": "Question",
    "\u9898\u6570": "Number of questions",
    "\u9898\u76EE\u5F97\u5206\u7387\u63CF\u8FF0\u7684\u662F\u8FD9\u573A\u8003\u8BD5\u7684\u8BC1\u636E\uFF0C\u4E0D\u7B49\u4E8E\u77E5\u8BC6\u638C\u63E1\u5EA6\u3002": "Question rates describe this exam, not overall mastery.",
    "\u9898\u76EE\u6807\u7B7E": "Question Tags",
    /* ---------- shared kit: confirmations, pickers ---------- */
    "\u5220\u9664": "Delete",
    "\u786E\u8BA4": "Confirm",
    "\u786E\u8BA4\u653E\u5F03": "Discard",
    "\u786E\u8BA4\u89E3\u6563": "Ungroup",
    "\u4E0A\u4E2A\u6708": "Previous month",
    "\u4E0B\u4E2A\u6708": "Next month",
    "\u65F6\u95F4": "Time",
    "\u641C\u7D22\u529F\u80FD\u6A21\u5757": "Search modules",
    "\u201C{{name}}\u201D\u662F\u7CFB\u7EDF\u4FDD\u7559\u7684\u540D\u79F0\uFF0C\u6362\u4E00\u4E2A\u5427": "\u201C{{name}}\u201D is reserved. Try another name.",
    "\u5DF2\u7ECF\u6709\u53EB\u201C{{name}}\u201D\u7684\u5206\u7EC4\u4E86": "There\u2019s already a group called \u201C{{name}}\u201D.",
    "\u5220\u9664\u5B66\u671F": "Delete Semester",
    /* ---------- schedule: task panel ---------- */
    "\u5F00\u59CB\u65E5\u671F": "Start date",
    "\u7ED3\u675F\u65E5\u671F": "End date",
    "\u5F00\u59CB\u65F6\u95F4": "Start time",
    "\u7ED3\u675F\u65F6\u95F4": "End time",
    "\u4E0D\u91CD\u590D": "Never",
    "\u81EA\u5B9A\u4E49\u2026": "Custom\u2026",
    "\u65E0": "None",
    "\u6807\u4E3A\u672A\u5B8C\u6210": "Mark as Not Done",
    "\u8BFB\u53D6\u6700\u65B0\u7248\u672C": "Load Latest",
    "\u91CD\u8BD5\u786E\u8BA4": "Retry",
    "\u91CD\u65B0\u4FDD\u5B58": "Save Again",
    "\u91C7\u7528\u670D\u52A1\u5668\u5185\u5BB9": "Use Server Version",
    "\u7528\u670D\u52A1\u5668\u5185\u5BB9\u66FF\u6362\u5F53\u524D\u672C\u5730\u8F93\u5165\uFF1F\u672A\u4FDD\u5B58\u7684\u672C\u5730\u4FEE\u6539\u5C06\u88AB\u4E22\u5F03\u3002": "Replace what you typed with the server version? Unsaved changes here will be lost.",
    "\u91C7\u7528": "Use It",
    "\u79FB\u56DE\u5F85\u5B89\u6392\uFF1F": "Move back to Unscheduled?",
    "\u5220\u9664\u91CD\u590D\u7684\u4EFB\u52A1\uFF1F": "Delete repeating task?",
    "\u53EF\u4EE5\u53EA\u5220\u6389\u8FD9\u4E00\u6B21\uFF0C\u4E5F\u53EF\u4EE5\u628A\u6574\u7EC4\u91CD\u590D\u7684\u4EFB\u52A1\u4E00\u8D77\u5220\u6389\u3002": "Delete just this one, or every task in the series.",
    "\u53EA\u5220\u8FD9\u4E00\u6B21": "Only This One",
    "\u5220\u9664\u5168\u90E8": "Delete All",
    "\u653E\u8FDB\u65E5\u5386\uFF0C\u53D8\u6210\u4EFB\u52A1": "Put It on the Calendar",
    "\u9ED8\u8BA4\u4ECA\u5929 9:00 \u2013 10:00\uFF0C\u4E4B\u540E\u968F\u65F6\u53EF\u4EE5\u6539": "Today, 9:00 \u2013 10:00 to start. Change it anytime.",
    /* ---------- schedule: task board ---------- */
    "\u672A\u547D\u540D": "Untitled",
    "\u65E0\u6807\u7B7E": "No label",
    "\u6309\u6807\u7B7E\u7B5B\u9009": "Filter by label",
    "\u6309\u6807\u7B7E\u7B5B\u9009\u201C{{title}}\u201D": "Filter \u201C{{title}}\u201D by label",
    "\u6240\u6709\u6807\u7B7E": "All labels",
    /* ---------- library modules: the shared rail ---------- */
    "\u60F3\u77E5\u9053\u8C01\u6700\u8FD1\u8FDB\u6B65\u4E86\u3001\u54EA\u7C7B\u9898\u5931\u5206\u591A\uFF1F\u95EE\u95EE\u52A9\u7406\u3002": "Who\u2019s improving? Which questions cost the most points? Ask the assistant.",
    "\u8BF4\u8BF4\u60F3\u505A\u4EC0\u4E48\uFF0C\u52A9\u7406\u4F1A\u5E2E\u4F60\u642D\u597D\u4F5C\u54C1\u3002": "Say what you want to make and the assistant will build it with you.",
    "\u8FD8\u6CA1\u6709\u73ED\u7EA7": "No classes yet",
    "\u6CA1\u6709\u7B26\u5408\u7B5B\u9009\u7684\u4EFB\u52A1": "No tasks match this filter.",
    "\u663E\u793A\u5168\u90E8": "Show All"
  };
  var PATCHED_EN = {
    "\u5220\u9664\u5B66\u671F": "Delete Semester",
    "\u8FD8\u6CA1\u6709\u5176\u4ED6\u5B66\u671F": "No other semesters yet",
    "\u8FD8\u6CA1\u6709\u53EF\u4EE5\u590D\u5236\u7684\u5B66\u671F\u3002\u5EFA\u597D\u8FD9\u4E2A\u5B66\u671F\u540E\uFF0C\u4E0B\u6B21\u5C31\u80FD\u4ECE\u5B83\u590D\u5236\u3002": "Nothing to copy from yet. Once this semester exists, you can copy from it next time.",
    "\u5728\u65E5\u7A0B\u4E2D\u67E5\u770B": "View in Schedule",
    "\u622A\u56FE": "Screenshot",
    "\u53EF\u4EE5\u76F4\u63A5\u7C98\u8D34\u622A\u56FE": "You can paste a screenshot here",
    "\u7EE7\u7EED\u6DFB\u52A0": "Add More",
    "\u9644\u4E0A\u622A\u56FE\u6216\u6587\u4EF6": "Attach a screenshot or file",
    "\u79FB\u9664\u9644\u4EF6": "Remove attachment",
    "\u5220\u9664\u201C{{name}}\u201D\uFF1F": "Delete \u201C{{name}}\u201D?",
    "\u6709 {{count}} \u4EFD\u8D44\u6599\u7528\u5230\u5B83\u3002_one": "One file uses it. ",
    "\u6709 {{count}} \u4EFD\u8D44\u6599\u7528\u5230\u5B83\u3002_other": "{{count}} files use it. ",
    "\u6709 {{count}} \u4EFD\u8D44\u6599\u7528\u5230\u5B83\u3002": "{{count}} files use it. ",
    "\u91CC\u9762\u7684\u8D44\u6599\u548C\u5B50\u6587\u4EF6\u5939\u4F1A\u79FB\u5230\u4E0A\u4E00\u7EA7\uFF0C\u8D44\u6599\u672C\u8EAB\u4E0D\u4F1A\u88AB\u5220\u9664\u3002": "Its files and subfolders move up one level. No files are deleted.",
    "\u8D44\u6599\u4E0A\u7684\u8FD9\u4E2A\u6807\u7B7E\u4F1A\u88AB\u79FB\u9664\uFF0C\u8D44\u6599\u672C\u8EAB\u4ECD\u7136\u4FDD\u7559\u3002": "The tag comes off its files. The files themselves stay.",
    "\u53D6\u6D88\u8FD9\u4E00\u6B21\uFF1F": "Cancel this one?",
    "\u8FD4\u56DE\u9996\u9875": "Back to Home",
    "\u65E0": "None"
  };
  var APP_EN = {
    resources: { ...PATCHED_EN },
    schedule: { ...PATCHED_EN },
    workbench: {
      ...PATCHED_EN,
      "modules.classroom": "Classes",
      "\u8981\u9000\u51FA TeachBuddy \u5417\uFF1F": "Sign out of TeachBuddy?",
      "\u4F60\u7684\u9898\u5E93\u3001\u65E5\u7A0B\u548C\u8D44\u6599\u90FD\u5DF2\u5B89\u5168\u4FDD\u5B58\u3002\u4E0B\u6B21\u767B\u5F55\uFF0C\u4E00\u5207\u90FD\u5728\u539F\u5904\u7B49\u4F60\u3002": "Your questions, schedule and files are saved. When you sign back in, everything will be right where you left it."
    },
    reliability: {
      "\u5220\u9664\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\u3002": "Couldn\u2019t delete. Please try again."
    },
    questions: {
      "\u5C06\u79FB\u51FA\u5F53\u524D\u5217\u8868\u3002\u4E4B\u540E\u53EF\u4EE5\u5728\u5DE6\u4FA7\u7684\u201C\u5DF2\u5F52\u6863\u201D\u91CC\u6062\u590D\u6216\u5F7B\u5E95\u5220\u9664\u3002": "It will leave this list. You can restore it or delete it for good from Archived on the left."
    },
    math: {
      "\u4ECE\u4E00\u4E2A\u516C\u5F0F\u6216\u4E00\u5F20\u56FE\u5F00\u59CB": "Start with a formula or a graph",
      "\u7528\u4E0B\u9762\u7684\u5DE5\u5177\u52A8\u624B\u505A\uFF0C\u6216\u5728\u53F3\u4FA7\u52A9\u7406\u91CC\u8BF4\u8BF4\u4F60\u7684\u60F3\u6CD5\u3002": "Build it with the tools below, or tell the assistant on the right what you have in mind.",
      "\u5199\u516C\u5F0F": "Write a formula",
      "\u5206\u5F0F\u3001\u6839\u5F0F\u3001\u4E0A\u4E0B\u6807": "Fractions, roots, scripts",
      "\u753B\u56FE\u5F62": "Draw a graph",
      "\u51FD\u6570\u3001\u70B9\u7EBF\u5706\u3001\u7ACB\u4F53": "Functions, shapes, solids",
      "\u52A0\u53C2\u6570": "Add a slider",
      "\u62D6\u52A8\u6ED1\u6746\uFF0C\u8BA9\u56FE\u52A8\u8D77\u6765": "Drag it to bring graphs to life",
      "\u672A\u547D\u540D\u6570\u5B66\u4F5C\u54C1": "Untitled Work",
      "\u8FD0\u884C\u9884\u89C8\uFF0C\u770B\u770B\u5B83\u5728\u8BFE\u5802\u4E0A\u7684\u6837\u5B50\uFF1B\u4E5F\u53EF\u4EE5\u6253\u5F00\u6E90\u7801\u4FEE\u6539\u3002": "Run the preview to see how it looks in class, or open the source to edit it."
    }
  };
  var APP_OVERRIDES = {
    questions: { "\u4ECE\u8D44\u6599\u6536\u5F55": "Import", "\u624B\u52A8\u5F55\u9898": "New Question", "\u5206\u7C7B\u4E0E\u6807\u7B7E": "Categories" },
    schedule: { "\u5F85\u5B89\u6392": "Unscheduled", "\u672A\u6392\u671F": "Unscheduled" },
    math: { "\u65B0\u5EFA\u4F5C\u54C1": "New Work" }
  };
  var APP_ZH = {
    workbench: { "modules.classroom": "\u73ED\u7EA7" }
  };

  // docs/design-system/teachbuddy-app/ui/tbx/src/locales/install.js
  var done2 = false;
  function installLocales(i18n) {
    if (done2 || !i18n?.addResourceBundle) return;
    done2 = true;
    i18n.addResourceBundle("en", "tbx", EN, true, true);
    for (const [ns, table] of Object.entries(APP_EN)) i18n.addResourceBundle("en", ns, table, true, false);
    for (const [ns, table] of Object.entries(APP_OVERRIDES)) i18n.addResourceBundle("en", ns, table, true, true);
    for (const [ns, table] of Object.entries(APP_ZH)) i18n.addResourceBundle("zh-CN", ns, table, true, false);
  }

  // docs/design-system/teachbuddy-app/ui/tbx/src/index.js
  var FEEDBACK_REPLIES = {
    \u5EFA\u8BAE: { title: "\u597D\u4E3B\u610F\uFF0C\u6536\u5230\u4E86\u3002", note: "\u6BCF\u4E00\u6761\u5EFA\u8BAE\uFF0C\u6211\u4EEC\u90FD\u4F1A\u8BA4\u771F\u8BFB\u5B8C\u3002" },
    \u9519\u8BEF\u62A5\u544A: { title: "\u8C22\u8C22\u4F60\u5E2E\u6211\u4EEC\u627E\u5230\u5B83\u3002", note: "\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u4FEE\u597D\u8FD9\u4E2A\u95EE\u9898\u3002" },
    \u95EE\u9898: { title: "\u4F60\u7684\u95EE\u9898\uFF0C\u6211\u4EEC\u6536\u5230\u4E86\u3002", note: "\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u7ED9\u4F60\u7B54\u590D\u3002" },
    \u8D5E\u626C: { title: "\u8FD9\u53E5\u8BDD\uFF0C\u6211\u4EEC\u4F1A\u8BB0\u5F88\u4E45\u3002", note: "\u8C22\u8C22\u4F60\uFF0C\u8FD9\u5BF9\u6211\u4EEC\u610F\u4E49\u91CD\u5927\u3002" }
  };
  var glyphs = null;
  var translated = (table, map) => new Proxy(table, { get: (o, k) => o[k] == null ? void 0 : map(o[k]) });
  globalThis.__tbx = {
    authSubtitles: translated(SUBTITLES, (v) => tx(v)),
    feedbackReplies: translated(FEEDBACK_REPLIES, (v) => ({ title: tx(v.title), note: tx(v.note) })),
    installLocales,
    ...globalThis.__tbx || {},
    AuthCharacters: Cast,
    AuthEntryLayout: EntryLayout,
    BrandMark,
    Topbar,
    Sidebar,
    AuxiliaryPanel: AuxPanel,
    AgentWorkspace,
    Home,
    FocusToggle,
    TaskBoard,
    agentScript,
    CalendarEditor: EntryEditor,
    SupportHelp: HelpCenter,
    Library: ResourceLibrary,
    WorkspaceHome: MathHome,
    QuestionFinder,
    QuestionWelcome,
    ClassroomPage,
    BackgroundChoices,
    ExportItem,
    AgreementPaper,
    DangerZone,
    // shared kit, also used by patches inside the app bundle
    confirmDialog,
    ConfirmButton,
    ConfirmMenuItem,
    ConfirmDialog: AppConfirmDialog,
    KitConfirmDialog: ConfirmDialog,
    Rail,
    RailSection
  };
  Object.defineProperty(globalThis.__tbx, "glyphs", {
    configurable: true,
    get() {
      return glyphs || (glyphs = buildGlyphs());
    }
  });
})();
