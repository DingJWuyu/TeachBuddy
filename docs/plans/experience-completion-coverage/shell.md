# 公共外壳与共享交互独立核查

核查者 `sweep_shell`，模型 `gpt-6.1-sol / xhigh`，固定产品与原型源码 `ddc2f3d1c4e8299cbd36b821bac817e222d4e705`。产品使用只读构建 `test-results/experience-completion/sweep-baseline-web`；原型 `http://127.0.0.1:4174`。固定对照结束后，总控已同步原型；文末另列更新后的定点复验，不把它混作固定基线。只写本页和 `test-results/experience-completion/sweep/shell/`；修复交总控。真实认证、fake-mail、隔离 HTTP/SQLite/browser，无真实邮件或收费服务。

## 独立源码清单

本表从当前源码独立展开，初稿完成前未读取上轮覆盖。路径前缀：`chrome/` 指 `apps/web/src/features/workbench/chrome/`；`ui/` 指 `apps/web/src/components/ui/`；`interaction/` 指 `apps/web/src/components/interaction/`。每条实际执行后填具体序列、证据和结论；初始“未验”不代表失败。

| ID | 入口、前置与计划实际序列 | 源码与消费者 | 状态 / 证据 |
| --- | --- | --- | --- |
| SH01 | 初次账户登录，教程提示关闭，侧栏开合，刷新，Tab继续 | chrome/Topbar.jsx、Sidebar.jsx、WorkbenchApp.jsx | 发现 SW-SHELL-03/06；普通开合刷新通过。390首次登录双端均隐藏教程但保留遮罩，06见supplement/initial-coach.json、s14/s15。03普通/reduce对照见chrome-responsive.json。候选正常入口及回桌面关闭见root/shared-final.log，reduce见root/chrome-green.log。 |
| SH02 | 默认分组折叠展开，新增合法/空/重复分组，取消再输入 | chrome/Sidebar.jsx、useLayoutModel.js | 通过所列正常序列。新增补测：空/空白Enter不创建；未分组及大小写/空白归一的Ungrouped拒绝；合法草稿失焦保留后Enter成功；空白失焦关闭。原有合法/重复名/Escape/折叠刷新亦通过。supplement/results.json SH02、s01；manual-session.repl.txt、03。 |
| SH03 | 分组选项重命名成功/无效/取消，解散第一次确认取消/超时/完成 | chrome/Sidebar.jsx GroupMenu、ui/confirm.jsx | 发现SW-SHELL-01，候选归焦绿见root/shared-final.log。新增空/空白改名、重复名/保留名失败后原输入重试成功，重复名失焦取消保留旧名；菜单外点关闭、解散首击后外点取消，重开仍需二次确认。supplement/results.json SH03-validation/outside、s02；原有Escape/3200ms超时/成功解散见04、group-delete-focus.json。 |
| SH04 | 模块真实指针组内/跨组排序，拖动中间态，折叠组悬停展开，键盘Alt方向移动 | chrome/Sidebar.jsx beginPress/commit/handleRowKey | 发现SW-SHELL-05。真实组排序后刷新、折叠组悬停750ms展开并成功移入后刷新、回原位松手取消均通过；ghost与悬停中间帧s03/s04。移出导航或Escape仍提交旧落点的基线红见supplement/drag-cancel.mjs/json。候选两取消→成功→刷新绿见root/shared-final.log，原型更新后定点绿见supplement/prototype-final.json。 |
| SH05 | 模块拖到垃圾桶，取消/确认，恢复，再导航和刷新 | chrome/Sidebar.jsx、ui/confirm.jsx | 通过：resources拖桶隐藏、按钮恢复、Delete再隐藏、恢复刷新；补真实展开垃圾桶稳定后拖回空组、刷新保留。supplement/results.json SH05-trash-drag-back、s16；原05。隐藏不删除内容。 |
| SH06 | 导航读取失败重试、保存未确认后继续调整，紧凑侧栏状态入口 | useNavigation.js、chrome/NavigationStatus.jsx | 通过：GET503暂停编辑/重试；真实PUT成功断响应后继续草稿、紧凑入口、原键核实并继续保存。补两个真实客户端冲突对照，各自先取消原生确认，再分别采用服务器/保留此设备；另一客户端与刷新读回正确布局。supplement/results.json SH06-adopt-server/keep-local、s07/s08；原33/34。 |
| SH07 | 顶栏首页/日程切换，支持菜单每个去向，返回/刷新 | chrome/Topbar.jsx、SupportMenu.jsx、routes.js | 通过：支持菜单设置、帮助、更新日志各逐项点击→正确URL→刷新→首页返回。supplement/results.json SH07三项、s09-support-*；更新日志当前是源码明确的占位图，只验已有去向。首页/日程与手机支持→帮助见13-15/18。 |
| SH08 | 全局搜索：按钮/快捷键、中文/无结果、上下/Enter、Tab循环、Escape恢复/快速重开/导航 | chrome/TopbarSurfaces.jsx SearchModal、interaction/ModuleMotion.jsx | 通过已测序列：按钮打开自动聚焦、无结果、Escape回搜索按钮、下一Tab到通知；CtrlK、题库匹配、方向键/Enter导航；9次Tab仍在搜索弹层。证据06/07、manual-session.repl.txt。首尾循环的逐结果映射未单列断言。 |
| SH09 | 通知空态，已有提醒单条读未读/全部已读，返回日程对象与后退 | chrome/Notifications.jsx、TopbarSurfaces.jsx NotificationPanel、schedule/useNotifications.js | 通过：空态；真实2条提醒→单条读/未读→全部读→行尾打开对应任务→关闭→刷新仍读且原任务保留。证据notifications.json、28/29；真实认证、fake-mail、HTTP/SQLite、固定业务时间。 |
| SH10 | 通知真实拖动删除，垃圾桶确认取消/超时/完成，再继续输入与刷新 | chrome/TopbarSurfaces.jsx NotificationPanel | 通过：真实鼠标拖已读行到桶→Escape取消；重开拖桶等待3350ms取消；再拖确认删除→只少1条→刷新仍1条；390边界x58,width320。证据notifications.mjs/json、28-30。 |
| SH11 | 反馈三类型、空内容禁用，真实附件选择/重复添加/移除，关闭重开和本地记录 | chrome/TopbarSurfaces.jsx FeedbackPanel | 通过当前UI：四类型本地记录/回复、空发送禁用、选择展示/移除/重选、正文关闭重开。补浏览器真实ClipboardItem图片写入后Control+V，已有1张时选6文件只留总数5，再加忽略，移除后粘贴补足5。supplement/results.json SH11-clipboard-five-cap、s10。附件重开清空为批准的当前相同行为；实际收件暂缓。 |
| SH12 | 教程各项逐个切换、完成动画、Escape/关闭重开/刷新、减少动效 | chrome/TopbarSurfaces.jsx TutorialPanel、Celebration.jsx | 通过：四模块逐个完成→烟花与卡片→开始吧退出；撤销末项再完成；reduce无画布动画、完成卡仍可退出；刷新进度4/4。证据09、41、manual-session.repl.txt。 |
| SH13 | 隐私面板打开、切换其他浮层、Escape/外点；中英文/深浅色/窄屏 | chrome/TopbarSurfaces.jsx PrivacyPanel、presence.css | 发现 SW-SHELL-04；普通隐私浮层打开/Escape，中英浅深实际看图通过；中文390入口隐藏，英文三入口露出。证据10、42、46、chrome-responsive.json。 |
| SH14 | 学期切换/创建/编辑/复制来源/日期选择/取消，仅核对既有界面 | chrome/SidebarHead.jsx、ui/datetime.jsx | 既有模拟UI已核：新建甲、以甲为来源创建乙、重开编辑/刷新仍选甲、嵌套来源Escape回焦、取消保留。supplement/results.json SH14-copy-existing-cancel、s11。产品首击删除无确认为SW-SHELL-07，红脚本semester-delete.mjs/json；总控补确认取消/确认后刷新绿见root/shared-final.log。原型原有ConfirmMenuItem正确由总控核对，无需改。COPYABLE_ITEMS当前为空，不验或扩展真实复制/学期业务语义。 |
| SH15 | 题库→资源→日程跨三模块，AI覆盖右轨、保留草稿/业务筛选、收起恢复、刷新 | AuxiliaryPanel.jsx、WorkbenchApp.jsx、各模块右轨 | 通过代表性跨模块序列：资源开AI新建空对话填草稿，不发送→题库→日程保留→关AI恢复日程右轨→资源重开AI→刷新仍同草稿。证据16/18/19、manual-session.repl.txt。未以此代签数学/班级专有AI能力。 |
| SH16 | 共享Menu真实消费者：键盘打开、上下/Home/End、成功/取消、Tab/ShiftTab接续、快速重开 | ui/menu.jsx；agent历史、classroom菜单、math历史等 | 本线实走助理Menu方向键/Home/End/Escape/Tab，32。剩余ShiftTab、底部/窄屏完整菜单和实际二次删除由助理线controlled.log具名用例677本轮通过覆盖；异步改名拒绝→输入保留→原地重试成功→刷新由rename-results.json/rename.mjs覆盖。见下方复用表，不把整套controlled.log当全绿。 |
| SH17 | 共享Dialog真实消费者：自动焦点、Tab循环、Enter/IME属性、Escape/取消、连续重开与嵌套弹层 | ui/dialog.jsx；schedule/EntryEditor、resources/ResourceDialog、classroom/ui | 本线日程提醒/资源标签实际自动焦点、Tab输入、Escape、快速重开、成功保存见26/27。异步拒绝/原键重试和busy封闭由班级busy-final.log、retry-final.log具名消费者覆盖。输入法只复用日程事件属性保护证据，真实系统IME未验。27仅退出取帧，插值另见数学实际采样复用。 |
| SH18 | 共享Popover：视口边缘翻转、滚动锚点、外点/Escape、portal主题继承 | ui/popover.jsx；日期时间、筛选、菜单、数学控件 | 本线资源portal、日程日期/小时分钟指针、390通知边界及补390结束时间面板实际操作，timeBounds x189.3+129.4<390，s19。助理线实际底部/1440/820/390菜单12px边界及删除命中、数学线原生全屏portal均有本轮证据，详见复用表。补真实助理菜单打开期间鼠标滚轮父列表120px：anchor上移120，菜单由上方翻到下方且仍在视口12px内；supplement/popover-scroll.mjs/json、s20。 |
| SH19 | 多选筛选：全部/单个/多个、菜单不关闭、计数宽度、移除胶囊、继续Tab与重开 | ui/filter.jsx；questions/QuestionFinder、resources/Library、schedule/TaskBoard | 发现 SW-SHELL-02；资源多选不关、全部清除、选择后胶囊与单项移除实际操作；Escape后BODY、下一Tab到品牌。证据23、prototype-filter-escape-tab.png、resource-cancel.json。多选前后按钮均75px，移除PDF后仍选1项；见filter-width.json。 |
| SH20 | 日期：天→月→年→月→天、前后页、今天、边界、提交取消 | ui/datetime.jsx；schedule/CalendarControls、EntryEditor、workbench/SidebarHead | 通过：日程天→月→年→2026→10月→22日实际持久读回；补翻下月→今天完成回主编辑。supplement/results.json SH20-21、date-time-persisted.json。min/max由日程线keyboard-boundaries.log中1900-01-01/2100-12-31两条具名通过覆盖，包含禁用范围与前后月边界、Escape不改值。 |
| SH21 | 时间：真实指针选小时保留/分钟完成，滚动、Escape回焦、连续编辑保存 | ui/datetime.jsx；schedule/EntryEditor、classroom/Exams | 通过：开始09时保留/37分完成，HTTP读回09:37及45分钟。补390结束时间09时保留/13分完成→重开选中09:13→Escape回结束时间触发器→关闭刷新；s19、supplement/results.json SH20-21。无页面横越界；没有代签所有班级考试时间场景。 |
| SH22 | 就地确认：首击武装，Escape/外点/超时还原，二次完成，Tab继续 | ui/confirm.jsx；Sidebar、schedule标签、questions分类、resources | 通过已列实际分支：解散/资源标签首击武装、Escape撤武装、等待3300ms还原、二次完成；补分组解散武装后外点→重开普通解散且组保留。04、supplement/results.json SH03-outside。助理线390历史删除二次确认完成并刷新、分类删除等消费者另有真实证据，见复用表。补助理菜单删除武装→Tab关闭→重开已解除武装→刷新13条未删，supplement/popover-scroll.json SH22-armed-menu-Tab-cancel通过。 |
| SH23 | 确认对话框：取消、Escape、Tab循环、二次重开、完成后焦点和异步busy | ui/confirm.jsx；resources、math、classroom、questions | 本线共享资源彻底删除取消→立即Tab业务控件、Escape→快速重开→确认真删通过；资源自有Dialog退出问题已交资源线，现由resources/final-green.log三条取消/快速重开通过覆盖。共享嵌套确认由数学continuity-baseline实际取消回历史、历史下载阻止底层保存覆盖；异步等待由班级busy/retry实际消费者覆盖。见下方逐项路径。 |
| SH24 | Segmented高亮移动、尺寸/语言变化、快速切换、键盘与减少动效 | ui/segmented.jsx；schedule、resources、questions、classroom、math、settings | 本线资源缩略/列表、日历/任务、顶栏导航与语言切换实际通过。班级final-branches.log真实分段10帧普通透明度0→0.897，reduce两RAF为1，且分段往返/刷新由C04实证覆盖；数学motion-candidate实际展开采样另见复用。不是每个模块所有分段的笛卡尔组合。 |
| SH25 | Rail/Disclosure/Presence真实消费者：独立滚动、展开保留字段、关闭中间态inert、快速重开 | ui/rail.jsx、interaction/ModuleMotion.jsx；questions/resources/schedule/classroom/math | 本线三模块右轨/AI覆盖往返、日程/资源Dialog退出与快重开已测；补题库长期笔记未保存→折叠aria-expanded=false/inert→展开值保留→保存刷新→阅读笔记保留，s18、supplement/results.json SH25-disclosure。数学motion-candidate的真实展开/反向及资源三条退出接续补齐动效消费者证据；静态截图不代签曲线。 |
| SH26 | ScrollRestore/ForegroundRefresh：列表滚动→跨模块→返回→刷新；无外壳横向/纵向溢出 | interaction/useScrollRestore.js、useForegroundRefresh.js、styles/{base,kit,split,dialog,primitives}.css | 本线题库列表393现场恢复，47/scroll-restore.json；通用hook真实阅读区350→导航→刷新由题库final-branches-complete/receipt.json具名长阅读用例覆盖。补真实headed Chromium关闭PW焦点仿真后双标签切前台：外部改名读回、GET503保留旧列表、恢复后再切前台读回新名，实际focus4次，s17、supplement/results.json SH26-resource-foreground。不代签各模块特有冲突策略。 |
| SH27 | 1440/820/390，主题/语言与减少动效的相关组合；逐张亲眼检查布局与中间态 | chrome/chrome.css、presence.css、workbench.css、appearance.css | 发现03/04/06；已亲眼看本线1440/820/390及中文浅色/英文深色/相关reduce。候选reduce和稳定显隐由root/chrome-green.log两条定点绿，窄屏初引导由root/shared-final.log绿；原型新diff定点由本线supplement/prototype-final.json实际绿。布局取帧和动效中间态按具体证据解释，不宣称全组合像素通过。 |

