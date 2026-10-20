import i18n from "../../i18n/index.js";
import { useTranslation } from 'react-i18next';
import { SettingsConfirm, SettingsDisclosure, ExportItem } from "../workbench/SettingsControls.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  workbenchGet,
  workbenchPost,
  workbenchBlob,
} from "../../platform/http/apiClient.js";
import { useIdempotentSubmit } from "../../platform/saving/useIdempotentSubmit.js";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import "./reliability.css";
const base = "/api/reliability/v1";
const states = {
  queued: "等待生成",
  running: "正在生成",
  ready: "可下载",
  failed: "生成失败",
  interrupted: "已中断",
};
const date = (value) => new Date(value).toLocaleString(i18n.resolvedLanguage);
export function DataManagement({ accountActions, dangerActions }) {
  const { t } = useTranslation("reliability");
  const [exports, setExports] = useState([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState("");
  const { accountKey } = useWorkbenchShell();
  async function remove(item) {
    setBusy(item.id);
    setError('');
    try {
      if (await submit(`${base}/exports/${item.id}/deletion`, {})) await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }
  const [exportOpen, setExportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const action = useIdempotentSubmit({
    accountKey,
    name: "pending:manual-data",
  });
  const mounted = useRef(true);
  async function run({ key, payload }) {
    const allowed =
      /^\/api\/modules\/(questions\/v2\/(items|imports)|resources\/items|math\/v1\/works|schedule\/entries)\/[0-9a-f-]{36}\/deletion$/.test(
        payload.path,
      ) || payload.path === `${base}/exports` || /^\/api\/reliability\/v1\/exports\/[0-9a-f-]{36}\/deletion$/.test(payload.path);
    if (!allowed) throw new Error(t("无法识别待确认请求，原始内容仍保留。"));
    const current = (await workbenchGet(`${base}/context`)).body;
    if (current.recoveryId !== payload.recoveryId)
      throw Object.assign(new Error(t("恢复点已变化")), {
        problem: {
          kind: "unconfirmed",
          message: t("工作台已从备份恢复，请核对这份请求。旧请求不会重新执行。"),
        },
      });
    return workbenchPost(payload.path, payload.body, key);
  }
  async function submit(path, body) {
    const context = (await workbenchGet(`${base}/context`)).body;
    return action.submit(run, { path, body, recoveryId: context.recoveryId });
  }
  const refresh = useCallback(async () => {
    const a = await workbenchGet(`${base}/exports`);
    if (mounted.current) {
      setExports(a.body.items);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh().catch((e) => setError({ message: e.message, authLocked: e.problem?.cause === 'auth-locked' }));
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!exports.some((e) => ["queued", "running"].includes(e.state))) return;
    const timer = setTimeout(
      () => refresh().catch((e) => setError({ message: e.message, authLocked: e.problem?.cause === 'auth-locked' })),
      1000,
    );
    return () => clearTimeout(timer);
  }, [exports, refresh]);
  async function createExport() {
    setBusy("export");
    setError("");
    setMessage("");
    try {
      if (await submit(`${base}/exports`, {})) await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function download(item) {
    setBusy(item.id);
    setError("");
    try {
      const blob = await workbenchBlob(item.downloadPath, {
          timeoutMs: 300000,
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `TeachBuddy-个人资料-${item.createdAt.slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message || t("下载未完成，请重试。"));
    } finally {
      setBusy("");
    }
  }
  async function retry() {
    const isExport = action.pending?.payload.path === `${base}/exports`;
    setBusy("retry");
    try {
      if (await action.retry(run)) {
        await refresh();
        if (isExport) setExportOpen(true);
        setMessage(t("操作结果已确认"));
      }
    } finally {
      setBusy("");
    }
  }
  // The account action already explains this local transport lock. Preserve
  // genuine export/read errors and pending requests instead of masking them.
  const visibleError = typeof error === 'object' ? (error.authLocked ? '' : error.message) : error;
  return <>
    <div className="settings-sheet settings-account-sheet"><h2 className="settings-account-title">{t("账户")}</h2>
    <section className="settings-row reliability-export-row" aria-labelledby="personal-data-title">
      <div className="settings-row-copy"><h2 id="personal-data-title">{t("您的数据")}</h2><p>{t("以 ZIP 文件下载你的 TeachBuddy 个人资料")}</p></div>
      <button className="wb-button" disabled={!!busy || !!action.pending} onClick={() => { setExportOpen(true); createExport(); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/></svg>{t("导出数据")}</button>
    </section>
    {accountActions}
    {message && <p role="status">{message}</p>}
    {!exportOpen && (visibleError || action.problem) && <p role="alert">{visibleError || action.problem.message}</p>}
    {!exportOpen && action.pending && <div className="reliability-pending"><button className="wb-button" disabled={!!busy} onClick={retry}>{t("重试确认操作")}</button><SettingsDisclosure title={t("查看待确认请求")}><pre>{JSON.stringify(action.pending, null, 2)}</pre><button className="wb-button" onClick={() => setResetOpen(true)}>{t("放弃重试")}</button></SettingsDisclosure></div>}
    </div>
    {dangerActions}
    <SettingsConfirm show={exportOpen} title={t("导出个人资料")} onClose={() => setExportOpen(false)}>
      <p>{t("资料包包含已保存及已删除的资料、原文件与对话。下载后解压，打开 index.html 阅读。")}</p>
      <p className="wb-note">{t("文件可重新上传，正文与公式可复制；资料包不能覆盖账户或恢复原关联。")}</p>
      {busy === 'export' && <p role="status">{t("正在生成资料包…")}</p>}
      {visibleError && !action.pending && <button className="wb-button" disabled={!!busy} onClick={createExport}>{t("重试生成")}</button>}
      {exports.length > 0 && <ul className="reliability-list" aria-label={t("个人资料导出记录")}>{exports.map(item => <ExportItem key={item.id} item={item} date={date(item.snapshotAt)} state={t(states[item.state])} busy={!!busy || !!action.pending} working={busy === item.id} onDownload={() => download(item)} onDelete={() => remove(item)} />)}</ul>}
      {(visibleError || action.problem) && <p role="alert">{visibleError || action.problem.message}</p>}
      {action.pending && <div className="reliability-pending"><button className="wb-button" disabled={!!busy} onClick={retry}>{t("重试确认操作")}</button><SettingsDisclosure title={t("查看待确认请求")}><pre>{JSON.stringify(action.pending, null, 2)}</pre><button className="wb-button" onClick={() => setResetOpen(true)}>{t("放弃重试")}</button></SettingsDisclosure></div>}
    </SettingsConfirm>
    <SettingsConfirm show={resetOpen} title={t("放弃重试？")} confirmLabel={t("放弃重试")} onClose={() => setResetOpen(false)} onConfirm={() => { action.reset(); setResetOpen(false); }}><p>{t("放弃重试不会撤销已完成的操作。请保留请求并核对当前资料后再开始新操作。")}</p></SettingsConfirm>
  </>;
}
