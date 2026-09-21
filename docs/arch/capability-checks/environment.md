# C20/v1 环境与交付条件

## 本机实查

日期 2026-09-21；工作区 `/home/liam_t/项目/TeacherWorkspace-c20`，分支 `design/c20-capabilities`，启动 HEAD `b938f8af0b8152718f5063d4326d494bf8b5426c`，起始工作区干净。只读命令盘点，不代表能力实验通过；没有读取 `.env`、凭据、全局 auth/settings 或用户会话。

| 项目 | 实查结果与限制 |
| --- | --- |
| OS/运行时 | Linux x86_64，内核 7.2.4-3-cachyos；Node 22.23.2、npm 10.9.8、Python 3.14.7。Node/pi 在 `~/.local/share/pi-node/node-v22.23.2-linux-x64/bin/`。 |
| pi | 符号链接、公开 package.json 确认 `@earendil-works/pi-coding-agent` 0.85.1，MIT，Node >=22.19.0。SDK 接口核对见[来源](sources.md#本机版本和公开接口)，未运行模型或业务工具。 |
| PDF/图像 | PATH 有 `pdftotext/pdftoppm/pdfinfo`（Poppler 26.08.0）、ImageMagick 7.1.2-31；实际渲染 E 第8页成功。尚未验证自动拆题、DOCX 导出或转换品质。 |
| Office/OCR/数学 | PATH 未发现 `libreoffice/soffice/wps/wpp/et/pandoc/tesseract/inkscape`。根和 apps 的 package.json 未声明 MathJax、JSXGraph、docx.js；不据此断言全机不存在其他私人安装。实验所需组件按隔离目录准备，不改产品依赖。 |
| Python | 当前解释器未发现 PIL、PyMuPDF、pypdf、python-docx、python-pptx、reportlab、SymPy、NumPy、Matplotlib、PaddleOCR、torch、transformers。未全盘搜索其他虚拟环境。 |
| 浏览器/桌面 | `/opt/google/chrome/chrome` 存在；`chrome-devtools-axi` 只读 navigator 返回 Linux HeadlessChrome/152.0.0.0。Playwright 缓存有 chromium-1243；PATH 有 Firefox。DISPLAY/WAYLAND_DISPLAY 已设置，只证明变量存在，尚未验证 GUI Office 的可操作性。Windows、WPS、Edge 未接入本工作区。 |
| 字体 | `fc-list :lang=zh` 有 Noto Sans/Serif CJK SC 等；`fc-match 'Cambria Math'` 落到 DejaVu Math TeX Gyre，`fc-match 'SimSun'` 落到 Noto Serif。这是替换结果，不是原字体存在，也不保证数学符号和分页正确。 |
| 磁盘/SQLite | `df -h .` 当时 /home 可用约210 GiB；SQLite CLI 3.53.4。API 声明 better-sqlite3 `^11.8.1`，声明不证明 native binding 已安装/可运行。尚未做实验库重启或备份恢复。 |
| 工具/skills/样本 | 查当前 catalog 和 `.agents/skills`、`~/.agents/skills`、`~/.codex/skills` 中 SKILL.md 路径，未见专用 OCR、Office、数学制作 skill。现有通用流程可协助，不宣称有已验证制作能力。仓库（排除依赖）无 PDF/DOC/DOCX/PPT/PPTX 原件；已取得外部 E，固定索引见[samples](samples.md)。 |

复核可使用 `command -v <工具>`、`<工具> --version`、`readlink -f`、公开 package.json、`fc-list/fc-match`、`df -h .` 和只读浏览器 navigator。无需扫描密钥配置或完整进程环境。本次仅浏览公开来源和读取工具元数据，没有安装依赖或产品启动。

## 凭据、额度与目标设备

| 条件 | 当前依据 | 缺口和消费节点 |
| --- | --- | --- |
| 允许模型/凭据 | 用户本次已授权现有 GOAT 额度；[EMODEL](../evidence/EMODEL.md)证明同一 Provider 两个 ID 曾 HTTP 200。授权不是要求重新提供 key。 | C21/C23/C24 执行时通过既有服务端注入入口取用；若工作区拿不到该入口，外层补路径或受控注入。C20 不复制、不读取秘密。 |
| 实际计费 | 未打开账户控制台；正常输出、余额、自动充值/extra credits 与扣费仍未知。 | 记录可取得的非秘密 usage/账户事实，使用有界场景，不购买或修改计费。已出现额度/额外收费条件时停止该模型调用，交外层处理；未知项本身不阻塞免费本地实验。C25 消费必要设置边界。 |
| OCR | 没有已证实的单独 OCR 服务凭据；A 走待安装的本地组件，B 复用允许模型的视觉路径。 | 不索取或采购新 OCR 服务。安装/视觉失败按 C21 分别归因，不能虚构已有服务。 |
| Windows/WPS/课堂浏览器 | 用户目标已确定，但本机只有 Linux/Chrome 可核查。 | 外层在需要目标实机验证时落实设备访问及实际 WPS/Edge/Chrome 版本；C22/C23 先本机实验，R35/M44/D72 补目标环境。 |
| 大陆三端 | 电脑、平板、手机目标网络/设备未实测；浏览器模拟视口不是实机网络证据。 | D72/D75 走大陆实际 DNS/TLS、登录、上传下载、模型调用与课堂离线；PC 完整流程，Pad/手机按既定交互范围。当前不因缺正式 URL 停 C21-C23。 |
| 真业务 | B11/v1 设计已独立冻结，启动基线无 B16 成功运行回执。 | 仅 C24 真读写依赖 B16 固定版本、可信身份、页面和服务；预备探针现在可做。 |

## 单进程交付候选

首选沿用 B11 的一个 Node/Express 后端、SQLite 与持久目录，静态 Web 可同源提供；pi 在该后端内使用 SDK，Office 转换按需启动本机子进程。这是单一业务服务，不要求转换器绝不产生子进程。C20 不实现或部署。

| 路径 | 当前可验证内容 | 尚需条件 |
| --- | --- | --- |
| A 当前授权 Linux 主机 | 用隔离实验目录验证 Node/SQLite/文件、免费 Office 组件和 pi 的本机组合。正式交付若沿用，数据目录放发布目录外，重启后复用同一库及文件。 | 本机长期运行/外部访问权限未获证实，不能从工作区可写推定公网部署许可；最终入口、HTTPS、开机/联网和备份目标由 D70/D71 核实。 |
| B 用户已有 Windows 主机 | 保持同一 Node/SQLite/持久目录形状，采用该系统可运行的转换器；WPS 用于目标编辑验收，不假定有可供服务端自动化的 WPS API。 | 仅当 A 不适合最终托管时选 B；需设备访问、开机联网/权限以及 native binding/转换器实测，不要求先购买服务器。 |

D70 消费 C21-C24 的实际磁盘占用/耗时与依赖报告，固定所选路径。C22 要记录原件、页图、临时转换目录的空间需求和字体包；临时产物可清理，原件/失败输入保留供复核。不要用当前210 GiB空闲量推断未来容量，也不加无依据的并发或毫秒门槛。

重启不能清空数据库、原件、作品或 pi 会话。B12/B16 证明业务库持久化，实验各自证明自己的制品/会话重开；F62/D71 另验证 SQLite 与受管文件一并备份到明确目标并恢复。只复制运行中的一个 `.sqlite` 文件不足以代表完整恢复，采用组件支持的备份方式或停写后完整复制，具体步骤归执行者。

没有正式服务器只留下 D70/D71/D72 的交付条件，不是所有能力实验的 BLOCKED 理由。此包不选购服务、不建云控制面、不把 Workers/D1 重构为新的当前候选。
