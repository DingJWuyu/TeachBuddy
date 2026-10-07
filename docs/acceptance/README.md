# 验证入口

执行者只读当前任务相关场景和测试入口。功能页提供局部验证；[完整矩阵](mvp-matrix.md)用于全范围交付；[质量样本](samples.md)用于材料、数学和目标 Office 核对。

## 选择验证

| 变化 | 必要反馈 |
| --- | --- |
| 文档、导航、资料位置 | 文件/锚点、权威来源、消费者和固定输入完整性；涉及脚本路径时运行对应脚本或测试 |
| 业务 API 或存储 | 真实 HTTP/数据库集成，按影响范围检查迁移与重启 |
| UI/UX | 实际浏览器流程、隔离生产构建、图像及动效过程；UI 不写单元测试 |
| 预览、输出、离线 | 真文件生成、下载、打开，必要时断网冷启动 |
| 跨模块组合 | 受影响的真实跨模块路径及必要回归 |
| 开发服务、组件挂载与清理 | [开发服务回归](#开发服务回归)，保留 React StrictMode，验证重复初始化后仍可读取、上传和保存 |

测试文件/config 从[功能规格](../README.md#功能规格)进入；命令以根和各 workspace 的 `package.json` 为准。`.feature` 是带稳定编号的行为场景，目前不由 Cucumber 执行；实际反馈来自 HTTP/Playwright。教学基础和数学关联各有独立 Background，不混用前置条件。旧场景中的“软删除”对应可恢复的归档/删除；永久删除另按模块规格验收，不用归档场景证明不可恢复操作。

## 浏览器准备

新环境在仓库根目录完成 `npm ci` 后，执行 `npx playwright install chromium`，安装锁定 Playwright 版本对应的浏览器。支持的 Linux 发行版若缺系统库，使用 `npx playwright install --with-deps chromium` 同时安装依赖，该步骤可能需要系统管理员权限；具体支持范围见 [Playwright 官方安装说明](https://playwright.dev/docs/browsers#install-system-dependencies)。更新 Playwright 后重新执行安装。

浏览器回归使用上述 Chromium，不依赖某台主机的 Google Chrome 安装路径。专项需要其他浏览器时，在对应配置与验证说明中明确安装步骤；新环境验证使用独立浏览器缓存，不能用本机现有缓存代替准备。

## 开发服务回归

运行 `npm run predev` 后执行 `npx playwright test -c apps/web/e2e/development.config.mjs`。它启动真实同源 HTTPS 与 Vite，使用隔离数据库、文件目录和邮件替身，覆盖资源上传、PDF 中文文字层、模块往返与刷新，以及题库读取、手动保存和重开。该入口不读取已有实例配置，也不占用 50880。

改变监听或启动方式时另验前端源码修改即时生效、API 修改自动重启及登录保持；验证后还原探针修改。固定 Web 构建继续按模块入口回归，不能用生产构建通过代替开发模式验证。

## 隔离与产物

- 按[运行指南](../SETUP.md#新的隔离环境)选择独立端口、库、文件目录与构建产物。Pandoc/Office 路径必须指向可用工具；测试不能读取或改写用户实例。
- 测试输出写 `test-results/`，证据默认在 `test-results/evidence/`；支持环境变量的入口可指定独占目录。两者均为可清理的运行产物，不存放唯一用户成果或固定输入。
- Playwright 截图通过 `testInfo.outputPath()` 写入用例独立目录；临时实例用系统临时目录和 `mkdtemp` 创建，或先创建明确的输出父目录。测试自行准备本次输入，不能依赖另一用例或旧运行留下目录。
- 运行前核对 fixture/config 与当前规格；过时用例须按现行行为更新并保留有效保护断言，不能为旧断言恢复已删除功能。绝对路径、外部工具和真实模型验证另核对当前条件。
- 记录 real-auth / test-principal、real-mail / fake-mail、真实服务 / 替身及实际候选。self、independent、user 分别表示作者自验、独立验收、真人反馈；退出码和局部 PASS 不代表整个产品。
- 失败保留本次现场；成功后清理临时数据。固定样本和用户已有成果保留在测试自动清理范围之外。

## 输入与按需参考

| 需要验证什么 | 入口与使用方法 |
| --- | --- |
| Word/WPS 人工编辑与打印 | [Office fixtures](../../apps/web/e2e/fixtures/office/) 的六份 DOCX、源文本/公式/图片；按[人工操作](samples.md#人工-office-样本)核对。输入样本不是产品转换成功证明。 |
| 备课当前真实输出 | `apps/web/e2e/fixtures/materials-lessons/verify-outputs.mjs` 生成 `test-results/evidence/R34/v1/outputs/`，再由同目录 `office.py` 读取处理；必须先生成本次候选输出。 |
| 设置/帮助外观 | 按[界面规则](../rules/design-and-verification.md)核对当前运行页面及用户指定参考；截图留本次验证产物 |
| 题干/答案原稿独立定位 | 先运行 `node apps/web/e2e/fixtures/materials-questions/build.mjs` 构建隔离题库页面，再执行 `npx playwright test -c apps/web/e2e/fixtures/materials-questions/playwright.config.mjs materials-questions-fragments.spec.js`。该 test-principal fixture 使用自己的页面入口，不能用真实认证主应用构建替代。 |
| Agent 真实模型保留库 | `apps/api/test/fixtures/c26/live.mjs` 生成模型报告和隔离数据；`apps/web/e2e/c26/agent.spec.js` 读取。二者共用 `AGENT_EVIDENCE_DIR`，默认 `test-results/evidence/C26/v1`。执行前核对报告与数据目录来自同一候选；新环境缺少它们时标记未验证，真实模型请求须有本次授权。Agent 扩展开发仍按[项目状态](../plans/run-state.md)暂停。 |
| API 字段与兼容 | 从[文字契约](../README.md#契约说明)进入；机器契约在 `apps/api/src/contracts/`，交换样本在 `apps/api/test/fixtures/contracts/`。测试以固定样本和预期行为验证实现，不能只用实现自身生成预期结果。 |
| 固定旧版升级 | `npm run test:api` 包含 A11/T53、R31 题库及班级材料关联旧库升级；数学和材料旧版分别执行 `node scripts/math-support/verify-upgrade.mjs`、`node scripts/materials/verify-migration.mjs`。入口从 `apps/api/test/fixtures/legacy-source/` 的不可变源码包创建旧库，来源、路径和摘要见同目录 `provenance.json`；不需要旧 checkout、Git 归档引用或环境变量。归档内部保留当时的路径。 |
| 备课与数学旧库升级 | `apps/api/test/math-integration-migrations.test.js` 随 `npm run test:api` 执行。使用入库的 `r31-questions` 原版源码包，分别通过旧版默认装配和其 M41 数学装配的 HTTP 接口创建库、附件及原请求回执，再复制给当前版本升级并重启两次。核对旧业务列、引用、作品版本、文件字节、原键回放、账户隔离与源库不变；允许迁移追加列，不改造旧版源码。输入由测试重建，不需要外部 P/M 验收库或旧 Git 对象，结果只证明该固定旧版。 |
| 外部 E 选页与跨页 | 按[质量样本](samples.md#固定输入与回放)下载并校验公开原件，设置 `M33_PRIVATE_PDF` 后运行 `npm run test:api`；`materials-questions.test.js` 与 `materials-questions-fragments.test.js` 分别核对选页及原件保留、受控提取结果的跨页关联。缺原件时两项明确跳过；这些检查不证明新的 GPU OCR 推理准确率。 |
| 当前能力核查 | [项目状态的核查入口](../plans/run-state.md#核查入口)指向当前源码、固定样本和可重现测试；既往本机结果只证明当时的候选。新候选按影响范围补验，缺少输入或目标设备时记未验证。 |
