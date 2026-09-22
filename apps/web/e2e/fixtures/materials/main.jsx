import { PreviewFixture } from './PreviewFixture.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentEditor, DocumentView } from '../../../src/features/workbench/materials/index.js';
import './style.css';
import { bindWorkbenchTransport } from '../../../src/features/workbench/apiClient.js';
// Explicit test-principal fixture; the product binds A11's page transport.
bindWorkbenchTransport(window.fetch.bind(window));
function Page() {
  const [value, setValue] = useState(null),
    [message, setMessage] = useState(''),
    [saving, setSaving] = useState(false);
  const currentValue = useRef(value);
  currentValue.current = value;
  const pending = useRef(null),
    picker = useRef(null);
  useEffect(() => {
    fetch('/fixture/document')
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setValue)
      .catch(() => setMessage('文稿读取失败，请重试。'));
  }, []);
  async function confirmPending() {
    const request = pending.current;
    const response = await fetch('/fixture/document', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-TeachBuddy-Request': '1',
        'Idempotency-Key': request.key
      },
      body: JSON.stringify(request.value)
    });
    if (!response.ok) {
      const error = await response.json();
      if (response.status < 500) pending.current = null;
      throw Error(error.field ? `请检查 ${error.field}` : '保存结果未确认，请重试。');
    }
    const saved = await response.json();
    if (JSON.stringify(saved) !== JSON.stringify(request.value)) {
      throw Error('保存结果未确认，请重试。');
    }
    pending.current = null;
    return saved;
  }
  async function save() {
    setSaving(true);
    const intended = value;
    pending.current ??= { key: crypto.randomUUID(), value: intended };
    try {
      let saved = await confirmPending();
      // Confirm the previous unknown result before saving the current click's
      // draft under a new key. Edits made while awaiting remain visibly unsaved.
      if (JSON.stringify(saved) !== JSON.stringify(intended)) {
        pending.current = { key: crypto.randomUUID(), value: intended };
        saved = await confirmPending();
      }
      setMessage(
        JSON.stringify(currentValue.current) === JSON.stringify(saved) ? '已保存' : '尚未保存'
      );
    } catch (error) {
      setMessage(error.message || '保存结果未确认，请重试。');
    } finally {
      setSaving(false);
    }
  }
  async function pickImage() {
    const file = await new Promise((resolve) => {
      const input = picker.current;
      input.value = '';
      input.onchange = () => resolve(input.files[0] ?? null);
      input.oncancel = () => resolve(null);
      input.click();
    });
    if (!file) return null;
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/api/workbench/files', {
      method: 'POST',
      headers: { 'X-TeachBuddy-Request': '1', 'Idempotency-Key': crypto.randomUUID() },
      body
    });
    if (!response.ok) throw Error();
    return response.json();
  }
  return (
    <main>
      <header>
        <h1>文稿</h1>
        <button disabled={!value || saving || ![1, 2].includes(value.version)} onClick={save}>
          {saving ? '保存中' : '保存'}
        </button>
        <span role="status">{message}</span>
      </header>
      <input hidden ref={picker} type="file" accept="image/png,image/jpeg,image/webp" />
      <div className="columns">
        <section aria-label="编辑文稿">
          {value && (
            <DocumentEditor
              value={value}
              onChange={(next) => {
                setValue(next);
                setMessage('尚未保存');
              }}
              onPickImage={pickImage}
            />
          )}
        </section>
        <section aria-label="文稿预览">{value && <DocumentView value={value} />}</section>
      </div>
    </main>
  );
}
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('preview') ? <PreviewFixture/> : <Page />);
