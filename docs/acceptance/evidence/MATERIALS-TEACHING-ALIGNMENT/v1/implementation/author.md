# MATERIALS-TEACHING-FIX@1 实现回执

**PASS / self**：已接通丰富题目选择、显式保存、记录完整投影、原记录往返和两班反馈。WB-MTA001-007 本地自验通过，内部 Standards 与 Spec 均 PASS。M43 题目关联的最终关闭仍须外层安排独立实测；不代签 M44/R35、完整教学或目标设备。

## 固定候选

| 项 | 值 |
| --- | --- |
| main 派生起点 | `5999a2fa58d9702aebd70945cc7bf1b664476a11` |
| 分支 | `fix/materials-teaching-links` |
| 组合 / 实现 fixed point | `2682475041aa187e3cd50ad743dc5e5bc243feda` |
| 产品提交 / 内部 review target | `72143e6b2d6a444057ae87fec801ca2b3d7ff0ad` |
| 含独立输出配置和补充断言的实现候选 | `6ab25c0e094e0ac58e4b50caa9a0d13a4b99167c`，相对产品提交只有三个测试文件变化 |
| 完整候选 | 本回执所在提交，由最终交回消息给出完整 SHA |
| 实现与内部助手 | Codex `gpt-6-astra low`；未使用 dsh、自动降级或业务 session 委派 |

固定消费：完整组合 `5da13ab3963a60948a69ae03ab5cf5f0988df13f`，产品 `2bdb865d6923e6aedb744d2f631ee5b5ef106541`，组合输入 `5de862e40ace52839df2be937459a9b76c050a7d`；契约与短包 `1a60db5a16860f5e411c59a3d4a7f4fdc17b751a`；独立冻结 `5548338514b7ead6a9374ee543fb7e2c08d357c0`。从具名对象组合，不跟随来源分支。新版 M43/R33 的题库修复保留，根 AGENTS、协议、台账、DAG 和旧证据保持 fixed point 字节，见 [integrity.json](integrity.json)。

## 实现边界

- classes 工厂与统一来源 reader 使用 `questions.readForReferenceV2`，覆盖保存、保留关联投影、详情、列表、删除恢复及反查；事务与首次标题规则沿原实现。questions 旧端口未改，未建教学专用题、迁移或依赖。
- 选择器使用题库 v2 列表，仅确认草稿，记录保存才写入。备课 v3、真实 math 来源和旧协议保护保持。
- 真实丰富题详情按当前 `value.id` 装配现有 `SourceRecordsPanel`，内部切题不串反馈。来源链接携带原记录路径，返回保留文字、日期、补充内容、AI 输入和滚动。
- classes 的局部滚动恢复等待异步记录编辑区就绪，解决实测 489 → 0 的返回丢失。题库复选框局部覆盖旧全局全宽样式，双视口不再换行错位。
- 目录只变 `classes.requires[0]`；`modulePorts` 映射、version=3、顺序和其他依赖不变。`workbench-catalog.test.js` 仅应用同一冻结覆盖层，旧全模块样本原字节不改。

## 红绿与实际验证

| 范围 | 实际结果与证据 |
| --- | --- |
| 原用户路径红灯 | 真实认证、独立 SQLite，班级记录 → 关联资料 → 题目请求旧 `/questions/items?state=active`，422 `/body/version / unsupported-content-version`。[网络](red-picker.json)、[截图](red-picker.png)、[失败断言](red-picker.log) |
| 仅选择器修复后的保存红灯 | 真实页面已能选择，但 POST classes v2 仍422，证明必须升级整个消费链。[响应](red-save.json)、[日志](red-save.log) |
| 往返滚动红绿 | 原测试收到 0，预期489；修复后精确489。[红灯](red-scroll.log)、[绿灯](scroll-verification.json)、[返回现场](record-return.png) |
| 公开 HTTP 与直接受影响 API | 30/30：教学全部定向24项、新材料接缝/保库3项、真实 math integration 3项。[日志](api-regression.log)。最终证据输出参数定向再验3/3：[日志](api-seam-final.log) |
| 目录与 R33 定向 HTTP | 16/16，其中目录8、R33既有修复8。[日志](catalog-r33.log) |
| 本次真实认证浏览器 | 2/2，最终含丰富题修改笔记后保存无损读回。[日志](browser-final.log)、[完整往返](browser-roundtrip.json)、[失败恢复](browser-recovery.json) |
| 原数学/备课受影响浏览器 | 3/3：指定环节往返与教学反馈，旧 v2 原路径确认，长文稿/选中环节/并发移除。[日志](math-browser.log) |
| R33 真实外壳浏览器 | 2/2：分类入口、AI现场、控件单行、保存刷新删除。[日志](r33-browser.log) |
| 生产构建 | `npm run build` PASS，仅保留既有大 chunk 提示。[日志](build.log)。项目未提供单独 lint/typecheck 脚本 |
| 独立手工入口 | 首次正常启动，`/api/health` 200，真实认证/固定纯文本导入，无模型 provider。[启动记录](manual.log) |
| 内部 code-review | Standards 0项，Spec 0项，两轴 PASS。[聚合](review.md) |

