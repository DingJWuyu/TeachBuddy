# 材料契约：文件、题目与资源

修改文件、材料、资源或题目丰富内容的交换保证时读本页；协议/兼容保证变化时同步。定义存在不代表当前能力全部达标。精确 HTTP/数据定义在 [materials.openapi.yaml](../../apps/api/src/contracts/materials.openapi.yaml)，交换正反例在[案例](../acceptance/materials-cases.md)，技术接缝在[材料实现](../subsystems/foundation.md#文件文稿与任务)。只处理题目保存时读内容、分类和共享保存；涉及文件才展开文件/任务；题面素材展开输出节。

## 共用规则与真实认证边界

[已冻结 B11](workbench.md)的可信 principal、同源 Cookie、保护头、Origin/Referer 完整校验、no-store、UUID、服务端 UTC、乐观版本、账户作用域幂等、软删除及未知结果语义原样沿用。本包未重新定义认证、登录/退出、会话过期或账户响应。当前真实身份和页面上下文沿[认证契约](auth.md)，历史 partial 认证说明不用于现有产品。

所有操作，包括文件字节、缩略图、裁图、预览、任务、补充原稿和引用读取，先经 `resolvePrincipal(request)`。无身份 401，本账户不存在或外账户对象统一 404。客户端不传 accountKey/accountId，不发任意下载 URL 给服务器拉取。真实认证已装配；可信 test-principal 只用于隔离测试，不能被产品 UI/请求参数启用，不能签真实认证 PASS。

JSON 写体上限沿用 2 MiB，文件上传例外为一个 multipart file、100 MiB；单材料最多 100 张图片或一个 PDF/Word，总页数最多 500。超过限制明确 413 或 422，原件若已经保存仍可下载；500 页不是一次 Provider 请求。未知字段及类型不转换，使用 B11 首错次序。资源/材料的标题须含非空白字符，空白标题返回422 invalid-input，按输入保存不自动改写；taxonomy名称的归一化另见分类节。JSON schema 后按归属、版本、对象状态、分类/位置/内容/引用顺序校验；引用依数组顺序。响应允许附加字段，不允许必填值缺失或未知状态当成功。

所有写请求都带 Idempotency-Key；202 仅原子保存任务与初始业务记录，不表示任务完成。幂等成功记录跨重启保留，失败不消耗键。上传按文件名、检测 MIME、SHA-256 绑定请求，multipart 分隔符不参与指纹；同键异字节 409。客户端超时/5xx/无效结果先用同键同请求确认，用户后续输入单存草稿。已知 4xx 修正后新键。Provider 请求的未知结果与浏览器写入未知结果不同，前者不自动再次付费，见任务节。

## B11 兼容与版本过渡

B11 的文件与冻结定义保持不变。题库丰富内容操作位于 `/api/modules/questions/v2`；资源使用自己的模块路径，文件和短任务是 workbench 基础能力。v2 与 B11 读写相同对象、ID、业务版本和幂等账本。路径属于幂等指纹，因此未知旧请求必须在原 B11 路径确认，不能换到 v2 重试。

v2 读取旧对象时，原 Document.version=1 原样返回；补充空分类、由旧 solution 是否为空确定 answerStatus。既有题目/来源/改编快照/笔记/时间/删除标记都保留。纯读取不写回、不增加版本。v2 写入时可以继续使用 Document v1，只有使用新节点的文档才写 v2，不全量重写旧文档。快照不被后续内容迁移偷偷替换。

旧 B11 操作在其可表示对象上继续满足原 schema；附加分类等元数据在旧请求未提供时保持。若旧客户端访问含 v2 文档或新来源的对象，服务器返回 B11 已有的 `422 invalid-input / unsupported-content-version`，不做有损投影。旧列表若匹配到不可表示对象，同样明确要求使用新版入口，不静默漏题；旧 UI 保留草稿并进入升级提示/只读路径。旧写入先重放已成功原请求，再检查当前版本，最后拒绝不可表示对象的覆盖。v2 全部对象可正常读取，故这是客户端协议升级，不是丢失数据。

旧副本来源中的 v1 快照维持 v1。题库拥有自身对象兼容，未知旧请求沿原路径确认。

静态模块目录只有一份。材料版历史协议定义 ModuleCatalog version=2；当前完整组合返回 ModuleCatalogV4（version=4）。材料版 v2 的精确描述与依赖名在 materials.openapi.yaml；这是该目录操作的显式版本演进，B11 原定义保留为版本1历史冻结输入，不作为材料版运行响应的竞争定义。支持版本1的旧客户端遇到2必须保留草稿并提示重新加载，不用未知依赖继续装配。当前只注册真实实现并检查映射、缺依赖和环路。

## 文件与定位

文件是服务端托管的不可变字节，保存后 fileId 稳定；资源条目的 version 与文件 ID 不混同。相同字节可在同账户共用物理 blob，但不同新上传请求保留独立文件元数据/原文件名，返回 duplicateOfFileId 供 UI 提示，不自动合并资源或题目。跨账户不暴露重复命中。下载必须重新授权，不暴露磁盘路径、对象存储地址或永久公开链接。

上传完成条件是字节写盘、校验、持久元数据与成功记录均成立。浏览器“100% 已发送”不足以成立。转换失败不会撤销原件。文件名只作显示及安全下载名，检测内容格式；压缩炸弹、外部关系、宏与内嵌脚本不执行，解压和转换限额见[文件执行边界](#文件持久提交与执行边界)。

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

普通题目更新只允许编辑既有摘录文稿或移除条目，不接受新增摘录 ID 或改变出处。题目更新与校对保存省略 `noteFragments` 时保留旧值，显式空数组才清空，confirmed 草稿仍不可更改。CreateQuestion、CopyQuestion 不接受该字段；复制改编的起点同时清空两类笔记。文稿版本与账户附件权限沿用 Document 校验，未知版本只读；个人资料包和部署备份包含摘录及图片。改编快照和 PPT 素材不包含两类笔记。

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

## 文件持久提交与执行边界


文件写入走同一受管文件系统的 staging：写满、校验长度/摘要、fsync 文件后原子 rename 到最终随机/摘要路径并同步目录，最后提交 SQLite 元数据和幂等成功响应。DB 提交前崩溃最多留下未关联 blob，不能出现可读的悬空文件记录；启动核对已知未完成写入，保留已完成文件供同键确认。DB 提交失败时不返回 FileSaved。采用同账户去重时也校验已有 blob 实际存在和摘要。

磁盘操作与 DB 不假装同一个事务。跨文件的派生任务先落全部必要字节，再一次提交成果记录；失败文件不进入 outputFileIds。缺失/损坏已登记文件返回 storage-unavailable 并保留对象元数据，恢复文件前不声称可下载。暂存清理只限可证明未提交的本次临时字节，不删除无引用的正式用户上传或其他 session 文件。

每个重操作使用独立临时目录和 LibreOffice profile，参数走 argv，禁止 shell 拼接用户文件名。关闭转换器网络访问、宏、外部链接、宿主目录访问；子进程非特权，只挂输入只读/输出可写。默认上限：100 MiB 原件、500 页、压缩展开 512 MiB、单页 40M 像素、单转换 120 秒；超限或退出保留原稿和明确错误。图片解码与 DOCX/PPTX 解压同样受限。临时转换成功后清理，失败保留诊断摘要及必要输入引用，不记录 Cookie/密钥或模型 reasoning 到产品日志。

重启先验证 DB 迁移/文件配置，再处理 jobs；queued 可执行，running 标 interrupted，不重发未知 Provider 请求。提取每页/区域的结果与完成状态一起持久提交，重试不从零覆盖校对。task 的成功输出与业务结果一致后才 succeeded。输出及原稿均纳入[部署备份](../features/data.md#部署备份与还原)，恢复须验证真实字节可达，临时文件清理不承担恢复语义。


技术端口与装配见[公共底座](../subsystems/foundation.md#公共端口)；材料迁移的源码归属见[材料迁移](../subsystems/foundation.md#材料迁移)。
