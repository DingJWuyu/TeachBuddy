# Lessons

修改代码前读本页，审查时核对相关条目。只记录本仓已证实失误产生的当前预防规则；稳定工程判据见[代码标准](docs/code-standards.md)。

## 当前条目

### 当前装配使用当前目录，历史样本只验证兼容

修改目录或协议后，运行当前功能的 fixture 直接使用产品装配；只有明确验证旧版本的测试才加载其冻结样本。目录示例不能替代当前 `moduleCatalog`，否则测试会在业务执行前失效，还会误报覆盖了旧库升级。固定旧版应用仍按其旧接口关闭资源，不能把当前 `close` 端口批量替换进同一升级测试的旧版阶段。

资源 HTTP fixture 曾用材料协议 v2 的示例替换当前资源描述，缺少 `webEnabled`，六个场景均启动失败；其“旧库迁移”场景实际初始化的是当前实现。依据：[原 fixture](https://github.com/DingJWuyu/TeachBuddy/blob/71877a7768c904fdd082d5d53864a52c5dc68236/apps/web/e2e/fixtures/materials-resources/server.mjs)、[原测试](https://github.com/DingJWuyu/TeachBuddy/blob/71877a7768c904fdd082d5d53864a52c5dc68236/apps/api/test/materials-resources.test.js)；升级夹具批量替换关闭接口导致两个固定 R31 场景失败的依据见 [CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38683706468)。当前保护在[资源 HTTP 测试](apps/api/test/materials-resources.test.js)和[固定旧库升级](apps/api/test/math-integration-migrations.test.js)。

出现日期：2026-10-14。已核实 1 个不同日期。

### 按实际工具依赖分配 CI 测试

把测试加入 CI 前，追到它实际执行的文件转换或浏览器入口，再选具备这些前置的 job。确定性 HTTP 测试也可能调用系统工具；工具安装还须覆盖实际格式，存在 `soffice` 不代表已安装 PPT 所需的 Impress。开发机已有工具的通过结果不能证明 Runner 前置足够。

资源 HTTP suite 的补充预览和正文搜索会调用 Bubblewrap 与 Poppler，曾被加入只准备 Node 的 API job；资源浏览器套件的 PPT/PPTX 预览还暴露了 Office 安装缺少 Impress。现按实际路径分组并补齐组件，保留原断言。依据：[错误分组](https://github.com/DingJWuyu/TeachBuddy/blob/2ee70e90e6c6c6428e277a5e605e9a9707c3a49c/package.json)、[分组失败 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38613661520)、[格式组件失败 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38614967580)；实际依赖见[文件转换器](apps/api/src/workbench/files/converter.js)和[转换 worker](apps/api/src/workbench/files/conversion-worker.mjs)。

出现日期：2026-10-14。已核实 1 个不同日期。

### 未决操作的接续入口由持久状态决定

修改保存、导入或列表恢复时，核对未决请求所在的每个实际页面：刷新后临时提示为空，仍应按持久请求状态显示确认或重选原文件的入口。不能只在已经打开编辑器的页面提供恢复动作，也不能以提示文字是否存在代替业务状态。

数学制作源导入和归档丢响应后刷新，首页曾保留 pending 却不显示确认；网页上传还有独立 importPending，只在旧编辑器显示重选入口，首页无法接续。两类失败均经真实首页操作复现，修复复用原请求键及原文件核实。依据：[旧首页条件](https://github.com/DingJWuyu/TeachBuddy/blob/71b6abf8aba732591906712f33eab520d00a80c0/apps/web/src/features/math/index.jsx)；当前保护在[制作源及归档恢复](apps/web/e2e/math-workspace.spec.js)和[网页原件重选](apps/web/e2e/manual-support/support.spec.js)。

出现日期：2026-10-14。已核实 1 个不同日期。

## 维护规则

1. 完整改动目的或阶段交付时，依据返工、回归、独立审查和用户纠正决定是否新增或更新；没有新的已证实教训时不修改。不建立夜间循环或社区监听。
2. 每条写清触发条件、可执行规则、保护的使用结果、固定本仓 commit/Issue/入库样本证据和出现日期。单次有充分证据即可记录；假设、普通命令错误和外仓事故不计数，不编造历史。
3. 同一规则在三个不同日期各有独立本仓证据时，合并到所属稳定权威页并移除本页重复条目；已被现行标准涵盖的内容直接改权威规则，不再制造第二副本。失效规则移除，历史由 Git 保留。
4. 证据只保留足以核查当前规则的链接，完整执行过程留任务产物；长期条目不能只依赖被忽略目录或个人机器路径。当前任务的未完成问题沿[当前任务记录](docs/agents/module-development.md#当前任务记录)维护，范围外待判断发现进入 [buffer](buffer.md)，Lessons 不替代待办。
