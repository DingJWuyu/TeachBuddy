# 作者 C：材料与数学成果

## 现场与状态

- 作者：`/root/author_c_outputs`，gpt-6.1-sol / high。
- 输入：空测试基线 `992172141f6664d4d851154cc533428414051c42`；工作树 `/home/liam_t/项目/TeachBuddy-test-outputs`，分支 `test/rebuild-outputs`。
- 当前阶段：总控确认的 C1-C5 已实施；16 项作者定点验证通过，无跳过，五组代表性业务破坏均产生具名断言失败。待总控独立消融与双轴审查、CI、集成与最终清理。
- 写入仅限本线获准目录；根配置、共享准备、CI 与权威验证文档由总控维护。证据归 `test-results/test-suite-rebuild/`。
- 已按现行规格、材料/识别/数学契约与样本定义设计。误读的 `materials-http-fixture.js` 混入旧断言，已停止使用，不复制其中业务准备及断言。

## 保护清单

| 候选组 | 需求出处 | 实际用户故障及独有断言 | 测试层 | 依赖与替身 |
| --- | --- | --- | --- | --- |
| C1 原生材料与真实文件 | materials 的文件/定位/自动收题；samples W/P/Office；resources 文件历史 | DOCX/PDF 被当成空白或失去公式、配图、原有答案；原稿预览或下载字节损坏。真实上传、原生提取、校对入库，核对题干/答案角色、原稿定位与图像关联；实际原件与预览可读。文件历史关系归 A | 真实 HTTP/SQLite 与实际 Office/Poppler 转换；不重复 A 的一般版本/幂等表 | 固定仓库原稿；真实本地转换器；真实认证、测试邮件 |
| C2 OCR 实际消费 | recognition 机器结果/模块接缝；materials 自动收题；samples 固定回放 | 机器表格/公式/配图漏掉、疑点丢失、人工采用覆盖原始结果。固定 OCR 经公共识别与两个消费者，题库校对保存/入库后读回数学、图与疑点处置；资源正文检索能命中已识别内容 | 真实 HTTP/SQLite；必要的成果专用浏览器断言在 rebuilt-outputs | 仓库录制机器结果回放，不启动 GPU；保留 raw、固定来源与图片 |
| C3 可编辑文稿输出 | materials 内容/输出；samples Office 成果 | Word 只有截图、公式条件错位、配图关系断裂，学生稿泄露答案/注记。公共 generateDocx 实际生成并经受管文件授权下载 DOCX/PDF，另走题库真实 PNG 资产接口，解包核对一般 LaTeX 的真实 OMML、文稿文字/图片关系；PDF 实际提取文字与页图，PNG 实际解码 | 真实输出回归 | Pandoc、LibreOffice、Poppler、Sharp；自编含分式/根式/cases/配图的内容，不以文件存在判成功 |
| C4 数学作品与离线成果 | math 作品/结构源/导出隔离；features/math；samples M-F/M-D/M-X | 保存作品与下载内容不一致、旧源不可读、静态数学错误、离线依赖制作服务或参数/步骤失效、外部 HTML 读到父身份。HTTP 建立统一作品及代表旧源，检查可编辑源/实际 SVG/PNG；下载固定 revision 后停服务，禁网新 Chromium file:// 操作参数/步骤/重置，并检查外部 HTML 隔离 | 真实 HTTP 与离线 Chromium；统一编辑器 UI 接线归 B | 真实本地 MathJax/GeoGebra；同候选只读 Web/运行资源；固定 HTML 资产，禁外网 |
| C5 网页扩展连接与更新 | features/math 网页 AI；extension README 页面协议 | 更新后旧页面无法连接、在途请求被自动重发、迟到回复污染新请求、回复乘号被 DOM 文本吞掉。实际加载 MV3 扩展，以受控 DeepSeek DOM 两轮发送/取消与更新，核对精确 JSON 代码、唯一专用 tab、连接重探测和旧请求失效 | 独立 Chromium 扩展端到端 | 入库网页夹具、旧 0.1 兼容快照；真实扩展脚本；无账号/真实模型 |

## 暂不自动化与边界

- GPU/MinerU 原始识别质量、真实 DeepSeek 网页登录与模型兼容、商店签名安装/自动更新、Word/WPS 两轮人工编辑打印、Windows/目标触屏属于另行专项。回放、开发扩展重载和 Chromium 成果检查分别记录，不冒充这些专项。
- 外部 E 完整 PDF 不在仓库，固定 E 页回放可消费；没有明确需要不下载或调用模型，完整原稿专项保留未验。
- 不穷举全部几何公式和 Office 排版，选择能独立暴露保真损坏的代表源；不为每种纯 schema 错误建设平行单测。
- A 拥有通用身份、账户隔离、保存/恢复和持久化边界；B 拥有页面入口、编辑与保存状态接线。C 只对真实材料内容、数学语义、真实字节和离线/扩展执行负责。

## 候选与作者验证

新增 7 个文件，仅本线测试与作者记录，产品实现、冻结输入、兼容快照和生成资产无改动。API 测试复用总控公共 `apps/api/test/support/application.js` 与无损 bytes client；共同准备提交为 `8be6e3a779b17c5d1ea6a84bb33ff6fc7506e103`、`e27a49ca584b311c7d55c323cb0958e939bab740`，作者分支已 cherry-pick。

