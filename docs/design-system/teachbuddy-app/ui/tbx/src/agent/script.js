import { tx, monthDay } from '../react.js';
/*
 * The prototype's stand-in for a real model. It drives the mock agent API the
 * same way a live provider would: tool steps first (each one really reads the
 * workbench — the question bank, the schedule), then a streamed markdown
 * answer, then result cards the teacher can act on. Everything here is
 * content; the UI only renders what lands in the conversation.
 */

const sleep = (run, ms) => new Promise((resolve) => { run.timer = setTimeout(resolve, ms); });

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/* ---------- reading the workbench ---------- */
function docText(doc) {
  const out = [];
  for (const block of doc?.blocks ?? []) {
    if (block.runs) out.push(block.runs.map((run) => (run.type === 'math' ? `$${run.latex}$` : run.text ?? '')).join(''));
    else if (block.latex) out.push(`$$${block.latex}$$`);
  }
  return out.join('\n');
}

async function questionTags() {
  try {
    const tax = await api('/api/modules/questions/v2/taxonomy');
    return new Map([...(tax.tags ?? []), ...(tax.types ?? [])].map((t) => [t.id, t.name]));
  } catch {
    return new Map();
  }
}

function slim(q, names) {
  return {
    id: q.id,
    title: q.title || '未命名题目',
    excerpt: docText(q.body).split('\n')[0] ?? '',
    tags: [q.typeId, ...(q.tagIds ?? [])].map((id) => names.get(id)).filter(Boolean).slice(0, 3),
  };
}

async function searchQuestions(words) {
  const names = await questionTags();
  const seen = new Map();
  for (const word of words) {
    try {
      const { items } = await api(`/api/modules/questions/v2/items?q=${encodeURIComponent(word)}&searchAnswers=true`);
      for (const q of items) if (!seen.has(q.id)) seen.set(q.id, slim(q, names));
    } catch { /* keep looking */ }
  }
  return [...seen.values()];
}

async function readQuestion(id) {
  const names = await questionTags();
  const q = await api(`/api/modules/questions/v2/items/${encodeURIComponent(id)}`);
  return { ...slim(q, names), body: docText(q.body), solution: docText(q.solution), tagIds: q.tagIds ?? [], typeId: q.typeId };
}

const dayKey = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function readSchedule() {
  try {
    const [{ items }, labels] = await Promise.all([api('/api/modules/schedule/entries'), api('/api/modules/schedule/labels').catch(() => ({ items: [] }))]);
    const names = new Map((labels.items ?? labels ?? []).map((l) => [l.id, l.name]));
    return items.map((e) => ({
      id: e.id,
      title: e.title || '未命名事项',
      date: e.time?.date ?? null,
      start: e.time?.startTime ?? null,
      minutes: e.time?.durationMinutes ?? null,
      label: (e.calendar?.tags ?? []).map((id) => names.get(id)).filter(Boolean)[0] ?? null,
      todo: (e.items ?? []).map((i) => i.text).filter(Boolean),
    }));
  } catch {
    return [];
  }
}

const isLesson = (e) => /数学|课/.test(e.title) && e.date;
function nextLesson(entries) {
  const now = `${dayKey(0)} ${new Date().toTimeString().slice(0, 5)}`;
  return entries.filter(isLesson).filter((e) => `${e.date} ${e.start}` >= now).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0] ?? null;
}
export function whenLabel(e) {
  if (!e?.date) return tx('待安排');
  const offset = Math.round((new Date(`${e.date}T00:00`) - new Date(`${dayKey(0)}T00:00`)) / 86400000);
  const day = offset === 0 ? tx('今天') : offset === 1 ? tx('明天') : offset === 2 ? tx('后天') : monthDay(e.date);
  return e.start ? `${day} ${e.start}` : day;
}

