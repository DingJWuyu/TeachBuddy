# 班级教学、日程与提醒任务入口

目标：把计划授课与实际反馈分开，记录两班不同进度；安排事项、处理重复例外，关闭页面期间到期的提醒重新进入后仍可查看。

## 按任务分支阅读

| 任务 | 规格 |
| --- | --- |
| 班级、教学记录、反馈 | [范围](../PRODUCT_SCOPE.md#5-班级教学)、[页面](../WORKBENCH_DESIGN.md#7-班级教学)、[班级契约](../contracts/teaching-time.md#班级实际记录与回看) |
| 日期范围、安排、事项、优先级 | [范围](../PRODUCT_SCOPE.md#6-日程)、[页面](../WORKBENCH_DESIGN.md#2-日程)、[安排契约](../contracts/teaching-time.md#安排事项与排序) |
| 周重复、单次变更、提醒 | [重复](../contracts/teaching-time.md#重复和单次例外)、[提醒](../contracts/teaching-time.md#提醒修改与重启) |
| 题目、作品、备课关联 | [材料教学接缝](../contracts/materials-teaching-alignment.md)、[数学扩展](../contracts/teaching-time-math.md) |

精确字段从 [teaching-time OpenAPI](../contracts/teaching-time/teaching-time.openapi.yaml)读取，只展开实际操作的 schema。

代码：Web `apps/web/src/features/classes/` 与 `schedule/`；API `apps/api/src/modules/classes/` 与 `schedule/`；组合 `apps/api/src/workbench/teachingTime.js`。

当前手动浏览器入口：`apps/web/e2e/manual-teaching.config.mjs`；组合入口：`apps/web/e2e/teaching-time-auth.config.mjs`。API 测试按 `apps/api/test/teaching-time-*.test.js` 对应领域选择。

相关验收检查真实记录保存与回看、两班隔离、安排修改不篡改实际反馈、单次例外不误改整组、提醒点击能返回对象。时区/日期边界依契约，优先级与段内顺序是不同字段。共享顶栏、通知和备课接缝由唯一写者协调。
