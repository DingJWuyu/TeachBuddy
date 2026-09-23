# MANUAL-QUESTIONS@1 / attempt 2

结论：本轮限定收尾 **PASS / self**，题库全范围仍为 **PARTIAL**。Codex / gpt-6-astra / low；完成于 2026-09-23 06:11 UTC，session ID unavailable。

- 接续起点：`9f36c858b5f4637d3abbc18fe77509adc89f92ff`；分支 `feat/manual-questions`。
- 供集成的代码与 DOC 证据后继 SHA：`4a07e1073791f562011b6275ae8d2f133769cdc7`。本回执、审查产物和对照回归日志位于随后的文档提交，集成时一并携带。未合 main、push 或部署。
- Skills：code-review、diagnosing-bugs、writing-for-agents。双轴审查覆盖 `4db937daa4d5abd0a03f69917528665f94ebb001...4a07e1073791f562011b6275ae8d2f133769cdc7`，见[内部审查](code-review.md)：Standards 0 项、Spec 新增可修缺陷 0 项，保留 3 类已知能力边界。

## 本机实际结果

真实认证浏览器上传本树 `apps/web/e2e/fixtures/materials/samples/w.doc`，沿产品链生成 4 页 PDF，自动读出文字并形成 3 个按页草稿。校对文字和人工裁图可保存、确认收录、刷新；保留 SQLite/文件目录重启服务后，在新浏览器上下文从列表重开，内容、原稿与出处均恢复。原稿下载保留 `w.doc` 文件名，字节与上传文件完全相同。

转换状态保持 `limited / legacy-object-loss`；题库对照页现在展示该风险。转换预览可见的部分公式不在 PDF 文字层中，六题未完整自动拆分，答案未完整自动归属。测试中的裁图和文字修改只验证人工校对持久性，不证明公式、配图或整题已自动识别，也不证明人工校对后的整题内容完整。

- 仅只读挂载获准的 `/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8`。使用本树 `.tmp-mq/` 隔离数据、独立转换 profile、随机 HTTPS 端口及隔离 mailer；未操作工具来源树或用户 50880 库。
- [DOC E2E](logs/legacy-doc.log)：1 PASS，含保库重启；[风险提示修复前失败](logs/legacy-doc-warning-red.log)；[PDF 与 DOCX/图片原稿回归](logs/continuation-original-regression.log)：2 PASS；[Web 构建](logs/continuation-build-web.log)通过，保留已有 bundle 大小提示。
- [转换 PDF](browser/legacy-doc.pdf)、[自动读取与风险提示](browser/legacy-doc-review.png)、[保库重启后重开](browser/legacy-doc-reopened.png)。复跑使用 `MATERIALS_OFFICE_ROOT=<上述目录> TMPDIR="$PWD/.tmp-mq" npx playwright test -c apps/web/e2e/manual-questions.config.mjs -g '旧 DOC'`；未提供 Office 目录时此测试明确 SKIP。

## 准确待办

1. 图片、扫描 PDF 仍缺视觉 provider；需要获授权端点/凭据或本地识别资源再接线验证。本轮未扩 Agent、OCR 权重或费用许可。
2. 旧 DOC 对象丢失保持转换器限制；文字层公式缺失、按页草稿、复杂排版与答案归属仍需对照原件补全。未重开能力实验，不宣称六题无损还原。
3. 目标 Windows/Word/WPS 与课堂设备验收仍暂缓，本机 Linux 转换验证不替代它们。

`.tmp-mq/`、隔离测试现场保留且不纳入产品；注入 `AGENTS.md` 未提交。未联系业务 session。
