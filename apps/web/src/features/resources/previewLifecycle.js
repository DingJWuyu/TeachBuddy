const active = new Set(["queued", "running", "cancelling"]);
const failed = new Set(["failed", "cancelled", "interrupted"]);

export const previewJobActive = job => active.has(job?.state);
export const previewJobFailed = job => failed.has(job?.state);
export const previewNeedsPolling = (preview, job) =>
  previewJobActive(job) || (preview?.state === "pending" && !job);

// A completed job may commit its rendition between the preview and job reads.
// Keep this same snapshot rule in both the open preview and library thumbnails.
export async function readPreviewSnapshot(client, fileId) {
  let preview = await client.request(`/api/workbench/files/${fileId}/preview`);
  const job = preview.jobId ? await client.request(`/api/workbench/jobs/${preview.jobId}`) : null;
  if (["succeeded", "partial"].includes(job?.state))
    preview = await client.request(`/api/workbench/files/${fileId}/preview`);
  return { preview, job };
}
