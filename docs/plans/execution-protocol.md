# MVP 执行协议

本协议按角色分段。任务包必须链接具体锚点，只加载本角色及触发的章节；不要求任何 session 通读。仓库稳定规则由根 [AGENTS.md](../../AGENTS.md) 拥有，范围由 [PRODUCT_SCOPE](../PRODUCT_SCOPE.md) 拥有。

<a id="orchestration"></a>
## 编排者

### 调度台账与恢复

编排者可以维护[运行台账](run-state.md)中的调度元数据：状态、授权引用、session ID、版本、回执索引和下一步。产品规格、代码、修复与实质验收结论仍由相应角色负责；状态更新不另派文档 session。

- 派发前记录任务和输入；启动成功后记录实际 session 与运行状态。
- 回执到达时核对 `task`、`revision`、`attempt`、`session_id` 和 `verification_level`，再更新状态。重复回执或旧版本回执不重复派发、不推进下游。
- 恢复时先读根 `AGENTS.md` 的条件入口、当前运行台账和未完成任务的固定任务包/回执。收到内容恰为 `check` 时，根先读 `run-state`；只有存在未完成任务且台账显示近 45 分钟没有回执，才对相关 session 做一次恢复检查。这个 `check` 同时判断回执缺失和异常通知：正常 `FAIL` 仍回原节点处理，只有子进程或运行环境异常、结果已落盘但通知未到等情况才按回执缺失处理。没有未完成任务或已有近期回执时结束本次检查。若结果已保存但回执丢失，按原 `task`、`revision`、`attempt` 接续；session 仍正常运行则等待；明确中断才按既有失败归属处理。超过 45 分钟本身不判失败，不杀死健康进程，不盲目重派；这项 `check` 是获授权的低频例外，不是循环轮询或 watcher，也不能启动产品 DAG。
- 活跃任务包或证据未完成时保留；正式验收回执和证据按既有 evidence 约定可追溯后，再清理无用临时日志。台账只引用真实存在的材料，未来路径明确标为待生成，不复制研究或验收全文。

### 派发与收回执

1. 从 [DAG](mvp-dag.md) 选取依赖与授权均满足的节点。使用设计者已经冻结的[任务包](task-package.md)，核对版本、角色、写入边界、验收负责人和回执位置是否齐全。
2. 顶层设计、实现、重试、集成及独立审查各启动独立的新 session。业务 session 之间不互聊、不自行派工、不扩展 DAG。只有被调用 skill 明确要求有界内部助手时，调用 session 才可创建并管理这些助手，向自己聚合结果；内部助手不单列 DAG 节点、不与业务 session 自由互聊、不继续委派。不得 resume/fork 旧 worker 或建立常驻团队。
3. 编排者只核对结构化回执、依赖和权限。它不补产品设计、不实现、不修复、不实质审查代码或视觉。缺任务细节交设计者，缺证据交新 reviewer。
4. 接收 PASS 时核对 `verification_level`。实现自验为 `self`，设计冻结和独立验收为 `independent`，用户门禁为 `user`。阶段验收及必要的实际状态同步均完成后才报告阶段 PASS；自验不能代替阶段放行。阶段文档同步是记录动作，不自动增加另一轮审查。
5. 普通文档修正和运行状态更新完成必要自检后直接交回或集成，不自动追加审查。编排者只维护运行台账中的调度元数据，不另派状态文档 session；产品行为、代码和实质验收结论仍归对应角色。

### 核验触发与产物

“常规核验”是边界明确的顶层独立判断，默认使用 `gpt-5.6-sol`、`high`，不等于每次改文件或缺一个字段就另派 reviewer，也不等于 `implement` 内部的 `code-review`。触发条件和最小产物如下：

- 阶段独立验收：在固定候选上复现实际用户流程、保存和恢复，并返回 `independent` 回执及证据。例如 B16 走“新建题目 → 真实保存 → 备课引用 → 刷新或重启后继续使用”，R35 使用真实文件并核对导出结果，A12 验证真实登录、退出后的数据隔离。
- 任务明确要求的契约交接或规格一致性检查：对固定版本的接口、行为、所有权和失败 case 逐项核对，产出缺口清单、证据引用和归属，不代替设计者改契约。
- 明确必要的一手来源或 skill 事实核对：核对指定官方来源、技能规则或 harness 能力，产出来源位置、事实结论和未证实项；`skill-routing` 的技能读取核对属于此类。

