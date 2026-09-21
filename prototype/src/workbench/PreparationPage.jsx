import { useState } from "react";
import { modulePath, navigate } from "../routes.js";
import { useWorkspace, newId } from "./context.js";
import { Button, Graph, IconButton, QuestionContent, Toolbar } from "./ui.jsx";

export default function PreparationPage() {
  const w = useWorkspace();
  const lesson = w.lessons.find((item) => item.id === w.lessonId);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [dragged, setDragged] = useState(null);
  function update(patch) {
    w.setLessons((items) =>
      items.map((item) =>
        item.id === lesson.id ? { ...item, ...patch } : item,
      ),
    );
  }
  function blockUpdate(id, patch) {
    update({
      blocks: lesson.blocks.map((block) =>
        block.id === id ? { ...block, ...patch } : block,
      ),
    });
  }
  function select(kind, block) {
    w.setPicker({
      kind,
      target: { lessonId: lesson.id, blockId: block.id },
      label: lesson.title + " / " + block.title,
    });
  }
  return (
    <div className="wb-module">
      <Toolbar title="备课" trail={lesson.title}>
        <Button icon="folder" onClick={() => setMaterialsOpen((open) => !open)}>
          本课材料
        </Button>
        <Button
          icon="plus"
          onClick={() => {
            const next = {
              id: newId("l"),
              title: "新的备课",
              subtitle: "教学思路",
              goal: "",
              blocks: [
                {
                  id: newId("b"),
                  title: "教学环节",
                  text: "",
                  questions: [],
                  works: [],
                  resources: [],
                },
              ],
            };
            w.setLessons((items) => [...items, next]);
            w.setLessonId(next.id);
          }}
        >
          新建备课
        </Button>
      </Toolbar>
      <div className="wb-scroll wb-prep-scroll" aria-label="备课文稿">
        <article className="wb-lesson-document">
          <span className="wb-eyebrow">我的备课</span>
          <input
            className="wb-document-title"
            aria-label="备课课题"
            value={lesson.title}
            onChange={(event) => update({ title: event.target.value })}
          />
          <p className="wb-secondary">{lesson.subtitle}</p>
          <details className="wb-lesson-goal">
            <summary>教学目标与思路</summary>
            <textarea
              aria-label="教学目标"
              rows={3}
              value={lesson.goal}
              onChange={(event) => update({ goal: event.target.value })}
            />
          </details>
          {materialsOpen && (
            <section className="wb-materials-overview">
              <h3>本课材料</h3>
              {w.resources
                .filter((item) => item.lessons.includes(lesson.id))
                .map((item) => (
                  <Button
                    key={item.id}
                    icon="file"
                    onClick={() => {
                      w.setFolder(item.folder);
                      navigate(modulePath("resources"));
                    }}
                  >
                    {item.name}
                  </Button>
                ))}
              <Button
                icon="plus"
                onClick={() => select("resources", lesson.blocks[0])}
              >
                选择资源
              </Button>
            </section>
          )}
          {lesson.blocks.map((block, index) => (
            <section
              className="wb-teaching-block"
              key={block.id}
              id={"wb-block-" + block.id}
              onDragOver={(event) => {
                if (dragged) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragged || dragged === block.id) return;
                const blocks = [...lesson.blocks];
                const moved = blocks.splice(
                  blocks.findIndex((item) => item.id === dragged),
                  1,
                )[0];
                blocks.splice(
                  blocks.findIndex((item) => item.id === block.id),
                  0,
                  moved,
                );
                update({ blocks });
                setDragged(null);
              }}
            >
              <div className="wb-block-heading">
                <button
                  className="wb-block-number"
                  draggable
                  onDragStart={(event) => {
                    setDragged(block.id);
                    event.dataTransfer.setData("text/plain", block.id);
                  }}
                  onDragEnd={() => setDragged(null)}
                  aria-label={"拖动调整 " + block.title + " 的顺序"}
                >
                  {String(index + 1).padStart(2, "0")}
                </button>
                <input
                  aria-label={"教学环节 " + (index + 1)}
                  value={block.title}
                  onChange={(event) =>
                    blockUpdate(block.id, { title: event.target.value })
                  }
                />
                {lesson.blocks.length > 1 && (
                  <IconButton
                    icon="trash"
                    label={"删除环节 " + block.title}
                    onClick={() =>
                      update({
                        blocks: lesson.blocks.filter(
                          (item) => item.id !== block.id,
                        ),
                      })
                    }
                  />
                )}
              </div>
              <textarea
                className="wb-flow-notes"
                aria-label={block.title + "讲解备注"}
                rows={3}
                value={block.text}
                placeholder="这一段准备怎么讲、怎么问？"
                onChange={(event) =>
                  blockUpdate(block.id, { text: event.target.value })
                }
              />
              {block.works.map((id) => (
                <div className="wb-inline-work" key={id}>
                  <Graph compact />
                  <div>
                    <span className="wb-eyebrow">数学演示</span>
                    <strong>
                      {w.works.find((work) => work.id === id)?.name}
                    </strong>
                    <Button
                      onClick={() => {
                        w.setWorkId(id);
                        w.setReturnTarget({
                          lessonId: lesson.id,
                          blockId: block.id,
                        });
                        navigate(modulePath("studio"));
                      }}
                    >
                      打开作品
                    </Button>
                  </div>
                </div>
              ))}
              {block.questions.map((id) => {
                const question = w.questions.find((item) => item.id === id);
                return (
                  question && (
                    <div className="wb-inline-question" key={id}>
                      <div className="wb-section-head">
                        <span>{question.title}</span>
                        <IconButton
                          icon="link"
                          label={"在题库查看 " + question.title}
                          onClick={() => {
                            w.setQuestionId(id);
                            navigate(modulePath("bank"));
                          }}
                        />
                      </div>
                      <QuestionContent question={question} />
                    </div>
                  )
                );
              })}
              {block.resources.map((id) => {
                const item = w.resources.find((resource) => resource.id === id);
                return (
                  item && (
                    <Button
                      key={id}
                      icon="file"
                      onClick={() => {
                        w.setFolder(item.folder);
                        navigate(modulePath("resources"));
                      }}
                    >
                      {item.name}
                    </Button>
                  )
                );
              })}
              <div className="wb-block-insert">
                <Button icon="plus" onClick={() => select("questions", block)}>
                  题目
                </Button>
                <Button icon="graph" onClick={() => select("works", block)}>
                  数学作品
                </Button>
                <Button
                  icon="folder"
                  onClick={() => select("resources", block)}
                >
                  资源
                </Button>
                <Button
                  icon="sparkles"
                  onClick={() => {
                    w.setReturnTarget({
                      lessonId: lesson.id,
                      blockId: block.id,
                    });
                    navigate(modulePath("studio"));
                  }}
                >
                  去工坊制作
                </Button>
              </div>
            </section>
          ))}
          <Button
            icon="plus"
            onClick={() =>
              update({
                blocks: [
                  ...lesson.blocks,
                  {
                    id: newId("b"),
                    title: "新的教学环节",
                    text: "",
                    questions: [],
                    works: [],
                    resources: [],
                  },
                ],
              })
            }
          >
            添加教学环节
          </Button>
          <section className="wb-lesson-feedback">
            <h3>课堂留下的反馈</h3>
            {w.records
              .filter((item) => item.lesson === lesson.id)
              .map((item) => (
                <button
                  key={item.id}
                  className="wb-feedback-link"
                  onClick={() => {
                    w.setClassName(item.className);
                    navigate(modulePath("classes"));
                  }}
                >
                  <span>
                    {item.className} · {item.date}
                  </span>
                  <p>{item.text}</p>
                </button>
              ))}
          </section>
        </article>
      </div>
    </div>
  );
}
