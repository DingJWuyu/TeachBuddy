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
- C26必要自验已结束，两模型共10次/79,983 totalTokens，未完成调用0，费用与余额未知。C27本次独立live已按现有GOAT许可派发，两允许模型各一条新业务链，沿产品请求上限、逐次记账，不循环付费重试或重跑C24/C26旧链；其余故障使用标明的受控替身。真实费用异常或需要额外付费时停止对应调用，继续零模型工作。
- C21已执行在线窗口全部关闭。online-low仅一次I请求，HTTP200/length/空正文，7994completion均为reasoning；无PS或重试。累计18次/15份usage/100779已知completion，历史3份usage缺失及online-1预留8000未知保持。C20-C21-ONLINE-DECISION已派零调用方案裁决，不自动增加新窗口或影响已关闭REV-001。
- 开发模型按[唯一映射](execution-protocol.md#模型与固定派发)执行；停用 dsh 与自动降级。内部 skill 助手继承调用 session。R30 原会话恢复及明确 `model at capacity` 后恢复原会话已有用户许可，session ID 不变；保持模型与 effort，不增加自动降级。
- 可独立的已授权任务并行使用 worktree；共享文件在各候选内由一个写者集成。派发 prompt 最小必要，失败归原拥有者，不以增加审查或换模型代替诊断。

## 当前派发记录

以下是最近一次已确认启动的记录，不是实时轮询结果。回执目录均相对 `/home/liam_t/项目/TeacherWorkspace-mvp`；每个目录含 `task.md`、`launch.json`、事件日志和完成后生成的回执。

| 任务 | 接续方式 | 实际模型 / effort | 状态 | session | 原始派发与回执目录 |
| --- | --- | --- | --- | --- | --- |
| C24-BUSINESS | 原 session 接续，attempt 2 / resume 1 | gpt-5.6-sol / medium | 已完成，self FAIL，制品 d826b72 | `01a0c7a8-94e5-7da1-bfe0-aa537396c067` | `.scratch/dag-dispatch/C24-BUSINESS/2/resume-1/` |
| R30-RECOVERY-REVIEW | 恢复原会话，attempt 1 | gpt-6-astra / medium | 已完成，independent FAIL | `01a0c642-8129-7c11-84d1-f64a3fa85255` | `.scratch/dag-dispatch/R30-RECOVERY-REVIEW/1/resume-1/` |
| C23-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS（限定） | `01a0c7a8-9494-7672-9e16-cfa5034ea18d` | `.scratch/dag-dispatch/C23-MATH-REVIEW/1/` |
| T53 | 新会话，attempt 4 | gpt-6-astra / low | 已启动，教学时间与固定A11真实认证组合 | `01a0c857-87f1-7342-adf1-4dc038f9b595` | `.scratch/dag-dispatch/T53/4/` |
| A11 | 新会话，attempt 3 | gpt-6-astra / low | 已完成，self PASS | `01a0c7d9-dfcb-7562-a2fd-b36edacee619` | `.scratch/dag-dispatch/A11/3/` |
| M40-HANDOFF | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，冻结交接 PASS | `01a0c7c8-8354-7192-b525-9b10180805b0` | `.scratch/dag-dispatch/M40-HANDOFF/1/` |
| C24-BUSINESS-FIX | 新会话，attempt 1 | gpt-6-astra / low | 已完成，self PASS | `01a0c7c8-833e-7f12-9ecf-5dce76b8c2b7` | `.scratch/dag-dispatch/C24-BUSINESS-FIX/1/` |
| MATERIALS-NEXT-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，方案已独立冻结 | `01a0c7c8-8353-7113-b827-5e82f5bbf02d` | `.scratch/dag-dispatch/MATERIALS-NEXT-PLAN/1/` |
| A12-LOCAL | 新会话，attempt 2 | gpt-6-astra / medium | 已完成，本地 independent PASS / 外部 BLOCKED | `01a0c7ea-45a9-7ee0-8373-a849de8e660a` | `.scratch/dag-dispatch/A12-LOCAL/2/` |
| T54 | 新会话，attempt 4 | gpt-6-astra / medium | 已完成，限定independent PASS，D05关闭 | `01a0c846-fc57-72f3-b4de-05e3937cd084` | `.scratch/dag-dispatch/T54/4/` |
| T52-SCROLL-FIX | 新会话，attempt 2 | gpt-6-astra / low | 已完成，D05修复self PASS，交T54独立复验 | `01a0c82e-5ff8-7b20-9b4d-32b7f241b4f3` | `.scratch/dag-dispatch/T52-SCROLL-FIX/2/` |
| C25 | 新会话，attempt 1 | gpt-6-astra / high | 已完成，修订设计已独立冻结 | `01a0c7d2-7a74-7050-8c8a-e28df0188772` | `.scratch/dag-dispatch/C25/1/` |
| C25-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，CHANGES_REQUIRED / independent | `01a0c7ee-7965-75f0-bad4-e0c38c979e51` | `.scratch/dag-dispatch/C25-REVIEW/1/` |
| C25-CORRECTION | 新会话，attempt 1 | gpt-6-astra / high | 已完成，READY_FOR_REVIEW / self | `01a0c7f6-fb1f-7e90-91f0-f78ed22857f6` | `.scratch/dag-dispatch/C25-CORRECTION/1/` |
| C25-CORRECTION-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS，D01 关闭 | `01a0c80d-5c5d-7e00-a062-3b573395024b` | `.scratch/dag-dispatch/C25-CORRECTION-REVIEW/1/` |
| C26 | 新会话，attempt 1 | gpt-6-astra / low | 已完成，产品127c7e5 / self PASS，已交C27 | `01a0c819-d958-7c31-bc69-0833f485fc83` | `.scratch/dag-dispatch/C26/1/` |
| C27 | 新会话，attempt 1 | gpt-6-astra / medium | 已启动，首批Agent实际流程独立验收 | `01a0c866-5aa6-7d81-a0c7-c20b158145c1` | `.scratch/dag-dispatch/C27/1/` |
| T50-MATH-CONTRACT | 新会话，attempt 1 | gpt-6-astra / high | 已完成，设计已独立冻结 | `01a0c7d5-b6d8-7232-b045-9ef61d8c46cb` | `.scratch/dag-dispatch/T50-MATH-CONTRACT/1/` |
| T50-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS | `01a0c7ec-38af-7142-91bf-78f8c33d253b` | `.scratch/dag-dispatch/T50-MATH-REVIEW/1/` |
| T51-MATH | 新会话，attempt 1 | gpt-6-astra / low | 已完成，局部 self PASS，待真实 math 装配 | `01a0c7f5-6025-7861-96db-7a113115ff68` | `.scratch/dag-dispatch/T51-MATH/1/` |
| MATERIALS-NEXT-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，两项 independent PASS | `01a0c7d7-ed98-7031-9c26-aa9df00b7834` | `.scratch/dag-dispatch/MATERIALS-NEXT-REVIEW/1/` |
| C21-MATERIALS-NEXT 定位 | 新会话，attempt 2 / location | gpt-6-astra / low | 已完成，定位与保存恢复self PASS，零请求 | `01a0c839-0aeb-78c1-89bd-e4d147bc82c1` | `.scratch/dag-dispatch/C21-MATERIALS-NEXT/2/` |
| R30-C21-CONSUME | 新会话，attempt 2 | gpt-6-astra / medium | 已完成，independent PASS，EX-02/REV-001关闭 | `01a0c84f-3351-7282-9648-fdd69097af1a` | `.scratch/dag-dispatch/R30-C21-CONSUME/2/` |
| C22-MATERIALS-NEXT | 新会话，attempt 4 / control-1 | gpt-6-astra / high | 已完成，本机两轮编辑及输出self PASS | `01a0c836-5f80-74e0-927c-d8759b1f5db3` | `.scratch/dag-dispatch/C22-MATERIALS-NEXT/4/` |
| R30-C22-CONSUME | 新会话，attempt 3 | gpt-6-astra / high | 已启动，困难独立GUI核验接手，候选不变，仅剩编辑闭环/第3页 | `01a0c86f-74ea-7c42-be68-a1f3c476cff7` | `.scratch/dag-dispatch/R30-C22-CONSUME/3/` |
| C20-C22-EDITING-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，限定裁决 self PASS | `01a0c7f9-be0a-77e1-b9e3-5ef3087c30e9` | `.scratch/dag-dispatch/C20-C22-EDITING-PLAN/1/` |
| C20-C22-VALIDATION-DECISION | 新会话，attempt 1 | gpt-6-astra / high | 已完成，限定裁决 self PASS，无契约变化 | `01a0c815-df89-7b80-9b36-b5829906a875` | `.scratch/dag-dispatch/C20-C22-VALIDATION-DECISION/1/` |
| R31-FOUNDATION | 新会话，attempt 1 | gpt-6-astra / low | 已完成，基础切片 self PASS | `01a0c7e0-691d-75a1-9e6e-49758af3daeb` | `.scratch/dag-dispatch/R31-FOUNDATION/1/` |
| M41-DEPENDENCY-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，READY_FOR_REVIEW / self | `01a0c802-4422-7f60-8eb2-5eaeb0be0b7c` | `.scratch/dag-dispatch/M41-DEPENDENCY-PLAN/1/` |
| M41-DEPENDENCY-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，限定 independent PASS | `01a0c813-49a7-7532-89ae-652ff3ae08a3` | `.scratch/dag-dispatch/M41-DEPENDENCY-REVIEW/1/` |
| M41 | 新会话，attempt 2 | gpt-6-astra / low | 已启动，消费完整公共组合，接续公式/身份及全项自验 | `01a0c869-2ebb-70b3-8489-66df3f146880` | `.scratch/dag-dispatch/M41/2/` |
| R31-MATH-SUPPORT | 新会话，attempt 2 | gpt-6-astra / low | 已完成，公共组合self PASS，停写并交M41 | `01a0c853-90e4-7e93-b1a0-f760a898c7fb` | `.scratch/dag-dispatch/R31-MATH-SUPPORT/2/` |
| M41-DOCS | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，获准调度入口已整合 | `01a0c824-e785-7111-a426-c710a6bca16c` | `.scratch/dag-dispatch/M41-DOCS/1/` |
| C20-C21-CONTINUATION | 新会话，attempt 1 | gpt-6-astra / high | 已完成，两切片均已按各自条件派发 | `01a0c82c-237b-7c43-9303-6d7f8e61a7a8` | `.scratch/dag-dispatch/C20-C21-CONTINUATION/1/` |
| C20-C21-ONLINE-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，限定 independent PASS | `01a0c839-0f97-7e70-bc81-c6c263f427b3` | `.scratch/dag-dispatch/C20-C21-ONLINE-REVIEW/1/` |
| C21-MATERIALS-NEXT 在线 | 新会话，attempt 4 / online-low | gpt-6-astra / low | 已完成，HTTP200/length/空正文self FAIL，窗口关闭 | `01a0c85d-2178-75c0-90a7-677f99571d72` | `.scratch/dag-dispatch/C21-MATERIALS-NEXT/4/` |
| C20-C21-PROVIDER | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，调查self PASS，零新增产品请求 | `01a0c849-91a3-71e1-835f-a52eb201ba94` | `.scratch/dag-dispatch/C20-C21-PROVIDER/1/` |
| C20-C21-ONLINE-DECISION | 新会话，attempt 1 | gpt-6-astra / high | 已启动，消费连续空正文失败，零调用裁决后续路线 | `01a0c86c-4f78-72a3-a5fd-f44c6d1e8d35` | `.scratch/dag-dispatch/C20-C21-ONLINE-DECISION/1/` |

## 项目进度与当前门槛

完整 MVP 尚未交付。main 保留旧应用和新的规划/证据；本轮产品候选仍在任务分支。已通过的候选不会因 main 的文档更新漂移。

| 工作线 / DAG 节点 | 当前已成立的结论 | 尚缺条件或下一接点 |
| --- | --- | --- |
| 规划、入口与设计：P00/P01/G00、B10/B11、C20 | 规划与入口已完成；B11、C20 已独立冻结。G00 实施许可已恢复完整执行。 | 沿用现有设计与实验标准，不重新规划或重跑准备。 |
| 首条题库与备课：B12-B16 | 最新组合经 B16 independent PASS；真实保存、引用、重启恢复、隔离、失败恢复、桌面/Pad 已验证。 | 身份仍为 test-principal；不代表真实认证或完整题库范围通过。 |
| 认证：AUTH-CONTRACT、两端、A10-A12 | A12 本地 independent PASS：新候选 9ecabbf 的双页退出、恢复卡及必要退出/会话回归通过；未受影响的正常认证、隔离和持久重启结论沿用。 | 两项本地缺陷关闭，可供后续固定认证接线消费。A12 整体仍受真实邮件、目标设备/可信证书阻塞；备份恢复归可靠性阶段。 |
| 材料：C21/C22、R30-R35 | C21 EX-02补证经d990f43 independent PASS，REV-001关闭；未变EX-01/03/04沿用。C22 control-1本机self PASS，两轮编辑和八组输出已交独立验收。R31基础和数学公共支持self已交付。 | REV-002仍未关闭：独立c03df4a确认公式/角色/19页PDF通过，编辑操作与DOCX第3页证据未闭合；已派high独立接手这两项。关闭后交R30汇总冻结再放行完整R31及后续消费者。单次I的low验证仍为空正文，已交C20零调用裁决，不改变已通过的原EX结论；产品收录和Windows/WPS尚未通过。 |
| 数学：C23、M40-M44 | M40/v1 设计已完成冻结交接，候选 1a5dd01；三项实验阻断 independent 关闭，交接动作仅 self 文档自检。 | 公共组合02340eb已self PASS，共同构建与隔离映射缺口关闭，math原生业务保留。已将全部输入放入M41 attempt 2启动包，接续公式、本地字体、math身份请求/下载及完整MC09；不依赖在途queue，也不提前放行M42。M43仍待M42/R35，T51-MATH消费者af19869待真实提供方。 |
| 班级与日程：T50-T54 | D01-D05均independent关闭；bad090f经T54 attempt 4独立22项PASS，桌面/窄桌面/平板滚动、返回刷新及账户现场通过，仍test-principal。 | 已派T53 attempt 4在独立候选串联固定A11真实认证，先消除现有班级/日程/通知身份组合缺口，不等待数学。T51-MATH局部self仍待真实math与v2同批装配，M43收齐前置接入；完整T54保留M44/WB-T020与目标设备条件。 |
| Agent：C24-C27 | C24 业务实验 self PASS；C25 修订设计 18293e9 经 741025b independent PASS，工具公开投影缺口关闭，未变设计沿用。 | C26产品127c7e5及证据31ade74已self PASS，164 API/19浏览器与10次真实模型请求已记录；作者停写。C27正对固定候选独立验证新题业务链、持久恢复/隔离与界面，真实邮件/设备边界另列；self不提前放行F60。 |
| 可靠性：F60-F65 | 尚未启动。 | 等待 T54、C27、A12 的真实交付，再补全模块工具、现场、恢复和整日集成。 |
| 最终交付：D70-D75、G73/G76 | 尚未启动，未部署、未用户验收。 | 等待全范围验收、可用目标环境及具体交付动作授权。 |

## 下一步与回执处理

先核对任务、attempt/session、实际候选和证据级别。退出码 0 只说明进程结束，重复或迟到的旧回执不推进当前节点。完整执行授权覆盖依赖就绪后的派发，不需要每个节点重新请示。

| 工作 | 本轮动作 | 下游判断 |
| --- | --- | --- |
| M40 / T50 / T51 | 已接收 T51-MATH 产品 af19869 与回执 9fc6337，v2 记录、来源错误语义和反馈出口局部 self 通过；不追加相同 diff 审查。 | 真实 math 与 M43 前置到齐后由唯一装配者采用目录v3/同步端口/稳定路由；不能将升级 Web 单独接到仍只有旧 API 的候选。M44 后在新组合交 T54 验完整 WB-T020，当前滚动复验输入不变。 |
| C24 / C25 / C26 / C27 | 已接收C26产品127c7e5、完整交付31ade74及self PASS；差异仅证据，作者工作区干净，内部双轴已完成，不重复diff审查。C27独立session已从固定main启动，运行隔离的固定候选。 | 按C27实际分项结论关闭阶段或将缺陷退回C26/C25；真实邮件/设备归A12。两模型各一条新的必要业务链已授权，用量单列，不把自验或实验当独立通过；未满足其他前置不启动F60。 |
| R30 / C20 / R31 | 已接收C22 control-1制品7f965c6/回执a34798d，本机self PASS；R30-C22-CONSUME attempt 2恢复后交独立c03df4a，公式/Q2/角色/PDF已PASS，编辑退出和DOCX第3页未闭合。已派attempt 3 Astra high困难独立验收接手，候选原样不变，只补剩余实际操作证据；不先让作者重做制品或增加全量复审。C21已获d990f43 independent PASS，REV-001关闭；在线low失败交C20零调用方案裁决，不阻塞原EX结论；R31基础与数学公共支持self已交付。 | 依据本轮困难核验实际结果决定REV-002关闭或准确归属；尚无文档损坏证据，不能把核验工具故障推断成内容错误。保留已通过切片和目标环境限制。REV-001已关闭，REV-002也独立关闭后交R30汇总冻结，再放行完整R31；不等待新增在线成功，也不以self提前放行。 |
| R31 / M41 | 已接收公共产品7c6e7ad/完整交付02340eb，共同build、158 API/2公共浏览器/8原生浏览器及内部两轴self通过，公共写者已停写。已派M41 attempt 2，完整组合及冻结原包均在启动输入中。 | M41接续公式、字体、页面身份/下载和原包全项；新增实现仍只写math边界，具体公共缺口再归属处理。收到完整固定self候选且停写后才交M42；隔离映射不冒充M43正式目录v3，不绕过材料四handler或R35门槛。 |
| C21 定位 / 在线 | 已接收独立报告d990f43，EX-02剩余定位缺口及REV-001关闭；未变EX-01/03/04沿用原裁决，不再派重复核验。online-low制品95de798/回执a52f95c为self FAIL：单次I HTTP200/length/空正文，无PS，未进入材料评分或保存重开。已按归属派C20-C21-ONLINE-DECISION零调用裁决。 | 材料门槛只剩C22/REV-002独立结论与R30汇总冻结。按C20新依据判断可实施方案或真实外部条件，不盲目加预算重试、不反复重签原EX；实际在线提取和产品收录仍未通过。 |
| A11 / A12 | 已接收本地 independent PASS，关闭 A12-LOCAL-001/002，无新增缺陷，不再派重复复验。 | C26 等后续组合消费固定 9ecabbf 与 aaa3d77 报告；外部邮件和目标设备输入到达后补真实验收，不提前解除 A12 整体及 F60 门禁。 |
| T52 / T53 / T54 | 已接收独立报告2681392，D05关闭，无新增缺陷，不再派同内容滚动复验。T53 attempt 4用bad090f与A11 9ecabbf在新分支接线；原认证内部固定引入，公共写入由该候选唯一集成者负责。 | 收到固定认证组合及self后交T54做实际身份相关限定独立验收。保留D01-D05未变结论，按改动影响回归；T51-MATH、C26、R31/M41活动输入不混入本候选，真实作品/目标设备仍待各自条件。 |

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
| T53 / T52 当前真实组合 | 最新D05修复产品 `bad090f0369c3479a1eb3709217577659b605401`；self 回执 `8eb9887fe30e40db2237e23e2c28515573561295:docs/acceptance/evidence/T52/v1/scroll-fix2.md` 及 scroll-fix2/。20项定向验证及生产构建通过，内部Standards/Spec均PASS；仍test-principal。包含旧 `dd53c44` / `b8e9df7` 与原组合 `ff248141` 的既有修复。T54 attempt 4已在此固定版本独立PASS，作者源已停写；新的真实认证组合另在T53 attempt 4分支。 |
| T54 独立报告 | 最新 `2681392a93e79480dd76521a4c4675ad908f4666:docs/acceptance/evidence/T54/v1/d05-recheck.md`；受测bad090f，22项限定PASS，D05关闭，test-principal。沿用 `75e78448d02c048bc86378d0d135f73acf706819:docs/acceptance/evidence/T54/v1/scroll-recheck.md` 的D04及 `ae0f34c` 的D01-D03关闭结论，原失败现场保留。完整T54仍需真实作品、认证组合和目标设备。 |
| T53 真实认证组合输入 | 教学时间产品bad090f及独立2681392，A11产品9ecabbf/作者4f45b40/本地独立aaa3d77；完整SHA见对应索引和 `.scratch/dag-dispatch/T53/4/launch.json`。新分支 `integration/t53-auth` 从 `a74af66178d57fd5ac8d0e0deb196bf01f4b88f8` 建立；worker固定组合基线后只做认证与教学时间接线，现有T50语义保留，不先引T51-MATH v2。真实邮件/部署/设备未证；不增加产品模型请求。 |
| R30 / 限定接缝 | 原设计 `ae9a395`、review `0467f46`；恢复方案 `7789974` + review `c82cd69` 仅放行材料补验和 M40 设计接缝。 |
| 材料补证 | C21 制品 `cfbbc1d` + 回执 `96be500`；C22 实际制品 `f29a7afc5254fc852811c9a9e2368f46cce3e01e` + 回执 `c8c089c`；受审组合 `8d48af5`；独立报告 `16d4b013b17b1e8d8c240c0d15a8b5366102024b:docs/acceptance/evidence/R30/v1/recovery-review.md`。 |
| 材料新方案 | 内容 `cd751b68e5001999b5a5f7544254c41d804f058a`；完整交付 `68f66587d4d625ee9c8f75516eafa61913b57e40:docs/arch/capability-checks/materials-next.md`；短包 `docs/plans/tasks/materials/next.md`；独立分项冻结 `0fb32a6e31d4ea0a6673bcce15423137a9a68b0a:docs/acceptance/evidence/MATERIALS-NEXT-PLAN/v1/review.md`。 |
| M40 / C23 修正 | 冻结交接 `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md`；M40 设计 `a6a495a` + 作者 `b626a93` + 原 review `3da472e`；修正受测 `d1490531e014ef437374c2f5a23cf3073baeef56`；独立 PASS `b01bc73954cbbc13e464738e0f6f8aa6c6f12084:docs/acceptance/evidence/M40/v1/correction-review.md`。 |
| C24 探针 / 业务实验 | 探针 `e7f979bd80ab83aaab7cc2cf936250123d7742a3`；旧业务 FAIL `d826b72`；修复与 self PASS `e8fdf9a139e429c05590925647a433a9da382579:docs/acceptance/evidence/C24/v1/business-fix.md`。 |
| C25 首批 Agent 冻结 | 设计 `18293e9389e739ed8aaf67ee568503ca8e87d475`；作者 `5e1193524c9d1d91c3a35adec3df3c832313819b`；独立冻结 `741025bd0a8e09098b5877428b81c2bdd7f357d0:docs/acceptance/evidence/C25/v1/correction-review.md`，C25-D01 关闭。原独立 `e0b2c23fc1e37c357831cefacb0817c07ae3cafd` 的未变结论沿用。 |
| C26 固定实现输入 | C25 设计/冻结见上；A11 产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf` 已包含 B16 `612f0a9`；A11 作者 `4f45b40`、A12 本地独立 `aaa3d77`。C26 分支 `feat/c26-agent`，初始主干 `e365dea`，worker 负责输入组合并记录实现前完整 SHA；不读取活动业务分支替换，认证外部条件仍开放。 |
| C26 产品 / C27受测交付 | 产品 `127c7e55b006acd5a06ad460f3380963cb51bce0`；完整交付 `31ade74207bf593260f8740be80882c936c97152:docs/acceptance/evidence/C26/v1/author.md`，差异仅证据；组合基线 `5614cf99f8b7ad9ff1f6dbf0467dd30eaf922545`。164 API/19浏览器/build及内部两轴self通过；真实API/Cookie/HTTPS、fake-mail。DeepSeek5次39,150tokens、GLM5次40,833tokens，合计79,983，未完成0。作者保留库和复现命令见回执；C27从 `46694d98a0db4ddccbe14806ec5d5f9b6764e5ea` 建独立验收分支，固定运行上述候选，不写产品。 |
| C21 next-1 新结果 | 制品 `9230895a802ac46dfa3ceefc660659dd8bc8abf7`；作者 `ecd1ed6d8f974fba20ac92d40d5b6b943a3b0170:docs/acceptance/evidence/C21-MATERIALS-NEXT/v1/author.md`。独立报告 `dd6b2b8c57d776798d1cfbb2c087bbf5a6a8ad76:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c21-review.md`：EX-01/03/04及真实来源/编辑/重启分项PASS沿用；该版EX-02定位失败已由新制品c7022e0和独立d990f43闭环。原在线0/3失败保留。 |
| C21 定位/在线接续 | 候选 `05a919b998e72eb2a6d1a79b32fb62113cfe4c5b:docs/arch/capability-checks/C21-continuation.md`；作者 `b8824812e8e46f2a5cce0fb170b55c91ac6dffc5`。定位零请求局部修复沿原语义，可直接实施；在线拟仅在原DeepSeek请求新增reasoning_effort=none，I可用才PS，各1次/8000/120秒，总最多2次16000completion；Provider转发与可用性待实际证明，限定独立报告 `bf96f71427d4fcd3df11ff22fa345480c94d877b:docs/acceptance/evidence/C20-C21-CONTINUATION/v1/review.md` 已PASS。在线attempt 3基线 `19390e83d54e739f829b52261aea6ad5ebaff92e`，原定位/窗口核验派发基线 `d2dcaff42665f22eff04a9e12096012a05fc285b`。 |
| C21 定位修复 | 制品 `c7022e03be1af4d6b2ca5ca1b5a12441bc8835f8`；回执 `bdc83152872e50c4ac6ba36cc63c532be74cba1e:docs/acceptance/evidence/C21-CONTINUATION/v1/author-location.md`。self PASS：六题自身响应定位、Q3编辑保存/刷新/服务重启、未知位置及必要共享回归通过；机器/人工差异保留，新增请求0。独立 `d990f43baa98d9b125a6606b1fab56e9b5c77e98:docs/acceptance/evidence/R30-C21-CONTINUATION/v1/review-location.md` 已PASS，关闭EX-02剩余缺口及REV-001；机器主要内容4/6与人工6/6保持分列。单独在线失败不变。 |
| C21 online-1实际结果 | 制品 `f75720e6c10e1ee4f8648d3e1e6e53b6a927a047`；回执 `c29d7ce5d751118e88913df924674b50e20ea911:docs/acceptance/evidence/C21-CONTINUATION/v1/author-online.md`。I请求HTTP400拒绝none，PS未调用，FAIL/self；usage缺失预留8000未知，累计17次/14份usage/92785已知completion，窗口关闭。不能判断Provider内部拒绝层级或上游消耗；未进行材料可用性与保存重开。参数调查已完成，后续online-low另见下行；本失败和消耗保持不变。 |
| C20 Provider调查 / C21 online-low | 调查 `a1999e353976a133e76cd47caba9e02e75a2e182:docs/research/c21-provider-controls.md` 及 `docs/acceptance/evidence/C20-C21-PROVIDER/v1/author.md`，self PASS、零产品请求。Provider枚举接受low，实际材料效果未证。根采纳单次I建议，attempt 4从 `a655aff6f37632ddcaced8cfb43abfaf55b4f105` 建分支，固定f75720e请求仅none改low，保留模型/消息/图像/8000上限/120秒；最多1次，不发PS、不自动重试。全部固定输入见 `.scratch/dag-dispatch/C21-MATERIALS-NEXT/4/launch.json`。 |
| C21 online-low结果 | 制品 `95de798dcef38b440934ccda41d11d9867fb2182`；回执 `a52f95c69b54ca978ae85dde024967bfedbc2d93:docs/acceptance/evidence/C21-CONTINUATION/v1/author-online-low.md`。仅一次I，固定请求唯一none改low，HTTP200/length/空正文；prompt4309、completion7994（全reasoning）、total12303。未评分或编辑保存，无PS/重试；窗口关闭。累计18次/15份usage/100779已知completion，原3份缺失不变。C20新裁决从 `2962c5e663b70eb2e5303ac8f551dd0de94466d1` 建分支，只消费固定证据，零新增产品请求。 |
| C22 next-1 独立消费 | 制品 `d2b324520064dbae663a46acb7045c84bd55a890`；作者 `a05324d7886b2603d5caaf19af3e46ce93dce973`；独立报告 `179f353755ff987cfba8678f782b242da3122bf1:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-review.md`。固定旧 DOC 规范化预览、LaTeX 结构/固定渲染、角色/分页/打印限定 PASS；完整 DOCX 编辑与 Q2 文内标记仍 FAIL，REV-002 不关闭。零模型，未重置窗口。 |
| R31 文件内容基础 | 产品 `5f696b8ce611e67d940ce149ce13946a50b65510`；回执 `c08fa62d434efffc89b471151faa73308e3ce716:docs/acceptance/evidence/R31-FOUNDATION/v1/author.md` 及同目录 integration.md；文件 HTTP/重启/迁移/文档编辑 self PASS，完整 R31 与转换未完成，正式启动保护保留。 |
| M41 先行依赖冻结 | 设计 `2e67961b01f4ce90ab07dad1feb823b1f595266d:docs/arch/math-foundation-dependency.md`；作者 `76151489f28cfe1ccaddd8afa28db3c613f3c6a5`；独立报告 `3783208100703efc6b00f14eaf9709ff501705a2:docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/review.md`。限定允许固定文件基础上的隔离 M41；公共依赖/身份须实际装配，完整 R31、M41→M42、R35→M43 等门禁保留。三项新派发均从 `c85d073a9582b6aab19c5db66f83ec4fdc6ad355` 建隔离分支，固定输入见各 launch.json。 |
| R31 数学公共支持 | 产品 `07aeddc3a15b332cc941a86c340147facdef1425`；证据 `26c89fb40ece370c3b4b23079543766f9a2da428:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/author.md` 及同目录 integration.md；组合基线 `1e8ec794ec4a19e05f3ca43800d3c7bedfc79d51`。真实文件/页面身份、MathJax3.2.2和本地中文资产 self PASS，内部两轴已完成；该版公共写入已停止。向M41投递 `01a0c845-06eb-7e10-8830-735a03b3fb6e` 成功但交付候选未消费；当前由attempt 2显式整合。仍fake-mail/自签HTTPS，四handler拒启保护保留。 |
| R31/M41 固定公共组合 | 产品 `7c6e7ade69a7e86cbfd8212def7a5620e8d857d6`；完整交付 `02340eb972d68221bde94976c0da5fa90648de89:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/attempt2.md` 及 integration2.md，后继仅证据。组合基线 `4f0d6a9c9c28386297302b48c55bd6f82b4fb317`；math三目录/旧证据/冻结输入保留，独立静态映射与共同build已self通过。公共写者停写；M41 attempt 2从 `309d62674e4ef26582932ad7578ab307a4d9423a` 建新分支消费完整组合，原M41包从固定1a5dd01读取，不另等在途输入。公式/身份/完整MC09尚待M41。 |
| M41 原生图形切片 | 产品 `6a54e55a36e9efec65381ad9ceaa7af0c8228f36`；证据 `953840563d4689cdbefb8ddc43f559493e14e178:docs/acceptance/evidence/M41/v1/author.md` 及 integration.md；实际组合基线 `df376b214113c7476e524b68a19982ade1e0e642`。89 API/8浏览器及原生输出、保存/历史/恢复self通过；公式未完成、页面身份未接、共同build缺math映射，整体BLOCKED。此次固定成果原样交公共支持attempt 2，后续M41新接续仍需完整原包，当前不放行M42。 |
| M41 调度入口整合 | 文档候选 `64ef39f1ad7050593c4cb23802472a24d0549aea:docs/acceptance/evidence/M41-DOCS/v1/integration.md`；控制分支整合 `f4ea62e6f155a71dfb7f359f9c9fc382f5682113`。仅8份获准文档，根台账在整合时 blob 原样保留；提案/作者/独立报告原文及 DAG/math/materials 入口已同步，50业务节点与后续门禁不变。无产品路径、无新增产品验收或模型调用。 |
| C22 editing-1 裁决 | 设计 `d5cb05bd306f1855d78f14096fd840f72cae3ec4:docs/arch/capability-checks/C22-editing-next.md`；作者 `5fae85f4b00a413581951776dae111898f455bbf`。仅修验证工具与既有校对提示，契约/范围/依赖不变；Astra high 一次有界接手，首次 Office 起30分钟、无后续失败复测、零模型；旧窗口及消耗保留。 |
| C22 editing-1 结果 | 制品 `1ef7bf378dfad77a46d6b6f282a5db4d3a1e9fd2`；回执 `8ab93a37455400c8f54c7a331727dc428936a9fb:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt2.md`。self FAIL；第一轮三项编辑 DOCX 重开值保留，减号断言中止，第二轮/PDF/全页未做。1复现/1候选/1链尝试/0追加复测，Office含保全253.645秒，零产品请求/费用；窗口关闭，全部现场保留。 |
| C22 validation-1 裁决 | `634dec32b16068bb3e95e31087ddae94340b13be:docs/arch/capability-checks/C22-validation-next.md`；作者 `6889727ff666436e5c1bd0b964cc7576233e6720`。表示差异仅用于比较副本，统一回读/唯一替换/未改式判别；复用六稿与首轮保存件补第二轮和八组输出，路线/契约未变。1候选/1剩余链接续/0失败后复测，首次Office起30分钟、单操作无进展60秒，零产品请求/新增费用。C22 attempt 3 从 `996aa9547f885ae3c265887c2044cab813aa1e54` 派发。 |
| C22 validation-1 结果 / control-1 接续 | 制品 `3bf9fd4dd26dfdb202c8d583bb33efac044dc89d`；回执 `6ec6f861b5220a21f574ff782402f203f5f4a098:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt3.md`。self FAIL，23项离线检查及第一轮回读通过、新增两页PDF，恢复Writer正文选区失败；第二轮/全页/打印未做。新增执行18.356316秒、含保全63.698105秒；两次补证合计135.987291/317.343307秒，产品请求/费用0。control-1 从 `b7de27b34a81b9483a3f12b6c705020310cba12c` 新分支接手，固定本制品及634dec3数学验证语义。 |
| C22 control-1 新结果 | 制品 `7f965c6408a73d30524ff8e11c40484a352232c1`；回执 `a34798de7070d837019a02ab9d0f9c34b226a277:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt4.md`。本机self PASS：沿用E第一轮改值保存，补齐可编辑性及完整第二轮、八组DOCX/PDF共19+19页、角色/Q2提示/三类打印。新增662.878044秒、含旧保全累计980.221351秒，零产品调用/费用；旧坐标唯一根因未知。独立attempt 2已交c03df4a，结果及剩余缺口见下行；外部兼容与REV-002未通过。 |
| C22 control-1 独立消费 | `c03df4ad6d0290f9172a15e3f23dc1e6875efe0a:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-control-review.md`；受测7f965c6，independent FAIL，REV-002未关闭。来源/保存件结构/Q2提示/角色/独立PDF19页PASS，未变旧DOC/LaTeX沿用；独立编辑在Math退出中止，学生练习DOCX第3页图不完整，非已证实内容损坏。原现场保留。attempt 3从 `72d3b0b6d96c2004da32aa5c368162b64cbd94e5` 建独立分支，仅接手GUI剩余核验，零产品调用。 |

## 当前材料阻塞与外部输入

- C21定位制品c7022e0经独立d990f43通过，EX-02/REV-001关闭，机器/人工差异及原EX-01/03/04结论保留。在线仍未通过：none遭HTTP400，low虽HTTP200却length/空正文。最新单次完成后累计18次/15份usage/100779已知completion，历史3份usage缺失、online-1预留8000未知均保留。C20-C21-ONLINE-DECISION正零调用裁决后续可判别方案；不重置旧窗口，不妨碍其他已就绪flow。

- C24 真业务累计 32 次 DeepSeek provider 请求、93,970 total tokens；本轮修复新增 7 次、36,651 tokens。PI-01/02 消耗另有原账本，不能混成全部实验总量。副本读回补验已通过，计费余额/extra credits 状态仍未知；cost=0 不证明免费。
- R30整体仍待汇总冻结。REV-001已由独立d990f43关闭；REV-002经c03df4a独立核验仍FAIL，公式/来源/Q2/角色/19页PDF通过，剩独立GUI编辑闭环及DOCX第3页。已派Astra high attempt 3独立接手，源候选不变，不先重跑作者实验。旧DOC与LaTeX未变结论沿用，完整R31/R32-R35仍需R30整体冻结。
- C21定位/评分修正已获R30限定独立PASS，REV-001关闭；C22 control-1已在662.878秒内完成本机编辑和输出，新增产品请求/费用0，含旧保全累计980.221秒。旧坐标失败本次未稳定复现，不能宣称唯一根因查明；新输出内容已有独立通过切片，但独立编辑控制未通过；本次由困难独立验收者补剩余真实操作。Windows/WPS仍待输入，各REV须按固定证据独立关闭。
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
