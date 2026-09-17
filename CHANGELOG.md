# 更新日志

本文件面向两类读者：

- 面向版本读者的简要公开更新日志
- 用于项目跟踪的详细工程日志

## 公开更新日志

### 未发布

- 在主 README 中增加部署状态警告，使托管限制在仓库首页清晰可见
- 在根目录 `AGENTS.md` 中增加规则，要求在仓库发生实质性变更后更新 `CHANGELOG.md`

### v1.3 已完成

RefatOS v1.3 已告一段落，项目从本地原型方向发展为可用的模块化教师工作台。

主要成果：

- 增加演示身份验证和受保护的 API 路由
- 增加带有下一次提醒自动化的周期性提醒
- 增加从课程到练习单的草稿生成
- 增加预览 HTML、DOCX 和 PDF 的练习单导出支持
- 增加 Resource Vault 模块
- 将基于文件的 JSON 持久化替换为 SQLite
- 增加覆盖身份验证、CRUD、迁移、自动化和上传功能的 API 回归测试
- 在备课和练习单流程中增加 Resource Vault 选择器
- 增加导出前可编辑的练习单题目条目结构
- 将仓库文档整理为适合 GitHub 使用的 README 及其关联文档
- 为 InfinityFree 前端托管和 Render 后端托管做好项目准备

### v1.3 后部署更新

- 增加基于环境变量的前端 API URL 配置
- 通过环境变量增加后端 CORS 白名单
- 增加 InfinityFree + Render 部署指南
- 放宽 CORS 主机名匹配，以更好地处理 `http`/`https` 以及 `www`/非 `www` 的差异

## 工程日志

## 未发布工作记录

- 在 `README.md` 中增加“部署状态”部分
  - 说明静态前端托管较为简单
  - 说明当前后端仍依赖 Node 托管，并使用本地磁盘存储 SQLite 数据和上传文件
  - 直接链接到 InfinityFree + Render 指南
- 增加根目录 `AGENTS.md`
  - 记录仓库本地规则，要求未来的实质性变更同时更新 `CHANGELOG.md`

## 仓库历史

当前仓库中目前跟踪的 Git 提交：

1. `a5e324a` - `Initial v1.3 release`（v1.3 初始发布）
2. `4cfc5f3` - `Prepare InfinityFree and Render deployment`（准备 InfinityFree 和 Render 部署）
3. `987d811` - `Relax CORS origin hostname matching`（放宽 CORS 来源主机名匹配）

重要说明：

- Git 历史是在大量工作已经完成之后才开始记录的。
- 因此，本工程日志对于已跟踪的仓库历史是精确的；对于更早的项目演进，则是根据现有项目说明和当前代码库尽力重建的记录。

## 提交：`a5e324a` - Initial v1.3 release（v1.3 初始发布）

此提交引入了当前应用的完整已跟踪基线。

### 后端新增

- 在 `apps/api/src/app.js` 中增加 Express 应用工厂
- 在 `apps/api/src/server.js` 中增加运行时服务器引导
- 在 `apps/api/src/config/env.js` 中增加环境变量/配置加载器
- 在 `apps/api/src/core/auth.js` 中增加身份验证令牌和密码工具
- 在 `apps/api/src/core/dataStore.js` 中增加基于 SQLite 的集中式存储
- 在 `apps/api/src/core/moduleRegistry.js` 中增加后端模块注册表
- 在 `apps/api/src/core/validation.js` 中增加验证辅助工具
- 在 `apps/api/src/data/store.json` 中增加带种子的旧版数据
- 在 `apps/api/src/events/eventBus.js` 中增加后端事件总线
- 增加 `errorHandler`、`notFound` 和 `requireAuth` 中间件
- 在 `apps/api/src/scripts/verify-storage.js` 中增加存储验证构建脚本
- 在 `apps/api/test/api.test.js` 中增加 API 回归测试

### 后端新增模块

- `apps/api/src/modules/schedule-organizer/index.js`
- `apps/api/src/modules/reminder-center/index.js`
- `apps/api/src/modules/lesson-planner/index.js`
- `apps/api/src/modules/worksheet-designer/index.js`
- `apps/api/src/modules/resource-vault/index.js`

### 后端新增行为

- 使用签名 Bearer 令牌的演示登录
- 支持密码哈希
- 受保护的 `/api/*` 路由
- 模板 CRUD 端点
- 提醒周期完成流程
- 课程创建提醒自动化
- 从课程到练习单的生成端点
- 练习单导出规格端点
- 练习单预览 HTML 端点
- 练习单 DOCX 导出端点
- 练习单 PDF 导出端点
- 资源上传、元数据更新和删除端点
- 从旧版 `store.json` 引导导入 SQLite
- 无现有数据源时的种子数据回退

### 前端新增

