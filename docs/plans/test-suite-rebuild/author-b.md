# 作者 B - 用户流程重建

状态：D19-D23五项及D11/D15/D17补强完成作者验证，等待独立验收。I09处理终点补强另检出同会话复核被淘汰后误报未确认的实际缺陷，已按授权局部修复。17/17历史回归通过，第三批仅定点运行变化场景；D15另检出并修复真实拖动偏移。执行者 `gpt-6.1-sol / medium`。工作树 `TeachBuddy-test-browser`，分支 `test/rebuild-browser`，空套件基线 `992172141f6664d4d851154cc533428414051c42`。独占 `apps/web/e2e/rebuilt/` 与本记录；产品缺陷先交总控协调。初版未读取旧测试断言；独立挑战阶段按总控授权读取相关历史修复作可证伪挑战。

## 最小保护清单

均运行真实主应用、HTTP 和隔离持久数据；浏览器 context 各自独立。API 规则由 A、文件字节/数学成果/扩展由 C 验，B 检验实际 UI 接线和接续。下表按独立故障组织候选组，不以页面或按钮数计量。

| 候选组 | 当前需求出处 | 可见故障及唯一风险 | 首选层与依赖 | 不自动化的边界 |
| --- | --- | --- | --- | --- |
| 身份交接与切换 | features/identity.md 状态接线；contracts/auth.md；features/workbench.md 设置 | 登录激活前挂载业务；退出未知却放行业务；换账户显示上一账户内容或迟到结果 | 主应用浏览器 + 真实认证/SQLite，隔离测试邮件；定点拦截延迟或响应丢失 | 真实邮件收件、跨设备 Cookie 行为由目标环境验 |
| 工作台与支持入口 | features/workbench.md 整体结构/滚动与支持页面/设置 | 八分区入口不可达、辅助栏替换现场；设置偏好只在本机生效；弹层关闭焦点丢失导致键盘无法接续 | 浏览器，真实导航/偏好接口，宽屏与平板窄屏；一次关键弹层连续 Tab/Escape | 不逐颜色/每帧断言，不把截图差异当行为需求；真实触屏另验 |
| 题目编辑、改编和往返 | features/questions.md；contracts/workbench.md 内容与对象/保存与恢复反馈 | 保存后刷新丢内容；改编污染原题；打开来源再返回丢草稿或筛选 | 主应用浏览器 + 真实题目/文稿操作；通过 UI 创建、改编、重开 | DOCX/图片/识别正确性归 C，API 权限和字段矩阵归 A |
| 保存结果未知与冲突接续 | contracts/workbench.md 写入冲突与未知结果/保存与恢复反馈 | 响应丢失后重复创建；新输入被旧回执覆盖；冲突自动覆盖服务端 | 浏览器 + 真实写入，提交成功后丢弃单个响应；第二 context 制造真实版本冲突 | 不重复逐模块同一 transport 规则；选择实际编辑入口保护共用机制，模块特有行为另列 |
| 资源整理与跨模块引用 | features/resources.md；features/questions.md；features/agent.md | 上传即跳详情；文件夹/标签修改后刷新丢失；引用打开返回丢当前编辑现场 | 主应用浏览器 + 真实小文件上传及资源 API，预览/内容输出由 C 验 | Office 渲染、真实 OCR、文件格式字节归 C |
| 数学制作 UI 接线 | features/math.md 一个作品/内容与试演/自动保存 | 空白退出生成垃圾；未加入输入在切模块或刷新时丢失；辅助栏关闭无法回画布 | 主应用浏览器，固定本地运行时；只验证输入、离开保护及保存/重开 UI | 数学对象正确性、文件输出、网页桥归 C；不重复完整制作/导出链 |
| 班级资料、记录与成绩入口 | features/classroom.md；contracts/classroom.md | 学生/记录保存重开丢失；换座改变记录归属；成绩未知/零分呈现混淆；考试入口或校对无法到达 | 主应用浏览器 + 真实班级 API，小型真实工作簿仅作 UI 导入输入，与 C 协调 | 统计组合矩阵归 A，工作簿解析与原卷字节归 C；不自动化每个图表像素 |
| 日程安排与返回 | features/schedule.md；contracts/schedule.md | 安排/事项保存刷新丢失；重复单次操作误改整组；提醒返回落错对象 | 主应用浏览器 + 真实日程 API，固定业务日期但保持动效时钟 | 操作系统通知、真实时区切换另验；重复/提醒算法矩阵归 A |
| 助理首页与业务辅助栏 | features/agent.md；contracts/agent.md；features/workbench.md | 同一对话在首页/侧栏断开；引用或建议未接线；未确认执行被显示成功，失败无恢复 | 主应用浏览器 + 真实 SSE/journal，受控本地模型替身；同一对话跨模块往返、一次确认执行 | 不调用收费模型，不以替身证明语言质量或远端服务可用 |

