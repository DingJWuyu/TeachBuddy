# 当前状态与下一步

## 工作现场与授权

`/home/liam_t/项目/TeacherWorkspace-preview` 是集成树。五个模块各有现存 worktree 和 Codex session，见下表；原 `TeacherWorkspace` 的 main 保持不动。当前分支、HEAD 与未提交修改用 Git 核对，不以文档快照代替。

用户授权“总控”session 读取五个会话、收发消息、协调下一步和处理回到 preview 的集成冲突。五模块集成与 worktree 同步已完成，模块继续暂停新增功能，等待下一轮明确任务；同步不自动恢复开发或更新实例。AI/Agent worktree 不在本轮范围，不扩展全站外壳、文件物理回收或目标设备验证。

总控统一负责共享文件、集成候选与实例更新安排；合 main、push、公开部署仍各需对应授权。用户明确现有真实和临时实例的数据全部为可丢弃测试数据，总控可按集成需要清空或重建，不以旧库/旧草稿保留和历史版本迁移作为本轮前置。代码、未提交成果、固定测试输入和运行配置不属于可丢弃业务数据。接收会话回执使用等待通知，不定时轮询。

## 五模块共同基线

五个模块的已提交成果、未提交 diff 和新增源码均已集成到 preview。五个原 worktree 已保留各自分支并快进到同一共同基线，包含[模块开发约定](../agents/module-development.md)和 AGENTS 阅读入口。受测产品代码为 `0e3a0cc3`；当前共同 HEAD 由 Git 核对，后续差异是文档维护。

所有目录均位于 `/home/liam_t/项目/`。五个模块工作区均干净；原未提交成果已经包含在共同基线内，不重新应用旧 diff。下一轮获准开发后，从该基线形成新的修改，提交方式按当轮指令执行。preview 单独保留用户原有的一条 AGENTS 未提交修改，不混入本次同步。

各树依赖已按共同锁文件对齐，shared 装配与干净 API 初始化分别通过。集成输入摘要在 `.scratch/five-module-integration/inputs.json`，同步版本与 session 回执在 `.scratch/five-module-sync/`。本轮没有重启实例、覆盖服务构建或清理现有实例数据。

| 模块 / session 名称 | Worktree | 已纳入共同基线 | 剩余范围 |
| --- | --- | --- | --- |
| 班级教学 / 班级教学专用 | `TeacherWorkspace-classes` | 记录搜索、课前回顾、公式图片、跨班移动 | 已知模块功能清单完成，真实设备仍待验 |
| 题库 / 题库专用 | `TeacherWorkspace-questions` | 导入保真、检索、常规双栏 PDF 与明确续题 | OCR、复杂混排 |
| 资源库 / 资源库模块专用 | `TeacherWorkspace-resources` | 批量整理、文件历史、正文搜索、命中页定位和文字复制 | OCR、独立页内查找、复杂结构复制；文件回收暂缓 |
| 数学 / 数学工坊管理 | `TeacherWorkspace-math` | 可视化编辑、历史恢复、表达式、几何、截面与动画扩展 | 高级求解等独立后续项；不要求旧 v4 测试库/备份包兼容 |
| 备课 / 聚焦备课功能模块 | `TeacherWorkspace-lessons` | 复制、撤销、输出选择、历史恢复、环节复用、正文混排与资源原页输出 | 可编辑导入/OCR、个人资料包携带课稿历史 |

### 验证与边界

共同候选已通过 shared/API/Web 构建，干净库完整初始化 21 项模块迁移。依赖锁文件由 npm 生成，PDF worker/CMap/字体与数学离线资产进入隔离 Web 构建。

| 验证入口 | 结果 | 覆盖与限制 |
| --- | --- | --- |
| `math-workspace.config.mjs` | 23 通过 | 公式、图形、几何、动态、历史与离线演示 |
| `resources-ui.config.mjs` | 23 通过 | 真实 PDF/Word/PPT、批量整理、历史、正文搜索与复制 |
| `questions-ux.config.mjs` | 27 通过 | 收录校对、原稿、检索与布局；没有将 OCR 缺口计为通过 |
| `classes-journal.config.mjs` | 22 通过 | 记录搜索、公式图片与跨班移动 |
| `manual-lessons.config.mjs` | 29 通过 | 历史恢复、环节复用、混排、取材与真实 Word/PDF 输出；局部文字颜色修正后另有 1 条定向 E2E 及深浅主题 1440/390px 截图复验通过 |
| 五模块与可靠性 API/集成测试 | 159 通过、0 失败、5 跳过 | 题目/资源/数学来源彻底删除后，已采用快照、题目改编、个人资料包、同版备份还原和备课历史恢复仍可用；跨账户来源、无效历史内容和缺失附件被拒绝 |

