# TeachBuddy 教师个人工作台

统一可体验产品运行在 `/home/liam_t/项目/TeacherWorkspace-preview` 的 `preview/usable-mvp` 分支，入口为 **https://localhost:50880**。当前手动业务产品组合固定于 `7aceca1f95bba95e7dccbae7cf144929b1fe90ad`；预览服务沿用原账户、数据库、文件和配置。首次使用时点击“创建账户”，由使用者在 UI 发送邮件验证码并注册；已有认证测试库的账户不会自动进入预览库。

当前预览已接入题库、资源、备课、数学、教学与数据管理的手动能力：录题与备课取题、讲义 DOCX/PDF 下载、资源上传预览与复用、数学作品制作与离线输出、班级教学记录、日程安排，以及个人资料导出、误删恢复和部署备份工具。既有预览证据见 [交付回执](docs/acceptance/evidence/PREVIEW-DELIVERY/v1/receipt.md) 和 [输出回执](docs/acceptance/evidence/PREVIEW-OFFICE/v1/receipt.md)；当前入口的部署检查见 [手动业务预览回执](docs/acceptance/evidence/MANUAL-INTEGRATION/v1/preview.md)。SUPPORT 偏好能力尚未接入，数据能力的最终组合独立验收仍待完成。

班级教学与日程的手动操作支持分班反馈、三类资料关联、连续日期拖选、多事项排序与优先级、未排期、周重复与单次调课、自选结束前后提醒，以及重进工作台后的补提醒定位。操作范围、保存恢复和已知限制见 [班级与日程回执](docs/acceptance/evidence/MANUAL-TEACHING/v1/receipt.md)。

预览保留已经接入的首页和共享 AI 右栏、真实 Cookie 认证及原有 13 个题库/备课工具。产品 Agent 后续开发已暂停，当前交付重点是补齐全部手动业务。现有 Agent 的接线与组合验证见 [集成回执](docs/acceptance/evidence/PREVIEW-AGENT-INTEGRATION/v1/receipt.md)；模型写入结果仍需在业务页面核对。

## 最短体验路径

1. 打开上述地址，注册并登录；需要刷新后恢复会话时勾选“记住我”。
2. 进入“题库”，点击“自建”，填写题目标题，通过“段落”或“公式”添加正文，点击“保存题目”。已有题目可直接编辑并再次保存。
3. 进入“备课”，点击“新建备课”，填写课题、添加环节，点击环节中的“从题库取题”，勾选题目并“采用所选”。点击“输出”，选择“导学案与讲义”和 DOCX 或 PDF，按需要勾选答案解析与教师注记，点击“保存并生成”，完成后下载。
4. 资源库上传 PPT/PPTX、DOC/DOCX、PDF、PNG/JPEG/WebP 后可查看真实页图、命名并保存，通过“文件夹与标签”整理，再在备课中复用。更新文件保留原条目与关联；转换失败后可重试。旧 DOC 仍提示对象丢失风险，可补充 PDF 核对。普通文件预览可用，MF-UI-01 对照预览裁切更新尚待接入。验证范围见 [资源手动能力回执](docs/acceptance/evidence/MANUAL-RESOURCES/v1/receipt.md)。
5. 数学工坊新建公式、平面图形、空间图形或演示，点击“作品与工具”调整内容并保存。公式和图形可下载 PNG/SVG，演示可下载 HTML 离线打开。从备课“制作数学作品”进入时，可将已保存作品带回原环节。
6. 班级教学中创建班级，写一句课后情况并保存，需要时补充关联资料。日程中拖出时间段，填写安排并保存；下次从网格点击该安排继续编辑。

备课列表及“我的备课”支持手动调整课题顺序，顺序保存在账户中；文稿内可调整环节及材料顺序。环节可直接选择已保存的数学作品，资源取材时可预览文件内容。备课页“教学反馈”按班级回看关联记录，打开记录后可返回备课现场。

数学演示从空白画布开始，可自行添加函数、点、图形、参数、拖动绑定和讲解步骤，也可选择“二次函数起点”。修改参数后点击“应用参数”，再保存作品；步骤说明随离线 HTML 一同保留。外部 HTML 可导入并通过“编辑源码”修改，执行仍遵循隔离和离线依赖边界。手动编辑、透明输出和备课往返的本机验证见 [MANUAL-MATH 回执](docs/acceptance/evidence/MANUAL-MATH/v1/receipt.md)。

