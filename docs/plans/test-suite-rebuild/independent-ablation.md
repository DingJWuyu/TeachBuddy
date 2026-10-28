# 独立旧套件审计与消融

当前独立结论：144个旧执行入口已逐行裁决，保留的代表保证、替代位置、退役排列、按变更专项和外部边界均可追溯。A十二项、C六项、B六项代表性业务故障均已取得有效检出及移除后逃逸或跨组检出证据，独立业务对照和144行裁决完成。本报告不宣称92个当前场景逐条mutation。

固定执行源为总控 `83fac6c0bfc6d423c2cc0202c7a569f3bd235d86`。后续根f3f9961与它执行语义一致，仅文档及fixture EOF换行；只读Web构建为36f5bb1的完整 `web-reviewed`，包含题库、标签、日程和Auth四项修复。原始比较基线始终为 `789a38d83babad04f2e2a51e9f17530abf638801`，原142清单保持阶段事实，补扫两入口后最终144。

| 正常与影响复核 | 固定版本及独立结果 | 原始证据 |
| --- | --- | --- |
| A底座 | 5f1565b9的41/41；最终5条新增所在三文件9/9、Cookie4/4；83目录helper后同三文件9/9。API产品源码在这些版本无差异 | `d-a-normal.tap`、`d-a-final-increment-normal.json`、`d-a-cookie-normal.json`、`d-a-runtime-directory-normal.json` |
| C成果 | 6b70a35c完整22/22及隔离副本22/22；36三增量3/3；83答案修订1/1、官方typed正常1/1。API/shared/扩展产品源未变化 | `d-c-normal.tap`、`d-c-copy-all-normal.json`、`d-c-increment-normal.json`、`d-c-answer-refinement-normal.json`、`d-c6-final-typed-math-normal.tap` |
| B主应用及公共入口 | 36完整23/23，169.48秒；83资源首例增强1/1，9.81秒。其余浏览器场景字节/产品语义未变 | `d-b-normal.json`、`d-b-resource-refinement-normal.json` |

原三次本机Node SIGSEGV仍单独开放为运行时条件未闭环：三份自有core有V8栈，50次静态import、20次串行GDB真实场景、固定3并发90进程均未再现，不能用这些绿灯关闭原异常。原受污染的移除比较不计业务检出；新83串行比较另有独立有效结果。干净云端CI及整体集成由总控接续，本报告不冒称已完成。

[144行去留表](old-test-decisions.tsv)的原固定源、实际旧保证和独有理由保留；`audit_decision/current_protection/residual_or_external`给出最终选取。A/B/C/X路径别名在表后说明。阶段历史如下仅解释发现和返工动机，最终状态以本报告当前裁决及实验结果为准。作者红灯均不直接签作D独立结果。

权限仅本报告、去留表和本树`test-results/test-suite-rebuild/`。故障只注入独立副本，每次finally恢复；未自行提交永久产品/测试/根配置改动，仅合入指定root候选，未调用收费模型、真实GPU、preview私有配置或用户数据。任务整体未完成，原始补丁、命令、日志、失败SQLite/原件及core均保留。

## 读取和证据

从 Git 读取原清单全部 142 个源入口，共 45,917 行；逐文件核对场景、实际断言和依赖，对独有失败边界、历史修复及兼容入口继续深读正文。没有按文件名、旧作者摘要、旧红灯或未进 CI 判去留。原清单的 77 个 API、56 个浏览器、3 个扩展及 6 个非标准历史脚本均有对应行。补扫新增 `apps/api/test/first-flow-real-runner.mjs`（318行）和 `apps/api/test/fixtures/auth-contract/https-smoke.mjs`（95行），完整原始入口变为144项。

本机原始证据位于 `test-results/test-suite-rebuild/`：

| 证据 | 内容与可复核范围 |
| --- | --- |
| `old-suite-evidence.json` | 原清单142个固定旧入口的完整源码、行数、场景声明和断言位置。原文仍可用去留表的 `baseline:path` 直接从 Git 重建 |
| `old-suite-supplemental-evidence.json` | 补扫第143/144项的完整固定源码；`first-flow-real-runner`与`auth-contract/https-smoke`均有真实业务断言，不作helper排除 |
| `standalone-entry-audit.json` | 基线非标准文件的40个含assert/check/进程退出候选完整源码；逐类区分执行回归、fixture/helper、采集和运行器 |
| `old-execution-configs.json` | 基线根/API 脚本、CI、聚合配置及各专项配置共 40 份，记录原执行分工 |
| `historical-fixes.patch` | 下列四组历史修复的实际产品 diff，含原修复前后条件 |
| `b-candidate-source.json` | 固定 `6673f8d5` 的九个 B 源码/配置文件 |
| `c-candidate-source.json` | 固定 `6240946c` 的六个 C 源码文件，防止后来候选变化混淆本阶段观察 |

已直接阅读的真实历史修复：

| 固定修复 | 原业务故障与后续挑战价值 |
| --- | --- |
| `1b107651` | 同账户另一页已完成后续改名，较早写入的迟到昵称回执覆盖了新昵称。需控延迟相交操作，普通 profile 保存不能检出 |
| `90fec3a7` 的 `useQuestionSession` | 分类创建捕获旧整题/旧窗口，迟到成功覆盖新输入或另一个校对目标。需核对目标身份及最新编辑内容 |
| `90fec3a7` 的 `useMathWorkSession` | 作品列表只核对账户代次，旧搜索或归档请求的成功/错误覆盖当前列表。需分别挑战迟到成功和错误 |
| `de8bd99b` | 删除意图已经受理但原 Cookie 丢失时，服务器启动不继续清理。`resumePendingDeletions`在正常监听前接续一次，单项失败保留锁且不阻断其他账户 |
| `6e5413ed` 的日程接线 | 深链接首轮读取未受编辑意图约束，迟到结果重开旧任务或旧错误残留。新建、切目标和退出都要使旧读取失效 |

`d7fb9ec9`及 Lessons 中动效采样修正属于测试时序证据，不能冒充产品故障检出。旧 CI 的分组遗漏、缺私人 E 原稿和受控时钟造成的采样问题亦不构成删除有效保证的理由。

## 第一阶段发现与返工动机（历史）

以下记录初版候选在当时的发现，保留需求依据与返工过程；其中“开放/待交付”只描述当时状态，不是最终当前遗漏。当前D01-D23裁决见后文集中收口表。

