const t = (key, options) => i18n.t(key, { ns: 'auth', ...options });
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/index.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import BrandMark from './BrandMark.jsx';
import AuthEntryLayout from './AuthEntryLayout.jsx';
import PasswordToggle from './PasswordToggle.jsx';
import { useInternalAuth } from './AuthProvider.jsx';
import { COPY, unknownResultMessage } from './presentation.js';
import {
  codePointLength,
  emailIssue,
  isVerificationCodeShape,
  nicknameIssue,
  passwordIssue,
} from './rules.js';

const MODE_COPY = {
  login: {
    get title() { return t("登录"); },
    get submit() { return t("登录"); },
    get pending() { return t("登录中"); },
    get switchText() { return t("还没有账户？"); },
    get switchAction() { return t("创建账户"); },
    switchMode: 'register',
  },
  register: {
    get title() { return t("注册"); },
    get submit() { return t("注册"); },
    get pending() { return t("注册中"); },
    get switchText() { return t("已经有账户？"); },
    get switchAction() { return t("登录"); },
    switchMode: 'login',
  },
  'recovery-request': {
    get title() { return t("找回密码"); },
    get submit() { return t("发送验证码"); },
    get pending() { return t("发送中"); },
    get switchText() { return t("想起密码了？"); },
    get switchAction() { return t("返回登录"); },
    switchMode: 'login',
  },
  'recovery-confirm': {
    get title() { return t("设置新密码"); },
    get submit() { return t("重置密码"); },
    get pending() { return t("提交中"); },
    switchText: '',
    get switchAction() { return t("返回登录"); },
    switchMode: 'login',
  },
};

const EMPTY_ERROR = Object.freeze({ field: '', message: '' });

function emptyChallenge() {
  return {
    challengeId: '',
    email: '',
    expiresAt: 0,
    resendAt: 0,
  };
}

