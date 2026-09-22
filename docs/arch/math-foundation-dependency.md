# M41 文件基础依赖裁决

状态：`M41-DEPENDENCY-PLAN@1 / attempt 1 / READY_FOR_REVIEW`。建议允许 M41 在真实 R31 基础上先做隔离模块实现与自验；本页尚未独立冻结，不是启动许可、产品 PASS 或 R31 完成声明。

本轮完整版本、UTC、session/model 和自检记录见[作者回执](../acceptance/evidence/M41-DEPENDENCY-PLAN/v1/author.md)。

老师可先得到有实际价值的闭环：制作公式、函数或几何图，保存源和固定海报，关闭服务后重开修改，下载本版本 PNG/SVG/源码。这个闭环不读取 Office，不自动识别材料，不调材料 Job，也不必先有备课六种输出。已有代码足以提供其持久存取依赖；数学制作本身仍须实现、实测。

**裁决：完整 R31 不是上述隔离工作的技术前置；固定文件基础、数学冻结契约、独占写权和真实验证入口才是。** 当前候选不能启动正式产品，且缺 M40 所需页面身份适配和产品渲染依赖。允许先行不等于 M41 全项完成，更不提前放行 M42/M43。依赖变更只由外层取得本页限定 independent PASS 后生效。

## 固定输入与读取方式

以下 SHA 是输入身份，路径是定位入口。源树 HEAD 不匹配时使用 `git -C <源树> show <SHA>:<路径>`，不消费活动分支。外层建立下游组合候选时固定完整新 SHA，不把文档提交当产品提交。

| 输入 | 完整 SHA 与入口 |
| --- | --- |
| R31 基础产品 | `5f696b8ce611e67d940ce149ce13946a50b65510`，只读 `/home/liam_t/项目/TeacherWorkspace-r31-foundation`；`apps/api/src/workbench/{index.js,files/,content/,identity.js,http.js,mutations.js,migrations.js,moduleLoader.js}`、`scripts/materials/fixture.mjs` |
| R31 作者证据 | `c08fa62d434efffc89b471151faa73308e3ce716`；同树 [author.md](/home/liam_t/项目/TeacherWorkspace-r31-foundation/docs/acceptance/evidence/R31-FOUNDATION/v1/author.md)、[integration.md](/home/liam_t/项目/TeacherWorkspace-r31-foundation/docs/acceptance/evidence/R31-FOUNDATION/v1/integration.md)，以及同目录 `hashes.json`、`production-refusal.log`。仅 self |
| M40 冻结交接 | `1a5dd015863d749e5244346f4eaad24ac506670d`，只读 `/home/liam_t/项目/TeacherWorkspace-m40`；[handoff.md](/home/liam_t/项目/TeacherWorkspace-m40/docs/acceptance/evidence/M40/v1/handoff.md)、`docs/plans/tasks/math/{README,M41,M42,M43}.md`、`docs/arch/math.md`、`docs/contracts/workbench/math.md` 及 `math/{math.openapi.json,cases.md,samples.json}`、`README.md` |
| M40 设计与独立依据 | 设计 `a6a495a7df6a870f455a431a2ac4169c79a37504`；原 review `3da472ed10b87a18c7923eee97ce9b154ca76706`；C23 固定修正 `d1490531e014ef437374c2f5a23cf3073baeef56`；三项修正 independent PASS `b01bc73954cbbc13e464738e0f6f8aa6c6f12084`。按同树 `docs/arch/math-evidence.md` 消费，不以旧契约页头的候选状态覆盖冻结交接 |
| 材料先行裁决及独立报告 | `68f66587d4d625ee9c8f75516eafa61913b57e40`、`0fb32a6e31d4ea0a6673bcce15423137a9a68b0a`；只读 `/home/liam_t/项目/TeacherWorkspace-materials-next` 的 [materials-next.md](/home/liam_t/项目/TeacherWorkspace-materials-next/docs/arch/capability-checks/materials-next.md) 与 `docs/acceptance/evidence/MATERIALS-NEXT-PLAN/v1/review.md`。原冻结明确未许可 M41，本页是新增依赖提案 |
| 材料唯一契约 | `8d48af595b1d80a9169d8db55ee7c8969b60c605`；`docs/arch/materials.md`、`docs/contracts/workbench/materials.md`、`materials.openapi.yaml` 及其 `first-flow.openapi.yaml` 引用；从上述 Git 源读取 |
| B16 继承输入 | 产品 `612f0a9868743a1d5eea7e6f236d3ff903752439`；独立报告 `d1ef0d5af8478677c04e6dd42bd3346f7883d1d0:docs/acceptance/evidence/B16/v1/attempt2.md`。R31 已固定其集成来源；不是待用户重供的输入，也不是 real-auth 证据 |
| 身份契约 | `6f3003250d170b44e89f6ac9b0a74f91d658a357` 的认证 `1.0.0-rc.2`、工作台 `0.1.0-candidate.2`；M40 明确消费 `docs/contracts/auth.md` 的页面绑定和工作台 `resolvePrincipal` 交接 |
| 本轮调度与规则快照 | `d4fcdf05a03235a4b3cfeb285f175592a4babd68`，只读 `/home/liam_t/项目/TeacherWorkspace-mvp` 的 `docs/plans/{mvp-dag.md,run-state.md,tasks/math.md,tasks/materials.md,execution-protocol.md,skill-routing.md,task-package.md}`，以及 `docs/acceptance/mvp-matrix.md#design-review`。当前仍要求完整 R31；本页不改这些文件 |

