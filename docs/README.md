# 项目文档

了解产品读根 [README](../README.md)。接续工作读[当前状态](plans/run-state.md)，其中包含已有能力、缺口、授权与必要证据；处理具体功能从下面选一页。

## 功能规格

每页集中用户行为、实现位置与验证入口。仅在修改协议或底层实现时，继续读该页指向的契约、schema 和技术段落。

| 功能 | 内容 |
| --- | --- |
| [题库](features/questions.md) | 录题、自动整理与校对、分类、原稿、改编 |
| [备课](features/lessons.md) | 教学环节、取材、引用更新、Word/PDF 输出 |
| [资源库](features/resources.md) | 文件、分类、预览、替换 |
| [数学工坊](features/math.md) | 公式、图形、动态作品、源码、离线及渲染接缝 |
| [班级教学与日程](features/teaching-time.md) | 实际反馈、时间、重复、提醒及模块接线 |
| [设置与支持页](features/settings.md) | 偏好、退出、帮助、更新日志及尚未持久化的预览项 |
| [数据管理](features/data.md) | 个人资料包、最近删除、维护备份与恢复 |
| [账户](features/identity.md) | 登录注册、邮件、会话、身份与工作台接线 |
| [产品 Agent](features/agent.md) | 对话、业务工具、pi 与模型接入，整线暂停 |

## 共同资料

| 要查什么 | 入口 |
| --- | --- |
| 做什么、不做什么 | [产品范围](PRODUCT_SCOPE.md)、[领域词义](../CONTEXT.md) |
| 外壳、布局、保存现场与跨模块交互 | [工作台共同交互](WORKBENCH_DESIGN.md)、[设计与验证规则](rules/design-and-verification.md) |
| 代码位置、启动配置、隔离开发、转换工具与部署条件 | [运行与代码结构](SETUP.md) |
| 如何验证、完整质量门槛和样本 | [验证指南](acceptance/README.md) |
| 剩余工作如何衔接 | [当前状态](plans/run-state.md)、[DAG 剩余依赖](plans/mvp-dag.md) |

## 目录职责

| 目录 | 保存什么 | 何时展开 |
| --- | --- | --- |
| `features/` | 按功能组织的有效规格、实现接缝和验证入口 | 日常功能任务 |
| `contracts/` | 交换语义、兼容规则、正反例及精确 OpenAPI/JSON Schema | 修改接口、存储或跨模块调用 |
| `acceptance/` | 行为判据、完整矩阵、人工样本 `fixtures/` 及尚需保护的现场 | 对应功能或阶段验收 |
| `plans/` | 当前状态、剩余依赖、执行约定与恢复索引 | 接续进度、派发或恢复工作 |
| `rules/`、`agents/`、`adr/` | 项目规则、仓库约定与稳定架构决定 | 任务触及相应约束时 |
| `research/` | 尚未执行的自动提取复用方案与许可边界 | 该路线获准继续时 |

技术接缝随功能或契约保存，不另设架构文档层。机器契约位于 `contracts/`，自动测试输入按测试入口定位，当前截图在对应功能的 `assets/`；它们不是必读材料。已提交过程从 Git 查询，日常文档不维护逐轮回执。
