# 数学作品与教学时间的扩展交接

状态：M40/v1候选扩展，尚未与T50联合冻结或集成。只读参考 `acbf48f01b5dc15373546545af80fa2e7e79f0c3` 的 `docs/contracts/teaching-time.md`、`teaching-time/teaching-time.openapi.yaml`、`docs/arch/teaching-time.md`。用 `git show <SHA>:<path>`读取，不修改这些候选，也不从T50当前分支取漂移输入。

## M40提供方

唯一字段为[math schema](math.openapi.json)的TeachingWork、TeachingMathInput、TeachingMathSource。同步 `math.readForTeachingLinkV1(principal,id)` 返回稳定ID、当前version/title/deletedAt，404隐藏外账户，存储异常为503；软删除仍可读。GET/listWorks提供作品选择目录，稳定回看路径 `/math?workId=<UUID>`，由工坊路由取真实授权对象并显示活动/已删除状态，不把query作为授权。导航到作品可保留classes设备现场。

选择器使用listWorks的q/kind/state=active，可列公式、plane、space、dynamic、html；render=invalid仍可记录教学反馈，教学关联不要求可导出，不需要版本快照。父界面使用稳定ID，不能只保存作品标题或文件路径。

## T51需要消费的新增版本

以下是对已读T50候选的精确增量要求。T50冻结后，由教学时间拥有者在自己的新版中外引本schema分支并重验受影响case；这不是允许实现者修改T50未定版。

| 接缝 | 新版变更 | 保留语义 |
| --- | --- | --- |
| SourceInput | 与旧lesson/question分支做oneOf，追加TeachingMathInput（kind=math、id） | 不接纳workVersion/accountId/任意attrs；kind+id仍唯一 |
| Source | 同样追加TeachingMathSource | labelAtLink服务端首次读取保存；currentLabel/deleted只读派生，来源更新不改记录version/原文字 |
| record创建/修改/读取/列表 | 新增 `/api/modules/classes/v2/records`及`/{id}`的对应操作，body/结果只替换sources联合；原其他字段、状态码、排序、expectedVersion不变 | record/class软删除和恢复仍按T50；旧路径能表示的对象不变，含math时旧读/列表/写拒绝unsupported-content-version，先重放旧成功请求 |
| 反向反馈 | `classes.listSourceRecordsV2(principal,{kind,id})` 与 `/api/modules/classes/v2/source-records/{kind}/{id}（kind=math）` | 活动记录且活动班级，按recordedOn/updatedAt降序再ID；不存在/外账户404，已删来源可列保留链接 |
| classes工厂 | 在原db/mutations/questions/lessons外显式注入math提供方 | 同事务同步核对；不读math表，不反向注入classes到math |
| 目录 | classes.requires追加math.readForTeachingLinkV1；同批公共目录采用math ModuleCatalogV3 | 无虚注册，不移除现有资源/数学模块，不改变schedule业务 |

新版record删除/恢复路径也需 `/api/modules/classes/v2/records/{id}/deletion`以返回新Record联合；v1删除响应不能丢sources。班级CRUD、readClass、readRecord给schedule的摘要形状不变。来源类型变化不会把日程安排变成已经授课，也不修改T50日期/提醒定义。T50旧schema仍拒绝math，直至其拥有者发布该增量的完整可解析OpenAPI及样本，M40不冒充已经发布。

## 交换与归属

按MC10和WB-MA018：活动作品首次关联保存labelAtLink；改名后只currentLabel变；作品删除保留既有链接并标已删；新建链接到已删源拒绝；移除后再加视为新链接；外账户404；provider503不能伪装deleted。新链接与record保存同一事务。反馈回看当前作品，不是备课采用版本快照。

M41提供readForTeachingLinkV1和真实作品目录；T51拥有classes内部适配、记录新联合及反向HTTP；M43拥有math页面反馈容器；T53按外层单写者交接挂真实反馈组件和目录，不自行改math内部。需要新的T50扩展独立冻结才能启用消费者；T51普通lesson/question行为可继续，完整作品关联self PASS仍等M44。M40完成仅解除提供方设计缺口，不解除T50/M44条件。WB-MA018归T51/T54，M44先验作品提供方，不把classes反馈接真设为M44前置。