/* ---------- topics ---------- */
const TOPICS = [
  { key: 'func', test: /二次函数|抛物线|顶点|对称轴|开口|quadratic|parabola|vertex/i, name: '二次函数图像与性质', words: ['二次函数', '抛物线'], tag: 'g-func' },
  { key: 'geo', test: /全等|三角形|SAS|ASA|SSS|congruen|triangle/i, name: '全等三角形的判定', words: ['全等', '三角形'], tag: 'g-geo' },
  { key: 'frac', test: /分数|fraction/i, name: '分数加减法', words: ['分数'], tag: null },
  { key: 'rational', test: /分式|增根|rational/i, name: '分式方程', words: ['分式'], tag: 'g-frac' },
  { key: 'eq', test: /判别式|一元二次方程|根的个数|discriminant/i, name: '一元二次方程的判别式', words: ['判别式', '方程'], tag: 'g-eq' },
];
const topicOf = (text) => TOPICS.find((t) => t.test.test(text)) ?? null;

/* ---------- answers ---------- */
const LESSON = {
  func: {
    intro: '这节课的核心，是让学生自己看出 $y=a(x-h)^2+k$ 里每个字母在图像上“管”什么。顺序上先看图、再归纳、最后用式子说话。',
    steps: [
      ['情境引入', 5, '投出两条开口方向不同的抛物线，请学生说出它们“哪里不一样”。先不给术语，只收集说法。'],
      ['探究 $a$ 的作用', 10, '固定 $h=0,\\ k=0$，让 $a$ 从 $2$ 变到 $-2$。学生会发现：$a>0$ 开口向上，$|a|$ 越大开口越窄。'],
      ['探究 $h$ 与 $k$', 12, '分别拖动 $h$、$k$，记录顶点的变化，归纳出顶点 $(h,k)$ 与对称轴 $x=h$。'],
      ['配方与顶点式', 10, '以 $y=x^2-4x+3$ 为例配方得 $y=(x-2)^2-1$，把“一般式”和“顶点式”连起来。'],
      ['当堂练习与小结', 8, '三道题由浅入深，最后请学生用一句话说出 $a$、$h$、$k$ 各自的作用。'],
    ],
    tip: '**课堂提示** 学生最容易把 $y=(x-2)^2$ 的平移方向记反。让他们代入 $x=2$ 算一次，比讲三遍“左加右减”管用。',
  },
  geo: {
    intro: '判定定理本身不难，难的是学生不知道该找哪组条件。顺序上先动手、再归纳、最后练“找条件”。',
    steps: [
      ['动手叠一叠', 6, '每人剪两个三角形，只告诉对方两边一角，看能不能剪得一样。'],
      ['归纳 SAS', 10, '强调“夹角”。用反例说明 SSA 不成立。'],
      ['ASA 与 AAS', 10, '从 SAS 类比出来，让学生自己写出条件。'],
      ['找条件练习', 12, '给图，只问“还差哪个条件”，不急着写证明。'],
      ['规范书写', 7, '示范一次完整证明的格式，标出每一步的依据。'],
    ],
    tip: '**课堂提示** 让学生在图上用同一种颜色标出对应的边和角，“找条件”会快很多。',
  },
};

function lessonAnswer(topic, lesson, found) {
  const plan = LESSON[topic?.key] ?? LESSON.func;
  const name = topic?.name ?? '这节课';
  const total = plan.steps.reduce((sum, [, m]) => sum + m, 0);
  const lines = [
    lesson ? `下一节是 **${lesson.title}**（${whenLabel(lesson)}）。${plan.intro}` : plan.intro,
    '',
    `## ${name} · ${total} 分钟`,
    '',
    ...plan.steps.map(([title, minutes, text], i) => `${i + 1}. **${title}** · ${minutes} 分钟  \n${text}`),
    '',
  ];
  if (found.length) {
    lines.push('## 题库里能直接用的题', '');
    for (const q of found.slice(0, 3)) lines.push(`- **${q.title}** — ${q.excerpt}`);
    lines.push('');
  }
  lines.push(`> ${plan.tip}`);
  return { text: lines.join('\n'), steps: plan.steps, total, name };
}

