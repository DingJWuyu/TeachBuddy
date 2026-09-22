# 内部双轴审查

层级 skill-internal/self；不是 R35 独立验收。两个只读叶子助手继承本 session 模型与 effort，无继续委派、无文件写入、无业务 session 通信。

固定点 `9b0d09a9152d47f0039ca01bf16ff3beb938f757`，目标 `d64f3f3ef26ffe45a9f9d23f2ca2dca4d2091539`。命令 `git diff 9b0d09a9152d47f0039ca01bf16ff3beb938f757...d64f3f3ef26ffe45a9f9d23f2ca2dca4d2091539`；唯一提交 `d64f3f3 fix(questions): normalize native math and preserve local recovery`。调用时所有产品/API/E2E/fixture已提交，仅新证据目录未跟踪。

## Standards

2 项硬问题，无额外 smell 建议；未发现越权共享文件、UI 单元测试或无必要抽象。

1. P1：斜杠分式转换把 `x/2^3` 变为 `\frac{x}{2}^3`，或把 `x^2/3` 变为 `x^\frac{2}{3}`，违反保持原稿数学语义的目标。
2. P2：识别条件未覆盖 `2×3` 与 `x+2`，规范化支持分支不可达，未完成可编辑数学源。

当前处理：含幂/下标的斜杠表达保留忠实的可编辑 LaTeX 原式；清晰乘除与单字母代数表达纳入转换。浏览器 `math precedence...` 实际输入、排版、源断言通过。不是将含幂式再解释为猜测分数树。

## Spec

3 项，最严重 P1；未发现新增越权共享修改。T 未达 4/6 与在线 BLOCKED 是明确披露的剩余边界。

1. P1：同上述幂与斜杠转换问题，规格要求分式/上下标。
2. P1：新增嵌套列表没有进入缺图检查，选项“如图”可能绕过阻断。
3. P2：剥离“说明”后结束题目，后续已有答案被误置未分配，题目变成 absent。

当前处理：递归读取所有文档块进行缺图检查；分离说明时保留所属题上下文并从正文/答案定位中排除说明范围。真实 API 验证 nested missing-figure 即使 acknowledged 也返回 draft-not-ready，答案状态仍 present、位置不包含说明；浏览器联合回归通过。

合计 Standards 2 / Spec 3，去重为 4 项，全部有定向关闭证据：`review-red.log`、`browser-reviewed.log`、`questions-api-final.log`。修复属于同一输入语义和校对边界，没有新增公共契约或风险面；未重复调用双轴审查，也不称最终增量经过第二次独立 PASS。