| ID | 现行依据与独有保证 | 当前候选观察及下一动作 |
| --- | --- | --- |
| D01 | [认证](../../contracts/auth.md)的注册关闭、验证码用途/邮箱绑定、pending 保存失败接续、存储不可读拒绝授权、HTTP/Cookie | A 初版保留正常交接、预算/替换、注册回滚和重置撤销，未见上述若干不同失败边界。总控已安排 A-R1 代表性补强；B 再核页面 S45、关闭注册与实际 Cookie |
| D02 | [材料内容](../../contracts/materials.md#内容)和[兼容](../../contracts/materials.md#b11-兼容与版本过渡)：未知 Document 原文只读，普通写、分类移除、Agent 写不得损坏存量；旧客户端不能压平 v2 | A 初版没有存量未来版本保护。已交 A-R2。旧 `materials-protection` 和 `preview-agent`是不同写入口的证据，应集中保护公开操作，避免仅测新请求 schema |
| D03 | [I08](../../contracts/auth.md#账户删除交换-i08)、[账户清理](../../contracts/data.md#账户永久删除)：受理后锁定、等待在途执行、物理失败不报成功、重启一次接续 | A 初版只有成功删除与原 Cookie 重复核实。已交 A-R3，以历史 `de8bd99b`挑战启动接续；B 另核设备字节清理、未决意图和迟到写回 |
| D04 | [材料兼容](../../contracts/materials.md#b11-兼容与版本过渡)、[部署恢复](../../contracts/data.md#部署备份与还原)：真实受支持旧库、旧 ID/文件与原路径成功请求继续确认 | A 初版退役前备份有价值，但较晚备份不能代签 R31/B16 的更早迁移。已交 A-R4。固定旧源码/数据输入和摘要保留，旧运行器可以替换；不要求精确全量迁移 ID 数组 |
| D05 | [个人包](../../contracts/data.md#portable)与[笔记摘录](../../contracts/materials.md#自动收题与分类)：源对象彻底删除后独立来源快照、noteFragments 和附件仍可读/导出/备份，跨账户与缺文件失败 | A 初版保存普通复制快照和多模块包，不包含真实笔记摘录采用与源材料彻底删除后的独立关系。C 初版也未覆盖。需明确 A/C 归属，选一条真实采用到源删除再导出恢复的链，压缩重复备份矩阵 |
| D06 | [识别](../../contracts/recognition.md#入口与状态)和[任务](../../contracts/materials.md#短任务与恢复)：停止未确认拒绝新推理，取消/超时完整迟到 raw 绑定原任务，重试不覆盖证据/人工稿，关闭等写回结束 | C `6240946c`只有成功 OCR 回放与两个消费者，不覆盖停止和失败边界。旧 `materials-recognition-runtime:15`、`materials-recognition:17/387/664/707`及导出证据测试有独有保证。用受控引擎/进程核验，不需要收费模型或真实 GPU |
| D07 | [文件执行边界](../../contracts/materials.md#文件持久提交与执行边界)：字节/回执持久、实际格式解码、Office 宏/外链/限额拒绝、宿主与网络隔离 | C 正常 Office 逐页内容、原件摘要有用，无法检出放开沙箱。旧 `materials-foundation-preview:250/317`有实际恶意输入及宿主 sentinel/本机网络探针；另保留上传中断/DB 提交失败不留可读悬空记录的代表。不是所有格式乘每种故障全排列 |
| D08 | [自动收题](../../contracts/materials.md#自动收题与分类)与[题面输出](../../contracts/materials.md#引用和输出)：题/答案/图不串归属、教学表列角色/连续原页继承/歧义不造题、长文稿分片不截尾 | C 已核对 W/P 与 I-1/I-2/PS-4 的真实题干、答案和图，仍未经过教学表、复杂 fragment/noteFragments 和长块分页分支。旧 `questions-tables`实际表格输入、`materials-questions-output`长块末行存在独有价值，应保留少量相异反例。私人 E 完整原件单列，不以回放代签 |
| D09 | [数学源与导出](../../contracts/math.md)、[数学工坊](../../features/math.md)：可编辑源、固定 revision、真实数学值、旧源兼容、保存视区、二维/三维/参数步骤与冷离线、外部 HTML 身份隔离 | C 的曲线数值、旧动态实际图形、HTML 恶意读取、新浏览器禁网 `file://`有有效判据。统一包只用 saved-plane-view，参数只读控件 output，没有断言 GGB 对象实际变化/开场视区，也没有三维离线引擎分支。建议补这些实际结果并以故障验证；不恢复所有旧布局/模板 |
| D10 | [公共保存](../../contracts/workbench.md#保存与恢复反馈)、[设备恢复](../../contracts/data.md#恢复层次与冲突)：原键原体、草稿基线、保存中继续输入、二阶段上传原文件重选、真实进程重启、恢复点冻结 | A 已保护服务端原子重放和恢复冻结。B 已读：题目普通创建未知与冲突刷新有保护，飞行中新输入、二阶段上传和真实新进程仍无代表，见 D20-D21。重复 JSON 写矩阵可压缩，上传原件/制作源导入/创建分配 ID 不能用单个普通 PUT 代签 |
| D11 | [身份页面](../../features/identity.md)、[I09](../../contracts/auth.md#昵称修改交换-i09)、公共浮层与各功能键盘规则：身份代次、完整响应正文超时、迟到回执不改新输入/新账户、取消不误提交、有效焦点 | B 已读：真实注册登录、激活前不挂载、退出未知锁和搜索浮层焦点有保护；S45、I09昵称迟到覆盖、完整body超时与删号设备清理未承接。至少对相异身份失败与历史异步覆盖保留主应用保护；不保留每个同形控件乘所有视口/主题的笛卡尔积。真实系统 IME 仍另验 |
| D12 | [助理](../../contracts/agent.md)：真实SDK、白名单、持久 journal、工具拒绝/停止/未知和提案显式逐槽保存 | A 初版覆盖同轮去重、拒绝、journal写失败、提案无隐式写入、无效工具参数。尚需最终核对 executing/prepared 中断恢复与停止原始规则，B 已保留提案点击前不写/点击后真实日程及跨首页侧栏，草稿发送快照和提案未决仍待最终核对；live 模型结果另验 |
| D13 | [班级](../../contracts/classroom.md)：Excel 字节判别、XLS/XLSX、缓存公式不执行、明确校对、原子确认、零分/缺分口径和固定原卷 | A 对正常 XLSX 及成绩/换班/冲突有真实保护；C 没有 XLS/加密伪装/坏缓存或真实班级固定原卷定位组。旧 workbook 和 paper 的格式/来源保证需明确归属，正常名册不替代。B 已保留真实名单/记录、XLSX校对及零分/缺总分呈现，独立失败接续待最终核对 |
| D14 | [资源](../../features/resources.md)与[材料正文/历史](../../contracts/materials.md#资源正文检索)：正文只跟当前文件与补充预览，失败不当零命中，查找/文字层/复制和多文件队列 | A 文件替换/历史关系和 C 成功识别正文各保护一部分。B 已读：资源只含成功PNG收录/元数据重开，没有PDF文字层或二阶段未知队列，见D21-D22；不重复全部格式乘全部 UI 操作 |
| D15 | [日程](../../contracts/schedule.md)、[日程页面](../../features/schedule.md)：月末闰日/全天 DST、例外原始身份、移动原子、提醒前后结算、系统时区和手势/键盘 | A 初版覆盖周重复、DST缺口、半开边界、事项移动、原提醒及账户时区迁移；月年规则/全天和失败结算等尚需按最终组核对。B 当前仅待安排转排期及事项完成重开，系统时区检测、真实拖动和保存乱序未承接。内部hook计数可由真实通知结果替代 |
| D16 | [工作台](../../features/workbench.md)、[单一目录决议](../../adr/0001-use-a-single-static-module-catalog.md)、[开发服务验收](../../acceptance/README.md#开发服务回归)：八分区主应用、隐藏不删资料、真实开发入口 | 构建和真实导航可替代造厂/目录映射全矩阵。固定生产 dist 不证明 Vite/StrictMode；按实际脚本保留一条开发服务主路径。学期/反馈外部接线及已删除设备管理界面不因旧测试恢复 |
| D17 | [网页 AI](../../features/math.md#geogebra-数学画布与网页-ai)与[扩展协议](../../../extensions/math-web-ai/README.md)：实际MV3、两轮回复、取消/更新不重发、旧连接失效 | C 三个实际扩展用例有独立判断，明确区分受控提供方和真实服务。B 只有未加入公式，没有主应用 CONNECT/安装/登录返回/迟到结果过滤，不能由自建 textarea 桥页面代签 |
| D18 | [当前题库成果](../../features/questions.md#用于教学与-ppt)、[当前数学成果](../../features/math.md#导出与课堂)与实际 `generateDocx`调用：不为没有产品消费者的旧输出保活昂贵测试 | 建议删除 C3 首例直接 `generateDocx`再`files.store`的回归。排除新增测试自身调用，基线与 C 候选的生成器消费者只剩 `fixtures/classroom/paper.mjs`，原产品备课消费者已在 `9e9edf6c`退役；保留输入生成工具及真实原卷消费。C3第二例题面PNG走真实HTTP，继续保留。未把“文件真实”当作产品导出能力 |
| D19 | [数学自动保存](../../features/math.md#内容试演与自动保存)：真实统一编辑器修改实际加入的内容，捕获完整图形源并保存重开 | B数学只测未加入公式，不创建任何已保存作品；A/C直接HTTP建源。删除UI提交或GGB flush仍可能全过。需一条真实加入公式/图形修改到自动保存与刷新实际对象读回，不重复C成果输出 |
| D20 | [保存中继续输入](../../contracts/workbench.md#保存与恢复反馈)：旧回执确认仅确认旧提交，新输入与原基线不能被覆盖 | B的题目未知创建例等待时未再输入。注入“成功回执覆盖当前editor”仍可能全过；需控延迟、继续输入、原键核实、再保存后读回一条链。日程独立autosave状态亦不能自动由题库代签 |
| D21 | [上传未知与重选](../../contracts/data.md#恢复层次与冲突)：二阶段multipart原件/业务条目各自未决，刷新后先校验原件指纹再用原键确认 | B资源只有正常上传，C直接HTTP无设备恢复。清掉pending原件/摘要可逃逸。需一条真实上传丢回执、刷新、错文件可纠正、原件原键接续，保留队列中已确认项不重复 |
| D22 | [资源正文与预览](../../features/resources.md#正文查找与复制)：浏览器实际多页PDF、文字层或命中页定位可用 | B只上传PNG，C只HTTP下载/Sharp和pdftotext。删除PDF.js浏览器消费仍可能全过。用一份真实多页PDF，经翻页并验证正文命中定位或可选择/复制的真实文字，保留不同于后端格式测试的判据 |
| D23 | [I08设备清理](../../contracts/auth.md#账户删除交换-i08)、[账户数据](../../contracts/data.md#账户永久删除)：明确危险确认，原请求204后才清理本账户设备原字节，另一账户与迟到结果隔离 | B没有删号UI，A只服务器删除。去掉IndexedDB清理仍可能全过。至少一条真实未知删除核实到设备原件消失/另一账户保留的链；不恢复已删除设备管理UI |

总控已接收 D01-D04 的四项 A 风险；D05-D09/D13/D18 的 C 侧风险已在读取 `6240946c`后交总控。B固定候选的D19-D23亦已交总控，均附可逃逸的具体故障理由。返工归原作者，D 不改测试或产品。此表开放项须在最终固定候选逐项判断：实际保护、另一组等价检出、明确退役/未开放或外部专项，不留无归属空白。

## 可以移除或合并的旧负担

1. 来源/身份/版本/幂等在多套 test-principal HTTP、真实 HTTPS、独立演示页重复的同一矩阵，收敛到真实应用 HTTP，加浏览器独有草稿/接线结果。保留至少一个越权/事务/未知结果等相异失败。
2. 逐项断言目录字段、工厂名、固定 handler 数量、完整迁移 ID 数组、同一个 Promise 对象、特定 SVG path 字符串等实现形状，用实际启动拒绝、对象保留、数学坐标或主应用入口替换。不能据此删去对应公开失败保证。
3. B12/R31 固定端口运行器、独立页面构建脚本和自制报告壳可退役；它们拥有的真实旧库/原字节保证迁入当前公共真实应用准备。固定 `6673f8d5` 的 A/B/C 均未消费 `scripts/first-flow/lib/runner.mjs`或`fixtures/materials`页面；两条链分别只剩旧first-flow harness/probe/broken和旧materials独立server/页面自引用。冻结旧源码压缩包、`legacy-source/extract.mjs`、原件/录制和扩展 0.1 快照需先核定新消费者，不与运行器一起删除。
4. 已退役备课/旧班级业务不恢复；其退役迁移和旧库还原不复活仍须保护。已移除设备管理 UI、未开放通用文本外部 AI、完整全模块助理工具不伪造为已实现。代码存在、文档现时态、旧专项路径都不改变当前开放事实。
5. 紧墙钟的逐帧采样不能定义动效是否正确。对确有长期价值的动画选择真实 transition/keyframe 与连续操作结果；无需把所有历史截图和每帧数量变为永久套件。

## 明确外部专项

| ID | 保留的验收与本轮边界 |
| --- | --- |
| EXT-E | 完整私人 E 原稿按样本索引获取并校验；普通固定页回放只证明消费者。本轮未下载私人材料，也未执行完整原稿专项 |
| EXT-OCR | 固定真实原页上的 GPU/MinerU 质量与性能。停止/清理等生命周期仍能在受控进程中自动验证，不能一起外推为 GPU 专项 |
| EXT-MODEL | 真实 Agent/网页模型授权、语言质量、精确线上接口与账单。受控SDK/DOM只证明当前消费和执行 |
| EXT-BRIDGE | 商店签名安装、Chrome/Edge实际自动更新和真实 DeepSeek 登录。开发扩展管理页重载没有证明商店发布 |
| EXT-BROWSER | 完整浏览器进程关闭后的 Cookie 持久寿命、BFCache/系统行为与掉电。普通页面 reload只证明新文档恢复 |
| EXT-DEVICE | Word/WPS修改保存重开打印、Windows/课堂平板/学校网络、真实触屏和系统IME。Linux Chromium的真实文件/事件回归不能代签 |

外部专项的当前边界沿[验证入口](../../acceptance/README.md)及[样本](../../acceptance/samples.md)。这些项继续列未验，不把未授权服务调用变成套件前置，也不把所有旧 CI 外用例自动归为外部专项。

## 第二阶段 A 固定候选独立实验

固定候选 `5f1565b9cdb28931bbe7af186b00621800eb85ab`；审计树正常merge为 `4bd66e9923e0c6ce04ffc50013ef0d4aa667211b`，无冲突。B/C返工不属于本次A实验结论。

独立执行 `npm ci`，然后A全部41例正常通过，0失败/取消/skip，日志 `d-a-normal.tap`。另从该固定root SHA用 `git archive`建立独立副本 `test-results/test-suite-rebuild/a-independent-5f1565b9`，复用本审计树锁定安装的root与workspace依赖；产品源码位于副本，原树和shared源码保持固定字节。副本新增10例正常通过，日志 `d-a-copy-normal.tap`，证明实验目录/依赖准备可用。A-R1至R5新增五文件均已逐行核对。对应新增保证的正常运行及下表代表性业务故障/移除比较已独立完成，返工发现A-R1至R5在此固定候选下通过；D01-D23的更广范围及后续组合仍按最终候选裁决。

每项只临时修改副本的具名API源文件，保存统一diff、精确node命令/退出码JSON和TAP，结束finally恢复并核对SHA-256。普通候选PASS、注入FAIL、移除组后的PASS/其他组FAIL分开记录。

| 实验 | 实际故障及完整A结果 | 移除相关组结果与价值判断 | 原始证据前缀 |
| --- | --- | --- | --- |
| A-E1 原路径兼容 | 当前旧操作的已确认请求错误规范为v2路径；41例中仅R31原路径回执断言失败，返回409 key-reused而应原201 | 移除 `legacy-questions.test.js`后40/40通过。同一个共用mutations原键测试不能代签跨版本路径兼容，保留此固定旧输入消费 | `d-a1-legacy-path` |
| A-E2 未来文稿 | 绕过存量可写保护；普通写200而应422，真实Agent工具confirmed而应rejected，41例中2例失败 | 移除 `document-protection.test.js`后39/39通过。证明存量未来内容需要独立保护，普通当前schema拒绝不等价；两条失败分别来自HTTP和工具入口 | `d-a2-future-documents` |
| A-E3 删除启动 | 重新引入 `de8bd99b`之前的真实历史缺陷：启动不调用已受理删除接续；41例中仅具名启动接续断言失败 | 移除 `deletion-startup.test.js`后40/40通过。正常删除/重复核实不等价于无Cookie的真实启动接续，保留 | `d-a3-deletion-startup` |
| A-E4 回执事务重叠 | 吞掉成功回执INSERT错误，业务仍提交并报成功；完整41例中题库保存与成绩确认各有1个具名503/200断言失败 | 单独移除saving或classroom仍被另一组检出，各为36PASS/1FAIL；同时移除后33/33通过。共享回执失败有重叠，不能签作两种独有守卫；两个文件仍分别有来源/账户保存和成绩/座位等独立保证，不能据此删整组 | `d-a4-receipt-atomicity` |
| A-E5 身份存储 | resolver把账户读取异常降为匿名；业务读返回401而应503，完整41例中仅新认证存储用例失败 | 移除 `identity-recovery.test.js`后37/37通过。正常身份到期拒绝不能代签存储未知状态，保留明确拒绝读取的代表 | `d-a5-identity-store` |
| A-E6 Agent去重 | 同轮等价已确认工具每次新建Operation；完整41例仅具名去重例失败，且失败SQLite中实际 `question_items=2`，不是只比较内部结构 | 移除 `agent.test.js`后35/35通过。共享HTTP请求幂等不等价于两个不同工具调用生成同一个逻辑提交，保留 | `d-a6-agent-dedupe` |
| A-E7 工作簿缓存 | 业务映射把无有效公式缓存改成0分；完整41例仅具名公式缓存例失败，读到0而应为null | 移除 `workbook-business.test.js`后39/39通过。普通XLSX成功输入和缺总分统计不能代签错误公式缓存解释，保留 | `d-a7b-workbook-mapping` |

首个工作簿尝试 `d-a7-workbook-cache`只改变原始读取值，实际业务仍由单元格type/display分支挡住，完整41例继续通过。该尝试未改变要挑战的业务结果，保留为未触发，不算检出，也不据此给套件报漏；随后A-E7直接在业务映射边界改变结果才有效失败。

A-E4确认公共回执持久失败有跨组重叠。保留saving综合例的当前理由还包括失败键可重用及冲突后服务器内容，保留classroom例的理由是成绩Result、Import确认态和成功回执在真实确认入口共同回滚/重试，检查模块是否真正进入公共事务。不能把同一公共故障两次红灯签成两种独有底座保证，也不能仅据共享故障删除包含其他业务保护的整文件。后续若进一步收敛，可把成绩确认状态一致断言并入同一保留链，而不追加新矩阵。

结束后对副本 `apps/api/src`及A测试共163个文件逐一比对固定候选字节，全部一致；原审计树无产品/测试diff。源码恢复清单与11个失败临时目录保留于 `d-a-restored-and-preserved.json`，每次补丁、完整命令及退出码JSON/TAP齐全。没有编译、fixture、skip或未定位超时被计为检出。上述结果暂限A固定候选，不宣称144项保证全部关闭或B/C完成。

## 第二阶段 C 固定6b70a35c独立实验

固定候选 `6b70a35c9a9d3ef5fa5593b2442b48fd77f7cacb`，审计merge `021e9adee16191e8ea48325e54f68878a609136e`。已读取C第二候选10个源码文件，证据 `c-revision-candidate-source.json`。A代码未变的独立证据复用，不重复A全套。

独立正常执行C全部22项，22 PASS、0 FAIL/取消/skip，约94.7秒，日志 `d-c-normal.tap`。从同SHA另建隔离副本 `c-independent-6b70a35c`，直接 `npm ci --offline`准备真实依赖；不是把开发树的符号链接目录塞入转换沙箱。该副本新增/受影响7项先独立通过，日志 `d-c-copy-normal.tap`；完整副本基线22 PASS、0 FAIL/取消/skip，90.1秒，证据 `d-c-copy-all-normal.tap/.json`。

运行工具使用SETUP既有的本机持久LibreOffice/Xpdf与Poppler/Bubblewrap，完整路径和命令记 `d-c-independent-workspace.json`。数学只读复用总控明确允许的同数学候选 `TeachBuddy-test-rebuild/apps/web/dist`，不覆盖它。GPU/systemd只在C-R2公开边界受控，实际本地进程仍运行；受控Paddle/自编表格结果不冒充真实GPU质量。

在6b阶段另确认两项具体缺口，后来均由C第三批补齐并独立复核，保留当时发现：

- C2原回放清单实际为 `paddleocr-vl-1.6/document-1`，自编表格也走旧 `parsing_res_list`；本地worker的typed输入仅纯text。当前生产 `mineru-pro-2605/document-6`的typed行内数学与table eq尚无真实官方录制消费者保护。须用一个官方D2/D8等固定raw代表承接，避免保留错误版本回放却宣称当前识别已经保护。
- C-R3已验证材料彻底删除后摘录与图片直接可读；个人包与备份还原尚无真实 `noteFragments`源删除链。沿原采用场景延伸一次导出/恢复核验，不另造收录矩阵。此项对应D05。

另核实旧数学迁移的实际输入：`math-static-migration`保存的是题目、fixture私有Document和原文件，启动数学后只检查公共历史及math_001一次；`math-integration-migrations`的数学旧库保存公式修订、旧回执和文件。当前math_001没有schema变换，A-R4承接真实早R31核心/题库升级和原路径回执，A固定退役前部署承接数学对象/文件恢复，C承接旧源真实数学消费。两个旧组合的全列/ledger重复矩阵退役；将来改变数学schema或兼容路由时，以保留冻结源专项再验早库。残余是没有每次长期比较两个历史组合的全部私有列与精确迁移行，不能说新库自动等价于早库。

固定6b的五项已完成独立故障与移除比较如下，C-E6增量结果另述。五项完整C22正常基线相同，故障只改副本源码且finally恢复。

| 实验 | 实际故障及完整C结果 | 移除相关组后的结果与裁决 | 证据前缀 |
| --- | --- | --- | --- |
| C-E1 转换网络隔离 | Bubblewrap增加share-net，实际自建loopback探针成功连接，owned server hits=1；22例中仅实际沙箱边界例具名ERR_ASSERTION失败 | 移除conversion-boundaries后20/20 PASS。正常格式转换无法替代宿主/网络执行隔离，保留真实沙箱探针 | `d-c1-sandbox-network` |
| C-E2 停止确认 | 去掉scopeEmpty确认，发出kill/stop即报停止完成；22例仅“未确认停止的本地进程阻止后续run，真实HTTP任务不能声称取消成功”失败 | 移除recognition-lifecycle后19/19 PASS。正常成功识别不能代签停止裁决，保留真实runtime/owned子进程例 | `d-c2-stop-confirmation` |
| C-E3 连续原页续题 | 禁止继承上一原页唯一未完题，教学表只生成1题而应2题；22例中仅C-R3具名ERR_ASSERTION失败 | 移除teaching-table-consumption后21/21 PASS。常规六题拆分与独立图文读取不能替代跨原页题目归属，保留一个正例和歧义反例 | `d-c3-table-continuation` |
| C-E4 实际数学对象 | 课堂滑杆只改output而不写入GGB，控件值仍正确但实际f(2)=4而应16；22例仅二维课堂包具名ERR_ASSERTION失败 | 移除math-artifacts后15/15 PASS。控件变化与成功导出不能代签真实数学状态，保留实际对象/视区/三维代表 | `d-c4-classroom-actual-value` |
| C-E5 扩展命令完整性 | 真MV3内容脚本读取代码时删掉乘号，命令变为f(x)=ax²；普通两轮及0.1升级后命令均具名FAIL，完整22中20PASS/2FAIL | 移除bridge.test.mjs后19/19 PASS。两处红属于同一代码完整性保证的重叠，不计两种独有价值；升级例仍保护版本/失效连接/不重发，与普通链相异 | `d-c5-bridge-multiplication` |

该固定6b候选的五项代表性实验已完成，所有故障均进入具名业务ERR_ASSERTION，未把编译/准备/skip/超时计为检出。结束对副本API、共享模块、C测试及扩展共192个固定文件逐字节复核，无差异，见d-c-restored-and-preserved.json。C后续typed/摘录带走恢复/80行PNG三文件增量已定点复核，未重跑未变22项的完整正常基线。

C增量随后在固定统一候选 `36f5bb1fe1598c2686acd092911eff34e0ed04a9`独立执行三文件，3 PASS、0 FAIL/取消/skip，13.42秒，日志 `d-c-increment-normal.log/.json`。该SHA相对6b70a35c的API产品/共享/扩展源码及C公共helper无差异，C测试仅上述三文件变化；复用未变22项和五个故障证据。官方typed/受控list、个人包取回与真正维护恢复、80行实际PNG全行数均已逐行核对，源快照 `c-final-increment-source.json`。新增typed代表故障消融已完成，见C-E6；其余新增判据独立正常通过。

C-E6最终typed补强：83下先正常1/1，再把typed table的eq改为普通text，官方通项/求和数学节点具名FAIL；移除mineru-typed-consumption后其他22/22 PASS（106.82秒）。正式命令/补丁/恢复见 `d-c6-final-typed-math`；早13版受native干扰的完整/移除日志仍保留为非业务异常，未当成多组检出或抹掉。官方document-6新消费需要独立代表，旧Paddle正常链不能代签。

Standards目录影响已实际验证：`d-a10-runtime-artifact-affected.tap`在原卷成员关系具名断言FAIL后，实验仓库相对 `test-results/runtime/rebuilt-business-AGET70/`保留 `workspace.sqlite`（integrity_check=ok）和两份原PNG。`files/blobs/6f56274f-c872-47d2-b874-1a953e80d646.blob`为320535字节I-1，`8dddde6b-8127-40ad-be38-a59ea50ba1fa.blob`为161865字节I-2，实际SHA同时匹配数据库metadata和固定原输入。完整绝对路径、命令与摘要见 `d-a10-runtime-artifact.json`。该相对路径落现 `ci.yml`的 `test-results/`上传项，且不在 `!test-results/ci/**`排除项；这是本地失败保留/路径选择实证，云端实际上传仍由总控CI验证。


## 最后A增量独立复核

最终业务候选13e16e在审计树三文件9/9正常通过（5新增加4个原日程例，8.62秒）；副本9/9（9.17秒）；Cookie四例在最终字节独立4/4（2.72秒）。A产品源码与5f1565b9无差异，故前七项故障证据复用。随后83fac6c0仅改变临时目录归属、C答案判据与B资源判据，三副本已同步；A新增三文件又9/9（9.33秒），新路径不改成功清理责任。

| 实验 | 具名业务故障与完整A46 | 移除相关文件后的结果 | 证据 |
| --- | --- | --- | --- |
| A-E8 停止意图 | 不持久记录用户stop，最终failed而应stopped，仅新增停止链FAIL | 移除agent-lifecycle后43PASS；83完整同步后相关3例1业务FAIL/2PASS，互补43PASS，正式证据d-a8-final-agent-stop | `d-a8-agent-stop` |
| A-E9 真崩溃恢复 | executing写恢复成cancelled，真实提交后SIGKILL重开应unconfirmed，仅崩溃例FAIL | 移除agent-lifecycle后43PASS；原unknown-journal例已预先unconfirmed，不能代签这一冷启动分支 | `d-a9-agent-crash` |
| A-E10 考试成员关系 | 绕过location所属原卷校验，同账户源外定位更新200而应422，仅考试原卷例FAIL | 移除exam-paper后45PASS。C文件/裁图校验不能证明考试source成员关系 | `d-a10-exam-membership` |
| A-E11 活跃删号等待 | 先物理擦除再await生产者settle，原业务行在SDK尚未结束时已消失，仅活跃删号例FAIL | 移除agent-lifecycle后43PASS。空闲成功删除/启动接续/页面设备清理都没有检出此活跃擦除顺序 | `d-a11-active-deletion-wait` |
| A-E12 全天DST | 全天结束错误按固定1440分钟，纽约DST日结束05:00Z而应04:00Z，仅新增日历例FAIL | 原首次移除有无关SIGSEGV，不算重叠或通过；83正式相关5例仅目标FAIL/4PASS、互补41PASS，d-a12-final-all-day-dst | `d-a12-all-day-dst` |

A-E8最初副本仅同步末批四文件，漏同步之前Cookie断言；在该批A-E8中间比较期间发现并补齐，此后A-E9至12的测试字节完整。该准备事实记 `d-a-final-test-sync-note.json`，旧日志保留；Cookie变化与Agent停止分支无关，但正式A-E8最终比较仍以完整同步后的固定字节复核为准，不混称首次全测试字节已一致。

## 浏览器B独立代表性对照

固定36f5bb1及只读web-reviewed正常完整23/23，169.48秒，`d-b-normal.log/.json`。36到13e16e的API/shared/Web产品和浏览器用例无变化，允许复用；83的资源首例增强后独立1/1（9.81秒），C答案增强独立1/1（8.05秒）。B隔离副本由固定归档建立并npm ci --offline物理安装，profile两例先正常2/2；后同步最终测试/helpers，保留每个构建的公开静态资产与源补丁，构建后先finally还原源码再跑浏览器，避免开发服务读入临时故障。

| 实验 | 实际故障及检出 | 移除组结果与判断 | 证据 |
| --- | --- | --- | --- |
| B-E1 历史迟到昵称 | 重新引入1b107651修复前的旧回执无条件publish，保留当前最终复核以不破坏场景gate。完整23中仅历史I09例FAIL，旧response.finished后旧账户昵称链接Actual1而应0；其余22PASS | 移除identity-race两例后21PASS。成功注册/设置刷新/服务器原键不证明同账户跨页旧回执不能发布，保留明确处理终点的历史保护 | `d-b1-history-profile` |
| B-E2 成功读取确认 | 反转7c5e11b9，把已被新读取淘汰的HTTP200也误当未确认，相关2例中I09的昵称编辑器仍1个而应0，另一身份对照PASS | 移除identity-race后其余21/21 PASS（162.43秒）。这与旧回执覆盖是两种根因，同一最小场景以明确终点分别检出，不计成两个必须维护的文件 | `d-b2-profile-confirmation` |
| B-E3 飞行中新稿 | 原键核实仍保持编辑态，却把较新的本机内容替换为旧saved；相关3例仅新稿例FAIL，题干Actual“计算7+8。”而应补写“并解释你的计算方法”，其他2PASS | 移除questions后其余20PASS。原键在服务端重放成功不能代签浏览器保留继续输入，保留这一数据丢失边界 | `d-b3-later-draft` |
| B-E4 原件原请求 | 正确重选原件时重新生成key，相关2例仅原请求key断言FAIL，PDF例PASS；失败SQLite中同名/同SHA原件有两个不同File ID，后一条duplicateOf指向前一条 | 移除resource-recovery后21PASS。不能只保留普通JSON未知重放而删掉原件阶段；同文件PDF例未检出该故障，仍保留浏览器文字层的独有保证 | `d-b4-upload-original-key` |
| B-E5 图形真实持久 | HTTP承认新图但SQLite当前作品保留前一图，实际新设备坐标Actual1而应2.4，具名“新设备必须读到实际手动修改后保存的坐标”FAIL | 移除math-persistence后22PASS。只看旧设备草稿/刷新会漏持久失败，新设备实际引擎数值保留；revision新值不等于当前作品已正确保存 | `d-b5-graph-persistence` |
| B-E6 删号设备字节 | 服务器204后设备清理空完成，真实IndexedDB仍有待删账户PNG及固定I-2 SHA，具名deepEqual FAIL，另一账户原件保留 | 移除account-cleanup后22PASS。服务器清表不能代签浏览器原始Blob清除，保留跨刷新原请求确认和设备字节结果 | `d-b6-device-erasure` |

B-E2至6按受影响文件和同一故障下的所有互补文件分别执行，相加覆盖当前浏览器23项；每例本身拥有独立数据，等价于全组分区运行。明确标记受影响/移除命令和数量，不用test-name skip充作检出。已有完整正常前置，不再重复PDF和日程作者已经有效挑战的故障矩阵。

## D01-D23裁决与验收边界

下表沿第一次1251f0ce集中源核对及最终83固定候选更新，逐项区分当前代表保护与非长期/外部残余。正常与故障证据按本报告唯一版本汇总读取，不能把历史动机或作者新增文件直接当作关闭。所有约定对照已完成，当前状态更新到独立实证或明确残余。

| ID | 当前承接与最小裁决 | 退役、按变更验和残余 |
| --- | --- | --- |
| D01 | A身份/Cookie与B S45正常已独立通过；A-E5存储不可读业务FAIL及移除PASS，B-E1/E2分别检出历史旧回执与成功复核误判。代表保护关闭 | 逐问题码乘每个表单、所有Cookie状态排列合并。完整浏览器退出后的寿命仍EXT-BROWSER |
| D02 | A-R2普通写/分类删除/Agent未来Document三入口保留，A-E2实际200/422及confirmed/rejected具名差异、移除39PASS。当前存量防损坏代表关闭 | 不保留每个schema字段或每种未知版本排列；未来输入必须保留原字节的边界继续保留 |
| D03 | 空闲删除/原请求、失败锁/无Cookie启动、活跃producer等待分别保留；A-E3与A-E11具名FAIL/移除PASS。B-E6设备真实字节清理具名FAIL、移除22PASS；服务端等待与设备清理分别关闭 | 重复全表计数/所有producer矩阵合并；不能把普通停止测试当作删号等待清除顺序的实证 |
| D04 | A早R31原路径/固定部署恢复与C旧数学源实际消费，A-E1具名FAIL/移除PASS。旧库核心/公开路径代表关闭，其余固定历史组合按右列专项 | math_001未做schema变换，两个旧组合的全列/ledger矩阵退役；数学schema/兼容路由变更时冻结早库专项。保留输入及最小提取工具 |
| D05 | C删源摘录直接读、真实个人包文稿/PNG/关系与维护备份恢复已独立正常；83 typed互补22亦包含此链PASS，A包/坏附件拒绝底座保留。关闭代表保证 | 个人包只带走，不能虚构ZIP账户导入；A普通包/维护损坏拒绝提供等价底座，旧摘录备份矩阵不逐项恢复 |
| D06 | 真实runtime/owned进程停止确认及取消超时迟到raw/图/显式retry保留；C-E2错误cancelled具名FAIL、移除19PASS，83互补执行仍PASS。受控协议代表关闭 | 停止协议可自动验证；真实systemd/cgroup/GPU释放与识别质量仍EXT-OCR。双路旧引擎比较退役 |
| D07 | A授权原件/历史/摘要、C真格式与恶意Office/真实namespace、B二阶段上传。C-E1实际owned loopback hits=1被检出；B-E4原键变化导致真实重复File。当前文件/隔离代表关闭 | files.store在共享mutations内先fsync/摘要/rename再写元数据并读回，DB失败遗留不可读孤立blob是保留策略，不要求“绝无孤立字节”。store持久顺序/维护策略变更时定点故障验证；不恢复格式乘所有I/O故障矩阵 |
| D08 | 原生W/P/Office、固定OCR、官方document-6 typed及明确受控list、教学表/歧义和80行PNG保留。C-E3续题、C-E6 typed eq具名FAIL/移除PASS；83答案差分和完整80行独立正常。关闭代表保证 | 真实模型质量和完整私人E仍外验；相邻高度、所有长表/巨公式及每种表头形状合并成代表。受控list不冒称官方raw |
| D09 | 实际SVG曲线、二维f(2)/保存视区/步骤、三维cube体积/坐标、历史源修正/恶意HTML/禁网冷开。C-E4对象数值FAIL、移除15PASS；非所有播放/模板都常驻。按右列边界关闭 | 各图形模板/内部SVG路径字串矩阵退役；目标平板/浏览器/打印EXT-DEVICE。数学算法或旧源解释器变更时选对应冻结专项 |
| D10 | A原键/事务/重启/恢复点冻结，B原键核实中新稿与二阶段原件跨刷新。A-E4事务共享故障有明确重叠，B-E3新稿/B-E4原件分别唯一检出。数据风险代表关闭 | 不重复每个模块的普通PUT/相同回执故障。导航、日程、题库各个独立列表回调的全部迟到排列不保留长期；改相应意图/代次/保存协调器时以历史90fec3a7/6e5413ed专项挑战，残余为未逐回调覆盖的显示乱序 |
| D11 | B S45、I09两页历史回执/并发最终复核/真实账户切换、退出未知锁和焦点独立正常。B-E1/E2各具名FAIL，移除同组其他21PASS。当前身份交接代表关闭 | 同形输入/所有视口主题排列退役；auth/api.js计时器覆盖await response.json且finally才清理，完整body挂起/畸形响应改为网络客户端变更时定点专项，仍有低频慢body不常驻回归的残余；真实IME外验 |
| D12 | A同轮去重/拒绝/journal未知/提案与新增两工具stop/真committed SIGKILL。A-E6去重、A-E8正式stop、A-E9恢复分别具名FAIL/移除PASS，B提案跨首页侧栏正常。关闭代表保证 | 29例工具/usage/同SDK结果排列合并；prepared/committed/result三检查点取真实提交后未记录结果代表。主应用助理停止按钮接线在Agent UI变更时定点验，服务器停止契约保留 |
| D13 | 真实XLS/XLSX/坏公式缓存、成绩确认事务/口径与PNG考试source/location成员关系。A-E7缓存、A-E10源外定位具名FAIL/移除PASS；新失败目录另有SQLite/两原PNG实证。关闭代表保证 | 三格式生成/原卷矩阵由C格式转换代签，考试成员关系不可代签。fixture-only generateDocx不恢复。具体公式缓存边界A-E7检出已成立 |
| D14 | A当前/历史文件关系、C真实OCR正文复用、B二阶段队列及PDF.js第二页真实文字层选择/复制。83资源首例以HTTP200和无草稿新设备核对真实保存。代表链关闭 | 元数据筛选与当前正文只选代表；每种格式乘查找/复制/页跳排列合并。正文索引失效重建/诊断格式在搜索或任务实现变更时验；不将失败当零命中视为正常 |
| D15 | A半开/DST/原实例/原子移动/旧提醒及月末/全天；B真实横纵拖动/拉伸/新设备/焦点系统时区正常。A-E12正式全天FAIL、移除41PASS。独立autosave的延迟排列明确转右列专项 | RRule所有频率/参数矩阵收敛一个非周规则装配代表。日程自有index.jsx applyResult以latest.content保留飞行输入、以payload更新baseline，区别于题库协调器；B当前正常autosave/新设备路径承接主接线，延迟保存/首次detach期间新输入改为该协调器变更时专项，残余不由题库红灯代签。afterChange内部hook次数退役，提醒事务调整时验证失败结算；真实触屏EXT-DEVICE |
| D16 | 真实startServer(dev:true)/Vite/StrictMode资源往返/题目刷新与生产主应用导航/平板入口独立正常；25个旧伪应用和固定端口runner退役。当前主入口代表关闭 | 25个旧伪应用/固定端口runner/私有开关退役。完整侧栏布局排列、每帧动效采样、导航定制手势改对应UI变更时验；EXT-DEVICE保留实际设备专项 |
| D17 | C真MV3两轮/精确代码/取消/重载/0.1升级+B真实工坊受控桥上下文/取消迟到均独立正常。C-E5乘号在普通/升级两处重叠检出，移除19PASS。两执行边界分别保留 | 两条链分属扩展与主应用，不能互相代签；线上DOM/真实登录/商店自动更新EXT-BRIDGE+MODEL。旧全部selector组合不常驻 |
| D18 | 已退役直接generateDocx后store的fixture-only昂贵回归；当前PNG/预览/授权下载仍保留，83答案差分/80行正常。关闭退役裁决，不声称可编辑Word产品导出 | 原件生成工具仅按可重建输入消费者保留；不宣称产品可编辑Word导出，不恢复备课 |
| D19 | B真实加入公式/点、真实鼠标拖动、自动保存/刷新及无设备草稿新context读坐标。B-E5已取得新设备实际1而应2.4业务FAIL，互补22PASS，source已恢复。编辑持久保证关闭 | 新设备避免设备草稿掩盖持久失败；不恢复每种图形/按钮矩阵。待独立正常/故障/移除 |
| D20 | B真实提交成功/迟到期间新输入、原键核实、继续保存与新设备唯一对象。B-E3编辑态保留但正文丢失被实际值断言检出，移除questions后20PASS。关闭 | 当前新稿与原提交分离保留；各控制项的相同原键矩阵合并。待独立故障/移除 |
| D21 | 多文件第一项确认、第二原件和条目各丢回执、错字节拒绝、正确原件原键接续。B-E4实际两个File ID同SHA证明换键重复存储，移除文件后21PASS。关闭 | 原件上传与JSON条目两阶段保留；不重复每种文件格式。待独立故障/移除 |
| D22 | 真实P.pdf浏览器翻第二页、鼠标选择Q3/Control+C/整页复制独立正常；后端pdftotext无权代签。已有正常与作者有效红，不重复独立故障矩阵，按明确浏览器代表关闭 | 后端pdftotext不能代签浏览器消费；格式乘所有PDF操作矩阵合并。待独立故障/移除 |
| D23 | 两账户真实pending Blob SHA、危险确认、未知删除至204、本账户清理/另一账户保留与迟到读取阻断独立正常。B-E6错误清理后仍有目标PNG及真实SHA而具名FAIL，移除后22PASS。设备字节独立保证关闭 | API普通删号不能代签IndexedDB；设备管理旧UI不恢复。待独立故障/移除 |

D03最后补项已由A的真实在途Agent链交付并独立验证：abort尚未settle时不能擦除业务/原件或回204；A-E11把等待放到擦除之后即具名FAIL，移除该文件其他43PASS。由一个producer代表等待职责，没有恢复Job/转换/个人包四种排列。当前没有剩余作者返工事项。

按变更验明确保留非长期专项和残余，不写成新套件会自动检出对应所有旧断言；本轮不再追加逐控件、模板或参数矩阵。

去留表另加三列集中裁决：`audit_decision`、`current_protection`、`residual_or_external`。路径别名A指 `apps/api/test/rebuilt/`，B指 `apps/web/e2e/rebuilt/`，C指 `apps/api/test/rebuilt-outputs/`，X指 `extensions/math-web-ai/test/rebuilt/`。每一旧入口仍保留原固定源、实际保证与独立理由，新三列把保留代表、删除的排列、按变更专项和外部残余逐入口说清。普通正常结果只证明列明代表，不能读成旧文件全部断言已被新套件自动检出。


## Node启动异常与有限诊断边界

固定13e16e业务故障批次发生三个无关异常，完整保留，不算业务检出或跨组重叠：A-E12移除schedule后D12子进程在检查点前SIGSEGV，期望SIGKILL，现场目录为空；C-E6完整故障中教学表维护restore子进程Command failed，非业务断言；C-E6移除typed后recognition-consumers整文件在1.17秒启动期SIGSEGV、没有该文件业务子测试。对应原始TAP分别是 `d-a12-all-day-dst-without-schedule.tap`、`d-c6-typed-table-math-full.tap`和`d-c6-typed-table-math-without-typed-consumption.tap`。A全天的目标FAIL和C typed eq的目标FAIL仍有效，移除结果暂不签PASS。

依据diagnosing-bugs并按总控要求，先固定三项可证伪假设，记录 `d-native-hypotheses.json`：H1为运行时/原生依赖import或初始化，预测无fixture产品import亦可复现；H2为并发资源条件，预测安静串行与有限并发有明显差异；H3为具体fixture提前执行，预测产品import稳定而support/真实fixture入口失败。先收集每个新建自有进程PID、stderr、signal、阶段，不读取非本实验core。不以skip、retries或删掉失败日志掩盖。

所有旧批次finally已恢复后，审计树合入83fac6c0为ee139b0；三份独立副本同步该固定根候选的当前相关源码/测试/helpers，元数据 `d-final-copy-sync.json`。该批产品源码没有变化。新目录helper及C答案/B资源断言均已作独立影响核验；旧/tmp失败目录继续原样保留，不伪称它们已迁入新CI artifact。

原core进一步仅以COREDUMP_CWD精确匹配D自有两个隔离副本，再按PID导出：269431为C restore、270467为A child、273650为C consumer。`d-native-owned-core-results.json`及对应gdb日志给出V8栈：Runtime_LoadPropertyWithInterceptor、LazyRegisterPrototypeUser/TransitionAndWriteDataProperty、MacroAssembler::TryLoadOptimizedOsrCode/BaselineCompiler/生成基线代码。没有栈直接指向better-sqlite3/sharp，不足以证明原生依赖无责或某一V8版本修复可解；原core独立保留，不读其他进程core。

最小对照固定结束：50个串行新Node仅产品import全到after-import；GDB串行实际recognition-consumers20次各2PASS；同一真实fixture直接入口固定3并发×30批90新进程全2PASS。三项结果和每个PID/stderr/退出率分别见 `d-native-product-import-results.json`、`d-native-fixture-gdb-results.json`、`d-native-parallel-fixture-results.json`。有限重复均未复现，不能据此关闭原三次SIGSEGV；不再增加盲重复或下载Node，后续交干净Runner条件核验。

依赖改写假设另查 `d-native-module-inodes.json`：A依赖链接审计root，B/C各自物理安装；三份better-sqlite3及sharp glibc文件inode不同、nlink均1。审计npm ci05:36UTC、B05:37、C05:14，异常05:48附近没有D npm ci/原生重建/同步.node操作。未支持“共享原生模块在加载时被改写”的时序解释。H1/H2/H3都尚无确定因果，保留原栈和目标环境残余，不给业务代码推测性修复或加skip/retries。

## 交付与总控接续

D的代表性对照、144入口裁决及新增影响复核完成。A12/C6/B6是24个具名故障对照，含共享保证重叠和同场景不同根因，不是92个当前测试逐条mutation，也不是所有旧断言等价全覆盖。未触发尝试、准备中间状态、native异常均单列保留，不计有效检出。

最终恢复检查、运行服务和精确归属路径见忽略证据 `cleanup-inventory.json` 与 `d-final-restoration.json`。原日志/补丁/截图/trace/失败SQLite/原件、新helper runtime及三份自有core导出保留。依赖、只读构建副本和实验源码可按固定SHA/锁文件/补丁重建；整体任务未完成，D没有提前删除它们或作广泛前缀清理。

总控按终稿作固定增量审查与干净CI。原三次Node SIGSEGV在本机有限诊断未再现，精确入口/core和退出率保留，云端正常稳定性及实际artifact上传尚待验证；新串行运行通过不抹掉原异常。D未发现其他待修产品/测试问题，不宣称CI、整体集成或正式发布已完成。