本次核对：R31 产品到证据提交只增加该任务证据；R31 与 M40 中 `materials.openapi.yaml` 及其 `first-flow.openapi.yaml` 均与固定材料输入逐字一致。R31 的 31 个证据摘要全部匹配。这只证明材料绑定和完整性，没有把作者自验升级为独立产品证据。M40 与 R31 的 README 均未声称真实 MVP 完成；其他分支认证进度不能自动成为本候选能力。

## 实际接缝与不可越过的缺口

下表的代码位置均以 R31 产品 SHA 为准，数学需求以 M40 冻结交接为准。结论是静态核查，本轮未运行任何产品、测试、浏览器、模型或实验。

| 需求 / 实际位置 | 核查所得 | 对先行工作的影响 |
| --- | --- | --- |
| `createWorkbench`，`workbench/index.js` | 返回真实 `db, mutations, files, content`；初始化先迁移再实例化，files/content 构造不读取转换器或 Job | 可向 `createMathModule({db,mutations,files,content})` 注入真实依赖；没有必要等待 Office/识别 |
| `files/index.js` 的 `store/read/open` | store 完成本地字节检测、staging、fsync、rename、元数据与幂等回执事务；read 同步校验所属账户与文件摘要，open 返回真实流；不产生 Preview/Job | 可持久保存 PNG、SVG、JSON 及后续 HTML。作品/历史版本归 math，不能借 File 元数据代替作品源。冲突遗留 File 按原契约保留 |
| `content/index.js` 的 `validate` | 同步校验 Document v1/v2、受控图片归属/可读性及结构；无 LaTeX 到 OMML、识别或自动定位调用 | M41 的 Formula/Plane/SpaceSource 本身不含 Document，caption 是普通字符串；Source 由 math 唯一 schema 校验。工厂保留已定 content 注入，处理 Document 时才调用，不把 FormulaSource 当 Document 或新增第二套内容保存服务 |
| `mutations.js` | 成功重放与业务写事务是真实 SQLite；write 回调必须同步，Promise 明确拒绝；键作用域为账户全局 | 渲染和 `files.store` 在作品事务外完成，提交时复核版本。文件内部键与用户作品/导出键分离且可重试，不能用同一用户键先存文件再写作品；按 M40 的原顺序处理重放和冲突 |
| `moduleLoader.js`、`migrations.js`、`createApp` | 测试支持 `catalogOverride/extraImplementations`；math 无必需业务端口，可用 `requires: []`。现有 runner 接受稳定 `math_*` 迁移；`createApp` 可消费已构造 workbench | 独有 fixture 可装配真实 math、真实文件路由和 SQLite，并走同一 HTTP/port 实现。测试目录覆盖不是生产 version=3 注册，不扩共享 port 枚举；迁移必须在首次请求前完成并保留原 ledger |
| `workbench/index.js:32`、`identity.js` | production 当前直接拒绝四 handler 未齐；production 同时拒绝测试身份和目录覆盖。拒绝日志已存在 | 只准非生产隔离 fixture。M41 不改拒绝分支，不伪造 preview/extraction/export/question-asset，不把 development 配置当部署路径 |
| `identity.js`、`http.js#createGuards`，M40 MC09 | 基础身份以服务端测试 Cookie 映射 accountKey；守卫不验证 `X-TeachBuddy-Page`。M40 要求无页面绑定/过期身份拒绝 | 是本固定组合的真实缺口。无 Cookie、跨账户测试可先做；页面绑定/失效/刷新恢复不得据此签 PASS。归认证/A11 真实 adapter 与公共写者集成，M41 只按契约消费 transport/principal，不自造认证服务 |
| manifests/锁、M40 renderer 选择 | R31 有 sharp、schema 工具和前端 KaTeX，产品依赖未包含 MathJax。M40 冻结本地 MathJax 3.2.2；C23 有实验依赖不等于产品已装配 | 公共写者需固定所需依赖/构建资产。可先做不依赖该资产的源、事务、图形工作；相关真实渲染未能运行就留待接，不用样图、KaTeX 替换或 CDN 冒充完成 |
| `files/index.js#detect`、`files/router.js` | MIME 按字节检测，不信调用者 mediaType；未识别 UTF-8 回退 text/plain，故不能假定 SVG/JSON 已返回专用 MIME。下载强制 attachment、nosniff、sandbox；Document 图片只接受 PNG/JPEG/WebP | `WorkExport.format`、原字节和合法扩展名共同核验输出，不能只看 MIME/后缀宣称正确。固定 PNG 海报满足内容图片边界；SVG 不作为 Document 图片或注入应用 DOM。若真实目标下载/取用暴露兼容缺陷，归 R31/M41 修复并重验，不改契约或放宽执行权限 |

