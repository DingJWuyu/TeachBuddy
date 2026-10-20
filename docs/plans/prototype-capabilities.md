# 原型功能差异收口

## 目标与授权

用户要求逐项判断根 `buffer.md` 中的原型差异：只有确有设计缺口、需要用户取舍的项目才交用户查看；其余以现行原型为准增删改实际功能。本次授权包含这些差异所需的前后端、契约、文档与有效回归，覆盖此前全站 UI 迁移仅改前端的限制。

固定输入为 `2a4ce6987e2d81d99635cfe4736679fd2adaa32a` 的 `buffer.md`、`docs/design-system/teachbuddy-app/` 和设计规范。原型在本任务中作为只读输入；用户后来授权的裁决同步与全站对照归[下一任务](prototype-parity-audit.md)，在本任务完成后启动。不扩展到未列出的产品改版、实际模型费用、外部反馈投递、发布或 main。原型未实现后端不等于设计有错，旧契约也不自动优先于本次要求。

工作现场为 `TeachBuddy-prototype-capabilities` / `feat/prototype-capabilities`，从上述 trunk 创建。保护 preview 的体验数据及其他工作树。总控拥有公共文件、Git、任务记录、buffer 与集成；独立执行者按后续具名分工写入。长期执行和验证规则沿[开发约定](../agents/module-development.md)、[代码标准](../code-standards.md)和[CI 分工](../agents/github-workflow.md#ci-与本地验证)。

## 当前阶段

原型与实现的逐项核对已完成，已确认项目实现并进入整批收口。所有执行者使用 fresh context；实现与定点核对为 `gpt-6.1-sol / medium`，提案接口设计为 `gpt-6-astra / high`，集中独立审查使用 `gpt-6.1-sol / xhigh`。总控维护公共集成与范围：

| 负责人 | 核对范围 |
| --- | --- |
| `buffer_materials_triage` | 标签颜色、删除文件夹归属、搜索状态 |
| `buffer_classroom_triage` | 成绩准入、归档子项、示例原卷 |
| `buffer_agent_triage` | 助理 API、机器契约、后端回归及助理文档 |
| `agent_capability_ui` | 助理前端与浏览器回归；从后端写者处完成独占交接 |
| `buffer_preferences_exports` | 自定义背景与资料包删除的前后端、验证及所属文档 |
| 总控 | 日程端口、恢复冻结接线、公共文件与文档、用户取舍、集中审查和集成 |

原始发现为固定基线的 `buffer.md`。已授权项目的依据移入下节；当前 [buffer](../../buffer.md) 只留学期和反馈两个待决定项。

## 判断与实施

| 项目及原型依据 | 处置与唯一写者 | 当前证据/剩余 |
| --- | --- | --- |
| 自定义背景，`data/workbench.js` 的 custom/backgroundImage | `buffer_preferences_exports`，账户偏好持久化、图像校验、旧设备选择兼容；沿现有偏好协议 | HTTP 与浏览器通过，含跨设备与旧设备不覆盖服务器选择 |
| 资料包删除，原型设置列表的删除动作 | 同上，真实撤销已生成包/下载、取消生成任务，保护业务原件；使用既有可靠性目录 | HTTP 与浏览器通过，丢回执刷新后原键核实通过 |
| 资源标签颜色，原型 `ResourceLibrary.TagDialog`、`data/resources.js` taxonomy | `buffer_materials_triage`，资源专属标签 schema 保存八色，服务器已有颜色优先，旧设备颜色只补缺值 | HTTP 与浏览器通过，含新设备颜色和旧设备迁移 |
| 删除文件夹，原型 `ResourceLibrary.deleteFolder` 与 `data/resources.js` 将资料 folderId 置 null | 同上，删除整棵树后资料进入未分组，保留文件和存活树关系 | HTTP 与浏览器通过，含归档资料恢复和重开 |
| 会话管理，原型 `AgentWorkspace.ThreadMenu` 和 `data/agent.js` PATCH/DELETE | 助理前后端写者，真实标题/置顶/删除，保留生成与未决执行核实边界 | HTTP 与浏览器通过；真实会话摘要已补齐并通过刷新、新设备复核 |
| 日程/资源引用，原型 `data/agent.js` 捕获公开对象快照 | 助理写者；资源写者提供同步 readReference，根提供日程同步 readReference，使引用与发送接受处于同一事务 | HTTP 与浏览器通过，引用不再切换到本地演示 |
| 结构化安排/练习/变式，原型 `script.js` 提案及 `AgentWorkspace` 按钮 | `agent_capability_design` 只读设计；助理写者实现受约束提案工具和持久确认操作。根拥有日程 createEntry 公共端口。生成提案不写业务，点击才执行 | HTTP 与浏览器通过，原 journal、停止、核实和部署恢复冻结保持 |
| 班级成绩，原型 `Import`、`data/classroom.js` mapping/review/confirmation | `buffer_classroom_triage`，原卷可选，姓名或学号至少一个，总分可空，逐题可缺；缺总分不排名且保留原型校对提醒。考试编辑仍至少一道题，不推导额外零题界面 | 12 条 HTTP 与浏览器主流程通过 |
| 班级归档，原型 `Archive` 的账户级学生/记录列表 | 同上，查询含归档上级下的条目；用户追加确认恢复必须先恢复上级，前端说明原因、服务端保持一致 | HTTP 与浏览器逐级恢复通过 |
| 一周示例，原型 `demo/seed.js` 不附考试原卷 | 班级写者移除强加原卷上传；根清理专用生成器和无消费者 PDF，保留成绩 Excel 与题目输入 | 已删除三份补造 PDF 及生成逻辑；既有全链示例回归交 CI |

写者同步自己负责的规格、契约和技术页。根拥有公共 HTTP、日程公开端口、公共技术页、翻译汇总、plan/run-state/buffer、Git 和集成。`buffer_preferences_exports` 同为 fresh-context `gpt-6.1-sol / medium`。各线回执放 `test-results/prototype-capabilities/`，其本机证据不作运行依赖。

### 用户取舍

- 学期：用户确认暂缓，保留当前状态，后续单独讨论数据范围与复制。
- 反馈：用户确认暂缓，等待指定收件方式。
- 归档恢复：用户明确接受先恢复上级，不自动恢复整个班级，也不让已恢复子项失去查看入口。
- 资源正文搜索：用户明确选择沿用原型，不新增未识别/部分识别失败细分提示，无匹配仍显示没搜到。既有读取中和通用失败呈现保持。此项按不采纳移出 buffer，不扩大为搜索后端或自动 OCR 改造。

## 完成条件与接续

1. 全部 12 条原发现均有处置，不遗漏、不暗中扩大范围；需用户看的内容集中汇报明确入口、问题和建议。
2. 意图明确的项目贯通真实保存、重开、账户归属及对应业务结果，替换局部模拟，界面沿用原型。
3. 随行为同步规格、契约与运行参考；只调整失效断言，保留有效保证。各写者定点自验，集成阶段集中独立 Standards/Spec 审查，完整已配置回归交 CI。
4. 固定候选完成审查、PR 集成、preview 必要核对与现场清理；用户未决定项目明确保留，不写成全部功能已完成。

下一步：冻结候选并集中独立 Standards/Spec 审查；PR CI 承担已配置完整回归，随后按固定候选集成和核对 preview。各线回执及截图位于 `test-results/prototype-capabilities/`；最终构建为其中 `web-final`，此前通过的未变范围复用 `web-foundation` 证据，不重复整套本地验证。本任务完成并清理后，才启动下一轮全站原型对照。
