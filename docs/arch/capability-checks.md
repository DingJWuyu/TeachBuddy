# 能力实验参考

本目录保存 C20 冻结的实验目标、固定样本和判据。它不是当前调用或派发授权。实验代码/证据不自动等于产品已实现。

| 实际需要解决的问题 | 参考判据 | 当前入口 |
| --- | --- | --- |
| 自动提取 / OCR | [C21](capability-checks/C21.md) | [当前复用方案与许可](../plans/run-inputs.md#c21)；旧在线窗口关闭 |
| Office 预览 / 可编辑输出 | [C22](capability-checks/C22.md) | [备课](../modules/lessons.md)；Pandoc 产品路线已接，运行工具与目标软件尚有缺口 |
| 数学制作 / 离线 | [C23](capability-checks/C23.md) | [数学](../modules/math.md)；已有具名本地实现与验证 |
| pi / 产品模型 | [C24](capability-checks/C24.md) | [Agent](../modules/agent.md)；开发暂停 |

<a id="共同边界和交付"></a>
## 实验边界

原 C20 每项最多两条候选，每条一个固定样本批次，普通配置错误一次修正；这些是原批次的停止上限，不是新的请求窗口。新增方案使用其已冻结的独立限制，保留累计消耗。

读取本次切片的判据与样本，不再次执行整套已完成实验。原候选的次数上限不代表新窗口授权；当前产品调用边界由[窗口记录](../plans/run-inputs.md#模型窗口)及用户本次许可决定。

公共材料：[样本索引](capability-checks/samples.md)、[原生 T 输入语义](capability-checks/T-native-input.md)、[环境条件](capability-checks/environment.md)、[一手来源](capability-checks/sources.md)。样本不满足实际新场景时如实留缺口，不通过修改分母制造通过。
