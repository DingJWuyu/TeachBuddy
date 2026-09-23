# Materials 交换与样本检查

这些是设计用例，不能标为产品运行 PASS。精确请求、响应和文件格式由 [OpenAPI](materials.openapi.yaml) 的 schemas、paths、examples 唯一拥有；本页定义交换顺序与断言。行为与边界见[契约入口](materials.md)。

## 起点与替身

每个用例单独从 R31 隔离 runner reset。建立可信身份 A/B、不同 Cookie jar，使用同源 HTTPS；写入按 B11 带来源/保护头及新的 UUID 幂等键。用户对象与文件 ID 使用真实响应替换示例 ID，环节/引用/分类/草稿的客户端 ID 保持稳定；示例 File 的100字节和摘要只是协议值，真实文件上传按实际字节返回，不伪造该摘要。

前端使用同版 examples 驱动替身：请求先按对应 requestBody 校验，再按以下序列返回结果和延迟/失败；不能只根据按钮名返回成功。后端测试直接调用相同 HTTP 操作并独立断言预期数据，不能以实现生成的快照作为唯一预期。成功/失败之后 GET 验证状态，所有 mutation failure 检查无部分变更。

原件来源按[实验裁决](../../arch/materials-evidence.md)定位 C21 与 C22 固定提交。T/W/P/I/PS 自动拆题用 C21 原件；C22 学生练习是答案泄漏反例，不能作为“无答案”的期望。E 全原件只在保留工作区读取，不复制到本仓库。机器原始结果、校对结果和最终题目分别保存证据。

## 成功、失败与恢复序列

