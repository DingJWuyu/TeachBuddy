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

运行完整构建：

```bash
npm run build
```

## 演示登录

- 邮箱：`refat@local.test`
- 密码：`refatos123`

## 数据与文件

- 运行时 SQLite 数据库：`apps/api/src/data/refatos.sqlite`
- 旧版引导数据源：`apps/api/src/data/store.json`
- 上传目录：`apps/api/src/uploads`
- 导出目录：`apps/api/src/exports`

## 环境说明

API 可以通过以下环境变量进行配置：

- `PORT`
- `AUTH_SECRET`
- `DEMO_PASSWORD`
- `CORS_ORIGINS`
- `SQLITE_PATH`
- `DATABASE_URL`
- `UPLOAD_DIR`
- `EXPORT_DIR`
- `LEGACY_STORE_PATH`

`SQLITE_PATH` 或 `DATABASE_URL` 可以覆盖默认的 SQLite 文件位置。
