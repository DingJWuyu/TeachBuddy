# Standards 审查 E

当前结论：通过固定候选 `83fac6c0bfc6d423c2cc0202c7a569f3bd235d86` 的 Standards 审查。初审两项 P2 均已关闭，增量未发现新的硬性违约或值得报告的 baseline smell。本结论不代替独立消融、CI 或 preview 集成验收。

基线：`789a38d83babad04f2e2a51e9f17530abf638801`。初审候选：`13e16e273b36beaddf3aa090fb9f1463a8ff6a1a`。本次复核固定增量 `13e16e273b36beaddf3aa090fb9f1463a8ff6a1a..83fac6c0bfc6d423c2cc0202c7a569f3bd235d86`，同时核对相关消费者。E 只读审查，唯一写入为本忽略报告。

## 初审发现与关闭依据

1. **P2，资源保存测试假绿，已关闭。** 原 `apps/web/e2e/rebuilt/resources-math.spec.mjs:14-18` 仅在同设备刷新读取输入框。E 独立阻断 metadata PUT 为503后，全部原断言仍通过，服务端 GET 却保持原名称“函数讲义.png”及空笔记；原因是页面优先恢复持久设备草稿。违反 `docs/code-standards.md`“验证质量”的实际行为、具名故障检出与保存读回要求。修复 `83fac6c0` 保留草稿刷新保护，增加明确PUT200、UI已保存及无 origins 的新context真实打开读回名称、笔记和原件入口。已核对作者B正常、503、伪造200但不落库的补丁与日志：正常1 PASS（用例8.6秒）；503在200/503断言失败；伪造200越过成功提示后，在新设备名称断言Expected新值/Received原值失败。两种故障注入均未进入候选。

2. **P2，CI丢失失败现场，已关闭。** 原 `rebuilt/helpers.js:33`、`support/application.js:11` 及恢复、OCR、转换和扩展专项把失败数据留在 `/tmp`，CI仅上传 `test-results/`。违反 `docs/acceptance/README.md:39` 及GitHub工作流的失败现场保留规则。修复 `56672e6c` 使用12行 `support/directories.js`，按自身import.meta定位当前检出的 `test-results/runtime/`，保留随机隔离、成功清理和失败保留语义。所有初审列出的调用已迁入，浏览器仍用testInfo.outputPath；现有CI上传范围直接包含这些路径。复用了总控定点日志：Agent生命周期3 PASS（4.46秒，含真实SIGKILL及活跃删号），真实PNG输出1 PASS（5.54秒），均0skip；总控确认成功后runtime为空。

## 证据边界

资源证据在作者B `test-results/test-suite-rebuild/logs/resource-metadata-{reviewed,503-red,200-red,final}.log` 及同任务 `faults/refinement/`；入库回执为 `docs/plans/test-suite-rebuild/author-b.md`。目录迁移定点日志在本报告同目录 `directory-agent-targeted.log`、`directory-output-targeted.log`。

实际Node故障在新目录保留SQLite/原件的运行证据仍待D回执，CI artifact实际上传尚未执行；本轮只确认修复路径及既有定点结果。未本地重跑CI全套，未重复Spec裁决。初审隔离验证实例已清理，报告按任务未完成状态保留。
