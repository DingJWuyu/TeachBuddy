# Account 完整体验清单

任务依据及完成条件见[本轮记录](../prototype-experience-audit.md)。唯一写者 account，作者 gpt-6.1-sol / medium；固定输入 `a5daad25a712a4d2f75f34da71bc97e645f1a8a0`。产品真实认证与 fake-mail，隔离浏览器/数据库，不操作 50880。运行证据位于 `test-results/experience-audit/account/`，回执为同目录 `receipt.md`。

## 分母与依据

原型认证完整表单位于 `teachbuddy-app/ui/app.js` 的 `AuthSurface`、`AuthGate`、`RestoreView`，角色覆盖 `ui/tbx/src/auth/{EntryLayout,Cast}.jsx`；设置基本结构为 bundle 的 `WorkbenchSettings`，覆盖组件为 `ui/tbx/src/settings/Settings.jsx`；帮助为 `ui/tbx/src/help/HelpCenter.jsx` 及双语内容；更新为 bundle `SupportReleases`。下表路径均相对 `docs/design-system/`，产品对应同名 features/auth 或 workbench 文件。真实业务、身份失败/核实及加入时间不虚构沿身份/工作台规格，学期及真实反馈收件保持暂缓。

每行的多个条件属于同一控件状态族，运行时逐项记录。状态“待验”不代表源码不符；实际证据产生后再改为通过、已裁决差异或受阻。

