# 认证模块与工作台接线

消费[认证契约](../contracts/auth.md)；实际 UI、测试与未完成环境见[账户规格](../features/identity.md)。

## 最小模块与接缝

沿用 React/Vite、Express、SQLite 单后端及 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)。认证是一个独立深模块：挑战、会话、账户事务和来源防护留在模块内，工作台只取得可信 principal，不读认证表、密码或 Cookie 编码。不建立认证平台、通用事件总线或额外调度服务。

| 对外接缝 | 约定 | 拥有者 |
| --- | --- | --- |
| API 工厂 | `apps/api/src/features/auth/index.js` 导出 `createAuthModule({db, publicOrigin, sendCode, now, isRegistrationOpen}) -> {router, resolvePrincipal}`。router 挂载 `/api/auth`。db 是 B11 已约定的同步 better-sqlite3 实例；publicOrigin 是可信完整 HTTPS 来源。now 为返回 epoch 毫秒的函数，isRegistrationOpen 为同步返回 boolean 的函数；生产默认开放，配置归集成者。 | 认证后端导出；集成者组合 |
| 邮件端口 | `sendCode({purpose, email, verificationCode}) -> Promise<void>`，purpose 为 OpenAPI 枚举、email 规范化；邮件说明10分钟有效，不需要由调用者提前传入成功时点。resolve 仅表示提供者接受；拒绝/未知抛错。真实邮件与可控 fake-mail 是两个实际 adapter，选择由运行配置注入，不向浏览器暴露。 | 认证后端；提供者配置由获授权集成者注入 |
| 身份 | `resolvePrincipal(request) -> Promise<{accountKey:string} \| null>`；接收普通 Node/Express request 的 headers，Cookie+页面绑定对应 active、未撤销/到期且账户有效才返回对象。pending、无凭据、缺页面头、无效身份返回 null；存储不可读抛 Error，不伪装无身份。 | 认证后端；A11 在 B12 留下的 seam 安装 adapter |
| 身份错误 | resolvePrincipal 的服务不可用 Error 带 `status:503` 与 `problem:{type:'/problems/auth/account-store-unavailable'}` 或 session-store-unavailable。A11 adapter 映射到 B11 已有的 `/problems/workbench/temporarily-unavailable`；null 仍由原门禁映射 workbench/unauthenticated。 | A11，只作组合映射 |
| 迁移 | `apps/api/src/features/auth/migrations/index.js` 导出 `migrations`，项 `{id, up(db)}`、auth_ 前缀，同事务 ledger；不改既有迁移。 | 后端提供，共享 runner 由集成者安装 |
| 前端组合 | `apps/web/src/features/auth/index.jsx` 导出 `AuthProvider`、`AuthGate`、`useAuth`。Provider 接 children；Gate 接 children，active时原位渲染children，否则渲染本包账户/恢复界面。useAuth 返回 `{status, account, request, logout}`，status 为 booting/anonymous/pending/active/recovering/error，account 仅 active 时有 OpenAPI Account，其他为null。 | 认证前端；A11 接外壳 |
| 工作台 transport | useAuth.request 采用 `fetch(input, init) -> Promise<Response>` 调用形状；仅同源 `/api`，自动 `credentials:'same-origin'`、当前 X-TeachBuddy-Page，POST等写请求加固定保护头。保留 body/Idempotency-Key，不解析或改写工作台协议。不自动重试业务写入。 | 认证前端；A11 注入现有API client |
| 设置退出 | useAuth.logout 无参数，返回 Promise<void>；内部捕获目标id、锁住当前业务交互，按 I07 完成或抛错。只在确证退出后resolve。设置按钮负责等待/失败反馈，其他认证恢复卡由AuthGate拥有。 | 前端导出；A11 设置接线 |

这些导出已由认证模块和工作台组合采用。B11 的 resolvePrincipal 返回同步值或 Promise 均允许，本包选择 Promise 是其子集；accountKey 仍为长度 1-200 的稳定字符串，工作台 context 的形状与错误命名空间不变。Page header 由通用 transport 添加，基础工作台认证修订的 15 个操作及其后续受保护扩展均要求；缺失、形状非法或绑定失效时 resolvePrincipal 返回null，由工作台映射401。写来源拒绝仍在身份之前，GET不增加来源检查。

A11 在 active 身份变化时先失效旧请求代次/锁住旧草稿，再取现有 workbench context；必须等 context.accountKey 与 auth Account.accountKey 一致才挂载该账户业务数据。暂不可用显示恢复失败，不回退旧身份。昵称只供账号行，永不作授权键。

## 持久化、事务与旧库

认证拥有账户、规范邮箱唯一约束、密码哈希、验证码挑战/预算/消费、浏览器容器、页面绑定和会话状态。Cookie 和验证码使用不可预测值；数据库不存明文密码、Cookie原值或验证码原值。密码使用成熟密码哈希库；验证码校验值应抵抗数据库泄漏后的六码离线穷举（例如服务端密钥HMAC），具体库和加密参数由实现者按正式运行条件选择，不在本设计读取密钥。日志不记录密码、验证码、Cookie或邮件凭据。

容器只为 Cookie 载体和页面身份隔离服务，使用同一 SQLite 即可。认证状态持久化使重启不会复活被撤销会话或重置验证码预算。页面会话刷新后不可恢复，废弃页面绑定可清理；清理不得误删仍有效的记住我会话。没有按账户/设备列举会话的新产品功能。

注册、重置和会话命令的原子边界由契约拥有。SQLite 事务中不等待邮件网络请求；同用途+邮箱在一次发码执行期间串行，邮件接受后原子激活并替换旧挑战。失败保留旧码，进程在外部接受后崩溃也不把未持久激活的新码说成有效；用户可重发恢复。无需为当前单后端新增分布式队列。

账户密码核验可能在事务外执行；在签发/激活以及重置提交时必须核对密码版本/撤销状态，防止重置期间验证过的旧密码在稍后签发新会话。版本方式是内部选择，公开保证不变。工作台每个请求重新获取 principal，不跨请求缓存。已经在重置提交前完成授权的在途业务允许结束；重置提交后的新授权必须失败。认证变更用真实并发用例验证该时点，工作台 mutations 签名保持不变。

旧库升级不保留 Bearer 授权，也不能丢弃已有账户/布局。后端应在隔离的旧库 fixture 上检查真实 schema，给出 additive 迁移：保留原账户稳定标识并映射 accountKey，补充已验收昵称来源；无法从原库取得昵称时不能擅自用邮箱派生，报告该迁移输入缺口给根。没有旧数据时新账户路径可独立完成。旧密码哈希可验证则兼容读、成功登录时升级哈希；不能验证的样本明确给出重新找回路径，不能回示例密码。生产数据迁移及旧入口退役由集成者在获授权后完成，worker 只交代码与隔离证据。

认证恢复的唯一实现为 `apps/api/src/features/auth/recovery.js` 的 `prepareRestoredAuth`，内部约定与外层恢复顺序见[数据管理](../features/data.md#部署备份与还原)。不以轮换密钥或自行清理认证表替代该操作。
