# AGENTS.md

## 项目入口

- 产品能力与本地运行读 [README](README.md)；配置、隔离实例与本机体验服务读 [SETUP](docs/SETUP.md)。`apps/` 是产品实现，`docs/design-system/` 是只读设计输入。
- 查范围、行为、契约或验收时从[文档入口](docs/README.md)按任务展开；产品范围不能由旧代码或原型反推。身份交接或退出读取[认证契约](docs/contracts/auth.md)。
- 修改或审查子系统时先读[运行参考](docs/subsystems/README.md)，追到实际源码与调用路径。涉及模块装配、跨模块访问或公共职责时另读[模块边界决议](docs/adr/0001-use-a-single-static-module-catalog.md)。
- 界面改动同时读[设计输入](docs/design-system/README.md)；选择验证读[验证入口](docs/acceptance/README.md)。
- 编写或整理文档使用 `writing-for-agents`，按[文档维护](docs/CODING_STANDARDS.md#文档维护)更新唯一权威位置。

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `DingJWuyu/TeachBuddy`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, each named after its role. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.

## Coding standards

Write and review code against [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md). When changing these rules, follow [LESSONS.md](LESSONS.md) to update the matching lesson.

## Agent roles

When the user assigns you a role, read its instructions:

- **Orchestrator**: [docs/agents/orchestrator.md](docs/agents/orchestrator.md).
- **Executor**: [docs/agents/executor.md](docs/agents/executor.md).

## Agent tools

Read the instructions in `docs/agents/tools/` for the tool running this session.

## Lessons

Before reviewing work or running the `retro` skill, read [LESSONS.md](LESSONS.md). Follow it when recording or updating lessons.
