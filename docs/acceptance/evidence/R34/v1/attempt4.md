# R34@1 attempt 4：默认输出分页修复

**R35-LOCAL-001 本轮切片 self PASS。** 默认四行练习仍为四页，末页承载第六题题图和完整作答空间，无纯空白页。完整 R34/R35、在线及 Windows/WPS 不据此放行。

```yaml
task: R34@1
attempt: 4
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T13:55:24Z"
session_id: "01a0c94b-7cc9-7a31-ae80-90cb75234fd9"
runner: "Codex / gpt-6-astra / low"
skills_used: [diagnosing-bugs, implement, writing-for-agents, code-review]
base_revision: "4611f6a752533214b9e64c1664cf68bdac9a1efb"
result_revision: "代码 00d1c5630f044c299dd5eeedadc81cff620aca63；完整候选为包含本回执的提交"
review_target:
  fixed_point: "4611f6a752533214b9e64c1664cf68bdac9a1efb"
  commit_range: "4611f6a752533214b9e64c1664cf68bdac9a1efb...00d1c5630f044c299dd5eeedadc81cff620aca63"
  standards: PASS
  spec: PASS
  aggregate: "attempt4/review.md"
internal_reviewers:
  - "Standards / Codex gpt-6-astra low / inherited / read-only leaf"
  - "Spec / Codex gpt-6-astra low / inherited / read-only leaf"
identity_mode: "real-auth / copied retained database / fresh UI login"
failure_owner: null
next_condition: "根安排固定完整候选的独立默认输出复验；运行入口见 integration4.md"
authorization_used: "本轮用户派发：仅 lessons 输出修复、专属回归/证据、任务分支提交；不合 main/push/部署/在线"
```

## 固定输入与诊断

产品输入 `6398bf2dae85d1872c929aa8ef32d5705d763687`（产品 `a0bde5546eeedf50498888da0ed9c5941fa1d76a`）；缺陷输入为 `4c4b68965e3226e5d66bf8f16ad5f390541cb2da:docs/acceptance/evidence/R35/v1/local-review.md` 的 R35-LOCAL-001、`local/output-lesson.json` 和原始 PDF/DOCX。来源 `/home/liam_t/项目/TeacherWorkspace-r35-local` 停写且本轮只读，收尾 tracked status 为空。

先查看原 PDF 第四页，再将保留库复制到自己的 `/tmp/teacher-r34-attempt4`，通过真实登录和浏览器“输出 → 练习 → PDF”复现。未修改默认四行、答案/注记关闭或备用排除选项。权威红灯为 [red-confirmed](attempt4/red-confirmed/result.json)：本次新受理版本 8 的新文件四页，第 4 页像素全白；[断言日志](attempt4/red-confirmed.log)退出 1。最终代码重新启动后，同一入口 [ui-final-candidate](attempt4/ui-final-candidate/result.json)退出 0，四页无纯白页。每份受理记录、实际下载 PDF、页图和浏览器截图在对应目录。

收敛后的快速循环是 `lessons-pagination/render.mjs`：固定 R35 保存版本 7 文稿及三张真实图，直接经过产品过滤树、DOCX 生成及真实隔离 Office 转换。原版 [render-red](attempt4/render-red/result.json) 同样四页/第 4 页全白，最终 [render-final](attempt4/render-final/result.json) 无纯白。移除第六题的对照不再失败，说明本例承载条件是累计页高与题尾作答空间；保留完整六题作为稳定回归，未把对照样本改成产品输入。

验证的假设依次为：空段落单独溢出、显式分页/节属性、转换器尾段差异。DOCX 无额外分页符，Writer 与 PDF 同样复现；[Office 原版布局](attempt4/office-red-verified/layout.json)定位到第六题四个空段落分布为 `[3,3,3,4]`。根因是独立空段落没有与题末保持连续的分页约束。

## 实现与结果

唯一产品修改为 `apps/api/src/modules/lessons/output.js`。题末与最初最多四行作答区保持连续，列表和表格把该关系传给末尾段落；更多空行仍自然分页。A4 可用高约 257 mm，最大输出图 650 px 约 172 mm，本机四空行约 44 mm，短作答区与最大图合计约 216 mm。没有缩图、减字号、缩行高/段距、删除页或丢弃内容。

