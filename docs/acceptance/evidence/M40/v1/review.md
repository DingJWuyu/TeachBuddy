# M40/v1 独立设计冻结核验

```yaml
task: M40-REVIEW@1
revision: M40/v1
attempt: 1
role: design-review
status: CHANGES_REQUIRED
verification_level: independent
finished_at_utc: "2026-09-21T23:07:55Z"
session_id: unavailable
runner: "Codex Sol high；本地 shell 与只读制品观察；未调用模型或外部服务"
skills_used:
  - writing-for-agents
base_revision: d2536a2bae0c7a7553e3ffc7097c37f1aee1fec4
reviewed_design: a6a495a7df6a870f455a431a2ac4169c79a37504
author_receipt: b626a93c41af7533a8069a486bcff0ef26b50a55
result_revision: "docs/acceptance/evidence/M40/v1/review.md；本回执提交的完整 SHA 由外层回调固定"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "d2536a2bae0c7a7553e3ffc7097c37f1aee1fec4：固定工作区输入"
  - "a6a495a7df6a870f455a431a2ac4169c79a37504：M40/v1 受审设计"
  - "b626a93c41af7533a8069a486bcff0ef26b50a55：作者 self 回执"
  - "c82cd69b84c2c3b4b3730384b951bf3d914cc112：材料接缝限定 independent PASS"
  - "bf779db4c4908cb61d25824c1859516ff39e1e0e：C23 固定实验与实际制品"
  - "acbf48f01b5dc15373546545af80fa2e7e79f0c3：T50 只读参考原候选"
  - "afda1c5d8d8c2de93f1e045ff2ad32e2681bd116：T50 样本与锚点限定修正，未当作整体 PASS"
changed_files:
  - docs/acceptance/evidence/M40/v1/review.md
artifacts:
  - "docs/acceptance/evidence/M40/v1/review.md：独立结论、稳定缺口与放行边界"
checks:
  - "固定 SHA 、祖先关系与 a6a495a7 后的设计文件未改动：PASS"
  - "math OpenAPI JSON 可解析；72 个命名 schema、19 个唯一 operationId、内部 $ref 可达：PASS"
  - "19 个操作均有 PageContext 与 no-store，写操作均有幂等键与来源保护：PASS"
  - "35 个样本的内部 math schema 约束和 4 个反例预期复核：PASS；外引 materials 分支沿限定冻结候选消费"
  - "math 批次 13 份入口文档的 76 个本地链接与锚点：PASS"
  - "a6a495a7^..a6a495a7 git diff --check：PASS"
  - "C23 公式导出路径、动态可编辑字段、第二步绘制公式与离线 M-D 源静态复核：复现 M40-DR-001 至 003"
  - "C23 第二步截图只读目视：曲线顶点 (1,0)，点、标注和式为 (1,-4)"
must_fix:
  - "M40-DR-001：C23 MA-01 未证明中文说明进入透明 PNG/SVG，当前导出实际排除说明"
  - "M40-DR-002：C23 MA-03 未提供修改参数范围和步骤文字、保存、重开恢复的原实验必达证据"
  - "M40-DR-003：C23 MA-03 第二步曲线、顶点标注与解析式不一致，且真实 M-D 离线制品沿用同一逻辑"
open_items:
  - "R30 整体因原材料实验门槛未关闭，R31 仍未放行"
  - "M41 必须同时等 M40 independent PASS 和 R31 固定交付"
  - "M43 必须等 M42 固定候选、R35 independent PASS 候选和公共写权"
  - "T50 后续 afda1c5d 只修样本与锚点；教学反馈 math 分支仍需 T50 拥有者发布完整新版并独立冻结"
  - "Windows Chrome/Edge、实际 PPT/WPS、课堂和触屏设备仍属 M43/M44 或外层目标环境实测"
failure_owner: "C23 负责关闭原实验 MA-01/MA-03 证据；M40 负责以新固定 C23 输入重新消费并交新候选"
next_condition: "C23 在候选 A 上最小修复并重验 MA-01/MA-03 的未闭切片，固定新证据和回执；M40 更新实验消费引用后再做限定独立冻结"
authorization_used: "用户 M40-REVIEW@1 / attempt 1：只新增 review.md，受审设计/产品/旧证据只读，不改台账/DAG，不合 main/push，不调用模型、外部服务或其他 session"
```

## 结论