## 共享组件的实际消费者反查

当前 import 反查覆盖：workbench 的 SettingsControls、AuxiliaryPanel、help/HelpCenter、chrome/Sidebar、TopbarSurfaces、NavigationStatus；agent/AgentWorkspace；schedule 的 index、TimeGrid、TaskBoard、ScheduleDialogs、EntryEditor、CalendarControls；questions 的 OriginalPane、QuestionFinder、QuestionControls、useQuestionSession、MaterialsQuestionsPage；resources 的 ResourceInfo、PageFind、Recognition、index、Taxonomy、ResourceDialog、Library；classroom 的 ui、charts、Students、Seating、Scores、Records、Import、ClassroomPage、Exams；math 的 WorkshopWorkspace、WorkHistory、web-ai/MathWebAssistant、LegacyWorkspace、HtmlEditor、useMathWorkSession、GraphTools、FormulaEditor、useMathConfirm、DynamicTools、WorkspaceControls、WorkspaceHome、index。源码 import 只是枚举线索，执行状态只由本轮用户路径证据决定。模块专有能力由所属工作线核查，本线核对共享行为及跨模块组合。

## 新发现与修复接续

本线确认7个独立根因，全部交总控实现。本线最初4条与补测3条分开保留红证据。总控候选的 `root/shared-final.log` 为5条真实连续回归全绿，含01解散成功回焦、02、05两种取消后成功与刷新、06窄屏可操作后回桌面关闭、07取消与确认后刷新；`root/chrome-green.log` 为03/04两条全绿。本线已读日志及相关共享源码，不重复整套。本线另亲自执行更新后原型定点，`supplement/prototype-final.json` 6个具名观察全部通过、脚本exit0。

