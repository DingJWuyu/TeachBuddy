# 日程独立体验覆盖

本线由 `sweep_schedule` 独占维护。首次产品与原型固定于 `ddc2f3d1c4e8299cbd36b821bac817e222d4e705`；产品只读基线构建为 `test-results/experience-completion/sweep-baseline-web`，原型为 4174。基线对照结束后，总控将 4174 更新为修后候选，仅按 SW02/SW03 定点复核；最终产品候选为本线 `candidate-confirm-web`。模型 `gpt-6.1-sol / xhigh`。真实认证、fake-mail、真实 HTTP/SQLite 与独立浏览器；不使用私人配置、50880 或收费模型。

首次清单从当前产品和原型源码独立展开，编写前未读取上轮覆盖清单。原型编辑器与看板分别在 `docs/design-system/teachbuddy-app/ui/tbx/src/schedule/{EntryEditor,TaskBoard}.jsx`；原型其余日历当前可执行源码在 `ui/app.js` 中 `CalendarMenu`、`MiniCalendar`、`MonthMore`、`TimeGrid`、`SchedulePage`。产品对应源码均在 `apps/web/src/features/schedule/`。以下每行均要求具体操作证据，源码阅读或既有套件名称不作为通过。

产物统一位于 `test-results/experience-completion/sweep/schedule/`；失败现场保留到整体任务成功。完整 CI、真实平板触控和系统输入法不由本线代签。

## 操作清单