| ID | 页面/符号与完整触发分支 | 产品对应 | 条件与连续动作 | 状态/证据 |
| --- | --- | --- | --- | --- |
| A01 | AuthSurface 登录初始、品牌、标题、副标题、标签 | AuthSurface / AuthEntryLayout | 1440、768、390，页面自然滚动 | 通过；`auth-results.json；*-auth-login-*.png` |
| A02 | 登录邮箱空白/非法/规范化与密码长度 | rules / AuthSurface | 提交错误后编辑再次提交，错误焦点 | 通过；`auth-results.json（A01-A03）` |
| A03 | 密码隐藏/显示，记住我 | PasswordToggle | 显隐不改值，勾选/取消，键盘 | 通过；`auth-results.json（A01-A03）` |
| A04 | 登录等待/成功/凭据拒绝/一般失败 | AuthSurface | 禁重复，拒绝清密码，其他失败保留 | 通过；`fault-results.json（拒绝、等待与503）` |
| A05 | 登录与注册、找回往返 | AuthSurface | 邮箱与卡片现场、密码、提示清理 | 通过；`auth-results.json（切卡/重置回登录）` |
| A06 | 注册未发码全部字段与条款链接 | AuthSurface | 字段/提交顺序、条款默认未勾 | 通过；`auth-results.json（注册字段/条款）` |
| A07 | 注册发码等待/失败/成功/冷却/可重发 | AuthSurface | 发码不显示注册中，换邮箱清旧挑战 | 通过；`close-codes-results.json（冷却到期可重发、成功替换挑战）` |
| A08 | 注册昵称空白/超长、密码/确认、码形状、条款 | rules / AuthSurface | 逐字段纠错及焦点，Unicode | 通过；`auth-results.json（逐字段纠错）` |
| A09 | 注册码错误/过期/耗尽/替换 | AuthSurface | 剩余次数，重新发码恢复 | 通过；`close-codes-results.json（旧邮件码拒绝/声明替换错误）` |
| A10 | 注册预读/提交等待与中途切卡/编辑 | AuthSurface | 重复 Enter、迟到回执隔离 | 通过；`async-regression（两项注册预读）` |
| A11 | 注册开放/关闭/邮箱占用 | AuthSurface | 已开卡收到关闭与返回登录 | 通过；`fault-results.json（关闭）、edge-results.json（占用）` |
| A12 | 找回第一步空白/无效/不存在/发送中/失败 | AuthSurface | 成功发码后才进确认页 | 通过；`close-codes-results.json（不存在邮箱找回停留第一步）` |
| A13 | 找回确认邮箱锁定、长邮箱省略、换邮箱 | AuthSurface | 换邮箱清挑战，回登录 | 通过；`auth-results.json、auth-states-regression（长地址）` |
| A14 | 找回验证码/密码/确认错误与重发冷却 | AuthSurface | 过期、失败、重新发码 | 通过；`auth-results.json（找回确认）` |
| A15 | 重置等待/成功/未知结果 | AuthSurface | 保留输入、不假成功、登录恢复 | 通过；`auth-results.json、async-regression（重置未知）` |
| A16 | 普通横幅关闭、字段错误、未知结果提示 | AuthSurface | 可恢复错误保留值，逐状态角色表情 | 通过；`fault-results.json、async-regression` |
| A17 | 业务成功保存失败 S45 | AuthSurface | 继续当前、重试保存、返回登录 | 通过；`pending-results.json（三去向双方）、auth-states-regression` |
| A18 | 恢复 S46/S47 与启动中性占位 | RestoreView / AuthGate | 等待、重试、返回、迟到结果 | 通过；`close-wait-results.json（双方恢复等待三尺寸）` |
| A19 | Cast 闲置/指针跟随/离开/文本焦点 | AuthCharacters | 四角色点击/悬停/闲置小动作/光标左右 | 通过；`auth-results.json（角色互动）` |
| A20 | Cast 密码隐藏/显示/输入/勾选 | AuthCharacters | 输入点头、偷看、害羞、复选反馈 | 通过；`auth-results.json（密码/文本/复选）` |
| A21 | Cast 错误/成功与减少动画 | AuthCharacters | 表情/纸屑/语句，动态切 prefers-reduced-motion | 通过；`edge-results.json（减少动画）、auth-results.json（错误/成功）` |
| A22 | 认证布局与键盘连续操作 | auth-entry.css | 1440/768/390，长表单/错误/恢复/未知 | 通过；`close-wait-results.json（S44注册/重置等待和未知、S45失败/等待均三尺寸）` |
| S01 | 设置资料卡昵称/邮箱/账户徽标 | WorkbenchSettings | 长昵称/邮箱、三尺寸、中英文 | 通过；`comparison-results.json（三视口双语深浅）、profile-regression` |
| S02 | 昵称原位编辑、Enter/失焦/Escape/输入法 | EditableNickname | 取消还原焦点，校验、保存中、失败重试 | 通过；`supplement-results.json、profile-regression（失败/未知/跨浏览器）` |
| S03 | 默认头像/上传/删除/无效/读取中 | WorkbenchSettings | JPG/PNG/WebP，5MB边界，中心裁剪，同步侧栏 | 通过；`supplement-results.json、edge-results.json、settings-regression` |
| S04 | 外观浅色/深色 | Segment | 即时全站生效、保存刷新读回 | 通过；`comparison-results.json、settings-regression` |
| S05 | 语言触发/选择/外点/Escape/方向/Home/End | LanguageMenu | 简体中文/English，焦点、保存、刷新 | 通过；`supplement-results.json（闭层后键盘）、profile-regression` |
| S06 | 三背景选择、无自定义图片/上传中 | BackgroundChoices | 三尺寸，选择反馈，换主题 | 通过；`comparison-results.json、supplement-results.json` |
| S07 | 自定义上传/更换/重选旧图/无效/读取失败 | BackgroundChoices | 20MB边界，切普通后回自定义，刷新读回 | 通过；`supplement-results.json、edge-results.json、settings-regression` |
| S08 | 偏好读取失败/保存中/失败/未知/冲突 | WorkbenchSettings | 原键重试、新选择保留、采用服务端 | 通过；`close-data-results.json、close-data-prototype-results.json（首次读取失败/禁用/重新读取恢复）` |
| S09 | 协议开启/关闭/遮罩/Escape/Tab圈定 | SettingsConfirm | 焦点连续两次恢复，移动端、深浅中英 | 通过；`settings-regression（连续归焦）、comparison-results.json（产品焦点圈定）` |
| S10 | 协议六目录点击/滚动跟随/末节 | AgreementPaper | 短末节、手滚、快速多次点击，示例声明 | 通过；`comparison-results.json、*-agreement.png` |
| S11 | 导出打开/创建中/空/queued/running/ready | DataManagement / ExportItem | 真实生成，轮询，关闭重开，时间/状态 | 通过；`close-data-results.json、close-data-prototype-results.json（固定五种列表状态及控件可用性）` |
| S12 | 资料包下载/删除二次确认/取消 | ExportItem | 真 ZIP 下载打开，删除后列表读回 | 通过；`settings-regression（ZIP下载、资料包删除/撤权）` |
| S13 | 导出失败/下载失败/未知/重试/放弃 | DataManagement | 保留原请求，嵌套确认焦点及恢复 | 通过；`close-data-results.json、prototype-download-results.json（明确生成/下载失败后重试）` |
| S14 | 退出弹层取消/关闭/确认/等待 | WorkbenchSettings | 确认后真实退出，等待重复禁用 | 通过；`auth-results.json、settings-regression` |
| S15 | 退出失败/未知/跨导航核实 | AuthProvider + WorkbenchSettings | 原目标重试，不假完成，草稿保留 | 通过；`lifecycle-regression、async-regression（退出未决）` |
| S16 | 危险区与删除确认邮件验证 | DangerZone / SettingsConfirm | 空白/错邮箱/大小写/取消/再次打开 | 通过；`comparison-results.json、profile-regression（真实危险确认）` |
| S17 | 删除等待/已完成/失败/未知/设备清理失败 | auth deletion | 独立账户、刷新原键核实、匿名中文 | 通过；`profile-regression、auth-states-regression、async-regression（清理失败/关页核实）` |
| S18 | 继续核实多账户/退出锁/长地址 | WorkbenchSettings | 1440/768/390，独立身份，按钮完整 | 通过；`multiple-deletion-regression（三视口多目标）` |
| H01 | 帮助首页搜索/热门词/推荐/七主题/常见问题 | HelpCenter Home | 中英文深浅色三尺寸、每入口落点 | 通过；`edge-results.json（全部首页链接）、comparison-results.json` |
| H02 | 七主题概览、文章、其他主题 | Topic / content | 全主题/全文章逐页，无缺图、无溢出 | 通过；`comparison-results.json（7主题/19文章）、supplement-results.json（英文19文章）` |
| H03 | 目录折叠/当前主题/概览/文章/首页 | Directory | 连续折叠、切主题自动展开、键盘 | 通过；`comparison-results.json、help-green（原3项）` |
| H04 | 文章正文所有 block 与图示/前后篇/反馈 | Article / Blocks / Figure | 每文、首末文、反馈两分支与切文重置 | 通过；`comparison-results.json、supplement-results.json（全部文章、两类反馈）` |
| H05 | 文章目录点击/滚动跟随/页面滚动记忆 | Article / HelpCenter | 跳节、离开返回、浏览器前后退/刷新 | 通过；`scroll-red-final、scroll-green、scroll-results.json；共同末节高亮观察另见下方` |
| H06 | 搜索空词热门/标题/正文/多词/特殊字符/无结果 | Search | 高亮/摘要分组、无结果主题跳转 | 通过；`supplement-results.json（修正选择器后搜索）` |
| H07 | 搜索上下循环/Enter/Escape/清除/取消/CtrlK | Search | 焦点返回、快捷键连续开关、输入法 | 通过；`supplement-results.json、help-green` |
| H08 | 搜索指针移动/点击结果/遮罩/Tab圈定 | Search | 长结果滚动与活动项、内部空白点击 | 通过；`supplement-results.json、help-green（搜索键盘/焦点）` |
| H09 | 帮助深链接/无效主题/无效文章/新标签 | HelpCenter | 刷新、前进后退、恢复目录/正文 | 通过；`close-data-results.json、close-data-prototype-results.json（Ctrl点击真实新标签）` |
| H10 | 窄屏目录展开/收起/搜索/导航自动收起 | HelpCenter | 390/768，连续操作，焦点与溢出 | 通过；`comparison-results.json、help-green（窄屏连续目录）` |
| H11 | 更新页报纸图标、无文字与无障碍名称 | SupportReleases | 中英文深浅色三尺寸 | 通过；`comparison-results.json（双方空文字/图标）` |

