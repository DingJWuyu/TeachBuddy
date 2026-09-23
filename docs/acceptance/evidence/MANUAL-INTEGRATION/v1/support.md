# SUPPORT 集成候选与预览状态

状态：**组合候选已形成，预览未更新**。维护分支 `integration/manual-business` 的产品候选为 `ea76c80d22452217c0ec11d227b992e2d787cf7a`。现有用户入口 `https://localhost:50880` 保持 `preview/usable-mvp` 完整 HEAD `66b81dfa2ccb5d65250f2f154fae7e1f0efab151`，其六线产品起点为 `7aceca1f95bba95e7dccbae7cf144929b1fe90ad`。本批没有修改预览工作树、服务配置或用户资料；只读核对服务为 `active` 且 `/api/health` 返回 `ok`，旧 M43/R33 现场仍在原位。

## 固定输入与公共接线

按序各接入一次 `f5ca645dee5ac59624866c3c3682857405eb8fac`、`58d6faf16f8d9abf3288f8d34db1833cef205c4d`、`496649b1015c58b45b2c74e7050c67aab44bf5c8`、`87d641b2dc3c15d048ba1ab966f199ee404a79d3`，在本分支对应 `e2424e53`、`3efa8724`、`f3634ecb`、`14ecc02b`。先接入预览交付文档 `66b81dfa` 为 `92fc219f`，保留已运行入口记录。SUPPORT 原回执为 [PARTIAL/self](../../MANUAL-SUPPORT/v1/receipt.md)，本轮不代签其内部审查。

公共 API 同时保留 DATA 的恢复路由、`context/recoveryId` 和 SUPPORT 偏好路由；`reliability_preferences_001` 只注册一次。备份支持迁移集合加入偏好迁移，个人 ZIP 从真实表字段 `valuesJson` 读出 `{version, values, updatedAt}`。Web 保留 DATA 的登录前恢复隔离及设置页数据管理，接入 SUPPORT 的偏好、帮助、设备现场与前台刷新。日程合流中修正两处旧状态变量引用，沿用教学版多编辑草稿及保存并发保护。README 明示 SUPPORT 仍是未部署候选。

## 实际检查

- 当前组合 `npm run build` 通过：模块目录核对通过，隔离构建库应用 14 条迁移，Web 生产包构建通过。测试均使用本树隔离库、短 `TMPDIR` 和随机 HTTPS 端口。
- SUPPORT 定向真实浏览器 5/5：偏好保存后刷新、退出重登；认证与版本冲突；日程保存和删除响应丢失后按原键确认；关闭的备课草稿选择。
- DATA API 定向 2/2：真实认证个人导出及离线备份恢复。当前组合另用隔离库中的偏好 v2 行生成个人 ZIP，并完成 `backup`、`restore`；ZIP 的偏好值和恢复副本中的偏好行、迁移账本一致。DATA 浏览器个人 ZIP、误删恢复与旧格式资源/数学上传找回 1/1 通过；因 SUPPORT 新增状态，测试定位限定到“已恢复”状态。
- 重新构建后教学日程交叉检查 5/5：慢响应串写、丢响应原请求确认、刷新后输入、保存中切换安排、移动途中刷新均通过。

## 必须由实现者修复的阻断

**恢复前新格式上传原文件无法从设置页找回。**在本树隔离浏览器和隔离数据库中，以真实登录账户放入 `teachbuddy.questions.uploads` / `pending` 的 `${account}:repro-request` 文件记录，同时保存新格式 `pending:questions-upload` 指针；执行真实 `backup`、`restore`、`activate` 后重登，确认 `recoveryId` 改变。结果：活动指针已移走、归档指针存在、旧请求没有自动重放，但设置页“查看恢复前上传”没有该原文件的下载按钮。原文件字节仍在旧 IndexedDB 键，用户界面无法取回。复现隔离现场保留在 `.scratch/manual-integration/support/recovery-repro/`，未接触用户库。

所属路径：`apps/web/src/features/reliability/deviceRecovery.js` 的 `moveUploads` / `archivedUploads` 只遍历旧资源与数学库的账户键；SUPPORT 的 `apps/web/src/features/workbench/deviceRequestStore.js` 使用账户加请求键分支，题库库名来自 `apps/web/src/features/questions/uploadRecovery.js`。需由 DATA/SUPPORT 接缝实现者完成有限修复，并独立复验恢复后原稿可取回且旧请求不会自动重放。本轮不擅自改变恢复业务语义。此前已通过的旧格式资源/数学范围不覆盖该新格式缺口。

因此未把 SUPPORT 候选部署到 50880；用户继续使用稳定六线版本。SUPPORT 的冻结格式包装、全部滚动锚点和历史冗余记录仍按原回执作为范围限制，不扩大为本轮重写。题库图片/扫描自动识别、旧 DOC 对象风险及 MF-UI-01 对照预览裁切仍按既有记录；独立 DATA/SUPPORT 结论由对应验收流程提供。本批未合并 main、未 push、未扩 Agent。