所有场景使用独立账户/数据库/随机端口；新增 HTTP 和主浏览器为 real-auth/fake-mail。继承教学/数学 API 的 test-principal 结果只用于其原回归边界。无产品模型请求、无产品密钥读取、无外部消息/发布。

### WB-MTA001-007

| ID | self 覆盖 |
| --- | --- |
| 001 | v1手工、丰富v2、正常文本导入确认、丰富复制同库；外账户不可见；搜索/取消/已选项失败重试；确认不写库，保存一条记录；浏览器请求 sources 只有 kind/id，首次标题来自服务器。[HTTP](http-rich.json)、[浏览器](browser-roundtrip.json) |
| 002 | 由 fixed point 旧产品真实建库，旧题同ID升级v2、记录纯读不升版，保留关联改文字与删除恢复各升一次；原成功键原体重放；两次重启保持题目、原记录、关联顺序、首次标题、数学作品/引用、文件与旧回执。[保库](retained.json) |
| 003 | 两班关联同一丰富题，另班为 question/lesson/math 混合记录；实际正文/答案/图片/表格/公式，打开不保存；编辑笔记显式保存后正文/答案/来源无损；原记录文字/日期/补充字段/AI/滚动恢复；题内切题反馈随真实题ID；真实数学往返。[桌面内容](rich-desktop.png)、[桌面反馈](feedback-desktop.png)、[平板反馈](feedback-tablet.png) |
| 004 | 成功 tombstone 保留关联；新连/移除后重连删除题409；记录删恢复、班级删除反馈过滤；提供方404/503整体失败，记录和成功回执回滚；选择失败保留选择，反馈失败保留已有记录并明确报错；删除题仍查看反馈。[HTTP](http-failure.json)、[浏览器](browser-recovery.json) |
| 005 | 已提交丢响应原键原体原路径确认一次，确认期间新草稿不被覆盖；并发409对照后新键保存；跨路径旧键409、无身份401、外账户404；浏览器401隐藏业务并锁定原账户草稿，恢复后草稿仍在。[冲突](conflict.png)、[身份锁定](identity-locked.png)、[恢复](browser-recovery.json) |
| 006 | 旧题目列表/详情/公共引用仍422；含真实math的旧classes详情、匹配列表、反查、写拒绝，版本冲突先409；旧成功回执先原样重放；新版完整读取。原数学/备课含旧v2确认回归通过。[HTTP](http-rich.json)、[教学回归](api-regression.log)、[浏览器回归](math-browser.log) |
| 007 | 与原目录样本只差classes题目依赖；缺新版端口工厂失败，无旧端口回退；三类反查完整返回混合记录；题目提供方404/503不阻断日程 `readRecord` 摘要。[HTTP](http-rich.json)、[失败注入](http-failure.json)、[目录回归](catalog-r33.log) |

保留库源与当前副本已放在 [retained/original](retained/original/) 和 [retained/candidate](retained/candidate/)，包含 SQLite 与文件，不包含测试 TLS 私钥。原始临时绝对路径仅为运行来源记录，正式复跑使用目录内副本或固定代码重建。纯读比较覆盖 question/classes/lesson/math 表、materials_files 与幂等账本；真实认证登录允许改认证会话，不计作业务数据变化。每个显式写入的版本断言和读取追踪见 retained.json。

## 运行条件与独立验收

具体命令、手工步骤、故障边界和隔离输出设置见 [README.md](README.md)。推荐新候选独立验收只复跑 WB-MTA001-007 及受影响切片，不重跑完整提取/Office实验或未变全范围验收。

