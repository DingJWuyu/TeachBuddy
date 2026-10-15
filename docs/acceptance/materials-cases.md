# 材料交换验收

核验[材料交换契约](../contracts/materials.md)时读本页。本文拥有交换顺序与双侧断言，字段归机器契约；结果和未验条件归[运行台账](../plans/run-state.md)。协议或保护行为改变时同步用例，场景编号保持稳定。

这些是设计用例，不能标为产品运行 PASS。精确请求、响应和文件格式由 [OpenAPI](../../apps/api/src/contracts/materials.openapi.yaml) 的 schemas、paths、examples 唯一拥有；本节定义交换顺序与断言，语义沿[材料契约](../contracts/materials.md)约定。

### 起点与替身

每个用例单独从 R31 隔离 runner reset。建立可信身份 A/B、不同 Cookie jar，使用同源 HTTPS；写入按 B11 带来源/保护头及新的 UUID 幂等键。用户对象与文件 ID 使用真实响应替换示例 ID，分类/草稿的客户端 ID 保持稳定；示例 File 的100字节和摘要只是协议值，真实文件上传按实际字节返回，不伪造该摘要。

前端使用同版 examples 驱动替身：请求先按对应 requestBody 校验，再按以下序列返回结果和延迟/失败；不能只根据按钮名返回成功。后端测试直接调用相同 HTTP 操作并独立断言预期数据，不能以实现生成的快照作为唯一预期。成功/失败之后 GET 验证状态，所有 mutation failure 检查无部分变更。

原件来源和变体差异按[质量样本](samples.md#固定输入与回放)定位。T/W/P/I/PS 自动拆题用 C21 原件；C22 学生练习是答案泄漏反例，不能作为“无答案”的期望。E 完整原件按样本页公开来源下载并核对摘要，不以旧工作区为前置，也不复制到本仓库。机器原始结果、校对结果和最终题目分别保存证据。

### 成功、失败与恢复序列

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
| MC12 / M013 | ResourceFolders；移动/删除folder与tag；listResources组合查询 | 文件夹含后代筛选，多个tag为AND；删除父目录移到保留祖先，不删除资源；q搜索原文件名/名称/备注及当前可提取正文，未完成读取的进度单独返回。 |
| MC13 / M015 | PreviewLegacyLimited；SupplementPreview | 原DOC显示limited且实际页可读；绑定本账户PDF后resource.version增加，文件历史记录原件及补充预览。原fileId已变或PDF不完整拒绝，不能蒙混成ready。 |
| MC20 / M024 | PptAsset → Job；figure-png选择题内真实图ID | 获取透明PNG分片与原图，复制公式源可编辑；选其他题图或跨账户fileId拒绝。答案关闭则图片无答案，note永不输出。 |
| MC21 / M025 | 文件写满前、rename后DB提交前、DB提交后丢响应分别断开/重启 | 未提交不会有可获取的File记录；已提交同键恢复同ID。持久文件缺失返回DiskFailure，不以假成功掩盖。 |
| MC22 / M026、M027 | 以B/无身份访问每类数据和衍生文件，错误来源/伪造身份；恶意HTML/Office/zip | 401/404/403/422符合顺序，不泄漏A对象信息；HTML转义，转换无宿主网络/文件读写权限，超限明确失败。 |

所有列表返回全部匹配结果；排序按 updatedAt 降序、ID升序，File无列表接口。GET查询不隐式修改对象。taxonomy的 GET 是一次集合读取，改名/删除成功后 UI 更新筛选chip；正在编辑旧baseVersion的题/资源会冲突，不能覆盖分类删除效果。

### 精确拒绝矩阵

| 前置/输入 | HTTP / problem | 数据不变断言 |
| --- | --- | --- |
| 缺Cookie / 外账户ID | 401 unauthenticated / 404 not-found | 不返回姓名、路径、内容或当前版本。 |
| 写请求缺保护头或错误完整来源 | 403 request-not-allowed | 业务操作和文件处理未开始。 |
| JSON损坏、未知字段、隐式类型、超限 | 400 malformed-json / 422 invalid-input / 413 payload-too-large | 不保存任务/业务半成品；已有原件可读。 |
| 同键不同JSON/字节 | 409 idempotency-key-reused | 原成功对象/任务保持。 |
| baseVersion过期 | 409 version-conflict，currentVersion | 不自动merge/overwrite，客户端GET对照再新键。 |
| 框越界/错原稿链/文字范围越界 | 422 materials/invalid-location | 不创建裁图或修改题来源。 |
| 不支持Document版本 | 422 invalid-input + unsupported-content-version | 旧字节/节点原样保留。 |
| import仍running时保存 | 409 materials/import-not-editable | 先停止/等待；校对输入保留在本地。 |
| 无可重试单元/重试题面素材 | 409 materials/job-not-retryable | 原任务不变。 |
| taxonomy同名/循环/未知ID | 422 materials/invalid-taxonomy | 集合与关联原子不变。 |
| 本地文件持久设施失败 | 503 materials/storage-unavailable | 结果未确认时按原键确认，不能主动生成新逻辑请求。 |

problem完整字段由schema拥有。业务 field采用JSON Pointer；解析schema合法后违反跨字段关系也必须返回规定problem，而非500。已成功原键重放先于归属对象的最新版本/状态校验，身份/来源/schema仍先校验。

### 验证方法

用 schema 做真实请求/响应断言，并验证本表的跨字段/状态行为；schema 通过不代替行为检查。样本覆盖当前文件、提取、题面素材及资源操作。UI 优先真实 HTTP 集成和浏览器流程，不写单元测试，临时校验环境不成为产品依赖。

## 场景与边界映射

| BDD | UX | 主要操作/定义 | 原任务职责 |
| --- | --- | --- | --- |
| WB-M001 至 M009 | U-M1、2、7 | uploadFile、createImport、saveImportReview、commitImportDrafts、Location、Job | R31 文件；R33 收录 |
| WB-M010 至 M012 | U-M3 | taxonomy、Question v2、copies、source-location | 题库 |
| WB-M013 至 M017 | U-M4 | Resource、Preview、replaceResourceFile、supplement-preview | R31/R32 |
| WB-M024 | U-M6 | createQuestionAsset、Document | R33；R31 公共呈现 |
| WB-M025 至 M028 | U-M7、8 | B11 协议、File、Job、版本适配 | 各模块与共享底座 |
