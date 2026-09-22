# M43@1 / attempt 1 实现回执

结论：**M43 指定数学集成切片 LOCAL_SELF_PASS，可供 M44 按限定边独立复跑。完整 R35/M43/M44 门槛未关闭。** 本回执不代签 T51/T54、Windows/PowerPoint/WPS、真实邮件、物理设备或真实 Agent。

| 项 | 固定值 |
| --- | --- |
| 角色 / 模型 | 实现与集成，Codex `gpt-6-astra low`，内部助手继承 |
| 分支 | `feat/m43-math-integration` |
| main-based 起点 | `3464525bf05c84d07f8fab79c56b881f45d6a361` |
| 固定组合提交 | `24ba22e72a31e22423ee43dc345b19fe7ac3ac2d` |
| 主实现 | `ee33e2b1bc1009b1b3c66b67f2593a47f7c0947f` |
| 当前产品代码 | `909693a7cc67f50a523ea94864ef7b80a345d5df` |
| 当前代码与可启动 fixture | `965f813626fc40ba5fb8c04f0495c825f825b469` |
| 完整回执 SHA | 由唯一最终交回消息固定；可用 `git log -1 --format=%H -- docs/acceptance/evidence/M43/v1/author.md` 解析 |

## 固定消费

| 输入 | 完整 SHA / 必读回执 |
| --- | --- |
| P 材料 | `3a10e0d5108a4950bba0851610bae7d8495dc8ff`，产品 `18a80073380116e1d30165f0001a86e5fdb2304c`，`R34/v1/integration5.md` |
| R35 independent | `55654c2d59f0130aeb31e24d5f52c04b4323f0a4`，`R35/v1/local-review2.md`；默认/长作答及具名本地集合 PASS，历史两项 fetch 观察 OPEN |
| M 完整数学 | `b0703907a7339513ed34bfed5c1e6787cc65d37d`，`M42/v1/integration2.md` 与 `integration.md`；包含动态/HTML和真实身份 fixture |
| D 冻结 | `1a5dd015863d749e5244346f4eaad24ac506670d`，`M40/v1/handoff.md` 与其 `docs/plans/tasks/math/M43.md` |
| 教学组合 / independent | `4a6b7731bc71c048f05f3f67015790d372e8becf`，产品 `f811a2778df3e47160377035ac1c3c8eacc09d8f`；independent `ab19d5d4858affda949470ec66475d5b6209ddd9` |
| T51 数学补接 | `9fc6337ed5ab00d0936e4d30c74173999e9e9ffc`，产品 `af19869fad6f8908dd98a1e057a5df7a97d4c0f5`，`T51-MATH/v1/integration.md` |
| 教学新版设计 / 冻结 | `a44587b9bd18618d77df13f7349f5043a297d226` / `3dbead5af93059b0f890c531097b234e5f453fae` |

消费全部来自具名 Git 对象，未跟随其他分支 HEAD。T51 数学补接以增量装入较新的教学组合，保留真实认证、滚动和现场修复。逐路径固定输入见 [composition.json](composition.json)；补入的转换脚本来自 P，教学装配与冻结契约分别来自表中教学产品和新版设计。根 AGENTS、计划/台账/DAG、ROADMAP 与旧证据未改，见 [integrity.json](integrity.json)。

## 实现范围

- App/外壳装配六个真实模块、目录 v3、稳定数学 workId 路由、共享辅助栏和教学时间装配。生产仍使用真实认证；测试身份只存在隔离 fixture。
- lessons v3 与旧路径共用同一数据和幂等账本，持久化 MathReference 快照；旧 v1/v2 拒绝有损读写，旧未知请求保留原路径。没有新增迁移 ID 或改写既有迁移。
- 从已存/未存环节带回，保留完整草稿与 AI 输入；独立另存、原位替换、重复放置、使用位置、冲突与未知结果恢复。真实数学端口与 classes 反馈组件接入。
- 数学内容进入真实 DOCX/PDF，动态/HTML最终下载物做停服、禁网、新浏览器 file 冷启动。未把 HTML 交 Office 执行。
- 数学校验仅抽到共享契约层，原模块算法未重写。README 只声明本分支局部能力。全部提交仅在本分支，无 main 合并、push、部署或模型请求。

## Self 结果