| 组 | 候选文件 | 最后有效证据 | 结果 |
| --- | --- | --- | --- |
| C1 | `apps/api/test/rebuilt-outputs/native-materials.test.js` | `c1-final.log` | 3/3，通过原生 W/P 六题与原件、真实 PPT/PPTX/DOC 预览页及 PDF 正文 |
| C2 | `apps/api/test/rebuilt-outputs/recognition-consumers.test.js` | `c-api-final.log` 中 C2 两项；`c2-recognition.log` 保留早期判据修正 | 2/2，I-1 校对采用/证据分离/资源复用，I-2 分段式与 PS-4 答案按题号匹配 |
| C3 | `apps/api/test/rebuilt-outputs/document-outputs.test.js` | `c-api-final.log` 中 C3 两项 | 2/2，一般 LaTeX→真实 OMML、两行条件/图表/PDF，透明 PNG 分片及笔记不进入公开成果 |
| C4 | `apps/api/test/rebuilt-outputs/math-artifacts.test.js` | `c4-final.log` | 6/6，旧源与真实矢量几何、统一课堂 ZIP/旧动态停服禁网、HTML 隔离、无定义原源修正与历史、纯公式统一作品 |
| C5 | `extensions/math-web-ai/test/rebuilt/bridge.test.mjs` | `c5-final.log` | 3/3，真实 MV3 两轮/取消、管理页重载与原页面接续、固定 0.1 升级 |
| 静态 | 上述本线源码 | `c-lint.log` 与 `git diff --check` | Oxlint exit 0，空产品 diff |

证据均位于本工作树 `test-results/test-suite-rebuild/`。`c-api-final.log` 的早期整批结果为 11 通过、统一包的嵌套 SVG 数量断言失败；该项及所有 C4 用例已在 `c4-final.log` 对最后候选完整复验通过，不能把早期失败日志称为整批通过。

本机运行使用 SETUP 所述外部工具，通过 `MATERIALS_PANDOC_PATH`、`MATERIALS_OFFICE_ROOT`、`QUESTIONS_XPDF_PDFTOHTML` 传入，不写入个人绝对路径。统一作品只读使用总控从本候选冷构建的 Web/GGB：`WORKBENCH_WEB_DIST=/home/liam_t/项目/TeachBuddy-test-rebuild/apps/web/dist`；该地址仅本次证据现场，不是入库测试的默认依赖。

CI 归属建议：全部 API 用例进入具备 Pandoc、LibreOffice（含 Impress）、Poppler、Xpdf 与 Chromium、已构建 GGB 的输出任务；扩展脚本使用完整 Chromium 的真实 MV3 和管理页，独立命令 `node --test --test-concurrency=1 extensions/math-web-ai/test/rebuilt/bridge.test.mjs`。根 scripts/config/CI 由总控写入。

## 业务故障检出

上述有效注入在本线独占树串行执行，测试完成后 `finally` 恢复原字节，不与同树其他测试并跑。最初未触发的 rad 注入与当时的扩展建场运行时间重叠，之后有效注入已按总控要求串行。以下均为运行到业务断言的失败，既非编译失败，也非建场失败。

| 组 | 实际故障 | 具名失败 | 证据 |
| --- | --- | --- | --- |
| C1 | 原生 Word 分式转成丢失标记 | 原生数学内容必须保留根式 | `c1-mutation-fraction.log` |
| C2 | OCR 采用文稿移除图片块 | 函数题必须关联本页实际配图 | `c2-mutation-figure.log` |
| C3 | Pandoc 将 Math 转成普通文本 | 分式必须具有可编辑的分子分母结构 | `c3-mutation-editable.log` |
| C4 | 数学曲线统一求值为 0 | 实际 SVG 曲线应满足 y=x²-2x-3 | `c4-mutation-curve.log` |
| C5 | 网页代码块读取消去乘号 | 代码块须精确保留乘号，排除语言标题 | `c5-mutation-multiply.log` |

C1 首个根式对象注入存活，因为固定 W 的根号以数学文本表示，没有 rad 对象；已记录为未触发并改成损坏真实分式。未拿该存活注入冒充红灯；后续补强 Q1 本地根式和分母断言。

## 环境与测试修正

- C5 最初新 tab 首导航早于 Playwright 路由，继承的网络代理绕过 DNS 规则后返回未登录 403。没有登录或发送模型消息；这轮是隔离建场失败，不计业务红灯。最后候选在创建任何模型 tab 前，先设置不可达本机代理 `127.0.0.1:9` 和 DNS 拒绝；首导航可失败，随后显式导航该 tab，由本地路由返回固定 HTML。所有模型回复来自仓库夹具。
- 0.1 更新后可能先收到旧匿名脚本无版本的断连错误；用例等待当前版本 AVAILABILITY，再按 `extensionVersion` 读取当前桥回复，符合现行页面协议。真实主应用的旧回复过滤接线归 B。
- 旧 DOC 预览本应 partial/limited，透明黑字 PNG 的 RGB 方差可为零，旧动态内容在隔离 iframe，公式输出可能嵌套多个 SVG；这些初次失败均已按契约修正判据，保留实际内容断言。未改产品实现。
- 早期缺 GGB 的 503 记环境未就绪；最终统一作品已下载 ZIP、停服务、全新禁网 Chromium `file://` 打开，实际操作键盘参数、教学步骤和重置，完整源与矢量公式均核对。

## 剩余与接续

作者自验已完成，尚未集成。总控接收固定提交后安排独立消融、旧套件价值挑战及 Standards/Spec 审查；返工仍回本线。真实 GPU OCR、线上 DeepSeek/目标桌面浏览器与商店升级、Word/WPS 两轮编辑打印、外部 E 原件专项仍未验，回放及 Chromium 不代签。

当前没有用户输入阻塞。全目标尚待独立验收、CI 与集成，按照任务要求保留失败现场与证据；成功的单项测试自动清理自身临时目录。总控确认完整任务完成后再清理本线 worktree、分支及本次保留的临时现场。
