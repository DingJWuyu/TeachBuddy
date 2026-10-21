# 首页与 AI 助理独立清查

本清单从 `ddc2f3d1c4e8299cbd36b821bac817e222d4e705` 的当前产品源码和同提交原型独立展开，先独立完成 32 行枚举，再读取上轮 home 回执及具名脚本查漏；没有复用上轮 PASS。执行者 `sweep_agent`，模型 `gpt-6.1-sol / xhigh`。证据目录 `test-results/experience-completion/sweep/agent/`；产品使用只读 `sweep-baseline-web`，原型 `http://127.0.0.1:4174`。真实注册/fake-mail、隔离 SQLite/文件/浏览器、现有受控 SDK provider；无真实收费模型。

源码简记：W=`apps/web/src/features/agent/AgentWorkspace.jsx`，P=`AgentProvider.jsx`，V=`AgentPresentation.jsx`，T=`ToolCard.jsx`，R=`Prose.jsx`；原型对应 `docs/design-system/teachbuddy-app/ui/tbx/src/agent/AgentWorkspace.jsx` 及其 `script.js`。以下序列每行包含完成后的继续操作，不以静态阅读充当通过。

| ID | 触发与前置 | 具体操作序列和预期 | 源码 | 证据与状态 |
| --- | --- | --- | --- | --- |
| A01 | 新账户空首页 | 查看欢迎、空历史、占位输入；点占位创建；输入；保存；刷新恢复 | W Home/Hero/Composer，P create/save | 通过：audit 01；controlled WB-AG-001/004，真实保存后刷新。 |
| A02 | 空首页无课程 | 点击四条建议分别检查准确文字；保留草稿；新建；键盘 Ctrl+N | W Suggestions/prompt/Home | 通过：audit 02，四建议逐条文字及 Ctrl+N。 |
| A03 | 空账户示例入口 | 点击载入；等待完成；题库/日程入口；刷新；防重复；失败后重试 | W DemoSeed | 通过：audit 03；controlled 全站示例回执丢失→刷新接续，无重复且真实成绩。 |
| A04 | 有未来课程及独立日程引用 | 选课、换课、不针对某节课；独立引用保留；新建后选择；课程建议 | W LessonPicker/useLessons/lessonReference | 通过：audit 04；controlled AC02；consumer-final 56 换课与独立引用。AC02不计新问题。 |
| A05 | 历史列表多项/置顶/旧日期 | 搜标题及摘要；无结果；清空；选择；菜单取消/置顶/取消置顶；刷新 | W ThreadList/ThreadMenu，V project | 通过：audit 10；edges 42 四日期组；late-search 60 摘要搜索，清空恢复。 |
| A06 | 真实会话重命名 | 打开、Escape、重开、输入80字符、Enter；刷新；失败重试；首次发送保留明确标题 | W commitRename，P patchThread | 通过：rename 43，80字限制、Escape、网络失败重试、明确标题首次发送及刷新。 |
| A07 | 真实会话删除 | 一次点击确认态；Escape/外点/超时取消；重开确认；当前/末条删除；业务对象保留 | W ThreadMenu，P deleteThread | 通过：audit 15；failures 37 外点/超时；protected-history 48 删除后题目仍在。 |
| A08 | 生成/未决操作中的历史 | 删除被拒；保留对话；停止或确认；再删除；菜单焦点可继续Tab | W ThreadMenu，P manageThread | 通过：protected-history 47/48；controlled 历史菜单连续 Tab/Shift+Tab/Escape。 |
| A09 | 390/820 首页历史 | 打开列表、选项菜单、改名；Escape分层处理；外点；选会话；焦点归入口 | W Home/ThreadList | 通过：audit 11；consumer-final 57，窄屏外点/Escape/Space重开/继续输入。 |
| A10 | 输入正文中间的@ | 保留前后正文，键盘和指针选题；继续输入；重复同引用；移除chip | W Composer/MentionMenu | 通过：controlled AC03；consumer-final 56 上下键循环和Tab选择；独立引用保留。AC03不计新问题。 |
| A11 | @三类结果/空结果/迟到搜索 | 工具按钮打开；查询；上下键循环；Tab/Enter选择；Escape/外点；再次输入；题目/资源/日程引用 | W MentionMenu | 通过：cards-branches 29 空搜索；consumer-final 56 键盘；late-search 60 迟到结果不覆盖新查询。 |
| A12 | 2个chip后@首个选项 | 桌面/820/390实际指针点击首项，核对顶栏覆盖及浮层边界；对照原型 | W MentionMenu/Composer，Popover消费者 | 产品通过：audit 05 三尺寸实际指针；原型失败：prototype 两项，见 SW-AGENT-03。 |
| A13 | 模型选择器 | 两精确ID、就绪/不可用；鼠标选择；Escape/外点关闭；键盘继续输入；下一轮使用所选模型 | W ModelPicker，P model/send | 通过：green02 SW01；edges 39/40 英文可访问名、长草稿/三尺寸重开；unconfigured 44 禁用。 |
| A14 | 输入换行/中文输入法/长草稿 | Shift+Enter换行；Enter发送；输入法Enter不发送；长文内滚动；窄屏重排 | W Composer | 通过：cards-branches 29 Shift+Enter/IME；edges 40 三尺寸长无空格草稿。 |
| A15 | 发送保存等待/响应丢失 | 点发送后继续输入/换模型；同键确认发送；刷新；下一条仍在；仅一个turn | P send/save，W dock | 通过：controlled WB-AG-010 与发送意图冻结，固定文本/模型/引用、下一条输入读回。 |
| A16 | 草稿上传失败/两设备冲突 | 显示本地状态；重试；双方内容；选择本机/已保存；刷新；继续输入 | P save/chooseDraft，W dock | 通过：controlled WB-AG-005 本机选择；failures 35 采用服务器内容并刷新。 |
| A17 | 读取失败/断流/重连 | 失败不冒充空会话；恢复原记录；断网提示；重连不新增生成；继续输入 | P connect/retry，W notice | 通过：controlled 首次snapshot失败、SSE缺号、断线后另一设备保存与重连。 |
| A18 | 生成中切会话/页面 | 发送后切历史、新建、业务页面、关闭再开；运行继续；跳转原生成；账户只一轮 | P send/configuration，W Composer/PanelHead | 通过：audit 12 切会话及去看看；active-navigation 59 生成中切页、关栏、重开、回首页再停止。 |
| A19 | 停止/重复停止/刷新 | 保留部分正文和工具结果；未开始工具取消；继续输入；新turn继续；不重做已写操作 | W Composer/Divider，P stop | 受控通过：controlled WB-AG-013、protected-history 48、active-navigation 59；旧部分正文显示见64。真实逐token中断未验。 |
| A20 | 模型错误/拒绝/超限/不可用 | 明确状态；历史草稿可读；禁用发送；不自动换模型；明确再次发送恢复 | W Divider/Composer，P send | 通过：audit 13 provider错误后明确重发；failures 33 额度/上下文；unconfigured 44 缺配置可编辑且禁发。 |
| A21 | 长回答/旧文阅读/新消息 | 首条跟随底部；滚旧文后生成不拉走；新消息按钮到末尾；刷新恢复滚动 | W thread/nearBottom/newMessages | 通过：controlled 首条长回答/旧文120px保持/新消息回底；audit 08/09 长文刷新读回。 |
| A22 | 富文本输出 | 长中文、表格、行内/块公式、代码、不可信链接；深浅/390无整页溢出；刷新 | R splitBlocks/Prose | 通过：rendering 1条真实SDK呈现；audit 08/09 公式/表格/代码与长中文三尺寸。 |
| A23 | 回答复制/重答/用量 | 剪贴板成功/拒绝/不可用；重试；重答新turn；所选模型；用量不完整及费用未知 | W CopyButton/regenerate/usage | 通过：controlled AC04 中英文拒绝/不可用/真实剪贴板重试；rename 43 重新回答新turn；audit 08 用量。AC04不计新问题。 |
| A24 | 只读工具全状态 | 查找中、结果、空、失败无正文；详情参数；打开真实对象/删除后不可用；刷新不重查 | W WorkLog，T ToolCard | 通过：controlled WB-AG-020；failures 34 空结果刷新；legacy-link 50 当前对象不可用，未重复模型请求。 |
| A25 | 写工具及结果未知 | 进行中、成功、拒绝、未执行、结果待确认；原键核实；复用提交；打开副本/版本冲突保留草稿 | T ToolCard，P reconcile | 受控通过：controlled WB-AG-009/012/023、protected-history 48 原键核实和删除保护；各崩溃时刻不由本线代签。 |
| A26 | 教学提案plan/practice/variant | 回答后卡片；展开收起；点击才保存；多题顺序；部分成功/未知/失败；刷新后打开 | W ResultCard/useCardAction/ProposalStatus | 通过：cards-branches 26/27/28 三类真实保存、四题展开/收起/刷新；controlled 多题部分完成与丢回执接续。 |
| A27 | 草稿引用/历史快照 | 发送前三类chip核对与移除；过期引用拒绝；历史留原快照；原对象更新或删除后打开 | W RefChip/UserMessage，P addReference | 通过：controlled resource/entry发送快照；failures 36 引用版本冲突、重选发送、最新对象与历史旧标题。 |
| A28 | 题库/资源/日程业务侧栏 | 从保存对象加入；上下文建议chip；普通浏览保持AI；编辑草稿保留；关闭重开 | W useCurrentContext/PanelWelcome/Composer | 通过：consumer-final 58 题目/资料/日程往返及@主动资料引用；深链当前对象另见A34。 |
| A29 | 首页与业务往返 | 首页输入到侧栏同一会话；侧栏切历史/新建；首页打开；返回工作；刷新 | W PanelHead/Home，外壳消费者只读 | 通过：audit 14；protected-history 49 最近8条和全部；consumer-final 58 返回工作及同一草稿。 |
| A30 | 旧设备历史 | 旧示例只读/改名/置顶/删除；已有卡确认原槽；新会话仍真实API；账户隔离 | V read/project，useLegacyCardAction | 通过：controlled 旧metadata/旧卡原槽核实与新账户隔离；legacy-link 51 三类旧卡与本地管理；legacy-interrupted 64旧中断只读。 |
| A31 | 主要浮层连续操作 | 课程/模型/引用/历史切换打开→关闭→快速重开→Tab/Shift+Tab→继续输入；视觉层级与动效 | W各picker，Menu/Popover消费者 | 通过：green02 SW01、consumer-final 56/57、protected-history 49；引用原型遮挡单列SW03。 |
| A32 | 相关显示组合 | 1440×900/820×1180/390×844；中英、深浅、reduced-motion；截图亲眼检查关键页/长内容/浮层 | agent.css及外壳消费者 | 通过：final-themes-results.json 24张同空数据形态截图46-*逐张亲眼核对；cards-branches 31 reduced-motion=0s；active-navigation59实际角度变化。 |
| A33 | 五个问候时段 | 固定浏览器业务日期到2/8/12/15/20点，每次刷新并读实际欢迎语；恢复时钟 | W greeting/Hero | 通过：cards-branches 30，五个时段均实际显示。 |
| A34 | 资源甲深链后返回列表改看乙 | 从@甲chip进入深链；返回列表点乙；详情乙可见时回通用建议；主动甲引用保留；刷新仍乙且无错称 | W useCurrentContext，资源ResourceRoute消费者 | 通过：SW02基线红，green02 及 resource-product-green 61候选绿。 |

