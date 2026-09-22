# A11 本地真实认证接线回执

```yaml
task: A11@1
revision: v1
attempt: 2
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T06:14:21Z"
session_id: "01a0c7a8-94c8-7d91-9794-28a8ec499bfa"
runner: "Codex CLI; gpt-6-astra; effort=low（本 session turn_context 实测）"
skills_used: [implement, tdd, codebase-design, diagnosing-bugs, writing-for-agents, code-review]
base_revision: "e351677492bc0ea9901c1807a97a0f09a3da9a85"
result_revision: "7958e6d21220e95bfa6c7f5f4b9643c7fdabf211（固定产品候选）；本回执与证据索引由后继文档提交固定"
review_target:
  fixed_point: "e351677492bc0ea9901c1807a97a0f09a3da9a85"
  commit_range: "e351677492bc0ea9901c1807a97a0f09a3da9a85...7958e6d21220e95bfa6c7f5f4b9643c7fdabf211"
  standards: PASS
  spec: PASS
  aggregate: "docs/acceptance/evidence/A11/v1/review.md（含各轴实际审查范围与两个已关闭发现）"
internal_reviewers:
  - "standards_review; Codex CLI; gpt-6-astra; low; read-only leaf"
  - "spec_review; Codex CLI; gpt-6-astra; low; read-only leaf"
inputs:
  - "澄清 4f9985fee5e17b49e7a56fdf86f9e3a9a62f9cc7；在 TeacherWorkspace-auth-flow 只读消费 auth-handoff、auth-implementation 的 A11 段及 AUTH-FLOW-CLARIFICATION 作者回执"
  - "冻结设计 6f3003250d170b44e89f6ac9b0a74f91d658a357；冻结报告 63bfe8f7900b4a2bb7fc9ab5a4145f1c89a6f73b"
  - "后端实现 471f35c76233962401e8b9c3c0c62c6791ffde08；回执 281716faf277cc186235fb758ccda18d56674eda；限定一致性报告 c43c9ded87e15e7a1ea07af43ed33a192eae4470"
  - "前端实现 1601bccc94f8b147f3fef95cd7d127b257c3a71e；回执 cff597e5d5d05edd3daec4b3e045e92f98d19ea3"
  - "A10 交接 c966447f1e2dea83bd11871bca82d7981b276cb1；保留原 BLOCKED 结论"
  - "B16 工作台 612f0a9868743a1d5eea7e6f236d3ff903752439；独立 PASS d1ef0d5af8478677c04e6dd42bd3346f7883d1d0:docs/acceptance/evidence/B16/v1/attempt2.md"
  - "模型/实现/skill 条款：只读 TeacherWorkspace-mvp/docs/plans/execution-protocol.md；用户最新规则覆盖旧 dsh 路由"
changed_files:
  - "原样引入 apps/api/src/features/auth/ 与 apps/api/test/auth-contract-*、fixtures/auth-contract/"
  - "原样引入 apps/web/src/features/auth/ 与 apps/web/e2e/auth-contract-*、fixtures/auth-contract/"
  - "apps/api/src/{app.js,server.js,config/env.js,core/mail.js,scripts/verify-storage.js}"
  - "apps/api/test/{api.test.js,workbench-http.test.js,workbench-migrations.test.js,auth-integration.test.js,fixtures/auth-integration/harness.js}"
  - "apps/web/src/App.jsx；features/workbench/{WorkbenchRoot.jsx,WorkbenchApp.jsx,WorkbenchSettings.jsx,apiClient.js,workbench.css}"
  - "apps/web/e2e/auth-integration.spec.js、auth-integration.config.mjs；playwright.config.mjs"
  - ".env.example、README.md、docs/acceptance/evidence/A11/v1/author.md、review.md、attempt2/"
artifacts:
  - "attempt2/run.json：候选、真实模型与运行边界"
  - "attempt2/sha256.json：本轮日志、请求索引与截图校验值"
  - "attempt2/input-integrity.json：两端实现原样引入、冻结认证契约和根台账未变、澄清版本一致"
checks:
  - "npm ci：依赖安装成功"
  - "npm run build：PASS，含共享目录、隔离库完整认证装配、Web 生产构建；attempt2/final-build.log"
  - "npm run test:api：142 PASS；真实 HTTPS C19-C21、迁移/配置与原首流回归；attempt2/api.log"
  - "npm run test:e2e：8 PASS；实际产品、真实 Cookie/SQLite、本地 HTTPS、fake-mail；attempt2/browser.log"
  - "npx playwright test --config apps/web/e2e/fixtures/auth-contract/playwright.config.mjs：61 PASS；仅认证前端 HTTP 替身，attempt2/auth-substitute.log"
  - "git diff --check：PASS；本地冻结认证契约及根台账无改动"
identity_mode: "real-api/fake-mail（另列 auth frontend HTTP substitute 回归）"
open_items:
  - "A10-EXT-001/002：真实邮件提供者、授权收件箱、目标设备与跨设备/可信证书证据未取得，归 A12；不宣称 A12 PASS"
  - "A10-OPS-001：旧库备份恢复后撤销全部旧 Cookie 的方案和证明未完成，归 F60/F62/F65 及交付阶段"
  - "生产旧库迁移、生产部署与真实邮件配置均未执行，归交付拥有者"
failure_owner: null
next_condition: "A12 在 7958e6d 固定候选上独立验收，并取得真实邮件和目标设备条件；条件缺失时保持其门禁 BLOCKED"
authorization_used: "用户 A11@1 / attempt 2：独占本分支必要共享装配及提交；不合 main、不 push、不部署、不写根台账；外层负责唯一完成通知"
```

