import { useEffect, useState } from 'react';
import BrandMark from './BrandMark.jsx';
import PasswordToggle from './PasswordToggle.jsx';
import {
  CODE_LENGTH,
  CODE_RESEND_COOLDOWN_MS,
  RECOVERY_CODE,
  SUPPORT_EMAIL,
  VERIFICATION_CODE
} from './demo-data.js';

const MODE_COPY = {
  login: {
    title: '登录',
    submit: '登录',
    pending: '登录中',
    switchText: '还没有账户？',
    switchAction: '创建账户',
    switchMode: 'register'
  },
  register: {
    title: '注册',
    submit: '注册',
    pending: '注册中',
    switchText: '已经有账户？',
    switchAction: '登录',
    switchMode: 'login'
  },
  'recovery-request': {
    title: '找回密码',
    submit: '发送验证码',
    pending: '发送中',
    switchText: '想起密码了？',
    switchAction: '返回登录',
    switchMode: 'login'
  },
  'recovery-confirm': {
    title: '设置新密码',
    submit: '重置密码',
    pending: '提交中',
    switchText: '',
    switchAction: '返回登录',
    switchMode: 'login'
  }
};

/* Wording for the code lifecycle, in one place so every refusal reads the same
 * wherever it is raised. */
const CODE_FAILURES = {
  missing: '验证码已失效，请重新发送。',
  used: '验证码已经用过了，请重新发送。',
  expired: '验证码已过期，请重新发送。',
  exhausted: '验证码错误次数过多，请重新发送。'
};

