# 教学与时间契约

[OpenAPI](teaching-time/teaching-time.openapi.yaml)拥有基础字段与操作，[cases](teaching-time/cases.md)拥有交换与失败恢复；[架构](../arch/teaching-time.md)定义进程内接缝。当前记录 v2 另消费[数学关联](teaching-time-math.md)，题目提供方明确采用[丰富题目读取](materials-teaching-alignment.md)。用户行为见[班级与日程](../features/teaching-time.md)。

## 共同协议

继承 [B11 身份、HTTP、幂等、冲突与未知结果](workbench.md)：可信 principal、同源 Cookie、来源/保护头、no-store、2 MiB 请求限制、严格请求与宽容响应、账户隔离、原子成功回执、无 TTL 的请求重放、版本冲突对照。无身份 401；不存在/外账户统一 404。所有写入携 Idempotency-Key；成功重放先于当前版本检查。UUID 是标识而非权限。所有日期时间计算使用服务端时钟；业务创建/更新/删除服务器 UTC 时间。

新增对象 version 从 1 开始，每次成功逻辑写入加 1，同体新键也加 1。PUT 为完整替换其可写内容，字段必填但允许空值的以 schema 为准；省略不等于清空。删除/恢复独立操作，不用 HTTP DELETE；被删除对象 GET 可读，普通修改 409 object-deleted。列表默认 active，可显式 deleted；不分页，按各自定义稳定排序。未知 query、重复 query、未知请求字段、隐式类型转换均拒绝。错误完整字段只见 schema。

## 班级、实际记录与回看

- 班级只有名称；名称去首尾空白后非空，同账户可同名，以 ID 区别。不增加学年、学生、成绩、组织或强制学期。列表按名称 Unicode 码点升序、ID 升序。
- 一条记录属于一个不可更换的班级；recordedOn 是实际教学日期，默认账户今天，允许老师补记或纠正日期，不由课程时间生成。note、position、unfinished、commonIssues、nextNote 至少一个去空白后非空，原文字不截断。列表按 recordedOn 降序、updatedAt 降序、ID 升序。
- 班级顶部实际位置由记录派生，不另设进度表：活动记录中 position 非空的首条；无此项则显示最近活动记录摘录。删除/改日期后重新派生。班级软删除后其记录保留只读，恢复班级不改变记录自己的删除状态。
- 记录的备课/题目关联是可回看当前对象的链接，不是采用某版教材快照。首次链接保存服务器读取的标题 labelAtLink；读取派生 currentLabel/deleted，不因改题或改备课而改记录文字、版本、保存时标题。新链接要求本账户活动来源；已保留链接可以引用已删除来源。移除后再添加算新链接，不能新连已删除来源。重复 kind+id 拒绝。
- 基础 sources 为 lesson/question，当前 records v2 另接受 [math](teaching-time-math.md)。classes 拥有关联表和反向查询，题库/备课只读 classes 公共操作，不读其表、不写回备课正文。反向查询默认活动记录及活动班级，按记录顺序返回；查看已删除记录走班级的删除过滤，不混入当前反馈。
- 日程可以带一个班级、一个备课和多个实际记录。链接已有记录时必须与所选班级相同；classId 为空时 recordIds 必须为空。同一次安排可以关联多条实际记录；写记录与安排关联是两个明确保存步骤，不建立跨模块分布式事务。记录先保存成功后，第二步失败只重试关联。单次实例才能关联实际记录，重复模板 recordIds 必须为空。
- 删除来源/班级/记录不级联删除任何日程；现存链接继续可读并标已删除。修改无关字段时允许保留失效链接；新增/改指链接时重新检查活动性/归属。更换班级必须同时清除不匹配 recordIds。返回的关联状态由公共读取派生，来源读取失败使本次读取失败，不伪装为“已删除”。

课程关联的 labelAtLink 与记录来源一样由服务器首次链接时保存，重新提交相同 ID 不覆盖它。当前标签取班级名、备课/题目标题或记录端口 label；空标题分别显示“未命名备课”“未命名题目”，该显示回退不写入提供方。所有反向链接只按稳定 ID 回看当前来源，历史标题不能冒充历史内容快照。

