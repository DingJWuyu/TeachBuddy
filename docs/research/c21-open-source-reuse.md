# 自动提取：本地页解析候选与未完成实验

当前手动/原生能力见[题库](../features/questions.md)。本地权重许可未答复，全部旧在线窗口关闭；本页不授权下载、推理或产品接入。公开能力调查固定于 2026-09-22，候选版本、许可证与硬件事实只是当时核对结果，不等于本项目实测。

## 已定实验边界

设计已独立核验，固定全文 `d690372c8f552e37690648f5688e04e1b68c4ae9:docs/arch/capability-checks/C21-reuse.md`，独立依据见[能力证据](../plans/run-state.md#证据边界)。获许可后执行者还需该固定正文中的具体参数、哈希及停止条件；不是再次设计新候选。

只做 PaddleOCR-VL 完整本地管线的一次隔离判别，不并装其他候选。PaddleOCR/PaddleX 3.7.0、VL 1.6 与 PP-DocLayoutV3 固定 revision；隔离 Python 3.12/cu129。准备下载上限 10 GiB、目录增量 20 GiB、90 分钟；最多 7 次页解析，每次含加载 15 分钟，推理全进程禁网。启动预留内存 8 GiB、显存 7 GiB、磁盘 25 GiB，不停其他进程或改驱动/swap。异常、额外权重/许可差异或超限停止，不自动换 CPU/模型/提示。

输入固定为 `ecd1ed6d8f974fba20ac92d40d5b6b943a3b0170:experiments/C21/next-1/` 的 I1/I2/I3、PS4、E7/E8；I1 冷启动重放一次。混合 I+PS 是判别材料，不冒称完整入口成绩；E 保持原 7/8 页号，Q2 原图矛盾按原像素保留。原始页解析、自动映射归并、人工校对分三层评分；映射允许一次有证据的机械修正，不重置推理计数。页块通过而归并失败只解除页解析问题，不放行 C21 产品。

旧在线响应截断和质量失败不能靠接上网络传输解决。重开在线路线须有同 Provider 精确型号控制/预算生效证据，或不同方法对相近数学负载的可审计完整输出，再取得有界窗口；改 token/effort/提示不是自动新增许可。旧消耗在[模型边界](../features/agent.md#模型接入)。

## 结论

**没有找到能直接采用并满足 C21 完整目标的成熟开源自动录题实现。** 现有强项目已能处理中文、数学公式、版面顺序、图像区域和页码，但它们的领域边界是“文档解析”，不是“中文高中数学录题”。关键缺口仍是：

- 把页内块可靠地组成题目、选项和小问；
- 把真实图片裁图唯一绑定到对应题目；
- 把跨页续文与前页题目合并；
- 区分原稿已有答案、解析、教学点评和普通题干；
- 在不确定时保留片段和位置，而不是补写数字、图或答案。

**建议路线：保留当前产品的 File / Job / Document / Location、DOCX 原生读取和已有归并逻辑，仅把 PaddleOCR 3.7.0 + PaddleOCR-VL 1.6 完整本地管线当作“页块识别器”进行一次最小判别实验。** 不 fork 整个项目，不搭额外平台，不先做常驻 OCR 服务。只有固定材料的机器原始结果达到 C21 门槛，才实现薄适配层。

MinerU 4.0.6 是有价值的备选，但调查时不建议与 PaddleOCR-VL 并行安装对打。它的 4.0 架构在 2026-09-16 才发布，调查当天已到 4.0.6；最新修复仍包括 PDF 文本块丢失和中文段落含行内公式时导出崩溃。这证明维护活跃，也证明当前大版本仍处于快速收敛期。

## 判定标准

本调查使用 [C21 四入口标准](../acceptance/mvp-matrix.md#extraction) 和 [固定样本](../acceptance/samples.md#提取与-office-共用样本)，而不用 star、项目自评总分或 Markdown 看起来连贯作为可用证据。合格候选至少要为后续适配提供：

| 维度 | 需要的可消费结果 |
| --- | --- |
| 中文与阅读顺序 | 页内有序文本块，保留页码和坐标，多栏不串行 |
| 数学 | 行内和独立公式返回可编辑 LaTeX 或可无损转入当前 math run 的结构，不只是公式图 |
| 图 | 返回真实区域与原始像素，可裁图存入 File；图描述不计图片成功 |
| 语义结构 | 可以生成 question / continuation / answer / other 记录，保留题号、小问和答案来源 |
| 跨页 | 页块位置不丢失；同题续文只在双向唯一时合并 |
| 不确定性 | 低置信、缺页、缺图、多重归属保持 unresolved 或未分配 |

## 强候选对比

| 候选 | 固定版本与维护事实 | 能直接复用 | 不能直接给出 | 判断 |
| --- | --- | --- | --- | --- |
| PaddleOCR-VL 完整管线 | PaddleOCR `v3.7.0`，commit `b03f46425e8ff4442b268ce449e3eef758146cd4`，2026-06-11 发布；PaddleOCR-VL-1.6 权重 revision `c5630abae1d940eafe0697512a0325494b02ab42`，2026-08-08 更新。[`PaddleOCRVL` 源码](https://github.com/PaddlePaddle/PaddleOCR/blob/v3.7.0/paddleocr/_pipelines/paddleocr_vl.py) 把 1.6 设为默认并明列 local/server backend | 中英文、公式 Markdown/LaTeX、页内阅读顺序、块 bbox/多边形、图像块、PDF 逐页结果、JSON/Markdown/图像产物 | 题目边界、小问语义、题图所有权、普通试题跨页、原有答案归属 | **首选局部适配候选** |
| PP-StructureV3 | 属于同一 PaddleOCR 3.7.0 发行线；官方管线拆成 OCR、版面、公式、表格等小模型 | 页内 OCR、公式、多栏阅读顺序、块坐标；模块更容易单独替换 | 与上项相同的录题语义；官方公布的旧版中文公式 Edit 指标仍显示数学是短板 | **同项目的非生成备案**，仅在 VL 幻觉或硬件不适配时再测 |
| MinerU | `mineru-4.0.6-released`，commit `d5722ddde06f89e931c187d25c9fde488adb01d9`，2026-09-22 发布；4.0.0 在 2026-09-16 发布 | 原生 PDF/Office、OCR、公式、图片资产、页级坐标、有序 MiddleJson / Content List V2；`continues_prev` 可表示通用续文 | 题目/小问/答案角色与题图归属；4.0 新架构的稳定性尚不足以由公开资料转签 | **强备选，当前不首选** |
| PDF.js + 当前 DOCX reader | PDF.js `v6.3.289`，commit `1c8020a7d4e43668ac287a3ecf9a8dbea17e4c56`，2026-08-29 发布；DOCX reader 是产品固定源码 | 原生 PDF 文字、坐标、行结束、页尺寸；DOCX 的段落、部分 OMML、内嵌图和段落位置 | PDF 字形序列不是公式语义；复杂 PDF 图文归属与扫描页仍需视觉管线；DOCX 复杂对象尚有缺口 | **保留为原生快路，不单独解除 C21** |

### PaddleOCR-VL 1.6

#### 一手能力证据

- [官方用法文档](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PaddleOCR-VL.html) 明确描述两阶段完整管线：先用版面模型定位文本、表格、公式和图等区域并决定阅读顺序，再对每个裁图调用 0.9B VLM，最后按顺序合并。文档特别警告，单独运行 VLM 权重不等于完整管线，且更容易出现幻觉文本。因此候选必须是 `PaddleOCRVL(pipeline_version="v1.6")`，不是把权重当通用视觉模型直接提示。
- 结果 `parsing_res_list` 按阅读顺序排列，每块包含 `block_bbox`、`block_label`、`block_content`、`block_id` 和 `block_order`；PDF 还有 `page_index` 和 `page_count`。坐标可转为当前归一化 `Location.box`。官方 API 还能返回 Markdown 引用的真实图像字节，这比只返回图描述更适合现有 File 和裁图链。
- 版面边界支持 `rect`、`quad`、`poly` 和 `auto`，可保留倾斜、弯曲或不规则区域。当前 Location 只支持归一化矩形，适配时应保守取外接矩形并保留原始多边形于内部证据，不扩公开契约。
- 官方多页方法仅明确提供跨页表格合并、标题重建和页面串接。它没有声称能合并跨页数学题，所以 E 的“例6”仍必须交给当前唯一归并逻辑实测。
- [PaddleOCR-VL-1.6 模型卡](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6) 声明中文/英文、公式、表格、图表等能力与 OmniDocBench 结果。这些是发布者公开评测，不是 TeacherWorkspace 的 P / PS / I / E 实测。官方演示图和 JSON 样例只证明调用面与字段形状，不证明中文高中数学质量。

#### 许可与运行条件

| 项目 | 已核实事实 | 对本项目的条件 |
| --- | --- | --- |
| 代码 | [PaddleOCR 仓库](https://github.com/PaddlePaddle/PaddleOCR/tree/v3.7.0) 和 `pyproject.toml` 为 Apache-2.0 | 可局部集成，保留许可与 NOTICE 义务 |
| VLM 权重 | `PaddlePaddle/PaddleOCR-VL-1.6` revision `c5630aba...`，Apache-2.0，HF 文件合计约 1.93 GB，主 `safetensors` 约 1.92 GB | 本地权重属于新的 OCR/视觉依赖，需另行完成依赖和授权准入；它不改动产品在线模型白名单 |
| 版面权重 | `PaddlePaddle/PP-DocLayoutV3` revision `7b48a756...`，Apache-2.0，约 131 MB | 实验锁定 revision，禁止首次运行默默换权重 |
| PP-Structure 公式权重 | 若启用备案，`PaddlePaddle/PP-FormulaNet_plus-M` revision `712e6e2e...`，Apache-2.0，约 617 MB | 还必须记录该次实际加载的 OCR/表格等模型清单和 revision，不把“PaddleOCR 代码 Apache-2.0”代替权重清单 |
| 系统 | 官方手工安装验证 Python 3.9-3.13；PaddlePaddle 3.2.1+；x64 CPU 和多种 GPU 均有路径 | 当前系统 Python 3.14.7 不在验证范围，未来实验应用隔离的 Python 3.12 环境，不污染产品 Node 运行时 |
| GPU | 官方普通 NVIDIA 路径要求 CC >= 7.0、CUDA >= 11.8，Blackwell 另有专用说明 | 本机 RTX 5060 Laptop，CC 12.0，8,151 MiB VRAM，属 Blackwell 路径。公开文档没有给出该整管线的最低 VRAM，8 GB 能否稳定跑固定页仍未知 |
| CPU / RAM | 官方支持 x64 CPU，默认 10 线程，但没有公布 VL 1.6 在 x64 CPU 上的最小 RAM 或固定页耗时 | 本机 20 核、14 GiB RAM + 14 GiB swap；可作可行性兜底，不预先宣称速度可用 |
| 网络 | 默认首次运行会下载权重；官方提供约 10 GB 的离线 GPU 镜像 | 未来准备时可联网下载并校验，正式解析可断网；调查时没有下载 |
| 费用 | 本地开源权重无按次 API 费用 | 只有本机算力、电力和存储成本；不调用文档中的远程商业 endpoint，不上传材料 |

#### 与当前接口的适配点

不应将 PaddleOCR 返回值伪装成 OpenAI Chat Completions 响应再进入 `adaptProviderResponse`。最小适配应在内部抽象一个本地页解析结果，直接产生当前 `records` / `fragments`：

| PaddleOCR 结果 | 当前产品落点 | 保守规则 |
| --- | --- | --- |
| `page_index` + 页尺寸 + `block_bbox` | `Location { kind:"page", fileId, renditionFileId, page, box }` | 坐标归一化且夹在 `[0,1]`；倾斜多边形取外接矩形，原多边形留内部证据 |
| 有序文本/公式块 | `Document` paragraph runs 和 `math` runs | 只把明示公式转为 math；解析不了的 Markdown/LaTeX 保留原文并开 `uncertain-formula` |
| image / chart 块及像素 | File 资产 + `image` block + `parts.role="figure"` | 用原件预览页按坐标重新裁图，并校验原件/rendition hash；不把 VLM 图描述当图 |
| `block_order` 与题号文本 | `readTranscription` 所需的 question / continuation / answer / other | 先用题号、“答案/解析”标题和页间唯一续文规则；无唯一证据就留 unassigned |
| 多页 records | 现有 `mergeExtractions`、`reconcileExtraction` | 复用已有答案唯一匹配、跨页续文、成功页保留、人工版不覆盖和显式重试语义 |

公共 HTTP 契约、File / Job / Import / Draft / Document / Location 不需改。扫描/图像页尚无生产视觉 provider；当前文字层 PDF 已有原生路径，不能将扫描缺口推及全部 PDF，因此未来实现需要的是一个内部 extractor 选择点，不是新的公共端点、队列、平台或模型路由层。

### MinerU 4.0.6

#### 可复用证据

- [4.0.6 发布](https://github.com/opendatalab/MinerU/releases/tag/mineru-4.0.6-released) 和 [4.0 文档](https://opendatalab.github.io/MinerU/) 将能力分为 `flash`、`basic`、`standard`、`advanced`。`basic` 用 ONNX/Torch 小模型在 CPU 上做 OCR、公式和表格；`standard` 再加本地 VLM。默认能力发现不会在本地模型缺失时悄悄上传到官方服务。
- [输出契约](https://opendatalab.github.io/MinerU/reference/output_files/) 包含按页 MiddleJson、Structured Content 和 Content List V2，保留页号、块坐标和图像资产。[固定版本源码](https://github.com/opendatalab/MinerU/blob/mineru-4.0.6-released/mineru/render/_internal/content_list/v2.py) 把行间公式输出为 `math_type:"latex"`，图片输出 asset path，并对每个页内 item 添加归一化 bbox。这些字段比纯 Markdown 更适合 Location 和 Document 适配。
- MiddleJson 对顶层 text/list/table 有 `continues_prev`，能保留通用跨页续文信号。它仍不知道“例6”是题目，也不知道续文是否应合并到某一 Draft；只能作为当前唯一归并规则的输入。
- `flash` 原生 PDF 快路会保留独立公式 bbox 和图像，但官方契约说明某些原生 PDF 独立公式会清空文本内容并使用图像 fallback。因此 `flash` 不能单独签署“可编辑数学”。

#### 许可与运行条件

| 项目 | 已核实事实 | 风险 |
| --- | --- | --- |
| 代码许可 | [MinerU Open Source License](https://github.com/opendatalab/MinerU/blob/mineru-4.0.6-released/LICENSE.md) 是 Apache-2.0 加附加条款：特定商业规模需另行许可，对第三方提供在线服务有显著标识义务 | 不能在报告中简写成“Apache-2.0”；正式纳入前需接受附加条款 |
| VLM 权重 | `opendatalab/MinerU2.5-Pro-2605-1.2B` revision `bff20d4a...`，Apache-2.0，约 2.32 GB | 模型卡评测不是项目样本证据 |
| 小模型包 | `MinerU-4_models_onnx` revision `358310b4...`，约 856 MB，由 PP-DocLayoutV2、PP-OCRv6、PP-FormulaNet 等组成；模型包 README 要求继续适用每个上游权重的原始许可 | ONNX 模型库本身未声明单一 license metadata，正式依赖需按 manifest 复核每个上游 |
| CPU / GPU | 官方说明 Basic 可在 CPU 运行；Standard/Advanced 依赖 VLM engine、输入和并发。高吞吐本地部署建议至少 16 GB 系统内存，8 GB VRAM 只是起始规划值 | 本机 14 GiB RAM 低于该建议，8 GB VRAM 不保证 Standard 负载；Basic 可行性仍只有官方声明，无项目实测 |
| 系统 / 网络 / 费用 | Python >=3.10,<3.15；Linux 基础包可用 ONNX CPU + llama.cpp；权重可预下载本地运行 | 无按次 API 费用，但缓存完成前需网络；调查时未下载、未运行 |

MinerU 若后续成为候选，也只消费 `ParseResult` / Content List V2，不引入 Doclib、WebUI、Router、Gradio 或它的 Job API。当前产品已有这些边界，引入第二套平台只会重复责任。

## 原生 PDF 与 DOCX

### PDF

[PDF.js 6.3.289](https://github.com/mozilla/pdf.js/releases/tag/v6.3.289) 代码为 [Apache-2.0](https://github.com/mozilla/pdf.js/blob/v6.3.289/LICENSE)。它的 [`TextItem` API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html#~TextItem) 提供 `str`、方向、transform、width、height、fontName 和 `hasEOL`，适合把原生 PDF 文本和粗坐标形成低成本快路。

该 API 反过来也显示了能力上限：它返回字符串与绘制变换，不返回分式、根式、分段式等公式语义。它可以减少 P 中普通中文的 OCR，但不能给 C21 的可编辑数学、扫描 PDF 或题图绑定签署。最小复用方式是只读文本层和位置，原页继续使用现有 preview/rendition；公式或低置信页再进本地视觉管线。

当前 `extraction-figures.js` 已在 PDF 上调用 Poppler `pdftohtml` 查题号锚点，用预览像素裁图，并明确限制为单栏、唯一区域、唯一题号。PaddleOCR 的版面块可以替代该自建长线检测器的候选区域来源，但“区域在题号下方”仍不是多栏下的题图归属证据。

### DOCX

当前 `native-word.js` 已直接解析 OOXML，复用已有 `@xmldom/xmldom`、`yauzl` 和 File store：

- 转换分式、根式、上下标、求和/积分、矩阵、分段和部分重音等 OMML 到 LaTeX；
- 把内嵌 PNG/JPEG/WebP 存入 File；
- 把题干和答案映射到 DOCX paragraph/run Location；
- 对不支持的 OMML 打 `uncertain-formula`。

这条路已与产品 Document/Location 高内聚，没有证据支持换成另一个 DOCX 平台。应当在后续实测中按实际缺口增补，重点是编号/列表、表格、文本框/浮动图、尚未覆盖的 OMML 和页码映射。原生 DOCX 的段落顺序、公式和图应继续优先于把整页栅格化后 OCR。

## 为什么不直接采用整个项目

PaddleOCR 和 MinerU 都可导出 Markdown/DOCX，但这不等于生成了产品的可校对题目：

1. 它们的输出单元是页、段落或版面块，不是 Draft / Question。
2. 它们不知道“未提供答案”和“答案页还未处理”的区别。
3. 它们的多页合并主要面向段落、标题或表格，不保证数学题续文。
4. 它们的 WebUI、文档库、服务、任务和资产管理会与现有产品重叠。

因此只复用“从一页像素到有序、有坐标的文本/公式/图块”这一段深能力，把题库语义、原件、任务、校对和入库继续留在当前产品。

## 最小可判别实验

这是后续获得本地权重准入和实验授权后的建议，调查时未执行。

### 固定对象

- PaddleOCR 代码：`v3.7.0` / `b03f46425e8ff4442b268ce449e3eef758146cd4`
- PaddleOCR-VL-1.6：`c5630abae1d940eafe0697512a0325494b02ab42`
- PP-DocLayoutV3：`7b48a7566925fa464281f930c58eee04fe2c862a`
- 管线：完整 `PaddleOCRVL(pipeline_version="v1.6")`，本地推理，不配置任何远程 server URL，无自动重试
- 页面：I 第 1-3 页、PS 第 4 页、E 第 7-8 页，共6页

这 6 页是最小的联合判别集：I1 含分式/根式、选项和 Q2 函数图；I2 含倾斜压缩、两行分段式和对数；I3 含 Q5/Q6 的小问与两类几何图；PS4 是扫描答案页；E7-8 含真实跨页、三列教学表格、小问和函数图。不需要先跑全套 P/PS/I，也不要把人工答案表喂给管线。

### 顺序与停止

1. 在隔离 Python 3.12 环境锁定代码和权重 hash，记录依赖、磁盘、首次加载时间、每页耗时、峰值 RSS/VRAM 和是否触发 swap。
2. 先只跑 I1。若无法在当前 8 GB VRAM / 14 GiB RAM 上稳定完成，或没有产生带坐标的非空文本、公式和图块，就停止 VL 路线。只在失败明确属于显存/后端而非质量时，再单测 PP-StructureV3 lightweight 变体，不自动引入 MinerU。
3. I1 通过后再跑剩余 5 页。保存未修正 JSON、Markdown、每个资产像素、模型/版本/hash 和运行资源。
4. 用一个丢弃式离线 mapper 把块映射到现有 `records`，不接产品，不更改契约。机器原始块、mapper 后 records 和人工校对后结果分开评分。
5. 在权重已缓存的环境中禁网重跑 I1 一次，确认解析不隐式上传或依赖远程 endpoint。

### 解除当前技术阻塞的证据

下列证据需要同时成立，才足以将“本地开源页解析 + 现有产品归并”固定为 C21 新候选：

| 证据 | 通过线 |
| --- | --- |
| 自动主要录入 | I1-I3 共 6 题至少 5 题边界正确，至少 4 题的题干、数学含义和原稿已有内容可直接使用，其余只需局部校对 |
| 可编辑数学 | Q1/Q3/Q4/Q6 的分式、根式、分段、对数、上下标和区间端点产生语义正确的 LaTeX，而不是图片或普通文本拟合 |
| 真图与归属 | Q2/Q5/Q6 都能取得原页像素裁图，只绑定到对应题，且 Location 能回看原区域 |
| 答案 | PS4 的 Q1-Q5 答案分别归入对应 solution；Q6 保持未提供，不由模型解题补入 |
| 真实跨页 | E 的例6、练习、思考至少 2/3 完整分离，例6续页合并，思考小问与图关联，教学点评不进题干 |
| 可定位校对 | 中文、公式、图、选项/小问、答案的错误都带页码与 bbox；不确定项保持 open issue/unassigned |
| 部署可行 | 精确版本在当前机器完成 6 页、不 OOM/崩溃，记录真实耗时和峰值内存，缓存后可断网重放 |
| 许可可接受 | 代码和每个实际加载权重的版本、hash、license 有完整清单，不需要改变在线模型白名单、购买 API 或上传材料 |

如果只有中文 OCR 和 LaTeX 看起来良好，但题图、答案或 E 跨页仍要求人工整题重录，该候选仍为 FAIL。如果识别块合格而离线 mapper 失败，则证据只解除页解析子问题，不能宣称 C21 已解除。

## 仍未知

- PaddleOCR-VL 1.6 在固定中文高中数学 I / PS / E 上的机器原始七项质量，调查时没有项目实测。
- 完整管线在本机 RTX 5060 Laptop 8 GB VRAM / 14 GiB RAM 的耗时、RSS、VRAM 和稳定性。官方支持矩阵不是本机性能证据。
- PaddleOCR 代码 tag 与后续更新的模型 revision 组合是否能完全重现官方评测；因此必须锁定并记录两者。
- 任意真实试卷中非标准题号、左右栏交叉、一题多图、图中标注和分离答案册的归属上限。固定样本通过后仍需 R35 真实教师材料。
- PP-StructureV3 lightweight 是否能在当前 CPU/GPU 上以更低资源达到数学门槛。只在 VL 的具体失败能被它解决时才值得补测。
- MinerU 4.x 在新架构稳定后是否能用 Content List V2 + `continues_prev` 降低适配量，以及项目是否接受其附加许可条款。

## 来源与证据边界

### 公开一手来源

- PaddleOCR：[`v3.7.0` release](https://github.com/PaddlePaddle/PaddleOCR/releases/tag/v3.7.0)、[`PaddleOCRVL` 固定源码](https://github.com/PaddlePaddle/PaddleOCR/blob/v3.7.0/paddleocr/_pipelines/paddleocr_vl.py)、[PaddleOCR-VL 官方用法](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PaddleOCR-VL.html)、[PP-StructureV3 官方说明与基准](https://www.paddleocr.ai/main/en/version3.x/algorithm/PP-StructureV3/PP-StructureV3.html)、[PaddleOCR-VL-1.6 权重与许可](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6)、[PP-DocLayoutV3 权重](https://huggingface.co/PaddlePaddle/PP-DocLayoutV3)
- MinerU：[`4.0.6` release](https://github.com/opendatalab/MinerU/releases/tag/mineru-4.0.6-released)、[许可](https://github.com/opendatalab/MinerU/blob/mineru-4.0.6-released/LICENSE.md)、[质量档与运行条件](https://opendatalab.github.io/MinerU/usage/tiers/)、[输出契约](https://opendatalab.github.io/MinerU/reference/output_files/)、[Content List V2 固定源码](https://github.com/opendatalab/MinerU/blob/mineru-4.0.6-released/mineru/render/_internal/content_list/v2.py)、[MinerU2.5-Pro-2605 权重与许可](https://huggingface.co/opendatalab/MinerU2.5-Pro-2605-1.2B)、[MinerU 4 ONNX 模型包](https://huggingface.co/opendatalab/MinerU-4_models_onnx)、[上游 revision 和 hash manifest](https://huggingface.co/opendatalab/MinerU-4_models_onnx/blob/main/manifest.json)
- PDF.js：[`v6.3.289` release](https://github.com/mozilla/pdf.js/releases/tag/v6.3.289)、[Apache-2.0 许可](https://github.com/mozilla/pdf.js/blob/v6.3.289/LICENSE)、[`TextItem` API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html#~TextItem)
