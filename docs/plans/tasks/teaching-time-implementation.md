# Teaching-time 实现短包

T50 已冻结，班级、日程及提醒已有实现。本页保存职责与场景划分，不是当前待办；修复从[教学入口](../../modules/teaching-time.md)进入。任务包固定实际产品版本、相关契约与隔离环境，模型按[当前路由](../execution-protocol.md#模型与固定派发)。

共同必读：[实现协议](../execution-protocol.md#implementation)、[回执](../execution-protocol.md#receipt)；[架构写者表](../../arch/teaching-time.md#并行写者)；[共同协议](../../contracts/teaching-time.md#共同协议)。UI 另读[UX](../../ux/teaching-time.md)和[设计规则](../../rules/design-and-verification.md)。按实际修改使用适用 skill，完成自检后按实现协议做一次 skill 内部双轴 code-review，固定点是派发的完整基线。冻结 schema 不由实现者临时改。

## 公共约束

请求体的 `EntryInput`、`EntryUpdate` 和 `Override` 使用严格的 `Item`、`Time`、`Repeat`、`Course`、`Reminder` schema；`*View` 仍只用于响应并保留加法兼容。目录 v2 使用样本 `catalog-v2` 的四模块完整顺序和 descriptor，T53 必须先校验重复 ID/path、缺依赖和依赖环，固定拒绝预期见 cases TT-C7。提醒候选和通知都使用同一个标题投影：标题去首尾空白后为空则取首项事项，再按 Unicode code point 取前 300 个字符，不追加省略号；固定输入和结果见 cases TT-C4 与对应样本。

## T51 班级与实际反馈

- 目标：先让班级与一句话记录真实可用，再让备课、题目、作品上的反馈双向可回看。
- 输入：T50 独立冻结 + B16 通过；必读故事 TT1/TT2/TT7，UX U1-U3/U8/U11，契约班级章节、Class/Record/Source schema、cases TT-C1/C5/C6，BDD WB-T001-004、017-020；架构公共 Interface 和 T51 写者。
- 工作：classes 前后端/迁移、快速记录与反馈面板、公共班级/记录读取；独占路径见架构。题目端口接 B11 真实实现，尚缺的 lessons.readForTeachingLink 可按本版样本替身做模块自验，最终由 T53 接真实提供方。备课/题目页面只导出需要装配的 classes 组件，不自行改共享页面。
- 完成：两班记录独立、文字/日期/进度及来源可保存恢复；新无效链接拒绝、已有删源不丢文字；没有学生管理与任务状态。反向反馈能用公共端口返回结果，提供浏览器入口验证。
- 作品条件：作品扩展见[已冻结的数学关联契约](../../contracts/teaching-time-math.md)；提供方字段不猜。M44 真实作品到达、WB-T020 通过才能交完整 self PASS。此前允许交固定阶段候选供 T53 先接班级，回执写清未完成作品，不冒称 T51 全部完成。
- 验证：`npm run test:api`、`npm run build`，以及 `npm run test:e2e -- apps/web/e2e/teaching-time-classes.spec.js`。若按同前缀拆文件，回执给出所有准确文件命令。UI 不写单元测试；HTTP证明事务、归属、双向查询，浏览器证明一分钟内可完成一句话录入的路径简短（不设机械耗时门槛）、保存/返回及故障现场。
- 回执：`docs/acceptance/evidence/T51/v1/author.md`，self；固定候选、已覆盖场景、真实/替身区分、M40/M44版本/缺口、共享集成请求、导出/migrations/隔离启动和复现命令。最终交 T53 汇合、T54独立验收。

## T52 日程与单次例外

- 目标：普通记事、未排期和连续日期先可用；一次实现日历计算、单次例外和提醒的可消费投影。
- 输入：T50 独立冻结 + B16 通过即可与 T51 并行；不等待 T51 完整作品。必读 TT3-TT5/TT7、UX U4-U9/U11、契约安排/日期/重复/提醒、Entry/Occurrence/Settings/MoveItem schema、cases TT-C2/C3/C4/C5、BDD WB-T005-013、016-019；架构所有 Interface 和 schedule 所有权。
- 工作：schedule 前后端及迁移、账户时区、周实例/例外、事项原子移动；reminders 与 notifications 子目录留 T53。依本版 classes/lessons port 使用同版替身，提供成功、已删除、跨班、404和源读取失败分支。beforeChange 注入记录顺序的替身，演示在同事务、实际变更前调用，重放不再调用、失败整体回滚。
- 完成：真实指针选段、日期范围不抢 AI、排序/优先级独立、未排期保存、每周/结束日/单次例外、跨午夜/DST/时区计算有精确预期；稳定实例身份、listReminderCandidates 与删除/恢复时 armedAt 可供 T53 使用。提醒字段可保存但通知展示/持久去重属于 T53，不能把自身替身验收写成整阶段 PASS。
- 验证：`npm run test:api`、`npm run build`、`npm run test:e2e -- apps/web/e2e/teaching-time-schedule.spec.js`（拆分则列准确命令），以公开 HTTP检验日期、并发版本、移动原子性/重启。真实指针、触控/键盘替代与两视口证据；不得用合成 DragEvent 代替时间网格实际选段。
- 回执：`docs/acceptance/evidence/T52/v1/author.md`，self；候选、字段/场景、自验适配器版本、精确工厂/port/迁移入口、运行方法与共享装配请求。固定提交并停止写入后可交 T53，班级端口替身只供交接不代替真实关联。

## T53 提醒与真实汇合

- 目标：接 T52 的固定候选实现站内通知和关闭期间补呈现，收齐 T51 后完成课程/实际记录/备课/作品反馈返回链。
- 输入阶段：T52 固定候选 + T50 独立冻结即可先做提醒；最终需要 T51 固定完整候选（含 M40/M44 条件）。若本包升级，外层明确双方消费相同兼容版本，不能混用。必读 UX U8-U11，契约提醒/公共变更，cases TT-C3-C6，全部 BDD，架构工厂/共享写者/必须变更，以及 T51/T52 运行回执。
- 工作：reminders/notifications 子目录和架构列明共享入口；独占集成分支。使用 lessons 公开读取端口与当前六模块目录，保留 TT-C7 的重复 ID/path、缺依赖和依赖环校验，不用初始四模块目录覆盖当前组合；注册顶部 schedule、不重复放侧栏；装配 classes反馈面板，账户时区编辑入口保留在日程，通知沿用顶部。真实beforeChange缺失不得启动生产组合。模块业务缺陷回原写者，契约歧义回 T50；提供方未交接的数学文件不擅改。
- 完成：真实原子捕获旧到期通知、持久唯一性、dismiss痕迹、点击标读和当前定位、过期服务重启、取消/恢复均符合WB-T012-016；最终WB-T001-020在真实集成候选可复现，保留作品缺失不得报整体PASS。README只说明实际能力。
- 验证：`npm run test:api`、`npm run build`、`npm run test:e2e -- apps/web/e2e/teaching-time-integration.spec.js`，以及共享改动影响的 B16 E2E。沿用 B16 同源 HTTPS 与隔离数据入口；在测试进程固定时间、停止API/关闭浏览器、保留库重启；至少一次业务提交后丢响应、一次真正事务回滚。结果必须对应最后集成SHA，不复用模块替身结论。
- 回执：`docs/acceptance/evidence/T53/v1/author.md`，self；T51/T52/设计/作品固定输入、实际共享改动、完整运行入口（启动/reset/保留库重启）、账户方式/端口/数据库、故障步骤、截图/trace和逐场景结果、最终SHA。交外层另派T54；不主动联系其他session，不合main/push。

## T54 独立验收输入

外层提供 T53 固定候选、完整前置回执和隔离运行入口，按[阶段标准](../../acceptance/mvp-matrix.md#t54)逐条复现 teaching-time.feature。作者材料只说明预期；真实选段、双班反馈、作品真实回看、提醒关闭/重启与返回都需独立证据。桌面1440×900、平板768×1024分别核查视觉/焦点/滚动与基本触控；模拟视口不冒充 C20 尚缺的目标实机。真实身份未齐则区分 test-principal 与 real-auth，不补造认证行为。
