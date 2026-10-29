# 班级技术入口

改名单、成绩导入/确认、统计或维护校验时读本页。行为见 [班级规格](../features/classroom.md)，交换关系、统计口径与失败保证见 [班级契约](../contracts/classroom.md)，字段见 [classroom.openapi.json](../../apps/api/src/contracts/classroom.openapi.json)。Web 页面按单一模块目录装配，页面开放及当前候选验收查[项目状态](../plans/run-state.md)，不从前端存在推定班级 Agent 工具已接通。

## 教师页面与适配

[ClassroomPage.jsx](../../apps/web/src/features/classroom/ClassroomPage.jsx) 组织班级工作区，分担到座位、学生、记录、考试、导入、成绩与归档组件；[index.jsx](../../apps/web/src/features/classroom/index.jsx) 在可信账户及身份代次下建立页面会话，卸载时中止旧请求。

[createClassroomApi](../../apps/web/src/features/classroom/api.js) 负责现有 HTTP 契约到页面结构的适配：学号、性格、日期、座位行列、试卷及计分题、工作簿映射和统计结果均在此转换，不改写后端业务字段。列表在适配层按原型呈现顺序整理：班级按创建时间、学生按学号及姓名、标签按名称、考试按日期倒序；不沿用 HTTP 的最近更新顺序。真实文件经公共文件接口上传、下载；写入保留账户范围的原逻辑键与请求体，未知结果重试不能创建第二笔操作。页面布局与动效来自设计输入，统计计算与缺分、缺考口径继续由后端裁决。待上传字节保存在账户隔离 IndexedDB，由 [accountDeviceData](../../apps/web/src/accountDeviceData.js) 在删号确认后清理，[deviceRecovery](../../apps/web/src/platform/device/deviceRecovery.js) 在时间点恢复后冻结到隔离区，不能自动重发。

姓名与学号冲突时，页面只在本班存在唯一精确学号且原表姓名不同的情况下提供明确建议，学生选择仍保持空白；老师点“就是某某”后才提交现有校对请求，手动改选继续有效。没有精确学号证据不提供建议。成绩确认允许无原卷、缺逐题分数及无总分列，姓名与学号至少对应一列；缺总分给出可校对警告，不自动求和。考试编辑器仍至少设置一道计分题。归档学生和记录直接使用账户内 `deleted=deleted` 查询，包含归档父对象下的条目，不再逐活动主体聚合。归档页读取必要的学生父关系，提前说明恢复上级的要求；服务端 [roster.deletion](../../apps/api/src/modules/classroom/roster.js) 同样要求恢复学生及记录时所属班级、学生活动，不自动恢复上级。

班级、考试及学生表单通过 [useClassroomSubmission](../../apps/web/src/features/classroom/useSubmission.js) 提交字段和完成动作，由该 module 拥有本次表单的写确认、后续编辑版本基线和读回接续；HTTP adapter 继续拥有未知写入的原键原体。提交会话只随当前表单存活，不新增跨刷新保证。三表单在写入和读回期间保持busy，禁用字段和取消，并阻止Escape/遮罩提前关闭；读回成功才导航、关闭或清空继续添加。读回失败保留表单与已确认写入，重试只继续读取，改字段时基于已保存版本更新，不重复创建；学生继续添加仅在成功后释放上一条已确认写入。Word原卷沿原链接取回时保留原名，PDF和图片仍打开预览。导入弹层等初始原键恢复与名单读取成功后再挂载，避免先读到恢复前的旧草稿；恢复失败使用页面现有重新加载继续原键。工作簿解析明确返回的 `422 classroom-workbook-input` 视为可修正拒绝，显示服务端原因并释放该逻辑写入，允许重选；未知 Problem、5xx 和传输中断仍保留原键确认。成绩页的筛选工具条在统计加载和失败时保持挂载，菜单多选与已选条件不随异步读取丢失。自由记录读取同时核对请求代次与当前主体、关键词和时间范围，迟到响应不会改写新的筛选现场。

导入列映射使用稳定的 `ColSelect` 组件，修改映射后保留当前下拉框与键盘焦点。上传、生成校对表及确认期间，导入弹层保持忙碌，禁止关闭、返回上一步或修改当前输入。确认重试先经既有 `api.recover` 重放未决原请求，再读取导入状态；已确认时只继续读回和展示完成，不另交校对或二次确认。完成提示只指向班级或学生成绩查看，不承诺尚未开放的个人成绩纠错入口。

