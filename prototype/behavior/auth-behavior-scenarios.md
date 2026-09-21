# 账户入口失败与恢复场景覆盖

Status: In review

整合验证：22 个可执行场景在三个视口共 66/66 通过；CA48、CA53 暂缓，不计作通过。截图和结果来自与最新工作台整合后的运行时，旧会话语条及退出截图未合入。

本文档保留 CA41-CA64 共 24 个场景编号；22 个可执行，CA48、CA53 暂缓，未计入通过数。它只记录场景如何复现、证据在哪里，不重复行为定义；行为本身由[账户入口](auth.md)拥有。

既有编号 CA01-CA40 由[账户场景覆盖](auth-scenarios.md)拥有，编号未改动。本文档的场景从 CA41 起续编。

## 复现与验证

从 [manifest](manifest.md) 启动原型。每个场景使用独立浏览器上下文，从空登录卡开始；完整操作与逐步断言见 [auth-behavior-scenarios.mjs](../verification/auth-behavior-scenarios.mjs)，采集入口是 [capture-auth-behavior.mjs](../verification/capture-auth-behavior.mjs)：

```bash
node prototype/verification/capture-auth-behavior.mjs
```

默认地址是 `http://127.0.0.1:4174/`，`PROTOTYPE_URL` 可覆盖。`SCENARIO_IDS=CA56,CA57` 只跑指定场景，`VIEWPORT_NAMES=PC` 只跑指定终端。分段结果使用 `auth-behavior-partial.*`，不会覆盖完整结果。脚本先暂存输出，可执行场景全部通过后才按场景替换 `evidence/screenshots/` 与 `evidence/verification/`；失败时不发布，暂存目录会保留。`PROTOTYPE_EVIDENCE_DIR`、`PROTOTYPE_RESULTS_DIR`、`PROTOTYPE_TEMP_DIR` 的语义见 manifest。

## 测试接缝

四个查询参数只服务于检查，不改变界面上看到的内容，也不改变产品默认行为：

| 参数 | 作用 |
| --- | --- |
| `no-dev-chrome` | 隐藏开发环境控件，评审截图使用 |
| `dev-code=NNNNNN` 或逗号分隔的六位码列表 | 固定一次或依次固定多次发码，便于确定性地验证重发后的新旧码 |
| `dev-cooldown=毫秒` | 把本页的重发冷却缩短，避免整轮检查被冷却拖长 |
| `dev-no-cooldown` | 本页不设冷却，用于需要在同一页内多次发码的场景 |

失败注入不通过参数，而是开发环境控件上的「网络不可用 / 服务故障 / 超时 / 会话过期 / 验证码过期 / 重置数据」按钮。该控件只在开发模式出现，`no-dev-chrome` 时隐藏；不带该参数打开时控件在右下角。

## 覆盖表

每条场景在 PC 1440x900、平板 768x1024、手机 390x844 各跑一次，共 72 条记录，全部通过（[结果](../evidence/verification/auth-behavior.txt)、[原始数据](../evidence/verification/auth-behavior.json)）。截图命名沿用 accepted 规则：`<终端>-<场景 ID>-<状态>.png`。

| 场景 | 说明 | PC | 平板 | 手机 |
| --- | --- | --- | --- | --- |
| CA41 | 凭据错误：卡片顶部拒绝、密码清空、邮箱保留、可关闭 | 1440x900 | 768x1024 | 390x844 |
| CA42 | 不存在的账户与错误密码得到同一条答复 | 1440x900 | 768x1024 | 390x844 |
| CA43 | 提交等待：按钮进入等待态并阻止第二次提交 | 1440x900 | 768x1024 | 390x844 |
| CA44 | 网络不可用：横幅提示、保留输入、恢复后重试成功 | 1440x900 | 768x1024 | 390x844 |
| CA45 | 服务故障：可关闭的横幅，不误标到字段上 | 1440x900 | 768x1024 | 390x844 |
| CA46 | 请求超时：横幅提示并可重试 | 1440x900 | 768x1024 | 390x844 |
| CA47 | 请求中修改密码：等待态保持，不产生第二次请求 | 1440x900 | 768x1024 | 390x844 |
| CA48 | 暂缓：旧脚本依赖退出且未真正验证请求中离开 | 待补 | 待补 | 待补 |
| CA49 | 勾选记住我：刷新后仍在工作台 | 1440x900 | 768x1024 | 390x844 |
| CA50 | 不勾选记住我：刷新即退出，回到空登录卡 | 1440x900 | 768x1024 | 390x844 |
| CA51 | 换设备：另一台机器没有可恢复的会话 | 1440x900 | 768x1024 | 390x844 |
| CA52 | 会话过期：回到登录卡并说明原因，可再次登录 | 1440x900 | 768x1024 | 390x844 |
| CA53 | 暂缓：原型取消退出入口，等待设置页设计 | 待补 | 待补 | 待补 |
| CA54 | 密码重置后旧密码失效，新密码可用 | 1440x900 | 768x1024 | 390x844 |
| CA55 | 发码失败：横幅提示，验证码字段不出现 | 1440x900 | 768x1024 | 390x844 |
| CA56 | 冷却：重发倒计时，冷却结束才能再发 | 1440x900 | 768x1024 | 390x844 |
| CA57 | 验证码错误次数用尽后该码作废，需要重新发送 | 1440x900 | 768x1024 | 390x844 |
| CA58 | 验证码过期：需要重新发送 | 1440x900 | 768x1024 | 390x844 |
| CA59 | 重发后旧码作废；换地址后必须重新发送 | 1440x900 | 768x1024 | 390x844 |
| CA60 | 找回第一步：未注册地址被拒，不发验证码 | 1440x900 | 768x1024 | 390x844 |
| CA61 | 找回第二步的地址是锁定的，验证码只对它有效 | 1440x900 | 768x1024 | 390x844 |
| CA62 | 找回可重发，冷却与注册一致 | 1440x900 | 768x1024 | 390x844 |
| CA63 | 重置成功：回到登录卡并说明结果，再次找回需重新发码 | 1440x900 | 768x1024 | 390x844 |
| CA64 | 找回发码遇到网络失败：横幅提示，可重试 | 1440x900 | 768x1024 | 390x844 |

