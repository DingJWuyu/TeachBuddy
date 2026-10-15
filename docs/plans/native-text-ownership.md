# 原生题目文本规则归属

本任务是[工程改造](agent-workflow.md)中的 B3，同时用于验证实际代码任务的中断接手。范围已确认，可直接实施；首位作者阶段已完成并停在下述中间点，接续作者只依据本页和仓库继续，不依赖旧聊天。完成后将稳定事实归入题库技术参考，本页随主任务收尾。

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

首位作者已完成约定中间成果，整体任务未完成、未集成、未执行 HTTP 验证。需求无未决项，当前没有外部阻塞。

- 现场：`TeacherWorkspace-workflow-native-text` / `refactor/workflow-native-text`；首位作者 session 为 `/root/health_native_start`，派发配置为 `gpt-6.1-sol/high`。
- 输入基线：`40cbc9f89c591feda61bde9e68e97cb0701aab41`；代码候选：`7d8102189b829caee8a7f70c9668ec16fef0da19`（`refactor(questions): extract native text rule owner`）。本页的接手事实另存后续文档提交；接续时用 `git log`、`git status` 核对分支最新 HEAD。
- 已实现：`native-text.js` 完整拥有 `nativeText`、三个公开正则及内部 `inlineAnswer`，沿用 `questionLabel` 和现有文稿构造能力；`extraction.js` 主流程直接导入 `nativeText`。迁出规则正文与基线逐字节一致，没有改算法、正则、ID、匹配或来源位置。
- 真实未完成点：`recognized-page.js`、`extraction-figures.js`、`native-word.js`、`native-pdf.js` 仍从 `extraction.js` 导入文本规则；`extraction.js` 明示保留四个临时转导出。因此反向依赖仍在，不能把这一候选当作最终职责拆分结果。测试/脚本消费者、题库技术参考和必要 HTTP 路径均待接续作者核对。

### 首位作者验证

仅作者自检，未进行独立审查、CI 或产品 HTTP 验证；本阶段未启动用户实例、未使用真实模型/邮件。

| 实际命令与检查 | 结果与边界 |
| --- | --- |
| 本工作树执行 `npm ci` | 退出 0；Node `v22.23.2`、npm `10.9.8`。日志在 `test-results/workflow-health/native-text/first-author-npm-ci.log`；npm 提示 20 项依赖漏洞，本阶段未扩展依赖修复，交总控判断 |
| `node --check apps/api/src/modules/questions/native-text.js`；`node --check apps/api/src/modules/questions/extraction.js` | 均通过，只证明语法可解析 |
| `python3` 读取 `git show 40cbc9f89c591feda61bde9e68e97cb0701aab41:apps/api/src/modules/questions/extraction.js`，比较 `export const questionStart =` 至 `// A transport is explicitly injected` 之前正文与新拥有者对应正文 | 逐字节相等；只证明搬迁无文本变更 |
| `node --input-type=module` 加载拥有者、提取编排及上述四个剩余消费者，逐项断言临时导出与拥有者的四个导出严格相等 | 通过；只证明模块加载及临时接线有效，不证明 HTTP 行为或循环已解除 |
| `git diff --check` | 通过 |

### 接续动作

1. 核对本页、台账、Git 候选和未提交状态；保留首位作者成果。依赖已从本工作树安装，Office/Xpdf/Pandoc 尚未在本阶段核对或准备，按 SETUP 继续。
2. 迁移上述四个消费者并搜索直接导入测试/脚本，全部直接读取 `native-text.js`；移除 `extraction.js` 的四个临时转导出，核对实际依赖消除反向循环。保持原算法及现有固定材料字节不变。
3. 按上文完成判据定点真实运行 text import、native text、fixed native T and W、native PDF automatically、至少一个图边公式分支，以及 standalone answer heading/section；现阶段这些全部未验，不能复用语法或加载结果代替。
4. 更新题库技术参考和本页，记录候选、命令、实际结果及剩余事项，交总控整体依赖核对、独立审查和集成。首位作者未执行 push、PR、trunk/main 或远端操作；本现场与安装日志为接续保留。
