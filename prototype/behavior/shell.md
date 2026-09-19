# 外壳与共享交互

Status: Accepted

运行入口见 [manifest](manifest.md)。本文件拥有跨导航与弹层共用的规则；具体入口行为见 [导航](navigation.md)、[侧栏](sidebar.md) 和 [顶部栏](topbar.md)。

## Scope

独立教师使用同一套顶部栏与侧边栏。桌面、平板和手机均可进入原型；首页正文只是样例，不构成业务模块设计承诺。

## States and scenarios

| ID | 状态 | 进入与退出 |
| --- | --- | --- |
| S8 | 桌面侧栏窄轨 | 悬停顶栏后点击收起键；再次点击展开。宽度由 256px 过渡到 72px，顶栏品牌和导航锚点保持不动 |
| S9 | 手机抽屉 | 390px 视口点击汉堡入口；点击遮罩、关闭按钮或按 Escape 退出。抽屉内包含首页、日历、支持及模块列表 |

展开态保留账户区、分组标签和垃圾桶；窄轨隐藏这些区域，模块保留图标与名称提示，分组间保留细分隔线。首次引导可能覆盖页面，体验其他状态前先关闭引导。

## Experience rules

- 顶栏入口与支持菜单共用一个打开状态，同一时刻只显示一个面板。
- Escape 关闭当前面板并把焦点交还触发按钮；点击面板及其触发按钮之外关闭面板。切换入口直接切换面板。
- `Ctrl/Cmd + K` 切换搜索。动作反馈共用一个可访问播报区域。
- 侧栏收起采用 0.2s 列宽动画，顶栏固定，无翻页遮罩。减少动态效果偏好下取消相应动效。
- 布局与教程进度保存在内存中，刷新恢复样例。面板内部数据的生命周期见所属文档。

## Known gaps

S8 的模块名称提示被导航滚动容器裁切，实际只露出左边缘，无法读出完整名称。这是当前实现偏差，不是已接受的提示规则；几何断言只检查提示文本绑定，未覆盖可见性。

## Evidence

- [展开](../evidence/prototype-topbar-default.png)、[收起键悬停](../evidence/prototype-desktop-1440-toggle-hover.png)、[窄轨](../evidence/prototype-desktop-1440-rail.png)、[窄轨提示](../evidence/prototype-desktop-1440-rail-tooltip.png)、[手机抽屉](../evidence/prototype-topbar-narrow-drawer.png)。
- [交互回归](../verification/verify-regression.mjs) 与 [几何验证](../verification/verify-visual.mjs) 覆盖桌面、手机、隐藏恢复及无障碍标签。
