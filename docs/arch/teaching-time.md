# Teaching-time 架构与写入所有权

T50 已冻结；本页定义模块与接缝，实际组合见[教学入口](../modules/teaching-time.md)，不从本页推断任务尚未开工。精确数据只有 [OpenAPI](../contracts/teaching-time/teaching-time.openapi.yaml) 一份，语义见[契约](../contracts/teaching-time.md)。沿用 React/Vite、Express、同一 better-sqlite3 Database、mutations 和可信 principal；[ADR 0001](../adr/0001-use-a-single-static-module-catalog.md) 的静态模块与公共端口规则继续适用。没有新服务、通用关联平台、任务状态机、事件总线或队列。

## 模块与 Interface

classes Module 吸收班级、实际记录、资料链接与反向反馈；schedule Module 吸收日期、周重复/例外和事项移动。reminders 是 schedule 内由 T53 实现的子目录，不注册第七个模块。两模块的 Interface 对浏览器为 OpenAPI 操作，对中立业务调用者为相同操作；未来 Agent 不另写 SQL。计算复杂度留在 schedule，调用者拿真实实例，不在 T51/T53 各做一套日期算法。

同步公共端口均接收 B11 的 `principal`，无权/不存在抛 `{status, problem}` Error。返回形状用 OpenAPI 同名 schema；写事务内不网络请求、不返回 Promise。模块不读其他模块仓储/表。

| 公共 Interface | 输入 / 返回 | 写者与消费者 |
| --- | --- | --- |
| `classes.readClass(principal, id)` | `ClassReference`；允许本账户 tombstone | T51 提供；T52/T53 消费 |
| `classes.readRecord(principal, id)` | `RecordReference`；label 取 note，否则按 position/unfinished/commonIssues/nextNote 首个非空项，截前300个 Unicode 字符；包含 classDeletedAt | T51 提供；T52/T53 消费 |
| `classes.listSourceRecords(principal, {kind,id})` | `RecordList`；语义同 HTTP 操作 | T51 提供；T53 接题库/备课反向反馈 |
| `questions.readForReference(principal, id)` | B11 原端口；仅取标题/归属/删除态，记录不保存题面快照 | B11 提供；T51 消费 |
| `lessons.readForTeachingLink(principal, id)` | `LessonReference`；标题/版本/删除态，允许本账户 tombstone | T53 最小提供方扩展；T51/T52 消费 |
| `schedule.readOccurrence(principal, {entryId,originDate})` | `Occurrence`，无时间/无权/不符合原始周节律 404；符合节律但超出until返回outside-series | T52 提供；T53 通知定位 |
| `schedule.listReminderCandidates(principal, now)` | `ReminderCandidate[]`；只返回当前活动实例 `armedAt < dueAt <= now`，按 dueAt、entryId、originDate 升序 | T52 提供；T53 结算；只读投影不写通知 |
| `reminders.captureDue(principal, now)` | 同步，无返回；取上一个端口并以唯一键插入；异常随调用事务回滚 | T53 提供；注入 T52 的 beforeChange |

工厂 `createClassesModule({db,mutations,questions,lessons}) -> {router,port}` 和 `createScheduleModule({db,mutations,classes,lessons,beforeChange,clock}) -> {router,port}`，路由分别挂到 `/api/modules/classes`、`/api/modules/schedule`。`clock.now()` 返回 UTC ISO Z，生产注入系统时钟，测试进程可固定；请求不得提交 now。`beforeChange(principal,now)` 是同步函数，T52 每次逻辑安排写入（含例外、删除/恢复和移动）在归属/版本/领域校验通过后、实际变更前调用一次，处于同一个 mutations 事务；幂等重放不再调用。

T53 工厂 `createReminders({db,mutations,schedule,clock}) -> {router,captureDue}`。组合入口先以闭包 `(...args) => reminders.captureDue(...args)` 构造 schedule，再构造 reminders，最后才挂载路由；工厂构造不得执行业务调用。这只是同一个 schedule Module 内组合，不新增目录依赖环。T52 独立 fixture 显式注入记录调用的 beforeChange；正式组合缺依赖必须启动失败，不给生产默认 no-op。

通知 GET 使用一个短事务结算再读列表；read/dismiss 走 mutations 并在同一事务结算。同键插入采用唯一约束，已存在则保持 dueAt/title/readAt/dismissedAt。已读与清空不增加 schedule.version；schedule 不导入 reminders 存储。通知查询/点击所需 HTTP 在 schedule 路径下，由 T53 router 挂载。

