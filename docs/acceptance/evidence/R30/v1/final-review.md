# R30 最终限定冻结核验

**PASS / independent。** 受审候选 `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1` 足以冻结 R30，并在既有授权和固定 B16 基线上接续完整 R31。`R30-REV-001` 关闭；`R30-REV-002` 本机实验缺口关闭。无新增冻结必修项。本结论只裁决实验消费、固定交接和放行边界，不签产品完成。

候选有事实文字和执行路由待同步，见下文；当前有效事实由本报告明确，均不阻断冻结，也不要求追加一轮审查。后续派发同时携带候选与本报告的固定提交，不按过时文字执行。

## 固定证据与判定

使用 `git show <完整SHA>:<路径>` 读取证据。旧报告整体 FAIL/CHANGES_REQUIRED 保持原结论，只沿用其中明确通过且未变的切片。

| 核验对象 | 固定证据 | 本次判断及边界 |
| --- | --- | --- |
| 原设计 | `ae9a3954c7488743f3812499ece76e6ac900c7a0`；原审查 `0467f468c3e923a83548d447c3a760a47b2f88bd:docs/acceptance/evidence/R30/v1/review.md` | 原已审schema、行为、恢复、写权与接缝沿用，只核验两项实验消费缺口的关闭。 |
| REV-001 | 制品 `c7022e03be1af4d6b2ca5ca1b5a12441bc8835f8`；独立 `d990f43baa98d9b125a6606b1fab56e9b5c77e98:docs/acceptance/evidence/R30-C21-CONTINUATION/v1/review-location.md` | CLOSED。I机器/人工各六题依据自身响应定位，Q3局部校对、保存、刷新和服务重启回读通过。定位限页级；机器主要内容仍4/6、人工6/6，不把人工去重回计为机器成功。 |
| REV-001未变切片 | `dd6b2b8c57d776798d1cfbb2c087bbf5a6a8ad76:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c21-review.md`；接续报告74项来源核对及I非location字段不变证明 | EX-01/03/04、规范数学源、真实图及编辑能力沿固定独立证据；不是当前在线提取成功。 |
| REV-002已通过切片 | 候选 `7f965c6408a73d30524ff8e11c40484a352232c1`；独立 `c03df4ad6d0290f9172a15e3f23dc1e6875efe0a:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-control-review.md` | 来源、完整五公式、Q2提示、角色隔离、八份PDF全部19页通过；该轮完整编辑链和DOCX末页覆盖失败，不能单凭此报告关闭。 |
| REV-002剩余闭环 | 同候选，补充独立 `f877b6395cbfbde4b2d8aa7e8d3f64496aea22cc:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-gui-review.md` | CLOSED，限本机LibreOffice。同字节第一轮件接续第二轮三项修改、保存关闭重开、完整回读、两对象重入；学生练习DOCX第3页实际完整打印预览通过。第一轮改值来源与三类教师打印沿前轮，不虚称本轮重做全部动作。 |
| 旧DOC与公式范围 | 上述C22报告沿 `179f353755ff987cfba8678f782b242da3122bf1:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-review.md`；表示裁决 `634dec32b16068bb3e95e31087ddae94340b13be:docs/arch/capability-checks/C22-validation-next.md` | 固定旧DOC自身对象刷新后四页预览及LaTeX解析限定表达已有独立证据，未变传播成立；不是任意旧DOC保真、原生DOC往返或任意TeX支持。 |
| 整合消费 | 受审候选 `docs/arch/materials-evidence.md`、`docs/acceptance/evidence/R30/v1/freeze-prep.md` | 当前状态消费两项独立关闭；原实验失败表绑定旧制品，仍是反例，不与新限定关闭矛盾。产品与目标设备责任未被用来替代原实验欠账。 |

C22实际环境是LibreOffice 26.8.0.3。公式辅助设值在真实可见Math内完成，并有退出、保存、重开及重入证据，不称纯鼠标键盘改值。Windows Word/WPS仍未验证，物理打印未证明。本次未重跑Office、模型或产品，消费既有固定独立证据及其来源链，不以作者self代替独立结论。

## 当前在线事实与待同步位置

