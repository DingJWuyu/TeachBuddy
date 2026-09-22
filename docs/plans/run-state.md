# 当前运行台账

本页是编排者的当前状态与接续入口。节点依赖由 [DAG](mvp-dag.md) 拥有，范围由 [PRODUCT_SCOPE](../PRODUCT_SCOPE.md) 拥有，模型与角色规则由 [执行协议](execution-protocol.md#orchestration) 拥有。旧尝试的过程见原回执与 Git 历史；本页不重述已经失效的下一步。

## 上下文恢复入口

1. 读取根 [AGENTS.md](../../AGENTS.md)、本页的当前批次和对应任务包。
2. 依据固定候选与正式回执判断依赖；区分 `self`、`independent` 和用户验收。
3. 当前五项中 R30 已接收 independent FAIL；其余四项已启动，待主动回执。不要因恢复上下文再派同一任务，也不要据此主动轮询运行状态。
4. 权威材料确实缺少已作出的决定时，再查根 transcript：thread `01a0be12-5c28-7823-a7ed-644df825467f`，文件 `/home/liam_t/.codex/sessions/2026/09/20/rollout-2026-09-20T05-07-49-01a0be12-5c28-7823-a7ed-644df825467f.jsonl`。

## 当前用户授权与调度决定

- 当前获准运行的是下表五项。C24 重派，R30 原 session 恢复，C23 独立核验，T53/A11 新 session 接手。其他节点未重新派发，不能因旧 G00 的全面实施授权忽略本轮限定恢复范围。
- T50-IMPLEMENTATION-PREP、AUTH-INTEGRATION-PREP、AUTH-FLOW-CLARIFICATION attempt 2 已完成收尾，沿用成果。T51/T52 保留既有 self 结论，不重新实现。
- 产品设计、代码、自验和独立验收仍归相应 session。根只调度、核对回执元数据、维护台账与自身规则，不代做实质审查。
- 任务分支候选提交、本地运行验证和文档 main 合并已有许可。产品代码留在候选分支；本轮不包括产品合入 main、push、公开部署、发布、采购或额外付费。
- 已允许使用现有 GOAT 套餐进行必要实验；产品模型限 `deepseek/deepseek-v4.1-flash`、`z-ai/glm-5.3-flash`。计费条件不明或需要额外付费时停止相应调用，保留已有消耗记录。
- 开发模型按[唯一映射](execution-protocol.md#模型与固定派发)执行；停用 dsh 与自动降级。内部 skill 助手继承调用 session。R30 恢复原会话是本次用户明确要求的例外，session ID 不变。
- 可独立的已授权任务并行使用 worktree；共享文件在各候选内由一个写者集成。派发 prompt 最小必要，失败归原拥有者，不以增加审查或换模型代替诊断。

## 当前恢复批次

以下是最近一次已确认启动的记录，不是实时轮询结果。回执目录均相对 `/home/liam_t/项目/TeacherWorkspace-mvp`；每个目录含 `task.md`、`launch.json`、事件日志和完成后生成的回执。

| 任务 | 接续方式 | 实际模型 / effort | 状态 | session | 原始派发与回执目录 |
| --- | --- | --- | --- | --- | --- |
| C24-BUSINESS | 新会话，attempt 2 | gpt-5.6-sol / medium | 已启动，待主动回执 | `01a0c7a8-94e5-7da1-bfe0-aa537396c067` | `.scratch/dag-dispatch/C24-BUSINESS/2/` |
| R30-RECOVERY-REVIEW | 恢复原会话，attempt 1 | gpt-6-astra / medium | 已完成，independent FAIL | `01a0c642-8129-7c11-84d1-f64a3fa85255` | `.scratch/dag-dispatch/R30-RECOVERY-REVIEW/1/resume-1/` |
| C23-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已启动，待主动回执 | `01a0c7a8-9494-7672-9e16-cfa5034ea18d` | `.scratch/dag-dispatch/C23-MATH-REVIEW/1/` |
| T53 | 新会话，attempt 2 | gpt-6-astra / low | 已启动，待主动回执 | `01a0c7a8-94b2-7e93-923a-f71728265455` | `.scratch/dag-dispatch/T53/2/` |
| A11 | 新会话，attempt 2 | gpt-6-astra / low | 已启动，待主动回执 | `01a0c7a8-94c8-7d91-9794-28a8ec499bfa` | `.scratch/dag-dispatch/A11/2/` |

## 项目进度与当前门槛

完整 MVP 尚未交付。main 保留旧应用和新的规划/证据；本轮产品候选仍在任务分支。已通过的候选不会因 main 的文档更新漂移。

| 工作线 / DAG 节点 | 当前已成立的结论 | 尚缺条件或下一接点 |
| --- | --- | --- |
| 规划、入口与设计：P00/P01/G00、B10/B11、C20 | 规划与入口已完成；B11、C20 已独立冻结。G00 实施许可仍受当前恢复范围约束。 | 沿用现有设计与实验标准，不重新规划或重跑准备。 |
| 首条题库与备课：B12-B16 | 最新组合经 B16 independent PASS；真实保存、引用、重启恢复、隔离、失败恢复、桌面/Pad 已验证。 | 身份仍为 test-principal；不代表真实认证或完整题库范围通过。 |
| 认证：AUTH-CONTRACT、两端、A10-A12 | 同版契约已冻结，前后端分别 self PASS；A10 接线边界已由 AUTH-FLOW 澄清，A11 正在接线。 | 原 A10 BLOCKED 不改写为 PASS。A11 本地真实 Cookie 链路、A12 独立验收以及真实邮件/设备/部署/恢复条件仍待交付。 |
| 材料：C21/C22、R30-R35 | R30 补证独立验收 FAIL。C22 角色隔离和三类打印缺口已关闭，参数化输出与本机编辑仅按报告限定范围沿用。 | C21 公式按题号回填、P/I/PS 图资产借自样本，逐题评分与一致编辑证明不足；C22 旧 DOC 与一般 LaTeX 转换仍欠证。两项 REV 均开放，R31-R35 未启动。 |
| 数学：C23、M40-M44 | M40 设计已产出；原审查三项 C23 缺口已 self 修正，正在限定独立核验。 | 核验前 M40 不算冻结；即使缺口关闭，M41 仍待 R31，M43 仍待 R35。数学产品实现未启动。 |
| 班级与日程：T50-T54 | T50 independent 冻结；T51 普通班级能力与 T52 日程 self PASS，T53 正合流与实现提醒。 | T51 完整作品关联仍待 M40/M44/WB-T020；T54 全阶段验收未启动，不以普通能力通过替代作品场景。 |
| Agent：C24-C27 | PI-01/02 正常回答、只读工具和会话重开已有 self 证据；PI-03/04 真业务实验正在接续。 | C24 整体尚未完成；C25-C27 尚未启动，不能把实验探针当产品 Agent。 |
| 可靠性：F60-F65 | 尚未启动。 | 等待 T54、C27、A12 的真实交付，再补全模块工具、现场、恢复和整日集成。 |
| 最终交付：D70-D75、G73/G76 | 尚未启动，未部署、未用户验收。 | 等待全范围验收、可用目标环境及具体交付动作授权。 |

## 五项回执到达后的判断

先核对任务、attempt/session、实际候选和证据级别；退出码 0 只说明进程结束。重复或迟到的旧回执不推进当前节点。下表是后续依赖判断，不自动扩大本轮派发范围。

| 当前任务 | 回执要解决的问题 | 接到回执后的下一判断 |
| --- | --- | --- |
| C24-BUSINESS | PI-03/04 是否真实读写、失败不假报成功、冲突与重开恢复成立，消耗是否仍在既定窗口内。 | 成功则列出 C25 可消费输入；失败记录实验/环境归属，不重置窗口或重复 PI-01/02。 |
| R30-RECOVERY-REVIEW | 已接收报告 `16d4b01`，两项完整 REV 均未关闭。 | 原窗口保持关闭；C20/C21/C22/R30 各按报告归属等待新输入，R31/M41 不放行。当前不追加修复、实验或审查。 |
| C23-MATH-REVIEW | M40-DR-001/002/003 是否关闭，结论是否足以冻结原 M40 设计。 | 足以关闭则固定新证据与设计的消费组合，沿用未变审查；否则登记明确缺口。保留 R31/R35 依赖。 |
| T53 | 提醒、补呈现、通知跳转及 T51/T52 合流是否形成真实候选。 | 记录 self 候选及未决项，核对 T54 条件；T51 真实作品未到时不宣称完整教学链路通过。 |
| A11 | 真实应用的认证前后端、Cookie、principal、账号与退出是否已接通。 | 记录本地 self 候选，核对 A12 场景与外部条件；fake-mail 不替代真实邮件或最终 real-auth 验收。 |

## 固定候选与必要证据

短 SHA 是仓库中已有对象的索引；派发记录固定完整 SHA。各任务 worktree 路径见 `launch.json`，只读消费者不得改写源候选。

| 对象 | 当前固定索引 |
| --- | --- |
| 首流受测组合 / 独立报告 | `612f0a9868743a1d5eea7e6f236d3ff903752439`；报告 `d1ef0d5:docs/acceptance/evidence/B16/v1/attempt2.md`，已在 main 归档。 |
| B11 / C20 冻结 | B11 `9aee091` + review `b62034e`；C20 `cff6f97` + review `2acb283`。 |
| 认证冻结 / 两端候选 | 设计 `6f30032` + review `63bfe8f`；后端 `281716f`（代码 `471f35c`），前端 `cff597e`（代码 `1601bcc`）。 |
| A11 准备 / 启动边界 | 准备 `e351677492bc0ea9901c1807a97a0f09a3da9a85`；澄清 `4f9985f:docs/acceptance/evidence/AUTH-FLOW-CLARIFICATION/v1/author.md`。 |
| T50 / T51 / T52 | 冻结 `afda1c5` + review `f9eb35f`；T51 代码 `fdf03fd`、回执 `56cbfd6`；T52 `14e18ed`。 |
| R30 / 限定接缝 | 原设计 `ae9a395`、review `0467f46`；恢复方案 `7789974` + review `c82cd69` 仅放行材料补验和 M40 设计接缝。 |
| 材料补证 | C21 制品 `cfbbc1d` + 回执 `96be500`；C22 实际制品 `f29a7afc5254fc852811c9a9e2368f46cce3e01e` + 回执 `c8c089c`；受审组合 `8d48af5`；独立报告 `16d4b013b17b1e8d8c240c0d15a8b5366102024b:docs/acceptance/evidence/R30/v1/recovery-review.md`。 |
| M40 / C23 修正 | M40 设计 `a6a495a` + 作者 `b626a93` + 原 review `3da472e`；修正受测 `d1490531e014ef437374c2f5a23cf3073baeef56`。 |
| C24 探针 / 业务草稿 | 探针 `e7f979bd80ab83aaab7cc2cf936250123d7742a3`；保留草稿在 `TeacherWorkspace-c24/experiments/C24/business/`，不能当已提交成果。 |

## 当前材料阻塞与外部输入

- 当前权威结论为 [R30 恢复独立报告](/home/liam_t/项目/TeacherWorkspace-r30-recovery-review/docs/acceptance/evidence/R30/v1/recovery-review.md)，报告提交 `16d4b01`，受审组合 `8d48af5`。进程正常退出不改变本次 independent FAIL。C21 作者的“直接可用 6/6”只能视为结构性自验，不能据此关闭 EX-02。
- C21 公式/图资产来源、可信逐题评分及一致编辑证据归 C21/C20；C22 的一般 LaTeX 转换与旧 DOC 缺口归 C22/C20，R30 负责后续独立消费。新证据或明确范围决定到达前保持阻塞，不把实验欠账交给 R31/R34 首次验证。
- C22 制品完整 SHA 以本页固定索引及独立报告为准；原作者回执的完整 SHA、XML 哈希说明有误，原证据保留，当前引用已纠正。
- C22 的旧 DOC 补验窗口已关闭。需要同一固定样本在可用编辑/转换环境中的新证据，或用户明确调整支持范围；不能假定额度恢复等于实验窗口重开。
- 模型 API 已有真实连通和探针证据。账户余额与实际计费细节、完整部署、大陆网络、Windows/WPS/Edge/Chrome 目标流程仍未形成最终验收证据。
- 主干和文档 worktree 的 `.env` 是本地忽略文件；回执只记录凭据可用状态，不保存密钥。运行库、浏览器 profile、端口与实验制品按各任务隔离。
- 未完成任务的 worktree、日志和原始制品保留。只有用途完成且正式证据可追溯后才清理临时内容；本轮不清理被中断任务的现场。

<a id="低频-check-与回执监测"></a>
## 回执与状态检查

- 用户已取消定时 check；`teacherworkspace-check-01a0be12.timer` 已停止并禁用。不创建或恢复定时检查、watcher 或替代轮询。
- 任务由 Codex CLI 执行，外层保存退出码和日志并通过 `codex queue` 主动回执。派发完成后停止等待，不因没有新消息主动查询进度。
- 只有用户明确要求检查，或收到具体异常/中断通知时，才针对相关 session 做一次状态核对。结果已落盘但通知缺失时补齐接收；健康运行则等待；确认中断才按已有授权接续。
- 状态检查工具不替代主动通知；时间经过本身不表示失败、授权重派或允许扩大范围。
