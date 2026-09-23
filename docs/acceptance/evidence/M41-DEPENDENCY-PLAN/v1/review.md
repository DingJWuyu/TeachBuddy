# M41 基础依赖独立核验

**independent PASS**。固定提案允许的新增启动边有实际端口、类型和装配依据，未发现阻断该限定边的设计缺陷。冻结仅允许隔离 M41 实现和切片自验，不表示完整 R31/M41 通过，不放行 M42/M43，也不授予正式产品启动权限。

## 固定对象

| 输入 | 完整版本与读取位置 |
| --- | --- |
| 提案 | `2e67961b01f4ce90ab07dad1feb823b1f595266d:docs/arch/math-foundation-dependency.md`；源 `/home/liam_t/项目/TeacherWorkspace-m41-dependency` |
| 作者回执 | `76151489f28cfe1ccaddd8afa28db3c613f3c6a5:docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/author.md`；同源，提案 blob 未变 |
| R31 产品 / 证据 | `5f696b8ce611e67d940ce149ce13946a50b65510` / `c08fa62d434efffc89b471151faa73308e3ce716`；提案输入表的 workbench 源码、fixture、README 和 R31-FOUNDATION/v1 的 author、integration、hashes、production-refusal |
| M40 冻结 | `1a5dd015863d749e5244346f4eaad24ac506670d`；handoff、math 架构/契约/schema/cases/samples、math-evidence、M41-M43 任务包和 README |
| 材料先行计划 / 独立报告 | `68f66587d4d625ee9c8f75516eafa61913b57e40` / `0fb32a6e31d4ea0a6673bcce15423137a9a68b0a`；materials-next 与 MATERIALS-NEXT-PLAN/v1/review.md |
| 唯一材料 schema / 端口 | `8d48af595b1d80a9169d8db55ee7c8969b60c605`；docs/arch/materials.md、materials.openapi.yaml 及 first-flow.openapi.yaml |
| 身份契约 | `6f3003250d170b44e89f6ac9b0a74f91d658a357:docs/contracts/auth.md`；页面绑定及可信 principal |
| 规则 | `d4fcdf05a03235a4b3cfeb285f175592a4babd68:docs/acceptance/mvp-matrix.md#design-review`；另按用户指定源读取 execution-protocol 的 acceptance/receipt 及 writing-for-agents |

以上代码/文档均通过固定 SHA 的 Git blob 消费。M40 的既有设计和 C23 修正冻结结论按 handoff 与 math-evidence 继承，本轮不重审数学设计、不重跑实验。B16 版本及独立结果按 R31 固定交接继承，不新增 B16/R31 全量验收。

## 逐项判断

以下路径分别相对于表中 R31 产品或 M40 冻结版本；PASS 表示依赖设计依据成立，不是对应功能运行通过。

