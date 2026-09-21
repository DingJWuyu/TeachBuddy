# 账户入口场景覆盖

Status: Accepted

本文件拥有 CA01-CA40 的场景与证据索引。行为定义、字段规则及模拟限制由 [账户入口](auth.md) 拥有。

## 复现与验证

从 [manifest](manifest.md) 启动原型。每个用例使用独立浏览器上下文，回到空登录卡后执行，避免前一场景留下的邮箱或验证码影响结果。完整操作和逐步断言见 [auth-scenarios.mjs](../verification/auth-scenarios.mjs)，运行 `node prototype/verification/capture-all.mjs` 可复现全部场景，输出暂存位置见命令提示；核对后再替换当前证据。

登录使用 `example@example.com` / `teachbuddy`；注册新地址使用 `new@example.com`、昵称 `林`、验证码 `309614`；找回验证码 `841207`、新密码 `new-teachbuddy`。页面刷新重置内存，切换卡片只保留邮箱。各错误用例只改变表中指定条件，修正路径验证重试结果。

每张图在断言目标状态之后生成，同时检查横向溢出和入口卡片的纵向溢出。键盘用例覆盖焦点顺序和 Enter 提交；截图不能代替这些交互断言。视口是浏览器模拟尺寸，不代表真机测试。

[当前自动验证结果](../evidence/verification/auth.json)：120/120 用例通过。视觉证据按旅程存放，包含各场景的输入、错误、恢复和结果状态。真实服务等待、网络故障、错误凭据等未实现分支沿用账户入口列明的模拟限制，不计为通过。

## 登录 J11

