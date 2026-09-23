# 开发与运行

## 本地运行

项目是 npm workspaces。Node.js 22 和 npm 安装依赖后，运行 `npm run build` 构建共享包、API 与 Web。API 可用 `node --env-file=.env apps/api/src/server.js` 启动；`.env.example` 给出配置项。非测试环境必须配置 HTTPS 证书和密钥，`WORKBENCH_PUBLIC_ORIGIN` 须与实际地址一致，`WORKBENCH_WEB_DIST` 指向构建后的 Web 目录。邮箱注册需要可用的 SMTP 配置。

将 `SQLITE_PATH`、`WORKBENCH_FILES_DIR` 指向持久目录。凭据留在未跟踪的 `.env` 或外部密钥存储。当前本机预览服务及其账户、数据和配置由独立现场维护；开发验证使用隔离的目录和端口，避免影响 `https://localhost:50880`。

开发脚本见根目录 `package.json`。API 测试为 `npm run test:api`，Web 端到端测试为 `npm run test:e2e`。运行测试前选择受影响的用例和隔离数据，生成的证据写入 `test-results/evidence/`。在真实 UI 中检查布局和交互时遵循 [界面规则](ui-quality.md)。

## 文件转换

常见材料预览与输出依赖本机文件转换能力。旧 DOC 转换使用 `MATERIALS_OFFICE_ROOT`；可编辑公式 DOCX 输出可配置 `MATERIALS_PANDOC_PATH`，并沿用 LibreOffice 转换链。二进制程序不在仓库内。实际可用性以安装环境、输入材料和目标 Office 打开结果为准。

## 数据恢复

维护者使用 `apps/api/src/scripts/reliability.js` 的 `backup`、`restore` 和 `activate` 命令。执行前先停止 API、转换子进程和自动重启，保留原数据库、文件与配置。备份覆盖 SQLite 和登记文件；密钥及邮件、Provider 配置须另外保管。恢复先创建隔离副本，核对后再激活，并同时切换 `SQLITE_PATH` 与 `WORKBENCH_FILES_DIR`。激活恢复点会撤销旧登录状态，备份后的写入不会自动合并。

```bash
node apps/api/src/scripts/reliability.js backup --database /数据目录/workspace.sqlite --files /文件目录 --target /备份目录/本次备份 --stopped
node apps/api/src/scripts/reliability.js restore --source /备份目录/本次备份 --target /新恢复目录 --stopped
node apps/api/src/scripts/reliability.js activate --target /新恢复目录 --stopped
```

以上目录均须替换为真实绝对路径，目标目录应尚不存在。无 Git 元数据的发布目录需设置完整源码提交号 `PRODUCT_REVISION`。恢复与部署仍需真实环境验收，当前预览不能替代正式交付。
