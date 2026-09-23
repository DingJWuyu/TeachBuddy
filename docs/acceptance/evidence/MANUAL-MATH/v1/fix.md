# MANUAL-MATH@1 / attempt 2

- 角色：implementation；Codex / gpt-6-astra / low；verification_level=self；MM-SPEC-01 修复自验 PASS，待外层定向独立复验。
- 基线及审查 fixed point：`7f39541a2464e248de5307a818f75afb8f5c4283`。
- 产品与回归固定 SHA：`d8f68a00374884b47ef40d685ee1866a8c245437`；分支 `feat/manual-math-fix`。
- 范围：仅前端起点替换保护和必要 E2E；未改后端、公共契约或 Agent。

## 复现与实际结果

真实注册进入数学工坊，新建空白演示，无图形时添加步骤“判别式讨论”及说明，再点击“二次函数起点”。修复前实际页面未出现确认，显示母函数与二次曲线；回归在确认次数断言失败（预期1，实际0），与[独立缺陷](independent.md#mm-spec-01-复现及归属)一致。

修复按默认空白源及参数编辑稿判定是否需要确认；确认文案明确覆盖图形、参数、步骤及未应用编辑。默认空白源自带参数 t，仍可直接使用起点。

定向实际 E2E **4/4 PASS，14.7秒**：纯文字步骤、已应用参数、未应用参数编辑稿均验证取消后原值保留及刷新恢复，明确确认后替换、保存成功并刷新恢复；默认空白稿无需确认即可使用并保存。使用真实 Cookie、隔离测试邮件、专用 TMPDIR 与独立数据库、随机 HTTPS 端口，未触碰50880或用户数据。其余已通过数学场景未重跑。

复跑命令：

```bash
mkdir -p .tmp-mm-fix
TMPDIR="$PWD/.tmp-mm-fix" npm run build
TMPDIR="$PWD/.tmp-mm-fix" M42_EVIDENCE_DIR="$PWD/.tmp-mm-fix/artifacts" \
  npx playwright test -c apps/web/e2e/manual-math.config.mjs \
  --output=.tmp-mm-fix/results --grep '二次函数起点'
```

基线完整构建通过，修复后 `build:web` 通过；`git diff --check` 通过。仅有既有 chunk 大小及 NO_COLOR/FORCE_COLOR 提示。

## 内部审查

code-review 审查 `7f39541a...d8f68a00`，两个只读叶子继承调用模型与 effort，不重复旧范围。

- Standards：PASS，0项。符合仓库标准，未发现需修正的代码异味。
- Spec：PASS，0项。取消保留、确认替换、空白起点均符合 U-MA0 与 MM-SPEC-01，无范围扩展。

技能：diagnosing-bugs、implement、code-review、writing-for-agents。本轮临时目录清理；原 `.tmp-mm-independent/`、未完成验收制品及注入 AGENTS.md 保留且未提交。未合并、推送或联系其他业务 session。
