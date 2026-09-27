# 当前状态与下一步

## 工作现场与授权

`/home/liam_t/项目/TeacherWorkspace-preview` 是集成树，用户体验服务直接运行此树源码。五个模块各保留现存 worktree 和 Codex session；原 `TeacherWorkspace` 的 main 和 AI/Agent worktree 不在本轮范围。当前分支、HEAD 与未提交修改用 Git 核对，不以文档快照代替。

用户授权总控读取五个会话、收发消息、协调任务和处理回到 preview 的集成冲突。本轮持续推进 OCR，先共用底层后模块使用链；支线不作为停止条件。公共文件由总控指定唯一写者，业务 session 使用自己的隔离实例。合 main、push、公开部署仍各需对应授权，不扩展全站外壳、文件回收或目标设备验证。

真实和临时实例的业务数据均为可丢弃测试数据，不以旧库/草稿保留或历史迁移作为前置。代码、未提交成果、固定测试输入和私有运行配置不属于可丢弃数据。接收会话回执使用等待通知，不定时轮询。

## 五模块共同基线

五模块手动功能及本轮 OCR 共用层、资源消费、备课采用、题库适配均已集成到 preview。OCR 集成代码为 `b50cb5e9`，共用结果修订为 `paddleocr-vl-1.6/document-3`；源码、契约和配置入口见[共用页识别](../contracts/workbench/recognition.md)。

题库、资源库、备课作者现场按本轮要求保留模块未提交 diff；这些成果已经纳入 preview，不能再当作遗漏补丁重复应用。它们还不是整树同步后的干净分支，后续派发先核对 Git 和本轮回执，保留成果后再决定同步方式。数学和班级本轮没有新增产品代码。preview 保留用户原有一条 AGENTS 未提交修改，不混入任务提交。

所有目录均位于 `/home/liam_t/项目/`。重新接手遵循[模块开发约定](../agents/module-development.md)，按负责模块阅读规格和本节当前边界。

| 模块 / session 名称 | Worktree | 当前能力与 OCR 结果 | 剩余边界 |
| --- | --- | --- | --- |
| 班级教学 / 班级教学专用 | `TeacherWorkspace-classes` | 记录搜索、课前回顾、公式图片、跨班移动；开发模式4项定向自验通过 | 无独立OCR入口；真实课堂设备仍待验 |
| 题库 / 题库专用 | `TeacherWorkspace-questions` | 原生双栏PDF；图片/扫描识别后校对入库，固定四图6题/5原有答案/3图；已有识别教学表分出练习/思考 | 例6隐式跨页续题、复杂跨栏及无明确表头仍需人工 |
| 资源库 / 资源库模块专用 | `TeacherWorkspace-resources` | 整理、文件历史、正文搜索和页内查找；OCR公式配图阅读、复制及搜索定位 | OCR不生成PDF文字层；复杂结构复制、精确拖选高亮仍有限；文件回收暂缓 |
| 数学 / 数学工坊管理 | `TeacherWorkspace-math` | 编辑、历史、几何和动态作品；独立核对OCR公式与裁图 | 无独立OCR入口；高级求解等为其他后续项 |
| 备课 / 聚焦备课功能模块 | `TeacherWorkspace-lessons` | 环节复用、混排、历史、资料包；扫描页校对后采用为可编辑环节，Word/PDF输出 | 不自动划分教学环节；空数值表可能仍为图片；目标Word/WPS另验 |

### 验证与边界

OCR 结果按“页识别、模块采用、完整自动录题”分别验收。以下实际使用链已通过，不能把固定输入通过扩大成任意扫描件无误或 C21 全部完成。

| 验证入口 | 结果 | 覆盖与限制 |
| --- | --- | --- |
| 最终修订真实模型 HTTP | 6页通过 | I1/I2/I3、规范化PS4图片、E.pdf原7/8页；累计54次模型运行含实验和失败，不含缓存读取 |
| 共用机制与数据 | 最终API5项、迁移14项、清理3项、来源保留4项、清理故障1项及Job回归4项通过 | 受控识别器与OS故障注入不代签真实模型质量 |
| 资源库 | 生产浏览器9项、开发重复初始化6项、HTTP7项通过；真实I1显示/复制/搜索/刷新通过 | 一次真实模型结果，后续读取复用；完整OCR文本不等于PDF原生选区 |
| 备课 | 真实I1识别、校对、保存/历史和Word/PDF通过；异常恢复浏览器7项通过 | Word为10个原生数学对象和1图；不是全设备/全格式验收 |
| 题库 | HTTP23项、API31项及真实四图/E教学表浏览器校对入库/刷新通过；总控HTTP23项复验通过 | 四图6题/5原有答案/3图；E练习与思考2题，原7/8页定位；例6未分配，任务保持partial；Q6裸公式经教师校对 |
| 总控跨模块 | 最终6页资源搜索/备课采用重读/个人ZIP来源保留通过 | API与ZIP验证；E7/E8可能命中PDF原生文字，其余四图确认OCR结果来源 |
| 数学独立核对 | 45数学节点、9派生图及后续表格参数核对通过 | 原始机器稿保留；最终E7/E8真实HTTP原始JSON与独立核对产物完全一致 |
| 集成与界面 | shared/API/Web构建通过；总控实际查看资源E7、备课E8及导入原稿 | 表格末句、公式、配图与原页号确认，浏览器无错误；不替代全产品验收 |

取消、重启、版本变化与迟到响应的恢复问题均已完成 Standards/Spec 两轴复审，0遗留项。模型运行有资源准入、单页隔离和强制超时；停止未确认时保留失败及证据，不误报取消成功。不同运行修订缓存隔离，旧结果仍可读取。实际大表格显存不足和表格底缘漏句已用公开参数修正并真实复验。

