# 账户与身份技术入口

修改认证页面、transport、身份交接或账户生命周期时读本页。用户行为见[账户规格](../features/identity.md)，跨操作语义见[认证契约](../contracts/auth.md)，双向条件见[认证验收](../acceptance/auth-cases.md)。接线、公开端口或清理归属改变时同步本页。

## 页面与可信调用

Web [apps/web/src/features/auth/](../../apps/web/src/features/auth)，API [apps/api/src/features/auth/](../../apps/api/src/features/auth)；邮件 adapter 在 [apps/api/src/features/auth/mail.js](../../apps/api/src/features/auth/mail.js)，应用组合入口为 [apps/api/src/app.js](../../apps/api/src/app.js)。

认证拥有账户、挑战、会话和来源防护，工作台只取得可信 principal。具体工厂、transport 和导出类型以 [apps/api/src/features/auth/index.js](../../apps/api/src/features/auth/index.js)、[apps/web/src/features/auth/index.jsx](../../apps/web/src/features/auth/index.jsx) 为准；组合入口在 [apps/api/src/app.js](../../apps/api/src/app.js)。

- 认证路由先于通用 JSON/CORS 中间件挂载；邮件提供者由组合入口注入，网络投递留在 SQLite 事务之外。
- 账户拥有未决退出状态及登录上下文准备，设置消费公共状态和同目标重试动作。设备资料由各存储拥有者清理，App 向认证注入删除确认后的清理回调；认证等待其完成，不解释业务存储键或草稿结构。
- 身份交接先失效旧请求代次，再经工作台 [getWorkbenchContext](../../apps/web/src/features/workbench/api.js) 读取 context；可信 accountKey 一致后才挂载账户数据。认证存储故障映射为工作台暂不可用，不能当作匿名或退回旧身份。
- 业务请求经认证 transport 附加页面绑定及来源保护，保留原 body 和幂等键；每次请求重新验证身份，不自动重试业务写入。
- 旧库迁移保留稳定账户与资料；昵称不能从邮箱臆造。旧密码可验证时兼容并升级，无法验证时给出找回路径；迁移须用隔离旧库验证。
- 备份还原使用[认证恢复契约](../contracts/auth.md#部署恢复的认证撤销)，外层按[数据恢复顺序](../contracts/data.md#部署备份与还原)调用，不自行清认证表。

昵称保存后的身份复核由 `AuthProvider` 区分两件事：同一活动会话的成功读取可确认保存流程，只有当前资料读取代次可发布昵称。较早读取被更新读取淘汰时，不发布旧资料，也不把已确认的保存误报为结果未知；传输失败仍不确认。账户、会话或身份代次已变化时，旧复核仍失效，不能重新挂载退出账户或覆盖新账户。

## 页面资源与清理

`AuthEntryLayout.jsx` 组织入口布局，`AuthCharacters.jsx` 负责装饰动效；新增样式限定在 `.ae-entry` 内，保留认证规则、Provider、API 与工作台内部样式。表单切换不重建角色。可见光标位置由即时 canvas 测量得出，隐藏密码仅按长度测圆点，显示密码时测可见文本宽度；角色层不持久保存文本或新增请求。卸载释放指针、媒体偏好、可见性监听和动画帧。

## 恢复与账户生命周期

认证离线端口为 [apps/api/src/features/auth/recovery.js#prepareRestoredAuth](../../apps/api/src/features/auth/recovery.js)；外层恢复工具只调用公开操作，清理范围与幂等结果由[恢复契约](../contracts/auth.md#部署恢复的认证撤销)拥有。认证等待账户删除与设备清理完成，业务存储拥有者各自删除本账户资料；设置和 App 只组合回调。未完成删除的启动接续见[账户删除交换](../contracts/auth.md#账户删除交换-i08)。

## 验证入口

按[身份验证选择](../acceptance/README.md#模块与底座入口)选择替身、真实认证/fake-mail 与独立真实邮件专项；竞态、页面交接、退出及删号需检查真实浏览器与 SQLite。收件器或 test-principal 的通过不能代签真实投递、完整浏览器重开或目标设备。
