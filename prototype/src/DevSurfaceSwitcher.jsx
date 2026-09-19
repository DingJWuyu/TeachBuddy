/*
 * Development-only links between the app and the integrated prototype.
 * Each surface has its own Vite entry; production builds omit this control.
 */
const linkStyle = {
  display: 'block',
  padding: '8px 12px',
  color: '#eff4ff',
  background: 'rgba(255, 255, 255, 0.12)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: '10px',
  fontSize: '12px',
  lineHeight: '16px',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const shellStyle = {
  position: 'fixed',
  zIndex: 200,
  right: '16px',
  bottom: '16px',
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
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

export default function DevSurfaceSwitcher({ active }) {
  const destination = new URL(window.location.href);
  destination.port = active === 'prototype' ? '5173' : '4174';
  destination.pathname = '/';
  destination.search = '';
  destination.hash = '';

  return (
    <div style={shellStyle} role="navigation" aria-label="开发环境界面切换">
      <span style={labelStyle}>dev</span>
      {active === 'prototype' ? (
        <a style={linkStyle} href={destination.href}>进入真实 App</a>
      ) : (
        <a style={linkStyle} href={destination.href}>打开侧栏原型</a>
      )}
    </div>
  );
}
