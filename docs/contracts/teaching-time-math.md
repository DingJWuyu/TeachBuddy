# 教学记录关联数学作品契约 v2

状态：`T50-MATH-CONTRACT@1 / attempt 1`，`READY_FOR_REVIEW/self`，待外层独立冻结。实现入口为本页与[完整 OpenAPI](teaching-time/teaching-time-math.openapi.json)，交换预期见[用例](teaching-time/math-cases.md)及[样本](teaching-time/math-samples.json)。旧 [T50 v1](teaching-time.md) 是固定输入，原文件与证据保留；新版只覆盖本页明确列出的记录来源、兼容保护和目录响应。

## 用户结果与固定来源

教师在班级记录中选择一个已有作品，保存后能打开当前作品，再返回原记录现场；作品页能查看各班独立反馈。作品改名不改反馈原文，作品删除不丢反馈。此流程和错误恢复见[故事](../user-stories/teaching-time-math.md)、[UX](../ux/teaching-time-math.md)、[BDD](../acceptance/teaching-time-math.feature)。

| 输入 | 固定版本与读取位置 |
| --- | --- |
| T50 时间、提醒、普通班级与记录 | `afda1c5d8d8c2de93f1e045ff2ad32e2681bd116`，本地 `teaching-time.md`、`teaching-time/` 原 schema/cases/samples 及对应 arch/UX/故事/BDD；独立冻结 `f9eb35f2180576daee4aedfb114049f4cb357694:docs/acceptance/evidence/T50/v1/correction2-review.md` |
| M40 提供方 | `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md`；设计 `a6a495a7df6a870f455a431a2ac4169c79a37504`，三项实验阻断的独立关闭 `b01bc73954cbbc13e464738e0f6f8aa6c6f12084` |
| 精确数学扩展 | [原扩展副本](teaching-time/inputs/m40/docs/contracts/workbench/math/teaching-time-extension.md)、[原 schema 副本](teaching-time/inputs/m40/docs/contracts/workbench/math/math.openapi.json)，均逐字节取自上述 M40 SHA；完整来源清单见 [manifest](teaching-time/inputs/manifest.json) |
| 消费者事实，仅作交接参考 | 产品 `89fe81bcd9c93e0b2c6af10b595cdf22eb5c75bd`，回执 `c8bd75a151fc1f3b405d8f58b6de182c5fa76be9:docs/acceptance/evidence/T53/v1/author.md`；T54 继续验此旧候选 |

源文件未放入本包时，用 `git show <完整SHA>:<path>` 读取；不跟随其他 worktree HEAD。固定输入副本中的候选状态是其原始内容，冻结依据以本表的独立回执为准，不改写旧证据。

## 来源与保存

`SourceInputV2 = SourceInput | TeachingMathInput`，`SourceV2 = Source | TeachingMathSource`。数学分支外引 M40 原 schema，精确标识为 `kind=math`，不是 `work`。选择器调用 M40 `listWorks`（`GET /api/modules/math/v1/works`），只选本账户 `state=active`；支持其五种 kind，`render=invalid` 也允许关联。教学反馈不要求导出成功，不使用备课版本快照或 File ID。

首次关联由 classes 在记录写事务中同步调用 `math.readForTeachingLinkV1(principal,id)`；保存服务器读取的 `title` 为 `labelAtLink`，客户端只提交 kind/id。`TeachingWork.version` 只用于提供方投影，不持久化为关联版本，不做 reference-version-conflict。作品在选择后改名，最终以保存事务读取的标题为准；在保存前删除则整个保存失败。

读取时派生 `currentLabel=title`、`deleted=(deletedAt != null)`。同一 `kind+id` 保留原 `labelAtLink`；作品修改、删除、恢复只改变派生字段，不改变记录的 version、updatedAt、文字或 recordedOn。重复 kind+id 在后一个 `/sources/<i>/id` 返回 `422 invalid-input / duplicate-id`；source 顺序沿请求数组保留。空标题只在界面显示“未命名作品”，不改 provider 或 label 字段。

| 作品状态/操作 | 保存和读取结果 |
| --- | --- |
| 活动作品首次关联 | 原子保存记录和首次标题；`render=invalid` 不阻断 |
| 已保留的链接，作品软删除 | 仍可读取并标已删除；编辑原记录其他文字、重排 sources、删除/恢复记录均可保留该链接 |
| 新链接到已删除作品 | `409 /problems/workbench/reference-deleted`；整条记录不写入 |
| 成功移除后再添加 | 算新链接；作品仍删除则拒绝，已恢复则以当次 title 重新保存 labelAtLink；同次 PUT 中仍有原 kind/id 算保留 |
| 作品恢复 | 既有链接 deleted=false，无需重存记录；记录或班级自己的删除状态不随之恢复 |
| 提供方不存在/外账户 | `404 not-found`，不暴露标题/版本；既有链接读取也返回失败，不制造 tombstone |
| 提供方存储失败 | `503 temporarily-unavailable`，不显示空列表或已删除；写入及成功幂等回执全部回滚 |