| 核验项 | 结论、证据与边界 |
| --- | --- |
| 新启动边 | PASS。R31 `apps/api/src/workbench/index.js#createWorkbench` 向 loader 注入真实 `{db,mutations,files,content}`；初始化顺序为发现、迁移、文件初始化、模块实例化。M40 `docs/arch/math.md` 的工厂消费同一组依赖，math 无必需业务端口。文件/内容构造与存取路径不调用 Office、识别、Preview 或 Job。原材料独立报告明确排除 M41，因此本报告是新增限定裁决，不是旧 PASS 的扩大解释。 |
| 类型闭包 | PASS。唯一 math schema 中 FormulaSource、PlaneSource、SpaceSource 的传递类型均为本地源/图形类型，不含 Document/Job/Preview/Import/Resource；caption 为普通字符串。WorkExport.File 外引唯一材料 File，R31/M40 的材料及 first-flow schema 与固定输入逐字一致。content.validate 接收 Document，不能拿它校验 FormulaSource。 |
| 保存和回读 | PASS。`files/index.js` 的 store 处理真实字节、fsync/rename、元数据及成功回执；read 同步检查账户、长度和摘要，open 提供实际流。`mutations.js` 真实 SQLite 事务要求同步回调，账户级键绑定请求。M40 已将渲染/异步 store 放到作品事务外，再复核版本并保存 Source/Revision/回执。文件内部键与用户作品键分离可避免先存文件占用作品键。这里有可实现并验证的持久闭环，但当前 math 三个产品目录为空，没有现成数学保存 PASS。 |
| 隔离装配 | PASS。`moduleLoader.js` 支持工厂及独立 migrations thunk；`migrations.js` 接受 math 前缀并保留 ledger。`moduleCatalogValidation.js` 允许合法 math 描述符和空 requires，无须扩公共端口枚举。`app.js:81,107` 可接构造好的 workbench 并挂真实 filesRouter。独有 fixture 可复用实际模块，不必改生产目录。当前 catalog 投影仍是 version=1，不能将测试注入声称为生产 version=3。原 materials fixture 的 document 表不能替代 math 聚合。 |
| production 四 handler 拒绝 | PASS。`workbench/index.js:32` 在 production 无条件拒绝当前基础候选；`identity.js#assertWorkbenchRuntimeConfig` 同时拒绝生产测试身份及目录覆盖。既有 production-refusal.log 与源码对应，但日志仍是 R31 作者 self。M41 无权改这些公共入口或绕过拒绝，不通过 development 配置提供正式部署。 |
| 页面身份 | PASS，作为明确保留的缺口。`identity.js` 的测试 Cookie 映射及 `http.js#createGuards` 只保证 principal/accountKey，没有 PageContext 绑定或过期会话校验。M40 MC09 和认证契约要求的无页面/失效拒绝尚未具备。认证产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf` 与本地独立报告 `aaa3d77accbfc743f47edfb1ffc385735b2bf3db` 不自动装入 R31；前者不是该 R31 祖先，实际源码也未接其 adapter。认证/A11 提供固定输入，公共写者串行装配，M41 回归消费。不得据外部分支报告补签 MC09。 |
| MathJax、字体、构建 | PASS，作为明确待交付输入。产品 manifests/锁无 MathJax，已有 KaTeX 不能替代 M40 冻结的本地 MathJax 3.2.2。公共唯一写者交所需包、字体/离线资产及公共构建支持的固定 SHA 和受影响构建结果；M41 在独有 fixture/模块边界消费。跨公共配置的需求仍交公共写者，不借私有锁、嵌套 workspace、系统依赖或其他活动树 node_modules 绕过。未到输入时只做不依赖它的源/事务/图形工作，不签实际渲染通过。 |
| 文件输出边界 | PASS。字节检测对未识别 UTF-8 回退 text/plain，故 SVG/JSON 不能只按 MIME 推断成功；应验格式、原字节及合法文件名。`files/router.js` 保留 attachment、nosniff、sandbox；content 图片只接受 PNG/JPEG/WebP，固定 PNG 海报满足接缝。SVG 不进入主应用 DOM。真实下载/目标取用兼容性归后续实测，若失败回 R31/M41，不降低契约。 |
| 写权与依赖支持 | PASS。M41 仅拥有 math 三目录、原包指定测试、独有 fixture 与本节点证据。manifest/锁、底座和公共入口继续由当前公共唯一写者持有，支持任务由外层串行安排并交固定候选；支持与 Office 成功无逻辑依赖。M41 不代改源文件，R31 完整交付前不转移其公共所有权，R31→R34→M43 与 T53 互斥保留。 |
| 后续门禁 | PASS。M41 完整完成条件、自验固定 SHA 和停写交接后才接 M42；切片 self 不满足此边。M43 必须收 M42、R35 independent PASS 的受测材料候选及公共写权；M43 self 后仍由 M44 独立验证。R30 两 REV、剩余转换、完整 R31、真实认证/A12、目标设备与最终产品门槛均未关闭。 |

## 获准范围与交回条件

外层可按提案“冻结后 M41 先行派发补充”派隔离 M41，固定本报告、提案、作者回执、R31 产品/证据、M40 冻结、唯一 schema 和模块独占权。仅覆盖旧任务包中完整 R31 对隔离实现/自验的启动限制；调度入口同步由外层完成，本报告不修改 DAG 或根台账。

可立即推进 math 模块内源校验、作品/历史版本、事务及端口、无需缺失资产的图形实现和独有 fixture。依赖 MathJax/字体/公共构建的制作与真实导出，必须先消费公共唯一写者固定交付；缺少它们不妨碍独立部分开工，但相应验证保持待接。M41 不取得 manifest、锁或公共装配写权。

后续切片完成须实际走 UI/HTTP 制作、保存、File 字节及 math Source 回读、保留库重启、历史不可变、未知请求同键确认、冲突、跨账户和故障恢复。真实输出核对透明度、中文/标签和数学位置，不能以只导图、stub、源码扫描或旧实验样图代替。这些是提案与 M41 原包的待执行条件，本轮没有运行。

完整 M41 还须页面绑定/失效等原全项消费验证；认证/A11 和公共写者交输入后由 M41 回归。仅切片通过时回执必须写“整体未完成”，不能启动 M42。完整 R31 及正式四 handler、R35 材料独立验收、M43/M44 与目标设备继续归原节点。

## 实际检查与回执

[static-checks.txt](static-checks.txt) 记录本次独立静态结果：提案与作者提交同 blob、R31 产品至证据提交仅增证据、31/31 摘要一致、两份材料 schema 的版本一致、三个 Source 的传递闭包、产品 MathJax 缺失和认证祖先关系。另人工追踪上表源码及固定契约/任务包。最初路径检查使用 Git 默认引用格式导致中文路径断言失败，改用 NUL 分隔后确认全部为证据路径；不是产品失败。

未运行产品、浏览器、测试套件、构建、模型或 C21/C22/C23。没有追加 R31 全基础验收，摘要一致不升级作者 self。仅新增本报告与独立静态证据，无临时文件；未派内部助手或业务 session，未向其他 session 回调，未合 main/push/部署。

```yaml
task: M41-DEPENDENCY-REVIEW@1
revision: 1
attempt: 1
role: acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-22T07:50:55Z"
session_id: "01a0c813-49a7-7532-89ae-652ff3ae08a3"
runner: "Codex CLI / gpt-6-astra / medium"
skills_used: [writing-for-agents]
base_revision: "c6b3b1505cd5eae868b600827cac568a316b3c26"
result_revision: "本报告所在提交:docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/review.md；完整提交 SHA 由最终回执固定"
reviewed_proposal: "2e67961b01f4ce90ab07dad1feb823b1f595266d"
author_receipt: "76151489f28cfe1ccaddd8afa28db3c613f3c6a5"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs: "本报告固定对象表；按固定 SHA 读取"
changed_files:
  - docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/review.md
  - docs/acceptance/evidence/M41-DEPENDENCY-PLAN/v1/static-checks.txt
artifacts: "本报告及同提交 static-checks.txt"
checks: "逐项判断表与 static-checks.txt；报告 git diff --check、禁用字符及授权范围检查"
identity_mode: "不适用：静态依赖设计核验；后续隔离切片仅 test-principal"
open_items:
  - "公共唯一写者固定交付 MathJax 3.2.2、所需字体/离线资产及公共构建支持后，M41 才消费相关渲染输入"
  - "认证/A11 固定页面身份输入，公共写者装配，M41 回归 MC09；外部认证报告不替本候选签字"
  - "M41 真实实现/持久回读/故障与输出验证、完整交付和停写仍待完成，不能派 M42"
  - "完整 R31/R35、M43/M44、真实产品及目标设备门槛保持"
failure_owner: null
next_condition: "外层固定本报告完整 SHA，按获准范围同步限定启动边并派隔离 M41；公共支持未到则显式列待接项"
authorization_used: "用户 M41-DEPENDENCY-REVIEW@1 / attempt 1；仅本分支新增 review.md 及必要独立证据并提交；源/旧报告/产品/其他 worktree/DAG/根台账只读；唯一回调由外层负责"
```
