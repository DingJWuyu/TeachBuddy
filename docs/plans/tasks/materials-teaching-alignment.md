# 丰富题目关联教学记录实施短包

状态：等待根限定冻结与派发，尚未实施。不新增 DAG 节点；本包只描述下一次有界实现和验收所需输入。设计唯一增量见[接缝提案](../../contracts/materials-teaching-alignment.md)，全部固定来源与当前结果见[作者回执](../../acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/author.md)。

## 启动输入

- 根固定本设计提交及限定冻结结果后，明确实现候选、唯一写者与授权；作者 self 不是冻结。
- 产品/证据起点：`4b5c31e6e67543a2826f662ff07acc19a0de765f`，产品 `909693a7cc67f50a523ea94864ef7b80a345d5df`，只读来源 `/home/liam_t/项目/TeacherWorkspace-m43`。从自己的 main 创建任务分支，在隔离组合中消费该固定产品，记录每项集成 SHA；不直接在只读源或 main 开发。
- 必读该候选 `M43/v1/author.md`、`question-link-open.json`、`integration.md`；本提案；固定材料 `materials.md`的兼容节、`arch/materials.md`的题目端口及 OpenAPI 对应操作/schema；固定 T50 记录语义和数学扩展的兼容/失败节。来源 SHA 只取作者回执表，不跟分支 HEAD。
- 按派发时 main 的执行协议 `#implementation`、`#ownership`、`#receipt` 和设计验证规则执行。建议实现路由为当前协议的 Codex `gpt-6-astra low`；实际模型/effort 由根派发固定并记录，停用 dsh。业务 session 不互聊、不扩派。

## 工作与所有权

只派一个有界实现/装配写者，在相同固定候选串联前后端，避免为几处依赖切换拆并行写者。

| 范围 | 责任与允许动作 |
| --- | --- |
| `apps/api/src/modules/classes/`、`apps/web/src/features/classes/` | 教学消费者拥有者：升级题目选择器与同步读取端口，覆盖记录完整投影；保留 classes v2 和旧路径规则、事务、原键恢复及原草稿。 |
| `apps/web/src/features/questions/` | 材料页面装配由同一写者负责：现成 classes 反馈接入真实丰富题目详情，稳定打开/返回当前记录，保留材料页面自己的草稿/取材/原稿能力。服务端题目端口已存在，不重写 questions 存储或新增端口。 |
| `packages/shared/src/moduleCatalog.js` | 同一写者独占：仅按提案替换 classes 题目依赖，原 v3 映射可复用；实际目录是运行唯一来源。 |
| `apps/web/src/features/workbench/WorkbenchApp.jsx`、`shellContext.js`、`routes.js` | 仅在完成题目/记录往返所需时由同一写者串行接手，沿用既有现场存储/导航，保留原数学与备课往返。不新建通用导航框架。 |
| API/Web 公开接口与 E2E 测试 | 同一写者维护本次独占测试/fixtures；如需改 `apps/api/test/teaching-time-classes*` 或现有 math-integration fixture/config，须根交付对应固定文件的单写权。旧日志和证据不覆盖。 |
| 其他共享入口、迁移 runner、锁文件 | 本提案不要求修改。真实端口已装配，不新增迁移或依赖。只有具体实现证据证明必须修改时，由根明确实际路径及唯一接手者；不能顺带改 schedule/math/认证或旧迁移。 |

产品问题责任为教学消费者升级与材料页装配；旧题目端口422符合材料契约，不能通过放松守卫修复。若已有 v2 提供方违反冻结返回或生命周期，保留最小复现交根按提供方归属处理，不临时改公共契约。

## 自验与交回

1. 先在本任务隔离副本沿 M43 `integration.md` 的真实认证/manual fixture 复现“班级记录 → 关联资料 → 题目”的旧422，保存实际网络响应和界面证据。以本次独占证据路径记录；不运行会覆盖旧 R33/R34 证据的继承测试。不得调用产品模型，测试数据可通过真实题库操作或固定持久 fixture 准备并标明来源。
2. 冻结后一次接通选择、保存、详情/列表、来源打开/返回与反向记录。执行提案 WB-MTA001-007：公开 HTTP 验证错误与事务，真实浏览器验证丰富内容、两班和现场，真实 math 提供方验证混合来源，不以 UI 单元测试或占位作品替代。
3. 用旧候选建立的保留库副本验证升级/重启：已存题目、记录及关联、首次标题、旧成功回执、数学作品/引用不丢失；记录本次正常写入与纯读分别允许的变化。源库只读。运行适当构建和定向 API/E2E 检查；只有出现具体新风险才扩大回归。
4. 提交固定新候选、实际测试命令/结果、证据索引、目录唯一差异、已知未决项及责任。建议实现证据目录 `docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/implementation/`（待生成）。结果仅 self，交外层通知后停写，不合 main/push/部署。

## 独立验收入口

根指定验收者，在新固定产品与独立数据副本复跑 WB-MTA001-007，重点确认老师能真正选丰富题、保存、刷新/重启、打开来源返回、查看两班记录；记录 API 和实际页面均成功才关闭原 M43 题目关联缺口。建议独立证据目录 `docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/independent/`（待生成）。

原 WB-T003/017/018 与 WB-TM002/005-009 仅重跑受影响的题目/混合来源切片；材料侧补新版题目阅读/保存与目录装配，数学侧补真实混合记录与往返。原 M44、R35 正在进行的固定候选验收继续，不能被本包切换；新组合的接缝 PASS 不替代完整 T54/WB-T020、R35/M44 或目标设备门槛。
