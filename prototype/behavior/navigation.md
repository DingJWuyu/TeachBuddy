# 导航与搜索

Status: Accepted

运行入口见 [manifest](manifest.md)，面板互斥、关闭和焦点规则见 [外壳](shell.md)。目的页面不在当前设计范围。

## Journeys

| ID | 目标 | 当前行为 |
| --- | --- | --- |
| J1 | 使用品牌与顶栏导航 | 品牌、首页和日历分别链接到 `/`、`/`、`/calendar`；打开后均展示同一外壳和首页样例，首页为固定选中态 |
| J2 | 使用模块入口 | 展示固定模块；「我的班级」为样例选中项。模块行承载布局编辑，Enter 和 Space 不打开页面 |
| J3 | 使用支持菜单 | 鼠标进入即展开，离开关闭，点击保持打开；选择设置、帮助或更新日志后关闭并播报选择，不渲染目的页面 |
| J4 | 搜索 | 点击搜索或使用快捷键，输入后按名称和提示过滤；方向键循环高亮，Enter 或点击结果后播报并关闭。无结果时保留输入与空状态提示 |

## States and scenarios

| ID | 状态 | 复现 |
| --- | --- | --- |
| S1 | 首页样例 | 打开原型根地址；正文为固定样例 |
| S13 | 搜索面板 | 关闭首次引导，按 `Ctrl/Cmd + K`；输入已知样例或无匹配文本，体验结果与空状态 |

搜索为居中模态，打开后自动聚焦输入框，关闭后再次打开清空查询。支持菜单的悬停间隙连续可达；触摸以点击打开为入口。支持箭头展开时左旋 180°，关闭后复位。手机上的三个全局入口位于抽屉首行，支持选项内联展开。

## Visible information

模块、班级与课程名称是固定样例。搜索提示中的人数、时间同样来自样例，不表示真实账户资料。完整样例位于 [外壳源码](../src/SidebarEditingPrototype.jsx) 与 [搜索面板源码](../src/TopbarSurfaces.jsx)。

## Evidence

- [导航悬停](../evidence/prototype-desktop-1440-nav-hover.png)、[搜索](../evidence/prototype-topbar-search.png)、[支持菜单](../evidence/prototype-topbar-support-menu.png)。
- [顶部栏验证](../verification/verify-topbar.mjs) 覆盖搜索过滤、键盘选择、菜单悬停和关闭。
