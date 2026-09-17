import { useState } from 'react';

export default function LoginCard({ onLogin, error }) {
  const [email, setEmail] = useState('refat@local.test');
  const [password, setPassword] = useState('refatos123');

  return (
    <div className="login-shell">
      <div className="card login-card">
        <p className="eyebrow">RefatOS v1.3</p>
        <h1>教师指挥中心</h1>
        <p className="muted">演示账号已预填，简单高效。</p>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin(email, password);
          }}
        >
          <label className="full-span">
            <span>邮箱</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="full-span">
            <span>密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <div className="full-span form-actions">
            <button className="primary-button" type="submit">登录</button>
          </div>
        </form>
        {error && <div className="error-card card">{error}</div>}
      </div>
    </div>
  );
}
