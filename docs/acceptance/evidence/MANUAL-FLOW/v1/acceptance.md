# MANUAL-FLOW-ACCEPTANCE@1 / attempt 1

**FAIL，verification_level=independent。** 固定组合的资源收录、混合取材、编辑重排、来源采用、保存重开及 Word/PDF 下载主路径通过；发现一项影响实际对照阅读的缺陷 **MF-UI-01**。本轮未发现数据丢失，不代表全部手动能力交付，也不替代数学既知问题 MM-SPEC-01 的修复验收。

## 受测版本与环境

- 固定组合：`0765532a763799cd143544ba02b11342990931e0`；工作树 `/home/liam_t/项目/TeacherWorkspace-manual-resources`，分支 `review/manual-flow`。
- 执行者：Codex / gpt-6-astra / medium，独立浏览器验收；未调用内部助手或源码 code-review。
- 判据：[PRODUCT_SCOPE 第 2、3、4 节及持久化共同要求](../../../../PRODUCT_SCOPE.md)、[WORKBENCH_DESIGN 取材与返回](../../../../WORKBENCH_DESIGN.md)、[设计与验证规则](../../../../rules/design-and-verification.md)。Agent、目标设备、Word/WPS 真人和公网环境依任务包排除。
- Node.js 22.23.2；系统 Chrome 152.0.7977.64，Playwright 驱动真实页面；桌面 1440×900、1280×900。首选 chrome-devtools-axi 完成注册，其上传命令发生工具参数 `filePaths` 兼容错误，后续改用现有 Playwright，未将此错误归为产品缺陷。
- 当前固定代码重新执行 `TMPDIR="$PWD/.tmp-mf" npm run build`，PASS。构建日志保存在独占现场 `.tmp-mf/build.log`；只有既有的大 chunk 提示。
- 启动入口：现成 `apps/api/test/fixtures/auth-integration/harness.js` 的 `createIntegration({directory: process.cwd()+'/.tmp-mf/service'})`。它启动实际 `createApp`、模块、SQLite、文件存储和生产 Web 构建；不是资源/备课替身服务。随机 HTTPS 端口首次 `32965`，保库重启后 `36247`。
- 真实 Cookie 注册及登录；仅邮件投递使用本地测试收件器，时钟沿用该入口的测试时钟，不验证邮件运营或真实时间业务。业务数据全部经 UI 创建、修改；没有直接写库或用接口预置题目、资源、作品及备课。
- LibreOffice 只读复用 `TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8`；Pandoc 只读复用 `TeacherWorkspace-office-comparison/experiments/office-comparison/tools/pandoc-3.11/bin/pandoc`。实际转换、下载均走产品服务。
- 未接触用户 `50880`、预览数据库、预览配置或凭据；未调用产品模型，未改产品、规格、AGENTS 注入或其他回执，未合并 main、push 或部署。

## 本轮实际执行

同一教师账户、同一备课“函数定义域与图像 - 组合验收”贯穿以下流程。题目和数学作品均在 UI 手工制作，采用的 PPTX/PDF 为仓库现成真实文件样本。

