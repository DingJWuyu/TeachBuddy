# 文档入口

供 agent 接手和执行任务使用。先选产品分区，读取唯一行为入口；仅在改动涉及接口、公共能力或验收时展开对应参考。范围见[产品分区](PRODUCT_SCOPE.md#产品分区)，当前授权与进度见[项目状态](plans/run-state.md)。

| 要做什么 | 先读什么 | 何时继续展开 |
| --- | --- | --- |
| 了解产品、体验或启动 | 根[README](../README.md) | 配置、隔离实例或维护操作读[SETUP](SETUP.md) |
| 查看进度、选下一项工作 | [项目状态](plans/run-state.md) | 核查某项结论才读其证据；实施时进入对应功能页 |
| 接手分区、派发或执行任务 | [开发约定](agents/module-development.md) | 先确认本次目标、工作树和权限，再读下表对应分区 |
| 创建 PR、配置 GitHub/CI 或发布 | [GitHub 协作与发布](agents/github-workflow.md) | 当前授权和未完成条件读项目状态；部署运行条件读 SETUP |
| 执行仓库维护、阶段整理或集成后的整体核查 | [仓库维护流程](agents/repository-maintenance.md) | 按检查面展开现行规则，处理实际发现并完成验证与收尾 |
| 判断是否属于既定目标 | [产品范围](PRODUCT_SCOPE.md) | 页面和跨模块往返读[共同交互](features/workbench.md) |
| 修改界面 | 对应功能页和[设计与验证规则](rules/design-and-verification.md) | 调整外观时核对当前运行页面及用户指定参考 |
| 修改存储、接口或跨模块交换 | 功能页指向的文字契约 | 精确字段继续读 `apps/api/src/contracts/` 中的 schema；验证时再读测试 fixtures |
| 验证改动或准备交付 | [验证指南](acceptance/README.md) | 本次功能选择对应场景；完整交付才展开[验收矩阵](acceptance/mvp-matrix.md) |

## 功能规格

以下八个产品分区统一用于任务归属、规格和进度汇报。题库、资源库、数学工坊、班级教学、日程同时是五个代码注册业务模块；其余分区及共享技术底座不加入模块目录。实际装配和当前代码归属见[代码结构](SETUP.md#代码结构)。

| 产品分区 | 本分区负责什么 | 唯一行为入口 |
| --- | --- | --- |
| 账户与身份 | 注册、登录、找回密码、会话与账户生命周期 | [账户与身份](features/identity.md) |
| 工作台与设置 | 外壳、导航、辅助栏、页面往返、外观/语言/头像、设置、帮助与更新页 | [工作台与设置](features/workbench.md) |
| 题库 | 录入、提取校对、编辑改编、分类、原稿与检索 | [题库](features/questions.md) |
| 资源库 | 上传、文件夹、预览、检索、替换与版本 | [资源库](features/resources.md) |
| 数学工坊 | 公式、图形、动态作品、源码、网页 AI、离线演示 | [数学工坊](features/math.md) |
| 班级教学 | 班级、实际教学记录、进度回顾与资料关联 | [班级教学](features/classes.md) |
| 日程 | 日期视图、安排、事项、重复、提醒与时区 | [日程](features/schedule.md) |
| AI 助理 | 首页/侧栏对话、上下文引用、业务工具与模型接入 | [AI 助理](features/agent.md) |

每个行为入口提供本分区的接口和验证路径。规格描述行为与边界，不授予新增开发、模型调用或外部操作权限；当前暂停和待办只查项目状态及本次用户指令。

## 共享技术底座

底座提供公共机制，各分区继续拥有自己的内容、业务规则和公开操作；设置中的入口不改变底座职责。仅在任务触及以下能力时展开：

- 个人资料包、误删恢复、账户数据清理或备份还原：读[数据管理与恢复](features/data.md)；备份恢复后的旧请求从其[恢复隔离](features/data.md#从较旧部署备份恢复后的设备)进入。
- 公共保存、文稿、文件、预览、转换或页识别：按下方[契约说明](#契约说明)选边界；各分区的采用/编辑行为仍查其功能页。
- 模块装配、数据归属或公共端口：读[代码结构](SETUP.md#代码结构)与[模块边界决议](adr/0001-use-a-single-static-module-catalog.md)；运行命令和环境准备读[SETUP](SETUP.md)。

## 契约说明

`contracts/` 只保存给人和 agent 阅读的语义说明。按涉及的边界进入，精确字段和交换样本由各页链接到代码与测试目录。

| 涉及的边界 | 先读什么 | 验证时展开 |
| --- | --- | --- |
| 身份、会话与页面绑定 | [认证](contracts/auth.md) | [认证案例](contracts/auth-cases.md) |
| 保存、版本、幂等与引用 | [共享保存与基础业务契约](contracts/workbench.md) | 页内基础交换用例 |
| 文稿、文件、资源与输出 | [材料](contracts/materials.md) | 页内验证入口 |
| 共用页识别、机器结果与人工采用 | [识别](contracts/recognition.md) | 页内样本与验证入口 |
| 数学作品与跨模块投影 | [数学](contracts/math.md) | 页内交换样本与兼容用例 |
| 班级反馈、日程、提醒与数学关联 | [班级教学与日程接缝](contracts/teaching-time.md) | [班级教学与日程案例](contracts/teaching-time-cases.md) |
| 对话、工具和确认执行 | [AI 助理](contracts/agent.md) | 页内交换样本 |

## 维护文档

维护文档时读取根 [AGENTS.md 的文档维护边界](../AGENTS.md#文档维护边界)，按其中指定的 skill 执行；本页只维护任务导航。

术语与 ADR 按[领域约定](agents/domain.md)，问题记录按[Issue约定](agents/issue-tracker.md)与[标签表](agents/triage-labels.md)。
