# C20/v1 独立实验设计审查

```yaml
task: C20-REVIEW@1
attempt: 1
role: design-review
status: PASS
verification_level: independent
finished_at_utc: "2026-09-21 19:54:45 UTC"
session_id: unavailable
runner: "Codex Sol high（按本任务派发）"
skills_used: [writing-for-agents]
base_revision: "0ff698b6117fd4473d801d4817f70acb1fd3a7ef"
result_revision: "cff6f97aa0488dbfdd2e30d0e14ad35b064f040b：固定受审设计"
author_receipt: "85c1af8f7a24ec700d53490246f3607a1706626c:docs/acceptance/evidence/C20/v1/author.md"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
changed_files:
  - docs/acceptance/evidence/C20/v1/review.md
must_fix: []
identity_mode: "不适用：本次仅审查实验设计；C24 真业务切片使用 B16 的受信 test-principal，不代签 real-auth"
failure_owner: null
authorization_used: "用户 C20-REVIEW@1 / attempt 1：独立 Sol high 实验设计审查；仅可写并提交本报告"
```

## 结论

PASS。固定候选 `cff6f97aa0488dbfdd2e30d0e14ad35b064f040b` 可交独立实验者执行。C21-C24 均有不超过两条的固定候选、可物化或已可取得的样本、可观察的通过/失败条件、有界复测规则和证据交付要求。未发现会使实验者必须猜测产品决定、临时增加第三条路线或降低标准的缺口。

可立即放行 C21、C22、C23；C24 可立即放行 PI-01/PI-02 前置探针，PI-03/PI-04 只在 B16 固定真实业务服务、页面、运行回执和受信测试身份后执行。C24 在 PI-03/PI-04 完成前不得整体 PASS。同时放行 T50 班级教学与日程设计，T50 只消费本包的风险与环境边界，不需等待 C21-C24 实验结果或 B16。

## 独立核验

| 实验 | 候选与样本 | 可观察判定 | 执行条件与结论 |
| --- | --- | --- | --- |
| C21 提取 | A 为原生读取+本地 OCR+允许模型整理，B 为 DeepSeek 视觉提取。T/W/P/I/PS 固定六题，E 覆盖真实跨页、表格和配图，F 覆盖缺字与损坏文件。 | EX-01 至 EX-04 分别检查拆题分子/分母、七项内容、真实版式和失败继续；机器原分与校对后结果分开。 | 自编样本可由冻结内容物化；E 已独立按请求条件取得，SHA-256 为 `b8d34a6aa76a59adfee125c8efb0a12620dffbb797666cbcc6c41b07390d082a`。免费本地依赖安装属实验准备；模型注入不可取时只阻塞模型切片。 |
| C22 Office | A 为 Pandoc+LibreOffice，B 为 docx.js+LibreOffice。O-W/O-S 覆盖新旧 Word/PPT，O-L/O-H/O-X 覆盖三类成果、学生/教师版和多页公式。 | OF-01 至 OF-04 要求逐页真预览、在真编辑器中修改文字与公式后保存重开、检查打印分页，并保留转换失败的原件和重试证据。 | 本机需在隔离目录安装免费转换器/编辑器，安装成功后可执行。Linux/LibreOffice 实测不代签 Windows/WPS，但后者待测不阻止当前本机路线实验。 |
| C23 数学 | A 为本地 MathJax SVG+原生 SVG/JS，B 为 MathJax+JSXGraph。M-F/M-S/M-D/M-X 覆盖公式、函数/平面/立体静态图、参数/拖动/步骤交互和外部 AI HTML。 | MA-01 至 MA-05 检查保存、重开修改、PNG/SVG、真模型制作及禁网冷启动自由交互；截图/录像不代替操作。 | 本机 Chrome 和隔离依赖足以开始。Windows 教室设备与大陆三端网络结论后续单列，不扩大为当前本机实验的前置。 |
| C24 pi | A 为 pi 0.85.1+DeepSeek，B 为同 runtime/provider+GLM。P-Q/P-C/P-CONFLICT/P-FAIL 固定真查询、幂等复制、人工修改冲突和中断恢复。 | PI-01/02 只证许可、正常输出、无副作用工具循环和非法模型本地拒绝；PI-03/04 要求真页面与同一业务操作的唯一写入、冲突不覆盖、恢复不重复。 | B11 已冻结幂等、版本冲突、复制和可信 principal 接缝，所以 B16 交付后无需实验者改产品或直写数据库。PI-01/02 不能代替该真业务证据。 |

## 范围与依赖边界

- 产品范围保留：C21 失败也不删除四入口自动提取；C22 保留常见 Office 真预览、可编辑 Word 与可打印 PDF；C23 保留三类作品、真 AI 制作和无登录离线运行；C24 保留 pi 真模型对真业务的读写。两条候选都失败时回 C20，不以缩减 MVP 替代结论。
- 当前本机是技术路线实验环境，目标 Windows/WPS、课堂设备和大陆三端仍由 R35/M44/D72/D75 在相应阶段给出实测支持范围。这些未实测项不被误记为已通过，也不被误用为 C21-C23 的全局 BLOCKED。
- 模型凭据、额度和计费保持服务端注入与脱敏回执，实验者无需读取或复制密钥。注入入口真实不可取时，只把受影响的模型切片记为 BLOCKED，本地可做部分继续。
- 单进程 Node/Express、SQLite、持久目录、Office 转换子进程与备份/重启边界已给 D70 留出可执行的 A/B 交付路径，没有提前购买服务或引入新控制面。长期主机、HTTPS 和备份目标仍是 D70/D71 的外部条件，不阻止本批实验或 T50 设计。

## 本次检查

- 确认 HEAD `0ff698b6117fd4473d801d4817f70acb1fd3a7ef` 包含固定设计 `cff6f97aa0488dbfdd2e30d0e14ad35b064f040b` 和作者回执 `85c1af8f7a24ec700d53490246f3607a1706626c`，审查开始时工作树干净。
- 对照 `mvp-matrix` 的 design-review/experiments、C20 任务说明、B11 业务接缝及 `PRODUCT_SCOPE` 的题库、备课、数学工坊、资源预览、Agent 和基础交付要求逐项核对。
- 独立以普通浏览器 User-Agent 和文档给定 Referer 流式下载 E，校验 SHA-256 与冻结索引一致，未保留临时文件。
- `git diff --check b938f8af0b8152718f5063d4326d494bf8b5426c..85c1af8f7a24ec700d53490246f3607a1706626c` 通过。本次未运行产品、能力实验或模型调用。

## 下一步

外层可以本固定候选派发 C21-C23 和 T50。C24 先执行 PI-01/PI-02 并保留分片回执，收到 B16 固定运行回执后再用同一 C24 候选完成 PI-03/PI-04，之后交 C25 独立复核。
