# 工作树恢复索引

仅在找回旧任务、证据或未提交现场时读本页；当前工作树分工、授权和集成状态见[项目状态](run-state.md)，分支用 `git worktree list` 核对。`/home/liam_t/项目/TeacherWorkspace` 承载共享 `.git`，不能作为旧副本删除。

## Git 历史

历史分支保存在私有目录 `/home/liam_t/项目/TeacherWorkspace-archive/git-history-20260925T101826Z/`：`all-refs.bundle` 保存全部引用对应的提交，`refs.txt` 按原分支名记录提交，`SHA256SUMS` 用于校验备份。该 bundle 已在独立空仓库中恢复，引用逐项匹配并通过 `git fsck --full --no-reflogs`。detached HEAD 的恢复引用同时保留在共享仓库的 `refs/archive/worktree-cleanup-20260923/`。

需要暂停的 Agent 成果或旧任务分支时，先查看备份中的名称，再只取回需要的分支。例如在开发树执行：

```bash
git bundle list-heads ../TeacherWorkspace-archive/git-history-20260925T101826Z/all-refs.bundle
git fetch ../TeacherWorkspace-archive/git-history-20260925T101826Z/all-refs.bundle refs/heads/feat/f61-full-agent:refs/heads/recover/f61-full-agent
```

取回分支不会修改当前工作区；不要把全部旧分支重新导入日常开发仓库。Git 备份不包含忽略文件、未提交现场或运行实例数据，按下节定位这些资料。

## 本地资料

旧工作树的路径到归档目录的完整映射在私有文件 `/home/liam_t/项目/TeacherWorkspace-archive/worktree-cleanup-20260923/archive-index.json`。只有有未提交或忽略文件的树存在对应归档目录；其 `files.tar` 保存文件现场，`tracked.diff` 保存相对原 HEAD 的二进制补丁，`head.txt` 记录原提交和分支。归档目录权限仅属当前用户。可重建的依赖目录和常见缓存已排除；需要时重新安装或生成。

| 材料 | 当前入口 |
| --- | --- |
| 编排派发与回执、UI 派发记录 | `TeacherWorkspace-preview/.scratch/worktree-consolidation/control-records/` |
| 真人 Office 验收原始笔记 | `TeacherWorkspace-preview/.scratch/worktree-consolidation/human-acceptance-20260922.md` |
| 旧控制树完整现场 | 私有归档中的 `home__liam_t__项目__TeacherWorkspace-mvp/` |
| Office 对照材料与输出 | 私有归档中的 `home__liam_t__项目__TeacherWorkspace-office-comparison/` |
| 本地保留的验证产物 | `.scratch/docs-retained-20260923/`；`docs-evidence/` 与 `api-evidence/` 分别保留原文档目录和 API 工作目录中的产物，避开测试自动清理目录 |
| 未完成分支现场 | 按完整路径在 `archive-index.json` 查其归档目录 |
| 真人验收候选与三个样例 ZIP | 私有归档的 `local-snapshots-20260925/TeacherWorkspace-human-acceptance-20260922/` |
| R35 隔离浏览器、数据库与日志 | 私有归档的 `local-snapshots-20260925/r35-local4-isolated/` |
| 预览树旧任务、测试输出与临时数据库 | 私有归档的 `local-snapshots-20260925/TeacherWorkspace-preview/`；原路径与当前位置见该批 `paths.json` |

恢复旧工作树时先从 `head.txt` 确认原提交，按 `files.list0` 与 `files.tar` 取回所需文件；已提交内容从 Git 历史备份或 detached 恢复引用读取。当前实例的 `.scratch/preview/`、账户配置及正式保留证据仍在开发树；归档文件不直接写回正在运行的预览数据目录。
