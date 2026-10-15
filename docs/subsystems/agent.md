# AI 助理技术入口

修改对话持久化、pi、SSE/journal、工具装配或 provider 时读本页。用户行为见[助理规格](../features/agent.md)，请求间不变量见[助理契约](../contracts/agent.md)，当前扩展暂停与授权归[运行台账](../plans/run-state.md)。接缝、存储或运行配置变化时同步；历史设计与工具可调用性不代表实际接入。

## 装配与持久化

Web [apps/web/src/features/agent/](../../apps/web/src/features/agent)，API [apps/api/src/agent/](../../apps/api/src/agent)；入口由 WorkbenchApp 组合。

AI 助理由应用装配，外壳承载其首页和侧栏入口；对话、生成与工具执行归本分区，使用同一 SQLite，业务由各模块公开 operations 承担。手工 router 和工具 adapter 共用校验、版本、幂等及业务服务；Agent 不另写业务 SQL，也不通过内部 HTTP 复制 Cookie。

pi SDK 负责模型与工具循环、原生 entries 和上下文重建；应用负责持久化对话、公开投影及写操作 journal。entries 保留原生结构，不能向浏览器暴露 thinking。重启用已持久 entries 和同 ID toolResult 重建，不以模型重新生成旧请求体修复历史。

调用的 prepared、executing、结果与事件的原子顺序，停止竞态和未知结果只在[工具投影契约](../contracts/agent.md#工具调用的公开投影)维护。每次 provider 请求/工具调用重新核验原会话与可信账户；授权只在内存，重启后由新请求重新取得。网络调用留在业务事务之外。

升级 SDK/entries 格式前用隔离旧库验证重开。未知或损坏记录原样保留，历史公开投影可读，生成显示不可用；不得创建空会话覆盖。备份复用[数据管理](../features/data.md)，不新增 Agent 专用备份服务。

## 模型接入

产品使用 pi SDK 的 Command Code `openai-completions` adapter，官方 base URL 为 `https://api.commandcode.ai/provider/v1`，Chat Completions 路径 `/chat/completions`。后端使用私有 `COMMANDCODE_API_KEY`，前端不接收密钥；配置模板 [.env.agent.example](../../.env.agent.example)，实际加载见 [apps/api/src/agent/](../../apps/api/src/agent) 与启动配置。

<a id="allowed-models"></a>
### 模型白名单

仅允许 `deepseek/deepseek-v4.1-flash` 和 `z-ai/glm-5.3-flash`。精确 ID 在创建、恢复和发请求前校验，不用相似名字或其他目录项 fallback。开发 Codex 模型路由另见[开发约定](../agents/module-development.md#模型与固定派发)。

首批业务工具的具名结果与当前开发授权见[项目状态](../plans/run-state.md)；局部通过不证明完整四模块、任意数学质量、当前余额或未来可用性。材料的本地 OCR 使用独立的[页识别链路](../contracts/recognition.md)，不以 AI 助理的开发状态判断其是否可用。

### 费用与未决

GOAT API 消耗账户 credits，不等于无限免费；Provider 返回 cost=0 不证明账单为零。余额、额外 credits、自动充值和实际费用未知。真实调用需当前任务的明确请求/轮次/token 上限；旧未用额度不结转，新 session 不重置消耗。`responses`、思考开关、视觉能力及流式参数必须有精确 Provider/模型实证，不能从原厂文档或目录名字推导。

旧模型实验与费用记录从 Git 查询，已关闭窗口不提供新的调用额度。当前授权只看[台账](../plans/run-state.md)。

### 外部资料

已有调查日期为 2026-09-21，动态套餐和端点能力在恢复调用前重新核验：[Provider 文档](https://commandcode.ai/docs/provider)、[模型目录](https://commandcode.ai/docs/reference/cli/models)、[GOAT](https://commandcode.ai/docs/plans/goat)、[价格与限制](https://commandcode.ai/docs/resources/pricing-limits)、[Usage](https://commandcode.ai/docs/resources/usage-limits)。不因文档链接存在而查询账户、发请求或购买服务。

## 业务端口与验证

[apps/api/src/agent/business.js#connectBusinessOperations](../../apps/api/src/agent/business.js) 适配题库兼容 operations 与当前 v2 材料操作；副本只读查询调用 [materials-operations](../../apps/api/src/modules/questions/materials-operations.js) 的 `listQuestionCopiesForAgent`，不从 HTTP router 构造工具。其他模块真实可调用面从[各技术页](README.md)核对，日程只读 port 不能直接冒充幂等写入口。首批工具由机器 schema 的 `x-agent-tools` 封闭定义；四模块扩展仍按[未来扩展](../contracts/agent.md#四模块扩展契约)形成现行 schema 后接入。

确定性 HTTP/浏览器与保留库 live 入口见[验证选择](../acceptance/README.md#模块与底座入口)；真实模型必须有本次授权，回放、人工 HTTP 或固定回答不能代签真实业务调用。
