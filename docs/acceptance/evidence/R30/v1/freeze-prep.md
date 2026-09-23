# R30/v1 冻结候选整合回执

```yaml
task: R30-FREEZE-PREP@1
attempt: 1
role: integration
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T09:55:16Z"
session_id: unavailable
runner: "Codex CLI / gpt-5.6-sol / medium"
skills_used: [writing-for-agents]
base_revision: "ccbb7a2523926775116dda1b0e1be81d5d0e050e"
result_revision: "包含本回执的固定 R30 候选提交 + docs/acceptance/evidence/R30/v1/freeze-prep.md；完整 SHA 由本 session 最终回执返回"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "R30 设计 ae9a3954c7488743f3812499ece76e6ac900c7a0"
  - "原独立审查 0467f468c3e923a83548d447c3a760a47b2f88bd:docs/acceptance/evidence/R30/v1/review.md"
  - "REV-001 候选 c7022e03be1af4d6b2ca5ca1b5a12441bc8835f8；独立 d990f43baa98d9b125a6606b1fab56e9b5c77e98:docs/acceptance/evidence/R30-C21-CONTINUATION/v1/review-location.md"
  - "REV-002 候选 7f965c6408a73d30524ff8e11c40484a352232c1；作者 a34798de7070d837019a02ab9d0f9c34b226a277；独立 c03df4ad6d0290f9172a15e3f23dc1e6875efe0a 与 f877b6395cbfbde4b2d8aa7e8d3f64496aea22cc"
  - "B16 产品 612f0a9868743a1d5eea7e6f236d3ff903752439；独立 d1ef0d5af8478677c04e6dd42bd3346f7883d1d0:docs/acceptance/evidence/B16/v1/attempt2.md"
changed_files:
  - "R30 独占 docs/user-stories/materials.md、docs/ux/materials.md"
  - "R30 独占 docs/contracts/workbench/materials*"
  - "R30 独占 docs/arch/materials*"
  - "docs/acceptance/materials.feature"
  - "docs/plans/tasks/materials/"
  - "docs/acceptance/evidence/R30/v1/freeze-prep.md"
  - "导航更新 docs/contracts/workbench.md、docs/plans/tasks/materials.md"
artifacts:
  - "docs/acceptance/evidence/R30/v1/author.md"
  - "docs/acceptance/evidence/R30/v1/review.md"
  - "docs/arch/materials-evidence.md"
  - "docs/plans/tasks/materials/README.md"
checks:
  - "设计 schema/契约/用例/BDD 与 ae9a3954c7488743f3812499ece76e6ac900c7a0 保持已审字节"
  - "两项 REV 的候选、作者与 independent 固定引用可解析"
  - "Markdown 本地链接、OpenAPI、Gherkin、版本、范围及 git diff --check 静态自检"
identity_mode: "不适用：文档整合；B16/R31 既有运行证据仍为 test-principal，不代签 real-auth"
open_items:
  - "外层尚须对本固定组合给出 R30 independent 最终冻结结论"
  - "完整 R31 产品组合与 independent PASS 未完成"
  - "R32/R33/R34 产品实现、R35 独立产品验收、Windows Word/WPS 目标设备仍待完成"
  - "新在线页级路线尚无实验回执，不是本次 R30 冻结新门槛"
failure_owner: null
next_condition: "外层在本候选完整 SHA 上做限定独立冻结；冻结后按下文边界固定派发输入"
authorization_used: "用户 R30-FREEZE-PREP@1 / attempt 1；仅文档整合、静态自检和本分支提交；不合 main/push/部署，不实现产品或自签 independent PASS"
```

## 冻结候选与变更边界

外层的受审候选是本回执 `result_revision` 指向的完整提交，设计源固定为 `ae9a3954c7488743f3812499ece76e6ac900c7a0`。本整合导入该版本的行为、UX、契约、架构、BDD 和 R31-R34 任务包，保留原作者回执、self-check 与 `CHANGES_REQUIRED` 审查原文。

仅对当前结论和消费入口做了以下更新：

- `docs/arch/materials-evidence.md` 记录 REV-001/002 的固定独立关闭链，将原“实验缺口交下游补验”改为真实的产品实施与验收边界。
- `docs/plans/tasks/materials/README.md` 固定 B16 输入，标明 R31 基础成果及数学支持组合的有限范围，并保留完整 R31 到 R32/R33/R34 的启动边。
- `docs/contracts/workbench.md` 与 `docs/plans/tasks/materials.md` 只修正导航和候选状态，认证、B11 及当前控制语义保持。

