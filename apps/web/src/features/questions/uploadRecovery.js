import { deviceRequestStore } from '../workbench/deviceRequestStore.js';
import { readLocal, writeLocal } from '../workbench/storage.js';
import { upload } from './materials-api.js';
const store = (account, action = 'get', value) => deviceRequestStore({
  database: 'teachbuddy.questions.uploads', storeName: 'pending', account,
  name: 'pending:questions-upload', action, value
});
export const pendingQuestionUpload = account => store(account);
export async function uploadQuestionFile(account, transport, file) {
  const bytes = await file.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  const fingerprint = JSON.stringify([file.name, file.size, digest]);
  const previous = await store(account);
  const known = readLocal(account, 'questions-uploaded-files') ?? {};
  if (known[fingerprint] && previous?.fingerprint !== fingerprint) return known[fingerprint];
  if (previous && previous.fingerprint !== fingerprint) throw new Error(`请先重新选择原文件“${previous.file.name}”，确认上次上传结果。`);
  const request = previous ?? { key: crypto.randomUUID(), file, fingerprint };
  await store(account, 'put', request);
  try {
    const result = await upload(transport, request.file, request.key);
    if (!result?.id) throw new Error('上传结果无法确认，请重新选择原文件重试');
    if (!writeLocal(account, 'questions-uploaded-files', { ...known, [fingerprint]: result })) throw new Error('文件已上传，但设备记录无法保留，请检查存储权限后确认原请求');
    await store(account, 'delete');
    return result;
  } catch (error) {
    if (error.status >= 400 && error.status < 500 && error.status !== 401) await store(account, 'delete');
    throw error;
  }
}
