# 测试套件消融与重建

## 目标与授权

用户于 2026-10-27 授权：移除全部旧测试，从当前有效需求重新判断必要保护，只有有用的测试才重建或恢复；总控持续推进，并持久化状态以支持跨会话接续。已确认采用三条作者工作线、独立消融验收和 Standards/Spec 双轴审查，最多同时运行三个执行者。

完整交付包括：可运行的新套件、旧测试逐组去留依据、故障检出与消融证据、CI 和验证文档同步、独立审查、preview/integration 集成与临时现场清理。不以删除数量、覆盖率或单批通过替代完成。现行产品行为保持；发现实际产品缺陷先按真实入口复现，再独立记录并修复。

授权及受保护现场沿[运行台账](run-state.md#工作现场与授权)。允许本任务隔离 worktree、提交、任务集成 PR、既定 CI 及 trunk 同步；不包含 main 发布、公开部署、收费模型或用户私有数据操作。未完成时保留所有任务现场和有效证据。

## 固定输入与实验方法

- 原始基线：`789a38d83babad04f2e2a51e9f17530abf638801`，已 fetch，和 origin/preview/integration 一致。
- 原始套件：77 个 API test 文件、56 个浏览器 spec、3 个扩展独立测试脚本，以及8个非标准命名历史验证脚本，共144个执行入口。完整清单见本目录下 `test-suite-rebuild/old-tests.tsv`。OCR选型重建脚本与真实模型采集 fixture 属于固定证据/输入准备，保留后核对消费者，不当作回归用例。
- 原始基线 CI：[40632221950](https://github.com/DingJWuyu/TeachBuddy/actions/runs/40632221950) 已失败：HTTP/SQLite 284 PASS、0skip，105.8s；输出51 PASS；浏览器422 PASS、2skip、1FAIL，23.9m。合计757 PASS、1 FAIL、2 skip。唯一失败为标签改名迟到成功后重新打开保存，已在本地受控读回迟延下稳定复现409并修复，详见下方证据。CI外专项按清单记录未验，不伪称全量执行。
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

状态：作者实施和独立消融完成，候选共92项（CI API45、浏览器23、输出及扩展24）；144个原执行入口均已删除并记录去留依据。四处产品修复和双轴初审4项修正均已集成候选及定点通过。D取得A12/C6/B6共24项代表性故障与移组对照，不宣称92项逐条mutation或全部旧断言等价覆盖。三次Node/V8原生SIGSEGV尚无稳定复现，原始失败单列保留，不计业务故障检出；最终完整回归、trunk集成和清理仍待完成。

| 现场 | session / 状态 |
| --- | --- |
| `TeachBuddy-test-rebuild` / `test/suite-rebuild` | 总控候选；标签竞态修复已提交，当前候选以Git为准 |
| `TeachBuddy-test-data` / `test/rebuild-data` | `/root/author_a_data`，业务41例；第三批5ffe6ad7已集成为2f55a534；最后一批e0b5cf68已集成，业务共46例；作者完成，空闲 |
| `TeachBuddy-test-browser` / `test/rebuild-browser` | `/root/author_b_browser`，最终增量1e1bf69b已集成为7c5e11b9；作者完成，空闲 |
| `TeachBuddy-test-outputs` / `test/rebuild-outputs` | `/root/author_c_outputs`，第二候选73e9526d已集成为6b70a35c，22例；第三批b7e9df9与c796c50已集成；23例，空闲 |
| `TeachBuddy-test-audit` / `test/rebuild-audit` | `/root/auditor_d_ablation`，144入口裁决和24项代表性独立消融完成；终稿b7ec301已接收；A186/B437/C195文件恢复检查一致，清理清单随后归档 |

公共准备：全新npm安装、GeoGebra源码冷构建（9m55s）与完整工作区build已通过，日志在总控 `test-results/test-suite-rebuild/{npm-install,math-build,full-build}.log`。C只读使用总控 `apps/web/dist`，该版本尚未包含B题库修复；数学源码及运行时输入一致。B用本树源码与同任务新公共资产另建 `web-full-fixed`。运行中的只读产物不得覆盖。基线CI已结束，失败日志及小日志包在总控 `test-results/test-suite-rebuild/baseline-ci/`。总控 `web-candidate` 为中间题库/标签修复；最新只读完整 `test-results/test-suite-rebuild/web-reviewed` 从固定36f5bb1f构建，包含全部四项产品修复。旧产物保留用于前后对照。

### 已有证据与发现

- A作者41例通过，十组首轮与五组补充故障均具名检出。独立D固定候选41 PASS，并完成历史请求、未知Document、删号启动接续、身份存储失败、Agent同轮去重的“正常通过/故障失败/移组漏检”证据；共享回执错误被saving和classroom重复检出，两个组尚有各自业务保证，不能只凭这一重叠删除整组。
- A第三批通过真实startServer(dev:true)运行Vite/StrictMode，注册、资源上传往返、题目保存刷新1 PASS（10.7s）；复用已abort的资源controller故障被上传可用性断言检出，恢复后通过。Cookie属性在已有身份例中补验通过，不新增重复登录矩阵。
- B真实两页编辑复现题库冲突刷新后失去处理入口，两个稳定红证据对应产品修复dd96795e；首轮13例通过。补强包含数学实际对象新设备读回、保存回执后的新输入、资源两阶段未决接续、PDF真实文字层复制、删号IndexedDB原件清理与迟到写保护。
- C22例涵盖实际输入/输出/数学/扩展；补强转换隔离、OCR进程停止与迟到绑定、跨页教学表格角色、真实GGB对象/视口/3D。直接调用生成器的Word/PDF断言已删除，现无产品导出消费者，保留其固定试卷输入生成用途。受控OCR和网络隔离桥不冒充真实GPU/DeepSeek验收。
- 总控已清理35个旧Playwright配置、无消费者UI helper、旧runner图与重复依赖；只有旧测试调用的公式预检/同步Pandoc分支已删除，内部导出收回。当前Knip+lint通过；最终B合入后只补新增范围，完整干净回归交PR CI。
- 原CI标签竞态：CI trace确认第二次PUT409；首次最小路径通过，阻塞改名后GET列表读回即稳定复现同样409（4.2s），并非fixture失败。修复在读回完成前禁用保存/忽略Enter，保留重新打开后的草稿；定点1 PASS（5.2s），200、刷新后实际名称和截图均已核对。红/绿及CI trace保存在总控 `test-results/test-suite-rebuild/`；源/用例由总控独占。
- D对C固定6b70a35c独立22 PASS、0skip（94.7s）；指出当前MinerU document-6 typed equation/table/list消费未被旧Paddle回放证明，以及源删除后的noteFragments附件尚未经过导出恢复。C返工补两个实际独有边界，不恢复尺寸/模板全排列。
- B第三批I09两页迟到昵称、S45失败继续且注册仅一次、主应用STATUS/CONNECT/两轮SEND/取消迟到DONE已通过。D15水平拖到次日后09:00变08:55两次稳定复现，B独占TimeGrid.jsx/日程index调用链诊断及必要修复、docs/subsystems/schedule.md同步；root不抢写。
- B日程修复ca9f0c61已集成为1251f0ce：FC初始命中格改为与5分钟snap一致，CSS保持104px/h及每15分钟分隔。水平换日09:00不变、竖拖09:30、75分钟resize、新设备读回和实际CDP系统时区变化定点通过；相同最终用例在旧候选09:00/08:55具名失败。I09进一步受控全200顺序连续两次复现误报：同会话成功读取被新读取淘汰时返回undefined，被误判失败。修复7c5e11b9仅区分返回已验证账户与发布资料权限，旧资料仍受代次/会话/资料版本限制。最终两条昵称与真实换账户对照PASS，原身份/S45/退出三条PASS；历史旧昵称反转为具名红，额外只改入口guard仍被其他保护挡住，如实记未取得独立红。
- C第三批2例7.16s PASS：官方D2/D8 typed math/table（原raw不改），另可见自编受控typed-list；删源noteFragments个人包/维护backup-restore-activate后重新登录读回。独立23例候选待D复核。分页沿现C3补80行真实PNG，1例4.06s PASS，截掉后续片的故障33/80行FAIL；不恢复尺寸矩阵。
- D最终源核对提出最后A补强：运行中stop和running崩溃恢复；monthly跳2月/全天DST；考试原卷location成员关系。A已恢复并将D03活跃删号等待abort真正settle合入同批，五条定点正常PASS（4.33s），四项业务故障具名失败，见author-a最后一节；全部注入已恢复。D01-D23已集中裁决，除这批与现候选复核外无新必需项；慢body/全部列表乱序/模板等按实际变更专项，外部环境不代签。
- 无消费者旧页面/服务图再清理25文件、2596行，包括1266行身份替身服务器；同时移除专用supertest与多余Knip入口，resolveWorkbenchModules仅取消无消费者的导出，产品装配保持。固定legacy-source档案与输入生成器保留。Knip+lint通过，干净依赖安装由最终CI再验。
- 原始执行入口补发现143 `first-flow-real-runner.mjs` 和144 `fixtures/auth-contract/https-smoke.mjs`；D映射已同步，最终报告仍待提交。

1. D终稿b7ec301及恢复检查已接收，144入口裁决和24项代表性对照已核对；未定位原生异常单列保留。
2. 使用已完成的双轴审查，固定单一集成PR候选，由干净CI执行当前全部回归；若有失败，沿真实失败定位并按影响复核。
3. 核对已验候选与最新trunk，按SHA squash集成、同步体验现场；保全有效证据后清理任务工作树、分支和精确归属的临时文件。

统一浏览器配置已合并，重复的rebuilt/playwright.config.mjs已移除；当前收集23项浏览器场景，--list仅证明收集范围。固定36f5bb1f完整Web构建及Knip/lint通过，最终全量仍交PR CI。

### 独立审查与当前验证尾项

- 初审固定13e16e2。Standards两项P2：资源保存把本机草稿当远端读回；Node失败现场留/tmp而CI只上传test-results。Spec一项P2：答案PNG可被重复题干替代仍通过；一项P3：数学文档覆盖声明超出当前测试。
- 修正08e01f45/56672e6/83fac6c0：答案内容差分及真实替换故障红；资源保存200/UI确认和新设备读回，503/200未落库两故障红；Node目录统一在本checkout test-results/runtime；数学声明收窄至实际范围。目录迁移后Agent生命周期3 PASS、真实PNG1 PASS，成功目录清理有效，静态通过。
- [Standards回执](test-suite-rebuild/review-standards.md)复核至83fac6c0，两项关闭；[Spec回执](test-suite-rebuild/review-spec.md)复核至56672e6，两项关闭。最终报告/后续增量在集成前再按范围复核，不声称PR/CI已完成。
- D独立正常：原C22及新增三文件通过，统一浏览器23 PASS（169.48s），A最后三文件9 PASS（5新增+4既有日程）。B历史昵称有独立旧回执1FAIL及移除组21PASS。其他代表性故障和144入口终稿仍在完成。
- D的A全天移除组及C typed移除组出现无关Node启动SIGSEGV；一个D12 child尚无committed-checkpoint、目录空；另recognition-consumers尚未声明子测试即退出。另C维护restore子进程错误待共同定位。失败原始TAP/现场保留在D，全部注入已finally恢复，先做最小启动诊断，不把无关退出计检出或用重跑抹掉。
- 三个失败进程的core分别落在V8属性拦截器、原型注册/属性转换与优化代码/基线编译路径；没有证据定位产品业务或原生依赖。依赖文件共享改写假设未获时间与inode证据支持。50次独立import、20次串行实际识别入口及3并发×30批（90进程）均未再现；停止扩大本机循环，未改变Node版本、重试或skip。剩余独立业务实验继续，干净Runner验证最终候选，原生异常仍按未定位记录。
- CI仅修改输出步骤名称以对应当前扩展验证；actionlint v1.7.12检查该工作流退出0。工具仅临时安装在忽略产物目录，未加入产品依赖。

- 最后独立对照已完成：全天DST与typed表格内容的移组分别41/22 PASS；B飞行新稿、上传原键、数学实际坐标及设备原件清除均具名FAIL，移除对应文件后分别20/21/22/22 PASS。未新增实施缺口；具体版本、命令、重叠与边界由D终稿唯一记录。
- Standards复核至f3f9961，Spec复核至12436bd，无开放问题；之后只有报告事实变化。D实际故障留存SQLite integrity=ok、两份PNG摘要匹配固定I-1/I-2，且相对路径属于现有CI上传选择范围；E已核对，云端实际上传未冒称已验。
- 总控核对144路径集合与去留表完全一致，旧执行路径全部不存在，git diff --check通过。作者各线与集成候选的差异只有已审目录迁移、总控标签用例/A开发入口及统一配置、末尾空行整理，成果无遗漏。A/B/C原始证据已预归档到preview `test-results/test-suite-rebuild/`并逐文件核对SHA，尚未删除原现场。远端trunk仅同步了初始任务记录cd4084c5，产品集成待单一PR。

当前无用户输入阻塞。下一步固定最终报告与候选，创建集成PR并执行干净CI；成功后合入preview/integration、核对体验服务，更新完成状态并按精确清单清理。

### PR CI 首轮

[PR #52](https://github.com/DingJWuyu/TeachBuddy/pull/52) 固定候选e9d7d59，首轮[CI 40645528110](https://github.com/DingJWuyu/TeachBuddy/actions/runs/40645528110)已结束并失败。HTTP/SQLite为45 PASS、1 FAIL、0 skip（42.63s），静态检查已通过。唯一失败为考试原卷PNG预览，实际失败artifact中的`failure.txt`确认`spawn /usr/bin/bwrap ENOENT`：PNG也使用真实转换沙箱，API job没有该工具。修正ee5a16bb已将该用例移至已经准备文档工具/沙箱的输出组，保留原断言并补完整Job失败上下文，定点正常及成员关系故障检出均通过；计数调整为API45、输出及扩展24、浏览器23，总数92不变。构建及输出23 PASS、0skip（148.61s）；浏览器22 PASS、1 FAIL（3.0m），日程resize未等到PUT，B据实际trace/截图诊断中，尚不推新一轮CI。

本次真实云端失败已成功上传并下载`ci-api-diagnostics-1`，包含`runtime/rebuilt-business-lmbhMU/workspace.sqlite`、两份原PNG与转换失败日志。新目录的CI实际上传边界已取得证据，独立D报告中的“云端未验”为其提交当时状态。原生SIGSEGV未在该API运行出现，仍不据此宣称已定位或修复。
