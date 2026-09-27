import React, { useEffect, useMemo, useState } from "react";
import { createResourcesClient } from "../../../src/features/resources/client.js";
import { Preview } from "../../../src/features/resources/Preview.jsx";
export function Lesson({ onBack, transport }) {
  const [lesson, setLesson] = useState(null),
    [latest, setLatest] = useState({}),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(100);
  const controller = useMemo(() => new AbortController(), []),
    client = useMemo(
      () => createResourcesClient(transport, () => controller.signal),
      [transport, controller],
    );
  async function load() {
    const lesson = (await client.request("/api/modules/lessons/v2/items"))
      .items[0];
    setLesson(lesson);
    const values = await Promise.all(
      lesson.materials.map((r) =>
        client.request(
          `/api/modules/resources/items/${r.resourceId}/for-reference`,
        ),
      ),
    );
    setLatest(Object.fromEntries(values.map((v) => [v.id, v])));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    return () => controller.abort();
  }, []);
  async function adopt(ref) {
    try {
      const input = {
        baseVersion: lesson.version,
        title: lesson.title,
        intro: lesson.intro,
        sections: [],
        materials: lesson.materials.map((r) => ({
          id: r.id,
          kind: "resource",
          resourceId: r.resourceId,
          resourceVersion:
            r.id === ref.id ? latest[r.resourceId].version : r.resourceVersion,
          note: r.note,
        })),
      };
      await client.request(`/api/modules/lessons/v2/items/${lesson.id}`, {
        method: "PUT",
        input,
        key: crypto.randomUUID(),
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  const ref = lesson?.materials[0];
  return (
    <div className="res-workspace">
      <section className="res-detail">
        <header className="res-header">
          <button onClick={onBack}>返回资源库</button>
          <h1>{lesson?.title}</h1>
        </header>
        {error && <p role="alert">{error}</p>}
        {ref && (
          <>
            <div className="res-warning">
              采用版本 {ref.resourceVersion} · {ref.snapshot.fileName}
              {latest[ref.resourceId]?.version > ref.resourceVersion && (
                <button onClick={() => adopt(ref)}>
                  来源有更新，采用当前版本
                </button>
              )}
            </div>
            <Preview
              client={client}
              fileId={
                ref.snapshot.supplementPreviewFileId ?? ref.snapshot.fileId
              }
              page={page}
              onPage={setPage}
              zoom={zoom}
              onZoom={setZoom}
            />
          </>
        )}
      </section>
    </div>
  );
}
