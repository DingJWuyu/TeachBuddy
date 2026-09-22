# MATERIALS-TEACHING-ALIGNMENT@1 设计回执

**PASS / self，仅设计判断与交接完成；有冻结语义变更提案，尚未限定冻结、未实现、未关闭产品失败。**

固定 M43 的旧题目列表422符合材料的无损保护；公共缺口是教学契约仍明确消费旧题目读取端口。本次提出 classes 统一消费已冻结的 `questions.readForReferenceV2`，同时修订目录中的这一个依赖值。题目选择改现有 v2 列表，材料页面补既定反馈/返回行为。无新 HTTP/schema/数据迁移，保留教学的当前对象链接和真实数学来源语义。

```yaml
task: MATERIALS-TEACHING-ALIGNMENT@1
revision: 1
attempt: 1
role: design
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T16:16:49Z"
session_id: "01a0c9e0-1b88-70b0-a048-9a6d6f45df40"
runner: "Codex，沿当前模型执行；具体模型名/effort未由本会话输入暴露，未切换路由或调用dsh"
skills_used: [codebase-design, writing-for-agents]
base_revision: "78d1bae7c493cc586fecd7b324184980a549a5a9"
result_revision: "本回执与设计文件的同一提交，完整SHA由最终交回固定；git log -1 --format=%H -- docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/author.md 可定位"
branch: "design/materials-teaching-alignment"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "M43 4b5c31e6e67543a2826f662ff07acc19a0de765f；产品909693a7cc67f50a523ea94864ef7b80a345d5df"
  - "材料8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1；独立88a89f00b78dd301ca9893a191277eb9970c4c18"
  - "T50 afda1c5d8d8c2de93f1e045ff2ad32e2681bd116"
  - "作品扩展a44587b9bd18618d77df13f7349f5043a297d226；独立3dbead5af93059b0f890c531097b234e5f453fae"
changed_files:
  - docs/contracts/materials-teaching-alignment.md
  - docs/plans/tasks/materials-teaching-alignment.md
  - docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/author.md
  - docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/checks.txt
artifacts:
  - "同提交的接缝提案、实施短包与checks.txt"
checks:
  - "固定失败JSON与消费者/提供方调用链静态核对"
  - "ModuleCatalogV3所需枚举、已有映射、目标目录单值差异与依赖无环核对"
  - "本任务文档链接、7个增量用例、git diff --check和写入范围自检"
identity_mode: "不适用：本次未运行产品；真实认证失败证据来自固定M43，未冒称本轮real-auth"
open_items:
  - "根决定限定冻结；作者self不冻结公共依赖修订"
  - "原M43题目关联OPEN待新候选实施和独立实测关闭"
  - "丰富题目页反馈及来源往返待真实浏览器验证"
failure_owner: "产品缺口归教学消费者依赖升级与材料页装配；公共修订归本设计，冻结决定归根"
next_condition: "固定本提交并限定冻结后，按实施短包派唯一写者；完成新候选self后交根指定独立验收"
authorization_used: "本轮用户MATERIALS-TEACHING-ALIGNMENT@1 attempt 1：只设计受影响接缝，可在任务分支提交，禁止产品修改/合main/push/部署，外层通知"
```

## 固定输入

以下路径均以表内完整 Git SHA 为根，用 `git show <SHA>:<path>` 读取。只读来源 `/home/liam_t/项目/TeacherWorkspace-m43` 未写入；不以其活动 HEAD 或旧任务包当前状态文字代替固定事实。

