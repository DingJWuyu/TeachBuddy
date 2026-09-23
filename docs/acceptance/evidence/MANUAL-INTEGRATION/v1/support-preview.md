# 七线手动业务预览增量

当前唯一入口 **https://localhost:50880** 已更新。`preview/usable-mvp` 在线重启时的完整 HEAD 为 `11c7cf12b98953b44f272cebd6dfc381c523934d`，其中包含原六线产品、备课预览裁切修复，以及 SUPPORT 偏好、帮助、设备现场与恢复前原文件找回修复。原预览 HEAD `e51cbcd927894abe049beebfab6f7bd37bc19f96` 是本次回退代码点；未引入 Agent 新功能。

固定恢复输入为 `b4f36312fef653a5c19c92686ca4ff74693f4755`、`a95463df86d9a467e4659cc2a38c07740d3be4b3`，在集成分支对应 `8493026d`、`6308f1b7`。集成线再合入预览分支 `e51cbcd9` 的裁切修复和独立报告，两边历史由 `11c7cf12` 合并提交保留，预览树随后快进到此组合，没有重复应用预览源码补丁。SUPPORT 原 [作者回执](../../MANUAL-SUPPORT/v1/receipt.md)仍为 PARTIAL/self；[恢复修复回执](../../MANUAL-SUPPORT/v1/recovery-fix.md)为 self 与内部双轴 PASS。新的独立 SUPPORT 范围及恢复切片结论尚未返回，本回执不代签。

## 实际检查与运行

- 集成组合 `npm run build` 通过，隔离构建库应用 14 条迁移。恢复上传定向浏览器 1/1 通过：恢复后题库、资源、数学新旧格式共 8 份原文件下载字节一致，旧上传请求未重放。偏好重开及资源、题库、数学上传回归 4/4 通过。没有重跑未变的全套作者测试。
- 预览停服后复制原运行数据、配置与 Web 构建，再快进合入并运行 `npm run build`，结果通过。`teacherworkspace-preview.service` 恢复为 `active`，`GET /api/health` 为 `ok`；真实浏览器显示登录页和“创建账户”，无控制台消息，匿名偏好接口返回 401。本轮没有在用户库执行注册、发码、恢复或种子操作。
- 在线 SQLite `integrity_check=ok`。停服副本与更新后的账户数均为 2，迁移记录从 21 增至 22；新增 `reliability_preferences` 表字段为 `accountKey`、`version`、`valuesJson`、`updatedAt`。原数据库、文件和配置沿用。原 M43/R33 受跟踪脏证据以及 `.tmp-bm/`、`apps/api/docs/`、`BUSINESS-MVP/`、`M42/` 现场未清理、未混入产品提交。

受限回退目录：`/home/liam_t/项目/TeacherWorkspace-preview/.scratch/manual-integration-preview/20260923T0714-support/`，权限 700，含 `base-head.txt`、`preview-runtime-before/`、`env-before`、`web-dist-before/` 和 `build.log`。若回退，先停服并单独保留更新后的写入；本轮未执行回退演练。

## 待定范围

SUPPORT 独立验收及恢复修复独立定向复验仍待结论；当前七线入口是已构建和定向检查的可用候选，不宣称完整 MVP 独立通过。DATA 六线组合和 MF-UI-01 各自已有独立 PASS，保留其原验证边界。图片/扫描页自动视觉识别与旧 DOC 对象风险仍存在。

注册发码失败已有 MANUAL-MAIL 文档诊断 `f13e2aa88b6c0af6aa159f7ea03768d8f3e64450`，本轮未修改本机网络模式、SMTP 配置或固定诊断 IP，也未发送邮件。产品未合并 main、未 push、未公网部署；Agent 线路继续暂停。
