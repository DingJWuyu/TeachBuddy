# 当前运行台账

本页是编排者的当前状态与接续入口。节点依赖由 [DAG](mvp-dag.md) 拥有，范围由 [PRODUCT_SCOPE](../PRODUCT_SCOPE.md) 拥有，模型与角色规则由 [执行协议](execution-protocol.md#orchestration) 拥有。旧尝试的过程见原回执与 Git 历史；本页不重述已经失效的下一步。

## 上下文恢复入口

1. 读取根 [AGENTS.md](../../AGENTS.md)、本页的当前批次和对应任务包。
2. 依据固定候选与正式回执判断依赖；区分 `self`、`independent` 和用户验收。
3. 当前处于完整 DAG 执行状态。先按“当前派发记录”识别正在执行与已结束的任务，再按“项目进度与当前门槛”和“下一步与回执处理”接续。固定制品与独立证据以本页索引为准；不从已投递通知推定输入已消费，不重复派发，不主动轮询。
4. 权威材料确实缺少已作出的决定时，再查根 transcript：thread `01a0be12-5c28-7823-a7ed-644df825467f`，文件 `/home/liam_t/.codex/sessions/2026/09/20/rollout-2026-09-20T05-07-49-01a0be12-5c28-7823-a7ed-644df825467f.jsonl`。

## 当前用户授权与调度决定

- 用户明确恢复完整 DAG 执行，工作不限于原五项恢复任务。依赖就绪即可派发下游；收到 FAIL 必须按归属安排诊断、修复或必要设计裁决，不能仅登记后无限等待。产品范围、真实验收要求与外部动作权限保持不变。
- T50-IMPLEMENTATION-PREP、AUTH-INTEGRATION-PREP、AUTH-FLOW-CLARIFICATION attempt 2 已完成收尾，沿用成果。T51/T52 保留既有 self 结论，不重新实现。
- 产品设计、代码、自验和独立验收仍归相应 session。根只调度、核对回执元数据、维护台账与自身规则，不代做实质审查。
- 任务分支候选提交、本地运行验证和文档 main 合并已有许可。产品代码留在候选分支；本轮不包括产品合入 main、push、公开部署、发布、采购或额外付费。
- 已允许使用现有 GOAT 套餐进行必要实验；产品模型限 `deepseek/deepseek-v4.1-flash`、`z-ai/glm-5.3-flash`。计费条件不明或需要额外付费时停止相应调用，保留已有消耗记录。
- C26既有自验10次/79,983 totalTokens与C27独立新链11次/88,550 totalTokens分别记账，两批usage齐全，费用与余额未知，窗口结束。C26修复及C27 attempt 2独立复验均为零产品调用；D01已关闭，本地C27 PASS，未重开付费链。
- C21全部在线窗口已关闭。attempt 5仅页2一次请求，HTTP200/length，正文440字符不完整，新增7998completion（7809reasoning），余1/3/4页未发。累计19次/16份usage/108777已知completion，历史3份usage缺失及online-1预留8000未知保持。按C20方案a510cc0已定停止条件，固定页级路线FAIL；无新证据不追加小幅试参或新窗口，剩余3次/24000额度作废。在线能力仍未交付，不重开REV-001、不新增R30门禁。
- 开发模型按[唯一映射](execution-protocol.md#模型与固定派发)执行；停用 dsh 与自动降级。内部 skill 助手继承调用 session。R30 原会话恢复及明确 `model at capacity` 后恢复原会话已有用户许可，session ID 不变；保持模型与 effort，不增加自动降级。
- 可独立的已授权任务并行使用 worktree；共享文件在各候选内由一个写者集成。派发 prompt 最小必要，失败归原拥有者，不以增加审查或换模型代替诊断。

## 当前派发记录

以下是最近一次已确认启动的记录，不是实时轮询结果。回执目录均相对 `/home/liam_t/项目/TeacherWorkspace-mvp`；每个目录含 `task.md`、`launch.json`、事件日志和完成后生成的回执。

| 任务 | 接续方式 | 实际模型 / effort | 状态 | session | 原始派发与回执目录 |
| --- | --- | --- | --- | --- | --- |
| C24-BUSINESS | 原 session 接续，attempt 2 / resume 1 | gpt-5.6-sol / medium | 已完成，self FAIL，制品 d826b72 | `01a0c7a8-94e5-7da1-bfe0-aa537396c067` | `.scratch/dag-dispatch/C24-BUSINESS/2/resume-1/` |
| R30-RECOVERY-REVIEW | 恢复原会话，attempt 1 | gpt-6-astra / medium | 已完成，independent FAIL | `01a0c642-8129-7c11-84d1-f64a3fa85255` | `.scratch/dag-dispatch/R30-RECOVERY-REVIEW/1/resume-1/` |
| C23-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS（限定） | `01a0c7a8-9494-7672-9e16-cfa5034ea18d` | `.scratch/dag-dispatch/C23-MATH-REVIEW/1/` |
| T53 | 新会话，attempt 4 | gpt-6-astra / low | 已完成，真实认证组合self PASS，已交T54 | `01a0c857-87f1-7342-adf1-4dc038f9b595` | `.scratch/dag-dispatch/T53/4/` |
| A11 | 新会话，attempt 3 | gpt-6-astra / low | 已完成，self PASS | `01a0c7d9-dfcb-7562-a2fd-b36edacee619` | `.scratch/dag-dispatch/A11/3/` |
| M40-HANDOFF | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，冻结交接 PASS | `01a0c7c8-8354-7192-b525-9b10180805b0` | `.scratch/dag-dispatch/M40-HANDOFF/1/` |
| C24-BUSINESS-FIX | 新会话，attempt 1 | gpt-6-astra / low | 已完成，self PASS | `01a0c7c8-833e-7f12-9ecf-5dce76b8c2b7` | `.scratch/dag-dispatch/C24-BUSINESS-FIX/1/` |
| MATERIALS-NEXT-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，方案已独立冻结 | `01a0c7c8-8353-7113-b827-5e82f5bbf02d` | `.scratch/dag-dispatch/MATERIALS-NEXT-PLAN/1/` |
| A12-LOCAL | 新会话，attempt 2 | gpt-6-astra / medium | 已完成，本地 independent PASS / 外部 BLOCKED | `01a0c7ea-45a9-7ee0-8373-a849de8e660a` | `.scratch/dag-dispatch/A12-LOCAL/2/` |
| T54 | 新会话，attempt 5 | gpt-6-astra / medium | 已完成，本地real-auth independent PASS，完整T54仍待数学/外部输入 | `01a0c872-7462-7853-ac06-63ab2125569c` | `.scratch/dag-dispatch/T54/5/` |
| T52-SCROLL-FIX | 新会话，attempt 2 | gpt-6-astra / low | 已完成，D05修复self PASS，交T54独立复验 | `01a0c82e-5ff8-7b20-9b4d-32b7f241b4f3` | `.scratch/dag-dispatch/T52-SCROLL-FIX/2/` |
| C25 | 新会话，attempt 1 | gpt-6-astra / high | 已完成，修订设计已独立冻结 | `01a0c7d2-7a74-7050-8c8a-e28df0188772` | `.scratch/dag-dispatch/C25/1/` |
| C25-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，CHANGES_REQUIRED / independent | `01a0c7ee-7965-75f0-bad4-e0c38c979e51` | `.scratch/dag-dispatch/C25-REVIEW/1/` |
| C25-CORRECTION | 新会话，attempt 1 | gpt-6-astra / high | 已完成，READY_FOR_REVIEW / self | `01a0c7f6-fb1f-7e90-91f0-f78ed22857f6` | `.scratch/dag-dispatch/C25-CORRECTION/1/` |
| C25-CORRECTION-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS，D01 关闭 | `01a0c80d-5c5d-7e00-a062-3b573395024b` | `.scratch/dag-dispatch/C25-CORRECTION-REVIEW/1/` |
| C26 | 新会话，attempt 2 | gpt-6-astra / low | 已完成，公式依赖/局部滚动修复self PASS，零模型 | `01a0c87e-8cdb-75a1-ab5e-3aed859d92a6` | `.scratch/dag-dispatch/C26/2/` |
| C27 | 新会话，attempt 2 | gpt-6-astra / medium | 已完成，independent PASS，D01关闭，本地阶段放行 | `01a0c890-dff2-7142-960e-a988830e9950` | `.scratch/dag-dispatch/C27/2/` |
| LOCAL-STAGES-DOCS | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，文档self PASS并集成，已消费R30补充 | `01a0c89b-f823-7ee1-8482-1602c15f5ef9` | `.scratch/dag-dispatch/LOCAL-STAGES-DOCS/1/` |
| T50-MATH-CONTRACT | 新会话，attempt 1 | gpt-6-astra / high | 已完成，设计已独立冻结 | `01a0c7d5-b6d8-7232-b045-9ef61d8c46cb` | `.scratch/dag-dispatch/T50-MATH-CONTRACT/1/` |
| T50-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS | `01a0c7ec-38af-7142-91bf-78f8c33d253b` | `.scratch/dag-dispatch/T50-MATH-REVIEW/1/` |
| T51-MATH | 新会话，attempt 1 | gpt-6-astra / low | 已完成，局部 self PASS，待真实 math 装配 | `01a0c7f5-6025-7861-96db-7a113115ff68` | `.scratch/dag-dispatch/T51-MATH/1/` |
| MATERIALS-NEXT-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，两项 independent PASS | `01a0c7d7-ed98-7031-9c26-aa9df00b7834` | `.scratch/dag-dispatch/MATERIALS-NEXT-REVIEW/1/` |
| C21-MATERIALS-NEXT 定位 | 新会话，attempt 2 / location | gpt-6-astra / low | 已完成，定位与保存恢复self PASS，零请求 | `01a0c839-0aeb-78c1-89bd-e4d147bc82c1` | `.scratch/dag-dispatch/C21-MATERIALS-NEXT/2/` |
| R30-C21-CONSUME | 新会话，attempt 2 | gpt-6-astra / medium | 已完成，independent PASS，EX-02/REV-001关闭 | `01a0c84f-3351-7282-9648-fdd69097af1a` | `.scratch/dag-dispatch/R30-C21-CONSUME/2/` |
| C22-MATERIALS-NEXT | 新会话，attempt 4 / control-1 | gpt-6-astra / high | 已完成，本机两轮编辑及输出self PASS | `01a0c836-5f80-74e0-927c-d8759b1f5db3` | `.scratch/dag-dispatch/C22-MATERIALS-NEXT/4/` |
| R30-C22-CONSUME | 新会话，attempt 3 | gpt-6-astra / high | 已完成，independent PASS，REV-002本机缺口关闭 | `01a0c86f-74ea-7c42-be68-a1f3c476cff7` | `.scratch/dag-dispatch/R30-C22-CONSUME/3/` |
| R30-FREEZE-PREP | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，固定文档候选8b8656a，self；在线状态文字仍待同步 | `01a0c887-b0f4-7b30-a6fd-6517622e0944` | `.scratch/dag-dispatch/R30-FREEZE-PREP/1/` |
| R30-FINAL-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS，R30冻结，无必修项 | `01a0c896-ba1c-70d3-8ad9-c27bf6aff3de` | `.scratch/dag-dispatch/R30-FINAL-REVIEW/1/` |
| C20-C22-EDITING-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，限定裁决 self PASS | `01a0c7f9-be0a-77e1-b9e3-5ef3087c30e9` | `.scratch/dag-dispatch/C20-C22-EDITING-PLAN/1/` |
| C20-C22-VALIDATION-DECISION | 新会话，attempt 1 | gpt-6-astra / high | 已完成，限定裁决 self PASS，无契约变化 | `01a0c815-df89-7b80-9b36-b5829906a875` | `.scratch/dag-dispatch/C20-C22-VALIDATION-DECISION/1/` |
| R31-FOUNDATION | 新会话，attempt 1 | gpt-6-astra / low | 已完成，基础切片 self PASS | `01a0c7e0-691d-75a1-9e6e-49758af3daeb` | `.scratch/dag-dispatch/R31-FOUNDATION/1/` |
| R31 | 新会话，attempt 1 | gpt-6-astra / low | 已完成，完整公共底座self PASS并停写，交R32-R34 | `01a0c8a3-5856-7701-97e3-87ddd9055fb7` | `.scratch/dag-dispatch/R31/1/` |
| R32 | 新会话，attempt 1 | gpt-6-astra / low | 已交付并停写；模块自验通过，总构建BLOCKED归R34注册 | `01a0c8c0-4a2b-76c3-8690-7bbeba9d3bd4` | `.scratch/dag-dispatch/R32/1/` |
| R33 | 新会话，attempt 4 | gpt-6-astra / low | 已派原包零调用片段/跨页/来源接续；在线仍BLOCKED | `01a0c92c-d458-7810-ab1e-dd642ce89558` | `.scratch/dag-dispatch/R33/4/` |
| R34 | 新会话，attempt 3 | gpt-6-astra / low | 已完成，限定组合self通过/完整BLOCKED；重启异常仍OPEN | `01a0c90e-b273-76c1-bb08-16f3462f4c12` | `.scratch/dag-dispatch/R34/3/` |
| R34-RESTART-DIAGNOSIS | 新会话，attempt 1 | gpt-6-astra / high | 已交付c915f59并停写；诊断增强self通过，历史根因仍OPEN/BLOCKED | `01a0c921-e31a-7c70-92e3-c9a931403c30` | `.scratch/dag-dispatch/R34-RESTART-DIAGNOSIS/1/` |
| R30-MATERIALS-CONTINUATION | 新会话，attempt 1 | gpt-6-astra / high | 已交self提案da23eb6，零调用接续可做；启动边例外待独立 | `01a0c921-e325-7290-85da-dd0a0ca167ef` | `.scratch/dag-dispatch/R30-MATERIALS-CONTINUATION/1/` |
| R30-CONTINUATION-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已派限定M43/M44启动边独立核验 | `01a0c92c-d460-7e40-b4dc-82b1df431ca7` | `.scratch/dag-dispatch/R30-CONTINUATION-REVIEW/1/` |
| R35-LOCAL | 新会话，attempt 1 | gpt-6-astra / medium | 已派固定6398bf2本地真实材料独立采证，完整节点未验 | `01a0c92c-d454-75f3-b5ba-f04773146d15` | `.scratch/dag-dispatch/R35-LOCAL/1/` |
| C20-T-INPUT | 新会话，attempt 1 | gpt-6-astra / high | 已完成self PASS，既有判据适用澄清，无冻结变化 | `01a0c909-005c-7393-90b2-8c774a402004` | `.scratch/dag-dispatch/C20-T-INPUT/1/` |
| M41-DEPENDENCY-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，READY_FOR_REVIEW / self | `01a0c802-4422-7f60-8eb2-5eaeb0be0b7c` | `.scratch/dag-dispatch/M41-DEPENDENCY-PLAN/1/` |
| M41-DEPENDENCY-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，限定 independent PASS | `01a0c813-49a7-7532-89ae-652ff3ae08a3` | `.scratch/dag-dispatch/M41-DEPENDENCY-REVIEW/1/` |
| M41 | 新会话，attempt 2 | gpt-6-astra / low | 已完成，静态数学原包全项self PASS，已停写交M42 | `01a0c869-2ebb-70b3-8489-66df3f146880` | `.scratch/dag-dispatch/M41/2/` |
| M42 | 新会话，attempt 2 | gpt-6-astra / low | 已完成，fixture补修self PASS并停写，完整候选b070390 | `01a0c8ae-6557-7701-9a12-106bab01e544` | `.scratch/dag-dispatch/M42/2/` |
| A11-BOOTSTRAP-FIX | 新会话，attempt 1 | gpt-6-astra / low | 已完成，诊断self PASS；正式入口正常，缺口归math fixture | `01a0c88d-f150-7963-b139-ca57f1699eaf` | `.scratch/dag-dispatch/A11-BOOTSTRAP-FIX/1/` |
| R31-MATH-SUPPORT | 新会话，attempt 2 | gpt-6-astra / low | 已完成，公共组合self PASS，停写并交M41 | `01a0c853-90e4-7e93-b1a0-f760a898c7fb` | `.scratch/dag-dispatch/R31-MATH-SUPPORT/2/` |
| M41-DOCS | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，获准调度入口已整合 | `01a0c824-e785-7111-a426-c710a6bca16c` | `.scratch/dag-dispatch/M41-DOCS/1/` |
| C20-C21-CONTINUATION | 新会话，attempt 1 | gpt-6-astra / high | 已完成，两切片均已按各自条件派发 | `01a0c82c-237b-7c43-9303-6d7f8e61a7a8` | `.scratch/dag-dispatch/C20-C21-CONTINUATION/1/` |
| C20-C21-ONLINE-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，限定 independent PASS | `01a0c839-0f97-7e70-bc81-c6c263f427b3` | `.scratch/dag-dispatch/C20-C21-ONLINE-REVIEW/1/` |
| C21-MATERIALS-NEXT 在线 | 新会话，attempt 5 / page-transcription | gpt-6-astra / low | 已完成，self FAIL，单页输出截断；窗口关闭，无后续调用 | `01a0c877-2910-7980-beb7-be1982b11359` | `.scratch/dag-dispatch/C21-MATERIALS-NEXT/5/` |
| C20-C21-PROVIDER | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，调查self PASS，零新增产品请求 | `01a0c849-91a3-71e1-835f-a52eb201ba94` | `.scratch/dag-dispatch/C20-C21-PROVIDER/1/` |
| C20-C21-ONLINE-DECISION | 新会话，attempt 1 | gpt-6-astra / high | 已完成，页级方案经实验失败；执行原停止条件，待新证据再裁决 | `01a0c86c-4f78-72a3-a5fd-f44c6d1e8d35` | `.scratch/dag-dispatch/C20-C21-ONLINE-DECISION/1/` |

## 项目进度与当前门槛

完整 MVP 尚未交付。main 保留旧应用和新的规划/证据；本轮产品候选仍在任务分支。已通过的候选不会因 main 的文档更新漂移。

| 工作线 / DAG 节点 | 当前已成立的结论 | 尚缺条件或下一接点 |
| --- | --- | --- |
| 规划、入口与设计：P00/P01/G00、B10/B11、C20 | 规划与入口已完成；B11、C20 已独立冻结。G00 实施许可已恢复完整执行。 | 沿用现有设计与实验标准，不重新规划或重跑准备。 |
| 首条题库与备课：B12-B16 | 最新组合经 B16 independent PASS；真实保存、引用、重启恢复、隔离、失败恢复、桌面/Pad 已验证。 | 身份仍为 test-principal；不代表真实认证或完整题库范围通过。 |
| 认证：AUTH-CONTRACT、两端、A10-A12 | 固定9ecabbf经A12本地independent PASS。911e7b8确认正式App正常、遗漏归math fixture；M42补修b070390已self关闭同页退出后重登/注册准备，认证产品未修改。 | 不重开认证设计或A12审查。真实邮件/目标设备/可信证书和备份恢复等原外部边界保留。 |
| 材料：C21/C22、R30-R35 | 6398bf2真实组合/导航self通过；R30 da23eb6明确原R33内部接续缺口，无新在线依据。共享重启c915f59已补诊断并停写，真实三进程重启与4项回归通过，原异常仍OPEN，无业务修复。 | R33/4本地补齐、R35-LOCAL固定6398bf2独立采证、M43启动边核验继续。诊断测试增强待下一固定组合，不切换活动验收输入；等自然失败新证据再查原原因，不重置尝试。完整材料/在线/设备门槛保持。 |
| 数学：C23、M40-M44 | M41/M42原自验固定并停写，完整M42 b070390含fixture补修aa8b3ac，数学产品689a194。R30 da23eb6仅提议R35本地消费切片独立通过后启动M43本地实现。 | 需限定independent PASS和根采纳该启动例外，且指定材料消费切片逐项独立通过、共享唯一写权到齐；当前M43未派。完整R35/M43/M44及Windows/Edge/WPS/触屏/课堂条件保持，不由局部通过替代。 |
| 班级与日程：T50-T54 | D01-D05均independent关闭；bad090f经T54 attempt 4独立22项PASS，桌面/窄桌面/平板滚动、返回刷新及账户现场通过，仍test-principal。 | T53真实认证产品f811a27经T54报告ab19d5d本地independent PASS：37项及独立Chrome手动保存/进程重启通过，身份、隔离、迟到响应和D01-D05传播无新缺陷。T51-MATH局部self仍待真实math与v2同批装配，M43收齐前置接入；完整T54保留M44/WB-T020与目标设备条件。 |
| Agent：C24-C27 | C25设计冻结，C26产品687121e/完整ec5094c经C27独立6d48bc7关闭D01；与原34e668a未变真实模型链/持久/隔离结论合用，本地阶段independent PASS。 | 阶段文档已整合，无需新增审查或模型调用。两条未变moderate依赖公告作为C27-O01交后续依赖维护，未证可达产品缺陷，不阻断本地阶段。F60仍受完整T54/A12条件约束，未合主干或完成整体MVP。 |
| 可靠性：F60-F65 | 尚未启动；C27本地阶段已independent PASS。 | 仍待完整T54数学关联/目标条件及A12真实外部交付，随后按原节点补全模块工具、现场、恢复和整日集成；C27通过不单独满足全部启动依赖。 |
| 最终交付：D70-D75、G73/G76 | 尚未启动，未部署、未用户验收。 | 等待全范围验收、可用目标环境及具体交付动作授权。 |

## 下一步与回执处理

先核对任务、attempt/session、实际候选和证据级别。退出码 0 只说明进程结束，重复或迟到的旧回执不推进当前节点。完整执行授权覆盖依赖就绪后的派发，不需要每个节点重新请示。

| 工作 | 本轮动作 | 下游判断 |
| --- | --- | --- |
| M40 / T50 / T51 | 已接收 T51-MATH 产品 af19869 与回执 9fc6337，v2 记录、来源错误语义和反馈出口局部 self 通过；不追加相同 diff 审查。 | 真实 math 与 M43 前置到齐后由唯一装配者采用目录v3/同步端口/稳定路由；不能将升级 Web 单独接到仍只有旧 API 的候选。M44 后在新组合交 T54 验完整 WB-T020，当前滚动复验输入不变。 |
| C24 / C25 / C26 / C27 | 独立6d48bc7关闭D01，本地C27 PASS，旧live/持久/隔离结论按固定版本沿用；文档已整合。 | 不追加普通审查或产品模型调用，C27-O01待后续维护，F60原依赖保持。当前R33本地接续、R35独立采证和启动边核验并行；共享诊断已结束，等待主动回执。 |
| R30 / C20 / R31 | 提案 `da23eb6` 文档整合 `598209b`，没有新语义或在线预算；缺失实现归既有R33。仅M43/M44本地启动例外需限定独立核验，设计作者未自行冻结。 | R33和R35本地工作可沿原范围接续，已派；新启动边由R30-CONTINUATION-REVIEW核验，结果到齐再决定采纳/文档同步。不得把正在核验提案写成M43已放行或新增窗口，正式门禁继续有效。 |
| R31 / M41 / M42 | R31底座2b6cbcd、M42完整b070390均已self停写。R35-LOCAL受测材料6398bf2不变；c915f59仅增强共享测试cause/阶段/现场记录，业务与服务生命周期未改，历史异常仍未关闭。 | M43启动例外尚未核验采纳，旧前置有效。后续如获限定放行，仍需材料消费切片independent通过、固定M42/M40及公共独占权；诊断增强与R33新代码由下一唯一写者显式组合，受影响回归和原观察保留。 |
| C21 定位 / 在线 | da23eb6复查原始失败/Provider资料后仍无足够新证据；所有旧窗口关闭，新增请求/completion许可0，19次及未知usage账不清零。T澄清43b117c保持，缺图草稿仍阻断。 | 现有产品内部fragments适配、选页归并、答案页未完成语义、body/solution分别定位和自身图源可零调用实现，已交R33/4。重放/合成/原生结果分开；生产网络Provider待有依据的路线，不把已接handler当真实模型可用。外部提供方与解除证据见固定提案。 |
| A11 / A12 | M42 attempt 2在固定诊断上实际复现2项RED并修复：同页登录/注册保存、准备失败重试、两账户隔离及不自动restore通过。当前integration2纠正前轮旧归属，正式认证和App均未改。 | fixture缺口已self闭环，无需新的认证任务或重复A12验收；原A12外部条件仍待输入。M43/M44按固定新候选接续原实际流程验收。 |
| T52 / T53 / T54 | 已接收独立报告ab19d5d，本地身份组合PASS，无新缺陷；D01-D05传播和真实保存/退出重登/隔离/保留库重启通过。无需修复回流或重复核验。 | 后续业务汇合消费教学产品f811a27、作者4a6b773和独立ab19d5d。T51-MATH v2、M43真实接线/M44/WB-T020及外部设备仍未完成；完整T54与F60门槛保留，当前材料三消费者并行，数学固定成果等待材料前置。 |

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
| T53 / T52 原test-principal滚动组合 | 最新D05修复产品 `bad090f0369c3479a1eb3709217577659b605401`；self 回执 `8eb9887fe30e40db2237e23e2c28515573561295:docs/acceptance/evidence/T52/v1/scroll-fix2.md` 及 scroll-fix2/。20项定向验证及生产构建通过，内部Standards/Spec均PASS；仍test-principal。包含旧 `dd53c44` / `b8e9df7` 与原组合 `ff248141` 的既有修复。T54 attempt 4已在此固定版本独立PASS，作者源已停写；新的真实认证组合另在T53 attempt 4分支。 |
| T54 独立报告 | 最新 `2681392a93e79480dd76521a4c4675ad908f4666:docs/acceptance/evidence/T54/v1/d05-recheck.md`；受测bad090f，22项限定PASS，D05关闭，test-principal。沿用 `75e78448d02c048bc86378d0d135f73acf706819:docs/acceptance/evidence/T54/v1/scroll-recheck.md` 的D04及 `ae0f34c` 的D01-D03关闭结论，原失败现场保留。完整T54仍需真实作品、认证组合和目标设备。 |
| T53 真实认证组合 / T54受测版本 | 产品 `f811a2778df3e47160377035ac1c3c8eacc09d8f`；证据 `4a6b7731bc71c048f05f3f67015790d372e8becf:docs/acceptance/evidence/T53/v1/auth-integration.md`，后继仅证据；组合 `c1ec09081c98b5f34b8022e87a3b307701ee6e59`。固定bad090f教学与9ecabbf认证内部保持，公共装配及真实UI/HTTPS/SQLite自验通过，fake-mail。37教学E2E/211API/10A11回归PASS，运行/保留库入口在回执。T54 attempt 5从 `3a5d33b2a4fdd33650fa9f66f1a31d621201fd65` 建独立分支，仅验证本地身份组合，不引T51-MATH v2或其他活动模块；无模型调用。 |
| T54 本地真实认证独立报告 | `ab19d5d4858affda949470ec66475d5b6209ddd9:docs/acceptance/evidence/T54/v1/auth-review.md`；受测 `f811a2778df3e47160377035ac1c3c8eacc09d8f`，37项独立PASS且手动Chrome新班级/记录保存与实际进程重启通过。D01-D05身份/外壳/桌面Pad传播通过，无新缺陷；real-auth/fake-mail/自签HTTPS。本切片结束，不另审。完整T54仍需T51-MATH v2/真实作品/M44/WB-T020及外部条件，正常重启不代替备份恢复撤销。 |
| R30 / 最终冻结 | 设计 `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1`；独立 `88a89f00b78dd301ca9893a191277eb9970c4c18:docs/acceptance/evidence/R30/v1/final-review.md`，PASS，无必修。报告消费d990f43/f877b63两项闭环及最新C21 2b10b4e/4115bb6，九项契约/BDD/节点包字节未变。派发同时携带设计与最终报告，旧状态与dsh文字不再支配执行；M40接缝冻结沿用。 |
| 材料补证 | C21 制品 `cfbbc1d` + 回执 `96be500`；C22 实际制品 `f29a7afc5254fc852811c9a9e2368f46cce3e01e` + 回执 `c8c089c`；受审组合 `8d48af5`；独立报告 `16d4b013b17b1e8d8c240c0d15a8b5366102024b:docs/acceptance/evidence/R30/v1/recovery-review.md`。 |
| 材料新方案 | 内容 `cd751b68e5001999b5a5f7544254c41d804f058a`；完整交付 `68f66587d4d625ee9c8f75516eafa61913b57e40:docs/arch/capability-checks/materials-next.md`；短包 `docs/plans/tasks/materials/next.md`；独立分项冻结 `0fb32a6e31d4ea0a6673bcce15423137a9a68b0a:docs/acceptance/evidence/MATERIALS-NEXT-PLAN/v1/review.md`。 |
| M40 / C23 修正 | 冻结交接 `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md`；M40 设计 `a6a495a` + 作者 `b626a93` + 原 review `3da472e`；修正受测 `d1490531e014ef437374c2f5a23cf3073baeef56`；独立 PASS `b01bc73954cbbc13e464738e0f6f8aa6c6f12084:docs/acceptance/evidence/M40/v1/correction-review.md`。 |
| C24 探针 / 业务实验 | 探针 `e7f979bd80ab83aaab7cc2cf936250123d7742a3`；旧业务 FAIL `d826b72`；修复与 self PASS `e8fdf9a139e429c05590925647a433a9da382579:docs/acceptance/evidence/C24/v1/business-fix.md`。 |
| C25 首批 Agent 冻结 | 设计 `18293e9389e739ed8aaf67ee568503ca8e87d475`；作者 `5e1193524c9d1d91c3a35adec3df3c832313819b`；独立冻结 `741025bd0a8e09098b5877428b81c2bdd7f357d0:docs/acceptance/evidence/C25/v1/correction-review.md`，C25-D01 关闭。原独立 `e0b2c23fc1e37c357831cefacb0817c07ae3cafd` 的未变结论沿用。 |
| C26 固定实现输入 | C25 设计/冻结见上；A11 产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf` 已包含 B16 `612f0a9`；A11 作者 `4f45b40`、A12 本地独立 `aaa3d77`。C26 分支 `feat/c26-agent`，初始主干 `e365dea`，worker 负责输入组合并记录实现前完整 SHA；不读取活动业务分支替换，认证外部条件仍开放。 |
| C26 产品 / C27受测交付 | 产品 `127c7e55b006acd5a06ad460f3380963cb51bce0`；完整交付 `31ade74207bf593260f8740be80882c936c97152:docs/acceptance/evidence/C26/v1/author.md`，差异仅证据；组合基线 `5614cf99f8b7ad9ff1f6dbf0467dd30eaf922545`。164 API/19浏览器/build及内部两轴self通过；真实API/Cookie/HTTPS、fake-mail。DeepSeek5次39,150tokens、GLM5次40,833tokens，合计79,983，未完成0。作者保留库和复现命令见回执；C27从 `46694d98a0db4ddccbe14806ec5d5f9b6764e5ea` 建独立验收分支，固定运行上述候选，不写产品。 |
| C27独立结果 / C26排版修复 | 原独立 `34e668ae97e1eb0cd5744550b6b05a4c25aa9301:docs/acceptance/evidence/C27/v1/review.md`；受测31ade74/产品127c7e5。两模型新链/恢复/隔离PASS，WB-AG-003/C27-D01公式底数与上下标拆行导致FAIL。DeepSeek5次40852tokens、GLM6次47698tokens，合计11次88550，usage齐全；未受影响结论保留。失败副本 `/tmp/c27-31ade742-runtime` 和归档零模型复现入口保持只读，最新修复见下行。 |
| C26排版候选 / C27复验 | 产品 `687121ec8d9afeccb527d2738f8b1ca22791dd69`；完整 `ec5094c00d122c77d2acdb376f4ede96eafb13e0:docs/acceptance/evidence/C26/v1/math-layout-fix.md`，组合固定点 `f76e24c94f43f5a09169e7ac2b41285ea22dc4e7`。KaTeX统一0.16.47及Agent局部公式滚动，业务/认证/契约不变；作者self后独立6d48bc7已通过，原失败现场保留。 |
| C27本地阶段独立PASS | `6d48bc7f214a6b27e51b3a8cbdfa6cffc212f4d1:docs/acceptance/evidence/C27/v1/math-recheck.md`；固定ec5094c/产品687121e。D01关闭：旧/新回复三视口公式、真实横向滚轮、题库/右栏、刷新及另进程重登通过；198产品/包文件与固定对象一致，生产构建通过。无产品模型请求，独立新受控provider1次单列；结合34e668a未变通过切片允许本地C27放行，外部身份/设备/备份未代签。C27-O01为ajv8.17.1及yaml2.8.1两条moderate公告，与旧锁一致，未证明可达产品缺陷，留后续依赖维护处理。 |
| 本地阶段文档同步 | 候选 `b37d4e01beb72ab837183d3e99c4dd0c797528bd`，文档整合 `6ecc97584b154008a99a8c49e40bec6c82f2241f`，[正式回执](../acceptance/evidence/LOCAL-STAGES-DOCS/v1/integration.md)。README/ROADMAP已同步C27、A12、T54本地独立成果、M41 self、R30冻结与R31已启动，并明确main仍是旧应用。确认消费补充88a89f0；仅3份授权文档，产品树与原台账在整合时未变，无产品测试或追加审查。 |
| C21 next-1 新结果 | 制品 `9230895a802ac46dfa3ceefc660659dd8bc8abf7`；作者 `ecd1ed6d8f974fba20ac92d40d5b6b943a3b0170:docs/acceptance/evidence/C21-MATERIALS-NEXT/v1/author.md`。独立报告 `dd6b2b8c57d776798d1cfbb2c087bbf5a6a8ad76:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c21-review.md`：EX-01/03/04及真实来源/编辑/重启分项PASS沿用；该版EX-02定位失败已由新制品c7022e0和独立d990f43闭环。原在线0/3失败保留。 |
| C21 定位/在线接续 | 候选 `05a919b998e72eb2a6d1a79b32fb62113cfe4c5b:docs/arch/capability-checks/C21-continuation.md`；作者 `b8824812e8e46f2a5cce0fb170b55c91ac6dffc5`。定位零请求局部修复沿原语义，可直接实施；在线拟仅在原DeepSeek请求新增reasoning_effort=none，I可用才PS，各1次/8000/120秒，总最多2次16000completion；Provider转发与可用性待实际证明，限定独立报告 `bf96f71427d4fcd3df11ff22fa345480c94d877b:docs/acceptance/evidence/C20-C21-CONTINUATION/v1/review.md` 已PASS。在线attempt 3基线 `19390e83d54e739f829b52261aea6ad5ebaff92e`，原定位/窗口核验派发基线 `d2dcaff42665f22eff04a9e12096012a05fc285b`。 |
| C21 定位修复 | 制品 `c7022e03be1af4d6b2ca5ca1b5a12441bc8835f8`；回执 `bdc83152872e50c4ac6ba36cc63c532be74cba1e:docs/acceptance/evidence/C21-CONTINUATION/v1/author-location.md`。self PASS：六题自身响应定位、Q3编辑保存/刷新/服务重启、未知位置及必要共享回归通过；机器/人工差异保留，新增请求0。独立 `d990f43baa98d9b125a6606b1fab56e9b5c77e98:docs/acceptance/evidence/R30-C21-CONTINUATION/v1/review-location.md` 已PASS，关闭EX-02剩余缺口及REV-001；机器主要内容4/6与人工6/6保持分列。单独在线失败不变。 |
| C21 online-1实际结果 | 制品 `f75720e6c10e1ee4f8648d3e1e6e53b6a927a047`；回执 `c29d7ce5d751118e88913df924674b50e20ea911:docs/acceptance/evidence/C21-CONTINUATION/v1/author-online.md`。I请求HTTP400拒绝none，PS未调用，FAIL/self；usage缺失预留8000未知，累计17次/14份usage/92785已知completion，窗口关闭。不能判断Provider内部拒绝层级或上游消耗；未进行材料可用性与保存重开。参数调查已完成，后续online-low另见下行；本失败和消耗保持不变。 |
| C20 Provider调查 / C21 online-low | 调查 `a1999e353976a133e76cd47caba9e02e75a2e182:docs/research/c21-provider-controls.md` 及 `docs/acceptance/evidence/C20-C21-PROVIDER/v1/author.md`，self PASS、零产品请求。Provider枚举接受low，实际材料效果未证。根采纳单次I建议，attempt 4从 `a655aff6f37632ddcaced8cfb43abfaf55b4f105` 建分支，固定f75720e请求仅none改low，保留模型/消息/图像/8000上限/120秒；最多1次，不发PS、不自动重试。全部固定输入见 `.scratch/dag-dispatch/C21-MATERIALS-NEXT/4/launch.json`。 |
| C21 online-low结果 | 制品 `95de798dcef38b440934ccda41d11d9867fb2182`；回执 `a52f95c69b54ca978ae85dde024967bfedbc2d93:docs/acceptance/evidence/C21-CONTINUATION/v1/author-online-low.md`。仅一次I，固定请求唯一none改low，HTTP200/length/空正文；prompt4309、completion7994（全reasoning）、total12303。未评分或编辑保存，无PS/重试；窗口关闭。累计18次/15份usage/100779已知completion，原3份缺失不变。C20新裁决从 `2962c5e663b70eb2e5303ac8f551dd0de94466d1` 建分支，只消费固定证据，零新增产品请求。 |
| C20页级方案 / C21 attempt 5 | 方案 `a510cc0a46ea622b740e5d9e27ce8242300db055:docs/arch/capability-checks/C21-online-decision.md`；作者 `8f594a7b7d2f92190dbdf11cd515130be3efd77b`。该页级方案仅设计self，固定单页实际输出失败，执行其停止条件；不将设计PASS当实验通过。原四图/页序2、1、3、4/DeepSeek low/8000/120秒限制不变，实际只发送页2，全部剩余额度作废。 |
| C21页级实际结果 | 制品 `2b10b4ecbfef907de1d0c368c7a29eb49af803c4`；回执 `4115bb66a5522879421ae8b49cb704b524b80b2c:docs/acceptance/evidence/C21-CONTINUATION/v1/author-page-transcription.md`。FAIL/self：HTTP200、length、7998completion/7809reasoning、440字符截断正文，耗时39.801秒；Provider `gen_01M347PAWP0WDW1W7A5ZF1BRVA`。六题七项与新材料编辑未执行；真实失败保存/刷新/重启通过，仅本地恢复证据。两项内部审查缺陷已零调用修复；候选及现场保留，源工作树干净。累计19次/16份usage/108777已知completion、历史未知不变，费用未知。补充通知 `01a0c88a-5930-7eb1-bb67-5f7b7f466da5` 虽投递，R30候选8b8656a未纳入新结果；最终88a89f0已明确消费该固定事实，文字普通同步，不将原queue成功当作者曾消费。 |
| C22 next-1 独立消费 | 制品 `d2b324520064dbae663a46acb7045c84bd55a890`；作者 `a05324d7886b2603d5caaf19af3e46ce93dce973`；独立报告 `179f353755ff987cfba8678f782b242da3122bf1:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-review.md`。固定旧 DOC 规范化预览、LaTeX 结构/固定渲染、角色/分页/打印限定 PASS；完整 DOCX 编辑与 Q2 文内标记仍 FAIL，REV-002 不关闭。零模型，未重置窗口。 |
| R31 文件内容基础 | 产品 `5f696b8ce611e67d940ce149ce13946a50b65510`；回执 `c08fa62d434efffc89b471151faa73308e3ce716:docs/acceptance/evidence/R31-FOUNDATION/v1/author.md` 及同目录 integration.md；文件 HTTP/重启/迁移/文档编辑 self PASS，完整 R31 与转换未完成，正式启动保护保留。 |
| R31完整底座交付 | 产品 `6225fc07a895113a667b5a41092a7a69e2f2fefa`，完整 `2b6cbcda934057a89c0443437e03b2e30e850a8d:docs/acceptance/evidence/R31/v1/author.md` 与 integration.md；fixed point `b1d2b283ab210994fab639f6d822a86b8a23693f`。self PASS，170 API/build、真实Office/PDF/图片预览/裁图、Job恢复、空库/B16迁移、真实A11身份和公共文档浏览器通过，内部两轴各0发现；没有新增产品模型调用。API real-auth/fake-mail，自验浏览器fixture为test-principal。Job唯一绑定workbench/index.js#initialize，三个业务fixture明确失败且生产拒启，真实绑定归R34。原底座/固定输入保留，R31停止公共写入；公共继任R34，不追加独立R31审查。 |
| 材料三消费者固定派发 | R32/R33/R34均从main `d01ff0144fe98e1fdaaa61651b5c04f28d772c64` 建独立worktree；固定输入R31完整2b6cbcd/产品6225fc0、R30设计8b8656a/独立88a89f0，完整SHA与实际启动时间见各launch.json。源R31只读，保留当前根规则/台账，不借源运行库。R32只写resources、R33只写questions及各自测试/证据；共享需求经integration.md交R34，不互聊。R34独占后继共享文件，但正式最终集成仍等根提供固定R32/R33和停写回执。R33沿既定关闭的C21窗口，先原生/Adapter/恢复与其他功能，不新调用或读密钥；真在线缺口不能签完整R33 PASS，需要时交实际新入口/请求/消耗上限与相对失败路线的新证据给根。 |
| R32固定交付与R34接线归属 | 产品 `ac34ee0cca45b5ce6c11afa1259263ecf56342cf`，完整 `c074ad339ab2772446995153c7952028d30500d4:docs/acceptance/evidence/R32/v1/author.md` 与 integration.md；组合 `f1281ca30015605f5f9ae71b7a3d58283fd23fb8`。self聚合BLOCKED：资源模块、真实File/Preview/SQLite/恢复通过；API176基于未变后端，最终浏览器10项、重启新上下文与资源独立生产构建通过。身份test-principal，lessons为明确Adapter；总npm build在共享catalog缺resources映射处失败，failure_owner=R34。内部双轴原FAIL的3项已作者复现修复，未冒称重审PASS。未加依赖或改共享锁，模块已停写，临时现场因整体未达标保留。 |
| R32向R34固定交接 | 经通知 `01a0c8e7-a787-7d73-b32f-41dbf718008c` 投递当前R34线程，明确消费c074ad3/产品ac34ee0与integration.md，接真实factory/迁移/catalog/Web页面绑定transport。可推进已就绪接线，不能降catalog校验或修改资源业务内部；R33首轮已另行固定投递，质量修复仍待后继，完整最终链条件不变。首轮9269a33明确未消费，现已列入R34 attempt 2初始固定输入；是否接入及构建关闭待新回执，不派重复R32修复/审查。 |
| R33首轮固定交付 | 产品 `5c42b24332671fa31e421a41a38309a7da64414a`，完整 `c47937c2d3ba4da9f01c44f8138e6e75a1c4c7ab:docs/acceptance/evidence/R33/v1/author.md` 与 integration.md；fixed point `d7222ac5a4726d4ee833a900221bbe894f9bfd8b`。self FAIL，在线BLOCKED：19操作/校对/素材候选已实现，定向API12/浏览器6/build通过，全API176/182（6项共享迁移清单失败）；身份test-principal，Provider旧响应是显式替身。T/W各观察6/6边界但完整主要内容质量未达标，纯文字公式、复杂OMML/分段/说明归类及本地全BDD未闭环，不能以拆题数签质量。首轮内部5项已作者修复；仍未完成项由attempt 2接手。调用0、密钥0，原候选停写且现场保留。 |
| R33本地修复交付 | 完整 `cd31bf4f4d0bf5f7cd6f35cd1f912b81a16d680c:docs/acceptance/evidence/R33/v1/attempt2.md` 与 integration2.md，产品 `93d6dd3d1f60c9ffb1c446b781d5b2c84bd161d0`，组合 `9b0d09a9152d47f0039ca01bf16ff3beb938f757`。self FAIL并停写：W七项6/6，T边界6/6但实际图缺失导致联合3/6，原4/6门槛未过；本地API15/浏览器19/build通过。全API185中178通过，6项共享迁移清单失败、1项math-static-migration重启fetch failed（单独1/1通过，根因未证）；共享项交R34。test-principal，延迟Provider仅取消控制流，0模型请求/0密钥，现场保留。 |
| R33向材料收尾固定交接 | R33完整cd31bf4/产品93d6dd3的通知 `01a0c908-2da9-7702-b9f4-c0c875b9e7a2` 未被R34 attempt 2消费，已转为attempt 3初始固定输入。原两来源停写，由一个session接手R34集成及R33两处导航缺口，新增R33/v1/attempt3.md分列归属。原T/在线质量不能由整合自动转PASS，questions提取算法仍只读。 |
| R34备课/输出阶段交付 | 产品 `9767e4feeae24d6adabbe7b87ff4876b418fc80d`，完整 `9269a3326ed300fc66aab5a31bb1ac9cff7b19d5:docs/acceptance/evidence/R34/v1/author.md` 与 integration.md；组合 `401e56d0e68de54891f2f0bda18d66a4407f043b`。parallel-stage self PASS，完整R34未PASS：177API/6E2E、六输出与四开关24件、构建、内部双轴闭环通过；Linux LibreOffice可见GUI经UNO编辑保存重开/三类打印，未代签鼠标逐字操作或Windows/WPS。身份test-principal，题/资源为Adapter，R32/R33补充未消费。新增lessons_materials_001、export handler及共享错误/迁移必要适配；已停写，完整未完故现场保留。 |
| R34实际集成交付 | 完整 `f7ae8f866401520c45235af7143f4306704345c9:docs/acceptance/evidence/R34/v1/attempt2.md` 与 integration2.md；产品 `dc1afe54e2848920f459fffd12bc2c5015b9cd28`，组合 `aa7744ca1af4edf80a974e7429b7e72508db7af2`。shared-integration self PASS / 完整BLOCKED，2026-09-22T12:17:04Z结束并停写。实际消费9269a33/c074ad3/c47937c/2b6cbcd，未消费新cd31bf4。目录v2真实三模块、四handlers、六迁移断言、xmldom直接依赖、API198/浏览器3/build、24输出及12PDF全页、真实引用/替换/丢响应/重启通过；浏览器real-auth/fake-mail/自签HTTPS，HTTPtest-principal，无跨模块Adapter；模型0/密钥0。题库导航缺口交后继，不代签质量/在线/Windows/WPS。 |
| R33/R34限定收尾交付 | 完整 `6398bf2dae85d1872c929aa8ef32d5705d763687:docs/acceptance/evidence/R34/v1/attempt3.md`、integration3.md及R33/v1/attempt3.md；产品 `a0bde5546eeedf50498888da0ed9c5941fa1d76a`，组合 `ec3a44f024c5d18c13954fa9ee809ccbfb7a9a70`。2026-09-22T12:37:17Z结束停写。实际消费f7ae8f8+cd31bf4，未消费43b117c后发澄清。限定导航/返回现场/焦点及原键丢响应恢复self通过，201API/4浏览器+2焦点/build；真实W一题修改到DOCX5个OMML通过，不重评分全样本或代签设备。math原异常单次+30次+全套未复现，未改测试/未降断言，仍OPEN。完整R33 FAIL/R34 BLOCKED；0模型/0密钥，现场保留。 |
| 共享重启诊断固定交付 | 完整 `c915f5939cb9e4102bbc9d84d4b83608b72eda52:docs/acceptance/evidence/R34/v1/restart-diagnosis.md` 与restart-diagnosis/delivery.json；诊断实现 `59b18d1bf97e50d75e9d18b98d5813d857e74eec`，组合 `56845c217442acc24bcabfb8c3508424192c0a65`。原异常未复现/根因OPEN，完成一次Astra high有界接手并停写。仅产品树的math-static-migration.test.js新增可隔离端口、cause/阶段/监听/现场诊断，原错误重抛，全部断言保留，无重试、无生命周期或业务改动。真实三进程重启/持久字节通过，相关回归4/4，两轴0发现；人工ECONNREFUSED/UND_ERR_SOCKET校准不冒充自然复现。0模型/0密钥，14份现场保留；不据绿灯销观察。 |
| 共享诊断后继消费 | 后续材料/M43唯一集成者可显式纳入c915f59的诊断测试及报告，当前R35-LOCAL仍固定6398bf2，当前R33/4初始输入也不静默改变。不为单个测试增强新派集成任务，不继续同构复测。再现自然失败时收failure.json、同进程socket轨迹、完整运行命令/版本/并行负载及保留库；有对应因果red后再定向修正。未知原因和原失败不从台账注销。 |
| 材料剩余路线与依赖提案 | 固定 `da23eb680a9c8b214ad18482d4f1fbc8a5f3fded:docs/arch/materials-continuation.md`、docs/plans/tasks/materials/continuation.md及作者回执，普通文档整合 `598209b94c13e3f345638de298b0928388b3f9c6`。self PASS仅设计交付；R33原范围零调用接续可做，M43/M44本地启动例外待独立核验及根采纳。没有新网络方向实证，不重开窗口；保留完整R35→M43→M44和M44→T51/T54→F60完成门槛。 |
| 本地材料接续三项派发 | 三项均从main `598209b94c13e3f345638de298b0928388b3f9c6` 建独立worktree，固定6398bf2/da23eb6/43b117c。R33/4 Astra low于2026-09-22T12:52:33Z启动，`/home/liam_t/项目/TeacherWorkspace-r33-fragments`仅questions/自有测试；R35-LOCAL Astra medium于2026-09-22T12:52:33Z启动，`/home/liam_t/项目/TeacherWorkspace-r35-local`只读候选并产local-review.md及local/；R30-CONTINUATION-REVIEW Astra medium于2026-09-22T12:52:33Z启动，`/home/liam_t/项目/TeacherWorkspace-materials-continuation-review`只写指定review.md。三者产品请求0，不等待/通信、不消费活动分支；回执尚未生成。 |
| T原始输入限定裁决 | 原固定 `43b117c7ed6fe5aa408422351db46e23a6ea6f3e:docs/arch/capability-checks/T-native-input.md` 与C20-T-INPUT/v1/author.md，普通文档整合98dac617。self PASS，仅事实/适用性澄清，无冻结语义变化；T已有内容按作者分项6/6、图项不适用，原联合3/6及三题缺图入库阻断保留。R35仍需实际验证。通知01a0c911未被R34/3消费，不用其旧T文字否定本已固定说明；新材料设计初始包已含43b117c。0产品调用/密钥/测试，不追加审查。 |
| M41 先行依赖冻结 | 设计 `2e67961b01f4ce90ab07dad1feb823b1f595266d:docs/arch/math-foundation-dependency.md`；作者 `76151489f28cfe1ccaddd8afa28db3c613f3c6a5`；独立报告 `3783208100703efc6b00f14eaf9709ff501705a2:docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/review.md`。限定允许固定文件基础上的隔离 M41；公共依赖/身份须实际装配，完整 R31、M41→M42、R35→M43 等门禁保留。三项新派发均从 `c85d073a9582b6aab19c5db66f83ec4fdc6ad355` 建隔离分支，固定输入见各 launch.json。 |
| R31 数学公共支持 | 产品 `07aeddc3a15b332cc941a86c340147facdef1425`；证据 `26c89fb40ece370c3b4b23079543766f9a2da428:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/author.md` 及同目录 integration.md；组合基线 `1e8ec794ec4a19e05f3ca43800d3c7bedfc79d51`。真实文件/页面身份、MathJax3.2.2和本地中文资产 self PASS，内部两轴已完成；该版公共写入已停止。向M41投递 `01a0c845-06eb-7e10-8830-735a03b3fb6e` 成功但交付候选未消费；当前由attempt 2显式整合。仍fake-mail/自签HTTPS，四handler拒启保护保留。 |
| R31/M41 固定公共组合 | 产品 `7c6e7ade69a7e86cbfd8212def7a5620e8d857d6`；完整交付 `02340eb972d68221bde94976c0da5fa90648de89:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/attempt2.md` 及 integration2.md。组合基线 `4f0d6a9c9c28386297302b48c55bd6f82b4fb317`；公共写者已停写，M41已明确消费完整组合并完成后继自验，当前M42输入是5a767db。隔离目录投影不是M43正式目录v3，完整R31并未因此通过。 |
| M41 原生图形切片 | 产品 `6a54e55a36e9efec65381ad9ceaa7af0c8228f36`；证据 `953840563d4689cdbefb8ddc43f559493e14e178:docs/acceptance/evidence/M41/v1/author.md` 及 integration.md；组合基线 `df376b214113c7476e524b68a19982ade1e0e642`。旧原生切片保留，缺少公式/身份/共同build的当时结论不作为当前状态；公共支持02340eb及后继M41 c3ab0da已完成对应本机模块缺口。 |
| M41完整静态模块 / M42输入 | 产品 `c3ab0dacd1ff172d8557117f028ebdd805235d41`；完整 `5a767dbc66ed6efb5fca1bcfe0870b7561c433b5:docs/acceptance/evidence/M41/v1/attempt2.md` 及 integration2.md；实现前组合 `97d466c307a5cd18063a5b78a047980a5b78720d`。原包静态场景、5数学API/12原生浏览器/2真实身份浏览器/159公共API/build self PASS；MC09真实身份/迟到下载/重启已消费，修复sqrt定义域采样。real-auth/fake-mail/自签HTTPS；内部审查聚合完毕，停写，实际分支feat/m41-attempt2。M42从809e6f3建独立分支消费完整固定输入，不借用源运行库、不调用模型，M43/R35及目标设备门槛保持。 |
| M42动态与HTML固定交付 | 产品 `689a194cf004aff37ebb1d495ee061fe7aed2fad`，验证 `09fe1b75e857cc8abccb97b01de3b3a6c43016ad`，完整 `54cbf7ebdadc57607f2ac15369ee755b2077a00b:docs/acceptance/evidence/M42/v1/author.md` 与 integration.md；组合fixed point `eac3cc7aafcb838b2b619c190286bcb858515ffa`。self PASS，real-auth/fake-mail/自签HTTPS，M41原生回归另为test-principal；双轴发现已作者修复并回归，不冒称再次独立审查。动态参数/步骤持久恢复、原始HTML逐字节保留/编辑源/包装器分开、恶意HTML隔离、失败恢复与Linux Chromium禁网新进程冷启动通过。原产品写入已停止，fixture补充已由下列b070390闭环；M43仍待R35，目标设备和M44未签。 |
| A11同页重登归属 | 固定诊断 `911e7b85fa21ca3e4a066f9ca656d3239a787cb7:docs/acceptance/evidence/A11/v1/bootstrap-fix.md`；受测完整组合 `d967c0aa5b3ff5060aa4289b8504edfea35e32da`，产品保持M41 5a767db，认证tree与A11 9ecabbf一致。正式App已有退出后的PrepareLogin层，math-static fixture遗漏，缺容器409符合冻结契约。原路径2 RED、对照4 PASS、浏览器10/API31 PASS；未改产品，无额外code-review或独立产品通过声明。 |
| M42 fixture补充交接 | 完整 `b0703907a7339513ed34bfed5c1e6787cc65d37d:docs/acceptance/evidence/M42/v1/attempt2.md` 与 integration2.md；fixture修复 `aa8b3ac72cdaeab67ba45ecdfeb01bdc3afcc17b`；组合fixed point `041f138a216d194f06f3b7d1efee40c7054cb9bb`。固定54cbf7e与911e7b8明确消费，2项RED后真实身份7/7、最终新增5/5、动态3/3、原生1/1、认证API31/31，fixture构建通过；自验集合有重叠，不相加为独立总数。内部双轴各0发现。只改math-static/main.jsx和对应E2E及新证据；dynamic复用同一入口无需修改。real-auth/fake-mail/自签HTTPS，产品认证未改，零模型，工作区干净且停写；来源与旧报告保留，临时产物已由作者清理。 |
| M41 调度入口整合 | 文档候选 `64ef39f1ad7050593c4cb23802472a24d0549aea:docs/acceptance/evidence/M41-DOCS/v1/integration.md`；控制分支整合 `f4ea62e6f155a71dfb7f359f9c9fc382f5682113`。仅8份获准文档，根台账在整合时 blob 原样保留；提案/作者/独立报告原文及 DAG/math/materials 入口已同步，50业务节点与后续门禁不变。无产品路径、无新增产品验收或模型调用。 |
| C22 editing-1 裁决 | 设计 `d5cb05bd306f1855d78f14096fd840f72cae3ec4:docs/arch/capability-checks/C22-editing-next.md`；作者 `5fae85f4b00a413581951776dae111898f455bbf`。仅修验证工具与既有校对提示，契约/范围/依赖不变；Astra high 一次有界接手，首次 Office 起30分钟、无后续失败复测、零模型；旧窗口及消耗保留。 |
| C22 editing-1 结果 | 制品 `1ef7bf378dfad77a46d6b6f282a5db4d3a1e9fd2`；回执 `8ab93a37455400c8f54c7a331727dc428936a9fb:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt2.md`。self FAIL；第一轮三项编辑 DOCX 重开值保留，减号断言中止，第二轮/PDF/全页未做。1复现/1候选/1链尝试/0追加复测，Office含保全253.645秒，零产品请求/费用；窗口关闭，全部现场保留。 |
| C22 validation-1 裁决 | `634dec32b16068bb3e95e31087ddae94340b13be:docs/arch/capability-checks/C22-validation-next.md`；作者 `6889727ff666436e5c1bd0b964cc7576233e6720`。表示差异仅用于比较副本，统一回读/唯一替换/未改式判别；复用六稿与首轮保存件补第二轮和八组输出，路线/契约未变。1候选/1剩余链接续/0失败后复测，首次Office起30分钟、单操作无进展60秒，零产品请求/新增费用。C22 attempt 3 从 `996aa9547f885ae3c265887c2044cab813aa1e54` 派发。 |
| C22 validation-1 结果 / control-1 接续 | 制品 `3bf9fd4dd26dfdb202c8d583bb33efac044dc89d`；回执 `6ec6f861b5220a21f574ff782402f203f5f4a098:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt3.md`。self FAIL，23项离线检查及第一轮回读通过、新增两页PDF，恢复Writer正文选区失败；第二轮/全页/打印未做。新增执行18.356316秒、含保全63.698105秒；两次补证合计135.987291/317.343307秒，产品请求/费用0。control-1 从 `b7de27b34a81b9483a3f12b6c705020310cba12c` 新分支接手，固定本制品及634dec3数学验证语义。 |
| C22 control-1 新结果 | 制品 `7f965c6408a73d30524ff8e11c40484a352232c1`；回执 `a34798de7070d837019a02ab9d0f9c34b226a277:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt4.md`。本机self PASS：沿用E第一轮改值保存，补齐可编辑性及完整第二轮、八组DOCX/PDF共19+19页、角色/Q2提示/三类打印。新增662.878044秒、含旧保全累计980.221351秒，零产品调用/费用；旧坐标唯一根因未知。本机剩余条件已由独立f877b63关闭，Windows/WPS外部验证仍未交付。 |
| C22 control-1 独立消费 | `c03df4ad6d0290f9172a15e3f23dc1e6875efe0a:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-control-review.md` 的来源/保存件结构/Q2提示/角色/19页PDF通过切片沿用，旧DOC/LaTeX结论不变；GUI退出及DOCX第3页缺口已由下行新独立报告关闭，原失败报告和现场保留。 |
| C22剩余GUI独立关闭 | `f877b6395cbfbde4b2d8aa7e8d3f64496aea22cc:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-gui-review.md`；受测7f965c6不变，independent PASS，REV-002本机关闭。六次Math退出、第二轮分母/指数/中文真实编辑及保存关闭重开、再次进入公式、学生练习DOCX第3页完整Print Preview通过。来源/既有制品保持，独立生成物及原始操作证据入库；零产品调用/费用。Windows/WPS仍BLOCKED，不能代签完整R30/R35。 |

## 当前材料阻塞与外部输入

- C21定位制品c7022e0经独立d990f43通过，EX-02/REV-001关闭。最新页级方案仍因首个页length/正文不完整而FAIL，其余页未发。累计19次/16份usage/108777已知completion，历史3份usage缺失及online-1预留8000未知不变。按原C20裁决停止该固定路线，在线能力待支持新方向的证据再交C20，不另开无依据的重试或重复设计。R33/R34继续，R32已固定交接，M42待材料链；不把在线问题转签为成功或永久手工录入。

- C24 真业务累计 32 次 DeepSeek provider 请求、93,970 total tokens；本轮修复新增 7 次、36,651 tokens。PI-01/02 消耗另有原账本，不能混成全部实验总量。副本读回补验已通过，计费余额/extra credits 状态仍未知；cost=0 不证明免费。
- R30原契约8b8656a已独立冻结，材料6398bf2与诊断c915f59已停写。当前仅R33拥有questions实现写权；R35-LOCAL固定版本只读验收，M43启动边另作限定核验。诊断增强后仍无自然失败因果证据，不反复派发同构排查；旧依赖及在线/设备/完整节点门槛不变。
- C21定位/评分和C22本机编辑/输出均已有独立通过结论。C22源制品未改，原GUI失败不作为已证实内容错误；困难验收者已完成独立操作闭环。Windows/WPS仍待真实外部输入，本机LibreOffice通过不替代目标环境。
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
