import { useState } from 'react';

export default function LoginCard({
  onLogin,
  onRegister,
  onRequestPasswordReset,
  onConfirmPasswordReset,
  error
}) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryPasswordConfirmation, setRecoveryPasswordConfirmation] = useState('');
  const [notice, setNotice] = useState('');
  const isRegistration = mode === 'register';
  const isRecoveryRequest = mode === 'recovery-request';
  const isRecoveryConfirmation = mode === 'recovery-confirm';

  function switchMode(nextMode) {
    setMode(nextMode);
    setNotice('');
  }

  async function submit(event) {
    event.preventDefault();

    if (isRegistration) {
      await onRegister(name, email, password, passwordConfirmation);
      return;
    }

    if (isRecoveryRequest) {
      const sent = await onRequestPasswordReset(email);
      if (sent) {
        switchMode('recovery-confirm');
        setNotice('如果邮箱对应教师账户，验证码已发送，请查收邮件。');
      }
      return;
    }

    if (isRecoveryConfirmation) {
      const reset = await onConfirmPasswordReset(
        {
          email,
          code: recoveryCode,
          password: recoveryPassword,
          passwordConfirmation: recoveryPasswordConfirmation
        }
      );
      if (reset) {
        setRecoveryCode('');
        setRecoveryPassword('');
        setRecoveryPasswordConfirmation('');
        setPassword('');
        switchMode('login');
        setNotice('密码已重置，请使用新密码登录。');
      }
      return;
    }

    await onLogin(email, password);
  }

  let title = '教师账户';
  let description = '登录后继续处理你的教学事务。';
  if (isRegistration) {
    title = '创建教师账户';
    description = '创建账户后即可进入你的个人工作台。';
  } else if (isRecoveryRequest) {
    title = '找回密码';
    description = '输入账户邮箱，我们会发送一次性验证码。';
  } else if (isRecoveryConfirmation) {
    title = '设置新密码';
    description = '输入邮件中的验证码和新密码。';
  }

  return (
    <div className="login-shell">
      <div className="card login-card">
        <p className="eyebrow">教师个人工作台</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
        <form className="form-grid" onSubmit={submit}>
          {isRegistration && (
            <label className="full-span">
              <span>显示名称</span>
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}

          <label className="full-span">
            <span>邮箱</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          {isRecoveryConfirmation && (
            <label className="full-span">
              <span>验证码</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
              />
            </label>
          )}

          {!isRecoveryRequest && !isRecoveryConfirmation && (
            <label className="full-span">
              <span>密码</span>
              <input
                type="password"
                autoComplete={isRegistration ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}

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

          {isRecoveryConfirmation && (
            <>
              <label className="full-span">
                <span>新密码</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={recoveryPassword}
                  onChange={(event) => setRecoveryPassword(event.target.value)}
                />
              </label>
              <label className="full-span">
                <span>确认新密码</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={recoveryPasswordConfirmation}
                  onChange={(event) => setRecoveryPasswordConfirmation(event.target.value)}
                />
              </label>
            </>
          )}

          <div className="full-span form-actions">
            <button className="primary-button" type="submit">
              {isRegistration ? '创建账户' : isRecoveryRequest ? '发送验证码' : isRecoveryConfirmation ? '重置密码' : '登录'}
            </button>
            {isRecoveryRequest && (
              <button className="text-button" type="button" onClick={() => switchMode('login')}>
                返回登录
              </button>
            )}
            {isRecoveryConfirmation && (
              <>
                <button className="text-button" type="button" onClick={() => switchMode('recovery-request')}>
                  重新发送验证码
                </button>
                <button className="text-button" type="button" onClick={() => switchMode('login')}>
                  返回登录
                </button>
              </>
            )}
            {isRegistration && (
              <button className="text-button" type="button" onClick={() => switchMode('login')}>
                返回登录
              </button>
            )}
            {!isRegistration && !isRecoveryRequest && !isRecoveryConfirmation && (
              <>
                <button className="text-button" type="button" onClick={() => switchMode('register')}>
                  注册
                </button>
                <button className="text-button" type="button" onClick={() => switchMode('recovery-request')}>
                  忘记密码？
                </button>
              </>
            )}
          </div>
        </form>
        {notice && <div className="flash-card card">{notice}</div>}
        {error && <div className="error-card card">{error}</div>}
      </div>
    </div>
  );
}
