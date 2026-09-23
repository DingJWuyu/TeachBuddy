# PREVIEW-AGENT@1 attempt 1

已交付可合入的六模块 Agent 接线候选。首页和共享右栏使用真实 Cookie 身份、持久会话、SSE、草稿和工具记录；原有 13 工具可读写当前题目 v2、备课 v3。结论为 self，不代表完整 MVP 或独立产品验收。未合 main、push 或部署。

## 固定候选与边界

- 产品及测试候选：`f2b08640e818943e68376e3dc05ebb174aa15278`，分支 `feat/preview-agent-integration`。最终证据提交由回调给出，包含此候选。
- 输入六模块组合：`9bd57469c041c365ede363acbba3b64784a9041d`；已正常合入本 worktree。审查固定基点：合流后 `dfaf4ee819d81917ba0ae30b227abdc4a7f496cd`。
- C26 完整来源：`ec5094c00d122c77d2acdb376f4ede96eafb13e0`，消费其 author/math-layout-fix；C25 契约来源：`18293e9389e739ed8aaf67ee568503ca8e87d475`。
- 入口、迁移、认证 transport 和当前业务端口逐处接线，未用旧 C26 全文件替换当前保护。v2 题目即使包含 Document v1，也按材料元数据识别，保留答案状态、分类及来源快照；旧接口拒绝窄化写入，历史已提交幂等回执仍可重放。未知文档版本只读保护保留。
- 变更文件清单见 [changed-files.txt](changed-files.txt)。不包含 F61 全 81 工具、F60 新功能、Pandoc 修复或其他 worktree 写入；未联系 PREVIEW-DELIVERY。

## 实际验证

| 场景 | 结果与证据 |
| --- | --- |
| 接线前真实浏览器注册 | 首页无新对话入口，Agent API 404：[baseline.log](baseline.log)、[截图](baseline.png) |
| 构建 | `npm run build` PASS，[build.log](build.log)；Vite 大 chunk 提示仍在 |
| 完整 API | 最终候选 332/332 PASS：[all-api-reviewed-office.log](all-api-reviewed-office.log) |
| 混合文档与保护 | 先重现元数据丢失，再修复，39/39 PASS：[mixed-version-red.log](mixed-version-red.log)、[mixed-version-green.log](mixed-version-green.log) |
| 真实认证浏览器 | 10/10 PASS：[auth-browser-verified.log](auth-browser-verified.log)，覆盖 Cookie、双账户/双页、刷新、退出、草稿隔离、迟到响应、业务保存响应丢失及原键重试、当前 15 个业务操作页面头 |
| Agent 浏览器 | 最终 9/9 PASS：[browser-reviewed.log](browser-reviewed.log)。其中 7 项为本候选草稿、冲突、丢响应、SDK 工具卡和断线恢复；另 2 项仅复制 C26 已有 DeepSeek/GLM 保留库并无模型重开，不是本轮两个模型实测 |
| 当前真实模型业务 | DeepSeek 两轮，保存改编题、原题不变、答案 124、备课指定环节引用最终正确；[live-ledger.json](live-ledger.json)、[live-correction.log](live-correction.log)、[题目](live-copy.png)、[备课](live-lesson.png) |
| 本轮数据普通进程重开 | 无模型配置启动新进程，重新真实登录；首页/六模块右栏共享同一记录，工具卡打开实际题目/备课，加入对话；1440、820、390 无横向溢出、无 pageerror：[readback.json](readback.json)、[窄屏](readback-390.png)、[引用](readback-reference.png) |

完整 API 最初的临时目录空间、旧迁移夹具路径、旧包依赖解析、固定端口重启连接问题已解决；原始失败日志保留。`all-api-reviewed.log` 的 8 项转换失败来自该次命令漏设 Office 路径，带下述目录的最终重跑全部通过。认证旧控件/路径断言已对齐当前界面，SSE 夹具关闭超时已解决。测试生成的其他节点证据恢复原字节，不纳入候选。

## 真实模型账本

本轮独立窗口共 **6 次请求 / 48000 completion token 上限**，已用尽请求次数。只调用 `deepseek/deepseek-v4.1-flash`，服务地址沿用 `https://api.commandcode.ai/provider/v1`，复用 C26 pi runtime、OpenAI completions 适配和服务端现有套餐。每请求上限 8000，自动重试关闭。未购买、未新增计费、未发外部邮件；本轮没有 GLM 模型请求。

| 轮次 | 请求 | input | output | cacheRead | reasoning | totalTokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 首次操作 | 4 | 33815 | 1534 | 99584 | 372 | 134933 |
| 指定环节纠正 | 2 | 35856 | 905 | 35840 | 250 | 72601 |
| 总计 | 6 | 69671 | 2439 | 135424 | 622 | 207534 |

reasoning 为供应商细分，不另加到总数。output 为 2439；即使保守把 reasoning 额外相加也只有 3061，低于 48000。实际金额未返回，账本 `actualCost: null`，不声称金额为零。没有额度或参数拒绝；首次脚本路径预检失败发生在模型请求前，记录见 `live-preflight-path-failure.log`。

首次模型把副本放入全课 `materials`，却声称进入“小组挑战”，因此业务断言失败。账本保留 `initialVerification`，不记为首轮通过。已明确工具说明中 `sections[].references` 与 `materials` 的区别，并在同一窗口剩余 2 次请求中纠正；业务页面核对最终正确。该结果证明接线可用，不能保证模型每次语义执行都正确。禁止重新执行 `live.mjs` 开新窗口；该脚本保留用于审计。

## 本地运行与复现