## 安排、事项与排序

安排 Entry 是一个小聚合：标题、可排序事项、可选时间、可选周重复、可选课程关联及一个可选提醒。标题去空白非空或至少有一项事项，二者满足其一；空标题展示首项摘要。事项只含稳定 UUID、文字、优先级。优先级为 low/normal/high，作用于跨时段的“优先事项”视图；数组顺序是段内顺序。两者互不派生，没有完成/逾期字段。

班级、记录、安排与通知的 ID 由服务器创建；事项 ID 由客户端在首次输入时创建，修改/重排/移动保持。重复实例展开时保留模板事项 ID，显示身份为 entryId + originDate + itemId；不同周的同名事项不被合并成一件待办。改某次优先级只改该例外，整组修改只影响仍继承模板的实例。

time=null 表示未排期，repeat 与 reminder 均必须为 null，course.recordIds 为空。未排期可以含多项，最简新增一项即可。全局优先视图由前端对已返回的范围实例和全部未排期事项组合：high、normal、low；同级按开始瞬间升序，未排期在同级最前；再按 entryId、originDate、数组位置稳定排序。优先级不是第二个需手动维护的全局名次。

移动单个事项使用 moveItem 原子操作，带源与目标的期望版本。只在两个活动非重复 Entry 间移动，目标可以未排期；toEntryId=null 新建未排期 Entry，返回新 ID。将事项插到目标索引；文字、ID、优先级保持。两聚合及幂等结果同事务，任一版本冲突完全回滚。源移空时：有标题则保留安排；无标题则软删除源。只在创建新未排期目标时自动用空标题、无关联、无提醒。已存在目标保留其时间/提醒/关联。同源同目标用普通 PUT 重排，不调用 moveItem。重复实例事项可在“仅这一次”中编辑/增删排序，跨段移动入口不提供，避免隐式搬动所有周。

## 账户时区与日期

T52 拥有账户的 schedule-settings，timeZone 为 IANA 名称，首次读取未设置账户返回 Asia/Shanghai、version=1；初始化须幂等。浏览器 OS 时区不决定业务日期。更新设置只改变显示与新建默认时区，既有安排各自保存的排课时区和实际瞬间不变。记录 recordedOn 是日期，不因时区切换改变。

日期用有效公历 YYYY-MM-DD，支持 1900-01-01 至 2100-12-31；time.startTime 是分钟精度 HH:mm（00:00 至 23:59），durationMinutes 是实际经过的 1 至 1440 分钟。跨午夜显示两个日期；结束瞬间 = 开始瞬间 + durationMinutes，不能用浏览器随意解析本地日期。时间网格可拖选，接口仍以日期/开始时刻/持续分钟表达，编辑结束时间时转换为实际分钟。

周重复依据安排自身 timeZone 的当地星期/时间逐周生成，不在 UTC 上固定加 168 小时。夏令时重叠取较早的瞬间，缺失时刻向前移动该次跳时的间隔，例如 02:30 跳到 03:30；持续分钟保持。界面保存预览和实际实例显示调整后的时刻，不能静默显示不存在的 02:30。时区无效 422 invalid-time-zone；非法日期/时间 422 invalid-input。没有 DST 的上海时间走同一规则。

范围查询 from/to 均含首尾日，以账户显示时区的首日 00:00 至末日次日 00:00 构成半开区间。安排按实际区间相交返回（start < rangeEnd 且 end > rangeStart）；恰好在首日 00:00 结束不属于该范围。允许任意连续合法日期，不强加 7/31 天服务端上限，查询排序为 startsAt、entryId、originDate 升序。移到范围内的例外必须被找到，即使原始日期不在范围内。

## 重复和单次例外

每个重复安排每周一次，首日就是 time.date，repeat.until 为含首日的最后原始日期，必须 >= time.date。无重复用 null；暂不引入 RRULE、多星期规则或“此后全部”。重复模板的首日、时区及重复/非重复种类在首次保存后不变；非重复安排可自由改日期/时区、排期或移回未排期。整组可改起始时刻、时长、结束日期、标题、事项、课程关联和提醒。改变重复首日/星期或种类通过新建安排与删除旧安排，UI 明确执行两件事，不伪称改了一次。

