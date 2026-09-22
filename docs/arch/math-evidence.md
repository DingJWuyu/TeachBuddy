# M40 数学实验证据消费

M40/v1 固定设计为 `a6a495a7df6a870f455a431a2ac4169c79a37504`。本页固定 C23 候选 `d1490531e014ef437374c2f5a23cf3073baeef56` 为实验输入，以 [M40 原设计审查](../acceptance/evidence/M40/v1/review.md) `3da472ed10b87a18c7923eee97ce9b154ca76706` 的未变判断和 [C23 修正独立核验](../acceptance/evidence/M40/v1/correction-review.md) `b01bc73954cbbc13e464738e0f6f8aa6c6f12084` 的限定 PASS 为冻结依据。三项实验阻断已关闭，原审查对设计包的其他判断继续有效。冻结回执见 [handoff](../acceptance/evidence/M40/v1/handoff.md)。

这些证据只冻结 M40 设计与实验消费边界。它们不是产品实现、最终数学正确性、生产隔离、通用离线或目标设备的验收结论。

## 固定消费范围

| 切片 | C23 已固定的事实 | 产品阶段仍需完成 |
| --- | --- | --- |
| MA-01 公式 | 本地 MathJax 3.2.2 路线可用。两份固定 M-F 的真实 SVG/PNG 含完整中文说明，PNG 透明且边界未裁切。 | M41 按 `FormulaSource` 实现通用保存、重开修改和规范尺寸导出，并逐项验 WB-MA001/002。 |
| MA-02 静态图 | Q2/Q5/Q6 的真实 SVG/PNG 和指定源修改可用；该固定样本不证明通用对象编辑器。 | M41 按 `PlaneSource`/`SpaceSource` 验证对象增删修改、标注与 PNG/SVG 同源。 |
| MA-03 动态编辑 | 固定 M-D 可修改 a 范围/步长和步骤标题，保存、浏览器正常退出后重启及真实离线下载物保留同值。 | M42 按 `DynamicSource` 实现完整参数、拖动绑定、步骤文字/可见对象和服务端重开。 |
| MA-03 分步正确性 | 固定 `a=1,h=1,k=-4` 时，第二步曲线最低点、顶点圆点、标注和解析式同为 `(1,-4)`；编辑页与禁网新配置离线制品一致。 | M42 对产品自身的图、式、标注和分步状态验 WB-MA005/006，不以 C23 样本代签。 |
| MA-04 真实模型制作 | 两次真实请求与脱敏原响应支持“外部真实 HTML 可生成和改源”的有限样本。 | 不外推任意模型输出正确，也不继承 C23 调用参数为产品接口。 |
| MA-05 M-X | 固定 HTML 的导入、源码修改、保存重开、真实下载和 Linux Chrome 离线路线可用。 | M42 按不可变原 File、不透明源和受控 CSP 实测隔离；M43/M44 复验最终产品包。 |
| 隔离与冷启动 | C23 只支持固定样本在 Linux Chrome 的有限隔离和离线事实。 | M42 验生产 sandbox/CSP 与恶意 fixture；M43/M44 验最终制品。目标 Windows/Edge、PPT/WPS、触屏和课堂设备仍由后续目标环境验收。 |

## 证据读取

- 查三项原始阻断、未变设计判断和下游边界时，读 [review.md](../acceptance/evidence/M40/v1/review.md)。
- 查 M40-DR-001/002/003 的独立关闭结论、运行边界和证据定位时，读 [correction-review.md](../acceptance/evidence/M40/v1/correction-review.md)；其完整性以相邻 [SHA256SUMS](../acceptance/evidence/M40/v1/correction-evidence/SHA256SUMS) 为准。
- 下游固定输入、冻结范围和未决归属统一从 [handoff.md](../acceptance/evidence/M40/v1/handoff.md) 读取。

## 后续门禁

| 条件 | 责任与影响 |
| --- | --- |
| R31 固定文件底座 | R31 提供者固定完整交付后 M41 才可开始；M40 冻结不代替 R31。 |
| M41 与 M42 | M41 实现与自验后停止共用 math 骨架写入，交固定候选给 M42。 |
| R35 完整材料候选 | M43 同时等待 M42 和 R35 independent PASS 固定候选；材料接缝 PASS 不替代 R35。 |
| 目标设备 | M43/M44 或最终交付验收者在实际 Windows/Edge、PPT/WPS、触屏和课堂设备记录结果。 |
| 教学关联 | T50 所有者冻结完整新版后消费 math 扩展；完整作品反馈仍需 M44。 |