- 在 `apps/web/src/App.jsx` 中增加应用外壳
- 在 `apps/web/src/main.jsx` 中增加前端入口
- 增加可复用的 UI 组件：
  - `LoginCard.jsx`
  - `ModuleCard.jsx`
  - `StatCard.jsx`
  - `ResourcePicker.jsx`
- 增加模块面板：
  - `dashboard/DashboardPanel.jsx`
  - `lesson-planner/Panel.jsx`
  - `reminder-center/Panel.jsx`
  - `resource-vault/Panel.jsx`
  - `schedule-organizer/Panel.jsx`
  - `worksheet-designer/Panel.jsx`
- 在 `apps/web/src/features/modules/moduleRegistry.js` 中增加前端模块注册表
- 在 `apps/web/src/hooks/useWorkspaceData.js` 中增加共享工作区加载/操作钩子
- 在 `apps/web/src/store/useAppStore.js` 中增加 Zustand 应用状态
- 在 `apps/web/src/utils/api.js` 中增加前端 API 工具层
- 在 `apps/web/src/styles/global.css` 中增加全局样式
- 在 `apps/web/vite.config.js` 中增加 Vite 配置

### 前端新增行为

- 登录流程
- 从共享应用外壳切换模块
- 工作区加载和刷新流程
- 提示、错误和加载状态处理
- 仪表盘摘要卡片
- 排课面板视图
- 提醒筛选和周期编辑
- 课程模板支持
- 练习单模板支持
- 将资源选择集成到备课流程
- 将资源选择集成到练习单流程
- 可编辑的练习单题目条目编辑器
- 更清晰的 UI 文案并移除乱码问题

### 共享包/工作区新增

- 在 `packages/shared/src/index.js` 中增加共享元数据辅助工具
- 增加根目录、api、web 和 shared 包的包清单
- 增加根目录 `.gitignore`
- 增加 MIT `LICENSE`
- 增加 package-lock 文件

### 文档新增

- 增加根目录 `README.md`
- 增加 `PROJECT_PLAN.md`
- 增加 `docs/SETUP.md`
- 增加 `docs/ARCHITECTURE.md`
- 增加 `docs/API.md`
- 增加 `docs/ROADMAP.md`

### 统计信息

- 变更 52 个文件
- 新增 10218 行

## 提交：`4cfc5f3` - Prepare InfinityFree and Render deployment（准备 InfinityFree 和 Render 部署）

此提交为前端静态托管、后端服务托管的前后端分离部署做好了准备。

### 变更

- 在 `apps/web/.env.example` 中增加前端环境变量示例
- 在 `apps/api/.env.example` 中增加后端环境变量示例
- 修改 `apps/web/src/utils/api.js` 中的前端 API 基础 URL 处理
  - 从硬编码的 localhost API 改为使用 `VITE_API_BASE_URL`
- 扩展 `apps/api/src/config/env.js` 中的后端环境变量处理
  - 增加 `CORS_ORIGINS`
- 更新 `apps/api/src/app.js` 中的后端 CORS 设置
  - 来源白名单现在来自环境变量
- 在 `docs/DEPLOY_INFINITYFREE_RENDER.md` 中增加部署指南
- 在根目录 `README.md` 中添加部署指南链接
- 更新 `docs/SETUP.md`，补充 `CORS_ORIGINS` 说明

### 统计信息

- 变更 8 个文件
- 新增 128 行
- 删除 2 行

## 提交：`987d811` - Relax CORS origin hostname matching（放宽 CORS 来源主机名匹配）

此提交降低了托管前端域名的部署阻力。

### 变更

- 更新 `apps/api/src/app.js`
- 增加来源规范化辅助函数
- 增加基于主机名的 CORS 匹配回退逻辑
- 允许在以下差异之间进行更宽松的匹配：
  - `http` 和 `https`
  - `www.domain` 和 `domain`

### 统计信息

- 变更 1 个文件
- 新增 18 行
- 删除 1 行

## 功能变更摘要

在当前已跟踪的项目历史中，主要交付的变更包括：

- 引入身份验证层
- 引入提醒周期
- 引入从课程到练习单的自动化
- 引入导出引擎
- 引入 Resource Vault
- 将存储从 JSON 迁移到 SQLite
- 引入 API 验证和测试覆盖
- 引入备课和练习单资源选择器
- 引入练习单题目编辑
- 引入适用于 GitHub 的文档结构
- Git 仓库已初始化并发布
- 引入 InfinityFree + Render 部署支持
- 改进已部署前端域名的 CORS 容错匹配

## 已知文档限制

本更新日志包括：

- 当前已跟踪 Git 历史中可获取的全部内容
- 根据当前仓库状态和项目说明尽力重建的内容

本更新日志不保证：

- Git 初始化前进行的每一次临时编辑
- Git 初始化前的每次删除或重命名
- 首次跟踪提交之前的每个中间状态
