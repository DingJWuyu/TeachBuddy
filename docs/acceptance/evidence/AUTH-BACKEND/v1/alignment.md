# AUTH-BACKEND/v1 限定契约一致性验收

```yaml
task: AUTH-BACKEND-ALIGNMENT@1
attempt: 1
role: acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-21 22:11:28 UTC"
session_id: unavailable
runner: "Codex，gpt-5.6-sol high（按任务派发）"
skills_used: [writing-for-agents]
base_revision: "b424b7dc12c5e6f1e008ee818a0c1ffbd0bb21e5"
design_revision: "6f3003250d170b44e89f6ac9b0a74f91d658a357"
design_review_revision: "63bfe8f7900b4a2bb7fc9ab5a4145f1c89a6f73b"
candidate_revision: "471f35c76233962401e8b9c3c0c62c6791ffde08"
author_receipt: "281716faf277cc186235fb758ccda18d56674eda:docs/acceptance/evidence/AUTH-BACKEND/v1/author.md"
result_revision: "471f35c76233962401e8b9c3c0c62c6791ffde08：固定受验后端候选；本报告由独立后继提交记录"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "报告工作区基线 b424b7dc12c5e6f1e008ee818a0c1ffbd0bb21e5"
  - "冻结认证设计 6f3003250d170b44e89f6ac9b0a74f91d658a357"
  - "限定独立 PASS 63bfe8f7900b4a2bb7fc9ab5a4145f1c89a6f73b"
  - "后端实现候选 471f35c76233962401e8b9c3c0c62c6791ffde08"
  - "实现自检回执 281716faf277cc186235fb758ccda18d56674eda"
changed_files:
  - docs/acceptance/evidence/AUTH-BACKEND/v1/alignment.md
artifacts:
  - "docs/acceptance/evidence/AUTH-BACKEND/v1/alignment.md"
checks:
  - "AUTH-ALIGN-001：冻结 auth.md/OpenAPI/cases 与候选 bootstrap 代码逐条对照；PASS"
  - "AUTH-ALIGN-001：真 Express HTTP + 独立临时 SQLite；畸形与未知合法 Cookie 均由 GET 401 经 bootstrap 200 恢复到 GET 200；PASS"
  - "AUTH-ALIGN-002：冻结 CC-CLOSED/CL01、原子边界与候选发码代码对照；PASS"
  - "AUTH-ALIGN-002：真 Express HTTP + 独立临时 SQLite + fake-mail；提供者接受后关闭注册得到 403 registration-closed 且活动挑战数为 0；PASS"
  - "AUTH-ALIGN-003：冻结工厂接缝、密钥安全要求、任务包配置交接与候选 codeSecret/AUTH_CODE_SECRET 实现对照；PASS with integration requirement"
identity_mode: "real-api/fake-mail：真 HTTP 与真 SQLite，邮件为可控替身，未发外部邮件"
must_fix: []
open_items:
  - "AUTH-ALIGN-003 由唯一集成者关闭：在集成候选的配置加载、apps/api/.env.example 及 README/部署说明中记录 AUTH_CODE_SECRET，注入持久且受保护的值；缺失时不得宣称集成可运行"
failure_owner: null
next_condition: "可消费后端候选 471f35c 进入唯一集成者装配；集成者在启动与文档验收前关闭 AUTH-ALIGN-003，之后再由 A10/A11/A12 执行原定真实集成与身份验收"
authorization_used: "用户 AUTH-BACKEND-ALIGNMENT@1 / attempt 1：限定一致性判断、必要去敏 HTTP 边界复现、仅新增并可提交本报告；不改产品/契约/根台账，不合 main、push、部署或派其他 session"
```

## 结论

`PASS`。固定后端候选 `471f35c76233962401e8b9c3c0c62c6791ffde08` 在本次三个限定问题上与冻结契约一致，可作为唯一集成者的固定输入。两处实现者自称的“规格冲突”都是冻结契约已规定或为满足其恢复路径所必需的行为，不需要修后端代码，不需要回设计负责人。

`codeSecret` / `AUTH_CODE_SECRET` 是冻结安全要求的实现依赖，不改 HTTP 契约、工作台身份接缝或工厂返回形状，不构成产品契约冲突。它是集成时必须明示配置的新运行条件，当前 `apps/api/.env.example`、配置加载与 README 尚未包含该项。这不阻塞消费后端模块，但会阻塞未补配置的集成候选启动及其 PASS 声明。

## 稳定判断

### AUTH-ALIGN-001 bootstrap 覆盖失效或未知 Cookie

结论：契约允许，实现正确。

