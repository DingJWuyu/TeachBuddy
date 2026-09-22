# 材料与数学接续裁决

供后续执行者按范围读取。固定提案 `da23eb680a9c8b214ad18482d4f1fbc8a5f3fded` 已经 `677161bd23e37e2d8e22ae7e47214e2e662011ed:docs/acceptance/evidence/R30-MATERIALS-CONTINUATION/v1/review.md` 限定 independent PASS，根已采纳其 M43/M44 本地启动边例外。**该 PASS 只是依赖设计核验，不是 R35、M43 或 M44 产品 PASS。** 教师仍一次交入完整材料，由系统完成主要录入，再局部校对、入库和用于备课；在线失败不缩减此目标。

结论：当前没有足以重开在线窗口的新证据。可推进的是既有 R33 提取实现缺口和 R35 本地独立验证。R35 具名本地材料消费切片 independent 通过、固定 P/M/D 与共享唯一写权齐备后，可启动 M43 本地实现；M43 固定局部候选可交 M44 本地独立验证。完整 R35、M43、M44 及后续交付门槛保留。R35 具名结果与 M43 实际派发以[运行台账](../plans/run-state.md)及固定回执为准，不能由本裁决推定产品通过。执行范围见[接续任务包](../plans/tasks/materials/continuation.md)。

## 固定输入

下文代号只指本表固定对象，用 `git show <SHA>:<路径>` 读取；本分支没有引入产品代码。提案核验使用 `cb966d9457feadcee2a0d313ed9057caa6b28bfb` 的 DAG、矩阵及任务说明；当下执行入口以已同步的本分支文档为准。

| 代号 | 固定对象与读取入口 |
| --- | --- |
| P | `6398bf2dae85d1872c929aa8ef32d5705d763687`；`docs/acceptance/evidence/R34/v1/{attempt3,integration3}.md`、`R33/v1/{attempt2,attempt3}.md`，以及下表代码。来源 `/home/liam_t/项目/TeacherWorkspace-material-closure` 停写只读。 |
| F | R30 冻结 `8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1` 的 `docs/contracts/workbench/materials.md`、`materials.openapi.yaml`、`docs/acceptance/materials.feature`、`docs/plans/tasks/materials/R33.md`；独立依据 `88a89f00b78dd301ca9893a191277eb9970c4c18:docs/acceptance/evidence/R30/v1/final-review.md`。 |
| T | `43b117c7ed6fe5aa408422351db46e23a6ea6f3e:docs/arch/capability-checks/T-native-input.md`，拥有 T 判据适用与缺图恢复说明。 |
| O | 页级方案 `a510cc0a46ea622b740e5d9e27ce8242300db055:docs/arch/capability-checks/C21-online-decision.md`；失败制品 `2b10b4ecbfef907de1d0c368c7a29eb49af803c4:experiments/C21/page-transcription-1/`；回执 `4115bb66a5522879421ae8b49cb704b524b80b2c:docs/acceptance/evidence/C21-CONTINUATION/v1/author-page-transcription.md`。 |
| V | `a1999e353976a133e76cd47caba9e02e75a2e182:docs/research/c21-provider-controls.md`，沿用调查事实，旧 low 重试建议已执行失败。 |
| M | `b0703907a7339513ed34bfed5c1e6787cc65d37d:docs/acceptance/evidence/M42/v1/{author,integration,attempt2,integration2}.md`；产品 `689a194cf004aff37ebb1d495ee061fe7aed2fad`，fixture 补修 `aa8b3ac72cdaeab67ba45ecdfeb01bdc3afcc17b`，均 self，非 M44。 |
| D | `1a5dd015863d749e5244346f4eaad24ac506670d:docs/acceptance/evidence/M40/v1/handoff.md` 及同版 math 契约、架构和 `docs/plans/tasks/math/M43.md`。M40 冻结语义不由本页重定义。 |

## 实现缺口与实验失败分开处理

P 的 201/201 API、真实认证浏览器链和 W 校对到 DOCX 是作者证据，本次只读核查，没有重新运行或升为 independent。README 有未同步的旧状态，当前能力以固定代码与 attempt3 为准。

