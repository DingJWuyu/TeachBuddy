/*
 * Development-only control for the account entry's transport conditions.
 *
 * The prototype reaches no real service, so the failure branches the product
 * needs (network down, service error, timeout, expired session, expired code)
 * cannot be triggered from the interface itself. This panel drives them. It is
 * styled like the other development chrome, never appears in a production
 * build, and is hidden by ?no-dev-chrome, so the screens used for review and
 * evidence stay clean.
 */
import { FAILURE_MODES } from './auth/demo-data.js';

const shellStyle = {
  position: 'fixed',
  zIndex: 200,
  right: '16px',
  // Leave the existing surface switcher at its main-owned position below us.
  bottom: '80px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  alignItems: 'center',
  maxWidth: '320px',
  padding: '6px',
  background: 'rgba(11, 16, 32, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: '14px',
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
  fontFamily: 'system-ui, sans-serif',
};

const labelStyle = {
  padding: '0 4px 0 8px',
  color: '#97a6c7',
  fontSize: '11px',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
};

function buttonStyle(active) {
  return {
    padding: '6px 10px',
    color: active ? '#0b1020' : '#eff4ff',
    background: active ? '#c8d4f5' : 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '10px',
    fontSize: '12px',
    lineHeight: '16px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  };
}

export default function DevFailureControl({ mode, onModeChange, onExpireSession, onExpireCode, onReset }) {
  return (
    <div style={shellStyle} role="group" aria-label="开发环境故障注入">
      <span style={labelStyle}>dev</span>
      {FAILURE_MODES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          style={buttonStyle(entry.id === mode)}
          aria-pressed={entry.id === mode}
          onClick={() => onModeChange(entry.id)}
        >
          {entry.label}
        </button>
      ))}
      <button type="button" style={buttonStyle(false)} onClick={onExpireSession}>会话过期</button>
      <button type="button" style={buttonStyle(false)} onClick={onExpireCode}>验证码过期</button>
      <button type="button" style={buttonStyle(false)} onClick={onReset}>重置数据</button>
    </div>
  );
}
