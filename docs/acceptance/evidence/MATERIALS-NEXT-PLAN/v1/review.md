# MATERIALS-NEXT-PLAN/v1 独立核验

两项结论均为 `independent PASS`：可打开本候选限定的新补证窗口，并允许 R31 文件存取/内容基础切片先行。这是计划与启动依赖的冻结，不是 C21/C22 能力通过、REV 关闭或 R30 整体通过。R31 产品实现尚未在本次运行验证。

## 回执

```yaml
task: MATERIALS-NEXT-REVIEW@1
attempt: 1
role: acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-22T06:44:57Z"
session_id: unavailable
runner: "Codex CLI / gpt-6-astra / medium，按本次用户指定常规独立核验路由"
skills_used: [writing-for-agents, codebase-design]
base_revision: "d18769a85da9554a251e3f2ab094af69dc67de95"
reviewed_candidate: "68f66587d4d625ee9c8f75516eafa61913b57e40"
plan_revision: "cd751b68e5001999b5a5f7544254c41d804f058a"
result_revision: "本报告所在提交:docs/acceptance/evidence/MATERIALS-NEXT-PLAN/v1/review.md；完整 SHA 见最终回执"
conclusions:
  new_experiment_window: PASS
  r31_foundation_dependency: PASS
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
identity_mode: "不适用：固定设计与既有证据的只读核验"
changed_files: [docs/acceptance/evidence/MATERIALS-NEXT-PLAN/v1/review.md]
artifacts: [docs/acceptance/evidence/MATERIALS-NEXT-PLAN/v1/review.md]
checks:
  - "固定计划与完整候选关联核对：候选仅追加作者回执，计划内容不变"
  - "原失败逐项对照新方案及 C21/C22/R30 短包：覆盖且不降低 EX/OF 标准"
  - "原 C21、C22、samples、PRODUCT_SCOPE 与候选 blob 比较：4/4 相同"
  - "File/Location/LocatedPart/Document 的传递引用只读追踪：可解析，无 Preview/Job/Resource/Import 类型依赖"
  - "公共端口、文件持久性、B16 组合入口/迁移脚本、共享写者与后续交接静态核对：PASS"
  - "报告写入范围、git diff --check、禁用破折号检查：PASS"
open_items:
  - "R30-REV-001/002 仍开放，归属与具体补证见下表"
  - "Windows/WPS 目标环境仍未验证，不阻塞本次本机补证及 R31 基础实施"
  - "常规核验短包的 high 提示由作者直接改为 medium，无需新审查"
failure_owner: null
next_condition: "外层按两个 PASS 分项同步唯一启动例外，并固定本报告 SHA 派 C21-next、C22-next、R31-foundation；新证据到齐后派 R30-consume"
authorization_used: "用户 MATERIALS-NEXT-REVIEW@1 / attempt 1：仅核验实质变化，仅写并提交本报告，不运行新产品模型或 Office、不改源树/产品/计划/根台账、不合 main/push/部署；外层唯一回调"
```

## 固定依据

以下以完整 SHA 和仓库路径定位，复核用 `git show <SHA>:<path>`，不依赖浮动分支。计划源树 HEAD 已核对为受审候选。