## 已确认问题

### EA-account-01 - 帮助快速切文后丢阅读位置

- 分类：固定基线缺陷，本轮修复；非后端问题。
- 真实操作：`/help/start/workspace` 使用鼠标滚轮滚到底部，点下一篇，再用浏览器后退。原型恢复约 774px，产品基线返回 0px。
- 根因：`HelpCenter` 将阅读位置延迟 150ms 保存，切换路由清理该定时器，最后位置未进入账户 scene。
- 修复：读取区滚动事件同步保存账户 scene，沿现有 `useScene` 的同步持久化契约；无新增存储层。
- 回归：现有 `help-shell.spec.js` 增加快速滚动/切文/后退，暂停定时器固定竞态；减少动画避免把进入动效的 3px 高度变化当阅读位置错误。固定基线最终回归期望 774、实际 0；候选通过。真实鼠标路径候选恢复 774。
- 证据：`scroll-red-final/` 的 trace、`scroll-green/`，候选 `scroll-results.json` 与 `baseline-help-return-scroll.png`；候选目录 `candidate-web/`。

## 既有差异与边界

- 390px 背景卡沿既有产品回归保留足够高度，上传提示在“自定义”标题上方；原型同尺寸存在重叠。既有真实能力、未知结果核实、身份清理与恢复按身份/工作台规格保留，不模拟原型内存存储。原型刷新会清内存，持久化/失败恢复专项以隔离真实认证产品验证。
- 原型协议弹层的旧自动聚焦会影响关闭归焦；产品既有连续归焦改善由工作台明确焦点规则和现有回归保护。本轮不回退。
- 原型与基线共有观察：帮助文章“本页内容”末项“辅助栏”点击后已滚到末尾，却仍高亮前节。设计输入只规定宽屏跟随滚动，未规定该末项选择行为；按总控裁决交 buffer，不修改、不计本轮偏差。实际证据 `toc-observation.json` 与双方 `*-help-toc-final-section.png`，源码定位 `HelpCenter.jsx` 的 `Article` 内固定 `root.top + 120` 阅读线。
- 本轮覆盖分母 51 个状态族，51 项均已覆盖，前次九项未验子条件已补齐；上表按状态族映射证据，不把 51 解释为仅 51 次动作。七主题十九篇文章分别在双方中文与英文遍历。完整 CI、独立审查、集成、真实邮件、目标设备仍未由本工作线执行。
- 探索时的精确中文选择器、原型布尔属性序列化与异步过渡等待假设已由后续定点脚本纠正；初版 `comparison-results.json` 中的五条失败需结合 `supplement-results.json` 和既有归焦裁决阅读，不计产品缺陷。新增滚动回归曾采到进入动画高度差，现以减少动画固定最终布局，并重新证明基线红/候选绿。


