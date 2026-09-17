# AGENTS.md

## Rules

**Git:**

- Branch：一条 main 主干；开发时从 main 创建短生命周期 branch → 持续合回 main；branch 命名优先使用常见前缀，但不严格限制。正式版本通过 `Release PR` 汇总后再打 Tag / 发布。
* Commit：创建 commit 遵循 Conventional Commits。
* Pull Request：如果用户让你生成 PR，Title 遵循 Conventional Commits；如有 PR Template，则务必遵循，否则默认为 Summarize-Why-What changed-Testing 四段式；如有关联 issue，则在 Body 中关联。

**Others:**

- 进行重要产品或部署变更时，保持 `README.md` 与项目当前面向公众的状态一致。
- 每次进行改变代码、文档、部署行为、架构或工作流的实质性操作后，更新 `CHANGELOG.md`。
- 将 `CHANGELOG.md` 同时视为公开发布日志和工程日志。
- 如果变更太小，不适合写入公开摘要，仍要在工程日志部分记录。

## Agent skills

### Issue tracker

问题和规格记录在 GitHub 仓库 `DingJWuyu/TeacherWorkspace` 的 Issues 中。参见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的五个 triage 标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。

### Domain docs

使用 single-context 布局：根目录 `CONTEXT.md` 和 `docs/adr/`。参见 `docs/agents/domain.md`。
