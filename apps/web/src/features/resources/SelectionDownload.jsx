import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export function SelectionDownload({ client, items, disabled }) {
  const { t } = useTranslation("resources");
  const pending = useRef(null);
  const [state, setState] = useState({ busy: false, error: "" });
  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, [client]);
  async function download() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setState({ busy: true, error: "" });
    try {
      await client.downloadItems(items.map(item => ({ id: item.id, baseVersion: item.version })), controller.signal);
      if (pending.current === controller) setState({ busy: false, error: "" });
    } catch (error) {
      if (pending.current === controller) setState({ busy: false, error: error.name === "AbortError" ? "" : error.message });
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }
  return <>
    <button disabled={disabled || !items.length || state.busy} onClick={download}>
      {state.busy ? t("正在打包原件…") : t("下载所选原件 ZIP")}
    </button>
    {state.busy && <button onClick={() => pending.current?.abort()}>{t("取消下载")}</button>}
    {state.error && <span className="res-download-error" role="alert">{state.error}</span>}
  </>;
}
