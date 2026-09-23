# 教学记录中的丰富题目

班级教学记录选择和读取题目时使用题库 v2 的无损接口。题目首次关联由服务端读取标题；打开题目时显示其当前丰富内容，返回后保留记录草稿与现场。来源更新或删除不改教学记录原文与首次标题。

## 读取与关联

| 消费位置 | 当前调用和结果 |
| --- | --- |
| 教学题目选择器 | `GET /api/modules/questions/v2/items?q=…&state=active`，操作 `listQuestionsV2`，响应沿材料 `QuestionList`。显示本账户全部匹配题，包括 Document v1/v2、导入来源和复制来源；不按旧端口可表示性筛除题。请求失败显示重试并保留已选项，不显示空题库。 |
| classes 的题目读取 | 同步 `questions.readForReferenceV2(principal,id)`，返回材料 `ReferenceReadQuestion`。工厂要求该端口，与 classes 使用同一 DB/事务连接；缺端口即装配失败，不能回退旧端口或访问 questions 内部仓储。新建关联、保留关联的响应投影、详情、列表、删除恢复响应及反查归属确认均使用它。 |
| 来源投影 | 读取 `id/version/deletedAt/snapshot.title`；标题处理沿 T50，首次标题由服务器取得。同一 kind/id 保留原 `labelAtLink`；`currentLabel/deleted`按当前来源派生。返回中其余 snapshot 内容不写入记录，也不作为快照版本承诺。 |
| classes HTTP 与反向端口 | 新 Web 继续使用现有 classes v2 全套记录操作及 `listSourceRecordsV2`。旧 classes 路径也共用上述题目读取；无 math 的记录仍是旧 schema 可表示的链接，即使题目正文已变丰富。含 math 的旧读写守卫仍按 T50 数学扩展拒绝有损表示。 |
| 题目打开和反馈 | 使用现有材料 `getQuestionV2` 与丰富内容阅读器；真实题目详情装配 `SourceRecordsPanel(kind=question,id=当前已保存题目ID)`，消费 classes v2 反查。只读删除题仍可查看反馈。题目页内部切题时反馈跟随当前实际题目，不只跟随可能滞后的 URL。 |
| 其他来源 | 备课保持 `lessons.readForTeachingLink`，选择器保持集成候选的 lessons v3；math 保持 `readForTeachingLinkV1`、真实作品 ID、当前对象链接及原反馈。 |

题目 ID、正文/答案/原稿定位/复制来源/文件、业务 version、笔记、教学记录原文和首次标题均保留。纯读不写回旧行、不增加版本，不复制出“教学专用题”。老师只改教学文字不能重写题目；题目更新不能重写教学记录。标题投影不是内容降级，题目正文始终由题库的 v2 路径无损打开。

旧 questions HTTP、`questions.readForReference`及旧 lessons 请求的成功重放和不可表示性保护全部保留。不要把旧端口改名为 v2 的别名，也不要全局替换旧客户端方法，使未知旧写入改走新路径。classes 的旧成功键仍在原方法/路径按原键原体重放，随后读取 v2 当前记录；schema、版本冲突与账户隔离顺序沿冻结契约。

### 模块目录依赖

在采用本契约的新组合中，classes descriptor 的 `requires` 精确为：

```json
["questions.readForReferenceV2", "lessons.readForTeachingLink", "math.readForTeachingLinkV1"]
```

只替换旧目录 classes.requires 的题目项。仍使用 `ModuleCatalogV3`、`version=3`、原模块顺序与实际注册子集；名称、路径、其余依赖和 `modulePorts` 映射保持。v3 schema 已同时允许两个题目端口名，所需映射已存在，因此无需新目录 schema/version 或新能力发现层。保留旧映射供原调用方使用。classes 缺新版端口或缺提供方、重复 ID/path、依赖环仍阻止装配。

## 必要成功、失败与恢复用例

