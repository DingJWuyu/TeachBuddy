# R31-MATH-SUPPORT attempt 2 回执

**PASS / self，仅限固定组合与公共装配。** 公共产品候选 `7c6e7ade69a7e86cbfd8212def7a5620e8d857d6` 包含现有 M41 原生图形、完整 R31/A11 支持、本地数学依赖和可运行的隔离静态映射。共同构建缺口已关闭，三个 math 业务目录原样保留。公式、业务 transport 与完整 MC09 仍归 M41，不能签完整 M41 PASS 或放行 M42/M43。

完整输入、组合方式及最短运行路径见 [integration2.md](integration2.md)。旧 author/integration 及 M41 原报告均保留原文；本报告不改写旧证据的版本或结论。

```yaml
task: R31-MATH-SUPPORT@1
revision: 1
attempt: 2
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T09:07:25Z"
session_id: "01a0c853-90e4-7e93-b1a0-f760a898c7fb"
runner: "Codex CLI / gpt-6-astra / low；内部助手继承"
skills_used: [implement, diagnosing-bugs, writing-for-agents, code-review]
base_revision: "0a1b432cb4f56a94ac242114f535936e6176bf17"
composition_base: "4f0d6a9c9c28386297302b48c55bd6f82b4fb317"
product_revision: "7c6e7ade69a7e86cbfd8212def7a5620e8d857d6"
result_revision: "本报告所在证据提交:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/attempt2.md；完整组合SHA随最终回复固定"
review_target:
  fixed_point: "4f0d6a9c9c28386297302b48c55bd6f82b4fb317"
  commit_range: "4f0d6a9c9c28386297302b48c55bd6f82b4fb317...7c6e7ade69a7e86cbfd8212def7a5620e8d857d6"
  standards: PASS
  spec: PASS
  aggregate: "本报告 Standards / Spec 两节"
internal_reviewers:
  - "/root/standards_review：Standards，只读叶子，继承 Codex gpt-6-astra low"
  - "/root/spec_review：Spec，只读叶子，继承 Codex gpt-6-astra low"
inputs: "integration2.md 固定输入表；按完整 Git SHA 消费"
changed_files: "attempt2/changed-files.json；组合引入清单见 attempt2/provenance.json"
artifacts: "attempt2/；摘要见 attempt2/sha256.json"
checks: "本报告实际验证表"
identity_mode: "real-auth / fake-mail / 自签HTTPS；M41旧fixture另为test-principal"
open_items:
  - "M41：公式业务实现、本地字体实际消费、mathRequest/导出下载页面transport、完整MC09及原包全项"
  - "原材料节点：四个真实handler与完整R31/R35；M43：正式目录v3和业务联动"
  - "认证/交付：真实邮件、目标设备、备份恢复撤销等原门禁"
failure_owner: null
next_condition: "外层交完整组合SHA，M41按integration2.md续作；本session交回即停止公共写入"
authorization_used: "用户 R31-MATH-SUPPORT@1 / attempt 2：本分支公共装配唯一写者、固定输入完整组合、公共修复与回归、必要证据和提交；源树/根台账只读，无main/push/部署/产品模型/新费用/业务session联系；唯一通知由外层负责"
```

## 实际变更与缺口闭合

组合基线完整引入公共支持，而非单摘 `07aeddc` 的最后差异，再加入固定 M41 全部增量。271 个引入路径均与至少一个指定源 Git blob 相同。24 项对象比较确认 math 三目录、原 fixture、两份旧报告、控制文档、认证内部、files/content、包锁和冻结契约原样；[provenance.json](attempt2/provenance.json) 给出对象与完整源 SHA。

在该基线上实际执行 `npm ci && npm run build`，重现 `apps/api/src/modules/math has no catalog mapping (unknown module ID)`。公共目录没有 math，API 默认实现映射也没有 math；Web MathWorkbench 只有业务导出，没有公共映射。通过显式 `mathSupportCatalog`、`mathSupportImplementations` 及 Web 页面映射补齐隔离组合，共同校验仍拒绝未知目录/缺入口，真实启动验证原工厂和迁移。

默认 questions/lessons 目录、版本、业务依赖与生产拒启均保持不变，符合限定提案的隔离目录例外。没有创建公式替身，没有改冻结契约，没有提前增加 lessons/classes/math 联动。公共支持 fixture 只验证接缝，其显示内容不作为数学业务完成证据。

## 实际验证

