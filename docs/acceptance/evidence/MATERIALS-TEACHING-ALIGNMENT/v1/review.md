# 材料与教学兼容修订独立核验

**PASS / independent。** 固定提案 `1a60db5a16860f5e411c59a3d4a7f4fdc17b751a` 可作限定冻结输入：classes 改用既有 `questions.readForReferenceV2`，同步替换目录中的题目依赖，接通丰富题目的选择、反馈与记录往返。没有开放的设计冻结必修项。本结论是兼容修订核验，不是新产品候选通过；M43 题目关联 OPEN 仍待实施和独立实测关闭。

## 固定输入与证据方法

全部事实从 `git show <完整SHA>:<path>` 读取。提案来源为 `/home/liam_t/项目/TeacherWorkspace-materials-teaching-alignment`，实现与失败来源为 `/home/liam_t/项目/TeacherWorkspace-m43`；未使用其浮动 HEAD。没有启动服务、浏览器、能力实验或产品模型；旧浏览器失败仅作为固定输入，源码分析仅作为静态依据。

| 输入 | 固定版本及读取位置 |
| --- | --- |
| 提案 | `1a60db5a16860f5e411c59a3d4a7f4fdc17b751a`：`docs/contracts/materials-teaching-alignment.md`、`docs/plans/tasks/materials-teaching-alignment.md`、`docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/author.md` |
| 真实实现及失败 | `4b5c31e6e67543a2826f662ff07acc19a0de765f`：`docs/acceptance/evidence/M43/v1/{author.md,integration.md,question-link-open.json}`，以及下表具名源码。回执绑定产品 `909693a7cc67f50a523ea94864ef7b80a345d5df`，本轮源码实际统一取前述完整证据提交。 |
| 材料 | `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1`：`docs/contracts/workbench/materials.md` 兼容节、`materials.openapi.yaml` 的 listQuestionsV2/ReferenceReadQuestion/Snapshot、`docs/arch/materials.md` 公共端口；限定冻结 `88a89f00b78dd301ca9893a191277eb9970c4c18:docs/acceptance/evidence/R30/v1/final-review.md` |
| 原教学与数学扩展 | `afda1c5d8d8c2de93f1e045ff2ad32e2681bd116:docs/contracts/teaching-time.md`；`a44587b9bd18618d77df13f7349f5043a297d226` 的 `docs/contracts/teaching-time-math.md`、`teaching-time/math-samples.json`、`teaching-time/inputs/m40/docs/contracts/workbench/math/math.openapi.json`；独立冻结 `3dbead5af93059b0f890c531097b234e5f453fae:docs/acceptance/evidence/T50-MATH-CONTRACT/v1/review.md` |
| 数学原 schema | `1a5dd015863d749e5244346f4eaad24ac506670d:docs/contracts/workbench/math/math.openapi.json`，与上述 T50 绑定副本直接逐字节比较 |
| 当前角色规则/分支起点 | `f68fa6fd29499151c165c011630525f4b761c681`：`docs/plans/execution-protocol.md#acceptance`、`#receipt`、`docs/plans/skill-routing.md`；本次用户限定任务优先 |

## 逐项判断

下表源码路径以固定 M43 提交为根；行号指该 Git 对象，不指当前工作区。

