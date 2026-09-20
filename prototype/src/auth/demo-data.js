/* In-memory prototype fixtures: sign-in validates form shape, not credentials. */
export const DEMO_PASSWORD = 'teachbuddy';

export const REGISTERED_EMAIL = 'example@example.com';

export const VERIFICATION_CODE = '309614';

export const RECOVERY_CODE = '841207';

export const SUPPORT_EMAIL = 'example@example.com';

export class PrototypeAuth {

  #passwords = new Map();

  isRegistered(email) {
    const address = String(email).trim().toLowerCase();
    return address === REGISTERED_EMAIL || this.#passwords.has(address);
  }

  nameFor(email) {
    const local = String(email).split('@')[0] || '老师';
    return `${local}老师`;
  }

  register({ name, email, password }) {
    if (this.isRegistered(email)) {
      throw new Error('这个邮箱已经注册过了，直接登录，或换一个邮箱。');
    }
    this.#passwords.set(String(email).trim().toLowerCase(), password);
    return { name, email };
  }

  signIn({ email }) {
    return { name: this.nameFor(email), email };
  }

  resetPassword({ code }) {
    if (String(code) !== RECOVERY_CODE) {
      throw new Error('验证码不正确，请检查后重试。');
    }
    return true;
  }
}
