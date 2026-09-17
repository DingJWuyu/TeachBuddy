# 部署指南：InfinityFree + Render

[返回主 README](../README.md)

此方案适用于预览、轻量测试和个人使用：

- 前端部署在 `InfinityFree`
- 后端 API 部署在 `Render`

## 重要限制

当前后端使用：

- 本地磁盘上的 SQLite
- 本地磁盘上的上传文件

这意味着该托管方案不适合需要长期可靠性的生产环境。免费托管环境可能存在存储限制或持久化方面的注意事项；部署前应确认 SQLite 文件和上传目录不会因实例重启丢失。

## 1. 将后端部署到 Render

在 Render 中使用此仓库创建新的 Web Service。

服务设置：

- 根目录：`apps/api`
- 运行时：`Node`
- 构建命令：`npm install`
- 启动命令：`npm start`

推荐的环境变量：

- `NODE_ENV=production`
- `PORT=10000`
- `AUTH_SECRET=your-long-random-secret`
- `CORS_ORIGINS=https://your-infinityfree-domain`

可选：

- `SQLITE_PATH=/opt/render/project/src/apps/api/src/data/refatos.sqlite`

部署完成后记下 API URL，例如：

`https://refatos-api.onrender.com/api`

## 2. 为 Render API 构建前端

在 `apps/web` 中根据 `.env.example` 创建本地 `.env` 文件：

```bash
VITE_API_BASE_URL=https://your-render-service.onrender.com/api
```

然后执行构建：

```bash
npm run build
```

前端构建产物位于：

`apps/web/dist`

## 3. 将前端上传到 InfinityFree

将 `apps/web/dist` 中的内容上传到 InfinityFree 站点，通常放入 `htdocs` 目录。

注意：

- 上传 `dist` 内的文件，而不是直接上传 `dist` 文件夹
- `index.html` 最终应位于站点根目录

## 4. 验证 CORS

如果部署后的前端登录或 API 请求失败，请检查：

- Render 环境变量 `CORS_ORIGINS`
- 完整准确的 InfinityFree 域名，包括 `https://`

示例：

```bash
CORS_ORIGINS=https://refatos.infinityfreeapp.com
```

## 5. 冒烟测试

两端都上线后：

- 打开 InfinityFree 站点
- 选择“注册”创建教师账户并自动进入工作台
- 确认全新账户看到空数据，而不是固定演示账户或演示内容
- 在设置中隐藏一个模块，刷新后确认布局仍保留且核心入口和设置仍可用
- 加载模块
- 创建课程
- 生成练习单
- 打开预览、DOCX 和 PDF 导出链接

## 建议的下一步改进

如果计划让应用持续在线，建议将后端存储从本地 SQLite/文件系统持久化迁移到托管数据库和对象存储。
