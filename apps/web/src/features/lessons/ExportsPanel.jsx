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
          await workbenchGet(
            `/api/modules/lessons/v3/${lesson.id}/exports`,
          )
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
    const saved = ["clean", "saved"].includes(savable.status)
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
    <section className="r34-exports" aria-label="输出备课">
      <header className="wb-section-head">
        <h2>输出备课</h2>
        <button className="wb-button" onClick={() => onClose()}>
          返回文稿
        </button>
      </header>
      <div className="r34-export-options">
        <label>
          成果
          <select
            className="wb-input"
            value={options.kind}
            onChange={(e) =>
              setOptions((o) => ({ ...o, kind: e.target.value }))
            }
          >
            {Object.entries(kinds).map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label>
          格式
          <select
            className="wb-input"
            value={options.format}
            onChange={(e) =>
              setOptions((o) => ({ ...o, format: e.target.value }))
            }
          >
            <option value="docx">Word</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.includeAnswers}
            onChange={(e) =>
              setOptions((o) => ({ ...o, includeAnswers: e.target.checked }))
            }
          />
          答案与解析
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.includeTeacherNotes}
            onChange={(e) =>
              setOptions((o) => ({
                ...o,
                includeTeacherNotes: e.target.checked,
              }))
            }
          />
          教师注记
        </label>
        {options.kind !== "lesson-plan" && (
          <label>
            作答空白行
            <input
              className="wb-input"
              type="number"
              min="0"
              max="20"
              value={options.answerSpaceLines}
              onChange={(e) =>
                setOptions((o) => ({
                  ...o,
                  answerSpaceLines: Number(e.target.value),
                }))
              }
            />
          </label>
        )}
      </div>
      <fieldset>
        <legend>包含环节</legend>
        {savable.input.sections.map((s) => (
          <label key={s.id}>
            <input
              type="checkbox"
              checked={options.sectionIds.includes(s.id)}
              onChange={() => toggle("sectionIds", s.id)}
            />
            {s.title}
          </label>
        ))}
      </fieldset>
      {!!savable.input.materials.length && (
        <fieldset>
          <legend>备用材料</legend>
          {savable.input.materials.map((r) => (
            <label key={r.id}>
              <input
                type="checkbox"
                checked={options.materialReferenceIds.includes(r.id)}
                onChange={() => toggle("materialReferenceIds", r.id)}
              />
              {r.snapshot?.title || "题目"}
            </label>
          ))}
        </fieldset>
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
          保存并生成
        </button>
      )}
      <div className="r34-output-list">
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
                    openLessonFile(r.fileId).catch((e) => setError(e.message))
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
                {issue.field && ` ${issue.field}`}
              </p>
            ))}
          </article>
        ))}
      </div>
      {preview && (
        <FilePreview fileId={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
