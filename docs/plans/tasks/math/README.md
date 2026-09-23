# M41-M43 最小任务包

本目录保存 M41-M43 的职责与验收范围，不是待执行清单。M40 已冻结，数学实现已汇入当前产品；实际能力见[数学入口](../../../modules/math.md)，当前任务与授权见[运行台账](../../run-state.md)。修复时只读对应节点和相关契约，不重做整条链路。

| 节点 | 固定输入与门禁 | 入口 |
| --- | --- | --- |
| M41 | M40完整候选SHA + independent冻结回执；R31实际文件底座完整SHA/回执、运行与迁移入口；共享文件写者交接情况 | [公式与静态](M41.md) |
| M42 | 同版M40；M41完整SHA、自检/运行/集成清单，且M41停止math公共骨架写入 | [动态与外部HTML](M42.md) |
| M43 | 同版M40；M42完整SHA + R35独立PASS固定材料候选；外层独占公共装配授权 | [往返与离线](M43.md) |

表中是完整节点门槛。获准的本地切片依赖见[数学文件接缝](../../../arch/math-foundation-dependency.md)和[DAG](../../mvp-dag.md)，局部通过不代签完整节点。M42 不与 M41 并写源码模型；教学反馈的真实组合单独验证。

共同必读：[契约入口](../../../contracts/workbench/math.md)的共同协议、作品/源、错误及本节点相关节；[schema](../../../contracts/workbench/math/math.openapi.json)、[cases](../../../contracts/workbench/math/cases.md)、[样本](../../../contracts/workbench/math/samples.json)；[实验消费](../../../arch/math-evidence.md)只需裁决表与未决证据；UI读[UX](../../../ux/math.md)本节点章节及设计规则。字段只从唯一schema实现，不拷贝平行DTO，不修改冻结文档来适配代码。

模型、skill 和报告按[当前实施协议](../../execution-protocol.md#implementation)，本目录不另设模型回退。公共语义冲突归设计者，模块缺陷归实现者；不要改冻结契约来迁就代码。

在任务指定的开发树工作，测试账户、DB、文件目录和端口隔离。只运行变更所需的既有检查，实际入口见[数学入口](../../../modules/math.md)；节点包中的初始 glob 须核对是否存在，不得空跑报 PASS。实际浏览器截图必须检查，不能只保存。

回执 `docs/acceptance/evidence/<节点>/v1/author.md`，公共装配需求 `integration.md`，给实际UTC、完整候选SHA、self、identity_mode、真实/替身分别标识、BDD逐项与运行入口、必要截图/下载物校验值、未决项。后续独立验收M44按最终集成候选复现。提交权限按外层单次派发，以上包不授权main/push/部署/新模型费用或改根台账。
