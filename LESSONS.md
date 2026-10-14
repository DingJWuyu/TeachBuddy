# Lessons

修改代码前读本页，审查时核对相关条目。只记录本仓已证实失误产生的当前预防规则；稳定工程判据见[代码标准](docs/code-standards.md)。

## 当前条目

### 当前装配使用当前目录，历史样本只验证兼容

修改目录或协议后，运行当前功能的 fixture 直接使用产品装配；只有明确验证旧版本的测试才加载其冻结样本。目录示例不能替代当前 `moduleCatalog`，否则测试会在业务执行前失效，还会误报覆盖了旧库升级。

资源 HTTP fixture 曾用材料协议 v2 的示例替换当前资源描述，缺少 `webEnabled`，六个场景均启动失败；其“旧库迁移”场景实际初始化的是当前实现。依据：[原 fixture](https://github.com/DingJWuyu/TeacherWorkspace/blob/71877a7768c904fdd082d5d53864a52c5dc68236/apps/web/e2e/fixtures/materials-resources/server.mjs)、[原测试](https://github.com/DingJWuyu/TeacherWorkspace/blob/71877a7768c904fdd082d5d53864a52c5dc68236/apps/api/test/materials-resources.test.js)；当前行为保护在[资源 HTTP 测试](apps/api/test/materials-resources.test.js)。

出现日期：2026-10-14。已核实 1 个不同日期。

## 维护规则

1. 完整改动目的或阶段交付时，依据返工、回归、独立审查和用户纠正决定是否新增或更新；没有新的已证实教训时不修改。不建立夜间循环或社区监听。
2. 每条写清触发条件、可执行规则、保护的使用结果、固定本仓 commit/Issue/入库样本证据和出现日期。单次有充分证据即可记录；假设、普通命令错误和外仓事故不计数，不编造历史。
3. 同一规则在三个不同日期各有独立本仓证据时，合并到所属稳定权威页并移除本页重复条目；已被现行标准涵盖的内容直接改权威规则，不再制造第二副本。失效规则移除，历史由 Git 保留。
4. 证据只保留足以核查当前规则的链接，完整执行过程留任务产物；长期条目不能只依赖被忽略目录或个人机器路径。未完成问题仍记录在[运行台账](docs/plans/run-state.md)，Lessons 不替代待办。

机制改编自 [Magpie LESSONS](https://github.com/yetone/magpie/blob/91b9065a5fdf5b7aa0adeeeb17266c121bf5691c/LESSONS.md)；署名与许可见[代码标准](docs/code-standards.md#来源与许可)。
