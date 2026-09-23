# MANUAL-DATA-ACCEPTANCE@1 / attempt 1

**PASS，independent。** 固定组合的本机手动 DATA 能力通过实际验收；未发现实质数据、使用或安全缺陷。SUPPORT 偏好尚未接入，不计通过。此结论不包含目标物理设备、公网部署或暂停的 Agent 功能扩展。

```yaml
task: MANUAL-DATA-ACCEPTANCE@1
attempt: 1
role: acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-23 06:38:30 UTC"
session_id: "01a0ccef-a90d-74b0-b73b-b5aec2b42e2d"
runner: "Codex / gpt-6-astra / medium; Node 22.23.2; Chrome 152.0.7977.64; Linux"
skills_used: [code-review, writing-for-agents, diagnosing-bugs]
branch: review/manual-data
base_revision: "7aceca1f95bba95e7dccbae7cf144929b1fe90ad"
result_revision: "本提交:docs/acceptance/evidence/MANUAL-DATA/v1/independent.md"
review_target:
  fixed_point: "52a9c493242e1a82f87e55d1445288aa08c40467"
  commit_range: "52a9c493242e1a82f87e55d1445288aa08c40467...7aceca1f95bba95e7dccbae7cf144929b1fe90ad"
  standards: PASS
  spec: PASS
  aggregate: "本文件的 Standards 与 Spec"
internal_reviewers:
  - "standards / Codex / gpt-6-astra / medium / 继承调用 session / 只读"
  - "spec / Codex / gpt-6-astra / medium / 继承调用 session / 只读"
identity_mode: "real-auth，真实 Cookie/Page；fake-mail，无外部邮件"
failure_owner: null
changed_files:
  - docs/acceptance/evidence/MANUAL-DATA/v1/independent.md
  - docs/acceptance/evidence/MANUAL-DATA/v1/independent-evidence/*
authorization_used: "本次用户 MANUAL-DATA-ACCEPTANCE@1 / attempt 1 任务包"
next_condition: "SUPPORT 固定交付后只补其数据新增影响；部署和目标设备另行授权"
```

## 固定输入与隔离边界

- 产品组合：`7aceca1f95bba95e7dccbae7cf144929b1fe90ad`。读取同版 [DATA 作者回执](receipt.md) 与 [DATA 接入报告](../../MANUAL-INTEGRATION/v1/data.md)。受审增量提交为 `bcc2b0015b5edc072741d37cb7e0bf1353e00304`、`e06ad995ae61b76e351a6a3501a3af29d68f2b7f`、`7aceca1f95bba95e7dccbae7cf144929b1fe90ad`，没有重复其他模块 diff review。
- 手动可靠性依据：`31575c5c9d386c03a1f9fcde38b9a216f87a5b08:docs/contracts/reliability.md` 的 B/C/D/E 手动范围；认证恢复实现来源沿作者回执的 `627bf878d9b2ec57e8bc88a227337744c697a9ce`。本轮不改契约，也不追认 Agent 全工具集或专用核实界面。
- 所有产品运行均使用本次新建目录、随机端口、生成的自签 TLS 与 `@example.test` 邮箱。组合补验源目录为 `.scratch/manual-data-independent-20260923/combination-SQxxjR`，备份和新恢复目录为其 `-backup` / `-restored` 同级目录；HTTPS 随机端口 `41383` 在重启时保持同源。源进程及两次恢复进程 PID 见 [实际结果](independent-evidence/independent-results.json)。未读取或操作用户 50880 服务、库、备份、配置，未发外部邮件或模型请求。
- TMPDIR 使用本次独占 `.scratch/manual-data-independent-20260923/tmp`；Chrome 使用短路径 `/tmp/md-accept-jlRth5`。现成浏览器测试使用本次新建 `.tmp-md/run-JSnePq` 及其备份/恢复目录。全部服务正常停止后清理临时库、认证材料和浏览器 trace，仅保留下列必要证据。
- 既有其他模块回执及其未变边界沿用，本次没有重新签署题库识别、Office/课堂设备等其他模块验收。作者的旧 self 证据用于定位复跑入口，不冒充本轮 independent 结果。

## 实际验收

