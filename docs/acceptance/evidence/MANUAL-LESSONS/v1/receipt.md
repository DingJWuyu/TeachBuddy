# MANUAL-LESSONS@1

- 级别：`self`，本机备课手动范围通过。实现者：Codex / gpt-6-astra / low。
- 分支：`feat/manual-lessons`；fixed point：`4db937daa4d5abd0a03f69917528665f94ebb001`。
- 产品提交：`ec5e51b40455cb4e5917c544d7c95bcd3295ef22`、`e3dae0368f3ccb57a8046e144a56c53347d04449`，按此顺序集成。

## 实际能力与结果

- 课题新建、改名、删除恢复、账户内手动排序；环节增删排序；题目/资源/数学材料移动、重复放置、移除及同位置排序。真实保存、刷新和重启后保留。
- 环节及本课材料可就地取题、取资源、取已有数学作品；资源选择时可打开实际文件预览。来源更新经对照采用后立即显示新版，保存后保持新快照。
- 数学作品查看来源可返回原备课；原有制作作品、保留草稿、带回指定环节回归通过。备课可回看两个班分别关联的反馈、打开原记录并返回。
- 取材断线后刷新可用原键原请求确认且不重复加入；明确拒绝后可重试或取消本次待采用引用；失效来源可清空选择。
- 三类成果各自学生/教师 Word 与 PDF 共 **12 份**真实下载。六份 Word 均含 OMML 分式，Pandoc 读回仍为数学内容；六份 PDF 均为一页，逐份目视无裁切或空白尾页。学生版不含答案/教师注记，所有成果均排除题库私人笔记。制品及 SHA256 见 [outputs/manifest.json](outputs/manifest.json)。

## 检查

- 生产构建通过；[19 项 API 检查](checks/manual-lessons-api.log)通过，覆盖版本、快照、删除恢复、输出、未知文档保护和新增顺序的账户隔离/冲突/幂等/重启。
- [5 条业务 E2E](checks/manual-lessons-browser.log)通过；[3 条取材恢复 E2E及反馈定向复测](checks/manual-lessons-recovery-final.log)通过。恢复问题的[红灯记录](checks/manual-lessons-retry-red.log)保留。
- [新增数学取材与资源取材最终定向复测](checks/manual-lessons-picker-final.log)、[共享数学契约检查](checks/manual-lessons-contract.log)通过。
- [原数学制作带回 E2E](checks/manual-lessons-math.log)通过；桌面反馈、输出及768px平板页面截图位于 [screenshots](screenshots)。
- 双轴代码审查见 [review.md](review.md)。

## 公共接线与待办

- 新增 lessons 自有迁移 `lessons_0003_order`、`GET/PUT /api/modules/lessons/v3/order`；更新现有 v3 OpenAPI 和材料契约。顺序独立版本化，不改正文版本或旧 v1/v2 排序。
- `classes/FeedbackPanel.jsx` 增加可选打开记录回调；`workbench/WorkbenchApp.jsx` 的来源返回匹配包含查询参数，修正数学作品返回。其余产品改动限 lessons；没有重写题库、数学或文件底座，没有产品 Agent 开发。
- 本机本任务范围无已知未完成功能。目标 Word/WPS 实际编辑、物理打印及课堂设备验证按用户要求暂缓，未冒充通过；目标正式部署不在本次操作中。
- 使用本树隔离数据库/文件/TMPDIR和自动分配的HTTPS端口、真实认证及本地假邮件；仅只读复用已有 Pandoc/Office 工具二进制。未操作50880服务、用户数据库、密钥、main、push或部署。根 `AGENTS.md` 用户改动保留且未提交。