[空间对比](attempt4/space-comparison.json)证明六题仍有 24 个空段落，Office 实际行高/段距一致；默认 DOCX 正文 XML 移除 `keepNext` 后逐字相同。修复后第六题题图和四行空间同在第四页，题文继续保留在第三页。未承诺压成三页或整题强制同页。

| 检查 | self 结果与证据 |
| --- | --- |
| 实际用户入口红绿 | `red-confirmed` FAIL → `ui-final-candidate` PASS；真实 Cookie/page-bound 登录，新建浏览器 context，隔离端口 49644。 |
| 受影响 DOCX/PDF | UI 练习 DOCX：[ui-docx-final](attempt4/ui-docx-final/result.json)；讲义 PDF/DOCX：[ui-handout-pdf](attempt4/ui-handout-pdf/result.json)、[ui-handout-docx](attempt4/ui-handout-docx/result.json)。实际下载并渲染，各四页无全白页。 |
| 内容及过滤 | [matrix.log](attempt4/matrix.log)：练习/讲义各 00、01、10、11，共八组 DOCX及实际转换PDF。六题编号、三图、至少17个正文OMML、24作答段落、答案与教师块/本课备注开关、备用排除均断言；OOXML/PDF文本同时检查。对应 `matrix-*` 保存全部页图；默认及开启答案/注记的分页、公式、图已查看。 |
| 真实 Office | [练习](attempt4/office-practice-verified/print-preview.png)、[讲义](attempt4/office-handout-verified/print-preview.png)：独立 Xvfb/Writer 打开真实 UI DOCX，经 UNO 触发打印预览并重导 PDF，`layout.json` 保留实际段落/公式/图片布局。只读检查，不重复旧公式编辑实验。 |
| 短/长空间边界 | 最终 0 行2页、1行3页，无纯白，分别保留0/6空段落。20行与 fixed point 同为8页、第8页全白，120空段落完整，见 `lines20-baseline` / `lines20-final`；不将此既存长空间问题写为已修复。 |
| API/构建 | [api-final.log](attempt4/api-final.log)：materials-lessons + materials-integration 10/10，通过既有24输出过滤/隔离/固定快照链；[build-final.log](attempt4/build-final.log)通过，保留既有 >500 kB chunk 提示。未重跑共享 math 迁移或 C21/C22整套实验。 |
| 内部审查 | [review](attempt4/review.md)：Standards PASS、Spec PASS；长空间曾出现的新增页数退化已在最终代码关闭。 |

## 证据边界与未决条件

- real-auth 指真实登录、Cookie、页面绑定和真实输出 API；数据来自 R35 停写保留库的独立副本，不是本轮重新注册。原账号由 fake-mail 注册，HTTPS 自签；未证明外发邮件或公开部署。
- 真实 Linux LibreOffice 26.8.0.3、Chrome 152、Node 22.23.2。Windows Word/WPS、目标设备打印未执行，不代签。沿用 R35 无关已通过项，不扩大本轮结论。
- 显式20行仍有既存纯白作答尾页，归 R34 后续非默认分页评估；最终修复不增加该样本页数/白页。默认缺陷关闭仍待根安排 independent 复验。
- 零产品模型请求、零产品模型密钥读取，无 Provider 成功替身。共享运行生命周期、math测试、锁/目录及其他业务/契约只消费固定产品，未修订，旧共享问题由外层既定拥有者处理。
- 初版浏览器采集曾在历史列表加载前误取旧文件，随后改为先核对历史条数、等待新增条目；正式红绿用该修正脚本重新执行。空白页使用渲染像素而非纯文本判断，图像页不误报。Office 首次向导/残留本轮锁遮挡的截图不作有效打印预览证据，最终 `*-verified` 已重新采集。
- 未解决边界仍在，保留本轮运行库、失败制品和调试进度 `/tmp/teacher-r34-attempt4-debug`；认证状态/数据库不提交。正式制品校验值见 `attempt4/manifest.json`。
- 收尾只停止本轮服务、浏览器和 Office/Xvfb，保留数据及证据，提交后停写。未合 main、push、部署、扩派业务 session、联系其他业务 session 或重开在线；外层唯一通知。
