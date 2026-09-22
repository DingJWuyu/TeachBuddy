# Materials 架构与交接

状态：R30/v1 候选，待独立审查。业务语义及类型由[契约](../contracts/workbench/materials.md)拥有。技术输入固定为 `e6d2c220796ea0746bec3413db7ba259df4c2d45`，实验原件裁决见 [materials-evidence](materials-evidence.md)。B16 是 R31 的实现前置，不是本设计的前置；B13/B14 活动实现未作为事实来源。

## 选择与数据所有权

沿用 React/Vite、Express、better-sqlite3 单一后端及[静态模块目录](../adr/0001-use-a-single-static-module-catalog.md)。一个教师规模下顺序执行重转换即可；文件目录和 SQLite 一起备份。不建立上传服务、对象存储网关、通用内容平台、分类平台或队列平台。

材料版静态目录采用 OpenAPI 的 ModuleCatalog version=2；questions/resources 无业务模块必需依赖，lessons 声明 questions.readForReferenceV2 与 resources.readForReferenceV2。File/Document/Job 是启动底座，不注册为额外业务模块。只在实际实现集成后注册，Web/API从同一目录投影；旧目录版本客户端按契约升级保护，不另维护一份业务目录。

| Module | 独占数据与 Implementation | 消费者 |
| --- | --- | --- |
| workbench/files | 原件和衍生字节、文件元数据、受控下载、固定页预览与裁图、文件持久提交；本机 LibreOffice/Poppler 隔离调用 | questions/resources/lessons，后续 math |
| workbench/content + shared/materials | 唯一 schema 的校验和受控 Document 呈现；Web 的公共文档编辑/阅读原语，v1/v2 兼容 | 三个材料模块，后续 math |
| workbench/jobs | 最小持久任务记录、停止意图、重启 interrupted；只承载四种固定工作，不拥有业务草稿和成果选项 | 文件预览、questions 提取/PNG、lessons 导出 |
| questions | 题目、原始材料绑定、拆题草稿/片段、局部校对、题型/标签、复制来源、提取 Adapter、题面 PNG | lessons、Agent、后续教学记录 |
| resources | 资源条目、当前文件/补充预览、文件夹/标签/备注、替换与恢复 | lessons、Agent |
| lessons | 备课、环节、两种引用快照、使用位置查询、导出快照与 DOCX/PDF 成果 | Agent、后续 classes/schedule/math |

C21 支持的消费路线为“原生读取保存 + B 视觉辅助 + 结构/完整性校验 + 局部校对”。T/Word 先保留原生段落、OMML、图片关系；结构明确时本地自动拆题，通用文本整理失败时可将文本受控排版为页图走同一 B 路线，不能改成空题手填。PDF/扫描/图片按小批原页或区域提取，跨页续题可带相邻页上下文；答案页归并与题面分开。具体模型请求参数不进入公共 schema。R33 必须以真实输入证明这条完整路径，未通过项如实阻塞该实现能力。

C22 支持选择 docx.js 生成 DOCX、LibreOffice 转 PDF/Office 预览；Pandoc 的已知分段公式失败不选为默认。R31 配齐免费依赖与字体，R34 负责从一般 LaTeX/内容结构到可编辑 OMML 的导出 Adapter。C22 只证明有限固定公式，不能把 `ImportedXmlComponent` 的硬编码样本当通用转换器。旧 DOC 的公式丢失由受限预览+补充 PDF 对照处理，原文件始终保留；目标 Windows/WPS 的实测责任另列。

## 公共端口

以下 Interface 固定跨写者调用形式；返回类型是唯一 OpenAPI 的 schema，不另建手写平行 DTO。Error 沿 B11 `{status, problem}`，无权统一 404。principal 必须由可信调用入口提供，不能由 Agent 参数自填。异步操作均在 SQL 事务外；同步读取用于同一事务的引用验证。

