# 开发基线与资料交接

唯一长期开发树为 `TeacherWorkspace-preview` 的 `preview/usable-mvp`。原库 `TeacherWorkspace/main` 保持不动。当前产品、任务和权限统一读取[运行台账](../plans/run-state.md)。

## 开始新任务

1. 在目标树读取根 AGENTS、`git status --short` 和实际 HEAD；保留未提交的用户规则、资料与证据。
2. 从[模块入口](../README.md#模块入口)取得当前领域资料，不从早期 B10/B11 固定基线重新开始实现。
3. 任务包固定实际输入及写者。只有消费历史证据时使用其原候选；新修改基于当前指定组合。
4. 验证和集成分别标明代码候选、构建与运行实例。当前环境的启动方式见[运行指南](../SETUP.md)。

共享目录和端口由 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md)、[工作台契约](../contracts/workbench.md)拥有。精确字段读同批 OpenAPI / schema。原型用于保留 UI/UX，旧演示 API 不约束现在的真实接口。

需要原回执或旧工作树现场时使用[恢复索引](../plans/worktree-archive.md)。纯文档状态变化不能成为重新派一轮产品实现或审查的理由。
