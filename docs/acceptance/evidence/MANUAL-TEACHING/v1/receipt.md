# MANUAL-TEACHING@1 / attempt 1

状态：实现自验通过，内部双轴审查发现已修复并完成定向回归。`verification_level=self`。

- 工作树：`TeacherWorkspace-manual-teaching`；分支：`feat/manual-teaching`。
- fixed point：`4db937daa4d5abd0a03f69917528665f94ebb001`。
- 业务实现提交：`fec1dcb93c90a6ab01b70a0937bd6156275e4e94`。
- 审查修复提交：`81c0afc20ab7a5ecac01dad4a28ee78dbbe0ed0f`。
- 执行：Codex / `gpt-6-astra` / `low`；session `01a0ccb9-0422-7310-bba1-7dfc19465a29`。

## 可操作范围

| 范围 | 实际结果 |
| --- | --- |
| 班级 | 新建、改名、删除恢复；一句话后补充教学位置、未讲内容、共性问题和下次备注；删除班级后记录只读，恢复后继续编辑 |
| 资料与反馈 | 题目、备课、数学作品三类关联真实保存；日程使用当前版本资料列表；备课显示分班反馈并打开原记录；重复课程课后记录仅关联本次安排 |
| 日程 | 连续 11/16 天范围、真实鼠标拖选、段内多事项顺序和独立优先级、未排期编辑与移入移出、删除恢复 |
| 重复课程 | 页面新建按周重复及结束日期；整组关联可编辑；单次调课、取消和恢复不改变其他周 |
| 提醒 | 可自填结束前后分钟数；调整时间后重算；关闭浏览器与服务、保库重启后补提醒保留原时刻；通知已读、清空及重复点击定位 |
| 保存恢复 | 刷新恢复；慢响应不串写其他安排；丢响应原键原体确认；新输入保留；关闭编辑器保留草稿；旧草稿遇服务器变化正常报冲突 |

## 验证

- [真实认证浏览器 19/19](browser.log)，最终草稿/移动变更的[受影响回归 7/7](scene-regression.log)，以及审查修复的[受影响回归 6/6](review-green.log)，合计覆盖 22 个不同 E2E 场景，重复执行不重复计数。
- [提醒与事项移动公开 HTTP 16/16](api.log)。未改后端业务契约、数据库结构或历史数据。
- [生产构建](build.log)及最终候选[Web 构建](web-final.log)通过；保留既有大 chunk 提示。仓库没有独立 lint/typecheck 命令。
- 保存串写与草稿丢失均先真实复现：[慢响应红灯](red-save.log)、[关闭草稿红灯](red-conflict.log)；当前结果见上述绿色回归。
- 浏览器为真实 Cookie 认证、隔离 SQLite、随机本地 HTTPS 端口、假邮件适配器；服务器业务时钟只在测试中注入。测试命令：`TMPDIR="$PWD/.tmp-mt" npx playwright test -c apps/web/e2e/manual-teaching.config.mjs`，先创建本树 `.tmp-mt` 并完成构建。
- [桌面班级记录](browser/class-complete-record.png)、[周课单次恢复](browser/weekly-single-restore.png)、[补提醒](browser/catch-up-notifications.png)、[平板日程](browser/schedule-tablet.png)。另以隔离 Chrome DevTools 会话手动查看备课反馈的桌面/平板页面。
- 既有三类资料往返、丰富题目保存和混合记录后端证据沿用 [MATERIALS-TEACHING-ALIGNMENT](../../MATERIALS-TEACHING-ALIGNMENT/v1/implementation/author.md) 的未变范围。

## 内部审查

[双轴审查结果](review.md)：Standards 提出 2 项、Spec 提出 1 项，重叠后为 2 个不同问题。均先通过浏览器复现，再修复并定向验证；未重新执行完整双轴审查。

## 公共接线与边界

- `lessons/LessonDetail.jsx` 仅挂载现有教学反馈组件；集成时保留备课线路其他变更。
- 日程复用 `classes` 当前 v2 记录读取和 `lessons` v3 列表；顶部通知同路由再次点击可重新定位。
- 公共测试 harness 仅新增可选业务时钟参数，不改变生产时钟。
- 产品 Agent/runtime/tools/skills/plugin/connector 无改动；未访问 50880、用户库、密钥或其他工作树服务；未发送外部邮件、push、合并 main、部署或付费。
- 本机范围尚欠：当前未发现所属已定功能缺口。目标 Word/WPS、课堂设备、iPad 实机和正式部署按用户要求暂缓；本回执不替代集成者的实际体验或独立验收。

- 本任务隔离浏览器和服务已停止，临时数据库及测试运行目录已清理；正式证据保留在本目录。根注入的 `AGENTS.md` 保留且未纳入提交。
