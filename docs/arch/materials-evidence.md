# R30 材料实验消费裁决

本页是 R30 作者对固定实验原件的复核，不是 C21/C22 作者 self 的转抄，也不是 R30 独立冻结。R30 未新调模型、未读取密钥、未改实验文件。查看已有原始响应的 content/finish_reason，读取 XML、PDF、脚本及 GUI 日志；原件生成的页面与模型内容逐项对照。没有重跑已经证明的付费请求或 Office 编辑动作。

## 当前消费状态

原独立审查 `0467f468c3e923a83548d447c3a760a47b2f88bd:docs/acceptance/evidence/R30/v1/review.md` 提出的两项实验消费阻断已有各自的固定独立关闭证据：

| 审查项 | 固定候选与独立结论 | 当前裁决 |
| --- | --- | --- |
| R30-REV-001 | 候选 `c7022e03be1af4d6b2ca5ca1b5a12441bc8835f8`；独立 `d990f43baa98d9b125a6606b1fab56e9b5c77e98:docs/acceptance/evidence/R30-C21-CONTINUATION/v1/review-location.md` | CLOSED。EX-02 的剩余定位、校对保存与重启回读通过；未变的 EX-01/03/04 沿该报告固定引用。不等于新在线提取成功。 |
| R30-REV-002 | 候选 `7f965c6408a73d30524ff8e11c40484a352232c1`，作者回执 `a34798de7070d837019a02ab9d0f9c34b226a277`；前轮独立 `c03df4ad6d0290f9172a15e3f23dc1e6875efe0a:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-control-review.md`；补充独立 `f877b6395cbfbde4b2d8aa7e8d3f64496aea22cc:docs/acceptance/evidence/R30-MATERIALS-NEXT/v1/c22-gui-review.md` | CLOSED，限本机 LibreOffice。前轮已通过来源、完整公式结构、角色隔离与 8 份 PDF 全部 19 页；补充证据关闭两轮 GUI 编辑持久化和学生练习 DOCX 第 3 页完整实际打印预览。Windows Word/WPS 仍未验。 |

两项 CLOSED 只移除“实验缺口直接交下游补验”的错误前提，不声明产品已实现，也不是 R30 整体 independent PASS。外层应以 [freeze-prep](../acceptance/evidence/R30/v1/freeze-prep.md) 的固定输入做最终限定冻结。

## 固定证据与裁决

- C21：`6850864dcebaf3617bd465a50361c688ba1887dd` 的 `experiments/C21/`；完整 response 与外部 E 原件另在 `/home/liam_t/项目/TeacherWorkspace-c21/experiments/C21/`，只读保留。
- C22 制品：`443688d31b2d39959142b93f4d2925fb8a20346e`；回执：`1b682471cd30a020a9b47969675e465dcf6ac2bf`。隔离工具/GUI 日志在 `/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/`，只读保留。
- R30 固定工作基线包含上述输入，后续无需用活动实验分支找“最新”。实验 README/回执只作索引，消费结论以下表为准。

