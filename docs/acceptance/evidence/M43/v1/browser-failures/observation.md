# 浏览器执行异常保留

代码 `909693a7cc67f50a523ea94864ef7b80a345d5df` 首次同时运行主集成与材料两套单 worker 浏览器检查，分别得到 5/6 和 6/7。失败为 Playwright response guid 未绑定、材料页 `Page crashed`，不是断言到业务错误。原日志 `../e2e-complete.log`、`../e2e-materials-checkpoint.log`，原 trace 保存在本目录。

2026-09-22 11:53:16-17 America/New_York，系统记录三个 Chrome 进程 SIGTRAP；检查时 `/tmp` tmpfs 占用 97%，仅剩 307MB。`environment.log` 保留 coredump 元数据和文件系统状态。没有 OOM 记录；这些事实不能单独证明崩溃根因，也不将问题归因于产品代码。

后续控制条件：保留全部旧现场，不删除其他 session 文件；将 TMPDIR 改为磁盘目录 `/home/liam_t/.cache/m43-validation`（189GB 空闲），两套测试串行执行，并打开 `DEBUG=pw:browser` 保留浏览器 stderr。产品、测试断言、浏览器版本不变，没有自动重试、延时或吞错。主集成 6/6，见 `../e2e-complete-disk.log`。材料该轮 6/7，最后一例业务断言全部完成但 afterEach 等待服务关闭超过 180 秒，见 `../e2e-materials-checkpoint-disk.log`。本次环境相关异常原因仍是 OPEN 观察，交 M44 复跑时留意；绿灯只说明上述控制条件下通过。

## 材料 fixture 清理

原进程加载的清理是 `test.afterEach(async () => world?.close())`。最后业务动作已取得退出后 401 并完成截图（`materials-last-actions.json`），服务端仍与 Chrome 有 ESTAB 连接（`materials-teardown-sockets.log`），`server.close()` 一直等待浏览器 context 自动清理，而自动清理排在 afterEach 之后。180 秒超时落盘，原 trace 为 `materials-teardown-trace.zip`。

测试修正 `965f813626fc40ba5fb8c04f0495c825f825b469` 仅将该文件 afterEach 改为先 `context.close()`，再 `world.close()`；与同目录 navigation fixture 和 M43 fixture 一致。没有改生产连接行为、强行丢弃业务请求或增设重试。注意：修正文件在旧 worker 运行期间已复制到验证副本，Playwright 在超时后读取的错误代码摘录显示新版磁盘文本；旧 worker 仍执行启动时加载的旧回调，不能据摘录误判修正已经运行。修正后完整复跑 7/7 PASS（46.7 秒），日志 `../e2e-materials-teardown-fixed.log`。