| 代号 | SHA | 本次消费路径与用途 |
| --- | --- | --- |
| P | `68f66587d4d625ee9c8f75516eafa61913b57e40` | `docs/arch/capability-checks/materials-next.md`、`docs/plans/tasks/materials/{next,review,C21-next,C22-next,R31-foundation,R30-consume}.md`、作者回执；完整受审内容 |
| F | `16d4b013b17b1e8d8c240c0d15a8b5366102024b` | `docs/acceptance/evidence/R30/v1/recovery-review.md`；失败事实及可沿用切片 |
| M | `8d48af595b1d80a9169d8db55ee7c8969b60c605` | `docs/arch/materials.md`、`docs/contracts/workbench/materials.md`、`materials.openapi.yaml` 及其 first-flow 引用、`docs/plans/tasks/materials/R31.md`；端口、类型、所有权和原完成条件 |
| S | `cff6f97aa0488dbfdd2e30d0e14ad35b064f040b` | `docs/arch/capability-checks.md`、`capability-checks/{C21,C22,samples}.md`；原 EX/OF 标准与范围 |
| L | `c82cd69b84c2c3b4b3730384b951bf3d914cc112` | `docs/acceptance/evidence/C20-MATERIALS-RECOVERY/v1/review.md`；上轮限次、仅 M40 设计的接缝冻结，未放行 R31 |
| B | `612f0a9868743a1d5eea7e6f236d3ff903752439` | `README.md`、`apps/api/src/{app.js,workbench/index.js,core/dataStore.js}`、`scripts/first-flow/start.mjs`；B16 固定产品运行基线 |
| BR | `d1ef0d5af8478677c04e6dd42bd3346f7883d1d0` | `docs/acceptance/evidence/B16/v1/attempt2.md`、`attempt2/{run.json,run-acceptance.mjs}`；B16 independent PASS、受测绑定、重启及旧库构造入口 |

P 的计划文件与 `cd751b68e5001999b5a5f7544254c41d804f058a` 一致，差异仅为作者回执。BR 的报告与 run.json 均绑定 B；BR 是独立报告提交，不要求包含 B 的产品祖先链。B16 输入已经具备，不列为等待用户提供的缺口。B 的 README 中旧阶段状态由 BR 的固定独立结果补足，不据旧文字撤销 B16 PASS。

## new_experiment_window：independent PASS

P 针对的是 F 已指出的实现/证明失败，每项均有责任、可反驳结果和停止点。DOC 原对象规范化仍是假设；允许验证假设不等于认可它必然可行，也不要求作者提前实现后才冻结计划。

| F 中现存缺口 | P 的实质响应与判断 | 责任及关闭证据 |
| --- | --- | --- |
| 题号选择固定 LaTeX、W 显示常量，解析失败回填已知公式 | 从本输入文本/原生 OMML/原响应获得唯一可写 LaTeX；失败保留原文和疑点。覆盖污染源，不以换题号藏住常量 | C21；原公式源片段、转换输出、变体及保存重开保持同一源 |
| P/I/PS 从样本目录借图、按题号选图及页码 | 每入口从自身对象或自身页自动定位取图；W 用真实关系绑定。图的原件、页/框及输出哈希可追踪 | C21；原五入口实际来源链，评分资产与机器路径分离 |
| 非空字段当正确率、E 的 groups 不能进入编辑器、F 仅文件记录 | 人工逐题正确性与机器结构检查分开；同一校对流程恢复 E/F，保留成功片段并保存继续 | C21；原 EX-01 至 EX-04 的分入口结果、编辑动作/回读及失败恢复证据 |
| DOC 内七个对象尚存但渲染空白 | 仅在同一 DOC 副本中取对象源、锚点、尺寸刷新/重建，真实全页对照；禁止借 DOCX 修补或换简单样本 | C22 执行、C20 裁决路线；公式/中文/图/顺序全页完整才通过，失败交最小反例 |
| 参数 JSON 到 OMML 未证明 LaTeX 一般转换 | 输入真正 LaTeX，覆盖固定契约必需表达及组合，真实修改中文、行内分式和独立公式后保存重开 | C22；一般解析到 OMML、GUI 编辑与三类输出证据，模板变参不能代签 |
| OF-03/04 有已认证切片，目标设备未验 | 已认证文件按哈希沿用；新生成器影响的 12 份输出重新检查，改共享转换配置才扩大相应格式复验 | C22；角色/分页/打印及新文件绑定。目标 Word/WPS 归外层与 R35/D72 |

