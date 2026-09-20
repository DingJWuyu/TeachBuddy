# TeachBuddy 原型行为索引

Status: Accepted

当前范围是 TeachBuddy 的账户入口（登录、注册、找回密码）与工作台外壳的侧边栏、顶部栏及共享交互。

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
| [工作台场景覆盖](workbench-scenarios.md) | CW01-CW17；工作台截图、检查结果与覆盖缺口 |
| [外壳与共享交互](shell.md) | 桌面窄轨、手机抽屉、浮层互斥与焦点；S8、S9 |
| [导航与搜索](navigation.md) | J1-J4；S1、S13；目的页面不在当前范围 |
| [侧栏编辑](sidebar.md) | J7；S6；含真实拖拽插入线跳动的已接受限制 |
| [顶部栏入口](topbar.md) | J5、J6、J8-J10；S3、S3a、S4、S7、S10-S12 |

## 产物

| 入口 | 用途 |
| --- | --- |
| [src](../src/) | 原型组件与内嵌模拟数据，入口为 `main.jsx`；[src/auth](../src/auth/) 是账户入口的四个状态、示例数据与会话接缝 |
| [index.html](../index.html)、[Vite 配置](../vite.config.mjs) | 独立运行与构建 |
| [screenshots](../evidence/screenshots/) | 按旅程分类，文件名包含终端与场景 ID；证据索引由对应场景覆盖文档拥有 |
| [verification results](../evidence/verification/) | 当前场景断言、几何与交互检查结果 |
| [verification](../verification/) | 当前几何、交互、拖拽与响应式验证脚本；账户入口另有走查与截图表脚本 |
| [项目设计规则](../../docs/rules/design-and-verification.md) | 跨原型与产品适用的设计要求及验证经验 |

验证脚本从仓库根目录运行：

```bash
node prototype/verification/capture-all.mjs
node prototype/verification/auth-walk.mjs
node prototype/verification/verify-regression.mjs
node prototype/verification/verify-drag.mjs
node prototype/verification/verify-ui-review.mjs
node prototype/verification/verify-visual.mjs
node prototype/verification/verify-topbar.mjs
node prototype/verification/capture-hover-details.mjs
```

`PROTOTYPE_URL` 指定目标地址。账户场景脚本的 `PROTOTYPE_EVIDENCE_DIR` 指向截图根目录，工作台脚本则指向其 `workbench/` 子目录；`PROTOTYPE_RESULTS_DIR` 覆盖账户断言输出目录，`PROTOTYPE_TEMP_DIR` 指定生成新图时的暂存目录。账户场景全部通过后才替换当前图片，只清理该场景集拥有的过期图片，不删除行为记录。工作台脚本经 [session.mjs](../verification/session.mjs) 先走登录旅程。
