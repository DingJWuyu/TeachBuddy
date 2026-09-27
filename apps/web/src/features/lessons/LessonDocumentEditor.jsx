import {
  Fragment,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { supportedDocument } from "@refatos/shared";
import { PUBLIC_AUTH } from "../auth/AuthProvider.jsx";
import { DocumentEditor, DocumentView } from "../workbench/materials/index.js";
import {
  parseInlineRuns,
  serializeInlineRuns,
} from "../workbench/documents.js";
import { Popover, MenuItem } from "../workbench/ModuleOverlays.jsx";
import { Icon } from "../workbench/icons.jsx";

const names = {
  paragraph: "段落",
  math: "公式",
  image: "图片",
  heading: "标题",
  list: "列表",
  table: "表格",
  "teacher-note": "教师注记",
};
const paragraph = () => ({ type: "paragraph", runs: [] });

// Keep the raw typing buffer until the user leaves it. Incomplete $...$ math
// and escaped dollar signs must not be rewritten on every input event.
function ParagraphInput({ block, label, placeholder, onChange }) {
  const serialized = serializeInlineRuns(block.runs);
  const emitted = useRef(serialized);
  const [text, setText] = useState(serialized);
  const ref = useRef(null);
  useEffect(() => {
    if (serialized !== emitted.current) {
      emitted.current = serialized;
      setText(serialized);
    }
  }, [serialized]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${Math.max(84, ref.current.scrollHeight + 2)}px`;
  }, [text]);
  return (
    <textarea
      ref={ref}
      className="lesson-writing-input"
      aria-label={label}
      placeholder={placeholder}
      rows={3}
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const runs = parseInlineRuns(next);
        emitted.current = serializeInlineRuns(runs);
        onChange({ ...block, runs });
      }}
    />
  );
}

export function LessonDocumentEditor({
  value,
  onChange,
  label,
  placeholder = "写下这一环节准备怎么讲，也可以加入题目或资料…",
  readOnly = false,
  renderBoundary,
}) {
  const auth = useContext(PUBLIC_AUTH);
  const pending = useRef(null),
    picker = useRef(null),
    root = useRef(null),
    focusBlock = useRef(null);
  const [upload, setUpload] = useState(null),
    [error, setError] = useState("");
  const latest = useRef(value);
  latest.current = value;
  const blocks = value.blocks.length ? value.blocks : [paragraph()];
  useLayoutEffect(() => {
    if (focusBlock.current === null) return;
    const field = root.current
      ?.querySelectorAll("[data-lesson-block]")
      [focusBlock.current]?.querySelector("textarea, input");
    field?.focus();
    focusBlock.current = null;
  }, [value.blocks.length]);
  const commit = (next, edit) =>
    onChange({
      version:
        latest.current.version === 2 ||
        next.some((block) => !["paragraph", "math"].includes(block.type))
          ? 2
          : 1,
      blocks: next,
    }, edit);
  const pick = () =>
    new Promise((resolve) => {
      pending.current = resolve;
      picker.current.click();
    });
  async function send(input) {
    setError("");
    setUpload(input);
    try {
      const body = new FormData();
      body.append("file", input.file);
      const response = await auth.request("/api/workbench/files", {
        method: "POST",
        headers: { "X-TeachBuddy-Request": "1", "Idempotency-Key": input.key },
        body,
      });
      if (!response.ok) throw new Error("图片尚未确认保存，请重试确认");
      const file = await response.json();
      if (!file.id) throw new Error("图片保存结果无法识别");
      pending.current?.(file);
      pending.current = null;
      setUpload(null);
    } catch (problem) {
      setError(problem.message);
    }
  }
  async function append(type) {
    let block;
    if (type === "paragraph") block = paragraph();
    if (type === "math") block = { type, latex: "" };
    if (type === "heading") block = { type, level: 1, runs: [] };
    if (type === "list")
      block = {
        type,
        role: "plain",
        items: [{ label: "", blocks: [paragraph()] }],
      };
    if (type === "table")
      block = { type, rows: [[{ blocks: [] }, { blocks: [] }]] };
    if (type === "teacher-note") block = { type, blocks: [paragraph()] };
    if (type === "image") {
      const file = await pick();
      if (!file) return;
      block = { type, fileId: file.id, alt: "", widthMm: 100 };
    }
    const next = [...latest.current.blocks, block];
    focusBlock.current = next.length - 1;
    commit(next, { index: next.length - 1, remove: 0, insert: 1 });
  }
  function arrange(index, offset) {
    const next = [...blocks];
    if (offset === null) next.splice(index, 1);
    else
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
    commit(next, offset === null ? { index, remove: 1, insert: 0 } : { index, moveTo: index + offset });
  }
  if (readOnly || !supportedDocument(value))
    return <DocumentView value={value} />;
  const counts = {};
  return (
    <div
      ref={root}
      className="lesson-document-editor"
      data-document-editor={label}
    >
      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onCancel={() => {
          pending.current?.(null);
          pending.current = null;
        }}
        onChange={(event) => {
          const file = event.target.files[0];
          if (file) send({ file, key: crypto.randomUUID() });
          else {
            pending.current?.(null);
            pending.current = null;
          }
          event.target.value = "";
        }}
      />
      {renderBoundary?.(0)}
      {blocks.map((block, index) => {
        counts[block.type] = (counts[block.type] ?? 0) + 1;
        const blockLabel = `${label}${names[block.type]} ${counts[block.type]}`;
        return (
          <Fragment key={`${index}:${block.type}`}><div
            className="lesson-edit-block"
            role={block.type === "paragraph" ? undefined : "group"}
            aria-label={
              block.type === "paragraph" ? undefined : `${blockLabel}内容块`
            }
            data-lesson-block={block.type}
            key={`${index}:${block.type}`}
          >
            {block.type === "paragraph" ? (
              <ParagraphInput
                block={block}
                label={blockLabel}
                placeholder={placeholder}
                onChange={(next) =>
                  commit(blocks.map((item, i) => (i === index ? next : item)))
                }
              />
            ) : (
              <div className="lesson-structured-block">
                <DocumentEditor
                  label={label}
                  value={{ version: value.version, blocks: [block] }}
                  onPickImage={auth ? pick : undefined}
                  onChange={(next) =>
                    commit(
                      blocks.flatMap((item, i) =>
                        i === index ? next.blocks : [item],
                      ), { index, remove: 1, insert: next.blocks.length },
                    )
                  }
                />
              </div>
            )}
            {value.blocks.length > 0 && (
              <div className="lesson-block-menu">
                <Popover
                  label={`${names[block.type]}操作 ${counts[block.type]}`}
                >
                  {({ close }) => (
                    <>
                      <MenuItem
                        disabled={index === 0}
                        onClick={() => {
                          close();
                          arrange(index, -1);
                        }}
                      >
                        上移{names[block.type]}
                      </MenuItem>
                      <MenuItem
                        disabled={index === blocks.length - 1}
                        onClick={() => {
                          close();
                          arrange(index, 1);
                        }}
                      >
                        下移{names[block.type]}
                      </MenuItem>
                      <MenuItem
                        danger
                        icon="trash"
                        onClick={() => {
                          close();
                          arrange(index, null);
                        }}
                      >
                        删除{names[block.type]}
                      </MenuItem>
                    </>
                  )}
                </Popover>
              </div>
            )}
          </div>{value.blocks.length > 0 && renderBoundary?.(index + 1)}</Fragment>
        );
      })}
      <div className="lesson-document-tools">
        <Popover
          label="插入内容"
          icon={null}
          buttonClassName="wb-button lesson-insert-button"
          align="start"
        >
          {({ close }) =>
            Object.entries(names).map(([type, name]) => (
              <MenuItem
                key={type}
                disabled={type === "image" && !auth}
                onClick={() => {
                  close();
                  append(type);
                }}
              >
                {name}
              </MenuItem>
            ))
          }
        </Popover>
        <span>公式、图片、列表或教师注记</span>
      </div>
      {upload && (
        <div className="lesson-upload-feedback" role="status">
          {error || "正在保存图片…"}
          {error && (
            <>
              <button className="wb-button" onClick={() => send(upload)}>
                重试确认图片
              </button>
              <button
                className="wb-button"
                onClick={() => {
                  pending.current?.(null);
                  pending.current = null;
                  setUpload(null);
                  setError("");
                }}
              >
                取消
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
