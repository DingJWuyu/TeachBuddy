# MVP 状态与规划入口

[返回 README](../README.md) · [产品范围](PRODUCT_SCOPE.md) · [工作台设计](WORKBENCH_DESIGN.md) · [B10/B11 执行基线](arch/execution-baseline.md) · [认证交接](contracts/auth.md)

本页只导航，不再维护第二套执行流程。MVP 的节点、依赖和授权停止点见 [交付 DAG](plans/mvp-dag.md)；当前执行状态和下一步见[运行台账](plans/run-state.md)；角色工作规则由其链接的执行协议拥有。

## 实际状态

2026-09-22 状态同步未改变运行代码。当前 `main@e9c3b58adf99a41e347947cccef646d85a3cd143` 的 `apps/web`、`apps/api` 仍是旧应用，真实 MVP 尚未交付。首流、认证、教学时间、Agent 和静态数学的已验证能力均在未合主干的任务分支；详细能力、边界与主干基线只在 [README 当前状态](../README.md#当前状态)维护，固定 SHA、验证级别与未决项只在[运行台账](plans/run-state.md#固定候选与必要证据)维护。

当前可消费的固定结论是：B16 首流 independent PASS，仍为 `test-principal`；A12 认证和 T54 教学时间组合本地 independent PASS，仍保留邮件、目标设备、可信证书和备份恢复等外部边界；C27 Agent 候选经公式排版复验后本地 independent PASS，与原两模型真业务链的未变结论合用。C26 与 C27 账本分别保持 10 次 / 79,983 totalTokens 和 11 次 / 88,550 totalTokens，排版修复与限定复验没有新增产品模型请求；实际费用未知，`cost=0` 不证明免费。

R30 已完成最终限定冻结，只冻结材料设计、实验消费和后续放行边界；完整 R31 已启动。真在线 C21 最新 `2b10b4e` / `4115bb6` 仍为 FAIL，材料和在线采集没有交付。M41 静态数学候选只完成 self PASS，M42 正在实施，M43、M44 与完整数学关联尚未通过。完整 MVP 还需后续模块组合、可靠性、真实外部条件、部署和备份恢复验收。

文档拆分的 v2 受审版本已由[独立审查](plans/mvp-dag-refactor-review.md)核验 PASS；本次 v2.1 只同步已授权的执行规则，不把旧 PASS 扩展到新版本。RR-01/02/03 已由作者修正并自查，用户取消独立复审，不记录为修正后独立 PASS。G00 已通过，按依赖推进产品实施。合并、推送及公开交付的权限按 DAG 用户门禁分别核对。

## 按目的进入

| 读者或任务 | 读取路径 |
| --- | --- |
| 用户检查阶段、成果和授权点 | [DAG 用户总览](plans/mvp-dag.md#用户总览)及用户门禁。 |
| 编排者派发与接回执 | [DAG](plans/mvp-dag.md)及[编排协议](plans/execution-protocol.md#orchestration)。 |
| 当前运行状态、待回执和下一步 | [运行台账](plans/run-state.md)。 |
| 进入首条流程设计与实现 | 先读 [B10/B11 执行基线](arch/execution-baseline.md)，再按任务包读取 B11 的范围、行为和 ADR 输入；旧首流继续消费 B11/v1 与 `test-principal` 固定输入。 |
| 进入认证实现与真实交接 | 读取 [认证契约](contracts/auth.md)、[认证实现架构](arch/auth-implementation.md) 和 [认证前后端任务包](plans/tasks/auth-implementation.md)；新消费者固定 `rc.2` + `candidate.2`，本地候选与外部交付边界从运行台账核对。 |
| 核对固定交付候选的首流、恢复和桌面/Pad 证据 | 读取 [B16 独立报告](acceptance/evidence/B16/v1/attempt2.md) 及其中的[既有验收 runner](acceptance/evidence/B16/v1/attempt2/run-acceptance.mjs)。 |
| 设计、实现、独立验收 | 从本次任务包读取本角色、当前节点和相关规格；不从本页全量展开。 |
| 设计者准备单次任务 | [任务包模板](plans/task-package.md)。 |
| 核查完整 MVP 覆盖 | [唯一范围映射](acceptance/mvp-matrix.md#scope)；范围本身仍归 PRODUCT_SCOPE。 |
| 核查运行方式与已交付能力 | [README](../README.md)，不把计划要求当成实现状态。 |

## 与旧入口的关系

旧 ROADMAP 的常驻三 Agent、协调者兼任设计/实现/验收、worker 自由讨论和按旧阶段开工的指令已被替代。其他既有文档中指向本页的“三 Agent”等执行描述，应从这里转到新角色入口；这不修改它们拥有的范围、行为或视觉约束。

认证契约已由限定独立审查冻结为 `1.0.0-rc.2`，工作台同步消费 `0.1.0-candidate.2`。A12 已有本地 independent PASS，但 fake-mail、自签 HTTPS、视口模拟和普通重启不替代外部邮件、目标物理设备、可信证书或备份恢复验收。旧 B11/v1 与 `test-principal` 的首流消费边界继续有效，不因新版冻结或文档入口整理而切换。

范围内设计交由设计 session 决定，逐条真实流程的行为、契约、实现和独立验证仍保留。原型只作交互参考，不恢复全量原型评审作为额外门禁；既有历史证据只证明其适用版本。完整 MVP 须覆盖全部已确认能力，阶段内部通过和用户验收按 DAG 分别记录。
