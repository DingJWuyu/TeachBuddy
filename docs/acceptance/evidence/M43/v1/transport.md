# 自然 fetch 观察与本轮测试边界

**历史两项 R35 观察保持 OPEN。** 本轮未改生产 fetch、认证或 HTTP 连接算法。以下是必要全 API 检查中自然出现的四次失败，均没有人工注入断连。

纯观察 preload 来自固定 P 的诊断文件：`880e6e68be0855b3289dea8db3c87e8c67bc1042` 对象的 `docs/acceptance/evidence/R34/v1/restart-diagnosis2/trace-preload.mjs`，本机副本 `/tmp/m43-trace-preload.mjs`。它记录 Node/undici、监听/关闭、socket、请求与错误事件，不记录 Cookie、请求体或密钥。

| 全量日志 | 受影响用例 | 直接 cause | 时序文件 |
| --- | --- | --- | --- |
| api-full-second.log | materials-resources MC14 首次上传 | `write ECONNRESET` | `transport/1253424.json` |
| api-full-second.log | materials-resources MC12/22 taxonomy PUT | `read ECONNRESET` | `transport/1253424.json` |
| api-full-third.log | materials-resources MC13-15 | `write ECONNRESET` | `transport/1262065.json` |
| api-full-third.log | math-static-migration 重启读取 | `read ECONNRESET` | `transport/1262271.json` |

[transport-failures.json](transport-failures.json)提取每次错误及紧邻事件，完整探针文件保留在 [transport/](transport/)。例如第一个错误：旧 server socket 的 remotePort `46036` 于 `3239.999ms` 关闭；新 server 在同端口 `48432` 于 `3240.189ms` listening；新 POST 于 `3241.745ms` 创建，却于 `3247.009ms` 使用旧 client socket 32/localPort `46036`；`3248.846ms` 得到 `write ECONNRESET`。第二次请求复用另一个已经关闭的旧 socket/localPort `46038`，得到 `read ECONNRESET`。该证据支持“测试服务生命周期与共享连接池不同步”，不证明产品网络故障都具有同一原因。

本轮必要的测试修正：仅在 `materials-resources.test.js` 和 `math-static-migration.test.js` 的原 HTTP 请求添加 `Connection: close`，使每个请求的连接结束于该请求，避免跨测试 fixture 重启复用旧连接。没有自动重试、延时等待、重放失败请求或吞错误。随后全 API 296/296 是**修正后的测试连接策略**结论；真实认证浏览器测试仍用浏览器默认连接策略，并包括实际丢响应与同键恢复。

根仍需决定历史观察的关闭证据。R35 原两项观察既未改签，本轮四次自然重现也不能被最终绿灯抹掉。原模块/公共 HTTP 生命周期的进一步诊断归 P/R34 与外层独立验收；M43只交具名本地数学消费结果和原始时序。
