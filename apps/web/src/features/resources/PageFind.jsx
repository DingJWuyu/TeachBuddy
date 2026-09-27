import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "../workbench/chrome/icons.jsx";
import { ModulePresence } from "../workbench/ModuleMotion.jsx";

// Match the rendered text itself. RegExp keeps offsets in the original UTF-16
// string, including case-insensitive matches, so Range never uses folded offsets.
function findRanges(layer, lineBreaks, query) {
  if (!layer || !query.trim()) return [];
  let text = "";
  const nodes = [];
  layer.textDivs.forEach((div, index) => {
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.length) continue;
      nodes.push({ node, start: text.length, end: text.length + node.length });
      text += node.data;
    }
    if (lineBreaks[index]) text += "\n";
  });
  const pattern = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "giu",
  );
  const ranges = [];
  let start = 0,
    end = 0;
  for (const match of text.matchAll(pattern)) {
    const from = match.index,
      to = from + match[0].length;
    while (nodes[start]?.end <= from) start++;
    while (nodes[end]?.end < to) end++;
    if (
      !nodes[start] ||
      !nodes[end] ||
      from < nodes[start].start ||
      to > nodes[end].end
    )
      continue;
    const range = document.createRange();
    range.setStart(nodes[start].node, from - nodes[start].start);
    range.setEnd(nodes[end].node, to - nodes[end].start);
    ranges.push(range);
  }
  return ranges;
}

export function PageFind({
  open,
  source,
  text,
  imageReady,
  scrollRef,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(null);
  const scrolled = useRef(null);
  const input = useRef(null);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const allName = `res-find-${id}`,
    currentName = `${allName}-current`;
  const supported = Boolean(globalThis.CSS?.highlights && globalThis.Highlight);
  const ranges = useMemo(
    () =>
      open && supported && text.state === "ready"
        ? findRanges(text.layer, text.lineBreaks, query)
        : [],
    [open, supported, text, query],
  );
  const selected =
    selection?.source === source && selection.query === query
      ? Math.min(selection.index, Math.max(0, ranges.length - 1))
      : 0;

  useEffect(() => {
    if (!open) return;
    const origin = document.activeElement;
    const region = input.current?.closest(".res-find-presence");
    if (!region) return;
    let active = true;
    const focus = async () => {
      if (region.dataset.state !== "open") return;
      observer.disconnect();
      // Focusing inside a still-collapsed grid can leave Chromium's editing
      // caret at zero. Wait for the actual transition, not a guessed timeout.
      await Promise.allSettled(
        region.getAnimations().map((animation) => animation.finished),
      );
      if (
        active &&
        region.dataset.state === "open" &&
        document.activeElement === origin
      )
        input.current?.focus();
    };
    const observer = new MutationObserver(() => {
      void focus();
    });
    observer.observe(region, {
      attributes: true,
      attributeFilter: ["data-state"],
    });
    void focus();
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [open]);
  useLayoutEffect(() => {
    setSelection(null);
  }, [source]);
  useLayoutEffect(() => {
    if (!open || !supported || !ranges.length) return;
    const all = new Highlight(),
      current = new Highlight(ranges[selected]);
    for (const range of ranges) all.add(range);
    current.priority = 1;
    CSS.highlights.set(allName, all);
    CSS.highlights.set(currentName, current);
    return () => {
      if (CSS.highlights.get(allName) === all) CSS.highlights.delete(allName);
      if (CSS.highlights.get(currentName) === current)
        CSS.highlights.delete(currentName);
    };
  }, [open, supported, ranges, selected, allName, currentName]);
  useLayoutEffect(() => {
    if (
      !open ||
      !imageReady ||
      !selection?.scroll ||
      scrolled.current === selection ||
      selection.source !== source ||
      selection.query !== query
    )
      return;
    const range = ranges[selected],
      viewport = scrollRef.current;
    if (!range || !viewport || !range.startContainer.isConnected) return;
    const rect = range.getClientRects()[0],
      frame = viewport.getBoundingClientRect();
    if (!rect) return;
    const top =
      rect.top < frame.top + 12 || rect.bottom > frame.bottom - 12
        ? rect.top - frame.top - (frame.height - rect.height) / 2
        : 0;
    const left =
      rect.left < frame.left + 12 || rect.right > frame.right - 12
        ? rect.left - frame.left - (frame.width - rect.width) / 2
        : 0;
    if (top || left) viewport.scrollBy({ top, left, behavior: "instant" });
    scrolled.current = selection;
  }, [open, imageReady, selection, source, query, ranges, selected, scrollRef]);

  function move(delta) {
    if (!ranges.length) return;
    setSelection({
      source,
      query,
      index: (selected + delta + ranges.length) % ranges.length,
      scroll: true,
    });
  }
  const status = !supported
    ? "当前浏览器暂不支持页内查找，仍可预览与复制。"
    : text.state === "loading"
      ? "正在读取本页文字…"
      : text.state === "failed"
        ? "本页文字读取失败，可重新读取。"
        : ["empty", "unsupported"].includes(text.state)
          ? "本页没有可查找文字。"
          : !query.trim()
            ? "仅查找当前页"
            : ranges.length
              ? `${selected + 1} / ${ranges.length} 处`
              : "本页无匹配";
  return (
    <ModulePresence
      present={open}
      mode="collapse"
      className="res-find-presence"
    >
      <div className="res-page-find" role="search" aria-label="查找本页">
        <style>{`.res-pdf-text::highlight(${allName}) { background-color: #facc1566; color: transparent; }
          .res-pdf-text::highlight(${currentName}) { background-color: #fb923c99; color: transparent; }`}</style>
        <label className="res-find-input">
          <Icon name="search" size={16} />
          <input
            ref={input}
            aria-label="查找本页文字"
            placeholder="查找本页文字"
            value={query}
            maxLength={200}
            disabled={!supported}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelection({
                source,
                query: event.target.value,
                index: 0,
                scroll: true,
              });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                move(event.shiftKey ? -1 : 1);
              }
            }}
          />
        </label>
        <span className="res-find-status" role="status" aria-live="polite">
          {status}
        </span>
        <div className="res-find-actions">
          <button
            type="button"
            className="res-icon-button"
            aria-label="上一处匹配"
            title="上一处匹配（Shift+Enter）"
            disabled={!ranges.length}
            onClick={() => move(-1)}
          >
            <Icon name="arrowLeft" size={16} />
          </button>
          <button
            type="button"
            className="res-icon-button"
            aria-label="下一处匹配"
            title="下一处匹配（Enter）"
            disabled={!ranges.length}
            onClick={() => move(1)}
          >
            <Icon name="arrowRight" size={16} />
          </button>
          <button
            type="button"
            className="res-icon-button"
            aria-label="关闭页内查找"
            title="关闭页内查找（Esc）"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    </ModulePresence>
  );
}
