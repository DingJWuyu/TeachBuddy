# 认证前后端实现任务包

共同输入为 `AUTH-CONTRACT@1` 外层独立冻结的候选 commit + 回执，不能以分支“最新”代替固定版本。作者回执见 [AUTH-CONTRACT/v1](../../acceptance/evidence/AUTH-CONTRACT/v1/author.md)。本页提供认证支线的前后端工作包，不新增 DAG 节点；根负责指定实际任务标识、worktree、端口、隔离数据目录和唯一集成者。

前后端基于同版契约可并行。默认代码实现调用 dsh headless，额度不足才 Luna max；失败接手、必要review和回执按 [implementation](../execution-protocol.md#implementation)、[receipt](../execution-protocol.md#receipt)及根模型路由。只在任务分支提交，合main/push/外部写入仍由根单独授权。必读材料中的链接可直接进入本包范围，不要求通读DAG。

## 后端包

- 目标：教师真实账户、两类邮件挑战、Cookie会话、恢复/退出以及可靠失败结果符合契约，工作台可从固定seam获得principal。
- 必读：[auth.md](../../contracts/auth.md)、[OpenAPI](../../contracts/auth.openapi.yaml)、[cases](../../contracts/auth-cases.md)、[架构](../../arch/auth-implementation.md)的接缝/事务/写者/外部缺口、[BDD](../../acceptance/auth.feature)。读取固定基线的旧账户schema仅用于兼容迁移，不从旧Bearer API推导新行为。
- 写入：`apps/api/src/features/auth/`、`apps/api/test/auth-contract*.test.js`、`apps/api/test/fixtures/auth-contract/`及根指定自身证据目录。以模块导出交付router/resolvePrincipal/migrations，不编辑app、配置、存储runner、package/lock等共享文件。需要依赖、环境变量或挂载时在回执列具体片段交集成者。
- 完成：独立真Express HTTP + 隔离SQLite运行全部适用CC及BDD；先使用fake-mail和可控时钟，验证真实事务回滚、提交后丢响应、并发消费、重启、撤销与来源拒绝；同源HTTPS浏览器核验Cookie固定属性。提供空库和旧库fixture的保留验证，不能有生产测试身份/固定码后门。密码、验证码、Cookie不入报告。真实邮件条件缺失单列，不阻塞上述实现。
- 回执：固定候选、实际运行命令、模块挂载/依赖清单、迁移结果、CC逐项结果、真实vs替身边界、外部缺口。完成实现自检后按项目要求code-review，自身聚合，不另派顶层session。

## 前端包

- 目标：迁入已验收登录/注册/找回与S36-S47，用真实HTTP形状实现快照、迟到结果、会话激活/恢复/保存失败；为A11导出门禁、请求transport和退出动作。
- 必读：上述三份契约、[UX](../../ux/auth-integration.md)、[架构接缝与写者](../../arch/auth-implementation.md)、[BDD](../../acceptance/auth.feature)、[账户行为G01-G06及Experience rules](../../../prototype/behavior/auth.md)、[设计规则](../../rules/design-and-verification.md)。现有原型只读参考，正式代码不依赖prototype。
- 写入：`apps/web/src/features/auth/`、`apps/web/e2e/auth-contract*.spec.js`、`apps/web/e2e/fixtures/auth-contract/`及根指定自身证据目录。目录内可建独立挂载fixture；不改App/main/api client/store/settings/侧栏/global.css/配置/lock。提供AuthProvider/AuthGate/useAuth导出；设置按钮实际接入归A11。
- 完成：OpenAPI同版HTTP替身覆盖全部CA映射和适用CC/BDD，特别是本地错误零业务请求、未知注册/重置、pending继续/重试/离开、真实页面刷新和迟到身份；三视口截图与真实键盘/触摸/指针证据，检查明显溢出/布局错误。UI不写单元测试。模块独立生产构建验证；收齐后端后由集成者补真实联调，替身通过不当成正式认证通过。
- 回执：固定候选、独立运行与构建命令、三端证据、请求样本去敏索引、共享入口/依赖接线清单、未验证真实条件。按项目要求完成code-review并聚合。

## 集成者与 A10

根在当前共享写者交付后给集成者固定B12/B14/认证前后端版本。集成者独占装配入口、依赖、迁移、HTTPS、真实配置及旧入口退役，并按真实状态同步README；不得从其他worktree未提交实现猜测安装方式。认证内部缺陷退回认证实现者，B11接缝冲突退回设计者，不临时加body身份字段。

A10预读可从[架构交接表](../../arch/auth-implementation.md#a10-可消费清单与外部缺口)开始；正式交接核验仍需要固定实现、真实邮件/会话/恢复证据。A11消费审查后的固定输入接principal、transport、账号行、设置退出和工作台门禁；A12独立验证真实账户、刷新/重登、跨设备与隔离。fake-mail、test-principal及手工Cookie不能替代最终真实验收。
