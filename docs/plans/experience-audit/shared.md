# 外壳与公共交互对照

总控唯一维护；任务边界与计数沿[当前记录](../prototype-experience-audit.md)。对照固定基线及同版 `docs/design-system/teachbuddy-app/`；表中条件必须实际触发，源码一致只证明映射存在。证据归 `test-results/experience-audit/root/`。

原型源码前缀为 `ui/tbx/src/`，产品前缀为 `apps/web/src/`；外壳路径实际归 `features/workbench/`。底层原型入口以 `ui/app.js` 中具名函数定位。公共件的模块消费者由对应分区清单验收，总控核对共用根因与跨模块连续操作。

| ID | 原型 → 产品 | 条件与操作 | 结果 |
| --- | --- | --- | --- |
| SH01 | shell/Sidebar → workbench/chrome/Sidebar | 展开、收成图标栏、再展开；文字淡出和图标位置、中间态 | 通过：`second/comparison.json` 双端展开/收起/悬停提示，主区与侧栏边界一致；两次切换无错位。 |
| SH02 | 同上 | 折叠分组再展开，折叠态刷新保留，收起侧栏时分组不占空位 | 通过：`finish` 折叠与图标栏往返；`last-branches` 产品刷新保留折叠，原型内存行为按批准差异保留。 |
| SH03 | 同上 | 新建分组：空名、重名、未分组保留名、合法名、Enter、Escape、失焦 | 通过：`second` 空名/保留名/重名/Enter/Escape；`finish` 非空草稿失焦保留、取消后继续建组。 |
| SH04 | 同上 | 分组菜单重命名：合法/重复/空、提交/取消/失焦 | 通过：`second` 重名纠错与合法重命名；`finish` 空名保持编辑、Escape取消。 |
| SH05 | 同上 + kit/confirm | 解散第一次待确认、超时/Escape/点外取消、再次确认，成员归未分组 | 通过：`second` 超时、Escape、二次解散与成员转入未分组；`last-branches` 点外取消后重开。 |
| SH06 | 同上 | 真实指针拖模块，原位变淡/紧凑跟手/落点线，松手FLIP；组内/跨组/折叠组悬停 | 通过：`second` 跨组移动；`finish` 折叠组悬停展开；`last-branches` 拖回原位取消，ghost退出，次序不变。 |
| SH07 | 同上 | 分组拖排，取消拖动，移入垃圾桶、按钮恢复和拖回，收起侧栏点垃圾桶 | 通过：`finish` 分组排序、拖入垃圾桶、拖回空组和按钮恢复；`complement` 图标栏垃圾桶展开。直接指针采样须等待抽屉稳定，早期坐标未稳定失败不计bug。 |
| SH08 | 同上 | 模块Alt方向键、Delete/Backspace，未分组出现/消失，刷新读回 | 通过：`second/finish` Alt上下键、Delete/Backspace、恢复与未分组；`finish` 真实产品刷新读回布局。 |
| SH09 | shell/Sidebar → 同上 | 窄屏抽屉开关/遮罩关闭、首页日程支持导航、模块跳转关闭抽屉 | 通过：`second` 抽屉内模块导航收起；`finish` 390px遮罩收起及桌面恢复。 |
| SH10 | 底层SidebarHead → 同名 | 账户入口、语言菜单打开/选择/键盘/Escape与图标栏提示 | 通过：`second` 双端真实语言选择后整个外壳中英匹配；`complement` End/Home/Escape回焦；账户入口沿account清单。 |
| SH11 | 底层SidebarHead → 同名 | 学期现有页面、选择、创建编辑、复制空态、取消确认；仅UI无新业务 | 现有UI通过：`complement` 创建、复制来源空态、嵌套Escape、编辑保存；真实学期数据继续暂缓。 |
| SH12 | shell/Topbar → 同名 | 首页/日程/支持高亮滑动、支持hover/click/菜单选择/离开 | 通过：`second` 支持hover、帮助落点、回首页与高亮；日程跳转见`finish`。 |
| SH13 | 底层SearchModal → TopbarSurfaces | 全局搜索点击/快捷键、空输入/匹配/无结果、上下键/Enter、关闭后继续Tab | 通过：`second` 空/匹配/无结果、方向键/Enter/Escape；`complement` CtrlK、ShiftTab及归焦。产品焦点圈定按既有裁决保留。 |
| SH14 | 底层FeedbackPanel → 同名 | 四类型、草稿重开、附件添加/移除/粘贴、空禁用与本地确认页；不投递 | 现有UI通过及原型共有问题：`complement-final` 四类型回复、空禁用、草稿重开；两端文件选择均丢附件，登记buffer；`last-branches` 浏览器实际ClipboardItem粘贴/移除通过。收件暂缓。 |
| SH15 | 底层TutorialPanel/CoachMark → 同名 | 初次引导、点外/Escape/知道了关闭、逐个完成/撤销、刷新读回 | 通过：各运行首次引导关闭；`complement` 教程逐项、撤销及完成进度。真实刷新保留由现有catalog回归随CI复核。 |
| SH16 | shell/Celebration → 同名 | 最后教程完成烟花与卡片、退出/减少动效 | 通过：`second` 正常完成卡片/关闭；`complement` reduced-motion 下完成卡和可继续操作。 |
| SH17 | 底层PrivacyPanel → 同名 | 隐私浮层开关、切换到其他浮层、窄屏位置 | 通过：`second` 隐私开关、切教程与Escape；760px以下中文入口由原型及产品相同规则隐藏，断点截图见`second/finish`。 |
| SH18 | shell/AuxPanel → workbench/AuxiliaryPanel | 所有业务模块覆盖右栏，开关中间过程，跨模块带着打开状态往返 | 通过：`second` 各模块分别开关；`finish` 带打开状态跨日程/资源/题库/班级/数学往返。数学专属AI与实际模型能力按批准差异保留。 |
| SH19 | 同上及styles/shell/split → workbench.css/chrome.css/split.css | 1440/1150/1080/950/390相关断点、侧栏状态组合，主卡片/辅助栏宽度与滚动 | 通过：`second/finish` 1440/1150/1080/950/390，辅助栏开闭两组，主工作区/覆盖栏边界与原型一致、文档横向溢出为0。 |
| SH20 | kit/popover → components/ui/popover | 底部翻转、窗口边缘、滚动跟随、长内容滚动、点击外部/Escape关闭 | 已验证消费者见resources/questions/math/schedule；数学原生全屏下Portal归共享EA-shared-01，菜单/下载/历史/嵌套确认实际复验通过。 |
| SH21 | 原型各菜单 → components/ui/menu | 打开后方向键/首尾、选择/取消/Tab及反向Tab，文本框自己的键位 | 通过：`complement`语言菜单键位；math、questions菜单与日程事项候选覆盖。筛选菜单原型无方向键导航，资源线如实保留Tab路径，不扩大成新交互。 |
| SH22 | kit/filter → 同名 | 多选不关、全部清除、宽度稳定、胶囊清除 | 实际消费者见classroom EA01及resources批量标签；班级统计加载期间保留多选菜单，资源三态标签与清除通过。 |
| SH23 | kit/datetime → 同名 | 日期月/年逐级选择、小时不关分钟提交、取消/屏幕边界 | 日期月/年、小时/分钟、关闭等实际结果沿schedule/classroom清单；不以公共源码相同代替其消费场景。 |
| SH24 | kit/confirm → 同名 | 就地确认的等待/超时/取消/提交；对话框二次确认/输入/忙碌/键盘与归焦 | `second/last-branches`就地确认；资源确认框改回公共组件；math原生全屏嵌套确认及键盘回焦实跑通过。 |
| SH25 | 底层ModuleMotion及kit → components/interaction、ui/dialog | 弹层首帧模糊、关闭中间态/不可操作、快速重开、焦点接续 | schedule实测关闭80ms静止副本；questions连续弹窗及math嵌套弹窗实际对照。题库快速重开共有焦点缺陷单列buffer，未擅改原型。 |
| SH26 | kit/segmented、rail、motion → 同名 | 分段宽度与滑动，折叠箭头、列表拖放FLIP、辅助栏覆盖且页面不挤动 | 侧栏拖放/折叠沿`second/finish`；日程分段、资源轨道与aux实际消费者见各清单。 |
| SH27 | shell/glyphs、tokens/base → icons/styles | 同名图标、字号/色彩/焦点环，浅深色/英文长文案/减少动效 | `second/complement`中英浅深和减少动效；模块图标/控件/长文案以各线双端结果为证据。移除错误的英文静态词库疑点，实际两端都显示Resource library。 |
| SH28 | 原型即时模拟 → 实际导航/外观持久化 | 已批准真实保存、失败重试/冲突/未决入口；保持现有保护 | `finish/last-branches`真实导航与折叠刷新；账户偏好保存/冲突沿account。原型内存适配器不作为真实持久化证明。 |

## 已确认问题

| 编号 | 类别与触发 | 修复与证据 |
| --- | --- | --- |
| EA-shared-01 | 本轮恢复数学原生全屏后暴露的组合问题：菜单Portal仍在外壳，落在全屏层外，DOM存在但用户无法点击。不是基线既存复刻偏差。 | `components/ui/popover.jsx` 的宿主优先原生全屏元素；math/fullscreen-menu-red 证明失败，math/final-regression 与 native-confirm 证明菜单、下载、历史及嵌套确认可点、可退出、归焦正确。 |

root未另确认基线独立偏差。早期脚本的静态选择器、前置草稿、布局动画坐标、文本归一化错误均已修正，并在上述定点中重新实际操作，不计产品问题。反馈文件选择丢附件、其他分区提交的原型共有未决行为集中在根buffer。
