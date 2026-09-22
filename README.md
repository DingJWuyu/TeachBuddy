# TeachBuddy 教师个人工作台

本分支 `preview/usable-mvp` 提供真实六模块本机预览，入口为 **https://localhost:50880**。首次点击“创建账户”，由使用者在 UI 发送邮件验证码并注册。此预览使用独立新库，已有认证测试库的账户不会自动进入新库。

题库自建、编辑保存、备课引用以及刷新和服务重启恢复已通过真实浏览器自验。资源库、数学工坊、班级教学和日程可以进入。固定候选、证据和限制见 [预览交付回执](docs/acceptance/evidence/PREVIEW-DELIVERY/v1/receipt.md)。这不是完整 MVP 验收通过声明，也不改变 main 的交付状态。

## 最短体验路径

1. 打开上述地址，注册并登录；需要刷新后恢复会话时勾选“记住我”。
2. 进入“题库”，点击“自建”，填写题目标题，通过“段落”或“公式”添加正文，点击“保存题目”。已有题目可直接编辑并再次保存。
3. 进入“备课”，点击“新建备课”，填写课题、添加环节，点击环节中的“从题库取题”，勾选题目并“采用所选”，最后保存。
4. 从侧栏进入资源库、数学工坊或班级教学；顶栏“日程”进入时间安排。

此候选的 AI 发送按钮尚不可用，Agent 由后续固定候选合流。新 F60 工具和完整备份/恢复尚未实现。在线采集、真实邮件投递和物理设备仍待验证。证书复用已有本机测试 TLS 文件，自动化忽略证书信任错误，不宣称所有设备都已信任。

## DOCX 输出

本分支已集成 R34 Pandoc 输出修复。Pandoc 3.11 生成可编辑公式 DOCX，再沿既有 LibreOffice 链校验和转换 PDF。服务使用 `MATERIALS_PANDOC_PATH` 指向 Pandoc 可执行文件，并沿用 `MATERIALS_OFFICE_ROOT`；工具二进制不进入仓库。固定候选的验证及 Word/WPS 真人待验条件见 [Pandoc 报告](docs/acceptance/evidence/R34/v1/pandoc.md)。本分支集成自验见 [PREVIEW-OFFICE 回执](docs/acceptance/evidence/PREVIEW-OFFICE/v1/receipt.md)。

## 本机服务与数据

工作目录：`/home/liam_t/项目/TeacherWorkspace-preview`。当前 Linux 用户 `liam_t` 的 `teacherworkspace-preview.service` 托管服务，端口 `50880`，前端生产构建和 API 同源 HTTPS。

```bash
systemctl --user stop teacherworkspace-preview
systemctl --user start teacherworkspace-preview
systemctl --user restart teacherworkspace-preview
systemctl --user status teacherworkspace-preview
journalctl --user -u teacherworkspace-preview
```

这是 transient unit，机器重启后若 unit 不存在，运行：

```bash
systemd-run --user --unit=teacherworkspace-preview \
  --property=Restart=on-failure --property=UMask=0077 \
  /home/liam_t/项目/TeacherWorkspace-preview/.scratch/preview/start.sh
```

专用数据位于本 worktree 的 `.scratch/preview/`，已被 Git 忽略且限制访问：

- `data/workspace.sqlite` 及 WAL：账户和业务数据。
- `files/`：持久原文件和制品。
- `runtime.env`、`start.sh`：受限运行配置及直接服务器启动入口。
- `logs/`、`tmp/`：构建记录、业务日志和转换临时目录。

服务器只读加载 `~/.config/teacherworkspace-acceptance/qq-mail.env`，复用其 `runtime/server.pem`、`runtime/server-key.pem`。现有认证测试库未读写。Office 二进制复用已有 C22 目录。接手时保留这些路径，在本分支串行合入固定候选、构建后重启同一服务；保留持久目录，避免另起占用同端口的进程。

## 开发与范围入口

使用 Node.js 22.23.2，依赖安装 `npm ci`。构建时显式使用预览配置，避免默认 SQLite 路径：

```bash
cd /home/liam_t/项目/TeacherWorkspace-preview
set -a
source .scratch/preview/runtime.env
set +a
npm run build
systemctl --user restart teacherworkspace-preview
```

`apps/` 是真实实现，`prototype/` 是交互参考。范围见 [PRODUCT_SCOPE](docs/PRODUCT_SCOPE.md)，页面共识见 [WORKBENCH_DESIGN](docs/WORKBENCH_DESIGN.md)，契约见 [workbench](docs/contracts/workbench.md) 和 [auth](docs/contracts/auth.md)。完整 DAG 与编排状态由 [mvp-dag](docs/plans/mvp-dag.md) 和 [run-state](docs/plans/run-state.md) 维护，本任务不改写这两份台账。
