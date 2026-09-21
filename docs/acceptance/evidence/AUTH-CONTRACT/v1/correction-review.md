# AUTH-CONTRACT/v1 限定修订独立审查

```yaml
task: AUTH-CONTRACT-FINAL-REVIEW@1
attempt: 1
role: design-review
status: PASS
verification_level: independent
finished_at_utc: "2026-09-21 21:18:43 UTC"
session_id: unavailable
runner: "Codex，gpt-5.6-sol high"
skills_used:
  - writing-for-agents
base_revision: "618ecaf6525f39bd5c74999d3652719509276e17"
result_revision: "6f3003250d170b44e89f6ac9b0a74f91d658a357：固定受审修订候选"
report_revision: "由只新增本文件的报告提交记录；外层以本 session 回执的完整 SHA 为准"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "固定工作区输入 618ecaf6525f39bd5c74999d3652719509276e17"
  - "差异起点 7b86b03fb51fa317dc2fade3b1319a53db9247de"
  - "受审候选 6f3003250d170b44e89f6ac9b0a74f91d658a357"
  - "原独立审查 092d7c89cb1386e913ef245a0a6370bede141947:docs/acceptance/evidence/AUTH-CONTRACT/v1/review.md"
  - "修订回执 2b1e9226156bfc0bc57e5b68d97231878dd701e3:docs/acceptance/evidence/AUTH-CONTRACT/v1/correction.md"
changed_files:
  - docs/acceptance/evidence/AUTH-CONTRACT/v1/correction-review.md
artifacts:
  - docs/acceptance/evidence/AUTH-CONTRACT/v1/correction-review.md
checks:
  - "openapi-spec-validator 0.9.0：认证 1.0.0-rc.2 与工作台 0.1.0-candidate.2 均 OK"
  - "独立 Draft 2020-12 校验：认证 64 schemas/8 operations/43 处绑定样本，工作台 47 schemas/15 operations/128 处绑定样本全部通过"
  - "AUTH-CR-001：认证 8/8、工作台 15/15 操作各有唯一必填 PageContext；8 个负例全部拒绝；身份样本 accountKey 一致"
  - "AUTH-CR-002：I03 503 在 36 个命名认证 Problem 样本中仅接受 AccountStoreUnavailable/ServiceUnavailable；SessionStoreUnavailable 被拒绝"
  - "回归边界：I01、I06 GET、I06 POST、I07 仍接受 SessionStoreUnavailable"
  - "版本与文件边界：9 个固定 SHA 可解析；候选的 10 份受审文件与固定输入字节一致；9 份相关文档的 92 个本地链接目标存在"
  - "git diff --check 7b86b03fb51fa317dc2fade3b1319a53db9247de 6f3003250d170b44e89f6ac9b0a74f91d658a357：通过"
identity_mode: "不适用：静态契约/schema 限定独立审查，未运行产品"
must_fix: []
open_items:
  - "认证前后端尚需在同一固定设计 SHA 上分别实现并提供 ST01/C19-C21 适用证据"
  - "A10/A11/A12 尚需固定实现与集成候选后完成对应交接、装配和真实流程验收"
  - "真实邮件、同源 HTTPS 部署、真实身份、浏览器重开、跨设备及旧库迁移仍由后续实现验收证明"
failure_owner: null
next_condition: "根可将同一候选 6f3003250d170b44e89f6ac9b0a74f91d658a357 固定给认证前后端并行实现；A10/A11 只消费该同版设计及其后的固定实现，旧 B15 继续按 B11/v1 固定输入集成"
authorization_used: "用户 AUTH-CONTRACT-FINAL-REVIEW@1 / attempt 1：限定独立核验、仅新增本报告、允许必要文档/schema 校验及报告提交；外层负责唯一回调"
```

## 结论

`PASS`。固定候选 `6f3003250d170b44e89f6ac9b0a74f91d658a357` 已关闭原报告的 `AUTH-CR-001` 与 `AUTH-CR-002`。schema、样本、双向用例及版本消费边界一致，本次没有剩余必须修复项。本报告只重审两项修订及其直接传播，沿用原审查已通过且未变的其余设计结论。

## AUTH-CR-001

- 工作台 OpenAPI 通过唯一本地 `PageContext` parameter 外引同候选认证定义。15 个操作各绑定一次，并且 `name=X-TeachBuddy-Page`、`in=header`、`required=true`。
- 合法 32 位小写十六进制样本通过；空值、31/33 字符、非十六进制、大写、结尾换行、null 和数字全部拒绝。工作台 `AuthenticatedContext` 符合 `WorkbenchContext` schema，其 `accountKey` 与认证 `ActiveStatus` 样本相同。
- 错误边界唯一：认证操作缺失或非法页面头是 409 `browser-context-required`；工作台经身份门禁返回 401 `workbench/unauthenticated`；写来源拒绝优先返回 403，GET 未新增来源或保护头。

## AUTH-CR-002

- I03 503 `oneOf` 已移除 `SessionStoreUnavailableProblem`，只保留 `AccountStoreUnavailableProblem` 与既有 `ServiceUnavailableProblem`。`atomicStoreFailure` 直接绑定 `AccountStoreUnavailable` 样本。
- 将 36 个命名认证 Problem 样本逐一送入 I03 503 schema，仅 `AccountStoreUnavailable` 与 `ServiceUnavailable` 通过，`SessionStoreUnavailable` 及其余样本均被拒绝。
- I01、I06 GET、I06 POST 和 I07 的纯会话失败边界未被缩窄，仍接受 `SessionStoreUnavailable`。ST01 现在覆盖 I03 的账户、挑战消费和 pending 写入失败，明确完整回滚、撤故障后同码重试和前端未知结果处理。

## 版本与放行边界

- 正在执行的 B15 保持 B11/v1 `9aee091a34ba2eb311b51299d9beed78a032d026` 及运行输入 `b938f8af0b8152718f5063d4326d494bf8b5426c`。旧 B12-B16 可继续 `real-api/test-principal`，不因当前文件改动被静默切换，也不能追认新页面头或 `real-auth` 通过。
- 新认证前后端只能同时消费候选 `6f3003250d170b44e89f6ac9b0a74f91d658a357` 内的认证 `1.0.0-rc.2`、工作台 `0.1.0-candidate.2` 和相关 cases。前后端可并行实现，共享入口仍由指定集成者串行装配。
- A10 核对固定认证交付；A11 在共享写者交付后消费同版 schema 并验证 C19-C21；A12 再对固定集成候选验证真实登录、退出、恢复、跨设备和数据隔离。

## 验证范围

本次是静态契约独立验收，未运行产品，不证明事务回滚、浏览器恢复或真实身份已实现。真实邮件、部署、真实身份和旧库迁移仍须由后续实现及验收提供证据，不影响本次两项契约修订的放行。