## 实施与验收

总控确认跨线归属和公共构建/服务准备后实施；优先每个独立保证一个聚焦场景，允许一个场景覆盖同一用户任务的保存和重开。辅助准备留本目录，根配置/CI 由总控接入。新场景须实际运行；代表性故障通过运行中的真实响应丢弃或定点源码故障验证红结果，证据写 `test-results/test-suite-rebuild/`。失败、未验和已通过分列；独立消融与双轴审查不由作者自签。

## 候选与接入

专属 Playwright 入口为 `apps/web/e2e/rebuilt/playwright.config.mjs`，13 个场景分布于七个 spec。根 CI 可选择 `rebuilt/**/*.spec.mjs`，消费本配置的 `use`、`expect` 与 timeout；每个场景自行启动公共 HTTPS 应用，独立端口、数据库、文件目录和 context，可由根配置控制 worker。只需统一设置 `WORKBENCH_WEB_DIST` 指向同候选构建，无服务/账号预热前置。失败保留应用数据，成功清理应用数据；截图、trace、诊断和运行日志沿验收产物保留。`BROWSER_RUN_ID` 只区分证据目录，不改变产品行为。

| 场景文件 | 唯一主要保证 |
| --- | --- |
| identity-shell | 激活确认前不挂载业务；退出/异账户隔离；退出未知结果锁定与原目标核实；偏好服务端读回；搜索浮层归焦和键盘重开；平板入口与页面无横向溢出 |
| questions | 改编副本独立、跨模块草稿与新设备读回；真实已提交创建丢响应后的原键原体确认及列表唯一；多页真实版本冲突跨刷新继续处理 |
| recognition | 真实 I-1 原图上传、固定识别回放、查看疑点位置与人工校对、入库和刷新重开；数学正文/字节完整性由 C 保护 |
| resources-math | 上传成功留列表、资料名称/备注保存重开、原件入口；数学未加入输入切模块/刷新保留和返回取消 |
| classroom-schedule | 班级学生与完整自由记录保存重开；日程待安排转定时任务、事项完成状态、新设备读回与键盘确认 |
| classroom-import | 真实 XLSX 经对应列和校对后入库；成绩页刷新仍将零分与无总分/无排名分别呈现 |
| agent | 真实 pi runtime/SSE/journal 消费受控模型提案；首页和业务侧栏同一对话；点击前无日程写入，点击后可核实并刷新 |

无断言准备依赖：公共 `apps/api/test/support/application.js`；`apps/api/test/fixtures/c26/provider.js`；根 `test/fixtures/questions/recognition/replay.mjs` 及固定原图。首次研究时读过旧注册/退出 helper 中的准备等待断言；未读取旧 spec 或 Git 历史断言。没有复制旧测试组。

## 产品缺陷与诊断

独立产品修复提交 `c0391858` 只修改 `useQuestionSession.js`。真实入口为：同账户两页打开同题，各自编辑，另一页先保存，本页保存收到真实版本冲突，刷新本页。修复前草稿存在但对照和采用入口消失，违反共享保存恢复契约。

