import React, { useState, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import ResourcesPage from "../../../src/features/resources/index.jsx";
import { ShellContext } from "../../../src/features/workbench/shellContext.js";
import "./fixture.css";
import { Lesson } from "./Lesson.jsx";
const transport = window.fetch.bind(window);
function Fixture() {
  const [tools, setTools] = useState([]),
    [panel, setPanel] = useState(true);
  const [account, setAccount] = useState(null),
    [lesson, setLesson] = useState(false),
    [lost, setLost] = useState(false);
  useEffect(() => {
    fetch("/api/workbench/")
      .then((r) => r.json())
      .then((value) => setAccount(value.accountKey));
  }, []);
  const registerTools = useCallback((value) => setTools(value), []);
  if (!account || lost) return <p>{lost ? "请重新登录" : "正在读取账户"}</p>;
  return (
    <ShellContext.Provider
      value={{
        accountKey: account,
        generation: 1,
        registerTools,
        notifyIdentityLost: () => setLost(true),
      }}
    >
      <div className="fixture">
        <nav>
          <strong>TeachBuddy</strong>
          <span>教学工作台</span>
          <button onClick={() => setPanel((v) => !v)} aria-expanded={panel}>
            文件夹与标签
          </button>
        </nav>
        <div className="fixture-body">
          <main>
            {lesson ? (
              <Lesson transport={transport} onBack={() => setLesson(false)} />
            ) : (
              <ResourcesPage
                transport={transport}
                onOpenLesson={() => setLesson(true)}
              />
            )}
          </main>
          {panel && (
            <aside aria-label="辅助栏">
              {tools.map((t) => (
                <React.Fragment key={t.id}>{t.render()}</React.Fragment>
              ))}
            </aside>
          )}
        </div>
      </div>
    </ShellContext.Provider>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
