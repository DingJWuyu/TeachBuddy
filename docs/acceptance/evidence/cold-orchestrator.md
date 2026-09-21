# 新 session 接任实验

- 任务：`cold-orchestrator@1`，attempt `1`。
- 独立 session：`01a0c524-4a9b-71f2-828d-314754c4cf5c`，Codex，`gpt-5.6-luna`，`max`。
- 受测版本：`f1d408515b7ba89653e59603d3e857883f81265d`。独立 detached worktree，实验前后 Git 工作区均干净。
- 根接收时间：`2026-09-21T18:09:39.706639+00:00`。
- 输入只有下列任务原文，未传入此前对话或额外文件导航。仓库自身的 AGENTS 与文档是实验对象。
- 实验者判断：能理解编排职责、当前状态和后续动作；长程运行可靠性尚未实际验证。本次没有实际接管、派工或产品运行。
- 证据范围：一次冷启动阅读与判断，不是产品验收、恢复演练或长程执行通过结论。

## 任务原文

你是一个没有此前聊天上下文的新 session，现在请以接任本项目编排者的身份做一次可行性实验：你能否清楚知道自己应当做什么，以及能否稳定推进这个长程任务？请说明你的判断、接下来会采取的动作和仍然妨碍接续的问题，并给出依据。本次仅做判断并报告，不实际接管、不派发任务、不修改仓库、不运行产品。

## 实验者原始回答

以下原文中的文件位置和行号指受测版本；临时 worktree 已完成用途，源码仍可通过上述 Git 提交定位。

```text
结论：可以清楚接任，但当前只能做到“可接续判断”，不能合法开始推进。长程推进机制基本完整，但实际可靠性尚未被真实任务验证。

### 我已经能确定的职责

- 编排者只负责读取 DAG、检查依赖和授权、派发独立 session、核对结构化回执、更新台账，不负责补产品设计、实现或实质审查。[执行协议](< /home/liam_t/项目/TeacherWorkspace-cold-orchestrator/docs/plans/execution-protocol.md:10 >)
- 当前产品仍不是已交付 MVP，原型和旧应用不能替代真实实现。[README](</home/liam_t/项目/TeacherWorkspace-cold-orchestrator/README.md:5>)
- 当前阶段停在 G00。P01 已完成，但产品实施必须等待用户明确授权，main 合并许可不等于实施许可。[MVP DAG](</home/liam_t/项目/TeacherWorkspace-cold-orchestrator/docs/plans/mvp-dag.md:13>)
- G00 之后的首个产品节点是 B10，后续按固定版本、任务包、依赖和回执逐步推进。[MVP DAG](</home/liam_t/项目/TeacherWorkspace-cold-orchestrator/docs/plans/mvp-dag.md:153>)

因此，我知道“编排者下一步该判断什么”，也知道“不应该擅自做什么”。未来行为细节由设计 session 冻结，不需要冷启动 session 自行猜接口或 UI。

### 如果正式接任，动作顺序会是

1. 读取根规则、运行台账、当前任务包和正式回执。
2. 核对是否有未完成任务及真实回执，不把 queue 投递误认为 session 正在运行。
3. 在 G00 未获得前保持产品 DAG 停止。
4. G00 获得且 B10 任务包具备固定基线、写入边界和验证条件后，从固定 main 建立短期 worktree/branch，再派发 B10。
5. 收到回执后核对 `task`、`revision`、`attempt`、`session_id` 和 `verification_level`，再决定是否进入下游。[执行协议](</home/liam_t/项目/TeacherWorkspace-cold-orchestrator/docs/plans/execution-protocol.md:19>)

本次实际不会执行这些动作，符合你的限制。

### 仍然妨碍接续的问题

- 产品实施授权 G00 尚未授予，产品节点尚未派发，worktree 也尚未生成。[运行台账](</home/liam_t/项目/TeacherWorkspace-cold-orchestrator/docs/plans/run-state.md:40>)
- 认证交接仍等待主动回执，不能据此假定真实认证已经交付。[运行台账](</home/liam_t/项目/TeacherWorkspace-cold-orchestrator/docs/plans/run-state.md:33>)
- 真实模型调用、额度、部署环境、目标浏览器/Office、备份恢复和中断恢复仍未验证。[运行台账](</home/liam_t/项目/TeacherWorkspace-cold-orchestrator/docs/plans/run-state.md:44>)
- 回执监测和恢复机制已有规则，但首次 `check` 投递与恢复演练尚未验证。[运行台账](</home/liam_t/项目/TeacherWorkspace-cold-orchestrator/docs/plans/run-state.md:26>)
- 当前 checkout 是干净的 detached HEAD，不是工作分支。正式写入前必须按协议从固定 main 建立短期分支或 worktree。

最终判断：冷启动理解能力通过，编排规则足以支持稳定推进；但当前是“等待授权和外部输入”的状态，不能把流程设计上的可行性误报为产品已经可以启动或长期运行已得到实证。
```
