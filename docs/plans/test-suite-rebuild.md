# 测试套件消融与重建

## 目标与授权

用户于 2026-10-27 授权：移除全部旧测试，从当前有效需求重新判断必要保护，只有有用的测试才重建或恢复；总控持续推进，并持久化状态以支持跨会话接续。已确认采用三条作者工作线、独立消融验收和 Standards/Spec 双轴审查，最多同时运行三个执行者。

完整交付包括：可运行的新套件、旧测试逐组去留依据、故障检出与消融证据、CI 和验证文档同步、独立审查、preview/integration 集成与临时现场清理。不以删除数量、覆盖率或单批通过替代完成。现行产品行为保持；发现实际产品缺陷先按真实入口复现，再独立记录并修复。

授权及受保护现场沿[运行台账](run-state.md#工作现场与授权)。允许本任务隔离 worktree、提交、任务集成 PR、既定 CI 及 trunk 同步；不包含 main 发布、公开部署、收费模型或用户私有数据操作。未完成时保留所有任务现场和有效证据。

## 固定输入与实验方法

- 原始基线：`789a38d83babad04f2e2a51e9f17530abf638801`，已 fetch，和 origin/preview/integration 一致。
- 原始套件：77 个 API test 文件、56 个浏览器 spec、3 个扩展独立测试脚本，以及6个非标准命名历史验证脚本，共142个执行入口。完整清单见本目录下 `test-suite-rebuild/old-tests.tsv`。OCR选型重建脚本与真实模型采集 fixture 属于固定证据/输入准备，保留后核对消费者，不当作回归用例。
- 已启动原始基线 CI：[40632221950](https://github.com/DingJWuyu/TeachBuddy/actions/runs/40632221950)。结果尚待回收；不以旧版本通过代替本次基线结果。CI 外专项按清单记录未验，不伪称全量执行。
- 空测试实验移除用例，保留真实固定输入、历史兼容快照和产品源码；运行框架、fixture 与脚本按实际消费者整理。`.feature` 为需求资料，先核对有效语义，不把它们算作执行用例。生成文件和只读设计输入遵守原保护规则。
- 作者先按当前规格与真实使用路径提出最小保护集合，冻结设计前不读取旧断言。可以读取无断言的输入/服务准备代码；必要时由总控提供公共运行环境。随后独立验收者读取旧套件与历史缺陷，挑战候选。
- 每组记录当前需求、用户可见故障、首选测试层、真实依赖/替身、预期失败。对代表性独立保证手动注入可运行的业务故障，比较完整候选与逐组移除候选；编译失败、fixture 故障、超时未定位、skip 不算检出。历史缺陷与故障均需具体证据，不制造通用 mutation 框架。
- 根配置、CI、共享测试准备及权威验证文档由总控唯一写入。真实服务调用、Office 人工编辑、GPU 推理和目标设备边界继续单列。

## 工作线与边界

| 角色 | model / effort | 写入范围与交付 |
| --- | --- | --- |
| 总控 | 当前 session | 任务记录、运行台账、根脚本/CI/公共测试配置、集成与清理；维护风险归属，核验回执 |
| A 业务与数据 | gpt-6.1-sol / medium | `apps/api/test/rebuilt/` 的业务/身份/保存/恢复/Agent 合同用例及本线专属 helper；不承担文件格式与数学渲染断言 |
| B 用户流程 | gpt-6.1-sol / medium | `apps/web/e2e/rebuilt/` 的真实主应用流程及专属 helper；覆盖八分区入口、保存重开、交接/失败接续和关键跨模块流程 |
| C 材料与数学 | gpt-6.1-sol / high | `apps/api/test/rebuilt-outputs/`、`extensions/math-web-ai/test/rebuilt/`，固定材料/OCR 消费、真实文件与数学输出、网页桥；浏览器专用成果用例在独占 `apps/web/e2e/rebuilt-outputs/` |
| D 独立消融 | gpt-6.1-sol / xhigh | 固定候选的独立实验现场，旧套件去留、历史缺陷与故障注入、移除组比较；报告问题，由原作者返工 |
| E/F 独立审查 | 按 code-review skill 继承审查会话 | 固定 diff 的 Standards/Spec，只读审查，按变化复核 |

作者分别维护 `test-suite-rebuild/author-a.md`、`author-b.md`、`author-c.md`，先交保护清单再实施；本文件由总控唯一维护。必读根 AGENTS、开发约定、LESSONS、代码标准、验证入口与 CI 分工；业务按 docs/README、subsystems 索引展开。作者修复产品前向总控报告复现和涉及文件，避免抢写。隔离实例使用独立端口、数据库、文件和浏览器 context，不读取 preview 私有配置。

## 当前阶段与接续

状态：标准命名及扩展用例已在 `992172141f6664d4d851154cc533428414051c42` 清空，另6个独立入口随后补删。A/B/C保护清单均获总控确认，已进入实现。公共真实HTTPS应用fixture由总控统一提供，作者不各自建立第二套运行器。

| 现场 | session / 状态 |
| --- | --- |
| `TeachBuddy-test-rebuild` / `test/suite-rebuild` | 总控候选，公共准备与CI整合；当前候选以Git为准 |
| `TeachBuddy-test-data` / `test/rebuild-data` | `/root/author_a_data`，A实施 |
| `TeachBuddy-test-browser` / `test/rebuild-browser` | `/root/author_b_browser`，B实施 |
| `TeachBuddy-test-outputs` / `test/rebuild-outputs` | `/root/author_c_outputs`，C实施 |

本机正在运行的准备：npm安装日志 `/tmp/teachbuddy-test-rebuild-npm.log`（exec session 94060）；GeoGebra全新构建日志 `test-results/test-suite-rebuild/math-build.log`（73637）；基线CI等待（84842）。恢复时先核对进程/结果，不重复启动。安装与构建不读取preview私有配置或复制旧工作树产物。

1. 回收基线 CI 的结果、耗时、跳过和失败；确认旧套件完整入口清单。
2. 在总控隔离 worktree 删除所有旧执行用例并提交空测试基线，记录 SHA；从该基线建立 A/B/C 工作树，启动三位作者的保护清单阶段。
3. 总控确认跨线归属和公共准备后，作者实施并定点实跑，根 CI 接入候选入口。
4. 汇总候选后交 D 独立挑战，修复并复验，再交 E/F 双轴审查。最终 CI 负责干净环境完整回归，必要的 CI 外专项定点运行。
5. 一个完整目的汇总为一个集成 PR；核对已审候选与最新 trunk，squash 集成、同步体验现场并清理。未满足时保留完整目标、现场和下一动作。

当前无用户输入阻塞。尚无新套件通过、消融通过或集成完成的结论。
