# 账户入口契约

I01-I07 采用认证 `1.0.0-rc.2` 与基础工作台 `0.1.0-candidate.2` 的 PageContext 约定。源版本 `6f3003250d170b44e89f6ac9b0a74f91d658a357`，协议已冻结且真实接入；接线状态与目标环境缺口见[账户规格](../features/identity.md)和[能力证据](../plans/run-state.md#核查入口)。

[OpenAPI](../../apps/api/src/contracts/auth.openapi.yaml)拥有方法、地址、字段、状态码与样本；本文拥有跨操作语义；[交换用例](auth-cases.md)拥有前后端独立验证条件。接线见[技术接线](../features/identity.md#技术接线)，页面见[账户规格](../features/identity.md)。原型 CA/S 编号用于追溯表单场景，入口为[认证行为](../../prototype/behavior/auth.md)，不代表产品已通过对应场景。

覆盖登录、开放注册、两类发码、重置、恢复、记住我失败恢复和退出交换。设置退出已接入真实 I07；CA53 编号仍对应退出场景。注册默认开放，关闭只阻止新注册及注册发码。条款链接不跳转；I08 提供教师自助永久删除；不新增管理后台、条款版本、刷新令牌或 Bearer。术语沿用 [GLOSSARY](../../GLOSSARY.md)；本包的会话、挑战和页面上下文是协议术语，不更改业务词义。

## HTTP 与输入

页面和 `/api` 同源 HTTPS。POST 使用 JSON 和 `X-TeachBuddy-Request: 1`，后端先验证完整 Origin，仅缺失时回退 Referer；来源错误、null、不可解析、两者都缺失或保护头不符统一 403 `request-not-allowed`，不进入业务。不开放跨源 CORS。GET 不改变账户/会话状态，也不执行恢复或激活。

所有成功与失败响应 `Cache-Control: no-store`；有数据直接返回对象，无数据且动作确实完成才 204。错误为 `application/problem+json`、一个主要 `type`；只有对应字段错误带 `field`。保留旧 type 名称，新增枚举见 OpenAPI。可选 `status` 必须等于 HTTP 状态。前端按 type 和当前操作映射既定文案，不解析 title/detail；附加响应字段可忽略，已声明字段及必填结构仍须验证。

前端本地不通过就不发业务请求；确认密码、密码显隐、条款链接、表单状态不传输。邮箱和昵称在提交副本上规范化，键入原文不改。后端先严格验证 JSON 类型，再同样规范化，再做值校验；OpenAPI 的 EmailInput/NicknameInput 描述这一预处理，规范结果由独立 schema 约束。密码和验证码不作任何规范化。trim 精确定义为 ECMAScript String.prototype.trim 的空白集合；小写只对合法 ASCII 邮箱生效，长度按 Unicode code points，不按 UTF-16 单元。邮箱语法、昵称 1-40、密码 8-128、六位 ASCII 验证码的权威约束见 schema，示例不构成固定有效码。

协议首错顺序：来源/保护头、媒体类型、JSON 解析、对象根值、未知字段、必填缺失、字段类型；后两项按请求 schema required 列表顺序，其他字段按 properties 顺序。协议错误不消耗验证码。随后验证页面头形状，再按操作执行下表；表中的浏览器上下文检查指需要的 Cookie 已建立。页面头错误属于 `browser-context-required`，不是 body 字段错误。I06命令根对象通过后，先拒绝不属于任何命令的属性，再判 action 是否缺失、类型或枚举错误；选定命令后按该分支拒绝多余属性、必填和类型错误。未知 action 为 invalid-field-value(field=action)，不猜测命令分支。

| 操作 | 后端值与业务裁决顺序 |
| --- | --- |
| I01 | 邮箱、密码边界、浏览器上下文、账户可读、统一凭据拒绝、创建 pending 会话 |
| I02 | 邮箱、注册开放、账户可读、邮箱未占用、冷却、发码 |
| I03 | 邮箱、注册开放、昵称、密码、challengeId 形状、验证码形状、条款 true、浏览器上下文、账户可读、挑战绑定/生命周期/值、邮箱仍未占用、原子提交 |
| I04 | 邮箱、账户可读、账户存在、冷却、发码 |
| I05 | 验证码形状、密码边界、challengeId 形状、邮箱、账户可读、挑战绑定/生命周期/值、原子提交 |
| I06/I07 | 命令形状、Cookie 和页面绑定、目标会话及账户可读、最新撤销/到期检查、相应动作 |

前端仍按 G06 做本地检查，包括注册已知关闭优先和确认密码一致性；服务端的尚未知关闭状态只能在一次请求中返回。注册表单进入、重新获得焦点和提交前读取 I06 的 registrationOpen，已知关闭立即显示 S43；请求到达后的竞态由 I03 事务裁决。前端本地错误不会为查询关闭状态而发送注册业务请求。这里不承诺客户端在无通信时立即获知服务器配置变化。

## 验证码与原子结果

挑战标识 challengeId 由服务端产生，绑定规范邮箱和用途；不是登录凭据。challengeId 为空字符串按 verification-code-missing 定位到验证码控件；其他标识形状错误按 invalid-field-value(field=challengeId) 拒绝。每个用途+邮箱同时只有一个活动挑战。200 发码结果表示邮件提供者已接受投递且挑战可验证，不表示已经到达收件箱；有效期从结果的 issuedAt 起 600 秒，resendAt 为 issuedAt+30 秒，错误预算 5。API 不返回验证码。前端以 serverTime 校准剩余时间，服务端时间为最终裁决，等于 expiresAt 即过期。

同一用途+邮箱的发码串行裁决；冷却期间 429 `code-send-cooldown` 和 Retry-After（向上取整秒数），不发送、不换码。重发成功才替换旧挑战，旧 challengeId 返回 `verification-code-replaced`；用新 challengeId 搭配旧值算一次真实错码。投递拒绝/超时或提交失败返回 503 `code-delivery-unavailable`，旧挑战及冷却不变；提供者结果不明时新码不激活，可能迟到的邮件不保证可用。数据库与邮件不能作为同一原子事务，失败结果只承诺挑战未替换，不能承诺没有邮件抵达。

验证先判断 challengeId 存在、用途/邮箱匹配，再判断已消费、已替换、过期、已耗尽，最后比较值。绑定错误和形状错误不消耗次数。前四次值错为 422 `verification-code-incorrect`，remainingAttempts 依次 4、3、2、1；第五次立即返回 `verification-code-exhausted`，remainingAttempts=0，此后正确码也拒绝。缺失/失效类均定位 verificationCode，要求重新发码，不能当成“密码错”。

注册的账户创建、挑战消费及 pending 会话创建在同一 SQLite 提交中完成。重置的密码写入、该账户全部旧会话撤销及挑战消费在同一提交中完成；并发登录/激活不能跨过重置裁决重新授予旧凭据的身份。存储失败必须回滚这些变化，返回 503 `account-store-unavailable`；正确验证码仍可重试。错误码预算扣减亦须持久化，写失败不声称扣减成功。注册关闭、邮箱冲突等业务拒绝不消费或扣次数，邮箱冲突与错码同时存在时按上表首错顺序。

I03/I05 不使用工作台 Idempotency-Key。重复成功注册通常得到已消费挑战，改用另一挑战则邮箱冲突；重复成功重置得到已消费，不能再次改密。网络断开、超时或结构不明不能证明没有提交：I03/I05 进入 S44，保留输入并以登录恢复；不要自动重复这些业务。只有后端明确的已回滚 Problem 或可证明请求尚未发出才算已知未执行。I01 缺失/畸形响应仍是 S36；I02/I04 结果不明停留原步骤，不安装一个猜出的挑战，等待冷却后重发。已知未执行的缺失结果替身对应 CA102/103 的普通失败；真实网络中无法证明时采用 S44。

## 会话与页面上下文

本段定义 Cookie、当前页及记住我的可实现组合。普通浏览器 Session Cookie 的生命周期不能证明刷新后退出，故增加非凭据页面上下文；不能用 localStorage token 或关闭 Secure 来实现。

- `__Host-teachbuddy_session` 是仅由服务端签发的不可预测 opaque Cookie，固定 HttpOnly、Secure、Path=/、SameSite=Lax，无 Domain。它标识当前浏览器的认证容器；容器内允许页面各自绑定会话，另有至多一个待恢复的记住我会话。只有经过核验的 active 会话才授权业务，空容器不是身份。
- 前端每次文档加载及放弃一次认证上下文时生成新的随机 `X-TeachBuddy-Page`（32 字符小写十六进制），只保存在当前内存。刷新、重开及 BFCache 恢复不能沿用页面级身份。所有认证请求和工作台受保护请求均带此头。它只是 Cookie 容器内的选择器，不含账户信息；单独此头、sessionId、accountKey 均不能授权。不存在的页面绑定不会自动回退到记住我身份。
- 页面初始 GET I06 不含有效 Cookie 时返回匿名状态，不设置 Cookie；POST I06 bootstrap 建立空容器（已有有效容器则保持），回传同一 status，Set-Cookie 初始不带 Max-Age/Expires。前端再 GET 确认浏览器确实携带 Cookie，再允许 I01/I03。禁止在 Cookie 丢失时悄悄切换 Bearer。I02/I04/I05 不依赖已有登录或空容器。
- I01/I03 成功返回 pending Session，不修改 Cookie，不自动授权工作台或恢复。前端只对仍属于当前提交快照的成功调用 I06 activate；rememberMe 使用原提交选择，注册默认 true，不新增注册控件。激活再次验证账户及会话。未记住的激活为 page 模式；记住的激活为 remembered 模式，绝对 expiresAt=issuedAt+7 天，恢复/重试不滑动延期。
- remembered 激活成功设置 Cookie Max-Age 为剩余整秒（不超过 604800），可带一致 Expires。容器 Cookie 可以比某个页面身份活得久，授权始终检查会话；其他已存在的有效页面绑定不得因 Cookie 更新或无关账户重置而消失。新一次激活替换容器的恢复指针，page 激活清空恢复指针，但不撤销其他页面已绑定的独立会话。
- 保存记住我失败返回 503 `session-persistence-unavailable`，pending 保留，进入 S45。继续当前会话调用 activate + rememberMe=false，重试保存调用 activate + true，均不重新登录/注册、不再次消费验证码。成功动作可按同 sessionId/同选择重复，返回当前结果，不延长寿命；已激活后不同选择返回 409 `session-state-conflict`，用户先 GET 核实实际状态。未知激活结果先 GET，不能把已成功的保存宣称失败。
- 新文档 GET 返回 rememberedSession 元数据时显示 S46，POST restore 携带该 id，将仍有效的 remembered 会话绑定到当前页面。restore 不返回或使用浏览器自报账户。恢复等待只显示等待卡；服务故障为 S47，重试同操作。没有恢复目标直接 S14。无 Cookie、目标失效/被替换/已撤销/到期为 401 `session-invalid`，回登录；账户数据损坏为 503，可重试，绝不回种子账户。
- 会话状态 GET 是当前检查，不是缓存。可见页面每 30 秒、重新获得焦点、跨页通知及业务 401 时复核；收到已确认的失效立即锁住工作台。隐藏页在恢复可见时先复核。通知仅触发核验，不是身份依据，含别的 accountKey 的通知不能直接退出当前会话。服务器所有业务请求都实时核验，客户端刷新间隔不是授权宽限。
- I01/I03 的迟到 pending 不激活，用户可用已提交账户重新登录。放弃已知 pending 或恢复目标用 I07 定向撤销，随后更换页面上下文；清除 pending 引用和旧监听。所有 GET、activate、restore 结果仍须检查当前代次、目标 id 和已知失效事件，迟到成功不得回填。取消网络请求不等于撤销服务端操作，放弃请求未知时沿下面的退出未知规则处理。

Cookie 被浏览器完全禁用时，没有任何可用当前会话，应停在可恢复错误而不是声称“继续当前会话”成功。响应往返可确认 Cookie 当前可用，不能证明未来浏览器重开时一定保留；真实重开是验收项目。无需新增前端持久凭据或身份镜像。

## 退出交换 I07

设置入口由工作台 A11 调用 `POST /api/auth/logout`，body 的 sessionId 来自最近可信会话状态，未建立会话时传 null。来源保护始终执行。撤销当前 Cookie 容器中、与请求页面绑定的指定会话；也允许撤销 GET 返回的同容器 remembered 恢复目标。撤销该会话的所有页面绑定和匹配恢复指针，不撤销其他设备/独立登录会话或其他账户。pending 同样可撤销；这不是“退出全部设备”，密码重置和 I08 账户删除会全账户撤销。

已撤销、缺 Cookie、无匹配目标或重复退出均 204，无响应体、不透露其他容器的 sessionId 是否存在。只清除目标；旧退出请求不得撤销同页稍后新建的不同 sessionId。服务端先持久撤销再返回 204。容器已无其他活动/pending/可恢复会话且没有 I08 删除核实回执时，发固定属性相同且 Max-Age=0 的清除 Cookie；还有其他页面会话，或该容器承载未完成/已完成的删除核实时，保留匿名载体，目标身份已无授权。迟到退出不能销毁另一页用于核实删除的唯一 Cookie。缺 Cookie 时仍可发送清除头。

前端收到 204 才宣布退出完成、清除已登录视图并回 S14，按账户锁住工作台草稿而非删除已保存业务内容。已知失败保留退出上下文、显示重试；响应丢失/断网为“退出结果暂未确认”，停止业务交互，重试同一 sessionId 直至 204 或经 I06 证实目标失效。不能只删前端状态就宣称服务器撤销。返回登录表单可先在本页呈现，但有未确认撤销时不得自动恢复旧目标，不能把这一局部呈现报告为已退出。被取消的 activate/restore 与 logout 以目标会话原子串行，已撤销目标不可复活。

## 上游归属与覆盖

用例编号 CC-* 均见 [auth-cases](auth-cases.md)。每个范围内 CA 在下表有唯一入口；纯 UI 场景由前端验证，不为其创建 HTTP。

| CA | 交互/归属 | 用例 |
| --- | --- | --- |
| CA01、CA05、CA08、CA10、CA19、CA26、CA28、CA29、CA37、CA39、CA40 | 前端表单、键盘、显隐、确认密码、返回/绑定展示 | CC-UI |
| CA02、CA03、CA04、CA11、CA12、CA15、CA16、CA17、CA18、CA20、CA21、CA23、CA24、CA30、CA31、CA33、CA34、CA36 | 本地校验；绕过前端的 I01-I05 独立拒绝 | CC-INPUT |
| CA06、CA09、CA49、CA50、CA51、CA95 | I01/I03/I06 会话寿命 | CC-SESSION |
| CA07、CA25、CA76 | I01/I03/I06 身份交接；引导与账号行归工作台 | CC-HAPPY |
| CA13、CA14、CA27、CA32、CA55、CA56、CA60、CA61、CA62、CA64、CA78、CA94 | I02/I04 发码/重发/绑定 | CC-SEND |
| CA22、CA35、CA57、CA58、CA59、CA92、CA93、CA105 | I03/I05 挑战验证 | CC-CODE |
| CA38、CA54、CA63 | I05 重置与新密码登录 | CC-RESET |
| CA41、CA42、CA44、CA45、CA46、CA77、CA100、CA107 | I01 凭据与服务失败 | CC-LOGIN-FAIL |
| CA43、CA47、CA48、CA82、CA83、CA84、CA85、CA86、CA87、CA88、CA89、CA90、CA91 | I01-I06 请求快照/迟到 | CC-RACE |
| CA65、CA66、CA104 | I02/I03/I06 注册关闭 | CC-CLOSED |
| CA67、CA68、CA101、CA102、CA103 | I01-I05 未知结果 | CC-UNKNOWN |
| CA69、CA70 | I03/I05 持久回滚 | CC-STORE |
| CA71、CA79、CA80、CA81、CA120 | I06/I07 保存失败、继续、重试、放弃 | CC-PENDING |
| CA72、CA73、CA96、CA97、CA98、CA106 | I06 恢复等待/故障 | CC-RESTORE |
| CA52、CA99、CA108、CA109 | I05/I06 目标撤销及隔离 | CC-ISOLATION |
| CA74、CA75、CA110、CA111、CA112、CA113、CA114、CA115、CA116、CA117、CA118、CA119 | 精确输入、规范化、首错 | CC-BOUNDARY |
| CA53 | 设置退出调用 I07 | CC-LOGOUT |

| 状态 | 契约归属 |
| --- | --- |
| S7 | 工作台已有引导，只消费成功交接 |
| S14-S18 | 前端表单；I01-I05、I06 的入口/成功结果 |
| S19-S20 | 本地错误或对应字段 Problem |
| S21 | active 身份交接到工作台；pending 不得进入 |
| S36-S37 | 已知失败或重置 204 的结果反馈 |
| S38-S41 | 请求等待、发码冷却、验证结果和绑定邮箱 |
| S42 | 保留但当前不产生，无对应新接口 |
| S43-S44 | 注册关闭和业务结果未知 |
| S45-S47 | I06 的保存失败、恢复等待、恢复失败 |

## 账户删除交换 I08

`POST /api/auth/account-deletion` 接受封闭请求 `{requestId, sessionId, email}`。requestId 是浏览器用加密随机源产生的 32 字节小写十六进制串；sessionId 来自当前可信会话，email 使用既有邮箱规范化。来源保护、页面头、类型和无缓存规则不变。首次请求必须通过当前 Cookie、页面绑定、active 会话和账户校验，确认邮箱必须与该账户相同；错误邮箱为 422 `deletion-confirmation-mismatch`，未授权为 401 `session-invalid`。

受理事务先记录删除意图并撤销该账户全部会话、页面绑定和记住我指针。此后旧 principal、在途写入、登录和密码重置均不能重新授予该账户写权限。清理范围归[账户永久删除](../features/data.md#账户永久删除)：等待该账户作业与进程结束，清理受管文件和业务资料，再原子删除认证账户、全部挑战及旧认证镜像。其他账户继续使用。

完成前保留账户锁和受管文件清单；清理失败为 503 `deletion-incomplete`，不是已回滚承诺。只在上述清理全部完成后返回 204。完成回执仅保留 requestId 的 SHA-256、原 Cookie/sessionId/规范邮箱/requestId 的 HMAC 证明、原 Cookie 的容器摘要和完成时间，不再保存账户标识、邮箱或文件清单。

原请求可在同 Cookie 下重复核实，刷新后的新页面头仍须合法。HMAC 核实只允许完成原删除，不建立身份；其他 Cookie、改动的 body 或新 requestId 不可代用。204 回执不清容器 Cookie，以便回执丢失后继续核实，也不影响同容器其他账户。新请求遇同账户删除已受理为 409 `deletion-in-progress`。前端发出前持久保存原意图；任何未知、401 或匿名状态都不能当成删除成功，只有原请求 204 才清理本设备资料并进入匿名页。同邮箱重新注册创建新 accountKey，不继承旧数据。

维护恢复会清除已完成回执和原浏览器容器。I08 返回 browser-context-required/session-invalid 后，前端通过 I06 读取确认原浏览器上下文是否已失效；只有该失效已确认才提供显式重新准备登录。页面如实说明原删除结果无法核实，清除本页核实意图后沿现有 bootstrap 建立新上下文，保留该账户设备资料，不调用旧会话 logout、不宣告删除成功。普通503或读取结果未知继续保留原请求核实；恢复后的账户与资料以重新登录读回为准。

## 部署恢复的认证撤销

当前内部契约为 `auth-recovery/2`，要求账户删除迁移及完成回执清理。当前候选按[核查入口](../plans/run-state.md#核查入口)验证，旧 revision 的结果不能证明当前恢复契约。这里拥有认证接口、表级不变量和错误；整体停服、复制、两次读回复核、开放及回退流程只归[数据恢复](../features/data.md#部署备份与还原)。它不是 I06 的浏览器 remembered 会话恢复。

### 唯一操作接口

内部 Node 导出已实现，CLI 由数据恢复层包装；认证本身不开放恢复 HTTP：

```js
import { prepareRestoredAuth } from './features/auth/recovery.js';

// 同步调用；db 是已迁移的隔离恢复库的 better-sqlite3 连接。
const result = prepareRestoredAuth({ db });
// 仅在 COMMIT 成功后返回：
// {
//   contractRevision: 'auth-recovery/2',
//   outcome: 'cleared',
//   removed: { pageBindings: 3, sessions: 2, containers: 1, challenges: 4, deletions: 1 },
//   remaining: { pageBindings: 0, sessions: 0, containers: 0, challenges: 0, deletions: 0 }
// }
```

输入只接受 `db`，不接收 accountKey、Cookie、AUTH_CODE_SECRET、email 或 sessionId。不需创建 auth router，不启动服务，不加载邮件或环境密钥。返回计数为本次事务内非负整数；`remaining` 五项必须均为 0。返回值不是可在其他路径/下一轮恢复中复用的开放许可证。

调用方是 F62 的离线恢复流程，后续 D71 复用。认证实现负责表结构和事务，F62 只知道本接口、恢复顺序及结果；F62 不复制清理 SQL、不反向依赖内部 store。

#### 前置条件与拒绝

1. F62 只传独立恢复副本的连接。原库、备份源与恢复目录必须物理分离，排除同路径、软链接及硬链接别名；原库和原备份均不作恢复写目标。打开目标须要求文件已存在，路径错误不能隐式创建空库。
2. 目标无其他连接、服务进程、后台作业或流量；关闭旧应用及其所有后台写者，停止自动重启，排空/终止在途请求。数据库写锁不等于服务停用，`offline: true` 一类自报布尔值也不算证明。
3. F62 通过已有共享 runner 在目标完成支持的迁移、账本兼容和库完整性检查，保留迁移账本。当前支持的认证集是 `auth_0001_accounts`、`auth_0002_challenges`、`auth_0003_containers`、`auth_0004_sessions`、`auth_0005_meta`、`auth_0006_legacy_accounts`、`auth_0007_drop_auth_meta`、`auth_0008_account_deletions`。更老库先按支持链迁移；未知/缺失认证迁移、缺表/必需列、非空 `auth_legacy_gaps` 均不得继续。迁移导致的账户映射变化必须在此之前由原认证拥有者解决，不从业务引用猜建账户。
4. 操作检查持久、可写、已打开的主库连接，未嵌套事务；核对上述认证迁移和所需结构。拒绝附加库参与清理、内存库、只读库及不安全的无回滚日志配置；F62 使用可持久提交的正常 SQLite 配置，不以降低同步保证来绕过错误。不存在“自动建表后当成功”分支。

路径与进程独占归 F62；函数无法从一个连接证明系统中没有其他进程。该能力限制是调用前置条件，不隐含新增锁服务或部署平台。

目标若含 `completedAt IS NULL` 的删除意图，返回 `AUTH_RECOVERY_PRECONDITION`，不撤销锁定、不清理该意图，也不接管来源实例的进程。须在原实例以原请求完成删除，再生成一致备份。

### 原子清理范围

由认证拥有者在一个 `BEGIN IMMEDIATE` 事务中执行下列顺序，全部 SQL 仅指向 `main`。这份清单是认证实现的规范，不是交给 F62 操作者手工执行的配方。

| 次序 | 清理对象 | 必须处理的状态 |
| --- | --- | --- |
| 1 | `DELETE FROM auth_page_bindings` | 全部页面，不按账户、pageId 或会话筛选。 |
| 2 | `DELETE FROM auth_sessions` | pending、page/remembered active、已撤销及已到期会话全部删除。 |
| 3 | `DELETE FROM auth_containers` | 空容器、所有 Cookie 摘要载体及 rememberedSessionId 指针全部删除。 |
| 4 | `DELETE FROM auth_challenges` | 注册及重置的活动、已消费、已替换、过期及耗尽挑战全部删除。 |
| 5 | `DELETE FROM auth_account_deletions` | 已完成的最小删除回执全部删除；未完成意图在事务清理前拒绝。 |

事务内先记录删除计数，再断言五表均空；保护 `auth_accounts` 的全部列（含 id、accountKey、passwordHash/passwordVersion）及 `auth_legacy_gaps`、迁移账本未变。清理实现不写业务表、文件或旧 `users` 表；如发现结构/关联约束不兼容、保留数据发生变化或任何清理失败，回滚整个事务并抛错。固定 schema 无这些清理表到业务表的级联；未来新增此类依赖须先修订本契约。

COMMIT 是唯一成功分界；提交前的计数或日志不得标记成功。错误时如事务仍活动，显式回滚；已知回滚保留调用前目标数据。I/O/进程中断导致提交结果不可确定时，不承诺一定回滚，必须归为结果未知且保持目标关闭。原库不受影响来自副本隔离，不来自对损坏介质的回滚承诺。

重复调用同一尚未服务的副本是幂等的，第二次 `removed`/`remaining` 均为 0。即使第一次已提交但回执丢失，也可在独占且结构/完整性合格的目标重新执行；目标不可信则从原备份重建新副本。普通启动、已开放目标或登录后的数据库不自动重跑，否则会注销新会话。

#### 错误接口

抛出带 `code` 的 `Error`，消息可提供脱敏的阶段信息；不返回部分成功对象，不降级为继续服务。

| code | 情形 | F62 必须采取的动作 |
| --- | --- | --- |
| `AUTH_RECOVERY_PRECONDITION` | 连接/事务/配置条件不符，或调用方发现路径、独占条件不符 | 停止；纠正目标和停服条件后重新开始，不接触原库。 |
| `AUTH_RECOVERY_SCHEMA` | 认证账本/表/列不支持或 legacy gaps 未处理 | 停止；交认证拥有者迁移或修订，不能跳过缺表。 |
| `AUTH_RECOVERY_STORAGE` | 锁竞争、读写、删除、提交或回滚失败 | 停止；保留隔离副本及错误阶段。提交结果一律不靠错误码猜测，重开检查后重跑或重建。 |
| `AUTH_RECOVERY_INVARIANT` | 清理后非空或保留数据变化 | 回滚并停止；归认证实现缺陷/不支持 schema。 |

F62 的复制、文件校验、配置切换或启动错误使用其自身恢复错误分类，但同样不得开放目标。`SQLITE_BUSY` 不能变成跳过清理，也不进行无限重试。日志只保留 revision、阶段、路径标识和计数/错误码，不记录 Cookie、验证码、密码摘要或密钥。

### 恢复后的 HTTP 可观察结果

以下均假定合法页面头、来源、请求形状、可用存储，具体字段仍归冻结 OpenAPI。持有旧 Cookie 的客户端即使保存了旧 pageId/sessionId 也无授权。

| 请求 | 清理后的结果 |
| --- | --- |
| 受保护业务读/写 | resolver 返回 null，工作台 401 `unauthenticated`，不执行写入。非法来源仍优先 403。 |
| I06 GET，携带原 Cookie | 401 `session-invalid`；无 Cookie 的初始 GET 则为匿名 200、browserReady=false。 |
| I06 activate/restore，携带原 Cookie 和旧 sessionId | 401 `session-invalid`；新 bootstrap 后再提交旧 id 仍为 401。 |
| I06 bootstrap，携带原 Cookie | 新随机 Cookie 容器，200 匿名，session/rememberedSession 均 null；不沿用旧摘要或绑定。 |
| I07，携带原 Cookie | 204，可清 Cookie；不泄露旧目标，也不会创建身份。 |
| I03/I05，使用备份里的旧 challengeId/code | 按既有首错顺序通过其他检查后，422 `verification-code-missing`；重新发码才能继续。I03 须先新 bootstrap。 |
| 新 bootstrap 后正常登录/激活 | 通过备份内凭据验证，返回原 accountKey；创建全新 sessionId，正常读写恢复内容。 |

前端按现有会话失效流程重新准备登录；同页重新登录、刷新、旧页面并存以及迟到响应都列入恢复后的行为验收。本 revision 没有增加前端实现要求，若实测发现既有流程无法完成，归认证前端拥有者定向修复并复核受影响契约。
