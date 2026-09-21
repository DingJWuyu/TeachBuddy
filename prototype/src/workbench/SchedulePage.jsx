import { useEffect, useRef, useState } from "react";
import { useWorkspace, newId } from "./context.js";
import { TODAY, dateKey, shiftDate } from "./data.js";
import { Button, Empty, IconButton, Toolbar } from "./ui.jsx";

export const timeText = (minutes) =>
  String(Math.floor(minutes / 60)).padStart(2, "0") +
  ":" +
  String(minutes % 60).padStart(2, "0");
const minuteValue = (text) =>
  text
    .split(":")
    .reduce((hours, minutes) => Number(hours) * 60 + Number(minutes));
const daysBetween = (a, b) =>
  Math.round(
    (new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000,
  );
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

function addEvent(w, date, start, end) {
  const event = {
    id: newId("event"),
    date,
    start,
    end,
    title: "新的安排",
    tasks: [],
    reminder: "",
  };
  w.setEvents((items) => [...items, event]);
  w.setSchedule((state) => ({ ...state, selected: event.id }));
  w.openTools();
}

export default function SchedulePage({ active }) {
  const w = useWorkspace();
  const [selection, setSelection] = useState(null);
  const drag = useRef(null);
  const scroller = useRef(null);
  const initialScroll = useRef(false);
  const days = Array.from({ length: w.schedule.days }, (_, index) =>
    shiftDate(w.schedule.start, index),
  );
  useEffect(() => {
    if (active && !initialScroll.current && scroller.current) {
      scroller.current.scrollTop = 7 * 64;
      initialScroll.current = true;
    }
  }, [active]);
  function position(event) {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(1425, Math.floor(((event.clientY - box.top) / 64) * 4) * 15),
    );
  }
  function shift(amount) {
    w.setSchedule((state) => ({
      ...state,
      start: shiftDate(state.start, amount),
    }));
  }
  return (
    <div className="wb-module">
      <Toolbar
        title="日程"
        trail={w.schedule.start + " 至 " + days[days.length - 1]}
      >
        <div className="wb-day-count">
          <input
            aria-label="显示天数"
            type="number"
            min="1"
            max="366"
            value={w.schedule.days}
            onChange={(event) =>
              w.setSchedule((state) => ({
                ...state,
                days: Math.min(
                  366,
                  Math.max(1, Number(event.target.value) || 1),
                ),
              }))
            }
          />
          <span>天</span>
        </div>
        <Button
          onClick={() => w.setSchedule((state) => ({ ...state, start: TODAY }))}
        >
          今天
        </Button>
        <IconButton
          icon="arrowLeft"
          label="前一段日期"
          onClick={() => shift(-w.schedule.days)}
        />
        <IconButton
          icon="arrowRight"
          label="后一段日期"
          onClick={() => shift(w.schedule.days)}
        />
        <Button
          primary
          icon="plus"
          onClick={() => addEvent(w, w.schedule.start, 900, 960)}
        >
          安排
        </Button>
      </Toolbar>
      <div
        className="wb-calendar-scroll"
        ref={scroller}
        aria-label="日程时间网格"
      >
        <div
          className="wb-calendar-grid"
          style={{
            gridTemplateColumns:
              "52px repeat(" + days.length + ", minmax(124px, 1fr))",
            minWidth: 52 + days.length * 124,
          }}
        >
          <div className="wb-calendar-corner" />
          {days.map((day) => {
            const date = new Date(day + "T12:00:00");
            return (
              <div
                key={day}
                className={
                  "wb-day-heading" + (day === TODAY ? " is-today" : "")
                }
              >
                <span>周{WEEK[date.getDay()]}</span>
                <strong>{date.getDate()}</strong>
              </div>
            );
          })}
          <div className="wb-hours">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour}>{timeText(hour * 60)}</div>
            ))}
          </div>
          {days.map((day) => (
            <div
              key={day}
              className="wb-time-column"
              aria-label={day + " 时间段"}
              onPointerDown={(event) => {
                if (event.target.closest("button") || event.button !== 0)
                  return;
                event.preventDefault();
                const start = position(event);
                drag.current = {
                  date: day,
                  anchor: start,
                  start,
                  end: start + 30,
                };
                setSelection(drag.current);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (
                  !drag.current ||
                  !event.currentTarget.hasPointerCapture(event.pointerId)
                )
                  return;
                const minute = position(event);
                drag.current = {
                  ...drag.current,
                  start: Math.min(drag.current.anchor, minute),
                  end: Math.min(
                    1440,
                    Math.max(drag.current.anchor, minute) + 15,
                  ),
                };
                setSelection(drag.current);
              }}
              onPointerUp={(event) => {
                if (
                  !drag.current ||
                  !event.currentTarget.hasPointerCapture(event.pointerId)
                )
                  return;
                const selected = drag.current;
                addEvent(w, selected.date, selected.start, selected.end);
                drag.current = null;
                setSelection(null);
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setSelection(null);
              }}
            >
              {w.events
                .filter((item) => item.date === day)
                .map((item) => (
                  <button
                    key={item.id}
                    className={
                      "wb-event" +
                      (w.schedule.selected === item.id ? " is-selected" : "")
                    }
                    style={{
                      top: (item.start / 60) * 64,
                      height: Math.max(26, ((item.end - item.start) / 60) * 64),
                    }}
                    onClick={() => {
                      w.setSchedule((state) => ({
                        ...state,
                        selected: item.id,
                      }));
                      w.openTools();
                    }}
                  >
                    <strong>{item.title || "新的安排"}</strong>
                    <span>
                      {timeText(item.start)} - {timeText(item.end)}
                    </span>
                    {item.tasks.length > 0 && (
                      <small>{item.tasks.length} 件事项</small>
                    )}
                  </button>
                ))}
              {selection?.date === day && (
                <div
                  className="wb-time-selection"
                  style={{
                    top: (selection.start / 60) * 64,
                    height: ((selection.end - selection.start) / 60) * 64,
                  }}
                >
                  {timeText(selection.start)} - {timeText(selection.end)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScheduleTools() {
  const w = useWorkspace();
  const [month, setMonth] = useState(TODAY.slice(0, 7) + "-01");
  useEffect(() => {
    setMonth(w.schedule.start.slice(0, 7) + "-01");
  }, [w.schedule.start]);
  const [taskDrafts, setTaskDrafts] = useState({});
  const [loose, setLoose] = useState([]);
  const [looseDraft, setLooseDraft] = useState("");
  const rangeAnchor = useRef(null);
  const date = new Date(month + "T12:00:00");
  const firstCell = shiftDate(month, -(date.getDay() + 6) % 7);
  const monthDays = Array.from({ length: 42 }, (_, index) =>
    shiftDate(firstCell, index),
  );
  const end = shiftDate(w.schedule.start, w.schedule.days - 1);
  const selected = w.events.find((item) => item.id === w.schedule.selected);
  function update(patch) {
    w.setEvents((items) =>
      items.map((item) =>
        item.id === selected.id ? { ...item, ...patch } : item,
      ),
    );
  }
  function monthShift(amount) {
    const next = new Date(month + "T12:00:00");
    next.setMonth(next.getMonth() + amount);
    setMonth(dateKey(next));
  }
  function rangeTo(day) {
    const anchor = rangeAnchor.current;
    if (!anchor) return;
    w.setSchedule((state) => ({
      ...state,
      start: anchor < day ? anchor : day,
      days: Math.abs(daysBetween(anchor, day)) + 1,
    }));
  }
  function taskChange(id, patch) {
    update({
      tasks: selected.tasks.map((task) =>
        task.id === id ? { ...task, ...patch } : task,
      ),
    });
  }
  function moveTask(index, direction) {
    const tasks = [...selected.tasks];
    const target = index + direction;
    if (target < 0 || target >= tasks.length) return;
    [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
    update({ tasks });
  }
  return (
    <div className="wb-schedule-tools">
      <div className="wb-month">
        <div className="wb-section-head">
          <strong>
            {date.getFullYear()} 年 {date.getMonth() + 1} 月
          </strong>
          <div className="wb-actions">
            <IconButton
              icon="arrowLeft"
              label="上一个月"
              onClick={() => monthShift(-1)}
            />
            <IconButton
              icon="arrowRight"
              label="下一个月"
              onClick={() => monthShift(1)}
            />
          </div>
        </div>
        <div
          className="wb-month-grid"
          onPointerUp={() => {
            rangeAnchor.current = null;
          }}
          onPointerLeave={() => {
            rangeAnchor.current = null;
          }}
        >
          {["一", "二", "三", "四", "五", "六", "日"].map((name) => (
            <span key={name}>{name}</span>
          ))}
          {monthDays.map((day) => (
            <button
              key={day}
              data-date={day}
              aria-label={day}
              aria-pressed={day >= w.schedule.start && day <= end}
              className={
                (day.startsWith(month.slice(0, 7)) ? "" : "is-other ") +
                (day >= w.schedule.start && day <= end ? "is-range " : "") +
                (day === TODAY ? "is-today" : "")
              }
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                rangeAnchor.current = day;
                rangeTo(day);
              }}
              onPointerEnter={(event) => {
                if (event.buttons === 1) rangeTo(day);
              }}
              onClick={(event) => {
                if (event.detail === 0)
                  w.setSchedule((state) => ({ ...state, start: day, days: 1 }));
              }}
            >
              {Number(day.slice(-2))}
            </button>
          ))}
        </div>
        <div className="wb-date-range">
          <input
            aria-label="日期范围开始"
            type="date"
            value={w.schedule.start}
            onChange={(event) => {
              if (event.target.value)
                w.setSchedule((state) => ({
                  ...state,
                  start: event.target.value,
                }));
            }}
          />
          <span>至</span>
          <input
            aria-label="日期范围结束"
            type="date"
            min={w.schedule.start}
            value={end}
            onChange={(event) => {
              if (event.target.value)
                w.setSchedule((state) => ({
                  ...state,
                  days: Math.max(
                    1,
                    daysBetween(state.start, event.target.value) + 1,
                  ),
                }));
            }}
          />
        </div>
      </div>
      <div className="wb-scroll wb-agenda-content" aria-label="安排与待办">
        {selected ? (
          <>
            <div className="wb-section-head">
              <span>时间段安排</span>
              <IconButton
                icon="close"
                label="返回安排概览"
                onClick={() =>
                  w.setSchedule((state) => ({ ...state, selected: null }))
                }
              />
            </div>
            <label className="wb-field">
              安排名称
              <input
                value={selected.title}
                onChange={(event) => update({ title: event.target.value })}
              />
            </label>
            <input
              aria-label="安排日期"
              type="date"
              value={selected.date}
              onChange={(event) => {
                if (event.target.value) update({ date: event.target.value });
              }}
            />
            <div className="wb-time-inputs">
              <label className="wb-field">
                开始
                <input
                  aria-label="开始时间"
                  type="time"
                  step="900"
                  value={timeText(selected.start)}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const start = minuteValue(event.target.value);
                    update({ start, end: Math.max(start + 15, selected.end) });
                  }}
                />
              </label>
              <label className="wb-field">
                结束
                <input
                  aria-label="结束时间"
                  type="time"
                  step="900"
                  value={timeText(Math.min(1439, selected.end))}
                  onChange={(event) => {
                    if (
                      event.target.value &&
                      minuteValue(event.target.value) > selected.start
                    )
                      update({ end: minuteValue(event.target.value) });
                  }}
                />
              </label>
            </div>
            <h3>这段时间要做的事</h3>
            {selected.tasks.map((task, index) => (
              <div className="wb-task" key={task.id}>
                <div className="wb-task-line">
                  <span>{index + 1}</span>
                  <input
                    aria-label={"事项 " + (index + 1)}
                    value={task.text}
                    onChange={(event) =>
                      taskChange(task.id, { text: event.target.value })
                    }
                  />
                  <IconButton
                    icon="close"
                    label={"删除事项 " + task.text}
                    onClick={() =>
                      update({
                        tasks: selected.tasks.filter(
                          (item) => item.id !== task.id,
                        ),
                      })
                    }
                  />
                </div>
                <div className="wb-task-options">
                  <select
                    aria-label={"事项优先级 " + (index + 1)}
                    value={task.priority}
                    onChange={(event) =>
                      taskChange(task.id, { priority: event.target.value })
                    }
                  >
                    <option>普通</option>
                    <option>优先</option>
                    <option>最重要</option>
                  </select>
                  <IconButton
                    icon="arrowUp"
                    label={"上移事项 " + (index + 1)}
                    disabled={index === 0}
                    onClick={() => moveTask(index, -1)}
                  />
                  <IconButton
                    icon="arrowDown"
                    label={"下移事项 " + (index + 1)}
                    disabled={index === selected.tasks.length - 1}
                    onClick={() => moveTask(index, 1)}
                  />
                </div>
              </div>
            ))}
            <form
              className="wb-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const text = taskDrafts[selected.id]?.trim();
                if (!text) return;
                update({
                  tasks: [
                    ...selected.tasks,
                    { id: newId("t"), text, priority: "普通" },
                  ],
                });
                setTaskDrafts((items) => ({ ...items, [selected.id]: "" }));
              }}
            >
              <input
                aria-label="添加待办事项"
                placeholder="记下一件事"
                value={taskDrafts[selected.id] || ""}
                onChange={(event) =>
                  setTaskDrafts((items) => ({
                    ...items,
                    [selected.id]: event.target.value,
                  }))
                }
              />
              <button
                className="wb-icon-button"
                aria-label="保存待办事项"
                type="submit"
              >
                ＋
              </button>
            </form>
            <div className="wb-reminder">
              <label>
                <input
                  type="checkbox"
                  checked={selected.reminder !== ""}
                  onChange={(event) =>
                    update({ reminder: event.target.checked ? -10 : "" })
                  }
                />
                提醒我
              </label>
              {selected.reminder !== "" && (
                <div className="wb-reminder-options">
                  <select
                    aria-label="提醒时机"
                    value={Number(selected.reminder) < 0 ? "before" : "after"}
                    onChange={(event) =>
                      update({
                        reminder:
                          Math.abs(Number(selected.reminder) || 10) *
                          (event.target.value === "before" ? -1 : 1),
                      })
                    }
                  >
                    <option value="before">结束前</option>
                    <option value="after">结束后</option>
                  </select>
                  <input
                    aria-label="提醒间隔分钟"
                    type="number"
                    min="1"
                    value={Math.abs(Number(selected.reminder))}
                    onChange={(event) =>
                      update({
                        reminder:
                          Math.max(1, Number(event.target.value)) *
                          (Number(selected.reminder) < 0 ? -1 : 1),
                      })
                    }
                  />
                  <span>分钟</span>
                </div>
              )}
            </div>
            <Button
              icon="trash"
              onClick={() => {
                w.setEvents((items) =>
                  items.filter((item) => item.id !== selected.id),
                );
                w.setSchedule((state) => ({ ...state, selected: null }));
              }}
            >
              删除这段安排
            </Button>
          </>
        ) : (
          <>
            <div className="wb-section-head">
              <strong>这段时间的安排</strong>
              <IconButton
                icon="plus"
                label="新建时间段"
                onClick={() => addEvent(w, w.schedule.start, 900, 960)}
              />
            </div>
            {w.events
              .filter(
                (item) => item.date >= w.schedule.start && item.date <= end,
              )
              .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
              .map((item) => (
                <button
                  className="wb-agenda-item"
                  key={item.id}
                  onClick={() =>
                    w.setSchedule((state) => ({ ...state, selected: item.id }))
                  }
                >
                  <span>
                    {item.date.slice(5)} · {timeText(item.start)}
                  </span>
                  <strong>{item.title}</strong>
                </button>
              ))}
            {!w.events.some(
              (item) => item.date >= w.schedule.start && item.date <= end,
            ) && <Empty icon="calendar" title="这段时间还没有安排" />}
            <details className="wb-loose-tasks">
              <summary>随手记 · 尚未安排时间</summary>
              {loose.map((item, index) => (
                <div className="wb-task-line" key={index}>
                  <span>{index + 1}</span>
                  <p>{item}</p>
                  <IconButton
                    icon="plus"
                    label={"安排时间：" + item}
                    onClick={() => {
                      const id = newId("event");
                      w.setEvents((items) => [
                        ...items,
                        {
                          id,
                          date: w.schedule.start,
                          start: 900,
                          end: 960,
                          title: item,
                          tasks: [],
                          reminder: "",
                        },
                      ]);
                      setLoose((items) => items.filter((_, i) => i !== index));
                      w.setSchedule((state) => ({ ...state, selected: id }));
                    }}
                  />
                </div>
              ))}
              <form
                className="wb-inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (looseDraft.trim()) {
                    setLoose((items) => [...items, looseDraft.trim()]);
                    setLooseDraft("");
                  }
                }}
              >
                <input
                  aria-label="尚未安排时间的事项"
                  placeholder="先记下来"
                  value={looseDraft}
                  onChange={(event) => setLooseDraft(event.target.value)}
                />
                <button
                  className="wb-icon-button"
                  type="submit"
                  aria-label="保存随手记"
                >
                  ＋
                </button>
              </form>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
