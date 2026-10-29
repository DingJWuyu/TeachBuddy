import { documentText } from "../content/document.js";
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
export function readableContent(value, labels) {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value.blocks))
    return `<pre>${escape(documentText(value))}</pre>`;
  if (Array.isArray(value)) return value.map(item => readableContent(item, labels)).join("");
  return Object.entries(value)
    .map(([key, item]) => {
      if (typeof item === "string" && labels[key] && item)
        return `<h3>${labels[key]}</h3><pre>${escape(item)}</pre>`;
      if (typeof item === "object" && item) {
        const text = readableContent(item, labels);
        return text
          ? `${labels[key] ? `<h2>${labels[key]}</h2>` : ""}${text}`
          : "";
      }
      return "";
    })
    .join("");
}


export function portableObject(kind, value, { id = value.id ?? kind, version = value.version ?? null, label = kind, title = value.title || value.name || value.note || label, relations = [], html = '', state = value.deletedAt ? 'deleted' : 'active' } = {}) {
  return { kind, id, version, value, label, title, relations, html, state };
}
export function reference(kind, id, type, location, adoptedVersion = null, optional = false, label = type) {
  return { kind, id, type, location, adoptedVersion, optional, label };
}
