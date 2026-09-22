# R32/v1 资源模块交接

资源实现与隔离验证已交付，完整应用构建仍被共享注册阻断，归 R34。`npm run build` 的实际失败见 [build.log](build.log)，不能把独立 fixture 构建写成完整生产应用通过。产品候选与聚合状态见 [author.md](author.md)。本节点不合 main、push、部署或联系其他业务 session。

## 固定组合

- main-based 起点：`d01ff01` 的完整 SHA 见 [inputs.json](inputs.json)。分支 `feat/r32-resources`。
- R31 完整输入 `2b6cbcda934057a89c0443437e03b2e30e850a8d`，产品 `6225fc07a895113a667b5a41092a7a69e2f2fefa`；来源 `/home/liam_t/项目/TeacherWorkspace-r31-complete` 只读。
- R30 设计 `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1`；最终 independent 冻结 `88a89f00b78dd301ca9893a191277eb9970c4c18:docs/acceptance/evidence/R30/v1/final-review.md`。
- 引入 R31 后的组合 fixed point：`f1281ca30015605f5f9ae71b7a3d58283fd23fb8`。保留当前根 `AGENTS.md`、`docs/plans/run-state.md` 与 README 的主干状态说明；组合之后只写 R32 边界。

## 接口和装配

| 对象 | 当前交付 | R34 接线 |
| --- | --- | --- |
| API factory | `apps/api/src/modules/resources/index.js#createResourcesModule({db, mutations, files, now?})` 返回 `{router, port}` | 使用 R31 已有依赖注入；在 `apps/api/src/workbench/moduleImplementations.js` 增加 resources 的固定 factory/migrations 映射。 |
| 迁移 | `apps/api/src/modules/resources/migrations/index.js#migrations`，ID `resources_001`，仅拥有 `resource_items`、`resource_taxonomy` | 由现有 module loader 与唯一迁移 runner 装配，不另跑 SQL、不改既有迁移。空库、R31 旧库、重复启动已测。 |
| 公共引用 | `port.readForReferenceV2(principal, resourceId)`，同步返回唯一 schema 的 `ReferenceReadResource` | lessons 的引用创建/显式更新在同一 SQL 事务调用；已删除源仍可读，是否允许新采用由 lessons 裁决。不得反向注入 lessons 或读取其表。 |
| 公共业务动作 | `port.operations.<operationId>({principal,key,input,id,query}) -> Promise<{status,body}>` | 与 HTTP 共用校验与 mutations。可信 principal 由调用入口提供，不从 Agent 参数取账户。 |
| HTTP | router 挂 `/api/modules/resources`，10 个操作见下段 | 继续经过 R31 来源/保护头/身份/JSON guard；module 内 `materialErrors` 处理 materials problem。 |
| Web | `apps/web/src/features/resources/index.jsx` 默认 `ResourcesPage` | 注册到 `apps/web/src/features/modules/moduleRegistry.js`，由外壳路由 `/resources` 渲染。 |
| Web props | `transport` 必填，是 A11 `useAuth().request` 的页面绑定 transport；`onOpenLesson(usage)` 导航到备课；可选 `onPickResources(resources)` 接收按选择顺序的当前资源 | `WorkbenchRoot/WorkbenchApp` 将 transport 传至页面；不能换成生产 raw fetch。取材页面可提供 `onPickResources`，由 lessons 执行原子采用。 |
| 外壳上下文 | `accountKey/generation/registerTools/notifyIdentityLost` | 复用现有 ShellContext；资源工具注册为 `resource-taxonomy`，外壳继续拥有 AI/工具切换及右栏开关。401 暂停 transport，旧账户 pending 保留并通知外壳。 |
| lessons 消费 | GET `/api/modules/lessons/v2/resource-usages/{id}`、GET v2 items/详情、PUT v2 item | 资源自己的“加入备课”对既有课与目标环节生成冻结 `UpdateLesson` 请求。保存成功留在资源页并提供前往备课；真实 lessons 接线归 R34。 |
| Job/依赖 | 本模块不提供 job handler；调用真实 File/Preview/Job | 不增加 handler、不改四项绑定、不加 npm/OS 依赖或锁。 |

