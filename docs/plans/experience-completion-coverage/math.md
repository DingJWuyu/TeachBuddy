# 数学工坊体验清单

基线 `ddc2f3d1c4e8299cbd36b821bac817e222d4e705`。本清单先从当前产品源码、数学规格及原型独立展开，初稿尚未使用上轮 PASS。执行者 `sweep_math`，派发模型 `gpt-6.1-sol / xhigh`。证据根目录为 `test-results/experience-completion/sweep/math/`；线上私人扩展、真实 DeepSeek 账户、收费模型、Windows/WPS 和真实触屏未授权或不在本机验证边界。

源码简称均相对 `apps/web/src/features/math/`。原型首页来自 `docs/design-system/teachbuddy-app/ui/tbx/src/math/MathHome.jsx`，编辑器与公共规则依设计输入和 4174 实际运行页面。排序只有契约规定的最近修改顺序，当前源码没有用户排序控件。

| ID | 前置与入口 | 具体动作和期望 | 源码 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| M01 | 全新真实认证账户，数学首页 | 查看空态、三张想法、新建、导入、归档；空白新建立即返回不创建记录 | `WorkspaceHome.jsx`, `useMathWorkSession.js` | independent-results.json、product-empty.png；reduced-results.json | 通过 |
| M02 | 首页有公式、图形、HTML 和长标题作品 | 缩略图与列表来回切换，刷新保持视图；海报实际解码，长标题不挤坏布局 | `WorkspaceHome.jsx` | library-results.json 的 sorted-list/grid-decoded；library-grid-decoded.png | 通过 |
| M03 | 多类型作品列表 | 搜索大小写和空结果、清除、切分类；迟到结果不覆盖新搜索；按最近修改排列 | `WorkspaceHome.jsx`, `useMathWorkSession.js:refresh` | search-red/、list-scope-red/、archive-scope-red/ → list-candidate/、archive-scope-candidate/；library-results.json | SW-MATH-01 已修复 |
| M04 | 未连接网页助理的首页 | 逐个想法或输入开始制作，保留请求并展示正确连接引导，不创建空记录 | `WorkspaceHome.jsx`, `web-ai/MathWebAssistant.jsx` | unified-baseline/ 首页数学对话；bridge-baseline/ 未发布与不支持浏览器 | 受控入口通过 |
| M05 | 新建统一作品 | 加入公式、Enter 确认、源码展开复制、说明/字号/颜色；自动保存刷新重开 | `WorkshopWorkspace.jsx`, `VisualFormulaInput.jsx` | unified-baseline/ 统一作品与公式编辑；editor-pair.json formula-properties | 通过 |
| M06 | 已有作品，公式或算式尚未加入 | 返回确认取消后继续输入；切模块和刷新恢复；明确放弃不建立额外作品 | `useMathWorkSession.js:goHome`, `WorkshopWorkspace.jsx` | continuity-baseline/ 未加入公式、已有作品未加入输入 | 通过 |
| M07 | 统一作品公式编辑中 | 撤销/重做、选择另一公式、空公式错误、移除；依赖步骤确认取消与继续 | `WorkshopWorkspace.jsx` | editor-pair.json history/reference-cancel/dependent-delete-undo；continuity-baseline/ 历史取消 | 通过 |
| M08 | 新作品或纯公式作品 | 连续输入函数/点/关联算式，提交后输入焦点仍可继续；错误后修正，收起再展开 | `WorkshopWorkspace.jsx:addExpression` | unified-baseline/ 自有图形工具；independent-results.json mixed-editor；remaining-controls.json templates-collision | 通过 |
| M09 | 图形模板和真实画布 | 真实点击创建点/线/圆/多边形及关联构造；取消工具后继续，选择联动右轨 | `WorkshopWorkspace.jsx`, `geogebra/*` | drawing-pair.json 双端 7 种工具；product-native-drawing.png、prototype-native-drawing.png | 通过 |
| M10 | 已有二维构造 | 切三维/双视图和窗口尺寸，保留同一作品、构造、视区；窄屏布局不变形 | `WorkshopWorkspace.jsx`, `workshop/editor.js` | unified-baseline/ 自有图形工具与拖点尺寸；offline/cold-results.json space | 通过 |
| M11 | 添加参数 | 名称/上下限/步长/初值正常和非法值，失败保留输入；成功后数值/滑杆同步 | `WorkshopWorkspace.jsx:ParameterCreator,ObjectTools` | independent-results.json parameter-invalid；remaining-controls.json invalid-parameter-recovery；unified-baseline/ 参数取值 | 通过 |
| M12 | 参数被步骤/播放引用 | 修改范围/改名/改为算式；确认取消保留，确认继续后清理引用并刷新读回 | `WorkshopWorkspace.jsx:ObjectTools` | unified-baseline/ 参数转算式；editor-pair.json parameter-properties | 通过 |
| M13 | 点与依赖构造存在 | 改定义、名称、样式、可见/标注/轨迹；删除取消与确认，撤销恢复依赖 | `WorkshopWorkspace.jsx:ObjectTools` | unified-baseline/ 自由点修改、英文删除确认；editor-pair.json point-style/dependent-delete-undo | 通过 |
| M14 | 公式+参数+图形作品 | 添加多步，标题说明立即接参数/视图修改；显隐、排序、开场、删步 | `WorkshopWorkspace.jsx:StepTools` | continuity-baseline/ 步骤文本延迟；remaining-controls.json delete-opening-step/set-opening；editor-pair.json step-* | 通过 |
| M15 | 配置播放和步骤的作品 | 试演、滑杆、播放/重置/切步、设为开场；返回编辑恢复正确内容 | `WorkshopWorkspace.jsx:PreviewControls`, `workshop/editor.js` | continuity-baseline/ 播放101帧；remaining-controls.json set-opening；offline/cold-results.json | 通过 |
| M16 | 作品更多菜单 | 键盘/指针打开关闭和焦点，课堂全屏、菜单、取消/返回编辑与浏览器退出全屏 | `WorkshopWorkspace.jsx` | independent-results.json fullscreen-menu；unified-baseline/ 界面路径 final-native-*；continuity-baseline/ 历史恢复取消 | 通过 |
| M17 | 保存动作进行中 | 继续修改公式/图形/标题，原请求成功后保存最新输入；即时离开/刷新读回 | `useMathWorkSession.js:save`, `WorkshopWorkspace.jsx` | saving-baseline/ 即时返回、正常关闭；continuity-baseline/ 已有作品未加入输入 | 通过 |
| M18 | 注入保存失败/响应丢失/版本冲突 | 失败可重试；未知同键确认且不重复创建；冲突取消、保留本地/另存/读取服务器 | `useMathWorkSession.js` | saving-baseline/ 409与保存响应丢失；library-results.json save-retry | 通过 |
| M19 | 有两版统一作品 | 打开历史、预览实际图片、切版、读取失败重试；取消还焦点；恢复生成新版本 | `WorkHistory.jsx`, `useMathWorkSession.js:restoreVersion` | unified-baseline/ 历史海报失败重试；continuity-baseline/ 历史恢复取消 | 通过 |
| M20 | 已保存作品 | 另存新 ID，修改副本刷新，原作品保持；下载/历史弹窗 Enter/Escape 不穿透 | `useMathWorkSession.js`, `useMathDialogKeys.js` | independent-results.json library-list；saving-baseline/ 409另存；continuity-baseline/ 历史下载确认 | 通过 |
| M21 | 统一与旧源作品 | 归档返回首页、刷新不重开；归档列表打开只读；恢复重开可继续 | `WorkspaceHome.jsx`, `useMathWorkSession.js`, `WorkshopWorkspace.jsx` | independent-results.json archived/archived-open；legacy-baseline/ 动态作品归档、归档当前作品；list-consumers.log | 通过 |
| M22 | 已归档作品 | 彻底删除取消后仍可恢复，再确认删除；响应丢失刷新按原键确认 | `WorkspaceHome.jsx`, `useMathWorkSession.js:deletion` | legacy-baseline/ 归档和彻底删除的响应丢失 | 通过 |
| M23 | 合法 workshop/各旧类型 JSON | 用真实文件选择导入为独立作品、刷新重开；非法/过大文件不覆盖当前作品 | `useMathWorkSession.js:importSource` | legacy-baseline/ 制作源重新导入、各旧类型；library-results.json invalid-import-keeps-list；offline/mixed-work.json | 通过 |
| M24 | JSON 导入响应丢失 | 刷新首页保留确认入口，同键确认仅一份作品 | `index.jsx`, `useMathWorkSession.js:importSource` | legacy-baseline/ 导入响应丢失；list-consumers.log | 通过 |
| M25 | 旧 formula 源 | 可视公式/源码/结构工具、说明、撤销、保存、PNG/SVG 源下载并实际打开 | `LegacyWorkspace.jsx`, `FormulaEditor.jsx` | legacy-baseline/ 可视化公式、旧公式工具、字体失败；真实PNG/SVG产物 | 通过 |
| M26 | 旧 plane 源 | 修改函数/点/线/圆/分段/分析/关联构造/画布，保存重开和真实输出 | `LegacyWorkspace.jsx`, `GraphTools.jsx` | legacy-baseline/ 旧平面图、自然数学输入/分析、关联构造、渲染错误 | 通过 |
| M27 | 旧 space 源 | 顶点棱面截面与投影、选择和删除、保存重开、PNG/SVG 实际打开 | `LegacyWorkspace.jsx`, `SurfaceTools.jsx` | legacy-baseline/ 面和截面、真实虚线PNG/SVG、独立面、空面、极窄坐标窗 | 通过 |
| M28 | 旧 dynamic 源 | 参数/步骤/拖点/播放/轨迹、归档恢复；下载离线后禁网冷启动操作 | `LegacyWorkspace.jsx`, `DynamicTools.jsx`, `DynamicPreview.jsx` | legacy-baseline/ 演示对象参数步骤、自动播放轨迹离线、科学记数法 | 通过 |
| M29 | 旧 geogebra 和未知源 | 既有旧构造列表重开；未知源只读保留、不提供破坏性保存 | `index.jsx`, `GgbWorkspace.jsx`, `LegacyWorkspace.jsx` | legacy-baseline/ 未知制作源只读、已有旧GeoGebra列表打开刷新 | 通过既有兼容读取 |
| M30 | 真实自包含 HTML 文件 | 导入不自动运行，保存后编辑源码/运行/关闭、改名、保存刷新；取回原件字节不变 | `HtmlEditor.jsx`, `useMathWorkSession.js` | legacy-baseline/ HTML首次修改、空间与HTML历史；library-results.json html-live | 通过 |
| M31 | HTML 上传/保存未知结果 | 首页重选原文件和同键确认；后续输入保持，不重复上传或创建 | `index.jsx`, `uploadDraft.js`, `useMathWorkSession.js` | html-upload.log 与 html-upload-baseline/；legacy-baseline/ HTML源保存丢响应 | 通过 |
| M32 | 外链/损坏/过大/非 UTF8 HTML | 限制反馈正确，仍可保存取回；运行沙箱不能访问账户或写业务，自导航停止 | `HtmlEditor.jsx`, shared isolation 消费者 | legacy-baseline/ HTML主动隔离、自导航、过大非UTF8；library-html-live.png | 通过受控输入 |
| M33 | HTML 多个历史版本 | 当前源/原文件/隔离演示分别下载实际打开；历史恢复保留原件 | `LegacyWorkspace.jsx`, `WorkHistory.jsx` | legacy-baseline/ HTML源码修改恢复历史与原件；library-results.json html-live | 通过 |
| M34 | 已保存纯公式、二维、三维/双视图作品 | 下载整份 PNG、单公式透明 PNG/SVG、数学视图、源 JSON、GGB；真实打开核内容 | `WorkshopWorkspace.jsx`, `useMathWorkSession.js:exportFile` | unified-baseline/ 下载入口 work.png/work.svg/work.json/work.zip；offline/mixed-work.png、mixed-work.json；exports/results.json 与 svg-opened.png/ggb-opened.png | 通过真实图片/源与GGB兼容重开 |
| M35 | 公式+图形+参数+步骤作品 | 下载课堂 ZIP、解压，停服禁网 file:// 冷启动；公式图形/参数/步骤/播放/重置可用 | `WorkshopWorkspace.jsx`, 课堂打包消费者 | offline/cold-results.json 3/3；pure-formula-cold.png、mixed-cold.png、space-cold.png | Linux Chromium 停服禁网通过 |
| M36 | 受控网页桥 | 连接引导开关/热安装/登录返回、发送停止、断线重连；输入法/修饰键、迟到回复保护 | `web-ai/*`, `WorkshopWorkspace.jsx` | bridge.log 4/4，bridge-baseline/ messages.json；saving-baseline/ AI取消 | Chrome真实扩展+受控网页通过；线上未验 |
| M37 | 桌面/1024/390，编辑右轨及 AI 辅助栏 | 首页/编辑器/历史/下载/HTML/连接浮层无裁剪、无横溢出、可继续键盘操作 | math CSS 与各实际消费者 | unified-baseline/ editor/下载/连接中英窄屏截图；library-failure.png；reduced-results.json | 数学界面通过；主侧栏修复证据归 shell/root |
| M38 | 相关中英文与浅深主题 | 查看作品白纸、长标题/错误/菜单/对话框文案和按钮；中英主题实际截图 | 模块词库、math CSS | unified-baseline/ 公式深浅、英文切换、窄屏HTML标题；library-failure.png；bridge-baseline/ final.png | 通过相关中英主题 |
| M39 | 普通与减少动效 | 页面、内容面板、下载/历史/确认、连接浮层开合及快速反向；关闭后焦点可继续 | math CSS、ModulePresence 消费者 | motion-candidate/、motion-negative/；reduced-results.json；unified-baseline/ 普通帧JSON | SW-MATH-T01 已修复；普通/减少动效通过；CI 同根补修见下表 |
| M40 | 会话过期或切账户 | 保存原草稿、锁原现场；迟到响应/下载不跨账户，重新验证后继续 | `useMathWorkSession.js` | legacy-baseline/ 身份过期保留草稿与导出迟到跨账户保护 | 通过隔离身份；私人浏览器未验 |

