# 当前技术入口

修改模块接口、持久化、输出或跨模块调用时，从对应技术页进入，沿源码符号核对实际装配。产品行为仍归 [features](../README.md#功能规格)，交换语义归 [contracts](../README.md#契约说明)，全局装配与运行条件归 [SETUP](../SETUP.md#代码结构)。本目录描述当前实现，不登记未来接口。

| 要解决的问题 | 技术页 |
| --- | --- |
| 题目 CRUD、富文稿复制、收录校对与题面输出 | [题库](questions.md) |
| 资源整理、替换和恢复历史文件、正文查找 | [资源库](resources.md) |
| 保存作品、历史版本、图片和离线课堂输出 | [数学工坊](math.md) |
| 安排与重复实例、修改前提醒结算、通知 | [日程](schedule.md) |
| 名单、成绩导入确认、统计和后端数据维护 | [班级](classroom.md) |

身份与页面绑定读 [认证契约](../contracts/auth.md)；助理调用与 journal 读 [Agent 契约](../contracts/agent.md) 和 [助理实现](../features/agent.md#助理实现)；公共文件、文稿及 Job 读 [材料公共端口](../contracts/materials.md#公共端口)，识别读 [共用识别契约](../contracts/recognition.md)，保存与恢复分别读 [保存契约](../contracts/workbench.md) 和 [数据管理](../features/data.md)。这些能力沿已有权威页进入。

接口、状态、兼容或失败行为改变时，同步所属技术页与对应行为/交换规格；仅内部重排且语义不变时，核对源码链接即可。源码定义操作和字段，技术页解释可信调用、事务与运行路径，不复制 DTO 或完整路由表。

本目录的组织方式参考 [yetone/magpie 的 subsystem references](https://github.com/yetone/magpie/blob/91b9065a5fdf5b7aa0adeeeb17266c121bf5691c/docs/subsystems/README.md)（MIT，固定版本 `91b9065a5fdf5b7aa0adeeeb17266c121bf5691c`），内容按本仓源码独立整理。