操作清单：`getResourceTaxonomy`、`updateResourceTaxonomy`、`listResources`、`createResource`、`getResource`、`updateResource`、`setResourceDeletion`、`readResourceForReferenceV2`、`replaceResourceFile`、`setResourceSupplementPreview`。方法、路径与字段直接消费冻结 `materials.openapi.yaml`。

共享改动归 R34：将唯一静态目录 `packages/shared/src/moduleCatalog.js` 升至同版材料目录，声明 `resources.readForReferenceV2` 及同版 questions/lessons 依赖，更新实际 API/Web 映射和 `features/workbench/routes.js`、`WorkbenchApp.jsx` 路由。`packages/shared/scripts/verify-catalog.mjs` 当前看到 resources 目录但没有映射，拒绝构建是正确保护；应完成真实注册后重跑，不能降低校验或隐藏目录。README 最终能力同步同归 R34。

## 独立运行与验证

环境 Node 22.23.2；复用 R31 的 bubblewrap、Poppler、prlimit 与只读 LibreOffice 程序。无需访问来源 worktree 的数据库或修改原实验。

```bash
npm ci
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
node --test apps/api/test/materials-resources.test.js
npm run test:api
npm run build
npm run build:api
npm run build:web
node apps/web/e2e/fixtures/materials-resources/build.mjs
R32_DATA_DIR=test-results/r32-browser/new-run R32_PORT=48433 \
  node apps/web/e2e/fixtures/materials-resources/start.mjs
# 另一个终端，首次使用全新 new-run；测试会创建用户材料与分类。
npx playwright test --config apps/web/e2e/fixtures/materials-resources/playwright.config.mjs
```

服务仅监听 localhost。进入 `http://localhost:48433/fixture/session`，B 账户入口为同地址 `?account=b`。测试固定使用 48433，API 集成测试单独使用 48432 及其自己的目录。结束服务器后用同一个 `R32_DATA_DIR` 重启，运行相同 Playwright 命令加 `--grep '新浏览器'`，证明进程重启与新上下文回读。交付时独立 fixture 服务已停止，可用上述命令重启。当前保留的可继续现场为 `test-results/r32-browser/review-final-data`；不向其他现场执行 reset。全量 E2E 首轮需空目录；滚动追加样本自身用唯一前缀，定向重跑不依赖重置全库。

fixture 只在 `apps/web/e2e/fixtures/materials-resources/` 内组合真实 R31 和本模块，使用显式 `catalogOverride/extraImplementations`，不修改全局目录。`lessons-adapter.mjs` 的 v2 lesson/Reference/Usage 使用同版 schema、SQLite 与实际资源公共端口，但仍是有界替身，不能当 R34 真备课验收。File 字节、逐页转换、页图、原件下载、资源与分类不是替身。

身份模式是 **test-principal**，Cookie 经 R31 可信 adapter 验证并分为 r32-a/r32-b。全量回归包含原有 A11 real-auth/fake-mail 测试，但本次资源端到端没有冒称 real-auth。正式接入后 R34/R35 仍需 A11 HTTPS 页面绑定、失效/退出与账户切换验证。

## 数据恢复与边界

资源替换保留 ID/名称/分类/标签/笔记，只改变当前文件并清空补充预览。失败不修改当前资源。公共引用快照排除资源备注，固定原件及补充 PDF ID；后续删除恢复不更新已采用内容。文件字节生命周期仍由 R31 拥有，没有永久删除入口。

浏览器 JSON mutation 与上传 File 均在账户分区 IndexedDB 保留原请求和原键，上传成功到建条目/替换之间也保留当前步骤。5xx、断线和无效成功结果保持未确认；新输入草稿存于账户分区场景，不被旧确认覆盖。scene/draft 为本机便利数据，服务端成功响应才表示持久保存。

旧 DOC 始终显示受限风险，补充 PDF 只有实际所有页加载后才可明确采用。测试补充 PDF 是已知三页协议样本，只证明版本绑定、逐页确认与保存，不证明该 PDF 是目标 Office 完整导出的对应 DOC。Windows/WPS 的真实原件对照、目标字体、打印及外部完整 PDF 来源验证仍归 R35/外层；未把 Linux 证据签成目标平台通过。

本次仍需 R34 完成共享注册才能关闭全量构建阻断，随后使用固定候选接入真实 lessons 并交 R35 独立验收。R32 模块缺陷归本节点，公共契约矛盾归 R30；本次未修改契约或缩减任务范围。