## 发现与待裁决

| 编号 | 类别、触发与根因 | 修复与证据 |
| --- | --- | --- |
| SW-MATH-01 | 既存产品问题，原型同根。连续搜索或切归档条件后，旧成功会覆盖新列表，旧失败会污染当前提示。列表只守账户代次，没有查询范围及读取顺序；保存后刷新还会使用旧闭包条件。 | 当前条件引用与读取序号共同守成功/失败，所有刷新入口读取最新条件。搜索成功/失败及归档筛选分别有基线红、候选绿；原型 `prototype-search.json/png`，同步交总控。 |
| SW-MATH-T01 | 既存测试不稳定，不计产品。有限 RAF 样本会漏过180ms动效：原关闭算式第3→4帧跨约317ms；固定候选 `56b9fbad04a5f03cfefdfb71020b0670e38b7e9c` 的 CI 参数范围首段跨149.9ms，26帧四舍五入后仅3个高度，透明度已接近终态。本地300ms忙帧复现相同失败。 | 完整用例的参数/算式开合、快速反向与连接浮层统一采样真实 CSS effect 的26个进度；仅暂停 presence 的JS卸载，保留连续高度/透明度、末项可达、焦点和卸载检查，并核对反向起点连续。`motion-candidate/`、`motion-negative/`保留前轮证据；本次 `test-results/experience-completion/ci-math/receipt.md` 记录原用例和忙帧场景通过，以及移除grid动效、透明度、连接keyframe、算式退出动效的4项具名负对照失败。产品未修改，补修后的远端CI待总控执行。 |

