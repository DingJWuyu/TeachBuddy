# MANUAL-SUPPORT-RECOVERY-ACCEPTANCE@1

结论：**PASS / independent**。固定候选支持恢复后新旧上传原文件取回；修复前逻辑生成的已有归档可直接读取，不需要用户再次执行恢复。无阻断缺陷。

```yaml
task: MANUAL-SUPPORT-RECOVERY-ACCEPTANCE@1
attempt: 1
role: acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-23T07:15:50Z"
session_id: "01a0cd19-0d90-7440-a10e-92f04b19c0f8"
runner: "Codex / gpt-6-astra / medium"
skills_used: [writing-for-agents]
base_revision: "a95463df86d9a467e4659cc2a38c07740d3be4b3"
product_revision: "b4f36312fef653a5c19c92686ca4ff74693f4755"
result_revision: "本报告所在提交，docs/acceptance/evidence/MANUAL-SUPPORT/v1/recovery-independent.md"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs: ["MANUAL-SUPPORT/v1/recovery-fix.md@a95463df86d9a467e4659cc2a38c07740d3be4b3"]
identity_mode: "real-auth；隔离验证码邮件替身"
open_items: []
failure_owner: null
next_condition: "使用固定产品候选重新构建，在独占环境按下列入口复跑；本报告不授权预览更新或 main 合流。"
authorization_used: "用户 MANUAL-SUPPORT-RECOVERY-ACCEPTANCE@1 任务包"
```

| 检查 | 实际结果 |
| --- | --- |
| 固定版本与构建 | HEAD 等于指定候选；候选相对产品提交只增加作者报告和截图。重新执行 `npm run build:web` 成功。 |
| 实际恢复 | 原作者入口 1/1 PASS，8.6 秒。真实注册、停服、backup、restore、activate、原端口启动、重登；recoveryId 改变，活动请求指针移除。 |
| 设置页下载 | 题库、资源、数学各两个新格式分支，以及旧资源、旧数学格式，共 8 份文件全部下载并比对内容；相同指针重复出现时仅一个下载按钮。 |
| 已有归档兼容 | 独立补充入口 1/1 PASS，8.9 秒。实际恢复后，在候选加载前执行基线 `655d4595b09328d3b3475bcb285b3582f99c8a0a` 原始浏览器归档模块，生成已隔离归档和已更新 tracker。候选直接读取并完成 8 份下载。 |
| 无需再次恢复 | 上述已有归档读取后只重启服务、刷新设置页、展开记录，再次下载 8 份文件，文件名及 Buffer 字节全部一致；归档原文、归档数量、浏览器 tracker 和库内 recoveryId 不变。没有第二次 backup、restore 或 activate。 |
| 不自动重放 | 进入题库、资源、数学并刷新，下载前后及重启后捕获的文件上传 POST、指定旧幂等键请求均为 0。 |
| 影响回归 | 作者上传入口 3/3 PASS，11.1 秒：资源两标签页上传及原字节重选校验、题库刷新后原摘要/原键确认、数学 HTML 重开后原键确认。 |
| 页面与差异 | 实际设置页截图已目视核对，下载按钮可由 Playwright 正常点击；`git diff --check` 通过。未改产品源码。 |

证据：[执行日志](recovery-independent.log)、[重启后设置页](recovery-independent.png)、[已有归档补充用例](recovery-existing.spec.mjs)、[补充配置](recovery-independent.config.mjs)。这四项与本报告构成本次全部提交文件。

复跑时在当前工作树创建自己的短 TMPDIR 和 `.tmp-ms`，使用现有锁定依赖重新构建 Web，然后执行：

```bash
./node_modules/.bin/playwright test -c apps/web/e2e/manual-data/manual-data.config.mjs recovery-upload.spec.js
./node_modules/.bin/playwright test -c apps/web/e2e/manual-support/playwright.config.mjs --grep '资源两标签页上传|题库原文件刷新|数学 HTML 上传'
./node_modules/.bin/playwright test -c docs/acceptance/evidence/MANUAL-SUPPORT/v1/recovery-independent.config.mjs
```

本次 TMPDIR 为独占 `/tmp/msra-0723`，数据库及文件位于其随机子目录和本树新建的 `.tmp-ms/support-*`；HTTPS 随机 loopback 端口，浏览器使用独立 context。补充用例沿用作者入口，仅增加旧归档生成、重启和不变性断言。历史兼容检查执行的是基线归档模块，不宣称运行过完整旧版部署；原文件恢复样本由 IndexedDB/localStorage 注入，真实文件选择和上传由三项影响回归覆盖。所有真实认证均使用本次隔离账户，不使用用户库或真实邮件服务。

补充脚本开发时曾因模块后缀和遗漏展开折叠记录而未完成；最终 `.mjs` 入口包含真实展开动作并完整通过，产品未因此修改。构建只有大包体积提示，测试有颜色环境提示，无构建或产品测试失败残留。

范围限于原文件恢复与相关上传回归，未重跑完整 DATA/SUPPORT，未重复源码双轴，未启动产品 Agent 或联系其他 session。原 preview、配置、main 和远端均未操作，AGENTS.md 保持未提交。验收完成后清理本次临时库、测试输出及临时脚本，正式证据保留于上述路径。
