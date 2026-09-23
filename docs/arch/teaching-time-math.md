# 教学时间消费数学接缝

数学扩展已独立冻结，固定来源见[输入索引](../plans/run-inputs.md#暂停与后续设计)。[扩展契约](../contracts/teaching-time-math.md)拥有行为，schema 拥有字段；原[教学时间架构](teaching-time.md)的单 SQLite、同步事务、记录摘要、时间和提醒实现约束保留。实现与验收状态由[教学入口](../modules/teaching-time.md)导航，不从初始节点分工推断当前进度。

## Interface 与持久化

classes Module 吸收来源联合与全部兼容保护，消费者不各写一套判断。工厂在原参数上显式增加 `math`，通过同步 `math.readForTeachingLinkV1(principal,id)` 获取 `TeachingWork`。依赖必须与 classes 使用同一数据库/事务连接；正式启用 v2 时缺端口即启动失败，无生产 no-op 或字符串目录。T51 的同版 adapter 只供隔离自验，回执单列替身。

| Interface | 结果与归属 |
| --- | --- |
| v2 records HTTP/中立业务操作 | schema 的六个 v2 operationId；classes 独占保存、来源标签、版本、幂等及删除恢复 |
| `classes.listSourceRecordsV2(principal,{kind,id})` | 同步 RecordListV2，与 v2 HTTP 同语义；T51 提供 |
| `classes.listSourceRecords` | 保留旧联合与可表示性守卫；新反馈组件升级到 v2 |
| `classes.readClass/readRecord` | 原 ClassReference/RecordReference；readRecord 不解析完整 sources、不调用 math，故作品服务故障不阻断日程读取摘要 |
| `math.readForTeachingLinkV1` | M41 提供；M42 后续共用，classes 只读该 Interface，不读 math 表或 HTTP 回环 |

教学来源仍存 `kind/id/labelAtLink`，原可信账户、记录 ID/version/时间、数组顺序及软删除不变；currentLabel/deleted 按公开读取派生。新增 kind 的约束/索引迁移归 classes，使用新的 `classes_` 前缀迁移；不改旧迁移、不另建关联平台、不保存 workVersion/源码/文件快照。若旧表约束需要重建，逐条保留旧链接、顺序与首次标题。账户+record+kind+id 唯一，反向查询使用本模块数据。

新旧路由共用聚合和账户幂等账本。旧成功响应原样留存，不补 math、不迁移键绑定路径、不改成功回执；空库和含旧记录/未知请求的 T51/T53 库都要验证升级重启。v2 纯读不批量写旧行。读取旧混合记录的防丢守卫与 v2 事务校验在 classes 内实现，schedule 不学习 SourceV2。

提供方 503 在整个写事务内回滚；成功提交后响应丢失按原键原体确认。来源删除和添加记录的先后由同一同步事务串行化：先删则新链接拒绝，先保存则随后显示 tombstone。没有跨模块事件广播、级联删除或异步补关联。

## 接续与单写者

| 责任方 | 独占写入与交接 |
| --- | --- |
| T51 补接 | `apps/api/src/modules/classes/`、`apps/web/src/features/classes/`，含来源选择、v2 客户端、反馈组件、迁移；`apps/api/test/teaching-time-classes*`、`apps/web/e2e/teaching-time-classes*` 及独占 fixtures；新回执 `docs/acceptance/evidence/T51-MATH/v1/`。不改 math、schedule、共享入口或根台账。 |
| M41/M42 | 按 M40 提供真实作品目录、tombstone 读取、稳定回看与生命周期；本包不改提供方设计或扩其任务范围。 |
| M43 | 按 M40 的写权，在 `apps/web/src/features/math/` 内接反馈容器及稳定打开/返回；仅消费 classes 导出的组件或 v2 HTTP，不往 math server 注入 classes。已有备课/题库反馈也须消费 T51 新组件的 v2 行为。 |
| 外层指定唯一装配者 | 串行接手当时实际共享目录、API/Web 入口与迁移 runner；若仍由 T53 持有须先取得停写交接，不能因本包而并发抢写。完整文件范围沿 M40 的 M43 包；实际替代路径由外层固定。 |

共同装配采用 M40 `ModuleCatalogV3`，不能用旧四模块目录覆盖 resources/math。classes 必需 math 的教学读取，math 无 classes 服务端依赖；反馈是可选前端组合。未挂 classes 时 M43 的数学制作/备课往返与 M44 提供方验收可独立推进，不把反馈反向列为 M44 前置。挂上真实 classes 后再验证 WB-T020。

任务固定扩展契约版本、产品基线、真实提供方和共享写者。真实提供方未到只报告局部结果；完整 T51 的作品条件仍需真实 M44 输入。M43 启动与完成门槛按当前 DAG，反馈接入另需 T51 固定输出。组合改变后由 T54 验证新候选，不把旧候选结论自动转移。

## 必要验证与冲突归属

设计期只做 schema 解析、固定输入校验、样本、链接、旧定义一致性自检。T51 实现期经公开 HTTP 验证新旧 CRUD、反向查询、同键重放、来源 404/503 和迁移；浏览器验证选择与两班往返。M43/后续单写者补真实组合，M44 先验作品提供方，T54 验 WB-T020 与受影响旧场景。样本替身不替代这些真实证据。

旧 T51 回执的 404→deleted 属消费者偏差，归 T51 最小修正；math 字段和 tombstone 语义无冲突。目录 v2/v3 的组合差异已有 M40 明确决策，归唯一装配者采用 v3；时间/提醒不改。若固定真实提供方违反 TeachingWork/404/503，则归 M41/M42 修实现；若未来发现冻结输入之间的新语义冲突，交 T50/M40 对受影响接缝裁决与独立冻结，不由实现者临时加字段。
