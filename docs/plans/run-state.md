# 项目状态

本页保存当前能力、剩余事项、授权和证据入口。产品行为从[八个分区](../README.md#功能规格)进入，代码调用从[子系统](../subsystems/README.md)进入。既有结果只证明具名版本和范围，新候选按实际影响补验。

## 工作现场与授权

用户已授权实施本轮后端架构扫描的五项改进：数据生命周期所有权、静态装配真实依赖、题库版本兼容、数学成果制作及原始材料定位校验。当前记录在本机 `test-results/backend-architecture/current.md`，扫描报告同目录 `review.html`；实现基线为 `e4049906`。三条隔离工作线正在实施，尚未完成验收或集成；本轮保持对外行为与历史数据兼容，不扩展正式发布、外部模型或用户数据操作权限。

测试套件消融与重建已完成并由 [PR #52](https://github.com/DingJWuyu/TeachBuddy/pull/52) 集成：144 个旧执行入口逐行裁决并移除，新套件 92 项在干净 CI 全部通过，独立完成 24 项代表性故障与移组对照，Standards/Spec 无开放发现。四处实际产品缺陷已修复，preview 已同步核对，任务工作树、分支和确认归属的临时文件已清理；当前没有正在执行的测试重建任务。

此前的静态检查与复盘改进已完成，具名结果见[核查入口](#核查入口)。Knip/Oxlint、范围与 buffer 规则及 CI 失败产物分拆已接入；本轮没有重启全站体验清查。

七项已裁决体验修复及新一轮全站连续体验清查已完成并集成，见 [PR #51](https://github.com/DingJWuyu/TeachBuddy/pull/51)，具名结果统一在[核查入口](#核查入口)。产品、原型与相关文档已同步，preview 已核对，本轮临时工作树和分支已清理；当前没有正在执行的全站清查任务。界面参考从[设计输入](../design-system/README.md)进入，后续任务沿[开发约定](../agents/module-development.md)接手。

用户体验运行 `TeachBuddy-preview` 的集成源码，维护方式见[已有实例](../SETUP.md#已有本机实例)。GitHub 默认分支与日常 trunk 是 `preview/integration`，`main` 是稳定发布分支。用户已授权仓库配置、CI、任务 PR、独立审查、trunk 集成与同步；执行[GitHub 工作流](../agents/github-workflow.md)。未授权实际版本准备、合 main、产品发布、公开部署、新增费用或社区自动运营。模型与外部账户操作沿各自授权，本轮不扩展。

| 现场 | 当前安排 |
| --- | --- |
| `TeachBuddy-preview` / `preview/integration` | 集成及用户体验入口，保护私有配置和数据；当前分支与 HEAD 以 Git 核对 |
| `TeachBuddy` / `main` | 保留稳定分支工作树，不在本轮开发范围 |
| `TeachBuddy-resources` / `feat/resources-core` | 保留已有资源库现场；本轮不修改或删除，接续前核对其成果和负责 session |
| `TeachBuddy-backend-core` / `refactor/backend-architecture` | 本轮公共生命周期与静态装配实现及最终集成；完成五项、独立审查和 CI 后清理 |
| `TeachBuddy-backend-questions` / `refactor/backend-questions` | 本轮题库兼容与材料定位实现；未集成成果须保留，集成验证后清理 |
| `TeachBuddy-backend-math` / `refactor/backend-math` | 本轮数学成果制作实现；未集成成果须保留，集成验证后清理 |

下表能力已集成到 preview。根 [buffer](../../buffer.md) 仅保留用户暂缓的学期数据定义和反馈实际收件方式；此前已采纳的七项修复均完成。测试重建修复的题库冲突刷新、标签重复改名、日程横拖时间漂移与昵称成功误报已集成，版本与证据见[核查入口](#核查入口)。

总控管理公共文件唯一写者、工作树和集成。未提交成果、固定输入、私有配置和有效证据须保留；测试业务数据可按已授权范围处置。证据不充当运行依赖，换机从入库输入与[SETUP](../SETUP.md)重建。

## 开发基线

当前是一个应用和一个 SQLite 持久底座。五个业务模块注册后端并开放 Web 页面，班级 `classroom` 前端已消费现有接口。备课及旧班级教学 `classes` 已退役，公共文稿、文件、转换、OCR、日程及有效旧库升级能力保留。接口和装配事实见[代码结构](../subsystems/README.md#代码结构)。

本机运行 MinerU Standard Pro-2605 Q8 单路 OCR；旧机器结果可读，不自动重做。质量和剩余误读只按[选型验收](../acceptance/ocr-selection.md)描述。新检出所需样本、依赖清单和工具安装已入库，外部 E 原稿按[固定输入](../acceptance/samples.md#固定输入与回放)取得并校验。

## 能力基线


下表列出当前保留分区的能力基线。备课与旧班级教学均已退役并完成受影响范围验证；核查入口指向仓库中的规格、测试和具名结果，不代表所有目标环境均已验收。

| 产品分区 | 保留能力 | 核查入口 |
| --- | --- | --- |
| 账户与身份 | 注册、登录、找回、退出、会话恢复及永久删除账户；删除/退出未决核实、设备数据清理和注册竞态防护已接入；保留昵称修改公开能力与同会话资料同步；目标邮件与设备仍有未验范围 | [规格](../features/identity.md)、[认证契约](../contracts/auth.md)、[核查入口](#核查入口) |
| 工作台与设置 | 新版顶侧栏、导航分组/拖排/恢复、辅助栏、设置、主题/语言及中英帮助；导航偏好、头像与自定义背景按账户保存，设备开合独立，冲突和待确认布局可接续；昵称同步侧栏、邮箱只读，退出/删号/资料导出使用真实能力；学期与反馈暂缓，见 buffer | [规格](../features/workbench.md)、[核查入口](#核查入口) |
| 题库 | 手工与原生材料整理、校对入库、分类/笔记/改编；旧 DOC 经固定转换稿读取现存公式和配图，PDF 图边公式保留可编辑并核对配图归属；OCR 原图/公式/原答案/来源保留，局部校对保存，已核对题可先入库；未分配结构可明确归入题干、答案或笔记 | [规格](../features/questions.md)、[材料核查](#核查入口) |
| 资源库 | 收录/分类/检索、常用格式预览与下载、文件替换/历史、页内查找；标签颜色按账户保存，删除文件夹后资料归未分组；OCR 正文/公式/配图阅读、复制和搜索定位，内容疑点可高亮原页区域。搜索无匹配时保持简单空结果 | [规格](../features/resources.md)、[材料核查](#核查入口) |
| 数学工坊 | 同一作品的可编辑公式、二维/三维构造、参数和步骤；本地 GeoGebra、自动保存与历史、图片/源码/课堂 ZIP；Chrome/Edge 网页 AI 接入和更新接续，旧类型保持可读 | [规格](../features/math.md)、[模块核查](#核查入口) |
| 班级 | 名单、资料、座位与自由记录；正式考试、Excel 映射校对、题目标签、跨考试学生/班级统计与同场对照；原卷可选，姓名或学号至少一个，缺分保持未知、缺总分不排名。归档含归档上级下的条目，恢复先上级后子项；导出、恢复和删号已接入，班级 AI 工具未接入 | [班级规格](../features/classroom.md)、[班级验收](../acceptance/classroom.md)、[核查入口](#核查入口) |
| 日程 | 日期视图、拖选/拖动/拉伸、标签、全天、自定义重复与单次独立任务；开始/结束前后提醒、通知已读/未读、待安排、事项完成/排序/原子移动、跟随系统时区以及键盘确认已集成。界面任务永久删除，兼容软删除 API 保留；真实输入法另验 | [规格](../features/schedule.md)、[模块核查](#核查入口) |
| AI 助理 | 首页/辅助栏、会话管理、草稿、题库工具与题目/资源/日程引用使用真实接口；模型生成讲解安排、练习或变式提案，老师点击后保存并持久记录每项结果，未知结果沿原请求核实。旧设备历史、选择及已提交请求的核实保留，其他业务工具仍未开放 | [规格](../features/agent.md)、[点击执行契约](../contracts/agent.md#教学提案与点击执行)、[实现边界](../contracts/agent.md#四模块扩展契约) |

| 共享技术底座 | 保留能力 | 核查入口 |
| --- | --- | --- |
| 数据管理与恢复 | 个人资料包生成、下载与真实删除，删除取消生成并撤销下载，不删除业务原件；各模块误删恢复的公共支持、实例备份还原及旧身份撤销；恢复冻结覆盖助理提案点击执行，业务删除与恢复规则由所属分区拥有 | [数据规格](../features/data.md)、[核查入口](#核查入口) |
| 文件、材料与识别 | 固定预览、文件版本、转换及本地单路 OCR 已被题库和资源库使用；输入限制、校对与输出各按所属分区验证 | [材料契约](../contracts/materials.md)、[识别契约](../contracts/recognition.md)、[选型验收](../acceptance/ocr-selection.md) |
| 公共保存与模块装配 | 单一静态目录装配五个后端模块及五个 Web 页面；账户隔离、版本、幂等、冲突及资料导出只读端口沿公共约定 | [共享契约](../contracts/workbench.md)、[代码结构](../subsystems/README.md#代码结构) |

## 剩余事项

### GitHub 交付与首发准备

- 正式版本、目标服务器、域名、真实邮件、生产配置与备份目的地尚未确定，CD 未接入。根版本仍为 `0.3.0`；版本准备需用户指定完整目标版本，CHANGELOG 由工具生成。授权和步骤见[发布指南](../agents/github-workflow.md#准备与发布)。
- 首个用户版本只开放日程、其他模块占位的发布配置及首发验收尚未完成，当前完整开发界面不能当作日程先行版。

### 核心实现与已知质量缺口

| 事项 | 当前事实 | 下一动作与完成条件 |
| --- | --- | --- |
| 班级 AI 接入 | 教师页面及其既有后端链路已集成；班级 AI 工具仍未实现 | 按[班级规格](../features/classroom.md)在老师主动提问后读取正式数据；等待用户启动相应后端工作线 |
| 设备恢复后的用户接续 | 底座保留并隔离恢复前设备草稿和未决请求，主应用尚未接入查看、下载与对照后重新提交；旧设备管理设置入口已移除 | 保留[恢复保护要求](../features/data.md)，待相应业务设计接入；本轮只清除不可达旧 UI，不恢复被移除的设置 |
| AI 助理业务工具与恢复衔接 | 题库工具、资源/日程引用与点击保存提案已实现；其他完整业务工具未开放，部署恢复后的旧操作仍冻结，完整对照接续未实现 | 后续按用户选定范围及[Agent/数据判据](../acceptance/mvp-matrix.md)实施，不恢复退役模块或自动执行冻结操作 |
| 通用外部 AI 文本交接 | 预览提问、复制外链、粘贴/上传回流仍属范围，未接入通用界面；数学网页 AI 是独立实现 | 随 AI 助理恢复后推进，旧偏好字段不算完成 |
| 数学网页 AI 商店分发 | 本机 Chrome/Edge 安装识别、登录返回及更新接续有验证，商店包和材料已准备；尚无已发布条目 | 待开发者账号核验、真实联系与公开隐私说明、审核可访问入口；用户批准发布后验证商店安装和自动更新。正式域名确定后补扩展连接范围 |

### 本机已验证范围与边界


| 事项 | 已有证明与不足 | 应由谁推进 |
| --- | --- | --- |
| 辅助提取与局部校对 | 当前 MinerU 单路方案在冻结八页开发及四页留出中满足具名门槛；保留消费者的实际校对与使用按候选补验，成绩和修订量见[选型验收](../acceptance/ocr-selection.md)。原生 T/W/P 和题目提取继续由固定输入回归保护；原稿缺图不伪造补齐。识别完成不等于题目边界与活动归属全部自动完成 | 按[固定样本提取判据](../acceptance/mvp-matrix.md#extraction)核对实际材料。根式范围、选项标号、标题可能错漏，部分数学文本需补定界符；受损文字可能错读且不提示，不能承诺自动发现每处错误 |
| 常用文件预览与输出 | 最新工程集成 CI 已验证真实文稿/数学输出、离线打开及资源库常用格式逐页预览；可编辑公式、表格、插图的具体保护沿[核查入口](#核查入口)中的现行用例 | 真实 Word/WPS 编辑、保存、重开与打印仍按下节暂缓 |
| 数学、教学、身份与数据手工全链 | 既有固定版本的导航、资料包和备份往返有验证证据；班级退役及新后端的接口、原卷与恢复路径已验，完整手工教学工作日仍仅有固定旧版本证据 | 产品模型与 Agent 组合另验，完整手工工作日及目标环境按实际后续任务安排 |
| Node/V8 原生崩溃观察 | 测试消融期间本机出现三次 SIGSEGV，三份自有 core 与日志已保全；有界复现未再现，最终 CI 92 项全过，两轮云端均无同类异常。根因仍未定位 | 三次分别发生于恢复 CLI、Agent 测试子进程和识别消费者启动；core 显示 V8 内部栈，尚不能断定 V8 或原生依赖责任。再现时沿本机 `test-results/test-suite-rebuild/auditor-d/d-native-owned-core-results.json` 及对应日志接续，不声称已修复 |
| `fetch failed` 观察 | 本轮未复现，仍无原观察的明确触发条件和因果关闭证据 | 再现时记录入口、请求与环境；不据此认定当前已确认缺陷，也不声称已修复 |
| 数学保存超时观察 | CI 出现过一次保存请求 35 秒未收到响应；同输入渲染、重复本地原路径及最终 CI 均通过，原因未确定，未放宽超时或保存断言 | 再现时沿请求与服务端处理时序定位；证据在班级集成回执，不声称已修复 |

### 用户验收与待决定

| 事项 | agent 可先完成的工作 | 需要用户的部分 |
| --- | --- | --- |
| Word/WPS 编辑与打印 | 准备当前产品输出，核对本机内容、公式对象、页图与源文件 | 在实际软件修改、保存、重开和打印；按[人工Office样本](../acceptance/samples.md#人工-office-样本)记录结果 |
| 真实邮件送达 | 注册、登录和找回流程已使用真实认证与测试收件器验证 | 真实邮箱与投递环境由用户明确暂缓，不能以 fake-mail 的通过代替 |
| 课堂设备、平板与学校网络 | 准备实际下载的离线作品和可访问入口；定位有证据的产品/网络问题 | 在实际环境操作反馈。个人 Windows 曾有本机切片；iPad/学校网络尚未确诊，不写产品已失败 |
| 真实产品模型调用 | 数学统一制作已用真实 DeepSeek 完成起稿、读取手动改图和续改，证据及授权见上文；不等于全站 Agent 已验 | Agent 的真实调用随其工作线安排；数学网页 AI 不依赖全模块工具完成 |
| 正式部署与发布 | 依[SETUP](../SETUP.md#正式部署)形成可检查候选和验证结果；远端同步与 PR 按[当前协作授权](#工作现场与授权)执行 | 选择主机/域名，确认对应费用及合 main、公开部署/发布动作；已约定范围的完整发布授权不重复索取 |

### 可选增强与明确暂缓

以下属于能力边界或待选增强，不自动进入核心待办：任意裸 TeX 纠错、教学环节自动划分、所有极端版式无损转换、精确单元格框选、OCR 生成 PDF 文字层、跨页/语义搜索、通用几何约束求解、复杂三维和多参数动画。现有原页/区域定位若不足以完成实际校对，或常用材料必须大量重录，则按具体失败纳入核心缺陷。

数学网页 AI 连接扩展的实现方案值得继续深入优化，用户计划日后另行推进；具体优化范围尚未选定。首次连接引导及本机更新接续已完成；正式商店安装与自动更新仍是上表待完成项，不随此项暂缓。

受管文件物理回收继续暂缓；业务条目永久删除与磁盘回收不同。已由用户移除的设置入口、自动整套 PPT 及其他范围外能力不因旧文档或测试重新恢复，范围以[PRODUCT_SCOPE](../PRODUCT_SCOPE.md)为准。

## 接续顺序与完成条件

后续业务开发按用户选定的产品分区推进，需求明确后沿[当前任务记录](../agents/module-development.md#当前任务记录)维护范围、依赖与接续。日程体验保留；数学按[模块边界](../features/math.md#保存源与后续开发边界)接续；AI 助理扩展、真实邮件、Office 人工操作及目标设备等待对应条件或用户恢复。已授权且可复现的核心问题由 agent 沿真实路径处理，不把技术验证交给用户。

只有具名完成条件满足才改变状态：已实现、已集成和已验证分别记录；缺输入或环境写未验证，待用户取舍写待决定。新任务从核对的 trunk 创建现场，完成后按[集成清理](../agents/module-development.md#集成后的清理)收尾。

## 核查入口

选择当前模块的仓库内测试和固定样本重建结果；下表保留最近相关交付的证据入口，不代表全部在当前 HEAD 重跑。历史执行细节从固定提交或 PR 查看。缺少本机回执不妨碍新检出接手；真实模型、邮件、目标设备与 Office 人工操作不能由受控回放替代。

| 范围 | 已集成证据 | 可重建入口及边界 |
| --- | --- | --- |
| 测试套件消融与重建 | [PR #52](https://github.com/DingJWuyu/TeachBuddy/pull/52)，`fdf72f1b`；[最终 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/40649041101) 对应 `31b95156`，squash 后文件树一致 | 144 旧入口均移除，历史裁决随 PR 提交保留；API 45、输出及扩展 24、主应用浏览器 23 项全过，0 skip，静态/构建通过。独立 24 项代表性故障和移组对照，不宣称逐条 mutation 或全部旧断言等价覆盖；四处产品修复、双轴审查、preview 核对和清理完成。当前入口及外部验收边界见[验证指南](../acceptance/README.md)，本机原始证据归档 `test-results/test-suite-rebuild/` |
| 静态检查与复盘 | 代码候选 `583bff81`，基线 `5a69610f`；Standards/Spec 发现均已关闭 | 根静态脚本及 Knip/Oxlint 配置；独立检出干净安装、两项静态检查、共享/API 装配与 Web 源码构建通过，CI 配置通过 actionlint。冻结 OCR 输入与原摘要一致，buffer 两项保留；文档同步完整目标、检查覆盖、局部小问题及 CI 证据使用规则。未重跑产品全量回归、未改资产的冷构建或云端 CI；本机回执 `test-results/static-analysis-retro/root-receipt.md` |
| 七项原型裁决修复与全站连续体验复查 | [PR #51](https://github.com/DingJWuyu/TeachBuddy/pull/51)，`90fec3a7`；[最终 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/39594819440) 对应候选 `7a2ee40f`，squash 后文件树一致 | 七项既有裁决全部修复；本轮另确认并修复30项既存产品根因、3项原型独有问题，2项既存测试缺陷单列。产品与原型同步，当前原型构建可从检出重建，重复生成一致；无后端、数据结构或依赖变更。两轴独立审查及增量复核无开放发现。全工作区构建、284项HTTP/SQLite、51项真实输出、423项浏览器回归通过，2项缺私人E原稿跳过；首轮数学动效采样误报已定点修正，原用例、忙帧及4项负对照留证。本地按实际入口和状态分支对照双端，补验连续操作、异步切换、保存重开与跨模块往返。preview已同步，服务、匿名登录实页、变更组件及控制台已核对，未写私人业务数据。任务与覆盖记录、审查及有效证据归档本机 `test-results/experience-completion/`；临时数据、构建和工作树已清理。真实邮件、收费模型、实体设备、系统IME及Office人工体验仍沿具名边界另验 |
| 前一轮全站连续体验清查 | [PR #50](https://github.com/DingJWuyu/TeachBuddy/pull/50)，`6e5413ed`；[CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/39563243128) 对应候选 `754ee72a`，squash 后文件树一致 | 当轮去重确认35项既存发现并修复28项，7项原型共有体验随后已在PR #51完成修复；此前暂缓的学期与反馈收件不重复计数。Standards/Spec 在代码候选 `ce0b58a2` 的硬问题均关闭，后续只更新任务记录。全工作区构建、284项HTTP/SQLite、51项真实输出、387项浏览器回归首轮通过，2项因缺私人E原稿跳过；本地按影响补验连续操作、焦点、动效、尺寸与跨模块实际保存。preview已同步，服务、匿名登录实页及变更模块已核对，未写私人业务数据。覆盖清单、回执及有效证据归档本机 `test-results/experience-audit/`，临时工作树与分支已清理。原型与后端未修改，真实邮件、线上模型、Office及目标设备仍沿具名边界另验 |
| 原型功能收口 | [PR #48](https://github.com/DingJWuyu/TeachBuddy/pull/48)，`7725aa69`；[CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/39478174882) 对应候选 `adb016da`，squash 后文件树一致 | 全工作区构建、284 项 HTTP/SQLite、51 项真实输出、355 项浏览器回归通过；2 项缺私人原稿跳过。资源、背景、资料包、会话与提案、班级成绩和归档已接通；历史设备选择及已提交请求接续定点通过。Standards/Spec 无未关闭发现。preview 已同步、重启并核对真实登录入口及新模块，未写私人业务数据；证据在本机 `test-results/prototype-capabilities/`，临时现场已清理。学期、反馈暂缓，真实外部环境仍沿下方具名边界 |
| 全站原型对照 | [PR #49](https://github.com/DingJWuyu/TeachBuddy/pull/49)，`b20ad461`；[CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/39501334092) 对应候选 `9255745c`，squash 后文件树一致 | 全工作区构建、284 项 HTTP/SQLite、51 项真实输出、360 项浏览器检查通过；2 项缺私人原稿跳过。七个模块工作线及总控按页面、状态核对全部八个分区和公共外壳，修复呈现、交互与数据更新偏差；Standards/Spec 无未关闭发现。原型仅同步已裁决的上级先恢复，静态运行与构建入口已核对。两处旧测试的错误稳定态预期与动效采样已据实际失败修正。preview 已同步，服务、匿名登录实页及新模块已核对，未写私人业务数据；有效证据在本机 `test-results/prototype-parity/`，临时现场已清理。真实邮件、模型、Office 与目标设备仍按具名边界另验 |
| 命名与安装基线 | [PR #45](https://github.com/DingJWuyu/TeachBuddy/pull/45)，`afaf7880`；[CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38699507239) 对应候选 `0bdb426d`，squash 后文件树一致 | TeachBuddy 包、全工作区构建、274 项 HTTP/SQLite、50 项真实输出和 317 项浏览器检查通过；2 项缺私人原稿明确跳过。Standards/Spec 独立审查无未关闭发现。现有旧库升级、本机目录及服务、文件转换、OCR 固定环境和实际登录入口已验；数据库与附件保留，真实 GPU 推理和外部服务不在本次命名核对中重跑 |
| 工程闭环 | [PR #44](https://github.com/DingJWuyu/TeachBuddy/pull/44)，`872ab0cd`；[CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38690968669) 对应候选 `870ee1d0`，squash 后文件树一致 | 干净 Runner 构建、274 项 HTTP/SQLite、50 项真实输出、317 项浏览器检查通过；2 项因缺私人 E 原稿明确跳过。Standards/Spec 独立审查无未关闭发现。两位 fresh 作者完成真实代码中断接手及 8 项 HTTP 验证；独立安装与 GeoGebra 源码冷构建已验。preview 已备份、安装并重启，登录页面与迁移后的公共导入正常；真实模型、GPU OCR、邮件和目标设备沿专项另验 |
| 班级后端 | [PR #42](https://github.com/DingJWuyu/TeachBuddy/pull/42)，`614b7ee3`；[CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38422366903) | [班级验收](../acceptance/classroom.md)；HTTP/SQLite、真实 Excel/原卷、恢复与浏览器已验，班级页面和实际 AI 未验 |
| 题库核心体验 | [PR #40](https://github.com/DingJWuyu/TeachBuddy/pull/40)，`a53f2285`；[CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38387387677) | `apps/web/e2e/questions-ux.config.mjs`、`materials-question-notes*.test.js`、`materials-questions-output.test.js`；实际模型及外部原件按专项另验 |
| 账户与身份 | [PR #37](https://github.com/DingJWuyu/TeachBuddy/pull/37)，`de8bd99b`；入口 [PR #39](https://github.com/DingJWuyu/TeachBuddy/pull/39)，`2c43d63e`；[入口 CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38362936254) | `auth-completeness.config.mjs`、`auth-integration.config.mjs`、`fixtures/auth-contract/playwright.config.mjs`、`account-deletion.test.js`；全浏览器进程重启的 Cookie 生命周期、掉电与真实邮件未验 |
| 工作台昵称 | `1b107651` | `auth-profile.test.js`、`auth-integration.test.js`、`settings-implementation.config.mjs`；真实系统输入法和触屏未验 |
| 数学统一作品与网页 AI | [PR #36](https://github.com/DingJWuyu/TeachBuddy/pull/36)，`1c36e798`；[CI](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38219664891) | [数学验证](../acceptance/README.md#数学专项)；真实 DeepSeek 曾完成起稿/读图/续改，扩展回归另用受控网页。商店、目标设备未验；弹窗修复见 `math-unified-repair.spec.js` |
| 日程 | 产品候选 `22baf397`，集成 `da025690` | `schedule/playwright.config.mjs` 下的 capabilities、interaction、keyboard、consistency、time-zone 行为专项及日程 HTTP；固定旧版本的教学关联已退役，不属当前能力 |
| 材料与 OCR | 选型候选 `472eaf6a`，独立安装/开发服务 `170634b9`，消费者回归 `1b01b7e5` | [识别](../contracts/recognition.md)、[样本](../acceptance/samples.md)、[选型验收](../acceptance/ocr-selection.md)；真实 GPU 推理与 raw 回放分开，独立 clone 仍依赖宿主 OS/GPU 驱动 |
| 退役兼容与公共底座 | 备课 [PR #38](https://github.com/DingJWuyu/TeachBuddy/pull/38)，`9e9edf6c`；旧班级 [PR #41](https://github.com/DingJWuyu/TeachBuddy/pull/41)，`0a0a737e` | `lessons-retirement.test.js`、`classes-retirement.test.js`、`test/fixtures/retirement/`、`module-retirement.config.mjs`；保留当前恢复和升级测试，不恢复产品入口 |
| 发布基础设施 | [PR #27](https://github.com/DingJWuyu/TeachBuddy/pull/27)、[PR #28](https://github.com/DingJWuyu/TeachBuddy/pull/28)、[PR #32](https://github.com/DingJWuyu/TeachBuddy/pull/32)；[打包演练](https://github.com/DingJWuyu/TeachBuddy/actions/runs/38127024596) | 曾在独立目录下载校验、安装生产依赖、HTTPS 启动并验证备份准备；未正式打 Tag、Release 或部署 |
| 全部验证入口 | [验证指南](../acceptance/README.md)、根 `package.json`、`.github/workflows/ci.yml` | CI 仅覆盖其中明确选择的集合；文件实际打开、真实模型与目标环境按影响补验 |

表中历史用例名指向各行具名提交，相对 `apps/api/test/` 或 `apps/web/e2e/`，不保证仍存在于当前检出；当前可运行入口以[验证指南](../acceptance/README.md#模块与底座入口)及实际脚本为准。模块技术页链接准确源码与验证入口；完整产品交付再展开[验收矩阵](../acceptance/mvp-matrix.md)。

已有本机回执保存在 preview 的 `test-results/`：`design-system-ui-integration/root-receipt.json`、`teachbuddy-identity-integration/root-receipt.json`、`workflow-health-integration/root-receipt.json`、`agent-workflow-integration/root-receipt.json`、`classroom-backend-integration/root-receipt.json`、`questions-integration/receipt.json`、`identity-integration/receipt.json`、`auth-ui-integration/receipt.json`、`settings-nickname/receipt.json`、`math-integration/receipt.json`。退役回执为 `remove-lessons-integration/root-receipt.json` 与 `remove-classes-integration/root-receipt.json`；工程更新、两次退役和班级后端升级前备份位置分别在同目录 `preview-backup.json`。旧数学/日程交接在 `math-handoff/`。这些现存证据和私有备份独立保全，不作为安装、运行或必要回归的前置。
