# 工作台场景覆盖

本文只维护原型的体验参考和适用边界；认可范围见 [manifest](manifest.md)。现行产品从[文档入口](../../docs/README.md)读取，原型样例、存储与旧场景结果不定义产品能力。

本页说明当前三模块原型的可执行验证入口。模块行为和实现限制见[模块原型](modules.md)，外壳行为见[外壳](shell.md)、[导航](navigation.md)、[侧栏](sidebar.md)和[顶部栏](topbar.md)。账户入口使用[账户场景覆盖](auth-scenarios.md)，头部与学期交互使用[头部场景覆盖](sidebar-head-scenarios.md)。

## 当前验证

先按 [manifest](manifest.md#运行) 启动原型，再从仓库根目录运行。通过 `PROTOTYPE_URL` 指定隔离实例；截图和报告输出按 manifest 的产物配置。每项脚本运行完整场景，不接受历史 `--only` 编号。

| 入口 | 当前覆盖 |
| --- | --- |
| [capture-workbench](../verification/capture-workbench.mjs) | 1440×900、768×1024、390×844；Agent 首页、题库编辑及跨模块保留、资源预览返回、数学示例参数、搜索无备课、通知空态、反馈入口、旧 prep 地址未知页、页面无横向溢出 |
| [verify-hidden-page-redirect](../verification/verify-hidden-page-redirect.mjs) | 隐藏当前题库后回首页且不重载、刷新保持隐藏、垃圾桶恢复到未分组、清空教学分组后仍可见、持久布局里的已删除和未知模块不复活、移除分组后模块和当前页保留 |
| [verify-flash-chip-collapse-persistence](../verification/verify-flash-chip-collapse-persistence.mjs) | 三模块客户端导航、分组折叠读回、展开、通用书本拖拽图、拖入空分组和刷新读回 |
| [verify-navigation-notifications-feedback](../verification/verify-navigation-notifications-feedback.mjs) | 当前模块正文、Agent 首页、搜索跳转、通知空态、通知与反馈互斥、反馈必填和本地确认 |

```bash
node prototype/verification/capture-workbench.mjs
node prototype/verification/verify-hidden-page-redirect.mjs
node prototype/verification/verify-flash-chip-collapse-persistence.mjs
node prototype/verification/verify-navigation-notifications-feedback.mjs
```

隐藏和拖拽检查在独立浏览器上下文中操作原型布局，不修改产品数据。题库资料只有会话内存；跨模块保留不能代表刷新持久化。通知由实际原型日程提醒产生，初始状态没有固定演示通知，因此当前入口核对空态，不以旧三通知样例推断提醒读删已经验收。

## 补充检查与证据边界

[交互回归](../verification/verify-regression.mjs)、[拖拽几何](../verification/verify-drag.mjs)、[界面细节](../verification/verify-ui-review.mjs)使用当前模块作为侧栏操作对象，检查命名、隐藏恢复、抽屉、溢出、拖放落点和几何。专用头部和动效脚本按其对应行为文档选择，不构成整站自动验收清单。

浏览器截图需要实际打开检查；截图存在不等于视觉通过。合成 HTML 拖放只验证目标、插入线与拖拽图清理，不证明原生指针轨迹、触屏长按或真机兼容。原型本地反馈只显示确认，不向外部服务发消息。

旧 CW01-CW46、CW52 的场景表与旧运行版本从固定 [71b6abf8 场景快照](https://github.com/DingJWuyu/TeachBuddy/blob/71b6abf8aba732591906712f33eab520d00a80c0/prototype/behavior/workbench-scenarios.md)追溯；其中保留当时所指的旧运行版本。历史截图与结果由该固定提交的 `prototype/evidence/` 保全。当前脚本不解释旧 CW 编号，检出整理前快照也不等于恢复更早的场景运行版本。
