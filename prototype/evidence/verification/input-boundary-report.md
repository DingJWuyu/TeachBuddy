# G06 输入边界专项交付

生成时间：2026-09-21T11:36:35.907Z
运行地址：http://127.0.0.1:4189/?dev-code=001234&dev-no-cooldown=
状态：passed

复跑命令：

```bash
在 prototype 根目录执行：PROTOTYPE_URL=http://127.0.0.1:4174/ node verification/verify-input-boundaries.mjs
```

## 规则到场景

- **G06N**：昵称 trim 后 1-40 Unicode code points，保存 trim 值，计数与规则解释一致，不静默截断。
- **G06P**：密码 8-128 Unicode code points，原样保留，不 trim、大小写转换或 Unicode normalization；确认密码只做本地相等。
- **G06E**：邮箱输入期间原样保留；发送和提交目标 trim+lowercase；ASCII、总长不超过 254、形状规则按已确定约束校验。
- **G06C**：验证码为 6 位 ASCII 数字，允许前导 0；全角数字、少于或超过 6 位拒绝且不静默改写。
- **G06V**：每个新增独特视觉状态在 PC 1440x900、平板 768x1024、手机 390x844 采集，并检查无遮挡、无横向溢出、无开发浮层。

## 场景、断言与截图

### CA110 PC 1440x900
PASSED：trim 后 40 Unicode code points 可注册，计数、保存值和账号行一致
规则：G06N、G06V
- 断言：昵称输入原样保留，trim 后计数为 40/40
- 断言：提交后进入真实工作台，账号行保存且显示 trim 后昵称
- 截图：`CA110/PC-CA110-trimmed-40-filled.png`
- 截图：`CA110/PC-CA110-saved-trimmed-name.png`
### CA111 PC 1440x900
PASSED：41 Unicode code points 拒绝，完整输入保留
规则：G06N、G06V
- 断言：提交出现昵称 40 字符边界错误
- 断言：输入值仍为完整 41 code points，页面没有静默截断或进入工作台
- 断言：trim 后为空白的昵称拒绝，空白输入值仍保留
- 截图：`CA111/PC-CA111-over-40-retained.png`
- 截图：`CA111/PC-CA111-blank-after-trim.png`
### CA112 PC 1440x900
PASSED：8 code points 的首尾空格、emoji、组合字符和大小写密码按原样注册
规则：G06P、G06V
- 断言：密码 DOM 值和 8/128 计数保留原始语义
- 断言：确认值逐 code point 相等时真实注册成功
- 断言：注册后用原密码登录成功，改变大小写的密码登录被拒绝
- 断言：128 个 emoji 密码达到上限并真实注册成功
- 截图：`CA112/PC-CA112-raw-password-visible.png`
- 截图：`CA112/PC-CA112-raw-password-accepted.png`
- 截图：`CA112/PC-CA112-max-128-password-visible.png`
- 截图：`CA112/PC-CA112-max-128-password-accepted.png`
### CA113 PC 1440x900
PASSED：7 Unicode code points 拒绝，129 Unicode code points 拒绝并完整保留
规则：G06P、G06V
- 断言：7 code points 提交出现至少 8 位错误且完整保留
- 断言：129 code points 提交出现密码上限错误且完整保留，未静默截断
- 截图：`CA113/PC-CA113-over-128-retained.png`
- 截图：`CA113/PC-CA113-under-8-retained.png`
### CA114 PC 1440x900
PASSED：trim+lower 后恰好 254 ASCII 邮箱可发码并完成注册
规则：G06E、G06V
- 断言：输入框保留首尾空格和大写原文
- 断言：验证码发送目标和后续账户保存使用 lower-case 规范值
- 断言：长目标的完整规范值保留在 aria-label/title，可见前缀和有效期保留并使用省略号
- 断言：真实注册成功进入工作台
- 截图：`CA114/PC-CA114-valid-254-sent.png`
- 截图：`CA114/PC-CA114-valid-254-accepted.png`
### CA115 PC 1440x900
PASSED：255 边界与代表性邮箱形状表驱动拒绝
规则：G06E、G06V
- 断言：255 字符完整保留并因长度拒绝
- 断言：local/domain 非法形状均拒绝，代表性子用例复用同一错误视觉状态
- 截图：`CA115/PC-CA115-length-255-retained.png`
- 截图：`CA115/PC-CA115-shape-table-rejected.png`
### CA116 PC 1440x900
PASSED：前导 0 的六位验证码实际完成注册
规则：G06C、G06V
- 断言：输入值保持 001234
- 断言：验证码经过真实提交并进入工作台
- 截图：`CA116/PC-CA116-leading-zero-filled.png`
- 截图：`CA116/PC-CA116-leading-zero-accepted.png`
### CA117 PC 1440x900
PASSED：全角、少位、超长验证码拒绝且不改写，修正后可用
规则：G06C、G06V
- 断言：六种格式错误的输入值均原样保留
- 断言：错误提示位于验证码字段，累计六次形状错误后修正为 001234 仍真实注册成功，证明格式错误未耗用挑战
- 截图：`CA117/PC-CA117-malformed-code-retained.png`
- 截图：`CA117/PC-CA117-corrected-code-accepted.png`
### CA118 PC 1440x900
PASSED：验证码格式错与未勾条款同时存在时优先格式错误
规则：G06C、G06V
- 断言：错误验证码提交时显示验证码字段错误
- 断言：同一提交不把错误优先显示为条款错误
- 截图：`CA118/PC-CA118-format-before-terms.png`
### CA119 PC 1440x900
PASSED：确认密码不做 trim、大小写或 normalization，修正为原值后成功
规则：G06P、G06V
- 断言：去掉首尾空格、改变大小写或把组合字符改为预组字符的确认值均被拒绝，原始密码值不变
- 断言：确认值恢复逐 code point 相等后真实注册成功
- 断言：注册后原密码登录成功，trim 和组合字符 normalization 后的密码均被拒绝
- 截图：`CA119/PC-CA119-confirmation-transform-rejected.png`
- 截图：`CA119/PC-CA119-confirmation-exact-accepted.png`
### CA110 平板 768x1024
PASSED：trim 后 40 Unicode code points 可注册，计数、保存值和账号行一致
规则：G06N、G06V
- 断言：昵称输入原样保留，trim 后计数为 40/40
- 断言：提交后进入真实工作台，账号行保存且显示 trim 后昵称
- 截图：`CA110/平板-CA110-trimmed-40-filled.png`
- 截图：`CA110/平板-CA110-saved-trimmed-name.png`
### CA111 平板 768x1024
PASSED：41 Unicode code points 拒绝，完整输入保留
规则：G06N、G06V
- 断言：提交出现昵称 40 字符边界错误
- 断言：输入值仍为完整 41 code points，页面没有静默截断或进入工作台
- 断言：trim 后为空白的昵称拒绝，空白输入值仍保留
- 截图：`CA111/平板-CA111-over-40-retained.png`
- 截图：`CA111/平板-CA111-blank-after-trim.png`
### CA112 平板 768x1024
PASSED：8 code points 的首尾空格、emoji、组合字符和大小写密码按原样注册
规则：G06P、G06V
- 断言：密码 DOM 值和 8/128 计数保留原始语义
- 断言：确认值逐 code point 相等时真实注册成功
- 断言：注册后用原密码登录成功，改变大小写的密码登录被拒绝
- 断言：128 个 emoji 密码达到上限并真实注册成功
- 截图：`CA112/平板-CA112-raw-password-visible.png`
- 截图：`CA112/平板-CA112-raw-password-accepted.png`
- 截图：`CA112/平板-CA112-max-128-password-visible.png`
- 截图：`CA112/平板-CA112-max-128-password-accepted.png`
### CA113 平板 768x1024
PASSED：7 Unicode code points 拒绝，129 Unicode code points 拒绝并完整保留
规则：G06P、G06V
- 断言：7 code points 提交出现至少 8 位错误且完整保留
- 断言：129 code points 提交出现密码上限错误且完整保留，未静默截断
- 截图：`CA113/平板-CA113-over-128-retained.png`
- 截图：`CA113/平板-CA113-under-8-retained.png`
### CA114 平板 768x1024
PASSED：trim+lower 后恰好 254 ASCII 邮箱可发码并完成注册
规则：G06E、G06V
- 断言：输入框保留首尾空格和大写原文
- 断言：验证码发送目标和后续账户保存使用 lower-case 规范值
- 断言：长目标的完整规范值保留在 aria-label/title，可见前缀和有效期保留并使用省略号
- 断言：真实注册成功进入工作台
- 截图：`CA114/平板-CA114-valid-254-sent.png`
- 截图：`CA114/平板-CA114-valid-254-accepted.png`
### CA115 平板 768x1024
PASSED：255 边界与代表性邮箱形状表驱动拒绝
规则：G06E、G06V
- 断言：255 字符完整保留并因长度拒绝
- 断言：local/domain 非法形状均拒绝，代表性子用例复用同一错误视觉状态
- 截图：`CA115/平板-CA115-length-255-retained.png`
- 截图：`CA115/平板-CA115-shape-table-rejected.png`
### CA116 平板 768x1024
PASSED：前导 0 的六位验证码实际完成注册
规则：G06C、G06V
- 断言：输入值保持 001234
- 断言：验证码经过真实提交并进入工作台
- 截图：`CA116/平板-CA116-leading-zero-filled.png`
- 截图：`CA116/平板-CA116-leading-zero-accepted.png`
### CA117 平板 768x1024
PASSED：全角、少位、超长验证码拒绝且不改写，修正后可用
规则：G06C、G06V
- 断言：六种格式错误的输入值均原样保留
- 断言：错误提示位于验证码字段，累计六次形状错误后修正为 001234 仍真实注册成功，证明格式错误未耗用挑战
- 截图：`CA117/平板-CA117-malformed-code-retained.png`
- 截图：`CA117/平板-CA117-corrected-code-accepted.png`
### CA118 平板 768x1024
PASSED：验证码格式错与未勾条款同时存在时优先格式错误
规则：G06C、G06V
- 断言：错误验证码提交时显示验证码字段错误
- 断言：同一提交不把错误优先显示为条款错误
- 截图：`CA118/平板-CA118-format-before-terms.png`
### CA119 平板 768x1024
PASSED：确认密码不做 trim、大小写或 normalization，修正为原值后成功
规则：G06P、G06V
- 断言：去掉首尾空格、改变大小写或把组合字符改为预组字符的确认值均被拒绝，原始密码值不变
- 断言：确认值恢复逐 code point 相等后真实注册成功
- 断言：注册后原密码登录成功，trim 和组合字符 normalization 后的密码均被拒绝
- 截图：`CA119/平板-CA119-confirmation-transform-rejected.png`
- 截图：`CA119/平板-CA119-confirmation-exact-accepted.png`
### CA110 手机 390x844
PASSED：trim 后 40 Unicode code points 可注册，计数、保存值和账号行一致
规则：G06N、G06V
- 断言：昵称输入原样保留，trim 后计数为 40/40
- 断言：提交后进入真实工作台，账号行保存且显示 trim 后昵称
- 截图：`CA110/手机-CA110-trimmed-40-filled.png`
- 截图：`CA110/手机-CA110-saved-trimmed-name.png`
### CA111 手机 390x844
PASSED：41 Unicode code points 拒绝，完整输入保留
规则：G06N、G06V
- 断言：提交出现昵称 40 字符边界错误
- 断言：输入值仍为完整 41 code points，页面没有静默截断或进入工作台
- 断言：trim 后为空白的昵称拒绝，空白输入值仍保留
- 截图：`CA111/手机-CA111-over-40-retained.png`
- 截图：`CA111/手机-CA111-blank-after-trim.png`
### CA112 手机 390x844
PASSED：8 code points 的首尾空格、emoji、组合字符和大小写密码按原样注册
规则：G06P、G06V
- 断言：密码 DOM 值和 8/128 计数保留原始语义
- 断言：确认值逐 code point 相等时真实注册成功
- 断言：注册后用原密码登录成功，改变大小写的密码登录被拒绝
- 断言：128 个 emoji 密码达到上限并真实注册成功
- 截图：`CA112/手机-CA112-raw-password-visible.png`
- 截图：`CA112/手机-CA112-raw-password-accepted.png`
- 截图：`CA112/手机-CA112-max-128-password-visible.png`
- 截图：`CA112/手机-CA112-max-128-password-accepted.png`
### CA113 手机 390x844
PASSED：7 Unicode code points 拒绝，129 Unicode code points 拒绝并完整保留
规则：G06P、G06V
- 断言：7 code points 提交出现至少 8 位错误且完整保留
- 断言：129 code points 提交出现密码上限错误且完整保留，未静默截断
- 截图：`CA113/手机-CA113-over-128-retained.png`
- 截图：`CA113/手机-CA113-under-8-retained.png`
### CA114 手机 390x844
PASSED：trim+lower 后恰好 254 ASCII 邮箱可发码并完成注册
规则：G06E、G06V
- 断言：输入框保留首尾空格和大写原文
- 断言：验证码发送目标和后续账户保存使用 lower-case 规范值
- 断言：长目标的完整规范值保留在 aria-label/title，可见前缀和有效期保留并使用省略号
- 断言：真实注册成功进入工作台
- 截图：`CA114/手机-CA114-valid-254-sent.png`
- 截图：`CA114/手机-CA114-valid-254-accepted.png`
### CA115 手机 390x844
PASSED：255 边界与代表性邮箱形状表驱动拒绝
规则：G06E、G06V
- 断言：255 字符完整保留并因长度拒绝
- 断言：local/domain 非法形状均拒绝，代表性子用例复用同一错误视觉状态
- 截图：`CA115/手机-CA115-length-255-retained.png`
- 截图：`CA115/手机-CA115-shape-table-rejected.png`
### CA116 手机 390x844
PASSED：前导 0 的六位验证码实际完成注册
规则：G06C、G06V
- 断言：输入值保持 001234
- 断言：验证码经过真实提交并进入工作台
- 截图：`CA116/手机-CA116-leading-zero-filled.png`
- 截图：`CA116/手机-CA116-leading-zero-accepted.png`
### CA117 手机 390x844
PASSED：全角、少位、超长验证码拒绝且不改写，修正后可用
规则：G06C、G06V
- 断言：六种格式错误的输入值均原样保留
- 断言：错误提示位于验证码字段，累计六次形状错误后修正为 001234 仍真实注册成功，证明格式错误未耗用挑战
- 截图：`CA117/手机-CA117-malformed-code-retained.png`
- 截图：`CA117/手机-CA117-corrected-code-accepted.png`
### CA118 手机 390x844
PASSED：验证码格式错与未勾条款同时存在时优先格式错误
规则：G06C、G06V
- 断言：错误验证码提交时显示验证码字段错误
- 断言：同一提交不把错误优先显示为条款错误
- 截图：`CA118/手机-CA118-format-before-terms.png`
### CA119 手机 390x844
PASSED：确认密码不做 trim、大小写或 normalization，修正为原值后成功
规则：G06P、G06V
- 断言：去掉首尾空格、改变大小写或把组合字符改为预组字符的确认值均被拒绝，原始密码值不变
- 断言：确认值恢复逐 code point 相等后真实注册成功
- 断言：注册后原密码登录成功，trim 和组合字符 normalization 后的密码均被拒绝
- 截图：`CA119/手机-CA119-confirmation-transform-rejected.png`
- 截图：`CA119/手机-CA119-confirmation-exact-accepted.png`

CA115 的 `length-255-retained` 覆盖总长上限；同一 CA 的 `shape-table-rejected` 映射 local/domain 代表性形状表，未为每个同类错误重复截图。
CA117 实际逐一断言 `１２３４５６`、`12345`、`1234567`、`１２３４５`、`１２３４５６７`、`12345a` 六种输入原样保留；`malformed-code-retained` 是同一错误视觉状态的代表截图。
CA74 已覆盖“形状合法但值错 + 条款未勾选”的条款优先级；CA118 只验证本专项新增的格式错误优先级。

截图路径均相对 `PROTOTYPE_EVIDENCE_DIR` 输出目录。
每个截图由本脚本在实际页面断言通过后生成，并检查横向溢出、认证卡片纵向完整性和开发浮层缺失。
