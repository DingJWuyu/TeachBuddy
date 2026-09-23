# Teaching-time 契约用例

教学时间 v1 验收规格。字段只见 [OpenAPI](teaching-time.openapi.yaml)，下列是独立前后端可重放的交换预期，不是已跑过的产品测试。机器样本见 [samples.json](samples.json)，每项注明 schema 和是否应接受；语义条件仍按本页与[契约入口](../teaching-time.md)验证，JSON Schema 通过不代表跨字段/业务通过。

## 固定数据与执行方法

服务端测试时钟初始 `2026-09-21T06:00:00Z`，账户 A 时区 Asia/Shanghai；B 是另一个可信测试账户。B16 runner 建立不同 Cookie jar，不由请求提交账户。以 B11 createLesson/createQuestion 在 A 建“函数单调性”及一道例题，测试记录真实返回的 ID；下面样本使用固定 UUID 仅供同版替身，真实测试按 fixture 的 ID 映射代入。

| 代号 | 样本 ID |
| --- | --- |
| C1 高一(1)班 | `10000000-0000-4000-8000-000000000001` |
| C2 高一(2)班 | `10000000-0000-4000-8000-000000000002` |
| L1 函数单调性 | `20000000-0000-4000-8000-000000000001` |
| Q1 例题 | `20000000-0000-4000-8000-000000000002` |
| R1 一班实际记录 | `30000000-0000-4000-8000-000000000001` |
| E1 备课时间段 | `40000000-0000-4000-8000-000000000001` |
| I1 选例题 / I2 印讲义 | `50000000-0000-4000-8000-000000000001` / `50000000-0000-4000-8000-000000000002` |

写请求都加唯一 UUID Idempotency-Key、B11 固定保护头、同源 Origin/Referer 与当前 Cookie，JSON Content-Type。应答 no-store。前端替身必须按明确场景返回完整匹配 JSON 或 Problem，后端用同一输入经真实 HTTP/重启查询，不能直接写仓储来代替操作。

## TT-C1 一句话、两班反馈与删源（WB-T001 至 004、019）

1. POST `/api/modules/classes/items`，`{"name":"高一(1)班"}` -> 201 Class，C1/version=1；GET items -> items 包含 C1。改名用 ClassUpdate/expectedVersion=1 -> version=2；重复名允许，空白名 422 invalid-input、field=/name。班级删除/恢复分别 POST deletion，携当时版本与 deleted，均返回同 ID 和递增版本。
2. POST `/api/modules/classes/records` 用样本 `record-create` -> 201 Record，R1/version=1，来源标签与删除态由服务器解析；本样本只连 L1，一个来源。无链接的 `record-quick` 同样成功，不要求 position。
3. PUT records/R1 用完整 RecordUpdate，expectedVersion=1，补 position=“定义讲完”、unfinished=“例2”、commonIssues=“忽略任意性”、nextNote=“下节先辨析反例” -> version=2。GET records?classId=C1 -> 同文字。为 C2 写另一条关联 L1 的记录，C1 列表不含它。
4. GET source-records/lesson/L1 -> 两条真实记录；前端按 classId 关联班级名并显示独立日期。点记录进入 C1/R1 后返回恢复备课草稿。不把反馈写入 L1 正文或改它 version。
5. 用 B11 更新/删除 L1；GET R1 保持 labelAtLink=“函数单调性”，currentLabel 为当前标题，deleted=true 时仍保留 note。原链接不变的 PUT 可成功；新记录试图添加已删 L1 -> 409 reference-deleted。另一账户 L1 或不存在 ID -> 404，不暴露当前版本。
6. 删除 C1，记录保留；编辑其记录 -> 409 object-deleted，反向活动反馈仅剩 C2。恢复 C1 后 R1 原 ID/版本/源关联仍在；单独已删记录仍需单独恢复。

公共端口替身：classes.readClass(A,C1) 返回 ClassReference；readRecord(A,R1) 返回 classId=C1、classDeletedAt=null、deletedAt=null 的 RecordReference；外账户调用统一 404。删班后 readRecord 仍返回但 classDeletedAt 非空。T52 必须分别覆盖这些结果，不把 tombstone 当新可选项。

<a id="tt-c2"></a>
## TT-C2 记事、安排、顺序与原子移动（WB-T005 至 008）

