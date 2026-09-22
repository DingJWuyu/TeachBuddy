# R31/v1 完整公共底座作者回执

**PASS / self。** 完成 R31 剩余 File/Preview/Document/Job 公共底座并复用既有文件、身份和编辑器成果。候选 `6225fc07a895113a667b5a41092a7a69e2f2fefa`；运行、迁移、隔离 fixture、公共端口与四 handler 唯一绑定位置见 [integration.md](integration.md)。本回执不签业务提取、六成果、在线模型或 Windows/WPS 通过。

## 实测结果

| 完成条件 / BDD 底座断言 | 实际结果与证据 |
| --- | --- |
| File 持久性 / WB-M025 | PASS。真实 HTTP 上传/受控下载、同键并发、不同键同字节、上传中断、rename 与 SQLite 提交失败、原键重启确认、缺失/损坏 blob 恢复。复用基础公开 HTTP 测试并在最终候选重跑，见 [api.log](api.log)。 |
| Preview / WB-M014、M015、M027 | PASS。DOCX 生成真实 PDF 和页图；固定 PDF/PPTX/PPT 均 3 页，旧 DOC 4 页并始终 limited/legacy-object-loss；PNG/JPEG/WebP 真实页，JPEG 方向正确。每页实际像素非空；旧 DOC 重试保留风险。见 [preview.log](preview.log)、[preview-desktop.png](preview-desktop.png)。 |
| 转换隔离 / WB-M027 | PASS。真实 bubblewrap 子进程只读输入和程序，独立 profile/可写输出、网络命名空间隔离、无宿主用户目录。真实 sandbox 探针不能读取宿主 sentinel、不能连接宿主监听器；这项使用明确的可执行测试探针，不冒称 Office 原稿利用。另用真实 DOCX 路线拒绝外部关系、宏包、513 MiB 展开；真实 501 页 PDF 被拒；1ms 限额杀死真实转换进程。原件均仍可下载。HTML 仅转义源文字栅格预览，不作为浏览器脚本执行。 |
| 裁图 / WB-M005、M012 | PASS。根据固定原件/rendition/页链生成 PNG，100×60 独立像素预期通过；拒绝空框和非法位置，原键不重复生成；页图/裁图与原件同账户授权，重启保留。 |
| Job / WB-M008、M023、M024 | PASS。202 只受理；重复 preview 复用任务；部分结果、非法重试单元、取消后迟到结果、运行中重启 interrupted、已完成进度保留、未知 Provider 不自动重发。显式 fixture 未产生提取/导出成功，未调模型。见 [jobs.log](jobs.log)、最终 [api.log](api.log)。 |
| 身份 / WB-M026 | PASS，real-auth + fake-mail。真实 A11 HTTPS 注册/激活、页面绑定、跨账户 404、缺页面身份 401、页图/裁图/任务保护、重启恢复、退出后全部失效。见 [auth.log](auth.log) 与最终 API 回归。浏览器公共编辑/预览 fixture 另标 test-principal。 |
| Document / WB-M012、M023、M024 | PASS。真实 UI 编辑 v1/v2、文字、行内/独立公式、标题、小问/选项列表、表格、图片和教师注记；真实 SQLite 拒写后原键确认、新稿再存、刷新及进程重启；未知版本原样只读且保存禁用。见 [browser.json](browser.json)、[browser.log](browser.log)、[document-desktop.png](document-desktop.png)、[document-pad.png](document-pad.png)。没有 UI 单元测试。 |
| 迁移与空库 | PASS。B16 真实 HTTP 建旧账户/布局/题目与幂等记录；所有旧行逐值保留，空库、重复两次启动、新 migration 仅一次；追加 A11 真实旧账户登录/激活和行不变检查。见 [migration.json](migration.json)。未改认证内部迁移。 |
| 公共 fixture 浏览器 | PASS。PPTX 上传、三页切换、第 3 页保存裁图、同 file ID 服务重启回读；1440×1000 与 768×1024 无横向溢出，截图已人工视觉检查。见 [preview-browser.json](preview-browser.json)、[preview-pad.png](preview-pad.png)。 |
| 构建/依赖 | PASS。最终候选 `npm ci`、`npm run test:api` **170/170**、`npm run build`、材料 fixture 构建。见 [install.log](install.log)、[api.log](api.log)、[build.log](build.log)、[fixture-build.log](fixture-build.log)。`npm audit` 为 0 漏洞，锁定 yauzl 3.2.1；修复依据 [GHSA-gmq8-994r-jv83](https://github.com/advisories/GHSA-gmq8-994r-jv83)。 |
| skill 内部审查 | Standards PASS、Spec PASS，各 0 发现，两个继承模型的只读助手并行。完整目标和分轴原结论见 [internal-review.md](internal-review.md)。 |

技术环境与原件 SHA-256 见 [environment.json](environment.json)、[inputs.json](inputs.json)。公开测试中的失败样本可由同版命令直接重建，失败路径是预期断言；不存在尚未解决的 R31 产品失败。早期功能尚缺的真实 HTTP red 见 [preview-red.log](preview-red.log)，未作为最终通过证据。

既有公共迁移测试三文件只补 `materials_jobs_001` 与对应 runner 参数，属于用户授权的必要机械适配。冻结文档、认证/math 内部、业务模块、公共 Web 外壳、当前 AGENTS.md/run-state 均未在 fixed point 后改变，逐项范围见 [changed-files.json](changed-files.json)。

## 交付边界

- 本轮模型请求 0、密钥读取 0。C21 关闭窗口没有重开，任何 fixture 均不代签 R33 真在线能力。
- 三个业务 handler 明确未接入且生产拒启（[实际启动拒绝日志](production-refusal.log)）；最终 extraction/export/question-asset 绑定、资源/题库/备课业务与六成果归 R32/R33/R34。
- 旧 DOC 对象损失仍是可见风险，补充 PDF 归资源业务；Windows/WPS、目标字体和真实 Office 编辑/打印归既有外部验收边界。
- 构建保留既有较大 chunk 提示，没有构建失败；公共外壳/README 后续同步由 R34 拥有。
- 完成后停止公共写入。运行时服务均关闭，清理本次无用临时库/profile/日志；正式证据与同版样本保留。未修改原现场，未合 main、push、部署或发外部通知。

## 结构化回执

```yaml
task: R31@1
attempt: 1
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T10:51:05Z"
session_id: unavailable
runner: "Codex / gpt-6-astra / low"
skills_used: [implement, tdd, codebase-design, writing-for-agents, code-review]
base_revision: "31471d4e880232666e05fc9c2c5ba2f139282ee9"
result_revision: "6225fc07a895113a667b5a41092a7a69e2f2fefa；本回执所在提交 + docs/acceptance/evidence/R31/v1/author.md"
review_target:
  fixed_point: "b1d2b283ab210994fab639f6d822a86b8a23693f"
  commit_range: "b1d2b283ab210994fab639f6d822a86b8a23693f...665fb7f4dfbc99d9f3da82fe62164333d83dd42e"
  standards: PASS
  spec: PASS
  aggregate: "docs/acceptance/evidence/R31/v1/internal-review.md"
internal_reviewers:
  - "Standards / Codex / gpt-6-astra / low / read-only leaf"
  - "Spec / Codex / gpt-6-astra / low / read-only leaf"
inputs: "integration.md 固定输入；inputs.json 来源与哈希"
changed_files: "changed-files.json"
artifacts: "本目录证据及 inputs.json 所列固定 samples"
checks:
  - "最终候选 npm ci、170 API tests、build：PASS"
  - "真实 Office/PDF/image preview、crop、HTTP 持久与身份：PASS"
  - "B16旧库、A11登录、重启/取消/故障恢复：PASS"
  - "实际浏览器公共编辑与预览：PASS"
  - "Standards/Spec 内部审查：PASS/PASS"
identity_mode: "real-auth + fake-mail（HTTPS API）；test-principal（隔离浏览器 fixture）"
open_items:
  - "R32/R33/R34 业务接入与 R34 最终真实四 handler 组合"
  - "R33 新授权真实在线识别；现窗口关闭"
  - "R35/外层目标 Windows/WPS、Office编辑打印与后续独立流程验收"
failure_owner: null
next_condition: "外层固定完整候选与回执；R31停止公共写入，R32/R33/R34按integration.md隔离消费，R34继任共享写者"
authorization_used: "用户R31@1 attempt1完整DAG授权；当前独立worktree可提交、固定输入引入、范围内实现/验证/skill内部助手；不合main/push/部署，唯一通知由外层负责"
```
