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
- C26既有自验10次/79,983 totalTokens与C27独立新链11次/88,550 totalTokens分别记账，两批usage齐全；费用与余额未知，窗口均结束。C26 attempt 2以零产品调用完成排版修复self PASS，C27 attempt 2仅零模型限定独立复验，不因局部修复重开付费链。
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
| C27 | 新会话，attempt 2 | gpt-6-astra / medium | 已启动，C27-D01及受影响阅读/恢复限定独立复验，零模型 | `01a0c890-dff2-7142-960e-a988830e9950` | `.scratch/dag-dispatch/C27/2/` |
| T50-MATH-CONTRACT | 新会话，attempt 1 | gpt-6-astra / high | 已完成，设计已独立冻结 | `01a0c7d5-b6d8-7232-b045-9ef61d8c46cb` | `.scratch/dag-dispatch/T50-MATH-CONTRACT/1/` |
| T50-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS | `01a0c7ec-38af-7142-91bf-78f8c33d253b` | `.scratch/dag-dispatch/T50-MATH-REVIEW/1/` |
| T51-MATH | 新会话，attempt 1 | gpt-6-astra / low | 已完成，局部 self PASS，待真实 math 装配 | `01a0c7f5-6025-7861-96db-7a113115ff68` | `.scratch/dag-dispatch/T51-MATH/1/` |
| MATERIALS-NEXT-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，两项 independent PASS | `01a0c7d7-ed98-7031-9c26-aa9df00b7834` | `.scratch/dag-dispatch/MATERIALS-NEXT-REVIEW/1/` |
| C21-MATERIALS-NEXT 定位 | 新会话，attempt 2 / location | gpt-6-astra / low | 已完成，定位与保存恢复self PASS，零请求 | `01a0c839-0aeb-78c1-89bd-e4d147bc82c1` | `.scratch/dag-dispatch/C21-MATERIALS-NEXT/2/` |
| R30-C21-CONSUME | 新会话，attempt 2 | gpt-6-astra / medium | 已完成，independent PASS，EX-02/REV-001关闭 | `01a0c84f-3351-7282-9648-fdd69097af1a` | `.scratch/dag-dispatch/R30-C21-CONSUME/2/` |
| C22-MATERIALS-NEXT | 新会话，attempt 4 / control-1 | gpt-6-astra / high | 已完成，本机两轮编辑及输出self PASS | `01a0c836-5f80-74e0-927c-d8759b1f5db3` | `.scratch/dag-dispatch/C22-MATERIALS-NEXT/4/` |
| R30-C22-CONSUME | 新会话，attempt 3 | gpt-6-astra / high | 已完成，independent PASS，REV-002本机缺口关闭 | `01a0c86f-74ea-7c42-be68-a1f3c476cff7` | `.scratch/dag-dispatch/R30-C22-CONSUME/3/` |
| R30-FREEZE-PREP | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，固定文档候选8b8656a，self；在线状态文字仍待同步 | `01a0c887-b0f4-7b30-a6fd-6517622e0944` | `.scratch/dag-dispatch/R30-FREEZE-PREP/1/` |
| R30-FINAL-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已启动，两项闭环/当前候选/准确交接限定冻结 | `01a0c896-ba1c-70d3-8ad9-c27bf6aff3de` | `.scratch/dag-dispatch/R30-FINAL-REVIEW/1/` |
| C20-C22-EDITING-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，限定裁决 self PASS | `01a0c7f9-be0a-77e1-b9e3-5ef3087c30e9` | `.scratch/dag-dispatch/C20-C22-EDITING-PLAN/1/` |
| C20-C22-VALIDATION-DECISION | 新会话，attempt 1 | gpt-6-astra / high | 已完成，限定裁决 self PASS，无契约变化 | `01a0c815-df89-7b80-9b36-b5829906a875` | `.scratch/dag-dispatch/C20-C22-VALIDATION-DECISION/1/` |
| R31-FOUNDATION | 新会话，attempt 1 | gpt-6-astra / low | 已完成，基础切片 self PASS | `01a0c7e0-691d-75a1-9e6e-49758af3daeb` | `.scratch/dag-dispatch/R31-FOUNDATION/1/` |
| M41-DEPENDENCY-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，READY_FOR_REVIEW / self | `01a0c802-4422-7f60-8eb2-5eaeb0be0b7c` | `.scratch/dag-dispatch/M41-DEPENDENCY-PLAN/1/` |
| M41-DEPENDENCY-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，限定 independent PASS | `01a0c813-49a7-7532-89ae-652ff3ae08a3` | `.scratch/dag-dispatch/M41-DEPENDENCY-REVIEW/1/` |
| M41 | 新会话，attempt 2 | gpt-6-astra / low | 已完成，静态数学原包全项self PASS，已停写交M42 | `01a0c869-2ebb-70b3-8489-66df3f146880` | `.scratch/dag-dispatch/M41/2/` |
| M42 | 新会话，attempt 1 | gpt-6-astra / low | 已启动，动态作品与外部HTML，math唯一写者 | `01a0c88d-ed07-78a2-be18-91377d3a9280` | `.scratch/dag-dispatch/M42/1/` |
| A11-BOOTSTRAP-FIX | 新会话，attempt 1 | gpt-6-astra / low | 已启动，复现最后会话退出后同页重登409，按契约归属修复 | `01a0c88d-f150-7963-b139-ca57f1699eaf` | `.scratch/dag-dispatch/A11-BOOTSTRAP-FIX/1/` |
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
| 认证：AUTH-CONTRACT、两端、A10-A12 | 固定9ecabbf经A12本地independent PASS，既有正常认证/隔离/持久及双页退出等结论沿用。 | M41新组合报告最后会话退出后同页重登409、刷新恢复，已派A11-BOOTSTRAP-FIX先复现并核对冻结行为，未定为新的独立FAIL。真实邮件/目标设备/可信证书和备份恢复等原边界保留。 |
| 材料：C21/C22、R30-R35 | C21经d990f43独立关闭REV-001；C22经f877b63独立关闭REV-002本机缺口。R30文档候选8b8656a保留已审契约/schema/BDD，已进入最终限定冻结。R31基础和数学支持self保留。 | R30-FINAL-REVIEW核验实际闭环和下游条件；已单列候选中“新在线尚无回执”的过期文字，并交固定C21失败结果，不新加门槛。独立冻结后推进完整R31。在线采集仍未交付，Windows/WPS未验证。 |
| 数学：C23、M40-M44 | M40冻结1a5dd01与三项独立实验关闭保持；M41产品c3ab0da/完整5a767db完成公式、静态图、本地字体、真实身份和MC09全项self，已停止math写入。 | 已派M42顺序接手动态/HTML与隔离离线能力，回归M41；不追加同内容diff审查。A11同页重登问题另树处理，数学继续固定输入。完整材料/正式目录组合仍未交付，M43仍需M42与R35，M44仍为独立产品验收。 |
| 班级与日程：T50-T54 | D01-D05均independent关闭；bad090f经T54 attempt 4独立22项PASS，桌面/窄桌面/平板滚动、返回刷新及账户现场通过，仍test-principal。 | T53真实认证产品f811a27经T54报告ab19d5d本地independent PASS：37项及独立Chrome手动保存/进程重启通过，身份、隔离、迟到响应和D01-D05传播无新缺陷。T51-MATH局部self仍待真实math与v2同批装配，M43收齐前置接入；完整T54保留M44/WB-T020与目标设备条件。 |
| Agent：C24-C27 | C24业务实验self PASS；C25设计独立冻结。C27首次两模型新业务链/持久/隔离通过，唯一D01公式排版阻断；C26修复687121e/完整ec5094c已self PASS，产品只改KaTeX依赖/锁和Agent样式。 | 已派C27 attempt 2 Astra medium从新固定候选独立复验原/新回复、三视口及受影响题库/恢复；保持两批live用量，零新产品请求。D01尚未独立关闭，不提前放行C27/F60；A12外部条件保留。 |
| 可靠性：F60-F65 | 尚未启动。 | 等待 T54、C27、A12 的真实交付，再补全模块工具、现场、恢复和整日集成。 |
| 最终交付：D70-D75、G73/G76 | 尚未启动，未部署、未用户验收。 | 等待全范围验收、可用目标环境及具体交付动作授权。 |

