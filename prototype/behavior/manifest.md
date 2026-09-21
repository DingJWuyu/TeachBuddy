# TeachBuddy 原型行为索引

Status: Accepted

当前范围是 TeachBuddy 的账户入口（登录、注册、找回密码）与工作台外壳的侧边栏、侧栏头部、顶部栏及共享交互。
首页正文与其余目的页面一样是空占位，尚无设计。

## 运行

从仓库根目录执行：

```bash
npm install
npm run prototype:sidebar
```

打开 <http://localhost:4174/>，先看到账户入口的登录卡。示例账户是 `example@example.com`，密码填 8 位以上（例如 `teachbuddy`）即可进入工作台；注册与找回密码的示例验证码写在对应输入框的提示里。构建命令为 `npm run prototype:build`。原型使用仓库已有的 React、Vite 依赖及共享基础样式，不需要启动 API。

## 行为文档

| 文档 | 范围与拥有的标识 |
| --- | --- |
| [账户入口](auth.md) | 登录、注册、找回密码与会话边界；J11-J13；S14-S21 |
| [账户场景覆盖](auth-scenarios.md) | CA01-CA40；三端场景复现、截图与验证结果，不重复账户行为定义 |
| [工作台场景覆盖](workbench-scenarios.md) | CW01-CW53；工作台截图、检查结果与覆盖边界 |
| [外壳与共享交互](shell.md) | 桌面窄轨、手机抽屉、跳转不重建外壳、浮层互斥与焦点、状态分层；S8、S9、S29 |
| [导航与搜索](navigation.md) | J1-J4；S1、S2、S2b、S13、S24；导航目的地与支持菜单 |
| [侧栏编辑](sidebar.md) | J7、J16、J17；S5、S6、S22、S23、S26-S28；布局、隐藏和拖放 |
| [侧栏头部](sidebar-head.md) | J18-J24；S30-S35；账号行、语言切换、学期选择与学期对话框 |
| [顶部栏入口](topbar.md) | J5、J6、J8-J10、J14、J15；S3、S3a、S4、S7、S10-S12、S25 |

## 产物

| 入口 | 用途 |
| --- | --- |
| [src](../src/) | 原型组件与内嵌模拟数据，入口为 `main.jsx`；[src/auth](../src/auth/) 是账户入口的四个状态、示例数据与会话接缝 |
| [flags](../flags/) | 语言菜单用的 20 面圆形国旗，按语言代码命名 |
| [index.html](../index.html)、[Vite 配置](../vite.config.mjs) | 独立运行与构建 |
| [screenshots](../evidence/screenshots/) | 按旅程分类，文件名包含终端与场景 ID；证据索引由对应场景覆盖文档拥有 |
| [verification results](../evidence/verification/) | 当前场景断言、几何与交互检查结果 |
| [verification](../verification/) | 当前几何、交互、拖拽与响应式验证脚本；账户入口另有走查与截图表脚本 |
| [项目设计规则](../../docs/rules/design-and-verification.md) | 跨原型与产品适用的设计要求及验证经验 |

验证脚本从仓库根目录运行：

```bash
node prototype/verification/capture-all.mjs
node prototype/verification/capture-workbench.mjs
node prototype/verification/auth-walk.mjs
node prototype/verification/verify-regression.mjs
node prototype/verification/verify-drag.mjs
node prototype/verification/verify-ui-review.mjs
node prototype/verification/verify-visual.mjs
node prototype/verification/verify-topbar.mjs
node prototype/verification/capture-hover-details.mjs
node prototype/verification/verify-navigation-notifications-feedback.mjs
node prototype/verification/verify-hidden-page-redirect.mjs
node prototype/verification/verify-flash-chip-collapse-persistence.mjs
node prototype/verification/verify-integration.mjs
node prototype/verification/measure-head.mjs
node prototype/verification/verify-head-round2.mjs
node prototype/verification/verify-head-round4.mjs
node prototype/verification/verify-semester-actions.mjs
node prototype/verification/verify-home-empty.mjs
```

`capture-workbench.mjs --only=CW27,CW31` 只采集指定场景。`verify-hidden-page-redirect.mjs` 支持 `--only=1` 至 `8`，`verify-flash-chip-collapse-persistence.mjs` 支持 `--only=1` 至 `5`；段号定义在脚本中。分段结果不替代完整结果，异常退出不记为通过。

`measure-head.mjs` 与 `image-sample.mjs`、`pixel-diff.mjs` 用于侧栏头部的几何与配色比对；
`image-sample.mjs` 读取截图内区域的主色，`pixel-diff.mjs` 比对两张截图。

`PROTOTYPE_URL` 指定目标地址；添加 `?no-dev-chrome` 可隐藏开发环境切换控件，不改变账户或工作台行为。`PROTOTYPE_EVIDENCE_DIR` 指定截图输出，账户场景使用截图根目录，工作台场景使用 `workbench/` 子目录，再按外壳、导航、侧栏、顶部栏分类。`PROTOTYPE_RESULTS_DIR` 指定断言结果目录，`PROTOTYPE_TEMP_DIR` 指定临时输出位置。验证默认暂存输出，不直接替换当前证据；执行前将输出指向可写位置，确认目标、完整结果与截图一致后再按场景更新。账户采集全部通过后才写入指定输出目录。

工作台检查共用 [session.mjs](../verification/session.mjs)，通过界面登录。文档加载会失去内存会话，客户端跳转不会。截图、行为记录与断言结果各由上表对应入口拥有。
