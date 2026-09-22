# R34-PICKER-DRAFT@1 attempt 1

PASS，自验级别 `self`。老师新建课题和环节后可以直接从题库取题并采用，再次新建不会恢复旧环节或旧待确认请求。创建结果未知时仍保留原键、原请求及后续输入；确认后后续输入转移到已创建备课，继续保存更新同一份备课。

## 固定交付

- main 起点：`2115bd01617d8a724a5609460522a048fdd3880f`。
- 产品来源：`64fd3a74e579cda6c1b94221d1835a7ed89d9162`。引入产品树、构建依赖、材料 UX/契约与运行所需固定 schema，来源提交为 `341fb033`、`1eb3d6fd`。根 DAG、run-state、run-inputs 与 main 原基线字节一致。
- **最小可摘取产品提交：`3f9feab3228888a788c81ea77160716084537911`**，仅三个前端文件；当前固定预览来源可直接摘取此提交，不应重复摘取前置来源导入。
- 浏览器回归提交：`4c79d17c17ff78f0a5ef4fb39217113c20db5d5c`。
- 分支：`fix/r34-picker-new-draft`。未合 main、push、部署或修改正在使用的预览树。

## 根因与修复边界

真实浏览器先复现后诊断。创建 POST 返回 201 后，取题入口立即导航并卸载新建页面；保存成功只更新 React 状态，清理草稿依赖的 effect 没有机会执行。存储探针显示 `lesson:new` 最后仍为 `saving`，没有成功清除；再次新建读取它后显示 `unconfirmed`。这证明了原观察中的导航时序线索，排除了清错已有备课键和取题返回重写旧请求。

`useSavableDocument` 在返回成功前同步持久化最新确认状态，并在卸载时使旧请求序号失效。`checkpoint` 仅在目标草稿已成功写入、没有 pending 且目标为已确认 ID 时迁移当前草稿。取题入口和新建页面使用该迁移保留创建期间的新输入。

相关失败恢复另复现了“创建响应丢失后修改课题，原键确认后再保存产生两份备课”。新建路由在确认后把后续输入交给已创建对象，刷新及再保存后仍只有一份。没有清理全部草稿或要求额外手动保存。公共契约、认证、Agent、Pandoc 与既有输出加载边界没有新增修改。

## 原始证据

| 场景 | 结果与证据 |
| --- | --- |
| 正常路径原始红灯 | 7.2 秒，第二次新建应为 0 环节，实际 1；显示“重试确认”。[原始日志](picker-draft/red/test.log)、[断言上下文](picker-draft/red/failure-context.md)、[截图](picker-draft/red/new-draft.png)、[浏览器存储与可见文字](picker-draft/red/result.json)。 |
| 原因探针红灯 | 相同路径再次失败；201 创建成功，但 new 键没有成功后的 remove。[存储写入及响应](picker-draft/red-probe/result.json)、[日志](picker-draft/red-probe/test.log)。探针仅用于浏览器测试，已从回归代码移除。 |
| 创建失败恢复红灯 | 原键确认后的再次保存产生 2 份备课，预期 1。[日志](picker-draft/recovery-red/test.log)、[请求及现场](picker-draft/recovery-red/create-recovery.json)。同轮采用失败用例另有错误提示定位不匹配，已按真实提示修正，未改产品文案。 |
| 正常路径绿灯 | 连续两次新建直接取题、采用；新建为空白普通保存入口。刷新两份备课，标题、环节和引用各自保留，数据库恰为 2 份。[新建截图](picker-draft/green/new-draft.png)、[结果](picker-draft/green/result.json)。 |
| 创建未知结果 | 丢弃真实 POST 成功响应，编辑课题后刷新，原键原 body 确认；再刷新仍保留新输入，保存后数据库仅 1 份。[请求及现场](picker-draft/green/create-recovery.json)。 |
| 采用未知结果 | 丢弃真实 PUT 成功响应，取消取题回文稿后刷新，原键原 body 确认；再刷新只有 1 个引用。[请求及现场](picker-draft/green/adopt-recovery.json)。 |
| 账户隔离 | 甲保留未保存课题/环节，切乙新建为空白并保存；再登录甲恢复其草稿且看不到乙备课。[现场](picker-draft/green/account-drafts.json)。 |
| 迟到响应 | 创建已受理但延迟返回，离页重开并继续输入；旧响应到达不改变新建现场，刷新保留原请求和新输入，确认并保存后仅 1 份。[现场](picker-draft/green/late-response.json)。 |
| 输出恢复保护 | 既有“输出现场刷新恢复”用例通过；新回归中已有课题打开输出再刷新也通过。没有重跑六输出/Office/Pandoc 无关阶段。 |
| 工程检查 | [构建](picker-draft/build.log)通过，保留来源已有的大 chunk 提示；`git diff --check` 通过。最终 [6 项 E2E](picker-draft/green/test.log)全部通过，13.6 秒。无 UI 单元测试。 |

归档构建日志和断言上下文仅去除行末空格，输出内容未改写。截图已实际查看：第二次新建没有旧环节或待确认状态，布局保持现有产品样式。

## 精确复现入口

在本 worktree 使用 Node.js 22.23.2，安装依赖后运行：

