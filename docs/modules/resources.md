# 资源库任务入口

目标：真实保存和整理教学文件，预览内容，替换原文件而保留既有引用联系。

- 范围：[资源库](../PRODUCT_SCOPE.md#4-资源库)；页面：[分类、预览、更新与复用](../WORKBENCH_DESIGN.md#6-资源库)。
- 精确约定：[材料契约的文件与定位](../contracts/workbench/materials.md#文件与定位)，以及其中引用和输出章节；接口字段由该页 OpenAPI 拥有。

| 作用 | 入口 |
| --- | --- |
| 资源 UI、分类、预览与加入备课 | `apps/web/src/features/resources/` |
| 资源业务与分类 | `apps/api/src/modules/resources/` |
| 文件持久化、转换与任务 | `apps/api/src/workbench/files/`、`apps/api/src/workbench/jobs/` |
| 手动浏览器路径 | `apps/web/e2e/manual-resources.config.mjs` |
| HTTP | `apps/api/test/materials-resources.test.js` |

相关任务核对上传、保存刷新、分类/检索、真实预览与下载。替换文件后资源身份保持，已有备课不被静默覆盖，老师可查看并采用更新。上传结果未知时保留原请求与文件，不用重复创建来伪装成功。

当前转换依赖失效会影响部分预览，见[台账](../plans/run-state.md)；文件列表可见不证明 Office 转换可用。目标设备暂缓；实际验证入口和证据等级见[验证指南](../acceptance/README.md)。
