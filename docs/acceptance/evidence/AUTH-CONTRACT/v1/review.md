# AUTH-CONTRACT/v1 独立契约冻结审查

```yaml
task: AUTH-CONTRACT-REVIEW@1
attempt: 1
role: design-review
status: CHANGES_REQUIRED
verification_level: independent
finished_at_utc: "2026-09-21 20:44:03 UTC"
session_id: unavailable
runner: "Codex，gpt-5.6-sol high"
skills_used:
  - writing-for-agents
base_revision: "a11094e25c9605216af45fccc31de2ccc2c2eb0f"
result_revision: "fd3f6d5e8d19823aa83a417b99f223c87f4aa713：固定受审设计"
author_receipt: "975fb04cd99ddb8da1ec0d9c455c84021e554fcd:docs/acceptance/evidence/AUTH-CONTRACT/v1/author.md"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
changed_files:
  - docs/acceptance/evidence/AUTH-CONTRACT/v1/review.md
artifacts:
  - docs/acceptance/evidence/AUTH-CONTRACT/v1/review.md
identity_mode: "不适用：设计审查"
must_fix:
  - AUTH-CR-001
  - AUTH-CR-002
failure_owner: "AUTH-CONTRACT 设计节点；AUTH-CR-001 需与 B11/A11 接缝拥有者固定同版 schema"
next_condition: "修复 AUTH-CR-001/002，提交新的完整设计候选与作者回执，并对受影响的工作台页面头接缝、I03 Problem 集合及相关双向样本重做独立冻结审查"
authorization_used: "用户 AUTH-CONTRACT-REVIEW@1 / attempt 1 独立 Sol high 契约冻结审查授权；只新增本报告，允许本分支报告提交"
```

## 结论

`CHANGES_REQUIRED`。固定候选 `fd3f6d5e8d19823aa83a417b99f223c87f4aa713` 已将 I01-I07、失败/恢复、CA01-CA120、前后端独占写入边界及 `accountKey` / `resolvePrincipal` 接缝收敛到可实现程度，但仍有两处共享契约不唯一。两者都会让不同写者从同一候选得出不同的 HTTP 要求或 Problem，因此本版不放行认证前后端实施。

## 必须修复

### AUTH-CR-001 工作台必填页面头没有进入工作台唯一 HTTP schema

- 依据：`docs/contracts/auth.md` 的“会话与页面上下文”要求所有认证请求和工作台受保护请求携带 `X-TeachBuddy-Page`；`docs/arch/auth-implementation.md` 也要求 `useAuth.request` 添加该头，且 `resolvePrincipal` 依赖 Cookie + 页面绑定。但 `docs/contracts/workbench/first-flow.openapi.yaml` 的 15 个操作都未引用 `PageContext`；它只外引 `SessionCookie`、`BrowserRequestProtection`、`RequestOrigin` 和 `RequestReferer`。
- 影响：B11 声明工作台精确 HTTP 字段唯一归其 OpenAPI。当前工作台客户端、schema 校验者或服务组装者不能仅从该唯一 schema 得出新的必填头名称与形状。`SessionCookie` 的描述性文字不能代替操作上的必填 parameter。
- 归属：AUTH-CONTRACT 设计节点负责关闭跨契约缺口；B11/A11 接缝拥有者负责固定受影响的工作台 schema 版本。
- 最小修复：在权威工作台 OpenAPI 中将认证 `PageContext` 外引绑定到每个受保护操作，并同步固定新的 B11/A11 消费版本。不需要新的身份协议、包装层或调度设施。

### AUTH-CR-002 I03 原子存储失败的 Problem 不唯一

- 依据：`docs/contracts/auth.md` 的“验证码与原子结果”以及 `docs/contracts/auth-cases.md` 的 ST01 都规定 I03/I05 原子事务存储失败返回 503 `account-store-unavailable`。但 I03 在 `docs/contracts/auth.openapi.yaml` 的 503 `oneOf` 中同时允许 `SessionStoreUnavailableProblem`。
- 影响：后端可依 OpenAPI 对 pending 会话写失败返回 `session-store-unavailable`，而前端与 ST01 可依正文只接受 `account-store-unavailable`。这破坏了 Problem 集合的单一事实源。
- 归属：AUTH-CONTRACT 设计节点。
- 最小修复：按已有原子事务语义从 I03 503 响应中移除 `SessionStoreUnavailableProblem`，并重跑操作绑定样本与 ST01 双向校验。`session-store-unavailable` 仍可保留给 I01/I06/I07 的纯会话存储失败。

