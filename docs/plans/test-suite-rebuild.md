# 测试套件消融与重建

状态：2026-10-28 完成并集成。[PR #52](https://github.com/DingJWuyu/TeachBuddy/pull/52) 已 squash 至 `preview/integration`，提交 `fdf72f1b11898f4ebed27a34e82c899e560f75c9`。144 个旧执行入口全部移除并逐行裁决；重建套件 92 项在干净 CI 全部通过，0 失败、0 跳过。preview 已同步核对，五个任务工作树、本地任务分支及确认归属的临时文件已清理。

## 目标与授权

用户于 2026-10-27 授权移除全部旧测试，从当前有效需求重新判断必要保护，只重建或恢复有用的测试；总控持续推进并持久化状态。完整目标包括新套件、旧测试去留依据、故障检出与消融证据、验证入口同步、独立审查、集成及清理。

授权沿[运行台账](run-state.md#工作现场与授权)，包含隔离工作树、提交、任务 PR、既定 CI 和 trunk 同步。本任务未合 main、发布、公开部署、调用收费模型或写入用户私有业务数据。固定输入、旧库兼容档案及有效证据保留。

## 固定输入与方法

原始基线为 `789a38d83babad04f2e2a51e9f17530abf638801`。旧套件包含 77 个 API test 文件、56 个浏览器 spec、3 个扩展独立脚本和 8 个非标准历史验证脚本，共 144 个执行入口，见[原清单](test-suite-rebuild/old-tests.tsv)。固定 OCR 录制、Office 输入生成器、旧库源码与 `.feature` 需求资料不算执行回归，按消费者保留。

三位作者先从当前规格、公开入口和用户可见故障设计最小保护集合，冻结设计前不读旧断言。随后 D 阅读旧套件、真实历史修复和候选断言，指出缺口，由原作者补强。故障注入只在隔离副本进行，逐次恢复；比较正常候选、业务故障候选与移除对应组后的候选。编译失败、fixture 故障、skip、未定位超时和原生进程崩溃不算业务检出。

| 工作线 | session / model / effort | 成果入口 |
| --- | --- | --- |
| 总控 | `/root`，当前 session | 公共准备、配置与文档唯一写者，候选集成、CI、preview 核对和清理 |
| A 业务与数据 | `/root/author_a_data`，gpt-6.1-sol / medium | [作者回执](test-suite-rebuild/author-a.md) |
| B 主应用流程 | `/root/author_b_browser`，gpt-6.1-sol / medium | [作者回执](test-suite-rebuild/author-b.md) |
| C 材料与数学 | `/root/author_c_outputs`，gpt-6.1-sol / high | [作者回执](test-suite-rebuild/author-c.md) |
| D 独立消融 | `/root/auditor_d_ablation`，gpt-6.1-sol / xhigh | [独立报告](test-suite-rebuild/independent-ablation.md)、[144 行去留表](test-suite-rebuild/old-test-decisions.tsv) |
| E/F 独立审查 | `/root/review_e_standards`、`/root/review_f_spec`，按 code-review skill 继承调用会话 | [Standards](test-suite-rebuild/review-standards.md)、[Spec](test-suite-rebuild/review-spec.md) |

最多同时运行三个执行者。作者和独立验收分工；公共文件由总控独占，各线使用隔离数据、端口及浏览器。上述回执保留各自固定版本的阶段事实；其中“待 CI/集成”描述提交当时状态，最终交付以本记录为准。

## 最终套件与消融结论

| 保护层 | 当前入口 | 最终 CI |
| --- | --- | --- |
| 业务与数据 | `apps/api/test/rebuilt/` | 45 PASS，41.44 秒 |
| 材料、数学及扩展 | `apps/api/test/rebuilt-outputs/`、`extensions/math-web-ai/test/rebuilt/` | 24 PASS，153.98 秒 |
| 主应用浏览器 | `apps/web/e2e/rebuilt/`，聚合 `apps/web/e2e/ci.config.mjs` | 23 PASS，2.4 分钟 |

全部 92 项无失败或跳过，静态检查、完整构建及必需门禁通过。命令、选集与准备条件以[验证入口](../acceptance/README.md)、根/API `package.json` 和 CI 配置为准。

D 完成 A12、C6、B6 共 24 项代表性业务故障及移组对照，取得有效检出与移组后逃逸或跨组检出的证据。共享保存回执被两个组同时保护，但两个组各有独有业务保证，不能仅据重叠删除整组。144 个旧路径与去留表集合完全一致，旧执行路径全部不存在。

保留的保护集中在真实身份、隔离与原子保存、未知结果及冲突接续、删除恢复、业务口径、实际文件/数学成果和主应用跨模块使用。退役能力、没有产品消费者的生成器断言、同形控件及格式的重复排列不恢复；部分边界按实际改动专项验证，外部条件单列。具体依据由去留表和 D 报告承载。

这不是 92 项逐条 mutation，也不证明全部旧断言等价覆盖。旧入口数、新场景数及不同分组粒度不能直接换算覆盖率。已删除 35 个旧 Playwright 配置、随后合并新增重复配置，清理无消费者替身页面/服务、专属依赖和仅由旧测试使用的内部导出；固定输入与冻结兼容源码仍保留。

## 实际产品修复

| 真实失败 | 修复后行为与证据 |
| --- | --- |
| 题库两页编辑冲突后刷新，失去冲突处理入口 | `useQuestionSession.js` 从保留草稿基线与最新版本恢复冲突状态；实际两页路径红后绿 |
| 标签改名读回未完成时重新打开并保存，第二次 PUT 409 | `Exams.jsx` 在读回完成前禁用再次保存并忽略 Enter，保留新草稿；基线 CI trace 与受控迟延均复现，修复后 200 且刷新名称正确 |
| 日程仅横拖到次日，09:00 变为 08:55 | FullCalendar 命中格与 5 分钟 snap 对齐，同时保持时间轴比例及 15 分钟分隔；真实横拖、竖拖、75 分钟拉伸、新设备读回和系统时区变化通过 |
| 昵称修改成功，重叠读取全部 200 时仍误报结果待确认 | `AuthProvider.jsx` 区分返回已核实账户与发布资料权限；同会话迟到读取返回正确结果，身份代次/会话/资料版本保护仍有效，真实两页与换账户对照通过 |

这些修复均从用户可经历的 E2E 失败开始，保留红绿日志、请求及截图；没有通过放宽断言、增加重试或跳过用例隐藏失败。

## 审查、CI 与集成

- 原基线 [CI 40632221950](https://github.com/DingJWuyu/TeachBuddy/actions/runs/40632221950)：API 284 PASS（105.8 秒）、输出 51 PASS、浏览器 422 PASS / 1 FAIL / 2 skip（23.9 分钟），合计 757 PASS / 1 FAIL / 2 skip。失败为上表标签竞态；CI 外旧专项按去留表记录，不声称全部旧入口都运行过。
- 双轴初审发现并关闭四项：资源保存须独立设备读回、Node 失败现场须落在 CI 上传目录、答案 PNG 须与题干区别、数学覆盖声明须与实际用例一致。补充真实业务故障检出后，E/F 最终复核至 `63c348b8355d5071873cb9bf027d5c905261e060`，开放问题为 0。
- PR 首轮 [CI 40645528110](https://github.com/DingJWuyu/TeachBuddy/actions/runs/40645528110)：90 PASS / 2 FAIL / 0 skip。原卷 PNG 用例放在没有 bwrap 的 API job，移至已有沙箱准备的输出组并保留断言；日程拉伸落点越出日历裁剪区，改为居中真实滚动区、核对实际命中点并操作鼠标。两项均有定点红绿及增量双轴复核，不改产品预期、超时或重试。
- 首轮失败实际上传并下载 `ci-api-diagnostics-1`，确认保留 SQLite、两份原 PNG 及 `spawn /usr/bin/bwrap ENOENT` 日志，证明新的失败目录能进入云端现场包。
- 最终候选 `31b9515609b7852a23dfa7a37d7eb7e7bcc4ac6a` 相对已审 63c348b8 仅变更三份记录文档。[最终 CI 40649041101](https://github.com/DingJWuyu/TeachBuddy/actions/runs/40649041101) 全部通过，结果见上表。
- 合入前核对候选 SHA、trunk 和必需检查，通过匹配 SHA 的 squash 集成。合并提交 `fdf72f1b` 与最终 CI 候选文件树完全一致。
- 本机 preview 在停止自有服务后同步，`npm ci` 成功并重启；服务 active、health 为 ok。匿名登录实页在 1440×900 下核对，控制台无错误，五个受影响 Vite 模块 HTTP 200；未登录或修改私人业务数据。

## 证据与清理

入库回执与去留表在本目录 `test-suite-rebuild/`。原始日志、注入补丁、截图、trace、失败数据库/原件及三份自有 core 归档到 preview 的 `test-results/test-suite-rebuild/`，逐文件校验 SHA-256；该目录不是运行或新检出回归的依赖。

归档 `README.md` 映射已删除现场的原路径：总控证据在 `root/`，A/B/C 在 `author-a/`、`author-b/`、`author-c/`，D 在 `auditor-d/`，具名 `/tmp` 失败现场在 `external/`。`root/integration-receipt.json` 与 `cleanup-receipt.json` 保留最终集成和精确清理结果。阶段回执中的原工作树路径按此映射查证，固定源码仍可由 Git 及入库输入重建。

确认成果集成、工作树干净、执行者及服务停止使用后，已删除五个任务工作树、五个本地任务分支和 119 个确认归属的外部临时路径；远端任务分支在 PR 合并后已不存在。保留 `TeachBuddy` / main、`TeachBuddy-preview` / preview/integration 与既有 `TeachBuddy-resources` / feat/resources-core。`/tmp/rebuilt-business-Q8JUIj` 无法证明本任务归属，未读取或删除；系统管理的其他 core 亦未操作。

## 边界与后续

本机 D 实验出现三次 Node/V8 SIGSEGV，core 位于 V8 属性拦截、原型转换及编译路径，尚未定位根因。50 次 import、20 次串行实际场景和 3 并发共 90 进程未再现；后续有效消融及两轮云端 CI 均无同类异常。原始崩溃证据保留，既不计业务检出，也不声称已修复；再现时按入口和运行时证据接续，不以无界重跑、Node 参数、skip 或重试规避。

真实模型、GPU OCR、邮件投递、商店分发、目标设备、系统 IME 及 Word/WPS 人工编辑打印仍沿[运行台账](run-state.md#剩余事项)的具名边界另验。受控回放只证明消费者；当前 Word 生成器仅用于固定输入，不宣称存在当前产品 Word 导出能力。

本任务没有待实施、待审查或待集成项。后续改动从当前 trunk 开始，根据具体故障和使用结果选择必要保护，不因旧用例曾存在就恢复整套排列。
