// Prototype fixtures for layout and teaching workflows. No school or API data.
export const WORKBENCH_MODULES = [
  { id: "bank", name: "题库", icon: "lessons" },
  { id: "prep", name: "备课", icon: "pencil" },
  { id: "studio", name: "数学工坊", icon: "graph" },
  { id: "resources", name: "资源库", icon: "folder" },
  { id: "classes", name: "班级教学", icon: "classes" },
];

export function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function shiftDate(key, amount) {
  const date = new Date(key + "T12:00:00");
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}
export const TODAY = dateKey(new Date());
export const QUESTIONS = [
  {
    id: "q1",
    title: "从图象走向单调性的定义",
    body: "已知函数 f(x) = x²。\n（1）分别讨论它在 (−∞, 0] 和 [0, +∞) 上的单调性。\n（2）任选同一区间中的 x₁ < x₂，比较 f(x₁) 与 f(x₂)，说明你的判断。",
    answer: "在 (−∞, 0] 上单调递减，在 [0, +∞) 上单调递增。",
    analysis:
      "利用 f(x₂) − f(x₁) = (x₂ − x₁)(x₂ + x₁)，结合所在区间判断符号。注意“任意”与“同一区间”的条件。",
    note: "先让学生描述图象，再追问怎样用数学语言说明。",
    tags: ["概念辨析", "课堂例题"],
    source: "函数专题 · 个人选题",
    graph: true,
  },
  {
    id: "q2",
    title: "两个点能说明整个区间吗",
    body: "某同学在函数 y = x² 的图象上选取两点，发现自变量较大的点，函数值也较大，于是认为这个函数在 R 上单调递增。\n这一判断是否正确？请说明理由。",
    answer: "不正确。仅比较选定的两个点不能说明整个区间上的单调性。",
    analysis:
      "例如 −2 < −1，但 f(−2) = 4 > 1 = f(−1)。应检查区间内任意两个自变量之间的关系。",
    note: "适合放在定义之后，检查学生是否理解任意性。",
    tags: ["概念辨析"],
    source: "个人编写",
  },
  {
    id: "q3",
    title: "换一种方式证明",
    body: "已知 f(x) = 2x + 1，使用函数单调性的定义证明 f(x) 在 R 上单调递增。\n你还能用哪些方式解释这一结论？",
    answer: "任取 x₁ < x₂，有 f(x₂) − f(x₁) = 2(x₂ − x₁) > 0。",
    analysis:
      "可以从图象或一次函数的斜率理解，再比较直观解释与定义证明的区别。",
    note: "",
    tags: ["定义证明", "课堂例题"],
    source: "备课选题",
  },
  {
    id: "q4",
    title: "偶函数与单调性",
    body: "已知 f(x) 是定义在 R 上的偶函数，在 [0, +∞) 上单调递增。\n证明 f(x) 在 (−∞, 0] 上单调递减。",
    answer:
      "任取 x₁ < x₂ ≤ 0，则 −x₁ > −x₂ ≥ 0，故 f(−x₁) > f(−x₂)。由偶性得 f(x₁) > f(x₂)。",
    analysis: "关注取相反数后不等号方向的变化，以及偶函数定义的使用。",
    note: "可作为后续性质综合的备用题。",
    tags: ["定义证明", "备用题"],
    source: "个人题目收藏",
  },
  {
    id: "q5",
    title: "定义域也会影响结论",
    body: "将函数 f(x) = x² 的定义域限制为 [−1, 2]。\n这个函数还是偶函数吗？",
    answer: "不是。定义域不关于原点对称。",
    analysis: "讨论函数奇偶性时，先检查定义域，再检查对应函数值的关系。",
    note: "",
    tags: ["概念辨析"],
    source: "个人编写",
    graph: true,
  },
];
export const LESSONS = [
  {
    id: "l1",
    title: "函数的单调性",
    subtitle: "第 1 课时 · 从直观到严谨",
    goal: "借助图象理解单调性，用符号语言表达，并尝试依据定义证明。",
    blocks: [
      {
        id: "b1",
        title: "观察图象",
        text: "从熟悉的二次函数出发。先请学生描述自变量变化时函数值如何变化，再追问：怎样把“上升”和“下降”说清楚？",
        questions: [],
        works: ["w1"],
        resources: [],
      },
      {
        id: "b2",
        title: "建立定义",
        text: "把学生的自然语言转化为符号表达，重点讨论“区间”和“任意两个自变量”。给学生留出独立表述的时间。",
        questions: ["q2"],
        works: [],
        resources: [],
      },
      {
        id: "b3",
        title: "例题讲解",
        text: "先请学生给出图象上的判断，再一起用定义完成证明。强调每个不等式使用的条件。",
        questions: ["q1"],
        works: [],
        resources: [],
      },
      {
        id: "b4",
        title: "独立练习与回顾",
        text: "用一道简短练习检查证明步骤。请学生回顾：图象观察与定义证明分别帮助我们做了什么？",
        questions: ["q3"],
        works: [],
        resources: [],
      },
    ],
  },
  {
    id: "l2",
    title: "函数的奇偶性",
    subtitle: "第 1 课时 · 对称与数量关系",
    goal: "从图象对称性出发，理解并运用奇偶性的定义。",
    blocks: [
      {
        id: "b5",
        title: "从对称出发",
        text: "观察熟悉的函数图象，寻找图形特征与数量关系的联系。",
        questions: ["q5"],
        works: [],
        resources: [],
      },
      {
        id: "b6",
        title: "概念辨析",
        text: "检查定义域，再讨论 f(−x) 与 f(x) 的关系。",
        questions: ["q4"],
        works: [],
        resources: [],
      },
    ],
  },
];
export const RESOURCES = [
  {
    id: "r1",
    name: "函数的单调性.pptx",
    type: "PPT",
    folder: "教学课件",
    size: "2.4 MB",
    note: "图象观察、定义与例题。沿用自己的紫灰配色。",
    lessons: ["l1"],
    cover: "lesson",
  },
  {
    id: "r2",
    name: "我的课堂模板.pptx",
    type: "PPT",
    folder: "我的模板",
    size: "1.8 MB",
    note: "标题页、概念页、例题页和章节过渡。",
    lessons: [],
    cover: "template",
  },
  {
    id: "r3",
    name: "函数性质 · 导学案.docx",
    type: "Word",
    folder: "教学文档",
    size: "128 KB",
    note: "为学生保留思考与书写的空间。",
    lessons: ["l1"],
    cover: "document",
  },
  {
    id: "r4",
    name: "坐标系与图象.svg",
    type: "SVG",
    folder: "常用插图",
    size: "18 KB",
    note: "函数图象示意，使用时调整坐标与标注。",
    lessons: ["l1"],
    cover: "graph",
  },
  {
    id: "r5",
    name: "例题讲解版式.pptx",
    type: "PPT",
    folder: "我的模板",
    size: "640 KB",
    note: "左右对照，分步呈现解法。",
    lessons: [],
    cover: "example",
  },
  {
    id: "r6",
    name: "课堂观察笔记.pdf",
    type: "PDF",
    folder: "参考资料",
    size: "420 KB",
    note: "整理提问方式与学生回应。",
    lessons: [],
    cover: "notes",
  },
];
export const CLASSES = ["高一 · 理科强基班", "高一 · 数学拓展课"];
export const RECORDS = [
  {
    id: "c1",
    className: CLASSES[0],
    date: TODAY,
    title: "函数的单调性",
    progress: "定义与例题 1 已讲，例题 2 留到下次。",
    text: "学生能根据图象判断，但在定义证明中容易省略“任取”。下次先比较两份证明，请学生找出缺少的条件。",
    lesson: "l1",
  },
  {
    id: "c2",
    className: CLASSES[0],
    date: shiftDate(TODAY, -2),
    title: "函数的概念",
    progress: "函数表示与定义域",
    text: "从实际对应关系进入概念比较顺畅。需要再补一组定义域不同的例子。",
    lesson: "",
  },
];

export const WORKS = [
  { id: "w1", name: "观察二次函数的变化", type: "动态演示" },
  { id: "w2", name: "单调性的符号表达", type: "公式" },
];
