# MATERIALS-GATES-SYNC@1 / attempt 1

**PASS / docs-integration。** 已将固定提案 `da23eb680a9c8b214ad18482d4f1fbc8a5f3fded` 及限定 independent PASS `677161bd23e37e2d8e22ae7e47214e2e662011ed` 同步到现行 DAG 和任务入口。本回执只证明文档入口一致，不是 R35、M43 或 M44 产品 PASS。

## 实际改动

- `docs/plans/mvp-dag.md`：纳入 R35 具名本地消费切片到 M43、M43 固定局部候选到 M44 的限定本地启动边，并保留完整完成边。
- `docs/plans/tasks/{materials,math}.md` 及 `docs/plans/tasks/materials/continuation.md`：固定切片范围、P/M/D、共享唯一写权、局部回执边界和完整交回条件。
- `docs/arch/materials-continuation.md`：将待采纳提案改为已采纳裁决，保留在线预算 0、设备未证、共享重启 OPEN 和后续完整门禁。

## 边界与自检

- R35 当前仍在验收；文档未声明其已通过，也未声明 M43 已开始。
- `c915f5939cb9e4102bbc9d84d4b83608b72eda52:docs/acceptance/evidence/R34/v1/restart-diagnosis.md` 只作错误证据引用，未搬入诊断制品，未把其写成根因或修复。
- 未增删业务节点，未新增审批、设计或验收层；完整 M44 到 T51 完成真实作品关联、T54、F60 及最终交付链保留。
- 仅做 Markdown 链接/固定引用、互相一致、范围和 diff 自检；产品运行、产品模型请求、设备代签和额外 reviewer 均为 0。

本分支提交后停写；不合并 main，不 push，不部署，不修改根 `run-state.md` 或旧 author/review 证据。
