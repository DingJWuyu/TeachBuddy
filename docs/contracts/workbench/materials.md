# 材料契约：文件、题目、资源与备课

材料语义已采用，当前能力并非全部达标。精确 HTTP/数据定义在 [materials.openapi.yaml](materials.openapi.yaml)，交换正反例在[案例](materials-cases.md)，技术接缝在[材料架构](../../arch/materials.md)。只处理题目保存时读内容、分类和共享保存；涉及文件才展开文件/任务；涉及备课才展开引用/输出。

## 共用规则与真实认证边界

[已冻结 B11](../workbench.md)的可信 principal、同源 Cookie、保护头、Origin/Referer 完整校验、no-store、UUID、服务端 UTC、乐观版本、账户作用域幂等、软删除及未知结果语义原样沿用。本包未重新定义认证、登录/退出、会话过期或账户响应。当前真实身份和页面上下文沿[认证契约](../auth.md)，历史 partial 认证说明不用于现有产品。

所有操作，包括文件字节、缩略图、裁图、预览、任务、补充原稿和引用读取，先经 `resolvePrincipal(request)`。无身份 401，本账户不存在或外账户对象统一 404。客户端不传 accountKey/accountId，不发任意下载 URL 给服务器拉取。真实认证已装配；可信 test-principal 只用于隔离测试，不能被产品 UI/请求参数启用，不能签真实认证 PASS。

JSON 写体上限沿用 2 MiB，文件上传例外为一个 multipart file、100 MiB；单材料最多 100 张图片或一个 PDF/Word，总页数最多 500。超过限制明确 413 或 422，原件若已经保存仍可下载；500 页不是一次 Provider 请求。未知字段及类型不转换，使用 B11 首错次序。资源/备课/环节/材料的标题须含非空白字符，空白标题返回422 invalid-input，按输入保存不自动改写；taxonomy名称的归一化另见分类节。JSON schema 后按归属、版本、对象状态、分类/位置/内容/引用顺序校验；引用依数组顺序。响应允许附加字段，不允许必填值缺失或未知状态当成功。

所有写请求都带 Idempotency-Key；202 仅原子保存任务与初始业务记录，不表示任务完成。幂等成功记录跨重启保留，失败不消耗键。上传按文件名、检测 MIME、SHA-256 绑定请求，multipart 分隔符不参与指纹；同键异字节 409。客户端超时/5xx/无效结果先用同键同请求确认，用户后续输入单存草稿。已知 4xx 修正后新键。Provider 请求的未知结果与浏览器写入未知结果不同，前者不自动再次付费，见任务节。

## B11 兼容与版本过渡

B11 的文件与冻结定义保持不变。新增题库/备课操作分别位于 `/api/modules/questions/v2`、`/api/modules/lessons/v2`；资源使用自己的模块路径，文件和短任务是 workbench 基础能力。v2 与 B11 读写相同对象、ID、业务版本和幂等账本。路径属于幂等指纹，因此未知旧请求必须在原 B11 路径确认，不能换到 v2 重试。

v2 读取旧对象时，原 Document.version=1 原样返回；补充空分类、由旧 solution 是否为空确定 answerStatus，为旧 question 引用补 kind=question。既有题目/来源/引用快照/环节/笔记/时间/删除标记都保留。纯读取不写回、不增加版本。v2 写入时可以继续使用 Document v1，只有使用新节点的文档才写 v2，不全量重写旧文档。快照不被后续内容迁移偷偷替换。

旧 B11 操作在其可表示对象上继续满足原 schema；附加分类等元数据在旧请求未提供时保持。若旧客户端访问含 v2 文档、新来源或资源引用的对象，服务器返回 B11 已有的 `422 invalid-input / unsupported-content-version`，不做有损投影。旧列表若匹配到不可表示对象，同样明确要求使用新版入口，不静默漏题；旧 UI 保留草稿并进入升级提示/只读路径。旧写入先重放已成功原请求，再检查当前版本，最后拒绝不可表示对象的覆盖。v2 全部对象可正常读取，故这是客户端协议升级，不是丢失数据。

B11 的 readForReference 端口继续供旧调用方使用，新增 `readForReferenceV2` 支持本批 Snapshot；新 lessons 只消费后者。旧副本来源中的 v1 快照维持 v1。题库和备课各自拥有自身对象兼容，未知旧请求沿原路径确认。

