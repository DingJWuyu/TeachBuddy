# 账户入口契约用例

入口：[账户入口契约](auth.md)。共享定义及交换值的权威来源：[OpenAPI](auth.openapi.yaml)。本文件的用例定义不代表实现或测试已经通过。

基线为入口记录的提交 `a496c5a4727e2900bd110198819295e068739439`。当前只写已能独立明确的共享交换片段；前端独有行为及其余待定映射见入口，完整上游场景见[账户场景覆盖](../../prototype/behavior/auth-scenarios.md)。

## 所有交换的共同前置条件

已确认的 D12-D14 适用于下文所有 HTTP 片段。示例公开来源为 `https://teachbuddy.example.test`，实际测试可替换为其 HTTPS 同源入口，但请求来源头和服务器可信来源配置须一起替换，不代表部署域名已选定。

- 除来源拒绝专项片段外，写请求均带 `X-TeachBuddy-Request: 1`，并由有效 Origin 或 Origin 缺失时的有效 Referer 提供同源依据。前端只设置固定保护头；Origin、Referer 与 Cookie 由浏览器管理，后端直接 HTTP 测试显式提供对应来源。
- 所有响应，无论成功或失败，均检查 `Cache-Control: no-store`。本地拒绝没有 HTTP 响应，不需要为了这项检查发送请求。
- 缓存头不代替会话是否有效的判断，也不代表清除旧页面或表单。当前未定义的成功响应不得因缓存规则已明确而被当作已完成。

## 本地校验与后端拒绝分别验证