| 核验项 | 依据与判断 |
| --- | --- |
| 失败与责任 | `question-link-open.json` 固定 real-auth 浏览器旧 `/api/modules/questions/items` 返回 422、`/body/version`、`unsupported-content-version`。材料兼容节明确旧列表整次拒绝不可表示题；T50 明确旧读取依赖。提案将责任分为公共消费者依赖修订和页面装配正确，不能放松 questions 守卫来修复。 |
| 记录投影足够 | `questions/index.js:60` 将 v2 公共端口交给 `materials-service.js:173`，返回 id/version/deletedAt/snapshot；`:20` 的 snapshot 包含 title。`materials-store.js:42` 从同账户原记录同步读取，允许 tombstone，无纯读写回。材料 schema 要求上述字段，title 允许空值。classes 只取首次标题及当前标题/删除状态，不把 snapshot 固化为教学内容或采用版本，符合 T50 当前对象链接。无需新端口或数据迁移。 |
| 完整读取链 | `classes/service.js:32` 是统一 reader，`:88` 新链接、`:109` 来源投影、`:131` 完整记录、`:293` 删除恢复响应、`:308` 反查均沿它读取。提案明确这些路径和工厂检查一起升级，保留链接的 labelAtLink 不重取，详情/列表/反查返回全部来源；不止切换选择器 URL。 |
| 事务及失败 | `classes/router.js` 的写操作经 createMutationHandler 进入 `workbench/mutations.js:87` 的同一同步事务，成功响应投影完成后才保存成功回执。v2 提供方同步且复用 db，可以在此事务读取；投影 404/503 抛错即回滚记录与回执。`classes/service.js:79` 不吞真实读取错误；新连 tombstone 409，保留关联可读/改文字/删除恢复，反查先确认归属再筛活动班级和记录。提案与原数学扩展生命周期一致。 |
| 旧成功重放 | `workbench/mutations.js:78-85` 在 write 回调前返回已存成功状态/结果，同键换方法/路径/体冲突；重放不重新读取来源。`classes/api.js` 的 decodeRecordRequest 保留旧请求原路径。提案不替换旧 questions 端口、不全局改旧客户端方法，保留 schema、版本冲突与不可表示性顺序；旧无 math 记录仍可表示，含 math 的旧路径仍拒绝。 |
| 目录 v3 | `packages/shared/src/moduleCatalog.js:46` 的 classes.requires 原三项只替换题目项，`:66` 已有 v2 映射，旧映射保留。原 ModuleDescriptorV3 枚举允许两种题目端口，ModuleCatalogV3.version 仍为 3。提供方仍是 questions，未加入反向服务端依赖。缺端口由 classes 工厂检查，缺模块/环/目录合法性沿原装配；必须以新目录目标验收，旧样本逐字段相等结论不外推。 |
| 选择/反馈/返回 | 固定 `classes/SourcePicker.jsx:39` 仅导航；现成 `FeedbackPanel.jsx` 导出 SourceRecordsPanel，`classes/api.js` 已走 v2 反查。提案要求挂到真实丰富题详情、跟随当前实际题目 ID、删除题可查、返回原记录完整现场。前端组合不要求给 questions 服务端注入 classes，保持依赖无环。 |
| 单写者交接 | 短包把 classes 前后端、questions 页面、目录及必要外壳导航交一个写者；共享测试/config 先明确固定文件写权，其他公共入口只有具体需要才交接。提供方违反已有契约时按归属回报，不能临时改协议。边界足以实施，启动仍须根交付真实新基线及停写后的唯一写权。 |

## 增量用例充分性

本表评价预期覆盖，七项均未在本轮运行产品。它们与原 TT-U3、WB-T003/017/018、WB-TM002/005-009 的受影响切片共同构成实施与后续独立验收边界。

| 用例 | 覆盖与结论 |
| --- | --- |
| WB-MTA001 | v1/v2/导入/复制混合题库、搜索选择取消、外账户隔离、草稿与显式保存、服务端首次标题，足以验证旧422主路径被接通。 |
| WB-MTA002 | 同 ID 丰富化、旧记录投影、保留链接改文字、删除恢复、刷新/保库重启、旧回执重放，覆盖持久数据和版本不变量。 |
| WB-MTA003 | 两班反馈、三类混合来源、真实丰富正文/答案、草稿/滚动/AI输入返回、题内切换及双视口，覆盖既定页面装配。 |
| WB-MTA004 | 成功 tombstone、真实404、503、新连/保留/移除重连、事务与回执回滚、重试/草稿、活动反馈过滤，覆盖失败和删除生命周期。 |
| WB-MTA005 | 丢响应、并发版本、原键原体原路径、跨路径冲突、401锁草稿和外账户404，覆盖身份与未知结果。 |
| WB-MTA006 | 旧 questions 无损拒绝、旧 classes 混合 math 拒绝、版本与重放优先级、新版完整读取及真实数学往返，覆盖双重兼容保护。 |
| WB-MTA007 | 唯一目录差异、缺端口失败、三种反查、日程 readRecord 不解析来源，覆盖装配和相邻摘要边界。 |

独立静态检查使用 Python 标准库直接读取 Git 对象，未保存临时脚本或安装依赖：固定 M43 全六模块目录与 T50 样本相等；在内存仅替换 classes.requires[0] 后，所有依赖名均在 v3 枚举、映射可解析且图无环；七个表行 ID 恰为 WB-MTA001-007，无重复。原 M40 schema 与 T50 绑定副本字节相等，SHA-256 为 `24c86aa6b5ca5d415df4469d29a1e63ffce906e888a30c14f977f24d7d4acfcb`。提案提交仅涉及契约覆盖层、短包、作者回执及 checks.txt 四个文件，未修改原契约/schema/产品。

