# 作者 C：材料与数学成果

## 当前现场与状态

作者 `/root/author_c_outputs`，gpt-6.1-sol / high；工作树 `/home/liam_t/项目/TeachBuddy-test-outputs`，分支 `test/rebuild-outputs`。最初空测试基线 `992172141f6664d4d851154cc533428414051c42`，首轮作者提交 `1fa60e2f5db91a1e24809974712a06d28db279d2`。本轮按总控要求合并 `6673f8d59ac34a3fb1646a81680504b0213d651c`，合并提交 `17e3487`；共享主计划冲突采用总控原文，本记录独立维护。

当前候选为 23 项测试。独立 D 对固定 `6b70a35c` 的 22 项已独立验证通过（94.7 秒）。第三批补当前 MinerU typed 消费及删源摘录的资料包/部署恢复，两项定点通过，无跳过；这批提交为 `b7e9df9d208a81b3644c59c13157cd6cc1f62fba`；随后按 D08 在同一 C3 用例补 80 行真实分页保护，候选数量仍为 23。新增部分待独立复核和集成 CI。未合并整个 a05cb28 主计划，已核对所需公共 fixture、识别/题库/可靠性实现及固定输入与该版本无差异。产品实现、冻结输入、兼容快照、样本生成工具与生成资产均无永久改动。根配置、CI、共享准备仍由总控唯一维护，未创建 PR 或推送。

证据目录为本工作树 `test-results/test-suite-rebuild/`。新增测试复用总控 `apps/api/test/support/application.js` 的真实认证、HTTPS、SQLite、独立文件目录和端口；邮件与识别/模型边界为受控替身。

## 已撤销的 C3 范围

删除 `document-outputs.test.js` 中直接 `generateDocx` 后 `files.store` 的 Word/PDF 回归。`9e9edf6c` 已退役唯一备课产品消费者；当前源码只有转换函数定义，剩余调用在 `apps/api/test/fixtures/classroom/paper.mjs` 的样本准备。真实 DOCX 文件与 OMML 只能证明样本转换工具，不能证明现产品具备可编辑 Word 导出。

首轮“产品可编辑 Word 导出通过”的结论撤销，`c3-mutation-editable.log` 不再作为当前产品保证。现行 C3 只保留题库真实 HTTP PNG 素材输出，验证透明分片与长期笔记不进入公开成果。样本输入和转换工具保持不变。

## 当前保护与归属

| 组 | 当前独有保护 | 现行依据与实际入口 |
| --- | --- | --- |
| C1，3 项 | W/P 原生提取的题干、已有答案、Q6 无答案、公式、图和原稿位置；PPT/PPTX/DOC 真正预览页、正文与原件字节 | materials 文件/定位/自动收题；samples W/P/Office；HTTP files/imports，经 native-word/native-pdf 与受限转换器 |
| C2，3 项 | 官方 D2/D8 typed 数学/表格及单独受控 typed 列表；固定 I-1 人工校对/采用与机器 raw 分离、资源检索复用；I-2 分段式与 PS-4 已有答案按题号匹配，未匹配内容保留 | recognition 机器页结果/模块接缝；公开识别、题库收录与资源检索 |
| C3，1 项 | 题面与答案真实透明 PNG、选定图输出；80 行长段落跨片完整保留；长期笔记改变不能影响公开输出字节 | materials 引用和输出；question-asset HTTP 任务及授权文件下载 |
| C4，7 项 | 旧源、实际 SVG 数学曲线；动态停服禁网；统一课堂完整构造、实际函数对象/保存视区；真实 3D 体积坐标/图像；外部 HTML 隔离；无定义源修正与历史；纯公式作品 | math 源/导出隔离契约；公开 works/exports，workshop-render 与课堂包本地 GGB |
| C5，3 项 | 真 MV3 两轮、精确代码乘号、取消迟到丢弃；管理页重载接回旧页面且不重发；固定 0.1 升级按当前版本回复重连 | features/math 网页 AI；extension 页面协议。固定网页替身，Chromium 实际加载扩展 |
| C-R1，2 项 | 恶意 Office/压缩限额及实际宿主文件、网络隔离 | materials 文件执行边界；真实上传/预览，由 converter 的 bwrap 启动 conversion-worker |
| C-R2，3 项 | 未确认停止禁止新 run；取消、超时完整迟到 raw/附件绑定原任务，明确重试不覆盖 | recognition 入口与状态；真实 HTTP recognition/Job/files，加真实 createRecognizer 运行/停止协议 |
| C-R3，1 项 | 教学表列角色、唯一跨页续题、无表头/合并歧义不造题；教师采用的带图笔记在材料彻底删除后仍可读，个人包可带走，维护备份恢复可读回 | materials 自动收题/noteFragments；recognized-tables、公开校对保存/入库/归档/彻底删除 |

