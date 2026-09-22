# PREVIEW-AGENT-INTEGRATION@1 attempt 1

**https://localhost:50880 已接入真实 Agent，服务保持运行。** 本分支从 `64fd3a74e579cda6c1b94221d1835a7ed89d9162` 合入固定候选 `fa863234a185ab3b09f0dfcef494a0903f6d69cc`。Git 自动合流产品代码，README 唯一冲突保留预览运行说明并更新 Agent 状态。预览服务继续使用原 SQLite、文件目录、TLS、SMTP 和 50880；服务端从 Git 忽略的 `.env` 读取既有 Provider 配置，权限 0600。启动脚本仅增加 `--env-file=.env`，权限 0700。配置加载不触发模型请求。

## 可用范围

- 真实 Cookie 账户登录后，首页和六模块共享 AI 右栏。持久对话、历史、草稿、SSE 恢复、引用和工具卡均已接线。
- 固定 13 个题库、备课工具连接当前题目 v2 和备课 v3 业务端口。混合文档的元数据及未知版本保护沿用来源候选。
- 服务端开放 `deepseek/deepseek-v4.1-flash` 和 `z-ai/glm-5.3-flash` 两个模型。只在用户发送时请求 Provider；本轮自动真实模型请求为 **0**，自动外发邮件为 **0**。来源的真实模型验证及 6 次请求账本见 [PREVIEW-AGENT 回执](../../PREVIEW-AGENT/v1/receipt.md)。本轮两项模型历史测试仅重开旧结果。
- 原 Pandoc 输出、TT-C7 测试修复和输出面板加载边界保留。输出刷新及 6 份成果回归通过。

## 集成验证

| 检查 | 结果 |
| --- | --- |
| 依赖及构建 | `npm ci`、`npm run build` 通过；保留 Vite 大 chunk 提示。[构建日志](build.log)。 |
| API | 独立库及短 TMPDIR，`npm run test:api` **333/333**，无失败。[日志](api.log)。 |
| Agent 浏览器 | 独立 SQLite、假邮件、真实注册与 Cookie、无真实 Provider；草稿跨首页和右栏及刷新、双页冲突、SSE 断线、原键重试、题目手工冲突等 **7/7**。[日志](agent-browser.log)。 |
| 历史及引用 | 来源 DeepSeek、GLM 保留库各复制到独立服务，无模型请求；历史工具卡与实际题目、备课在 1440、820、390 宽度回读 **2/2**。[日志](history-browser.log)。 |
| 输出刷新 | 独立库、真实身份、Pandoc 与 Office；刷新加载、选项、旧下载、六份 DOCX/PDF、拒绝及恢复 **2/2**。[日志](output-browser.log)、[结果](output/flow-result.json)。 |
| 生产服务 | `teacherworkspace-preview.service` active/running；`/`、`/api/health`、`/lessons` 均 HTTP 200，未认证 Agent 配置 HTTP 401。服务启动读取 `.env`，配置含密钥、固定地址和两种允许模型；无自动请求。 |
| 原数据 | 重启前受限在线 SQLite 备份完整性 `ok`；重启后原 37 张业务表结构及内容相同，新增 2 张 Agent 表，迁移台账 18→19。原 `runtime.env` 与外部 TLS/SMTP 字节未变，文件目录未清理。[核对记录](service-data.json)。 |

备份位于 `.scratch/preview/backups/agent-integration-20260922T205727Z/`，包含 SQLite 在线快照、文件、原运行配置和受限外部 TLS/SMTP 副本；目录 0700、秘密文件 0600。测试使用 `/home/liam_t/pa-tmp`，不读写预览用户库。来源证据与原预览证据保留。

## 未决

- 本轮没有重开真实模型窗口；来源 DeepSeek 的首次环节放置错误已在来源自验纠正，模型后续输出仍须核对业务页面。本轮启用配置只证明服务可加载与模型列表匹配，不把零请求测试写成新一轮模型效果验收。
- 新建备课不先保存而直接取题可能留下旧草稿；体验路径先保存课题。详见 [输出恢复回执](../../PREVIEW-EXPORT-RECOVERY/v1/receipt.md)。
- Word/WPS 真人门禁、目标设备、在线采集、真实外部邮件和完整 F60/F61/F62 能力仍未验收。本预览不是完整 MVP 验收。

```yaml
task: PREVIEW-AGENT-INTEGRATION@1
attempt: 1
role: integration
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T21:04:50Z"
session_id: unavailable
runner: "Codex / gpt-6-sol / medium"
skills_used: [writing-for-agents]
base_revision: "64fd3a74e579cda6c1b94221d1835a7ed89d9162"
result_revision: "本回执所在提交 SHA 见任务返回"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "fa863234a185ab3b09f0dfcef494a0903f6d69cc:docs/acceptance/evidence/PREVIEW-AGENT/v1/receipt.md"
  - "fa863234a185ab3b09f0dfcef494a0903f6d69cc:docs/acceptance/evidence/PREVIEW-AGENT/v1/changed-files.txt"
  - "395d4931fc0f298948d16c12f7a919e4b77541e0"
changed_files:
  - "固定 Agent 候选合流文件及证据"
  - README.md
  - "docs/acceptance/evidence/PREVIEW-AGENT-INTEGRATION/v1/"
  - "Git 忽略：.env、.scratch/preview/start.sh"
artifacts:
  - "本回执、构建/API/浏览器日志、截图与服务数据核对 JSON"
  - ".scratch/preview/backups/agent-integration-20260922T205727Z/，受限备份"
checks:
  - "npm run build PASS；API 333/333"
  - "真实认证 Agent 浏览器 7/7；无模型历史回读 2/2"
  - "Pandoc 输出恢复浏览器 2/2"
  - "同一服务 active/running；3 入口 200；原业务数据未变"
identity_mode: "真实 Cookie 注册/登录，独立库假邮件；生产库未用于测试"
product_model_requests: 0
external_mail: 0
open_items:
  - "新模型效果未在本轮重验；模型写入须核对业务页面"
  - "直接取题新建草稿旧限制、Word/WPS 真人门禁及完整 F60/F61/F62 未决"
failure_owner: null
next_condition: "打开 https://localhost:50880，以现有真实账户或 UI 注册后体验首页及右栏；服务保持运行"
authorization_used: "用户 PREVIEW-AGENT-INTEGRATION@1 attempt 1：独占体验分支、固定候选合流、受限配置、构建和重启同一服务、分支提交；无 main 合并/push/公网部署"
```