以下 `WB-MTA001-007` 是本接缝的增量验收清单，Given/When/Then 为预期，按当前组合独立验证。沿用原 TT-U3、WB-T003/017/018 与 WB-TM002/005-009，不复制完整教学或材料验收套件。

| ID | Given / When | Then 与关闭证据 |
| --- | --- | --- |
| WB-MTA001 混合题库选择 | Given 同账户有 v1 手工题、v2 图片/表格/选项和公式题、已确认导入题及丰富复制题；另一账户有同名题。When 从班级记录进入题目页签搜索、勾选、取消，再确定并保存。 | GET v2 成功且匹配项完整、外账户不可见；取消不写库，确定仅草稿变化，保存只新增/更新一条记录。网络证据确认不再调用旧 questions/items；记录来源只有 kind/id，首次标题由服务器取得。 |
| WB-MTA002 已有记录与保库 | Given 旧记录关联 v1 题且有旧成功回执。When 将同 ID 的题目正常编辑为丰富内容，读取记录、保留关联改文字、删除恢复记录，再刷新/保库重启。 | 题目未被降级；纯读保持记录 ID/version/updatedAt/原文/labelAtLink，当前标签反映题目。每次显式记录写只升一次版本；旧无 math 记录仍可由旧 classes 路径表示。DB 行、关联顺序与旧回执保持，旧成功重放不重新读取来源。 |
| WB-MTA003 来源往返与两班反馈 | Given 两班各自关联同一丰富题，原记录有未保存文字、滚动及 AI 输入。When 打开题目、从产品入口返回记录，并从题目反馈打开另一班记录。 | 原 ID 的丰富正文/答案/图片/表格/公式完整，题目未被打开动作保存；原记录现场恢复，两班文字不覆盖。当前题目详情反馈使用 v2，包含混合 question/lesson/math 来源完整记录；题内切换后不串题。桌面 1440×900、平板 768×1024 截图及操作证据，无遮挡/横溢出。 |
| WB-MTA004 删除与失败区分 | Given 已保存丰富题关联，另有选择后尚未保存的关联。When 来源软删除、恢复、移除后重连；分别让提供方返回成功 tombstone、真实 404、503。 | 保留链接允许读、改其他文字及记录删除恢复；新连删除题 409 reference-deleted，移除后重连按新链接判断。404/503使整次读取或写入失败，记录与成功回执原子回滚；不假删除、不假空反馈。草稿和已选项保留，可重试或显式移除异常来源。删班/删记录只影响活动反馈筛选。 |
| WB-MTA005 版本、身份与未知结果 | Given 关联丰富题的记录写入已提交但丢响应，或并发修改使 expectedVersion 过时。When 原键原体在原路径确认，或读取当前版本对照后新键保存；再测试无身份与外账户。 | 原请求只提交一次，后续草稿不被旧回执覆盖；409保留对照，401锁定当前账户草稿，外账户404且不泄漏题目/记录。相同成功键换路径仍409 idempotency-key-reused。 |
| WB-MTA006 旧协议保护 | Given 新题库含旧接口不可表示题，且一条 records v2 记录同时关联丰富题与真实 math。When 请求旧题目列表/详情/引用，及旧 classes 详情/匹配列表/反查/写；对照请求新版。 | 旧 questions 继续422 unsupported-content-version，不漏题、不删节点；旧 classes 因 math 继续按 /sources 或 /items 拒绝，过时版本先409、已成功键先原样重放。classes v2完整返回所有来源，题库v2无损读取，真实数学往返与反馈保留。 |
| WB-MTA007 目录与相邻摘要 | Given 新组合使用限定修订目录及真实 questions/lessons/math。When 校验依赖并访问三种来源的记录与反查，再调用日程所用 readRecord 摘要。 | 目录相对固定样本只变 classes 题目依赖，缺 readForReferenceV2 即失败且不回退。题目/备课/数学反查均返回完整记录；readRecord仍不解析完整来源，提供方故障不阻断原日程摘要。 |
