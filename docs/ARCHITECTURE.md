# 架构说明

[返回主 README](../README.md)

## 结构

仓库采用 npm workspaces：

- apps/web：React + Vite 工作台外壳、账户入口、首页、设置和侧栏布局编辑
- apps/api：Express 应用工厂、认证、密码找回、SQLite 和布局 API
- packages/shared：中性模块注册契约与当前为空的模块目录

## 工作台外壳

工作台外壳始终提供首页和设置。首页不依赖模块数据；模块目录为空时，主内容区域保持空白，不渲染统计、卡片、快捷操作或占位内容。

WorkspaceSidebar 负责教师账户的布局偏好：

- 创建、重命名和删除分组
- 分组排序
- 未来模块在分组或未分组区域中的拖拽、移动和排序
- 设置页中的模块可见性

布局偏好只影响展示，不改变账户认证边界或未来模块的业务行为。

## 模块注册契约

共享包导出空的 moduleCatalog 和 buildManifest。buildManifest 只提供中性默认值和模块自身声明的字段，不要求模块向首页贡献任何聚合内容。

未来模块可以在自己的实现中声明：

- 身份信息
- 侧栏入口
- 自有面板
- 后端能力和注册函数

后端和前端各自保留 registry seam；当前注册数组为空，因此 API 的模块列表为空，模块目录没有运行时贡献。

## 后端边界

apps/api/src/app.js 负责公共路由、认证中间件和布局路由。apps/api/src/core/moduleRegistry.js 只协调未来模块注册，不携带业务实现。

认证使用 Bearer 令牌。注册、登录和密码找回由外壳直接提供，账户不属于组织，也不包含管理员或成员管理能力。

## 持久化

SQLite 数据存储保留以下基础结构：

- users：教师账户身份和密码摘要
- passwordResetCodes：短期、一次性的找回密码验证码摘要
- workspaceLayouts：按账户保存的布局偏好

app_metadata 用于保留通用应用元数据接缝。账户存储通过 dataStore.forAccount(accountId) 提供隔离的列表、读取、创建、更新和删除接口，工作台外壳只使用布局记录。

新建数据库只创建账户认证和工作台底座所需结构，不创建功能模块业务表。

## 运行与验证

API 使用 Node 测试运行器和 supertest，浏览器验收使用真实 Web、API 和临时 SQLite。完整验证入口见 README。
