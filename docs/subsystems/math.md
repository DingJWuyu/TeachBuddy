# 数学工坊技术入口

改作品保存、渲染、历史或课堂输出时读本页。行为见 [数学规格](../features/math.md)，源与交换保证见 [数学契约](../contracts/math.md)，精确字段和操作见 [math.openapi.json](../../apps/api/src/contracts/math.openapi.json)，运行资源见 [数学运行依赖](../SETUP.md#数学运行依赖)。

## 责任与调用面

[createMathModule](../../apps/api/src/modules/math/index.js) 接收 `db/mutations/files/content/mathRuntimeDirectory`，返回 `router/port/migrations`。[createMathService](../../apps/api/src/modules/math/service.js) 从 schema 构造 `operationDefinitions` 与 `port.operations`：作品查找/创建/保存/复制、归档/恢复/彻底删除、历史版本、引用读取和导出。同步 `port.readForExport(principal)` 读取 works/revisions/exports；模块导出的 `deleteAccountData` 由外层账户事务调用。作品、Revision、ExportRecord 归数学，字节归公共 files，不跨模块读表。

数学公共纯计算、源校验与浏览器/离线呈现通过 [shared exports](../../packages/shared/package.json) 消费：`@teachbuddy/shared/math/{formula,expression,geometry,graphics,dynamic,analysis,isolation,presentation,offline,workshop,workshop-runtime,workshop-presentation}`，路径无 `.js`。调用方按用途选择现有子入口；需要构建文件路径时解析 package specifier，不越过 exports 拼 shared 源目录。数据库、身份、受管文件和 Node render worker 留 API。

## 可信调用与提交

对明确保存的历史版本导出时，由服务端验证会话提供 principal，input 按 ExportWork schema 选择合法格式、背景和尺寸：

```js
const result = await math.port.operations.exportWork({
  principal: verifiedPrincipal,
  key: logicalRequestKey,
  id: workId,
  input: exportInput,
});
```

`exportInput.version` 是已保存 revision，不是本地试演现场。操作返回 `Promise<{status, body}>`；读取省略 key，历史读取通过 `getWorkVersion({principal,id,query:{version}})`。合法失败抛 `status/problem`。服务先用只读 `mutations.peek(request)` 读取已有回执，再在事务外读取文件/渲染；成功准备后重新校验归属/版本，在同一 mutations 事务保存作品、revision 或导出记录及成功回执。探测不占成功键，准备阶段不能被解释为已保存；文件有独立持久性，冲突不销毁原件。未知结果沿 [原键核实](../contracts/workbench.md#写入冲突与未知结果)。

引用 HTTP 操作 `readWorkForReference` 只读取已保存作品、版本与固定文件，不现场生成资产；内部读取函数不作为目录端口。当前工作台 Agent 不因此自动获得全部数学工具，网页数学助理沿下述独立桥。

## 运行路径与持久化

[WorkshopWorkspace](../../apps/web/src/features/math/WorkshopWorkspace.jsx) 承接当前统一编辑器，workshop/editor 统一内容快照、试演和撤销，[geogebra/workshop-runtime](../../apps/web/src/features/math/geogebra/workshop-runtime.js) 封装本地 GGB 控制。公式输入使用 MathLive，排版使用本地 MathJax。workshop-render 使用隔离、限时 Chromium 与 Web 同一资产根目录的本地运行时，禁用导入文件脚本并拒绝外部资源；纯公式渲染不启动 GGB，数学源错误与运行时/浏览器故障分开返回。


- [useMathWorkSession](../../apps/web/src/features/math/useMathWorkSession.js) 拥有作品持久会话与保存/恢复流程；[Web 数学入口](../../apps/web/src/features/math/index.jsx) 保留页面入口和 renderer 分派，[LegacyWorkspace](../../apps/web/src/features/math/LegacyWorkspace.jsx) 承接旧源工作区。统一制作的编辑/试演细节仍由 [workshop editor](../../apps/web/src/features/math/workshop/editor.js) 拥有；认证请求到 module router/service，保存到 `math_works` 和 `math_revisions`，导出记录到 `math_exports`，表结构见 [migrations](../../apps/api/src/modules/math/migrations.js)。
- 旧画布的 [GgbWorkspace](../../apps/web/src/features/math/GgbWorkspace.jsx) 在实时捕获与离开时的 `flush` 共用变化判据：未发生交互且构造对象未变时，不把运行时布局重排的序列化差异写成业务修改；实际对象编辑仍捕获并进入原保存流程。
- 普通源沿 [render](../../apps/api/src/modules/math/render.js) 与 [render-worker](../../apps/api/src/modules/math/render-worker.js)；工坊沿 [workshop-render](../../apps/api/src/modules/math/workshop-render.js)，生成固定 PNG/SVG 后存 File。纯公式与数学视图保留各自格式限制。
- 离线演示沿 [presentation](../../apps/api/src/modules/math/presentation.js) 或 [workshop-presentation](../../apps/api/src/modules/math/workshop-presentation.js)，使用公开 shared 入口打包本地运行资源；外部 HTML 使用隔离包装器，边界见 [隔离语义](../contracts/math.md#导出与-html-隔离)。

网页助理的 [web-ai](../../apps/web/src/features/math/web-ai) 通过 [浏览器扩展](../../extensions/math-web-ai/README.md) 接老师的 DeepSeek 页面；构造执行仍由编辑器校验/读回，不成为服务器任意 JS、文件或 SQL 工具。当前 workshop 与旧源共存，兼容/未知 renderer 与源版本处理见数学契约。

## 验证入口

入口和受影响场景统一从[数学验证](../acceptance/README.md#数学专项)选择，执行分工沿[CI 与本地验证](../agents/github-workflow.md#ci-与本地验证)。制品须沿真实 HTTP 下载、停服并禁网冷启动；包解析不证明离线可操作，浏览器网页替身不证明真实模型。技术入口只描述调用路径，不声明本候选通过。
