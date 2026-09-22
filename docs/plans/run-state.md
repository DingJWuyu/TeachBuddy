# 当前运行台账

本页是编排者的当前状态与接续入口。节点依赖由 [DAG](mvp-dag.md) 拥有，范围由 [PRODUCT_SCOPE](../PRODUCT_SCOPE.md) 拥有，模型与角色规则由 [执行协议](execution-protocol.md#orchestration) 拥有。旧尝试的过程见原回执与 Git 历史；本页不重述已经失效的下一步。

## 上下文恢复入口

1. 读取根 [AGENTS.md](../../AGENTS.md)、本页的当前批次和对应任务包。
2. 依据固定候选与正式回执判断依赖；区分 `self`、`independent` 和用户验收。
3. 当前处于完整 DAG 执行状态。C25 独立核验发现只读工具公开投影缺口，正由 C25-CORRECTION 定向修订；材料新窗口和 R31 基础分段启动均已 independent PASS，C21 新制品已 self PASS 并交独立消费，新增请求空正文仍保留；R31 基础切片已 self PASS；C22 已交切片正独立核验；C20 裁定未变方案内修验证脚本与校对提示，已派 Astra high 一次有界接手；R30 原缺口仍未关闭。M40 冻结交接已完成，A12 本地认证定向独立复验已 PASS，两项缺陷关闭；真实邮件与目标设备仍待提供；T54 三项原缺陷独立关闭，新发现的日程主区滚动返回丢失 D04 正交 T52 修复；真实作品关联仍待依赖。依据下面派发记录接续，不重复派发，不主动轮询。
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
| T53 | 新会话，attempt 3 | gpt-6-astra / low | 已完成，三项修复已独立确认 | `01a0c7e4-7387-7ff3-8fcd-5e79840ab177` | `.scratch/dag-dispatch/T53/3/` |
| A11 | 新会话，attempt 3 | gpt-6-astra / low | 已完成，self PASS | `01a0c7d9-dfcb-7562-a2fd-b36edacee619` | `.scratch/dag-dispatch/A11/3/` |
| M40-HANDOFF | 新会话，attempt 1 | gpt-5.6-sol / medium | 已完成，冻结交接 PASS | `01a0c7c8-8354-7192-b525-9b10180805b0` | `.scratch/dag-dispatch/M40-HANDOFF/1/` |
| C24-BUSINESS-FIX | 新会话，attempt 1 | gpt-6-astra / low | 已完成，self PASS | `01a0c7c8-833e-7f12-9ecf-5dce76b8c2b7` | `.scratch/dag-dispatch/C24-BUSINESS-FIX/1/` |
| MATERIALS-NEXT-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，方案已独立冻结 | `01a0c7c8-8353-7113-b827-5e82f5bbf02d` | `.scratch/dag-dispatch/MATERIALS-NEXT-PLAN/1/` |
| A12-LOCAL | 新会话，attempt 2 | gpt-6-astra / medium | 已完成，本地 independent PASS / 外部 BLOCKED | `01a0c7ea-45a9-7ee0-8373-a849de8e660a` | `.scratch/dag-dispatch/A12-LOCAL/2/` |
| T54 | 新会话，attempt 2 | gpt-6-astra / medium | 已完成，independent FAIL（新 D04） | `01a0c7f3-6299-79d1-8655-8a5e4dd0ca09` | `.scratch/dag-dispatch/T54/2/` |
| T52-SCROLL-FIX | 新会话，attempt 1 | gpt-6-astra / low | 已启动，待主动回执 | `01a0c7fb-bb99-7bb2-83b4-0cccd29d0bc0` | `.scratch/dag-dispatch/T52-SCROLL-FIX/1/` |
| C25 | 新会话，attempt 1 | gpt-6-astra / high | 已交候选，独立核验需修订 | `01a0c7d2-7a74-7050-8c8a-e28df0188772` | `.scratch/dag-dispatch/C25/1/` |
| C25-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，CHANGES_REQUIRED / independent | `01a0c7ee-7965-75f0-bad4-e0c38c979e51` | `.scratch/dag-dispatch/C25-REVIEW/1/` |
| C25-CORRECTION | 新会话，attempt 1 | gpt-6-astra / high | 已启动，待主动回执 | `01a0c7f6-fb1f-7e90-91f0-f78ed22857f6` | `.scratch/dag-dispatch/C25-CORRECTION/1/` |
| T50-MATH-CONTRACT | 新会话，attempt 1 | gpt-6-astra / high | 已完成，设计已独立冻结 | `01a0c7d5-b6d8-7232-b045-9ef61d8c46cb` | `.scratch/dag-dispatch/T50-MATH-CONTRACT/1/` |
| T50-MATH-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，independent PASS | `01a0c7ec-38af-7142-91bf-78f8c33d253b` | `.scratch/dag-dispatch/T50-MATH-REVIEW/1/` |
| T51-MATH | 新会话，attempt 1 | gpt-6-astra / low | 已启动，待主动回执 | `01a0c7f5-6025-7861-96db-7a113115ff68` | `.scratch/dag-dispatch/T51-MATH/1/` |
| MATERIALS-NEXT-REVIEW | 新会话，attempt 1 | gpt-6-astra / medium | 已完成，两项 independent PASS | `01a0c7d7-ed98-7031-9c26-aa9df00b7834` | `.scratch/dag-dispatch/MATERIALS-NEXT-REVIEW/1/` |
| C21-MATERIALS-NEXT | 原会话接续，attempt 1 / resume 1 | gpt-6-astra / low | 已完成，原 EX 门槛 self PASS，待独立消费 | `01a0c7e0-6919-7c50-8ad4-091bb7f35bf8` | `.scratch/dag-dispatch/C21-MATERIALS-NEXT/1/resume-1/` |
| R30-C21-CONSUME | 新会话，attempt 1 | gpt-6-astra / medium | 已启动，待主动回执 | `01a0c80b-253e-7993-a699-dddb4c59e48c` | `.scratch/dag-dispatch/R30-C21-CONSUME/1/` |
| C22-MATERIALS-NEXT | 新会话，attempt 2 / editing-1 | gpt-6-astra / high | 已启动，待主动回执 | `01a0c804-318e-7f73-9f71-f0560f2c8894` | `.scratch/dag-dispatch/C22-MATERIALS-NEXT/2/` |
| R30-C22-CONSUME | 新会话，attempt 1 | gpt-6-astra / medium | 已启动，待主动回执 | `01a0c7f9-be05-75b0-88e3-697f7ebdaa2a` | `.scratch/dag-dispatch/R30-C22-CONSUME/1/` |
| C20-C22-EDITING-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已完成，限定裁决 self PASS | `01a0c7f9-be0a-77e1-b9e3-5ef3087c30e9` | `.scratch/dag-dispatch/C20-C22-EDITING-PLAN/1/` |
| R31-FOUNDATION | 新会话，attempt 1 | gpt-6-astra / low | 已完成，基础切片 self PASS | `01a0c7e0-691d-75a1-9e6e-49758af3daeb` | `.scratch/dag-dispatch/R31-FOUNDATION/1/` |
| M41-DEPENDENCY-PLAN | 新会话，attempt 1 | gpt-6-astra / high | 已启动，待主动回执 | `01a0c802-4422-7f60-8eb2-5eaeb0be0b7c` | `.scratch/dag-dispatch/M41-DEPENDENCY-PLAN/1/` |

## 项目进度与当前门槛

完整 MVP 尚未交付。main 保留旧应用和新的规划/证据；本轮产品候选仍在任务分支。已通过的候选不会因 main 的文档更新漂移。

| 工作线 / DAG 节点 | 当前已成立的结论 | 尚缺条件或下一接点 |
| --- | --- | --- |
| 规划、入口与设计：P00/P01/G00、B10/B11、C20 | 规划与入口已完成；B11、C20 已独立冻结。G00 实施许可已恢复完整执行。 | 沿用现有设计与实验标准，不重新规划或重跑准备。 |
| 首条题库与备课：B12-B16 | 最新组合经 B16 independent PASS；真实保存、引用、重启恢复、隔离、失败恢复、桌面/Pad 已验证。 | 身份仍为 test-principal；不代表真实认证或完整题库范围通过。 |
| 认证：AUTH-CONTRACT、两端、A10-A12 | A12 本地 independent PASS：新候选 9ecabbf 的双页退出、恢复卡及必要退出/会话回归通过；未受影响的正常认证、隔离和持久重启结论沿用。 | 两项本地缺陷关闭，可供后续固定认证接线消费。A12 整体仍受真实邮件、目标设备/可信证书阻塞；备份恢复归可靠性阶段。 |
| 材料：C21/C22、R30-R35 | 原 R30 独立缺口仍开放。C21 新制品 9230895 的来源、评分、编辑与恢复达到作者自验门槛，正由 R30-C21-CONSUME 独立核验；三次新请求均空正文，不证明新材料在线提取。R31 基础切片 self PASS。 | C22 next-1 的 DOC/结构/角色/打印正独立消费；编辑闭环和正文校对提示由 Astra high 按 editing-1 有界补证。两项 REV 尚未独立关闭；完整 R31 和 R32-R35 仍待材料门槛。 |
| 数学：C23、M40-M44 | M40/v1 设计已完成冻结交接，候选 1a5dd01；三项实验阻断 independent 关闭，交接动作仅 self 文档自检。 | M41 仍待完整 R31；M41-DEPENDENCY-PLAN 正基于真实基础候选核对能否有界先行，尚未放行。M42 待 M41，M43 待 M42/R35；教学记录作品新版 a44587b 已独立冻结，T51-MATH 已派发局部实现。数学产品尚未实现。 |
| 班级与日程：T50-T54 | 新候选 ff24814 的 D01/D02/D03 全部 independent 关闭；当前 FAIL 仅新 D04：平板日程主区切模块返回丢失滚动位置，归 T52。 | T52-SCROLL-FIX 正定向修复，已通过场景沿用。T51-MATH 在独立分支局部补接，后续合流仍需真实提供方及 M44/WB-T020。 |
| Agent：C24-C27 | C24 PI-03/04 定向补验 self PASS，候选 e8fdf9a；旧 PI-01/02 有 self 证据。副本读回已修复，pi 错误标志语义已实测。 | C25 独立 CHANGES_REQUIRED：只读工具开始/结果/失败缺公开投影与刷新恢复字段（C25-D01），设计者正定向补齐；C26/C27 尚未启动。 |
| 可靠性：F60-F65 | 尚未启动。 | 等待 T54、C27、A12 的真实交付，再补全模块工具、现场、恢复和整日集成。 |
| 最终交付：D70-D75、G73/G76 | 尚未启动，未部署、未用户验收。 | 等待全范围验收、可用目标环境及具体交付动作授权。 |

## 下一步与回执处理

先核对任务、attempt/session、实际候选和证据级别。退出码 0 只说明进程结束，重复或迟到的旧回执不推进当前节点。完整执行授权覆盖依赖就绪后的派发，不需要每个节点重新请示。

| 工作 | 本轮动作 | 下游判断 |
| --- | --- | --- |
| M40 / T50 / T51 | T50 新版独立 PASS 已接收，派 T51-MATH 局部补接和来源错误语义修正。 | 局部 self 供 M43 接入组件；真实提供方和 M44 到达后再汇合验证完整 WB-T020。M41 仍待完整 R31，当前 T54 候选不变。 |
| C24 / C25 | C25-D01 已交 C25-CORRECTION 定向补齐公开工具投影，不交实现者猜字段。 | 新固定候选做限定独立冻结，沿用未变设计/实验结论；通过后固定认证与共享写者再派 C26。 |
| R30 / C20 / R31 | C22 新制品交 R30-C22-CONSUME 分项核验，编辑与校对缺口已有 C20 裁决，C22 attempt 2 按 editing-1 一批接手；C21 新制品已交 R30-C21-CONSUME，R31 基础切片 self 交付；剩余 R31 等待材料门槛。 | C22 原窗口不重置，editing-1 不变更契约且无额外设计复审；新制品交 R30 消费新增证据。R31 整体与 M41 仍需原门槛。 |
| R31 / M41 | R31 基础 self PASS 已接收；派 M41-DEPENDENCY-PLAN 检查数学对剩余转换的真实依赖。 | 仅提出裁决，改变启动依赖需限定独立冻结；未核定前仍不派 M41，不新加基础重复审查。 |
| A11 / A12 | 已接收本地 independent PASS，关闭 A12-LOCAL-001/002，无新增缺陷，不再派重复复验。 | C26 等后续组合消费固定 9ecabbf 与 aaa3d77 报告；外部邮件和目标设备输入到达后补真实验收，不提前解除 A12 整体及 F60 门禁。 |
| T52 / T53 / T54 | D01/D02/D03 已独立关闭，D04 交 T52-SCROLL-FIX 修复主区现场返回。 | 新固定候选只复验 D04 与必要滚动回归；与独立 T51-MATH 后续合流，真实作品/认证/目标设备门槛仍保留。 |

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
| T53 真实组合 / 回执 | 修复产品 `ff248141ac60668cca958b1212bcc2dfcf799490`；回执 `680117f076b548ed997bfd11e4687614666a0b85:docs/acceptance/evidence/T53/v1/attempt3.md`；定向 11、教学 8、首流 18、API 147 及构建 self 通过，身份 test-principal。 |
| T54 独立报告 | `ae0f34c228c0cd52f356a5cbf1d21708c6e5e954:docs/acceptance/evidence/T54/v1/recheck.md`；受测 `ff24814`，D01/D02/D03 关闭，19 PASS/1 FAIL 为新 D04；原报告 `488c3b8` 沿用未变结论，身份 test-principal。 |
| R30 / 限定接缝 | 原设计 `ae9a395`、review `0467f46`；恢复方案 `7789974` + review `c82cd69` 仅放行材料补验和 M40 设计接缝。 |
| 材料补证 | C21 制品 `cfbbc1d` + 回执 `96be500`；C22 实际制品 `f29a7afc5254fc852811c9a9e2368f46cce3e01e` + 回执 `c8c089c`；受审组合 `8d48af5`；独立报告 `16d4b013b17b1e8d8c240c0d15a8b5366102024b:docs/acceptance/evidence/R30/v1/recovery-review.md`。 |
| 材料新方案 | 内容 `cd751b68e5001999b5a5f7544254c41d804f058a`；完整交付 `68f66587d4d625ee9c8f75516eafa61913b57e40:docs/arch/capability-checks/materials-next.md`；短包 `docs/plans/tasks/materials/next.md`；独立分项冻结 `0fb32a6e31d4ea0a6673bcce15423137a9a68b0a:docs/acceptance/evidence/MATERIALS-NEXT-PLAN/v1/review.md`。 |
| M40 / C23 修正 | 冻结交接 `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md`；M40 设计 `a6a495a` + 作者 `b626a93` + 原 review `3da472e`；修正受测 `d1490531e014ef437374c2f5a23cf3073baeef56`；独立 PASS `b01bc73954cbbc13e464738e0f6f8aa6c6f12084:docs/acceptance/evidence/M40/v1/correction-review.md`。 |
| C24 探针 / 业务实验 | 探针 `e7f979bd80ab83aaab7cc2cf936250123d7742a3`；旧业务 FAIL `d826b72`；修复与 self PASS `e8fdf9a139e429c05590925647a433a9da382579:docs/acceptance/evidence/C24/v1/business-fix.md`。 |
| C25 首批 Agent 候选 | 设计 `cadc61aa4ff36156b4a03fb9ba3401aba9783f9a`；作者 `b7732f80a74111c5c30b1758335707324e5e7563:docs/acceptance/evidence/C25/v1/author.md`；独立报告 `e0b2c23fc1e37c357831cefacb0817c07ae3cafd:docs/acceptance/evidence/C25/v1/review.md`，仅 C25-D01 公开只读工具投影阻断，待定向修订。 |
| C21 next-1 新结果 | 制品 `9230895a802ac46dfa3ceefc660659dd8bc8abf7`；作者 `ecd1ed6d8f974fba20ac92d40d5b6b943a3b0170:docs/acceptance/evidence/C21-MATERIALS-NEXT/v1/author.md`。五入口主要内容自评分6/5/6/4/6，七入口编辑/重启回读及 E/F 恢复 self PASS；新请求全部空正文，机器/人工版本及失败分列，待 R30 独立判断。 |
| C22 next-1 新结果 | 制品 `d2b324520064dbae663a46acb7045c84bd55a890`；作者 `a05324d7886b2603d5caaf19af3e46ce93dce973:docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/author.md`。DOC 刷新、LaTeX 结构和角色/打印 self 通过；编辑复测失败、正文疑点标记缺失。零模型，窗口关闭，全部失败现场保留。 |
| R31 文件内容基础 | 产品 `5f696b8ce611e67d940ce149ce13946a50b65510`；回执 `c08fa62d434efffc89b471151faa73308e3ce716:docs/acceptance/evidence/R31-FOUNDATION/v1/author.md` 及同目录 integration.md；文件 HTTP/重启/迁移/文档编辑 self PASS，完整 R31 与转换未完成，正式启动保护保留。 |
| C22 editing-1 裁决 | 设计 `d5cb05bd306f1855d78f14096fd840f72cae3ec4:docs/arch/capability-checks/C22-editing-next.md`；作者 `5fae85f4b00a413581951776dae111898f455bbf`。仅修验证工具与既有校对提示，契约/范围/依赖不变；Astra high 一次有界接手，首次 Office 起30分钟、无后续失败复测、零模型；旧窗口及消耗保留。 |

## 当前材料阻塞与外部输入

- C21 next-1 已交 self PASS，原 EX 门槛与 REV-001 是否关闭由 R30 独立消费判断。新增 P/I/PS 三次 DeepSeek 请求均 HTTP200/length/空正文，23,996 completion；累计16次请求、14份 usage、已知92,785 completion，旧两次缺 usage。批次关闭，不因尚余配额继续尝试；如在线提取仍欠证，归 C20 依据现有响应裁决，不冒充新模型成功。

- C24 真业务累计 32 次 DeepSeek provider 请求、93,970 total tokens；本轮修复新增 7 次、36,651 tokens。PI-01/02 消耗另有原账本，不能混成全部实验总量。副本读回补验已通过，计费余额/extra credits 状态仍未知；cost=0 不证明免费。
- 当前权威结论为 [R30 恢复独立报告](/home/liam_t/项目/TeacherWorkspace-r30-recovery-review/docs/acceptance/evidence/R30/v1/recovery-review.md)，报告提交 `16d4b01`，受审组合 `8d48af5`。进程正常退出不改变本次 independent FAIL。旧 C21 作者的“直接可用 6/6”不作为 EX-02 关闭依据；新 9230895 尚待独立消费。
- C21 公式/图资产来源、可信逐题评分及一致编辑证据归 C21/C20；C22 的一般 LaTeX 转换与旧 DOC 缺口归 C22/C20，R30 负责后续独立消费。新方案已取得两项限定独立冻结，分别交实验修复者和 R31 基础实现者，原 REV 仍由 R30 独立消费后关闭。
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