实例身份为 `(entryId, originDate)`，originDate 是该系列原始排课日；非重复为 `(entryId, null)`。调课改变实际 time，但身份不变。周例外只有 override 或 cancelled；override 保存完整可编辑内容且 repeat 不可再次定义，按 originDate 覆盖模板，取消这次不生成新的 Entry。读取返回实例实际时间、模板版本、是否例外；指定单个实例可返回取消/删除状态供通知定位。

整组 version 同时保护模板和全部例外，每次单次操作也使它加 1，避免两设备改同系列互相覆盖。整组更新保留已有例外的全部内容，提醒也保留；缩短 until 隐藏原始日期不再符合规则的例外，伸长后恢复原例外。隐藏不表示删除它的数据；例外列表包含 eligible=false 供确认。早于首日或不符合每周节律的原始日期为 404；符合节律但超出当前 until 的单实例读取返回 outside-series（即使没有存过例外），以便旧通知解释缩短后的课程。其写操作返回 422 invalid-input、field=/originDate、reason=out-of-range；需先延长整组再编辑/恢复该次。

“恢复原安排”删除该日例外并重新采用当前模板，不将调课后的日期作为新原始日期。取消例外的 content=null，单实例读取返回当前模板的可辨认内容及 cancelled 状态；override 的 content 非空。隐藏状态优先于取消，整组 deleted 优先于两者。没有例外时再次 inherit 仍算一次版本化写入。取消、隐藏或整组删除的实例不会触发新提醒。源 Entry 删除后所有实例显示 deleted，恢复原 ID 与例外，不回放停用期间提醒。

## 提醒、修改与重启

每段/每次只设一个相对结束的 reminder：before/after + 非负分钟数；0 表示结束时。dueAt = endsAt ± minutes。未设置为 null；创建或显式新启用/调整到期时间时，非重复/单次例外必须 dueAt > 服务端 now，否则 422 reminder-not-future。重复模板需至少一个仍符合规则的实例 dueAt > now，过去实例不获得提醒资格。纯文字/关联变更允许保留过去配置。删除、恢复整组或 inherit 操作允许恢复过去配置但保持安静，不为此拒绝恢复。

提醒使用持久 armedAt：首次启用为提交时间；取消后恢复、修改时间/重复范围/提醒、恢复例外/整组会从当前提交时间重新生效。纯标题、事项、关联变化不重置。模板改变只作用于未 override 的实例，独立例外保留自己的生效点。dueAt <= armedAt 的历史实例不补发；隐藏后重新显现的例外也从恢复可见的提交时间生效。删除/禁用不让历史被新计算覆盖。

提醒标题投影固定为同一个 `projectReminderTitle(entry)`：先取 `entry.title` 去首尾空白后的文本；若为空，取 `entry.items[0].text` 去首尾空白后的文本；最后按 Unicode code point 取前 300 个字符，不追加省略号。该投影只用于 `ReminderCandidate.title` 和 `Notification.title`，不改已保存的标题或事项；合法空标题安排一定有首项事项，因此投影结果非空且符合 300 字符上限。

通知唯一键为可信账户 + entryId + originDate（单次用 null 的稳定哨兵），不是 dueAt、标题、版本或轮询时刻；一条实例一生最多生成一条通知。到期入库时保存原定 dueAt、`projectReminderTitle(entry)` 的结果、readAt=null；点击/全部已读只改 readAt，清空只设 dismissedAt，唯一痕迹仍保留。

**修改前先结算**：T52 对任何安排/例外/删除/恢复/事项移动的成功变更，在同一 mutations 事务中先调用 T53 注入的 captureDue，以同一个服务端 now 结算旧安排中 `armedAt < dueAt <= now` 的提醒，再写新状态。校验失败则整个事务回滚。即使工作台没打开，已经到点的旧提醒也不会被随后调课抹掉。T52 的独立替身可验证调用顺序；T53 必须接入持久实现才具备完整行为。

