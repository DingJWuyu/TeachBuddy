import { useState } from "react";
import { useWorkspace, newId } from "./context.js";
import { TODAY } from "./data.js";
import { Button, Empty, Toolbar } from "./ui.jsx";

export default function TeachingPage() {
  const w = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
  const draft = drafts[w.className] || {
    text: "",
    progress: "",
    date: TODAY,
  };
  function change(patch) {
    setDrafts((items) => ({ ...items, [w.className]: { ...draft, ...patch } }));
  }
  const records = w.records
    .filter((item) => item.className === w.className)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = records.find((item) => item.progress);
  function save() {
    if (!draft.text.trim() && !draft.progress.trim()) return;
    w.setRecords((items) => [
      {
        ...draft,
        id: newId("record"),
        className: w.className,
        title: "课堂随记",
      },
      ...items,
    ]);
    change({ text: "", progress: "" });
    setEditing(false);
  }
  return (
    <div className="wb-module">
      <Toolbar title="班级教学" trail={w.className}>
        <Button primary icon="plus" onClick={() => setEditing((open) => !open)}>
          记一笔
        </Button>
      </Toolbar>
      <div className="wb-scroll wb-teaching-scroll">
        <div className="wb-teaching-inner">
          <div className="wb-class-title">
            <span className="wb-eyebrow">教学记录</span>
            <h2>{w.className}</h2>
            <p>把课堂里值得记住的事情留下来。</p>
          </div>
          {latest && (
            <section className="wb-latest-progress">
              <span className="wb-eyebrow">最近教到</span>
              <strong>{latest.progress}</strong>
              <span>{latest.date}</span>
            </section>
          )}
          {editing && (
            <section className="wb-record-editor">
              <textarea
                aria-label="课堂随记"
                autoFocus
                rows={4}
                placeholder="今天讲到哪里？学生在哪一步卡住了？也可以只记一句……"
                value={draft.text}
                onChange={(event) => change({ text: event.target.value })}
              />
              <input
                aria-label="实际教学位置"
                placeholder="补充实际教学位置（可选）"
                value={draft.progress}
                onChange={(event) => change({ progress: event.target.value })}
              />
              <div className="wb-record-options">
                <input
                  type="date"
                  aria-label="记录日期"
                  value={draft.date}
                  onChange={(event) => change({ date: event.target.value })}
                />
                <Button
                  primary
                  onClick={save}
                  disabled={!draft.text.trim() && !draft.progress.trim()}
                >
                  保存记录
                </Button>
              </div>
            </section>
          )}
          <div className="wb-records">
            {records.map((record) => (
              <article className="wb-record" key={record.id}>
                <span className="wb-record-dot" />
                <time>{record.date}</time>
                <h3>{record.title}</h3>
                {record.progress && (
                  <div className="wb-record-position">{record.progress}</div>
                )}
                <p>{record.text}</p>
              </article>
            ))}
            {!records.length && (
              <Empty title="从第一条课堂记录开始">
                课间的一句话，也能帮助下一次教学。
              </Empty>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
