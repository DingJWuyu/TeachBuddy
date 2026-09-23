# B10 执行基线与 B11 交接

本页是 `B10@1`、attempt `1` 的普通文档/Git 准备结果。它固定首条流程下一步应从哪里开始、哪些文件由谁写，以及当前仍未实现的能力；它不是产品契约、认证交接或 MVP 验收结论。

## 固定版本与工作区

| 项目 | 固定值 |
| --- | --- |
| 用户指定输入 | `9f93c2a3f9d24a92c978c82438999f7e962993e0` |
| 代码状态基线 | `911e62469a0298339613385b7e4a1f8d90822191` |
| 已集成文档基线 | `5eab55d64463215b7e9c044ffb71edb5c365d0e9`，已在输入提交祖先中 |
| B10 交付分支 | `chore/b10-entry` |
| B10 交付 worktree | `/home/liam_t/项目/TeacherWorkspace-b10` |
| B10 revision | `B10/v1`，候选提交见本任务正式回执 |
| 身份模式 | 不适用；本节点未运行产品 |

现有 worktree 在开始时干净，并已独立落在用户指定输入提交。它已经是短期交付分支/worktree，因此本节点没有再复制一个等价集成 worktree。B11 应从 B10 候选提交另建自己的短期 worktree，不在 `main` 上直接开发。

根编排在 B10 派发后对 `run-state` 做过状态记录；`run-state.md` 与 `mvp-dag.md` 仍由根维护，本节点没有同步、改写或把它们列入候选。B10 的固定输入不随当前 `main` 漂移。

## 已集成成果与权威入口

- `5eab55d` 文档基线、获批计划及其后的文档规则、研究回执和实施授权均已存在于本输入提交的历史中，不需要 B11 重复引入。
- 实际运行能力仍以 [README 当前状态](../../README.md#当前状态) 为准：`apps/web` 和 `apps/api` 是旧工作台/账户底座，`packages/shared` 的模块目录为空，`prototype/` 只作交互参考。
- 产品范围只读 [PRODUCT_SCOPE](../PRODUCT_SCOPE.md)；工作台行为和页面结构只读 [WORKBENCH_DESIGN](../WORKBENCH_DESIGN.md)；静态模块目录边界只读 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)。
- [API 指南](../API.md)描述旧 Bearer API，不是新工作台契约；新 schema、错误例、公共端口和 B12-B15 的逐文件边界必须由 B11 冻结。
- B10/B11 的旧固定输入把认证契约视作 `partial`，该旧消费边界仍保留；当前认证契约已冻结为 `1.0.0-rc.2`，前后端实施中，真实认证仍由后续实现与 A10/A11 交付。B11 不修改认证契约、认证实现或原型认证证据，也不能让浏览器自报 `accountId` 作为身份依据。

## B11 必要输入

B11 从以下固定输入开始，不需要追溯旧 `PROJECT_PLAN.md`、旧三 Agent 入口或空模块 API 来补产品语义：

1. `docs/plans/tasks/first-flow.md#b11`：本轮目标、首条流程和 B12-B15 交接要求。
2. `docs/PRODUCT_SCOPE.md` 的题库、备课、跨模块能力和基础交付段落。
3. `docs/WORKBENCH_DESIGN.md` 的整体结构、题库、备课和行为验证重点段落。
4. `docs/adr/0001-use-a-single-static-module-catalog.md`：模块目录、公共端口和边界约束。
5. `docs/plans/execution-protocol.md` 的 design、ownership、receipt 章节，以及本页的 Git 基线和写入清单。

认证只作为 B10/B11 旧输入中的身份接缝现状：旧首流继续按 B11/v1/test-principal 消费；新认证实现按已冻结的同版 `rc.2`/`candidate.2` 进入独立任务包。B11 不临时补字段，也不把旧测试身份或冻结契约当成真实认证已交付。

## 写入所有权

下表是 B11 冻结逐文件任务包前的唯一交接边界。B11 必须在其任务包中把路径收窄到实际文件；未列入的共享文件不得被并行节点自行修改。

