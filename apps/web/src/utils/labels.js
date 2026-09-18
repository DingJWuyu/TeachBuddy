const errorLabels = {
  'Invalid request body.': '请求内容无效。',
  'Invalid email or password.': '邮箱或密码错误。',
  'An account with that email already exists.': '该邮箱已注册，请使用其他邮箱。',
  'Passwords do not match.': '两次输入的密码不一致。',
  'Recovery code must be a 6-digit number.': '验证码必须是 6 位数字。',
  'Invalid or expired password recovery code.': '验证码无效或已过期。',
  'SMTP is not configured.': '邮件服务尚未配置。',
  'Login failed.': '登录失败。',
  'Could not load workspace data.': '无法加载工作台数据。',
  'Something went wrong.': '出了点问题。',
  'Authentication required.': '请先登录。',
  'Route not found': '找不到请求的路由。'
};

export function localizeText(value) {
  return value;
}

export function localizeError(message) {
  if (!message) return message;
  if (errorLabels[message]) return errorLabels[message];

  const requiredMatch = message.match(/^(.+) is required\.$/);
  if (requiredMatch) return requiredMatch[1] + '为必填项。';

  const characterLimitMatch = message.match(/^(.+) must be (\d+) characters or fewer\.$/);
  if (characterLimitMatch) {
    return characterLimitMatch[1] + '不得超过 ' + characterLimitMatch[2] + ' 个字符。';
  }

  return message;
}
