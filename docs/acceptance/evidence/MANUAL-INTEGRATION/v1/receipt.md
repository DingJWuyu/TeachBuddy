# MANUAL-INTEGRATION@1 集成准备回执

**PASS，限于集成基线准备。** 本树尚未收到七条业务实现的固定提交，全部手动业务尚未接入或验收。统一体验入口仍是预览树的 **https://localhost:50880**；本轮没有读取或修改预览工作树、服务、配置和数据。

## 固定输入与准备结果

| 项目 | 当前结果 |
| --- | --- |
| 工作树与分支 | `/home/liam_t/项目/TeacherWorkspace-manual-integration`，`integration/manual-business` |
| 固定起点 | `4db937daa4d5abd0a03f69917528665f94ebb001`，包含六模块基本流程候选及 `apps/web/e2e/business-mvp.spec.js` |
| 用户约束 | 全部非 Agent 手动业务尽快进入同一入口；Agent 线路暂停；预览写权交接前只操作本树 |
| 共享装配与依赖 | 当前六模块注册和现有锁文件保持不变；后续只按根给出的固定提交逐项处理应用入口、共享文件和 `package-lock.json` 冲突 |
| README | 改正集成树与预览树的归属，修复不存在的基本业务回执链接，写明预览运行与隔离构建入口 |

## 本树自检

- Node.js `22.23.2`、npm `10.9.8`；`npm ci --no-audit --no-fund` 通过。
- `TMPDIR` 指向本树忽略的独立目录执行 `npm run build` 通过：六模块目录校验通过，隔离 SQLite 应用 11 项迁移，Web 生产包生成。Vite 仍提示主包大于 500 kB，本轮没有变更分包策略。
- 用本树生成的临时 TLS 证书、独立 SQLite/文件/日志目录及 `50931` 端口启动生产组合。`/api/health`、`/`、`/questions` 均为 HTTP 200，发现并启用六模块。启动需要 `SMTP_HOST` 与 `SMTP_FROM`，本次使用本地占位值且未发邮件。
- 自检没有运行不变的全套测试，也没有使用预览库、凭据或 `50880` 端口。已有基本业务与预览来源证据仍以原候选和原场景为准，本轮烟测不替代浏览器业务验收。

## 固定成果到达后的接入

1. 根提供每条成果的完整提交 SHA、对应回执及写权交接后，核对提交的父版本、文件清单和可用范围，只引入指定固定提交。
2. 在本集成分支串行处理共享入口、公共样式、后端模块注册及依赖锁文件，保留各业务实现者的模块行为；冲突逐处解决并记录来源。依赖只执行一次统一安装，按实际变更做构建和定向验证。
3. 本树形成固定、可复核的组合候选后，按根的交接进入 `preview/usable-mvp`，保留用户的 `.scratch/preview/`、原配置及 `https://localhost:50880`，构建后重启既有服务并核对真实入口和数据。接入结果与仍缺的手动能力继续写本回执或后续集成回执。

```yaml
task: MANUAL-INTEGRATION@1
attempt: 1
role: integration
status: PASS
verification_level: self-preparation
runner: "Codex / gpt-6-sol / high"
skills_used: [writing-for-agents]
base_revision: "4db937daa4d5abd0a03f69917528665f94ebb001"
result_revision: "见包含本回执的分支提交"
inputs: ["4db937daa4d5abd0a03f69917528665f94ebb001", "控制树 docs/plans/run-state.md", "控制树 docs/plans/execution-protocol.md"]
changed_files: ["README.md", "docs/acceptance/evidence/MANUAL-INTEGRATION/v1/receipt.md"]
checks: ["npm ci PASS", "npm run build PASS", "隔离 HTTPS 服务三个入口 200"]
open_items: ["等待根提供七条业务固定提交及预览树写权交接", "全部手动业务组合验收未完成"]
next_condition: "收到根提供的固定提交和写权交接后恢复同一集成会话"
authorization_used: "MANUAL-INTEGRATION@1 / attempt 1 用户任务包"
```
