import { useTranslation } from 'react-i18next';
/** Read-side presentation of one question, shared by reader, compare and conflict views. */

import { DocumentView } from '../workbench/MathText.jsx';
import { excerptFor } from '../workbench/documents.js';

export function QuestionTitle({ question }) {
  const { t } = useTranslation("questions");
  const title = (question.title || '').trim();
  if (title) return <h2 className="wb-object-title" data-field="title">{title}</h2>;
  return (
    <h2 className="wb-object-title is-derived" data-field="title">
      {excerptFor('', question.body, 40) || t("未命名题目")}
    </h2>
  );
}

export function QuestionBody({ document }) {
  useTranslation("questions");
  return <DocumentView document={document} className="wb-question-body" />;
}

export function SolutionDetails({ document, open = false }) {
  const { t } = useTranslation("questions");
  return (
    <details className="wb-answer" data-region="solution" open={open}>
      <summary>{t("答案与解析")}</summary>
      <DocumentView document={document} />
    </details>
  );
}

function NoteBlock({ note }) {
  const { t } = useTranslation("questions");
  if (!note) return null;
  return (
    <div className="wb-note-block" data-region="question-note">
      <h3>{t("教学笔记")}</h3>
      <p>{note}</p>
    </div>
  );
}

function SourceInfo({ source }) {
  const { t } = useTranslation("questions");
  if (!source) return null;
  if (source.kind === 'manual') {
    return <span data-field="source">{t("自建题目")}</span>;
  }
  if (source.kind === 'paste') {
    return (
      <details className="wb-source-paste" data-region="paste-source">
        <summary data-field="source">{t("收录文字 · 查看原稿")}</summary>
        <pre className="wb-raw-text">{source.text}</pre>
      </details>
    );
  }
  return (
    <span data-field="source"> {t("改编自")} {' '}
      <a href={`/questions/${source.questionId}`}>{excerptFor(source.snapshot?.title || '', source.snapshot?.body, 24) || t("原题")}</a>
      {' '}
      <span className="wb-muted">{t("（采用版本")} {source.questionVersion}）</span>
    </span>
  );
}

export function QuestionReader({
  question,
  derivatives = [],
  onEdit,
  onToggleStar,
  scroll = null,
  extraActions = null
}) {
  const { t } = useTranslation("questions");
  return (
    <article className="wb-reader" data-region="question-reader">
      <header className="wb-object-head">
        <QuestionTitle question={question} />
        <div className="wb-object-actions">
          {onEdit && (
            <button type="button" className="wb-button is-primary" name="edit" onClick={onEdit}>{t("编辑")}</button>
          )}
          {onToggleStar && (
            <button
              type="button"
              className={`wb-button${question.starred ? ' is-on' : ''}`}
              aria-pressed={Boolean(question.starred)}
              name="toggle-star"
              onClick={onToggleStar}
            >
              {question.starred ? t("已标记") : t("标记")}
            </button>
          )}
          {extraActions}
        </div>
      </header>

      <div
        className="wb-reader-scroll"
        data-region="question-scroll"
        ref={scroll?.ref}
        onScroll={scroll?.onScroll}
      >
        <QuestionBody document={question.body} />
        <SolutionDetails document={question.solution} />
        <NoteBlock note={question.note} />

        <div className="wb-reader-meta">
          <SourceInfo source={question.source} />
          {derivatives.length > 0 && (
            <div className="wb-relation" data-region="derivatives">
              <h3>{t("改编副本")}</h3>
              <ul>
                {derivatives.map((item) => (
                  <li key={item.id}>
                    <a href={`/questions/${item.id}`}>{excerptFor(item.title, item.body, 30) || t("副本")}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
