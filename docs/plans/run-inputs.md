# 能力与证据输入

当前组合的产品基线为 `a1feef7d21bad4afc436044b213316f8c3ddf86e`。具体运行状态与权限由 [run-state](run-state.md)拥有。以下是按能力读取的证据，不是要求新执行者重读的任务历史。

## 如何消费

- 本树文件直接按链接读取；`完整 SHA:路径` 用 `git show <SHA>:<path>`读取。分支名、当前 HEAD 和运行实例不是同一个版本。
- self / independent / user 保持原等级；已有报告的 PASS 只适用于其候选与具名范围。
- 当前文档整理不运行产品，不替旧报告增加新的 PASS。旧绝对路径按[归档索引](worktree-archive.md)恢复需要的材料。

<a id="模块输入"></a>
<a id="产品候选"></a>
## 当前手动能力

| 领域 | 当前组合中的能力与限制 | 按需证据 |
| --- | --- | --- |
| 题库 | 人工录题、分类、笔记、改编和原稿对照已接入；任意扫描材料自动提取未完成 | [作者](../acceptance/evidence/MANUAL-QUESTIONS/v1/receipt.md)、[DOC 接续](../acceptance/evidence/MANUAL-QUESTIONS/v1/continuation.md)、[跨模块独立验收](../acceptance/evidence/MANUAL-FLOW/v1/acceptance.md) |
| 资源与备课 | 人工资源管理、取材、更新对照、保存和输出已接入；当前转换运行依赖失效 | [资源作者](../acceptance/evidence/MANUAL-RESOURCES/v1/receipt.md)、[完整对照复验](../acceptance/evidence/MANUAL-FLOW/v1/recheck.md)，沿用其中注明的未变流程 |
| 数学 | 公式、静态图形、动态作品、源码/HTML、离线及往返已有具名本地证据 | [手动独立验收](../acceptance/evidence/MANUAL-MATH/v1/independent.md)、[非空稿保护复验](../acceptance/evidence/MANUAL-MATH/v1/independent-fix.md)；不代签完整 M44 |
| 班级与时间 | 人工记录、进度、日程、例外、提醒和关联已接入 | [作者](../acceptance/evidence/MANUAL-TEACHING/v1/receipt.md)、[内部审查](../acceptance/evidence/MANUAL-TEACHING/v1/review.md)；后者不是整阶段独立实测 |
| 数据 | 本地个人包、最近删除、维护备份/还原与身份撤销有独立证据 | [DATA](../acceptance/evidence/MANUAL-DATA/v1/independent.md)、[SUPPORT 具名切片](../acceptance/evidence/MANUAL-SUPPORT/v1/independent.md)、[原文件取回复验](../acceptance/evidence/MANUAL-SUPPORT/v1/recovery-independent.md) |
| 六模块 UI | 已集成 Impeccable 方向的模块页面、编辑器、取材和渐进交互 | [独立定向验收](../acceptance/evidence/UI-MODULES/independent.md)；不是全产品历史回归 |
| 设置 | 真实导出、最近删除、退出保留；其他仅 UI / 未接后端的部分见领域页 | [实际边界](../acceptance/evidence/UI-SETTINGS/status.md)；旧 SUPPORT 的可见页面不能覆盖当前设置决定 |
| 帮助和更新日志 | 中文目录/搜索/文章/返回现场；更新日志只保留图标 | [实际验收](../acceptance/evidence/UI-HELP/status.md) |

没有一份证据证明“全部非 Agent 范围已经没有缺口”。声明可用时按上表与当前环境说具体能力，不能沿用曾经的概括性承诺。

<a id="认证恢复"></a>
## 认证与恢复输入

- 原认证冻结：`6f3003250d170b44e89f6ac9b0a74f91d658a357:docs/contracts/auth.md`；本树同名文档解释约定，运行已接入真实 Cookie。
- 本地认证独立报告：`aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md`，real-auth / fake-mail / 自签 HTTPS，不包括所有外部条件。
- 内部恢复设计：`73d68c2e1ec864faac8ee49a8b5f9e6361e82964:docs/contracts/auth-recovery.md`。
- 固定操作实现：`627bf878d9b2ec57e8bc88a227337744c697a9ce`；A10 交接：`bda25ea14b2df0e683d8252110b884ae3b71eefd:docs/acceptance/evidence/A10/v1/recovery-handoff.md`。
- 实际手动组合恢复以当前 DATA/SUPPORT 报告为准。A10 的操作交接不代签完整部署恢复；设置已移除恢复现场 UI，底层保存机制仍保留。

<a id="可靠性"></a>
## 暂停与后续设计

