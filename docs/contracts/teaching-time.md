# 教学与时间契约

[OpenAPI](teaching-time/teaching-time.openapi.yaml)拥有基础字段与操作，日历界面另消费[日历扩展](#日历扩展)，[cases](teaching-time/cases.md)拥有交换与失败恢复；[教学实现](../features/teaching-time.md#教学实现)定义进程内接缝。当前记录 v2 另消费[数学关联](#数学作品关联)，题目提供方明确采用[丰富题目读取](#丰富题目关联)。用户行为见[班级与日程](../features/teaching-time.md)。

## 共同协议

继承 [B11 身份、HTTP、幂等、冲突与未知结果](workbench.md)：可信 principal、同源 Cookie、来源/保护头、no-store、2 MiB 请求限制、严格请求与宽容响应、账户隔离、原子成功回执、无 TTL 的请求重放、版本冲突对照。无身份 401；不存在/外账户统一 404。所有写入携 Idempotency-Key；成功重放先于当前版本检查。UUID 是标识而非权限。所有日期时间计算使用服务端时钟；业务创建/更新/删除服务器 UTC 时间。

新增对象 version 从 1 开始，每次成功逻辑写入加 1，同体新键也加 1。PUT 为完整替换其可写内容，字段必填但允许空值的以 schema 为准；省略不等于清空。删除/恢复独立操作，不用 HTTP DELETE；被删除对象 GET 可读，普通修改 409 object-deleted。列表默认 active，可显式 deleted；不分页，按各自定义稳定排序。未知 query、重复 query、未知请求字段、隐式类型转换均拒绝。错误完整字段只见 schema。

## 班级、实际记录与回看

- 班级只有名称；名称去首尾空白后非空，同账户可同名，以 ID 区别。不增加学年、学生、成绩、组织或强制学期。列表按名称 Unicode 码点升序、ID 升序。
- 一条记录属于一个不可更换的班级；recordedOn 是实际教学日期，默认账户今天，允许老师补记或纠正日期，不由课程时间生成。note、position、unfinished、commonIssues、nextNote 至少一个去空白后非空，或 v2 的 content 含有效文字、公式或图片；原文字不截断。v2 列表按 recordedOn 降序、createdAt 降序、ID 升序，编辑正文不改变同日顺序；旧路径仍按 recordedOn、updatedAt 降序及 ID 升序。
- 班级顶部实际位置由记录派生，不另设进度表：活动记录中 position 非空的首条；无此项则显示最近活动记录摘录。删除/改日期后重新派生。班级归档后其记录保留只读，恢复班级不改变记录自己的删除状态。归档沿用 `/items/:id/deletion`、`deletedAt` 和列表 `state=deleted` 的既有传输字段，`deleted=true` 表示归档，`false` 表示恢复；界面使用归档术语。
- 记录的备课/题目关联是可回看当前对象的链接，不是采用某版教材快照。首次链接保存服务器读取的标题 labelAtLink；读取派生 currentLabel/deleted，不因改题或改备课而改记录文字、版本、保存时标题。新链接要求本账户活动来源；已保留链接可以引用已删除来源。移除后再添加算新链接，不能新连已删除来源。重复 kind+id 拒绝。
- 基础 sources 为 lesson/question，当前 records v2 另接受 [math](#数学作品关联)。classes 拥有关联表和反向查询，题库/备课只读 classes 公共操作，不读其表、不写回备课正文。反向查询默认活动记录及活动班级，按记录顺序返回；查看已删除记录走班级的删除过滤，不混入当前反馈。
- 日程可以带一个班级、一个备课和多个实际记录。链接已有记录时必须与所选班级相同；classId 为空时 recordIds 必须为空。同一次安排可以关联多条实际记录；写记录与安排关联是两个明确保存步骤，不建立跨模块分布式事务。记录先保存成功后，第二步失败只重试关联。单次实例才能关联实际记录，重复模板 recordIds 必须为空。
- 归档班级或删除来源/记录不级联删除任何日程；现存链接继续可读并标已删除。修改无关字段时允许保留失效链接；新增/改指链接时重新检查活动性/归属。更换班级必须同时清除不匹配 recordIds。日程返回的关联状态由公共读取派生，来源读取失败使该次日程读取失败，不伪装为“已删除”。

课程关联的 labelAtLink 与记录来源一样由服务器首次链接时保存，重新提交相同 ID 不覆盖它。当前标签取班级名、备课/题目标题或记录端口 label；空标题分别显示“未命名备课”“未命名题目”，该显示回退不写入提供方。所有反向链接只按稳定 ID 回看当前来源，历史标题不能冒充历史内容快照。

### 彻底删除班级

`POST /api/modules/classes/items/{id}/purge`，操作 `purgeClass`，严格请求为 `{expectedVersion}`；仅本账户已归档班级可执行。活动班级返回 `422 invalid-input`（field=`/classId`、reason=`invalid-reference`），旧版本返回 `409 version-conflict`，不存在或外账户统一 `404`。成功返回 `200 {id, permanentlyDeleted: true}`。UI 先确认班级名、全部课堂记录和不可恢复的影响；失败保留入口，响应丢失按原键原体重试，刷新后仍可确认。

一次事务移除班级、全部活动及已删除记录和记录的来源关系，成功回执与业务删除原子提交。常规班级/记录 GET、列表与恢复不再访问这些对象；已有成功回执按共同协议保留，重放只返回原结果，不会重新创建对象。历史部署备份和其他设备的本地草稿不因这次操作被改写。

`classes_removed_objects` 仅保留账户、稳定 ID、对象种类、所属班级 ID、末版本和删除时间，不保存班级名称或记录正文。`readClass/readRecord` 对本账户已确认彻底删除的 ID 返回不可恢复的删除摘要，使已有日程可继续读取和修改；未知或外账户 ID 仍返回 404。既有日程的保存时标题保留，新增关联仍拒绝删除对象。备份校验仅为班级/记录接受这些已确认的删除标记。不会删改关联的备课、题目、作品或日程数据。



### 公式、图片与兼容

记录 v2 的可选 `content` 复用材料 Document v1/v2，使用共享文稿编辑器、KaTeX 和受管文件读取。它是独立补充，note 与四个原文字字段始终按纯文本保存和显示，不自动解释美元符号或 Markdown。公式源用于检索，渲染失败保留源码；仅公式或图片也可构成有效记录。记录摘要先取原文字，再取补充文稿中的文字、公式源或图片说明；无说明图片称为“课堂图片”。

创建省略 content 使用空文稿；更新省略保留当前内容，显式空文稿表示移除本记录中的补充。新增或改变的文稿复用共享结构、配额、文件归属和图片类型校验，接受 PNG/JPEG/WebP；原样保留的文稿不因图片暂不可读取而阻断纯文字修改。未知文稿版本拒绝，不转换或丢失源内容。v1 读取或写入含非空 content 的对象返回 unsupported-content-version；旧成功回执仍按原路径、原键、原体重放，不加新字段。空 content 不改变 v1 响应形状。

图片沿用 `/api/workbench/files` 上传、读取与文件保留策略。上传成功后还需保存记录；移除图片或彻底删除记录仅移除该记录的引用，不删改其他记录和内容共用的受管文件。未确认上传按账户和记录草稿保存原请求、文件字节与幂等键；刷新后重新选择相同原文件确认，成功文件加入草稿后才能保存记录。待确认图片的设备状态读取失败时保留草稿并提供重试；没有待确认图片时，图片存储故障不阻止纯文字保存。若重新进入时已取得上传成功结果但原编辑动作丢失，保留既有图片并追加成功图片供检查，不推断要替换哪个旧图片。整库备份验证该文稿的结构和文件归属，并包含文件字节。

### 跨班移动

`POST /api/modules/classes/v2/records/{id}/move` 接受 `{expectedVersion, targetClassId}`，源记录及两个班级必须均为本账户活动对象。目标等于源班级返回 422，版本过时或对象已归档/删除返回 409，未知或外账户返回 404。响应 `{originalId, originalClassId, record}` 中 record 是目标班级中新建的完整 RecordV2。

移动保留实际教学日期、全部文字、文稿、想法提示状态、资料顺序和保存时标题；目标记录使用新 ID、新建时间和 version=1。原记录保持原 ID/班级，升版并软删除。目标创建、来源关系复制、原记录软删除及成功回执在同一事务提交，失败整体回滚，原键重放不再次创建。既有日程始终关联原记录，恢复原记录不会移除目标记录，两者后续独立编辑。

界面先选择目标班级并说明原记录进入“已删除”及日程保留原关联；取消不写入。原记录有设备编辑草稿或待确认图片时先处理草稿再移动；新记录输入框中的另一份草稿可保留。成功打开目标记录，未知结果刷新后仍能以原请求确认。

### 班级概览与想法提示

`GET /api/modules/classes/overview` 不接受 query，返回本账户活动班级的 `{items: [{id, count, latest, position}]}`。count 仅计活动记录；latest、position 为 `{recordedOn, text}` 或 null，分别取 v2 顺序的第一条活动记录摘要和第一条非空教学位置。摘要不读取关联提供方，来源故障不阻断主页进度。

`POST /api/modules/classes/v2/records/{id}/next-note-visibility` 接受 `{expectedVersion, hidden}`，返回完整 RecordV2，升版一次。仅本账户活动班级内的活动记录可改；班级或记录已删除返回 409，旧版本返回版本冲突，未知或外账户返回 404。v2 返回布尔 `nextNoteHidden`，既有记录默认为 false；旧记录响应不增加此字段。隐藏保留原文，修改其他文字不重置；修改 nextNote 内容后恢复提示。

班级顶部取最近一条非空 nextNote，隐藏后不回退到更早的想法。按需展开的课前回顾显示含未讲内容、共性问题或未隐藏想法的活动记录，每次多展示五条；不会由回顾内容推断完成状态。隐藏的想法仍可从原记录恢复提示。

### 彻底删除单条记录

`POST /api/modules/classes/v2/records/{id}/purge` 接受 `{expectedVersion}`，仅本账户活动班级中的已删除记录可执行。记录仍活动返回 `422 invalid-input`（field=`/recordId`、reason=`invalid-reference`），班级已归档或版本过时返回 409，未知或外账户返回 404。成功返回 `{id, classId, permanentlyDeleted: true}`；界面须确认不可恢复，取消不改变数据。

记录、其来源关系和成功回执在同一事务处理。沿用 `classes_removed_objects` 仅保留身份及删除摘要，不保留正文或来源标题；其班级仍活动时公共 `readRecord` 的 `classDeletedAt` 为 null。其他记录、来源和日程不被删除，已有日程引用及备份恢复仍能识别删除摘要。未知结果按共同幂等协议以原键原体重试，刷新后保留确认入口，即使记录已从列表消失也可完成确认。

上述操作的精确字段见 [OpenAPI 扩展](teaching-time/teaching-time-math.openapi.json) 的 ClassOverviewList、NextNoteVisibility、RecordPurge 与 RecordPurged。


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

## 日历扩展

日历请求可携带 `calendar: {allDay, notes, tags}`：`allDay` 为布尔值，纯文本 `notes` 最长 50000 字符，`tags` 为最多 30 个不重复标签 UUID。安排和实例读取总是提供此对象；基础请求省略它时保留原值。全天安排要求 00:00 开始及整天时长，结束按安排时区的当地午夜计算。带 calendar 的单次时长上限为 366 天；基础请求仍为 1440 分钟。

重复规则可在 `until` 外指定 `frequency`（daily/weekly/monthly/yearly）、`interval`（1 至 999）、`weekdays`（0 表示周日，周规则至少一天）、`monthly`（date/weekday）和 `count`（0 表示不按次数截止，最多 10000）。规则按安排当地日期展开；不存在的月日期或闰日跳过，月星期按首日的第几个星期定位。日历更新允许已有任务切换重复类型和调整系列起日；基础请求保留上述不可变系列限制。已有单次例外按原始日期保留，只有仍符合系列规则的实例进入范围查询。

标签接口为 `/api/modules/schedule/labels` 的 GET/POST 与 `/:id` 的 PUT。创建提交 `{name, color}`，名称去空白后 1 至 60 字符，颜色为 `#RRGGBB`；更新额外携带 `expectedVersion` 和 `deleted`。读取仅含本账户活动标签，写入沿用公共身份、版本、幂等与事务规则；删除标签不删除任务。此扩展的运行校验归 `apps/api/src/modules/schedule/schema.js`，真实 HTTP 兼容与重启验证见 `apps/api/test/teaching-time-calendar.test.js`。

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

classes 已通过 `lessons.readForTeachingLink`、`questions.readForReferenceV2` 和 `math.readForTeachingLinkV1` 读取真实来源；schedule 使用班级/记录摘要与备课端口。进程内端口与 HTTP 使用同名 schema，具体工厂签名以模块入口代码为准；以下约束适用于共同 SQLite 事务。

| 同步端口 | 约束 |
| --- | --- |
| `classes.readClass/readRecord` | 返回本账户摘要，允许 tombstone；记录 label 依次取 note、position、unfinished、commonIssues、nextNote 的首个非空值，最多 300 个 Unicode 字符。readRecord 不加载数学源，不因作品服务故障阻断日程读取。 |
| `classes.listSourceRecords/V2` | 分别保留旧联合及 v2 来源语义，反向索引由 classes 独占维护 |
| `schedule.readOccurrence` | 无时间、无权或不符合原始周节律返回 404；符合节律但超出 until 返回 outside-series |
| `schedule.listReminderCandidates` | 当前活动实例中 `armedAt < dueAt <= now`，按 dueAt、entryId、originDate 排序；只读，不写通知 |
| `reminders.captureDue` | 同事务按唯一实例键结算；异常随原写入回滚 |

`beforeChange` 在逻辑安排变更的归属、版本、领域校验通过后，实际修改前同步调用一次；幂等重放不再调用。组合先以闭包注入 schedule，再构造 reminders，最后挂路由；工厂构造不执行业务调用，生产缺依赖即启动失败。clock 由组合入口提供，HTTP 不接收调用者的 now。

来源提供方与 classes 使用同一数据库连接，写事务中不网络请求。新增关联、反查入口和旧路径传播提供方 404/503；v2 既有关联按下文异常投影返回，保留记录正文。新增数学来源保留原 ID、版本、链接顺序和首次标题；旧成功回执原样保留，不迁移旧键绑定路径，v2 纯读不批量改旧行。来源删除与记录保存由同一同步事务串行化，不另设事件总线或异步补关联。

### 静态目录 v2 与当前 v3

`teaching-time.openapi.yaml` 的 `catalog-v2` 样本定义教学基础组合：version=2，顺序 questions、lessons、classes、schedule。它只用于该版协议与固定样本，不是当前六模块运行响应。当前 `GET /api/modules` 使用数学契约的 ModuleCatalogV3 和 `packages/shared/src/moduleCatalog.js`，顺序为 questions、lessons、math、resources、classes、schedule；材料版的目录 v2 也不能与教学版 v2 混为同一全集。

所有版本的静态目录均核对 ID/path 唯一、requires 提供方存在且依赖无环。校验失败为 `422 invalid-input`；重复项 field 指向对应 `/id` 或 `/path`，reason=duplicate-id，缺依赖/环路 reason=invalid-reference。教学 v2 的固定反例见 cases 的 TT-C7；当前 v3 按自己的 schema 和目录核对。未知目录版本保留设备草稿并提示升级，不忽略依赖继续装配。

### 记录来源 v1 与 v2

本页基础 schema 的记录 v1 SourceInput 仅含 lesson/question，拒绝 math、work、resource 和任意 JSON 扩展。当前记录使用[教学记录 v2](#数学作品关联)：新增 kind=math，真实提供方及前端反向反馈均已接线。v1 读取含 math 对象时的整体拒绝、v2 兼容旧记录、旧键原路径确认均沿该扩展，不能通过删掉 math 字段进行有损降级。真实完整教学验收与目标设备仍按[剩余依赖](../plans/mvp-dag.md)推进，不因接口存在标全范围通过。

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

## 数学作品关联

精确字段见 [OpenAPI](teaching-time/teaching-time-math.openapi.json)，交换场景见 [math-cases](teaching-time/cases.md#数学关联用例)。数学 Source 类型取[固定输入](teaching-time/inputs/README.md)。本节拥有记录链接与兼容行为，不复制数学制作模型。

### 来源与保存

`SourceInputV2 = SourceInput | TeachingMathInput`，`SourceV2 = Source | TeachingMathSource | UnavailableSourceV2`。数学分支外引 M40 原 schema，精确标识为 `kind=math`，不是 `work`。选择器调用 M40 `listWorks`（`GET /api/modules/math/v1/works`），只选本账户 `state=active`；支持其五种 kind，`render=invalid` 也允许关联。教学反馈不要求导出成功，不使用备课版本快照或 File ID。

首次关联由 classes 在记录写事务中同步调用 `math.readForTeachingLinkV1(principal,id)`；保存服务器读取的 `title` 为 `labelAtLink`，客户端只提交 kind/id。`TeachingWork.version` 只用于提供方投影，不持久化为关联版本，不做 reference-version-conflict。作品在选择后改名，最终以保存事务读取的标题为准；在保存前删除则整个保存失败。

读取时派生 `currentLabel=title`、`deleted=(deletedAt != null)`。同一 `kind+id` 保留原 `labelAtLink`；作品修改、删除、恢复只改变派生字段，不改变记录的 version、updatedAt、文字或 recordedOn。重复 kind+id 在后一个 `/sources/<i>/id` 返回 `422 invalid-input / duplicate-id`；source 顺序沿请求数组保留。空标题只在界面显示“未命名作品”，不改 provider 或 label 字段。

| 作品状态/操作 | 保存和读取结果 |
| --- | --- |
| 活动作品首次关联 | 原子保存记录和首次标题；`render=invalid` 不阻断 |
| 已保留的链接，作品软删除 | 仍可读取并标已删除；编辑原记录其他文字、重排 sources、删除/恢复记录均可保留该链接 |
| 新链接到已删除作品 | `409 /problems/workbench/reference-deleted`；整条记录不写入 |
| 成功移除后再添加 | 算新链接；作品仍删除则拒绝，已恢复则以当次 title 重新保存 labelAtLink；同次 PUT 中仍有原 kind/id 算保留 |
| 作品恢复 | 既有链接 deleted=false，无需重存记录；记录或班级自己的删除状态不随之恢复 |
| 提供方不存在/外账户 | 新增关联及反查入口返回 404；v2 既有链接保留已存标题，返回 unavailable=missing、deleted=null，不制造 tombstone |
| 提供方存储失败 | 新增关联及反查入口返回 503；v2 已有关联投影返回 unavailable=temporary、deleted=null，正文仍可读写。旧路径继续传播失败 |

班级归档后记录只读、单个记录 ID 的 classId 不可更换、非空内容要求与 100 个来源上限及所有排序/版本规则原样继承 T50。新建不要求关联；取消作品选择不写记录。来源异常时可保留草稿重试；显式移除异常来源后按新请求保存，不自动清空 sources。

### 完整操作与新旧兼容

新操作沿用共同身份、保护头、no-store、严格请求/宽容响应、账户幂等与原子事务。schema 中含全部旧操作及下表新增操作。两套路径共享同一 records 数据、ID、version、删除态和幂等账本，没有 v2 记录副本或自动迁移写入。

| 新路径 | 操作/完整结果 |
| --- | --- |
| `/api/modules/classes/v2/records` | GET `listRecordsV2`（原 classId/state 参数）与 POST `createRecordV2`；RecordListV2/RecordV2 |
| `/api/modules/classes/v2/records/{id}` | GET `getRecordV2` 与 PUT `updateRecordV2`；RecordV2 |
| `/api/modules/classes/v2/records/{id}/deletion` | POST `setRecordDeletionV2`；原 Deletion 请求与完整 RecordV2 响应 |
| `/api/modules/classes/v2/source-records/{kind}/{id}` | GET `listSourceRecordsV2`；kind 为 lesson/question/math，返回 RecordListV2 |

新客户端所有记录列表、详情、保存、删除恢复和三类反向查询都使用 v2，避免仅数学页升级后备课/题库反馈读不到混合记录。班级 CRUD、`classes.readClass/readRecord`、schedule 的摘要和 HTTP 路径保持原状。

| 请求情形 | 确定结果 |
| --- | --- |
| v2 读取或编辑旧 lesson/question 记录 | 不改 ID；纯读取不升版；正常保存只加一次版本，无强制补 math |
| 旧路径读无 math 且 content 为空的记录或匹配列表 | 原成功形状和语义不变 |
| 旧 GET 详情读到 math；旧列表/反查的匹配集合含 math | 整次 `422 invalid-input`，`reason=unsupported-content-version`；详情 `field=/sources`，列表/反查 `field=/items`。不省略来源、不漏记录、不返回部分结果 |
| 旧 PUT/删除恢复目标已含 math，使用新键及当前版本 | `422 invalid-input`，`field=/sources`，`reason=unsupported-content-version`，即使请求试图省掉 math 也不写入 |
| 旧写目标已含 math，但 expectedVersion 已过时 | 先返回原 `409 version-conflict`（currentVersion/objectId）；获取 v2 对照后再决定 |
| 旧请求体主动提交 math，或旧反查路径 kind=math | 仍按旧严格请求 schema 拒绝 `422 invalid-input`；kind 非法定位 `/sources/<i>/kind` 或 `/path/kind`，reason=invalid-reference，不把旧接口升级成接受 math |
| 旧成功请求丢响应，随后记录被 v2 加入 math | 在原方法/路径，以原键原体重放原成功状态和原结果，先于当前版本与可表示性检查；随后 v2 GET 当前内容，不拿旧成功回执覆盖新状态 |
| 把已成功的旧键用于 v2 路径 | `409 idempotency-key-reused`；键作用域仍为账户并绑定方法/规范路径/原体，不是各路由独立空间 |

处理顺序沿 B11：身份/保护、JSON/基本 schema、成功键重放、对象归属、版本、旧接口可表示性及其他领域校验、同事务写入。旧 schema 不变；可表示性守卫是新服务在旧路由上的保护。v2 读取旧记录后若移除了全部 math 来源且 content 为空，当前对象可再被旧路径表示，但任何旧 expectedVersion 仍正常冲突。已删除记录也受同样保护。

### 反向查询与删除

`classes.listSourceRecordsV2(principal,{kind,id})` 与 HTTP 同语义。先通过对应提供方确认来源属于本账户，允许本账户 tombstone；不存在/外账户 404，读取故障 503。再筛活动记录和活动班级，按 recordedOn 降序、createdAt 降序、ID 升序返回完整 RecordV2。来源已删除不减少反馈，归档班级或删除记录时从活动反馈中排除，各自恢复才重新出现；彻底删除班级后反馈不再存在；同一记录连同作品多次被拒绝，因此一条记录只返回一次。

反向查询仍须先确认查询来源；成功后，记录中其他已有关联的 404/503 按 UnavailableSourceV2 返回，保留记录正文，不降格为“暂无反馈”。记录属于的班级名称由现有 readClass/班级读取获得。数学页面只经组合层使用此接口/反馈组件，不给 math 服务端注入 classes，不产生必需依赖环。

### 目录与组合

当前目录使用 `ModuleCatalogV3`。classes 同步消费 `questions.readForReferenceV2`、`lessons.readForTeachingLink`、`math.readForTeachingLinkV1`；math 服务端不依赖 classes，反馈由前端组合，避免反向等待。目录只注册真实实现，缺依赖/重复/环路阻止装配。

新增关联、反查入口与旧路径传播提供方真实 404/503；v2 既有关联按上述异常投影处理。只有成功读取 tombstone 才显示已删除。新版接口和样本可用不等于实际往返已验，验证[教学场景](../acceptance/teaching-time.feature)与真实提供方；阶段完成条件见[DAG](../plans/mvp-dag.md)。

## 丰富题目关联

当前 classes 采用 `questions.readForReferenceV2`。选择器确认只改草稿，保存才建立关系；从题目返回原记录，保留文字、日期、展开和滚动；题目可反查各班反馈。本节拥有该消费者接缝，题库正文仍由材料契约定义，教学记录不保存题面快照。

### 当前题目消费规则

本节只约定教学对材料题目的消费，沿用既有 HTTP 操作、字段、来源 kind、内容版本和数据库结构，其余行为见本页基础与数学关联规则。

| 消费位置 | 本约定的确定调用和结果 |
| --- | --- |
| 教学题目选择器 | `GET /api/modules/questions/v2/items?q=…&state=active`，操作 `listQuestionsV2`，响应沿材料 `QuestionList`。显示本账户全部匹配题，包括 Document v1/v2、导入来源和复制来源；不按旧端口可表示性筛除题。请求失败显示重试并保留已选项，不显示空题库。 |
| classes 的题目读取 | 同步 `questions.readForReferenceV2(principal,id)`，返回材料 `ReferenceReadQuestion`。工厂要求该端口，与 classes 使用同一 DB/事务连接；缺端口即装配失败，不能回退旧端口或访问 questions 内部仓储。新建关联、保留关联的响应投影、详情、列表、删除恢复响应及反查归属确认均使用它。 |
| 来源投影 | 读取 `id/version/deletedAt/snapshot.title`；标题处理沿 T50，首次标题由服务器取得。同一 kind/id 保留原 `labelAtLink`；`currentLabel/deleted`按当前来源派生。返回中其余 snapshot 内容不写入记录，也不作为快照版本承诺。 |
| classes HTTP 与反向端口 | 新 Web 继续使用现有 classes v2 全套记录操作及 `listSourceRecordsV2`。旧 classes 路径也共用上述题目读取；无 math 的记录仍是旧 schema 可表示的链接，即使题目正文已变丰富。含 math 的旧读写守卫仍按 T50 数学扩展拒绝有损表示。 |
| 题目打开和反馈 | 使用现有材料 `getQuestionV2` 与丰富内容阅读器；真实题目详情装配 `SourceRecordsPanel(kind=question,id=当前已保存题目ID)`，消费 classes v2 反查。只读删除题仍可查看反馈。题目页内部切题时反馈跟随当前实际题目，不只跟随可能滞后的 URL。 |
| 其他来源 | 备课保持 `lessons.readForTeachingLink`，选择器保持集成候选的 lessons v3；math 保持 `readForTeachingLinkV1`、真实作品 ID、当前对象链接及原反馈。 |

题目 ID、正文/答案/原稿定位/复制来源/文件、业务 version、笔记、教学记录原文和首次标题均保留。纯读不写回旧行、不增加版本，不复制出“教学专用题”。老师只改教学文字不能重写题目；题目更新不能重写教学记录。标题投影不是内容降级，题目正文始终由题库的 v2 路径无损打开。

旧 questions HTTP、`questions.readForReference`及旧 lessons 请求的成功重放和不可表示性保护全部保留。不要把旧端口改名为 v2 的别名，也不要全局替换旧客户端方法，使未知旧写入改走新路径。classes 的旧成功键仍在原方法/路径按原键原体重放，随后读取 v2 当前记录；schema、版本冲突与账户隔离顺序沿冻结契约。

#### 目录组合

当前 classes descriptor 的 `requires` 精确为：

```json
["questions.readForReferenceV2", "lessons.readForTeachingLink", "math.readForTeachingLinkV1"]
```

只替换旧目录 classes.requires 的题目项。仍使用 `ModuleCatalogV3`、`version=3`、原模块顺序与实际注册子集；名称、路径、其余依赖和 `modulePorts` 映射保持。v3 schema 已同时允许两个题目端口名，所需映射已存在，因此无需新目录 schema/version 或新能力发现层。保留旧映射供原调用方使用。classes 缺新版端口或缺提供方、重复 ID/path、依赖环仍阻止装配。

固定输入副本及其 manifest 保留原字节；当前目录组合使用上表新版题目依赖，旧样本不是现行组合的竞争定义。

### 必要成功、失败与恢复用例

以下 `WB-MTA001-007` 是本接缝的增量验收清单，Given/When/Then 为预期，实际已有局部实现/证据，完整范围不能由样本代签。沿用原 TT-U3、WB-T003/017/018 与 WB-TM002/005-009，不复制完整教学或材料验收套件。

| ID | Given / When | Then 与关闭证据 |
| --- | --- | --- |
| WB-MTA001 混合题库选择 | Given 同账户有 v1 手工题、v2 图片/表格/选项和公式题、已确认导入题及丰富复制题；另一账户有同名题。When 从班级记录进入题目页签搜索、勾选、取消，再确定并保存。 | GET v2 成功且匹配项完整、外账户不可见；取消不写库，确定仅草稿变化，保存只新增/更新一条记录。网络证据确认不再调用旧 questions/items；记录来源只有 kind/id，首次标题由服务器取得。 |
| WB-MTA002 已有记录与保库 | Given 旧记录关联 v1 题且有旧成功回执。When 将同 ID 的题目正常编辑为丰富内容，读取记录、保留关联改文字、删除恢复记录，再刷新/保库重启。 | 题目未被降级；纯读保持记录 ID/version/updatedAt/原文/labelAtLink，当前标签反映题目。每次显式记录写只升一次版本；旧无 math 记录仍可由旧 classes 路径表示。DB 行、关联顺序与旧回执保持，旧成功重放不重新读取来源。 |
| WB-MTA003 来源往返与两班反馈 | Given 两班各自关联同一丰富题，原记录有未保存文字、滚动及 AI 输入。When 打开题目、从产品入口返回记录，并从题目反馈打开另一班记录。 | 原 ID 的丰富正文/答案/图片/表格/公式完整，题目未被打开动作保存；原记录现场恢复，两班文字不覆盖。当前题目详情反馈使用 v2，包含混合 question/lesson/math 来源完整记录；题内切换后不串题。桌面 1440×900、平板 768×1024 截图及操作证据，无遮挡/横溢出。 |
| WB-MTA004 删除与失败区分 | Given 已保存丰富题关联，另有选择后尚未保存的关联。When 来源软删除、恢复、移除后重连；分别让提供方返回成功 tombstone、真实 404、503。 | 保留链接允许读、改其他文字及记录删除恢复；新连删除题 409 reference-deleted，移除后重连按新链接判断。v2 已有关联的 404/503 保留正文与保存时标题，标记 unavailable；新增关联、反查入口和旧路径仍传播错误并原子回滚，不假删除、不假空反馈。草稿和已选项保留，可重试或显式移除异常来源。班级归档或记录删除影响活动反馈筛选；彻底删除班级按前述独立操作清理记录。 |
| WB-MTA005 版本、身份与未知结果 | Given 关联丰富题的记录写入已提交但丢响应，或并发修改使 expectedVersion 过时。When 原键原体在原路径确认，或读取当前版本对照后新键保存；再测试无身份与外账户。 | 原请求只提交一次，后续草稿不被旧回执覆盖；409保留对照，401锁定当前账户草稿，外账户404且不泄漏题目/记录。相同成功键换路径仍409 idempotency-key-reused。 |
| WB-MTA006 旧协议保护 | Given 新题库含旧接口不可表示题，且一条 records v2 记录同时关联丰富题与真实 math。When 请求旧题目列表/详情/引用，及旧 classes 详情/匹配列表/反查/写；对照请求新版。 | 旧 questions 继续422 unsupported-content-version，不漏题、不删节点；旧 classes 因 math 继续按 /sources 或 /items 拒绝，过时版本先409、已成功键先原样重放。classes v2完整返回所有来源，题库v2无损读取，真实数学往返与反馈保留。 |
| WB-MTA007 目录与相邻摘要 | Given 新组合使用限定修订目录及真实 questions/lessons/math。When 校验依赖并访问三种来源的记录与反查，再调用日程所用 readRecord 摘要。 | 目录相对固定样本只变 classes 题目依赖，缺 readForReferenceV2 即失败且不回退。题目/备课/数学反查均返回完整记录；readRecord仍不解析完整来源，提供方故障不阻断原日程摘要。 |
