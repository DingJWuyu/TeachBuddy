import { h } from '../shim.js';
import { useEffect, useRef, useState, tx, useLocale, isEnglish } from '../react.js';

/*
 * The original sign-in cast, softened and given a classroom:
 *   teacher  the tall purple one — round glasses and a hair bun
 *   black    a student in a red scarf, always the first to peek
 *   yellow   a curious student with a cowlick
 *   orange   the little one, with a sprout that grows when things go well
 *
 * The poses follow the original choreography (lean in while you type,
 * look away when the password is shown, flinch on error, cheer on success)
 * and add small lives of their own: idle fidgets, a nod for each keystroke,
 * eyes that read along the caret, reactions to hover and a line when clicked.
 */

const ACTORS = ['teacher', 'black', 'yellow', 'orange'];
const STUDENTS = ['black', 'yellow', 'orange'];

const LINES = {
  idle: {
    teacher: ['同学们好～', '今天讲二次函数', '作业都交了吗？'],
    black: ['老师我会！', '下课打球去？', '这题选 C！'],
    yellow: ['让我想想……', '这题好像见过', '老师，我有问题'],
    orange: ['嘿嘿', '我先举手！', '今天也要加油鸭'],
  },
  password: {
    teacher: ['不许偷看哦', '眼睛看黑板', '嗯？谁在看？'],
    black: ['我没看！真的！', '就看一眼……', '看不清看不清'],
    yellow: ['我只是路过', '我什么也没看见'],
    orange: ['我闭眼了！', '我是好学生'],
  },
  shy: {
    teacher: ['密码要藏好呀', '大家转过去～'],
    black: ['我看到啦～', '记不住记不住'],
    yellow: ['哇，好长', '我转过去了'],
    orange: ['我捂眼睛了！', '没看没看'],
  },
  error: {
    teacher: ['再检查一下？', '别急，慢慢来'],
    black: ['哎呀', '差一点点'],
    yellow: ['是不是哪里错了？'],
    orange: ['没关系！再来！'],
  },
  success: {
    teacher: ['欢迎回来！', '上课啦～'],
    black: ['耶！', '冲鸭！'],
    yellow: ['太好了！'],
    orange: ['开心！'],
  },
};

const clamp = (v) => Math.max(-1, Math.min(1, v));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Where the text caret sits on screen, so eyes can read along while typing.
const measure = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
function caretPoint(input) {
  if (!measure || !input || input.tagName !== 'INPUT' || input.type === 'checkbox') return null;
  const r = input.getBoundingClientRect();
  const s = getComputedStyle(input);
  measure.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  let text = input.value.slice(0, input.selectionStart ?? input.value.length);
  if (input.type === 'password') text = '•'.repeat(text.length);
  const x = r.left + parseFloat(s.paddingLeft) + measure.measureText(text).width - input.scrollLeft;
  return { x: Math.min(x, r.right - parseFloat(s.paddingRight)), y: r.top + r.height / 2 };
}

// Replays a one-shot animation class on the scene: remove, reflow, add.
function replay(el, attr, value, ms) {
  if (!el) return;
  el.removeAttribute(attr);
  void el.getBoundingClientRect();
  el.setAttribute(attr, value);
  clearTimeout(el[`__${attr}`]);
  el[`__${attr}`] = setTimeout(() => el.removeAttribute(attr), ms);
}

