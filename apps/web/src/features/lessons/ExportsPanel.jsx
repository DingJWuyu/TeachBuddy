import {
  ModulePresence,
  ModuleDisclosure,
} from "../workbench/ModuleMotion.jsx";
import { unexpectedSuccessProblem } from "../workbench/problems.js";
import { useScene } from "../workbench/useScene.js";
import { useEffect, useState } from "react";
import {
  workbenchGet,
  workbenchPost,
  WorkbenchError,
} from "../workbench/apiClient.js";
import { useIdempotentSubmit } from "../workbench/useIdempotentSubmit.js";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { openLessonFile } from "./files.js";
import { FilePreview } from "./FilePreview.jsx";
import { Icon } from "../workbench/icons.jsx";
import { SaveStatus } from "../workbench/SaveStatus.jsx";
const kinds = {
  "lesson-plan": "教案 / 提纲",
  handout: "导学案 / 讲义",
  practice: "练习",
};
export function ExportsPanel({ savable, onClose }) {
  const shell = useWorkbenchShell(),
    lesson = savable.baseline;
  const [scene, patchScene] = useScene(
    shell.accountKey,
    `lesson-output-${lesson?.id ?? "new"}`,
    {
      options: {
        kind: "lesson-plan",
        format: "docx",
        includeAnswers: false,
        includeTeacherNotes: false,
        sectionIds: savable.input.sections.map((s) => s.id),
        materialReferenceIds: [],
        answerSpaceLines: 4,
      },
    },
  );
  const options = {
    ...scene.options,
    sectionIds: scene.options.sectionIds.filter((id) =>
      savable.input.sections.some((section) => section.id === id),
    ),
    materialReferenceIds: scene.options.materialReferenceIds.filter((id) =>
      savable.input.materials.some((reference) => reference.id === id),
    ),
  };
  const setOptions = (change) =>
    patchScene((current) => ({
      options: typeof change === "function" ? change(current.options) : change,
    }));
  const [records, setRecords] = useState([]),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(null),
    [revision, setRevision] = useState(0);
  const submit = useIdempotentSubmit({
    accountKey: shell.accountKey,
    name: `pending:lesson-export:${lesson?.id ?? "new"}`,
  });
  useEffect(() => {
    if (!lesson?.id) return;
    let live = true,
      timer;
    const update = async () => {
      try {
        const rows = (
          await workbenchGet(`/api/modules/lessons/v3/${lesson.id}/exports`)
        ).body.items;
        const items = await Promise.all(
          rows.map(async (r) => ({
            ...r,
            job: (await workbenchGet(`/api/workbench/jobs/${r.jobId}`)).body,
          })),
        );
        if (live) {
          setRecords(items);
          if (
            items.some((r) =>
              ["queued", "running", "cancelling"].includes(r.job.state),
            )
          )
            timer = setTimeout(update, 2000);
        }
      } catch (e) {
        if (live) setError(e.message);
      }
    };
    update();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [lesson?.id, revision]);
  const send = async ({ key, payload }) => {
    const body = (
      await workbenchPost(
        `${payload.apiVersion === 3 ? "/api/modules/lessons/v3" : "/api/modules/lessons/v2/items"}/${payload.id}/exports`,
        payload.options,
        key,
      )
    ).body;
    if (!body?.id || !body.jobId || !body.lessonVersion || !body.options)
      throw new WorkbenchError(
        unexpectedSuccessProblem("生成请求结果无法识别"),
      );
    return body;
  };
  async function create() {
    setError("");
    const saved =
      savable.baseline && ["clean", "saved"].includes(savable.status)
        ? savable.baseline
        : await savable.save();
    if (!saved) {
      setError("请先处理备课保存问题");
      return;
    }
    const result = await submit.submit(send, {
      id: saved.id,
      apiVersion: 3,
      options: { baseVersion: saved.version, ...options },
    });
    if (result) setRevision((n) => n + 1);
  }
  const toggle = (key, id) =>
    setOptions((o) => ({
      ...o,
      [key]: o[key].includes(id)
        ? o[key].filter((v) => v !== id)
        : [...o[key], id],
    }));
  return (
    <section className="wb-module r34-exports" aria-label="输出备课">
      <header className="lesson-export-heading">
        <button className="wb-text-button" onClick={() => onClose()}>
          <Icon name="back" size={16} />
          返回课稿
        </button>
        <h1>生成教学资料</h1>
        <p>
          {savable.input.title || "未命名备课"} · 选择用途，生成后可预览和下载。
        </p>
      </header>
      <div className="lesson-export-body">
        <fieldset className="lesson-export-kinds">
          <legend>这份资料准备怎么用？</legend>
          <div role="radiogroup" aria-label="资料用途">
            {Object.entries(kinds).map(([key, title]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={options.kind === key}
                tabIndex={options.kind === key ? 0 : -1}
                className={options.kind === key ? "is-selected" : ""}
                onKeyDown={(event) => {
                  const direction = {
                    ArrowRight: 1,
                    ArrowDown: 1,
                    ArrowLeft: -1,
                    ArrowUp: -1,
                  }[event.key];
                  if (!direction) return;
                  event.preventDefault();
                  const choices = Object.keys(kinds);
                  const index =
                    (choices.indexOf(key) + direction + choices.length) %
                    choices.length;
                  setOptions((current) => ({
                    ...current,
                    kind: choices[index],
                  }));
                  event.currentTarget.parentElement
                    .querySelectorAll('[role="radio"]')
                    [index].focus();
                }}
                onClick={() =>
                  setOptions((current) => ({ ...current, kind: key }))
                }
              >
                <span className="lesson-export-kind-top">
                  <Icon
                    name={
                      key === "practice"
                        ? "question"
                        : key === "handout"
                          ? "copy"
                          : "prep"
                    }
                    size={24}
                  />
                  <span className="lesson-radio-mark">
                    {options.kind === key && <Icon name="check" size={12} />}
                  </span>
                </span>
                <strong>{title}</strong>
                <span>
                  {
                    {
                      "lesson-plan": "给自己用，按教学环节组织讲课思路与材料。",
                      handout: "发给学生，保留讲解内容、题目和作答空间。",
                      practice: "集中练习，只收集所选环节中的题目。",
                    }[key]
                  }
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="lesson-export-settings">
          <section>
            <h2>文件与内容</h2>
            <fieldset className="lesson-export-format">
              <legend>文件格式</legend>
              {[
                ["docx", "Word", "可以继续编辑"],
                ["pdf", "PDF", "适合直接打印"],
              ].map(([value, name, hint]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="lesson-export-format"
                    checked={options.format === value}
                    onChange={() =>
                      setOptions((current) => ({ ...current, format: value }))
                    }
                  />
                  <span>
                    <strong>{name}</strong>
                    <small>{hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="lesson-export-check">
              <input
                type="checkbox"
                checked={options.includeAnswers}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    includeAnswers: event.target.checked,
                  }))
                }
              />
              <span>
                附上答案与解析<small>放在全部题目之后，单独成节。</small>
              </span>
            </label>
            <label className="lesson-export-check">
              <input
                type="checkbox"
                checked={options.includeTeacherNotes}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    includeTeacherNotes: event.target.checked,
                  }))
                }
              />
              <span>
                附上教师注记<small>包括课稿里的教师注记和本课材料备注。</small>
              </span>
            </label>
            {options.kind !== "lesson-plan" && (
              <label className="lesson-answer-space">
                题后作答空白
                <input
                  className="wb-input"
                  aria-label="作答空白行"
                  type="number"
                  min="0"
                  max="20"
                  value={options.answerSpaceLines}
                  onChange={(event) =>
                    setOptions((current) => ({
                      ...current,
                      answerSpaceLines: Number(event.target.value),
                    }))
                  }
                />
                行
              </label>
            )}
          </section>
          <aside className="lesson-export-summary">
            <h2>本次生成</h2>
            <p>
              <strong>{kinds[options.kind]}</strong>
              <span>
                {options.format === "docx" ? "Word · 可编辑" : "PDF · 可打印"}
              </span>
            </p>
            <ul>
              <li>{options.sectionIds.length} 个教学环节</li>
              <li>
                {options.materialReferenceIds.length
                  ? `另外包含 ${options.materialReferenceIds.length} 份备用材料`
                  : "不包含备用材料"}
              </li>
              <li>
                {options.includeAnswers ? "附答案与解析" : "不附答案与解析"}
              </li>
              <li>
                {options.includeTeacherNotes ? "附教师注记" : "不附教师注记"}
              </li>
            </ul>
            <small>选项只影响这次生成，课稿和来源材料保持原样。</small>
          </aside>
        </div>
        {(savable.input.sections.length > 0 ||
          savable.input.materials.length > 0) && (
          <ModuleDisclosure
            title="选择环节与备用材料"
            className="lesson-export-scope"
          >
            {!!savable.input.sections.length && (
              <fieldset>
                <legend>包含的教学环节</legend>
                {savable.input.sections.map((section) => (
                  <label key={section.id}>
                    <input
                      type="checkbox"
                      checked={options.sectionIds.includes(section.id)}
                      onChange={() => toggle("sectionIds", section.id)}
                    />
                    {section.title}
                  </label>
                ))}
              </fieldset>
            )}
            {!!savable.input.materials.length && (
              <fieldset>
                <legend>另外加入备用材料</legend>
                {savable.input.materials.map((reference) => (
                  <label key={reference.id}>
                    <input
                      type="checkbox"
                      checked={options.materialReferenceIds.includes(
                        reference.id,
                      )}
                      onChange={() =>
                        toggle("materialReferenceIds", reference.id)
                      }
                    />
                    {reference.snapshot?.title || "题目"}
                  </label>
                ))}
              </fieldset>
            )}
          </ModuleDisclosure>
        )}
        {savable.localDraft && (
          <p className="lesson-export-save-hint">
            生成前会先保存当前课稿，包括尚未保存的修改。
          </p>
        )}
        {!["clean", "saved"].includes(savable.status) && (
          <SaveStatus savable={savable} />
        )}
        {(error || submit.problem) && (
          <p role="alert">
            {error || submit.problem.message}
            {submit.problem?.field && (
              <button
                className="wb-text-button"
                onClick={() => onClose(submit.problem.field)}
              >
                返回错误位置
              </button>
            )}
          </p>
        )}
        <div className="r34-output-list">
          {records.length > 0 && <h2>已生成的资料</h2>}
          {records.map((r) => (
            <article key={r.id}>
              <div>
                <strong>
                  {kinds[r.options.kind]} · {r.options.format.toUpperCase()}
                </strong>
                <span className="wb-muted">
                  版本 {r.lessonVersion} · 答案
                  {r.options.includeAnswers ? "开" : "关"} · 注记
                  {r.options.includeTeacherNotes ? "开" : "关"}
                </span>
              </div>
              {r.fileId ? (
                <>
                  <button
                    className="wb-button"
                    onClick={() => setPreview(r.fileId)}
                  >
                    预览成品
                  </button>
                  <button
                    className="wb-button"
                    onClick={() =>
                      openLessonFile(
                        r.fileId,
                        `${savable.input.title || "备课"}-${kinds[r.options.kind]}.${r.options.format}`,
                      ).catch((e) => setError(e.message))
                    }
                  >
                    下载
                  </button>
                </>
              ) : (
                <span>
                  {{
                    queued: "等待生成",
                    running: "正在生成",
                    cancelling: "正在停止",
                    cancelled: "已停止",
                    interrupted: "服务重启，需重新生成",
                    failed: "生成失败，可重新生成",
                  }[r.job.state] ?? r.job.state}
                </span>
              )}
              {["queued", "running"].includes(r.job.state) && (
                <button
                  className="wb-button"
                  onClick={async () => {
                    try {
                      await workbenchPost(
                        `/api/workbench/jobs/${r.jobId}/cancel`,
                        {},
                        crypto.randomUUID(),
                      );
                      setRevision((n) => n + 1);
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  停止
                </button>
              )}
              {r.job.issues.map((issue, i) => (
                <p key={i} role="alert">
                  {issue.detail}
                  {issue.field && (
                    <button
                      className="wb-text-button"
                      onClick={() => onClose(issue.field)}
                    >
                      返回课稿检查
                    </button>
                  )}
                </p>
              ))}
            </article>
          ))}
        </div>
      </div>
      <footer className="lesson-export-footer">
        <span>生成后可预览成品，再下载文件。</span>
        {submit.pending ? (
          <button
            className="wb-button"
            onClick={async () => {
              await submit.retry(send);
              setRevision((n) => n + 1);
            }}
          >
            重试确认生成请求
          </button>
        ) : (
          <button
            className="wb-button is-primary"
            disabled={submit.isRunning || savable.status === "saving"}
            onClick={create}
          >
            {submit.isRunning || savable.status === "saving"
              ? "正在提交…"
              : "保存并生成"}
          </button>
        )}
      </footer>
      <ModulePresence present={Boolean(preview)}>
        {preview && (
          <FilePreview fileId={preview} onClose={() => setPreview(null)} />
        )}
      </ModulePresence>
    </section>
  );
}
