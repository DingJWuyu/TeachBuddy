# 按需选择技能

以当前会话提供的 skill 描述和实际 SKILL.md 为准，按任务触发条件选择并读取；任务点名时完整读取及其直接引用。技能不可用时如实说明，旧任务记录不证明本机仍安装。

文档使用 `writing-for-agents`，保持权威来源唯一并按任务披露细节。领域术语与 ADR 遵循[领域约定](../agents/domain.md)；Issue 与标签遵循[仓库配置](../agents/issue-tracker.md)和[标签表](../agents/triage-labels.md)。

模型与内部助手按[执行约定](execution-protocol.md#模型与固定派发)及本次用户指定。skill 不扩大产品范围、外部写入、费用或发布权限。

作者自验、代码审查和独立流程验收的区别，以及固定 diff 的边界见[技能与验证](execution-protocol.md#技能与验证)。普通文档整理做必要自检，不追加重复审查。
