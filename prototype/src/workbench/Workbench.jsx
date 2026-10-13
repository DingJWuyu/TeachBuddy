// A single agreed layout in the existing source prototype. No variant switcher.
import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons.jsx";
import { CALENDAR_PATH, HOME_PATH, navigate } from "../routes.js";
import { EmptyPage, UnknownPage } from "../pages.jsx";
import { useWorkspace } from "./context.js";
import { CLASSES } from "./data.js";
import { Button, IconButton } from "./ui.jsx";
import BankPage from "./BankPage.jsx";
import ResourcesPage from "./ResourcesPage.jsx";
import TeachingPage from "./TeachingPage.jsx";
import StudioPage from "./StudioPage.jsx";
import SchedulePage, { ScheduleTools } from "./SchedulePage.jsx";
import "./workbench.css";

function ManagedList({
  title,
  values,
  selected,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  all,
  icon = "folder",
  protectedValues = [],
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  return (
    <div className="wb-managed-list">
      <div className="wb-section-head">
        <strong>{title}</strong>
        <span className="wb-secondary">{values.length}</span>
      </div>
      <button
        className={"wb-nav-item" + (selected === all ? " is-active" : "")}
        onClick={() => onSelect(all)}
      >
        <Icon name="inbox" size={17} />
        <span>{all}</span>
      </button>
      {values.map((value) => (
        <div className="wb-managed-row" key={value}>
          {editing === value ? (
            <form
              className="wb-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  name.trim() &&
                  (!values.includes(name.trim()) || name.trim() === value)
                ) {
                  onRename(value, name.trim());
                  setEditing(null);
                }
              }}
            >
              <input
                aria-label={"重命名 " + value}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="wb-icon-button"
                aria-label="确认重命名"
              >
                ✓
              </button>
            </form>
          ) : (
            <>
              <button
                className={
                  "wb-nav-item" + (selected === value ? " is-active" : "")
                }
                onClick={() => onSelect(value)}
              >
                <Icon name={icon} size={17} />
                <span>{value}</span>
              </button>
              <div className="wb-managed-actions">
                <IconButton
                  icon="pencil"
                  label={"重命名 " + value}
                  onClick={() => {
                    setEditing(value);
                    setName(value);
                  }}
                />
                <IconButton
                  icon="close"
                  label={"删除分类 " + value}
                  disabled={protectedValues.includes(value)}
                  onClick={() => onDelete(value)}
                />
              </div>
            </>
          )}
        </div>
      ))}
      <form
        className="wb-inline-form wb-create-category"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            draft.trim() &&
            !values.includes(draft.trim()) &&
            draft.trim() !== all
          ) {
            onCreate(draft.trim());
            setDraft("");
          }
        }}
      >
        <input
          aria-label={"新建" + title}
          placeholder={"新建" + title}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          className="wb-icon-button"
          type="submit"
          aria-label={"保存新" + title}
        >
          ＋
        </button>
      </form>
    </div>
  );
}