原五入口逐份 ≥5/6 正确边界、≥4/6 主要内容可用，EX-02 七项、E 至少两组完整及真实图/跨页位置、EX-04 继续校对均保留。Q2 原图错误不能重画计分，Q6 无答案保持 absent。变体用于发现题号/位置捷径，不替换原分母。必需公式集合仍取 M 的“内容”，不要求任意 TeX；原 OMML 是来源，不能成为第二套可写主数据。

放行窗口严格取 P“新窗口与停止条件”：

- C21 先离线修复与重放，一批验证及至多一次有证据的普通修正。确有缺口的 T/W/P/I/PS/E 各最多一次请求，总计 ≤6、≤48,000 completion，单次 ≤8,000/120 秒；F 零请求。旧 13 次、11 份 usage、68,789 completion 与 recovery-1 零调用保留，累计请求 ≤19。只用 P 固定的两模型及参数，不新增探针、失败换模型或第二轮请求；未知结果计入账，费用/额度异常停止有关调用。
- C22 零模型。DOC 原对象规范化与 LaTeX 转换各一个有界本地方案，各一批验证及至多一次有证据的实现修正复测；可分项交回。免费依赖及内部算法由执行者选，不扩为在线服务、无界换转换器或购买软件。
- 窗口耗尽仍失败，按具体实现缺陷、路线失败或真实外部条件交 C20；保留全部现场，不把普通 FAIL 改为 BLOCKED，不用换 session/开发模型重置次数。

本冻结覆盖新的有限机会，旧窗口仍关闭。C21/C22 的 self 结果仍须 R30 独立消费，原两个 REV 此刻均不关闭。

## r31_foundation_dependency：independent PASS

本次依据 M 的实际接口和 B 的组合方式作新的启动依赖判断，没有把 L 的 M40 设计许可自动扩大为实现许可。

| 独立接缝 | 只读核查结果 | 本次放行边界 |
| --- | --- | --- |
| `files.store/read/open` 与 upload/get/download | M 架构规定输入本地 bytes，持久保存和幂等由 files 拥有；schema 第 15/61/92 行的操作分别返回 File/字节。File 第 2456 行起只有 ID、时间、名称、MIME、长度、摘要、重复提示，无 Job/Preview 必填状态 | 原件存取、账户隔离、持久性和相应失败恢复。不能在上传过程中强制先转换成功 |
| Location/LocatedPart | 第 2209-2299 行描述 page/text/docx 及 Box/ID；page 接收已知 renditionFileId，不包含生成 rendition 的操作。PDF 原件可作为自身 rendition，图片 page=1 | 已知原件/衍生关系 fixture 的校验；不宣称自动定位、Office 页码生成或 crop 完成 |
| Document/content/View/Editor | 第 2300-2455 行及 first-flow 的 MathRun/MathBlock 以 latex 保存；传递引用只到封闭内容节点及 ID。`content.validate` 同步检查归属/格式且不转换源，Editor 通过 onChange/onPickImage 与调用方协作 | 已知合法文字/LaTeX/图片的呈现、编辑、真实持久 fixture 回读及 v1/v2 保护；不要求模型生成或 OMML 导出 |
| 启动与迁移 | B 的 `createApp(options.workbench)` 可接组合实例，`createWorkbench` 已分离 db/identity/mutations/migrations/loader；不存在启动必需的 Office/提取调用。BR 的迁移入口可生成旧账户/布局并保留库重启 | R31 可在自己的组合/runner 写权中加入基础设施并隔离验证，无须新增产品保存 API 或运行时功能开关 |

传递引用核对仅服务于这四个类型的依赖判断，没有重审整套材料 schema。跨账户文件、图片 MIME、持久提交、幂等未知结果、语义限额与未知版本保护照 M 执行。Location 的来源归属由原件/衍生记录验证，不以未实现的识别结果充当证明；fixture 具体装配和内部文件组织留给实现者。