| 切片 | 独立观察 | 消费裁决 |
| --- | --- | --- |
| C21 A 文本模型 | DeepSeek T 与 GLM T 的完整响应都是 finish_reason=length，正文 0 字；HTTP 200 不改变这个事实。 | 完整自动整理路线 FAIL，不采用 A 的文本模型成功假设。原生读取仍可用。 |
| C21 T/W 原生 | T 的代码按固定页标记切段；W 保留 XML/OMML/图片关系及显式分页符。评分用固定 Q1-Q6 正则和节点计数。 | 证明原稿/结构保存，不能证明通用四入口自动收题完成。R33 需补通用题边界、公式规范化、真实配图和保存。 |
| C21 B P/I/PS | 三份完整响应合法 JSON，Q1-Q6 顺序与题面/答案匹配，Q6 absent。图为 image_page、labels 等描述，formula_source 多为 image/说明；I 的 Q2/Q6 同时在 stem 与 subquestions 里重复小问。 | B 可作为视觉识别 Adapter；不接受“6/6 directly_usable”作为端到端可编辑题目分数。需去重、规范数学源、实际裁图、精确定位与校对入库。 |
| C21 E | 原件 SHA/大小/13 页核对；R30 从原 PDF 重渲染第7-8页查看。第一响应把页面称 1/2 且截断；layout 响应仍非法 JSON，但完整 groups 数组可解出例6、练习、思考，小问为4/3/3，与原件一致，思考图归属成立。 | 接受三组待核对候选，整批为 partial，不接受教学点评/教师活动已完整整理。页映射使用7/8，未分配尾部保留原页补验。 |
| C21 F | 截断 PDF 的 pdfinfo/pdftotext 失败；原件与成功页/OCR 片段仍在，遮挡数字未被补造；视觉完整响应正文0字、length。 | 失败继续路径可消费，不能称 F 视觉识别成功。R33 实现保存原件、局部重试及补充新照片。 |
| C22 A/B | A 第2页分段式只剩 f(x)= 与括号；B PDF 有两行分支。B DOCX 的 OMML 数为 W 7、教案2/2、讲义4/4、练习6/7。 | 选 B docx.js + LibreOffice 为现代 DOCX/PDF 路线。一般 LaTeX 到 OMML 仍须 R34 证明。 |
| C22 编辑保存 | GUI/UNO 日志显示中文、分式2x-1→2x+1、二次式常数-3→-2 后保存关闭重开；R30 解包修改后 DOCX，读取公式及实际重导出页图核对。 | 接受 Linux Writer 可编辑对象与往返保存切片。不是手动鼠标编辑测试，也不是 Windows/WPS 结论。 |
| C22 旧 DOC | 真 OLE DOC，4页可转换，但第1页 Q1 分式内容、Q2 公式为空，仅剩公式横线/空位。 | OF-01 旧 DOC 保真 FAIL，必须显示受限预览和提供绑定版本的补充 PDF 对照；“先转 PDF”本身不能修好公式。 |
| C22 学生材料 | 学生版 DOCX 确实没有两个标记串；但 R30 从 practice-student.pdf 重渲染，Q2 正文明示“解析保留配方”与解法公式。lesson-student.pdf 也显示配方。 | 不接受 OF-03 学生无答案泄漏整体 PASS。R34 必须从结构角色过滤并检查正文、OOXML 与 PDF，不只查标记串。 |
| C22 打印 | print-preview.json 只记录 practice-teacher 一份的 UNO dispatch/关闭；各 PDF 已存在，页数核对一致。 | 接受一次本机打印预览动作，不扩大为三类成果都完成实际打印预览。R34/R35 补三类打印动作。 |
| C22 PPT/PPTX | 真实现代/旧格式原件，各自 PDF 三页，已有逐页截图可核对中文/函数图/几何图。 | 静态预览路线可消费；未证明动画/宏，任务也不承诺这些。 |

C21 自编 Q2 原图的曲线与红点位置不完全相交，源图本身已有问题；提取要保留原稿，不能因已知数学式自动重画伪装成忠实提取。老师可另行修图/改编。C22 的 Q6 教师答案由 C22 生成源明确写入，不能把它作为 C21 原稿已有答案。两个实验的物化样本不等同于逐字相同原稿。

## 原响应核对值

下列相对路径均在 C21 只读外部工作区的 experiments/C21/results 下。所有已提交 content 与原 message.content 相同；model-E 仅尾部空白差异，不是补写结果。未将 reasoning 或外部全文复制入本包。

| 原响应 | SHA-256 | finish / 正文字符 / JSON |
| --- | --- | --- |
| A/model/T.response.json | `e97a7ffa05a343030be15cc75203a7681f73c7e546d4f674a7da2bd2abacb927` | length / 0 / empty |
| A/model/T-glm.response.json | `503198049a8a8f0915d92dd3b14746450cbbecd9a3c6dd9be728925714a4dfac` | length / 0 / empty |
| B/model-P-compact.response.json | `0397ed219b2b2907c0c7aa89533a39b56cc6bd33782cca4f8f1a0b4e4c4787d6` | stop / 2667 / valid |
| B/model-I.response.json | `11dfb132d9034a31f2a8f55553684acef74c3ef7d7a543c59092c1d8d9b5f89f` | stop / 2351 / valid |
| B/model-PS.response.json | `109a0d24f0449429905be2586e638849fd77ebd6a38a2deb9fa73102b19f6cb2` | stop / 3452 / valid |
| B/model-E.response.json | `8e39020d79851e7659b355944467b3fbf157ff3c520c7f660486a487eaad5309` | length / 2330 / invalid |
| B/model-E-layout.response.json | `3e583b7cb6ec9cb18dc6a1c3475e737ed91367273ecb53231fd79812192eb62f` | length / 2360 / invalid，groups 可独立解码 |
| B/model-F.response.json | `67b3f0e869ff80ffd61f91bff7a3b32a2738a924e331dd188c422167f6c54286` | length / 0 / empty |

E 原件 `data/external/E.pdf`：1,115,735 bytes，SHA-256 `b8d34a6aa76a59adfee125c8efb0a12620dffbb797666cbcc6c41b07390d082a`。C22 的输入原件与该值一致。W 原生公式证据在 C21 `results/A/raw/W-document.xml`；C22 的 B 生成器是 `scripts/generate-candidate-b.js`，分段式由固定 OMML 字符串构造，这也是本次不宣称通用转换已证实的直接依据。

C22 原 GUI 日志与基线提交字节一致：`gui-edit.json` SHA `3bda162ea86ef8b13b45e21634f539ca9422a4f73fd22a06512f1d5ef3bf92d4`；`gui-reopen-verification.json` SHA `855e7a054e9dcc3f61f7d62d09db59e062024b21411760aa34bc38affda912eb`；`print-preview.json` SHA `ec46f6bc66d943c08f510e51125701e8d133585cf5f7bffc3ca638fb65ee21ef`。前一日志的两个字符串断言为 false，是重开后公式格式重排导致，后一日志按重排结果核验为 true；修改后 DOCX 和页面也支持修改实际存在。