`CHANGES_REQUIRED`。受审设计的产品行为、唯一 schema/样本/BDD、材料引用新版、教学反馈扩展以及 M41-M43 任务包未发现需另改的设计缺口。不能冻结的原因是 `math-evidence.md` 虽如实记录了 C23 制品的缺陷，却把其中三项 C23 原实验必达内容全部后移为 M41/M42 产品责任。作者的 `self PASS` 不能代替本次对原件和必达项的独立判断。

本结论不是 `BLOCKED`。所需原件和浏览器证据都存在，失配可静态定位并由当前本地候选 A 有界修复，不缺凭据、设备或密钥。不需要重做 C23 全部旧实验，也不需要新的模型请求。

## 稳定缺口

### M40-DR-001 C23 公式中文说明没有进入导出物

C23 的 MA-01 要求透明 PNG 和 SVG 显示完整中文说明。实际 `experiments/C23/app/index.html` 把说明写入 `formula-source-preview`，但 PNG/SVG 都只导出 `formula-stage` 中的 MathJax SVG。因此当前制品可证明公式本体路线，不能证明 MA-01 的说明导出。

- 归属：C23 实验候选 A。M41 仍负责产品实现，但不能用未来产品实现反向补签 C23。
- 最小关闭条件：修正公式成果边界，对含中文说明的固定 M-F 重新导出真实 PNG/SVG，目视说明完整、透明、不裁切，并保留源、产物和读取证据。

### M40-DR-002 C23 动态范围和步骤文字并不可编辑

C23 的 MA-03 与固定 M-D 样本明确要求修改可调范围和步骤文字，保存后重开继续修改。实际保存状态只有 `a/h/k/step`，范围写死在三个 range 控件，步骤文字写死在按钮中。作者的复核记录同样只列出三个数值滑杆。

- 归属：C23 MA-03。通用动态作品源和服务端持久化是 M42 产品责任，但固定 M-D 范围/步骤的可编辑性是原实验责任。
- 最小关闭条件：在候选 A 中修改 `a` 的范围或步长和至少一个步骤标题，保存、关闭/重开后读回同值，并证明生成的真实 M-D 离线物使用修改后的范围和文字。

### M40-DR-003 C23 第二步曲线与标注、公式不一致

当 `a=1,h=1,k=-4` 且选择“2 平移”时，绘制分支实际计算 `(x-h)^2`，未加 `k`；顶点点、文字和解析式仍使用 `(h,k)` 和 `+k`。只读截图明确显示曲线顶点 `(1,0)` 与点/标注/式 `(1,-4)` 分离。`generated/M-D-offline.html` 由同一逻辑生成，不能把编辑页中的错误当成仅实验 UI 外观问题。

- 归属：C23 MA-03 固定样本正确性。M42 需实现本版 WB-MA006，但不是 C23 错误的替代关闭者。
- 最小关闭条件：修正第二步的曲线、顶点、标注和解析式，用固定值复现一致结果，重新下载真实 M-D 制品，在关闭制作服务和禁网的新配置中至少复验该步。

## 设计包一致性

| 切片 | 结果 | 独立判断 |
| --- | --- | --- |
| 公式 | PASS | `FormulaSource` 保留 LaTeX、说明、选入标志、颜色和字号；WB-MA001/002 覆盖保存、重开修改、无效源与透明 PNG/SVG。本结论不表示 C23 已证明说明导出。 |
| 平面与空间静态图 | PASS | `PlaneSource`/`SpaceSource` 有可修改对象、标注、线型、投影和视窗；WB-MA003/004 同源检查 PNG/SVG。通用对象编辑器是 M41 实现责任，不是 C23 固定三样本的追加门槛。 |
| 动态作品 | PASS（设计） | `DynamicSource` 唯一表达参数范围/步长/初值、拖动绑定、步骤文字/可见对象/全参数值；样本第二步使用 `(x-h)^2+k`；WB-MA005/006 要求持久与数学一致。上述是正确产品要求，不能取代 C23 缺口的关闭。 |
| 外部 HTML | PASS | `HtmlSource` 只保留不可变 File，作品改名与源码内标题分开；原件、当前源、隔离包分开导出。WB-MA007/008 没有假定任意 HTML 都有通用参数面板。 |
| 备课往返 | PASS | `ReturnTarget` 是设备内现场；作品保存与 lesson v3 完整保存分为两个幂等写；`MathReference` 固定版本快照，更新/另存/删除/恢复语义与 WB-MA009 至 012、019 一致。 |
| 导出与错误恢复 | PASS | 导出锁定 revision，源、静态、动态和 HTML 可用格式封闭；未知结果沿原键确认，冲突/删除/缺文件有稳定恢复；WB-MA013/014/016/017 与语义一致。 |
| 唯一 schema/样本/BDD | PASS | 精确字段只在 `math.openapi.json`，35 个样本与 cases 给双侧交换顺序，20 个 `WB-MA` ID 唯一；未发现平行 DTO 或相互矛盾的可观察结果。 |

