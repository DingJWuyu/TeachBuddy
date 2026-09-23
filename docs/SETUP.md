# 安装与运行

[返回主 README](../README.md)

本页分别说明当前原型和旧应用如何运行，均不表示目标 MVP 已交付。真实能力及各工作线进度见 README 和[路线图](ROADMAP.md)。

## 环境要求

- 此前验证使用 Node.js 22.23.2；换版本时核对锁文件中 Vite 等依赖的 `engines`，不能仅依据“Node 20+”判断兼容性
- npm

当前旧应用本地运行不需要外部数据库。未来的模型调用、OCR、文件转换等依赖在对应能力接入后补充，不能从当前启动方式推断完整 MVP 无需外部配置。

## 安装与原型

```bash
npm install
npm run prototype:sidebar
```

原型地址为 `http://localhost:4174/`，不启动 API；示例账户及场景入口见[原型行为索引](../prototype/behavior/manifest.md)。原型的账户模拟与旧应用数据库互不相通。

## 旧应用与 API

~~~
npm run dev
~~~

默认地址：

- Web：http://localhost:5173
- API：http://localhost:4000

打开 Web 后选择“注册”创建教师账户。注册成功会自动进入工作台；首页和设置入口始终可见。

## 旧应用测试与构建

这些用例目前验证旧账户、空模块目录和布局，不证明目标业务流程已经实现。

API 回归测试：

~~~
npm run test:api
~~~

浏览器端到端测试：

~~~
npx playwright install chromium
npm run test:e2e
~~~

完整构建：

~~~
npm run build
~~~

`build:shared` 当前只是占位命令；`build:api` 执行存储初始化检查，会打开或创建 SQLite 并初始化基础表结构，不是后端编译，也不证明布局读写正确。要在干净的临时目录中构建，可为该命令设置绝对路径 `SQLITE_PATH`，用完后清理自己创建的数据库；不要指向正在使用的数据文件做临时验证。`build:web` 才是前端生产构建。

原型使用独立的 `npm run prototype:build`。原型验证脚本见行为索引，运行前先核对适用场景；旧空首页与旧模块数量断言不适用当前模块稿。

## 数据

默认 SQLite 文件位于 apps/api/src/data/refatos.sqlite。可以通过 SQLITE_PATH 或 DATABASE_URL 指定其他位置。

数据库只承载教师账户、密码找回验证码和工作台布局。当前模块目录为空，因此新数据库不包含功能模块业务表。

## 环境变量

API 支持：

- PORT
- AUTH_SECRET
- CORS_ORIGINS
- SQLITE_PATH
- DATABASE_URL
- SMTP_HOST
- SMTP_PORT（默认 587）
- SMTP_USER
- SMTP_PASSWORD
- SMTP_FROM
- SMTP_SECURE（true、false 或 1）

密码找回使用标准 SMTP。开发环境没有配置 SMTP 时，验证码只写入 API 服务端日志；生产环境应提供完整 SMTP 配置。
