# M41 静态隔离实现回执

**BLOCKED：M41 整体未完成，不能交 M42。** 已交付可运行的 native 图形切片，完成真实 UI/HTTP 保存、文件和源回读、历史、重启及失败恢复自验。公共 MathJax、字体、页面身份和目录构建支持尚未收到固定 SHA；公式目前明确报渲染不可用，没有用替代渲染器、样图或旧实验冒充成功。

完整实现切片 SHA：`6a54e55a36e9efec65381ad9ceaa7af0c8228f36`。该 SHA 是下面自验的代码候选，**不是完整 M41 放行候选**。本报告与附件另行提交，最终回复给出证据提交 SHA。运行、端口、迁移和待接界面见 [integration.md](integration.md)。

## 实际验证范围

| 场景 / 检查 | 本候选实际结果 |
| --- | --- |
| WB-MA003 / MC02 原生平面 | 浏览器从空稿加函数，保存、刷新重开、改常数，再下载真实 PNG/SVG/JSON。实际 SVG 核对顶点 `(1,-3)` 与零点 `1±sqrt(3)`，采用独立坐标预期和路径线段距离。Q5 通过 HTTP 制作输出，3/4标签和颜色正确；PNG已目检。另通过浏览器从空稿制作三角形、增删顶点、修改3/4标签位置颜色，保存重开并下载SVG。 |
| WB-MA004 / MC02 空间 | 浏览器正方体起点可改投影并保存重开；固定 Q6 经 HTTP 导出，AC1 端点投影与指定虚线正确。PNG已目检。另通过浏览器修改全部三维尺寸、顶点名和AC1虚线，重开逐项读回；棱锥保存重开通过。 |
| WB-MA015 / MC13 端口 | list/create/get/export 与 HTTP 共用实际 service；同步 reference/teaching 读取返回保存结果，跨账户拒绝。没有调用模型。只覆盖 native 分支。 |
| WB-MA016 / MC08 | 版本冲突、同键异体、成功重放、关闭服务再开后的旧键确认及不可变历史通过。真实浏览器丢弃已完成保存响应，继续编辑后原键确认不丢新稿。删除和导出未知结果保留同键；双击在途互斥红绿通过。 |
| WB-MA017 / MC09 部分 | 跨账户404、缺海报503并保留元数据、修复原字节后恢复通过。SQLite trigger 使版本事务真实失败，无新增作品/成功回执，同键修复重试通过。无有效页面、过期身份、真实认证和迟到跨账户全项仍待公共支持。 |
| 旧 R31 库迁移 | 原 R31 fixture 创建真实题目、File、文档和幂等结果，接 math 后连续保留启动两次；旧值不变，math_001只应用一次。HTTP读取/重放和旧 ledger 逐值比对通过。 |
| 透明与数学输出 | PNG包含 alpha=0 和 alpha>0 像素；SVG实际路径、JSON源、File下载字节均回读。实际Q2中文、Q5标签与Q6棱线已目检，无裁字。当前使用本机字体，不代替未来固定字体跨设备验收。 |
| UI | 1440×900、1024×768、390×844截图已目检；没有横向溢出。保存失败切换先确认丢弃，脏稿禁止删除；极窄浮点坐标窗保持响应。无UI单元测试。 |
| WB-MA001/002、MC01 | BLOCKED。MathJax公共产品依赖未交付，求根/分段式、invalid公式保存与修复、公式透明制品尚未实现/验证。公式源编辑只保留设备草稿，服务端503。 |

## 命令与证据

- `node --test apps/api/test/math-static*.test.js apps/api/test/math-contract*.test.js`：4/4，通过；[math-final.log](artifacts/math-final.log)。数学解析器的必要独立预期检查覆盖幂优先级、投影和极点断开；主要行为从真实HTTP验证。
- `npx playwright test --config apps/web/e2e/fixtures/math-static/playwright.config.mjs`：8/8，通过；[browser-final.log](artifacts/browser-final.log)。使用真实数据库、文件与服务端渲染。截断已完成响应的网络场景是传输故障注入，不是业务替身。
- `npm run test:api`：89/89，通过；[common-api-final.log](artifacts/common-api-final.log)。包括原底座和本节点集成测试。
- 独有 fixture 生产构建通过；[fixture-build-final.log](artifacts/fixture-build-final.log)。原 API/Web 分项构建可运行，日志另附，但公共入口尚未装配 math，因此它们不证明正式数学产品组合。
- `npm run build`：FAIL；[common-build-final.log](artifacts/common-build-final.log)。公共目录检查拒绝 `apps/api/src/modules/math has no catalog mapping`，归公共装配支持；未改公共校验器绕过。
- 首选 chrome-devtools-axi 的独立 m41 会话两次返回 `No page is currently selected`；改用项目 Playwright，未操控其他页面。