const METHODS = {
  geo: [
    '这道题至少有三种讲法，适合不同的学生。',
    '',
    '## 三种讲法',
    '',
    '### 1. 顺着条件走（综合法）',
    '从已知出发：$AB=AD$，$\\angle BAC=\\angle DAC$，再找公共边 $AC=AC$，直接用 SAS。最快，适合基础好的学生。',
    '',
    '### 2. 倒着找条件（分析法）',
    '先问“要证全等，还缺什么？”，从结论往回推。慢一点，但能教会学生**怎么想到**公共边。',
    '',
    '### 3. 先动手再证明',
    '让学生把图沿 $AC$ 对折，看两个三角形是否重合，再把“重合”翻译成证明。适合几何直觉弱的学生。',
    '',
    '| 讲法 | 适合 | 用时 | 留意 |',
    '| --- | --- | --- | --- |',
    '| 综合法 | 基础好的学生 | 5 分钟 | 容易跳步 |',
    '| 分析法 | 大多数学生 | 10 分钟 | 板书要清楚 |',
    '| 先动手 | 直觉弱的学生 | 12 分钟 | 准备好纸 |',
    '',
    '> **课堂提示** 不管用哪种讲法，最后都请学生说出：公共边是**怎么被找到的**。',
  ],
};

const FUNC_TIERS = [
  ['基础 · 读图像', [['抛物线 $y=2(x-1)^2+3$ 的顶点坐标是什么？', '$(1,3)$'], ['$y=-x^2+4$ 的开口方向和对称轴是什么？', '开口向下，对称轴 $x=0$'], ['把 $y=x^2$ 向左平移 $2$ 个单位，得到什么？', '$y=(x+2)^2$']]],
  ['提高 · 配方', [['把 $y=x^2-6x+5$ 化成顶点式。', '$y=(x-3)^2-4$'], ['求 $y=2x^2+8x+1$ 的最小值。', '当 $x=-2$ 时最小，为 $-7$'], ['$y=x^2+bx+3$ 的对称轴是 $x=2$，求 $b$。', '$b=-4$']]],
  ['挑战 · 应用', [['用 $20$ 米篱笆围一个矩形菜地，一边靠墙，面积最大是多少？', '$50$ 平方米'], ['某商品每涨价 $1$ 元，销量少 $10$ 件，如何定价利润最大？', '列出 $W=(x-a)(b-10x)$ 后配方'], ['抛物线 $y=x^2-2mx+m^2-1$ 与 $x$ 轴的两个交点距离是多少？', '$2$，与 $m$ 无关']]],
];

