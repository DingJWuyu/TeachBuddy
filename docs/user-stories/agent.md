# 早期 Agent 用户故事

状态：C25/v1，READY_FOR_REVIEW，作者 self；冻结由外层独立审查确认。范围来自 [工作台 Agent](../PRODUCT_SCOPE.md#工作台-agent) 和[现场保留](../WORKBENCH_DESIGN.md#所有现场都保留)。本批先接题库、备课；其他四模块仍属于完整 MVP，由其业务契约就绪后的静态接入完成。

| 故事 | 用户价值 | 可观察场景 |
| --- | --- | --- |
| AG-01 | 作为老师，我希望在首页与业务右栏接续同一个助理，以便找题、查看结果时不用重新解释背景。 | WB-AG-001、WB-AG-002、WB-AG-003 |
| AG-02 | 作为老师，我希望对话、引用和输入草稿保存下来，以便刷新、重登或换设备后继续。 | WB-AG-004、WB-AG-005、WB-AG-006、WB-AG-015 |
| AG-03 | 作为老师，我希望助理查找、复制改编题目并加入指定备课环节，以便在真实文稿里继续手工修改。 | WB-AG-007、WB-AG-008、WB-AG-009、WB-AG-019、WB-AG-023 |
| AG-04 | 作为老师，我希望中断、重复发送和人工修改冲突都有清楚结果，以便既有内容不会被重复创建或意外覆盖。 | WB-AG-010、WB-AG-011、WB-AG-012、WB-AG-013、WB-AG-014、WB-AG-020、WB-AG-021、WB-AG-022 |
| AG-05 | 作为老师，我希望知道当前能用哪个模型、调用是否失败及可核实的用量，以便决定是否继续。 | WB-AG-016、WB-AG-017、WB-AG-018 |

实现从 [UX](../ux/agent.md) 进入；字段只见 [Agent OpenAPI](../contracts/agent.openapi.json)，跨请求语义见[契约说明](../contracts/agent.md)。实验有效范围、依赖与数据所有权见[架构](../arch/agent.md)。验收统一使用 [BDD](../acceptance/agent.feature)，任务派发使用 [C26/C27](../plans/tasks/agent-implementation.md)。
