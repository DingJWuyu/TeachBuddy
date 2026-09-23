# C25-REVIEW@1 独立设计核验

结论：**CHANGES_REQUIRED / independent**。固定候选暂不可冻结。发现一个公共契约缺口 `C25-D01`，归 C25 设计者；不属于 C26 实现细节。其余已查内容未发现新增冻结阻断。本结论不改变 C24 的历史结果，不是 Agent 产品、真实认证或 A12 通过。

## 固定对象与检查范围

- 设计：`cadc61aa4ff36156b4a03fb9ba3401aba9783f9a`。
- 作者回执：`b7732f80a74111c5c30b1758335707324e5e7563:docs/acceptance/evidence/C25/v1/author.md`。两提交差异仅该回执；只读源工作树 HEAD 正是后者，受查设计文件无浮动修改。
- 实验：`e8fdf9a139e429c05590925647a433a9da382579`，消费其固定原始轨迹和祖先切片，不重跑真实模型。
- 当前协议：只读 `/home/liam_t/项目/TeacherWorkspace-mvp/docs/plans/execution-protocol.md` 的 design、acceptance、receipt 及设计冻结判据；协议 SHA-256 为 `7c4c7d0df149ff5578fc5ee13a52a96684ec503584216fc03a4e2d304b9804fb`，与 inputs.json 相同。
- 阅读顺序：作者回执、inputs/checks、故事/UX、契约与唯一 OpenAPI/交换样本、架构、BDD、C26/C27 包；按范围和实验争议补读 PRODUCT_SCOPE、WORKBENCH_DESIGN、设计规则、固定 C24 修复回执和 adapter。沿用 B11/认证冻结内容，只核对新增接缝与 schema 未变，不重复旧整套验收。

## 冻结阻断

### C25-D01：只读工具状态和结果缺少公开投影

优先级：P1，冻结阻断。拥有者：C25。影响：查找进度、只读失败详情、刷新恢复和前后端按同版契约实施。

固定候选位置：

- `docs/ux/agent.md:38` 要求工具卡显示查找、失败等状态，模型文字不能覆盖失败卡。
- `docs/contracts/agent.md:29` 要求工具参数/结果单独呈现；`:37` 要求已知工具拒绝进入 failed/tool-rejected，并可用持久卡片说明原因，无需再请求模型包装失败。
- `docs/contracts/agent.openapi.json:964` 的 Message 仅定义 user/assistant 文本、引用、状态等，没有工具调用/结果字段。
- 同文件 `:1531` 的 MutationRequest 只有七个写操作；`:1647` 的 Operation.request 仅引用它。
- 同文件 `:1878` 的 Snapshot 只有 messages、turns、operations 等；`:1944` 的 Event 只有 message/turn/operation/draft/conversation。内部 ToolOutcome 虽有 read 及 operationId=null 的失败，却没有进入浏览器响应或事件的引用路径。

最小契约复现：老师只要求查询一道题，pi 调用 `wb_get_question`，业务返回合法 404，系统按契约停止该轮。没有任何 mutation，也无需生成下一条 assistant 文本。浏览器可以收到 `Turn.reason=tool-rejected`，却没有已定义字段可取得失败工具名称、toolCallId、参数或 Problem；刷新读取 Snapshot 后同样无法恢复这张失败卡。正常查找的进行中/完成结果也存在同一缺口。

独立脚本验证 `getQuestion` 请求不被 MutationRequest 接受，并记录全部公开投影字段与事件类型，见 [checks.json](independent/checks.json) 的 browserProjection 和 readRequestRejectedByMutationRequest。此为设计层反例，未伪称运行了尚未实现的产品 E2E。

响应允许附加字段只是兼容策略，不能给两端提供尚未定义的公共字段；将工具结果塞进 assistant.text 也没有固定格式、稳定关联和状态语义，且混淆模型文本与真实工具回执。C26 不能自行发明这套交换契约。

关闭条件：C25 为全部开放工具明确最小公开投影及持久关联，覆盖只读开始、成功、已知拒绝/异常、停止与恢复；与已有写操作 journal 的关系清楚，并同步唯一 schema、成功/失败交换样本和 BDD。至少覆盖“只读工具失败且无后续模型回答，断流/刷新后仍显示相同工具失败详情”。修订方案不要求公开原生 entries、thinking 或引入新服务；具体字段由设计者决定。新固定候选经必要独立核验关闭本编号后才能冻结。

## 逐项判断

