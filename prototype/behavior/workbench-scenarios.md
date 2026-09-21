# 工作台场景覆盖

Status: Accepted (旧外壳基线；当前模块稿需重新核对受影响场景)

本索引保留此前外壳验收的场景与证据。加入 Agent 首页、六模块及真实形态的日程通知交互后，空首页、九模块和固定通知等前提已经改变，下文“通过”只描述原报告，不能作为当前模块稿或 MVP 的通过结果。当前模块覆盖及限制见 [modules.md](modules.md)，账户恢复规则见 [auth.md](auth.md)。

本文件拥有 CW01-CW46 与 CW52 的场景与证据索引；CW48-CW51 由[头部场景覆盖](sidebar-head-scenarios.md)索引。行为定义由各节链接的文档拥有。

## 复现与验证

从 [manifest](manifest.md) 启动原型。每个场景使用独立浏览器上下文，以默认布局和示例账户登录开始；除 CW12 外关闭首次引导。完整操作、样例数据和逐步断言见 [capture-workbench.mjs](../verification/capture-workbench.mjs)。

先核对脚本场景是否仍适用，再使用 `node prototype/verification/capture-workbench.mjs --only=CW27,CW31` 等方式选择场景；不把旧全量断言直接作为当前版本门禁。输出配置见 manifest。截图在断言目标状态后采集，检查横向溢出及弹层边界，再做视觉检查。静态截图不证明动画、焦点或持久性，这些由脚本中的交互断言验证。

客户端跳转不退出登录。刷新和直接加载深链是否恢复身份，以当前账户行为中“记住我”及会话状态为准，旧脚本的内存会话前提需要核对。刷新不会清除布局或标签页引导标记；重置场景须使用新的浏览器上下文，或清除原型站点存储后重新进入。

[旧外壳场景结果](../evidence/verification/workbench.json)：46 个场景 × 3 类视口，共 138 行。原报告记录 132 行通过，6 行因布局没有对应入口而不适用，314 张截图。表中每个“通过”对应结果文件内相同场景 ID 与视口的当时断言，本轮未重新运行或替换这些证据。

## 验证边界

