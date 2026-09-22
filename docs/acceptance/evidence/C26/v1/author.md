# C26@1 / attempt 1 作者回执

本候选提供真实 pi 首页、共享右栏、持久对话/草稿/引用与题库/备课 13 个业务工具。作者自验 PASS，内部双轴审查的阻断发现均关闭；等待外层派发 C27，不作 independent 或 MVP 放行声明。

```yaml
task: C26@1
attempt: 1
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T09:01:23Z"
session_id: "01a0c819-d958-7c31-bc69-0833f485fc83"
runner: "Codex CLI / gpt-6-astra / low"
skills_used: [writing-for-agents, implement, tdd, codebase-design, diagnosing-bugs, code-review]
base_revision: "5614cf99f8b7ad9ff1f6dbf0467dd30eaf922545"
result_revision: "127c7e55b006acd5a06ad460f3380963cb51bce0"
review_target:
  fixed_point: "5614cf99f8b7ad9ff1f6dbf0467dd30eaf922545"
  commit_range: "5614cf99f8b7ad9ff1f6dbf0467dd30eaf922545...3156549c083fbc56b817cd2ea82f9cf82375e9f2"
  correction: "127c7e55b006acd5a06ad460f3380963cb51bce0"
  standards: PASS
  spec: PASS
  aggregate: "docs/acceptance/evidence/C26/v1/review.md；Spec 初审 FAIL，修复定向复核 PASS"
internal_reviewers:
  - "Standards / Codex / gpt-6-astra / low / 只读叶子"
  - "Spec / Codex / gpt-6-astra / low / 只读叶子"
identity_mode: "real-api/fake-mail；真实 Cookie/页面绑定/HTTPS，无测试身份外壳"
failure_owner: null
next_condition: "外层以固定产品及本回执派 C27；复制保留库并使用独占目录、端口和 profile"
authorization_used: "本次用户 C26@1/attempt 1 派发，固定输入整合、分支提交及两精确模型 GOAT 必要自验授权"
```

result_revision 是完整产品和测试候选 SHA；本回执、聚合报告和校验清单由后续证据提交补齐，不改变产品。完整 [变更文件清单](changed-files.txt) 相对于组合基线生成；正式证据校验见 [artifacts.sha256](artifacts.sha256)。

## 固定输入与候选

- 分支 `feat/c26-agent`，从 main `e365dea` 建立。组合基线、内部 code-review fixed point：`5614cf99f8b7ad9ff1f6dbf0467dd30eaf922545`。
- A11 产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf`，包含 B16 `612f0a9868743a1d5eea7e6f236d3ff903752439`。完整 apps/packages 输入按该 Git 对象整合；认证内部此后未修改，保留退出/恢复修复。
- A11 作者证据 `4f45b40a323ff3db56e39d647367269bee63c214`；其文内旧候选字样不覆盖固定产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf`。
- C25 设计 `18293e9389e739ed8aaf67ee568503ca8e87d475`、作者 `5e1193524c9d1d91c3a35adec3df3c832313819b`、独立冻结 `741025bd0a8e09098b5877428b81c2bdd7f357d0`。原 `e0b2c23fc1e37c357831cefacb0817c07ae3cafd` 未变结论沿用；源文件候选字样不改变冻结。
- A12 本地结论 `aaa3d77accbfc743f47edfb1ffc385735b2bf3db`，身份为 real-api/fake-mail；真实邮件及目标物理设备仍未验收。
- 当前编排台账、协议及其他业务候选没有导入或改写。仅本分支提交，不合 main/push/部署。

## 实际验证与请求账

使用 Node 22.23.2、pi coding-agent/agent-core/ai 均固定 0.85.1、真实 SQLite、HTTPS 和独立浏览器 context。常规 SDK 测试明确替换 provider，未替换业务操作；邮件替身不发送外部邮件。浏览器基线从真实注册后的缺失“新对话”开始，见 [red](logs/browser-baseline-red.log)。

| 场景 | 当前证据 |
| --- | --- |
| WB-AG-001/002/003/004 | [浏览器测试](../../../../../apps/web/e2e/c26/agent.spec.js)，首页/右栏/刷新、独立 context、1440/820/390 视口及保留 live 库重启 |
| WB-AG-005/006 | 草稿冲突双方内容、明确选择保存；引用版本/软删除拒绝和发送快照，见 [API](logs/agent-api.log)、[浏览器](logs/agent-browser.log) |
| WB-AG-007/008 | 两模型真实查询/读取/复制/指定环节写入；共用 operations 保持旧规则，首流与布尔筛选回归 |
| WB-AG-009/010 | 复制成功后备课 409 保留副本；Agent 写入触发手工题面冲突但不覆盖输入；浏览器真实丢弃已提交 202 后按原键重试，下一条输入保留 |
| WB-AG-011/019/020 | 真实 HTTPS SSE 游标补发、无 assistant 的 404 卡、空结果、刷新不重查 |
| WB-AG-012/013/014/021/022/023 | journal 提交失败后按原键原体核实；原题改 v2 后仍返回 v1 来源副本；读取异常、同批取消、停止已确认写入与同批取消、三个 SIGKILL 检查点、SDK isError；[修复前失败](logs/journal-failure-red.log)与当前 API 日志分别保留 |
| WB-AG-015/016/017/018 | 真实身份撤销与账户 404、模型白名单、usage 不完整、12 请求上限；SDK unknown/实际 ID 不符零请求、provider 额度错误不重试、prepared 落盘失败无副作用、损坏 entries 保留 |

最终命令结果：

