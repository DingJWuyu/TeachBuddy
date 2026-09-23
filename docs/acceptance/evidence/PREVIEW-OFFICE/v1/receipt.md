# PREVIEW-OFFICE@1 本机集成回执

**PASS / self。** `preview/usable-mvp` 已从固定起点 `066db5456e597ac9a43596260238b2dead374c59` 顺序引入 Pandoc 产品、测试和证据。当前用户入口为 **https://localhost:50880**，`teacherworkspace-preview.service` 保留 active/running。本回执只证明本分支集成与隔离回归，不代签 Word/WPS 真人验收。

## 固定合流

| 输入 | 本分支提交 | 处理 |
| --- | --- | --- |
| `431269d326f83fa8432bc29c3cd9579864d62447` | `58d45e76ae783ed57ecc3b5c3d4ca5829650fe16` | 产品修复；README 冲突逐段解决，保留现有预览服务说明并加入 DOCX/Pandoc 说明。 |
| `2a159af857e0c97c59ab10443657f877d5ddd39a` | `a2b063dc0883df39ca195eeebe6781ac0fe06ad4` | 精确公式数量测试。 |
| `7f9eb324e2415a826448c7a8006bfefcdd2cb681` | `d5f89f159c1c5e9b9d5d739ee47278765b0a67b7` | 完整报告与证据，见 [R34 Pandoc 报告](../../R34/v1/pandoc.md)。 |

本分支原有 TT-C7，因此未重复消费 `baaeb09973cd01848432622e35712b74627f4488`；未引入 `1d027414` 或 `7433f04` 组合准备提交。契约和根台账相对起点无改动。`MATERIALS_PANDOC_PATH` 写入 Git 忽略、权限 0600 的 `.scratch/preview/runtime.env`，复用报告指定的 Pandoc 3.11；既有 `MATERIALS_OFFICE_ROOT`、TLS、SMTP 配置保留。服务进程中两个转换器路径均已确认存在且可执行。

## 实际命令与结果

| 检查 | 命令与结果 |
| --- | --- |
| 依赖与隔离构建 | `npm ci --no-audit --no-fund` PASS。首次 `npm run build` 使用已满的系统 `/tmp`，隔离存储检查报 `SQLITE_FULL`；改用 `TMPDIR="$PWD/.scratch/preview-office/tmp" npm run build` 后 PASS。构建检查使用自建临时库。 |
| 关键材料输出 | `TMPDIR="$PWD/.scratch/preview-office/tmp" MATERIALS_PANDOC_PATH=<报告固定工具> MATERIALS_OFFICE_ROOT=<既有工具> R34_PANDOC_EVIDENCE="$PWD/.scratch/preview-office/evidence" node --test apps/api/test/materials-pandoc.test.js apps/api/test/materials-lessons.test.js apps/api/test/materials-protection.test.js`，**9/9 PASS**；含真实 HTTP 六题、24 份输出、公式读回、账户隔离、重启后制品保持与失败保护。测试库和制品均在本任务临时目录。 |
| 既有 TT-C7 | `TMPDIR="$PWD/.scratch/preview-office/tmp" node --test --test-name-pattern='TT-C7' apps/api/test/teaching-time-reminders.test.js`，**1/1 PASS**。 |
| 静态检查 | `git diff --check` PASS；契约与 `docs/plans/run-state.md` 相对起点无 diff。 |
| 服务切换 | `systemctl --user restart teacherworkspace-preview.service` 后 active/running；`curl --insecure https://localhost:50880/` 与 `/lessons` 均 HTTP 200；启动日志显示 11 项迁移跳过、六模块启用。 |

重启前已在 `.scratch/preview/backups/office-integration-20260922T2012Z/` 留下权限受限的 SQLite 在线备份、文件目录副本和运行配置副本。重启前后对**用户库只读**检查均为 `integrity_check=ok`、38 张表、1 个认证账户、4 个会话、1 个备课对象；持久文件目录原有 0 个文件，重启后仍为 0。未向用户库写测试数据，未迁走或重置库与文件。入口 HTTP 与数据库只读检查不能代替用户浏览器中的逐项操作验收。

产品模型请求 0，自动外发邮件 0；无 main 合并、push、公网部署或采购。后续 Agent 由根串行交接；Pandoc 独立验证与 Word/WPS 真人检查保留原归属。

```yaml
task: PREVIEW-OFFICE@1
attempt: 1
role: integration
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T20:15:06Z"
session_id: unavailable
runner: "Codex / gpt-6-sol / medium"
skills_used: [resolving-merge-conflicts, writing-for-agents]
base_revision: "066db5456e597ac9a43596260238b2dead374c59"
result_revision: "本回执所在提交；完整 SHA 由最终回调返回"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs: ["431269d326f83fa8432bc29c3cd9579864d62447", "2a159af857e0c97c59ab10443657f877d5ddd39a", "7f9eb324e2415a826448c7a8006bfefcdd2cb681"]
changed_files: ["README.md", "固定产品与测试提交文件", "固定 R34 证据", "docs/acceptance/evidence/PREVIEW-OFFICE/v1/receipt.md", "Git 忽略的预览运行配置"]
artifacts: ["docs/acceptance/evidence/R34/v1/pandoc.md", "本回执", "本机权限受限安全备份"]
checks: ["隔离构建 PASS", "材料输出 API 9/9 PASS", "TT-C7 1/1 PASS", "服务重启与两个入口 HTTP 200", "用户库只读完整性与记录数量重启前后一致"]
identity_mode: "预览服务 real-auth；定向 API 测试使用独立 test-principal 临时库"
open_items: ["Word/WPS 真人检查与独立 Pandoc 验证", "Agent 后续串行合流", "原 R35 外部未决项"]
failure_owner: null
next_condition: "根从本分支最终提交接手；服务继续运行，用户原有数据目录保持原位"
authorization_used: "用户 PREVIEW-OFFICE@1 attempt 1 任务包"
```
