# 教师个人工作台

这是一个面向独立教师的个人工作空间。当前版本提供教师账户入口、认证、密码找回、账户隔离的工作台布局，以及可供未来功能模块接入的中性注册契约。模块目录当前为空，工作台可以在没有功能模块时独立运行。

账户入口、侧边栏与顶部栏的 UI/UX 原型已经完成。第一版产品范围已确定为题库、备课、数学工坊、资源库、班级教学、日程六个模块，以及串联各模块的 Agent 入口，面向中国大陆高中教师，优先满足数学教师的实际教学需求。这些业务功能尚未完成设计与实现，完整范围见[第一版产品范围](./docs/PRODUCT_SCOPE.md)。长期围绕既定范围持续优化，暂不扩展新的功能方向。

## 当前能力

- 开放注册、登录、退出和密码找回
- 教师账户之间的数据和工作台偏好隔离
- 始终可见的工作台首页和设置入口
- 侧栏分组、重命名、排序、拖拽和布局持久化底座
- 已完成的账户入口、侧边栏与顶部栏 UI/UX 原型，以及相关行为文档和验证证据
- 认证 Bearer API 与 SQLite 持久化
- 空模块目录下的 API、真实浏览器验收和构建验证

当前实现中的首页在模块目录为空时保持空白。后续首页内容依据 TeachBuddy 已确认的产品范围设计，具体信息组织与交互仍待确定。中性模块注册契约继续作为六个功能模块接入的底座。

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

行为文档从 [manifest](./prototype/behavior/manifest.md) 进入，按账户入口、外壳、导航、侧栏和顶部栏分别维护。

```bash
npm run prototype:sidebar   # 当前原型：http://localhost:4174/
npm run prototype:build
```

打开后先是账户入口的登录卡。示例邮箱 `example@example.com`，密码填 8 位以上（例如 `teachbuddy`）即可进入工作台。

## 文档入口

- [安装指南](./docs/SETUP.md)
- [API 指南](./docs/API.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [第一版产品范围](./docs/PRODUCT_SCOPE.md)
- [路线图](./docs/ROADMAP.md)
- [部署指南](./docs/DEPLOY_INFINITYFREE_RENDER.md)

## 验证

~~~
npm run test:api
npm run test:e2e
npm run build
git diff --check
~~~
