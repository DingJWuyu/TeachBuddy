# MANUAL-INTEGRATION@1 教学与数学修复接入

**PASS，限于集成自检。** 从 `49b77fad4464444da1f1e6ae1cdc72143cbec6fb` 顺序接入教学三笔与数学报告、修复、回执三笔固定提交。接入后组合候选为 `f07665738da708bfdc1ff642e63fdc5d37c2991c`；包含本报告的后继提交是本批交接点。教学来源 [回执](../../MANUAL-TEACHING/v1/receipt.md) 为 self，双轴发现已闭环。数学 [旧独立报告](../../MANUAL-MATH/v1/independent.md) 因 MM-SPEC-01 为 FAIL，新增 [修复回执](../../MANUAL-MATH/v1/fix.md) 仅为 self 4/4 通过，独立定向复验仍在进行。

## 固定输入与合流

| 批次 | 来源 SHA | 本分支 SHA |
| --- | --- | --- |
| 教学实现 | `fec1dcb93c90a6ab01b70a0937bd6156275e4e94` | `3350ab918defa8d189dfbf556fff9a5aed0e1973` |
| 教学审查修复 | `81c0afc20ab7a5ecac01dad4a28ee78dbbe0ed0f` | `be7f31d7a5690192faf7eef328c40420fdb52e3f` |
| 教学回执 | `9854accdaea59a1f8395d8de2c0dd9754c3220af` | `f48a9dcb2932a6691f1e432565016cfe283d5292` |
| 数学旧独立报告 | `7f39541a2464e248de5307a818f75afb8f5c4283` | `ff2869ea7cca05aacd1650b2875ef6606fd89e36` |
| MM-SPEC-01 修复 | `d8f68a00374884b47ef40d685ee1866a8c245437` | `5381fb49c4cd6325eea7bfadb41aeb2820b18958` |
| 数学修复回执 | `e7878e6accfe95d8e273d58190425748647297f6` | `f07665738da708bfdc1ff642e63fdc5d37c2991c` |

教学实现的 README 与现有统一入口文字冲突，保留预览归属和 Agent 暂停说明，加入班级及日程操作说明。`LessonDetail.jsx` 自动合并会形成两个“教学反馈”入口并重复导入组件；集成时合成页首单入口，沿用教学的醒目位置与备课已有的打开记录后返回现场回调。其余教学和数学产品源码按固定提交引入，未改业务语义、依赖或迁移。

## 本次限定检查

- 隔离 `TMPDIR` 下 `npm run build` 通过：六模块目录、隔离 SQLite 12 项迁移和 Web 生产包成功；保留既有 Vite 大包提示。
- 真实认证浏览器定向检查：备课两班反馈、打开原记录并返回 **1/1**；日程选择当前备课和含数学作品的实际记录 **1/1**。两项覆盖合流后的反馈组件、备课 v3 与教学读取接线。
- 数学起点替换定向检查：纯文字步骤与未应用参数编辑稿取消后保留、明确确认后替换 **2/2**。这只是本组合的自检，不充当正在进行的独立复验。
- 代码和 README 的限定 `git diff --check` 通过；单一反馈入口及唯一组件导入已核对。没有重跑来源的完整模块套件或源码审查。

## 当前限制

- 数学 MM-SPEC-01 的旧独立结论仍为 FAIL；固定修复已进入本组合，独立定向复验未返回，不能声明数学独立 PASS。
- 题库来源仍为 PARTIAL：图片和扫描 PDF 自动识别缺失，旧 DOC 本机验证及题库内部审查待根接续。资源旧 DOC 对象丢失风险仍保留。全部手动业务组合验收未完成。
- 目标 Word/WPS、课堂设备、iPad、大陆网络及正式部署验证按现有取舍暂缓。

本轮只操作 `integration/manual-business`，未接触预览树、`50880` 服务、用户库、配置或产品 Agent。注入的 `AGENTS.md` 改动保留且不提交。

```yaml
task: MANUAL-INTEGRATION@1
attempt: 1
batch: MANUAL-TEACHING+MANUAL-MATH-FIX
role: integration
status: PASS
verification_level: self-integration
runner: "Codex / gpt-6-sol / high"
skills_used: [writing-for-agents, resolving-merge-conflicts]
base_revision: "49b77fad4464444da1f1e6ae1cdc72143cbec6fb"
source_revisions: ["fec1dcb93c90a6ab01b70a0937bd6156275e4e94", "81c0afc20ab7a5ecac01dad4a28ee78dbbe0ed0f", "9854accdaea59a1f8395d8de2c0dd9754c3220af", "7f39541a2464e248de5307a818f75afb8f5c4283", "d8f68a00374884b47ef40d685ee1866a8c245437", "e7878e6accfe95d8e273d58190425748647297f6"]
combined_revision: "f07665738da708bfdc1ff642e63fdc5d37c2991c"
result_revision: "见包含本报告的提交"
checks: ["npm run build PASS", "反馈往返 1/1 PASS", "日程资料接线 1/1 PASS", "数学修复定向 2/2 PASS", "限定 diff check PASS"]
open_items: ["MM-SPEC-01 独立定向复验待返回", "题库视觉识别缺失及旧 DOC/内部审查待接续", "整体手动业务组合验收未完成", "预览树写权尚未交回"]
next_condition: "根通知下一批固定提交及适用写权后恢复本会话"
```
