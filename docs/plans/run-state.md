# 当前运行台账

本页只记录编排的当前状态和下一步，不保存修改历史，不替代 DAG 的依赖、范围或授权门禁。它属于编排记录，不新增产品流程。未派发、待回执和待生成表示当前没有可核对的实际值。

## 上下文恢复入口

恢复编排工作时依次读取：根 [AGENTS.md](../../AGENTS.md) 的条件入口、本页、当前任务包及正式回执，最后按需读取[执行协议](execution-protocol.md)的对应角色章节。只有这些权威材料缺少已作出的决定时，才定位本机根 transcript：thread `01a0be12-5c28-7823-a7ed-644df825467f`，源文件 `/home/liam_t/.codex/sessions/2026/09/20/rollout-2026-09-20T05-07-49-01a0be12-5c28-7823-a7ed-644df825467f.jsonl`；读取其中 `response_item/message` 的用户消息及 `assistant` 且 `phase=final_answer` 的消息。日常执行者不必读取对话全文，也不把 transcript 复制进正式文档。

## 当前用户授权与调度决定

- 用户于 2026-09-21T18:39:39.923839+00:00 明确指令“那么开始吧。我会离开一段时间，都交给你了”，G00 已通过，授权按既定完整范围开展设计、前后端实现、测试和本地运行；目标为约 8 小时接近完整 MVP。任务分支候选提交属于实施交付。既有 main 文档合并许可继续有效；产品候选先在交付分支集成，公开部署、发布、推送、采购和额外付费不在本次授权中。
- 用户已允许后续真实模型测试消耗现有 GOAT 套餐额度；不购买或使用额外付费额度，计费条件不明确时停止调用。调用仅使用既有套餐额度。
- 根直接维护编排规则和运行状态；普通文档和 Git 入口整理做必要自检，不追加独立复审。B10 按当前文档/Git 准备任务交 Luna，旧任务描述中的多轮设计/落地审查不再适用于这项机械准备。
- 前后端代码实现默认使用 dsh；额度不足或限额时回退 Luna max。困难任务经当前 dsh 或 Luna 反复尝试仍无法解决，可升级 Sol high 接手，前后端均适用。调研、文档和集成仍用 Luna max。完整路由见[执行协议](execution-protocol.md#模型与固定派发)，具体运行节点见下方当前实施表。
- 仅对编排者，效率优先：在已有权限和依赖允许时并行使用 worktree；某条 flow 等用户时记录阻塞并继续其他可推进的 flow。用户将离开一段时间，不应要求用户逐项决定范围内的实现细节。
- 派发使用[最小任务包](task-package.md)，保留背景、边界、适用规则和明确但适度的完成条件，不附加脑测实现步骤、额外限制或过严验收。适用 skill 的内部助手继续继承调用 session 的模型与 effort。
- 顶层任务由编排者派给独立 session。适用 skill 要求的内部助手由调用 session 管理并汇总，不单列 DAG 节点，不自行继续委派或跨业务互聊；业务 session 不自由互聊或扩展 DAG。
- 认证与工作台由根编排者统一协调，延续现有 OpenAPI 和 HTTP 状态码约定；认证事实调查已完成，原 session 最后保存回复停在 partial；根已发一次新的写入归属调整通知，安排独立 AUTH-CONTRACT 接续。不把通知投递当确认，也不覆盖任何未交付旧成果。
- 产品只允许 `deepseek/deepseek-v4.1-flash`、`z-ai/glm-5.3-flash`；EMODEL 已用真实 key 对两个模型收到 HTTP 200；正常回答、pi 工具链、完整部署和大陆访问尚未验收。

## 低频 check 与回执监测

- 根已在本机用户 systemd 建立定时任务，当前状态记录为 `active/waiting`、`enabled`：timer `teacherworkspace-check-01a0be12.timer`，service `teacherworkspace-check-01a0be12.service`。
- 运行环境配置指针：`/home/liam_t/.config/systemd/user/teacherworkspace-check-01a0be12.timer` 和同名 `.service`。注册时间为 `2026-09-21T17:24:19.053686+00:00` UTC；`OnActiveSec=45min`、`OnUnitActiveSec=45min`、`AccuracySec=1s`。
- service 只运行 `codex queue --thread 01a0be12-5c28-7823-a7ed-644df825467f --message check`，每次投递内容恰为 `check`。投递和唤醒依赖本机、用户服务和 Codex 收件服务运行；机器或相关服务离线时不保证即时处理。
- 配置文件属于已存在的运行环境，本页只保留指针，不复制进仓库，不修改、重建或测试触发器，也不创建安装脚本。
- 根收到 `check` 后先读本页：有未完成任务且近 45 分钟没有回执时，才对台账中相关 session 做一次恢复检查。这个 `check` 同时判断回执缺失和异常通知；正常 `FAIL` 仍回原节点处理，只有异常退出、结果已落盘但通知未到等情况才按回执缺失处理。无未完成任务或已有近期回执时结束本次检查。结果已保存但回执丢失时按原 `task`、`revision`、`attempt` 接续；session 仍正常运行则等待；明确中断才按既有失败规则处理。超过 45 分钟本身不判失败，不杀死健康进程，不盲目重派；`check` 不替代依赖和权限判断。
- 首条 `check` 已于 `2026-09-21T18:09:55Z` 在根会话收到并处理；距最后任务回执不足一分钟，本次结束检查，未查询或重启任何 session。此记录只证明消息已接收，未另核实投递来源，中断恢复仍未演练。`check` 自身不更新最后任务回执时间。
- 回执监测字段：监测起点为上述真实注册时间；最后回执处理时间为 `2026-09-21T20:04:47.059838+00:00`，对应任务为 `EAUTH-READINESS@1`；只读事实已核对，认证真实交付仍未成立。根每次收到实际任务回执后记录实际处理 UTC 时间及对应任务，供下一次 `check` 使用；本次不编造旧值。

| 任务/版本 | 当前状态 | attempt | 负责 session 与 worktree | 输入/正式回执或产物位置 | 阻塞/下一步条件 | 适用授权 |
| --- | --- | --- | --- | --- | --- | --- |
| 文档拆分 / `mvp-dag-refactor-v2` | v2 受审版本独立 PASS；v2.1 规则同步不追加复审 | 1 | `01a0c480-d75b-76f1-bf01-d03e40d7336c`；`docs/mvp-delivery-baseline` | [独立核验回执](mvp-dag-refactor-review.md) | 原 PASS 只适用于受审版本；原证据归档，实施已获 G00 | 文档规划审查；不含产品实施授权 |
| API/部署调研及修正 / `readiness-correction@1` | RR-01/02/03 已由作者 Luna 修正并自查；不记录为修正后独立 PASS | 1 | API `01a0c4a3-ecfe-76f3-b7c2-e0278103d996`；部署 `01a0c4a3-ed08-7723-8cc8-9378471bcc83`；首次核验 `01a0c4b5-362a-7d60-a1b4-9c47602e9ee8`；修正 `01a0c4bf-e5c7-7613-ae17-2c6e000726d2` | [正式修正回执](../acceptance/evidence/readiness-correction.md)、[API 报告](../research/command-code-api.md)、[部署报告](../research/deployment-options.md) | 用户已取消独立复审；最小真实调用证据见当前 EMODEL 行，部署和大陆网络验证仍未执行 | 已完成文档修正与自查；后续调用遵守本页费用授权，不含部署或购买服务 |
| 认证交接 / `c7420af` 行为基线 | 已发一次现状请求和一次统一编排通知，等待 `[AUTH_HANDOFF_STATUS]` 主动回执；正式认证交付尚未证实 | 1 | `01a0bea6-5119-7861-b060-e5f1da67947b`；worktree：待回执 | [认证契约](../contracts/auth.md)、[认证行为](../../prototype/behavior/auth.md)；回执目标为根 thread `01a0be12-5c28-7823-a7ed-644df825467f` | queue 投递不证明 session 正在运行或正式认证已交付；等待主动回执，不查活动、不轮询、不重复催促、不另开认证实现 | 用户已将认证纳入统一编排；不扩展原任务或启动产品 DAG |
| 技能流程核对 / `skill-routing@1` | 已集成，已完成，不追加审查 | 1 | Sol high `01a0c4d1-9404-75b1-8b48-5f5a928c0664`；`/home/liam_t/项目/TeacherWorkspace-mvp` | [技能路由](skill-routing.md)、[正式回执](../acceptance/evidence/skill-routing.md)；输入 SHA-256 `9cddc05827f0bfc1797d7b357d21d809f950ff56796e3908e2844b999e4ba5a0` | 最小规则已进入协议与任务包；适用 skill 的内部助手继续按所选 harness 执行，不新增内部模型选择验证项目 | 用户授权技能核对及适用技能内部限定委派；不含产品实施 |
| 编排规则同步 / `orchestration-rules-sync@1` | 已完成；候选 commit `bb50dfd` 已按授权快进合入 main `515c658`；四份计划文档已同步并通过必要自检；首条 `check` 已接收，恢复检查未演练 | 1 | `01a0c500-ce05-7722-a2e4-497353d057dc`；`docs/mvp-delivery-baseline`；finished_at `2026-09-21T17:34:30.535Z` | [技能路由](skill-routing.md)、[执行协议](execution-protocol.md)、[任务包](task-package.md)、本页；正式结果由本行的 session、提交与受改文件定位 | 本次同步已完成；不启动产品 DAG | Luna max；文档提交与合并已获许可；不含产品实施、API 请求、额外审查或 push |
| 文档与配置集成 / `corrected-doc@1` | 候选 commit `8b1f8b5` 已提交；本轮按授权完成 main 集成，完成态 main 为 `cc707a4c2831fea1a75f529c2a581ab04f7346dd` | 1 | `01a0c4e0-6961-72d2-886e-8291768a5f05`；`docs/mvp-delivery-baseline` | [修正回执](../acceptance/evidence/readiness-correction.md)、[技能回执](../acceptance/evidence/skill-routing.md)、本页 | 文档规则、正式回执、无秘密模板和配置准备已集成；不启动产品 DAG | Luna max；文档与 main 合并已获许可；不含产品实施、部署、发布或推送 |
| 对话决定补录 / `transcript-reconciliation@1` | 已完成；文档提交 `78851d0` 已按许可快进合入 main；按 `self` 记录，不追加审查或产品实施 | 1 | `01a0c511-6177-7a11-b409-8b973ae2f0b6`；Codex Luna max；`docs/mvp-delivery-baseline` | [正式补录映射](../acceptance/evidence/transcript-reconciliation.md)；原始对话入口见本页上下文恢复章节 | 常规核验、dsh 委托、check/恢复、认证和规则同步已回到既有权威位置；完成态 main `a738d5ad98440d24510a3828d76f88f4b3a62f06` | 用户本轮授权回查 transcript 与补录；既有文档提交、main 合并许可继续有效 |
| dsh 回执与通知调研 / `dsh-receipts@1` | 已接收，报告提交 `3533eeee5fbec3c25e2f864b8bec28baf217d505` 已合入 main；按 `self` 记录 | 1 | `01a0c514-6f84-7443-9bd9-ecc2cb2745c0`；Codex Luna max；已合并的 `docs/dsh-receipts` 临时 worktree 已清理 | [调研报告](../research/dsh-receipts.md)；真实回执已接收，版本和来源由报告及本行定位 | 无原生跨 harness 通知；外层顺序执行并通过 codex queue 通知具有静态依据，真实模型任务和通知投递未实测；不追加复审 | 用户授权 Luna 调研及文档 main 集成；不含产品实施 |
| 新 session 接任实验 / `cold-orchestrator@1` | 已完成；实验者能理解职责、状态和下一步，真实长程稳定性未验证；受测版本 `f1d408515b7ba89653e59603d3e857883f81265d` | 1 | `01a0c524-4a9b-71f2-828d-314754c4cf5c`；Codex Luna max；临时只读 worktree 已完成用途并清理 | [任务原文与原始回答](../acceptance/evidence/cold-orchestrator.md) | 交用户评阅实验结果；不追加审查，不自动修订流程或启动产品 | 用户明确授权 Luna 冷启动实验；不含产品派工或实施 |
| 产品 DAG / G00 | 用户授权 PASS；B11 已冻结，首流并行实现中 | 1 | 根编排会话 | 本页当前用户授权 | B10 后进入 B11；独立输入准备可并行 | 实施、本地验证、候选提交；不含公开部署发布 |

## 当前实施任务

本节为活动节点的唯一列表；上方前置任务表是已交付资料索引。每个节点按对应任务包执行，不因旧前置回执里的“未授权”字样忽略当前 G00。

当前生效的并行依赖固定在 `14b8cb7c216fafc8e0a278a3900c8decf8172075:docs/plans/mvp-dag.md`，已随冻结文档集成 main `420312f`。B11 已独立冻结；当前四个下游任务的固定输入仍为 `b938f8af0b8152718f5063d4326d494bf8b5426c`，不因 main 更新漂移。首批可并行 B12/B13/B14/C20；首流汇合 B15、独立验收 B16 保留，不以替身自验替代最终真实链路。

| 节点 | 状态 | 输入版本 | 负责人与工作区 | 任务与回执 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| B10@1 / attempt 1 | 完成（self），已集成 main | `9f93c2a` | Codex Luna max；session `01a0c545-5089-7452-a568-f0131b567189`；exec `14318`；已完成用途的临时工作区与分支已清理 | 最终提交 `8e9b230c56c7384521b122a7a80b6b07e18c852c`；`docs/acceptance/evidence/B10/v1/receipt.md`；源任务回执已接收 | B11 已消费交接；正式证据与输入提交保留在 main |
| EMODEL@1 / attempt 1 | 完成（self，基本连通性），已集成 main | `9f93c2a`；现有 API 调研与本地凭据 | Codex Luna max；session `01a0c545-507e-74d2-965b-7f25c4722a75`；exec `48750`；临时工作区与分支已清理 | 候选 `d52ba58a6db51d4214144976224f944c31643796`；[正式证据](../arch/evidence/EMODEL.md) | 两个模型 HTTP 200，但 token 上限耗尽且正文为空；正常文本、流式/tool calling、pi 和计费状态留给后续相关验证，不追加本次复审 |
| B11@1 / attempt 1 | 已独立冻结 PASS | `59a14e9` + B10 `8e9b230` 只读交接 | Codex Astra high；session `01a0c555-bc91-7b02-afea-135650a01780`；exec `58212`；已完成并清理临时工作区/分支 | 设计 `9aee091`、回执 `47ee119`；`docs/acceptance/evidence/B11/v1/author.md` | 已通过 Sol 独立核验，首批任务输入固定为 `b938f8a` |
| PREFLIGHT-INTEGRATION@1 / attempt 1 | 完成（self），main 集成完成 | B10 `8e9b230`、EMODEL `d52ba58`、最新 main | Codex Luna max；session `01a0c555-bc95-7200-b3d2-32e294665c9e`；exec `64550`；临时工作区与分支已清理 | [正式回执](../acceptance/evidence/preflight-integration.md)；集成 main `9ca5e41` | 文档集成已完成，不追加审查；根恢复独占台账写入 |
| B11-REVIEW@1 / attempt 1 | 完成，independent PASS | `bd1d204`，固定 B11 设计 `9aee091` | Codex Sol high；session `01a0c56a-7222-7df1-a3c8-aadb8545f1b1`；exec `60473`；已完成并清理临时工作区/分支 | 报告提交 `b62034eb6661f99127d0e4b1407174260a139089`；`docs/acceptance/evidence/B11/v1/review.md` | 固定设计 `9aee091` 已冻结；B12/B13/B14/C20 并行启动 |
| PARALLEL-PLAN@1 / attempt 1 | 完成（self）；已与 B11 一并集成 | `dfb88f0`，现有 DAG + B11 接缝 | Codex Astra high；session `01a0c56a-7212-7a80-814c-af7a5d011f68`；exec `21662`；已完成并清理临时工作区/分支 | 调度提交 `14b8cb7c216fafc8e0a278a3900c8decf8172075`；[归档结果](../acceptance/evidence/B11/v1/integration.md) | 已按该版本派 B12/B13/B14/C20；调度文档已在 main，不另复审 |
| B12@1 / attempt 1 | RUNNING | `b938f8a`（含冻结 B11 与并行调度） | dsh headless，当前配置；独立 dsh 进程 PID `121768`；session ID 未由 launcher 暴露；exec `81732`；`/home/liam_t/项目/TeacherWorkspace-b12`；`feat/b12-foundation` | `.scratch/dag-dispatch/B12/1/task.md`；receipt 待生成 | 提交公共入口供 B13 接真服务；B15 汇合 |
| B13@1 / attempt 1 | 收尾未完成：主进程已退出，内部审查待核实 | `b938f8a`（含冻结 B11 与并行调度） | dsh headless，当前配置；dsh session `session-bd3f4354-152a-465a-9b1c-93732a28219f`；PID `121778` 已退出；exec `83478`；`/home/liam_t/项目/TeacherWorkspace-b13`；`feat/b13-question-lessons` | 代码候选 `80769179f7caf367fda4e0467aa7601cb3fc8ed0`；工作区内 `author.md` 未提交草稿；`.scratch/dag-dispatch/B13/1/receipt.md` | 先核实内部审查可恢复性，再派 dsh 接续收尾；31 项 adapter 测试/构建仅为已有自验记录，B12 真服务仍待接入 |
| B14@1 / attempt 1 | RUNNING | `b938f8a`（含冻结 B11 与并行调度） | dsh headless，当前配置；独立 dsh 进程 PID `121821`；session ID 未由 launcher 暴露；exec `82628`；`/home/liam_t/项目/TeacherWorkspace-b14`；`feat/b14-workbench-ui` | `.scratch/dag-dispatch/B14/1/task.md`；receipt 待生成 | 本节点契约替身自验；B15 接真实服务 |
| C20@1 / attempt 1 | 已独立冻结 PASS | `b938f8a`（含冻结 B11 与并行调度） | Codex Astra high；session `01a0c577-c06f-7e30-abe2-2fcff66386e9`；exec `98698`；`/home/liam_t/项目/TeacherWorkspace-c20`；`design/c20-capabilities` | 设计 `cff6f97`、作者 `85c1af8`；`docs/acceptance/evidence/C20/v1/author.md` | 独立核验已通过；C21-C23/T50 与 C24 PI-01/02 并行，PI-03/04 等 B16 |
| B11-INTEGRATION@1 / attempt 1 | 完成（self）；main 已集成 | `b938f8a`（含冻结 B11 与并行调度） | Codex Luna max；session `01a0c577-c068-7b01-99bb-c3c6aa0d0753`；exec `69302`；已完成并清理临时工作区/分支 | [正式集成回执](../acceptance/evidence/B11/v1/integration.md)；main `420312f` | 文档集成完成；只继续正在运行的产品与实验设计任务 |
| C20-REVIEW@1 / attempt 1 | 完成，independent PASS | `0ff698b6117fd4473d801d4817f70acb1fd3a7ef`；设计 `cff6f97` | Codex Sol high；session `01a0c585-051a-7b90-82cf-44d8c1063949`；exec `16110`；`/home/liam_t/项目/TeacherWorkspace-c20-review`；`review/c20-freeze` | 报告 `2acb283aba31f4482876f74f96b8542073cf49d7`；`docs/acceptance/evidence/C20/v1/review.md` | C21/C22/C23/T50 与 C24 前置探针已放行 |
| EAUTH-READINESS@1 / attempt 1 | 完成（self）；EAUTH/A10 未通过 | `819e79332d0c3f9cb19d64adff0ce8127d890098`；已有认证文件与指定 session 保存记录 | Codex Luna max；session `01a0c585-051a-7601-80a7-af5d1c44c610`；exec `60020`；`/home/liam_t/项目/TeacherWorkspace-auth-readiness`；`docs/auth-readiness` | 报告 `3ec3d3582f820f09ef59786d0626fc01f5d4ec5c:docs/arch/auth-readiness.md` | c7420af 行为已交付，5757141 契约仍 partial；由新的独立 AUTH-CONTRACT 接续设计 |
| DSH-REVIEW-COMPLETION@1 / attempt 1 | RUNNING | B13 实际退出/日志及本机匹配 dsh；已有调研 | Codex Luna max；session `01a0c587-4c67-71e2-999a-d73c2b66bd4e`；exec `27569`；`/home/liam_t/项目/TeacherWorkspace-dsh-review-research`；`docs/dsh-review-completion` | `.scratch/dag-dispatch/DSH-REVIEW-COMPLETION/1/task.md`；receipt 待生成 | 有界核实 headless 等待与已存审查结果，给 dsh 接续最小办法；不实现/审查产品 |
| C21@1 / attempt 1 | RUNNING | `e921225`（冻结 C20/B11） | Codex Luna max；session `01a0c58f-fbe3-7563-90a5-9e876c101668`；exec `76945`；`/home/liam_t/项目/TeacherWorkspace-c21`；`experiment/c21-extraction` | `.scratch/dag-dispatch/C21/1/task.md`；receipt 待生成 | 提取实测交 R30 消费；两路线失败回 C20 |
| C22@1 / attempt 1 | RUNNING | `e921225`（冻结 C20/B11） | Codex Luna max；session `01a0c58f-fc0e-7fa3-b08f-c98ae4ed6f0f`；exec `95842`；`/home/liam_t/项目/TeacherWorkspace-c22`；`experiment/c22-office` | `.scratch/dag-dispatch/C22/1/task.md`；receipt 待生成 | 真实 Office 编辑/预览与输出交 R30；目标 WPS 单列 |
| C23@1 / attempt 1 | RUNNING | `e921225`（冻结 C20/B11） | Codex Luna max；session `01a0c58f-fc34-7be1-a04d-a150151e6d69`；exec `49171`；`/home/liam_t/项目/TeacherWorkspace-c23`；`experiment/c23-math` | `.scratch/dag-dispatch/C23/1/task.md`；receipt 待生成 | 制作/离线实证交 M40，保留设备局限 |
| C24-PROBE@1 / attempt 1 | RUNNING | `e921225`（冻结 C20/B11） | Codex Luna max；session `01a0c58f-fbe9-75e1-a365-c9631bb3ffb9`；exec `35116`；`/home/liam_t/项目/TeacherWorkspace-c24`；`experiment/c24-pi-probe` | `.scratch/dag-dispatch/C24-PROBE/1/task.md`；receipt 待生成 | 仅 PI-01/02；PI-03/04 等 B16，不记 C24 整体 PASS |
| T50@1 / attempt 1 | RUNNING | `e921225`（冻结 C20/B11） | Codex Astra high；session `01a0c58f-fc47-7563-a2ba-cabbd5225ef5`；exec `1744`；`/home/liam_t/项目/TeacherWorkspace-t50`；`design/t50-teaching-time` | `.scratch/dag-dispatch/T50/1/task.md`；receipt 待生成 | 设计后独立冻结，T51/T52 启动仍取 B16 |
| C20-INTEGRATION@1 / attempt 1 | RUNNING | `e921225`（冻结 C20/B11） | Codex Luna max；session `01a0c58f-fc16-7130-a01e-e236f7d469e7`；exec `94888`；`/home/liam_t/项目/TeacherWorkspace-capability-integration`；`chore/c20-doc-integration` | `.scratch/dag-dispatch/C20-INTEGRATION/1/task.md`；receipt 待生成 | 安全合 main 文档；活动期间根不写 main |
| AUTH-CONTRACT@1 / attempt 1 | 启动中 | `5b12a9063cc0b692103df73997cb8963506bd9ea`，含认证事实报告与已冻结 B11 | Codex Astra high；`/home/liam_t/项目/TeacherWorkspace-auth-contract`；`design/auth-contract-completion` | `.scratch/dag-dispatch/AUTH-CONTRACT/1/task.md`；原负责人通知结果同目录保存；receipt 待生成 | 完成认证契约并交独立冻结；后续 auth 前后端 dsh 实现，真实交付后供 A10，不改工作台依赖门槛 |

配置准备状态：文档 worktree 和 main 的 `.env` 均已从现有本地配置准备，权限为 `0600`，两处 `COMMANDCODE_API_KEY` 只核对状态、不在仓库记录值；两处均被 Git 忽略。`.env.agent.example` 只保留无密钥模板。

未完成外部状态：认证 session 尚未主动回执；两个允许模型已发生最小真实请求并返回 HTTP 200，正常回答、pi 工具链、账户余额和实际计费仍未验证；部署候选、Cloudflare/Tunnel、Windows/WPS/Edge/Chrome 目标流程、备份恢复和中断恢复演练均未执行。以上状态不因文档已写或配置已准备而改变。
