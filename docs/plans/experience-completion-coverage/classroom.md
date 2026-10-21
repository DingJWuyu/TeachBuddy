# 班级全站复查覆盖

本线从 `ddc2f3d1c4e8299cbd36b821bac817e222d4e705` 产品及原型源码独立展开，作者 `gpt-6.1-sol / xhigh`。产品只读构建 `test-results/experience-completion/sweep-baseline-web`，原型 4174。实际操作使用隔离真实认证、fake-mail、HTTP、SQLite 与 Chromium，不使用私人 50880 或收费模型。证据根目录 `test-results/experience-completion/sweep/classroom/`。下表初稿在查阅上轮证据之前形成；状态须由本轮运行填写。

源码缩写均位于 `apps/web/src/features/classroom/`，原型对应 `docs/design-system/teachbuddy-app/ui/tbx/src/classroom/`。父级计划由总控维护，本页只拥有班级覆盖事实。

| ID | 入口、前置与操作序列 | 预期与分支 | 源码 | 证据、状态 |
| --- | --- | --- | --- | --- |
| C01 | `/classroom` 新账户→空态→新建班级→取消→重开 | 空态可达，取消无写入，首字段焦点 | ClassroomPage/ClassForm | 通过：workflow-final.log；product-empty-class.png；空名禁用/初始焦点/Escape/重开均实操 |
| C02 | 新建班级填名称/学期→创建→刷新 | 保存读回、名单人数与右栏一致 | ClassroomPage/ClassForm/useData | 通过：baseline-e2e 完整教师流程；workflow-final.log 新班及学期保存 |
| C03 | 班级菜单→信息→修改→失败→保留输入→重试 | busy 禁字段/Escape/遮罩；读回失败不重复创建，修改基于保存版本 | ClassroomPage/ClassForm | 通过：baseline-e2e「班级信息保存等待读回」与学生/考试表单两条；503读回重试、busy、最新版本 |
| C04 | 多班右栏快速切换→四分段→外模块返回→刷新 | 当前对象与视图正确，无迟到导航 | ClassroomPage/useScene | 通过：supplement-final/result.json C04-C13；final-branches/result.json C04 外模块往返与刷新 |
| C05 | 空班座位/学生/成绩/记录 | 各空态真实可用，无伪零成绩 | Seating/Roster/Scores/Records | 通过：workflow-final.log 空班；baseline-e2e「损坏工作簿」内无考试提示；source-backcheck 空学生成绩 |
| C06 | 学生→添加→仅姓名→继续添加同名异学号→完成 | 成功才清空，学生身份独立、排序稳定 | Students/StudentForm | 通过：workflow-final.log 四生继续添加与完成；baseline-e2e 学生表单失败重试 |
| C07 | 添加/编辑→生日/兴趣/性格→合法资料保存→失败重试→刷新 | 日期年龄、自由文字与学号保留，失败继续输入 | Students/StudentForm/StudentDetail | 通过：workflow-final/product-student-profile.png 生日/年龄/兴趣/性格；baseline-e2e student表单拒绝/重试 |
| C08 | 学生卡/座位键盘或指针进入→兴趣/性格卡编辑→返回 | 资料字段与当前学生一致 | Students/StudentDetail | 通过：workflow-final.log 兴趣卡进入资料/焦点/取消；source-backcheck-final 键盘Enter与返回 |
| C09 | 学生搜索姓名/学号→无结果→清空 | 正确筛选，恢复全部 | Students/Roster | 通过：workflow-final.log 学号搜索、无结果、清除；产品与原型同序列 |
| C10 | 座位未排座→补齐空位→拖到空座→交换→拖回托盘→刷新 | 一人一座，换座不改记录，指针跟随与落位动效 | Seating/save/place/handlers | 通过：workflow-final product-drag-mid.png，空座/交换/托盘/补齐；source-backcheck-final 真实touchCancel与Enter |
| C11 | 教室大小增减行列→减到已占位置→边界 | 超出学生回托盘，1..15限制、持久化 | Seating/resize | 通过：workflow-final 增减；source-backcheck/result.json C11 真实1/15行列边界、裁掉位置回托盘 |
| C12 | 窄容器座位→横滚最后一列→未排座区 | 姓名可读、讲台和托盘可达 | Seating/classroom.css | 通过：workflow-final product-seats-390.png、横滚断言；原型26px座位为既有批准差异，产品≥72px |
| C13 | 学生换班→旧班座位→新班记录/历史成绩 | 身份/记录跟随，旧场成绩仍属原班；取消无改动 | Students/StudentForm | 通过：supplement-final/result.json 与 student-moved-history.png；记录跟随/旧班历史/移回不抢旧座 |
| C14 | 学生或班级记录→日期正文→快捷键/按钮保存→刷新 | 完整事件与日期保留 | Records/Composer/Journal | 通过：workflow-final product-records.png，日期与Control+Enter；baseline-e2e学生记录刷新读回 |
| C15 | 记录→编辑→取消/保存失败→继续输入→重试 | 输入不丢，成功列表正确 | Records/Composer/Journal | 通过：workflow-final 编辑保存/取消；supplement/result.json C15-failure 503保留原文、重试一次与刷新 |
| C16 | 记录文字搜索→时间范围→空态→快速清空/更换 | 迟到旧结果/错误不覆盖当前条件 | Records/selection/load | 通过：workflow-final 四范围/搜索；baseline-e2e「自由记录清空搜索」覆盖迟到成功/失败及新筛选 |
| C17 | 记录悬停→归档第一次→Escape/外点取消→再次确认 | 二次确认，取消无写入，归档可恢复 | Records/ConfirmButton | 通过：workflow-final Escape取消；baseline-e2e完整教师流程二次确认归档、保留其它记录 |
| C18 | 考试列表空态→新建→题数/满分批量加→分组题号→删除→取消 | 至少一道计分题，分组不重复计分，取消不写 | Exams/ExamForm | 通过：workflow-final 新建2题/分组/无题禁用；baseline-e2e批量3题、题号修改与取消 |
| C19 | 新建/编辑考试→日期/学科/总满分→保存失败→重试→刷新 | busy封锁，满分差异提示，保存读回 | Exams/ExamForm | 通过：baseline-e2e exam表单创建/编辑读回503、改字段/重试；workflow-final考试实际创建 |
| C20 | 考试题目标签→已有多选/新建→失败→继续Tab→Escape | 标签关系正确、保留输入与菜单焦点 | Exams/TagPicker | 通过：baseline-e2e完整教师流程503保留输入/Tab/Escape、多选与新建；workflow-final题目标签截图 |
| C21 | 有成绩考试→降满分/移除已用题→失败→修正保存 | 整笔拒绝与输入保留 | Exams/ExamForm | 通过：supplement/result.json C21，已有分数降满分及移题均整笔拒绝，表单输入保留 |
| C22 | 考试详情→Word/PDF/图片上传→预览/原名下载→移除两次/取消 | 真字节、原名、图像展示与确认可用 | Exams/ExamDetail/SourceFile | 通过：baseline-e2e「原卷取回」真DOCX原名/字节、PDF预览链接、PNG真实解码；主流程移除取消/确认 |
| C23 | 导入入口：班级菜单/成绩/考试详情/无结果班级 | 预置班级/考试正确，无考试提示 | Import/ImportDialog | 通过：workflow-final 考试/班级入口；source-backcheck C23-no-result 无结果班入口锁定正确对象；baseline无考试 |
| C24 | 导入①→名单模板下载并打开→坏Excel→有效xlsx/xls | 合法工作簿可继续，错误释放已知拒绝，学号前导零 | Import/choose/template | 通过：两端模板实际解包名单4人；baseline坏表重选；final-branches真biff8 .xls选择上传；native-drop真xlsx原生drop |
| C25 | 导入②→工作表/行范围/列映射→题列→重新换文件 | 自动猜测及手工选择真实生效，预览高亮 | Import/guess/build | 通过：workflow-final 多工作表、自动映射；final-branches手改行范围/折叠；source-backcheck部分题列/重新对应/换文件 |
| C26 | 导入③→姓名学号矛盾/同名/超分→选学生/快捷确认/改分 | 明确错误校对，失败继续输入、无模糊匹配 | Import/edit | 通过：baseline-e2e「姓名学号矛盾」「逐题得分越界」；手动改选、无建议证据与修正读回 |
| C27 | 导入③→参加/缺考/忽略/恢复/无总分/未记录 | 空白、0、缺考不混同，无总分不自动求和 | Import/edit/confirm | 通过：baseline-e2e无总分/真实0/缺考/未记录；final-branches忽略与恢复；不补逐题合计 |
| C28 | 导入③→重新对应列→取消重开/刷新→确认入库→看看成绩 | 草稿持久、原键恢复、原子确认；取消/忙碌/重试边界 | Import/queue/confirm | 修复后通过：final-e2e列焦点/忙碌与响应丢失；retry-final两种原键重试；baseline恢复首次读回 |
| C29 | 班级成绩→考试/标签连续多选→等待/失败→重置 | 菜单与条件保持，组合筛选按题并集 | Scores/ClassScores | 通过：baseline-e2e连续考试标签多选、503后重置；final-branches双场不同满分与组合筛选 |
| C30 | 班级成绩→趋势悬停/键盘选择→焦点考试切换→分布点档 | 数字/tooltip/十档名单一致，动画可见 | Scores/charts | 通过：workflow-final product-scores-hover.png；final-branches两场趋势悬停/点选、分布档内学生跳转 |
| C31 | 班级成绩固定缺分/缺考/0/同分→排名→学生 | 不补零，竞争排名、题目/标签分母清楚 | Scores/api | 通过：workflow-final均分70/名次1,1,3/缺考；baseline缺总分不画0及真实0/缺题分计算 |
| C32 | 学生成绩→空态/多考试→切考试→题目与班均参考 | 总分排名与当时班级正确，缺分不画0 | Students/StudentScores/charts | 通过：workflow-final学生成绩；supplement-final旧班参考；source-backcheck C35-class-C32-empty空成绩；student-final统计503重开与两场切换 |
| C33 | 考试→详情同场比较→无结果班级导入 | 同卷同口径，无结果非零，与题目关系一致 | Exams/ExamDetail | 通过：workflow-final同场比较；source-backcheck无结果班级真实打开导入；不伪造零 |
| C34 | 标签管理→新建/重复→改名→取消/保存→合并取消/确认 | 名称输入可接续，使用数与所有题目关系同步 | Exams/TagManager | 修复后通过：workflow-final 标签新建/改名取消/合并取消确认；tag-final重名拒绝/改名503原键重试；final-e2e三条迟到新建/改名不同及同对象重开 |
| C35 | 班级/学生/考试→归档→取消→重开确认 | 真实确认、失败可再操作，无误删 | ClassroomPage/Students/Exams/Confirm | 通过：source-backcheck学生/班级取消→确认→恢复，source-backcheck-final考试取消→确认→恢复；baseline冲突再主动确认 |
| C36 | 归档班级+独立学生+独立记录→刷新→先父后子恢复 | 禁止提前恢复，父级不批量复活孩子 | Archive/restoreReason | 通过：baseline-e2e「原型成绩准入」真实归档上级下子项、刷新、先班级再学生再记录，父恢复不批量复活 |
| C37 | 已归档空态/读取失败→重试→恢复→快速导航 | 归档分组和失败入口可用，无迟到内容污染 | Archive/load/restore | 通过：supplement/result.json C37 归档读取503/重新加载；baseline与source-backcheck恢复后空态 |
| C38 | 1440桌面/辅助栏820容器/390窄屏，按相关分支组合中英深浅 | 班级/学生/考试/导入/标签/归档真实截图和操作可读 | classroom.css/全部组件 | 通过：workflow-final 1440/820/390；supplement-final 深色成绩/辅助栏820、390英文名单记录；final-branches英文完成图已目视 |
| C39 | reduced-motion→座位键盘进入学生、记录/名单分段切换及真实时间线采样 | 减少动效条件真实交互，截图与动画采样 | classroom.css/Seating/charts | 通过相关组合：workflow-final reduced座位键盘入口；final-branches真实分段10帧采样普通透明度0→0.897，reduce两RAF到1/模块1ms |
| C40 | 源码反查：记录附图、单条永久删除、题型关系、AI | 当前规格无记录附图/单条永久清除/题型；图片为原卷，题型为计分题分组；AI未接后端 | features/classroom.md，Records/Exams | 范围确认，非运行PASS：当前规格无记录附图/单条永久清除/题型；图片为原卷、题型为计分题分组；AI仅验打开辅助栏 |

