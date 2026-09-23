# API 与契约入口

当前产品使用同源 HTTPS 和 Cookie 认证。客户端从认证 transport 发业务请求；页面头、写保护、幂等键与错误格式从对应契约读取。不要从旧 Bearer 路由推导当前接口。

| 需要实现或核对的对象 | 行为与字段来源 |
| --- | --- |
| 登录、注册、验证码、恢复、退出 | [认证契约](contracts/auth.md)、[认证案例](contracts/auth-cases.md)、[OpenAPI](contracts/auth.openapi.yaml) |
| 公共身份、保存、冲突、未知结果 | [工作台共享契约](contracts/workbench.md) |
| 题目、备课基础操作 | [工作台 OpenAPI](contracts/workbench/first-flow.openapi.yaml)、[案例](contracts/workbench/first-flow-cases.md) |
| 文件、资源、收题、引用、导出 | [材料契约](contracts/workbench/materials.md)、[材料 OpenAPI](contracts/workbench/materials.openapi.yaml) |
| 数学作品、渲染、源码与导出 | [数学契约](contracts/workbench/math.md)及其 schema / 案例链接 |
| 班级、安排、事项、提醒 | [教学时间契约](contracts/teaching-time.md)、[作品扩展](contracts/teaching-time-math.md) |
| 材料与教学关联 | [接缝](contracts/materials-teaching-alignment.md) |
| 个人资料导出、恢复、偏好 | [数据管理入口](features/data.md)，包含不在当前树中的固定设计引用 |
| 产品 Agent | [Agent 入口](features/agent.md)，开发暂停 |

本页只导航，不复制状态码、字段和样本。`contracts/` 的 schema 是精确结构源，Markdown 解释语义，样本固定正反例；它们不是当前所有场景已经实现的证明。对运行实现的认知先读[能力与证据](plans/run-inputs.md)。

采用版本与通过范围见[能力证据](plans/run-inputs.md)。固定输入闭包中的原始版本文字只用于解释来源，执行授权以[当前状态](plans/run-state.md)为准。

修改共享接口时定位所有实际消费者及相关测试；发生不一致时记录具体冲突，保持已有数据和消费版本，不擅自换回旧协议。
