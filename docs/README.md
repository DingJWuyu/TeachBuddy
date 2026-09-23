# 项目文档

| 资料 | 用途 |
| --- | --- |
| [产品范围](PRODUCT_SCOPE.md) | 用户、六模块目标和非目标 |
| [当前状态](plans/run-state.md) / [剩余依赖](plans/mvp-dag.md) | 接任进度、当前授权、未完成条件和下一步 |
| [工作台共同交互](WORKBENCH_DESIGN.md) | 布局、现场和跨模块操作；页面差异在下表 |
| [架构](ARCHITECTURE.md) / [API](API.md) | 代码责任、公共协议和精确 schema |
| [运行指南](SETUP.md) | 安装、隔离环境、转换工具与已有实例 |
| [验证标准](acceptance/README.md) / [能力证据](plans/run-inputs.md) | 如何判定结果，以及当前结论的证据边界 |

## 功能规格

每页包含实际用户行为、未完成能力、相关接口与验证入口；只展开任务涉及的接缝。

| 任务涉及 | 资料 |
| --- | --- |
| 录题、修改保存、分类、原稿、改编 | [题库](features/questions.md) |
| 教学环节、取材、引用更新、成果输出 | [备课](features/lessons.md) |
| 文件、分类、预览、替换 | [资源库](features/resources.md) |
| 公式、图形、动态作品、源码、离线 | [数学工坊](features/math.md) |
| 班级实际反馈、时间、重复、提醒 | [班级教学与日程](features/teaching-time.md) |
| 头像、偏好预览、退出、帮助、更新日志 | [设置与支持页](features/settings.md) |
| 个人资料包、最近删除、维护备份、恢复隔离 | [数据管理](features/data.md) |
| 登录注册、邮件、会话、身份交接 | [账户](features/identity.md) |
| 产品对话与真实工具操作 | [产品 Agent](features/agent.md)，暂停 |

`contracts/` 的 Markdown 拥有交换语义，OpenAPI/JSON Schema 拥有字段，cases/samples 拥有正反例；`arch/` 仅保留相关技术接缝，`acceptance/*.feature` 保存行为判据。运行和测试实际读取的 schema、固定输入副本与样本必须保持可用。

[执行约定](plans/execution-protocol.md)仅保存项目特有的模型、写入和回执规则；不另设角色教程。领域词义见根 [CONTEXT](../CONTEXT.md)，稳定模块决策见 [ADR](adr/0001-use-a-single-static-module-catalog.md)。已提交过程通过 Git 查找，日常文档不维护逐轮回执。
