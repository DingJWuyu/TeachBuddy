# R34 共享重启诊断

**结论：OPEN，根因未证实，未实施生命周期或业务修复。** 本次是 `R34-RESTART-DIAGNOSIS@1 attempt 1` 的有界接手，验证级别 `self`。新增失败诊断能区分两类此前被压成 `fetch failed` 的错误，但不能补回历史现场缺失的 cause。完整 R34 不因此放行。

## 固定输入与写入范围

- 输入完整候选 `6398bf2dae85d1872c929aa8ef32d5705d763687`，产品 `a0bde5546eeedf50498888da0ed9c5941fa1d76a`。来源 worktree 未修改。
- main-based 分支 `fix/r34-restart-diagnosis` 从 `cb966d9` 引入输入，组合点 `56845c217442acc24bcabfb8c3508424192c0a65`。当前根 `AGENTS.md`、`docs/plans/run-state.md` 和旧 evidence 保持原字节。
- 原始失败：`cd31bf4f4d0bf5f7cd6f35cd1f912b81a16d680c:docs/acceptance/evidence/R33/v1/attempt2/api-reviewed.log:1104`，POST 原键重放在旧测试第 66 行报 `fetch failed`。该测试和两份直接使用的 fixture 在原失败候选与最新输入之间没有 diff。
- 新运行代码仅修改 `apps/api/test/math-static-migration.test.js`：允许指定隔离端口，失败时记录阶段、最后一次请求的方法/路径、监听状态、Node/Undici、递归 cause 和保留库位置。仍抛出原错误，仍执行全部原持久化断言，无自动重试。数学、题库、资源、认证算法、冻结契约和共享服务设施未改。
- 诊断制品置于 [restart-diagnosis/](restart-diagnosis/)，最终回执入口为 [delivery.json](restart-diagnosis/delivery.json)。不更新外层台账、不合 main、不 push、不部署。

## 反馈循环与证据边界

先运行固定组合的原测试：[baseline.log](restart-diagnosis/baseline.log)，1/1 PASS。最接近该 API 故障的路径仍是实际 HTTP 写入、保留 SQLite/文件、关闭服务、启动 math fixture、原键 POST 重放、读取并核对持久数据。

自然条件下未得到稳定 red，因此 diagnosing-bugs 的原故障反馈循环没有闭环，也未进入“根因已确认”的修复阶段。按本任务的有界授权继续增加可区分信息，注入 red 仅验证诊断能力，不冒充原故障复现。

按优先级探查四个方向：

| 假设与可证伪预测 | 本轮观察 | 判定限制 |
| --- | --- | --- |
| 旧连接跨重启复用：失败 POST 应发送到旧代 socket，且当时尚无客户端 end/close | [自然轨迹](restart-diagnosis/natural-trace.json)中，服务端 close 完成先于客户端关闭，但重放实际使用新连接；所有自然样本无 request:error | 时序窗口存在不等于窗口导致过原失败；仍缺自然失败的 socket 归属 |
| 监听未就绪/已退出：POST 时没有监听或连接被拒绝 | 所有自然重放都在 listening 后开始；[refuse 注入](restart-diagnosis/refuse-trace.json)准确出现 ECONNREFUSED，listening=false | 人工关闭新监听器仅是探针校准，不证明旧 fixture 曾未就绪 |
| 地址/端口或调度条件：改变监听解析、关闭时机、CPU 占用会改变可复现性 | 数字 IPv6 地址、关闭前 setImmediate、fetch 发起后阻塞主线程 10ms 均通过；无 EADDRINUSE；独立端口 48564 通过 | 当前样本不能排除历史外部条件；CPU 争用试验的主要延迟在启动，不能视作有效覆盖重放窗口 |
| 已进入业务层才失败：应先出现同代 server:request，再有异常响应/断连或持久状态差异 | 所有自然路径持久化断言通过；[reset 注入](restart-diagnosis/reset-trace.json)在进入业务路由前断连，cause=UND_ERR_SOCKET，listening=true | 无证据转归数学/题库/资源/认证业务内核 |