1. POST schedule/entries 用 `unscheduled-create` -> 201，time/repeat/reminder=null；GET entries?placement=unscheduled 返回该 Entry。刷新/重启保留 I1。
2. PUT 此 Entry，设 date=2026-09-21、startTime=15:00、timeZone=Asia/Shanghai、durationMinutes=90，repeat=null，course 三项为空、reminder=null -> 200 Entry。GET occurrences?from=2026-09-21&to=2026-10-01 -> E1 startsAt=07:00Z、endsAt=08:30Z，key.originDate=null（完整日期前缀同当天）。
3. PUT 加 I2(high)，I1(normal)，数组 `[I1,I2]` -> 段内仍先 I1，优先视图先 I2。再 PUT `[I2,I1]` -> 优先级不变。事项 text 纯空白、重复 item ID、空标题且空 items -> 422 invalid-input。
4. moveItem `{itemId:I2,fromEntryId:E1,fromVersion:当前,toEntryId:null,toVersion:null,toIndex:0}` -> MoveResult，from 只剩 I1 且 version+1，to 为新未排期 Entry/version=1、只含 I2、high。相同键原体重放不得创建第二个目标。
5. 向已有目标移动，若目标 version 已变 -> 409 version-conflict，objectId 为目标，from/to 都不变。目标已有同一 itemId、索引越界 -> 422 invalid-input；重复系列参与或同源目标 -> 409 invalid-move。HTTP 掉线保留原请求，恢复后同键确认一次。
6. 日期范围是前端行为：from=2026-09-21、to=2026-10-01 共11日；from>to -> 422 invalid-input、field=/query/from、reason=out-of-range；改变范围不切 AI/丢草稿，拖选才切工具。
7. 对样本 `entry-create` 的 `items[0]`、`time`、`repeat`、`course`、`reminder` 分别加入 `unexpected=true`，对应机器样本为 `reject-entry-items-unknown`、`reject-entry-time-unknown`、`reject-entry-repeat-unknown`、`reject-entry-course-unknown`、`reject-entry-reminder-unknown`。创建请求均返回 `422 invalid-input`、对应嵌套 JSON Pointer 和 `reason=unknown-field`，不落库。`EntryUpdate` 使用同一组严格请求 schema，机器样本 `reject-entry-update-items-unknown`、`reject-entry-update-time-unknown`、`reject-entry-update-repeat-unknown`、`reject-entry-update-course-unknown`、`reject-entry-update-reminder-unknown` 分别复跑；`Override` 的 `items`、`course`、`reminder` 反例为 `reject-override-items-unknown`、`reject-override-course-unknown`、`reject-override-reminder-unknown`，也必须返回相同拒绝。

## TT-C3 周重复、例外、日期与时区（WB-T009 至 011）

创建每周一 E1：time=2026-09-21 15:00、90分钟、Asia/Shanghai，until=2026-10-05，课程 classId=C1、lessonId=L1、recordIds=[]。实例原始日期为 09-21、09-28、10-05。

- PUT entries/E1/exceptions/2026-09-28，expectedVersion=1、mode=override、完整 content 的 time 改为 2026-09-29 16:00（90分钟） -> 200 Occurrence，key 仍是 E1/09-28，entryVersion=2，startsAt=`2026-09-29T08:00:00Z`、endsAt=`2026-09-29T09:30:00Z`。GET 仅09-29也返回它；GET 仅09-28不再返回它。其余两周时间不变。
- 整组 PUT version=2，startTime 改14:00 -> version=3；09-28例外仍为09-29 16:00。缩短 until=09-21 -> 例外列表保留09-28、eligible=false；单实例返回 outside-series，区间查询不返回；再延长到10-05恢复它，提醒从重新可见时刻生效。
- mode=cancelled -> 区间不再出现，单实例 state=cancelled、返回当前模板内容；mode=inherit -> 恢复当前模板原日期/时间，exception=false。每次操作都用最新 Entry 版本并使它加1。普通实例被删整组后 state=deleted。
- 请求 originDate=09-22 -> 404；重复详情漏 originDate、非重复带 originDate -> 422 invalid-input。调整首日/时区、把已存非重复改重复 -> 409 immutable-series。未排期首次排时间允许改变 date/timeZone；一旦已保存为有时间，非重复仍可自由改 date/timeZone（不可改成重复），固定首日/时区只约束重复模板。
- 跨午夜：上海 2026-09-27 23:30 持续120分钟 -> start=`2026-09-27T15:30:00Z`、end=`2026-09-27T17:30:00Z`；09-27与09-28都返回同一个 key。上海09-28 00:00结束的段只属于09-27。零时长、非法02-30、to超2100 -> 422。
- DST 样本（开始时关闭提醒）：America/New_York，2026-03-01 02:30持续60分钟、周重复至03-08；03-01 start=`07:30Z`，03-08缺失02:30移至03:30，start=`07:30Z`、end=`08:30Z`、timeAdjusted=true。2026-11-01 01:30取较早偏移，start=`05:30Z`，60分钟后end=`06:30Z`。
- GET/PUT settings：初始 Asia/Shanghai/version=1，改 America/New_York/expectedVersion=1 -> version=2。已有上海排课 startsAt 不变；范围边界与显示改用纽约时间；记录 recordedOn 不变。设置错版本 ->409/currentVersion，非法时区 ->422 invalid-time-zone、field=/timeZone。

