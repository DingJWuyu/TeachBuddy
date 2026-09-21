# B16@1 attempt 2 首条流程独立验收

```yaml
task: B16@1
attempt: 2
role: acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-21T22:58:21Z"
session_id: unavailable
runner: "Codex，gpt-5.6-sol high"
skills_used:
  - writing-for-agents
base_revision: "72ad4a58127b6ed2b2e94c4ce3a5f3f5e8a716df"
result_revision: "受测候选 612f0a9868743a1d5eea7e6f236d3ff903752439；产品代码 723ec00ee47599517302fcdcf61226500c82de0b；报告与新证据位于 review/b16-first-flow:docs/acceptance/evidence/B16/v1/attempt2.md 及 attempt2/"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "72ad4a58127b6ed2b2e94c4ce3a5f3f5e8a716df:docs/acceptance/evidence/B16/v1/review.md（attempt 1 报告与 B16-UI-001/002）"
  - "612f0a9868743a1d5eea7e6f236d3ff903752439（detached 只读受测候选；产品代码祖先 723ec00ee47599517302fcdcf61226500c82de0b）"
  - "612f0a9868743a1d5eea7e6f236d3ff903752439:docs/acceptance/evidence/B14/v1/attempt2.md（作者 self 回执，仅作定位输入）"
  - "612f0a9868743a1d5eea7e6f236d3ff903752439:docs/acceptance/{mvp-matrix.md,first-flow.feature}"
  - "612f0a9868743a1d5eea7e6f236d3ff903752439:docs/{ux/first-flow.md,rules/design-and-verification.md,plans/execution-protocol.md}"
changed_files:
  - "docs/acceptance/evidence/B16/v1/attempt2.md"
  - "docs/acceptance/evidence/B16/v1/attempt2/run-acceptance.mjs"
  - "docs/acceptance/evidence/B16/v1/attempt2/{run.json,acceptance.log,install.log,build.log}"
  - "docs/acceptance/evidence/B16/v1/attempt2/{network.jsonl,service-requests.jsonl,service-errors.jsonl}"
  - "docs/acceptance/evidence/B16/v1/attempt2/{broken-migration.log,production-refusal.log}"
  - "docs/acceptance/evidence/B16/v1/attempt2/*.png"
artifacts:
  - "attempt2/run.json：完整候选 SHA、产品代码 SHA、隔离路径、端口、账户、11 项结果和视觉几何"
  - "attempt2/network.jsonl：真实浏览器脱敏网络索引，包含 SQLite 拒写的 503 与恢复重试"
  - "attempt2/service-{requests,errors}.jsonl：真实服务请求及 SQLITE_READONLY 错误索引"
  - "attempt2/desktop-*.png、narrow-desktop-aux.png、pad-*.png：桌面、窄桌面与 Pad 实际截图"
  - "attempt2/failure-*.png、attempt2/recovered-*.png：本地存储与 SQLite 拒写/恢复对照"
  - "attempt2/install.log、build.log、broken-migration.log、production-refusal.log：锁文件安装、生产构建和启动保护"
checks:
  - "B16-UI-001：PASS；1440x900 空库和多选未打开题目均不再绘制近整屏白色边框空框"
  - "B16-UI-002：PASS；真实 SQLite 503 后结果未确认文案只出现一处，草稿与重试动作保留"
  - "普通页面录题 -> 复制改编 -> 备课取题 -> 返回 -> 刷新 -> 保留库 API 重启 -> 新浏览器上下文：PASS"
  - "WB-010 搜索、多选、独立滚动、右栏和未发送 AI 草稿切模块/刷新恢复：PASS"
  - "WB-011 浏览器 localStorage 拒写、明确警告及在线保存恢复：PASS"
  - "SQLite query_only 拒写：HTTP 503，业务行/幂等记录均不增；恢复后原键重试各增加 1：PASS"
  - "教师 B 列表为空、读取教师 A 固定 ID 为 404、无教师 A 本地草稿：PASS"
  - "1440x900、1100x800、768x1024：分区、滚动、右栏、对照切换、横向溢出、180ms 动画与 reduced-motion：PASS"
  - "旧账户/布局升级、questions/lessons 迁移、破损迁移非零退出、production 拒绝 test-principal、隔离构建：PASS"
identity_mode: "test-principal（服务端绑定 fixture-teacher-a / fixture-teacher-b，页面不能选择 principal）"
open_items:
  - "real-auth、会话寿命、退出与真实账户交接仍属 A11/A12，本回执不证明"
  - "真实 AI 消息、数学/Office/文件、部署与备份不在 B16 范围"
failure_owner: null
next_condition: "下游固定消费 612f0a9868743a1d5eea7e6f236d3ff903752439；从报告工作区运行 attempt2/run-acceptance.mjs，迁移检查由其中 old-database-upgrade 在 .scratch/B16/attempt2/data/legacy 执行"
authorization_used: "用户 B16@1 / attempt 2：固定候选只读复验，允许复制/最小适配旧脚本、构建、安装既有免费依赖和真实浏览器操作；提交新报告/证据；不合 main、不 push、不部署、不改产品/契约/作者证据"
```

## 结论