| 写入者 | 当前授权边界 | 明确不拥有 |
| --- | --- | --- |
| B10 | `README.md`、`docs/ROADMAP.md`、`docs/ARCHITECTURE.md`、`docs/SETUP.md`、`docs/API.md`、本页及 B10 回执 | `run-state.md`、`mvp-dag.md`、产品代码、认证代码、认证契约 |
| B11 | `docs/user-stories/first-flow.md`、`docs/ux/first-flow.md`、`docs/contracts/workbench.md`、本批唯一 schema/OpenAPI、`docs/arch/first-flow.md`、`docs/acceptance/first-flow.feature` 及 B12-B15 任务包；具体 schema 文件名由 B11 固定 | `apps/` 实现、认证契约、已有 ADR、根台账/DAG |
| B12 | 共享存储/迁移入口、静态模块目录投影、公共 schema 使用代码、启动与测试隔离设施；逐项共享文件由 B11 任务包冻结 | B13/B14 模块业务目录、认证所有权、临时扩展旧 API |
| B13 | `apps/api/src/modules/questions/`、`apps/api/src/modules/lessons/` 及对应迁移、仓储和 API 测试 | B12 公共入口、B14 Web、B15 集成 spec、认证实现 |
| B14 | `apps/web/src/features/questions/`、`apps/web/src/features/lessons/` 及任务包点名的工作台外壳、设置和样式文件 | 认证表单/认证代码、B13 API 模块、B15 故障注入 |
| B15 | 首条流程独占浏览器 spec、故障注入、集成候选和对应证据；共用 runner 由 B12 所有 | 契约字段、迁移、认证实现、通过修改旧断言降低门槛 |
| 根编排 | `docs/plans/run-state.md`、`docs/plans/mvp-dag.md`、任务派发记录、main 合并及外部发布动作 | B11-B15 的产品实现和契约语义 |

共享文件的实际写者优先以 B11 冻结的逐文件清单为准。若契约出现缺口，回 B11 产生新 revision；实现者不能在自己的分支临时改变字段。

## 未决的真实缺口

- 首条题库到备课的真实业务契约、稳定对象 ID、来源/副本、引用更新、冲突、幂等和保存失败语义尚未冻结。
- `apps/` 尚无题库、备课业务模块；当前模块 API 返回空目录，旧布局和 Bearer 行为不能证明目标流程。
- B12 尚未交付独立 SQLite/文件目录、测试身份、同源 HTTPS、生产构建隔离和失败反馈设施。
- 认证实现、会话生命周期、退出、邮件链路和账户隔离仍由认证工作线交付；当前契约已冻结，但真实服务尚未交付。旧 B11/v1/test-principal 首流结果不能替代新版 real-auth 验收。
- 真实浏览器首条流程、API 重启、写入中断、草稿恢复和不重复重试均未执行。

## 研究输入校验

开始检查时 `git ls-files --others --exclude-standard` 为空，没有未跟踪研究输入或用户改动需要快照；因此没有伪造未跟踪文件 SHA。已跟踪研究材料的当前校验值如下，供接续者识别同一输入：

| 文件 | SHA-256 |
| --- | --- |
| `docs/research/command-code-api.md` | `2239bbdb9172dcc4a046aa38a197b185798c24fbc698ef6d1707e2bfa4140ed3` |
| `docs/research/deployment-options.md` | `87ce46a2eeecfcd79a02ece16678b2399b2293c3408a2729b85f43d296c60a51` |
| `docs/research/dsh-receipts.md` | `31e34408e467657c3bb33a9852bfcd5ac8604e9c181176fd978788e63589c06` |
| `docs/research/long-running-agents.md` | `ba8c943b90edd75fc0d18dcd3ec5e70481c3863a4f3b7efe219b83d7ba2ebd50` |
| `docs/research/readiness-review.md` | `2348aefea9d13bc3805af8d842dbe7958fc05cadd01effebce41a58c7918a614` |

## B10 自检范围

本节点只做入口、Git 隔离和文档一致性自检，不启动 API、浏览器、认证、模型或其他 session。正式结果、候选 SHA、实际修改文件和检查命令见 [B10/v1 回执](../acceptance/evidence/B10/v1/receipt.md)。
