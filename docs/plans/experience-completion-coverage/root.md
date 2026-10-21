# 总控跨模块与反向核对

阶段 B 固定基线 `ddc2f3d1`；职责及版本沿[当前任务](../experience-completion-audit.md)。本清单补充分区清单的组合，不能替代分区操作。总控唯一维护，运行证据在 `test-results/experience-completion/root/`；隔离真实认证、假邮件、独立 SQLite 和浏览器，不操作用户实例。

| ID | 入口与完整序列 | 源码依据 | 当前状态 |
| --- | --- | --- | --- |
| ROOT-01 | 新账户载入示例；依次进入五模块、打开助理、换模块、返回首页/支持再返回，观察主卡片与右栏、对话和原现场 | WorkbenchApp 的 route/page/panelOpen、modulePaths，chrome/Home、AuxiliaryPanel | 五模块、右栏覆盖、首页及支持往返通过；journey-results.json、cross-*.png |
| ROOT-02 | 题目编辑保持未保存正文，以 @ 加入已保存引用，在首页继续输入；返回题库，保存后刷新，再核对草稿和引用身份 | AgentProvider、questions/useQuestionSession、platform/device/useScene | 通过；journey.mjs、journey-results.json、cross-question-persisted.png；保存题目和助理草稿均真实读回 |
| ROOT-03 | 资源查看指定页及备注，进入助理引用再去日程，回到资源核对选择/页码/正文现场；通知定位由共享/日程线互证 | 资源深链、Notifications、workbench/routes、useScene | 通过；cross-remaining-results.json、cross-preferences-results.json及分区回执，具体操作见下文 |
| ROOT-04 | 资源页打开并取消全局搜索，再经支持进入帮助后返回；核对归焦与资源现场。窄屏侧栏和助理互切复用本轮共享线证据 | Topbar、SupportMenu、components/ui 实际消费者 | 通过；cross-remaining-results.json、cross-preferences-results.json及分区回执，具体操作见下文 |
| ROOT-05 | 账户偏好切语言/主题后返回资源详情；刷新核对真实偏好、页码与备注，教师原文不被翻译 | usePreferences、WorkbenchApp、i18n/presentation、公共 portal 样式 | 通过；cross-remaining-results.json、cross-preferences-results.json及分区回执，具体操作见下文 |
| ROOT-06 | 每条分区清单从当前源码反向找未归属入口、条件和调用者；与上轮清单比较补漏，新发现沿根因归属 | 模块根页、交互组件和路由注册，设计输入 | 已逐线反查入口、条件和消费者；正常路径缺口已退回各线补实际操作，新缺陷全部按根因归属。最终候选已完成 Standards/Spec 独立审查和增量补审，无开放发现 |

## 发现与收口

阶段 A 的七项已裁决问题不重复计数。分区发现按唯一根因归属，公共修复由总控实施；没有确认的缺口不得仅凭源码猜测计入产品问题。

共享外壳的四项已由 sweep_shell 在双端实际触发，总控唯一修复：分组菜单 Escape 归焦、多选筛选 Escape 归焦、减少动效时侧栏仍滑动、英文窄屏错误显示顶栏入口。前两项新增回归基线明确失败、候选通过，证据 shared-red/filter-red/shared-green；后两项已通过 chrome-green 定点。资源归档取消的退出延迟归焦交资源唯一写者，按上轮共享确认根因的遗漏消费者归并。

跨模块实操：真实资源 PDF 第2页与教师备注，添加助理引用后切日程、返回、刷新，页码、备注和助理草稿均保留；全局搜索取消归焦、支持帮助往返保留资源现场。切英文/深色后刷新，原有中文备注保持教师原文。证据 `cross-remaining.mjs`、`cross-remaining-results.json`、`cross-preferences.mjs`、`cross-preferences-results.json` 及 `cross-resource-english-dark.png`。窄屏侧栏/助理与通知定位分别复用 shell/schedule 的本轮真实路径，不声称组合之外的全部路径均已测试。

共享修复最终定点：`shared-final.log` 五项通过，覆盖解散归焦、筛选归焦、拖动取消后正常保存、窄屏初次引导及已有学期删除二次确认；此前减少动效和双语窄屏两项沿 `chrome-green.log`。日程 Enter 规则回退由日程线计数并使用现有两条实际失败用例验证，不改既有期望来迁就代码。
