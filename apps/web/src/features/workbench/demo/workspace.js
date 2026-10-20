import { sampleQuestions } from './question-data.js';
function moduleCalls(job, scope, adapt = async (_method, _path, body) => body) {
  let index = 0;
  return async (method, path, input) => {
    const step = `${scope}:${index++}`;
    if (method === 'GET') return job.get(path);
    const body = await adapt(method, path, input);
    if (body?.existing) return body.existing;
    return job.write(step, method, path, body);
  };
}
function mapNames(items, wanted, job, scope) {
  const mapping = new Map();
  const added = wanted.map(item => {
    const existing = items.find(old => old.name === item.name && (old.parentId ?? null) === (item.parentId ?? null));
    const next = { ...item, id: existing?.id ?? job.id(`${scope}:${item.id}`) };
    mapping.set(item.id, next.id); return existing ?? next;
  });
  return { mapping, items: [...items, ...added.filter(item => !items.some(old => old.id === item.id))] };
}
export async function seedQuestions(job) {
  let mapping = new Map();
  const call = moduleCalls(job, 'questions', async (_method, path, body) => {
    if (path.endsWith('/taxonomy')) {
      const current = await job.get(path);
      const types = mapNames(current.types, body.types, job, 'question-type');
      const tags = mapNames(current.tags, body.tags, job, 'question-tag');
      mapping = new Map([...types.mapping, ...tags.mapping]);
      return { baseVersion: current.version, types: types.items, tags: tags.items };
    }
    return { ...body, note: '', starred: false, source: { kind: 'manual' }, typeId: mapping.get(body.typeId) ?? null, tagIds: body.tagIds.map(id => mapping.get(id)) };
  });
  const doc = (text) => ({ version: 2, blocks: String(text).split('\n').filter(Boolean).map((line) => {
    const runs = []; let end = 0;
    for (const m of line.matchAll(/\$([^$]+)\$/g)) {
      if (m.index > end) runs.push({ type: 'text', text: line.slice(end, m.index) });
      runs.push({ type: 'math', latex: m[1] }); end = m.index + m[0].length;
    }
    if (end < line.length) runs.push({ type: 'text', text: line.slice(end) });
    return { type: 'paragraph', runs };
  }) });

  /* ---------- question bank ---------- */
  const qtax = await call('GET', '/api/modules/questions/v2/taxonomy');
  const types = [['t-choice', '选择题'], ['t-fill', '填空题'], ['t-solve', '解答题'], ['t-proof', '证明题']].map(([id, name]) => ({ id, name }));
  const tags = [['g-func', '二次函数'], ['g-geo', '全等三角形'], ['g-frac', '分式'], ['g-eq', '一元二次方程'], ['g-hard', '压轴'], ['g-mistake', '易错']].map(([id, name]) => ({ id, name }));
  await call('PUT', '/api/modules/questions/v2/taxonomy', { baseVersion: qtax.version, types, tags });
  const questions = sampleQuestions;
  for (const [title, body, solution, typeId, tagIds] of questions) {
    await call('POST', '/api/modules/questions/v2/items', { title, body: doc(body), solution: doc(solution), answerStatus: 'present', typeId, tagIds });
  }

}
export async function seedSchedule(job) {
  const uid = () => job.id(`schedule-check:${checkIndex++}`); let checkIndex = 0;
  const call = moduleCalls(job, 'schedule', async (_method, path, body) => {
    if (path.endsWith('/labels')) { const current = await job.get(path); const match = current.items.find(item => item.name === body.name); if (match) return { existing: match }; }
    return body;
  });
  const settings = await call('GET', '/api/modules/schedule/settings');
  const tz = settings?.timeZone || 'UTC';
  const labelDefs = [['初三（2）班', '#0a84ff'], ['初三（5）班', '#af52de'], ['教研', '#ff9500'], ['家长', '#34c759']];
  const labels = [];
  for (const [name, color] of labelDefs) {
    const l = await call('POST', '/api/modules/schedule/labels', { name, color });
    if (l?.id) labels.push(l);
  }
  const today = new Date(`${job.day}T12:00:00Z`);
  const iso = (d) => d.toISOString().slice(0, 10);
  const day = (offset) => { const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset)); return iso(d); };
  const entry = (title, date, startTime, durationMinutes, tagIndex, items = [], notes = '') => ({
    title, items: items.map(([text, priority = 'normal', completed = false]) => ({ id: uid(), text, priority, completed })),
    time: date ? { date, startTime, timeZone: tz, durationMinutes } : null,
    repeat: null, reminder: null,
    calendar: { allDay: false, notes, tags: tagIndex == null || !labels[tagIndex] ? [] : [labels[tagIndex].id] },
  });
  const plan = [
    entry('初三（2）班 数学', day(0), '08:00', 45, 0, [['讲二次函数顶点式'], ['当堂练习 3 题', 'high']]),
    entry('初三（5）班 数学', day(0), '10:10', 45, 1, [['复习判别式']]),
    entry('数学组教研', day(0), '14:30', 90, 2, [['分享分层作业设计', 'high'], ['听课反馈']], '三楼会议室'),
    entry('晚自习答疑', day(0), '19:00', 60, 0),
    entry('初三（2）班 数学', day(1), '08:00', 45, 0, [['讲全等三角形判定']]),
    entry('家长会准备', day(1), '16:00', 60, 3, [['成绩分析 PPT', 'high'], ['打印座位表']]),
    entry('初三（5）班 数学', day(2), '09:00', 45, 1),
    entry('公开课试讲', day(2), '15:00', 60, 2, [['抛物线动态演示'], ['请王老师听课']]),
    entry('初三（2）班 数学', day(3), '08:00', 45, 0),
    entry('周测阅卷', day(3), '13:30', 120, null, [['阅 2 班试卷'], ['阅 5 班试卷'], ['统计错题']]),
    entry('初三（5）班 数学', day(4), '10:10', 45, 1),
    entry('批改第三单元作业', null, null, null, null, [['2 班作业', 'high'], ['5 班作业', 'high'], ['登记未交名单']]),
    entry('准备二次函数复习课', null, null, null, null, [['整理 10 道典型题'], ['做抛物线平移动画', 'high'], ['写导学案']]),
    entry('联系小陈家长', null, null, null, 3, [['约周四放学后面谈', 'low']]),
    entry('', null, null, null, null, [['订下学期练习册', 'low'], ['更新班级群公告']]),
  ];
  for (const e of plan) await call('POST', '/api/modules/schedule/entries', e);

}
export async function seedResources(job) {
  let mapping = new Map();
  const call = moduleCalls(job, 'resources', async (_method, path, body) => {
    if (body instanceof FormData) return body;
    if (path.endsWith('/taxonomy')) {
      const current = await job.get(path);
      const folders = [...current.folders];
      for (const folder of body.folders) {
        const parentId = mapping.get(folder.parentId) ?? null;
        const existing = folders.find(item => item.name === folder.name && item.parentId === parentId);
        const id = existing?.id ?? job.id(`resource-folder:${folder.id}`);
        mapping.set(folder.id, id);
        if (!existing) folders.push({ ...folder, id, parentId });
      }
      const tags = mapNames(current.tags, body.tags, job, 'resource-tag');
      mapping = new Map([...mapping, ...tags.mapping]);
      return { baseVersion: current.version, folders, tags: tags.items };
    }
    return { ...body, folderId: mapping.get(body.folderId) ?? null, tagIds: body.tagIds.map(id => mapping.get(id)) };
  });
  const rtax = await call('GET', '/api/modules/resources/taxonomy');
  const folders = [['f-lesson', '课件', null], ['f-paper', '试卷', null], ['f-unit', '第二单元', 'f-lesson']].map(([id, name, parentId]) => ({ id, name, parentId }));
  const rtags = [['r-func', '二次函数'], ['r-exam', '期中'], ['r-share', '组内共享']].map(([id, name]) => ({ id, name }));
  await call('PUT', '/api/modules/resources/taxonomy', { baseVersion: rtax?.version ?? 1, folders, tags: rtags });
  async function slide(title, sub, bg, ink) {
    const c = new OffscreenCanvas(1280, 720); const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 1280, 720);
    g.strokeStyle = ink; g.globalAlpha = 0.25; g.lineWidth = 4;
    g.beginPath(); g.moveTo(760, 140); g.quadraticCurveTo(940, 820, 1120, 140); g.stroke();
    g.beginPath(); g.moveTo(700, 480); g.lineTo(1180, 480); g.moveTo(940, 600); g.lineTo(940, 120); g.stroke();
    g.globalAlpha = 1; g.fillStyle = ink;
    g.font = 'bold 64px sans-serif'; g.fillText(title, 90, 330);
    g.font = '32px sans-serif'; g.globalAlpha = 0.7; g.fillText(sub, 90, 400);
    return new File([await c.convertToBlob({ type: 'image/png' })], `${title}.png`, { type: 'image/png' });
  }
  const files = [
    [await slide('二次函数的图像', '第二单元 第 1 课时', '#1d1d1f', '#f5f5f7'), '二次函数的图像（课件封面）', 'f-unit', ['r-func']],
    [await slide('顶点式与平移', '第二单元 第 2 课时', '#fff8db', '#1d1d1f'), '顶点式与平移', 'f-unit', ['r-func', 'r-share']],
    [await slide('期中复习', '初三数学 · 重点梳理', '#eef5fd', '#1d1d1f'), '期中复习提纲', 'f-paper', ['r-exam']],
    [await slide('错题回顾', '判别式与根的个数', '#f5f2fd', '#1d1d1f'), '错题回顾：判别式', null, []],
  ];
  for (const [file, title, folderId, tagIds] of files) {
    const fd = new FormData(); fd.append('file', file);
    const stored = await call('POST', '/api/workbench/files', fd);
    if (stored?.id) await call('POST', '/api/modules/resources/items', { fileId: stored.id, title, folderId, tagIds, note: '' });
  }

}
export async function seedMath(job) {
  const call = moduleCalls(job, 'math', async (_method, path, body) => body instanceof FormData || path.endsWith('/deletion') ? body : { originalFileId: null, ...body });
  const formula = (id, latex, caption = '') => ({ id, latex, caption, includeCaption: Boolean(caption), color: '#1d1d1f', fontSize: 30 });
  const workshop = (formulas) => ({ schemaVersion: 1, kind: 'workshop', formulas, graph: null, view: 'plane', steps: [], initialStepId: null, animation: null, traceObjects: [] });
  const works = [
    ['等差数列求和', [formula('f1', 'S_n=\\frac{n(a_1+a_n)}{2}'), formula('f2', 'a_n=a_1+(n-1)d')]],
    ['勾股定理', [formula('f1', 'a^2+b^2=c^2')]],
    ['二次函数顶点式', [formula('f1', 'y=a(x-h)^2+k'), formula('f2', 'y=x^2-4x+3=(x-2)^2-1')]],
    ['一元二次方程求根公式', [formula('f1', 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'), formula('f2', '\\Delta=b^2-4ac')]],
  ];
  for (const [title, formulas] of works) await call('POST', '/api/modules/math/v1/works', { title, source: workshop(formulas) });
  const page = `<!doctype html><meta charset="utf-8"><title>抛物线平移</title><body style="margin:0;display:grid;place-items:center;height:100vh;font-family:sans-serif"><svg viewBox="-6 -2 12 10" width="480"><path d="M-6 6H6M0 -2V8" stroke="#ccc" stroke-width=".05"/><path id="p" d="M-3 -1Q0 11 3 -1" fill="none" stroke="#af52de" stroke-width=".12"><animateTransform attributeName="transform" type="translate" values="-2 0;2 0;-2 0" dur="4s" repeatCount="indefinite"/></path></svg></body>`;
  const fd = new FormData(); fd.append('file', new File([page], '抛物线平移.html', { type: 'text/html' }));
  const html = await call('POST', '/api/workbench/files', fd);
  if (html?.id) await call('POST', '/api/modules/math/v1/works', { title: '抛物线平移动画', source: { schemaVersion: 1, kind: 'html', fileId: html.id }, originalFileId: html.id });
  const old = await call('POST', '/api/modules/math/v1/works', { title: '旧版：分式化简', source: workshop([formula('f1', '\\frac{x^2-4}{x+2}=x-2')]) });
  if (old?.id) await call('POST', `/api/modules/math/v1/works/${old.id}/deletion`, { baseVersion: old.version, deleted: true });

}
