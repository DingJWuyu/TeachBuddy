# 编排输入索引

仅在派发、消费回执或交接对应flow时读本页相应章节。当前活动和下一步由 [run-state](run-state.md) 唯一维护；依赖由 [DAG](mvp-dag.md) 拥有。本页只保留仍需消费的固定版本与限制，不复制证据正文。

`完整SHA:仓库路径` 从共享Git对象读取，例如 `git show <SHA>:<path>`。分支候选未合main，不能用当前checkout文件或活动HEAD替代固定对象。证据按原声明范围使用，self不等于independent，局部通过不等于完整节点通过。

<a id="运行位置"></a>
## 运行位置与恢复

- 主干：`/home/liam_t/项目/TeacherWorkspace`；控制worktree：`/home/liam_t/项目/TeacherWorkspace-mvp`，分支 `docs/mvp-delivery-baseline`。
- 派发材料位于控制worktree `.scratch/dag-dispatch/<任务>/<attempt>/`。task.md和launch.json保存输入、实际session及worktree；receipt.md/exit.json保存真实结束结果，events.jsonl与stderr.log用于具体异常。不要为更新台账查询活动任务进度。
- 根thread：`01a0be12-5c28-7823-a7ed-644df825467f`。只在文档确实缺少必要决定时读取 `/home/liam_t/.codex/sessions/2026/09/20/rollout-2026-09-20T05-07-49-01a0be12-5c28-7823-a7ed-644df825467f.jsonl`。
- 精简前的完整版本索引可按需读取 `cace6592db76c194e279babe92cf92edc4f16dce:docs/plans/run-state.md`。旧过程继续保留在Git和原正式回执，不另建历史台账。
- `.env`、运行库、浏览器profile与未完实验材料均留在各自隔离目录。不得把凭据写入回执；未完成用途的现场保持，不因本次整理删除。

<a id="产品候选"></a>
## 当前产品候选与本地验收

