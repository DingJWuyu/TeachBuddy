# 备课预览裁切增量交付

当前用户入口：**https://localhost:50880**，`teacherworkspace-preview.service` 运行 `preview/usable-mvp`。本次重启时工作树 HEAD 为 `cb203b045390e642fe7679df57073b7faa6358db`，产品修复提交为 `b6fe0cc3f80faf996eb4020f53725d8e64c6f842`；此前六线产品起点 `7aceca1f95bba95e7dccbae7cf144929b1fe90ad` 保留。SUPPORT 候选未接入在线版本。

从原在线 HEAD `66b81dfa2ccb5d65250f2f154fae7e1f0efab151` 依序引入固定输入 `b9dd00fab7b12016674bd52ae792d4e82805576c`、`bea0deb1481dd0fa9ca23b30e86d6b78e4b351aa`、`76b8fc0ed1cb8bdf4f91e30690d30fe0f1598455`、`359fee8f19d1ad309ceb9d0fce2979bde8634ab5`、`f009b63963f0443678557b10c489f11a01678b79`，本分支对应 `b6fe0cc3`、`7b9b32b1`、`55beaa34`、`8de2553a`、`cb203b04`。预览裁切 MF-UI-01 的 [独立定向结论](../../MANUAL-FLOW/v1/recheck.md)为 PASS；[DATA 六线组合独立报告](../../MANUAL-DATA/v1/independent.md)为 PASS，均不扩展到 SUPPORT 或目标设备。

## 更新与实际检查

- 停服后复制原 `.scratch/preview/`、`.env` 和 `apps/web/dist`，然后在原树 `npm run build` 成功。模块目录校验通过，API 仅在隔离构建库应用 13 条迁移，Web 生产包构建通过；没有新依赖或用户库迁移。
- 原同名服务重启后为 `active`，`GET /api/health` 返回 `ok`。首页 HTML 和新版 JS/CSS 均为 200。真实浏览器打开首页显示登录表单及“创建账户”，控制台无消息；匿名 `/api/workbench/context` 返回 401。本轮没有注册、发码或使用替身账户。
- 在线库重启前后 `integrity_check=ok`，账户 1、迁移 21 均未变化。原 17 个受跟踪 M43/R33 生成证据修改及 `.tmp-bm/`、`apps/api/docs/`、`BUSINESS-MVP/`、`M42/` 未清理、未提交，也未当作本次验收。

回退现场：`/home/liam_t/项目/TeacherWorkspace-preview/.scratch/manual-integration-preview/20260923T0659-preview-fix/`，权限 700，含 `base-head.txt`、`preview-runtime-before/`、`env-before`、`web-dist-before/` 和 `build.log`。旧源代码可按原 HEAD `66b81dfa2ccb5d65250f2f154fae7e1f0efab151` 找回。回退前仍须先停服并保留回退期间的新写入；本次未执行回退或用户库恢复演练。

## 保留事项

SUPPORT 偏好与新格式上传恢复接缝尚未发布，待其固定修复和独立验收。注册发码的“验证码发送失败”由 MANUAL-MAIL 诊断，本轮未推测原因或发送邮件。题库图片/扫描视觉识别、旧 DOC 对象丢失风险、目标设备与暂停的 Agent 范围仍按既有记录。本轮未合并 main、未 push、未公网部署。