按 diagnosing-bugs 先收紧具名 E2E 断言，再列三种可证伪原因：初始化遗漏冲突恢复、加载竞态清空、草稿版本丢失。`conflict-reproduction` 与 `conflict-probe-versions` 稳定红；后者 trace 的 `conflict-versions` 附件显示本地基线 1、服务端 2。结合初始化源码没有建立冲突，而前台刷新已有版本比较，确认是初始化遗漏。修复在题目初始化及同根因的材料校对最终读取时比较保留草稿的基线，不重写草稿；原请求待核实时优先确认。没有修改相邻产品文件或加入 debug 日志。

`final-13` 的冲突场景已通过完整流程：保存冲突、刷新保留双方对照及本地输入、明确采用服务端、回到阅读页核实。既有规格/契约已经要求这个行为，没有新增产品语义。

## 自验证据

- 依赖：`npm ci --ignore-scripts` 后已执行 `npm rebuild better-sqlite3`，实际内存 SQLite 查询通过。专属目录及产品修复文件 Oxlint 通过；`git diff --check` 通过。测试枚举不作为运行通过。
- 初期 `core-1/core-2/core-3` 使用总控只读 `web-core`，产品源码固定 `789a38d8`，不含 GeoGebra。逐个修正了新测试的重复入口限定、role 与可访问名称，以及数学排版异步造成的整段 `innerText` 不稳定断言；保留真实用户结果，数学内容精确验证继续归 C。`core-final` 10 过/1 失败，余下是该正文空白断言，之后 `math-recognition` 的实际校对重开通过。
- 独立完整构建：本树源码含 `c0391858`，Vite 的 `publicDir` 指向总控在本任务全新构建的 `TeachBuddy-test-rebuild/apps/web/public`，生成本树 `test-results/test-suite-rebuild/web-full-fixed`；没有复制 preview 产物或私有配置，没有覆盖总控构建。构建日志 `logs/full-build.log`。
- 完整运行：`WORKBENCH_WEB_DIST=<本树>/test-results/test-suite-rebuild/web-full-fixed BROWSER_RUN_ID=final-13 npx playwright test -c apps/web/e2e/rebuilt/playwright.config.mjs`，13/13 通过，约 1.3 分钟。日志 `logs/final-13.log`。随后身份场景增加受控激活等待窗口，`activation-final` 定点 1/1 通过（8.6 秒），确认激活返回前不挂载业务，放行后仍完成退出、异账户隔离和重登。
- 外观：已查看最终平板深色题库和桌面资源详情截图，操作及文字无明显遮挡、溢出；截图使用结束动效的稳定画面，不建立逐帧像素门槛。真实触屏、真实邮件/模型、Office 和目标设备仍未验。
- 所有原始日志、失败截图、trace 和数据库留本树 `test-results/test-suite-rebuild/`。中途 `core-fixed` 为隔离临时故障实验主动中止，4 过/1 中止/6 未跑，不算通过。早期 `/tmp/teachbuddy-author-b-*.log` 已复制到证据日志目录；另有一次性文档更新脚本 `/tmp/author-b-doc-update.py`。完整任务未结束前保留，最终由总控清理。

## 代表性故障红验证

故障只临时改变本线测试运行时的实际调用，已恢复干净文件，无持久开关或 mutation 框架。两项均在真实 HTTPS/SQLite 主应用上运行，证据 `browser/fault-ui-key/`、`logs/fault-ui-key.log`。

1. 创建响应丢失后的第二次请求，在转发给真实 API 时把 `idempotency-key` 换为新 UUID。原创建已实际提交，第二次实际新建，刷新列表断言 `Expected 1 / Received 2` 失败。检出的是持久业务重复，不是注入器异常、编译错误或只比键。
2. 临时拦截 `HTMLElement.prototype.focus` 对“全局搜索”触发器的归焦，其余聚焦照常。Escape 关闭搜索后，真实触发器 `inactive`，连续键盘场景在 `toBeFocused` 失败。检出 UI 独有的焦点接续丢失。

干净文件恢复后，`final-13` 两项均重新通过。独立消融、旧测试去留挑战与 Standards/Spec 审查仍由后续角色执行，本线不自签。

