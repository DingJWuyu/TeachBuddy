# 应用公共底座技术入口

修改应用装配、工作台偏好、公共保存/文稿、文件/Job/识别或可靠性实现时读本页。各分区行为归[规格](../README.md#功能规格)，保存/材料/恢复保证分别归[保存](../contracts/workbench.md)、[材料](../contracts/materials.md)、[数据](../contracts/data.md)契约。当前调用路径或数据归属改变时同步本页；不在此登记未来接口或通过状态。

应用组合入口为 [createWorkbench](../../apps/api/src/workbench/index.js)，公共事务为 [createMutations](../../apps/api/src/workbench/mutations.js)，文件与预览分别由 [createFiles](../../apps/api/src/workbench/files/index.js)、[createPreviews](../../apps/api/src/workbench/files/preview.js) 组合；固定任务执行器为 [createJobs](../../apps/api/src/workbench/jobs/index.js)。

## 共享保存与持久化

### 模块与接缝

全局静态目录、API/Web 装配、共享事务与迁移入口统一见 [应用装配](README.md#代码结构) 和 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)。各模块真实工厂、操作参数与可信调用见 [当前技术入口](README.md)，公共 files/content/jobs 见 [材料公共端口](#公共端口)。

SQLite 业务写入和幂等成功记录同事务提交；同步 write 不进行网络调用。合法失败沿 `status/problem` 传播并回滚，未知存储错误回滚并映射 503。失败不清空其他模块现场。身份与原键确认的交换保证分别见[身份与 HTTP](../contracts/workbench.md#身份与-http)、[写入与未知结果](../contracts/workbench.md#写入冲突与未知结果)。

### 持久化与演进

| 数据 | 所有者 | 最小持久内容 |
| --- | --- | --- |
| 题目 | questions | 可信账户、稳定 ID、版本、题面/答案、独立笔记与标记、不可改来源、时间/软删除 |
| 已确认请求 | 公共 mutations | 账户+键唯一、操作/请求指纹、成功状态码/响应，与业务同事务 |
| 本地草稿/现场 | Web，各模块在外壳约定的账户分区内 | 服务器基线版本、编辑输入、未确认请求的原键/体、返回上下文及 UX 指定现场 |

聚合存储由所属模块实现，外部只依赖 OpenAPI。更新请求不能接受客户端自造 snapshot。基础 v1 复制来源快照由 questions 持有，支持原题变化和删除后的阅读。文件与丰富内容由材料 v2 扩展，数学作品沿数学契约读取与保存。未知版本只读保留，不通过转换丢失内容，也不存任意 blob 充当扩展点。

模块迁移只增不改，公共迁移 runner 与共享存储由当前任务指定唯一写者。空库、固定输入的旧账户/布局库都需要迁移验证，保留原账户和布局。每个 worktree 独立数据库、文件目录与端口，禁止开发者共享同一写库。构建只验证代码/隔离 fixture 库，不初始化用户数据库；当前 `build:api` 使用临时隔离库核对装配。

整体备份必须包含 SQLite（含来源、引用、幂等记录）及受管文件，恢复到新目录后核对稳定 ID/关系；本地草稿另按设备保留，不承诺换设备恢复未上传输入。

## 文件、文稿与任务

### 选择与数据所有权

沿用 React/Vite、Express、better-sqlite3 单一后端及[静态模块目录](../adr/0001-use-a-single-static-module-catalog.md)。一个教师规模下顺序执行重转换即可；文件目录和 SQLite 一起备份。不建立上传服务、对象存储网关、通用内容平台、分类平台或队列平台。

目录版本过渡见[材料兼容契约](../contracts/materials.md#b11-兼容与版本过渡)，当前组合与 Web/API 装配见 [应用装配](README.md#代码结构)。File/Document/Job 是公共底座，不注册为额外业务模块。

| Module | 独占数据与 Implementation | 消费者 |
| --- | --- | --- |
| workbench/files | 原件和衍生字节、文件元数据、受控下载、固定页预览与裁图、文件持久提交；本机 LibreOffice/Poppler 隔离调用 | questions/resources、math |
| workbench/content + shared/materials | 共享 Document 协议、校验、文本/图片遍历与 v1/v2 兼容 | 题库、资源库、math |
| components/materials | Web 公共文稿编辑/阅读与公式呈现；内容保存仍由所属模块负责 | 题库、资源库及相关文稿消费者 |
| workbench/jobs | 最小持久任务记录、停止意图、重启 interrupted；只承载固定任务类型，不拥有业务草稿和成果选项 | 文件预览、questions 提取/PNG |
| questions | [题库技术入口](questions.md) | 当前题库与已声明 Agent 工具 |
| resources | [资源库技术入口](resources.md) | 当前资源页面；全部 Agent 能力尚未接通 |

题库的已确认自动整理要求由[题库规格](../features/questions.md)拥有。当前原生 Word/PDF、共享页识别与局部校对的实际调用由[题库技术页](questions.md)说明，不以旧 A+B 选型设计冒充当前 MinerU 运行路径。

当前 DOCX 生成走 [apps/api/src/workbench/files/pandoc.js](../../apps/api/src/workbench/files/pandoc.js) 的 Pandoc JSON → DOCX；公式由一般 LaTeX 源转换为可编辑 OMML。LibreOffice 负责 PDF 和 Office 预览，Poppler 负责页图/文本；实际工具与字体条件见[运行指南](../SETUP.md#文件转换工具)。旧 DOC 的公式对象丢失仍需受限状态及补充 PDF，原文件不变。目标 Office 实测和本地 XML 检查是不同证据。

### 公共端口

以下 Interface 固定跨写者调用形式；返回类型是唯一 OpenAPI 的 schema，不另建手写平行 DTO。Error 沿 B11 `{status, problem}`，无权统一 404。principal 必须由可信调用入口提供，不能由 Agent 参数自填。异步操作均在 SQL 事务外；同步读取用于同一事务的引用验证。

| Seam | Interface | 返回/原子性 |
| --- | --- | --- |
| 文件写入 | `files.store(principal, {name, mediaType, bytes}, mutation)`，mutation=`{key, method, path}` | Promise<File>；只处理本地字节，不接受 URL。内部完成持久提交/幂等；HTTP upload 也是此操作。 |
| 文件读取 | `files.read(principal, fileId)`；`files.open(principal, fileId)` | 前者同步 File；后者异步受控可读流。原件与衍生件同样授权，公开结果不含磁盘路径。 |
| 文件预览 | `files.preview(principal, fileId)`；`files.requestPreview(principal, fileId, mutation)` | 同步 Preview / Promise<Job>；前者无副作用，后者持久受理。 |
| 转换执行 | `files.ensurePreview(principal, fileId, {signal})` | Promise<Preview>，供已受理的本地任务执行；复用已完成衍生件，否则直接受控转换。HTTP preview Job、提取和导出共用，避免单执行器嵌套等待另一个排队 Job。 |
| 裁图 | `files.crop(principal, CropInput, mutation)` | Promise<File>；校验原稿链、页/框、创建持久 PNG。 |
| 内容校验 | `content.validate(principal, Document)` | 同步返回原 Document 或契约错误，校验文件归属/格式，不转换源；v1 保留。 |
| 公共 Web 阅读 | `DocumentView({value, onOpenFile})` | value 为 Document；按内容版本安全呈现，图片通过授权 fileId 获取。 |
| 公共 Web 编辑 | `DocumentEditor({value, onChange, readOnly, onOpenFile, onPickImage})` | onChange(Document)；onPickImage()返回Promise<File或null>，由调用方完成上传/选择，编辑器不让老师填写fileId。支持本批封闭节点、公式源和错误定位，保存由所属模块负责。 |
| 业务动作 | [各模块技术入口](README.md) | 工厂返回值及参数按各模块实际实现；题库兼容/v2、班级顶层 operations、日程只读 port 分别说明。 |

业务消费者调用当前已定义操作，不另建 pi 专属类型。数学生成内容/静态产物通过 `files.store` 保存，content 接受材料版可表示的数学文档。数学调用与产物路径见[数学技术入口](math.md)，隔离保证见[数学契约](../contracts/math.md#导出与-html-隔离)。

组合工厂提供 `{db, mutations, files, content, jobs}`，业务模块只注入所需的公共端口，不读取其他模块的表。

Job 内部 Interface：`jobs.enqueue({principal, kind, target}, mutation)` 在调用方已有业务受理事务内同步返回 Job，不嵌套提交 mutations.execute；任务输入由 kind 对应的业务拥有者保存已验证请求/固定快照标识，enqueue 不接受任意 input，jobs 不复制业务输入，jobs 不存任意可执行指令。`jobs.get(principal,id)`、`jobs.cancel(principal,id,mutation)`、`jobs.retry(principal,id,RetryJob,mutation)` 对应 HTTP。组合入口以固定处理函数绑定执行器，handler 返回进度/文件 ID/JobIssue，业务输出写回各自 Module。固定绑定由组合入口装配；不做动态注册或发现。任务创建衍生文件使用持久保存的独立内部请求键，不复用用户已经确认的受理键；确保同任务重启后不重复产物。

任务执行器在服务器启动前通过 `jobs.start` 固定绑定：公共文件与识别提供 preview/recognition，已装配题库提供 extraction/question-asset。隔离组合不要求缺席模块的处理器；生产仍拒绝 fixture，并核对当前装配所需的处理器。每项具有 `run({principal, job, signal, reportProgress})`，返回Promise的 `{state, outputFileIds, issues}`，state仅succeeded/partial/failed，其他字段复用Job定义；signal为AbortSignal，reportProgress接收Job.progress并持久记录。停止状态由jobs裁决，迟到run结果不能把cancelled改成succeeded。preview/extraction/recognition 另提供同步 `retry({principal, job, unitIds, mutation}) -> Job`，在jobs.retry已开启的事务中调用enqueue并同步更新业务记录，question-asset 不接受 retry。questions 的任务出口见[题库技术入口](questions.md#责任与调用面)；files 提供 preview，共用识别提供 recognition，具体工厂返回形状按所属实现，不以此段统一所有模块。各handler在报告成功前持久保存自己的输出，按jobId/输入单元保持重复执行不重复写入。

### 材料迁移

模块迁移沿用 B11 `migrations/index.js` 的有序 `{id, up(db)}` 和 ledger。新 ID 分别为 `materials_files_*`、`materials_jobs_*`、`questions_materials_*`、`resources_*`，既有迁移不重写。每个 worker 独立 DB/文件目录；组合验证使用独立集成库。

迁移验证固定旧库来源版本及运行入口，公共语义冲突按[材料契约](../contracts/materials.md)处理。空库、B16 旧库、重复启动迁移都验证，旧数据/账户/布局与 B11 未确认请求保留。题库验证旧题目 v2 读取/编辑和旧客户端保护，不迁移认证内部表。

## 固定预览与识别

识别和裁图通过 `workbench/files/preview.js` 的 `readRendition` 读取固定预览映射；文件层核验原件/派生件归属及完整性，调用者拥有页选择与错误映射。共享识别的 `get/readPage/readResult/request/ensurePage` 由题库提取与资源阅读消费；已有失败页只在明确重试时重新执行。调用约束见[识别契约](../contracts/recognition.md#模块接缝)。

## 个人资料包与维护恢复

[apps/api/src/workbench/reliability/](../../apps/api/src/workbench/reliability) 拥有个人资料包的受理事务、ZIP 封装、维护锁、停服备份与恢复顺序，制品格式归同目录 `archive.schema.json`。各模块 `lifecycle.js` 拥有 `snapshot(db, principal)`、`validateStorage(db)` 与 `deleteAccountData(db, accountKey)`：分别投影个人包的对象、关系及可读正文，校验所属存储，清理本账户数据。受理事务同步固定这些投影和公共附件，异步封装只消费保存的快照，不重新解释模块对象；读取不补写默认设置或结算提醒。部署维护组合各拥有者的校验与迁移，底座仍核对 SQLite 物理结构、账户归属和受管文件完整性。认证和助理各自提供维护入口，恢复工具不解释其内部状态。

运行装配和存储维护共用 [moduleImplementations](../../apps/api/src/workbench/moduleImplementations.js) 的固定映射。目录只决定启动哪些业务工厂；装配与维护先逐个调用已有映射中模块的 `hasStorage(db)`，由模块辨认自有表是否存在，并与其账本记录核对。存储与拥有者账本只有一边存在时明确拒绝，不能将损坏账本解释为空模块；两边都存在的模块继续加载自身维护与迁移，无需启动其运行能力。未知存储拥有者或未知迁移拒绝启动和恢复；已正式退役的数据仅沿既有具名迁移处理。空目录、仅日程与默认完整目录使用同一装配路径；默认产品目录不因这些隔离组合改变。页面隐藏仍只是账户偏好。

维护入口为 `node apps/api/src/scripts/reliability.js --help`；backup/restore/activate 的停服、独占目录及物理隔离要求见[恢复契约](../contracts/data.md#部署备份与还原)。认证清理调用[认证恢复端口](identity.md#恢复与账户生命周期)，外层不拼认证表 SQL。Web `features/reliability/DataManagement.jsx` 被设置的真实导出调用；列表删除通过 `POST /exports/:id/deletion` 取消并等待生成任务、撤销下载、移除 ZIP 与临时包，保留业务原件，未确认结果沿原键核实。主应用没有设备草稿查看、下载或清理管理入口；隔离 archive/恢复底座继续按数据契约保护既有内容。

[助理生命周期入口](../../apps/api/src/agent/lifecycle.js) 的 `createAgentRecoveryGuard` 同时保护恢复前操作的 reconcile 和提案卡 execute 入口。提案槽定位到既存 Operation 后仍核对恢复冻结表，不能借再次点击绕过时间点恢复保护；正常进程重启按助理 journal 接续。个人资料包完整保留 conversation snapshot 中的标题、置顶、引用、提案与执行记录，对话正文及关系由助理维护入口投影。

## 工作台外壳、偏好与支持页

[apps/web/src/features/workbench/WorkbenchApp.jsx](../../apps/web/src/features/workbench/WorkbenchApp.jsx) 装配外壳、导航、辅助栏、偏好和支持页；`WorkbenchSettings.jsx` 与 `settings-shell.css` 拥有设置，`SupportPages.jsx`、`help/` 与 `support-shell.css` 拥有帮助。工作台客户端 [api.js](../../apps/web/src/features/workbench/api.js) 拥有 `getWorkbenchContext`，再经公共 HTTP 读取可信账户上下文。导航 API 为 [apps/api/src/workbench/navigation.js](../../apps/api/src/workbench/navigation.js)，偏好为 [apps/api/src/workbench/preferences.js](../../apps/api/src/workbench/preferences.js)；二者都属于工作台偏好/导航职责。共享草稿、保存协议和文稿组件使用独立 platform/components 入口，不回填到工作台业务目录。

`chrome/` 拥有侧栏、顶栏、品牌、搜索、通知、引导及相关外壳组件；`useLayoutModel.js` 消费真实导航保存、重试与冲突状态。分组选项保存实际触发控件以接续 Escape 后的键盘操作；顶栏响应式选择 `data-topbar-entry`，不依赖翻译后的 aria-label。模块右轨持续挂载，`AuxiliaryPanel.jsx` 的助理栏通过开闭状态覆盖右轨；具体尺寸与过渡只由共享样式和设计输入维护。

`styles/` 持有公共 tokens、字体、共享控件与界面呈现样式，`chrome/chrome.css` 拥有外壳组合，`appearance.css` 保留偏好应用所需适配。WorkbenchApp 将同一账户偏好传给顶栏、侧栏、模块、菜单与弹层。自定义背景 `custom/backgroundImage` 与主题、预设背景、语言和头像通过同一版本化 preferences 保存；图片由服务端校验格式和实际解码。原设备 `custom-appearance` 只供旧选择迁移和明确重选，不覆盖已保存的服务器偏好。学期组织和反馈记录仍为账户隔离的设备现场，用户已暂缓其真实接线。

语言词库在 [i18n/locales/](../../apps/web/src/i18n/locales)，界面迁移文案在 [presentationResources.js](../../apps/web/src/i18n/presentationResources.js)，均由 i18next/react-i18next 消费。[presentation.js](../../apps/web/src/i18n/presentation.js) 提供 `tx`、语言与日期 helpers；教师正文及导出内容不参与翻译。

## 显式载入示例

工作台的“载入一周的示例数据”由用户明确触发。[seedSampleWeek](../../apps/web/src/features/workbench/demo/seed.js) 顺序调用 [workspace](../../apps/web/src/features/workbench/demo/workspace.js) 的题目、资源、日程与数学准备及 [classroom](../../apps/web/src/features/workbench/demo/classroom.js) 的班级、考试、Excel 校对确认。示例 JSON、xlsx 与 PDF 资产归该源码目录，通过正常模块及资产导入构建，不从 docs 或 E2E fixture 加载运行代码。

示例题目输入为 [question-data.js](../../apps/web/src/features/workbench/demo/question-data.js)，班级、考试和成绩输入为 [classroom-data.json](../../apps/web/src/features/workbench/demo/classroom-data.json)。修改成绩内容后，从仓库根目录运行 `node scripts/demo/generate-sample-assets.mjs`，由[生成器](../../scripts/demo/generate-sample-assets.mjs)通过 xlsx 重建五份成绩表；随代码保留这些可重建资产，正常启动不执行生成器。示例考试按原型不附原卷，不再生成或上传替代原卷。

每步保留账户范围的原请求体、幂等键与已确认对象 ID，失败接续继续原步骤；上传字节独立保留在 `teachbuddy-sample-week` IndexedDB，删号确认后由 `accountDeviceData` 调用 `clearSampleWeekDeviceData` 清理；时间点恢复由 `deviceRecovery` 按 `pending:sample-week:*` 指针转入原有恢复隔离，不自动重发。已确认步骤不因重复点击或恢复而新建。业务记录通过普通真实 API 保存，既有账户内容继续保留。载入示例不创建模拟助理会话，也不证明真实模型效果。当前候选的完整载入与恢复验证查任务记录。

## 验证入口

按[模块与底座验证选择](../acceptance/README.md#模块与底座入口)选择真实 HTTP/数据库、固定构建浏览器与输出回归；公共保存的交换条件见[基础案例](../acceptance/workbench-cases.md)，文件/Job 见[材料案例](../acceptance/materials-cases.md)，恢复与资料包见[数据验收](../acceptance/data.md)。入口存在不代表当前候选已通过。

## Web 公共能力的调用边界

- [platform/http](../../apps/web/src/platform/http) 的 `apiClient.js`、`problems.js`、`request.js` 统一请求/问题语义；账户 transport 附加可信身份，平台层不拥有登录表单或模块业务。
- [platform/device](../../apps/web/src/platform/device) 的 `storage.js`、`deviceRequestStore.js`、`useScene.js`、`uuid.js` 拥有设备存储、未决请求、场景与 ID 原语；账户隔离和迟到响应由使用这些原语的模块保持。
- [platform/saving](../../apps/web/src/platform/saving) 的 `useSavableDocument.js`、`useIdempotentSubmit.js`、`saveStates.js` 承担公共保存状态与幂等提交机制，不解释题目/作品业务内容。
- [components/ui](../../apps/web/src/components/ui) 提供确认、浮层、分段、日期时间、筛选与模块右轨；`menu.jsx` 的 Menu/MenuItem 与 `dialog.jsx` 的 Dialog/Overlay 统一业务菜单和对话框的 portal、键盘及焦点。菜单 Tab/Shift+Tab 关闭浮层后从触发器继续原页面的键盘顺序；`motion.js`、`colors.js`、`classNames.js` 提供公共呈现原语。共享图标统一由 `components/icons.jsx` 导出，产品通过正常 imports 消费，不使用原型全局桥接。
- `popover.jsx` 的 `shellRoot()` 为锚定浮层和确认框选择宿主：存在原生全屏元素时挂入该元素，否则使用工作台外壳。这样课堂展示中的菜单和二次确认仍处于可交互的全屏层内。
- `filter.jsx` 保留原生 Tab 逐项访问多选选项；Escape 关闭前归焦触发器，外点关闭保留新点击位置。工作台和 portal 的减少动效规则由 `styles/base.css` 统一覆盖。
- `confirm.jsx` 的 `ConfirmDialog` / `AppConfirmDialog` 通过 `present` 保留退出动效，portal 内拥有退出层的 inert 和焦点生命周期；调用方持续挂载并传当前开闭状态。关闭立即撤掉键盘处理与归还焦点，快速重开使用新实例；不在 portal 外再包 `ModulePresence`。不需保留退出的调用方仍可按条件挂载。默认 Enter 激活当前按钮；日程的两个确认消费者显式传 `enterConfirms` 保留该模块的唯一确认规则，仍遵循输入法、禁用及重复按键保护。
- [components/materials](../../apps/web/src/components/materials) 聚合 `DocumentView`、`DocumentEditor`、`MathFormula`、documents、样式及公开入口；[components/interaction](../../apps/web/src/components/interaction) 聚合 ModuleMotion、useForegroundRefresh、useScrollRestore 等动效与现场 hooks；[icons](../../apps/web/src/components/icons.jsx) 提供共享图标。设置特有 SettingsControls 留在 workbench。

后端通用文稿读取在 [content/document](../../apps/api/src/workbench/content/document.js) 的 documentText/walkBlocks/images；不承担数学 Source 协议。数学协议由 [math/contract](../../apps/api/src/modules/math/contract.js) 拥有；共用 casefold 在 [workbench/text](../../apps/api/src/workbench/text.js)。材料 Problem 沿 [workbench/problems](../../apps/api/src/workbench/problems.js)，HTTP JSON/错误适配沿 [workbench/http](../../apps/api/src/workbench/http.js)，不为每个业务路由重复实现。
