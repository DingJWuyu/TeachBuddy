# 班级体验清查

执行者：classroom，`gpt-6.1-sol / medium`。基线 `a5daad25a712a4d2f75f34da71bc97e645f1a8a0`。原型只读 `docs/design-system/teachbuddy-app/ui/tbx/src/classroom/`，产品对应 `apps/web/src/features/classroom/` 同名文件。下表列出74组具体行为及条件，产品可操作分支已完成；原型自身不可达条件单列边界。实际证据统一在 `test-results/experience-audit/classroom/receipt.md`。

## 条件与保留差异

真实认证、假邮件、独立 SQLite/Files；不使用 50880。真实保存、服务器统计与版本冲突口径优先于原型模拟后端。无原卷、仅学号、仅总分、无总分导入保留现行契约；归档上级先恢复；AI 未接入不声明可操作。布局检查 1440×1000、820×1180、390×844，中文/英文、浅色/深色及辅助栏开启。

## 原型源码行为清单

| ID | 原型符号与触发、连续操作 | 产品对应 | 结果与证据 |
| --- | --- | --- | --- |
| C01 | ClassroomPage/useData：加载、空班级、新建入口 | ClassroomPage | 基线真实认证4/4：新账户空班级入口；两端 sweep/sweep2 |
| C02 | ClassForm：初始焦点、空名禁用、取消/Escape/遮罩关闭 | ClassroomPage/ClassForm | 两端 sweep2：空名禁用、初始焦点及Escape |
| C03 | ClassForm：姓名、选填学期、创建、刷新读回 | 同名 | 两端 sweep2：真实新班及产品基线刷新 |
| C04 | Rail：多班切换、人数、保留四种分段视图 | ClassroomPage | 两端 sweep：26/18学生、四视图与rail |
| C05 | 班级操作：菜单、班级信息、保存/取消、焦点返回 | ClassroomPage | EA06：class-save-red基线红，class-save-complete-recheck绿；含读回503保留输入、原写入计数不增、busy Escape/遮罩/焦点守卫 |
| C06 | 班级归档：确认取消、确认保存、切到下一活动班 | ClassroomPage | 两端 lifecycle：取消、确认及逐级恢复 |
| C07 | useData：读取失败与重新加载 | ClassroomPage | 候选 errors：真实503读取错误与重新加载成功；学生统计失败重开恢复 |
| C08 | Seating：无人空态及添加学生入口 | Seating | 两端 sweep2：新班座位空态 |
| C09 | StudentForm：姓名必填、学号选填、额外资料展开 | Students | 两端 sweep2及基线新增学生 |
| C10 | StudentForm：生日/兴趣/性格、保存并继续、字段清空 | Students | 两端 lifecycle：生日兴趣性格保存；sweep2继续添加；EA06扩展student-lifecycle-green含busy关闭/失败重试/最新版本 |
| C11 | StudentForm：重复学号错误与输入保留 | Students | 两端 sweep2：重复001拒绝、输入保留、改002保存 |
| C12 | Roster：按学号排序、座位位置、兴趣、最近成绩胶囊 | Students | 两端 sweep：完整名单、位置/兴趣/最近场次 |
| C13 | Roster/Search：姓名/学号、无结果、清除搜索 | Students | 两端 sweep：201检索、无结果与清除 |
| C14 | Seating：托盘拖至空座、即时保存、刷新 | Seating | 两端 sweep2及prototype-rest；产品基线刷新座位 |
| C15 | Seating：已占座交换、原位拖回、目标光圈/跟手卡/落下动画 | Seating | 两端 pointer-branches：同座拖回、拖中跟手、占座交换均已验 |
| C16 | Seating：座位拖回托盘、托盘学生覆盖座位 | Seating | 两端 pointer-branches：移回托盘、托盘覆盖已占座并换出原学生 |
| C17 | Seating：拖出取消、pointercancel、点击/Enter/空格打开学生 | Seating | 两端 pointer-branches：拖出取消、浏览器原生touchCancel、Enter/空格打开与返回 |
| C18 | Seating：按学号补空、容量不足、人人有座位 | Seating | 两端 pointer-branches：按号补位、人人有座位、1排容量不足保持剩余托盘 |
| C19 | Seating/resize：增减行列、边界禁用、裁掉学生回托盘 | Seating | 两端 final-branches：1/15排边界和裁掉回托盘；sweep2列增减同路径 |
| C20 | StudentDetail：头像、学号生日年龄、兴趣性格空值、点击编辑 | Students | 两端 sweep/lifecycle：完整资料与生日年龄 |
| C21 | StudentForm：换班提醒、保存后旧座位释放、记录随人 | Students | 两端final-branches真实换班；候选errors另创建记录后换班，在新班个人页读回同一条，再移回 |
| C22 | StudentDetail：返回班级、学生归档确认/取消 | Students | 两端 lifecycle：学生归档确认，sweep返回 |
| C23 | Journal/Composer：焦点环、自适应高度、日期、按钮/快捷键保存 | Records | 两端 lifecycle：日期、快捷键及编辑；sweep composer |
| C24 | Journal：班级和学生各自记录、时间线月份日期、刷新 | Records | 两端 sweep/lifecycle；产品基线刷新保存记录 |
| C25 | Journal：文字搜索、清除、四种时间范围、筛选空态 | Records | 两端 lifecycle四种时间范围；sweep文字搜索；EA02修复 |
| C26 | Journal：悬停编辑、自动焦点、保存、Escape/取消 | Records | 两端 sweep/lifecycle：自动焦点、Escape、编辑保存 |
| C27 | Journal：归档记录确认/取消及恢复 | Records | 两端 lifecycle；产品基线取消归档后确认及恢复 |
| C28 | ExamList：空态新建、日历卡、班级导入状态 | Exams | 基线新账户空考试、新建；两端sweep卡片 |
| C29 | ExamForm：名称/日期/学科/总满分，空题禁用 | Exams | 基线实际新建考试；两端sweep编辑字段；EA06扩展forms-lifecycle-green考试创建/编辑读回失败重试通过 |
| C30 | ExamForm：批量添加、题数与分数、分组/题号/满分、移除 | Exams | 基线批量添加3题/改题号；两端final-branches移除受用题 |
| C31 | ExamForm：总满分留空合计、不完整覆盖提示、保存 | Exams | 基线满分留空合计保存；两端sweep覆盖提醒 |
| C32 | TagPicker：已有标签多选不关、新建、重名、失败保留、Escape焦点 | Exams | 产品基线完整标签键盘/503重试通过；prototype-boundaries真实多选和新增通过，原型Escape关闭整个考试而非仅菜单，按共享键盘规范保留产品增强 |
| C33 | ExamDetail：返回、编辑、有成绩题不可移除错误 | Exams | 两端 final-branches：已使用计分题移除错误、取消 |
| C34 | ExamDetail：同场比较无结果与导入这个班 | Exams | 两端remaining-ui/prototype-boundaries：无结果班级导入锁定考试和该班 |
| C35 | ExamDetail：均值/中位数/人数/逐题跨班对比、低分橙条 | Exams | 两端 sweep/final-branches：两班均值人数与逐题比较 |
| C36 | ExamDetail：计分题分组/标签、覆盖整卷与不完整覆盖 | Exams | 两端 sweep：分组、标签与覆盖提示 |
| C37 | ExamDetail：上传原卷图片/PDF/Word、读取下载、移除 | Exams | EA05：两端真实DOCX/PDF/PNG上传与PNG解码；正式E2E下载Word字节相同但原名丢失，候选download-green通过原名及PDF/图片预览不强制下载 |
| C38 | ExamDetail：归档考试确认/取消、退出统计、恢复 | Exams | 两端 final-branches：考试归档取消、确认、恢复 |
| C39 | ImportDialog：班级和考试入口固定选择、无考试提示、取消 | Import | 两端import-sweep固定选择；workbook/download-green新账户无考试提示已验 |
| C40 | ImportDialog：下载含本班名单模板、文件选择与拖入 | Import | 两端import-sweep下载名单模板/选文件；candidate-import-continuity及prototype-boundaries浏览器原生CDP文件dragEnter/dragOver/drop，hover截图与真实读取通过 |
| C41 | ImportDialog：正在读取、坏文件错误、换文件重选 | Import | EA03：原型 branches坏文件后重选成功；产品基线锁死，候选 workbook-green 通过 |
| C42 | guess：自动表头、姓名学号总分、题号别名、无缺考表头扫描 | Import | 两端 import-sweep固定scores-0自动映射；基线workbooks读取缺考备注/小问题号 |
| C43 | 对应列：多工作表、表头/起止行、列选择和蓝色预览 | Import | 两端多表真实切换；候选layout：改表头/起止行及蓝色预览，390操作 |
| C44 | 对应列：姓名/学号至少一列、仅学号、仅总分、无总分 | Import | 两端无总分；产品基线仅学号/仅总分；候选layout姓名学号全空禁用、仅学号可继续 |
| C45 | 对应列：逐题折叠/展开、部分映射、重新对应重建 | Import | 两端layout/prototype-boundaries：逐题展开/折叠、部分映射与重建均实操，候选390映射/校对可操作 |
| C46 | 校对：需要看的/全部/已忽略、汇总、无问题状态 | Import | 两端import-sweep筛选/汇总/忽略；有效映射确认前需要看的为空提示 |
| C47 | 校对：同名/未匹配、手动选择学生、重复匹配错误 | Import | 两端 import-sweep：重复学生选择阻断后恢复；基线重名需手选 |
| C48 | 校对：姓名学号冲突与“就是某某”确认 | Import | 原型branches快捷确认；候选name-green-recheck和name-suggestion截图：唯一学号建议、同名/改选/无证据 |
| C49 | 校对：参加/缺考切换、分数禁用、0和空白分开 | Import | 两端 import-sweep：缺考禁用分数、切回；产品基线0/空白/缺考区别 |
| C50 | 校对：总分和单题越界修正、警告保留可确认 | Import | 两端 import-sweep总分越界改0；产品基线单题12改3实际刷新 |
| C51 | 校对：忽略/恢复、未出现在表内的学生为未记录 | Import | 两端 import-sweep：忽略/恢复筛选；基线未记录学生胶囊 |
| C52 | 校对：连续编辑排队、确认等待、失败重试、步进焦点 | Import | EA07：真实503后原键恢复先写45却被早读草稿显示65，第二次刷新才45；import-recover-red红，loaded/error就绪后再挂载，import-recover-green 1/1通过首次刷新45、恢复再次503后原键重试46 |
| C53 | 完成：绿色勾、参加/缺考/未记录计数、完成/看看成绩 | Import | 两端import-sweep成功页/看看成绩；name-green-recheck完成后重新导入 |
| C54 | ClassScores：无考试/无成绩、导入与新建入口 | Scores | 基线空考试/无成绩；两端scores入口 |
| C55 | ClassScores：考试与标签多选、菜单不关、全部重置 | Scores | EA01基线两端菜单关闭；候选3/3含考试标签连续多选/503后重置 |
| C56 | TrendChart：均值/中位数/范围带、进场、悬停十字线说明卡 | charts/Scores | 两端 sweep悬停十字/说明卡、图例/范围带截图 |
| C57 | TrendChart：点考试切焦点与清掉分布选择、缺分不归零 | charts/Scores | 两端 sweep点考试；产品基线无总分不画零点 |
| C58 | 四张统计卡：均值/中位数/极值/参加缺考未记录无总分 | Scores | 两端 sweep四卡；产品基线缺考未记录无总分 |
| C59 | Histogram：十档、0和满分边界、空档禁用、再点收起 | charts/Scores | 两端 sweep选档/再点收起及空档禁用；产品基线0分及十档 |
| C60 | Histogram：档内学生、点击进入详情、返回 | Scores | 两端layout：分布档内学生点击进入个人页再返回 |
| C61 | 排名：前三颜色、同分并列、缺考/未记录、学生入口 | Scores | 两端 sweep排名并列前三/学生入口；基线缺考未记录 |
| C62 | RateBars：题目/标签得分率、缺分/未考到、低于60%橙色 | charts/Scores | 两端 sweep题目标签率及橙色低分；基线缺题分不补0 |
| C63 | StudentScores：无成绩/错误/加载、两条线、悬停、选场 | Students/charts | 两端sweep学生曲线；候选errors真实503统计失败，重新打开恢复 |
| C64 | StudentScores：考试逆序、分数名次班均、缺考缺分、逐题班均标记 | Students | 两端 sweep学生场次倒序、题条与班级标记；基线缺总分/排名 |
| C65 | TagManager：空态、新建、使用次数、重名失败、改名取消/保存 | Exams | 产品remaining-ui：新增、重名拒绝、改名取消/保存；原型新增通过，后续菜单被其它行真实遮挡，prototype-tag-menu-blocked.png，指针分支受原型自身限制 |
| C66 | TagManager：合并菜单、确认取消/保存、题目同步替换 | Exams | 产品remaining-ui完整合并取消/确认通过；原型同一菜单中心实际命中false，被其它标签行覆盖，记录为参考自身边界，不改原型 |
| C67 | Archive：空态、四组、日期/名称/人数 | Archive | 两端sweep归档空态、lifecycle真实分组 |
| C68 | Archive：归档上级下子项仍可见、刷新、恢复先班级再学生再记录 | Archive | 两端lifecycle纯UI逐级恢复；产品基线刷新后层级禁用 |
| C69 | 通用 Dialog/Confirm：焦点循环、Escape、遮罩、关闭、错误与重试 | ui | 两端class/student/exam/import弹层操作；产品基线标签焦点陷阱及确认取消 |
| C70 | Menu/Search/Toast：指针/键盘、外点关闭、返回焦点、清空、反馈消退 | ui | 两端搜索清空、菜单外点/Escape/Toast实际操作；产品基线标签失败保持焦点 |
| C71 | 宽屏与820：卡片/rail、辅助栏开闭、内容滚动与无页面溢出 | classroom.css | 两端layout实际820/390带辅助栏开闭，无页面横向溢出；桌面深色截图 |
| C72 | 390：rail折行、分段换行、座位横滚、表格/弹层可操作 | classroom.css | 两端390座位和英文暗色名单；候选layout390映射/校对可操作且弹层边界正确 |
| C73 | 中英文与深浅色：列表/学生/考试/导入/归档实际组合 | 全部 | 两端themes中文深色+AI、英文390名单实际截图；脚本断言形状错误，截图/DOM确认 |
| C74 | 助理提示：入口与未接入能力边界 | ClassroomPage | 两端layout rail提示实际打开辅助栏，未发送模型请求 |

