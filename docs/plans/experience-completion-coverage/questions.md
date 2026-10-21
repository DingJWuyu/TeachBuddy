# 题库全线独立覆盖

本页由 sweep_questions 唯一维护。固定基线 `ddc2f3d1c4e8299cbd36b821bac817e222d4e705`，模型 `gpt-6.1-sol / xhigh`。首次清单依据当前产品与原型源码独立展开，尚未读取上轮覆盖。原型 4174 仅作对照；产品使用只读 `sweep-baseline-web`，修复后使用题库独占构建。证据根为 `test-results/experience-completion/sweep/questions/`，受控 OCR 只证明消费。

源码缩写：F=`apps/web/src/features/questions/QuestionFinder.jsx`；P=`MaterialsQuestionsPage.jsx`；S=`useQuestionSession.js`；O=`OriginalPane.jsx`；C=`QuestionControls.jsx`；R=`FragmentReview.jsx`；以上相对题库目录。原型找题为 `docs/design-system/teachbuddy-app/ui/tbx/src/questions/QuestionFinder.jsx`，原型编辑/收录为 `ui/app.js:94047..97150`，通过其实际组件对照，不直接编辑 bundle。

状态：待验表示尚无本轮运行证据。每行的证据补充实际运行入口、结果或明确未验边界；源码静态核对不标为体验通过。AC06/07 是阶段 A 既有问题，不计新问题。

