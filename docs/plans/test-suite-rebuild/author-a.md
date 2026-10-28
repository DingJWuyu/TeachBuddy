# 作者 A：业务与数据测试重建

## 固定现场与阶段

作者：gpt-6.1-sol / medium。工作树 `TeachBuddy-test-data`，分支 `test/rebuild-data`，空测试基线 `992172141f6664d4d851154cc533428414051c42`。总控已确认设计。当前候选已完成作者自验，等待独立消融与审查；尚未判断旧套件逐组去留、完成 CI 或集成。

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

## 候选与作者自验

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
