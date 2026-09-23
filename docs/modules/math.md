# 数学工坊任务入口

目标：老师能手动制作、修改、保存和再次打开公式、静态图形及动态作品，带回备课或下载离线演示。外部 HTML 导入与自产动态作品是两条不同路径。

## 本次需要的资料

- 范围：[数学工坊](../PRODUCT_SCOPE.md#3-数学工坊)；页面：[工坊](../WORKBENCH_DESIGN.md#5-数学工坊)。
- 数据、版本、渲染与隔离：[数学契约](../contracts/workbench/math.md)，[唯一 OpenAPI](../contracts/workbench/math/math.openapi.json)、[案例](../contracts/workbench/math/cases.md)。
- 技术边界：[数学架构](../arch/math.md)；涉及备课或班级关联才补读任务包指定的跨模块契约。

| 作用 | 入口 |
| --- | --- |
| 编辑、渲染预览、源码、参数与确认 | `apps/web/src/features/math/` |
| 持久化、渲染、导出 | `apps/api/src/modules/math/` |
| 当前手动浏览器流程 | `apps/web/e2e/manual-math.config.mjs` |
| API / 渲染 | `apps/api/test/math-*.test.js` |

完成相关改动时验证真实保存刷新、二次修改、下载与重开。新模板替换非空作品或参数草稿前需明确确认，取消保留原稿。导出要带完整公式/说明，参数范围和步骤文字应随作品恢复。

离线任务必须使用实际下载文件、独立浏览器环境与断网冷启动，不借助已登录页面或 CDN 缓存。个人 Windows 已有具名切片反馈，课堂目标设备仍未整体验证，见[证据索引](../plans/run-inputs.md#模块输入)。
