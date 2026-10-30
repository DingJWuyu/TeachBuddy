import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from "react";

export function PdfText({ client, renditionId, page, onText }) {
  const { t } = useTranslation("resources");
  const container = useRef(null);
  const [document, setDocument] = useState(null);
  const [retry, setRetry] = useState(0);
  const callback = useRef(onText);
  callback.current = onText;
  useEffect(() => {
    let active = true,
      task;
    const report = (value) =>
      callback.current({ ...value, renditionId, client, page: null });
    setDocument(null);
    report({ state: "loading", text: "" });
    (async () => {
      const file = await client.request(`/api/workbench/files/${renditionId}`);
      if (!active) return;
      if (file.mediaType !== "application/pdf") {
        report({ state: "unsupported", text: "" });
        return;
      }
      const [pdfjs, blob] = await Promise.all([
        import("pdfjs-dist"),
        client.request(`/api/workbench/files/${renditionId}/content`, {
          blob: true,
        }),
      ]);
      const data = new Uint8Array(await blob.arrayBuffer());
      if (!active) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      task = pdfjs.getDocument({
        data,
        isEvalSupported: false,
        // CMaps and standard fonts are served from this build, never a CDN, so CJK text layers work offline.
        cMapUrl: "/resources-pdf/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/resources-pdf/standard_fonts/",
      });
      const pdf = await task.promise;
      if (active)
        setDocument({
          pdf,
          TextLayer: pdfjs.TextLayer,
          renditionId,
          client,
          retry,
        });
    })().catch(() => {
      if (active)
        report({
          state: "failed",
          text: "",
          retry: () => setRetry((n) => n + 1),
        });
    });
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [client, renditionId, retry]);

  useEffect(() => {
    if (
      !document ||
      document.renditionId !== renditionId ||
      document.client !== client ||
      document.retry !== retry
    )
      return;
    let active = true,
      layer,
      observer;
    const element = container.current;
    const report = (value) =>
      callback.current({ ...value, renditionId, client, page });
    report({ state: "loading", text: "" });
    (async () => {
      const pdfPage = await document.pdf.getPage(page);
      const content = await pdfPage.getTextContent();
      if (!active) return;
      const text = content.items
        .map((item) => (item.str ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .trim();
      const lineBreaks = content.items
        .filter((item) => "str" in item)
        .map((item) => item.hasEOL);
      let width = 0;
      const render = async () => {
        if (!active) return;
        const nextWidth = element.parentElement.getBoundingClientRect().width;
        if (!nextWidth || Math.abs(nextWidth - width) < 0.1) return;
        width = nextWidth;
        layer?.cancel();
        element.replaceChildren();
        const viewport = pdfPage.getViewport({
          scale: width / pdfPage.getViewport({ scale: 1 }).width,
        });
        element.style.setProperty("--total-scale-factor", viewport.scale);
        layer = new document.TextLayer({
          textContentSource: content,
          container: element,
          viewport,
        });
        const currentLayer = layer;
        try {
          await currentLayer.render();
          if (active && currentLayer === layer)
            report({
              state: text ? "ready" : "empty",
              text,
              layer: currentLayer,
              lineBreaks,
            });
        } catch {
          if (active && currentLayer === layer)
            report({
              state: "failed",
              text: "",
              retry: () => setRetry((n) => n + 1),
            });
        }
      };
      observer = new ResizeObserver(() => {
        void render();
      });
      observer.observe(element.parentElement);
      await render();
    })().catch(() => {
      if (active)
        report({
          state: "failed",
          text: "",
          retry: () => setRetry((n) => n + 1),
        });
    });
    return () => {
      active = false;
      observer?.disconnect();
      layer?.cancel();
      element.replaceChildren();
    };
  }, [document, page, renditionId, client, retry]);
  return (
    <div
      ref={container}
      className="res-pdf-text"
      aria-label={t("第 {{page}} 页文字", { page: page })}
    />
  );
}
