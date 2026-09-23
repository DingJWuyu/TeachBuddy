# MANUAL-SUPPORT-ACCEPTANCE@1

结论：**FAIL / independent，已通过切片可复用，整批不放行。** 本轮未确认新增产品缺陷；设置、帮助、偏好、设备现场的下列实测范围及 SUPPORT-DATA 偏好接缝通过。新格式上传恢复后无法下载仍为已知未通过切片，未重复调查，不能由其余通过结果消除。

```yaml
task: MANUAL-SUPPORT-ACCEPTANCE@1
attempt: 1
role: acceptance
status: FAIL
verification_level: independent
finished_at_utc: "2026-09-23T07:08:30Z"
session_id: "01a0cd0e-799a-7932-a9ac-0baff07519cc"
runner: "Codex / gpt-6-astra / medium"
skills_used: [code-review, writing-for-agents, diagnosing-bugs]
base_revision: "655d4595b09328d3b3475bcb285b3582f99c8a0a"
result_revision: "本文件所在提交；产品候选保持 base_revision"
review_target:
  fixed_point: "66b81dfa2ccb5d65250f2f154fae7e1f0efab151"
  commit_range: "66b81dfa2ccb5d65250f2f154fae7e1f0efab151...655d4595b09328d3b3475bcb285b3582f99c8a0a"
  standards: PASS
  spec: PASS
  aggregate: "本文件 Standards / Spec；仅指本轮新增源码发现为零"
internal_reviewers:
  - "standards / Codex / gpt-6-astra / medium / 只读叶子"
  - "spec / Codex / gpt-6-astra / medium / 只读叶子"
identity_mode: real-auth
failure_owner: "新格式上传恢复接缝的既定 DATA/SUPPORT 修复实现者"
authorization_used: "用户 MANUAL-SUPPORT-ACCEPTANCE@1 任务包"
next_condition: "固定上传修复候选仅补该影响切片；本报告不等待该实现者"
```

用户给定候选是 39 位前缀；实际解析的 40 位提交如上。工作分支 `review/manual-support`；代码审查和所有产品实测均基于该提交。输入为 [SUPPORT 作者回执](receipt.md)、[集成回执](../../MANUAL-INTEGRATION/v1/support.md)，DATA 本体独立 PASS 输入为 `f009b63963f0443678557b10c489f11a01678b79`，未重跑 DATA 全套。产品代码只读，未操作用户 preview、真实邮件或产品 Agent；未合并 main、push 或部署。

## 已通过的独立实测

| 切片 | 实际检查与结论 | 证据 |
| --- | --- | --- |
| 构建 | 当前候选完整 `npm run build` 成功；隔离库应用 14 条迁移。现有大包提示仍在 | [build.log](independent-artifacts/build.log) |
| 设置、帮助、版本 | 1440×900、820×900 真实界面截图逐张核对。设置按内容分组，帮助目录与正文分开，支持页无业务 AI 右栏。正式发布为空、Git 提交单列，构建标识对应候选 | [截图目录](independent-artifacts/browser/)、[平板版本页补核](independent-artifacts/release-820-verified.png) |
| 连续正文与帮助现场 | 设置正文滚动到底部设备记录，顶栏边界不动；帮助选“保存失败、草稿与重开”后刷新保留目录项，正文入口可返回设置；版本标题宽度无溢出 | [layout.log](independent-artifacts/layout.log)、[几何记录](independent-artifacts/release-geometry.json)、[设备区截图](independent-artifacts/settings-device-820.png) |
| 偏好 | UI 保存大字号、减少动效，刷新、退出重登和服务重启后读回；独立浏览器登录读到同账户值。丢响应后按原键确认，版本冲突保留输入并可采用服务器值；匿名、输入校验、幂等及版本保护通过 | [browser.log](independent-artifacts/browser.log) |
| 设备现场 | 两标签页备课草稿隔离；模块往返及数学双标签页恢复；关闭标签后从设置选择原备课草稿；清理保留待确认、损坏原文和另一账户记录，清理失败不报成功，其他标签页不会把旧稿写回 | 同上 |
| 业务接线 | 日程保存/删除丢响应按原键确认，保存中后续输入不冒充已保存，旧稿不升级版本覆盖他处修改；班级输入和关联选择刷新保留；资源、题库、数学上传的原文件重选确认通过 | 同上；题库在整理模型启动前停止 |
| 前台重读 | 备课前台读取他处保存的新值；本地已修改时保留输入并显示对照 | 同上；此项明确派发标准 focus 事件，不声称覆盖物理设备切前台 |
| 数学预览 | 通过真实 UI 选“二次函数起点”并保存，再改预览 a=2.5、工具展开和导出格式，刷新保留；API 已保存 Source 的 a.initial 仍为 1 | [targeted.log](independent-artifacts/targeted.log) |
| SUPPORT-DATA | 两个真实注册账户的不同偏好经 UI 保存；甲账户个人 ZIP 只有一份甲偏好，manifest 版本 2，正文精确等于 API 的 version / values / updatedAt。停止隔离服务后执行真实 CLI backup → restore → activate，再从原端口启动恢复副本；旧登录失效，两账户重新登录后账户键、偏好值、版本、更新时间均保留；两行数据库内容及单条偏好迁移账本精确一致，recoveryId 改变 | [seam-result.json](independent-artifacts/seam-result.json)、[targeted.log](independent-artifacts/targeted.log)、[还原后界面](independent-artifacts/preferences-after-restore.png) |