export function Cast({ trackingRef, field, expression = 'idle', passwordVisible }) {
  useLocale();
  const sceneRef = useRef(null);
  const [speech, setSpeech] = useState(null);
  const pose = passwordVisible ? 'shy' : expression !== 'idle' ? expression : field === 'password' ? 'password' : field === 'text' ? 'attentive' : 'idle';
  const poseRef = useRef(pose);
  poseRef.current = pose;

  // Eyes follow the pointer, and the caret while typing; keystrokes get a nod.
  useEffect(() => {
    const scene = sceneRef.current;
    const frame = trackingRef?.current;
    if (!scene || !frame) return undefined;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    let raf = 0, point = null;
    const props = ['--look-x', '--look-y', '--face-x', '--face-y', '--lean'];
    const reset = () => {
      cancelAnimationFrame(raf); raf = 0; point = null;
      props.forEach((p) => scene.style.removeProperty(p));
    };
    const draw = () => {
      raf = 0;
      if (!point) return;
      const b = scene.getBoundingClientRect();
      if (!b.width) return;
      const x = clamp((point.x - b.left - b.width / 2) / (b.width * 0.65));
      const y = clamp((point.y - b.top - b.height / 2) / (b.height * 0.65));
      scene.style.setProperty('--look-x', `${(x * 3.2).toFixed(2)}px`);
      scene.style.setProperty('--look-y', `${(y * 2.6).toFixed(2)}px`);
      scene.style.setProperty('--face-x', `${(x * 13).toFixed(2)}px`);
      scene.style.setProperty('--face-y', `${(y * 7).toFixed(2)}px`);
      scene.style.setProperty('--lean', `${(-x * 5).toFixed(2)}deg`);
    };
    const aim = (p) => {
      if (motion.matches || !p) return;
      point = p;
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const follow = (e) => {
      if (!fine.matches || e.pointerType === 'touch') return;
      aim({ x: e.clientX, y: e.clientY });
    };
    const read = (e) => {
      aim(caretPoint(e.target));
      if (e.type === 'input' && e.target.type !== 'checkbox' && !motion.matches) {
        replay(scene, 'data-nod', pick(STUDENTS), 260);
        replay(scene, 'data-typing', 'true', 320);
      }
    };
    const change = (e) => {
      if (e.target.type === 'checkbox' && !motion.matches) replay(scene, 'data-react', e.target.checked ? 'approve' : 'shrug', 900);
    };
    const leave = () => { if (!frame.contains(document.activeElement)) reset(); };
    frame.addEventListener('pointermove', follow, { passive: true });
    frame.addEventListener('pointerleave', leave);
    ['input', 'keyup', 'click', 'focusin'].forEach((t) => frame.addEventListener(t, read));
    frame.addEventListener('change', change);
    const pause = () => { scene.dataset.paused = String(document.hidden || motion.matches); };
    pause();
    document.addEventListener('visibilitychange', pause);
    return () => {
      reset();
      frame.removeEventListener('pointermove', follow);
      frame.removeEventListener('pointerleave', leave);
      ['input', 'keyup', 'click', 'focusin'].forEach((t) => frame.removeEventListener(t, read));
      frame.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', pause);
    };
  }, [trackingRef]);

  // Little lives of their own: someone fidgets every few seconds.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let timer = 0;
    const next = () => {
      timer = setTimeout(() => {
        if (!document.hidden && (poseRef.current === 'idle' || poseRef.current === 'attentive')) {
          replay(scene, 'data-fidget', pick(ACTORS), 1200);
        }
        next();
      }, 2400 + Math.random() * 2800);
    };
    next();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!speech) return undefined;
    const t = setTimeout(() => setSpeech(null), 2300);
    return () => clearTimeout(t);
  }, [speech]);

  function poke(who) {
    const set = LINES[pose] || LINES.idle;
    setSpeech({ who, text: tx(pick(set[who] || LINES.idle[who])), key: Date.now() });
    replay(sceneRef.current, 'data-poke', who, 650);
  }
  const actor = (who) => ({
    className: `tc-actor tc-${who}`,
    onPointerDown: (e) => { e.preventDefault(); poke(who); },
    onPointerEnter: () => sceneRef.current?.setAttribute('data-hover', who),
    onPointerLeave: () => sceneRef.current?.removeAttribute('data-hover'),
  });

  return (
    <div className="ae-characters tc-cast" aria-hidden="true">
      <div className="tc-frame">
        {speech && <div key={speech.key} className={`tc-speech is-${speech.who}`}>{speech.text}</div>}
        <svg className="tc-scene" viewBox="-28 -28 560 500" fill="none" focusable="false" ref={sceneRef} data-pose={pose}>
          <ellipse className="tc-ground" cx="246" cy="446" rx="262" ry="12" />

          {/* ---------- teacher ---------- */}
          <g className="tc-enter tc-enter-teacher">
            <g {...actor('teacher')}>
              <g className="tc-hop">
                <g className="tc-char tc-char-teacher">
                  <g className="tc-bun">
                    <circle cx="246" cy="30" r="21" />
                    <path className="tc-bun-band" d="M228 42Q246 50 264 42" />
                  </g>
                  <path className="tc-shape tc-teacher-shape" d="M124 444C124 300 124 150 124 64C124 46 138 32 156 32L284 32C302 32 316 46 316 64C316 150 316 300 316 444Z" />
                  <g className="tc-face tc-teacher-face">
                    <g className="tc-eyes">
                      <circle className="tc-eye-white" cx="218" cy="62" r="6.5" />
                      <circle className="tc-eye-white" cx="274" cy="62" r="6.5" />
                      <g className="tc-pupils">
                        <circle cx="218" cy="62" r="3.2" />
                        <circle cx="274" cy="62" r="3.2" />
                      </g>
                    </g>
                    <path className="tc-closed" d="M212 63q6 -5 12 0m44 0q6 -5 12 0" />
                    <g className="tc-glasses">
                      <circle cx="218" cy="62" r="14" />
                      <circle cx="274" cy="62" r="14" />
                      <path d="M232 60Q246 52 260 60" />
                      <path className="tc-glint" d="M208 56l6 -6M264 56l6 -6" />
                    </g>
                    <circle className="tc-blush" cx="206" cy="86" r="7" />
                    <circle className="tc-blush" cx="286" cy="86" r="7" />
                    <path className="tc-mouth tc-teacher-mouth" d="M234 84Q246 93 258 84Q246 100 234 84Z" />
                    <path className="tc-sweat" d="M300 34q7 10 0 15q-7 -5 0 -15Z" />
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* ---------- black: the red-scarf student ---------- */}
          <g className="tc-enter tc-enter-black">
            <g {...actor('black')}>
              <g className="tc-hop">
                <g className="tc-char tc-char-black">
                  <path className="tc-shape tc-black-shape" d="M260 444L260 174C260 161 271 150 284 150L352 150C365 150 376 161 376 174L376 444Z" />
                  <g className="tc-scarf">
                    <path d="M294 214L342 214L318 232Z" />
                    <path d="M312 228L300 262L318 252Z" />
                    <path d="M324 228L338 260L318 252Z" />
                  </g>
                  <g className="tc-face tc-black-face">
                    <g className="tc-eyes">
                      <circle className="tc-eye-white" cx="304" cy="182" r="9.5" />
                      <circle className="tc-eye-white" cx="336" cy="182" r="9.5" />
                      <g className="tc-pupils">
                        <circle cx="304" cy="182" r="5" />
                        <circle cx="336" cy="182" r="5" />
                      </g>
                    </g>
                    <path className="tc-closed is-light" d="M297 183q7 -6 14 0m18 0q7 -6 14 0" />
                    <circle className="tc-blush" cx="294" cy="200" r="5.5" />
                    <circle className="tc-blush" cx="346" cy="200" r="5.5" />
                    <path className="tc-mouth tc-black-mouth" d="M312 200Q320 207 328 200" />
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* ---------- yellow: the curious one ---------- */}
          <g className="tc-enter tc-enter-yellow">
            <g {...actor('yellow')}>
              <g className="tc-hop">
                <g className="tc-char tc-char-yellow">
                  <path className="tc-cowlick" d="M414 234C410 220 416 210 426 212C434 214 432 224 424 224" />
                  <path className="tc-shape tc-yellow-shape" d="M348 444V298A67 67 0 0 1 482 298V444Z" />
                  <g className="tc-face tc-yellow-face">
                    <circle className="tc-eyes tc-dot-eye" cx="400" cy="281" r="5" />
                    <path className="tc-closed" d="M394 282q6 -5 12 0" />
                    <circle className="tc-blush" cx="388" cy="300" r="6" />
                    <path className="tc-mouth tc-yellow-mouth" d="M424 305H504" />
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* ---------- orange: the little one with a sprout ---------- */}
          <g className="tc-enter tc-enter-orange">
            <g {...actor('orange')}>
              <g className="tc-hop">
                <g className="tc-char tc-char-orange">
                  <g className="tc-sprout">
                    <path className="tc-stem" d="M170 292C170 280 172 270 176 262" />
                    <path className="tc-leaf" d="M174 268C164 256 150 256 146 264C154 272 166 272 174 268Z" />
                    <path className="tc-leaf" d="M176 264C182 250 196 246 204 252C198 262 186 268 176 264Z" />
                  </g>
                  <path className="tc-shape tc-orange-shape" d="M0 444A158 158 0 0 1 316 444Z" />
                  <g className="tc-face tc-orange-face">
                    <g className="tc-eyes">
                      <circle cx="154" cy="378" r="8" />
                      <circle cx="228" cy="378" r="8" />
                    </g>
                    <path className="tc-closed" d="M146 380q8 -8 16 0m58 0q8 -8 16 0" />
                    <circle className="tc-blush" cx="134" cy="398" r="9" />
                    <circle className="tc-blush" cx="248" cy="398" r="9" />
                    <path className="tc-mouth tc-orange-mouth" d="M177 392H208A15.5 15.5 0 0 1 177 392Z" />
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* confetti for success */}
          <g className="tc-confetti">
            <rect x="96" y="120" width="10" height="16" rx="3" style={{ '--dx': '-60px', '--dy': '-90px', '--r': '-120deg' }} />
            <rect x="200" y="60" width="10" height="16" rx="3" style={{ '--dx': '-20px', '--dy': '-110px', '--r': '160deg' }} />
            <circle cx="300" cy="110" r="6" style={{ '--dx': '30px', '--dy': '-120px', '--r': '0deg' }} />
            <rect x="380" y="150" width="10" height="16" rx="3" style={{ '--dx': '70px', '--dy': '-80px', '--r': '200deg' }} />
            <circle cx="450" cy="200" r="6" style={{ '--dx': '90px', '--dy': '-60px', '--r': '0deg' }} />
            <rect x="150" y="200" width="8" height="14" rx="3" style={{ '--dx': '-90px', '--dy': '-40px', '--r': '90deg' }} />
            <circle cx="250" cy="180" r="5" style={{ '--dx': '10px', '--dy': '-150px', '--r': '0deg' }} />
            <rect x="330" y="90" width="8" height="14" rx="3" style={{ '--dx': '50px', '--dy': '-130px', '--r': '-200deg' }} />
          </g>
        </svg>
      </div>
    </div>
  );
}