浏览器合计 124 条，无失败或跳过。五项 API 跳过均因固定外部输入不可用：三项题库旧库/原稿用例、两项数学 P/M 外部库用例；不将跳过写为通过。没有为可丢弃旧数据新增兼容路径。模块截图由原作者复核，总控另核对修正后的弹窗；这不等价于独立全产品验收或目标设备实测。

验证日志与输入摘要保留于 `.scratch/five-module-integration/`，备课整体验证及弹窗截图位于 `test-results/five-module-integration/`。其余模块截图目录分别为 `test-results/math-workspace/`、`resources-ui/`、`questions-ux/`、`classes-journal/`。测试入口均在 `apps/web/e2e/`；API 命令与各结果见集成目录的 `result.json`。临时补丁包、隔离构建和测试库完成后清理，重跑时按 [SETUP](../SETUP.md#新的隔离环境) 重新构建。

OCR 不阻塞这批成果集成。后续由题库提供识别实验与校对经验，资源库提供文件/页级文字基础，备课消费结果；总控先明确共用结果及职责，再派发实现。文件回收继续暂缓，直到所有历史、引用和任务的保留规则完整。

### 运行实例与工具

`https://localhost:50880` 尚未更新到共同基线。API 来自 `.scratch/preview/deployed-source`，前端来自 `apps/web/dist`；数据库 `.scratch/preview/data/workspace.sqlite`，文件 `.scratch/preview/files`。该部署快照包含备课未提交成果，另外四模块是集成前实现，不能用 preview 的 Git HEAD 代表实例版本。

四个模块临时实例与其数据未改动，备课临时实例已停止。所有业务数据均为可丢弃测试数据；实例切换和数据清理由总控另行安排。

本轮隔离验证使用持久目录 `/home/liam_t/.local/share/teacherworkspace-tools/` 中的 Xpdf 4.06、Pandoc 3.11 与 LibreOffice 26.8。三个工具变量的具体路径见 `.scratch/five-module-integration/tools.env`，用途见 [SETUP](../SETUP.md#文件转换工具)；正式切换时须让实际服务加载同一组工具配置。

## 已有能力与尚缺结果

| 范围 | 当前事实 | 未完成与下一动作 |
| --- | --- | --- |
| 手动六模块 | preview 已集成五模块新增成果，并通过上述组合验证 | 按[能力证据](#证据边界)限定声明；没有“全部非 Agent 无缺口”的证据 |
| 题库自动整理 | preview 已支持常规双栏文字 PDF，人工校对可持久保存 | 扫描/图片无生产视觉 provider；隔离 OCR 实验整管线超时。复杂图文/跨页/旧 DOC 仍有限制，后继读[自动提取方案](../research/c21-open-source-reuse.md) |
| 预览与输出环境 | 隔离候选的真实 Word/PDF 输出通过，50880 仍运行旧部署快照 | 按上节对齐代码、工具、构建与真实数据；页面在线不能证明五模块输出可用 |
| 设置与帮助 | 导出、退出有真接线；主题/背景全站应用，头像同步侧栏，三者按账户保存；帮助已接中文内容与搜索 | 语言未应用，删除账户禁用；设置无周起点及最近删除聚合，具体[设置边界](../features/settings.md) |
| 数据与恢复 | 手动资料包、误删恢复、维护备份/还原及身份撤销有本地独立切片 | 当前设置不展示旧恢复现场 UI；全范围恢复、第二设备和正式部署不能由局部结果代签 |
| UI/UX | 模块、设置、帮助已集成，仍待用户认可整体体验 | 用户授权具体页面后按该页规格改进，保住既有功能；不恢复全站外壳任务 |
| 产品 Agent | 首批代码和有限模型结果保留，F60 全范围设计已冻结 | 全六模块工具/集成未完整交付，整线暂停，不能调用旧预算继续实验 |
| 目标环境 | 真人 QQ 邮件、个人 Windows 离线演示有具名反馈 | Word/WPS 全套编辑/打印、课堂设备、iPad/学校网络、正式部署均未闭环，暂缓不等于 PASS |

## 接续决定

第一步集成与验证、第二步 worktree 同步均已完成。五个业务 session 继续待命，下一轮先由总控明确共同缺口及各模块分工，再恢复开发；实例更新另行安排。不因[DAG 剩余节点](mvp-dag.md)自行扩展到其他产品线，也不重新派发已完成的设计与接线。

后续任务从同步后的对应 worktree 的[功能规格](../README.md#功能规格)取相关资料。按实际共享文件安排唯一写者。运行维护读[SETUP](../SETUP.md)；需要更早的归档现场才读[工作树恢复索引](worktree-archive.md)。

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