实现 session 的自检、skill 内部双轴 code review、上述阶段实际用户流程验收是三层不同活动。普通文档修正和运行状态更新只做必要自检。复杂行为、契约、架构设计或复杂疑难审查才升级为 `gpt-6-astra`、`high`；角色 A 同时覆盖设计和验收，角色代号不决定模型。

### 模型与固定派发

以下是模型、effort 和 harness 的唯一权威映射。任务包和回执必须记录实际选择，不得把角色代号当作模型：

| 任务类型/代号 | 模型、effort、harness | 责任 |
| --- | --- | --- |
| A · 复杂行为、契约、架构设计或复杂疑难审查 | `gpt-6-astra`，`high`，新 `codex exec` | 形成设计判断或独立审查，不写或修产品实现。 |
| A · 上述常规核验 | `gpt-5.6-sol`，`high`，新 `codex exec` | 按固定场景、契约检查或一手来源事实核对返回独立结论。 |
| W · 实现、实验、调研、文档和集成 | 默认 `gpt-5.6-luna`，`max`，新 `codex exec` | 执行冻结任务并自检。 |
| S · 有具体失败依据的困难实现升级 | `gpt-5.6-sol`，`high`，新 `codex exec` | 只在实现失败证据支持升级时使用。 |
| W 替代 · 已获实施授权的有界实现任务 | `dsh --profile headless`，模型和 effort 读取 `~/.dsh/settings.yaml` | 根可在任务包中选择 dsh 或 Codex Luna，不要求用户逐节点再次指定；不把 Luna max 套给 dsh，不读出或输出配置秘密。 |
| skill 内部助手 | 继承调用 session 的模型、effort 和 harness 能力 | 由调用 session 按 skill 创建、管理并聚合；能力未证实则选择具备该能力的 Codex 或按协议回执 `BLOCKED`。 |
| 用户 | 无模型 | 授权和用户验收，见 DAG 用户门禁。 |

设计或独立验收节点是否需要独立 session 由任务包和节点门禁确定。`implement` 的 `code-review` 是调用 session 的收尾步骤，内部 Standards/Spec reviewer 是只读叶子，由调用 session 管理并聚合，不增加 DAG 节点；根不再派同内容的顶层 diff review。产品里的 pi runtime 与上述开发 harness 分开，产品模型白名单不因开发 harness 选择而扩大。

### 并行与版本

- 默认只运行一个修改产品的 W。B13/B14 仅在 B12 公共文件落地、两侧契约同版且逐文件写入集合无交集时并行，否则顺序执行。C21-C24 只写隔离实验目录，可并行。只读审查也必须读取不会同时变化的候选和证据。
- 认证输入一到，按 DAG 依赖尽早安排；与 Agent 或主业务共用入口时串行集成。身份未就绪可继续不依赖它的业务工作，身份局限由回执记录。
- 输入版本的写法由任务包模板定义。适用的用户指令及未提交 AGENTS 条款必须携带到新 worktree，不能因不在 main 上而丢失。
- 新批次由设计者提供完整可派发任务包。若需要细分实现节点，设计者提出有限子节点及其依赖、版本、所有权和验收人，经任务包规定的独立审查后更新 DAG；原节点保留汇总门禁，worker 不自行扩派。

### 失败去向与限次

- FAIL 按 DAG 本节点列出的拥有者派新 attempt。契约矛盾、方案不成立、必要输入缺失直接交对应设计 A，不先耗尽实现次数。reviewer 只写缺陷，不修产品或降低场景门槛。
- 同一冻结节点版本最多两次 W 派发，含首次和一次有证据的修复；仍有明确实现难点时最多一次 S。跨 harness 不重置次数。
- 设计问题最多一轮新方案及任务包规定的独立审查，仍无可行路径则 BLOCKED，说明外部条件或必须由用户改变的范围。外部 BLOCKED 仅在收到新输入主动通知后重派。
- 输入不变的修复属于原节点 attempt，不增加依赖回边。契约改为 v2 时保留 v1 记录，建立受影响设计、实现及验收的新实例，如 `R30@2 -> R33@2 -> R35@2`；撤销旧下游 PASS 对新版本的适用性，新增依赖仍须无环。
- 缺字段、缺固定版本、证据属于旧候选或仅有退出码 0，交新 reviewer 核查。重复回执按节点版本、attempt、session ID 去重；迟到旧版本不推进新节点。