| 消费对象 | 固定版本或证据 | 使用边界 |
| --- | --- | --- |
| 主业务组合 | 完整 `3d5c3f308bfeaa0e038a9fb86e6dab2816b9ec7c`；产品 `c2cdd9d12428dadb6ac405ff5b8081d15b51f0d6`；来源 `/home/liam_t/项目/TeacherWorkspace-r34-protection-fix` | 已含真实认证、材料、数学、教学；没有C26。 |
| 最新R35本地结果 | `efd3b071a603d38902688b0b4dd68289e8516c69:docs/acceptance/evidence/R35/v1/local-review6.md` 及同版local6/ | 001-007已关闭；原28行矩阵的已列本地余项补齐，必要传播回归通过。完整R35、在线/新材料、目标环境和OBS未代签。只读现场 `/home/liam_t/r35l6/`，50735/50736已停止。 |
| R34修复交接 | `3d5c3f308bfeaa0e038a9fb86e6dab2816b9ec7c:docs/acceptance/evidence/R34/v1/protection-fix.md` | self和复现入口；已由上一行独立消费，不再重复同范围审查。 |
| F60原业务输入 | `267cf5119e05e6caba8f2db58ece3487dc6c3e9d`；来源 `/home/liam_t/项目/TeacherWorkspace-teaching-math-integration` | 活动设计固定输入，不静默替换为3d5c3f3。后继集成按最新修复及其独立证据交接。 |
| 首批Agent候选 | 完整 `ec5094c00d122c77d2acdb376f4ede96eafb13e0`；产品 `687121ec8d9afeccb527d2738f8b1ca22791dd69`；同版 `docs/acceptance/evidence/C26/v1/math-layout-fix.md` | F61负责与主业务组合并扩展全模块。当前只代表首批能力。 |
| 首批Agent独立结果 | `6d48bc7f214a6b27e51b3a8cbdfa6cffc212f4d1:docs/acceptance/evidence/C27/v1/math-recheck.md` | D01关闭，未变live/持久/隔离结果按报告来源复用。C27-O01两项moderate依赖公告交后续维护，未证可达缺陷。 |
| 首条流程 | 候选 `612f0a9868743a1d5eea7e6f236d3ff903752439`；`d1ef0d5af8478677c04e6dd42bd3346f7883d1d0:docs/acceptance/evidence/B16/v1/attempt2.md` | B16 independent PASS，身份是test-principal，不代签真实认证。 |
| 真实认证本地 | 产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf`；`aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md` | 已进入主业务组合。real-auth/fake-mail/自签HTTPS，本地通过不包括恢复、真实邮件或物理设备。 |
| 教学接缝 | `5c3ae84c4f382aca16404a25604c295d28b654f3:docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/independent/README.md` | 在267cf51上WB-MTA001-007独立通过；新组合传播适用性由最新R35报告固定。 |
| 数学本地 | `703204384ba34090b0995899d9238751852fc590:docs/acceptance/evidence/M44/v1/local-review2.md` | 本地制作、持久、离线、Impress及三尺寸通过，滚动缺陷关闭；新组合传播适用性按最新R35报告。完整材料和目标设备门槛保持。 |
| 教学时间本地 | `ab19d5d4858affda949470ec66475d5b6209ddd9:docs/acceptance/evidence/T54/v1/auth-review.md` | 真实身份本地通过；完整T51/T54、WB-T020仍需原数学/材料及目标条件。 |

<a id="认证恢复"></a>
## 认证恢复

| 输入 | 固定引用 |
| --- | --- |
| 唯一设计 | `73d68c2e1ec864faac8ee49a8b5f9e6361e82964:docs/contracts/auth-recovery.md`；同版架构 `docs/arch/auth-recovery.md` 和BDD `docs/acceptance/auth-recovery.feature` |
| 实现/交接短包 | `767f949dc9f15a960c5146ebb367dd2f1e827b4f:docs/plans/tasks/auth-recovery.md`；作者回执 `docs/acceptance/evidence/AUTH-RECOVERY-DESIGN/v1/author.md` |
| A10设计独立接受 | `a3d5b5ec80d4823ec978e3b9b331b8fa266302be:docs/acceptance/evidence/A10/v1/recovery-review.md` |
| 可运行操作self | 实现 `627bf878d9b2ec57e8bc88a227337744c697a9ce`；完整 `070def5a928ae5c87d37be646d652c56cf5a5e0f:docs/acceptance/evidence/AUTH-RECOVERY-IMPLEMENTATION/v1/author.md`。恢复28/28、认证98/98，待A10独立交接。 |
| 原认证冻结 | `6f3003250d170b44e89f6ac9b0a74f91d658a357:docs/contracts/auth.md`；独立 `63bfe8f7900b4a2bb7fc9ab5a4145f1c89a6f73b:docs/acceptance/evidence/AUTH-CONTRACT/v1/correction-review.md` |
| 原恢复责任与外部条件 | `c966447f1e2dea83bd11871bca82d7981b276cb1:docs/arch/auth-handoff.md`；已满足的旧前置以run-state和新固定回执为准 |

auth-recovery/1已独立接受，离线 `prepareRestoredAuth({db})` 已交self候选，支持冻结的七项认证迁移；A10正在固定可运行交接。认证后端拥有内部操作，F62拥有停服、完整恢复、调用和最后开放。F62须取得固定实现及A10交接，不能自行补认证SQL。

上述候选完整API为335/336，唯一TT-C7失败归T53目录写者：主业务3d5c3f3的目录依赖与旧数学样本不一致；认证实现未修改这些输入。具体复现和日志读作者回执“全API回归”，修复由run-state中的T53任务接续，不能报告全套通过。

OPS-001需F62候选及A12真实恢复专项，11条BDD的设计覆盖PASS不等于运行PASS。真实邮件/可信HTTPS/物理设备继续保留。F60无需等待这些实测才能设计；具体依赖以DAG和已冻结交接为准。

<a id="可靠性"></a>
## F60与可靠性入口

| 输入 | 固定引用与用途 |
| --- | --- |
| 已采纳入口裁决 | `8b796c47ee2517fad00ddc7eb2c40afeb914156c:docs/arch/reliability-entry.md`；独立 `43366f20bd9e76f1490cd7c434f2a745a0234995:docs/acceptance/evidence/RELIABILITY-ENTRY/v1/review.md`；入口已同步main |
| F60完整候选 | 完整 `619494d5e115d4d1a4bc9e7ee9c83b553fd246dc`；设计 `a6a044466da18eca8cb7274d4c99d43d596453b6`；入口 `docs/arch/reliability.md`、`docs/plans/tasks/reliability/README.md`，作者 `docs/acceptance/evidence/F60/v1/attempt2.md` |

完整候选self检查涵盖81工具、37条WB-F、11条WB-AR及18行范围，已消费固定认证设计和A10设计接受；G-AUTH仅设计接合由作者关闭，独立冻结正在进行。候选固定旧业务267cf51；最新认证实现、R35复验和TT-C7归属已交reviewer区分，后继按根固定版本集成，不把设计当运行实证。

F60独立冻结后才派F61-F63。F62可运行self后进行A12恢复专项，不等F65/D72；完整A12、T54、R35/M43/M44及其他原前置仍在F64前汇合。认证操作、全范围恢复和交付环境恢复是不同验收责任。

<a id="c21"></a>
## C21开源复用实验

| 输入 | 固定引用 |
| --- | --- |
| 调查 | `c2f9e21e39dcf005f373a374becd6018e305cea6:docs/research/c21-open-source-reuse.md` |
| 实验方案 | 完整 `d690372c8f552e37690648f5688e04e1b68c4ae9`；设计 `b0e44a8daf70ee2e17f767f38e54550099ac90ef`；同版 `docs/arch/capability-checks/C21-reuse.md` 和 `docs/plans/tasks/materials/reuse.md` |
| 独立冻结 | `436f2612b62cd40bb7f074ad68568d5bdd951f65:docs/acceptance/evidence/C20-C21-REUSE-PLAN/v1/review.md` |
| 固定六页 | `ecd1ed6d8f974fba20ac92d40d5b6b943a3b0170:experiments/C21/next-1/`；完整页路径、原件位置和哈希由实验方案拥有 |
| 实验读取的归并代码 | `267cf5119e05e6caba8f2db58ece3487dc6c3e9d:apps/api/src/modules/questions/`，只读 |
| 原在线失败与账本 | `2b10b4ecbfef907de1d0c368c7a29eb49af803c4`；`4115bb66a5522879421ae8b49cb704b524b80b2c:docs/acceptance/evidence/C21-CONTINUATION/v1/author-page-transcription.md` |

独立PASS只冻结判别方法。OPEN-01的用户权重许可待答，OPEN-02由执行者核对当次资源及环境，OPEN-03由实验产出效果证据并交R30消费。当前没有下载、安装或推理授权。

具体两权重revision、许可、隔离配置、六页评分、最多七次解析和停止条件只读固定方案，不在台账另设一套限制。A原始输出、B自动归并、C人工整理分开；只A通过不等于自动拆题可用。实验失败不能自动改为永久手工方案或缩减PRODUCT_SCOPE。

<a id="模块输入"></a>
## 后继模块与目标环境输入

| 触发 | 固定输入和边界 |
| --- | --- |
| 材料契约或后继实现 | 设计 `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1`；独立 `88a89f00b78dd301ca9893a191277eb9970c4c18:docs/acceptance/evidence/R30/v1/final-review.md`。完整R30已冻结，不因C21新路线重开旧REV-001。 |
| 数学冻结 | `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md`；具体旧实现和M41/M42输入可沿交接或M44报告读取。 |
| 教学时间冻结 | 设计 `afda1c5d8d8c2de93f1e045ff2ad32e2681bd116`；独立 `f9eb35f2180576daee4aedfb114049f4cb357694`。作品扩展设计 `a44587b9bd18618d77df13f7349f5043a297d226`；独立 `3dbead5af93059b0f890c531097b234e5f453fae:docs/acceptance/evidence/T50-MATH-CONTRACT/v1/review.md`。 |
| 首批Agent契约 | 设计 `18293e9389e739ed8aaf67ee568503ca8e87d475`；独立 `741025bd0a8e09098b5877428b81c2bdd7f357d0:docs/acceptance/evidence/C25/v1/correction-review.md`。F60全模块映射仍待独立冻结和实现。 |
| C22目标Office验证 | 制品 `7f965c6408a73d30524ff8e11c40484a352232c1`；独立 `f877b6395cbfbde4b2d8aa7e8d3f64496aea22cc:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-gui-review.md`。本机GUI/可编辑公式/打印已闭环；Windows/WPS、同内容目标PDF仍需实际输入。 |
| C23目标离线验证 | 制品 `d1490531e014ef437374c2f5a23cf3073baeef56`；独立 `b01bc73954cbbc13e464738e0f6f8aa6c6f12084:docs/acceptance/evidence/M40/v1/correction-review.md`。Windows Edge/Chrome、课堂设备实测仍未交。 |
| 材料完整剩余矩阵 | 读取最新R35 local-review6的28行矩阵。Provider未知结果/新在线恢复仍需真实条件；人工补图不替代自动质量；M015仍需同内容目标Office完整PDF及核对采用。 |
| 历史传输观察 | `880e6e68be0855b3289dea8db3c87e8c67bc1042:docs/acceptance/evidence/R34/v1/restart-diagnosis2.md`。OBS-001/002仍OPEN；无新cause不重派相同诊断，重启成功不构成根因闭环。 |

产品/验证命令从对应候选回执读取，端口、数据库、浏览器及临时目录按新任务隔离；源候选和旧失败现场只读。部署选择、大陆网络、备份独立位置及目标设备通过证据仍未最终交付。

<a id="模型窗口"></a>
## 产品模型窗口与消耗

以下均为已结束窗口，不是剩余调用额度。账户余额、实际计费和extra credits条件未知；cost=0不代表免费。不读取密钥来补写台账。

| 范围 | 必须保留的已知事实 | 证据入口 |
| --- | --- | --- |
| C21在线 | 累计19次，16份usage，108777已知completion；历史3份usage缺失及online-1预留8000未知。最后页级正文截断，余3次/24000已作废，新请求许可0。 | 上述C21原失败作者及账本；新本地方案不重开这些窗口。 |
| C24业务 | 累计32次DeepSeek请求、93970 total tokens，其中最后修复7次/36651。PI-01/02探针另有原账，不混成全部总量。 | `e8fdf9a139e429c05590925647a433a9da382579:docs/acceptance/evidence/C24/v1/business-fix.md`；探针 `e7f979bd80ab83aaab7cc2cf936250123d7742a3`。 |
| C26实现自验 | 10次，79983 totalTokens。 | `ec5094c00d122c77d2acdb376f4ede96eafb13e0:docs/acceptance/evidence/C26/v1/author.md`；后继修复未新增调用。 |
| C27独立验收 | 11次，88550 totalTokens，不能与C26混为同一窗口。 | live证据 `34e668ae97e1eb0cd5744550b6b05a4c25aa9301`；后继 `6d48bc7f214a6b27e51b3a8cbdfa6cffc212f4d1` 零新增调用。 |

早期EMODEL/C23探针消耗见各自原回执，上表不宣称项目全部调用总量。旧资料确实缺失时按运行位置给出的精简前Git索引查找，不重建或覆盖原证据。
