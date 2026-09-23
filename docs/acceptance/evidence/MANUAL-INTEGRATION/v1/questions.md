# MANUAL-INTEGRATION@1 题库固定成果接入

**PASS，限于集成自检。** 从固定组合 `0765532a763799cd143544ba02b11342990931e0` 顺序引入题库实现 `489c9e6b301eebd8860fee631d075a05f36b80d2` 与回执 `9f36c858b5f4637d3abbc18fe77509adc89f92ff`，本分支对应提交分别为 `862bbdf4306636ef52f00bdd761d74f7c9b6e40a`、`4ef73647738db2671e3247974d5ca9da53880cda`。本报告前组合候选为 `4ef73647738db2671e3247974d5ca9da53880cda`；包含本报告的后继提交是本批交接点。来源 [MANUAL-QUESTIONS 回执](../../MANUAL-QUESTIONS/v1/receipt.md) 明确为 **PARTIAL / self**，本次不提升为全范围或独立验收通过。

两笔提交直接应用，无冲突。README 与材料契约自动合流；数学、资源、备课既有产品文件未被覆盖。公共编辑器仅新增 `allowTeacherNotes` 可选参数，默认 `true`，题库页面显式传 `false`。Import 契约只增加可选、只读 `originalDocuments`。本批没有新依赖、迁移或 Agent 改动。

## 限定检查

- 使用本树隔离 `TMPDIR` 执行 `npm run build` 通过：六模块目录、隔离 SQLite 12 项迁移、Web 生产包均成功；保留既有 Vite 大包提示。
- 真实认证浏览器定向执行 `manual-questions.spec.js` 的“未保存编辑经删除恢复仍在，取用时使用当前修改”，1/1 通过。隔离 HTTPS/SQLite 和测试邮件环境中，从题库保存当前修改、加入备课，再读取备课 v3 结果确认内容；不重跑来源的完整题库场景。
- 解析合并后的 `materials.openapi.yaml`，确认 `originalDocuments` 为可选只读字段；核对共享编辑器的默认 `allowTeacherNotes = true` 与题库显式 `false`。README 保留统一入口、Agent 暂停及前三批手动说明。产品、测试、README 和契约范围内 `git diff --check` 通过。

## 未决边界

- **图片与扫描 PDF 自动识别缺失**：生产装配未接视觉提取 provider；图片的预览、裁图、人工校对不能计为自动识别完成。来源回执保留复杂排版、多栏和跨页续题的校对边界。
- 旧 DOC 的本机转换尚未验证；需按来源回执在适用的隔离环境配置 `MATERIALS_OFFICE_ROOT`。资源批次的旧 DOC 对象丢失风险仍在。
- 题库缺失的内部审查与识别缺口由根另派接续；数学独立验收亦尚未返回。整体手动业务组合验收未完成。

本轮仅操作 `integration/manual-business`；预览树、`50880` 服务、用户数据库和配置未接触。注入的 `AGENTS.md` 改动保留且不提交。下一批固定输入由根主动通知后继续接入。

```yaml
task: MANUAL-INTEGRATION@1
attempt: 1
batch: MANUAL-QUESTIONS
role: integration
status: PASS
verification_level: self-integration
source_status: PARTIAL/self
runner: "Codex / gpt-6-sol / high"
skills_used: [writing-for-agents]
base_revision: "0765532a763799cd143544ba02b11342990931e0"
source_revisions: ["489c9e6b301eebd8860fee631d075a05f36b80d2", "9f36c858b5f4637d3abbc18fe77509adc89f92ff"]
combined_revision: "4ef73647738db2671e3247974d5ca9da53880cda"
result_revision: "见包含本报告的提交"
checks: ["npm run build PASS", "题库取用到备课 v3 浏览器 1/1 PASS", "共享编辑器与 Import 契约接线 PASS", "限定 diff check PASS"]
open_items: ["图片与扫描 PDF 视觉识别缺失", "旧 DOC 验证未完成", "题库内部审查待接续", "数学独立验收未决", "整体组合验收未完成"]
next_condition: "根通知下一批固定提交及适用写权后恢复本会话"
```