标签新建成功仅清空本次提交且仍未改变的输入；改名以提交的编辑快照识别会话，成功回执只能结束该快照，不能关闭取消后重开、改为另一标签或已经继续修改的输入。改名提交至列表版本读回期间禁用保存并忽略再次提交，但允许继续编辑和取消重开，防止下一次改名使用旧版本。

## 责任与调用面

[createClassroomModule](../../apps/api/src/modules/classroom/index.js) 接收 `db/mutations/files/clock`，必须有 `mutations.execute/peek` 和受管文件 `read/open`，返回 `router` 与顶层 `operations`。班级拥有七类对象及其 `classroom_*` 表，种类由 [repository.kinds](../../apps/api/src/modules/classroom/repository.js) 定义：classes、students、records、exams、tags、imports、results。

[createClassroomOperations / routes](../../apps/api/src/modules/classroom/operations.js) 是公开业务调用面：名单、记录、考试、标签、导入、成绩的读取和写入，以及座位、标签合并、导入确认、学生/班级统计和同场比较。参数为 `{principal, arguments, requestPath, key}`，业务操作在工厂顶层 `operations`，不是 `port.operations`。[lifecycle](../../apps/api/src/modules/classroom/lifecycle.js) 提供个人包对象、班级表格正文与关系投影、恢复维护校验和账户删除；维护使用模块仓储及 `validateStoredData`，不依赖运行工厂或模型操作。仓储与 SQL 留模块内部。

## 可信调用与导入提交

老师已经完成导入校对后，服务端使用当前可信 principal 及原逻辑 UUID key 调用确认：

```js
const result = await classroom.operations.confirmImport({
  principal: verifiedPrincipal,
  arguments: { id: importId, body: { baseVersion: currentImportVersion } },
  key: logicalRequestKey,
});
```

确认请求只携带导入的 `baseVersion`，相关考试/班级/学生/成绩基线来自已保存的导入事实，并在确认时重新核验。操作返回 `Promise<{status, body}>`；读取省略 key。HTTP [router](../../apps/api/src/modules/classroom/router.js) 将 params/body/query 放进 arguments，提供 `canonicalRequestPath(req)` 和延迟读 key；进程内调用通常省略 requestPath，沿默认规范模块路径，不接受模型或客户端指定任意路径。合法失败抛 `status/problem`，外账户对象/文件统一 404。

首次创建导入先 `mutations.peek` 检查已有成功回执，无回执才在事务外 [prepareImport](../../apps/api/src/modules/classroom/imports.js) 读取 Excel；准备不占 key，最终仍以 execute 复核并提交。确认由 [assessment.confirmImport](../../apps/api/src/modules/classroom/assessment.js) 在同一事务核对考试/班级/学生/成绩基线，保存成绩、导入状态和成功回执。失败不留部分成绩；未知结果沿 [原键确认](../contracts/workbench.md#写入冲突与未知结果)。

## 运行路径与持久化

- 认证 HTTP 到 router/operations，再到 [roster](../../apps/api/src/modules/classroom/roster.js)、[tags](../../apps/api/src/modules/classroom/tags.js)、imports/assessment，由 repository 写模块表；成绩保留考试时名单快照。
- 受管 Excel File 经 imports/[workbook](../../apps/api/src/modules/classroom/workbook.js) 在事务外解析，校对草稿与固定原表事实保存在 import，确认生成 results。原卷/定位通过公共 files 读取，固定 rendition 使用文件服务，不另建预览系统。
- [statistics](../../apps/api/src/modules/classroom/statistics.js) 从保存的活动考试/成绩计算口径并返回参与版本，不存派生结论；导出与恢复维护沿 lifecycle，存储校验复用 [stored-data](../../apps/api/src/modules/classroom/stored-data.js) 的对象及关系检查。

[模块迁移](../../apps/api/src/modules/classroom/migrations/index.js) 归班级，账户删除由外层生命周期事务调用模块清理。新班级不复用退役 classes 模块 ID 或数据。

班级记录与相应业务拒绝归 [records](../../apps/api/src/modules/classroom/records.js)，记录服务复用同一组归属、版本和业务拒绝逻辑。

## 验证入口

入口和受影响场景统一从[班级验证](../acceptance/classroom.md)选择，执行分工沿[CI 与本地验证](../agents/github-workflow.md#ci-与本地验证)。后端 HTTP/Excel/原卷、统计与生命周期不代签教师页面或实际 AI 接入。技术入口只描述调用路径，不声明本候选通过。
