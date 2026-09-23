# 备课任务入口

目标：老师按自己的教学环节组织内容，引用题目、资源和作品，最后得到可编辑 Word 和可打印 PDF。人工取材、引用更新与六种输出代码已汇入；当前工具运行缺口见[台账](../plans/run-state.md)。

## 相关规格

- 范围：[备课](../PRODUCT_SCOPE.md#2-备课)；页面：[文稿、取材、返回、输出](../WORKBENCH_DESIGN.md#4-备课)。
- 保存与引用：[共享契约](../contracts/workbench.md#引用更新与删除)。
- 材料顺序、采用更新、导出：[材料契约](../contracts/workbench/materials.md#引用和输出)。
- 仅涉及数学往返时补读[数学契约](../contracts/workbench/math.md)；仅涉及班级反馈时补读[教学接缝](../contracts/materials-teaching-alignment.md)。

## 代码与验证

| 作用 | 入口 |
| --- | --- |
| 编辑、取材、对照与输出 UI | `apps/web/src/features/lessons/` |
| 内容、引用、输出服务 | `apps/api/src/modules/lessons/` |
| Word 转换 | `apps/api/src/modules/lessons/pandoc.js` |
| 手动真实流程 | `apps/web/e2e/manual-lessons.config.mjs` |
| 输出/内容 HTTP | `apps/api/test/materials-lessons.test.js`、`materials-pandoc.test.js` |

相关改动应能完成“组织环节 → 取材 → 保存刷新 → 返回源材料 / 对照更新”。输出改动需真正下载并打开对应文件，核对学生/教师内容、答案与注记、公式和分页；只看下载按钮不够。嵌套预览关闭一次只退一层，并恢复焦点。

## 运行条件

Word/PDF 与 Office 预览依赖外部工具。使用[运行指南](../SETUP.md#文件转换工具)中的环境变量，不引用被删旧 worktree。目标 Word/WPS 实测暂缓；本地通过不代签目标软件编辑能力。
