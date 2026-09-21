# 认证交接就绪事实

状态：`EAUTH-READINESS@1 / attempt 1`，只读事实整理。固定基线为
`819e79332d0c3f9cb19d64adff0ce8127d890098`，当前分支为
`docs/auth-readiness`。本页不替代认证契约、认证实现或 A10 的独立交接审查。

## 结论

固定基线里已经存在一份比认证契约更新的、已验收的账户入口行为成果；不能再把认证工作概括为“全部没有发生”。但没有证据表明目标认证契约已经完成，也没有证据表明新的正式认证服务已经实现或交付。A10 当前可以消费行为语义和部分已确认的协议边界，不能据此宣称 EAUTH 已交付、不能把旧 `apps/` 认证当作新认证、也不能直接通过 A10。

| 层次 | 固定基线事实 | 给 A10 的可用性 |
| --- | --- | --- |
| 产品行为 | `c7420af8c2740ddee5e01caa6da8bf7f57c134e2` 已把登录、注册、找回、失败恢复、验证码、会话和输入边界行为集成到 `prototype/` | 可作为用户可观察语义和场景输入，原型仍是模拟服务 |
| 行为证据 | `auth.json` 为 120/120，`auth-behavior.json` 为 207/207，输入边界报告为 30 条通过；CA53 设置页退出入口明确暂缺 | 可作为已保存的原型证据索引，不能作为正式 API 或生产认证证据 |
| 共享协议 | `5757141a61e719c8002736ae5af0ac1778dad054` 保存 OpenAPI、契约入口和契约用例，但全局及六个操作仍为 `partial` | 只能消费已确认的协议原则和地址片段，不能消费 Core schema 作为完整实现契约 |
| 正式实现 | 固定基线的 `apps/api` 和 `apps/web` 仍是旧 Bearer/localStorage 应用 | 不可用作目标认证交付 |
| 主动回执 | 原认证 session 没有保存到正式 PASS/FAIL/BLOCKED 回执或结果 SHA；运行台账仍等待主动回执 | 未知，不能用 queue 投递或台账等待状态证明运行状态 |

## 已确认且可交给 A10 的成果

### 1. 当前行为基线

权威行为入口是[账户入口](../../prototype/behavior/auth.md)，状态为 `Accepted`；[行为索引](../../prototype/behavior/manifest.md)明确账户入口范围为 CA01-CA40、CA41-CA109、CA110-CA119 和 CA120，CA53 是设置页退出入口的明确暂缺。当前行为成果由以下固定版本提供：

- `c7420af8c2740ddee5e01caa6da8bf7f57c134e2`，提交时间为 2026-09-21 07:39:12 -04:00。
- `prototype/` tree：`1281d51665a740573a0a6f237b9e37d0335cf2c3`。
- `prototype/evidence/verification/auth.json`：40 个基础场景、三种视口共 120 条记录，全部 `passed`。
- `prototype/evidence/verification/auth-behavior.json`：69 个失败与恢复场景、三种视口共 207 条记录，全部 `passed`；唯一 deferred 为 CA53。
- `prototype/evidence/verification/input-boundary-report.json`：10 个输入边界场景、三种视口共 30 条记录，`status: passed`。

这组证据证明的是当前原型模拟范围，不能证明真实邮件、真实 HTTP 服务、服务端会话或跨设备网络能力。行为文档明确排除了真实认证、邮件投递、服务端会话和真实跨设备网络事件；它要求这些状态在原型中可观察地模拟。

A10 可以直接使用的行为事实包括：

- 注册默认开放；关闭时只禁止新注册，不阻止已有账户登录、找回或重置。
- 登录、注册和会话交接使用账户保存的昵称，不再从邮箱派生名称；昵称 `trim` 后按 1-40 个 Unicode code points 处理。
- 邮箱提交值为 `trim` 后转小写的规范值；密码不做 `trim`、大小写转换或 Unicode normalization，长度为 8-128 个 Unicode code points。
- 验证码是保留前导零的 6 位 ASCII 数字字符串；单挑战有效 10 分钟，值错误最多 5 次，成功重发冷却 30 秒，挑战绑定用途和规范化邮箱。
- 记住我会话绝对有效期为 7 天；不记住我只在当前页面有效。恢复等待期间不先展示登录卡或工作台，过期、撤销、损坏和迟到结果按场景回到可恢复的登录状态。
- 密码重置使目标账户的已有会话失效，但不影响其他账户；响应丢失、写入失败和请求中切换表单不能被界面伪装成已成功或已撤销。
- 条款链接不跳转；验证码形状和条款同时不合规时，行为基线以本地条款校验优先。设置页退出入口 CA53 尚未提供，不能从“行为已验收”推导退出 UI 已交付。