下一步：交总控固定候选，进行独立消融与双轴审查。未完成独立验收、审查和集成前不清理工作树、有效证据或任务现场。

## 独立挑战返工 B-R1 至 B-R5

基线已合并总控 `e18d909b`，共享任务记录冲突采用该提交原文。D19-D23 五项已补齐并通过正常候选17/17回归：

| ID | 新保护与可见故障 | 实际依赖/预期失败 |
| --- | --- | --- |
| B-R1/D19 | 统一编辑器加入公式和真实点，手动拖动实际 GGB 点，自动保存后刷新检查真实坐标和公式 | 本地 GGB 真实运行时，只观察 API 读数；移除 UI submit 或手动 flush 应在对象/坐标读回失败 |
| B-R2/D20 | 创建提交已成功但回执受控迟到时继续输入，丢响应后原键核实，再提交新内容并新设备读回 | 真实题目 API；旧回执覆盖最新输入应在草稿/最终正文断言失败 |
| B-R3/D21 | 多文件队列中原件阶段和条目阶段分别真实提交后丢回执，刷新重选错文件拒绝，再用原件原键接续 | 真实 multipart、IndexedDB 和资源 API；清掉原件指纹或换键应在错误提示/重复数量/字节断言失败 |
| B-R4/D22 | 真实多页 P.pdf 经主应用 PDF.js 翻页，浏览器真实文字层选择/复制并核对第二页文字 | 本地 PDF.js worker/CMap/字体；去除文字层应在选择或复制结果失败 |
| B-R5/D23 | 明确邮箱危险确认，I08 原请求未知核实到204后清理本账户 IndexedDB 原字节，保留另一账户并阻断迟到写回 | 真实注册/删除与设备字节；移除设备清理应在本账户原件仍存在失败 |

D11/D15/D16/D17 的剩余风险在本轮五项完成后给总控逐项取舍，不能把未验写成已承接；不恢复退役设备管理 UI 或完整旧矩阵。

### 本轮证据与故障检出

- 候选基于本树合并 `e18d909b` 后的产品源码和本任务总控新公共资产，独立 Vite 构建 `web-refinement`，日志 `logs/refinement-build.log`。没有复制 preview 或私人配置。
- B-R1 实际 UI 加入公式、Enter 创建点 A，使用 GGB 原生视口坐标定位真实鼠标拖动；关闭算式的退场完成、画布尺寸同步后才开始手势。等待真实自动保存 PUT，刷新读回实际 GGB 坐标和公式，并在无本机草稿的新 context 再读服务端保存坐标。只观察 GGB API，不用 API 创建或移动点。`math-new-device` 正常通过。
- B-R2 沿原未知创建场景增强，不另加重复矩阵。用真实提交完成/回执放行两个 gate 控制次序，在回执未返回时继续输入；丢回执后刷新、原键核实、保留新题干，再保存并新 context 读回唯一题目。`refine-third` 正常通过。
- B-R3 真实多文件队列：第一项已经确认，第二项原件提交成功但响应丢失；刷新后同名同长度而 SHA 不同的原件在发请求前拒绝，重选原件以原键确认；条目创建又丢回执，再刷新以原键原体核实。最终列表各一项且下载第二份真实 PNG 字节一致。`resource-native` 正常通过。
- B-R4 真实四页 `P.pdf` 经 PDF.js 加载第一页、翻第二页，真实鼠标三击选中 Q3 并以 Ctrl+C 复制；整页复制包含第二页末尾独有文字。`resource-native` 正常通过。固定 PDF 的字体映射包含部首字形，断言使用实际普通题号与稳定正文，不把跨字体的完整 innerText 空白/字形当内容持久化标准。
- B-R5 真实两账户经 UI 形成未确认原件，不合成账户占位字节。检查 IndexedDB Blob 的真实 SHA 与入库 PNG 一致；错误确认邮箱不发 I08，原删除已提交但回执丢失后仍保留原字节，刷新原请求204核实后只清本账户原件。另页已开始但被 gate 挡住的题库原文件读取，在删除后放行，仍不能重新落设备存储。`refine-third` 正常通过；最终回归改用同一实际 Blob 的 SHA 输出以保持失败报告可读。

