# 共用固定输入

API 和浏览器测试共用的原稿与录制输入放在这里；运行结果仍写入 `test-results/`。移动输入时同时核对所有文件读取、浏览器上传、采样摘要及 provenance；不能把真实输出断言替换成输入文件存在性检查。

| 目录 | 用途与来源 |
| --- | --- |
| `materials/` | 原有公共文稿消费者的 PDF、PPT、PPTX、DOC 固定文件，从 `apps/web/e2e/fixtures/materials/samples/` 原样迁入 |
| `questions/` 根文件 | 自编题库文字、Word、PDF 与完整/破损图稿，从 `apps/web/e2e/fixtures/materials-questions/` 原样迁入 |
| `questions/recognition/` | 已录制的原页、模型原始返回及派生图片；`manifest.json` 固定页与摘要，`replay.mjs` 只回放匹配的输入，不证明当前模型准确率 |
| `questions/recognition-document-4/` | 固定旧识别修订的消费者输入；来源、摘要和外部原件获取边界在 `provenance.json`，不依赖本机旧现场 |
| `questions/legacy/` | 固定旧题干结构及旧页内容/图片，供兼容、独立定位消费者使用；历史轮次名字不是运行入口 |
| `math/` | 固定自包含数学 HTML 输入，供隔离与离线原件保存回归使用 |

迁移基线为 `2932ace54e9bb52276076dbede08de518c7d57cd`，所有搬迁的输入保持原始字节。旧版产品源码归档仍在 `apps/api/test/fixtures/legacy-source/`，归档内保留当时路径，当前目录调整不改写它们。
