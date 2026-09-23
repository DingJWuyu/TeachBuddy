# MANUAL-MATH-ACCEPTANCE@1 / attempt 2

```yaml
task: MANUAL-MATH-ACCEPTANCE@1
attempt: 2
role: independent-acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-23T06:06:32Z"
session_id: unavailable
runner: "Codex / gpt-6-astra / medium"
skills_used: [writing-for-agents]
base_revision: cc5c014c8f6ffe7f859422361780ee18def3a3c0
candidate_revision: e7878e6accfe95d8e273d58190425748647297f6
product_revision: d8f68a00374884b47ef40d685ee1866a8c245437
result_revision: "包含本报告的提交；路径 docs/acceptance/evidence/MANUAL-MATH/v1/independent-fix.md"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: "定向实际复验，不重复源码 code-review"
internal_reviewers: []
identity_mode: "real-auth；页面注册与真实 Cookie；隔离内存邮件适配器"
open_items: []
closed_items: [MM-SPEC-01]
failure_owner: null
next_condition: "本次定向验收完成，由外层接收提交；目标设备验证按用户决定暂缓"
authorization_used: "用户 MANUAL-MATH-ACCEPTANCE@1 / attempt 2 任务包"
```

## 结论与版本

**独立 PASS，MM-SPEC-01 关闭。** 在固定候选实际页面上，纯文字步骤、已应用参数和未应用参数编辑稿均触发明确替换确认；取消后内容及应用状态保留，刷新后仍恢复；明确确认才替换。默认空白稿可直接使用起点并保存。

输入为 [independent.md](independent.md) 与 [fix.md](fix.md)。工作分支 `review/manual-math-fix`，受测 HEAD 为上列候选，候选与产品 SHA 的差异仅为 `fix.md`。依据 [U-MA0](../../../../ux/math.md#u-ma0-共同框架与保存) 的破坏性丢弃明确要求判断，不以测试退出码代替页面结果。

## 本轮实际验证

固定候选重新完整生产构建 PASS；原作者四条定向 Playwright E2E **4/4 PASS，12.6 秒**，没有重试。另以原独立现场 `.tmp-mm-independent/probe.mjs` 的注册、建稿和纯文字输入路径建立独占探针，补充参数及默认空白场景。使用正常点击和输入，未改产品或现成测试，未绕过控件可操作性。

环境：Linux、Chromium **153.0.8010.12**、1440×900。专用 TMPDIR 为 `.tmp-mm-recheck/`；每条场景独立 HTTPS 服务、数据库、文件目录与浏览器上下文。独立探针端口分别为 **38461、45207、44285、45499**，具体数据路径见 [results.json](independent-fix-artifacts/results.json)。账户通过页面真实注册，仅邮件适配器隔离。没有访问用户库或 50880，没有调用产品模型。

| 场景 | 预期与实际结果 |
| --- | --- |
| 纯文字步骤，无图形对象 | PASS。沿用原输入“判别式讨论”及说明，点击起点出现 1 次确认；取消后标题、说明和零对象保持，刷新仍一致。[取消后页面](independent-fix-artifacts/text-cancelled.png)。 |
| 已应用参数，无图形对象 | PASS。参数 t 最小值改为 -7 并应用；取消替换及刷新后仍为 -7，“应用参数 1”保持禁用，未退回待应用状态。[页面](independent-fix-artifacts/applied-cancelled.png)。 |
| 未应用参数稿，无图形对象 | PASS。参数 t 最小值编辑为 -7，尚未应用；取消替换及刷新后仍为 -7，“应用参数 1”保持可用，未丢编辑稿或擅自应用。[页面](independent-fix-artifacts/pending-cancelled.png)。 |
| 三类非空稿明确确认替换 | PASS。每类再次点击均再确认；接受后保存源为两个对象、参数 a/h/k、首步“母函数”，渲染 ready。刷新后首步标题及空说明恢复。[纯文字稿替换后](independent-fix-artifacts/text-replaced.png)。 |
| 默认空白稿 | PASS。自带参数 t、最小值 -5、无对象且无待应用编辑，使用起点时 0 次确认；保存成功，刷新恢复“母函数”。 |

实际确认文案为：“使用二次函数起点会替换当前演示的图形、参数和步骤，并丢弃未应用的参数编辑。是否继续？”结构化证据保存确认类型、文案、接受/取消动作、前后字段值与保存结果。四张真实页面截图已逐张查看，文字、参数状态和替换后的曲线可读，本次没有新阻断发现。

复跑作者定向测试：

```bash
mkdir -p .tmp-mm-recheck
TMPDIR="$PWD/.tmp-mm-recheck" npm run build
TMPDIR="$PWD/.tmp-mm-recheck" M42_EVIDENCE_DIR="$PWD/.tmp-mm-recheck/artifacts" \
  npx playwright test -c apps/web/e2e/manual-math.config.mjs \
  --output=.tmp-mm-recheck/results --grep '二次函数起点'
```

保留 [构建日志](independent-fix-artifacts/build.log)、[E2E 日志](independent-fix-artifacts/e2e.log) 和结构化独立探针结果。仅见既有 chunk 大小和 NO_COLOR/FORCE_COLOR 提示；`git diff --check` 通过。

## 原证据延续与边界

依任务授权，以下结论沿用 [原独立报告](independent.md)，**不标作本轮重跑**：动态参数改名/范围/步骤说明及对象增删；空白制作与拖动；对象重名保护；公式透明 PNG/SVG 与备课往返及保库重启；外部 HTML 导入/编辑/保存/下载；停服后动态及外部 HTML 的离线冷启动。平面函数、圆/椭圆、线段、多边形及空间点棱/标注仍沿用原报告已核对的作者证据。原 Standards PASS 以及修复作者内部审查结果保持原级别，本轮不追加源码审查。

本次只关闭原报告唯一未决项 MM-SPEC-01，结合上述延续证据，原选定手动数学范围解除该阻断。Agent 停工；目标设备、Word/WPS、平板、大陆网络与正式部署验证继续暂缓。此结论不宣称 M44 或旧 DAG 全验收完成。

只新增本报告及 `independent-fix-artifacts/` 四张截图、结果 JSON、两份日志并提交。产品与契约只读，注入 AGENTS.md 未提交；原失败现场 `.tmp-mm-independent/`、`independent-artifacts/` 和原下载物保留。本轮服务已关闭，证据固化后清理本轮 `.tmp-mm-recheck/`。不合并、不推送、不联系其他业务 session，完成后由外层通知根。
