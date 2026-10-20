// Demo content for the prototype: a maths teacher's real week.
// Runs inside the page (the prototype's own API layer); returns a summary.
(async () => {
  const uid = () => crypto.randomUUID();
  const log = [];
  async function call(method, path, body) {
    const init = { method, headers: { 'Idempotency-Key': uid() } };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
    const res = await fetch(path, init);
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) log.push(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 160)}`);
    return json;
  }
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
  const questions = [
    ['二次函数的顶点与对称轴', '已知抛物线 $y=x^2-4x+3$，求它的顶点坐标、对称轴，并说明开口方向。', '配方得 $y=(x-2)^2-1$，顶点 $(2,-1)$，对称轴 $x=2$，开口向上。', 't-solve', ['g-func']],
    ['判别式与根的个数', '关于 $x$ 的方程 $x^2+2x+k=0$ 有两个不相等的实数根，求 $k$ 的取值范围。', '$\\Delta=4-4k>0$，所以 $k<1$。', 't-fill', ['g-eq', 'g-mistake']],
    ['SAS 证明全等', '如图，$AB=AD$，$\\angle BAC=\\angle DAC$。求证：$\\triangle ABC\\cong\\triangle ADC$。', '$AB=AD$，$\\angle BAC=\\angle DAC$，$AC=AC$，由 SAS 得证。', 't-proof', ['g-geo']],
    ['分式方程的增根', '解方程 $\\dfrac{x}{x-2}-\\dfrac{4}{x^2-4}=1$，并检验。', '去分母得 $x(x+2)-4=x^2-4$，解得 $x=0$，检验成立。', 't-solve', ['g-frac', 'g-mistake']],
    ['抛物线与 x 轴交点', '抛物线 $y=-x^2+bx+3$ 经过点 $(1,4)$，求它与 $x$ 轴的交点。', '代入得 $b=2$，令 $y=0$ 得 $x=3$ 或 $x=-1$。', 't-solve', ['g-func', 'g-hard']],
    ['二次函数图像平移', '把 $y=2x^2$ 的图像向右平移 3 个单位，再向上平移 1 个单位，所得解析式是（ ）', '$y=2(x-3)^2+1$', 't-choice', ['g-func']],
    ['最值应用题', '某商品进价 40 元，售价 $x$ 元时日销量为 $(100-x)$ 件。售价定为多少时日利润最大？', '利润 $W=(x-40)(100-x)$，当 $x=70$ 时最大，为 900 元。', 't-solve', ['g-func', 'g-hard']],
  ];
  for (const [title, body, solution, typeId, tagIds] of questions) {
    await call('POST', '/api/modules/questions/v2/items', { title, body: doc(body), solution: doc(solution), answerStatus: 'present', typeId, tagIds });
  }

  /* ---------- schedule ---------- */
  const settings = await call('GET', '/api/modules/schedule/settings');
  const tz = settings?.timeZone || 'UTC';
  const labelDefs = [['初三（2）班', '#0a84ff'], ['初三（5）班', '#af52de'], ['教研', '#ff9500'], ['家长', '#34c759']];
  const labels = [];
  for (const [name, color] of labelDefs) {
    const l = await call('POST', '/api/modules/schedule/labels', { name, color });
    if (l?.id) labels.push(l);
  }
  const today = new Date();
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

  /* ---------- resources ---------- */
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
  return log.length ? log.join('\n') : 'ok';
})()
