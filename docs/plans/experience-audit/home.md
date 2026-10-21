# 首页与助理体验清查

作者：home，gpt-6.1-sol / medium。固定基线 `a5daad25a712a4d2f75f34da71bc97e645f1a8a0`。写边界为 Agent 前端、首页及其专属回归和文档；共享发现交总控。操作证据见 `test-results/experience-audit/home/receipt.md`。

## 输入与批准差异

原型唯一输入：`docs/design-system/teachbuddy-app/ui/tbx/src/agent/AgentWorkspace.jsx`、`Prose.jsx`、`script.js` 与 `styles/agent.css`。对应产品为 `apps/web/src/features/agent/`；Home.jsx 仅转出 Home。原型的本地模拟回复、假余额和套餐不恢复；新会话、草稿、引用、模型、工具与提案走真实 API，受控 SDK 提供模型内容，不访问付费网络。旧示例会话只读保留。真实失败、确认结果、草稿冲突与不可用状态按 agent 规格保留。

## 行为分母

下表按原型组件、事件和条件枚举，非截图抽样。总览行只导航到下方逐条件结果，不代表行内每个条件均已通过。尺寸按相关分支使用桌面 1440×900、Pad 820×1180、窄屏 390×844；布局、浮层与长内容再关联中英和深浅色。

| 编号 | 原型及产品对应 | 触发及连续操作 | 状态 |
| --- | --- | --- | --- |
| H01 | Hero/greeting/Suggestions | 空账户首页问候、四建议、点击后草稿与焦点；新对话按钮及 Ctrl/Meta+N | 见下方逐条件结果 |
| H02 | Hero/LessonPicker/lessonSuggestions | 有后续课程，选课、改课、取消、按函数主题切建议、首条引用；外点和 Escape 后接着输入 | 见下方逐条件结果 |
| H03 | DemoSeed | 明确载入示例、忙状态、成功跳题库/日程、失败再试；真实持久保存属批准差异 | 见下方逐条件结果 |
| H04 | ThreadList/groups/search | 无会话、日期组、摘要、标题或摘要搜索、无结果、清搜索，选择历史，键盘 Enter | 见下方逐条件结果 |
| H05 | ThreadMenu/rename | 置顶/取消、重命名 Enter/失焦/空白/Escape/80字限制、删除二次确认取消及提交、当前会话删除后的选择 | 见下方逐条件结果 |
| H06 | Home/threadsOpen | 窄屏列表打开、选择收起、外点、Escape 回焦、菜单/改名先处理 Escape；恢复尺寸后可操作 | 见下方逐条件结果 |
| H07 | PanelHead/PanelWelcome | 空辅助栏通用/题目/资源上下文建议；会话切换、近期八条、全部首页、新对话、首页展开、关再开草稿保持 | 见下方逐条件结果 |
| H08 | Composer/ModelPicker | 空白禁发、输入自增高、Shift+Enter、中文组合输入、普通 Enter 发送；模型切换及外点/Escape；不可用模型禁用 | 见下方逐条件结果 |
| H09 | Composer/MentionMenu/RefChip | @ 检索题目/课程/资料，空及无结果、上下键循环、Enter/Tab/点击选择、Escape、外点；chip 打开/移除/重复、光标中间引用 | 见下方逐条件结果 |
| H10 | draft/save/conflict | 草稿保存、刷新、首页辅助栏往返；两浏览器冲突两种明确选择、断网本机保留及恢复 | 见下方逐条件结果 |
| H11 | UserMessage/AssistantMessage/Prose | 用户换行与引用；回答段落、标题、列表、表格、代码、行内/独立公式、坏公式、链接、长行；复制成功/失败及重新回答 | 见下方逐条件结果 |
| H12 | WorkLog/WorkRow/ToolCard | 查找中、完成折叠、展开收起；真实只读空/成功/失败和写入成功/待确认/失败；刷新保留、打开真实对象 | 见下方逐条件结果 |
| H13 | ResultCard/ProposalCards | 讲解安排加日程、练习展开和顺序保存、变式保存、进行中/已保存/失败/部分/待确认与重新载入；已保存打开入口 | 见下方逐条件结果 |
| H14 | AgentWorkspace/running | 生成前思考/整理、生成正文、停止、切对话时另会话运行提示、切页/关辅助栏继续、刷新、失败/中断后的明确继续 | 见下方逐条件结果 |
| H15 | thread scrolling/dock | 底部跟随、旧文阅读不跳、新消息按钮、切会话及首页辅助栏滚动恢复；多行草稿和错误条改变输入高度 | 见下方逐条件结果 |
| H16 | agent.css responsive/theme | 空/有消息/长内容桌面Pad窄屏、中英深浅色；浮层边界、输入与新建不遮挡、聚焦/悬停/动效 | 见下方逐条件结果 |
| H17 | result/reference navigation | 历史快照与当前对象变化/删除、题目加入对话、带未保存业务现场往返、引用冲突不丢草稿 | 见下方逐条件结果 |
| H18 | real-only notices/usage | 发送待确认、draft/snapshot/SSE失败恢复、用量完整/不完整及费用未知、额度拒绝/模型不可用/上下文超限 | 见下方逐条件结果 |