```bash
mkdir -p /home/liam_t/r34tmp
export TMPDIR=/home/liam_t/r34tmp
npm ci
npm run build
export PICKER_DRAFT_EVIDENCE="$PWD/docs/acceptance/evidence/R34/v1/picker-draft/recheck"
node node_modules/@playwright/test/cli.js test \
  --config apps/web/e2e/fixtures/materials-integration/playwright.config.mjs \
  materials-integration-picker-draft.spec.js materials-integration-export-recovery.spec.js \
  --grep '未手动|创建响应|采用响应|账户切换|迟到创建|输出现场刷新恢复' \
  --output=.scratch/r34-picker/recheck
```

最小循环只保留 `materials-integration-picker-draft.spec.js --grep 未手动`。要复验红灯，在另一个隔离 worktree 的固定来源产品基线 `1eb3d6fdee6353b8ecb4aa35529dc361be1b8528` 上只引入回归测试提交并构建，即可由第二次新建的旧环节断言抓到原症状。

每个用例自建随机端口 HTTPS、独占 SQLite/文件目录、全新 Chrome context；通过真实注册 UI 建立 Cookie 会话，验证码只进入进程内 fake-mail。测试程序关闭浏览器 context 和专用服务。没有连接 50880，没有读取真实凭据，没有产品模型请求或外发邮件。首次本地安装使用 `--ignore-scripts` 后缺 SQLite native binding，执行 `npm rebuild better-sqlite3 esbuild` 解决；补齐固定来源 runtime schema 后构建通过，均为环境准备问题。

## Standards

PASS，0 项文档规则违规，0 项值得报告的 smell。三处产品变更围绕保存确认、草稿迁移和离开后的响应处理，职责集中；持久化逻辑复用既有实现。新增回归通过真实控件与隔离服务验证可观察结果，无 UI 单元测试或固定 sleep。提交遵循 Conventional Commits。

## Spec

PASS，0 项发现。确认前后状态满足 U-M7 的原键、原请求、新输入及账户分区要求；迁移仅作用于当前账户的已确认创建，后续保存更新同一对象。卸载时失效旧请求防止迟到响应影响重开的草稿。四文件没有扩展到公开契约、认证、Agent、转换或根台账。

两轴分别 0 项发现，固定范围 `1eb3d6fdee6353b8ecb4aa35529dc361be1b8528...4c79d17c17ff78f0a5ef4fb39217113c20db5d5c`。内部 reviewer 只读，继承调用 session 模型与 effort；该结论不替代外层独立验收。

## 未决与交接

本次授权修复无未决。既有 Word/WPS 真人门禁保持原状态，本轮未验证。当前在线体验版仍是用户原服务，需外层在授权后摘取产品提交并更新预览。

本任务临时库、Chrome 数据和重复采集目录已清理，正式红绿证据保留；原 `PREVIEW-EXPORT-RECOVERY` 未解观察及其他目录未删除或改写。专用测试服务均已结束。

```yaml
task: R34-PICKER-DRAFT@1
revision: 1
attempt: 1
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T21:09:05.024803+00:00"
session_id: "01a0cae8-0631-70b3-8a2b-10bd46fbd787"
runner: "Codex / gpt-6-astra / low"
skills_used: [diagnosing-bugs, implement, writing-for-agents, code-review]
base_revision: "2115bd01617d8a724a5609460522a048fdd3880f"
source_revision: "64fd3a74e579cda6c1b94221d1835a7ed89d9162"
result_revision: "3f9feab3228888a788c81ea77160716084537911 产品；4c79d17c17ff78f0a5ef4fb39217113c20db5d5c 回归；本回执提交见最终返回"
review_target:
  fixed_point: "1eb3d6fdee6353b8ecb4aa35529dc361be1b8528"
  commit_range: "1eb3d6fdee6353b8ecb4aa35529dc361be1b8528...4c79d17c17ff78f0a5ef4fb39217113c20db5d5c"
  standards: PASS
  spec: PASS
  aggregate: "本回执 Standards / Spec，两轴各 0 项发现"
internal_reviewers:
  - "standards；Codex / gpt-6-astra / low；继承；只读叶子"
  - "spec；Codex / gpt-6-astra / low；继承；只读叶子"
inputs:
  - "固定来源 PREVIEW-EXPORT-RECOVERY/v1/receipt.md 范围外观察及 new-draft-observation"
  - "docs/ux/materials.md U-M5/U-M7；docs/contracts/workbench/materials.md"
changed_files:
  - apps/web/src/features/workbench/useSavableDocument.js
  - apps/web/src/features/lessons/useLessonPickerFlow.js
  - apps/web/src/features/lessons/LessonDetail.jsx
  - apps/web/e2e/materials-integration-picker-draft.spec.js
  - docs/acceptance/evidence/R34/v1/picker-draft.md
  - docs/acceptance/evidence/R34/v1/picker-draft/
artifacts: ["picker-draft/red/", "picker-draft/red-probe/", "picker-draft/recovery-red/", "picker-draft/green/", "picker-draft/build.log"]
checks:
  - "真实浏览器原始红灯及同路径绿灯"
  - "最终6项浏览器用例通过，13.6秒"
  - "npm run build；git diff --check；根台账与main基线一致"
identity_mode: "real-auth / isolated HTTPS / in-process fake-mail"
product_model_requests: 0
external_mail: 0
open_items: []
failure_owner: null
next_condition: "外层摘取3f9feab3；按本回执命令复验；预览更新另由外层授权执行"
authorization_used: "本轮用户R34-PICKER-DRAFT@1 attempt1任务消息：独立环境、分支提交、内部审查；禁止main合并/push/部署"
```
