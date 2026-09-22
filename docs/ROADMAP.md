# MVP 状态与规划入口

[返回 README](../README.md) · [产品范围](PRODUCT_SCOPE.md) · [工作台设计](WORKBENCH_DESIGN.md) · [B10/B11 执行基线](arch/execution-baseline.md) · [认证交接](contracts/auth.md)

本页只导航，不再维护第二套执行流程。MVP 的节点、依赖和授权停止点见 [交付 DAG](plans/mvp-dag.md)；当前执行状态和下一步见[运行台账](plans/run-state.md)；角色工作规则由其链接的执行协议拥有。

## 实际状态

2026-09-21 文档基线整理与只读审计已完成，未改变运行代码。`apps/web`、`apps/api` 仍是旧应用，尚未交付真实 MVP；认证 `1.0.0-rc.2` 与工作台 `0.1.0-candidate.2` 已冻结，认证前后端及 A11 本地真实接线已自验，真实外部条件与 A12 独立验收尚未完成；原型工作台仍使用内存数据和固定回复。固定交付候选 `feat/b15-first-flow@612f0a9868743a1d5eea7e6f236d3ff903752439` 的录题、复制改编、备课引用、持久重启、失败恢复及桌面/Pad 已由 [B16 独立报告](acceptance/evidence/B16/v1/attempt2.md) 独立通过，身份仍为 `test-principal`；候选未合入 `main`，不改变主干交付状态。完整 MVP、真实认证、真实 AI、材料和部署仍未通过。详细能力、差距与代码基线只在 [README 当前状态](../README.md#当前状态)维护。

首条题目到备课链路已在固定候选独立通过；材料、数学、教学时间、认证与 Agent 分别处于实验、设计、局部自验或集成阶段。当前五项恢复任务及各自门槛以运行台账为准，不能把部分成果称为完整 MVP。

文档拆分的 v2 受审版本已由[独立审查](plans/mvp-dag-refactor-review.md)核验 PASS；本次 v2.1 只同步已授权的执行规则，不把旧 PASS 扩展到新版本。RR-01/02/03 已由作者修正并自查，用户取消独立复审，不记录为修正后独立 PASS。G00 已通过，按依赖推进产品实施。合并、推送及公开交付的权限按 DAG 用户门禁分别核对。

## 按目的进入

| 读者或任务 | 读取路径 |
| --- | --- |
| 用户检查阶段、成果和授权点 | [DAG 用户总览](plans/mvp-dag.md#用户总览)及用户门禁。 |
| 编排者派发与接回执 | [DAG](plans/mvp-dag.md)及[编排协议](plans/execution-protocol.md#orchestration)。 |
| 当前运行状态、待回执和下一步 | [运行台账](plans/run-state.md)。 |
| 进入首条流程设计与实现 | 先读 [B10/B11 执行基线](arch/execution-baseline.md)，再按任务包读取 B11 的范围、行为和 ADR 输入；旧首流继续消费 B11/v1 与 `test-principal` 固定输入。 |
| 进入认证实现与真实交接 | 读取 [认证契约](contracts/auth.md)、[认证实现架构](arch/auth-implementation.md) 和 [认证前后端任务包](plans/tasks/auth-implementation.md)；新消费者固定 `rc.2` + `candidate.2`，真实认证仍待交付。 |
| 核对固定交付候选的首流、恢复和桌面/Pad 证据 | 读取 [B16 独立报告](acceptance/evidence/B16/v1/attempt2.md) 及其中的[既有验收 runner](acceptance/evidence/B16/v1/attempt2/run-acceptance.mjs)。 |
| 设计、实现、独立验收 | 从本次任务包读取本角色、当前节点和相关规格；不从本页全量展开。 |
| 设计者准备单次任务 | [任务包模板](plans/task-package.md)。 |
| 核查完整 MVP 覆盖 | [唯一范围映射](acceptance/mvp-matrix.md#scope)；范围本身仍归 PRODUCT_SCOPE。 |
| 核查运行方式与已交付能力 | [README](../README.md)，不把计划要求当成实现状态。 |

## 与旧入口的关系

旧 ROADMAP 的常驻三 Agent、协调者兼任设计/实现/验收、worker 自由讨论和按旧阶段开工的指令已被替代。其他既有文档中指向本页的“三 Agent”等执行描述，应从这里转到新角色入口；这不修改它们拥有的范围、行为或视觉约束。

认证契约已由限定独立审查冻结为 `1.0.0-rc.2`，工作台同步消费 `0.1.0-candidate.2`；认证前后端与 A11 本地真实接线已自验，真实外部条件与 A12 独立验收尚未交付；详细状态见运行台账。旧 B11/v1 与 `test-principal` 的首流消费边界继续有效，不因新版冻结或文档入口整理而切换，也不能据此宣称真实认证已完成。

范围内设计交由设计 session 决定，逐条真实流程的行为、契约、实现和独立验证仍保留。原型只作交互参考，不恢复全量原型评审作为额外门禁；既有历史证据只证明其适用版本。完整 MVP 须覆盖全部已确认能力，阶段内部通过和用户验收按 DAG 分别记录。
