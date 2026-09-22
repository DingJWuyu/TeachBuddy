# M43 内部 code-review

固定比较起点 `3464525bf05c84d07f8fab79c56b881f45d6a361`；最终代码 `965f813626fc40ba5fb8c04f0495c825f825b469`。依据 code-review skill，由继承调用模型/effort 的两个只读内部助手分别审查 Standards 与 Spec；不是业务 session，也不是 M44 independent。规格使用固定 D 的 M43 包、适用契约/BDD及本次派发，标准使用项目 AGENTS 与适用规则。

## Standards

发现 1 项 P2：lessons 直接依赖 math 内部校验、resources 直接依赖 lessons 内部模型，跨模块消费未经过公开边界。

当前数学校验属于 `workbench/content/mathSchema.js` 共享契约层，math 保持原契约导出；备课引用序列化通过 lessons 公共 API 导出。Standards 助手复核确认该项关闭，无剩余标准发现。没有为此次装配建立新的通用编排层。Standards 助手追加复核了 checkpoint/版本比较及材料 afterEach 的 context→server 关闭顺序，未发现新规范违例；没有降低业务断言或增加重试。

## Spec

发现 4 项并分别关闭：

1. 未保存的新环节被误判为已删除。返回现场记录进入时环节是否已保存，区分本地新环节与并发删除；[红灯](review-section-red.log)、[验证](review-section-green.log)。
2. 第二次保存明确失败后取消，未恢复原引用现场。当前撤回插入并保留原稿；未知结果禁止按已知失败取消。
3. 独立副本替换保存失败后重试，原引用已移除导致无法继续。当前先撤回失败插入，再基于原现场重试。
4. 替换/取消把引用移到末尾。当前按原引用位置替换及撤回；[红灯](review-order-red.log)，主 E2E 验证三引用中间项位置。

追加的真实浏览器用例发现：干净原稿进入数学后发生并发修改，返回直接加载新版会绕过原版本冲突。当前进入前保存本地检查点，并比较 ReturnTarget.baseVersion；只有明确采用服务器版才更新返回基线，目标删除仍须显式选择。Spec 助手对最后四个变更文件追加复核：未发现整改直接引入的保存回归，原四项继续关闭。现场 [红灯](e2e-scene-conflict.log)、[针对验证](e2e-scene-conflict2.log)，完整验证见 [e2e-complete-disk.log](e2e-complete-disk.log)。

Standards：1 项，剩余 0；Spec：4 项，剩余 0，追加现场并发缺陷已复核关闭。完整门槛及固定 P/T51 题目接口冲突仍按 [author.md](author.md) 保留，不由内部代码审查代签。
