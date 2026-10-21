# 题库完整体验对照清单

唯一写者：questions。固定基线 `a5daad25a712a4d2f75f34da71bc97e645f1a8a0`，作者 `gpt-6.1-sol / medium`。约束沿[本轮任务](../prototype-experience-audit.md)。证据：`test-results/experience-audit/questions/receipt.md`。

## 源码分母

原型新版列表/右轨：`docs/design-system/teachbuddy-app/ui/tbx/src/questions/QuestionFinder.jsx`。完整页面、编辑、收录和原稿沿 `ui/app.js` 的 QuestionDialog、QuestionDocumentEditor、OriginalPane、MaterialsQuestionsPage、Taxonomy 读取。产品入口在 `apps/web/src/features/questions/`；共享文稿/菜单/样式/翻译只读交总控。

原型题库列表没有批量选择与批量归档；多选实际出现在图片上传和标签筛选，草稿合并明确选择后接题。真实后端和保存能力按规格保留。每行包括列举全部分支，部分通过逐项注明未验。

## 行为清单

| ID | 条件与连续操作 | 入口 | 结果与证据 |
| --- | --- | --- | --- |
| F01 | 空库欢迎与已有题未选中欢迎 | `QuestionFinder / ImportList / Taxonomy` | 通过：baseline/candidate-comparison 空库与保存后返回欢迎。 |
| F02 | 列表标题总数/标记/摘要/首图/题型色/前二标签与余量 | `QuestionFinder / ImportList / Taxonomy` | 通过：四题列表、标记、公式摘要、三标签余量；首图由识别浏览器与带图滚动回归验证。 |
| F03 | 搜索输入/保留旧结果/清除/答案范围/无结果清除条件 | `QuestionFinder / ImportList / Taxonomy` | 通过：comparison 搜索清除和答案范围；persistence-export 延迟响应/滚动；edge-errors 读取失败重载。 |
| F04 | 全部/标记/题型与多标签AND组合 | `QuestionFinder / ImportList / Taxonomy` | 通过：comparison 题型切换和标签；专用筛选回归验证保存分类不受查找影响。 |
| F05 | 读取/失败重载/图片成功失败/刷新选中和滚动恢复 | `QuestionFinder / ImportList / Taxonomy` | 通过：edge-errors 双方故障注入和重载；persistence-export 真实带图延迟与刷新恢复。 |
| F06 | 继续新题/继续收录/已完成折叠/归档列表 | `QuestionFinder / ImportList / Taxonomy` | 通过：comparison 归档与完成材料折叠；baseline-regression 新稿/继续收录/未分配完成条件。 |
| F07 | 分类管理进入取消保存退出/新增类别 | `QuestionFinder / ImportList / Taxonomy` | 通过：comparison 双方新增题型标签、保存退出；edge-errors 取消重开。 |
| F08 | 改名空名重复名/删除影响数确认取消 | `QuestionFinder / ImportList / Taxonomy` | 通过：edge-errors 双方重复名、删除取消/确认；baseline-regression 同名类别改名/影响数。空名拒绝双方已验见 continuity-focused-diagnosis。 |
| E01 | 新题空稿退出/题干聚焦/标题可选/粘贴与行内公式 | `QuestionDocumentEditor / useQuestionSession` | 通过：comparison 同题干输入和公式即时预览；edge-comparison 自动聚焦；baseline-regression 空稿退出。 |
| E02 | 插公式源/插图取消失败/更多四种结构 | `QuestionDocumentEditor / useQuestionSession` | 通过：edge-comparison 四种结构；files-focused 双方真实插图取消、422拒绝、重试成功。 |
| E03 | 段落移动删除/结构撤销保留后续输入/嵌套结构 | `QuestionDocumentEditor / useQuestionSession` | 通过：edge-comparison 双方移动/删除/撤销；baseline-regression 嵌套表格和后续输入保留。 |
| E04 | 添加答案/分类标签笔记折叠/就地创建/标记 | `QuestionDocumentEditor / useQuestionSession` | 通过：comparison 答案/笔记/分类/标记；baseline-regression 就地创建；双方就地创建已验见 continuity-focused-diagnosis。 |
| E05 | 保存过程/成功阅读/刷新/退出保设备稿 | `QuestionDocumentEditor / useQuestionSession` | 通过：comparison 保存阅读；edge-comparison 退出保留；baseline-regression 刷新设备稿和连续保存。 |
| E06 | 草稿继续/放弃确认取消 | `QuestionDocumentEditor / useQuestionSession` | 通过：edge-comparison 双方取消丢弃、继续和确认放弃。 |
| E07 | 复制改编/并排结束重开/快照/反向链接 | `QuestionDocumentEditor / useQuestionSession` | 通过：comparison 双方改编并排、结束对照、快照；persistence-export 原题删除后快照/反向读取。 |
| E08 | 已有新稿替换确认/原题更新采用来源再保存 | `QuestionDocumentEditor / useQuestionSession` | 真实能力保留：persistence-export 原题更新后采用来源并保存通过。替换新稿双方取消/确认已验见 continuity-focused-diagnosis。 |
| E09 | 未知结果原请求确认/输入不丢/冲突处理 | `QuestionDocumentEditor / useQuestionSession` | 真实能力保留：persistence-export 已实际验证未知响应原键确认、保存中后续输入和冲突。原型内存适配器不作为持久幂等证明。 |
| R01 | 题干分类标签标记/答案笔记折叠 | `MaterialsQuestionsPage reader` | 通过：comparison 四主题语言组合阅读答案笔记及分类标记。 |
| R02 | 更多归档恢复删除/确认取消/返回与刷新路由 | `MaterialsQuestionsPage reader` | 通过：comparison 双方菜单归档取消/确认/恢复；persistence-export 彻底删除来源与响应未知；baseline-regression 路由/设备稿。 |
| R03 | 无答案添加/已有设备稿继续和丢弃 | `MaterialsQuestionsPage reader` | 通过：edge-comparison 设备稿继续/丢弃；baseline-regression 空答案新增。 |
| R04 | 来源对照/已删除说明/临时读取失败/快照 | `MaterialsQuestionsPage reader` | 真实能力保留：persistence-export 读取失败不误报删除、删除后原题快照和原稿入口说明。 |
| R05 | 导出/包含答案/剪贴板成功拒绝手工复制/公式源 | `MaterialsQuestionsPage reader` | 通过：edge-comparison 双方文字/公式源；persistence-export 真实剪贴板成功/拒绝手动选择。 |
| R06 | 生成题面配图/刷新下载/编辑稿独立保护 | `MaterialsQuestionsPage reader` | 通过：files-focused 双方真实生成/下载PNG；persistence-export 阅读已保存内容不覆盖另存编辑稿。 |
| C01 | 收录四入口步骤/关闭Escape遮罩/返回焦点 | `QuestionDialog / capture / collect` | 通过：comparison 四入口步骤和对话框；baseline-regression Escape/关闭和归焦；continuity-focused-diagnosis 验证关闭后Tab到新建题目。 |
| C02 | 文字输入空禁用/更换类型保留 | `QuestionDialog / capture / collect` | 通过：comparison 文字整理；files-focused 空文件禁用/切类型保留；edge-comparison 新一轮文字收录。 |
| C03 | PDF Word 图片文件类型多选清单/图片上移 | `QuestionDialog / capture / collect` | 通过：files-focused 双方文件accept、多图片清单和上移、PDF选择；native-intake-correct-tools Word/DOC上传。 |
| C04 | 名称出处页码范围/刷新重选文件 | `QuestionDialog / capture / collect` | 通过：files-focused 双方名称/出处/页范围；baseline-regression 刷新原稿重新选择提示。 |
| C05 | 原稿保存上传/任务运行停止重试 | `QuestionDialog / capture / collect` | 通过：新增 stop-retry-corrected 实际受控停止、刷新、人工改稿、重试和草稿保留；OCR只用固定回放。 |
| C06 | 关闭切模块刷新恢复校对现场 | `QuestionDialog / capture / collect` | 真实能力保留：baseline-regression 与 stop-retry-corrected 验证刷新恢复；原型运行时主动使用内存存储，刷新不用于持久证明。 |
| V01 | 双区独立滚动/分隔拖动箭头Home End/比例恢复 | `MaterialsQuestionsPage q-review / FragmentReview` | 通过：candidate-review-regression 文字/图片实际分隔条拖动、键盘Home/End/箭头、比例恢复及窄屏独立切换。 |
| V02 | 材料标题状态计数/保存校对 | `MaterialsQuestionsPage q-review / FragmentReview` | 已修复 EA-questions-01/02/03 并复验：comparison 同数据computed styles；aux-focused 英文深色完成态和操作菜单。 |
| V03 | 材料操作补照片补草稿归档恢复删除/运行禁用 | `MaterialsQuestionsPage q-review / FragmentReview` | 通过：native-intake-correct-tools 补充照片/草稿；baseline-regression 材料归档恢复；stop-retry-corrected 运行保存禁用。 |
| V04 | 逐题切换/阅读修改完成/标题题干答案 | `MaterialsQuestionsPage q-review / FragmentReview` | 通过：comparison 双方两题逐题修改/完成/入库；candidate-review-regression 切换刷新。 |
| V05 | 答案三状态/疑点位置/阻断首项聚焦 | `MaterialsQuestionsPage q-review / FragmentReview` | 通过：comparison 确认未解决先聚焦疑点；baseline-regression 有答案拆分重核对；固定OCR 回放公式/配图/未提供答案。 |
| V06 | 分类标签/笔记摘录编辑移除/手写笔记 | `MaterialsQuestionsPage q-review / FragmentReview` | 通过：edge-comparison 双方笔记摘录移除再归入；baseline-regression 编辑摘录保存刷新/复制清空笔记。 |
| V07 | 按换行拆分/有答案重新核对/合并/忽略恢复/入库锁定 | `MaterialsQuestionsPage q-review / FragmentReview` | 通过：edge-comparison 双方拆分合并忽略恢复；baseline-regression 有答案归属重新核对和入库锁定。 |
| V08 | 未分配展开/忽略恢复/归题干答案笔记/禁重复 | `MaterialsQuestionsPage q-review / FragmentReview` | 通过：edge-comparison 双方片段归答案/笔记和禁重复；baseline-regression 题干归入/忽略和结构保持。 |
| V09 | 确认入库/查看题/下一题/完成材料折叠 | `MaterialsQuestionsPage q-review / FragmentReview` | 通过：comparison 双方逐题确认/下一题/完成折叠，刷新持久部分由真实产品验证。 |
| O01 | 文字逐字范围高亮/题面答案定位 | `OriginalPane` | 通过：comparison 双方原字/高亮与定位题面答案；native-intake 文字第二题原稿定位。 |
| O02 | 多原稿选择/真实页码/100 150 200缩放/滚动恢复 | `OriginalPane` | 通过：original-focused-final 双方多原稿选择、真实PDF页码、100/150/200缩放；EA-questions-05满宽布局由select-width-confirmed中英宽窄16组合复验；产品刷新滚动由相关回归验证；EA-questions-04保留已显示原稿/缩放/滚动通过。 |
| O03 | Word分页段落切换/可信段落定位/旧DOC风险 | `OriginalPane` | 保留差异：original-focused-final 双方Word分页/段落视图已验；原型模拟适配器无可信docx位置，所有段落选项禁用，产品真实段落选择及旧DOC limited风险由native-intake-correct-tools验证。 |
| O04 | 下载原稿/加载失败重试 | `OriginalPane` | 通过：original-focused-final 双方原件下载SHA256与固定P.pdf一致；persistence-export 预览失败/显式重试。 |
| O05 | 调整选区/指针框选/用途定位/裁图保存 | `OriginalPane` | 通过：original-focused-final 双方真实指针框选、题面/答案用途切换、保存定位、裁图并保存；产品刷新保持由native专项验证。 |
| X01 | 中英浅深四组合空态阅读编辑管理收录校对菜单 | `questions.css / shared interactions` | 通过：comparison 中英浅深阅读/编辑；aux-focused 英文深色校对/菜单；files-focused 对话框。保留共有英文复数建议。 |
| X02 | 1440/900/740/600/390和aux断点/无溢出 | `questions.css / shared interactions` | 通过：comparison 1440及900/740/600/390，两套有关联语言主题组合零页面溢出；aux-focused 双方辅助栏和英文校对600。 |
| X03 | 菜单键盘/Tab焦点/模态陷阱返回 | `questions.css / shared interactions` | 通过：baseline-regression 模态焦点返回；comparison 菜单Escape；continuity-focused-diagnosis 验证Home/Enter及关闭后Tab；连续标签弹窗聚焦属原型共有建议。 |
| X04 | 加载关闭切题折叠连续过程/reduced-motion | `questions.css / shared interactions` | 通过：comparison 实际逐步执行并等待动画稳定拍摄；baseline-regression reduced-motion与关闭返回。不中间截空白为通过。 |

