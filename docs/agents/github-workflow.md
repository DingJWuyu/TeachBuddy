# GitHub 协作与发布

接手开发、创建 PR、维护 GitHub 配置或准备发布时读本页。本页是协作规则的唯一依据；当前授权、未完成事项与验收证据在[运行台账](../plans/run-state.md)，产品运行条件在[SETUP](../SETUP.md#正式部署)。

## 开发主线

`preview/integration` 是唯一日常 trunk，也是 GitHub 默认分支；`main` 是稳定发布分支。日常开发从最新 trunk 创建短期分支，不直接在 trunk 或 main 上改代码。版本准备自动提交 trunk 是发布流程的专用步骤。

```text
trunk：preview/integration
  |
  +--> 小修小改 / 纯文档 / GitHub workflow 改动
  |      创建临时 branch，无 worktree
  |      开发 + 必要本地验证
  |      直接合回本地 trunk
  |      验证合并后的 trunk，删除临时 branch
  |      不提开发 PR；验证后允许 push trunk
  |
  +--> 其他需要 worktree 的开发
         |
         +--> 完整改动目的 A --> 一个或多个 branch / worktree
         +--> 完整改动目的 B --> 一个或多个 branch / worktree
         |                       开发 + 自测 + 按需 code-review
         |                       开发期间禁止 PR，可多次 commit
         v
       总控接收已完成的改动目的，不等整批任务结束
         |
         同步 trunk，对齐最新基线，核对已有验证与待补缺口
         |
         +--> 目的 A 的集成 PR --> 独立 PR review + PR CI
         |                            |
         |                       squash 合回 trunk
         |                       清理 A 的 branch / worktree
         |
         +--> 目的 B 对齐更新后的 trunk
                    |
                  集成 PR --> 独立 PR review + PR CI
                                  |
                             squash 合回 trunk
                             清理 B 的 branch / worktree
                                  |
                                  v
                                trunk
                                  |
                           继续开发或准备发布
```

## 任务与 PR

已授权任务按[当前授权](../plans/run-state.md#工作现场与授权)持续执行。用户指定工作方式时照做；总控先按下列规则分流，小修小改、纯文档和 GitHub workflow 改动统一使用临时分支，其余任务按敏感程度、并行和隔离需要安排 worktree。其他敏感改动不按改动行数伪装成小改。GitHub 不判断改动大小或 worktree 的使用情况，这个边界由 agent 遵守、总控把关。

- **小修小改、纯文档、GitHub workflow 改动走同一路径。** 从最新 trunk 创建临时 branch，无 worktree，不直接在 trunk 修改，也不提开发 PR。完成改动及必要验证后直接合回本地 trunk，验证合并结果，再删除临时 branch；允许同步远端。GitHub workflow 任务的配套配置与文档随同处理。正式发布仍沿 Release PR 流程。
- **开发 PR 只用于其余 worktree 任务的集成。** 没有 worktree 集成的 commit、merge 禁止开发 PR，不为开 PR 刻意创建 worktree。普通代码的小改若依赖远端环境才能完成必要验证，由总控重新归入 worktree 任务；纯文档和 GitHub workflow 改动需要云端验证时按现有授权使用手动工作流入口，不因此创建 worktree 或 PR。有未提交的改动先完成或留在其临时分支，不带入其他集成或版本准备。
- **允许 PR 的任务，一个完整改动目的对应一个 PR。** 默认每个完整改动目的一条 worktree；同一目的需要多个 worktree 时由总控汇总为一个集成候选。独立目的分别开 PR，谁先完成谁先集成。同一目的的连续修补、多次 commit、测试及文档不另拆 PR，不按次数或天数定频率。
- **大功能可以分批集成。** 每批有清楚、可验证的改动目的，既有能力继续可用；尚未开放的能力已有开关或占位，不能先暴露半成品再补隐藏。
- **Issue / Spec / Tickets 按需使用。** 已有则沿用；没有时以用户确认的任务目标和对话为规格，不为流程补造 Issue。需要时沿[Issue 约定](issue-tracker.md)及既有 skills 执行，正文使用对应 skill 自带的格式。

准备远端集成时先 fetch、核对两端增量，保留本地成果、处理远端新增提交，再同步已验证的本地 trunk。允许 PR 的任务按以下步骤集成，以同步后的 trunk 为基线，避免把相同小改夹入多个 PR。

1. 总控汇总完整目的，按[CI 与本地验证](#ci-与本地验证)核对已有证据与本次集成新增的验证缺口，保留开发审查证据。候选就绪即创建 PR，让 CI 承担其覆盖的回归。
2. 总控使用 GitHub CLI 创建 PR。Commit / PR Title 遵循 Conventional Commits；Body 只遵循 `pr` skill，不另设仓库模板或附加必填字段；有关联 Issue 时链接。
3. 按[审查分工](#审查分工)安排独立 PR review。总控在实际合入前再次核对已验候选 SHA、trunk 基线、已处理的审查发现及 CI。验证后 trunk 若又前进，重新确认与最新 trunk 的集成结果，补验受影响范围并更新证据，再默认 squash 合回 trunk；不能仅凭旧基线上的 CI 通过状态合入。候选或冲突处理改变时同样补验受影响部分。
4. 同步本地与远端成果，完成集成验证与[现场清理](module-development.md#集成后的清理)。`Closes #...` 可在默认分支合并时关闭 Issue；已集成与已发布分别记录。

总控获准执行任务后可主动完成符合上述条件的 PR、审查和 trunk 合并，无需逐次问用户；需求不明、实质争议或重大取舍才交用户。发布仍受[独立授权边界](#准备与发布)约束。

## 审查分工

| 审查 | 谁执行、审查什么 |
| --- | --- |
| 开发中的 code-review | 按 skill 触发条件使用，固定 diff 的 Standards / Spec 双轴审查；不要求每个小改额外调用 |
| 开发 PR review | 总控派一个或多个 fresh-context 独立 agent 审查待集成候选，可交叉审查；专门的 `pr review` skill 尚待用户后续设计，人数、审查边界及开发审查结论如何复用尚未定稿 |
| Release PR review | 总控核对发布范围、授权、版本、两类说明和 CI 是否符合发布约定，不重做功能实现与验收标准审查 |

`pr review` skill 未建立前，总控直接派 fresh-context agent 核查本次集成候选并记录结果，不声称已调用该 skill，也不自行把临时办法定为 skill 规范。审查者只读并报告发现，作者或总控修复，审查者复核；已有证据作为输入，不因创建 PR 机械重跑相同检查。

agent 共用仓库所有者身份。fresh context 提供独立判断，不构成多个 GitHub 审批人；PR 作者不能用同一账户批准自己，因此不要求第二账户 approval。总控从 GitHub 的提交、Checks 和 Review 核对候选与结果，决定是否集成；验证说明按 `pr` skill 的 Evidence 表达，不另外要求在正文重复填写 SHA、审查或 E2E 字段。

## CI 与本地验证

日常 `CI` 仅由目标为 trunk 或 main 的 PR 创建、候选提交更新和重新打开触发。已有 PR 的源分支 push 会改变候选并重跑检查，包括 trunk 作为 Release PR 源分支时；修改标题或描述只运行轻量的 `PR conventions`，不重跑构建和测试。本地提交与合并不触发云端 CI；各分支的 push 事件不单独启动 CI，trunk 合并后不再额外跑一轮。

main 合并后仍由 `Release` 复用同一 CI，验证实际发布提交并构建产物；手动验证入口继续保留。总控按完整改动目的逐个集成，核对各 PR 基于最新 trunk，候选或基线更新后重新检查。过时的日常运行自动取消，正式发布运行不自动取消。测试范围不因减少触发而裁剪。

验证按环境与用途分工，具体命令以根 `package.json` 和 `.github/workflows/ci.yml` 为准：

| 承担方 | 验证职责 |
| --- | --- |
| 开发者本地 | 复现、调试和确认本次改动；UI 改动检查实际界面、交互与观感。定点自测与随后 CI 的回归用途不同 |
| CI | 在干净 Runner 安装锁定依赖，执行构建、HTTP/SQLite、已纳入的浏览器 E2E 与真实文件输出回归；使用隔离数据、测试邮件和受控模型，不读取私人配置 |
| 总控集成 | 复用开发证据与 CI 结果，只补验冲突处理或新组合引入、已有检查未覆盖的问题。CI 覆盖的检查直接交 CI，不先完整本地重跑；没有额外缺口时本地测试可以为零 |
| 目标环境 | 按影响范围验证真实邮件/模型、GPU OCR、私人浏览器连接、Word/WPS 人工编辑打印及实际设备；更新体验服务后核对启动与受影响入口 |

小改直合路径没有自动 PR CI，由作者完成必要定点验证；需要云端环境时使用手动 CI。总控接收已验证且未变化的提交后核对 Git 状态即可推送，不因 push 重新验收。CI 失败时依据日志与产物定点复现、修复；仅在新改动、失败或未解疑点出现时扩大或重复验证。

`HTTP and SQLite` 与 `Build, browser and outputs` 并行执行。前者运行 `test:ci`；后者构建三 workspace，运行 `test:ci:outputs` 和 `test:ci:browser`，覆盖认证、统一数学作品与内容保护、日程和开发服务。输出回归包括数学 DOCX/PDF、课堂离线 ZIP、备份恢复，以及原 HTTP 组排除的浏览器 Cookie、课稿资料包和两项 OCR 取消/超时回放。回放不证明真实模型的识别质量。测试名称在两组间互斥，`test:ci` 的四项具名排除全部由输出组执行。

`Build and API` 保留为必需检查，只有两个执行 job 都成功才通过；失败、取消或跳过均不放行。`PR conventions` 校验 Conventional Commit 标题及 main 的 PR 来源。发布复用同一套验证，全部通过后才允许发布产物。

GeoGebra 缓存仅保存固定源码构建的运行时，按平台、清单、资源、许可证、依赖校验文件和构建脚本失效。恢复缓存后仍用现有构建器核对输入指纹及产物摘要；缓存缺失或无效时从源码构建，不依赖开发机产物。需要核查冷构建时可删除对应 Actions 缓存后手动运行 CI。

失败的测试日志、截图、Playwright trace 与生成文件作为 Actions artifact 保留 7 天；常规执行日志由 Actions 保存。其他尚未纳入 CI 的专项仍按[验证指南](../acceptance/README.md)选取，CI 通过不代表所有模块、真实模型或目标设备已验收。

仓库尚未配置通用源码 linter，现有构建与集成验证继续作为反馈；CI 不把它们标成已经执行 lint。工作流变更用标准 `actionlint` 核查。新增静态规则仍须符合[验证工具准入](../acceptance/README.md#选择验证)。

## 准备与发布

```text
trunk：preview/integration                  main：稳定发布分支
  |                                            |
  |  用户决定准备或发布的时机，指定目标版本       |
  |  总控确认范围，完成已约定集成并同步 trunk      |
  |  暂停无关 trunk 集成；worktree 可继续开发     |
  |                                            |
  |  手动触发 Prepare release                   |
  |    Runner 检出 trunk                        |
  |    release-it 写入指定版本，生成技术日志      |
  |       +--> dry_run：只预览，结束本次操作       |
  |       |                                    |
  |       v                                    |
  |    生成 package.json / package-lock.json    |
  |    与 CHANGELOG.md，commit + push trunk     |
  |    没有版本准备 PR                          |
  |       |                                    |
  |    总控同步结果、创建 Release PR             |
  |    Body 按 pr skill 表达发布变化             |
  +---------------- Release PR --------------->+
  |                                            |
  |                                      总控 Release PR review
  |                                      PR CI 验证候选
  |                                      新提交需重新验证
  |                                            |
  |                                      已获完整发布授权：继续
  |                                      仅获准备授权：等待批准
  |                                            |
  |                                      Merge commit -> M
  |<........M 已固定，恢复无关集成...............|
  v                                            v
继续下一轮开发                           Release workflow
                                         检出固定提交 M
                                         测试 + 构建 + 打包
                                         记录 M + SHA-256
                                               |
                                         Tag 指向 M
                                         创建 GitHub Release
                                         技术日志链接 + 同次构建产物
                                               |
                                         总控定稿用户说明
                                         gh release edit 写入 Release
                                               |
                                         部署 + 上线检查
                                         （CD 尚未接通）

main 历史不合回 trunk；下一次版本准备仍等待上一版发布完成
```

**授权与范围。** 时机由用户决定，agent 不根据任务完成、commit、push 或时间自行准备版本。用户明确要求“发布这些改动”即授权完成整个已约定发布过程，无需合 main 前再问一次；仅要求“准备版本”不授权正式发布。新增发布内容、重大取舍或超出原授权的操作须重新确认。当前是否已有发布授权以运行台账为准。

每次发布包含 Release PR 合并时 trunk 的全部已集成改动，紧急修复也沿 `fix/* -> trunk -> Release PR -> main`。这意味着热修复也可能携带其他已集成变化，是当前接受的取舍；不另设 release 分支或 main 热修通道。

发布准备开始前完成约定范围的集成并确保工作区干净；准备开始至 Release PR 合入 main、固定提交 M 确定期间，暂停无关 trunk 集成，包括小改直合及推送。独立 worktree 可继续开发；候选修复允许进入 trunk，但须更新范围检查、审查与受影响验证。M 确定后即恢复 trunk 集成，后续构建、打包、Tag、Release 和部署继续使用 M 及其产物，不纳入新集成的 trunk 改动。发布失败需要代码修复时，重新确认新候选的范围、授权与验证，不能用移动中的 trunk 替换原 M。

仅预览结束即可恢复集成；M 尚未确定而版本已准备、发布暂停或取消时，先核对并处理准备状态再恢复集成。恢复开发集成不等于开始下一轮发布：版本准备与正式发布仍按下面的单一版本序列串行进行，main 的合并历史不回灌 trunk。

**版本与两类说明。** 根 `package.json` 是 SemVer 产品版本；workspace 包版本是内部依赖版本，不发布 npm 包。目标版本由用户明确指定，例如 `1.0.0`；agent 将该版本交给 release-it 执行，不按提交类型自行递增。未收到目标版本时先向用户确认，不触发版本准备。入口通过标准 SemVer 库校验完整版本及递增关系；Conventional Changelog 插件使用官方 `ignoreRecommendedBump` 配置，保留日志生成：

- 技术 `CHANGELOG.md` 使用官方 `conventionalcommits` 模板与 `types` 配置，包含功能、修复及 refactor/build/ci/docs 等工程变更，供开发者和 agent 阅读；Breaking Change 保留在日志中，所有提交类型都不裁决目标版本。该文件由工具生成，禁止手改。
- 用户 Release Notes 说明用户能感知的变化，不展示工程细节或尚未开放的功能。发布变化在 Release PR 中按 `pr` skill 表达，不增加专用字段或机器标记。工作流创建 Release 后，总控根据已审阅的变化用 `gh release edit --notes-file <临时文件>` 写入面向用户的说明，并保留固定版本的技术 CHANGELOG 链接；没有用户可感知变化时仅保留该链接。定稿写入即完成说明交付，临时文件用后清理，不另建仓库文件。

正式版本使用 `v<version>` Tag，仅由 main 发布。当前只维护一条正式版本序列，下一次准备在上一版发布完成后进行。

### 单向发布的兼容性约束

main 只接收 trunk 的发布合并，不独立修改内容。以下配置是单向发布成立的必要条件，迁移仓库或更换发布工具时须一并核对，不能直接套用默认设置：

| 兼容点 | 当前配置及原因 |
| --- | --- |
| 上次发布的 Tag | Tag 指向 main 的合并提交 M，M 不属于 trunk 的祖先；只查当前分支可达 Tag（如默认 `git describe`）可能漏掉上次发布。[.release-it.json](../../.release-it.json) 已开启 `git.getLatestTagFromAllRefs`，配合准备工作流获取完整历史和 Tag，按版本排序读取最高 `v*` Tag，再计算它到 trunk 的新增提交 |
| main 的合并保护 | [stable.json](../../.github/rulesets/stable.json) 已将 `strict_required_status_checks_policy` 设为 `false`，使用 loose 检查；若强制来源分支追平 main，会要求 trunk 带回 main 的发布合并历史。main 只允许 merge commit，也不启用 `required_linear_history`，因为线性历史规则与发布 merge commit 冲突。必需检查仍须通过 |

### 发布步骤

1. **准备版本。** 总控手动运行 `Prepare release`，分支选 trunk，必填 `version` 使用用户指定的完整目标版本，不接受 auto/patch/minor/major 作为版本号。默认 `dry_run=true` 只预览；正式准备设 `false`，由运行机调用 release-it 更新版本及日志、commit 和 push，直接提交 trunk。日常提交只影响待生成的日志，不触发工具，也不决定版本。首版没有历史 Tag 时读取已有历史并由工具创建 CHANGELOG，不伪造基准 Tag。
2. **同步结果。** 核对工具输出、版本、锁文件和 CHANGELOG；没有生成变更则不创建空提交。push 遇到 trunk 前进会拒绝覆盖，先核对范围，不强推。版本已准备、发布前不重复递增。
3. **创建并审查 Release PR。** 使用 GitHub CLI，源为 trunk、目标 main，标题 `chore(release): ...`，Body 只使用 `pr` skill。总控核对发布范围、已有授权及验收边界，工作流不解析 PR 正文。总控审查并确认 CI 通过，在授权覆盖范围内以 merge commit 合并；只有准备授权则等待用户授权正式发布。
4. **发布固定版本。** `Release` 检出实际 main 合并提交 M，复用 CI 构建、测试，打包同一提交的服务源码、Web 构建、共享源码、依赖清单及配置模板，生成 SHA-256。工作流创建指向 M 的 Tag 和 GitHub Release，上传同一次验证的产物，附该提交的技术日志链接；总控随后按上述两类说明约定完成用户说明。

`Release` 支持获准后的手动演练或恢复；默认 `dry_run=true` 走实际构建、测试、打包及摘要校验，产物保存在 Actions，不创建 Tag/Release。正式发布只允许 main；其他分支仅允许 dry run，非法的正式发布请求跳过执行。已有同名 Tag/Release 阻止覆盖；中断后先核对 Tag 指向和资产，用 GitHub 原生命令补齐缺失部分，不移动已发布 Tag。

自动化使用仓库 `GITHUB_TOKEN`，版本准备和发布 job 才授予内容写权限；日常 CI 只读。Release PR 由总控使用已有 GitHub CLI 身份创建并触发检查。该 token 创建的 Tag/Release 不能被假定继续触发其他工作流，未来 CD 应复用本次产物并接在发布流程内。

## GitHub 配置与重建

工作流与 Rulesets 请求体在 `.github/`，可随仓库重建。Issue / PR 正文格式由对应 skill 维护。Actions 固定到上游发布提交，npm 安装使用锁文件。

新仓库准备默认开发分支后，在 GitHub 设置中启用 Issues 和 Actions；默认 workflow token 保持只读，写权限由具体 job 声明。允许 merge 与 squash，关闭 rebase merge，开启合并后删除短期分支；两种合并提交的标题均取 Conventional Commit 格式的 PR 标题，正文取 PR 描述。

在 Settings / Rules / Rulesets 导入 `.github/rulesets/` 的三份 JSON，或使用 GitHub CLI 的 `gh api POST repos/{owner}/{repo}/rulesets --input <文件>`。已有仓库按名称更新规则，避免重复创建。需要当前仓库类型和套餐支持 Rulesets。

trunk 的 Ruleset 保留禁止删除和强推，允许总控推送已验证的本地成果；不对每次推送强制 PR 或必需检查。worktree PR 的最新基线、审查和 CI 由总控按[集成步骤](#任务与-pr)核对，GitHub 不判断本地 worktree 的使用情况。

main 继续要求 PR、讨论解决及 `Build and API`、`PR conventions` 两项必需检查通过，只允许 merge commit，并阻止删除、强推；版本 Tag 禁止改写和删除。合并保护同时遵循[单向发布的兼容性约束](#单向发布的兼容性约束)。Release PR 的 CI 验证 GitHub 生成的候选合并结果，合入后 `Release` 再验证和构建实际 main 提交。必需账户 approval 数为 0；独立 agent 审查不冒充另一个 GitHub 用户。Rulesets 不替代用户的发布授权。

## 部署交接

当前工作流产出经过检查的 GitHub Release 与可校验产物，用户说明由总控使用 GitHub CLI 完成。CD 的服务器、域名、生产配置、备份目标尚待确定，未设置假部署步骤；具名待办以[运行台账](../plans/run-state.md)为准。

发布包包含已经构建的 Web，在目标 Linux/Node 22.23.2 环境解压并校验 SHA-256 后，从解压根目录执行：

```bash
npm ci --omit=dev
cp .env.example .env
chmod 600 .env
cat REVISION
```

按[生产配置](../SETUP.md#正式部署)填写 `.env` 中的持久路径、HTTPS 证书、认证密钥和邮件配置，设置 `NODE_ENV=production`，把 `REVISION` 的完整 SHA 填入 `PRODUCT_REVISION`，然后启动预构建产物：

```bash
node --env-file=.env apps/api/src/server.js
```

维护备份或恢复时也用 `node --env-file=.env apps/api/src/scripts/reliability.js ...`，确保读取相同版本标识。数据库、附件、密钥和外部工具独立准备，产物不包含任何用户数据或私有配置。目标主机的安装、重启持久化、备份还原及上线检查属于接通 CD 时的完成条件。

## 标准依据

- [Trunk Based Development](https://trunkbaseddevelopment.com/)：单一日常集成主线与短期任务分支。
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 与 [SemVer](https://semver.org/)：提交语义与版本递增。
- [release-it](https://github.com/release-it/release-it)、[Conventional Changelog 插件](https://github.com/release-it/conventional-changelog)：写入用户指定版本、更新日志生成及准备提交、推送。
- [release-it 跨分支 Tag 查找](https://github.com/release-it/release-it/blob/main/docs/git.md#use-all-refs-to-determine-latest-tag)、[GitHub 必需状态检查](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)：单向发布的版本基线与合并条件。
- [GitHub CLI release create](https://cli.github.com/manual/gh_release_create)、[release edit](https://cli.github.com/manual/gh_release_edit)、[Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)、[workflow 触发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)：发布、合并门槛与 token 行为。