## 发现与修复

所有编号均为本轮独立重新复现的既存问题，本轮引入缺陷0项；合计5个独立根因。产品源修复保持当前能力，不新增后端。

| ID | 真实失败与根因 | 修复与本轮证据 |
| --- | --- | --- |
| SW-CLASSROOM-01 | 导入②姓名列ArrowDown后控件重建，焦点掉到BODY，后续Tab无法接续。产品和原型共有。 | `ColSelect`移至稳定模块组件并显式传列。`import-probe-red.log`、`prototype-probes/result.json`红；final-e2e第一条绿。 |
| SW-CLASSROOM-02 | 导入③确认POST等待时Escape提前关闭，旧保存继续。原型共有，已获总控按既有busy规则裁决。 | busy传Dialog，原生fieldset和返回/取消禁用，拖入忙碌不重入。两端红同上，busy-final及final-e2e忙碌绿。 |
| SW-CLASSROOM-03 | 导入完成承诺“在学生成绩里修正”，但实际个人成绩只读，两端共有。 | 总控裁决最小文案改为班级/学生“查看”，公共英语由总控同步；final-branches中英真实入库及截图。未造纠错功能。 |
| SW-CLASSROOM-04 | 确认503后持久未决POST仍在，下次确认却先PUT另一请求，原地重试被锁。产品持久请求特有，原型无真实恢复链。 | 先recover原键，再读当前导入；confirmed只继续读回。`confirmation-retry-red.log`红；retry-final两条分别核对提交前503和真实提交后响应丢失，原键/请求体相同、结果分别从0/1到1。 |
| SW-CLASSROOM-05 | 标签甲改名迟到成功清除正在编辑的乙或取消后重开的甲；新建成功也清空已经继续输入的下一标签。两端共有。 | 提交编辑快照只结束同一当前快照；新建仅清空未变输入。tag-race-red/tag-create-red和tag-prototype红；final-e2e三条新建/跨对象/同对象重开绿。 |