- `npm run test:api`：164/164，包含 22 项 Agent 集成测试，[日志](logs/all-api.log)。`node --test apps/api/test/agent.test.js`：22/22，[定向日志](logs/agent-api.log)。
- `npm run test:agent:e2e`：9/9，[日志](logs/agent-browser.log)。两份 live 保留库均复制到测试独占目录，三个视口检查页面和每张卡片边界，打开实际副本及备课。另有草稿/重连、202 丢失、手工编辑冲突。
- `npm run test:e2e`：10/10，覆盖 A11 退出/恢复修复和真实首流，[日志](logs/auth-browser.log)。构建与浏览器并行造成 dist 短时缺失的无效执行记录单列为 [运行干扰](logs/build-browser-overlap-invalid.log)，正式结果来自构建完成后的串行执行，不归因于认证产品。
- `npm run build`：PASS，[日志](logs/build.log)。保留 Vite 大块提示；没有 lint script。实际 Node/npm/SDK 版本见 [版本](logs/versions.log)。
- 空库迁移由常规 fixture 覆盖；[固定 A11 升级](logs/a11-upgrade.log) 从精确 Git 对象导出 API 创建旧库，再打开当前产品，认证、原题保持，Agent 迁移只应用一次。[SIGKILL](logs/crash-checkpoints.log) 在 prepared、业务已提交、toolResult 已持久化三个边界真正终止子进程，重启不发模型请求。
- [13 工具接线](logs/all-tools.log) 使用真实 SDK 和共用业务 operations，覆盖题目/备课创建、修改、读取、查询、复制、衍生、使用情况、软删除和恢复；[停止](logs/stop-after-write.log) 在真实身份核验边界暂停第二调用，以真实 HTTP 停止，已保存对象保留。
- 内部双轴聚合见 [review.md](review.md)：Standards PASS，2 个非阻断重复代码判断；Spec 初审的 2 个恢复缺陷经浏览器复现、修复及定向复核关闭。

真实模型请求只用于本批业务链，没有重跑 C24，也没有未知模型 fallback：

| 模型 | 请求数 | input | output | cacheRead | reasoning | totalTokens | 未完成请求 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| DeepSeek | 5 | 7988 | 1722 | 29440 | 575 | 39150 | 0 |
| GLM | 5 | 9979 | 2694 | 28160 | 1667 | 40833 | 0 |

cacheWrite 均 0；reasoning 是细分，不再加到 totalTokens。实际费用和余额未知，不把 SDK cost=0 当账单。逐请求 ordinal、usage、公开快照和原生工具结果分别见 [DeepSeek](live-deepseek.json)、[GLM](live-glm.json)。二者均将“首项5、公差3、前8项和”的改编题保存为答案124，原题保持，目标“小组挑战”新增唯一引用。实际 live 命令为 `node apps/api/test/fixtures/c26/live.mjs deepseek/deepseek-v4.1-flash` 与 `node apps/api/test/fixtures/c26/live.mjs z-ai/glm-5.3-flash`，各执行一条完整业务链；本回执不是重复执行授权。

## C27 可复现入口

先 `npm ci && npm run build`。以下数据目录仍保留原始 SQLite，独立验收应复制到自有目录后启动，不能并发共用作者数据库：

- DeepSeek：`test-results/c26-live-deepseek-1790064962037`。
- GLM：`test-results/c26-live-glm-1790065052563`。

```bash
c27_data_dir="$(mktemp -d /tmp/c27-agent-readback-XXXXXX)"
cp test-results/c26-live-deepseek-1790064962037/workspace.sqlite "$c27_data_dir/workspace.sqlite"
npm run review:agent -- "$c27_data_dir" 44627
```

浏览器打开 `https://localhost:44627`，本地自签证书需测试 profile 允许。已有本地测试账户分别为 `c26-deepseek@example.test`、`c26-glm@example.test`，密码均 `c26-live-local-password`。这些是隔离验证账户；不发送邮件，不是外部真实认证结论。默认不配置模型，只读取历史和业务；新的 live 调用须按 C27 当次授权提供服务端配置。模型密钥不得写浏览器或证据。

`npm run test:agent` 与 `npm run test:agent:e2e` 为定向命令，`npm run test:api`、`npm run test:e2e`、`npm run build` 为回归。自验隔离 HTTPS 使用操作系统独占随机端口；手动验证曾使用独占 `test-results/chrome-c26` profile 和端口44626，服务已停止，临时 profile 已清理。精确命令及结果保存在 logs，截图保存于本目录。物理 Pad、邮件及部署不在本地视口结论内。

## 未决边界与交付

- C27 独立验收尚未执行，由外层派发；本报告仅 self。
- A12 的真实邮件及目标物理设备仍未通过。本批真实认证入口使用 fake-mail；旧首流 API 中的 test-principal 是沿用的模块回归夹具，不是本批浏览器或 live 身份。
- provider 账单和余额未知。两模型共 10 次请求、79,983 totalTokens、0 未完成调用；恢复/故障测试均为标明的 provider 替身，没有伪装 live 或新增付费探针。
- Vite 主 JS 大于 500 kB 的构建提示保留，构建成功；未引入额外缓存或调度层。Standards 两项重复代码判断保留，见聚合报告。
- 原 A11/B16/A12 未受影响的独立结论沿用；本批实际接线、故障恢复和视觉由上述证据支撑，不能移作 C27 independent 结论。认证内部、App.jsx、编排台账及协议相对组合基线没有改动。
- 只提交本分支；没有合 main、push、部署、外部邮件或采购。保留 live SQLite 和正式制品供 C27 复现；本 session 不发送外层完成通知。
