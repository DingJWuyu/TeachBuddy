# 项目状态

本页保存当前能力、剩余事项、授权和证据入口。产品行为从[八个分区](../README.md#功能规格)进入，代码调用从[子系统](../subsystems/README.md)进入。既有结果只证明具名版本和范围，新候选按实际影响补验。

## 工作现场与授权

单人 agent 开发闭环的整体改造已获用户明确开工授权，全仓调查已完成，当前并行实施，按[完整目标、执行计划与完成判据](agent-workflow.md)推进。已有任务路由、子系统运行参考、代码标准、Lessons 和 CI 改进见[核查入口](#核查入口)，这些结果不代替全仓健康核查与新 Agent 实际交付、接手演练。

用户体验运行 `TeacherWorkspace-preview` 的集成源码，维护方式见[已有实例](../SETUP.md#已有本机实例)。GitHub 默认分支与日常 trunk 是 `preview/integration`，`main` 是稳定发布分支。用户已授权仓库配置、CI、任务 PR、独立审查、trunk 集成与同步；执行[GitHub 工作流](../agents/github-workflow.md)。未授权实际版本准备、合 main、产品发布、公开部署、新增费用或社区自动运营。模型与外部账户操作沿各自授权，本轮不扩展。

| 现场 | 当前安排 |
| --- | --- |
| `TeacherWorkspace-preview` / `preview/integration` | 集成及用户体验入口，保护私有配置和数据；当前分支与 HEAD 以 Git 核对 |
| `TeacherWorkspace` / `main` | 保留稳定分支工作树，不在本轮开发范围 |
| `TeacherWorkspace-resources` / `feat/resources-core` | 保留已有资源库现场；本轮不修改或删除，接续前核对其成果和负责 session |
| `TeacherWorkspace-workflow` / `refactor/agent-workflow-health` | 总控负责本轮工程改造；从 `71b6abf8` 创建，完成获准集成、验证与证据保全后清理 |
| `TeacherWorkspace-workflow-backend` / `refactor/workflow-backend` | API 职责与生命周期包，独立实现及定点验证，主任务集成完成后清理 |
| `TeacherWorkspace-workflow-frontend` / `refactor/workflow-frontend` | Web 公共能力、通知归属与失效代码包，后续业务会话包依赖它 |
| `TeacherWorkspace-workflow-validation` / `refactor/workflow-validation` | 夹具、脚本、依赖与 CI 包；与源码包交叉导入由总控集成 |
| `TeacherWorkspace-workflow-calendar` / `refactor/workflow-calendar-tests` | 日程验证按行为归并，保持原 CI 集合；完成集成后清理 |
| `TeacherWorkspace-workflow-native-text` / `refactor/workflow-native-text` | 原生文本规则实际实现/中断接手，沿[任务页](native-text-ownership.md)执行 |
| `TeacherWorkspace-workflow-questions` / `refactor/workflow-questions-session` | 题库业务会话归属，依赖已集成的前端公共包 |
| `TeacherWorkspace-workflow-resources` / `refactor/workflow-resources-session` | 资源收录/恢复操作归属，与既有 resources 业务现场分开 |
| `TeacherWorkspace-workflow-math` / `refactor/workflow-math-session` | 数学作品会话归属，保持编辑器与既有体验 |

账户、题库、数学、日程、班级后端及两次退役任务均已集成，其临时现场已清理。数学模块后续讨论由用户指定 session 接续，实际新现场以 Git 为准。AI 助理扩展暂停，班级前端与 AI 接入尚未开始；日程暂时保留用户已认可的体验。产品分区逐个打磨，不把旧任务授权延续成新增业务开发。

总控管理公共文件唯一写者、工作树和集成。未提交成果、固定输入、私有配置和有效证据须保留；测试业务数据可按已授权范围处置。证据不充当运行依赖，换机从入库输入与[SETUP](../SETUP.md)重建。

## 开发基线

当前是一个应用和一个 SQLite 持久底座。五个业务模块注册后端，四个模块开放 Web 页面；新班级 `classroom` 只有后端。备课及旧班级教学 `classes` 已退役，公共文稿、文件、转换、OCR、日程及有效旧库升级能力保留。接口和装配事实见[代码结构](../subsystems/README.md#代码结构)。

本机运行 MinerU Standard Pro-2605 Q8 单路 OCR；旧机器结果可读，不自动重做。质量和剩余误读只按[选型验收](../acceptance/ocr-selection.md)描述。新检出所需样本、依赖清单和工具安装已入库，外部 E 原稿按[固定输入](../acceptance/samples.md#固定输入与回放)取得并校验。

## 能力基线


下表列出当前保留分区的能力基线。备课与旧班级教学均已退役并完成受影响范围验证；核查入口指向仓库中的规格、测试和具名结果，不代表所有目标环境均已验收。

| 产品分区 | 保留能力 | 核查入口 |
| --- | --- | --- |
| 账户与身份 | 注册、登录、找回、退出、会话恢复及永久删除账户；删除/退出未决核实、设备数据清理和注册竞态防护已接入；保留昵称修改公开能力与同会话资料同步；目标邮件与设备仍有未验范围 | [规格](../features/identity.md)、[认证契约](../contracts/auth.md)、[核查入口](#核查入口) |
| 工作台与设置 | 导航分组、顺序和隐藏状态按账户保存；设备开合独立，冲突和待确认布局可继续处理；主题、背景、头像、语言及中英帮助和更新页已接入；昵称可原位编辑并同步侧栏，保存保持工作台现场，邮箱只读；退出、删号、资料导出消费相应能力 | [规格](../features/workbench.md)、[核查入口](#核查入口) |
| 题库 | 手工与原生材料整理、校对入库、分类/笔记/改编；旧 DOC 经固定转换稿读取现存公式和配图，PDF 图边公式保留可编辑并核对配图归属；OCR 原图/公式/原答案/来源保留，局部校对保存，已核对题可先入库；未分配结构可明确归入题干、答案或笔记 | [规格](../features/questions.md)、[材料核查](#核查入口) |
| 资源库 | 收录/分类/检索、常用格式预览与下载、文件替换/历史、页内查找；OCR 正文/公式/配图阅读、复制和搜索定位，内容疑点可高亮原页区域 | [规格](../features/resources.md)、[材料核查](#核查入口) |
| 数学工坊 | 同一作品的可编辑公式、二维/三维构造、参数和步骤；本地 GeoGebra、自动保存与历史、图片/源码/课堂 ZIP；Chrome/Edge 网页 AI 接入和更新接续，旧类型保持可读 | [规格](../features/math.md)、[模块核查](#核查入口) |
| 班级 | 后端名单、资料、座位与自由记录；正式考试原卷、Excel 映射校对、题目标签、跨考试学生/班级统计与同场对照；导出、恢复和删号已接入。前端页面及实际 AI 接入暂缓 | [班级规格](../features/classroom.md)、[班级验收](../acceptance/classroom.md)、[核查入口](#核查入口) |
| 日程 | 日期视图、拖选/拖动/拉伸、标签、全天、自定义重复与单次独立任务；开始/结束前后提醒、通知已读/未读、待安排、事项完成/排序/原子移动、跟随系统时区以及键盘确认已集成。界面任务永久删除，兼容软删除 API 保留；真实输入法另验 | [规格](../features/schedule.md)、[模块核查](#核查入口) |
| AI 助理 | 首批题库工具、对话及操作记录已接入；四业务模块扩展设计保留，开发暂停 | [规格](../features/agent.md)、[实现边界](../contracts/agent.md#四模块扩展契约) |

| 共享技术底座 | 保留能力 | 核查入口 |
| --- | --- | --- |
| 数据管理与恢复 | 个人资料包、各模块误删恢复的公共支持、实例备份还原及旧身份撤销；源码、快照和附件曾有本机验证，业务删除与恢复规则由所属分区拥有 | [数据规格](../features/data.md)、[核查入口](#核查入口) |
| 文件、材料与识别 | 固定预览、文件版本、转换及本地单路 OCR 已被题库和资源库使用；输入限制、校对与输出各按所属分区验证 | [材料契约](../contracts/materials.md)、[识别契约](../contracts/recognition.md)、[选型验收](../acceptance/ocr-selection.md) |
| 公共保存与模块装配 | 单一静态目录装配五个后端模块，四个现有 Web 页面开放；账户隔离、版本、幂等、冲突及资料导出只读端口沿公共约定 | [共享契约](../contracts/workbench.md)、[代码结构](../subsystems/README.md#代码结构) |

## 剩余事项

### Agent 工程改造

按[任务目标](agent-workflow.md)完成全仓代码与文档职责核查、可靠长程执行和验证交付机制、buffer 发现入口及真实接手演练。用户已确认完整目标并授权实施；进度和依赖统一维护在该任务页，不以本轮部分改动通过代替整体完成。

### GitHub 交付与首发准备

- 正式版本、目标服务器、域名、真实邮件、生产配置与备份目的地尚未确定，CD 未接入。根版本仍为 `0.3.0`；版本准备需用户指定完整目标版本，CHANGELOG 由工具生成。授权和步骤见[发布指南](../agents/github-workflow.md#准备与发布)。
- 首个用户版本只开放日程、其他模块占位的发布配置及首发验收尚未完成，当前完整开发界面不能当作日程先行版。

### 核心实现与已知质量缺口

| 事项 | 当前事实 | 下一动作与完成条件 |
| --- | --- | --- |
| 班级界面与 AI 接入 | 名单、座位、记录、正式考试及统计后端已集成；教师页面和班级 AI 工具未实现 | 按[班级规格](../features/classroom.md)设计原型并消费现有接口；AI 由老师主动提问触发，等待用户启动该线 |
| 设备恢复后的用户接续 | 底座保留并隔离恢复前设备草稿和未决请求，主应用尚未接入查看、下载与对照后重新提交；旧设备管理设置入口已移除 | 保留[恢复保护要求](../features/data.md)，待相应业务设计接入；本轮只清除不可达旧 UI，不恢复被移除的设置 |
| AI 助理业务工具与恢复衔接 | 首批只有题库工具；其余业务工具和恢复后旧操作完整处理未实现，设计不等于能力 | 保持暂停，恢复时基于当前模块端口及[Agent/数据判据](../acceptance/mvp-matrix.md)实施，不恢复退役模块 |
| 通用外部 AI 文本交接 | 预览提问、复制外链、粘贴/上传回流仍属范围，未接入通用界面；数学网页 AI 是独立实现 | 随 AI 助理恢复后推进，旧偏好字段不算完成 |
| 数学网页 AI 商店分发 | 本机 Chrome/Edge 安装识别、登录返回及更新接续有验证，商店包和材料已准备；尚无已发布条目 | 待开发者账号核验、真实联系与公开隐私说明、审核可访问入口；用户批准发布后验证商店安装和自动更新。正式域名确定后补扩展连接范围 |

### 本机已验证范围与边界


| 事项 | 已有证明与不足 | 应由谁推进 |
| --- | --- | --- |
| 辅助提取与局部校对 | 当前 MinerU 单路方案在冻结八页开发及四页留出中满足具名门槛；保留消费者的实际校对与使用按候选补验，成绩和修订量见[选型验收](../acceptance/ocr-selection.md)。原生 T/W/P 和题目提取继续由固定输入回归保护；原稿缺图不伪造补齐。识别完成不等于题目边界与活动归属全部自动完成 | 按[固定样本提取判据](../acceptance/mvp-matrix.md#extraction)核对实际材料。根式范围、选项标号、标题可能错漏，部分数学文本需补定界符；受损文字可能错读且不提示，不能承诺自动发现每处错误 |
| 常用文件预览与输出 | 最新工程集成 CI 已验证真实文稿/数学输出、离线打开及资源库常用格式逐页预览；可编辑公式、表格、插图的具体保护沿[核查入口](#核查入口)中的现行用例 | 真实 Word/WPS 编辑、保存、重开与打印仍按下节暂缓 |
| 数学、教学、身份与数据手工全链 | 既有固定版本的导航、资料包和备份往返有验证证据；班级退役及新后端的接口、原卷与恢复路径已验，完整手工教学工作日仍仅有固定旧版本证据 | 产品模型与 Agent 组合另验，完整手工工作日及目标环境按实际后续任务安排 |
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

当前优先沿[工程改造目标](agent-workflow.md)接续，后续业务开发按用户选定的产品分区推进。日程体验保留；数学按[模块边界](../features/math.md#保存源与后续开发边界)接续；AI 助理扩展、真实邮件、Office 人工操作及目标设备等待对应条件或用户恢复。已授权且可复现的核心问题由 agent 沿真实路径处理，不把技术验证交给用户。

只有具名完成条件满足才改变状态：已实现、已集成和已验证分别记录；缺输入或环境写未验证，待用户取舍写待决定。新任务从核对的 trunk 创建现场，完成后按[集成清理](../agents/module-development.md#集成后的清理)收尾。

## 核查入口

选择当前模块的仓库内测试和固定样本重建结果；下表保留最近相关交付的证据入口，不代表全部在当前 HEAD 重跑。历史执行细节从固定提交或 PR 查看。缺少本机回执不妨碍新检出接手；真实模型、邮件、目标设备与 Office 人工操作不能由受控回放替代。

| 范围 | 已集成证据 | 可重建入口及边界 |
| --- | --- | --- |
| 工程闭环与最近完整 CI | [PR #43](https://github.com/DingJWuyu/TeacherWorkspace/pull/43)，`27d3c515`；[CI](https://github.com/DingJWuyu/TeacherWorkspace/actions/runs/38620550697) 对应候选 `8ba14a72`，squash 后产品树一致 | 干净 Runner 构建、272 项 HTTP/SQLite、30 项真实输出、220 项浏览器检查通过，零跳过；两轴独立审查无未关闭发现，五模块只读接手演练通过。preview 已重启并核对入口与公共导入；真实模型、GPU OCR、邮件和目标设备沿专项另验 |
| 班级后端 | [PR #42](https://github.com/DingJWuyu/TeacherWorkspace/pull/42)，`614b7ee3`；[CI](https://github.com/DingJWuyu/TeacherWorkspace/actions/runs/38422366903) | [班级验收](../acceptance/classroom.md)；HTTP/SQLite、真实 Excel/原卷、恢复与浏览器已验，班级页面和实际 AI 未验 |
| 题库核心体验 | [PR #40](https://github.com/DingJWuyu/TeacherWorkspace/pull/40)，`a53f2285`；[CI](https://github.com/DingJWuyu/TeacherWorkspace/actions/runs/38387387677) | `apps/web/e2e/questions-ux.config.mjs`、`materials-question-notes*.test.js`、`materials-questions-output.test.js`；实际模型及外部原件按专项另验 |
| 账户与身份 | [PR #37](https://github.com/DingJWuyu/TeacherWorkspace/pull/37)，`de8bd99b`；入口 [PR #39](https://github.com/DingJWuyu/TeacherWorkspace/pull/39)，`2c43d63e`；[入口 CI](https://github.com/DingJWuyu/TeacherWorkspace/actions/runs/38362936254) | `auth-completeness.config.mjs`、`auth-integration.config.mjs`、`fixtures/auth-contract/playwright.config.mjs`、`account-deletion.test.js`；全浏览器进程重启的 Cookie 生命周期、掉电与真实邮件未验 |
| 工作台昵称 | `1b107651` | `auth-profile.test.js`、`auth-integration.test.js`、`settings-implementation.config.mjs`；真实系统输入法和触屏未验 |
| 数学统一作品与网页 AI | [PR #36](https://github.com/DingJWuyu/TeacherWorkspace/pull/36)，`1c36e798`；[CI](https://github.com/DingJWuyu/TeacherWorkspace/actions/runs/38219664891) | [数学验证](../acceptance/README.md#数学专项)；真实 DeepSeek 曾完成起稿/读图/续改，扩展回归另用受控网页。商店、目标设备未验；弹窗修复见 `math-unified-repair.spec.js` |
| 日程 | 产品候选 `22baf397`，集成 `da025690` | `calendar-emstudio`、`calendar-dialog-keyboard`、`calendar-capabilities`、`calendar-time-zone` E2E 配置及日程 HTTP；固定旧版本的教学关联已退役，不属当前能力 |
| 材料与 OCR | 选型候选 `472eaf6a`，独立安装/开发服务 `170634b9`，消费者回归 `1b01b7e5` | [识别](../contracts/recognition.md)、[样本](../acceptance/samples.md)、[选型验收](../acceptance/ocr-selection.md)；真实 GPU 推理与 raw 回放分开，独立 clone 仍依赖宿主 OS/GPU 驱动 |
| 退役兼容与公共底座 | 备课 [PR #38](https://github.com/DingJWuyu/TeacherWorkspace/pull/38)，`9e9edf6c`；旧班级 [PR #41](https://github.com/DingJWuyu/TeacherWorkspace/pull/41)，`0a0a737e` | `lessons-retirement.test.js`、`classes-retirement.test.js`、`test/fixtures/retirement/`、`module-retirement.config.mjs`；保留当前恢复和升级测试，不恢复产品入口 |
| 发布基础设施 | [PR #27](https://github.com/DingJWuyu/TeacherWorkspace/pull/27)、[PR #28](https://github.com/DingJWuyu/TeacherWorkspace/pull/28)、[PR #32](https://github.com/DingJWuyu/TeacherWorkspace/pull/32)；[打包演练](https://github.com/DingJWuyu/TeacherWorkspace/actions/runs/38127024596) | 曾在独立目录下载校验、安装生产依赖、HTTPS 启动并验证备份准备；未正式打 Tag、Release 或部署 |
| 全部验证入口 | [验证指南](../acceptance/README.md)、根 `package.json`、`.github/workflows/ci.yml` | CI 仅覆盖其中明确选择的集合；文件实际打开、真实模型与目标环境按影响补验 |

上述测试文件名相对 `apps/api/test/` 或 `apps/web/e2e/`。模块技术页链接准确源码与验证入口；完整产品交付再展开[验收矩阵](../acceptance/mvp-matrix.md)。

已有本机回执保存在 preview 的 `test-results/`：`agent-workflow-integration/root-receipt.json`、`classroom-backend-integration/root-receipt.json`、`questions-integration/receipt.json`、`identity-integration/receipt.json`、`auth-ui-integration/receipt.json`、`settings-nickname/receipt.json`、`math-integration/receipt.json`。退役回执为 `remove-lessons-integration/root-receipt.json` 与 `remove-classes-integration/root-receipt.json`；两次退役和班级后端升级前备份位置分别在同目录 `preview-backup.json`。旧数学/日程交接在 `math-handoff/`。这些现存证据和私有备份独立保全，不作为安装、运行或必要回归的前置。