## 问题与交付状态

已确认并修复7项原有独立根因，无本轮引入问题：

- EA-classroom-01：产品和原型共同存在，违背设计输入“多选不关闭”。统计加载卸载筛选工具条；产品改为加载/失败仍保留筛选器。基线 `filter-red/` 红，候选 `candidate-regression/` 绿，覆盖503后选中状态和重置。
- EA-classroom-02：搜索清空后，旧关键词迟到响应把6条记录覆盖为0，输入框仍为空。`record-race.png`、`search-red/`；Records按请求代次和当前条件拒绝旧成功/失败，`frozen-records/` 2/2绿，另覆盖写入结束时保留新筛选。
- EA-classroom-03：真实坏Excel的精确422工作簿拒绝被当作未知结果，持久化写入无法释放，有效文件重选被锁住。原型可重选，产品 `workbook-red/` 红，局部识别精确422并显示原因，`workbook-green/` 绿。其它未知Problem/5xx保护不改。
- EA-classroom-04：真实后端对姓名/学号矛盾保留studentId=null并返回student-match-required，页面原有快捷确认分支不可达。适配层只按唯一精确学号提供建议，选择仍空白，老师显式确认才提交。`name-red/`红；`name-green-recheck/`绿，覆盖同名、改选与缺证据无建议。

