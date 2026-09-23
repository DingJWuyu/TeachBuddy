# 教学、日程与提醒接缝

业务规则见[教学契约](../contracts/teaching-time.md)。当前 classes 使用新版题目读取及 math 端口，具体扩展见[材料教学接缝](../contracts/materials-teaching-alignment.md)和[数学关联](../contracts/teaching-time-math.md)。

## 模块与 Interface

classes Module 吸收班级、实际记录、资料链接与反向反馈；schedule Module 吸收日期、周重复/例外和事项移动。reminders 是 schedule 内由 T53 实现的子目录，不注册第七个模块。两模块的 Interface 对浏览器为 OpenAPI 操作，对中立业务调用者为相同操作；未来 Agent 不另写 SQL。计算复杂度留在 schedule，调用者拿真实实例，不在 T51/T53 各做一套日期算法。

同步公共端口均接收 B11 的 `principal`，无权/不存在抛 `{status, problem}` Error。返回形状用 OpenAPI 同名 schema；写事务内不网络请求、不返回 Promise。模块不读其他模块仓储/表。

| 公共 Interface | 输入 / 返回 | 写者与消费者 |
| --- | --- | --- |
| `classes.readClass(principal, id)` | `ClassReference`；允许本账户 tombstone | T51 提供；T52/T53 消费 |
| `classes.readRecord(principal, id)` | `RecordReference`；label 取 note，否则按 position/unfinished/commonIssues/nextNote 首个非空项，截前300个 Unicode 字符；包含 classDeletedAt | T51 提供；T52/T53 消费 |
| `classes.listSourceRecords(principal, {kind,id})` | `RecordList`；语义同 HTTP 操作 | T51 提供；T53 接题库/备课反向反馈 |
| `questions.readForReferenceV2(principal, id)` | 材料端口；仅取标题/归属/删除态，记录不保存题面快照 | B11 提供；T51 消费 |
| `lessons.readForTeachingLink(principal, id)` | `LessonReference`；标题/版本/删除态，允许本账户 tombstone | T53 最小提供方扩展；T51/T52 消费 |
| `schedule.readOccurrence(principal, {entryId,originDate})` | `Occurrence`，无时间/无权/不符合原始周节律 404；符合节律但超出until返回outside-series | T52 提供；T53 通知定位 |
| `schedule.listReminderCandidates(principal, now)` | `ReminderCandidate[]`；只返回当前活动实例 `armedAt < dueAt <= now`，按 dueAt、entryId、originDate 升序 | T52 提供；T53 结算；只读投影不写通知 |
| `reminders.captureDue(principal, now)` | 同步，无返回；取上一个端口并以唯一键插入；异常随调用事务回滚 | T53 提供；注入 T52 的 beforeChange |

工厂 `createClassesModule({db,mutations,questions,lessons,math}) -> {router,port}` 和 `createScheduleModule({db,mutations,classes,lessons,beforeChange,clock}) -> {router,port}`，路由分别挂到 `/api/modules/classes`、`/api/modules/schedule`。`clock.now()` 返回 UTC ISO Z，生产注入系统时钟，测试进程可固定；请求不得提交 now。`beforeChange(principal,now)` 是同步函数，T52 每次逻辑安排写入（含例外、删除/恢复和移动）在归属/版本/领域校验通过后、实际变更前调用一次，处于同一个 mutations 事务；幂等重放不再调用。

T53 工厂 `createReminders({db,mutations,schedule,clock}) -> {router,captureDue}`。组合入口先以闭包 `(...args) => reminders.captureDue(...args)` 构造 schedule，再构造 reminders，最后才挂载路由；工厂构造不得执行业务调用。这只是同一个 schedule Module 内组合，不新增目录依赖环。T52 独立 fixture 显式注入记录调用的 beforeChange；正式组合缺依赖必须启动失败，不给生产默认 no-op。

通知 GET 使用一个短事务结算再读列表；read/dismiss 走 mutations 并在同一事务结算。同键插入采用唯一约束，已存在则保持 dueAt/title/readAt/dismissedAt。已读与清空不增加 schedule.version；schedule 不导入 reminders 存储。通知查询/点击所需 HTTP 在 schedule 路径下，由 T53 router 挂载。

