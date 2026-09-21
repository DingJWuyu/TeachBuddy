# B11/v1 作者回执

```yaml
task: B11@1
revision: B11/v1
attempt: 1
role: design
status: READY_FOR_REVIEW
verification_level: self
finished_at_utc: "2026-09-21 19:16:39 UTC"
session_id: "01a0c555-bc91-7b02-afea-135650a01780"
runner: "Codex；派发角色 Astra high，模型/effort 元数据由外层记录"
skills_used:
  - product-behavior-design
  - system-contract-design
  - writing-for-agents
  - codebase-design
  - domain-modeling
base_revision: "59a14e95bab667e0a01b8d62f6e87e018ddb1c5f"
result_revision: "9aee091a34ba2eb311b51299d9beed78a032d026（设计候选）；本回执以单独后继提交记录"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "固定 HEAD 的 B11 节点、design/ownership/receipt 协议、PRODUCT_SCOPE、WORKBENCH_DESIGN、设计规则、ADR 0001"
  - "B10 8e9b230c56c7384521b122a7a80b6b07e18c852c:docs/arch/execution-baseline.md，与指定 b10 工作区文件字节一致"
  - "认证 auth.md/auth.openapi.yaml：partial，源 a496c5a4727e2900bd110198819295e068739439"
  - "固定 HEAD 的原型 manifest/modules/shell 参考及 apps/shared 实际入口，只读"
changed_files:
  - docs/user-stories/first-flow.md
  - docs/ux/first-flow.md
  - docs/contracts/workbench.md
  - docs/contracts/workbench/first-flow.openapi.yaml
  - docs/contracts/workbench/first-flow-cases.md
  - docs/arch/first-flow.md
  - docs/acceptance/first-flow.feature
  - docs/plans/tasks/first-flow-implementation.md
  - docs/acceptance/evidence/B11/v1/self-check.md
  - docs/acceptance/evidence/B11/v1/author.md
artifacts:
  - "上述设计文件均固定在 result_revision；author.md 是本候选的后继回执"
checks:
  - "OpenAPI 3.2.1、47 个 schema、13 个规范样本与 12 个错误样本校验通过"
  - "5 个非法请求形状被拒绝；WB-001 至 WB-019 Gherkin 解析与唯一性通过"
  - "46 个本地文档目标存在；git diff --cached --check 通过；详见 self-check.md"
identity_mode: "不适用：仅设计；下游先使用 test-principal，real-auth 由 A10/A11 接入"
open_items:
  - "待根另派独立 Sol high 对本候选做必要契约冻结核验，作者未自封独立 PASS"
  - "认证真实身份/恢复/退出仍为外部 partial 缺口，阻塞 real-auth 验收，不阻塞测试身份下的 B12-B15"
failure_owner: null
next_condition: "独立 reviewer 核对本候选及设计冻结标准；通过后根固定同版设计与各节点输入并派发 B12-B14"
authorization_used: "用户 B11@1 / attempt 1：完整 MVP 范围内自主设计、允许本分支提交；不合 main、不 push、不启动顶层 session、不实现产品"
```

## 候选入口与并行边界

从 [工作台契约](../../../../contracts/workbench.md) 进入唯一 [OpenAPI](../../../../contracts/workbench/first-flow.openapi.yaml)、[交换用例](../../../../contracts/workbench/first-flow-cases.md)、[UX](../../../../ux/first-flow.md) 和 [19 个 BDD 场景](../../../first-flow.feature)。本候选确定题面/答案/笔记分离、复制首次保存、原题版本快照、备课主动采用更新、原子版本写入、持久幂等、软删除恢复和设备草稿/现场。

独立冻结后，B12 公共设施、B13 两个后端模块、B14 前端/外壳可在独立 worktree 并行。业务通过固定接缝或同版契约替身开发，最终真实条件需接入 B12；B15 收齐固定候选并独占装配和故障 E2E。共享入口、锁文件、样式、测试设施按 [架构写者表](../../../../arch/first-flow.md#并行写入与集成) 唯一归属；可直接派发的短包见 [B12-B15](../../../../plans/tasks/first-flow-implementation.md)。

## 未决事项与验证限制

当前没有留给 worker 猜测的已知首流产品选择。认证映射等待其负责人交付，使用当前已确认 Cookie/HTTP 风格不代表认证完成。C20 的提取、Office、数学、pi 与部署问题已在 [风险表](../../../../arch/first-flow.md#c20-需验证的问题与外部缺口) 定位到后续消费者，本批不以这些未经验证能力作为前提。

本轮仅作者结构校验和双向交换走查，[自检记录](self-check.md)列出实际检查范围；没有产品代码、原型改动、运行截图、真实故障证据或独立 PASS。范围内设计授权覆盖技能原有逐项讨论/原型包门禁，实际只交本次允许的 docs；独立 reviewer 接替逐项用户讨论。未调用 grilling、未派内部 reviewer 或其他 session、未合 main、未 push。没有本任务遗留的临时文件；候选与正式证据保留供审查。
