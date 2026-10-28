# 测试套件消融与重建

## 目标与授权

用户于 2026-10-27 授权：移除全部旧测试，从当前有效需求重新判断必要保护，只有有用的测试才重建或恢复；总控持续推进，并持久化状态以支持跨会话接续。已确认采用三条作者工作线、独立消融验收和 Standards/Spec 双轴审查，最多同时运行三个执行者。

完整交付包括：可运行的新套件、旧测试逐组去留依据、故障检出与消融证据、CI 和验证文档同步、独立审查、preview/integration 集成与临时现场清理。不以删除数量、覆盖率或单批通过替代完成。现行产品行为保持；发现实际产品缺陷先按真实入口复现，再独立记录并修复。

授权及受保护现场沿[运行台账](run-state.md#工作现场与授权)。允许本任务隔离 worktree、提交、任务集成 PR、既定 CI 及 trunk 同步；不包含 main 发布、公开部署、收费模型或用户私有数据操作。未完成时保留所有任务现场和有效证据。

## 固定输入与实验方法

- 原始基线：`789a38d83babad04f2e2a51e9f17530abf638801`，已 fetch，和 origin/preview/integration 一致。
- 原始套件：77 个 API test 文件、56 个浏览器 spec、3 个扩展独立测试脚本，以及7个非标准命名历史验证脚本，共143个执行入口。完整清单见本目录下 `test-suite-rebuild/old-tests.tsv`。OCR选型重建脚本与真实模型采集 fixture 属于固定证据/输入准备，保留后核对消费者，不当作回归用例。
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

状态：标准命名及扩展用例已在 `992172141f6664d4d851154cc533428414051c42` 清空，另6个独立入口在 `8be6e3a7` 补删；清理旧runner时补发现独立断言脚本 `first-flow-real-runner.mjs`，已在 `edfc875a` 删除并补入第143入口，D正在补核。A/B/C保护清单均获总控确认。A首个作者候选已集成实验分支，B/C正在完成作者验证；D利用A释放的执行位先核对旧套件，最终消融仍等待完整候选固定。公共真实HTTPS应用fixture由总控统一提供。

| 现场 | session / 状态 |
| --- | --- |
| `TeachBuddy-test-rebuild` / `test/suite-rebuild` | 总控候选，公共准备与CI整合；当前候选以Git为准 |
| `TeachBuddy-test-data` / `test/rebuild-data` | `/root/author_a_data`，首候选 `f8752c16` 已提交，集成候选 `2c458004`；待独立发现返工 |
| `TeachBuddy-test-browser` / `test/rebuild-browser` | `/root/author_b_browser`，B实施 |
| `TeachBuddy-test-outputs` / `test/rebuild-outputs` | `/root/author_c_outputs`，C实施 |
| `TeachBuddy-test-audit` / `test/rebuild-audit` | `/root/auditor_d_ablation`，以 `2c458004` 接手，先盘点旧142入口，完整候选待总控通知 |

公共准备：全新npm安装、GeoGebra源码冷构建（9m55s）与完整工作区build已通过，日志在总控 `test-results/test-suite-rebuild/{npm-install,math-build,full-build}.log`。C只读使用总控 `apps/web/dist`，该版本尚未包含B题库修复；数学源码及运行时输入一致。B用本树源码与同任务新公共资产另建 `web-full-fixed`。运行中的只读产物不得覆盖。基线CI仍由exec session 84842等待；2026-10-27 21:41左右核对HTTP/SQLite job已成功，browser/output尚在执行。恢复时先核对实际结果，不重复启动。

### 已有证据与发现

- A作者自验31 PASS、0FAIL、0skip，约6.5s，定点lint通过；十组独立副本业务故障均具名断言失败。回执见[author-a](test-suite-rebuild/author-a.md)，原始TAP/patch在A工作树 `test-results/test-suite-rebuild/`。这不是独立消融结论。
- B通过真实两页编辑复现题库冲突刷新后失去处理入口，两个稳定红证据在B工作树。修复 `c0391858` 已集成为 `dd96795e`：从保留草稿版本与服务器版本重建冲突，原请求未决时仍先核实。局部反馈环通过，完整B候选与独立验证待回收。
- C原生Word/PDF、OCR消费、真实可编辑输出与代表性数学/网页桥正在完成自验，五组故障已具名检出。缺资产、SVG数量、旧DOC预览状态、扩展旧版本消息筛选等建场问题与产品缺陷分开，不计故障检出。
- D初步提出A需核对的有效保护：认证挑战绑定/存储失败/关闭注册，未知Document版本写保护，删号清理失败锁定与启动接续，R31旧请求兼容。这些尚未关闭，待C交付释放执行位后恢复A，维持最多三位执行者。
- 总控已清理旧suite配置和无消费者UI helpers；静态检查发现仅被旧测试调用的公式预检及同步Pandoc分支，没有产品消费者，已删除；其他只用于旧测试的导出改为内部函数。对应 `d8473977`，需纳入最终审查/CI。当前静态尚有待整合新B/C后核对的依赖和旧runner导出，不宣称全绿。

1. 回收基线CI及B/C作者候选；原始143入口清单已入库。
2. 按D具名发现恢复相应作者修复，核对旧运行器/输入/依赖消费者并收口静态与文档。公共fixture `8be6e3a7`、二进制client `e27a49ca` 已被各作者cherry-pick，集成只取作者独有提交。
3. 固定完整候选交D独立业务故障和逐组移除比较，保留143入口逐项去留映射，关闭必要缺口。
4. 按已读code-review skill交E/F双轴审查；根基线固定789a38d8，规格为用户确认目标及本记录，不另要求用户重复提供。收齐已知修复后创建单一集成PR，让CI承担干净环境完整回归；审查与CI可并行。
5. 核对已审候选与最新trunk，squash集成、同步体验现场并清理。未满足时保留完整目标、现场和下一动作。

当前无用户输入阻塞。尚无新套件完整通过、独立消融通过或trunk集成完成的结论。