| ID | 源码分支 | 前置 | 动作序列 | 预期 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| Q01 | F:106..214 / 原型 Finder | 新账户空题库 | 打开题库，键盘/指针分别打开新建与收录并取消 | 空态动作可用，无重复或拥挤，取消可继续 | walkthrough-final/product-empty.png；walkthrough.mjs 的空稿/收录取消→下一入口 | 通过实际列明分支 |
| Q02 | F:37..115 / S:158..197 | 有题型、标签、星标及答案 | 全部/星标/题型/多标签组合，搜索题干/公式/笔记，再扩展到答案 | 全部标签匹配，搜索范围正确，清除条件复位 | walkthrough-final/receipt.json；last-controls/receipt.json 的星标；baseline-regression 的答案范围/分类筛选 | 通过实际列明分支 |
| Q03 | F:37..54 / S:180..197 | 加载慢、失败、乱序 | 搜索切词/切筛选，读取失败后重载 | 最新结果获胜，失败非空态，可继续 | edges-final/receipt.json 的 list-read-failure-reload-clear；late-search.log：1 passed；branch-complement 带图迟到/失败终态 | 通过实际列明分支 |
| Q04 | F:58..100 / P:663..742 | 已有分类与题目 | 管理分类，新增/改名/重复名失败/取消/保存，再编辑题目 | 类别清楚，分类关联与未保存输入保留，焦点接续 | walkthrough-final/receipt.json 的取消/重复名失败后修正；final-branches-complete/receipt.json 的空名拒绝 | 通过实际列明分支 |
| Q05 | P:701..742 / S:582..632 | 已关联分类，含本地笔记草稿 | 删除分类影响确认，取消后键盘继续，再确认保存，同名重建 | 不删题，解除关联，旧身份不复活，笔记保留 | baseline-regression 全局分类/同名分类回归；final-branches-complete/receipt.json 的同名新身份 | 通过实际列明分支 |
| Q06 | P:130..155,643..653 / S:633..638 | 新建/编辑/校对 | 连续创建题型与标签，取消快速重开，重复名失败后重试 | 名称焦点与键盘可用，新分类即选用；AC07关联 | category-regression-red.log→category-regression-green.log；category-import-final.log；AC07相邻回归通过 | 修复通过（SW-QUESTIONS-01） |
| Q07 | F:170..214 / P:435..500 | 多题、公式、图片与长内容 | 连续选题，展开答案笔记，滚动，切模块返回并刷新 | 内容与选中正确，列表/阅读滚动恢复，未保存内容不冒充已保存 | baseline-regression 列表滚动；branch-complement 带图读取；final-branches-complete/receipt.json 的长题滚动350→导航/刷新 | 通过实际列明分支 |
| Q08 | P:452..480 / S:455..482 | 无答案或有设备草稿 | 阅读添加答案、返回题目、继续编辑、放弃取消/确认 | 草稿可恢复或明确丢弃，空稿退出无残留 | baseline-regression 空稿退出/已有草稿、确认取消；walkthrough-final 产品取消后Tab/Enter进入编辑 | 通过实际列明分支 |
| Q09 | P:461..478 / C:49..125 | 新题 | 标题/题干/答案/笔记/分类/标记，保存后退出刷新重开 | 真实持久化，公式预览、配图及分类一致 | walkthrough-final/product-editor.png、product-reader.png；baseline-regression 的保存刷新 | 通过实际列明分支 |
| Q10 | C:68..124 / 共享 DocumentEditor消费者 | 新题与编辑 | 插入/删除/移动段落、公式、标题、列表、表格、图片，撤销结构，继续写字 | 结构可编辑，撤销保留其他输入，图片取消/失败可重试 | baseline-regression 公式/选项/表格；branch-complement 删除移动/表格局部撤销；last-controls 小标题；continuation-final 图片取消/422/重试保存 | 通过实际列明分支 |
| Q11 | S:297..372,431..450 | 保存延迟、失败、丢响应 | 保存中继续输入，失败后立即下一步，确认上次请求后再保存并刷新 | 不重复创建、不覆盖新输入，反馈准确 | baseline-regression 新题未知结果/改编等待输入；edges-final 上传原键；category-regression-green.log 的创建等待新题干 | 通过实际列明分支 |
| Q12 | P:197..216,445..460 / S:752..779 | 其他会话更新 | 保存冲突，采用服务器或保留本地，再保存 | 对照可读，原版本校验，输入不丢 | baseline-regression 改编来源冲突；edges-final/edit-conflict.png 与保留本地后的实际记录；three-gaps-final ordinary-conflict-adopt-server 采用服务器后保存刷新 | 通过实际列明分支 |
| Q13 | P:456,491..504 / S:483..496 | 有题含笔记、星标及分类 | 复制改编、原题对照、保存重开，原题查看副本 | 新ID、笔记清空/标记关闭/分类沿用，双向与快照保留 | walkthrough-final/product-copy.png；baseline-regression 复制笔记清空/来源快照；真实记录刷新读回 | 通过实际列明分支 |
| Q14 | P:639 / S:483..496,773..779 | 非空新题草稿，原题更新 | 改编替换取消/确认，来源冲突选当前后再保存 | 取消保留旧稿，选来源保留改编输入且仍需保存 | walkthrough-final/receipt.json 的替换取消/确认；baseline-regression 改编首存来源冲突 | 通过实际列明分支 |
| Q15 | P:480..505 / S:81..93,378..394 | 来源归档、永久删除、读取失败 | 查看来源/重试，对照旧快照，切题 | 归档来源可读，缺失明确，失败非缺失，快照可读 | baseline-regression 来源读取失败/原题删除快照；branch-complement 原始材料彻删保留题目 | 通过实际列明分支 |
| Q16 | P:507..575 / S:780..797 | 有题干公式、答案及配图 | 复制成功/拒绝/重试，点公式源，切题；生成含/不含答案，下载实际打开 | 成功准确，失败选中文字可继续，PNG透明/内容正确 | baseline-regression 真实剪贴板成功/拒绝/无API；final-branches-complete individual-formula-source；edges-final question-part-0/1.png 解码及目视 | 通过实际列明分支 |
| Q17 | P:401..430,637..650 / S:395..430 | 有题及未保存草稿 | 归档取消/确认，刷新归档列表，恢复取消/确认，再编辑 | 路由清理、草稿保留、恢复回归档列表 | walkthrough-final/receipt.json 的题目归档/恢复取消接续；baseline-regression 归档草稿/路由刷新 | 通过实际列明分支 |
| Q18 | P:441,641..650 / S:405..430 | 已归档原题和改编 | 永久删除取消/确认，再刷新并看副本快照 | 仅归档可删，不可恢复，副本保留 | baseline-regression 深链归档/彻删未知原键确认/来源快照；取消由确认连续回归保护 | 通过实际列明分支 |
| Q19 | P:578..636 / S:94..105,454,516..546 | 文字收录 | 选入口/更换/关闭重开，贴多题含答案、名称出处，整理后下一步 | 原文保存，草稿/答案匹配，材料输入恢复正确 | walkthrough-final/product-review.png、receipt.json；baseline-regression 收录输入刷新；last-controls 真实文字收录 | 通过实际列明分支 |
| Q20 | P:590..632 / S:513..546,837..847 | 真实Word/PDF/多图片 | 文件选择与图片排序，页码/名称/出处，上传后读取原稿 | 字节真实、顺序/页码正确，不伪造分页 | native.log 的真实P.pdf/W.docx/w.doc；final-branches-complete image-order.png 与HTTP原件顺序；type-switch/receipt.json | 通过实际列明分支 |
| Q21 | P:592..635 / uploadRecovery.js | 上传失败/未知/未上传文件刷新 | 中断/取消/刷新、重选同文件继续，再收录 | 原键核实，无重复材料，字节缺失明确需重选 | edges-final/upload-unknown.png、receipt.json：上传已落库响应丢失→刷新重选同原图→相同幂等键，仅1份材料 | 通过实际列明分支 |
| Q22 | P:220..267 / S:256..277,879..892 | OCR受控回放及失败 | 整理中浏览，停止/取消，重开，再重试 | 运行锁定编辑，停止保留原稿，迟到不覆盖人工 | recognition.log 的整理中停止/刷新/人工稿/重试；只使用入库真实识别产物回放 | 通过实际列明分支 |
| Q23 | P:222..230 / ImportList.jsx | 继续、完成、失败、部分完成材料 | 局部完成后返回列表，展开完成材料，再次进入 | 待处理/完成分组正确，单复数正确；AC06关联 | walkthrough-final 完成材料默认折叠；baseline-regression 全部处理材料/真实继续收录；AC06只关联 | 通过实际列明分支 |
| Q24 | P:281..324 / O:43..144 | 多草稿多页材料 | 选草稿、页码/文件/缩放/定位，左右分别滚动，保存刷新重开 | 定位覆盖题面答案，滚动独立、缩放现场保留 | branch-complement 文字/图片分隔拖拽与键盘/窄屏切换；edges-final 缩放/定位保存；native 原稿页控件；three-gaps-final 原稿200%实际outer500保存/往返/刷新不丢 | 通过实际列明分支 |
| Q25 | O:147..289 | Word/DOC真实样本 | 分页/段落切换，定位、下载、旧DOC提示，补题 | 原件保留，段落不冒充页码，缺对象明确 | native.log：3 passed；native/files/word-original.png、legacy-doc-review.png、legacy-doc-reopened.png；原件逐字节核对 | 通过实际列明分支 |
| Q26 | O:235..337 / S:672..694,798..821 | 图片/PDF草稿 | 调整选区，指针重框，保存题面/答案定位、裁图，再保存刷新 | 真实页图坐标与配图持久，原图不变 | native 图片失败后人工补题/裁图保存重开；edges-final crop-location-save-divider-refresh；真实图块字节 | 通过实际列明分支 |
| Q27 | O:64..95,313..327 | 原稿预览失败 | 失败后下载/重试预览，保存校对，连续切材料 | 原稿仍可取，预览不因校对保存闪回，错误可恢复 | baseline-regression 图片预览读取失败后恢复；native 与edges-final 校对保存后仍可对照；three-gaps-final 保存期间8个渲染帧原稿持续可见且outer500保持 | 通过实际列明分支 |
| Q28 | P:306..370 / S:497..512,822..824 | 待核对题、未完整答案、公式疑点 | 直接确认阻断并定位；修改/核对/选择答案状态后确认 | 首未解项获焦点，必须修正项不可仅确认通过 | walkthrough-final 阻断首项聚焦后核对；recognition 公式/位置疑点校对，只有修正才能确认 | 通过实际列明分支 |
| Q29 | P:319..328 / C / S:551..557 | 校对题含公式、图片、答案 | 修改题名/正文/答案，保存进度、返回、刷新重开，再完成入库 | 局部修改保存，原稿不重载，状态正确 | walkthrough-final 第二题改标题→保存→刷新→入库；native 旧DOC公式与裁图实际重开；category-import-green 校对分类 | 通过实际列明分支 |
| Q30 | P:375..422 / review-drafts.js / S:695..750 | 一题多段且有答案/笔记摘录 | 拆分，核对两题答案；选目标合并；忽略/恢复 | 原答案保留第一题，两题重核，结构与来源保留 | baseline-regression 有答案拆分/无答案拆分合并；final-branches-complete 忽略/恢复保存刷新 | 通过实际列明分支 |
| Q31 | R / NoteFragments.jsx / S:825..832 | 未分配文字/结构片段 | 忽略恢复、归入题干/答案/笔记，移除摘录，再分配保存刷新 | 不重复追加，结构/原文/来源保留，答案状态正确 | baseline-regression 答案/笔记分配、移除再归入、刷新无重复；recognition 结构表/列表/真实图片归题干；last-controls 片段忽略/恢复 | 通过实际列明分支 |
| Q32 | P:242..252 / S:639..671 | 保存中的材料/可信页段落 | 补充照片，补充题目草稿，继续校对入库 | 原文件保留，新稿沿当前真实位置，非法位置阻断 | baseline-regression 第二原图/纯文字/第2页PDF补题真实位置；native 图片失败后补充照片和草稿 | 通过实际列明分支 |
| Q33 | P:424..429 / S:497..512 | 多题部分校对 | 确认一题→查看题目→原稿返回→检查下一题→完成 | 入库ID与来源正确，已入库不可重复拆改，余题可继续 | walkthrough-final 逐题确认→查看→原稿回看→下一题→完成；recognition 六题真实消费者保存刷新 | 通过实际列明分支 |
| Q34 | P:251..263,641..650 / S:401..430 | 有入库题的材料 | 材料归档/恢复/彻删各取消再确认，刷新，再读题目 | 生命周期清路由，已入库题保留，来源缺失说明 | branch-complement 材料归档/恢复/彻删、路由刷新、删除材料后题目保留；baseline 同源缺失入口 | 通过实际列明分支 |
| Q35 | index.jsx / 题库引用消费者 | 已保存题及未保存编辑 | 从题库开辅助助理，引用当前题，跨模块再返回 | 仅传已保存快照，辅助栏不遮挡关键按钮/阅读 | continuation-final saved-question-reference.png、reference-refreshed.png、receipt.json：实际引用→资源往返→刷新，未发送模型请求 | 通过实际列明分支 |
| Q36 | questions-materials.css / Finder原型 | 空/长列表/阅读/编辑/校对 | 1440/820/390宽，辅助栏开关，中文浅色/英文深色 | 容器无意外溢出、文字清楚、按钮可点、原稿白纸 | walkthrough-final 双方1440/820/390阅读；continuation-final 英文深色辅助栏三宽与编辑；native 中文原稿/校对；branch-complement 窄校对与深色 | 通过实际列明分支 |
| Q37 | C / P / ResizeDivider.jsx | 分类/收录/确认/菜单/分隔器 | 键盘Tab/ShiftTab/Escape/Enter，取消后立即下一步，分隔器箭头 | 焦点陷阱/归焦正确，退出无残留阻挡，键盘与指针均可用 | baseline-regression 确认取消/就地分类聚焦；walkthrough-final 键盘空稿；branch-complement 分隔键盘/拖拽；category-regression-green 异步窗口 | 通过实际列明分支 |
| Q38 | ModulePresence/Disclosure消费者 | 题库全线 | 普通/减少动效打开关闭、快速重开、切题/切模块 | 动效平顺，减少动效遵循设置，旧浮层不抢焦点 | walkthrough-final 普通动效每步等待完成；continuation-final reduced-motion-edit.png，关闭收录后立即编辑；category绿色快速重开 | 通过实际列明分支 |

