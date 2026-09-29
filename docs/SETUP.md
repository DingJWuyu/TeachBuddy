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

`MATERIALS_OCR_HOME` 指向独立、持久的 PaddleOCR 工具目录。未配置时不运行新识别，已经保存的机器结果仍可读取。识别结果与人工采用的边界见[共用页识别](contracts/recognition.md)，不把文字搜索命中等同于题目整理或人工校对完成。

本机固定环境为 Linux、NVIDIA RTX 5060 Laptop 8 GiB、Python 3.12.14、PaddlePaddle GPU 3.2.1/cu129、PaddleOCR/PaddleX 3.7.0。需要 `bwrap`、用户级 systemd 和 `nvidia-smi`。运行单页子进程，禁止联网和自动下载，复用既有串行 Job；公开 Paddle API 的微型预热用于本机首次 kernel 加载问题，不修改第三方依赖或模型函数。

VLM 通过官方 `max_pixels` 参数限制每块内部识别分辨率，避免大表格的视觉 attention 超出显存；原页保持不变。版面采用官方矩形裁切模式，表格范围保守扩边，避免边缘文字被旧多边形遮掉；原始结果记录实际范围，配图仍从原页像素裁取。小字和复杂表格仍须对照原稿校对。改变识别参数时同时递增结果修订和工具清单修订，不能把旧缓存当作新配置的验证结果。参数入口见[官方说明](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/PaddleOCR-VL.html)。

内容复核 profile 使用用户持久工具目录（例如 `~/.local/share/teacherworkspace-tools/paddleocr-vl-1.6-content-check`），修订 `paddleocr-vl-1.6/document-5`，布局为 `python/`、`venv/`、`models/`、`requirements.freeze.txt` 与 `manifest.json`。主模型固定到 PaddleOCR-VL-1.6 `c5630abae1d940eafe0697512a0325494b02ab42` 和 PP-DocLayoutV3 `7b48a7566925fa464281f930c58eee04fe2c862a`；新增 PP-OCRv5 mobile det/rec 使用 CPU 串行复核。固定依赖和模型清单随仓库保存在 `scripts/recognition/`，四个模型、许可及依赖清单共 36 个文件逐项记录 SHA-256；已安装依赖和权重不进入 Git。运行配置显式选择 profile，准备新目录不会自动切换已有服务。

单页 scope 限制内存 6 GiB、禁止 swap，启动前要求实际可用 RAM 至少 6.5 GiB、GPU 0 空闲显存至少 7 GiB、工作盘空闲至少 25 GiB。准入不足不启动模型；运行中达到上限会失败并允许重试，原件保留。此限制来自固定本机实测，不保证任意复杂页面都能完成。

<details>
<summary>从零准备固定 OCR 环境</summary>

在仓库根目录的同一个 Bash 会话执行以下命令。安装到新目录，从官方固定版本准备 Python、依赖和模型，不复制已有实例。已有目标目录时停止，另选新路径；安装完成并验证后再切换运行配置。

### 1. 准备 Python 3.12.14 和独立 venv

Python 3.12.14 只有官方源码包。主机须先具备 C 编译器、`make`、`curl`、`xz`，以及构建 Python 常用扩展的 OpenSSL、zlib、bz2、lzma、SQLite、ffi 开发库。下面的目录放在当前用户的持久数据位置；新目录必须不存在。下载与编译目录只用于安装期间。