## 独立问题

### EA-home-01：首条完整长回答未跟随末尾

基线原有的真实模型接入偏差。空会话首次发送，受控 SDK 一次返回完整长回答；未主动滚动，消息区仍停在 scrollTop=0，后文被输入区挡住。原型 `AgentWorkspace` 的逐批增长会继续跟随，产品首次挂载消息区时跳过恢复，随后 composer 测量改变底部 padding 又留下滚动差。

修复在消息区首次出现时以 layout effect 恢复位置，并用 ResizeObserver 的 border-box 观察包含输入区留白的内容高度。仅已在底部时跟随；旧文阅读保持原位。现有 Agent E2E 新增一条真实用户路径，基线先红，候选已绿，同时覆盖新消息按钮与旧位置保持。

证据：`home/red/` 的具名失败、`scroll-green2.log`、`scroll-probe.log`、`candidate-answer.png`。本线计 1 个独立原有问题，暂无本轮引入的未解决产品问题。作者改动已冻结，等待总控集中审查。

### 不计为复刻漏项

- 剪贴板被真实 Permissions-Policy 拒绝时，原型与产品都仍显示“已复制”并产生未处理的 writeText Promise 拒绝；后续输入仍可继续。双端实际依据 `copy-denied-prototype.json`、`long-running.json`。遵从总控规则保留，不计复刻漏项，交总控集中判断。
- 原型 Home 没有窄屏列表 Escape/外点关闭处理，Pad 打开后 Escape 不关闭；当前产品基线按既有 agent 规格正确关闭并回焦。保留已批准行为，不回退。原型末段窄屏脚本因列表仍开导致第二次按钮被挡的错误属这一既存差异。

- 原型与产品均在取消选课后保留已加入的引用，见 `prototype-cancel-lesson.png`、`prototype.json`、`explore-seed.mjs`。按总控指示保留，交总控集中判断。
- 原型与产品均在光标中段选择引用后保留 @ 标记。双端实际值为“请讲解 @ 后面的条件也要保留”，见 `prototype.json` 的 middle-reference-value 和 `red/` 对应失败。此探索断言已从产品回归移除，保留为判断证据。
- 直接 PUT 语言偏好后过早截图未代表外壳已读回；从设置 UI 切换并等待后双端完整翻译一致，见 `theme-ui.json`，总控亦独立排除。不是产品缺陷。

## 逐条件结果

证据路径均相对 `test-results/experience-audit/home/`；脚本实际驱动独立浏览器、真实认证和 HTTP，控制模型使用 SDK provider。下表“通过”只覆盖写出的动作，原型脚本、已批准的真实能力差异和未验另列。