| 场景 | 实际结果 | 证据 |
| --- | --- | --- |
| MF-01 上传、内容预览及整理 | PASS。上传三页 PPTX，翻阅前两页并目视文字、公式和图像；改名，创建文件夹“函数专题”与标签“课堂展示”，保存备注 | [首页](screenshots/01-resource-pptx.png)、[第二页](screenshots/02-resource-page2.png) |
| MF-02 在环节取题、取资源 | PASS。UI 自建包含分式的题目，在新备课创建两个环节，从题库取题、从资源库选择课件；选择器内打开实际页图后采用 | [混合文稿重开](screenshots/05-mixed-lesson-reopened.png)；本地 trace 含完整操作 |
| MF-03 制作数学作品并带回 | PASS。从“概念探究”进入数学工坊，制作 `x^2-2*x-3` 图像并保存，带回原环节；此前未保存的本课教师注记仍保留 | [制作与返回目标](screenshots/04-math-from-lesson.png) |
| MF-04 取已有作品、编辑与重排 | PASS。在另一环节通过选择器复用刚保存的作品；移动题目、上移数学材料、上移环节。保存刷新后两环节、四处引用、引用顺序和教师注记一致 | [重开文稿](screenshots/05-mixed-lesson-reopened.png) |
| MF-05 资源更新及采用 | 部分 FAIL。PPTX 更新为 PDF 后名称、文件夹、标签、备注与使用位置保留，备课保留旧快照并提示更新；采用后显示 PDF。普通采用文件预览通过，更新对照里的嵌套预览失败，见 MF-UI-01 | [资源更新](screenshots/06-resource-updated.png)、[普通预览](screenshots/13-preview-natural.png)、[失败预览](screenshots/14-nested-preview-natural.png) |
| MF-06 题目、数学来源修改与返回 | PASS。查看题目来源，改题面并保存，返回后采用新版。数学来源改为 `x^2-2*x-1`，返回备课对照两版图像，只更新第一处引用；第二处仍保留旧快照，符合逐处采用 | [数学对照](screenshots/10-math-update-compare.png)、[下载 PDF](mixed-student.pdf) |
| MF-07 Word/PDF 实际输出 | PASS，限本机。对混合备课生成学生讲义 Word/PDF 并通过 UI 下载。Word 有 1 个 OMML 分式及 2 个图像，Pandoc 读回仍为数学；PDF 两页逐页目视，无裁切或空白尾页。两种文件均含新版题面且不含教师注记、题库私人笔记 | [Word](mixed-student.docx)、[PDF](mixed-student.pdf)、[第 1 页](output-pages/mixed-student-1.png)、[第 2 页](output-pages/mixed-student-2.png)、[校验](output-checks.json) |
| MF-08 保库重启、新浏览器登录及下载 | PASS。停止本轮服务并保留 SQLite/文件，随机新端口重启，创建全新浏览器上下文登录。备课顺序、四处引用、新版题面与资源采用版本保留；两个历史输出可再下载，PDF 与原下载 SHA256 一致。备课中的资源原件下载与上传 PDF 字节一致 | [重新登录后的文稿](screenshots/16-restart-login.png)、[输出任务](screenshots/17-outputs-restored.png)、[校验](output-checks.json) |
| MF-09 资源重开、搜索及使用位置 | PASS，含界面恢复边界。按新增备注搜索命中唯一资源，重开后文件夹/标签/内容页图保留；1280 宽度无根页面横向溢出。点击资源使用位置进入对应备课；若该备课上次停在输出面板，会先恢复输出，需点“返回文稿”继续看引用 | [1280 资源页](screenshots/18-resource-restart-1280.png) |

边界观察：备课有未保存草稿时，从来源返回可保留该草稿，但来源更新提示在本次保存后才出现；没有把“立即返回即可见更新提示”算作通过。全新浏览器上下文中历史输出任务恢复成功，输出选择控件显示默认值，本报告不声称跨浏览器恢复全部界面选项。

[网络摘要](network-summary.json)记录业务请求方法、路径与状态，不含 Cookie 或请求正文。无捕获到的页面 JS 异常；新建备课期间出现一次 `GET /api/modules/lessons/v3/new` 的 422，实际新建、保存和后续流程成功，不宣称网络零错误。

## MF-UI-01：更新对照中的资源预览被外层弹窗裁切

- 状态：FAIL，P2；责任模块：**MANUAL-LESSONS，备课更新对照与文件预览的嵌套呈现**。资源文件转换及独立预览正常；未用源码审查推断具体修复。
- 固定版本：上述组合 SHA。1440×900 的当前文件、已采用文件均复现；保库重启后在 1280×900 再次复现。
- 最小操作：在备课采用一个可正常预览的 PDF/PPTX 资源并保存；在资源库更新文件或修改备注并保存，形成新版本；回到备课，点击该资源“有更新 · 查看”，再点击“预览来源当前文件”或“预览本课采用文件”。
- 预期：老师能在对照时完整阅读文件页图、翻页并关闭预览。
- 实际：内层预览虽然请求成功、图片加载完成，但被高约 180.52px 的外层“对照更新”弹窗截断。1280 实测页图从 y=479.17 到 y=735.86，外层在 y=540.25 截止，只显示约 **23.8%** 页图高度。只能看到页面标题附近，不能完整对照课件内容；并非文件无内容或转换失败。
- 稳定信号：等待对话框及子元素动画完成后读取实际布局，`expect(visibleFraction).toBeGreaterThanOrEqual(0.95)` 实际返回 `0.2379474068663258`，RED。截图使用自然动画完成后的页面，不依靠 `animations: disabled` 判断此缺陷。
- 证据：[1440 来源当前文件](screenshots/14-nested-preview-natural.png)、[1440 本课采用文件](screenshots/15-nested-old-preview-natural.png)、[1280 重启后复现](screenshots/19-nested-preview-1280.png)、[布局与红灯数据](preview-clipping.json)。[普通预览对照](screenshots/13-preview-natural.png)可完整显示同一 PDF。
- 绕行：关闭两层对话框，从资源库阅读新版或从引用的“预览采用文件”阅读旧版，再回到备课决定采用。此绕行不代替更新对照本身通过。
- 解除条件：责任模块提交修复候选后，在 1440/1280 对照弹窗分别打开旧文件和当前文件，完整页图可见且可翻页/缩放/关闭，采用更新和保存重开仍正确。

