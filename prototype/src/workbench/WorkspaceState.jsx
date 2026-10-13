// Source prototype: in-memory teaching data and drafts, no model/OCR/backend.
// Providers outlive route changes. Document reload persistence is not simulated.
import { useEffect, useRef, useState } from "react";
import { WorkspaceContext } from "./context.js";
import {
  QUESTIONS,
  RESOURCES,
  TODAY,
  WORKS,
} from "./data.js";

export function WorkspaceProvider({ children }) {
  const [questions, setQuestions] = useState(() =>
    QUESTIONS.map((question) => ({ ...question, sourceBody: question.body })),
  );
  const [resources, setResources] = useState(RESOURCES);
  const [works, setWorks] = useState(WORKS);
  const [tags, setTags] = useState([
    "概念辨析",
    "课堂例题",
    "定义证明",
    "备用题",
  ]);
  const [folders, setFolders] = useState([
    "教学课件",
    "我的模板",
    "教学文档",
    "常用插图",
    "参考资料",
  ]);
  const [questionId, setQuestionId] = useState("q1");
  const [folder, setFolder] = useState("全部资源");
  const [tag, setTag] = useState("全部题目");
  const [workId, setWorkId] = useState("w1");
  const [panelMode, setPanelMode] = useState("tools");
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 1050);
  const [notifications, setNotifications] = useState([]);
  const [events, setEvents] = useState([
    {
      id: "e1",
      date: TODAY,
      start: 480,
      end: 525,
      title: "数学 · 函数的单调性",
      tasks: [{ id: "t1", text: "检查图象演示，带上导学案", priority: "普通" }],
      reminder: "",
    },
    {
      id: "e2",
      date: TODAY,
      start: 900,
      end: 990,
      title: "准备下一节课",
      tasks: [
        { id: "t2", text: "挑选概念辨析题", priority: "优先" },
        { id: "t3", text: "调整例题讲解顺序", priority: "普通" },
      ],
      reminder: "",
    },
  ]);
  const [schedule, setSchedule] = useState({
    start: TODAY,
    days: 5,
    selected: null,
  });
  const objectUrls = useRef([]);
  const delivered = useRef(new Set());
  useEffect(
    () => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  function fileUrl(file) {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    return url;
  }
  useEffect(() => {
    function checkReminders() {
      const now = Date.now();
      events.forEach((event) => {
        if (event.reminder === "") return;
        const due =
          new Date(event.date + "T00:00:00").getTime() +
          (event.end + Number(event.reminder)) * 60000;
        const key = event.id + ":" + due;
        if (due > now || delivered.current.has(key)) return;
        delivered.current.add(key);
        setNotifications((items) => [
          {
            id: key,
            eventId: event.id,
            icon: "calendar",
            text: event.title,
            time: new Date(due).toLocaleString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            read: false,
          },
          ...items,
        ]);
      });
    }
    checkReminders();
    const interval = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(interval);
  }, [events]);
  function openTools() {
    setPanelOpen(true);
    setPanelMode("tools");
  }
  function openAssistant() {
    setPanelMode("ai");
    setPanelOpen(true);
    requestAnimationFrame(() =>
      document.getElementById("wb-agent-input")?.focus(),
    );
  }
  const value = {
    questions,
    setQuestions,
    resources,
    setResources,
    works,
    setWorks,
    tags,
    setTags,
    folders,
    setFolders,
    questionId,
    setQuestionId,
    folder,
    setFolder,
    tag,
    setTag,
    workId,
    setWorkId,
    panelMode,
    setPanelMode,
    panelOpen,
    setPanelOpen,
    openTools,
    openAssistant,
    notifications,
    setNotifications,
    events,
    setEvents,
    schedule,
    setSchedule,
    fileUrl,
  };
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
