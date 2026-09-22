# R34-PANDOC@1 attempt 1

**self PASS，限本次输出修复及本机验证。新产品制品仍待 Word/WPS 真人和独立验收；原真人红灯未关闭，完整 C22/R35 未通过。** 产品模型调用、真实凭据读取、外部邮件均为0；未合 main、push、部署或更改网络/防火墙。

## 固定输入与候选

| 对象 | 固定版本/来源 |
| --- | --- |
| main 起点 | `5cee96071ac0d47e5a5575b4f6d4dac3ac685143`；分支 `fix/r34-office-compatibility` 从该点创建 |
| 指定产品组合 | `3d5c3f308bfeaa0e038a9fb86e6dab2816b9ec7c`，只读 `/home/liam_t/项目/TeacherWorkspace-r34-protection-fix` |
| TT-C7 输入 | `baaeb09973cd01848432622e35712b74627f4488`，消费为 `de6233ad9de526599fcebccdd58e934710af54e6` |
| 组合 fixed point | `7433f04ba3d7435ff83b772514ceb6c053e98fd4`；apps/packages/scripts/依赖树相对指定产品仅多 TT-C7 测试修复，contracts 字节一致 |
| 产品实现提交 | `431269d326f83fa8432bc29c3cd9579864d62447` |
| **最终产品/测试候选** | **`2a159af857e0c97c59ab10443657f877d5ddd39a`**；相对上一提交仅强化公式数量测试，产品源码树相同 |
| 独立输入 | `efd3b071a603d38902688b0b4dd68289e8516c69:docs/acceptance/evidence/R35/v1/local-review6.md`；006/007按其限定 CLOSED，其他外部条件和历史 OBS 不变 |
| 真人未提交交接 | 来源 HEAD `b3a2eb665f29c4485729ecf70005ef15c93f0a4b`，本次 [input-manifest](../../HUMAN-ACCEPTANCE/20260922/input-manifest.json) 固定78项 |
| 原失败件 | `7f965c6408a73d30524ff8e11c40484a352232c1:experiments/C22/control-1/outputs/docx/handout-student.docx`；本报告 [只读来源副本](pandoc/red/handout-student.docx) |

78项输入先校验大小和 SHA256，再复制到本 worktree `.scratch/r34-pandoc/inputs/`；收尾再次校验原件78项全部相同。必要25项原始交接/样例来源按原路径归档至 [HUMAN-ACCEPTANCE](../../HUMAN-ACCEPTANCE/20260922/archived-files.json)，没有把实验小样变成产品通过证据。原件、来源 worktree 及其库未编辑，没有引入 `006b4def`。main 控制文档保持原基线，README 仅增加本分支输出候选说明。

判据消费同版 R34 任务、materials 契约/用例、UX U-M6、实验裁决、protection-fix.md，以及本轮用户授权。冻结行为没有矛盾需改契约；没有修改认证、Agent 或其他模块业务实现。

## 故障证据与改动

用户确认原失败件在 Word 无法打开、WPS 缺公式。该原件经本机 Pandoc 3.11 读回，公式消失而中文保留：[读回](pandoc/red/roundtrip.md)。指定旧产品也可生成同样的最小失败：[旧产品件](pandoc/red/product.docx)、[读回 JSON](pandoc/red/product.json)，两个公式均丢失。

实际 HTTP 红灯命令为 `node --test apps/api/test/materials-pandoc.test.js`：在 fixed point 的输出器上运行新增回归，真实建题、取材、受理、下载后，首份 DOCX 读回0个公式，退出1：[red-http.log](pandoc/logs/red-http.log)。这捕获了本机可执行的公式丢失切片，**不等价于运行 Word/WPS，也没有证明 Word 拒绝打开的具体规范根因**。未执行公式 XML 修补或对旧文件覆盖写入。

