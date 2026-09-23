# MANUAL-INTEGRATION@1 资源与备课固定成果接入

**PASS，集成者限定自检。** 在数学集成基线 `fd9cbbdc81aea934da5ee64fa641ee6e1d29af29` 之后，按指定顺序接入资源和备课各三笔固定提交。接入后的产品及来源证据组合候选为 `30d61fb44465e18352754aa3922556c0bb90ae51`；本报告提交形成后继交接点。来源 [资源回执](../../MANUAL-RESOURCES/v1/receipt.md) 与 [备课回执](../../MANUAL-LESSONS/v1/receipt.md) 均为 self，内部双轴审查的未解决发现为零；本次不重复源码审查或完整业务验收。数学独立验收仍未决。

## 固定提交

| 批次 | 来源 SHA | 本分支 SHA | 内容 |
| --- | --- | --- | --- |
| 资源 | `7fc81363e368996496b00805b36806d96c4f0ce3` | `3af2485cf039d680852570ba2597af413df4b576` | 资源预览、转换隔离中的普通超链接和手动操作 |
| 资源 | `f8da0116cf7b8288d3ced438cc37d45367c69cce` | `ed011833751b892411329750c6b116b56ac748a5` | 资源测试的备课 v3 接线 |
| 资源 | `8d56fedb6b8ce0fb9f0fe5a2b5d125e528e6067d` | `47f24dae4aa8484504b57487562e14fa818c2c08` | 来源回执及已有验证证据 |
| 备课 | `ec5e51b40455cb4e5917c544d7c95bcd3295ef22` | `72d7ef1f014739235fee057b579efe67671b637a` | 备课手动流程、顺序迁移与 v3 接口、页面来源返回 |
| 备课 | `e3dae0368f3ccb57a8046e144a56c53347d04449` | `fe605b4f798e83857967b4fa059ac4dfac018997` | 取材未知结果恢复 |
| 备课 | `a2dc8c711431b3c1318cdcafd225333da075d3e4` | `30d61fb44465e18352754aa3922556c0bb90ae51` | 来源回执、双轴审查与输出证据 |

资源三笔直接应用。备课产品提交只在 README 有文字冲突，已保留统一预览入口、Agent 暂停说明、资源与数学说明，并加入备课使用说明。`docs/contracts/workbench/math/math.openapi.json` 自动合流，核对后同时包含数学步骤 `description` 和备课 `/api/modules/lessons/v3/order`。来源的 `conversion-worker.mjs`、`Preview.jsx`、`FeedbackPanel.jsx`、`WorkbenchApp.jsx` 和备课领域代码均未手工改写。本批未增加依赖；新增迁移仅为来源的 `lessons_0003_order`。

## 本次接线检查

- 使用本树隔离 `TMPDIR` 执行 `npm run build` 通过：六模块目录、隔离 SQLite 12 项迁移、Web 生产包均成功。Vite 保留既有的大包提示。
- 定向执行 `node --test --test-name-pattern='lesson order|MC14 lessons Adapter' apps/api/test/lessons-order.test.js apps/api/test/materials-resources.test.js`，2/2 通过；核对排序的账户隔离、版本冲突、幂等重启及资源到备课 v3 的 HTTP 采用与更新。测试使用隔离库和临时目录。
- OpenAPI JSON 可解析，数学步骤说明与备课顺序路径同时存在；产品代码、README 和契约的 `git diff --check` 通过。来源提交内三份既有构建日志含 Vite 输出尾随空格，原样保留，不把整段证据日志的 `diff --check` 写成通过。

来源资源回执保留旧 DOC 对象/公式可能丢失的 `legacy-object-loss` 风险，以及完成预览后保库重开的验证边界；转换中断后仍需重试。目标 Word/WPS、课堂设备、iPad、大陆网络与正式部署验证暂缓。数学独立验收和全部手动业务组合验收尚未完成。

本批只操作 `integration/manual-business`。预览工作树、`50880` 服务、用户库、配置、凭据和产品 Agent 均未接触；注入的 `AGENTS.md` 改动保留且不提交。下一批固定输入由根主动通知后继续接入。

```yaml
task: MANUAL-INTEGRATION@1
attempt: 1
batch: MANUAL-RESOURCES+MANUAL-LESSONS
role: integration
status: PASS
verification_level: self-integration
runner: "Codex / gpt-6-sol / high"
skills_used: [writing-for-agents, resolving-merge-conflicts]
base_revision: "fd9cbbdc81aea934da5ee64fa641ee6e1d29af29"
source_revisions: ["7fc81363e368996496b00805b36806d96c4f0ce3", "f8da0116cf7b8288d3ced438cc37d45367c69cce", "8d56fedb6b8ce0fb9f0fe5a2b5d125e528e6067d", "ec5e51b40455cb4e5917c544d7c95bcd3295ef22", "e3dae0368f3ccb57a8046e144a56c53347d04449", "a2dc8c711431b3c1318cdcafd225333da075d3e4"]
combined_revision: "30d61fb44465e18352754aa3922556c0bb90ae51"
result_revision: "见包含本报告的提交"
checks: ["npm run build PASS", "备课顺序与资源接线定向 API 2/2 PASS", "合并 OpenAPI 解析及双字段 PASS", "产品/README/契约 diff check PASS"]
open_items: ["数学独立验收未决", "旧 DOC 对象丢失风险", "全部手动业务组合验收尚未完成", "预览树写权尚未交回"]
next_condition: "根通知下一批固定提交及适用写权后恢复本会话"
```
