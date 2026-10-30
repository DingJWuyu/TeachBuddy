# AI 助理技术入口

修改对话持久化、pi、SSE/journal、工具装配或 provider 时读本页。用户行为见[助理规格](../features/agent.md)，请求间不变量见[助理契约](../contracts/agent.md)。接缝、存储或运行配置变化时同步；历史设计与工具可调用性不代表实际接入。

## 装配与持久化

[AgentProvider](../../apps/web/src/features/agent/AgentProvider.jsx) 的 `useAgent` 是会话、草稿、发送、SSE、停止及真实工具结果的业务入口；点击发送时固定文字、引用与模型，再等待草稿持久化并提交固定版本。等待期间的新输入独立保留，发送未决期间暂停自动上传，不禁止编辑。真实会话管理由 AgentProvider 调用 PATCH/DELETE，状态保存到会话 store，删除前保护生成与未决 journal。

[AgentPresentation](../../apps/web/src/features/agent/AgentPresentation.jsx) 投影既有设备偏好和示例历史。真实会话 titleEdited=true 时服务器标题优先，pinned 字段存在时服务器置顶选择优先；其余读取旧 meta 兜底，hidden 只保留设备过滤。titleEdited 只由明确改名的 PATCH 设置，首次发送据此保护标题；旧记录缺字段无需迁移。旧卡接续由助理前端的专用兼容读取处理，只读取当前账户 active 命名空间中的 card-action 原请求，逐槽沿原键、原路径、原体核实，不生成新请求或重新激活部署恢复归档。