四项代表性业务故障均实际运行，临时源码/测试均已恢复，无长期故障开关：

| 故障 | 实际具名失败与证据 |
| --- | --- |
| R1 真实保存请求图形快照冻结为拖动前 GGB | `fault-math-device-final`：新设备实际坐标 Expected 2.4 / Received 1；补丁 `faults/refinement/R1-stale-ggb-final.patch` |
| R2 原键核实的 acceptRecoveredQuestion 将 changed 错设为 false | 独立故障构建 `web-fault-r2`；`fault-r2-later-input`：新题干输入不再存在，页面退回旧提交阅读态；产品补丁 `faults/refinement/R2-discard-later-input.patch`，构建后立即恢复源码 |
| R4 浏览器 PDF 文字层 span 被移除 | `fault-refinement`：真实文字层不再包含 Q1，后续选择复制无法成立；补丁 `faults/refinement/R4-no-browser-text.patch` |
| R5 本账户 IndexedDB 删除跨刷新无效 | `fault-math-device-final`：核实204后仍可读“待删账户原件.png”及其完整 SHA，另一账户原件保留；补丁 `faults/refinement/R5-no-device-delete-final.patch` |

早期故障探针的两个“通过”没有算检出：R1 只有同浏览器刷新被设备草稿掩盖，促成新增新设备真实对象读回；R5 的当前文档原型注入被刷新清除，改成在新文档保持同故障后才取得有效红。相应原始日志仍保留，不能从初次探针外推保证完整。

`refinement-final` 在干净候选完成本线全部17/17场景，约2.0分钟，日志 `logs/refinement-final.log`。Oxlint与diff-check通过。产品源码没有本批新增修改，所有故障已恢复。后续独立消融与审查继续由总控安排。

### D11、D15、D16、D17 后续风险取舍

| 风险 | 最少有效接续与目前不能宣称的结果 |
| --- | --- |
| D11 I09历史迟到昵称覆盖 | 可并入设置路径，用两页先后改名而第一回执后到，核对新昵称及另一编辑输入不被旧回执覆盖；普通昵称成功或API版号检查不等价。建议保留一个相异历史场景，不恢复昵称边界的全部浏览器矩阵 |
| D11 S45会话保存失败 | 可沿现有激活等待场景让首次会话保存明确失败，再从真实S45点继续或重试，核对不重新注册/消费验证码；当前激活 gate 只证明确认前不挂载，不能关闭S45风险 |
| D15时区检测与拖动 | 可在现有日程任务链加入一次真实网格拖动、请求确认与重开；系统时区/焦点检测仍需以另一时区 context 和真实账户排期验证。A的迁移算法不能证明浏览器检测和手势接线 |
| D16真实开发服务 | 固定生产 dist 不证明 Vite/StrictMode。由总控公共运行入口承担一条真实开发服务保存主路径，复用用例语义；不恢复旧独立材料harness或退役业务 |
| D17网页AI主应用 | C的MV3桥页面不等价于真实工坊。可复用R1真实画布加入一个主应用受控 CONNECT/SEND/取消后迟到回复过滤场景；真实商店与真实模型仍另列外部专项，不重复所有扩展协议组合 |

上述未以“API已有”或“成本较高”归为可删，仍交总控固定最终归属；本轮范围先按五项完成，不自行恢复已移除设备管理UI或全套旧矩阵。

## 第三批 D11 / D15 / D17 小范围补强

总控授权继续处理剩余相异保证，D16开发服务由A负责；不改共享fixture/config，不恢复旧控件/主题矩阵。后续当前入口统一为 `apps/web/e2e/ci.config.mjs`；历史旧配置命令保留为实际证据，最终旧专属config由总控移除。