## 上轮查漏与源码反查

独立初稿完成后才查阅上轮74项清单，新增核对指针取消、1/15行列边界、无结果班级导入锁定、学生空成绩、部分题列与换文件、实际归档确认取消，证据见source-backcheck两次记录。原型旧菜单被相邻卡遮挡、窄座位26px及缺考横线字符不同是原型既有边界或批准差异；产品按现行座位可读性和共享浮层规范保留，不记成新产品缺陷。原型固定对照已在总控同步前结束。

反查覆盖ClassroomPage/useData/ClassForm、Seating全部指针/排座/缩放分支、Students/Roster/StudentDetail/StudentScores、Records/Composer/Journal、Exams/ExamList/ExamForm/TagPicker/ExamDetail/TagManager/SourceFile、Import各步骤/恢复/重试、Scores和charts、Archive及本线ui消费者。公共Popover/Confirm/外壳作为真实消费者使用，公共实现由总控线核对。

本轮没有实际AI班级工具、教师真实成绩表、物理触控设备或桌面Office测试；浏览器原生PDF阅读器的页面内部未单独截图，不以预览链接属性代签PDF阅读器。reduced-motion只声明上表实际相关组合，没有穷举所有状态交叉。来源固定工作簿及原卷沿仓库fixture，构造小班用于精确数字核对，不声称任意学校工作簿均可识别。

