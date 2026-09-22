# PREVIEW-EXPORT-RECOVERY@1 attempt 1

R35-PANDOC-001 的修复自验通过。候选只为备课页面增加加载边界：服务端文稿及本地草稿协调完成后，才挂载输出面板并读取对应备课的选项、待确认请求和任务。加载失败沿用重试入口。没有清理浏览器现场，没有修改公共契约、转换器、认证或 Agent。

固定起点 `de831a07777da423c59e5239a432eee36fa8ac7b`，分支 `preview/usable-mvp`。缺陷输入为 `5f6ea979aea8b9237c4831f1719ff6ee597f9e47:docs/acceptance/evidence/R35/v1/pandoc-review.md` 的 R35-PANDOC-001；行为依据为 [U-M6](../../../../ux/materials.md#u-m6-六种成果与手工-ppt) 和 [M023](../../../../acceptance/materials.feature)。本轮不重复生成/过滤/24 输出/Office 的独立阶段验收，原 Word/WPS 真人门禁保持待验。

## 可复现验证

使用本分支生产构建，`createIntegration` 创建独占 SQLite、文件目录、HTTPS 和真实本地注册会话，邮件仅进入进程内 fake-mail。所有临时目录在 `/home/liam_t/per-tmp`，不使用已满的系统 `/tmp`，不访问用户库进行测试。回归脚本：[materials-integration-export-recovery.spec.js](../../../../../apps/web/e2e/materials-integration-export-recovery.spec.js)。

```bash
export TMPDIR=/home/liam_t/per-tmp
export MATERIALS_PANDOC_PATH=/home/liam_t/项目/TeacherWorkspace-office-comparison/experiments/office-comparison/tools/pandoc-3.11/bin/pandoc
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
export EXPORT_RECOVERY_EVIDENCE="$PWD/docs/acceptance/evidence/PREVIEW-EXPORT-RECOVERY/v1/green"
npm run build
node node_modules/@playwright/test/cli.js test \
  --config apps/web/e2e/fixtures/materials-integration/playwright.config.mjs \
  materials-integration-export-recovery.spec.js \
  --output=.scratch/preview-export-recovery/browser-final
```

| 场景 | 实际结果与证据 |
| --- | --- |
| 最小红灯 | 普通注册、建立并保存备课、打开输出、刷新。约 9 秒失败，整页空白，`Cannot read properties of null (reading 'sections')`。[断言](red/test.log)、[异常栈](red/result.json)、[刷新前](red/before.png)、[刷新后](red/after.png)。 |
| 同路径绿灯 | 修复后同一最小路径通过，无页面异常。[最终两项 E2E](green/test.log)、[恢复截图](green/after.png)。 |
| 加载边界 | 暂缓真实备课 GET 响应时显示读取状态，输出控件尚不挂载；放行后恢复原选项与 6 个下载。再次普通刷新通过。[加载截图](green/loading.png)。 |
| 选项及旧任务 | 成果、格式、答案、注记、作答行数、环节选择在刷新、切到资源库再从备课列表重开、读取失败后重试均保留。旧 PDF 下载 hash 在刷新、重开、公式拒绝后相同。[下载与受理记录](green/flow-result.json)、[读取失败](green/load-error.png)。 |
| 实际受影响导出 | 真实 UI 取题，三成果 × DOCX/PDF 均生成并下载；六份含本轮课题/题目，三个 DOCX 各含一个可编辑公式对象。[内容检查](green/content-check.json)，实际文件在 green/。 |
| 失败恢复 | 从恢复后的输出返回文稿，输入不支持公式，真实预检拒绝并提供返回错误位置；旧 6 件仍可下载。改为分式后生成成功并打开成品预览。[拒绝](green/export-error.png)、[实际预览](green/preview.png)。 |
| 未确认受理 | 仅丢弃真实 POST 受理响应，刷新后仍显示“重试确认生成请求”；重试携带原幂等键，总下载数由 7 到 8，没有重复受理。[确认后](green/confirmed.png)。 |
| 新建备课 | 已有输出现场保留时打开新建，输出面板不异常且没有旧下载；返回文稿、填写、保存、刷新后课题保持。[新课](green/new-lesson.png)。此场景的第一份课采用明确保存后取题的路径，另一路径限制见下节。 |
| 工程检查 | `npm run build` 通过；保留既有 Vite 大 chunk 提示，无新增 lint/test 失败。[构建记录](build.log)。没有 UI 单元测试。 |

最小用例修复后约 4 秒，最终两项 E2E 共 32.1 秒，页面异常数组均为空。诊断先验证“输出早于 input 就绪”，并核对其导致过早选择 `lesson-output-new`/pending 名称的风险；加载边界同时确保已保存备课首次挂载使用真实身份，不以空数组默认值掩盖尚未加载的数据。

## 范围外现场观察

**新建后直接取题自动保存的旧草稿残留，未修复。** 新建课题和环节后，不先点保存，直接“从题库取题”，采用题目；之后返回列表再次新建，可恢复出首次新建时的环节和“重试确认”状态。此现象在本轮 UI 操作中实际出现，[截图](new-draft-observation/after.png)、[失败断言](new-draft-observation/failure.log)。当时输出刷新、下载和原键确认都已通过，失败为新建页面没有普通“保存”按钮，而非 R35-PANDOC-001 的空白或 null 异常。

源码观察：`useLessonPickerFlow.enter` 在 `await savable.save()` 后立即导航，可能早于新建草稿持久化清理；这只是归因线索，未完成该独立缺陷的红绿诊断。按“只处理 R35-PANDOC-001 及实际传播”的边界保留，不改取题/保存语义。README 的体验路径明确先保存课题再取题，可避开此路径。后续归属为备课取题/新建草稿现场负责人 R34，需要单独授权的固定场景诊断。

测试采集限制：首次 Chrome 因 TMPDIR 路径过长不能创建 Unix socket，改为本任务独占的短 home 路径；一轮扩展采集收到 SIGTERM，另一轮因下拉框定位方式等待而主动中止。最终使用真实可访问角色定位，并限制单步等待 15 秒。上述采集失败不计通过，没有改动产品来迎合定位器。

## 候选审查与预览切换

候选审查和同一预览服务重启的最终结果将在本回执收尾时填写。受限在线备份已位于 `.scratch/preview/backups/export-recovery-20260922T204248Z/`，含 SQLite 在线快照、持久文件及运行配置副本；目录 0700、文件 0600。用户 `.scratch/preview/data`、`files`、TLS、SMTP 与启动配置均保留。
