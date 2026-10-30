# 运行与部署

变量、默认值和校验以 [.env.example](../.env.example) 和 `apps/api/src/config/env.js` 为准，命令以 `package.json` 的 scripts 为准。本页只记这些地方看不出来的东西。

## 已有本机实例

- 用户体验的是主检出 `~/项目/TeachBuddy` 的 `main`，地址 `https://localhost:50880`，由用户级服务 `teachbuddy-preview.service` 运行 `npm run dev`。实际工作目录用 `systemctl --user cat teachbuddy-preview.service` 核对。
- 数据库、附件、日志和临时转换目录在 `~/.local/share/teachbuddy/preview/`，和源码分开；准确位置看私有 `.env` 的 `SQLITE_PATH`、`WORKBENCH_FILES_DIR`、`WORKBENCH_LOG_DIR` 和 `TMPDIR`。诊断时只读需要的键名和路径，不打印秘密。
- 前端保存后热更新，API 的 JS 模块保存后自动重启，不需要提交。改了环境变量、证书、依赖或通过文件系统读取的契约后，执行 `systemctl --user restart teachbuddy-preview.service`。
- worktree 自测用独立的端口、数据库和文件目录，不连接体验实例。进程活着不等于功能可用，维护后要实际打开受影响的页面。
- 启动时会把已受理但没完成的账户删除各接续一次，不会新建删除或周期重试。单条清理失败会保留账户锁和文件清单，修复文件故障后重启即可接续。

## 新的隔离环境

已验证的服务端基线是 Linux、Node.js 22.23.2 和 OpenSSL。

1. `npm ci`，然后 `cp .env.example .env && chmod 600 .env`。准备独立的数据目录和本机 TLS 证书：

   ```bash
   umask 077
   mkdir -p "$HOME/.local/share/teachbuddy/preview" "$HOME/.config/teachbuddy/tls"
   openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
     -keyout "$HOME/.config/teachbuddy/tls/key.pem" \
     -out "$HOME/.config/teachbuddy/tls/cert.pem" \
     -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
   openssl rand -hex 32   # AUTH_CODE_SECRET，持久保留
   ```

