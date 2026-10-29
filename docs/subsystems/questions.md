# 题库技术入口

改题目、材料收录或题面产物时读本页。行为见 [题库规格](../features/questions.md)，字段和 operationId 见 [材料 schema](../../apps/api/src/contracts/materials.openapi.yaml)；旧请求形状见 [workbench schema](../../apps/api/src/contracts/workbench.openapi.yaml)，兼容保证见 [版本过渡](../contracts/materials.md#b11-兼容与版本过渡)。

## 责任与调用面

[createQuestionsModule](../../apps/api/src/modules/questions/index.js) 接收 `db/mutations/now/files/content/jobs/provider/recognition`，返回 `router`、`port` 和 `jobHandlers`。题库拥有题目、材料元数据、原稿绑定、校对草稿、分类、提取事实及复制来源；文件字节和持久 Job 分别归公共 files/jobs。

| 调用目的 | 实际入口 |
| --- | --- |
| 当前题目查询、创建、修改、复制、来源读取、位置和素材；分类；收录、校对、补充和确认 | `port.operations`，由 [createMaterialsOperations](../../apps/api/src/modules/questions/materials-operations.js) 构造，使用同文件导出的 `materialsContract`；[materials-router](../../apps/api/src/modules/questions/materials-router.js) 只把 HTTP 映射到这些操作 |
| 旧 HTTP | 内部 [createQuestionsOperations](../../apps/api/src/modules/questions/operations.js) 与 [router](../../apps/api/src/modules/questions/router.js)，冻结 schema、原路径和原键回执保持 |
| 既有工具及新文稿的统一业务调用 | `port.businessOperations`，由 [createQuestionBusinessOperations](../../apps/api/src/modules/questions/business.js) 接受 `principal/key/id/input/query`；题库选择旧请求或当前文稿实现，调用者不判断文稿版本 |
| 资料导出与恢复校验 | [lifecycle](../../apps/api/src/modules/questions/lifecycle.js) 的 `snapshot(db, principal)` 提供题目、分类、imports 与需保留的识别证据；`validateStorage(db)` 校验本模块记录与关系 |
| 已受理任务执行 | `jobHandlers.extraction` 和 `jobHandlers['question-asset']`，由组合入口绑定，不作为任意业务工具 |
| 删号清理 | 同一 lifecycle 的 `deleteAccountData(db, accountKey)`，由账户生命周期在外层事务内调用 |

[connectBusinessOperations](../../apps/api/src/agent/business.js) 只将工具参数转换到 `port.businessOperations`。题库复用旧 HTTP 的校验、兼容拒绝和幂等操作，旧成功请求先在原路径重放；无法表示当前对象时转入当前操作，不将富文稿投影为 v1。只读副本查询由 [materials-operations](../../apps/api/src/modules/questions/materials-operations.js) 的 `listQuestionCopiesForAgent` 提供。工具接受的旧/新请求和响应通过 [Agent schema](../../apps/api/src/contracts/agent.openapi.json) 的 `anyOf/$ref` 声明；这不是全部材料能力已开放给模型的声明。v1 的 [legacy-contract](../../apps/api/src/modules/questions/legacy-contract.js) 只维护基础兼容定义，不作为 v2 材料 schema。

原始材料定位归 [materials-locations](../../apps/api/src/modules/questions/materials-locations.js) 的 `createLocationValidator`：它从题库持久收录及提取任务取得原件、固定 rendition、DOC 转换来源摘要和段落 run 范围，供提取、校对、确认和入库后的重定位共用。调用者只交 principal、材料和待校验片段；公共 content 负责通用文稿结构和附件归属，不解释题库来源链。

## 可信调用与提交

下面是服务端富文稿复制调用：`principal` 来自认证中间件或 Agent 服务端绑定会话，`key` 来自调用方保留的逻辑请求 UUID，`copyInput` 按材料 schema 的 CopyQuestion 构造，含所采用源版本及所需内容。

```js
const result = questions.port.operations.copyQuestionV2({
  principal: verifiedPrincipal,
  key: logicalRequestKey,
  id: sourceQuestionId,
  input: copyInput,
});
```

v2 操作同步返回 `{status, body}`，合法失败抛带 `status/problem` 的 Error。读取不传 key；写入经 `mutations.execute` 同事务提交题目、来源快照和成功回执，版本/归属/内容错误整笔回滚。`arguments: {id, body, query}` 只属于兼容 operations，不可混传。结果未知保持原键、原体及原路径，先核实再处理新输入，见 [共享保存](../contracts/workbench.md#写入冲突与未知结果)。旧操作遇富内容明确拒绝，不能压平为旧文稿。

材料任务受理只确认 Job 与业务初态；提取/图片生成在事务外执行。停止、重试、迟到结果和校对保护由 [materials-service](../../apps/api/src/modules/questions/materials-service.js)、[extraction](../../apps/api/src/modules/questions/extraction.js) 与公共 jobs 共同处理，202 不等于已入库。提取的原件准备循环将 signal 传给预览；Word 预览降级和下一原件开始前均核对停止，不能将取消当转换失败继续读取。公共预览等待转换进程 close，排队启动及派生文件落库后再次检查停止，才发布新预览；原件与既有完成页保留。识别停止及整份机器证据交付沿[共用识别](../contracts/recognition.md#模块接缝)，题库不回读共享缓存重建停止证据。

## 运行路径与持久化

- [Web 题库](../../apps/web/src/features/questions/index.jsx) 经认证 transport 调用 v2 HTTP router，再到同一 materials operations/service/store；[materials-store](../../apps/api/src/modules/questions/materials-store.js) 与 [repository](../../apps/api/src/modules/questions/repository.js) 持有题目和 `questions_materials_*` 表。
- 收录操作保存 import 并 enqueue extraction，handler 保留原生读取与模型结果，老师校对后 `commitImportDrafts` 才创建题目与确认映射。
- 题面素材操作受理 question-asset，由 [assets](../../apps/api/src/modules/questions/assets.js) 和 [png-render](../../apps/api/src/modules/questions/png-render.js) 保存受管 File；下载复用文件授权，不公开本机路径。

[useQuestionSession](../../apps/web/src/features/questions/useQuestionSession.js) 拥有题库完整持久编辑流程：设备草稿、原请求核实、版本冲突、收录、校对与确认入库。页面 [MaterialsQuestionsPage](../../apps/web/src/features/questions/MaterialsQuestionsPage.jsx) 消费该 session 呈现内容，[QuestionFinder](../../apps/web/src/features/questions/QuestionFinder.jsx) 组织新版列表、搜索与模块右轨；新建、编辑、改编及三步收录继续调用真实 session，无本地业务模拟。[QuestionControls](../../apps/web/src/features/questions/QuestionControls.jsx) 负责编辑控件与浮层；[question-documents](../../apps/web/src/features/questions/question-documents.js) 拥有文稿操作，[review-drafts](../../apps/web/src/features/questions/review-drafts.js) 处理校对拆分。[materials-api](../../apps/web/src/features/questions/materials-api.js) 只承担 HTTP 读写/上传/下载，[uploadRecovery](../../apps/web/src/features/questions/uploadRecovery.js) 保存上传核实所需的设备记录，[OriginalPane](../../apps/web/src/features/questions/OriginalPane.jsx) 读取原稿。文稿编辑复用公共 [DocumentEditor](../../apps/web/src/components/materials/DocumentEditor.jsx)，原生输入沿 [native-word](../../apps/api/src/modules/questions/native-word.js)、[native-pdf](../../apps/api/src/modules/questions/native-pdf.js) 和 [recognized-page](../../apps/api/src/modules/questions/recognized-page.js)。

`OriginalPane` 的预览读取随原稿文件切换或显式重试更新，不随校对材料版本重载。保存校对时保留已显示的原稿、缩放和滚动；新增草稿、裁图或分类不改变不可变原件。

页图现场沿 `scene.scrollPositions` 按文件与页保存：内层页图区域的横移、滚动和外层原稿卡片的纵向滚动分别记录。原稿图片加载后恢复，图片按不可变页图身份挂载，加载期间不把临时的零位置覆盖到已保存现场。

就地创建分类每次打开由 `useQuestionSession.openCategory` 分配独立 `openingId`，页面将其作为 `QuestionDialog` 的 key。共享 `ModulePresence` 继续保留退出动效，快速重开仍按新打开的对话框初始化名称焦点与触发器归焦，避免复用尚在退出的旧实例。

分类创建由 session 保存发起时的题目或校对草稿身份。响应只关闭同一 `openingId` 的窗口，并在目标仍当前时合并到 `editorRef` 的最新输入；页面不保存捕获整题的分类选用回调。切换目标后，已创建分类仍保留在分类表，迟到响应不改写当前对象。

题库的放弃草稿、替换新题、内容生命周期及分类删除确认直接使用共享确认框的 `present`，portal 内的退出保留和交互关闭由共享组件负责；业务页面不另保留旧确认数据。分类删除在异步读取影响数并禁用按钮前，把焦点交给同一行名称输入框，取消后可沿该行继续操作。

对象深链只在目标题目改变时初始化阅读场景；同一对象因业务更新重新挂载时，`useQuestionSession` 恢复其持久编辑与对照状态。读取最新服务器内容与保留设备草稿分别处理，后续保存仍按原版本检查冲突。

迁移由 [migrations](../../apps/api/src/modules/questions/migrations/index.js) 提供。跨模块不直接读题库表；资料包和维护沿静态装配加载的 lifecycle，Agent 沿 `port.businessOperations`。目录不开放题库时，已有题库数据仍由其 lifecycle 维护。

[native-text](../../apps/api/src/modules/questions/native-text.js) 拥有 `nativeText` 及题目起始、答案标题、显式续题规则，保留原文字符范围、唯一规范题号匹配和未分配片段。[extraction](../../apps/api/src/modules/questions/extraction.js) 只编排提取；原生 Word、PDF、识别页与[配图定位](../../apps/api/src/modules/questions/extraction-figures.js) 直接读取文本规则，不反向依赖编排入口。

## 验证入口

入口和受影响场景统一从[题库验证](../acceptance/README.md#题库专项)选择，执行分工沿[CI 与本地验证](../agents/github-workflow.md#ci-与本地验证)。核对保存/刷新后的公式、配图、来源与校对状态，固定回放与真实识别分开。技术入口只描述调用路径，不声明本候选通过。