| 条件 | 结果 | 实际操作与证据 |
| --- | --- | --- |
| H01 空首页问候、四建议 | 通过 | 原型与产品空账户进入首页，`prototype-empty.png`、`baseline-empty.png`、`explore.json` |
| H01 建会话后建议填入并聚焦 | 通过 | 点击第一建议后核对文本和 activeElement，`explore.json` suggestion |
| H01 显式新建、Ctrl+N | 通过 | 首页列表按钮、快捷键与辅助栏新建，`interaction.json`、`cards-panel.json` |
| H02 有课列表、日期时间、第一准备事项 | 通过 | 载入真实示例后打开六条课程，`explore-seed.mjs`、`prototype-lessons.png` |
| H02 选二次函数课后建议分支、换普通课 | 通过 | 先选第一课再选第二课，核对演示/讨论建议变化，`interaction.json` |
| H02 选课加入首次草稿引用 | 通过 | 原型/产品选择课程再激活输入，核对 chip 与时间，`prototype-cancel-lesson.png`、`explore.json` |
| H02 课程菜单 Escape 与外点后继续 | 通过 | 关闭后继续选课并输入，`interaction.json` |
| H02 取消课程已存在引用 | 保留原型行为 | 双端同样保留引用，见上方不计漏项 |
| H03 示例载入忙态、成功与真实恢复 | 批准差异且通过 | 产品真实保存各模块数据，刷新可读；回执丢失接续和去重在 `remaining.log` 全站示例载入；原型 `prototype.json` |
| H04 空历史、默认标题、回答摘要 | 通过 | 空账户、发送后查看摘要、刷新，`explore.json`、`remaining.log` |
| H04 搜索标题/摘要、无结果、清空 | 通过 | 连续输入不存在内容再清空，及提案持久摘要，`explore.json`、`verification.log` |
| H04 今天/昨天/最近7天/更早组 | 通过 | 真实会话持久历史设置日期形态后重读，四组均可见，`context-history.json` |
| H04 键盘 Enter 选择历史 | 通过 | 聚焦末行后按 Enter 核对 active，`context-history.json` |
| H05 置顶、服务端明确选择覆盖旧metadata | 通过 | 菜单置顶与另一设备读回；旧metadata兼容，`remaining.log` WB-AG-024及旧设备场景 |
| H05 Enter、失焦、空白、Escape、80字改名 | 通过 | 逐一输入取消/空白/90字/有效标题并继续操作，`interaction.json` |
| H05 删除当前最后会话、另一设备刷新 | 通过 | 确认删除后自动新建，新标题跨设备读回，`remaining.log` WB-AG-024 |
| H05 长历史底部菜单、二次确认、焦点和Tab | 通过 | 13条历史，三尺寸菜单边界，键盘Tab/Shift+Tab及确认，`verification.log` 历史底部菜单 |
| H06 窄屏开列表、Escape回焦、尺寸恢复 | 通过 | Pad/390宽打开、Escape后 activeElement 为列表按钮，`explore.json` |
| H06 嵌套菜单/改名 Escape 优先 | 通过 | 第一Escape只退菜单/改名，第二才退列表，`context-history.json` |
| H06 列表外点与选择后收起 | 通过 | 点击右侧未被列表覆盖区域、重新打开并选行，`context-history.json` |
| H07 通用辅助栏欢迎、新建、展开首页 | 通过 | 新建空会话点建议并展开首页，`cards-panel.json` |
| H07 题目上下文欢迎及引用 | 通过 | 打开真实题目，欢迎显示题名，点击“这道题怎么讲”带入引用，`context-history.json`、`context-question.png` |
| H07 资源上下文欢迎及通用建议 | 通过 | 打开真实资料并点击建议，`context-history.json`、`context-resource.png` |
| H07 日程上下文三建议 | 通过 | 日程打开空会话并点建议，`context-history.json`、`context-calendar.png` |
| H07 八条近期历史、全部首页、选会话 | 通过 | 创建超过8条真实会话，选择与全部入口，`cards-panel.json`、`context-history.json` |
| H07 关闭再打开保持草稿 | 通过 | 关闭辅助栏再打开核对“跨页草稿”，`cards-panel.json` |
| H07 数学辅助栏 | 批准差异 | 当前 MathWebAssistant 独立网页AI归 math 线，不恢复原型通用Agent |
| H08 空/空白禁发、Shift+Enter、IME | 通过 | 空文禁发，换行后组合输入 Enter 不发，`interaction.json` |
| H08 模型选择、外点、Escape与下一次意图 | 通过 | 切GLM、关闭、继续输入；发送期间新模型不改旧意图，`interaction.json`、`verification.log` |
| H08 不可用模型和禁发提示 | 通过 | 无模型配置时两模型禁用，输入保留且“AI暂不可用”，`context-history.json` |
| H08 多行输入、宽度变化自增高 | 通过 | 真实长草稿390宽再恢复1440，`verification.log` 日程引用专项 |
| H09 引用空态、无结果、三类来源 | 通过 | 无业务对象时空态；示例后查题/资料/课程并输入不存在查询，`interaction.json`、`verification.log` |
| H09 上下键循环、Tab/点击选择、Escape后输入 | 通过 | 在引用菜单按上下键和Tab，后续重复点击与关闭继续，`interaction.json` |
| H09 chip 去重、移除、保存后时间恢复 | 通过 | 重复选同一对象不增chip，移除，引用课后刷新，`interaction.json`、`verification.log` |
| H09 中段 @ 标记 | 保留原型行为 | 双端相同，见上方不计漏项 |
| H10 草稿保存、跨首页辅助栏、刷新 | 通过 | `remaining.log` WB-AG-001/004及 `explore.json` |
| H10 双浏览器冲突选择本机 | 通过 | 断网输入、另一设备保存、明确保留本机，`verification.log` WB-AG-005 |
| H10 断网恢复已保存草稿 | 通过 | 断线后另一设备保存，联网重读新值，`remaining.log` 恢复回归 |
| H11 段落/标题/列表/引用块/链接/复制/重新回答 | 通过 | 连续真实回答后复制成功与重新回答，`interaction.json` |
| H11 行内/独立/错误公式和不可信链接 | 通过 | SDK回答后刷新仍排版且无javascript链接，`rendering.log`、`rendering/` |
| H11 表格、代码及中文长回答 | 通过 | 同一受控回答包含表格与代码，实际截图和DOM计数，`explore.json`、`baseline-answer.png` |
| H12 工作记录折叠、展开、再次收起 | 通过 | 双端实际工作记录操作，`cards-panel.json`、`prototype-work-open.png` |
| H12 真实只读成功和详情 | 通过 | SDK调用 wb_list_questions，显示真实5题并展开参数，`cards-panel.json` |
| H12 无assistant的失败卡刷新 | 通过 | 真实SDK读取不存在题目，单独卡片及刷新保留，`remaining.log` WB-AG-020 |
| H12 写入待确认、原键核实与打开题目 | 通过 | 原操作写入结果未知后确认副本，`verification.log` WB-AG-012/023 |
| H13 plan真实保存日程、刷新 | 通过 | 点击加到日程，等待Operation确认后刷新，`cards-panel.json`、`product-saved-plan.png` |
| H13 practice展开/收起与逐槽保存、刷新 | 通过 | 4题卡展开其余1道、收起、全部保存；部分/丢回执接续另见专项，`cards-panel.json`、`verification.log` |
| H13 variant真实新建题、刷新 | 通过 | 单道变式点击存题并刷新，`cards-panel.json`、`product-saved-variant.png` |
| H13 旧卡已保存、未发起只读、损坏记录、原键核实 | 批准差异且通过 | 保留历史不恢复模拟新请求，`remaining.log` 旧卡恢复 |
| H13 questions/lessons/link旧卡可读与跳转 | 批准差异且通过 | 真实账号保留兼容旧历史，打开题目/日程/数学，`legacy-shapes.json` |
| H14 思考、另一会话运行、切回 | 通过 | 受控provider挂起时新建再切回，`running.json` |
| H14 切页关闭辅助栏仍生成 | 通过 | 关闭时释放受控provider，再开见完整答复，模型仅1次，`running.json` |
| H14 停止、刷新不再请求模型 | 通过 | 真实运行Abort后停止，`verification.log` WB-AG-013/017 |
| H14 provider失败、刷新保留且不重发 | 通过 | SDK受控错误后刷新，requests仍2，`running.json` |
| H15 首条长回答跟随、dock测量增长 | 已修复并通过 | EA-home-01；`scroll-green2.log`、`scroll-probe.log` |
| H15 旧文阅读、新消息提示、点击回底 | 通过 | 新回归中将阅读位置置120后再发送，保持120，点击新消息才回底，`scroll-green2.log` |
| H16 空首页中英深浅与三尺寸 | 通过 | 两端通过设置UI切换，共24张同条件截图，`theme-ui.json`及 `*-ui-*.png` |
| H16 有消息中英深浅与三尺寸、模型菜单边界 | 通过 | 产品12组合并逐个开/关菜单，`interaction.json`及 `en/zh-CN-*.png` |
| H16 引用浮层与历史菜单边界 | 通过 | 三尺寸实际命中底部选项并继续操作，`verification.log` 两专项 |
| H17 当前题目引用、未保存业务草稿不覆盖 | 通过 | SDK更新当前题目仍保留人工输入并处理冲突，`remaining.log` WB-AG-002/009 |
| H17 双标签上下文各属本页 | 通过 | 同账户两标签题库各自阅读，`remaining.log` 同账户双标签页 |
| H18 snapshot/SSE缺号、发送确认与下一条输入 | 通过 | 真实HTTP故障后恢复，无重复模型请求/消息，`remaining.log` 两恢复及WB-AG-010 |
| H18 固定发送意图与新输入/新模型 | 通过 | 保存延迟时继续输入和换模型，旧请求固定，`verification.log` 发送意图 |
| H18 已报告用量和实际费用未知 | 通过 | 展开真实完成turn显示15 tokens、费用未知，`running.json` |