静态模块目录只有一份。材料版历史协议定义 ModuleCatalog version=2；当前完整组合返回数学契约的 version=3。材料版 v2 的精确描述与依赖名在 materials.openapi.yaml；这是该目录操作的显式版本演进，B11 原定义保留为版本1历史冻结输入，不作为材料版运行响应的竞争定义。支持版本1的旧客户端遇到2必须保留草稿并提示重新加载，不用未知依赖继续装配。当前只注册真实实现并检查映射、缺依赖和环路。

## 文件与定位

文件是服务端托管的不可变字节，保存后 fileId 稳定；资源条目的 version 与文件 ID 不混同。相同字节可在同账户共用物理 blob，但不同新上传请求保留独立文件元数据/原文件名，返回 duplicateOfFileId 供 UI 提示，不自动合并资源或题目。跨账户不暴露重复命中。下载必须重新授权，不暴露磁盘路径、对象存储地址或永久公开链接。

上传完成条件是字节写盘、校验、持久元数据与成功记录均成立。浏览器“100% 已发送”不足以成立。转换失败不会撤销原件。文件名只作显示及安全下载名，检测内容格式；压缩炸弹、外部关系、宏与内嵌脚本不执行，解压和转换限额见架构。

PNG/JPEG/WebP/PDF 产生实际可读预览；DOCX/DOC/PPTX/PPT 经固定转换得到 PDF 与页图；HTML 与其他文件可保留下载，HTML 只作转义文本预览。Preview.state=ready 表示完整生成且通过页数/输出检查，limited 表示已有真实内容但风险或缺页未解决，failed 表示不可预览。DOC 永远附 legacy-object-loss 风险，不能用进程退出码消除此已知缺口。预览请求可异步，GET 不启动有副作用处理。

对同一不可变文件重复 requestFilePreview 时，复用已受理的当前预览 Job，返回202及该Job当前状态，不追加相同转换；失败后通过retryJob建立新尝试。已有页图在重试时仍可读，新的完整预览原子替换派生元数据，引用的固定rendition字节仍保留。limited的风险经同一路线重跑仍需保留，不因重试成功而抹去。

资源补充预览必须是本账户完整 PDF，其 fileId 与资源当前原件 fileId 共同提交；原件已替换时拒绝。老师查看全部页后使用该 PDF，保存为 resource.supplementPreviewFileId；资源版本增加，备课仍需显式采用更新。它不更改原文件，也不宣称恢复了旧 DOC 的可编辑公式。

定位规则：

- page：fileId 是原件；renditionFileId 是生成时固定的 PDF/图片，PDF 原件可与其相同。page 从 1 起；box 是按页面最终显示方向左上角为原点的归一化区域，必须 x+width≤1、y+height≤1。空 box 只表示整页级定位，不能作为精确裁图。图片 page=1。多图各自带 fileId，显示序号由输入顺序决定。
- text：start/end 按原文字 Unicode code point 计数，左闭右开，0≤start<end≤长度。不能用 UTF-16 code unit 误定位中文补充字符。
- docx：原 `word/document.xml` 深度优先段落从 1 起，runStart/runEnd 是该段文字/公式/图 run 序列的左闭右开索引。正文、表格中的段落都计入。此结构位置不等于 Office 页码，有可靠固定 rendition 时同时存 page 定位。

LocatedPart 区分题面/答案/配图/未分配片段；跨页一题包含多个位置，分散答案另有位置。每个 file/rendition 必须来自该 import 原件或已保存补充原件的衍生链。修正题目位置只改关联定位，不能改来源 importId/draftId 或原始字节；复制来源固定，其原稿通过原题链读取，即使原题软删除仍在。

裁图只能使用本账户有效 page + 非空 box，服务器从 rendition 裁成 PNG 后返回 File。老师可换框生成新图，旧图若已有引用继续保留。正文图片只能引用已可读取的 PNG/JPEG/WebP，SVG 输入先受控栅格化；图像本身不被当成可编辑数学公式。

本批没有文件永久删除 API。原件、衍生页图、裁图、输出，以及软删除对象和幂等响应引用的文件都保留；无引用上传保留到后续明确清理流程。F62 备份需覆盖 DB 与文件目录。浏览器临时上传中断的残片可清理，持久业务对象不可被时间型 GC 误删。

## 内容

