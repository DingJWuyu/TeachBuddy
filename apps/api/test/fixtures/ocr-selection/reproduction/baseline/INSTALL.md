# 固定 A+B 工具准备

在仓库根目录的同一 Bash 会话先设置 `bundleRoot` 为本包目录、`baselineHome` 为一个尚不存在的新工具目录，再按下面顺序执行。工具准备只依赖本目录中的源码及清单和公开下载源。

依赖：Linux x86-64、可运行 CUDA 12.9 的 NVIDIA 驱动、Bubblewrap、用户级 systemd、nvidia-smi；构建 Python 还需 C 编译器、make、curl、xz 和 OpenSSL、zlib、bz2、lzma、SQLite、ffi 开发库。pip 清单固定版本，不包含 wheel 内容摘要；此限制与原基线一致，不能宣称安装字节已完全冻结。

### 1. 准备 Python 3.12.14 和独立 venv

Python 3.12.14 按原准备路径从官方源码包构建。主机须先具备 C 编译器、`make`、`curl`、`xz`，以及构建 Python 常用扩展的 OpenSSL、zlib、bz2、lzma、SQLite、ffi 开发库。下面的目录放在当前用户的持久数据位置；新目录必须不存在。下载与编译目录只用于安装期间。

```bash
set -euo pipefail
projectRoot="$(pwd -P)"
ocrHome="$(realpath -m "$baselineHome")"
bundleRoot="$(realpath "$bundleRoot")"
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
cp "$bundleRoot/baseline/requirements.freeze.txt" "$ocrHome/requirements.freeze.txt"
cp "$bundleRoot/baseline/manifest.json" "$ocrHome/manifest.json"
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

调用 worker 自身的环境验证，核对固定版本、文件库存和摘要。全部通过后使用本包的 `run-baseline.mjs --home "$ocrHome"`。本步骤不切换产品运行配置。

```bash
"$ocrHome/venv/bin/python" - "$ocrHome" "$bundleRoot" <<'PY'
import pathlib, runpy, sys
home = pathlib.Path(sys.argv[1]).resolve()
repo = pathlib.Path(sys.argv[2]).resolve()
worker = runpy.run_path(str(repo / 'baseline/worker.py'))
worker['verify_environment'](home)
assert pathlib.Path(sys.executable).resolve().is_relative_to(home)
print('fixed OCR profile: OK')
PY
```

全部通过且本次下载产物不再需要后，删除 `ocrBuild` 临时目录。下载或验证失败时保留 `ocrBuild`、profile 和日志以继续诊断，不切换在线服务。

官方依据：[Python 3.12.14 源码与摘要](https://www.python.org/downloads/release/python-31214/)、[Python Unix 源码构建](https://docs.python.org/3.12/using/unix.html)、[Paddle Linux GPU 安装](https://www.paddlepaddle.org.cn/documentation/docs/en/install/pip/linux-pip_en.html)、[PaddleOCR-VL 安装](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/PaddleOCR-VL.html)、[Hugging Face 固定修订下载](https://huggingface.co/docs/huggingface_hub/guides/cli)。