通过计数：原 SUPPORT 18 个场景中首次通过 17 个，数学预览场景修正验收输入后定向 1/1 通过；另写偏好 DATA 接缝 1/1、布局补核 1/1。没有将首次失败日志改成全绿，也没有把源码审查冒充 E2E。

数学原测试默认“新建演示”自带参数 a；当前候选按 README 从空画布开始，直接保存显示失败，尚不能进入该测试的参数恢复断言。验收副本显式通过“作品与工具 → 二次函数起点”创建有效输入后，原有参数、导出和 Source 不变断言通过。产品及仓库原测试未修改；原测试与当前组合不适配，应由 SUPPORT 测试拥有者同步这一前提，不要求恢复旧演示默认内容。

## Standards

内部助手只读执行一次，固定范围 `66b81dfa...655d4595`。

- 标准硬违反：未发现本轮新增且需要阻断的问题。依据 `docs/rules/design-and-verification.md` 的独立布局、设备现场和如实报告要求，以及 `docs/contracts/workbench.md` 的账户隔离、原请求确认和迟到响应约束，检查了支持页、设备存储、前台刷新、共享保存及必要集成。
- 判断性 smell：无需要单独提出的可行动发现。不将重复路径校验、冻结序列化欠项或历史分支冗余扩大为重构要求。
- 偏好迁移进入备份支持集合，个人导出读取 `valuesJson` 并保留 version / values / updatedAt，未发现标准违反。
- 已知新格式上传恢复缺口未重复调查；冻结格式、全部滚动锚点和历史冗余限制仍有效。此轴结论不替代运行验收。

## Spec

内部助手只读执行一次；新增确认缺陷 0，未发现越界产品行为。

- 设置、帮助独立布局及真实发布信息符合 `docs/WORKBENCH_DESIGN.md:65` 和 `docs/PRODUCT_SCOPE.md:179`。
- 偏好使用可信账户、版本与幂等写入；导出读取实际值，备份包含偏好迁移，未发现值、版本或账户接缝的新增源码问题。
- 草稿分支、设备清理保护、原请求确认与前台重读基本符合 `docs/plans/tasks/reliability.md:49`、`docs/contracts/workbench.md:57`，未确认新的具体用户流程故障。
- F63 完整现场恢复仍仅部分覆盖；冻结格式、全部滚动锚点、历史冗余及上传恢复未通过沿原回执保留。候选不存在 `docs/contracts/reliability/`，本次依据实际 F63、产品范围、工作台设计与契约核查，不声称核对了缺失目录中的冻结细节。

双轴汇总：Standards 新增发现 0，Spec 新增发现 0；两轴均不消除既有上传阻断或原回执覆盖限制。

## 未通过切片与接续

**新格式上传恢复后无法下载：保持 FAIL，未重跑。** 集成回执已有最小复现：当前账户新分支上传文件及 pending 指针，经停服 backup / restore / activate 后重登；旧请求未重放、指针已归档，但设置“查看恢复前上传”缺原文件下载按钮。原字节仍在 IndexedDB。位置、归属与现场以[集成回执](../../MANUAL-INTEGRATION/v1/support.md#必须由实现者修复的阻断)为准。

后续在固定修复候选补查新格式资源、数学和题库上传的原文件可下载且字节一致，旧请求不自动重放，账户及恢复点隔离保持。若修复仅触及该归档/读取切片，本轮偏好、导出、停服恢复和支持布局结论可按未受影响范围复用；不得以本报告签整批 PASS。

尚未覆盖：物理 Pad/另一物理设备、全部滚动稳定锚点、冻结 DraftEnvelope/Scene 完整格式、历史分支最终去冗余及暂停中的外部 AI 能力。本次独立浏览器验证不等于物理跨设备验收。

## 复现与隔离材料

必要脚本与日志在 [independent-artifacts](independent-artifacts/)。`support.spec.mjs` 是候选现有 E2E 的验收副本，仅改变 import/截图路径及上述数学输入；`seam.spec.mjs`、`layout.spec.mjs` 为本轮独立检查。运行前安装依赖并构建候选，然后执行：

```bash
mkdir -p .tmp-ms /tmp/msa-655d
TMPDIR="$PWD/.tmp-ms" npm run build
TMPDIR=/tmp/msa-655d npx playwright test -c docs/acceptance/evidence/MANUAL-SUPPORT/v1/independent-artifacts/playwright.config.mjs
```

服务均用独立随机 loopback HTTPS 端口、真实 Cookie 注册/登录及本地 fake-mail；库和文件在本树 `.tmp-ms/`，Chrome 临时目录为 `/tmp/msa-655d`。恢复实测用 `37171` 端口，恢复前后路径记录在 seam-result.json。原 50880 preview 与用户资料未触碰。chrome-devtools-axi 独立 session 启动成功，但 ref 持续失效、run 返回 `fn is not a function`，界面流程和截图由独立 Playwright Chrome 完成。

首次 Chrome 因本树长路径导致 Unix socket 过长，在短隔离 TMPDIR 后正常；接缝脚本初版错误假设导出文件名含 preferences，后改为按 manifest.dataPath 读取实际 `{kind,value}`。这些为验收工具前提错误，不计产品缺陷。原始中间日志保留在 `.tmp-ms/`。

整批未通过，按任务规则保留隔离库、还原副本、原始失败记录及临时进度；本轮持续服务和专用浏览器已停止。提交仅含本文件及必要证据，用户注入 AGENTS.md 保持未提交，产品文件无改动。