A10 应引用上述行为文档和结果索引，不复制截图或把固定示例账户、固定验证码提升为正式服务规则。

### 2. 现有契约中已经确认的协议边界

契约最后保存提交为 `5757141a61e719c8002736ae5af0ac1778dad054`，提交时间为 2026-09-21 07:44:19 -04:00。该提交保存的 OpenAPI 源版本仍声明：

- OpenAPI `3.2.1`，文档版本 `0.1.0-draft.9`。
- 浏览器页面和 `/api` 使用同源 HTTPS，前后端通过 HTTP 请求响应交换 JSON。
- 错误使用 `application/problem+json` 和 RFC 9457 风格的 `type`；字段错误用 `field` 定位，已知状态包含 400、403、409、415、422。
- 已列操作为 `POST /api/auth/login`、`POST /api/auth/registration-codes`、`POST /api/auth/register`、`POST /api/auth/password-reset-codes`、`POST /api/auth/password-reset` 和 `POST /api/auth/logout`。
- 会话载体方向为 `__Host-teachbuddy_session` Cookie，固定属性为 `HttpOnly; Secure; Path=/; SameSite=Lax`，不设 `Domain`；浏览器脚本不读取、保存或拼接 Bearer 凭据。
- 认证写请求使用 `X-TeachBuddy-Request: 1`，并校验 `Origin`，仅在 `Origin` 缺失时按同源 `Referer` 回退；防护拒绝为无字段 403。
- 认证成功和失败响应使用 `Cache-Control: no-store`。有数据的成功响应直接返回结果对象，无数据且动作确实完成时才使用 204。
- 最终完整请求拒绝未声明字段并保持严格类型；当前 OpenAPI 的 `Core` schema 尚未封闭，不能把“允许附加字段”当作正式兼容政策。
- 已具体化的片段包括邮箱已占用 409、协议错误、已知字段错误、来源防护拒绝及验证码值不匹配 422。它们仍是定义和片段用例，不是实现通过记录。

这些边界可给 A10 作为不可回退的协议约束。对应入口为[认证契约](../contracts/auth.md)、[OpenAPI](../contracts/auth.openapi.yaml)和[契约用例](../contracts/auth-cases.md)。

### 3. 工作台身份接缝的消费边界

B12 当前 worktree 中的 `apps/api/src/workbench/identity.js`、身份测试和首流浏览器 fixture 只提供 workbench 的身份接缝与 `test-principal` 测试模式：生产默认 `none`，真实适配器留给 A11；生产进程拒绝 `test-principal`。这不是认证交付，但 A10/A11 可以把它作为消费方边界：服务端必须从已验证 principal 得到 `accountKey`，不能接受浏览器 body、query 或客户端身份头自报账户。

该 B12 内容仍未进入固定基线，且所属 worktree 有未提交改动。它只能作为当前并行消费者的实现信号，不能写入认证交接版本或作为真实身份证据。

## 尚缺成果及文件归属

### 认证契约和设计归属

认证契约仍需由认证契约拥有者继续维护以下三个文件，A10 只读：

- `docs/contracts/auth.md`
- `docs/contracts/auth.openapi.yaml`
- `docs/contracts/auth-cases.md`

当前文件的 `x-accepted-source` 仍是旧的 `a496c5a4727e2900bd110198819295e068739439` 和旧 `prototype-tree` `05dc1e5244cd9224d3480f0a1935dac56d8f3fcd`，而行为成果已经是 `c7420af` 和 tree `1281d516`。这证明契约尚未吸收新行为，不证明新行为没有交付。

需要补齐的共享定义至少包括：

1. I01-I05 的完整请求、成功响应、身份对象和 Cookie 产生时点；输入边界、规范化、条款、记住我和严格字段表要从 G01-G06 的当前行为更新，不能继续使用旧 `Core` 片段。
2. I02/I04 的发码成功、投递失败、等待、冷却、重发替换、挑战绑定、过期、错误次数和已消费结果，以及 I03/I05 的对应副作用和重试语义。
3. I06 的身份检查或恢复交换。当前契约只把 I06 保留为候选，没有可调用的路径、凭据要求、成功/失效响应或完整用例。
4. I07 的退出请求体、凭据要求、影响范围、重复/无会话结果、成功/失败/未知结果、Cookie 清除和回登录时机。当前仅确认 `POST /api/auth/logout`，而行为基线还明确 CA53 退出入口暂缺。
5. 真实凭据拒绝、注册关闭、账户存储故障、邮件链路故障、未知响应、迟到结果和账户隔离的 Problem Details、状态码、恢复条件与前后端双向用例。

### 正式认证实现归属

固定基线没有新的目标认证实现。当前实际代码仍是旧应用：

