# C25-CORRECTION@1 / attempt 1

**READY_FOR_REVIEW / self**。C25-D01 的公开投影、持久关联与恢复语义已补齐，必要静态自检通过；编号仍待外层限定独立核验关闭，本回执不自行冻结设计。

## 处置与审查入口

[唯一 schema](../../../../contracts/agent.openapi.json) 候选版本为 `0.1.0-c25.2`，仍属 C25/v1 未冻结候选。新增一个 ToolCall schema，经 Snapshot.toolCalls 与 toolCall 事件覆盖全部 13 个工具；不增加 HTTP 操作或服务。精确字段由 schema 拥有，事务和恢复语义见[公开投影](../../../../contracts/agent.md#工具调用的公开投影)。

| C25-D01 关闭条件 | 本候选与实际自检 |
| --- | --- |
| 只读开始、成功、拒绝/异常 | prepared/executing/read/rejected/failed 投影；每工具参数/成功响应受原 schema 约束。13 工具状态矩阵、空结果与非法状态反例通过。 |
| 无后续 assistant 仍恢复失败 | 交换样本中仅 user 消息、零 Operation 的 wb_get_question/404；按 seq 补读并忽略重复事件，结果完整等于恢复 snapshot，原 Problem 和关联保持一致。 |
| 停止与恢复 | 未执行取消，执行中无持久结果的读取中断；已持久结果保留，重连/重启不重查。停止/重启样本的调用标识与参数一致；BDD 覆盖结果先落盘及尚未落盘两种顺序。 |
| 与写 journal 一致 | 写投影引用原 Operation，状态/结果/Problem 同事务维护；既有已确认写入去重可关联不同调用。同一快照的关联、参数、状态与结果逐项相等。原键原体与未确认写入规则保留。 |
| 唯一 schema、样本、BDD、接续 | 39 schemas、99 正反样本、23 个唯一 WB-AG 场景通过；新增 019-023 与故事关联，C26/C27 包同步。 |

静态结构和样本不能证明实现中的落盘顺序、SDK hook、真实浏览器、停止竞态或崩溃恢复。上述产品验证归 C26/C27。本轮未运行产品、浏览器或 runtime，未请求模型，也未重复已有 C24/C25 实验。

原 author、checks、inputs、offline 实验文件逐字保留。只读独立报告固定为 `e0b2c23fc1e37c357831cefacb0817c07ae3cafd:docs/acceptance/evidence/C25/v1/review.md`，工作树文件与固定对象 SHA-256 一致。原 18 个 BDD、9 个 HTTP 操作、13 个工具映射、Operation/MutationRequest 及其余未受影响 schema 保持不变；认证/工作台 schema 未改。

## 新自检证据

- [inputs.json](correction/inputs.json)：固定输入、只读协议/报告校验值、实际 session/model/effort。
- [checks.json](correction/checks.json)：标准结构校验、全部样本预期/实际、工具状态矩阵、snapshot 关联、失败事件恢复及旧材料保留断言，含受改设计 SHA-256。
- [check.py](correction/check.py)：本次直接离线检查入口。依赖 `jsonschema 4.26.0`、`PyYAML 6.0.3`、`openapi-spec-validator 0.9.0`、`gherkin-official 42.0.1`；均装在本工作树临时 venv，未修改项目依赖。

复验者先检出本回执的 result_revision，在自己的隔离 Python 环境从仓库根运行：

```bash
python docs/acceptance/evidence/C25/v1/correction/check.py
```

该命令写其所在目录的 checks.json；在自己的可写副本执行，保留本次固定证据。样本反例按预期拒绝属于 PASS；没有宣称产品 E2E 或独立冻结 PASS。

## 接续条件

C26：外层针对新增公开投影安排限定独立核验、关闭 C25-D01 并冻结本次完整设计 SHA，再固定认证集成差异及共享入口唯一写者。认证可供集成产品为 `9ecabbf60cbbaecce2e9be8191d270068eb675cf`，本地 independent PASS 依据为 `aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md`。其范围为 real-api/fake-mail，真实邮件/目标设备及外部门禁仍未通过；本任务只同步接续状态，未重审认证或更改契约。零模型实现可按授权推进，live 请求另需当次授权和允许配置。

C27：消费修订后独立冻结设计、C26 固定产品 SHA/自验/隔离运行入口、真实身份独立依据与本轮 live 窗口。原 WB-AG-001 至 018 保留，新增 019-023 必须在真实产品验证；两允许模型分别走新题查询、改编、指定备课引用和读回链路。外部条件缺失时只先做可独立部分，不报完整 PASS。实现归 C26，契约归 C25，认证外部项归 A12/外层提供者。唯一完成通知由外层负责。

## 回执

```yaml
task: C25-CORRECTION@1
revision: v1
attempt: 1
role: design
status: READY_FOR_REVIEW
verification_level: self
finished_at_utc: "2026-09-22T07:27:56Z"
session_id: "01a0c7f6-fb1f-7e90-91f0-f78ed22857f6"
runner: "Codex CLI / gpt-6-astra / high；已核对当前 session turn_context"
skills_used: [writing-for-agents, codebase-design]
base_revision: "b7732f80a74111c5c30b1758335707324e5e7563"
result_revision: "18293e9389e739ed8aaf67ee568503ca8e87d475"
report_revision: "本文件由单独回执提交固定；完整 SHA 见最终回复，亦可 git log -1 --format=%H -- docs/acceptance/evidence/C25/v1/correction.md 定位"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "cadc61aa4ff36156b4a03fb9ba3401aba9783f9a：原设计；b7732f80a74111c5c30b1758335707324e5e7563：固定作者 HEAD"
  - "e0b2c23fc1e37c357831cefacb0817c07ae3cafd:docs/acceptance/evidence/C25/v1/review.md：只读 C25-D01 及下游条件"
  - "9ecabbf60cbbaecce2e9be8191d270068eb675cf：后续认证集成产品"
  - "aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md：仅本地 independent PASS"
  - "当前外部执行协议 design/receipt 与适用 ownership；路径和 SHA-256 见 correction/inputs.json"
changed_files:
  - docs/contracts/agent.md
  - docs/contracts/agent.openapi.json
  - docs/contracts/agent-examples.json
  - docs/ux/agent.md
  - docs/arch/agent.md
  - docs/user-stories/agent.md
  - docs/acceptance/agent.feature
  - docs/plans/tasks/agent-implementation.md
  - docs/acceptance/evidence/C25/v1/correction.md
  - docs/acceptance/evidence/C25/v1/correction/check.py
  - docs/acceptance/evidence/C25/v1/correction/checks.json
  - docs/acceptance/evidence/C25/v1/correction/inputs.json
artifacts:
  - "correction/checks.json：实际静态结果及设计文件 SHA-256"
  - "correction/inputs.json：固定输入与只读外部文件 SHA-256"
checks:
  - "OpenAPI 3.2.1 离线引用展开、39 schemas：PASS"
  - "99 正反样本、13 工具生命周期与无效参数、快照关联：PASS"
  - "只读 404 无 assistant/无 mutation，重复事件与恢复快照一致：PASS"
  - "停止/重启身份关联样本、Gherkin 23 唯一场景及故事映射：PASS"
  - "未受影响 schema/HTTP/工具/旧 18 BDD/原证据保持：PASS"
  - "36 个本地文档链接目标及 git diff --check：PASS"
identity_mode: "不适用：仅设计及静态验证"
new_product_model_requests: 0
open_items:
  - "C25-D01 待外层安排新增公开投影限定 independent 核验后关闭及冻结"
  - "C26/C27 实现与真实产品场景证据，含本次新增 WB-AG-019 至 023"
  - "A12/外层提供者的真实邮件、目标设备及外部条件，不以本地 PASS 代替"
failure_owner: null
next_condition: "限定独立审查固定 result_revision；关闭 C25-D01 后按更新 C26/C27 短包接续"
authorization_used: "用户 C25-CORRECTION@1 / attempt 1：限定设计修订、必要 schema/样本/BDD/接续说明、自检和分支提交；不实现或运行产品、不请求模型、不改其他工作树或根台账、不重做旧实验、不合 main/push/部署、不派业务 session；外层唯一通知"
```