| Seam | Interface | 返回/原子性 |
| --- | --- | --- |
| 文件写入 | `files.store(principal, {name, mediaType, bytes}, mutation)`，mutation=`{key, method, path}` | Promise<File>；只处理本地字节，不接受 URL。内部完成持久提交/幂等；HTTP upload 也是此操作。 |
| 文件读取 | `files.read(principal, fileId)`；`files.open(principal, fileId)` | 前者同步 File；后者异步受控可读流。原件与衍生件同样授权，公开结果不含磁盘路径。 |
| 文件预览 | `files.preview(principal, fileId)`；`files.requestPreview(principal, fileId, mutation)` | 同步 Preview / Promise<Job>；前者无副作用，后者持久受理。 |
| 转换执行 | `files.ensurePreview(principal, fileId)` | Promise<Preview>，供已受理的本地任务执行；复用已完成衍生件，否则直接受控转换。HTTP preview Job、提取和导出共用，避免单执行器嵌套等待另一个排队 Job。 |
| 裁图 | `files.crop(principal, CropInput, mutation)` | Promise<File>；校验原稿链、页/框、创建持久 PNG。 |
| 内容校验 | `content.validate(principal, Document)` | 同步返回原 Document 或契约错误，校验文件归属/格式，不转换源；v1 保留。 |
| 公共 Web 阅读 | `DocumentView({value, onOpenFile})` | value 为 Document；按内容版本安全呈现，图片通过授权 fileId 获取。 |
| 公共 Web 编辑 | `DocumentEditor({value, onChange, readOnly, onOpenFile, onPickImage})` | onChange(Document)；onPickImage()返回Promise<File或null>，由调用方完成上传/选择，编辑器不让老师填写fileId。支持本批封闭节点、公式源和错误定位，保存由所属模块负责。 |
| 题目引用 | `questions.readForReferenceV2(principal, questionId)` | 同步 ReferenceReadQuestion，deletedAt 可非空，调用者事务中核对采用版本。 |
| 资源引用 | `resources.readForReferenceV2(principal, resourceId)` | 同步 ReferenceReadResource，保留 current 文件及补充预览。 |
| 使用位置 | `lessons.listUsages(principal, {kind, id})` | 同步 UsageList；kind 仅 question/resource，按备课 updatedAt 降序再 referenceId 升序。 |
| 业务动作 | 各模块 `port.operations.<operationId>({principal, key, input, id, query})` | Promise<{status, body}>，input/查询来自对应 HTTP schema；读取省略 key，缺省 id/query 不传。与 HTTP 共用业务校验与 mutations，不再执行另一份 SQL。 |

Agent 及 M40 调用当前已定义操作，不需要 pi 专属类型。`files.store` 是 M40 保存其生成内容/静态产物的入口，content 接受当前可表示的数学文档，已有 resource/question 引用可供复用。作品制作状态、动态 HTML 运行与 math provider 尚无当前消费者，本包不定义。

R31 组合工厂提供 `{db, mutations, files, content, jobs}`；R32/R33/R34 的模块工厂在 B11 形式上分别注入必需端口。lessons 注入 questions/resources，不反向注入 lessons。HTTP 的 usages 挂 lessons；UI 从该公共查询取使用位置，避免必需依赖环。

Job 内部 Interface：`jobs.enqueue({principal, kind, target, input}, mutation)` 在调用方已有业务受理事务内同步返回 Job，不嵌套提交 mutations.execute；input 只能是 kind 对应的已验证业务请求/固定快照标识，存在模块自己的记录内，jobs 不存任意可执行指令。`jobs.get(principal,id)`、`jobs.cancel(principal,id,mutation)`、`jobs.retry(principal,id,RetryJob,mutation)` 对应 HTTP。组合入口以固定四项处理函数绑定执行器，handler 返回进度/文件 ID/JobIssue，业务输出写回各自 Module。R31 交付绑定表的唯一位置及 fixture，R34 最后装配；不做动态注册或发现。任务创建衍生文件使用持久保存的独立内部请求键，不复用用户已经确认的受理键；确保同任务重启后不重复产物。