| ID | 前置与具体操作序列 | 产品源码入口 | 预期和证据 | 状态 |
| --- | --- | --- | --- | --- |
| SC01 | 空账户从顶栏日程进入；浏览空网格、即将到来、待安排；新建空标题并关闭、刷新 | `index.jsx:SchedulePage/DailyTasks/create/closeEditor` | 空态可用且不产生空对象 | 通过：`navigation-result.json` / `proto-navigation-result.json`，真实空账户取消及产品刷新无对象 |
| SC02 | 日/周/月、多日 2/9、自定义 1/31 切换；前后段、今天；键盘 D/W/M/数字；自定义取消重开 | `CalendarControls.jsx:ViewMenu`、`index.jsx:changeView/navigate` | 日期范围正确、菜单归焦、连续操作不误触 | 通过：`navigation` 日周月、31天与无效输入/快捷键；`final-actions-result.json` 自定义1天；`keyboard-boundaries.log` 1900/2100日期端点 |
| SC03 | 小月历点选、跨周拖选、完整周/完整月、翻月与跨月选段；Escape 取消拖选 | `CalendarControls.jsx:MiniCalendar`、`index.jsx:onSelect` | 翻月不改主范围；拖选和取消正确 | 通过：`navigation` 跨周/跨月真实拖选、整周、翻月不改主范围与Escape；`final-actions-result.json` 完整月与反向选段 |
| SC04 | 网格单击空白、真实指针拖选、拖选中截图、Escape/松手；输入标题自动保存、刷新重开 | `TimeGrid.jsx:selectAllow/select`、`index.jsx:create` | 只有有效拖选创建；5 分钟吸附；取消不提交 | 通过：`gestures` 真实拖选/取消、5分钟吸附、命名保存；`gesture-targets` 补手势专项 |
| SC05 | 已有短任务从主体拖动、上下边缘拉伸、跨日拖放、跨午夜；Escape 后松手 | `TimeGrid.jsx:eventDrop/eventResize`、`index.jsx:moveEvent` | 实际时段保存；手势取消保留编辑器 | 通过：`gesture-targets.log` 短任务主体拖动、拉伸、边缘Escape；`final-actions-result.json` 主体水平跨日、真实HTTP钟点/时长读回；`coverage-gaps.log` 跨夜任务结束跨日保存。动态坐标前置错误单列，不计产品根因 |
| SC06 | 全天切换/恢复钟点，跨日全天拖动拉伸；全天和时间网格互拖 | `EntryEditor.jsx:toggleAllDay`、`TimeGrid.jsx` | 跨度、60 分钟落点规则与刷新一致 | 通过：`gesture-targets.log` 多日跨度及全天/时间互转规则真实保存 |
| SC07 | 月视图重叠/跨周长任务、更多弹层打开/再次点击/外部关闭，拖出弹层到别日；滚动到其他月再今天 | `TimeGrid.jsx:MonthMore/monthScroll` | 标题截断、日期背景和选中背景正确、拖动不打开编辑器 | 通过：`month-delete-result.json` 更多开关、露出日期拖动、滚动/今天；SW02基线相邻日期被遮挡，`month-adjacent-green.log` 4项通过，`prototype-final-result.json` 邻格/取消/原处定点通过 |
| SC08 | 标题、备注 Enter/Shift+Enter；日期、时间选择器精确分钟；无效结束时间后关闭重开 | `EntryEditor.jsx:Pill/confirmKey`、`calendarModel.js:changeEnd` | 有效字段保存，无效时间恢复，键盘接续有效 | 通过：`editing` 日期时间Picker、备注换行与Enter保存；`final-branches.log` G3无效结束恢复并保存有效备注；`keyboard-boundaries.log` 日期端点及composition属性边界 |
| SC09 | 待安排加号创建/空白取消；保存后安排时间；移回待安排确认取消/确认、再次安排 | `index.jsx:create/patchContent`、`EntryEditor.jsx:unschedule` | 时间提醒移除、内容保留、不恢复旧重复 | 通过：`editing-result.json` 无时间创建、排期、移回取消/确认与刷新 |
| SC10 | 逐项添加、Enter 连续添加、空白清理、完成/恢复、优先级、删除确认；完成后刷新 | `EntryEditor.jsx:Checklist` | 稳定事项 ID、完成样式与数量正确 | 通过：`editing` 添加/连续Enter/空白清理、完成与优先级、删除取消及读回 |
| SC11 | 真实小点拖动排序、中间跟手截图、Escape 取消；键盘上下排序并继续输入 | `EntryEditor.jsx:Checklist.startDrag` | 排序不误完成；焦点、ID、完成状态保留 | 通过：`editing` 真实小点排序中间态/Escape取消/键盘上下排序与Tab接续，ID和完成保留 |
| SC12 | 事项移到普通/待安排；移到重复模板/具体某次；取消/空结果、失败重试、刷新 | `CalendarItems.jsx:MoveItemDialog`、`index.jsx:startItemMove/moveItem` | 原子移动、目标时间提醒不变、ID/完成保留 | 通过：`editing` 普通待安排原子移动；`targeted-capabilities` 重复模板/单次；`final-branches.log` 目标与源版本冲突核对后继续、200事项容量说明 |
| SC13 | 标签选择/取消、创建、改名、颜色、删除确认；键盘导航和连续重开 | `EntryEditor.jsx:Labels`、`ScheduleDialogs.jsx:LabelDialog` | 标签更新即时显示、删除不删任务、焦点可继续 | 通过：`editing` 胶囊选中/创建/改名/颜色/删除、快速重开焦点；`keyboard-boundaries` Enter反复切换；`final-branches` 30标签上限。产品和原型均无搜索，按总控授权纠偏规格 |
| SC14 | 右栏列表/标签分组；任务看板三列、开关编辑器、五项截断、完成项、列筛选/空结果/清除/刷新 | `index.jsx:TaskSection`、`TaskBoard.jsx` | 分组独立；筛选与保存状态不混淆；动效无闪 | 通过：`visual-board` 与 `proto-visual-board` 三列/七事项/筛空清除/开关；SW-SCHEDULE-01连续完成修复另列 |
| SC15 | 每天/工作日/每周/双周/月日期/月星期/每年预设；自定义间隔/星期/结束日期/次数，无效次数取消重开 | `EntryEditor.jsx:REPEATS`、`ScheduleDialogs.jsx:RepeatDialog` | 摘要及日期定位对应规则，无效输入不提交 | 通过：`repeat-reminder` 六种快捷、日周月日期/月星期/年、次数与结束校验；`final-actions-result.json` 有效结束日期保存读回 |
| SC16 | 重复实例改内容后再编辑、移动事项、移回待安排；独立任务与后续实例刷新对照 | `index.jsx:flush/runWrite(detach)/applySaved` | 单次独立，后续系列不变，独立后只改自己 | 通过：`targeted-capabilities.log` 实例独立连续输入、提醒及移回待安排、后续系列保持 |
| SC17 | 普通删除第一次/取消/确认；系列只删一次/删全部；独立任务保留 | `EntryEditor.jsx:delete`、`index.jsx:remove/discardOrRemove` | 每次删除确认正确，无恢复入口或误删 | 通过：`month-delete-result.json` 普通删除Escape取消/二次确认、系列取消/只删一次/删全部，真实GET验证取消状态及404；删除全部与另一个已独立任务的隔离未另做复合操作 |
| SC18 | 提醒四种锚点、0 分钟/无效数字/关闭提醒、取消快速重开和 Enter/Escape | `CalendarDetails.jsx:ReminderDialog` | 摘要正确、当前浮层独占确认、关闭后归焦 | 通过：`repeat-reminder` 四锚点/0分钟/无效数字/关闭、左右键及快速重开；`targeted-capabilities` 实际淡出/归焦 |
| SC19 | 过去提醒保存拒绝，保留尝试时段；放弃/关闭提醒并保存；等待期间继续输入、再次拖动 | `index.jsx:reminderAttempt/discardReminderChange/saveWithoutReminder` | 明确未保存；选择后解除失败并继续操作 | 通过：`targeted-capabilities` 过去提醒放弃/遮罩不关闭/Escape、晚到新输入及关闭提醒保存 |
| SC20 | 到期通知打开、定位实际任务、跨模块往返；取消/删除/范围外目标只读 | `index.jsx:route effect/openEntry`、`useNotifications.js` | 深链接原始日期不误当实际日期；通知 chrome 发现交总控 | 部分通过：`targeted-capabilities` 原始日期定位实际改期、取消与范围外只读；`final-branches` 从通知地址删除返回/刷新；`coverage-gaps` 读取错误不污染后目标并重试。永久删除后再次点击同一旧通知未独立复合操作，通知chrome归总控 |
| SC21 | 列表读取失败保留内容并重试；任务打开失败后换目标；保存中继续输入、取消后迟到返回 | `index.jsx:reload/openEntry/perform` | 旧响应不覆盖现有现场，错误可恢复 | 通过：`recovery-result.json` 列表503保留旧内容/重试；`remaining-targets` 快速任务读取乱序；`view-during-save-green.log` 保存中跨日换视图并继续输入；`coverage-gaps` 迟到通知读取错误不覆盖新目标。取消后迟到返回未另做全组合 |
| SC22 | 响应丢失后刷新原键确认；版本冲突、读取最新、采用服务器内容取消/确认；长备注滚动后错误入口 | `index.jsx:flush/reloadConflict/adoptServer` | 保留本地草稿；显式确认后继续，错误置顶可达 | 通过：`remaining-targets.log` 未知结果原键确认/继续输入/刷新、冲突保留及显式保存；`recovery-result.json` 读取最新、比较、采用服务器内容取消/Enter确认及刷新 |
| SC23 | 切模块往返/刷新恢复视图、滚动、选段、任务草稿；AI 打开后日程编辑继续 | `index.jsx:useScene/shell.isPanelOpen` | 当前账户现场保留、容器收窄不遮控件 | 通过：`visual-board` 设置往返保留看板；`final-branches.log` 英文1100辅助栏容器换行、11天选段及AI草稿保留；`coverage-gaps.log` 看板列滚动切模块/刷新恢复 |
| SC24 | 1440 与 390 宽度、辅助栏容器；中文浅色/英文深色；长标题/标签/备注/末尾事项 | `schedule.css`、`presentation.css`、`TaskBoard.jsx` | 无页面横向溢出，菜单/弹窗/编辑器可滚动可操作 | 通过：`visual-board` / `proto-visual-board` 中文浅色1440、英文深色390、长内容；`final-branches` 辅助栏容器；`narrow-stable-result.json` 复用原账户场景、等待入场完成后目视390看板/日历/侧栏，实际横滚到待安排列，主要控件可达且页面无横向溢出 |
| SC25 | 分段切换、编辑器进入/退出、提醒浮层关闭过程截图；快速反向/快速重开；reduced-motion | `TaskBoard.jsx:FocusToggle`、`EntryEditor.jsx:close`、公共 Presence 消费 | 捕获实际动效中间态；减少动效条件下操作完整 | 通过：`targeted-capabilities` / `coverage-gaps` 提醒实际淡出插值中间图、Escape归焦及快速反向；`recovery-result.json` reduced-motion下任务/日历切换及编辑器开关；稳定态补图与中间态证据分开 |
| SC26 | 系统时区、当前时间线跨分钟；已有任务/待安排/重复例外在系统时区变化后重新读取 | `index.jsx:synchronizeTimeZone`、`zoned.js` | 当地钟点/时长保存，提醒与通知按契约；目标系统变化边界说明 | 浏览器受控条件通过：`remaining-targets.log` 15秒检测、分钟边界、秒数和时区标识；`coverage-gaps.log` 同步后全天真实拖动/拉伸及纽约DST实际分钟。真实OS时区切换与真实设备未验 |

