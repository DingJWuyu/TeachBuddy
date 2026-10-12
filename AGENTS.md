# AGENTS.md

## 项目入口

- 核对实际能力或运行状态时读 `README.md`；`prototype/` 是交互参考，`apps/` 才是真实产品实现位置，旧演示 API 不约束新契约。
- 查找文档时从 `docs/README.md` 按任务进入；总体进度、剩余事项、依赖顺序与当前授权统一读取 `docs/plans/run-state.md`。
- 汇报整体项目进度时，必须按[项目进度汇报](docs/agents/module-development.md#项目进度汇报)的固定格式执行。
- 用户体验与集成使用当前 `TeacherWorkspace-preview`；模块工作树和暂停状态以项目状态为准。
- 设计或核查范围时读取 `docs/PRODUCT_SCOPE.md` 的相关段落；页面和跨模块行为读取 `docs/features/workbench.md` 的相关段落。范围不能由旧代码或原型反推。
- 登录注册由独立 session 负责；涉及身份交接或退出时读取 `docs/contracts/auth.md`，核对其源版本与未完成项，不把讨论中的契约当成已实现能力。
- 修改模块装配、跨模块数据访问或公共职责前，必须先读[代码结构](docs/SETUP.md#代码结构)和[模块边界决议](docs/adr/0001-use-a-single-static-module-catalog.md)，确认所属模块与允许使用的公共端口。

## 模块 session 接手

负责或接手业务模块时，必须先读[模块开发约定](docs/agents/module-development.md)，按接手流程确认职责、授权、工作树与本模块规格。用户只说“你负责某模块”也使用这个入口；当前 worktree、集成基线和暂停状态以[运行台账](docs/plans/run-state.md)为准。

- 接到设计、实现或独立验收任务时，从本次任务的必读清单进入规格和 `docs/agents/module-development.md`；按角色和触发条件补读，不要求通读项目状态或其他模块。

## 开发与验证规则

- 禁止 overengineering，本项目的用户只会有一个人，禁止不断增加复杂度，完全不需要考虑高性能高并发高可用。
- 设计系统架构、契约、技术方案等技术设计时，牢记第一性原理、奥卡姆剃刀、消融实验、批判性思维、独立思考、发现未知的未知、高内聚低耦合。
- 实现代码时，牢记第一性原理、奥卡姆剃刀、消融实验、高内聚低耦合。
- 原型设计、UI/UX 开发规则：美学基线、间距与动效要求、参考来源边界、验证陷阱。参见 `docs/rules/design-and-verification.md`。
- 禁止给 UI 写单元测试，尽可能不写任何单元测试，只有必须时才写单元测试

## Git 规则

- Branch：一条 main 主干；开发时必须从 main 创建短生命周期 branch → 持续合回 main，不允许在 main 上直接开发，必须经过用户准许才合并进 main；branch 命名优先使用常见前缀，但不严格限制。正式版本通过 `Release PR` 汇总后再打 Tag / 发布。
- 阶段基线：分支起点的已授权例外及结束条件统一记录在[项目状态](docs/plans/run-state.md#工作现场与授权)；没有有效例外时执行上述 main 规则。`TeacherWorkspace-preview` 是工作树目录与体验入口，实际分支和提交须从 Git 核对。
- 集成收尾：总控交付前必须按[集成后的清理](docs/agents/module-development.md#集成后的清理)处理任务分支与临时 worktree，并核对实际剩余现场。
- Commit：遵循 Conventional Commits。
- Pull Request：如果用户让你生成 PR，Title 遵循 Conventional Commits；如有 PR Template，则务必遵循，否则默认为 Summarize-Why-What changed-Testing 四段式；如有关联 issue，则在 Body 中关联。
- 当前 GitHub 协作采用[单一开发主线与稳定发布](docs/agents/github-workflow.md)：`preview/integration` 为长期 trunk，`main` 为稳定发布分支；本条替代上文 Branch 与阶段基线中的分支起点及结束条件。接手开发、创建 PR、配置 CI 或发布时必须读该页；main 合并仍需用户批准。
- 本地提交、集成或推送前，按[任务与 PR](docs/agents/github-workflow.md#任务与-pr)执行小改本地直合或 worktree 集成 PR 路径。
- PR 正文按 `pr` skill 执行，替代上文 Pull Request 的模板与四段式兜底约定；项目不另定义正文格式或必填字段。

## 文档维护边界

### 编写与同步

- 编写文档时，禁止写 changelog/repair 式的无用历史信息，文档只保存当下，不承载历史，必须遵循 write-for-agents skill。
- 改动完毕代码后，要同步更新相关的文档，更新文档要遵循对应的规范。
- 进行重要产品或部署变更时，保持 `README.md` 与项目当前面向公众的状态一致。

### 项目约定

- 文档归属：产品范围在 `docs/PRODUCT_SCOPE.md`，模块行为在 `docs/features/`，交换语义在 `docs/contracts/`，验证条件在 `docs/acceptance/`，当前进度、缺陷和下一步在 `docs/plans/run-state.md`，运行方法在 `README.md` / `docs/SETUP.md`。完成状态附可核查的证据入口；模块输入限制属于行为约定，不自动成为开发待办。
- `docs/` 只供人和 agent 阅读，产品构建、运行和业务测试不读取其中的文件作为数据输入。机器 API 契约放在 `apps/api/src/contracts/`，交换样本放在 `apps/api/test/fixtures/contracts/`；其他运行配置和测试输入归属各自代码或测试目录。固定 Git 版本的兼容测试保留该版本自己的路径。
- 启动、环境准备和必要回归须能从全新检出重建：必需脚本与可分发固定输入入库，私有配置提供模板，外部输入提供获取方法与校验值。临时会话产物不作为这些流程的前置。
- 可移植性覆盖所有 Git 跟踪文件及其间接依赖，保证换机后可运行、开发和接手。正式文档的当前规格与操作依据须随仓库可得；被忽略目录、个人绝对路径、旧 worktree、仅本机存在的 Git 引用或 session 记录不能成为隐含前置，改目录名不改变这一边界。
- 本地产物按用途管理：依赖和构建产物允许忽略，但须由入库清单与脚本重建；私有配置、持久数据和外部工具按运行指南独立准备。测试使用自行创建的隔离目录，输出与清理见 `docs/acceptance/README.md`；skill 临时工作区及不用于读取文件的原始采集路径元数据可以保留。
- 改动依赖、路径或环境准备后，在不复制旧本机目录的独立检出中按文档安装、配置并实际验证受影响的运行与开发链路。缺输入、工具或硬件须明确记录；搜索无路径字符串或本机已有缓存下通过，不能代替可移植性验证。
- 文档不收录截图或其他图片；界面以当前运行页面和用户指定参考为准。验收截图留在任务产物中，通过证据入口按需读取。
- 完成过程、模型次数、临时端口和派工回执留任务产物，历史从固定 Git 版本读取。
- 整理文档倾向合并、删除，结合用途衡量文件数量、入口清晰和信息完整；移动、合并或删除前核对入链、锚点、程序加载、测试 fixture 和固定版本引用，更新引用并验证受影响的链路。

### 保护与完成标准

- `AGENTS.md` 可以追加内容；非用户明确指示，禁止改写或删除既有内容。
- 非用户明确指示，禁止修改或删除 setup-matt-pocock-skills 规定的 `docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md`、`docs/agents/domain.md`。
- 整理文档以“人和 agent 能否更快找到唯一、准确、足够的信息，并且运行和验证链路仍然完整”为完成标准。按 `writing-for-agents` 使用渐进式披露：入口说明何时读什么，详细规则只在权威位置维护。

## Agent skills

### 编排与协作

- 仅编排者：方案讨论先明确用户要的使用结果和硬约束，把用户提出的实现路径作为待检验假设；基于证据比较和筛选，给出明确推荐、理由和关键取舍。发现前提或路径有问题时直接指出并提出更好的方案，不以附和、产品罗列或限制清单代替判断。
- 方案讨论区分已证实、推断与待验证；证据不足时明确能改变决策的关键验证，主动推进已授权的调查，不把技术判断推回用户，也不把讨论当作实现授权。
- 仅编排者：效率优先，在依赖与权限允许时并行使用 worktree；某条工作线等用户时继续其他可推进的工作线。派发 prompt 保持最小必要，任务包、模型和具体规则见 `docs/agents/module-development.md#编排`。
- 需要选择或解释 skill 流程时读取开发约定的编排节；任务包点名 skill 时，完整读取其 `SKILL.md` 及直接引用。业务 session 之间不互聊、不扩任务；skill 明确要求的有界内部 subagent 由调用 session 管理并聚合，只是该规则的有限例外，不单列业务任务。
- 等待另一个 subagent / session 返回的消息时，禁止不断轮询，必须停下来，等待对方主动发消息。

### 开发模型路由

派发任务或恢复执行时，按 [开发约定的模型映射](docs/agents/module-development.md#模型与固定派发)选择 Codex CLI 模型与 effort，并记录到任务包和回执。开发任务停用 dsh，不设自动降级；skill 内部助手继承调用 session。产品内的 pi runtime 与产品模型白名单另行约束。

### Issue tracker

问题和规格记录在 GitHub 仓库 `DingJWuyu/TeacherWorkspace` 的 Issues 中。参见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的五个 triage 标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。

### Domain docs

使用 single-context 布局：根目录 `GLOSSARY.md` 和 `docs/adr/`。参见 `docs/agents/domain.md`。
