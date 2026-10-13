import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const root = "/api/modules/resources";
const sources = resources => [...new Set(resources.flatMap(item =>
  [item.fileId, item.supplementPreviewFileId].filter(Boolean)))];

// A refresh cycle belongs to one identity and one confirmed write/retry. Search
// changes reuse its file reads, including requests already in flight.
export function useLibraryData({
  client, scene, revision, t,
  setItems, setSearchInfo, setAllItems, setTax,
  setFiles, setPreviews, setFileErrors, setError, setListLoading,
}) {
  const message = useRef(t);
  message.current = t;
  const cycle = useMemo(() => ({ results: new Map(), pending: new Map(), timers: new Set(), watching: new Set(), active: true }), [client, revision]);
  const [ready, setReady] = useState(null);
  const query = new URLSearchParams();
  for (const field of ["q", "folderId", "mediaType", "state"])
    if (scene[field]) query.set(field, scene[field]);
  scene.tagIds.forEach(id => query.append("tagIds", id));
  const queryString = query.toString();

  useEffect(() => {
    cycle.active = true;
    return () => {
      cycle.active = false;
      cycle.timers.forEach(clearTimeout);
      cycle.timers.clear();
      cycle.watching.clear();
    };
  }, [cycle]);

  const watchPreview = useCallback(result => {
    if (cycle.watching.has(result.id)) return;
    cycle.watching.add(result.id);
    function schedule() {
      const timer = setTimeout(() => { cycle.timers.delete(timer); void read(); }, 2000);
      cycle.timers.add(timer);
    }
    async function read() {
      if (!cycle.active) return;
      try {
        const preview = await client.request(`/api/workbench/files/${result.id}/preview`);
        if (!cycle.active) return;
        cycle.results.set(result.id, { ...result, preview: { status: "fulfilled", value: preview }, applied: true });
        setPreviews(current => ({ ...current, [result.id]: preview }));
        if (preview.state === "pending") schedule();
        else cycle.watching.delete(result.id);
      } catch {
        if (cycle.active) setFileErrors(current => ({
          ...current, [result.id]: message.current("文件暂时无法读取，请重试"),
        }));
        cycle.watching.delete(result.id);
      }
    }
    schedule();
  }, [client, cycle, setPreviews, setFileErrors]);

  const hydrate = useCallback(async (resources, accepts) => {
    const results = await Promise.all(sources(resources).map(async id => {
      if (cycle.results.has(id)) return cycle.results.get(id);
      if (!cycle.pending.has(id)) {
        const read = Promise.allSettled([
          client.request(`/api/workbench/files/${id}`),
          client.request(`/api/workbench/files/${id}/preview`),
        ]).then(([file, preview]) => {
          const result = { id, file, preview, applied: false };
          cycle.results.set(id, result);
          cycle.pending.delete(id);
          return result;
        });
        cycle.pending.set(id, read);
      }
      return cycle.pending.get(id);
    }));
    if (!accepts()) return;
    const fresh = results.filter(result => !result.applied);
    if (!fresh.length) return;
    fresh.forEach(result => {
      result.applied = true;
      if (result.preview.status === "fulfilled" && result.preview.value.state === "pending") watchPreview(result);
    });
    setFiles(current => ({ ...current, ...Object.fromEntries(fresh
      .filter(result => result.file.status === "fulfilled")
      .map(result => [result.id, result.file.value])) }));
    setPreviews(current => ({ ...current, ...Object.fromEntries(fresh
      .filter(result => result.preview.status === "fulfilled")
      .map(result => [result.id, result.preview.value])) }));
    setFileErrors(current => {
      const next = { ...current };
      fresh.forEach(({ id, file, preview }) => {
        if (file.status === "rejected" || preview.status === "rejected")
          next[id] = message.current("文件暂时无法读取，请重试");
        else delete next[id];
      });
      return next;
    });
  }, [client, cycle, watchPreview, setFiles, setPreviews, setFileErrors]);

  useEffect(() => {
    let active = true;
    setListLoading(true);
    Promise.all([
      client.request(`${root}/taxonomy`),
      client.request(`${root}/items`),
      client.request(`${root}/items?state=deleted`),
    ]).then(async ([taxonomy, list, archived]) => {
      if (!active) return;
      const resources = [...list.items, ...archived.items];
      setAllItems(resources);
      setTax(taxonomy);
      setReady(cycle);
      await hydrate(resources, () => active);
    }).catch(error => {
      if (active) {
        setError(error.message);
        setListLoading(false);
      }
    });
    return () => { active = false; };
  }, [client, cycle, hydrate, setAllItems, setTax, setError, setListLoading]);

  useEffect(() => {
    if (ready !== cycle) return;
    let active = true, timer;
    setListLoading(true);
    setSearchInfo(null);
    async function receive(list) {
      if (!active) return;
      setItems(list.items);
      setSearchInfo(list.search ?? null);
      // Polls may discover a new resource or a newer file/supplement even when
      // the broad snapshot has not refreshed. Opening uses this latest version.
      setAllItems(current => {
        const next = new Map(current.map(item => [item.id, item]));
        list.items.forEach(item => {
          if (!next.has(item.id) || next.get(item.id).version <= item.version)
            next.set(item.id, item);
        });
        return [...next.values()];
      });
      if (list.search?.pending || list.search?.ocr?.pendingPages)
        timer = setTimeout(async () => {
          try { await receive(await client.request(`${root}/items?${queryString}`)); }
          catch {
            if (active) setSearchInfo(current => ({
              ...current, pending: 0,
              ...(current?.ocr ? { ocr: { ...current.ocr, pendingPages: 0 } } : {}),
              interrupted: true,
            }));
          }
        }, list.search?.ocr?.pendingPages ? 2000 : 800);
      await hydrate(list.items, () => active);
    }
    client.request(`${root}/items?${queryString}`)
      .then(receive)
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; clearTimeout(timer); };
  }, [client, cycle, ready, queryString, hydrate,
    setItems, setSearchInfo, setAllItems, setError, setListLoading]);
}
