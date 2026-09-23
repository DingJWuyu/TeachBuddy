# AUTH-CONTRACT/v1 限定修订回执

```yaml
task: AUTH-CONTRACT-CORRECTION@1
attempt: 1
role: design
status: READY_FOR_REVIEW
verification_level: self
finished_at_utc: "2026-09-21 21:03:14 UTC"
session_id: unavailable
runner: "Codex；本任务指定 Astra high，运行元数据由外层持有"
skills_used:
  - system-contract-design
  - codebase-design
  - writing-for-agents
base_revision: "7b86b03fb51fa317dc2fade3b1319a53db9247de"
result_revision: "6f3003250d170b44e89f6ac9b0a74f91d658a357"
receipt_revision: "本文件由设计候选的单独后继提交记录；该提交只增加本回执"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "原认证设计 fd3f6d5e8d19823aa83a417b99f223c87f4aa713"
  - "独立报告 092d7c89cb1386e913ef245a0a6370bede141947:docs/acceptance/evidence/AUTH-CONTRACT/v1/review.md"
  - "B11 冻结候选 9aee091a34ba2eb311b51299d9beed78a032d026；审查 b62034eb6661f99127d0e4b1407174260a139089"
  - "首流运行任务输入 b938f8af0b8152718f5063d4326d494bf8b5426c"
  - "只读 B12 交付 3c8d1b3210f3d35e45eaca8141040852e3cb865c:docs/acceptance/evidence/B12/v1/author.md，内含实现候选 feb64304a58077de50bc16507f8c271c60ca3ee8"
changed_files:
  - docs/contracts/auth.md
  - docs/contracts/auth.openapi.yaml
  - docs/contracts/auth-cases.md
  - docs/contracts/workbench.md
  - docs/contracts/workbench/first-flow.openapi.yaml
  - docs/contracts/workbench/first-flow-cases.md
  - docs/arch/auth-implementation.md
  - docs/arch/first-flow.md
  - docs/plans/tasks/auth-implementation.md
  - docs/plans/tasks/first-flow-implementation.md
  - docs/acceptance/evidence/AUTH-CONTRACT/v1/correction.md
artifacts:
  - "result_revision 中的十份契约/架构/任务包文件"
  - "docs/acceptance/evidence/AUTH-CONTRACT/v1/correction.md：本次限定自检与交接证据"
checks:
  - "两份 OpenAPI 3.2.1 规范检查 OK"
  - "111 个 schema、699 处引用、171 处操作绑定样本通过"
  - "工作台 15 个操作与认证 8 个操作各有唯一必填 PageContext；页面值 8 个负例拒绝"
  - "I03 503 接受 AccountStoreUnavailable/ServiceUnavailable，拒绝其他 34 个 Problem 样本；4 个纯会话操作仍接受 SessionStoreUnavailable"
  - "工作台业务 schema/既有操作及其余认证定义与输入一致；认证/工作台身份样本同 accountKey"
  - "八个固定 SHA 可解析；三份认证行为与已验收源字节一致；旧 author/review/self-check 保持原文"
  - "文档链接、写入范围和 git diff --check 通过"
identity_mode: "不适用：限定设计/schema自检；未运行产品"
open_items:
  - "AUTH-CR-001/002 待外层在实际候选上独立限定冻结，本回执不自行改写旧 CHANGES_REQUIRED"
  - "认证前后端实现与 A10/A11 真实交付证据按任务包接续"
  - "真实邮件、同源HTTPS运行、旧库迁移、浏览器重开及跨设备证据仍待对应交付"
failure_owner: null
next_condition: "外层仅核验两项修订、页面头接缝与样本、I03 Problem 集合、版本传播；通过后根固定同一候选 SHA 派发认证前后端及 A10/A11 接续"
authorization_used: "用户 AUTH-CONTRACT-CORRECTION@1 / attempt 1：限定跨契约设计写入、文档/schema检查、本分支提交；外层负责唯一回调"
```

## 两项结果

