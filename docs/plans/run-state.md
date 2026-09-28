# 当前状态与下一步

## 工作现场与授权

`/home/liam_t/项目/TeacherWorkspace-preview` 是集成树，用户体验服务直接运行此树源码。五个模块各保留现存 worktree 和 Codex session；原 `TeacherWorkspace` 的 main 和 AI/Agent worktree 不在本轮范围。当前分支、HEAD 与未提交修改用 Git 核对，不以文档快照代替。

用户授权总控读取五个会话、收发消息、协调任务和处理回到 preview 的集成冲突。本轮持续推进 OCR，先共用底层后模块使用链；支线不作为停止条件。公共文件由总控指定唯一写者，业务 session 使用自己的隔离实例。合 main、push、公开部署仍各需对应授权，不扩展全站外壳、文件回收或目标设备验证。

真实和临时实例的业务数据均为可丢弃测试数据，不以旧库/草稿保留或历史迁移作为前置。代码、未提交成果、固定测试输入和私有运行配置不属于可丢弃数据。接收会话回执使用等待通知，不定时轮询。

## 五模块共同基线

五模块手动功能、OCR 共用层和三个消费模块已集成到 preview。共用结果修订为 `paddleocr-vl-1.6/document-4`；源码、契约和配置入口见[共用页识别](../contracts/workbench/recognition.md)。本轮补齐有界跨页续题、数字检测题、几何下标与换行恢复，以及配图中的表格独立识别和采用。

题库、资源库、备课作者现场保留模块未提交 diff；已纳入 preview 的冻结增量不能重复应用。数学的共用格式提交已纳入，题库授权拣入的公共提交也不属于待合模块差异。作者分支还不是整树同步后的干净分支，接续前先核对 Git 和回执，保留成果后再决定同步方式。班级没有本轮新增代码。preview 保留用户原有一条 AGENTS 未提交修改，不混入任务提交。

所有目录均位于 `/home/liam_t/项目/`。重新接手遵循[模块开发约定](../agents/module-development.md)，按负责模块阅读规格和本节边界。

| 模块 / session 名称 | Worktree | 当前能力与 OCR 结果 | 剩余边界 |
| --- | --- | --- | --- |
| 班级教学 / 班级教学专用 | `TeacherWorkspace-classes` | 记录搜索、课前回顾、公式图片、跨班移动；开发模式4项定向自验通过 | 无独立OCR入口；真实课堂设备仍待验 |
| 题库 / 题库专用 | `TeacherWorkspace-questions` | 原生双栏PDF；固定四图6题/5原有答案/3图；教学表例6跨页、练习和思考三题；检测页三题及首题双图，可核对入库 | 任意长题、复杂合并格、无明确范围及歧义配图仍需人工；表内定位限父表 |
| 资源库 / 资源库模块专用 | `TeacherWorkspace-resources` | 整理、文件历史、正文搜索和页内查找；OCR公式配图阅读、复制及搜索定位 | OCR不生成PDF文字层；复杂结构复制、精确拖选高亮仍有限；文件回收暂缓 |
| 数学 / 数学工坊管理 | `TeacherWorkspace-math` | 编辑、历史、几何和动态作品；共用格式恢复、公式与裁图核对 | 裸公式只做有界恢复；无独立OCR入口，高级求解另行安排 |
| 备课 / 聚焦备课功能模块 | `TeacherWorkspace-lessons` | 环节复用、混排、历史、资料包；扫描页及页内配图可识别为可编辑环节，保留原页和机器稿；表格可编辑并输出Word/PDF | 不自动划分教学环节或填空；复杂原版式及目标Word/WPS另验 |

### 验证与边界

OCR 按页识别、模块采用、完整自动录题分别验收。以下是具名输入的证据，不能扩大为任意扫描件无误或 C21 全部入口完成。

