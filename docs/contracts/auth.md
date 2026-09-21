# 账户入口契约

状态：`AUTH-CONTRACT-CORRECTION@1 / READY_FOR_REVIEW`。本包消费认证 `1.0.0-rc.2` 与工作台 `0.1.0-candidate.2`，尚待外层限定独立冻结；不是认证实现、真实邮件或 A10 通过声明。实际候选 SHA 见 [correction](../acceptance/evidence/AUTH-CONTRACT/v1/correction.md)。

[OpenAPI](auth.openapi.yaml) 唯一拥有方法、地址、字段、类型、状态码、Problem 和样本；本文拥有跨操作语义；[交换用例](auth-cases.md)拥有前后端各自可验证的条件。实现从这三份文件进入。[架构与 A10 交接](../arch/auth-implementation.md)、[UX 接线](../ux/auth-integration.md)、[BDD](../acceptance/auth.feature)和[前后端任务包](../plans/tasks/auth-implementation.md)分别限定实现接缝、界面组合、验收和写入归属。

## 固定输入与范围

| 输入 | 固定版本与入口 |
| --- | --- |
| 原设计输入 | `5b12a9063cc0b692103df73997cb8963506bd9ea`；原设计候选 `fd3f6d5e8d19823aa83a417b99f223c87f4aa713` |
| 本次修订输入 | `7b86b03fb51fa317dc2fade3b1319a53db9247de`；独立报告 `092d7c89cb1386e913ef245a0a6370bede141947` 的 AUTH-CR-001/002 |
| 认证行为提交 | `c7420af8c2740ddee5e01caa6da8bf7f57c134e2`；该提交的 prototype tree 是 `6f4a7d30c16a67b44af1e7a9c1157abb6d065b6b` |
| 集成行为源 | 原设计输入中的 prototype tree `1281d51665a740573a0a6f237b9e37d0335cf2c3`；本次固定输入的认证行为及两份认证场景与 c7420af 字节一致 |
| 已定协议 | `5757141a61e719c8002736ae5af0ac1778dad054` 中 D01-D14 的已确认部分 |
| 行为入口 | [manifest](../../prototype/behavior/manifest.md)、[auth](../../prototype/behavior/auth.md)，J11-J13、J25、G01-G06 |
| 原型证据索引 | [CA01-CA40](../../prototype/behavior/auth-scenarios.md)、[CA41-CA109、CA120](../../prototype/behavior/auth-behavior-scenarios.md)、[输入边界](../../prototype/evidence/verification/input-boundary-report.json)；只是模拟证据 |
| 工作台消费方 | [版本与验收范围](workbench.md#消费版本与验收范围)固定旧 B11/运行输入及新同版消费；本次授权限定写入页面头声明、相关文字和样本。context/accountKey 与模块接缝保持 |

覆盖登录、开放注册、两类发码、重置、恢复、记住我失败恢复和退出交换。设置退出按钮仍归 A11，CA53 原型暂缺不阻塞其协议设计。注册默认开放，关闭只阻止新注册及注册发码。条款链接不跳转；不新增管理后台、条款版本、刷新令牌、Bearer 或账户管理功能。术语沿用 [CONTEXT](../../CONTEXT.md)；本包的会话、挑战和页面上下文是协议术语，不更改业务词义。

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

设置入口由工作台 A11 调用 `POST /api/auth/logout`，body 的 sessionId 来自最近可信会话状态，未建立会话时传 null。来源保护始终执行。撤销当前 Cookie 容器中、与请求页面绑定的指定会话；也允许撤销 GET 返回的同容器 remembered 恢复目标。撤销该会话的所有页面绑定和匹配恢复指针，不撤销其他设备/独立登录会话或其他账户。pending 同样可撤销；这不是“退出全部设备”，只有密码重置会全账户撤销。

已撤销、缺 Cookie、无匹配目标或重复退出均 204，无响应体、不透露其他容器的 sessionId 是否存在。只清除目标；旧退出请求不得撤销同页稍后新建的不同 sessionId。服务端先持久撤销再返回 204。容器已无其他活动/pending/可恢复会话时，发固定属性相同且 Max-Age=0 的清除 Cookie；还有其他页面会话则保留载体，目标身份已无授权。缺 Cookie 时仍可发送清除头。

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
| CA53 | 原型入口明确暂缺；I07 协议由本包设计，A11 接入 | CC-LOGOUT |

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

## 就绪与外部边界

本候选两项修订的结构检查、双向走查与接续条件见 [correction](../acceptance/evidence/AUTH-CONTRACT/v1/correction.md)；旧 author/review 只对应各自固定版本，冻结权归外层独立核验。邮件提供者/发信域/真实收件箱、部署同源 HTTPS、真实持久运行和原账户迁移样本仍需后续交付验证，不能被本包或替身通过替代。

技术格式遵循 [OpenAPI 3.2.1](https://spec.openapis.org/oas/v3.2.1.html)、[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html)；Cookie 服务端寿命与浏览器留存分开处理，参见 [RFC 6265](https://httpwg.org/specs/rfc6265.html)。协议版本沿用既定选择，具体会话组合是为当前行为设计的项目约定。
