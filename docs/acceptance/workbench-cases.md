# 共享保存与基础题目验收

核验[共享保存与基础题目契约](../contracts/workbench.md)时读本页。本文拥有交换顺序与双侧断言，字段归机器契约；结果和未验条件归[运行台账](../plans/run-state.md)。协议或保护行为改变时同步用例，场景编号保持稳定。

本节消费工作台 `0.1.0-candidate.2` 与认证 `1.0.0-rc.2`，为设计用例，不是运行通过证据。字段和样本值唯一在 [OpenAPI](../../apps/api/src/contracts/workbench.openapi.yaml)；[共享保存契约](../contracts/workbench.md)区分旧测试身份首流与当前认证接续。前端替身与后端 HTTP 集成都从 `components.examples` 取样本并按下表序列验证，不各造一套模型。

### 可复现起点

测试身份场景由 B12 runner 建独立空库、两名测试身份 A/B 和相互独立 Cookie jar；context 的 accountKey 由 runner 注入的服务端 principal 决定。消费当前 schema 的 HTTP fixture 也须带合法页面头，但 test-principal 不能证明 Cookie+页面绑定；真实认证按 C19-C21 建立身份。生产入口不得接受测试 bootstrap。清空测试目录可从零运行；“重启”必须保留同一 SQLite 和文件目录。样本均为本设计自写的高中数学题，不依赖外部文件或密钥。

样本 `CreatePasted` 含题面“已知函数 f(x)=x²-2x，求最小值，并说明理由”、答案 -1、行内/独立 LaTeX 以及教学笔记；原稿有换行，需逐字保持。变式把题面公式改为 `g(x)=x^2-4x`，公式源为 `g(x)=(x-2)^2-4\geq -4`，结论 x=2 时最小值 -4。该公式在 JSON 中按正常反斜杠转义，不存二次转义字符串。

样本中的题目 Q 使用示例 UUID。真实服务创建 Q 后以返回 ID 替换后续样本引用，不能假设服务端按示例 ID 分配。请求键 K1、K2 等均为互不相同的 UUID，重试同一逻辑操作保持原键。每个用例独立 reset，除明确的顺序操作外从同样空库开始。

### 成功与恢复交换

所有请求带浏览器 Cookie 与当前 `X-TeachBuddy-Page: P1`；P1 取外引 PageContext 的 example，仅为非秘密样本。写请求另带 `Content-Type: application/json`、`X-TeachBuddy-Request: 1`、`Idempotency-Key: K`；直接 HTTP 测试补可信 Origin。所有响应均验证 no-store、媒体类型和 schema。

| 用例/BDD | 输入与前置状态 | 必须返回与检查 |
| --- | --- | --- |
| C01 / WB-001、002 | A POST questions/items，`CreateManual` 或 `CreatePasted`，K1 | 201 Question、version=1。GET 同 ID/内容/原稿；list q=配方 命中 note，q=不存在 返回空。B 的列表无此项。 |
| C02 / WB-003 | GET Q v1；PUT Q，`UpdateQuestion`、K2 | 200 同 ID v2；只变已提交输入，source 不变。GET note 为新值。重复 K2 原请求仍返回 v2。 |
| C03 / WB-004 | Q v1；POST Q/copies，`CopyQuestion` 替换变式公式/答案，K3 | 201 新 ID C v1；正文已是改编结果，source.questionId=Q、version=1、snapshot 是原题；原题不变，copies 可找到 C；分别编辑无联动。 |
| C09 / WB-012 | POST 创建或 PUT 修改题目，事务提交后丢响应；重启 API，再同键同请求 | 重放原 201/200、同 ID/版本/快照，库中对象数不变；若其他操作已提高版本，重放旧结果后 GET 当前版，UI 不倒退。 |
| C10 / WB-012、018 | 写事务提交前失败，再同键同请求 | 503 暂时不可用，业务和成功请求记录均无部分写；恢复后成功一次。并发发送两份相同键请求也仅提交一次。 |

### 明确拒绝

以下均在无其他竞争拒绝条件下建立。错误 JSON 的具体例子在 OpenAPI responses；不能只断言非 2xx。拒绝后读取原对象，确认版本、内容及关联无变化。

