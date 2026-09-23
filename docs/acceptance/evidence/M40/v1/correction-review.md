# C23 数学修正独立核验

**PASS（限定，independent）**。固定候选 `d1490531e014ef437374c2f5a23cf3073baeef56` 满足[原审查](review.md)三项最小关闭条件，M40-DR-001/002/003 均可关闭。本次足以关闭 M40 原审查的三个 C23 实验缺口；M40 仍需将实验消费引用更新为该固定候选与本报告。本报告不替代该文档交接，不扩大 R31/M41 放行，也不签署整个产品验收。

## 回执

```yaml
task: C23-MATH-REVIEW@1
revision: M40/v1
attempt: 1
role: acceptance
status: PASS
verification_level: independent
finished_at_utc: "2026-09-22T05:51:42Z"
session_id: "01a0c7a8-9494-7672-9e16-cfa5034ea18d"
runner: "Codex CLI；gpt-6-astra；medium；Node 22.23.2；Linux Chrome 152.0.7977.64"
skills_used: [writing-for-agents]
base_revision: "3da472ed10b87a18c7923eee97ce9b154ca76706"
candidate_revision: "d1490531e014ef437374c2f5a23cf3073baeef56"
result_revision: "本报告及 correction-evidence/ 所在提交；最终 SHA 见本 session 最终回执"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "3da472ed10b87a18c7923eee97ce9b154ca76706:docs/acceptance/evidence/M40/v1/review.md"
  - "d1490531e014ef437374c2f5a23cf3073baeef56:docs/acceptance/evidence/C23-MATH-CORRECTION/v1/author.md"
  - "d1490531e014ef437374c2f5a23cf3073baeef56:experiments/C23/app/ 与 run/verify-correction.mjs"
  - "docs/arch/capability-checks/C23.md 的 MA-01/MA-03；samples.md 的 M-F/M-D"
  - "/home/liam_t/项目/TeacherWorkspace-mvp/docs/plans/execution-protocol.md：独立验收、回执与 skill 条款，只读"
changed_files:
  - docs/acceptance/evidence/M40/v1/correction-review.md
  - docs/acceptance/evidence/M40/v1/correction-evidence/
artifacts:
  - "correction-evidence/SHA256SUMS：本次全部证据校验值"
  - "correction-evidence/source-sha256.json：候选运行源与既有验证入口校验值"
checks:
  - "独立导出候选并运行 node run/verify-correction.mjs all：49/49 PASS"
  - "真实指针、Ctrl+A 与 Input.insertText 编辑范围/标题，保存、整个浏览器正常退出重启：PASS"
  - "真实 SVG/PNG 读取与目视，说明全文、透明及边界核对：PASS"
  - "固定 a=1,h=1,k=-4 第二步编辑页与禁网新配置离线制品一致：PASS"
  - "候选只读工作区核验前后 git status --short 为空；运行源与候选 git blob 逐字节一致"
identity_mode: "不适用：C23 本地实验，无产品身份"
open_items:
  - "M40 更新 math-evidence.md 与回执中的固定实验消费引用；本任务无该写权"
  - "R31 仍受 R30 整体门槛约束；M41 仍需 M40 冻结交接及 R31 固定交付"
  - "Windows/Office/WPS、课堂及触屏目标设备沿原门禁补测；本次仅 Linux Chrome"
failure_owner: null
next_condition: "M40 消费 d1490531e014ef437374c2f5a23cf3073baeef56 和本次 independent PASS，完成限定冻结交接；无需重做未变 C23 实验"
authorization_used: "用户 C23-MATH-REVIEW@1 / attempt 1：只新增本报告及必要证据，允许本分支提交；无 main/push/部署/根台账写入"
```

## 三项关闭判断