| 用例/BDD | 请求和样本 | 必须验证的结果 |
| --- | --- | --- |
| MC01 / M001、M025 | multipart uploadFile；同键重试，同文件不同键再传 | 201 FileSaved 形状；摘要/大小匹配原件。同键同ID，新键可新ID并有账户内 duplicateOfFileId；没有自动建第二个资源。 |
| MC02 / M013、M014 | CreateResource → ResourceSaved；requestFilePreview {} → Job；轮询 getFilePreview | 原件先201；preview受理202，不提前 ready；最终实际PDF/页图可通过 downloadFile 读取，内容与页序正确。 |
| MC03 / M001、M009 | CreateTextImport、CreatePdfImport；GET ImportForReview | 原稿/Job同事务201；先自动生成草稿再校对。空正文或非法JSON返回可读取失败Job，不假装空题全部完成。 |
| MC04 / M003 | CreateCrossPageImport；使用E原稿 | page7/8不是1/2；layout截断产生JobPartial；例6/练习/思考分别4/3/3小问，教师活动留片段，不凭教师活动生成答案。 |
| MC05 / M005、M006 | Crop → FileSaved；SaveReview全量替换拆分/合并后的draft数组；ConfirmOne → ConfirmedOne | 裁图属于正确原稿，原始字节不变；提交创建题目/映射和import版本原子成功。相同原键响应丢失后恢复不重复；新键且当前baseVersion重复确认也不建第二题。 |
| MC06 / M007 | ConfirmOne前保留open疑点或answerStatus=unresolved | 409 DraftNotReady，GET题目数不变；修正保存后以新键成功。客户端伪造confirmed/questionId、修改已确认草稿或移除它返回422 invalid-input。 |
| MC07 / M004、M008 | 故障Provider/进程重启 → JobUnknown；RetryPage | 未确认Provider不自动重发，原稿和已校对结果在。retry返回新Job、attemptOf=旧ID且import.jobId变更；旧任务保留。取消 queued/running 及终态重复取消不清空成功页。 |
| MC08 / M004 | supplementImport将新照片fileId加入保留材料 | 原件未替换，import.version增加并自动为新增输入受理提取，结果追加候选；可从遮挡位置与补充位置来回核对。 |
| MC09 / M010 | taxonomy初始{version:1,types:[],tags:[]}，PUT Taxonomy内容带baseVersion；DeleteType | 分类初始空、ID可关联；改名不换ID，删除解除active/deleted题目关联并增加各版本。NFC/casefold同名422 invalid-taxonomy，循环/重复ID同样拒绝。 |
| MC10 / M011 | CreateManualV2 → QuestionSavedV2；PUT基于保存结果；CopyV2；GET copies/source/for-reference | 直接编辑同ID；复制新ID、采用时Snapshot，笔记/标记按请求。原题删除后副本来源仍可读，relocateQuestion仅修改import题来源位置。 |
| MC11 / M012 | B11 CreatePasted/引用/未知请求，迁移后GET v2；加入ImageBlock | 原Document v1不强转，旧ID版本关系保留。未知旧请求在原路径重放；旧GET/列表/覆盖新内容返回UnknownVersion，v2可正常操作。 |
| MC12 / M013 | ResourceFolders；移动/删除folder与tag；listResources组合查询 | 文件夹含后代筛选，多个tag为AND；删除父目录移到保留祖先，不删除资源；q搜索原文件名/名称/备注。 |
| MC13 / M015 | PreviewLegacyLimited；SupplementPreview | 原DOC显示limited且实际页可读；绑定本账户PDF后resource.version增加，旧引用不变。原fileId已变或PDF不完整拒绝，不能蒙混成ready。 |
| MC14 / M016 | CreateLessonV2引用ResourceSaved；ReplaceFile；GET LessonSavedV2形状 | 资源ID/名称/分类/备注保持，源版本增加；旧snapshot.fileId仍F1、latestVersion变2；明确采用2才换F2。采用旧版返回ResourceVersionConflict并原子拒绝整课。 |
| MC15 / M017 | 对question/resource/import/lesson分别SetDeletion；恢复后查usages/文件 | 删除不改文件/来源/已有快照。活动usages不含已删课，恢复同ID；源deleted仍能供保留引用编辑/导出，不允许新引用采用deleted。 |
| MC16 / M018、M019 | CreateLessonV2；PUT移动references到materials，显式再放一次用新ID | 本课总览不重复持久化；移动保持ID/快照/note，新ID才代表重复使用。旧reference换源、跨账户源、来源版本冲突都整课拒绝。 |
| MC17 / M020 | 六个Export_* → 对应ExportAccepted_*；GET Job；listLessonExports；downloadFile | 202含固定lessonVersion与options，不等于下载就绪；终态成功产生fileId，旧输出继续可取。输出来自受理时快照而非生成完成时最新源。 |
| MC18 / M021 | 每类Export_*依次将两个开关置00、10、01、11 | 学生内容树没有solution/teacher-note/note；教师答案编号对应出现位置。OOXML解包和PDF全文/页图同时检查，使用Q2配方与教师注记定位反例。 |
| MC19 / M022、M023 | 不支持公式→FormulaFailure；有效内容但转换器退出/磁盘满→Job failed | 受理前FormulaFailure为422不建Job；受理后失败在Job.issues，ExportRecord.fileId为null。成功原件/旧输出不丢；重新生成用原导出入口新键，retryJob不接export。 |
| MC20 / M024 | PptAsset → Job；figure-png选择题内真实图ID | 获取透明PNG分片与原图，复制公式源可编辑；选其他题图或跨账户fileId拒绝。答案关闭则图片无答案，note永不输出。 |
| MC21 / M025 | 文件写满前、rename后DB提交前、DB提交后丢响应分别断开/重启 | 未提交不会有可获取的File记录；已提交同键恢复同ID。持久文件缺失返回DiskFailure，不以假成功掩盖。 |
| MC22 / M026、M027 | 以B/无身份访问每类数据和衍生文件，错误来源/伪造身份；恶意HTML/Office/zip | 401/404/403/422符合顺序，不泄漏A对象信息；HTML转义，转换无宿主网络/文件读写权限，超限明确失败。 |

所有列表返回全部匹配结果；排序除 usages 特例外按 updatedAt 降序、ID升序，File无列表接口。GET查询不隐式修改对象。taxonomy的 GET 是一次集合读取，改名/删除成功后 UI 更新筛选chip；正在编辑旧baseVersion的题/资源会冲突，不能覆盖分类删除效果。

