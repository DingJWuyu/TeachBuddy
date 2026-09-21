import { useRef, useState } from "react";
import { Icon } from "../icons.jsx";
import { modulePath, navigate } from "../routes.js";
import { useWorkspace, newId } from "./context.js";
import { Button, Empty, IconButton, QuestionContent, Toolbar } from "./ui.jsx";

export default function BankPage() {
  const w = useWorkspace();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("read");
  const [selected, setSelected] = useState([]);
  const [split, setSplit] = useState(35);
  const [compareSplit, setCompareSplit] = useState(50);
  const [source, setSource] = useState(null);
  const [incoming, setIncoming] = useState("");
  const inputRef = useRef(null);
  const splitRef = useRef(null);
  const question =
    w.questions.find((item) => item.id === w.questionId) || w.questions[0];
  const original = w.questions.find((item) => item.id === question?.originalId);
  const list = w.questions.filter(
    (item) =>
      (w.tag === "全部题目" || item.tags.includes(w.tag)) &&
      (item.body + item.title + item.tags.join(" ")).includes(query),
  );
  function update(patch) {
    w.setQuestions((items) =>
      items.map((item) =>
        item.id === question.id ? { ...item, ...patch } : item,
      ),
    );
  }
  function copyQuestion() {
    const copy = {
      ...question,
      id: newId("q"),
      title: question.title + " · 改编",
      originalId: question.id,
    };
    w.setQuestions((items) => [...items, copy]);
    w.setQuestionId(copy.id);
    setMode("compare");
  }
  function createQuestion() {
    const item = {
      id: newId("q"),
      title: "新题目",
      body: "",
      answer: "",
      analysis: "",
      note: "",
      tags: [],
      source: "个人编写",
    };
    w.setQuestions((items) => [...items, item]);
    w.setQuestionId(item.id);
    setMode("edit");
  }
  async function importSource(event) {
    const file = event.target.files[0];
    if (!file) return;
    setSource({ name: file.name, type: file.type, url: w.fileUrl(file) });
    if (file.type.startsWith("text/")) setIncoming(await file.text());
    else setIncoming("");
  }
  function saveIncoming() {
    if (!incoming.trim()) return;
    const item = {
      id: newId("q"),
      title: incoming.trim().split("\n")[0].slice(0, 24),
      body: incoming.trim(),
      sourceBody: incoming.trim(),
      answer: "",
      analysis: "",
      note: "",
      tags: [],
      source: source?.name || "文字收录",
      sourceUrl: source?.url,
      sourceType: source?.type,
    };
    w.setQuestions((items) => [...items, item]);
    w.setQuestionId(item.id);
    setMode("read");
    setIncoming("");
    setSource(null);
  }
  const comparing =
    mode === "source" || mode === "compare" || mode === "collect";
  return (
    <div className="wb-module">
      <Toolbar title="题库" trail={w.tag}>
        <Button icon="plus" onClick={createQuestion}>
          自建题目
        </Button>
        <Button primary icon="upload" onClick={() => setMode("collect")}>
          收录题目
        </Button>
      </Toolbar>
      <div
        ref={splitRef}
        className={"wb-bank-split" + (comparing ? " is-comparing" : "")}
        style={{ "--wb-split": (comparing ? compareSplit : split) + "%" }}
      >
        <section className="wb-source wb-surface" hidden={!comparing}>
          <div className="wb-section-head">
            <span>{mode === "compare" ? "原题" : "原始材料"}</span>
            <IconButton
              icon="arrowLeft"
              label="返回找题"
              onClick={() => setMode("read")}
            />
          </div>
          <div className="wb-scroll wb-paper-pad">
            {mode === "collect" ? (
              <>
                <input
                  ref={inputRef}
                  hidden
                  type="file"
                  accept="image/*,.pdf,.txt"
                  onChange={importSource}
                />
                {source ? (
                  <>
                    <p className="wb-secondary">{source.name}</p>
                    {source.type.startsWith("image/") ? (
                      <img
                        className="wb-source-image"
                        src={source.url}
                        alt="收录的原始材料"
                      />
                    ) : source.type === "application/pdf" ? (
                      <iframe
                        className="wb-file-frame"
                        title="原始 PDF"
                        src={source.url}
                      />
                    ) : (
                      <div className="wb-paper">{incoming}</div>
                    )}
                  </>
                ) : (
                  <div className="wb-import-surface">
                    <Icon name="upload" size={28} />
                    <h2>把好题收进来</h2>
                    <p>图片、PDF 或文字材料</p>
                    <Button onClick={() => inputRef.current?.click()}>
                      选择原始材料
                    </Button>
                  </div>
                )}
                {source && (
                  <Button onClick={() => inputRef.current?.click()}>
                    更换材料
                  </Button>
                )}
              </>
            ) : (
              <div className="wb-paper">
                <span className="wb-eyebrow">
                  {mode === "compare" ? original?.source : question.source}
                </span>
                {mode === "source" && question.sourceUrl ? (
                  question.sourceType?.startsWith("image/") ? (
                    <img
                      className="wb-source-image"
                      src={question.sourceUrl}
                      alt="题目原稿"
                    />
                  ) : (
                    <iframe
                      className="wb-file-frame"
                      title="题目原始文件"
                      src={question.sourceUrl}
                    />
                  )
                ) : (
                  <QuestionContent
                    question={
                      original || {
                        ...question,
                        body: question.sourceBody || question.body,
                      }
                    }
                  />
                )}
              </div>
            )}
          </div>
        </section>
        <section className="wb-question-list wb-surface" hidden={comparing}>
          <div className="wb-list-search">
            <Icon name="search" size={16} />
            <input
              aria-label="搜索题目"
              placeholder="搜索题干、标题或标签"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="wb-list-caption">
            <span>{list.length} 道题目</span>
            {selected.length > 0 && (
              <Button
                onClick={() =>
                  w.setPicker({
                    kind: "destination",
                    resourceKind: "questions",
                    ids: selected,
                  })
                }
              >
                选用 {selected.length} 题
              </Button>
            )}
          </div>
          <div className="wb-scroll" aria-label="题目列表">
            {list.map((item, index) => (
              <div
                className={
                  "wb-question-row" +
                  (question.id === item.id ? " is-selected" : "")
                }
                key={item.id}
              >
                <input
                  type="checkbox"
                  aria-label={"选择 " + item.title}
                  checked={selected.includes(item.id)}
                  onChange={(event) =>
                    setSelected((ids) =>
                      event.target.checked
                        ? [...ids, item.id]
                        : ids.filter((id) => id !== item.id),
                    )
                  }
                />
                <button
                  className="wb-question-select"
                  onClick={() => {
                    w.setQuestionId(item.id);
                    setMode("read");
                  }}
                >
                  <span className="wb-eyebrow">
                    {String(index + 1).padStart(2, "0")} · {item.source}
                  </span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <div className="wb-tags">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </button>
              </div>
            ))}
            {!list.length && (
              <Empty title="没有找到相应题目">试试其他关键词或分类。</Empty>
            )}
          </div>
        </section>
        <div
          className="wb-divider"
          role="separator"
          aria-label="调整题目区域宽度"
          aria-orientation="vertical"
          aria-valuemin={25}
          aria-valuemax={comparing ? 75 : 55}
          aria-valuenow={comparing ? compareSplit : split}
          tabIndex={0}
          onKeyDown={(event) => {
            if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
              event.preventDefault();
              (comparing ? setCompareSplit : setSplit)((n) =>
                Math.min(
                  comparing ? 75 : 55,
                  Math.max(25, n + (event.key === "ArrowRight" ? 2 : -2)),
                ),
              );
            }
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (
              event.currentTarget.hasPointerCapture(event.pointerId) &&
              splitRef.current
            ) {
              const box = splitRef.current.getBoundingClientRect();
              (comparing ? setCompareSplit : setSplit)(
                Math.max(
                  25,
                  Math.min(
                    comparing ? 75 : 55,
                    ((event.clientX - box.left) / box.width) * 100,
                  ),
                ),
              );
            }
          }}
        />
        <section className="wb-current-question wb-surface">
          <div className="wb-section-head">
            <span>
              {mode === "collect"
                ? "题目内容"
                : mode === "compare"
                  ? "改编题"
                  : "当前题目"}
            </span>
            <div className="wb-actions">
              {mode === "collect" ? (
                <Button
                  primary
                  disabled={!incoming.trim()}
                  onClick={saveIncoming}
                >
                  保存题目
                </Button>
              ) : (
                <>
                  <IconButton
                    icon="copy"
                    label="复制修改"
                    onClick={copyQuestion}
                  />
                  <IconButton
                    icon="file"
                    label="查看原始材料"
                    onClick={() =>
                      setMode(mode === "source" ? "read" : "source")
                    }
                  />
                  <Button
                    icon="pencil"
                    onClick={() =>
                      setMode(
                        mode === "edit" || mode === "compare" ? "read" : "edit",
                      )
                    }
                  >
                    {mode === "edit" || mode === "compare"
                      ? "完成编辑"
                      : "编辑"}
                  </Button>
                  <Button
                    primary
                    onClick={() =>
                      w.setPicker({
                        kind: "destination",
                        resourceKind: "questions",
                        ids: [question.id],
                      })
                    }
                  >
                    加入备课
                  </Button>
                </>
              )}
            </div>
          </div>
          <div
            className="wb-scroll wb-question-reading"
            aria-label="当前题目内容"
          >
            {mode === "collect" ? (
              <label className="wb-field">
                整理题目
                <textarea
                  rows={15}
                  placeholder="粘贴或输入题干、选项与小问"
                  value={incoming}
                  onChange={(event) => setIncoming(event.target.value)}
                />
              </label>
            ) : (
              <>
                <div className="wb-eyebrow">{question.source}</div>
                {mode === "edit" || mode === "compare" ? (
                  <>
                    <label className="wb-field">
                      题目名称
                      <input
                        value={question.title}
                        onChange={(event) =>
                          update({ title: event.target.value })
                        }
                      />
                    </label>
                    <label className="wb-field">
                      题干
                      <textarea
                        rows={8}
                        value={question.body}
                        onChange={(event) =>
                          update({ body: event.target.value })
                        }
                      />
                    </label>
                    <label className="wb-field">
                      答案
                      <textarea
                        rows={3}
                        value={question.answer}
                        onChange={(event) =>
                          update({ answer: event.target.value })
                        }
                      />
                    </label>
                    <label className="wb-field">
                      解析
                      <textarea
                        rows={4}
                        value={question.analysis}
                        onChange={(event) =>
                          update({ analysis: event.target.value })
                        }
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <h2>{question.title}</h2>
                    <QuestionContent question={question} />
                  </>
                )}
                <div className="wb-note-block">
                  <label className="wb-field">
                    我的教学笔记
                    <textarea
                      value={question.note}
                      rows={3}
                      placeholder="记下这道题值得再用的地方……"
                      onChange={(event) => update({ note: event.target.value })}
                    />
                  </label>
                </div>
                <div className="wb-tags">
                  {w.tags.map((tag) => (
                    <button
                      key={tag}
                      className={question.tags.includes(tag) ? "is-picked" : ""}
                      onClick={() =>
                        update({
                          tags: question.tags.includes(tag)
                            ? question.tags.filter((t) => t !== tag)
                            : [...question.tags, tag],
                        })
                      }
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {original && (
                  <Button
                    icon="link"
                    onClick={() => {
                      w.setQuestionId(original.id);
                      setMode("read");
                    }}
                  >
                    查看原题：{original.title}
                  </Button>
                )}
                <div className="wb-used-in">
                  <span className="wb-eyebrow">用于备课</span>
                  {w.lessons
                    .filter((lesson) =>
                      lesson.blocks.some((block) =>
                        block.questions.includes(question.id),
                      ),
                    )
                    .map((lesson) => (
                      <Button
                        key={lesson.id}
                        onClick={() => {
                          w.setLessonId(lesson.id);
                          navigate(modulePath("prep"));
                        }}
                      >
                        {lesson.title}
                      </Button>
                    ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
