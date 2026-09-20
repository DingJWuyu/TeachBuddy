# 工作台场景覆盖

本文件拥有 CW01-CW17 的场景与证据索引；行为定义见各节的所属文档。这里记录已执行的检查及缺口，不代表工作台已经具备完整场景矩阵。

## 复现与边界

从 [manifest](manifest.md) 启动原型。每个场景从刷新、使用示例账户登录开始，除 CW12 外先关闭首次引导。样例数据由原型内存初始化；再次刷新并登录可以重置。精确操作见各行链接的验证脚本。视口是浏览器模拟尺寸，不是真机测试。

截图只记录表中状态。通知全部已读、反馈致谢、搜索空结果、面板取消与焦点恢复等分支虽有部分交互断言，但没有完整的逐状态截图；平板与手机覆盖也不完整。这些是验证缺口，不是已排除的产品需求。

窄轨提示的实现偏差由 [外壳](shell.md#known-gaps) 记录；真实指针拖拽的已接受限制由 [侧栏](sidebar.md#accepted-limits) 记录。截图脚本成功退出不代表这两个问题已解决。

## 外壳

行为定义：[外壳](shell.md)。

| 场景 | 起始动作与目标状态 | 视口 | 当前截图 | 检查与结果 |
| --- | --- | --- | --- | --- |
| CW01 | 关闭首次引导，保持侧栏展开 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW01-expanded.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；通过 |
| CW01 | 关闭首次引导，保持侧栏展开 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW01 | 关闭首次引导，保持侧栏展开 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
| CW02 | 悬停顶栏并收起侧栏 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW02-rail.png) | [脚本](../verification/verify-visual.mjs) · [断言结果](../evidence/verification/verify-visual.txt)；通过 |
| CW02 | 悬停顶栏并收起侧栏 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW02 | 悬停顶栏并收起侧栏 | 手机 390×844 | 不适用：此布局无该入口 | 参见所属行为的响应式规则 |
| CW03 | 悬停顶栏，再悬停收起键 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW03-toggle-hover.png) | [脚本](../verification/verify-ui-review.mjs) · [断言结果](../evidence/verification/verify-ui-review.txt)；仅截图；按钮交互另有断言 |
| CW03 | 悬停顶栏，再悬停收起键 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW03 | 悬停顶栏，再悬停收起键 | 手机 390×844 | 不适用：此布局无该入口 | 参见所属行为的响应式规则 |
| CW04 | 收起侧栏后悬停第二个模块图标 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW04-rail-tooltip.png) | [脚本](../verification/verify-visual.mjs) · [断言结果](../evidence/verification/verify-visual.txt)；未通过视觉检查：提示被裁切 |
| CW04 | 收起侧栏后悬停第二个模块图标 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW04 | 收起侧栏后悬停第二个模块图标 | 手机 390×844 | 不适用：此布局无该入口 | 参见所属行为的响应式规则 |
| CW14 | 手机视口下点击汉堡按钮打开抽屉 | PC 1440×900 | 不适用：此布局无该入口 | 参见所属行为的响应式规则 |
| CW14 | 手机视口下点击汉堡按钮打开抽屉 | 平板 768×1024 | 不适用：此布局无该入口 | 参见所属行为的响应式规则 |
| CW14 | 手机视口下点击汉堡按钮打开抽屉 | 手机 390×844 | [截图](../evidence/screenshots/workbench/手机-CW14-drawer.png) | [脚本](../verification/verify-regression.mjs) · [断言结果](../evidence/verification/verify-regression.txt)；通过 |

## 导航

行为定义：[导航](navigation.md)。

| 场景 | 起始动作与目标状态 | 视口 | 当前截图 | 检查与结果 |
| --- | --- | --- | --- | --- |
| CW05 | 悬停顶栏的日历入口 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW05-nav-hover.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；仅截图；导航样式另有断言 |
| CW05 | 悬停顶栏的日历入口 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW05 | 悬停顶栏的日历入口 | 手机 390×844 | 不适用：此布局无该入口 | 参见所属行为的响应式规则 |
| CW06 | 悬停支持入口，等待菜单展开 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW06-support.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；通过 |
| CW06 | 悬停支持入口，等待菜单展开 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW06 | 悬停支持入口，等待菜单展开 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
| CW07 | 点击搜索入口，保留空查询 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW07-search.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；通过 |
| CW07 | 点击搜索入口，保留空查询 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW07 | 点击搜索入口，保留空查询 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |

## 侧栏

行为定义：[侧栏](sidebar.md)。

| 场景 | 起始动作与目标状态 | 视口 | 当前截图 | 检查与结果 |
| --- | --- | --- | --- | --- |
| CW15 | 用 Delete 隐藏一个模块，再打开垃圾桶 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW15-trash.png) | [脚本](../verification/verify-ui-review.mjs) · [断言结果](../evidence/verification/verify-ui-review.txt)；通过 |
| CW15 | 用 Delete 隐藏一个模块，再打开垃圾桶 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW15 | 用 Delete 隐藏一个模块，再打开垃圾桶 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
| CW16 | 关闭垃圾桶，点击新建分组 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW16-new-group.png) | [脚本](../verification/verify-ui-review.mjs) · [断言结果](../evidence/verification/verify-ui-review.txt)；通过 |
| CW16 | 关闭垃圾桶，点击新建分组 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW16 | 关闭垃圾桶，点击新建分组 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
| CW17 | 合成拖放事件后，指向分组间落点 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW17-insertion-line.png) | [脚本](../verification/verify-drag.mjs) · [断言结果](../evidence/verification/verify-drag.txt)；合成事件通过；不证明真实指针无跳动 |
| CW17 | 合成拖放事件后，指向分组间落点 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW17 | 合成拖放事件后，指向分组间落点 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |

## 顶部栏

行为定义：[顶部栏](topbar.md)。

| 场景 | 起始动作与目标状态 | 视口 | 当前截图 | 检查与结果 |
| --- | --- | --- | --- | --- |
| CW08 | 点击通知，保持初始未读列表 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW08-notifications.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；通过 |
| CW08 | 点击通知，保持初始未读列表 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW08 | 点击通知，保持初始未读列表 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
| CW09 | 点击反馈，保持空输入 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW09-feedback.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；通过 |
| CW09 | 点击反馈，保持空输入 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW09 | 点击反馈，保持空输入 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
| CW10 | 点击教程，保持未完成列表 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW10-tutorial.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；通过 |
| CW10 | 点击教程，保持未完成列表 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW10 | 点击教程，保持未完成列表 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
| CW11 | 点击隐私入口 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW11-privacy.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；通过 |
| CW11 | 点击隐私入口 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW11 | 点击隐私入口 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
| CW12 | 刷新并登录，不关闭首次引导 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW12-coach.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；通过 |
| CW12 | 刷新并登录，不关闭首次引导 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW12 | 刷新并登录，不关闭首次引导 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
| CW13 | 打开教程并完成全部条目，等待庆祝出现 | PC 1440×900 | [截图](../evidence/screenshots/workbench/PC-CW13-celebration.png) | [脚本](../verification/verify-topbar.mjs) · [断言结果](../evidence/verification/verify-topbar.txt)；通过 |
| CW13 | 打开教程并完成全部条目，等待庆祝出现 | 平板 768×1024 | 未捕获 | 覆盖缺口，不记为通过 |
| CW13 | 打开教程并完成全部条目，等待庆祝出现 | 手机 390×844 | 未捕获 | 覆盖缺口，不记为通过 |
