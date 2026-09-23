# MANUAL-SUPPORT@1 / attempt 1

状态：可集成增量 / 作者自验通过，**全范围尚未完成**。实现者 Codex / gpt-6-astra / low。分支 `feat/manual-support`，固定起点 `4db937daa4d5abd0a03f69917528665f94ebb001`。未合并 main，未 push、部署或调用外部 AI。

## 提交

按顺序消费本任务提交，不导入其他历史分支：

1. `f5ca645dee5ac59624866c3c3682857405eb8fac` - 偏好服务、支持页面、设备分支与数学预览现场。
2. `58d6faf16f8d9abf3288f8d34db1833cef205c4d` - 手动模块现场、原请求确认、文件重选、草稿恢复选择。
3. `496649b1015c58b45b2c74e7050c67aab44bf5c8` - 前台重新读取、保留本地修改、受影响验证证据。

## 可操作结果

- 设置保存账户字号与减少动效，真实认证下可退出、重登、跨浏览器读回，偏好有版本冲突及原键确认。外部 AI 设置不开放，已有字段保留。
- 帮助与版本页使用独立布局。正式发布记录为空时如实显示；Git 构建信息和提交记录另列。正式记录入口为 `apps/web/src/features/workbench/releases.json`，不改 `CHANGELOG.md`。
- 账户分区中的标签页草稿独立；刷新、模块返回、关闭标签后选择旧稿可用。设置能查看、下载和清理设备记录；损坏资料与待确认操作保留，删除失败不显示成功，其他标签页收到清理通知后重置现场。
- 补齐题库原稿选择/滚动、收录输入和原文件确认；班级创建/改名、记录关联选择；日程编辑草稿、关闭后恢复、原键重试、保存中后续输入和版本基线；数学预览参数、工具展开、画布与导出选择。预览参数不改作品 Source。
- 资源、数学、题库上传的原请求按分支保存；刷新后重选同名、同长度且 SHA-256 相同的文件才能确认。资源与数学旧上传记录无损迁移。题库测试在整理入口停止，没有启动模型。
- 前台返回会重新读取偏好、备课、题库、资源、数学、班级及日程的相关内容；已有本地修改保留，不能因重新读取而升级草稿的保存基线。

## 实测

测试仅使用本树 `.tmp-ms` 中的隔离数据库/文件、随机 HTTPS 端口、真实注册登录和本地 fake-mail。没有操作 50880 或用户数据库/密钥。

| 检查 | 结果 / 证据 |
| --- | --- |
| 手动支持真实浏览器场景 | 18/18，[日志](artifacts/browser-checks.log) |
| 备课取材与迟到响应既有回归 | 5/5，[日志](artifacts/picker-checks.log) |
| 最后前台刷新/班级现场改动 | 2/2，[日志](artifacts/foreground-checks.log) |
| 1440/820 支持页面布局 | 1/1，[日志](artifacts/layout-checks.log)，[截图](browser/) |
| Web 构建 | PASS，[日志](artifacts/build-web.log)；现有大包提示仍在 |
| API 构建 | PASS，隔离初始化包含 preferences 迁移 |
| 数学动态作品真实 API、HTML 导出、两次服务重启 | PASS，[实际结果](artifacts/math-dynamic-api.json) |

浏览器主命令：`TMPDIR="$PWD/.tmp-ms" npx playwright test -c apps/web/e2e/manual-support/playwright.config.mjs`。前台事件用真实页面及服务验证；无头浏览器的标签切换不稳定地产生 focus，专项测试显式派发标准 focus 事件。

## 必要公共接线与尚欠

- API 公共改动：`apps/api/src/app.js` 挂载 `/api/reliability/v1`；`workbench/index.js` 注册 `reliability-preferences` / `reliability_preferences_001`。DATA 汇总迁移/备份清单时必须包含该表和迁移，不重复注册。认证恢复仍归 DATA 消费固定 `prepareRestoredAuth`，本任务未混入其历史分支。
- Web 公共改动：shell/routes、storage、useScene、useSavableDocument、useIdempotentSubmit、useScrollRestore、useForegroundRefresh、上传 IndexedDB seam 与基础 CSS；数学 shared `presentation.js` 增加可选预览状态读写，离线默认行为保留。
- **恢复点隔离未完成**：本树尚无 `/api/reliability/v1/context`。设备记录没有绑定 DATA 的 `recoveryId`，从旧部署备份恢复后禁止旧请求重放、读取新基线后用新键提交的流程尚未接通，不能宣称恢复验收通过。
- **冻结格式尚未完整实现**：现有分支包装不是冻结 `DraftEnvelope` / `Scene` 的完整序列化实现；尚欠 `sourceContract`、恢复前 body/schema 版本验证和逐字段迁移。题库/资源/数学已限制可重放的方法及路径，仍以服务器业务校验为准。
- **历史待确认分支的最终清理尚欠**：已在新分支确认的请求，其旧分支快照可能仍按待确认保留；设置可查看/下载/选择恢复，尚无跨分支确认账本来证明这些历史记录可以一起清除。
- 逐模块滚动沿现有 ID/像素记录扩展，没有完成冻结 Scene 全字段、全部稳定锚点、跨布局尺寸变化的穷举验收。正式发布记录生产由实际发布流程提供；个人全量导出/备份核心及其设置入口归 DATA，当前草稿 JSON 下载不能替代个人数据包。

AGENTS.md 保持用户注入的修改且未提交。由于上述范围未完成，`.tmp-ms` 的隔离现场与生成产物保留，供后续接续；产品提交不含临时目录。产品 Agent/runtime/tools/skills/plugin/connector 功能和原数据保持原状，本轮没有继续开发这些线路。