## 当前交付

共享 API 使用一个 SQLite：旧 schema 先于 auth_0001 至 auth_0007，迁移通过现有事务 ledger；auth module 就绪后绑定启动期 principal 委托，再加载业务模块，最后开放 HTTPS 端口。`auth_legacy_gaps` 非空拒绝启动，未派生昵称、未改写既有迁移。两类认证存储错误显式映射工作台 503，来源保护仍先于身份检查。旧 Bearer、me、找回和布局端点退役，test-principal 仅供隔离测试路径，不授权真实产品。

App 挂载既有 AuthProvider/AuthGate，context 与认证 accountKey 一致后才展示业务，目录及 15 个操作共用认证 transport。账户代次更换时卸载业务、终止旧传输并丢弃迟到响应；昵称显示与草稿 accountKey 分区分离。设置退出等待期间防重复，失败可重试，未知结果保留目标和业务锁。确认退出后仅经公开 logout/request 接缝重建浏览器容器，不自动恢复其他页面的 remembered 账户；认证目录内部保持原样。

`.env.example` 与 README 交接持久 `AUTH_CODE_SECRET`、默认开放注册开关、SMTP、SQLite 和本地同源 HTTPS。真实邮件适配只在提供者接受收件人时成功，不打印或假发验证码；测试以注入 fake-mail 代替邮件边界。

## 证据对应

| 要求 | 实测及证据 |
| --- | --- |
| C19 | pending context 401，active accountKey 一致；15 个操作真实 principal 成功，真实 UI 的 15 类请求均携带页面头，写入有保护头和幂等键。[API](attempt2/api.log)、[15 操作索引](attempt2/browser-15-operations.json) |
| C20 | 缺/空/31/33/非十六进制/合法未绑定页、仅页无 Cookie 的 15 操作均 401；叠加错误写来源先 403，拒绝不产生成功幂等记录。[API](attempt2/api.log) |
| C21 | page 刷新回登录，remembered 新页显式恢复相同账户；撤销/到期 401，两类存储不可读 503；真实浏览器迟到结果不进入新账户，草稿返回原账户恢复。[API](attempt2/api.log)、[浏览器](attempt2/browser.log)、[隔离截图](attempt2/account-isolation.png) |
| 设置退出 | 204、SQLite trigger 导致已知失败、服务器提交后丢响应、同目标重试、I06 确认、刷新与重登；同浏览器双账户定向退出保留另一页会话。[浏览器](attempt2/browser.log)、[未知结果截图](attempt2/logout-unconfirmed.png) |
| 首流回归 | 实际 UI 保存、编辑、复制、删除题目与备课；丢失成功响应后同 key/body 重试；API 原首流协议/隔离回归均通过。[API](attempt2/api.log)、[浏览器](attempt2/browser.log) |
| 迁移/启动 | 空库、隔离旧库及再次启动保留 accountKey/旧凭据/布局；7 项认证 ledger 无重复；昵称缺口、缺密钥、非 HTTPS、缺 TLS 拒绝。[API](attempt2/api.log) |
| 视觉 | 1440×900、820×1180、390×844 实际截图人工检查；长昵称单行省略、全文可访问、无横向溢出。[桌面](attempt2/desktop-settings.png)、[平板](attempt2/tablet-account.png)、[手机](attempt2/mobile-account.png) |
| 内部审查 | Standards PASS；Spec 两项 P1 先红后绿并定向确认关闭。[双轴报告](review.md) |

`A10-INT-001/002` 与 `AUTH-ALIGN-003` 在本地 self 范围关闭。运行入口会创建隔离临时库、自签证书与 fake-mail；浏览器经正常注册/登录取得 Cookie，未手工注入。浏览器测试信任本地自签证书和模拟视口，不是物理设备或外部收信证据。初始失败及两次退出红回归保留为正式证据；原 preparation、A10、B16 证据不改写。