Document 是 B11 v1 或本批 v2 的封闭联合。v2 增加图片、标题、选项/小问列表、表格、教师注记；没有任意 HTML/attrs。列表 item 有显示 label 和有序块，可独立增删排序；表格各行列数相同，不支持合并单元格，复杂原稿表格可保留原图供局部校对。题干的实际内容无需先选题型。

文字与 LaTeX 是规范源，OMML 是导出制品，不新增第二套可写数学主数据。必须支持 C21/C22 所需的分式、根式、上下标、函数/对数、不等号、区间、绝对值及两行 cases；分段条件保持逐行对应。源码白名单数学语法，不运行 TeX 的文件/网络/宏指令。存储允许未知数学表达的原始源，编辑器显示失败；导出前若不能形成真实可编辑 OMML，返回带 field 的 unsupported-formula，用户修正后重新导出。不能把整题/公式截图作为 Word 成功路径。R34 必须验证源编辑到 OMML 的一般路径，C22 的硬编码节点不等价于此能力已交付。

Document 每层数组及源字符串上限由 schema 给出，另外总块数≤2000、总数学源≤200000 字符；不得无限递归。正文至少有一项可见文字/公式/图片。answerStatus=absent 时 solution 必须空；present 时 solution 非空。unresolved 仅存在收录草稿，不可入库。教师注记块只用于备课正文；题面和答案不得夹带 teacher-note，长期笔记在 note。旧 v1 文档仍按 B11 规则处理。

内容演进只追加明确版本及迁移，不借存储 JSON 跳过校验。未知 Document.version 在读取端保留原数据并提示只读，在写入端明确拒绝，绝不删掉不认识的节点。数学作品使用文档与文件端口；作品源和引用扩展见[数学契约](math.md)。

## 自动收题与分类

createImport 先原子持久保存原稿绑定和 extraction Job，然后后台启动；原生读取与视觉提取自动产生 Draft，不直接建立 Question。input.pages 为空代表完整输入；否则给每个 fileId 明确页集合，不接受未列入原件的文件。一次 PDF/Word 与一次图片组不能混为一个输入；text 原文不可变。origin 是老师填写的出处文本或 URL，只保存不抓取。

未配置视觉识别器时，文字层 PDF 使用本机 Poppler 自动读取，复用题号拆分、明确答案匹配和单栏配图定位；扫描页与图片明确报告视觉识别未配置，不将手动补录算成自动完成。多栏、跨页续题及复杂数学排版仍需核对。DOCX 原生提取保留原文段落到任务记录；`GET imports/{id}` 可附带只读 `originalDocuments`，在没有分页预览时展示文字、公式和配图，并按段落定位。该视图不承诺 Word 的分页和排版；原始文件与已有分页预览保留。旧材料没有该字段时仍使用现有预览或下载。

任务输出必须验证 schema、输入覆盖、题边界、公式、实际配图绑定、原有答案角色和原稿定位，不能照抄 Provider 的 needs_review=false。草稿处置由老师控制；机器必须保留未分配片段与疑点。截断响应只采纳前缀中完整、独立可验证对象，记录 truncated-response，禁止补括号后声称整批成功。已有答案和未提供答案严格区分；识别不生成解答。

saveImportReview 全量原子保存当前草稿/片段数组，baseVersion 与 import 比较；running/queued/cancelling 时返回 import-not-editable，先停止或等终态。新草稿 ID 由客户端创建（拆分/手工补充），移除草稿即丢弃该候选，原件保留。已 confirmed 草稿及其 questionId 只读且不可遗漏；客户端不能把 pending 自改为 confirmed，也不能自填 questionId。commitImportDrafts 是唯一入库动作，验证选中草稿无 open 疑点、answerStatus 非 unresolved、正文与图片/公式齐全，在同一事务建立 Questions 并写映射/新 import version。acknowledged 仅用于非阻断的文字/边界复核；missing-figure、uncertain-formula、incomplete-answer、unverified-location 必须 corrected。忽略草稿不能提交。

相同 draftId 永远最多关联一个 Question，重复用新键提交已 confirmed 项也返回既有题映射，不增加题目/材料版本；混合提交时只为未确认项创建对象。这是业务去重，幂等仍遵循原键重放。失败整个选中批次不变。一次确认部分题后，其他草稿继续等待，材料不会因“部分入库”消失。

