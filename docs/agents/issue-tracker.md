# Issue tracker: GitHub

本仓库的问题和规格记录在 GitHub Issues 中。使用 `gh` CLI 操作。

## 约定

- 创建 issue：`gh issue create --title "..." --body "..."`
- 查看 issue：`gh issue view <number> --comments`
- 列出 issue：使用 `gh issue list`
- 评论 issue：`gh issue comment <number> --body "..."`
- 添加或移除标签：使用 `gh issue edit`
- 关闭 issue：`gh issue close <number>`

在本仓库中执行命令时，根据 Git 远程地址推断仓库。

## Pull request 是否作为 triage 请求入口

**否。**

外部 Pull Request 不进入与 issue 相同的 triage 流程。

## 发布到 issue tracker

创建 GitHub issue。

## 获取相关 ticket

执行 `gh issue view <number> --comments`。

## Wayfinding

- Map 使用标签 `wayfinder:map` 的单个 issue。
- Child ticket 使用 GitHub sub-issue；如果不可用，则在正文顶部写入 `Part of #<number>`。
- 阻塞关系优先使用 GitHub 原生 issue dependencies。
- 认领 ticket：`gh issue edit <number> --add-assignee @me`
- 完成 ticket：评论、关闭 issue，然后在 map 的 Decisions-so-far 中追加上下文链接。
