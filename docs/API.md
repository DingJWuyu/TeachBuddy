# API 指南

[返回主 README](../README.md)

## 基础 URL

- 本地 API 根地址：`http://localhost:4000/api`
- 上传文件不提供公开静态访问，必须通过资源接口并携带 Bearer 令牌读取。

## 健康检查

- `GET /api/health`

## 身份验证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `GET /api/auth/me`

除 `/api/health`、`/api/auth/register`、`/api/auth/login` 和两个密码找回接口外，所有 `/api/*` 路由都需要 Bearer 令牌。

注册请求接受 `name`、`email`、`password` 和 `passwordConfirmation`，邮箱会规范化为小写并保持唯一。成功响应与登录一致，返回 `{ token, user }`。

密码找回请求接受 `{ email }`，无论邮箱是否对应账户都返回统一的 202 响应，验证码不会出现在响应中。已存在的账户会收到 6 位数字验证码；验证码保存为非明文形式，10 分钟后过期，并在成功确认后立即失效。

密码找回确认请求接受 `{ email, code, password, passwordConfirmation }`，成功后返回 `{ message }`。新密码替换旧密码，注册流程不会发送邮件或验证码。

## 模块

- `GET /api/modules`

## 工作台布局

- `GET /api/workspace/layout`
- `PUT /api/workspace/layout`

工作台布局按当前教师账户保存，响应包含分开的 `hiddenModuleIds`、`groups` 和 `ungroupedModuleIds` 字段。分组及组内模块数组的顺序就是工作台展示顺序；分组标识必须唯一，模块不能出现在多个位置。隐藏模块仍保留在位置数据中；删除分组时，其模块按原相对顺序追加到“未分组”；读取或保存布局时，目录中新出现的模块会默认显示并追加到“未分组”。核心入口和设置不属于可隐藏模块。

## 模板

- `GET /api/templates`
- `GET /api/templates?moduleId=lesson-planner`
- `POST /api/templates`
- `PUT /api/templates/:id`
- `DELETE /api/templates/:id`

模板列表、筛选、创建、更新和删除均只作用于当前 Bearer 令牌对应的教师账户。

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
- `GET /api/modules/worksheet-designer/:id`
- `POST /api/modules/worksheet-designer`
- `PUT /api/modules/worksheet-designer/:id`
- `DELETE /api/modules/worksheet-designer/:id`
- `GET /api/modules/worksheet-designer/:id/export/spec`
- `GET /api/modules/worksheet-designer/:id/export/preview`
- `GET /api/modules/worksheet-designer/:id/export/docx`
- `GET /api/modules/worksheet-designer/:id/export/pdf`

练习单列表、单条读取、创建、更新、删除和导出均只作用于当前教师账户。练习单引用的资源和备课计划也必须属于当前账户。

## 资源库（Resource Vault）

- `GET /api/modules/resource-vault`
- `POST /api/modules/resource-vault/upload`
- `GET /api/modules/resource-vault/:id/file`
- `PUT /api/modules/resource-vault/:id`
- `DELETE /api/modules/resource-vault/:id`

资源元数据和物理文件均归属于当前教师账户。文件只能通过 `GET /api/modules/resource-vault/:id/file` 认证读取，访问其他账户资源按不存在处理；删除资源会清理当前账户对应的物理文件。

## 说明

- 当前 API 面向本地和个人教师工作台使用。
- 响应结构有意保持简单，主要是 `{ items }`、单个项目负载或 `{ success, item }`。
- 当前测试套件涵盖空库注册、身份验证、CRUD 行为、练习单生成、提醒周期和资源清理。
