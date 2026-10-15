# 原生题目文本规则归属

本任务是[工程改造](agent-workflow.md)中的 B3，同时用于验证实际代码任务的中断接手。范围已确认，可直接实施；当前阶段是首位作者实施，后续接手者只依据本页和仓库继续，不依赖旧聊天。完成后将稳定事实归入题库技术参考，本页随主任务收尾。

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

首位作者尚未开始。下一步按首阶段完成实际迁移并保留可接续提交；接续前不得把本任务标完成。需求无未决项，工具和输入可按入库说明准备，当前没有外部阻塞。
