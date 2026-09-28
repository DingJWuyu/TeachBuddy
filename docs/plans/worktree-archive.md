# 旧成果恢复索引

仅在查找旧源码、固定输入或验收证据时读本页；当前工作现场与授权见[项目状态](run-state.md)。常驻目录只有原 `TeacherWorkspace` 和 `TeacherWorkspace-preview`。原仓库承载共享 `.git`，必须保留；旧模块工作树与同级 `TeacherWorkspace-archive` 已删除。

## 源码与未提交成果

旧模块分支仍在共享 Git 中。更早的归档引用保存在 `refs/archive/phase-reset/`，原引用、提交与恢复引用的对应关系见 preview `.scratch/phase-reset/preserved/git-refs.json`。这些引用保护完整提交历史，无需旧 bundle 或旧工作树。

暂停的全模块 Agent 成果使用 `refs/archive/phase-reset/heads/feat/f61-full-agent`；早期设计使用 `refs/archive/phase-reset/heads/design/c25-agent`。可直接查看提交和文件列表：

```bash
git log -1 refs/archive/phase-reset/heads/feat/f61-full-agent
git ls-tree -r --name-only refs/archive/phase-reset/heads/feat/f61-full-agent
```

备课、题库、资源树的未提交现场在 `.scratch/phase-reset/preserved/uncommitted/{lessons,questions,resources}/`：`source.json` 记录原 HEAD 和分支，`head.diff` 保存相对 HEAD 的二进制补丁，`untracked.tar` 与 `untracked.list0` 保存未跟踪文件。补丁已验证能应用于原 HEAD；内容与当前集成源码有重叠，复用前逐项核对，不整份套到 preview。

## 本地证据与私有资料

以下路径均相对 preview；本地保留资料不提交到仓库。`.scratch/phase-reset/artifacts-manifest.json` 逐文件记录旧位置、新位置与 SHA-256。旧回执中的绝对路径按此映射查找，不要求重建原目录。

| 材料 | 当前入口 |
| --- | --- |
| 旧模块的文档核对、OCR、材料质量及设置验收证据 | `.scratch/phase-reset/preserved/worktrees/`，按模块名保留所需相对路径 |
| 真人目标设备、Office 与 Pandoc 样例及邮件配置脚本 | `.scratch/phase-reset/preserved/human-acceptance/` |
| 暂停 Agent 的未提交业务调用与 API 证据 | `.scratch/phase-reset/preserved/f61/`，与 Git 中的源码分开读取 |
| 更早的 Office、预览恢复、身份与材料对照证据 | `.scratch/phase-reset/preserved/earlier-evidence/`，按来源目录查找 |
| 编排派发与回执、UI 派发记录 | `.scratch/worktree-consolidation/control-records/` |
| 真人 Office 验收原始笔记 | `.scratch/worktree-consolidation/human-acceptance-20260922.md` |
| 已保留的旧验证产物 | `.scratch/docs-retained-20260923/`，包含 `docs-evidence/` 与 `api-evidence/` |
| 当前 OCR、设置及上一轮组合验收 | `.scratch/ocr-settings/`、`.scratch/product-next/`，迁移的作者证据按上述清单查找 |

已纳入 `apps/web/e2e/fixtures/` 的固定输入直接从仓库读取；原始 OCR raw 中的旧 `input_path` 是采集元数据，回放使用同目录固定样本。可重建依赖、模型缓存、临时实例数据库和浏览器 profile 不作为成果保留。

当前用户实例及配置仍在 `.scratch/preview/` 和[运行指南](../SETUP.md)规定的私有位置。保留区权限仅属当前用户；恢复资料时不覆盖正在运行的实例配置或数据。旧 `old - ` session 只供查阅，新任务按[开发约定](../agents/module-development.md#git-与运行现场)使用新 session 和当前 preview 基线。