正式输出在 artifacts/Q2、Q5、Q6 的 PNG/SVG/JSON，浏览器截图为 desktop.png、1024.png、390.png、space.png、triangle.png、pyramid.png；真实事务回执为 native-transactions.json。hashes.json 记录提交制品摘要。源 JSON 中的 ID 属隔离测试作品，不是产品种子。生成命令可重复建立自己的作品与失败样本。

内部 code-review 的双轴结果、精确固定范围和修复归属见 [internal-review.md](internal-review.md)。不能把初审或有界复核的范围写成整个最终代码均获 reviewer PASS。最后的导出竞态有真实双击红绿证据；后续小修仅由作者自验。

## 结构化回执

```yaml
task: M41@1
attempt: 1
role: implement
status: BLOCKED
verification_level: self
finished_at_utc: "2026-09-22T08:46:49Z"
session_id: "01a0c824-e2a3-75c2-86dd-f0540d818922"
runner: "Codex CLI / gpt-6-astra / low；实施及随附回执在同一session，内部reviewer继承"
skills_used: [implement, writing-for-agents, code-review]
base_revision: "df376b214113c7476e524b68a19982ade1e0e642"
result_revision: "6a54e55a36e9efec65381ad9ceaa7af0c8228f36；仅实现切片，证据提交由最终回复固定"
review_target:
  fixed_point: "df376b214113c7476e524b68a19982ade1e0e642"
  commit_range: "df376b214113c7476e524b68a19982ade1e0e642...f72b43f434f9a953740d3078c37ecec20469f905；另有界delta到1492aa5dac6f618fa9292e02d011611e8124e74f"
  standards: "PASS for bounded fix review through 1492aa5; no final-candidate re-sign"
  spec: "FAIL at 1492aa5; reported P2 fixed in d51a81c with author E2E red-green, no reviewer re-sign"
  aggregate: "docs/acceptance/evidence/M41/v1/internal-review.md"
internal_reviewers:
  - "Standards /root/standards_review；继承 gpt-6-astra low / Codex"
  - "Spec /root/spec_review；继承 gpt-6-astra low / Codex"
inputs:
  - "依赖提案2e67961b01f4ce90ab07dad1feb823b1f595266d；作者76151489f28cfe1ccaddd8afa28db3c613f3c6a5"
  - "限定independent PASS 3783208100703efc6b00f14eaf9709ff501705a2"
  - "R31产品5f696b8ce611e67d940ce149ce13946a50b65510；交接c08fa62d434efffc89b471151faa73308e3ce716"
  - "M40冻结1a5dd015863d749e5244346f4eaad24ac506670d；原M41包及所指契约/UX/架构"
changed_files: "changed-files.json；另本目录回执及制品"
artifacts: "hashes.json、artifacts/、integration.md、internal-review.md"
checks: "本报告实际验证表、命令及日志；native self不外推公式/身份/正式组合"
identity_mode: test-principal
open_items:
  - "等待R31-MATH-SUPPORT固定MathJax 3.2.2、本地字体和构建输入；实现并回归公式全项"
  - "等待公共A11页面身份装配与transport；回归完整MC09和账户切换"
  - "公共catalog映射缺失导致共同build失败；M41无公共写权"
  - "公共支持到齐后仍须在新的组合候选重跑完整M41原包"
  - "Worker硬截止代码已实现；30秒实际超时及Sharp资源回收时延未做压力验收"
  - "正式产品、real-auth、PPT/WPS/Windows和M44独立验收未完成"
failure_owner: "公共支持归R31-MATH-SUPPORT/公共装配写者；后续公式实现和完整回归归M41"
next_condition: "外层交固定支持SHA后本M41接续，补全全项并固定完整候选停写，才可派M42；当前不放行"
authorization_used: "用户M41@1 / attempt 1；限定隔离实现及任务候选提交，不改其他worktree/根台账/冻结契约/旧证据，不合main/push/部署，不调用产品模型，不联系T51；外层唯一通知"
```

当前保留本工作树的库、文件、失败trace、构建和验证现场，因整体未达到完成条件不清理。没有写入其他工作树，没有以进程正常退出替代任务完成。
