# R33@1 attempt 4 本地接续回执

**结果：本次 questions 本地修复与定向验证通过（self）；最终全 API 为 209/211，两项共享范围 `fetch failed`，因此整体验证 FAIL。完整 R33 在线能力仍 BLOCKED。** 不重开在线路线，不重评分旧样本。

```yaml
task: R33@1
attempt: 4
role: implement
status: FAIL
verification_level: self
finished_at_utc: "2026-09-22 13:16:24 UTC"
session_id: "01a0c92c-d458-7810-ab1e-dd642ce89558"
runner: "Codex / gpt-6-astra / low"
skills_used: [implement, diagnosing-bugs, tdd, codebase-design, writing-for-agents, code-review]
base_revision: "598209b94c13e3f345638de298b0928388b3f9c6"
result_revision: "812da1091724d5536eb4a3fbcf2c47033fa64555 + docs/acceptance/evidence/R33/v1/attempt4.md"
review_target:
  fixed_point: "b938e473c45ca49fc2ae17fdd39c32815e2ec80b"
  commit_range: "b938e473c45ca49fc2ae17fdd39c32815e2ec80b...0675ef56f2425de6b020c73b7940d974a1fa7e58"
  standards: PASS
  spec: "FAIL: 2 P2; fixed and closed by author self verification at 812da109"
  aggregate: "attempt4/internal-review.md"
internal_reviewers:
  - "standards_review; inherited Codex / gpt-6-astra / low; read-only leaf"
  - "spec_review; inherited Codex / gpt-6-astra / low; read-only leaf"
identity_mode: "test-principal for scoped HTTP/UI; full suite contains existing real-auth and substitutes"
failure_owner: "shared runtime/restart owner via root; online route remains C20/R30/R33/EMODEL"
authorization_used: "本 session 用户 R33@1 attempt 4 零请求、限定 questions 写权、任务分支提交授权"
next_condition: "根处理共享失败后固定新的组合候选；本地复现见 integration4.md。完整在线另需新依据和有界授权。"
```

## 固定输入与实际变更

组合过程和启动入口由 [integration4](integration4.md) 拥有。实际消费 P=`6398bf2dae85d1872c929aa8ef32d5705d763687`（产品 `a0bde5546eeedf50498888da0ed9c5941fa1d76a`）、F=`8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1`、T=`43b117c7ed6fe5aa408422351db46e23a6ea6f3e`，设计 `da23eb680a9c8b214ad18482d4f1fbc8a5f3fded` 的接续文档已在 main。旧 O 路线和响应只按设计固定表读取，精确 fixture 来源/哈希见 [replay-sources](attempt4/replay-sources.json)。未读取 reasoning 正文、产品密钥或活动业务分支。

实现变更仅为：

- `apps/api/src/modules/questions/extraction{,-fragments,-figures}.js`：正文 fragments 适配、有效完整前缀、选页集合持久归并、双向唯一答案/续文、机器/人工投影分离、本原 PDF 文字锚点及实际页图裁图。
- `apps/web/src/features/questions/{OriginalPane,MaterialsQuestionsPage}.jsx`：题面/答案/配图来源具名，独立导航与答案重框用途，重框保留其他页的位置。
- `apps/api/test/materials-questions-fragments.test.js`、questions 专属 E2E/config/fixture，以及本 attempt 的三处获准 evidence 路径。无公共 schema、目录、锁、共享生命周期、其他业务或旧迁移修改。

不需要新增迁移：新增内部字段保存在 questions 已有任务 JSON，公共 Import/Draft/Document/Location/Job 形状不变。没有 README 的额外写权；当前主干公开状态保持原样。

## 已关闭的本地行为

| 行为 | 实际证据与边界 |
| --- | --- |
| fragments 不再丢失 | 先真实上传两原图并创建 import，原候选 0 道、预期 1 道，`red-http.log`；修复后产生独立题面/答案来源。只读取正文，截断 Q3 不补括号、不造 Q4。 |
| 实际选页集合归并 | 题号、非空章节/组别、明确续文和双向唯一性共同约束；重复编号/多答案留未分配，缺页保持 unresolved。真实 E 原件只选 `[8,7]`，输出按原顺序定位 7/8，正文是明确标记的合成控制流。 |
| 答案状态 | 选页未完成不推断 absent；疑点或不完整的“未提供答案”仍 unresolved，唯一无疑点且全集完成的声明才采纳。原生重复题号答案也保持疑点。 |
| 自身图资产 | 本次上传 P 的页图重新检测/裁剪，HTTP 下载字节与该页框裁图一致；`own-pdf-crop.png` 目视保留图及标签，源图点线不一致原样保留。多列/同高归属或无锚点保持 missing-figure，未把图描述算提图。 |
| 重试和人工保护 | 成功页不重发；按 import+输入单元+片段稳定身份更新机器投影；人工标题/答案状态原样保留，新增机器候选另列，重启 GET 一致。相同原文第二次 import 的 ID 独立。 |
| 停止/迟到/校对 | 原受影响浏览器场景通过取消后迟到结果忽略、明确重试及人工校对保留；部分入库、拆合/忽略/补原稿/刷新沿既有用例回归。 |
| 独立定位 UI | 新浏览器通过真实上传、题面/答案各自文件导航、保存/刷新；1440/1280/1024 截图和无横向溢出断言通过。1024 使用原有双标签布局。 |