公共 schema、契约行为、cases 和 BDD 不做新设计。若外层发现这些已审语义与当前公共契约存在真实不兼容，应列出具体文件和拥有者，回 R30 新 revision，不在冻结整合中临时改语义。

## 独立结论的可消费范围

| 固定结论 | 本候选消费内容 | 不扩大为 |
| --- | --- | --- |
| R30 原审查 `0467f468c3e923a83548d447c3a760a47b2f88bd` | schema、行为、失败恢复、并行写权与 M40 接缝已独立核验；保留其两项必修的历史上下文 | R30 已通过；原报告仍是 `CHANGES_REQUIRED` |
| REV-001 独立 `d990f43...` | 固定 I 来源定位、局部校对与保存重启；EX-01/03/04 沿固定引用 | 新在线提取、C22、R30 整体或产品 PASS |
| REV-002 独立 `c03df4a...` + `f877b63...` | 固定来源、公式结构、角色隔离、19 页 PDF、本机 GUI 两轮编辑与 DOCX 第 3 页打印预览 | Windows Word/WPS、物理打印、完整 R30 或 R34/R35 产品 PASS |
| B16 独立 `d1ef0d5...` | 实施用固定运行/迁移基线，身份为 test-principal | real-auth 或新材料能力 PASS |

在线最新技术裁决为 `a510cc0a46ea622b740e5d9e27ce8242300db055:docs/arch/capability-checks/C21-online-decision.md`，作者回执为 `8f594a7b7d2f92190dbdf11cd515130be3efd77b`。它只固定页级转录与本地归并的候选路线，没有新实验回执。本 R30 候选不等它成功，也不将其成功新增为冻结门槛。

## R31-R34 当前可消费输入

| 节点 | 当前已有输入 | 准确放行边界 |
| --- | --- | --- |
| R31 | B16 产品 `612f0a9868743a1d5eea7e6f236d3ff903752439` 及 independent 回执 `d1ef0d5...`；基础产品 `5f696b8ce611e67d940ce149ce13946a50b65510` 及 self 交接 `c08fa62d434efffc89b471151faa73308e3ce716` | 基础成果可固定复用。外层 R30 independent 冻结后才按完整 R31 任务包接续剩余转换、Preview/Job/crop 与正式组合；基础 self 不等于完整 R31 PASS。 |
| R32 | 本 R30 契约、schema、cases 和 R32 任务包 | 还需外层 R30 冻结结果、完整 R31 固定候选、公共端口/fixture 与停写交接；不由 R31 基础 self 单独放行。 |
| R33 | 本 R30 四入口行为、固定实验裁决、schema/cases 与 R33 任务包 | 启动还需外层 R30 冻结、完整 R31 和节点授权。真在线闭环需另外明确模型调用授权与注入入口；无权限时不读密钥。旧重放、I 单项或页级路线设计都不是完整 R33 PASS。 |
| R34 | 本 R30 备课/导出行为、C22 固定本机证据、schema/cases 与 R34 任务包 | 外层 R30 冻结且完整 R31 固定后可与 R32/R33 并行开发；最终集成须再固定 R32/R33 候选与停写回执。LibreOffice 实验不代签产品六输出或 Windows Word/WPS。 |

数学公共支持 `02340eb972d68221bde94976c0da5fa90648de89` 可作为已固定的限定组合输入，但不是完整 R31 PASS。M41 当前在另一工作树独立推进，后续只消费外层明示固定的提交和回执，不消费其浮动 HEAD。

## 最终冻结边界

外层 independent reviewer 可限定审核本次整合是否完整、固定引用是否一致、两项原阻断是否在其独立边界内关闭，以及下游放行条件是否没有被扩大。本 session 的 `PASS / self` 只表示文档整合和静态自检完成，不是 independent 结论。

最终冻结可确认“R30 候选的实验输入已足以被消费”，不得扩大为以下任一结论：

- R31-R34 任一产品已完成，或 R35 已通过。
- 新在线页级路线已成功，或旧重放可代替真产品请求。
- 旧 DOC 完整保真、任意 LaTeX 已通用转 OMML，或 LibreOffice 结果代表 Windows Word/WPS 实机通过。
- real-auth 已接入材料流程，或 test-principal 证据可代签真实认证。
