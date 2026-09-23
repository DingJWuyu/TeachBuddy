# MANUAL-FLOW-ACCEPTANCE@1 / attempt 2

**PASS，verification_level=independent。MF-UI-01 解除条件通过。** 1440×900、1280×900 的更新对照中新旧文件均完整可读，翻页、缩放、关闭及采用后保存刷新正确。本结论仅关闭 MF-UI-01，不代表重新执行全部手动业务或完整 MVP 验收。

## 固定输入与运行

- 受测候选：`bea0deb1481dd0fa9ca23b30e86d6b78e4b351aa`；产品：`b9dd00fab7b12016674bd52ae792d4e82805576c`。二者之间仅有作者验收文档和证据差异。
- 工作树：`/home/liam_t/项目/TeacherWorkspace-manual-lessons`；分支：`review/manual-flow-fix`。执行者：Codex / gpt-6-astra / medium，未委派内部助手或做源码 review。
- 判据：[原验收 MF-UI-01](acceptance.md#mf-ui-01更新对照中的资源预览被外层弹窗裁切)；入口：[作者复跑说明](../../MANUAL-LESSONS/v1/preview-fix.md)。使用固定候选现成 `apps/web/e2e/manual-lessons-preview.spec.js`，未改脚本和产品。
- Node.js 22.23.2、系统 Chrome 152.0.7977.64；真实 `createIntegration` HTTPS 服务、生产 Web 构建、SQLite 和文件存储。随机端口 `42145`；数据库及文件由入口在本树独占 `.tmp-mf2/a11-*` 下创建。
- UI 注册、上传仓库样本 `apps/web/e2e/fixtures/materials/samples/c22.pptx`、创建备课“新旧课件完整阅读”及环节“对照讲解”、加入资源，再通过 UI 更新为同目录 `c22.pdf`。业务未用接口预置或直写数据库。真实 Cookie 身份；邮件验证码使用本地收件器，时间沿用入口测试时钟。
- LibreOffice 只读复用下列工具路径。未接触 50880、用户数据或原失败现场；未调用产品模型或外部邮件。

复跑命令在上述固定候选的仓库根目录执行，输出目录须保持独占：

```bash
mkdir -p .tmp-mf2 docs/acceptance/evidence/MANUAL-FLOW/v1/recheck-evidence
TMPDIR="$PWD/.tmp-mf2" npm run build \
  > docs/acceptance/evidence/MANUAL-FLOW/v1/recheck-evidence/build.log 2>&1
TMPDIR="$PWD/.tmp-mf2" \
MATERIALS_OFFICE_ROOT='/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8' \
MANUAL_LESSONS_PREVIEW_EVIDENCE="$PWD/docs/acceptance/evidence/MANUAL-FLOW/v1/recheck-evidence" \
npx playwright test -c apps/web/e2e/manual-lessons.config.mjs -g MF-UI-01 \
  --output=.tmp-mf2/results --trace=on \
  > docs/acceptance/evidence/MANUAL-FLOW/v1/recheck-evidence/e2e.log 2>&1
```

## 实际结果

| 场景与预期 | 实际结果及证据 |
| --- | --- |
| 1440 新旧文件均能完整阅读三页 | PASS。两版本的三页逐张查看，标题、正文、公式、图像及页面下沿完整；各页九点命中均 9/9。[当前末页](recheck-evidence/1440-current-page3.png)、[已采用第二页](recheck-evidence/1440-adopted-page2.png) |
| 1280 新旧文件均能完整阅读三页 | PASS。同样逐张查看六张页图，无外层裁切。[当前首页](recheck-evidence/1280-current-page1.png)、[已采用第二页](recheck-evidence/1280-adopted-page2.png) |
| 翻页、缩放及关闭 | PASS。四种宽度/版本组合均从首页翻至第三页再返回，首尾按钮禁用正确；75% 缩小、150% 放大、100% 恢复成功。150% 通过现成脚本设置预览容器滚动位置后检测右下角可见，不将它声称为滚轮或拖动滚动条的手势测试。[75% 页面](recheck-evidence/1280-current-zoom75.png)；关闭内层预览后仍可采用，取消对照后可重新打开 |
| 新旧文件身份及采用保存重开 | PASS。预览接口分别指向不同文件，跨宽度身份一致。采用 PDF、保存并刷新后，环节名称保留，更新提示消失；重开的采用文件预览路径与此前来源当前文件一致。[刷新后预览](recheck-evidence/1280-reopened-adopted.png) |
| 稳定呈现与运行结果 | PASS。正常等待有限动画结束及图片完成加载，未禁用动画。25 个布局采样全部 9/9，无页面 JS 异常，取消对照后两种宽度均无根页面横向溢出。[布局数据](recheck-evidence/checks.json)、[E2E 日志：1 passed](recheck-evidence/e2e.log) |
| 当前候选生产构建 | PASS。[构建日志](recheck-evidence/build.log)，仅既有大 chunk 提示 |

证据目录保留两种宽度×两版本×三页的全部 12 张原始页面截图，以及缩放和重开截图。没有用作者截图替代本轮目视判断。[脱敏网络摘要](recheck-evidence/network-summary.json)只记录请求时间、方法、路径和状态，不含 Cookie 或正文。新建期间有一次 `GET /api/modules/lessons/v3/new` 422，与原验收记录相同；实际新建及后续场景成功，不声称网络零错误。入口关闭了服务日志输出，本轮无独立服务日志。

## 旧结论沿用范围

- [attempt 1](acceptance.md) 的 MF-01..04、MF-06..09 及 MF-05 非裁切部分沿用原证据和原限制；本轮仅将 MF-UI-01 更新为独立 PASS。未重跑混合取材、输出主线、重启重登或八格式/十二种输出矩阵。
- 原报告沿用的资源、备课、数学及集成作者证据仍保持原验证等级，不升级为本轮独立验收。数学已关闭问题按本次任务包排除，没有重复检查或重新打开。
- Word/WPS 真人编辑、打印、目标设备、iPad、公网及正式预览部署仍暂缓。Agent 停工；全部手动能力及完整 MVP 交付不在声明范围。
- 原 `acceptance.md`、失败现场和历史证据保持原样。独占测试服务及浏览器已关闭，成功后的本轮隔离数据、含会话 trace 和重复临时截图已清理；必要截图、布局及脱敏日志保存在本目录。注入的 AGENTS 改动不纳入提交。

## 回执

```yaml
task: MANUAL-FLOW-ACCEPTANCE@1
attempt: 2
role: acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-23 06:38:51 UTC"
session_id: unavailable
runner: "Codex / gpt-6-astra / medium"
skills_used: [writing-for-agents]
base_revision: bea0deb1481dd0fa9ca23b30e86d6b78e4b351aa
product_revision: b9dd00fab7b12016674bd52ae792d4e82805576c
result_revision: "包含本 recheck.md 与 recheck-evidence/ 的证据提交，完整 SHA 见最终回执"
review_target: not-applicable
internal_reviewers: []
inputs: [MANUAL-FLOW/v1/acceptance.md, MANUAL-LESSONS/v1/preview-fix.md]
changed_files: [docs/acceptance/evidence/MANUAL-FLOW/v1/recheck.md, docs/acceptance/evidence/MANUAL-FLOW/v1/recheck-evidence/]
artifacts: [recheck-evidence/checks.json, recheck-evidence/network-summary.json, recheck-evidence/e2e.log, recheck-evidence/build.log, "recheck-evidence/ 必要原始截图"]
checks: ["MF-UI-01 定向真实页面 PASS", "1440/1280 新旧各三页目视 PASS", "翻页缩放关闭 PASS", "采用保存刷新 PASS", "生产构建 PASS", "git diff --check PASS"]
identity_mode: "real-auth；仅邮件使用本地测试收件器"
open_items: ["目标 Office/设备/公网暂缓，沿用原范围限制"]
failure_owner: null
next_condition: "MF-UI-01 已满足解除条件；外层接收回执，不授权部署或完整 MVP 放行"
authorization_used: "MANUAL-FLOW-ACCEPTANCE@1 / attempt 2 用户任务包"
```
