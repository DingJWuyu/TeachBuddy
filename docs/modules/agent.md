# 产品 Agent：暂停线路

这是产品中的助理，不是负责开发的 Codex。用户已暂停产品 Agent 的实现、扩展及相关 skills 工作；现有代码与界面保留。发现普通手动业务问题时，不因它和 Agent 共用服务就恢复整条 Agent 线路。

## 仅在明确授权恢复后读取

- 首批语义：[Agent 契约](../contracts/agent.md)、[架构](../arch/agent.md)、[UX](../ux/agent.md)。
- 当前代码：`apps/api/src/agent/`、`apps/web/src/features/agent/`；集成从 `apps/api/src/workbench/` 和外壳核对。
- F60 完整设计已冻结，原始工具扩展仍未完整交付。固定设计与回执见[后续输入](../plans/run-inputs.md#可靠性)，不能因计划列出工具就认为已具备。
- 现成验证入口包含真实产品模型调用，恢复前先核对任务许可和调用窗口。

## 运行与模型边界

产品使用 pi runtime，Provider 为 Command Code。产品白名单只有 `deepseek/deepseek-v4.1-flash` 和 `z-ai/glm-5.3-flash`，与开发 Codex 模型表不同。凭据放私有配置，不在文档里保存。

已关闭的实验窗口不自动重开。源码中的助理入口或首批测试通过不代表六模块全部操作已经完成。恢复工作时先固定手动业务端口与用户目标，再确认真正需要的工具和 UI。
