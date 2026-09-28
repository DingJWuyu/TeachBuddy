import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: 'lessons', ...options });
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
import { LessonExportSelection } from "./LessonExportSelection.jsx";
import { Icon } from "../workbench/icons.jsx";
import { SaveStatus } from "../workbench/SaveStatus.jsx";
const exportIssueKeys = {
  'cancelled': 'exportIssue.cancelled',
  'missing-asset': 'exportIssue.missingAsset',
  'disk-full': 'exportIssue.diskFull',
  'conversion-failed': 'exportIssue.conversionFailed',
  'interrupted': 'exportIssue.interrupted',
};
const kinds = {
  get "lesson-plan"() { return t("教案 / 提纲"); },
  get handout() { return t("导学案 / 讲义"); },
  get practice() { return t("练习"); },
};
export function ExportsPanel({ savable, onClose }) {
  const { t } = useTranslation('lessons');
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
        excludedReferenceIds: [],
        answerSpaceOverrides: [],
        resourcePageReferenceIds: [],
      },
    },
  );
  const references = [...savable.input.materials, ...savable.input.sections.flatMap(s => s.references)];
  const options = {
    ...scene.options,
    resourcePageReferenceIds: (scene.options.resourcePageReferenceIds ?? []).filter(id => references.some(r => r.id === id && r.kind === "resource")),
    excludedReferenceIds: (scene.options.excludedReferenceIds ?? []).filter(id => references.some(r => r.id === id)),
    answerSpaceOverrides: (scene.options.answerSpaceOverrides ?? []).filter(item => references.some(r => r.id === item.referenceId)),
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
  const selectedReferences = [
    ...savable.input.sections.filter(s => options.sectionIds.includes(s.id)).flatMap(s => s.references),
    ...savable.input.materials.filter(r => options.materialReferenceIds.includes(r.id)),
  ].filter(r => options.kind !== "practice" || (r.kind ?? "question") === "question");
  const questionCount = selectedReferences.filter(r => (r.kind ?? "question") === "question" && !options.excludedReferenceIds.includes(r.id)).length;
  const resourcePageCount = selectedReferences.filter(r => options.resourcePageReferenceIds.includes(r.id) && !options.excludedReferenceIds.includes(r.id)).length;
  const emptyPractice = options.kind === "practice" && questionCount === 0;
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
        unexpectedSuccessProblem(t("生成请求结果无法识别")),
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
      setError(t("请先处理备课保存问题"));
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
    <section className="wb-module r34-exports" aria-label={t("输出备课")}>
      <header className="lesson-export-heading">
        <button className="wb-text-button" onClick={() => onClose()}>
          <Icon name="back" size={16} />
          {t("返回课稿")}
        </button>
        <h1>{t("生成教学资料")}</h1>
        <p>
          {savable.input.title || t("未命名备课")} {t("· 选择用途，生成后可预览和下载。")}
        </p>
      </header>
      <div className="lesson-export-body">
        <fieldset className="lesson-export-kinds">
          <legend>{t("这份资料准备怎么用？")}</legend>
          <div role="radiogroup" aria-label={t("资料用途")}>
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
                      "lesson-plan": t("给自己用，按教学环节组织讲课思路与材料。"),
                      handout: t("发给学生，保留讲解内容、题目和作答空间。"),
                      practice: t("集中练习，只收集所选环节中的题目。"),
                    }[key]
                  }
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="lesson-export-settings">
          <section>
            <h2>{t("文件与内容")}</h2>
            <fieldset className="lesson-export-format">
              <legend>{t("文件格式")}</legend>
              {[
                ["docx", "Word", t("可以继续编辑")],
                ["pdf", "PDF", t("适合直接打印")],
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
                {t("附上答案与解析")}<small>{t("放在全部题目之后，单独成节。")}</small>
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
                {t("附上教师注记")}<small>{t("包括课稿里的教师注记和本课材料备注。")}</small>
              </span>
            </label>
            {options.kind !== "lesson-plan" && (
              <label className="lesson-answer-space">
                {t("题后作答空白")}
                <input
                  className="wb-input"
                  aria-label={t("作答空白行")}
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
                {t("行")}
              </label>
            )}
          </section>
          <aside className="lesson-export-summary">
            <h2>{t("本次生成")}</h2>
            <p>
              <strong>{kinds[options.kind]}</strong>
              <span>
                {options.format === "docx" ? resourcePageCount ? t("Word · 正文可编辑，原页为图片") : t("Word · 可编辑") : t("PDF · 可打印")}
              </span>
            </p>
            <ul>
              <li>{options.sectionIds.length} {t("个教学环节 ·")} {questionCount} {t("道题")}</li>
              {resourcePageCount > 0 && <li>{resourcePageCount} {t("份资源按原页插入，包含原件全部内容")}</li>}
              <li>
                {options.materialReferenceIds.length
                  ? t("另外包含 {{count}} 份备用材料", { count: options.materialReferenceIds.length })
                  : t("不包含备用材料")}
              </li>
              <li>
                {options.includeAnswers ? t("附答案与解析") : t("不附答案与解析")}
              </li>
              <li>
                {options.includeTeacherNotes ? t("附教师注记") : t("不附教师注记")}
              </li>
            </ul>
            <small>{t("选项只影响这次生成，课稿和来源材料保持原样。")}</small>
          </aside>
        </div>
        {(savable.input.sections.length > 0 ||
          savable.input.materials.length > 0) && (
          <ModuleDisclosure
            title={t("选择环节与备用材料")}
            className="lesson-export-scope"
          >
            {!!savable.input.sections.length && (
              <fieldset>
                <legend>{t("包含的教学环节")}</legend>
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
                <legend>{t("另外加入备用材料")}</legend>
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
                    {reference.snapshot?.title || t("题目")}
                  </label>
                ))}
              </fieldset>
            )}
          </ModuleDisclosure>
        )}
        {selectedReferences.length > 0 && (
          <LessonExportSelection references={selectedReferences} options={options} setOptions={setOptions} />
        )}
        {savable.localDraft && (
          <p className="lesson-export-save-hint">
            {t("生成前会先保存当前课稿，包括尚未保存的修改。")}
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
                {t("返回错误位置")}
              </button>
            )}
          </p>
        )}
        <div className="r34-output-list">
          {records.length > 0 && <h2>{t("已生成的资料")}</h2>}
          {records.map((r) => (
            <article key={r.id}>
              <div>
                <strong>
                  {kinds[r.options.kind]} · {r.options.format.toUpperCase()}
                </strong>
                <span className="wb-muted">
                  {t("版本")} {r.lessonVersion} {t("· 答案")}
                  {r.options.includeAnswers ? t("开") : t("关")} {t("· 注记")}
                  {r.options.includeTeacherNotes ? t("开") : t("关")}
                </span>
              </div>
              {r.fileId ? (
                <>
                  <button
                    className="wb-button"
                    onClick={() => setPreview(r.fileId)}
                  >
                    {t("预览成品")}
                  </button>
                  <button
                    className="wb-button"
                    onClick={() =>
                      openLessonFile(
                        r.fileId,
                        `${savable.input.title || "备课"}-${({ "lesson-plan": "教案 / 提纲", handout: "导学案 / 讲义", practice: "练习" })[r.options.kind]}.${r.options.format}`,
                      ).catch((e) => setError(e.message))
                    }
                  >
                    {t("下载")}
                  </button>
                </>
              ) : (
                <span>
                  {{
                    queued: t("等待生成"),
                    running: t("正在生成"),
                    cancelling: t("正在停止"),
                    cancelled: t("已停止"),
                    interrupted: t("服务重启，需重新生成"),
                    failed: t("生成失败，可重新生成"),
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
                  {t("停止")}
                </button>
              )}
              {r.job.issues.map((issue, i) => (
                <p key={i} role="alert" title={issue.detail}>
                  {Object.hasOwn(exportIssueKeys, issue.code) ? t(exportIssueKeys[issue.code]) : issue.detail}
                  {issue.field && (
                    <button
                      className="wb-text-button"
                      onClick={() => onClose(issue.field)}
                    >
                      {t("返回课稿检查")}
                    </button>
                  )}
                </p>
              ))}
            </article>
          ))}
        </div>
      </div>
      <footer className="lesson-export-footer">
        <span>{emptyPractice ? t("至少选择一道题才能生成练习。") : t("生成后可预览成品，再下载文件。")}</span>
        {submit.pending ? (
          <button
            className="wb-button"
            onClick={async () => {
              await submit.retry(send);
              setRevision((n) => n + 1);
            }}
          >
            {t("重试确认生成请求")}
          </button>
        ) : (
          <button
            className="wb-button is-primary"
            disabled={submit.isRunning || savable.status === "saving" || emptyPractice}
            onClick={create}
          >
            {submit.isRunning || savable.status === "saving"
              ? t("正在提交…")
              : t("保存并生成")}
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
