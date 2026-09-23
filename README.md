# TeachBuddy 教师个人工作台

本分支 `preview/usable-mvp` 提供真实六模块本机预览，入口为 **https://localhost:50880**。首次点击“创建账户”，由使用者在 UI 发送邮件验证码并注册。此预览使用独立新库，已有认证测试库的账户不会自动进入新库。

六模块的手动基本业务已通过真实认证浏览器自验：录题与备课取题、讲义 DOCX/PDF 下载、资源上传预览与复用、数学作品制作与离线输出、班级教学记录、日程拖选与保存。保存内容经过刷新或保库重启检查。实际场景、候选和限制见 [基本业务回执](docs/acceptance/evidence/BUSINESS-MVP/v1/receipt.md)。这不是包含自动提取、Agent 全工具与备份恢复的完整 MVP 验收声明。

本分支已在六模块与真实 Cookie 认证上接入首页和共享 AI 右栏。登录后可使用持久对话、草稿、引用和原有 13 个题库/备课工具；服务端仅开放 `deepseek/deepseek-v4.1-flash` 与 `z-ai/glm-5.3-flash`。工具连接当前题目 v2、备课 v3 的业务端口，未知文档版本保持只读保护。模型回复及写入结果仍需在业务页面核对。接线来源和已有模型自验见 [PREVIEW-AGENT 回执](docs/acceptance/evidence/PREVIEW-AGENT/v1/receipt.md)，本预览的组合验证见 [集成回执](docs/acceptance/evidence/PREVIEW-AGENT-INTEGRATION/v1/receipt.md)。

## 最短体验路径

1. 打开上述地址，注册并登录；需要刷新后恢复会话时勾选“记住我”。
2. 进入“题库”，点击“自建”，填写题目标题，通过“段落”或“公式”添加正文，点击“保存题目”。已有题目可直接编辑并再次保存。
3. 进入“备课”，点击“新建备课”，填写课题、添加环节，点击环节中的“从题库取题”，勾选题目并“采用所选”。点击“输出”，选择“导学案与讲义”和 DOCX 或 PDF，按需要勾选答案解析与教师注记，点击“保存并生成”，完成后下载。
4. 资源库上传文件后可预览、命名并保存；在备课环节“从资源库取材”复用。更新文件保留原条目与关联。
5. 数学工坊新建公式、平面图形、空间图形或演示，点击“作品与工具”调整内容并保存。公式和图形可下载 PNG/SVG，演示可下载 HTML 离线打开。从备课“制作数学作品”进入时，可将已保存作品带回原环节。
6. 班级教学中创建班级，写一句课后情况并保存，需要时补充关联资料。日程中拖出时间段，填写安排并保存；下次从网格点击该安排继续编辑。

登录后可在首页或六模块右栏打开 AI 对话，选择模型、输入需求并发送。新 F60 工具、F61 全工具集和完整备份/恢复尚未实现。在线采集、真实邮件投递和物理设备仍待验证。证书复用已有本机测试 TLS 文件，自动化忽略证书信任错误，不宣称所有设备都已信任。

## DOCX 输出

本分支已集成 R34 Pandoc 输出修复。Pandoc 3.11 生成可编辑公式 DOCX，再沿既有 LibreOffice 链校验和转换 PDF。服务使用 `MATERIALS_PANDOC_PATH` 指向 Pandoc 可执行文件，并沿用 `MATERIALS_OFFICE_ROOT`；工具二进制不进入仓库。固定候选的验证及 Word/WPS 真人待验条件见 [Pandoc 报告](docs/acceptance/evidence/R34/v1/pandoc.md)。本分支集成自验见 [PREVIEW-OFFICE 回执](docs/acceptance/evidence/PREVIEW-OFFICE/v1/receipt.md)。

已保存备课的输出面板会等待文稿加载后恢复选项、任务和下载。刷新、离开重回及失败恢复的定向自验与已知限制见 [输出恢复回执](docs/acceptance/evidence/PREVIEW-EXPORT-RECOVERY/v1/receipt.md)。

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
- `.env`：工作树根目录的受限 Provider 凭据和两种模型配置，仅服务端读取，Git 忽略。
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

业务回归使用 `apps/web/e2e/business-mvp.config.mjs` 和现有材料、数学集成配置。运行时把 `TMPDIR` 设为本树专用短目录（例如 `.tmp-bm`），避免 Chrome 的 Unix socket 路径长度限制。历史保库测试只有显式设置 `M43_P_LIBRARY` / `M43_M_LIBRARY` 才运行；未提供时标记跳过，提供无效目录则失败，不将缺少历史样本算作通过。