最新制品 `2b10b4ecbfef907de1d0c368c7a29eb49af803c4:experiments/C21/page-transcription-1/`；回执 `4115bb66a5522879421ae8b49cb704b524b80b2c:docs/acceptance/evidence/C21-CONTINUATION/v1/author-page-transcription.md`；源 `/home/liam_t/项目/TeacherWorkspace-c21-page-transcription`。

当前结论为 **FAIL / self，窗口关闭**。第2页HTTP200、模型匹配，但length、正文440字符、JSON在Q3截断且无Q4；7998 completion、7809 reasoning。第1/3/4页未发送。新材料未形成，六题分母6、分子null，七项未执行，不能写0/6。累计19次请求、16份usage、108777已知completion；历史3份usage缺失及online-1的8000未知预留保留，费用未知。未用3次/24000额度已作废。

`a510cc0a46ea622b740e5d9e27ce8242300db055:docs/arch/capability-checks/C21-online-decision.md` 明确新在线结果不重开REV-001、不新增R30汇总冻结门禁。该固定页级方案技术FAIL归C20，新方向须有新证据并由外层裁决；R33真实在线产品能力仍须证明。

| 候选待同步位置 | 当前有效事实 | 归属与冻结影响 |
| --- | --- | --- |
| `docs/acceptance/evidence/R30/v1/freeze-prep.md:50`、`:77`，“尚无/没有新实验回执” | 已有上述self FAIL回执，窗口关闭；原“不等待在线成功、不新增门槛”仍成立。 | R30文档整合/外层状态同步；非冻结必修，不重开实验。 |
| `docs/plans/tasks/materials/README.md:18`，dsh headless及额度回退 | 当前根AGENTS与执行协议模型映射优先：Codex CLI，停用dsh，无自动降级。 | 任务入口维护者普通同步，不改变产品设计或DAG，不追加审查。 |
| `docs/contracts/workbench.md:77`、`docs/plans/tasks/materials.md:5`、任务README开头及freeze-prep的“待最终冻结” | 本报告提供指定候选的independent PASS。 | 外层固定本报告后正常登记/同步，不是新门禁。 |

本任务只记录位置，不修改源文档、旧报告或根台账。历史实验失败与旧审查原文保留，不逐一改成现在时PASS。

## 实际放行条件

对照控制版本 `0fb84babb5ca0bf9122d6b9ab7ef6bb4aba26b7c:docs/plans/mvp-dag.md` 的材料并行边及R30-R35节点表，候选启动/完成条件没有扩张。

| 节点 | 放行条件与保留门槛 |
| --- | --- |
| R31 | 本报告满足R30整体独立冻结前置，可按既有授权接续剩余转换、Preview/Job/crop及完整交付。固定B16产品 `612f0a9868743a1d5eea7e6f236d3ff903752439`、独立 `d1ef0d5af8478677c04e6dd42bd3346f7883d1d0:docs/acceptance/evidence/B16/v1/attempt2.md`，保留隔离启动、空库/旧库迁移与身份边界。 |
| 既有R31成果 | 基础 `5f696b8ce611e67d940ce149ce13946a50b65510`、交接 `c08fa62d434efffc89b471151faa73308e3ce716:docs/acceptance/evidence/R31-FOUNDATION/v1/integration.md`，数学支持 `02340eb972d68221bde94976c0da5fa90648de89:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/attempt2.md` 仅可按限定范围复用。均不等于完整R31，不满足正式四handler组合/启动门槛，也不提前放行R32-R34。 |
| R32/R33/R34开发 | 完整R31交付固定后仍可并行。须同一R30冻结SHA、完整R31候选、公共端口/fixture、隔离运行/迁移/失败样本、共享文件停写交接及节点授权。原R31包交self与integration，不新增R31独立审查节点。 |
| R33真实在线 | 本地原生读取、Adapter、校对和恢复可按原依赖实施。真请求须明确产品窗口及受控注入，正式四入口对应T/W/P/I/PS各≥5/6边界、≥4/6主要内容，E≥2/3组完整及原图/公式/定位/保存重启要求均保留。旧重放、I单项及页级self FAIL均不能代签；关闭窗口余额不转移。 |
| R34最终组合 | 开发不额外等R32/R33完成；最终集成才收齐R31-R33固定完整候选、self/缺口及停写回执，由R34接手共享文件成为唯一写者。真实取材、六输出、正式接线与失败恢复完成后才报完整self。 |
| R35与目标设备 | 固定R34组合上验完整材料用户流程、真实教师材料、六输出、Word真实编辑保存、PDF打印预览、重启/失败恢复与身份隔离。目标Windows/WPS设备、版本、字体与权限由外层提供，R35执行、D72课堂复验；本机实验不代签。 |

