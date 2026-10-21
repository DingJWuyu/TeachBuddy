# 待判断发现

本页仅接收本次明确分配范围外、尚待判断或安排的发现。用户、总控或后续 session 决定是否转为正式任务；收录不授予调查、修改、测试或外部操作权限。范围内完成所必需的问题沿[开发约定](docs/agents/module-development.md#范围与发现)处理。

## 维护规则

- 发现者先查重，按同一问题或根因合并，保留具体定位、实际观察或源码依据及影响。允许有依据但未复现的线索，明确已知与未知；纯假设不收录，也不为补齐条目额外调查或测试范围外内容。
- 每条保持简短：`问题及位置 | 已知与依据 | 未知/待判断`。依据给可定位的文件、符号或证据链接；需要时注明触发条件，不写无依据的结论。
- 负责判断或安排的人在转入正式 Issue/任务时移出条目，并将依据带入目标记录；已解决或不采纳也移出。历史由 Git 和正式任务保留，本页不保存已安排任务、处理日志或完成清单。

## 当前发现

| 问题及位置 | 已知与依据 | 未知/待判断 |
| --- | --- | --- |
| 学期的数据边界与复制内容未定义 | [学期界面](apps/web/src/features/workbench/chrome/SidebarHead.jsx)只切换设备内名称与日期，不隔离真实业务数据；[复制说明](apps/web/src/features/workbench/chrome/sidebarHeadData.js)仍提及单元、课程与考勤，复制内容列表为空。 | 用户决定暂缓，之后单独讨论哪些数据随学期切换、哪些共享及复制含义。 |
| 反馈尚无实际收件渠道，选文件还会丢附件 | [反馈面板](apps/web/src/features/workbench/chrome/TopbarSurfaces.jsx)只保存设备内正文与附件元数据，确认页有收件和答复承诺，但没有真实投递。本轮双端选择真实PNG后附件数均为0；`addFiles`在状态更新函数内读取FileList，但输入随后被清空。浏览器直接粘贴图片与移除正常。 | 用户决定暂缓收件方式；原型与产品共有的文件选择问题随反馈正式接通处理，未擅改原型。 |
| 助理取消课程选择仍保留课程引用 | [LessonPicker与首页](apps/web/src/features/agent/AgentWorkspace.jsx)选课后再选“不针对某节课”，原型与产品都取消了课程显示，却留下课程引用chip。 | 是否取消选择时同时移除该课程引用，需用户查看原型后裁决。 |
| 助理正文中间选择引用后残留输入标记 | [Composer](apps/web/src/features/agent/AgentWorkspace.jsx)在光标中间输入`@题`并选择引用，原型与产品都可能留下该标记；本轮按相同键盘路径复现。 | 原型的引用插入应替换哪些字符，待确认；不替用户改写正文。 |
| 助理复制被浏览器拒绝仍显示成功 | [CopyButton](apps/web/src/features/agent/AgentWorkspace.jsx)未等待剪贴板写入，真实浏览器策略拒绝时，原型和产品仍显示“已复制”并产生未处理的Promise拒绝。 | 原型未设计复制失败反馈；需判断失败时的呈现与重试方式，本轮未新增交互。 |
| 帮助末节目录高亮未跟随点击 | [HelpCenter的Article](apps/web/src/features/workbench/help/HelpCenter.jsx)打开`/help/start/workspace`并点目录“辅助栏”，双端都滚到末尾774px但仍高亮“顶栏”；固定阅读线未到达最后标题。 | 设计输入仅要求目录跟随滚动，未明确短末节高亮规则；是否滚到底即高亮末节待用户裁决。 |
| 题库英文完成数量的单复数 | [ImportList](apps/web/src/features/questions/ImportList.jsx)在只有一份完成材料时，原型和产品均显示`Completed materials · 1 materials`。 | 是否调整原型数量文案及对应翻译，待判断。 |
| 题库连续新建分类时焦点留在背景 | [QuestionDialog](apps/web/src/features/questions/QuestionControls.jsx)创建题型后在退出动画内立即点“新建标签”，双端对话框可见但焦点仍在背景触发按钮；复用组件后只执行一次的聚焦effect未重新触发。 | 是否修正原型和产品共同的快速重开行为，待判断；本轮保留既有交互，不计复刻遗漏。 |
