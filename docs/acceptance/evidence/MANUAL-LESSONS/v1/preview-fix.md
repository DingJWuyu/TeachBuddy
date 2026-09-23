# MANUAL-LESSONS@1 / attempt 2

MF-UI-01 修复自验 PASS。候选 `b9dd00fab7b12016674bd52ae792d4e82805576c`，固定基线及 review fixed point `6b0193521090a4880907961ddfc923d502304fe1`。仅修复备课资源更新对照的预览呈现，原备课成果保留。

判据：[MF-UI-01 与解除条件](../../MANUAL-FLOW/v1/acceptance.md#mf-ui-01更新对照中的资源预览被外层弹窗裁切)、[资源必须实际预览内容](../../../../PRODUCT_SCOPE.md#4-资源库)、[取材与返回](../../../../WORKBENCH_DESIGN.md#取材与返回)、[区域滚动及自然动画验证](../../../../rules/design-and-verification.md)。

根因是文件预览嵌在带 transform 动画及 overflow 的对照面板内，固定定位受到祖先限制。将 `FilePreview` 移到对照面板外侧，保持对照状态与关闭返回。必要共用呈现修正：`materials.css` 提高 `.r34-preview` 选择器优先级，使已有 900px 宽度不再被通用弹窗的 520px 覆盖；备课普通文件预览也恢复该宽度，没有修改全局弹窗、文件转换或采用契约。

## 红绿与实际结果

真实 `createIntegration` HTTPS 服务、SQLite 和文件存储；随机端口，本树专用 `TMPDIR`。Playwright 驱动系统 Chrome，通过 UI 注册、上传现成三页 PPTX、加入备课、更新为三页 PDF，再从使用位置进入“有更新 · 查看”。仅邮件使用测试收件器；业务没有替身或接口预置。未写原失败现场、50880、用户数据库或其他工作树，未调用产品 Agent。

| 检查 | 实际结果 |
| --- | --- |
| 基线 RED | 等自然动画结束后，页图九点命中检测仅 3/9，截图确认为外层裁切。[截图](preview-fix/red-1440-current.png)、[失败断言](preview-fix/red.log) |
| 1440×900 与 1280×900，新旧文件 | 两种宽度分别遍历两版本的全部三页，页图九点均 9/9；首尾翻页禁用状态正确。新旧预览请求的文件不同，跨宽度保持各自文件身份 |
| 缩放及关闭 | 75% 缩小、150% 放大并滚动到右下角、恢复 100% 均通过；关闭内层后对照仍可继续，取消对照再打开正常 |
| 采用、保存、重开 | 采用 PDF 后保存刷新，更新提示消失、环节保留，普通预览请求与此前来源当前文件一致 |
| 稳定性与共用呈现 | MF-UI-01 定向 E2E 连续两次通过；既有“资源就地预览采用、引用排序移动、删除环节和来源更新”场景通过；没有页面 JS 异常或根页面横向溢出 |
| 工程检查 | `npm run build`、`git diff --check` PASS。构建仍有既有大 chunk 提示；本次不重跑全业务和输出矩阵 |

截图：[1440 当前末页](preview-fix/1440-current-page3.png)、[1440 已采用第二页](preview-fix/1440-adopted-page2.png)、[1280 当前第一页](preview-fix/1280-current-page1.png)、[1280 已采用第二页](preview-fix/1280-adopted-page2.png)、[采用保存重开](preview-fix/1280-reopened-adopted.png)。[布局数据](preview-fix/checks.json)、[绿灯日志](preview-fix/green.log)、[构建日志](preview-fix/build.log)。截图均使用自然动画结束后的页面，未禁用动画。

复跑入口：先构建，再以独占 `TMPDIR` 运行 `npx playwright test -c apps/web/e2e/manual-lessons.config.mjs -g MF-UI-01`。需设置 `MATERIALS_OFFICE_ROOT`；本轮只读复用 `/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8`。测试证据默认写 `test-results/manual-lessons-preview-evidence`，可用 `MANUAL_LESSONS_PREVIEW_EVIDENCE` 指定目录。

## Standards

PASS，0 findings。只读 reviewer `preview_standards` 核对 4 文件 diff：复用现有预览、局部调整挂载与 CSS，真实 E2E 等待自然动画，无 UI 单元测试或范围外抽象。

## Spec

PASS，0 findings。只读 reviewer `preview_spec` 核对 MF-UI-01：新旧文件完整预览、翻页缩放关闭及采用保存重开均有定向覆盖；共用宽度修正必要，没有新增业务功能或修改采用契约。

两轴各 0 项发现，仅为本次 diff 的内部审查，不替代独立验收。

## 回执

```yaml
task: MANUAL-LESSONS@1
attempt: 2
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-23 06:31:36 UTC"
session_id: unavailable
runner: Codex / gpt-6-astra / low
skills_used: [diagnosing-bugs, code-review, writing-for-agents]
base_revision: 6b0193521090a4880907961ddfc923d502304fe1
result_revision: b9dd00fab7b12016674bd52ae792d4e82805576c
review_target:
  fixed_point: 6b0193521090a4880907961ddfc923d502304fe1
  commit_range: 6b0193521090a4880907961ddfc923d502304fe1...b9dd00fab7b12016674bd52ae792d4e82805576c
  standards: PASS
  spec: PASS
  aggregate: docs/acceptance/evidence/MANUAL-LESSONS/v1/preview-fix.md
internal_reviewers:
  - "preview_standards；Codex / gpt-6-astra / low；只读叶子"
  - "preview_spec；Codex / gpt-6-astra / low；只读叶子"
inputs: [MANUAL-FLOW/v1/acceptance.md#MF-UI-01]
changed_files:
  - apps/web/src/features/lessons/ReferenceCard.jsx
  - apps/web/src/features/lessons/materials.css
  - apps/web/e2e/manual-lessons-preview.spec.js
  - apps/web/e2e/manual-lessons.config.mjs
  - docs/acceptance/evidence/MANUAL-LESSONS/v1/preview-fix.md 与 preview-fix/ 证据
checks: [MF-UI-01 RED转GREEN且连续2次PASS, 既有资源取材E2E通过, build通过, diff-check通过]
identity_mode: real-auth；仅邮件为本地测试收件器
open_items: []
failure_owner: null
next_condition: 独立验收者在固定候选按 MF-UI-01 解除条件定向复验
authorization_used: MANUAL-LESSONS@1 / attempt 2 用户任务包
```

本结论仅为 MF-UI-01 修复 self，不升级原组合验收，也不声明其他已知问题或目标设备已通过。未合并 main、push 或部署。