## 持久数据

| 所有者 | 数据/不变量 |
| --- | --- |
| T51 classes | classes、records、record-source links（或聚合 JSON），可信账户、稳定 ID/version、日期、原文、保存时标题、软删除。反向索引完全由本模块维护。 |
| T52 schedule | 账户显示时区/version；Entry 聚合；按 entryId+originDate 唯一的完整例外/取消；reminder armedAt。保存前后时间规则由一个实现计算；隐藏例外重新可见时更新生效点。 |
| T53 reminders | 每账户+实例唯一的通知，稳定通知 ID、原定 dueAt、生成时标题、readAt、dismissedAt；生成时间可内部保存但不冒充 dueAt。 |
| B11 mutations | 幂等请求及持久成功结果，与上述业务写入同一 SQLite 事务。 |
| Web 所属 feature | 账户分区的本地草稿/现场/未确认请求；不上传未保存输入，不与其他账户共享。 |

不提前生成整个重复系列的实体行。查询时展开每周原始日期并应用例外，再按实际区间筛选；必须额外检查移入范围的例外，不能只生成原日期在范围内的周。提醒展开从最早有效生效点至 now 对应的必要原始日期（需考虑前/后偏移和跨日）；保留 ID 稳定性。无需时间游标、后台 checkpoint 或重放日志。删除/恢复保留原始 ID、例外和通知唯一痕迹；没有永久删除接口。

迁移 ID 使用 `classes_`、`schedule_`、`schedule_reminders_` 前缀，各自只增。模块导出 B11 `{id,up(db)}` migrations；T53 汇总。空库与 B16 旧库都验证，原题目/备课/账户/布局不变。F62 后续整体备份须包含三者表及 B11 幂等数据；本批不实现备份器。

## 并行写者