| 检查面 | 判断与依据 |
| --- | --- |
| 首页/右栏/同一对话 | UX 明确单账户 store、首页聚焦、共用工具/AI 栏、业务现场和滚动保留；WB-AG-001/002/003 对应。布局规则可实施，仍待真实 UI 验收。 |
| 持久草稿与发送 | 草稿 version、引用、整份 PUT、409、先持久后发送、事务清空及迟到 202 不清新输入互相一致；WB-AG-004/005/006/010 有覆盖。 |
| 断流/中断恢复 | snapshot 一致性与 seq、只推已落盘片段、重启 interrupted、原生 entries 与 journal、先确认再新 turn 均明示；WB-AG-011/012/013/018 可指导实施。只读卡片恢复受 C25-D01 阻断。 |
| 同键原体/冲突 | 成功重放优先版本检查、失败不消耗成功键、prepared/executing/未确认状态和原体 journal 能避免源变更后重新组体；手工冲突不覆盖、多步部分成功归属明确。公开 Operation 不暴露私有业务键不构成缺项，服务端 journal 拥有它。 |
| 权限/静态工具 | 9 个新增 HTTP 操作有 PageContext；13 工具名称/operationId/method/path 与冻结业务匹配；principal、key、来源由服务端掌握。复用 operations/mutations、调用前重验原会话、数据只作数据的边界明确。新增权限行为仍需 C26/C27 实证。 |
| pi 错误 | details.state 到外层 isError 的方案有本次真实本机 runtime 零模型对照支持，false/true/true；完整产品接线尚未验证。只读错误抵达 UI 的字段受 C25-D01 阻断。 |
| 模型/用量 | 精确白名单为 deepseek/deepseek-v4.1-flash、z-ai/glm-5.3-flash；unknown/fallback 本地拦截、配置 ready 不等于远端健康。请求 ordinal 防重复、缺 usage 标不完整、费用/余额 null、额度拒绝停止均明确，未将 cost=0 当免费。 |
| schema/样本/BDD | 离线 OpenAPI 结构校验、38 schemas、50 正反样本、18 唯一场景及故事关联通过；这只证明现有样本和结构一致，不覆盖 C25-D01 的缺失场景。 |
| C26/C27 边界 | 有固定输入、共享唯一写者、受影响回归、独占库/端口、零模型可推进与 live 授权边界。C27 要求两允许模型真实新样本链路及身份依据，没有把实验通过当产品通过。 |

## 实验支持的结论与实际独立检查

可采用 pi SDK 和已有业务规则开展有边界实现；实验不证明完整产品恢复或所有模型业务能力。

1. 从固定 Git 对象重新比对 PI-03、PI-04 中断会话：续写保留原字节前缀；新增 read_question 工具结果完整等于修复报告中的 HTTP 对象。新增复制次数分别为 0、1；各 copy-history 内 keyHash/payloadHash/返回 ID 元组稳定。PI-03 来源 v1、PI-04 来源 v2。机器结果见 [checks.json](independent/checks.json)。这里比较的是已保存的 HTTP 报告对象，本次未启动业务 HTTP/浏览器。
2. 固定 `pi04-conflict.copy-history.json` 明确为 409/version-conflict/currentVersion=2。固定 adapter 存在内存 payloadCache，重开缓存丢失时重新读源组体，因此原样本哈希相同不能推导任意时刻崩溃后仍能恢复原体。C25 已正确将此差距交给 journal 和 C26/C27 故障验证，未抹去旧聚合 FAIL。
3. 在本分支证据目录复制固定 `verify-error-semantics.mjs` 原文件，移除 COMMANDCODE_API_KEY，以 Node 22.23.2、pi 0.85.1 重跑真实 runtime。返回嵌套 isError、抛错、afterToolCall 覆盖的外层及持久值为 false/true/true。见 [本轮结果及 JSONL](independent/runtime/fix-attempt1/error-semantics/result.json)。assistant 为脚本构造，provider 请求为 0，不证明真实模型理解。
4. 阅读作者 sdk-reopen/entries-hydration 原始输出及固定 verify-sdk 代码：无凭据能读历史但模型 unknown，inMemory(entries) 等值只证明 SDK 加载能力。本次未重跑这两个探针，也未把作者输出升级为独立产品恢复 PASS。GLM 的既有基础探针不等于题库/备课真写入。
5. 本次独立 Python 校验直接读取设计固定 Git 对象：OpenAPI 外部引用离线展开后由 openapi-spec-validator 校验；jsonschema Draft 2020-12 校验所有 schema/样本并检查 format；Gherkin 解析及 ID/故事关联；工具映射；全部固定输入可解析及旧实验祖先关系；认证/工作台 schema 去掉 description/x-contract-status 后与固定认证源一致。

