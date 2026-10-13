import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { textMatches } from "./textMatches.js";

// The OCR source is text, so locate the hit in this read-only text view. It
// deliberately has no connection to the original page's image coordinates.
export function RecognitionHit({ text, query }) {
  const { t } = useTranslation("resources");
  const first = useRef(null);
  const id = useId();
  const matches = textMatches(text, query);
  useEffect(() => { first.current?.scrollIntoView({ block: "nearest" }); }, [text, query]);
  if (!query || !matches.length) return null;
  const content = [];
  let end = 0;
  matches.forEach((match, index) => {
    content.push(text.slice(end, match.from));
    content.push(<mark key={`${id}-${index}`} ref={index === 0 ? first : null}>{text.slice(match.from, match.to)}</mark>);
    end = match.to;
  });
  content.push(text.slice(end));
  return <section className="res-recognition-hit" aria-label={t("识别正文搜索命中")}>
    <p>{t("搜索命中识别原文，位置仅对应文字。")}</p>
    <pre>{content}</pre>
  </section>;
}
