import { useState } from 'react';

export default function LoginCard({ onLogin, onRegister, error }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const isRegistration = mode === 'register';

  return (
    <div className="login-shell">
      <div className="card login-card">
        <p className="eyebrow">RefatOS v1.3</p>
        <h1>{isRegistration ? '创建教师账户' : '教师账户'}</h1>
        <p className="muted">{isRegistration ? '创建账户后即可进入你的个人工作台。' : '登录后继续处理你的教学事务。'}</p>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            if (isRegistration) {
              onRegister(name, email, password, passwordConfirmation);
            } else {
              onLogin(email, password);
            }
          }}
        >
          {isRegistration && (
            <label className="full-span">
              <span>显示名称</span>
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label className="full-span">
            <span>邮箱</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="full-span">
            <span>密码</span>
            <input
              type="password"
              autoComplete={isRegistration ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {isRegistration && (
            <label className="full-span">
              <span>确认密码</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
              />
            </label>
          )}
          <div className="full-span form-actions">
            <button className="primary-button" type="submit">{isRegistration ? '创建账户' : '登录'}</button>
            <button
              className="text-button"
              type="button"
              onClick={() => setMode(isRegistration ? 'login' : 'register')}
            >
              {isRegistration ? '返回登录' : '注册'}
            </button>
          </div>
        </form>
        {error && <div className="error-card card">{error}</div>}
      </div>
    </div>
  );
}