班级删除后记录只读、记录的 classId 不可更换、文字至少一项非空、100 个来源上限及所有排序/版本规则原样继承 T50。新建不要求关联；取消作品选择不写记录。来源异常时可保留草稿重试；显式移除异常来源后按新请求保存，不自动清空 sources。

## 完整操作与新旧兼容

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
| 旧路径读无 math 的记录或匹配列表 | 原成功形状和语义不变 |
| 旧 GET 详情读到 math；旧列表/反查的匹配集合含 math | 整次 `422 invalid-input`，`reason=unsupported-content-version`；详情 `field=/sources`，列表/反查 `field=/items`。不省略来源、不漏记录、不返回部分结果 |
| 旧 PUT/删除恢复目标已含 math，使用新键及当前版本 | `422 invalid-input`，`field=/sources`，`reason=unsupported-content-version`，即使请求试图省掉 math 也不写入 |
| 旧写目标已含 math，但 expectedVersion 已过时 | 先返回原 `409 version-conflict`（currentVersion/objectId）；获取 v2 对照后再决定 |
| 旧请求体主动提交 math，或旧反查路径 kind=math | 仍按旧严格请求 schema 拒绝 `422 invalid-input`；kind 非法定位 `/sources/<i>/kind` 或 `/path/kind`，reason=invalid-reference，不把旧接口升级成接受 math |
| 旧成功请求丢响应，随后记录被 v2 加入 math | 在原方法/路径，以原键原体重放原成功状态和原结果，先于当前版本与可表示性检查；随后 v2 GET 当前内容，不拿旧成功回执覆盖新状态 |
| 把已成功的旧键用于 v2 路径 | `409 idempotency-key-reused`；键作用域仍为账户并绑定方法/规范路径/原体，不是各路由独立空间 |

处理顺序沿 B11：身份/保护、JSON/基本 schema、成功键重放、对象归属、版本、旧接口可表示性及其他领域校验、同事务写入。旧 schema 不变；可表示性守卫是新服务在旧路由上的保护。v2 读取旧记录后若移除了全部 math，当前对象可再被旧路径表示，但任何旧 expectedVersion 仍正常冲突。已删除记录也受同样保护。

## 反向查询与删除

`classes.listSourceRecordsV2(principal,{kind,id})` 与 HTTP 同语义。先通过对应提供方确认来源属于本账户，允许本账户 tombstone；不存在/外账户 404，读取故障 503。再筛活动记录和活动班级，按 recordedOn 降序、updatedAt 降序、ID 升序返回完整 RecordV2。来源已删除不减少反馈，班级/记录删除则从活动反馈中排除，各自恢复才重新出现；同一记录连同作品多次被拒绝，因此一条记录只返回一次。

反向查询返回的每条记录包含全部来源；任一来源投影失败则整次失败，不降格为“暂无反馈”。记录属于的班级名称由现有 readClass/班级读取获得。数学页面只经组合层使用此接口/反馈组件，不给 math 服务端注入 classes，不产生必需依赖环。

## 目录与实际冻结版对照

M40 原扩展参考 `acbf48f01b5dc15373546545af80fa2e7e79f0c3`。本次比对确认该提交和实际冻结 `afda1c5d8d8c2de93f1e045ff2ad32e2681bd116` 的教学时间契约正文、架构、OpenAPI 逐字节相同；冻结版的样本边界与证据按实际冻结输入保留。record/source 形状、事务、删除、摘要与排序无提供方冲突。

唯一必须替换的共享响应是 `GET /api/modules`：新装配采用 M40 `ModuleCatalogV3`，classes.requires 增加 `math.readForTeachingLinkV1`；顺序为 questions/lessons/math/resources/classes/schedule 的实际注册子集，不注册虚模块、不删除已有 resources/math。重复 ID/path、缺依赖、依赖环继续沿 T50 校验与 Problem 定位。全六模块样本是组合目标，不是本次已运行状态。目录写者与接续条件见[架构](../arch/teaching-time-math.md)。

T51 旧回执把“来源提供方 404 投影已删除”列为待确认行为；这与冻结 T50“读取失败不伪装已删除”和 M40 tombstone 契约不一致。最小裁决归 T51：本次适配必须传播 404/503，只有成功读取 deletedAt 才标已删除，并复验受影响旧来源分支；不是修改数学提供方，也不改 T54 正在验的旧输入。未发现其他需 M40 改字段的冲突。

## 交付门槛

本候选不改 T50 的时间、重复例外、提醒唯一性/captureDue、普通班级规则及计划和实际分离。独立设计冻结后 T51 可按[补接任务包](../plans/tasks/teaching-time-math-T51.md)实现；真实提供方未到时可做同版替身自验并明确待接。M43 消费[架构交接](../arch/teaching-time-math.md#接续与单写者)组合反馈。完整作品关联仍需真实提供方、M44 和 WB-T020/T54 的真实流程证据；本设计与样本通过均不代表功能 PASS。
