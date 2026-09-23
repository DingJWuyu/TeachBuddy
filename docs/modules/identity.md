# 认证与邮件任务入口

当前产品已接入真实 Cookie 会话、邮箱验证码、注册、找回、恢复与退出。真实 QQ 邮件有用户反馈；物理跨设备、部署证书及完整目标环境并未全部通过。

- 语义与字段：[认证契约](../contracts/auth.md)、[案例](../contracts/auth-cases.md)、[OpenAPI](../contracts/auth.openapi.yaml)。
- 前后端接线：[认证架构](../arch/auth-implementation.md)、[UX](../ux/auth-integration.md)。
- 备份恢复撤销身份：从[数据管理](data.md)进入固定恢复操作，不自行补认证 SQL。

| 作用 | 入口 |
| --- | --- |
| 注册登录 UI 与会话 transport | `apps/web/src/features/auth/` |
| 认证模块、迁移与身份解析 | `apps/api/src/features/auth/` |
| 真邮件适配 | `apps/api/src/core/mail.js` |
| 应用挂载与配置 | `apps/api/src/app.js`、`apps/api/src/config/env.js` |
| 真实组合的隔离验证 | `apps/web/e2e/auth-integration.config.mjs`、`apps/api/test/auth-integration.test.js` |

修复应从用户看到的页面与实际 HTTP 路径复现。发信失败需要区分应用、SMTP 配置与网络分流，不通过读出/打印密钥诊断，也不擅改整机代理。

真实邮件发送仅在用户授权的收件范围内。测试收件器证明应用流程，不证明实际邮件到达；本轮是文档任务，不额外发信。运行配置位置见[运行指南](../SETUP.md)。