| 操作发生时点 | 通知结果 |
| --- | --- |
| 到期前改时间/提醒、取消某次或删除整组 | 旧未来时刻不产生通知；按新生效安排计算，取消/删除保持安静 |
| 到期后（包括关闭期间）改时间、清除提醒或删除 | 先持久保存原到期通知，原 dueAt/标题/已读态保持；不再为同实例生成第二条 |
| 发出后修改标题/关联、改时段、恢复、服务重启 | 原通知不改；点击解析当前目标，显示当前安排或取消/删除状态 |
| 清空通知、重复进入、并发查询 | dismissed 通知不再展示且不再生成；总共仍只有一条唯一记录 |
| 关闭工作台/服务停止期间到期 | 再次查询时扫描当前有效实例至服务端 now，补写缺失通知，显示原 dueAt，不显示补写时间冒充提醒时间 |

T53 仅在站内通知查询/写入及 schedule 变更时结算；浏览器工作台可见时每 30 秒查询，回到前台/登录恢复立即查询；时钟由服务端控制，后台浏览器不承担可靠计时。无需常驻任务、队列、Web Push 或通知中心模块。已到期列表按 dueAt 降序、ID 升序；点击旧通知通过当前 occurrence 解引用，不需要保留整个安排的历史版本。

## 公共端口与协议版本

classes 已通过 `lessons.readForTeachingLink`、`questions.readForReferenceV2` 和 `math.readForTeachingLinkV1` 读取真实来源；schedule 使用班级/记录摘要与备课端口。具体同步 Interface 见[架构](../arch/teaching-time.md#模块与-interface)。业务事务和旧协议的字段约束继续保留。

### 静态目录 v2 与当前 v3

`teaching-time.openapi.yaml` 的 `catalog-v2` 样本定义教学基础组合：version=2，顺序 questions、lessons、classes、schedule。它只用于该版协议与固定样本，不是当前六模块运行响应。当前 `GET /api/modules` 使用数学契约的 ModuleCatalogV3 和 `packages/shared/src/moduleCatalog.js`，顺序为 questions、lessons、math、resources、classes、schedule；材料版的目录 v2 也不能与教学版 v2 混为同一全集。

所有版本的静态目录均核对 ID/path 唯一、requires 提供方存在且依赖无环。校验失败为 `422 invalid-input`；重复项 field 指向对应 `/id` 或 `/path`，reason=duplicate-id，缺依赖/环路 reason=invalid-reference。教学 v2 的固定反例见 cases 的 TT-C7；当前 v3 按自己的 schema 和目录核对。未知目录版本保留设备草稿并提示升级，不忽略依赖继续装配。

### 记录来源 v1 与 v2

本页基础 schema 的记录 v1 SourceInput 仅含 lesson/question，拒绝 math、work、resource 和任意 JSON 扩展。当前记录使用[教学记录 v2](teaching-time-math.md)：新增 kind=math，真实提供方及前端反向反馈均已接线。v1 读取含 math 对象时的整体拒绝、v2 兼容旧记录、旧键原路径确认均沿该扩展，不能通过删掉 math 字段进行有损降级。真实完整教学验收与目标设备仍按[剩余依赖](../plans/mvp-dag.md)推进，不因接口存在标全范围通过。

## 场景与操作映射

| BDD / UX | 共同操作 | 归属 |
| --- | --- | --- |
| WB-T001、002、019 / U1、U2、U11 | classes 与 records CRUD/deletion | T51 |
| WB-T003、004、020 / U3、U8 | record sources、source-records、课程 recordIds | classes 与组合层；真实作品完整验收依赖 M44 |
| WB-T005、008 / U4、U5 | listOccurrences、getOccurrence、设备现场 | T52；范围选择不切 AI 为前端行为 |
| WB-T006、007 / U6 | Entry、moveItem、数组/priority | T52 |
| WB-T009、010、011 / U7 | exceptions、settings、日期计算 | T52 |
| WB-T012 至 016 / U9、U10 | reminder、notifications、captureDue | T52 保存/投影，T53 存储/已读/汇合 |
| WB-T017、018 / 全部 | B11 协议、Problem、版本/账户保护 | T51/T52/T53 各自，T54 真实复验 |
