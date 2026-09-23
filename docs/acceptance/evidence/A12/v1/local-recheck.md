# A12 本地定向独立复验

**A12-LOCAL@1 / attempt 2：PASS / independent。** 固定产品 `9ecabbf60cbbaecce2e9be8191d270068eb675cf` 上，A12-LOCAL-001、A12-LOCAL-002 及本次必要退出/会话回归通过，无新增缺陷。外部条件仍未满足，**不声明 A12 整体通过，不解除 F60 门禁**。

```yaml
task: A12-LOCAL@1
revision: v1
attempt: 2
role: acceptance
status: PASS
local_status: PASS
external_status: BLOCKED
verification_level: independent
finished_at_utc: "2026-09-22T07:07:01Z"
session_id: "01a0c7ea-45a9-7ee0-8373-a849de8e660a"
runner: "Codex CLI / gpt-6-astra / medium；已核对本 session turn_context"
skills_used: [writing-for-agents]
base_revision: "8bd41a55af991ddc70017cc19950b425fbd2df55"
product_revision: "9ecabbf60cbbaecce2e9be8191d270068eb675cf"
author_evidence_revision: "4f45b40a323ff3db56e39d647367269bee63c214"
result_revision: "本报告所在提交；完整 SHA 由最终回执返回，可用 git log -1 -- docs/acceptance/evidence/A12/v1/local-recheck.md 定位"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs:
  - "4f45b40a323ff3db56e39d647367269bee63c214:docs/acceptance/evidence/A11/v1/attempt3.md 及 scripts/"
  - "8bd41a55af991ddc70017cc19950b425fbd2df55:docs/acceptance/evidence/A12/v1/local-review.md"
  - "固定产品内 auth.md、auth.openapi.yaml、auth-cases.md、auth.feature；认证 1.0.0-rc.2"
  - "TeacherWorkspace-mvp 的 execution-protocol.md#acceptance、#receipt、design-and-verification.md、mvp-matrix.md 对应章节；规则文件校验见 input-integrity.json"
changed_files:
  - docs/acceptance/evidence/A12/v1/local-recheck.md
  - docs/acceptance/evidence/A12/v1/local-recheck/
artifacts: ["local-recheck/sha256.json", "local-recheck/environment.json", "local-recheck/input-integrity.json", "local-recheck/runs.json"]
checks:
  - "新隔离副本 npm ci、npm run build：PASS"
  - "A12-LOCAL-001 / WB-AUTH-017：两个全新库及浏览器原步骤 PASS；受控真实响应时序 PASS"
  - "A12-LOCAL-002 / WB-AUTH-015/019：桌面、Pad、手机 16px/18px，无溢出；截图审看、重试 PASS"
  - "退出已知失败、已提交但响应未知、同目标重试、刷新匿名：PASS"
  - "自然定时 I06 解除未知退出锁并同页重登：PASS，30292ms"
  - "独立浏览器同账户会话、同浏览器双账户定向退出、草稿及迟到业务响应隔离：PASS"
  - "真实认证集成 E2E：10 PASS；git diff --check：PASS"
identity_mode: "real-api/fake-mail"
open_items: [A10-EXT-001, A10-EXT-002, A10-OPS-001]
failure_owner: null
next_condition: "外层接收本地定向 independent PASS；外部门禁由其拥有者提供授权邮件、目标设备及恢复撤销证据后继续验收。"
authorization_used: "用户 A12-LOCAL@1 / attempt 2：只读固定产品和旧现场；新隔离环境；仅本分支新报告/脚本/脱敏证据提交；不发外部邮件、不读真实凭据、不合 main、不 push、不部署；外层唯一回调。"
```

## 实测结论与证据

