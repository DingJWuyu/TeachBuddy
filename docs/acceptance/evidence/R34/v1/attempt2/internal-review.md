# R34 attempt 2 内部双轴

审查 fixed point：`aa7744ca1af4edf80a974e7429b7e72508db7af2`；目标：`e60a3fd90f7b501d3fb426b19ec3ff2e8e24c938`。命令：`git diff aa7744ca1af4edf80a974e7429b7e72508db7af2...e60a3fd90f7b501d3fb426b19ec3ff2e8e24c938`。两位只读叶子继承 Codex gpt-6-astra low，不再委派。作者修复后作定向回归，没有伪称 reviewer 已重审最终提交。

## Standards

原始结论：FAIL，1 项 P2。`/root/standards`：

> 深链接写入失败时阻止打开旧资源。ResourceRoute 的 writeLocal 返回 false 时仍挂载资源页，可能显示此前资源或列表。外壳草稿提示不能说明来源导航失败。应检查结果并显示可重试错误。依据 design-and-verification 的入口目标、失败反馈及来源真实交互要求。

作者关闭：共享适配层在写入失败时停止挂载，显示“无法打开指定资料”和重试按钮。真实浏览器 quota 拒写复现见 `review-red.log`，修复及恢复写入后的导航见 `review-green.log`、最终 `browser-final.log`。资源业务内部未改。

## Spec

原始结论：FAIL，2 项 P2。`/root/spec`：

> 同步资源深链与当前资源现场。从备课打开 A 后，模块内部返回列表并打开 B，URL 仍指向 A；刷新强制写回 A，覆盖 B 或列表现场。应仅在明确的新导航时消费深链，补 A → 列表 → B → 刷新验证。

作者关闭：history entry 记录已消费的账户和资源目标；刷新恢复模块已有现场，新导航重新消费。最终浏览器覆盖 A → 列表 → 上传并打开 B → 刷新 B；`resource-deeplink-restored.png`。

> 为可继续运行入口保留稳定 origin。每次 listen(0) 改变端口，浏览器无法读取旧 origin 的草稿及 IndexedDB 未确认上传。应使用独立固定端口并验证含未确认请求的普通进程重启。

作者关闭：隔离入口默认 48436、测试 48437，可显式设置 R34_PORT；保持端口复用同一 origin。`process-restart.json` 记录不同 PID、相同 origin；浏览器在真实文件上传提交后断响应，停止/重启独立 Node 进程、刷新后以原键确认，随后全新本地存储的浏览器仍可读服务器资源。HTTPS 预连接在停止时一并关闭，避免测试进程退出拖延。

两个轴分别保留：Standards 1 项、Spec 2 项，均由作者修复并回归。完整 R34 的 R33 质量、在线闭环、目标 Windows/WPS 不因这次内部审查解除。

## 最终增量双轴

固定范围 `96a61c518e30a96fbf4cc1df2f82222e903d0507...dc1afe54e2848920f459fffd12bc2c5015b9cd28`，两位原助手只读审查共享保存重试及浏览器选择器。

- Standards：No findings。重试沿用原 pending.submittedInput，与原请求键和请求体一致，确认旧保存时保留后续草稿；关闭辅助栏的 .first() 未绕过交互或削弱断言。
- Spec：No findings。符合 U-M7，确认后仅当当前输入仍等于原提交快照才替换编辑内容，新草稿保持 dirty，再次丢响应不改写原快照。

最终串行真实浏览器回归 3/3 PASS（33.3s），见 browser-final.log。这次增量审查不扩大为全候选独立验收，不解除完整 R34 BLOCKED。