## 首次主要疑点与结果

首次线索已沿实际入口核对：分类取消不保留管理临时稿，收录类型切换按真实格式保留输入，保存/补充、裁图/补题、生命周期取消及辅助栏均有本轮证据。反查新增的异步分类及原稿实际滚动问题见下。

## 本轮发现与反向核对

- **SW-QUESTIONS-01，既存异步根因，已修。** 分类创建的迟到响应无条件关闭当前窗口，并由旧 `onAssign` 闭包回填整份旧题目。基线真实复现新标签窗消失及等待时补充题干被覆盖，见 `category-late/`、`category-late-data/`；原型同序列也红，见 `category-late-prototype/`。产品现在按打开标识关窗、按原题目/草稿身份检查归属，并合并最新输入。新增真实回归覆盖新窗输入、等待继续写、切另一题及校对切草稿；`category-regression-green.log` 4 passed，`category-import-final.log` 独立结果见回执。原型由总控统一同步。本根因只计1项，AC06/07不重计。
- **SW-QUESTIONS-02，既存滚动归属根因，已修。** 真实原稿放大200%后，实际外层卡片滚动500，旧代码只保存内层0，返回和刷新均回到0。`three-gaps/`、`long-original-prototype/` 和增强后的 `original-scroll-red.log` 均具名红；现在沿原scene字段分别保存外层纵移及内层横移，等真实页图加载后恢复。`original-scroll-green.log` 4 passed；`three-gaps-final/receipt.json` 显示保存、返回、刷新都保持500及200%，截图亲眼核对一致。原型由总控同步。
- 从产品 Finder、Page、OriginalPane、FragmentReview、Session 和原型对应入口反查，首次清单后才读取上轮47组覆盖；图片加载终态、同名分类新身份、原件字节、单公式源、片段忽略恢复已补本轮证据。没有复制上一轮通过结论。
- PDF→Word更换入口仍保留原PDF与页码，双方实际成功收录；产品按真实媒体类型处理第2页，原件SHA256不变。规格没有切入口必须清空的规则，不将此判为缺陷。
- 原型取消归档后立即Tab/Enter仍触发归档，是上一轮共享确认框的已知差异。当前原型重现见 `walkthrough/receipt.json`、`failure.png`，产品同序列通过见 `walkthrough-final/` 与确认取消回归。交总控统一处理，未计新题库根因。

## 验证边界

本轮为真实认证/fake-mail、隔离HTTP/SQLite和浏览器，固定前端基线及题库独占候选；真实Office/PDF工具使用本机持久安装，真实样本均来自仓库。OCR仅为受控真实产物回放，未运行新GPU推理、真实邮件、付费模型、私人E原稿或用户50880。

Q12普通冲突采用服务器、Q24真实原稿长滚动往返及刷新、Q27保存校对期间原稿持续可见，均由总控反查后在 `three-gaps-final/` 补齐。当前合法输入之外的未来文稿只读兼容分支未造库触发；此边界不由相邻通过推导。普通/减少动效和语言主题按实际相关组合验证，不声明穷举全部矩阵。

独占源码、测试、文档和临时现场归属，以及命令与候选摘要沿 `test-results/experience-completion/sweep/questions/receipt.md`。整体任务结束前保留失败现场与执行脚本，总控统一触发清理。

原型同步已完成，最终对应路径的真实复验通过；证据见本线 `prototype-final/receipt.md`。产品原有红绿及边界继续有效，原型模拟会话不能替代真实账户持久化验收。