| 检查 | 实际结果 / 证据 |
| --- | --- |
| 干净安装 `npm ci` | PASS；[install.log](attempt2/install.log)，本树独立 node_modules。未使用源树依赖。 |
| 原故障 `npm run build` | 预期 FAIL；[build-red.log](attempt2/build-red.log)，与 M41 报告相同 catalog 错误。 |
| 修复后 `npm run build` | PASS；[build.log](attempt2/build.log)。共享目录列出 default 2 / isolated math 3，API 与 Web 构建通过。 |
| `node --test apps/api/test/r31-math-composition.test.js` | 1/1 PASS；[composition-api.log](attempt2/composition-api.log)。真实 A11 激活、缺页/陌生页401、跨账户404、native Work/File、成功重放、两次保留库重启/新页restore、原源与PNG字节及math_001账本不变、退出401。 |
| `npm run test:api` | 158/158 PASS；[common-api.log](attempt2/common-api.log)。含公共文件/内容/身份/事务/迁移、M41原API测试、新组合用例。此共同入口同时执行了继承认证contract测试，实际覆盖比必要公共接缝更宽；未据此重签A12，未运行完整旧认证浏览器验收。 |
| 公共浏览器 `npx playwright test --config apps/web/e2e/r31-math-support.config.mjs` | 2/2 PASS；[browser.log](attempt2/browser.log)。离线冷浏览器本地MathJax3.2.2/中文字体，零远程请求；真实A11+隔离math目录下上传/显示/原件下载字节一致、刷新新页面绑定、退出后拒绝。 |
| 原M41浏览器定向首条 `--grep 'blank canvas' --max-failures=1` | 1/1 PASS；[m41-browser-boundary.log](attempt2/m41-browser-boundary.log)，原fixture可运行；身份仍为test-principal。 |
| 原M41浏览器配置全8项 | 8/8 PASS；[m41-native-browser.log](attempt2/m41-native-browser.log)。仅原生切片组合回归，不外推公式或真实身份MC09。 |
| production配置调用createApp | 预期拒绝缺preview/extraction/export/question-asset；[production-refusal.log](attempt2/production-refusal.log)。拒绝仍在创建存储/监听之前，未部署。 |
| 本地资产摘要 | 111文件、26,883,364字节；[assets-sha256.json](attempt2/assets-sha256.json)。manifest/lock与完整支持产品逐字一致。 |
| `git diff --check`、输入/边界对象比较 | PASS。旧报告、根AGENTS/docs/plans、math业务目录及冻结契约均保留，见provenance。 |

已目检 [offline-assets.png](attempt2/offline-assets.png)：中文、根式、分式完整无裁切；[real-page-files.png](attempt2/real-page-files.png)：三个隔离模块名称、受保护图片和下载入口可见。页面身份观测只记录是否携带头，[page-files.json](attempt2/page-files.json) 不保存Cookie、验证码或完整页面ID；离线观测见 [offline-assets.json](attempt2/offline-assets.json)。

归档日志仅去除行尾空白，未改变结果内容。没有重跑材料实验或调用产品模型，没有新费用、真实邮件、目标设备或部署证据。构建有继承的大于500kB块提示，运行工具有NO_COLOR/FORCE_COLOR提示，均非构建/测试失败。仓库无独立lint/typecheck脚本。浏览器回归使用独立Playwright临时上下文，未操控已有材料校对页面。

## Standards

**PASS，0项硬违反，0项需处理smell。** 静态描述仍集中在moduleCatalog.js；隔离目录复用默认描述，Web/API仅维护代码映射，符合ADR0001。公共装配、验证脚本和认证fixture的修改在公共写权内，三个math业务目录未改。新增真实认证、文件归属、幂等及持久重启验证属于公共接缝集成测试，无UI单元测试。README明确候选能力、fake-mail边界及后续归属。隔离目录/映射/fixture参数均有当前消费需求，不构成Speculative Generality；投影映射是ADR所需，不构成需合并的Duplicated Code。

本结论仅覆盖已提交产品差异，不替代运行验收，随后编写的证据文档未纳入内部diff审查。

## Spec

**PASS，0项发现。** 隔离mathSupportCatalog和真实API工厂、迁移、Web页面满足必要静态目录映射、公共构建与接线；默认目录不变，符合提案“测试目录覆盖不是生产version=3注册”。三个math业务目录相对固定产品无差异，算法/公式/冻结契约未改，无M43联动。四handler拒启保留，未用占位模块绕过构建。新公共HTTPS回归覆盖真实激活/页面绑定/原生作品/文件/跨账户/重放/两次重启；README清楚保留M41公式、transport和完整MC09责任。

本结论是内部静态审查，不替代主session实际构建、浏览器结果或阶段独立验收。

两轴均审 `4f0d6a9...7c6e7ad`，Standards 0项、Spec 0项；聚合级别为self。

## 交回与保留边界

M41无须重建依赖组合，直接消费完整候选。旧fixture当前可运行；真实身份入口的具体适配点在 [integration2.md](integration2.md#m41-精确接续点)，包括mathRequest、下载fetch、AuthGate/transport与fixture本地资产复制。公共层不吸收这些数学业务适配。

本任务范围无未决公共契约冲突。公式实现/完整MC09归M41，正式材料能力与M43联动仍归原节点。完成后清理本次临时验证库、profile和可再生成产物，正式日志/截图/摘要保留；源树与其他任务现场未清理。本session提交回执后停止公共写入，不联系业务session，通知由外层完成。