| 场景 | 条件、动作与预期 | 视口 | 当前截图 | 验证 |
| --- | --- | --- | --- | --- |
| CA01 | 初始登录卡、密码隐藏、记住我默认勾选 | PC 1440×900 | [初始](../evidence/screenshots/login/PC-CA01-initial.png) | 通过 |
| CA01 | 初始登录卡、密码隐藏、记住我默认勾选 | 平板 768×1024 | [初始](../evidence/screenshots/login/平板-CA01-initial.png) | 通过 |
| CA01 | 初始登录卡、密码隐藏、记住我默认勾选 | 手机 390×844 | [初始](../evidence/screenshots/login/手机-CA01-initial.png) | 通过 |
| CA02 | 邮箱为空，修正后进入工作台 | PC 1440×900 | [错误](../evidence/screenshots/login/PC-CA02-error.png) · [修正结果](../evidence/screenshots/login/PC-CA02-recovered.png) | 通过 |
| CA02 | 邮箱为空，修正后进入工作台 | 平板 768×1024 | [错误](../evidence/screenshots/login/平板-CA02-error.png) · [修正结果](../evidence/screenshots/login/平板-CA02-recovered.png) | 通过 |
| CA02 | 邮箱为空，修正后进入工作台 | 手机 390×844 | [错误](../evidence/screenshots/login/手机-CA02-error.png) · [修正结果](../evidence/screenshots/login/手机-CA02-recovered.png) | 通过 |
| CA03 | 非法邮箱拒绝，修改邮箱清除错误 | PC 1440×900 | [错误](../evidence/screenshots/login/PC-CA03-error.png) · [输入已修正](../evidence/screenshots/login/PC-CA03-corrected.png) | 通过 |
| CA03 | 非法邮箱拒绝，修改邮箱清除错误 | 平板 768×1024 | [错误](../evidence/screenshots/login/平板-CA03-error.png) · [输入已修正](../evidence/screenshots/login/平板-CA03-corrected.png) | 通过 |
| CA03 | 非法邮箱拒绝，修改邮箱清除错误 | 手机 390×844 | [错误](../evidence/screenshots/login/手机-CA03-error.png) · [输入已修正](../evidence/screenshots/login/手机-CA03-corrected.png) | 通过 |
| CA04 | 短密码拒绝，修正重试成功 | PC 1440×900 | [错误](../evidence/screenshots/login/PC-CA04-error.png) · [修正结果](../evidence/screenshots/login/PC-CA04-recovered.png) | 通过 |
| CA04 | 短密码拒绝，修正重试成功 | 平板 768×1024 | [错误](../evidence/screenshots/login/平板-CA04-error.png) · [修正结果](../evidence/screenshots/login/平板-CA04-recovered.png) | 通过 |
| CA04 | 短密码拒绝，修正重试成功 | 手机 390×844 | [错误](../evidence/screenshots/login/手机-CA04-error.png) · [修正结果](../evidence/screenshots/login/手机-CA04-recovered.png) | 通过 |
| CA05 | 填写、显示密码、再次隐藏 | PC 1440×900 | [已填写](../evidence/screenshots/login/PC-CA05-filled.png) · [密码可见](../evidence/screenshots/login/PC-CA05-revealed.png) · [密码隐藏](../evidence/screenshots/login/PC-CA05-hidden.png) | 通过 |
| CA05 | 填写、显示密码、再次隐藏 | 平板 768×1024 | [已填写](../evidence/screenshots/login/平板-CA05-filled.png) · [密码可见](../evidence/screenshots/login/平板-CA05-revealed.png) · [密码隐藏](../evidence/screenshots/login/平板-CA05-hidden.png) | 通过 |
| CA05 | 填写、显示密码、再次隐藏 | 手机 390×844 | [已填写](../evidence/screenshots/login/手机-CA05-filled.png) · [密码可见](../evidence/screenshots/login/手机-CA05-revealed.png) · [密码隐藏](../evidence/screenshots/login/手机-CA05-hidden.png) | 通过 |
| CA06 | 取消记住我，不改变本次登录结果 | PC 1440×900 | [未勾选](../evidence/screenshots/login/PC-CA06-unchecked.png) · [已登录](../evidence/screenshots/login/PC-CA06-signed-in.png) | 通过 |
| CA06 | 取消记住我，不改变本次登录结果 | 平板 768×1024 | [未勾选](../evidence/screenshots/login/平板-CA06-unchecked.png) · [已登录](../evidence/screenshots/login/平板-CA06-signed-in.png) | 通过 |
| CA06 | 取消记住我，不改变本次登录结果 | 手机 390×844 | [未勾选](../evidence/screenshots/login/手机-CA06-unchecked.png) · [已登录](../evidence/screenshots/login/手机-CA06-signed-in.png) | 通过 |
| CA07 | 登录、首次引导、关闭引导 | PC 1440×900 | [引导](../evidence/screenshots/login/PC-CA07-coach.png) · [工作台](../evidence/screenshots/login/PC-CA07-workbench.png) | 通过 |
| CA07 | 登录、首次引导、关闭引导 | 平板 768×1024 | [引导](../evidence/screenshots/login/平板-CA07-coach.png) · [工作台](../evidence/screenshots/login/平板-CA07-workbench.png) | 通过 |
| CA07 | 登录、首次引导、关闭引导 | 手机 390×844 | [引导](../evidence/screenshots/login/手机-CA07-coach.png) · [工作台](../evidence/screenshots/login/手机-CA07-workbench.png) | 通过 |
| CA08 | 键盘聚焦、输入、Enter 登录 | PC 1440×900 | [焦点](../evidence/screenshots/login/PC-CA08-focus.png) · [已登录](../evidence/screenshots/login/PC-CA08-signed-in.png) | 通过 |
| CA08 | 键盘聚焦、输入、Enter 登录 | 平板 768×1024 | [焦点](../evidence/screenshots/login/平板-CA08-focus.png) · [已登录](../evidence/screenshots/login/平板-CA08-signed-in.png) | 通过 |
| CA08 | 键盘聚焦、输入、Enter 登录 | 手机 390×844 | [焦点](../evidence/screenshots/login/手机-CA08-focus.png) · [已登录](../evidence/screenshots/login/手机-CA08-signed-in.png) | 通过 |
| CA09 | 刷新清除会话，回到空登录卡 | PC 1440×900 | [重置](../evidence/screenshots/login/PC-CA09-reset.png) | 通过 |
| CA09 | 刷新清除会话，回到空登录卡 | 平板 768×1024 | [重置](../evidence/screenshots/login/平板-CA09-reset.png) | 通过 |
| CA09 | 刷新清除会话，回到空登录卡 | 手机 390×844 | [重置](../evidence/screenshots/login/手机-CA09-reset.png) | 通过 |

