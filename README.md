# 教师个人工作台

这是一个面向独立教师的个人工作空间。当前版本提供教师账户入口、认证、密码找回、账户隔离的工作台布局，以及可供未来功能模块接入的中性注册契约。模块目录当前为空，工作台可以在没有功能模块时独立运行。

## 当前能力

- 开放注册、登录、退出和密码找回
- 教师账户之间的数据和工作台偏好隔离
- 始终可见的工作台首页和设置入口
- 侧栏分组、重命名、排序、拖拽和布局持久化底座
- 认证 Bearer API 与 SQLite 持久化
- 空模块目录下的 API、真实浏览器验收和构建验证

首页在模块目录为空时保持空白，不渲染模块统计、卡片、快捷操作或占位提示。未来模块可以通过共享注册契约声明身份、侧栏入口、自有面板和后端能力。

## 快速开始

~~~
npm install
npm run dev
~~~

应用地址：

- Web：http://localhost:5173
- API：http://localhost:4000

打开 Web 后选择“注册”创建教师账户。开发环境未配置 SMTP 时，密码找回验证码会写入 API 服务端日志。

## 仓库结构

~~~
/
├── apps/
│   ├── api/        Express API、认证、SQLite 和工作台布局
│   └── web/        React + Vite 工作台外壳
├── packages/
│   └── shared/     中性模块注册契约与空模块目录
├── docs/           安装、API、架构和部署说明
├── CONTEXT.md      领域术语和边界
└── CHANGELOG.md    发布与工程日志
~~~

## 文档入口

- [安装指南](./docs/SETUP.md)
- [API 指南](./docs/API.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [路线图](./docs/ROADMAP.md)
- [部署指南](./docs/DEPLOY_INFINITYFREE_RENDER.md)

## 验证

~~~
npm run test:api
npm run test:e2e
npm run build
git diff --check
~~~
