# R34 共享运行接续诊断 2

**结论：OPEN，未自然复现两项 `fetch failed`，没有因果证据支持修复。** `R34-RESTART-DIAGNOSIS@1 attempt 2`，Codex `gpt-6-astra high`，验证级别 `self`。本轮有界诊断已结束，不重置 attempt 1 或 R33 的累计次数，不解除原 OPEN，不放行完整 R34/R35。

## 固定候选与范围

| 输入 | 固定版本 |
| --- | --- |
| 当前 main-based 分支起点 | `b9c4b8215a1bf2cfd7ae1169788ef4ff0b58b67f`；分支 `fix/r34-runtime-continuation` |
| R33 完整输入 | `f73b7fe0deefb4adfe570519ae93754d1bd85e3a`，产品 `812da1091724d5536eb4a3fbcf2c47033fa64555` |
| 前轮诊断完整输入 | `c915f5939cb9e4102bbc9d84d4b83608b72eda52`，诊断增强 `59b18d1bf97e50d75e9d18b98d5813d857e74eec` |
| 本轮组合 fixed point | `4cc4b55d21ceddd8863878f2af77877f63b2339a` |

以固定提交进行两次无冲突组合。保留当前 AGENTS、run-state、DAG 以及所有旧 evidence。相对 R33 完整输入，`apps/`、`packages/`、`scripts/` 唯一差异是前轮已存在的 `math-static-migration.test.js` 诊断增强。本轮相对组合点没有运行代码、fixture、业务算法或契约改动。

新增材料限本报告和 [restart-diagnosis2/](restart-diagnosis2/)。其中 `trace-preload.mjs` 是证据目录内的显式加载探针，来自前轮探针，去掉所有故障注入和时序干预选项，按 PID 分开保存并行测试轨迹。它记录请求方法/路径、HTTP 状态、socket 元数据、监听和关闭事件及递归 cause，不记录 cookie、header 或请求/响应体，不接入默认测试或产品。

## 失败逐项归属

| 观察 | 可以确定的范围 | 当前结论与拥有者 |
| --- | --- | --- |
| R33 最终 MC13-15，`materials-resources.test.js:232` 的第一次 `upload()` 抛 `fetch failed` | 请求是共享文件入口 `POST /api/workbench/files`；发生于 MC12 结束关闭 fixture、MC13-15 新建 fixture 之后，尚未创建 resource item。旧日志没有 cause 或服务端收到请求的记录 | R34 共享 HTTP 测试/fixture 生命周期诊断 OPEN。不能断定请求是否到达共享文件处理器，也不能归为 resources 算法缺陷 |
| R33 最终 math 保留库第二次启动后，原键 `POST /api/modules/questions/items` 抛 `fetch failed` | 已记录第三代服务初始化，失败在原键重放；初始化日志不等于失败时监听状态证明。没有自然失败 socket 轨迹 | R34 共享重启诊断 OPEN。没有证据指向 math 迁移、questions 重放或连接池 |
| `api-full-first.log` 另外四项 `ENOENT` | fragments 测试相对工作目录读取 PDF/旧响应或写 evidence 失败。该首轮为 202/208，不能误记为最终 209/211 | R33 测试路径归属，已由固定输入解决，最终日志中不再失败；本轮未改这些测试 |

新上传位置与旧 math 位置的共同结构是同进程客户端跨 fixture 关闭/重开继续访问同一 origin。这仅界定下一份证据必须覆盖的边界，**不是已经证实的共同根因**。前轮人工 `ECONNREFUSED`/`UND_ERR_SOCKET` 仍只是校准，本轮无故障注入。

## 有界自然运行与结果

Node `v22.23.2`，内嵌 Undici `6.28.0`，Linux x64，availableParallelism=20。二进制 hash、命令、office 路径见 [environment.json](restart-diagnosis2/environment.json)。依赖按当前锁文件 `npm ci` 安装，无产品 Provider 或密钥注入。

每条运行命令使用独立 user/network namespace 并启用 loopback。这样保持 fixture 原端口、`localhost` 解析与原测试入口，同时与其他任务的监听器隔离；独立 worktree 和数据库不触碰 R35。全 API 保持原 `node --test test/*.test.js` 默认并行，工作目录仍由 npm workspace 切到 `apps/api`，没有降低并行度、重复失败重试或修改断言。

| 一次性运行 | 结果 | 证据 |
| --- | --- | --- |
| 两个原测试文件，实际 HTTP 上传及保留库两次重启，不加探针 | 7/7 PASS，约 2.17 秒 | `baseline.log` |
| 原全 API 入口，加载只观察的传输探针 | 211/211 PASS，约 29.45 秒 | `full-trace.log`；两目标完整轨迹 `materials-resources-trace.json`、`math-static-migration-trace.json` |
| 原全 API 入口，不加载探针，用于检查是否只有带探针才绿 | 211/211 PASS，约 27.10 秒 | `full-original.log` |
| 前轮真实进程脚本，三个独立 PID、相同 origin 和保留库 | PASS：真实 HTTP 建题/文档保存/文件上传、两次重启、原键重放、ID/元数据/下载字节/文档/迁移/integrity_check 一致，三进程正常退出 | `process-restart.log`、`process-result.json`、`process-*-trace.json` |

