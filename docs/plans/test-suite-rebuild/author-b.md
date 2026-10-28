# 作者 B - 用户流程重建

状态：总控已确认保护清单，13 个主应用场景已实现，完整构建自验 13/13 通过；身份激活等待增强定点 1/1 通过。独立消融和双轴审查仍待总控安排。执行者 `gpt-6.1-sol / medium`。工作树 `TeachBuddy-test-browser`，分支 `test/rebuild-browser`，空套件基线 `992172141f6664d4d851154cc533428414051c42`。独占 `apps/web/e2e/rebuilt/` 与本记录；产品缺陷先交总控协调。没有读取旧测试断言。

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
