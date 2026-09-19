# TeachBuddy 原型行为索引

Status: Accepted

当前范围是 TeachBuddy 工作台的侧边栏、顶部栏及共享交互。

## 运行

从仓库根目录执行：

```bash
npm install
npm run prototype:sidebar
```

打开 <http://localhost:4174/>。构建命令为 `npm run prototype:build`。原型使用仓库已有的 React、Vite 依赖及共享基础样式，不需要启动 API。

## 行为文档

| 文档 | 范围与拥有的标识 |
| --- | --- |
| [外壳与共享交互](shell.md) | 桌面窄轨、手机抽屉、浮层互斥与焦点；S8、S9 |
| [导航与搜索](navigation.md) | J1-J4；S1、S13；目的页面不在当前范围 |
| [侧栏编辑](sidebar.md) | J7；S6；含真实拖拽插入线跳动的已接受限制 |
| [顶部栏入口](topbar.md) | J5、J6、J8-J10；S3、S3a、S4、S7、S10-S12 |

## 产物

| 入口 | 用途 |
| --- | --- |
| [src](../src/) | 原型组件与内嵌模拟数据，入口为 `main.jsx` |
| [index.html](../index.html)、[Vite 配置](../vite.config.mjs) | 独立运行与构建 |
| [evidence](../evidence/) | 当前状态的截图，按场景和视口区分 |
| [verification](../verification/) | 当前几何、交互、拖拽与响应式验证脚本 |
| [侧栏实测参考](../../docs/reference/emstudio-sidebar-measured-spec.md)、[顶栏实测参考](../../docs/reference/emstudio-topbar-measured-spec.md) | 外部参考测量；本产品行为以本索引下的文档为准 |
| [项目设计规则](../../docs/rules/design-and-verification.md) | 跨原型与产品适用的设计要求及验证经验 |

验证脚本从仓库根目录运行，例如 `node prototype/verification/verify-regression.mjs`。`PROTOTYPE_URL` 指定目标地址，`PROTOTYPE_EVIDENCE_DIR` 可覆盖截图输出目录。