本轮已处理的运行条件不作为产品缺陷：Chrome 长 TMPDIR 导致 socket 路径超限，改用短独占磁盘目录；隐藏 `.work` 运行副本导致 SPA 深链 sendFile 404，移到非隐藏副本后原数学三项通过。相关本地环境观察不关闭 M43 历史浏览器/fetch 条目。

继承数学 API 的五个导出文件曾写入旧 M43/output 路径，已将本次产物转存 [math-output](math-output/)，旧文件按 fixed point 逐字恢复；最终旧证据差异为空。后续独立运行必须遵守 README 的副本要求。

## 未决归属与停止点

- 本任务产品增量无未决项，verification_level=self。根指定独立验收实际复跑后，才能关闭 M43 题目关联 OPEN。
- 原历史 fetch/浏览器环境观察、真在线采集、完整 R35/M44/T51/T54/WB-T020、Windows/Edge、PowerPoint/WPS、真实邮件及目标物理设备仍由原拥有者/外层处理。本轮没有切换 M44 的旧 `4b5c31e` 输入或共用运行库。
- 本任务服务与浏览器已停止，无 main 合并、push、部署；正式证据与保留库留存，临时源码副本、日志副本、浏览器 profile 和数据库副本在完成后清理。最终消息是唯一回调，此后停写。

## 结构化回执

```yaml
task: MATERIALS-TEACHING-FIX@1
revision: 1
attempt: 1
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T17:08:23Z"
session_id: "01a0c9f9-6b66-7b12-a440-a7f61788dfb1"
runner: "Codex / gpt-6-astra / low"
skills_used: [implement, diagnosing-bugs, tdd, codebase-design, writing-for-agents, code-review]
base_revision: "5999a2fa58d9702aebd70945cc7bf1b664476a11"
composition_revision: "2682475041aa187e3cd50ad743dc5e5bc243feda"
product_revision: "72143e6b2d6a444057ae87fec801ca2b3d7ff0ad"
implementation_revision: "6ab25c0e094e0ac58e4b50caa9a0d13a4b99167c"
result_revision: "本回执所在完整提交 + docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/implementation/author.md；完整SHA由最终消息固定"
review_target:
  fixed_point: "2682475041aa187e3cd50ad743dc5e5bc243feda"
  commit_range: "2682475041aa187e3cd50ad743dc5e5bc243feda...72143e6b2d6a444057ae87fec801ca2b3d7ff0ad"
  standards: PASS
  spec: PASS
  aggregate: "docs/acceptance/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/implementation/review.md"
internal_reviewers:
  - "Standards / Codex / gpt-6-astra / low / /root/standards_review"
  - "Spec / Codex / gpt-6-astra / low / /root/spec_review"
inputs:
  - "5da13ab3963a60948a69ae03ab5cf5f0988df13f"
  - "2bdb865d6923e6aedb744d2f631ee5b5ef106541"
  - "5de862e40ace52839df2be937459a9b76c050a7d"
  - "1a60db5a16860f5e411c59a3d4a7f4fdc17b751a"
  - "5548338514b7ead6a9374ee543fb7e2c08d357c0"
changed_files: "git diff --name-only 2682475041aa187e3cd50ad743dc5e5bc243feda...HEAD；机器清单见 integrity.json"
artifacts: "本目录；逐文件SHA-256见 artifacts.json"
checks:
  - "WB-MTA001-007 HTTP/真实浏览器/固定旧库重启：PASS"
  - "API受影响30/30，目录与R33 HTTP16/16；最终新HTTP3/3：PASS"
  - "本次浏览器2/2、原数学/备课3/3、R33浏览器2/2：PASS"
  - "生产构建、固定范围双轴review、受保护路径字节检查：PASS"
identity_mode: "新HTTP/浏览器 real-auth/fake-mail；继承API test-principal"
product_model_calls: 0
product_key_reads: 0
open_items:
  - "根安排本候选独立验收后关闭原题目关联OPEN"
  - "原历史fetch、在线、完整阶段与目标设备门槛保留原归属"
failure_owner: null
next_condition: "完整候选独立checkout、独占短TMPDIR/库/端口；按本目录README复跑WB-MTA001-007"
authorization_used: "用户本轮 MATERIALS-TEACHING-FIX@1 attempt 1 授权固定输入组合、唯一产品写入、候选提交、自验与内部review；不合main/push/部署；外层唯一回调"
```
