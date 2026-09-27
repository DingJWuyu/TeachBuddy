import { useEffect, useRef, useState } from "react";

export function PdfText({ client, renditionId, page, onText }) {
  const container = useRef(null);
  const [document, setDocument] = useState(null);
  const [retry, setRetry] = useState(0);
  const callback = useRef(onText);
  callback.current = onText;
  useEffect(() => {
    let active = true,
      task;
    setDocument(null);
    callback.current({ state: "loading", text: "" });
    (async () => {
      const file = await client.request(`/api/workbench/files/${renditionId}`);
      if (!active) return;
      if (file.mediaType !== "application/pdf") {
        callback.current({ state: "unsupported", text: "" });
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
        cMapUrl: "/resources-pdf/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/resources-pdf/standard_fonts/",
      });
      const pdf = await task.promise;
      if (active) setDocument({ pdf, TextLayer: pdfjs.TextLayer });
    })().catch(() => {
      if (active)
        callback.current({
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
    if (!document) return;
    let active = true,
      layer,
      observer;
    const element = container.current;
    callback.current({ state: "loading", text: "" });
    (async () => {
      const pdfPage = await document.pdf.getPage(page);
      const content = await pdfPage.getTextContent();
      if (!active) return;
      const text = content.items
        .map((item) => (item.str ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .trim();
      let width = 0;
      const render = async () => {
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
            callback.current({ state: text ? "ready" : "empty", text });
        } catch {
          if (active && currentLayer === layer)
            callback.current({
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
        callback.current({
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
  }, [document, page]);
  return (
    <div
      ref={container}
      className="res-pdf-text"
      aria-label={`第 ${page} 页文字`}
    />
  );
}
