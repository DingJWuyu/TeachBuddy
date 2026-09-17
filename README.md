# RefatOS

RefatOS 是一个模块化教师工作台，采用 monorepo 组织形式。它将备课、提醒、排课、练习单起草和资源存储整合到一个本地优先系统中，同时避免代码库变成相互纠缠的单体应用。

v1.3 已完成且稳定。代码库已准备好进行 v1.4 工作。

## 亮点

- 前后端模块化结构
- React + Vite Web 应用
- Express + SQLite API
- 教师账户开放注册与 Bearer 认证
- 从课程到练习单的自动化
- 规划流程中集成 Resource Vault
- 可编辑的练习单题目构建器
- 支持 DOCX、PDF 和预览导出
- 覆盖核心流程的 API 回归测试

## 模块

- 排课组织器（Schedule Organizer）
- 提醒中心（Reminder Center）
- 备课规划器（Lesson Planner）
- 练习单设计器（Worksheet Designer）
- 资源库（Resource Vault）

## 快速开始

```bash
npm install
npm run dev
```

应用：

- 前端 Web：`http://localhost:5173`
- 后端 API：`http://localhost:4000`

首次使用时，打开前端并选择“注册”创建教师账户。注册成功后会自动进入个人工作台。

## 仓库指南

从这里开始，然后进入你需要的部分：

- [安装指南](./docs/SETUP.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [API 指南](./docs/API.md)
- [更新日志](./CHANGELOG.md)
- [InfinityFree + Render 部署指南](./docs/DEPLOY_INFINITYFREE_RENDER.md)
- [路线图与发布说明](./docs/ROADMAP.md)

## 项目结构

```text
RefatOS/
  apps/
    api/        Express API、模块运行时、SQLite 持久化
    web/        React + Vite 前端
  packages/
    shared/     共享模块元数据和辅助工具
  docs/         安装、架构、API、路线图文档
```

## 技术栈

- 前端：React 19、Vite、Zustand
- 后端：Express 5、SQLite、`better-sqlite3`
- 导出：`docx`、`pdfkit`
- 上传：`multer`
- 测试：Node 测试运行器、`supertest`、Playwright
- 工具：npm workspaces、`npm-run-all`

## 当前状态

- v1.3 已完成全部功能
- SQLite 持久化已就绪
- 新安装的 SQLite 数据库从空结构开始，不会导入演示账户或业务数据
- 教师可以注册、退出并使用新凭据再次登录
- 备课和练习单流程现在使用 Resource Vault 选择器
- 练习单草稿支持在导出前按题目编辑

## 部署状态

项目可以使用类似 `InfinityFree + Render` 的前后端分离方案托管，但存在一些重要限制：

- 前端是静态应用，可以托管在免费的静态托管服务上
- 后端需要真实的 Node 服务器，因此必须运行在 Render 之类的服务上
- 当前后端将 SQLite 数据和上传文件存储在本地磁盘
- 因此当前部署适合演示、预览和轻量测试，不适合需要长期可靠性的生产环境

如果使用 InfinityFree + Render 方案，请参考：

- [InfinityFree + Render 部署指南](./docs/DEPLOY_INFINITYFREE_RENDER.md)

## 验证

```bash
npm run test:api
npm run test:e2e
npm run build
```
