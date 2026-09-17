# 架构说明

[返回主 README](../README.md)

## 概览

RefatOS 是一个 monorepo，包含一个小型共享包和两个可运行的应用：

- `apps/web`：React + Vite 前端
- `apps/api`：使用 SQLite 持久化的 Express 后端
- `packages/shared`：共享元数据和辅助工具

核心设计目标是支持模块化扩展。每个功能领域都作为独立模块处理，而不是把所有逻辑都添加到一个中心应用层中。

## 后端结构

后端的重要区域：

- `apps/api/src/app.js`：供运行时和测试使用的应用工厂
- `apps/api/src/server.js`：服务器入口
- `apps/api/src/core/dataStore.js`：基于 SQLite 的集中式持久化
- `apps/api/src/core/workspaceLayout.js`：按教师账户解析、校验并协调工作台布局
- `apps/api/src/core/moduleRegistry.js`：后端模块注册
- `apps/api/src/events/eventBus.js`：用于跨模块自动化的事件总线
- `apps/api/src/modules/*`：功能模块

## 前端结构

前端的重要区域：

- `apps/web/src/App.jsx`：应用外壳和当前模块渲染
- `apps/web/src/hooks/useWorkspaceData.js`：API 加载与操作编排
- `apps/web/src/features/modules/moduleRegistry.js`：前端模块注册
- `apps/web/src/features/settings/WorkspaceSettingsPanel.jsx`：模块可见性与工作台布局设置
- `apps/web/src/features/*`：各模块面板
- `apps/web/src/components/*`：可复用的 UI 组件

## 模块模型

当前模块：

- 排课组织器（Schedule Organizer）
- 提醒中心（Reminder Center）
- 备课规划器（Lesson Planner）
- 练习单设计器（Worksheet Designer）
- 资源库（Resource Vault）

每个模块在前端拥有自己的面板，在后端拥有自己的路由注册。

## 存储模型

运行时持久化基于 SQLite。

- 主数据库：`apps/api/src/data/refatos.sqlite`

新安装的数据库只创建空结构。账户和业务数据由教师通过开放注册和后续工作台操作显式创建。

存储层保留现有的高层 CRUD 契约，因此模块通过一个中心抽象与存储交互，而不是直接执行 SQL。

课程表、提醒、备课、练习单、资源库和模板均在记录中保存 `ownerId`，并通过 `dataStore.forAccount(accountId)` 提供账户级列表、读取、创建、更新和删除接缝。跨模块引用会先通过当前账户接缝校验所属关系；上传文件不通过公开静态目录读取，而是由资源路由认证后检查所有者。

每个教师账户拥有一条工作台布局记录。记录将 `hiddenModuleIds` 与有序的 `groups`、`ungroupedModuleIds` 分开保存；保存时校验分组标识唯一且每个注册模块最多出现一次，删除分组会按原相对顺序把模块追加到“未分组”。读取时会根据当前模块目录补齐新模块，隐藏只影响前端组合，不会阻止模块路由或事件自动化。设置页使用原生拖拽并提供键盘排序和跨组选择操作。

为了保持存储接缝简单，包含大量数组的字段会以 JSON 数据块形式存储在 SQLite 中。

## 跨模块行为

当前的跨模块自动化通过后端事件和 API 流程实现。例如：

- 创建课程可以创建相关提醒
- 课程可以生成练习单草稿

与把所有内容硬编码到一个模块中相比，这样可以保持更清晰的模块边界。

账户入口由应用外壳提供开放注册、登录和密码找回。新数据库从空结构开始；教师账户不属于组织，也没有成员、角色或管理员后台。工作台布局属于当前教师账户，模块可见性只影响展示，不影响模块路由、数据访问或自动化。
