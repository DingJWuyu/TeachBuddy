# 当前运行台账

本页是编排者的当前状态与接续入口。节点依赖由 [DAG](mvp-dag.md) 拥有，范围由 [PRODUCT_SCOPE](../PRODUCT_SCOPE.md) 拥有，模型与角色规则由 [执行协议](execution-protocol.md#orchestration) 拥有。旧尝试的过程见原回执与 Git 历史；本页不重述已经失效的下一步。

## 上下文恢复入口

1. 读取根 [AGENTS.md](../../AGENTS.md)、本页的当前批次和对应任务包。
2. 依据固定候选与正式回执判断依赖；区分 `self`、`independent` 和用户验收。
3. 当前处于完整 DAG 执行状态。C24 真业务定向修复已 self PASS，进入 C25 设计与证据消费；R30 independent FAIL 的方案裁决仍待回执。C23 修正 independent PASS，A11 本地真实认证 self PASS，T53 提醒与真实合流 self PASS。依据下面派发记录接续，不重复派发，不主动轮询。
4. 权威材料确实缺少已作出的决定时，再查根 transcript：thread `01a0be12-5c28-7823-a7ed-644df825467f`，文件 `/home/liam_t/.codex/sessions/2026/09/20/rollout-2026-09-20T05-07-49-01a0be12-5c28-7823-a7ed-644df825467f.jsonl`。

## 当前用户授权与调度决定

- 用户明确恢复完整 DAG 执行，工作不限于原五项恢复任务。依赖就绪即可派发下游；收到 FAIL 必须按归属安排诊断、修复或必要设计裁决，不能仅登记后无限等待。产品范围、真实验收要求与外部动作权限保持不变。
- T50-IMPLEMENTATION-PREP、AUTH-INTEGRATION-PREP、AUTH-FLOW-CLARIFICATION attempt 2 已完成收尾，沿用成果。T51/T52 保留既有 self 结论，不重新实现。
- 产品设计、代码、自验和独立验收仍归相应 session。根只调度、核对回执元数据、维护台账与自身规则，不代做实质审查。
- 任务分支候选提交、本地运行验证和文档 main 合并已有许可。产品代码留在候选分支；本轮不包括产品合入 main、push、公开部署、发布、采购或额外付费。
- 已允许使用现有 GOAT 套餐进行必要实验；产品模型限 `deepseek/deepseek-v4.1-flash`、`z-ai/glm-5.3-flash`。计费条件不明或需要额外付费时停止相应调用，保留已有消耗记录。
- 开发模型按[唯一映射](execution-protocol.md#模型与固定派发)执行；停用 dsh 与自动降级。内部 skill 助手继承调用 session。R30 原会话恢复及明确 `model at capacity` 后恢复原会话已有用户许可，session ID 不变；保持模型与 effort，不增加自动降级。
- 可独立的已授权任务并行使用 worktree；共享文件在各候选内由一个写者集成。派发 prompt 最小必要，失败归原拥有者，不以增加审查或换模型代替诊断。

## 当前派发记录

以下是最近一次已确认启动的记录，不是实时轮询结果。回执目录均相对 `/home/liam_t/项目/TeacherWorkspace-mvp`；每个目录含 `task.md`、`launch.json`、事件日志和完成后生成的回执。

| 任务 | 接续方式 | 实际模型 / effort | 状态 | session | 原始派发与回执目录 |
| --- | --- | --- | --- | --- | --- |
| C24-BUSINESS | 原 session 接续，attempt 2 / resume 1 | gpt-5.6-sol / medium | 已完成，self FAIL，制品 d826b72 | `01a0c7a8-94e5-7da1-bfe0-aa537396c067` | `.scratch/dag-dispatch/C24-BUSINESS/2/resume-1/` |
| R30-RECOVERY-REVIEW | 恢复原会话，attempt 1 | gpt-6-astra / medium | 已完成，independent FAIL | `01a0c642-8129-7c11-84d1-f64a3fa85255` | `.scratch/dag-dispatch/R30-RECOVERY-REVIEW/1/resume-1/` |
| C23-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS（限定） | `01a0c7a8-9494-7672-9e16-cfa5034ea18d` | `.scratch/dag-dispatch/C23-MATH-REVIEW/1/` |
| T53 | 新会话，attempt 2 | gpt-6-astra / low | 已完成，self PASS（作品待接） | `01a0c7a8-94b2-7e93-923a-f71728265455` | `.scratch/dag-dispatch/T53/2/` |
| A11 | 新会话，attempt 2 | gpt-6-astra / low | 已完成，self PASS（本地真实认证） | `01a0c7a8-94c8-7d91-9794-28a8ec499bfa` | `.scratch/dag-dispatch/A11/2/` |
| M40-HANDOFF | 新会话，attempt 1 | gpt-5.6-sol / medium | 已启动，待主动回执 | `01a0c7c8-8354-7192-b525-9b10180805b0` | `.scratch/dag-dispatch/M40-HANDOFF/1/` |
| C24-BUSINESS-FIX | 新会话，attempt 1 | gpt-6-astra / low | 已完成，self PASS | `01a0c7c8-833e-7f12-9ecf-5dce76b8c2b7` | `.scratch/dag-dispatch/C24-BUSINESS-FIX/1/` |
| MATERIALS-NEXT-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已启动，待主动回执 | `01a0c7c8-8353-7113-b827-5e82f5bbf02d` | `.scratch/dag-dispatch/MATERIALS-NEXT-PLAN/1/` |
| A12-LOCAL | 新会话，attempt 1 | gpt-6-astra / medium | 已启动，待主动回执 | `01a0c7c8-8367-7260-80b7-9b0c9851af44` | `.scratch/dag-dispatch/A12-LOCAL/1/` |
| T54 | 新会话，attempt 1 | gpt-6-astra / medium | 已启动，待主动回执 | `01a0c7cb-3875-7fa0-b80f-2fcd66e0e26c` | `.scratch/dag-dispatch/T54/1/` |
| C25 | 新会话，attempt 1 | gpt-6-astra / high | 已启动，待主动回执 | `01a0c7d2-7a74-7050-8c8a-e28df0188772` | `.scratch/dag-dispatch/C25/1/` |

## 项目进度与当前门槛

完整 MVP 尚未交付。main 保留旧应用和新的规划/证据；本轮产品候选仍在任务分支。已通过的候选不会因 main 的文档更新漂移。

| 工作线 / DAG 节点 | 当前已成立的结论 | 尚缺条件或下一接点 |
| --- | --- | --- |
| 规划、入口与设计：P00/P01/G00、B10/B11、C20 | 规划与入口已完成；B11、C20 已独立冻结。G00 实施许可已恢复完整执行。 | 沿用现有设计与实验标准，不重新规划或重跑准备。 |
| 首条题库与备课：B12-B16 | 最新组合经 B16 independent PASS；真实保存、引用、重启恢复、隔离、失败恢复、桌面/Pad 已验证。 | 身份仍为 test-principal；不代表真实认证或完整题库范围通过。 |
| 认证：AUTH-CONTRACT、两端、A10-A12 | A11 本地真实应用接线 self PASS，代码 `7958e6d`；真实 Cookie/SQLite/本地 HTTPS，邮件边界仍为 fake-mail。内部双轴 PASS。 | A12-LOCAL 已启动本地独立验收，未形成结论。真实邮件、目标设备/跨设备、可信证书、生产迁移/部署及备份恢复仍未完成；不改写原 A10 BLOCKED。 |
| 材料：C21/C22、R30-R35 | R30 补证独立验收 FAIL。C22 角色隔离和三类打印缺口已关闭，参数化输出与本机编辑仅按报告限定范围沿用。 | C21 公式按题号回填、P/I/PS 图资产借自样本，逐题评分与一致编辑证明不足；C22 旧 DOC 与一般 LaTeX 转换仍欠证。两项 REV 均开放，MATERIALS-NEXT-PLAN 正裁决修复路径与依赖；R31-R35 未启动。 |
| 数学：C23、M40-M44 | C23 修正 independent PASS，M40-DR-001/002/003 均关闭；原 M40 未变设计审查沿用。 | M40-HANDOFF 正更新实验消费引用与冻结文档交接。M41 仍待 R31，M43 仍待 R35；数学产品实现未启动。 |
| 班级与日程：T50-T54 | T50 independent 冻结；T51 普通班级、T52 日程及 T53 提醒/真实合流均 self PASS，固定组合 89fe81b。 | T51 完整作品关联仍待 M40/M44/WB-T020；T54 已启动可执行场景的独立验收，不以普通能力通过替代作品场景。 |
| Agent：C24-C27 | C24 PI-03/04 定向补验 self PASS，候选 e8fdf9a；旧 PI-01/02 有 self 证据。副本读回已修复，pi 错误标志语义已实测。 | C25 已启动设计与独立证据消费，产品错误映射/模型白名单由其冻结；C26/C27 尚未启动，不把实验当产品通过。 |
| 可靠性：F60-F65 | 尚未启动。 | 等待 T54、C27、A12 的真实交付，再补全模块工具、现场、恢复和整日集成。 |
| 最终交付：D70-D75、G73/G76 | 尚未启动，未部署、未用户验收。 | 等待全范围验收、可用目标环境及具体交付动作授权。 |

## 下一步与回执处理

先核对任务、attempt/session、实际候选和证据级别。退出码 0 只说明进程结束，重复或迟到的旧回执不推进当前节点。完整执行授权覆盖依赖就绪后的派发，不需要每个节点重新请示。

| 工作 | 本轮动作 | 下游判断 |
| --- | --- | --- |
| M40 | 派文档交接，消费 C23 independent PASS，更新固定引用。 | 不重复已通过审查；M41 的 R31 前置仍保留。 |
| C24 / C25 | 修复 self PASS 已接收，派 C25 消费实验并设计持久对话与首批工具。 | 设计候选独立冻结后派 C26；证据缺口明确归属，不重复已有实验或把作者自检代替冻结。 |
| R30 / C20 | 派设计者重新裁决材料失败的修复路径与真实依赖。 | 保持范围和验收要求；判断可独立启动的底座与仍需实证的转换能力，不把实验欠账改名为 PASS。 |
| A11 / A12 | 对固定 A11 候选开展 A12 本地可执行部分的独立验收。 | 外部邮件/目标设备缺失时不宣称 A12 整体 PASS；发现本地缺陷即交原实现归属。 |
| T53 / T54 | T53 self PASS 已接收，派 T54 验证固定真实组合。 | 验收缺陷回相应拥有者；完整作品关联仍需 M40/M44，不虚报全阶段 PASS。 |

## 固定候选与必要证据

短 SHA 是仓库中已有对象的索引；派发记录固定完整 SHA。各任务 worktree 路径见 `launch.json`，只读消费者不得改写源候选。

| 对象 | 当前固定索引 |
| --- | --- |
| 首流受测组合 / 独立报告 | `612f0a9868743a1d5eea7e6f236d3ff903752439`；报告 `d1ef0d5:docs/acceptance/evidence/B16/v1/attempt2.md`，已在 main 归档。 |
| B11 / C20 冻结 | B11 `9aee091` + review `b62034e`；C20 `cff6f97` + review `2acb283`。 |
| 认证冻结 / 两端候选 | 设计 `6f30032` + review `63bfe8f`；后端 `281716f`（代码 `471f35c`），前端 `cff597e`（代码 `1601bcc`）。 |
| A11 候选 / 回执 / 启动边界 | 产品 `7958e6d21220e95bfa6c7f5f4b9643c7fdabf211`；回执 `6bac18602e0177cfd80b4770178d3d0f971aa1ca:docs/acceptance/evidence/A11/v1/author.md`；基线 `e351677`，启动澄清 `4f9985f`。 |
| T50 / T51 / T52 | 冻结 `afda1c5` + review `f9eb35f`；T51 代码 `fdf03fd`、回执 `56cbfd6`；T52 `14e18ed`。 |
| T53 真实组合 / 回执 | 产品 `89fe81bcd9c93e0b2c6af10b595cdf22eb5c75bd`；回执 `c8bd75a151fc1f3b405d8f58b6de182c5fa76be9:docs/acceptance/evidence/T53/v1/author.md`；API 147、浏览器 26、构建 self 通过，身份 test-principal。 |
| R30 / 限定接缝 | 原设计 `ae9a395`、review `0467f46`；恢复方案 `7789974` + review `c82cd69` 仅放行材料补验和 M40 设计接缝。 |
| 材料补证 | C21 制品 `cfbbc1d` + 回执 `96be500`；C22 实际制品 `f29a7afc5254fc852811c9a9e2368f46cce3e01e` + 回执 `c8c089c`；受审组合 `8d48af5`；独立报告 `16d4b013b17b1e8d8c240c0d15a8b5366102024b:docs/acceptance/evidence/R30/v1/recovery-review.md`。 |
| M40 / C23 修正 | M40 设计 `a6a495a` + 作者 `b626a93` + 原 review `3da472e`；修正受测 `d1490531e014ef437374c2f5a23cf3073baeef56`；独立 PASS `b01bc73954cbbc13e464738e0f6f8aa6c6f12084:docs/acceptance/evidence/M40/v1/correction-review.md`。 |
| C24 探针 / 业务实验 | 探针 `e7f979bd80ab83aaab7cc2cf936250123d7742a3`；旧业务 FAIL `d826b72`；修复与 self PASS `e8fdf9a139e429c05590925647a433a9da382579:docs/acceptance/evidence/C24/v1/business-fix.md`。 |

## 当前材料阻塞与外部输入

- C24 真业务累计 32 次 DeepSeek provider 请求、93,970 total tokens；本轮修复新增 7 次、36,651 tokens。PI-01/02 消耗另有原账本，不能混成全部实验总量。副本读回补验已通过，计费余额/extra credits 状态仍未知；cost=0 不证明免费。
- 当前权威结论为 [R30 恢复独立报告](/home/liam_t/项目/TeacherWorkspace-r30-recovery-review/docs/acceptance/evidence/R30/v1/recovery-review.md)，报告提交 `16d4b01`，受审组合 `8d48af5`。进程正常退出不改变本次 independent FAIL。C21 作者的“直接可用 6/6”只能视为结构性自验，不能据此关闭 EX-02。
- C21 公式/图资产来源、可信逐题评分及一致编辑证据归 C21/C20；C22 的一般 LaTeX 转换与旧 DOC 缺口归 C22/C20，R30 负责后续独立消费。由材料设计者给出可执行的修复和依赖裁决，在此之前不放行受影响门槛。
- C22 制品完整 SHA 以本页固定索引及独立报告为准；原作者回执的完整 SHA、XML 哈希说明有误，原证据保留，当前引用已纠正。
- 旧材料实验窗口已关闭，其失败结论与消耗保留。用户已要求恢复完整工作，设计者应据此提出有理由的新修复计划，不能自动重置原尝试或削减支持范围；需要真实外部环境或范围变更时再明确升级。
- 模型 API 已有真实连通和探针证据。账户余额与实际计费细节、完整部署、大陆网络、Windows/WPS/Edge/Chrome 目标流程仍未形成最终验收证据。
- 主干和文档 worktree 的 `.env` 是本地忽略文件；回执只记录凭据可用状态，不保存密钥。运行库、浏览器 profile、端口与实验制品按各任务隔离。
- 未完成任务的 worktree、日志和原始制品保留。只有用途完成且正式证据可追溯后才清理临时内容；本轮不清理被中断任务的现场。

<a id="低频-check-与回执监测"></a>
## 回执与状态检查

- 用户已取消定时 check；`teacherworkspace-check-01a0be12.timer` 已停止并禁用。不创建或恢复定时检查、watcher 或替代轮询。
- 任务由 Codex CLI 执行，外层保存退出码和日志并通过 `codex queue` 主动回执。派发完成后停止等待，不因没有新消息主动查询进度。
- 只有用户明确要求检查，或收到具体异常/中断通知时，才针对相关 session 做一次状态核对。结果已落盘但通知缺失时补齐接收；健康运行则等待；确认中断才按已有授权接续。
- 状态检查工具不替代主动通知；时间经过本身不表示失败、授权重派或允许扩大范围。
