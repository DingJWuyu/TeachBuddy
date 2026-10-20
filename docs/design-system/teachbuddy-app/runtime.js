(() => {
  const base = new URL('./', document.currentScript.src);
  globalThis.__teachbuddyBaseURL = base.href;

  function memoryStorage() {
    const values = new Map();
    const methods = {
      getItem: key => values.get(String(key)) ?? null,
      setItem: (key, value) => { values.set(String(key), String(value)); },
      removeItem: key => { values.delete(String(key)); },
      clear: () => values.clear(),
      key: index => [...values.keys()][index] ?? null,
    };
    return new Proxy({}, {
      get: (_, key) => key === 'length' ? values.size : methods[key] ?? values.get(key),
      set: (_, key, value) => { values.set(String(key), String(value)); return true; },
      deleteProperty: (_, key) => values.delete(key),
      ownKeys: () => [...values.keys()],
      getOwnPropertyDescriptor: (_, key) => values.has(key)
        ? { configurable: true, enumerable: true, writable: true, value: values.get(key) } : undefined,
    });
  }
  globalThis.__teachbuddyLocalStorage = memoryStorage();
  globalThis.__teachbuddySessionStorage = memoryStorage();

  const location = { pathname: '/', search: '', href: '' };
  function readRoute() {
    const path = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '/';
    const url = new URL(path, 'https://teachbuddy.local');
    location.pathname = url.pathname;
    location.search = url.search;
    location.href = url.href;
  }
  readRoute();
  globalThis.__teachbuddyLocation = location;
  globalThis.__teachbuddyNavigate = (path, { replace = false, fromPath } = {}) => {
    if (path === location.pathname + location.search && !replace) return;
    const url = new URL(window.location.href);
    url.hash = path;
    window.history[replace ? 'replaceState' : 'pushState'](
      { fromPath: fromPath ?? location.pathname + location.search }, '', url,
    );
    readRoute();
    window.dispatchEvent(new Event('tb:navigate'));
  };
  window.addEventListener('popstate', readRoute);
  window.addEventListener('hashchange', () => {
    readRoute();
    window.dispatchEvent(new Event('tb:navigate'));
  });

  const context = {
    state: { account: null, session: null, documents: new Map(), jobs: new Map() },
    files: new Map(),
    id: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    json: (body, status = 200, headers = {}) => new Response(
      [204, 205, 304].includes(status) ? null : JSON.stringify(body),
      { status, headers: { 'Content-Type': 'application/json', ...headers } },
    ),
    problem: (type, status = 400, extra = {}) => new Response(
      JSON.stringify({ type, status, ...extra }),
      { status, headers: { 'Content-Type': 'application/problem+json' } },
    ),
  };
  context.extractFile = id => globalThis.TeachBuddyAdapters.files.extractFile(id, context);
  const assets = globalThis.__teachbuddyAssets || {};
  const assetURLs = new Map();
  const nativeFetch = window.fetch.bind(window);

  function resourcePath(value) {
    try {
      const url = new URL(value, base);
      if (url.origin !== base.origin && url.origin !== 'https://teachbuddy.local') return null;
      return url.pathname.startsWith(base.pathname)
        ? '/' + url.pathname.slice(base.pathname.length) : url.pathname;
    } catch { return null; }
  }
  function assetBlob(path) {
    const item = assets[path];
    return new Blob([Uint8Array.from(atob(item.base64), c => c.charCodeAt(0))], { type: item.type });
  }
  function assetURL(path) {
    if (!assetURLs.has(path)) assetURLs.set(path, URL.createObjectURL(assetBlob(path)));
    return assetURLs.get(path);
  }
  const routes = /^\/(?:$|calendar(?:[/?]|$)|math(?:[/?]|$)|classroom(?:[/?]|$)|questions(?:[/?]|$)|resources(?:[/?]|$)|settings(?:[/?]|$)|help(?:[/?]|$)|releases(?:[/?]|$))/;
  function mappedURL(value, navigation = false) {
    if (typeof value !== 'string' || /^(?:data:|blob:|#|javascript:|mailto:)/i.test(value)) return value;
    const path = resourcePath(value);
    if (!path) return value;
    const file = path.match(/^\/api\/workbench\/files\/([^/]+)\/content$/);
    if (file) return context.files.get(decodeURIComponent(file[1]))?.url || value;
    if (assets[path]) return assetURL(path);
    if (/^\/(vendor|assets|resources-pdf|downloads)\//.test(path)) {
      return new URL(path.slice(1), base).href;
    }
    if (navigation && routes.test(path)) {
      const target = new URL(value, base);
      return new URL('index.html', base).href + '#' + path + target.search;
    }
    return value;
  }
  globalThis.__teachbuddyAssetURL = mappedURL;
  globalThis.__TEACHBUDDY_GEOGEBRA_FILES__ = (globalThis.__teachbuddyGeoGebraFiles || [])
    .map(path => path.replace(/^\/vendor\/math\/geogebra\//, ''));

  window.fetch = async (input, init = {}) => {
    const original = input instanceof Request ? input : null;
    const value = original?.url ?? String(input);
    const url = new URL(value, base);
    const path = resourcePath(value);
    if (path?.startsWith('/api/')) {
      const signal = init.signal ?? original?.signal;
      signal?.throwIfAborted();
      const headers = new Headers(init.headers ?? original?.headers);
      const method = String(init.method ?? original?.method ?? 'GET').toUpperCase();
      let body = init.body;
      if (body === undefined && original && !['GET', 'HEAD'].includes(method)) {
        body = headers.get('Content-Type')?.includes('multipart/form-data')
          ? await original.clone().formData() : await original.clone().text();
      }
      if (typeof body === 'string') {
        try { body = JSON.parse(body); }
        catch { return context.problem('/problems/workbench/malformed-json', 400); }
      }
      await new Promise(resolve => setTimeout(resolve, method === 'GET' ? 35 : 120));
      signal?.throwIfAborted();
      const req = { url, path, method, body: body ?? null, headers, signal };
      const adapters = globalThis.TeachBuddyAdapters;
      for (const [name, methodName] of [
        ['auth', 'handleAuth'], ['workbench', 'handleWorkbench'],
        ['schedule', 'handleSchedule'], ['resources', 'handleResources'],
        ['questions', 'handleQuestions'], ['math', 'handleMath'],
        ['agent', 'handleAgent'], ['classroom', 'handleClassroom'], ['files', 'handleFiles'],
      ]) {
        const response = await adapters[name][methodName](req, context);
        if (response !== undefined) return response;
      }
      return context.problem('/problems/workbench/not-found', 404);
    }
    if (path && assets[path]) return new Response(assetBlob(path));
    const target = mappedURL(value);
    return nativeFetch(target === value ? input : target, init);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    return originalOpen.call(this, method, mappedURL(String(url)), ...args);
  };
  const originalAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    return originalAttribute.call(this, name,
      ['src', 'href', 'xlink:href', 'poster'].includes(name.toLowerCase())
        ? mappedURL(String(value), this instanceof HTMLAnchorElement && name === 'href') : value);
  };
  for (const [Type, property] of [
    [HTMLScriptElement, 'src'], [HTMLImageElement, 'src'],
    [HTMLIFrameElement, 'src'], [HTMLLinkElement, 'href'],
    [HTMLAnchorElement, 'href'], [HTMLSourceElement, 'src'],
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(Type.prototype, property);
    if (!descriptor?.set) continue;
    Object.defineProperty(Type.prototype, property, {
      ...descriptor,
      set(value) { descriptor.set.call(this, mappedURL(String(value), Type === HTMLAnchorElement)); },
    });
  }
  const mapCSS = value => typeof value === 'string'
    ? value.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g, (_, quote, url) => `url("${mappedURL(url)}")`) : value;
  const originalStyleProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (name, value, priority) {
    return originalStyleProperty.call(this, name, mapCSS(value), priority);
  };
  for (const property of ['cssText', 'background', 'backgroundImage', 'src', 'maskImage']) {
    const descriptor = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, property);
    if (!descriptor?.set || !descriptor.configurable) continue;
    Object.defineProperty(CSSStyleDeclaration.prototype, property, {
      ...descriptor, set(value) { descriptor.set.call(this, mapCSS(value)); },
    });
  }
  if (globalThis.FontFace) {
    const NativeFontFace = globalThis.FontFace;
    globalThis.FontFace = new Proxy(NativeFontFace, {
      construct: (Target, args) => Reflect.construct(Target, [args[0], mapCSS(args[1]), args[2]]),
    });
  }

  const nativeWindowOpen = window.open.bind(window);
  window.open = (url, ...args) => nativeWindowOpen(mappedURL(String(url ?? ''), true), ...args);
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    const path = link && resourcePath(link.getAttribute('href'));
    if (!path?.startsWith('/api/')) return;
    event.preventDefault();
    void window.fetch(path).then(async response => {
      if (!response.ok) return;
      const url = URL.createObjectURL(await response.blob());
      if (link.hasAttribute('download')) {
        const download = document.createElement('a');
        download.href = url;
        download.download = link.download || 'TeachBuddy';
        download.click();
      } else nativeWindowOpen(url, link.target || '_blank');
    });
  });
})();