R31 现成 `scripts/materials/fixture.mjs` 只挂载文件/文档基础及旧模块，没有 math；其 `/fixture/document` 表不能作为数学保存入口。M41 要在自己的 fixture 中挂载将交付的真实 math Module。可以复用底座测试注入接缝，不能复制一份仅供演示的业务实现。当前三个 math 产品目录为空，尚不存在可复用的数学产品 PASS。

## 写入所有权与依赖支持

沿用 M40 `docs/arch/math.md#分阶段写权`，只增加本次启动例外，不改变业务/公共契约或产品范围。R31 与 M41 在各自隔离 worktree、数据库、文件目录和端口推进；不共享可写数据库，也不从另一活动 worktree 的 node_modules 取依赖。

| 唯一写者 | 写入集合与交回 |
| --- | --- |
| M41 | `apps/api/src/modules/math/`、`apps/web/src/features/math/`、`packages/shared/src/math/`；原 M41 `math-static*`/`math-contract*` 测试、独有 `fixtures/math-static/`、`docs/acceptance/evidence/M41/v1/`。fixture 的启动/构建配置放独有 fixture 边界；必要时在派发包固定具体位置，不占 `scripts/materials/`。只读材料、认证、C23 和冻结 schema |
| R31 当前公共写者 | 继续独占文件/内容底座与原 R31 公共范围。M41 所需依赖支持交 `integration.md`，由外层安排该唯一写者：根 `package.json`、`package-lock.json`、`apps/api/package.json`、`apps/web/package.json`、`packages/shared/package.json`。锁文件用包管理器生成；依赖支持不准启用未冻结转换能力。交回独立固定 SHA 和受影响构建检查后 M41 才消费 |
| 公共装配当前写者，后续交 M43 | `packages/shared/src/{index.js,moduleCatalog.js,moduleCatalogValidation.js}`，`apps/api/src/{app.js,server.js,core/moduleRegistry.js,workbench/index.js,workbench/moduleImplementations.js}` 及 workbench 直接子级迁移/身份/HTTP入口；Web 的 App/main、模块目录、外壳、侧栏、store/hooks/api/global.css，以及 Vite、Playwright 公共配置/helpers/api-server 和 README，逐项范围以 M40 架构清单为准。M41 均无写权。认证内部归原负责人，外层串行接入，不把 R31 写权扩为认证业务权 |
| M42 / M43 | M42 仅在 M41 全项交付固定并停止写入后接 math 骨架；M43 收 M42、R35 和独占交接后接公共装配、lessons v3 和 math 往返。R31 完整交付前不移交其公共所有权，原 R31 → R34 → M43 交接及与 T53 的互斥保持 |