Node 22.23.2：`npm ci && npm run build`。常规产品启动按根 `.env.example` 配置独立 SQLite、HTTPS、真实认证和仅服务端的模型配置，再执行 `node --env-file=.env apps/api/src/server.js`。本候选不提供外部 SMTP 验收。

无新模型消耗的本轮保留库位于：

`/home/liam_t/项目/TeacherWorkspace-preview-agent/test-results/preview-agent-live/`

SQLite SHA-256：`fd8904487b0bc7bff35095e2d6165f71b87b27ce2265aa8c127ea015e1fdf6e1`。文件和库保留为正式本地验收制品，不提交假账户库和自签证书。启动：

```bash
mkdir -p test-results/preview-agent-tmp
TMPDIR="$PWD/test-results/preview-agent-tmp" node apps/api/test/fixtures/c26/serve.mjs test-results/preview-agent-live 50782
```

打开 `https://localhost:50782`，仅本地假账户 `preview-agent-live@example.test`，密码 `preview-agent-local-password`。此入口不加载真实模型配置，不发送外部邮件，只能重开现有内容；证书为本地自签。另一个终端可执行 `TMPDIR="$PWD/test-results/preview-agent-tmp" node docs/acceptance/evidence/PREVIEW-AGENT/v1/readback.mjs`，退出后停止该专用进程。

完整回归：

```bash
mkdir -p test-results/preview-agent-tmp
export TMPDIR="$PWD/test-results/preview-agent-tmp"
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
npm run test:api
A11_EVIDENCE_DIR="$PWD/docs/acceptance/evidence/PREVIEW-AGENT/v1/auth" npm run test:e2e
AGENT_EVIDENCE_DIR="$PWD/docs/acceptance/evidence/PREVIEW-AGENT/v1" npx playwright test -c apps/web/e2e/preview-agent/agent.config.mjs
```

最后一条中 2 项历史库重开依赖 C26 报告中的本地库；其他机器没有源库时用 `--grep-invert 'live模型结果'` 跑 7 项，再用本轮保留库独立重开。此处本机 9 项均完成且零新增模型请求。API 全量测试会写部分旧节点证据，运行后需只恢复本次生成的旧证据，不能把它们提交为本轮验收结果。

## Standards

PASS，最终复核候选 `f2b08640e818943e68376e3dc05ebb174aa15278`。无硬性违规。2 项非阻塞 P3 启发式建议：题库/备课 legacy HTTP 路由循环重复；`agent/tools.js` 两处已知拒绝条件重复。保持为后续可选整理，不以抽象化扩大本次范围。审查者只读，未自行执行测试。

## Spec

PASS，最终候选无未关闭阻塞。原 P1：Document v1 的当前 v2 题目可能经旧入口丢失元数据；已由模块内部 metadata 判别、当前端口回退和真实认证混合版本回归关闭。最终测试增量保留账户隔离、幂等重试和认证 transport 校验，无范围扩展。

审查统计：Standards 硬违规 0、建议 2，最高 P3；Spec 未关闭 0，原 P1 已关闭。

本任务专用服务及浏览器已停止，50781/50782 无监听。临时测试目录和已解决失败的临时现场已清理，正式日志、截图、账本及本轮保留库继续留存。

## 回执字段

```yaml
task: PREVIEW-AGENT@1
attempt: 1
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T20:37:00Z"
session_id: unavailable
runner: "Codex / gpt-6-astra / low"
skills_used: [diagnosing-bugs, code-review, writing-for-agents]
base_revision: "9bd57469c041c365ede363acbba3b64784a9041d"
result_revision: "f2b08640e818943e68376e3dc05ebb174aa15278；最终证据提交 SHA 见回调"
review_target:
  fixed_point: "dfaf4ee819d81917ba0ae30b227abdc4a7f496cd"
  commit_range: "dfaf4ee819d81917ba0ae30b227abdc4a7f496cd...f2b08640e818943e68376e3dc05ebb174aa15278"
  standards: PASS
  spec: PASS
  aggregate: "docs/acceptance/evidence/PREVIEW-AGENT/v1/receipt.md"
internal_reviewers: ["standards_review / Codex gpt-6-astra low，继承调用 session", "spec_review / Codex gpt-6-astra low，继承调用 session"]
inputs: ["9bd57469c041c365ede363acbba3b64784a9041d", "ec5094c00d122c77d2acdb376f4ede96eafb13e0", "18293e9389e739ed8aaf67ee568503ca8e87d475"]
changed_files: ["changed-files.txt", "docs/acceptance/evidence/PREVIEW-AGENT/v1/"]
artifacts: ["本回执及同目录日志/截图/账本", "test-results/preview-agent-live，保留库校验值见正文"]
checks: ["build PASS", "API 332/332", "真实认证浏览器10/10", "Agent浏览器9/9，其中2项只重开来源库", "本轮DeepSeek 6次请求，最终业务及重开PASS"]
identity_mode: "real-auth/fake-mail；既有API套件部分为test-principal，未冒充全真实认证"
open_items: ["组合独立验收由根后续安排", "模型首轮放置错误已纠正但语义可靠性不能泛化", "本轮未调用GLM", "Vite大chunk提示", "目标物理设备、外部邮件、可信证书、公开部署和Pandoc输出质量未验收"]
failure_owner: null
next_condition: "根串行纳入固定候选，在独立体验环境按正文运行；模型请求窗口已用尽"
authorization_used: "用户本轮PREVIEW-AGENT@1 attempt 1：隔离接线、6次/48000额度、分支提交；不合main、不push、不部署、不采购"
```
