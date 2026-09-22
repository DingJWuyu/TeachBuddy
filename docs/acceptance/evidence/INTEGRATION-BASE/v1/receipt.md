# INTEGRATION-BASE@1 attempt 1 回执

本次完成固定 Git 合流，形成可供 F61 继续开发的分支候选。六模块在本候选中可构建和以真实认证、隔离 SQLite 启动；C26 Agent 源文件已保留，但尚未接入合流后的应用入口。本回执仅为集成准备的 self 结果，不是 F61、组合独立验收或 MVP 通过。

## 固定输入与合流

| 项目 | 固定版本或处理 |
| --- | --- |
| main 起点 | `3eec17ac8c4b9786f6d67008d8165f3c5aa10e5a` |
| 六模块 | `3d5c3f308bfeaa0e038a9fb86e6dab2816b9ec7c`，合并父提交为 `d10194b26cf092062acfed238e4d232a2e36de60` |
| 早期 Agent | `ec5094c00d122c77d2acdb376f4ede96eafb13e0`，产品 `687121ec8d9afeccb527d2738f8b1ca22791dd69`，合并提交 `2d26136` 的第二父提交即该完整对象 |
| TT-C7 测试修复 | 仅摘入 `baaeb09973cd01848432622e35712b74627f4488`，对应报告 `f9f6776eaa0d4035c94158d12092ba2587fa3e00`，本分支提交 `3f14faa1a3996efba1bfbec711c955ce9cdf536b`；未取 `006b4def` |
| 来源结论 | R34 `protection-fix.md`、C26 `author.md` 和 `math-layout-fix.md`；R35 `efd3b071a603d38902688b0b4dd68289e8516c69` 与 C27 `6d48bc7f214a6b27e51b3a8cbdfa6cffc212f4d1` 只供各自局部范围参考，不相加为组合通过 |
| 分支 | `integration/integration-base-1`；不合 main、不 push、不部署 |

R34 先经正常 Git merge。C26 再经正常 Git merge，52 个同文件冲突以 R34 侧为共享业务基线；独立的 `apps/api/src/agent/` 和 `apps/web/src/features/agent/` 与 C26 固定对象逐字一致。`apps/api/src/modules/{questions,lessons}/operations.js` 是 C26 新增的共用业务操作文件，保留原字节，但尚未接线。`apps/api/package.json` 增入 C26 的三个 pi 包，`apps/web/package.json` 增入 React Markdown、数学插件并统一 KaTeX 版本，`package-lock.json` 经 `npm install --package-lock-only` 合并。根 `package.json` 的 Agent 验证入口由 Git 自动合并。根 AGENTS、CONTEXT、README、执行协议、DAG、台账、ROADMAP 相对本次 main 起点未改。没有从 R34-PANDOC 活动 HEAD 取文件，也没有导入 F60 新功能或 81 工具。

共享冲突的归属：`apps/api/src/app.js`、`workbench/index.js` 和 `moduleLoader.js` 需要 F61 将 Agent 路由、迁移和工具接到 R34 六模块组合；`apps/web/src/features/workbench/AuxiliaryPanel.jsx`、`WorkbenchRoot.jsx`、`WorkbenchApp.jsx`、模块注册及共享样式需要 F61 接入首页/右栏。题库与备课的 router、service、repository、Document 编辑和保护文件保留 R34 侧，F61 应按当前真实业务契约适配 C26 operations 与工具，不能直接用 C26 旧文件覆盖。API env、共享目录、验证夹具也需按本候选逐处检查。此次未写适配代码或更改冻结契约。

## 实际运行核对

在本 worktree 以 Node 22.23.2 执行 `npm ci --ignore-scripts` 后重建 `better-sqlite3`；`npm run build` 通过，六模块目录核验通过、空库应用 11 项迁移、Web 生产包生成。首次构建因安装时跳过 native install 而失败，重建后通过，不是产品问题。Vite 保留大 chunk 提示。

