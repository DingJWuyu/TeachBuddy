# 安装指南

[返回主 README](../README.md)

## 环境要求

- 建议使用 Node.js 20 或更高版本
- npm

本地开发不需要外部数据库或额外服务。

## 安装

```bash
npm install
```

## 运行应用

```bash
npm run dev
```

默认本地地址：

- 前端 Web：`http://localhost:5173`
- 后端 API：`http://localhost:4000`

## 测试与构建

运行 API 回归测试：

```bash
npm run test:api
```

运行浏览器端到端测试（会启动真实 Web、API 和临时 SQLite）：

```bash
npx playwright install chromium
npm run test:e2e
```

运行完整构建：

```bash
npm run build
```

首次使用时，在前端选择“注册”创建教师账户。注册成功后会自动进入工作台。

## 数据与文件

- 运行时 SQLite 数据库：`apps/api/src/data/refatos.sqlite`
- 上传目录：`apps/api/src/uploads`
- 导出目录：`apps/api/src/exports`

## 环境说明

API 可以通过以下环境变量进行配置：

- `PORT`
- `AUTH_SECRET`
- `CORS_ORIGINS`
- `SQLITE_PATH`
- `DATABASE_URL`
- `UPLOAD_DIR`
- `EXPORT_DIR`
- `SMTP_HOST`
- `SMTP_PORT`（默认 `587`）
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMTP_SECURE`（`true`/`false`，默认 `false`）

`SQLITE_PATH` 或 `DATABASE_URL` 可以覆盖默认的 SQLite 文件位置。

密码找回邮件使用标准 SMTP 配置直接发送。开发环境未配置 `SMTP_HOST` 时，验证码只写入 API 服务端日志；生产环境应配置完整 SMTP 参数，不会把验证码放入 API 响应。