## 已通过的独立核验

- 固定输入：输入基线、设计 SHA 和作者回执 SHA 均可解析，设计与回执均是受审 `HEAD` 的祖先。当前三份原型认证行为文件与 `c7420af8c2740ddee5e01caa6da8bf7f57c134e2` 字节一致。
- 旧 HTTP 风格：`5757141a61e719c8002736ae5af0ac1778dad054` 固定的 I01-I05 及 I07 方法/地址保留；同源 HTTPS、HttpOnly/Secure `__Host-` Cookie、来源保护、严格 JSON、RFC 9457 Problem、直接成功对象、204 空响应、请求封闭/响应附加字段兼容和 `no-store` 均延续。I06 是补全会话行为所需的新操作，没有改写旧操作。
- 结构与样本：`openapi-spec-validator 0.9.0` 对认证和工作台 OpenAPI 3.2.1 都返回 `OK`。独立 Draft 2020-12 校验确认 64 个 schema、398 处认证内部引用、56 个命名样本、8 个操作的 42 处绑定样本；工作台 4 处认证外部引用可解析。
- 范围覆盖：CA01-CA120 在覆盖表中各出现一次；20 个 Gherkin 场景及 `WB-AUTH-001` 至 `WB-AUTH-020` 唯一连续。I01-I07 都有请求、成功、字段/非字段失败、请求结果不明、迟到结果或恢复路径。
- 身份接缝：认证 `Account.accountKey` 与 B11 `WorkbenchContext.accountKey` 均为 1-200 字符的稳定字符串。`resolvePrincipal(request)` 的 Promise 返回、null 拒绝和 503 错误映射与 B11 seam 兼容；浏览器自报 `accountKey`、旧 Bearer 或单独页面头都不能授权。AUTH-CR-001 只要求把已设计的接缝纳入权威 schema，不需要重新设计身份模型。
- 写入边界：后端、前端和串行集成者的独占目录及禁写共享入口已分开。两侧可分别使用真 Express/SQLite + fake-mail 和同版 HTTP 替身开发；共享入口、依赖、迁移 runner、设置退出和最终真实联调归固定集成者/A11。

## 必要行为与复杂度边界

当前 Cookie 容器 + 页面上下文是满足“不记住我在刷新后失效”且不向前端交付凭据的必要机制；pending -> activate 是区分账户业务成功和会话持久化失败的必要交换；I07 的定向、可重试撤销是避免“只清前端就假退出”的必要结果。设计正确地没有加入刷新令牌、Bearer 回退、账户管理后台、分布式邮件队列、通用事件总线或工作台幂等键复用。发码只需单后端内同用途+邮箱串行裁决，不需要扩成调度平台。

## 建议与后续验证输入

- `AUTH-CR-SUG-001`：前后端实施回执应固定实际 `node --test` / Playwright / 生产构建命令和隔离路径。当前任务包已给出必验场景和证据类型，允许实现者在不抢写共享配置的前提下选定精确命令，因此不单独阻塞设计。
- 真实邮件提供者/发信身份/授权收件箱、同源 HTTPS 部署、真实持久目录与服务重启、浏览器重开/两设备、旧库迁移 fixture 及缺失昵称来源是后续交付验证输入。它们不是本次静态契约审查的修订理由，但 fake-mail、前端替身或 test-principal 通过都不得写成 real-auth/real-mail 通过。

## 实施放行条件

当前不放行。新候选须先关闭 `AUTH-CR-001` 和 `AUTH-CR-002`，通过受影响的 OpenAPI/schema/样本校验及独立冻结审查。随后可以在同一固定设计 SHA 上并行派发认证前端与后端，但共享入口由指定集成者串行装配。A10/A11/A12 及 real-auth 仍须等固定后端、前端、集成版本和上述真实外部证据，不能由契约、替身或 fake-mail 结果代替。