使用新目录 `/tmp/integration-base-v1-run`、独占 50771 端口和新生成的本地测试证书启动 `R34_DATA_DIR=/tmp/integration-base-v1-run R34_PORT=50771 node apps/web/e2e/fixtures/materials-integration/server.mjs`。这是假邮件、无模型配置的隔离运行，不是正式部署。普通浏览器 1280×800 打开生产页面，登录页 200 且布局可读，[截图](login.png)；未认证 `GET /api/modules` 返回 401，`GET /api/auth/session` 在缺浏览器上下文时返回 409，`GET /api/agent/conversations` 返回 404。服务已 SIGINT 退出，50771 无监听。没有发产品模型请求，也未读取真实密钥、用户数据库或证书目录。

- `node --test apps/api/test/materials-protection.test.js apps/api/test/teaching-time-reminders.test.js`：12/12 通过，[日志](focused.log)。覆盖未知内容保护及 TT-C7 指定测试。
- `npm run test:api`：299/330 通过、31 失败，[完整日志](api.log.gz)。22 项 Agent 测试因 404/未初始化 Agent 表和对象失败，是共享入口未接线的当前组合缺口。其余 9 项中 8 项涉及既有 Office/输出环境或导出路径，1 项旧库升级夹具 `git archive 2682475...` 的 pathspec 失败；未把它们解释为产品通过或改写测试掩盖。首次未配置 `MATERIALS_OFFICE_ROOT`，本次不沿用 R34 的 Office 通过结论。
- 未运行 Agent 浏览器真业务链、目标 Office 输出或完整 MVP 验收。没有用固定 AI 答案冒充 Agent。

全量测试会写旧证据路径；写出的 12 个跟踪文件版本已保存在 `/tmp/integration-base-test-generated/` 后恢复 Git 原字节，额外 `apps/api/docs/` 和 `M42/` 输出也移到该目录。原始隔离 SQLite、假邮件目录、日志和运行截图保留供 F61 复现；没有覆盖来源工作树。运行结束 Git 工作区只包含本回执与本轮证据。

## 交接

F61 从本分支最终提交建自己的隔离 worktree 和数据目录，先按上述 `npm ci`、native 重建、`npm run build` 和 R34 启动命令复现。优先关闭 `/api/agent/conversations` 404，检查 Agent 迁移、真实身份和 13 工具调用是否与当前题库/备课 operations 一致，再重跑 Agent/API/浏览器回归。共享冲突不得通过整文件覆盖旧 R34 保护。后继须使用本候选的新证据判断组合状态，原 R34/R35 与 C26/C27 证据只证明各自固定来源。目标 Office 失败及全套回归差额单独处理。

```yaml
task: INTEGRATION-BASE@1
attempt: 1
role: integration
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T19:56:08Z"
session_id: unavailable
runner: "Codex / gpt-6-sol / medium"
skills_used: []
base_revision: "3eec17ac8c4b9786f6d67008d8165f3c5aa10e5a"
result_revision: "本回执提交的完整 SHA 由最终回调提供"
review_target: {fixed_point: not-applicable, commit_range: not-applicable, standards: not-applicable, spec: not-applicable, aggregate: not-applicable}
internal_reviewers: []
inputs: ["3d5c3f308bfeaa0e038a9fb86e6dab2816b9ec7c", "ec5094c00d122c77d2acdb376f4ede96eafb13e0", "baaeb09973cd01848432622e35712b74627f4488"]
changed_files: ["固定 R34/C26 Git 合流及锁文件", "TT-C7 单提交", "docs/acceptance/evidence/INTEGRATION-BASE/v1/"]
artifacts: ["本回执", "api.log.gz", "focused.log", "login.png", "/tmp/integration-base-v1-run", "/tmp/integration-base-test-generated"]
checks: ["build PASS", "隔离 HTTPS 页面与 HTTP 核对", "材料保护/TT-C7 12/12", "API 299/330，缺口已归属"]
identity_mode: "real-auth/fake-mail 页面；部分 API 测试为 test-principal"
open_items: ["F61 接线及组合回归", "Office/输出环境和旧库升级夹具 9 项差额", "目标 Office 原失败和独立全组合验收"]
failure_owner: "Agent 接线为 F61；其余失败按后继运行环境及原模块验收归属"
next_condition: "F61 消费本分支完整 SHA，在独占 worktree/库/端口接线并重新验证"
authorization_used: "本轮用户 INTEGRATION-BASE@1 attempt 1 授权固定 Git 合流、必要依赖锁文件和隔离运行核对"
```
