# MVP 规划按角色拆分独立审查

**结论：PASS。必须修复项：无。四种角色的按需读取成立，无需派修订，可将本报告与下列固定版本文档交用户评阅。产品实施仍停在 G00。**

审查日期：2026-09-21。独立 session ID：`01a0c480-d75b-76f1-bf01-d03e40d7336c`。本 session 未参与作者设计，未联系作者或创建其他 session。作者回执只用于定位检查点；结论来自当前文本、拆分前快照、局部阅读演练及独立比对，不继承旧 PASS。

**核查范围与限制**

核查根 AGENTS、README、ROADMAP、DAG、执行协议、任务包模板、七份阶段任务说明、验收矩阵和旧审查的历史标识。以 PRODUCT_SCOPE 的能力与边界、WORKBENCH_DESIGN 的相关流程、设计与验证规则及 ADR 0001 核对范围和职责。先读取 writing-for-agents 技能，以指针触发条件、常驻上下文成本、单一真相和完成条件作为信息架构判据。

这是规划文档审查及静态阅读演练，没有启动产品、浏览器、测试或未来节点。B11 的冻结契约、B12 的运行回执、B15 的候选尚待未来节点产生。本报告验证入口能提供哪些要求、缺输入时如何停止，不声称这些未来输入已存在，也不保证尚未填写的任务包或未来产品通过验收。没有重新核验认证服务、模型或部署环境的实际能力。

**四种角色的实际读取路径**

共同入口为本次指令和[根 AGENTS 的项目入口及稳定规则](../../AGENTS.md)。AGENTS 已删除“接手先读 README/ROADMAP”和“按 ROADMAP 推进”的全员入口，改为按任务触发：查实际状态才读 README，编排才读 DAG，执行角色从任务包的具体章节进入。UI 规则、认证交接各有触发条件。没有新增全员通读 DAG、协议或矩阵的义务。

