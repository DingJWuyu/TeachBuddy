# Math 体验清查

作者 `gpt-6.1-sol / medium`。基线 `a5daad25a712a4d2f75f34da71bc97e645f1a8a0`，按[总任务](../prototype-experience-audit.md)执行。写入仅 math UI、math 专属 E2E 和所属文档。公共件、翻译、引擎、后端及原型只读，问题交总控。证据唯一入口 `test-results/experience-audit/math/receipt.md`。

## 源码分母

原型首页为 `docs/design-system/teachbuddy-app/ui/tbx/src/math/MathHome.jsx` 的 `MathHome/Poster/Formulas`；底层编辑器来自原型固定 `ui/app.js` 内 `WorkshopWorkspace/ParameterCreator/ObjectTools/StepTools/PreviewControls/WorkshopDownloadDialog`、`WorkHistory`、`MathWebAssistant`、`LegacyWorkspace/HtmlEditor/GgbWorkspace`。产品对应 `apps/web/src/features/math/` 同名文件，控制器为 `workshop/editor.js`，后端和 shared 数学源码仅用于核对，不修改。

下表每行是具有独立触发或条件的行为组，组内列出的所有控件及连续转换均需检查。逐行记录实际证据及源码核对；实际探索新增分支继续加入。截图本身不能把行标成通过。基础组合为 1440×900 中文浅色；相关布局分别在 1024×768、390×844、英文与深色检查，窄屏核对辅助栏开关。