| 输入 | 完整 SHA | 读取路径与用途 |
| --- | --- | --- |
| 本任务 main 基线/角色规则 | `78d1bae7c493cc586fecd7b324184980a549a5a9` | `docs/plans/execution-protocol.md#design`、`#ownership`、`#receipt`；本任务分支起点等于此 main |
| 数学集成证据 | `4b5c31e6e67543a2826f662ff07acc19a0de765f` | `docs/acceptance/evidence/M43/v1/author.md`、`question-link-open.json`、`integration.md`，按用户要求首先读取 |
| 实际消费者/提供方 | `909693a7cc67f50a523ea94864ef7b80a345d5df` | `apps/web/src/features/classes/{SourcePicker.jsx,api.js,FeedbackPanel.jsx,model.js}`、`apps/api/src/modules/classes/{index.js,service.js,contract.js}`；`questions`模块旧/v2读取及新版Web装配；`packages/shared/src/moduleCatalog.js`、`WorkbenchApp.jsx` |
| 材料设计 | `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1` | `docs/contracts/workbench/materials.md`兼容节；`materials.openapi.yaml`的listQuestionsV2、ReferenceReadQuestion、Snapshot；`docs/arch/materials.md`公共端口 |
| 材料独立限定冻结 | `88a89f00b78dd301ca9893a191277eb9970c4c18` | `docs/acceptance/evidence/R30/v1/final-review.md`，确认设计冻结及未变切片边界，不把旧READY_FOR_REVIEW当作当前未冻结 |
| 教学时间 | `afda1c5d8d8c2de93f1e045ff2ad32e2681bd116` | `docs/contracts/teaching-time.md`记录/公共变更节、`docs/arch/teaching-time.md`端口表 |
| 教学作品扩展 | `a44587b9bd18618d77df13f7349f5043a297d226` | `docs/contracts/teaching-time-math.md`、对应arch/UX/BDD；`teaching-time/math-samples.json`目录；`teaching-time/inputs/m40/docs/contracts/workbench/math/math.openapi.json`目录schema |
| 教学扩展独立冻结 | `3dbead5af93059b0f890c531097b234e5f453fae` | `docs/acceptance/evidence/T50-MATH-CONTRACT/v1/review.md`，明确原schema、目录、数学反馈与门槛的适用范围 |

## 实际判断与核验边界

1. 既有端到端证据先于本次源码判断：固定 JSON 记录 `/api/modules/questions/items` 的422。本次是设计对照任务，未启动服务、重建现场、注入故障或改产品；保存/读回受同一旧端口阻断是静态调用链判断，运行关闭归后续实现/验收。读取 diagnosing-bugs 仅用于判断方法适用性；完整诊断/修复循环不在本次执行范围，未声称已跑 red/green。
2. 提供方已有 `readForReferenceV2`，返回中的 `snapshot.title`、ID/version/deletedAt 足够沿用教学投影；不需要新 `readForTeachingLink` 或通用摘要平台。classes 当前明确依赖旧端口，故公共消费者约定确需修订。前端列表只需消费已有协议。
3. 固定源码只有 math 装配了 `SourceRecordsPanel`，新版题库真实入口未挂。原 TT-U3/WB-T003 已要求题目反馈与往返，归同链路装配补齐。未因静态发现宣布浏览器已失败或重新审查整个材料/教学 UI。
4. 自检原始结果见 [checks.txt](checks.txt)。检查用系统 Python 标准库和 Git 直接执行，无新增依赖、通用校验器或测试框架。系统无 PyYAML，未安装；本次没有新 YAML/OpenAPI，未将此探查记为产品测试失败或schema验收。

## 冻结语义与原通过结论

| 结论 | 对本次的适用性 |
| --- | --- |
| R30材料独立限定冻结 | 无损内容、v2读取、旧接口422、文件/原稿与备课快照契约不变，原结论继续适用。原在线、Office与设备限定仍保留，本次不代签产品或重跑实验。 |
| T50普通教学/时间规则与扩展记录schema | ID、原文、版本、首次标题、当前来源链接、事务/未知结果、时间/提醒不变。原固定范围结论继续成立，不自动证明新组合运行成功。 |
| T50/M40冻结的classes题目读取依赖及目录目标 | **本提案改变冻结语义**：旧题目端口改已存在v2端口。旧报告中目录与原M40样本逐字段相等的判断不覆盖新组合；需根限定冻结并验新目录。无新增目录schema或版本号。 |
| M43数学切片LOCAL_SELF_PASS与既有材料测试 | 在其固定旧候选与具名范围继续有效。新组合需复验题目/混合来源及共享导航、目录；旧self不外推为新候选PASS，题目关联OPEN仍未关闭。 |
| 当前M44和R35独立验收 | 各自固定旧候选保持，不被本提案切换、追加隐含前置或重命名证据。结果由各自验收者按原范围报告。 |
| 完整T51/T54/WB-T020及外部条件 | 原真实数学提供方、M44、完整教学独立验收和设备门槛不变。本次self不能放行。 |

## 下一入口与停写

根先决定[接缝提案](../../../../contracts/materials-teaching-alignment.md)的限定冻结，只涉及依赖修订及7个增量用例。冻结后从[实施短包](../../../../plans/tasks/materials-teaching-alignment.md)进入，由唯一写者完成教学消费者与材料页装配，并交新固定候选/self；根指定独立验收复跑真实选择、保存、重启、往返和反馈，再决定关闭原缺口。

本分支只新增本任务文档，不改根run-state/DAG、原契约副本、旧失败证据、产品或README。无业务互聊、扩派、密钥读取、产品模型请求、main合并、push、部署。完成后无需保留的临时文件为零；原只读来源和他人现场保持。提交本回执后停写，唯一通知由外层发送。