## 下一步与回执处理

先核对任务、attempt/session、实际候选和证据级别。退出码 0 只说明进程结束，重复或迟到的旧回执不推进当前节点。完整执行授权覆盖依赖就绪后的派发，不需要每个节点重新请示。

| 工作 | 本轮动作 | 下游判断 |
| --- | --- | --- |
| M40 / T50 / T51 | 已接收 T51-MATH 产品 af19869 与回执 9fc6337，v2 记录、来源错误语义和反馈出口局部 self 通过；不追加相同 diff 审查。 | 真实 math 与 M43 前置到齐后由唯一装配者采用目录v3/同步端口/稳定路由；不能将升级 Web 单独接到仍只有旧 API 的候选。M44 后在新组合交 T54 验完整 WB-T020，当前滚动复验输入不变。 |
| C24 / C25 / C26 / C27 | 已接收C26修复完整ec5094c/产品687121e self PASS，KaTeX生成器/样式统一并限制长公式局部滚动；原持久/新回复三视口、题库与恢复自验通过，内部两轴0发现。已派C27 attempt 2只核验D01关闭及受影响行为，产品只读。 | 新独立结论决定本地C27是否通过；沿用未变live/持久/隔离结论，零模型，不重复内部diff审查。失败按实际归属回C26，PASS后同步阶段当前状态；完整F60仍需T54和A12各自门槛。 |
| R30 / C20 / R31 | C21/C22两本机REV独立关闭，文档候选8b8656a已交付。已派Astra medium R30-FINAL-REVIEW，仅消费既有独立证据、已审字节和实际交接；不重跑已通过设计/实验。最新C21页级FAIL与累计账作为固定补充，文档仍称未回执的差异明确交审。 | 根据限定独立结果关闭最终冻结或回实际拥有者。普通状态文字同步与契约缺陷分开处理；不追加在线成功或完整R31独立审查等原DAG之外条件。冻结后R31接续完整职责，R31自验固定并交接后并行R32/R33/R34，最终R35独立验收。 |
| R31 / M41 / M42 | 公共02340eb与M41后继5a767db已固定；M41完成公式、字体、页面身份/下载、历史与故障、完整MC09和所有原静态场景self，作者停写。M42已接唯一math写权，完整候选/原M42包/固定C23产物在派发输入中。 | M42实现动态编辑、HTML源码保留/修改、隔离恶意样本与真实下载冷启动，并回归M41。完整R31及正式目录/四handler仍归材料组合，不从隔离模块self推定通过；M43保留M42/R35前置，公共问题交唯一写者，不改活动认证候选。 |
| C21 定位 / 在线 | REV-001保持独立d990f43关闭。attempt 5制品2b10b4e/回执4115bb6为self FAIL：页2单次HTTP200/length，正文440字符、Q3不完整且无Q4；余页未发，六题七项评分未执行，不记0/6。失败原件与片段保存、刷新和服务重启回读通过；两项本地Adapter问题已零调用修复。 | 按a510cc0的既定失败分支关闭页级窗口，技术FAIL归C20；先取得支持不同技术方向的新证据，再由C20裁决，不自动继续参数/额度试验或新增形式审查。可解除证据包括该精确Provider/模型实际生效的推理控制，或同路径相近负载的正常响应及完整请求/usage。R33本地实施按R30/R31继续准备，真实在线仍须其自身产品验收。 |
| A11 / A12 | 既有独立aaa3d77关闭A12-LOCAL-001/002，未变结论保留。M41发现另一个边界：退出最后会话后同页重新登录/注册409，刷新可恢复。已派独立工作树A11-BOOTSTRAP-FIX，先真实E2E和冻结契约核对，再按真实根因修复或说明非缺陷/装配归属。 | 修复若成立，接完整新候选及red/green后仅做受影响独立复验与后续固定组合，不重做整个认证diff审查。若需公共或契约改动回归属决策；真实邮件及目标设备外部验收不变。M42与该任务边界隔离，未收到固定新输入不猜测接线。 |
| T52 / T53 / T54 | 已接收独立报告ab19d5d，本地身份组合PASS，无新缺陷；D01-D05传播和真实保存/退出重登/隔离/保留库重启通过。无需修复回流或重复核验。 | 后续业务汇合消费教学产品f811a27、作者4a6b773和独立ab19d5d。T51-MATH v2、M43真实接线/M44/WB-T020及外部设备仍未完成；完整T54与F60门槛保留，当前M41/C27/材料flow继续各自工作。 |

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
| R30 / 限定接缝 | 原设计 `ae9a3954c7488743f3812499ece76e6ac900c7a0`、review `0467f468c3e923a83548d447c3a760a47b2f88bd`；两项本机REV由d990f43/f877b63关闭。整合候选 `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1:docs/acceptance/evidence/R30/v1/freeze-prep.md`，仅self。已派R30-FINAL-REVIEW从0fb84ba建review/r30-final-freeze，受审8b8656a及固定补充C21 2b10b4e/4115bb6；未签最终independent PASS。M40限定接缝冻结继续有效。 |
| 材料补证 | C21 制品 `cfbbc1d` + 回执 `96be500`；C22 实际制品 `f29a7afc5254fc852811c9a9e2368f46cce3e01e` + 回执 `c8c089c`；受审组合 `8d48af5`；独立报告 `16d4b013b17b1e8d8c240c0d15a8b5366102024b:docs/acceptance/evidence/R30/v1/recovery-review.md`。 |
| 材料新方案 | 内容 `cd751b68e5001999b5a5f7544254c41d804f058a`；完整交付 `68f66587d4d625ee9c8f75516eafa61913b57e40:docs/arch/capability-checks/materials-next.md`；短包 `docs/plans/tasks/materials/next.md`；独立分项冻结 `0fb32a6e31d4ea0a6673bcce15423137a9a68b0a:docs/acceptance/evidence/MATERIALS-NEXT-PLAN/v1/review.md`。 |
| M40 / C23 修正 | 冻结交接 `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md`；M40 设计 `a6a495a` + 作者 `b626a93` + 原 review `3da472e`；修正受测 `d1490531e014ef437374c2f5a23cf3073baeef56`；独立 PASS `b01bc73954cbbc13e464738e0f6f8aa6c6f12084:docs/acceptance/evidence/M40/v1/correction-review.md`。 |
| C24 探针 / 业务实验 | 探针 `e7f979bd80ab83aaab7cc2cf936250123d7742a3`；旧业务 FAIL `d826b72`；修复与 self PASS `e8fdf9a139e429c05590925647a433a9da382579:docs/acceptance/evidence/C24/v1/business-fix.md`。 |
| C25 首批 Agent 冻结 | 设计 `18293e9389e739ed8aaf67ee568503ca8e87d475`；作者 `5e1193524c9d1d91c3a35adec3df3c832313819b`；独立冻结 `741025bd0a8e09098b5877428b81c2bdd7f357d0:docs/acceptance/evidence/C25/v1/correction-review.md`，C25-D01 关闭。原独立 `e0b2c23fc1e37c357831cefacb0817c07ae3cafd` 的未变结论沿用。 |
| C26 固定实现输入 | C25 设计/冻结见上；A11 产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf` 已包含 B16 `612f0a9`；A11 作者 `4f45b40`、A12 本地独立 `aaa3d77`。C26 分支 `feat/c26-agent`，初始主干 `e365dea`，worker 负责输入组合并记录实现前完整 SHA；不读取活动业务分支替换，认证外部条件仍开放。 |
| C26 产品 / C27受测交付 | 产品 `127c7e55b006acd5a06ad460f3380963cb51bce0`；完整交付 `31ade74207bf593260f8740be80882c936c97152:docs/acceptance/evidence/C26/v1/author.md`，差异仅证据；组合基线 `5614cf99f8b7ad9ff1f6dbf0467dd30eaf922545`。164 API/19浏览器/build及内部两轴self通过；真实API/Cookie/HTTPS、fake-mail。DeepSeek5次39,150tokens、GLM5次40,833tokens，合计79,983，未完成0。作者保留库和复现命令见回执；C27从 `46694d98a0db4ddccbe14806ec5d5f9b6764e5ea` 建独立验收分支，固定运行上述候选，不写产品。 |
| C27独立结果 / C26排版修复 | 原独立 `34e668ae97e1eb0cd5744550b6b05a4c25aa9301:docs/acceptance/evidence/C27/v1/review.md`；受测31ade74/产品127c7e5。两模型新链/恢复/隔离PASS，WB-AG-003/C27-D01公式底数与上下标拆行导致FAIL。DeepSeek5次40852tokens、GLM6次47698tokens，合计11次88550，usage齐全；未受影响结论保留。失败副本 `/tmp/c27-31ade742-runtime` 和归档零模型复现入口保持只读，最新修复见下行。 |
| C26排版候选 / C27复验 | 产品 `687121ec8d9afeccb527d2738f8b1ca22791dd69`；完整 `ec5094c00d122c77d2acdb376f4ede96eafb13e0:docs/acceptance/evidence/C26/v1/math-layout-fix.md`，组合固定点 `f76e24c94f43f5a09169e7ac2b41285ea22dc4e7`。self PASS：实际原候选判红，KaTeX统一0.16.47及公式段落滚动后原/新回复三视口、题库、右栏、刷新/重启通过；API164项分别执行通过、浏览器7+10、build及内部两轴通过。业务/认证/契约不变，零产品调用。C27 attempt 2从bba393b建review/c27-math-recheck，仅写独立证据；D01关闭仍待其回执。 |
| C21 next-1 新结果 | 制品 `9230895a802ac46dfa3ceefc660659dd8bc8abf7`；作者 `ecd1ed6d8f974fba20ac92d40d5b6b943a3b0170:docs/acceptance/evidence/C21-MATERIALS-NEXT/v1/author.md`。独立报告 `dd6b2b8c57d776798d1cfbb2c087bbf5a6a8ad76:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c21-review.md`：EX-01/03/04及真实来源/编辑/重启分项PASS沿用；该版EX-02定位失败已由新制品c7022e0和独立d990f43闭环。原在线0/3失败保留。 |
| C21 定位/在线接续 | 候选 `05a919b998e72eb2a6d1a79b32fb62113cfe4c5b:docs/arch/capability-checks/C21-continuation.md`；作者 `b8824812e8e46f2a5cce0fb170b55c91ac6dffc5`。定位零请求局部修复沿原语义，可直接实施；在线拟仅在原DeepSeek请求新增reasoning_effort=none，I可用才PS，各1次/8000/120秒，总最多2次16000completion；Provider转发与可用性待实际证明，限定独立报告 `bf96f71427d4fcd3df11ff22fa345480c94d877b:docs/acceptance/evidence/C20-C21-CONTINUATION/v1/review.md` 已PASS。在线attempt 3基线 `19390e83d54e739f829b52261aea6ad5ebaff92e`，原定位/窗口核验派发基线 `d2dcaff42665f22eff04a9e12096012a05fc285b`。 |
| C21 定位修复 | 制品 `c7022e03be1af4d6b2ca5ca1b5a12441bc8835f8`；回执 `bdc83152872e50c4ac6ba36cc63c532be74cba1e:docs/acceptance/evidence/C21-CONTINUATION/v1/author-location.md`。self PASS：六题自身响应定位、Q3编辑保存/刷新/服务重启、未知位置及必要共享回归通过；机器/人工差异保留，新增请求0。独立 `d990f43baa98d9b125a6606b1fab56e9b5c77e98:docs/acceptance/evidence/R30-C21-CONTINUATION/v1/review-location.md` 已PASS，关闭EX-02剩余缺口及REV-001；机器主要内容4/6与人工6/6保持分列。单独在线失败不变。 |
| C21 online-1实际结果 | 制品 `f75720e6c10e1ee4f8648d3e1e6e53b6a927a047`；回执 `c29d7ce5d751118e88913df924674b50e20ea911:docs/acceptance/evidence/C21-CONTINUATION/v1/author-online.md`。I请求HTTP400拒绝none，PS未调用，FAIL/self；usage缺失预留8000未知，累计17次/14份usage/92785已知completion，窗口关闭。不能判断Provider内部拒绝层级或上游消耗；未进行材料可用性与保存重开。参数调查已完成，后续online-low另见下行；本失败和消耗保持不变。 |
| C20 Provider调查 / C21 online-low | 调查 `a1999e353976a133e76cd47caba9e02e75a2e182:docs/research/c21-provider-controls.md` 及 `docs/acceptance/evidence/C20-C21-PROVIDER/v1/author.md`，self PASS、零产品请求。Provider枚举接受low，实际材料效果未证。根采纳单次I建议，attempt 4从 `a655aff6f37632ddcaced8cfb43abfaf55b4f105` 建分支，固定f75720e请求仅none改low，保留模型/消息/图像/8000上限/120秒；最多1次，不发PS、不自动重试。全部固定输入见 `.scratch/dag-dispatch/C21-MATERIALS-NEXT/4/launch.json`。 |
| C21 online-low结果 | 制品 `95de798dcef38b440934ccda41d11d9867fb2182`；回执 `a52f95c69b54ca978ae85dde024967bfedbc2d93:docs/acceptance/evidence/C21-CONTINUATION/v1/author-online-low.md`。仅一次I，固定请求唯一none改low，HTTP200/length/空正文；prompt4309、completion7994（全reasoning）、total12303。未评分或编辑保存，无PS/重试；窗口关闭。累计18次/15份usage/100779已知completion，原3份缺失不变。C20新裁决从 `2962c5e663b70eb2e5303ac8f551dd0de94466d1` 建分支，只消费固定证据，零新增产品请求。 |
| C20页级方案 / C21 attempt 5 | 方案 `a510cc0a46ea622b740e5d9e27ce8242300db055:docs/arch/capability-checks/C21-online-decision.md`；作者 `8f594a7b7d2f92190dbdf11cd515130be3efd77b`。该页级方案仅设计self，固定单页实际输出失败，执行其停止条件；不将设计PASS当实验通过。原四图/页序2、1、3、4/DeepSeek low/8000/120秒限制不变，实际只发送页2，全部剩余额度作废。 |
| C21页级实际结果 | 制品 `2b10b4ecbfef907de1d0c368c7a29eb49af803c4`；回执 `4115bb66a5522879421ae8b49cb704b524b80b2c:docs/acceptance/evidence/C21-CONTINUATION/v1/author-page-transcription.md`。FAIL/self：HTTP200、length、7998completion/7809reasoning、440字符截断正文，耗时39.801秒；Provider `gen_01M347PAWP0WDW1W7A5ZF1BRVA`。六题七项与新材料编辑未执行；真实失败保存/刷新/重启通过，仅本地恢复证据。两项内部审查缺陷已零调用修复；候选及现场保留，源工作树干净。累计19次/16份usage/108777已知completion、历史未知不变，费用未知。补充通知 `01a0c88a-5930-7eb1-bb67-5f7b7f466da5` 虽投递，R30候选8b8656a未纳入新结果；该固定事实已直接交最终冻结核验，文字后续同步，不将queue成功当输入已消费。 |
| C22 next-1 独立消费 | 制品 `d2b324520064dbae663a46acb7045c84bd55a890`；作者 `a05324d7886b2603d5caaf19af3e46ce93dce973`；独立报告 `179f353755ff987cfba8678f782b242da3122bf1:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-review.md`。固定旧 DOC 规范化预览、LaTeX 结构/固定渲染、角色/分页/打印限定 PASS；完整 DOCX 编辑与 Q2 文内标记仍 FAIL，REV-002 不关闭。零模型，未重置窗口。 |
| R31 文件内容基础 | 产品 `5f696b8ce611e67d940ce149ce13946a50b65510`；回执 `c08fa62d434efffc89b471151faa73308e3ce716:docs/acceptance/evidence/R31-FOUNDATION/v1/author.md` 及同目录 integration.md；文件 HTTP/重启/迁移/文档编辑 self PASS，完整 R31 与转换未完成，正式启动保护保留。 |
| M41 先行依赖冻结 | 设计 `2e67961b01f4ce90ab07dad1feb823b1f595266d:docs/arch/math-foundation-dependency.md`；作者 `76151489f28cfe1ccaddd8afa28db3c613f3c6a5`；独立报告 `3783208100703efc6b00f14eaf9709ff501705a2:docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/review.md`。限定允许固定文件基础上的隔离 M41；公共依赖/身份须实际装配，完整 R31、M41→M42、R35→M43 等门禁保留。三项新派发均从 `c85d073a9582b6aab19c5db66f83ec4fdc6ad355` 建隔离分支，固定输入见各 launch.json。 |
| R31 数学公共支持 | 产品 `07aeddc3a15b332cc941a86c340147facdef1425`；证据 `26c89fb40ece370c3b4b23079543766f9a2da428:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/author.md` 及同目录 integration.md；组合基线 `1e8ec794ec4a19e05f3ca43800d3c7bedfc79d51`。真实文件/页面身份、MathJax3.2.2和本地中文资产 self PASS，内部两轴已完成；该版公共写入已停止。向M41投递 `01a0c845-06eb-7e10-8830-735a03b3fb6e` 成功但交付候选未消费；当前由attempt 2显式整合。仍fake-mail/自签HTTPS，四handler拒启保护保留。 |
| R31/M41 固定公共组合 | 产品 `7c6e7ade69a7e86cbfd8212def7a5620e8d857d6`；完整交付 `02340eb972d68221bde94976c0da5fa90648de89:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/attempt2.md` 及 integration2.md。组合基线 `4f0d6a9c9c28386297302b48c55bd6f82b4fb317`；公共写者已停写，M41已明确消费完整组合并完成后继自验，当前M42输入是5a767db。隔离目录投影不是M43正式目录v3，完整R31并未因此通过。 |
| M41 原生图形切片 | 产品 `6a54e55a36e9efec65381ad9ceaa7af0c8228f36`；证据 `953840563d4689cdbefb8ddc43f559493e14e178:docs/acceptance/evidence/M41/v1/author.md` 及 integration.md；组合基线 `df376b214113c7476e524b68a19982ade1e0e642`。旧原生切片保留，缺少公式/身份/共同build的当时结论不作为当前状态；公共支持02340eb及后继M41 c3ab0da已完成对应本机模块缺口。 |
| M41完整静态模块 / M42输入 | 产品 `c3ab0dacd1ff172d8557117f028ebdd805235d41`；完整 `5a767dbc66ed6efb5fca1bcfe0870b7561c433b5:docs/acceptance/evidence/M41/v1/attempt2.md` 及 integration2.md；实现前组合 `97d466c307a5cd18063a5b78a047980a5b78720d`。原包静态场景、5数学API/12原生浏览器/2真实身份浏览器/159公共API/build self PASS；MC09真实身份/迟到下载/重启已消费，修复sqrt定义域采样。real-auth/fake-mail/自签HTTPS；内部审查聚合完毕，停写，实际分支feat/m41-attempt2。M42从809e6f3建独立分支消费完整固定输入，不借用源运行库、不调用模型，M43/R35及目标设备门槛保持。 |
| A11同页重登问题输入 | 固定M41 5a767db的 `docs/acceptance/evidence/M41/v1/attempt2/auth-bootstrap-boundary.json` 报告退出最后会话后同文档登录/注册409 browser-context-required、刷新恢复；仅作者观察，归属由A11-BOOTSTRAP-FIX复现确认。对照A11 `9ecabbf60cbbaecce2e9be8191d270068eb675cf`、独立 `aaa3d77accbfc743f47edfb1ffc385735b2bf3db` 与认证冻结6f30032/63bfe8f；从809e6f3建fix/a11-logout-bootstrap，写权仅认证及相关测试/fixture，math只读。未修、未重新验收，零产品调用。 |
| M41 调度入口整合 | 文档候选 `64ef39f1ad7050593c4cb23802472a24d0549aea:docs/acceptance/evidence/M41-DOCS/v1/integration.md`；控制分支整合 `f4ea62e6f155a71dfb7f359f9c9fc382f5682113`。仅8份获准文档，根台账在整合时 blob 原样保留；提案/作者/独立报告原文及 DAG/math/materials 入口已同步，50业务节点与后续门禁不变。无产品路径、无新增产品验收或模型调用。 |
| C22 editing-1 裁决 | 设计 `d5cb05bd306f1855d78f14096fd840f72cae3ec4:docs/arch/capability-checks/C22-editing-next.md`；作者 `5fae85f4b00a413581951776dae111898f455bbf`。仅修验证工具与既有校对提示，契约/范围/依赖不变；Astra high 一次有界接手，首次 Office 起30分钟、无后续失败复测、零模型；旧窗口及消耗保留。 |
| C22 editing-1 结果 | 制品 `1ef7bf378dfad77a46d6b6f282a5db4d3a1e9fd2`；回执 `8ab93a37455400c8f54c7a331727dc428936a9fb:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt2.md`。self FAIL；第一轮三项编辑 DOCX 重开值保留，减号断言中止，第二轮/PDF/全页未做。1复现/1候选/1链尝试/0追加复测，Office含保全253.645秒，零产品请求/费用；窗口关闭，全部现场保留。 |
| C22 validation-1 裁决 | `634dec32b16068bb3e95e31087ddae94340b13be:docs/arch/capability-checks/C22-validation-next.md`；作者 `6889727ff666436e5c1bd0b964cc7576233e6720`。表示差异仅用于比较副本，统一回读/唯一替换/未改式判别；复用六稿与首轮保存件补第二轮和八组输出，路线/契约未变。1候选/1剩余链接续/0失败后复测，首次Office起30分钟、单操作无进展60秒，零产品请求/新增费用。C22 attempt 3 从 `996aa9547f885ae3c265887c2044cab813aa1e54` 派发。 |
| C22 validation-1 结果 / control-1 接续 | 制品 `3bf9fd4dd26dfdb202c8d583bb33efac044dc89d`；回执 `6ec6f861b5220a21f574ff782402f203f5f4a098:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt3.md`。self FAIL，23项离线检查及第一轮回读通过、新增两页PDF，恢复Writer正文选区失败；第二轮/全页/打印未做。新增执行18.356316秒、含保全63.698105秒；两次补证合计135.987291/317.343307秒，产品请求/费用0。control-1 从 `b7de27b34a81b9483a3f12b6c705020310cba12c` 新分支接手，固定本制品及634dec3数学验证语义。 |
| C22 control-1 新结果 | 制品 `7f965c6408a73d30524ff8e11c40484a352232c1`；回执 `a34798de7070d837019a02ab9d0f9c34b226a277:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/attempt4.md`。本机self PASS：沿用E第一轮改值保存，补齐可编辑性及完整第二轮、八组DOCX/PDF共19+19页、角色/Q2提示/三类打印。新增662.878044秒、含旧保全累计980.221351秒，零产品调用/费用；旧坐标唯一根因未知。本机剩余条件已由独立f877b63关闭，Windows/WPS外部验证仍未交付。 |
| C22 control-1 独立消费 | `c03df4ad6d0290f9172a15e3f23dc1e6875efe0a:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-control-review.md` 的来源/保存件结构/Q2提示/角色/19页PDF通过切片沿用，旧DOC/LaTeX结论不变；GUI退出及DOCX第3页缺口已由下行新独立报告关闭，原失败报告和现场保留。 |
| C22剩余GUI独立关闭 | `f877b6395cbfbde4b2d8aa7e8d3f64496aea22cc:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-gui-review.md`；受测7f965c6不变，independent PASS，REV-002本机关闭。六次Math退出、第二轮分母/指数/中文真实编辑及保存关闭重开、再次进入公式、学生练习DOCX第3页完整Print Preview通过。来源/既有制品保持，独立生成物及原始操作证据入库；零产品调用/费用。Windows/WPS仍BLOCKED，不能代签完整R30/R35。 |

## 当前材料阻塞与外部输入

- C21定位制品c7022e0经独立d990f43通过，EX-02/REV-001关闭。最新页级方案仍因首个页length/正文不完整而FAIL，其余页未发。累计19次/16份usage/108777已知completion，历史3份usage缺失及online-1预留8000未知不变。按原C20裁决停止该固定路线，在线能力待支持新方向的证据再交C20，不另开无依据的重试或重复设计。R30冻结、M41和C26修复继续，不把在线问题转签为成功或永久手工录入。

- C24 真业务累计 32 次 DeepSeek provider 请求、93,970 total tokens；本轮修复新增 7 次、36,651 tokens。PI-01/02 消耗另有原账本，不能混成全部实验总量。副本读回补验已通过，计费余额/extra credits 状态仍未知；cost=0 不证明免费。
- R30新候选8b8656a已形成，仍待限定最终冻结。REV-001/002独立关闭保持，最新页级在线FAIL的补充未被作者纳入，候选“尚无实验回执”文字过期。当前独立核验收到固定新报告，须区分该状态文字与原门槛；不重开旧实验或推定整个产品通过。完整R31/R32-R35仍按原依赖推进。
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