<a id="tt-c4"></a>
## TT-C4 到期、修改、清空和重启（WB-T012 至 016）

测试时钟/停服由测试进程控制，不开放生产改时钟端点。每个分支从独立 fixture 重置，除明确重启外不 reset 库。

| 前置/动作 | 精确结果 |
| --- | --- |
| 14:00创建E1，15:00-16:30，提醒before10；16:19:59查询 | 通知为空；dueAt=`2026-09-21T08:20:00Z` |
| 16:20查询两次，并发开两个页面再查询 | 一条通知、同 ID，readAt=null；唯一键 E1/null |
| 16:00把结束改17:00 | 16:20无通知，16:50一条；改动后的 dueAt=`08:50Z` |
| 14:00创建，无页面打开，16:25把结束改17:00 | beforeChange先持久存原16:20通知；16:50不再创建第二条；点击定位当前17:00结束的段 |
| 创建时改用after20 | dueAt=`08:50Z`；未设提醒的相同段永不生成 |
| 16:00删除/取消本次 | 16:20不生成；16:30之后恢复不补发旧提醒；改到未来才有首次通知资格 |
| 16:25删除、此前从未查询 | 原16:20通知仍生成，点击显示已删除，不跳到别的日期；可恢复原ID |
| 某周已到期后缩短整组until，使该周超出范围，且该周无例外 | 原通知保留；单实例GET返回outside-series，UI可打开整组；不因无例外行而404 |
| 到期前关闭浏览器且停止API，17:00保留库启动 | 首次通知查询补出16:20，非17:00；再重启/重进总数仍1 |
| 单次例外从09-28调到09-29 16:00-17:30、before10 | 09-28无提醒；09-29 17:20生成，key仍E1/09-28；其他周独立各最多1条 |
| POST notifications/id action=read，随后再次read | readAt取第一次提交时钟并保持；不改安排/记录版本、不划完成线 |
| POST notification-actions，ids为当前显示集合、action=dismiss | 对应列表项消失；未来轮询/重启不再生成，安排不变；新到期而不在ids中的通知仍显示 |
| 首次新设提醒的非重复 dueAt<=now | 422 reminder-not-future、field=/reminder，整个写入不落库；重复只对新生效未来实例适用 |

恢复操作本身允许恢复过去配置而保持安静，不按“新设过去提醒”拒绝整个恢复。普通编辑允许保留未变化的过去配置；显式新设/修改为过去提醒仍拒绝，即使以前发过。改到未来可以保存，但若已有通知仍不生成第二条。T52校验无需读取通知表或接收sent标志；通知唯一性由T53负责。

提醒标题投影固定用 `reminder-title-fallback-entry`：`title` 只有空白，首项事项文字为 301 个 Unicode code point。创建/更新返回的 Entry 保留原始标题和事项；`listReminderCandidates` 返回 `reminder-title-fallback-candidate` 的 300 个 code point 标题，T53 到期入库返回 `reminder-title-fallback-notification` 的相同标题。投影取首项事项去首尾空白后的前 300 个 code point，不追加省略号；Candidate 与 Notification 必须逐字相同。

## TT-C5 关联回写和失败（WB-T004、017、018）

