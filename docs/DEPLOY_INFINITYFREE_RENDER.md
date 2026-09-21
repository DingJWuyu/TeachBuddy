# 旧底座部署参考：InfinityFree + Render

[返回主 README](../README.md)

**状态：旧演示方案，未经当前 MVP 验证。** 下文对应旧 Bearer 应用的异源部署，与新[认证契约](contracts/auth.md)已确认的同源 Secure Cookie 要求不同，不能直接用于 MVP 上线。持久业务数据、文件、备份恢复及真实流程的上线条件见[路线图](ROADMAP.md)。

旧方案的部署分工：

- 前端静态文件部署到 InfinityFree
- API 部署到 Render 或其他 Node 服务

## API 服务

在 Render 中从仓库创建 Web Service：

- 根目录：apps/api
- 运行时：Node
- 构建命令：npm install
- 启动命令：npm start

环境变量：

- NODE_ENV=production
- PORT=10000
- AUTH_SECRET=长期随机值
- CORS_ORIGINS=https://你的前端域名
- SQLITE_PATH=/opt/render/project/src/apps/api/src/data/refatos.sqlite
- SMTP_HOST、SMTP_PORT、SMTP_USER、SMTP_PASSWORD、SMTP_FROM、SMTP_SECURE

SQLite 依赖实例本地磁盘。部署环境必须提供持久磁盘；无持久磁盘时可能丢失数据，只能作为可丢弃的演示环境，不能承载老师的实际资料。本页没有验证任何服务套餐目前是否提供所需条件。

## 前端

从仓库根目录构建旧前端时传入 VITE_API_BASE_URL：

~~~
VITE_API_BASE_URL=https://你的-api-服务.onrender.com/api npm run build:web
~~~

前端产物位于 apps/web/dist，将该目录内容上传到静态站点根目录。

## CORS 检查

如果登录或 API 请求失败，确认 CORS_ORIGINS 使用完整的前端来源，包括 https 协议和域名。

## 旧底座检查，不是 MVP 验收

- 打开前端并创建教师账户
- 确认登录后首页保持空白且首页、设置入口都可用
- 在侧栏创建一个布局分组，刷新页面后确认其仍然存在
- 在另一个浏览器上下文中登录同一账户，确认布局一致
- 调用 API 确认模块列表为空
