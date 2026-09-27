# 共用页识别

题库、资源和备课使用同一个机器页结果。HTTP/schema 以 [materials.openapi.yaml](materials.openapi.yaml) 为准；来源、文件与任务沿用 [materials.md](materials.md)。模块只负责采用、校对及自己的业务结构，不各自启动 OCR 服务。

## 入口与状态

- `GET /api/workbench/files/:id/recognition?renditionFileId=...` 返回配置是否可用、固定来源和各页状态；GET 不受理识别。
- `POST` 同一路径，正文 `{renditionFileId,pages}`，带现有请求保护和幂等键，返回持久受理的 `recognition` Job。
- `GET /api/workbench/files/:id/recognition/pages/:page?renditionFileId=...` 读取这一份来源的机器结果。省略 rendition 只读当前预览；消费者应传入画面中固定的 rendition。
- 取消与重试使用现有 Job 接口。`unitId` 为 `page:N`；空重试集合代表原请求全部未完成页。已成功页保持不变。引擎修订变化后拒绝重试旧 Job，需要明确重新发起识别。重启将运行中页标为 interrupted，不自动重发。

原件、rendition、页图均为同账户受管文件，且必须出现在已生成的固定预览映射中。尚无预览返回 `preview-required`；引擎不可用且需要新识别时返回 `recognition-unavailable`。前端保留原件和输入，显示可重试状态。其他账户的文件及结果返回 404。

成功页按账户、页图字节摘要和引擎/转换修订复用。同像素的另一份上传可以复用结果，但返回 `location` 必须绑定本次请求原件、rendition 和绝对页号。模型输出的空页号、相对序号不能覆盖这个映射。活跃请求覆盖全部所选页时返回同一 Job；仍有其他页正在处理时返回 `job-running`，不静默改变选择。

未配置引擎时，既有成功结果仍可读取。取消期间已经完整返回的原始结果和图片作为该 Job 的证据保存，不发布为 ready 或重开任务；请求记录绑定迟到产物，后续重试不能擦除这份绑定。

## 机器页结果

`ready` 表示完整结果、文稿和引用的文件可以读取，不表示教师已经校对，也不表示识别准确率为 100%。结果包含：

- `resultId`、输入摘要、引擎修订及本次来源 `location`。
- `rawFileId` 指向原始识别 JSON；原始版面字段保留，不被机械转换覆盖。
- `document` 是 Document v2，包含文字、数学、表格和受管图片；`text` 是可搜索的全文投影。
- `blocks` 保留模型块的数组顺序和原始字段，补充块级 Document、文字、归一化区域及附件引用。空 order 不触发重新排序。
- `assetFileIds` 保留全部派生及原始图片，包括 HTML 表格内的图片；`originalAssetFileIds` 单列原始资产。文稿引用派生 PNG，不能用资产总数计算文稿的图数。
- `derivations` 保存每张图的原坐标、polygon、派生矩形及裁图疑点。原页矩形保留原像素；缺少表格单元格边界时，保守扩边可能带入表格线，必须保留疑点。
- `issues` 汇集格式恢复、未解析数学、结构缺口及裁图疑点。缺失被引用的图片或不可读取的内容导致失败，不能伪装为空页成功。

机械转换只表达模型实际返回的内容。不得添加答案、重画原图、纠正数学结论或用固定题号规则修补样本。原始图块与从原页像素派生的裁图分别记录；派生不得使用旧 polygon 掩膜截掉图形。

## 模块接缝

服务端依赖 `recognition` 提供 `get`、`readPage`、`readResult`、`request` 和 `ensurePage`。`readResult(principal,resultId,source)` 同时核对已完成结果和来源。题库 extraction Job 在自己的执行内调用 `ensurePage(principal,{fileId,renditionFileId,page},{signal,retry})`，不能把子任务排入同一串行执行器再等待。已有失败页默认只读，显式重试才重新执行。

资源查询把原生文字与已完成 OCR 结果合并，原生 PDF 文字层保持其原有坐标。识别正文不冒充精确文字层。备课采用前允许整页校对，保存来源及机器/采用快照；后续编辑不覆盖机器结果。题库独立负责题号、答案、题图和跨页关联。

部署备份保存识别表与受管原始结果/图片并核验账户关系；备课当前环节的 `pageSource` 与历史快照都校验文件归属。个人资料包保留识别元数据及附件；它仍是可读导出，不提供覆盖账户式还原。
