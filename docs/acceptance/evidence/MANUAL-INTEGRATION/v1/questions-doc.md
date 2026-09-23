# MANUAL-INTEGRATION@1 旧 DOC 收尾与数学独立结论

**PASS，限于本批集成自检。** 从组合基线 `d61744e90cf48eac5250eeadff3ec3a57f28188c` 顺序接入题库旧 DOC 产品收尾、题库接续回执和数学独立 PASS 证据。接入后组合候选为 `20b4b225bf1ac4bdf604fd31862c1a1e36e01c8e`；包含本报告的后继提交是本批交接点。数学当前结论以新 [独立复验报告](../../MANUAL-MATH/v1/independent-fix.md) 为准，MM-SPEC-01 已关闭；旧失败报告与先前“待复验”集成报告保持原始记录。

| 输入 | 来源 SHA | 本分支 SHA |
| --- | --- | --- |
| 旧 DOC 风险提示与本机验证 | `4a07e1073791f562011b6275ae8d2f133769cdc7` | `a2bf1c2e13c3d44f7be7d3aa6b556ff383028b9a` |
| 题库接续与内部双轴审查 | `200772bb3fcb7ea19afa6ecb11f8115792e3cd51` | `d833bb2de4997c86f4aba14204f9e38a7d563817` |
| 数学独立复验 PASS | `45cf0e6e49b0cc505d48ba55e42e9e8be1bce38a` | `20b4b225bf1ac4bdf604fd31862c1a1e36e01c8e` |

三笔固定提交直接应用，无冲突。题库产品增量仅在原稿预览页按 `legacy-object-loss` 显示旧 DOC 公式或对象丢失警告；README 同步本机转换能力和限制。没有改数学产品、API、依赖、迁移或 Agent。

## 证据与本次检查

- 来源 [题库接续回执](../../MANUAL-QUESTIONS/v1/continuation.md) 记录真实认证浏览器中旧 DOC 转换为 4 页 PDF、读取 3 个按页草稿、人工校对与裁图收录、保库重启后重开和原稿字节一致；其定向 E2E 1 PASS，内部双轴 0 项新增可修缺陷。这些是来源固定候选的实测，本次未重跑转换或改写截图、日志。
- 来源数学独立报告在固定修复候选上重新构建并独立核对纯文字步骤、已应用参数、未应用参数稿、明确替换及默认空白起点，结论 **independent PASS**，关闭 MM-SPEC-01。本批仅引入该报告及证据，没有把它写成新一轮集成浏览器测试。
- 本树独立 `TMPDIR` 下执行 `npm run build` 通过：六模块目录、隔离 SQLite 12 项迁移及 Web 生产包成功。README、产品和测试变更的限定 `git diff --check` 通过；核对数学报告候选 SHA 指向已集成的修复来源提交，README 保留统一入口、Agent 暂停与题库限制。Vite 仅有既有大包提示。

题库全范围仍为 **PARTIAL**：图片和扫描 PDF 缺视觉 provider；旧 DOC 的对象/公式可能丢失，文字层缺公式、按页草稿及答案归属需要人工核对，不能从来源的保存成功推定完整自动拆题。目标 Windows/Word/WPS、课堂设备等验证按现有取舍暂缓。五条业务成果及数学独立结论现已在同一集成分支，整体手动业务组合验收尚未完成。

本轮只操作 `integration/manual-business`；预览树、`50880` 服务、用户库、配置与工具来源树未接触。注入的 `AGENTS.md` 改动保留且不提交。

```yaml
task: MANUAL-INTEGRATION@1
attempt: 1
batch: MANUAL-QUESTIONS-DOC+MANUAL-MATH-INDEPENDENT
role: integration
status: PASS
verification_level: self-integration
runner: "Codex / gpt-6-sol / high"
skills_used: [writing-for-agents]
base_revision: "d61744e90cf48eac5250eeadff3ec3a57f28188c"
source_revisions: ["4a07e1073791f562011b6275ae8d2f133769cdc7", "200772bb3fcb7ea19afa6ecb11f8115792e3cd51", "45cf0e6e49b0cc505d48ba55e42e9e8be1bce38a"]
combined_revision: "20b4b225bf1ac4bdf604fd31862c1a1e36e01c8e"
result_revision: "见包含本报告的提交"
checks: ["npm run build PASS", "限定 diff check PASS", "固定题库与数学来源证据及组合接线核对 PASS"]
open_items: ["题库图片与扫描 PDF 视觉识别缺失", "旧 DOC 自动整理及对象/公式还原限制", "整体手动业务组合验收未完成", "预览树写权尚未交回"]
next_condition: "根通知下一批固定提交及适用写权后恢复本会话"
```
