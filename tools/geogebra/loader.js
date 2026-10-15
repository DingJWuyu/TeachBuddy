/* TeachBuddy adapter for the source-built GeoGebra canvas API. */
(() => {
  const base = new URL('.', document.currentScript.src);
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('canvas.css', base).href;
  document.head.append(stylesheet);
  let ready;
  function loadRuntime() {
    if (typeof window.renderGGBElement === 'function') return Promise.resolve();
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      window.renderGGBElementReady = resolve;
      const script = document.createElement('script');
      script.src = new URL('web3d/web3d.nocache.js', base).href;
      script.onerror = () => { script.remove(); ready = undefined; reject(new Error('本地数学引擎加载失败。')); };
      document.head.append(script);
    });
    return ready;
  }
  window.GGBApplet = class {
    constructor(parameters) { this.parameters = parameters; }
    inject(target) {
      const container = typeof target === 'string' ? document.getElementById(target) : target;
      const article = document.createElement('div');
      article.className = 'appletParameters';
      container.replaceChildren(article);
      return loadRuntime().then(() => {
        const { appletOnLoad, appName, ...parameters } = this.parameters;
        window.renderGGBElement({ ...parameters, appName: 'classic', perspective: appName === '3d' ? 'T' : 'G',
          showToolBar: false, showAlgebraInput: false, showMenuBar: false, showResetIcon: false,
          showZoomButtons: false, showFullscreenButton: false, showSuggestionButtons: false,
          allowStyleBar: false, enableLabelDrags: false, enableRightClick: false,
          element: article }, api => appletOnLoad?.(api));
      });
    }
  };
})();