数学手动范围的 MM-SPEC-01 已经独立定向复验通过，见 [独立修复证据](docs/acceptance/evidence/MANUAL-MATH/v1/independent-fix.md)。这不代替旧 DAG 或目标设备验收。新 F60 工具和 F61 全工具集尚未实现。在线采集、真实邮件投递和物理设备仍待验证。证书复用已有本机测试 TLS 文件，自动化忽略证书信任错误，不宣称所有设备都已信任。

## 题库与收录

题库支持文字、PDF、Word、图片收录，题面、公式、配图和答案编辑，自定义题型/标签、笔记与标记检索，复制改编对照、删除恢复，以及单题或多题加入备课和班级教学反馈。原稿下载保留文件名；题面透明 PNG 使用当前已保存内容生成。

文字与 DOCX 使用原生结构自动拆题；文字层 PDF 使用本机 Poppler 自动提取，并匹配明确的跨页答案和单栏配图。DOCX 没有分页预览时可按原文段落对照公式和配图，不替代 Word 的分页排版。旧版 DOC 配置 `MATERIALS_OFFICE_ROOT` 后可在本机转换、读取文字并校对保存；转换中的对象丢失风险、文字层缺失公式与按页草稿仍需人工核对，详见[接续验证](docs/acceptance/evidence/MANUAL-QUESTIONS/v1/continuation.md)。图片、扫描 PDF 的视觉识别尚未配置；原稿、裁图和人工校对可保存，但不计作自动识别完成。复杂数学排版、多栏与跨页续题仍需对照核查。本机验证和具体限制见 [题库交付回执](docs/acceptance/evidence/MANUAL-QUESTIONS/v1/receipt.md)。

## 个人资料与恢复

当前预览的设置页提供“导出个人资料”和“最近删除”。

- 个人 ZIP 包含当前账户的活动及已删除资料、原文件、数学历史源码、已保存对话和关联索引。解压后打开 `index.html` 阅读。认证凭据、内部 Agent 运行条目、密钥和本设备草稿不进入个人包。原文件可重新上传，正文和公式可复制；个人 ZIP 不覆盖账户，也不还原原 ID。
- 最近删除支持题目、备课、资源、数学作品、班级、教学记录、日程和收录资料。恢复沿用原 ID 与关联；班级和独立删除的记录分别恢复，没有永久删除或自动清理。
- 部署备份覆盖 SQLite 与全部登记文件，用于整体时间点恢复。命令需要维护者先停止 API、转换子进程和自动重启，保留原库、文件和配置。认证、邮件及 Provider 配置另行受控保管，备份命令不读取密钥。无 Git 元数据的发布目录须设置完整源码提交号 `PRODUCT_REVISION`。

以下路径均替换为本机实际绝对路径，备份和恢复目标必须尚不存在：

```bash
node apps/api/src/scripts/reliability.js backup --database /数据目录/workspace.sqlite --files /文件目录 --target /备份目录/本次备份 --stopped
node apps/api/src/scripts/reliability.js restore --source /备份目录/本次备份 --target /新恢复目录 --stopped
node apps/api/src/scripts/reliability.js activate --target /新恢复目录 --stopped
```

`restore` 成功只代表离线准备完成，准备副本保持禁止启动。核对备份时间后执行 `activate`，再把服务的 `SQLITE_PATH` 和 `WORKBENCH_FILES_DIR` 同时指向命令输出路径，沿用所需配置并正常启动。恢复会撤销全部旧登录状态，使用备份中的密码重新登录；备份后的密码修改和资料写入不会合并。普通重启保留新会话。

恢复失败的副本保持隔离，原目录可作为回退来源。启用后的新副本若已有新资料，应先导出保留再决定切回原目录。异常退出遗留锁时，确认所有写者及自动重启均已停止后，使用 `unlock --database /数据目录/workspace.sqlite --files /文件目录 --stopped`；仍存活的锁拥有者会被拒绝。

