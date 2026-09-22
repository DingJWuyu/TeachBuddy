# TEACHING-MATH-INTEGRATION@1 attempt 1 合流回执

**PASS / self**。已以教学完整候选 `c5b0a59f7f137fc1cc41bdcb2707ee6a1a6c9ebf` 为主输入，再纳入数学工具滚动候选 `a13d7e83a77c174121f6979fea32cf1bbd4e185a`。合流组合提交为 `e8c30afe4281d19e41e5f5ee620d52182f13a6bd`。完整候选为本回执和定向验证证据所在提交，由最终唯一回调给出完整 SHA。

本回执只记录最小 Git 合流和合理定向自验，不代签教学独立产品验收、M44/2 独立复验、完整阶段、历史观察或目标设备结论。

## 合流与保留证明

- 第一次 Git merge 无冲突纳入 `c5b0a59f`，保留起点根 `README.md`。教学产品核心 18 个文件的 blob 与 `72143e6b2d6a444057ae87fec801ca2b3d7ff0ad` 逐一相同，3 个补充测试文件与 `6ab25c0e094e0ac58e4b50caa9a0d13a4b99167c` 逐一相同，42 个实现回执证据文件与 `c5b0a59f` 逐一相同。
- 第二次 Git merge 纳入 `a13d7e8`。仅 `docs/plans/mvp-dag.md` 和 `docs/plans/run-state.md` 冲突，按任务授权保留起点内容。`math.css`、两个 math-scroll 测试和三个专用 fixture 的 blob 与 `a13d7e8` 逐一相同。
- `apps/web/src/features/math/math.css` 当前 blob 为 `b95931dd6d591fe21300eb83284f919dffea6534`，与数学产品提交 `1c519f737d12da716d7c44cab804681c8004b838` 相同。
- `AGENTS.md`、根 `README.md`、`docs/plans/run-state.md`、`docs/plans/mvp-dag.md`、`docs/ROADMAP.md` 和 `docs/plans/execution-protocol.md` 均与起点 `b3a2eb665f29c4485729ecf70005ef15c93f0a4b` 的 blob 相同。设计输入 `1a60db5a16860f5e411c59a3d4a7f4fdc17b751a` 和独立冻结 `5548338514b7ead6a9374ee543fb7e2c08d357c0` 未改写。

## 同一候选定向自验

验证在合流提交 `e8c30af` 的非隐藏独立 checkout 中进行，使用独立磁盘 `TMPDIR`、测试库、随机 HTTPS 端口和浏览器 context。真实认证使用 fake-mail 和自签证书，未读取产品密钥，未发送产品模型请求。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm run build` | PASS；shared catalog、隔离 SQLite 迁移和 Web 生产构建通过；仅既有大 chunk 提示 | [build.log](verification/build.log) |
| 教学丰富题往返与反馈 | 2/2 PASS；丰富题选择、显式保存、两班反馈、原记录返回、失败恢复、冲突和身份草稿保护 | [teaching-results.json](verification/teaching-results.json)、[teaching.log](verification/teaching.log)、[rich-desktop.png](verification/teaching/rich-desktop.png)、[feedback-tablet.png](verification/teaching/feedback-tablet.png) |
| 数学工具滚动 | 5/5 PASS；普通滚轮最小路径、三尺寸四类编辑与保存刷新、边界不串滚、AI 草稿、备课带回 | [math-scroll-results.json](verification/math-scroll-results.json)、[math-scroll.log](verification/math-scroll.log)、[1440×900](verification/math-scroll/1440x900/result.json)、[1024×768](verification/math-scroll/1024x768/result.json)、[768×1024](verification/math-scroll/768x1024/result.json) |
| 截图视觉核对 | PASS；教学桌面/平板与数学桌面/窄屏内容可达，无清晰截断、横向溢出或控件挤压回归 | 上述截图及 [dynamic-steps.png](verification/math-scroll/1440x900/dynamic-steps.png)、[space-edge.png](verification/math-scroll/768x1024/space-edge.png) |

首次将运行副本放在 `/tmp` 时，依赖安装因 tmpfs 仅余 191 MiB 发生 `ENOSPC`，尚未进入构建或产品测试。改用有充足空间的短路径磁盘副本后，上述检查全部通过；该观察属于运行环境，不归属产品缺陷。

## 独立验收入口

1. 从最终回调给出的完整候选 SHA 建立非隐藏 checkout，使用独立短磁盘 `TMPDIR`、库、随机端口和浏览器。
2. 教学独立产品验收从 `docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/implementation/README.md` 进入，按 WB-MTA001-007 及受影响切片复验。
3. 数学滚动定向复验使用 `M43_SCROLL_EVIDENCE` 和 `M43_SCROLL_RESULTS` 指向验收者自有路径，运行 `npx playwright test -c apps/web/e2e/fixtures/math-scroll/playwright.config.mjs`。M44 旧固定输入不因本合流切换。

```yaml
task: TEACHING-MATH-INTEGRATION@1
attempt: 1
role: integration
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T17:23:52Z"
session_id: unavailable
runner: "Codex / gpt-5.6-sol / medium"
skills_used: [resolving-merge-conflicts]
base_revision: "b3a2eb665f29c4485729ecf70005ef15c93f0a4b"
composition_revision: "e8c30afe4281d19e41e5f5ee620d52182f13a6bd"
result_revision: "本回执所在完整提交；由最终唯一回调固定完整 SHA"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "c5b0a59f7f137fc1cc41bdcb2707ee6a1a6c9ebf; product 72143e6b2d6a444057ae87fec801ca2b3d7ff0ad; tests 6ab25c0e094e0ac58e4b50caa9a0d13a4b99167c; fixed point 2682475041aa187e3cd50ad743dc5e5bc243feda"
  - "a13d7e83a77c174121f6979fea32cf1bbd4e185a; product 1c519f737d12da716d7c44cab804681c8004b838"
  - "common product base 5da13ab3963a60948a69ae03ab5cf5f0988df13f"
  - "design 1a60db5a16860f5e411c59a3d4a7f4fdc17b751a; independent freeze 5548338514b7ead6a9374ee543fb7e2c08d357c0"
changed_files:
  - "c5b0a59f 的产品、测试和 MATERIALS-TEACHING-ALIGNMENT 实现证据，根 README 除外"
  - "a13d7e8 的 math.css、math-scroll 测试/fixture 和 M43 scroll-fix 证据，起点受保护文档除外"
  - "docs/acceptance/evidence/TEACHING-MATH-INTEGRATION/v1/receipt.md"
  - "docs/acceptance/evidence/TEACHING-MATH-INTEGRATION/v1/verification/"
artifacts:
  - "docs/acceptance/evidence/TEACHING-MATH-INTEGRATION/v1/receipt.md"
  - "docs/acceptance/evidence/TEACHING-MATH-INTEGRATION/v1/verification/"
checks:
  - "npm run build: PASS"
  - "materials-teaching real-auth browser: 2/2 PASS"
  - "math-scroll real-auth browser: 5/5 PASS"
  - "source blob retention and protected-document byte checks: PASS"
identity_mode: "real-auth / fake-mail / self-signed HTTPS"
product_model_requests: 0
product_key_reads: 0
failure_owner: null
next_condition: "完整候选独立 checkout，先做教学独立产品验收；M44/2 仍使用其原固定输入"
authorization_used: "用户授权当前分支限定合流、必要验证适配、回执与证据提交；不合 main、push、部署或写编排状态"
```
