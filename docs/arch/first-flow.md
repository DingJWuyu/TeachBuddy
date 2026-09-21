# First-flow 实现边界

状态：既有模块接缝按 B11/v1 冻结；当前 HTTP 页面头接续候选等待限定独立冻结，旧输入与当前消费范围见[契约版本](../contracts/workbench.md#消费版本与验收范围)。产品语义只见 [契约](../contracts/workbench.md)，字段只见 [OpenAPI](../contracts/workbench/first-flow.openapi.yaml)。React/Vite、Express、better-sqlite3 沿用现有工程；本批不建立插件系统、事件总线、任务平台或独立服务。

## 模块与接缝

遵守 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)。权威静态目录位于 `packages/shared/src/`，精确格式及本批两项内容见 OpenAPI 的 ModuleCatalog 与同名样本。当前消费者只有 questions、lessons；日程 top 类型在外壳中保留资格，不注册无实现的模块。questions 无业务依赖，lessons 必需 questions 的引用读取端口。目录纯数据，Web/API 从同一目录投影到各自本地代码映射；构建检查缺映射、重复 ID/路径、缺依赖与环路，启动前检查迁移。停用或隐藏导航不代表拒绝模块 API。

仅固定以下真正跨写者的接缝。未规定的文件组织、编辑器、组件拆分和 SQL 由 worker 决定。

| 接缝 | 约定 | 写者/消费者 |
| --- | --- | --- |
| 身份 | 服务端 `resolvePrincipal(request)` 返回 Promise 或值 `{accountKey}` / null；异步中间件等待完成，写入时携带已验证 principal。Web 用 OpenAPI 的 context 分区。 | B12 seam；A11 真实 adapter；B13 使用 |
| 存储 | B12 在组合入口提供同一隔离库的 `better-sqlite3` Database 实例 `db`；模块拥有自己的表，不暴露仓储给别的模块。 | B12 提供；B13 模块使用 |
| 幂等事务 | `mutations.execute({principal, key, method, path, body}, write)`；同步 write 在该 db 事务内返回 `{status, body}`，execute 返回同形结果或契约错误。来源/身份/schema 校验先于调用；模块在 write 内做归属、版本和业务校验。 | B12 提供；B13 使用 |
| 模块工厂 | `apps/api/src/modules/questions/index.js` 导出 `createQuestionsModule({db, mutations})`，返回 `{router, port}`；lessons 对应 `createLessonsModule({db, mutations, questions})`。router 为 Express Router，挂载 `/api/modules/<id>`，请求 `req.workbenchPrincipal` 已验证。 | B13 导出；B12 组合入口挂载 |
| 题目公共端口 | `port.readForReference(principal, questionId)` 同步返回 `{id, version, deletedAt, snapshot}`，无权/不存在抛契约 404。snapshot 同 OpenAPI。调用者在同一写事务内判断当前版本与删除状态；读操作也可查已删除源状态。 | questions 提供；lessons 使用 |
| 业务工具调用 | 两模块对外行为即 OpenAPI 中的操作集合；未来 Agent adapter 携带可信 principal 调用同一业务操作及 mutations，不另写 SQL。B13 在模块内保留可调用业务操作，C25 再冻结 pi adapter 的调用形式。 | B13；C25/C26 消费 |
| 模块迁移 | 各模块 `migrations/index.js` 导出有序 `migrations` 数组，项 `{id, up(db)}`；ID 前缀 questions_/lessons_，成功 ledger 与迁移同事务，已执行 ID 不重跑。 | B13 提供；B12 runner 汇总 |
| Web 入口 | 两 feature 的 `index.jsx` 默认导出 React 页面；外壳处理 route、可信 accountKey、共享右栏和按账户的本地恢复。模块 API client 只调用唯一 OpenAPI。 | B14 独占，无需后端参与 UI 内部设计 |

SQLite 内业务写入和幂等成功记录一个事务提交，不使用先写题目再补操作记录的分步确认。公共端口及 write 回调的已知失败抛出带 `status` 和 `problem`（OpenAPI Problem）的 Error；execute 回滚后原样传播，由工作台 HTTP 层映射。未知存储错误回滚并映射 503。write 不返回 Promise，事务中不进行网络调用。模块路由错误按契约返回，单个页面/API 错误不清空别的模块现场。读引用时只过 questions 公共端口；使用位置过 lessons HTTP 操作，避免 questions -> lessons 的反向必需依赖。没有通用搜索/文件端口，本批没有其消费者。

