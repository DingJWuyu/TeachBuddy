# Spec 审查

初审固定基线 `789a38d83babad04f2e2a51e9f17530abf638801`，候选 `13e16e273b36beaddf3aa090fb9f1463a8ff6a1a`。依据用户测试消融委托与 `docs/plans/test-suite-rebuild.md:5-19`，只读审查，无产品/测试改写或本地 CI 重跑。

## 初审发现

1. **P2，独立答案保护不足。** `apps/api/test/rebuilt-outputs/document-outputs.test.js:23-31` 只查图片数量、尺寸和透明像素；将答案替换为题干仍满足断言。`docs/contracts/materials.md:125` 要求“includeAnswers=true 时答案另成分片”。其他候选用例不消费答案输出，需在现例验证实际题面与答案的独立性。
2. **P3，数学覆盖声明未同步。** `docs/contracts/math.md:72` 仍声明禁网 file:// 回归验证纯公式及播放，但纯公式用例仅检查源码/PNG，课堂包用例没有播放验证，不符合任务“CI 和验证文档同步”。应收窄事实声明，无需恢复旧矩阵。

## 增量复核

复核 `13e16e273b36beaddf3aa090fb9f1463a8ff6a1a...56672e6cbbdc1212333e3a4365e5ee1acb5a85a3`，两项均关闭，未新增 Spec 发现。

- **P2 已关闭。** C3 以纯题面摘要核对带答案输出前缀，仅修改 solution 后题面不变且答案后缀必须改变。已读取作者原始 `c-spec-answer-content.log`：1 PASS、0 skip，5.43 秒；`c-spec-red-answer-as-body.log`：真实生成器错用 body 时，新断言具名 notDeepStrictEqual 失败。证据位于作者 outputs 工作树的 `test-results/test-suite-rebuild/`；本次复核复用证据。
- **P3 已关闭。** 契约移除过度声明，`docs/acceptance/README.md` 数学专项准确区分二维/三维课堂包、纯公式源码/PNG和按变更专项的纯公式课堂冷开/播放。
- `support/directories.js` 基于模块位置在仓库 test-results/runtime 创建 mkdtemp 唯一目录；各调用者的服务关闭、成功清理和失败保留逻辑保持。该增量无产品源码改动，未发现隔离退化。

## 最终代码增量复核

复核 `56672e6cbbdc1212333e3a4365e5ee1acb5a85a3...12436bd78cc72e5043b0f3eedc2e38b9bdcc77b6`，无新增或开放 Spec 问题。

`resources-math.spec.mjs:13-28` 分别检查设备草稿、真实 PUT200/已保存状态及新设备名称/笔记。`onNewDevice` 仅复制 Cookie，origins 为空，新 context 不能读取原设备草稿，符合 `docs/contracts/workbench.md:49-60` 的草稿/跨设备保存区分。已读取作者 `resource-metadata-final.log`：1 PASS，单例8.6秒；503故障在200断言失败；伪200且不持久化已越过成功状态，在新设备名称断言得到旧文件名并失败。故障补丁确实只伪造回执而不提交，最终源无注入。classroom fixture 仅删除EOF空行，无行为影响。本次不重跑测试或CI，也不重审已关闭C3。

当前结论固定于 `12436bd78cc72e5043b0f3eedc2e38b9bdcc77b6`。独立消融终稿仍在进行，最终完整CI待PR；trunk集成及清理仍待总控完成。真实模型、GPU、商店、Office和目标设备边界不代签。初审2项，已关闭2项，开放0项。