**PASS**。固定受测候选为 `612f0a9868743a1d5eea7e6f236d3ff903752439`，产品代码为其祖先 `723ec00ee47599517302fcdcf61226500c82de0b`。两者之间只增加 B14 attempt 2 回执和证据，没有产品代码变化。受测候选的 tracked 工作区在构建和验收后保持干净。

B16-UI-001/002 均已关闭；原脚本在新 SHA 上完成 11 项检查，真实链路、持久重启、双账户隔离、SQLite 拒写恢复、旧库迁移、启动保护及桌面/窄桌面/Pad 回归全部通过。身份仍为 `test-principal`，本结论不冒充真实认证验收。

## 两项缺陷闭环

| 缺陷 | 复验入口 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| B16-UI-001 空题面区大空框 | 1440x900 下分别打开教师 B 空题库，以及教师 A 搜索后多选两题但不打开题目 | 右侧仅显示网格工作区和居中下一步提示，没有白色边框/阴影空框；打开右栏后仍不复现 | [空库](attempt2/desktop-account-b-isolated.png)、[多选与右栏](attempt2/desktop-scene-scroll-aux.png) |
| B16-UI-002 重复未确认文案 | 在真实运行服务把 SQLite 连接切为 `query_only=ON`，通过页面创建题目 | POST 返回 503；页面仅一处“暂时无法确认是否保存”，保留草稿和“重试确认”；拒写时业务行/幂等记录增量均为 0，恢复后原键重试增量各为 1 | [拒写](attempt2/failure-sqlite-write-refused.png)、[恢复](attempt2/recovered-sqlite-write.png)、[网络](attempt2/network.jsonl)、[服务错误](attempt2/service-errors.jsonl) |

## 实际检查结果

| 范围 | 结果 | 独立观察 |
| --- | --- | --- |
| 首条真实流程 | PASS | 普通浏览器操作录题、公式预览、复制改编、刷新续草稿、备课环节按选择顺序取题、返回原处；新上下文读回同一题目、改编来源快照和备课引用 |
| 持久重启 | PASS | 保留 `.scratch/B16/attempt2/data/primary` 数据重启 API 后按原 ID 读回，之后新建浏览器上下文仍一致 |
| WB-010 | PASS | 列表滚动 422px，题面区和整页滚动均为 0；刷新后滚动仍为 422px，搜索、2 项多选、右栏模式和 AI 草稿均恢复 |
| 本地存储失败 | PASS | 拒绝 `tb.workbench.v1` 写入后显示“草稿无法保留，请先保存”和复制输入入口，在线保存随后成功 |
| SQLite 写失败 | PASS | 真实 `SQLITE_READONLY` 对应 HTTP 503，无业务/幂等部分写；恢复后原键仅写一次 |
| 账户隔离 | PASS | 教师 B 列表为空，读取教师 A 题目为 404，教师 B 不显示教师 A 草稿 |
| 桌面视觉 | PASS | 1440x900 右栏将主区从 1184px 缩至 884px且不覆盖；空态和拒写反馈闭环；出现动画 180ms |
| 窄桌面 | PASS | 1100x800 下题目与右栏可同时操作，页面横向溢出为 0 |
| Pad | PASS | 768x1024 下列表/阅读/原题对照分区正确，右栏 696px 独占 696px 工作区，横向溢出为 0，reduced-motion 动画时长 0s |
| B12 公共责任 | PASS | 空库、两账户、保留库重启、旧账户/布局升级、questions/lessons 迁移、破损迁移退出、production 测试身份拒绝和隔离构建均通过 |
| 生产构建 | PASS | 锁文件依赖安装无漏洞报告，构建 exit 0；API 构建使用 `/tmp` 隔离库，未在产品源码路径生成用户数据库 |

12 张本轮截图已逐张复核，未观察到新的明显布局、溢出或反馈退化。`run.json` 的 11 项均为 PASS，`failure` 为 `null`。

## 下游运行与迁移入口

受测候选已有本轮安装和构建产物。完整重跑会重置 `.scratch/B16/attempt2/data` 及本轮同名证据，不影响 attempt 1 的 `docs/acceptance/evidence/B16/v1/` 文件或 `.scratch/B16/v1` 失败现场：

```bash
cd /home/liam_t/项目/TeacherWorkspace-b16
B16_RUNTIME_ROOT=/home/liam_t/项目/TeacherWorkspace-b16-candidate2 \
  B16_CANDIDATE_SHA=612f0a9868743a1d5eea7e6f236d3ff903752439 \
  node docs/acceptance/evidence/B16/v1/attempt2/run-acceptance.mjs
```

- [run.json](attempt2/run.json) 是本轮机读入口，记录固定候选、产品代码、端口、数据目录、账户、逐项结果和几何值。
- 迁移入口是同一脚本的 `old-database-upgrade`：先在 `48216` 以旧认证模式建立账户和布局，再以 `reset: false`、`test-principal` 重启，核对旧数据及 `questions_`/`lessons_` 迁移。
- 保留现场位于 `.scratch/B16/attempt2/data/{primary,legacy}`。真实浏览器服务端口是 `47216`，旧库升级端口是 `48216`，启动失败检查端口是 `49216`。
- 网络与服务索引不含 Cookie、Authorization、Bearer、token、密码或请求正文。
