import { workbenchBlob } from "../workbench/apiClient.js";
export async function openLessonFile(id) {
  const blob = await workbenchBlob(`/api/workbench/files/${id}/content`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
