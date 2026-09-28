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
- 更换依赖后准备本地数学资产并重启；改变环境变量、证书或 `apps/api/src/contracts/` 等通过文件系统读取的运行定义后手动重启：`systemctl --user restart teacherworkspace-preview.service`。Node 的模块监听不涵盖所有外部文件。

当前服务是用户级临时单元，完整停止后会被 systemd 回收。若 `start` 提示单元不存在，用原入口重新创建：

```bash
systemd-run --user --unit=teacherworkspace-preview --collect \
  --property=WorkingDirectory=/home/liam_t/项目/TeacherWorkspace-preview \
  --property=Restart=on-failure \
  /home/liam_t/项目/TeacherWorkspace-preview/.scratch/preview/start.sh
```

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

### 题库文字 PDF

题库使用独立的 Xpdf 4.06 `pdftohtml` 可执行文件读取文字层；页面预览与配图定位继续使用已有 Poppler。Xpdf 的 HTML 保留按阅读顺序排列的逐行文字，适配层只取文字节点，不向浏览器提供生成的 HTML，也不自建分栏算法。`pdftotext -layout` 会跨栏拼横行，Xpdf 默认纯文本又会合并段落内的题号行，因此二者不能替代此入口。

Linux x86-64 的官方包为 [xpdf-tools-linux-4.06.tar.gz](https://dl.xpdfreader.com/xpdf-tools-linux-4.06.tar.gz)，SHA-256 为 `940c137cbd1856e45813da1a25c12e8dd3dc8997b8ea735feb858684603031e3`。解压并保留完整包后，将运行环境的 `QUESTIONS_XPDF_PDFTOHTML` 指向 `bin64/pdftohtml` 的绝对路径；未配置时查找 `/usr/local/bin/xpdf-pdftohtml`，不要指向 Poppler 的同名命令。开发测试可以装在当前 worktree 的 `.scratch/questions-tools/`，部署时放在独立持久工具目录。安装步骤：

```bash
mkdir -p .scratch/questions-tools
curl --fail --location https://dl.xpdfreader.com/xpdf-tools-linux-4.06.tar.gz -o .scratch/questions-tools/xpdf-tools-linux-4.06.tar.gz
printf '%s\n' '940c137cbd1856e45813da1a25c12e8dd3dc8997b8ea735feb858684603031e3  .scratch/questions-tools/xpdf-tools-linux-4.06.tar.gz' | sha256sum -c -
tar -xzf .scratch/questions-tools/xpdf-tools-linux-4.06.tar.gz -C .scratch/questions-tools
export QUESTIONS_XPDF_PDFTOHTML="$PWD/.scratch/questions-tools/xpdf-tools-linux-4.06/bin64/pdftohtml"
```

启动 API、HTTP 测试和上述浏览器验证时使用同一配置。读取在已有 Bubblewrap 禁网沙箱内逐页执行，输入只读，输出写入独立临时目录并在结束后清理，沿用时间与内存限制。工具缺失或失败时原稿保留、整理任务失败，修复配置后可重试；不静默退回会串栏的路径。Xpdf 包声明 GPL v2 或 v3，重分发二进制需保留包内 README、手册、COPYING 和 COPYING3；本仓库只调用外部工具，不收录其二进制或源码。

## 本地页识别工具

`MATERIALS_OCR_HOME` 指向独立、持久的 PaddleOCR 工具目录。未配置时不运行新识别，已经保存的机器结果仍可读取。识别结果与人工采用的边界见[共用页识别](contracts/recognition.md)，不把文字搜索命中等同于题目整理或人工校对完成。

本机固定环境为 Linux、NVIDIA RTX 5060 Laptop 8 GiB、Python 3.12.14、PaddlePaddle GPU 3.2.1/cu129、PaddleOCR/PaddleX 3.7.0。需要 `bwrap`、用户级 systemd 和 `nvidia-smi`。运行单页子进程，禁止联网和自动下载，复用既有串行 Job；公开 Paddle API 的微型预热用于本机首次 kernel 加载问题，不修改第三方依赖或模型函数。

VLM 通过官方 `max_pixels` 参数限制每块内部识别分辨率，避免大表格的视觉 attention 超出显存；原页保持不变。版面采用官方矩形裁切模式，表格范围保守扩边，避免边缘文字被旧多边形遮掉；原始结果记录实际范围，配图仍从原页像素裁取。小字和复杂表格仍须对照原稿校对。改变识别参数时同时递增结果修订和工具清单修订，不能把旧缓存当作新配置的验证结果。参数入口见[官方说明](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/PaddleOCR-VL.html)。

内容复核 profile 为 `/home/liam_t/.local/share/teacherworkspace-tools/paddleocr-vl-1.6-content-check`，修订 `paddleocr-vl-1.6/document-5`，布局为 `python/`、`venv/`、`models/`、`requirements.freeze.txt` 与 `manifest.json`。主模型固定到 PaddleOCR-VL-1.6 `c5630abae1d940eafe0697512a0325494b02ab42` 和 PP-DocLayoutV3 `7b48a7566925fa464281f930c58eee04fe2c862a`；新增 PP-OCRv5 mobile det/rec 使用 CPU 串行复核。四个模型、许可及依赖清单共 36 个文件逐项记录 SHA-256；依赖和权重不进入 Git。运行配置显式选择 profile，准备新目录不会自动切换已有服务。

单页 scope 限制内存 6 GiB、禁止 swap，启动前要求实际可用 RAM 至少 6.5 GiB、GPU 0 空闲显存至少 7 GiB、工作盘空闲至少 25 GiB。准入不足不启动模型；运行中达到上限会失败并允许重试，原件保留。此限制来自固定本机实测，不保证任意复杂页面都能完成。

<details>
<summary>从既有固定环境准备独立内容复核 profile</summary>

在仓库根目录执行。旧目录必须是上面列明版本的完整本机环境；目标目录应为新目录，不能覆盖在线 profile。复制使用可用的文件系统 reflink，新 venv 的解释器必须属于目标目录。

```bash
ocrSource=/home/liam_t/.local/share/teacherworkspace-tools/paddleocr-vl-1.6
ocrTarget=/home/liam_t/.local/share/teacherworkspace-tools/paddleocr-vl-1.6-content-check
mkdir "$ocrTarget"
cp --reflink=auto -a "$ocrSource/python" "$ocrTarget/python"
"$ocrTarget/python/bin/python3.12" -m venv --without-pip "$ocrTarget/venv"
cp --reflink=auto -a "$ocrSource/venv/lib/python3.12/site-packages" "$ocrTarget/venv/lib/python3.12/"
cp --reflink=auto -a "$ocrSource/models" "$ocrTarget/models"
cp "$ocrSource/requirements.freeze.txt" "$ocrTarget/requirements.freeze.txt"
ocrDownload=$(mktemp -d)
for ocrModel in PP-OCRv5_mobile_det PP-OCRv5_mobile_rec; do
  curl -fL "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/${ocrModel}_infer.tar" -o "$ocrDownload/$ocrModel.tar"
done
printf '%s  %s\n' \
  50446e5d01ac2a73d5319c89513281f6578414c888c602f9af13f93feefffc58 "$ocrDownload/PP-OCRv5_mobile_det.tar" \
  566b9512b34e34a9f0db54d87b51fa5a0b9ed2cf1ab7e49728cc0b8b5a64f414 "$ocrDownload/PP-OCRv5_mobile_rec.tar" | sha256sum -c -
```

两个校验均成功后再解包。官方 [det](https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det/blob/main/README.md) 和 [rec](https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec/blob/main/README.md) model card 声明 Apache-2.0；同时保留声明和许可证全文。

```bash
for ocrModel in PP-OCRv5_mobile_det PP-OCRv5_mobile_rec; do
  tar -xf "$ocrDownload/$ocrModel.tar" -C "$ocrDownload"
  mv "$ocrDownload/${ocrModel}_infer" "$ocrTarget/models/$ocrModel"
  curl -fL "https://huggingface.co/PaddlePaddle/$ocrModel/raw/main/README.md" -o "$ocrTarget/models/$ocrModel/README.md"
  cp "$ocrTarget/models/PaddleOCR-VL-1.6/LICENSE" "$ocrTarget/models/$ocrModel/LICENSE"
done
"$ocrTarget/venv/bin/python" - "$ocrTarget" <<'PY'
import hashlib, json, pathlib, runpy, sys
home = pathlib.Path(sys.argv[1]).resolve()
worker = runpy.run_path('apps/api/src/workbench/recognition/worker.py')
files = [home / 'requirements.freeze.txt', *sorted(p for p in (home / 'models').rglob('*') if p.is_file())]
manifest = {'revision': worker['REVISION'], 'models': worker['MODELS'], 'files': {
    str(p.relative_to(home)): hashlib.file_digest(p.open('rb'), 'sha256').hexdigest() for p in files}}
(home / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
worker['verify_environment'](home)
assert pathlib.Path(sys.executable).resolve().is_relative_to(home)
PY
"$ocrTarget/venv/bin/python" apps/api/test/recognition-content-check.test.py
```

确认许可、清单校验和实际单页识别成功后清理下载临时目录。将私有运行配置的 `MATERIALS_OCR_HOME` 改为新 profile，再由实例维护者重启 API；保留旧 profile 可供明确回退。不要把模型放进仓库任务产物目录，也不要复制旧 `work/` 原页。

</details>

移到另一目录时用目标 Python 重新创建 venv，再安装固定依赖；不能复制指向实验 worktree 的绝对解释器链接。模型目录保持完整，配置指向新目录后重启 API，再从真实上传验证文字、公式、裁图与取消。运行适配与准确参数由 `apps/api/src/workbench/recognition/runtime.js`、`worker.py` 维护，逐页资源准入失败会留在可重试状态，不停其他进程或改驱动/swap。此配置只证明当前主机路径，不代表其他设备已验证。

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
