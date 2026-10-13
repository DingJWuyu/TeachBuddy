import { useRef, useState } from 'react';
import AuthCharacters from './AuthCharacters.jsx';
import './auth-entry.css';

/* Presentation only: the form still owns its values, validation and requests. */
export default function AuthEntryLayout({
  children,
  surface,
  expression = 'idle',
  passwordVisible = false,
}) {
  const frameRef = useRef(null);
  const [focus, setFocus] = useState({ surface, field: 'none' });
  // A mode switch must not leave the illustration reacting to an unmounted input.
  const field = focus.surface === surface ? focus.field : 'none';

  function reflectFocus(target) {
    const password = target?.closest?.('.ae-password')
      || target?.id === 'ae-password-confirmation';
    const text = target?.matches?.('input:not([type="checkbox"])');
    setFocus({ surface, field: password ? 'password' : text ? 'text' : 'none' });
  }

  return (
    <div className="ae-page ae-entry" data-auth-surface={surface}>
      <div className="ae-entry-frame" ref={frameRef}>
        <AuthCharacters
          trackingRef={frameRef}
          field={field}
          expression={expression}
          passwordVisible={passwordVisible}
        />
        <div
          className="ae-entry-panel"
          onFocusCapture={(event) => reflectFocus(event.target)}
          onBlurCapture={(event) => reflectFocus(
            event.currentTarget.contains(event.relatedTarget) ? event.relatedTarget : null,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
