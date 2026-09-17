# API 指南

[返回主 README](../README.md)

## 基础 URL

- 本地 API 根地址：`http://localhost:4000/api`
- 上传文件访问地址：`http://localhost:4000/uploads/...`

## 健康检查

- `GET /api/health`

## 身份验证

- `POST /api/auth/login`
- `GET /api/auth/me`

除 `/api/health` 和 `/api/auth/login` 外，所有 `/api/*` 路由都需要 Bearer 令牌。

## 模块

- `GET /api/modules`

## 模板

- `GET /api/templates`
- `GET /api/templates?moduleId=lesson-planner`
- `POST /api/templates`
- `PUT /api/templates/:id`
- `DELETE /api/templates/:id`

## 排课组织器（Schedule Organizer）

- `GET /api/modules/schedule-organizer`
- `POST /api/modules/schedule-organizer`
- `PUT /api/modules/schedule-organizer/:id`
- `DELETE /api/modules/schedule-organizer/:id`

## 提醒中心（Reminder Center）

- `GET /api/modules/reminder-center`
- `POST /api/modules/reminder-center`
- `PUT /api/modules/reminder-center/:id`
- `DELETE /api/modules/reminder-center/:id`
- `POST /api/modules/reminder-center/:id/complete`

## 备课规划器（Lesson Planner）

- `GET /api/modules/lesson-planner`
- `POST /api/modules/lesson-planner`
- `PUT /api/modules/lesson-planner/:id`
- `DELETE /api/modules/lesson-planner/:id`
- `POST /api/modules/lesson-planner/:id/generate-worksheet-draft`

## 练习单设计器（Worksheet Designer）

- `GET /api/modules/worksheet-designer`
- `POST /api/modules/worksheet-designer`
- `PUT /api/modules/worksheet-designer/:id`
- `DELETE /api/modules/worksheet-designer/:id`
- `GET /api/modules/worksheet-designer/:id/export/spec`
- `GET /api/modules/worksheet-designer/:id/export/preview`
- `GET /api/modules/worksheet-designer/:id/export/docx`
- `GET /api/modules/worksheet-designer/:id/export/pdf`

## 资源库（Resource Vault）

- `GET /api/modules/resource-vault`
- `POST /api/modules/resource-vault/upload`
- `PUT /api/modules/resource-vault/:id`
- `DELETE /api/modules/resource-vault/:id`

## 说明

- 当前 API 面向本地和演示使用。
- 响应结构有意保持简单，主要是 `{ items }`、单个项目负载或 `{ success, item }`。
- 当前测试套件涵盖身份验证、CRUD 行为、迁移/引导、练习单生成、提醒周期和资源清理。