A 拥有通用身份、保存/备份恢复、文件历史关系与 XLS；B 拥有主应用编辑、保存状态及 OCR 校对界面接线。C 不重复这两线的普通保存边界。

## C-R1 至 C-R4 关闭证据

| ID | 实现与输入 | 定点结果 | 代表性业务破坏及检出 |
| --- | --- | --- | --- |
| C-R1 | `conversion-boundaries.test.js`。真实 DOCX 中加入主动关系/宏；流式生成合法压缩、展开 513 MiB 的 ZIP。实际 bwrap 内运行受控 Office 探针，宿主哨兵只位于本次独立临时目录，网络只访问本次自建 loopback 端口 | `c-r-final.log` 中 2/2 | `c-r1-red-network.log`：临时加 `--share-net`，自建 server 实际 hits=1，预览的“宿主文件和网络均不可达”断言失败 |
| C-R2 | `recognition-lifecycle.test.js` 与 `local-recognizer.js`。实际 resident runtime 经公开 HTTP 管线，使用真实本地 Node 子进程实现受控 worker 协议，另一本地进程见证未确认停止；只替换 GPU 资源与 systemd/cgroup 观察。超时手动触发实际 runtime 的页计时回调，不等五分钟、不用紧墙钟判断。raw/附件实际存储后读取，原请求证据表仅只读核验绑定 | `c-r-final.log` 中 3/3 | `c-r2-red-stop.log`：跳过 scope 停止确认，错误 cancelled 被检出。`c-r2-red-late.log`：丢弃迟到绑定，失败于“原任务须持久绑定迟到原始结果” |
| C-R3 | `teaching-table-consumption.test.js`。自编三页可见 HTML 表，实际截图再生成扫描 PDF；预览得到真正页图/页码/摘要，再绑定明确的受控 OCR 结果。既非真实模型录制，也非 GPU 准确率证据，未用私人 E 或白页。正常两页只合并唯一续题，第三页无表头换位/合并列内容保留为片段；教师明确无答案并采用带图笔记，入库后彻底删除材料再读回采用稿与原图 | `c-r-final.log` 中 1/1 | `c-r3-red-continuation.log`：关闭唯一 pending 跨页合并，失败于“唯一续题与练习各成一题，歧义和教师列不能造题” |
| C-R4 | `math-artifacts.test.js`。二维离线课堂直接读取 `ggbApplet.getValue('f(2)')`，核对保存视区的中心、等比例和 8.32×8.78 数学范围，调整参数/步骤/尺寸后继续核对。三维采用固定 combined-source，导出真实图像、禁网冷开完整包，原生对象为 cube、体积 8、G=(2,2,2)，同一构造函数 f(2)=8 | `c-r4-final.log` 2/2 | `c-r4-red-object.log`：只更新控件 output，实际函数仍为 4 而应为 16，被对象断言检出。`c-r4-red-view.log`：忽略保存范围，失败于保存视区中心断言 |

以上故障均在本线独占树串行注入，测试结束后 `finally` 恢复原字节；没有与同树其他测试并跑。失败均运行到具名业务断言，非编译错误、建场失败、跳过或未定位超时。产品 diff 为零。

现存 C3 另有 `c3-red-notes-digest.log`：临时让公开素材包含长期笔记，两次仅笔记不同的 PNG 摘要发生变化，失败于“长期笔记不能影响公开题面与答案图片”。删除 Word 工具例后，真实产品 PNG 保证仍有独立检出证据。

## 第三批 typed 消费与资料带走/恢复

