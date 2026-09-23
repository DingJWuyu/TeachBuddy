# PREVIEW-DELIVERY@1 本机预览交付

**PASS / self，仅限本次最小预览交付。** 真实生产构建和 HTTPS API 已运行，入口 **https://localhost:50880**。用户从“创建账户”自行发送验证码并注册；新预览库与已有认证测试库隔离。完整 MVP、Agent 合流、F60、备份恢复和全部输出验收仍未完成。

## 固定版本与接手

- 起点：`3eec17a`，分支 `preview/usable-mvp`，worktree `/home/liam_t/项目/TeacherWorkspace-preview`。
- merge 固定产品 `3d5c3f308bfeaa0e038a9fb86e6dab2816b9ec7c`；只 cherry-pick 测试修复 `baaeb09973cd01848432622e35712b74627f4488`，未引入 `006b4def` 准备提交。
- 当前产品组合：`d51dd3a9054039160c8c7796e0241acf047c0c47`。本次没有修改产品源码或业务接口，仅启动配置、README 和本目录证据。
- 固定独立结论读取 `efd3b071a603d38902688b0b4dd68289e8516c69:docs/acceptance/evidence/R35/v1/local-review6.md`，006/007 已独立关闭，不将其外部未决项改成 PASS。
- 根 DAG/run-state 与起点逐字一致。本任务不读取其他 session 的活动 HEAD，不联系其他业务 session，不合 main、不 push、不部署公网。

服务归属为 Linux 用户 liam_t 的 `teacherworkspace-preview.service`，端口 50880，交付时 active/running。首次 PID 1542730，经主动重启后 PID 1549340。运行目录、权限、准确启动/停止/重启与机器重启后的重新创建命令统一见 [README](../../../../../README.md#本机服务与数据)。服务保留运行，外层可直接接手，无需等待其他 DAG 节点。

## 实际验证

| 场景 | 结果和证据 |
| --- | --- |
| 新库生产构建 | `npm ci --no-audit --no-fund`、加载独立 runtime.env 后 `npm run build` PASS；[build.log](build.log)。仅既有大 chunk 提示。 |
| 真实登录 | 新库中受控创建独立验证账户，仅初始账户种入 SQLite；此后完全走真实 UI 登录、Cookie、activate/restore，无 test-principal、无认证替身。[登录页面](login.png)、[浏览器结果](browser-checks.json)。未自动发邮件。 |
| 录题、编辑、保存 | 普通 UI 点击“题库→自建”，添加数学题干、保存、修改长期笔记再保存；刷新后题干和笔记保留。[题目](question.png)。 |
| 备课引用 | 普通 UI 新建备课、添加环节、从题库勾选真实保存题目、采用并保存；刷新后标题和引用保留。[备课](lesson.png)。 |
| 同库服务重启 | `systemctl --user restart teacherworkspace-preview` 后新进程恢复 remembered 会话，题目正文/笔记、备课标题/引用保持。[restart.json](restart.json)、[题目](restart-question.png)、[备课](restart-lesson.png)。 |
| 其余入口 | 真实路由 `/resources`、`/math`、`/classes`、`/calendar` 可达，并等待实际页面控件。截图：[资源](resources.png)、[数学](math.png)、[班级](classes.png)、[日程](schedule.png)。这里只证明入口和当前页面渲染，不扩大为所有操作验收。 |
| 视觉及脚本错误 | 核对 1440×900 实际截图，核心题目与备课操作可见、公式渲染正常；浏览器 pageerror 0。其余页最终截图关闭动画，避免把中间帧误判为布局缺陷。 |
| 隔离与安全 | `.scratch/preview` 目录 0700，配置和数据库文件 0600，服务 UMask 0077；真实配置 Git ignored。现有认证库未读写，TLS 仅复用，SMTP 仅服务器 source。产品模型请求 0，外发邮件 0。 |

浏览器工具先尝试独立 `chrome-devtools-axi` session，连续遇到重连导致 page id 失效，改用独立 Playwright Chromium 完成普通用户点击。自动化忽略本地证书信任错误。初始采集对有值 textarea 使用 `getByLabel(exact)` 导致定位失败，截图和可访问树已显示保存值；改为 `getByRole('textbox', {name, exact:true})` 后流程通过，未修改产品掩盖采集问题。

验证账户仅用于本次流程，其数据保留在新预览库，与用户自注册账户按原认证规则隔离。测试密码和会话状态不提交、不进入报告，完成后删除采集用明文凭据和会话副本。

## 已知限制与后续

- 首页与右栏 AI 发送仍禁用，未合入另树处理的 Agent；无虚构回复。用户先从六模块直接操作。
- 新 F60 工具、完整备份/恢复未实现。Pandoc 输出修复待根交固定候选串行合入，本次不宣称六输出全通过。
- SMTP 已从获准文件供服务器加载，但注册/找回的真实投递由用户从 UI 完成，本次未代测外部邮件。
- TLS 复用原测试证书，不改变用户已有证书现场；实际浏览器若尚未信任原 CA，需要沿原认证验收的证书信任步骤处理。
- 本次仅本机 localhost URL。未更改受信 Origin 规则，不保证通过其他 hostname/IP 直接访问。
- R35 的在线/新材料质量、同内容目标 Office PDF、物理设备及 OBS-001/002 保持原有未决状态。
- 根接手只在此分支串行合入固定成果，构建后重启相同服务，保留 `.scratch/preview/data` 与 `files`。无需重新注册已有预览账户。

```yaml
task: PREVIEW-DELIVERY@1
attempt: 1
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T20:02:44.226168+00:00"
session_id: unavailable
runner: "Codex / gpt-6-astra / low"
skills_used: [writing-for-agents]
base_revision: "3eec17ac8c4b9786f6d67008d8165f3c5aa10e5a"
result_revision: "本回执所在候选提交；完整 SHA 由最终回调返回"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
inputs: ["3d5c3f308bfeaa0e038a9fb86e6dab2816b9ec7c", "baaeb09973cd01848432622e35712b74627f4488", "efd3b071a603d38902688b0b4dd68289e8516c69"]
changed_files: ["README.md", "docs/acceptance/evidence/PREVIEW-DELIVERY/v1/", "Git ignored .scratch/preview/ runtime configuration"]
artifacts: ["本目录截图、browser-checks.json、restart.json、build.log", "受限独立预览库和持久文件目录"]
checks: ["生产构建 PASS", "真实 UI 登录、题目保存与备课引用 PASS", "刷新与服务器重启恢复 PASS", "六模块入口 PASS", "根台账未修改"]
identity_mode: "real-auth; isolated seeded verification account; production SMTP configuration, no email sent"
open_items: ["Agent 固定候选合流", "Pandoc 输出修复", "F60 与完整备份恢复", "外部邮件及设备由用户验证", "R35 原有外部和历史观察"]
failure_owner: null
next_condition: "用户直接打开 HTTPS URL 注册使用；根保留持久目录并串行合入固定后续成果"
authorization_used: "本轮 PREVIEW-DELIVERY@1 attempt 1 用户任务包"
```