## 持久数据

| 所有者 | 数据/不变量 |
| --- | --- |
| T51 classes | classes、records、record-source links（或聚合 JSON），可信账户、稳定 ID/version、日期、原文、保存时标题、软删除。反向索引完全由本模块维护。 |
| T52 schedule | 账户显示时区/version；Entry 聚合；按 entryId+originDate 唯一的完整例外/取消；reminder armedAt。保存前后时间规则由一个实现计算；隐藏例外重新可见时更新生效点。 |
| T53 reminders | 每账户+实例唯一的通知，稳定通知 ID、原定 dueAt、生成时标题、readAt、dismissedAt；生成时间可内部保存但不冒充 dueAt。 |
| B11 mutations | 幂等请求及持久成功结果，与上述业务写入同一 SQLite 事务。 |
| Web 所属 feature | 账户分区的本地草稿/现场/未确认请求；不上传未保存输入，不与其他账户共享。 |

不提前生成整个重复系列的实体行。查询时展开每周原始日期并应用例外，再按实际区间筛选；必须额外检查移入范围的例外，不能只生成原日期在范围内的周。提醒展开从最早有效生效点至 now 对应的必要原始日期（需考虑前/后偏移和跨日）；保留 ID 稳定性。无需时间游标、后台 checkpoint 或重放日志。删除/恢复保留原始 ID、例外和通知唯一痕迹；没有永久删除接口。

迁移 ID 使用 `classes_`、`schedule_`、`schedule_reminders_` 前缀，各自只增。模块导出 B11 `{id,up(db)}` migrations；T53 汇总。空库与 B16 旧库都验证，原题目/备课/账户/布局不变。整体备份须包含三者表及 B11 幂等数据；维护备份入口见数据管理规格。

## Interface 与持久化

classes Module 吸收来源联合与全部兼容保护，消费者不各写一套判断。工厂在原参数上显式增加 `math`，通过同步 `math.readForTeachingLinkV1(principal,id)` 获取 `TeachingWork`。依赖必须与 classes 使用同一数据库/事务连接；正式启用 v2 时缺端口即启动失败，无生产 no-op 或字符串目录。T51 的同版 adapter 只供隔离自验，回执单列替身。

| Interface | 结果与归属 |
| --- | --- |
| v2 records HTTP/中立业务操作 | schema 的六个 v2 operationId；classes 独占保存、来源标签、版本、幂等及删除恢复 |
| `classes.listSourceRecordsV2(principal,{kind,id})` | 同步 RecordListV2，与 v2 HTTP 同语义；T51 提供 |
| `classes.listSourceRecords` | 保留旧联合与可表示性守卫；新反馈组件升级到 v2 |
| `classes.readClass/readRecord` | 原 ClassReference/RecordReference；readRecord 不解析完整 sources、不调用 math，故作品服务故障不阻断日程读取摘要 |
| `math.readForTeachingLinkV1` | math 提供；前端可经组合层共用，classes 只读该 Interface，不读 math 表或 HTTP 回环 |

教学来源仍存 `kind/id/labelAtLink`，原可信账户、记录 ID/version/时间、数组顺序及软删除不变；currentLabel/deleted 按公开读取派生。新增 kind 的约束/索引迁移归 classes，使用新的 `classes_` 前缀迁移；不改旧迁移、不另建关联平台、不保存 workVersion/源码/文件快照。若旧表约束需要重建，逐条保留旧链接、顺序与首次标题。账户+record+kind+id 唯一，反向查询使用本模块数据。

新旧路由共用聚合和账户幂等账本。旧成功响应原样留存，不补 math、不迁移键绑定路径、不改成功回执；空库和含旧记录/未知请求的 T51/T53 库都要验证升级重启。v2 纯读不批量写旧行。读取旧混合记录的防丢守卫与 v2 事务校验在 classes 内实现，schedule 不学习 SourceV2。

提供方 503 在整个写事务内回滚；成功提交后响应丢失按原键原体确认。来源删除和添加记录的先后由同一同步事务串行化：先删则新链接拒绝，先保存则随后显示 tombstone。没有跨模块事件广播、级联删除或异步补关联。
