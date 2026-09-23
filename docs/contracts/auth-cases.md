# 认证交换用例

状态：`AUTH-CONTRACT-CORRECTION@1 / FROZEN`，消费认证 `1.0.0-rc.2`。本文件是可执行实现的验收规格，不是已通过记录。规范字段、完整样本和错误身份唯一见 [OpenAPI](auth.openapi.yaml)，业务时点与恢复语义见 [契约入口](auth.md)。以下 CC 组覆盖入口所映射的 CA，表内子编号用于实现证据定位。

## 公共运行条件

前端替身使用 OpenAPI components.examples：`Login`、`SendCode`、`Register`、`ResetPassword`、`Bootstrap`、`ActivateRemembered`、`ActivatePage`、`Restore`、`Logout` 为完整输入；`Pending`、`ActiveStatus`、`RegistrationCode`、`ResetCode` 等为成功响应。替身必须模拟完整 HTTP 状态、content-type、no-store 及响应延迟，不能只返回 JS 真值。错误表中的短名 E 表示 `/problems/auth/E`；其 field 和必填扩展由 schema 规定。所有例中密码/验证码都是隔离 fixture，生产不可采用。

API 侧通过真实 HTTP、独立 SQLite、可控时钟和可控投递 adapter 建两个账户 A/B、两个独立 Cookie jar C1/C2；P1/P2 为不同页面头。直接调用补齐同源 Origin 和固定保护头，浏览器调用由浏览器提供来源。bootstrap 后的 Cookie jar 才能登录/注册，Cookie 值不写入证据。故障钩子只在测试进程注入，生产无故障 HTTP 入口。真实邮件使用单列的外部验收，不从 fixture 获取验证码冒充收件。

每个组的“前端”列在只接替身时验证 UI 与请求快照；“后端”列不依赖前端，检查状态码、body、headers、持久结果和副作用。真实集成还要验证浏览器 Cookie、HTTPS、账户隔离及工作台，不能把任一侧单独通过代替全流程。

## CC-PROTOCOL 通用协议