### 启动与主动通知

仅在授权后使用任务包选择的现有 `codex exec` 或 dsh harness；Codex 参数以本机 `codex exec --help` 为准，dsh 按根 AGENTS 的命令条款执行，将完整任务文件作为输入，固定 worktree、顶层模型、effort 和最终回执文件。顶层 session 的模型、effort 和 harness 能力必须显式记录；内部助手记录角色和 harness，并继承调用 session 的模型与 effort。顶层模型或 effort 不可用要报告 harness BLOCKED，不静默降级。

外层负责在进程结束后按本机 `codex queue --help` 的通知接口主动发回编排者 thread。正常结束发送结构化 `PASS` 或 `FAIL`；正常 `FAIL` 按本节点既有失败归属处理。异常通知只用于回执可能丢失的情况，例如子进程或运行环境异常退出且未生成回执，或结果已落盘但队列投递失败；异常通知附退出码、日志或回执路径，不能把正常 `FAIL` 混成异常。skill 若要求内部助手，调用 session 按 skill 创建和管理，使用所选 harness 的内部助手能力；内部助手继承调用 session 的模型与 effort，不另设模型选择验证门禁。无法提供内部助手能力时按协议回执 `BLOCKED`，不开发 wrapper 或假定能力。此责任不授予 worker 联系其他 session 的权限，也不要求建立 watcher 或调度平台。

派发后停止并等待主动回执，遵守根 AGENTS 等待条款。产品 pi runtime 与开发 harness 分开。

<a id="design"></a>
## 设计 session