## 沿用证据与未执行范围

- 已读取 [MANUAL-RESOURCES](../../MANUAL-RESOURCES/v1/receipt.md)、[MANUAL-LESSONS](../../MANUAL-LESSONS/v1/receipt.md)、[MANUAL-MATH](../../MANUAL-MATH/v1/receipt.md) 三份回执，以及集成[准备](../../MANUAL-INTEGRATION/v1/receipt.md)、[数学](../../MANUAL-INTEGRATION/v1/math.md)、[资源与备课](../../MANUAL-INTEGRATION/v1/resources-lessons.md)回执。它们的 self/集成自检结论没有被升级为本轮独立全量验收。
- 资源的八格式矩阵、失败重试、旧 DOC 补充 PDF、删除恢复及其未变路径沿用作者证据。本轮只新增 PPTX 上传和 PPTX→PDF 更新的组合验证，不重跑全格式。
- 备课三成果×学生/教师×Word/PDF 的 [12 份原制品](../../MANUAL-LESSONS/v1/outputs/manifest.json)全部 SHA256 核对一致，沿用原回执的逐份验证。本轮只生成两份混合材料学生讲义，不声称重跑了十二种组合、全部故障恢复或教学反馈场景。
- 数学动态/HTML 离线、空间作品及独立导出沿用原回执。本轮只检验平面作品与备课的制作、选择、返回及来源更新交叉点。**MM-SPEC-01 未重复检查，未重新编号，也未视为修复通过。**
- 目标 Word/WPS 真人编辑、物理打印、课堂设备、iPad、公网/大陆网络及正式预览部署均暂缓。本机 DOCX 结构及读回通过不能替代目标 Office 验证。
- Agent 停工；其他模块全部手动范围、备份恢复及全 MVP 交付不在本次 PASS 声明内。

## 回执与现场

仅提交本目录的报告、必要截图、两份下载物及校验摘要。失败现场保留在本工作树 `.tmp-mf/`：隔离数据库/文件位于 `service/`，完整浏览器 trace 为 `flow-trace.zip`，另有构建日志、下载复核及未采用截图。trace 可能含隔离测试登录会话，留本地，不进入 Git。独占浏览器和服务已停止；现有用户服务不受影响。重现场景可用相同启动入口与工具环境指向该目录后，以隔离测试账户登录，再打开报告中的备课。

```yaml
task: MANUAL-FLOW-ACCEPTANCE@1
attempt: 1
role: acceptance
status: FAIL
verification_level: independent
finished_at_utc: "2026-09-23 06:14:35 UTC"
session_id: unavailable
runner: "Codex / gpt-6-astra / medium"
skills_used: [writing-for-agents, diagnosing-bugs]
base_revision: "0765532a763799cd143544ba02b11342990931e0"
result_revision: "包含本 acceptance.md 的证据提交"
review_target: not-applicable
internal_reviewers: []
identity_mode: "real-auth；仅邮件使用本地测试接收器"
changed_files: ["docs/acceptance/evidence/MANUAL-FLOW/v1/acceptance.md", "同目录必要证据"]
checks: ["固定组合构建 PASS", "MF-01..04 PASS", "MF-05 部分 FAIL", "MF-06..09 限定 PASS", "12 份既有制品哈希 PASS", "MF-UI-01 稳定 RED"]
open_items: ["MF-UI-01", "MM-SPEC-01 由原责任节点继续处理", "目标 Office/设备/公网暂缓"]
failure_owner: "MANUAL-LESSONS：更新对照/嵌套文件预览"
next_condition: "MF-UI-01 修复候选到达后按上述最小复现定向复验；本报告不授权预览部署"
authorization_used: "MANUAL-FLOW-ACCEPTANCE@1 / attempt 1 用户任务包"
```
