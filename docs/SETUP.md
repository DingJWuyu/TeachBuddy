# 运行、代码结构与部署

维护实例看[已有本机实例](#已有本机实例)，验证代码看[新的隔离环境](#新的隔离环境)，定位实现看[代码结构](#代码结构)。[正式部署](#正式部署)是尚未选定的运行条件；当前能力和授权见[运行台账](plans/run-state.md)。

## 已有本机实例

- 开发树：`/home/liam_t/项目/TeacherWorkspace-preview`；当前开发分支以 `git branch --show-current` 为准。
- 地址：`https://localhost:50880`。
- 用户级服务：`teacherworkspace-preview.service`。
- 启动入口：开发树 `.scratch/preview/start.sh`；私有运行配置：`.scratch/preview/runtime.env`。
- 运行方式：直接读取开发树，Node `--watch` 启动 `apps/api/src/server.js --dev`，Vite 在同一 HTTPS 服务内提供前端与热更新。`.scratch/preview/deployed-source/` 和 `apps/web/dist/` 不参与此服务。
- 启动入口还加载 `.env` 及用户私有邮件配置。只读键名和路径进行诊断，不打印秘密。
- 前端源码保存后自动更新；API 及其加载的 JS 模块保存后自动重启，短暂中断请求。未提交的源码也立即生效，提交不是生效条件。文档修改无需重启。
- 更换依赖后准备本地数学资产并重启；改变环境变量、证书或通过文件系统读取的契约/schema 后手动重启：`systemctl --user restart teacherworkspace-preview.service`。Node 的模块监听不涵盖所有外部文件。

preview 是用户体验的集成现场，由总控协调修改和合并；获准进入 preview 的源码会自动进入该服务。业务 session 在各自 worktree 的独立端口、数据库和文件目录完成实现及自测，合回 preview 后才进入用户体验入口，不占用 50880 或操作其私有配置。

维护前核对代码、依赖及工具路径，完成后实际打开页面并验证受影响功能。当前测试数据可丢弃，具体范围见[运行台账](plans/run-state.md#工作现场与授权)。一次服务状态查询只证明进程存活，不证明业务能力。

## 新的隔离环境

已验证的开发基线使用 Node.js 22.23.2 和 npm workspaces；依赖版本由锁文件固定。新环境从仓库根 `npm ci`，不在运行着的用户实例中做依赖重装。

1. 准备独立端口、数据库、文件目录与 HTTPS 证书。优先使用相应模块已有测试 harness，它们有隔离数据和邮件替身。
2. 独立真实认证实例按 [.env.example](../.env.example)准备私有 `.env`，补充独立文件目录，开发时设置 `NODE_ENV=development`；密钥、SMTP 和证书内容不写进提交。已有测试 harness 继续使用其隔离配置。
3. 从该 worktree 根目录运行 `npm run dev`。它先准备数学静态资产，再启动同源 HTTPS、前端热更新和 API 自动重启；开发模式忽略 `WORKBENCH_WEB_DIST`。缺少证书或认证配置会拒绝启动，不自动降级为测试身份。
4. 验证固定构建时，运行 `npm run build:shared` 和 `npm run build:api`；后者使用系统临时目录验证装配和迁移。Web 隔离构建用 `npm --workspace @refatos/web run build -- --outDir /absolute/test/web-dist`，设置 `WORKBENCH_WEB_DIST` 后启动：

```bash
node --env-file=/absolute/private/runtime.env apps/api/src/server.js
```

Web 与 `/api` 由同一个 HTTPS origin 提供。固定构建不热更新；真实认证测试 harness 也可通过 `WORKBENCH_WEB_DIST` 选择该产物。构建路径避免隐藏目录（如 `.scratch/`），否则 Express 的 `sendFile` 默认拒绝 SPA 回退请求。

## 必需配置的来源

变量、默认值与校验以 `apps/api/src/config/env.js` 和 [.env.example](../.env.example) 为准。每个隔离实例配置自己的 SQLite、文件目录、同源 HTTPS 和 Web 构建路径；测试收件器与真实邮件分开。已有实例保持其认证密钥，生产不使用 test-principal。

<a id="文件转换工具"></a>
## 文件转换工具

材料预览与输出还依赖系统工具和字体，不能只安装 npm 依赖：

- `MATERIALS_PANDOC_PATH` 指向 Pandoc 可执行文件，使用者为 `apps/api/src/modules/lessons/pandoc.js`。
- `MATERIALS_OFFICE_ROOT` 指向包含 `program/soffice` 的 LibreOffice 根目录，使用者为 `apps/api/src/workbench/files/converter.js`。
- `QUESTIONS_XPDF_PDFTOHTML` 指向 Xpdf 的 `pdftohtml`，用于题库文字 PDF 的阅读顺序与双栏识别；使用者为 `apps/api/src/modules/questions/native-pdf.js`。Poppler 继续负责页图、裁图和资源正文检索。
- 转换还调用 `bwrap` 和相应格式工具；准确命令从同目录的 `conversion-worker.mjs` 核对。
- 工具路径应稳定独立于短期 worktree。归档中的工具包存在不代表运行配置已经指向它。

当前实例的工具可用性与待处理项由[台账](plans/run-state.md)维护；修改运行配置后必须实际转换并打开文件验证。

## 验证与原型

具体测试选择和数据隔离见[验证指南](acceptance/README.md)。全量命令不能替代当前功能的实际操作，也不要在在线实例旁盲目运行会覆盖 `dist` 或写证据的旧脚本。

原型使用 `npm run prototype:sidebar`，默认 `http://localhost:4174/`。原型内数据不是产品账户或持久数据；行为入口在 `prototype/behavior/manifest.md`。

## 正式部署

当前只交付本机体验。用户将后续选择服务器与域名，尚未批准采购或部署，也没有已验证的正式环境。启动、持久化和转换要求见本页前述配置。

### 必须具备

一台可运行 Node/pi、SQLite、持久文件、系统转换程序及中文字体的主机；同源 HTTPS、真实邮件、受控模型出站、备份目标与可重复还原。只有静态托管或临时磁盘不足以承载当前实现。Windows 是用户的目标客户端环境，不要求服务端必须 Windows。

优先核对单主机端到端路径。已有持续联网主机加 Tunnel 可作为候选，但主机关机/休眠即不可访问，稳定 URL、域名、备份与中国大陆网络仍需验证。拆成 Workers/D1/R2 加独立 pi/Office 执行节点并未获选；它会改变当前 SQLite/文件接缝，只有具体部署条件需要时再评估，不能把免费额度当作已经兼容。

### 交付验证

选定方案后核对其当前价格、额度、Node/系统工具支持及目标网络。实际验证 DNS/TLS、Cookie 页面绑定、上传/下载、SSE、Office 输出、浏览器离线包、重启持久化、停服备份与还原；目标浏览器、平板/学校网络、Word/WPS 和课堂设备分别记录结果。

## 代码结构

### 请求与数据路径

```text
React 页面
  → 认证 transport（同源 Cookie、页面上下文）
  → Express / workbench 公共入口
  → 所属模块服务与公共端口
  → SQLite 事务、文件存储、转换任务
```

这是一个应用和一个 SQLite 持久底座。六模块通过单一静态目录装配，不拆成多服务或动态插件平台。重大约束见 [ADR 0001](adr/0001-use-a-single-static-module-catalog.md)。

| 代码位置 | 当前职责 |
| --- | --- |
| `apps/web/src/features/workbench/` | 外壳、共享文稿/保存/冲突/现场与支持页 |
| `apps/web/src/features/auth/` | 认证页面、会话恢复、请求 transport |
| `apps/web/src/features/{questions,lessons,resources,math,classes,schedule}/` | 六领域的界面与交互 |
| `apps/api/src/server.js` | 同源 HTTPS、可选 Vite 开发服务、启动完成后监听与停止连接 |
| `apps/api/src/app.js` | 组合认证、workbench、API 和 Web 入口 |
| `apps/api/src/features/auth/` | 真实账户、会话、页面绑定、验证码、迁移与恢复操作 |
| `apps/api/src/workbench/` | 共享身份、校验、幂等、迁移、目录装配、文件和任务底座 |
| `apps/api/src/modules/` | 题库、备课、资源、数学、班级和日程业务 |
| `apps/api/src/workbench/reliability/` | 个人资料包、备份、恢复与维护锁 |
| `packages/shared/` | 两侧消费的静态模块目录及共享定义 |
| `prototype/` | 已确认 UI/UX 的参考，生产运行不依赖原型源码 |

实际 API 装配映射在 `apps/api/src/workbench/moduleImplementations.js`；前端从对应静态目录消费入口。新增能力先找所属模块，不增加另一套全局注册表。

### 持久化与失败语义

业务通过自己的服务、仓储及迁移处理数据；跨模块采用公开端口，避免直接操作别人的表。保存、版本冲突、幂等与未知结果的共同规则由[工作台契约](contracts/workbench.md)拥有。

SQLite、持久文件目录、认证密钥和外部转换工具各有独立运行配置。UI 本地草稿和现场不等于服务端内容；备份仅复制数据库也不足以恢复文件。当前真实运行位置和保护方式见[已有本机实例](#已有本机实例)。