| 角色与本次演练 | 实际读取路径 | 能完成的局部职责与无需展开的内容 |
| --- | --- | --- |
| 编排者 | [DAG](mvp-dag.md) -> [编排协议](execution-protocol.md#orchestration) -> [任务包模板](task-package.md)，再取得所选节点的固定依赖回执与冻结任务包 | DAG 给节点、依赖、产物、验收与失败去向；协议给派发、版本、限次、独立性及主动回执；模板给字段齐全性。无需读取七份任务细节来补设计，也无需自行评判全范围覆盖或视觉。 |
| 设计者，以 B11 为例 | 任务包 -> [设计协议](execution-protocol.md#design)及[回执](execution-protocol.md#receipt) -> [首条流程的设计输入](tasks/first-flow.md#设计与交接时的基线输入)及[B11](tasks/first-flow.md#b11) -> PRODUCT_SCOPE 题库、备课、跨模块、基础交付相关段落，WORKBENCH_DESIGN 整体结构、题库、备课相关段落和 [ADR 0001](../adr/0001-use-a-single-static-module-catalog.md) -> [设计冻结验收](../acceptance/mvp-matrix.md#design-review) | 可确定本轮用户流程、共享语义、设计产物和后续任务包。编制写入清单触发 [ownership](execution-protocol.md#ownership)，UI 决定触发设计规则；不用先掌握全 DAG、模型升级及其他批次操作流程。 |
| 实现者，以 B13 为例 | 填好的任务包 -> [实现协议](execution-protocol.md#implementation)及[回执](execution-protocol.md#receipt) -> [B13](tasks/first-flow.md#b13) -> B11 相关冻结 API/schema/场景、B12 固定运行回执 -> 矩阵 [evidence](../acceptance/mvp-matrix.md#evidence)、[persistence](../acceptance/mvp-matrix.md#persistence)、[backend-self](../acceptance/mvp-matrix.md#backend-self) | 获得本模块目标、写入边界、API 自验、缺契约时的阻塞规则和移交方式。写迁移再读 ownership，承担集成才读 integration。无需 UI 视觉规则、编排政策或全范围表。 |
| 独立验收者，以 B16 为例 | 填好的任务包 -> [验收协议](execution-protocol.md#acceptance)及[回执](execution-protocol.md#receipt) -> B15 固定候选及运行说明、首条 .feature/UX -> 矩阵 [B16](../acceptance/mvp-matrix.md#b16)、evidence、persistence、[browser](../acceptance/mvp-matrix.md#browser)、[visual](../acceptance/mvp-matrix.md#visual) -> [设计与验证规则](../rules/design-and-verification.md) | 可独立重启、走首条真实流程及失败恢复、裁决证据并回报缺陷。仅为失败定位补读相关实现；无需材料、数学、日程说明或完整范围映射。 |

以上路径按章节提取复核，没有将协议的其他角色章节暗中当作执行角色的必读输入。回执是明确的公共必读章节；ownership/integration 是明确的条件章节。设计冻结条目中的 M40/T50/F60 要求有节点限定，不会把 B11 扩大成全范围设计。F60/F65/D72 的全范围职责才触发完整映射，符合其工作范围。

**B13 后端 CRUD 阅读演练**

只使用上表 B13 路径检查以下六项；没有用 DAG 的调度细节填补实现者的知识缺口。

| 所需信息 | 局部入口提供的内容与判断 |
| --- | --- |
| 目标 | B13 明确自建、读取、编辑、复制改编、备课环节增删排序和引用真实落库；笔记分离、账户隔离、冲突/重复请求、删除恢复及重启一致性均在本节点。 |
| 输入 | 任务包固定相关 B11 契约操作和场景、B12 运行回执，以及基线、身份模式和隔离工作区。无需沿 B12 回溯完整依赖链。具体字段和启动命令等待未来设计与底座产物，当前没有伪造它们。 |
| 写入边界 | 本节点限 questions/lessons API、所属迁移/仓储和 API 测试，共享文件只读。任务包必须进一步列精确文件；迁移触发 ownership 的唯一写者、迁移不改写和空库/升级库要求。 |
| 完成条件 | backend-self 明确只自验冻结 API/契约场景，真实落库、关联、重启读回、隔离、冲突/重复请求与保存失败。persistence 的全产品质量要求按该切片和当前身份模式适用，不把浏览器/跨设备阶段放行交给 B13。 |
| 回执和移交 | receipt 给版本、实际改动、检查与证据、身份局限、失败拥有者及下一步条件；实现协议要求标 self。B15 接真实前端、B16 独立浏览器验收仍保留。 |
| 阻塞处理 | 精确写入清单或契约缺失即 BLOCKED；不猜字段、不扩大权限。任务包列设计拥有者和外部提供者；回执列缺失输入、解除证据和仍可继续的独立工作，由外层通知编排者。 |

演练结论：入口充分，读取范围局部。若现在拿模板直接开工，必需输入尚缺，正确结果是停止派发；这是未来设计依赖，并非本轮信息架构缺陷。发现实际产品缺陷时仍按实现协议从真实用户路径复现，不因“纯后端”免除该要求。

**B16 UI/浏览器验收阅读演练**

只使用上表 B16 路径，核对它能独立作出 PASS/FAIL/BLOCKED，而不承担实现或全项目验收。

| 所需信息 | 局部入口提供的内容与判断 |
| --- | --- |
| 目标和受测输入 | B16 指定 B15 候选、运行说明和首条 .feature；任务包固定版本、UX、样本、启动和故障复现入口。验收对象是实际候选，不是作者自验或原型截图。 |
| 写入边界与独立性 | B16 输出独立报告和证据索引，精确路径由任务包给出；验收协议禁止 reviewer 修改产品或降低门槛，也不能由本批设计或实现作者担任。 |
| 行为和数据条件 | 新数据目录独立启动，普通浏览器事件完成链路及至少一次失败恢复；检查网络、重启读回、B12 两账户、空库/升级库、启动失败退出、构建隔离，以及 B15 实际故障拒绝假保存的证据。 |
| UI 与浏览器证据 | browser 要求真实服务及普通点击、键盘、拖选、上传和下载；合成事件只作机制探查。visual 和设计规则给三类视口、长内容/空态/错误态、紧凑控件、区域滚动、右栏、动效和生产构建要求。 |
| 完成与阻塞 | 本次必验条目全部通过且无阻断缺陷才 PASS；可复现缺陷为 FAIL；缺必要身份、设备、凭据或材料为 BLOCKED。早期测试身份必须标明局限，不因此宣称 A12 或完整 MVP 已通过。 |
| 回执与失败移交 | 逐场景预期/实际、截图/trace、脱敏网络及服务日志能让新实现者原样复现；receipt 标 independent，附拥有者和解除条件。失败归属从任务包取得，不要求 reviewer 阅读重试次数或模型升级政策。 |

演练结论：入口充分，职责清楚。B16 不需要展开 scope 表或其他阶段验收。设计规则本身包含既有通用 UI 经验，其 ROADMAP 指针抵达的是新的导航和角色入口，没有重新引入全员按旧三 Agent 流程工作的义务。

**迁移完整性及拓扑核查**

采用一次性的本地文本提取、集合比对及人工语义复核，没有新增校验工具或调度设施。数字用于发现遗漏，不单独充当通过理由。

| 检查 | 独立结果 |
| --- | --- |
| DAG 主体 | 663 行变为 269 行。缩短来自迁出角色流程、执行细节和范围映射，调度表仍保留输入、产物和失败去向。 |
| 图与节点 | 新旧 Mermaid 块逐字相同；50 个交付节点、3 个外部输入、59 条互不重复的边；拓扑排序覆盖全部 53 个顶点。50 个派发表节点与图一致，无缺失或新增节点。 |
| 图与派发表依赖 | 逐节点对照旧输入和新表。A10/C24/D71 将已有外部条件显式命名为 EAUTH/EMODEL/EHOST，没有新加依赖。表中补列的传递输入均为既有祖先。B14 的“与 B13 相同的 B11 契约”是同版约束，不是 B13 -> B14 新边；原有条件并行仍成立。 |
| 关键顺序 | B16 后才做 C20；A12/C27/T54 共同阻挡 F60；T50 可先设计而 T51 仍等 M44；D72 -> G73 -> D74 -> D75 -> G76 均保留。失败是原节点 attempt 或新版本实例，没有画返回边改变 DAG。 |
| 范围映射 | [scope](../acceptance/mvp-matrix.md#scope) 的 18 行及四列与旧表逐字相同。检查了设计、实现、独立验收的节点关联，而非只数行。DAG 只指向该表，ROADMAP 不再保留第二套映射。 |
| 51 条节点交付要求 | 口径是 B10 及以后非用户节点的“产物/完成”“产物还包括”“完成还要求”段落，共 51 条，其中 50 条原文可在新任务说明或矩阵找到。唯一改写为 B10，把“旧 ROADMAP 只导航到本文”改为“ROADMAP 只导航到交付 DAG”，其余完成条件保留。 |
| 规划和授权节点 | 另核对 P00/P01/G00/G73/G76 的五条完成要求，合计旧文共 56 个上述段落。P00 改为多文档交付是本次授权范围；P01 的无环、范围、权限和可派发性审查仍在；三处用户门禁的权限与完成语义保留。 |
| 设计与验收约束 | 设计产物分配到 design 章节；实验复核归 experiments；节点验收移到矩阵相应锚点。失败拥有者保留在调度表，写入限制和节点补充边界保留在任务说明。未发现因迁移而无人负责的必要约束。 |

进一步沿实际能力核查了以下迁移链，确认范围表后面仍有交付与验收内容：

| 能力 | 迁移后的可核查链路 |
| --- | --- |
| 题目与备课真实保存、引用和失败反馈 | [B11-B15](tasks/first-flow.md#b11) -> [B16](../acceptance/mvp-matrix.md#b16)，含 B12 反馈底座及 B15 主动故障证明。 |
| 四入口自动拆题、Office 真预览与六种输出 | [C21/C22](tasks/capabilities.md#c21) 的原材料实验 -> [R30-R34](tasks/materials.md#r30) -> [R35](../acceptance/mvp-matrix.md#r35)，不能降格为手工录入、封面或截图式 DOCX。 |
| 数学制作、二次修改、源码、离线及往返 | [C23](tasks/capabilities.md#c23) -> [M40-M43](tasks/math.md#m40) -> [M44](../acceptance/mvp-matrix.md#m44)，导入预览和视频仍不能替代自产交互作品。 |
| 两班反馈、重复例外和关闭期间提醒 | [T50-T53](tasks/teaching-time.md#t50) -> [T54](../acceptance/mvp-matrix.md#t54)，真实拖选、日期边界与重启要求保留。 |
| pi 真调用、全模块操作、保存与恢复 | [C24-C26](tasks/capabilities.md#c24) -> [C27](../acceptance/mvp-matrix.md#c27)，再经 [F60-F64](tasks/reliability.md#f60) -> [F65](../acceptance/mvp-matrix.md#f65)，含真实身份回归、文件/源码/对话/关联的干净目录恢复。 |
| 真实认证与最终交付 | [A10/A11](tasks/first-flow.md#a10) -> [A12](../acceptance/mvp-matrix.md#a12)，认证代码仍归外部；[D70/D71/D74](tasks/delivery.md#d70) 与 D72/D75 仍区分验收候选、获准动作及最终版本复验。 |

**规则保护、单一真相及阅读成本**

- AGENTS 从 `## Rules` 到文件末尾与拆分前快照逐字相同。Git、UI 规则及禁止 UI 单元测试、禁止轮询、禁止 overengineering、dsh、issue/triage/domain 指针完整保留。不能用相对 HEAD 的新增行误判这些用户条款为作者越界修改。
- README 相对当前 HEAD 只有四处入口/指向调整，实际状态表及“尚未交付真实 MVP”没有升格。ROADMAP 删除竞争执行流程，明确新 DAG、角色入口、原工作未实施和认证仍待交付；PRODUCT_SCOPE 等旧文档中的 ROADMAP 指针因此有明确承接。
- [编排协议](execution-protocol.md#orchestration)保留独立新 session、禁止 resume/fork/协作 subagent、设计后独立审查、失败按拥有者返回、有限重试及外层主动通知。根编排者仍只派发、收回执、核依赖与授权，不设计、不实现、不实质审查。没有借本次拆分改换调度策略。
- [用户门禁](mvp-dag.md#用户门禁)仍要求同版本计划先审查再获 G00 授权；main 合并及发布动作须有相应许可；既有同范围授权可引用；只有用户能作 G76 验收。当前文档整理不等于执行 B10。
- 范围归 PRODUCT_SCOPE，页面行为归 WORKBENCH_DESIGN，视觉细则归设计规则，稳定仓库规则归 AGENTS；节点调度归 DAG，角色操作归执行协议，任务包格式归模板，节点交付细节归阶段说明，范围映射及验收证据归矩阵。摘要和指针没有形成第二套竞争流程。共同约束重复出现时有明确上位来源，例如矩阵将 UI 单元测试禁令指回 AGENTS，将 CSS 构建要求指回设计规则。
- 七份阶段说明各有实际批次消费者，且都有节点锚点；它们不是每个 worker 必须遍历的七段手册。任务包模板给设计者填写，执行者只收到填好的包。协议按角色划分，矩阵按证据种类和验收节点划分，职责与触发条件足以抵偿新增文件的查找成本。
- [任务包](task-package.md)用完整 commit + path + 章节固定 Git 输入；只对未提交、外部样本或无法由 commit 定位的证据按需哈希。没有把本次逐文件哈希比对、手工拓扑核查或机械格式化设为每次产品任务的主流程。阶段文档同步是原有要求，本次没有新增一轮同步门禁。
- 活跃规划文档的 `.scratch` 引用只有未来派发目录约定，均说明不是已存在产物；正式证据有稳定归档及清理规则。未发现要求未来角色读取本次 `.scratch/dag-refactor/` 提示词或日志才能使用计划的路径。[旧审查](mvp-dag-review.md)顶部明确只覆盖旧 DAG 哈希，其历史来源记录不作为本次执行入口或新 PASS。

**链接检查**

检查固定输入中除旧历史审查之外的全部 Markdown 本地链接，共 143 处，目标文件与锚点全部有效。节点锚点、角色锚点、证据锚点和 scope 指针可达；未来契约、任务包及证据路径是明确的待产出占位，不冒充已存在链接。外部网址、GitHub 议题正文及历史审查的临时来源没有做联网有效性核验，本次结论不依赖它们。`git diff --check` 通过；没有运行产品测试。

**输入版本与稳定性**

工作分支：`docs/mvp-delivery-baseline`。HEAD：`5eab55d64463215b7e9c044ffb71edb5c365d0e9`。输入是未提交文档，因此记录 SHA256。开审和结束时均逐项核对固定清单，以下 15 个文件一致，审查期间未变化。

| 被审文件 | SHA256 |
| --- | --- |
| `AGENTS.md` | `4ae7be9cc7a3697c38bbf03515acc51b71cab63398c1f1fbe620b11e914a946f` |
| `README.md` | `1f6ba9ffe0abd865e20d548fb4b0ffa81cde81daf7a3285a6242ccf717156ec5` |
| `docs/ROADMAP.md` | `8df1cc8eb0bffa191d28a7d24ac03b45c337ba086026bb7ac50f569f8fa98521` |
| `docs/acceptance/mvp-matrix.md` | `fdc73fd6b484f9876c7db3a850fa89134ff51f3c154047fec339b1cfaf999cf2` |
| `docs/plans/execution-protocol.md` | `244c2defd5d61e7d3810068bd54d4f82f856dde0ecc2619d8b445fa261b5619e` |
| `docs/plans/mvp-dag-review.md` | `117467c3e8697aff6292c3d25e344d7ed96ccf73de759c244fd695c6aab62e86` |
| `docs/plans/mvp-dag.md` | `b6279693d0f95494c809fbf214751c69c65288689af4c0c79502ac0e5cfa34a5` |
| `docs/plans/task-package.md` | `93f705de6982c1a53aaa3e6ff123b09a8dded32bcd3f50c04696b17d4841b682` |
| `docs/plans/tasks/capabilities.md` | `a0d659c25c36aed9d2112ab3abc5948ed9a521bec813a30ec8505aadb1a6de4f` |
| `docs/plans/tasks/delivery.md` | `c2d67c543b2a7dc1739b30490f3ab0cd5800aeabf825844908e71d6a05df7d61` |
| `docs/plans/tasks/first-flow.md` | `b6a0de81b839aadc9c81a19918db9b2363b74f45c9e14b67ee68e176c8b0b867` |
| `docs/plans/tasks/materials.md` | `10dae350bac38a19463e57782a4c2b4918f85c336506c7ea7296885ab7dbbb4f` |
| `docs/plans/tasks/math.md` | `826711c5cf1c381da57adb898799e94e13df23f47172ced04ca485e29dcb0700` |
| `docs/plans/tasks/reliability.md` | `2920e41cbb252af8bcd7767bf485cd5ceb90e09c96b90992d4308f26c24c58bd` |
| `docs/plans/tasks/teaching-time.md` | `ed5291c081463d336e263988a9d604f873af7e16d5b76320403c8c33fdd9d197` |

辅助范围、行为、设计规则和 ADR 0001 均与上述 HEAD 的对应路径一致，使用 commit + path 即可定位。认证契约也与该 HEAD 一致；本次没有将其文档内容当成认证已实现的证明。用户已有未跟踪研究文件未改动。

以下仅记录本次审查来源，使用重构后的计划无需读取这些临时材料：

| 来源摘要 | SHA256 |
| --- | --- |
| 固定输入清单 `review-inputs.json` | `b5adad320694d37b0a1418e5a32715642887ee32f18f22b6986700cb894f31f1` |
| 作者完整任务 `author-prompt.md` | `03d468922f52ebb80d45edfebdab6fa97a29cd216ee5a4e63942b64561b93657` |
| 拆分前 AGENTS 快照 | `d551780bf3d3142034c02a80d6c0e72d6bd785e9de76887e1a06bbc3cb9ff10f` |
| 拆分前 DAG 快照，与旧审查声明的对象一致 | `c82b33a5067fcab12e3a2cf4917c80d7f9e15906b65fbcc0a7ccc942b472d5fd` |
| 拆分前 ROADMAP 快照 | `a6fdaa68e8bd2ba3253a56d788c692dea79b0f938f7231d8eca4159d6733876d` |

旧审查没有单独提供改写前正文快照，因此本次不声称对其全文完成前后字节比对；已核对当前历史提示、原被审哈希与旧 DAG 快照相符，以及活跃入口没有继承其 PASS。当前旧审查文件本身纳入上述首尾稳定性检查。

**交付决定**

必须修复项：无，修订任务清单为空。非阻塞建议：无新增建议，不为写作偏好增加文档工作。

编排者可直接把同一输入版本和本报告交用户，不需要实质复审或代作者修文档。未来真正派发前仍须由相应设计节点提供经过独立审查的具体任务包，这是已有执行门槛，不是本次补设计任务。用户明确实施授权前继续停在 G00。

本 session 唯一新增文件为本报告。未修改受审文件、AGENTS、源码、认证契约或研究文件；未实施、安装依赖、运行产品测试、提交、合并、推送或建 issue。未创建临时文件、其他 session 或 subagent，未联系作者或轮询，保留用户已有改动及全部他方材料。
