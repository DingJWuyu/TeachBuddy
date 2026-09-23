# 外壳、设置、帮助与交互任务入口

顶栏、侧栏、首页、认证与功能模块有不同写入边界。普通模块任务保留外壳；全站外壳改造目前暂停，具体页面根据新的用户指令进行。

## 参考与动作

UI 必须遵守[界面规则](../rules/design-and-verification.md)。外壳与支持页参考真实登录态 EMStudio，排除本项目没有的商业能力。模块以已采用的 Impeccable 方向改进。弹窗、菜单、展开/收起都要渐进进退、可快速反向、能恢复焦点。

原型入口：`prototype/behavior/manifest.md`。原型只提供已确认 UI/UX，业务调用继续使用真实产品。用户不需要侧栏底部额外“AI 助理”；助理入口如涉及后续授权，使用稳定位置图标，不随模块忽有忽无。

<a id="设置边界"></a>
## 设置边界

当前真实能力：账户资料展示、个人资料导出、最近删除恢复、退出。头像只做本地预览；主题、背景、语言和周起点只有设置界面选择，没有完整全站/账户保存。加入时间未暴露；删除账户不能真正执行；协议入口仅占位，用户没有要求本产品签署协议，不因此扩建后端。

设置已按用户要求移除草稿管理、恢复隔离记录及备份说明 UI。底层数据和维护 CLI 仍保留；不要依据旧 SUPPORT 截图恢复被删入口。细项事实见[设置证据](../acceptance/evidence/UI-SETTINGS/status.md)。

帮助有真实中文内容、搜索、目录、文章与返回现场。更新日志页只显示图标，不手改自动发布数据。见[帮助证据](../acceptance/evidence/UI-HELP/status.md)。

## 代码与验证

| 位置 | 职责 |
| --- | --- |
| `apps/web/src/features/workbench/chrome/` | 顶栏、侧栏、首页及外壳交互 |
| `apps/web/src/features/workbench/WorkbenchSettings.jsx`、`settings-shell.css` | 当前设置 |
| `apps/web/src/features/workbench/SupportPages.jsx`、`helpContent.js`、`support-shell.css` | 帮助与更新日志 |
| `apps/web/src/features/workbench/ModuleMotion.jsx`、`ModuleOverlays.jsx` | 模块共用动效与弹层 |

设置测试：`apps/web/e2e/settings-shell.config.mjs`；帮助测试：`apps/web/e2e/help-shell.config.mjs`；模块交互测试：`apps/web/e2e/ui-modules.config.mjs`。只跑本次相关入口，不把替身布局测试写成业务后端通过。
