# AGENTS.md

## 项目入口

- 接手、实施或交付任务时读[开发约定](docs/agents/module-development.md)；全局工作现场与授权查[运行台账](docs/plans/run-state.md)，长程任务沿其指向的当前记录接续。本次用户指令及已生效授权优先，阅读参考不扩大写入或外部操作权限。
- 核对实际能力与运行入口时读 [README](README.md)；配置、隔离与部署读 [SETUP](docs/SETUP.md)。`apps/` 是产品实现，`docs/design-system/` 是只读设计输入。
- 查范围、行为、契约或验收时从[文档入口](docs/README.md)按任务展开；产品范围不能由旧代码或原型反推。身份交接或退出读取[认证契约](docs/contracts/auth.md)。
- 修改或审查子系统时先读[运行参考](docs/subsystems/README.md)，追到实际源码与调用路径。涉及模块装配、跨模块访问或公共职责时另读[模块边界决议](docs/adr/0001-use-a-single-static-module-catalog.md)。
- 汇报整体项目进度时使用[项目进度汇报](docs/agents/module-development.md#项目进度汇报)格式，事实来自运行台账。

## 模块 session 接手

负责某分区但未收到具体实施目标时，先按[接手流程](docs/agents/module-development.md#接手与完成)确认职责和现场；执行任务只读其相关规格、契约与运行参考。

长程任务接续按[当前任务记录](docs/agents/module-development.md#当前任务记录)，范围外发现按[范围与发现](docs/agents/module-development.md#范围与发现)处理。

## 开发与验证规则

修改代码前读 [LESSONS](LESSONS.md)；实现与审查依据[代码标准](docs/code-standards.md)。界面改动同时读[设计输入](docs/design-system/README.md)；选择本地、CI 和目标环境验证前读[验证入口](docs/acceptance/README.md)与[CI 分工](docs/agents/github-workflow.md#ci-与本地验证)。

## Git 规则

开发、提交、推送、创建 PR 或发布前读[GitHub 协作与发布](docs/agents/github-workflow.md)。日常开发进入 `preview/integration`，`main` 为稳定发布分支；正式发布需要用户授权。完成集成后按[清理流程](docs/agents/module-development.md#集成后的清理)收尾。

## 文档维护边界

编写或整理文档使用 `writing-for-agents`，按[文档维护](docs/code-standards.md#文档维护)更新唯一权威位置；新增行为、状态和运行事实以源码及实际证据为准。

### 编写与同步

代码与文档在同批交付；按[文档维护](docs/code-standards.md#文档维护)判断本次需要同步的权威事实。

### 项目约定

输入、源码、配置与证据的归属及可重建要求见[代码标准](docs/code-standards.md#输入与可重建性)；具体准备步骤查 SETUP，测试产物查验收入口。

### 保护与完成标准

- `AGENTS.md` 可追加；改写或删除既有内容需要用户明确指示。生成文件及 CHANGELOG 交生成工具维护。
- 非用户明确指示，保留 setup-matt-pocock-skills 的 [Issue 规则](docs/agents/issue-tracker.md)、[标签规则](docs/agents/triage-labels.md)与[领域规则](docs/agents/domain.md)。
- 文档完成以“能按任务找到唯一、准确、足够的信息，运行与验证链路仍完整”为判据；移动、合并或删除前核对入链、锚点、程序消费者与固定版本引用。

## Agent skills

### 编排与协作

总控派发、接收任务或选择 skill 流程时读[编排](docs/agents/module-development.md#编排)；业务 session 沿任务边界执行。使用立即生成大量 subagent 的 harness 前，说明取舍并获得用户明确批准。等待回执使用等待机制，不反复轮询。

### 开发模型路由

派发或恢复任务按[模型映射](docs/agents/module-development.md#模型与固定派发)选择 model/effort，并记录到任务包与回执；产品模型配置另查功能规格。

### Issue tracker

问题和规格使用 GitHub `DingJWuyu/TeachBuddy`，按 [Issue 规则](docs/agents/issue-tracker.md)执行。

### Triage labels

分流问题按[标签规则](docs/agents/triage-labels.md)执行。

### Domain docs

术语和决议按[领域规则](docs/agents/domain.md)维护根 GLOSSARY 与 docs/adr。