## 三类证据分别解释

| 类型 | 内容 | 不能支持的结论 |
| --- | --- | --- |
| 真实原生/保留链 | 固定 T/W 通过真实 HTTP/UI，公式编辑保存刷新；F 损坏 PDF 可保留下载重试。`native-preservation.json` 核对本轮六题与固定 attempt2 内容一致（W 仅新资产 ID 不同）；T 三个缺图疑点仍 open。新结果在 `inherited-test-artifacts/R33/v1/attempt2/`。 | T 图项不适用，不能记提图成功；T/W 无新模型调用，不能证明 P/I/PS/E 在线。F 只是失败保留，不是识别成功。 |
| 旧响应重放 | O 固定页2正文及自身页图进入当前真实上传/Job 链，保留完整 other 前缀和截断原文，0 道凭空题目；旧 B Adapter 回归另在继承测试制品。`old-response-replay.json`。 | 不构成新响应或新在线得分，O 的技术 FAIL 不变。 |
| 合成控制流 | 唯一/歧义/续文/缺页/明确缺答、重试人工保护、双栏图拒绝；E 真实 7/8 页承载合成正文；P 本原件图与合成 label 对应。`fragments-http.log`、`review-{red,green}.log`、`browser-synthetic.json`。 | 合成答案不作质量真值；PDF裁图证明自身来源链，不证明新在线数学提取。浏览器用 O 页图作上传载体，正文是合成片段。 |

T 按固定 T 裁决记录：边界与已提供正文保留均 6/6，图项不适用，Q2/Q5/Q6 缺图阻断保持；旧联合 3/6 与旧 FAIL 原字节不改。W 当前六题内容及自身内嵌图链保留，原 6/6 self 不升级为 independent。P/I/PS/E 新在线分子/分母：**未执行，不计新分数**。

## 检查结果

| 检查 | 结果/证据 |
| --- | --- |
| 受影响 questions API | 初轮 22/22；新片段最终定向 10/10，`questions-api.log`、`review-green.log`。最终全量中的所有 questions 用例通过。 |
| 原包 questions E2E | 原 19 场景首轮 18 通过，T 保存暴露作用域缺陷；修复后 T/W 两项通过，`browser-native-first.log`、`browser-quality.log`。未掩盖首次失败。 |
| 新 fragments E2E | 1/1，`browser-fragments.log`；测试端口错误修正单列 `browser-fragments-harness-red.log`。 |
| 全 API | 修复后中间候选曾 209/209，`api-final.log`；**最终候选 209/211 FAIL**，`api-reviewed.log`。失败为 resources `MC13-15`（`materials-resources.test.js:229`）和 math 保留库两次重启（`math-static-migration.test.js:8`），均 `fetch failed`。不修改只读文件、不把重跑绿当共享异常关闭。 |
| 构建 | `npm run build` 通过，`build-reviewed.log`；已有 bundle 大小提示保留。 |
| 内部双轴 review | Standards PASS；Spec 2 项 P2，真实 HTTP 红后修复，10/10 关闭 self。完整报告 `internal-review.md`，不是独立产品验收。 |
| 旧字节保护 | 旧 evidence 全部从事先备份恢复并逐文件比较，新生成物分离；`old-evidence-preserved.json`。AGENTS/run-state/提案保持组合前内容。 |

## 完整 R33 仍缺的条件

1. 最终全 API 的两项共享 `fetch failed` 由根分配既有共享运行/重启写者处理；本 session 没有联系该写者，也不读取其活动分支。本候选不能宣称全 API/保留库重启完整 PASS。
2. I/PS 无可核验本地文字锚点时，图归属保持阻断；本轮没有把旧实验 OCR 环境或旧题图偷接成产品依赖。需要继续本地扩展时由根固定可用 OCR/布局能力和共享依赖写权，仍须自身输入证明，不免除图质量。
3. 完整 P/I/PS/E 和真实教师材料仍须新路线依据与有界产品请求授权、精确请求清单/预算/受控注入；当前网络 Provider 未装配。依据至少为同 Provider 精确 ID 的有效控制证据，或不同方法在相近自身数学图文输入上的可审计成功证据，再交 C20/R30 裁决。不能只靠参数枚举/型号广告重开窗口。
4. 后续按原包补各入口 ≥5/6 边界、≥4/6 主要内容，E ≥2/3，七项适用质量、真实保存入库及 R35 independent。目标 Word/WPS/设备等继续归原拥有者；本次 Linux 浏览器不代签。

新增产品模型请求 **0**、密钥读取 **0**、新增费用授权 **0**。旧账不重置：19 次、16 份 usage、108777 已知 completion、历史三份 usage 缺失及 online-1 8000 未知预留照旧；不是完整费用总额。

仅任务分支提交。服务及浏览器结束，未完成现场、数据库、备份和失败证据保留；不合 main、push、部署，不扩派业务 session。外层唯一回调。
