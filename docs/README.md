# 文档入口

先按任务选入口；进入功能页后，仅在其触发条件满足时展开契约、样本和证据。

| 要做什么 | 先读什么 | 何时继续展开 |
| --- | --- | --- |
| 了解产品、体验或启动 | 根[README](../README.md) | 配置、隔离实例或维护操作读[SETUP](SETUP.md) |
| 查看进度、选下一项工作 | [项目状态](plans/run-state.md) | 核查某项结论才读其证据；实施时进入对应功能页 |
| 接手模块、派发或执行任务 | [开发约定](agents/module-development.md) | 先确认本次目标、工作树和权限，再读下表对应模块 |
| 执行仓库维护、阶段整理或集成后的整体核查 | [仓库维护流程](agents/repository-maintenance.md) | 按检查面展开现行规则，处理实际发现并完成验证与收尾 |
| 判断是否属于既定目标 | [产品范围](PRODUCT_SCOPE.md) | 页面和跨模块往返读[共同交互](features/workbench.md) |
| 修改界面 | 对应功能页和[设计与验证规则](rules/design-and-verification.md) | 调整外观时核对当前运行页面及用户指定参考 |
| 修改存储、接口或跨模块交换 | 功能页指向的文字契约 | 精确字段继续读 `apps/api/src/contracts/` 中的 schema；验证时再读测试 fixtures |
| 验证改动或准备交付 | [验证指南](acceptance/README.md) | 本次功能选择对应场景；完整交付才展开[验收矩阵](acceptance/mvp-matrix.md) |

## 功能规格

| 任务范围 | 唯一行为入口 |
| --- | --- |
| 工作台外壳、导航、辅助栏与跨模块往返 | [工作台共同交互](features/workbench.md) |
| 题库、提取校对、分类、原稿、改编 | [题库](features/questions.md) |
| 课稿、环节、取材、引用更新、Word/PDF | [备课](features/lessons.md) |
| 上传、文件夹、预览、检索、替换 | [资源库](features/resources.md) |
| 公式、图形、动态作品、源码、离线演示 | [数学工坊](features/math.md) |
| 班级反馈、日程、重复、提醒 | [教学与时间](features/teaching-time.md) |
| 偏好、退出、帮助、更新日志 | [设置与帮助](features/settings.md) |
| 个人资料包、模块恢复、实例备份还原、外部 AI | [数据管理](features/data.md) |
| 登录、注册、邮件、身份交接 | [账户](features/identity.md) |
| 产品内对话、业务工具、模型接入 | [产品助理](features/agent.md) |

模块规格描述行为与实现边界，不授予新增开发、模型调用或外部操作权限。当前暂停和待办只查项目状态及本次用户指令。

## 契约说明

`contracts/` 只保存给人和 agent 阅读的语义说明。按涉及的边界进入，精确字段和交换样本由各页链接到代码与测试目录。

| 涉及的边界 | 先读什么 | 验证时展开 |
| --- | --- | --- |
| 身份、会话与页面绑定 | [认证](contracts/auth.md) | [认证案例](contracts/auth-cases.md) |
| 保存、版本、幂等与引用 | [工作台共享契约](contracts/workbench.md) | 页内基础交换用例 |
| 文稿、文件、资源与输出 | [材料](contracts/materials.md) | 页内验证入口 |
| 共用页识别、机器结果与人工采用 | [识别](contracts/recognition.md) | 页内样本与验证入口 |
| 数学作品与跨模块投影 | [数学](contracts/math.md) | 页内交换样本与兼容用例 |
| 班级反馈、日程、提醒与数学关联 | [教学与时间](contracts/teaching-time.md) | [教学与时间案例](contracts/teaching-time-cases.md) |
| 对话、工具和确认执行 | [产品助理](contracts/agent.md) | 页内交换样本 |

## 维护文档

维护文档时读取根 [AGENTS.md 的文档维护边界](../AGENTS.md#文档维护边界)，按其中指定的 skill 执行；本页只维护任务导航。

术语与 ADR 按[领域约定](agents/domain.md)，问题记录按[Issue约定](agents/issue-tracker.md)与[标签表](agents/triage-labels.md)。
