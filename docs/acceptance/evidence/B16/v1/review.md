# B16/v1 首条流程独立验收

```yaml
task: B16@1
attempt: 1
role: acceptance
status: FAIL
verification_level: independent
finished_at_utc: "2026-09-21T22:23:35Z"
session_id: unavailable
runner: "Codex，gpt-5.6-sol high"
skills_used:
  - writing-for-agents
base_revision: "c2a848c6c8506b53830792a52955d2423dadec09"
result_revision: "受测候选 f27b7591e0eb5134a62968ed2c6146b05ede5c16；报告与证据位于 review/b16-first-flow:docs/acceptance/evidence/B16/v1/"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "f27b7591e0eb5134a62968ed2c6146b05ede5c16:docs/acceptance/evidence/B15/v1/{author.md,run.json}"
  - "f27b7591e0eb5134a62968ed2c6146b05ede5c16:docs/acceptance/evidence/B11/v1/{author.md,review.md}"
  - "f27b7591e0eb5134a62968ed2c6146b05ede5c16:docs/acceptance/evidence/B12/v1/author.md"
  - "f27b7591e0eb5134a62968ed2c6146b05ede5c16:docs/acceptance/{mvp-matrix.md,first-flow.feature}"
  - "f27b7591e0eb5134a62968ed2c6146b05ede5c16:docs/{ux/first-flow.md,rules/design-and-verification.md,plans/execution-protocol.md}"
changed_files:
  - "docs/acceptance/evidence/B16/v1/review.md"
  - "docs/acceptance/evidence/B16/v1/run-acceptance.mjs"
  - "docs/acceptance/evidence/B16/v1/run.json"
  - "docs/acceptance/evidence/B16/v1/acceptance.log"
  - "docs/acceptance/evidence/B16/v1/build.log"
  - "docs/acceptance/evidence/B16/v1/{network.jsonl,service-requests.jsonl,service-errors.jsonl}"
  - "docs/acceptance/evidence/B16/v1/{broken-migration.log,production-refusal.log}"
  - "docs/acceptance/evidence/B16/v1/*.png"
artifacts:
  - "run.json：候选 SHA、隔离路径、端口、账户、场景结果和视觉几何"
  - "network.jsonl：浏览器脱敏网络索引，含真实 503 及恢复后 201"
  - "service-{requests,errors}.jsonl：真实服务请求/错误索引"
  - "desktop-*.png、narrow-desktop-aux.png、pad-*.png：桌面、窄桌面与 Pad 截图"
  - "failure-*.png、recovered-*.png：真实 SQLite 拒写和本地存储拒写的失败/恢复对照"
  - "build.log、broken-migration.log、production-refusal.log：生产构建与启动保护"
checks:
  - "固定 SHA 隔离生产构建：PASS，exit 0，未生成/改写用户库"
  - "普通页面操作录题 -> 改编 -> 备课取题 -> 返回 -> 刷新 -> 保留库 API 重启 -> 新浏览器上下文：PASS"
  - "WB-010 搜索、多选、列表独立滚动、右栏和 AI 未发送草稿切模块/刷新恢复：PASS"
  - "WB-011 真实浏览器 localStorage 拒写、明确警告与在线保存恢复：PASS"
  - "真实 SQLite query_only 拒写：HTTP 503，业务行/幂等记录均不增，恢复后原键只写入一次：PASS"
  - "桌面 1440x900、窄桌面 1100x800、Pad 768x1024：分区、滚动、右栏、对照切换、无横向溢出、180ms 出现动画与 reduced-motion 均可观察；视觉缺陷见 B16-UI-001/002"
  - "B12 公共责任：空库、双账户隔离、保留库重启、旧账户/布局升级、破损迁移非零退出、production 拒绝 test-principal、隔离构建：PASS"
identity_mode: "test-principal（runner 服务端绑定 fixture-teacher-a / fixture-teacher-b，页面不能选择 principal）"
open_items:
  - "B16-UI-001：空题面区被渲染为近整屏大空框，责任节点 B14@1"
  - "B16-UI-002：真实写失败时重复显示相同的结果未确认文案，责任节点 B14@1"
  - "real-auth、会话寿命、退出与真实账户交接属 A11/A12，本回执不证明"
  - "真实 AI 消息、数学/Office/文件、部署与备份不在 B16 范围"
failure_owner: "B14@1（前端与外壳）；修复后由 B15 重新固定候选并交 B16@1 attempt 2"
next_condition: "修复 B16-UI-001/002，在新固定 SHA 上重跑本目录 run-acceptance.mjs，并重新查看桌面空态与写失败截图；新 SHA 不直接复用本次 PASS 子项"
authorization_used: "用户 B16@1 / attempt 1：候选只读，允许必要构建/API/浏览器验证及临时脚本；报告分支提交；不合 main、不 push、不部署、不改产品"
```

## 结论

