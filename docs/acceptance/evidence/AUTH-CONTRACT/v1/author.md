# AUTH-CONTRACT/v1 作者回执

```yaml
task: AUTH-CONTRACT@1
attempt: 1
role: design
status: READY_FOR_REVIEW
verification_level: self
finished_at_utc: "2026-09-21 20:27:23 UTC"
session_id: unavailable
runner: "Codex；任务包指定独立 Astra high，精确运行元数据由外层持有"
skills_used:
  - system-contract-design
  - writing-for-agents
  - domain-modeling
  - codebase-design
base_revision: "5b12a9063cc0b692103df73997cb8963506bd9ea"
result_revision: "fd3f6d5e8d19823aa83a417b99f223c87f4aa713（设计候选）；本回执由单独后继提交固定"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "5b12a9063cc0b692103df73997cb8963506bd9ea:docs/arch/auth-readiness.md 与本任务design/ownership/receipt规则"
  - "c7420af8c2740ddee5e01caa6da8bf7f57c134e2:prototype/behavior/auth.md 及认证场景/边界证据；当前基线中认证三份行为文件与源一致"
  - "5757141a61e719c8002736ae5af0ac1778dad054:docs/contracts/auth.md、auth.openapi.yaml、auth-cases.md 的已定协议"
  - "B11候选9aee091a34ba2eb311b51299d9beed78a032d026及冻结审查b62034e的固定接缝；未读取活动B12/B14未提交实现"
changed_files:
  - docs/contracts/auth.md
  - docs/contracts/auth.openapi.yaml
  - docs/contracts/auth-cases.md
  - docs/arch/auth-implementation.md
  - docs/ux/auth-integration.md
  - docs/acceptance/auth.feature
  - docs/plans/tasks/auth-implementation.md
  - docs/acceptance/evidence/AUTH-CONTRACT/v1/self-check.md
  - docs/acceptance/evidence/AUTH-CONTRACT/v1/author.md
artifacts:
  - "候选commit中的三份契约、架构/UX/BDD、前后端短任务包及self-check.md"
  - "author.md作为候选的后继回执，不更改候选设计内容"
checks:
  - "认证与B11工作台OpenAPI 3.2.1规范结构校验均OK"
  - "64个schema、398处内部引用、56个命名样本、42处操作绑定样本、73项负例检查通过"
  - "CA01-CA120逐项映射无遗漏/重复，20个BDD场景与唯一标签解析通过"
  - "B11四处外部认证引用可解析；39个本地目标检查、源比较与git diff --check通过"
  - "作者双向交换走查见self-check.md；未运行产品/原型/浏览器/邮件/迁移/部署"
identity_mode: "不适用：设计；后续证据分frontend-substitute、real-api/fake-mail、real-auth/real-mail"
open_items:
  - "外层独立冻结核验尚未进行，作者未自封PASS"
  - "认证前后端及最终共享入口装配尚未实现；设置退出归A11"
  - "真实邮件提供者、发信身份、授权收件箱和配置需根协调；本任务未读写密钥或发送邮件"
  - "同源HTTPS部署、真实持久运行/重启、旧库迁移样本与缺失昵称来源、真实浏览器重开/跨设备仍需后续证据"
  - "本地可见Git未见新的固定认证交付；原session是否消费归属通知及其未提交/外部成果未知"
failure_owner: null
next_condition: "外层在固定候选上独立冻结；通过后根以同版设计派认证前后端并行实现，共享入口待当前写者结束由指定集成者接手；A10正式通过仍需固定真实认证交付"
authorization_used: "用户AUTH-CONTRACT@1 / attempt 1：范围内自主契约设计及必要文档提交，不实现产品、不改原型、不合main、不push、不读写密钥、不派顶层session；外层负责唯一回调"
```

## 交付入口

从 [认证契约](../../../../contracts/auth.md)进入唯一 [OpenAPI](../../../../contracts/auth.openapi.yaml)和[双向交换用例](../../../../contracts/auth-cases.md)。I01-I07均有共享定义，包括I06状态读取、建立浏览器上下文、激活/恢复，以及I07可重试的定向退出。保留OpenAPI 3.2.1、既定HTTP/Problem、Cookie、来源保护、严格输入和响应兼容风格；协议公开版本为`1.0.0-rc.1`，状态为候选。

最小前后端实现包见 [auth-implementation任务包](../../../../plans/tasks/auth-implementation.md)。两侧分别写`apps/api/src/features/auth/`和`apps/web/src/features/auth/`及各自测试/证据目录，不抢app、共享配置、lock、store、settings等入口。真实账户、发码和会话由后端模块导出；前端交付账户UI、门禁和transport；集成者收齐固定版本后串行装配。

A10消费项见[架构交接表](../../../../arch/auth-implementation.md#a10-可消费清单与外部缺口)：稳定accountKey、resolvePrincipal兼容、Cookie+当前页身份、恢复与撤销、设置退出交换及真实证据需求。B11返回形状、context及业务错误命名空间保持；本包未修改B11，未猜测活动实现。

## 核验限制与给根的事实

[自检](self-check.md)只证明设计结构和样本一致性。外层仍须独立冻结，真实邮件/部署/迁移/跨设备分别需要提供者和运行证据；fake-mail的内部投递接受不能写成真实收件。A10可先消费设计，但本包不能解除其真实认证输入门禁。

源事实需区分：`c7420af`的prototype tree是`6f4a7d30c16a67b44af1e7a9c1157abb6d065b6b`，当前任务基线的tree是`1281d51665a740573a0a6f237b9e37d0335cf2c3`。认证行为三份文件相同；本包分别固定两个来源，没有修改auth-readiness调查记录。未发现新的固定认证契约冲突；原session未提交成果不在本次核验范围。

本次按已授权范围和技能路由完成技术裁决，未调用grilling逐项询问，未派内部reviewer或顶层session，未向其他session发消息。没有产品实现、原型变更、main合并、push或密钥读写。正式候选与证据保留；一次性编写/检查脚本在完成后清理。唯一回调由外层负责。
