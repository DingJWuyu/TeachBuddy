# 材料与教学题目关联接缝

`MATERIALS-TEACHING-ALIGNMENT@1 / attempt 1`，提案，`READY_FOR_LIMITED_FREEZE / self`。本页只覆盖丰富题目进入教学记录的接缝，须由根决定限定冻结后实施。实现与独立复验入口见[实施短包](../plans/tasks/materials-teaching-alignment.md)，作者判断及固定证据见[回执](../acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/author.md)。

## 用户结果与裁决

作为老师，我希望从自己的题库选题关联教学记录，以便打开当前题目、返回原记录，并从题目查看各班反馈。选择器沿用现有题目页签、搜索和勾选；确定只更新草稿，显式保存才建立关联。来源打开 `/questions/:id` 的真实丰富题目页，返回原 `/classes/:classId/records/:recordId`，保留文字、日期、展开项、滚动和 AI 输入。反馈入口复用 classes 的记录组件，按班级和日期辨认记录。范围依据为 [PRODUCT_SCOPE 第5节](../PRODUCT_SCOPE.md#5-班级教学)、[WORKBENCH_DESIGN 第7节](../WORKBENCH_DESIGN.md#7-班级教学)及固定 T50 的 TT-U3、WB-T003。

**结论：存在一个公共消费者契约缺口，不能把整件事判为实现接错。** 材料已规定新版列表和读取端口，旧端口拒绝丰富内容是正确保护；但 T50 明定 classes 使用旧题目端口，T50 数学扩展和 M40 目录继续保留此依赖。必须限定修订教学消费者依赖，才能完整接通保存、记录读取和反查。仅换选择器 URL 不足以关闭失败。

| 判定 | 固定 Git 事实 | 责任 |
| --- | --- | --- |
| 真实失败 | M43 的 `question-link-open.json`：真实认证浏览器班级题目选择器请求 `/api/modules/questions/items`，422，`field=/body/version`、`reason=unsupported-content-version` | 复现证据沿用 M43；本设计未重跑产品 |
| 新版能力已冻结 | 材料 `materials.md`“B11 兼容与版本过渡”规定旧列表遇不可表示对象整次拒绝；新列表 `/api/modules/questions/v2/items` 与 `readForReferenceV2` 可无损读取 | questions 提供方保留旧拒绝，提供方无需新端口 |
| 消费者约定未升级 | T50 `arch/teaching-time.md`公共端口表和 `contracts/teaching-time.md`末段仍指定 `questions.readForReference`；数学扩展的 `math-samples.json`全模块目录也保留该值 | 教学设计拥有者，本页限定修订 |
| 保存和读回也受影响 | 产品 `classes/index.js:16`工厂检查旧端口，`classes/service.js:32`以旧端口统一解析新链接、来源投影及反查；`questions/service.js:243`读取经过 `snapshotOf` 的旧内容守卫 | classes 实现者在冻结后升级整个读取链，不只修 UI |
| 往返和反馈属既定行为 | 产品 `classes/SourcePicker.jsx:39`仅导航；`questions/index.jsx`挂新版 `MaterialsQuestionsPage`；整个 Web 的 `SourceRecordsPanel`实际挂载只在 math，题库未挂 | 本接缝唯一实现/装配者补题目反馈与往返；这是静态发现，运行验收待做 |

以上路径的完整 SHA 由[回执固定输入表](../acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/author.md#固定输入)绑定。证据类型区分浏览器既有观察与本次静态判断，不将源码推断写成新 E2E 结果。

## 最小兼容修订

本节是相对固定材料/T50/数学扩展的唯一语义增量，未提及内容仍由原契约拥有。无新增 HTTP 操作、字段、来源 kind、内容版本或数据库迁移。

| 消费位置 | 本提案的确定调用和结果 |
| --- | --- |
| 教学题目选择器 | `GET /api/modules/questions/v2/items?q=…&state=active`，操作 `listQuestionsV2`，响应沿材料 `QuestionList`。显示本账户全部匹配题，包括 Document v1/v2、导入来源和复制来源；不按旧端口可表示性筛除题。请求失败显示重试并保留已选项，不显示空题库。 |
| classes 的题目读取 | 同步 `questions.readForReferenceV2(principal,id)`，返回材料 `ReferenceReadQuestion`。工厂要求该端口，与 classes 使用同一 DB/事务连接；缺端口即装配失败，不能回退旧端口或访问 questions 内部仓储。新建关联、保留关联的响应投影、详情、列表、删除恢复响应及反查归属确认均使用它。 |
| 来源投影 | 读取 `id/version/deletedAt/snapshot.title`；标题处理沿 T50，首次标题由服务器取得。同一 kind/id 保留原 `labelAtLink`；`currentLabel/deleted`按当前来源派生。返回中其余 snapshot 内容不写入记录，也不作为快照版本承诺。 |
| classes HTTP 与反向端口 | 新 Web 继续使用现有 classes v2 全套记录操作及 `listSourceRecordsV2`。旧 classes 路径也共用上述题目读取；无 math 的记录仍是旧 schema 可表示的链接，即使题目正文已变丰富。含 math 的旧读写守卫仍按 T50 数学扩展拒绝有损表示。 |
| 题目打开和反馈 | 使用现有材料 `getQuestionV2` 与丰富内容阅读器；真实题目详情装配 `SourceRecordsPanel(kind=question,id=当前已保存题目ID)`，消费 classes v2 反查。只读删除题仍可查看反馈。题目页内部切题时反馈跟随当前实际题目，不只跟随可能滞后的 URL。 |
| 其他来源 | 备课保持 `lessons.readForTeachingLink`，选择器保持集成候选的 lessons v3；math 保持 `readForTeachingLinkV1`、真实作品 ID、当前对象链接及原反馈。 |

题目 ID、正文/答案/原稿定位/复制来源/文件、业务 version、笔记、教学记录原文和首次标题均保留。纯读不写回旧行、不增加版本，不复制出“教学专用题”。老师只改教学文字不能重写题目；题目更新不能重写教学记录。标题投影不是内容降级，题目正文始终由题库的 v2 路径无损打开。

旧 questions HTTP、`questions.readForReference`及旧 lessons 请求的成功重放和不可表示性保护全部保留。不要把旧端口改名为 v2 的别名，也不要全局替换旧客户端方法，使未知旧写入改走新路径。classes 的旧成功键仍在原方法/路径按原键原体重放，随后读取 v2 当前记录；schema、版本冲突与账户隔离顺序沿冻结契约。

### 单一目录的限定修订

在采用本提案的新组合中，classes descriptor 的 `requires` 精确为：

```json
["questions.readForReferenceV2", "lessons.readForTeachingLink", "math.readForTeachingLinkV1"]
```

只替换旧目录 classes.requires 的题目项。仍使用 `ModuleCatalogV3`、`version=3`、原模块顺序与实际注册子集；名称、路径、其余依赖和 `modulePorts` 映射保持。v3 schema 已同时允许两个题目端口名，所需映射已存在，因此无需新目录 schema/version 或新能力发现层。保留旧映射供原调用方使用。classes 缺新版端口或缺提供方、重复 ID/path、依赖环仍阻止装配。

这是**冻结依赖语义及目录目标值的变更**，即使 schema 不变也必须限定冻结。新组合的目录样本相对旧全六模块样本仅该项不同，旧“与 M40 样本逐字段相等”的结论不适用于它。固定 M40、T50 输入副本和独立报告保持原字节；本页作为明确覆盖层，不修改旧样本来掩盖差异。

## 必要成功、失败与恢复用例

以下 `WB-MTA001-007` 是本接缝的增量验收清单，Given/When/Then 为预期，**本次均未执行产品验证**。沿用原 TT-U3、WB-T003/017/018 与 WB-TM002/005-009，不复制完整教学或材料验收套件。

| ID | Given / When | Then 与关闭证据 |
| --- | --- | --- |
| WB-MTA001 混合题库选择 | Given 同账户有 v1 手工题、v2 图片/表格/选项和公式题、已确认导入题及丰富复制题；另一账户有同名题。When 从班级记录进入题目页签搜索、勾选、取消，再确定并保存。 | GET v2 成功且匹配项完整、外账户不可见；取消不写库，确定仅草稿变化，保存只新增/更新一条记录。网络证据确认不再调用旧 questions/items；记录来源只有 kind/id，首次标题由服务器取得。 |
| WB-MTA002 已有记录与保库 | Given 旧记录关联 v1 题且有旧成功回执。When 将同 ID 的题目正常编辑为丰富内容，读取记录、保留关联改文字、删除恢复记录，再刷新/保库重启。 | 题目未被降级；纯读保持记录 ID/version/updatedAt/原文/labelAtLink，当前标签反映题目。每次显式记录写只升一次版本；旧无 math 记录仍可由旧 classes 路径表示。DB 行、关联顺序与旧回执保持，旧成功重放不重新读取来源。 |
| WB-MTA003 来源往返与两班反馈 | Given 两班各自关联同一丰富题，原记录有未保存文字、滚动及 AI 输入。When 打开题目、从产品入口返回记录，并从题目反馈打开另一班记录。 | 原 ID 的丰富正文/答案/图片/表格/公式完整，题目未被打开动作保存；原记录现场恢复，两班文字不覆盖。当前题目详情反馈使用 v2，包含混合 question/lesson/math 来源完整记录；题内切换后不串题。桌面 1440×900、平板 768×1024 截图及操作证据，无遮挡/横溢出。 |
| WB-MTA004 删除与失败区分 | Given 已保存丰富题关联，另有选择后尚未保存的关联。When 来源软删除、恢复、移除后重连；分别让提供方返回成功 tombstone、真实 404、503。 | 保留链接允许读、改其他文字及记录删除恢复；新连删除题 409 reference-deleted，移除后重连按新链接判断。404/503使整次读取或写入失败，记录与成功回执原子回滚；不假删除、不假空反馈。草稿和已选项保留，可重试或显式移除异常来源。删班/删记录只影响活动反馈筛选。 |
| WB-MTA005 版本、身份与未知结果 | Given 关联丰富题的记录写入已提交但丢响应，或并发修改使 expectedVersion 过时。When 原键原体在原路径确认，或读取当前版本对照后新键保存；再测试无身份与外账户。 | 原请求只提交一次，后续草稿不被旧回执覆盖；409保留对照，401锁定当前账户草稿，外账户404且不泄漏题目/记录。相同成功键换路径仍409 idempotency-key-reused。 |
| WB-MTA006 旧协议保护 | Given 新题库含旧接口不可表示题，且一条 records v2 记录同时关联丰富题与真实 math。When 请求旧题目列表/详情/引用，及旧 classes 详情/匹配列表/反查/写；对照请求新版。 | 旧 questions 继续422 unsupported-content-version，不漏题、不删节点；旧 classes 因 math 继续按 /sources 或 /items 拒绝，过时版本先409、已成功键先原样重放。classes v2完整返回所有来源，题库v2无损读取，真实数学往返与反馈保留。 |
| WB-MTA007 目录与相邻摘要 | Given 新组合使用限定修订目录及真实 questions/lessons/math。When 校验依赖并访问三种来源的记录与反查，再调用日程所用 readRecord 摘要。 | 目录相对固定样本只变 classes 题目依赖，缺 readForReferenceV2 即失败且不回退。题目/备课/数学反查均返回完整记录；readRecord仍不解析完整来源，提供方故障不阻断原日程摘要。 |

## 沿用结论与停止点

材料的内容表达、文件、原稿、题目复制、备课快照、六输出和旧接口拒绝契约不变；T50 时间、重复、提醒、普通班级和记录 schema 不变；数学作品模型、制作/导出/离线与当前对象链接不变。对应固定候选上已经通过的结论继续限定于其原范围和原字节。

新组合必须补测上述链路、题目丰富阅读/保存、三类混合记录投影及目录装配，不能把原 self 或 independent 的 PASS 直接移到新候选。无理由重跑整套采集模型、Office 能力或提醒审查。M43 的题目关联 OPEN 在新候选独立实测通过前仍 OPEN。

M44 与 R35 当前独立验收继续各自固定旧候选。本提案不切换输入、不重命名旧证据、不代签完整 T51/T54/WB-T020 或材料/数学阶段 PASS。根先决定限定冻结；冻结后的唯一实现者交新固定候选及 self，再由根指定独立验收复跑受影响链路。当前作者在提交设计回执后停写。
