# RESTORE-SHELL@1 / attempt 2

- status: PASS，限本次明确的原型 UI 恢复范围及下述自验覆盖。
- base_revision: 975fa14e7603c9b7ec7051b2f25286c832b04822
- runner: Codex gpt-6-astra / low，self verification
- scope: 原型前端外壳恢复；固定起点后的增量，不含部署。
- skills: diagnosing-bugs、writing-for-agents。

## 实现

顶部反馈、教程进度、首访气泡、完成动画、隐私和通知采用原型弹层，不再跳转冒充。通知使用真实提醒 API、原幂等提交和身份保护，点击定位日程，已读通知可拖到垃圾桶。反馈输入和记录保存在当前账户设备现场，不声称已发送给服务端。

修正顶部关闭监听误关学期弹层、窄屏遮罩挡住导航、首页输入前后宽度及间距；首页返回工作使用上次业务地址。语言选择、教程进度、学期详情和复制选项复用 useScene。侧栏底部 AI 入口排除，模块右侧 AI 与 Agent runtime 保持现状。

## 验证

`npm run build:web`、`node apps/web/e2e/restore-shell/remaining.mjs`、`node apps/web/e2e/restore-shell/verify.mjs`，结果见同目录 attempt2 日志。

真实 HTTPS 隔离账户，Chromium 对照本树原型及用户图二。覆盖反馈表单与重开输入、教程进度刷新恢复、隐私、真实通知定位与已读拖放删除、创建学期与刷新、模块拖放隐藏与恢复、五模块和日程/支持导航、390px 抽屉与弹层、首页输入切模块保留、登录刷新退出。截图等待有限动画结束后采集。`home.png` 为固定起点首页，`attempt2-*.png` 为本轮对照与结果。检查模块可见独立滚动容器，并对日程网格执行真实滚轮，外层不跟随滚动；不将空账户检查扩大为所有业务长文档验收。

## 覆盖边界

学期是设备现场元数据及原表单交互，复制选项不复制业务数据；语言选择不包含新翻译引擎。旧 `/api/workspace/layout` 已退役，当前产品对该接口返回 404（已有 api.test.js 明确约束），没有可复用的当前账户读取接缝，分组/隐藏/排序仍按账户在设备保存，不声称跨设备迁移。

恢复隔离、编辑存储及真实账户交接路径未改。认证候选由维护者另行组合。未改 features/auth、后端、preview、用户数据配置；AGENTS.md 的既有改动不提交。没有其他 session 联系、main 合并或 push。
