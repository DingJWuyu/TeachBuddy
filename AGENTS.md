# AGENTS.md

## 项目入口

- 核对实际能力或运行状态时读 `README.md`；`prototype/` 是交互参考，`apps/` 才是真实产品实现位置，旧演示 API 不约束新契约。
- 编排 MVP 时从 `docs/plans/mvp-dag.md` 进入调度视图；了解总体进度时可从 `docs/ROADMAP.md` 导航。
- 当前编排状态和下一步读取 `docs/plans/run-state.md`；它只维护执行台账，不替代 DAG 的依赖与授权视图。
- 需要选择或解释 skill 流程时读取 `docs/plans/skill-routing.md`；任务包点名 skill 时，完整读取其 `SKILL.md` 及直接引用。业务 session 之间不互聊、不扩 DAG；skill 明确要求的有界内部 subagent 由调用 session 管理并聚合，只是该规则的有限例外，不单列 DAG 节点。
- 接到设计、实现或独立验收任务时，从本次任务包的必读清单进入对应节点、规格和 `docs/plans/execution-protocol.md` 的本角色章节；按触发条件补读，不要求通读 DAG 或其他模块。
- 设计或核查范围时读取 `docs/PRODUCT_SCOPE.md` 的相关段落；页面和跨模块行为读取 `docs/WORKBENCH_DESIGN.md` 的相关段落。范围不能由旧代码或原型反推。
- 登录注册由独立 session 负责；涉及身份交接或退出时读取 `docs/contracts/auth.md`，核对其源版本与未完成项，不把讨论中的契约当成已实现能力。

## Rules

**Git:**

- Branch：一条 main 主干；开发时必须从 main 创建短生命周期 branch → 持续合回 main，不允许在 main 上直接开发，必须经过用户准许才合并进 main；branch 命名优先使用常见前缀，但不严格限制。正式版本通过 `Release PR` 汇总后再打 Tag / 发布。
- Commit：遵循 Conventional Commits。
- Pull Request：如果用户让你生成 PR，Title 遵循 Conventional Commits；如有 PR Template，则务必遵循，否则默认为 Summarize-Why-What changed-Testing 四段式；如有关联 issue，则在 Body 中关联。

**Others:**

- 进行重要产品或部署变更时，保持 `README.md` 与项目当前面向公众的状态一致。
- 原型设计、UI/UX 开发规则：美学基线、间距与动效要求、参考来源边界、验证陷阱。参见 `docs/rules/design-and-verification.md`。
- 禁止给 UI 写单元测试，尽可能不写任何单元测试，只有必须时才写单元测试
- 等待另一个 subagent / session 返回的消息时，禁止不断轮询，必须停下来，等待对方主动发消息。
- 禁止 overengineering，本项目的用户只会有一个人，禁止不断增加复杂度，完全不需要考虑高性能高并发高可用。
- 设计系统架构、契约、技术方案等技术设计时，牢记第一性原理、奥卡姆剃刀、消融实验、批判性思维、独立思考、发现未知的未知、高内聚低耦合。
- 实现代码时，牢记第一性原理、奥卡姆剃刀、消融实验、高内聚低耦合。
- 编写文档时，禁止写 changelog/repair 式的无用历史信息，文档只保存当下，不承载历史，必须遵循 write-for-agents skill。

## Agent skills

### DeepSeek Harness

在已获实施授权的具体任务包中，用户已将实现 harness 的选择委托给根编排者；根可在 `dsh` 与 Codex Luna 之间选择，不要求用户逐节点再次点名。当前产品 DAG 尚未获得 G00，本轮不运行 `dsh`。选择 `dsh` 时，在当前项目目录中将完整任务说明作为单个参数交给一次性 Headless profile：

```bash
dsh --profile headless "<task>"
```

该命令使用 `~/.dsh/settings.yaml` 中当前配置的 Provider、模型和 reasoning effort；选择和回执规则见 [MVP 执行协议](docs/plans/execution-protocol.md#orchestration)。

### Issue tracker

问题和规格记录在 GitHub 仓库 `DingJWuyu/TeacherWorkspace` 的 Issues 中。参见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的五个 triage 标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。

### Domain docs

使用 single-context 布局：根目录 `CONTEXT.md` 和 `docs/adr/`。参见 `docs/agents/domain.md`。
