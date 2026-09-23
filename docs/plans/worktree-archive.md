# 工作树恢复索引

当前运行和开发只使用 `/home/liam_t/项目/TeacherWorkspace-preview`；`/home/liam_t/项目/TeacherWorkspace` 是保留的原库。历史分支仍在共享 Git 仓库中，detached HEAD 的恢复引用位于 `refs/archive/worktree-cleanup-20260923/`。

旧工作树的路径到归档目录的完整映射在私有文件 `/home/liam_t/项目/TeacherWorkspace-archive/worktree-cleanup-20260923/archive-index.json`。只有有未提交或忽略文件的树存在对应归档目录；其 `files.tar` 保存文件现场，`tracked.diff` 保存相对原 HEAD 的二进制补丁，`head.txt` 记录原提交和分支。归档目录权限仅属当前用户。可重建的依赖目录和常见缓存已排除；需要时重新安装或生成。

| 材料 | 当前入口 |
| --- | --- |
| 编排派发与回执、UI 派发记录 | `TeacherWorkspace-preview/.scratch/worktree-consolidation/control-records/` |
| 真人 Office 验收原始笔记 | `TeacherWorkspace-preview/.scratch/worktree-consolidation/human-acceptance-20260922.md` |
| 旧控制树完整现场 | 私有归档中的 `home__liam_t__项目__TeacherWorkspace-mvp/` |
| Office 对照材料与输出 | 私有归档中的 `home__liam_t__项目__TeacherWorkspace-office-comparison/` |
| 未完成分支现场 | 按完整路径在 `archive-index.json` 查其归档目录 |

恢复时先从 `head.txt` 确认原提交，按 `files.list0` 与 `files.tar` 取回所需文件；已提交内容从保留的 Git 分支或 detached 恢复引用读取。归档文件不直接写回正在运行的预览数据目录。