| 用例/BDD | 触发 | 预期 |
| --- | --- | --- |
| C11 / WB-013 | Q 已 v2，PUT/复制/删除/恢复仍给 baseVersion=1 | 409 version-conflict，currentVersion=2；取当前版对照，以新键/新基线再提交。 |
| C13 / WB-012 | 成功 K1 后，同账户以 K1 发送不同 body 或路径 | 409 idempotency-key-reused；原对象不变。另一账户同 K1 为自己的独立请求。 |
| C14 / WB-016 | 无可信身份；B 读/写/复制/恢复 A 的 Q；查询 A Q 的 copies | 无身份 401 unauthenticated；跨账户统一 404 not-found，响应不带 A 内容/版本。伪造 accountId 请求体为未知字段，伪造身份头不能授权。 |
| C15 / WB-018 | 错 Origin、Origin=null、缺保护头、无 Origin 且无有效 Referer | 403 request-not-allowed；有效 Origin 时不允许 Referer 覆盖，来源按协议/主机/端口完全匹配。 |
| C16 / WB-014、018 | 非 JSON、错误 Content-Type、超过 2 MiB、未知字段、空白题面、未知文档版本/节点 | 分别 400 malformed-json、415 unsupported-media-type、413 payload-too-large；其他 422 invalid-input + field/reason。只返回一个错误：按 schema 字段顺序深度优先，数组按索引；根未知字段先于字段内容检查，同级未知字段按键名升序。 |
| C17 / WB-009 | 复制/编辑已删除 Q | 409 object-deleted。GET 本账户已删除对象允许，恢复走 deletion。 |
| C18 / WB-015、017 | 操作期间 context 变身份；旧响应随后返回；重新登录不同账户 | UI 丢弃旧响应，不能显示旧内容/草稿。返回原身份才解锁本地草稿；真实认证动作按认证契约验证，替身只能验证该边界。 |

`invalid-input` 的 field 是 JSON Pointer，例如 `/statement/blocks/0`；缺少键、类型、范围、内容分别使用 schema 中的 reason。题目 title 可以空；未知内容版本使用 unsupported-content-version。

### 真实认证页面接缝

以下复用 WB-016/017/018 与认证 H02/H03、P06、CC-RESTORE 的行为；前端以同版认证/工作台 HTTP 替身验证发送与恢复，后端以真实认证模块 + 隔离 SQLite/HTTPS 验证授权及无写入，不依赖前端。最终 A11/A12 再用真实浏览器组合两侧。Cookie 从 I06 bootstrap 取得，不在样本或证据中写 Cookie 值。A 的身份样本为认证 `ActiveStatus`，工作台返回 `AuthenticatedContext`；真实运行将两者的示例 accountKey 同时替换为服务端实际稳定键。

| 用例 | 输入与前置状态 | 返回、前端与后端断言 |
| --- | --- | --- |
| C19 / WB-016、018 | 同一 Cookie jar/P1 经 I01或I03得到 pending，再 I06 activate；使用 P1 请求 context、目录以及 C01-C10 的全部读写操作 | pending 时业务401；active后 context 返回200 AuthenticatedContext，与认证Account.accountKey一致；目录200 ModuleCatalog，业务成功按原样本。前端 transport 在受保护操作都发送当前页面头，保留原body/Idempotency-Key；后端仅以已验证 principal授权。 |
| C20 / WB-016、018 | 同 Cookie：逐一省略页面头、空/31/33字符、含非十六进制字符、换成合法但未绑定的P2；另仅给合法P1而无Cookie。写请求的来源/保护头先保持合法 | 读写、context/目录均401，body取工作台responses/401的unauthenticated样本；前端锁住业务并复核认证状态，不当成字段422或认证409。后端无业务写入/幂等成功记录；同Cookie不能绕过页面绑定。再叠加错误写来源，先返回responses/403样本；GET不要求来源/保护头。 |
| C21 / WB-017、018 | P1已active，刷新产生P2；分别验证page与remembered模式；再撤销/到期以及身份存储不可读 | P2在restore前业务401；page模式回登录，remembered按I06恢复成功后以P2得到相同accountKey及原内容。撤销/到期后401；存储不可读映射工作台503样本，不能回退旧身份。前端丢弃P1的迟到响应并保持草稿账户分区；后端实时复核绑定，不自动用恢复指针授权。 |

### UI 独有与故障响应

WB-010/011 不新增草稿或现场 API：在可信账户分区保存文稿、原请求和视图；刷新后先 context 再 GET，服务器已变则冲突。本地缓存无服务器确认不能显示已保存。未知 2xx 结构、未知 Problem、5xx、断线/超时一律进入结果未确认，保持同键原体直到确认；schema 替身需覆盖这些分支，B15 必须用真实提交/断响应复验。

重放成功后立即继续本地输入时，先 GET 当前对象；未被其他操作更改时以重放结果版本作为新基线，若服务器还有其他变化进入对照，不自动覆盖。pending 原始请求与新输入分开存放。测试通过记录必须区分 frontend-substitute、real-api/test-principal、real-auth；本文件不声明任何一类已通过。

## WB-002 基础粘贴兼容

仅验证基础 B11 `CreatePasted`：提交前修改整理题面，持久得到一道可编辑题目，原始粘贴文字与换行逐字保留；此基础操作不声称执行自动拆题。当前产品“从资料收录”的自动整理仍按 WB-M001/005/006，不能用本兼容路径替代完整收录能力。