## 精确拒绝矩阵

| 前置/输入 | HTTP / problem | 数据不变断言 |
| --- | --- | --- |
| 缺Cookie / 外账户ID | 401 unauthenticated / 404 not-found | 不返回姓名、路径、内容或当前版本。 |
| 写请求缺保护头或错误完整来源 | 403 request-not-allowed | 业务操作和文件处理未开始。 |
| JSON损坏、未知字段、隐式类型、超限 | 400 malformed-json / 422 invalid-input / 413 payload-too-large | 不保存任务/业务半成品；已有原件可读。 |
| 同键不同JSON/字节 | 409 idempotency-key-reused | 原成功对象/任务保持。 |
| baseVersion过期 | 409 version-conflict，currentVersion | 不自动merge/overwrite，客户端GET对照再新键。 |
| 源版本过期/来源已删 | 409 materials/reference-version-conflict / workbench/object-deleted | 备课整个PUT不写入。 |
| 框越界/错原稿链/文字范围越界 | 422 materials/invalid-location | 不创建裁图或修改题来源。 |
| 不支持Document版本 | 422 invalid-input + unsupported-content-version | 旧字节/节点原样保留。 |
| import仍running时保存 | 409 materials/import-not-editable | 先停止/等待；校对输入保留在本地。 |
| 无可重试单元/重试export | 409 materials/job-not-retryable | 原任务不变。 |
| taxonomy同名/循环/未知ID | 422 materials/invalid-taxonomy | 集合与关联原子不变。 |
| 空练习/不属于本课的输出选择 | 422 materials/invalid-export-selection | 不建立空成功文件。 |
| 本地文件持久设施失败 | 503 materials/storage-unavailable | 结果未确认时按原键确认，不能主动生成新逻辑请求。 |

problem完整字段由schema拥有。业务 field采用JSON Pointer；解析schema合法后违反跨字段关系也必须返回规定problem，而非500。已成功原键重放先于归属对象的最新版本/状态校验，身份/来源/schema仍先校验。

## 六种输出的独立预期

| 样本名后缀 | 固定预期 |
| --- | --- |
| lesson-plan_docx | DOCX可解包，标题/开头/环节/题目/资源目录和选中备用内容按顺序，数学为OMML。 |
| lesson-plan_pdf | 同一过滤内容，A4可读，资源目录无私密URL，正文与教师专属内容分离。 |
| handout_docx | 题面和文稿文字可编辑，公式可再次编辑，作答空白是可编辑文档内容。 |
| handout_pdf | 题目与配图完整，作答空白按answerSpaceLines，跨页不截公式。 |
| practice_docx | 只含所选题目，重新编号，同题多次出现各编号，小问/选项/图保留，无环节说明。 |
| practice_pdf | 同上且打印稳定；Q2配方关闭答案后消失，Q6未给答案时不补造。 |

每类至少一个教师变体、一个学生变体。每格式原件链接见[六种格式样本](../../arch/materials-evidence.md#六种格式样本与用途)。Linux可编辑切片与目标Windows/WPS切片各自有实际应用版本与行为证据；保存后XML仍有m:oMath只是补证，不能单独证明实际编辑体验。

## 契约检查命令

R30 文档检查不运行产品。读取 YAML、校验 OpenAPI 3.2.1 与全部本地引用，按 Draft 2020-12 验证 `components.examples.*.value` 对应 `x-schema`，检查六种 kind×format 样本完整；校验 BDD 场景标签与表格映射及 Markdown 本地链接。检查结果、工具版本和实际命令记录在 [R30 self-check](../../acceptance/evidence/R30/v1/self-check.md)。

R31-R34 使用冻结版 schema 做真实请求/响应断言，另运行本表的跨字段/状态用例；schema通过不代替这些行为检查。UI没有单元测试，优先真实HTTP集成和浏览器流程。临时校验环境不成为产品依赖。
