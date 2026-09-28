export const htmlLimit = 1024 * 1024;
const policy =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
const jsonForScript = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
// Runs only in the trusted outer document. The parsed source is inert and is
// never adopted into that document. Only the sandboxed srcdoc executes it.
function startIsolated(source, policy, labels) {
  const doc = new DOMParser().parseFromString(source, "text/html");
  doc
    .querySelectorAll("base,meta[http-equiv]")
    .forEach((node) => node.remove());
  for (const node of doc.querySelectorAll("*"))
    for (const attr of [...node.attributes]) {
      if (
        [
          "href",
          "xlink:href",
          "action",
          "formaction",
          "target",
          "download",
          "ping",
        ].includes(attr.name.toLowerCase())
      )
        node.removeAttribute(attr.name);
    }
  const meta = doc.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = policy;
  doc.head.prepend(meta);
  const monitor = doc.createElement("script");
  monitor.textContent = `for (const type of ['error','unhandledrejection','securitypolicyviolation']) addEventListener(type, () => parent.postMessage({mathPreviewFailure:true}, '*'));`;
  meta.after(monitor);
  const frame = document.createElement("iframe");
  frame.title = labels.frame;
  frame.setAttribute("sandbox", "allow-scripts");
  let loads = 0;
  const notice = document.querySelector("[role=status]");
  window.addEventListener("message", (event) => {
    if (
      event.source === frame.contentWindow &&
      event.data?.mathPreviewFailure === true
    )
      notice.textContent =
        labels.failure;
  });
  frame.onload = () => {
    if (++loads > 1) {
      frame.remove();
      notice.textContent = labels.navigation;
    }
  };
  document.querySelector("button").onclick = () => {
    frame.remove();
    notice.textContent = labels.stopped;
  };
  frame.srcdoc = "<!doctype html>" + doc.documentElement.outerHTML;
  document.body.append(frame);
}
const escapeLabel = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

// The optional display copy is for the running app. Offline exports retain
// these defaults and never rewrite the teacher's HTML source.
export function isolatedHtml(source, external = true, labels = {}) {
  const copy = {
    language: 'zh-CN', title: '数学演示', frame: '隔离作品', stop: '停止预览',
    external: '离线效果待检查。此作品需要外部资源时，当前预览可能不完整；执行异常可停止后编辑源码。',
    selfContained: '自包含演示',
    failure: '作品执行失败或依赖受限，预览可能不完整；可停止后编辑源码。离线效果待检查。',
    navigation: '作品发生导航，预览已停止；源码仍保留。', stopped: '预览已停止',
    ...labels,
  };
  const notice = external
    ? copy.external
    : copy.selfContained;
  return `<!doctype html><html lang="${escapeLabel(copy.language)}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; worker-src 'none'; frame-src 'self'; base-uri 'none'; form-action 'none'"><title>${escapeLabel(copy.title)}</title><style>body{margin:0;font:14px/1.5 sans-serif}header{display:flex;align-items:center;gap:12px;padding:8px;background:#f5f6f8}iframe{display:block;border:0;width:100%;height:calc(100vh - 70px)}button{padding:4px 10px}p{margin:0}</style></head><body><header><button>${escapeLabel(copy.stop)}</button><p role="status">${escapeLabel(notice)}</p></header><script>(${startIsolated.toString()})(${jsonForScript(source)},${jsonForScript(policy)},${jsonForScript(copy)});</script></body></html>`;
}