没有独占交接时，M41 继续模块内可验证工作并列具体待接项；不靠新增嵌套 workspace、私有锁或临时系统依赖绕过写权。公共依赖支持与 Office 成功无逻辑依赖，但仍须外层安排固定候选和单写者；本页不派该工作。

## 提议修改的依赖边

这是一条启动边的限定变更，不新增业务 DAG 节点，也不重开 M40 既有冻结结论。

| 当前边 / 位置 | 独立冻结后的确切变化 |
| --- | --- |
| `R31 --> M41`，`mvp-dag.md` 数学图、阶段 4/M41 行及并行边界 | 拆清启动条件：`R31 固定基础候选 + M40 冻结 + 本裁决 independent PASS + M41 模块独占权 -> M41 隔离实现/自验`。完整 R31 不再阻止这部分启动；正式产品组合仍需完整 R31，不能删掉完成/启动完整性要求 |
| `M40 --> M41` | 保留；只消费本页固定的冻结设计及实验交接，不用实验源树代替产品依赖 |
| `M41 --> M42` | 保留完整 M41 候选、自验条件与停写交接；本次部分自验不满足此边。不会因 R31 基础到达或存储片通过就并派 M42 |
| `M42 --> M43`、`R35 --> M43`、`M43 --> M44` | 全部保留。R35 必须是 independent PASS 的受测材料候选，File 接缝或 R31 self 不能代替 |
| R30 到剩余 R31，以及 R31 到 R32/R33/R34 | 全部保留：两个 REV 关闭、R30 整体 independent PASS 才接剩余转换；完整 R31 后才按原材料包接消费者。基础与数学先行均不关闭原 REV |

外层冻结后需要同步的**调度入口**：`docs/plans/mvp-dag.md` 的阶段 4 概览、材料/数学并行边界、图中 R31/M41 边、R31/M41 行；`docs/plans/tasks/math.md#设计输入` 与 `#m41`；`docs/plans/tasks/materials.md#r31-基础分段启动` 中仅 M41 例外；根 `run-state.md` 只记录新门禁/回执。下游派发包显式引用本页覆盖旧 math README/M41 包的完整 R31 启动要求；旧 M40/材料设计、旧作者/独立回执保留原文。本 session 不写上述任何文件。

## 验证入口与完成边界

后续必须从真实 UI/HTTP 开始验证，不能只运行内存服务或 port stub。本轮只列可复现要求，以下均是待执行，没有新 PASS。

1. **隔离与来源**：固定引入 R31 产品、M40 契约、必要公共依赖支持 SHA，记录组合候选。在独有 fixture 实例化真实 math，等待底座和 `math_*` 迁移完成；挂真实文件 HTTP。参照 R31 integration 的持久目录/保留重启方法，使用本节点目录和端口，不修改/运行源树。身份明确记 `test-principal`，未到的页面认证项单列。
2. **保存不是导图**：浏览器从空稿制作、修改、保存有效 formula/plane/space；公共 HTTP/port 共用 math 业务路径。通过 File 入口回读海报/导出字节及摘要，通过 math API 回读完整 Source 和不可变旧 revision；停进程、用原库和文件目录重启，重新进入仍能编辑。错误公式可保存 invalid、poster=null；后续修正产生新版本，不能继续使用旧图冒充新源。
3. **真实失败与迁移**：空库及 R31 旧库迁移，连续保留启动两次，旧 File/Document/题目/备课/幂等响应不变。实测 SQLite/文件故障、缺失字节、响应丢失同键确认、键异体、版本冲突和另账户读取；查作品版本、File 和成功回执，失败不报告保存成功。文件已写但作品冲突时允许未引用 File，不删除原件。基础 self 不能替这条 math 消费路径签字。
4. **实际导出**：检查透明 PNG 的 alpha、中文和标注裁切、SVG 数学位置及源码同源；覆盖 M40 MC01/02/08/09/13、WB-MA001至004/015至017 的适用部分。Q2 修改后顶点 `(1,-3)`、零点 `1±sqrt(3)`，Q5 标注与 Q6 棱线按固定独立预期核验。目标 PPT/WPS 实际插入归后续设备证据；保存 SVG/PNG 文件本身不等于 Office 已验。
5. **命令和证据**：沿 M41 包运行 `node --test apps/api/test/math-static*.test.js apps/api/test/math-contract*.test.js`、真实浏览器 `math-static*.spec.js` 及共同 API/build 检查。独有 Playwright 配置可用 `--config` 显式指定并给真实命令，不修改共用配置或以空 glob 通过。回执绑定 SHA、身份模式、端口/数据目录、重启步骤、请求/读回、截图目检和下载物摘要；fixture 启动真实业务，不对缺失 handler 返回成功。