重试结束后新机器结果只补充候选，已有人工校对或已入库对象保持。重复机器片段按输入单元与原稿定位关联，不靠重复题号覆盖；老师合并/忽略重复候选。补充原稿操作只追加 fileIds，新照片不能替换旧原稿；该操作在材料终态时受理，为新增文件自动建立新的提取 Job、更新 import.jobId 并增加版本，已有候选保持。运行中补充返回 import-not-editable，先停止或等待。

QuestionTaxonomy/ResourceTaxonomy 是各模块内部一个版本化集合，不建立共享分类平台。老师创建的 term/folder ID 是稳定 UUID；名称服务端 trim 后非空，同类名称按 Unicode NFC + casefold 唯一（文件夹仅同父级唯一）。自动模型只可建议集合已有 ID，不能偷偷增改集合。改名保留 ID；删除项原子移除全部 active/deleted 对象关联并增加受影响对象版本，不更改引用快照。文件夹删除将直接资源/子文件夹移到删除前最近的保留祖先，避免循环；树深≤10。taxonomy 全量 PUT 中省略项表示删除，客户端先显示受影响数量；可由现有全量对象列表计算，不另建统计端口。题型单选、标签多选，查询 tagIds 为全部匹配，空查询等于不过滤。

## 引用和输出

### 课题顺序

当前备课 v3 列表遵循账户保存的课题顺序；尚未参与排序的新课题放在前面，按更新时间降序、ID 升序排列。v1/v2 列表保持原规则。正文编辑不改变已保存的课题顺序。

`GET /api/modules/lessons/v3/order` 返回 `{version, lessonIds}`，包括本账户已删除课题以便恢复原位；没有排序记录时版本为 0。`PUT` 提交 `{baseVersion, lessonIds}`，ID 数组必须恰好包含本账户全部课题且不重复，顺序版本冲突返回 409，缺项或外账户 ID 返回 422。成功仅增加顺序版本，不增加文稿版本。沿用真实身份、页面上下文、写保护和幂等键；未知结果必须用原键原请求确认。精确 schema 见 [v3 OpenAPI](math/math.openapi.json)。

列表与右侧“我的备课”的上下移操作交换相邻可见课题；搜索或已删除过滤不移除隐藏课题的排序记录。课题顺序由 lessons 模块独占的 `lesson_order` 保存。

### 材料与导出

材料 v2 引用为题目/资源两种封闭类型；当前备课 v3 另接受数学引用。题目/资源引用，均由服务器读取本账户当前源建立 snapshot。既有引用 ID/类型/源 ID/采用版本均不变时保存旧快照，不重新解析内容；源已删除仍可编辑备课和导出快照。改变采用版本必须是当前活动源的版本，否则 reference-version-conflict。引用不能换指另一个对象，需要新 ID。资源 snapshot 固定 fileId、补充预览 fileId、标题与原文件名，排除资源备注；题 snapshot 排除长期笔记、标签和标记。

所有新/更新引用校验与备课写入同一 SQLite 事务。每份备课所有环节 ID、引用 ID 全局唯一，总引用数≤1000；顺序以数组为准。环节删除/移动、本课材料投影及显式重复沿用 B11。使用位置由 lessons 公共查询提供，包含活动备课位置及采用版本，不让 questions/resources 读 lessons 表。

导出 POST 先检查 baseVersion，冻结该保存版本的完整服务端快照和选项，返回 ExportRecord + jobId。新源更新不影响已受理输出，snapshot 中文件持续保留。sectionIds 必须唯一且属于该备课；输出始终按备课顺序，不按请求乱序。materialReferenceIds 必须来自未安排集合，按其原顺序置末尾。练习只包含题引用；选中集合没有题返回 invalid-export-selection。生成后 listLessonExports 能找到全部历史输出及其保存版本；软删除备课仍可读取已有输出，恢复不重建。

