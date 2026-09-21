# Command Code GOAT Provider API 接入说明

- 核查日期：2026-09-21
- 当前状态：首次调研的独立核验结论为 CHANGES_REQUIRED；RR-03 已由作者修正并自查，用户取消独立复审，当前配置结论进入文档集成。未启动 DAG、未实现产品接入、未安装依赖、未发起需要 API key 的请求。
- 适用范围：Command Code 官方 GOAT 套餐、官方 Provider API，以及本机 dsh/pi 的非秘密配置。
- 模型范围：产品后续只允许下表两个精确 model ID。本文是模型名单、接入事实和限制的权威位置，不把其他目录项当成 fallback，也不把产品配置准备误称为已接通 Agent。

## 结论

| 项目 | 状态 | 结论 |
| --- | --- | --- |
| 服务 | 已证实 | 官方服务是 Command Code Provider API，base URL 为 `https://api.commandcode.ai/provider/v1`。 |
| GOAT API 权利 | 已证实 | 官方说明 GOAT 可调用 Provider API，API 用量计入 GOAT credits；除 Go 外的套餐均有 API access。 |
| 本地转接 | 已证实 | 不需要自建代理或本地转接；OpenAI-compatible client 可直接指向官方 base URL。dsh/pi 的 provider adapter 只是客户端适配。 |
| 认证 | 已证实 | 目标模型走 OpenAI 兼容路线，使用 `Authorization: Bearer <CMD_API_KEY>`。API key 与 CLI 共用。 |
| 目标模型 | 已证实 | `deepseek/deepseek-v4.1-flash` 与 `z-ai/glm-5.3-flash` 均在官方模型目录，名称不能替换成相近版本。 |
| 账号可用性 | 尚未验证 | 本次没有登录 Studio、读取账户余额或调用 API，因此没有证明用户账号的套餐已生效、key 有效或当前仍有额度。 |