| ID | 页面/符号 | 入口、条件及完整转换 | 状态/证据 |
| --- | --- | --- | --- |
| M01 | MathHome | 首次空列表、三张灵感卡、助理起头、右轨说明入口 | 通过：library-pair双端空首页；baseline-tests首页起稿/连接保护 |
| M02 | MathHome | 全部/公式与图形/网页过滤，计数缓存，搜索后切换过滤 | 通过：library-pair双端类型筛选、计数与切换 |
| M03 | MathHome | 搜索输入/清除按钮/空结果清除，快速连续改词 | 通过：library-pair双端无结果、清空及继续过滤 |
| M04 | MathHome | 缩略图/列表，重载保持，公式/图形/HTML 缩略图与加载失败回落 | 通过：library-pair双端网格/列表和公式/HTML缩略；图形海报沿baseline-tests；产品失效图像回落/刷新恢复通过，原型旧源直接插图回落，同画面对照 |
| M05 | MathHome | 当前/归档切换，恢复，彻底删除确认/取消及回焦 | 通过：library-pair双端归档/恢复/删除取消；compatibility-tests真实永久删除及未知结果 |
| M06 | MathHome/index | 新建空白、返回不建记录、未加入输入离开取消/确认 | 通过：baseline-tests空白退出；protection-tests未加入输入确认、取消、切换刷新；审查返工confirm-lifecycle-green取消即刻归焦、快速重开和Enter确认 |
| M07 | index | JSON 导入有效/无效/过大，独立作品、错误后重试、未决接续 | 保留真实能力差异：compatibility-tests导入独立作品、错误保护；library-pair双端1MiB/坏JSON边界，原键接续沿compatibility/session专项 |
| M08 | index/HtmlEditor | HTML 导入、保存原件、首次不运行、运行/停止/重开 | 通过：library-pair双端HTML首次不运行、保存与运行/停止/源码 |
| M09 | WorkshopWorkspace | 作品名 Enter/失焦，等待/保存中/保存成功/失败/未决状态 | 通过：baseline-tests保存状态；session-tests真实失败、冲突与同键接续 |
| M10 | WorkshopWorkspace | 更多菜单，立即保存/另存/历史/归档，Tab/ShiftTab/Escape 回焦 | 通过：baseline-tests菜单键盘；final-regression全屏菜单/历史/下载与回焦 |
| M11 | WorkshopWorkspace | 空作品三个开始按钮、工具条公式/图形/参数/步骤、准备中禁用 | 通过：explore双端空编辑器；baseline-tests三个开始入口和制作工具 |
| M12 | VisualFormulaInput | 新公式焦点、键盘/虚拟键盘、加入/取消/Enter、空输入禁用 | 通过：explore双端MathLive加入；compatibility-tests结构输入、保存导出；输入法真实设备边界另记 |
| M13 | WorkshopWorkspace | 公式选择直接编辑、连续改动/确认、源码展开与复制 | 通过：editor-pair双端源码编辑、复制；baseline-tests直接编辑及Enter归焦 |
| M14 | WorkshopWorkspace | 公式说明、输出含说明、颜色/字号折叠属性 | 通过：editor-pair双端说明、包含说明、字号及折叠属性；editor-pair颜色及点样式、remaining-controls线样式双端核对 |
| M15 | WorkshopWorkspace | 多公式排序呈现，移除无引用/步骤引用确认及取消 | 通过：editor-pair双端步骤引用取消；删除与历史内容保护沿protection-tests |
| M16 | WorkshopWorkspace | 图形工具坞展开/关闭，表达式展开/收起、建立后保焦连续输入 | 通过：editor-pair双端连续表达式；baseline-tests输入展开/收起焦点 |
| M17 | WorkshopWorkspace | 模板函数三种、关联构造/导函数、名称冲突后缀与输入焦点 | 通过：editor-pair双端导函数与关联构造；remaining-controls双端8模板和名称避让实际通过 |
| M18 | WorkshopWorkspace/editor | 点/线段/圆/多边形画布手势，完成/取消，返回选择工具 | 通过：baseline-tests真实指针建立点/线段/圆/多边形；drawing-pair双端原生点/线段/圆/多边形实际指针通过 |
| M19 | WorkshopWorkspace/editor | 中点/垂线/交点工具选择与连续构造 | 通过：editor-pair双端中点/垂线/交点实际构造；drawing-pair原生中点/垂线/交点双端实际指针均通过 |
| M20 | WorkshopWorkspace/editor | 空间点/球/立方体/圆柱模板、平面/三维/双视图切换 | 通过：editor-pair双端Sphere、三视图；baseline-tests真实Cube和split |
| M21 | WorkshopWorkspace/editor | 视口调整、滚轮、拖动、尺寸变化和双视图窄屏堆叠 | 通过：baseline-tests真实视区缩放和390/1024双视图适配、不保存新版本 |
| M22 | WorkshopWorkspace | 内容列表、对象/画布/属性共同选择、图形与参数列表 | 通过：editor-pair双端对象列表与属性；baseline-tests画布/列表选择及拖点保存 |
| M23 | ParameterCreator | 名称/最小/最大/步长/初值，表单 Enter、有效与无效输入 | 通过：editor-pair双端参数创建及数值范围；remaining-controls双端无效范围错误及修正接续通过 |
| M24 | ObjectTools | 参数取值数值与滑杆，鼠标/键盘提交，边界限制 | 通过：baseline-tests数值/鼠标和键盘滑杆同步及刷新 |
| M25 | ObjectTools | 参数范围展开及应用，依赖引用确认/取消 | 通过：editor-pair双端改范围；baseline-tests引用确认/取消 |
| M26 | ObjectTools | 改为算式折叠、说明、修改/取消引用确认；函数定义编辑 | 通过：baseline-tests参数转算式取消/确认及刷新，editor-pair函数定义 |
| M27 | ObjectTools | 对象改名失焦/Enter，引用同步；依赖删除确认/取消 | 通过：editor-pair双端改名与删除取消；baseline-tests关联点保存/续改 |
| M28 | ObjectTools | 颜色、点大小/线宽线型、显隐、标注；点轨迹 | 通过：baseline-tests自由点样式/轨迹及关联定义；editor-pair双端样式属性 |
| M29 | ObjectTools | 参数播放开关、秒数、单次/循环/往返 | 通过：editor-pair双端参数播放/秒数/循环；protection-tests真实播放101帧，remaining-controls双端三种播放模式实际选择通过 |
| M30 | StepTools | 加步骤、标题/说明连续编辑、选步骤、轨道滚动 | 通过：editor-pair双端标题说明和连续步骤；protection-tests延迟竞态 |
| M31 | StepTools | 展示视图、对象/公式显隐、参数值展开修改 | 通过：editor-pair双端参数值，baseline-tests步骤视图/显示属性 |
| M32 | StepTools | 前移/后移边界禁用、设开场、删除当前/开场步骤 | 通过：editor-pair双端步骤前移和设开场；remaining-controls双端删除开场步骤/撤销通过 |
| M33 | WorkshopWorkspace/editor | 撤销/重做连续批次、编辑后 redo 清空、保存后仍可撤销 | 通过：editor-pair双端undo/redo；baseline-tests混合AI与手工内容及保存后历史 |
| M34 | PreviewControls | 进入试演、参数滑杆/拖点、步骤切换、重置、不污染编辑源 | 通过：editor-pair双端试演滑杆、循环、重置/退出；session-tests不污染编辑保存 |
| M35 | PreviewControls | 播放、设开场状态、退出试演恢复；试演禁用制作 | 通过：protection-tests真实播放101帧；editor-pair双端退出与重置，remaining-controls双端设开场通过；原型同根EA-math-03复现后等待重试 |
| M36 | WorkshopWorkspace | 更多进入课堂展示、尺寸调整、Escape/返回编辑退出与回焦 | 修复通过：EA-math-01/02；final-regression进入/返回、原生退出、快速反向、1440/390对齐 |
| M37 | WorkshopDownloadDialog | 打开/关闭/外点/Escape/Enter，Tab 圈定和入口回焦 | 通过：baseline-tests与final-regression下载键盘、外点关闭源码、回焦；全屏亦可达 |
| M38 | WorkshopDownloadDialog | 整作品 PNG、1200/1600/2400、白底/透明、未保存禁用 | 通过：baseline-tests真实PNG下载打开；explore双端下载面板，未保存禁用源码核对 |
| M39 | WorkshopDownloadDialog | 图形 PNG/SVG 条件、三维/双视图白底限制 | 通过：baseline-tests真实图形导出；editor-pair三维/双视图；导出类型条件源码核对 |
| M40 | WorkshopDownloadDialog | 选公式、PNG/SVG、制作源 JSON、仅图形 GGB、课堂 ZIP | 通过：baseline-tests整PNG/公式SVG/JSON/课堂ZIP实际下载及禁网打开；GGB现有能力保留 |
| M41 | WorkHistory | 读取/失败重试、选择记录、预览失败重试、取消/Enter 恢复确认 | 通过：baseline-tests历史读取/海报失败重试/切版恢复；native-confirm全屏嵌套恢复确认；confirm-native-lifecycle补普通/全屏受控退出、快速重开与键盘确认 |
| M42 | useMathWorkSession | 修改保存刷新重开、历史恢复生成新版、冲突三条恢复路径 | 保留真实能力差异：session-tests真实409三路径、未决同键、即时离开；不以原型内存模拟替代持久化 |
| M43 | MathWebAssistant | 首页/作品共用上下文，灵感填充、未连接保输入展开引导 | 通过：baseline-tests缺连接保输入、首页自动起稿/共享上下文；library-pair双端助理开关 |
| M44 | MathWebAssistant | 模型选择弹层焦点、外点/Escape；检查中/未安装/不支持浏览器 | 通过：connection-tests实际Chrome扩展热安装和中英窄屏引导/焦点；不支持浏览器提示沿源码与基线 |
| M45 | MathWebAssistant | 商店未发布、更新/不兼容、未登录/连接中/断连/成功 | 保留已裁决边界：connection-tests受控网页验证登录/断连/更新；商店未发布、用户外部账号不操作 |
| M46 | MathWebAssistant | Enter 发送/ShiftEnter 换行/输入法/修饰键，空输入禁用 | 通过：baseline-tests Enter/ShiftEnter/修饰键与合成输入法guard；真实系统输入法未验 |
| M47 | MathWebAssistant | 受控生成等待/停止/失败/成功、新对话、关闭重开保留 | 通过：connection-tests真实扩展SEND/CANCEL+受控网页、baseline-tests新对话和继续操作 |
| M48 | MathWebAssistant | AI 与手动改动竞态、离开取消、请求交接不重填 | 通过：baseline-tests首页一次交接/离开迟到回复；cancel-fixed即时拖点取消和刷新保护 |
| M49 | HtmlEditor | 原件信息、源码展开编辑/预览/停止、外部资源提示、错误状态 | 通过：library-pair双端HTML运行/停止/源码；compatibility-tests外部资源/隔离/坏编码 |
| M50 | HtmlEditor | 取回原文件/当前源码/隔离演示，修改源保存与改名分离 | 通过：compatibility-tests原件字节保护、源码修改/历史、超限取回；下载菜单源码核对 |
| M51 | LegacyWorkspace/GgbWorkspace | 旧公式/平面/空间/动态/GGB 兼容展示与现有控件 | 保留兼容能力：compatibility-tests动态/旧空间/HTML实际回归；remaining-compatibility其余29/29通过，旧formula/plane/space/dynamic/HTML现有全部35条实际回归覆盖 |
| M52 | 全 Math UI | 1440/1024/390，深浅中英，窄屏辅助栏关闭返回画布和无横溢 | 通过：baseline-tests深浅中英1440/1024/390；library-pair双端390无横溢；editor-pair英文窄屏 |
| M53 | 全 Math UI | 动效展开/退出中间态、焦点连续 Tab/ShiftTab，浮层后续操作 | 通过：baseline-tests连续焦点与展开/退出中间态；protection-tests嵌套归焦，final-regression全屏浮层 |

