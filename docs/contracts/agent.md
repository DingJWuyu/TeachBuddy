# AI 助理契约：首批工具与六模块扩展

首批 Agent 契约，设计已采用；开发暂停和实现边界见[当前状态](../plans/run-state.md)。精确 HTTP、请求/响应、工具参数和错误对照唯一归 [agent.openapi.json](../../apps/api/src/contracts/agent.openapi.json)，有效交换样本见 [agent-examples.json](../../apps/api/test/fixtures/contracts/agent-examples.json)。本页定义请求之间的不变量，不是另一份字段 schema。

输入版本、实验裁决与下游条件见[助理实现](../features/agent.md#助理实现)。已有业务字段继续引用工作台 `0.1.0-candidate.2`，业务语义源为 B11 `9aee091a34ba2eb311b51299d9beed78a032d026`；真实认证源为 `6f3003250d170b44e89f6ac9b0a74f91d658a357`、冻结 `63bfe8f7900b4a2bb7fc9ab5a4145f1c89a6f73b`。Agent 只新增 `/api/agent`，不改 15 个旧工作台操作、认证操作、Cookie 或页面上下文语义。

## 身份与接受顺序

所有 Agent HTTP 包括流读取使用认证 transport 的 Cookie 和必填 `X-TeachBuddy-Page`。写请求执行原同源 HTTPS、Origin/Referer 和固定保护头规则。账户只从服务端可信 principal 获取，浏览器、模型、工具参数均不能指定账户。无效页面绑定返回原工作台 401；归属未知统一 404；原认证存储异常按 A11 接线映射为工作台 503。不暴露 Cookie、密钥、provider 原始响应头、内部文件路径或 pi thinking 块。

处理顺序为来源防护、当前身份、JSON/基本 schema、成功幂等记录、资源归属、版本/运行/引用等业务条件、持久提交。所有新增写请求的 Idempotency-Key 沿用可信账户作用域、方法+规范路径+解析 JSON 绑定、同键同体重放优先于版本检查、跨重启保留、成功结果原子保存的旧规则。失败不记成功，不消耗键。重放仍验证当前身份；其他账户不能取到原响应。GET 不产生新会话或模型请求。

## 对话、草稿和消息

创建对话返回持久 snapshot，初始草稿 version=1、空文字/引用、空消息/turn/工具调用/操作、lastEventSeq=0。列表返回本账户全部对话，updatedAt 降序、id 升序；当前设备优先恢复其本地 active conversationId，否则选择列表首项，空列表提供新对话入口。选择或浏览不更新活动排序。草稿保存、发送与新增消息/工具状态更新对话 updatedAt。

草稿是服务器上每对话一份的版本对象。PUT 是整份替换，成功 version+1；同键重放不再增加版本。两设备旧版写入返回 draft-conflict，含服务器 currentVersion。客户端必须保留本地输入和请求快照，读取最新后让老师选择，不自动覆盖。未上传草稿和 UI 现场按可信 accountKey 留本设备；换设备只恢复已确认持久内容。对话滚动锚点、活动对话、右栏模式/宽度在同一设备跨刷新保存，其他设备按其屏幕使用默认布局；不承诺把桌面像素坐标复制到 Pad。业务模块现场仍按原首流策略维护。

引用仅有题目或备课两种；sectionId 只用于备课并必须存在。输入引用按 kind/id/sectionId 去重，重复为 invalid-input。保存草稿核对对象归属，但允许保留已经过期或已删除的本账户版本以便恢复；发送时要求对象仍 active 且版本完全匹配、环节存在。发送引用失效返回 reference-conflict（field 指向引用，currentVersion 为该对象现版本），不生成消息、不清空草稿、不请求模型。外账户引用 404，不返回版本。

发送读取指定 draftVersion 的已保存草稿，trim 后文字必须非空；原文字仍逐字保存，不做隐式改写。单次事务完成：确认无账户运行中 turn/未决操作，核对引用并捕获本账户对象的完整快照，创建 user message、turn，清空这一版草稿并 version+1，记录成功 202。事务成功之后才开始 pi。迟到重放返回原 202，不清空新草稿，不重复运行；客户端 GET snapshot 取得当前状态。新文字输入在提交版本之外保留，不能被旧回执清空。

历史引用是发送时快照，与备课业务引用是不同消费者。它不锁定活对象，也不把对话内容放入业务库。模型可读取所引用的内容，修改前仍读真实业务对象并带版本。消息、引用快照与已完成工具结果不会因源内容更新/软删除而改变；源不存在时打开动作显示不可用。Agent 没有直接修改既有聊天消息或永久删除数据的入口。

## 流与运行状态

一个账户最多一个 running turn；这是避免跨对话写入争抢的简单约束，不建立排队平台。重复网络请求先走幂等重放，新键发送遇运行返回 turn-active。每 turn 固定一个允许的精确模型，后续选择只影响下一 turn。配置查询的 ready 表示本地配置及模型注册可用，不表示远端余额足够或服务已实测健康。

接受 turn 时创建一条 user message；assistant 消息按 pi 实际消息顺序追加，每个消息有稳定 ID。工具参数/结果单独呈现，不能混成老师输入。SSE 只发布已落盘的批次，message 事件携带该消息截至此刻的完整文本替换值，不是待拼接 token。所有事件按对话从 1 严格递增；snapshot 的所有字段与 lastEventSeq 来自同一一致性读取。

客户端先 GET snapshot，再用 fetch 流读取 `events?after=<lastEventSeq>`，保持原认证头；每帧为 `id: <seq>\nevent: change\ndata: <Event JSON>\n\n`。以 after 为唯一游标，不接受 Last-Event-ID 作为第二个隐式来源。服务端先重放 seq>after，再接续新事件，交界不能漏；客户端忽略已应用序号、缺号时重连。保留本批事件不设 TTL；after 超前返回 cursor-ahead，客户端重读 snapshot。心跳最多每 15 秒一条 SSE 注释，不写事件记录。

流建立前错误为标准 Problem；建立后身份失效或存储错误关闭流，客户端重查身份/snapshot，不在 SSE 中塞另一个未定义错误格式。每批发送和心跳前重新核验身份，失效则关闭；客户端收到认证失效或代次变化立即取消并隐藏旧流。断线不代表 stop，也不触发生成重试；重连只能补已持久事件。

stop 的接受与 turn 的 stop-request 标记持久化后返回 200；可暂时返回 running。系统停止下次 provider 调用及尚未开始的工具，并中止正在生成的文本；已开始的同步业务事务完成后必须记录或核实结果，再进入 stopped。若仍有未确认操作，turn 也可 stopped，但该操作阻止新生成。重复 stop 无副作用，终态 turn 不重开。历史部分文本标为 partial。

进程重启时 running 一律转 interrupted/server-restart，保留消息和待确认操作；不自动重试模型请求。正常失败为 failed，用户停止为 stopped，只有模型正常结束且所有已启动操作有确定结果、无未处理失败时为 completed。遇工具冲突/已知拒绝则 failed/tool-rejected，写入结果未知则 failed/tool-unconfirmed，只读异常则 failed/tool-failed；可用持久卡片直接说明原因，无需额外模型请求包装失败。网络故障、abort 或 pi stop reason 不得被普通进程退出码覆盖。

老师点击继续或重试通过新的 draft/send 形成新 turn；原部分回答保留，新 turn 继承上下文和真实工具结果。成功记录不会按历史 toolCall 再执行。未决业务操作必须先 reconcile；额度/授权失败必须等待配置可用并由老师明确重试，不能自动切换 GLM 或继续付费请求。

## 工具调用的公开投影

所有开放工具均写入 Snapshot.toolCalls，并通过 type=toolCall 的 Event 推送完整替换值。调用以 `(turnId, toolCallId)` 唯一定位，ordinal 按该 turn 原生 assistant entry 内的调用顺序首次分配，跨刷新/重启不变；工具卡在所属 turn 内按 ordinal 排列，不依赖 assistant 正文存在。name 对应封闭工具清单；arguments 是经该工具 schema 校验的完整参数。无效参数保存为 null 并给出 invalid-input Problem，不持久公开原始无效输入或注入的身份/密钥。浏览器从工具名称和已定义字段生成文案，不解析模型文字、原生 entries 或 thinking。

| 调用情形 | 持久公开结果与后续动作 |
| --- | --- |
| 完整调用待执行 / 已开始 | 先保存 prepared，再在业务调用前保存 executing；result/problem 均为空。部分参数流不形成工具卡，不可执行。 |
| 只读成功，包括空列表 | state=read，result 为该工具的完整业务 response，problem 为空，operationId 为空。保存读到的快照，重开卡片不重新查询。 |
| 合法业务拒绝，包括只读 404/409 | state=rejected，result 为空，problem 为原公开 Problem；正常运行的 turn 以 failed/tool-rejected 结束，不要求生成后续 assistant 文本。 |
| 只读抛错或响应不匹配契约 | state=failed，problem=tool-failed，title 为安全的固定说明，不泄露堆栈或上游原文；turn 为 failed/tool-failed。只读没有待核实写入，不进入 unconfirmed。 |
| 停止、权限失效或本轮提前结束时尚未执行 | prepared 转 cancelled，result/problem 为空。包括同批已持久但因前一工具失败而未执行的调用；不伪造业务拒绝。具体原因读取所属 Turn。 |
| 只读已经执行但停止时尚无持久结果 | 尝试结束/取消读取；结果先完成持久提交则保留 read/rejected/failed，否则提交 interrupted，result/problem 为空。终态后迟到读结果丢弃，不覆盖卡片。 |
| 进程重启 | 未结束 turn 为 interrupted/server-restart；只读 prepared 转 cancelled、executing 转 interrupted。原已持久终态和详情逐字保留，不自动重查或请求模型。 |
| 写入 | operationId 指向原 Operation；state/result/problem 与它一致，含 prepared/executing/confirmed/rejected/unconfirmed/cancelled。已开始写入沿原 journal 核实规则，不能套用只读 interrupted 丢弃已提交结果。 |

有效 mutation 参数在创建 ToolCall 时同时创建原 prepared Operation，符合既有去重规则时则关联原 Operation 及当前状态；参数不合法则仅有 rejected 调用卡和 null operationId，不创建不合法 MutationRequest。只读从不创建 Operation 或业务幂等键。每个 Operation 的 toolCallId 指向首次调用；同一 turn 再次请求已确认的等价写入时可复用其 operationId，但各自保留不同 toolCallId/ordinal。复用前必须规范操作和完整参数一致；这些卡只是同一操作的关联视图，不是多次提交。Operation.request.operationId 是业务操作名，ToolCall.operationId 是 journal UUID，二者不可混用。

写操作 journal 是写入事实的唯一来源。创建、执行、结果、取消及 reconcile 更新须把 Operation、所有关联 ToolCall 投影、对应事件及此时产生的原生结果作为同一 SQLite 提交；事件按 operation 先、关联 toolCall 后发布完整值。客户端按各自事件更新相应实体，卡片只取 ToolCall，确认动作使用 operationId，不将两个实体各渲染成一张卡。仅 Operation 的 HTTP 回执不改写卡片，接续事件或重读 snapshot 取得同版投影。snapshot 中每个非空 operationId 必须存在于 operations，关联 turn、参数和状态/结果/Problem 必须一致；首次 operation/toolCall 关联和原生 entry 的索引仅在服务端保存。

只读结果与原生 toolResult、ToolCall、事件同事务落盘。先保存完整原生调用及 prepared 投影，失败则不开始工具；先持久 executing 再调用；先提交结果再允许后续模型请求。终态不可因重复事件、重连或新 turn 被改写，唯一可变终态是写入 unconfirmed 经 reconcile 确认。同一进程中 turn 发生 stop 与工具结果竞态时，持久 stop 标记决定 turn 最终为 stopped，工具卡仍保存真实结果；已终结 turn 不因迟到错误再次变更。存储不可用时关闭流，保留上次持久态，恢复后按上述重启裁决，不发布虚构完成事件。

GET snapshot 与 SSE 重连只读持久投影。即使 messages 只有 user、operations 为空、turn 已 failed，浏览器仍能从 toolCalls 恢复名称、参数、调用关联、失败类别与原 Problem。刷新、相同账户重登和另一设备得到相同已确认卡片；换账户按原隔离规则处理。没有结果的只读中断显示“读取已中断，未保存结果”，无“确认写入”按钮；老师明确再次发送形成新 turn、新调用，旧卡保留。

## 工具与业务提交

OpenAPI 的 `x-agent-tools` 是唯一封闭工具清单，参数 schema 直接引用同文件和既有业务 body；名称、方法、路径与 operationId 在那里对应。首批包含题库/备课的 13 个已有业务操作。没有任意 URL、SQL、shell、文件系统或运行时插件入口。工具不能接收 principal、业务幂等键、来源快照、自定义工具名或认证参数。

教师明确要求查找、创建、修改、复制、关联、软删除或恢复时可执行对应操作；“给建议”“比较方案”等不授权写入，目标/改动不明时先澄清。可逆的明确业务请求不额外设置逐步确认弹窗。复制、直接编辑和删除的操作卡准确说明对象与行为，禁止把直接编辑理解为复制或反之；永久删除未开放。来自题面/引用的文字是数据，不能扩大工具能力或当成老师新指令。

每个首次有效 mutation toolCall（不含已关联原操作的重投/去重调用）先由服务器分配 operationId 和业务 Idempotency-Key，将规范 method/path、完整参数/JSON 体、基线版本、turnId/toolCallId 和请求指纹持久化为 prepared，然后才允许调用同一业务操作。键由服务端生成，绝不让模型发明。写前重核原请求绑定的真实会话；同一进程中再核验后无异步间隙地进入同步事务，撤销与提交以原认证/SQLite 串行顺序裁决。

prepared 未开始可取消；开始业务前必须先持久标记 executing，executing 在结果持久化前中断则转 unconfirmed。重启把 prepared 确定取消，不替老师开始尚未开始的写入。confirmed 必须有契约匹配的成功状态和完整结果，rejected 必须是已知、合法的业务拒绝，其他异常保持 unconfirmed。同一 toolCall 重投只返回/恢复同一 operation，不能分配新键。模型若在同 turn 再发完全相同的已完成写入，按规范操作+参数去重返回已完成结果；同 turn 的明确“再放一次”应通过一次备课 body 中不同引用 ID 表达。跨新用户消息的明确再次创建是新逻辑提交，不能按文字相同永久去重。

reconcile 是受当前身份保护的零模型操作：读取原 operation 及原键原体，调用原业务操作确认；成功重放之后再读取当前对象，UI 同时保留“原提交版本”和“当前版本”，不把旧成功结果写回较新的编辑器。仍有 running turn 时返回 turn-active，等原工具结束或重启裁决状态后再核实。confirmed/rejected/cancelled 的 reconcile 返回原终态，不再执行写入。并发核实以 operation 串行和业务幂等事务确保一个结果；200 只表示核实动作响应，Operation.state 才决定是否成功。核实遇明确版本冲突为 rejected；遇身份失效不执行并返回原 401。

业务 409 不自动刷新版本覆盖。对照由当前业务编辑器承担，操作卡保存原提案和失败；老师手工整合后沿原手工业务流程新键提交，或明确要求 Agent 基于最新内容重做。首批多步骤任务逐操作提交：复制成功、加入备课失败时保留副本，显示部分完成；不自建跨模块回滚事务。向备课加入题目必须 GET 完整备课并用旧契约的一个 PUT 提交，保持已有环节/引用 ID、顺序、备注和来源快照语义，批量引用原子成功或失败。

## pi 错误映射、用量与失败边界

采用 pi 0.85.1 SDK，关闭默认内建工具、项目/用户自动扩展、skills、prompt 模板和上下文文件发现。配置只注册白名单模型，HTTP 接受前、创建/重开 session 后、每次 provider 请求前均严格比较 provider+精确 ID；禁止调用 CLI 的未知 ID fallback。SDK 返回 unknown 或 modelFallbackMessage 时停止新生成，历史照常可读。不自动 compaction、summarize、后台命名或恢复请求；上下文超限保留全部历史，提示新对话。

业务 adapter 的 `details` 必须是 ToolOutcome；content 是该 outcome 的可读 JSON。返回对象顶层 `isError` 不作为信号源。在 SDK `afterToolCall`（或产品固定的等价扩展 tool_result hook）按 details.state 设置外层 isError：read/confirmed=false，rejected/unconfirmed/failed/cancelled/interrupted=true；保留结构化 details。未知异常由统一映射区分是否已有执行中的 operation：只读保存 failed/tool-failed，已持久 executing 的写入保存 unconfirmed；尚未开始的写入取消，并按存储/身份等实际失败来源结束 turn；未开始调用的取消和只读中断补同名 ToolOutcome。所有这些结果在下一次请求前补入原生 toolResult；不得用成功空对象吞错。持久 toolResult、外层 tool_execution_end 和产品工具卡三者需同义。实验中嵌套 true、外层 false 的旧日志只是历史，产品不会复制该误映射。

所有 provider 密钥只从服务端既有部署配置读取，不进入前端配置或聊天。当前可消费的接线是 command-code/openai-completions、C24 固定 base URL；不声称已验证直连厂商。配置缺失时业务及聊天历史仍可用，模型发送 503。单 turn 最多 12 次 provider 请求、24 次工具调用、180 秒；达到任一限制停止后续动作，保留完成部分并标记 run-limit。该限制是调用上界，不是费用上限，不自动重置预算继续执行。

每次 provider 请求开始即持久记录 request ordinal；按该 ordinal 只记一次已报告 usage。聚合字段为已报告值之和，无任何报告时为 null；complete 仅当所有已发请求都取得完整 usage。token 字段采用原返回语义，reasoning 是细分，不重复加到 totalTokens。流中断、授权失败、网络失败可能已收费但没有 usage，必须标为不完整。当前实际账单/余额未知，配置返回 null，模型元数据 cost=0 不参与费用计算。provider 额度/额外收费授权拒绝立即停止后续请求，无自动充值、换模型或付费重试。

## 六模块扩展契约

本节是已独立冻结的 F60 设计，完整实现暂停。精确扩展 schema 与完整相对引用保存在[待实现契约](../../apps/api/src/contracts/planned/reliability/reliability.schema.json)，原始版本与逐文件摘要见同目录 `provenance.json`。这些文件不参与当前 API 契约装配，不能用当前首批 schema 替代；读取时直接使用仓库内文件，不需要本机历史 Git 引用。新增 HTTP 继续使用认证 transport、账户幂等与共享 Problem。所有业务操作只调用各模块公共端口。

冻结文件内的 `x-sources` 和旧验收引用保留采集来源，不作为接手前置。`x-auth-recovery` 记录冻结时的 `auth-recovery/1`；恢复开发时按[当前认证恢复契约](auth.md#部署恢复的认证撤销)的 `auth-recovery/2`、现有实现及恢复测试处理账户删除与清理计数，不能沿用旧版本假定。

### 版本与调用

C25 的 pi runtime、模型白名单、用量/次数上界、工具 journal、SSE 游标、停止与 reconcile 语义原样继承。新增 `/api/agent/v2` 与 v2 snapshot/schema，以便接纳六模块对象和工具；原 `/api/agent` 保留只处理原可表示历史。旧路径读到新工具/丰富引用时整体拒绝 `unsupported-agent-version`，不能丢卡或降级源；旧路径未知写入仍在原路径原键确认。v2 可读取旧历史且不改写其消息/工具/幂等原件，旧未决操作在 v2 核实也执行原 journal 路径。

旧写路径先按原顺序重放已成功请求，再拒绝不可表示的新写入；不能清草稿或开始模型后才报版本不支持。旧 SSE 已连接时，在首个不可表示事件前关闭流，不发送畸形 v1 帧；重读 snapshot 得到版本错误并引导刷新升级，旧游标不伪进位。新 v2 对话和原历史共用同一账户运行锁，不出现两个并行 turn。

新回合仅给模型 schema 中的当前工具清单。旧工具名只用于读取/核实既存历史，不作为新回合的可选操作。工具名固定为 `wb_` 加原 operationId，参数为严格 `{path, query, body}` 组合：仅操作确有的部分可出现，path/query 字段逐项外引原参数定义，body 外引原请求体，必填性保持。没有任意 URL、SQL、shell、本机路径、账户、幂等键或运行时注册字段。新工具绑定调用原 `port.operations`，文件/Job 用其原公共端口适配；同一业务验证只有一个写者。

参数转为原 HTTP 表示时按原参数 style/explode 编码数组，路径逐段编码；journal 保存真实方法、规范路径、解析后的原业务 body 与完整参数，不能把工具包装 `{path,query,body}` 当成业务 body。Job/query/通知等原接口明确的读取副作用仍按原业务规则，工具 `read` 只表示该次查询结果，不改通知结算语义。v2 ToolOutcome 使用 schema 的完整四字段投影，历史 C25 原生结果字节不重写。

Agent v2 引用允许 question、lesson、resource、math、class、record、entry、import、file。业务对象带明确当前版本，file 使用不可变 ID；lesson 可定位 sectionId，entry 可定位 originDate。引用只用于捕获上下文，不是修改权限。捕获完整公开对象及当前引用版本，文件仅捕获元数据与已授权内容投影，不把凭据下载地址传给模型。未知类型拒绝，外账户统一 404。旧引用规则扩展到这些类型：保存输入可保留本账户失效引用，发送要求当前活动版和目标存在；文件须完整可读。当前对象更新不能改变历史快照。

entry 引用快照同时保存 Entry 和选定 Occurrence：有 originDate 时按原实例端口读取真实调课结果，取消/超范围实例拒绝发送；未指定则 occurrence=null，表示整组或非重复 Entry。基线始终是原聚合 version，不能把例外时间当模板内容。去重键为 kind/id 与该类型允许的 sectionId 或 originDate，文件按 id；捕获与发送接受仍在同一一致事务中。

<a id="tool-classification"></a>
### 工具卡读写分类与传递

老师查询班级得到空列表时仍是一张成功读卡：`wb_listClasses`、`arguments={}`、`state=read`、`result={items:[]}`、`operationId=null`。读取失败或中断保留同一张卡，不制造写入回执。

本扩展设计的 81 个工具以 `x-tool-bindings.mutation` 为读写依据。`AgentToolCall` 新版分支的只读名称枚举必须精确等于其中 36 个 `mutation=false` 名称，其余 45 个为写工具；枚举是标准 JSON Schema 的静态表达，修改绑定时须同时通过集合一致性检查。旧 snake_case 名称只由未变的 C25 历史分支校验，不进入当前工具集合。

| 当前分类 | 允许状态 | operationId |
| --- | --- | --- |
| 只读 | prepared、executing、read、rejected、failed、cancelled、interrupted | 始终 null |
| 写入，参数校验通过 | prepared、executing、confirmed、rejected、unconfirmed、cancelled | 必须为 Operation UUID |
| 参数校验未通过，读写均适用 | arguments=null，仅 rejected，Problem 为 invalid-input | null，不建立 Operation |

状态不能取代参数和结果校验：read/confirmed 必须有该工具原成功响应形状且 problem=null；其他状态 result=null。rejected/failed/unconfirmed 必须有相应 Problem，failed 使用原 tool-failed 类型；其余状态 problem=null。状态间转换继续沿 C25 与 WB-F008，表格不授权任意跳转，也不改变读取端口的既有通知/Job 语义。

`AgentSnapshot.toolCalls`、`AgentEvent(type=toolCall).value` 和 `PortableData(kind=conversation).value.toolCalls` 均递归消费同一个 `AgentToolCall`，保留名称、参数、顺序、结果及 null operationId。消费者不得按旧名称重新猜测分类、伪造 Operation、丢卡或跳过校验。v2 ToolOutcome 沿既定四字段投影，终态须与对应卡一致。正常重启或部署恢复的只读 executing 标 interrupted、未开始调用标 cancelled；只有执行中的写操作进入 unconfirmed 及原有核实/恢复隔离路径。

实现状态与后续验证见[项目状态](../plans/run-state.md)；产品运行仍需覆盖六模块业务一致性，静态检查不代替运行证据。

### 手工能力对应表

下表指定行为覆盖；精确工具名、路径和请求 schema 只在 JSON 的 `x-tool-bindings`。同一格中每项都须经真实公开端口实现，不以列出工具名视为已完成。

| 模块/能力 | 业务操作族 | 页面与确认结果 |
| --- | --- | --- |
| 题库查找、标记、笔记、自建/直接改/复制、原题双向联系、分类增改删 | questions v2 的 list/get/create/update/copy/copies、taxonomy | 新题/副本可检索；原题未被复制操作改写；标签与长期笔记真实更新 |
| 图片/PDF/Word/文字收录、定位、裁图、拆合/补原稿、校对、部分入库、停止/重试 | imports 的 create/list/get/saveReview/supplement/commit/deletion、relocateQuestion、cropFileRegion、Job get/list/cancel/retry | 原稿与疑点保留；Job 状态和真正入库分开；老师已校对部分不被重试覆盖 |
| 题面/PPT 素材与原稿预览下载 | createQuestionAsset、File get/preview/requestPreview，下载由卡片受保护动作提供 | 返回真实 File/Job，PNG 或原件可下载；不把二进制塞进模型 JSON |
| 备课目录检索、文稿/环节增删排序、选题/资源/作品、未安排材料、采用更新、引用备注 | lessons v3 的 list/get/create/update/usages | 完整读取后一次 PUT 保留未改环节/引用 ID；引用快照按原规则固定，返回原环节 |
| 三类成果 × Word/PDF、答案/教师注记选项 | exportLessonV3、listLessonExportsV3、Job 与 File | 固定保存版，六种输出可找回；过滤沿原输出规则 |
| 数学公式、函数、平面/空间、动态制作/修改、参数/标注/样式/步骤、复制/版本 | math works 的 list/get/create/update/copy/versions/reference | 保存可编辑 Source；演示按原隔离方式预览，旧引用固定旧版 |
| 数学 PNG/SVG/透明公式/源码/离线 HTML，外部 HTML 导入 | exportWork；create/updateWork 消费已上传 File | 卡片打开真实作品和成果；不赋予任意 HTML 结构化编辑承诺 |
| 资源收录、分类/标签/备注/检索、预览/下载、替换文件/补充预览 | resources 全套 items、taxonomy、file、supplement-preview；File 端口 | 替换保留条目与关联；现有备课显式采用新版 |
| 班级管理、一句话/进度/共性问题/下一步、题/课/作品关联、两班反馈 | classes items；records v2、source-records v2 | 实际记录可打开来源并返回，反馈按班分开；不把日程当已授课 |
| 任意连续日期、未排期、多事项、优先级/段内排序、跨段移动、课程关联 | schedule entries、occurrences、moveItem | 返回准确日期/时段及内容，优先级与顺序互不派生 |
| 周重复/结束日/仅这次/恢复原安排、提醒前后间隔/通知 | exceptions、settings、notifications | 保留 originDate；只通知站内，原 dueAt/去重与修改前结算不变 |
| 六模块误删恢复 | 原 deletion 操作及 deleted 列表 | 操作卡明确删除或恢复，原 ID/关系保持，不给永久删除工具 |

模型不能上传本机文件；上传是老师操作。已上传 File 与生成的受限数学 Source 才能进入工具。取材选中态、滚动、预览翻页、下载到本机、操作系统 Office 编辑属于 UI/外部环境动作，不伪装成服务端修改；工具卡提供这些动作的真实入口。

### 异步成果与失败

返回 202 的工具 `confirmed` 只确认受理，result 保留 Job/ExportRecord。后续模型可在同一原回合预算内读取一次状态，仍运行则交给现有页面轮询；不新增模型后台等待/自动继续。受理后身份失效阻止后续新工具；已接受 Job 按原 Job 生命周期收尾，不能宣称注销撤销已提交内容。准备中的新操作取消，执行中的写入沿 journal 核实，不把超时当未执行。

Agent 整理/重试会触发原提取服务的模型调用时，仍服从该服务授权及费用限制；C21 旧在线窗口关闭，不因 Agent 工具存在而重开。终端教师要求操作是产品行为授权，开发验收的 live 请求还须任务包明确预算。多步任务无分布式事务：保留已成功对象，失败卡给出原稿、目标与继续入口。