```bash
set -euo pipefail
projectRoot="$(pwd -P)"
ocrHome="${XDG_DATA_HOME:-$HOME/.local/share}/teacherworkspace-tools/paddleocr-vl-1.6-content-check"
test ! -e "$ocrHome"
ocrBuild="$(mktemp -d)"
mkdir -p "$ocrHome"
curl -fL 'https://www.python.org/ftp/python/3.12.14/Python-3.12.14.tar.xz' -o "$ocrBuild/Python-3.12.14.tar.xz"
printf '%s  %s\n' '5c8462af5790baf43a321a1559dbe0db06d1be4300fb85fb53c40060668e548a' "$ocrBuild/Python-3.12.14.tar.xz" | sha256sum -c -
tar -xf "$ocrBuild/Python-3.12.14.tar.xz" -C "$ocrBuild"
cd "$ocrBuild/Python-3.12.14"
./configure --prefix="$ocrHome/python" --with-ensurepip=install
make -j"$(nproc)"
make altinstall
cd "$projectRoot"
"$ocrHome/python/bin/python3.12" --version
"$ocrHome/python/bin/python3.12" -m venv "$ocrHome/venv"
"$ocrHome/venv/bin/python" -m pip --version
```

版本输出必须是 `Python 3.12.14`。Python 官方给出源码包 SHA-256，并建议自建安装使用 `make altinstall`；`venv` 默认附带 pip。若构建缺某个系统开发库，补该库后重新编译，确认 `_ssl`、`_sqlite3`、`_lzma` 等扩展可导入，再继续。

### 2. 安装固定依赖

先从 Paddle 官方 cu129 索引取得精确 GPU wheel，再从 PyPI 安装仓库中的完整冻结清单。`--no-deps` 使安装严格按冻结文件执行；完成后用 `pip check` 和逐包版本比较发现缺漏或元数据冲突。不能改用 CPU wheel、其他 CUDA 索引或较新 Paddle 版本，因为 worker 会拒绝环境。

```bash
cp scripts/recognition/requirements.freeze.txt "$ocrHome/requirements.freeze.txt"
cp scripts/recognition/manifest.json "$ocrHome/manifest.json"
"$ocrHome/venv/bin/python" -m pip install --no-deps --only-binary=:all: \
  --index-url https://www.paddlepaddle.org.cn/packages/stable/cu129/ \
  'paddlepaddle-gpu==3.2.1'
"$ocrHome/venv/bin/python" -m pip install --no-deps --only-binary=:all: \
  --index-url https://pypi.org/simple -r "$ocrHome/requirements.freeze.txt"
"$ocrHome/venv/bin/python" -m pip check
"$ocrHome/venv/bin/python" - <<'PY'
from importlib.metadata import version
from pathlib import Path
import sys
home = Path(sys.executable).resolve().parents[2]
for line in (home / 'requirements.freeze.txt').read_text().splitlines():
    name, expected = line.split('==', 1)
    actual = version(name)
    assert actual == expected, (name, expected, actual)
import paddle
assert paddle.version.cuda() == '12.9', paddle.version.cuda()
print('fixed Python packages and Paddle CUDA 12.9: OK')
PY
```

若 `sys.executable` 通过 venv 符号链接指向 `python/`，上段 `parents[2]` 应为 profile 根；可同时用 `readlink -f "$ocrHome/venv/bin/python"` 核对解释器位置。运行实例在 bubblewrap 中只读绑定该 profile，安装后不依赖网络。

### 3. 下载四个固定模型

两个主模型从 PaddlePaddle 的 Hugging Face 官方仓库按完整 commit 下载。`hf download --local-dir` 会在模型目录留下 `.cache/huggingface/` 元数据，模型下载完成后移除该缓存，避免运行时清单库存校验失败。PP-OCRv5 两个 mobile 包使用既有官方推理模型 tar 地址，先校验下载 tar 的 SHA-256 再解包；README 固定到已核实的 PaddlePaddle 模型修订，许可证全文与主模型相同。