本轮入口为 `.scratch/ocr-mainline/shared-receipt.md`，最终共用与跨模块结果为 `final-shared-api.log`、`final-consumers.log`、`final-doc3-inspection.json`、`final-ui.json`；截图在 `test-results/ocr-mainline-integrated/`。各作者回执保存在其树 `.scratch/ocr-mainline/`，题库 `adapter-receipt.md` 与 `table-consumer-receipt.md`、资源 `resources-consumer-receipt.md`、备课 `implementation-receipt.md` 与 `review-recovery.md`、数学 `math-quality.md`。

此前五模块组合验证覆盖浏览器124项及API/集成159项通过、5项外部输入缺失跳过，证据见 `.scratch/five-module-integration/`。资源页内查找和资料包增量见 `.scratch/ocr-coordination/`。这些结果各自只覆盖具名代码和输入，不能代签本轮OCR或完整全产品。

### 运行实例与工具

`https://localhost:50880` 由 `teacherworkspace-preview.service` 直接运行 preview 当前源码，前端 Vite 热更新，API Node `--watch` 自动重启。数据库为 `.scratch/preview/data/workspace.sqlite`，文件为 `.scratch/preview/files`；登录、证书与邮件配置沿用已有实例。日常体验不依赖源码副本或 Web 构建产物，维护入口见[SETUP](../SETUP.md#已有本机实例)。

服务已加载本轮源码、两项新增数据库迁移及 `.scratch/preview/runtime.env` 的 `MATERIALS_OCR_HOME`。本机OCR工具在 `/home/liam_t/.local/share/teacherworkspace-tools/paddleocr-vl-1.6`；同级持久目录还提供 Xpdf、Pandoc 与 LibreOffice。OCR运行禁网，不自动下载权重或上传材料，准确条件见[本地页识别工具](../SETUP.md#本地页识别工具)。

实际50880已验证健康响应、Vite登录页、新资源识别源码、API进程工具路径和数据库结构，证据 `.scratch/ocr-mainline/live-preview.json`。真实登录后的OCR业务链在上述隔离实例验证，未冒称登录用户现有账户完成操作。实际实例未重建；题库教学表增量已加载。临时验证进程均已退出；固定输入、原始模型产物、验收证据和未完成复杂版式研究现场保留，继续处理下面的质量缺口。

## 已有能力与尚缺结果

| 范围 | 当前事实 | 未完成与下一动作 |
| --- | --- | --- |
| OCR共用与三个消费模块 | 本轮固定页、资源阅读搜索、备课可编辑采用和题库校对入库通过并进入preview | 优先解决下节具体质量缺口，不将全部自动录题写为完成 |
| 手动六模块 | 已集成五模块成果和具名组合验证 | 按[能力证据](#证据边界)限定声明，没有全部非Agent零缺口的证据 |
| 设置与帮助 | 导出、退出、账户主题/背景/头像、中文帮助已接线 | 语言、账户删除及其他边界见[设置规格](../features/settings.md) |
| 数据与恢复 | 个人资料包、误删恢复、维护备份/还原及身份撤销有本地切片 | 全范围恢复、第二设备和正式部署不能由局部结果代签 |
| UI/UX | 模块、设置、帮助已集成 | 等待用户整体体验反馈，不恢复全站外壳任务 |
| 产品 Agent | 首批实现及有限模型结果保留，F60设计冻结 | 全六模块工具未完整交付，整线暂停 |
| 目标环境 | 真人QQ邮件和个人Windows离线演示有反馈 | Word/WPS完整编辑/打印、课堂设备、iPad/学校网络及正式部署未闭环 |

## 本轮任务与接续

共用OCR和三个消费模块的使用链及教学表增量已进入preview。题库按明确表头拆出练习/思考，活动与点评留在未分配内容；真实PDF仅在同来源当前修订已有ready页且教学表结构明确时优先采用，不隐式增加模型调用。候选不完整及跨标题继承两个P2均经HTTP反例修复，Standards/Spec复审0遗留；实际E浏览器完成逐题校对、入库和刷新。数学已完成格式余项的只读核对，五session待命。模块源码仍按前述Git边界保留，不覆盖作者diff。

OCR后续关注以下具体缺口，标准见[自动提取](../research/c21-open-source-reuse.md#完整自动录题标准)：

1. E7/E8已有练习、思考两题正确分离，例6隐式跨页续文尚不能无歧义归并，保留未分配；没有可靠单元格bbox，仍按原表块定位。完整自动录题尚未通过，不能以2/3题可用替代例题跨页标准。
2. I3裸LaTeX、E8字面换行等格式问题仍需人工；E7空数值表保持图片，尚非可编辑单元格。原稿自身文字错误不算新增OCR错误。
3. 更多教师真实材料中的非标准题号、多栏、一题多图及答案册归属待验证。固定六页及本机参数不保证任意输入或其他设备。

先复现具体材料，再判断问题属于页解析、Document转换还是模块归并。共享缺陷由总控统一修复，模块只处理自己的语义；必要时可更换路线，不为坚持原方案反复修补。文件物理回收继续暂缓，不因支线或准备工作完成停止OCR主线，也不扩展[DAG其他产品线](mvp-dag.md)。

后续任务从对应模块[功能规格](../README.md#功能规格)和本轮回执进入；运行维护读[SETUP](../SETUP.md)，旧现场定位读[工作树恢复索引](worktree-archive.md)。

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
