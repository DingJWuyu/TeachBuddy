# 运行与隔离开发

先区分已有用户实例与自己的临时环境。当前能力、暂停项及环境问题见[运行台账](plans/run-state.md)。

## 已有本机实例

- 开发树：`/home/liam_t/项目/TeacherWorkspace-preview`，分支 `preview/usable-mvp`。
- 地址：`https://localhost:50880`。
- 用户级服务：`teacherworkspace-preview.service`。
- 启动入口：开发树 `.scratch/preview/start.sh`；私有运行配置：`.scratch/preview/runtime.env`。
- 启动入口还加载 `.env` 及用户私有邮件配置。只读键名和路径进行诊断，不打印秘密。

当前代码 HEAD、已构建 Web、正在运行的 Node 进程是三个事实，不能互相替代。文档编辑不需要重启服务。用户未要求更新实例时，开发验证不占 50880，不写其数据库、文件、证书或配置，也不覆盖其 Web 构建产物。

授权维护时使用实际服务管理入口；具体重启必须在候选构建就绪、用户数据保留且工具路径可用后进行。一次服务状态查询只证明进程存活，不证明业务能力。

## 新的隔离环境

已验证的开发基线使用 Node.js 22.23.2 和 npm workspaces；依赖版本由锁文件固定。新环境从仓库根 `npm ci`，不在运行着的用户实例中做依赖重装。

1. 准备独立端口、数据库、文件目录与 HTTPS 证书。优先使用相应模块已有测试 harness，它们有隔离数据和邮件替身。
2. 构建实际受测候选。现有 `build:shared` 检查静态目录，`build:api` 使用系统临时目录验证装配和迁移，`build:web` 生成 Web 产物。
3. 独立真实认证实例按 [.env.example](../.env.example)配置并补充下面的文件目录；密钥、SMTP 和证书内容不写进提交。
4. 从仓库根启动：

```bash
node --env-file=/absolute/private/runtime.env apps/api/src/server.js
```

Web 与 `/api` 由同一个 HTTPS origin 提供。默认 `npm run dev` 不会替你准备生产认证所需的证书、密钥和邮件配置，不能当作完整产品启动流程。

## 必需配置的来源

| 配置 | 含义 |
| --- | --- |
| `SQLITE_PATH` | 实例的持久 SQLite 绝对路径 |
| `WORKBENCH_FILES_DIR` | 同一实例的持久原文件和制品目录 |
| `WORKBENCH_PUBLIC_ORIGIN` | 精确 HTTPS origin，需和访问地址一致 |
| `WORKBENCH_TLS_CERT` / `WORKBENCH_TLS_KEY` | HTTPS 证书与私钥路径 |
| `WORKBENCH_WEB_DIST` | 本次候选实际 Web 构建目录 |
| `AUTH_CODE_SECRET` | 持久认证密钥；保持现有实例的值 |
| `SMTP_*` | 邮件投递配置；测试收件器和真实投递分开记录 |

完整变量与默认行为以 `apps/api/src/config/env.js` 和 [.env.example](../.env.example)为准。生产不能使用 `test-principal`；测试身份只用于明确隔离的场景。

<a id="文件转换工具"></a>
## 文件转换工具

材料预览与输出还依赖系统工具和字体，不能只安装 npm 依赖：

- `MATERIALS_PANDOC_PATH` 指向 Pandoc 可执行文件，使用者为 `apps/api/src/modules/lessons/pandoc.js`。
- `MATERIALS_OFFICE_ROOT` 指向包含 `program/soffice` 的 LibreOffice 根目录，使用者为 `apps/api/src/workbench/files/converter.js`。
- 转换还调用 `bwrap` 和相应格式工具；准确命令从同目录的 `conversion-worker.mjs` 核对。
- 工具路径应稳定独立于短期 worktree。归档中的工具包存在不代表运行配置已经指向它。

当前实例的两个路径失效，修复归属见台账。本指南记录问题，不暗示已安装或已验证恢复。

## 验证、原型与部署

具体测试选择和数据隔离见[验证指南](acceptance/README.md)。全量命令不能替代当前功能的实际操作，也不要在在线实例旁盲目运行会覆盖 `dist` 或写证据的旧脚本。

原型使用 `npm run prototype:sidebar`，默认 `http://localhost:4174/`。原型内数据不是产品账户或持久数据；行为入口在 `prototype/behavior/manifest.md`。

当前没有正式部署交付。部署前需选定可运行 Node、SQLite、持久文件、转换工具和备份的环境，并满足同源 HTTPS 与邮件条件；仅静态站点和无持久磁盘的演示实例不足。候选方案见[部署调研](research/deployment-options.md)，价格和大陆可达性届时重新核验。
