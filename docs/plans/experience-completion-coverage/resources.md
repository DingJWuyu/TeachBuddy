# 资源库独立体验覆盖

本清单由当前产品源码、资源规格和同提交原型独立展开。基线 `ddc2f3d1c4e8299cbd36b821bac817e222d4e705`，产品只读构建 `test-results/experience-completion/sweep-baseline-web`，原型 4174。证据根目录 `test-results/experience-completion/sweep/resources/`。初稿于核对上轮覆盖前完成；状态只凭本轮实际运行更新。

固定基线对照结束后，总控完成原型同步。本线仅对修后相关路径执行8个定点，结果均通过，证据为 `prototype-final/observations.json`；这批结果不替代原始基线红或产品真实服务验证。

## 运行与判定

- 模型：gpt-6.1-sol / xhigh。隔离真实注册登录、测试邮件、HTTPS、SQLite、Files 和浏览器；OCR 仅固定回放，不启动真实模型。
- 每项记录真实入口、前置条件、操作序列、对应源码、证据和结果。未执行条件保持未验；测试自身失败和环境失败分别记录。
- 产品范围与预期以[资源规格](../../features/resources.md)、[材料契约](../../contracts/materials.md)及[设计输入](../../design-system/README.md#资源库)为准。搜索无匹配使用简单空结果。
- 本线独占资源前端、模块词库、资源专属 E2E 与规格技术页；公共预览能力、公共组件样式、原型和后端变更先交总控。

## 入口、分支与实际序列

源码路径均相对 `apps/web/src/features/resources/`。

| ID | 触发条件与实际操作序列 | 源码入口 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| R01 | 空账户登录后进入资源库，核对首次空态、单一上传入口及导航 | `index.jsx` / `Library.jsx:firstVisit` | `dual-audit/*-L01-empty.png`；`keyboard-motion-green.log` 首条整理与空态键盘上传 | 通过 |
| R02 | 文件选择器取消后重开；单份真实图片上传，列表提示、缩略图和重开 | `Library.jsx:UploadButton` / `resourceOperations.js:upload` | `gaps-2/chooser-cancel.png`；`keyboard-motion-green.log` Enter/Space、取消、PNG/PDF多选与busy禁用；`prototype-final` upload-keyboard修后原型空态/工具栏键盘与取消 | 通过 |
| R03 | 拖入真实外部文件，核对拖入/移出/松开及当前文件夹收录 | `Library.jsx:onDragOver/onDrop` | `final-green.log` 空库拖入/移出/落下；`supplement-version-green.log` 当前文件夹真实PNG拖入；`prototype-final` empty-drop修后原型不叠字及移出/落下 | 通过 |
| R04 | 多文件按顺序收录；处理中返回/刷新；重复资料跳过、取消、另存及归档重复 | `resourceOperations.js:execute/nextUpload/skipDuplicate` | `baseline-e2e.log` 批量重复刷新/失败接续；`dual-states` U04跳过/另存；`reselection-green.log` 原件未知接续 | 通过 |
| R05 | 上传明确失败后跳过继续；未知结果原键确认；刷新后重选原件，错误原件拒绝 | `resourceOperations.js:execute/reselectOriginal` | `reselection-green.log` 原件POST已提交后丢响应、刷新、错误重选零请求、正确重选复用原键并继续下一份 | 通过 |
| R06 | 单文件 100MB、文件名 200 字符边界拒绝，修正后继续上传 | `resourceOperations.js:upload` | `dual-states` U02-long-name / U02-large-file：201字名称与100MiB+1稀疏文件前置拒绝，随后正常收录 | 通过 |
| R07 | 缩略图/列表切换，标题/文件夹/日期/大小对齐，缩略图缓存及完成后自动补入 | `Library.jsx:Thumb/Segmented` / `index.jsx:pendingPreviews` | `baseline-e2e.log` 缩略图缓存及完成自动补入；`dual-audit` L04；`dual-states` L05 | 通过 |
| R08 | 名称、原文件名、备注、正文搜索，280ms 停顿/Enter/清除及无匹配空态 | `index.jsx:searchQuery` / `Library.jsx:search` | `dual-audit` L06/L07；`baseline-e2e.log` 正文摘录/当前文件/归档检索及中文连续匹配 | 通过 |
| R09 | 类型多选、全部/单独移除；标签多选/移除；文件夹含后代与未分组组合 | `Library.jsx:FilterMenu/toggleTag/shown` | `dual-edges` L07-all-types / L08-combined-tags；`dual-audit` L10；`dual-branches` S07 | 通过，归档导航限制见边界 |
| R10 | 正文逐步读取、部分失败重试、断网停止等待后继续；活动/归档各自搜索 | `index.jsx:receiveSearch` / `Library.jsx:searchInfo` | `baseline-e2e.log` 坏PDF正文隔离、断网继续、历史与归档当前文件；OCR搜索补充回放 | 通过 |
| R11 | 新建文件夹 Enter/blur/Escape；空白、同级重名、保留名称拒绝后修正 | `Library.jsx:startNew/commitName/nameField` | `dual-audit` F01/F02；`dual-branches` F02/F03；`dual-edges` F03空名与blur | 通过 |
| R12 | 文件夹菜单开闭、新建子目录、折叠/展开、面包屑、二次点击回全部 | `Library.jsx:folderRows/openFolder` | `dual-audit` F01-child/F04-fold/L10-breadcrumb；`dual-edges` F03折叠父级中新建 | 通过 |
| R13 | 文件夹改名、菜单移动至根或其他目录；自身/后代/同名目的地排除 | `Library.jsx:startRename/canMoveFolder/moveFolder` | `dual-branches` F03-rename/F08；`dual-edges` F06-name-collision；`dual-audit` F05-move-menu | 通过 |
| R14 | 指针拖文件夹进另一文件夹、回根目录；拖动取消不改保存，刷新读回 | `Library.jsx:startRailDrag` | `dual-branches` F08-drag/F08-root及跟手截图；`dual-final` S03无目标松开；真实浏览器指针路径 | 通过，系统取消边界见下文 |
| R15 | 删除父目录先就地确认，取消后继续；整棵子树移除，活动/归档资料归未分组 | `Library.jsx:deleteFolder` | `baseline-e2e.log` 删除嵌套树活动/归档刷新；`dual-audit` F07-delete-tree；`final-green.log` 删除分类后备注重存 | 通过 |
| R16 | 拖文件夹到归档，递归归档子树内容并移除树；失败/未知保留树及原请求 | `Library.jsx:archiveFolder/organize` | `dual-branches` F09；`dual-edges` F09-archive-102；`dual-special` F09-unknown-preserves-tree | 通过 |
| R17 | 标签新建、颜色八选、重名拒绝、编辑/取消、删除确认/撤回、刷新持久化 | `Library.jsx:TagDialog` | `dual-audit` T01/T02；`dual-branches` T02；`baseline-e2e.log` 颜色刷新/新设备/旧色迁移；候选删除草稿回归 | 通过 |
| R18 | 指针拖排标签，蓝线/原行/幽灵卡位置，排序后颜色名称不变 | `Library.jsx:startRailDrag` | `dual-branches` T03-drag-line/T03-reorder；`baseline-e2e.log` 标签排序与颜色持久化 | 通过 |
| R19 | 选择/完成、单选/全选/取消全选、100项上限、空白框选/修饰键加选/取消 | `Library.jsx:selection/startBand` | `dual-branches` S01/S02；`dual-edges` S01-seed-102/S02-auto-scroll；`dual-special` Shift追加；`dual-final` 空白清选 | 通过，系统取消边界见下文 |
| R20 | 批量下载真实原件、移动确认/取消、标签混合状态追加/移除、新建后继续 | `Library.jsx:downloadPicked/SelectionTags` / `Organize.jsx` | `dual-branches` S05下载字节/S07三态；`baseline-e2e.log` 批量整理取消/冲突；`postfix-boundaries.log` 选择菜单新建标签后继续加标 | 通过 |
| R21 | 拖真实资料卡到文件夹、标签、归档；多选拖放、无效目标/取消和不误开详情 | `Library.jsx:startDrag` | `dual-branches` S04文件夹/标签；`dual-final` S03点击阈值/无目标/所选多项；实际指针与跟手截图 | 通过 |
| R22 | 批量归档/恢复确认/取消、切状态清选择、成功后操作条继续可用 | `Library.jsx` / `Organize.jsx` / `resourceOperations.js:organize` | `dual-states` S09-bulk-archive；`dual-branches` S08-bulk-restore；`final-green.log` 原子整理和取消连续Tab | 通过 |
| R23 | 批量过期版本整批拒绝；未知结果刷新后原键确认，不重复写入 | `resourceOperations.js:execute` | `baseline-e2e.log` / `final-green.log` 批量取消、过期版本整笔拒绝及丢响应原键确认 | 通过 |
| R24 | 归档批量彻底删除确认/取消，刷新和搜索不再出现，受管原件仍保留 | `Library.jsx:purge` | `dual-states` S09-bulk-purge-cancel/save；`baseline-e2e.log` 永久删除权限/版本/丢响应及刷新检索 | 通过 |
| R25 | 打开/返回详情恢复筛选、选择与滚动；深链接和无效资料；刷新/跨模块返回 | `ResourceRoute.jsx` / `index.jsx:open/close` | `dual-final` L11-scroll-scene；`baseline-e2e.log` 详情滚动/焦点恢复；`deeplink-red.log` 对 `final-green.log` 删除后保留链接及读取失败重试 | 通过，已修SW-RESOURCES-01 |
| R26 | 名称/文件夹/标签/备注草稿，保存中继续输入，收起/刷新/重开后保持 | `ResourceInfo.jsx` / `index.jsx:edit` / `resourceOperations.js:metadata` | `baseline-e2e.log` 保存中继续输入/丢响应/刷新；`final-green.log` 删除分类后保留备注与保留标签并重存；`prototype-final` taxonomy两分支409后200及本会话退出重开读回 | 通过，已修SW-RESOURCES-02 |
| R27 | 详情就地创建文件夹/标签并选入草稿；创建连续操作及父目录排除 | `Taxonomy.jsx` / `index.jsx:saveTaxonomy` | `dual-preview-2` D03-inline-folder/tag；`keyboard-motion-green.log` 原有就地整理及分类取消焦点 | 通过，详情标签原型差异见下文 |
| R28 | 保存已知失败、版本冲突对照及后续重存；响应丢失按原键确认 | `index.jsx:conflict` / `resourceOperations.js:execute` | `baseline-e2e.log` / `final-green.log` metadata未知、后续草稿保护及分类删除冲突对照重存 | 通过 |
| R29 | 真实 PNG/JPG/WebP/PDF/DOCX/DOC/PPTX/PPT逐页解码、缩放、下载校验原字节 | `Preview.jsx` / `PdfText.jsx` / `client.js:download` | `baseline-e2e.log` PDF/PNG及四类Office逐页解码、系统复制、下载字节；`gaps-2.log` JPG/WebP/HTML真实字节及下载 | 通过，Office/HTML原型模拟边界见下文 |
| R30 | 多页前后/页码跳转/方向键；各文件各页阅读位置、75%-200%及刷新恢复 | `Preview.jsx` / `index.jsx:pages/previewScroll` | `dual-audit` P02/P03；`baseline-e2e.log` PDF页码/阅读位置/文字层缩放与刷新；`supplement-version-green.log` 补充页位置恢复 | 通过 |
| R31 | 不支持格式与安全 HTML 预览；转换失败重试；单文件读取失败后正常资料继续 | `Preview.jsx:unsupported/failed/generate` / `index.jsx:fileErrors` | `baseline-e2e.log` 文件读取隔离、Office失效PDF独立、失败重试和不支持格式；`gaps-2` HTML安全文本；`final-green.log` 空态几何 | 通过，已修SW-RESOURCES-03 |
| R32 | 更新文件确认/取消/关闭退场/快速重开；失败旧文件保留；备注分类不变 | `index.jsx:ConfirmDialog` / `resourceOperations.js:confirmOperation` | `baseline-e2e.log` 四类确认退场/快速重开、真实PDF替换；`postfix-boundaries.log` 替换422旧件保留后重新替换成功 | 通过 |
| R33 | 历史读取失败重试、下载、恢复确认/取消、新版本追加，归档仅可下载历史 | `FileHistory.jsx` / `resourceOperations.js:restore-file` | `dual-preview-2` D06；`final-green.log` 历史下载/取消/恢复/归档只读；`postfix-boundaries.log` 历史读取失败后重试 | 通过 |
| R34 | 补充 PDF 上传/逐页核对/采用/取消/移除；替换不沿用旧补充，历史恢复来源 | `index.jsx:supplement` / `resourceOperations.js` | `dual-preview-2` P06取消/逐页采用/移除；`supplement-version-green.log` 替换不沿用旧补充、恢复同时采用历史原件与补充，原件下载字节一致 | 通过 |
| R35 | 单份归档/恢复/彻底删除确认取消、退场误触、焦点恢复及刷新/原键确认 | `index.jsx:ConfirmDialog` / `resourceOperations.js:deletion/purge` | `baseline-e2e.log` 四种确认取消退场与快重开、归档恢复永久删与原键确认；`final-green.log` 删除保留链接；`prototype-final` shared-confirm-archive修后原型present/inert、立即Tab、快重开和后续Enter/Escape | 通过 |
| R36 | PDF实际拖选系统复制/复制本页，成功短提示、剪贴板拒绝和无文字/读取失败重试 | `PdfText.jsx` / `Preview.jsx:copyMessage` | `baseline-e2e.log` 真拖选/系统剪贴板/无文字/读取失败；`dual-special` P07拒绝剪贴板仍可阅读 | 通过 |
| R37 | 查找本页中英/跨文字项/字面符号，匹配数和上下处，Enter/Shift+Enter/Escape | `PageFind.jsx:findRanges/move` | `baseline-e2e.log` 页内中英、跨文字项、字面符号、前后处及真实Enter/Shift+Enter/Escape；`dual-audit` P08 | 通过 |
| R38 | 查找缩放/翻页重置当前命中/换文件或退出清空；迟到读取/无原生高亮退化 | `PageFind.jsx` / `Preview.jsx` | `baseline-e2e.log` 75%-200%/主题/390/迟到读取/换文件/翻页重入/无Highlight；`dual-special` P09 | 通过 |
| R39 | OCR固定回放按需识别本页/剩余页，翻页/刷新、公式表格图、复制及疑点定位 | `Recognition.jsx` / `Preview.jsx:issueBox` | `baseline-e2e.log` 固定I-1/I-2真实HTTP/Job/SQLite消费；`dual-recognition` 疑点框、换页清除、复制失败备用原文、四档尺寸 | 通过，仅固定回放 |
| R40 | OCR失败/停止/重试、丢响应原键恢复、断网继续、引擎更新及不可用禁用 | `Recognition.jsx` / `resourceOperations.js:recognition` | `baseline-e2e.log` OCR失败/停止/原键刷新/引擎修订/搜索断网；`dual-audit` 未配置识别不可用；原型任务状态用受控适配 | 通过，仅固定回放 |
| R41 | OCR正文搜索已完成结果、定位打开、其他客户端更新后来源一致/旧命中拒绝 | `index.jsx:open` / `Recognition.jsx` | `baseline-e2e.log` OCR搜索补充/另一客户端更新后最新来源与过期命中；`dual-recognition` 换页定位清理 | 通过，仅固定回放 |
| R42 | 1440桌面/390窄屏/辅助栏容器；预览信息等高或上下独立滚动，控件可达 | `resources.css` / `index.jsx` / `Library.jsx` | `dual-audit` X04/X05；`dual-states` X03四档；`baseline-e2e.log` 窄屏信息独立滚动；`gaps-2` 英文390深色列表/操作条/HTML | 通过 |
| R43 | 中英/深浅色相关布局，长名称、备注、标签；减少动效与真实开闭中间态 | `resources.css` / 弹层与菜单消费者 | `dual-audit` X06四组合；`dual-states` X07 reduce；`keyboard-motion-green` 3类真实CSS90ms中间态；候选截图实际查看 | 通过，目标设备边界见下文 |
| R44 | 菜单/对话框键盘打开、Tab/Shift+Tab、Escape、点击外部及取消后焦点继续 | `ResourceDialog.jsx` / `Library.jsx` / `FileHistory.jsx` | `baseline-e2e.log` 既有确认退场；`drop-focus-red.log` 对 `final-green.log`；`keyboard-motion-green.log` 立即归焦/原生Tab/退场/快重开/上传Enter与Space；`prototype-final`三类局部对话与共享归档确认修后对应路径 | 通过，旧共享根因漏网消费面及SW-RESOURCES-05已修 |

## 本轮缺陷与根因

- **SW-RESOURCES-01，既存，已修。** 真实收录后保留资料深链接，归档并彻底删除，离开再重新打开该链接，加载结束仍停留“读取资料…”。`deeplink-red.log` 为有效基线红；`final-green.log` 为候选绿，区分成功未找到和读取失败重试，信息右轨同步结束读取态。原型不提供同等真实路由/持久链路，不为此扩大原型能力。
- **SW-RESOURCES-02，既存且原型共有，双端已修。** 资料留未保存备注，返回列表删除其文件夹或标签，再打开保存，409对照后仍因隐藏旧引用422。`taxonomy-final-red.log` 两分支明确失败；`final-green.log` 两分支通过，保留备注和其他标签。只在taxonomy成功读取后派生有效分类引用，原baseVersion继续校验。原型同序列红保留于 `prototype-draft-deletion/observations.json`；总控已同步，`prototype-final` taxonomy两分支实际409后200，本会话退出重开仍保留备注。
- **SW-RESOURCES-03，既存产品偏差，已修。** Preview的`.res-empty`样式遗漏，坏PDF和不支持格式提示贴左上；原型保留居中图标块与文字。`empty-preview-red-2.log` 图标偏离中心377px，`final-green.log` 几何与截图通过。复用原型现有CSS。
- **SW-RESOURCES-04，既存且原型共有，已获总控裁决并修双端。** 空库外部拖入提示与底下上传按钮重叠。`dual-states/*-U01-drop-hover.png` 双端红；`drop-focus-red.log` 行为红，`final-green.log` 拖入/移出/落下通过。仅在拖入期间隐藏底下空态，保持布局和既有元素。总控已同步原型，`prototype-final` empty-drop对应操作与截图通过。
- **SW-RESOURCES-05，既存且原型共有，已获总控裁决并修双端。** 上传label与hidden input均不能经Tab到达。`upload-keyboard/observations.json` 双端真实45次Tab均不可达，`keyboard-upload-red.log` 控件行为红；产品`keyboard-motion-green.log` 原生button Enter/Space、两次取消、空态/工具栏、多文件和busy禁用通过。总控已同步原型，`prototype-final` upload-keyboard实际Tab可达、空态Enter取消、Space多文件及工具栏Enter取消通过；不将产品busy断言写成原型另行运行结果。
- **旧EA-shared-02的资源漏网消费者，单列去重，双端已同步修复。** ResourceDialog在保留退场期间180ms后才解除焦点副作用，取消后立即Tab跳品牌。原始独立红由shell线提供 `../shell/resource-cancel.json`；本线 `drop-focus-red.log` 在批量归档、文件历史和分类三种消费者均红。资源局部ResourceDialogPresence按已有Overlay可见性方案修五个消费者；产品`keyboard-motion-green.log`及原型`prototype-final`三类对应路径均验证立即归焦、原生Tab、真实CSS90ms中间态及快速重开。共享单条归档确认也已在原型定点验证present/inert及取消后继续键盘操作。不机械增加本轮独立根因计数。

本轮独立资源根因5个，均有实际基线红和候选绿。确认模板的既有AC/EA问题不重复计数。

## 上轮对照、实际证据与边界

独立初稿完成后才读取上轮清单。补足了其69行中的读取占位、同父重名、102项分批、Shift框选、原生高亮退化和疑点框等条件。复用其中可读的操作脚本作为执行工具，改为本轮独占数据和输出；本轮所有结果重新运行，没有继承旧PASS。

八组双端脚本本轮共240条实际观察通过：`dual-audit`64、`dual-branches`42、`dual-states`30、`dual-edges`20、`dual-preview-2`30、`dual-recognition`20、`dual-final`16、`dual-special`18。每组JSON保留文本、焦点、尺寸与截图，断言只能证明具名条件。基线资源专项39个现有用例通过；候选按影响定点，不重跑全部CI。精确命令、固定输入、候选摘要和临时现场归属见证据目录`receipt.md`。

修后原型8个定点为删除文件夹/标签后草稿保存各1个，批量归档/历史/新建文件夹局部对话各1个，上传键盘、空库拖放和共享单条归档确认各1个。`prototype-final/observations.json`逐项记录结果、mock请求和有效截图所在目录；只复核失败测试前置，没有重跑整套。原始红和首次执行问题现场均保留。分类读取失败、重复/冲突对话的其余取消分支、原型busy禁用没有在这批另行运行，不据源码代签PASS。

- 详情就地新建标签两端均只有名称，没有颜色选择；本轮保留已确认原型现状，不据模板统一新增界面。
- 归档右轨的标签禁用，点击文件夹回活动列表，两端当前一致；归档正文搜索和格式过滤已实际验证，不把它们写成归档标签导航已可用。
- 原型是内存适配：二进制Office不提供真实转换、多客户端和后台任务不是生产服务。有限/不支持格式和识别运行状态的原型适配条件在脚本明确标出；真实产品使用HTTP、SQLite、Files和固定回放。原型仅证明呈现与操作对应关系。
- `dual-preview.log` 首次有两处测试问题：PPT名称前缀歧义，以及5秒等待不足以完成真实补充PDF转换。保留失败现场；改精确文本查询并沿既有转换前置等待后，`dual-preview-2.log`双端30条完整通过。最初保留链接测试对同URLgoto触发既有一次消费/刷新现场，未形成有效缺失复现；先离开首页再打开的`deeplink-red.log`才计有效红。
- 真实模型、收费调用、目标Office人工编辑打印、真实移动触控/系统级pointercancel和系统输入法没有运行。浏览器鼠标、键盘、受控外部文件DataTransfer与固定OCR回放各自留证，不替代这些目标环境专项。
- 本线不修改原型、公共组件/样式/翻译、后端或Git。总控已完成原型同步，本线修后定点与截图核验已结束。当前产品源码冻结，独立审查、完整CI、集成及整任务清理由总控完成；不把本线作者通过称为全站交付。