| 检查 | 结果与证据 |
| --- | --- |
| 集成 API、快照独立、显式采用、旧请求、隔离、删除、真实教学链接、迁移与输出 | 5/5，[api-integration-final.log](api-integration-final.log) |
| 全 API | 296/296，[api-full-final.log](api-full-final.log)；验证副本 API/shared 字节与当前代码一致 |
| 全 build | PASS，[build-conflict.log](build-conflict.log)；保留 Vite 大 chunk 提示，不影响构建 |
| 实际认证集成 E2E | 6/6，[e2e-complete-disk.log](e2e-complete-disk.log)；原稿/AI、指定新环节、已提交丢响应、明确拒绝后取消与重试、三引用原位替换、旧 v2 原路径确认、长课滚动与干净原稿并发冲突 |
| 受影响材料 E2E | 7/7，[e2e-materials-teardown-fixed.log](e2e-materials-teardown-fixed.log)；原件/校对/混合取材/六输出/真实身份与重启 |
| 数学动态与隔离 E2E | 6/6，[e2e-math-regression.log](e2e-math-regression.log) |
| 数学静态与真实认证 E2E | 7/7，[e2e-math-static.log](e2e-math-static.log)，包含退出后同页登录/注册与账户隔离 |
| P 保留库 / 固定 M 库 | 两次重启 PASS；[migration-P.json](migration-P.json)、[migration-M.json](migration-M.json)，旧行、文件与回执 hash 不变，原库未写 |
| 五类数学教案/讲义 | 实际 DOCX/PDF；[output/](output/)、[docx-checks.json](output/docx-checks.json)：1 个 OMML、3 张固定海报、HTML单独文件提示、私密注记不泄漏 |
| 外部幻灯片 | 实际下载 PNG 放入 PPTX，并由 Linux LibreOffice Impress 转 PDF，见 [成品](browser/formula-in-slide.pptx)、[渲染](browser/formula-in-slide.png)；不代表 Windows PowerPoint |
| 最终 HTML 离线 | Linux Chrome `152.0.7977.64`；停服、新浏览器、offline=true、file URL、无 HTTP(S) 请求，数学、滑杆键盘、拖点、重置实测，[offline.json](browser/offline.json) |
| 内部 code-review | Standards 1 项、Spec 累计 4 项均关闭；[review.md](review.md)，不替代 M44 independent |

成果与证据文件的 SHA-256 清单见 [artifacts.json](artifacts.json)，不包含清单自身。

早期红灯与最终绿灯分开保存；不得用早期缺依赖、旧断言或测试定位器失败推导产品缺陷，也不得用最终绿灯关闭原自然传输观察。

## 未决归属与停止点

1. **R35 历史两项自然 fetch 观察仍 OPEN。** 本轮全 API 中另记录四次自然重现，cause 为 `ECONNRESET`，旧 socket 跨测试服务生命周期复用。时序和处置边界见 [transport.md](transport.md)。修改两个重启 fixture 的连接生命周期后全 API 通过，不把此结论外推至真实浏览器/生产连接，也不替根关闭旧观察。
2. **固定 P/T51 的题目链接接口冲突 OPEN。** 新材料题在真实认证浏览器的班级“题目”选择器返回旧接口 `422 /body/version unsupported-content-version`，见 [question-link-open.json](question-link-open.json) 与 [截图](browser/question-link-open.png)。T51 消费 `questions.readForReference`/旧列表，P 的丰富题目需要 v2；原公共语义不允许无损降级。归根协调 P/T51 设计与实现，不在 M43 临时扩展冻结端口。本轮 math 链接与反馈 self 已通过，不能据此代签完整教学组合。
3. **浏览器执行环境观察 OPEN。** 最后两套浏览器并行运行出现 Chrome SIGTRAP / Page crashed 与 Playwright response guid 异常，保留 trace 和系统记录。改用充足空间的磁盘 TMPDIR 并串行后验证，不能据此宣称根因已关闭，见 [观察](browser-failures/observation.md)。
4. Windows/Edge、真实 PowerPoint/WPS、触屏/投影等物理环境、真实邮件和真实 Agent 操作由外层安排；本轮零产品模型请求、未读取产品密钥。
5. M44 尚未独立验收。原始 P/M 库、独立验证副本和生成现场保留；构建生成的 `apps/web/public/` 未纳入源提交，保留供本地复跑；本 session 的服务已停止，提交回执后停写。唯一通知为最终交回消息，不联系业务 session。
