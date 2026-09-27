import { useEffect, useRef, useState } from "react";
import { useScene } from "../workbench/useScene.js";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { useIdempotentSubmit } from "../workbench/useIdempotentSubmit.js";
import { workbenchGet } from "../workbench/apiClient.js";
import { ControlledImage, DocumentView } from "../workbench/materials/DocumentView.jsx";
import { ModuleDisclosure } from "../workbench/ModuleMotion.jsx";
import { MaterialsPicker } from "./MaterialsPicker.jsx";
import { LessonDocumentEditor } from "./LessonDocumentEditor.jsx";
import { LessonDialog } from "./LessonPlacementDialog.jsx";
import { ModulePresence } from "../workbench/ModuleMotion.jsx";
import { ConfirmDialog } from "../workbench/ModuleOverlays.jsx";
import { adoptLessonPage, cancelPageRecognition, readRecognizedPage, readRecognitionStatus, requestPageRecognition } from "./api.js";

// Only the corrected whole-page manuscript is editable. Provenance is read
// again by the server; client state is never an authoritative source snapshot.
export function LessonPageImport({ lesson, onClose, onAdopted, onRefresh }) {
  const { accountKey } = useWorkbenchShell();
  const [scene, patchScene] = useScene(accountKey, `lesson-page-import:${lesson.id}`, {
    source: null, result: null, content: null, title: "", jobId: null, adopted: false,
  });
  const latest = useRef(scene);
  latest.current = scene;
  const recognition = useIdempotentSubmit({ accountKey, name: `pending:lesson-recognition:${lesson.id}` });
  const adoption = useIdempotentSubmit({ accountKey, name: `pending:lesson-page-adoption:${lesson.id}` });
  const cancellation = useIdempotentSubmit({ accountKey, name: `pending:lesson-recognition-cancel:${lesson.id}` });
  const [error, setError] = useState(""), [state, setState] = useState("loading"), [revision, setRevision] = useState(0);
  const [returning, setReturning] = useState(false);
  const [reselect, setReselect] = useState(false);
  const [available, setAvailable] = useState(null);
  const source = scene.source;
  const locked = adoption.isRunning || Boolean(adoption.pending) || scene.adopted || cancellation.isRunning || Boolean(cancellation.pending);
  const sourceKey = source && `${source.fileId}:${source.renditionFileId}:${source.page}`;

  useEffect(() => {
    if (!source || scene.result || scene.adopted) return;
    let live = true, timer;
    setState("loading"); setError(""); setAvailable(null);
    readRecognitionStatus(source).then(status => {
      if (!live) return;
      setAvailable(status.available);
      // Follow the current page task even if another consumer started it after
      // this scene cached an older job. Unconfirmed writes have their own keys.
      if (status.jobId && status.jobId !== scene.jobId && ['queued', 'running', 'cancelling'].includes(status.pages.find(p => p.page === source.page)?.state))
        patchScene({ jobId: status.jobId });
    }).catch(e => { if (live) { setError(e.message); setAvailable(false); } });
    async function load() {
      try {
        const result = await readRecognizedPage(source);
        if (!live) return;
        setState(result.state);
        if (result.state === "ready") {
          if (result.document?.version !== 2 || !Array.isArray(result.document.blocks) || !result.resultId)
            throw new Error("识别内容暂时无法编辑，请重新读取。");
          if (!latest.current.result) patchScene({
            result: { resultId: result.resultId, issues: result.issues ?? [] },
            content: result.document,
          });
          return;
        }
        if (["failed", "interrupted"].includes(result.state))
          setError(result.issues?.[0]?.detail || "识别未完成，原资料和课稿仍保留。可以重新识别这一页。");
        if (scene.jobId) {
          const job = (await workbenchGet(`/api/workbench/jobs/${scene.jobId}`)).body;
          if (!live) return;
          if (["queued", "running", "cancelling"].includes(job.state)) {
            setState(job.state); setError("");
            timer = setTimeout(load, 2000);
          } else if (["failed", "interrupted", "cancelled"].includes(job.state)) {
            setState(job.state);
            setError(job.state === "cancelled" ? "" : job.issues?.[0]?.detail || result.issues?.[0]?.detail || "识别未完成，原资料和课稿仍保留。可以重新识别这一页。");
          } else if (result.state === "running") timer = setTimeout(load, 500);
        } else if (result.state === "running") timer = setTimeout(load, 2000);
      } catch (e) { if (live) { setState("failed"); setError(e.message); } }
    }
    load();
    return () => { live = false; clearTimeout(timer); };
  }, [sourceKey, scene.jobId, scene.result, scene.adopted, revision, patchScene]);

  async function recognize() {
    setError("");
    const job = recognition.pending
      ? await recognition.retry(requestPageRecognition)
      : await recognition.submit(requestPageRecognition, { fileId: source.fileId, renditionFileId: source.renditionFileId, page: source.page });
    if (job) { cancellation.reset(); patchScene({ jobId: job.id }); setRevision(n => n + 1); }
  }
  async function stop() {
    const job = cancellation.pending ? await cancellation.retry(cancelPageRecognition)
      : await cancellation.submit(cancelPageRecognition, { jobId: scene.jobId });
    if (job) { setState(job.state); setRevision(n => n + 1); }
  }
  const send = ({ key, payload }) => adoptLessonPage({ key, id: lesson.id, payload });
  async function finish(result) {
    if (!result) return;
    patchScene({ adopted: true });
    await returnToLesson();
  }
  async function returnToLesson() {
    setReturning(true);
    try {
      if (await onAdopted()) patchScene({ source: null, result: null, content: null, title: "", jobId: null, adopted: false });
      else setError("环节已保存，课稿尚未重新读取。请重试返回。");
    } finally { setReturning(false); }
  }
  async function adopt() {
    if (locked || !scene.result || !scene.title.trim() || !scene.content?.blocks.length) return;
    setError("");
    await finish(await adoption.submit(send, {
      baseVersion: lesson.version, resourceId: source.resourceId, resourceVersion: source.resourceVersion,
      fileId: source.fileId, renditionFileId: source.renditionFileId, page: source.page,
      resultId: scene.result.resultId, title: scene.title.trim(), content: scene.content,
    }));
  }
  function selectPage(resource, page) {
    recognition.reset(); adoption.reset(); cancellation.reset(); setError("");
    patchScene({ source: { ...page, resourceId: resource.id, resourceVersion: resource.version,
      resourceTitle: resource.snapshot.title }, result: null, content: null, title: `${resource.snapshot.title} · 第 ${page.page} 页`.slice(0, 200),
      jobId: null, adopted: false });
  }
  function clearPage() {
    setReselect(false);
    recognition.reset(); adoption.reset(); cancellation.reset();
    patchScene({ source: null, result: null, content: null, jobId: null });
  }
  if (!source) return <MaterialsPicker kind="resource" lessonTitle={lesson.title} targetLabel="新教学环节"
    onPickPage={selectPage} onCancel={onClose} />;

  const reading = ["loading", "queued", "running", "cancelling"].includes(state) || recognition.isRunning;
  return <div className="wb-module wb-page lesson-picker lesson-page-import">
    <header className="wb-picker-head">
      <div className="lesson-picker-title"><div><h1>校对资料正文</h1>
        <p>{source.resourceTitle} · 第 {source.page} 页，确认后保存为一个教学环节。</p></div></div>
      <button className="wb-button" disabled={locked || recognition.isRunning || Boolean(recognition.pending)} onClick={onClose}>返回课稿</button>
      {scene.adopted ? <button className="wb-button is-primary" disabled={returning} onClick={returnToLesson}>已加入，返回课稿</button>
        : adoption.pending ? <button className="wb-button is-primary" disabled={adoption.isRunning}
          onClick={async () => finish(await adoption.retry(send))}>确认加入结果</button>
        : <button className="wb-button is-primary" disabled={locked || !scene.result || !scene.title.trim() || !scene.content?.blocks.length} onClick={adopt}>加入为教学环节</button>}
    </header>
    {(error || recognition.problem || adoption.problem || cancellation.problem) && <p role="alert" className="wb-inline-error">
      {error || adoption.problem?.message || cancellation.problem?.message || recognition.problem?.message}
      {!locked && adoption.problem?.kind === "conflict" && " 校对稿已保留。返回课稿核对最新版本；资料版本变化时需重新选页。"}
      {!locked && adoption.problem?.kind === "conflict" && !adoption.problem.sourceKind && <button
        className="wb-button" onClick={onRefresh}>读取最新课稿，保留校对</button>}
    </p>}
    <div className="lesson-page-import-body">
      <ModuleDisclosure title={`原资料 · 第 ${source.page} 页`} open={scene.originalOpen ?? true}
        onOpenChange={originalOpen => patchScene({ originalOpen })}>
        <ControlledImage fileId={source.imageFileId} alt={`原资料第 ${source.page} 页`} widthMm={170} />
      </ModuleDisclosure>
      <section className="lesson-page-review" aria-label="识别正文校对">
        {scene.result ? <>
          <label>环节名称<input className="wb-input" aria-label="提取后的环节名称" maxLength={200} value={scene.title}
            disabled={locked} onChange={e => patchScene({ title: e.target.value })} /></label>
          <p className="wb-muted">对照原页检查文字、公式和配图。校对后的内容可以继续编辑，原资料保持不变。</p>
          {scene.result.issues.length > 0 && <ModuleDisclosure title="这一页有识别疑点，请对照原页核对" defaultOpen>
            <ul>{scene.result.issues.map((issue, index) => <li key={index}>{issue.detail || "请检查原页与识别正文是否一致。"}</li>)}</ul>
          </ModuleDisclosure>}
          <LessonDocumentEditor label="识别正文" value={scene.content} readOnly={locked}
            onChange={content => patchScene({ content })} />
        </> : <>
          <p role="status">{state === 'cancelled' ? "识别已停止，原资料和课稿仍保留。" : state === 'cancelling' ? "正在停止识别，原资料和课稿仍保留。" : reading ? "正在读取或识别这一页…" : "将本页文字、公式和配图提取为可编辑内容，确认前可以对照原页修改。"}</p>
          {available === false && <p>当前实例暂时无法识别新页面，原资料和课稿仍保留。稍后可以重新读取。</p>}
          <button className="wb-button is-primary" disabled={recognition.isRunning || locked || (!recognition.pending && (reading || available !== true))} onClick={recognize}>
            {recognition.pending ? "确认识别请求" : scene.jobId ? "重新识别这一页" : "识别这一页"}
          </button>
          {(error || available === false) && <button className="wb-button" onClick={() => setRevision(n => n + 1)}>重新读取</button>}
        </>}
        {scene.result && recognition.pending && <button className="wb-button" disabled={recognition.isRunning || locked}
          onClick={recognize}>确认识别请求</button>}
        {(cancellation.pending || (scene.jobId && ['queued', 'running', 'cancelling'].includes(state))) && <button
          className="wb-button" disabled={cancellation.isRunning || (!cancellation.pending && state === 'cancelling')}
          onClick={stop}>{cancellation.pending ? '确认停止结果' : state === 'cancelling' ? '正在停止识别' : '停止识别'}</button>}
        {!locked && !recognition.pending && !recognition.isRunning && <button className="wb-text-button"
          onClick={() => scene.content ? setReselect(true) : clearPage()}>重新选择资料页</button>}
      </section>
    </div>
    <ModulePresence present={reselect}>{reselect && <ConfirmDialog title="重新选择资料页"
      message="这一页尚未加入课稿的校对内容将被丢弃，课稿和原资料保持不变。"
      confirmLabel="重新选页" onCancel={() => setReselect(false)} onConfirm={clearPage} />}</ModulePresence>
  </div>;
}

export function LessonPageSource({ source, onClose }) {
  return (
    <LessonDialog wide title="导入时的资料" onClose={onClose}>
      <p>{source.resourceTitle} · {source.fileName} · 第 {source.page} 页</p>
      <p className="wb-muted">这里保留导入时的内容。后来对课稿的修改不会改变这份记录。</p>
      <ModuleDisclosure title="查看原页"><ControlledImage fileId={source.imageFileId}
        alt={`导入原稿第 ${source.page} 页`} widthMm={170} /></ModuleDisclosure>
      <h3>采用时的正文</h3><DocumentView value={source.adoptedDocument} />
      <ModuleDisclosure title="机器识别原文"><DocumentView value={source.machineDocument} /></ModuleDisclosure>
    </LessonDialog>
  );
}
