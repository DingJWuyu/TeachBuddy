# 文档入口

供人和 agent 按任务进入。正式产品文档分为规格、契约、验收：规格拥有用户行为，契约拥有跨调用方语义，验收拥有通过判据和交换用例。技术/运行及工程规则按需作为参考；未完成的工作和已知缺口记在 [GitHub issues](https://github.com/DingJWuyu/TeachBuddy/issues)。先读本次分区规格，再按改动边界展开；本页只维护入口，归属或路径变化时同步。范围见[产品分区](PRODUCT_SCOPE.md#产品分区)。

| 要做什么 | 先读什么 | 何时继续展开 |
| --- | --- | --- |
| 了解产品、体验或启动 | 根[README](../README.md) | 配置、隔离实例或维护操作读[SETUP](SETUP.md) |
| 选下一项工作 | [GitHub issues](https://github.com/DingJWuyu/TeachBuddy/issues) | 实施时进入对应功能页 |
| 修改 CI | [CI](acceptance/README.md#ci) | 工作流与 Rulesets 在 `.github/` |
| 判断是否属于既定目标 | [产品范围](PRODUCT_SCOPE.md) | 页面和跨模块往返读[共同交互](features/workbench.md) |
| 修改界面 | 对应功能页和[设计输入](design-system/README.md) | 调整外观时核对当前运行页面及用户指定参考 |
| 修改模块实现、存储或跨模块调用 | [子系统入口](subsystems/README.md) | 沿实际公开操作找到源码；交换语义读其文字契约，精确字段读机器 schema |
| 编写或审查代码 | [编码与验收标准](CODING_STANDARDS.md) | 开工和复盘时查根 [LESSONS](../LESSONS.md) 的适用教训；具体测试进入验证指南 |
| 验证改动或准备交付 | [验证指南](acceptance/README.md) | 本次功能选择对应场景；完整交付才展开[验收矩阵](acceptance/mvp-matrix.md) |

## 功能规格

以下八个产品分区统一用于任务归属、规格和进度汇报。题库、资源库、数学工坊、日程和班级是五个代码注册业务模块，页面开放沿单一模块目录；其余分区及共享技术底座不加入模块目录。实际装配和当前代码归属见[代码结构](subsystems/README.md#代码结构)。

| 产品分区 | 本分区负责什么 | 唯一行为入口 |
| --- | --- | --- |
| 账户与身份 | 注册、登录、找回密码、会话与账户生命周期 | [账户与身份](features/identity.md) |
| 工作台与设置 | 外壳、导航、辅助栏、页面往返、外观/语言/头像、设置、帮助与更新页 | [工作台与设置](features/workbench.md) |
| 题库 | 录入、提取校对、编辑改编、分类、原稿与检索 | [题库](features/questions.md) |
| 资源库 | 上传、文件夹、预览、检索、替换与版本 | [资源库](features/resources.md) |
| 数学工坊 | 公式、图形、动态作品、源码、网页 AI、离线演示 | [数学工坊](features/math.md) |
| 班级 | 学生资料、座位、自由记录、正式考试导入及学生/班级成绩观察 | [班级](features/classroom.md) |
| 日程 | 日期视图、安排、事项、重复、提醒与时区 | [日程](features/schedule.md) |
| AI 助理 | 首页/侧栏对话、上下文引用、业务工具与模型接入 | [AI 助理](features/agent.md) |

行为页回答老师使用时发生什么；[子系统入口](subsystems/README.md)回答代码由谁拥有、通过哪个操作调用、状态怎样变化以及怎样验证。规格不授予新增开发、模型调用或外部操作权限。

## 共享技术底座

底座提供公共机制，各分区继续拥有自己的内容、业务规则和公开操作；设置中的入口不改变底座职责。仅在任务触及以下能力时展开：

- 个人资料包、误删恢复、账户数据清理或备份还原：读[数据管理与恢复](features/data.md)；备份恢复后的旧请求从其[恢复隔离](features/data.md#从较旧部署备份恢复后的设备)进入。
- 公共保存、文稿、文件、预览、转换或页识别：按下方[契约说明](#契约说明)选边界；各分区的采用/编辑行为仍查其功能页。
- 模块装配、数据归属或公共端口：读[代码结构](subsystems/README.md#代码结构)与[模块边界决议](adr/0001-use-a-single-static-module-catalog.md)；运行命令和环境准备读[SETUP](SETUP.md)。

## 契约说明

`contracts/` 只保存给人和 agent 阅读的语义说明。按涉及的边界进入，精确字段和交换样本由各页链接到代码与测试目录。

| 涉及的边界 | 先读什么 | 验证时展开 |
| --- | --- | --- |
| 身份、会话与页面绑定 | [认证](contracts/auth.md) | [认证案例](acceptance/auth-cases.md) |
| 保存、版本、幂等、引用与账户偏好兼容 | [共享保存与基础业务契约](contracts/workbench.md) | [基础案例](acceptance/workbench-cases.md) |
| 文稿、文件、资源与输出 | [材料](contracts/materials.md) | [材料案例](acceptance/materials-cases.md) |
| 共用页识别、机器结果与人工采用 | [识别](contracts/recognition.md) | 页内样本与验证入口 |
| 数学作品与跨模块投影 | [数学](contracts/math.md) | [数学案例](acceptance/math-cases.md) |
| 日程安排、事项与提醒 | [日程契约](contracts/schedule.md) | [日程案例](acceptance/schedule-cases.md) |
| 班级、学生、正式考试、导入校对和统计 | [班级契约](contracts/classroom.md) | [班级验收](acceptance/classroom.md) |
| 对话、工具和确认执行 | [AI 助理](contracts/agent.md) | [助理场景](acceptance/agent.feature)及链接的机器样本 |
| 设备请求、资料包、账户清理与部署恢复 | [数据恢复](contracts/data.md) | [数据验收](acceptance/data.md) |

## 参考、计划与维护

代码职责和当前调用路径从[技术入口](subsystems/README.md)进入，环境与维护运行从[SETUP](SETUP.md)进入。[设计输入](design-system/README.md)与[完整应用原型](design-system/teachbuddy-app/index.html)拥有界面、状态、交互和动效参考。业务范围、交换与持久化语义继续由规格和契约拥有；原型演示与模拟结果不证明后端实现或本候选通过。固定输入留测试/源码目录，原始生成报告留证据，不成为新的正式规范类型。

### 维护入口

维护文档时使用 `writing-for-agents`，按[文档维护](CODING_STANDARDS.md#文档维护)更新权威事实。本页只维护任务导航。

术语与 ADR 按[领域约定](agents/domain.md)，问题记录按[Issue约定](agents/issue-tracker.md)与[标签表](agents/triage-labels.md)。
