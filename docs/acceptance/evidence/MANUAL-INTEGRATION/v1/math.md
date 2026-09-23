# MANUAL-INTEGRATION@1 数学固定成果接入

**PASS，集成者自检。** 数学固定成果已进入 `integration/manual-business`，组合候选为 `15b6ffc53d45511500e978b35a2d818dcf044d38`。本报告提交后以该提交的后继 revision 为固定交接点。来源 [MANUAL-MATH 回执](../../MANUAL-MATH/v1/receipt.md) 是 self；独立数学验收仍在进行，本报告不替代其结论，也不声明全部手动业务完成。

## 固定输入与合流

| 顺序 | 来源提交 | 本分支对应提交 | 内容 |
| --- | --- | --- | --- |
| 1 | `d38f956eaae985679751c78f54e5627dca639e92` | `2fc53c376682563f52d09d274ddbc63b7072b402` | 数学手动编辑、契约及共享离线演示 |
| 2 | `38ab193f98b218bb538f437ac1ca255945553ae5` | `8486fbf6ea14c4b18ae2846a99d901db5282c828` | 重名对象保护 |
| 3 | `cc5c014c8f6ffe7f859422361780ee18def3a3c0` | `15b6ffc53d45511500e978b35a2d818dcf044d38` | 来源回执、截图和 README 使用说明 |

基线为准备提交 `a49d512349466e5a35d784038707aa6efee75e27`，其产品起点是 `4db937daa4d5abd0a03f69917528665f94ebb001`。前两笔产品提交直接应用。第三笔仅 README 冲突：保留集成树与预览树的统一入口说明、Agent 暂停状态，并加入数学演示操作段落与来源回执链接。数学源码、OpenAPI 契约及共享 `presentation.js` 没有手工改写；本批未改依赖清单或锁文件。

## 限定验证

- `TMPDIR` 指向本树隔离目录执行 `npm run build`：六模块目录校验、隔离 SQLite 的 11 项迁移和 Web 生产构建通过。Vite 仍有既有的主包大于 500 kB 提示。
- `node --test apps/api/test/math-dynamic.test.js apps/api/test/math-contract.test.js`：2/2 通过，使用独立临时目录及证据目录；覆盖真实 HTTP 动态作品、持久与重启、离线输出和数学契约。没有重跑来源的浏览器全模块验收。
- 直接调用 `dynamicPresentation` 打包包含多行说明的动态源，确认离线 HTML 同时包含说明内容、步骤说明节点与保留换行的运行代码。此项只检查接线，不推定目标设备上的展示效果。
- `git diff --check` 通过；工作区只有用户注入的 `AGENTS.md` 未提交改动。

预览工作树、`50880` 服务、用户数据库与凭据未读取或修改。产品 Agent 线路未改。收到根提供的下一条固定业务提交后，继续在本分支接入；预览写权交接前不进行预览合流。

```yaml
task: MANUAL-INTEGRATION@1
attempt: 1
batch: MANUAL-MATH
role: integration
status: PASS
verification_level: self-integration
runner: "Codex / gpt-6-sol / high"
skills_used: [writing-for-agents, resolving-merge-conflicts]
base_revision: "a49d512349466e5a35d784038707aa6efee75e27"
source_revisions: ["d38f956eaae985679751c78f54e5627dca639e92", "38ab193f98b218bb538f437ac1ca255945553ae5", "cc5c014c8f6ffe7f859422361780ee18def3a3c0"]
result_revision: "见包含本报告的提交"
checks: ["npm run build PASS", "定向 API 2/2 PASS", "离线演示说明打包 PASS", "git diff --check PASS"]
open_items: ["独立数学验收尚未返回", "其他手动业务固定成果待接入", "预览树写权尚未交回"]
next_condition: "根通知下一批固定提交及适用写权后恢复本会话"
```