## 持久化与演进

| 数据 | 所有者 | 最小持久内容 |
| --- | --- | --- |
| 题目 | questions | 可信账户、稳定 ID、版本、题面/答案、独立笔记与标记、不可改来源、时间/软删除 |
| 备课 | lessons | 可信账户、稳定 ID、版本、文稿、环节与引用顺序、服务端题目快照、本课备注、时间/软删除 |
| 已确认请求 | 公共 mutations | 账户+键唯一、操作/请求指纹、成功状态码/响应，与业务同事务 |
| 本地草稿/现场 | Web，各模块在外壳约定的账户分区内 | 服务器基线版本、编辑输入、未确认请求的原键/体、返回上下文及 UX 指定现场 |

聚合存 JSON 或规范化表由 B13 选择，外部只依赖 OpenAPI。更新请求不能接受客户端自造 snapshot。来源和引用只保存本批必需的题面快照，不建立全历史版本库。旧引用的快照由 lessons 持有，复制来源快照由 questions 持有，足以支持原题变化和删除后的阅读。后续文件/数学节点需升级文档版本、迁移和 schema，未知版本进入只读保留而非转换丢失；不得提前储存任意 blob 字段充当扩展点。

模块迁移只增不改，B12 迁移 runner 与共享存储改动独占。空库、固定输入的旧账户/布局库都需要迁移验证，保留原账户和布局。每个 worktree 独立数据库、文件目录与端口，禁止开发者共享同一写库。构建只验证代码/隔离 fixture 库，不初始化用户数据库；现有 `build:api` 的副作用须在 B12 消除或明确隔离。

本批恢复是软删除恢复，不是整体备份已完成。F62 的后续备份边界必须包含 SQLite（含来源、引用、幂等记录）及未来受管文件，恢复到新目录后核对稳定 ID/关系；本地草稿另按设备保留，不承诺换设备恢复未上传输入。

## 并行写入与集成

| 写者 | 模块/目录所有权 | 真正共享文件的独占写入 |
| --- | --- | --- |
| B12 | `packages/shared/`；`apps/api/src/workbench/` 公共身份、mutations、迁移/存储/契约校验设施；`apps/api/test/workbench*.test.js`、`scripts/first-flow/` 与 `apps/web/e2e/fixtures/first-flow/` 的测试启动/隔离/日志设施 | 根及各 workspace `package.json`、`package-lock.json`；`apps/api/src/app.js`、`apps/api/src/server.js`、`apps/api/src/config/env.js`、`apps/api/src/core/dataStore.js`、`apps/api/src/core/moduleRegistry.js`、`apps/api/src/scripts/verify-storage.js`；`playwright.config.mjs`、`apps/web/vite.config.js`、`apps/web/e2e/helpers.js`、`apps/web/e2e/api-server.mjs` |
| B13 | `apps/api/src/modules/questions/`、`lessons/`（含迁移、业务、仓储）；`apps/api/test/first-flow*.test.js` | 无；依赖/入口请求写入 B13 回执的集成清单，由 B12 或最终 B15 接手 |
| B14 | `apps/web/src/features/questions/`、`lessons/`、`workbench/`；本批 feature 样式和 `apps/web/e2e/first-flow-ui*.spec.js` | `apps/web/src/App.jsx`、`main.jsx`、`components/WorkspaceSidebar.jsx`、`features/modules/moduleRegistry.js`、`store/useAppStore.js`、`hooks/useWorkspaceData.js`、`utils/api.js`、`styles/global.css`；只改工作台集成部分，认证表单/流程不改 |
| B15 | `apps/web/e2e/first-flow.spec.js`、`first-flow/` 故障 fixture、本批集成运行说明与证据 | 收齐固定 B12-B14 候选并终止其写入后，接手上述入口/注册/依赖文件进行必要装配，以及 `README.md` 当前状态；不重定义 schema |

