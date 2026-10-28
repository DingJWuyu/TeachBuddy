# 测试套件消融与重建

## 目标与授权

用户于 2026-10-27 授权：移除全部旧测试，从当前有效需求重新判断必要保护，只有有用的测试才重建或恢复；总控持续推进，并持久化状态以支持跨会话接续。已确认采用三条作者工作线、独立消融验收和 Standards/Spec 双轴审查，最多同时运行三个执行者。

完整交付包括：可运行的新套件、旧测试逐组去留依据、故障检出与消融证据、CI 和验证文档同步、独立审查、preview/integration 集成与临时现场清理。不以删除数量、覆盖率或单批通过替代完成。现行产品行为保持；发现实际产品缺陷先按真实入口复现，再独立记录并修复。

授权及受保护现场沿[运行台账](run-state.md#工作现场与授权)。允许本任务隔离 worktree、提交、任务集成 PR、既定 CI 及 trunk 同步；不包含 main 发布、公开部署、收费模型或用户私有数据操作。未完成时保留所有任务现场和有效证据。

## 固定输入与实验方法

- 原始基线：`789a38d83babad04f2e2a51e9f17530abf638801`，已 fetch，和 origin/preview/integration 一致。
- 原始套件：77 个 API test 文件、56 个浏览器 spec、3 个扩展独立测试脚本，以及8个非标准命名历史验证脚本，共144个执行入口。完整清单见本目录下 `test-suite-rebuild/old-tests.tsv`。OCR选型重建脚本与真实模型采集 fixture 属于固定证据/输入准备，保留后核对消费者，不当作回归用例。
- 原始基线 CI：[40632221950](https://github.com/DingJWuyu/TeachBuddy/actions/runs/40632221950) 已失败：HTTP/SQLite 284 PASS、0skip，105.8s；浏览器422 PASS、2skip、1FAIL，23.9m。唯一失败为标签改名迟到成功后重新打开保存，已在本地受控读回迟延下稳定复现409，正在修复。输出组日志已回收。CI外专项按清单记录未验，不伪称全量执行。
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

状态：A第三批开发服务入口及Cookie属性已集成2f55a534；B第三批身份迟到/激活失败、主应用网页桥已定点通过；水平拖动任务稳定出现09:00变08:55，B正按E2E反馈定位，尚未裁决测试或产品缺陷。C第三批补当前MinerU typed内容及已采用笔记的导出恢复。144个原执行入口均已清空并入清单；A第二候选41例、C第二候选22例已经集成。B第二候选17例已集成c100f497，五项补强通过且四项有效故障具名检出。D已完成旧源/历史缺陷盘点，正在做独立三方消融。总控负责原基线CI暴露的标签保存竞态，不掩盖或跳过失败。

| 现场 | session / 状态 |
| --- | --- |
| `TeachBuddy-test-rebuild` / `test/suite-rebuild` | 总控候选；标签竞态修复已提交，当前候选以Git为准 |
| `TeachBuddy-test-data` / `test/rebuild-data` | `/root/author_a_data`，业务41例；第三批5ffe6ad7已集成为2f55a534，新增开发服务1例及Cookie属性；空闲 |
| `TeachBuddy-test-browser` / `test/rebuild-browser` | `/root/author_b_browser`，第二候选31202c38已集成为c100f497；身份/日程/主应用桥补强中 |
| `TeachBuddy-test-outputs` / `test/rebuild-outputs` | `/root/author_c_outputs`，第二候选73e9526d已集成为6b70a35c，22例；第三批typed识别/笔记迁出恢复中 |
| `TeachBuddy-test-audit` / `test/rebuild-audit` | `/root/auditor_d_ablation`，已盘点144入口；完成A固定5f1565b9独立实验后接C及最终B |

公共准备：全新npm安装、GeoGebra源码冷构建（9m55s）与完整工作区build已通过，日志在总控 `test-results/test-suite-rebuild/{npm-install,math-build,full-build}.log`。C只读使用总控 `apps/web/dist`，该版本尚未包含B题库修复；数学源码及运行时输入一致。B用本树源码与同任务新公共资产另建 `web-full-fixed`。运行中的只读产物不得覆盖。基线CI已结束，失败日志及小日志包在总控 `test-results/test-suite-rebuild/baseline-ci/`。总控另建 `web-candidate` 包含题库与标签修复，不覆盖上述已被作者引用的产物。

### 已有证据与发现

- A作者41例通过，十组首轮与五组补充故障均具名检出。独立D固定候选41 PASS，并完成历史请求、未知Document、删号启动接续、身份存储失败、Agent同轮去重的“正常通过/故障失败/移组漏检”证据；共享回执错误被saving和classroom重复检出，两个组尚有各自业务保证，不能只凭这一重叠删除整组。
- A第三批通过真实startServer(dev:true)运行Vite/StrictMode，注册、资源上传往返、题目保存刷新1 PASS（10.7s）；复用已abort的资源controller故障被上传可用性断言检出，恢复后通过。Cookie属性在已有身份例中补验通过，不新增重复登录矩阵。
- B真实两页编辑复现题库冲突刷新后失去处理入口，两个稳定红证据对应产品修复dd96795e；首轮13例通过。补强包含数学实际对象新设备读回、保存回执后的新输入、资源两阶段未决接续、PDF真实文字层复制、删号IndexedDB原件清理与迟到写保护。
- C22例涵盖实际输入/输出/数学/扩展；补强转换隔离、OCR进程停止与迟到绑定、跨页教学表格角色、真实GGB对象/视口/3D。直接调用生成器的Word/PDF断言已删除，现无产品导出消费者，保留其固定试卷输入生成用途。受控OCR和网络隔离桥不冒充真实GPU/DeepSeek验收。
- 总控已清理35个旧Playwright配置、无消费者UI helper、旧runner图与重复依赖；只有旧测试调用的公式预检/同步Pandoc分支已删除，内部导出收回。当前Knip+lint通过；最终B合入后只补新增范围，完整干净回归交PR CI。
- 原CI标签竞态：CI trace确认第二次PUT409；首次最小路径通过，阻塞改名后GET列表读回即稳定复现同样409（4.2s），并非fixture失败。修复在读回完成前禁用保存/忽略Enter，保留重新打开后的草稿；定点1 PASS（5.2s），200、刷新后实际名称和截图均已核对。红/绿及CI trace保存在总控 `test-results/test-suite-rebuild/`；源/用例由总控独占。
- D对C固定6b70a35c独立22 PASS、0skip（94.7s）；指出当前MinerU document-6 typed equation/table/list消费未被旧Paddle回放证明，以及源删除后的noteFragments附件尚未经过导出恢复。C返工补两个实际独有边界，不恢复尺寸/模板全排列。
- B第三批I09两页迟到昵称、S45失败继续且注册仅一次、主应用STATUS/CONNECT/两轮SEND/取消迟到DONE已通过。D15水平拖到次日后09:00变08:55两次稳定复现，B独占TimeGrid.jsx/日程index调用链诊断及必要修复、docs/subsystems/schedule.md同步；root不抢写。
- 无消费者旧页面/服务图再清理25文件、2596行，包括1266行身份替身服务器；同时移除专用supertest与多余Knip入口，resolveWorkbenchModules仅取消无消费者的导出，产品装配保持。固定legacy-source档案与输入生成器保留。Knip+lint通过，干净依赖安装由最终CI再验。
- 原始执行入口补发现143 `first-flow-real-runner.mjs` 和144 `fixtures/auth-contract/https-smoke.mjs`；D映射已同步，最终报告仍待提交。

1. 完成标签竞态修复与定点证据，回收B补强候选；原始144入口清单已入库。
2. 按D具名发现恢复相应作者修复，核对旧运行器/输入/依赖消费者并收口静态与文档。公共fixture `8be6e3a7`、二进制client `e27a49ca` 已被各作者cherry-pick，集成只取作者独有提交。
3. 固定完整候选交D独立业务故障和逐组移除比较，保留144入口逐项去留映射，关闭必要缺口。
4. 按已读code-review skill交E/F双轴审查；根基线固定789a38d8，规格为用户确认目标及本记录，不另要求用户重复提供。收齐已知修复后创建单一集成PR，让CI承担干净环境完整回归；审查与CI可并行。
5. 核对已审候选与最新trunk，squash集成、同步体验现场并清理。未满足时保留完整目标、现场和下一动作。

当前无用户输入阻塞。尚无新套件完整通过、独立消融通过或trunk集成完成的结论。
