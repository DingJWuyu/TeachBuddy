# 材料契约：文件、题目与资源

材料语义已采用，当前能力并非全部达标。精确 HTTP/数据定义在 [materials.openapi.yaml](../../apps/api/src/contracts/materials.openapi.yaml)，交换正反例在[案例](#材料交换用例)，技术接缝在[材料实现](#材料实现)。只处理题目保存时读内容、分类和共享保存；涉及文件才展开文件/任务；题面素材展开输出节。

## 共用规则与真实认证边界

[已冻结 B11](workbench.md)的可信 principal、同源 Cookie、保护头、Origin/Referer 完整校验、no-store、UUID、服务端 UTC、乐观版本、账户作用域幂等、软删除及未知结果语义原样沿用。本包未重新定义认证、登录/退出、会话过期或账户响应。当前真实身份和页面上下文沿[认证契约](auth.md)，历史 partial 认证说明不用于现有产品。

所有操作，包括文件字节、缩略图、裁图、预览、任务、补充原稿和引用读取，先经 `resolvePrincipal(request)`。无身份 401，本账户不存在或外账户对象统一 404。客户端不传 accountKey/accountId，不发任意下载 URL 给服务器拉取。真实认证已装配；可信 test-principal 只用于隔离测试，不能被产品 UI/请求参数启用，不能签真实认证 PASS。

JSON 写体上限沿用 2 MiB，文件上传例外为一个 multipart file、100 MiB；单材料最多 100 张图片或一个 PDF/Word，总页数最多 500。超过限制明确 413 或 422，原件若已经保存仍可下载；500 页不是一次 Provider 请求。未知字段及类型不转换，使用 B11 首错次序。资源/材料的标题须含非空白字符，空白标题返回422 invalid-input，按输入保存不自动改写；taxonomy名称的归一化另见分类节。JSON schema 后按归属、版本、对象状态、分类/位置/内容/引用顺序校验；引用依数组顺序。响应允许附加字段，不允许必填值缺失或未知状态当成功。

所有写请求都带 Idempotency-Key；202 仅原子保存任务与初始业务记录，不表示任务完成。幂等成功记录跨重启保留，失败不消耗键。上传按文件名、检测 MIME、SHA-256 绑定请求，multipart 分隔符不参与指纹；同键异字节 409。客户端超时/5xx/无效结果先用同键同请求确认，用户后续输入单存草稿。已知 4xx 修正后新键。Provider 请求的未知结果与浏览器写入未知结果不同，前者不自动再次付费，见任务节。

## B11 兼容与版本过渡

B11 的文件与冻结定义保持不变。题库丰富内容操作位于 `/api/modules/questions/v2`；资源使用自己的模块路径，文件和短任务是 workbench 基础能力。v2 与 B11 读写相同对象、ID、业务版本和幂等账本。路径属于幂等指纹，因此未知旧请求必须在原 B11 路径确认，不能换到 v2 重试。

v2 读取旧对象时，原 Document.version=1 原样返回；补充空分类、由旧 solution 是否为空确定 answerStatus。既有题目/来源/改编快照/笔记/时间/删除标记都保留。纯读取不写回、不增加版本。v2 写入时可以继续使用 Document v1，只有使用新节点的文档才写 v2，不全量重写旧文档。快照不被后续内容迁移偷偷替换。

旧 B11 操作在其可表示对象上继续满足原 schema；附加分类等元数据在旧请求未提供时保持。若旧客户端访问含 v2 文档或新来源的对象，服务器返回 B11 已有的 `422 invalid-input / unsupported-content-version`，不做有损投影。旧列表若匹配到不可表示对象，同样明确要求使用新版入口，不静默漏题；旧 UI 保留草稿并进入升级提示/只读路径。旧写入先重放已成功原请求，再检查当前版本，最后拒绝不可表示对象的覆盖。v2 全部对象可正常读取，故这是客户端协议升级，不是丢失数据。

B11 的 readForReference 端口继续供旧调用方使用，新增 `readForReferenceV2` 支持本批 Snapshot。旧副本来源中的 v1 快照维持 v1。题库拥有自身对象兼容，未知旧请求沿原路径确认。

静态模块目录只有一份。材料版历史协议定义 ModuleCatalog version=2；当前完整组合返回数学契约的 version=3。材料版 v2 的精确描述与依赖名在 materials.openapi.yaml；这是该目录操作的显式版本演进，B11 原定义保留为版本1历史冻结输入，不作为材料版运行响应的竞争定义。支持版本1的旧客户端遇到2必须保留草稿并提示重新加载，不用未知依赖继续装配。当前只注册真实实现并检查映射、缺依赖和环路。

## 文件与定位

文件是服务端托管的不可变字节，保存后 fileId 稳定；资源条目的 version 与文件 ID 不混同。相同字节可在同账户共用物理 blob，但不同新上传请求保留独立文件元数据/原文件名，返回 duplicateOfFileId 供 UI 提示，不自动合并资源或题目。跨账户不暴露重复命中。下载必须重新授权，不暴露磁盘路径、对象存储地址或永久公开链接。

上传完成条件是字节写盘、校验、持久元数据与成功记录均成立。浏览器“100% 已发送”不足以成立。转换失败不会撤销原件。文件名只作显示及安全下载名，检测内容格式；压缩炸弹、外部关系、宏与内嵌脚本不执行，解压和转换限额见架构。

PNG/JPEG/WebP/PDF 产生实际可读预览；DOCX/DOC/PPTX/PPT 经固定转换得到 PDF 与页图；HTML 与其他文件可保留下载，HTML 只作转义文本预览。Preview.state=ready 表示完整生成且通过页数/输出检查，limited 表示已有真实内容但风险或缺页未解决，failed 表示不可预览。DOC 永远附 legacy-object-loss 风险，不能用进程退出码消除此已知缺口。预览请求可异步，GET 不启动有副作用处理。

对同一不可变文件重复 requestFilePreview 时，复用已受理的当前预览 Job，返回202及该Job当前状态，不追加相同转换；失败后通过retryJob建立新尝试。已有页图在重试时仍可读，新的完整预览原子替换派生元数据，引用的固定rendition字节仍保留。limited的风险经同一路线重跑仍需保留，不因重试成功而抹去。

资源补充预览必须是本账户完整 PDF，其 fileId 与资源当前原件 fileId 共同提交；原件已替换时拒绝。老师查看全部页后使用该 PDF，保存为 resource.supplementPreviewFileId；资源版本增加。它不更改原文件，也不宣称恢复了旧 DOC 的可编辑公式。

定位规则：

- page：fileId 是原件；renditionFileId 是生成时固定的 PDF/图片，PDF 原件可与其相同。page 从 1 起；box 是按页面最终显示方向左上角为原点的归一化区域，必须 x+width≤1、y+height≤1。空 box 只表示整页级定位，不能作为精确裁图。图片 page=1。多图各自带 fileId，显示序号由输入顺序决定。
- text：start/end 按原文字 Unicode code point 计数，左闭右开，0≤start<end≤长度。不能用 UTF-16 code unit 误定位中文补充字符。
- docx：原 DOCX 或任务已持久保存的 DOC 转换稿中，`word/document.xml` 深度优先段落从 1 起，runStart/runEnd 是该段文字/公式/图 run 序列的左闭右开索引。正文、表格中的段落都计入。fileId 保持原件 ID；DOC 必须由服务端任务保存转换来源与原件/派生件摘要，不能由客户端自证。此结构位置不等于 Office 页码，有可靠固定 rendition 时同时存 page 定位。

LocatedPart 区分题面/答案/配图/未分配片段；跨页一题包含多个位置，分散答案另有位置。每个 file/rendition 必须来自该 import 原件或已保存补充原件的衍生链。修正题目位置只改关联定位，不能改来源 importId/draftId 或原始字节；复制来源固定，其原稿通过原题链读取，即使原题软删除仍在。

裁图只能使用本账户有效 page + 非空 box，服务器从 rendition 裁成 PNG 后返回 File。老师可换框生成新图，旧图若已有引用继续保留。正文图片只能引用已可读取的 PNG/JPEG/WebP，SVG 输入先受控栅格化；图像本身不被当成可编辑数学公式。

本批没有文件永久删除 API。原件、衍生页图、裁图、输出，以及软删除对象和幂等响应引用的文件都保留；无引用上传保留到后续明确清理流程。F62 备份需覆盖 DB 与文件目录。浏览器临时上传中断的残片可清理，持久业务对象不可被时间型 GC 误删。

## 题库归档与彻底删除

题库的可恢复移除在 UI 中称为归档；协议继续使用 `deletedAt`、`state=deleted` 和既有 `/deletion` 操作，保留旧客户端兼容。归档与恢复增加版本并保留同一 ID。

`POST /api/modules/questions/v2/items/{id}/purge` 与 `/imports/{id}/purge` 接收 `{baseVersion}` 和幂等键，返回 `{id, permanentlyDeleted: true}`。仅本账户已归档且无运行中关联任务的对象可彻底删除；活动对象返回 409 `archive-required`，运行中任务返回 409 `processing-in-progress`，版本过期返回 409，外账户或不存在返回 404。成功后读取、恢复和新键再次删除均返回 404；原键原请求仍返回原成功结果，包括重启后确认。

操作在原有业务写入事务中移除题目及其扩展元数据，或收录材料，同时移除相应题库处理数据。已入库题目不随材料删除；改编来源快照不随原题删除。原件、输出和快照引用的受管文件遵循本契约文件保留规则，不在此接口回收。已删除材料的处理任务不能重试生成材料。

## 资源归档与彻底删除

资源库 UI 将可恢复的 `deletedAt` 状态称为归档，继续使用 `POST /api/modules/resources/items/{id}/deletion` 和 `SetDeletion`，保持既有客户端兼容。归档、恢复均增加版本，原件和文件历史保持。

`POST /api/modules/resources/items/{id}/purge` 接收 `{baseVersion}` 与幂等键，仅允许彻底删除本账户已归档的资料条目，返回 `{id, permanentlyDeleted: true}`。活动资料返回 422 `invalid-input`（`/id`, `invalid-reference`），过期版本返回 409，外账户或不存在返回 404。删除后 GET、恢复及新键再次删除均返回 404；成功原键重放仍返回原成功结果，不能重新创建或恢复条目。受管文件生命周期不由此接口清理。

## 资源正文检索

`listResources` 的非空 `q` 同时匹配名称、原文件名、备注和当前文件可提取正文，返回 `ResourceList.search`。先应用账户、活动/归档、文件夹、标签和格式条件，再匹配关键词；结果排序保持原规则。`matches` 只包含本次返回且正文命中的资源 ID，值为第一处命中的 `page` 和纯文本 `excerpt`；纯文本的页码为 null。

原 PDF 和 UTF-8 纯文本可直接提取，Office 使用已有预览 PDF；有补充 PDF 时以补充文件为准。`resource_text_cache` 按账户与不可变文件 ID 保存派生文字；每次检索重新解析资料当前文件，替换与历史恢复无需修改旧缓存。缓存可重建，不作为个人资料包的用户成果；实例备份可保留缓存。GET 计算派生缓存不改变资源版本、文件或预览任务。

每次查询最多提取一份未缓存文件，`pending` 表示尚待读取或预览仍在运行的资料数；调用方继续同一查询直到为零。`unavailable` 表示没有可提取正文或没有可用的 PDF 预览，`failed` 表示文字/文件读取失败，均不阻断其他匹配。`POST /api/modules/resources/search/retry` 接收 Empty 与幂等键，仅清除本账户失败缓存，下次查询重读；成功原键重放不再次清除。

PDF 文字复用隔离转换器中的 Poppler `pdftotext`，不重复生成页图，也不依赖 Office 路径。文字输出至多 8 MiB、500 页、提取进程至多 12 秒；超过限制记读取失败，原件和既有预览保留。图像与无文字扫描件不做 OCR。前端复制使用本地部署的 PDF.js TextLayer 与同身份授权下载，仅作为资源预览的文字层。

## 资源批量整理与文件历史

`POST /api/modules/resources/items/organize` 接收 `OrganizeResources`，每批 1 至 100 个唯一 `{id, baseVersion}`，操作为移动、追加标签、归档或恢复。所有对象归属、状态和版本在同一幂等事务内校验；任一对象失败则整个批次不写入。成功返回 `ResourceList`，每个对象增加版本；移动仅改变文件夹，追加标签取原标签并集。外账户 404、过期版本 409、重复 ID 或无效分类 422。响应丢失后用原键原请求确认。

`GET /api/modules/resources/items?sha256=<64位小写摘要>` 按当前原件摘要查重，继续遵循活动/归档查询与账户隔离；不自动合并条目。不可读取的文件不会阻断其他资料的名称、备注与格式检索。

`resource_file_history` 属于资源模块，主键为账户、资料 ID 和保存版本。新建、替换原件、采用或移除补充预览、恢复历史文件时保存原件及补充预览身份；备注、标签、分类与归档不新增文件历史。迁移仅记录当时的当前文件，不能还原启用前的历史。

`GET /api/modules/resources/items/{id}/history` 返回倒序 `ResourceFileHistory`，含文件元数据；单个历史原件损坏时保留记录并标记 `unavailable`。`POST /api/modules/resources/items/{id}/restore-file` 接收 `{baseVersion, fileVersion}` 与幂等键，仅允许本账户活动资料采用自身历史文件。校验原件和补充预览可读后，保持资料身份及元数据，以新的资料版本保存并追加文件历史。外账户/不存在 404、版本过期 409、未知历史版本 422。恢复操作可按原键重放，不重复追加历史。

彻底删除条目时同时移除其历史记录，文件字节仍遵循文件保留规则。个人资料包包含 `resource-file-revision` 对象；实例备份包含历史表，并检查其中引用的文件归属与可达性。

## 内容

Document 是 B11 v1 或本批 v2 的封闭联合。v2 增加图片、标题、选项/小问列表、表格、教师注记；没有任意 HTML/attrs。列表 item 有显示 label 和有序块，可独立增删排序；表格各行列数相同，不支持合并单元格，复杂原稿表格可保留原图供局部校对。题干的实际内容无需先选题型。

文字与 LaTeX 是规范源，OMML 是导出制品，不新增第二套可写数学主数据。公共转换须支持分式、根式、上下标、函数/对数、不等号、区间、绝对值及两行 cases；分段条件保持逐行对应。源码白名单数学语法，不运行 TeX 的文件/网络/宏指令。存储允许未知数学表达的原始源，编辑器显示失败；导出前若不能形成真实可编辑 OMML，返回带 field 的 unsupported-formula，用户修正后重新导出。不能把整题/公式截图作为 Word 成功路径。验证须覆盖一般公式源到 OMML 的路径，固定硬编码节点不能证明公共转换可用。

Document 每层数组及源字符串上限由 schema 给出，另外总块数≤2000、总数学源≤200000 字符；不得无限递归。正文至少有一项可见文字/公式/图片。answerStatus=absent 时 solution 必须空；present 时 solution 非空。unresolved 仅存在收录草稿，不可入库。题面和答案不得夹带 teacher-note，手写长期笔记在 `note`，归入的资料摘录在 `noteFragments`。旧 v1 文档仍按 B11 规则处理。

内容演进只追加明确版本及迁移，不借存储 JSON 跳过校验。未知 Document.version 在读取端保留原数据并提示只读，在写入端明确拒绝，绝不删掉不认识的节点。数学作品使用文档与文件端口；作品源和引用扩展见[数学契约](math.md)。

## 自动收题与分类

createImport 先原子持久保存原稿绑定和 extraction Job，然后后台启动；原生读取与视觉提取自动产生 Draft，不直接建立 Question。input.pages 为空代表完整输入；否则给每个 fileId 明确页集合，不接受未列入原件的文件。一次 PDF/Word 与一次图片组不能混为一个输入；text 原文不可变。origin 是老师填写的出处文本或 URL，只保存不抓取。

未配置视觉识别器时，文字层 PDF 使用本机 Xpdf 阅读顺序自动读取，支持常规双栏、题号拆分、明确答案匹配及显式续题，Poppler 继续提供页图与配图定位；扫描页与图片明确报告视觉识别未配置，不将手动补录算成自动完成。复杂跨栏图文、无明确标记的跨页续题及复杂数学排版仍需核对。DOCX 原生提取保留原文段落到任务记录；旧 DOC 在受限的 LibreOffice 进程内转换为 DOCX，再读取可用公式对象、文字和图片。任务固定派生文件、原件与派生件摘要、段落快照，重试复用该转换稿；个人资料包保留这些来源记录及文件。`GET imports/{id}` 可附带只读 `originalDocuments`；校对页可切换分页预览与段落，点击段落定位进入对应视图。DOC 显示“转换稿段落”，DOCX 显示“原文段落”，均不承诺 Word 分页和排版。原始文件与分页预览保留；旧 DOC 的对象风险仍标受限，原件缺失内容不补造。旧材料没有该字段时仍使用现有预览或下载。

原生文字无题号时，非空正文保留为待校对候选；仅答案或教师活动不建空题。题号比较使用 NFKC、去空白、去末尾分隔符与 `Q` 前缀，原文和字符范围不改变。独立“答案：”与“参考答案”标题均进入答案区；答案必须唯一匹配题目，重复题号保留答案片段并标记待核对，不按出现顺序猜测归属。

任务输出必须验证 schema、输入覆盖、题边界、公式、实际配图绑定、原有答案角色和原稿定位，不能照抄 Provider 的 needs_review=false。草稿处置由老师控制；机器必须保留未分配片段与疑点。截断响应只采纳前缀中完整、独立可验证对象，记录 truncated-response，禁止补括号后声称整批成功。已有答案和未提供答案严格区分；识别不生成解答。

未分配 Fragment 可带 `document`（沿用 Document 版本契约，机器稿为 v2），保留表格、数学与图片；`text` 是最多 20000 字符的阅读摘要，完整内容以该 Document 为准。旧纯文字片段继续按 `text` 读取。结构片段不按摘要长度拆成多个重复文稿，保存时沿用 Document 校验及当前账户的附件归属检查；个人资料包和部署备份保留其文稿与文件关系。教师明确归入题干或答案时追加原块及该片段的真实来源，未提供答案的草稿归入答案后设 `answerStatus=present`，原有待核对状态仍须解决；不自动推断所属题目，也不改原始机器结果。

归入笔记使用 Draft、Question、UpdateQuestion 的可选 `noteFragments`，每条保存原 Fragment 的 `id`、当前 `importId`、可编辑 `document` 与固定 `locations`。同一片段在同一收录中最多归入一个草稿笔记，原片段须标为 assigned；来源必须匹配已保存片段，不能伪造或将已经归入题干/答案的片段再次归入笔记。草稿移除摘录恢复待处理。入库时把采用稿存入题目已有扩展元数据，与原材料独立；彻底删除原材料后题目及摘录仍可读，资料包只省略失效的原稿链接，保留来源 ID、采用稿和附件。

普通题目更新只允许编辑既有摘录文稿或移除条目，不接受新增摘录 ID 或改变出处。题目更新与校对保存省略 `noteFragments` 时保留旧值，显式空数组才清空，confirmed 草稿仍不可更改。CreateQuestion、CopyQuestion 不接受该字段；复制改编的起点同时清空两类笔记。文稿版本与账户附件权限沿用 Document 校验，未知版本只读；个人资料包和部署备份包含摘录及图片。班级引用、改编快照和 PPT 素材不包含两类笔记。

saveImportReview 全量原子保存当前草稿/片段数组，baseVersion 与 import 比较；running/queued/cancelling 时返回 import-not-editable，先停止或等终态。新草稿 ID 由客户端创建（拆分/手工补充），移除草稿即丢弃该候选，原件保留。已 confirmed 草稿及其 questionId 只读且不可遗漏；客户端不能把 pending 自改为 confirmed，也不能自填 questionId。commitImportDrafts 是唯一入库动作，验证选中草稿无 open 疑点、answerStatus 非 unresolved、正文与图片/公式齐全，在同一事务建立 Questions 并写映射/新 import version。acknowledged 仅用于非阻断的文字/边界复核；missing-figure、uncertain-formula、incomplete-answer、unverified-location 必须 corrected。忽略草稿不能提交。

相同 draftId 永远最多关联一个 Question，重复用新键提交已 confirmed 项也返回既有题映射，不增加题目/材料版本；混合提交时只为未确认项创建对象。这是业务去重，幂等仍遵循原键重放。失败整个选中批次不变。一次确认部分题后，其他草稿继续等待，材料不会因“部分入库”消失。`listImports` 为每份材料返回只读 `jobState`；只有 succeeded 且没有 pending 草稿或 unassigned 片段才可收进已完成列表，其他状态保守留在继续收录。

重试结束后新机器结果只补充候选，已有人工校对或已入库对象保持。重复机器片段按输入单元与原稿定位关联，不靠重复题号覆盖；老师合并/忽略重复候选。补充原稿操作只追加 fileIds，新照片不能替换旧原稿；该操作在材料终态时受理，为新增文件自动建立新的提取 Job、更新 import.jobId 并增加版本，已有候选保持。运行中补充返回 import-not-editable，先停止或等待。

QuestionTaxonomy/ResourceTaxonomy 是各模块内部一个版本化集合，不建立共享分类平台。老师创建的 term/folder ID 是稳定 UUID；名称服务端 trim 后非空，同类名称按 Unicode NFC + casefold 唯一（文件夹仅同父级唯一）。自动模型只可建议集合已有 ID，不能偷偷增改集合。改名保留 ID；删除项原子移除全部 active/deleted 对象关联并增加受影响对象版本，不更改引用快照。文件夹删除将直接资源/子文件夹移到删除前最近的保留祖先，避免循环；树深≤10。taxonomy 全量 PUT 中省略项表示删除，客户端先显示受影响数量；可由现有全量对象列表计算，不另建统计端口。题型单选、标签多选，查询 tagIds 为全部匹配，空查询等于不过滤。

题库 `GET /api/modules/questions/v2/items` 的 `q` 默认搜索标题、题干（包括公式源）和长期笔记；显式 `searchAnswers=true` 时同时搜索答案与解析，省略或 `false` 均排除答案。该参数只接受单个布尔值，非法值或重复参数返回 422 `invalid-input`，字段为 `/query/searchAnswers`、原因 `invalid-type`。原始材料不参与题目搜索。

## 引用和输出

用于 PPT 的 question-asset Job 冻结题目版本。question-png 生成透明背景题面分片，includeAnswers=true 时答案另成分片，不含长期笔记；figure-png 必须给属于该快照的 figureFileId，其他模式该字段为 null。PNG 宽度 1600 px，文字与行内公式按段混排，保留选项、表格和配图顺序。分片优先使用块边界，长块按真实行边界拆分，单片高度不超过 2400 px；超高单个图等比缩小，公式保持完整。outputFileIds 按显示顺序排列。文字/公式复制直接从 Document 读取，不新增服务端端口。

## 短任务与恢复

只为页预览、提取、页识别和题面素材这些长操作保存 Job。单进程中顺序执行重操作，UI 轮询 GET（运行时 2 秒，离页停止）；不用消息队列、分布式锁或通用工作流平台。progress.completed/total 按实际页/阶段统计，未知 total=null，不编造百分比。Job.target 不携带账户，账户由服务端持有。

queued → running → succeeded/partial/failed；停止请求立即持久进入 cancelling，安全检查点后 cancelled；进程重启时遗留 running → interrupted，cancelling → cancelled。partial 表示已有成功内容及明确未完成单元，succeeded 仅表示机器处理完成，收题仍需老师校对。输入损坏或全部失败为 failed。已落盘结果逐单元检查后继续，不能靠内存状态认定成功。

retryJob 只接受 partial/failed/interrupted/cancelled；unitIds 为空选择未完成单元，非空必须是该任务 issues 的 unitId。文件提取单元为 file:<UUID>:page:<N>，文字为 text:<start>:<end>；预览整体失败单元为 file:<UUID>，共用页识别单元为 page:<N>。不得重跑已成功的付费单元；需要重新识别成功页时由老师明确发起新的收录。重试生成新 Job 并指向 attemptOf，旧任务保持；questions 更新 import.jobId 并增加版本后继续。

素材失败用原入口和新键重新生成，retryJob 仅对 preview/extraction/recognition 开放，其他 kind 返回 job-not-retryable。同键重放受理请求始终返回最初任务，之后 GET 当前状态。取消是持久停止意图；已终态则返回原终态，running 先返回 cancelling 并在安全检查点停止，最多保留已完成单元；外部调用迟到结果仅作为该任务证据保存，不重开任务。

本地可重复的转换不涉及新增模型费，恢复可重试；Provider 已发出而无可验证输出时标 provider-result-unknown，后台不自动追加请求。老师在产品中明确点击重试才启动新的受理，部署运维另核准预算。设计 session 不新调模型。R33 在运行接入任务授权下补真实自动提取门槛，不能用此故障分支永久回退为手工录入。

## 场景和端口映射

| BDD | UX | 主要操作/定义 | 写者 |
| --- | --- | --- | --- |
| WB-M001 至 M009 | U-M1、2、7 | uploadFile、createImport、saveImportReview、commitImportDrafts、Location、Job | R31 文件；R33 收录 |
| WB-M010 至 M012 | U-M3 | taxonomy、Question v2、copies、source-location | R33 |
| WB-M013 至 M017 | U-M4 | Resource、Preview、replaceResourceFile、supplement-preview | R31/R32 |
| WB-M024 | U-M6 | createQuestionAsset、Document | R33；R31 公共呈现 |
| WB-M025 至 M028 | U-M7、8 | B11 协议、File、Job、版本适配 | 各模块与共享底座 |


## 材料实现

### 选择与数据所有权

沿用 React/Vite、Express、better-sqlite3 单一后端及[静态模块目录](../adr/0001-use-a-single-static-module-catalog.md)。一个教师规模下顺序执行重转换即可；文件目录和 SQLite 一起备份。不建立上传服务、对象存储网关、通用内容平台、分类平台或队列平台。

材料历史协议使用 ModuleCatalog version=2；当前五模块组合使用数学 schema 的 version=3；questions/resources 无业务模块必需依赖。File/Document/Job 是启动底座，不注册为额外业务模块。只在实际实现集成后注册，Web/API从同一目录投影；旧目录版本客户端按契约升级保护，不另维护一份业务目录。

| Module | 独占数据与 Implementation | 消费者 |
| --- | --- | --- |
| workbench/files | 原件和衍生字节、文件元数据、受控下载、固定页预览与裁图、文件持久提交；本机 LibreOffice/Poppler 隔离调用 | questions/resources、math |
| workbench/content + shared/materials | 唯一 schema 的校验和受控 Document 呈现；Web 的公共文档编辑/阅读原语，v1/v2 兼容 | 题库、资源库、math |
| workbench/jobs | 最小持久任务记录、停止意图、重启 interrupted；只承载固定任务类型，不拥有业务草稿和成果选项 | 文件预览、questions 提取/PNG |
| questions | 题目、原始材料绑定、拆题草稿/片段、局部校对、题型/标签、复制来源、提取 Adapter、题面 PNG | Agent、教学记录 |
| resources | 资源条目、当前文件/补充预览、文件夹/标签/备注、替换与恢复 | Agent |

自动提取的设计目标为“原生读取保存 + B 视觉辅助 + 结构/完整性校验 + 局部校对”。T/Word 先保留原生段落、OMML、图片关系；结构明确时本地自动拆题，通用文本整理失败时可将文本受控排版为页图走同一 B 路线，不能改成空题手填。PDF/扫描/图片按小批原页或区域提取，跨页续题可带相邻页上下文；答案页归并与题面分开。具体模型请求参数不进入公共 schema。R33 必须以真实输入证明这条完整路径，未通过项如实阻塞该实现能力。

当前 DOCX 生成走 `apps/api/src/workbench/files/pandoc.js` 的 Pandoc JSON → DOCX；公式由一般 LaTeX 源转换为可编辑 OMML。LibreOffice 负责 PDF 和 Office 预览，Poppler 负责页图/文本；实际工具与字体条件见[运行指南](../SETUP.md#文件转换工具)。旧 DOC 的公式对象丢失仍需受限状态及补充 PDF，原文件不变。目标 Office 实测和本地 XML 检查是不同证据。

### 公共端口

以下 Interface 固定跨写者调用形式；返回类型是唯一 OpenAPI 的 schema，不另建手写平行 DTO。Error 沿 B11 `{status, problem}`，无权统一 404。principal 必须由可信调用入口提供，不能由 Agent 参数自填。异步操作均在 SQL 事务外；同步读取用于同一事务的引用验证。

| Seam | Interface | 返回/原子性 |
| --- | --- | --- |
| 文件写入 | `files.store(principal, {name, mediaType, bytes}, mutation)`，mutation=`{key, method, path}` | Promise<File>；只处理本地字节，不接受 URL。内部完成持久提交/幂等；HTTP upload 也是此操作。 |
| 文件读取 | `files.read(principal, fileId)`；`files.open(principal, fileId)` | 前者同步 File；后者异步受控可读流。原件与衍生件同样授权，公开结果不含磁盘路径。 |
| 文件预览 | `files.preview(principal, fileId)`；`files.requestPreview(principal, fileId, mutation)` | 同步 Preview / Promise<Job>；前者无副作用，后者持久受理。 |
| 转换执行 | `files.ensurePreview(principal, fileId)` | Promise<Preview>，供已受理的本地任务执行；复用已完成衍生件，否则直接受控转换。HTTP preview Job、提取和导出共用，避免单执行器嵌套等待另一个排队 Job。 |
| 裁图 | `files.crop(principal, CropInput, mutation)` | Promise<File>；校验原稿链、页/框、创建持久 PNG。 |
| 内容校验 | `content.validate(principal, Document)` | 同步返回原 Document 或契约错误，校验文件归属/格式，不转换源；v1 保留。 |
| 公共 Web 阅读 | `DocumentView({value, onOpenFile})` | value 为 Document；按内容版本安全呈现，图片通过授权 fileId 获取。 |
| 公共 Web 编辑 | `DocumentEditor({value, onChange, readOnly, onOpenFile, onPickImage})` | onChange(Document)；onPickImage()返回Promise<File或null>，由调用方完成上传/选择，编辑器不让老师填写fileId。支持本批封闭节点、公式源和错误定位，保存由所属模块负责。 |
| 题目引用 | `questions.readForReferenceV2(principal, questionId)` | 同步 ReferenceReadQuestion，deletedAt 可非空，调用者事务中核对采用版本。 |
| 业务动作 | 各模块 `port.operations.<operationId>({principal, key, input, id, query})` | Promise<{status, body}>，input/查询来自对应 HTTP schema；读取省略 key，缺省 id/query 不传。与 HTTP 共用业务校验与 mutations，不再执行另一份 SQL。 |

Agent 及 M40 调用当前已定义操作，不需要 pi 专属类型。`files.store` 是 M40 保存其生成内容/静态产物的入口，content 接受材料版可表示的数学文档。作品制作状态和隔离 HTML 由[数学架构](../features/math.md#制作实现)定义。

组合工厂提供 `{db, mutations, files, content, jobs}`，业务模块只注入所需的公共端口，不读取其他模块的表。

Job 内部 Interface：`jobs.enqueue({principal, kind, target, input}, mutation)` 在调用方已有业务受理事务内同步返回 Job，不嵌套提交 mutations.execute；input 只能是 kind 对应的已验证业务请求/固定快照标识，存在模块自己的记录内，jobs 不存任意可执行指令。`jobs.get(principal,id)`、`jobs.cancel(principal,id,mutation)`、`jobs.retry(principal,id,RetryJob,mutation)` 对应 HTTP。组合入口以固定处理函数绑定执行器，handler 返回进度/文件 ID/JobIssue，业务输出写回各自 Module。固定绑定由组合入口装配；不做动态注册或发现。任务创建衍生文件使用持久保存的独立内部请求键，不复用用户已经确认的受理键；确保同任务重启后不重复产物。

跨模块的执行绑定固定为 `jobs.start({preview, extraction, recognition, 'question-asset'})`，服务器启动前调用一次，缺项以明确未接入的测试handler占位且禁止生产启动。每项具有 `run({principal, job, signal, reportProgress})`，返回Promise的 `{state, outputFileIds, issues}`，state仅succeeded/partial/failed，其他字段复用Job定义；signal为AbortSignal，reportProgress接收Job.progress并持久记录。停止状态由jobs裁决，迟到run结果不能把cancelled改成succeeded。preview/extraction/recognition 另提供同步 `retry({principal, job, unitIds, mutation}) -> Job`，在jobs.retry已开启的事务中调用enqueue并同步更新业务记录，question-asset 不接受 retry。模块工厂返回 `{router, port, jobHandlers}`，questions 提供 extraction 和 question-asset，files 提供 preview，共用识别提供 recognition；测试Adapter使用同样形状。各handler在报告成功前持久保存自己的输出，按jobId/输入单元保持重复执行不重复写入。

### 文件持久性、运行与恢复

文件写入走同一受管文件系统的 staging：写满、校验长度/摘要、fsync 文件后原子 rename 到最终随机/摘要路径并同步目录，最后提交 SQLite 元数据和幂等成功响应。DB 提交前崩溃最多留下未关联 blob，不能出现可读的悬空文件记录；启动核对已知未完成写入，保留已完成文件供同键确认。DB 提交失败时不返回 FileSaved。采用同账户去重时也校验已有 blob 实际存在和摘要。

磁盘操作与 DB 不假装同一个事务。跨文件的派生任务先落全部必要字节，再一次提交成果记录；失败文件不进入 outputFileIds。缺失/损坏已登记文件返回 storage-unavailable 并保留对象元数据，恢复文件前不声称可下载。暂存清理只限可证明未提交的本次临时字节，不删除无引用的正式用户上传或其他 session 文件。

每个重操作使用独立临时目录和 LibreOffice profile，参数走 argv，禁止 shell 拼接用户文件名。关闭转换器网络访问、宏、外部链接、宿主目录访问；子进程非特权，只挂输入只读/输出可写。默认上限：100 MiB 原件、500 页、压缩展开 512 MiB、单页 40M 像素、单转换 120 秒；超限或退出保留原稿和明确错误。图片解码与 DOCX/PPTX 解压同样受限。临时转换成功后清理，失败保留诊断摘要及必要输入引用，不记录 Cookie/密钥或模型 reasoning 到产品日志。

重启先验证 DB 迁移/文件配置，再处理 jobs；queued 可执行，running 标 interrupted，不重发未知 Provider 请求。提取每页/区域的结果与完成状态一起持久提交，重试不从零覆盖校对。task 的成功输出与业务结果一致后才 succeeded。输出及原稿均纳入[部署备份](../features/data.md#部署备份与还原)，恢复须验证真实字节可达，临时文件清理不承担恢复语义。

### 材料迁移

模块迁移沿用 B11 `migrations/index.js` 的有序 `{id, up(db)}` 和 ledger。新 ID 分别为 `materials_files_*`、`materials_jobs_*`、`questions_materials_*`、`resources_*`，既有迁移不重写。每个 worker 独立 DB/文件目录；组合验证使用独立集成库。

迁移验证固定旧库来源版本及运行入口，公共语义冲突按本契约处理。空库、B16 旧库、重复启动迁移都验证，旧数据/账户/布局与 B11 未确认请求保留。题库验证旧题目 v2 读取/编辑和旧客户端保护，不迁移认证内部表。

## 材料交换用例

这些是设计用例，不能标为产品运行 PASS。精确请求、响应和文件格式由 [OpenAPI](../../apps/api/src/contracts/materials.openapi.yaml) 的 schemas、paths、examples 唯一拥有；本节定义交换顺序与断言，语义沿本页前述约定。

### 起点与替身

每个用例单独从 R31 隔离 runner reset。建立可信身份 A/B、不同 Cookie jar，使用同源 HTTPS；写入按 B11 带来源/保护头及新的 UUID 幂等键。用户对象与文件 ID 使用真实响应替换示例 ID，分类/草稿的客户端 ID 保持稳定；示例 File 的100字节和摘要只是协议值，真实文件上传按实际字节返回，不伪造该摘要。

前端使用同版 examples 驱动替身：请求先按对应 requestBody 校验，再按以下序列返回结果和延迟/失败；不能只根据按钮名返回成功。后端测试直接调用相同 HTTP 操作并独立断言预期数据，不能以实现生成的快照作为唯一预期。成功/失败之后 GET 验证状态，所有 mutation failure 检查无部分变更。

原件来源按[实验裁决](../acceptance/mvp-matrix.md)定位 C21 与 C22 固定提交。T/W/P/I/PS 自动拆题用 C21 原件；C22 学生练习是答案泄漏反例，不能作为“无答案”的期望。E 全原件只在保留工作区读取，不复制到本仓库。机器原始结果、校对结果和最终题目分别保存证据。

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
