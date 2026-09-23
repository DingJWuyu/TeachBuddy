# 账户：登录、邮件与退出

真实 Cookie、验证码、注册、找回、恢复及退出已接入；本地 fake-mail 独立证据和真人 QQ 收件反馈各有范围，跨设备、目标网络及部署恢复未全验。认证语义唯一归[认证契约](../contracts/auth.md)，表单细节仍可按其 CA 场景进入原型参考。

## 用户目标

教师可以用保存昵称的账户进入工作台，收取验证码注册或重置密码，在网络和保存失败后继续原流程，并确认退出是否完成。账户行为拥有注册/登录/找回/恢复卡；工作台拥有账号行、已有首次引导与设置退出按钮。协议的 pending、页面头、Cookie 容器均不出现在产品文案中。

## 状态接线

| 用户所见 | 触发与下一步 |
| --- | --- |
| 启动 | 首次状态读取期间保持中性入口占位，不先渲染登录或工作台；确认没有恢复目标立即S14。只有确有恢复目标才显示S46恢复卡，随后提交restore。 |
| 登录/注册提交中 S38 | 业务成功pending仍属于交接过程，继续activate；active确认前不挂载工作台。记住我沿提交快照，注册默认true，不加新控件。 |
| 保存失败 S45 | 明确“账户操作已完成，登录状态未保存”；继续当前会话、重试保存、返回登录。前两个只调用会话操作，不重新创建账户/验证密码/消费验证码；已失效则回登录提示过期。 |
| 恢复等待/失败 S46/S47 | 等待卡不闪现其他内容；临时故障提供重试和返回登录。返回时定向放弃恢复目标，任何迟到结果不得改变当前表单。 |
| 未知结果 S44 | 注册或重置可能成功时保留输入，以中性提示说明未确认，提供回登录恢复。无已确认成功前不显示成功横幅、不自动重复业务。 |
| 退出等待/失败 | 设置按钮等待并禁用重复触发；204后回登录。失败保留上下文可重试，未知时停止业务交互并提示“退出结果暂未确认”，重试相同目标；不能伪装退出完成。 |
| 身份失效 | 收到当前身份失效的可信结果，锁住当前账户现场，清已登录视图，回S14说明过期；其他账户通知只触发核验，不直接清页面。 |

页面内提交快照和界面编辑代次分开。编辑字段/换邮箱/切用途/切卡后，旧响应仍可能有业务副作用，但不能清新输入、安装旧挑战或跳入工作台。S45离开后须解绑旧pending及事件监听，覆盖 CA120。请求取消只停止等待，不作为业务回滚证明。

## 保持既定呈现

- 字段错误落字段下；非字段问题用可关闭顶部横幅。只有凭据拒绝清密码，其他可恢复失败保留输入。
- 找回第一步成功发码后才进入第二步，邮箱只读；更换邮箱返回第一步清挑战并重新发码。不使用保留状态S42。
- 发码结果只说明已发送请求被接受；未收件时保留有效期、冷却、重发及换邮箱路径。长地址省略且全文可访问。
- 昵称完整值交工作台，账号行省略、无障碍名完整，头像保留完整Unicode字符；邮箱不作昵称替代。
- PC 1440×900、平板768×1024、手机390×844均检查错误、等待、S44-S47及设置退出的可见状态、焦点、键盘、触摸和溢出。UI只做浏览器交互验证，不写单元测试。

