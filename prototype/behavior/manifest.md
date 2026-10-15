# TeachBuddy 原型行为索引

Status: Mixed (账户入口与既有外壳已验收；新增模块交互稿待改进与验收)

当前范围包含 TeachBuddy 的账户入口、工作台外壳和新增模块交互稿。首页现为 Agent 工作区，日程与三个模块已有首轮内容和跨模块交互，见[模块原型](modules.md)。新增页面和通知变化尚未通过用户视觉验收，旧外壳截图不能作为新模块的验收证据。

## 运行

从仓库根目录执行：

```bash
npm install
npm run prototype:sidebar
```

打开 <http://localhost:4174/>，先看到账户入口的登录卡。示例账户是 `example@example.com`，密码是 `teachbuddy`；验证码由模拟账户服务和场景脚本提供。构建命令为 `npm run prototype:build`。原型使用仓库已有的 React、Vite 依赖及共享基础样式，不需要启动 API。

## 认可范围与职责

`prototype/` 是可运行的设计参考，`apps/` 是当前产品实现。产品范围、现行账户/数据/交换语义与验收从[文档入口](../../docs/README.md)进入。下面的 Accepted 仅表示原型中已确认的体验范围；不能推导整个原型、当前产品或任何候选已验收。

| 参考入口 | 范围与认可状态 |
| --- | --- |
| [账户入口](auth.md)、[账户场景目录](auth-scenarios.md) | Accepted reference：J11-J13、J25；S14-S21、S36-S47；CA01-CA120，其中 CA53 明确暂缺，S42 不再产生 |
| [侧栏头部](sidebar-head.md)、[头部场景](sidebar-head-scenarios.md) | Accepted reference：J18-J24、S30-S35、CW48-CW51；学期和语言均为模拟 |
| [外壳](shell.md)、[导航](navigation.md)、[侧栏编辑](sidebar.md)、[顶部栏](topbar.md) | Mixed：既有外壳交互已确认；新增首页、模块入口/布局与日程通知变化待评审。各页保留 J/S 编号及参考体验 |
| [模块原型](modules.md) | Draft：Agent 首页、原型业务页、日程、共享右栏；固定回复、内存资料和旧页面不定义当前产品或待恢复功能 |
| [工作台场景](workbench-scenarios.md) | 当前原型工具覆盖与限制；旧 CW 场景只由固定版本承担溯源 |
| [视觉参考](visual-reference.md) | 少量认可视觉输入的用途和范围；不作为当前验证报告 |

已有用户确认继续有效，新增设计按实际选定范围处理。维护原型时更新对应行为的唯一拥有页和稳定场景 ID；改变认可范围须有相应用户确认。仓库整理和工具维护按本次授权执行，不启动新产品设计验收。

## 产物与维护

- [src](../src/)、[flags](../flags/)、[入口](../index.html)与[Vite配置](../vite.config.mjs)属于原型运行输入。20面国旗由源码动态导入，保留其运行归属。
- [verification](../verification/)保留可复用场景、采集与几何/交互断言；按场景目录选受影响检查，脚本存在不代表已经运行或适用于当前产品。
- `evidence/screenshots/` 只保留[视觉参考](visual-reference.md)逐项列出的设计输入；新增采集输出属于本次任务。历史报告不进入当前索引。
- [设计规则](../../docs/rules/design-and-verification.md)拥有跨原型与产品的设计要求。

## 验证输出

脚本从仓库根目录运行，先按所属场景页选择入口。`PROTOTYPE_URL` 指定隔离原型地址；工作台脚本通过 [session.mjs](../verification/session.mjs)界面登录。示例账户和内存状态只供原型，不能用来验证正式账户或真实数据。

[evidencePaths](../verification/evidence-paths.mjs)默认新建临时任务目录。`PROTOTYPE_EVIDENCE_DIR`、`PROTOTYPE_RESULTS_DIR` 可指定本次截图与结果位置，`PROTOTYPE_TEMP_DIR` 可指定临时目录父级。账户采集使用截图根目录，工作台采集使用其 `workbench/` 子目录。不要把输出参数指向认可视觉参考目录。

一次执行记录候选版本、场景/视口、通过/失败/未验及输出入口；结果保留或清理按[验证入口](../../docs/acceptance/README.md)执行。检查可用性和视觉后，只有明确被选作持续设计输入的图片才更新视觉参考，并写明用途及用户认可范围；通过结果不会自动替换认可输入。

## 历史溯源

固定 [71b6abf8](https://github.com/DingJWuyu/TeacherWorkspace/tree/71b6abf8aba732591906712f33eab520d00a80c0/prototype)保存整理前的场景表、截图和结果。它们不需要下载到当前工作树，不是运行前置，也不能证明当前候选通过。维护页只描述本参考当前职责，执行和修复过程留任务证据。