各节点另拥有自己的 `docs/acceptance/evidence/<节点>/v1/`。认证文件、原型、已有 ADR、CHANGELOG、根台账/DAG 不在以上边界。API app.js 允许新增工作台组装和独立中间件挂载，不修改原认证路由语义；新业务不能落入旧 Bearer gate。B12 为共享 HTTP 层提供本组的新错误响应，认证行为及其冻结状态由认证契约拥有。

B11 独立冻结后 B12/B13/B14 可在独立 worktree 并行。B13 可先使用本包固定 seam 的测试 adapter，B14 可使用由同版 OpenAPI/cases 驱动的替身；它们的真实集成自验需补接 B12。B12 单独用目录/迁移 fixture 验证公共机制，实际业务目录条目只在对应实现导入后启用；不能留下假模块来让构建通过。B15 收齐三者固定候选，独占最后装配并跑真服务。没有共享文件双写，也不以替身结果替代 B16。

## 反馈设施与验证

B12 交付一个明确的启动命令及 reset/保留库重启用法，写到本节点回执的运行入口；具体命令名由实现者选定。该命令启动真实 Web/API、独立 SQLite/文件目录，提供同一 HTTPS 来源。测试浏览器受信任证书或由测试 runner 明确配置证书信任，Cookie 安全属性与认证已确认约定一致；测试身份由 runner 的服务端 bootstrap 绑定两个独立 Cookie jar，页面不能选择任意 principal。未配置真实 adapter 的生产业务入口 401，配置测试模式的生产进程拒绝启动。

必须能重现：无身份/另一账户、错误来源/保护头、正常提交、写事务回滚、事务提交后响应丢失、API 停止与重启、已删除/并发修改对象。故障控制限测试进程注入，不暴露可用于生产的故障 HTTP 入口。B15 从真实浏览器拦截响应或测试 runner 控制真实写事务；单纯让替身返回 500 不证明真实保存设施可靠。

每次失败保存 trace、截图、请求/响应摘要、Web/API 日志、受测 SHA、场景与测试账户代号、隔离数据位置；不记录 Cookie/密钥。失败和撤故障后的通过结果分目录，重启前后用同一 ID 再读取；至少一次新浏览器上下文证明结果来自服务端。UI 不写单元测试。既有 API/E2E 断言按当前行为核对，不能用旧“空首页/空模块”要求否定已实现模块。

## C20 需验证的问题与外部缺口

| 风险/后续消费者 | 必须回答的问题 | 当前处理 |
| --- | --- | --- |
| 提取 C21/R30 | 图片、PDF、Word、文字多题能否保留中文、公式、图、已有答案与原稿定位？部分失败怎样人工继续？ | 本批只手动单题，不宣称自动识别；C20 固定真实材料和最多两条候选 |
| Office C22/R30 | 段落/行内与独立公式是否可往返可编辑 Word，常见 Office 文件能否真实逐页预览，PDF 分页/字体是否可用？ | v1 保存公式源，不承诺具体编辑器或转换库；C22 必须实际编辑保存 |
| 数学 C23/M40 | 复杂公式、几何与动态作品是否可二次修改，离线冷启动是否无 CDN/登录依赖？ | 本批只文本/公式呈现，配图节点在实验后扩展 |
| pi C24/C25 | 准确包/版本、许可证、DeepSeek、持久会话、真实业务工具调用及中断能否满足要求？ | 消费中立业务操作，不冻结未经验证的 pi 字段 |
| 部署 C20/D70 | 现有主机能否运行 Node、SQLite、持久目录、HTTPS 和后续转换组件？字体/磁盘/重启/备份条件如何？ | B12 先证明本地单进程路径；主机授权/凭据由后续环境核实 |
| 认证 A10/A11 | 稳定可信身份、恢复/失效/退出和来源防护的真实交付版本是什么？ | 真实外部缺口；不阻塞 test-principal 开发，阻塞 real-auth 验收 |

本轮没有依赖未经实验验证的 OCR/Office/pi 成功假设。开发机、课堂设备、外部凭据和主机能力尚未核实的部分由 C20 固定并交实验验证；它们不阻塞当前纯文本首条链路。契约之外的新增决定须回 B11 新 revision，并由独立 reviewer 复核受影响部分。
