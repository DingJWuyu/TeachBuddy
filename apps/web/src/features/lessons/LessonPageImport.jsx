import { useEffect, useRef, useState } from "react";
import { useScene } from "../workbench/useScene.js";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { useIdempotentSubmit } from "../workbench/useIdempotentSubmit.js";
import { workbenchGet } from "../workbench/apiClient.js";
import { ControlledImage, DocumentView } from "../workbench/materials/DocumentView.jsx";
import { ModuleDisclosure } from "../workbench/ModuleMotion.jsx";
import { MaterialsPicker } from "./MaterialsPicker.jsx";
import { LessonDocumentEditor } from "./LessonDocumentEditor.jsx";
import { FilePreview } from "./FilePreview.jsx";
import { LessonDialog } from "./LessonPlacementDialog.jsx";
import { ModulePresence } from "../workbench/ModuleMotion.jsx";
import { ConfirmDialog } from "../workbench/ModuleOverlays.jsx";
import { adoptLessonPage, cancelPageRecognition, readRecognizedPage, readRecognitionStatus, requestPageRecognition } from "./api.js";

function displayedImages(result) {
  const found = new Map(), assets = new Set(result?.assetFileIds ?? []);
  function visit(blocks) {
    for (const block of blocks ?? []) {
      if (block.type === "image" && assets.has(block.fileId) && !found.has(block.fileId)) found.set(block.fileId, block);
      visit(block.blocks);
      for (const item of block.items ?? []) visit(item.blocks);
      for (const row of block.rows ?? []) for (const cell of row) visit(cell.blocks);
    }
  }
  visit(result?.document?.blocks);
  return [...found.values()];
}

