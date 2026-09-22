# 当前运行台账

本页是编排者的当前状态与接续入口。节点依赖由 [DAG](mvp-dag.md) 拥有，范围由 [PRODUCT_SCOPE](../PRODUCT_SCOPE.md) 拥有，模型与角色规则由 [执行协议](execution-protocol.md#orchestration) 拥有。旧尝试的过程见原回执与 Git 历史；本页不重述已经失效的下一步。

## 上下文恢复入口

1. 读取根 [AGENTS.md](../../AGENTS.md)、本页的当前批次和对应任务包。
2. 依据固定候选与正式回执判断依赖；区分 `self`、`independent` 和用户验收。
3. 当前处于完整 DAG 执行状态。C25 设计 18293e9 已 independent 冻结，C25-D01 关闭；C26 已派 Astra low 在固定认证基线上实现真实 Agent；材料新窗口和 R31 基础分段启动均已 independent PASS，C21 新制品已 self PASS 并交独立消费，新增请求空正文仍保留；R31 基础切片已 self PASS；C22 的旧 DOC 规范化预览、LaTeX 结构/固定渲染及角色/打印已独立通过；C22 editing-1 在第一轮保存重开后的减号断言处 self FAIL，第二轮/PDF仍缺；C20 正裁定验证表示差异与最小接续；R30 原缺口仍未关闭。M40 冻结交接已完成，M41 先行依赖提案正限定独立核验，尚未放行实现；A12 本地认证定向独立复验已 PASS，两项缺陷关闭；真实邮件与目标设备仍待提供；T54 三项原缺陷独立关闭，D04 滚动返回修复 dd53c44 已 self PASS，T54 attempt 3 正定向独立复验；T51-MATH 局部补接 af19869 已 self PASS，真实作品与统一装配仍待依赖。依据下面派发记录接续，不重复派发，不主动轮询。
4. 权威材料确实缺少已作出的决定时，再查根 transcript：thread `01a0be12-5c28-7823-a7ed-644df825467f`，文件 `/home/liam_t/.codex/sessions/2026/09/20/rollout-2026-09-20T05-07-49-01a0be12-5c28-7823-a7ed-644df825467f.jsonl`。

## 当前用户授权与调度决定

- 用户明确恢复完整 DAG 执行，工作不限于原五项恢复任务。依赖就绪即可派发下游；收到 FAIL 必须按归属安排诊断、修复或必要设计裁决，不能仅登记后无限等待。产品范围、真实验收要求与外部动作权限保持不变。
- T50-IMPLEMENTATION-PREP、AUTH-INTEGRATION-PREP、AUTH-FLOW-CLARIFICATION attempt 2 已完成收尾，沿用成果。T51/T52 保留既有 self 结论，不重新实现。
- 产品设计、代码、自验和独立验收仍归相应 session。根只调度、核对回执元数据、维护台账与自身规则，不代做实质审查。
- 任务分支候选提交、本地运行验证和文档 main 合并已有许可。产品代码留在候选分支；本轮不包括产品合入 main、push、公开部署、发布、采购或额外付费。
- 已允许使用现有 GOAT 套餐进行必要实验；产品模型限 `deepseek/deepseek-v4.1-flash`、`z-ai/glm-5.3-flash`。计费条件不明或需要额外付费时停止相应调用，保留已有消耗记录。
- C26 本批必要真实自验已明确授权，限现有 GOAT 套餐和两个允许模型；逐次记录请求与实际 usage。C25/旧实验的零请求限制不传播成本次禁止使用模型；不得重跑旧窗口、无界试探或新增费用。
- 开发模型按[唯一映射](execution-protocol.md#模型与固定派发)执行；停用 dsh 与自动降级。内部 skill 助手继承调用 session。R30 原会话恢复及明确 `model at capacity` 后恢复原会话已有用户许可，session ID 不变；保持模型与 effort，不增加自动降级。
- 可独立的已授权任务并行使用 worktree；共享文件在各候选内由一个写者集成。派发 prompt 最小必要，失败归原拥有者，不以增加审查或换模型代替诊断。

## 当前派发记录

以下是最近一次已确认启动的记录，不是实时轮询结果。回执目录均相对 `/home/liam_t/项目/TeacherWorkspace-mvp`；每个目录含 `task.md`、`launch.json`、事件日志和完成后生成的回执。

| 任务 | 接续方式 | 实际模型 / effort | 状态 | session | 原始派发与回执目录 |
| --- | --- | --- | --- | --- | --- |
| C24-BUSINESS | 原 session 接续，attempt 2 / resume 1 | gpt-5.6-sol / medium | 已完成，self FAIL，制品 d826b72 | `01a0c7a8-94e5-7da1-bfe0-aa537396c067` | `.scratch/dag-dispatch/C24-BUSINESS/2/resume-1/` |
| R30-RECOVERY-REVIEW | 恢复原会话，attempt 1 | gpt-6-astra / medium | 已完成，independent FAIL | `01a0c642-8129-7c11-84d1-f64a3fa85255` | `.scratch/dag-dispatch/R30-RECOVERY-REVIEW/1/resume-1/` |
| C23-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS（限定） | `01a0c7a8-9494-7672-9e16-cfa5034ea18d` | `.scratch/dag-dispatch/C23-MATH-REVIEW/1/` |
| T53 | 新会话，attempt 3 | gpt-6-astra / low | 已完成，三项修复已独立确认 | `01a0c7e4-7387-7ff3-8fcd-5e79840ab177` | `.scratch/dag-dispatch/T53/3/` |
| A11 | 新会话，attempt 3 | gpt-6-astra / low | 已完成，self PASS | `01a0c7d9-dfcb-7562-a2fd-b36edacee619` | `.scratch/dag-dispatch/A11/3/` |
| M40-HANDOFF | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，冻结交接 PASS | `01a0c7c8-8354-7192-b525-9b10180805b0` | `.scratch/dag-dispatch/M40-HANDOFF/1/` |
| C24-BUSINESS-FIX | 新会话，attempt 1 | gpt-6-astra / low | 已完成，self PASS | `01a0c7c8-833e-7f12-9ecf-5dce76b8c2b7` | `.scratch/dag-dispatch/C24-BUSINESS-FIX/1/` |
| MATERIALS-NEXT-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，方案已独立冻结 | `01a0c7c8-8353-7113-b827-5e82f5bbf02d` | `.scratch/dag-dispatch/MATERIALS-NEXT-PLAN/1/` |
| A12-LOCAL | 新会话，attempt 2 | gpt-6-astra / medium | 已完成，本地 independent PASS / 外部 BLOCKED | `01a0c7ea-45a9-7ee0-8373-a849de8e660a` | `.scratch/dag-dispatch/A12-LOCAL/2/` |
| T54 | 新会话，attempt 3 | gpt-6-astra / medium | 已启动，定向复验 D04，待主动回执 | `01a0c810-eba8-70a2-b840-d4adc285310a` | `.scratch/dag-dispatch/T54/3/` |
| T52-SCROLL-FIX | 新会话，attempt 1 | gpt-6-astra / low | 已完成，D04 修复 self PASS | `01a0c7fb-bb99-7bb2-83b4-0cccd29d0bc0` | `.scratch/dag-dispatch/T52-SCROLL-FIX/1/` |
| C25 | 新会话，attempt 1 | gpt-6-astra / high | 已完成，修订设计已独立冻结 | `01a0c7d2-7a74-7050-8c8a-e28df0188772` | `.scratch/dag-dispatch/C25/1/` |
| C25-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，CHANGES_REQUIRED / independent | `01a0c7ee-7965-75f0-bad4-e0c38c979e51` | `.scratch/dag-dispatch/C25-REVIEW/1/` |
| C25-CORRECTION | 新会话，attempt 1 | gpt-6-astra / high | 已完成，READY_FOR_REVIEW / self | `01a0c7f6-fb1f-7e90-91f0-f78ed22857f6` | `.scratch/dag-dispatch/C25-CORRECTION/1/` |
| C25-CORRECTION-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS，D01 关闭 | `01a0c80d-5c5d-7e00-a062-3b573395024b` | `.scratch/dag-dispatch/C25-CORRECTION-REVIEW/1/` |
| C26 | 新会话，attempt 1 | gpt-6-astra / low | 已启动，固定输入集成与产品实现，待主动回执 | `01a0c819-d958-7c31-bc69-0833f485fc83` | `.scratch/dag-dispatch/C26/1/` |
| T50-MATH-CONTRACT | 新会话，attempt 1 | gpt-6-astra / high | 已完成，设计已独立冻结 | `01a0c7d5-b6d8-7232-b045-9ef61d8c46cb` | `.scratch/dag-dispatch/T50-MATH-CONTRACT/1/` |
| T50-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS | `01a0c7ec-38af-7142-91bf-78f8c33d253b` | `.scratch/dag-dispatch/T50-MATH-REVIEW/1/` |
| T51-MATH | 新会话，attempt 1 | gpt-6-astra / low | 已完成，局部 self PASS，待真实 math 装配 | `01a0c7f5-6025-7861-96db-7a113115ff68` | `.scratch/dag-dispatch/T51-MATH/1/` |
| MATERIALS-NEXT-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，两项 independent PASS | `01a0c7d7-ed98-7031-9c26-aa9df00b7834` | `.scratch/dag-dispatch/MATERIALS-NEXT-REVIEW/1/` |
| C21-MATERIALS-NEXT | 原会话接续，attempt 1 / resume 1 | gpt-6-astra / low | 已完成，原 EX 门槛 self PASS，待独立消费 | `01a0c7e0-6919-7c50-8ad4-091bb7f35bf8` | `.scratch/dag-dispatch/C21-MATERIALS-NEXT/1/resume-1/` |
| R30-C21-CONSUME | 新会话，attempt 1 | gpt-6-astra / medium | 已启动，待主动回执 | `01a0c80b-253e-7993-a699-dddb4c59e48c` | `.scratch/dag-dispatch/R30-C21-CONSUME/1/` |
| C22-MATERIALS-NEXT | 新会话，attempt 2 / editing-1 | gpt-6-astra / high | 已完成，self FAIL，窗口关闭 | `01a0c804-318e-7f73-9f71-f0560f2c8894` | `.scratch/dag-dispatch/C22-MATERIALS-NEXT/2/` |
| R30-C22-CONSUME | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent 分项 PASS / REV-002 FAIL | `01a0c7f9-be05-75b0-88e3-697f7ebdaa2a` | `.scratch/dag-dispatch/R30-C22-CONSUME/1/` |
| C20-C22-EDITING-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，限定裁决 self PASS | `01a0c7f9-be0a-77e1-b9e3-5ef3087c30e9` | `.scratch/dag-dispatch/C20-C22-EDITING-PLAN/1/` |
| C20-C22-VALIDATION-DECISION | 新会话，attempt 1 | gpt-6-astra / high | 已启动，待主动回执 | `01a0c815-df89-7b80-9b36-b5829906a875` | `.scratch/dag-dispatch/C20-C22-VALIDATION-DECISION/1/` |
| R31-FOUNDATION | 新会话，attempt 1 | gpt-6-astra / low | 已完成，基础切片 self PASS | `01a0c7e0-691d-75a1-9e6e-49758af3daeb` | `.scratch/dag-dispatch/R31-FOUNDATION/1/` |
| M41-DEPENDENCY-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，READY_FOR_REVIEW / self | `01a0c802-4422-7f60-8eb2-5eaeb0be0b7c` | `.scratch/dag-dispatch/M41-DEPENDENCY-PLAN/1/` |
| M41-DEPENDENCY-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已启动，待主动回执 | `01a0c813-49a7-7532-89ae-652ff3ae08a3` | `.scratch/dag-dispatch/M41-DEPENDENCY-REVIEW/1/` |

## 项目进度与当前门槛

完整 MVP 尚未交付。main 保留旧应用和新的规划/证据；本轮产品候选仍在任务分支。已通过的候选不会因 main 的文档更新漂移。

| 工作线 / DAG 节点 | 当前已成立的结论 | 尚缺条件或下一接点 |
| --- | --- | --- |
| 规划、入口与设计：P00/P01/G00、B10/B11、C20 | 规划与入口已完成；B11、C20 已独立冻结。G00 实施许可已恢复完整执行。 | 沿用现有设计与实验标准，不重新规划或重跑准备。 |
| 首条题库与备课：B12-B16 | 最新组合经 B16 independent PASS；真实保存、引用、重启恢复、隔离、失败恢复、桌面/Pad 已验证。 | 身份仍为 test-principal；不代表真实认证或完整题库范围通过。 |
| 认证：AUTH-CONTRACT、两端、A10-A12 | A12 本地 independent PASS：新候选 9ecabbf 的双页退出、恢复卡及必要退出/会话回归通过；未受影响的正常认证、隔离和持久重启结论沿用。 | 两项本地缺陷关闭，可供后续固定认证接线消费。A12 整体仍受真实邮件、目标设备/可信证书阻塞；备份恢复归可靠性阶段。 |
| 材料：C21/C22、R30-R35 | 原 R30 独立缺口仍开放。C21 新制品 9230895 的来源、评分、编辑与恢复达到作者自验门槛，正由 R30-C21-CONSUME 独立核验；三次新请求均空正文，不证明新材料在线提取。R31 基础切片 self PASS。 | C22 next-1 的旧 DOC 规范化预览、LaTeX 结构/固定渲染、角色隔离与分页/打印已独立通过；editing-1 已恢复选区且第一轮三项改动落盘，作者因减号码位断言停止；六份 DOCX 有提示，但第二轮/PDF/全页检查未完成。C20 正裁定工具修复边界，完整编辑与新输出仍未通过。两项 REV 尚未独立关闭；完整 R31 和 R32-R35 仍待材料门槛。 |
| 数学：C23、M40-M44 | M40/v1 设计已完成冻结交接，候选 1a5dd01；三项实验阻断 independent 关闭，交接动作仅 self 文档自检。 | M41 先行提案 2e67961 已 self 交付，正做限定独立核验；当前启动边未改。提案只放宽隔离模块先行，公共渲染依赖和页面身份仍需固定支持。M42 待 M41，M43 待 M42/R35；教学记录作品新版 a44587b 已独立冻结，T51-MATH 消费者 af19869 已局部 self PASS。真实数学提供方尚未实现。 |
| 班级与日程：T50-T54 | D01/D02/D03 已 independent 关闭；D04 主区返回与网格加载时序已修复，产品 dd53c44，10项定向 E2E/build/internal review self PASS。 | T54 attempt 3 正独立复验 D04 及必要滚动回归，完整 T54 尚未通过。T51-MATH 局部 self 已交付，新 Web 必须与注入真实 math 的 v2 API 同批装配；M43 收齐前置后接入，完整关联仍需 M44/WB-T020、认证与目标设备。 |
| Agent：C24-C27 | C24 业务实验 self PASS；C25 修订设计 18293e9 经 741025b independent PASS，工具公开投影缺口关闭，未变设计沿用。 | C26 正基于 A11 9ecabbf 与本地认证独立证据实现首页/共用右栏、持久对话和13个业务工具；本候选共享文件由 C26 独占。C27 等固定产品、自验与运行入口，真实外部条件另列。 |
| 可靠性：F60-F65 | 尚未启动。 | 等待 T54、C27、A12 的真实交付，再补全模块工具、现场、恢复和整日集成。 |
| 最终交付：D70-D75、G73/G76 | 尚未启动，未部署、未用户验收。 | 等待全范围验收、可用目标环境及具体交付动作授权。 |

## 下一步与回执处理

先核对任务、attempt/session、实际候选和证据级别。退出码 0 只说明进程结束，重复或迟到的旧回执不推进当前节点。完整执行授权覆盖依赖就绪后的派发，不需要每个节点重新请示。

| 工作 | 本轮动作 | 下游判断 |
| --- | --- | --- |
| M40 / T50 / T51 | 已接收 T51-MATH 产品 af19869 与回执 9fc6337，v2 记录、来源错误语义和反馈出口局部 self 通过；不追加相同 diff 审查。 | 真实 math 与 M43 前置到齐后由唯一装配者采用目录v3/同步端口/稳定路由；不能将升级 Web 单独接到仍只有旧 API 的候选。M44 后在新组合交 T54 验完整 WB-T020，当前滚动复验输入不变。 |
| C24 / C25 / C26 | 已接收 C25 独立冻结，直接派 C26 固定输入整合与实现，不增设普通Git准备审查。C26 记录组合基线后在本候选独占公共接线。 | 收到 C26 self 后按固定产品派 C27 独立实际流程验收；本轮必要live已按现有套餐授权，仅两个允许模型，逐次记账，不重跑 C24 或扩大费用。 |
| R30 / C20 / R31 | C22 editing-1 self FAIL 已接收；C20-C22-VALIDATION-DECISION 静态裁定减号表示及回读/替换/未改公式比较，给最小接续，不重复验收半成品。C21 正独立消费，R31 基础 self 交付。 | editing-1 窗口关闭；明确新接续边界后才修工具/补剩余验证，旧 DOC/结构等按固定独立证据沿用。完整新编辑与输出到齐后交 R30；依赖仍按当前 DAG。 |
| R31 / M41 | 已接收 M41-DEPENDENCY-PLAN 的先行提案，派 M41-DEPENDENCY-REVIEW 核对真实接缝、写权、支持输入与门禁。 | independent PASS 后才同步唯一启动边，按公共单写者提供依赖/身份支持并派隔离 M41。当前不启动数学实现；完整 M41 到 M42、R35 到 M43 及正式启动门槛保留，不重审 R31 全基础。 |
| A11 / A12 | 已接收本地 independent PASS，关闭 A12-LOCAL-001/002，无新增缺陷，不再派重复复验。 | C26 等后续组合消费固定 9ecabbf 与 aaa3d77 报告；外部邮件和目标设备输入到达后补真实验收，不提前解除 A12 整体及 F60 门禁。 |
| T52 / T53 / T54 | D01/D02/D03 已独立关闭，T52-SCROLL-FIX self 回执已接收，dd53c44 交 T54 attempt 3。 | 新固定候选只复验 D04 与必要滚动回归；T51-MATH 交付已固定，待真实 math 和装配前置后合流，真实作品/认证/目标设备门槛仍保留。 |

## 固定候选与必要证据

短 SHA 是仓库中已有对象的索引；派发记录固定完整 SHA。各任务 worktree 路径见 `launch.json`，只读消费者不得改写源候选。

| 对象 | 当前固定索引 |
| --- | --- |
| 首流受测组合 / 独立报告 | `612f0a9868743a1d5eea7e6f236d3ff903752439`；报告 `d1ef0d5:docs/acceptance/evidence/B16/v1/attempt2.md`，已在 main 归档。 |
| B11 / C20 冻结 | B11 `9aee091` + review `b62034e`；C20 `cff6f97` + review `2acb283`。 |
| 认证冻结 / 两端候选 | 设计 `6f30032` + review `63bfe8f`；后端 `281716f`（代码 `471f35c`），前端 `cff597e`（代码 `1601bcc`）。 |
| A11 候选 / 回执 / 启动边界 | 修复产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf`；self 回执 `4f45b40a323ff3db56e39d647367269bee63c214:docs/acceptance/evidence/A11/v1/attempt3.md`；基线 `6bac186` 保留原集成，启动澄清 `4f9985f`。 |
| A12 本地独立报告 | `aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md`；受测 `9ecabbf`，本地 PASS、外部 BLOCKED；未变结论沿用 `8bd41a5:docs/acceptance/evidence/A12/v1/local-review.md`，旧现场保留。 |
| T50 / T51 / T52 | 冻结 `afda1c5` + review `f9eb35f`；T51 代码 `fdf03fd`、回执 `56cbfd6`；T52 `14e18ed`。 |
| T50 作品关联候选 | 设计 `a44587b9bd18618d77df13f7349f5043a297d226`；作者 `6e1afef26a95c49ad559ed3790502313aa341dd7:docs/acceptance/evidence/T50-MATH-CONTRACT/v1/author.md`；独立冻结 `3dbead5af93059b0f890c531097b234e5f453fae:docs/acceptance/evidence/T50-MATH-CONTRACT/v1/review.md`，T51 局部可实施，完整关联保留真实提供方/M44 门槛。 |
| T51-MATH 消费者 | 产品 `af19869fad6f8908dd98a1e057a5df7a97d4c0f5`；回执 `9fc6337ed5ab00d0936e4d30c74173999e9e9ffc:docs/acceptance/evidence/T51-MATH/v1/author.md`、同目录 integration.md。156 API/30浏览器/build及内部双轴 self 通过，实际 math 为同版替身。`SourceRecordsPanel`、v2及错误回滚就绪；真实 math、目录v3和共享装配待 M43，完整 T51 未完成。 |
| T53 / T52 当前真实组合 | 最新滚动修复产品 `dd53c44af2952029530c7f65832f3cca22be80a2`；self 回执 `b8e9df704b47cfdd9f9adee5f9408953130c3f0f:docs/acceptance/evidence/T52/v1/scroll-fix.md`。包含原产品 `ff248141ac60668cca958b1212bcc2dfcf799490` 与 `680117f076b548ed997bfd11e4687614666a0b85` 所述三项修复；10项滚动自验通过，仍 test-principal。 |
| T54 独立报告 | `ae0f34c228c0cd52f356a5cbf1d21708c6e5e954:docs/acceptance/evidence/T54/v1/recheck.md`；受测 `ff24814`，D01/D02/D03 关闭，19 PASS/1 FAIL 为新 D04；原报告 `488c3b8` 沿用未变结论，身份 test-principal。 |
| R30 / 限定接缝 | 原设计 `ae9a395`、review `0467f46`；恢复方案 `7789974` + review `c82cd69` 仅放行材料补验和 M40 设计接缝。 |
| 材料补证 | C21 制品 `cfbbc1d` + 回执 `96be500`；C22 实际制品 `f29a7afc5254fc852811c9a9e2368f46cce3e01e` + 回执 `c8c089c`；受审组合 `8d48af5`；独立报告 `16d4b013b17b1e8d8c240c0d15a8b5366102024b:docs/acceptance/evidence/R30/v1/recovery-review.md`。 |
| 材料新方案 | 内容 `cd751b68e5001999b5a5f7544254c41d804f058a`；完整交付 `68f66587d4d625ee9c8f75516eafa61913b57e40:docs/arch/capability-checks/materials-next.md`；短包 `docs/plans/tasks/materials/next.md`；独立分项冻结 `0fb32a6e31d4ea0a6673bcce15423137a9a68b0a:docs/acceptance/evidence/MATERIALS-NEXT-PLAN/v1/review.md`。 |
| M40 / C23 修正 | 冻结交接 `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md`；M40 设计 `a6a495a` + 作者 `b626a93` + 原 review `3da472e`；修正受测 `d1490531e014ef437374c2f5a23cf3073baeef56`；独立 PASS `b01bc73954cbbc13e464738e0f6f8aa6c6f12084:docs/acceptance/evidence/M40/v1/correction-review.md`。 |
| C24 探针 / 业务实验 | 探针 `e7f979bd80ab83aaab7cc2cf936250123d7742a3`；旧业务 FAIL `d826b72`；修复与 self PASS `e8fdf9a139e429c05590925647a433a9da382579:docs/acceptance/evidence/C24/v1/business-fix.md`。 |
| C25 首批 Agent 冻结 | 设计 `18293e9389e739ed8aaf67ee568503ca8e87d475`；作者 `5e1193524c9d1d91c3a35adec3df3c832313819b`；独立冻结 `741025bd0a8e09098b5877428b81c2bdd7f357d0:docs/acceptance/evidence/C25/v1/correction-review.md`，C25-D01 关闭。原独立 `e0b2c23fc1e37c357831cefacb0817c07ae3cafd` 的未变结论沿用。 |
| C26 固定实现输入 | C25 设计/冻结见上；A11 产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf` 已包含 B16 `612f0a9`；A11 作者 `4f45b40`、A12 本地独立 `aaa3d77`。C26 分支 `feat/c26-agent`，初始主干 `e365dea`，worker 负责输入组合并记录实现前完整 SHA；不读取活动业务分支替换，认证外部条件仍开放。 |
| C21 next-1 新结果 | 制品 `9230895a802ac46dfa3ceefc660659dd8bc8abf7`；作者 `ecd1ed6d8f974fba20ac92d40d5b6b943a3b0170:docs/acceptance/evidence/C21-MATERIALS-NEXT/v1/author.md`。五入口主要内容自评分6/5/6/4/6，七入口编辑/重启回读及 E/F 恢复 self PASS；新请求全部空正文，机器/人工版本及失败分列，待 R30 独立判断。 |
| C22 next-1 独立消费 | 制品 `d2b324520064dbae663a46acb7045c84bd55a890`；作者 `a05324d7886b2603d5caaf19af3e46ce93dce973`；独立报告 `179f353755ff987cfba8678f782b242da3122bf1:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-review.md`。固定旧 DOC 规范化预览、LaTeX 结构/固定渲染、角色/分页/打印限定 PASS；完整 DOCX 编辑与 Q2 文内标记仍 FAIL，REV-002 不关闭。零模型，未重置窗口。 |
| R31 文件内容基础 | 产品 `5f696b8ce611e67d940ce149ce13946a50b65510`；回执 `c08fa62d434efffc89b471151faa73308e3ce716:docs/acceptance/evidence/R31-FOUNDATION/v1/author.md` 及同目录 integration.md；文件 HTTP/重启/迁移/文档编辑 self PASS，完整 R31 与转换未完成，正式启动保护保留。 |
| M41 先行依赖提案 | 设计 `2e67961b01f4ce90ab07dad1feb823b1f595266d:docs/arch/math-foundation-dependency.md`；作者 `76151489f28cfe1ccaddd8afa28db3c613f3c6a5:docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/author.md`。建议在真实文件基础做隔离制作/保存/导出，仍待独立冻结；公共依赖/身份有归属，未改 DAG 或开始 M41。 |
| C22 editing-1 裁决 | 设计 `d5cb05bd306f1855d78f14096fd840f72cae3ec4:docs/arch/capability-checks/C22-editing-next.md`；作者 `5fae85f4b00a413581951776dae111898f455bbf`。仅修验证工具与既有校对提示，契约/范围/依赖不变；Astra high 一次有界接手，首次 Office 起30分钟、无后续失败复测、零模型；旧窗口及消耗保留。 |
| C22 editing-1 结果 | 制品 `1ef7bf378dfad77a46d6b6f282a5db4d3a1e9fd2`；回执 `8ab93a37455400c8f54c7a331727dc428936a9fb:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt2.md`。self FAIL；第一轮三项编辑 DOCX 重开值保留，减号断言中止，第二轮/PDF/全页未做。1复现/1候选/1链尝试/0追加复测，Office含保全253.645秒，零产品请求/费用；窗口关闭，全部现场保留。 |

## 当前材料阻塞与外部输入

- C21 next-1 已交 self PASS，原 EX 门槛与 REV-001 是否关闭由 R30 独立消费判断。新增 P/I/PS 三次 DeepSeek 请求均 HTTP200/length/空正文，23,996 completion；累计16次请求、14份 usage、已知92,785 completion，旧两次缺 usage。批次关闭，不因尚余配额继续尝试；如在线提取仍欠证，归 C20 依据现有响应裁决，不冒充新模型成功。

- C24 真业务累计 32 次 DeepSeek provider 请求、93,970 total tokens；本轮修复新增 7 次、36,651 tokens。PI-01/02 消耗另有原账本，不能混成全部实验总量。副本读回补验已通过，计费余额/extra credits 状态仍未知；cost=0 不证明免费。
- R30 整体仍 CHANGES_REQUIRED：原失败 `16d4b01` 的 C21 缺口待新 9230895 独立消费；C22 当前分项依据为 `179f353`，旧 DOC 规范化预览和一般 LaTeX 结构缺口限定关闭，完整编辑与 Q2 标记未关闭。旧报告不覆盖更新切片，新切片也不能转签为完整 R30 或产品 PASS。
- C21 来源、逐题评分与一致编辑的独立判断归 R30；C22 editing-1 已返回，剩余校验与第二轮/输出归 C22；C20 先判断表示差异和必要接续，不自动重置已耗窗口或把自验回读当独立闭环。旧 DOC、结构与打印的独立结论只适用于绑定制品，Windows/WPS 目标环境仍待输入。原 REV 必须由 R30 据新证据逐项关闭。
- C22 制品完整 SHA 以本页固定索引及独立报告为准；原作者回执的完整 SHA、XML 哈希说明有误，原证据保留，当前引用已纠正。
- 旧材料实验窗口已关闭，其失败结论与消耗保留。用户已要求恢复完整工作，已据此冻结新的有界计划，不能自动重置原尝试或削减支持范围；需要真实外部环境或范围变更时再明确升级。
- 模型 API 已有真实连通和探针证据。账户余额与实际计费细节、完整部署、大陆网络、Windows/WPS/Edge/Chrome 目标流程仍未形成最终验收证据。
- 主干和文档 worktree 的 `.env` 是本地忽略文件；回执只记录凭据可用状态，不保存密钥。运行库、浏览器 profile、端口与实验制品按各任务隔离。
- 未完成任务的 worktree、日志和原始制品保留。只有用途完成且正式证据可追溯后才清理临时内容；本轮不清理被中断任务的现场。

<a id="低频-check-与回执监测"></a>
## 回执与状态检查

- 用户已取消定时 check；`teacherworkspace-check-01a0be12.timer` 已停止并禁用。不创建或恢复定时检查、watcher 或替代轮询。
- 任务由 Codex CLI 执行，外层保存退出码和日志并通过 `codex queue` 主动回执。派发完成后停止等待，不因没有新消息主动查询进度。
- 只有用户明确要求检查，或收到具体异常/中断通知时，才针对相关 session 做一次状态核对。结果已落盘但通知缺失时补齐接收；健康运行则等待；确认中断才按已有授权接续。
- 状态检查工具不替代主动通知；时间经过本身不表示失败、授权重派或允许扩大范围。