| 场景 | 操作与实际结果 | 证据 |
| --- | --- | --- |
| 当前组合构建 | `npm run build` 成功；API 存储检查及 Web 生产构建通过。Web 仅有既有大 chunk 提示。 | [build.log](independent-evidence/build.log) |
| 定向 API | 原 `reliability`、`auth-integration`、`first-flow-questions` 三套共 18/18 通过，无跳过。 | [api.log](independent-evidence/api.log) |
| 设置、误删、未知结果 | 原浏览器 E2E 1/1 通过：真实注册、自建/保存/删除题目，在设置刷新并恢复；导出受理响应丢失后刷新，以原键确认且只有一条导出。 | [browser-final.log](independent-evidence/browser-final.log) |
| 个人 ZIP 与离线阅读 | 额外正常 API 创建 1 题、2 份备课、原图资源、公式作品、班级、教学记录与有日期的课程安排。老师在设置点击恢复和导出、下载 ZIP。13 个对象、16 条关联、30 个 manifest 文件项全部长度/摘要一致；独立断网浏览器通过 `file://` 读备课正文、公式源码及关联资源。原 PNG 与上传字节相同。 | [真实 ZIP](independent-evidence/independent-personal.zip)、[设置页](independent-evidence/independent-settings.png)、[离线备课](independent-evidence/offline-lesson.png) |
| 原文件与关联保持 | 备课含题目、资源、数学作品三个快照；记录含题/课/作品三个来源；日程关联班级、课题及记录。新服务登录后逐一比较 10 个公开 GET 结果，完全一致；文件 content HTTP 下载字节与原图一致。 | [实际结果](independent-evidence/independent-results.json)、[补验脚本](independent-evidence/independent-flow.mjs) |
| CLI 停服、新目录恢复、激活 | 独立子进程收到 SIGTERM，关闭 HTTPS/SQLite 并退出 0 后执行真实 `backup`、`restore`、`activate` CLI，三条均退出 0。启动另一个进程使用新目录；随后再停服并普通重启。源 DB 与备份 DB 的哈希始终不变。 | [cli.log](independent-evidence/cli.log)、[实际结果](independent-evidence/independent-results.json) |
| 排序迁移和真实业务行 | 通过 `/api/modules/lessons/v3/order` 保存两份真实备课的顺序。源、备份、新恢复库的 15 张业务/迁移表行数和内容摘要全部相同；账本包含 `lessons_0003_order`，`lesson_order` 的版本和两个课题 ID 顺序保留。恢复后公开接口读回同值，页面显示同一顺序。没有用伪造 SQL 排序行替代公开 API 操作。 | [恢复后的备课](independent-evidence/independent-restored-lessons.png)、[表摘要](independent-evidence/independent-results.json) |
| 认证恢复 | 首次认证清理移除 2 个页面绑定、2 个会话、2 个容器、1 个挑战，remaining 全零；重开库第二次 removed/remaining 全零。旧 Cookie/Page 请求返回 401，旧浏览器落到登录页。使用备份中的密码正常登录，accountKey 和业务对象保持；新 Cookie 在普通进程重启后返回 200。 | [CLI 认证回执](independent-evidence/cli.log)、[实际结果](independent-evidence/independent-results.json) |
| 设备草稿和待上传文件 | 浏览器 E2E 验证旧 localStorage 输入及未确认请求移出活动命名空间，设置可查看；原资源文件下载字节一致，数学上传下载入口存在。额外组合流程在同源恢复后找回“恢复前尚未提交的配方教学想法”。这些输入是受控浏览器存储种子，用于检验恢复机制，不宣称新增云草稿能力。 | [原上传记录](independent-evidence/restored-login.png)、[组合恢复草稿](independent-evidence/independent-recovered-draft.png)、[browser-final.log](independent-evidence/browser-final.log) |
| 八类误删与安全失败 | 原 reliability 测试通过题目、备课、资源、作品、班级、记录、日程、收录的原接口恢复，班级先于独立删除记录，原 ID/关联保留。外账户及匿名下载拒绝、缺文件导出失败无下载、损坏备份及未知迁移拒绝、未激活恢复拒绝启动均通过。 | [api.log](independent-evidence/api.log) |
| WAL、原对话与旧意图 | 原 reliability 测试真实 CLI 备份包含已提交 WAL，源 DB/WAL 哈希不变。恢复后原对话存储字符串逐字节相同；恢复前未确认操作 reconcile 返回 409 `recovery-review-required`。只验这两个暂停 Agent 范围内的承诺。 | [api.log](independent-evidence/api.log) |

已查看本次生产页面截图和真实 ZIP，设置、恢复草稿与备课顺序可用，未见阻断操作的布局问题。离线页面区分快照与当前关联，提供 LaTeX/JSON 与原文件取回；不把它当作无损版式重排或账户覆盖导入。

