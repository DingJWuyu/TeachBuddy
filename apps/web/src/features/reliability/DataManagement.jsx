import { SettingsConfirm, SettingsDisclosure } from "./SettingsControls.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  workbenchGet,
  workbenchPost,
  workbenchBlob,
} from "../workbench/apiClient.js";
import { useIdempotentSubmit } from "../workbench/useIdempotentSubmit.js";
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
const date = (value) => new Date(value).toLocaleString("zh-CN");
export function DataManagement({ accountActions, dangerActions }) {
  const [exports, setExports] = useState([]),
    [deleted, setDeleted] = useState([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [filter, setFilter] = useState("all");
  const { accountKey } = useWorkbenchShell();
  const [exportOpen, setExportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const action = useIdempotentSubmit({
    accountKey,
    name: "pending:manual-data",
  });
  const mounted = useRef(true);
  async function run({ key, payload }) {
    const allowed =
      /^\/api\/modules\/(questions\/v2\/(items|imports)|lessons\/v3|resources\/items|math\/v1\/works|classes\/(items|v2\/records)|schedule\/entries)\/[0-9a-f-]{36}\/deletion$/.test(
        payload.path,
      ) || payload.path === `${base}/exports`;
    if (!allowed) throw new Error("无法识别待确认请求，原始内容仍保留。");
    const current = (await workbenchGet(`${base}/context`)).body;
    if (current.recoveryId !== payload.recoveryId)
      throw Object.assign(new Error("恢复点已变化"), {
        problem: {
          kind: "unconfirmed",
          message: "工作台已从备份恢复，请核对这份请求。旧请求不会重新执行。",
        },
      });
    return workbenchPost(payload.path, payload.body, key);
  }
  async function submit(path, body) {
    const context = (await workbenchGet(`${base}/context`)).body;
    return action.submit(run, { path, body, recoveryId: context.recoveryId });
  }
  const refresh = useCallback(async () => {
    const [a, b] = await Promise.all([
      workbenchGet(`${base}/exports`),
      workbenchGet(`${base}/deleted`),
    ]);
    if (mounted.current) {
      setExports(a.body.items);
      setDeleted(b.body.items);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh().catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!exports.some((e) => ["queued", "running"].includes(e.state))) return;
    const timer = setTimeout(
      () => refresh().catch((e) => setError(e.message)),
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
      setError(e.message || "下载未完成，请重试。");
    } finally {
      setBusy("");
    }
  }
  async function restore(item) {
    setBusy(item.id);
    setError("");
    setMessage("");
    try {
      if (
        await submit(item.deletionPath, {
          [item.versionField]: item.version,
          deleted: false,
        })
      ) {
        await refresh();
        setMessage(`已恢复“${item.title}”`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function retry() {
    setBusy("retry");
    try {
      if (await action.retry(run)) {
        await refresh();
        setMessage("操作结果已确认");
      }
    } finally {
      setBusy("");
    }
  }
  return <>
    <div className="settings-sheet settings-account-sheet"><h2 className="settings-account-title">账户</h2>
    <section className="settings-row reliability-export-row" aria-labelledby="personal-data-title">
      <div className="settings-row-copy"><h2 id="personal-data-title">您的数据</h2><p>以 ZIP 文件下载你的 TeachBuddy 个人资料</p></div>
      <button className="wb-button" disabled={!!busy || !!action.pending} onClick={() => { setExportOpen(true); createExport(); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/></svg>导出数据</button>
    </section>
    {accountActions}</div>
    {dangerActions}
    <SettingsConfirm show={exportOpen} title="导出个人资料" onClose={() => setExportOpen(false)}>
      <p>资料包包含已保存资料、最近删除、原文件与对话。下载后解压，打开 index.html 阅读。</p>
      <p className="wb-note">文件可重新上传，正文与公式可复制；资料包不能覆盖账户或恢复原关联。</p>
      <button className="wb-button settings-primary" disabled={!!busy || !!action.pending} onClick={createExport}>{busy === 'export' ? '正在受理…' : '生成资料包'}</button>
      {exports.length > 0 && <ul className="reliability-list" aria-label="个人资料导出记录">{exports.map(item => <li key={item.id}>
        <div><span>{date(item.snapshotAt)}</span><small>{states[item.state]}</small>{item.problem && <small>{item.problem.detail}</small>}</div>
        {item.state === 'ready' && <button className="wb-button" disabled={!!busy} onClick={() => download(item)}>下载资料包</button>}
      </li>)}</ul>}
      {(error || action.problem) && <p role="alert">{error || action.problem.message}</p>}
      {action.pending && <div className="reliability-pending"><button className="wb-button" disabled={!!busy} onClick={retry}>重试确认操作</button><SettingsDisclosure title="查看待确认请求"><pre>{JSON.stringify(action.pending, null, 2)}</pre><button className="wb-button" onClick={() => setResetOpen(true)}>放弃重试</button></SettingsDisclosure></div>}
    </SettingsConfirm>
    <section className="settings-sheet settings-deleted reliability-data" aria-labelledby="deleted-title">
      <div className="reliability-heading"><h2 id="deleted-title">最近删除</h2><button className="wb-text-button" disabled={!!busy} onClick={() => refresh().catch(e => setError(e.message))}>刷新列表</button></div>
      <div className="reliability-filter"><label>资料类型 <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部</option>{[['question','题目'],['lesson','备课'],['resource','资源'],['math','数学作品'],['class','班级'],['record','教学记录'],['entry','日程'],['import','收录']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label></div>
      <p className="wb-note">恢复教学记录前，请先恢复所属班级。</p>
      {!deleted.filter(d => filter === 'all' || d.kind === filter).length ? <p className="settings-empty">暂无已删除资料</p> : <ul className="reliability-list" aria-label="已删除资料">{deleted.filter(d => filter === 'all' || d.kind === filter).map(item => <li key={`${item.kind}:${item.id}`}><div><strong>{item.title}</strong><small>{item.label} · {date(item.deletedAt)}</small></div><button className="wb-button" disabled={!!busy || !!action.pending} onClick={() => restore(item)}>恢复</button></li>)}</ul>}
      {message && <p role="status">{message}</p>}
      {!exportOpen && (error || action.problem) && <p role="alert">{error || action.problem.message}</p>}
      {!exportOpen && action.pending && <div className="reliability-pending"><button className="wb-button" disabled={!!busy} onClick={retry}>重试确认操作</button><SettingsDisclosure title="查看待确认请求"><pre>{JSON.stringify(action.pending, null, 2)}</pre><button className="wb-button" onClick={() => setResetOpen(true)}>放弃重试</button></SettingsDisclosure></div>}
    </section>
    <SettingsConfirm show={resetOpen} title="放弃重试？" confirmLabel="放弃重试" onClose={() => setResetOpen(false)} onConfirm={() => { action.reset(); setResetOpen(false); }}><p>放弃重试不会撤销已完成的操作。请保留请求并核对当前资料后再开始新操作。</p></SettingsConfirm>
  </>;
}