| 编号 | 基线实际症状与分类 | 根因线索、红证据与候选 |
| --- | --- | --- |
| SW-SHELL-01 | 产品/原型：分组选项Escape后BODY，下一Tab离开侧栏；产品解散成功也丢焦。 | GroupMenu关闭和成功出口缺触发器/后续控件恢复。reproduce-shared.mjs、shared-findings.json、group-delete-focus.json；总控shared-final与本线prototype-final均绿。 |
| SW-SHELL-02 | 产品/原型：类型选项Escape后BODY，下一Tab到品牌。 | FilterMenu仅关闭Popover不恢复anchor。resource-cancel.mjs/json、双端filter图；总控shared-final与本线prototype-final均绿。 |
| SW-SHELL-03 | 产品独有：390/reduce开抽屉80ms仍处460ms过渡，原型transition none已完成。 | 产品缺原型全壳reduce规则。chrome-responsive.mjs/json、reduced-resize.json；总控chrome-green通过。 |
| SW-SHELL-04 | 产品/原型：390中文隐藏反馈/教程/隐私，英文全露出。 | media规则匹配中文aria-label。chrome-responsive.mjs/json；总控改稳定surface标记，chrome-green通过。 |
| SW-SHELL-05 | 产品真实拖到目标后移出导航松手或Escape仍提交旧落点。原型固定基线未再跑同红；当前更新后两种取消均实际绿。 | track无效命中早退保留targetRef，缺Escape取消。supplement/drag-cancel.mjs/json两条基线红；总控shared-final及本线prototype-final绿。 |
| SW-SHELL-06 | 产品/原型390新设备首次登录：教程及知道了隐藏，tb-coach-scrim仍全屏挡住点击。 | 窄屏只隐藏教程入口/卡片未隐藏coach容器。supplement/initial-coach.json、s14/s15；总控shared-final及本线prototype-final绿。 |
| SW-SHELL-07 | 产品既有模拟学期UI首击删除即移除，无取消确认。原型原有ConfirmMenuItem正确由总控确认。 | 产品菜单普通button直接remove，漏迁移统一二次确认。supplement/semester-delete.mjs/json、s12/s13；总控shared-final含取消/确认/刷新全绿。不扩学期语义。 |

