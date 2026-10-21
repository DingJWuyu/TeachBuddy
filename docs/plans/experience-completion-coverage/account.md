# 账户、设置与帮助体验清查

本线由 sweep_account 独占维护。模型 `gpt-6.1-sol / xhigh`，固定基线 `ddc2f3d1c4e8299cbd36b821bac817e222d4e705`；真实认证、fake-mail、独立 SQLite/文件目录/浏览器，原型 `http://127.0.0.1:4174`。首次清单来自产品与原型源码独立枚举，完成后才核对上轮覆盖找漏项；所有结论均来自本轮操作。证据目录 `test-results/experience-completion/sweep/account/`。

产品入口：`auth/{AuthSurface,AuthGate,RestoreView,AccountDeletion,AuthCharacters}.jsx`、`workbench/{WorkbenchSettings,SettingsControls,SupportPages}.jsx`、`workbench/help/{HelpCenter,Figure}.jsx` 与双语 content、`reliability/DataManagement.jsx`。原型入口：`ui/tbx/src/{auth,settings,help}/`、`ui/tbx/build/patch_app.py` 与应用 bundle 中原有设置/认证控制器。精确业务保证沿 identity/workbench/data 规格与认证契约，原型模拟认证不代替真实会话。

| ID | 入口及条件 | 本轮具体序列与结果判据 | 源码分支 | 证据与状态 |
| --- | --- | --- | --- | --- |
| A01 | 匿名启动、登录 | 等初始读取→空提交/邮箱错/短密码→凭据拒绝→关闭横幅→显隐→继续输入→成功→刷新 | AuthGate / AuthSurface login | 通过；auth-results、fault-results，本轮真实登录与原型各自操作 |
| A02 | 新账户注册未发码 | 登录切注册→保留邮箱/清密码→空白与长昵称、确认不匹配、未发码→更改邮箱→返回 | AuthSurface register / switchMode | 通过；auth-results，逐字段纠错、切卡与条款 |
| A03 | 注册验证码 | 发码等待→有效码冷却→错误码/条款→有效码→注册→工作台→刷新；重发失败保留旧码、过期、耗尽、更换邮箱 | sendCode / renderCodeField | 通过；close-codes-results、auth-edges-final/results，真实冷却/重发/耗尽/过期/失败保留旧码 |
| A04 | 注册关闭/邮箱占用 | 注册卡读取关闭与提交时关闭→返回登录；占用发码→字段错误→改地址继续 | registrationOpen / closed | 通过；auth-edges-final/results，真实 env 关闭与邮箱占用 |
| A05 | 找回第一步 | 邮箱错/不存在/发码失败/未知→保留输入、冷却与重试→成功才进入第二步 | recovery-request | 通过；close-codes-results、fault-results，未知发码由 identity-targeted 保护 |
| A06 | 找回确认 | 邮箱只读→更换邮箱→重新发码→形状错误/错码/短密码/不匹配→成功→旧密码拒绝/新密码登录 | recovery-confirm | 通过；auth-results、unknown-targeted，真实重置后新密码登录 |
| A07 | 业务提交失败/未知 | 注册或重置发出后失败/丢回执→保存输入、中性未确认→返回登录→已完成结果读回；等待中编辑/切卡无旧响应回填 | operationRef / S44 | 通过；identity-targeted 及 unknown-targeted；真实已提交正文丢失与迟到隔离 |
| A08 | 会话保存失败 | 真实业务成功、activate持久保存失败→继续/重试保存/返回登录；返回后Tab与重新登录 | pending-save S45 | 通过；pending-results 六去向、close-wait-results 三尺寸等待 |
| A09 | 恢复与失效 | remembered重开→恢复等待/失败→重试/返回；当前身份失效回登录，旧响应不回填 | RestoreView / AuthProvider | 通过；identity-targeted、close-wait-results，恢复/返回及当前失效 |
| A10 | 认证布局与角色 | 1440/768/390、字段/错误/等待/恢复卡，指针、光标、密码显隐；reduced-motion静止，长邮箱无横溢 | AuthEntryLayout / AuthCharacters / auth-entry.css | 通过；auth-results、close-wait-results、motion-verified/results；真实动效插值与减少动效 |
| S01 | 昵称 | hover/键盘打开→编辑→Escape取消→Tab接续→空白/超长→Enter/失焦保存→侧栏同步→刷新/另一页 | EditableNickname | 通过；stable-visual 产品、profile-targeted；刷新及另一浏览器读回 |
| S02 | 昵称失败/输入法 | 保存失败/回执未知→原输入重试；composition Enter不提交；迟到回执不覆盖更新，长Unicode窄屏 | EditableNickname / updateNickname | 通过；regression-green、profile-targeted、continuity/results；合成 composing Enter，真实系统输入法另验 |
| S03 | 头像 | 非法类型/过大/破损→错误→有效图居中裁剪→侧栏同步→刷新→删除→刷新；取消选择不改值 | chooseAvatar | 通过，SW-ACCOUNT-03 已修；closeout-targeted、continuity/results、touch-avatar-verified/results；三格式、裁剪与边界 |
| S04 | 外观 | 深/浅切换立即应用→连续选择→保存→刷新/重登；失败/未知原请求重试、冲突采用服务器 | Segment / preferences | 通过；close-data-results、settings-targeted、regression-green 的真实版本冲突 |
| S05 | 语言 | 菜单指针/箭头/Home/End/Escape/Tab→中英即时切换→刷新与帮助同步；窄屏深色 | LanguageMenu | 通过，SW-ACCOUNT-01 已修；基线 candidates-results、最终 final-regressions |
| S06 | 背景 | 三种背景→非法/破损/过大图片→有效自定义→换回模式→重选已保存图片→刷新；上传取消 | BackgroundChoices | 通过，SW-ACCOUNT-02 已修；final-regressions、continuity/results，三格式及 20MB 边界 |
| S07 | 模拟协议 | 打开→阅读/目录跳转/到底高亮→Tab陷阱→Escape/遮罩/关闭→触发器及下一Tab→重开，中英/窄屏/动效 | SettingsConfirm / AgreementPaper | 通过；stable-visual 产品、gaps-final 阅读弹层、motion-verified；SW-ACCOUNT-03 圈定焦点，原型归焦差异交总控 |
| S08 | 退出 | 打开确认→取消→继续操作→确认→等待/已知失败/未知→导航/刷新/同目标重试→真实撤销→登录 | settings logout / revocation | 通过；settings-targeted、identity-targeted、auth-results；已知失败/未知同目标/导航/刷新 |
| S09 | 删除账户 | 打开→邮箱错误禁用→取消重开清空→正确邮箱→真实删除锁→完成及设备清理→默认中文匿名 | DangerZone / AccountDeletion | 通过；final-regressions 英文真实删除及匿名中文、stable-visual 取消/清空 |
| S10 | 删除核实 | 失败/未知→刷新原请求→重试；暂缓登录另一账户→从设置继续；设备清理失败再试 | AccountDeletion / pendingDeletions | 通过；identity-targeted 四个删除核实场景，原键/关页/设备失败/另一账户 |
| D01 | 资料包生成 | 生成→等待/完成→关闭重开→刷新读回；列表日期/状态/原请求核实 | DataManagement createExport / refresh | 通过；settings-targeted、close-data-results；queued/running/ready/failed/interrupted 的呈现另用声明响应 |
| D02 | 资料包下载/删除 | 真实ZIP下载打开索引→下载失败可重试→删除确认取消→确认删除→旧下载失效、业务原件仍在 | ExportItem / remove / download | 通过，SW-ACCOUNT-03 已修；final-regressions、gaps-final ZIP 下载解压并离线打开、final-pending 删除撤权 |
| D03 | 资料包失败/未知 | 列表读取失败→重试；生成/删除失败或丢回执→重试原请求→刷新；放弃确认取消/确认、恢复点改变阻止旧请求 | action.pending / resetOpen | 通过，SW-ACCOUNT-04 已修；pending-policy-red→closeout-targeted；continuity 的列表失败与重试生成；原请求完整保留 |
| H01 | 帮助首页与主题 | 从支持打开→推荐/常见/7主题与概览→文章→上一篇/下一篇/其他主题→返回；完整19篇双语内容与图例 | HelpCenter Home / Topic / Blocks | 通过；stable-visual 两端各 7 主题/19 篇双语，gaps-final 首页每个 href/热门词/负反馈 |
| H02 | 帮助目录/文章 | 展开折叠、当前高亮→章节跳转与滚动到底→切篇→回退/刷新保留位置；有/无帮助后切篇重置 | Directory / Article / Helpful | 通过；gaps-final 目录、到底、切篇/回退/刷新/反馈重置，AC05 当前基线重新验证 |
| H03 | 帮助搜索 | 输入/清空、热门词、CtrlK→箭头/Enter打开→再次搜索→无匹配→主题跳转→Escape/取消/遮罩→归焦Tab | Search / useIndex | 通过；stable-visual 产品、continuity/results、gaps-final composing；原型缺归焦交总控同步 |
| H04 | 帮助深链接/窄屏 | 直接打开有效/无效topic/article→搜索恢复→浏览器回退；390目录展开导航关闭、中英深浅与减少动效 | invalid / mobileOpen / route | 通过；close-data-results 真实新标签、gaps-final/ stable-visual 产品深链接及窄屏、touch-avatar-verified 触屏模拟 |
| H05 | 更新日志 | 支持入口→占位呈现与原型一致→设置/帮助返回，无虚构版本 | SupportReleases | 通过；stable-visual 两端仅图标，无虚构内容 |

