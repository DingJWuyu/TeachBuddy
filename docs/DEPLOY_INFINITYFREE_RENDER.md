# 部署指南：InfinityFree + Render

[返回主 README](../README.md)

此方案适合预览、轻量测试和个人使用：

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

SQLite 依赖实例本地磁盘。部署环境必须提供持久磁盘或接受账户和布局数据随实例重启丢失。

## 前端

构建前设置 VITE_API_BASE_URL：

~~~
VITE_API_BASE_URL=https://你的-api-服务.onrender.com/api
npm run build
~~~

前端产物位于 apps/web/dist，将该目录内容上传到静态站点根目录。

## CORS 检查

如果登录或 API 请求失败，确认 CORS_ORIGINS 使用完整的前端来源，包括 https 协议和域名。

## 上线检查

- 打开前端并创建教师账户
- 确认登录后首页保持空白且首页、设置入口都可用
- 在侧栏创建一个布局分组，刷新页面后确认其仍然存在
- 在另一个浏览器上下文中登录同一账户，确认布局一致
- 调用 API 确认模块列表为空
