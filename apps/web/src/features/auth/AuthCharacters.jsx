import { useEffect, useRef } from 'react';
import './auth-characters.css';

const clamp = (value) => Math.max(-1, Math.min(1, value));

/*
 * Interactive login illustration with pointer and input-state tracking.
 * Only coarse presentation states cross this boundary. Never pass field values,
 * credentials, account data or authentication callbacks to the illustration.
 */
export default function AuthCharacters({ trackingRef, field, expression, passwordVisible }) {
  const sceneRef = useRef(null);
  const pose = passwordVisible ? 'shy'
    : expression !== 'idle' ? expression
      : field === 'password' ? 'password'
        : field === 'text' ? 'attentive' : 'idle';

  useEffect(() => {
    const scene = sceneRef.current;
    const frame = trackingRef.current;
    if (!scene || !frame) return undefined;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let request = 0;
    let point = null;

    function reset() {
      cancelAnimationFrame(request);
      request = 0;
      point = null;
      scene.style.removeProperty('--ae-look-x');
      scene.style.removeProperty('--ae-look-y');
      scene.style.removeProperty('--ae-face-x');
      scene.style.removeProperty('--ae-face-y');
      scene.style.removeProperty('--ae-lean');
    }

    function syncPreference() {
      reset();
      scene.dataset.paused = String(document.hidden || motion.matches);
    }

    function draw() {
      request = 0;
      if (!point) return;
      const bounds = scene.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = clamp((point.x - bounds.left - bounds.width / 2) / (bounds.width * .65));
      const y = clamp((point.y - bounds.top - bounds.height / 2) / (bounds.height * .65));
      scene.style.setProperty('--ae-look-x', `${(x * 3.2).toFixed(2)}px`);
      scene.style.setProperty('--ae-look-y', `${(y * 2.6).toFixed(2)}px`);
      scene.style.setProperty('--ae-face-x', `${(x * 13).toFixed(2)}px`);
      scene.style.setProperty('--ae-face-y', `${(y * 7).toFixed(2)}px`);
      scene.style.setProperty('--ae-lean', `${(-x * 5).toFixed(2)}deg`);
    }

    function follow(event) {
      if (motion.matches || !pointer.matches || document.hidden || event.pointerType === 'touch') return;
      point = { x: event.clientX, y: event.clientY };
      // Coalesce pointer events without re-rendering the React form on each move.
      if (!request) request = requestAnimationFrame(draw);
    }

    syncPreference();
    frame.addEventListener('pointermove', follow, { passive: true });
    frame.addEventListener('pointerleave', reset);
    motion.addEventListener('change', syncPreference);
    pointer.addEventListener('change', syncPreference);
    document.addEventListener('visibilitychange', syncPreference);
    return () => {
      reset();
      frame.removeEventListener('pointermove', follow);
      frame.removeEventListener('pointerleave', reset);
      motion.removeEventListener('change', syncPreference);
      pointer.removeEventListener('change', syncPreference);
      document.removeEventListener('visibilitychange', syncPreference);
    };
  }, [trackingRef]);

  return (
    <div className="ae-characters" aria-hidden="true">
      <svg
        className="ae-characters-scene"
        viewBox="-28 -28 560 500"
        fill="none"
        focusable="false"
        ref={sceneRef}
        data-pose={pose}
      >
        <g className="ae-character-enter ae-enter-purple">
          <g className="ae-character ae-character-purple">
            <path className="ae-character-shape ae-purple-shape" d="M124 32L316 32C316 96 316 166 316 238C316 302 316 374 316 444L124 444C124 374 124 302 124 238C124 166 124 96 124 32Z" />
            <g className="ae-face ae-purple-face">
              <g className="ae-eyes ae-purple-eyes">
                <circle className="ae-eye-white" cx="218" cy="56" r="6" />
                <circle className="ae-eye-white" cx="274" cy="56" r="6" />
                <g className="ae-pupils">
                  <circle cx="218" cy="56" r="3" />
                  <circle cx="274" cy="56" r="3" />
                </g>
              </g>
              <path className="ae-closed-eyes" d="M213 56q5-5 10 0m46 0q5-5 10 0" />
              <path className="ae-mouth ae-purple-mouth" d="M233 76Q246 86 259 76Q246 96 233 76Z" />
            </g>
          </g>
        </g>
        <g className="ae-character-enter ae-enter-black">
          <g className="ae-character ae-character-black">
            <path className="ae-character-shape ae-black-shape" d="M260 150H376V444H260Z" />
            <g className="ae-face ae-black-face">
              <g className="ae-eyes ae-black-eyes">
                <circle className="ae-eye-white" cx="308" cy="178" r="9.5" />
                <circle className="ae-eye-white" cx="338" cy="178" r="9.5" />
                <g className="ae-pupils">
                  <circle cx="308" cy="178" r="5" />
                  <circle cx="338" cy="178" r="5" />
                </g>
              </g>
              <path className="ae-closed-eyes" d="M301 178q7-6 14 0m16 0q7-6 14 0" />
            </g>
          </g>
        </g>
        <g className="ae-character-enter ae-enter-yellow">
          <g className="ae-character ae-character-yellow">
            <path className="ae-character-shape ae-yellow-shape" d="M348 444V298A67 67 0 0 1 482 298V444Z" />
            <g className="ae-face ae-yellow-face">
              <circle className="ae-eyes" cx="400" cy="279" r="4.5" />
              <path className="ae-closed-eyes" d="M395 279q5-5 10 0" />
              <path className="ae-mouth ae-yellow-mouth" d="M424 303H506" />
            </g>
          </g>
        </g>
        <g className="ae-character-enter ae-enter-orange">
          <g className="ae-character ae-character-orange">
            <path className="ae-character-shape ae-orange-shape" d="M0 444A158 158 0 0 1 316 444Z" />
            <g className="ae-face ae-orange-face">
              <g className="ae-eyes ae-orange-eyes">
                <circle cx="154" cy="378" r="8" />
                <circle cx="228" cy="378" r="8" />
              </g>
              <path className="ae-closed-eyes" d="M147 378q7-7 14 0m60 0q7-7 14 0" />
              <path className="ae-mouth ae-orange-mouth" d="M177 390H208A15.5 15.5 0 0 1 177 390Z" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
