import { Icon } from '../../components/icons.jsx';
import { WorkIllustration } from './WorkspaceHome.jsx';
import { tx } from '../../i18n/presentation.js';
import { useTranslation } from 'react-i18next';

import { ModulePresence } from "../../components/interaction/ModuleMotion.jsx";
import React, { useEffect, useState } from "react";
import {
  htmlLimit,
  isolatedHtml,
} from "@teachbuddy/shared/math/isolation";
export default function HtmlEditor({
  draft,
  client,
  onChange,
  onError,
  onDownload,
}) {
  const { t, i18n } = useTranslation('math');
  const [text, setText] = useState(null),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [running, setRunning] = useState(false);
  const [previewRun, setPreviewRun] = useState(0);
  const startPreview = () => { setPreviewRun(value => value + 1); setRunning(true); };
  useEffect(() => {
    let live = true;
    setRunning(false);
    setText(null);
    setError("");
    setEditing(false);
    client
      .blob(`/api/workbench/files/${draft.source.fileId}/content`)
      .then(async (blob) => {
        if (blob.size > htmlLimit)
          throw new Error(t("文件超过 1 MiB，无法编辑或运行；可以取回原件。"));
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
          await blob.arrayBuffer(),
        );
        if (live) setText(text);
      })
      .catch((error) => {
        if (live) {
          setError(
            error.status
              ? error.message
              : t("编码不支持或文件超过 1 MiB，无法编辑或运行；可以取回原件。"),
          );
          if (error.status) onError(error);
        }
      });
    return () => {
      live = false;
    };
  }, [draft.source.fileId]);
  const current = draft.htmlText ?? text;
  const tooLarge =
    current !== null && new TextEncoder().encode(current).length > htmlLimit;
  return (
    <div className="math-html">
      <div className="math-add">
        <button
          disabled={!draft.id || current === null || !!error}
          onClick={() => setEditing(!editing)}
        >
          {editing ? t("收起源码") : t("编辑源码")}
        </button>
        <button
          disabled={current === null || !!error || tooLarge}
          onClick={() => running ? setRunning(false) : startPreview()}
        >
          {running ? t("关闭预览") : t("运行预览")}
        </button>
        <button onClick={() => onDownload(draft.originalFileId)}>
          {t("取回原文件")}
        </button>
      </div>
      {!running && !editing && <div className="math-html-empty">
        <div className="math-html-window" aria-hidden="true"><i/><i/><i/><WorkIllustration kind="dynamic"/></div>
        <h2>{t('网页演示')}</h2><p>{tx('运行预览，看看它在课堂上的样子；也可以打开源码修改。')}</p>
        <button className="math-html-run" disabled={current === null || !!error || tooLarge} onClick={startPreview}><Icon name="play" size={13}/>{t('运行预览')}</button>
      </div>}
      {!draft.id && <p>{t("原件已上传，保存作品后可修改源码。")}</p>}
      {(error || tooLarge) && (
        <p role="alert">
          {error || t("源码超过 1 MiB，可保存及取回，无法运行预览。")}
        </p>
      )}
      <ModulePresence present={editing} mode="collapse">{editing && (
        <label>
          {t("HTML 源码")}
          <textarea
            aria-label={t("HTML 源码")}
            spellCheck="false"
            value={current ?? ""}
            onChange={(e) => {
              setRunning(false);
              onChange({
                ...draft,
                htmlText: e.target.value,
                htmlUploadKey: crypto.randomUUID(),
              });
            }}
          />
        </label>
      )}
      </ModulePresence>
      <ModulePresence present={running} mode="collapse">{running && (
        <iframe
          key={previewRun}
          title={t("作品隔离预览")}
          sandbox="allow-scripts"
          srcDoc={isolatedHtml(current, true, {
            language: i18n.resolvedLanguage,
            title: t('isolation.title'), frame: t('isolation.frame'), stop: t('isolation.stop'),
            external: t('isolation.external'), selfContained: t('isolation.selfContained'),
            failure: t('isolation.failure'), navigation: t('isolation.navigation'), stopped: t('isolation.stopped'),
          })}
        />
      )}</ModulePresence>
    </div>
  );
}
