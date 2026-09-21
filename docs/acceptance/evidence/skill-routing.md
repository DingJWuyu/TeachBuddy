# skill-routing@1 正式回执

- session：`01a0c4d1-9404-75b1-8b48-5f5a928c0664`
- runner：`gpt-5.6-sol`，`high`
- 状态：`READY_FOR_INTEGRATION`
- 报告：[skill-routing.md](../../plans/skill-routing.md)
- 固定输入 SHA-256：`9cddc05827f0bfc1797d7b357d21d809f950ff56796e3908e2844b999e4ba5a0`
- 本回执用途：保存最小集成清单和未验证边界，不新增 DAG 节点或审查结论

## 已集成的规则

- `code-review` 的 Standards、Spec reviewer 是调用 session 管理的只读内部叶子，向根只返回一份聚合回执。
- `code-review` 只审固定点到 `HEAD`；实现变更须先形成获授权候选提交，检查 diff 非空且工作区无漏审内容。
- 实现自检、skill 内部双轴 review、阶段真实 UI/API 流程验收分层，不重复派同内容的外层 review。
- 常规核验和内部 reviewer 默认使用 `gpt-5.6-sol` `high`；复杂疑难审查才升级 Astra；普通实现默认 Luna max，困难实现才升级 Sol high。
- 任务包记录适用 skill、fixed point、spec/standards 来源、Git 权限和内部模型/harness 能力。

## 尚未证实的能力

- 未验证 dsh headless 是否支持内部 subagent 或显式固定 Sol high。
- 未验证所有候选 harness 的内部委派和主动通知能力。
- 本回执不证明产品 DAG、认证交付、真实模型调用、部署或中断恢复演练已完成。
