# R34/v1 内部双轴审查

固定点 `401e56d0e68de54891f2f0bda18d66a4407f043b`；初始受审候选 `01c6a85a2d9d99770743a83b765a2f1501929dfd`。两个只读助手按 code-review skill 并行执行，均继承 Codex gpt-6-astra low，不写业务目录、不派发其他助手。审查限定获准的并行阶段，不代替 R35 independent。

## Standards

1. 硬规则缺口：FilePreview 页码、缩放仅存 useState，关闭重开会回第一页、100%，滚动丢失。违反 design-and-verification.md 的所有模块保留现场规则。
2. 作用域判断：materials.css 在小于 1100px 时给全局 .wb-section-head 设置 flex-wrap，会影响其他模块；应限定到备课/预览容器。依据 execution-protocol 的模块所有权及 materials 架构的阶段边界。

未发现需要单列的 smell baseline 问题。此轴为静态内部审查，不代表独立浏览器验收。

## Spec

1. P1：ExportsPanel 持久化的 sectionIds/materialReferenceIds 未剔除消失项，删除已选环节或把备用引用移入环节后持续 422，UI 无法取消隐藏 ID。契约要求 sectionIds 属于当前课，materialReferenceIds 来自未安排集合。
2. P2：LessonDetail 切到取材/输出会卸载文稿滚动 DOM，但原 hook 的 restoredRef 保留；返回后失去原段落。UX 要求成功后返回原段落和现场完整。
3. P2：资源版本对照也渲染不存在的 solution，出现不支持文档提示；当前文件仅文件名，不能预览核对。UX 要求原件版本、预览与打开来源。

未发现额外范围扩张。冻结 Adapter、Linux Office 是获准并行阶段；最终真实链及 Windows/WPS 仍应保留未决。

## 当前处理与证据

| 原轴/项 | 当前实现 | 验证 |
| --- | --- | --- |
| Standards 1 | 按 account/file 的 useScene 保存页码、缩放、滚动；页图加载后恢复 | browser.log 首条：缩放150%、滚动100、关闭重开恢复 |
| Standards 2 | 选择器限制到 .wb-lesson、.r34-exports、.r34-preview | 产品 diff 静态检查与1024截图 |
| Spec 1 | 展示及新提交只保留当前可选 ID；未确认请求的原键 payload 不改 | review-selection-red.log，browser.log 删除已选环节后生成成功 |
| Spec 2 | 文稿 DOM 挂载即恢复；滚动现场同步保存，不改公共 hook | review-scroll-red.log，browser.log 长课输出往返 |
| Spec 3 | 只有题目渲染答案；两侧资源使用固定 File ID 预览 | review-scenes-red.log，browser.log 资源双侧真实页图 |

原始问题数量：Standards 2，最严重为现场硬规则缺口；Spec 3，最严重为 P1 输出恢复。两轴分别保留，不跨轴排序；当前结果以 author.md 的固定候选及复核记录为准。

## 固定修正候选复核

`9767e4feeae24d6adabbe7b87ff4876b418fc80d` 已由原两位只读助手进行有界复核。

- Standards：PASS。原两项关闭；account/file 的现场持久化和三个备课容器的选择器范围符合整改要求。
- Spec：PASS。原三项关闭；过滤新提交的失效 ID，同时保留原键 payload；文稿重挂恢复；资源两侧预览固定版本文件。

两轴均核对修正代码及 browser.log 6/6。复核只关闭原发现，不替代完整 R34 最终链或 R35 验收。当前未关闭发现数：Standards 0，Spec 0。