| P 中实际代码/证据 | 已有能力 | 接续缺口及归属 |
| --- | --- | --- |
| `apps/api/src/workbench/{index,moduleLoader}.js`、`modules/questions/index.js` | 真 File/Preview/Job、模块装配和四 handler；questions 工厂接受可注入 `provider` | composition 的 dependencies 只传 db/mutations/files/content/jobs，没有网络 Provider。handler 存在不等于视觉识别可用。网络传输与唯一组合写权归 R33/R34；不是仅差一个环境变量。 |
| `modules/questions/extraction.js` 的 `createExtractionHandler` | T 原生、W reader、逐页预览/选页、机器结果、已完成单元与显式重试 | 无 provider 时明确 `provider-unavailable`。逐页结果直接追加，未实现选页集合上的续文/答案归并；正常页也不能因此证明完整材料处理完成。 |
| 同文件 `adaptProviderResponse` | 读取 `questions/groups` 的完整对象、保留截断正文、生成可编辑 Document 与疑点 | O 输出契约是 `fragments`，不能直接消费；现实现无答案来源 part 的完整映射，无真实自动题图绑定，缺答案常落 `absent`，不能表达“答案页尚未处理”的整体事实。JSON 可解析不是数学质量证据。 |
| `modules/questions/native-word.js`、`native-math.js` 与 R33 attempt2 | 原生公式/结构转换、W 内嵌图、真实校对入库；W 七项 6/6 self | 可继续原生流程验证。T 按 T 裁决核对已提供内容，三题缺图继续阻断，不再用旧联合 3/6 拦住文字验收。 |
| `modules/lessons/{index,materials}.js` | 同步读取已保存 question/resource 快照，真实取材与六种输出 | 无识别 Provider 调用依赖；也没有 math 注入和 lessons v3。M43 需显式消费 M，P 中既有静态 math 代码不代表已含动态/HTML 或往返。 |

O 的实验 Adapter 也不能整份迁作产品：`scripts/adapter.py` 固定四页 I，虽有角色和唯一答案候选处理，continuation 仍留未分配区，没有证明 E 跨页归并、自动图关联或新四页完整结果。可复用已证局部算法与故障样本，不移植固定页数/题号假设。

## 在线路线裁决与真实缺失输入

本次核对 O 原始 request、response 的正文/元数据、gate 和 ledger：页2为单图、low、8000、非流式；HTTP200、`length`、7998 completion/7809 reasoning、正文440字符，Q3截断且Q4缺失，39.801秒。未读取或复制 reasoning 正文。它是技术 FAIL，不能改称凭据缺失，也不能用本地 Adapter 修复把截断信息补出来。

2026-09-22 公开一手资料复查未补足不同路线的证据：

