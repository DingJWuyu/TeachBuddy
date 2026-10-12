const prefix = 'teachbuddy:auth-revocation:';

// These are directed action intents, never credentials or cached identities.
export function listRevocations() {
  return Object.keys(localStorage).filter(key => key.startsWith(prefix)).sort().map(key => {
    const value = JSON.parse(localStorage.getItem(key));
    if (value?.version !== 1 || typeof value.sessionId !== 'string' || !value.sessionId
      || !['logout', 'pending', 'recovery'].includes(value.source) || typeof value.uncertain !== 'boolean'
      || key !== prefix + value.sessionId) throw new Error('revocation-storage');
    return value;
  });
}

export function rememberRevocation(value) {
  const raw = JSON.stringify({ version: 1, sessionId: value.sessionId, source: value.source, uncertain: value.uncertain });
  localStorage.setItem(prefix + value.sessionId, raw);
  if (localStorage.getItem(prefix + value.sessionId) !== raw) throw new Error('revocation-storage');
}

export function forgetRevocation(sessionId) {
  localStorage.removeItem(prefix + sessionId);
  if (localStorage.getItem(prefix + sessionId) !== null) throw new Error('revocation-storage');
}
