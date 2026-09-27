# 资源识别机制验收输入

I-1、I-2 保留 OCR 主线固定页 PNG 及 PaddleOCR-VL 实际返回的 JSON、Markdown 和附件字节。来自题库隔离现场 `questions-ocr/pages` 与 `output/mainline/03-I1-cold-repeat`、`07-I2-stable`，未对内容做纠错或改写。

`resources-ui.spec.js` 用真实上传、页预览、HTTP Job、SQLite、Files 和浏览器消费这些返回值。识别器可控回放用于确定性验证等待、失败、取消、原键恢复与搜索；不启动模型，不证明实际模型识别质量或生产运行环境可用。实际模型验收另走共享识别运行链路。