| 验证入口 | 结果 | 覆盖与限制 |
| --- | --- | --- |
| document-4真实模型HTTP | 9份输入通过 | I1/I2/I3、规范化PS4图片、E.pdf原7/8/9/10页及E7数值表配图；累计64次模型运行含实验和失败，不含缓存或回放 |
| 最终格式与图片 | 9份真实产物经最终转换回放通过，57数学节点、11图、22资产保留；11图逐像素等于原页矩形 | 模型运行与后续机械转换分开记证；保护代码、链接和不确定表达，不改raw、不补答案 |
| 共用机制 | 本轮总控7项HTTP/运行机制通过 | 包括格式恢复和版本隔离；既有取消、重启、来源隔离与存储证据仍按原范围有效，机制注入不代签模型质量 |
| 题库 | 作者最终HTTP57项及API31项通过；总控前一候选53项及最后范围修正11项通过 | 三条浏览器流程覆盖跨页三题、检测三题和四图六题，校对、入库、刷新通过；Q6无需重录下标；小结/报告不造题，明确表外题和答案仍保留 |
| 备课 | 作者API19项、恢复与采用浏览器9项、真实表格输出流程及24份Word/PDF输出回归通过；总控父子采用HTTP2项及实际表格Word/PDF输出1项通过 | 3×10表保留14空格，教师改一格后其余13格不变；双层来源、复制、历史、资料包有证据；不代签目标Office环境 |
| 总控跨模块 | 9份资源搜索及整页采用、配图独立采用，共10份备课及个人ZIP来源附件核对通过 | 最终机器稿重读与原稿保留；实际浏览器核对E9公式双图和数值表环节、原第7页及双层机器稿 |
| 集成与界面 | shared/API/Web构建通过，Standards/Spec两轴复审0遗留项 | 实際查看深浅色及窄屏截图、Word/PDF页图；具名流程无浏览器运行错误，不能代签全产品验收 |

E10两张调查表的数量与均值已对照原页；合并格疑点保留。新增9/10页来自同一公开E材料，不称跨教师泛化。原稿自身中文错误、Q2图文矛盾及页末截断照实保留，不计作已修好。

本轮证据入口为 preview `.scratch/ocr-quality/receipt.md`，实际模型计数在 `model-ledger.json`，原始产物在 `real-http/`，最终格式回放在 `final-http-r2/`，跨模块核验在 `consumers-final.log`；总控截图在 `test-results/ocr-quality-integrated/`。作者回执分别为题库 `.scratch/ocr-quality/e9/final-receipt.md`、备课 `.scratch/ocr-quality/receipt.md`、数学 `.scratch/ocr-quality/receipt.md` 及 `html-subtree-receipt.md`。模型质量、回放机制、作者自验与独立操作不得合并冒称同一次测试。

基础OCR运行、取消与资源消费证据见 `.scratch/ocr-mainline/shared-receipt.md`。此前五模块组合验证覆盖浏览器124项及API/集成159项通过、5项外部输入缺失跳过，入口 `.scratch/five-module-integration/`；这些固定范围不代签本轮或全产品。

### 运行实例与工具

