# 执行协议

根 [AGENTS](../../AGENTS.md)内容保持不变。本协议提供它指向的角色入口和任务级约定。具体用户指令、[当前授权](run-state.md)决定本轮范围；不能用长期 DAG 或旧任务恢复已暂停的工作。

<a id="orchestration"></a>
## 编排者

接任与派发步骤见[编排操作](../agents/orchestrator.md)。仅编排者需要通读该页。根亲自执行的任务按用户明确委托处理。

<a id="design"></a>
## 设计 session

读[设计操作](../agents/designer.md)和本次领域资料。

<a id="implementation"></a>
## 实现 session

读[实施操作](../agents/implementer.md)和本次任务包。

<a id="acceptance"></a>
## 独立验收 session

读[验收操作](../agents/verifier.md)和具名验收范围。

<a id="integration"></a>
## 集成维护

从任务包取得候选提交和权限；核对共享文件、未提交修改、依赖和迁移。当前只保留 preview 开发树，一次只有一个集成写者。按实际影响构建和验证；已有用户数据沿用，受测候选与运行实例分开记录。普通文档集成不追加产品审查。

原库 main、本轮 push 与部署权限见当前台账。此前 main 合并许可不能推导为现在可以改动用户要求保留的原库。

<a id="delivery-priority"></a>
## 交付优先级

单用户实际体验优先，保持手动业务和既有 UI。暂停、环境暂缓、当前缺口只读[运行台账](run-state.md)，不在每份任务包复制整段状态。完整产品目标继续保留；局部可用不改写成全范围已完成。

<a id="模型与固定派发"></a>
## 模型与固定派发

本表是开发任务默认路由，不是产品内模型配置。记录实际模型和 effort，不设自动降级。

| 工作 | harness | 模型 | effort |
| --- | --- | --- | --- |
| 复杂行为、公共契约、架构设计 | Codex CLI | gpt-6-astra | high |
| 常规独立核验、阶段验收 | Codex CLI | gpt-6-astra | medium |
| 前后端实现与修复 | Codex CLI | gpt-6-astra | low |
| 实现反复失败后的困难接手 | Codex CLI | gpt-6-astra | high |
| 调研、文档、实验调查 | Codex CLI | gpt-6-sol | medium |
| 当前分支集成维护 | Codex CLI | gpt-6-sol | high |
| skill 内部助手 | 调用方 harness | 继承调用方 | 继承调用方 |

用户对具体任务的指定优先。例如用户曾给 UI 实施任务指定资料调查用 gpt-6-luna max、独立验收/代码审查用 gpt-6-sol high；只有携带该授权的任务才应用该例外，不把它变成全项目自动派发。

用户可直接指定其他模型担任编排或执行；角色步骤和事实来源不变。开发停用 dsh。产品 Agent 的两个模型白名单见[暂停线路入口](../modules/agent.md)。

<a id="ownership"></a>
## 写入与版本

- 任务边界按模块/目录表达。仅对实际共享入口、锁文件、公共样式、迁移 runner 等明确唯一写者，不穷举全部新文件。
- Git 中的资料用 commit + path 固定；未提交或外部样本才按需 SHA-256。活动任务的输入不能被后来的文档更改静默替换。
- 公共契约变化交责任设计者，给受影响消费者新版与必要验证；模块内部取舍交执行者。
- 当前只保留一个长期开发 worktree，实际并行必须符合当前写入边界和用户许可；旧协议中的每任务新 worktree 不作为当前指令。

## 失败与接续

普通失败按具体归属修复。实现困难最多先用默认实现者完成首次与一次有证据的修复，再由 Astra high 接手一次；输入/契约问题直接交设计者。相同输入重复失败后需要新证据或新方案，不靠更名重置尝试次数。成熟开源能力可优先复用适配。

额度中断保留现场，不降级；明确 model at capacity 可按用户已有许可恢复原会话。任务指定续接时保留 session 和产物，独立验收仍与作者分离。旧实验窗口不因接续重开。

正常完成走主动回执。只有异常通知或用户明确检查时核对一次相关状态；时间经过、无消息、queue 已投递均不证明任务失败或仍在运行。等待期间不轮询、不设置 check。

<a id="receipt"></a>
## 一份聚合回执

任务包给出保存位置。内容只需足以接续，不为格式补齐再做一次产品审查。

```yaml
task: "任务 ID"
revision: "本次任务版本"
attempt: "本次尝试编号"
status: "PASS | FAIL | BLOCKED"
verification_level: "self | independent | user"
session_id: "实际 session ID；无法取得写 unavailable"
finished_at_utc: "实际完成时间"
runner: "实际 harness / model / effort"
base_revision: "固定输入 commit"
result_revision: "产物 commit；未提交则路径及必要 hash"
changed_files: ["实际变化与范围"]
checks: ["真实操作或命令、结果、证据路径"]
open_items: ["剩余问题、拥有者、解除条件"]
next: "下一位的具体动作或等待条件"
```

涉及实际运行时注明身份和环境；涉及 `code-review` 时补 fixed point、实际 diff 范围与 Standards/Spec 分轴结果。内部结果聚合为一份回执。退出码、self、independent、user 分别表达不同事实。

成功后清理本任务临时材料；失败保留现场。旧证据及仍被程序使用的样本不是一次性垃圾。归档与运行工具按[恢复索引](worktree-archive.md)定位。