跨模块的执行绑定固定为 `jobs.start({preview, extraction, export, 'question-asset'})`，服务器启动前调用一次，缺项以明确未接入的测试handler占位且禁止生产启动。每项具有 `run({principal, job, signal, reportProgress})`，返回Promise的 `{state, outputFileIds, issues}`，state仅succeeded/partial/failed，其他字段复用Job定义；signal为AbortSignal，reportProgress接收Job.progress并持久记录。停止状态由jobs裁决，迟到run结果不能把cancelled改成succeeded。preview/extraction另提供同步 `retry({principal, job, unitIds, mutation}) -> Job`，在jobs.retry已开启的事务中调用enqueue并同步更新业务记录，其他两种不接受retry。模块工厂返回 `{router, port, jobHandlers}`，questions提供extraction和question-asset，lessons提供export，files提供preview；测试Adapter使用同样形状。各handler在报告成功前持久保存自己的输出，按jobId/输入单元保持重复执行不重复写入。

## 文件持久性、运行与恢复

文件写入走同一受管文件系统的 staging：写满、校验长度/摘要、fsync 文件后原子 rename 到最终随机/摘要路径并同步目录，最后提交 SQLite 元数据和幂等成功响应。DB 提交前崩溃最多留下未关联 blob，不能出现可读的悬空文件记录；启动核对已知未完成写入，保留已完成文件供同键确认。DB 提交失败时不返回 FileSaved。采用同账户去重时也校验已有 blob 实际存在和摘要。

磁盘操作与 DB 不假装同一个事务。跨文件的派生任务先落全部必要字节，再一次提交成果记录；失败文件不进入 outputFileIds。缺失/损坏已登记文件返回 storage-unavailable 并保留对象元数据，恢复文件前不声称可下载。暂存清理只限可证明未提交的本次临时字节，不删除无引用的正式用户上传或其他 session 文件。

每个重操作使用独立临时目录和 LibreOffice profile，参数走 argv，禁止 shell 拼接用户文件名。关闭转换器网络访问、宏、外部链接、宿主目录访问；子进程非特权，只挂输入只读/输出可写。默认上限：100 MiB 原件、500 页、压缩展开 512 MiB、单页 40M 像素、单转换 120 秒；超限或退出保留原稿和明确错误。图片解码与 DOCX/PPTX 解压同样受限。临时转换成功后清理，失败保留诊断摘要及必要输入引用，不记录 Cookie/密钥或模型 reasoning 到产品日志。

重启先验证 DB 迁移/文件配置，再处理 jobs；queued 可执行，running 标 interrupted，不重发未知 Provider 请求。提取每页/区域的结果与完成状态一起持久提交，重试不从零覆盖校对。task 的成功输出与业务结果一致后才 succeeded。输出及原稿不可达的备份缺口交 F62，不用本批临时清理策略代替恢复设计。

## 迁移与 B16 交接

模块迁移沿用 B11 `migrations/index.js` 的有序 `{id, up(db)}` 和 ledger。新 ID 分别为 `materials_files_*`、`materials_jobs_*`、`questions_materials_*`、`resources_*`、`lessons_materials_*`，既有迁移不重写。每个 worker 独立 DB/文件目录；R34 收齐候选后独占集成库。

R31 任务启动时外层必须给 B16 已独立验收的完整 SHA 和运行入口；与本设计路径不同的机械适配由 R31 在自己边界内解决，公共语义冲突回 R30。空库、B16 旧库、重复启动迁移都验证，旧数据/账户/布局与 B11 未确认请求保留。R33/R34 分别验证旧题目与备课 v2 读取/编辑和旧客户端保护，不迁移认证内部表。

## 文件所有权

本表是 R31-R34 写入授权的唯一清单；各自模块内部可创建必要文件。若需共享文件，消费者只提交自己的 integration.md 请求，写者按阶段执行。外层派发记录须给固定 SHA，不能让两个 worker 同时修改同一共享文件或同一 DB。