`https://localhost:50880` 由 `teacherworkspace-preview.service` 直接运行 preview 当前源码，前端 Vite 热更新，API Node `--watch` 自动重启。数据库为 `.scratch/preview/data/workspace.sqlite`，文件为 `.scratch/preview/files`；登录、证书与邮件配置沿用已有实例。日常体验不依赖源码副本或Web构建产物，维护入口见[SETUP](../SETUP.md#已有本机实例)。

服务使用本轮源码、现有数据库结构及 `.scratch/preview/runtime.env` 的 `MATERIALS_OCR_HOME`。持久工具目录 `/home/liam_t/.local/share/teacherworkspace-tools/paddleocr-vl-1.6` 的清单与源码均为 document-4；本轮未换依赖或权重。同级持久目录提供Xpdf、Pandoc与LibreOffice。识别禁网、不自动下载或上传材料，运行准入与超时见[本地页识别工具](../SETUP.md#本地页识别工具)。

实际50880的进程、源码与工具配置核对保存在 `.scratch/ocr-quality/live-preview.json`。登录后的OCR业务验证使用隔离真实认证实例，不冒称操作用户现有账户。临时验证进程与重复工具副本完成后清理；固定输入、raw、验收证据和作者成果保留。

## 已有能力与尚缺结果

| 范围 | 当前事实 | 未完成与下一动作 |
| --- | --- | --- |
| OCR共用与三个消费模块 | 本轮固定输入及资源阅读搜索、备课可编辑采用、题库核对入库均通过并进入preview | 已知具体阻塞关闭；剩余复杂版式按下节真实输入逐项推进，不将全部自动录题写为完成 |
| 手动六模块 | 已集成五模块成果和具名组合验证 | 按[能力证据](#证据边界)限定声明，没有全部非Agent零缺口的证据 |
| 设置与帮助 | 导出、退出、账户主题/背景/头像、中文帮助已接线 | 语言、账户删除及其他边界见[设置规格](../features/settings.md) |
| 数据与恢复 | 个人资料包、误删恢复、维护备份/还原及身份撤销有本地切片 | 全范围恢复、第二设备和正式部署不能由局部结果代签 |
| UI/UX | 模块、设置、帮助已集成 | 等待用户整体体验反馈，不恢复全站外壳任务 |
| 产品 Agent | 首批实现及有限模型结果保留，F60设计冻结 | 全六模块工具未完整交付，整线暂停 |
| 目标环境 | 真人QQ邮件和个人Windows离线演示有反馈 | Word/WPS完整编辑/打印、课堂设备、iPad/学校网络及正式部署未闭环 |

## 本轮任务与接续

本轮OCR质量任务已完成并集成：跨页例题、裸几何下标和换行、数字检测题、图片中的空数值表、更多真实页均取得对应页解析与消费证据。五个模块session保留现场待命；后续开发先确认冻结增量已经集成，不reset作者diff或重复应用旧patch。

下一步优先在preview体验真实材料的完整路径：题库选择页并识别、核对疑点后入库；资源识别后阅读和搜索；备课从页或配图识别、校对、采用并输出。发现具体失败先保存原材料和重现步骤，区分页解析、Document转换、模块归并或输出问题，再统一分派共享缺陷。现有固定样本没有必须先更换OCR引擎的证据。

仍需具体输入推进的边界，标准见[自动提取](../research/c21-open-source-reuse.md#完整自动录题标准)：

1. 任意三页长题、非连续小问、无表头、复杂合并格、跨栏图文及多题末尾集中配图的无歧义归属。已通过的邻页续题和双图检测题不能代签这些情况；表内精确单元格定位仍缺原始坐标。
2. 任意裸TeX恢复、嵌套表格自动结构化、复杂文档无损编辑及教学环节自动拆分。当前保留原稿和疑点，数值表通过明确选图另行识别，不自动填空。
3. 更多教师材料、独立答案册及完整C21各入口，另有目标Word/WPS和课堂设备验证。固定9份输入只证明具名范围。

文件物理回收继续暂缓，不扩展[DAG其他产品线](mvp-dag.md)。后续从对应模块[功能规格](../README.md#功能规格)和本轮回执进入；运行维护读[SETUP](../SETUP.md)，旧现场定位读[工作树恢复索引](worktree-archive.md)。

## 证据边界

<details>
<summary>核查能力结论或固定输入时展开</summary>

下面概括上表结论所依据的具名结果，仅在核查能力声明或复用固定输入时展开。报告中的 PASS 只适用于其受测版本与范围。验证结果仅覆盖其实际候选和范围。

### 手动与界面

以下路径均可用 `git show 433e2116265b2e60152072aaf0dbc1fd6334785a:<路径>` 追溯；不要求普通功能任务先读回执。

| 能力 | 已有证明与限制 | 固定报告路径 |
| --- | --- | --- |
| 题库 | 作者 real-auth/fake-mail：手动、分类、原稿、取用；P.pdf 六题、五答案及三幅图为固定样本结果。DOC 为 limited，三份按页草稿和人工校对不证明六题自动无损。复杂多栏/扫描缺口仍在 | `docs/acceptance/evidence/MANUAL-QUESTIONS/v1/receipt.md`、`continuation.md` |
| 资源、备课混合流程 | independent：真实 PPTX 预览、取题/资源/作品、重排、逐处更新、学生 Word/PDF、重启新浏览器重开。MF-UI-01 嵌套预览经定向复验关闭；不是八格式/十二输出全矩阵通过 | `docs/acceptance/evidence/MANUAL-FLOW/v1/acceptance.md`、`recheck.md` |
| 数学手动 | independent：公式/图形/动态、源码/HTML、离线及往返具名切片；非空稿替换保护经复验关闭。不能代签完整 M44/课堂环境 | `docs/acceptance/evidence/MANUAL-MATH/v1/independent.md`、`independent-fix.md` |
| 教学时间 | 作者主链及内部审查：班级记录、进度、周重复、例外、提醒、题/课/作品关联；内部审查不是整阶段独立使用 | `docs/acceptance/evidence/MANUAL-TEACHING/v1/receipt.md`、`review.md` |
| 数据恢复 | independent：个人包、误删恢复、维护备份还原、身份撤销；上传原文件取回复验。不能由旧支持页证明当前设置仍显示恢复 UI | `docs/acceptance/evidence/MANUAL-DATA/v1/independent.md`；`MANUAL-SUPPORT/v1/independent.md`、`recovery-independent.md` |
| 六模块 UI | independent 定向页面、编辑器、取材及渐进交互；不是全产品回归 | `docs/acceptance/evidence/UI-MODULES/independent.md` |
| 设置/帮助 | 作者具名构建及 4/3 条真实隔离 E2E；纯 UI 预览项未计后端完成 | `docs/acceptance/evidence/UI-SETTINGS/status.md`、`UI-HELP/status.md` |

### 专项边界

- 认证的 real-auth/fake-mail 独立结果：`aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md`。接口源版本由[认证契约](../contracts/auth.md)维护，恢复操作见[数据管理](../features/data.md#部署备份与还原)。
- 完整材料缺口：`efd3b071a603d38902688b0b4dd68289e8516c69:docs/acceptance/evidence/R35/v1/local-review6.md`；OBS-001/002 仍未以因果证据关闭，原观察为 `880e6e68be0855b3289dea8db3c87e8c67bc1042:docs/acceptance/evidence/R34/v1/restart-diagnosis2.md`。
- 全六模块 Agent 的有效设计输入由[扩展契约](../contracts/agent.md#六模块扩展契约)维护。首批具名结果 `6d48bc7f214a6b27e51b3a8cbdfa6cffc212f4d1:docs/acceptance/evidence/C27/v1/math-recheck.md` 不证明完整工具已交付。

`SHA:路径` 使用 `git show <SHA>:<路径>` 读取；过程记录不再复制到当前文档。

### 真人与目标环境

原始记录在 `.scratch/worktree-consolidation/human-acceptance-20260922.md`，SHA-256 `5c09e0cd73facb2c4b9b07394f427bbaa09a5db9a580bf2779917943d28ea65c`；定位旧现场才读[恢复索引](worktree-archive.md)。

- 目标 Word/WPS 的完整编辑、重开及打印尚未闭环；本机输出或具名人工小样不能代签全部输出。可用输入与核对方法见[人工 Office 样本](../acceptance/samples.md#人工-office-样本)。
- 个人 Windows Edge/Chrome 断网冷启动具名切片通过，课堂设备仍未测。
- 用户真实 QQ 收件、注册、找回及新旧密码验证通过；预览邮件曾受代理影响，用户已自行解决，不因此重改整机网络。
- iPad/学校网络不可达尚未确诊，暂缓目标验证；不能写为产品已 FAIL 或 PASS。
- 正式主机/域名由用户后续选择，暂无部署交付；不采购、不付费、不发布。

</details>
