# 题库技术入口

改题目、材料收录或题面产物时读本页。行为见 [题库规格](../features/questions.md)，字段和 operationId 见 [材料 schema](../../apps/api/src/contracts/materials.openapi.yaml)；旧请求形状见 [workbench schema](../../apps/api/src/contracts/workbench.openapi.yaml)，兼容保证见 [版本过渡](../contracts/materials.md#b11-兼容与版本过渡)。

## 责任与调用面

[createQuestionsModule](../../apps/api/src/modules/questions/index.js) 接收 `db/mutations/now/files/content/jobs/provider/recognition`，返回 `router`、兼容 `operations`、`port` 和 `jobHandlers`。题库拥有题目、材料元数据、原稿绑定、校对草稿、分类、提取事实及复制来源；文件字节和持久 Job 分别归公共 files/jobs。

| 调用目的 | 实际入口 |
| --- | --- |
| 当前题目查询、创建、修改、复制、来源读取、位置和素材；分类；收录、校对、补充和确认 | `port.operations`，由 [createMaterialsOperations](../../apps/api/src/modules/questions/materials-operations.js) 构造，使用同文件导出的 `materialsContract`；[materials-router](../../apps/api/src/modules/questions/materials-router.js) 只把 HTTP 映射到这些操作 |
| 仍可表示的旧文稿及既有工具请求 | 顶层 `operations`，由 [createQuestionsOperations](../../apps/api/src/modules/questions/operations.js) 定义，参数使用 `arguments`，不是 v2 的 `input/id/query` |
| 资料导出 | 同步 `port.readForExport(principal)`，含题目、分类、imports 与需保留的识别证据 |
| 已受理任务执行 | `jobHandlers.extraction` 和 `jobHandlers['question-asset']`，由组合入口绑定，不作为任意业务工具 |
| 删号清理 | 模块导出的 `deleteAccountData(db, accountKey)`，由账户生命周期在外层事务内调用 |

[connectBusinessOperations](../../apps/api/src/agent/business.js) 同时消费两种 operations，保留旧请求核实并将当前文稿交给 v2；只读副本查询由 [materials-operations](../../apps/api/src/modules/questions/materials-operations.js) 的 `listQuestionCopiesForAgent` 提供；这不是全部材料能力已开放给模型的声明。v1 的 [legacy-contract](../../apps/api/src/modules/questions/legacy-contract.js) 只维护基础兼容定义，不作为 v2 材料 schema。导出的 `createQuestionsService` 是构造能力，业务调用沿已装配 operations，才能保留校验与幂等。

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

材料任务受理只确认 Job 与业务初态；提取/图片生成在事务外执行。停止、重试、迟到结果和校对保护由 [materials-service](../../apps/api/src/modules/questions/materials-service.js)、[extraction](../../apps/api/src/modules/questions/extraction.js) 与公共 jobs 共同处理，202 不等于已入库。

## 运行路径与持久化

- [Web 题库](../../apps/web/src/features/questions/index.jsx) 经认证 transport 调用 v2 HTTP router，再到同一 materials operations/service/store；[materials-store](../../apps/api/src/modules/questions/materials-store.js) 与 [repository](../../apps/api/src/modules/questions/repository.js) 持有题目和 `questions_materials_*` 表。
- 收录操作保存 import 并 enqueue extraction，handler 保留原生读取与模型结果，老师校对后 `commitImportDrafts` 才创建题目与确认映射。
- 题面素材操作受理 question-asset，由 [assets](../../apps/api/src/modules/questions/assets.js) 和 [png-render](../../apps/api/src/modules/questions/png-render.js) 保存受管 File；下载复用文件授权，不公开本机路径。

[useQuestionSession](../../apps/web/src/features/questions/useQuestionSession.js) 拥有题库完整持久编辑流程：设备草稿、原请求核实、版本冲突、收录、校对与确认入库。页面 [MaterialsQuestionsPage](../../apps/web/src/features/questions/MaterialsQuestionsPage.jsx) 消费该 session 呈现内容，[QuestionControls](../../apps/web/src/features/questions/QuestionControls.jsx) 负责编辑控件与浮层；[question-documents](../../apps/web/src/features/questions/question-documents.js) 拥有文稿操作，[review-drafts](../../apps/web/src/features/questions/review-drafts.js) 处理校对拆分。[materials-api](../../apps/web/src/features/questions/materials-api.js) 只承担 HTTP 读写/上传/下载，[uploadRecovery](../../apps/web/src/features/questions/uploadRecovery.js) 保存上传核实所需的设备记录，[OriginalPane](../../apps/web/src/features/questions/OriginalPane.jsx) 读取原稿。文稿编辑复用公共 [DocumentEditor](../../apps/web/src/components/materials/DocumentEditor.jsx)，原生输入沿 [native-word](../../apps/api/src/modules/questions/native-word.js)、[native-pdf](../../apps/api/src/modules/questions/native-pdf.js) 和 [recognized-page](../../apps/api/src/modules/questions/recognized-page.js)。

迁移由 [migrations](../../apps/api/src/modules/questions/migrations/index.js) 提供。跨模块不直接读题库表；资料包沿 readForExport，Agent 沿 operations。

[native-text](../../apps/api/src/modules/questions/native-text.js) 拥有 `nativeText` 及题目起始、答案标题、显式续题规则，保留原文字符范围、唯一规范题号匹配和未分配片段。[extraction](../../apps/api/src/modules/questions/extraction.js) 只编排提取；原生 Word、PDF、识别页与[配图定位](../../apps/api/src/modules/questions/extraction-figures.js) 直接读取文本规则，不反向依赖编排入口。

## 验证入口

入口和受影响场景统一从[题库验证](../acceptance/README.md#题库专项)选择，执行分工沿[CI 与本地验证](../agents/github-workflow.md#ci-与本地验证)。核对保存/刷新后的公式、配图、来源与校对状态，固定回放与真实识别分开。技术入口只描述调用路径，不声明本候选通过。