这四个运行不是原异常的 red/green。定向命令确实经过相同失败入口，遇到异常会失败，但没有取得稳定或高复现率自然 red；diagnosing-bugs Phase 1/2 未闭环，因此未进入根因确认和修复阶段。没有继续同构绿灯循环、负载注入、连接池重置或等待补丁。没有修复，故不追加构建、浏览器修复验收或内部代码审查；本轮没有浏览器实例，也没有使用其他任务的浏览器。

## 轨迹可证明什么

[目标转换摘录](restart-diagnosis2/target-transitions.json)可与两份完整轨迹交叉核对。socket ID 仅在各自进程内有效。

- 资源 MC13-15 对应第四代监听器 `server=29`：1865.289ms listening；1870.973ms 创建上传请求 `request=30`；1871ms 左右旧客户端 socket 21/18 关闭；1874.096ms 用新 socket 32 发送，1874.897ms 新监听器收到请求，1919.237ms 客户端收到 201。
- math 第二次重启对应第三代监听器 `server=16`：1052.540ms listening；1053.920ms 创建重放请求 `request=17`；1054.810ms 新 socket 19 发送，1055.161ms 新监听器收到请求，1056.404ms 收到 201。原持久化断言全部通过。
- 两目标轨迹分别包含 57 和 8 个请求，均无 `request:error`；没有 `server:error` 或连接拒绝证据。客户端关闭事件晚于服务端关闭仍可能出现，但本轮目标请求没有使用旧 socket。

这些是本轮成功样本的边界证据，不能推断历史失败的 cause、故障概率或修复有效性。独立 namespace、当时的调度/负载、全量运行顺序和探针均可能影响时序；不带探针的全量也通过，仅排除了“本轮只有加探针才能通过”的观察。原自然失败没有同进程 cause、socket 与监听轨迹，无法回填。

## 可重复入口

从仓库根目录运行，使用新的 trace 输出目录，避免覆盖本轮证据。namespace 随命令退出，不建立后台守护进程。

```bash
unshare --user --map-root-user --net bash -c \
  'ip link set lo up && node --test apps/api/test/materials-resources.test.js apps/api/test/math-static-migration.test.js'

mkdir -p test-results/r34-next-traces
unshare --user --map-root-user --net bash -c \
  'ip link set lo up && R34_TRACE_DIR="$PWD/test-results/r34-next-traces" NODE_OPTIONS="--import=$PWD/docs/acceptance/evidence/R34/v1/restart-diagnosis2/trace-preload.mjs" MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 npm run test:api'
```

原测试会改写旧 evidence，并重置自己的资源测试数据目录；重跑前先保存现场。math 失败时前轮增强仍写 `failure.json`，并重新抛出原异常。资源失败的递归 cause 位于对应 PID 的 `request:error`，用 argv 找测试文件，再按 request ID、socket ID 和 server 代次关联。

## 保留现场与继续所缺信息

- 本轮运行代码保持组合 fixed point。旧证据逐文件恢复并核验 794 份原 hash；10 份被测试重写的结果另存 `inherited-test-artifacts/`，见 `old-evidence-preserved.json`。没有覆盖旧报告。
- 六个保留目录和文件 hash 见 `retained-scenes.json`：三份 math 迁移库、三代进程共用库、资源主测试库与升级库。资源测试沿用 `.pathname`，含中文工作区路径会形成字面 `%E9...` 目录；清单记录实际绝对路径。本轮没有将此路径现象当作 fetch 根因。资源主库按原测试设计在下一次全量开始时重建，最终库保留；不宣称保存了每轮资源库快照。
- `test-results/r34-diagnosis2/` 保留安装日志、24 份全量进程轨迹及旧 evidence 备份；固定报告只收录两个目标的完整轨迹。数据库、测试产物和备份保持原地，不删除未完成现场。所有本轮服务进程已退出。
- 下一步需要**自然失败当次**的完整命令/并行负载、递归 cause、请求与 socket 关联、监听器代次及事件时序、对应数据库目录。若为跨重启复用，必须看见失败请求实际用了旧 socket；若为未监听/端口问题，需要失败时监听状态与拒绝/占用错误；若进入业务，需要同代 server:request 后的断连或处理异常。当前缺少这些，不能唯一归因。

本次没有新自然 red，故保持两项 OPEN 并停写，不继续扩大诊断窗口。产品模型调用 0、密钥读取 0，无新增费用。仅任务分支提交，不合 main、不 push、不部署、不联系业务 session、不改变 R35 的 `6398bf2` 输入。外层唯一回调。
