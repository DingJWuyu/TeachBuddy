# 安装指南

[返回主 README](../README.md)

## 环境要求

- Node.js 20 或更高版本
- npm

本地运行不需要外部数据库或额外服务。

## 安装与运行

~~~
npm install
npm run dev
~~~

默认地址：

- Web：http://localhost:5173
- API：http://localhost:4000

打开 Web 后选择“注册”创建教师账户。注册成功会自动进入工作台；首页和设置入口始终可见。

## 测试与构建

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
