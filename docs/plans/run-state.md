# 当前状态与下一步

## 工作现场与授权

唯一开发树 `/home/liam_t/项目/TeacherWorkspace-preview`，分支 `preview/usable-mvp`。原 `/home/liam_t/项目/TeacherWorkspace` 的 main 保持不动。业务/UI 组合基线 `a1feef7d21bad4afc436044b213316f8c3ddf86e`；当前 HEAD 与未提交修改用 Git 核对，不以文档快照代替。

文档及附属资料整理已完成，当前等待用户指定下一项工作。仅资料整理授权，运行和测试输入保持原链路；不改业务/配置/运行实例，不新建 worktree，不合 main、不 push、不部署。产品 Agent 和全站外壳改造持续暂停；目标 Word/WPS、课堂设备、iPad/大陆网络和正式部署验证暂缓。

当前无活动派发任务。无定时 check，不轮询。

## 已有能力与尚缺结果

| 范围 | 当前事实 | 未完成与下一动作 |
| --- | --- | --- |
| 手动六模块 | 业务及新版页面已在同一树，题库/资源/备课/数学/教学日程有不同等级的局部结果 | 按[能力证据](#证据边界)限定声明；没有“全部非 Agent 无缺口”的证据 |
| 题库自动整理 | 文字/DOCX 原生与文字层 PDF 有固定样本结果，人工校对可持久保存 | 扫描/图片无生产视觉 provider，多栏/跨页/复杂 DOC 不完整；本地 OCR 权重许可未答复，旧在线窗口关闭。后继读[自动提取方案](../research/c21-open-source-reuse.md) |
| 预览与输出环境 | 服务 active/running，`https://localhost:50880`；runtime.env 中 LibreOffice、Pandoc 两个路径均指向不存在的旧工作树 | 只核实未修复。获维护授权后从稳定工具目录配置，再实际生成/打开文件验证；页面在线不能证明输出可用 |
| 设置与帮助 | 导出、最近删除、退出有真接线；帮助已接中文内容与搜索 | 头像/主题/背景/语言/周起点没有完整账户保存，全站偏好未完成，删除账户禁用；具体[设置边界](../features/settings.md) |
| 数据与恢复 | 手动资料包、误删恢复、维护备份/还原及身份撤销有本地独立切片 | 当前设置不展示旧恢复现场 UI；全范围恢复、第二设备和正式部署不能由局部结果代签 |
| UI/UX | 模块、设置、帮助已集成，仍待用户认可整体体验 | 用户授权具体页面后按该页规格改进，保住既有功能；不恢复全站外壳任务 |
| 产品 Agent | 首批代码和有限模型结果保留，F60 全范围设计已冻结 | 全六模块工具/集成未完整交付，整线暂停，不能调用旧预算继续实验 |
| 目标环境 | 真人 QQ 邮件、个人 Windows 离线演示有具名反馈 | Word/WPS 全套编辑/打印、课堂设备、iPad/学校网络、正式部署均未闭环，暂缓不等于 PASS |

## 接续决定

下一项工作由用户指定。已知业务、环境和 UI 缺口保留在上表及相关功能规格中，不因[DAG 剩余节点](mvp-dag.md)自行开工，也不重新派发已完成的设计与接线。

后续获准任务从[功能规格](../README.md#功能规格)取相关资料，按实际共享文件安排唯一写者。运行维护读[SETUP](../SETUP.md)；需要旧未提交材料才读[工作树恢复索引](worktree-archive.md)。

## 证据边界

<details>
<summary>核查能力结论或固定输入时展开</summary>

下面概括上表结论所依据的具名结果，仅在核查能力声明或复用固定输入时展开。报告中的 PASS 只适用于其受测版本与范围。文档整理未运行产品，不新增产品 PASS。

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

### 契约与尚有消费者的固定来源

`SHA:路径` 用 `git show <SHA>:<路径>` 读取。当前 Markdown 已整理，原固定候选的字节和独立判断仍由 Git 保存。

| 定义 / 结果 | 固定来源 |
| --- | --- |
| 真实认证 rc.2 | `6f3003250d170b44e89f6ac9b0a74f91d658a357:docs/contracts/auth.md`；本地 real-auth/fake-mail 独立报告 `aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md` |
| 认证恢复操作与交接 | `73d68c2e1ec864faac8ee49a8b5f9e6361e82964:docs/contracts/auth-recovery.md`；操作实现 `627bf878d9b2ec57e8bc88a227337744c697a9ce`；`bda25ea14b2df0e683d8252110b884ae3b71eefd:docs/acceptance/evidence/A10/v1/recovery-handoff.md` |
| 完整可靠性 F60 已冻结 | `31575c5c9d386c03a1f9fcde38b9a216f87a5b08:docs/contracts/reliability.md`及同提交 schema；独立 `68f799f93dfe254238ffe558c22273aa895ae5a4:docs/acceptance/evidence/F60/v1/correction-review.md`。手动有效语义已汇入[数据管理](../features/data.md)，Agent 暂停 |
| 首批 Agent 具名结果 | `6d48bc7f214a6b27e51b3a8cbdfa6cffc212f4d1:docs/acceptance/evidence/C27/v1/math-recheck.md`，不证明 F61 全模块 |
| 材料定义及完整缺口 | 设计 `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1`，独立 `88a89f00b78dd301ca9893a191277eb9970c4c18:docs/acceptance/evidence/R30/v1/final-review.md`；完整矩阵 `efd3b071a603d38902688b0b4dd68289e8516c69:docs/acceptance/evidence/R35/v1/local-review6.md`。仅消费未变具名项 |
| OBS-001/002 未关闭观察 | `880e6e68be0855b3289dea8db3c87e8c67bc1042:docs/acceptance/evidence/R34/v1/restart-diagnosis2.md`；新增错误可区分不等于根因已证实 |
| 数学设计 | `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md` |
| 教学时间与数学扩展 | 基础 `afda1c5d8d8c2de93f1e045ff2ad32e2681bd116`，独立 `f9eb35f2180576daee4aedfb114049f4cb357694:docs/acceptance/evidence/T50/v1/correction2-review.md`；扩展 `a44587b9bd18618d77df13f7349f5043a297d226`，独立 `3dbead5af93059b0f890c531097b234e5f453fae:docs/acceptance/evidence/T50-MATH-CONTRACT/v1/review.md` |
| 本地 OCR 实验方案 | `d690372c8f552e37690648f5688e04e1b68c4ae9:docs/arch/capability-checks/C21-reuse.md`，独立 `436f2612b62cd40bb7f074ad68568d5bdd951f65:docs/acceptance/evidence/C20-C21-REUSE-PLAN/v1/review.md`；固定六页 `ecd1ed6d8f974fba20ac92d40d5b6b943a3b0170:experiments/C21/next-1/`。本地权重未获许可 |

### 真人与目标环境

原始记录在 `.scratch/worktree-consolidation/human-acceptance-20260922.md`，SHA-256 `5c09e0cd73facb2c4b9b07394f427bbaa09a5db9a580bf2779917943d28ea65c`；定位旧现场才读[恢复索引](worktree-archive.md)。

- 旧 Office 制品有 Word/WPS 失败；Pandoc 小样有真人两轮编辑、重开及打印成功反馈，但软件版本和改后制品未收齐，不能代签六份完整输出。当前产品已换路线，仍有工具路径失效。可用输入与核对方法见[人工 Office 样本](../acceptance/samples.md#人工-office-样本)。
- 个人 Windows Edge/Chrome 断网冷启动具名切片通过，课堂设备仍未测。
- 用户真实 QQ 收件、注册、找回及新旧密码验证通过；预览邮件曾受代理影响，用户已自行解决，不因此重改整机网络。
- iPad/学校网络不可达尚未确诊，暂缓目标验证；不能写为产品已 FAIL 或 PASS。
- 正式主机/域名由用户后续选择，暂无部署交付；不采购、不付费、不发布。

</details>