“载入一周的示例数据”仍经真实 API 保存业务记录，接线见[外壳示例入口](foundation.md#显式载入示例)。真实引用由 Agent 接受事务捕获 question/resource/entry 公开快照；教学提案由持久 ToolCall 保存，点击执行由 Operation.proposalSource 定位，详见[契约](../contracts/agent.md#教学提案与点击执行)。

[AgentWorkspace](../../apps/web/src/features/agent/AgentWorkspace.jsx) 的选课引用记录只拥有本会话由选择器带入的引用；取消和替换不清除独立加入的日程引用。课程、模型及侧栏历史选择器在选项卸载前归焦触发器，Escape 关闭也保留该入口的键盘接续。Composer 按光标前触发的起止范围移除 `@关键词` 并恢复插入位置；复制成功状态等待浏览器剪贴板写入完成，失败沿现有提示样式保留重试入口。

资源深链上下文沿 `useCurrentContext` 观察当前账户的 `scene:resources.openId`；深链只作为首次进入的目标，实际 scene 不再指向它时取消该上下文，不创建另一份业务选择状态。普通资源浏览继续使用通用建议。

Web [apps/web/src/features/agent/](../../apps/web/src/features/agent)，API [apps/api/src/agent/](../../apps/api/src/agent)；入口由 WorkbenchApp 组合。

AI 助理由应用装配，外壳承载其首页和侧栏入口；对话、生成与工具执行归本分区，使用同一 SQLite，业务由各模块公开 operations 承担。手工 router 和工具 adapter 共用校验、版本、幂等及业务服务；Agent 不另写业务 SQL，也不通过内部 HTTP 复制 Cookie。

pi SDK 负责模型与工具循环、原生 entries 和上下文重建；应用负责持久化对话、公开投影及写操作 journal。entries 保留原生结构，不能向浏览器暴露 thinking。重启用已持久 entries 和同 ID toolResult 重建，不以模型重新生成旧请求体修复历史。

调用的 prepared、executing、结果与事件的原子顺序，停止竞态和未知结果只在[工具投影契约](../contracts/agent.md#工具调用的公开投影)维护。每次 provider 请求/工具调用重新核验原会话与可信账户；授权只在内存，重启后由新请求重新取得。网络调用留在业务事务之外。

当前 `@earendil-works/pi-coding-agent`、`pi-ai` 与 `pi-agent-core` 固定为 0.85.1。pi 包自带 npm-shrinkwrap，根 package 的 override 标记不能证明其包内实际安装版本已修复。升级时读取实际安装的包版本与依赖，再用隔离旧 entries 验证重开，并执行现有受控模型/工具调用回归；保留 SDK entries 格式与公开投影的兼容，不用锁文件标记替代运行证据。

[runtime](../../apps/api/src/agent/runtime.js) 直接调用 SDK 的 ModelRuntime/createAgentSession，设置 `noTools: 'builtin'`，仅装配现有 customTools，resource loader 关闭 extensions、skills、prompt templates、themes 和 context files；没有调用 CLI 的 proxy dispatcher。依赖可达性和升级影响按这条实际运行路径判断。

未知或损坏记录原样保留，历史公开投影可读，生成显示不可用；不得创建空会话覆盖。备份复用[数据管理](../features/data.md)，不新增 Agent 专用备份服务。

## 模型接入

产品使用 pi SDK 的 Command Code `openai-completions` adapter，官方 base URL 为 `https://api.commandcode.ai/provider/v1`，Chat Completions 路径 `/chat/completions`。后端使用私有 `COMMANDCODE_API_KEY`，前端不接收密钥；配置模板 [根 .env.example](../../.env.example)，实际加载见 [apps/api/src/agent/](../../apps/api/src/agent) 与启动配置。

<a id="allowed-models"></a>
### 模型白名单

仅允许 `deepseek/deepseek-v4.1-flash` 和 `z-ai/glm-5.3-flash`。精确 ID 在创建、恢复和发请求前校验，不用相似名字或其他目录项 fallback。

首批业务工具的局部通过不证明完整四模块、任意数学质量、当前余额或未来可用性。材料的本地 OCR 使用独立的[页识别链路](../contracts/recognition.md)，不以 AI 助理的开发状态判断其是否可用。

### 费用与未决

GOAT API 消耗账户 credits，不等于无限免费；Provider 返回 cost=0 不证明账单为零。余额、额外 credits、自动充值和实际费用未知。真实调用需当前任务的明确请求/轮次/token 上限；旧未用额度不结转，新 session 不重置消耗。`responses`、思考开关、视觉能力及流式参数必须有精确 Provider/模型实证，不能从原厂文档或目录名字推导。

旧模型实验与费用记录从 Git 查询，已关闭窗口不提供新的调用额度。

### 外部资料

已有调查日期为 2026-09-21，动态套餐和端点能力在恢复调用前重新核验：[Provider 文档](https://commandcode.ai/docs/provider)、[模型目录](https://commandcode.ai/docs/reference/cli/models)、[GOAT](https://commandcode.ai/docs/plans/goat)、[价格与限制](https://commandcode.ai/docs/resources/pricing-limits)、[Usage](https://commandcode.ai/docs/resources/usage-limits)。不因文档链接存在而查询账户、发请求或购买服务。

## 业务端口与验证

[apps/api/src/agent/business.js#connectBusinessOperations](../../apps/api/src/agent/business.js) 只连接已装配的公共业务端口。题库以 `port.businessOperations` 拥有旧请求与当前材料题的兼容裁决，助理不检查题面版本或重试另一套实现；资源和日程引用使用各模块同步 `readReference`，在同一事务捕获快照。缺席模块的引用沿既有 not-found 拒绝，工具只向模型声明实际可用的业务操作。提案仍能生成可阅读卡片，点击保存前核对对应业务操作存在；缺席能力不建立新的执行意图。历史 unconfirmed 操作在所属模块缺席时保持原状态与 journal；缺席意味着暂时无法读取原回执，不能裁决为写入失败。模块重新装配后仍沿原键核实，找回已提交结果。

当前工具由机器 schema 的 `x-agent-tools` 封闭定义；`proposals.js` 将已持久卡片转换为业务请求，`tools.js` 复用原 Operation/journal 执行及核实。四模块扩展仍按[未来扩展](../contracts/agent.md#四模块扩展契约)形成现行 schema 后接入。

[lifecycle](../../apps/api/src/agent/lifecycle.js) 拥有资料包的对话公开快照与引用投影、事件关系检查、恢复操作冻结及 HTTP 守卫、账户删除 SQL。部署恢复仅调用 `prepareRestoredAgent(db)`，保留原生 conversation 字节；reconcile 与提案 execute 共用冻结检查。底座先等待 runtime 真正停止再调用删除，保留既有撤销身份和迟到结果保护。

确定性 HTTP/浏览器与保留库 live 入口见[验证选择](../acceptance/README.md#模块与底座入口)；真实模型必须有本次授权，回放、人工 HTTP 或固定回答不能代签真实业务调用。

## 持久状态转换

[records](../../apps/api/src/agent/records.js) 拥有对话受理、草稿与引用捕获、停止标记、消息/用量/工具投影、提案槽位、结束结算及普通启动恢复。HTTP 只做身份、schema、原键幂等与传输；引用的公共读取和接受发送仍在同一同步 SQLite 事务。SDK runtime 取得本轮输入与原生 entries，通过本轮记录接口报告消息和请求，不解释提案来源或重启裁决。

[store](../../apps/api/src/agent/store.js) 保留 document 与有序事件的事务落盘；其可变 document/emit 只供 records 的实现使用。[record-tools](../../apps/api/src/agent/record-tools.js) 在该实现内共同维护 Operation、关联 ToolCall 与同身份原生结果。SDK 的 afterToolCall 在发布最终工具事件前，通过 records 结算本次已返回却缺少回执的调用；同批其他调用仍保留各自执行时序。结束结算也会替换 SDK 已写入的临时错误结果，保持原 entry ID/父链，并使 SDK 最终事件、原生结果与公开卡片同义。后续 SDK 会话快照继续采用已持久工具结果的身份和内容，翻译其后新消息的父链，避免 SDK 本地追加覆盖原生事实。

[tools](../../apps/api/src/agent/tools.js) 负责公共业务调用和响应分类，按“持久 executing、同步业务调用、持久结果”执行；结果落盘失败请求保留未知结果，核实继续使用记录模块返回的原请求与原键。提案只读卡与点击 Operation 分开，已结束 turn 的提案 prepared/executing 由 records 在普通启动时裁决。部署恢复的冻结账本与 HTTP 守卫仍归 lifecycle，不由普通启动恢复代替。