| 子例与输入 | 精确结果 | 前端断言 | 后端断言 |
| --- | --- | --- | --- |
| P01，任意 POST 缺保护头、错误 Origin、Origin=null；再单测有效 Referer 回退 | 403 request-not-allowed；只有 Origin 缺失且同源 Referer 才进入正常处理 | 顶部失败，不当成字段错或清密码 | 故障优先于业务/JSON；账户、挑战、会话不变 |
| P02，保护合法后 text/plain，再合法媒体的破损 JSON/空 body | 415 unsupported-media-type；400 malformed-json | 保留可重试输入 | JSON 解析前媒体拒绝；不进入业务 |
| P03，JSON `null`/数组、额外 `confirmPassword`、缺 email、email=123 | 依次 422 invalid-request-body、unknown-field、required-field(field=email)、invalid-field-type(field=email) | 正常 UI 不发送这些请求；替身错误仍能安全呈现 | 对每个适用操作遍历 required 和字段类型，未知字段先于必填，严格拒绝 null 和隐式转换 |
| P04，返回合法结果带附加属性；再移除必填/改已声明类型/未知 type/未知 HTTP 状态 | 附加属性忽略；其余不当作成功 | I01 为 S36，发码不进入第二步，I03/I05 按 CC-UNKNOWN，I06 不进入工作台 | 产出响应都符合相应操作 schema，错误 status 若存在等于实际状态 |
| P05，全部成功/失败/204/GET，跨站表单和跨源 fetch | 全部 no-store；204 无 body；跨站 POST 403 | 不从应用缓存/Service Worker 读取身份 | 无跨源允许头；检查 Cookie 固定属性；不因浏览器阻止读取就跳过服务器防护 |
| P06，认证操作缺/非法页面头；仅伪造页面头、accountKey、Authorization 或别容器 sessionId | 认证操作为409 browser-context-required；有效页面头但无授权按相应匿名/401 结果。工作台结果见 [C19-C21](workbench.md#真实认证页面接缝) | 前端 transport 为认证和业务请求附当前 P | 无 Cookie+绑定不授权；Bearer 和客户端 accountKey 不提供身份 |

## CC-HAPPY 登录、注册及身份

| 子例与交换 | 精确结果 | 前端断言 | 后端断言 |
| --- | --- | --- | --- |
| H01，无 Cookie GET session；POST Bootstrap；再 GET | 200 AnonymousStatus；200 BootstrapStatus + Set-Cookie；200 browserReady=true | 完成启动后展示 S14；不把空容器当登录 | 空容器无 principal；Cookie 属性固定、初始无到期属性 |
| H02，A 发送 Login，然后 ActivateRemembered | 200 Pending；200 ActiveStatus；后者设置剩余7天 Cookie | 只有第二步确认 active 才进 S21；显示保存昵称 | I01 不 Set-Cookie、不授权；激活得到 A 的固定 accountKey；GET/业务同身份 |
| H03，未占用邮箱 SendCode 到 I02；邮件 fixture 取码；Register；activate | 200 RegistrationCode；201 Pending；200 active | 先显验证码，再交接昵称；条款不跳转；不新增引导协议 | 邮箱唯一、昵称规范值、挑战已消费、账户与pending同时提交；重启后登录同账户键 |
| H04，昵称为40个 Unicode code points，含非BMP字符 | 身份所有入口返回完整保存昵称 | 账号行省略，完整可访问名称，头像不截半个字符；既有首次引导归工作台 | 不从邮箱派生、不截断服务端昵称 |

## CC-INPUT、CC-BOUNDARY、CC-UI

| 子例与条件 | 交换/错误 | 前端断言 | 后端断言 |
| --- | --- | --- | --- |
| IN01，邮箱空/非法，昵称空/过长，密码短/过长，码形状错，条款false | 正常 UI 无业务请求；直连分别为422 email-empty/email-invalid-format/nickname-empty/nickname-too-long/password-too-short/password-too-long/verification-code-invalid-format/terms-not-accepted | 按 G06 顺序定位单字段，编辑后恢复；请求数为0 | 每个适用操作独立拒绝，预算/账户无变化；不检查不存在的确认密码 |
| IN02，未成功发码就提交；API 缺 challengeId、空字符串、未知合法 id | UI 本地码提示；API 分别 required-field(field=challengeId)、verification-code-missing、verification-code-missing | 未发码状态不提交；绑定错误同样落验证码控件 | 缺字段与业务缺挑战分开；不把客户端已发码标记当证据 |
| B01，` Teacher@Example.COM `、254字符合法邮箱、255字符、local 64/65、标签63/64、连续点/首尾点/单标签/首尾连字符/非ASCII | 规范结果 teacher@example.com；边界按 CanonicalEmail；非法422 email-invalid-format | 输入原文不改；发送目标规范化，长地址单行省略且可访问全文 | 绕过前端也规范化；同一规范地址不可重复创建；不查DNS |
| B02，昵称两端空白，40/41个含emoji字符、全空白 | 40接受并trim，41 nickname-too-long，空 nickname-empty | 计数不是UTF-16，错误保留输入 | 保存规范值；后续登录/恢复/重置后登录同昵称 |
| B03，原始密码8/128/129个字符、emoji、前后空白、大小写、组合/分解Unicode | 8/128接受、129 password-too-long、7 password-too-short；变换后的不同密码401 credentials-rejected | 确认密码必须逐值相等，不做trim/normalize；显隐不改值 | 保存/校验使用原字节对应的字符串值；没有截断或规范化 |
| B04，`001234`、`12345`、`1234567`、全角数字、数字JSON值 | 前者保留零；形状错422 verification-code-invalid-format；JSON数422 invalid-field-type | 本地拦截形状错误，不扣次数 | 直接请求同样拒绝，不把值转数字 |
| B05，码形状错+条款false；形状合法但值错+条款false | 前者验证码形状错；后者terms-not-accepted；均不做值判断 | CA118/CA74 分开断言错误位置 | 挑战剩余次数仍5，勾选后首次错码才降至4 |
| U01，初始默认记住、条款未选、密码显隐、键盘Enter、确认不一致、切卡保留邮箱、返回清密、条款链接、找回邮箱只读/更换 | 纯UI无新增交换；正常Enter只提交一次；更换邮箱需重新I04 | CA01等本地归属场景三视口真实交互；错误/按钮不溢出 | 不接收确认密码或显隐字段；发送时仍按正常契约 |

## CC-SEND、CC-CODE

| 子例与交换 | 精确结果 | 前端断言 | 后端断言 |
| --- | --- | --- | --- |
| S01，注册占用邮箱，找回未知邮箱，再换合法地址 | I02 409 email-already-registered；I04 422 email-not-registered；恢复200挑战 | 邮箱字段拒绝，不出现新挑战，改邮箱后可重试 | 拒绝时投递次数0，账户存在性只按既定入口政策披露 |
| S02，成功首次发送，10秒后重发，30秒时重发 | 200 C1；429 code-send-cooldown + Retry-After=20 + resendAt；200 C2 | 等待按钮禁用，冷却倒计时，C2成功才替换C1 | 同用途+邮箱并发只一次投递，C1 replaced；注册与找回用途隔离 |
| S03，首次邮件拒绝/超时；已有C1时到冷却后重发失败 | 503 code-delivery-unavailable；旧C1生命周期不变 | 首次失败仍原卡无验证码；重发失败仍可用C1，不启动新30秒 | 不激活新码；同有效C1随后成功注册/重置；记录外部可能迟到邮件的边界 |
| S04，邮件提供者接受且返回200，但教师尚未收件 | 正常挑战与冷却 | 显示有效期/目标/重发/更换邮箱；不称已收到邮件 | 200仅保证提供者接受和挑战有效，无码出现在API响应或日志 |
| C01，同一有效挑战连续五次错值，再发正确值 | 前四次422 verification-code-incorrect，remainingAttempts=4/3/2/1；第五及以后 exhausted，0 | 值错允许改码继续；耗尽要求重发 | 并发错码计数原子持久；进程重启不重置预算 |
| C02，now=expiresAt；成功重发后使用旧challengeId；新id+旧值 | expired；replaced；incorrect并扣1 | 不把过期/替换当作密码错；重发后清旧输入 | 边界按服务端时钟；被替换挑战不可恢复有效 |
| C03，注册挑战用于I05，或规范邮箱换成B，再用正确用途/邮箱 | binding-mismatch；binding-mismatch；原操作仍可成功 | 改邮箱/用途丢弃当前挑战，旧响应不安装 | 错绑定不扣预算；同形数字不得跨用途验证 |
| C04，成功I03/I05后同challengeId再提交，包含响应丢失后重试 | 422 verification-code-consumed | 显示已使用；注册/重置可转登录恢复，不宣称业务回滚 | 仅一次账户/密码写入；并发两次正确确认仅一个成功 |

## CC-RESET、CC-STORE、CC-CLOSED

| 子例与交换 | 精确结果 | 前端断言 | 后端断言 |
| --- | --- | --- | --- |
| R01，A有两设备、page与remembered及pending会话，B已登录；I04成功后I05 | 204无body；A所有旧会话401，旧密码401，新密码I01成功；B仍200 | 重置确认回S14绿色S37，无自动登录；旧A页面核验后回登录 | 密码、消费和A会话撤销同事务；不清B Cookie/数据/accountKey |
| ST01，I03账户/挑战消费/pending写入任一步失败，或I05密码/撤销/消费写入失败，再撤故障同码重试 | 503 AccountStoreUnavailable 样本；随后I03为201 Pending、I05为204 | 按当前操作503 schema校验；明确回滚则保留输入允许同码重试，不进入记住我失败S45；若I03收到SessionStoreUnavailable则按P04/CC-UNKNOWN处理，不能断言已回滚 | 每个失败点都回滚；重启确认无半个账户/pending/新密码/消费/撤销；撤故障同码成功，I03仍须activate才授权 |
| ST02，账户存储不可读、结构损坏、版本不识别 | 503 account-store-unavailable | 登录S36，恢复S47，可返回登录；不出现示例昵称/旧密码 | 不重新种子化，不静默清库；不以null伪装匿名身份 |
| CL01，关闭注册前后GET状态，已有挑战提交，提交等待中关闭 | registrationOpen=false；I02/I03 403 registration-closed | S43及返回登录，已有输入不被网络错误代替 | 以实际事务裁决时开放状态为准，账户/挑战不变；重开后有效同码可继续 |
| CL02，关闭后现有账户登录、找回、重置；关闭发生在账户已提交之后 | 既有流程正常；已创建账户不删除 | 不把已完成结果撤回或锁住登录 | 配置只影响注册；不新增管理API |

## CC-LOGIN-FAIL、CC-RACE、CC-UNKNOWN

| 子例与事件 | 交换/结果 | 前端断言 | 后端断言 |
| --- | --- | --- | --- |
| L01，不存在邮箱、错误密码 | 同401 credentials-rejected | 同文案，清密码保邮箱，横幅可关 | 不创建session；不以两种Problem泄漏存在性 |
| L02，已知离线未发出、已回滚503、超时、未知/畸形/空响应 | 无请求或已定义Problem；I01无可用结果 | S36保留可重试输入；只有L01清密码；不进入S44/工作台 | 不产出伪造成功；未知提交不伪造503已回滚 |
| RA01，所有I01-I05提交等待时连点/Enter | 相应按钮等待，一次请求 | 快照固定，编辑输入不改变已提交值 | API并发仍按挑战/邮箱事务防重复，不依赖按钮锁 |
| RA02，I01改密码/切卡；I02改邮箱；I04切用途；I03/I05改字段/切卡后返回迟到成功 | 原请求按快照完成，当前UI不消费迟到结果 | 不清新输入、不跳卡；I01/I03不activate迟到pending；I03/I05业务仍能由登录恢复 | 持久结果使用原快照；不把Abort当回滚 |
| RA03，activate/restore在途放弃，I07撤销同id，然后成功响应迟到 | session不能复活；后续GET/业务不可授权该目标 | 代次/id/失效事件守卫丢弃旧响应 | 用两个提交顺序复验：激活先则撤销它；撤销先则激活401 |
| UN01，I03提交成功后丢弃响应；另测请求未达服务端 | 可能已成功 vs 已知未执行 | 前者S44保留表单，用提交凭据登录；后者S36可重试 | 前者只有一个账户/挑战消费；后者没有副作用 |
| UN02，I05成功后丢响应，再重试同码 | S44；重试422 consumed；新密码登录成功 | 不自动重试，不显示已重置成功提示直到证实；保留新密码 | 旧密码失效；没有第二次改密 |
| UN03，发码响应丢失/畸形；注册/重置缺失结果 | 发码不安装未知挑战；I03/I05无法确认提交则S44 | 已知替身未执行的CA102/103为一般失败；不能将该知识套到真实断网 | 发码若已成功则冷却仍有效；重发按S02，新challenge替换旧码 |

## CC-SESSION、CC-PENDING、CC-RESTORE、CC-ISOLATION

| 子例与交换/事件 | 精确结果 | 前端断言 | 后端断言 |
| --- | --- | --- | --- |
| SE01，登录rememberMe=false并activate false，刷新/新文档P2 | active page，expiresAt=null；P2 GET无当前session/恢复目标 | 刷新回S14；本页导航仍可工作；BFCache也不复活page身份 | P1只有与C1匹配才授权；P2和C2无权；单Cookie不能继承page身份 |
| SE02，remembered，关浏览器重开保留Cookie，新P2 GET+restore | GET RestorableStatus；restore200 active，同id/issuedAt/expiresAt | S46无登录/工作台闪现；确认后进工作台 | 第7天精确边界401；恢复/重复activate不延期；独立设备C2无恢复目标 |
| PN01，I01/I03已成功，remembered激活持久失败 | 503 session-persistence-unavailable，GET仍pending | S45说明业务已完成；继续和重试分别ActivatePage/ActivateRemembered | 页面激活无需重做业务；注册账户及码消费保留；分别撤故障/选page后成功 |
| PN02，S45期间A被重置/会话撤销/到期，再继续或重试 | 401 session-invalid | 回登录提示过期；不能写回或进入工作台 | 再校验最新账户状态；两种动作都拒绝 |
| PN03，离开S45切任意表单，随后旧A重置/旧请求结果抵达 | 定向logout旧id，换P并丢pending引用 | 新注册表单、字段和当前错误均不被清掉 | 撤销旧目标不影响新P下会话；网络不明不声称已撤销 |
| PN04，remembered激活已提交但响应丢失，用户欲继续page | GET先返回active remembered；直接不同选择409 session-state-conflict | 先核实，不错误显示“未保存”；可继续已确认会话或退出 | 同参重试200；不同参不改变会话或有效期 |
| RE01，restore延迟、账户/会话存储故障后重试 | 等待后503，重试200 | S46只等待，S47重试/返回登录；无工作台闪现 | restore每次提交前查目标当前有效；错误不续期、不删除有效会话 |
| RE02，restore等待期间目标到期/撤销/被移除或替换 | 401 session-invalid | 回登录提示过期；迟到旧200在已知失效代次下丢弃 | 已撤销目标不因重试重建；数据损坏503不同于到期401 |
| IS01，A密码重置；B已登录；A多个设备 | A检查失败，B正常；A accountKey不变 | A回登录，B保留工作台 | 验证生产业务端口A被拒而B可读写；不能只看UI |
| IS02，A当前page会话，B持久会话变化/重置通知 | A仍有效 | 只核验自己的当前身份，不把任意storage通知当退出命令 | 按session.accountKey撤销；容器内其他页面绑定不被清空 |
| IS03，旧请求属于A，当前UI已交接B，旧GET/业务响应迟到 | 旧响应不得进入B视图 | 先新身份代次再获取workbench context，B不读A草稿 | accountKey只由resolvePrincipal得出；跨账户业务404，不能相信body/query/header身份 |

## CC-LOGOUT 与真实条件

| 子例与交换 | 精确结果 | 前端断言 | 后端断言 |
| --- | --- | --- | --- |
| O01，设置退出当前active；同id重复；无Cookie/null/外容器id | 全部204无body；合法目标首次被撤销 | 等待禁用；确认后回登录，锁住该账户工作台现场 | 正确目标所有绑定和恢复指针失效；其他设备/独立会话不变；最后会话消失才清Cookie |
| O02，撤销写入失败，再撤故障重试；成功撤销但响应丢失 | 已回滚503 session-store-unavailable；或未知；重试204 | 失败/未知不假称成功；未知停止业务，保留同id重试 | 原子撤销，未知后重复安全；旧退出不撤销新sessionId |
| O03，退出后刷新、返回历史、新密码重新登录 | 旧身份不能恢复，新登录正常 | 无旧工作台闪现；设置入口由A11实现 | 真实Cookie jar/浏览器核验，不手工注入新凭据冒充重新登录 |
| EXT01，真实注册及找回邮件 | 从授权真实收件箱收到当次用途/地址的码，I03/I05接受 | 走正式UI，不显示调试码 | 保存提供者接受和收件证据的去敏索引；模拟投递只能标fake-mail |
| EXT02，服务进程重启、浏览器重开、两设备A/B、旧库迁移 | 真实密码/昵称/稳定键/会话到期/撤销仍满足上述交换 | 正式三视口E2E及可恢复失败 | 真SQLite事务/迁移/恢复证据；秘密不入日志；真实认证不能以test-principal通过 |

本页定义验收条件；已有真实接线、本地独立切片与真人邮件反馈见[能力证据](../plans/run-state.md#证据边界)。前端替身、真实 API + fake-mail、真实邮件端到端分开表达，未提供的外部条件仍未验证，不用局部结果关闭完整 A12。
