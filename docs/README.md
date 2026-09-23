# 文档索引

了解产品读根 [README](../README.md)。接续工作读[当前状态](plans/run-state.md)。日常修改从下表选一个功能，按任务需要继续展开，不要求通读目录。

## 功能规格

功能页拥有用户行为、实现入口和局部验证方法。改变交换语义、存储或跨模块调用时才读它指向的契约；核对字段时再进入 OpenAPI 和样本。

| 修改什么 | 入口 |
| --- | --- |
| 录题、提取校对、分类、原稿、改编 | [题库](features/questions.md) |
| 文稿、环节、取材、引用更新、Word/PDF | [备课](features/lessons.md) |
| 上传、文件夹、预览、替换 | [资源库](features/resources.md) |
| 公式、图形、动态作品、源码、离线演示 | [数学工坊](features/math.md) |
| 班级反馈、日程、重复、提醒 | [教学与时间](features/teaching-time.md) |
| 偏好、退出、帮助、更新日志 | [设置与帮助](features/settings.md) |
| 个人资料包、最近删除、备份还原 | [数据管理](features/data.md) |
| 登录、注册、邮件、身份交接 | [账户](features/identity.md) |
| 对话、业务工具、模型接入 | [产品 Agent](features/agent.md) |

## 按需展开

| 当前问题 | 权威入口 |
| --- | --- |
| 是否属于产品范围，术语指什么 | [产品范围](PRODUCT_SCOPE.md)、[领域词义](../CONTEXT.md) |
| 页面外壳、辅助栏、跨模块往返如何工作 | [共同交互](WORKBENCH_DESIGN.md) |
| UI 尺寸、动效、参考及浏览器验证如何处理 | [界面规则](rules/design-and-verification.md) |
| 如何运行、隔离测试、配置转换工具或部署 | [运行指南](SETUP.md) |
| 验证哪些行为、使用哪些样本 | [验证入口](acceptance/README.md)；完整交付才展开[矩阵](acceptance/mvp-matrix.md) |
| 当前还有什么缺口、可以执行什么 | [当前状态](plans/run-state.md)；全局依赖见[DAG](plans/mvp-dag.md) |
| 如何派发、选择模型和接收回执 | [执行约定](plans/execution-protocol.md) |
| 如何操作 Issue 或调整稳定架构 | [Issue 约定](agents/issue-tracker.md)、[ADR](adr/) |

`contracts/` 保存协议语义、精确 schema、样本和必要的固定输入；部分文件由后端直接读取。`acceptance/` 保存行为判据，测试输入位于对应测试的 `fixtures/`，运行输出位于忽略的 `test-results/`。截图只在对应页面的视觉参考中按需查看。自动提取方案仅在继续该路线时由[题库](features/questions.md)进入。