| 场景、前置与操作 | 预期与实际 | 新证据 |
| --- | --- | --- |
| A12-LOCAL-001，两个独立空库/profile。UI 注册 remembered，同浏览器第二页恢复，在第二页设置退出，无故障注入 | 两页直接出现登录卡；第一页面提示已过期，退出页无准备登录错误；每轮仅一次 I07，无手动重试。PASS | [第一轮结果](local-recheck/multi-1/local-results.json)、[第二轮](local-recheck/multi-2/local-results.json)、[网络](local-recheck/multi-1/network.json)、[退出页截图](local-recheck/multi-1/second-tab-after-logout.png)、[另一页](local-recheck/multi-1/first-tab-after-logout.png) |
| A12-LOCAL-001，受控真实响应交错 | 重跑固定候选的时序回归，不伪造 HTTP 响应；两页登录，退出页重新登录成功，另一页仍无旧工作台。PASS | [integration.log 第 9 项](local-recheck/integration.log)、[截图](local-recheck/integration/shared-session-logout.png) |
| A12-LOCAL-002，真实 remembered 恢复，仅隔离 SQLite trigger 拒绝页面绑定 INSERT | 三视口显示恢复失败卡，正文距标题底边 16px、距首按钮 18px，均无横向溢出；移除 trigger 后真实点击重试进入工作台。PASS | [尺寸](local-recheck/layout/restore-layout.json)、[运行结果](local-recheck/layout/local-results.json)、[网络](local-recheck/layout/network.json)；[集成第 10 项](local-recheck/integration.log)另验证重试回原昵称 |
| WB-AUTH-017，存储拒绝退出，随后实际提交退出但浏览器丢弃响应 | 先显示退出失败；随后显示未确认及业务锁定提示；重试请求 sessionId 等于原目标，204 后回登录，刷新保持匿名。PASS | [logout 结果](local-recheck/logout/local-results.json)、[网络](local-recheck/logout/network.json)、[已知失败](local-recheck/logout/known-failure.png)、[未知结果](local-recheck/logout/unknown-result.png) |
| WB-AUTH-017，再次登录后丢弃真实退出响应，不点重试、不派发合成事件 | 保持页面可见，约 30 秒自然 I06 核验确认失效并回登录；同页表单重新登录成功，旧未知锁不阻止新身份。PASS | [30292ms 结果](local-recheck/logout/local-results.json)、[重新登录截图](local-recheck/logout/relogin-after-automatic-recheck.png) |
| 共享会话退出与独立登录隔离 | 同账户另一个独立浏览器正常登录；共享双页退出后，该独立浏览器刷新仍进入工作台。PASS | [independent 结果](local-recheck/independent/local-results.json)、[网络](local-recheck/independent/network.json) |
| 同浏览器不同账户；账户草稿和迟到响应 | A 定向退出后停在登录，B remembered 刷新仍有效；A 可重新登录；A 草稿不出现在 B，回 A 可恢复；迟到 A 业务内容不回填 B。PASS | [integration.log 第 5、8 项](local-recheck/integration.log)、[账户隔离截图](local-recheck/integration/account-isolation.png) |
| 恢复相邻的保存失败路径 | 激活存储失败显示保存登录状态；撤故障后继续当前页成功，刷新回登录，符合 page 模式。PASS | [layout 结果](local-recheck/layout/local-results.json)、[pending 截图](local-recheck/layout/mobile-pending.png) |

独立审看本次新截图：[桌面 1440×900](local-recheck/layout/desktop-restore.png)、[Pad 768×1024](local-recheck/layout/pad-restore.png)、[手机 390×844](local-recheck/layout/mobile-restore.png)。标题分隔线、正文与两个按钮均清楚可见，正文上下不再贴边；手机卡片保留两侧留白，文本不裁切，关键动作未溢出。双页登录及退出失败/未确认/重新登录截图也已审看。本次没有更改视觉门槛或产品样式。

两项原缺陷在本候选均可关闭本地修复项：A12-LOCAL-001 的实现归属仍为 A11 集成拥有者及认证前端拥有者，A12-LOCAL-002 归认证前端拥有者。未发现需另编号的新缺陷。

## 证据边界与复现

