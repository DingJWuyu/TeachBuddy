# 教师个人工作台

这是一个面向独立教师的个人工作空间。当前版本提供教师账户入口、认证、密码找回、账户隔离的工作台布局，以及可供未来功能模块接入的中性注册契约。模块目录当前为空，工作台可以在没有功能模块时独立运行。

账户入口、侧边栏与顶部栏的既有 UI/UX 原型已经验收并纳入仓库。2026-09-21 已确认真实 MVP 范围：题库、备课、数学工坊、资源库、班级教学、日程，以及以 pi agent 为核心运行时、能实际操作各模块的 Agent。优先面向中国大陆高中教师，首先服务实习数学教师的教学工作。

`prototype/` 已加入首轮模块内存交互稿，用户体验后提出视觉与交互调整要求，该稿未通过整体验收；上述业务能力与 Agent 尚未接入正式应用。后续以产品行为确定契约，再推进前后端并行实现与真实数据联调。具体交付要求和页面设计结论见 [MVP 产品范围](./docs/PRODUCT_SCOPE.md)、[工作台设计](./docs/WORKBENCH_DESIGN.md)及[路线图](./docs/ROADMAP.md)。

## 当前能力

- 开放注册、登录、退出和密码找回
- 教师账户之间的数据和工作台偏好隔离
- 始终可见的工作台首页和设置入口
- 侧栏分组、重命名、排序、拖拽和布局持久化底座
- 已完成的账户入口、侧边栏与顶部栏 UI/UX 原型，以及相关行为文档和验证证据
- 认证 Bearer API 与 SQLite 持久化
- 空模块目录下的 API、真实浏览器验收和构建验证

正式应用中的首页在模块目录为空时保持空白。独立原型已采用 Agent 首页、顶部日程、五个业务模块和固定 AI 入口，各主要内容区域独立滚动，右侧工具与 AI 共用空间。模块草稿和关联使用内存数据，AI 为固定交互样例，尚未接入模型、OCR 或业务持久化；刷新会重置模块内容。中性模块注册契约继续作为正式接入基础。

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
├── prototype/      已集成原型、行为文档索引和验证证据
├── docs/           安装、API、架构和部署说明
├── CONTEXT.md      领域术语和边界
└── CHANGELOG.md    发布与工程日志
~~~

## 原型入口

行为文档从 [manifest](./prototype/behavior/manifest.md) 进入；本轮交互覆盖和限制见[模块原型](./prototype/behavior/modules.md)。

```bash
npm run prototype:sidebar   # 当前原型：http://localhost:4174/
npm run prototype:build
```

打开后先是账户入口的登录卡。示例邮箱为 `example@example.com`，密码为 `teachbuddy`。

## 文档入口

- [安装指南](./docs/SETUP.md)
- [API 指南](./docs/API.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [账户入口契约（讨论中）](./docs/contracts/auth.md)
- [路线图](./docs/ROADMAP.md)
- [MVP 产品范围](./docs/PRODUCT_SCOPE.md)
- [工作台功能模块设计](./docs/WORKBENCH_DESIGN.md)
- [部署指南](./docs/DEPLOY_INFINITYFREE_RENDER.md)

## 验证

~~~
npm run test:api
npm run test:e2e
npm run build
git diff --check
~~~