function BankTools() {
  const w = useWorkspace();
  function rename(old, name) {
    w.setTags((tags) => tags.map((tag) => (tag === old ? name : tag)));
    w.setQuestions((items) =>
      items.map((item) => ({
        ...item,
        tags: item.tags.map((tag) => (tag === old ? name : tag)),
      })),
    );
    if (w.tag === old) w.setTag(name);
  }
  function remove(name) {
    w.setTags((tags) => tags.filter((tag) => tag !== name));
    w.setQuestions((items) =>
      items.map((item) => ({
        ...item,
        tags: item.tags.filter((tag) => tag !== name),
      })),
    );
    if (w.tag === name) w.setTag("全部题目");
  }
  return (
    <ManagedList
      title="我的标签"
      values={w.tags}
      selected={w.tag}
      all="全部题目"
      onSelect={w.setTag}
      onCreate={(name) => w.setTags((tags) => [...tags, name])}
      onRename={rename}
      onDelete={remove}
      icon="tag"
    />
  );
}
function ResourceTools() {
  const w = useWorkspace();
  const folders = [
    ...new Set([...w.folders, ...w.resources.map((item) => item.folder)]),
  ];
  function rename(old, name) {
    w.setFolders((items) => [
      ...new Set([...items.filter((item) => item !== old), name]),
    ]);
    w.setResources((items) =>
      items.map((item) =>
        item.folder === old ? { ...item, folder: name } : item,
      ),
    );
    if (w.folder === old) w.setFolder(name);
  }
  function remove(name) {
    w.setFolders((items) => items.filter((item) => item !== name));
    w.setResources((items) =>
      items.map((item) =>
        item.folder === name ? { ...item, folder: "未分类" } : item,
      ),
    );
    if (w.folder === name) w.setFolder("全部资源");
  }
  return (
    <ManagedList
      title="资源分类"
      protectedValues={["未分类"]}
      values={folders}
      selected={w.folder}
      all="全部资源"
      onSelect={w.setFolder}
      onCreate={(name) => w.setFolders((items) => [...items, name])}
      onRename={rename}
      onDelete={remove}
    />
  );
}
function ClassTools() {
  const w = useWorkspace();
  return (
    <>
      <div className="wb-section-head">
        <strong>我的班级</strong>
      </div>
      {CLASSES.map((name) => (
        <button
          className={"wb-nav-item" + (w.className === name ? " is-active" : "")}
          key={name}
          onClick={() => w.setClassName(name)}
        >
          <Icon name="classes" size={17} />
          <span>{name}</span>
        </button>
      ))}
    </>
  );
}
function StudioTools() {
  const w = useWorkspace();
  return (
    <>
      <div className="wb-section-head">
        <strong>我的作品</strong>
      </div>
      {w.works.map((work) => (
        <button
          key={work.id}
          className={
            "wb-nav-item wb-work-nav" +
            (work.id === w.workId ? " is-active" : "")
          }
          onClick={() => w.setWorkId(work.id)}
        >
          <Icon name="graph" size={17} />
          <span>
            {work.name}
            <small>{work.type}</small>
          </span>
        </button>
      ))}
      <div className="wb-tool-divider" />
      <Button icon="sparkles" onClick={w.openAssistant}>
        和 AI 讨论制作思路
      </Button>
    </>
  );
}