function codeFailureText(verdict) {
  if (verdict.kind !== 'mismatch') return CODE_FAILURES[verdict.kind] || CODE_FAILURES.missing;
  return verdict.remaining > 0
    ? `验证码不正确，还可以再试 ${verdict.remaining} 次。`
    : '验证码不正确，请重新发送。';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function secondsUntil(timestamp) {
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

function minutesLeft(timestamp) {
  return Math.max(1, Math.round((timestamp - Date.now()) / 60000));
}

export default function AuthEntry({
  auth,
  onSubmit,
  onConfirmRecovery,
  onSendCode,
  notice,
  onNotice,
  onDismissNotice,
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
  const [codeEmail, setCodeEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [codeExpiresAt, setCodeExpiresAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pending, setPending] = useState('');
  const [fieldError, setFieldError] = useState({ field: '', message: '' });
  const [banner, setBanner] = useState(null);

  const copy = MODE_COPY[mode];
  const isRegistration = mode === 'register';
  const isRecoveryRequest = mode === 'recovery-request';
  const isRecoveryConfirm = mode === 'recovery-confirm';
  const busy = pending !== '';

  /* The resend control counts down instead of letting the user ask again right
   * away; the note says when the current code stops working. */
  useEffect(() => {
    if (!resendAt) {
      setSecondsLeft(0);
      return undefined;
    }
    setSecondsLeft(secondsUntil(resendAt));
    const timer = setInterval(() => {
      const left = secondsUntil(resendAt);
      setSecondsLeft(left);
      if (left === 0) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [resendAt]);

  function fail(field, message) {
    setFieldError({ field, message });
  }

  function clearFieldError() {
    setFieldError({ field: '', message: '' });
  }

  function resetCodeState() {
    setCodeSent(false);
    setCodeEmail('');
    setResendAt(0);
    setCooldownMs(0);
    setCodeExpiresAt(0);
    setVerificationCode('');
  }

  function switchMode(next) {
    onModeChange(next);
    onDismissNotice?.();
    clearFieldError();
    setBanner(null);
    setPending('');
    setName('');
    setPassword('');
    setPasswordVisible(false);
    setPasswordConfirmation('');
    setAgreed(false);
    setRemember(true);
    resetCodeState();
  }

  /* Card-level message. Field rules keep their own line under the field; only
   * whole-request outcomes land here. */
  function raise(message, tone = 'error') {
    onDismissNotice?.();
    setBanner({ message, tone });
  }

  /*
   * Turns a failed request into a card-level message. The transport failures
   * carry their own wording; anything else keeps the reason the layer below
   * gave, so a refusal never degrades into a generic line.
   */
  function reportFailure(failure, fallback) {
    if (failure?.kind === 'offline' || failure?.kind === 'server' || failure?.kind === 'timeout') {
      raise(failure.message);
      return;
    }
    raise(failure?.message || fallback);
  }

  async function sendCode() {
    if (!email) return fail('email', '请填写邮箱。');
    if (!isEmail(email)) return fail('email', '邮箱格式不正确。');
    if (isRegistration && auth.isRegistered(email)) {
      return fail('email', '这个邮箱已经注册过了，直接登录，或换一个邮箱。');
    }
    if (!isRegistration && !auth.isRegistered(email)) {
      return fail('email', '这个邮箱没有可找回的账户。');
    }
    const recipient = isRegistration ? email : recoveryEmail;
    clearFieldError();
    onDismissNotice?.();
    setBanner(null);
    setPending('code');
    try {
      const purpose = isRegistration ? 'register' : 'recovery';
      const sent = await onSendCode({ email: recipient, purpose });
      setCodeSent(true);
      setCodeEmail(sent.email);
      setResendAt(cooldownWaived ? 0 : sent.resendAt);
      setCooldownMs(cooldownWaived ? 0 : (sent.cooldownMs ?? 0));
      setCodeExpiresAt(sent.expiresAt);
      /* A send never wipes what the user has already typed: a resend answered
       * while the code was being entered must not eat that entry. A new code
       * makes an old entry wrong, and the refusal says so. */
      setVerificationCode((current) => current);
    } catch (failure) {
      if (failure?.kind === 'cooldown') {
        setResendAt(Date.now() + failure.retryAfter * 1000);
        setCooldownMs(failure.retryAfter * 1000);
        raise(`请 ${failure.retryAfter} 秒后再重新发送。`);
      } else {
        reportFailure(failure, '验证码发送失败，请重试。');
      }
    } finally {
      setPending('');
    }
  }

  async function confirmRecovery(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(verificationCode)) return fail('code', `请输入 ${CODE_LENGTH} 位数字验证码。`);
    if (password.length < 8) return fail('password', '新密码至少 8 位。');
    if (password !== passwordConfirmation) return fail('confirmation', '两次输入的新密码不一致。');
    if (!codeSent) return fail('code', '请先发送验证码。');
    clearFieldError();
    onDismissNotice?.();
    setBanner(null);
    setPending('submit');
    try {
      const refusal = await onConfirmRecovery({ email: codeEmail, code: verificationCode, password });
      if (refusal) {
        if (refusal.field) fail(refusal.field, refusal.message);
        else raise(refusal.message);
        return;
      }
      /* The reset retires every session the account was holding, including this
       * one, so the next step is always signing in again. */
      switchMode('login');
      onNotice?.({ message: '密码已重置，请用新密码登录。', tone: 'success' });
    } catch (failure) {
      reportFailure(failure, '重置失败，请重试。');
    } finally {
      setPending('');
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    if (isRecoveryConfirm) {
      await confirmRecovery(event);
      return;
    }

    if (isRecoveryRequest) {
      if (!email) return fail('email', '请填写邮箱。');
      if (!isEmail(email)) return fail('email', '邮箱格式不正确。');
      if (!auth.isRegistered(email)) return fail('email', '这个邮箱没有可找回的账户。');
      clearFieldError();
      setBanner(null);
      /* The address and the code already sent to it carry into the second
       * step, so the user is not asked for both a second time. */
      setRecoveryEmail(email.trim().toLowerCase());
      setCodeEmail(email.trim().toLowerCase());
      setCodeSent(!!codeSent);
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
      if (!/^\d{6}$/.test(verificationCode)) return fail('code', `请输入 ${CODE_LENGTH} 位数字验证码。`);
      if (!agreed) return fail('agreed', '需要同意服务条款才能创建账户。');

      const verdict = auth.verifyCode({ email: codeEmail, purpose: 'register', code: verificationCode });
      if (!verdict.ok) return fail('code', codeFailureText(verdict));

      clearFieldError();
      onDismissNotice?.();
      setBanner(null);
      setPending('submit');
      try {
        const refusal = await onSubmit({ name: name.trim(), email, password, remember });
        if (refusal) fail('email', refusal);
      } catch (failure) {
        reportFailure(failure, '注册失败，请重试。');
      } finally {
        setPending('');
      }
      return;
    }

    if (!email) return fail('email', '请填写邮箱。');
    if (!isEmail(email)) return fail('email', '邮箱格式不正确。');
    if (password.length < 8) return fail('password', '密码至少 8 位。');
    clearFieldError();
    onDismissNotice?.();
    setBanner(null);
    setPending('submit');
    try {
      await onSubmit({ email, password, remember });
    } catch (failure) {
      reportFailure(failure, '登录失败，请重试。');
      /* Only a rejected credential clears the password. A transport failure
       * leaves it in place, so a retry does not start with an empty field. */
      if (failure?.kind === 'invalid-credentials') setPassword('');
    } finally {
      setPending('');
    }
  }

  function fieldErrorFor(field) {
    if (fieldError.field !== field) return null;
    return <small className="ae-field-error" role="alert">{fieldError.message}</small>;
  }

  const activeNotice = banner || notice;
  /* A check run can waive the resend cooldown; the control reads that from the
   * send result instead of starting a countdown. */
  const cooldownWaived = new URLSearchParams(window.location.search).has('dev-no-cooldown');
  const codeNote = codeSent
    ? (codeExpiresAt
      ? `验证码已发送至 ${codeEmail}，${minutesLeft(codeExpiresAt)} 分钟内有效`
      : `验证码已发送至 ${codeEmail}`)
    : '';

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

          {activeNotice && (
            <div
              className={`ae-notice is-${activeNotice.tone || 'error'}`}
              role={activeNotice.tone === 'success' ? 'status' : 'alert'}
            >
              <span>{activeNotice.message}</span>
              <button
                className="ae-notice-dismiss"
                type="button"
                aria-label="关闭提示"
                onClick={() => { setBanner(null); onDismissNotice?.(); }}
              >
                ×
              </button>
            </div>
          )}

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
              {isRecoveryConfirm ? (
                <input type="email" value={codeEmail} readOnly aria-readonly="true" tabIndex={-1} />
              ) : (
                <input
                  type="email"
                  autoComplete="email"
                  placeholder={isRegistration ? '' : 'example@example.com'}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (isRegistration && codeSent) resetCodeState();
                    if (fieldError.field === 'email' || fieldError.field === 'code') clearFieldError();
                  }}
                />
              )}
              {isRecoveryConfirm && (
                <small className="ae-field-hint">验证码只对这个地址有效，需要换地址请返回上一步。</small>
              )}
              {fieldErrorFor('email')}
            </label>

            {isRegistration && !codeSent && (
              <div className="ae-field">
                <button className="ae-send is-block" type="button" onClick={sendCode} disabled={pending === 'code'}>
                  {pending === 'code' ? '发送中' : '发送验证码'}
                </button>
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
                    maxLength={CODE_LENGTH}
                    autoComplete="one-time-code"
                    placeholder={`例如 ${VERIFICATION_CODE}`}
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                  />
                  <button
                    className="ae-send"
                    type="button"
                    onClick={sendCode}
                    disabled={secondsLeft > 0 || pending === 'code'}
                  >
                    {pending === 'code' ? '发送中' : secondsLeft > 0 ? `${secondsLeft}s 后重发` : '重新发送'}
                  </button>
                </span>
                <small className="ae-field-note">{codeNote}</small>
                {fieldErrorFor('code')}
              </div>
            )}

            {isRecoveryConfirm && !codeSent && (
              <div className="ae-field">
                <button className="ae-send is-block" type="button" onClick={sendCode} disabled={pending === 'code'}>
                  {pending === 'code' ? '发送中' : '发送验证码'}
                </button>
                {fieldErrorFor('code')}
              </div>
            )}

            {isRecoveryConfirm && codeSent && (
              <label className={`ae-field${fieldError.field === 'code' ? ' has-error' : ''}`}>
                <span>验证码</span>
                <span className="ae-combo">
                  <input
                    inputMode="numeric"
                    maxLength={CODE_LENGTH}
                    autoComplete="one-time-code"
                    placeholder={`例如 ${RECOVERY_CODE}`}
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                  />
                  <button
                    className="ae-send"
                    type="button"
                    onClick={sendCode}
                    disabled={secondsLeft > 0 || pending === 'code'}
                  >
                    {pending === 'code' ? '发送中' : secondsLeft > 0 ? `${secondsLeft}s 后重发` : '重新发送'}
                  </button>
                </span>
                {codeNote && <small className="ae-field-note">{codeNote}</small>}
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

            <button className="ae-primary" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? copy.pending : copy.submit}
            </button>
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
