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
function startIsolated(source, policy) {
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
  frame.title = "隔离作品";
  frame.setAttribute("sandbox", "allow-scripts");
  let loads = 0;
  const notice = document.querySelector("[role=status]");
  window.addEventListener("message", (event) => {
    if (
      event.source === frame.contentWindow &&
      event.data?.mathPreviewFailure === true
    )
      notice.textContent =
        "作品执行失败或依赖受限，预览可能不完整；可停止后编辑源码。离线效果待检查。";
  });
  frame.onload = () => {
    if (++loads > 1) {
      frame.remove();
      notice.textContent = "作品发生导航，预览已停止；源码仍保留。";
    }
  };
  document.querySelector("button").onclick = () => {
    frame.remove();
    notice.textContent = "预览已停止";
  };
  frame.srcdoc = "<!doctype html>" + doc.documentElement.outerHTML;
  document.body.append(frame);
}
export function isolatedHtml(source, external = true) {
  const notice = external
    ? "离线效果待检查。此作品需要外部资源时，当前预览可能不完整；执行异常可停止后编辑源码。"
    : "自包含演示";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; worker-src 'none'; frame-src 'self'; base-uri 'none'; form-action 'none'"><title>数学演示</title><style>body{margin:0;font:14px/1.5 sans-serif}header{display:flex;align-items:center;gap:12px;padding:8px;background:#f5f6f8}iframe{display:block;border:0;width:100%;height:calc(100vh - 70px)}button{padding:4px 10px}p{margin:0}</style></head><body><header><button>停止预览</button><p role="status">${notice}</p></header><script>(${startIsolated.toString()})(${jsonForScript(source)},${jsonForScript(policy)});</script></body></html>`;
}