资源归档自有ResourceDialog取消后立即Tab跳离、250ms正常，双端红已交资源唯一写者，不重复计数；资源线final-green.log三条实际消费者绿覆盖其修复。反馈关闭附件清空是总控明确的当前相同行为，不占编号、不新增buffer；实际收件仍暂缓。

## 共享剩余分支的本轮实证复用

下列均核对本轮产物及动作源码后复用，未继承上轮PASS。证据路径相对 `test-results/experience-completion/sweep/`。带失败的整套日志只引用具名已通过用例，不能据此宣称该套全绿。

| 本线分支 | 本轮真实消费者和实际序列 | 证据与读取结论 |
| --- | --- | --- |
| SH16 菜单ShiftTab/成功/底部与窄屏 | 助理13条历史：上下/Home/End、Escape回trigger、Tab到下一条、ShiftTab到原行；1440/820/390末行菜单完整命中；二次删除后刷新12条 | agent/controlled.log 用例677“历史底部会话菜单可完整点击，删除保留就地确认”具名通过。整套另1失败，不引用整套全绿。 |
| SH16 菜单异步失败重试 | 助理菜单重命名→80字上限→PATCH首次拒绝→输入和值保留→第二次成功→刷新标题仍在 | agent/rename-results.json `43-rename-failure-and-first-send` passed；rename.mjs实走动作。 |
| SH17/23 Dialog异步busy与重试 | 班级真实工作簿校对→确认等待，字段只读且Escape/遮罩不关闭→实际完成入口；503未提交和成功断响应分别原键重试 | classroom/busy-final.log 1 passed、retry-final.log 2 passed。只覆盖该实际导入消费者。 |
| SH18 全屏portal与边缘菜单 | 数学更多→课堂展示进入document.fullscreenElement→再开历史菜单可见→Escape→返回编辑退出全屏；助理末行菜单边界12px且删除命中 | math/reduced-results.json `fullscreen-menu` 双端passed，explore.mjs对应普通动作；agent/controlled.log具名用例677。已亲眼看数学全屏菜单图。 |
| SH18 打开后父滚动 | 本线真实助理13条历史，中部菜单打开→鼠标滚轮父列表120px→anchor上移120、菜单重新翻转且可达→Escape回焦 | shell/supplement/popover-scroll.mjs/json 两观察全绿、exit0，s20已亲眼看；未注入scrollTop或React状态。 |
| SH19 多选/底部标签浮层 | 资源PDF+图片多选，移动菜单、底部批量标签Popover选择后Escape，更多Escape回焦 | resources/dual-audit/dual-observations-4.json 双端L07/F05/S07/D04具名记录；本线filter-width.json另量75px稳定。 |
| SH20 日期端点 | 日程任务1900-01-01、2100-12-31真实打开日期Picker，可选日期不越界、相应前后月禁用、Escape保留原值 | schedule/keyboard-boundaries.log前两条具名通过；此日志另1失败，不引用其整套全绿。 |
| SH21 结束时间无效后的继续 | 日程无效结束值→关闭重开恢复旧值→编辑有效备注并保存 | schedule/final-branches.log G3对应具名通过；本线补390结束09:13与Escape回焦。 |
| SH22 就地确认实际成功 | 助理390历史菜单首击确认→二击删除→刷新；资源树删除二次确认 | agent/controlled.log用例677、resources/dual-audit/dual-observations-4.json F07；本线补分组武装后外点取消。 |
| SH23 嵌套共享ConfirmDialog | 数学历史恢复→顶层确认→取消回历史；历史下载确认独占Enter/Escape，不触发底层保存 | math/continuity-baseline/.last-run.json passed且failedTests=[]；对应两条具名目录，nested-confirm.png已亲眼看。 |
| SH17/23/25 自有资源Dialog退出 | 批量归档、历史、新建文件夹分别取消即归焦，保留退场，快速重开当前现场 | resources/final-green.log后三条具名通过；不把ResourceDialog等同共享Dialog。 |
| SH24 分段实际动效 | 班级记录/名单切换：普通10帧透明度0→0.897，reduce两RAF为1；多班/四分段往返刷新 | classroom/final-branches.log、supplement-final/result.json C04-C13与coverage C39。 |
| SH25 Disclosure/Presence实际中间态 | 数学参数/连接/算式连续开合，快速反向，末项可达；JS卸载受控时仍采CSS进度 | math/motion-candidate/.last-run.json passed，具名目录输入算式-close.json/-reverse.json等；motion-negative为故意红，不混作候选失败。另本线s18保留题库草稿。 |
| SH26 通用ScrollRestore | 题库长阅读真实滚轮350→导航→返回→刷新恢复 | questions/final-branches-complete/receipt.json `long-reader-scroll-navigation-refresh` top350且completed；与本线列表393分开记录。 |

## 上轮遗漏核对

独立27条清单落盘后才读上轮task-records/experience-audit/shared.md与root/account回执。补核原生全屏portal、分组本身排序/垃圾桶拖回、通用Disclosure和ForegroundRefresh等分支，实际来源见上表；没有继承任何上轮PASS。语言菜单的专有组合沿账户线，不因共同位于侧栏重复代签。源码导入反查仍有各业务模块的专用消费者，归所属工作线和总控最后交叉复核，不以本线代表消费者代签。

## 回执与边界

本线指定正常补测与共享证据核对已收口，详见 `test-results/experience-completion/sweep/shell/receipt.md`。27组是清单分组，不是27条测试全绿。仍未单独证明外壳FLIP每帧曲线、所有模块专有消费者及全部主题/语言/尺寸组合；这些不伪装为通过。真实触屏、硬件键盘与系统输入法、真实收件/模型不在证明范围。证据、临时实例与编码路径迁移归本线；失败现场保留，服务关闭状态按回执记录，整体任务通过后统一清理。
