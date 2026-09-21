# 技能路由

本文只规定 skill 如何改变 TeacherWorkspace 的任务执行。产品依赖和授权仍由 MVP DAG 拥有，当前状态由 `run-state.md` 拥有，单次输入由任务包固定。模型、effort、harness 及常规核验的触发和产物由[执行协议的编排章节](execution-protocol.md#orchestration)唯一拥有；本文只说明 skill 的路由和内部边界。skill 不能扩大任务范围、写入集合、提交、合并、发布、外部写入或费用权限。

## 调度边界

- 根编排者只固定任务输入、派发独立 session、接收聚合回执，并管理依赖、状态和权限。根不实现产品，不代替业务 session 做实质设计或审查。
- 业务 session 之间不互聊，不自行增加 DAG 节点或将整个任务转派。skill 明示要求的有界内部 subagent 由调用该 skill 的 session 创建和管理，只向该 session 返回结果。
- 调用 session 聚合内部结果后向根只交一份回执。根不直接调度 skill 内部助手，不再派同内容的顶层审查。
- 任务包只列当前角色的协议章节和本次会触发的 skill；其他 skill 保持为条件读取。实际调用 skill 时完整读取它的 `SKILL.md` 及该路径必需的直接引用。

## 验证分层

1. **实现自检**：实现 session 运行任务包要求的类型检查、测试、启动和场景验证，回执级别为 `self`。
2. **skill 内部 code review**：`implement` 或明确审查请求触发一次双轴 diff 审查。这是调用 session 的收尾步骤，不是另一个 DAG 验收节点。
3. **阶段用户流程验收**：独立验收 session 在固定候选版本上通过实际 UI/API 重启和场景复现验证用户可见结果，回执级别为 `independent`。它不重复第 2 层的 diff 评论。

普通文档修正和状态更新完成必要自检即可；只在明确请求审查或命中下表触发条件时进入审查。

## 路由表

| 角色或触发条件 | skill | 最小输入 | 内部委派与检查 | 回执归属 |
| --- | --- | --- | --- | --- |
| 冻结规格或 tickets 的产品实现 | `implement` | 固定基线、规格/场景、写入清单、验证命令、Git 权限 | 适用时用 `tdd`；完成自检后由本 session 调用一次 `code-review` | 实现 session 聚合后交根 |
| 审查 branch、PR、WIP 或“自 X 以来”的更改 | `code-review` | 不可变 fixed point、commit 列表、非空 diff、规格源、标准源 | 并行启动 Standards 和 Spec 两个只读 subagent；内部 reviewer 遵循 `review-agent` 的不修改、不再委派边界，调用者分轴聚合 | 调用 session，再交根一份回执 |
| 用户要求 test-first/集成测试，或任务包已冻结必要 seam | `tdd` + `codebase-design` 参考 | 对外行为、已冻结 seam、独立预期值 | 无必需 subagent；红-绿垂直切片，通过公开接口验证 | 实现 session |
| 报错、失败、慢或明确要求 diagnose/debug | `diagnosing-bugs` | 用户症状、可运行环境、日志/样本 | 先建立接近用户路径的稳定 red-capable 循环，再假设、探针、修复与清理；只诊断时不实施修复 | 诊断/修复 session |
| 明确要求调研、查文档/API 事实 | `research` | 有界问题、一手来源范围、报告路径 | 调用者只创建一个背景调研 agent；调研 agent 不再递归调用 `research` | 调研调用 session |
| 修改术语、`CONTEXT.md` 或需要稳定重大决策 | `domain-modeling` | 相关 glossary、代码现状、写入权限 | 无；只在词义确有变化时更新 glossary，ADR 须同时满足三个门槛 | 设计 session |
| 设计模块接口、seam 或可测试性 | `codebase-design` | 调用者、依赖类型、现有接口与领域词汇 | 默认仅用共享词汇；只有明确探索多种接口方案时，`DESIGN-IT-TWICE.md` 才启动 3+ 内部 subagent | 设计/实现 session |
| 创建面向 agent 的文档 | `writing-for-agents` | 文档用途、触发分支、权威来源 | 无；使用渐进披露、单一事实源和可检验完成条件 | 文档作者 |
| 显式要求交互原型精炼 | 项目 `product-behavior-design` | 已选原型、可观察变更、package 边界 | 保留情景广度、可复现运行和证据要求；范围内细节由受托设计者决定 | 原型设计 session |
| 从已验收行为形成前后端共享契约 | 项目 `system-contract-design` | 已集成行为版本、场景 ID、现有契约与身份约定 | 保留双向可独立实现、成功/失败/恢复 case 和源版本检查 | 契约设计 session |
| 显式要求从当前讨论发布 spec 或 tickets | `to-spec` / `to-tickets` | 已定决策、验收行为、外部写入权限 | 不用于自动拆分现有 DAG；在已授权范围内以冻结 seam/任务包取代逐项询问 | 规格/拆票 session |
| 显式要求跨 session 压缩上下文 | `handoff` | 下一 session 目标和现有权威产物 | 无；只引用已有产物，不取代结构化回执 | 调用者指定的临时交接文档 |

## `implement` 与 `code-review` 的正确顺序

1. 任务包固定完整 `base_revision` 作为 fixed point，并给出规格源和标准源。分支别名或“最新”不能作为固定输入。
2. 实现 session 完成变更与自检。`code-review` 的原始命令 `git diff <fixed-point>...HEAD` 不包含未提交或仅暂存的变更；调用前必须确认所有受审实现都已进入 `HEAD`。
3. 只有任务已授权提交时，实现 session 才建立候选提交，然后校验 fixed point 可解析、commit 列表正确、工作区没有漏审变更且 diff 非空。未授权提交时，不能宣称按该 skill 审查了 WIP，应回执说明缺少可完整表示的审查目标。
4. 调用 session 同时启动 Standards 和 Spec 两个 subagent。无规格时只能按 skill 明示跳过 Spec 轴，不能把 Standards 结果冒充双轴 PASS。
5. 调用者保留两轴分离结果并聚合一次。实现者修复发现后运行定向自检；只有修复引入实质新范围或新风险时才再审，不默认重复同一评论。

## 项目约束对 skill 的覆盖

- `tdd` 的“先与用户确认 seam”由已冻结契约、场景和任务包满足；缺少时交设计拥有者，不让用户逐测试决定。UI 不写单元测试，其他单元测试仅在没有更合适的公开 seam 且确有必要时使用；优先集成和 E2E 行为。
- `diagnosing-bugs` 的反馈循环顺序受项目“先按终端用户体验复现”覆盖：UI 先用浏览器/E2E，API 先用真实 HTTP 入口，再缩小到更快 seam。
- `product-behavior-design`、`system-contract-design`、`grilling`、`to-spec` 和 `to-tickets` 中逐项询问、用户确认或讨论门禁，在已授权和已定范围内由受托设计者自行决定，并交任务包指定的独立审查。只有新范围、新外部权限、与已定产品/认证契约冲突，或无法从权威输入决定时才升级给用户。
- 原型集成、issue/ticket 发布、Git 提交、合并、发布和任何外部写入仍需任务包中的明确权限。设计决策的委托不等于这些操作权限。

## 模型与特殊触发

- 顶层核验和实现的模型、effort、harness 选择见[执行协议的唯一映射](execution-protocol.md#模型与固定派发)。常规核验的具体触发和产物见同一编排章节，不把所有设计或 A 类任务强制为同一模型。
- `code-review` 的 Standards/Spec 内部助手继承调用 session 的模型、effort 和 harness 能力；不另设根级模型验证项。实际能力缺口单独回报并处理，不以此更换前后端代码实现模型，也不重复已有审查。
- `grilling` 只在用户明确要求压力测试，或任务遇到上述必须升级的决策时调用。`prototype` 只用于回答明确的逻辑/外观设计问题。`wizard` 只用于必须由人执行的凭据、第三方界面或迁移流程。
- 只在已授权的 merge/rebase 正处于冲突时调用 `resolving-merge-conflicts`。其“完成并提交”不能越过 Git 权限。
- 代码实现、额度回退和其他任务的路由统一见[执行协议](execution-protocol.md#模型与固定派发)，skill 不新增更换实现模型的理由。dsh 调用形式及配置归属见[根 AGENTS 的 DeepSeek Harness 条款](../../AGENTS.md)，已查明的能力及实测边界见[dsh 调研](../research/dsh-receipts.md)。
