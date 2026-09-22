# C26 内部双轴审查

固定点：`5614cf99f8b7ad9ff1f6dbf0467dd30eaf922545`。首个完整受审候选：`3156549c083fbc56b817cd2ea82f9cf82375e9f2`。两个只读叶子由本 session 同时调用，均继承 Codex / gpt-6-astra / low；本报告为内部 self 聚合，不是 C27 独立验收。

## Standards

原审查 PASS，硬违反 0 项。写入符合 C26 边界，没有修改认证内部、旧业务 schema 或自动生成文件。原始参数和 Problem 详情由冻结 UX 要求。

非阻断判断 2 项：

1. 题库与备课 router 有重复的路由装配循环，备课还携带题库查询分支。建议小型装配函数，避免建立插件框架。
2. tools.js 的 execute/reconcile 重复响应校验和 Problem 分类，首次执行显式检查 Promise，核实路径未显式检查。建议共享分类函数，避免两路径漂移。

本批保留两项局部重复。两个路由的 HTTP 行为由原首流回归覆盖；业务 operations 固定为同步 SQLite，核实路径的 status/schema 同样会拒绝 Promise。当前没有实际行为分歧，不为两处小循环扩大共享入口或抽象层。后续如业务响应形态改变，应一起调整执行与核实路径。

## Spec

原候选 FAIL，确定发现 2 项：

1. P1：首次 snapshot 请求失败后的重试不会初始化 draft，输入框持续缺失；重连也没有同步另一设备保存的干净草稿。依据 UX 持久记录读取失败与草稿恢复要求。
2. P2：事件缺号 abort 了唯一 controller，后续 SSE 复用已取消 signal，不能恢复事件流。依据契约“忽略重复 seq，缺号时重连”。

修复候选 `127c7e55b006acd5a06ad460f3380963cb51bce0`：以首次成功读取初始化；重连同步未修改草稿并保留本地 dirty/pending；每次连接使用新的 controller，卸载单独停止当前连接。浏览器 [red](logs/recovery-red.log) 复现输入框缺失；[回归](logs/agent-browser.log) 证明初次读取故障恢复、缺号后再次建立 SSE、断网期间另一设备保存后恢复、本机冲突内容不丢失。

同候选补充修复：窄屏首页继承旧布局对齐导致内容裁切，现约束子项宽度与对齐，三个视口逐卡边界检查通过；真实 SQLite prepared 落盘失败保留 store-unavailable 原因，不再显示模型错误，且没有业务副作用。证据见 [存储故障](logs/prepared-storage-green.log)。

定向 Spec 复核 PASS：原 P1/P2 均关闭，新增确定发现 0。复核读取固定修复候选与 9/9 浏览器日志；SQLite 错误映射和窄屏修复没有新增确定契约问题。仍不替代 C27。

Standards：硬违反 0、非阻断判断 2，最高为局部重复；Spec：原发现 2，最高 P1，两项已在定向复核关闭，当前无阻断发现。
