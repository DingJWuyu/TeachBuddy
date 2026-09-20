import { useState } from 'react';
import BrandMark from './BrandMark.jsx';
import PasswordToggle from './PasswordToggle.jsx';
import { RECOVERY_CODE, SUPPORT_EMAIL, VERIFICATION_CODE } from './demo-data.js';

const MODE_COPY = {
  login: {
    title: '登录',
    submit: '登录',
    switchText: '还没有账户？',
    switchAction: '创建账户',
    switchMode: 'register'
  },
  register: {
    title: '注册',
    submit: '注册',
    switchText: '已经有账户？',
    switchAction: '登录',
    switchMode: 'login'
  },
  'recovery-request': {
    title: '找回密码',
    submit: '发送验证码',
    switchText: '想起密码了？',
    switchAction: '返回登录',
    switchMode: 'login'
  },
  'recovery-confirm': {
    title: '设置新密码',
    submit: '重置密码',
    switchText: '',
    switchAction: '返回登录',
    switchMode: 'login'
  }
};

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export default function AuthEntry({
  onSubmit,
  onConfirmRecovery,
  onCheckEmail,
  mode,
  onModeChange
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [fieldError, setFieldError] = useState({ field: '', message: '' });

  const copy = MODE_COPY[mode];
  const isRegistration = mode === 'register';
  const isRecoveryRequest = mode === 'recovery-request';
  const isRecoveryConfirm = mode === 'recovery-confirm';

  function fail(field, message) {
    setFieldError({ field, message });
  }

  function clearFieldError() {
    setFieldError({ field: '', message: '' });
  }

  function switchMode(next) {
    onModeChange(next);
    clearFieldError();
    setName('');
    setPassword('');
    setPasswordVisible(false);
    setPasswordConfirmation('');
    setVerificationCode('');
    setAgreed(false);
    setRemember(true);
    setCodeSent(false);
  }

  function sendCode() {
    if (!email) return fail('email', '请填写邮箱。');
    if (!isEmail(email)) return fail('email', '邮箱格式不正确。');
    if (onCheckEmail(email)) return fail('email', '这个邮箱已经注册过了，直接登录，或换一个邮箱。');
    clearFieldError();
    setCodeSent(true);
  }

  function confirmRecovery(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(verificationCode)) {
      fail('code', '请输入 6 位数字验证码。');
      return;
    }
    if (password.length < 8) {
      fail('password', '新密码至少 8 位。');
      return;
    }
    if (password !== passwordConfirmation) {
      fail('confirmation', '两次输入的新密码不一致。');
      return;
    }
    clearFieldError();

    const refusal = onConfirmRecovery({ code: verificationCode, password });
    if (refusal) {
      fail('code', refusal);
      return;
    }
    switchMode('login');
  }

  function submit(event) {
    event.preventDefault();

    if (isRecoveryConfirm) {
      confirmRecovery(event);
      return;
    }

    if (isRecoveryRequest) {
      if (!email) {
        fail('email', '请填写邮箱。');
        return;
      }
      if (!isEmail(email)) {
        fail('email', '邮箱格式不正确。');
        return;
      }
      clearFieldError();
      onModeChange('recovery-confirm');
      return;
    }

    if (isRegistration) {
      if (!email) return fail('email', '请填写邮箱。');
      if (!isEmail(email)) return fail('email', '邮箱格式不正确。');
      if (!name.trim()) return fail('name', '请填写昵称。');
      if (password.length < 8) return fail('password', '密码至少 8 位。');
      if (password !== passwordConfirmation) return fail('confirmation', '两次输入的密码不一致。');
      if (!codeSent) return fail('code', '请先发送邮箱验证码。');
      if (!/^\d{6}$/.test(verificationCode)) return fail('code', '请输入 6 位数字验证码。');

      if (verificationCode !== VERIFICATION_CODE) return fail('code', '验证码不正确，请检查后重试。');
      if (!agreed) return fail('agreed', '需要同意服务条款才能创建账户。');
      clearFieldError();
      const refusal = onSubmit({ name: name.trim(), email, password });
      if (refusal) fail('email', refusal);
      return;
    }

    if (!email) return fail('email', '请填写邮箱。');
    if (!isEmail(email)) return fail('email', '邮箱格式不正确。');
    if (password.length < 8) return fail('password', '密码至少 8 位。');
    clearFieldError();
    return onSubmit({ email, password, remember });
  }

  function fieldErrorFor(field) {
    if (fieldError.field !== field) return null;
    return <small className="ae-field-error" role="alert">{fieldError.message}</small>;
  }

  return (
    <div className="ae-page">
      <div className="ae-shell">
        <header className="ae-brand">
          <BrandMark />
        </header>

        <div className="ae-card">
          <div className="ae-card-head">
            <h1>{copy.title}</h1>
          </div>

          <form className="ae-form" noValidate onSubmit={submit} aria-label={copy.title}>
            {isRegistration && (
              <label className={`ae-field${fieldError.field === 'name' ? ' has-error' : ''}`}>
                <span>昵称</span>
                <input
                  autoComplete="nickname"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                {fieldErrorFor('name')}
              </label>
            )}

            <label className={`ae-field${fieldError.field === 'email' ? ' has-error' : ''}`}>
              <span>邮箱</span>
              <input
                type="email"
                autoComplete="email"
                placeholder={isRegistration ? '' : 'example@example.com'}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (isRegistration) {
                    setCodeSent(false);
                    setVerificationCode('');
                  }
                  if (fieldError.field === 'email' || fieldError.field === 'code') clearFieldError();
                }}
              />
              {fieldErrorFor('email')}
            </label>

            {isRegistration && !codeSent && (
              <div className="ae-field">
                <button className="ae-send is-block" type="button" onClick={sendCode}>发送验证码</button>
                {fieldErrorFor('code')}
              </div>
            )}

            {isRegistration && codeSent && (
              <div className={`ae-field${fieldError.field === 'code' ? ' has-error' : ''}`}>
                <span>邮箱验证码</span>
                <span className="ae-combo">
                  <input
                    aria-label="邮箱验证码"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder={`例如 ${VERIFICATION_CODE}`}
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                  />
                  <button className="ae-send" type="button" onClick={sendCode}>重新发送</button>
                </span>
                <small className="ae-field-note">验证码已发送至 {email}</small>
                {fieldErrorFor('code')}
              </div>
            )}

            {isRecoveryConfirm && (
              <label className={`ae-field${fieldError.field === 'code' ? ' has-error' : ''}`}>
                <span>验证码</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder={`例如 ${RECOVERY_CODE}`}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                />
                <small className="ae-field-note">验证码已发送至 {email}</small>
                {fieldErrorFor('code')}
              </label>
            )}

            {!isRecoveryRequest && (
              <label htmlFor="ae-password" className={`ae-field${fieldError.field === 'password' ? ' has-error' : ''}`}>
                <span className="ae-field-head">
                  <span>{isRecoveryConfirm ? '新密码' : '密码'}</span>
                  {mode === 'login' && (
                    <button className="ae-text-action" type="button" onClick={() => switchMode('recovery-request')}>
                      忘记密码？
                    </button>
                  )}
                </span>
                <span className="ae-password">
                  <input
                    id="ae-password"
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete={isRegistration || isRecoveryConfirm ? 'new-password' : 'current-password'}
                    placeholder="至少 8 位"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <PasswordToggle
                    visible={passwordVisible}
                    onToggle={() => setPasswordVisible((current) => !current)}
                  />
                </span>
                {fieldErrorFor('password')}
              </label>
            )}

            {(isRegistration || isRecoveryConfirm) && (
              <label className={`ae-field${fieldError.field === 'confirmation' ? ' has-error' : ''}`}>
                <span>{isRegistration ? '确认密码' : '确认新密码'}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                />
                {fieldErrorFor('confirmation')}
              </label>
            )}

            {mode === 'login' && (
              <label className="ae-check">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span>记住我</span>
              </label>
            )}

            {isRegistration && (
              <label className={`ae-check is-terms${fieldError.field === 'agreed' ? ' has-error' : ''}`}>
                <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
                <span>
                  注册即表示同意{' '}
                  <a href="#terms" onClick={(event) => event.preventDefault()}>服务条款</a>
                  {fieldErrorFor('agreed')}
                </span>
              </label>
            )}

            <button className="ae-primary" type="submit">{copy.submit}</button>
          </form>
        </div>

        <p className="ae-switch">
          {copy.switchText}{' '}
          <button type="button" onClick={() => switchMode(copy.switchMode)}>{copy.switchAction}</button>
        </p>

        {!isRegistration && (
          <p className="ae-help">
            登录遇到问题？邮箱联系管理员：
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>（请一并发送故障截图）
          </p>
        )}
      </div>
    </div>
  );
}
