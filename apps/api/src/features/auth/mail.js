import nodemailer from 'nodemailer';

function createSmtpTransport(runtimeEnv) {
  const options = {
    host: runtimeEnv.smtpHost,
    port: runtimeEnv.smtpPort,
    secure: runtimeEnv.smtpSecure
  };

  if (runtimeEnv.smtpUser) {
    options.auth = {
      user: runtimeEnv.smtpUser,
      pass: runtimeEnv.smtpPassword
    };
  }

  return nodemailer.createTransport(options);
}

// Authentication never falls back to logging a code. Local tests inject fake-mail.
export function createAuthCodeSender(runtimeEnv) {
  if (!runtimeEnv.smtpHost || !runtimeEnv.smtpFrom) {
    throw new Error('SMTP_HOST and SMTP_FROM are required for authentication mail.');
  }
  const transport = createSmtpTransport(runtimeEnv);
  return async ({ purpose, email, verificationCode }) => {
    const result = await transport.sendMail({
      from: runtimeEnv.smtpFrom,
      to: email,
      subject: purpose === 'registration' ? 'TeachBuddy 注册验证码' : 'TeachBuddy 重置密码验证码',
      text: `您的验证码是 ${verificationCode}。请勿向他人透露。`
    });
    if (!result.accepted?.some(address => String(address).toLowerCase() === email.toLowerCase()) || result.rejected?.length) {
      throw new Error('Mail provider did not accept the recipient.');
    }
  };
}