## 本轮缺陷与结论

| ID | 基线真实症状 | 最终处理与证据 |
| --- | --- | --- |
| SW-ACCOUNT-01 | 语言菜单 Tab 后留在画面，焦点已移出，随后 Escape 无效；产品/原型共有 | Tab 从触发器接续原生顺序；离焦关闭。`regression-red` → `final-regressions`。 |
| SW-ACCOUNT-02 | 背景图片读取期间选圆形，迟到图片又改回自定义；产品/原型共有 | 明确选择递增代次，过期读取/错误不回填，卸载释放回填资格。`candidates-results`、`regression-red` → `final-regressions`，刷新读回圆形。 |
| SW-ACCOUNT-03 | 资料包下载/删除与头像读取禁用当前按钮，完成后焦点 BODY；导出清空后仅余关闭按钮，原生 Tab 又离开弹层 | 操作前仅在仍持有原焦点时移交本区域有效控件；资料包下载/删除/弹层内核实交给关闭按钮，头像交给昵称；设置弹层补 Tab 首尾圈定。`export-focus-red`、`download-focus-red`、`avatar-focus-red` → `final-regressions`、`closeout-targeted`。同根消费者合并计数。 |
| SW-ACCOUNT-04 | 未确认资料包的“放弃重试”确认后无效果，公共 reset 明确拒绝 pending；产品/原型共有 | 按已有数据契约移除两处无效入口和嵌套确认；详情与原键核实保留。`gaps-corrected`、`pending-policy-red` → `closeout-targeted`，核实后恢复导出。 |

