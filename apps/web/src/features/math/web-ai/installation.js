const minimumVersion = [0, 1, 0];

function storeEntry(value, browser) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return null;
    const valid = browser === 'chrome'
      ? url.hostname === 'chromewebstore.google.com' && /^\/detail\/[^/]+\/[a-p]{32}\/?$/.test(url.pathname)
      : url.hostname === 'microsoftedge.microsoft.com' && /^\/addons\/detail\/(?:[^/]+\/)?[a-p]{32}\/?$/.test(url.pathname);
    return valid ? url.href : null;
  } catch { return null; }
}

export function getInstallation() {
  const ua = navigator.userAgent;
  const desktop = !/Mobile|Android|iPhone|iPad|EdgiOS|EdgA/i.test(ua) &&
    !(/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const browser = desktop && /Edg\/\d+/.test(ua) ? 'edge'
    : desktop && /Chrome\/\d+/.test(ua) && !/OPR\/|Vivaldi\/|SamsungBrowser\//.test(ua) &&
      (navigator.userAgentData?.brands?.some((brand) => brand.brand === 'Google Chrome') ||
        (!navigator.userAgentData && navigator.vendor === 'Google Inc.')) ? 'chrome' : 'unsupported';
  const env = import.meta.env || {};
  return { browser, name: browser === 'edge' ? 'Microsoft Edge' : browser === 'chrome' ? 'Google Chrome' : '当前浏览器',
    storeUrl: browser === 'unsupported' ? null : storeEntry(browser === 'edge'
      ? env.VITE_MATH_AI_EDGE_STORE_URL : env.VITE_MATH_AI_CHROME_STORE_URL, browser) };
}

/** Existing 0.1 protocol remains supported; hot installation starts with 0.2. */
export function isExtensionCompatible(version) {
  if (typeof version !== 'string' || !/^\d+(?:\.\d+){2,3}$/.test(version)) return false;
  const parts = version.split('.').map(Number);
  // A future major version requires a reviewed protocol contract.
  if (parts[0] !== 0) return false;
  for (let index = 0; index < minimumVersion.length; index++) {
    if (parts[index] !== minimumVersion[index]) return parts[index] > minimumVersion[index];
  }
  return true;
}
