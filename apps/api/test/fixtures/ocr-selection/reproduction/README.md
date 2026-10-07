# 固定 OCR 双路线复测

从新 clone 准备公开固定工具后，依次执行开发集 D1-D8 的原完整 A+B 控制路线与当前产品 MinerU 路线。每页各一次；A+B 每页新 worker，MinerU 同一实例串行八页，结束调用产品 close。包不读取 GT、authoring 或 heldout，不包含模型权重、缓存、私有配置或测量输出。

包中的基线 worker 与 checker 保留正式测量的源码字节。`run-baseline.mjs` 来自正式直接 runner，只收窄为完整 A+B，并将源码和输入定位改为包目录及显式参数。`run-candidate.mjs` 直接调用仓库产品 `createRecognizer`；候选源文件摘要在 `candidate-source-hashes.json`。运行依赖随仓库提供的产品源码、安装入口和固定 fixture。

本包用于重做真实推理并留下质量复核 raw/assets。它不替代已经保存的三轮正式冷热与资源数据，也不将产品 runtime 的页完成时间冒充旧独立 client 的正式计时。复测性能需保持同一主机、同一输入和固定协议。

## 准备

需要 Linux x86-64、兼容随包 CUDA runtime 的 NVIDIA 驱动、用户级 systemd、Bubblewrap 和 nvidia-smi。A+B 准入仍要求空闲显存至少 7 GiB、可用 RAM 至少 6.5 GiB、工作盘至少 25 GiB；两路线的模型 scope 均限制内存 6 GiB、swap 0。候选安装另需 uv、Python 3.12 或更新版本和 bsdtar。驱动和系统工具由主机准备，包不安装或替换驱动。

从 clone 根目录执行，设置下面两个模型目录。两个模型 home 必须是不同的新持久目录，输出必须是尚不存在的新目录。此处没有默认个人目录。

```bash
repoRoot="$(pwd -P)"
bundleRoot="$repoRoot/apps/api/test/fixtures/ocr-selection/reproduction"
baselineHome='<新的 A+B 工具目录>'
candidateHome='<新的 MinerU 工具目录>'
npm ci
```

按 [baseline/INSTALL.md](baseline/INSTALL.md) 的原直接步骤准备 A+B，包括官方 Python 源码摘要、Paddle cu129 GPU wheel、完整固定依赖版本、四个固定公开模型及逐文件摘要校验。

MinerU 使用仓库现有安装入口。其清单固定 Python、依赖下载摘要、模型、llama.cpp、CUDA runtime 和字体，不需要本包另建安装框架：

```bash
python3 scripts/recognition/install.py "$candidateHome"
```

## 直接执行

两路线串行执行，确保其余模型槽空闲。下面每条命令只执行 D1-D8 一次，无额外冷 D1，也无失败重跑。输入来自包内相对路径清单，由当前仓库 fixture 读取，逐页校验 SHA-256。

```bash
node "$bundleRoot/run-baseline.mjs" \
  --repo "$repoRoot" --home "$baselineHome" --out test-results/ocr-reproduction/ab
node "$bundleRoot/run-candidate.mjs" \
  --repo "$repoRoot" --home "$candidateHome" --out test-results/ocr-reproduction/mineru
```

A+B 保留逐页 `run-N/output/raw.json`、`result.json` 和附件、事件、stderr、scope 命令及资源日志。资源日志内全机 RSS/交换是观测值，scope 的 cgroup 记录才是该 worker 的边界。候选保留逐页 `raw.json`（含 HTTP request/response）、page-blocks、可选 markdown、derivations 和 original/derived 附件，另保留页完成时间与 close 结果；产品 scope 自身负责 6 GiB/swap 0 与整组停止。两路线输出完整 raw，质量复核需另行对照 GT，不把复测 runner 的执行成功视为质量通过。

候选 runner 在执行前核对产品源码摘要；产品文件改变时停止，不静默跟随新版。失败保留已完成页、错误和 runtime 现场，不自动重跑。`close.json` 显示清理失败时先核对对应 owned scope，不能把输出文件存在视为整轮通过。

## 当前可核查边界

- 候选 runner 已使用现有实际 raw 的无模型替身，检查八页输入、全部输出写出和 close 路径。这是返回值消费 dryrun，不是推理或性能测量。A+B 安装步骤尚未在新的独立工具目录实际复建；候选也需在新 clone 准备工具后验证真实推理。
- 原 A+B 依赖清单固定版本，但没有 wheel 内容摘要；Paddle GPU wheel 固定官方 cu129 来源，模型及 Python 源码固定 SHA-256。原环境只验证 Python 和三项核心依赖版本，不能据此宣称所有安装字节完全一致。
- 公开下载源必须可达并继续提供冻结版本；兼容的 NVIDIA 硬件、驱动、足够资源、systemd user session 和完整仓库 fixture 是运行前提。