2. 填 `.env`。`.env` 不展开 `$HOME`，路径要写展开后的绝对路径。`WORKBENCH_PUBLIC_ORIGIN` 必须和 `PORT` 一致。缺少认证密钥、有效 origin、证书或 SMTP 配置时服务拒绝启动；注册和找回密码还要求邮件服务器实际可达。
3. 按[数学运行依赖](#数学运行依赖)构建引擎、安装 Chromium，再 `npm run dev`。首次启动会建空库并迁移。
4. 打开 `/api/health` 和登录页，完成一次注册、保存、刷新读回，才算可用。自动化测试有自己的隔离 harness，不需要真实邮箱。

没有显式配置数据库路径的实例使用 `apps/api/src/data/teachbuddy.sqlite`；已经存在旧默认数据库的实例继续读原文件，避免改名后出现空工作区。

### 浏览器身份

认证 Cookie `__Host-teachbuddy_session` 按主机隔离，不按端口隔离：同一个浏览器配置里的多个 `localhost` 实例会互相覆盖登录态。自动化用独立的 browser context，手工同时体验多个实例用独立的浏览器配置文件。

功能依赖浏览器扩展、外部工具或私有配置时，agent 的隔离浏览器能用，不代表用户的浏览器也具备。必须由用户操作的步骤要写清入口和预期结果；保留用户已有的登录和数据，不用反复重连、清 Cookie 或重置账户来排障。

### 持久用户服务

`~/.config/systemd/user/teachbuddy-preview.service`，把路径换成本机的绝对路径（`command -v node`、`command -v npm`）：

```ini
[Unit]
Description=TeachBuddy preview development server

[Service]
WorkingDirectory=/absolute/path/to/TeachBuddy
Environment="PATH=/absolute/node-bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/absolute/node-bin/npm run dev
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
```

然后 `systemctl --user daemon-reload && systemctl --user enable --now teachbuddy-preview.service`，日志看 `journalctl --user -u teachbuddy-preview.service`。

### 固定构建

`npm run build`，设 `NODE_ENV=production` 和 `WORKBENCH_WEB_DIST=apps/web/dist`，再 `node --env-file=.env apps/api/src/server.js`。Web 和 `/api` 由同一个 HTTPS origin 提供，不热更新。隔离构建用 `npm --workspace @teachbuddy/web run build -- --outDir /absolute/test/web-dist` 并指向它，不要覆盖在线实例的 `dist`。

## 文件转换工具

材料预览和输出依赖系统工具和字体，只装 npm 依赖不够。工具装在源码之外的持久目录，新环境独立安装，改了配置要实际转换并打开文件验证。

- **LibreOffice**：`MATERIALS_OFFICE_ROOT` 指向含 `program/soffice` 的根目录。Debian/Ubuntu 系统包要装齐 `libreoffice-writer`、`libreoffice-math` 和 `libreoffice-impress`，分别负责 Word、公式和 PPT；根目录可用 `/usr/lib/libreoffice`。转换沙箱会只读挂载 `/etc/libreoffice`（存在时）。本机验证版本 26.8。
- **Pandoc**：`MATERIALS_PANDOC_PATH`，本机验证版本 3.11。其他版本要重新核对输出。
- **系统包**：Poppler（`pdfinfo`、`pdftoppm`、`pdftotext`）、Bubblewrap、Fontconfig 和中文字体（如 Noto Sans CJK SC）。用 `fc-match ':lang=zh-cn'` 核对实际中文字体。转换调用的完整命令见 `apps/api/src/workbench/files/conversion-worker.mjs`。

### 题库文字 PDF（Xpdf）

题库用 Xpdf 4.06 的 `pdftohtml` 读文字层，因为它按阅读顺序逐行输出；`pdftotext -layout` 会跨栏拼横行，Xpdf 默认纯文本又会把题号行合进段落。不能用 Poppler 的同名命令代替。`QUESTIONS_XPDF_PDFTOHTML` 指向 `bin64/pdftohtml`，未配置时找 `/usr/local/bin/xpdf-pdftohtml`。

```bash
xpdfHome="$HOME/.local/share/teachbuddy-tools"
mkdir -p "$xpdfHome"
curl --fail --location https://dl.xpdfreader.com/xpdf-tools-linux-4.06.tar.gz -o "$xpdfHome/xpdf-tools-linux-4.06.tar.gz"
printf '%s  %s\n' '940c137cbd1856e45813da1a25c12e8dd3dc8997b8ea735feb858684603031e3' "$xpdfHome/xpdf-tools-linux-4.06.tar.gz" | sha256sum -c -
tar -xzf "$xpdfHome/xpdf-tools-linux-4.06.tar.gz" -C "$xpdfHome"
```

工具缺失或失败时原稿保留、整理任务失败，不会静默退回会串栏的路径。Xpdf 是 GPL v2/v3，重分发二进制要保留包内 README、手册、COPYING 和 COPYING3；本仓库只调用外部工具，不收录它。

## 数学运行依赖

```bash
npm run math:geogebra:build
npx playwright install chromium
```

- 构建需要 Linux x86-64、Python 3.12 以上、`curl` 和能访问公开源码与依赖仓库的网络。来源、版本和摘要在 `tools/geogebra/manifest.json`，缓存和产物都被忽略，可以从入库输入重建，不要从旧工作树复制。
- `npm run dev` 和 Web 构建只做 `--check`：运行时缺失或输入变了会明确失败，重新执行上面的构建命令即可。
- 数学图形保存、输出和题面 PNG 在服务端用 Playwright 和单独安装的 Chromium，`npm ci` 不保证浏览器存在；缺系统库时用 `npx playwright install --with-deps chromium`。部署账户和安装账户不同，或者移动了浏览器缓存，要重新核对实际图形保存。
- 制作和下载不请求 GeoGebra 官方服务。DeepSeek 网页 AI 需要网络、登录的账号和[浏览器扩展](../extensions/math-web-ai/README.md)。扩展商店地址由 Web 构建变量 `VITE_MATH_AI_CHROME_STORE_URL`、`VITE_MATH_AI_EDGE_STORE_URL` 提供，默认留空，产品如实显示尚未上架。
- 许可：GeoGebra 源码按 EUPL-1.2，Giac、GMP、MPFR、字体等保留各自许可，重分发核对入口是 `tools/geogebra/NOTICE.txt`、`manifest.json` 和 `licenses/`。上游第三方 WASM 和静态库的位级复现、整体商用许可都还没审定，不能宣称全部从源码重建或统一 MIT 授权。

## 本地页识别工具

`MATERIALS_OCR_HOME` 指向独立、持久的 MinerU 工具目录；未配置时不运行新识别，已保存的结果照样能读。题库和资源共用这一套识别。

方案固定为 MinerU Standard、Pro-2605 Q8、CPU 版面分析加 CUDA llama.cpp 内容识别。模型、提示、依赖和摘要在 `scripts/recognition/manifest.json` 与 `requirements.freeze.txt`。改变识别配置时要递增引擎修订，不能用旧缓存冒充新配置的结果。

宿主要求 Linux x86-64、能运行随包 CUDA runtime 的 NVIDIA 驱动、`nvidia-smi`、Bubblewrap 和用户级 systemd；安装另需 Python 3.12 以上、[uv](https://docs.astral.sh/uv/getting-started/installation/) 和提供 `bsdtar` 的 libarchive。安装脚本不装驱动。

```bash
ocrHome="${XDG_DATA_HOME:-$HOME/.local/share}/teachbuddy-tools/mineru-pro-2605"
python3 scripts/recognition/install.py "$ocrHome"
```

- 目标必须是空目录；已有环境保留，另选新目录。失败时保留日志，不要切换服务。装好后把 `MATERIALS_OCR_HOME` 写进 `.env`，重启 API，上传一页真实材料核对文字、公式、配图、原页定位和取消。
- 工具目录里有指向安装位置的解释器链接，迁移要在新位置重新安装。
- 运行时禁止外网和自动下载。模型进程归本实例和当前账户，空闲 60 秒释放；换账户、取消、超时或关服时先确认整个进程范围停止，再清理临时输入。
- 资源边界：模型 scope 限制内存 6 GiB、禁止 swap；冷启动要求可用 RAM 至少 6.5 GiB、空闲显存至少 3 GiB、工作盘空闲至少 25 GiB。准入不足不启动。
- MinerU 是 Apache-2.0 加附加条款：提供第三方在线服务时，必须在界面或公开文档中标明使用了 MinerU（[许可](https://github.com/opendatalab/MinerU/blob/ed50cc15bc2c9bfb00520dadfe61979866e62236/LICENSE.md)）。

## 测试与 CI

- 浏览器测试先 `npx playwright install chromium`，并消费同一候选的完整构建：先构建数学运行时和 Web，用 `WORKBENCH_WEB_DIST` 指向隔离产物，不能拿另一个工作树的旧资产补齐。
- 测试用 `apps/api/test/support/application.js` 起真实的 HTTPS 应用（当前 `createApp` 装配），模型和邮件只在边界换成替身。Node 用例通过 `apps/api/test/support/directories.js` 在 `test-results/runtime/` 建具名隔离目录，浏览器用例用 `testInfo.outputPath()`。用例自己关掉它起的服务、连接、浏览器和子进程；成功时清理，失败时保留现场。
- 测试按层分组：`apps/api/test/rebuilt/`（业务与数据）、`apps/web/e2e/rebuilt/`（主应用流程）、`apps/api/test/rebuilt-outputs/`（材料与数学成果）、`extensions/math-web-ai/test/rebuilt/`（数学网页桥）。真实模型、GPU OCR、真实邮件和目标设备不在默认回归里，要单独验。
- CI 在目标为 `main` 的 PR 和手动触发时运行。`HTTP and SQLite` 与 `Build, browser and outputs` 并行，都成功才通过必需检查 `Build and API`；`PR conventions` 检查 Conventional Commit 标题。失败时先看失败 step 的日志或 `ci-*-logs-*`，要截图、trace 或生成文件再取 `ci-*-diagnostics-*`，两者保留 7 天。
- CI 缓存固定源码构建的 GeoGebra 运行时，恢复后仍核对输入指纹和产物摘要。要核查冷构建，删掉对应的 Actions 缓存再手动跑 CI。改工作流后用 `actionlint` 检查。

## 设计原型

`npm run prototype` 用 Python 标准库直接提供 [design-system](design-system/README.md) 里的完整应用原型；不能用开发打包器，它会改写原型的 classic script。原型里的账户、资料和回复都是模拟的，不能用来验证真实保存。

## 正式部署

目前只交付本机体验，还没有选定服务器和域名，也没有验证过的正式环境；部署主机、生产配置、备份目的地和首次发布范围在 [#68](https://github.com/DingJWuyu/TeachBuddy/issues/68)。

正式环境至少需要：一台能运行 Node 和 pi、SQLite、持久文件、系统转换工具和中文字体的主机；同源 HTTPS、真实邮件、受控的模型出站、备份目标和可重复的还原。只有静态托管或临时磁盘承载不了现在的实现。用户的客户端是 Windows，但服务端不必是 Windows。备份和还原的参数以维护 CLI 的 `--help` 为准。
