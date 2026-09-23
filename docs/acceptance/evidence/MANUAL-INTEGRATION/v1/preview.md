# 手动业务预览入口

- 工作树：`/home/liam_t/项目/TeacherWorkspace-preview`，分支 `preview/usable-mvp`。
- 实际运行的手动业务产品组合：`7aceca1f95bba95e7dccbae7cf144929b1fe90ad`，从原 `4db937daa4d5abd0a03f69917528665f94ebb001` 快进接入。
- 唯一入口：**https://localhost:50880**，原 `teacherworkspace-preview.service` 同名服务。原有 `.scratch/preview/`、根目录 `.env` 和用户资料目录继续使用；未合并 main、未 push。

## 接入与运行检查

- 交接依据：控制树 `.scratch/dag-dispatch/MANUAL-INTEGRATION/preview-handoff.md` 已确认旧实现者无运行写者。合入前的 17 个 M43/R33 受跟踪生成证据修改，以及 `.tmp-bm/`、`apps/api/docs/`、`docs/acceptance/evidence/BUSINESS-MVP/`、`docs/acceptance/evidence/M42/` 原目录完整留在预览树，没有进入产品提交，也没有当作本次验收。
- 停服后备份原数据库、WAL、文件目录和运行配置，再按锁定依赖执行 `npm ci` 与 `npm run build`。构建通过，隔离构建库应用 13 条迁移。服务以原 `start.sh` 和 transient unit 启动，日志显示正式库新增 2 条迁移、跳过 11 条，分别核对为 `lessons_0003_order` 与 `reliability_001_manual_data`。
- 正式库 `integrity_check=ok`；更新前后账户 1、题目 3、备课 1，迁移记录由 19 增至 21；原文件数 0。未 reset、seed 或用用户库做恢复演练。
- `GET /api/health` 返回 `ok`，未登录的工作台接口返回 401。真实浏览器打开首页显示登录表单和“创建账户”，页面 JS/CSS 均返回 200，浏览器控制台无错误。登录页截图 `login-after.png` 保存在下述本机受限现场目录。未使用替身身份或发送邮件。

## 原现场与回退来源

受限目录：`/home/liam_t/项目/TeacherWorkspace-preview/.scratch/manual-integration-preview/20260923T062552Z/`，权限 700。

- `base-head.txt` 保存原提交；`worktree-before.tar` 保存 17 个修改文件与上述 4 个未提交目录，原文件也仍在原位。
- `preview-runtime-before/` 保存停服后的 `.scratch/preview/`，含原数据库、WAL、文件和运行配置；`env-before` 保存原根配置，均限本机访问。
- `build.log` 和 `login-after.png` 是本次接入检查材料。回退如需恢复旧数据，须先停止服务并另行保留回退前的新写入，再按原提交与上述受限副本处理；本次未执行回退。

## 当前边界

设置偏好 SUPPORT 尚未接入，DATA 最终组合独立验收仍在并行。题库图片及扫描页自动视觉识别未完成；旧 DOC 转换存在对象或公式信息丢失风险，需要人工核对。MF-UI-01 对照预览裁切更新尚待接入，普通资源预览可用。数学 MM-SPEC-01 独立定向复验已通过；不代替旧 DAG 或目标设备验收。Agent 后续开发仍暂停。