function practiceAnswer(topic) {
  if (topic?.key === 'func') {
    const lines = ['按“读图像 → 配方 → 应用”三层排，每层 3 道，最后一层可以留作选做。', ''];
    FUNC_TIERS.forEach(([title, items]) => {
      lines.push(`### ${title}`, '');
      items.forEach(([q], i) => lines.push(`${i + 1}. ${q}`));
      lines.push('');
    });
    lines.push('> **课堂提示** 配方是这节课的门槛。第二层做不出来的学生，先回到 $y=(x-h)^2+k$ 的展开，倒着看一遍。');
    const items = FUNC_TIERS.flatMap(([tier, list]) => list.map(([body, solution], i) => ({ tier, title: `二次函数 · ${tier.split(' · ')[0]} ${i + 1}`, body, solution })));
    return { text: lines.join('\n'), items };
  }
  const tiers = [
    ['基础 · 同分母', [['$\\dfrac{2}{7}+\\dfrac{3}{7}$', '$\\dfrac{5}{7}$'], ['$\\dfrac{5}{9}-\\dfrac{2}{9}$', '$\\dfrac{1}{3}$'], ['$1-\\dfrac{3}{8}$', '$\\dfrac{5}{8}$']]],
    ['提高 · 异分母', [['$\\dfrac{1}{3}+\\dfrac{1}{4}$', '$\\dfrac{7}{12}$'], ['$\\dfrac{5}{6}-\\dfrac{3}{8}$', '$\\dfrac{11}{24}$'], ['$\\dfrac{2}{5}+\\dfrac{1}{3}-\\dfrac{1}{6}$', '$\\dfrac{17}{30}$']]],
    ['挑战 · 生活情境', [['一桶油用去 $\\dfrac{2}{5}$，又用去 $\\dfrac{1}{4}$，还剩几分之几？', '$\\dfrac{7}{20}$'], ['小明读了全书的 $\\dfrac{3}{8}$，小红比他多读 $\\dfrac{1}{6}$，小红读了几分之几？', '$\\dfrac{13}{24}$'], ['$\\dfrac{1}{2}+\\dfrac{1}{6}+\\dfrac{1}{12}+\\dfrac{1}{20}$ 有没有简便算法？', '$\\dfrac{4}{5}$，裂项相消']]],
  ];
  const lines = ['按“同分母 → 异分母 → 情境”三层排，每层 3 道，难度一步一步往上走。', ''];
  tiers.forEach(([title, items]) => {
    lines.push(`### ${title}`, '');
    items.forEach(([q], i) => lines.push(`${i + 1}. ${q}`));
    lines.push('');
  });
  lines.push('> **课堂提示** 第二层是分水岭。卡住的学生，先让他们只写出公分母，不急着算。');
  const items = tiers.flatMap(([tier, list]) => list.map(([body, solution], i) => ({ tier, title: `分数加减法 · ${tier.split(' · ')[0]} ${i + 1}`, body, solution })));
  return { text: lines.join('\n'), items };
}

function demoAnswer() {
  return [
    '用一个可以拖动的参数 $a$，让学生亲眼看到开口方向和开口大小是怎么变的。',
    '',
    '## 演示设计',
    '',
    '1. **画出 $y=ax^2$**，给 $a$ 一个滑块，范围 $-3$ 到 $3$，步长 $0.1$。',
    '2. **保留轨迹**：每停一次，留下一条淡色的旧图像，方便对比。',
    '3. **在 $a=0$ 停一下**：图像变成直线 $y=0$，问学生“这时还是二次函数吗？”',
    '4. **加一个点 $P(1,a)$**：让学生发现 $a$ 就是 $x=1$ 时的函数值。',
    '',
    '## 学生应该看出的三件事',
    '',
    '- $a>0$ 开口向上，$a<0$ 开口向下；',
    '- $|a|$ 越大，开口越窄；',
    '- 不论 $a$ 怎么变，顶点都在原点。',
    '',
    '> **课堂提示** 先让学生预测，再拖滑块验证。“猜错了”的那一刻，记得最牢。',
  ].join('\n');
}

function questionAnswer(q) {
  const hard = /最值|利润|压轴/.test(q.title + q.tags.join(''));
  return [
    `这道 **${q.title}** ${hard ? '是一道把函数和实际问题连起来的题' : '考的是基本方法的熟练程度'}。`,
    '',
    '## 讲的时候分三步',
    '',
    '1. **先读懂题**：让学生用自己的话复述已知和所求，圈出关键量。',
    `2. **再找方法**：${hard ? '把文字关系翻译成函数关系式，再用顶点式求最值。' : '先回忆相关的定义或公式，再判断用哪一个。'}`,
    `3. **最后对答案**：参考答案是 ${q.solution || '（题库里还没有答案）'}，请学生说出每一步的依据。`,
    '',
    '## 学生容易出错的地方',
    '',
    hard ? '- 忘了写自变量的取值范围；\n- 求出顶点后忘记回答“售价定为多少”。' : '- 计算步骤跳得太快，符号出错；\n- 没有检验结果是否符合题意。',
    '',
    '## 一道变式',
    '',
    hard
      ? '把题目改成“进价 $50$ 元，日销量为 $(120-x)$ 件”，最大利润是多少？答案：当 $x=85$ 时，$W$ 最大为 $1225$ 元。'
      : '把题目中的数字换一组，再让学生独立完成一次，检验是否真的掌握。',
  ].join('\n');
}

