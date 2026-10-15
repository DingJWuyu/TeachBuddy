# 原生题目文本规则归属

本任务是[工程改造](agent-workflow.md)中的 B3，同时用于验证实际代码任务的中断接手。首位作者在真实中间点停下，接续作者已仅依据本页、台账和 Git 完成调用迁移及指定 HTTP 自验；尚待总控整体审查与集成。稳定事实已归入题库技术参考，本页随主任务收尾。

## 目标与边界

题库 `extraction.js` 同时编排提取流程并拥有 `nativeText`、`questionStart`、`answerHeading`、`continuationHeading`。它导入 `recognized-page.js` 和 `extraction-figures.js`，后两者又从它读取文本规则，造成职责混合和循环。将这些完整文本解释规则聚合为同目录 `native-text.js`，实际调用者直接导入，不保留永久转导出。

保留算法、正则、原稿字符位置、题号/答案匹配、随机标识、未分配片段、已有题目边界与配图归属；本轮不是修订材料识别策略。其他业务、产品 UI、协议及固定原稿不改。发现范围外问题按 [buffer](../../buffer.md) 处理，范围内必要消费者由本任务完成。

读根 AGENTS、[开发约定](../agents/module-development.md)、[CI 分工](../agents/github-workflow.md#ci-与本地验证)、[代码标准](../code-standards.md)、[Lessons](../../LESSONS.md)，再按[题库技术参考](../subsystems/questions.md)及[材料契约](../contracts/materials.md)核对实际源码。工作现场由总控从当前工程候选创建：`TeacherWorkspace-workflow-native-text` / `refactor/workflow-native-text`；基线用 Git 核对。允许本地提交和隔离定点验证，不操作 trunk、main、远端或用户运行实例。

## 阶段与写入

| 阶段 | 可写范围与结束条件 |
| --- | --- |
| 首位作者 | `apps/api/src/modules/questions/native-text.js`、`extraction.js` 与本页。完成纯文本拥有者及主提取入口接线后，在尚未迁移所有反向消费者、尚未完成 HTTP 验证的真实中间点停下。可暂时保留旧导出供下阶段移除，必须标明是未完成交接状态，不宣称整体就绪。保存本地提交，更新本页的实际完成/未完成、候选和下一步 |
| 接续作者 | 同目录相关消费者、直接导入测试/脚本、题库技术参考与本页。核对前任成果和 Git 后完成全部调用迁移、移除临时转导出，真实运行下列必要路径。若新发现需额外公共写权，交总控协调，不自行扩展 |
| 总控 | 核对接手结果、整体依赖、审查和已授权交付；不把计划交接冒充随机掉电或所有长程任务都已证明 |

## 完成判据与验证

- 文本解释在一个完整拥有者内，`extraction` 负责流程；页识别和配图不再反向导入提取编排。检查实际依赖，不以文件行数为完成标准。
- 现有实际 HTTP 测试证明文本、Word、PDF 收录仍保留题目边界、答案与原稿定位。使用 `apps/api/test/materials-questions.test.js` 中 text import、native text、fixed native T and W、native PDF automatically、至少一个图边公式分支，以及 `materials-questions-output.test.js` 的 standalone answer heading/section 场景；按名字定点选择，不运行全部输出和外部 E 原件测试。
- 如核对发现这些用例未覆盖所迁规则，补已有实际场景的必要断言；不新增逐函数镜像单测。旧失败或缺工具记录实际原因，不能放宽断言变绿。
- 从本工作树 `npm ci` 安装；Office/Xpdf/Pandoc 等按 [SETUP](../SETUP.md#环境准备) 及工具安装脚本定位或准备，使用入库固定输入。测试自行创建隔离库/目录，不使用个人资料、真实模型或邮件。无关 GeoGebra 源码不重建。
- 记录实际命令、候选与结果、未验范围和必要总控介入。回执和日志可在 `test-results/workflow-health/native-text/`，必要接续事实必须写回本页。完整 CI 与独立审查由主任务集中承担。

## 当前状态

两位作者的约定实现及本地定点验证已完成，未集成、未独立审查、未运行完整 CI。需求无未决项，当前没有外部阻塞；总控继续整体依赖核对与交付。

- 现场：`TeacherWorkspace-workflow-native-text` / `refactor/workflow-native-text`；首位作者 session 为 `/root/health_native_start`，接续作者为 `/root/health_native_resume`，两阶段派发配置均为 `gpt-6.1-sol/high`。
- 输入基线：`40cbc9f89c591feda61bde9e68e97cb0701aab41`；接手 HEAD 为 `1a6231e3`，当时工作树干净；最终代码及技术参考候选：`6514c53b54b6af3cffddd3f315126629441de1a5`（`refactor(questions): complete native text consumer migration`）。本页事实另存后续文档提交；接续时用 `git log`、`git status` 核对分支最新 HEAD。
- 已实现：`native-text.js` 完整拥有 `nativeText`、三个公开正则及内部 `inlineAnswer`，沿用 `questionLabel` 和现有文稿构造能力；`extraction.js` 主流程直接导入 `nativeText`。迁出规则正文与基线逐字节一致，没有改算法、正则、ID、匹配或来源位置。
- 接续已完成：`recognized-page.js`、`extraction-figures.js`、`native-word.js`、`native-pdf.js` 直接导入 `native-text.js`，移除 `extraction.js` 四个临时转导出。搜索 `apps/`、`scripts/`、`packages/` 后只有模块装配仍导入提取 handler，无测试或脚本需迁移。拥有者仅依赖现有文稿及片段能力，实际依赖不回到提取编排，原循环解除。[题库技术参考](../subsystems/questions.md#运行路径与持久化)已同步当前归属。

### 首位作者验证

仅作者自检，未进行独立审查、CI 或产品 HTTP 验证；本阶段未启动用户实例、未使用真实模型/邮件。

| 实际命令与检查 | 结果与边界 |
| --- | --- |
| 本工作树执行 `npm ci` | 退出 0；Node `v22.23.2`、npm `10.9.8`。日志在 `test-results/workflow-health/native-text/first-author-npm-ci.log`；npm 提示 20 项依赖漏洞，本阶段未扩展依赖修复，交总控判断 |
| `node --check apps/api/src/modules/questions/native-text.js`；`node --check apps/api/src/modules/questions/extraction.js` | 均通过，只证明语法可解析 |
| `python3` 读取 `git show 40cbc9f89c591feda61bde9e68e97cb0701aab41:apps/api/src/modules/questions/extraction.js`，比较 `export const questionStart =` 至 `// A transport is explicitly injected` 之前正文与新拥有者对应正文 | 逐字节相等；只证明搬迁无文本变更 |
| `node --input-type=module` 加载拥有者、提取编排及上述四个剩余消费者，逐项断言临时导出与拥有者的四个导出严格相等 | 通过；只证明模块加载及临时接线有效，不证明 HTTP 行为或循环已解除 |
| `git diff --check` | 通过 |

### 接续作者验证

在上述最终代码候选执行，未改变算法、测试断言或固定输入。复用首位作者在本工作树的 `npm ci` 安装；实际工具核对为 LibreOffice 26.8.0.3、Pandoc 3.11、Xpdf 4.06，以及系统 Bubblewrap/Poppler。工具来自源码之外的持久安装目录，不读取用户 `.env`、资料或运行实例；无真实模型、邮件调用，无 GeoGebra 重建。

| 实际命令与检查 | 结果与边界 |
| --- | --- |
| 下列 `node --test` 定点命令 | 8 项通过、0 失败、0 跳过，退出 0；日志为 `test-results/workflow-health/native-text/resume-http.log`。真实隔离 HTTP/SQLite 路径覆盖文本、DOCX、PDF、contact 图边可编辑公式、跨页答案与原图、原件字节/重启读回，以及答案标题、重复题号、未分配片段及原文位置 |
| `python3` 读取输入基线的 `export const questionStart =` 至 `// A transport is explicitly injected` 之前正文，与 `native-text.js` 的同起点至文件结尾直接比较 | 完整 7551 字节相等，保护算法、正则、ID 及位置逻辑；未修改固定材料 |
| `node --input-type=module` 加载拥有者、提取编排及四个消费者，并断言四个规则只在拥有者导出、不再由编排转导出；`rg -n 'extraction\.js' apps scripts packages --glob '!package-lock.json'` | 加载及导出断言通过；仅 `questions/index.js` 导入 `createExtractionHandler`。实际源码核对 `native-text` 的文稿及片段依赖不导入编排 |
| `git diff --check`，技术参考新增相对文件与锚点核对 | 通过 |

定点命令在本工作树根执行，所用环境变量按 SETUP 指向已核实的持久工具：`MATERIALS_OFFICE_ROOT=/home/liam_t/.local/share/teacherworkspace-tools/libreoffice-26.8/opt/libreoffice26.8`、`MATERIALS_PANDOC_PATH=/home/liam_t/.local/share/teacherworkspace-tools/pandoc-3.11/bin/pandoc`、`QUESTIONS_XPDF_PDFTOHTML=/home/liam_t/.local/share/teacherworkspace-tools/xpdf-tools-linux-4.06/bin64/pdftohtml`。换机按 SETUP 准备并替换实际路径，不依赖这些本机目录。

```bash
node --test --test-concurrency=1 --test-name-pattern='^text import|^native text import|^fixed native T and W|^native PDF automatically|^native PDF figure boundary.*variant=contact$|^standalone common answer headings|^standalone answer section|^answer section keeps leading' apps/api/test/materials-questions.test.js apps/api/test/materials-questions-output.test.js
```

实际同时设置 `TMPDIR=$PWD/test-results/workflow-health/native-text/resume-tmp`、`QUESTIONS_OUTPUT_EVIDENCE_DIR=$PWD/test-results/workflow-health/native-text/output` 和 `PDF_STRUCTURE_EVIDENCE=$PWD/test-results/workflow-health/native-text/pdf`，日志重定向到上述 `resume-http.log`。本次隔离临时库与转换目录在通过后清理；原始日志及 `output/`、`pdf/`、`native-originals/` 有效证据保留供总控，摘要见同目录 `resume-receipt.json`。现有实际场景已保护所迁规则，无需新增镜像单测或放宽断言。

### 总控接续

1. 核对最终候选与上述证据，对完整 B3 及工程候选集中执行整体依赖检查、独立 Standards/Spec 审查和必要 CI。作者自验不代替这些结果；完整输出套件、外部 E 原件、真实 OCR/模型及目标 Office 不在本次验证范围。
2. 按主任务授权集成后清理本现场与任务分支，维护全局台账。本作者未执行 push、PR、trunk/main、远端或用户服务操作。
3. 这一结果只证明按入库记录从计划中间点独立接手，不代表随机掉电、所有长程任务或全仓健康均已证明。