1. 读取任务包、本节点任务说明，以及被点名的范围/行为/约束段落。读取输入回执中固定的契约与实验，明确本次产品问题、可见结果和非目标。只有负责全范围补齐的设计才通读范围矩阵。
2. 先写用户流程与结果，再冻结当前消费者需要的语义、字段及失败恢复；任务包要求设计审查时，先独立提案，再交独立 reviewer 交叉检查。通常一轮提案、一轮交叉审查；争议用已有真实材料或获准的有界实验裁决，不能因讨论次数用完而宣称通过。范围内产品与技术取舍由设计者负责。小范围文档修正和状态更新只做必要自检，不自动重开设计审查。
3. 按下表产生本批材料。一个短批次使用同一短名，例如 `first-flow`、`materials`、`math`，不为每页造全套文件，也不提前冻结所有后续阶段。
4. 填好后续各节点任务包，特别是逐文件写入边界、相关契约操作、验证命令要求、样本、通过标准和验收负责人。共享文件按[所有权](#ownership)指定唯一写者。
5. 交独立设计审查。冻结条件见[设计审查](../acceptance/mvp-matrix.md#design-review)；缺口如实回执，设计作者不能自行冻结自己的包。

| 计划产物位置 | 唯一职责 |
| --- | --- |
| `docs/user-stories/<批次>.md` | 用户目标和价值，使用“作为…我希望…以便…”或 As/I want/so that；链接范围，不重抄规格。 |
| `docs/ux/<批次>.md` | 本批有歧义的入口、必要线框、状态、返回和失败恢复；引用 WORKBENCH_DESIGN 与设计规则。 |
| `docs/contracts/workbench.md`、本批 OpenAPI/schema | 前者提供共享语义和导航，精确字段由唯一 schema 拥有；复用已确认的认证公共约定，认证定义归原负责人。 |
| `docs/arch/<批次>.md` | 实现所需选择、持久化/迁移、文件所有权、外部依赖及实验裁决；稳定重大决议才写 ADR，词汇变化才改 CONTEXT。 |
| `docs/acceptance/<批次>.feature` | 可观察的 Given/When/Then 和稳定 `WB-` ID；沿用适用旧场景并注明原型来源，不照搬原型验收结论。 |
| 本批逐节点任务包 | 最小充分输入、精确版本与写入清单、验证要求和回执位置。后续派发者可直接使用，无需补产品决定。 |

共同设计边界：从 React/Vite、Express、SQLite 单一后端及现有底座起步；模块边界遵守 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)，公共端口不扩为运行时插件平台。确有冲突由设计者记录 ADR 修改理由。业务先提供中立服务端口，不依赖未验证的 pi 特定接口；首批及全模块 Agent 分别消费这些端口。保留后续消费者所需的内容/文件演进方式，不为无消费者的将来接口预设字段。

<a id="ownership"></a>
## 写入所有权

触发：设计者编制任务包，或实现者需要改公共文件、迁移、集成入口时读取。

- 任务包须逐文件收窄下表建议路径。`package.json`、锁文件、`packages/shared/`、应用入口/路由、迁移 runner、公共样式和同一测试文件均为独占文件，由当前指定的一个实现者写入。其他任务只回报所需变更清单。
- 数据与迁移由业务模块拥有，迁移 ID 用稳定模块前缀，既有迁移不改写。共享迁移入口由独占写者汇总，空库和上一阶段库均要验证；不得让两个 worker 迁移同一数据库。
- 契约缺口交设计者产生新版并独立冻结，不能由实现者临时改字段；受影响两侧、消费者和整体验收必须重跑。

| 类别 | 建议边界，实际以冻结清单为准 |
| --- | --- |
| Web/API 模块 | `apps/web/src/features/<module>/`、`apps/api/src/modules/<module>/`，module 为 questions、lessons、resources、math、classes、schedule。 |
| 迁移/后端测试 | 对应 API 模块迁移/仓储文件、`apps/api/test/<批次>*.test.js`；公共存储入口另列。 |
| 浏览器测试 | `apps/web/e2e/<批次>*.spec.js`、独占 fixtures；共用 helpers、`playwright.config.mjs` 另列。 |
| 外壳/设置/共享 | 逐项列实际组件、必要的 `App.jsx`、settings、公共样式、API app 入口和 shared 文件。 |
| Agent | `apps/web/src/features/agent/`、`apps/api/src/agent/` 及冻结的对话迁移/工具注册文件；仅对应 Agent 或集成任务可写。 |

<a id="implementation"></a>
## 实现 session

1. 从任务包进入本节点说明、冻结契约操作和相关场景。无需读取 DAG、编排章节、其他模块说明或整张范围矩阵。精确文件清单尚未冻结或必要输入缺失时回执 BLOCKED，不猜接口或扩大写入边界。
2. 在任务包指定的 worktree、分支、端口、SQLite、上传目录及测试账户上工作。除受控清单外，只可写本任务 `.scratch/dag-dispatch/<节点>/<attempt>/`；用户文件和其他 session 材料不属于本任务。
3. 按冻结目标实现与自验。原型只供交互参考，可迁入适用界面，生产代码不依赖原型源码。替换失效实现与旧断言须有当前行为依据，不为旧空首页测试恢复错误行为。
4. 用任务包指定的验证入口及[适用证据章节](../acceptance/mvp-matrix.md#evidence)提交结果。发现失败先按真实用户路径复现，再记录最小输入、版本、预期/实际、截图和日志后修复；测试失败、flaky 和明显 UI 问题同样归属处理。
5. 自验结束按[回执](#receipt)返回 `self`，交任务包指定的独立验收。无法满足当前契约则停止本节点并给出缺陷归属，不联络其他 worker 自行改约定。
6. 若本任务触发 `code-review`，先建立获授权的候选提交，再确认 fixed point 可解析、`git diff <fixed-point>...HEAD` 非空、受审变更全部已进入 `HEAD`，且工作区没有漏审的实现变更。调用 session 同时启动 Standards 和 Spec 两个只读内部 reviewer，内部 reviewer 继承调用 session 的模型与 effort，分别返回结果后由调用 session 聚合一份回执；根不再派同内容的顶层 diff review。未触发 `code-review` 的普通文档集成不得填写虚假的 review target。

<a id="integration"></a>
## Git 准备与集成任务

仅 B10 落地、创建可写任务 worktree 或其他任务包明确授权的集成读取。仓库 Git 权限和提交规则仍以根 AGENTS 为准。

- B10 从固定 main 创建一条短期交付集成分支，按审查过的文件/提交清单引入 `5eab55d` 文档基线与获批计划。任务包明确授权的 AGENTS 条款、研究材料和配置模板属于写入集合，应保留当前真实内容并记录版本；未授权的用户改动必须保护。未跟踪研究输入记录版本，无提交授权时保留文件快照，不伪造 SHA。权限或用户改动无法隔离则 BLOCKED。
- 每个可写任务使用独立 worktree，从 main 创建 `feat/<节点>-<attempt>` 或 `fix/<节点>-<attempt>` 等短期分支，再引入任务包指定的前置提交。独立数据库/文件/端口/账户随任务分隔；不建立长期层叠分支。
- 集成分支每次只有一个指定写者。通常由下一实现/集成任务引入固定前置提交再验证；冲突由实现者处理，不能覆盖整份文件消冲突。
- 集成基线变化产生新候选 revision，旧证据不能移名复用。按已获明确权限及时合 main；权限未覆盖时继续在交付分支串联已验证流程，不擅自合并。纯文档或配置集成不因小范围同步自动追加审查；只有产生产品行为变化时才回对应设计或验收门禁。
- issue、PR、CI/CD 和外部发布仅在明确授权范围进行。新增脚本/配置限于 B12、R31、D71 实际运行验证需要，不创建调度平台。

<a id="acceptance"></a>
## 独立验收 session

1. 读取任务包指定的受测版本、对应[验收条目](../acceptance/mvp-matrix.md)、场景、运行方法和证据章节。普通模块验收无需 DAG 或全范围表；F65/D72 全范围验收才逐行核对完整映射。
2. 在固定版本上独立重启与复现。质量判据归验收矩阵，UI 工作另触发根 AGENTS 的设计规则。设计审查只审设计输出，产品验收只接受实际受测候选的证据。
3. 逐条记录预期/实际、证据和缺陷拥有者。reviewer 不改产品或降低门槛，不能是受验实现或该批设计的作者。
4. 所有本次必验条目通过且无阻断缺陷才 PASS；有可复现缺陷则 FAIL；缺身份、设备、凭据或必要材料则 BLOCKED。按下节返回 `independent`，内部通过不等于用户验收。
5. 阶段验收验证固定候选上的实际 UI/API 用户流程、重启和场景结果；它不重复 `code-review` 的双轴 diff 评论。必要的状态文档同步只记录实际结果，不把文档更新写成产品验收通过。

<a id="receipt"></a>
## 所有执行角色的回执

结束即将以下信息写到任务包给定路径并返回，由外层通知编排者。不等待或主动联系其他 session。

```yaml
task: B13@1
attempt: 1
role: implement
status: PASS # PASS / FAIL / BLOCKED
verification_level: self # self / independent / user
finished_at_utc: "实际生成本回执的 UTC 时间"
session_id: "实际 ID；取不到则 unavailable"
runner: "实际 harness、模型和 effort"
skills_used: ["本次实际调用的 skill；未调用则 []"]
base_revision: "完整 commit SHA"
result_revision: "commit + path；未提交则绝对路径 + sha256"
review_target:
  fixed_point: "code-review 的完整 fixed point；未触发则 not-applicable"
  commit_range: "<fixed-point>...HEAD；未触发则 not-applicable"
  standards: "PASS / FAIL / BLOCKED / not-applicable"
  spec: "PASS / FAIL / BLOCKED / not-applicable"
  aggregate: "调用 session 的一份聚合回执或 not-applicable"
internal_reviewers: ["角色、模型、effort、harness；未使用则 []"]
inputs: ["本任务冻结输入的版本引用"]
changed_files: ["实际文件"]
artifacts: ["正式路径及版本或必要校验值"]
checks: ["场景 ID；命令/浏览器动作；结果；证据路径"]
identity_mode: "real-auth / test-principal / 不适用"
open_items: []
failure_owner: null
next_condition: "下一位验收者可复现的条件"
authorization_used: "授权记录或消息标识"
```

FAIL 要有最小复现和责任节点；BLOCKED 要写缺失输入、提供者、解除所需新证据，以及哪些独立工作仍可继续。真实证据先保存到 `docs/acceptance/evidence/<节点>/<revision>/` 或稳定制品位置并在索引中定位；大文件用稳定路径和校验值。完成后才清理本任务临时材料，未通过时保留候选、样本、日志和进度；用户及其他 session 资料始终保留。
