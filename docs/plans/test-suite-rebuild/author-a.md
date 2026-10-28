# 作者 A：业务与数据测试重建

## 固定现场与阶段

作者：gpt-6.1-sol / medium。工作树 `TeachBuddy-test-data`，分支 `test/rebuild-data`，空测试基线 `992172141f6664d4d851154cc533428414051c42`。总控已确认设计。首轮已提交 `f8752c16`；独立发现 A-R1 至 A-R5 已补充作者测试与故障检出，等待 D 复核。尚未判断旧套件全部去留、完成最终 CI 或集成。

写入仅限 `apps/api/test/rebuilt/**` 与本记录。使用现有无断言的真实认证 HTTPS harness，真实应用装配、SQLite、受管文件；邮件投递和模型 provider 使用受控替身。独立临时目录、随机端口，不读取 preview 配置和用户数据，不调用付费模型。产品缺陷先复现并报总控。

## 候选保护清单

| 组 | 需求出处 | 具体用户故障与候选行为 | 首选层、依赖与替身 |
| --- | --- | --- | --- |
| A1 身份与会话 | [认证契约](../../contracts/auth.md) HTTP、验证码、会话与退出 | 非同源写入获准；pending/新页面偷偷授权；退出错撤另一页；重置密码仍可用旧会话；错码耗尽/失效挑战仍可注册。覆盖真实 bootstrap、发码、注册/登录、activate/restore、定向 logout、重置和再登录读回 | 真实 HTTPS、认证 SQLite、Cookie/PageContext；邮件替身、可控时钟 |
| A2 原子保存与隔离 | [共享保存](../../contracts/workbench.md) 身份、写入、引用 | 断线重试重复建题；旧版覆盖新稿；同键改体被接受；外账户读/改/复制对象；失败消耗键。创建/并发重放/更新/冲突/失败后同键重试，重开应用后重放，异账户同键独立 | 真实 HTTP/SQLite，复用题库主链；不替换 mutations/仓储 |
| A3 题库内容与来源 | [题库规格](../../features/questions.md)、[共享契约](../../contracts/workbench.md) 对象与来源 | 直接编辑变成副本；改编污染原题或携带笔记；原题变化/归档破坏副本快照；搜索答案造成错误命中；分类删除丢关系或不升版 | 真实题库 v2 HTTP、SQLite；普通文稿，不断言格式/OCR |
| A4 生命周期与资源关系 | [题库](../../features/questions.md)、[资源](../../features/resources.md)、[数据](../../features/data.md) | 归档后不能按原 ID 恢复；永久删除可复活；资源换文件丢分类/备注/旧文件；跨账户文件可绑定 | 真实 HTTP、SQLite、受管原件；使用最小真实文件，格式与预览由 C 负责 |
| A5 日程与提醒事务 | [日程契约](../../contracts/schedule.md) | 跨午夜/DST/重复例外显示错实例；移动复制事项或半笔落库；完成状态丢失；到期后改时间抹掉原提醒；dismiss/重启重复通知。覆盖范围边界、detach/move、时区迁移、到期前后变更及去重 | 真实 HTTP/SQLite、模块实际 captureDue；注入业务时钟，无墙钟竞速 |
| A6 班级与成绩 | [班级契约](../../contracts/classroom.md) | 学号冲突、换班残留座位；导入确认部分写入或重复成绩；零分/缺分/缺考混淆；标签合并断链；父级归档被隐式复活。覆盖名单/座位/记录、真实 Excel 上传与人工校对确认、冲突回滚、排名/均值/标签缺分、逐级恢复 | 真实 HTTP/SQLite、SheetJS 构造合法 Excel 原字节；只测消费与业务事实，格式拒绝/原卷由 C 负责 |
| A7 偏好与导航 | [工作台](../../features/workbench.md)、[共享保存](../../contracts/workbench.md) 偏好兼容 | 另一设备丢已选外观/导航；旧客户端清空新增偏好；冲突最后写获胜；账户互相污染 | 真实 HTTP/SQLite、重开读回；头像像素/布局由 B/C 负责 |
| A8 个人包与维护恢复 | [数据契约](../../contracts/data.md) 个人包、部署恢复 | 包中漏归档/历史/关系或泄露秘密；缺附件仍成功；删除导出误删原件；维护备份只复制库丢文件；损坏恢复破坏原库；旧身份和旧请求在恢复后继续写 | HTTP 导出与真实 ZIP 文件、公开维护入口、真实 SQLite/文件；不编造完整包，不替身备份/校验 |
| A9 账户删除 | [认证 I08](../../contracts/auth.md#账户删除交换-i08)、[数据清理](../../features/data.md#账户永久删除) | 回执丢失不能核实；删号未撤销旧会话/清完业务；错误 Cookie 可核实；重注册继承旧资料；删除另一账户 | 真实 HTTPS/SQLite/受管文件、双账户与原请求重复核实；邮件替身 |
| A10 受控助理 | [助理契约](../../contracts/agent.md) 已开放工具、journal、提案 | 草稿冲突丢输入；无效工具注入身份；同回合重复写两次；工具拒绝被宣布成功；重启重跑；建议卡未点击已写/重复点击重建；跨账户读取历史 | 真实 HTTP/SSE、持久 journal、真实模块操作；仅 provider/SDK 边界受控，执行真实工具，不做付费推理 |

组为可独立消融的测试文件边界，细化时拆出不同故障保证；每组至少对代表性实际保证手动注入可运行故障，记录具名断言、原候选通过和破坏后失败，再恢复源码。临时注入与报告留 `test-results/test-suite-rebuild/`，不提交产品改动。

## 边界与不自动化

- B 负责真实页面、草稿与迟到响应、主应用导航、像素/键盘/焦点。A 的导航只验证服务器保存契约，认证只验证真实协议，不能代签浏览器 Cookie 重开。
- C 负责原文件格式、OCR、原生转换、数学源与输出、网页桥。A 需要文件时只验证归属、ID/字节保留与业务关系；Excel 在 A 覆盖成绩业务消费，C 覆盖格式及原卷，两者依赖重叠有不同失败判据。
- 真实邮件到达、真实模型授权/账单、GPU 识别质量、Office 人工编辑、设备触屏/浏览器关闭后恢复需目标环境，普通回归不自动化。
- 尚未开放的全模块 Agent 工具、已移除设备管理 UI、个人包整体导入不列为已实现测试对象。恢复点未接入行为先核对台账和实际源码，记录缺口，不用测试伪造能力。

## 公共准备请求与下一步

公共准备已由总控提供 `apps/api/test/support/application.js`，共享提交原 SHA 为 `8be6e3a779b17c5d1ea6a84bb33ff6fc7506e103`、`e27a49ca584b311c7d55c323cb0958e939bab740`；本树 cherry-pick 为 `442e6dff`、`5fb453df`。A 没有修改公共 fixture。真实 client/clock/mailer 来自原无场景准备，受控 provider 来自 `fixtures/c26/provider.js`。设计完成前完整读取认证 harness 时看到了底部通用协议断言 helper，已向总控透明报告；未读取旧 `.test.js` 或恢复旧场景。

## 首轮候选与作者自验

测试位于 `apps/api/test/rebuilt/`：`identity.test.js`、`saving-questions.test.js`、`resources-preferences.test.js`、`schedule.test.js`、`classroom.test.js`、`data-lifecycle.test.js`、`agent.test.js`。`helpers.js` 仅组织本线 HTTP、真实身份和生命周期，`classroom-fixture.js` 让成绩确认与跨模块资料包复用同一合法工作簿准备。

- `node --test apps/api/test/rebuilt/*.test.js`：31 PASS、0 FAIL、0 skip，约 6.5 秒。原日志在本树 `test-results/test-suite-rebuild/author-a-pass.tap`。
- `npx oxlint --deny-warnings apps/api/test/rebuilt`：通过。
- 除共享提交外，本线改动仅新增 rebuilt 测试与本记录；`git diff -- apps/api/src packages/shared/src` 为空，没有提交产品、配置或 CI 变更。
- 每例真实 HTTPS、注册/激活、独立 SQLite 与受管文件，服务器关闭后才清理成功现场。重启复用原端口和 Cookie；请求关闭连接避免把旧 keepalive socket 误判成产品重启失败。失败现场保留。
- 固定退役前备份经 SHA-256 核对后实际 restore/activate，读回题目、资源、数学、日程、原件与对话；未读历史测试断言。损坏文件、未知迁移、未 activate 和运行锁均有真实拒绝验证。
- 个人包读取真实 ZIP 全部清单的长度/摘要，覆盖班级七类对象、题目来源快照、资源原件、数学两个 revision、日程、服务器对话草稿和归档内容。另验一致快照、缺附件失败、删除生成包保留原件，以及秘密字段排除不损坏教师历史文字。
- Agent 使用真实 pi SDK 和固定 provider 事件，工具执行真实模块操作。验证 SSE 持久事件与快照、同轮等价写入去重、版本拒绝、参数注入、教学提案显式执行、日志结果失败后原键核实、普通重启及部署恢复冻结。

## 手动破坏证据

每项在 `/tmp/teachbuddy-a-ablation-c51lu3lm` 独立应用副本注入可运行业务故障，单项执行后 finally 还原原字节；没有改 preview 或本树产品源码。每项都有具名 `ERR_ASSERTION`、非零退出及相应正常候选 PASS。补丁与 TAP 统一在本树 `test-results/test-suite-rebuild/`，文件名前缀如下，供独立验收重做和组移除比较，不是通用 mutation 框架。

| 组 / 证据前缀 | 实际破坏 | 具名失败结果 |
| --- | --- | --- |
| A1 `a1-expiry` | 身份解析忽略会话到期/撤销裁决 | “记住我绝对到期”中业务读 200，而应 401 |
| A2 `a2-fingerprint` | 同键不比较请求指纹 | “并发原键”中改体返回 201，而应拒绝 409 |
| A3 `a3-source-version` | 改编记录错误来源版本 | “改编固定来源”中保存版本 2，而实际采用版本为 1 |
| A4 `a4-file-history` | 历史恢复仍沿用当前文件 | “文件替换与历史恢复”中读回新文件 ID，而应为旧文件 ID |
| A5 `a5-capture-due` | 变更前不结算提醒 | “修改前结算原提醒”中通知 0，而应 1 |
| A6 `a6-score-denominator` | 均分多计一个分母 | “零分/缺总分”中均分 50，而应 66.66666666666667 |
| A7 `a7-legacy-preference` | 旧客户端写入用默认值覆盖原偏好 | “旧客户端保留新增字段”中 dark 被改成 light |
| A8 `a8-export-archive` | 导出快照漏归档题 | “只含本账户快照”无法生成应当 ready 的真实包，返回 failed |
| A9 `a9-account-file-cleanup` | 删号跳过文件元数据清理 | “删除账户”仍有 1 条本账户 File，而应 0 |
| A10 `a10-tool-dedupe` | 同轮等价已确认写入不复用 Operation | “真实写入同轮去重”出现 2 个 Operation，而应 1 |

初次独立副本缺少 API workspace 内依赖曾发生准备失败，随后补齐原已安装依赖的符号链接并重跑；该准备错误不算检出。最终表中只计实际业务断言失败。

## 剩余条件与接续

作者候选不代签旧测试去留、独立消融、Standards/Spec 审查、最终 CI 或目标环境。D 应固定候选后对照旧场景和历史缺陷，发现缺口由 A 返工。固定退休备份已验，其他更早冻结源码版本的兼容输入未在本线执行；由总控结合 C 和 D 明确是否尚有独有保护，不能据本线 31 PASS 推断所有旧版本升级均已覆盖。

真实邮件、真实模型/OCR、Office 人工编辑、浏览器重开及目标设备仍按分工未验。当前数据恢复 v2 查看/放弃动作的未接入边界保持原契约说明，本线只验证实际接入的恢复冻结守卫，不伪造尚未开放能力。

任务尚未整体完成，依照授权保留临时实验副本、失败测试数据与原始证据。总控在独立验收、集成成功后统一清理；现场索引为 `test-results/test-suite-rebuild/author-a-ablation-workspace.json`。下一步交付作者提交和证据路径给总控，再按独立发现继续。

## 独立发现返工 A-R1 至 A-R5

依总控派发对齐 `6240946c5436119bdc175aa1fc38af06adf54b7d`，merge 为 `4a685f3d`。唯一冲突为总控任务记录，已按总控明确指示完整采用其版本；本次实现只新增 rebuilt 用例及更新本记录。设计冻结后的本轮获准阅读相关旧测试和历史证据，没有恢复旧全矩阵。

| 发现 | 有效依据与旧保护来源 | 新的最小关闭证据 |
| --- | --- | --- |
| A-R1 身份独有失败边界 | [认证契约](../../contracts/auth.md)的注册开关、用途/邮箱绑定、pending 保存失败及存储不可读；旧 `auth-contract-accounts` C03、`auth-contract-sessions` PN01、`auth-contract-faults` ST02 | `identity-recovery.test.js` 四例：关闭时禁止发码及已有挑战注册，重新开放原码可用且既有账户仍可登录；六次用途/邮箱误用仍保留5次预算；激活存储失败后原 pending 分别继续 page 或重试 remembered，激活后变选择冲突；真实账户表不可读时认证和业务返回503，修复后原会话及资料可读 |
| A-R2 未知文稿防损坏 | [材料内容契约](../../contracts/materials.md#内容)及共享失败读取规则；旧 `materials-protection` 与 preview/Agent 的未来版本保护 | `document-protection.test.js` 两例：真实库分别存入未来题面、答案、来源快照和笔记摘录，普通更新/归档/改编拒绝且逐字节不变；分类删除整笔回滚；真实受控 Agent 更新返回公开 unsupported-content-version，工具/回合拒绝且原行不变 |
| A-R3 删号失败与启动接续 | [认证 I08](../../contracts/auth.md#账户删除交换-i08)的失败锁定与 `resumePendingDeletions`；历史 `de8bd99b` 及旧 `account-deletion.test.js:333` | `deletion-startup.test.js` 一例：用真实文件路径故障令清理503，旧会话与新登录均拒绝且保留文件清单；直接走 `startServer`，故障仍在则意图保持且其他账户可用；修复文件后再次真实启动，无浏览器Cookie参与便清完账户/业务/原件，仅原Cookie原请求能204核实 |
| A-R4 更早 R31 兼容 | [共享保存](../../contracts/workbench.md)原路径成功重放及 [输入可重建性](../../code-standards.md#输入与可重建性)；旧 `materials-questions-migration`、`math-integration-migrations` 中的 R31 题库保证 | `legacy-questions.test.js` 一例：从固定 `r31-questions.tar.gz` 经摘要验证执行原源码创建 v1 题库，升级后题面/来源/笔记/ID不变，写入当前新版后原路径原键仍重放原201，并在再次重启后不生成重复对象或覆盖新稿。旧版没有当前认证模块，此兼容用例复用其可信测试身份 HTTP fixture，普通新功能仍走真实认证 |
| A-R5 工作簿消费 | [班级契约](../../contracts/classroom.md#excel-输入与确认)真实 XLS、按字节识别、公式只读有限缓存；D补充 C-R5，旧 `classroom-workbook` | `workbook-business.test.js` 两例：实际 CFB/BIFF8 `.xls` 经上传/映射/确认保留001学号与0分，HTML伪装xls拒绝且不产生导入；真实XLSX公式缓存0不执行SUM，缺失和错误缓存保留坐标问题、阻断确认且不留结果，人工校正后才可确认 |

本批命令为 `node --test apps/api/test/rebuilt/identity-recovery.test.js apps/api/test/rebuilt/document-protection.test.js apps/api/test/rebuilt/deletion-startup.test.js apps/api/test/rebuilt/legacy-questions.test.js apps/api/test/rebuilt/workbook-business.test.js`，结果 10 PASS、0 FAIL、0 skip，约2.65秒；原日志 `test-results/test-suite-rebuild/author-a-revisions-pass.tap`。新增五文件定点 `oxlint --deny-warnings` 通过。没有修改公共准备，所以按派发要求不重复首轮31例。

五项代表性手动破坏均在独立副本 `/tmp/teachbuddy-a-revisions-jxn6clh_` 执行，结束后 finally 恢复，副本与当前 `apps/api/src` 全部字节核对一致，本树产品源码没有本轮 diff。原始补丁和 TAP 在本树 `test-results/test-suite-rebuild/`：

| 证据前缀 | 实际破坏与具名行为失败 |
| --- | --- |
| `ar1-registration-open` | 绕过注册关闭的业务裁决，注册开关用例发码返回200而应403。只移除内部重复 guard 的初次试验存续，外层仍正确拒绝，另保留 `ar1-redundant-guard-survived`，不把它记为破坏保证或检出成功 |
| `ar2-future-documents` | 绕过存储文稿可写保护，未来题面被替换为当前文稿，普通写返回200而应422 |
| `ar3-startup-resumption` | 删除真实启动的 pending deletion 接续调用，文件修复后仍保留1条未完成意图而应0 |
| `ar4-legacy-receipt-path` | 改变当前旧入口的回执规范路径，固定旧请求升级后返回409 key-reused而应原201回执 |
| `ar5-invalid-cache` | 将无效公式缓存直接当0分，公式缓存用例读到0而应null |

上述失败均为具名 `ERR_ASSERTION`，不是编译、准备或超时失败。`author-a-revisions-workspace.json` 与 `author-a-revisions-preserved-directories.json` 记录继续保留的副本及失败数据。当前关闭结论是作者补测已完成，A-R1 至 A-R5 交 D 复核；不代签独立验收或整项任务完成。

## D16 真实开发入口与 Cookie 属性补充

作者继续使用 gpt-6.1-sol / medium。本批先对齐总控固定 `6b70a35c`，本树 merge 为 `65023af0`。新增独占 `apps/web/e2e/rebuilt/development.spec.mjs`，仅复用新版浏览器交互 helper、认证基础证书/邮件/时钟和根目录真实图片输入，没有引入退役伪页面或旧 auth-integration/math-real 建场。

用例直接 `startServer({dev:true})` 创建独立 HTTPS/Vite 主应用，真实页面注册后确认浏览器实际请求 `/@vite/client` 和 `/src/main.jsx` 均200，另读实际转换入口含 StrictMode。沿资源上传、打开原件入口、题库/资源往返，再新建题目、保存和刷新读回的单条主路径验证；检查无浏览器运行异常及页面水平溢出，实际截图未见明显布局问题。成功后关闭页面、真实 server/Vite，并移除自身 application 数据目录；未写公共 build。

- `BROWSER_RUN_ID=author-a-development-final npx playwright test -c apps/web/e2e/rebuilt/playwright.config.mjs development.spec.mjs`：1 PASS，约10.7秒。原日志 `test-results/test-suite-rebuild/author-a-development-pass.log`；HTTP资源证据和截图在同树 `test-results/test-suite-rebuild/browser/author-a-development-final/` 的具名用例目录。
- 现有身份首例追加真实 remembered 激活响应 Cookie 属性断言：`__Host-teachbuddy_session`、HttpOnly、Secure、SameSite=Lax、Path=/、无Domain及初次七天Max-Age。只运行该原有用例，通过；原日志 `test-results/test-suite-rebuild/author-a-cookie-pass.tap`。没有新增身份矩阵。
- 两个变动文件的定点 `oxlint --deny-warnings` 通过。本轮未运行其他浏览器/API组；CI现有 `*.spec.mjs` 自动收集新文件，无根配置接线改动。

代表性红证据临时修改资源页挂载逻辑：把每次 layout effect 新建 AbortController 改为复用 `controller.current`，使 StrictMode 重挂载沿用已经 abort 的请求范围。真实开发服务仍能加载、注册和进入资源页，但上传按钮持续 disabled，具名断言“StrictMode重新挂载后资源上传入口必须可操作”明确失败，非建场或编译故障。原字节在 finally 中恢复，产品源码 diff 为空，随后正向流程通过。补丁 `test-results/test-suite-rebuild/d16-strictmode-controller.patch`，最终红日志 `d16-strictmode-controller-final.log`；失败截图、trace和隔离数据保留在 `browser/author-a-development-mutant-final/`，另保留初次上传完成断言失败的诊断。

HMR、API watch、真实浏览器重开及目标设备没有在本批运行，不由这条开发主路径代签；仍沿实际变更按需验证。本批作者证据交总控/D独立复核，尚不宣告整体测试重建任务完成。

## D03 / D12 / D13 / D15 最后业务边界批次

作者仍为 gpt-6.1-sol / medium。已核对本树 `apps/api/src`、`apps/api/test/support`、`fixtures/c26/provider.js`、`rebuilt/helpers.js` 与总控固定 `1251f0ce` 无差异，使用等价公共源，不合并总控计划。本轮写入只在 rebuilt 与本记录，没有产品或共享准备改动。

| 裁决与契约 | 最小新增保护 |
| --- | --- |
| D12：[助理停止、journal与重启契约](../../contracts/agent.md)，旧 `agent.test.js:358-371 / 251-281` 只作冻结后证据 | `agent-lifecycle.test.js` 两例。真实 SDK 同批两次工具调用，在第二次授权处受控等待首笔 confirmed，真实 HTTP stop 后第一笔保留、第二笔 prepared 转 cancelled、只保存一道题且 provider 只请求一次。单用途 `agent-crash-child.mjs` 则真实注册/HTTP/SQLite/SDK，在业务已提交且卡片仍 executing 的结果日志提交前 SIGKILL；父进程核对退出信号和检查点，经真实维护 unlock、重开及登录后检查 interrupted/unconfirmed，以公开 reconcile 找回同一题目且零模型请求、无重复对象。没有恢复三检查点或通用旧 runner |
| D15：[日程日历扩展](../../contracts/schedule.md#日历扩展)，旧 `teaching-time-calendar` 的必要语义 | 现有 `schedule.test.js` 追加一例：1月31日月重复至5月只返回1/3/5月31日；纽约2026年3月8日全天从05:00Z至次日04:00Z，独立算得实际23小时。按总控集中裁决移除仅增加第三方规则组合的 yearly 闰日例，不恢复 RRule 矩阵 |
| D13：[考试原卷与固定定位](../../contracts/classroom.md#原卷与固定定位)，旧 `classroom-paper` 的存储成员关系保证 | `exam-paper.test.js` 一例，复用根固定 I-1/I-2 真实 PNG，分别经实际 preview 创建固定 rendition；合法考试 source 与题目 location 保存，另一个同账户 rendition 及源外 location 均422且原考试逐字段不变；重启保留原 File/rendition/页号/选区/稳定ID。没有调用 generateDocx 或恢复 Office 三格式矩阵 |
| D03：[删号等待生产者结束](../../contracts/data.md#账户永久删除)，旧 `account-deletion.test.js:199 / 272` 的独有保证 | `agent-lifecycle.test.js` 另加一例真实在途 SDK：收到 abort 后受控保持未 settle，通过另一账户真实 HTTP 请求推进事件循环，确认原业务行与文件字节仍在、I08尚未204；释放后才204并清理对话/事件/原件，旧身份后续写入401且另一账户仍可用。仅一个 producer，未恢复 Job/转换/导出矩阵 |

定点命令 `node --test --test-name-pattern='D12|D13|D15|D03' apps/api/test/rebuilt/agent-lifecycle.test.js apps/api/test/rebuilt/exam-paper.test.js apps/api/test/rebuilt/schedule.test.js`：5 PASS、0 FAIL、0 skip，约4.33秒；原日志 `test-results/test-suite-rebuild/author-a-final-boundaries-pass.tap`。四个变动实现/测试文件定点 `oxlint --deny-warnings` 通过。未重跑 A 全组或浏览器组。

代表性手动破坏在独立副本 `/tmp/teachbuddy-a-last-boundaries-jeqpldbp` 执行，均为实际业务断言失败，源文件 finally 恢复并逐字节核对与本树 API 源码一致：

| 原始 patch/TAP 前缀 | 可运行故障及结果 |
| --- | --- |
| `d12-stop-intent` | stop 不持久保存用户停止意图，真实停止后的回合变 failed 而应 stopped |
| `d12-crash-recovery` | 将 executing 恢复为 cancelled，SIGKILL 用例要求 unconfirmed 的具名断言失败 |
| `d13-paper-membership` | 跳过 location 所属原卷校验，同账户源外定位更新返回200而应422 |
| `d03-active-erasure-wait` | 移除工作台取消生产者的 Promise.all 等待，SDK 尚未 settle 时业务行已经被擦除，具名数据保留断言立即失败，不以超时作为检出 |

证据均在本树 `test-results/test-suite-rebuild/`。只移除停止链的一层重核时仍由 SDK/工具端其他层阻止，存续日志另保留为 `d12-stop-recheck` / `d12-stop-redundant-guard-survived`，不计检出或据此增加重复矩阵。初次 stop 建场等待需适配 SDK 工具并行授权，修正后通过，上述检出只计最终实际业务断言。

成功测试的服务、子进程、数据库与文件已关闭/清理；失败现场按任务未完成规则保留，索引 `author-a-last-boundaries-workspace.json`、`author-a-last-boundaries-preserved-directories.json`。本轮作者闭环完成，交总控/D复核；不代签整个重建任务或目标环境验收。

## 首次 CI 原卷预览分组纠正

按 diagnosing-bugs 接手固定候选 `e9d7d59` 的真实 HTTP 失败。API job `122673338414` 中 D13 第24例失败，原始 Job 断言只打印不存在的 `current.problem`，因此日志未显示底层原因。总控取回的隔离 SQLite/文件产物 `ci-first-api-diagnostics/runtime/rebuilt-business-lmbhMU/files/work/3060450eff7518c439700b9b19f2d919ecf19332244e7be186bd4c59d83b5631/conversion-G0Lw1u/failure.txt` 明确记录 `spawn /usr/bin/bwrap ENOENT`。

实际路径是 PNG preview Job → `ensurePreview` → `convertFile` → `/usr/bin/bwrap` 沙箱 → 转换 worker。PNG虽不依赖Office/Pandoc，也依赖真实沙箱；我此前将其按纯HTTP/Sharp归入仅 npm ci 的 API 组，漏追该运行前置。隔离副本中同一固定候选、同一真实用例在本机既有沙箱下通过，和云端缺执行文件的失败证据相符；不是需要放宽成功状态的业务差异。

本树对齐最终支持目录及公共 helper 到 `e9d7d59`，merge为 `b3e1ffd`，Agent生命周期 add/add 冲突完整采用该固定候选版本。唯一修正是将 `rebuilt/exam-paper.test.js` 移至 `rebuilt-outputs/exam-paper.test.js`，引用 `../rebuilt/helpers.js`，让现有输出组的 Bubblewrap/AppArmor 前置承担它；Job异常诊断改为完整 `current`。真实PNG、重启、固定定位、422拒绝及原考试不变断言全部保留，无skip、retries或伪造rendition。全局分组计数/文档/CI由总控维护。

- `node --test apps/api/test/rebuilt-outputs/exam-paper.test.js`：1 PASS、0 FAIL、0 skip；原日志 `test-results/test-suite-rebuild/author-a-ci-exam-output-pass.tap`。定点oxlint与diff检查通过。
- 重做原卷成员关系故障：临时绕过 source/location成员校验后，同账户源外定位仍返回200而应422，具名断言失败。补丁与红日志 `ci-exam-output-membership.patch`、`ci-exam-output-membership.tap`，没有减弱保护。
- 只运行这条用例及其成员关系负对照，没有重跑全组。未修改产品、公共fixture、package或CI；失败证据和固定候选副本保留在 `/tmp/teachbuddy-a-ci-preview-kghop0he`，入口 `author-a-ci-preview-workspace.json`。任务全成功后由总控连同既有清理清单精确归档/清理此新增现场。