## 注册 J12

| 场景 | 条件、动作与预期 | 视口 | 当前截图 | 验证 |
| --- | --- | --- | --- | --- |
| CA10 | 注册初始态，条款未勾选且验证码字段隐藏 | PC 1440×900 | [初始](../evidence/screenshots/register/PC-CA10-initial.png) | 通过 |
| CA10 | 注册初始态，条款未勾选且验证码字段隐藏 | 平板 768×1024 | [初始](../evidence/screenshots/register/平板-CA10-initial.png) | 通过 |
| CA10 | 注册初始态，条款未勾选且验证码字段隐藏 | 手机 390×844 | [初始](../evidence/screenshots/register/手机-CA10-initial.png) | 通过 |
| CA11 | 发码邮箱校验：请填写邮箱。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA11-error.png) | 通过 |
| CA11 | 发码邮箱校验：请填写邮箱。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA11-error.png) | 通过 |
| CA11 | 发码邮箱校验：请填写邮箱。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA11-error.png) | 通过 |
| CA12 | 发码邮箱校验：邮箱格式不正确。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA12-error.png) | 通过 |
| CA12 | 发码邮箱校验：邮箱格式不正确。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA12-error.png) | 通过 |
| CA12 | 发码邮箱校验：邮箱格式不正确。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA12-error.png) | 通过 |
| CA13 | 已占用邮箱不发码，换地址后正常发码 | PC 1440×900 | [占用](../evidence/screenshots/register/PC-CA13-taken.png) · [已发码](../evidence/screenshots/register/PC-CA13-sent.png) | 通过 |
| CA13 | 已占用邮箱不发码，换地址后正常发码 | 平板 768×1024 | [占用](../evidence/screenshots/register/平板-CA13-taken.png) · [已发码](../evidence/screenshots/register/平板-CA13-sent.png) | 通过 |
| CA13 | 已占用邮箱不发码，换地址后正常发码 | 手机 390×844 | [占用](../evidence/screenshots/register/手机-CA13-taken.png) · [已发码](../evidence/screenshots/register/手机-CA13-sent.png) | 通过 |
| CA14 | 发码和重新发送 | PC 1440×900 | [已发码](../evidence/screenshots/register/PC-CA14-sent.png) · [重发](../evidence/screenshots/register/PC-CA14-resent.png) | 通过 |
| CA14 | 发码和重新发送 | 平板 768×1024 | [已发码](../evidence/screenshots/register/平板-CA14-sent.png) · [重发](../evidence/screenshots/register/平板-CA14-resent.png) | 通过 |
| CA14 | 发码和重新发送 | 手机 390×844 | [已发码](../evidence/screenshots/register/手机-CA14-sent.png) · [重发](../evidence/screenshots/register/手机-CA14-resent.png) | 通过 |
| CA15 | 注册提交邮箱校验：请填写邮箱。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA15-error.png) | 通过 |
| CA15 | 注册提交邮箱校验：请填写邮箱。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA15-error.png) | 通过 |
| CA15 | 注册提交邮箱校验：请填写邮箱。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA15-error.png) | 通过 |
| CA16 | 注册提交邮箱校验：邮箱格式不正确。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA16-error.png) | 通过 |
| CA16 | 注册提交邮箱校验：邮箱格式不正确。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA16-error.png) | 通过 |
| CA16 | 注册提交邮箱校验：邮箱格式不正确。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA16-error.png) | 通过 |
| CA17 | 注册字段校验与修正：请填写昵称。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA17-error.png) · [修正结果](../evidence/screenshots/register/PC-CA17-recovered.png) | 通过 |
| CA17 | 注册字段校验与修正：请填写昵称。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA17-error.png) · [修正结果](../evidence/screenshots/register/平板-CA17-recovered.png) | 通过 |
| CA17 | 注册字段校验与修正：请填写昵称。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA17-error.png) · [修正结果](../evidence/screenshots/register/手机-CA17-recovered.png) | 通过 |
| CA18 | 注册字段校验与修正：密码至少 8 位。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA18-error.png) · [修正结果](../evidence/screenshots/register/PC-CA18-recovered.png) | 通过 |
| CA18 | 注册字段校验与修正：密码至少 8 位。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA18-error.png) · [修正结果](../evidence/screenshots/register/平板-CA18-recovered.png) | 通过 |
| CA18 | 注册字段校验与修正：密码至少 8 位。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA18-error.png) · [修正结果](../evidence/screenshots/register/手机-CA18-recovered.png) | 通过 |
| CA19 | 注册字段校验与修正：两次输入的密码不一致。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA19-error.png) · [修正结果](../evidence/screenshots/register/PC-CA19-recovered.png) | 通过 |
| CA19 | 注册字段校验与修正：两次输入的密码不一致。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA19-error.png) · [修正结果](../evidence/screenshots/register/平板-CA19-recovered.png) | 通过 |
| CA19 | 注册字段校验与修正：两次输入的密码不一致。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA19-error.png) · [修正结果](../evidence/screenshots/register/手机-CA19-recovered.png) | 通过 |
| CA20 | 注册字段校验与修正：请输入 6 位数字验证码。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA20-error.png) · [修正结果](../evidence/screenshots/register/PC-CA20-recovered.png) | 通过 |
| CA20 | 注册字段校验与修正：请输入 6 位数字验证码。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA20-error.png) · [修正结果](../evidence/screenshots/register/平板-CA20-recovered.png) | 通过 |
| CA20 | 注册字段校验与修正：请输入 6 位数字验证码。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA20-error.png) · [修正结果](../evidence/screenshots/register/手机-CA20-recovered.png) | 通过 |
| CA21 | 注册字段校验与修正：请输入 6 位数字验证码。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA21-error.png) · [修正结果](../evidence/screenshots/register/PC-CA21-recovered.png) | 通过 |
| CA21 | 注册字段校验与修正：请输入 6 位数字验证码。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA21-error.png) · [修正结果](../evidence/screenshots/register/平板-CA21-recovered.png) | 通过 |
| CA21 | 注册字段校验与修正：请输入 6 位数字验证码。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA21-error.png) · [修正结果](../evidence/screenshots/register/手机-CA21-recovered.png) | 通过 |
| CA22 | 注册字段校验与修正：验证码不正确，请检查后重试。 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA22-error.png) · [修正结果](../evidence/screenshots/register/PC-CA22-recovered.png) | 通过 |
| CA22 | 注册字段校验与修正：验证码不正确，请检查后重试。 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA22-error.png) · [修正结果](../evidence/screenshots/register/平板-CA22-recovered.png) | 通过 |
| CA22 | 注册字段校验与修正：验证码不正确，请检查后重试。 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA22-error.png) · [修正结果](../evidence/screenshots/register/手机-CA22-recovered.png) | 通过 |
| CA23 | 未发码就提交，提示可见，发码后可继续 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA23-error.png) · [已发码](../evidence/screenshots/register/PC-CA23-sent.png) | 通过 |
| CA23 | 未发码就提交，提示可见，发码后可继续 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA23-error.png) · [已发码](../evidence/screenshots/register/平板-CA23-sent.png) | 通过 |
| CA23 | 未发码就提交，提示可见，发码后可继续 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA23-error.png) · [已发码](../evidence/screenshots/register/手机-CA23-sent.png) | 通过 |
| CA24 | 未同意条款，显示错误文字，勾选后重试 | PC 1440×900 | [错误](../evidence/screenshots/register/PC-CA24-error.png) · [修正结果](../evidence/screenshots/register/PC-CA24-recovered.png) | 通过 |
| CA24 | 未同意条款，显示错误文字，勾选后重试 | 平板 768×1024 | [错误](../evidence/screenshots/register/平板-CA24-error.png) · [修正结果](../evidence/screenshots/register/平板-CA24-recovered.png) | 通过 |
| CA24 | 未同意条款，显示错误文字，勾选后重试 | 手机 390×844 | [错误](../evidence/screenshots/register/手机-CA24-error.png) · [修正结果](../evidence/screenshots/register/手机-CA24-recovered.png) | 通过 |
| CA25 | 注册成功 | PC 1440×900 | [已填写](../evidence/screenshots/register/PC-CA25-filled.png) · [已注册](../evidence/screenshots/register/PC-CA25-registered.png) | 通过 |
| CA25 | 注册成功 | 平板 768×1024 | [已填写](../evidence/screenshots/register/平板-CA25-filled.png) · [已注册](../evidence/screenshots/register/平板-CA25-registered.png) | 通过 |
| CA25 | 注册成功 | 手机 390×844 | [已填写](../evidence/screenshots/register/手机-CA25-filled.png) · [已注册](../evidence/screenshots/register/手机-CA25-registered.png) | 通过 |
| CA26 | 切换登录再返回，只保留邮箱 | PC 1440×900 | [登录卡](../evidence/screenshots/register/PC-CA26-login.png) · [重置](../evidence/screenshots/register/PC-CA26-reset.png) | 通过 |
| CA26 | 切换登录再返回，只保留邮箱 | 平板 768×1024 | [登录卡](../evidence/screenshots/register/平板-CA26-login.png) · [重置](../evidence/screenshots/register/平板-CA26-reset.png) | 通过 |
| CA26 | 切换登录再返回，只保留邮箱 | 手机 390×844 | [登录卡](../evidence/screenshots/register/手机-CA26-login.png) · [重置](../evidence/screenshots/register/手机-CA26-reset.png) | 通过 |
| CA27 | 发码后更换邮箱，旧验证码状态失效 | PC 1440×900 | [改地址](../evidence/screenshots/register/PC-CA27-changed.png) · [重发](../evidence/screenshots/register/PC-CA27-resent.png) | 通过 |
| CA27 | 发码后更换邮箱，旧验证码状态失效 | 平板 768×1024 | [改地址](../evidence/screenshots/register/平板-CA27-changed.png) · [重发](../evidence/screenshots/register/平板-CA27-resent.png) | 通过 |
| CA27 | 发码后更换邮箱，旧验证码状态失效 | 手机 390×844 | [改地址](../evidence/screenshots/register/手机-CA27-changed.png) · [重发](../evidence/screenshots/register/手机-CA27-resent.png) | 通过 |
| CA28 | 条款链接保留在当前卡片，不跳转 | PC 1440×900 | [条款](../evidence/screenshots/register/PC-CA28-terms.png) | 通过 |
| CA28 | 条款链接保留在当前卡片，不跳转 | 平板 768×1024 | [条款](../evidence/screenshots/register/平板-CA28-terms.png) | 通过 |
| CA28 | 条款链接保留在当前卡片，不跳转 | 手机 390×844 | [条款](../evidence/screenshots/register/手机-CA28-terms.png) | 通过 |

