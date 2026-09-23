# RESTORE-SHELL@1

- status: FAIL，候选可构建，但全部 UI/UX 恢复未完成，不作为上线放行。
- verification_level: self
- base_revision: d7b5849a4fe6d8b99fec275bb9a0a6c8870efa57
- runner: Codex，gpt-6-astra，low（任务指定）
- skills_used: diagnosing-bugs、writing-for-agents
- identity_mode: real-auth，隔离 HTTPS 测试账户
- authorization_used: RESTORE-SHELL@1 用户任务包
- session_id: unavailable

## 候选范围

原型侧栏组件、图标、国旗及样式迁入 apps/web/src/features/workbench/chrome；顶部首页/日程/支持菜单和搜索外观、首页欢迎区恢复。真实昵称经既有 ShellContext 传入。删除侧栏底部 AI 入口，业务页面右侧辅助栏保留。业务模块、数据库、认证目录、预览配置未修改。

CSS 使用原生 @scope，以 .wb-workspace 为排除边界，模块样式不进入原型 reset。适用浏览器须支持 @scope。账户认证挂载仍是 App 的 AuthProvider -> AuthGate -> WorkbenchRoot，无新接口要求。

## 已验证

运行 `npm run build:web`、`node apps/web/e2e/restore-shell/verify.mjs`。真实注册、Cookie 身份、刷新恢复、退出通过。五模块、日程、设置/帮助/更新菜单跳转通过。搜索弹层可打开关闭。侧栏 overflow-y 为 auto。主内容由既有模块分区承担滚动，此轮未逐个执行长内容滚动验收。

基线使用原 50880 同版本构建产物在隔离服务重现：同一验证脚本报 Prototype topbar missing。候选通过该断言。证据为同目录 home.png、settings.png、verify.log、baseline.log、build.log。截图内“外壳验收”为隔离环境真实注册账户，不是产品硬编码姓名。

## 未完成与接续条件

1. 学期无真实后端接口。候选无样本学期，创建的学期仅是账户隔离设备现场元数据，不能声称驱动业务分学期或复制数据；需在现有边界内明确如何恢复完整行为。语言选择也未接入产品翻译能力。
2. 分组/隐藏/排序使用现有 useScene 账户隔离本地保存，尚未读取旧服务端 workspaceLayouts，不能宣称跨设备恢复或旧布局迁入已完成。
3. 反馈、教程、隐私按钮仍跳到既有帮助/设置页，原型对应弹层尚未全部迁入；通知沿用真实业务组件，未完全对齐原型外观。
4. 拖放、学期弹窗、窄屏、所有模块独立滚动和恢复保护尚未完成定向回归；首页实际输入框仍沿用已有 Agent 组件，未逐像素对齐全部状态。
5. 50880 只打开到匿名登录页，未部署。维护者保留上线与用户数据权限。本候选不可报告为已上线或完整恢复。

无独立 review，无其他 session 联系，无 main 合并或 push。未达完成标准，因此保留 /tmp/rs 与隔离验证材料供接续。
