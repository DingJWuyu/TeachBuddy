# 共享事务与模块接缝

业务语义见[共享契约](../contracts/workbench.md)，本页保留基础端口约定；丰富内容按[材料](materials.md)、[数学](math.md)、[教学时间](teaching-time.md)的明确扩展消费。

## 模块与接缝

遵守 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)。权威静态目录位于 `packages/shared/src/`，基础格式见 OpenAPI 的 ModuleCatalog 与同名样本，扩展目录由材料及数学契约定义。当前六模块目录及接缝在 `packages/shared/src/`，日程为 top 类型。questions 无业务依赖，lessons 必需 questions 的引用读取端口。目录纯数据，Web/API 从同一目录投影到各自本地代码映射；构建检查缺映射、重复 ID/路径、缺依赖与环路，启动前检查迁移。停用或隐藏导航不代表拒绝模块 API。

下表描述基础 v1 接缝。当前模块工厂另注入材料及数学依赖，具体参数见对应架构；`readForReference` 保留供旧调用方，当前丰富引用使用 `readForReferenceV2`。模块内部文件、组件和 SQL 由所属模块维护。

| 接缝 | 约定 | 写者/消费者 |
| --- | --- | --- |
| 身份 | 服务端 `resolvePrincipal(request)` 返回 Promise 或值 `{accountKey}` / null；异步中间件等待完成，写入时携带已验证 principal。Web 用 OpenAPI 的 context 分区。 | B12 seam；A11 真实 adapter；B13 使用 |
| 存储 | B12 在组合入口提供同一隔离库的 `better-sqlite3` Database 实例 `db`；模块拥有自己的表，不暴露仓储给别的模块。 | B12 提供；B13 模块使用 |
| 幂等事务 | `mutations.execute({principal, key, method, path, body}, write)`；同步 write 在该 db 事务内返回 `{status, body}`，execute 返回同形结果或契约错误。来源/身份/schema 校验先于调用；模块在 write 内做归属、版本和业务校验。 | B12 提供；B13 使用 |
| 模块工厂 | `apps/api/src/modules/questions/index.js` 导出 `createQuestionsModule({db, mutations})`，返回 `{router, port}`；lessons 对应 `createLessonsModule({db, mutations, questions})`。router 为 Express Router，挂载 `/api/modules/<id>`，请求 `req.workbenchPrincipal` 已验证。 | B13 导出；B12 组合入口挂载 |
| 题目公共端口 | `port.readForReference(principal, questionId)` 同步返回 `{id, version, deletedAt, snapshot}`，无权/不存在抛契约 404。snapshot 同 OpenAPI。调用者在同一写事务内判断当前版本与删除状态；读操作也可查已删除源状态。 | questions 提供；lessons 使用 |
| 业务工具调用 | 两模块对外行为即 OpenAPI 中的操作集合；现有首批 Agent adapter 携带可信 principal 调用同一业务操作及 mutations，不另写 SQL。pi adapter 形式已在[Agent 接缝](agent.md)定义；全六模块扩展仍暂停。 | B13；C25/C26 消费 |
| 模块迁移 | 各模块 `migrations/index.js` 导出有序 `migrations` 数组，项 `{id, up(db)}`；ID 前缀 questions_/lessons_，成功 ledger 与迁移同事务，已执行 ID 不重跑。 | B13 提供；B12 runner 汇总 |
| Web 入口 | 两 feature 的 `index.jsx` 默认导出 React 页面；外壳处理 route、可信 accountKey、共享右栏和按账户的本地恢复。模块 API client 只调用唯一 OpenAPI。 | B14 独占，无需后端参与 UI 内部设计 |

SQLite 内业务写入和幂等成功记录一个事务提交，不使用先写题目再补操作记录的分步确认。公共端口及 write 回调的已知失败抛出带 `status` 和 `problem`（OpenAPI Problem）的 Error；execute 回滚后原样传播，由工作台 HTTP 层映射。未知存储错误回滚并映射 503。write 不返回 Promise，事务中不进行网络调用。模块路由错误按契约返回，单个页面/API 错误不清空别的模块现场。读引用时只过 questions 公共端口；使用位置过 lessons HTTP 操作，避免 questions -> lessons 的反向必需依赖。文件接口见[材料架构](materials.md)。

## 持久化与演进

| 数据 | 所有者 | 最小持久内容 |
| --- | --- | --- |
| 题目 | questions | 可信账户、稳定 ID、版本、题面/答案、独立笔记与标记、不可改来源、时间/软删除 |
| 备课 | lessons | 可信账户、稳定 ID、版本、文稿、环节与引用顺序、服务端题目快照、本课备注、时间/软删除 |
| 已确认请求 | 公共 mutations | 账户+键唯一、操作/请求指纹、成功状态码/响应，与业务同事务 |
| 本地草稿/现场 | Web，各模块在外壳约定的账户分区内 | 服务器基线版本、编辑输入、未确认请求的原键/体、返回上下文及 UX 指定现场 |

聚合存储由所属模块实现，外部只依赖 OpenAPI。更新请求不能接受客户端自造 snapshot。基础 v1 来源和引用保存题面快照，不建立全历史版本库。旧引用的快照由 lessons 持有，复制来源快照由 questions 持有，足以支持原题变化和删除后的阅读。文件/丰富内容及数学引用已分别由材料 v2 和备课 v3 扩展；按对应契约读取、迁移与兼容。未知版本只读保留，不通过转换丢失内容，也不存任意 blob 充当扩展点。

模块迁移只增不改，B12 迁移 runner 与共享存储改动独占。空库、固定输入的旧账户/布局库都需要迁移验证，保留原账户和布局。每个 worktree 独立数据库、文件目录与端口，禁止开发者共享同一写库。构建只验证代码/隔离 fixture 库，不初始化用户数据库；当前 `build:api` 使用临时隔离库核对装配。

整体备份必须包含 SQLite（含来源、引用、幂等记录）及受管文件，恢复到新目录后核对稳定 ID/关系；本地草稿另按设备保留，不承诺换设备恢复未上传输入。