以下是领域职责边界。当前工作树与写者按[执行协议](../plans/execution-protocol.md#ownership)安排，不由本页新开 worktree。测试数据目录、端口和账户隔离；不可共写用户数据库。未列出的公共文件先交唯一写者，不能自行抢写。

| 写者 | 独占模块范围 | 验证/样本 |
| --- | --- | --- |
| T51 | `apps/api/src/modules/classes/`（含迁移）；`apps/web/src/features/classes/`；本批反馈/选择组件放 classes 内并导出，供外壳/备课/题目接入 | `apps/api/test/teaching-time-classes*.test.js`；`apps/web/e2e/teaching-time-classes*.spec.js`；各自同前缀 fixtures；`docs/acceptance/evidence/T51/v1/` |
| T52 | `apps/api/src/modules/schedule/`，保留 `reminders/` 子目录给 T53；`apps/web/src/features/schedule/`，保留 `notifications/` 给 T53；settings/time/Entry/例外/公共 port 和迁移 | `apps/api/test/teaching-time-schedule*.test.js`；`apps/web/e2e/teaching-time-schedule*.spec.js`；各自同前缀 fixtures；`docs/acceptance/evidence/T52/v1/` |
| T53 | `apps/api/src/modules/schedule/reminders/`、`apps/web/src/features/schedule/notifications/`；提醒迁移与真实集成 fixture | `apps/api/test/teaching-time-reminders*.test.js`；`apps/web/e2e/teaching-time-integration*.spec.js`；`docs/acceptance/evidence/T53/v1/` |

T51/T52 用各自 fixtures 组合真实 B16 底座 + 自己模块做 HTTP/UI，缺的公共提供方只按本版 port/cases 做替身。fixture 的静态目录只用于隔离测试，不回写产品目录，也不是新增永久运行平台。回执列真实/替身范围、准确 export、装配需求。T51/T52 前端默认导出 feature 页面，classes 另导出反馈面板和班级/记录选择器；组件 props 属前端内部实现，可由 T53 适配，不另造共享 UI 契约。

T52 固定候选停止写入后，T53 可先接它完成提醒；T51 未齐时继续消费同版班级端口替身，阶段结果不标整体验收通过。收齐 T51（含 M40/M44 作品条件）后，T53 独占以下共享装配文件，T51/T52 若需修复由外层安排后重新固定候选。

| T53 独占共享文件/范围 | 为什么必须改 |
| --- | --- |
| `packages/shared/src/` 静态目录、目录校验和公开导出 | 注册 classes、schedule 及本批有消费者依赖，投影同一份目录 |
| `apps/api/src/app.js`、`server.js`、`core/moduleRegistry.js`；`apps/api/src/workbench/` 的组合/迁移入口 | 注入公共端口、时钟、beforeChange，挂载路由，汇总迁移；不改变身份/事务协议 |
| `apps/api/src/modules/lessons/index.js` 及必要的同模块导出/公共读取测试 | 增加只读教学关联端口，复用已有账户与删除读取，不跨表读 |
| `apps/web/src/App.jsx`、`features/modules/moduleRegistry.js`、`features/workbench/` 外壳/顶栏；`components/WorkspaceSidebar.jsx` | 班级入口、顶部唯一日程、共享右栏、通知入口与定位 |
| `apps/web/src/features/lessons/index.jsx`、`features/questions/index.jsx` 及其页面装配文件 | 放入 T51 的只读反馈入口，保留原编辑器和草稿协议 |
| `apps/web/src/store/useAppStore.js`、`hooks/useWorkspaceData.js`、`utils/api.js`、`styles/global.css` | 必要的页面现场和 feature 接入，沿用 B11 身份分区与令牌，优先使用 feature 局部样式 |
| 根/相关 workspace `package.json`、`package-lock.json`；`playwright.config.mjs`、`apps/web/vite.config.js`、E2E `helpers.js`/`api-server.mjs` | 仅消费真实实现新增依赖/运行接入；没有新依赖就不改 |
| `README.md` | 集成后同步实际班级/日程/提醒能力与仍缺的条件 |

表中路径以 B16 固定候选的实际文件为准；若 B16 拆分了同一共享入口，T53 回执记录替代路径与用途，仍不允许并行写者覆盖。数学提供方内部代码不在此表；M40 的适配由 T51 在 classes 内完成，真实作品页面的反向反馈装配先取得提供方指定写者交接，不能擅自进入 math。

## 必须的共享变更

1. **备课只读端口**：B11 对外 HTTP getLesson 可用，但跨模块事务不能借 HTTP 或私有仓储判断来源。新增 `lessons.readForTeachingLink` 只投影已有 id/version/title/deletedAt，不改内容和语义。T50 冻结这项消费者要求，T53 实现提供方最小导出并对真实 B16 库核查；独立 T50 reviewer 须核验它与 B11 一致。若 B16 无可复用内部读取，由 T53 在 lessons 内增加，不让 T51 私读表。
2. **静态目录 v2**：B11 的 `ModuleDescriptor.requires` 只允许题目端口，不能把班级/备课新依赖塞进旧 schema 声称兼容。本包只定义新的 v2 目录响应，T53 组合后取代 `/api/modules` 的 v1 返回；其他 B11 操作不变。四项完整 descriptor 及顺序固定见样本 `catalog-v2`，旧 B11 v1 文件作为已冻结输入保留。

本批目录新增 classes（`/classes`、sidebar、右栏）、schedule（`/calendar`、top、右栏）。classes requires 为 questions.readForReference、lessons.readForTeachingLink；schedule 为 classes.readClass、classes.readRecord、lessons.readForTeachingLink；lessons 原有 questions 依赖保持。无环；反馈面板只是组合层消费 classes HTTP，不形成 lessons -> classes 的服务端必需依赖。隐藏模块不停止 API/提醒。候选不虚注册 math/resources，后续提供方自行冻结其目录扩展。

T53 在目录投影前运行静态校验：ID 和 path 各自唯一，requires 必须解析到本批固定提供方，依赖图必须无环。重复 ID/path、缺依赖和依赖环的固定输入与 `422 invalid-input` 结果见 [TT-C7](../contracts/teaching-time/cases.md#tt-c7)。目录响应仍保持加法兼容，校验只约束权威静态输入，不把未来响应字段当作错误。

## 能力与验证边界

C20 [环境](capability-checks/environment.md)未证明正式主机或真实认证可用；此设计只依赖 B16 提供的单进程持久库/隔离运行入口。日期规则需要 T52 用公开业务 Interface 做真实集成验证，不把特定时区库可用视为既成事实；实现者选依赖后由 T53 汇总。无 OCR/Office/pi/作品实验前提，不为普通记事引入它们。

T51/T52 的快速循环是隔离真实 HTTP + 浏览器操作；日期/排序/原子移动可经公开 HTTP 断言，不写 UI 单元测试。T53 必须演示真实保存后丢响应、API 重启、关闭页面过期重进和日期例外。所需命令及 BDD 归[实现包](../plans/tasks/teaching-time-implementation.md)，通过后交 T54 独立流程验收；test-principal 不代替 A12 真实身份。