- `mineru-typed-consumption.test.js` 一条代表链消费官方 D2/D8 的 `middle_json.json`，核验冻结 SHA、真正的输入页像素、完整原 raw、D2 行内分段/对数公式节点、D8 六行三列表格的通项/求和数学 run 与独立公式、未分配结构片段及五张原始证据图。生产修订为 `mineru-pro-2605/document-6`。D2/D8 实际没有 typed list；另用一页可见自编 PNG 和明确受控的 typed list 补项目次序、子公式与片段消费，不修改或冒充官方录制。
- 在原 C-R3 同一收录与源删除现场末尾创建真实个人包，解包核对题目摘录文稿、固定来源、PNG 字节/摘要/关系和可读层。随后真正停服，通过维护 CLI backup/restore/activate 建独立恢复目录，重新真实登录，核对原题 ID、独立摘录及原 PNG，源材料仍返回 404。
- [D05 数据契约](../../contracts/data.md#个人资料包)只支持个人 ZIP 内容取回，不提供 ZIP 覆盖账户。此处原 ID 与关系恢复由[部署备份恢复](../../contracts/data.md#部署备份与还原)承担，没有新增或假设个人包导入能力。
- `c-r67-final.log`：2/2，7.16 秒；`c-r67-lint.log` 和 diff check 通过。
- `c-r6-red-table-eq.log`：临时将 typed table 的 eq 数学节点降成普通 text，失败于“table eq 必须保留可编辑通项公式”。`c-r7-red-portable-notes.log`：临时让个人包遗漏 noteFragments，失败于“个人包必须保留独立摘录的实际文稿和固定来源”。均为具名业务失败，finally 恢复产品源码，产品 diff 为零。
- 官方 middle 回放只证明转换/消费，不证明 GPU 原始识别质量、实际 worker 元数据 hook 或裁图映射。受控列表和自编教学表同样不代签真实模型准确率。

## D08 最小分页保护

在现有 C3 同一应用现场追加一题，正文为一个含 80 个显式换行的真实长段落。使用正常建题和 question-png HTTP 任务，不增加长表、超长公式或尺寸矩阵。实际下载每张 PNG，从 alpha 像素统计跨片文字行带，要求合计恰为 80 且实际生成至少三片，检查内容丢尾而非只看文件存在或宽高。

`c-d08-pagination.log` 该用例 1/1（4.06 秒进程耗时）；`c-d08-red-truncated-tail.log` 中临时使三片以上输出只返回首片，短题/独立答案检查仍通过，新增分页业务断言得到 actual=33、expected=80。故障 finally 恢复，产品 diff 为零。`c-d08-lint.log` 和 diff check 通过；只定点 C3，没有重跑全 23 项。

## 验证入口与证据

本轮定点只重跑新增/受影响范围：

- `c-r-final.log`：转换边界 2、识别生命周期 3、教学表消费 1、真实 PNG 1，共 7/7。
- `c-r4-final.log`：补强的二维统一课堂和新增三维课堂，共 2/2。
- `c-bridge-import-final.log`：从根已声明的 `@playwright/test` 导入 Chromium 后，真实 MV3 两轮用例 1/1；其余未变扩展语义复用首轮 `c5-final.log`。
- `c-r-lint.log` 与 `git diff --check`：本线 Oxlint、差异格式通过。
- 未变 C1/C2、旧数学/HTML 等保护沿首轮 `c1-final.log`、`c-api-final.log` 相应通过条目、`c4-final.log`；首轮整批日志含已定位的测试判据失败，不能把该早期日志称为完整通过。

Office/预览使用 SETUP 的 `MATERIALS_OFFICE_ROOT`、Poppler，原生 PDF 用 Xpdf；数学使用已构建 Web/GGB 与 Chromium。Pandoc 仅样本工具使用，不再是现 C3 产品回归的调用依赖。本轮数学只读复用总控冷构建的 `WORKBENCH_WEB_DIST=/home/liam_t/项目/TeachBuddy-test-rebuild/apps/web/dist`，该绝对地址仅运行证据，不写入测试默认依赖。根脚本按现有 `rebuilt-outputs/*.test.js` 选择可收集新增文件，CI 归属由总控维护。

## 限界、发现与下一步

C-R1 是真实转换 namespace 与自建宿主目标的验证；C-R2 替换了 systemd/GPU 边界，不证明真实 cgroup/GPU 释放。C-R3 是受控识别消费，不证明当前模型识别质量。C-R4 是 Chromium 禁网 `file://` 的本地引擎与数学成果，不代签目标设备。

真实 GPU OCR、线上 DeepSeek、商店签名/自动更新、目标桌面浏览器、Word/WPS 人工编辑打印及外部 E 原件仍为未验专项。C5 初轮首导航曾因本机代理绕过 DNS 返回未登录 403，未登录或发送模型消息，记建场失败；最后候选在任何 provider 操作前设置不可达本机代理与 DNS 拒绝，页面由固定路由返回。0.1 旧匿名脚本可能发无版本断连错误，当前消费者按 extensionVersion 过滤，主应用接线归 B。

本轮没有确认的产品缺陷；初次自编 PDF 建场的提前关闭、三维原生类型 cube 与 XML 泛型差异、歧义页的保守 unresolved 状态均已按实际契约修正测试，保留相应失败证据。没有更改产品实现。

下一步由总控接收固定返工提交，交 D 复核 C-R1..4 和删减依据，再进行双轴审查、CI 与集成。当前没有用户输入阻塞。整体目标尚未完成，按要求保留工作树、有效证据与失败现场；成功测试自动清理自身临时目录，最终现场清理由总控在集成验收后执行。