本次替换掉自写 MathJax树到OMML翻译及 ImportedXmlComponent 导入。保留原 `exportTree` 过滤、题号/顺序、原题/采用快照和任务语义；经过过滤的文字、数学源、列表、表格、账户图片映射为 Pandoc JSON AST，由 Pandoc 写整个 DOCX。docx 库仅建立中文字体、A4/20 mm 页边距和段落样式模板，不生成正文或公式。图片经原有受限 sharp 路径读取，本轮三图输出像素与来源一致。

公式受理前使用相同 Pandoc writer 批量预检，失败再定位 field；关闭的答案/注记不参加预检。保留源语法限制，未知数学不以文字或截图降级。受理后的同一快照仍沿原 LibreOffice 链验证和生成 PDF。Pandoc 缺失在受理前返回503；已受理无公式文档的转换器故障进入 failed/conversion-failed，不发布 fileId，旧输出和原件保留。

Pandoc 使用现有 bubblewrap 方式：独立网络/其他命名空间、清空环境、只读工具及本任务输入、CPU/地址空间/文件描述符/输出量和时限约束。无模型、网络取材或用户可传递的 raw XML/脚本入口。运行依赖为 Pandoc 3.11、既有 LibreOffice 和 Linux bubblewrap；[官方样式文档](https://pandoc.org/MANUAL.html#custom-styles)说明 reference-doc 与 custom-style 的用法。

PDF目视发现过学生讲义/练习纯空白尾页：[早期页图](pandoc/red/handout-00-overview.png)。模板缺根样式 Normal，使 Pandoc 将继承链上的分页样式视为未定义并追加同名样式。补齐根样式、用已有默认标题样式配置后，最终样式 ID 唯一，题末/作答区相连，无纯空白页。该修复只针对版式，不改公式 XML。

## 本轮实际红绿

| 切片 | 结果与证据 |
| --- | --- |
| 固定失败件、旧产品真实 HTTP | 本机读回公式丢失 RED；目标 Word/WPS 保留真人 RED。上述 red/ 与 red-http.log |
| 三成果×两格式×两个开关 | **24份 GREEN**。真实 HTTP 上传3图、建立6题、服务器采用快照、生成/下载。题面17公式，非练习表格另1，答案开启另9；精确数量、分式/根式/分段结构、3图像素、表格、A4、20 mm 边距和24作答空行均通过。[制品及内容清单](pandoc/http/manifest.json)、[受理备课](pandoc/http/accepted-lesson.json)、[最终精确断言重跑](pandoc/logs/exact-formulas.log) |
| 学生/教师与账户隔离 | 24组合逐件检查 DOCX/PDF 的答案/注记开关、长期私密笔记排除；B账户下载全部404；原图下载哈希保留；同库重启后24文件哈希逐项一致。新HTTP测试中断言，非旧实验复用 |
| 失败与版本保护 | 7项备课、1项未知版本保护、1项完整输出测试共9项通过；MC19新增 Pandoc 缺失的受理前503/受理后failed检查通过；TT-C7通过。[9项日志](pandoc/logs/final-api.log)、[故障与TT-C7](pandoc/logs/failure-ttc7.log)。包括不支持公式422、不建Job、Office/写盘/缺文件故障、旧成功输出、受理快照、旧版本和取消/重启恢复 |
| 五类数学作品 | 3项真实组合回归通过，包含 formula/plane/space/dynamic/html 的教案和讲义 DOCX/PDF、私密注记排除、练习不混入数学材料；[math.log](pandoc/logs/math.log)、[输出](pandoc/math/outputs.json)。仅将原测试的证据目录改向本轮临时副本运行，未修改数学业务或旧证据 |
| 浏览器端到端 | 新库、真实本地注册会话、fake-mail、自签HTTPS。上传PPTX预览/替换、原生文字收录校对、题目/资源取材、六输出下载预览、刷新/重启和新浏览器接续通过。无 pageerror，普通控件操作。[最终日志](pandoc/logs/browser-final.log)、[环境](pandoc/browser/browser-environment.json)、[成品预览](pandoc/browser/output-real.png)、[重启](pandoc/browser/restart-new-browser.png) |
| PDF逐页 | 12份PDF全部46页目视检查，公式/图无裁切、重叠或纯空白页；保留自然跨页和指定作答空间，不用缩减内容换页数。[全部页图与汇总](pandoc/pages/summary.json)。学生教案/讲义/练习为3/4/4页，双开教师为3/5/5页 |
| Linux真实Office | LibreOffice26.8.0.3独立GUI/profile。讲义中文、行内分式、独立公式分母及根式指数两轮修改，另存关闭重开后逐项比对，仍为公式对象；生成改后PDF并目视4页。三成果实际PrintPreview已截图。[动作脚本](pandoc/scripts/office.py)、[结果](pandoc/office/results.json)、[改后DOCX](pandoc/office/handout-edited-2.docx)、[改后PDF](pandoc/office/handout-edited.pdf)、[页图](pandoc/office/edited-overview.png)。这是UNO驱动真实Writer，非真人鼠标编辑 |
| 构建与内部审查 | npm ci、build:shared、build:web、JS语法和产品/手写文件git diff空白检查通过。归档的原始生成Markdown末尾及两份原日志有3处空白提示，按原字节保留，不修改来源或日志。保留Vite既有chunk提示，无独立lint脚本，未冒称全API/完整材料阶段通过。Standards PASS / Spec PASS：[双轴回执](pandoc/internal-review.md) |

HTTP矩阵采用指定产品已有 `lessons-pagination/lesson.json` 六题及三图，通过真实API建立新的正常对象；它不是旧C22六稿逐字同源，Q1等沿用其固定源值，不改写为实验题文。浏览器另走原生文字收录和真实资源文件链，未以测试 principal 冒充真人认证。以上共覆盖13个不同定向API测试及1条完整浏览器流程。

证据矩阵/Office制品来自 `431269d` 的产品实现；最终 `2a159af` 产品源码树完全相同，只强化测试。最终精确断言另在 `2a159af` 实际重跑24组合，输出保留于本 worktree `.scratch/r34-pandoc/final-exact-http/`，索引为 [exact-rerun-manifest](pandoc/exact-rerun-manifest.json)。不以重新命名旧证据冒充新代码验证。

采集限制与失败原样保留：浏览器首跑 Target crashed，系统 `/tmp` 99%使用，改用 `/home/liam_t/r34-pandoc-run/tmp` 后完整通过；不删除其他任务的临时目录。首次空白行断言误数行内空格，改为解析完整空格段落；未改产品掩盖。首次Office窗口被欢迎对话框遮挡，未算打印通过；通过其可见Next/OK控件关闭后重做。StarMath重开会正规化括号及减号表示，逐项比对仅归一化这些表示与空白，实际分母/根指数仍断言。相应失败日志保留在 logs/ 或 `.scratch/r34-pandoc/`。

## 复验与后继合流

直接从最终候选建立隔离副本，`npm ci` 后使用自己的TMPDIR和数据目录。以下从仓库根执行；工具只读，不提交二进制：

```bash
export TMPDIR=/home/liam_t/r34-pandoc-run/tmp
export MATERIALS_PANDOC_PATH=/home/liam_t/项目/TeacherWorkspace-office-comparison/experiments/office-comparison/tools/pandoc-3.11/bin/pandoc
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
export R34_PANDOC_EVIDENCE="$PWD/test-results/pandoc-http"
node --test apps/api/test/materials-pandoc.test.js apps/api/test/materials-lessons.test.js apps/api/test/materials-protection.test.js
node --test --test-name-pattern='TT-C7' apps/api/test/teaching-time-reminders.test.js
npm run build:shared
npm run build:web
R34_BROWSER_EVIDENCE="$PWD/test-results/pandoc-browser" npx playwright test -c apps/web/e2e/fixtures/materials-integration/playwright.config.mjs -g '真实身份外壳'
```

复验者须将TMPDIR、证据路径改为自己的隔离位置，不写本轮保留目录。Office脚本需自己启动独立GUI/UNO端口和profile，并替换脚本端口50945/display154；不连接已有用户Office。原失败路径可在独立fixed-point副本中复制本次新增HTTP测试运行，退出1/公式0为本机红灯；真人复验使用原失败件副本对照。

接续方已拥有 `3d5c3f3` 固定组合时，先消费 `baaeb09973cd01848432622e35712b74627f4488`（已有则不重复），再依次 cherry-pick `431269d326f83fa8432bc29c3cd9579864d62447` 和 `2a159af857e0c97c59ab10443657f877d5ddd39a`，最后消费本报告/证据提交。**不要重复引入本分支的组合快照提交 `1d027414...` 和 `7433f04...`**；它们只用于从main建本任务候选。公共README/.gitignore冲突按当前接收树保留两方有效内容，不整文件覆盖。合流后按上述链路复验，是否合main仍由用户授权。

真人入口：[新产品验收包](pandoc/真人验收包.zip)、[逐项清单](pandoc/真人验收清单.txt)、[包内文件hash](pandoc/human-package-files.json)。包括三类学生/双开教师DOCX及同源产品PDF。两款目标软件均需记录具体版本和页数、两轮真实中文/行内及独立公式编辑、另存关闭重开、改后PDF及三类打印；其他五稿逐页检查。旧Pandoc实验的人工反馈不能替代这批新产品。目标设备/物理打印和R35原未决项保持外层原归属，不重开旧HTTP诊断或模型窗口。

Office50945、Xvfb154已停止，浏览器/API由测试收尾关闭；[runtime](pandoc/runtime.json)记录环境。目标验收未完成，保留隔离数据库、profile、红灯、失败trace和工作进度；这些含本地测试身份状态的现场不进入Git。全证据hash见 [manifest](pandoc/manifest.json)。本session停写，由外层唯一回调。

```yaml
task: R34-PANDOC@1
attempt: 1
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T20:07:20Z"
session_id: "01a0caa2-6829-7940-ae4f-02c7488a4944"
runner: "Codex / gpt-6-astra / low"
skills_used: [diagnosing-bugs, writing-for-agents, code-review]
base_revision: "5cee96071ac0d47e5a5575b4f6d4dac3ac685143"
product_input_revision: "3d5c3f308bfeaa0e038a9fb86e6dab2816b9ec7c"
final_product_revision: "2a159af857e0c97c59ab10443657f877d5ddd39a"
result_revision: "本报告及pandoc/HUMAN-ACCEPTANCE证据所在提交；完整SHA由最终回调给出"
review_target:
  fixed_point: "7433f04ba3d7435ff83b772514ceb6c053e98fd4"
  commit_range: "7433f04ba3d7435ff83b772514ceb6c053e98fd4...2a159af857e0c97c59ab10443657f877d5ddd39a"
  standards: PASS
  spec: PASS
  aggregate: "pandoc/internal-review.md"
internal_reviewers: ["/root/standards Codex/gpt-6-astra/low只读叶子", "/root/spec Codex/gpt-6-astra/low只读叶子"]
inputs: ["本报告固定输入表", "HUMAN-ACCEPTANCE/20260922/input-manifest.json"]
changed_files: ["pandoc/scope.json"]
artifacts: ["pandoc/manifest.json", "pandoc/真人验收包.zip", "pandoc/http", "pandoc/browser", "pandoc/office"]
checks: ["旧固定件和旧产品HTTP公式读回红灯", "24组合精确公式/图文/过滤/重启绿灯", "13项不同定向API", "真实认证浏览器全链", "12份PDF逐页", "Linux Writer两轮编辑及三类打印", "构建/语法/空白", "内部双轴review"]
identity_mode: "test-principal HTTP；real-auth/fake-mail/self-signed HTTPS browser"
open_items: ["新产品目标Word/WPS全部真人检查与独立验收", "完整C22/R35原外部条件和历史OBS未决"]
failure_owner: null
next_condition: "固定新产品候选交独立验收；用户在Word/WPS验证真人验收包，实际红灯关闭由外层裁决"
authorization_used: "本轮R34-PANDOC@1 attempt1用户指令；只读来源、隔离写入、本地提交、内部skill审查；不合main/push/部署"
```
