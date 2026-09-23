# MANUAL-QUESTIONS@1 / attempt 1

结论：`READY_FOR_INTEGRATION / PARTIAL / self`。所属手动页面主链已实现并实测；图片、扫描页自动识别未完成，因此不声明全范围完成。实现者：Codex / gpt-6-astra / low。完成本轮交付时间：2026-09-23 05:58 UTC。

- 工作树：`/home/liam_t/项目/TeacherWorkspace-manual-questions`，分支 `feat/manual-questions`。
- 固定起点：`4db937daa4d5abd0a03f69917528665f94ebb001`。
- 可集成实现提交：`489c9e6b301eebd8860fee631d075a05f36b80d2`。
- 本回执为随后的文档提交，集成时同时携带。未合入 main，未 push、部署、发送外部邮件或调用付费模型。未开发产品 Agent/runtime/tools/skills/plugin/connector。

## 实际可用结果

| 用户操作 | 实际结果 |
| --- | --- |
| 文字、PDF、Word、图片四入口 | 原稿持久保存；文字和 DOCX 原生拆题；文字层 PDF 通过现有 Poppler 自动读取。图片可预览、框选裁图、补充校对并保存，识别缺口明确显示。 |
| PDF 自动整理 | 本树 P.pdf 自动产生 6 题，匹配第 4 页答案，保留 3 幅真实裁图；5 题有答案、1 题原稿无答案。分式、根式、选项可编辑；保库重启后结果一致，下载原稿字节完全相同。 |
| 对照与编辑 | 原稿定位回到当前题目，不误回首题；出处可回看，下载保留原文件名。DOCX 无分页转换器时展示真实原文段落、公式和配图。题干、答案、图、选项、小问沿现有编辑器保存。 |
| 分类与个人整理 | 自定义题型、标签的创建、修改、删除，标记、笔记和检索；检索覆盖答案。删除分类后同步题目版本并保留未保存笔记。旧搜索响应不能覆盖最新结果。 |
| 自建、改编、删除恢复 | 连续自建清理已保存草稿；复制保留来源快照，原题与改编题左右对照和跳转。删除恢复及刷新不会用旧本地草稿伪装活动状态，未保存编辑保留。列表、原稿、改编对照可调宽并恢复。 |
| 备课、班级取用 | 单题、批量两题加入备课；有修改时明确“保存并加入备课”，实际采用当前内容。教学记录关联题目、往返原记录、题目反查班级反馈均通过。 |
| 数学文件 | 编辑后的公式生成并下载真实 1600px 透明 PNG；检查 PNG 格式、透明通道及保存重开。原题快照、独立答案与长期笔记边界沿用现有端口。 |

## 验证

- [完整构建](logs/build.log)通过；最终布局修改后 [Web 生产构建](logs/build-web.log)通过。保留现有大 bundle 提示，未因该提示扩展打包重构。
- [API 定向回归](logs/questions-api.log)：31 PASS，3 SKIP，0 FAIL。跳过的是显式未提供的旧私有样本与历史 fixture；未把跳过计为通过。最终 PDF 读取/裁图追加 [2 PASS](logs/pdf-final.log)。
- 浏览器覆盖 10 个真实认证场景：[前 9 场景完整通过](logs/questions-e2e.log)；后续分类改名、检索和列表展示 [3 PASS](logs/questions-final-ui.log)，自建 [2 PASS](logs/questions-create.log)，对照布局、Word、PDF [3 PASS](logs/questions-layout.log)，小屏稳定布局 [1 PASS](logs/questions-tablet.log)。只重跑受影响场景。
- 使用真实 API、独立 HTTPS、隔离 SQLite/文件目录；验证码由隔离 mailer 接收，无外部投递。测试入口为 `apps/web/e2e/manual-questions.config.mjs`，`TMPDIR` 使用本树 `.tmp-mq`。
- [PDF 对照](browser/pdf-review.png)、[Word 原文](browser/word-original.png)、[图片裁图](browser/image-correction.png)、[题目取用](browser/question-usage.png)、[改编对照](browser/copy-comparison.png)、[768px 布局](browser/comparison-tablet.png)、[透明公式 PNG](browser/formula.png)。

## 尚欠与集成接线

1. **图片、扫描 PDF 自动提取尚欠**：当前生产装配没有视觉提取 provider，本机没有可用 OCR 执行器；本任务未获授权下载新模型/权重或读取模型凭据。需要获授权的视觉识别端点与凭据，或已获准的本地 OCR/公式识别运行资源，再接入现有 `createQuestionsModule({provider})` seam 并实测。手工校对与裁图不计作此项完成。
2. **自动提取仍有限制**：多栏归属、无题号精细拆题、跨页续题、复杂公式排版不能保证完整自动还原；结果保留校对疑点和原稿。DOCX 段落视图不等同于 Word 原分页。
3. **旧版 DOC 的本机转换未验证**：需集成者沿资源底座配置 `MATERIALS_OFFICE_ROOT`。转换后的 PDF 已接入原生文字/配图路径，但本树没有 Office 二进制；未借用其他工作树运行配置。目标 Word/WPS、课堂设备验证按任务要求暂缓。备课 DOCX/PDF 输出归 LESSONS，本轮未冒充重新验收该链路。
4. 公共改动仅 `DocumentEditor` 的 `allowTeacherNotes` 可选参数（默认 true，题库传 false，避免编辑出服务端禁止的教师注记）、Import 响应的只读可选 `originalDocuments` 字段及 README。无新 npm 依赖、数据库迁移或 Agent 公共接线；沿用 questions v2、lessons v3 和 classes 的现有取用端口。
5. 注入的 AGENTS.md 保留、未提交。全范围尚未完成，按要求保留 `.tmp-mq/`、`test-results/manual-questions/` 的隔离现场与失败轨迹，不纳入产品提交。旧回归首跑曾隐式读取其他树的固定 PDF 样本和历史 fixture 代码，未改写来源、未读取用户数据库或密钥；现已改为 `M33_PRIVATE_PDF` / `M33_R31_SOURCE` 显式启用，最终回归仅使用本树样本，并将生成证据移入隔离临时目录。
