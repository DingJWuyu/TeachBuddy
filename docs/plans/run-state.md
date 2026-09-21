# 当前运行台账

本页只记录编排的当前状态和下一步，不保存修改历史，不替代 DAG 的依赖、范围或授权门禁。它属于编排记录，不新增产品流程。未派发、待回执和待生成表示当前没有可核对的实际值。

## 当前用户授权与调度决定

- main 文档合并已获许可；产品 DAG 实施、部署、发布、推送和额外付费尚未获许可。
- 用户已允许后续真实模型测试消耗现有 GOAT 套餐额度；不购买或使用额外付费额度，计费条件不明确时停止调用。此许可不启动产品 DAG。
- 本次 Luna max 文档同步完成必要文本一致性、链接和 diff 自检后直接集成，不追加独立复审；结果按 `self` 记录。
- 顶层常规核验使用 `gpt-5.6-sol` `high`，复杂疑难审查才使用 Astra，实现通常使用 `gpt-5.6-luna` `max`；适用 skill 的内部助手继承调用 session 的模型与 effort，其模型与 effort 由调用 session 决定，不另设验证项。
- 顶层任务由编排者派给独立 session。适用 skill 要求的内部助手由调用 session 管理并汇总，不单列 DAG 节点，不自行继续委派或跨业务互聊；业务 session 不自由互聊或扩展 DAG。
- 认证与工作台由根编排者统一协调，延续现有 OpenAPI 和 HTTP 状态码约定。
- 产品只允许 `deepseek/deepseek-v4.1-flash`、`z-ai/glm-5.3-flash`；真实 API key、调用、完整部署和大陆访问均尚未验收。

## 低频 check 与回执监测

- 根已在本机用户 systemd 建立定时任务，当前状态记录为 `active/waiting`、`enabled`：timer `teacherworkspace-check-01a0be12.timer`，service `teacherworkspace-check-01a0be12.service`。
- 运行环境配置指针：`/home/liam_t/.config/systemd/user/teacherworkspace-check-01a0be12.timer` 和同名 `.service`。注册时间为 `2026-09-21T17:24:19.053686+00:00` UTC；`OnActiveSec=45min`、`OnUnitActiveSec=45min`、`AccuracySec=1s`。
- service 只运行 `codex queue --thread 01a0be12-5c28-7823-a7ed-644df825467f --message check`，每次投递内容恰为 `check`。投递和唤醒依赖本机、用户服务和 Codex 收件服务运行；机器或相关服务离线时不保证即时处理。
- 配置文件属于已存在的运行环境，本页只保留指针，不复制进仓库，不修改、重建或测试触发器，也不创建安装脚本。
- 根收到 `check` 后先读本页：有未完成任务且近 45 分钟没有回执时，才对台账中相关 session 做一次恢复检查；无未完成任务或已有近期回执时结束本次检查。结果已保存但回执丢失时按原 `task`、`revision`、`attempt` 接续；session 仍正常运行则等待；明确中断才按既有失败规则处理。超时本身不判失败、不杀死运行中的工作、不盲目重派；`check` 不能启动产品 DAG。
- 回执监测字段：监测起点为上述真实注册时间；最后回执处理时间为 `未知`，对应任务为 `未知`，因为初始化前的旧回执时间不明。根每次收到实际任务回执后记录实际处理 UTC 时间及对应任务，供下一次 `check` 使用；本次不编造旧值。

