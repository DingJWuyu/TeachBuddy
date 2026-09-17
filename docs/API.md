# API 指南

[返回主 README](../README.md)

## 基础 URL

- 本地 API 根地址：`http://localhost:4000/api`
- 上传文件访问地址：`http://localhost:4000/uploads/...`

## 健康检查

- `GET /api/health`

## 身份验证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

除 `/api/health`、`/api/auth/register` 和 `/api/auth/login` 外，所有 `/api/*` 路由都需要 Bearer 令牌。

注册请求接受 `name`、`email`、`password` 和 `passwordConfirmation`，邮箱会规范化为小写并保持唯一。成功响应与登录一致，返回 `{ token, user }`。

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
- `GET /api/modules/schedule-organizer/:id`
- `POST /api/modules/schedule-organizer`
- `PUT /api/modules/schedule-organizer/:id`
- `DELETE /api/modules/schedule-organizer/:id`

排课记录归属于当前 Bearer 令牌对应的教师账户。列表、单条读取、创建、更新、删除和时段冲突校验均只作用于当前账户；访问其他账户的记录按不存在处理。

## 提醒中心（Reminder Center）

- `GET /api/modules/reminder-center`
- `GET /api/modules/reminder-center/:id`
- `POST /api/modules/reminder-center`
- `PUT /api/modules/reminder-center/:id`
- `DELETE /api/modules/reminder-center/:id`
- `POST /api/modules/reminder-center/:id/complete`

提醒记录归属于当前 Bearer 令牌对应的教师账户。列表、单条读取、创建、更新、完成、删除、周期派生和备课触发提醒均只作用于当前账户；访问其他账户的记录或跨账户关联按不存在处理。

## 备课规划器（Lesson Planner）

- `GET /api/modules/lesson-planner`
- `GET /api/modules/lesson-planner/:id`
- `POST /api/modules/lesson-planner`
- `PUT /api/modules/lesson-planner/:id`
- `DELETE /api/modules/lesson-planner/:id`
- `POST /api/modules/lesson-planner/:id/generate-worksheet-draft`

备课计划归属于当前 Bearer 令牌对应的教师账户。列表、单条读取、创建、更新、删除以及由备课触发的提醒均只作用于当前账户；访问其他账户的计划按不存在处理。

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

- 当前 API 面向本地和个人教师工作台使用。
- 响应结构有意保持简单，主要是 `{ items }`、单个项目负载或 `{ success, item }`。
- 当前测试套件涵盖空库注册、身份验证、CRUD 行为、练习单生成、提醒周期和资源清理。