## C23 已可消费与不应扩大的范围

以下 C23 切片可保留，不需要因本次结论全部重做：

- MA-02 固定 Q2/Q5/Q6 的 SVG/PNG 路线、三项指定修改与保存源。
- MA-04 两次真实模型生成/修正 M-X 的有限样本。它不是产品模型接口或任意生成物正确性证明。
- MA-05 M-X 的真实导入、完整源码编辑、标题/首个 range 样本修改、保存重开、真实下载与 Linux Chrome 禁网冷启动。
- MathJax 3.2.2 本地 bundle 和原生 SVG/JavaScript 可作为候选 A 路线；候选 B 未运行不自动构成缺口，只要 A 关闭原实验必达项。

C23 的 iframe 只证明无 `allow-same-origin` 的有限机制，`allow-forms` 与 URL 正则扫描不能证明生产账户隔离、CSP 网络限制或通用离线。这不是新增的 C23 必达项。受审设计已正确把 opaque-origin iframe、受控 CSP、恶意 fixture 和真实产品包冷启动分别交给 M42/M43/M44，本次不要求 C23 追加产品安全验收。

## 公共消费者与后续闭合

| 消费者 | 结果 | 可用输入、所有权与验收边界 |
| --- | --- | --- |
| M41 | 设计闭合，尚未放行 | 需 M40 independent 冻结和 R31 实际 File 底座。独占 math 共用聚合/迁移/源校验/公共端口，交真实数据库、文件、浏览器和数学检查；M44 最终独立验收。 |
| M42 | 设计闭合，尚未放行 | 只接已停写的 M41 固定候选，复用同一 Work/Revision/File；实现动态源、外部 HTML、生产隔离与真实下载，必须回归 M41。 |
| M43 | 设计闭合，尚未放行 | 需 M42、R35 independent PASS 材料候选、M40 冻结及公共单写者交接。独占 lessons v3/math 装配、备课返回、使用位置、跨模块 E2E 和最终离线制品，交 M44。 |
| lessons/材料 | PASS（限定设计接缝） | 只消费 c82cd69b 冻结的 File/Document/Location/旧 Reference/Usage；math 用 `readForReferenceV1`、lesson v3 封闭联合和固定快照扩展，没有向旧 kind 偷加 math。R30/R31/R35 原门禁保留。 |
| T51/T53 教学反馈 | PASS（提供方设计） | `TeachingWork`/`TeachingMathInput`/`TeachingMathSource`、`readForTeachingLinkV1`、classes v2 路径/删除/反向列表及目录 v3 增量都明确。由 T50 拥有者产生完整新版 OpenAPI 并独立冻结，T51 在 classes 内消费，T53 单写者装配。WB-MA018 归 T51/T54，不反向阻塞 M44。 |
| T50 参考状态 | 未冻结 | `acbf48f` 仅是只读参考；`afda1c5d` 只修样本 Unicode 边界和稳定锚点。本核验不宣称 T50 PASS，不把其当成 M41/M43 已接入输入。 |

## 放行边界

当前可保留并直接复用受审候选的行为/schema/BDD/任务包，以及 C23 的 MA-02、MA-04 和 M-X 已验切片。后续只需针对 M40-DR-001 至 003 补 C23 候选 A 证据，再让 M40 以新固定输入更新 `math-evidence.md` 和回执；无需扩大为生产隔离、通用编辑器、Windows 或 Office 验收。

在限定复核取得 `independent PASS` 前：

- 不得将 M40/v1 标为冻结，不得以作者 `self PASS` 开始 M41。
- R31 仍等 R30 整体原材料门槛和既有固定基线，本报告不放行 R31。
- M43 仍等 M42 与 R35，限定材料接缝不能替代 R35。
- 教学反馈仍等 T50 完整新版和 M44 真作品，不得将 provider 设计当成 T51/T53 已接真。
