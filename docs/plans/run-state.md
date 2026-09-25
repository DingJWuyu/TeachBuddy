# 当前状态与下一步

## 工作现场与授权

唯一开发树 `/home/liam_t/项目/TeacherWorkspace-preview`，分支 `preview/usable-mvp`。原 `/home/liam_t/项目/TeacherWorkspace` 的 main 保持不动。业务/UI 组合基线 `a1feef7d21bad4afc436044b213316f8c3ddf86e`；当前 HEAD 与未提交修改用 Git 核对，不以文档快照代替。

下一项开发由用户指定。资料维护可调整导航和测试输出归属，保持运行依赖及固定输入完整；不改用户运行实例，不新建 worktree，不合 main、不 push、不部署。产品 Agent 和全站外壳改造持续暂停；目标 Word/WPS、课堂设备、iPad/大陆网络和正式部署验证暂缓。

当前无活动派发任务。无定时 check，不轮询。

## 已有能力与尚缺结果

| 范围 | 当前事实 | 未完成与下一动作 |
| --- | --- | --- |
| 手动六模块 | 业务及新版页面已在同一树，题库/资源/备课/数学/教学日程有不同等级的局部结果 | 按[能力证据](#证据边界)限定声明；没有“全部非 Agent 无缺口”的证据 |
| 题库自动整理 | 文字/DOCX 原生与文字层 PDF 有固定样本结果，人工校对可持久保存 | 扫描/图片无生产视觉 provider，多栏/跨页/复杂 DOC 不完整；本地 OCR 权重许可未答复，旧在线窗口关闭。后继读[自动提取方案](../research/c21-open-source-reuse.md) |
| 预览与输出环境 | 服务 active/running，`https://localhost:50880`；runtime.env 中 LibreOffice、Pandoc 两个路径均指向不存在的旧工作树 | 只核实未修复。获维护授权后从稳定工具目录配置，再实际生成/打开文件验证；页面在线不能证明输出可用 |
| 设置与帮助 | 导出、退出有真接线；主题/背景全站应用，头像同步侧栏，三者按账户保存；帮助已接中文内容与搜索 | 语言未应用，删除账户禁用；设置无周起点及最近删除聚合，具体[设置边界](../features/settings.md) |
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

- 旧 Office 制品有 Word/WPS 失败；Pandoc 小样有真人两轮编辑、重开及打印成功反馈，但软件版本和改后制品未收齐，不能代签六份完整输出。当前产品已换路线，仍有工具路径失效。可用输入与核对方法见[人工 Office 样本](../acceptance/samples.md#人工-office-样本)。
- 个人 Windows Edge/Chrome 断网冷启动具名切片通过，课堂设备仍未测。
- 用户真实 QQ 收件、注册、找回及新旧密码验证通过；预览邮件曾受代理影响，用户已自行解决，不因此重改整机网络。
- iPad/学校网络不可达尚未确诊，暂缓目标验证；不能写为产品已 FAIL 或 PASS。
- 正式主机/域名由用户后续选择，暂无部署交付；不采购、不付费、不发布。

</details>
