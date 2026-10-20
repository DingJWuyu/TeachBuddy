// Sample content for trying the prototype: a maths teacher's real week.
// Calls the prototype's own API layer, exactly as the app does.
export async function seedDemo() {
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

  /* ---------- math workshop ---------- */
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

  /* ---------- classroom ---------- */
  {
    const C = '/api/modules/classroom';
    // deterministic noise so screenshots stay the same between runs
    let seed = 20261018;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

    const tagNames = ['二次函数', '一元二次方程', '判别式', '配方法', '图像与性质', '应用题', '全等三角形', '计算'];
    const tag = {};
    for (const name of tagNames) { const t = await call('POST', `${C}/tags`, { name }); if (t?.id) tag[name] = t.id; }

    const q = (group, label, fullScore, tags) => ({ group, label, fullScore, tagIds: tags.map((n) => tag[n]).filter(Boolean) });
    const examDefs = [
      ['第一单元测验', '2026-09-12', 100, [
        ...[1, 2, 3, 4, 5].map((i) => q('选择题', `第 ${i} 题`, 4, [['计算'], ['一元二次方程'], ['判别式'], ['配方法'], ['图像与性质']][i - 1])),
        ...[6, 7, 8, 9].map((i) => q('填空题', `第 ${i} 题`, 5, [['一元二次方程'], ['判别式'], ['配方法'], ['计算']][i - 6])),
        q('解答题', '第 10 题', 12, ['配方法', '计算']),
        q('解答题', '第 11 题', 14, ['一元二次方程']),
        q('解答题', '第 12 题', 16, ['应用题', '一元二次方程']),
        q('解答题', '第 13 题', 18, ['判别式', '一元二次方程']),
      ]],
      ['九月月考', '2026-09-26', 120, [
        ...[1, 2, 3, 4, 5, 6].map((i) => q('选择题', `第 ${i} 题`, 4, [['计算'], ['图像与性质'], ['判别式'], ['全等三角形'], ['二次函数'], ['配方法']][i - 1])),
        ...[7, 8, 9, 10].map((i) => q('填空题', `第 ${i} 题`, 4, [['一元二次方程'], ['二次函数'], ['全等三角形'], ['图像与性质']][i - 7])),
        q('解答题', '第 11 题', 14, ['计算', '配方法']),
        q('解答题', '第 12 题', 16, ['全等三角形']),
        q('解答题', '第 13 题', 18, ['应用题', '二次函数']),
        q('解答题', '第 14 题', 16, ['二次函数', '图像与性质']),
        q('解答题', '第 15 题', 16, ['二次函数', '判别式']),
      ]],
      ['十月月考', '2026-10-14', 120, [
        ...[1, 2, 3, 4, 5, 6].map((i) => q('选择题', `第 ${i} 题`, 4, [['二次函数'], ['图像与性质'], ['计算'], ['全等三角形'], ['判别式'], ['二次函数']][i - 1])),
        ...[7, 8, 9, 10].map((i) => q('填空题', `第 ${i} 题`, 4, [['图像与性质'], ['二次函数'], ['配方法'], ['全等三角形']][i - 7])),
        q('解答题', '第 11 题', 14, ['计算']),
        q('解答题', '第 12 题', 16, ['全等三角形']),
        q('解答题', '第 13 题', 18, ['应用题', '二次函数']),
        q('解答题', '第 14 题', 16, ['图像与性质', '二次函数']),
        q('解答题', '第 15 题', 16, ['二次函数', '应用题']),
      ]],
    ];
    const exams = [];
    for (const [name, date, fullScore, questions] of examDefs) {
      const e = await call('POST', `${C}/exams`, { name, date, subject: '数学', fullScore, questions });
      if (e?.id) exams.push(e);
    }
    // per-question difficulty: hard final questions, easy choices
    const difficulty = (exam, i) => {
      const qn = exam.questions[i];
      if (qn.group === '选择题') return 0.88;
      if (qn.group === '填空题') return 0.78;
      return 0.74 - (i / exam.questions.length) * 0.32 + (qn.tagIds.includes(tag['应用题']) ? -0.08 : 0);
    };

    const classDefs = [
      ['初三（2）班', '2026 秋季学期', 5, 6, ['林小雨', '陈子墨', '王思远', '赵一诺', '周雨桐', '吴浩然', '孙可欣', '李嘉豪', '郑书瑶', '黄俊熙', '徐梓涵', '马天宇', '朱晓彤', '胡明轩', '郭欣怡', '何宇航', '高雅琪', '罗子轩', '梁诗涵', '宋文博', '唐若曦', '韩逸飞', '冯佳怡', '曹睿哲', '彭语嫣', '董子豪']],
      ['初三（5）班', '2026 秋季学期', 4, 6, ['许安然', '邓思琪', '萧景行', '田雨萱', '潘志远', '蒋梦瑶', '谢宇轩', '余可馨', '杜承泽', '叶清欢', '程浩宇', '苏芷若', '吕博文', '丁一然', '魏晨曦', '沈家乐', '任思彤', '姚子默']],
    ];
    const profiles = {
      林小雨: ['画画、天文，课间常在本子上画星图', '安静细心，作业工整。不太主动提问，但私下问问题时思路很清楚。适合多给一点展示的机会。'],
      陈子墨: ['篮球、魔方', '反应快，喜欢抢答，计算偶尔粗心。最近在练习先检查再交卷。'],
      赵一诺: ['钢琴、科幻小说', '目标明确，几何证明写得规范。对自己要求高，考差了会难过，需要及时鼓励。'],
      吴浩然: ['足球、乐高', '上课容易走神，但对动手的内容很投入。坐前排效果更好。'],
      郑书瑶: ['写作、辩论', '表达好，数学上喜欢追问“为什么”，是课堂讨论的带动者。'],
      马天宇: ['编程、围棋', '压轴题思路很好，基础题反而容易失分。'],
      许安然: ['羽毛球、摄影', '课代表，责任心强，常帮同学讲题。'],
      萧景行: ['航模', '基础薄弱但很努力，九月以来进步明显。'],
    };
    const classes = [];
    for (const [name, term, rows, cols, names] of classDefs) {
      const cls = await call('POST', `${C}/classes`, { name, term });
      if (!cls?.id) continue;
      const students = [];
      for (const [i, sname] of names.entries()) {
        const no = String(i + 1).padStart(2, '0');
        const [interests, personality] = profiles[sname] || ['', ''];
        const month = 1 + Math.floor(rand() * 12), day = 1 + Math.floor(rand() * 27);
        const s = await call('POST', `${C}/students`, { classId: cls.id, name: sname, studentNo: `${name.includes('2') ? '2' : '5'}${no}`, birthday: `2011-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, interests, personality });
        if (s?.id) students.push({ ...s, ability: Math.max(0.3, Math.min(0.97, 0.76 + gauss() * 0.2)), trend: gauss() * 0.05 });
      }
      // a few named arcs, so the charts tell a story
      const arc = { 萧景行: [0.42, 0.06], 赵一诺: [0.93, 0], 吴浩然: [0.6, -0.04], 马天宇: [0.86, 0.01], 林小雨: [0.8, 0.03] };
      for (const s of students) if (arc[s.name]) [s.ability, s.trend] = arc[s.name];
      // seats: front-to-back by student number, last two wait in the tray
      const seats = students.slice(0, Math.min(students.length - 2, rows * cols)).map((s, i) => ({ studentId: s.id, row: Math.floor(i / cols), col: i % cols }));
      const fresh = await call('GET', `${C}/classes/${cls.id}`);
      await call('PUT', `${C}/classes/${cls.id}/seating`, { baseVersion: fresh.version, rows, cols, seats });
      classes.push({ cls, students });
    }

    // scores arrive the way teachers bring them: an Excel sheet per class
    const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    function zip(files) {
      const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
      for (const [name, text] of files) {
        const nb = enc.encode(name), data = enc.encode(text), sum = crc(data);
        const l = new DataView(new ArrayBuffer(30));
        l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint32(14, sum, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, nb.length, true);
        parts.push(new Uint8Array(l.buffer), nb, data);
        const e = new DataView(new ArrayBuffer(46));
        e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint32(16, sum, true); e.setUint32(20, data.length, true); e.setUint32(24, data.length, true); e.setUint16(28, nb.length, true); e.setUint32(42, offset, true);
        central.push(new Uint8Array(e.buffer), nb);
        offset += 30 + nb.length + data.length;
      }
      const size = central.reduce((a, p) => a + p.length, 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, offset, true);
      return new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
    }
    const col = (i) => { let s = ''; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
    const sheet = (rows) => {
      const body = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => v == null || v === '' ? '' : typeof v === 'number' ? `<c r="${col(c)}${r + 1}"><v>${v}</v></c>` : `<c r="${col(c)}${r + 1}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`).join('')}</row>`).join('');
      return zip([
        ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
        ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
        ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="成绩" sheetId="1" r:id="rId1"/></sheets></workbook>'],
        ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
        ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`],
      ]);
    };
    const imports = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]]; // 5班 hasn't brought in the October sheet yet
    for (const [ci, ei] of imports) {
      const { cls, students } = classes[ci] || {};
      const exam = exams[ei];
      if (!cls || !exam) continue;
      const header = ['学号', '姓名', ...exam.questions.map((x) => x.label.replace(/\s/g, '')), '总分', '缺考'];
      const rows = [header];
      for (const s of students) {
        const absent = (ei === 1 && s.name === '吴浩然') || (ei === 0 && s.name === '丁一然');
        if (absent) { rows.push([s.studentNo, s.name, ...exam.questions.map(() => null), null, '缺考']); continue; }
        const level = s.ability + s.trend * ei + [0.02, -0.05, 0.06][ei] + (ci === 1 ? -0.04 : 0);
        const scores = exam.questions.map((qn, i) => {
          const p = Math.max(0, Math.min(1, level * (difficulty(exam, i) / 0.72) + gauss() * 0.16));
          const step = qn.fullScore <= 5 ? qn.fullScore : 1;
          return qn.fullScore <= 5 ? (rand() < p ? qn.fullScore : 0) : Math.round((p * qn.fullScore) / step) * step;
        });
        rows.push([s.studentNo, s.name, ...scores, scores.reduce((a, v) => a + v, 0), null]);
      }
      const fd = new FormData();
      fd.append('file', new File([sheet(rows)], `${cls.name}${exam.name}成绩.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const file = await call('POST', '/api/workbench/files', fd);
      if (!file?.id) continue;
      let imp = await call('POST', `${C}/imports`, { examId: exam.id, classId: cls.id, fileId: file.id });
      if (!imp?.id) continue;
      const n = exam.questions.length;
      imp = await call('PUT', `${C}/imports/${imp.id}`, { baseVersion: imp.version, mapping: { sheet: 0, headerRow: 1, firstRow: 2, numberCol: 1, nameCol: 2, totalCol: 3 + n, absentCol: 4 + n, questionCols: Object.fromEntries(exam.questions.map((x, i) => [x.id, 3 + i])) } });
      if (imp?.id) await call('POST', `${C}/imports/${imp.id}/confirmation`, { baseVersion: imp.version });
    }

    // notes: what the class went through, and a few students
    const note = (kind, id, date, body) => call('POST', `${C}/records`, { subject: { kind, id }, date, body });
    const [c2, c5] = classes;
    if (c2) {
      const by = Object.fromEntries(c2.students.map((s) => [s.name, s.id]));
      await note('class', c2.cls.id, '2026-09-08', '开学第一课：一元二次方程复习。大部分同学配方法已经熟练，但“二次项系数不为 1”时还是会漏除。下节课先用 5 分钟小练。');
      await note('class', c2.cls.id, '2026-09-15', '单元测验讲评。判别式那道题（第 13 题）全班得分率不到一半，问题集中在“方程有实根”时忘了讨论二次项系数为 0。');
      await note('class', c2.cls.id, '2026-09-29', '九月月考后调了座位：让吴浩然、萧同学坐到前两排，郑书瑶和陈子墨同桌，讨论时互补。');
      await note('class', c2.cls.id, '2026-10-09', '二次函数图像：用数学工坊的动画演示平移，效果很好，很多同学第一次真正“看见”了顶点式的意义。');
      await note('class', c2.cls.id, '2026-10-16', '十月月考讲评。应用题（第 13、15 题）仍是失分最多的地方，审题和设未知数需要专门练。下周安排两节应用题专题课。');
      if (by['林小雨']) {
        await note('student', by['林小雨'], '2026-09-17', '主动来问判别式的题，自己发现了漏讨论 a=0 的情况。可以请她在课上分享这个“坑”。');
        await note('student', by['林小雨'], '2026-10-15', '十月月考进步明显。和她聊了聊，说最近在用错题本，每周自己复盘一次。');
      }
      if (by['吴浩然']) {
        await note('student', by['吴浩然'], '2026-09-26', '九月月考请了病假，缺考。已经把试卷发给他，周一交。');
        await note('student', by['吴浩然'], '2026-10-12', '最近上课注意力不太集中，作业完成率下降。下周找时间和家长沟通一下。');
      }
      if (by['赵一诺']) await note('student', by['赵一诺'], '2026-10-15', '十月月考第一。几何证明步骤完整，可以作为范例展示（已征得同意）。');
    }
    if (c5) {
      const by = Object.fromEntries(c5.students.map((s) => [s.name, s.id]));
      await note('class', c5.cls.id, '2026-09-10', '5 班整体基础比 2 班弱一些，计算题正确率偏低。每节课前加 3 道口算。');
      await note('class', c5.cls.id, '2026-10-10', '课堂气氛活跃了很多。许安然组织的“小老师”讲题效果不错，下周继续。');
      if (by['萧景行']) await note('student', by['萧景行'], '2026-10-02', '九月月考比单元测验提高了不少，课后留下来问了两道应用题。多肯定他。');
    }
    // one archived note, so the archive has something in it
    if (c2) {
      const r = await note('class', c2.cls.id, '2026-09-05', '（草稿）开学前备课：先复习还是直接新课？');
      if (r?.id) await call('PUT', `${C}/records/${r.id}/deletion`, { baseVersion: r.version, deleted: true });
    }
  }
  return log.length ? log.join('\n') : 'ok';
}
