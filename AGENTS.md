# 仓库协作规则

用中文沟通。文档只描述当前事实和未来条件；写供 Agent 使用的文档时先读 `/home/liam_t/.agents/skills/writing-for-agents/SKILL.md`。使用普通连字符，不使用 em dash。生成提交信息时不添加 Agent 共同作者。`CHANGELOG.md` 和标记为自动生成的文件由其生成流程维护。

## 工作入口

- 实际产品在 `apps/`；`prototype/` 仅供交互参考。核对能力先看代码与 [README](README.md)，不可从原型或旧回执推定现状。
- 设计或核对功能范围时读 [产品范围](docs/product/scope.md)的相关模块；设计页面或跨模块行为时读 [工作台设计](docs/product/workbench.md)的相关段落。
- 开发或验收前读 [当前状态](docs/plans/status.md)的相关事项。当前唯一开发目录是本仓库的 `preview/usable-mvp`；产品 Agent 和全站外壳改造暂停。现有界面和账户、文件、配置、服务应保留；恢复暂停线路或改变目标环境优先级需要用户新指令。
- 涉及接口、数据或身份交接时读 [契约目录](docs/contracts/README.md)与对应契约。schema 是运行输入；契约要求不能直接写成已实现能力。
- UI 工作读 [设计与验证规则](docs/development/ui-quality.md)。从真实页面和用户操作验证布局、动效及保存结果，保持现有外壳和已确认的界面风格。
- 修改项目术语或重大稳定决策时读 [CONTEXT](CONTEXT.md)和适用 [ADR](docs/adr/)。

## 实施与验证

- 优先服务一位教师的真实流程和长期可维护性。用简单、内聚的实现；不要为高并发或假设性场景增设机制。
- 技术取舍优先考虑质量、简洁、鲁棒性和可维护性，开发成本不是主要权重。一次性运维工作先走最直接的端到端路径；只有遇到具体阻碍或重复需求才增加自动化。使用会立即派出大量子 Agent 的动态工作流前，先说明代价并取得用户明确同意。
- 修复缺陷先从接近用户操作的端到端路径复现，再定位原因。看到明显 UI 问题、lint/test 失败或不稳定测试时一并处理。UI 不写单元测试；其他单元测试只在确有必要时写。按改动范围做有意义的验证，细则见 [验证指南](docs/development/verification.md)。
- 本轮已授权的开发在 `preview/usable-mvp` 上进行。将来创建开发分支时从 `main` 建短期分支；合并到 `main` 须用户许可。提交遵循 Conventional Commits。用户要求 PR 时标题也遵循该格式，并按模板或 Summary、Why、What changed、Testing 写正文，关联相关 issue。
- 保护未提交的用户工作、数据和运行配置。完成后清理无用临时文件；未完成的现场保留以便接续。等待其他 session 的主动消息，不循环轮询。
- 用户消息以问号结尾时先回答问题，只有收到明确的执行指令才开始新任务。
- 涉及 GitHub issue 时使用仓库 `DingJWuyu/TeacherWorkspace`；triage 标签为 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。创建或关闭 issue 按用户具体指令。