- D11 I09：真实两页交错昵称修改，首写已提交后扣住回执，另一页保存新昵称并触发主页面身份读回，再放行旧回执；主页面账户行、昵称和刷新仍为新值。
- D11 S45：沿现有身份场景增强，首次activate明确返回会话保存问题，S45继续当前会话后真实激活；注册业务请求仅一次，再完成原账户切换隔离路径。
- D17：真实主应用统一编辑器消费受控STATUS/CONNECT/SEND，第一轮实际加入公式，下一轮确认上下文含新公式；第三次SEND后真实点击停止，观察同request/session的CANCEL，再投递匹配原请求的迟到DONE，作品公式及新输入保持。没有调用真实网页模型，也不把此场景代签C的MV3/商店验证。

上述三项在总控只读 `web-candidate` 构建通过，命令沿统一CI配置 `--workers=1 --output=test-results/test-suite-rebuild/browser/third-first --grep 'D11|D15|D17'`，日志 `logs/third-first.log`：3 PASS，另D15失败见下。

D15真实水平拖动已两次复现次日09:00变08:55，第二次已经稳定hover并从主体中心抓取，没有放宽分钟断言。总控授予本线最小日程调用链及 `docs/subsystems/schedule.md` 唯一修复/同步权。按diagnosing-bugs先列三种可证伪原因：嵌套滚动偏移、FullCalendar命中/吸附差异、应用保存转换；`travel-probe`记录指针、网格/滚动、镜像与真实保存请求：指针Y恒489、scrollTop恒728、09点网格位置不变，镜像在提交前已显示08:55，排除滚动变化与应用保存转换。

FullCalendar timegrid `queryHit`以五分钟snap计算日期区间，却返回十五分钟slot矩形；interaction初始命中将抓取点移至主体与该矩形交集中心，造成同格内分钟偏移。单变量将slot改为五分钟即越过严格09:00断言，支持命中假设。局部修复仅改TimeGrid与schedule.css，让公开slotDuration/snapDuration一致；CSS行高置零、标签独立定位，保持104px/h及每十五分钟分隔线。没有fork依赖、使用内部开关或在保存时钳制分钟。权威运行参考同步到 `docs/subsystems/schedule.md`。

真实修复路径继续验证水平换日不改09:00、纵向移动30分钟成为09:30、拖动末端延长15分钟成为75分钟，新设备只复制Cookie并读回09:30至10:45。随后通过CDP实际更改浏览器IANA时区到Asia/Shanghai，消费真实系统检测与设置PUT，日期和当地钟点保持。采用真实bringToFront及页面15秒检测，不以合成focus或替换Intl代签；本例证明系统检测，不单独宣称焦点触发的即时性。测试显式清理继承的timezone override，未改产品时区实现。

截图对照：修前 `browser/travel-probe/.../test-failed-1.png`，修后 `browser/drag-fixed-third/.../schedule-five-minute-hits.png`。实际查看两张，小时高度与十五分钟线密度保持，修后真实卡片显示09:30至10:45；测试也核对104px/h，避免仅让单例通过但网格变三倍高。

I09补强另等待首次route.fetch为200、旧POST响应200并finished、昵称保存编辑器和状态退出，才检查新昵称，避免reload抢先取消旧处理。按历史1b107651等价反转profileRead代次检查，独立构建 `web-profile-fault`，`profile-historical-red`在实际昵称断言失败：Expected 随后保存的新昵称 / Received 先提交的旧昵称；补丁 `faults/refinement/D11-historical-nickname.patch`。AuthProvider已恢复，没有永久产品改动。正常 `drag-fixed-third` 的I09再次通过。

D15新候选独立Vite构建 `web-drag-fixed2`，使用本树产品源码和总控同任务新公共资产 `/home/liam_t/项目/TeachBuddy-test-rebuild/apps/web/public`，日志 `logs/drag-fix-build2.log`。未复制preview产物。`drag-fixed-sixth`完整D15通过；早先coach遮挡、CSS行高膨胀和CDP重复override失败保留为诊断证据，不算产品通过。


