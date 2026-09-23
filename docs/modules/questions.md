# 题库任务入口

目标：老师能录入、查找、改编和复用题目，保留原稿、笔记、题型和标签。当前人工路径已在体验分支；任意扫描图像自动提取不属于已完成能力。

## 只读与任务相关的规格

- 范围：[题库](../PRODUCT_SCOPE.md#1-题库)；页面：[浏览、收录、编辑与用于备课](../WORKBENCH_DESIGN.md#3-题库)。
- 基础 CRUD / 保存：[共享契约](../contracts/workbench.md)、[基础案例](../contracts/workbench/first-flow-cases.md)。
- 材料、公式、定位、提取与分类：[材料契约](../contracts/workbench/materials.md#自动收题与分类)及其 OpenAPI；处理文件时再读该页“文件与定位”。
- UI 工作再读[界面规则](../rules/design-and-verification.md)，不用加载完整 DAG。

## 代码与验证

| 作用 | 入口 |
| --- | --- |
| 页面与材料收录 | `apps/web/src/features/questions/` |
| 题目、材料、提取、分类服务 | `apps/api/src/modules/questions/` |
| 原文件/转换公共能力 | `apps/api/src/workbench/files/` |
| 手动真实浏览器流程 | `apps/web/e2e/manual-questions.config.mjs` |
| HTTP 与提取回归 | `apps/api/test/first-flow-questions.test.js`、`materials-questions*.test.js` |

本次任务完成条件只覆盖相关路径：录入/编辑/改编后保存刷新，原题联系与笔记保持；取入备课需检查实际引用与返回。公共保存、版本冲突及原稿保留不能被 UI 改动破坏。相关证据从[当前索引](../plans/run-inputs.md#模块输入)读取。

## 自动提取边界

手动校对或固定样本成功不证明任意图片/PDF 自动拆题。旧在线调用窗口已关闭；本地 OCR 权重方案还缺用户许可。遇到这类任务再读[复用调研](../research/c21-open-source-reuse.md)与[固定方案引用](../plans/run-inputs.md#c21)，不要让普通题库 UI 任务背上整个 C21 实验。