## 验证与收口

- 基线专属classroom E2E 13/13，`baseline-e2e/`。没有运行全CI。
- 候选最终构建 `final-web/`；7条新增回归及原完整教师路径共8项中7项首轮通过，确认503用例最后刷新后立刻带旧页面绑定读HTTP返回401，属于测试前置竞态。修正为先等班级界面加载，再读结果；`retry-final/`两分支均通过。其余已通过项未无故重跑。
- 中间忙碌测试曾点击遮罩圆角2px和提前unroute，使测试自己超时/重复处理路由；改为真实30px遮罩位置及等继续完成，busy-final通过。独立脚本的label/option混合匹配、innerText换行断言与引导遮罩前置也已核对纠正，不计产品根因。原生drop的首个CDP数据没有触发drop，使用实际URI文件项后native-drop记录真实文件及进入映射；`.xls`通过文件选择实际入库，不冒充原生drop成功。
- 所有截图通过实际浏览器操作生成并已目视相关产品/原型画面；正常与减少动效用浏览器真实时间线采样。完整执行和临时现场归属见证据根目录receipt。

原型同步已完成，最终对应路径的真实复验通过；证据见本线 `prototype-final/receipt.md`。产品原有红绿及边界继续有效，原型模拟会话不能替代真实账户持久化验收。