| 任务/版本 | 当前状态 | attempt | 负责 session 与 worktree | 输入/正式回执或产物位置 | 阻塞/下一步条件 | 适用授权 |
| --- | --- | --- | --- | --- | --- | --- |
| 文档拆分 / `mvp-dag-refactor-v2` | v2 受审版本独立 PASS；v2.1 规则同步不追加复审 | 1 | `01a0c480-d75b-76f1-bf01-d03e40d7336c`；`docs/mvp-delivery-baseline` | [独立核验回执](mvp-dag-refactor-review.md) | 原 PASS 只适用于受审版本；产品实施仍等 G00 | 文档规划审查；不含产品实施授权 |
| API/部署调研及修正 / `readiness-correction@1` | RR-01/02/03 已由作者 Luna 修正并自查；不记录为修正后独立 PASS | 1 | API `01a0c4a3-ecfe-76f3-b7c2-e0278103d996`；部署 `01a0c4a3-ed08-7723-8cc8-9378471bcc83`；首次核验 `01a0c4b5-362a-7d60-a1b4-9c47602e9ee8`；修正 `01a0c4bf-e5c7-7613-ae17-2c6e000726d2` | [正式修正回执](../acceptance/evidence/readiness-correction.md)、[API 报告](../research/command-code-api.md)、[部署报告](../research/deployment-options.md) | 用户已取消独立复审；套餐额度内的真实调用已获许可但未执行，部署和大陆网络验证仍未执行 | 已完成文档修正与自查；后续调用遵守本页费用授权，不含部署或购买服务 |
| 认证交接 / `c7420af` 行为基线 | 已请求现状并同步统一编排安排，等待主动回执；正式认证交付尚未证实 | 1 | `01a0bea6-5119-7861-b060-e5f1da67947b`；worktree：待回执 | [认证契约](../contracts/auth.md)、[认证行为](../../prototype/behavior/auth.md)；回执目标为根 thread `01a0be12-5c28-7823-a7ed-644df825467f` | 等待现有产物、版本及缺口的主动回执；不轮询、不另开认证实现 | 用户已将认证纳入统一编排；不扩展原任务或启动产品 DAG |
| 技能流程核对 / `skill-routing@1` | `READY_FOR_INTEGRATION`；已完成，不追加审查 | 1 | Sol high `01a0c4d1-9404-75b1-8b48-5f5a928c0664`；`/home/liam_t/项目/TeacherWorkspace-mvp` | [技能路由](skill-routing.md)、[正式回执](../acceptance/evidence/skill-routing.md)；输入 SHA-256 `9cddc05827f0bfc1797d7b357d21d809f950ff56796e3908e2844b999e4ba5a0` | 最小规则已进入协议与任务包；适用 skill 的内部助手继续按所选 harness 执行，不新增内部模型选择验证项目 | 用户授权技能核对及适用技能内部限定委派；不含产品实施 |
| 编排规则同步 / `orchestration-rules-sync@1` | 候选 commit `bb50dfd` 已按授权快进合入 main；四份计划文档已同步并通过必要自检；45 分钟 `check` 未触发，恢复检查未演练 | 1 | `01a0c500-ce05-7722-a2e4-497353d057dc`；`docs/mvp-delivery-baseline` | [技能路由](skill-routing.md)、[执行协议](execution-protocol.md)、[任务包](task-package.md)、本页 | 本次同步已完成；不启动产品 DAG | Luna max；文档提交与合并已获许可；不含产品实施、API 请求、额外审查或 push |
| 文档与配置集成 / `corrected-doc@1` | 候选 commit `8b1f8b5` 已提交；本轮按授权完成 main 集成，最终 SHA 由本 session 回执提供 | 1 | `01a0c4e0-6961-72d2-886e-8291768a5f05`；`docs/mvp-delivery-baseline` | [修正回执](../acceptance/evidence/readiness-correction.md)、[技能回执](../acceptance/evidence/skill-routing.md)、本页 | 文档规则、正式回执、无秘密模板和配置准备已集成；不启动产品 DAG | Luna max；文档与 main 合并已获许可；不含产品实施、部署、发布或推送 |
| 产品 DAG / G00 及后续实施节点 | 实施授权关闭；实施节点未开始 | 未派发 | 未派发；worktree：待生成 | [DAG 用户门禁](mvp-dag.md#用户门禁)、[外部依赖](mvp-dag.md#外部依赖与失败归属) | 等待用户明确授予 G00；main 合并许可不替代实施授权 | G00 未授予 |

配置准备状态：文档 worktree 和 main 的 `.env` 均已从现有本地配置准备，权限为 `0600`，两处 `COMMANDCODE_API_KEY` 只核对状态、不在仓库记录值；两处均被 Git 忽略。`.env.agent.example` 只保留无密钥模板。

未完成外部状态：认证 session 尚未主动回执；两个允许模型的真实请求、额度和费用未验证；部署候选、Cloudflare/Tunnel、Windows/WPS/Edge/Chrome 目标流程、备份恢复和中断恢复演练均未执行。以上状态不因文档已写或配置已准备而改变。
