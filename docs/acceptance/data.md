# 数据管理与恢复验收

核验[数据行为](../features/data.md)与[恢复契约](../contracts/data.md)时读本页。按本次影响选择场景，结果/授权见[运行台账](../plans/run-state.md)，执行分工见[CI 分工](../agents/github-workflow.md#ci-与本地验证)。行为保证或验证入口改变时同步，不以脚本存在宣布已通过。

HTTP 使用 `apps/api/test/reliability.test.js`，可见设置使用 `apps/web/e2e/settings-shell.config.mjs`。`apps/web/e2e/manual-data/manual-data.config.mjs` 验证资料包实际下载和离线阅读、停服备份与恢复、身份撤销，以及恢复后设备草稿与上传请求隔离；`apps/web/e2e/manual-support/playwright.config.mjs` 验证跨模块草稿、双标签页、版本冲突与未确认请求。两套均自行创建隔离数据，不读取已有实例。

恢复在隔离数据上验证原件/源码/关系、旧 Cookie 失效、恢复点变化后旧请求不重放、失败保留原库。服务重启不等于部署备份恢复，导出成功不等于真正恢复成功。当前能力边界和目标环境空缺见[项目状态](../plans/run-state.md)。

当前设置不提供设备草稿查看、下载、清理或恢复隔离管理入口；历史专项中相关 UI 断言须按现行规格核对，不恢复已明确移除的界面，也不以隐藏组件存在关闭恢复保护要求。Agent v2 恢复核实/放弃动作待其工作线接入，验收时分别记录底座行为、页面接入和真实模型边界。
