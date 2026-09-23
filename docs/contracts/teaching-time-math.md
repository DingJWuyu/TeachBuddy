# 教学记录的数学关联与 v2 兼容

精确字段见 [OpenAPI](teaching-time/teaching-time-math.openapi.json)，交换场景见 [math-cases](teaching-time/math-cases.md)。数学 Source 类型取[固定输入](teaching-time/inputs/README.md)。本页拥有记录链接与兼容行为，不复制数学制作模型。

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

## 目录与组合

当前目录使用 `ModuleCatalogV3`。classes 同步消费 `questions.readForReferenceV2`、`lessons.readForTeachingLink`、`math.readForTeachingLinkV1`；math 服务端不依赖 classes，反馈由前端组合，避免反向等待。目录只注册真实实现，缺依赖/重复/环路阻止装配。

提供方真实 404/503 必须传播，只有成功读取 tombstone 才显示已删除。新版接口和样本可用不等于实际往返已验，验证[教学场景](../acceptance/teaching-time-math.feature)与真实提供方；阶段完成条件见[DAG](../plans/mvp-dag.md)。
