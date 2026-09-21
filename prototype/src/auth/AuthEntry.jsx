import { useEffect, useRef, useState } from 'react';
import BrandMark from './BrandMark.jsx';
import PasswordToggle from './PasswordToggle.jsx';
import {
  CODE_LENGTH,
  RECOVERY_CODE,
  SUPPORT_EMAIL,
  VERIFICATION_CODE,
  codePointLength,
  isEmail,
  normalizeEmail
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

function emailError(value) {
  const normalized = normalizeEmail(value);
  if (!normalized) return '请填写邮箱。';
  if (normalized.length > 254) return '邮箱长度不能超过 254 个字符。';
  if (!isEmail(normalized)) return '邮箱格式不正确。';
  return null;
}

function passwordError(value, label = '密码') {
  const length = codePointLength(value);
  if (length < 8) return `${label}至少 8 位。`;
  if (length > 128) return `${label}不能超过 128 个字符。`;
  return null;
}

function secondsUntil(timestamp) {
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

function minutesLeft(timestamp) {
  return Math.max(1, Math.ceil((timestamp - Date.now()) / 60000));
}

function mapOutcome(outcome) {
  if (!outcome || typeof outcome !== 'object' || typeof outcome.ok !== 'boolean') {
    return { banner: '暂时无法完成，请重试。' };
  }
  if (outcome.ok) return null;
  if (outcome.kind === 'mismatch' || CODE_FAILURES[outcome.kind]) {
    return { field: 'code', message: codeFailureText(outcome) };
  }
  if (outcome.kind === 'occupied') {
    return { field: 'email', message: '这个邮箱已经注册过了，直接登录，或换一个邮箱。' };
  }
  if (outcome.kind === 'unknown-account') {
    return { field: 'email', message: '这个邮箱没有可找回的账户。' };
  }
  if (outcome.kind === 'registration-closed') {
    return { banner: '注册暂时关闭，请返回登录。' };
  }
  if (outcome.kind === 'storage-unavailable') {
    return { banner: '暂时无法完成，请重试。' };
  }
  if (outcome.kind === 'invalid-credentials') {
    return { banner: '邮箱或密码不正确，请重试。' };
  }
  return { banner: '暂时无法完成，请重试。' };
}

export default function AuthEntry({
  auth,
  onSubmit,
  onSignedIn,
  onContinueSession,
  onRetrySession,
  onAbandonSession,
  pendingSessionAvailable = true,
  onConfirmRecovery,
  onSendCode,
  registrationOpen = true,
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
  const [challengeId, setChallengeId] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [codeExpiresAt, setCodeExpiresAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pending, setPending] = useState('');
  const [fieldError, setFieldError] = useState({ field: '', message: '' });
  const [banner, setBanner] = useState(null);
  const [sessionRecovery, setSessionRecovery] = useState(false);
  const operationRef = useRef(0);
  const pendingOperationRef = useRef(null);

  const copy = MODE_COPY[mode];
  const isRegistration = mode === 'register';
  const isRecoveryRequest = mode === 'recovery-request';
  const isRecoveryConfirm = mode === 'recovery-confirm';
  const busy = pending !== '';
  const cooldownWaived = new URLSearchParams(window.location.search).has('dev-no-cooldown');

  useEffect(() => {
    if (!pendingSessionAvailable) {
      setSessionRecovery(false);
      setBanner(null);
    }
  }, [pendingSessionAvailable]);

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

  function invalidatePending() {
    operationRef.current += 1;
    pendingOperationRef.current = null;
    setPending('');
  }

  function begin(type) {
    const id = operationRef.current + 1;
    operationRef.current = id;
    pendingOperationRef.current = { id, type };
    setPending(type);
    return id;
  }

  function stillCurrent(id) {
    return operationRef.current === id;
  }

  function fail(field, message) {
    setFieldError({ field, message });
  }

  function clearFieldError() {
    setFieldError({ field: '', message: '' });
  }

  function resetCodeState() {
    setCodeSent(false);
    setCodeEmail('');
    setChallengeId('');
    setResendAt(0);
    setCodeExpiresAt(0);
    setVerificationCode('');
  }

  function switchMode(next, { preserveEmail = true } = {}) {
    if (sessionRecovery && pendingSessionAvailable) onAbandonSession?.();
    invalidatePending();
    onModeChange(next);
    onDismissNotice?.();
    clearFieldError();
    setBanner(null);
    setSessionRecovery(false);
    setName('');
    setPassword('');
    setPasswordVisible(false);
    setPasswordConfirmation('');
    setAgreed(false);
    setRemember(true);
    if (!preserveEmail) setEmail('');
    resetCodeState();
  }

  function raise(message, tone = 'error') {
    onDismissNotice?.();
    setBanner({ message, tone });
  }

  function reportFailure(failure, fallback = '暂时无法完成，请重试。') {
    if (failure?.kind === 'offline' || failure?.kind === 'server' || failure?.kind === 'timeout') {
      const messages = {
        offline: '网络连接不可用，请检查网络后重试。',
        server: '服务暂时不可用，请稍后重试。',
        timeout: '请求超时，请重试。'
      };
      raise(messages[failure.kind]);
      return;
    }
    if (failure?.kind === 'unknown-result') {
      raise(failure.message || '结果暂未确认，请返回登录并尝试使用刚提交的信息。', 'neutral');
      return;
    }
    if (failure?.kind === 'session-persist-failed') {
      raise('本次未能记住登录状态，请继续当前会话或重试保存。', 'neutral');
      return;
    }
    if (failure?.kind === 'invalid-credentials') {
      raise('邮箱或密码不正确，请重试。');
      return;
    }
    if (failure?.kind === 'registration-closed') {
      raise('注册暂时关闭，请返回登录。');
      return;
    }
    if (failure?.kind === 'storage-unavailable' || failure?.kind === 'malformed-result') {
      raise('暂时无法完成，请重试。');
      return;
    }
    raise('暂时无法完成，请重试。');
  }

  function showOutcome(outcome) {
    const mapped = mapOutcome(outcome);
    if (!mapped) return false;
    if (mapped.field) fail(mapped.field, mapped.message);
    else raise(mapped.banner);
    return true;
  }

  function accountStoreReady() {
    if (typeof auth.isAccountStoreAvailable !== 'function' || auth.isAccountStoreAvailable()) return true;
    raise('暂时无法完成，请重试。');
    return false;
  }

  function validSignedInResult(result) {
    return result?.ok === true
      && result.user && typeof result.user.email === 'string' && typeof result.user.name === 'string'
      && result.session && typeof result.session.id === 'string'
      && typeof result.session.email === 'string'
      && normalizeEmail(result.user.email) === normalizeEmail(result.session.email);
  }

  async function finishSignedIn(id, result) {
    if (!stillCurrent(id)) return true;
    if (!validSignedInResult(result)) {
      showOutcome(result);
      return false;
    }
    try {
      const status = await onSignedIn?.(result);
      if (status?.persisted === false && stillCurrent(id)) {
        setSessionRecovery(true);
        onDismissNotice?.();
        setBanner({ message: '登录状态未保存。', tone: 'neutral' });
        return false;
      }
      return true;
    } catch (failure) {
      if (stillCurrent(id)) reportFailure(failure);
      return false;
    }
  }

  async function sendCode() {
    const target = isRecoveryConfirm ? codeEmail : email;
    const addressMessage = emailError(target);
    if (addressMessage) return fail('email', addressMessage);
    if (isRegistration && !registrationOpen) return raise('注册暂时关闭，请返回登录。');
    if (!accountStoreReady()) return;
    if (isRegistration && auth.isRegistered(target)) {
      return fail('email', '这个邮箱已经注册过了，直接登录，或换一个邮箱。');
    }
    if (!isRegistration && !auth.isRegistered(target)) {
      return fail('email', '这个邮箱没有可找回的账户。');
    }

    clearFieldError();
    onDismissNotice?.();
    setBanner(null);
    const id = begin('code');
    try {
      const purpose = isRegistration ? 'register' : 'recovery';
      const sent = await onSendCode({ email: normalizeEmail(target), purpose });
      if (!stillCurrent(id)) return;
      if (!sent || typeof sent.email !== 'string' || normalizeEmail(sent.email) !== normalizeEmail(target)
        || typeof sent.challengeId !== 'string' || !sent.challengeId
        || !Number.isFinite(sent.expiresAt) || !Number.isFinite(sent.resendAt)) {
        reportFailure({ kind: 'malformed-result' }, '验证码发送失败，请重试。');
        return;
      }
      setCodeSent(true);
      setCodeEmail(sent.email);
      setChallengeId(sent.challengeId || '');
      setResendAt(cooldownWaived ? 0 : sent.resendAt);
      setCodeExpiresAt(sent.expiresAt);
      if (isRecoveryRequest) {
        setEmail(sent.email);
        onModeChange('recovery-confirm');
      }
    } catch (failure) {
      if (!stillCurrent(id)) return;
      if (failure?.kind === 'cooldown') {
        setResendAt(Date.now() + failure.retryAfter * 1000);
        raise(`请 ${failure.retryAfter} 秒后再重新发送。`);
      } else if (failure?.kind === 'occupied') {
        fail('email', '这个邮箱已经注册过了，直接登录，或换一个邮箱。');
      } else if (failure?.kind === 'unknown-account') {
        fail('email', '这个邮箱没有可找回的账户。');
      } else {
        reportFailure(failure, '验证码发送失败，请重试。');
      }
    } finally {
      if (pendingOperationRef.current?.id === id) {
        pendingOperationRef.current = null;
        setPending('');
      }
    }
  }

  function validateRecoveryRequest() {
    const addressMessage = emailError(email);
    if (addressMessage) {
      fail('email', addressMessage);
      return false;
    }
    if (!accountStoreReady()) return false;
    if (!auth.isRegistered(email)) {
      fail('email', '这个邮箱没有可找回的账户。');
      return false;
    }
    return true;
  }

  async function confirmRecovery() {
    if (!/^[0-9]{6}$/.test(verificationCode)) return fail('code', `请输入 ${CODE_LENGTH} 位数字验证码（0-9）。`);
    const passwordMessage = passwordError(password, '新密码');
    if (passwordMessage) return fail('password', passwordMessage);
    if (password !== passwordConfirmation) return fail('confirmation', '两次输入的新密码不一致。');
    if (!codeSent) return fail('code', '请先发送验证码。');

    clearFieldError();
    onDismissNotice?.();
    setBanner(null);
    const snapshot = {
      email: codeEmail,
      code: verificationCode,
      challengeId,
      password
    };
    const id = begin('submit');
    try {
      const outcome = await onConfirmRecovery(snapshot);
      if (!stillCurrent(id)) return;
      if (showOutcome(outcome)) return;
      switchMode('login');
      onNotice?.({ message: '密码已重置，请用新密码登录。', tone: 'success' });
    } catch (failure) {
      if (stillCurrent(id)) reportFailure(failure, '重置失败，请重试。');
    } finally {
      if (pendingOperationRef.current?.id === id) {
        pendingOperationRef.current = null;
        setPending('');
      }
    }
  }

  async function retrySessionSave() {
    const result = await onRetrySession?.();
    if (result?.persisted) return;
    if (result?.invalid) return;
    raise('仍未能保存登录状态，请重试，或继续当前会话。', 'neutral');
  }

  function abandonSessionRecovery() {
    switchMode('login');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    if (isRecoveryConfirm) {
      await confirmRecovery();
      return;
    }

    if (isRecoveryRequest) {
      if (!validateRecoveryRequest()) return;
      await sendCode();
      return;
    }

    const addressMessage = emailError(email);
    if (addressMessage) return fail('email', addressMessage);

    if (isRegistration) {
      if (!registrationOpen) return raise('注册暂时关闭，请返回登录。');
      const trimmedName = name.trim();
      const nameLength = codePointLength(trimmedName);
      if (!trimmedName) return fail('name', '请填写昵称。');
      if (nameLength > 40) return fail('name', '昵称不能超过 40 个字符。');
      const passwordMessage = passwordError(password);
      if (passwordMessage) return fail('password', passwordMessage);
      if (password !== passwordConfirmation) return fail('confirmation', '两次输入的密码不一致。');
      if (!codeSent) return fail('code', '请先发送邮箱验证码。');
      if (!/^[0-9]{6}$/.test(verificationCode)) return fail('code', `请输入 ${CODE_LENGTH} 位数字验证码（0-9）。`);
      if (!agreed) return fail('agreed', '需要同意服务条款才能创建账户。');

      clearFieldError();
      onDismissNotice?.();
      setBanner(null);
      const snapshot = {
        name: trimmedName,
        email: normalizeEmail(email),
        password,
        code: verificationCode,
        challengeId,
        remember
      };
      const id = begin('submit');
      try {
        const outcome = await onSubmit(snapshot);
        if (!stillCurrent(id)) return;
        if (showOutcome(outcome)) return;
        await finishSignedIn(id, outcome);
      } catch (failure) {
        if (stillCurrent(id)) reportFailure(failure, '注册失败，请重试。');
      } finally {
        if (pendingOperationRef.current?.id === id) {
          pendingOperationRef.current = null;
          setPending('');
        }
      }
      return;
    }

    const passwordMessage = passwordError(password);
    if (passwordMessage) return fail('password', passwordMessage);
    clearFieldError();
    onDismissNotice?.();
    setBanner(null);
    const snapshot = { email: normalizeEmail(email), password, remember };
    const id = begin('submit');
    try {
      const outcome = await onSubmit(snapshot);
      if (!stillCurrent(id)) return;
      await finishSignedIn(id, outcome);
    } catch (failure) {
      if (stillCurrent(id)) {
        reportFailure(failure, '登录失败，请重试。');
        if (failure?.kind === 'invalid-credentials') setPassword('');
      }
    } finally {
      if (pendingOperationRef.current?.id === id) {
        pendingOperationRef.current = null;
        setPending('');
      }
    }
  }

  function fieldErrorFor(field) {
    if (fieldError.field !== field) return null;
    return <small className="ae-field-error" role="alert">{fieldError.message}</small>;
  }

  function changeRecoveryEmail() {
    setEmail(codeEmail);
    switchMode('recovery-request');
  }

  function edit(setter, value) {
    invalidatePending();
    setter(value);
    if (fieldError.field) clearFieldError();
  }

  const activeNotice = banner || notice;
  const codeNote = codeSent
    ? `验证码已发送至 ${codeEmail}，${minutesLeft(codeExpiresAt)} 分钟内有效`
    : '';
  const longCodeEmail = codeSent && codeEmail.length > 64;

  function renderCodeNote() {
    if (!codeSent) return null;
    if (!longCodeEmail) return <small className="ae-field-note">{codeNote}</small>;
    return (
      <small className="ae-field-note is-long-address" aria-label={codeNote}>
        <span className="ae-code-note-label">验证码已发送至</span>
        <span className="ae-code-note-expiry">{minutesLeft(codeExpiresAt)} 分钟内有效</span>
        <span className="ae-code-note-address" title={codeEmail} aria-label={codeEmail}>{codeEmail}</span>
      </small>
    );
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

          {activeNotice && (
            <div
              className={`ae-notice is-${activeNotice.tone || 'error'}`}
              role={activeNotice.tone === 'success' || activeNotice.tone === 'neutral' ? 'status' : 'alert'}
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

          {sessionRecovery && pendingSessionAvailable ? (
            <div className="ae-session-recovery">
              <p>{isRegistration ? '账户已创建，但登录状态未能保存。' : '登录已完成，但登录状态未能保存。'}继续当前会话可以立即进入工作台，也可以重试保存登录状态。</p>
              <button className="ae-primary" type="button" onClick={onContinueSession}>继续进入工作台</button>
              <button className="ae-send is-block" type="button" onClick={retrySessionSave}>重试保存登录状态</button>
              <button className="ae-text-action ae-recovery-return" type="button" onClick={abandonSessionRecovery}>返回登录</button>
            </div>
          ) : isRegistration && !registrationOpen ? (
            <div className="ae-closed-state">
              <p>目前暂时不能创建新账户。</p>
              <button className="ae-send is-block" type="button" onClick={() => switchMode('login')}>
                返回登录
              </button>
            </div>
          ) : (
            <form className="ae-form" noValidate onSubmit={submit} aria-label={copy.title}>
              {isRegistration && (
                <label className={`ae-field${fieldError.field === 'name' ? ' has-error' : ''}`}>
                  <span className="ae-field-head">
                    <span>昵称</span>
                    <small className="ae-field-count">{codePointLength(name.trim())}/40</small>
                  </span>
                  <input
                    autoComplete="nickname"
                    value={name}
                    onChange={(event) => edit(setName, event.target.value)}
                  />
                  {fieldErrorFor('name')}
                </label>
              )}

              <label className={`ae-field${fieldError.field === 'email' ? ' has-error' : ''}`}>
                <span>邮箱</span>
                {isRecoveryConfirm ? (
                  <input type="text" inputMode="email" autoComplete="email" value={codeEmail} readOnly aria-readonly="true" tabIndex={-1} />
                ) : (
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={isRegistration ? '' : 'example@example.com'}
                    value={email}
                    onChange={(event) => {
                      edit(setEmail, event.target.value);
                      if (isRegistration && codeSent) resetCodeState();
                    }}
                  />
                )}
                {isRecoveryConfirm && (
                  <small className="ae-field-hint">
                    验证码只对这个地址有效，<button type="button" className="ae-inline-action" onClick={changeRecoveryEmail}>更换邮箱</button>
                  </small>
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
                      autoComplete="one-time-code"
                      placeholder={`例如 ${VERIFICATION_CODE}`}
                      value={verificationCode}
                      onChange={(event) => edit(setVerificationCode, event.target.value)}
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
                  {renderCodeNote()}
                  {fieldErrorFor('code')}
                </div>
              )}

              {isRecoveryConfirm && codeSent && (
                <label className={`ae-field${fieldError.field === 'code' ? ' has-error' : ''}`}>
                  <span>验证码</span>
                  <span className="ae-combo">
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      placeholder={`例如 ${RECOVERY_CODE}`}
                      value={verificationCode}
                      onChange={(event) => edit(setVerificationCode, event.target.value)}
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
                  {renderCodeNote()}
                  <small className="ae-field-hint">没有收到验证码？冷却结束后可以重新发送，也可以更换邮箱。</small>
                  {fieldErrorFor('code')}
                </label>
              )}

              {!isRecoveryRequest && (
                <label htmlFor="ae-password" className={`ae-field${fieldError.field === 'password' ? ' has-error' : ''}`}>
                  <span className="ae-field-head">
                    <span>{isRecoveryConfirm ? '新密码' : '密码'}</span>
                    <small className="ae-field-count">{codePointLength(password)}/128</small>
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
                      onChange={(event) => edit(setPassword, event.target.value)}
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
                    onChange={(event) => edit(setPasswordConfirmation, event.target.value)}
                  />
                  {fieldErrorFor('confirmation')}
                </label>
              )}

              {mode === 'login' && (
                <label className="ae-check">
                  <input type="checkbox" checked={remember} onChange={(event) => edit(setRemember, event.target.checked)} />
                  <span>记住我</span>
                </label>
              )}

              {isRegistration && (
                <label className={`ae-check is-terms${fieldError.field === 'agreed' ? ' has-error' : ''}`}>
                  <input type="checkbox" checked={agreed} onChange={(event) => edit(setAgreed, event.target.checked)} />
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
          )}
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