function scheduleAnswer(entries, offset) {
  const day = dayKey(offset);
  const list = entries.filter((e) => e.date === day).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const name = offset === 0 ? '今天' : offset === 1 ? '明天' : '这一天';
  if (!list.length) return { text: `${name}没有安排。可以趁这段时间，把“待安排”里的事情处理掉一两件。`, list };
  const lessons = list.filter(isLesson).length;
  const lines = [`${name}一共 **${list.length} 件事**，其中 ${lessons} 节课。`, ''];
  for (const e of list) lines.push(`- **${e.start ?? '全天'}** ${e.title}${e.todo.length ? ` — ${e.todo.join('、')}` : ''}`);
  const busy = list.find((e) => e.todo.length >= 2);
  if (busy) lines.push('', `> **提醒** “${busy.title}”还有 ${busy.todo.length} 件准备工作没做完，最好提前处理。`);
  return { text: lines.join('\n'), list };
}

function generalAnswer(prompt, topic) {
  const name = topic?.name ?? '这件事';
  return [
    `可以把${name}拆成三步来准备。`,
    '',
    '1. **想清楚目标**：学生学完以后，应该能独立做到什么？写成一句话。',
    '2. **找一个好例子**：一个具体、学生熟悉的例子，比三段讲解更有用。',
    '3. **安排由浅入深的练习**：先模仿，再变式，最后综合。',
    '',
    '如果你告诉我是哪个班、哪一节课，我可以帮你把讲解顺序和练习一起排好。',
  ].join('\n');
}

/* ---------- the run ---------- */
function tokens(text) {
  // Math, bold spans and table rows arrive whole so they never render half-made.
  const out = [];
  const re = /(\$\$[\s\S]+?\$\$|^> .*$\n?|\$[^$\n]+\$|\*\*[^*\n]+\*\*|^\|.*\|$\n?)/gm;
  let last = 0;
  for (const m of text.matchAll(re)) {
    for (const ch of Array.from(text.slice(last, m.index))) out.push(ch);
    out.push(m[0]);
    last = m.index + m[0].length;
  }
  for (const ch of Array.from(text.slice(last))) out.push(ch);
  return out;
}