CA53 仅记录原型未提供设置退出按钮；产品设置已经接入真实退出。账户与工作台入口已组合，当前本地及真人邮件证明见[能力证据](../plans/run-state.md#证据边界)，不据此宣称三端、跨设备和目标网络全部验收通过。

## 实现与验证入口

Web `apps/web/src/features/auth/`，API `apps/api/src/features/auth/`；邮件 `apps/api/src/core/mail.js`；组合 `apps/api/src/app.js`。接线细节见[技术接线](#技术接线)，恢复撤销见[数据管理](data.md)。

隔离真实组合入口 `apps/web/e2e/auth-integration.config.mjs`、`apps/api/test/auth-integration.test.js`。测试收件器不能证明真实邮件送达；发信故障分别核查应用、SMTP 和网络分流，不能以修复为由更改整机代理或向未授权地址发信。

## 技术接线

### 最小模块与接缝

沿用 React/Vite、Express、SQLite 单后端及 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)。认证是一个独立深模块：挑战、会话、账户事务和来源防护留在模块内，工作台只取得可信 principal，不读认证表、密码或 Cookie 编码。不建立认证平台、通用事件总线或额外调度服务。

| 对外接缝 | 约定 | 拥有者 |
| --- | --- | --- |
| API 工厂 | `apps/api/src/features/auth/index.js` 导出 `createAuthModule({db, publicOrigin, sendCode, now, isRegistrationOpen, codeSecret}) -> {router, resolvePrincipal}`。router 挂载 `/api/auth`，先于全局 JSON/CORS 中间件。db 是同步 better-sqlite3 实例且认证迁移已执行；publicOrigin 是可信完整 HTTPS 来源。now 返回 epoch 毫秒，isRegistrationOpen 为同步 boolean 函数，未注入时默认开放注册；codeSecret 或 `AUTH_CODE_SECRET` 必填且独立于数据库保存。 | 认证后端导出；组合入口注入 |
| 邮件端口 | `sendCode({purpose, email, verificationCode}) -> Promise<void>`，purpose 为 OpenAPI 枚举、email 规范化；邮件说明10分钟有效，不需要由调用者提前传入成功时点。resolve 仅表示提供者接受；拒绝/未知抛错。真实邮件与可控 fake-mail 是两个实际 adapter，选择由运行配置注入，不向浏览器暴露。 | 认证后端；提供者配置由获授权集成者注入 |
| 身份 | `resolvePrincipal(request) -> Promise<{accountKey:string} \| null>`；接收普通 Node/Express request 的 headers，Cookie+页面绑定对应 active、未撤销/到期且账户有效才返回对象。pending、无凭据、缺页面头、无效身份返回 null；存储不可读抛 Error，不伪装无身份。 | 认证后端；A11 在 B12 留下的 seam 安装 adapter |
| 身份错误 | resolvePrincipal 的服务不可用 Error 带 `status:503` 与 `problem:{type:'/problems/auth/account-store-unavailable'}` 或 session-store-unavailable。A11 adapter 映射到 B11 已有的 `/problems/workbench/temporarily-unavailable`；null 仍由原门禁映射 workbench/unauthenticated。 | A11，只作组合映射 |
| 迁移 | `apps/api/src/features/auth/migrations/index.js` 导出 `migrations`，项 `{id, up(db)}`、auth_ 前缀，同事务 ledger；不改既有迁移。 | 后端提供，共享 runner 由集成者安装 |
| 前端组合 | `apps/web/src/features/auth/index.jsx` 导出 `AuthProvider`、`AuthGate`、`useAuth`。Provider 接 children；Gate 接 children，active时原位渲染children，否则渲染本包账户/恢复界面。useAuth 返回 `{status, account, request, logout}`，status 为 booting/anonymous/pending/active/recovering/error，account 仅 active 时有 OpenAPI Account，其他为null。 | 认证前端；A11 接外壳 |
| 工作台 transport | useAuth.request 采用 `fetch(input, init) -> Promise<Response>` 调用形状；仅同源 `/api`，自动 `credentials:'same-origin'`、当前 X-TeachBuddy-Page，POST等写请求加固定保护头。保留 body/Idempotency-Key，不解析或改写工作台协议。不自动重试业务写入。 | 认证前端；A11 注入现有API client |
| 设置退出 | useAuth.logout 无参数，返回 Promise<void>；内部捕获目标id、锁住当前业务交互，按 I07 完成或抛错。只在确证退出后resolve。设置按钮负责等待/失败反馈，其他认证恢复卡由AuthGate拥有。 | 前端导出；A11 设置接线 |

这些导出已由认证模块和工作台组合采用。B11 的 resolvePrincipal 返回同步值或 Promise 均允许，本包选择 Promise 是其子集；accountKey 仍为长度 1-200 的稳定字符串，工作台 context 的形状与错误命名空间不变。Page header 由通用 transport 添加，基础工作台认证修订的 15 个操作及其后续受保护扩展均要求；缺失、形状非法或绑定失效时 resolvePrincipal 返回null，由工作台映射401。写来源拒绝仍在身份之前，GET不增加来源检查。

A11 在 active 身份变化时先失效旧请求代次/锁住旧草稿，再取现有 workbench context；必须等 context.accountKey 与 auth Account.accountKey 一致才挂载该账户业务数据。暂不可用显示恢复失败，不回退旧身份。昵称只供账号行，永不作授权键。

### 持久化、事务与旧库

认证拥有账户、规范邮箱唯一约束、密码哈希、验证码挑战/预算/消费、浏览器容器、页面绑定和会话状态。Cookie 和验证码使用不可预测值；数据库不存明文密码、Cookie原值或验证码原值。密码使用成熟密码哈希库；验证码校验值应抵抗数据库泄漏后的六码离线穷举（例如服务端密钥HMAC），具体库和加密参数由实现者按正式运行条件选择，不在本设计读取密钥。日志不记录密码、验证码、Cookie或邮件凭据。

容器只为 Cookie 载体和页面身份隔离服务，使用同一 SQLite 即可。认证状态持久化使重启不会复活被撤销会话或重置验证码预算。页面会话刷新后不可恢复，废弃页面绑定可清理；清理不得误删仍有效的记住我会话。没有按账户/设备列举会话的新产品功能。

注册、重置和会话命令的原子边界由契约拥有。SQLite 事务中不等待邮件网络请求；同用途+邮箱在一次发码执行期间串行，邮件接受后原子激活并替换旧挑战。失败保留旧码，进程在外部接受后崩溃也不把未持久激活的新码说成有效；用户可重发恢复。无需为当前单后端新增分布式队列。

账户密码核验可能在事务外执行；在签发/激活以及重置提交时必须核对密码版本/撤销状态，防止重置期间验证过的旧密码在稍后签发新会话。版本方式是内部选择，公开保证不变。工作台每个请求重新获取 principal，不跨请求缓存。已经在重置提交前完成授权的在途业务允许结束；重置提交后的新授权必须失败。认证变更用真实并发用例验证该时点，工作台 mutations 签名保持不变。

旧库升级不保留 Bearer 授权，也不能丢弃已有账户/布局。后端应在隔离的旧库 fixture 上检查真实 schema，给出 additive 迁移：保留原账户稳定标识并映射 accountKey，补充已验收昵称来源；无法从原库取得昵称时不能擅自用邮箱派生，报告该迁移输入缺口给根。没有旧数据时新账户路径可独立完成。旧密码哈希可验证则兼容读、成功登录时升级哈希；不能验证的样本明确给出重新找回路径，不能回示例密码。生产数据迁移及旧入口退役由集成者在获授权后完成，worker 只交代码与隔离证据。

认证恢复的唯一实现为 `apps/api/src/features/auth/recovery.js` 的 `prepareRestoredAuth`，内部约定与外层恢复顺序见[数据管理](data.md#部署备份与还原)。不以轮换密钥或自行清理认证表替代该操作。