以上均为基线既存，共 4 个独立根因；本轮引入的产品缺陷 0。原型更新由总控统一负责，本线只写产品独占文件。未修改认证/后端/公共保存 hook，没有增加丢弃未确认请求的能力。

## 证据、差异与边界

证据均位于 `test-results/experience-completion/sweep/account/`，具名候选、命令、源码摘要与现场归属见同目录 `receipt.md`。最终本线构建为 `candidate-web-final-2`；保留基线及先前未变化路径的通过证据，不重复整套 CI。

首次清单后核对上轮记录，补明验证码真实失败保留、三格式大小边界、所有首页链接、负反馈、合成输入法事件、触屏模拟、ZIP 离线索引及源码反查。现存 UI 的 28 组连续路径均已核对；生成中资料包的删除按钮按当前 UI 禁用，服务端取消能力不扩展为新界面。

产品与原型的两项已有差异由总控同步：原型 SettingsDialogBody 的 footer autoFocus 抢先改变 previous，原型 Search effect 缺少归焦 cleanup；产品原有实现正确。原型模拟认证刷新会重新进入独立匿名运行环境，不能把真实身份/偏好持久化断言套用到它。`stable-visual/visual-results.json` 中相关失败均已据此逐项分类，不以它们掩盖产品失败；初次取证的英文大小写、动画未稳定、等待前置及触屏引导遮罩问题沿 receipt 说明。

真实邮件、生产网络、真实系统输入法及实体触屏设备未验。本轮为真实认证/fake-mail、Chromium 独立 context，移动触控由浏览器模拟；未使用收费服务、私人配置或 50880。所有本线服务在回执前关闭，失败现场和有效证据按总控要求保留至整体成功后清理。
