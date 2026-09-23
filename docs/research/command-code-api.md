# 产品模型接入与调用边界

产品使用 pi SDK 的 Command Code `openai-completions` adapter，官方 base URL 为 `https://api.commandcode.ai/provider/v1`，Chat Completions 路径 `/chat/completions`。后端使用私有 `COMMANDCODE_API_KEY`，前端不接收密钥；配置模板 [.env.agent.example](../../.env.agent.example)，实际加载见 `apps/api/src/agent/` 与启动配置。

<a id="allowed-models"></a>
## 模型白名单

仅允许 `deepseek/deepseek-v4.1-flash` 和 `z-ai/glm-5.3-flash`。精确 ID 在创建、恢复和发请求前校验，不用相似名字或其他目录项 fallback。开发 Codex 模型路由另见[执行约定](../plans/execution-protocol.md#模型与固定派发)。

已有具名探针和首批业务工具结果，不再是“仅配置准备、尚未接通”。这些结果不证明完整六模块、任意数学质量、当前余额或未来可用性。产品 Agent 当前暂停，C21 在线窗口关闭，本地 OCR 权重也未获准，见[台账](../plans/run-state.md)。

## 费用与未决

GOAT API 消耗账户 credits，不等于无限免费；Provider 返回 cost=0 不证明账单为零。余额、额外 credits、自动充值和实际费用未知。真实调用需当前任务的明确请求/轮次/token 上限；旧未用额度不结转，新 session 不重置消耗。`responses`、思考开关、视觉能力及流式参数必须有精确 Provider/模型实证，不能从原厂文档或目录名字推导。

| 已关闭窗口 | 已记录消耗与保留未知 |
| --- | --- |
| C21 在线 | 19 次、16 份 usage、108777 已知 completion；3 份缺失及 online-1 预留 8000 未知；新增许可 0 |
| C24 真业务 | 32 次、93970 total；早期探针/非法请求另计，原始 `e8fdf9a139e429c05590925647a433a9da382579:docs/acceptance/evidence/C24/v1/business-fix.md` |
| C26 自验 | 10 次、79983 total；原作者 `ec5094c00d122c77d2acdb376f4ede96eafb13e0` |
| C27 独立 | 11 次、88550 total；live `34e668ae97e1eb0cd5744550b6b05a4c25aa9301`；后继排版复验无新增 |

这不是项目累计总量，更早 EMODEL/C23 以 Git 原回执为准。C21 旧账源为 `2b10b4ecbfef907de1d0c368c7a29eb49af803c4:experiments/C21/page-transcription-1/ledger.json`。

## 外部资料

已有调查日期为 2026-09-21，动态套餐和端点能力在恢复调用前重新核验：[Provider 文档](https://commandcode.ai/docs/provider)、[模型目录](https://commandcode.ai/docs/reference/cli/models)、[GOAT](https://commandcode.ai/docs/plans/goat)、[价格与限制](https://commandcode.ai/docs/resources/pricing-limits)、[Usage](https://commandcode.ai/docs/resources/usage-limits)。不因文档链接存在而查询账户、发请求或购买服务。
