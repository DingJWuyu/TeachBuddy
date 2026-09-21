# 长程 Agent 构建：失败模式与流程候选

- 访问日期为 2026-09-21。本文是研究笔记，不是已经批准或实施的新计划。
- 用户当前规则优先于上一轮 ROADMAP：普通实现默认使用 Luna max，困难实现才升级 Sol high；常规核验和 skill 内部 reviewer 使用 Sol high，复杂疑难审查才升级 Astra。顶层 session 由编排者派发和接收聚合回执，业务 session 不自由互聊；skill 明确要求的有界内部助手由调用 session 管理。简单功能先做，逐步覆盖全部 MVP。
- 本轮未修改产品代码、认证契约或 ROADMAP。

## 可核实的观察

- Anthropic 在跨上下文构建中观察到一次承担过多工作、留下未说明的半成品、过早宣布完成等问题。其方法包括逐项功能清单、进度交接、Git 历史和运行中的端到端验证。这是特定应用实验，不证明仅靠持续循环就能可靠交付。[来源：2025-11-26，Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)。
- Cursor 的平级 Agent 自协调实验出现锁等待、状态协调失效和端到端责任分散。后来改为规划者分派任务、worker 专注执行且不互相协调。该团队仍报告多 Agent 有效进展，因此不能把这个失败案例解释为所有多 Agent 方法均已失败。[来源：2026-01-14，Scaling long-running autonomous coding](https://cursor.com/blog/scaling-agents)。
- Anthropic 发现生成者自评偏宽松，独立评审能提供修正反馈，但评审 Agent 也会发现缺陷后自行放行，仍需校准。其一项案例完整 harness 的报告费用约为单 Agent 的 20 倍以上；两者产物范围也不同，不能将该数字当成通用成本预测。作者通过逐个移除组件研究必要性。[来源：2026-03-24，Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)。
- 一项控制实验比较了不同 Agent 架构。收益取决于任务能否分解及协作结构；工具密集任务会付出协调开销，集中验证有助于控制错误传播。这里依据 2026-04-08 的 v3，不能混用搜索摘要中的旧版数字，也不能直接外推到本项目。[来源：Towards a Science of Scaling Agent Systems，v3](https://arxiv.org/abs/2512.08296v3)。

## BDD 与浏览器验证

- Cucumber 将 Gherkin 步骤绑定到执行代码，步骤可以驱动真实浏览器。因此“Cucumber 不模拟用户事件”不是成立的一般结论。[Cucumber 官方步骤定义](https://cucumber.io/docs/cucumber/step-definitions/)。
- Playwright 的普通点击会检查可见性、稳定性和目标能否接收事件；直接派发 DOM 事件和强制点击可以绕过部分真实交互条件。执行路径比框架名称更能决定验证是否贴近用户。[Playwright Actions](https://playwright.dev/docs/input)、[Actionability](https://playwright.dev/docs/actionability)。
- 本项目可用浏览器 E2E 回归固定行为，用独立 browser-use 走查发现布局与操作问题；两者互补。遵守现有规则，不为 UI 编写单元测试。此项是本项目建议，不是上述文档的实验结论。

## 针对本项目的候选安排

- 设计者先定义用户故事、必要的 UX 状态、共享契约与 BDD 验收条件；是否需要独立审查由任务包和节点门禁决定。普通文档修正和状态更新完成必要自检即可，不因每次同步自动追加 review。
- 默认先派一个低成本 worker 处理有边界的任务。只有依赖清楚、契约稳定且修改范围不冲突时才并行派工。worker 向统一负责人交付结果，不自行协商或改写共享契约。
- 每个任务说明引用需求、契约版本、允许修改的文件、验收方式及失败后如何交接。实现者可以提出规格问题，但不能通过删减验收条件宣布完成。
- 先以简单 CRUD 验证启动、可重置测试数据、真实前后端操作、持久化、失败反馈、回归、独立验收和交接恢复的完整过程。模型运行循环建立在这些可观察结果之上。
- 在反馈流程可用后逐步加入复杂关联、OCR、Office 转换、数学制作与 Agent 能力。困难能力仍属完整 MVP，不通过改名或缩范围回避。
- 用户故事说明目标与价值，UX 说明布局与互动状态，架构及接口说明边界，BDD 描述可观察结果。计划按编号引用这些材料，同一规则只在一处维护。
- 验证需要证明错误实现会被拒绝。例如，页面显示保存成功但刷新后内容消失，应使对应验收失败；运行命令退出码成功本身不足以说明行为正确。
- 同类失败达到任务约定的重试界限后，worker 提交复现与证据，由负责人判断契约、环境或实现问题。先使用已有 runner、Git 与测试工具，避免先建设复杂调度平台。
- 用户分享中的高密度人工 review 是条件，独立 AI 评审不能声称与其等价。本项目应沿用已有审美与范围结论，保留可审查证据，并区分内部验证与用户验收。

本笔记没有验证 dsh 或 luna 在本项目的实际成功率与成本，也没有证明某个固定 Agent 数量最优。后续用简单任务的结果决定是否需要增加并行度或评审频率。
