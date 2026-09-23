# 有效契约

本目录的 OpenAPI、JSON schema 与样本由 API 和测试直接读取，修改路径时须同步消费者。Markdown 契约定义接口语义与未完成条件，不能据此推定产品已通过验收。

| 领域 | 入口 |
| --- | --- |
| 账户与会话 | [认证](auth.md)、[用例](auth-cases.md)、[OpenAPI](auth.openapi.yaml) |
| 工作台基础与首条流程 | [工作台](workbench.md)、[首条流程 OpenAPI](workbench/first-flow.openapi.yaml) |
| 题库、备课、资源 | [材料](workbench/materials.md)、[OpenAPI](workbench/materials.openapi.yaml) |
| 数学作品 | [数学](workbench/math.md)、[OpenAPI](workbench/math/math.openapi.json) |
| 班级教学与日程 | [教学时间](teaching-time.md)、[OpenAPI](teaching-time/teaching-time.openapi.yaml) |
| 产品 Agent | [Agent 契约](agent.md)、[OpenAPI](agent.openapi.json)。后续开发暂停，已接入的 API 仍须保持兼容。 |

`teaching-time/inputs/` 是跨契约引用的固定 schema 输入，`samples.json` 和 `cases.md` 是契约检查样本。删改前检查代码引用。
