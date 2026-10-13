import { useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { textMatches } from "./textMatches.js";

function renderedRanges(element, query) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let text = "", block;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // KaTeX's hidden alternate representations are not visible text positions.
    if (!node.length || node.parentElement.closest('[aria-hidden="true"], annotation, .katex-mathml')) continue;
    const nextBlock = node.parentElement.closest("p, h1, h2, h3, h4, h5, h6, li, td, .wb-math-block");
    if (block && nextBlock !== block) text += "\n";
    block = nextBlock;
    nodes.push({ node, start: text.length, end: text.length + node.length });
    text += node.data;
  }
  return textMatches(text, query).flatMap(({ from, to }) => {
    const start = nodes.find(entry => entry.start <= from && entry.end > from);
    const end = nodes.find(entry => entry.start < to && entry.end >= to);
    if (!start || !end) return [];
    const range = document.createRange();
    range.setStart(start.node, from - start.start);
    range.setEnd(end.node, to - end.start);
    return [range];
  });
}

// Locate OCR hits in the rendered recognized document, never on the original
// image. Formula source that is absent from the rendered DOM gets a short excerpt.
export function RecognitionHit({ text, query, children }) {
  const { t } = useTranslation("resources");
  const body = useRef(null);
  const snippet = useRef(null);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const name = `res-ocr-hit-${id}`;
  const [fallback, setFallback] = useState(false);
  useLayoutEffect(() => {
    const supported = globalThis.CSS?.highlights && globalThis.Highlight;
    const ranges = query && supported ? renderedRanges(body.current, query) : [];
    setFallback(Boolean(query && !ranges.length));
    if (!ranges.length) return;
    const highlight = new Highlight(...ranges);
    CSS.highlights.set(name, highlight);
    const viewport = body.current.closest(".res-recognition-document");
    const rect = ranges[0].getClientRects()[0];
    const frame = viewport?.getBoundingClientRect();
    if (rect && frame && (rect.top < frame.top || rect.bottom > frame.bottom))
      viewport.scrollBy({ top: rect.top - frame.top - (frame.height - rect.height) / 2, behavior: "instant" });
    return () => {
      if (CSS.highlights.get(name) === highlight) CSS.highlights.delete(name);
    };
  }, [query, children, name]);
  useLayoutEffect(() => {
    if (fallback) snippet.current?.scrollIntoView({ block: "nearest" });
  }, [fallback, query]);
  const match = fallback ? textMatches(text, query)[0] : null;
  return <>
    <style>{`.res-recognition-document::highlight(${name}) { background-color: #facc1577; color: inherit; }`}</style>
    {match && <section className="res-recognition-hit" aria-label={t("识别正文搜索命中")} ref={snippet}>
      <p>{t("此命中来自识别原文，请与排版正文和原页核对。")}</p>
      <pre>{match.from > 45 ? "…" : ""}{text.slice(Math.max(0, match.from - 45), match.from)}<mark>{text.slice(match.from, match.to)}</mark>{text.slice(match.to, match.to + 75)}{match.to + 75 < text.length ? "…" : ""}</pre>
    </section>}
    <div ref={body}>{children}</div>
  </>;
}
