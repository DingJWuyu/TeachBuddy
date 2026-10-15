import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, AuthGate, useAuth } from '../../../src/features/auth/index.jsx';
import { bindWorkbenchTransport, workbenchBlob } from '../../../src/platform/http/apiClient.js';
import { moduleCatalog } from '@teachbuddy/shared';
import { resolveWorkbenchModules } from '../../../src/features/modules/moduleRegistry.js';
import { DocumentView } from '../../../src/components/materials/index.js';

const modules = resolveWorkbenchModules(moduleCatalog);

function Files() {
  const { request, logout } = useAuth();
  const [ready, setReady] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const unbind = bindWorkbenchTransport(request);
    setReady(true);
    return unbind;
  }, [request]);
  async function upload(event) {
    const body = new FormData();
    body.append('file', event.target.files[0]);
    const response = await request('/api/workbench/files', {
      method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body
    });
    if (!response.ok) return setError(`上传失败 ${response.status}`);
    const saved = await response.json();
    history.replaceState(null, '', `?file=${saved.id}`);
    setFile(saved.id);
  }
  const id = file || new URLSearchParams(location.search).get('file');
  async function download() {
    const blob = await workbenchBlob(`/api/workbench/files/${id}/content`);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'poster.png'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return ready && <main style={{ maxWidth: 720, margin: '48px auto', padding: 24, fontFamily: 'sans-serif' }}>
    <h1>公共文件身份验证</h1>
    <p aria-label="隔离模块映射">{modules.map(module => module.name).join("、")}</p>
    <label>上传图片 <input aria-label="上传图片" type="file" accept="image/png" onChange={upload} /></label>
    {error && <p role="alert">{error}</p>}
    {id && <><DocumentView value={{ version: 2, blocks: [{ type: 'image', fileId: id, alt: '本地公式海报', widthMm: 90 }] }} />
      <button onClick={download}>下载原件</button></>}
    <button onClick={() => logout()}>退出登录</button>
  </main>;
}
createRoot(document.getElementById('root')).render(<AuthProvider><AuthGate><Files /></AuthGate></AuthProvider>);