| 交付层级 | 尚缺条件与归属 |
| --- | --- |
| 本依赖提案可执行 | 独立 reviewer 对固定提案核验下节范围并 PASS；外层同步限定边、固定派发输入/写权。作者 self 不满足 |
| M41 先行工作 | 真正实现上列模块闭环、所需 MathJax/字体/构建依赖、真实持久性与数学输出证据，归 M41 与当前公共写者；当前还没有 math 产品实现。阶段回执可记切片 self，M41 整体仍未完成 |
| 完整 M41 节点 | 原 M41 包全项，包括 MC09 的无有效页面/失效身份拒绝、跨账户、重启、历史/重放、全部静态作品及导出；固定候选与停写交接。页面适配由认证/A11 提供固定真实输入、公共写者装配，M41 回归消费行为；仅旧 Cookie fixture 不能宣称满足。完整 M41 模块自验也不等于正式产品或 real-auth 独立验收 |
| 完整 M42 | 原 M41 完整交接到齐后，由 M42 顺序实现动态源、HTML 原件/修改件、隔离恶意样本、真实下载物冷启动并回归 M41；共享依赖仍须单写者。它不需要新增材料 Job，但本页不授权跳过 M41 或把部分成果当完整输入 |
| 完整 M43 / M44 | M42、R35 independent PASS 固定材料候选和公共写权到齐，接真实 lessons v3、采用快照/返回现场、含 math 的 Word/PDF 与最终离线产物；M43 self 后 M44 独立真实用户流程。Office/识别/Job 的间接依赖经完整 R31/R35 保留 |
| 真实产品与目标环境 | 正式四 handler 真实绑定且启动检查通过、真实认证/A12、最终用户与产品验收，以及 Windows/Edge、PPT/WPS、触屏/课堂设备证据按原责任保留。本文没有消费到这些新证据，不据其他 README 的进度文字补签 |

基础问题由 R31 处理，数学实现问题由 M41/M42 处理；公共契约确需变化归 R30/M40 新 revision 和受影响独立冻结。测试身份的已知限制不诊断为 Office 阻塞，也不能隐藏为已通过的认证场景。

## 最小后续任务包

**限定独立核验**：由外层另派 Codex CLI / gpt-6-astra / medium，固定本提案提交与上表输入。只核对新增依赖边、实际调用/类型闭包、production 拒绝、页面身份缺口、MathJax/公共写权、真实保存回读可验证性及完整交付门禁。核验结果写 `docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/review.md`（待生成），逐项 PASS/缺口/归属，verification_level=independent。不重跑 C21/C22/C23，不追加一次 R31 全基础重复产品验收，不代替后续 M44；发现事实不足就明确阻断对应边。本作者不派 reviewer、不自行冻结。

**冻结后 M41 先行派发补充**：仍属 M41，不新增业务节点。Codex CLI / gpt-6-astra / low，覆盖旧包的 dsh 路由；固定本提案及其独立报告完整 SHA、R31 产品/证据、M40 交接、材料 schema、所需依赖支持 SHA（若未交付则明确待接范围），以组合提交作为实现/内部 code-review 基线。工作边界取本页所有权表；目标是上节真实制作保存回读切片，未满足的原 M41 完成项逐条保留。

必读：本页；固定 M41 包及其 UX U-MA0/1/2、契约共同协议/作品源/导出、MC01/02/08/09/13、WB-MA001至004/015至017；M40 架构分阶段写权；R31 integration 的端口/运行/迁移；材料四个端口；当前执行协议 implementation/ownership/receipt 与项目设计验证规则。实现完成后按当前 skill 路由进行一次内部 code-review，报告仍为 self，不派业务 session。

交回 `docs/acceptance/evidence/M41/v1/{author,integration}.md`，逐项区分通过、待公共支持、待真实身份/正式组合和目标设备；仅验证了切片就明确 `M41 整体未完成`，不能据切片推进 M42。下一步由外层按缺口归属接续，唯一回调亦由外层负责。不授予 main/push/部署、新产品模型或实验权限。