重验入口为 [check.py](independent/check.py)，依赖 jsonschema 4.26.0、PyYAML 6.0.3、openapi-spec-validator 0.9.0、gherkin-official 42.0.1：

```bash
python docs/acceptance/evidence/C25/v1/independent/check.py /tmp/c25-independent-checks.json
env -u COMMANDCODE_API_KEY PI_OFFLINE=1 node docs/acceptance/evidence/C25/v1/independent/runtime/verify-error-semantics.mjs
```

重跑 runtime 时先复制脚本到自己的隔离目录，避免追加或覆盖本报告正式证据。未运行产品构建、API/E2E、真实模型、实际浏览器或外部认证；本次仅设计审查及零模型 SDK 机制验证。

## 下游条件

C26 当前不能以此候选已冻结为前提启动实施。先由 C25 修订 C25-D01、固定候选并取得独立冻结；外层再固定认证集成候选及差异、共享入口唯一写者后派发。零模型实现不要求预先具有 live 调用授权；一旦发真实模型请求，必须具备该任务当次明确授权与允许配置。A11 新修复不由本核验确认，A12 独立核验仍归原责任链。

C27 完整通过需要 C26 固定产品 SHA/自验/隔离运行入口、修订后冻结设计、真实身份独立依据及本轮 live 窗口；以新数学题要求分别走两允许模型的查询、改编、加入指定备课环节并读回页面/数据库/工具一致结果。覆盖全部 WB-AG 场景、修订的只读工具投影场景、原源变更后的原键原体恢复、SDK 真实错误接线、跨账户/重登/独立设备、草稿和视觉。实际设备与模拟视口分别记录，缺外部条件只先完成独立可做部分，不能报告完整 PASS。认证/邮件/设备缺口归 A12 或外层提供者，实现缺陷归 C26，契约缺口归 C25。

## 回执

```yaml
task: C25-REVIEW@1
revision: v1
attempt: 1
role: design-review
status: CHANGES_REQUIRED
verification_level: independent
finished_at_utc: "2026-09-22T07:11:42Z"
session_id: "01a0c7ee-7965-75f0-bad4-e0c38c979e51"
runner: "Codex CLI / gpt-6-astra / medium，按本次固定派发，未切换"
skills_used: [writing-for-agents]
base_revision: "5320c9e04afd03fceaa3efb88fe74ee574f66df5"
result_revision: "本报告及 independent/ 所在提交，完整 SHA 由最终回执返回；git log -1 --format=%H -- docs/acceptance/evidence/C25/v1/review.md 可定位"
design_revision: "cadc61aa4ff36156b4a03fb9ba3401aba9783f9a"
author_receipt_revision: "b7732f80a74111c5c30b1758335707324e5e7563"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "cadc61aa4ff36156b4a03fb9ba3401aba9783f9a：设计、inputs/checks 及其固定输入"
  - "b7732f80a74111c5c30b1758335707324e5e7563：作者回执"
  - "e8fdf9a139e429c05590925647a433a9da382579：固定 C24 原始证据和 adapter"
  - "当前执行协议：本报告记录的路径和 SHA-256"
changed_files:
  - "docs/acceptance/evidence/C25/v1/review.md"
  - "docs/acceptance/evidence/C25/v1/independent/：检查脚本、结果、零模型 runtime 原始轨迹"
artifacts:
  - "docs/acceptance/evidence/C25/v1/independent/checks.json"
  - "docs/acceptance/evidence/C25/v1/independent/runtime/fix-attempt1/error-semantics/"
checks:
  - "OpenAPI/schema/50 样本/18 BDD/13 工具映射/9 页面头：PASS"
  - "固定版本、祖先、未变认证 schema、两份原始会话前缀/完整读回/重放元组：PASS"
  - "本机 pi 错误三路径零模型重跑：PASS，仅机制"
  - "只读工具结果到公开 UI 契约：FAIL，C25-D01"
identity_mode: "不适用：独立设计核验；消费的业务实验仅 test-principal"
new_product_model_requests: 0
open_items: ["C25-D01", "C26/C27 完整产品实施与验收", "A12 真实认证及新修复核验"]
failure_owner: "C25 设计者"
next_condition: "关闭 C25-D01 并独立冻结新候选，再按本报告下游条件启动 C26；C27/A12 门禁保留"
authorization_used: "用户 C25-REVIEW@1 / attempt 1：仅本分支新增独立报告/必要证据并提交；不改产品/源/旧证据/其他工作树/根台账，不合 main/push/部署，不发模型请求或其他业务 session；外层唯一回调"
```
