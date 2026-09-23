# RELIABILITY-ENTRY 有界后继包

用途：根收到作者回执后固定本包与[依赖提案](../../arch/reliability-entry.md)，交一次必要的独立设计审查。本文是待采纳接续包，不是派发指令，不新增业务节点。

## 独立冻结

- 角色：独立设计审查，新 Codex session，`gpt-6-astra high`；任务 revision/attempt、基线、候选完整 SHA 和授权由根固定。
- 必读：提案全文及固定来源表；同版 `execution-protocol#design/#receipt`、DAG A12/M44/T51/T54/F60-F65/D70-D72、tasks/reliability、tasks/first-flow A10/A11、PRODUCT_SCOPE 基础交付要求。按提案的 SHA:path 核对 A10 恢复交接、A12 未决表及具名局部证据，执行 writing-for-agents。
- 写入：只新增根指定的独立回执，例如 `docs/acceptance/evidence/RELIABILITY-ENTRY/v1/review.md`（待生成）。提案、根 DAG/台账、旧证据、认证和产品只读。
- 审查问题：两类 A12 回环是否同时解除；设计冻结是否仍暗等 A12/T54 完整 PASS；F61-F63 是否保留冻结接缝和唯一写权的实施门槛；M44 的组合输入是否被误写成 T54 完整 PASS；A12 专项、完整收口与 F65/D72 复验是否各有唯一拥有者；完整范围和用户权限是否保留。
- 完成：对每项给可追溯结论，覆盖启动边及完成边；只签依赖提案 `independent PASS/FAIL/BLOCKED`。不签 A12/T54/F60 或产品阶段 PASS，不运行产品/模型，不读密钥、不联系业务 session。FAIL 回本设计的新 attempt，缺外部方案实证不伪称已具备可运行恢复流程。

## 冻结后接续

1. 根核对独立回执、候选和授权，采纳同一 revision，同步提案列出的 DAG/任务入口。完成条件：图、表、正文和外部条件一致，旧报告未改。
2. 根才可固定 F60 完整设计任务包，按 `gpt-6-astra high` 新 session 派发。输入复用提案固定来源及到达的新回执；只改变明确受影响的输入，R35/C21 活动任务不被本包换候选。
3. F60 按原 [reliability#f60](reliability.md#f60) 全范围完成方案及 F61-F64 消费切分。认证恢复操作须通过 A10 取得原拥有者接受的交接；环境实测缺项逐项留在最终验收。设计作者交独立冻结，未冻结的切片不派实施。

F60 的回执应明确：固定的业务组合与 C26 是否已真实合流、设计/实现/验收各自缺什么、共享写权何时交给下一串行拥有者、A12 专项如何消费 F62 候选、完整 A12/T54/其他模块如何在 F64 前汇合。当前不存在获准的 F61-F65 实施包，本短包不代写。

完成后提交自己获准的回执并停写，由外层唯一回调。main 合并、推送、部署和其他 session 通信均不在本包授权内。