精确组合规则归 [成果规则](../../features/lessons.md#u-m6-六种成果与手工-ppt)。输出器先构造经过选项过滤的内容树，再生成 DOCX/PDF；关闭选项的答案和注记不得留在 DOCX XML、注释、隐藏段落、PDF 文本或附件里。文件属性不写私人笔记。答案区在全文后按导出题号对应，同题显式重复则按各出现位置编号。讲义/练习的 answerSpaceLines 控制每题后的空白行，教案忽略此选项。

Word 输出是 DOCX；PDF 从同一过滤后内容和 DOCX 版式转换。页型 A4、正文可打印宽 170 mm、默认 20 mm 页边距；嵌入可分发中文字体或实测可用替代，公式/题图不跨页裁切，长题按段落继续并保留题号。环节和段落可自然分页，不强行每题一页。数学必需支持范围与目标编辑器证据见[输出验收](../../acceptance/mvp-matrix.md#office)。输出页数和布局在最终内容上校验，失败保留快照与原件，不能返回坏文件下载成功。

用于 PPT 的 question-asset Job 冻结题目版本。question-png 生成透明背景题面分片，includeAnswers=true 时答案另成分片，不含长期笔记；figure-png 必须给属于该快照的 figureFileId，其他模式该字段为 null。PNG 宽度 1600 px，按块分片且单片高度不超过 2400 px；超高单个图等比缩小，公式保持完整。outputFileIds 按显示顺序排列。文字/公式复制直接从 Document 读取，不新增服务端端口。

## 短任务与恢复

只为页预览、提取、导出和题面素材这些长操作保存 Job。单进程中顺序执行重操作，UI 轮询 GET（运行时 2 秒，离页停止）；不用消息队列、分布式锁或通用工作流平台。progress.completed/total 按实际页/阶段统计，未知 total=null，不编造百分比。Job.target 不携带账户，账户由服务端持有。

queued → running → succeeded/partial/failed；停止请求立即持久进入 cancelling，安全检查点后 cancelled；进程重启时遗留 running → interrupted，cancelling → cancelled。partial 表示已有成功内容及明确未完成单元，succeeded 仅表示机器处理完成，收题仍需老师校对。输入损坏或全部失败为 failed。已落盘结果逐单元检查后继续，不能靠内存状态认定成功。

retryJob 只接受 partial/failed/interrupted/cancelled；unitIds 为空选择未完成单元，非空必须是该任务 issues 的 unitId。文件单元为 file:<UUID>:page:<N>，文字为 text:<start>:<end>；预览整体失败单元为 file:<UUID>。不得重跑已成功的付费单元；需要重新识别成功页时由老师明确发起新的收录。重试生成新 Job 并指向 attemptOf，旧任务保持；questions 更新 import.jobId 并增加版本后继续，exports 的原 ExportRecord 保留原 Job，新导出请求冻结同一或新备课版本。

导出/素材失败用原入口和新键重新生成，retryJob 仅对 preview/extraction 开放，其他 kind 返回 job-not-retryable，避免一个 ExportRecord 指向多种含义。同键重放受理请求始终返回最初任务，之后 GET 当前状态。取消是持久停止意图；已终态则返回原终态，running 先返回 cancelling 并在安全检查点停止，最多保留已完成单元；外部调用迟到结果仅作为该任务证据保存，不重开任务。

本地可重复的转换不涉及新增模型费，恢复可重试；Provider 已发出而无可验证输出时标 provider-result-unknown，后台不自动追加请求。老师在产品中明确点击重试才启动新的受理，部署运维另核准预算。设计 session 不新调模型。R33 在运行接入任务授权下补真实自动提取门槛，不能用此故障分支永久回退为手工录入。

## 场景和端口映射

| BDD | UX | 主要操作/定义 | 写者 |
| --- | --- | --- | --- |
| WB-M001 至 M009 | U-M1、2、7 | uploadFile、createImport、saveImportReview、commitImportDrafts、Location、Job | R31 文件；R33 收录 |
| WB-M010 至 M012 | U-M3 | taxonomy、Question v2、copies、source-location | R33 |
| WB-M013 至 M017 | U-M4 | Resource、Preview、replaceResourceFile、supplement-preview | R31/R32 |
| WB-M018、M019 | U-M5 | Lesson v2、Reference、Usage | R34 |
| WB-M020 至 M023 | U-M6 | ExportInput/Record、Job、Document | R34 |
| WB-M024 | U-M6 | createQuestionAsset、Document | R33；R31 公共呈现 |
| WB-M025 至 M028 | U-M7、8 | B11 协议、File、Job、版本适配 | R31-R34 按模块；R34 集成 |

`materials.openapi.yaml` 的备课 v2 Reference 只接受 question/resource，仍拒绝 math 或任意 provider。当前备课使用已存在的 [lessons v3 数学引用契约](math.md)，通过相同 File、Document、Location 和[公共端口](../../arch/materials.md#公共端口)组合；v2 的拒绝与未知请求原路径确认继续有效，不能将 v3 的 math 字段直接发给 v2。