B16和R31基础仍是test-principal证据。数学支持另有其组合身份模式，不自动证明完整材料real-auth。真实认证、正式产品完整性及后续用户门禁保持原归属。本报告不声明R31-R35、M41或目标设备已通过。

## 静态核验记录

源 `/home/liam_t/项目/TeacherWorkspace-r30-final-freeze` HEAD与受审完整SHA一致，实际审阅取固定Git对象；指定候选、独立报告、B16、R31交接、数学支持与新C21回执均可解析。

以两端 `git show SHA:path` 原始字节逐一比较原设计 `ae9a3954c7488743f3812499ece76e6ac900c7a0` 与受审候选，以下九文件完全相等：

- `docs/contracts/workbench/materials.md`
- `docs/contracts/workbench/materials.openapi.yaml`
- `docs/contracts/workbench/materials-cases.md`
- `docs/acceptance/materials.feature`
- `docs/arch/materials.md`
- `docs/plans/tasks/materials/R31.md`、`R32.md`、`R33.md`、`R34.md`

schema SHA-256为 `4d9aa67cad551f1f88771ee33e3d95a42dcafd91b6e24f7a7c48a64ea1d4055d`，cases为 `4a36ba713554188b838d1aaeb9dc1deb5ad6b9ce5794d734e953bbf25f38fe56`，BDD为 `0ae477d4306225d599244ef56e556aed301a8ac3659b4b6f19ce6d2b145ada3f`。没有重跑未变schema/BDD或产品验证，也未调用code-review、读取密钥或派业务session。

## 结构化回执

```yaml
task: R30-FINAL-REVIEW@1
attempt: 1
role: design-review
status: PASS
verification_level: independent
finished_at_utc: "2026-09-22T10:14:29Z"
session_id: unavailable
runner: "Codex CLI / gpt-6-astra / medium"
skills_used: [writing-for-agents]
base_revision: "0fb84babb5ca0bf9122d6b9ab7ef6bb4aba26b7c"
reviewed_candidate: "8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1"
result_revision: "本报告所在提交 + docs/acceptance/evidence/R30/v1/final-review.md；完整SHA由最终回执返回"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs: "本文固定证据、当前在线事实与实际放行条件的完整SHA引用"
changed_files: [docs/acceptance/evidence/R30/v1/final-review.md]
artifacts: [docs/acceptance/evidence/R30/v1/final-review.md]
checks:
  - "固定源HEAD、Git引用与九个已审文件字节相等：PASS"
  - "REV-001/002独立关闭链与未变切片边界：PASS"
  - "实验消费、固定交接与原DAG启动/完成边：PASS"
  - "C21新self FAIL与过时文字分离，不扩冻结门槛：PASS"
  - "报告静态检查、git diff --check及仅报告写入：PASS"
identity_mode: "不适用：静态设计冻结，无新增身份验收"
must_fix: []
closed_items: [R30-REV-001, R30-REV-002]
open_items:
  - "本文所列事实、路由与冻结状态文字由对应维护者普通同步，不阻断冻结"
  - "页级在线FAIL归C20；R33真实产品能力、R35、目标设备及正式组合待原节点完成"
failure_owner: null
next_condition: "外层固定本报告与受审SHA，按既有授权接续完整R31；完整交付停写后再放行R32-R34并行"
authorization_used: "用户R30-FINAL-REVIEW@1 / attempt 1；仅新增最终报告及必要静态证据；不修改受审资料、源树、旧报告、契约或根台账，不合main/push/部署，唯一通知由外层负责"
```