职责以[入口的实现职责与请求边界](auth.md#实现职责与请求边界)为准。下表覆盖已验收字段拒绝的片段，不覆盖各 CA 修正后的成功旅程。错误响应例子的权威值在 OpenAPI 中；本地错误无需构造 HTTP 响应。

| 已有场景片段 | 本地不合规值或条件 | 后端拒绝的响应 schema / 例子 | 对应操作 |
| --- | --- | --- | --- |
| CA02、CA11、CA15、CA30 | 邮箱为空字符串 | `EmailEmptyProblem` / `EmailEmpty` | I01、I02、I03、I04 |
| CA03、CA12、CA16、CA31 | 上游场景中的无效邮箱字符串 | `EmailInvalidFormatProblem` / `EmailInvalidFormat` | I01、I02、I03、I04 |
| CA17 | 昵称为三个空格 | `NicknameEmptyProblem` / `NicknameEmpty` | I03 |
| CA04、CA18、CA36 | 密码为 `short` | `PasswordTooShortProblem` / `PasswordTooShort` | I01、I03、I05 |
| CA20-21、CA33-34 | 上游短数字验证码或 `abcdef` | `VerificationCodeInvalidFormatProblem` / `VerificationCodeInvalidFormat` | I03、I05 |
| CA24 | 条款未勾选 | `TermsNotAcceptedProblem` / `TermsNotAccepted` | I03 |

**前端本地拒绝**：按对应上游场景建立表单起始状态，并让此前置状态要求的其他本地校验通过；前置步骤完成后再清零相关认证请求计数。输入表中的不合规值并触发原场景的提交或发码动作，检查已有文案及位置，同时断言此次触发没有调用对应 I01-I05。不能让替身先返回 422 才显示本地校验错误，也不增加一个单独的远程字段校验接口。

**前端处理后端拒绝**：另用替身响应注入对应的 HTTP 422、`application/problem+json` 及上述 OpenAPI 例子，检查前端按 `type` 和 `field` 在该操作的既有字段位置显示上游文案。密码在重置页使用“新密码”的既有提示。前端不能依赖后端 `title` 或 `detail` 选择文案，也不能因为自己有本地校验就丢弃这些已定义的后端拒绝。完整请求上下文尚缺时，这只是响应映射片段，不是完整提交用例；在途修改或离开页面后的处理仍待 G01。

**后端独立拒绝**：完整请求定义补齐后，直接向上述对应操作发送请求，仅将目标字段改为表中的不合规值，其他已定义输入、绑定及业务前置条件保持有效。后端必须返回该操作允许的 422 例子，不发送邮件、不创建账户或完成密码变更。现阶段已定义拒绝响应及已知规则，但注册、重置等操作的完整有效起始请求仍待相应 G 项，不能用不完整的 Core 片段冒充可执行的全流程用例。

缺少 JSON 属性使用 `required-field`，属性类型不符使用 `invalid-field-type`；字符串为空及条款 false 使用本节的产品字段错误。验证码字符串不符合六位数字形状与真实值不匹配分开；后者由后端判断，见下文 CC-CA22-CA35-incorrect-code。其他生命周期拒绝及完整上下文仍待 G02。

**前端独有行为**：对 CA05 的显隐、CA19/CA37 的确认密码不一致、CA26 的空闲表单切换、CA28 的条款链接和 CA29 的空闲进退，只检查上游定义的页面状态，以及动作本身没有产生额外认证调用。确认密码不进入请求；这些行为不产生后端拒绝 schema。涉及先前在途请求的扩展情况仍待 G01。

## D11-D14 的载体与缓存验证要求

状态：同源访问、Cookie 名称及固定属性、请求防护和缓存规则已确认；具体成功响应、到期属性及产生或清除凭据的时点仍待 G03，因此本节不是完整登录或会话恢复用例。

- 前端的替身后端应通过页面同一来源的 `/api` 提供业务响应。验证请求的实际来源关系，不能只匹配路径后忽略它被发往另一个域名或端口。
- 验证 Cookie 行为时，替身从实际 HTTPS 同源响应设置 `__Host-teachbuddy_session`，带 `HttpOnly; Secure; Path=/; SameSite=Lax` 且没有 Domain，由浏览器接收并在适用请求中携带。不能用前端写入 document.cookie 或 localStorage 的办法模拟，也不为联调省略 Secure/HttpOnly。
- 后端测试检查 Set-Cookie 的名称及固定属性，浏览器测试通过浏览器工具或后续实际请求观察保存和携带结果；不要求前端脚本读取凭据。具体产生或替换凭据的操作条件、Expires/Max-Age 仍待 G03 的完整交换定义，不以缺少到期属性猜测用户关浏览器后的结果。
- 浏览器前端不读取会话 Cookie、不从浏览器存储取得令牌、不拼接 Bearer 头，也不因 Cookie 存在而自行宣布身份有效。可见身份仍由已确认的后端结果决定。
- 检查认证响应有 no-store；若契约要求发起新的认证请求，前端不能用 Service Worker 或应用响应缓存直接代替该请求。此断言不禁止使用当前页面显示数据，也不代替未来的退出、刷新和过期用例。
- Cookie 的生命周期、失效及退出后的结果不能由载体断言推导。OpenAPI 规范结构检查无法证明浏览器实际执行了 Cookie 属性、来源检查或缓存策略，这些运行验证尚未执行。

## CC-CA13-occupied：注册邮箱已占用

状态：交换及两侧断言已定义，未执行。覆盖 CA13 的占用拒绝及修改输入清错片段，状态为 S15 -> S20 -> S15；不覆盖最终发码到 S16 的恢复结果。

### 起始条件

- 注册入口可用，本次没有其他导致拒绝的前置条件。入口关闭政策不在此用例决定。
- 已有教师账户的邮箱为 `example@example.com`，当前用户处于注册未发码状态 S15。
- 邮件测试收件箱或发送观察点从空记录开始；其他会话及网络故障不注入本用例。

### 输入与共享结果

用户输入 `EXAMPLE@example.com` 并点击发送验证码。对应交换为：

```http
POST /api/auth/registration-codes
Content-Type: application/json
Origin: https://teachbuddy.example.test
X-TeachBuddy-Request: 1

{"email":"EXAMPLE@example.com"}
```

结果使用 OpenAPI 的 `components.responses.EmailAlreadyRegistered`：HTTP 409、媒体类型 `application/problem+json`，响应头 `Cache-Control: no-store`，响应值采用 `components.examples.EmailAlreadyRegistered`。该例子的 `type` 和 `field` 是确定的；可选标准说明字段不影响前端分支。

这里的大小写变化来自已验收 CA13。此断言只要求同一已注册地址的该变化仍被识别为占用，不替代 G06 中完整邮箱归一化与显示规则。

### 前端如何用替身后端验证

1. 在未发码注册卡开始计数相关操作。替身后端匹配上述 POST 请求，返回 OpenAPI 中的 409 例子；无需启动邮件或账户存储。
2. 用户点击后，对比请求方法、同源路径、保护头及 `email` 值，确认没有先发一个额外的邮箱占用查询；来源头由浏览器产生。
3. 响应处理完成后，邮箱字段显示[账户行为 S20](../../prototype/behavior/auth.md#states-and-scenarios)规定的占用提示，验证码输入框及已发送说明均不出现，停留在注册卡。
4. 将邮箱改为 `available@example.com`，占用提示清除，验证码输入框仍不出现；尚未再次点击发码时，不应多出发码请求。
5. 此处结束。再次发码到 S16 的响应、等待、投递和重试信息待 G01/G02，不能用猜测的成功响应冒充完整 CA13 覆盖。

前端仍需满足上游 PC、平板、手机的呈现和可访问性规则。请求等待时的按钮或反馈状态尚未由 G01 定义，此用例只断言响应后的稳定状态。

按已确认的 D10，替身响应另加一个测试专用属性 `contractTestExtra: {"value": 1}` 后重复本例，所有可见断言保持一致。该属性仅用于验证前端忽略未使用的响应附加字段，不是要求后端新增的业务字段。已有的 `type`、`field` 和可选 `status` 仍须满足其 schema，不能因兼容附加字段而放宽。

### 后端如何脱离前端验证

1. 为隔离测试建立一个已占用上述邮箱的账户，并满足注册能力开放的前置条件；使用可观察邮件投递结果的测试环境或替身。
2. 直接提交上述 HTTP 请求，无需浏览器或前端表单。
3. 断言 HTTP 状态为 409、媒体类型为 `application/problem+json`，响应满足 `EmailAlreadyRegisteredProblem`，且若包含 `status` 则必须等于实际 HTTP 状态；同时检查 no-store。
4. 断言没有发出注册验证码邮件，也没有新增教师账户。

账户测试数据的装载方式、邮件观察工具及数据库清理由后端实现者选择；它们不是新的产品接口。该用例可以检验发码前的占用拒绝，但不证明并发注册、投递故障或验证码生命周期正确。

## CC-P01 至 CC-P03：通用协议拒绝片段

状态：协议输入、拒绝响应及两侧协议断言已定义，未执行；页面反馈及恢复仍待 G01。本组来源是用户确认的 D07-C，不是新增的上游 CA 场景，也不计入 CA01-CA40 的完整行为覆盖。

三个片段均向 I02 `POST /api/auth/registration-codes` 发送下表的原始请求体，带本文件共同前置条件规定的匹配 Origin 和正确保护头。前置条件为注册能力开放，且没有其他竞争拒绝条件。精确响应体引用 OpenAPI 的例子，媒体类型为 `application/problem+json`，响应头有 no-store。请求媒体类型按本表构造，CC-P02 故意使用 text/plain。

| 片段 | 请求 Content-Type | 原始请求体 | HTTP 状态 | 响应 schema / 例子 |
| --- | --- | --- | --- | --- |
| CC-P01 | `application/json` | `{"email":`，在冒号后结束 | 400 | `MalformedJsonProblem` / `MalformedJson` |
| CC-P02 | `text/plain` | `{"email":"available@example.com"}` | 415 | `UnsupportedMediaTypeProblem` / `UnsupportedMediaType` |
| CC-P03 | `application/json` | `[]` | 422 | `InvalidRequestBodyProblem` / `InvalidRequestBody` |

后端脱离前端验证：分别直接发出上述请求，检查 HTTP 状态及响应媒体类型，按引用的 schema 校验响应；`field` 必须不存在，可选 `status` 必须等于 HTTP 状态。请求被拒绝后不发送验证码邮件，也不创建教师账户。这里只检查已给出的单一协议拒绝，不定义与入口关闭等条件同时出现时的优先级。

前端使用替身后端验证：在注册发码交互的响应边界逐一注入对应状态和 OpenAPI 例子，检查前端识别该 `type` 与状态，并且没有凭空补充一个 `field`。每个例子加上测试专用附加属性后，已识别的协议结果不变。正常前端不需要主动生成非法 JSON 或错误媒体类型；替身在此注入协议故障结果。用户可见提示、页面停留、重试及恢复断言尚待 G01，因此这些片段不是完整前端行为用例。

## CC-S01：请求来源与保护头

状态：协议拒绝及两侧验证条件已定义，未执行；其用户可见提示和恢复仍待 G01。来源是已确认 D13，不是新增上游 CA 场景。

后端拒绝用例使用 I02，注册能力开放，邮箱 `available@example.com` 未被占用，无其他竞争拒绝条件；本例不调用发码成功路径。基线请求为：

```http
POST /api/auth/registration-codes
Content-Type: application/json
Origin: https://teachbuddy.example.test
X-TeachBuddy-Request: 1

{"email":"available@example.com"}
```

每次只按下表改变来源检查或保护头这一拒绝条件；其余有效前置保持不变。下表的来源地址为精确示例，不代表允许的站点列表。

| 变化 | 补充头 | 预期 |
| --- | --- | --- |
| Origin 改为 `https://other.example.test` | Referer 为 `https://teachbuddy.example.test/login` | 403，不因 Referer 相符而绕过已有的错误 Origin |
| Origin 改为 `null` 或 `not-a-uri`，分别执行 | 同上 | 403，不将有值的无效 Origin 当成缺失 |
| 移除 Origin 和 Referer | 无 | 403，不能取得来源 |
| 移除 Origin | Referer 为 `https://other.example.test/login` 或 `not-a-uri`，分别执行 | 403，回退来源不符或无法解析 |
| Origin 改为 `https://teachbuddy.example.test.attacker.test` | 无 | 403，不按前缀匹配 |
| Origin 改为 `https://child.teachbuddy.example.test` | 无 | 403，不按主机后缀放行子域 |
| Origin 改为 `http://teachbuddy.example.test` 或 `https://teachbuddy.example.test:444`，分别执行 | 无 | 403，协议或端口不同 |
| 来源不变，删除 X-TeachBuddy-Request | 无 | 403，缺少保护头 |
| 来源不变，保护头改为 `0` | 无 | 403，保护头取值不符 |

所有拒绝返回 OpenAPI 的 `RequestNotAllowed` 响应和例子：HTTP 403、`application/problem+json`、no-store，满足 `RequestNotAllowedProblem` 且没有 field。断言没有发码邮件、账户创建、密码或会话的业务变更。这里只固定单一防护条件失败的结果，不推导与其他拒绝同时发生时的全部优先级。

正向对照复用 CC-CA13-occupied 的已占用邮箱，避免捏造尚未定义的发码成功响应：一组使用有效 Origin 与保护头；另一组移除 Origin，使用同源 Referer `https://teachbuddy.example.test/login` 和保护头。两组均应到达既有 409 占用拒绝，而非被误拦为 403。

前端使用同源替身验证：页面实际发出的认证 POST 带固定保护头，前端不手动伪造 Origin/Referer，且本地校验拒绝仍没有请求。替身注入上述 403 响应时，前端识别为无字段的协议拒绝，不能挂在邮箱、密码或验证码字段；具体可见反馈和恢复仍待 G01。

验证跨站攻击路径时，额外页面尝试普通表单提交与带自定义头的跨源脚本请求，观察服务器确实未产生业务变更，也未开放跨源访问。浏览器可能阻止发送预检后的请求或阻止脚本读取拒绝响应；不能仅凭页面拿不到响应就认定服务端防护正确。原始头的负例由上述后端直接 HTTP 用例验证。

## CC-CA22-CA35-incorrect-code：验证码值不匹配

状态：D07-E 的拒绝响应及两侧断言片段已定义，未执行。分别映射 CA22 的 I03 注册提交与 CA35 的 I05 密码重置；完整验证码绑定请求及修正后的成功流程仍待 G01/G02/G03 等对应缺口。本片段不扩展上游 CA 编号。

前置条件是验证码字符形状正确，已建立相应操作所需的有效验证码上下文，其他输入及前置条件均有效；仅提交值与该上下文的真实验证码不同。条款未勾选、验证码过期、已消费、地址不匹配、次数限制等竞争条件不放入本片段。如何建立和传递这个上下文尚未确定，因此此处没有用 Core 输入拼出一个看似完整的请求。

响应使用 OpenAPI 的 `VerificationCodeIncorrectProblem` 及 `VerificationCodeIncorrect` 例子：HTTP 422、`application/problem+json`、no-store，错误定位到 `verificationCode`。不能返回 `verification-code-invalid-format`，也不能复用原型固定正确码作为真实有效性的依据。

**前端使用替身后端验证**：让表单通过本地校验，在 I03 或 I05 的响应边界注入上述拒绝；前端在对应验证码字段显示上游已有错误提示，不能将这次失败当成注册成功或密码重置成功。前端无需知道真实验证码，也不能仅因其值不同于原型示例码就本地拦截。替身响应增加未使用的测试属性后，仍识别同一错误。未补齐请求上下文前，这只是响应映射片段；在途输入变化、重复提交及后续修正结果仍按 G01/G02 补齐。

**后端脱离前端验证**：待完整上下文定义后，为 I03 与 I05 分别准备其有效验证码及完整请求，只把提交的验证码替换为另一个形状正确但不同的值。断言上述拒绝响应，不创建账户、不更改密码，也不建立已认证身份。错误次数记录、是否消费验证码等生命周期副作用由 G02 另定，不能从本片段推导。输入准备完成前不把这些要求记为可执行或已通过的测试。

## I07 退出用例的待定义边界

D05-B 已确定 `POST /api/auth/logout`，对应 CA07/CA25，沿用 D13 来源防护及 D14 响应缓存规则。完整请求、凭据要求、影响哪些会话、无会话或重复退出的结果、成功状态及响应体、页面和凭据清理时点仍待 G01/G03。当前不编造空请求体或 204 交换；仅凭地址和通用 403 定义不能执行完整退出用例。

## 已确定响应、尚缺完整请求的协议片段

以下定义了响应及拒绝原因；输入改动说明不是可直接运行的完整 HTTP 用例。须先补齐相应操作的请求上下文，才能固定没有竞争错误的起始请求。

| 拒绝原因 | 响应 schema / 例子 | 后续完整用例所需输入 |
| --- | --- | --- |
| 缺少必填字段 | `RequiredFieldProblem` / `RequiredEmail` | 从该操作的完整有效请求中只删除 `email` 属性；不能用空字符串代替删除 |
| 字段类型错误 | `InvalidFieldTypeProblem` / `InvalidEmailType` | 其他输入有效，只将 `email` 改为数字或 null；字符串的邮箱格式校验属于另一类规则 |
| 未知字段 | `UnknownFieldProblem` / `UnknownField` | 完整 schema 已封闭，向有效请求只增加一个确定未声明的字段 |

这三类结果都返回 422。前两类例子要求 `field: email`；未知字段结果不得有 `field`。前端协议解读可使用这些固定响应的替身，具体页面行为仍待 G01。后端完整请求与未知字段判断待 G02/G03 等输入上下文，不能根据当前 Core 片段猜测。

## 响应结构校验边界

D10 要求保留对已声明数据的检查：已占用例子删除 `type`、删除 `field`、将 `field` 改成 `password`、把可选 `status` 改成 422，均不符合 `EmailAlreadyRegisteredProblem`。无字段协议错误增加 `field` 也不合规。增加未使用的附加属性则仍然符合原 schema。

这些是共享定义的正反例，可以检查响应 schema 及前端响应读取边界；发现不合规响应后的页面反馈不由本段定义，仍待 G01。后端不需要为验证 D10 而在生产响应中主动附加测试属性。

## 其余用例状态

- CA13 的成功恢复片段及 CA14、CA27：待 G01/G02 定义完整发码交换。
- CA25 可复用上述占用拒绝；I07 退出地址已确认，创建账户及退出的完整前序交换仍待 G01-G05，不能将本例替代整条 CA25。
- 400、415、四类 422 协议错误及六类已有字段拒绝都有精确标识、响应结构和例子。六类字段拒绝按业务操作限制可用结果，并分别说明本地拦截、响应映射及后端独立校验。CC-P01 至 CC-P03 只定义协议片段；完整输入及新增故障的页面行为仍未齐全，没有把这些片段标成完整的前后端行为用例。
- CC-CA22-CA35-incorrect-code 另定义后端裁决的验证码值不匹配拒绝，只适用于 I03/I05；完整请求及恢复待相应 G 项，不属于前端本地真实性校验。
- 其他共享场景及前端独有场景的映射由[契约入口](auth.md#上游覆盖映射)拥有。本文件没有额外隐藏的通过记录或自动测试入口。
