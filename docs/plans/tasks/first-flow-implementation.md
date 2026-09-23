# B12-B15 首条流程任务包

首条流程已在体验分支，固定证据见[输入索引](../run-inputs.md)。本页是 B12-B15 的职责和验收参考，不授权重做已实现功能；新任务指定实际基线、范围及权限。[公共写者表](../../arch/first-flow.md#并行写入与集成)是唯一所有权来源。下列任务实现方法自主决定，模型、困难升级和内部 code review 按[执行协议](../execution-protocol.md#模型与固定派发)。

版本选择：上述放行只适用于旧冻结契约及运行任务输入 `b938f8af0b8152718f5063d4326d494bf8b5426c`。当前工作区的工作台 `0.1.0-candidate.2` 与认证 `1.0.0-rc.2` 已由限定独立审查冻结，不能无声替换活动任务输入。B12-B16 继续旧测试身份首流或切换新版时，按[消费版本与验收范围](../../contracts/workbench.md#消费版本与验收范围)固定 SHA 和证据级别；旧路径仍保留 B11/v1 与 `test-principal` 边界。真实认证接线归[认证任务包的 A10/A11 条件](auth-implementation.md#集成者与-a10)，本包不接管认证实现。

## B12 公共底座与反馈

- 目标：交付可被模块使用的可信身份 seam、共享 schema 消费、静态模块目录、原子幂等/迁移设施及真实 HTTPS 隔离运行入口。
- 必读：[implementation](../execution-protocol.md#implementation)、[ownership](../execution-protocol.md#ownership)、[receipt](../execution-protocol.md#receipt)；[架构](../../arch/first-flow.md)的模块与接缝、持久化与演进、并行写入、反馈设施；[契约](../../contracts/workbench.md)的身份与 HTTP、写入协议；同版 OpenAPI 和 cases 的公共错误/身份/重试部分。认证仅复用已确认 HTTP 定义，其他部分只读。
- 工作边界：公共目录及共享文件见写者表，可在该范围创建必要文件。冻结文档只读。每个 worker 独立数据库/端口，构建不可动用户库。
- 完成：WB-012、016、018、019 中公共责任可复现，空库/旧库升级、失败启动非零退出、同源 HTTPS、双账户隔离、保留库重启及日志索引实际运行。模块实现未齐时可用测试 fixture 证明 seam，但明确与业务集成的区别。
- 验证：运行适用 `npm run test:api`、`npm run build`；交付一条首流启动命令、reset 和保留数据重启命令、独立测试账户取得方式及生产拒绝测试模式证据。命令应在其候选代码上执行，并记录退出码和隔离路径。修改已有共用 runner 要跑其受影响 E2E。
- 回执：`docs/acceptance/evidence/B12/v1/author.md`，`verification_level: self`，包含供 B13/B14/B15 消费的运行入口与共享 seam 的实际文件；由 B16 独立流程验收。

## B13 题库与备课后端

- 目标：把创建、粘贴原稿、编辑、复制、笔记/标记、搜索、环节与引用、更新/删除恢复真正落库。
- 必读：执行协议 [implementation](../execution-protocol.md#implementation)、[receipt](../execution-protocol.md#receipt)；[工作台契约](../../contracts/workbench.md)、[OpenAPI](../../contracts/workbench/first-flow.openapi.yaml)、[cases](../../contracts/workbench/first-flow-cases.md)；架构的模块接缝/持久化/写者；[BDD](../../acceptance/first-flow.feature) 中 API 相关场景。
- 工作边界：questions、lessons 模块、模块迁移与 API 测试；公共文件交 B12，最后装配交 B15。初始可对固定 seam 使用测试 adapter，最终提供接入 B12 的真实 HTTP 自验。请求和返回字段以唯一 schema 为准，不导入其他模块仓储。
- 完成：WB-001 至 009、012、013、014、016、018 的数据侧预期通过；事务提交与幂等同生共死，另一账户来源/引用和已删除源不能绕过规则；API 重启后同 ID、版本、来源、快照和引用仍在。
- 验证：`npm run test:api` 加本模块真实 HTTP 集成场景，`npm run build` 使用 B12 隔离库。UI 不在本节点验收范围。返回直接可复现请求、状态/错误例、前置数据与预期；B14 能从相同样本建立替身。
- 回执：`docs/acceptance/evidence/B13/v1/author.md`，self，列候选 SHA、实际导出/migration 入口、确需公共写者装配的清单、命令与结果；B15 集成，B16 独立验收。

## B14 前端与外壳

- 目标：真实可编辑题目/公式、复制对照、备课环节和取题返回，刷新后继续草稿与现场；不误报保存成功。
- 必读：执行协议 [implementation](../execution-protocol.md#implementation)、[receipt](../execution-protocol.md#receipt)；[故事](../../user-stories/first-flow.md)、[UX](../../ux/first-flow.md)、[设计规则](../../rules/design-and-verification.md)；[契约](../../contracts/workbench.md)、OpenAPI/cases；架构的写者/反馈；BDD 的 UI 场景。原型仅需对应题库、备课与共享外壳参考。
- 工作边界：Web 模块与指定外壳共享文件、独占 UI E2E；认证表单/行为只读。沿用既有侧顶栏美学；设置不加入自定义退出契约，Agent 不用固定回复充数。需依赖包时交根记录并由共享写者集成锁文件。
- 完成：WB-001 至 017 中 UI 预期及桌面/平板布局。普通浏览保持 AI；辅助栏共用；本地存储失败、未知保存结果、冲突、删除和返回均有可恢复现场。生产构建可用，不写 UI 单元测试。
- 验证：`npm run build`、`npm run test:e2e -- apps/web/e2e/first-flow-ui.spec.js`（若拆成多个同前缀文件，回执列准确命令），使用同版契约替身覆盖边缘状态；提交截图/真实事件/几何检查。最终真服务条件由 B15/B16验证，替身通过只标 self。
- 回执：`docs/acceptance/evidence/B14/v1/author.md`，self，列替身/真服务各自结果、U0-U7 与失败状态证据、候选 SHA、共用文件需求及未完成能力。

## B15 集成与真故障

- 目标：集成固定 B12-B14 候选，证明教师从录题到改编、环节取题、返回、刷新/API 重启仍能继续，并证明反馈能抓住假保存。
- 必读：执行协议 [implementation](../execution-protocol.md#implementation)、[integration](../execution-protocol.md#integration)、[receipt](../execution-protocol.md#receipt)；B12-B14 固定回执和运行入口；本包 UX、契约、[cases](../../contracts/workbench/first-flow-cases.md)、[BDD](../../acceptance/first-flow.feature)；[B16 标准](../../acceptance/mvp-matrix.md#b16)、设计规则。
- 工作边界：独占 first-flow E2E、故障 fixture/证据；收齐并冻结前置写入后接手架构表中共享装配文件和 README 当前状态。模块内部缺陷交对应节点修复，契约缺口回 B11。主干合并/push 由根掌握。
- 完成：全部 WB-001 至 019 在实际候选可复现；正常链路通过后，实际停止 API、至少一次提交后响应丢失及一次真实写失败，证明未确认反馈、草稿保留和同键重试不增重复对象/引用；撤故障后完整重跑。
- 验证：`npm run test:api`、`npm run build`、`npm run test:e2e -- apps/web/e2e/first-flow.spec.js` 以及集成影响的既有 E2E；用 B12 同源 HTTPS、test-principal、独立 SQLite/目录运行。截图与录制覆盖 1440×900 和 768×1024。通过/故障证据分存，保留库重启不 reset，随后新上下文读取。
- 回执：`docs/acceptance/evidence/B15/v1/author.md`，self；独立运行说明、精确命令、账户代号、数据库/端口路径、故障开关、失败证据/通过证据、最终 SHA、README 现状与局限。交根另派 B16；测试身份结果不代替 A12。