源码疑点已核验：统一归档作品内容/标题冻结，试演/全屏菜单实际可点，参数错误可修正，下载切换按合法选项生成。原型混合构造曾保存失败“数学视图未完成布局”，见 `prototype-failure.png/txt`，与产品通过区分，不计产品新问题。主侧栏缩窄的中间态和关闭动作由总控共享外壳线核验修复，证据沿 [共享外壳清单](shell.md) 与 root 回执；本线不重复计数或修改公共壳。

## 旧轮对照

独立40组初稿落盘后才读取上轮 `TeachBuddy-preview/test-results/experience-audit/math/receipt.md` 查漏，补充公式结构、模板重名、播放模式、删除开场步和全屏嵌套层。复用了旧探针的真实操作步骤并在本轮输入/候选重新执行，未复用旧通过状态。

## 源码反查与边界

已回查 `index` 的 renderer 分派、`WorkspaceHome` 的全部入口、`WorkshopWorkspace` 的模板/属性/预览/下载分支、`WorkHistory`、`HtmlEditor`、`useMathWorkSession` 的保存/导入/删除/错误分支与网页桥。40组均有本轮证据；M03 为本轮修复，M37 的共享壳由总控负责，M36/M40 明示受控验证边界。

- `.ggb` 从真实下载字节经现有认证创建端点建成既有 geogebra 兼容作品，再由真实列表/本地引擎打开并核对函数和参数。当前产品没有独立 `.ggb` 文件导入控件，本轮未新增；不是通过外部 GeoGebra 网站验证。
- PNG/SVG 实际打开并查看；课堂三个 ZIP 停止制作服务、新建浏览器配置、禁网 `file://` 冷启动操作。ZIP里的读取/播放通过不代签 Windows、Chrome/Edge 教师设备、PPT/WPS或真实触屏。
- 真实Chrome浏览器加载本地扩展，DeepSeek页面为受控网页；线上私人账号、真实模型、商店安装/自动更新、真实系统输入法未验。
- `library-results.json` 前五组通过；末尾侧栏Close定位随自动收起失效，是探针前置与共享壳接续，未计数学问题。其最终英文深色数学画面保留在 `library-failure.png`；总控明确共享壳已另行红绿核验，不重复运行。
- 离线探索最初几次失败来自嵌套SVG精确定位、未等待初步应用完成、标签定位及引擎对象类型断言；有效结论归 `offline/cold-results.json` 与真实冷启动截图。构建候选不覆盖固定基线。

原型列表迟到成功/失败的同步已复验通过；确认取消、归焦与接续定点通过。首次快速 MathLive 输入失败已关闭：脚本在内部约60ms键盘接管前发送End/+1，按键仍投递到原控件；无确认框对照同样把+1输入作品名，点击公式后没有Confirm再次归焦。仅等待实际聚焦、保持零延迟打字即可通过，分类为探索脚本输入前置，不增加产品根因。证据见本线 `prototype-final/focus-diagnosis.md` 与 `prototype-final/receipt.md`。
