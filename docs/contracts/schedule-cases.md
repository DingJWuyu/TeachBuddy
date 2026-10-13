# 日程契约用例

本页是可重放的交换预期，实际测试结果见[项目状态](../plans/run-state.md)。字段由[机器契约](../../apps/api/src/contracts/schedule-v1.openapi.yaml)拥有，业务语义见[日程契约](schedule.md)。

## 固定数据与执行方法

测试时钟初始 `2026-09-21T06:00:00Z`，账户 A 时区 Asia/Shanghai，B 为另一可信测试账户。通过公开 HTTP 创建安排及事项并映射真实 ID；固定机器样本见[基础样本](../../apps/api/test/fixtures/contracts/schedule-v1-samples.json)。写请求携账户 Cookie、同源保护头、JSON Content-Type 与唯一 Idempotency-Key，响应 no-store。除明确重启外保留当前库。

<a id="tt-c2"></a>
## TT-C2 记事、安排、顺序与原子移动（WB-T005 至 008）

1. POST schedule/entries 用 `unscheduled-create` -> 201，time/repeat/reminder=null；GET entries?placement=unscheduled 返回该 Entry。刷新/重启保留 I1。E1 表示同一安排，I1/I2 分别为“选例题”与“印讲义”的稳定事项 ID，均由本场景公开操作取得。
2. PUT 此 Entry，设 date=2026-09-21、startTime=15:00、timeZone=Asia/Shanghai、durationMinutes=90，repeat=null，reminder=null -> 200 Entry。GET occurrences?from=2026-09-21&to=2026-10-01 -> E1 startsAt=07:00Z、endsAt=08:30Z，key.originDate=null（完整日期前缀同当天）。
3. PUT 加 I2(high)，I1(normal)，数组 `[I1,I2]` -> 段内仍先 I1，界面不提供优先视图。再 PUT `[I2,I1]` -> 优先级不变。事项 text 纯空白、重复 item ID、空标题且空 items -> 422 invalid-input。
4. moveItem `{itemId:I2,fromEntryId:E1,fromVersion:当前,toEntryId:null,toVersion:null,toIndex:0}` -> MoveResult，from 只剩 I1 且 version+1，to 为新未排期 Entry/version=1、只含 I2、high。相同键原体重放不得创建第二个目标。
5. 向已有目标移动，若目标 version 已变 -> 409 version-conflict，objectId 为目标，from/to 都不变。目标已有同一 itemId、索引越界 -> 422 invalid-input；重复源或同源目标 -> 409 invalid-move；重复目标按日程契约指定 series/instance 范围。HTTP 掉线保留原请求，恢复后同键确认一次。
6. 日期范围是前端行为：from=2026-09-21、to=2026-10-01 共11日；from>to -> 422 invalid-input、field=/query/from、reason=out-of-range；改变范围不切 AI/丢草稿，拖选才切工具。

## TT-C3 周重复、例外、日期与时区（WB-T009 至 011）

创建每周一 E1：time=2026-09-21 15:00、90分钟、Asia/Shanghai，until=2026-10-05。实例原始日期为 09-21、09-28、10-05。

- PUT entries/E1/exceptions/2026-09-28，expectedVersion=1、mode=override、完整 content 的 time 改为 2026-09-29 16:00（90分钟） -> 200 Occurrence，key 仍是 E1/09-28，entryVersion=2，startsAt=`2026-09-29T08:00:00Z`、endsAt=`2026-09-29T09:30:00Z`。GET 仅09-29也返回它；GET 仅09-28不再返回它。其余两周时间不变。
- 整组 PUT version=2，startTime 改14:00 -> version=3；09-28例外仍为09-29 16:00。缩短 until=09-21 -> 例外列表保留09-28、eligible=false；单实例返回 outside-series，区间查询不返回；再延长到10-05恢复它，提醒从重新可见时刻生效。
- mode=cancelled -> 区间不再出现，单实例 state=cancelled、返回当前模板内容；mode=inherit -> 恢复当前模板原日期/时间，exception=false。每次操作都用最新 Entry 版本并使它加1。普通实例被删整组后 state=deleted。
- 请求 originDate=09-22 -> 404；重复详情漏 originDate、非重复带 originDate -> 422 invalid-input。调整首日/时区、把已存非重复改重复 -> 409 immutable-series。未排期首次排时间允许改变 date/timeZone；一旦已保存为有时间，非重复仍可自由改 date/timeZone（不可改成重复），固定首日/时区只约束重复模板。
- 跨午夜：上海 2026-09-27 23:30 持续120分钟 -> start=`2026-09-27T15:30:00Z`、end=`2026-09-27T17:30:00Z`；09-27与09-28都返回同一个 key。上海09-28 00:00结束的段只属于09-27。零时长、非法02-30、to超2100 -> 422。
- DST 样本（开始时关闭提醒）：America/New_York，2026-03-01 02:30持续60分钟、周重复至03-08；03-01 start=`07:30Z`，03-08缺失02:30移至03:30，start=`07:30Z`、end=`08:30Z`、timeAdjusted=true。2026-11-01 01:30取较早偏移，start=`05:30Z`，60分钟后end=`06:30Z`。
- GET/PUT settings：初始 Asia/Shanghai/version=1，改 America/New_York/expectedVersion=1 -> version=2。已有安排保持当地日期、开始钟点、持续分钟和内容，实际 startsAt/endsAt 按纽约时区重新计算；设置与全部安排原子迁移，迁移前结算旧到期提醒。设置错版本 ->409/currentVersion，非法时区 ->422 invalid-time-zone、field=/timeZone。

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


## 共同失败与恢复

提交成功但丢响应后保留原键原体；重启后重试只返回同一成功结果，不再次推进版本。换体返回 409 idempotency-key-reused，旧版本返回 409 version-conflict 并保留草稿。无身份 401、异源或缺保护头 403、外账户 404、损坏 JSON 400、媒体类型 415、超限 413、存储回滚 503。账户切换隔离草稿与迟到响应。
