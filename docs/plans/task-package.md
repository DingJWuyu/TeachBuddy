# 单次任务包模板

本文件供设计者填写、编排者派发。执行者收到的是填好的单次任务包，不必读取模板、DAG 或其他任务。用一份 Markdown 即可，存放在 `.scratch/dag-dispatch/<节点>/<attempt>/task.md`；不建分发工具。

有 Git 版本的输入用**完整 commit SHA + 文件路径 + 章节**。未提交输入、外部样本及无法由 commit 定位的证据才按需要用绝对路径 + SHA-256，并保留对应快照。分支名、“最新代码”和聊天上下文不能代替固定输入。每条输入标明必读或具体触发条件，DAG 版本只供编排追溯，不自动加入执行者必读列表。

```markdown
# <节点>@<revision> / <attempt> / <design|implement|review|integrate>

- 目标：本次交付的可观察结果。
- 非目标：本次不处理的相邻问题。
- 授权：来源、适用范围、提交/合并/外部动作权限。
- Git 权限：提交、合并、推送、发布等动作逐项写明；未明确的动作视为未授权。
- 角色：本次责任、顶层模型/effort/harness、新独立 session；编排者 thread ID。角色代号不等于模型，必须写实际选择。
- 适用 skill：本次会触发的 skill 及其完整入口；未触发的 skill 不因相邻任务自动调用。
- 核验触发与产物：若属于常规核验、契约交接/规格一致性检查或一手来源/skill 事实核对，写明对应触发条件、固定场景、最小证据和 `self`/`independent` 回执级别；普通文档修正只写必要自检。
- 基线与 fixed point：完整 `base_revision`、需要审查时的 fixed point、输入回执位置及版本；计划 revision（追溯用）。
- 规格与标准来源：本次使用的 spec、验收矩阵、仓库标准和 review 标准的完整 commit + path + 章节。
- 内部委派：是否允许 skill 内部助手、每个内部角色及 harness；适用 skill 要求时由调用 session 创建和管理，内部助手继承调用 session 的模型与 effort。若选择 dsh，记录 `dsh --profile headless`、配置归属和能力证据，不把 dsh 记录为 Luna。
- 工作区：worktree、分支、端口、数据/文件目录、身份模式、用户已有改动。

## 本任务必读，按顺序
1. 本次适用的用户指令和根 AGENTS 版本；未提交条款也携带原文。
2. execution-protocol 的本角色锚点和 receipt 锚点。
3. 当前节点说明，精确到文件和锚点。
4. 本次相关的冻结规格/契约操作/场景，逐项给 commit + path + 章节。
5. 相关验收条目及证据章节，给具体锚点，不写“全读矩阵”。

## 条件读取
- 若 <真实触发条件>，读取 <固定版本、路径、章节>，用于 <决定>。
- UI 实现/视觉验收：设计规则与本次 UX；纯后端 CRUD 不触发。
- 修改公共文件/迁移：execution-protocol#ownership。
- 承担 Git 准备或集成：execution-protocol#integration。

## 写入与产出
- 精确写入清单、共享文件唯一写者、只读/外部负责人范围。
- 产物路径、每项完成条件。不能写“所有必要文件”。

## 验证和移交
- 场景/验收条目、样本、启动与故障复现命令、实际入口。
- 预期结果、证据路径、独立验收节点/角色。
- 已知失败与最小复现、设计拥有者、外部阻塞提供者。
- 回执绝对路径：按 execution-protocol#receipt 返回；结束后停止。
```

模板中的未来路径是待填写字段，不表示文件已存在。任务包缺契约、精确写入清单或验证入口时，设计者补齐并经独立审查后才派发，编排者不代填产品决定。

## 阅读路径示例

以下只验证入口设计，不是已授权的派发。各角色均有根 AGENTS 和本次指令；执行角色另读协议的 `receipt`。未来冻结契约与运行回执均须填入实际 commit + path。

| 角色 | 最小必读路径 | 条件读取 |
| --- | --- | --- |
| 编排 | DAG、协议 `orchestration`、本模板、固定依赖回执与已冻结任务包 | 缺技术判断时派对应设计/审查，不展开实现手册。 |
| B11 设计 | 任务包、协议 `design`、`first-flow.md#b11` 和其设计输入、相关范围/行为及 ADR | 编制写入清单读 `ownership`；有 UI 决定读设计规则。 |
| B13 后端 CRUD | 任务包、协议 `implementation`、`first-flow.md#b13`、B11 冻结的相关 API/schema/场景、B12 运行回执、矩阵 `evidence`/`persistence`/`backend-self` | 写迁移读 `ownership`；承担集成才读 `integration`。 |
| B16 UI/流程验收 | 任务包、协议 `acceptance`、B15 候选与运行回执、首条流程场景/UX、矩阵 `b16`/`evidence`/`persistence`/`browser`/`visual`、设计规则 | 只为失败定位读取相关实现；不展开材料、数学、日程等模块。 |

B13 和 B16 的入口均不经过 DAG、全范围矩阵或编排命令；两者也不读取对方角色的协议。
