import nodemailer from 'nodemailer';

export const PASSWORD_RECOVERY_SUBJECT = 'RefatOS password recovery code';

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

export function createRecoveryMailSender(runtimeEnv) {
  if (!runtimeEnv.smtpHost) {
    if (runtimeEnv.nodeEnv === 'production') {
      return {
        async send() {
          throw new Error('SMTP is not configured.');
        }
      };
    }

    return {
      async send(message) {
        console.info(`[RefatOS password recovery] To: ${message.to}\n${message.text}`);
      }
    };
  }

  const transport = createSmtpTransport(runtimeEnv);
  return {
    send(message) {
      return transport.sendMail({
        from: runtimeEnv.smtpFrom,
        to: message.to,
        subject: message.subject,
        text: message.text
      });
    }
  };
}