export const agentScript = {
  async run({ doc, turn, prompt, references, emit, updated, finish, stamp, id, runs }) {
    const run = { timer: null };
    runs.set(turn.id, run);
    const alive = () => turn.state === 'running';
    let ordinal = 0;

    async function step(name, args, exec, describe) {
      const call = { toolCallId: id(), turnId: turn.id, ordinal: ordinal += 1, name, arguments: args, state: 'executing', result: null, startedAt: stamp(), endedAt: null, detail: describe?.(null) ?? null };
      doc.toolCalls.push(call);
      emit(doc, 'toolCall', call);
      updated(doc);
      const started = Date.now();
      let result = null;
      try { result = await exec(); call.state = 'read'; } catch { call.state = 'failed'; }
      await sleep(run, Math.max(0, 650 + Math.random() * 450 - (Date.now() - started)));
      if (!alive()) return result;
      call.result = result;
      call.endedAt = stamp();
      call.detail = describe?.(result) ?? null;
      emit(doc, 'toolCall', call);
      updated(doc);
      return result;
    }

    // A lesson or question brought in earlier keeps framing the conversation.
    const earlier = doc.messages.filter((m) => m.role === 'user' && m.turnId !== turn.id && m.references?.length).pop()?.references ?? [];
    const refQuestion = references.find((r) => r.input?.kind === 'question');
    const ownEntry = references.find((r) => r.input?.kind === 'entry');
    const refEntry = ownEntry ?? (refQuestion ? null : earlier.find((r) => r.input?.kind === 'entry'));
    const topic = topicOf(`${prompt} ${refEntry?.title ?? ''} ${(refEntry?.snapshot?.items ?? []).map((i) => i.text).join(' ')} ${refQuestion?.title ?? ''}`);
    let text = '';
    const cards = [];

    await sleep(run, 450);
    if (!alive()) return;

    if (refQuestion) {
      const q = await step('questions.read', { id: refQuestion.input.id }, () => readQuestion(refQuestion.input.id), (r) => r?.title ?? refQuestion.title);
      if (!alive()) return;
      if (/找|相似|类似|similar|find/i.test(prompt)) {
        const words = topic?.words ?? [q?.tags?.[0] ?? q?.title?.slice(0, 2) ?? ''];
        const found = (await step('questions.search', { words }, () => searchQuestions(words), (r) => (r ? `${words.join('、')} · ${r.filter((x) => x.id !== q?.id).length} 道` : words.join('、')))) ?? [];
        const others = found.filter((x) => x.id !== q?.id);
        text = others.length ? `题库里和 **${q?.title}** 相近的题有 ${others.length} 道，按相似程度排好了。` : '题库里暂时没有相近的题。可以让我按这道题出一道变式。';
        if (others.length) cards.push({ kind: 'questions', title: `相近的题 · ${others.length} 道`, items: others.slice(0, 5) });
      } else {
        text = questionAnswer(q ?? { title: refQuestion.title, tags: [], solution: '' });
        if (q && /最值|利润|压轴/.test(q.title + q.tags.join(''))) {
          cards.push({ kind: 'variant', title: '变式题已备好', meta: '存进题库，下次直接用', item: { title: `${q.title} · 变式`, body: '某商品进价 $50$ 元，售价 $x$ 元时日销量为 $(120-x)$ 件。售价定为多少时日利润最大？', solution: '利润 $W=(x-50)(120-x)$，当 $x=85$ 时最大，为 $1225$ 元。', tagIds: q.tagIds, typeId: q.typeId } });
        }
      }
    } else if (/明天|今天|这周|本周|日程|课表|有什么课|安排|tomorrow|today|this week|schedule|timetable|classes/i.test(prompt) && !/讲|梳理|设计|teach|plan|design/i.test(prompt)) {
      const offset = /明天|tomorrow/i.test(prompt) ? 1 : 0;
      const entries = (await step('schedule.read', { day: dayKey(offset) }, readSchedule, (r) => (r ? `${offset ? '明天' : '今天'} · ${r.filter((e) => e.date === dayKey(offset)).length} 件事` : (offset ? '明天' : '今天')))) ?? [];
      if (!alive()) return;
      const { text: t, list } = scheduleAnswer(entries, offset);
      text = t;
      if (list.length) cards.push({ kind: 'lessons', title: offset ? '明天的安排' : '今天的安排', items: list.map((e) => ({ id: e.id, when: e.start ?? '全天', title: e.title, label: e.label })) });
    } else if (/分层|作业|tiered|homework/i.test(prompt) && !/找|find/i.test(prompt)) {
      const words = topic?.words ?? ['分数'];
      await step('questions.search', { words }, () => searchQuestions(words), (r) => (r ? `${words.join('、')} · ${r.length} 道` : words.join('、')));
      if (!alive()) return;
      const p = practiceAnswer(topic);
      text = p.text;
      cards.push({ kind: 'practice', title: `${topic?.key === 'func' ? '二次函数' : '分数加减法'}分层练习 · 9 道`, meta: '三个层次，各 3 道', items: p.items });
    } else if (/找|搜|几道|压轴|题目|相似|find|search|questions|challeng|similar/i.test(prompt)) {
      const words = topic?.words ?? (/压轴|challeng/i.test(prompt) ? ['压轴', '最值'] : ['函数']);
      const found = (await step('questions.search', { words }, () => searchQuestions(words), (r) => (r ? `${words.join('、')} · ${r.length} 道` : words.join('、')))) ?? [];
      if (!alive()) return;
      const hard = /压轴|难|challeng|hard/i.test(prompt) ? found.filter((q) => q.tags.some((t) => /压轴|解答/.test(t))) : found;
      const list = (hard.length ? hard : found).slice(0, 5);
      text = list.length
        ? `找到 **${list.length} 道**${topic ? topic.name.replace(/的.*$/, '') : ''}题。${list.length > 1 ? `按难度排好了，第一道 **${list[0].title}** 适合放在课堂开头。` : ''}`
        : '题库里暂时没有符合条件的题。可以先在首页载入示例数据，或者告诉我题目要求，我来帮你出。';
      if (list.length) cards.push({ kind: 'questions', title: `找到 ${list.length} 道题`, items: list });
    } else if (/演示|动画|动态|滑块|demo|animat|slider/i.test(prompt)) {
      text = demoAnswer();
      cards.push({ kind: 'link', title: '在数学工坊里做这个演示', meta: '参数滑块、轨迹和点都能直接加', route: '/math', icon: 'math' });
    } else if (/讲法|怎么证|证明|ways to teach|approach|prove|proof/i.test(prompt)) {
      const words = topic?.words ?? ['全等'];
      const found = (await step('questions.search', { words }, () => searchQuestions(words), (r) => (r ? `${words.join('、')} · ${r.length} 道` : words.join('、')))) ?? [];
      if (!alive()) return;
      text = (METHODS[topic?.key] ?? METHODS.geo).join('\n');
      if (found.length) cards.push({ kind: 'questions', title: '题库里的这道题', items: found.slice(0, 2) });
    } else if (/讲解顺序|梳理|怎么讲|备课|教学设计|这节课|teaching order|plan|how to teach|lesson/i.test(prompt) || ownEntry) {
      const entries = (await step('schedule.read', { upcoming: true }, readSchedule, (r) => {
        const n = refEntry ? null : r && nextLesson(r);
        return refEntry ? refEntry.title : n ? `下一节：${whenLabel(n)} ${n.title}` : '没有找到排好的课';
      })) ?? [];
      if (!alive()) return;
      const lesson = refEntry ? { title: refEntry.title, ...(entries.find((e) => e.id === refEntry.input.id) ?? {}) } : nextLesson(entries);
      const words = topic?.words ?? ['二次函数'];
      const found = (await step('questions.search', { words }, () => searchQuestions(words), (r) => (r ? `${words.join('、')} · ${r.length} 道` : words.join('、')))) ?? [];
      if (!alive()) return;
      const plan = lessonAnswer(topic ?? TOPICS[0], lesson, found);
      text = plan.text;
      cards.push({ kind: 'plan', title: `${plan.name} · 讲解顺序`, meta: `${plan.steps.length} 个环节 · ${plan.total} 分钟`, entryTitle: `备课：${plan.name}`, steps: plan.steps.map(([title, minutes]) => `${title}（${minutes} 分钟）`) });
      if (found.length) cards.push({ kind: 'questions', title: `可以用的题 · ${Math.min(found.length, 3)} 道`, items: found.slice(0, 3) });
    } else {
      text = generalAnswer(prompt, topic);
    }

    if (!alive()) return;
    const message = { id: id(), turnId: turn.id, role: 'assistant', text: '', references: [], state: 'streaming', createdAt: stamp(), cards: [] };
    doc.messages.push(message);
    const parts = tokens(text);
    let offset = 0;
    while (offset < parts.length) {
      if (!alive()) return;
      const n = 3 + Math.floor(Math.random() * 4);
      offset = Math.min(parts.length, offset + n);
      message.text = parts.slice(0, offset).join('');
      emit(doc, 'message', message);
      updated(doc);
      await sleep(run, 34);
    }
    if (!alive()) return;
    message.cards = cards;
    emit(doc, 'message', message);
    await sleep(run, 120);
    if (alive()) finish(doc, turn);
  },
};
