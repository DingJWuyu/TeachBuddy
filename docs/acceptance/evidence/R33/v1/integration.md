# R33 候选接入

产品 SHA `5c42b24332671fa31e421a41a38309a7da64414a`；组合 fixed point `d7222ac5a4726d4ee833a900221bbe894f9bfd8b`；完整 R31 输入 `2b6cbcda934057a89c0443437e03b2e30e850a8d`。状态与质量分母以 [author.md](author.md) 为准：self FAIL，在线 BLOCKED。这是可接续候选，不是发布件。

## 安装与隔离入口

在本分支根目录执行；不要使用来源 worktree 的数据库或端口。

```bash
npm ci
npm run build
node apps/web/e2e/fixtures/materials-questions/build.mjs
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 node apps/web/e2e/fixtures/materials-questions/server.mjs test-results/r33/browser-data 48339
```

浏览器访问 `http://localhost:48339/fixture/session`，得到隔离 test-principal cookie 后进入真实 questions 页面。只绑定 localhost；不连接模型。`server.mjs` 禁止 production 使用。SQLite、原稿和日志分别在 `test-results/r33/browser-data/workbench.sqlite`、`files/`、`logs/`。页面产物在 `test-results/r33/web`。交接停写时服务停止，目录保留，可用同一命令恢复。Office 路径是本机只读已有安装，其他机器需提供同等受支持安装并设置该变量。

```bash
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 node --test apps/api/test/materials-questions*.test.js
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 npm run test:api
npx playwright test --config apps/web/e2e/fixtures/materials-questions/playwright.config.mjs
npm run build
```

E2E 使用独立 Playwright context 与 `/opt/google/chrome/chrome`，不占用其他 session 的浏览器。Chrome CLI 的 R33 命名会话探测未取得可用 page，实际截图与验收来自这里的独立浏览器。

## 样本与身份边界

- 独有 fixture `T.txt`、`W.docx`、`P.pdf`、`old-I.content.json`、`figure.png` 来自固定实验输入 `6850864dcebaf3617bd465a50361c688ba1887dd`，原实验只读。旧响应只保存正文，不含 reasoning。
- 私有 E 由 API 测试只读 `/home/liam_t/项目/TeacherWorkspace-c21/experiments/C21/data/external/E.pdf`，复制进自有 files，选页 7-8。仓库仅保存摘要证据；该路径缺失时不能宣称 E 验证通过。
- fixture 默认 r33-a/r33-b；生产 auth 未验。API 用真实 cookie、保护头、UUID Idempotency-Key、baseVersion，真实持久化与公共端口。
- 测试替身仅身份入口、装配与显式注入的 Provider 既有响应/空结果/截断结果；公共文件、Job、DOM 编辑器、Office、crop、PNG 渲染不是 mock。
- 成功样本：文字两题公式、W 原生六题、独立答案图片 DOCX、透明表格 PNG。失败样本：无 Provider 图片/E、截断 JSON 前缀、空正文、已确认草稿篡改、外来 draft ID、失效定位/分类、并发版本冲突。F/PS 全矩阵尚未完成。

## 公共接口与装配

入口 `apps/api/src/modules/questions/index.js`：

```js
const module = createQuestionsModule({ db, mutations, now, files, content, jobs, provider });
module.router;
module.port.readForReference(principal, id); // 兼容 v1
module.port.readForReferenceV2(principal, id);
await module.port.operations[operationId]({ principal, key, input, id, query }); // { status, body }
module.jobHandlers.extraction; // run + retry
module.jobHandlers['question-asset']; // run
```

字段与 HTTP 状态唯一来源是 `docs/contracts/workbench/materials.openapi.yaml`，router 按其 questions/v2 操作生成。19 个 operationId：

| 范围 | operationId |
| --- | --- |
| 分类 | getQuestionTaxonomy, updateQuestionTaxonomy |
| 题目 | listQuestionsV2, createQuestionV2, getQuestionV2, updateQuestionV2, setQuestionDeletionV2, readQuestionForReferenceV2 |
| 改编/定位/素材 | copyQuestionV2, listQuestionCopiesV2, relocateQuestion, createQuestionAsset |
| 材料 | createImport, listImports, getImport, saveImportReview, supplementImport, commitImportDrafts, setImportDeletion |

HTTP 前缀 `/api/modules/questions/v2`。公共 Job 的 cancel/retry/get、files 的 upload/preview/crop/content 沿用 R31，不另建私有替代协议。

Provider 内部接口 `await provider.extract({ principal, file, page, preview, signal })`。principal 供适配器经公共 files 端口受控读取原稿或页图，page 是真实页码；返回值经过 `adaptProviderResponse` 处理既有正文/候选形状。该接口本身无凭据加载或 HTTP 模型调用。响应正文与规范化结果保存在 questions 私有 task；不保存 reasoning。R34/根必须先确定授权方案再注入网络实现，不能将重放注册为生产能力。

前端注册仍在 questions 自有 `index.jsx`，使用既有 auth transport、公共 DocumentEditor/DocumentView 与右侧 tools 注册。共享 Editor/外壳未改。加入备课仍是旧公共对话框接缝，不声称已完成 lessons/v2 真链。

## 迁移与依赖

`questions_materials_001` 由 questions 的 `migrations/index.js` 导出，追加 meta/imports/taxonomy/tasks 四表；复用旧 question_items，按读取补 v2 元数据，保留原请求重放。常规启动迁移即可，不需要手动 SQL。升级核验从固定 R31 实际创建数据库，经当前启动迁移并两次重启，详见 `materials-questions-migration.test.js` 与 `migration.json`。现场 `/tmp/r33-upgrade-*` 保留。

依赖：公共 db/mutations/files/content/jobs；包 yaml、yauzl、@xmldom/xmldom、sharp、mathjax-full；本地字体与公共 Office 预览。锁文件未改。`@xmldom/xmldom@0.9.12` 当前锁已有且受根 override 约束，但 API 尚缺直接依赖声明，R34 应补明确声明并按需更新唯一锁文件。

## R34 必接事项

1. `workbench/moduleLoader.js` 保留 questions 返回的 jobHandlers；在唯一 `jobs.start` 装配真实 extraction/question-asset 与 files preview、lessons export。当前共享装配不会自动消费模块的 jobHandlers，fixture 用闭包绑定进行真实 self 验证。同步核对 production handler gate，不把 fixture 设置用于生产。
2. 共享 moduleCatalog 升级材料 v2；lessons 使用 `readForReferenceV2`，加入备课与使用位置采用同版契约。questions 不直接查 lessons 表。
3. 共享迁移测试更新清单：`apps/api/test/first-flow-migrations.test.js` 的 MIGRATION_IDS 两例；`workbench-migrations.test.js` 的 PRODUCT_MIGRATIONS 三例；`workbench-mutations.test.js` 的固定 ledger 一例。新增 ID 为 questions_materials_001，不能移除生产迁移来使断言变绿。
4. 公共身份/外壳/依赖/锁与最终 BDD、生产启动检查由 R34 接入验证。已知全 API 6 项失败使整体门禁仍 FAIL。
5. 在线补验先由根确定新方案与有限授权。当前请求数/token/费用上限均为 0，没有新增质量证据足以重启旧失败页级路线。

R33 后续质量工作归本节点与根/R30裁决：T/W 公式与结构达标、F/PS/全 BDD 缺口。上述事项不通过本回执转移成 R34 自动兜底，也不缩减原 R33 范围。候选交付后保持停写；未达完成条件，保留全部数据与进度。
