# AGENTS.md

## 项目入口

- 产品能力与本地运行读 [README](README.md)；配置、隔离实例、测试环境与本机体验服务读 [SETUP](docs/SETUP.md)。
- 老师应当得到什么、故意不做什么读[产品说明](docs/product/README.md)及对应分区页；产品范围不能由旧代码或原型反推。接口语义读 `apps/api/src/contracts/` 的 OpenAPI。
- 涉及模块装配、跨模块访问或公共职责时读 [ADR 0001](docs/adr/0001-use-a-single-static-module-catalog.md)。
- 界面改动同时读只读的[设计输入](docs/design-system/README.md)。
- 编写或整理文档使用 `writing-for-agents`，按[文档维护](docs/CODING_STANDARDS.md#文档维护)更新。

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
