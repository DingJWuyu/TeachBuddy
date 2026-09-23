# C26 / C27 早期 Agent 任务包

产品 Agent 开发暂停，本页保留早期节点职责，不是执行授权。恢复时从[Agent 入口](../../modules/agent.md)核对当前组合、冻结设计与调用权限，不直接运行下面的旧批次。

本文件是 C25/v1 候选的一部分。输入版本取 [C25 correction](../../acceptance/evidence/C25/v1/correction.md) 的完整 result_revision，加外层独立冻结回执；作者 self 不能启动已要求冻结的实施。节点依赖归既有 DAG，本文不派 session 或追加节点。旧工作树 dsh/模型路由失效，读取派发时的 [执行协议](../execution-protocol.md) 对应角色段；当前用户固定路由见下文。

## C26 实现

- 模型/harness：Codex CLI `gpt-6-astra` / `low`，内部 skill 助手继承本 session；使用本次派发的新任务分支，不能直接在 main 开发。
- 固定输入：独立冻结后的 C25 完整 SHA；B16 产品 `612f0a9868743a1d5eea7e6f236d3ff903752439` 与独立证据 `d1ef0d5af8478677c04e6dd42bd3346f7883d1d0`；认证源 `6f3003250d170b44e89f6ac9b0a74f91d658a357`、独立冻结 `63bfe8f7900b4a2bb7fc9ab5a4145f1c89a6f73b`；认证产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf`，本地 independent PASS 见 `aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md`；real-api/fake-mail，真实邮件/目标设备仍未通过，不是 A12 整体 PASS。外层若提供后续认证候选，必须固定差异和证据，不读浮动分支作为替换。
- 必读：[设计产物入口](../../user-stories/agent.md)、[UX](../../ux/agent.md)、[契约语义](../../contracts/agent.md)、[唯一 OpenAPI](../../contracts/agent.openapi.json)、[交换样本](../../contracts/agent-examples.json)、[架构](../../arch/agent.md)、[BDD](../../acceptance/agent.feature)，协议 `#implementation`/`#ownership`/`#receipt`。仅做样式时补读设计规则；认证接线补读固定 auth.md 与 A11 回执；实验争议才进入架构索引所列固定轨迹。
- 目标：真实 pi 首页和共用右栏；持久对话/草稿/引用；13 个题库/备课操作共用业务 rules 和 mutations；真实错误映射、原键原体恢复、冲突对照；服务器白名单与真实 usage 展示。实现方法由 C26 决定，不再自建 runtime 或插件系统。
- 写入：`apps/api/src/agent/`、`apps/web/src/features/agent/`、题目/备课模块新增 operations 及 router 的等价接线、Agent 迁移和本批 API/E2E 测试、`docs/acceptance/evidence/C26/v1/`。只为本批集成写入下表公共文件；旧 schema/业务语义、认证内部和原型不改。

| 共享文件集合 | 唯一写者 / 用途 |
| --- | --- |
| 根和 apps 的 package.json、package-lock.json | C26，固定 pi 依赖及必要验证命令。 |
| apps/api/src/app.js、server.js、config/env.js、scripts/verify-storage.js；apps/api/src/workbench/index.js | C26，认证后装配 Agent、配置、同库迁移和启动/关闭。 |
| apps/api/src/modules/questions/{index,router}.js、lessons/{index,router}.js；必要模块内 operations 文件 | C26，手工与工具共用新增 Interface，不改旧操作意义。 |
| apps/web/src/App.jsx、features/workbench/ 的外壳、API transport 与样式 | C26，首页/固定 AI/共用右栏及身份代次；保留认证入口的既有行为。 |
| packages/shared/src/ 中既有静态目录校验与本地代码映射 | C26，仅集成真实消费者需要的静态映射，不增加第七模块或任意贡献字段。 |
| playwright.config.mjs、apps/web/vite.config.js、本批独占 E2E fixture、API 故障 fixture | C26，仅本批运行与测试装配；其他工作树不复用数据目录/端口。 |
| README.md | C26，重要产品变化后同步实际状态、运行入口和局限。 |

