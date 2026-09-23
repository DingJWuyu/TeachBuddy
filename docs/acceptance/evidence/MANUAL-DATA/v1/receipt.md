# MANUAL-DATA@1 / attempt 1

状态：本分支所属手动能力实现并自验通过，可集成；跨分支组合验收仍由集成者执行。

- 实现者：Codex / gpt-6-astra / low；self 验证，非独立验收。
- 分支：`feat/manual-data`。
- 固定起点：`4db937daa4d5abd0a03f69917528665f94ebb001`。
- 产品提交：`9db27eb8c563d7094f79023c98a32fdc18dfccde`。
- 契约依据：`31575c5c9d386c03a1f9fcde38b9a216f87a5b08` 的 reliability 手动部分。认证恢复文件原样取自 `627bf878d9b2ec57e8bc88a227337744c697a9ce`，未混入其历史分支。

## 可用结果

设置页提供个人整体 ZIP 导出、状态与下载。包内包含活动及软删业务资料、版本快照、关系、登记附件、可离线打开的 HTML 和 JSON；排除认证秘密与 raw Agent runtime。导出异步流式发布，失败不会提供半成品，丢失响应后刷新以原幂等键重试。

最近删除覆盖题目、备课、资源、数学作品、班级、教学记录、日程、收录草稿，调用各模块原恢复接口并保留关联。班级需要先于所属已删除教学记录恢复。

维护 CLI 提供 backup、restore、activate、unlock。备份读取 SQLite 已提交 WAL 和原文件，校验数据库/迁移/引用/文件长度与哈希；恢复只写新隔离目录，经二次打开和认证清理后显式激活。旧 Cookie 失效，备份内密码可登录，普通重启保留新会话。未激活、损坏或未知迁移备份拒绝启用。原库与备份不改写。

恢复生成新 recoveryId，工作台挂载编辑器前隔离旧设备草稿、待提交请求和 IndexedDB 上传文件，可在设置中查看和下载原内容。旧 Agent 对话原字节保留，未确认操作冻结并拒绝旧意图重放。

## 实际检查

全部使用本树临时目录、隔离数据库/文件、随机测试端口及 fake-mail，没有操作 50880、用户数据库或真实邮件。Node 22.23.2。

- [定向 API 组合](targeted-api.log)：18/18 通过，含 reliability、auth-integration、first-flow-questions。
- [最终 reliability 检查](reliability-final.log)：4/4 通过，包含真实 CLI 调用、已提交 WAL 备份且源 DB/WAL 哈希不变、八类恢复、软删资料导出、跨账户拒绝、缺文件失败、损坏与未知迁移拒绝、恢复前后业务行及原对话字节比较。
- [浏览器 E2E](browser.log)：1/1 通过。真实注册、创建/编辑/保存题目、删除恢复、刷新、导出响应丢失后的原键重试、ZIP 下载、解压后 file:// 离线阅读、同源服务备份恢复后重新登录、原草稿下载、原上传文件下载字节校验。
- [API 构建](build-api.log)、[Web 生产构建](build-web.log)通过；Web 有现有大 chunk 提示，无构建错误。`git diff --check` 通过。
- 页面截图：[数据管理](data-settings.png)、[恢复后登录与资料](restored-login.png)。

复跑：`node --test apps/api/test/reliability.test.js apps/api/test/auth-integration.test.js apps/api/test/first-flow-questions.test.js`；浏览器用 `npx playwright test --config apps/web/e2e/manual-data/manual-data.config.mjs`，需先构建 Web，并将 TMPDIR 指向本树隔离目录。维护参数见 `node apps/api/src/scripts/reliability.js --help` 和 README。

## 必要公共接线

- API app/workbench 装配 reliability 路由、冻结操作守卫及数据库/文件维护锁；server 正常退出关闭 SQLite 并释放锁。
- Web WorkbenchRoot 在加载编辑器前核对 recoveryId；WorkbenchApp 显示恢复提示；WorkbenchSettings 加数据管理并保留待提交设备输入；apiClient 的 blob 超时参数供大导出下载使用。
- auth 测试 harness 支持指定端口，以验证同源恢复登录；API 显式声明既有传递依赖 jszip。
- README 记录本机可用能力和维护/回退步骤。AGENTS.md 用户修改保留且未提交。

## 尚欠与边界

- SUPPORT 偏好服务不属本任务实现。导出已预留 `reliability_preferences` 读取；集成者须核对其最终表结构，并把其新增迁移接入备份支持集合，执行组合导出/恢复验证。
- 其他并行业务分支若新增迁移，也须接入 `apps/api/src/workbench/reliability/backup.js` 的 supported 集合；当前未知迁移会明确拒绝，不能直接宣称全分支备份可用。
- Agent/runtime 开发暂停。F61 专用未确认操作核实/放弃界面未实现；这里只保留原数据并阻止旧操作重放，手动数据能力不依赖该界面。
- 整体恢复通过停服 CLI 执行；个人 ZIP 用于取回资料，不是部署备份，也不提供在线覆盖账户导入。
- 用户服务部署、目标物理环境验证及跨分支整体体验尚未执行；未 push、未合并 main。