## 差异与边界

产品真实保存、账户隔离、真实 GeoGebra、本地运行时、历史与真实扩展能力保留；原型内存或模拟数据不覆盖这些能力。商店发布、用户外部账号、真实线上模型与目标设备按既有授权边界记录，受控替身结果不宣称真实模型通过。

## 问题与当前现场

53个行为组已按源码、两端实跑及现有专项逐项核对；表内区分双端操作、产品真实能力回归、源码条件核对和外部未验边界，不能把源码核对当作该条件已实际触发。UI独立既存问题3项：EA-math-01原生全屏缺失、EA-math-02窄屏课堂展示标题两行、EA-math-03试演重置后立即返回编辑被busy拒绝。EA-math-03在原型同条件也可复现，按退出试演恢复编辑的既有规格修复产品，不修改原型。总控拥有的EA-shared-01为本轮原生全屏恢复后暴露的Portal组合问题，不混入math既存问题计数。

基线原有math-unified 16/16、compatibility 6/6、Chrome真实扩展+受控网页4/4、未加入输入/历史保护6/6和会话持久化3条已通过；最终UI候选定点3/3及播放101帧1/1通过。AI取消用例原定位已过时，按当前banner入口更新为“打开 AI 助理”，保留原手拖/停止/迟到响应保护，单独复验1/1通过。编辑器公式/参数/对象/步骤细项、7种原生绘图及额外6组模板/样式/开场分支已双端完成。原型EA-math-03在重置/返回与滑杆/设开场两条路径均实际复现，等切换完成后重试可继续。旧源29/29与先前6条合计35/35。证据细节和最终状态归回执。