D15最终同一测试对总控修前候选 `web-candidate` 再次稳定红，`drag-original-red` 真实保存 Expected09:00 / Received08:55；修复候选 `third-final` 的D15通过，包含新设备结束时间10:45读回。该次I09失败另列：旧POST200完成后昵称编辑器留下“昵称保存结果未确认”，trace显示最终GET session未收响应，10秒后ERR_ABORTED。不能把此前I09正常通过当作该失败已关闭；总控授权独立诊断AuthProvider，当前先单独交付日程修复，不改认证产品源码。

定点Oxlint与git diff-check通过（`logs/third-lint.log`）。当前I09增强尚未提交，D15源码、场景与运行参考可独立验收。


## I09 独立后续缺陷：成功保存后的并发复核误报

总控授权本线独占 `apps/web/src/features/auth/AuthProvider.jsx` 与 `docs/subsystems/identity.md`。按diagnosing-bugs先保留最终回归偶发未确认，区分三种可证伪原因：一次性路由移除造成传输停滞、并发身份读取代次相互淘汰、旧成功回执解析/业务确认失败。去掉profile路由自动移除后两次正常通过仍不能关闭问题；随后用真实GET/POST顺序构造更小反馈环。

`profile-controlled-read-red`及`profile-controlled-read-red2`连续两次稳定红：旧昵称POST已真实200，回执放行后扣住保存最终复核GET；另一页再真实改名，较新GET已发布最终昵称，再放旧GET200，原编辑器仍留下“昵称保存结果未确认，请重试”。所有受控HTTP均200，最后昵称已真实显示，排除该路径的传输停滞与回执解析问题。反馈环13.8/13.7秒。新缺陷与历史1b107651的旧回执覆盖不同：本次资料没有被覆盖，而是成功读取因未获发布资格而被当成失败。

局部修复分开成功确认与资料发布：同一活动会话的成功GET返回已验证account，只有当前profileRead/profileRevision且未在保存时才发布资料。网络失败仍不确认，generation/identityEpoch及账户/会话交接判断保持；旧回执和旧资料没有放宽发布资格。只改Provider一处，不改外部认证契约。

最少场景沿原I09增强，不恢复昵称矩阵：明确首次真200，等待旧回执finished以及进入复核/保存完成的实际终点，先断言旧昵称未出现；再安排上述并发复核，以最终昵称、编辑器成功退出及刷新读回保护。另一个真实身份对照先扣住旧账户复核，真实退出并登录预先创建的另一账户，放旧GET200，再以新账户继续实际改名保存，防止旧身份成功被新身份接受。

- `profile-controlled-fixed`：受控复核修复后连续2 PASS。
- `profile-final`：最终I09及新账户交接两条2/2 PASS（3.8/6.3秒）。
- `profile-identity-fixed`：原identity-shell三个受影响场景3/3 PASS，含S45继续不重复注册、退出切换隔离、外观/焦点及退出未知确认；该批两条新增场景早期准备失败不记通过，后由profile-final完成。早期失败分别是过早要求尚被扣住GET提供的中间昵称，以及新账户coach遮挡；没有放宽旧昵称、最终昵称或身份隔离断言。
- `profile-historical-final-red2`：最终同一I09场景对历史代次检查反转独立构建，旧回执处理终点后实际旧昵称链接仍存在，Expected count0 / Received1。相较早期先断言再reload的路径，这里不会抢先取消旧回执。

构建 `web-profile-fixed` 使用本树候选源码及总控新公共资产，日志 `logs/profile-recheck-build.log`。源码临时故障均在构建后立即恢复，故障补丁和失败数据保留供独立审查。额外单独移除recheck入口generation/epoch检查的 `profile-identity-guard-red` 实际通过，耗时36.5秒；其余身份/写入代次及传输期限仍存在，本次没有取得独立业务故障检出，不算红，也不再扩张故障以凑结果。原未修改的真实新账户对照只用于核对本修复没有破坏身份安全约束。代表性有效红仍是本次并发复核两次红和历史旧昵称业务红。

最终定点Oxlint（`logs/profile-final-lint.log`）及git diff-check通过。没有永久故障开关；AuthProvider现只有成功确认与资料发布的局部修复。