GOAT API 权利、共用 key 和 credits 计量见 [GOAT Plan 官方文档](https://commandcode.ai/docs/plans/goat)；兼容协议和 Provider API 入口见 [Provider API 官方文档](https://commandcode.ai/docs/provider)。

## 官方 API 用法

### Base URL、端点和协议

官方 Provider API 列出以下端点：

| 用途 | 方法 | 完整端点 | 协议 |
| --- | --- | --- | --- |
| 目标模型请求 | POST | `https://api.commandcode.ai/provider/v1/chat/completions` | OpenAI Chat Completions |
| OpenAI/open models 的另一种请求格式 | POST | `https://api.commandcode.ai/provider/v1/responses` | OpenAI Responses，是否可用要按模型的 `supported_endpoints` 检查 |
| 模型目录 | GET | `https://api.commandcode.ai/provider/v1/models` | Provider model catalog |
| Anthropic 模型 | POST | `https://api.commandcode.ai/provider/v1/messages` | Anthropic Messages，不适用于本次两个目标模型 |

官方文档明确列出端点，并说明 OpenAI/open models 使用 `/v1/chat/completions`；每个模型还带有 `supported_endpoints` 字段供客户端选择端点。[Provider API 官方端点与格式](https://commandcode.ai/docs/provider)

### 认证和请求形状

对本次两个 open models，后续适配应使用 OpenAI Chat Completions：

```text
POST ${COMMANDCODE_BASE_URL}/chat/completions
Authorization: Bearer ${COMMANDCODE_API_KEY}
Content-Type: application/json

{
  "model": "deepseek/deepseek-v4.1-flash",
  "messages": [
    {"role": "user", "content": "..."}
  ]
}
```

上面只是未执行的请求形状示例，不包含真实 key。本次没有执行 curl、SDK 或模型调用。官方错误说明确认 OpenAI 路线使用 `Authorization: Bearer <token>`；Anthropic SDK 在 `/messages` 上另有 `x-api-key` 形式，本次不使用。[Provider API 认证、请求和错误说明](https://commandcode.ai/docs/provider)

官方也支持 `stream: true`，但本次没有验证流式响应、tool calling、上下文上限或模型效果。后续若选用 `/responses`，应先读取 live model catalog 的 `supported_endpoints`，不能凭名称猜测。

<a id="allowed-models"></a>
## 两个允许模型的精确 ID

| 产品显示名 | Command Code Provider model ID | 本次适配端点 | 结论 |
| --- | --- | --- | --- |
| DeepSeek v4.1 Flash | `deepseek/deepseek-v4.1-flash` | `/provider/v1/chat/completions`（官方 OpenAI/open-model 路线；未做 live 请求） | 官方模型目录明确列出；禁止改成 `deepseek/deepseek-v4-flash`、`...flash-fast` 或其他版本。 |
| GLM 5.3 Flash | `z-ai/glm-5.3-flash` | `/provider/v1/chat/completions`（官方 OpenAI/open-model 路线；未做 live 请求） | 官方模型目录明确列出；禁止改成 `zai-org/GLM-5.3` 或其他 GLM 版本。 |

DeepSeek model ID 见 [Command Code Available Models](https://commandcode.ai/docs/reference/cli/models)；GLM model ID 也在同一官方目录的 Z AI 部分。GOAT 当前模型表同时列出这两个名称。[GOAT 当前包含模型](https://commandcode.ai/docs/plans/goat)

这里的 ID 是 Command Code Provider catalog ID，不是直接访问 DeepSeek 或 Z AI 官方服务时可以自行推导的 vendor ID。不能把名称映射当成协议或权限证明。

## 套餐、credits 和 API 之外的计费

### 已证实

- 官方当前价格页说明 GOAT 的套餐、included credits 和额外 credits 规则；具体金额、额度和适用条件以[Pricing & Limits 官方文档](https://commandcode.ai/docs/resources/pricing-limits)当前页面为准，不在本报告复制容易过时的固定金额。
- GOAT 的 API 请求计入套餐 credits 和模型访问权限；Provider 是另一个 pay-as-you-go 套餐，不是使用 GOAT API 的前置条件。[GOAT Plan 官方文档](https://commandcode.ai/docs/plans/goat)，[Provider API 官方文档](https://commandcode.ai/docs/provider)
- 套餐窗口或月度额度用尽后，如果账户有额外/on-demand credits，请求会按模型成本继续扣费；额外 credits 不受滚动窗口限制并可结转。没有额外 credits 时，付费模型会暂停，免费模型的行为另按官方当前规则处理。[GOAT 超出套餐额度](https://commandcode.ai/docs/plans/goat)，[Usage Limits 官方文档](https://commandcode.ai/docs/resources/usage-limits)
- 模型 token 价格由官方当前价格表和实际账户 credits 共同决定；价格表可能按模型、input/output/cache read 及峰谷时段区分，不能把某个时段的价格当作全天统一价格。真实调用前应按[官方当前价格表](https://commandcode.ai/docs/resources/pricing-limits)核对适用费率和账户 credits，不作静态预算承诺。

### 尚未验证

- 用户账户是否已购买并激活 GOAT、是否有可用 monthly credits 或额外 credits。
- Studio 是否启用了自动充值、账户所在地区的税费/支付处理费，以及当前账户的实际模型 allowance。
- 本项目未来是否需要显式发送 `x-cmd-zdr: 1`。ZDR 会影响上游路由和价格，本次不默认开启。[ZDR 官方文档](https://commandcode.ai/docs/resources/zdr)

因此，本次结论是“GOAT 官方支持 API，API 用量按 GOAT credits 计量”，不是“填 key 后无限免费”。任何超出 included credits 的真实调用都必须以用户账户的额外 credits/计费设置为准。

## API key 从哪里取得

1. 在 Edge 或 Chrome 登录 Command Code。
2. 进入 Studio 的 API keys 页面：[https://commandcode.ai/settings/keys](https://commandcode.ai/settings/keys)。官方 GOAT 和 Provider 文档都把这里作为创建 API key 的入口。
3. 创建或复制 key，只填写本地 [`.env`](../../.env) 的 `COMMANDCODE_API_KEY=`；不要写入研究文档、日志、Issue、提交记录或聊天消息。

本次没有打开登录后的页面，也没有读取或验证任何账户 key。官方 quickstart 另说明 CLI 登录会将同一类 key 用于 CLI 和 API，但本任务不需要安装或启动 Command Code CLI。[官方 Quickstart](https://commandcode.ai/docs/quickstart)

## 本机 dsh/pi 的非秘密核对

本次只读取 `~/.dsh/settings.yaml` 的明确非秘密字段，并运行了 `dsh --help`、`pi --help`、`pi auth --help`。没有读取或打印 credentials、API key、token、Authorization、Cookie，也没有发起 dsh 模型任务。

核对到的当前本机设置为：

```text
provider displayName = Command Code
provider id          = commandcode
apiKeyEnv            = COMMANDCODE_API_KEY
api                  = openai-completions
baseURL              = https://api.commandcode.ai/provider/v1
default model        = deepseek/deepseek-v4.1-flash
allowed target IDs   = deepseek/deepseek-v4.1-flash, z-ai/glm-5.3-flash
```

这与官方 Provider API 的 OpenAI-compatible 路线一致，因此后续 pi 接入应选择 `commandcode` provider 的 `openai-completions` 适配，并传递完整 model ID。这里是基于本机 dsh overlay 与官方协议的配置判断，不是运行成功证明。

本机 dsh 配置还包含其他模型目录项。那些目录项只证明本地配置曾列出它们，不能成为本产品的 fallback、允许范围或套餐 entitlement。产品限制必须独立执行。

## 证据分级

- **已证实**：Command Code 官方文档公开 GOAT 的 API 权利、Provider base URL、OpenAI/Anthropic 兼容端点、Bearer 认证、credits 计量和两个精确 model ID；本机 dsh 明确配置了 `commandcode`、`openai-completions`、同一 base URL 和两个目标 ID。
- **依据来源推断**：后续 pi 接入应沿用本机 dsh 的 `openai-completions` provider adapter，并把两个完整 ID 发到 `/chat/completions`；官方文档把该路由用于 OpenAI/open models，但本次没有拉取 live `supported_endpoints` 或发送真实请求。
- **尚未验证**：用户账户的 GOAT 激活、key 有效性、余额/额外 credits、当前模型权限、真实 HTTP 响应、实际计费以及产品端环境变量加载。

## 本次生成的环境模板

- 根目录 [`.env`](../../.env)：本地配置文件权限为 `0600`，保留用户当前值；本报告不记录 key 状态或值。只放入上面已核实的 provider、API 类型、base URL、默认 model 和两项声明性 allowlist。该文件已被现有 `.gitignore` 的 `.env` 规则忽略。
- [`.env.agent.example`](../../.env.agent.example)：无密钥模板，可在未来合入 main 时作为模板；其中 key 仍为空。
- `.gitignore`：只新增 `.env.agent` 精确规则，避免将未来的待填本地文件提交；没有改动既有 `.env` 规则。

当前仓库没有既有的模型环境变量命名可对齐；旧 `apps/api` 只消费账户、SMTP、SQLite 等变量。`apps/api` 没有现成的 dotenv 加载或 Command Code 读取逻辑，因此当前结果是“配置准备完成，实际读取与接通待实现”。只填写 key 不会让现有应用自动获得 Agent 能力。

## 后续产品实现的允许范围

后续实现应在后端的模型请求边界、也就是发出 Provider API 请求之前，用精确集合校验：

```text
deepseek/deepseek-v4.1-flash
z-ai/glm-5.3-flash
```

任何其他 model ID 都应在本地被拒绝，不能静默改写、降级或 fallback。界面可复用同一集合做选择项展示，但真正的安全边界必须在服务端/provider adapter 的请求构造处；`.env` 中的 `COMMANDCODE_ALLOWED_MODELS` 只是声明，不等于已实现强制限制。本次不写这段产品校验代码。

## 验证结果和剩余外部条件

### 本次已完成

- 官方服务、GOAT API 权利、base URL、端点、认证方式、两个精确 model ID 和当前 credits 规则已用官方资料核查。
- 本机 dsh 的 provider、API 类型、base URL、key 环境变量名、默认模型和两个目标 ID 已做非秘密核对。
- `.env` 和 `.env.agent.example` 的键名/空值语法已做本地静态检查；没有加载 key，也没有调用 API。
- `.env` 已被 Git 忽略；`.env.agent` 已加入精确忽略规则；示例文件不含秘密。

### 真实验收仍需要

- 用户账户的 key、额度和实际模型权限仍需在获准真实调用时验证；本地 `.env` 是否已填写不等于账号或 API 已验证。
- 后续实现明确加载这些环境变量、接入 `commandcode` 的 OpenAI-compatible adapter，并在请求前强制两项 allowlist。
- 用户授权后分别对两个精确 model ID 做最小真实 API 验收，检查 401/403、额度、当前 `supported_endpoints`、响应格式和实际计费。该步骤会消耗账户额度，本次没有执行。

本研究没有证明 API key 有效、两个模型实际返回质量、流式/tool calling、ZDR、Windows 本地运行效果或产品 Agent 能力。