## 找回密码 J13

| 场景 | 条件、动作与预期 | 视口 | 当前截图 | 验证 |
| --- | --- | --- | --- | --- |
| CA29 | 找回入口沿用登录邮箱，返回登录清空密码 | PC 1440×900 | [请求](../evidence/screenshots/recovery/PC-CA29-request.png) · [返回](../evidence/screenshots/recovery/PC-CA29-returned.png) | 通过 |
| CA29 | 找回入口沿用登录邮箱，返回登录清空密码 | 平板 768×1024 | [请求](../evidence/screenshots/recovery/平板-CA29-request.png) · [返回](../evidence/screenshots/recovery/平板-CA29-returned.png) | 通过 |
| CA29 | 找回入口沿用登录邮箱，返回登录清空密码 | 手机 390×844 | [请求](../evidence/screenshots/recovery/手机-CA29-request.png) · [返回](../evidence/screenshots/recovery/手机-CA29-returned.png) | 通过 |
| CA30 | 找回第一步：请填写邮箱。 | PC 1440×900 | [错误](../evidence/screenshots/recovery/PC-CA30-error.png) | 通过 |
| CA30 | 找回第一步：请填写邮箱。 | 平板 768×1024 | [错误](../evidence/screenshots/recovery/平板-CA30-error.png) | 通过 |
| CA30 | 找回第一步：请填写邮箱。 | 手机 390×844 | [错误](../evidence/screenshots/recovery/手机-CA30-error.png) | 通过 |
| CA31 | 找回第一步：邮箱格式不正确。 | PC 1440×900 | [错误](../evidence/screenshots/recovery/PC-CA31-error.png) | 通过 |
| CA31 | 找回第一步：邮箱格式不正确。 | 平板 768×1024 | [错误](../evidence/screenshots/recovery/平板-CA31-error.png) | 通过 |
| CA31 | 找回第一步：邮箱格式不正确。 | 手机 390×844 | [错误](../evidence/screenshots/recovery/手机-CA31-error.png) | 通过 |
| CA32 | 两步找回的空表单 | PC 1440×900 | [请求](../evidence/screenshots/recovery/PC-CA32-request.png) · [确认](../evidence/screenshots/recovery/PC-CA32-confirm.png) | 通过 |
| CA32 | 两步找回的空表单 | 平板 768×1024 | [请求](../evidence/screenshots/recovery/平板-CA32-request.png) · [确认](../evidence/screenshots/recovery/平板-CA32-confirm.png) | 通过 |
| CA32 | 两步找回的空表单 | 手机 390×844 | [请求](../evidence/screenshots/recovery/手机-CA32-request.png) · [确认](../evidence/screenshots/recovery/手机-CA32-confirm.png) | 通过 |
| CA33 | 找回校验与修正：请输入 6 位数字验证码。 | PC 1440×900 | [错误](../evidence/screenshots/recovery/PC-CA33-error.png) · [修正结果](../evidence/screenshots/recovery/PC-CA33-recovered.png) | 通过 |
| CA33 | 找回校验与修正：请输入 6 位数字验证码。 | 平板 768×1024 | [错误](../evidence/screenshots/recovery/平板-CA33-error.png) · [修正结果](../evidence/screenshots/recovery/平板-CA33-recovered.png) | 通过 |
| CA33 | 找回校验与修正：请输入 6 位数字验证码。 | 手机 390×844 | [错误](../evidence/screenshots/recovery/手机-CA33-error.png) · [修正结果](../evidence/screenshots/recovery/手机-CA33-recovered.png) | 通过 |
| CA34 | 找回校验与修正：请输入 6 位数字验证码。 | PC 1440×900 | [错误](../evidence/screenshots/recovery/PC-CA34-error.png) · [修正结果](../evidence/screenshots/recovery/PC-CA34-recovered.png) | 通过 |
| CA34 | 找回校验与修正：请输入 6 位数字验证码。 | 平板 768×1024 | [错误](../evidence/screenshots/recovery/平板-CA34-error.png) · [修正结果](../evidence/screenshots/recovery/平板-CA34-recovered.png) | 通过 |
| CA34 | 找回校验与修正：请输入 6 位数字验证码。 | 手机 390×844 | [错误](../evidence/screenshots/recovery/手机-CA34-error.png) · [修正结果](../evidence/screenshots/recovery/手机-CA34-recovered.png) | 通过 |
| CA35 | 找回校验与修正：验证码不正确，请检查后重试。 | PC 1440×900 | [错误](../evidence/screenshots/recovery/PC-CA35-error.png) · [修正结果](../evidence/screenshots/recovery/PC-CA35-recovered.png) | 通过 |
| CA35 | 找回校验与修正：验证码不正确，请检查后重试。 | 平板 768×1024 | [错误](../evidence/screenshots/recovery/平板-CA35-error.png) · [修正结果](../evidence/screenshots/recovery/平板-CA35-recovered.png) | 通过 |
| CA35 | 找回校验与修正：验证码不正确，请检查后重试。 | 手机 390×844 | [错误](../evidence/screenshots/recovery/手机-CA35-error.png) · [修正结果](../evidence/screenshots/recovery/手机-CA35-recovered.png) | 通过 |
| CA36 | 找回校验与修正：新密码至少 8 位。 | PC 1440×900 | [错误](../evidence/screenshots/recovery/PC-CA36-error.png) · [修正结果](../evidence/screenshots/recovery/PC-CA36-recovered.png) | 通过 |
| CA36 | 找回校验与修正：新密码至少 8 位。 | 平板 768×1024 | [错误](../evidence/screenshots/recovery/平板-CA36-error.png) · [修正结果](../evidence/screenshots/recovery/平板-CA36-recovered.png) | 通过 |
| CA36 | 找回校验与修正：新密码至少 8 位。 | 手机 390×844 | [错误](../evidence/screenshots/recovery/手机-CA36-error.png) · [修正结果](../evidence/screenshots/recovery/手机-CA36-recovered.png) | 通过 |
| CA37 | 找回校验与修正：两次输入的新密码不一致。 | PC 1440×900 | [错误](../evidence/screenshots/recovery/PC-CA37-error.png) · [修正结果](../evidence/screenshots/recovery/PC-CA37-recovered.png) | 通过 |
| CA37 | 找回校验与修正：两次输入的新密码不一致。 | 平板 768×1024 | [错误](../evidence/screenshots/recovery/平板-CA37-error.png) · [修正结果](../evidence/screenshots/recovery/平板-CA37-recovered.png) | 通过 |
| CA37 | 找回校验与修正：两次输入的新密码不一致。 | 手机 390×844 | [错误](../evidence/screenshots/recovery/手机-CA37-error.png) · [修正结果](../evidence/screenshots/recovery/手机-CA37-recovered.png) | 通过 |
| CA38 | 重置成功回到登录，不另加成功横幅 | PC 1440×900 | [已填写](../evidence/screenshots/recovery/PC-CA38-filled.png) · [返回](../evidence/screenshots/recovery/PC-CA38-returned.png) | 通过 |
| CA38 | 重置成功回到登录，不另加成功横幅 | 平板 768×1024 | [已填写](../evidence/screenshots/recovery/平板-CA38-filled.png) · [返回](../evidence/screenshots/recovery/平板-CA38-returned.png) | 通过 |
| CA38 | 重置成功回到登录，不另加成功横幅 | 手机 390×844 | [已填写](../evidence/screenshots/recovery/手机-CA38-filled.png) · [返回](../evidence/screenshots/recovery/手机-CA38-returned.png) | 通过 |
| CA39 | 第二步取消后重进，清空验证码和密码 | PC 1440×900 | [取消](../evidence/screenshots/recovery/PC-CA39-cancelled.png) · [重置](../evidence/screenshots/recovery/PC-CA39-reset.png) | 通过 |
| CA39 | 第二步取消后重进，清空验证码和密码 | 平板 768×1024 | [取消](../evidence/screenshots/recovery/平板-CA39-cancelled.png) · [重置](../evidence/screenshots/recovery/平板-CA39-reset.png) | 通过 |
| CA39 | 第二步取消后重进，清空验证码和密码 | 手机 390×844 | [取消](../evidence/screenshots/recovery/手机-CA39-cancelled.png) · [重置](../evidence/screenshots/recovery/手机-CA39-reset.png) | 通过 |
| CA40 | 第二步邮箱可编辑；显示与隐藏新密码 | PC 1440×900 | [密码可见](../evidence/screenshots/recovery/PC-CA40-revealed.png) · [密码隐藏](../evidence/screenshots/recovery/PC-CA40-hidden.png) | 通过 |
| CA40 | 第二步邮箱可编辑；显示与隐藏新密码 | 平板 768×1024 | [密码可见](../evidence/screenshots/recovery/平板-CA40-revealed.png) · [密码隐藏](../evidence/screenshots/recovery/平板-CA40-hidden.png) | 通过 |
| CA40 | 第二步邮箱可编辑；显示与隐藏新密码 | 手机 390×844 | [密码可见](../evidence/screenshots/recovery/手机-CA40-revealed.png) · [密码隐藏](../evidence/screenshots/recovery/手机-CA40-hidden.png) | 通过 |
