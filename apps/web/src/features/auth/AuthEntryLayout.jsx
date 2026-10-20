import { useRef, useState } from 'react';
import { useLocale } from '../../i18n/presentation.js';
import AuthCharacters from './AuthCharacters.jsx';
import './auth-entry.css';

// One quiet line under each heading.
export const SUBTITLES = {
  login: '教学的一切，都在这里。',
  register: '一个账户，开启你的全部教学。',
  'recovery-request': '我们会把验证码发到你的邮箱。',
  'recovery-confirm': '新密码至少 8 位。',
};

// Sign-in frame: a quiet stage with the class on the left, the form on the right.
// Keeps the original ae-* structure so the form and its behaviour are untouched.
export default function AuthEntryLayout({ children, surface, expression = 'idle', passwordVisible = false }) {
  useLocale();
  const frameRef = useRef(null);
  const [focus, setFocus] = useState({ surface, field: 'none' });
  const field = focus.surface === surface ? focus.field : 'none';
  function reflectFocus(target) {
    const password = target?.closest?.('.ae-password') || target?.id === 'ae-password-confirmation';
    const text = target?.matches?.('input:not([type="checkbox"])');
    setFocus({ surface, field: password ? 'password' : text ? 'text' : 'none' });
  }
  return (
    <div className="ae-page ae-entry tbx-entry" data-auth-surface={surface}>
      <div className="ae-entry-frame tbx-entry-frame" ref={frameRef}>
        <section className="tbx-stage">
          <AuthCharacters trackingRef={frameRef} field={field} expression={expression} passwordVisible={passwordVisible} />
        </section>
        <div
          className="ae-entry-panel tbx-entry-panel"
          onFocusCapture={(e) => reflectFocus(e.target)}
          onBlurCapture={(e) => reflectFocus(e.currentTarget.contains(e.relatedTarget) ? e.relatedTarget : null)}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