## 新问题与处理

| ID | 分类及真实症状 | 最小纠正与证据 |
| --- | --- | --- |
| SW-AGENT-01 | 基线原有，产品和原型共有。模型/侧栏历史选项卸载以及菜单内Escape丢焦到BODY；键盘选中模型后Space不能重开。下一Tab在原DOM中仍正确，不将其夸大为跳外壳。 | 产品在选项卸载和Escape关闭前归焦原触发器，课程Escape沿同一机制。`red-reopen.log`具名红，`green02.log` SW01绿，三尺寸长草稿见40。原型同改动建议已交总控。 |
| SW-AGENT-02 | 基线原有，产品和原型共有。@甲chip深链后，资源返回列表改看乙，兼容URL仍为甲，助理继续宣称当前在看甲。普通资料入口的通用建议是现有范围，不算缺陷。 | 深链ID与实际账户`scene:resources.openId`相同才显示资源上下文，否则回通用；保留教师主动引用，不增加普通资料自动上下文。`resource-entries-results.json`及55-*为两端红（header首次取到隐藏列表h1，实际标题以55可见截图为准）；`red02.log`是乙标题明确可见后的具名失败；`green02.log` SW02绿，61-*为实际种子资料复验。 |
| SW-AGENT-03 | 原型独有，不计产品新增根因。双引用后@首项在1440被顶栏拦截，390越出视口；820可点。 | 设计原则24已有依据，总控负责按产品共享Popover同步原型。`prototype.log`、`prototype-results.json`及prototype-two-chips-pointer-*实际指针失败；产品audit 05三尺寸同序列均真正点选成功，没有用键盘规避。 |