- [Command Code Provider](https://commandcode.ai/docs/provider)说明 Chat/Responses 格式和 GOAT 的 API 使用计入套餐额度，但未说明该精确模型 `thinking` 开关的接受与转发。已有 GOAT 可沿用，不推定免费或另购服务。
- [DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)说明原厂有 disabled 开关、low 仍属思考模式。这不能越过聚合 Provider 已拒绝 none 的实测，也不是新增信息。
- [Command Code 模型目录](https://commandcode.ai/docs/reference/cli/models)和 [GLM 精确型号页](https://commandcode.ai/models/glm-5-3-flash)没有提供本次可核验的数学图文提取响应。模型可选、文本编程成功不构成 I/PS 质量依据。

| 候选方向 | 当前判断 |
| --- | --- |
| 原生 PDF/布局/本地 OCR 后文本整理 | 可减少 P 中已有文字的重复转录，但 P 当前走页图 Provider；原生读取并不自动保持数学结构，普通 OCR 不能据此补足 I/PS/E。需自身输入的公式、图和边界实证才可取代视觉路线。现有 T/W 成功只支持对应原生输入。 |
| 整页再切题/改提示/升 token/换 effort/stream | 在已失败视觉路线继续换粒度或参数，未出现能说明其解决数学保真的新依据。本次不包装成新窗口。 |
| 关闭思考、换 Responses、换允许的 GLM | 缺精确 Provider 的有效控制或相近图文负载证据；原厂开关和型号广告不足。只能列条件性方向，不能宣称已支持。 |
| 接上生产网络传输 | 是必要实现工作，能够解决“未接线”，不能解决原响应截断及材料质量。当前先完成与传输无关的产品行为，待请求路线有依据再接网络，避免把失败实验固化成默认路径。 |

**本接续裁决新增请求预算为 0，新增 completion/费用许可为 0。** 原账唯一来源为 O 的 `ledger.json`：19次、16份usage、108777已知completion，历史3份usage缺失，online-1预留8000未知继续保留；不是完整费用总额。全部旧窗口关闭，剩余额度作废，不转移到产品验收。

解除在线技术缺口至少需要以下一种新依据，不要求无关项全部到齐：

| 缺失输入 | 提供方 | 足以交 C20/R30 再裁决的内容 |
| --- | --- | --- |
| 同 Provider/精确 ID 的有效控制证据 | Command Code；由有联络权限的根或账户拥有者取得 | 对 `gen_01M347PAWP0WDW1W7A5ZF1BRVA` 的转发/预算诊断，或明确接受且实际生效的限制/关闭思考配置。只给可接受枚举不足。无需交出密钥。 |
| 不同方法的可审计能力证据 | 已有制品提供者或获授权技术验证者 | 相近数学图文输入的请求、输入来源、非空完整正文、usage及逐项质量；或本地原生/数学识别在自身 I/PS/E 上的可编辑数学与图证据。不能从 W/答案表偷补。 |
| 产品调用执行条件 | 根固定新任务；EMODEL 拥有者受控注入 | 仅在上行证据足以选路线后，固定请求体/页清单、计数与 completion 总上限、无隐式重试、既有 GOAT 边界。当前不是要求重交凭据或查询余额。 |

后续有新依据时另给有界调用包，沿原尝试账接续，不自动启用。本次没有可诚实预定的成功请求数。新包必须在空/截断正文、未知结果/usage、模型不符、需整题重录或额外费用信号时停止，不自动换模型；只允许 `deepseek/deepseek-v4.1-flash`、`z-ai/glm-5.3-flash`。最终仍须 F 的逐入口 5/6边界、4/6主要内容及 E 2/3、七项适用质量、真实产品保存入库；正常 stop 不是质量 PASS。

## 零调用的最小产品接续

属于原 R33 职责，不恢复 O 的调用路线。先通过真实上传入口复现旧响应/故障的产品行为，再在同一 extraction Job 内修复：

1. 按本 import 实际选页保存内部片段及来源；机器版与人工版分存。Adapter 只提取正文中真实存在的数学源、题面/选项/小问/答案角色，未知结构保留疑点，不从 reasoning 或其他材料补内容。
2. 对选页集合归并：题号加章节/组别及明确续文证据，双向唯一才关联；答案页未完成、缺页及歧义保持 unresolved/未分配，不先标 absent。来源分别绑定 body/solution 和真实页号，E 7/8不改为1/2。
3. 复用已验证的本原件定位/裁图路径，在本次原件上重新产生资产并绑定来源；不能把模型图描述算成功。对尚无可证明关联的区域保留阻断疑点。成功页持久保留，重试不重复、不覆盖人工结果；取消/重启及迟到结果沿冻结语义。
4. 以明确标记的旧响应重放和合成故障验 Adapter/归并/恢复，另以真实 T/W、F损坏文件走原生/保留路径。产物必须分开“真实原生”“旧响应重放”“合成故障”；本地通过不得计入 P/I/PS/E 新在线分数。若发现只有重新识别才有的缺失内容，到此停止该切片，交上节输入拥有者，不扩写通用识别平台。

只改内部 Implementation，复用 File/Job/Import/Draft/Document/Location 的 Interface；没有证据要求新增公共端点、服务、队列或模型路由层。数学质量不靠完整 JSON、图描述或大量人工录入替代。

<a id="r35-m43-m44-gates"></a>
## R35 → M43 → M44 的限定依赖裁决

这是对 D 中“R35后接真”的限定启动边例外，已经 independent PASS 并由根采纳。节点数量和完整完成门禁不变。派发者必须逐项固定启动输入，不能把裁决 PASS 本身当作为前置已满足的证据。

| 工作 | 可以先完成的明确范围 | 启动输入及仍保留的门槛 |
| --- | --- | --- |
| R35 本地独立切片 | 固定 P 上真实 T/W收题校对、缺图阻断/部分入库、资源预览替换、取材返回、六种输出本机检查、保存失败/账户隔离/保留库重启；T用T判据 | 已有真实候选即可做独立证据采集，无需在线/目标设备。未通过项逐条归属，不能签完整 R35。共享重启异常仍 OPEN；`c915f5939cb9e4102bbc9d84d4b83608b72eda52:docs/acceptance/evidence/R34/v1/restart-diagnosis.md` 只增加了可区分的错误证据，没有证实根因或实施修复。局部 PASS 不消除该观察，受影响重启条目没有独立通过就不能用作下行前置。 |
| M43 本地实现与 self | 真 math + lessons v3、版本快照/采用更新、指定环节往返现场、含math的本地DOCX/PDF、下载物本机断网冷启动、操作清单 | 固定 M、D、P 的真实材料消费切片 independent 通过、公共唯一写权后可启动。该材料切片至少涵盖 File读写、预览/裁图、已确认题/资源快照、备课持久/幂等/隔离/重启、六输出本机内容与过滤。不依赖在线识别算法或 Windows 编辑；若共享异常影响这些项目，相关集成不能通过，可继续不受影响的适配设计。 |
| M44 本地 independent | 在固定 M43 局部候选复现数学准确性、三类作品、往返、源码/隔离、Linux实际下载物冷启动 | 可以独立验本地切片，报告逐项范围与未决；不是 M44 全量启动/放行的替代。完整 M43 仍须收齐完整 R35 independent，完整 M44 仍消费完整 M43 及其支持环境证据。 |
| 在线及目标设备 | P/I/PS/E新在线与真实教师新材料；Word/WPS实际编辑保存、三类PDF打印预览；Windows/Edge离线、PPT/WPS实际插入、Pad/触屏/课堂约定设备 | 在线新证据与调用条件归 C20/R33/EMODEL；材料与Office目标设备归 R35/验收组织者；数学目标设备归 M43/M44。提供具体OS/应用版本、可操作环境和实际制品，不用XML/截图/模拟视口代签。 |
| T51/T53/T54 与后续 | 既有教学设计和局部实现可继续；真实 math 消费者接线可按已冻结扩展准备，设备缺口不阻止其本地设计 | 本接续裁决不改 M44 → T51 完整作品关联 → T54 完整 → F60、F61-F65 及 D70 后交付边。T51-MATH 既有替身 self 不等于真实组合。F60 可整理已有契约/缺口输入，冻结/下游启动仍按原门槛；不新开业务节点或以准备稿假称完整可靠性设计通过。 |

M43组合后必须验证空库、P保留库副本、已有M作品库迁移/重启；旧v2含math拒绝有损操作、旧未知请求沿原路径确认、静态引用不随源更新改变。后到在线修复由唯一写者在新固定候选显式组合，针对 questions→lessons快照/输出、Job/共享入口和受影响场景回归；旧切片不能改名冒充新候选验收。

## 冻结影响与执行边界

T澄清、现状核对、零调用内部修复及原门槛本身**无需新产品语义冻结**。若实现必须改公共字段/状态，则列具体不兼容点回 R30/M40，按受影响双方重冻结；本页不预授权。

限定 independent 核验已确认 P/M 真实接口闭包、材料消费切片、共享异常影响、唯一写者/迁移旧库/版本回归、M44 局部报告边界以及在线/设备/下游完整门槛之间无环且可执行。后继任务以实际回执逐项证明前置；新的局部候选或诊断证据不自动继承 PASS。完整 M44 仍须支持 T51 完成真实作品关联，再由 T53 汇合至完整 T54，随后才是 F60、F61-F65 与 D70 后交付链。