现有模型交接、真实GeoGebra和本地资源保留；本轮未调用真实线上模型、未发布扩展商店、未操作用户外部账号。Windows/触屏/真实系统输入法未验。旧源实际专项35/35通过，包含旧formula/plane/space/dynamic/HTML的现有工具、故障与输出；真实旧GGB编辑入口由session专项与既有本地运行时路径保持。

## 冻结交付

作者源码现已冻结，未提交。数学产品问题计3项：2项基线相对原型偏差（01、02）及1项原型共有但现行退出/试演规则明确的基线缺陷（03）。另修1项过时测试定位EA-math-T01；本轮新引入产品问题为0，原生全屏新增组合发现由总控记EA-shared-01，不重复计数。

53组中49组按表完成交互核对，4组记录真实能力/兼容或外部边界（M07、M42、M45、M51）。这不是53次截图：两端同输入操作、真实GeoGebra、真实保存/文件和故障注入证据分别归回执。原型运行时在复杂GGB布局/保存与旧源海报产物上存在能力差异，未改写原型或用模拟数据替换产品真实输出。需要真实商店、用户外部账户、线上模型或目标设备的边界仍未验。

末次补验 `native-reset-exit-final/` 1/1通过：重置尚在运行时原生退出全屏，等待当前试演任务完成再恢复编辑。所有本线浏览器、HTTP服务和测试进程均已结束，待总控固定候选审查/CI，作者不再修改。

## 集中审查返工：共享确认生命周期

2026-10-21，按总控任务仅调整 `useMathConfirm.jsx`：无条件挂载 `AppConfirmDialog` 并传 `present`，移除业务外层 `ModulePresence`，可空消息字段安全读取。退出内容、立即 inert、键盘撤除、归焦与快速重开的 fresh key 由共享确认框统一拥有，数学不保留第二份退出快照。

未变 `candidate-web` 真实复现取消后旧 Portal 仍不 inert、焦点仍在旧“取消”，证据 `confirm-lifecycle-red.json/png`。这是共享既存 EA-shared-02 的同根消费者，数学不另加产品问题，仍为3项。新隔离构建 `confirm-controlled-web` 通过，普通未加入输入取消/快速重开/连续 Tab/Enter 正向放弃，以及原生全屏历史嵌套确认取消/快速重开/连续 Tab/Enter 正向恢复全部通过，证据 `confirm-lifecycle-green.json`、`confirm-native-lifecycle.json/png`。本轮未重跑全套或扩数学功能，作者重新冻结，等待总控集中收口。
