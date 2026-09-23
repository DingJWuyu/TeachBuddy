# MANUAL-QUESTIONS 内部双轴审查

- Fixed point：`4db937daa4d5abd0a03f69917528665f94ebb001`。
- 候选：`4a07e1073791f562011b6275ae8d2f133769cdc7`。
- 命令：`git diff 4db937daa4d5abd0a03f69917528665f94ebb001...4a07e1073791f562011b6275ae8d2f133769cdc7`。
- 提交：`489c9e6b`、`9f36c858`、`4a07e107`。受审实现均已提交；注入 AGENTS 与 `.tmp-mq/` 不属于产品候选。
- 按 code-review skill 并行执行 Standards、Spec 两个只读内部助手，继承调用会话 Codex / gpt-6-astra / low；未修改文件、继续委派或联系业务 session。级别为内部 review，不替代独立验收。

## Standards

无影响使用的实质性发现，0 项。

已审阅相关实现、测试与契约增量，并核对 `AGENTS.md`、`docs/rules/design-and-verification.md`、`docs/arch/materials.md`、材料契约、执行协议及 skill smell baseline。未发现需要本轮修复的硬性标准违规，也没有足以支持扩展重构的 smell。

本结论不替代 E2E、目标 Windows/WPS 验收或图片/扫描页视觉识别验证。

## Spec

只读检查实现、契约与浏览器证据，未发现本轮需追加修复的实质缺陷或越界行为。已知未完成项：

1. `docs/PRODUCT_SCOPE.md:39` 要求“自动提取、拆题和整理……保留公式、配图”。图片与扫描页仍不能自动识别；`apps/api/src/modules/questions/extraction.js` 明确返回 `provider-unavailable`。这是既有能力缺口，本轮没有用手工裁图冒充完成。
2. `docs/contracts/workbench/materials.md:35` 要求“DOC 永远附 legacy-object-loss 风险”。`OriginalPane.jsx` 显示转换丢失公式或嵌入对象的警告；旧 DOC E2E 覆盖保存、刷新、重启后的原稿回看及风险提示。旧 DOC 对象还原仍属明确保留的转换器限制。
3. `docs/contracts/workbench/materials.md:67` 明确“多栏、跨页续题及复杂数学排版仍需核对”。`native-pdf.js` 使用有限题号及答案页识别，不构成复杂材料完整自动整理验收。原稿与人工校对路径保留，此项不能从待办移除。

新增旧 DOC 风险提示符合契约；未引入 Agent、视觉 provider、OCR 权重或目标 Windows/WPS 验收声明。

Standards：0 项，无最高严重项。Spec：新增可修缺陷 0 项，保留 3 类已知边界，主要剩余缺口为图片与扫描页自动识别。
