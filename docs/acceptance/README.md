# 验证入口

执行者只读当前任务相关判据和测试入口。本页维护验证选择、环境和运行入口；保护行为、测试选择或准备条件改变时同步，不积累执行日志。功能页只链接相关验收；[完整矩阵](mvp-matrix.md)用于全范围交付；[质量样本](samples.md)用于材料、数学和目标 Office 核对。

## 选择验证

1. **先定判据。** 从当前规格和用户要求列出本次受影响的使用结果，再查已有测试覆盖。修 bug 先复现，沿根因核对共用组件、同类入口和相邻状态，按共享成因确定需要补验的范围。
2. **复用并补缺。** 按下表选择已有入口，核对配置实际匹配的用例和前置条件。旧预期与现行规格冲突时，修正预期并保留有效保护，不能为了测试通过改回被否定的体验。新增自动化只覆盖现有测试未保护、可稳定复现且值得持续防回归的行为。
3. **满足后停止。** 受影响路径、必要回归及按[开发约定](../agents/module-development.md#编排)触发的独立验收通过后进入交付；只有新改动、失败或未解疑点才扩大或重复验证。环境缺失与用户已暂缓项如实保留未验边界，按当前授权判断是否阻塞；用例数量不作为完成目标。

| 变化 | 必要反馈 |
| --- | --- |
| OCR 模型、识别管线或性能 | [选型规则](ocr-selection.md)：先固定判据和输入，再进行真实推理、消融和消费者验证 |
| 文档、导航、资料位置 | 文件/锚点、权威来源、消费者和固定输入完整性；涉及脚本路径时运行对应脚本或测试 |
| 业务 API 或存储 | 真实 HTTP/数据库集成，按影响范围检查迁移与重启 |
| UI/UX | 实际浏览器流程、隔离生产构建、图像及动效过程；UI 不写单元测试 |
| 预览、输出、离线 | 真文件生成、下载、打开，必要时断网冷启动 |
| 跨模块组合 | 受影响的真实跨模块路径及必要回归 |
| 开发服务、组件挂载与清理 | [开发服务回归](#开发服务回归)，保留 React StrictMode，验证重复初始化后仍可读取、上传和保存 |

测试文件/config 从[模块与底座入口](#模块与底座入口)进入；命令以根和各 workspace 的 `package.json` 为准。根 `npm run test:e2e` 与 `test:ci:browser` 使用同一组确定性产品回归，局部认证使用 `npm run test:auth:e2e`；准确范围由 `apps/web/e2e/ci.config.mjs` 的 project 与 `testMatch` 决定，不代表全部专项。模块验证使用相应配置，运行前核对其 `testMatch` 和候选。数学旧源兼容、持久化冲突与未决确认，以及跨模块手工支持和 Agent 主应用的受控场景也纳入该组，保护真实入口及原文件恢复；其配置仍可独立定点执行。真实资源 OCR 运行链及题库外部 E 原稿仍使用显式专项入口，不纳入日常 CI。`.feature` 是带稳定编号的行为场景，目前不由 Cucumber 执行；实际反馈来自 HTTP/Playwright。各场景使用自己的 Background。旧场景中的“软删除”对应可恢复的归档/删除；永久删除另按模块规格验收，不用归档场景证明不可恢复操作。

引入 lint、hooks 或新验证工具前，先指出已有检查漏掉的具体问题，确认该工具确实能检出，并评估误报、重复覆盖及持续维护负担。现有构建、集成测试或人工浏览足以提供反馈时沿用；不因缺少某类工具而补齐工具清单。

本地自测、CI 回归与总控补验的职责，以及已纳入 CI 的浏览器和 Office/PDF 范围，统一见[CI 与本地验证](../agents/github-workflow.md#ci-与本地验证)。选择入口后先核对该分工，复用已有证据；总控不重复运行 CI 已承担的验证。真实模型、目标设备与人工观感仍按影响范围验收。

## 浏览器准备

新环境在仓库根目录完成 `npm ci` 后，执行 `npx playwright install chromium`，安装锁定 Playwright 版本对应的浏览器。支持的 Linux 发行版若缺系统库，使用 `npx playwright install --with-deps chromium` 同时安装依赖，该步骤可能需要系统管理员权限；具体支持范围见 [Playwright 官方安装说明](https://playwright.dev/docs/browsers#install-system-dependencies)。更新 Playwright 后重新执行安装。

浏览器回归使用上述 Chromium，不依赖某台主机的 Google Chrome 安装路径。专项需要其他浏览器时，在对应配置与验证说明中明确安装步骤；新环境验证使用独立浏览器缓存，不能用本机现有缓存代替准备。

## 开发服务回归

运行 `npm run predev` 后执行 `npx playwright test -c apps/web/e2e/development.config.mjs`。它启动真实同源 HTTPS 与 Vite，使用隔离数据库、文件目录和邮件替身，覆盖资源上传、PDF 中文文字层、模块往返与刷新，以及题库读取、手动保存和重开。该入口不读取已有实例配置，也不占用 50880。

改变监听或启动方式时另验前端源码修改即时生效、API 修改自动重启及登录保持；验证后还原探针修改。固定 Web 构建继续按模块入口回归，不能用生产构建通过代替开发模式验证。

## 隔离与产物

- 按[运行指南](../SETUP.md#新的隔离环境)选择独立端口、库、文件目录与构建产物。同一固定候选可共享只读构建，运行期间不得覆盖；并行修改使用独立输出目录。Pandoc/Office 路径必须指向可用工具；测试不能读取或改写用户实例。
- 测试输出写 `test-results/`，证据默认在 `test-results/evidence/`；支持环境变量的入口可指定独占目录。两者均为可清理的运行产物，不存放唯一用户成果或固定输入。
- Playwright 截图通过 `testInfo.outputPath()` 写入用例独立目录；临时实例用系统临时目录和 `mkdtemp` 创建，或先创建明确的输出父目录。测试自行准备本次输入，不能依赖另一用例或旧运行留下目录。
- 运行前核对 fixture/config 的输入与准备条件；绝对路径、外部工具和真实模型验证另核对当前环境。行为预期按[选择验证](#选择验证)处理。
- 记录 real-auth / test-principal、real-mail / fake-mail、真实服务 / 替身及实际候选。self、independent、user 分别表示作者自验、独立验收、真人反馈；退出码和局部 PASS 不代表整个产品。
- 失败保留本次现场；成功后清理临时数据。固定样本和用户已有成果保留在测试自动清理范围之外。

## 输入与按需参考

| 需要验证什么 | 入口与使用方法 |
| --- | --- |
| 公共文稿实际转换 | `apps/api/test/materials-pandoc.test.js` 使用公共转换器生成固定文稿的 DOCX/PDF，检查可编辑公式、正文与真实文件；不经过业务课稿编排入口；隔离公共材料服务由 `apps/api/test/fixtures/materials/server.mjs` 提供。 |
| Word/WPS 人工编辑与打印 | [Office fixtures](../../apps/web/e2e/fixtures/office) 的六份 DOCX、源文本/公式/图片；按[人工操作](samples.md#人工-office-样本)核对。输入样本不是产品转换成功证明。 |
| 设置/帮助外观 | 按[界面规则](../rules/design-and-verification.md)核对当前运行页面及用户指定参考；截图留本次验证产物 |
| 题干/答案原稿独立定位 | 按[独立题库页面](#独立题库页面)构建、启动 fixture，再执行定位 spec。此 test-principal 页面与真实认证主应用分开准备。 |
| Agent 真实模型保留库 | `apps/api/test/fixtures/c26/live.mjs` 生成模型报告和隔离数据；`apps/web/e2e/c26/agent.spec.js` 读取。二者共用 `AGENT_EVIDENCE_DIR`，默认 `test-results/evidence/C26/v1`。执行前核对报告与数据目录来自同一候选；新环境缺少报告或对应数据库时显式跳过并标记未验证；准备步骤见[真实模型保留库](#真实模型保留库)。 |
| API 字段与兼容 | 从[文字契约](../README.md#契约说明)进入；机器契约在 `apps/api/src/contracts/`，交换样本在 `apps/api/test/fixtures/contracts/`。测试以固定样本和预期行为验证实现，不能只用实现自身生成预期结果。 |
| 固定旧版升级 | `npm run test:api` 包含 A11/T53、R31 题库旧库升级及退役迁移；数学和材料旧版分别执行 `node scripts/math-support/verify-upgrade.mjs`、`node scripts/materials/verify-migration.mjs`。入口从 `apps/api/test/fixtures/legacy-source/` 的不可变源码包创建旧库，来源、路径和摘要见同目录 `provenance.json`；不需要旧 checkout、Git 归档引用或环境变量。归档内部保留当时的路径。 |
| 数学旧库升级 | `apps/api/test/math-integration-migrations.test.js` 从固定旧版题库/数学源码包重建库、附件与请求回执，再验证保留模块的数据、文件、回执和重启，并确认退役模块表及迁移记录已清理。原版源码包保持字节固定；退役模块不成为当前功能兼容承诺。缺失或不支持的升级须如实报告，不把旧候选通过结果移用于新版本。 |
| 外部 E 选页与跨页 | 按[质量样本](samples.md#固定输入与回放)下载并校验公开原件，设置 `M33_PRIVATE_PDF` 后运行 `npm run test:api`；`materials-questions.test.js` 与 `materials-questions-fragments.test.js` 分别核对选页及原件保留、受控提取结果的跨页关联。缺原件时两项明确跳过；这些检查不证明新的 GPU OCR 推理准确率。 |
| 当前能力核查 | [项目状态的核查入口](../plans/run-state.md#核查入口)指向当前源码、固定样本和可重现测试；既往本机结果只证明当时的候选。新候选按影响范围补验，缺少输入或目标设备时记未验证。 |

## 模块与底座入口

下表只选择已有入口，不声明当前候选已经运行。具体 `testMatch`、CI 收集和前置条件以配置及 package scripts 为准；未纳入 CI 的专项按受影响范围定点运行，不能因入口旧或未进 CI 删除独有保护。

| 范围 | 代码入口与判据 | 额外边界 |
| --- | --- | --- |
| 身份/交接/删除 | `auth-integration.config.mjs`、`auth-completeness.config.mjs`、`fixtures/auth-contract/playwright.config.mjs`；`auth-integration.test.js`、`account-deletion.test.js`；[认证案例](auth-cases.md) | 替身、real-auth/fake-mail、真实邮件与浏览器重开分开记录；fixture 单独构建不证明当前主应用已接入 |
| 工作台/设置/帮助/导航 | `navigation-sync.config.mjs`、`settings-shell.config.mjs`、`settings-implementation.config.mjs`、`help-shell.config.mjs`；`navigation.test.js`、`reliability.test.js` | 核对当前已移除的设置入口，主题/语言/昵称/头像/退出/删号用真实页面 |
| 共享保存/资料包/恢复 | `savable-document-recovery.config.mjs`、`manual-support/playwright.config.mjs`、`manual-data/manual-data.config.mjs`；`reliability.test.js`；[保存案例](workbench-cases.md)、[数据验收](data.md) | 历史专用 fixture 与当前主入口分开；恢复 UI 未接入时如实记录，不恢复已删除设置 |
| 题库/收录 | `questions-ux.config.mjs`、`questions-recognition.config.mjs`、`questions-tables.spec.js`；`first-flow-questions.test.js`、`materials-questions*.test.js`、`materials-question-notes*.test.js` | 固定录制证明消费；实际 OCR、外部原件和新提取质量另验；详见[题库专项](#题库专项) |
| 资源/预览/识别 | `resources-ui.config.mjs`、`manual-resources.config.mjs`；`materials-resources.test.js`；[材料案例](materials-cases.md) | 真实 Office/PDF 工具与真实 GPU 分开，预览需实际解码每页；[资源专项](#资源专项) |
| 数学/网页桥/离线 | `math-unified.config.mjs`、`math-unified-repair.config.mjs`、`math-geogebra.config.mjs`；`math-workshop*.test.js`、`math-dynamic.test.js`、`math-isolation.test.js`；[数学案例](math-cases.md) | 浏览器替身不代签真实网页模型，离线必须下载冷启动；[数学专项](#数学专项) |
| 日程 | `schedule/playwright.config.mjs` 按 capabilities/interaction/keyboard/consistency/time-zone spec 选择；`teaching-time-*.test.js`；[日程案例](schedule-cases.md) | 日常 CI 仅选择 capabilities；具体范围以配置为准，不以 CI 通过替代全部专项；[日程专项](#日程专项) |
| 班级后端 | [班级验收](classroom.md)内真实 HTTP/Excel/原卷与生命周期入口 | 无教师页面/实际 AI，不以目录注册冒充前端完成 |
| AI 助理 | `agent.test.js`、`agent-rendering.config.mjs`、[agent.feature](agent.feature)；live 另用 `fixtures/c26/live.mjs` 与 `c26/agent.spec.js` | rendering 与 c26 的非 live 场景使用受控 SDK/真实 HTTP/UI，已纳入 CI；live 需要同候选保留库与明确真实调用授权，扩展暂停仍有效 |

API 文件名相对 `apps/api/test/`，浏览器入口相对 `apps/web/e2e/`。表中的通配名用于检索，不能当作配置已经全量收集；命令仍从 package scripts 与对应 Playwright 配置取。

## 题库专项

- 普通题目保存先读[共享契约](../contracts/workbench.md)的身份、内容、引用及写入节；丰富题目、分类和校对再读[材料契约](../contracts/materials.md#内容)。字段只读对应 OpenAPI 操作，不需要通读其他模块或完整项目计划。
- 当前交互浏览器验证 `apps/web/e2e/questions-ux.config.mjs`，用 `WORKBENCH_WEB_DIST` 指定隔离生产构建，覆盖录题、草稿、改编、分类、文字校对、结构编辑、搜索范围、拆分答案归属、未知保存恢复、归档与彻底删除、来源缺失/读取失败、详情返回及深浅色布局。文件上传另验 DOCX 段内换行、PDF 明示续题与缺页/倒序、双栏题干/选项/答案及入库来源页码、未分配片段处理后的保存重开；原稿字节、原生 Word/DOC/PDF 校对、人工补图、迟到搜索及分隔宽度恢复见 `manual-questions.config.mjs`。HTTP `apps/api/test/first-flow-questions.test.js`、`materials-questions*.test.js`；笔记兼容、出处与附件恢复另见 `materials-question-notes*.test.js`；保存基例 [WB-003/004/011-018](materials.feature)与[基础交换](workbench-cases.md)，材料基例 [WB-M001-012/025-028](materials.feature)。

保存行为变更至少走自建、直接修改、复制改编、刷新重开；再覆盖本次影响的断线未确认、版本冲突、保存中继续输入、分类变更、身份切换和保存后取用。确认原 ID/来源快照/独立笔记正确，不能仅凭 toast 判断。当前能力边界见[项目状态](../plans/run-state.md)，回归从[核查入口](../plans/run-state.md#核查入口)进入。

识别消费者使用 `apps/web/e2e/questions-recognition.config.mjs`，该入口和 CI recognition project 均包含 `questions-recognition.spec.js` 与 `questions-tables.spec.js`；后者的私有 E 完整原件场景有独立输入条件，不能把缺原件跳过视为已验。API 结构边界另见 `materials-questions*.test.js`。固定输入及真实产物位置见[样本索引](samples.md#固定输入与回放)。回归核对原题、原有答案、公式、题图、来源页码、未分配范围、跨页阻断与人工状态；重试、取消和迟到结果不得覆盖已校对内容。表格列角色、同格多题配图、隐式续题等详细用例由相应测试维护。

从界面上传、校对入库并刷新读回，实际阅读公式与配图并查看深浅主题和窄屏截图。固定产物回放只证明消费与保存；修改识别配置后须按[共用路线与验证](../contracts/recognition.md#路线与验证)重新验证真实原稿，不能复用旧缓存冒充新结果。外部 PDF 回放只需按样本索引下载原件并设置 `M33_PRIVATE_PDF`；固定 E7/E8/E9 机器结果随仓库根 `test/fixtures/questions/recognition-document-4/` 入库，测试核对完整原件与实际渲染页摘要。`QUESTIONS_OCR_EVIDENCE_DIR`、`QUESTIONS_OCR_EXPANDED_DIR` 仅用于替换同布局的回放目录；默认自编材料消费回归不需要这些变量。缺外部原件只跳过对应专项，不用受控转录代替真实输入通过。

开发模式的列表读取、手动保存和刷新还须通过[开发服务回归](#开发服务回归)。组件重新初始化后恢复读取，过期请求的成功或失败都不能覆盖当前列表状态。

### 独立题库页面

原稿定位的 fixture 配置没有自动启动服务，先在仓库根目录构建并在独立终端启动：

```bash
node apps/web/e2e/fixtures/materials-questions/build.mjs
questionsFixtureData="$(mktemp -d)"
node apps/api/test/fixtures/questions/server.mjs "$questionsFixtureData" 48339
```

保留该进程，在另一终端运行 `npx playwright test -c apps/web/e2e/fixtures/materials-questions/playwright.config.mjs materials-questions-fragments.spec.js`。CLI 使用刚生成的 `test-results/r33/web`；通过 `/fixture/session` 安装测试身份，不使用真实注册或邮件。更换端口时同步设置 `QUESTIONS_FIXTURE_ORIGIN`，输出可用 `QUESTIONS_FIXTURE_RESULTS` 指定。停止服务后按结果清理本次隔离数据；失败现场保留，不使用用户实例或旧运行残留数据。

### 材料跨模块与进程重启

`apps/web/e2e/fixtures/materials-integration/playwright.config.mjs` 选择 `materials-integration*.spec.js`，验证题库校对在外壳保存重开、资源/题库往返及实际子进程重启后的未知上传接续。使用隔离 `WORKBENCH_WEB_DIST`；进程重启场景独占本机 48437 端口。截图与具名报告使用 `MATERIALS_INTEGRATION_EVIDENCE_DIR`，默认 `test-results/materials-integration/evidence`，trace 位于同级 `browser/`；临时数据库由各例自行创建，成功清理、失败保留。

## 资源专项

文件身份、上传未知结果、补充预览、授权下载见[材料契约的文件与定位](../contracts/materials.md#文件与定位)；分类、文件更新及删除见相应契约节。原件和历史文件持续保留；上传后安全保存原件与预览成功是不同结果。

实现与公共文件/任务路径见[资源技术入口](../subsystems/resources.md#运行路径与持久化)。真实认证浏览器流程入口 `apps/web/e2e/resources-ui.config.mjs`，用 `WORKBENCH_WEB_DIST` 指向[隔离构建](../SETUP.md#新的隔离环境)，截图和 trace 可用 `RESOURCE_UI_RESULTS` 指定目录。Office 格式专项入口 `apps/web/e2e/manual-resources.config.mjs`，HTTP `apps/api/test/materials-resources.test.js`，验收 [WB-M013-017](materials.feature)。

按本次改动选择下列回归，执行范围与剩余验证见[项目状态](../plans/run-state.md)：

- 收录与整理：真实上传、保存刷新、重复选择与队列接续；批量取消/过期版本整批拒绝；归档后返回、彻底删除确认/取消及刷新；请求未知结果按原键确认，账户隔离不变。
- 预览与版本：真实 DOC/DOCX/PPT/PPTX/PDF/图片逐页解码、缩放和下载，Office 路径失效不影响独立格式。检查替换/历史恢复、分类备注和文件身份。图片 DOM 可见与页图实际载入分别检查，封面不替代内容。
- 正文与页内查找：真实拖选、系统剪贴板、中英文及跨文字项命中、字面符号、当前页计数与键盘导航。检查当前文件替换/历史恢复、归档与筛选、快速翻页/账户变化的迟到结果；无文字和失败可区分且可重试。缩放 75%-200%、深浅主题和 390px 下实际检查高亮、选择复制与焦点。
- OCR：沿同一真实认证、HTTP、Job、SQLite 和 Files 入口验证指定页、复制、搜索定位、停止/重试、响应丢失、断网接续、文件更新及来源一致。固定产物[回放](../../apps/web/e2e/fixtures/resources-recognition/README.md)只证明消费机制；获准的真实模型验证设置 `RESOURCE_OCR_REAL_HOME` 为[工具目录](../SETUP.md#本地页识别工具)，检查实际文字/公式/题图并保存页结果和截图，普通回归不启用模型。

浏览器回归使用隔离构建；`RESOURCE_UI_DEV=1` 另验 Vite/StrictMode 的[开发服务路径](#开发服务回归)。上传、往返、刷新、中文文字层以及当前请求范围需有效，卸载或身份变化后旧响应不能覆盖现场。桌面辅助栏、窄屏、主题、提示消退和关闭焦点须实际查看。

## 日程专项

[日程场景](schedule.feature)中的日程、重复、提醒及通知返回是本分区判据，交换预期见[契约案例](schedule-cases.md)。两视口分别记录空态、长文本/重叠段、编辑、保存失败、冲突、删除、通知定位与返回，检查外壳不滚动、无页面级水平溢出、焦点和实际指针/触控。时间选择使用真实指针轨迹，不借合成事件证明；HTML 拖放排序与指针选段按设计规则分别记录。真实平板触控与完整日程链另验，当前候选从[核查入口](../plans/run-state.md#核查入口)选择回归。

日程专项统一使用 `apps/web/e2e/schedule/playwright.config.mjs`，按实际行为选择 spec：

| 要核对什么 | spec |
| --- | --- |
| 常规已纳入 CI 的日历能力 | `capabilities.spec.js` |
| 真实指针、拖选/拖动和跨午夜/跨年交互 | `interaction.spec.js` |
| Enter/Escape、字段/菜单、焦点、标签与输入法组合属性 | `keyboard.spec.js` |
| 保存中继续输入、取消、冲突、迟到响应和未确认结果 | `consistency.spec.js` |
| 系统时区同步、切换竞态、DST 与时间反馈 | `time-zone.spec.js` |

例如仅验键盘时运行 `npx playwright test -c apps/web/e2e/schedule/playwright.config.mjs keyboard.spec.js`。`WORKBENCH_WEB_DIST` 指向隔离生产构建；各用例使用真实认证、API 和 SQLite 建独立场景，邮件为测试替身。输入法事件属性自动检查不代替真实系统输入法，指针/模拟触控不代替目标平板。

当前常规 CI 只选择 capabilities；专项配置可选择整个日程目录。实际集合以 config/testMatch 和所选 spec 为准，收集到用例不表示已运行或全部日程保证完成。开发者按影响定点运行，CI 外的键盘、保存竞态、时区或真实手势被改动时仍须补验，不默认全目录重跑。

## 数学专项

统一制作浏览器回归使用 `apps/web/e2e/math-unified.config.mjs`，连续输入、弹窗与播放使用 `math-unified-repair.config.mjs`；保存保护和取消分别使用 `math-geogebra.config.mjs` 中的具名场景；旧源保存/会话保护复用现有 `math-workspace.config.mjs`，按真实旧源导入建场。API 核验入口为 `apps/api/test/math-workshop.test.js`、`math-workshop-view.test.js` 和既有 `math-*.test.js`，固定输入在 `apps/api/test/fixtures/math-workshop/`。网页桥回归按[扩展说明](../../extensions/math-web-ai/README.md)执行。

验收须操作真实界面、刷新读回并打开实际文件，区分作者自验、独立核验和用户目标环境。运行与必要回归只依赖仓库内源码、固定输入及按运行指南准备的工具；preview 的 `test-results/math-handoff/math-unified/` 只提供既有执行证据，不是安装或接手前置。整体完成条件与剩余验证在[项目状态](../plans/run-state.md)维护。

## 账户与工作台专项

交互动效、焦点、参考尺寸见[界面规则](../rules/design-and-verification.md)。修改设置时用 `apps/web/e2e/settings-shell.config.mjs` 的隔离真实认证/可靠性服务；帮助用 `help-shell.config.mjs`。资料包及备份恢复用 `manual-data/manual-data.config.mjs`，跨模块草稿、冲突和未确认请求用 `manual-support/playwright.config.mjs`；这些入口均相对于 `apps/web/e2e/`。

完成相关 UI 修改应实际检查桌面及 390px 窄屏、各页面主题/背景组合、头像上传/删除同步侧栏及重新登录读回、键盘菜单、弹层退出中间态、快速反向和焦点恢复；同时确认偏好保存失败可重试、真实导出和退出可用。语言和删号使用 `apps/web/e2e/settings-implementation.config.mjs` 与 `apps/api/test/account-deletion.test.js` 验证真实认证、跨账户和未知结果。后端用 `apps/api/test/reliability.test.js` 核对账户隔离、版本冲突、旧字段兼容及头像输入校验。帮助另检查搜索空结果、无效文章、刷新返回和目录现场。当前验证入口见[核查入口](../plans/run-state.md#核查入口)。

## AI 助理呈现专项

C26/C27 用真实题目检查 1440×900、820×1180 和 390×844：首页、AI/工具切换、长对话与公式、历史弹层、草稿失败、冲突、停止/重连、操作结果打开后返回。截图与实际指针/键盘操作一起留证；测主要区域滚动独立、外壳无横向溢出、按钮可点击、焦点返回和新消息提示。既有原型只提供入口关系，未继承其固定回答或验收结论。

### 真实模型保留库

本专项消费同一候选实际模型执行后的报告和隔离数据库，不纳入默认 CI。获得本次真实调用授权后，在仓库根准备已构建的 `WORKBENCH_WEB_DIST`、全新的 `AGENT_EVIDENCE_DIR`、私有 `COMMANDCODE_API_KEY`，并设置 `COMMANDCODE_BASE_URL=https://api.commandcode.ai/provider/v1`。模型白名单以 `apps/api/test/fixtures/c26/live.mjs` 为准，分别执行：

```bash
node apps/api/test/fixtures/c26/live.mjs deepseek/deepseek-v4.1-flash
node apps/api/test/fixtures/c26/live.mjs z-ai/glm-5.3-flash
npx playwright test -c apps/web/e2e/c26/agent.config.mjs -g live
```

三次执行保持同一 `AGENT_EVIDENCE_DIR`；已有报告不覆盖。保留报告指向的数据库与文件，核对 `kind=live`、`status=completed` 后浏览器才可验证重启和成果打开。缺报告/数据库会明确跳过，不能当作模型通过；非 live 的草稿、重连、未知结果及业务编辑冲突场景使用受控 SDK，可单独执行，也由 CI 的 agentIntegration project 持续保护。Agent 扩展开发仍沿运行台账暂停，本节不授权额外产品开发或模型调用。

## 共用测试输入与建场

跨 API/浏览器消费的题库原稿、配图和录制识别结果归仓库根 `test/fixtures/questions/`；Web 独立页面的 build/config 留在 `apps/web/e2e/fixtures/materials-questions/`，API 建场归 `apps/api/test/fixtures/questions/server.mjs`。不要按路径名相近复制另一套材料，其中八份材料输入、recognition 录制、recognition-document-4 与 legacy 旧页均保留固定输入身份，固定内容、摘要与来源说明随实际输入维护。公共预览输入归根 `test/fixtures/materials/`，数学 HTML 修订输入归根 `test/fixtures/math/`；不能按生成来源或年代删除。

共用真实认证数学建场为 `apps/api/test/fixtures/math-real.mjs`；数学页面服务为 `apps/api/test/fixtures/math/server.mjs`，资源页面服务为 `apps/api/test/fixtures/resources/server.mjs`，公共材料服务为 `apps/api/test/fixtures/materials/server.mjs`，跨材料集成为 `apps/api/test/fixtures/materials/integration.mjs`。旧 core/dataStore、core/auth 只作为 `apps/api/test/fixtures/legacy-source/` 的兼容测试输入，不能据旧 helper 存在恢复产品 dataStore 接口；当前应用由公开 close 释放运行资源。固定归档内部路径和 provenance 摘要保持原版，不跟随当前源码改写。