- `apps/api/src/app.js` 提供旧的 `/api/auth/login`、`/api/auth/register`、`/api/auth/password-reset/request` 和 `/api/auth/password-reset/confirm`，返回 Bearer token 或旧消息结构。
- `apps/api/src/middleware/requireAuth.js` 从 `Authorization: Bearer` 读取 token。
- `apps/web/src/utils/api.js` 和 `apps/web/src/store/useAppStore.js` 使用 localStorage 中的 `refatos-token`。
- 旧 API 的注册直接接收确认密码，旧找回路径与新契约的发码/重置地址不同，也没有新契约要求的 Cookie、来源防护和完整 Problem Details 交付。

这些文件属于正式认证实现拥有者的后续实现范围，不能由 A10 或 B12/B14 临时改契约来适配。A11 的任务边界是引入已审查的认证负责人提交，并实现工作台身份适配、路由门禁、账号展示、设置退出和集成 E2E，不拥有认证实现本身。

### A10、A11、A12 的交接归属

- A10 写 `docs/arch/auth-handoff.md`、工作台侧接入场景和接缝清单；需要固定认证负责人提供的契约、实现、真实邮件/会话/账户恢复证据。A10 不修改上述认证文件或认证实现。
- A11 消费 A10 和 B16 的固定输入，写工作台身份适配、门禁、账号展示、设置退出及相关集成证据；不修改认证负责人提交。
- A12 在 A11 固定候选上用真实账户验证登录、退出重登、Cookie 失效/重登、跨设备持久对象和跨账户隔离；测试身份或手工注入 Cookie 不能替代真实认证。

## 其他任务写入核查

核查了固定基线的 Git 历史、已知 worktree 状态和认证相关路径，没有把 queue 投递当作运行证明，也没有检查活动进程或联系任何 session。

- `git worktree list --porcelain` 中认证行为 worktree `/home/liam_t/项目/TeacherWorkspace-auth-behavior` 已标记为 prunable，实际目录不存在；`design/auth-behavior-completion` 分支仍指向旧的 `a496c5a`。这只能说明旧 worktree 元数据残留，不能说明行为成果没有进入仓库。
- 已知并行 worktree 中没有看到另一份新的正式认证实现。B12 正在写 workbench identity/test-principal 接缝，B14 正在写工作台 `App.jsx`，两者任务边界都把真实认证留给 A11/认证负责人；它们不是认证交付回执。
- `docs/plans/run-state.md` 仍把 `01a0bea6-5119-7861-b060-e5f1da67947b` 记为等待 `[AUTH_HANDOFF_STATUS]` 主动回执，并明确 queue 不证明 session 正在运行或正式认证已交付。这与仓库中已经存在的 `c7420af` 行为提交并不矛盾：台账缺的是主动交接回执，不是行为 Git 成果。
- 原认证 session 保存记录为 `/home/liam_t/.codex/sessions/2026/09/20/rollout-2026-09-20T07-49-25-01a0bea6-5119-7861-b060-e5f1da67947b.jsonl`。最后可见的 assistant final message 是 ordinal `1316`，时间 `2026-09-20T17:47:54.160Z`，内容确认已确认片段检查通过、完整契约尚未完成、等待行为补齐后再继续。保存记录没有正式 `PASS`/`FAIL`/`BLOCKED` 回执或结果 SHA。

以下事项保持未知，不用推断代替：

- 原认证 session 当前是否仍运行、是否有未落入固定基线的外部结果：未知。本次没有做活动检查。
- 其他未登记 worktree、未提交目录或外部存储是否有认证成果：未知。
- queue 消息是否被根 session 消费并转化为正式回执：未知；本页不以投递本身作证明。

## 最小下一步

1. 根先把 `c7420af` 行为版本和本页事实交给认证负责人，要求其返回正式结果版本；不要把 `5757141` 的 partial 契约或旧 `apps/` 认证标为 EAUTH PASS。
2. 认证负责人先以当前 `prototype/` 行为源更新三个契约文件并完成 I01-I07 的共享定义和契约用例，再提交新的正式认证实现、真实邮件/会话/账户恢复交接方式及可复核验证回执。实现和契约缺口分别回认证拥有者，不由 A10 临时补字段。
3. 只有拿到固定的契约加实现候选后，才安排 A10 产出 `docs/arch/auth-handoff.md` 并核对真实身份、退出、来源防护和账户隔离；随后由 A11 接入，A12 使用真实账户独立验收。

## 本次核查边界

本次只读了固定基线、认证契约、当前原型行为和证据索引、README、A10/A11/A12 任务边界、已知 worktree 状态及原认证 session 的保存记录。没有启动 API、原型、浏览器或测试，没有读取密钥，没有修改认证契约、产品、run-state 或其他任务文件，也没有向任何 session 发消息。