**FAIL**。固定受测候选是 `f27b7591e0eb5134a62968ed2c6146b05ede5c16`。功能、真实网络、持久化、失败恢复、B12 公共底座和生产构建均独立通过，但桌面空态和写失败反馈有可稳定复现的视觉缺陷。按独立验收规则，有可复现缺陷不能 PASS。

## 必修缺陷

### B16-UI-001：空题面区是近整屏大空框

- 前置：1440x900，教师 A，打开题库但没有当前题目。空库，或搜索并多选但未打开题目，均可复现。
- 操作：普通点击进入题库；第二条路径再搜索、勾选两题并打开右栏。
- 预期：遵守冻结设计规则“空面板大小应服务于工作布局，不用空框填满页面”，空态只保留必要辨认和下一步动作。
- 实际：右侧渲染接近整个可用高度的白色边框面板，中间只有一行提示；右栏打开后仍为大空框。
- 证据：[desktop-account-b-isolated.png](desktop-account-b-isolated.png)、[desktop-scene-scroll-aux.png](desktop-scene-scroll-aux.png)。
- 责任：`B14@1`，题库桌面空态布局。

### B16-UI-002：真实写失败重复显示相同状态

- 前置：1440x900，新建题目已输入非空题面。
- 操作：在测试进程把真实 SQLite 连接设为 `query_only=ON`，再用页面“创建题目”按钮提交。
- 预期：一处清楚的“暂时无法确认是否保存”反馈，草稿和“重试确认”动作保留。
- 实际：同一句文案在底部状态行以灰色和红色并排重复显示。数据行和幂等记录正确地都未写入，恢复后原键重试只写入一次，故这是反馈呈现缺陷，不是持久化缺陷。
- 证据：[failure-sqlite-write-refused.png](failure-sqlite-write-refused.png)、[network.jsonl](network.jsonl)、[service-errors.jsonl](service-errors.jsonl)。
- 责任：`B14@1`，未确认保存状态呈现。

## 已通过的独立检查

| 范围 | 结果 | 独立观察 |
| --- | --- | --- |
| 首条真实流程 | PASS | 页面录题、公式预览、复制改编、草稿返回/刷新、备课环节取题、选择顺序、返回原处均为普通用户操作 |
| 真实网络与持久化 | PASS | 页面与正式 HTTP 同源；按 ID 读回原题、改编来源快照、备课两个引用；保留库重启和新浏览器上下文仍一致 |
| WB-010 | PASS | 列表滚动 422px 而题面区和整页保持 0；搜索、2 项多选、右栏模式和 AI 未发送草稿在切模块/刷新后恢复 |
| WB-011 | PASS | 本地存储拒写时显示“草稿无法保留，请先保存”和“复制输入”，在线保存可恢复 |
| B15 真故障 | PASS | SQLite 真拒写的 POST 返回 503，拒写期间业务行/幂等记录增量都为 0，恢复后原键重试增量各为 1 |
| 账户边界 | PASS | B 列表为空，读 A 的固定 ID 返回 404，B 不显示 A 的本地草稿 |
| 桌面与右栏 | PASS（除上述缺陷） | 1440x900 下右栏将主区宽度从 1184px 缩至 884px，不覆盖主区；出现动画 180ms，Esc 返回焦点 |
| 窄桌面 | PASS | 1100x800 下题目与右栏均可操作，整页横向溢出 0 |
| Pad | PASS | 768x1024 下列表/阅读、原题/改编题切换正确，右栏 696px 独占 696px 工作区，横向溢出 0，`prefers-reduced-motion` 下动画时长 0s |
| B12 公共责任 | PASS | 新空库、双账户、保留库重启、旧账户/布局升级、破损迁移失败退出、production 拒绝测试身份、构建不动用户库 |

## 证据与复现入口

- [run.json](run.json) 是场景结果、固定 SHA、端口、数据目录和视觉几何的机读入口。
- [network.jsonl](network.jsonl) 和 [service-requests.jsonl](service-requests.jsonl) 对应真实浏览器/服务请求；[service-errors.jsonl](service-errors.jsonl) 定位写拒绝。索引不含 Cookie 值或请求正文。
- [build.log](build.log) 是固定 SHA 的生产构建；[broken-migration.log](broken-migration.log) 和 [production-refusal.log](production-refusal.log) 是启动保护。
- 下一节点可在报告工作区根目录直接复跑：

```bash
B16_RUNTIME_ROOT=/home/liam_t/项目/TeacherWorkspace-b16/.scratch/B16/v1/candidate-run \
  node docs/acceptance/evidence/B16/v1/run-acceptance.mjs
```

固定候选的可运行副本、SQLite、账户文件与旧库迁移现场保留在 `.scratch/B16/v1/`。脚本使用 `47116/48116/49116`，内置 `old-database-upgrade` 检查先以旧账户/布局启动，再不 reset 重启并核对 `questions_`/`lessons_` 迁移。重跑会重置该 B16 隔离目录，不会读写用户库或原始候选目录。