- 新 session 独立执行，未参加该修复实现或内部审查。本次仅实际 UI/API 验收，没有重复双轴 diff review。原报告未受影响的正常认证、真实对象隔离、持久重启、重置撤销、API 契约结论沿用其固定版本和证据，不伪称本次重跑了 142 项 API 或完整外部认证。
- `git archive` 从固定产品导出到 [environment.json](local-recheck/environment.json) 的独立临时目录。当前构建前逐一核对产品文件与 blob；冻结四文件与原产品逐字一致，原失败报告与固定提交一致，见 [input-integrity.json](local-recheck/input-integrity.json)。源 a11 工作树及所有旧 A12 报告/失败目录只读。
- Node v22.23.2，Playwright Chromium / Chrome for Testing 153.0.8010.12，生产 Web 构建，真实服务端认证，fake-mail、本地自签 HTTPS、浏览器忽略证书错误。测试账户经真实 UI 注册；验证码仅由隔离 fake-mail IPC/adapter 提供，Cookie 由服务端正常签发。未发送外部邮件或手动注入身份。
- 复用作者归档最小脚本，新归档版本将端口改成必须提供的 `A12_PORT`；双页脚本增加另一页登录及唯一 I07 断言。新 `logout-regression.mjs` 补原目标重试、刷新匿名与自然定时核验。每轮数据/profile 分离，端口见 [runs.json](local-recheck/runs.json)；集成 harness 使用 OS 随机空闲端口，运行数据通过 `TMPDIR` 放进本任务目录。
- [10 项集成结果](local-recheck/integration.log)全部来自本 session 新运行。第 7 项使用合成 focus，只记机制补充证据；自然定时核验的真实流程由独立 logout 脚本证明。没有以合成事件替代目标设备焦点验收。
- 日志只保留路径、方法、状态及保护头信息。集成 JSON 中页面键与幂等键归档时转为存在性布尔值；不提交 Cookie、验证码、数据库、私钥、profile 或含凭据 trace。各轮空 service.log 表示未产生该 logger 的输出，不作 API 证据，使用 network.json。
- [安装](local-recheck/install.log)、[当前生产构建](local-recheck/build.log.gz)通过；构建有既存单块大于 500 kB 的体积提示。没有新增 lint/typecheck 入口，没有 UI 单元测试。文件校验清单见 [sha256.json](local-recheck/sha256.json)。

重新验证时从固定 SHA 导出新目录并在其中 `npm ci && npm run build`。以下变量必须使用新路径和空闲端口；每次最小复现更换 `A12_DATA` 和 `A12_EVIDENCE`。脚本不依赖已清理的本次数据库：

```bash
A12_CANDIDATE=/tmp/new-candidate A12_DATA=/tmp/new-multi A12_EVIDENCE=/tmp/new-multi-evidence A12_PORT=<空闲端口> node docs/acceptance/evidence/A12/v1/local-recheck/scripts/repro-multitab.mjs
# 同样运行 repro-independent.mjs、failure-states.mjs、logout-regression.mjs，各自使用新目录。
```

在候选目录重跑真实集成：

```bash
TMPDIR=/tmp/new-runtime A11_EVIDENCE_DIR=/tmp/new-integration-evidence npx playwright test --config apps/web/e2e/auth-integration.config.mjs
```

本地定向完成后停止本任务服务/浏览器，清除本任务独立临时目录中的候选、依赖及运行数据；保留上述正式脱敏证据。原 `/tmp/a12-local-candidate`、`/tmp/a12-local-state-final`、`/tmp/a12-repro-1`、`/tmp/a12-repro-2`、`/tmp/a12-failure-states` 未覆盖或清理。

## 外部未决项

| 项目 | 状态、拥有者与解除条件 |
| --- | --- |
| A10-EXT-001，真实邮件 | BLOCKED。授权方/邮件配置拥有者提供正式配置、发信身份及授权收件箱；A12 用真实 UI 完成注册与找回，取得投递及实际收件证据。fake-mail 不关闭此项。 |
| A10-EXT-002，真实目标设备 | BLOCKED。用户/交付环境拥有者提供目标设备及可信同源 HTTPS，补真实跨设备访问、浏览器重开、撤销与隔离。模拟视口和独立 profile 不等于物理设备。 |
| A10-OPS-001，旧库备份恢复撤销 | 未关闭。F60/F62/F65 及 D71/D72 按既有责任补恢复后旧 Cookie 全失效、账户键/业务引用不变的证据。本次未执行旧库恢复。 |
| 资源文件、完整偏好和后续模块隔离 | 沿用原报告覆盖边界，归相应模块和 F65，不能从本次认证定向通过外推。 |

唯一完成回调由外层发送；本节点提交报告后结束，不主动联系其他 session。
