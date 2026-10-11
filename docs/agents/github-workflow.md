# GitHub 协作与发布

接手开发、创建 PR、维护 GitHub 配置或准备发布时读本页。当前授权、未完成事项与验收证据在[运行台账](../plans/run-state.md)，产品运行条件在[SETUP](../SETUP.md#正式部署)。

## 开发主线

`preview/integration` 是唯一日常 trunk，也是 GitHub 默认分支。`main` 保存经过验收的稳定发布候选。任务从最新 trunk 创建短期分支，分批实现、验证并尽快合回；尚未开放的产品能力通过发布配置控制。线上修复默认也先进入 trunk，再沿同一流程发布。

```text
小修小改：
  本地 trunk -> 临时 branch -> 修改与本地验证 -> 直接合回本地 trunk
  不创建 worktree，不开开发 PR，不单独 push

worktree 任务：
  trunk -> 短期分支 + worktree -> 开发、自验、独立 Standards / Spec 审查
  -> 总控准备集成 -> 每个 worktree 各开一个开发 PR -> CI -> trunk
  开发期间不开 PR；多个 worktree 分别集成

发布：
  同步本地 trunk 成果到远端
  -> 自动版本准备 PR -> preview/integration
  -> Release PR: preview/integration -> main
  -> 发布验收、CI、用户批准 -> merge commit
  -> 固定提交验证与打包 -> Tag / GitHub Release
```

worktree 集成 PR 可 squash；Release PR 使用 merge commit。代码单向从 trunk 晋升到 main，发布后 trunk 继续开发，无需同步 main 的发布历史。功能、修复、版本号和 CHANGELOG 先进入 trunk；main 仅接收发布合并。短期分支合并后删除；长期分支由默认分支和 Rulesets 保护。

## 任务与 PR

已授权任务按[当前授权](../plans/run-state.md#工作现场与授权)执行。开发 PR 只在总控准备集成 worktree 时创建；其他本地 commit、merge 均不触发开发 PR。版本准备 PR 和 Release PR 属于发布流程，继续保留。

| 路径 | 开发与验证 | 集成与远端操作 |
| --- | --- | --- |
| 小修小改 | 在已有目录切临时 branch，完成修改和必要本地验证；不创建 worktree | 直接合回本地 trunk，删除临时分支；禁止开发 PR 和为小改单独 push |
| worktree 任务 | 从 trunk 创建短期分支和独立 worktree；期间允许多次 commit，禁止开发 PR | 总控在准备集成时为每个 worktree 分别开一个 PR，审查与 CI 通过后合回 trunk 并清理现场 |

寻常文档和非敏感代码的小范围修改走本地路径；敏感改动按大任务处理。仅记录讨论结论、补充零碎说明不另建 Issue 或 PR。需要 Issue / Spec / Tickets 的任务沿[Issue 约定](issue-tracker.md)及既有 skills 执行。

worktree 任务按完整改动目的组织，实现、必要测试与文档一并交付；同一目的的连续修补和多个 commit 不拆 PR，多个 worktree 的集成也不合成一个 PR。PR 频次由实际 worktree 集成决定，不按天数或 commit 数量设限，不为开 PR 刻意创建 worktree。

总控只在后续 worktree 集成或发布的同步节点，将已经本地合入并验证的小改一并推送到远端 trunk。同步前 fetch 并核对两端增量，保留本地成果、处理远端新增提交；以同步后的 trunk 为各 worktree PR 的基线，避免把同一批小改重复夹入多个 PR。

worktree 集成时：

1. 按[验证指南](../acceptance/README.md)执行受影响的真实路径，按[开发约定](module-development.md#编排)完成或复用覆盖最终候选的独立双轴审查。
2. 总控创建 PR。提交和 PR 标题遵循 Conventional Commits，PR 描述按 `pr` skill 及仓库模板说明结果、候选 SHA、验证范围、实际通过/未验、审查结果及合并影响；有关联 Issue 时在 Body 中关联。
3. 总控核对候选基于最新 trunk、审查发现与讨论已处理、CI 通过后合并；候选、基线或冲突处理发生变化时更新受影响证据及检查。trunk 的这些合并条件由总控执行。
4. 合入后核对本地与远端成果，完成集成验证与[现场清理](module-development.md#集成后的清理)。`Closes #...` 可在默认分支合并时关闭 Issue；任务完成与已发布分别记录。

双轴审查是独立 agent 的判断，PR 中保留结果；它不是 GitHub 原生的另一个用户批准。当前单人仓库不要求无法满足的第二账户 approval，main 合并仍需用户明确批准。

## CI 与本地验证

日常 `CI` 仅由目标为 trunk 或 main 的 PR 创建、候选提交更新和重新打开触发。已有 PR 的源分支 push 会改变候选并重跑检查，包括 trunk 作为 Release PR 源分支时；修改标题或描述只运行轻量的 `PR conventions`，不重跑构建和测试。本地提交与合并不触发云端 CI；各分支的 push 事件不单独启动 CI，trunk 合并后不再额外跑一轮。

main 合并后仍由 `Release` 复用同一 CI，验证实际发布提交并构建产物；手动验证入口继续保留。总控逐个集成 worktree，核对各 PR 基于最新 trunk，候选或基线更新后重新检查。过时的日常运行自动取消，正式发布运行不自动取消。测试范围不因减少触发而裁剪。

- `Build and API`：锁定依赖安装、现有三 workspace 构建和 `npm run test:ci`。
- `PR conventions`：使用成熟 action 校验 Conventional Commit 标题；main 的 PR 源必须是本仓库 trunk。
- 浏览器 E2E、真实 OCR/模型、Office/PDF 与目标设备由 agent 按影响范围在隔离环境验证，并在 PR 留证。CI 不重复这些流程。

`test:ci` 使用仓库现有 HTTP/SQLite 测试，覆盖认证、工作台、日程/班级、备课基础、数据恢复、Agent 替身及部分数学契约/迁移。测试收件器和模型替身不等于真实邮件送达或产品模型验证。

四个混入所选文件的子例按具名模式排除：`auth-contract-https` 中的真实浏览器 Cookie 场景；`reliability-export-ownership` 中的已生成课稿文件导出，以及取消和超时后的 OCR 证据场景。它们分别依赖 Office/PDF 转换和 Bubblewrap 图像预处理沙箱。Node 在发现阶段筛掉它们，测试输出的 `skipped: 0` 不代表运行过这四项；完整 API 与材料专项仍沿原入口执行。

仓库尚未配置通用源码 linter，现有构建与集成验证继续作为反馈；CI 不把它们标成已经执行 lint。工作流变更用标准 `actionlint` 核查。新增静态规则仍须符合[验证工具准入](../acceptance/README.md#选择验证)。

## 准备与发布

版本采用 SemVer；根 `package.json` 是产品发布版本，workspace 包版本是内部依赖版本，不发布 npm 包。Conventional Commits 驱动 `release-it` 与官方 Conventional Changelog 插件，版本和根 CHANGELOG 由工具生成。固定工具版本在锁文件中。

正式版本使用 `v<version>` Tag，仅由 main 发布。版本准备完整获取仓库历史和 Tag，使用 release-it 的 `git.getLatestTagFromAllRefs` 按版本排序读取最高的 `v*` Tag，再计算该 Tag 到 trunk 的新增提交；Tag 指向的发布提交不必是 trunk 的祖先。当前只维护这一条正式版本序列，下一版准备在上一版发布完成后进行。

1. **准备版本。** 总控先同步已验证的本地 trunk 成果，再在 GitHub Actions 运行 `Prepare release`，分支选 trunk。默认 `dry_run=true` 只预览；确认准备范围后使用 `false` 创建普通版本 PR。`auto` 按提交推荐，显式 patch/minor/major 按本次发布决定。无历史 Tag 的首版会读取已有提交历史，不创建虚假的基准 Tag。
2. **审查元数据。** 核对版本 PR 的版本号、CHANGELOG 与 CI，再合入 trunk。首版开放范围和已知限制要在正式 Release PR 中明确。版本准备合入后、正式发布前，不重复执行版本递增。
3. **创建 Release PR。** 以 trunk 为源、main 为目标，标题使用 `chore(release): ...`。记录发布范围、业务验收、未验边界和用户批准。trunk 新提交会改变候选，检查和批准须对应最终候选。main 只能以 merge commit 接收发布。
4. **发布固定版本。** main 合并触发 `Release`，复用 CI 构建和测试，通过后打包本次 SHA 的服务源码、Web 构建、共享源码、依赖清单及配置模板，附 SHA-256。GitHub CLI 从该 SHA 创建 `v<version>` Tag、GitHub Release 和发布说明，并上传同一次验证的产物。

`Release` 也可手动运行；默认 `dry_run=true` 走实际构建、测试、打包和摘要校验，产物保存在 Actions，明确不创建 Tag/Release。正式发布只允许 main。已有同名 Tag/Release 会阻止覆盖；发布中断时先核对现有 Tag 指向的提交和已有资产，再使用 GitHub 原生命令补充缺失部分，不移动已发布 Tag。

自动化使用仓库 `GITHUB_TOKEN`，只在版本准备和发布 job 授予写权限；日常 CI 只读。由该 token 创建的 PR 检查可能需要在 GitHub 批准运行，不能把未运行当通过。它创建的 Tag/Release 也不能被假定会继续触发另一条自动化，未来 CD 应复用本次发布产物并接在发布流程内。

机器人 PR 的 Actions 显示 `action_required` 时，维护者核对来源和候选后使用 GitHub 的 **Approve and run**，或对每个待批 run 执行 `gh api --method POST repos/{owner}/{repo}/actions/runs/<run-id>/approve`。批准后仍需等待实际检查通过，不需要为此添加个人 PAT。

## GitHub 配置与重建

工作流、PR/Issue 模板和 Rulesets 请求体在 `.github/`，可随仓库重建。Actions 固定到上游发布提交，npm 安装使用锁文件。

新仓库准备默认开发分支后，在 GitHub 设置中启用 Issues 和 Actions，允许 Actions 创建 PR；默认 workflow token 保持只读，写权限由具体 job 声明。允许 merge 与 squash，关闭 rebase merge，开启合并后删除短期分支；两种合并提交的标题均取 Conventional Commit 格式的 PR 标题，正文取 PR 描述。

在 Settings / Rules / Rulesets 导入 `.github/rulesets/` 的三份 JSON，或使用 GitHub CLI 的 `gh api POST repos/{owner}/{repo}/rulesets --input <文件>`。已有仓库按名称更新规则，避免重复创建。需要当前仓库类型和套餐支持 Rulesets。

trunk 的 Ruleset 保留禁止删除和强推，允许总控在集成或发布时同步本地成果；不对每次推送强制 PR 或必需检查。worktree PR 的最新基线、审查和 CI 由总控按[集成步骤](#任务与-pr)核对，GitHub 不判断本地 worktree 的使用情况。

main 继续要求 PR、讨论解决及 `Build and API`、`PR conventions` 两项必需检查通过，只允许 merge commit，并阻止删除、强推；版本 Tag 禁止改写和删除。main 的必需检查使用 loose 模式，允许源分支未包含 main 的发布合并提交。Release PR 的 CI 验证 GitHub 生成的候选合并结果，合入后 `Release` 再验证和构建实际 main 提交。Rulesets 不替代用户对 main 发布的批准。

## 部署交接

当前自动化的交付终点是经过检查的 GitHub Release 及可校验产物。CD 的服务器、域名、生产配置、备份目标尚待确定，未设置假部署步骤；具名待办以[运行台账](../plans/run-state.md)为准。

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
- [release-it](https://github.com/release-it/release-it)、[Conventional Changelog 插件](https://github.com/release-it/conventional-changelog)、[create-pull-request](https://github.com/peter-evans/create-pull-request)：标准版本准备与 PR 自动化。
- [release-it 跨分支 Tag 查找](https://github.com/release-it/release-it/blob/main/docs/git.md#use-all-refs-to-determine-latest-tag)、[GitHub 必需状态检查](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)：单向发布的版本基线与合并条件。
- [GitHub CLI release create](https://cli.github.com/manual/gh_release_create)、[Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)、[workflow 触发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)：发布、合并门槛与 token 行为。