## 新发现

| ID | 分类与症状 | 根因、修复与证据 |
| --- | --- | --- |
| SW-SCHEDULE-01 | 基线缺陷：看板事项完成等待期间再恢复或操作另一事项，后写操作被回滚并丢失 | 页面保存的 pending 状态拒绝后续点击，刷新又无后写现场。`index.jsx` 用账户现场 `boardChanges` 顺序接续，原请求回执确认后移除已确认项并把重复实例的新ID交给后续点击；`TaskBoard.jsx` 保留未完成的乐观状态。基线 `board-behavior-red/` 两项具名红，原型 `proto-board-race-result.json` 通过；候选 `board-final-regression.log` 七项通过，包含另一任务、重复只独立一次、编辑器共用flight、刷新原键接续。 |
| SW-SCHEDULE-02 | 基线缺陷：月更多浮层遮住相邻日期，正常拖动无法改到邻日 | `MonthMore` 仅在真实外部拖动开始时隐藏浮层，保留源DOM，让日期参与命中；结束/取消恢复。产品与原型均红：`month-adjacent-red.log`、`proto-month-block-result.json`；产品普通时间段/跨日全天/重复及Escape/原处4项通过，修后原型邻格/取消/原处通过。原型同步段在 `prototype-patches.json`，总控已生成。 |
| SW-SCHEDULE-03 | 基线缺陷：共享确认将聚焦取消按钮的Enter解释为取消，违反既有日程特规 | 总控在共享Confirm增加可选 `enterConfirms`，仅日程移回待安排/重复删除两个消费者显式启用，保留各模块默认行为。`confirm-keyboard-baseline.log` 基线红；`confirm-keyboard-green.log` default/取消2项通过，修后原型对应2项通过。未改规格或放宽测试。 |