不要求同时修改表中每一项；必要但未授权的共享文件在回执说明归属，由外层确定唯一写者。其他业务会话若在同一入口集成，外层先明确串行集成顺序，C26 不自行联系或派发业务 session。

验证先从老师 E2E 路径建立反馈，再缩小到公开 HTTP/operations/真实 SDK 边界。先验证新增公开投影：只读 404 且无 assistant/无 mutation 的事件和 snapshot 一致、全部工具关联、停止/重启裁决、只读异常与写 unconfirmed 分离及去重写调用的同 journal 同步。必须覆盖 WB-AG-001 至 023 及原首流受影响回归，空库/A11 或 B16 升级库/保留库重启、构建、项目现有 API/E2E 必要检查。UI 不写单元测试。特别注入提交后丢响应、原题变更后重放、事件补发交界、stop 与已开始写入、认证撤销、SDK unknown 和嵌套 isError 对照。替身与真实模型证据分开。

C26 回执固定产品 SHA、实际版本/命令、独占数据/端口、真实模型请求数和已报告 usage、身份模式、失败与修复证据，并返回 self，供 C27。如适用 implement/code-review，先提交完整候选再进行 skill 内部双轴审查，由本 session 聚合；不另派业务 session。

启动条件：外层已对本次新增公开投影完成限定独立核验、关闭 C25-D01 并冻结修订 C25，固定集成输入和共享写者。可在模型请求授权/配置未到时完成零模型实现与大部分验证；真实模型调用须由 C26 本次任务明确授权，并具备允许的精确配置。当前 C25 的“零新请求”不会被本任务包越权解除。真实认证外部门禁未通过时记录局限，不以 test-principal 或 fake-mail 冒充 real-auth。

## C27 独立验收

- 模型/harness：Codex CLI `gpt-6-astra` / `medium`，独立新 session；不复用 C26 的作者判断。
- 输入：C25 完整设计 SHA 和独立冻结报告、C26 完整产品 SHA/自检/运行入口，以及外层提供的认证独立证据与本轮产品模型请求授权。读取协议 `#acceptance`/`#receipt`、[C27 判据](../../acceptance/mvp-matrix.md#c27)、BDD、UX 和契约；仅出现争议时追固定实验轨迹。
- 行动：在隔离库以新题目要求走真实查询、复制改编、指定备课环节引用、页面重找及保留库重启；两允许模型各验证真实业务链路，用量分别记账。覆盖 WB-AG-019 至 023 的只读成功/失败持久投影、停止/恢复和写 journal 关联；覆盖持久草稿/另一设备、未知结果确认、手工冲突、认证隔离、真实 SDK 错误和桌面/Pad 视觉。模型失败场景可使用受控服务故障而不是额外无界付费重试；原 C24 不重跑。
- 判据：WB-AG-001 至 023 所有适用项目有真实可观察证据；完整 live 链路必须有 pi 请求、业务与浏览器三方一致结果；仅建议、合成 assistant、模拟业务或 self PASS 均不放行。真实认证/物理设备缺口逐项写明，不能偷换成模拟视口证据。
- 写入：仅 `docs/acceptance/evidence/C27/v1/` 与获准的隔离验证制品；产品与旧证据只读。回执 `review.md`，级别 independent，附 SHA、实际运行环境、场景、原始日志/截图校验、请求及 usage、缺陷最小复现。实现缺陷归 C26，契约缺口归 C25，认证外部缺口归 A12，费用授权/配置归外层提供者。
- 启动条件：外层取得 C26 固定候选并完成必要前置核对、明确 live 调用窗口和真实身份验证依据。缺外部条件只阻塞对应真实性结论，先完成可独立的只读/零模型检查；不能因 C24 通过而省略 C27。

两节点均只按派发授权提交；合 main、push、部署另需既有授权覆盖。外层负责唯一回调，不建立轮询或互聊。