- EA-classroom-05：原卷Word点击取回丢失原名，字节仍相同；原型runtime也转blob，有共同问题。复用链接原生download属性仅为不能内联查看的Word保留原名，PDF/图片继续预览。`download-red/`红、`download-green/`绿。
- EA-classroom-06：班级资料保存后提前关弹层，未等待reload/onSaved结束；用户已切标签仍被迟到go拉回。原型标签探查两次回班级与产品class-save-race确定同根因，不计脚本错误。ClassForm保存等待onSaved后关闭，精确回归`class-save-red/`红、`class-save-complete-recheck/`绿，覆盖busy退出和读回失败重试不重复写入。 独立审查固定a91cc0e0发现ExamForm/StudentForm同根遗漏，`forms-lifecycle-red/`两条真实Escape断言红；补齐两表单busy、传播读回失败及已确认版本复用。`forms-lifecycle-green/`中原完整教师路径、班级及考试3条通过，学生补classId测试前置后`student-lifecycle-green/`1条通过，覆盖创建后连续读失败不重写、改字段同ID更新、编辑后读失败再改用最新版本。归本项扩展，不增加根因数。

- EA-classroom-07：恢复原键PUT与弹层早读GET竞态，首次刷新仍见65，第二次才45。实际校对45已保存，不能把UI旧值当数据丢失。导入弹层等待现有loaded且无error再挂载；恢复失败沿原重新加载重试。`import-recover-red/`红、`import-recover-green/`1/1绿，首次刷新读45，恢复再失败沿原键重试读46；原型为内存模拟、不具备此真实恢复链。

原型弹层退出尚未完成时的首次拖拽、测试label选择器包含option文本、数组文本断言作用于单一节点等失败为探查脚本缺陷，已按实际控件修正后补验，不计产品问题。作者改动已冻结，产品可操作条件无待验项。原型C65/C66菜单被相邻行真实遮挡，指针无法继续改名及合并，产品完整操作已通过；原型内存适配器不具备EA07真实持久化原键恢复链。C32原型Escape关闭整窗、503清空输入已实际验证，保留产品现有键盘及错误保留增强。AI调用与物理设备/原生Office不在本轮浏览器体验范围。运行现场和证据交总控集中审查后清理。