Node `v22.23.2`、内嵌 Undici `6.28.0`、内嵌源码 SHA256 见 [environment.json](restart-diagnosis/environment.json)。[官方该版本发布记录](https://nodejs.org/en/blog/release/v22.23.2)也列出 Undici 6.28.0。旧环境记录的 Node 版本与本次相同，原栈的内嵌 fetch 第 15157 行也匹配；旧二进制没有 hash，不能进一步证明二进制完全相同或归因于版本差异。本机内嵌源码有 `scheduleIdleSocketValidation`，当前通过轨迹与空闲连接关闭先于再次发送一致，但没有据此宣称其保证消除竞态。

## 已运行的有界矩阵

全部单次 verdict 均保留，不用“最终一次通过”覆盖失败。初始自然探针使用空闲端口 47415，新增诊断及进程重启使用 48564；每个原测试样本各有 UUID 数据库。

| 运行 | 结果与证据 |
| --- | --- |
| 原测试，未加探针 | 1/1 PASS，`baseline.log` |
| 仅传输探针 | 1/1 PASS，`natural.log` / `natural-trace.json` |
| 监听 `localhost` 改 `::1`，其余不变 | 1/1 PASS，`numeric.log` / `numeric-trace.json` |
| 关闭前 setImmediate；再叠加数字监听地址 | 各 1/1 PASS，`settle*` / `settle-numeric*`；不是修复 |
| fetch 发起后主线程占用 10ms；再叠加数字监听地址 | 各 1/1 PASS，`cpu*` / `cpu-numeric*`；未改变请求内容、次数或业务实现 |
| 同核四个 CPU 竞争进程，最多三个样本 | 3/3 PASS，`contention-0/1/2*`。竞争进程 20 秒后结束，第一个测试进程总计约20.7秒、测试体约0.36秒，不能确认争用落在重放窗口；后两个样本不当作有效压力证据 |
| 增强诊断后的自然测试 | 1/1 PASS，`diagnostic-green.log` |
| 第二次 math 启动后关闭监听器 | 预期 FAIL，`refuse.log` / `refuse-failure.json`，phase=replay-math-2，cause 递归保留 IPv6/IPv4 ECONNREFUSED |
| 第二次 math 启动后断开新连接 | 预期 FAIL，`reset.log` / `reset-failure.json`，同一重放位置外层 fetch failed，cause=UND_ERR_SOCKET |
| 三个真实服务进程、同一 origin 和保留库 | PASS，`process-restart.log` / `process-result.json`，真实 HTTP 建题/存文档/上传文件，两次退出并启动新 PID，原 POST 原键重放、题目/文件元数据/原件字节/文档/迁移及 SQLite integrity_check 均通过 |
| 受影响真实回归 | 4/4 PASS，`regression.log`：math-static migration、作品历史/重放/重启/导出/故障、SVG/PNG 输出、real-auth/fake-mail 公式重启。日志中的磁盘失败为既有断言的注入，不是未处理回归 |

两种注入在同一用户报告位置产生相同外层 `TypeError: fetch failed`，却有不同底层错误，证明只靠旧 TAP 无法唯一归因。保留新失败 JSON 与完整原测试数据库，原异常没有被“修正”为通过。

## 接续运行

从仓库根目录运行。`trace-preload.mjs` 只供这条隔离诊断命令加载，不装入产品或默认测试链。它记录 socket/HTTP 元数据，不记录 cookie、请求体或响应体；默认不注入故障。新运行写 `test-results/`，避免覆盖本轮固定证据。

```bash
M41_MIGRATION_PORT=48564 node --test apps/api/test/math-static-migration.test.js

M41_MIGRATION_PORT=48564 R34_TRACE=test-results/r34-restart-next.json \
  node --import ./docs/acceptance/evidence/R34/v1/restart-diagnosis/trace-preload.mjs \
  --test apps/api/test/math-static-migration.test.js

M41_MIGRATION_PORT=48564 R34_TRACE=test-results/r34-process-next.json \
  node --import ./docs/acceptance/evidence/R34/v1/restart-diagnosis/trace-preload.mjs \
  docs/acceptance/evidence/R34/v1/restart-diagnosis/process-restart.mjs
```

使用空闲的非零 `M41_MIGRATION_PORT`；同一轮各代保持不变。校准故障时给第二条命令追加环境变量 `R34_FAULT=refuse` 或 `R34_FAULT=reset`，**预期退出码 1，不是验收失败的新发现**。时序对照变量为 `R34_LISTEN_NUMERIC=1`、`R34_SETTLE_BEFORE_CLOSE=1`、`R34_FETCH_CPU_MS=10`，每次只改变一个变量。历史 JSON 的 socket ID 仅在单进程内有效，跨进程关联用端口及代次；早期自然探针的服务路径在 Express 已重写后记录，后续探针在路由前记录原路径。

普通测试失败的现场写在 TAP 给出的 `test-results/m41/migration-<UUID>/failure.json`；进程重启现场在 `process-result.json` 的绝对 dataDir。后者含 `result.json`、三代服务轨迹、SQLite、原件及业务日志。本轮全部14份迁移现场的绝对路径和 SHA256 见 [retained-scenes.json](restart-diagnosis/retained-scenes.json)。所有现场保留；服务和竞争进程退出，无浏览器实例。旧证据未改写。

## 未决与解除条件

- **唯一未决：原共享重启 `fetch failed` 的因果链。** 归属仍为 R34 共享测试诊断，不能据本轮把责任指向连接池或业务内核。
- 外层若再遇到自然失败，需保留增强后的 `failure.json`、同进程传输轨迹、完整命令/Node 与 Undici 信息、数据库目录和并行负载。诊断入口已能直接留下 cause，不需要补采密钥或模型请求。
- 判定连接复用需同时看见失败 POST 使用旧代 socket、关闭事件顺序和新监听状态；判定监听/端口条件需有 ECONNREFUSED/EADDRINUSE 与启动状态；判定业务需有已到达处理器及响应/存储证据。得到稳定或高复现率的对应 red 后再定向修正，并保留原持久化断言完成 red/green 和真实进程重启回归。
- 本轮停止增加同构循环，也不引入自动重试、关闭 keep-alive、任意等待或连接池重置来换取绿。完整 R34/R35、只读设计及其他既有未决保持原归属。

本次诊断实现固定为 `59b18d1bf97e50d75e9d18b98d5813d857e74eec`，双轴 [code-review](restart-diagnosis/review.md) 各 0 项发现。最终完整候选 SHA 由外层回执给出，受审实现之后只补齐证据元数据。

0 产品模型请求，0 密钥读取。本回执由外层唯一回调；本 session 不联系业务 session。
