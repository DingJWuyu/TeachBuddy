# 共享保存与基础业务契约

本页属于共享技术底座，拥有跨模块保存和失败语义；不定义工作台外壳或设置的产品范围。只改公共保存时读[写入、冲突与未知结果](#写入冲突与未知结果)及[保存与恢复反馈](#保存与恢复反馈)；题库基础 API 与兼容任务再读对象、引用及交换用例。认证由[auth](auth.md)定义；基础题目字段在 [workbench.openapi.yaml](../../apps/api/src/contracts/workbench.openapi.yaml)，丰富内容在[材料契约](materials.md)，数学引用在[数学契约](math.md)。正反交换见[基础案例](#基础交换用例)。

身份、保存与冲突规则跨模块共用；下文的内容结构、搜索范围和删除接口描述基础题目 API。材料、数学及[班级教学与日程](teaching-time.md)的扩展行为以各自契约为准。

认证 `1.0.0-rc.2` 与基础工作台 `0.1.0-candidate.2` 已采用，基础受保护操作均要求 PageContext。新版本仍保留旧成功请求的原路径重放；接口版本不等于当前验证状态。

## 身份与 HTTP

沿用 [认证 OpenAPI](../../apps/api/src/contracts/auth.openapi.yaml) 中已有的同源 HTTPS、Cookie、固定保护头、完整来源校验、直接 JSON 成功结果、`application/problem+json` 失败、`Cache-Control: no-store`、请求拒绝未知字段与隐式转换、响应允许附加字段的风格。工作台错误使用独立 `/problems/workbench/*` 命名空间。浏览器不拼接 Bearer、不接收 accountId 参数；写请求缺来源/保护头在任何业务变更前拒绝。

认证消费上述同版候选的 [auth.md](auth.md)，其真实实现和交付另行验收。登录、退出、Cookie 寿命和认证身份响应由认证拥有。服务端接入边界为 `resolvePrincipal(request) -> { accountKey: string } | null`（允许 Promise），accountKey 来自已验证身份的稳定账户映射。工作台 `getWorkbenchContext` 只返回缓存分区键，不构成认证 API。客户端传回此键不能证明身份。所有读、列表、来源、引用、复制、恢复、请求重放均按该身份授权；无身份 401，不属于该账户或不存在的对象统一 404，不泄漏是否存在。

当前全部受保护操作显式外引认证 PageContext，页面头由认证 transport 附加。缺失、形状非法、无当前页 active 绑定或身份失效均返回工作台 401 `unauthenticated`；服务存储不可用仍为工作台 503 `temporarily-unavailable`。写请求的来源/保护头拒绝先于身份，GET 不增加来源/保护头要求。认证端点的 409 `browser-context-required` 不传播为工作台错误。页面头单独不能授权，记住我 Cookie 在新页未经 restore 也不能直接授权。

客户端先获取上下文才能读取本地账户数据。响应还要属于当前身份代次、请求对象及提交版本，迟到旧响应不能回填新账户或覆盖更新草稿。真实认证已映射到此边界；隔离测试 runner 可提供可信 principal，生产配置发现测试身份立即失败退出，无请求头/查询参数/浏览器 accountId 后门。

## 内容与对象

题目使用服务器创建的稳定 UUID，仅用于对象标识，不代表授权。对象创建 `version=1`，每次有效写入严格增加 1，包括删除/恢复；相同内容的新写请求也增加版本。时间为服务端 UTC，浏览器按本地时间呈现。

数学文档 v1 是有序段落/独立公式，段落内为文字/行内公式。选项与小问可以用任意段落编写，不要求固定题型。题面与答案为两个独立文档，长期笔记独立保存。原始粘贴文本逐字保留，编辑整理题目不会改原稿。服务端保存公式源，不执行 HTML/脚本；渲染失败不销毁源内容。图片/资产由[材料内容版本](materials.md#内容)定义明确节点和账户内文件引用。

创建普通题目可有粘贴来源；来源创建后不改。复制时编辑器以原题题面/答案/标题初始化，笔记为空、标记关闭；首个保存将改编后的完整输入与所用原题版本一起提交，服务器新建独立 ID，来源保存原题 ID、所用版本和内容快照。复制之后两题独立编辑；读取原题的衍生列表可以反向找到副本，原题软删除也不破坏来源快照。直接修改不生成新题或来源。

列表一次返回当前账户匹配的全部结果，不做无消费者的分页设施；按 `updatedAt` 降序、ID 升序稳定排序。题库搜索对标题、题面文字和公式源、长期笔记执行去首尾空白后的不区分大小写子串匹配，不搜索答案和来源。过滤默认 active，deleted 只列软删除内容。单对象读取允许返回本账户 tombstone 内容以恢复；编辑已删除对象返回 409 object-deleted。

## 删除与来源保留

软删除保留原内容、ID、改编来源及操作记录，无自动清理期限。基础 API 提供软删除与恢复；当前永久删除能力和关联处理由各模块扩展契约定义。删除题目不级联删除副本，恢复只改 deletedAt 并增加版本，不重建 ID。整体备份覆盖这些记录，见[数据管理](../features/data.md)。

## 写入、冲突与未知结果

所有写操作携带 `Idempotency-Key` UUID。作用域为可信账户，键绑定 HTTP 方法、规范路径和解析后 JSON 的字段值（对象键序无关，数组序有关）；键只代表一次逻辑提交。业务变更与成功状态码/结果一起原子持久保存，跨进程重启可重放；本批保留至账户数据被明确清理，不设置会使离线重试失效的 TTL。

处理顺序：来源/保护与身份、JSON/基本 schema、已成功请求键、对象归属、当前版本及业务校验、原子写入。相同键/同请求重放原成功结果，先于最新版本校验；相同键/不同请求返回 409 idempotency-key-reused。并发同键只有一次提交，后者等待事务完成并重放；事务失败可回滚并用同键重试。失败不记为成功操作，也不消耗该键。跨账户相同键互不影响。

编辑、删除、恢复、复制均携带期望版本。版本不符 409 version-conflict；响应给本账户对象当前版本，客户端再读取用于对照。新/更新引用的来源版本冲突携带对应 questionId 与当前版本；外账户源只返回 404。复制原题改变不能悄悄复制新版。

“已保存”仅能由匹配的已知 2xx JSON（包含 ID/version，且等于本次提交结果）确认，并且当前编辑器没有新的未提交输入。本地缓存写入、开始 fetch、断线或 5xx 均不足。超时、断线、未知错误类型、无效响应或 5xx 一律视为结果未确认。客户端持久保留原键、原请求和基线，先用同键同请求重试确认；不能新建另一个逻辑请求“赌”前次失败。重放得到旧版本成功后确认的是旧提交，再 GET 当前对象，不降级已有较新读数。新输入留在独立草稿中，确认后再以明确基线提交。

业务版本冲突只允许老师对照整理后新键提交；没有自动覆盖、后台合并或盲目重放。明确 4xx 失败可修正后用新键提交。401 后暂停写入，原请求留原账户，重新验证相同账户才可确认。

## 保存与恢复反馈

| 状态 | 老师看到什么 | 可做什么 |
| --- | --- | --- |
| 未保存 | 内容旁“未保存”；本地恢复记录成功时可标“草稿在此设备” | 继续输入、保存、离开后继续；这不代表跨设备保存 |
| 保存中 | “保存中…”；当前提交动作防重复 | 可继续输入；新输入属于下一次提交，不并发覆盖当前请求 |
| 已保存 | 服务端确认当前提交且编辑器没有更新输入后，显示“已保存” | 刷新/其他设备可读同一服务器内容 |
| 保存失败 | 明确失败原因，保留草稿 | 修正字段/重试；服务器已明确拒绝的提交可以换请求键 |
| 结果未确认 | “暂时无法确认是否保存”，保留提交副本和后续输入 | “重试确认”发送原请求；确认前不生成另一个创建/引用操作 |
| 版本冲突 | “内容已在别处修改”，保留当前草稿并提供查看服务器版本 | 选择采用服务器版需确认丢弃本地输入；或对照整理后，以最新版本重新保存，不自动覆盖/合并 |
| 身份失效 | 隐藏业务内容并保留该账户本地草稿，提示重新登录 | 同账户重新验证后继续；异账户不能看到旧草稿；登录恢复由认证 transport 处理 |
| 本地存储失败 | “草稿无法保留，请先保存”，不得显示已保留 | 在线保存或复制输入；离开/关闭前提示未保护输入，不能承诺强制关闭后的恢复 |

本地草稿、提交中的原始请求、浏览现场按可信账户与当前浏览器分别保存；现场包括当前对象、搜索/过滤、多选顺序、每区滚动、展开项、对照、返回点、面板模式/开合和宽度。刷新先核对身份，再取服务器内容、恢复本地草稿与现场；基线版本不一致进入冲突。恢复草稿保留原编辑基线和未解决冲突；最新服务器对象只用于对照，读取失败也不抹去基线。旧请求确认后若服务器已有后续版本，以该请求的已确认结果作为草稿基线并展示最新对象，直到老师明确处理冲突。数据未加载完成前不错误清除选中和滚动锚点。共享保存消费者的浏览器回归入口为 `apps/web/e2e/savable-document-recovery.config.mjs`。

本地草稿不跨设备同步，换设备读取服务器已保存内容并采用当地现场；显式说明只在确有未保存草稿时出现，不常驻页面介绍。退出不主动抹除未保存草稿，重新验证同账户后可恢复；清理该设备数据会丢失本地草稿。API 停止期间刷新会保留本地记录，但身份无法核实时暂不展示，服务恢复并确认同账户后继续。身份切换或失效后到达的旧响应被丢弃，不进入新账户状态。


## 共享实现

### 模块与接缝

遵守 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)。权威静态目录位于 `packages/shared/src/`，基础格式见 OpenAPI 的 ModuleCatalog 与同名样本，扩展目录由材料及数学契约定义。当前五模块目录及接缝在 `packages/shared/src/`，日程为 top 类型。questions 无业务依赖。目录纯数据，Web/API 从同一目录投影到各自本地代码映射；构建检查缺映射、重复 ID/路径、缺依赖与环路，启动前检查迁移。停用或隐藏导航不代表拒绝模块 API。

下表描述基础 v1 接缝。当前模块工厂另注入材料及数学依赖，具体参数见[材料公共端口](materials.md#公共端口)与[数学公共接口](math.md#公共端口)；`readForReference` 保留供旧调用方，当前丰富引用使用 `readForReferenceV2`。模块内部文件、组件和 SQL 由所属模块维护。

| 接缝 | 约定 | 写者/消费者 |
| --- | --- | --- |
| 身份 | 服务端 `resolvePrincipal(request)` 返回 Promise 或值 `{accountKey}` / null；异步中间件等待完成，写入时携带已验证 principal。Web 用 OpenAPI 的 context 分区。 | B12 seam；A11 真实 adapter；B13 使用 |
| 存储 | B12 在组合入口提供同一隔离库的 `better-sqlite3` Database 实例 `db`；模块拥有自己的表，不暴露仓储给别的模块。 | B12 提供；B13 模块使用 |
| 幂等事务 | `mutations.execute({principal, key, method, path, body}, write)`；同步 write 在该 db 事务内返回 `{status, body}`，execute 返回同形结果或契约错误。来源/身份/schema 校验先于调用；模块在 write 内做归属、版本和业务校验。 | B12 提供；B13 使用 |
| 模块工厂 | `apps/api/src/modules/questions/index.js` 导出 `createQuestionsModule({db, mutations})`，返回 `{router, port}`。router 为 Express Router，挂载 `/api/modules/<id>`，请求 `req.workbenchPrincipal` 已验证。 | B13 导出；B12 组合入口挂载 |
| 题目公共端口 | `port.readForReference(principal, questionId)` 同步返回 `{id, version, deletedAt, snapshot}`，无权/不存在抛契约 404。snapshot 同 OpenAPI。调用者在同一写事务内判断当前版本与删除状态；读操作也可查已删除源状态。 | questions 提供；公开消费者使用 |
| 业务工具调用 | 题库对外行为即 OpenAPI 中的操作集合；现有首批 Agent adapter 携带可信 principal 调用同一业务操作及 mutations，不另写 SQL。pi adapter 形式已在[Agent 接缝](../features/agent.md#助理实现)定义；全五模块扩展仍暂停。 | B13；C25/C26 消费 |
| 模块迁移 | 各模块 `migrations/index.js` 导出有序 `migrations` 数组，项 `{id, up(db)}`；ID 使用模块专属前缀，成功 ledger 与迁移同事务，已执行 ID 不重跑。 | B13 提供；B12 runner 汇总 |
| Web 入口 | 各 feature 的 `index.jsx` 默认导出 React 页面；外壳处理 route、可信 accountKey、共享右栏和按账户的本地恢复。模块 API client 只调用唯一 OpenAPI。 | B14 独占，无需后端参与 UI 内部设计 |

SQLite 内业务写入和幂等成功记录一个事务提交，不使用先写题目再补操作记录的分步确认。公共端口及 write 回调的已知失败抛出带 `status` 和 `problem`（OpenAPI Problem）的 Error；execute 回滚后原样传播，由工作台 HTTP 层映射。未知存储错误回滚并映射 503。write 不返回 Promise，事务中不进行网络调用。模块路由错误按契约返回，单个页面/API 错误不清空别的模块现场。读引用时只过 questions 公共端口。文件接口见[材料架构](materials.md#材料实现)。

### 持久化与演进

| 数据 | 所有者 | 最小持久内容 |
| --- | --- | --- |
| 题目 | questions | 可信账户、稳定 ID、版本、题面/答案、独立笔记与标记、不可改来源、时间/软删除 |
| 已确认请求 | 公共 mutations | 账户+键唯一、操作/请求指纹、成功状态码/响应，与业务同事务 |
| 本地草稿/现场 | Web，各模块在外壳约定的账户分区内 | 服务器基线版本、编辑输入、未确认请求的原键/体、返回上下文及 UX 指定现场 |

聚合存储由所属模块实现，外部只依赖 OpenAPI。更新请求不能接受客户端自造 snapshot。基础 v1 复制来源快照由 questions 持有，支持原题变化和删除后的阅读。文件与丰富内容由材料 v2 扩展，数学作品沿数学契约读取与保存。未知版本只读保留，不通过转换丢失内容，也不存任意 blob 充当扩展点。

模块迁移只增不改，B12 迁移 runner 与共享存储改动独占。空库、固定输入的旧账户/布局库都需要迁移验证，保留原账户和布局。每个 worktree 独立数据库、文件目录与端口，禁止开发者共享同一写库。构建只验证代码/隔离 fixture 库，不初始化用户数据库；当前 `build:api` 使用临时隔离库核对装配。

整体备份必须包含 SQLite（含来源、引用、幂等记录）及受管文件，恢复到新目录后核对稳定 ID/关系；本地草稿另按设备保留，不承诺换设备恢复未上传输入。

## 基础交换用例

本节消费工作台 `0.1.0-candidate.2` 与认证 `1.0.0-rc.2`，为设计用例，不是运行通过证据。字段和样本值唯一在 [OpenAPI](../../apps/api/src/contracts/workbench.openapi.yaml)；本页开头区分旧测试身份首流与当前认证接续。前端替身与后端 HTTP 集成都从 `components.examples` 取样本并按下表序列验证，不各造一套模型。

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