| 缺口 | 当前候选的修订 | 作者判断 |
| --- | --- | --- |
| AUTH-CR-001 | [工作台 OpenAPI](../../../../contracts/workbench/first-flow.openapi.yaml) 的15个操作均绑定本地 PageContext parameter，唯一外引同候选 [认证 OpenAPI](../../../../contracts/auth.openapi.yaml) 的必填头定义；增加合法页面样本及与 ActiveStatus 同账户的 AuthenticatedContext，并绑定 context 的200响应。 | 已修订，自检通过；待独立关闭。 |
| AUTH-CR-002 | I03的503 oneOf仅保留 AccountStoreUnavailableProblem 与既有 ServiceUnavailableProblem，移除 SessionStoreUnavailableProblem；atomicStoreFailure绑定既有账户存储失败样本。[ST01](../../../../contracts/auth-cases.md#cc-resetcc-storecc-closed)明确包括pending写失败、回滚后同码重试及前端未知结果处理。 | 已修订，自检通过；待独立关闭。 |

共享页面参数的描述明确：认证缺失/非法页为409 browser-context-required；工作台经既有身份门禁返回401 workbench/unauthenticated，存储故障仍映射503 temporarily-unavailable，写来源错误先返回403。GET没有新增Origin/Referer/保护头。没有新增身份协议、body身份字段、服务或平台。

I03事务中的账户、消费或pending写失败统一使用账户存储Problem，不能由实现者按内部失败表选择纯会话Problem；既有通用ServiceUnavailable仍是本操作允许的服务失败。I01、I06 GET/POST及I07的纯会话失败集合保持。其余已通过的认证行为、UX/BDD和原审查结论不重做。

## 版本传播与接续

权威消费矩阵见[工作台版本与验收范围](../../../../contracts/workbench.md#消费版本与验收范围)，执行步骤见[认证前后端及A10/A11任务包](../../../../plans/tasks/auth-implementation.md)。

- 新认证消费版本：`1.0.0-rc.2`；新工作台HTTP版本：`0.1.0-candidate.2`。两者必须取本回执 `result_revision`，经限定独立冻结后作为同一输入，不能混用分支最新文件。
- B11冻结候选 `9aee091a34ba2eb311b51299d9beed78a032d026` 与运行输入 `b938f8af0b8152718f5063d4326d494bf8b5426c` 继续可定位。旧B11冻结、B12作者PASS及其他旧首流结果只覆盖旧版本；没有追认新页面要求。
- B12公共schema/门禁、B14 transport/替身、B15装配、B16验收口径和认证前后端、A10/A11/A12受影响。B13业务模型保持，切新版时HTTP fixture需带头。旧测试身份首流仍按旧固定输入推进，不能据此标real-auth；消费新schema的测试身份fixture也不能省略必填头。
- 认证前后端先以同版设计独立验证适用ST01/C19-C21，回执固定设计SHA、实现SHA和实际命令。A10核对固定交付与真实认证证据；A11在共享写者交付后串行安装principal/transport及设置退出，A12独立验证真实流程。外部条件不足时保留未验证项，不用替身、fake-mail或旧PASS替代。
- 新版检查覆盖全部15个操作；集成核验页面绑定、读写、context/目录、来源优先级、刷新恢复、撤销/到期及存储故障，并回归受影响的原首流身份、隔离与幂等路径。根DAG/台账及活动任务输入未改。

B12事实只来自固定交付的 `git show` 作者回执：生产拒绝test-principal，真实认证留给A10/A11；没有从该作者self PASS推导新的独立验收。本次未读取活动B13/B14未提交代码。

## 实际验证证据

在本工作区执行以下命令，均退出0：

```bash
uvx --from openapi-spec-validator==0.9.0 openapi-spec-validator docs/contracts/auth.openapi.yaml
uvx --from openapi-spec-validator==0.9.0 openapi-spec-validator docs/contracts/workbench/first-flow.openapi.yaml
git diff --check
```

输出分别为 `docs/contracts/auth.openapi.yaml: OK`、`docs/contracts/workbench/first-flow.openapi.yaml: OK`；空白检查无输出。另用 `uvx --from openapi-spec-validator==0.9.0 python -` 经标准输入执行一次性结构/样本检查，实际环境为 PyYAML 6.0.3、jsonschema 4.26.0，采用 Draft202012Validator + FormatChecker。未写入产品校验器或测试脚本。

| 检查与重建方式 | 实际结果 |
| --- | --- |
| 遍历components.schemas检查schema；以文档所在路径解析所有内部/外部引用 | 认证64 schemas/398 refs；工作台47 schemas/301 refs，全部通过；工作台5种认证外引可解析。 |
| 展开各操作requestBody/responses的引用，按相应media schema验证每个examples.value；复用响应的样本按操作计数 | 认证8个操作/43处样本；工作台15个操作/128处样本，全部通过。 |
| 展开每个操作parameters，检查唯一name=X-TeachBuddy-Page、in=header、required=true及样本值 | 23/23；其中工作台15/15。缺头由required拒绝；空值、31/33字符、非hex、大写、结尾换行、null、number共8个值负例均拒绝。 |
| 将全部认证Problem命名样本逐个送入I03当前503 schema | 接受AccountStoreUnavailable、ServiceUnavailable；其余34个拒绝，包括SessionStoreUnavailable和SessionPersistenceUnavailable。 |
| 检查I01/I06 GET/I06 POST/I07当前503 schema | 4/4仍接受SessionStoreUnavailable。 |
| 对比Auth ActiveStatus.value.session.account.accountKey与工作台AuthenticatedContext.value.accountKey；验证后者schema与操作绑定 | 相等，均为fixture-account-a；新样本通过，旧Context的fixture-teacher-a测试身份样本保留。 |
| 从当前工作台paths去掉15处PageContext绑定与新增context样本，再与固定输入解析对象比较；比较全部业务schemas | paths及47个业务schemas完全相同，操作/状态/body/原响应样本未改。 |
| 从认证解析对象还原info、PageContext参数说明/样本、I03 503为输入值后比较整份文档 | 与固定输入完全相同，没有其他协议变更。 |
| git rev-parse核对本回执的八个输入/交付SHA；git show逐字比较固定行为与原证据 | 八个SHA可解析；auth.md、auth-scenarios.md、auth-behavior-scenarios.md与c7420af一致；旧author/review/self-check与任务基线一致。 |
| 检查更改文档本地链接、最终回执链接及写入边界 | 设计文件85处本地链接可定位（correction由后继提交补齐）；变更仅为十份授权文档/schema及本回执；无产品/原型/根台账改动。 |

以上是静态结构与交换设计自检，不是产品事务回滚或浏览器恢复实测。双向设计走查以 [C19-C21](../../../../contracts/workbench/first-flow-cases.md#真实认证页面接缝) 和 ST01 为限：前端从同版schema知道发送头、成功形状及失败恢复；后端从同版参数、身份门禁和原子语义知道接受条件与返回集合。后续实测须独立记录真实Cookie/页面绑定、数据库回滚及重试结果。

## 交独立限定冻结

固定审查输入为设计候选 `6f3003250d170b44e89f6ac9b0a74f91d658a357`，差异起点为 `7b86b03fb51fa317dc2fade3b1319a53db9247de`；本回执是其后继证据，不改变候选内容。只核验AUTH-CR-001/002、相应操作/schema/样本、C19-C21/ST01双向约定与版本传播。通过后由外层记录新的限定冻结结论，旧 [review.md](review.md) 保持原文；本作者不把self提升为independent。

用户已授权限定跨契约裁决，因此未追加逐项grilling确认；领域词义未变，没有新CONTEXT/ADR。未派任何额外session/reviewer、未实现或测试产品、未读密钥、未发邮件、未合main、未push。检查经标准输入执行，无本任务临时脚本或运行产物待清理；候选及正式回执保留。外层负责唯一回调。