## 补验结果

| 条件 | 结果 | 实际操作与证据 |
| --- | --- | --- |
| H01 五个问候小时分支 | 通过 | 两端固定 Date 但不冻结 RAF，2/7/12/15/20时均核对，`gaps.json`、`greetings-prototype.json` |
| H05 取消置顶与删除二次确认取消 | 通过 | 菜单取消置顶后恢复今天组，确认删除时Escape不删会话，`gaps.json` |
| H10 冲突采用服务器内容 | 通过 | 本机请求断网、服务器另一版持久化，再明确采用服务器，`gaps.json` |
| H17 引用版本冲突保留输入 | 通过 | 选旧引用、真实PUT更新题目后发送，引用冲突且模型请求数未增，`gaps.json` |
| H17 历史引用源更新、归档和永久删除 | 通过 | 打开时读最新题，归档显示恢复入口，永久删除显示未找到；返回聊天仍保留旧标题，`gaps.json` |
| H18 额度拒绝/上下文超限 | 通过 | 受控SDK真实错误映射后显示对应恢复提示，`gaps.json` |
| H18 用量未完整报告 | 通过 | provider受控挂起时展开持久turn用量，明确未知tokens/用量不完整/费用未知，`long-running.json` |
| H14 超过60秒运行计时 | 通过 | Date前推65秒而RAF正常，显示1分5秒，`long-running.json` |
| H11 无空格长文、超宽表格和代码 | 通过 | 1440/820/390宽无文档横溢出，表格内部宽12252px独立滚动，`long-running.json`及 `long-unbroken-*.png` |
| H11 复制被浏览器策略拒绝 | 保留原型行为 | 双端clipboardAllowed=false仍显示已复制，后续可继续输入，见上方不计漏项 |
| H12 prepared/executing/cancelled/interrupted/failed各呈现 | 通过，呈现层范围 | 以真实SDK先形成journal，再为隔离库设置对应持久历史状态，经真实HTTP重读并展开参数；仅证明状态呈现，不冒充每种后端成因被触发，`journal-states.json` |
| H14 重启恢复未完成journal | 通过 | 隔离库保存running/streaming/executing形态后关闭实例，以同库真正重新初始化；显示上次生成已中断且模型请求仍2，`journal-states.json` |
| H13 原型六类结果卡及工作记录 | 通过 | plan/variant/practice展开收起保存、questions、lessons、link实际生成并可见，`prototype.json`；产品真实提案及兼容历史对应结果见上表 |

## 验证范围与收口

本线所有原型组件入口、事件和有意义的布局条件均已实际展开。19条既有受控Agent E2E、新增1条滚动回归及公式呈现专项通过；真实外部模型的两条live专项按本轮禁止付费授权未运行，不记通过。所有相关尺寸使用独立桌面浏览器context模拟，未宣称真实触控设备验收。动效按实际操作及源码样式对照，未进行每个动画逐帧时长测量。

原型自身的取消选课、中段@、复制拒绝提示交总控裁决；共享语言疑点经双端设置UI排除。数学网页AI归math线。除以上明确保留边界，本线无待修范围内偏差。作者冻结改动，正式集成、集中审查、全量CI和最终现场清理由总控完成；本线不提交Git。
