# C20 一手来源索引

核查日期：2026-09-21。用途：为 C21-C24 的至多两条候选提供事实依据；具体样本、边界和通过条件以 [capability-checks](../capability-checks.md) 为准。本文只核查公开资料和本机公开安装包，没有安装依赖、运行能力实验或读取密钥、`.env`、auth/settings 配置。

既有背景继续使用 [Command Code API](../../research/command-code-api.md)、[部署研究](../../research/deployment-options.md) 和 [EMODEL](../evidence/EMODEL.md)。本次授权的现有 GOAT 额度可用于有界实验；没有正式服务器不阻止本机实验。来源事实不替代 Windows/WPS、Edge/Chrome 或大陆三端实测。

## C21 提取

| 一手来源 | 已核实事实 | 实验含义与尚未验证 |
| --- | --- | --- |
| [Tesseract 官方语言数据](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html) | 官方提供 `chi_sim` 简体中文、`chi_tra` 繁体中文数据；`equ` 被称为公式检测模块。 | 支持本地中文 OCR 候选，不能把公式检测理解为完整数学公式转写。本机是否具备引擎与对应语言数据以环境盘点为准。 |
| [Tesseract 官方质量指南](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html) | 分辨率、倾斜、噪声和页面分割影响结果；无额外布局分析时，表格文字/数据识别存在已知问题。 | 用清晰页与普通拍照页检验可用性，记录公式、跨栏、表格失败。该资料不支持“中文 OCR 天然保留试题结构”。 |
| [Command Code 模型目录](https://commandcode.ai/docs/reference/cli/models)、[DeepSeek 精确模型页](https://commandcode.ai/models/deepseek-v4-1-flash)、[GLM 精确模型页](https://commandcode.ai/models/glm-5-3-flash) | 目录包含两个允许 ID。DeepSeek 精确页明确描述 vision；GLM 页本次可读取正文没有明确 image/vision 输入说明。 | 原生提取/OCR 后结构化可用两个允许模型作实验；直接图像提取候选优先由 DeepSeek 做最小图像探针。DeepSeek 的文案仍未证明当前 Provider 接收图像、图片到题目的正确性；GLM 图像输入保持未知，不依据 `+1` 图标或模型名推断。 |

候选边界：A 为原生内容提取与本地中文 OCR，由 DeepSeek 整理结构；B 为 DeepSeek 直接图像提取，GLM 仅作允许的文本替代。B 的 image 输入探针失败时，保留 A 的可做部分。原文件页码、题号、表格、公式和图示关联需要用样本核对，不能由文字流“看起来合理”推定成功。

## C22 Office

| 一手来源 | 已核实事实 | 实验含义与尚未验证 |
| --- | --- | --- |
| [LibreOffice 命令行参数](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html) | 支持 `--headless`、`--convert-to`、`--outdir` 和独立用户配置目录参数。 | 可作为本机批量转换入口；退出码或产出 PDF 不证明 DOCX 的可编辑性。 |
| [LibreOffice 与 Microsoft Office 格式](https://help.libreoffice.org/latest/en-US/text/shared/guide/ms_user.html)、[格式转换限制](https://help.libreoffice.org/latest/en-US/text/shared/guide/ms_import_export_limitations.html) | Writer 可打开 DOC/DOCX，Impress 可打开 PPT/PPTX，支持 Office 格式保存；官方列出转换中可能变化的复杂版式、表格和对象等。 | 适用于输入预览及 Office/PDF 转换候选；中文字体、分页、公式和图片布局需样本实测。文档不证明 WPS 往返编辑兼容。 |
| [Pandoc 手册：数学](https://pandoc.org/MANUAL.html#math)、[Pandoc 格式转换说明](https://pandoc.org/MANUAL.html#description) | DOCX 和 PowerPoint 数学输出使用 OMML；Pandoc 主要保留结构，更复杂输入转成其文档模型时可丢失格式，复杂表格也有限制。 | 可作为生成可编辑 DOCX 的候选，而不是任意 Office 文件无损往返工具。OMML 结构存在仍需实际编辑、保存并重开来证明目标编辑器可用。 |
| [docx.js Math](https://docx.js.org/api/classes/Math.html)、[MathFraction](https://docx.js.org/api/classes/MathFraction.html)、[MathRun](https://docx.js.org/api/classes/MathRun.html)、[Packer](https://docx.js.org/api/classes/Packer.html) | 提供 OMML 数学容器、分数与公式文本节点，以及 DOCX 打包输出接口。 | 支持直接用 JavaScript 构造文档和可编辑数学结构的候选；不是通用 LaTeX 解析器，也未证明本机已装或目标 WPS 编辑通过。 |

这里支持两条组合候选：A 为 Pandoc 生成 DOCX/OMML；B 为 docx.js 数学节点生成 DOCX。二者共享 LibreOffice 的输入预览/PDF 转换。不要求把公式全部降成图片，也不以逐像素等同原稿作为通过条件。目标用户在 WPS 修改正文、表格与公式后的重开结果，以及实际 PPT/PPTX 预览，均未实证。

## C23 数学离线演示

| 一手来源 | 已核实事实 | 实验含义与尚未验证 |
| --- | --- | --- |
| [MathJax SVG 输出](https://docs.mathjax.org/en/latest/output/svg.html) | SVG 输出以路径表达数学字形，相对独立，可保存为图像；部分情形仍使用 CSS。 | 预渲染 SVG 可以减少导出 HTML 对运行时公式库的依赖。SVG 是显示结果，不是 Office 可编辑公式的证明。 |
| [MathJax 自托管和离线](https://docs.mathjax.org/en/latest/web/hosting.html)、[MathJax 4 字体与动态数据](https://docs.mathjax.org/en/latest/output/fonts.html) | 可本地使用；`file://` 的浏览器限制可能影响加载。v4 默认字体资源路径可指向 CDN，字体数据按需加载，转换可能异步。 | “加载了 `tex-svg.js`”不足以证明单文件离线。预渲染 SVG 或完整本地/内联运行时都要在禁网、冷缓存后实际打开并操作。不能把需要额外起本地服务器的结果冒充用户双击 HTML 即可使用。 |
| [JSXGraph 官方仓库与用法](https://github.com/jsxgraph/jsxgraph) | 纯 JavaScript 交互几何/函数库，支持 SVG/canvas、多点触控；官方允许本地引入 `jsxgraphcore.js`、CSS 和所需 reader；MIT 或 LGPL 双许可证。 | 可把所需资源随离线文件打包或内联；是否单文件可用、平板拖动体验与目标浏览器表现需实测。 |
| [W3C SVG 2 简介](https://www.w3.org/TR/SVG2/intro.html) | SVG 可与 HTML 集成，并通过 DOM/脚本实现动态交互。 | 原生 SVG + 内联脚本可作为简单演示候选；数学关系与拖动边界正确性由样本验证。 |

候选边界：A MathJax SVG + 原生 SVG/内联脚本；B MathJax + 本地/内联 JSXGraph。公式可预渲染为 SVG，具体依赖打包方法交实验者。大陆网络可达性不等于离线可用，Linux Chromium 通过也不等于 Windows Edge/Chrome 和目标平板通过。

## C24 pi 与模型

### 本机版本和公开接口

本次 `command -v pi`、符号链接和公开 `package.json` 显示：

```text
pi executable: /home/liam_t/.local/share/pi-node/node-v22.23.2-linux-x64/bin/pi
resolved package: @earendil-works/pi-coding-agent
installed version: 0.85.1
engines.node: >=22.19.0
license: MIT
package directory: /home/liam_t/.local/share/pi-node/node-v22.23.2-linux-x64/lib/node_modules/@earendil-works/pi-coding-agent
```

本机该全局安装位置没有 `@mariozechner/pi-coding-agent` 目录。下列链接固定到与本机一致的 `v0.85.1`；官网 `main` 本次已显示 `0.87.0`，不能混用示例后宣称本机能力已验证。

| 一手来源 | 已核实事实 | 实验含义与尚未验证 |
| --- | --- | --- |
| [pi v0.85.1 package](https://raw.githubusercontent.com/earendil-works/pi/v0.85.1/packages/coding-agent/package.json)、[MIT 许可证](https://raw.githubusercontent.com/earendil-works/pi/v0.85.1/LICENSE) | 包名、Node 下限及许可证与本机公开包一致；SDK 包含在该包内。 | 本机具备可研究的安装包，不代表项目依赖已接入或真实业务工具已可调用。 |
| [pi v0.85.1 SDK](https://raw.githubusercontent.com/earendil-works/pi/v0.85.1/packages/coding-agent/docs/sdk.md) | 提供 `createAgentSession`、事件订阅、`abort`、`defineTool`/`customTools`；`tools` 可指定启用工具名。`SessionManager.create/open` 支持持久会话，切换会话属于 `AgentSessionRuntime`。 | 可先试自定义无副作用工具循环、取消与会话重开。显式只启用实验工具，避免默认读写/shell 工具替代业务调用；持久会话不自动保证业务写入幂等。 |
| [pi v0.85.1 custom provider](https://raw.githubusercontent.com/earendil-works/pi/v0.85.1/packages/coding-agent/docs/custom-provider.md) | `registerProvider` 支持自定义 provider；`openai-completions` 对接 Chat Completions，可配置 model ID 和 provider 兼容参数。 | 已有 Command Code 路线可先实验；只有观察到具体兼容失败才调整适配。`input: ["image"]` 是客户端声明，不能证明上游支持图片。 |
| [pi v0.85.1 会话格式](https://raw.githubusercontent.com/earendil-works/pi/v0.85.1/packages/coding-agent/docs/session-format.md) | JSONL 会话记录消息和会话状态，提供 SessionManager API。 | 用独立实验目录保存自己的会话，重开后核对上下文；不读取用户既有会话与全局凭据配置。 |

### Provider、模型与费用边界

| 一手来源 | 已核实事实 | 实验含义与尚未验证 |
| --- | --- | --- |
| [Command Code Provider API](https://commandcode.ai/docs/provider) | 官方入口 `https://api.commandcode.ai/provider/v1`；Chat Completions 使用 Bearer 认证；公开说明可从 models 目录读取 `supported_endpoints`。 | 对两个精确 model ID 沿用 `/chat/completions`；本次公开 models URL 经浏览工具未能读取，未获得 live modality/endpoint 字段。不能把 Responses 的工具说明搬作两个模型的实际 Chat Completions tool calling 证明。 |
| [GOAT API 与超限规则](https://commandcode.ai/docs/plans/goat)、[Usage Limits](https://commandcode.ai/docs/resources/usage-limits) | GOAT 有 API 权利，调用计入 GOAT credits；到达套餐限制后，有额外 credits 可继续消耗，没有则付费模型暂停。 | 使用本次已授权的现有额度，不购买、不充值、不切换其他付费方案。记录请求/轮次与 usage；余额、自动充值和实际扣费配置仍未证实，不能标注“确认零新增费用”。额度错误时停止付费调用，继续本地可做工作。 |

只允许 `deepseek/deepseek-v4.1-flash` 与 `z-ai/glm-5.3-flash`。本页不重新冻结模型名单，权威说明仍是 [Command Code API](../../research/command-code-api.md)。[EMODEL](../evidence/EMODEL.md) 的两个 HTTP 200 响应均因 8-token 预算耗尽而无可识别正文，不能据此宣告正常文本输出、工具调用、流式或计费通过。

两条允许模型可在同一 pi/Provider 适配路径中比较，无需再引入一个 Agent 框架。正常输出、真正由模型发起的 tool call、工具结果回传后回答和错误处理均需实证；真实业务调用仍等 B16 的可调用服务，不把测试工具成功升级为产品能力完成。
