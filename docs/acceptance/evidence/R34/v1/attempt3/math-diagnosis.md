# 共享迁移测试观察

结论：**未复现，根因未证实，观察保持 OPEN**。不将单跑或本轮全套通过记为修复。

原始失败是固定 R33 完整 `cd31bf4f4d0bf5f7cd6f35cd1f912b81a16d680c` 的 `attempt2/api-reviewed.log`：保留库第二次启动 math fixture 后，`math-static-migration.test.js:66` 的 POST 原请求重放报 `fetch failed`；日志未记录底层 cause。此前没有数据一致性断言失败。

在组合 `ec3a44f024c5d18c13954fa9ee809ccbfb7a9a70`、Node 22.23.2 下，直接通过该测试的真实 HTTP 入口执行原路径，包括两个保留库重启，不模拟成功：

- `node --test apps/api/test/math-static-migration.test.js`：1/1 PASS，见 `math-initial.log`。
- 有界复现循环：最多30次独立 Node 进程，首次非零即停止，逐次完整保留输出。30次均PASS，见 `math-reproduction.log`。它只为捕获间歇异常，不使用“至少一次成功”的通过策略。
- 同一候选 `npm run test:api`：201/201 PASS，包含该测试，见 `api-full.log`。

固定端口47415的服务关闭重开与 fetch 连接池生命周期仍是待验证线索；新组合多了资源模块，时序也不同。没有捕获底层 socket 错误或稳定 red，因此不能排除其他运行时原因，更不能宣称证实连接复用。没有修改测试、增加自动重试、降低断言或修改 math 内核。

归属仍为 R34 共享测试诊断。当前证据不足以转归只读 math 业务内核。后继需要捕获同一异常的底层 cause / socket 生命周期后才能定向修正；此前 R33 原始失败证据继续有效。本轮导航修复不消除这一观察。
