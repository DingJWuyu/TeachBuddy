# 日程技术入口

改安排、实例、时区或提醒时读本页。行为见 [日程规格](../features/schedule.md)，交换和修改前结算保证见 [日程契约](../contracts/schedule.md)，当前字段见 [schedule-v2.openapi.json](../../apps/api/src/contracts/schedule-v2.openapi.json)；v1 保留实际兼容请求，不作为当前日历字段全集。

## 责任与调用面

真实组合是 [workbench/teachingTime.js 的 createScheduleModule](../../apps/api/src/workbench/teachingTime.js)：先给业务工厂注入同步 beforeChange 闭包，再创建 reminders，最后把 reminders router 挂到 schedule router，并扩展导出读取包含通知。

[业务 createScheduleModule](../../apps/api/src/modules/schedule/index.js) 必须接收 `db/mutations/beforeChange/clock`，缺少真实结算或时钟即拒绝构造，返回 `router/port`。HTTP 在 [router](../../apps/api/src/modules/schedule/router.js) 提供安排、事项、重复/例外、分离/移动、删除、标签、设置及日历查询；通知由 [reminders](../../apps/api/src/modules/schedule/reminders/index.js) 提供。公开进程内 port 仅有同步 `readOccurrence`、`listReminderCandidates`、`readForExport`，没有 `port.operations`。导出 `createScheduleService` 不等于已经装配公共幂等写入口，外部接入写操作不能直接绕过 router 的校验/事务。

## 可信调用与提醒事务

读取一个实例由服务端可信入口提供 principal：

```js
const occurrence = schedule.port.readOccurrence(verifiedPrincipal, {
  entryId,
  originDate,
});
```

`originDate` 是原始实例日期，未指定时默认 null，实际含义见 [service.readOccurrence](../../apps/api/src/modules/schedule/service.js)。同步返回 Occurrence 或抛带 `status/problem` 的 Error；无时间、无权、不符合原始节律为 404，超出系列当前 until 返回 outside-series。此读操作不需要 key，也不写通知。

HTTP 写入由认证 transport 附加页面/保护头和逻辑 UUID key，router 将可信 principal 和规范路径/输入送 `mutations.execute`。业务校验通过后，service 在实际改动前同步调用 `beforeChange(principal, now)`，组合绑定的 `reminders.captureDue` 在同一数据库事务结算旧状态到期提醒，再写新状态；异常全事务回滚，幂等重放不再结算。now 来自 clock，不能接受 HTTP 自填时钟。beforeChange 是生产装配的一条固定结算接缝，不是调用方任意异步钩子。

`listReminderCandidates(principal, now)` 只读取活动实例中 `armedAt < dueAt <= now` 的候选，不创建通知。通知查询/确认仍沿 reminders HTTP 的既有结算语义；不要把全部 GET 泛称无副作用。失败与原键核实见 [共享保存](../contracts/workbench.md#写入冲突与未知结果)。

## 运行路径与持久化

- [Web 日历](../../apps/web/src/features/schedule/index.jsx) 经认证 transport 到组合 router，业务 [service](../../apps/api/src/modules/schedule/service.js) / [repository](../../apps/api/src/modules/schedule/repository.js) 管理安排、例外、实例启用点、标签与设置。
- [reminders](../../apps/api/src/modules/schedule/reminders/index.js) 以 schedule port 读取候选/实例，保存通知与去重事实；安排改动和到期结算共用 SQLite。永久删除保留已有通知与成功回执，旧软删除请求仍可核实，见契约。
- 资料包读取组合后的 `readForExport`，包含完整安排/例外和通知；执行去重与 armedAt 是部署状态，不混为可移植个人资料。

模块 [migrations](../../apps/api/src/modules/schedule/migrations/index.js) 与 reminders migrations 由 teachingTime 合并；账户生命周期沿 [account-deletion](../../apps/api/src/workbench/account-deletion.js) 调用日程模块的 `deleteAccountData`，在外层事务中按 accountKey 显式清理该账户通知和日程数据，保留其他账户。reminders 工厂没有独立公开清理端口。日程不依赖题库、班级或教学记录业务。

## 验证入口

[teaching-time-schedule-entries.test.js](../../apps/api/test/teaching-time-schedule-entries.test.js)、[teaching-time-reminders.test.js](../../apps/api/test/teaching-time-reminders.test.js)、[teaching-time-calendar.test.js](../../apps/api/test/teaching-time-calendar.test.js) 覆盖真实 HTTP/数据库安排、到期结算、通知与日历扩展；[账户删除测试](../../apps/api/test/account-deletion.test.js) 覆盖真实删号后的通知清理及另一账户保留。浏览器从 [calendar-capabilities.config.mjs](../../apps/web/e2e/calendar-capabilities.config.mjs) 和 [calendar-time-zone.config.mjs](../../apps/web/e2e/calendar-time-zone.config.mjs) 进入，核对刷新、重复/调课、真实时区和通知。更多验证条件见 [日程验证](../features/schedule.md#验证入口)，执行范围按 [CI 分工](../agents/github-workflow.md#ci-与本地验证)，端口说明不证明真实提醒已验收。