产品修复为2个独立根因；原型独有1个。AC02/03/04为阶段A既有项，本轮新组合复验不重复计数。没有已知本轮引入产品问题。

## 证据边界与接续

- 证据文件相对于本页首段的独占证据目录；`controlled.log`为固定基线本轮新跑的26条c26路径，25通过，双标签例在afterEach发生Playwright trace字节/ZIP截断，未出现页面行为断言失败。同例在`green.log`和最终`green02.log`独立重跑均通过。该单次产物错误单列为测试环境现象，不改产品断言或跳过用例。
- 最终候选`candidate02-web`包含本线两项修复；`green02.log`集中验证两项新回归、题目双标签上下文及真实资源引用。`rendering.log`为固定基线公式呈现；已通过且未受修复影响的其他路径不重复全量跑。集中CI及整轮独立审查由总控完成。
- 真实付费模型、邮件送达、实物触控设备未验；尺寸为Chromium视口模拟。本轮使用真实认证/fake-mail、隔离SQLite与文件、现有受控SDK provider。部分正文在旧中断历史实际读回并显示，只证明该呈现；没有把完整文本fixture代签真实逐token流或每一个服务器崩溃时刻。账户撤销/退出完整链路由总控聚合，未用本线结果代签。
- 原型修复、公共文件、全局计划、buffer、Git和集成均归总控。本线服务关闭；整轮成功前按授权保留本线失败现场、截图、构建和临时库，详细归属见本线receipt和temporary-directories.json。

原型同步已完成，三项对应路径的9个实际检查通过；证据见本线 `prototype-final-receipt.md`。产品原有红绿及边界继续有效，原型模拟会话不能替代真实账户持久化验收。