T52 用同版 classes/lessons 替身验证：course.classId=C1、lessonId=L1、recordIds=[R1] 成功；R1属于C2 ->409 class-mismatch；新连被删对象 ->409 reference-deleted；外账户任一ID ->404，整个 Entry 不变。重复模板带recordIds ->422 invalid-input；在一次例外 content 中可连。

老师从某次课程进入快记，createRecord 已成功；随后 setException/updateEntry 关联记录故障。UI 显示“记录已保存，尚未关联到安排”，持有 R1，在恢复连接后仅重试第二步。R1 的来源可含 L1，不要求反向修改 L1。T53用真实两个模块重跑，T54从UI确认双向返回。

对任一写操作：先成功落库再丢弃应答 -> 客户端结果未确认、保留原键原体；服务重启后同键重试返回原成功，GET取得当前对象，只有一次版本推进。相同键换字段 ->409 idempotency-key-reused。不同设备旧版本 ->409 version-conflict；不得自动覆盖。401保留原账户草稿，切B不可见，旧A响应不得回填B。缺保护头/异源403；无身份401；外账户对象404；JSON损坏400；媒体类型错误415；过大413；存储回滚503且不误报已保存。

## TT-C6 作品接入（WB-T020）

`teaching-time.openapi.yaml` 的记录 v1 `SourceInput` 只接受 lesson/question；work、math、resource 或未知 blob 字段均为 422。当前记录 v2 的 `SourceInputV2` 已支持 kind=math，见[数学关联与兼容契约](../teaching-time-math.md)和[对应场景](math-cases.md)；work/resource 仍不受支持。验证需同时覆盖 v1 拒绝、v2 真实作品选择/保存/删源/双向回看和旧键确认。已有局部接线不等于 WB-T020 全范围通过，替身及 schema 样本也不能代签。

<a id="tt-c7"></a>
## TT-C7 静态目录 v2 校验

本组仅验证教学基础目录 v2 的固定输入。当前六模块组合返回 v3，见[目录版本](../teaching-time.md#静态目录-v2-与当前-v3)，不使用下述四模块样本断言当前运行响应。

在该 v2 fixture 中，`GET /api/modules` 成功返回样本 `catalog-v2`，状态 200，响应为 `version=2` 且 `items` 顺序严格为 `questions`、`lessons`、`classes`、`schedule`；四项完整 descriptor 的 `name`、`path`、`navigation`、`auxiliaryPanel` 和 `requires` 逐项按样本比对。该响应是 v2，不能返回 B11 v1 的 `{items: []}` 形状。

T53 对同一静态输入先校验再投影。以下变体都通过 `ModuleCatalogV2` 的单对象 JSON Schema 形状检查，但必须由目录校验器拒绝；拒绝不启动/不暴露部分目录，固定返回 `422 invalid-input`：

| 变体 | 固定改动 | 预期 Problem |
| --- | --- | --- |
| `catalog-v2-reject-duplicate-id` | 将 `items[2].id` 从 `classes` 改为 `questions` | `field=/items/2/id`、`reason=duplicate-id` |
| `catalog-v2-reject-duplicate-path` | 将 `items[3].path` 从 `/calendar` 改为 `/lessons` | `field=/items/3/path`、`reason=duplicate-id` |
| `catalog-v2-reject-missing-dependency` | 将 `items[0].id/path` 改为 `other`/`/other`，保留 `items[1].requires[0]=questions.readForReference` | `field=/items/1/requires/0`、`reason=invalid-reference` |
| `catalog-v2-reject-cycle` | 将 `items[1].requires` 改为 `[classes.readClass]`，保留 classes 对 lessons 的依赖 | `field=/items`、`reason=invalid-reference` |

重复检查按 descriptor 原顺序返回第一个确定错误；缺依赖指向无法解析的 requires 项；依赖环指向目录根。未知 descriptor 字段仍属于响应加法兼容，不因本校验而拒绝未来响应字段。

## 两侧独立检查

前端：以样本替身逐个触发成功/已删/409/401/503/丢响应，核对请求体、保留现场、恢复动作；port替身不得加入schema不存在字段。后端：经相同HTTP输入断言schema、事务、归属、版本、顺序和重启；时间用固定clock但通过公共操作读结果。所有纯客户端行为另按UX/BDD走浏览器，不为范围选择或滚动增加接口。数学边界、真实B16/真实身份与实机条件在回执分开列出。
