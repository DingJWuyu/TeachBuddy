# Office 最小兼容性对照

状态：个人 Windows 实机用户验收中，A、B 在 Word/WPS 均能打开且公式正常；A 在两款软件中均完成中文、分母和指数修改、另存关闭重开、公式继续编辑及打印预览，用户反馈全部正常，两边均一页。B 未做编辑与打印验证。推荐 Pandoc 作为完整样例验证的首选；未替换产品输出，C22 整体仍未通过。具体软件版本未提供，未收集编辑后的文件或截图，结论依据本次用户实际操作反馈。

## 固定输入与已知失败

用户已在个人 Windows 实机确认原始 `C22/docx/handout-student.docx`：WPS 刚打开即缺公式，中文可编辑；Word 提示“Word 在试图打开文件时遇到错误。请尝试以下方法...”，无法打开。用户反馈仅 LibreOffice 正常。具体软件版本待补。

失败制品来自 `7f965c6408a73d30524ff8e11c40484a352232c1:experiments/C22/control-1/outputs/docx/handout-student.docx`。该版本 `inherited/inherited/scripts/generate.js` 使用 docx，但通过自写 `latex.js` 将有界 LaTeX 解析为 OMML，再用 ImportedXmlComponent 导入。此为来源事实，尚未证明具体故障根因。

## 对照边界

- A：Pandoc 3.11 默认 DOCX writer，sample.md 直接转换；无自写公式转换或输出后修补。包含分段函数。
- B：docx 9.7.1 的 MathFraction、MathRadical、MathSuperScript、MathSubScript 等原生对象。没有可直接使用的分段函数对象，因此不覆盖该项，不用自行拼 XML 补齐。
- 两份为共同基础内容的路线探针，布局与内容覆盖不完全相同，不能单凭它们确认旧故障原因。插图沿用固定制品 q5-triangle.png。
- 结构检查：A 4 个、B 3 个 OMML 公式对象，分式、根式和图片存在；A 的分段矩阵存在；全部 XML 可解析，ZIP 完整。Pandoc 读回见 roundtrip-A.md、roundtrip-B.md。检查不等于 OOXML 完整规范校验或目标 Office 通过。
- 未运行本机 Office 或修改产品候选。只读固定旧制品；M43、R35 的 checkout、服务及数据均未改动。原始来源、源码、输出和工具保留至实机结论完成。

## 复现与结果

在本目录 `npm ci`，运行 `node generate-native.cjs`。使用官方 Pandoc 3.11 Linux amd64 发行包，在本目录执行：

```sh
tools/pandoc-3.11/bin/pandoc sample.md --standalone --fail-if-warnings -o deliverables/A-pandoc.docx
tools/pandoc-3.11/bin/pandoc deliverables/A-pandoc.docx --fail-if-warnings -t markdown -o roundtrip-A.md
tools/pandoc-3.11/bin/pandoc deliverables/B-docx-native.docx --fail-if-warnings -t markdown -o roundtrip-B.md
```

Windows 操作见 deliverables/先读我.txt；文件哈希见 checks.json。两软件各用未修改原文件，编辑后另存，保留失败原件。先确认打开与显示，再测编辑，最终记录软件版本和分页。下一步可基于 A 的实机结果提议扩大到固定完整样本；此次不授权替换正式产品输出或合并 main。

## 官方资料

- https://pandoc.org/MANUAL.html：DOCX 数学写为 OMML，支持 reference-doc 样式模板。本探针先用默认 writer，未添加定制模板。
- https://github.com/jgm/pandoc/releases/tag/3.11：本次固定二进制来源。
- https://docx.js.org/api/classes/Math.html：原生公式对象。

完整固定六稿及当前验收接点见 [full/README.md](full/README.md)。