个人 ZIP SHA-256：`6f1c6b457d25fe9055a1d37ec712c0d619279b3c64172e59385fc9843a488a7a`。构建日志仅规范化行尾空白；全部提交证据摘要见 [sha256.json](independent-evidence/sha256.json)。备份库含认证内部数据，只保留脱敏回执和摘要，不提交库或浏览器认证 trace。

## Standards

PASS，0 项实质发现。

只读助手依据 `AGENTS.md`、`docs/rules/design-and-verification.md`、`docs/plans/execution-protocol.md` 的实现及独立验收规则，检查导出、恢复 CLI、认证清理、维护锁、旧操作守卫、设备草稿隔离及公共接线，未发现可确认的数据、使用或安全标准违背。普通风格和 smell 未升级为缺陷。助手未运行产品、修改文件或代替实际验收；SUPPORT 偏好不计通过。

## Spec

PASS，0 项实质发现。

只读助手对照固定 reliability 手动契约，检查个人 ZIP 快照与离线阅读、八类原接口误删恢复、停服独占备份、新目录恢复及显式激活、认证清理、设备草稿隔离和旧 Agent 意图拒绝，未发现可确认的实质数据、使用或安全缺陷。`backup.js` 消费当前 lessons 迁移数组，包含 `lessons_0003_order`；整库备份保留其业务行。SUPPORT、Agent 专用核实 UI、目标设备及公网按任务边界分列。

双轴汇总：Standards 0 项、Spec 0 项，各轴均无最严重缺陷。两轴只读报告与本轮实际验收合为本回执，没有另派重复 diff review。

## 复跑与环境诊断

从固定受测 SHA 的仓库根运行。先准备本次独占短 TMPDIR 和 `.tmp-md` 父目录，运行期间不要共享测试数据：

```bash
mkdir -p .tmp-md
export TMPDIR="$(mktemp -d /tmp/md-accept-XXXXXX)"
npm run build
node --test apps/api/test/reliability.test.js apps/api/test/auth-integration.test.js apps/api/test/first-flow-questions.test.js
node_modules/.bin/playwright test --config apps/web/e2e/manual-data/manual-data.config.mjs
```

补充组合流程复用现成认证 harness、普通浏览器交互、业务 HTTP 和维护 CLI。把 [independent-flow.mjs](independent-evidence/independent-flow.mjs) 复制到本仓库下新建的隔离目录，从仓库根执行，避免把临时数据库写入证据目录：

```bash
mkdir -p .scratch
acceptance_run_dir="$(mktemp -d "$PWD/.scratch/md-independent-XXXXXX")"
cp docs/acceptance/evidence/MANUAL-DATA/v1/independent-evidence/independent-flow.mjs "$acceptance_run_dir/independent-flow.mjs"
TMPDIR="$TMPDIR" node "$acceptance_run_dir/independent-flow.mjs"
```

首次运行中的环境/样本失败已定位，不计产品通过证据：[诊断摘录](independent-evidence/environment-diagnostics.log)。长 TMPDIR 超过 Chrome Unix socket 路径限制；隐藏 `.scratch` 工作目录下的 `apps` 符号链接使 SPA `sendFile` 路径被 dotfile 规则忽略，刷新 `/settings` 得 404。改用短 TMPDIR、从实际仓库根运行并创建 `.tmp-md` 父目录后，同一原浏览器测试 5.8 秒通过，没有弱化断言或修改产品。补验样本按既有日程规则给关联记录配置具体课时，并用 questions v2 读取经 v2 恢复的题目；最终一次完整流程全部通过。以上均为执行输入校正，无产品修复。

## SUPPORT 剩余切片

拥有者为 SUPPORT 实现者及后续组合验收者。取得其固定交付后，仅补以下新增影响：

1. 核对真实偏好表结构与 DATA 导出读取形状，账户偏好进入个人包且不混入其他账户或认证秘密。
2. 核对新增迁移进入备份支持集合；当前尚不存在的迁移不能标通过。
3. 设置中保存实际偏好后导出，再停服备份、恢复/激活与正常登录，核对偏好值、版本、账户归属和新增接线影响；保留本轮未变业务证据。

目标设备、公网及暂停 Agent 扩展仍按用户指令暂缓。产品源码、原契约、原回执和注入 AGENTS 均未修改或提交；不合 main、不推送、不部署、不联系其他业务 session。
