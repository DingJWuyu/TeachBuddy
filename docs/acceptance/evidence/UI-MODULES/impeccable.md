# 六模块工作台重组指导

本页将 Impeccable 的 Operate 界面原则对应到教师个人工作台的既定范围，用作六模块 UI 重组参考。

## 来源

- Impeccable v4.3.1 [主 skill](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md)：将任务型应用界面归为 Operate，优先考虑可扫描性、一致性和真实使用场景。
- [distill](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/reference/distill.md)：通过渐进披露、去重、减少装饰与嵌套容器降低阻力；简化不能移除必要功能。
- [layout](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/reference/layout.md)：按阅读顺序、分组、节奏、密度和不同视口行为确定结构；先用邻近关系表达分组，再使用容器。
- [animate](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/reference/animate.md)：动效用于反馈、状态说明和连续性，工作型界面保持快速，并提供减少动态效果的替代路径。
- [clarify](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/reference/clarify.md)：动作标签表达结果，术语保持一致；状态文案说明当前事实与可采取的下一步。

## Operate 设计决策

- 先让老师看清当前工作对象和下一步操作。每个工作区突出一个主要动作，次要选项按需展开；全部业务能力仍须可找到和使用。
- 用邻近、对齐和间距表达分组。只在状态或交互需要时使用独立容器，避免卡片套卡片、重复标题、无意义边框和阴影。
- 维持稳定的信息密度与清楚的阅读顺序。相关内容靠近，独立工作区之间留出明确间隔；不同间距承担分组与层级，不让所有区域同权重。
- 统一同一业务对象的名称和动作词。表单标签常驻；空态说明具体原因与下一步；错误提供可执行的恢复方式。
- 所有浮层和展开区域的进入、退出应连续且可快速反向打断，退出快于进入。动效只表达状态或空间关系，并保留 `prefers-reduced-motion` 路径。

## 对应产品方向

[产品范围](../../../PRODUCT_SCOPE.md)确定六个模块为题库、备课、数学工坊、资源库、班级教学和日程：前五个从侧栏进入，日程只从顶部进入；首页是 Agent 完整工作区，侧栏底部保留 AI 入口。[工作台设计](../../../WORKBENCH_DESIGN.md)规定 AI 与模块共用右侧辅助栏，并保留草稿、选择、筛选、展开状态和滚动位置。

因此，重组时维持五个左侧模块入口、顶部日程、Agent 首页及共用右栏的关系；以当前模块任务组织主区内容，减少冗余工具栏和说明，不另增 dashboard、重复日程入口或额外辅助列。折叠和浮层只改变呈现方式，不丢失业务功能或工作现场。

视觉整理沿用 EMStudio 已确认基线：正文 14px、菜单 30px、导航 36px、6–12px 圆角、轻阴影和中性色。用层级、间距与少量强调色提高辨识度，不以增加卡片和装饰代替信息结构。