B16 可直接消费：运行入口为 B 的 `scripts/first-flow/start.mjs`，独立证据入口为 BR 的 `attempt2/run-acceptance.mjs`；其 `old-database-upgrade`（第 562-621 行）构造旧账户/布局，以 `reset: false` 重启检查迁移。R31 在自己的数据目录/端口使用这些固定输入，验证空库、B16 旧库和重复迁移，不重置 BR 的现场。身份限定为服务端 test-principal，真实认证不在本结论中。

共享依赖、锁、files/content/shared materials、公共文档原语及必要迁移/组合入口由 R31 单写者拥有。C21/C22 在隔离实验目录工作；基础交回后 R31 续做余下部分，完整交付并停止共享写入后才由 R34 继任。不能并发安排两个 R31 写者。

明确排除：Preview、Job、crop、Office 转换隔离/格式支持、自动识别定位、导出、完整 R31 及 R32-R35/M41 的提前启动。四 handler 不齐仍禁止正式生产启动；本次只允许隔离 fixture。剩余 R31 等两个 REV 关闭和 R30 整体 independent PASS。后续若证据确实改变公共语义，由 R30 新 revision 并重验受影响实现，不能静默改 schema。

## 缺陷归属与立即派发

本计划没有阻断两项放行的实质缺陷。普通文档问题：P 的 `docs/plans/tasks/materials/review.md` 首行仍写 `gpt-6-astra high`，与本次用户常规核验路由不符。归计划作者/外层直接改为 medium；本次已按用户覆盖执行，无需新审查链，也不阻塞下列任务。

原能力缺陷继续归 C21（REV-001 的来源/评分/编辑/E/F）、C22（REV-002 的 DOC/LaTeX）、C20（超窗口路线裁决）、R30（独立证据消费及整体冻结）。C22 后续回执应使用实际制品 `f29a7afc5254fc852811c9a9e2368f46cce3e01e`，分开整 DOCX 和 ZIP 内 XML 哈希；P 已作正确限定，不要求重写旧正式证据。

外层可使用以下短包，公共输入为 P 完整候选、本报告提交 SHA、M 固定材料组合及 F 原失败报告。按原 DAG 安排分支/端口/目录并填 attempt；不另建业务节点。

| 可立即派发 | 固定短包（P 下） | runner 与执行界限 | 交回 |
| --- | --- | --- | --- |
| C21-MATERIALS-NEXT@1 | `docs/plans/tasks/materials/C21-next.md` | Codex CLI gpt-6-astra low；先真实实验入口复现，再在 next-1 离线修复；请求仅用本报告限定窗口 | `docs/acceptance/evidence/C21-MATERIALS-NEXT/v1/author.md`，self、候选 SHA、逐题/来源/恢复与累计用量 |
| C22-MATERIALS-NEXT@1 | `docs/plans/tasks/materials/C22-next.md` | 同上实现路由；DOC 与 LaTeX 分项，零模型，本机 GUI 补证，不等 C21 或 Windows/WPS | `docs/acceptance/evidence/C22-MATERIALS-NEXT/v1/author.md`，self、分项结果及固定文件哈希 |
| R31-FOUNDATION@1 | `docs/plans/tasks/materials/R31-foundation.md` | 同上实现路由；另附 B+BR 及上述运行/迁移入口；先行只做本报告冻结切片 | `docs/acceptance/evidence/R31-FOUNDATION/v1/{author,integration}.md`，仅基础切片 self，完整 R31 保持未完成 |

新实验候选到达后再派 P 的 `R30-consume.md`，Codex CLI gpt-6-astra medium，可先消费单项；这不是当前缺证时空派验收。R30 当前仍 `CHANGES_REQUIRED`，C21/C22、R31 整体与产品能力均未因本报告获得 PASS。

本次仅进行了文档、源码、Git blob、类型引用及既有报告绑定的只读核对，没有新产品模型调用、Office 操作、浏览器复验或产品测试。没有创建内部助手、业务派工、临时文件或运行服务；仅提交此报告，源 worktree、产品、计划和根台账保持只读。