本轮开发中发现的刷新接续缺口及已打开编辑器的即时显示回退，均在同一修复冻结前修正，证据 `board-refresh-red/`、`board-editor-red/`；不另计基线根因。已有跨日保存用例仍点击编辑器已替换的小月历，是测试缺陷；改为日视图工具栏“下一段”并明确核对次日，`view-during-save-green.log` 通过。

## 上轮覆盖查漏

首次独立清单建立后已读取上轮36组清单，仅补入日期端点、标签30/事项200容量、迟到打开错误、输入法与真实设备边界；没有继承上轮PASS。本轮不重复退役标签搜索，也不恢复旧范围选择入口。

## 证据判读与边界

- 本线确认3个基线根因，均已有实际基线红、定点修后绿与相应原型结论。`board-red/` 最初fixture符号未定义、一次性脚本选择器/过早读取、动态元素入场期间取坐标均是验证前置错误，不能算产品根因或用来放宽断言。
- `gestures-result.json` 整组仍为FAIL，不能称整组通过；SC04通过，SC05由后续具名手势及最终真实读回补齐。`remaining-targets.log` 为7通过加1测试缺陷，后者修复后单独通过；`keyboard-boundaries.log` 为5通过加SW03失败，SW03在最终候选单独2通过。
- `final-actions` 初次取坐标后任务仍在CSS入场，曾保存09:55；等待有限入场结束后，同一正常手势保存10:00且时长不变。按总控裁决记录为动态坐标前置不足，不新增根因、不修改产品或扩套件。
- 390稳定态主控件、内部横滚与侧栏已补证，最初即时切换截图只作为动作中间态。真实平板/手机触控、读屏器和系统IME未验；composition测试仅验证合成属性边界。系统时区使用浏览器context和受控检测，未执行真实操作系统时区切换。
- 原型假后端仅作行为/视觉对照，不替代产品真实HTTP/SQLite持久化结论。基线原型对照已结束；4174后续为总控生成的修后候选。
- 全目录回归、CI、跨模块chrome及最终整合候选由总控承担。本线仅定点验证，无Git写操作。源/构建指纹、测试分阶段结果及具名临时现场见本线 `receipt.md`。
