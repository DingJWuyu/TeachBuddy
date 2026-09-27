# 数学契约：作品、源、版本与导出

数学设计已采用。字段唯一归 [math.openapi.json](math/math.openapi.json)，[cases](#数学交换用例)与[samples](math/samples.json)用于交换验证；制作行为见[工坊规格](../../features/math.md)，技术接缝见[数学架构](../../features/math.md#制作实现)。这些定义不声明所有目标环境已经通过。

## 共同协议与身份

复用当前 [工作台身份/HTTP/重试](../workbench.md#身份与-http)和 [认证 1.0.0-rc.2](../auth.md)，源候选 `6f3003250d170b44e89f6ac9b0a74f91d658a357`，不退回材料文字中旧 partial 认证。所有本版受保护操作显式外引 PageContext；新增 math/lessons v3 由同一可信 principal 授权。File HTTP 属旧接缝的实现适配，同样通过当前认证 transport 附加页面头；其原 schema 不在此覆盖。

同源 Cookie、保护头、完整 Origin/Referer 校验、no-store、严格请求/宽容响应、UUID、服务端 UTC、账户隔离、2 MiB JSON 限制、持久幂等与未知结果全部沿用 B11。写入顺序：来源保护 → 身份 → schema → 已成功同键重放 → 归属 → 版本 → 状态 → 业务约束 → 原子提交。JSON 未知字段/重复 query/类型转换拒绝。未提供有效页面绑定为401；外账户/不存在一律404；不能把未注册模块、隐藏导航或 client accountKey 当权限。禁止生产 test-principal，隔离验证须标身份模式。

每次有效新写包括同体保存、归档、恢复增加对象 version；导出只产生导出记录，不增加作品 version。幂等范围是账户+键，绑定方法/规范路径/请求内容；异步生成文件后再检查版本与事务提交。同键重放返回原结果，即使当前对象已更新/删除；未知结果必须回原路径确认。旧响应不覆盖新草稿或新账户。源码不可用/文件丢失为可恢复失败，不伪装404删除。

## 作品、源与制品

Work 是工坊唯一可写聚合，包含标题、Source、原始导入文件关联与归档状态；它不是 Resource，不强迫生成第二份资源条目。版本是完整、不可变的 WorkRevision。保存、归档和恢复写入新 revision。归档沿用 `deletedAt`、`state=deleted` 和 `/deletion`，保持既有请求可确认。getWork 返回当前 tombstone，getWorkVersion/listWorkVersions 可读本账户历史；revision.createdAt 是该次提交时间，Work.createdAt 是首次建立时间。恢复保持 ID 并新增版本。

`POST /api/modules/math/v1/works/{id}/purge` 接收 `baseVersion`，仅允许本账户已归档作品；活动作品返回422 invalid-input，旧版本409，外账户或不存在404。在同一幂等事务中移除 Work、全部 WorkRevision 和作品导出记录，返回 `{id, permanentlyDeleted:true}`。成功后读取、恢复和新的导出请求均404；原成功请求仍可按原键确认，不重新建立作品。既有备课快照、教学关联与共享不可变 File 保留，彻底删除不是账户文件的物理清理；引用方将不存在的源视为 deleted，仍可保存本课备注与下载采用版本的文件。

Source.schemaVersion=1 是编辑格式版本，与 Work.version 分开。kind 创建后不可变，另存可建立新 ID。未知格式必须保留原字节，客户端只读并提示升级；旧客户端不得损坏它。Formula/Plane/Space/Dynamic 是受控结构化源；HtmlSource.fileId 指不可变 HTML 字节。原始导入允许File检测为text/html，或以.html/.htm命名的text/plain/application/octet-stream；明确检测为PDF/Office/图片等格式则415。扩展名只表达导入意图，不授权执行；运行/编辑另验UTF-8和大小，损坏或不支持编码仍可保存取回。用 files.store 保存，createWork.originalFileId 必须与初始 source.fileId 相同；非 HTML 为 null。updateWork 不可改 originalFileId。HTML 修改先保存新 File，再提交其 ID；失败只留下可复用文件，不覆盖原件。copyWork 读取 baseVersion 对应的当前活动作品，复制源与原件指针，新 ID/version=1，随后两者独立编辑；复制版本不符为409。

保存 Source 先验结构、账户及引用关系，确定性渲染在 SQL 事务外完成。结构/引用无效拒绝422；公式或表达式语法错误、无效几何可保存原文，render.state=invalid 并给 reason，posterFileId及presentationFileId均为null；修正后重新保存。基础存储/渲染服务不可用则503，不能把基础故障记成用户源错误。有效原生源保存时生成初态 PNG poster，render=ready；服务端生成或复核，不接受客户端传海报/成功标志。Dynamic同时持久保存初态自包含隔离HTML为presentationFileId；公式/静态该字段为null。HTML为source-only、poster=null、reason=null，保存不运行其脚本；可运行大小/编码范围内只生成隔离包装字节为presentationFileId，超出范围则null并保留原件。标题为非空白，按原文保存。

rendererVersion 是服务端实际的渲染器发行标识，覆盖表达式求值、样式、字体和离线包装器；不可由客户端伪造。每版固定海报字节保留；旧结构化源升级只能另存新 revision，不自动重画旧备课快照。动态和HTML展示/导出使用该revision已保存的presentationFileId，不靠当前渲染器重新解释旧脚本；引用快照同样固定这份文件。备份须覆盖作品/版本/输出记录及 File 底座字节。

列表按 updatedAt 降序、id 升序；q 为 trim 后标题不区分大小写子串，kind 可选，state 默认 active。不搜索或执行 HTML/脚本。目录选择使用相同 list/get，不另建作品名字符串目录。

## 结构化数学源语义

唯一字段见 schema，下面是字段间的约束与数学定义。

- 二维坐标为数学坐标，x向右、y向上；viewport 的 min<max。显示按同一单位等比缩放并居中留白，SVG viewBox/PNG 使用保存的 width/height，不把圆拉成椭圆。对象数组顺序是绘制顺序，id 在整 scene 唯一。标签 dx/dy 为输出逻辑像素（右/下为正），缩放一同变换。text 为普通文字；允许 `{参数名}` 的数值插值，其他花括号文字原样显示，绝不解释 HTML。
- Expr 是十进制实数、`x`、已声明参数、`pi/e`，运算 `+ - * / ^`、括号，函数 `sin cos tan asin acos atan sqrt abs exp ln log10 log` 的受限实数文法；`log(x)` 为常用对数，`log(x,b)` 为指定底数。允许比较、链式比较、and/or 与 `条件 ? 值 : 值` 分段式，最终结果须为数值。支持数字/括号/变量的隐式乘法、Unicode 上标及 π、×、÷、−；弧度，幂右结合且高于一元负号，`-2^2=-4`、`2^3^2=512`。不支持赋值、属性访问、数组、脚本、网络或自定义函数。非曲线坐标不能使用 x；静态 scene 无参数。最多1000字符、200 AST节点、深度32；拒绝循环引用。Math.js 负责解析，节点白名单负责解释，不使用其任意求值/编译入口或 eval/Function。隐式乘法优先级沿 Math.js，含除法的歧义式应加括号；变量名完整匹配，不将 ax 擅自拆为 a*x；既有参数若与解析器关键词同名，先按声明转义，保留其参数含义。
- viewport.tickLabels 为可选开关，省略时不增加刻度文字，保留既有作品外观；新建画布默认开启并随 axes 显示；关闭不影响数学坐标。
- 曲线在 domain 与视窗交集中取值。无定义/非有限点断开，极点附近不得连跨区直线；渐近线和高斜率需自适应细分，不能靠固定粗采样宣称数学正确。点/半径求值非有限、rx/ry≤0 为 invalid-geometry。函数局部无定义允许曲线有间断，整个窗口无有效点时 invalid-expression，源仍可保存。
- Point/Line/Ellipse 可选 construction={kind,refs,branch?}，refs 指向同场景对象。类型、数量、唯一性及无环关系先校验；构造覆盖该对象的自由坐标，原坐标字段保留格式兼容但不参与计算。midpoint/segment/circle 依赖两点；projection/parallel/perpendicular 依赖点与线；intersection 依赖直线或圆，branch 为按 x、y 排序的第 0/1 个交点。退化关系、非圆椭圆或当前分支无交点为 invalid-geometry。动态先解析依赖，再按步骤可见集合绘图，隐藏的原对象仍可参与构造；探索退化时隐藏受影响对象并提示。
- Space 可选 faces=[{id,vertices,style}]、sections=[{id,plane:{a,b,c,d},style}]。面引用至少三个不同、共面且沿简单边界排列的点；截面定义为 ax+by+cz=d 与封闭凸多面体的交。每条面边须属于两个面，整体不得退化为平面；目前不处理非凸、多实体或曲面。引用错误拒绝422，几何退化允许保存并标记 invalid。省略新字段的旧线框保持原行为。
- Space 采用正交投影：azimuth=A、elevation=E（度），`u=x*cos(A)-y*sin(A)`，`v=z*cos(E)-(x*sin(A)+y*cos(A))*sin(E)`，再按 viewport 映射。edges 可为空，面自行绘制边界，无棱连接的点在导出中保留圆点。每条棱 from/to 必须是已存在且不同的点；遮挡用明确 dash 表示，不承诺自动消隐。三维点/棱 id 各自唯一，数值均有限。二维轮廓也可做圆柱等空间示意。
- Dynamic 可以没有参数，仅按步骤展示。参数 name 唯一，不得占用 x/pi/e/函数名；min<max，step>0，initial 在闭区间内且落在 min+n*step 网格上（相对容差1e-9）。max也必须落在同一网格，避免夹到非网格末值；每个拖动绑定存在的 point 和参数，至少绑定一轴，同点不能重复绑定，绑定轴坐标必须恰为对应参数名。指针/键盘值先取最近网格再限制范围；未绑定轴保持。
- Dynamic 可选 animation={parameter,seconds,mode}，参数须存在，单程 1 至 120 秒，mode 为 once/loop/bounce；省略时试演可往返播放第一个参数，8 秒单程。traceIds 为最多 10 个不同 point ID，可包含构造点；构造点不能加入 drags。播放与采样仅改演示现场，不自动写 Source；静态导出始终为保存初态。在线与离线共用暂停、重置、切步骤与轨迹规则。
- 步骤 id 唯一，可选 description 保存最多2000字符的普通文字说明，预览与离线展示按原换行显示；visibleIds 唯一且存在，空集合用于仅文字讲解；每步 values 必须恰好给所有参数一次，各值合规。steps=[] 时 initialStepId=null，否则必须指其中一步。进入一步完整应用其 values/visibleIds；无步骤用所有对象和 initial 值。自由拖动只变当前步现场，重置恢复本步值。预览ready只证明保存初态及各步预设可渲染；探索值导致无定义时隐藏对应对象并显示“此取值下无定义”，不沿用旧坐标/旧公式冒充当前结果。不同步骤要用不同公式/曲线时使用不同对象和可见集合，避免曲线变了而顶点/解析式仍是另一状态。

结构关系（重复/缺失 ID、参数绑定、范围等）无效拒绝422 invalid-math-source；可保存的 invalid 只限数学源语法/求值/几何渲染失败。对象/参数之外不接纳任意 attrs，SVG只由可信渲染器输出；LaTeX 使用本地 MathJax 的受限数学包，不启用加载外部文件/宏扩展或 HTML 注入。说明与标签转义。曲线label锚定可见域最右侧的有限曲线点，再加dx/dy；点label锚定点；超出输出边界时扩大图形留白或移动标签，不裁掉文字。图形/公式不是外部 SVG 执行入口。

## 导出与 HTML 隔离

exportWork 固定明确 version，可导出本账户历史或归档作品版本，不要求最新；不存在版本404。HTML格式直接返回该revision固定presentation文件，无该文件时422 unsupported-export。后台只读该 revision，转换完成、File持久提交和导出回执持久化后才201。操作最多30秒、输出最多100 MiB、栅格总像素≤24M；超限422 unsupported-export，服务超时503 render-unavailable，同键同体确认。失败不修改作品。无需增加材料 Job.kind；确定性本地渲染不调用模型。下载沿 File 授权入口。

| 源类型 | 支持 format | 约束 |
| --- | --- | --- |
| formula | png、svg、source | PNG/SVG背景必须 transparent；source 为 UTF-8 JSON，含完整制作源/说明 |
| plane、space | png、svg、source | PNG/SVG可透明/白底；width 决定宽，按视窗比例给高；源码 JSON |
| dynamic | html、png、svg、source | PNG/SVG为保存初态；html 为全部源、可信渲染代码和依赖内联的隔离包装器 |
| html | html、source | source 原样返回当前 File 字节；html 为隔离包装器，原件下载通过 originalFileId |

source/html 的 background 固定 transparent、width 固定1600，避免无意义选项出现不同指纹；SVG的width影响视窗尺寸、不损失矢量。render=invalid 的版本只允许 source；HTML本就source-only，可导出html。原生html的 offline=self-contained 表示依赖均内联的构造属性，不表示全部数学结果/所有浏览器已验；外部HTML永远unverified，静态/source为not-applicable。包装器不得注入 Cookie、页面头、账户键、API地址、服务器fileId或本地路径；外部原源自己含有的URL或文字只作为用户原件保留，不替用户认证也不据此抓取；用于重建的 Source 仅包含作品数据（外部HTML直接内嵌字节，不嵌 fileId）。

外部原件及编辑文件是不可变源码资产，原文件下载必须 attachment + nosniff，通用材料预览仍仅转义文本。主动运行由 math 专用预览负责，禁止把 HTML/SVG 源塞进主应用 DOM。内嵌框只用 `sandbox="allow-scripts"`，不加 allow-same-origin/forms/popups/downloads/top-navigation；不传身份、工作台对象或公共写端口，不接收作品发来的业务 postMessage。源码编辑在父层纯文本控件。展示全屏由可信外层控制，不授予作品导航权限。

受控包装器把不可篡改的 CSP 放在任何作品内容之前；允许内联脚本/样式、data 图片/字体，default-src/connect-src/frame-src/object-src/worker-src/base-uri/form-action 均收紧为 none（img-src/font-src 仅 data，script-src/style-src 仅 unsafe-inline）。不允 eval、远程模块或外部资源。结构化解析后去掉 base、刷新跳转 meta、外链导航属性，仅改变运行副本；原始源不变。包装数据序列化必须防 `</script>` 提前闭合，文件名/标签也转义。

sandbox 隔离读取，CSP限制资源，不是完整恶意代码沙箱或可证明的全网络封锁：任意脚本仍可能自导航、耗尽CPU，字符串扫描不能证明无依赖。主应用不能依赖 sandbox 防全部出网；本版不授予网络能力，发生意外导航立即停止预览，保留源码。即使自导航也保留 sandbox，不能读取账户Cookie、父DOM/存储或持有 PageContext；不靠网络不可达保证身份安全。M42 必须用恶意fixture验证这些读取/写入边界，M43真实禁网冷启动才证明下载物可离线。不能为让某HTML运行而放开同源/凭据或联网白名单。需要服务端/CDN/模块的HTML继续保留取回与源码编辑，显示预览受限。

UTF-8且≤1 MiB的HTML支持源码编辑/运行副本；更大或无法UTF-8解码的原件可保存/下载，尝试执行/编辑返回明确受限（source-too-large 413，编码不支持422 unsupported-export），不有损改码。母页面退出或账户代次改变销毁iframe及源码视图；预览异常可停止，不能宣称任意恶意无限循环都能无卡顿回收。

## 材料引用新版与备课返回

math provider 是业务模块提供方，非 LLM Provider。`readForReferenceV1` 返回当前活动或tombstone作品与服务器快照；新增或采用更新仍必须是当前活动版且 render!=invalid。快照保存 title、workVersion、Source、posterFileId、presentationFileId、rendererVersion，外部HTML固定该版fileId，文件一直保留。用户不得提交 snapshot。相同 referenceId/kind/workId/workVersion 保留旧快照；不允许既有引用改指对象，采用新版须显式改 workVersion。SourceState/latestVersion 只读派生，不改备课 version。

本包将 lesson 的封闭 Reference 联合扩为 v3；Question/Resource分支及File/Document/Location/Usage直接外引冻结schema，不改语义。全部v3备课读写、删除、导出和使用位置在 `/api/modules/lessons/v3`，同一ID、DB、版本和幂等账本。v3在事务中同步读三个提供方，快照与备课原子提交。全课引用≤1000、环节/引用ID唯一，顺序和材料未安排规则继承材料。使用位置查询先验证本账户源（含tombstone），仅活动备课，沿旧排序；旧查询kind仍只有question/resource。

旧v1/v2对不含math的可表示对象行为不变；遇含math的读/匹配列表返回422 invalid-input，reason=unsupported-content-version，不能漏条或去掉引用再写。旧写先重放原成功请求，再检查版本，再拒绝有损覆盖。旧路径未知请求必须留原路径确认。新版读取旧备课不增版本、不迁移旧快照。新引用/采用更新校验工作版本，math来源冲突返回新增409 `/problems/math/reference-version-conflict`，kind=math、id为workId、currentVersion为当前版本。旧question/resource冲突仍沿材料原类型，不向其封闭kind枚举偷偷加值。

ReturnTarget 是前端设备内协议，不是信任票据或新服务端会话：lessonId、sectionId（null=本课材料）、baseVersion、拟插入referenceId。完整备课草稿及焦点/滚动由 lessons 保存到账户分区现场，不放进URL/作品Source或Agent提示。math只返回已确认的 Work ID/version，lessons据原稿创建MathReferenceInput，再完整PUT v3。返回操作的幂等键属于备课，和作品保存键分开。目标冲突按UX对照，任何失败都保留已保存作品与原稿。没有跨两次保存的分布式事务。

v3教案/讲义输出复用材料 ExportInput/Record/Job 和过滤顺序：公式snapshot转换为现有Document数学节点，caption仅includeCaption=true时为普通内容；plane/space/dynamic用固定PNG初态，html仅标题和单独演示文件提示。本课引用note仍受includeTeacherNotes控制。practice仍只取题目，纯作品选择返回invalid-export-selection。输出前若固定资产缺失则明确失败，不自动取最新作品；HTML不交Office转换器执行。旧v2导出含math拒绝，旧已受理输出快照/文件不改。输出实现的已测范围与目标 Office 缺口见[能力证据](../../plans/run-state.md#证据边界)。

## 目录、公共端口与教学反馈

进程内协作见[公共端口](#公共端口)。目录使用明确 version=3，以避免材料和教学时间各自的version=2被误认为同一全集。schema给封闭可用依赖，samples有材料+math子集及包含教学时间的组合目标；生产只注册实际接好的模块，按 questions/lessons/math/resources/classes/schedule 稳定顺序投影，依赖缺项/重复ID或path/环拒绝启动并在fixture返回422。math无必需业务依赖，lessons依赖math读取，classes可以依赖math教学链接；反向反馈仅前端组合，不制造math→classes服务端环。

教学链接和 kind=math 分支由[教学记录 v2 契约](../teaching-time.md#数学作品关联)组合；固定 schema 输入与消费版本见该契约，不从其他分支取漂移输入。

## 公共端口

具体工厂和操作签名以 `apps/api/src/modules/math/index.js` 及 lessons/classes 的模块入口为准；DTO 使用本目录 schema。只读提供方同步投影已保存结果，供同一 SQLite 事务调用，不经 HTTP 回环或跨模块读表。

| 端口 | 唯一语义与消费者 |
| --- | --- |
| `math.port.operations` | 与 HTTP 相同的校验、版本、幂等和错误；手工与 Agent 共用 |
| `math.readForReferenceV1` | 本账户当前作品及 tombstone；不现场生成文件，invalid 仍可读，由引用方判断是否可新增引用；lessons 消费 |
| `math.readForTeachingLinkV1` | 作品 ID、版本、标题、删除态，不含源/文件；classes 消费 |
| `lessons.listUsagesV3` | question/resource/math 使用位置；原旧版端口保持兼容 |
| `classes.listSourceRecordsV2` | 教学记录列表，不借用备课 UsageList；由工坊的可选反馈容器消费 |

文件字节与重渲染在事务外准备，随后重新校验版本，在同一 mutations 事务保存 Work/Revision/成功回执。冲突留下的 File 按材料保留规则处理，用户原件不回滚。复用[材料端口](materials.md#公共端口)，导出采用有界本地任务，不新增通用工作流。

返回目标和备课草稿归 lessons，math 只返回已保存 ID/version；先保存作品再保存备课，分别报告结果。URL 不携带完整备课，也不新增跨模块事务表。

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

## 数学交换用例

与同提交 [schema](math/math.openapi.json)、[样本](math/samples.json)一起消费。样本 UUID 是隔离 fixture 标识，不是生产种子。前端替身按下表返回已定义结果；后端从公开 HTTP 用相同顺序断言，均不需要另一侧猜字段。替身只能记 self。

| ID / BDD | 输入、结果与双侧断言 |
| --- | --- |
| MC01 / WB-MA001、002 | POST create-formula →201 saved-work；PUT update-formula →200 version=2，原version=1仍可GET；render海报非空。源改为错误TeX仍保存且invalid，只能导出source。公式说明选入时图中有中文，分段式条件逐行正确。 |
| MC02 / WB-MA003、004 | create-plane/triangle/space 保存；改Q2常数-2，顶点(1,-3)、零点1±sqrt(3)；改三角形标注位置颜色；改AC1线型；重新读取源、PNG/SVG，不能只检查文件扩展名。 |
| MC03 / WB-MA005、006 | create-dynamic 保存，改a范围[-3,3]、步长0.5、步骤标题后PUT；重启重读相同源。每步visibleIds及完整values决定图/点/标签，回到初步保持初态；自由探索不发写请求。 |
| MC04 / WB-MA007、008 | 用C23实际M-X字节POST files，得到F1；create-html使用F1两字段。编辑标题及range得到F2，PUT仅source.fileId=F2；originalFileId仍F1，取回逐字相等。上传F2成功、PUT响应丢失，同键重试只得同一revision。 |
| MC05 / WB-MA009、010 | GET lesson v3基线3；ReturnTarget与备课草稿存设备账户分区；作品201后将math-reference-input加到原section。PUT return-lesson →version4，snapshot来自服务端；模拟断线重放同键仍version4且仅一个referenceId。作品请求键和备课键不同。 |
| MC06 / WB-MA011、012 | 源从1改2，读取adopted-reference仍version1 snapshot、latestVersion2；显式workVersion=2才更新。源删除后修改引用note仍可保存，新增同源引用拒绝object-deleted。另存并替换本处用新workId与新referenceId，其他课不变。 |
| MC07 / WB-MA013、014 | export-transparent 返回File及固定workVersion；用透明度/像素、SVG结构和外部PPT实际插入核验。export-html 原生offline=self-contained，外部unverified；UI对应措辞。全新Chrome配置禁网、关闭服务，双击真实下载物，键盘/拖动/步骤仍工作。 |
| MC08 / WB-MA016 | 两客户端读version1，A写得2，B以1写409 version-conflict；B源保持。A响应丢失时先同键确认，再GET当前版本，不因超时再建作品。同键异体409；服务重启仍可确认。 |
| MC09 / WB-MA017 | 未绑页面/过期Cookie401；错误Origin403先于业务；另账户读作品/历史/File/导出/引用统一404。身份切换销毁iframe、锁原草稿；迟到回包不显示到新账户。缺文件503，元数据保持。 |
| MC10 / WB-MA018 | teaching-input 新连活动作品，通过teaching-provider保存labelAtLink；改名后teaching-linked旧label保持、currentLabel更新；删除后已有链接显示deleted，新链接拒绝。反向列表由classes提供，工作版本不进入教学关联。此片为扩展fixture，真实接入等待教学时间新版与M44。 |
| MC11 / WB-MA019 | v3创建含math备课，v2 GET/列表/PUT/导出422 unsupported-content-version；先重放已成功旧请求。v3读取旧question/resource备课不写库、不变version。旧PDF已受理快照不改。 |
| MC12 / WB-MA020 | 在隔离测试中math缺提供方、目录重复ID/path或加入必需依赖环，拒绝装配；HTTP fixture 422 invalid-input，reason=invalid-reference或duplicate-id，field指向错误descriptor。材料+math与教学时间组合目录均检查。 |
| MC13 / WB-MA015 | 无模型直接经port调用list/get/create/update/export，结果同HTTP；传accountId或snapshot拒绝。Agent操作清单只暴露声明操作，不能访问SQL、磁盘路径、Cookie或执行HTML。真实模型制作归后续Agent验收，不由此用例代签。 |

### 结构与数学的反例

schema层反例在samples的valid=false中；业务层以下输入均可由合法样本单字段修改形成。前端定位同一字段，后端返回同一type；不能只靠JSON Schema通过。

| 变体 | 预期 |
| --- | --- |
| 参数name重复、min≥max、initial超界、step≤0、初值不在网格 | 422 invalid-math-source，field指第一个参数错误；原version不变 |
| steps少一个参数值、visibleIds缺对象、拖点绑定不对应坐标表达式 | 同上，分别定位steps/drags |
| view.xMin=xMax；edge引用不存在点；同source内重复element ID | 同上，不能部分保存 |
| 公式不闭合；expression为 `x+)`；椭圆rx为 `-1` | 结构合法，200保存且render=invalid/reason，poster=null；不可拿上次海报导出/引用 |
| `1/x` | x=0处断开，两支不跨原点连线；可保存ready |
| `sqrt(x)` | x<0不绘制，不生成NaN坐标；可保存ready |
| `-2^2`、`2^3^2`；负数系数/零系数 | 分别-4、512；标签和有限坐标正确，零系数不得继续称抛物线顶点 |
| source.kind在更新时改变 | 422 invalid-math-source；另建作品承载另一种源 |
| 原件F1属于另一账户或F2不存在 | 404，不透露文件存在性；作品无变化 |

### 隔离反例与结果核验

M42建立小型测试HTML，分别尝试读parent.document/document.cookie/localStorage、伪造postMessage写作品、form/fetch/WebSocket、远程script/img、window.open、top导航、iframe/worker、`</script>`闭合和自导航。主账户数据与Cookie/PageContext始终不可读，主应用业务无变更；CSP/sandbox预期阻断的请求记录到网络证据。自导航不应被宣传为完全禁网，必须观察销毁/受限反馈。预览本身不得获得认证API能力。坏脚本停止后源和原文件仍能取回。

先用真实浏览器打开/运行按钮触发，再观察请求/DOM；不得用父页面直接eval代替验证隔离。C23的精确M-X、含CDN HTML、损坏HTML和大于1MiB的HTML分别覆盖可运行、受限、源码保留及大小上限。运行副本中CSP不能被源内meta覆盖。下载原始HTML与隔离包装器分别检验，不拿原始文件的行为冒充包装器行为。
