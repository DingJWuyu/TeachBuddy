import { useContext, useRef, useState } from "react";
import { PUBLIC_AUTH } from "../auth/AuthProvider.jsx";
import { DocumentEditor } from "../workbench/materials/index.js";
export function LessonDocumentEditor(props) {
  const auth = useContext(PUBLIC_AUTH),
    pending = useRef(null),
    picker = useRef(null),
    [upload, setUpload] = useState(null),
    [error, setError] = useState("");
  const pick = () =>
    new Promise((resolve) => {
      pending.current = resolve;
      picker.current.click();
    });
  async function send(input) {
    setError("");
    setUpload(input);
    try {
      const body = new FormData();
      body.append("file", input.file);
      const response = await auth.request("/api/workbench/files", {
        method: "POST",
        headers: { "X-TeachBuddy-Request": "1", "Idempotency-Key": input.key },
        body,
      });
      if (!response.ok) throw new Error("图片尚未确认保存，请重试确认");
      const file = await response.json();
      if (!file.id) throw new Error("图片保存结果无法识别");
      pending.current?.(file);
      pending.current = null;
      setUpload(null);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onCancel={() => {
          pending.current?.(null);
          pending.current = null;
        }}
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) send({ file, key: crypto.randomUUID() });
          else pending.current?.(null);
          e.target.value = "";
        }}
      />
      <DocumentEditor {...props} onPickImage={auth ? pick : undefined} />
      {upload && (
        <div role="status">
          {error || "正在保存图片"}
          {error && (
            <>
              <button className="wb-button" onClick={() => send(upload)}>
                重试确认图片
              </button>
              <button
                className="wb-button"
                onClick={() => {
                  pending.current?.(null);
                  pending.current = null;
                  setUpload(null);
                }}
              >
                取消
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