function Agent({ home, context, returnPath }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const conversation = useRef(null);
  useEffect(() => {
    if (messages.length)
      conversation.current?.scrollTo({
        top: conversation.current.scrollHeight,
        behavior: "smooth",
      });
  }, [messages.length]);
  function submit(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    // Deterministic local dialogue for reviewing layout; no model is called.
    const reply =
      "可以先把目标说具体：希望学生观察到什么、怎样表达，再用一道问题检查理解。" +
      (context
        ? "\n\n围绕「" +
          context +
          "」，我们可以从已有材料出发，梳理讲解顺序，再补充一个能引出讨论的追问。"
        : "\n\n把正在准备的课题或一段思路发给我，我们接着讨论。");
    setMessages((items) => [
      ...items,
      { role: "user", text: draft.trim() },
      { role: "assistant", text: reply },
    ]);
    setDraft("");
  }
  return (
    <div
      className={
        "wb-agent" +
        (home ? " is-full" : "") +
        (!messages.length ? " is-new" : "")
      }
    >
      <div className="wb-agent-top">
        <span>
          <Icon name="sparkles" size={16} />
          教学助理
        </span>
        {home ? (
          returnPath && (
            <Button icon="arrowLeft" onClick={() => navigate(returnPath)}>
              返回工作
            </Button>
          )
        ) : (
          <IconButton
            icon="expand"
            label="在首页展开助理"
            onClick={() => navigate(HOME_PATH)}
          />
        )}
      </div>
      <div
        className="wb-scroll wb-conversation"
        ref={conversation}
        aria-label="AI 对话"
      >
        <div className="wb-conversation-inner">
          {!messages.length ? (
            <div className="wb-agent-welcome">
              <div className="wb-agent-mark">
                <Icon name="sparkles" size={30} />
              </div>
              <h2>{home ? "今天，想从哪里开始？" : "一起想想这节课"}</h2>
              <p>
                {home
                  ? "从一道好题、一个想法，开始准备下一节课。"
                  : "把问题和思路放在这里，手边的工作继续保留。"}
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={index} className={"wb-message is-" + message.role}>
                <span>{message.role === "user" ? "我" : "教学助理"}</span>
                <p>{message.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="wb-composer-area">
        {context && (
          <div className="wb-context-chip">
            <Icon name="link" size={13} />
            <span>{context}</span>
          </div>
        )}
        <form className="wb-composer" onSubmit={submit}>
          <textarea
            id="wb-agent-input"
            aria-label="向教学助理提问"
            rows={3}
            placeholder="聊聊教学思路，或带上一道题……"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit(event);
              }
            }}
          />
          <div className="wb-composer-bottom">
            <span>教学助理</span>
            <button
              type="submit"
              className="wb-send"
              disabled={!draft.trim()}
              aria-label="发送给教学助理"
            >
              <Icon name="arrowUp" size={18} />
            </button>
          </div>
        </form>
        {!messages.length && home && (
          <div className="wb-prompt-suggestions">
            {[
              "梳理一节课的讲解顺序",
              "讨论一道题的不同讲法",
              "构思一个数学演示",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setDraft(prompt);
                  document.getElementById("wb-agent-input")?.focus();
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Workbench({ page }) {
  const w = useWorkspace();
  const home = page.path === HOME_PATH;
  const key = page.path === CALENDAR_PATH ? "schedule" : page.moduleId;
  const lastPath = useRef(null);
  const lastContext = useRef("");
  const context =
    key === "bank"
      ? w.questions.find((item) => item.id === w.questionId)?.title
      : key === "classes"
        ? w.className
        : key === "resources"
          ? w.folder
          : key === "studio"
            ? w.works.find((item) => item.id === w.workId)?.name
            : key === "schedule"
              ? w.schedule.start + " · " + w.schedule.days + " 天日程"
              : "";
  if (!home) {
    lastPath.current = page.path;
    lastContext.current = context;
  }
  const label =
    {
      bank: "分类",
      resources: "分类",
      studio: "作品",
      classes: "班级",
      schedule: "日程",
    }[key] || "工具";
  return (
    <div
      className={
        "wb-layout" +
        (home ? " is-home" : "") +
        (w.panelOpen ? " has-panel" : "")
      }
    >
      <div className="wb-stage" hidden={home}>
        <IconButton
          icon="panelOpen"
          label={w.panelOpen ? "收起右侧辅助栏" : "展开右侧辅助栏"}
          aria-pressed={w.panelOpen}
          onClick={() => w.setPanelOpen((open) => !open)}
        />
        <div className="wb-page-frame" hidden={key !== "bank"}>
          <BankPage />
        </div>
        <div className="wb-page-frame" hidden={key !== "studio"}>
          <StudioPage />
        </div>
        <div className="wb-page-frame" hidden={key !== "resources"}>
          <ResourcesPage />
        </div>
        <div className="wb-page-frame" hidden={key !== "classes"}>
          <TeachingPage />
        </div>
        <div className="wb-page-frame" hidden={key !== "schedule"}>
          <SchedulePage active={key === "schedule"} />
        </div>
        {!key &&
          (page.kind === "unknown" ? (
            <UnknownPage path={page.path} />
          ) : (
            <EmptyPage title={page.title} icon={page.icon} />
          ))}
      </div>
      <aside
        className={"wb-right" + (home ? " is-agent-home" : "")}
        hidden={!home && !w.panelOpen}
        aria-label={home ? "Agent 工作区" : "工作辅助栏"}
      >
        <div className="wb-right-header" hidden={home}>
          <div className="wb-right-tabs">
            <button
              aria-pressed={w.panelMode === "tools"}
              onClick={() => w.setPanelMode("tools")}
            >
              {label}
            </button>
            <button
              aria-pressed={w.panelMode === "ai"}
              onClick={w.openAssistant}
            >
              <Icon name="sparkles" size={14} />
              AI 助理
            </button>
          </div>
          <IconButton
            icon="close"
            label="关闭右侧辅助栏"
            onClick={() => w.setPanelOpen(false)}
          />
        </div>
        <div className="wb-tools" hidden={home || w.panelMode !== "tools"}>
          <div className="wb-tool-page wb-scroll" hidden={key !== "bank"}>
            <BankTools />
          </div>
          <div className="wb-tool-page wb-scroll" hidden={key !== "resources"}>
            <ResourceTools />
          </div>
          <div className="wb-tool-page wb-scroll" hidden={key !== "classes"}>
            <ClassTools />
          </div>
          <div className="wb-tool-page wb-scroll" hidden={key !== "studio"}>
            <StudioTools />
          </div>
          <div className="wb-tool-page is-schedule" hidden={key !== "schedule"}>
            <ScheduleTools />
          </div>
        </div>
        <div className="wb-agent-holder" hidden={!home && w.panelMode !== "ai"}>
          <Agent
            home={home}
            context={home ? lastContext.current : context}
            returnPath={lastPath.current}
          />
        </div>
      </aside>
    </div>
  );
}