## 问题与差异

| 编号 | 根因与基线复现 | 修复与当前结果 |
| --- | --- | --- |
| EA-questions-01 | 材料操作触发器迁移共享Menu后未匹配原灰色圆形规则，基线padding为14px、背景透明；原型34px灰圆。 | 题库本地触发器选择器覆盖材料工具栏，candidate-comparison为34px、padding0、有灰底。 |
| EA-questions-02 | 校对题干本地override将原型30px 34px改为18px 22px，相同单行卡由95.09375px压到71.09375px。 | 删除被替代override，candidate-comparison与原型同为95.09375px。 |
| EA-questions-03 | 疑点卡浅深底色偏黄，与原型中性底不一致。 | 恢复#f8f8fa/#272728，candidate-comparison及aux-focused深浅实际复验。 |
| EA-questions-04 | 保存校对导致材料升版，OriginalPane随material.version清空并重读相同原件；受控延迟预览时，成功提示已出现但原稿图片消失。 | 移除预览effect对校对版本的依赖，文件切换/显式重试仍更新。original-save-red已稳定失败；original-final-regression新场景与预览重试/文件切换/Word来源共8项通过。 |
| EA-questions-05 | 原型app.css全局表单width:100%未迁移到原稿控件，产品按内容宽度并排，PDF 88/100px、Word 100/128px；原型填满各自513px容器。 | 经总控定点授权，仅questions CSS给OriginalPane所有select补width:100%；select-width-confirmed双方PDF/Word、中英、1440/600共16组合通过；每个select宽度与父容器相等，换页/缩放/视图/用途正常。 |
| EA-questions-T01 | manual-questions前置断言失败、world尚未创建时，afterEach又读world.directory抛TypeError，掩盖原错误。 | 清理前检查world；故意缺Office配置复验只剩原始前置错误。此项为既有测试缺陷。 |

产品独立根因5项，既有测试缺陷1项，本轮新引入产品缺陷0项。原型共有 `1 materials` 英文单复数问题已报告总控，按总控要求保留并作为buffer建议，不改翻译。原型内存存储、模拟识别/来源与真实持久能力差异按本轮授权保留。

原稿控件补验已完成：original-focused-final/receipt.json双方PDF页码/缩放/定位/裁图/原件下载、Word视图和多原稿切换通过。本工作线47行行为组已逐行回填，5项产品偏差已修并定点通过，EA-questions-05的16组合中英宽窄复验完成；本线再次冻结，待集中审查与CI。Word原型模拟适配器没有可信docx位置，实际段落下拉所有选项禁用；产品真实定位沿native专项保留，不伪造原型定位。连续分类弹窗聚焦双方相同，已交总控作为共有问题建议，不计复刻偏差。

原稿选择器布局由题库本地 `.q-workspace .q-original select` 维护；EA-questions-05经总控授权恢复原型满宽约束。实际匹配CSS规则及computed来源保留在 `select-width-before/receipt.json`，不改变共享表单或日程输入。
