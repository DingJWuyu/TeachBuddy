# 数学作品契约

[OpenAPI](math/math.openapi.json) 定义字段与状态码，[样本](math/samples.json)提供具体值，[用例](math/cases.md)定义交换顺序。产品行为见 [范围](../../product/scope.md)与 [数学场景](../../product/math.feature)。

## 共同协议与身份

复用当前 [工作台身份/HTTP/重试](../workbench.md#身份与-http)和 [认证 1.0.0-rc.2](../auth.md)，源候选 `6f3003250d170b44e89f6ac9b0a74f91d658a357`，不退回材料文字中旧 partial 认证。所有本版受保护操作显式外引 PageContext；新增 math/lessons v3 由同一可信 principal 授权。File HTTP 属旧接缝的实现适配，同样通过当前认证 transport 附加页面头；其原 schema 不在此覆盖。

同源 Cookie、保护头、完整 Origin/Referer 校验、no-store、严格请求/宽容响应、UUID、服务端 UTC、账户隔离、2 MiB JSON 限制、持久幂等与未知结果全部沿用 B11。写入顺序：来源保护 → 身份 → schema → 已成功同键重放 → 归属 → 版本 → 状态 → 业务约束 → 原子提交。JSON 未知字段/重复 query/类型转换拒绝。未提供有效页面绑定为401；外账户/不存在一律404；不能把未注册模块、隐藏导航或 client accountKey 当权限。禁止生产 test-principal，隔离验证须标身份模式。

每次有效新写包括同体保存、删除、恢复增加对象 version；导出只产生导出记录，不增加作品 version。幂等范围是账户+键，绑定方法/规范路径/请求内容；异步生成文件后再检查版本与事务提交。同键重放返回原结果，即使当前对象已更新/删除；未知结果必须回原路径确认。旧响应不覆盖新草稿或新账户。源码不可用/文件丢失为可恢复失败，不伪装404删除。

## 作品、源与制品

Work 是工坊唯一可写聚合，包含标题、Source、原始导入文件关联与软删除状态；它不是 Resource，不强迫生成第二份资源条目。版本是完整、不可变的 WorkRevision。每次写入保存新 revision，旧版本、旧源文件、输出文件和幂等结果长期保留，本版无永久删除。getWork 返回当前 tombstone，getWorkVersion/listWorkVersions 可读本账户历史；revision.createdAt 是该次提交时间，Work.createdAt 是首次建立时间。恢复保持 ID 并新增版本。

Source.schemaVersion=1 是编辑格式版本，与 Work.version 分开。kind 创建后不可变，另存可建立新 ID。未知格式必须保留原字节，客户端只读并提示升级；旧客户端不得损坏它。Formula/Plane/Space/Dynamic 是受控结构化源；HtmlSource.fileId 指不可变 HTML 字节。原始导入允许File检测为text/html，或以.html/.htm命名的text/plain/application/octet-stream；明确检测为PDF/Office/图片等格式则415。扩展名只表达导入意图，不授权执行；运行/编辑另验UTF-8和大小，损坏或不支持编码仍可保存取回。用 files.store 保存，createWork.originalFileId 必须与初始 source.fileId 相同；非 HTML 为 null。updateWork 不可改 originalFileId。HTML 修改先保存新 File，再提交其 ID；失败只留下可复用文件，不覆盖原件。copyWork 读取 baseVersion 对应的当前活动作品，复制源与原件指针，新 ID/version=1，随后两者独立编辑；复制版本不符为409。

保存 Source 先验结构、账户及引用关系，确定性渲染在 SQL 事务外完成。结构/引用无效拒绝422；公式或表达式语法错误、无效几何可保存原文，render.state=invalid 并给 reason，posterFileId及presentationFileId均为null；修正后重新保存。基础存储/渲染服务不可用则503，不能把基础故障记成用户源错误。有效原生源保存时生成初态 PNG poster，render=ready；服务端生成或复核，不接受客户端传海报/成功标志。Dynamic同时持久保存初态自包含隔离HTML为presentationFileId；公式/静态该字段为null。HTML为source-only、poster=null、reason=null，保存不运行其脚本；可运行大小/编码范围内只生成隔离包装字节为presentationFileId，超出范围则null并保留原件。标题为非空白，按原文保存。

rendererVersion 是服务端实际的渲染器发行标识，覆盖表达式求值、样式、字体和离线包装器；不可由客户端伪造。每版固定海报字节保留；旧结构化源升级只能另存新 revision，不自动重画旧备课快照。动态和HTML展示/导出使用该revision已保存的presentationFileId，不靠当前渲染器重新解释旧脚本；引用快照同样固定这份文件。备份须覆盖作品/版本/输出记录及 File 底座字节。

列表按 updatedAt 降序、id 升序；q 为 trim 后标题不区分大小写子串，kind 可选，state 默认 active。不搜索或执行 HTML/脚本。目录选择使用相同 list/get，不另建作品名字符串目录。

## 结构化数学源语义

唯一字段见 schema，下面是字段间的约束与数学定义。

- 二维坐标为数学坐标，x向右、y向上；viewport 的 min<max。显示按同一单位等比缩放并居中留白，SVG viewBox/PNG 使用保存的 width/height，不把圆拉成椭圆。对象数组顺序是绘制顺序，id 在整 scene 唯一。标签 dx/dy 为输出逻辑像素（右/下为正），缩放一同变换。text 为普通文字；允许 `{参数名}` 的数值插值，其他花括号文字原样显示，绝不解释 HTML。
- Expr 是十进制实数、`x`、已声明参数、`pi/e`，运算 `+ - * / ^`、括号，函数 `sin cos tan asin acos atan sqrt abs exp ln log10` 的封闭文法。无隐式乘法，弧度，幂右结合且高于一元负号，`-2^2=-4`、`2^3^2=512`。不支持赋值、属性访问、数组、脚本、网络或自定义函数。非曲线坐标不能使用 x；静态 scene 无参数。最多1000字符、200 AST节点、深度32；拒绝循环引用。实现用解析器，不能 eval/Function。
- 曲线在 domain 与视窗交集中取值。无定义/非有限点断开，极点附近不得连跨区直线；渐近线和高斜率需自适应细分，不能靠固定粗采样宣称数学正确。点/半径求值非有限、rx/ry≤0 为 invalid-geometry。函数局部无定义允许曲线有间断，整个窗口无有效点时 invalid-expression，源仍可保存。
- Space 采用正交投影：azimuth=A、elevation=E（度），`u=x*cos(A)-y*sin(A)`，`v=z*cos(E)-(x*sin(A)+y*cos(A))*sin(E)`，再按 viewport 映射。每条棱 from/to 必须是已存在且不同的点；遮挡用明确 dash 表示，不承诺自动消隐。三维点/棱 id 各自唯一，数值均有限。二维轮廓也可做圆柱等空间示意。
- Dynamic 可以没有参数，仅按步骤展示。参数 name 唯一，不得占用 x/pi/e/函数名；min<max，step>0，initial 在闭区间内且落在 min+n*step 网格上（相对容差1e-9）。max也必须落在同一网格，避免夹到非网格末值；每个拖动绑定存在的 point 和参数，至少绑定一轴，同点不能重复绑定，绑定轴坐标必须恰为对应参数名。指针/键盘值先取最近网格再限制范围；未绑定轴保持。
- 步骤 id 唯一，可选 description 保存最多2000字符的普通文字说明，预览与离线展示按原换行显示；visibleIds 唯一且存在，空集合用于仅文字讲解；每步 values 必须恰好给所有参数一次，各值合规。steps=[] 时 initialStepId=null，否则必须指其中一步。进入一步完整应用其 values/visibleIds；无步骤用所有对象和 initial 值。自由拖动只变当前步现场，重置恢复本步值。预览ready只证明保存初态及各步预设可渲染；探索值导致无定义时隐藏对应对象并显示“此取值下无定义”，不沿用旧坐标/旧公式冒充当前结果。不同步骤要用不同公式/曲线时使用不同对象和可见集合，避免曲线变了而顶点/解析式仍是另一状态。

结构关系（重复/缺失 ID、参数绑定、范围等）无效拒绝422 invalid-math-source；可保存的 invalid 只限数学源语法/求值/几何渲染失败。对象/参数之外不接纳任意 attrs，SVG只由可信渲染器输出；LaTeX 使用本地 MathJax 的受限数学包，不启用加载外部文件/宏扩展或 HTML 注入。说明与标签转义。曲线label锚定可见域最右侧的有限曲线点，再加dx/dy；点label锚定点；超出输出边界时扩大图形留白或移动标签，不裁掉文字。图形/公式不是外部 SVG 执行入口。

## 导出与 HTML 隔离

exportWork 固定明确 version，可导出本账户历史或已删作品版本，不要求最新；不存在版本404。HTML格式直接返回该revision固定presentation文件，无该文件时422 unsupported-export。后台只读该 revision，转换完成、File持久提交和导出回执持久化后才201。操作最多30秒、输出最多100 MiB、栅格总像素≤24M；超限422 unsupported-export，服务超时503 render-unavailable，同键同体确认。失败不修改作品。无需增加材料 Job.kind；确定性本地渲染不调用模型。下载沿 File 授权入口。

| 源类型 | 支持 format | 约束 |
| --- | --- | --- |
| formula | png、svg、source | PNG/SVG背景必须 transparent；source 为 UTF-8 JSON，含完整制作源/说明 |
| plane、space | png、svg、source | PNG/SVG可透明/白底；width 决定宽，按视窗比例给高；源码 JSON |
| dynamic | html、png、svg、source | PNG/SVG为保存初态；html 为全部源、可信渲染代码和依赖内联的隔离包装器 |
| html | html、source | source 原样返回当前 File 字节；html 为隔离包装器，原件下载通过 originalFileId |

source/html 的 background 固定 transparent、width 固定1600，避免无意义选项出现不同指纹；SVG的width影响视窗尺寸、不损失矢量。render=invalid 的版本只允许 source；HTML本就source-only，可导出html。原生html的 offline=self-contained 表示依赖均内联的构造属性，不表示全部数学结果/所有浏览器已验；外部HTML永远unverified，静态/source为not-applicable。包装器不得注入 Cookie、页面头、账户键、API地址、服务器fileId或本地路径；外部原源自己含有的URL或文字只作为用户原件保留，不替用户认证也不据此抓取；用于重建的 Source 仅包含作品数据（外部HTML直接内嵌字节，不嵌 fileId）。

外部原件及编辑文件是不可变源码资产，原文件下载必须 attachment + nosniff，通用材料预览仍仅转义文本。主动运行由 math 专用预览负责，禁止把 HTML/SVG 源塞进主应用 DOM。内嵌框只用 `sandbox="allow-scripts"`，不加 allow-same-origin/forms/popups/downloads/top-navigation；不传身份、工作台对象或公共写端口，不接收作品发来的业务 postMessage。源码编辑在父层纯文本控件。展示全屏由可信外层控制，不授予作品导航权限。

受控包装器把不可篡改的 CSP 放在任何作品内容之前；允许内联脚本/样式、data 图片/字体，default-src/connect-src/frame-src/object-src/worker-src/base-uri/form-action 均收紧为 none（img-src/font-src 仅 data，script-src/style-src 仅 unsafe-inline）。不允 eval、远程模块或外部资源。结构化解析后去掉 base、刷新跳转 meta、外链导航属性，仅改变运行副本；原始源不变。包装数据序列化必须防 `</script>` 提前闭合，文件名/标签也转义。

sandbox 隔离读取，CSP限制资源，不是完整恶意代码沙箱或可证明的全网络封锁：任意脚本仍可能自导航、耗尽CPU，字符串扫描不能证明无依赖。主应用不能依赖 sandbox 防全部出网；本版不授予网络能力，发生意外导航立即停止预览，保留源码。即使自导航也保留 sandbox，不能读取账户Cookie、父DOM/存储或持有 PageContext；不靠网络不可达保证身份安全。隔离边界须用恶意夹具验证，下载物的离线性须在禁网冷启动后验证。不能为让某HTML运行而放开同源/凭据或联网白名单。需要服务端/CDN/模块的HTML继续保留取回与源码编辑，显示预览受限。

UTF-8且≤1 MiB的HTML支持源码编辑/运行副本；更大或无法UTF-8解码的原件可保存/下载，尝试执行/编辑返回明确受限（source-too-large 413，编码不支持422 unsupported-export），不有损改码。母页面退出或账户代次改变销毁iframe及源码视图；预览异常可停止，不能宣称任意恶意无限循环都能无卡顿回收。

## 材料引用新版与备课返回

math provider 是业务模块提供方，非 LLM Provider。`readForReferenceV1` 返回当前活动或tombstone作品与服务器快照；新增或采用更新仍必须是当前活动版且 render!=invalid。快照保存 title、workVersion、Source、posterFileId、presentationFileId、rendererVersion，外部HTML固定该版fileId，文件一直保留。用户不得提交 snapshot。相同 referenceId/kind/workId/workVersion 保留旧快照；不允许既有引用改指对象，采用新版须显式改 workVersion。SourceState/latestVersion 只读派生，不改备课 version。

备课的封闭 Reference 联合在 v3 扩展；Question/Resource分支及File/Document/Location/Usage直接外引冻结schema，不改语义。全部v3备课读写、删除、导出和使用位置在 `/api/modules/lessons/v3`，同一ID、DB、版本和幂等账本。v3在事务中同步读三个提供方，快照与备课原子提交。全课引用≤1000、环节/引用ID唯一，顺序和材料未安排规则继承材料。使用位置查询先验证本账户源（含tombstone），仅活动备课，沿旧排序；旧查询kind仍只有question/resource。

旧v1/v2对不含math的可表示对象行为不变；遇含math的读/匹配列表返回422 invalid-input，reason=unsupported-content-version，不能漏条或去掉引用再写。旧写先重放原成功请求，再检查版本，再拒绝有损覆盖。旧路径未知请求必须留原路径确认。新版读取旧备课不增版本、不迁移旧快照。新引用/采用更新校验工作版本，math来源冲突返回新增409 `/problems/math/reference-version-conflict`，kind=math、id为workId、currentVersion为当前版本。旧question/resource冲突仍沿材料原类型，不向其封闭kind枚举偷偷加值。

ReturnTarget 是前端设备内协议，不是信任票据或新服务端会话：lessonId、sectionId（null=本课材料）、baseVersion、拟插入referenceId。完整备课草稿及焦点/滚动由 lessons 保存到账户分区现场，不放进URL/作品Source或Agent提示。math只返回已确认的 Work ID/version，lessons据原稿创建MathReferenceInput，再完整PUT v3。返回操作的幂等键属于备课，和作品保存键分开。目标冲突按UX对照，任何失败都保留已保存作品与原稿。没有跨两次保存的分布式事务。

v3教案/讲义输出复用材料 ExportInput/Record/Job 和过滤顺序：公式snapshot转换为现有Document数学节点，caption仅includeCaption=true时为普通内容；plane/space/dynamic用固定PNG初态，html仅标题和单独演示文件提示。本课引用note仍受includeTeacherNotes控制。practice仍只取题目，纯作品选择返回invalid-export-selection。输出前若固定资产缺失则明确失败，不自动取最新作品；HTML不交Office转换器执行。旧v2导出含math拒绝，旧已受理输出快照/文件不改。M43等待R35后接真，不把本设计作为Office已可用证据。

## 目录、公共端口与教学反馈

[产品结构](../../development/architecture.md)唯一规定 Interface 和写者。目录使用明确 version=3，以避免材料和教学时间各自的version=2被误认为同一全集。schema给封闭可用依赖，samples有材料+math子集及包含教学时间的组合目标；生产只注册实际接好的模块，按 questions/lessons/math/resources/classes/schedule 稳定顺序投影，依赖缺项/重复ID或path/环拒绝启动并在fixture返回422。math无必需业务依赖，lessons依赖math读取，classes可以依赖math教学链接；反向反馈仅前端组合，不制造math→classes服务端环。

数学作品与教学记录的关系见 [教学关联契约](../teaching-time-math.md)。

## 错误与恢复

除新增 MathProblem 外复用材料 Problem，HTTP状态与type固定对应；不能从title解析行为。field为JSON Pointer，reason只作定位说明。

| 条件 | HTTP / type | 结果与恢复 |
| --- | --- | --- |
| 无有效身份/页面；来源保护失败 | 401 unauthenticated / 403 request-not-allowed | 无变更，锁住账户现场/重新验证 |
| 不存在或外账户work/file/lesson | 404 not-found | 无泄漏，无变更 |
| 版本/来源版本过时；键异体 | 409 version-conflict / reference-version-conflict / idempotency-key-reused | 对照后新键；未知请求保持原键 |
| 已删对象普通修改 | 409 object-deleted | 恢复或保留原稿；允许读取/导出历史 |
| 不合法关系/参数/种类变化 | 422 invalid-math-source | field指向首次错误，整个提交无变更 |
| 未知Source版本 | 422 unsupported-work-version | 保留原源，升级消费者；读端只读 |
| invalid作品被引用 | 422 work-not-ready | 先修源并保存；HTML source-only可引用 |
| 格式不支持/超限/编码不支持 | 422 unsupported-export 或413 source-too-large | 原件与保存作品保持，选择可用格式 |
| 存储或生成临时故障 | 503 temporarily-unavailable / render-unavailable | 结果待确认，同键重试；不新增重复制品 |

基础错误仍沿 `/problems/workbench/`，材料业务错误沿 `/problems/materials/`；新增数学错误沿 `/problems/math/`，各状态的精确联合见schema。新增字段、列和结构只归本版schema，行为变更须新revision再冻结，不能让M41/M42临时猜补。
