# EMODEL@1 真实 API 请求证据

## 结论

在 2026-09-21，以基线 `9f93c2a3f9d24a92c978c82438999f7e962993e0` 为输入，使用本机 `TeacherWorkspace/.env` 中的凭据，对两个允许模型各完成了一次修正后的最小真实请求。两次成功请求都通过了认证和模型路由，返回 `HTTP 200`。此前各有一次请求体构造错误的探针，见后文记录。

这证明了：

- 当前凭据可以在本机访问 `https://api.commandcode.ai/provider/v1/chat/completions`。
- `deepseek/deepseek-v4.1-flash` 和 `z-ai/glm-5.3-flash` 两个精确 model ID 都被服务接受并返回了对应模型 ID。
- 本次请求使用的是 OpenAI Chat Completions 形状，尚未证明 pi 的 provider adapter 或产品实现可以接通。

这没有证明正常文本输出、模型质量、流式输出、tool calling、Responses API、pi 接入、产品端环境变量加载、账户剩余额度或本次请求一定未触发额外计费。

## 验证元数据

| 项目 | 值 |
| --- | --- |
| verification_level | `self` |
| 验证日期 | `2026-09-21` |
| 基线 | `9f93c2a3f9d24a92c978c82438999f7e962993e0` |
| 当前分支 | `chore/emodel-live` |
| 请求客户端 | `/usr/bin/curl`，直接 HTTP 请求 |
| API base URL | `https://api.commandcode.ai/provider/v1` |
| 请求端点 | `POST /chat/completions` |
| 认证 | `Authorization: Bearer <本地凭据>`，凭据值未输出 |
| 请求是否运行产品 | 否 |
| 请求是否运行 pi | 否 |

模型、端点、Bearer 认证和 GOAT credits 规则的公开接入事实见 [Command Code Provider API 接入说明](../../research/command-code-api.md)，其中引用了 [Provider API 官方文档](https://commandcode.ai/docs/provider) 和 [GOAT Plan 官方文档](https://commandcode.ai/docs/plans/goat)。

## 成功请求事实

两次请求的请求体都只有一个短文本消息，使用 `max_tokens: 8`、`temperature: 0`、`stream: false`。消息内容是 `Reply with exactly OK.`。下表只记录脱敏后的响应事实，不保留原始响应或认证头。

| 请求 model ID | HTTP | 响应 model | choices | response id | finish reason | 抽取的 content | usage（prompt / completion / total） | elapsed |
| --- | ---: | --- | ---: | --- | --- | --- | --- | ---: |
| `deepseek/deepseek-v4.1-flash` | `200` | `deepseek/deepseek-v4.1-flash` | `1` | 有 | `length` | 为空或未提供 | `35 / 8 / 43` | 2907 ms |
| `z-ai/glm-5.3-flash` | `200` | `z-ai/glm-5.3-flash` | `1` | 有 | `length` | 为空或未提供 | `17 / 8 / 25` | 3262 ms |

两次响应都没有返回可识别的 `x-request-id` 或 `x-correlation-id`。耗时是本次单次探针的观察值，不是性能承诺。

`finish_reason=length` 且 completion usage 恰好为 8，说明该最小预算在本次响应中被耗尽。由于本次只抽取了 `choices[0].message.content`，不能据此判断空 content 是字段缺失、推理输出占用预算还是其他 provider 行为。后续 pi 实验需要用足够的 completion budget，并直接检查完整响应结构。

## 请求构造修正记录

第一次探针也到达了同一官方端点，但两个模型各返回一次 `HTTP 400`，错误均为：

```text
error.type=invalid_request_error
error.message=Request body is not valid JSON.
```

原因是本地 curl config 流对 JSON body 的转义方式错误。这两次响应是请求构造错误，不能作为模型不可用证据。随后改为直接以 `--data-binary` 传递由 `jq` 生成的 JSON body，并完成了上表中的两次 `HTTP 200` 请求。测试过程中的临时响应、请求头和凭据均已删除或未写入仓库。

## 费用和账户边界

- 本次只使用了用户授权的现有 Command Code 凭据和两个允许 model ID，没有购买、启用或调用其他模型。
- 成功响应给出了 token usage，但响应没有提供 GOAT included credits、账户余额、on-demand 开关或扣费收据。
- 因而本证据可以确认请求已被服务接受，不能从本机结果证明账户仍有多少套餐额度，也不能证明账户没有在套餐耗尽时进入额外 credits 或其他计费路径。这个边界与 [GOAT Plan 官方说明](https://commandcode.ai/docs/plans/goat) 中 credits 和超额行为的说明一致。
- 没有打开账户控制台、读取余额或修改计费设置。

## 尚未证明的 pi 实验输入

后续 pi 实验仍需单独验证：

1. pi 的 `commandcode` provider 是否选择 `openai-completions` 并把完整 model ID 原样发送到同一端点。
2. pi 对 `finish_reason=length`、空或缺失 `message.content`、可能存在的 reasoning 字段和 token usage 的解析行为。
3. pi 的环境变量加载是否只读取 `COMMANDCODE_API_KEY`，以及是否在请求前强制两个 model ID 的 allowlist。
4. 更充足 token budget 下的正常文本响应、失败响应、流式响应和 tool calling。
5. 账户剩余额度、模型 allowance 和真实扣费状态。

本次没有实现产品接入、没有运行产品、没有修改 `.env`，也没有把凭据复制到报告、日志、Issue 或提交中。