- PC 1440×900、平板 768×1024、手机 390×844 是浏览器视口尺寸。操作使用浏览器鼠标、键盘与合成 HTML 拖放，不代表真机触控通过。
- 拖拽截图分别展示开始、目标高亮、取消或落下后的状态。合成事件验证落点和清理，不证明真实指针轨迹、原生光标或触屏拖放。分组长按的真机手势尚未实测。
- 首页与目的页面的设计范围见[外壳](shell.md#scope)和[导航](navigation.md)。账户与服务模拟范围见[账户入口](auth.md)，未实现的服务分支不计为通过。

## 交互与几何检查

以下是此前检查报告，补充同一旧基线的场景矩阵。重新验证时需要核对当前行为，不能沿用这里的计数作为新版本结论。

| 脚本 | 原报告结果 | 覆盖 |
| --- | --- | --- |
| [verify-topbar](../verification/verify-topbar.mjs) | [108/108](../evidence/verification/verify-topbar.txt) | 顶栏、互斥、通知、反馈、教程、隐私、引导与庆祝 |
| [verify-hidden-page-redirect](../verification/verify-hidden-page-redirect.mjs) | [64/64](../evidence/verification/verify-hidden-page-redirect.txt) | 当前页隐藏、分组删除、持久化隐藏成员归一化、空分组与拖拽图 |
| [verify-navigation-notifications-feedback](../verification/verify-navigation-notifications-feedback.mjs) | [63/63](../evidence/verification/verify-navigation-notifications-feedback.txt) | 导航、通知已读与删除、反馈致谢、垃圾桶识别 |
| [verify-flash-chip-collapse-persistence](../verification/verify-flash-chip-collapse-persistence.mjs) | [71/71](../evidence/verification/verify-flash-chip-collapse-persistence.txt) | 不重载、拖拽图、落点、折叠时序与布局持久化 |
| [verify-visual](../verification/verify-visual.mjs) | [50/50](../evidence/verification/verify-visual.txt) | 展开态、窄轨几何与溢出 |
| [verify-ui-review](../verification/verify-ui-review.mjs) | [31/31](../evidence/verification/verify-ui-review.txt) | 控件、间距、垃圾桶与新建分组 |
| [verify-regression](../verification/verify-regression.mjs) | [13/13](../evidence/verification/verify-regression.txt) | 无障碍命名、隐藏恢复、手机抽屉与溢出 |
| [verify-drag](../verification/verify-drag.mjs) | [6/6](../evidence/verification/verify-drag.txt) | 合成拖放落点与插入线 |
| [verify-integration](../verification/verify-integration.mjs) | [9/9](../evidence/verification/verify-integration.txt) | 真实链接、未知路由、布局回退、手机面板、名称提示与减少动态效果 |

账户入口的三端场景、截图及验证结果见[账户场景覆盖](auth-scenarios.md)。

## 外壳

行为定义：[外壳](shell.md)。

| 场景 | 条件、动作与预期 | 视口 | 当前视觉状态 | 验证 |
| --- | --- | --- | --- | --- |
| CW01 | 登录后关闭引导，查看默认外壳 | PC 1440×900 | [默认](../evidence/screenshots/workbench/shell/PC-CW01-default.png) | 通过 |
| CW01 | 登录后关闭引导，查看默认外壳 | 平板 768×1024 | [默认](../evidence/screenshots/workbench/shell/平板-CW01-default.png) | 通过 |
| CW01 | 登录后关闭引导，查看默认外壳 | 手机 390×844 | [默认](../evidence/screenshots/workbench/shell/手机-CW01-default.png) | 通过 |
| CW02 | 悬停顶栏，收起侧栏，再展开 | PC 1440×900 | [窄轨](../evidence/screenshots/workbench/shell/PC-CW02-rail.png) · [已展开](../evidence/screenshots/workbench/shell/PC-CW02-expanded.png) | 通过 |
| CW02 | 悬停顶栏，收起侧栏，再展开 | 平板 768×1024 | [窄轨](../evidence/screenshots/workbench/shell/平板-CW02-rail.png) · [已展开](../evidence/screenshots/workbench/shell/平板-CW02-expanded.png) | 通过 |
| CW02 | 悬停顶栏，收起侧栏，再展开 | 手机 390×844 | 手机使用抽屉，无桌面窄轨或顶栏导航悬停入口 | 布局不适用，不计通过 |
| CW03 | 悬停侧栏收起键 | PC 1440×900 | [悬停](../evidence/screenshots/workbench/shell/PC-CW03-hover.png) | 通过 |
| CW03 | 悬停侧栏收起键 | 平板 768×1024 | [悬停](../evidence/screenshots/workbench/shell/平板-CW03-hover.png) | 通过 |
| CW03 | 悬停侧栏收起键 | 手机 390×844 | 手机使用抽屉，无桌面窄轨或顶栏导航悬停入口 | 布局不适用，不计通过 |
| CW04 | 收起侧栏，悬停及聚焦第二个模块，名称完整可见 | PC 1440×900 | [悬停](../evidence/screenshots/workbench/shell/PC-CW04-hover.png) · [焦点](../evidence/screenshots/workbench/shell/PC-CW04-focus.png) | 通过 |
| CW04 | 收起侧栏，悬停及聚焦第二个模块，名称完整可见 | 平板 768×1024 | [悬停](../evidence/screenshots/workbench/shell/平板-CW04-hover.png) · [焦点](../evidence/screenshots/workbench/shell/平板-CW04-focus.png) | 通过 |
| CW04 | 收起侧栏，悬停及聚焦第二个模块，名称完整可见 | 手机 390×844 | 手机使用抽屉，无桌面窄轨或顶栏导航悬停入口 | 布局不适用，不计通过 |
| CW14 | 手机打开抽屉，Escape 关闭 | PC 1440×900 | 宽屏使用常驻侧栏，无手机抽屉 | 布局不适用，不计通过 |
| CW14 | 手机打开抽屉，Escape 关闭 | 平板 768×1024 | 宽屏使用常驻侧栏，无手机抽屉 | 布局不适用，不计通过 |
| CW14 | 手机打开抽屉，Escape 关闭 | 手机 390×844 | [抽屉](../evidence/screenshots/workbench/shell/手机-CW14-drawer.png) · [已关闭](../evidence/screenshots/workbench/shell/手机-CW14-closed.png) | 通过 |
| CW38 | 面板互斥、Escape 焦点恢复、外部点击关闭 | PC 1440×900 | [切换面板](../evidence/screenshots/workbench/shell/PC-CW38-switched.png) · [焦点](../evidence/screenshots/workbench/shell/PC-CW38-focus.png) · [外部点击关闭](../evidence/screenshots/workbench/shell/PC-CW38-outside.png) | 通过 |
| CW38 | 面板互斥、Escape 焦点恢复、外部点击关闭 | 平板 768×1024 | [切换面板](../evidence/screenshots/workbench/shell/平板-CW38-switched.png) · [焦点](../evidence/screenshots/workbench/shell/平板-CW38-focus.png) · [外部点击关闭](../evidence/screenshots/workbench/shell/平板-CW38-outside.png) | 通过 |
| CW38 | 面板互斥、Escape 焦点恢复、外部点击关闭 | 手机 390×844 | [切换面板](../evidence/screenshots/workbench/shell/手机-CW38-switched.png) · [焦点](../evidence/screenshots/workbench/shell/手机-CW38-focus.png) · [外部点击关闭](../evidence/screenshots/workbench/shell/手机-CW38-outside.png) | 通过 |
| CW39 | 减少动态效果时面板与折叠直接到终态 | PC 1440×900 | [面板](../evidence/screenshots/workbench/shell/PC-CW39-panel.png) · [已折叠](../evidence/screenshots/workbench/shell/PC-CW39-collapsed.png) | 通过 |
| CW39 | 减少动态效果时面板与折叠直接到终态 | 平板 768×1024 | [面板](../evidence/screenshots/workbench/shell/平板-CW39-panel.png) · [已折叠](../evidence/screenshots/workbench/shell/平板-CW39-collapsed.png) | 通过 |
| CW39 | 减少动态效果时面板与折叠直接到终态 | 手机 390×844 | [面板](../evidence/screenshots/workbench/shell/手机-CW39-panel.png) · [已折叠](../evidence/screenshots/workbench/shell/手机-CW39-collapsed.png) | 通过 |

## 导航

行为定义：[导航](navigation.md)。

| 场景 | 条件、动作与预期 | 视口 | 当前视觉状态 | 验证 |
| --- | --- | --- | --- | --- |
| CW05 | 悬停顶栏日历入口 | PC 1440×900 | [悬停](../evidence/screenshots/workbench/navigation/PC-CW05-hover.png) | 通过 |
| CW05 | 悬停顶栏日历入口 | 平板 768×1024 | [悬停](../evidence/screenshots/workbench/navigation/平板-CW05-hover.png) | 通过 |
| CW05 | 悬停顶栏日历入口 | 手机 390×844 | 手机使用抽屉，无桌面窄轨或顶栏导航悬停入口 | 布局不适用，不计通过 |
| CW06 | 打开支持菜单或手机抽屉中的支持条目 | PC 1440×900 | [已打开](../evidence/screenshots/workbench/navigation/PC-CW06-open.png) | 通过 |
| CW06 | 打开支持菜单或手机抽屉中的支持条目 | 平板 768×1024 | [已打开](../evidence/screenshots/workbench/navigation/平板-CW06-open.png) | 通过 |
| CW06 | 打开支持菜单或手机抽屉中的支持条目 | 手机 390×844 | [已打开](../evidence/screenshots/workbench/navigation/手机-CW06-open.png) | 通过 |
| CW07 | 打开搜索，保留空查询 | PC 1440×900 | [已打开](../evidence/screenshots/workbench/navigation/PC-CW07-open.png) | 通过 |
| CW07 | 打开搜索，保留空查询 | 平板 768×1024 | [已打开](../evidence/screenshots/workbench/navigation/平板-CW07-open.png) | 通过 |
| CW07 | 打开搜索，保留空查询 | 手机 390×844 | [已打开](../evidence/screenshots/workbench/navigation/手机-CW07-open.png) | 通过 |
| CW19 | 日历、后退首页、前进日历 | PC 1440×900 | [日历](../evidence/screenshots/workbench/navigation/PC-CW19-calendar.png) · [后退首页](../evidence/screenshots/workbench/navigation/PC-CW19-back.png) · [前进日历](../evidence/screenshots/workbench/navigation/PC-CW19-forward.png) | 通过 |
| CW19 | 日历、后退首页、前进日历 | 平板 768×1024 | [日历](../evidence/screenshots/workbench/navigation/平板-CW19-calendar.png) · [后退首页](../evidence/screenshots/workbench/navigation/平板-CW19-back.png) · [前进日历](../evidence/screenshots/workbench/navigation/平板-CW19-forward.png) | 通过 |
| CW19 | 日历、后退首页、前进日历 | 手机 390×844 | [日历](../evidence/screenshots/workbench/navigation/手机-CW19-calendar.png) · [后退首页](../evidence/screenshots/workbench/navigation/手机-CW19-back.png) · [前进日历](../evidence/screenshots/workbench/navigation/手机-CW19-forward.png) | 通过 |
| CW20 | 从模块行进入我的班级页 | PC 1440×900 | [模块页面](../evidence/screenshots/workbench/navigation/PC-CW20-module.png) | 通过 |
| CW20 | 从模块行进入我的班级页 | 平板 768×1024 | [模块页面](../evidence/screenshots/workbench/navigation/平板-CW20-module.png) | 通过 |
| CW20 | 从模块行进入我的班级页 | 手机 390×844 | [模块页面](../evidence/screenshots/workbench/navigation/手机-CW20-module.png) | 通过 |
| CW35 | 搜索无匹配、改为有效查询、键盘进入结果 | PC 1440×900 | [空状态](../evidence/screenshots/workbench/navigation/PC-CW35-empty.png) · [搜索结果](../evidence/screenshots/workbench/navigation/PC-CW35-results.png) · [目的页面](../evidence/screenshots/workbench/navigation/PC-CW35-destination.png) | 通过 |
| CW35 | 搜索无匹配、改为有效查询、键盘进入结果 | 平板 768×1024 | [空状态](../evidence/screenshots/workbench/navigation/平板-CW35-empty.png) · [搜索结果](../evidence/screenshots/workbench/navigation/平板-CW35-results.png) · [目的页面](../evidence/screenshots/workbench/navigation/平板-CW35-destination.png) | 通过 |
| CW35 | 搜索无匹配、改为有效查询、键盘进入结果 | 手机 390×844 | [空状态](../evidence/screenshots/workbench/navigation/手机-CW35-empty.png) · [搜索结果](../evidence/screenshots/workbench/navigation/手机-CW35-results.png) · [目的页面](../evidence/screenshots/workbench/navigation/手机-CW35-destination.png) | 通过 |
| CW36 | 未知地址保留路径并显示不存在页面 | PC 1440×900 | [未知路径](../evidence/screenshots/workbench/navigation/PC-CW36-unknown.png) · [未知模块](../evidence/screenshots/workbench/navigation/PC-CW36-unknown-module.png) | 通过 |
| CW36 | 未知地址保留路径并显示不存在页面 | 平板 768×1024 | [未知路径](../evidence/screenshots/workbench/navigation/平板-CW36-unknown.png) · [未知模块](../evidence/screenshots/workbench/navigation/平板-CW36-unknown-module.png) | 通过 |
| CW36 | 未知地址保留路径并显示不存在页面 | 手机 390×844 | [未知路径](../evidence/screenshots/workbench/navigation/手机-CW36-unknown.png) · [未知模块](../evidence/screenshots/workbench/navigation/手机-CW36-unknown-module.png) | 通过 |
| CW44 | 支持菜单三个目的地均可到达，导航关闭菜单 | PC 1440×900 | [设置](../evidence/screenshots/workbench/navigation/PC-CW44-settings.png) · [帮助](../evidence/screenshots/workbench/navigation/PC-CW44-help.png) · [更新日志](../evidence/screenshots/workbench/navigation/PC-CW44-changelog.png) | 通过 |
| CW44 | 支持菜单三个目的地均可到达，导航关闭菜单 | 平板 768×1024 | [设置](../evidence/screenshots/workbench/navigation/平板-CW44-settings.png) · [帮助](../evidence/screenshots/workbench/navigation/平板-CW44-help.png) · [更新日志](../evidence/screenshots/workbench/navigation/平板-CW44-changelog.png) | 通过 |
| CW44 | 支持菜单三个目的地均可到达，导航关闭菜单 | 手机 390×844 | [设置](../evidence/screenshots/workbench/navigation/手机-CW44-settings.png) · [帮助](../evidence/screenshots/workbench/navigation/手机-CW44-help.png) · [更新日志](../evidence/screenshots/workbench/navigation/手机-CW44-changelog.png) | 通过 |
| CW46 | 搜索快捷键打开与关闭、方向键循环及无匹配 Enter 保持 | PC 1440×900 | [已打开](../evidence/screenshots/workbench/navigation/PC-CW46-open.png) · [循环到末项](../evidence/screenshots/workbench/navigation/PC-CW46-last.png) · [循环到首项](../evidence/screenshots/workbench/navigation/PC-CW46-first.png) · [空状态](../evidence/screenshots/workbench/navigation/PC-CW46-empty.png) · [已关闭](../evidence/screenshots/workbench/navigation/PC-CW46-closed.png) | 通过 |
| CW46 | 搜索快捷键打开与关闭、方向键循环及无匹配 Enter 保持 | 平板 768×1024 | [已打开](../evidence/screenshots/workbench/navigation/平板-CW46-open.png) · [循环到末项](../evidence/screenshots/workbench/navigation/平板-CW46-last.png) · [循环到首项](../evidence/screenshots/workbench/navigation/平板-CW46-first.png) · [空状态](../evidence/screenshots/workbench/navigation/平板-CW46-empty.png) · [已关闭](../evidence/screenshots/workbench/navigation/平板-CW46-closed.png) | 通过 |
| CW46 | 搜索快捷键打开与关闭、方向键循环及无匹配 Enter 保持 | 手机 390×844 | [已打开](../evidence/screenshots/workbench/navigation/手机-CW46-open.png) · [循环到末项](../evidence/screenshots/workbench/navigation/手机-CW46-last.png) · [循环到首项](../evidence/screenshots/workbench/navigation/手机-CW46-first.png) · [空状态](../evidence/screenshots/workbench/navigation/手机-CW46-empty.png) · [已关闭](../evidence/screenshots/workbench/navigation/手机-CW46-closed.png) | 通过 |
| CW52 | 首页正文是与其他目的页面相同的空占位，只有图标与标题 | PC 1440×900 | [首页](../evidence/screenshots/workbench/sidebar-head/PC-CW52-home-empty.png) | 通过 |

## 侧栏

行为定义：[侧栏](sidebar.md)。

| 场景 | 条件、动作与预期 | 视口 | 当前视觉状态 | 验证 |
| --- | --- | --- | --- | --- |
| CW15 | Delete 隐藏模块，打开垃圾桶，恢复到未分组 | PC 1440×900 | [已隐藏](../evidence/screenshots/workbench/sidebar/PC-CW15-hidden.png) · [已恢复](../evidence/screenshots/workbench/sidebar/PC-CW15-restored.png) | 通过 |
| CW15 | Delete 隐藏模块，打开垃圾桶，恢复到未分组 | 平板 768×1024 | [已隐藏](../evidence/screenshots/workbench/sidebar/平板-CW15-hidden.png) · [已恢复](../evidence/screenshots/workbench/sidebar/平板-CW15-restored.png) | 通过 |
| CW15 | Delete 隐藏模块，打开垃圾桶，恢复到未分组 | 手机 390×844 | [已隐藏](../evidence/screenshots/workbench/sidebar/手机-CW15-hidden.png) · [已恢复](../evidence/screenshots/workbench/sidebar/手机-CW15-restored.png) | 通过 |
| CW16 | 新建分组空值、填写、取消、重新打开并提交 | PC 1440×900 | [空状态](../evidence/screenshots/workbench/sidebar/PC-CW16-empty.png) · [已填写／填入](../evidence/screenshots/workbench/sidebar/PC-CW16-filled.png) · [已创建](../evidence/screenshots/workbench/sidebar/PC-CW16-created.png) | 通过 |
| CW16 | 新建分组空值、填写、取消、重新打开并提交 | 平板 768×1024 | [空状态](../evidence/screenshots/workbench/sidebar/平板-CW16-empty.png) · [已填写／填入](../evidence/screenshots/workbench/sidebar/平板-CW16-filled.png) · [已创建](../evidence/screenshots/workbench/sidebar/平板-CW16-created.png) | 通过 |
| CW16 | 新建分组空值、填写、取消、重新打开并提交 | 手机 390×844 | [空状态](../evidence/screenshots/workbench/sidebar/手机-CW16-empty.png) · [已填写／填入](../evidence/screenshots/workbench/sidebar/手机-CW16-filled.png) · [已创建](../evidence/screenshots/workbench/sidebar/手机-CW16-created.png) | 通过 |
| CW17 | 模块拖到另一分组首行，插入线与落点一致 | PC 1440×900 | [目标高亮](../evidence/screenshots/workbench/sidebar/PC-CW17-target.png) · [落下后](../evidence/screenshots/workbench/sidebar/PC-CW17-dropped.png) | 通过 |
| CW17 | 模块拖到另一分组首行，插入线与落点一致 | 平板 768×1024 | [目标高亮](../evidence/screenshots/workbench/sidebar/平板-CW17-target.png) · [落下后](../evidence/screenshots/workbench/sidebar/平板-CW17-dropped.png) | 通过 |
| CW17 | 模块拖到另一分组首行，插入线与落点一致 | 手机 390×844 | [目标高亮](../evidence/screenshots/workbench/sidebar/手机-CW17-target.png) · [落下后](../evidence/screenshots/workbench/sidebar/手机-CW17-dropped.png) | 通过 |
| CW23 | 模块拖拽图居中，取消后清理 | PC 1440×900 | [拖拽图](../evidence/screenshots/workbench/sidebar/PC-CW23-chip.png) · [已取消](../evidence/screenshots/workbench/sidebar/PC-CW23-cancelled.png) | 通过 |
| CW23 | 模块拖拽图居中，取消后清理 | 平板 768×1024 | [拖拽图](../evidence/screenshots/workbench/sidebar/平板-CW23-chip.png) · [已取消](../evidence/screenshots/workbench/sidebar/平板-CW23-cancelled.png) | 通过 |
| CW23 | 模块拖拽图居中，取消后清理 | 手机 390×844 | [拖拽图](../evidence/screenshots/workbench/sidebar/手机-CW23-chip.png) · [已取消](../evidence/screenshots/workbench/sidebar/手机-CW23-cancelled.png) | 通过 |
| CW24 | 分组拖拽图使用文件夹，取消后清理 | PC 1440×900 | [拖拽图](../evidence/screenshots/workbench/sidebar/PC-CW24-chip.png) · [已取消](../evidence/screenshots/workbench/sidebar/PC-CW24-cancelled.png) | 通过 |
| CW24 | 分组拖拽图使用文件夹，取消后清理 | 平板 768×1024 | [拖拽图](../evidence/screenshots/workbench/sidebar/平板-CW24-chip.png) · [已取消](../evidence/screenshots/workbench/sidebar/平板-CW24-cancelled.png) | 通过 |
| CW24 | 分组拖拽图使用文件夹，取消后清理 | 手机 390×844 | [拖拽图](../evidence/screenshots/workbench/sidebar/手机-CW24-chip.png) · [已取消](../evidence/screenshots/workbench/sidebar/手机-CW24-cancelled.png) | 通过 |
| CW25 | 模块拖入垃圾桶，取消保持，重新拖入隐藏 | PC 1440×900 | [目标高亮](../evidence/screenshots/workbench/sidebar/PC-CW25-target.png) · [已取消](../evidence/screenshots/workbench/sidebar/PC-CW25-cancelled.png) · [已隐藏](../evidence/screenshots/workbench/sidebar/PC-CW25-hidden.png) | 通过 |
| CW25 | 模块拖入垃圾桶，取消保持，重新拖入隐藏 | 平板 768×1024 | [目标高亮](../evidence/screenshots/workbench/sidebar/平板-CW25-target.png) · [已取消](../evidence/screenshots/workbench/sidebar/平板-CW25-cancelled.png) · [已隐藏](../evidence/screenshots/workbench/sidebar/平板-CW25-hidden.png) | 通过 |
| CW25 | 模块拖入垃圾桶，取消保持，重新拖入隐藏 | 手机 390×844 | [目标高亮](../evidence/screenshots/workbench/sidebar/手机-CW25-target.png) · [已取消](../evidence/screenshots/workbench/sidebar/手机-CW25-cancelled.png) · [已隐藏](../evidence/screenshots/workbench/sidebar/手机-CW25-hidden.png) | 通过 |
| CW26 | 隐藏三项，垃圾桶逐项恢复至空 | PC 1440×900 | [待恢复模块](../evidence/screenshots/workbench/sidebar/PC-CW26-items.png) · [空状态](../evidence/screenshots/workbench/sidebar/PC-CW26-empty.png) | 通过 |
| CW26 | 隐藏三项，垃圾桶逐项恢复至空 | 平板 768×1024 | [待恢复模块](../evidence/screenshots/workbench/sidebar/平板-CW26-items.png) · [空状态](../evidence/screenshots/workbench/sidebar/平板-CW26-empty.png) | 通过 |
| CW26 | 隐藏三项，垃圾桶逐项恢复至空 | 手机 390×844 | [待恢复模块](../evidence/screenshots/workbench/sidebar/手机-CW26-items.png) · [空状态](../evidence/screenshots/workbench/sidebar/手机-CW26-empty.png) | 通过 |
| CW27 | 空分组在落下前高亮，落下后包含新模块 | PC 1440×900 | [空状态](../evidence/screenshots/workbench/sidebar/PC-CW27-empty.png) · [落下前](../evidence/screenshots/workbench/sidebar/PC-CW27-drop-target.png) · [已填写／填入](../evidence/screenshots/workbench/sidebar/PC-CW27-filled.png) | 通过 |
| CW27 | 空分组在落下前高亮，落下后包含新模块 | 平板 768×1024 | [空状态](../evidence/screenshots/workbench/sidebar/平板-CW27-empty.png) · [落下前](../evidence/screenshots/workbench/sidebar/平板-CW27-drop-target.png) · [已填写／填入](../evidence/screenshots/workbench/sidebar/平板-CW27-filled.png) | 通过 |
| CW27 | 空分组在落下前高亮，落下后包含新模块 | 手机 390×844 | [空状态](../evidence/screenshots/workbench/sidebar/手机-CW27-empty.png) · [落下前](../evidence/screenshots/workbench/sidebar/手机-CW27-drop-target.png) · [已填写／填入](../evidence/screenshots/workbench/sidebar/手机-CW27-filled.png) | 通过 |
| CW30 | 删除分组后成员进入垃圾桶，恢复成员不重建分组 | PC 1440×900 | [目标高亮](../evidence/screenshots/workbench/sidebar/PC-CW30-target.png) · [已删除](../evidence/screenshots/workbench/sidebar/PC-CW30-deleted.png) · [已恢复](../evidence/screenshots/workbench/sidebar/PC-CW30-restored.png) | 通过 |
| CW30 | 删除分组后成员进入垃圾桶，恢复成员不重建分组 | 平板 768×1024 | [目标高亮](../evidence/screenshots/workbench/sidebar/平板-CW30-target.png) · [已删除](../evidence/screenshots/workbench/sidebar/平板-CW30-deleted.png) · [已恢复](../evidence/screenshots/workbench/sidebar/平板-CW30-restored.png) | 通过 |
| CW30 | 删除分组后成员进入垃圾桶，恢复成员不重建分组 | 手机 390×844 | [目标高亮](../evidence/screenshots/workbench/sidebar/手机-CW30-target.png) · [已删除](../evidence/screenshots/workbench/sidebar/手机-CW30-deleted.png) · [已恢复](../evidence/screenshots/workbench/sidebar/手机-CW30-restored.png) | 通过 |
| CW31 | 模块落入空分组后刷新仍保留 | PC 1440×900 | [已填写／填入](../evidence/screenshots/workbench/sidebar/PC-CW31-filled.png) · [刷新后](../evidence/screenshots/workbench/sidebar/PC-CW31-reloaded.png) | 通过 |
| CW31 | 模块落入空分组后刷新仍保留 | 平板 768×1024 | [已填写／填入](../evidence/screenshots/workbench/sidebar/平板-CW31-filled.png) · [刷新后](../evidence/screenshots/workbench/sidebar/平板-CW31-reloaded.png) | 通过 |
| CW31 | 模块落入空分组后刷新仍保留 | 手机 390×844 | [已填写／填入](../evidence/screenshots/workbench/sidebar/手机-CW31-filled.png) · [刷新后](../evidence/screenshots/workbench/sidebar/手机-CW31-reloaded.png) | 通过 |
| CW32 | 正在浏览的模块被隐藏时回首页 | PC 1440×900 | [当前模块页](../evidence/screenshots/workbench/sidebar/PC-CW32-page.png) · [首页](../evidence/screenshots/workbench/sidebar/PC-CW32-home.png) | 通过 |
| CW32 | 正在浏览的模块被隐藏时回首页 | 平板 768×1024 | [当前模块页](../evidence/screenshots/workbench/sidebar/平板-CW32-page.png) · [首页](../evidence/screenshots/workbench/sidebar/平板-CW32-home.png) | 通过 |
| CW32 | 正在浏览的模块被隐藏时回首页 | 手机 390×844 | [当前模块页](../evidence/screenshots/workbench/sidebar/手机-CW32-page.png) · [首页](../evidence/screenshots/workbench/sidebar/手机-CW32-home.png) | 通过 |
| CW33 | 折叠与展开分组，内容退出和恢复键盘可达 | PC 1440×900 | [已展开](../evidence/screenshots/workbench/sidebar/PC-CW33-expanded.png) · [已折叠](../evidence/screenshots/workbench/sidebar/PC-CW33-collapsed.png) · [重新打开](../evidence/screenshots/workbench/sidebar/PC-CW33-reopened.png) | 通过 |
| CW33 | 折叠与展开分组，内容退出和恢复键盘可达 | 平板 768×1024 | [已展开](../evidence/screenshots/workbench/sidebar/平板-CW33-expanded.png) · [已折叠](../evidence/screenshots/workbench/sidebar/平板-CW33-collapsed.png) · [重新打开](../evidence/screenshots/workbench/sidebar/平板-CW33-reopened.png) | 通过 |
| CW33 | 折叠与展开分组，内容退出和恢复键盘可达 | 手机 390×844 | [已展开](../evidence/screenshots/workbench/sidebar/手机-CW33-expanded.png) · [已折叠](../evidence/screenshots/workbench/sidebar/手机-CW33-collapsed.png) · [重新打开](../evidence/screenshots/workbench/sidebar/手机-CW33-reopened.png) | 通过 |
| CW34 | 隐藏布局在刷新与日历深链保留 | PC 1440×900 | [已调整](../evidence/screenshots/workbench/sidebar/PC-CW34-changed.png) · [刷新后](../evidence/screenshots/workbench/sidebar/PC-CW34-reloaded.png) · [深链进入](../evidence/screenshots/workbench/sidebar/PC-CW34-deep-link.png) | 通过 |
| CW34 | 隐藏布局在刷新与日历深链保留 | 平板 768×1024 | [已调整](../evidence/screenshots/workbench/sidebar/平板-CW34-changed.png) · [刷新后](../evidence/screenshots/workbench/sidebar/平板-CW34-reloaded.png) · [深链进入](../evidence/screenshots/workbench/sidebar/平板-CW34-deep-link.png) | 通过 |
| CW34 | 隐藏布局在刷新与日历深链保留 | 手机 390×844 | [已调整](../evidence/screenshots/workbench/sidebar/手机-CW34-changed.png) · [刷新后](../evidence/screenshots/workbench/sidebar/手机-CW34-reloaded.png) · [深链进入](../evidence/screenshots/workbench/sidebar/手机-CW34-deep-link.png) | 通过 |
| CW40 | 损坏或残缺的持久化布局整份回落默认 | PC 1440×900 | [损坏数据回退](../evidence/screenshots/workbench/sidebar/PC-CW40-invalid-json.png) · [缺失模块回退](../evidence/screenshots/workbench/sidebar/PC-CW40-missing-modules.png) · [重复模块回退](../evidence/screenshots/workbench/sidebar/PC-CW40-duplicate-module.png) | 通过 |
| CW40 | 损坏或残缺的持久化布局整份回落默认 | 平板 768×1024 | [损坏数据回退](../evidence/screenshots/workbench/sidebar/平板-CW40-invalid-json.png) · [缺失模块回退](../evidence/screenshots/workbench/sidebar/平板-CW40-missing-modules.png) · [重复模块回退](../evidence/screenshots/workbench/sidebar/平板-CW40-duplicate-module.png) | 通过 |
| CW40 | 损坏或残缺的持久化布局整份回落默认 | 手机 390×844 | [损坏数据回退](../evidence/screenshots/workbench/sidebar/手机-CW40-invalid-json.png) · [缺失模块回退](../evidence/screenshots/workbench/sidebar/手机-CW40-missing-modules.png) · [重复模块回退](../evidence/screenshots/workbench/sidebar/手机-CW40-duplicate-module.png) | 通过 |
| CW41 | 分组菜单、空名称拒绝、取消、重命名与移到未分组 | PC 1440×900 | [分组菜单](../evidence/screenshots/workbench/sidebar/PC-CW41-menu.png) · [空白拒绝](../evidence/screenshots/workbench/sidebar/PC-CW41-blank.png) · [已取消](../evidence/screenshots/workbench/sidebar/PC-CW41-cancelled.png) · [已重命名](../evidence/screenshots/workbench/sidebar/PC-CW41-renamed.png) · [移到未分组](../evidence/screenshots/workbench/sidebar/PC-CW41-ungrouped.png) | 通过 |
| CW41 | 分组菜单、空名称拒绝、取消、重命名与移到未分组 | 平板 768×1024 | [分组菜单](../evidence/screenshots/workbench/sidebar/平板-CW41-menu.png) · [空白拒绝](../evidence/screenshots/workbench/sidebar/平板-CW41-blank.png) · [已取消](../evidence/screenshots/workbench/sidebar/平板-CW41-cancelled.png) · [已重命名](../evidence/screenshots/workbench/sidebar/平板-CW41-renamed.png) · [移到未分组](../evidence/screenshots/workbench/sidebar/平板-CW41-ungrouped.png) | 通过 |
| CW41 | 分组菜单、空名称拒绝、取消、重命名与移到未分组 | 手机 390×844 | [分组菜单](../evidence/screenshots/workbench/sidebar/手机-CW41-menu.png) · [空白拒绝](../evidence/screenshots/workbench/sidebar/手机-CW41-blank.png) · [已取消](../evidence/screenshots/workbench/sidebar/手机-CW41-cancelled.png) · [已重命名](../evidence/screenshots/workbench/sidebar/手机-CW41-renamed.png) · [移到未分组](../evidence/screenshots/workbench/sidebar/手机-CW41-ungrouped.png) | 通过 |
| CW42 | 键盘调整模块顺序与分组，边界保持原位 | PC 1440×900 | [移动边界](../evidence/screenshots/workbench/sidebar/PC-CW42-boundary.png) · [已换位](../evidence/screenshots/workbench/sidebar/PC-CW42-reordered.png) · [移到下一组](../evidence/screenshots/workbench/sidebar/PC-CW42-next-group.png) · [移回原组](../evidence/screenshots/workbench/sidebar/PC-CW42-returned.png) | 通过 |
| CW42 | 键盘调整模块顺序与分组，边界保持原位 | 平板 768×1024 | [移动边界](../evidence/screenshots/workbench/sidebar/平板-CW42-boundary.png) · [已换位](../evidence/screenshots/workbench/sidebar/平板-CW42-reordered.png) · [移到下一组](../evidence/screenshots/workbench/sidebar/平板-CW42-next-group.png) · [移回原组](../evidence/screenshots/workbench/sidebar/平板-CW42-returned.png) | 通过 |
| CW42 | 键盘调整模块顺序与分组，边界保持原位 | 手机 390×844 | [移动边界](../evidence/screenshots/workbench/sidebar/手机-CW42-boundary.png) · [已换位](../evidence/screenshots/workbench/sidebar/手机-CW42-reordered.png) · [移到下一组](../evidence/screenshots/workbench/sidebar/手机-CW42-next-group.png) · [移回原组](../evidence/screenshots/workbench/sidebar/手机-CW42-returned.png) | 通过 |
| CW43 | 垃圾桶模块拖出时取消保持，再拖入指定分组恢复 | PC 1440×900 | [目标高亮](../evidence/screenshots/workbench/sidebar/PC-CW43-target.png) · [已取消](../evidence/screenshots/workbench/sidebar/PC-CW43-cancelled.png) · [已恢复](../evidence/screenshots/workbench/sidebar/PC-CW43-restored.png) | 通过 |
| CW43 | 垃圾桶模块拖出时取消保持，再拖入指定分组恢复 | 平板 768×1024 | [目标高亮](../evidence/screenshots/workbench/sidebar/平板-CW43-target.png) · [已取消](../evidence/screenshots/workbench/sidebar/平板-CW43-cancelled.png) · [已恢复](../evidence/screenshots/workbench/sidebar/平板-CW43-restored.png) | 通过 |
| CW43 | 垃圾桶模块拖出时取消保持，再拖入指定分组恢复 | 手机 390×844 | [目标高亮](../evidence/screenshots/workbench/sidebar/手机-CW43-target.png) · [已取消](../evidence/screenshots/workbench/sidebar/手机-CW43-cancelled.png) · [已恢复](../evidence/screenshots/workbench/sidebar/手机-CW43-restored.png) | 通过 |
| CW45 | 分组拖动取消保持，再调整分组顺序 | PC 1440×900 | [目标高亮](../evidence/screenshots/workbench/sidebar/PC-CW45-target.png) · [已取消](../evidence/screenshots/workbench/sidebar/PC-CW45-cancelled.png) · [已换位](../evidence/screenshots/workbench/sidebar/PC-CW45-reordered.png) | 通过 |
| CW45 | 分组拖动取消保持，再调整分组顺序 | 平板 768×1024 | [目标高亮](../evidence/screenshots/workbench/sidebar/平板-CW45-target.png) · [已取消](../evidence/screenshots/workbench/sidebar/平板-CW45-cancelled.png) · [已换位](../evidence/screenshots/workbench/sidebar/平板-CW45-reordered.png) | 通过 |
| CW45 | 分组拖动取消保持，再调整分组顺序 | 手机 390×844 | [目标高亮](../evidence/screenshots/workbench/sidebar/手机-CW45-target.png) · [已取消](../evidence/screenshots/workbench/sidebar/手机-CW45-cancelled.png) · [已换位](../evidence/screenshots/workbench/sidebar/手机-CW45-reordered.png) | 通过 |

## 顶部栏

行为定义：[顶部栏](topbar.md)。

| 场景 | 条件、动作与预期 | 视口 | 当前视觉状态 | 验证 |
| --- | --- | --- | --- | --- |
| CW08 | 初始通知列表 | PC 1440×900 | [已打开](../evidence/screenshots/workbench/topbar/PC-CW08-open.png) | 通过 |
| CW08 | 初始通知列表 | 平板 768×1024 | [已打开](../evidence/screenshots/workbench/topbar/平板-CW08-open.png) | 通过 |
| CW08 | 初始通知列表 | 手机 390×844 | [已打开](../evidence/screenshots/workbench/topbar/手机-CW08-open.png) | 通过 |
| CW09 | 空反馈表单 | PC 1440×900 | [已打开](../evidence/screenshots/workbench/topbar/PC-CW09-open.png) | 通过 |
| CW09 | 空反馈表单 | 平板 768×1024 | [已打开](../evidence/screenshots/workbench/topbar/平板-CW09-open.png) | 通过 |
| CW09 | 空反馈表单 | 手机 390×844 | [已打开](../evidence/screenshots/workbench/topbar/手机-CW09-open.png) | 通过 |
| CW10 | 未完成教程列表 | PC 1440×900 | [已打开](../evidence/screenshots/workbench/topbar/PC-CW10-open.png) | 通过 |
| CW10 | 未完成教程列表 | 平板 768×1024 | [已打开](../evidence/screenshots/workbench/topbar/平板-CW10-open.png) | 通过 |
| CW10 | 未完成教程列表 | 手机 390×844 | [已打开](../evidence/screenshots/workbench/topbar/手机-CW10-open.png) | 通过 |
| CW11 | 隐私面板 | PC 1440×900 | [已打开](../evidence/screenshots/workbench/topbar/PC-CW11-open.png) | 通过 |
| CW11 | 隐私面板 | 平板 768×1024 | [已打开](../evidence/screenshots/workbench/topbar/平板-CW11-open.png) | 通过 |
| CW11 | 隐私面板 | 手机 390×844 | [已打开](../evidence/screenshots/workbench/topbar/手机-CW11-open.png) | 通过 |
| CW12 | 新标签页首次引导，关闭后不重放 | PC 1440×900 | [首次引导](../evidence/screenshots/workbench/topbar/PC-CW12-coach.png) · [已关闭引导](../evidence/screenshots/workbench/topbar/PC-CW12-dismissed.png) | 通过 |
| CW12 | 新标签页首次引导，关闭后不重放 | 平板 768×1024 | [首次引导](../evidence/screenshots/workbench/topbar/平板-CW12-coach.png) · [已关闭引导](../evidence/screenshots/workbench/topbar/平板-CW12-dismissed.png) | 通过 |
| CW12 | 新标签页首次引导，关闭后不重放 | 手机 390×844 | [首次引导](../evidence/screenshots/workbench/topbar/手机-CW12-coach.png) · [已关闭引导](../evidence/screenshots/workbench/topbar/手机-CW12-dismissed.png) | 通过 |
| CW13 | 完成所有教程，关闭庆祝，再撤销一项 | PC 1440×900 | [庆祝](../evidence/screenshots/workbench/topbar/PC-CW13-celebration.png) · [撤销一项](../evidence/screenshots/workbench/topbar/PC-CW13-undone.png) | 通过 |
| CW13 | 完成所有教程，关闭庆祝，再撤销一项 | 平板 768×1024 | [庆祝](../evidence/screenshots/workbench/topbar/平板-CW13-celebration.png) · [撤销一项](../evidence/screenshots/workbench/topbar/平板-CW13-undone.png) | 通过 |
| CW13 | 完成所有教程，关闭庆祝，再撤销一项 | 手机 390×844 | [庆祝](../evidence/screenshots/workbench/topbar/手机-CW13-celebration.png) · [撤销一项](../evidence/screenshots/workbench/topbar/手机-CW13-undone.png) | 通过 |
| CW18 | 初始通知未读数与三条消息一致 | PC 1440×900 | [初始](../evidence/screenshots/workbench/topbar/PC-CW18-initial.png) | 通过 |
| CW18 | 初始通知未读数与三条消息一致 | 平板 768×1024 | [初始](../evidence/screenshots/workbench/topbar/平板-CW18-initial.png) | 通过 |
| CW18 | 初始通知未读数与三条消息一致 | 手机 390×844 | [初始](../evidence/screenshots/workbench/topbar/手机-CW18-initial.png) | 通过 |
| CW21 | 标已读、撤销、全部已读 | PC 1440×900 | [已读](../evidence/screenshots/workbench/topbar/PC-CW21-read.png) · [撤销已读](../evidence/screenshots/workbench/topbar/PC-CW21-unread.png) · [全部已读](../evidence/screenshots/workbench/topbar/PC-CW21-all-read.png) | 通过 |
| CW21 | 标已读、撤销、全部已读 | 平板 768×1024 | [已读](../evidence/screenshots/workbench/topbar/平板-CW21-read.png) · [撤销已读](../evidence/screenshots/workbench/topbar/平板-CW21-unread.png) · [全部已读](../evidence/screenshots/workbench/topbar/平板-CW21-all-read.png) | 通过 |
| CW21 | 标已读、撤销、全部已读 | 手机 390×844 | [已读](../evidence/screenshots/workbench/topbar/手机-CW21-read.png) · [撤销已读](../evidence/screenshots/workbench/topbar/手机-CW21-unread.png) · [全部已读](../evidence/screenshots/workbench/topbar/手机-CW21-all-read.png) | 通过 |
| CW22 | 已读通知拖入删除区，取消，然后再次拖入删除 | PC 1440×900 | [目标高亮](../evidence/screenshots/workbench/topbar/PC-CW22-target.png) · [已取消](../evidence/screenshots/workbench/topbar/PC-CW22-cancelled.png) · [已删除](../evidence/screenshots/workbench/topbar/PC-CW22-deleted.png) | 通过 |
| CW22 | 已读通知拖入删除区，取消，然后再次拖入删除 | 平板 768×1024 | [目标高亮](../evidence/screenshots/workbench/topbar/平板-CW22-target.png) · [已取消](../evidence/screenshots/workbench/topbar/平板-CW22-cancelled.png) · [已删除](../evidence/screenshots/workbench/topbar/平板-CW22-deleted.png) | 通过 |
| CW22 | 已读通知拖入删除区，取消，然后再次拖入删除 | 手机 390×844 | [目标高亮](../evidence/screenshots/workbench/topbar/手机-CW22-target.png) · [已取消](../evidence/screenshots/workbench/topbar/手机-CW22-cancelled.png) · [已删除](../evidence/screenshots/workbench/topbar/手机-CW22-deleted.png) | 通过 |
| CW28 | 填写并发送反馈，关闭致谢，重新打开为空 | PC 1440×900 | [已填写／填入](../evidence/screenshots/workbench/topbar/PC-CW28-filled.png) · [已发送](../evidence/screenshots/workbench/topbar/PC-CW28-sent.png) · [已重置](../evidence/screenshots/workbench/topbar/PC-CW28-reset.png) | 通过 |
| CW28 | 填写并发送反馈，关闭致谢，重新打开为空 | 平板 768×1024 | [已填写／填入](../evidence/screenshots/workbench/topbar/平板-CW28-filled.png) · [已发送](../evidence/screenshots/workbench/topbar/平板-CW28-sent.png) · [已重置](../evidence/screenshots/workbench/topbar/平板-CW28-reset.png) | 通过 |
| CW28 | 填写并发送反馈，关闭致谢，重新打开为空 | 手机 390×844 | [已填写／填入](../evidence/screenshots/workbench/topbar/手机-CW28-filled.png) · [已发送](../evidence/screenshots/workbench/topbar/手机-CW28-sent.png) · [已重置](../evidence/screenshots/workbench/topbar/手机-CW28-reset.png) | 通过 |
| CW29 | 全部标已读，再逐项删除到空列表 | PC 1440×900 | [空状态](../evidence/screenshots/workbench/topbar/PC-CW29-empty.png) | 通过 |
| CW29 | 全部标已读，再逐项删除到空列表 | 平板 768×1024 | [空状态](../evidence/screenshots/workbench/topbar/平板-CW29-empty.png) | 通过 |
| CW29 | 全部标已读，再逐项删除到空列表 | 手机 390×844 | [空状态](../evidence/screenshots/workbench/topbar/手机-CW29-empty.png) | 通过 |
| CW37 | 反馈空白禁用、四种分类、取消清空 | PC 1440×900 | [空白拒绝](../evidence/screenshots/workbench/topbar/PC-CW37-blank.png) · [建议](../evidence/screenshots/workbench/topbar/PC-CW37-type-0.png) · [错误报告](../evidence/screenshots/workbench/topbar/PC-CW37-type-1.png) · [问题](../evidence/screenshots/workbench/topbar/PC-CW37-type-2.png) · [赞扬](../evidence/screenshots/workbench/topbar/PC-CW37-type-3.png) · [已取消](../evidence/screenshots/workbench/topbar/PC-CW37-cancelled.png) | 通过 |
| CW37 | 反馈空白禁用、四种分类、取消清空 | 平板 768×1024 | [空白拒绝](../evidence/screenshots/workbench/topbar/平板-CW37-blank.png) · [建议](../evidence/screenshots/workbench/topbar/平板-CW37-type-0.png) · [错误报告](../evidence/screenshots/workbench/topbar/平板-CW37-type-1.png) · [问题](../evidence/screenshots/workbench/topbar/平板-CW37-type-2.png) · [赞扬](../evidence/screenshots/workbench/topbar/平板-CW37-type-3.png) · [已取消](../evidence/screenshots/workbench/topbar/平板-CW37-cancelled.png) | 通过 |
| CW37 | 反馈空白禁用、四种分类、取消清空 | 手机 390×844 | [空白拒绝](../evidence/screenshots/workbench/topbar/手机-CW37-blank.png) · [建议](../evidence/screenshots/workbench/topbar/手机-CW37-type-0.png) · [错误报告](../evidence/screenshots/workbench/topbar/手机-CW37-type-1.png) · [问题](../evidence/screenshots/workbench/topbar/手机-CW37-type-2.png) · [赞扬](../evidence/screenshots/workbench/topbar/手机-CW37-type-3.png) · [已取消](../evidence/screenshots/workbench/topbar/手机-CW37-cancelled.png) | 通过 |