export default function AuthSurface() {
  const { t } = useTranslation('auth');
  const auth = useInternalAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [challenge, setChallenge] = useState(emptyChallenge);
  const [codeSent, setCodeSent] = useState(false);
  const [codeEmail, setCodeEmail] = useState('');
  const [codeExpiresAt, setCodeExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [busy, setBusy] = useState('');
  const [fieldError, setFieldError] = useState(EMPTY_ERROR);
  const [banner, setBanner] = useState(null);
  const [closed, setClosed] = useState(false);
  const [tick, setTick] = useState(0);
  const operationRef = useRef(0);
  const clockSkewRef = useRef(0);

  const isRegistration = mode === 'register';
  const isRecoveryRequest = mode === 'recovery-request';
  const isRecoveryConfirm = mode === 'recovery-confirm';
  const isPendingSave = auth.status === 'pending' && auth.persistenceFailed;
  const revocation = auth.revocation;
  const copy = MODE_COPY[mode];

  const serverNow = () => Date.now() + clockSkewRef.current;
  const secondsLeft = resendAt ? Math.max(0, Math.ceil((resendAt - serverNow()) / 1000)) : 0;
  const codeExpired = codeSent && codeExpiresAt > 0 && serverNow() >= codeExpiresAt;
  const minutesLeft = codeExpiresAt ? Math.max(1, Math.ceil((codeExpiresAt - serverNow()) / 60_000)) : 10;

  useEffect(() => {
    /* The ticker also drives a step-one cooldown after a 429, when no code has
     * been installed yet. */
    if (!codeSent && !resendAt) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), 500);
    return () => clearInterval(timer);
  }, [codeSent, resendAt]);

  useEffect(() => {
    if (!isRegistration) return undefined;
    if (auth.registrationOpen === false) setClosed(true);
    void auth.refreshRegistrationOpen().then((open) => {
      if (open === true) setClosed(false);
      if (open === false) setClosed(true);
    });
    const onFocus = () => {
      void auth.refreshRegistrationOpen().then((open) => {
        if (open === false) setClosed(true);
        if (open === true) setClosed(false);
      });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // The effect intentionally re-runs only when the register form is entered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegistration]);

  const activeNotice = banner || auth.notice;
  const expression = busy || revocation?.phase === 'running' ? 'busy'
    : fieldError.field || activeNotice?.tone === 'error' || revocation?.phase === 'failed' ? 'error'
      : activeNotice?.tone === 'success' ? 'success' : 'idle';

  function invalidate() {
    operationRef.current += 1;
    auth.invalidateOperation();
    setBusy('');
  }

  function begin(type) {
    operationRef.current += 1;
    setBusy(type);
    return operationRef.current;
  }

  function isCurrent(id) {
    return operationRef.current === id;
  }

  function end(id) {
    if (operationRef.current === id) setBusy('');
  }

  function fail(field, message) {
    setFieldError({ field, message });
  }

  function clearMessages() {
    setFieldError(EMPTY_ERROR);
    setBanner(null);
    auth.dismissNotice();
  }

  function resetChallenge() {
    setChallenge(emptyChallenge());
    setCodeSent(false);
    setCodeEmail('');
    setCodeExpiresAt(0);
    setResendAt(0);
    setVerificationCode('');
  }

  function resetChallengeInput() {
    setVerificationCode('');
  }

  function installChallenge(next) {
    clockSkewRef.current = Date.parse(next.serverTime) - Date.now();
    setChallenge({
      challengeId: next.challengeId,
      email: next.email,
      expiresAt: Date.parse(next.expiresAt),
      resendAt: Date.parse(next.resendAt),
    });
    setCodeSent(true);
    setCodeEmail(next.email);
    setResendAt(Date.parse(next.resendAt));
    setCodeExpiresAt(Date.parse(next.expiresAt));
    setVerificationCode('');
  }

  function applyResult(result, operation) {
    if (!result || result.stale || result.ok) return;
    if (result.field) {
      fail(result.field, result.message);
      return;
    }
    if (result.closed) {
      setClosed(true);
      return;
    }
    if (result.unknown) {
      setBanner({ message: unknownResultMessage(operation), tone: 'neutral' });
      return;
    }
    if (result.banner) {
      setBanner({ message: result.banner.message, tone: result.banner.tone });
      if (result.banner.clearPassword) setPassword('');
    }
    /* expired / persistenceFailed / verifyFailed are rendered by the gate cards */
  }

  function edit(setter, value) {
    invalidate();
    setter(value);
    if (fieldError.field) setFieldError(EMPTY_ERROR);
  }

  function switchMode(next, { preserveEmail = true } = {}) {
    if (auth.status === 'pending') auth.abandonPending();
    invalidate();
    setMode(next);
    setBanner(null);
    setClosed(false);
    setFieldError(EMPTY_ERROR);
    auth.dismissNotice();
    setName('');
    setPassword('');
    setPasswordVisible(false);
    setPasswordConfirmation('');
    setAgreed(false);
    setRemember(true);
    resetChallenge();
    if (!preserveEmail) setEmail('');
  }

  function changeRecoveryEmail() {
    setEmail(codeEmail);
    switchMode('recovery-request');
  }

  function checkEmail(target) {
    const issue = emailIssue(target);
    if (!issue) return true;
    fail('email', issue === 'empty' ? COPY.emailEmpty : COPY.emailInvalid);
    return false;
  }

  function checkNickname(value) {
    const issue = nicknameIssue(value);
    if (!issue) return true;
    fail('name', issue === 'empty' ? COPY.nicknameEmpty : COPY.nicknameTooLong);
    return false;
  }

  function checkPassword(value, label) {
    const issue = passwordIssue(value);
    if (!issue) return true;
    fail('password', issue === 'too-short' ? COPY.passwordTooShort(label) : COPY.passwordTooLong(label));
    return false;
  }

  async function sendCode(purpose) {
    if (revocation) return;
    const target = isRecoveryConfirm ? codeEmail : email;
    if (!checkEmail(target)) return;
    if (purpose === 'registration' && auth.registrationOpen === false) {
      setClosed(true);
      return;
    }
    clearMessages();
    const id = begin('code');
    try {
      const result = await auth.sendCode({ purpose, email: target });
      if (!isCurrent(id)) return;
      if (!result || result.stale) return;
      if (result.ok) {
        installChallenge(result.challenge);
        if (isRecoveryRequest) setMode('recovery-confirm');
        return;
      }
      if (result.cooldown) {
        setResendAt(serverNow() + result.cooldown.retryAfterSeconds * 1000);
        setBanner({
          message: t("请 {{count}} 秒后再重新发送。", { count: result.cooldown.retryAfterSeconds }),
          tone: 'error',
        });
        return;
      }
      applyResult(result, purpose === 'registration' ? 'register' : 'password-reset');
    } finally {
      end(id);
    }
  }

  async function submitLogin() {
    if (!checkEmail(email)) return;
    if (!checkPassword(password, t("密码"))) return;
    clearMessages();
    const id = begin('submit');
    try {
      const result = await auth.login({ email, password, rememberMe: remember });
      if (!isCurrent(id)) return;
      applyResult(result, 'login');
    } finally {
      end(id);
    }
  }

  async function submitRegistration() {
    if (!checkEmail(email)) return;
    // The availability read belongs to this submission too. Editing or leaving
    // the form must invalidate it before it can start an account operation.
    const id = begin('preflight');
    try {
      const open = await auth.refreshRegistrationOpen();
      if (!isCurrent(id)) return;
      if (open === false) {
        setClosed(true);
        return;
      }
      if (!checkNickname(name)) return;
      if (!checkPassword(password, t("密码"))) return;
      if (password !== passwordConfirmation) {
        fail('confirmation', COPY.confirmationMismatch);
        return;
      }
      if (!codeSent || !challenge.challengeId) {
        fail('code', COPY.codeNotSent);
        return;
      }
      if (!isVerificationCodeShape(verificationCode)) {
        fail('code', COPY.codeShape);
        return;
      }
      if (!agreed) {
        fail('agreed', COPY.termsRequired);
        return;
      }
      if (codeExpired) {
        fail('code', COPY.codeExpired);
        return;
      }
      clearMessages();
      setBusy('submit');
      const result = await auth.register({
        email,
        nickname: name,
        password,
        challengeId: challenge.challengeId,
        verificationCode,
      });
      if (!isCurrent(id)) return;
      applyResult(result, 'register');
    } finally {
      end(id);
    }
  }

  async function submitReset() {
    if (!isVerificationCodeShape(verificationCode)) {
      fail('code', COPY.codeShape);
      return;
    }
    if (!checkPassword(password, t("新密码"))) return;
    if (password !== passwordConfirmation) {
      fail('confirmation', COPY.confirmationMismatch);
      return;
    }
    if (!codeSent || !challenge.challengeId) {
      fail('code', COPY.codeNotSentRecovery);
      return;
    }
    if (codeExpired) {
      fail('code', COPY.codeExpired);
      return;
    }
    clearMessages();
    const id = begin('submit');
    try {
      const result = await auth.resetPassword({
        email: codeEmail,
        challengeId: challenge.challengeId,
        verificationCode,
        password,
      });
      if (!isCurrent(id)) return;
      if (result?.ok) {
        switchMode('login', { preserveEmail: true });
        setEmail(codeEmail);
        setBanner({ message: COPY.resetDone, tone: 'success' });
        return;
      }
      applyResult(result, 'password-reset');
    } finally {
      end(id);
    }
  }

  async function runPendingCommand(command) {
    const id = begin('submit');
    try {
      const result = await command();
      applyResult(result, 'login');
      if (result && !result.ok && !result.stale && !result.verifyFailed) {
        setBanner({ message: COPY.persistRetry, tone: 'neutral' });
      }
    } finally {
      end(id);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (busy || revocation) return;
    if (isRecoveryConfirm) {
      void submitReset();
      return;
    }
    if (isRecoveryRequest) {
      void sendCode('password-reset');
      return;
    }
    if (isRegistration) {
      void submitRegistration();
      return;
    }
    void submitLogin();
  }

  function fieldErrorFor(field) {
    if (fieldError.field !== field) return null;
    return <small className="ae-field-error" role="alert">{fieldError.message}</small>;
  }

  const codeNote = useMemo(() => {
    if (!codeSent) return null;
    const label = codeExpired ? t("验证码已过期，请重新发送") : t("验证码已发送至 {{email}}，{{count}} 分钟内有效", { email: codeEmail, count: minutesLeft });
    return { label, address: codeEmail, long: codeEmail.length > 64, expired: codeExpired };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeSent, codeEmail, codeExpired, minutesLeft, tick, t]);

  function renderCodeNote() {
    if (!codeNote) return null;
    if (!codeNote.long) {
      return <small className={`ae-field-note${codeNote.expired ? ' is-expired' : ''}`}>{codeNote.label}</small>;
    }
    return (
      <small className="ae-field-note is-long-address" aria-label={codeNote.label}>
        <span className="ae-code-note-label">{codeNote.expired ? t("验证码已过期，") : t("验证码已发送至")}</span>
        <span className="ae-code-note-expiry">{codeNote.expired ? t("请重新发送") : t("{{count}} 分钟内有效", { count: minutesLeft })}</span>
        <span className="ae-code-note-address" title={codeNote.address} aria-label={codeNote.address}>{codeNote.address}</span>
      </small>
    );
  }

  function onNoticeDismiss() {
    setBanner(null);
    auth.dismissNotice();
  }

  function renderCodeField(label) {
    return (
      <div className={`ae-field${fieldError.field === 'code' ? ' has-error' : ''}`}>
        <div className="ae-field-head">
          <label htmlFor="ae-code">{label}</label>
        </div>
        <div className="ae-combo">
          <input
            id="ae-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={isRegistration ? t("例如 309614") : t("例如 841207")}
            value={verificationCode}
            onChange={(event) => edit(setVerificationCode, event.target.value)}
          />
          <button
            className="ae-send"
            type="button"
            onClick={() => sendCode(isRegistration ? 'registration' : 'password-reset')}
            disabled={secondsLeft > 0 || busy === 'code' || Boolean(revocation)}
          >
            {busy === 'code' ? t("发送中") : secondsLeft > 0 ? t("{{count}}s 后重发", { count: secondsLeft }) : t("重新发送")}
          </button>
        </div>
        {renderCodeNote()}
        {isRecoveryConfirm && (
          <small className="ae-field-hint">{t("没有收到验证码？冷却结束后可以重新发送，也可以更换邮箱。")}</small>
        )}
        {fieldErrorFor('code')}
      </div>
    );
  }

  if (isPendingSave) {
    return (
      <AuthEntryLayout surface="pending-save" expression={expression}>
        <div className="ae-shell">
          <header className="ae-brand">
            <BrandMark />
          </header>
          <div className="ae-card">
            <div className="ae-card-head">
              <h1>{t("保存登录状态")}</h1>
            </div>
            {activeNotice && (
              <div className={`ae-notice is-${activeNotice.tone || 'error'}`} role={activeNotice.tone === 'error' ? 'alert' : 'status'}>
                <span>{activeNotice.message}</span>
                <button className="ae-notice-dismiss" type="button" aria-label={t("关闭提示")} onClick={onNoticeDismiss}>×</button>
              </div>
            )}
            <div className="ae-session-recovery">
              <p>
                {auth.pending?.origin === 'register' ? t("账户已创建，但登录状态未能保存。") : t("登录已完成，但登录状态未能保存。")}
                {t("继续当前会话可以立即进入工作台，也可以重试保存登录状态。")}
              </p>
              <button className="ae-primary" type="button" onClick={() => runPendingCommand(auth.continuePending)} disabled={busy === 'submit'}>
                {busy === 'submit' ? t("处理中") : t("继续进入工作台")}
              </button>
              <button className="ae-send is-block" type="button" onClick={() => runPendingCommand(auth.retryPersist)} disabled={busy === 'submit'}>
                {t("重试保存登录状态")}
              </button>
              <button className="ae-text-action ae-recovery-return" type="button" onClick={() => switchMode('login')}>
                {t("返回登录")}
              </button>
            </div>
          </div>
        </div>
      </AuthEntryLayout>
    );
  }

  return (
    <AuthEntryLayout surface={mode} expression={expression} passwordVisible={passwordVisible}>
      <div className="ae-shell">
        <header className="ae-brand">
          <BrandMark />
        </header>

        <div className="ae-card">
          <div className="ae-card-head">
            <h1>{closed ? MODE_COPY.register.title : copy.title}</h1>
          </div>

          {revocation ? (
            <div className={`ae-notice is-${revocation.phase === 'failed' ? 'error' : 'neutral'}`} role={revocation.phase === 'failed' ? 'alert' : 'status'}>
              <span>
                {revocation.phase === 'running' ? t("正在确认退出…") : revocation.phase === 'unknown' ? t("退出结果暂未确认，请重试确认。") : t("退出失败，请重试。")}
                {revocation.phase !== 'running' && (
                  <>
                    {' '}
                    <button className="ae-inline-action" type="button" onClick={() => auth.retryRevocation()}>{t("重试确认退出")}</button>
                  </>
                )}
              </span>
            </div>
          ) : activeNotice && (
            <div
              className={`ae-notice is-${activeNotice.tone || 'error'}`}
              role={activeNotice.tone === 'error' ? 'alert' : 'status'}
            >
              <span>{activeNotice.message}</span>
              <button className="ae-notice-dismiss" type="button" aria-label={t("关闭提示")} onClick={onNoticeDismiss}>×</button>
            </div>
          )}

          {closed ? (
            <div className="ae-closed-state">
              <p>{COPY.registrationClosed}</p>
              <button className="ae-send is-block" type="button" onClick={() => switchMode('login')}>
                {t("返回登录")}
              </button>
            </div>
          ) : (
            <form className="ae-form" noValidate onSubmit={submit} aria-label={copy.title}>
              {auth.pendingDeletions?.map((deletion) => (
                <div className="ae-field" role="group" aria-label={deletion.email} key={deletion.requestId}>
                  <small className="ae-field-note is-long-address" title={`${deletion.nickname} (${deletion.email})`}>
                    <span className="ae-code-note-address">{deletion.nickname} ({deletion.email})</span>
                  </small>
                  <button className="ae-send is-block" type="button" onClick={() => auth.resumeDeletion(deletion.requestId)} disabled={Boolean(revocation)}>
                    {t("继续核实账户删除")}
                  </button>
                </div>
              ))}
              {isRegistration && (
                <div className={`ae-field${fieldError.field === 'name' ? ' has-error' : ''}`}>
                  <div className="ae-field-head">
                    <label htmlFor="ae-name">{t("昵称")}</label>
                    <small className="ae-field-count">{codePointLength(name.trim())}/40</small>
                  </div>
                  <input
                    id="ae-name"
                    autoComplete="nickname"
                    value={name}
                    onChange={(event) => edit(setName, event.target.value)}
                  />
                  {fieldErrorFor('name')}
                </div>
              )}

              <div className={`ae-field${fieldError.field === 'email' ? ' has-error' : ''}`}>
                <div className="ae-field-head">
                  <label htmlFor="ae-email">{t("邮箱")}</label>
                </div>
                {isRecoveryConfirm ? (
                  <input
                    id="ae-email"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    value={codeEmail}
                    readOnly
                    aria-readonly="true"
                    tabIndex={-1}
                  />
                ) : (
                  <input
                    id="ae-email"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={isRegistration ? '' : 'example@example.com'}
                    value={email}
                    onChange={(event) => {
                      edit(setEmail, event.target.value);
                      if (isRegistration && codeSent) resetChallenge();
                    }}
                  />
                )}
                {isRecoveryConfirm && (
                  <small className="ae-field-hint">
                    {t("验证码只对这个地址有效，")}
                    <button type="button" className="ae-inline-action" onClick={changeRecoveryEmail}>{t("更换邮箱")}</button>
                  </small>
                )}
                {fieldErrorFor('email')}
              </div>

              {isRegistration && !codeSent && (
                <div className="ae-field">
                  <button
                    className="ae-send is-block"
                    type="button"
                    onClick={() => sendCode('registration')}
                    disabled={secondsLeft > 0 || busy === 'code' || Boolean(revocation)}
                  >
                    {busy === 'code' ? t("发送中") : secondsLeft > 0 ? t("{{count}}s 后重发", { count: secondsLeft }) : t("发送验证码")}
                  </button>
                  {fieldErrorFor('code')}
                </div>
              )}

              {isRegistration && codeSent && renderCodeField(t("邮箱验证码"))}
              {isRecoveryConfirm && codeSent && renderCodeField(t("验证码"))}

              {!isRecoveryRequest && (
                <div className={`ae-field${fieldError.field === 'password' ? ' has-error' : ''}`}>
                  <div className="ae-field-head">
                    <label htmlFor="ae-password">{isRecoveryConfirm ? t("新密码") : t("密码")}</label>
                    <small className="ae-field-count">{codePointLength(password)}/128</small>
                    {mode === 'login' && (
                      <button className="ae-text-action" type="button" onClick={() => switchMode('recovery-request')}>
                        {t("忘记密码？")}
                      </button>
                    )}
                  </div>
                  <span className="ae-password">
                    <input
                      id="ae-password"
                      type={passwordVisible ? 'text' : 'password'}
                      autoComplete={isRegistration || isRecoveryConfirm ? 'new-password' : 'current-password'}
                      placeholder={t("至少 8 位")}
                      value={password}
                      onChange={(event) => edit(setPassword, event.target.value)}
                    />
                    <PasswordToggle
                      visible={passwordVisible}
                      onToggle={() => setPasswordVisible((current) => !current)}
                    />
                  </span>
                  {fieldErrorFor('password')}
                </div>
              )}

              {(isRegistration || isRecoveryConfirm) && (
                <div className={`ae-field${fieldError.field === 'confirmation' ? ' has-error' : ''}`}>
                  <div className="ae-field-head">
                    <label htmlFor="ae-password-confirmation">{isRegistration ? t("确认密码") : t("确认新密码")}</label>
                  </div>
                  <input
                    id="ae-password-confirmation"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(event) => edit(setPasswordConfirmation, event.target.value)}
                  />
                  {fieldErrorFor('confirmation')}
                </div>
              )}

              {mode === 'login' && (
                <label className="ae-check">
                  <input type="checkbox" checked={remember} onChange={(event) => edit(setRemember, event.target.checked)} />
                  <span>{t("记住我")}</span>
                </label>
              )}

              {isRegistration && (
                <label className={`ae-check is-terms${fieldError.field === 'agreed' ? ' has-error' : ''}`}>
                  <input type="checkbox" checked={agreed} onChange={(event) => edit(setAgreed, event.target.checked)} />
                  <span>
                    {t("注册即表示同意")}
                    {' '}
                    <a href="#terms" onClick={(event) => event.preventDefault()}>{t("服务条款")}</a>
                    {fieldErrorFor('agreed')}
                  </span>
                </label>
              )}

              <button
                className="ae-primary"
                type="submit"
                disabled={busy !== '' || Boolean(revocation) || (isRecoveryRequest && secondsLeft > 0)}
                aria-busy={busy !== ''}
              >
                {busy === 'submit' || (busy === 'code' && isRecoveryRequest) ? copy.pending : isRecoveryRequest && secondsLeft > 0 ? t("{{count}}s 后重发", { count: secondsLeft }) : copy.submit}
              </button>
            </form>
          )}
        </div>

        <p className="ae-switch">
          {closed ? t("已经有账户？") : copy.switchText}
          {' '}
          <button type="button" onClick={() => switchMode(closed ? 'login' : copy.switchMode)}>
            {closed ? t("登录") : copy.switchAction}
          </button>
        </p>
        {!isRegistration && (
          <p className="ae-help">
            {t("登录遇到问题？邮箱联系管理员：")}
            <a href="mailto:example@example.com">example@example.com</a>{t("（请一并发送故障截图）")}
          </p>
        )}
      </div>
    </AuthEntryLayout>
  );
}