- [auth.md](../../../../contracts/auth.md) 的会话语义规定 POST I06 bootstrap 建立空容器，只对“已有有效容器”保持原容器。因此已携带但不能解析、不存在于存储或已失效的 Cookie 不属于必须保持的容器。
- 同版 OpenAPI 将 bootstrap 定义为可无 Cookie，而 activate/restore 必须有效 Cookie 和目标绑定；GET 对损坏/失效 Cookie 返回 401。这两个结果不冲突：GET 拒绝以失效 Cookie 表示当前会话，bootstrap 则用无身份空容器恢复浏览器上下文。
- Cookie 为 HttpOnly，前端不能通过脚本删除或改写。如 bootstrap 也对失效 Cookie 只返回 401，契约的“先 bootstrap 并确认 Cookie 可用”将没有服务端恢复路径。候选的替换行为不授权、不恢复旧身份，只建立新空容器。
- 独立 HTTP 复现分别使用畸形 Cookie 与形状合法但数据库未知的 Cookie。两者均是 `GET 401 -> POST bootstrap 200 + 1 Set-Cookie -> GET 200/browserReady=true`，每个隔离库最终只有 1 个新容器。Cookie 值未记录。

归属：无修复项。不回后端实现，不回契约设计。

### AUTH-ALIGN-002 邮件已接受后关闭注册

结论：契约明确要求当前实现。

- [auth-cases.md](../../../../contracts/auth-cases.md) 的 CC-CLOSED/CL01 明确包含“提交等待中关闭”，结果是 I02/I03 返回 403 `registration-closed`，并按实际事务裁决时的开放状态保持账户/挑战不变。[auth.feature](../../../auth.feature) 的 `WB-AUTH-008` 同样要求注册事务裁决前关闭时不创建账户、不消费验证码。
- [auth-implementation.md](../../../../arch/auth-implementation.md) 规定 SQLite 事务中不等待邮件网络，邮件接受后才原子激活新挑战。数据库与邮件不是同一原子事务；403 不承诺外部邮件可撤回，只承诺本次不建立可验证挑战。
- 候选在 `sendCode` resolve 后再检查 `isRegistrationOpen()`，关闭则返回 403，未替换或插入挑战。独立 HTTP/fake-mail 复现确认提供者接受计数为 1、HTTP 403、Problem 为 `/problems/auth/registration-closed`、活动挑战数为 0。未记录验证码，未发送外部邮件。

归属：无修复项。不回后端实现，不回契约设计。

### AUTH-ALIGN-003 codeSecret / AUTH_CODE_SECRET 注入

结论：不造成冻结接口冲突，集成配置和公开说明必须补齐。

- 冻结工厂对外仍是 `createAuthModule(options) -> {router, resolvePrincipal}`；候选未更改返回形状、router 挂载位置、principal 形状或任何 HTTP 字段。冻结架构同时要求验证码校验值抵抗数据库泄漏后的六码离线穷举，明确允许实现者选择服务端密钥 HMAC。
- [auth-implementation 任务包](../../../../plans/tasks/auth-implementation.md) 要求 worker 不编辑共享配置，需要的环境变量由回执列出并交集成者。回执 `281716f` 已列出 `codeSecret` / `AUTH_CODE_SECRET` 和具体集成清单，因此这是获授权的实现选择，不是需要冻结契约 v2 的产品语义变更。
- 候选接受显式 `options.codeSecret` 或环境变量 `AUTH_CODE_SECRET`，两者均缺失时在工厂创建阶段立即失败。环境变量回退使冻结文档列出的旧 options 调用形状在已正确配置的部署中仍可工作；失败时不会以弱默认值降级。
- 当前共享 `apps/api/src/config/env.js`、`apps/api/.env.example` 和 README 尚未记录 `AUTH_CODE_SECRET`。唯一集成者必须选定一条直接路径：由运行环境提供 `AUTH_CODE_SECRET`，或纳入集中配置并传入 `codeSecret`。配置模板、README/部署说明和备份恢复必须同步密钥名称与持久要求，不记录真实值。

归属：`AUTH-ALIGN-003` 由唯一集成者在共享入口与部署文档中关闭。不需要修改 `471f35c` 的认证模块，不需要回冻结设计。

## 验证边界

本次只判断上述三项。复现使用候选自带的真 Express 挂载、每场景独立临时 SQLite 和可控 fake-mail，未复跑全量测试、内部 code-review、HTTPS smoke 或外部邮件。临时数据由 harness 在每场景结束时删除，未产生需保留的独立日志。本 PASS 不代替 AUTH、A10、A11 或 A12 的原定真实邮件、共享入口装配、持久部署、刷新/重登、跨设备与数据隔离验收。