## 限定冻结与实现可消费条件

冻结仅覆盖提案的消费者读取切换、classes 目录题目依赖替换和既定选择/反馈/往返装配，以及七个增量用例。材料正文、答案、原稿、文件、复制来源、备课快照和旧接口无损保护保持；原数学作品来源、真实 workId、教学当前对象链接、数学制作/导出/离线及目标设备门槛保持；教学时间、提醒、记录 schema 和原文保持。没有用本次静态 PASS 重签材料、数学或完整教学设计。

1. 根固定提案和本报告，并在 R33 独立通过的 `42b0cde` 补丁整合到 M43 后，另行指定**完整实现基线 SHA、集成清单及唯一写者**。该短 SHA 仅记录本次用户给定的整合上下文，本轮未读取或核验它。短包中的 `4b5c31e6e67543a2826f662ff07acc19a0de765f` 是本次失败/分析依据，不能据此覆盖根随后固定的实施基线。此接续规则不改契约，亦不要求重审无关整合。
2. 实现者在独立 main-based 分支和隔离数据副本消费新基线；公共目录、导航及需修改的共享测试由原写者停写后单写者接手。保留源库、旧回执与旧证据；先沿用户路径确认旧失败，再按七项完成 API/真实浏览器自验及保库重启。零产品模型请求，真实数学提供方不能以占位作品替代。
3. 新固定候选 self 后，由根指定独立验收真实复跑上述接缝，实际通过才关闭 M43 题目关联 OPEN。原 M44 仍受测 `4b5c31e6e67543a2826f662ff07acc19a0de765f`，本提案及 R33 整合均不切换其输入；R35、完整 T51/T54/WB-T020 和目标设备门槛继续按各自固定边界处理。

无设计 CHANGES_REQUIRED 项；未完成的产品选择/反馈/往返归后续唯一实现者与指定独立验收，基线固定和写权交接归根。本报告提交后停写，外层负责唯一回调。

## 结构化回执

```yaml
task: MATERIALS-TEACHING-REVIEW@1
revision: 1
attempt: 1
role: acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-22T16:23:45Z"
session_id: unavailable
runner: "Codex / gpt-6-astra / medium；未调用 dsh 或自动降级"
skills_used: [writing-for-agents]
base_revision: "f68fa6fd29499151c165c011630525f4b761c681"
candidate_revision: "1a60db5a16860f5e411c59a3d4a7f4fdc17b751a"
result_revision: "本报告所在提交 + docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/review.md；完整 SHA 由最终交回固定"
branch: review/materials-teaching-contract-attempt-1
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs: "本文固定输入表的完整 SHA 与路径"
changed_files: [docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/review.md]
artifacts: [docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/review.md]
checks:
  - "固定实现与冻结契约的 v2 投影、事务、删除/反查、旧成功重放静态核对：PASS"
  - "目录样本、单依赖替换、v3 枚举/映射/无环与七个唯一用例 ID：PASS"
  - "原数学 schema 字节相等、材料无损保护与旧固定验收边界：PASS"
  - "七个增量预期及唯一写者交接可消费性：PASS"
  - "git diff --check、唯一报告写入及 main-based 分支检查：PASS"
identity_mode: "不适用：静态独立契约核验，未运行产品；real-auth 失败属于固定 M43 输入"
must_fix: []
open_items:
  - "根另行固定 R33 补丁整合后的真实实现基线及单写者交接"
  - "新候选完成 self 和独立实测前，M43 题目关联 OPEN 保持"
  - "M44 仍固定旧 4b5c31e，完整阶段与目标设备门槛不由本报告放行"
failure_owner: null
next_condition: "根携提案及本报告固定 SHA，指定新实现基线/唯一写者；新候选按 WB-MTA001-007 自验后独立复验"
authorization_used: "本轮用户 MATERIALS-TEACHING-REVIEW@1 attempt 1：仅独立契约核验及本报告提交；零产品模型请求/密钥读取，无扩派、业务联系、合 main、push、部署；外层唯一回调"
```
