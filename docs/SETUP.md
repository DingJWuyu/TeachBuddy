# 运行、代码结构与部署

维护实例看[已有本机实例](#已有本机实例)，验证代码看[新的隔离环境](#新的隔离环境)，定位实现看[代码结构](#代码结构)。[正式部署](#正式部署)是尚未选定的运行条件；当前能力和授权见[运行台账](plans/run-state.md)。

## 已有本机实例

用户体验使用 `TeacherWorkspace-preview` 的当前源码，地址为 `https://localhost:50880`。维护使用用户级持久服务 `teacherworkspace-preview.service`，实际工作目录与入口用 `systemctl --user cat teacherworkspace-preview.service` 核对；服务执行仓库内的 `npm run dev`。

配置由开发树根目录私有 `.env` 提供；当前数据库、附件、日志和临时转换目录位于 `~/.local/share/teacherworkspace/preview/`，与源码分开。准确位置以 `.env` 的 `SQLITE_PATH`、`WORKBENCH_FILES_DIR`、`WORKBENCH_LOG_DIR` 和 `TMPDIR` 为准，诊断只读取所需键名和路径，不打印秘密。证书、工具和模型也使用配置指定的持久目录。

前端源码保存后热更新，API 加载的 JS 模块保存后自动重启；提交不是生效条件。环境变量、证书、依赖和通过文件系统读取的契约改变后，执行 `systemctl --user restart teacherworkspace-preview.service`。文档修改无需重启。

preview 由总控协调集成；模块 session 在独立端口、数据库和文件目录自测。维护后核对实际页面和受影响功能，进程存活不等于业务验证通过。

## 新的隔离环境

服务端已验证基线是 Linux、Node.js 22.23.2、npm workspaces 与 OpenSSL；使用锁文件安装依赖。Office、PDF、OCR 的额外依赖按下节准备，未配置这些工具不影响手动模块及账户入口启动。新机器使用以下步骤，不需要任何旧实例数据库。

1. 在检出根目录执行 `npm ci`，再 `cp .env.example .env`、`chmod 600 .env`。为本实例准备独立的持久数据目录和 TLS 证书，例如：

   ```bash
   umask 077
   mkdir -p "$HOME/.local/share/teacherworkspace/preview" "$HOME/.config/teacherworkspace/tls"
   openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
     -keyout "$HOME/.config/teacherworkspace/tls/key.pem" \
     -out "$HOME/.config/teacherworkspace/tls/cert.pem" \
     -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
   openssl rand -hex 32
   ```

   最后一条命令生成 `AUTH_CODE_SECRET`，填入私有配置并持久保留；证书仅用于本机开发，浏览器首次访问需信任它。正式环境使用对应域名的受信任证书。

2. 填写 `.env`：开发模式 `NODE_ENV=development`，独立 `PORT` 与一致的 `WORKBENCH_PUBLIC_ORIGIN=https://localhost:<端口>`；数据库、附件、日志及证书使用刚准备的绝对路径。`.env` 不展开 `$HOME`，需填写展开后的值。真实账户服务要求配置 `SMTP_HOST`、`SMTP_FROM` 及邮件服务所需认证参数，缺必需配置会拒绝启动；注册与找回还要求邮件服务器实际可达。密钥与 SMTP 凭证不提交。
3. 执行 `npm run dev`。该入口准备数学静态资产，然后运行同源 HTTPS、Vite 热更新与 API 自动重启。首次启动创建空库并迁移；缺少认证密钥、有效 origin 或证书会明确失败。
4. 访问配置的地址，检查 `/api/health` 和实际登录页面；完成注册、保存与刷新读回后再判断相应业务可用。自动验证优先使用[已有隔离 harness](acceptance/README.md)，无需真实邮件账户。

### 持久用户服务

Linux 本机需登录后自动启动时，在 `~/.config/systemd/user/teacherworkspace-preview.service` 写入以下内容，将仓库位置和 `node` / `npm` 所在目录替换为本机绝对路径，可用 `command -v node`、`command -v npm` 查找：

```ini
[Unit]
Description=TeacherWorkspace preview development server

[Service]
WorkingDirectory=/absolute/path/to/TeacherWorkspace-preview
Environment="PATH=/absolute/node-bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/absolute/node-bin/npm run dev
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
```

执行 `systemctl --user daemon-reload` 和 `systemctl --user enable --now teacherworkspace-preview.service`。日常用 `status`、`restart`、`stop` 管理，日志用 `journalctl --user -u teacherworkspace-preview.service`。这里的私有 `.env` 与手动启动使用同一份，不需要额外本机启动脚本。

### 固定构建

运行 `npm run build`，配置 `NODE_ENV=production` 和 `WORKBENCH_WEB_DIST` 指向 `apps/web/dist`，再执行 `node --env-file=.env apps/api/src/server.js`。Web 与 `/api` 由同一个 HTTPS origin 提供，固定构建不热更新。

隔离 Web 构建使用 `npm --workspace @refatos/web run build -- --outDir /absolute/test/web-dist` 并设置对应 `WORKBENCH_WEB_DIST`；不要覆盖在线实例的构建产物。API 构建使用系统临时目录检查装配与迁移。

## 必需配置的来源

变量、默认值与校验以 `apps/api/src/config/env.js` 和 [.env.example](../.env.example) 为准。每个隔离实例配置自己的 SQLite、文件目录、同源 HTTPS 和 Web 构建路径；测试收件器与真实邮件分开。已有实例保持其认证密钥，生产不使用 test-principal。

<a id="文件转换工具"></a>
## 文件转换工具

材料预览与输出还依赖系统工具和字体，不能只安装 npm 依赖：

- `MATERIALS_PANDOC_PATH` 指向 Pandoc 可执行文件，使用者为 `apps/api/src/modules/lessons/pandoc.js`。
- `MATERIALS_OFFICE_ROOT` 指向包含 `program/soffice` 的 LibreOffice 根目录，使用者为 `apps/api/src/workbench/files/converter.js`。
- `QUESTIONS_XPDF_PDFTOHTML` 指向 Xpdf 的 `pdftohtml`，用于题库文字 PDF 的阅读顺序与双栏识别；使用者为 `apps/api/src/modules/questions/native-pdf.js`。Poppler 继续负责页图、裁图和资源正文检索。
- 转换还调用 `bwrap` 和相应格式工具；准确命令从同目录的 `conversion-worker.mjs` 核对。
- 工具安装在源码之外的持久目录，配置指向实际可执行文件；新环境独立安装，不从旧任务现场复制。

当前实例的工具可用性与待处理项由[台账](plans/run-state.md)维护；修改运行配置后必须实际转换并打开文件验证。

新机器从 [Pandoc 官方安装入口](https://pandoc.org/installing.html)和 [LibreOffice 官方安装入口](https://www.libreoffice.org/installation-instructions/)准备工具；本机验证版本分别为 3.11 与 26.8，其他版本须重新核对输出。通过系统包管理器安装 Poppler、Bubblewrap、Fontconfig 和中文字体（例如 Noto Sans CJK SC），确保 `/usr/bin/pdfinfo`、`/usr/bin/pdftoppm`、`/usr/bin/pdftotext` 与 `bwrap` 可执行。用 `fc-match ':lang=zh-cn'` 核对实际中文字体，再运行材料回归并打开生成文件。Xpdf 按下节单独安装，不能用 Poppler 同名程序代替。浏览器回归另需[安装 Playwright 浏览器](acceptance/README.md#浏览器准备)。

### 题库文字 PDF

题库使用独立的 Xpdf 4.06 `pdftohtml` 可执行文件读取文字层；页面预览与配图定位继续使用已有 Poppler。Xpdf 的 HTML 保留按阅读顺序排列的逐行文字，适配层只取文字节点，不向浏览器提供生成的 HTML，也不自建分栏算法。`pdftotext -layout` 会跨栏拼横行，Xpdf 默认纯文本又会合并段落内的题号行，因此二者不能替代此入口。

Linux x86-64 的官方包为 [xpdf-tools-linux-4.06.tar.gz](https://dl.xpdfreader.com/xpdf-tools-linux-4.06.tar.gz)，SHA-256 为 `940c137cbd1856e45813da1a25c12e8dd3dc8997b8ea735feb858684603031e3`。解压并保留完整包后，将运行环境的 `QUESTIONS_XPDF_PDFTOHTML` 指向 `bin64/pdftohtml` 的绝对路径；未配置时查找 `/usr/local/bin/xpdf-pdftohtml`，不要指向 Poppler 的同名命令。安装在用户持久工具目录，按实际路径配置到 `.env`。Linux x86-64 示例：

```bash
xpdfHome="$HOME/.local/share/teacherworkspace-tools"
mkdir -p "$xpdfHome"
curl --fail --location https://dl.xpdfreader.com/xpdf-tools-linux-4.06.tar.gz -o "$xpdfHome/xpdf-tools-linux-4.06.tar.gz"
printf '%s  %s\n' '940c137cbd1856e45813da1a25c12e8dd3dc8997b8ea735feb858684603031e3' "$xpdfHome/xpdf-tools-linux-4.06.tar.gz" | sha256sum -c -
tar -xzf "$xpdfHome/xpdf-tools-linux-4.06.tar.gz" -C "$xpdfHome"
export QUESTIONS_XPDF_PDFTOHTML="$xpdfHome/xpdf-tools-linux-4.06/bin64/pdftohtml"
```

启动 API、HTTP 测试和上述浏览器验证时使用同一配置。读取在已有 Bubblewrap 禁网沙箱内逐页执行，输入只读，输出写入独立临时目录并在结束后清理，沿用时间与内存限制。工具缺失或失败时原稿保留、整理任务失败，修复配置后可重试；不静默退回会串栏的路径。Xpdf 包声明 GPL v2 或 v3，重分发二进制需保留包内 README、手册、COPYING 和 COPYING3；本仓库只调用外部工具，不收录其二进制或源码。

## 本地页识别工具

`MATERIALS_OCR_HOME` 指向独立、持久的 MinerU 工具目录。未配置时不运行新识别，已保存的机器结果仍可读取。题库、备课和资源共用这一套识别服务；识别与人工采用的边界见[共用页识别](contracts/recognition.md)。

固定方案为 MinerU Standard、Pro-2605 Q8、CPU 版面分析和 CUDA llama.cpp 内容识别，只运行单路内容识别，不追加全页 CPU 复核。表格使用固定 LaTeX 提示，保留公式的原始识别文本；配图按模型定位从请求原页裁取，不重画图形。模型、提示、依赖、字体和下载摘要在 `scripts/recognition/manifest.json` 与 `requirements.freeze.txt`，适配入口为 `apps/api/src/workbench/recognition/worker.py` 和 `mineru_adapter.py`。改变识别配置时递增引擎修订，不能用旧缓存代替新配置验证。

服务端要求 Linux x86-64、可运行随包 CUDA runtime 的 NVIDIA 驱动、`nvidia-smi`、Bubblewrap 和用户级 systemd。安装另需 Python 3.12 或更新版本、[uv](https://docs.astral.sh/uv/getting-started/installation/) 和提供 `bsdtar` 的 libarchive；这些宿主工具由系统包管理器准备。驱动不由安装脚本安装或替换。实际验证硬件和能力边界见[选型验收](acceptance/ocr-selection.md)，不据此宣称其他服务器已经验证。

在仓库根目录执行：

```bash
ocrHome="${XDG_DATA_HOME:-$HOME/.local/share}/teacherworkspace-tools/mineru-pro-2605"
python3 scripts/recognition/install.py "$ocrHome"
```

目标必须为空目录。安装器取得独立 Python、按哈希冻结的依赖、模型、CUDA llama.cpp 及固定字体，校验文件摘要和依赖关系。已有环境保留，另选新目录准备；失败时保留日志和现场，不能切换服务。安装完成后，在本实例私有 `.env` 中将 `MATERIALS_OCR_HOME` 设为实际绝对路径，重启 API，再上传一页真实材料，核对文字、公式、配图、原页定位与取消。已保存结果回放不能代替这一步。

识别运行时禁止外网和自动下载。首次请求启动归属本实例及该账户的模型进程，连续页复用；空闲 60 秒后释放。取消、超时、下一次识别改用另一账户、账户删除或服务关闭时，先确认整个进程范围停止，再清理归属明确的临时输入。模型内部通信仅在隔离网络中可见。原始结果及迟到证据的处理见识别契约。

模型 scope 限制内存 6 GiB，禁止 swap；冷启动要求可用 RAM 至少 6.5 GiB、空闲 GPU 显存至少 3 GiB、工作盘空闲至少 25 GiB。热页不会再次要求空出已驻留模型占用的显存。准入不足不启动，运行失败保留原件并允许明确重试。这是当前配置的资源边界，不保证任意复杂页都能完成。

工具目录含有指向安装位置的解释器链接，迁移时应在目标位置重新执行安装器。仓库不携带权重或私有配置，也不依赖本机实验目录。MinerU 采用 Apache-2.0 加附加条款，提供第三方在线服务须在界面或公开文档中明确标识使用 MinerU；模型与第三方依赖各自保留许可。依据见 [MinerU 许可](https://github.com/opendatalab/MinerU/blob/ed50cc15bc2c9bfb00520dadfe61979866e62236/LICENSE.md)及安装清单中的固定来源。

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
| `apps/api/src/contracts/` | API 机器契约及其本地引用，供运行校验和测试读取；文字语义另见[契约说明](README.md#契约说明) |
| `apps/api/src/workbench/` | 共享身份、校验、幂等、迁移、目录装配、文件和任务底座 |
| `apps/api/src/modules/` | 题库、备课、资源、数学、班级和日程业务 |
| `apps/api/src/workbench/reliability/` | 个人资料包、备份、恢复与维护锁 |
| `packages/shared/` | 两侧消费的静态模块目录及共享定义 |
| `prototype/` | 已确认 UI/UX 的参考，生产运行不依赖原型源码 |

实际 API 装配映射在 `apps/api/src/workbench/moduleImplementations.js`；Web 的 `features/modules/moduleRegistry.js` 将共享目录投影为页面与图标，外壳、导航、教程和全局搜索消费同一投影，顶层路由从共享目录匹配。资源深链接适配归属资源模块，班级入口负责呈现共享时区的加载、错误和重试。新增能力先找所属模块，不增加另一套全局注册表。

### 持久化与失败语义

业务通过自己的服务、仓储及迁移处理数据；跨模块采用公开端口，避免直接操作别人的表。保存、版本冲突、幂等与未知结果的共同规则由[工作台契约](contracts/workbench.md)拥有。

个人资料包在受理事务内同步调用六模块既有 port 的 `readForExport(principal)`，由各模块读取账户范围内的业务值、保留历史与专属证据，不补写默认设置或结算通知。`workbench/reliability/portable.js` 负责资料格式、对象关系和附件组装；异步打包在受理提交后执行。调整模块存储时维护模块自己的读取端口，物理备份仍沿既有维护路径。

识别与裁图通过 `workbench/files/preview.js` 的 `readRendition` 读取已有固定预览映射，由文件模块校验原件、派生文件的账户归属与完整性。调用者负责自己的页选择和错误字段，不因当前预览更新而改用另一份来源；交换语义见[共用页识别](contracts/recognition.md)。

SQLite、持久文件目录、认证密钥和外部转换工具各有独立运行配置。UI 本地草稿和现场不等于服务端内容；备份仅复制数据库也不足以恢复文件。当前真实运行位置和保护方式见[已有本机实例](#已有本机实例)。