| 写者/阶段 | 独占目录、测试与证据 | 共享文件逐项写权 |
| --- | --- | --- |
| R31 公共底座阶段 | `apps/api/src/workbench/files/`、`jobs/`、`content/`；`packages/shared/src/materials/`；`apps/web/src/features/workbench/materials/`；`scripts/materials/`；`apps/api/test/materials-foundation*.test.js`；`apps/web/e2e/fixtures/materials/` 的只读基准 fixture；`docs/acceptance/evidence/R31/v1/` | `package.json`、`apps/web/package.json`、`apps/api/package.json`、`packages/shared/package.json`、`package-lock.json`；`apps/api/src/app.js`、`server.js`、`config/env.js`、`core/dataStore.js`、`core/moduleRegistry.js`、`scripts/verify-storage.js`；`apps/api/src/workbench/` 直接子文件（迁移/组合/校验 runner）；`packages/shared/src/index.js` 和实际静态目录文件；`apps/web/vite.config.js`、`playwright.config.mjs`、`apps/web/e2e/helpers.js`、`api-server.mjs`。仅材料接入，认证定义只读。 |
| R32 资源模块 | `apps/api/src/modules/resources/`、`apps/web/src/features/resources/`；`apps/api/test/materials-resources*.test.js`、`apps/web/e2e/materials-resources*.spec.js` 及独有 `fixtures/materials-resources/`；`docs/acceptance/evidence/R32/v1/`（含 integration.md） | 无。 |
| R33 题库模块 | `apps/api/src/modules/questions/`、`apps/web/src/features/questions/`；`apps/api/test/materials-questions*.test.js`、`apps/web/e2e/materials-questions*.spec.js` 及独有 `fixtures/materials-questions/`；`docs/acceptance/evidence/R33/v1/`（含 integration.md） | 无。 |
| R34 备课并行阶段 | `apps/api/src/modules/lessons/`、`apps/web/src/features/lessons/`；`apps/api/test/materials-lessons*.test.js`、`apps/web/e2e/materials-lessons*.spec.js` 及独有 `fixtures/materials-lessons/`；`docs/acceptance/evidence/R34/v1/` | R31 固定候选回交且停止公共写入后，R34 是共享文件唯一继任写者；R32/R33 只提清单，缺依赖不自行改锁。 |
| R34 最终集成阶段 | 上述 lessons 边界；`apps/web/e2e/materials-integration*.spec.js` 及 `fixtures/materials-integration/`；本批运行说明 | 收齐 R31-R33 完整候选 SHA 并确认停止写入后，接手 R31 全部共享文件；独占 `apps/web/src/App.jsx`、`main.jsx`、`components/WorkspaceSidebar.jsx`、`features/modules/moduleRegistry.js`、`features/workbench/` 的外壳集成文件、`store/useAppStore.js`、`hooks/useWorkspaceData.js`、`utils/api.js`、`styles/global.css` 和 `README.md` 当前状态同步。模块缺陷退原节点，不能覆盖资源/题库目录补业务语义。 |

`packages/shared` 实际目录文件由 R31 在其回执列出精确路径，B16 路径机械差异不得扩大为跨模块写权。R31 应提前装配 docx.js、公式呈现、必要文件预览依赖；消费者新增依赖由 R34 单写者处理。共享 DocumentEditor 修正也由 R34 接手或外层明确返 R31，不能并行双写。

本批设计作者仅写 materials 文档包、已有契约/任务入口指针和 R30 author/self-check，不写以上产品路径。B11/C20/认证定义、实验原件、根台账/DAG、CHANGELOG、生产数据不在任何材料实现的隐含权限内。R34 跨 flow 的外壳集成仍需外层按固定候选交接，不能覆盖认证或其他 flow。

## 并行与验收

R30 独立冻结 + B16 固定运行基线 → R31。R31 交付同版 File/Document/Job、成功失败样本及公共编辑原语后，R32、R33、R34 可并行；R34 用本版 Question/Resource 引用 Adapter 样本启动，不等资源 UI 或自动识别全部完成。各自替身结果只能标 self，不能替代完整流程。

R34 在自己候选上引入 R31-R33 固定提交和独占集成清单，走真实“原件上传/预览/替换 → 自动收题/校对 → 取材 → 六输出”，然后交 R35 独立验收。原件字段/行为缺口归 R30，模块缺陷归原实现，设备权限归外层，目标应用操作与结果记录归 R35。所有实现仍需适用 API/E2E、生产构建与实际截图，不写 UI 单元测试；命令要求见[最小任务包](../plans/tasks/materials/README.md)。