每个场景的截图文件名与状态后缀：

| 场景 | 截图（去掉终端前缀） |
| --- | --- |
| CA41 | `CA41-rejected`、`CA41-dismissed`、`CA41-recovered` |
| CA42 | `CA42-unknown-account`、`CA42-wrong-password` |
| CA43 | `CA43-pending`、`CA43-settled` |
| CA44 | `CA44-offline`、`CA44-retried` |
| CA45 | `CA45-server-error`、`CA45-dismissed` |
| CA46 | `CA46-timeout`、`CA46-retried` |
| CA47 | `CA47-edited-while-pending`、`CA47-settled` |
| CA48 | 暂无当前有效截图 |
| CA49 | `CA49-restored` |
| CA50 | `CA50-expired` |
| CA51 | `CA51-first-device`、`CA51-second-device`、`CA51-second-device-signed-in` |
| CA52 | `CA52-expired-notice`、`CA52-signed-in-again` |
| CA53 | 暂无当前有效截图 |
| CA54 | `CA54-reset-confirmed`、`CA54-old-password-rejected`、`CA54-new-password-accepted` |
| CA55 | `CA55-send-failed`、`CA55-send-retried` |
| CA56 | `CA56-cooldown`、`CA56-ready`、`CA56-resent` |
| CA57 | `CA57-first-miss`、`CA57-exhausted`、`CA57-still-refused` |
| CA58 | `CA58-expired`、`CA58-new-code-active` |
| CA59 | `CA59-old-code-dead`、`CA59-new-code-accepted`、`CA59-address-changed`、`CA59-resent` |
| CA60 | `CA60-unknown-address`、`CA60-accepted` |
| CA61 | `CA61-bound-address` |
| CA62 | `CA62-sent`、`CA62-resent` |
| CA63 | `CA63-filled`、`CA63-done`、`CA63-code-reissued`、`CA63-reset-again` |
| CA64 | `CA64-send-failed`、`CA64-send-retried` |

截图按旅程分目录：`login/`、`session/`、`register/`、`recovery/`。`session/` 是这组场景新增的分类，只存放 CA49-CA54 的会话证据。

需要用开发控件注入故障或缩短冷却的场景（CA44-CA46、CA52、CA55、CA58、CA63、CA64 等），采集时通过截图样式隐藏开发控件；故障仍由真实开发控件操作注入。其余场景用 `no-dev-chrome` 采集，画面里只有产品本身。

## 覆盖边界

- 可执行覆盖：失败横幅、登录提交等待、重试、部分验证码生命周期、当前只读地址方案、内置账户的记住我、注入会话过期、当前页面内重置后旧密码失效。准确结果以[当前结果](../evidence/verification/auth-behavior.json)为准，产品行为仍待验收。
- 暂缓：CA48、CA53。CA54 直接从登录卡进入找回密码，不再依赖工作台退出，也不证明跨设备会话撤销。
- 会话恢复等待和失败、注册/发码/重置的独立等待证据、未收邮件尚未覆盖；自然到期与重开真实浏览器也不能由刷新或注入替代。
- 未覆盖：跨设备的会话失效。原型没有服务端，另一台设备上已经存在的会话无法被本机存储清除，因此这条只能由服务端承担，记录为缺口而不是通过项。同一浏览器的其他标签页会通过存储事件回到登录卡，但没有独立场景。
- 未覆盖：真实邮件投递、真实网络条件、验证码的真实随机分布。请求往返是本地模拟的约 450ms，验证码分支靠注入与固定值复现。
- 未单独覆盖：请求进行中切换表单。CA47 改的是密码字段，只观察等待态与最终登录结果，未直接计数请求。
- 未单独断言：已经用过的验证码不能再用。CA57 覆盖错误次数用尽后作废，CA63 覆盖重新发码后再次重置，都没有回到"同一个码用第二次"这个分支。
- 本组场景不替代 CA01-CA40；后者仍在[账户场景覆盖](auth-scenarios.md)中。行为更新后，其中若干断言（CA09、CA14、CA22、CA32-CA40）的预期已同步改写。