实际 `outputs-b/edited/handout-student-edited.docx` SHA 为 `c25261dec4f20b4cee641d975a2ed5c2a6bc9b33dac5f8fc43547000c94f59c3`，C22 说明页末尾写为 `...59a6` 的值不匹配，以原件为准；PDF SHA `03c83e8e78d406a2df959fb17b4e9d38a756006790e2580d18c01350d8b58448` 匹配。原实验说明不在本次写入范围，保持只读。

## 六种格式样本与用途

每行是 C22 制品提交中的实际文件，不是本批产品实现。新接口六种请求/受理响应由 OpenAPI 的 `Export_*`/`ExportAccepted_*` 样本唯一拥有。R34 用同一内容结构重新生成并验证，不能直接复制这些成品当完成证据。

| 成果 | 可编辑格式原件 | 打印格式原件 | 可消费的观察 |
| --- | --- | --- | --- |
| 教案/提纲 | `443688d31b2d39959142b93f4d2925fb8a20346e:experiments/C22/outputs-b/docx/lesson-student.docx` | `443688d31b2d39959142b93f4d2925fb8a20346e:experiments/C22/outputs-b/pdf/lesson-student.pdf` | 2页、中文/表格/图/2公式；含配方，不能当严格学生答案隔离样本。 |
| 导学案/讲义 | `443688d31b2d39959142b93f4d2925fb8a20346e:experiments/C22/outputs-b/docx/handout-student.docx` | `443688d31b2d39959142b93f4d2925fb8a20346e:experiments/C22/outputs-b/pdf/handout-student.pdf` | 2页、4公式，可与已编辑文件对照；存在作答空间。 |
| 练习 | `443688d31b2d39959142b93f4d2925fb8a20346e:experiments/C22/outputs-b/docx/practice-student.docx` | `443688d31b2d39959142b93f4d2925fb8a20346e:experiments/C22/outputs-b/pdf/practice-student.pdf` | 3页、6公式；Q2正文泄漏是反例。 |

同目录 teacher 变体分别 2/2/4 页，含答案和教师注记。严格新样本应把 Q2 配方仅置 solution，并在正文/注记分开加入可识别串；四种开关组合逐一核对，不用样本文件名“student”代替内容检查。

## 实施与产品验收界限

| 项目 | 必须补到的可观察证据 | 负责/门槛 |
| --- | --- | --- |
| 自动收题一般路径 | T/W/P/I/PS 各至少5/6正确拆分、4/6主要内容无需整题重录；另3个E题组至少2组完整；逐题中文、数学、图、选项/小问、原有答案、定位检查；保存编辑后重开。 | R33 self，R35 独立。这是产品实现与泛化验收，不是已关闭 REV-001 的补证。 |
| 公式与图资产 | LaTeX 实际可编辑、真实图像文件绑定、region/跨页定位；E完整性和 F 局部继续。 | R33；共用裁图/编辑原语缺陷归 R31。 |
| 一般可编辑 DOCX | 从用户编辑的源产生 OMML，三类成果都有对应 DOCX/PDF，修一处中文/行内分式/独立公式后保存重开。 | R34 self，R35 独立；不能只跑 C22 生成脚本。 |
| 旧 DOC | 已观察到公式缺失的样本显示 limited；实际预览页仍可用，绑定外部完整PDF后能核对且不覆盖原件。目标工具能否提供完整补充结果需实测。 | R31 转换、R32 补充预览；R35 目标材料。旧 DOC 完整保真保持未证实。 |
| 学生内容隔离与打印 | 答案/注记四种开关组合，核对 OOXML/PDF 正文与页图；三类各一次实际打印预览。 | R34、R35。这是产品候选的实际输出验收，不重开已关闭的 REV-002 本机实验切片。 |
| Windows/WPS/Office | 在外层指定并提供访问的实际 Windows/WPS 版本打开六种输出，编辑保存公式并重开；真实 DOC/DOCX/PPT/PPTX 逐页预览对照和打印。记录版本、字体、截图/动作/输出 SHA。 | 外层提供设备/权限，R35 执行，D72 课堂环境复验。Linux 证据不能代签。 |
| 真实认证 | 已独立冻结的认证版接入 principal 并验证登录、失效、退出和账户隔离。 | 认证负责人/A11；本批延续 test-principal 可推进实现。 |

当前固定实验依据支持技术路线进入限定最终冻结；以上产品实施和目标环境能力不能写成已交付或独立 PASS。若 R33/R34 在真实产品验证中无法满足已定能力，回对应实现节点；只有公共语义真实不兼容时才回 R30 新 revision，不把范围缩成手工录入、公式截图 Word 或 Office 仅下载。