## 最后九项补验与冻结

- A07/A09/A12：`close-codes-results.json` 共六项双方验证。浏览器时间与真实服务时钟一起推进31秒，倒计时归零后重发，挑战ID变更并清输入；产品真实认证拒绝上一封邮件验证码，找回不存在邮箱落邮箱字段并保留第一步。原型固定码且允许找回自动建模拟账户，真实性分支采用同一声明错误响应替身，不声称原型具备真实账号判定。
- A18/A22：`close-wait-results.json` 共42组三尺寸记录。双方分别固定恢复等待、S45保存失败/重试等待、S44注册和重置的提交等待/未知结果，检查页面无横向溢出、文案/输入保留，并逐组截图；解除等待后继续真实工作流。恢复由已记住身份的页面恢复入口触发，原型补模拟页面绑定丢失后的状态读取，产品使用真实认证容器。
- S08/S11/S13：候选 `close-data-results.json` 全部通过；原型对应读取失败恢复、生成拒绝重试、五种导出列表状态亦通过，下载精确路径注入与重试由 `prototype-download-results.json` 通过（下载11205字节ZIP）。故障/固定异步状态由浏览器响应替身提供，普通生成与下载仍经真实流程；排队/生成中的删除禁用，失败/中断可删除，可下载项保留下载。明确生成拒绝从关闭后重新导出重试，下载失败保持资料包并原位重试。
- H09：实际Ctrl点击文章链接打开新标签。产品以真实remembered身份自动恢复并打开目标文章；原型独立标签运行时没有共享内存账户，落到保留目标hash的登录页。这是既定原型内存模拟边界，不伪装跨标签真实认证。
- 没有新增产品问题或源码修改；唯一独立偏差仍是已修 EA-account-01。最后补验结束，作者范围冻结，待总控集中审查、CI与集成。
