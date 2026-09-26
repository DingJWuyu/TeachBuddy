import {
  workbenchGet,
  workbenchPost,
  workbenchPut,
  workbenchBlob,
} from "../workbench/apiClient.js";
export const base = "/api/modules/questions/v2";
export async function get(path) {
  return (await workbenchGet(path.startsWith("/api/") ? path : base + path))
    .body;
}
export async function write(path, body, key, method = "POST") {
  const id = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const allowed = method === 'PUT'
    ? new RegExp(`^/(?:taxonomy|(?:items|imports)/${id})$`)
    : method === 'POST' ? new RegExp(`^/(?:items|imports|items/${id}/(?:copies|deletion|purge|assets)|imports/${id}/(?:deletion|purge|supplements|commit)|api/workbench/files/(?:crops|${id}/preview)|api/workbench/jobs/${id}/(?:cancel|retry))$`) : null;
  if (!allowed?.test(path) || typeof key !== 'string' || !body || typeof body !== 'object')
    throw Object.assign(new Error('原请求格式暂不支持，已保留设备资料，请核对后处理'), { problem: { kind: 'unconfirmed', message: '原请求格式暂不支持，已保留设备资料，请核对后处理' } });
  try {
    return (
      await (method === "PUT" ? workbenchPut : workbenchPost)(
        path.startsWith("/api/") ? path : base + path,
        body,
        key,
      )
    ).body;
  } catch (error) {
    const messages = {
      "/problems/materials/draft-not-ready":
        "请先修正题面、公式、配图和定位疑点，再确认收录。",
      "/problems/materials/import-not-editable":
        "请等待整理结束或停止后保存校对。",
      "/problems/materials/invalid-taxonomy":
        "分类名称重复或关联失效，请重新核对。",
      "/problems/materials/invalid-location":
        "来源位置无效，请重新选择原稿范围。",
      "/problems/materials/job-not-retryable": "没有可重试的未完成单元。",
      "/problems/materials/archive-required": "请先归档，再彻底删除。",
      "/problems/materials/processing-in-progress": "内容仍在处理中，请等待结束或停止处理后再彻底删除。",
    };
    if (messages[error.problem?.type] && error.problem.httpStatus < 500)
      error.problem = {
        ...error.problem,
        kind: "invalid",
        message: messages[error.problem.type],
      };
    throw error;
  }
}
export async function download(id, name) {
  if (!name) name = (await get(`/api/workbench/files/${id}`)).name;
  const blob = await workbenchBlob(`/api/workbench/files/${id}/content`);
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function upload(transport, file, key) {
  const body = new FormData();
  body.append("file", file);
  const response = await transport("/api/workbench/files", {
    method: "POST",
    headers: { "X-TeachBuddy-Request": "1", "Idempotency-Key": key },
    body,
    credentials: "same-origin",
  });
  const value = await response.json();
  if (!response.ok) throw Object.assign(Error(value.detail ?? "原稿保存失败，请重试"), { status: response.status });
  return value.file ?? value;
}
export const empty = () => ({ version: 2, blocks: [] });
export function sourceText(document) {
  const out = [];
  function visit(blocks) {
    for (const b of blocks) {
      if (b.latex) out.push(b.latex);
      if (b.runs)
        out.push(b.runs.map((r) => r.text ?? `$${r.latex}$`).join(""));
      for (const i of b.items ?? []) {
        out.push(i.label);
        visit(i.blocks);
      }
      for (const row of b.rows ?? [])
        for (const cell of row) visit(cell.blocks);
    }
  }
  visit(document?.blocks ?? []);
  return out.join("\n");
}

export function documentAssets(document) {
  const figures = [],
    formulas = [];
  function visit(blocks) {
    for (const block of blocks) {
      if (block.type === "image") figures.push(block);
      if (block.latex) formulas.push(block.latex);
      for (const run of block.runs ?? [])
        if (run.latex) formulas.push(run.latex);
      for (const item of block.items ?? []) visit(item.blocks);
      for (const row of block.rows ?? [])
        for (const cell of row) visit(cell.blocks);
    }
  }
  visit(document?.blocks ?? []);
  return { figures, formulas };
}