| 原缺口 | 预期及本次实际结果 | 证据 |
| --- | --- | --- |
| M40-DR-001 | 两份固定 M-F 的真实下载 PNG/SVG 均含完整中文说明。直接打开 SVG 核对全文与显示；PNG 放在黄色背景上，根号、分式、上下标、分段括号及说明完整，无白底、不裁切。PNG 透明像素分别为 94.14% 和 93.87%，四边最小留白 36 px。关闭。 | [下载物](correction-evidence/downloads/)、[PNG 背景/alpha 对照](correction-evidence/visual/)、[求根 SVG 读取截图](correction-evidence/screenshots/independent-quadratic-svg.png)、[分段 SVG 读取截图](correction-evidence/screenshots/independent-piecewise-svg.png) |
| M40-DR-002 | 将 a 范围改为 [-2.5,2.5]、步长 0.5、第二步标题改为“2 平移与顶点”，保存、关闭标签页重开读回同值；新下载离线物保留这些值。补做真实指针/键盘输入与整个浏览器正常退出重启，同值恢复。关闭。 | [重开截图](correction-evidence/screenshots/ma03-reopened-ranges.png)、[完整浏览器重启截图](correction-evidence/screenshots/independent-real-input-restart.png)、[补充结果](correction-evidence/supplement.json)、[范围修改离线物](correction-evidence/downloads/M-D-offline-ranges.html) |
| M40-DR-003 | 固定 a=1,h=1,k=-4，第二步显示 y=1(x-1)²+-4，曲线最低点、顶点圆点及标注同为 (1,-4)。SVG 坐标顶点为 (300,261.333...)，采样曲线最低点与其偏差小于 1 px。新下载 M-D 在制作浏览器退出后，经全新配置、失效代理及禁网复核，曲线路径逐点、顶点、标注及公式与编辑页一致，范围/标题也一致。关闭。 | [编辑页](correction-evidence/screenshots/dr003-step2-editor.png)、[离线页](correction-evidence/screenshots/dr003-step2-offline.png)、[真实离线制品](correction-evidence/downloads/M-D-offline.html)、[逐项机器结果](correction-evidence/verification.json) |

## 运行与证据可信边界

运行目录为 `/tmp/c23-math-independent-1/`，从候选 SHA 用 `git archive` 提取 `experiments/C23/app` 和 `experiments/C23/run`，没有复制作者的 generated 输出。受测 worktree `/home/liam_t/项目/TeacherWorkspace-c23` 始终只读。主验证入口未修改，`TMPDIR` 指向本次独占目录，避免脚本清理共享浏览器配置。运行源与候选 blob 已逐字节核对，见 [source-sha256.json](correction-evidence/source-sha256.json)。

```bash
mkdir -p /tmp/c23-math-independent-1/source /tmp/c23-math-independent-1/tmp
git archive d1490531e014ef437374c2f5a23cf3073baeef56 experiments/C23/app experiments/C23/run | tar -x -C /tmp/c23-math-independent-1/source
TMPDIR=/tmp/c23-math-independent-1/tmp node /tmp/c23-math-independent-1/source/experiments/C23/run/verify-correction.mjs all
```

[run.log](correction-evidence/run.log) 和 [verification.json](correction-evidence/verification.json) 为本次独立运行结果。后者保留脚本原有的作者 task 标签及当时绝对路径，不能将该标签当成本次任务身份；本次身份由本报告和证据提交固定。下载物、截图和原始结果已归档至相邻目录，原临时路径不再是读取入口。

原入口以 DOM 合成 input/click 驱动控件，因此另用 CDP `Input.dispatchMouseEvent`、Ctrl+A、`Input.insertText` 经过实际可点击区域完成同一编辑保存流程，并正常关闭整个 Chrome 后以同一独占配置重启。补充脚本复用原脚本 `// ---------------------------------------------------------------- main` 之前的辅助函数，再接 [supplement-tail.mjs](correction-evidence/supplement-tail.mjs)，置于隔离副本的 `run/independent-supplement.mjs`，使用同一 TMPDIR 执行。初次补充探针在文档布局就绪前点击，被可点击性保护拒绝；加入文档完成及两帧布局等待后通过，未改产品，也未绕过遮挡检查。结果见 [supplement.log](correction-evidence/supplement.log)。

制作页通过 file URL 运行，未启动制作服务器；离线前关闭制作浏览器。离线 Chrome 启动即带失效代理与域名解析阻断，随后应用 CDP offline，使用全新配置直接打开本次下载物。页面资源条目及捕获请求未发现 http(s) 依赖；不将这一有限制品结论外推为通用 HTML 网络安全证明。

## 保留的门禁

原审查其他设计判断与未变 C23 证据保持原效力。本次未重跑 MA-02、MA-04、M-X 或其他未变切片，没有新模型调用、产品修复或新增产品能力声明。M40 原三个实验阻断项已具备独立关闭依据，R31、M41、M43 及目标设备的依赖和验收仍按原审查执行。
