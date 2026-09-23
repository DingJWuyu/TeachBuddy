# 个人数据、备份与恢复任务入口

三种能力分开处理：老师下载可阅读个人资料；最近删除恢复对象；维护者停服后备份/还原整个实例。个人 ZIP 不是可以直接覆盖账户的备份。

## 代码与约定

- API：`apps/api/src/workbench/reliability/`，偏好在 `apps/api/src/reliability/preferences.js`。
- Web：`apps/web/src/features/reliability/`；当前可见设置入口由[设置边界](shell.md#设置边界)决定。
- 维护 CLI：`node apps/api/src/scripts/reliability.js --help`。实际 backup / restore / activate 前先确认维护范围、停服与独占目录，保留原数据库、文件和配置。
- 身份恢复内部操作：`apps/api/src/features/auth/recovery.js`；外层调用既有操作，不能自行拼认证表清理 SQL。
- 精确完整设计仍在固定 Git 对象：`31575c5c9d386c03a1f9fcde38b9a216f87a5b08:docs/contracts/reliability.md`。只在本次涉及数据格式时读 B/C/D/E 手动部分，不把该文件的 Agent 全工具计划一起实施。

## 当前证明与缺口

[DATA 独立报告](../acceptance/evidence/MANUAL-DATA/v1/independent.md)证明具名本地导出、恢复及身份撤销路径；[SUPPORT 恢复复验](../acceptance/evidence/MANUAL-SUPPORT/v1/recovery-independent.md)证明具名新旧上传归档取回与不重放。它们不证明当前设置仍展示旧恢复 UI，也不证明正式部署恢复已完成。

修改后需核对文件/源码/引用可读、旧 Cookie 失效、恢复点隔离、旧请求不自动重放，以及失败时原数据仍可保留。真实恢复会改变数据状态，独立验证使用自己的库和文件目录。

## 验证入口

`apps/api/test/reliability.test.js` 与 `apps/web/e2e/manual-data/manual-data.config.mjs`。后者部分用例依赖旧设置 UI，先按当前任务核对选择；当前设置导出/恢复使用 `apps/web/e2e/settings-shell.config.mjs`。

运行环境的转换工具问题另见[台账](../plans/run-state.md)，不通过改业务数据来绕过。
