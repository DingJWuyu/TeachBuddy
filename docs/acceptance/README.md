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

## 开发服务回归

运行 `npm run predev` 后执行 `npx playwright test -c apps/web/e2e/development.config.mjs`。它启动真实同源 HTTPS 与 Vite，使用隔离数据库、文件目录和邮件替身，覆盖资源上传、PDF 中文文字层、模块往返与刷新，以及题库读取、手动保存和重开。该入口不读取已有实例配置，也不占用 50880。

改变监听或启动方式时另验前端源码修改即时生效、API 修改自动重启及登录保持；验证后还原探针修改。固定 Web 构建继续按模块入口回归，不能用生产构建通过代替开发模式验证。

## 隔离与产物

- 按[运行指南](../SETUP.md#新的隔离环境)选择独立端口、库、文件目录与构建产物。Pandoc/Office 路径必须指向可用工具；测试不能读取或改写用户实例。
- 测试输出写 `test-results/`，证据默认在 `test-results/evidence/`；支持环境变量的入口可指定独占目录。两者均为可清理的运行产物，不存放唯一用户成果或固定输入。
- 运行前核对 fixture/config：部分旧用例仍针对已移除的设置 UI，不能为旧断言恢复已删除功能。绝对路径、外部工具和真实模型验证另核对当前条件。
- 记录 real-auth / test-principal、real-mail / fake-mail、真实服务 / 替身及实际候选。self、independent、user 分别表示作者自验、独立验收、真人反馈；退出码和局部 PASS 不代表整个产品。
- 失败保留本次现场；成功后清理临时数据。固定样本和用户已有成果保留在测试自动清理范围之外。

## 输入与按需参考

| 需要验证什么 | 入口与使用方法 |
| --- | --- |
| Word/WPS 人工编辑与打印 | [Office fixtures](../../apps/web/e2e/fixtures/office/) 的六份 DOCX、源文本/公式/图片；按[人工操作](samples.md#人工-office-样本)核对。输入样本不是产品转换成功证明。 |
| 备课当前真实输出 | `apps/web/e2e/fixtures/materials-lessons/verify-outputs.mjs` 生成 `test-results/evidence/R34/v1/outputs/`，再由同目录 `office.py` 读取处理；必须先生成本次候选输出。 |
| 设置/帮助外观 | 按[界面规则](../rules/design-and-verification.md)核对当前运行页面及用户指定参考；截图留本次验证产物 |
| Agent 真实模型保留库 | `apps/api/test/fixtures/c26/live.mjs` 生成模型报告和隔离数据；`apps/web/e2e/c26/agent.spec.js` 读取。二者共用 `AGENT_EVIDENCE_DIR`，默认 `test-results/evidence/C26/v1`。需匹配的报告及其 directory，恢复旧现场见[恢复索引](../plans/worktree-archive.md)；缺输入不授权新模型请求。 |
| API 字段与兼容 | 相关功能指向的 `docs/contracts/` schema、samples 及固定外引用；部分由后端直接读取，保留完整引用闭包 |
| 已有能力证明 | [当前证据](../plans/run-state.md#证据边界)，按固定 Git 版本读取；未变范围可引用已有结论，新候选验证受影响部分 |
