function makeError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function badRequest(message) {
  throw makeError(message, 400);
}

export function ensureObject(value, message = 'Invalid request body.') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    badRequest(message);
  }
  return value;
}

export function ensureTrimmedString(value, label, options = {}) {
  if (typeof value !== 'string') {
    badRequest(`${label} is required.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    badRequest(`${label} is required.`);
  }

  if (options.maxLength && normalized.length > options.maxLength) {
    badRequest(`${label} must be ${options.maxLength} characters or fewer.`);
  }

  return normalized;
}

export function optionalTrimmedString(value, options = {}) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value !== 'string') {
    badRequest(`${options.label || 'Value'} must be text.`);
  }

  const normalized = value.trim();
  if (options.maxLength && normalized.length > options.maxLength) {
    badRequest(`${options.label || 'Value'} must be ${options.maxLength} characters or fewer.`);
  }

  return normalized;
}

export function ensureEnum(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    badRequest(`${label} must be one of: ${allowedValues.join(', ')}.`);
  }
  return value;
}

export function ensurePositiveInteger(value, label, options = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < (options.min ?? 1)) {
    badRequest(`${label} must be an integer greater than or equal to ${options.min ?? 1}.`);
  }
  if (options.max !== undefined && parsed > options.max) {
    badRequest(`${label} must be less than or equal to ${options.max}.`);
  }
  return parsed;
}

export function ensureIsoDate(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    badRequest(`${label} must be a valid date/time.`);
  }
  return new Date(value).toISOString();
}

export function ensureTimeString(value, label) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    badRequest(`${label} must use HH:MM format.`);
  }
  return value;
}

export function ensureStringArray(value, label) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const arrayValue = Array.isArray(value) ? value : String(value).split(',');
  const normalized = arrayValue
    .map((item) => String(item).trim())
    .filter(Boolean);

  const invalid = normalized.find((item) => item.length > 80);
  if (invalid) {
    badRequest(`${label} items must be 80 characters or fewer.`);
  }

  return normalized;
}