恢复点改变时，本设备旧草稿、未确认请求与待上传文件原样隔离，可从设置页查看和下载，需对照当前资料后重新操作。历史对话原始存储保持；恢复前未确认的 Agent 操作拒绝重新执行，专用 Agent 核实与放弃流程仍属暂停线路。个人包缓存不进入部署备份，恢复后需重新导出。

已支持当前预览的迁移集合，包括备课排序迁移 `lessons_0003_order`，以及固定起点缺少可靠性模块的基线升级。未知迁移、内容格式、缺文件、摘要不符及未完成认证清理都会停止恢复。集成其他模块新增迁移时，须同步接入备份支持集合再验证。自验范围与证据见 [MANUAL-DATA 回执](docs/acceptance/evidence/MANUAL-DATA/v1/receipt.md)。

## 设置与工作现场

设置可保存账户阅读字号与减少动效偏好，重新登录或在另一设备打开后生效。帮助按六模块真实操作流程组织；版本记录从构建时的 Git 提交生成，没有发布标记时明确显示为未正式发布的构建，不改写 `CHANGELOG.md`。

本设备输入与现场按账户和编辑分支保存，两个标签页可分别继续自己的草稿。切换模块可回到上次打开的内容。设置可下载本设备 JSON 草稿并清理本机现场，保留待确认请求、相关模块输入及不可自动读取的原文；服务器资料不受清理影响。JSON 草稿用于留存和手工取回内容，不是整体备份或批量导入。

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

这是 transient unit，停止服务后 unit 也可能消失。若 `start` 提示 unit 不存在，运行：

```bash
systemd-run --user --unit=teacherworkspace-preview \
  --property=Restart=on-failure --property=UMask=0077 \
  /home/liam_t/项目/TeacherWorkspace-preview/.scratch/preview/start.sh
```

专用数据位于预览工作树的 `.scratch/preview/`，已被 Git 忽略且限制访问：

- `data/workspace.sqlite` 及 WAL：账户和业务数据。
- `files/`：持久原文件和制品。
- `runtime.env`、`start.sh`：受限运行配置及直接服务器启动入口。
- `.env`：工作树根目录的受限 Provider 凭据和两种模型配置，仅服务端读取，Git 忽略。
- `logs/`、`tmp/`：构建记录、业务日志和转换临时目录。

服务器只读加载 `~/.config/teacherworkspace-acceptance/qq-mail.env`，复用其 `runtime/server.pem`、`runtime/server-key.pem`。现有认证测试库未读写。Office 二进制复用已有 C22 目录。后续固定成果继续在隔离集成树验证，再串行接入预览并保留 `.scratch/preview/`。

## 开发与范围入口

使用 Node.js 22.23.2，依赖安装 `npm ci`。预览工作树构建时显式加载其运行配置，保留原数据路径：

```bash
cd /home/liam_t/项目/TeacherWorkspace-preview
set -a
source .scratch/preview/runtime.env
set +a
npm run build
systemctl --user restart teacherworkspace-preview
```

集成工作树自检使用独立临时目录和测试端口，不加载预览的 `runtime.env` 或 `.env`：

```bash
cd /home/liam_t/项目/TeacherWorkspace-manual-integration
mkdir -p .scratch/manual-integration/tmp
npm ci --no-audit --no-fund
TMPDIR="$PWD/.scratch/manual-integration/tmp" npm run build
```

`apps/` 是真实实现，`prototype/` 是交互参考。范围见 [PRODUCT_SCOPE](docs/PRODUCT_SCOPE.md)，页面共识见 [WORKBENCH_DESIGN](docs/WORKBENCH_DESIGN.md)，契约见 [workbench](docs/contracts/workbench.md) 和 [auth](docs/contracts/auth.md)。完整 DAG 与编排状态由 [mvp-dag](docs/plans/mvp-dag.md) 和 [run-state](docs/plans/run-state.md) 维护，本任务不改写这两份台账。

业务回归使用 `apps/web/e2e/business-mvp.config.mjs` 和现有材料、数学集成配置。运行时把 `TMPDIR` 设为本树专用短目录（例如 `.tmp-bm`），避免 Chrome 的 Unix socket 路径长度限制。历史保库测试只有显式设置 `M43_P_LIBRARY` / `M43_M_LIBRARY` 才运行；未提供时标记跳过，提供无效目录则失败，不将缺少历史样本算作通过。