// Whole-page and selected-image reviews share the same request recovery and
// editor. Their drafts and request keys are separate; adoption rechecks both
// immutable sources on the server.
export function LessonPageImport({ lesson, onClose, onAdopted, onRefresh, imageParent = null }) {
  const { accountKey } = useWorkbenchShell();
  const reviewId = imageParent ? `${lesson.id}:image:${imageParent.result.resultId}:${imageParent.fileId}` : lesson.id;
  const [scene, patchScene] = useScene(accountKey, `lesson-page-import:${reviewId}`, {
    source: null, result: null, content: null, title: "", jobId: null, adopted: false,
  });
  const latest = useRef(scene);
  latest.current = scene;
  const recognition = useIdempotentSubmit({ accountKey, name: `pending:lesson-recognition:${reviewId}` });
  const adoption = useIdempotentSubmit({ accountKey, name: `pending:lesson-page-adoption:${reviewId}` });
  const cancellation = useIdempotentSubmit({ accountKey, name: `pending:lesson-recognition-cancel:${reviewId}` });
  const [error, setError] = useState(""), [state, setState] = useState("loading"), [revision, setRevision] = useState(0);
  const [returning, setReturning] = useState(false);
  const [reselect, setReselect] = useState(false);
  const [available, setAvailable] = useState(null);
  const source = scene.source;
  const origin = imageParent?.source ?? source;
  const imageLabel = imageParent && `原资料第 ${origin.page} 页 · 配图 ${imageParent.number}`;
  const locked = adoption.isRunning || Boolean(adoption.pending) || scene.adopted || cancellation.isRunning || Boolean(cancellation.pending);
  const sourceKey = source && `${source.fileId}:${source.renditionFileId}:${source.page}`;

  useEffect(() => {
    if (!source || (scene.result?.document) || scene.adopted) return;
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
          // Enrich older saved review scenes without replacing teacher edits.
          if (!latest.current.result || latest.current.result.resultId === result.resultId) patchScene({
            result: { resultId: result.resultId, issues: result.issues ?? [], document: result.document, assetFileIds: result.assetFileIds ?? [] },
            ...(!latest.current.result ? { content: result.document } : {}),
          });
          else setError("原识别结果已变化。整页校对稿仍保留；如需识别配图，请重新选择资料页。");
          return;
        }
        if (["failed", "interrupted"].includes(result.state))
          setError(result.issues?.[0]?.detail || "识别未完成，原资料和课稿仍保留。可以重新识别这一页。");
        if (scene.jobId) {
          const job = (await workbenchGet(`/api/workbench/jobs/${scene.jobId}`)).body;
          if (!live) return;
          // A fixed page's newer failure outranks a cached job's terminal
          // state; a previous cancellation must not erase the current issues.
          if (["queued", "running", "cancelling"].includes(job.state)) {
            setState(job.state); setError("");
            timer = setTimeout(load, 2000);
          } else if (result.state !== "failed" && ["failed", "interrupted", "cancelled"].includes(job.state)) {
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
      baseVersion: lesson.version, resourceId: origin.resourceId, resourceVersion: origin.resourceVersion,
      fileId: origin.fileId, renditionFileId: origin.renditionFileId, page: origin.page,
      resultId: imageParent?.result.resultId ?? scene.result.resultId, title: scene.title.trim(), content: scene.content,
      ...(imageParent ? { recognizedImage: { fileId: source.fileId, renditionFileId: source.renditionFileId, resultId: scene.result.resultId } } : {}),
    }));
  }
  function selectPage(resource, page) {
    recognition.reset(); adoption.reset(); cancellation.reset(); setError("");
    patchScene({ source: { ...page, resourceId: resource.id, resourceVersion: resource.version,
      resourceTitle: resource.snapshot.title }, result: null, content: null, title: `${resource.snapshot.title} · 第 ${page.page} 页`.slice(0, 200),
      jobId: null, adopted: false, selectedImage: null });
  }
  function clearPage() {
    setReselect(false);
    recognition.reset(); adoption.reset(); cancellation.reset();
    patchScene({ source: null, result: null, content: null, jobId: null, selectedImage: null });
  }
  if (!source && imageParent) return <FilePreview fileId={imageParent.fileId} onClose={onClose}
    title="准备校对配图" imageLabel={imageLabel} selectLabel="校对这张配图"
    onSelectPage={page => patchScene({ source: page, title: `${origin.resourceTitle} · 第 ${origin.page} 页 · 配图 ${imageParent.number}`.slice(0, 200) })} />;
  if (!source) return <MaterialsPicker kind="resource" lessonTitle={lesson.title} targetLabel="新教学环节"
    onPickPage={selectPage} onCancel={onClose} />;
  const images = imageParent ? [] : displayedImages(scene.result);
  const selectedImage = images.find(image => image.fileId === scene.selectedImage);
  if (selectedImage) return <LessonPageImport key={selectedImage.fileId} lesson={lesson} onRefresh={onRefresh}
    imageParent={{ source, result: scene.result, fileId: selectedImage.fileId, number: images.indexOf(selectedImage) + 1 }}
    onClose={() => patchScene({ selectedImage: null })}
    onAdopted={async () => {
      const done = await onAdopted();
      if (done) patchScene({ selectedImage: null });
      return done;
    }} />;

  const reading = ["loading", "queued", "running", "cancelling"].includes(state) || recognition.isRunning;
  return <div className="wb-module wb-page lesson-picker lesson-page-import">
    <header className="wb-picker-head">
      <div className="lesson-picker-title"><div><h1>{imageParent ? "校对配图内容" : "校对资料正文"}</h1>
        <p>{origin.resourceTitle} · 第 {origin.page} 页{imageParent ? ` · 配图 ${imageParent.number}` : ""}，确认后保存为一个教学环节。</p></div></div>
      <button className="wb-button" disabled={locked || recognition.isRunning || Boolean(recognition.pending)} onClick={onClose}>{imageParent ? "返回整页校对" : "返回课稿"}</button>
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
      <ModuleDisclosure title={imageLabel || `原资料 · 第 ${source.page} 页`} open={scene.originalOpen ?? true}
        onOpenChange={originalOpen => patchScene({ originalOpen })}>
        <ControlledImage fileId={source.imageFileId} alt={imageLabel || `原资料第 ${source.page} 页`} widthMm={170} />
      </ModuleDisclosure>
      <section className="lesson-page-review" aria-label="识别正文校对">
        {scene.result ? <>
          <label>环节名称<input className="wb-input" aria-label="提取后的环节名称" maxLength={200} value={scene.title}
            disabled={locked} onChange={e => patchScene({ title: e.target.value })} /></label>
          <p className="wb-muted">{imageParent ? "整页校对稿已保留。这里的内容将单独加入课稿，请对照配图核对；空白单元格需由你填写。" : "对照原页检查文字、公式和配图。校对后的内容可以继续编辑，原资料保持不变。"}</p>
          {scene.result.issues.length > 0 && <ModuleDisclosure title="这一页有识别疑点，请对照原页核对" defaultOpen>
            <ul>{scene.result.issues.map((issue, index) => <li key={index}>{issue.detail || "请检查原页与识别正文是否一致。"}</li>)}</ul>
          </ModuleDisclosure>}
          <LessonDocumentEditor label="识别正文" value={scene.content} readOnly={locked}
            onChange={content => patchScene({ content })} />
          {images.length > 0 && <ModuleDisclosure title="识别配图中的文字或表格">
            <p className="wb-muted">选择一张配图单独校对，整页校对稿会保留。确认后另存为一个教学环节。</p>
            <div className="lesson-recognition-images">{images.map((image, index) => <div key={image.fileId}>
              <ControlledImage fileId={image.fileId} alt={`可识别配图 ${index + 1}`} widthMm={80} />
              <button className="wb-button" disabled={locked || recognition.isRunning || Boolean(recognition.pending)}
                onClick={() => patchScene({ selectedImage: image.fileId })}>选择配图 {index + 1}</button>
            </div>)}</div>
          </ModuleDisclosure>}
        </> : <>
          <p role="status">{state === 'cancelled' ? "识别已停止，原资料和课稿仍保留。" : state === 'cancelling' ? "正在停止识别，原资料和课稿仍保留。" : reading ? "正在读取或识别这一页…" : "将本页文字、公式和配图提取为可编辑内容，确认前可以对照原页修改。"}</p>
          {available === false && <p>当前实例暂时无法识别新页面，原资料和课稿仍保留。稍后可以重新读取。</p>}
          <button className="wb-button is-primary" disabled={recognition.isRunning || locked || (!recognition.pending && (reading || available !== true))} onClick={recognize}>
            {recognition.pending ? "确认识别请求" : imageParent ? (scene.jobId ? "重新识别这张图" : "识别这张图") : scene.jobId ? "重新识别这一页" : "识别这一页"}
          </button>
          {(error || available === false) && <button className="wb-button" onClick={() => setRevision(n => n + 1)}>重新读取</button>}
        </>}
        {scene.result && recognition.pending && <button className="wb-button" disabled={recognition.isRunning || locked}
          onClick={recognize}>确认识别请求</button>}
        {(cancellation.pending || (scene.jobId && ['queued', 'running', 'cancelling'].includes(state))) && <button
          className="wb-button" disabled={cancellation.isRunning || (!cancellation.pending && state === 'cancelling')}
          onClick={stop}>{cancellation.pending ? '确认停止结果' : state === 'cancelling' ? '正在停止识别' : '停止识别'}</button>}
        {!imageParent && !locked && !recognition.pending && !recognition.isRunning && <button className="wb-text-button"
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
      {source.recognizedImage && <>
        <ModuleDisclosure title="查看所选配图"><ControlledImage fileId={source.recognizedImage.fileId}
          alt={`原稿第 ${source.page} 页中的配图`} widthMm={170} /></ModuleDisclosure>
        <ModuleDisclosure title="配图机器识别原文"><DocumentView value={source.recognizedImage.machineDocument} /></ModuleDisclosure>
      </>}
      <ModuleDisclosure title={source.recognizedImage ? "整页机器识别原文" : "机器识别原文"}><DocumentView value={source.machineDocument} /></ModuleDisclosure>
    </LessonDialog>
  );
}