| 输入 | 固定来源与当前用途 |
| --- | --- |
| F60 可靠性完整设计 | `31575c5c9d386c03a1f9fcde38b9a216f87a5b08:docs/contracts/reliability.md`；Agent/数据/现场各切片分开消费 |
| F60 独立冻结 | `68f799f93dfe254238ffe558c22273aa895ae5a4:docs/acceptance/evidence/F60/v1/correction-review.md`，设计已通过，不再派“修复工具分类设计” |
| 首批 Agent 结果 | `6d48bc7f214a6b27e51b3a8cbdfa6cffc212f4d1:docs/acceptance/evidence/C27/v1/math-recheck.md`，只证明首批具名工具；F61 全模块未完成，整条开发暂停 |
| 材料冻结 | `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1`；`88a89f00b78dd301ca9893a191277eb9970c4c18:docs/acceptance/evidence/R30/v1/final-review.md` |
| 数学交接 | `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md`；当前实现入口读 modules/math |
| 教学时间基础冻结 | `afda1c5d8d8c2de93f1e045ff2ad32e2681bd116`；`f9eb35f2180576daee4aedfb114049f4cb357694:docs/acceptance/evidence/T50/v1/correction2-review.md` |
| 教学作品扩展 | `a44587b9bd18618d77df13f7349f5043a297d226`；`3dbead5af93059b0f890c531097b234e5f453fae:docs/acceptance/evidence/T50-MATH-CONTRACT/v1/review.md` |
| 材料完整缺口 | `efd3b071a603d38902688b0b4dd68289e8516c69:docs/acceptance/evidence/R35/v1/local-review6.md`，消费其中未变的具名矩阵；后续人工/UI 成果按上表补充 |
| 未关闭传输观察 | `880e6e68be0855b3289dea8db3c87e8c67bc1042:docs/acceptance/evidence/R34/v1/restart-diagnosis2.md`，OBS-001/002 需新因果证据；不重复原输入诊断 |

<a id="c21"></a>
## 自动提取与开源复用

读取条件：本次任务确实要解决自动收题/OCR，而非普通手动 UI。

- [调查](../research/c21-open-source-reuse.md)。
- 冻结方案：`d690372c8f552e37690648f5688e04e1b68c4ae9:docs/arch/capability-checks/C21-reuse.md`。
- 独立结论：`436f2612b62cd40bb7f074ad68568d5bdd951f65:docs/acceptance/evidence/C20-C21-REUSE-PLAN/v1/review.md`。
- 固定六页：`ecd1ed6d8f974fba20ac92d40d5b6b943a3b0170:experiments/C21/next-1/`。

本地权重许可未有答复，不能下载或推理。若获授权再核对当次资源和方案限制；原始解析、自动归并与人工整理分开评价，失败不能自动缩减产品范围。

<a id="模型窗口"></a>
## 产品模型窗口

当前均关闭，不是可继续调用的余额；实际费用未知。产品白名单由[Agent 入口](../modules/agent.md)固定。

| 范围 | 已记录消耗与接续边界 |
| --- | --- |
| C21 在线 | 19 次，16 份 usage，108777 已知 completion；3 份缺失及 online-1 预留 8000 未知；未使用窗口已作废，新请求许可 0 |
| C24 业务 | 32 次 DeepSeek、93970 total；`e8fdf9a139e429c05590925647a433a9da382579:docs/acceptance/evidence/C24/v1/business-fix.md`；早期探针另计 |
| C26 自验 | 10 次 / 79983 total；原 `ec5094c00d122c77d2acdb376f4ede96eafb13e0` 作者回执 |
| C27 独立 | 11 次 / 88550 total；live `34e668ae97e1eb0cd5744550b6b05a4c25aa9301`，后继排版复验无新增 |

更早 EMODEL/C23 以对应原回执为准，此表不声称项目总量。恢复工作不重置累计消耗或扩大模型白名单。

<a id="真人交接"></a>
## 真人与目标环境

原始记录：[私有真人交接](../../.scratch/worktree-consolidation/human-acceptance-20260922.md)，SHA-256 `5c09e0cd73facb2c4b9b07394f427bbaa09a5db9a580bf2779917943d28ea65c`；只读，不把它复制成新一轮机器验收。

- Office：原制品存在 Word/WPS 失败；Pandoc 样例有具名成功反馈，正式代码已换路线，但目标软件完整编辑与同内容 PDF 尚未收齐。当前本机另有工具路径问题。
- 数学：个人 Windows Edge/Chrome 断网冷启动具名切片通过；课堂设备仍未验证。
- 邮件：用户真实 QQ 收件、注册、找回与新旧密码验证通过。之后预览发信曾受整机代理影响，用户已自行解决；不因此擅改整机网络。
- iPad/学校网络不可达尚未确诊，未完成跨设备验收；环境暂缓，不当成产品已 FAIL 或 PASS。
- 部署：暂无正式交付环境，用户将另行选择服务器和域名；不采购、不付费、不部署。

<a id="运行位置"></a>
## 查找原始材料

固定报告优先用 Git 对象。确实需要未提交现场、来源路径或会话材料时读[归档索引](worktree-archive.md)。不要因源目录已删除重做整个实验，也不要把含凭据归档回写正在运行的 preview。
