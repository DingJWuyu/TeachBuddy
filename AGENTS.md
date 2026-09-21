# AGENTS.md

## 项目入口

- 接手工作先读 `README.md` 的实际状态和 `docs/ROADMAP.md` 的当前任务；MVP 范围以 `docs/PRODUCT_SCOPE.md` 为准。
- 工作台的行为、契约、并行实现和验收按 ROADMAP 推进。`prototype/` 是交互参考，`apps/` 才是真实产品实现位置；旧演示 API 不约束新契约。
- 登录注册由独立 session 负责；涉及身份交接或退出时读取 `docs/contracts/auth.md`，核对其源版本与未完成项，不把讨论中的契约当成已实现能力。

## Rules

**Git:**

- Branch：一条 main 主干；开发时必须从 main 创建短生命周期 branch → 持续合回 main，不允许在 main 上直接开发，必须经过用户准许才合并进 main；branch 命名优先使用常见前缀，但不严格限制。正式版本通过 `Release PR` 汇总后再打 Tag / 发布。
- Commit：遵循 Conventional Commits。
- Pull Request：如果用户让你生成 PR，Title 遵循 Conventional Commits；如有 PR Template，则务必遵循，否则默认为 Summarize-Why-What changed-Testing 四段式；如有关联 issue，则在 Body 中关联。

**Others:**

- 进行重要产品或部署变更时，保持 `README.md` 与项目当前面向公众的状态一致。
- UI/UX 开发规则：美学基线、间距与动效要求、参考来源边界、验证陷阱。参见 `docs/rules/design-and-verification.md`。

## Agent skills

### DeepSeek Harness

当用户明确要求调用 `dsh` 时，在当前项目目录中将完整任务说明作为单个参数交给一次性 Headless profile：

```bash
dsh --profile headless "<task>"
```

该命令使用 `~/.dsh/settings.yaml` 中当前配置的 Provider、模型和 reasoning effort。

### Issue tracker

问题和规格记录在 GitHub 仓库 `DingJWuyu/TeacherWorkspace` 的 Issues 中。参见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的五个 triage 标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。

### Domain docs

使用 single-context 布局：根目录 `CONTEXT.md` 和 `docs/adr/`。参见 `docs/agents/domain.md`。