```bash
mkdir -p "$ocrHome/models"
HF_HOME="$ocrBuild/hf" "$ocrHome/venv/bin/hf" download \
  PaddlePaddle/PP-DocLayoutV3 \
  --revision 7b48a7566925fa464281f930c58eee04fe2c862a \
  --local-dir "$ocrHome/models/PP-DocLayoutV3"
HF_HOME="$ocrBuild/hf" "$ocrHome/venv/bin/hf" download \
  PaddlePaddle/PaddleOCR-VL-1.6 \
  --revision c5630abae1d940eafe0697512a0325494b02ab42 \
  --local-dir "$ocrHome/models/PaddleOCR-VL-1.6"
rm -rf "$ocrHome/models/PP-DocLayoutV3/.cache" "$ocrHome/models/PaddleOCR-VL-1.6/.cache"

for ocrModel in PP-OCRv5_mobile_det PP-OCRv5_mobile_rec; do
  curl -fL "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/${ocrModel}_infer.tar" \
    -o "$ocrBuild/$ocrModel.tar"
done
printf '%s  %s\n' \
  50446e5d01ac2a73d5319c89513281f6578414c888c602f9af13f93feefffc58 "$ocrBuild/PP-OCRv5_mobile_det.tar" \
  566b9512b34e34a9f0db54d87b51fa5a0b9ed2cf1ab7e49728cc0b8b5a64f414 "$ocrBuild/PP-OCRv5_mobile_rec.tar" | sha256sum -c -
for ocrModel in PP-OCRv5_mobile_det PP-OCRv5_mobile_rec; do
  tar -xf "$ocrBuild/$ocrModel.tar" -C "$ocrBuild"
  mv "$ocrBuild/${ocrModel}_infer" "$ocrHome/models/$ocrModel"
  cp "$ocrHome/models/PaddleOCR-VL-1.6/LICENSE" "$ocrHome/models/$ocrModel/LICENSE"
done
curl -fL 'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det/resolve/0d63e78e2b680928f6b1747d76a08db6e645efb7/README.md' \
  -o "$ocrHome/models/PP-OCRv5_mobile_det/README.md"
curl -fL 'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec/resolve/682f20538d8c086cb2128e5cfac775e6c4904e85/README.md' \
  -o "$ocrHome/models/PP-OCRv5_mobile_rec/README.md"
```

### 4. 完整性与运行验证

这一步逐个比对仓库固定清单，包括额外文件和缺失文件，并调用 worker 自身的环境验证。只在全部通过后将私有运行配置的 `MATERIALS_OCR_HOME` 指向 `ocrHome`，由实例维护者重启 API；再用真实上传的一页检查文字、公式、配图及取消路径。不能用原始结果回放替代 GPU 推理。

```bash
"$ocrHome/venv/bin/python" - "$ocrHome" "$projectRoot" <<'PY'
import hashlib, json, pathlib, runpy, sys
home = pathlib.Path(sys.argv[1]).resolve()
repo = pathlib.Path(sys.argv[2]).resolve()
manifest = json.loads((home / 'manifest.json').read_text())
actual = {'requirements.freeze.txt'} | {
    str(p.relative_to(home)) for p in (home / 'models').rglob('*') if p.is_file()
}
assert actual == set(manifest['files']), (sorted(actual - set(manifest['files'])), sorted(set(manifest['files']) - actual))
for name, expected in manifest['files'].items():
    with (home / name).open('rb') as stream:
        assert hashlib.file_digest(stream, 'sha256').hexdigest() == expected, name
worker = runpy.run_path(str(repo / 'apps/api/src/workbench/recognition/worker.py'))
worker['verify_environment'](home)
assert pathlib.Path(sys.executable).resolve().is_relative_to(home)
print('fixed OCR profile: OK')
PY
"$ocrHome/venv/bin/python" apps/api/test/recognition-content-check.test.py
```

全部通过且本次下载产物不再需要后，删除 `ocrBuild` 临时目录。下载或验证失败时保留 `ocrBuild`、profile 和日志以继续诊断，不切换在线服务。

官方依据：[Python 3.12.14 源码与摘要](https://www.python.org/downloads/release/python-31214/)、[Python Unix 源码构建](https://docs.python.org/3.12/using/unix.html)、[Paddle Linux GPU 安装](https://www.paddlepaddle.org.cn/documentation/docs/en/install/pip/linux-pip_en.html)、[PaddleOCR-VL 安装](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/PaddleOCR-VL.html)、[Hugging Face 固定修订下载](https://huggingface.co/docs/huggingface_hub/guides/cli)。

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
