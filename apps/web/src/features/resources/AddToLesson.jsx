import React, { useEffect, useRef, useState } from "react";
import { referenceInputFrom as inputReference } from '../lessons/model.js';
export function AddToLesson({ client, resources, onSave, onClose, disabled }) {
  const sequence = useRef(0);
  const [selectedId, setSelectedId] = useState("");
  const [lessons, setLessons] = useState([]),
    [lesson, setLesson] = useState(null),
    [section, setSection] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    client
      .request("/api/modules/lessons/v3")
      .then((r) => active && setLessons(r.items))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
      sequence.current++;
    };
  }, [client]);
  async function choose(id) {
    const request = ++sequence.current;
    setSelectedId(id);
    setError("");
    setLesson(null);
    setSection("");
    if (!id) return;
    try {
      const result = await client.request(
        `/api/modules/lessons/v3/${id}`,
      );
      if (request === sequence.current) setLesson(result);
    } catch (e) {
      if (request === sequence.current) setError(e.message);
    }
  }
  function save() {
    if (
      !lesson ||
      lesson.id !== selectedId ||
      (section && !lesson.sections.some((s) => s.id === section))
    )
      return;
    const refs = resources.map((r) => ({
      id: crypto.randomUUID(),
      kind: "resource",
      resourceId: r.id,
      resourceVersion: r.version,
      note: "",
    }));
    const input = {
      baseVersion: lesson.version,
      title: lesson.title,
      intro: lesson.intro,
      sections: lesson.sections.map((s) => ({
        ...s,
        references: [
          ...s.references.map(inputReference),
          ...(section === s.id ? refs : []),
        ],
      })),
      materials: [
        ...lesson.materials.map(inputReference),
        ...(!section ? refs : []),
      ],
    };
    onSave(lesson.id, input);
  }
  return (
    <div className="res-overlay">
      <div className="res-dialog" role="dialog" aria-label="加入备课">
        <h2>加入备课</h2>
        {error && <p role="alert">{error}</p>}
        <label>
          选择备课
          <select
            aria-label="选择备课"
            value={selectedId}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">请选择</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
        {!lessons.length && !error && <p>还没有备课，请先新建备课。</p>}
        {lesson && (
          <label>
            放入位置
            <select
              aria-label="放入位置"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">备用材料</option>
              {lesson.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="res-actions">
          <button disabled={disabled || !lesson} onClick={save}>
            确认加入
          </button>
          <button onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}
