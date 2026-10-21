# 资源库体验清查

唯一写者：resources，gpt-6.1-sol / medium。基线 `a5daad25a712a4d2f75f34da71bc97e645f1a8a0`；工作树及授权沿[主记录](../prototype-experience-audit.md)。原型只读，真实文件与 HTTP/SQLite；固定 OCR 回放；不提交 Git、不调用付费模型。

## 输入与覆盖依据

- 原型列表 `docs/design-system/teachbuddy-app/ui/tbx/src/resources/ResourceLibrary.jsx`：UploadButton/Thumb/TagDialog/SelectionTags/ResourceLibrary 及 startNew、commitName、moveFolder、archiveFolder、startRailDrag、startBand、startDrag。
- 原型详情与真实路径封装在 `ui/app.js` 的 ResourcesPage / Preview / ResourceInfo / FileHistory / TaxonomyDialog / Recognition / PageFind，样式沿 Design System README 与 `ui/tbx/styles/resources.css`。
- 产品同名职责位于 `apps/web/src/features/resources/`。真实能力与批准差异沿 resources 规格、materials/recognition 契约；搜索保持简单空结果，不增加覆盖提示。
- 每行所列条件均须实际对照，不能由旧测试推定通过；未知或无原型能力分别标记。证据统一在 `test-results/experience-audit/resources/`，完成回执 `receipt.md`。

## 逐项清单

| ID | 页面/入口 | 条件与连续动作 | 实际对照结果与证据 |
| --- | --- | --- | --- |
| L01 | 首次空库 | 上传邀请、叠卡、无搜索筛选、右轨计数 | 两端通过：空库邀请、无搜索筛选、右轨计数；`*-L01-empty.png`。 |
| L02 | 读取中 | 列表 aria-busy、读取资料占位 | 两端通过：真实列表读取受控延迟期间aria-busy与占位，释放后读回；`dual-edges-2.log` L02 / `*-L02-loading-active.png`。 |
| L03 | 网格 | 封面/无封面/错误封面、文件类型色、名称省略、文件夹及标签 | 两端通过实际封面、网格元信息与失败/无预览分支；`*-L03-grid.png` / `dual-preview-2.log` P05。产品单份读取失败隔离通过 `file-isolation.log`。 |
| L04 | 列表 | 名称、原文件、文件夹、日期、大小及标签 | 两端通过：同份PNG列表名称、原文件、文件夹、日期、大小；`*-L04-list.png`。 |
| L05 | 视图切换 | grid/list 选中态与已加载封面复用 | 两端通过：网格/列表切换、筛选离开后返回封面；`*-L05-cache-view.png`，产品缓存请求保护沿已有用例。 |
| L06 | 搜索输入 | 输入、Enter、清除及简单空结果 | 两端通过：搜索输入、清除、简单空结果；`*-L06-no-results.png`。 |
| L07 | 格式筛选 | 五类、多选、全选/清除、移除单个 chip | 两端通过五类逐个多选、全部类型清除、组合筛选及chip移除；`dual-edges-2.log` L07 / `dual-audit-4.log` L07。 |
| L08 | 标签筛选 | 多选、计数、移除 chip、组合搜索格式 | 两端通过两个标签叠加名称与格式、单个chip移除；`dual-edges-2.log` L08 / `*-L08-combined-tags.png`。 |
| L09 | 文件夹入口 | 全部/未分组/二次点击返回全部、含后代 | 两端通过文件夹与未分组二次点击回全部、含后代路径；`dual-edges-2.log` L09 / `dual-audit-4.log` L10。 |
| L10 | 文件夹路径 | 嵌套路径、点击祖先、列表数量 | 两端通过：子目录路径、祖先可达与后代数量；`*-L10-breadcrumb.png`。 |
| L11 | 滚动现场 | 打开返回后筛选、选择、滚动及焦点 | 两端通过24份结果长列表打开/返回后搜索、滚动恢复；`dual-final-2.log` L11。产品额外真实检查焦点回到原卡片通过 `baseline-existing`。检索状态行消失会改变最大scroll，核对稳定列表，不误记为位置丢失。 |
| F01 | 创建文件夹 | 根级、子级、折叠父级自动展开 | 两端通过：根级及子级就地创建；`*-F01-root.png` / `*-F01-child.png` / `*-F01-tree.png`。 |
| F02 | 名称边界 | 空、保留名、同父级大小写重复、不同父级同名 | 两端通过空名、保留名、同父级重复及不同父级同名条件；`dual-audit-4.log` F02 / `dual-branches.log` F02 / `dual-edges-2.log` F03/F06。 |
| F03 | 名称编辑 | Enter 提交、Escape 取消、blur 提交/丢弃非法 | 两端通过Enter提交、Escape取消、合法blur保存与非法blur丢弃；`dual-branches.log` F03 / `dual-edges-2.log` F03-empty-blur。 |
| F04 | 文件夹折叠 | 开合、嵌套缩进、折叠内容不能聚焦 | 两端通过折叠/展开与真实截图；`*-F04-fold.png`。Playwright可见性对被裁切子项有假阳性，改按闭合容器与实际画面核对。 |
| F05 | 文件夹菜单 | 新建子级、移到其他文件夹、重命名、二次删除 | 两端通过新建子级、移动菜单、重命名及二次删除；`dual-audit-4.log` / `dual-branches.log` 的F组。 |
| F06 | 移动菜单 | 根目录、当前父级禁用、排除自身后代、重名父级禁用 | 两端通过根目录/当前父级禁用、排除自身后代与同名目的地禁用；`dual-audit-4.log` F05 / `dual-edges-2.log` F06。 |
| F07 | 删除子树 | 子树消失、活动及归档资料回未分组、当前目录退回全部 | 两端通过删除子树，资料仍保留并归未分组；`*-F07-delete-tree.png`。产品活动/归档刷新保护通过 `baseline-existing` 删除嵌套文件夹用例。 |
| F08 | 拖文件夹 | 5px 阈值、跟手影子、目标高亮、循环禁入、移根 | 两端通过文件夹拖到其他父级/未分组根级，跟手影子与目标高亮；`*-F08-folder-ghost.png` / `*-F08-root-ghost.png`。 |
| F09 | 拖文件夹归档 | 全部确认后删树、分批>100与失败保留树 | 两端通过单份及102份文件夹归档、未知结果保留树、原键确认后再次完成删树；`dual-edges-2.log` F09 / `dual-special-2.log` F09。产品按100条拆批，原型适配器无此服务端限额，最终结果一致。 |
| T01 | 创建标签 | 名称、八色、保存、取消及重复名 | 两端通过名称、八色、重复禁用、取消与保存；`*-T01-create.png` / `*-T01-duplicate.png`。 |
| T02 | 编辑标签 | 名称颜色、二次删除及刷新保存 | 两端通过改名/改色/二次删除；`*-T02-edit.png` / `*-T02-delete.png`。产品刷新及新设备颜色读回通过 `baseline-existing` 标签用例。 |
| T03 | 标签拖动排序 | 蓝线、影子、保存顺序及颜色不变 | 两端通过排序蓝线、影子与保存顺序；`*-T03-drag-line.png` / `*-T03-reorder.png`。产品颜色不随顺序变化且刷新仍在已真实验证。 |
| S01 | 选择模式 | 选择/完成、单项、全选/取消、100 上限 | 两端通过选择/完成/单选/全选；`dual-branches.log` S01。102项条件 `dual-edges-2.log` S01：产品维持100上限，原型点第101项会多选，为资源契约已要求的安全保护差异，不反向移除。 |
| S02 | 空白框选 | 阈值、拖框、自动滚动、加选、空白取消 | 两端通过普通框选、Shift追加、空白取消与自动滚动；`dual-branches.log` S02 / `dual-special-2.log` S02 / `dual-final-2.log` S02 / `dual-edges-2.log` S02。 |
| S03 | 拖资料 | 6px 阈值、单项/所选多项、影子及不误打开 | 两端通过小于阈值正常点击、单份/多选整体拖动、跟手影子、无目标不写也不打开详情；`dual-final-2.log` S03 / `*-S03-multi-ghost.png`。 |
| S04 | 拖放目标 | 文件夹/未分组/标签/归档、无目标不写 | 两端通过拖动到文件夹、标签、归档，`dual-branches.log` S04/F09。未分组目标沿F08。 |
| S05 | 批量下载 | 按选择下载实际原件字节 | 两端通过选择两份后下载，实际逐文件字节一致；`dual-branches.log` S05-download。 |
| S06 | 批量移动 | 目标选择、确认/取消、其他信息保留 | 两端通过确认移动到子目录；`*-S06-move.png`。产品取消/冲突/未知结果整批原子性通过 `baseline-states`。 |
| S07 | 批量标签 | 全有/部分/全无、追加/移除、新建标签 | 两端通过mixed/true/false三态，追加及移除；`*-S07-mixed.png`，保留已有标签。 |
| S08 | 批量归档恢复 | 确认、取消、切换归档清除选择 | 两端通过批量归档/恢复、切归档清选择；`dual-branches.log` S08 / `dual-states-5.log` S09-bulk-archive。产品整批冲突/丢响应真实验证通过。 |
| S09 | 批量彻底删除 | 数量、不可恢复、取消/确认、失败保留 | 两端通过批量彻底删除取消保留选择、确认删除为空；`dual-states-5.log` S09-bulk-purge-cancel/save。 |
| U01 | 上传入口 | 按钮、多选、电脑拖入、蓝框提示及当前目录 | 两端通过真实文件按钮和电脑文件DataTransfer拖入、蓝框与释放收录；`*-U01-drop-hover.png` / `*-U01-drop-save.png`。 |
| U02 | 上传限制 | 100MB、200字符、忙碌禁用、归档禁上传 | 两端通过201字文件名及100MB+1真实稀疏文件的前置拒绝；`*-U02-long-name.png` / `*-U02-large-file.png`。归档无上传在A01核对。 |
| U03 | 上传队列 | 顺序、进度、保持列表、完成封面自动更新 | 两端通过多文件顺序收录、保持列表、处理时禁用上传与进度提示；`dual-branches.log` U03 / `dual-final-2.log` U03-busy-upload。产品实际异步封面自动更新通过 `remaining-states.log`。 |
| U04 | 重复资料 | 跳过/另存、刷新保留选择、活动/归档重复 | 两端通过发现重复后的跳过/另存；`*-U04-duplicate-skip.png` / `*-U04-duplicate-keep.png`。产品跨刷新/剩余队列不重复创建通过 `baseline-states`。 |
| U05 | 上传失败接续 | 明确失败跳过/重试、未知结果原文件重选、刷新队列 | 两端通过单文件明确失败只显示错误、未知结果使用原键重试确认；`*-U05-definite-failure.png` / `*-U05-unknown-result.png`。产品多文件失败跳过、刷新接续及重选原件通过 `baseline-states`。 |
| D01 | 详情入口 | 返回、标题、文件名、下载、更多、资料右轨 | 两端通过图片/PDF详情入口、返回、标题文件名、下载与右轨；`*-D01-image.png` / `*-U03-pdf.png`。 |
| D02 | 资料编辑 | 名称/文件夹/标签/备注、保存状态、未保存草稿刷新 | 两端通过名称与备注保存、保存按钮状态；`*-D02-edit.png`。产品草稿及刷新保留通过 `baseline-states` 保存响应丢失流程。 |
| D03 | 详情就地创建 | 新文件夹/标签选入草稿，保存后归属生效 | 两端通过详情就地创建文件夹/标签、选入草稿并保存；`dual-preview-2.log` D03。产品刷新读回通过 `baseline-existing` 首条。 |
| D04 | 详情更多菜单 | 历史/更新/补充PDF/移除补充/归档、键盘与焦点 | 两端更多菜单与Escape归焦通过 `*-D04-menu.png`；EA-resources-01已修。复审发现的portal退场新消费回归并入EA-shared-02，四类取消/原生Tab Enter/实际inert淡出/快重开及原PDF共5例通过 `lifecycle-green.log`。 |
| D05 | 更新文件 | 新旧文件名确认、取消、成功保留元数据、失败保留旧件 | 两端通过新旧文件名确认、取消保留旧件、实际更新保留备注和标签；`dual-preview-2.log` D05。候选更新确认键盘取消、归焦、重新更新通过 `final-confirmation.log`。 |
| D06 | 文件历史 | 倒序、当前/历史标记、真实下载、恢复确认与取消 | 两端通过倒序历史、取消恢复再确认恢复、当前文件与备注保护；`dual-preview-2.log` D06。产品实际历史原件字节下载与归档只读通过 `green-confirmation` 历史流程。 |
| D07 | 归档详情 | 立即返回列表、恢复后编辑、历史只下载、永久删除 | 两端归档立即回列表通过 `*-A02-archive.png`；产品恢复/删除取消、刷新、检索不再出现均真实通过 `green-confirmation`。 |
| D08 | 保存未知结果 | 提示、原键确认、后续草稿保护、刷新接续 | 两端通过metadata未知结果、返回列表仍可确认、原键确认后不覆盖后续草稿再保存；`dual-final-2.log` D08。真实跨刷新接续通过产品 `baseline-states`；原型内存模拟不承载持久性结论。 |
| P01 | 图片预览 | 实际页图、单页无翻页、下载字节 | 两端通过真实PNG页图、单页无翻页、批量下载字节一致；`*-D01-image.png` / S05。 |
| P02 | PDF分页 | 上/下、边界禁用、跳转、方向键、阅读位置保留 | 两端通过三页PDF上下页、边界、跳转与方向键；`*-P02-paging.png`。产品页面/阅读位置保留通过基线及候选真实PDF流程。 |
| P03 | 缩放 | 75/100/125/150/200%、横纵滚动、每页位置 | 两端逐档选择75/100/125/150/200%，`*-P03-zoom.png`；文字层/深浅/窄屏缩放产品通过 `baseline-states` 查找与正文流程。 |
| P04 | Office预览 | DOC/DOCX/PPT/PPTX 静态实际页 | 同一DOC/DOCX/PPT/PPTX实际上传和打开完成，`dual-office-ui.log`。原型二进制Office保持准备中，DOCX为文本模拟页；真实产品四格式逐页解码、复制、查找、原件字节全部通过 `office.log`，保留已裁决真实能力。 |
| P05 | 预览状态 | 准备中、失败重试、有限风险、不支持格式 | 两端实际坏PDF失败及重试通过 `dual-preview-2.log`；不支持格式与无效重试抑制通过 `dual-special-2.log`（原型适配器受控unsupported）。产品真实DOC有限风险通过 `office.log`，原型对应有限风险由 `prototype-controlled.log` 受控触发。 |
| P06 | 补充PDF | 逐页核对、采用/取消/移除、绑定当前文件版本 | 两端通过补充PDF取消、逐页核对/采用/移除，采用保留当前阅读页；`dual-preview-2.log` P06。原件真实下载/历史绑定另由产品预览失败与历史流程验证。 |
| P07 | 正文复制 | 拖选、复制本页、短暂成功、失败/无文字重试 | 两端通过真实PDF本页文字复制、拒绝剪贴板后的说明、扫描页无文字且页图仍可用；`dual-special-2.log` P07。产品系统拖选/剪贴板、文字读取失败重试另通过 `baseline-states`。 |
| P08 | 页内查找 | 展开、匹配计数、前后、Enter/Shift+Enter、Escape归焦 | 两端通过展开、词语、Enter/Shift+Enter与Escape归焦；`*-P08-find.png`。产品精确匹配计数/跨项选择/复制通过 `baseline-states`。 |
| P09 | 查找来源变化 | 翻页词保留/命中重置、退出清空、迟到结果隔离 | 两端无Highlight能力时保留预览/复制并禁用页内查找，通过 `dual-special-2.log` P09；产品快速翻页、迟到结果、换文件与退出清空实际通过 `remaining-states.log`。 |
| P10 | 正文搜索 | 摘录、命中页定位、待处理补充、失败/断网接续 | 产品真实正文摘录/定位、读取失败与断网接续、归档独立检索全部通过 `baseline-states` / `remaining-states` / `green-confirmation`。原型即时正文适配器不模拟增量读取时长，普通同词查询和零结果两端已实际对照。 |
| R01 | 识别入口 | 与查找互斥、仅明确操作发任务、引擎不可用禁用 | 两端实际面板、明确本页操作与查找互斥通过 `dual-recognition-2.log` R01；产品引擎不可用禁用分支在未配置引擎的 `dual-audit-4.log` R01，读取不触发模型由固定回放检查。 |
| R02 | 识别生命周期 | 本页/剩余、进度、停止、失败重试、未知结果刷新 | 产品固定回放真实HTTP/Job/SQLite的停止/失败重试、原键未知恢复、刷新与引擎修订全部通过 `baseline-states` / `remaining-states`；两端本页/剩余页通过 `dual-recognition-2.log`。原型即时Job的运行/停止/失败重试UI以 `prototype-controlled-lifecycle-2.log` 明确受控，未冒充实际识别。 |
| R03 | 识别阅读 | 公式表格题图、只读提示、原文复制及剪贴板失败 | 两端受控疑点正文、复制/拒绝剪贴板自动原文、1440/1024/768/390无横溢通过 `dual-recognition-2.log`。产品I-1/I-2固定回放另验证真实公式/题图、深浅阅读及刷新来源，`baseline-states`。 |
| R04 | 识别来源 | 分页/换文件/替换/搜索命中及过期来源 | 两端换页清除前一页标记、识别/查找互斥通过 `dual-recognition-2.log`；产品真实换文件/另一客户端更新/OCR搜索定位/引擎修订按固定回放通过 `green-confirmation` / `remaining-states`。原型无多客户端持久服务，不作该服务能力的替身。 |
| R05 | 疑点位置 | 原因、原页框、换页清除 | 两端通过具体疑点原因、原页区域、200%缩放与换页清除；`dual-recognition-2.log` R05 / `*-R05-locate.png`。产品使用仓库已认可的localized content issues受控recognizer，经真实HTTP/SQLite保存；原型同box条件注入只读适配结果，不改原始固定回放、不证明OCR质量。 |
| A01 | 归档列表 | 空态、计数、独立搜索、无上传/拖动/标签筛选 | 两端通过归档计数/入口/无上传与空态，`*-A01-archive-view.png` / `*-S09-bulk-purge-save.png`。 |
| A02 | 归档恢复删除 | 恢复/删除确认取消、刷新及检索无已删除条目 | 两端通过恢复/批量删除取消确认；产品详情恢复/彻底删除及刷新真实通过green-confirmation。 |
| X01 | 键盘菜单 | 箭头/Home/End、Escape/Tab/Shift+Tab、关闭归焦 | 两端实际类型筛选打开后焦点留触发器、End无导航、Escape关闭保留焦点，`*-X01-menu-keyboard.png`；符合原型现状，不扩大共享导航行为。详情更多菜单Escape归焦通过D04。 |
| X02 | 标签弹层 | 连续打开/保存/失败/取消、焦点保留及退出 | 两端标签弹层连续创建/重复/取消/编辑/二次删除已完成；`dual-audit-4.log` / `dual-branches.log` T组。产品新设备与刷新颜色通过baseline-existing。 |
| X03 | 桌面尺寸 | 1440/1024、主区与右轨等高、各自滚动 | 两端1440/1024/768/390列表与识别详情尺寸无横溢；`*-X03-list-*.png` / `*-R03-controlled-*.png`。产品普通详情同尺寸独立滚动/保存/下载通过baseline-existing。 |
| X04 | 窄屏尺寸 | 768/390、右轨折上、表单独立滚动、预览可用、无横溢 | 两端390普通详情及四档识别详情实际可见，无横溢；`*-X04-narrow.png` / `*-R03-controlled-*.png`。产品表单独立滚动、预览可用和原件下载另有真实断言。 |
| X05 | AI辅助栏 | 覆盖右轨、浏览/返回不抢占、主区宽度保留 | 两端通过AI覆盖右轨、浏览返回保留AI，`*-X05-aux.png`；产品主区宽度不变实际断言通过baseline-existing。 |
| X06 | 中英深浅 | zh/en × light/dark、列表/详情/弹层/长名称 | 两端同份PDF中英×深浅4组合全部通过；`*-X06-dark-zh.png` / dark-en / light-en / light-zh。实际均显示Resource library，排除未使用词库的假阳性。 |
| X07 | 动态偏好 | 正常进退/折叠、reduce、关闭后继续操作 | 两端reduce下标签连续开闭、归焦通过 `*-X07-reduce-dialog.png`；正常拖动/折叠/确认进场实际核对。 |

## 问题

- **EA-resources-01，原有偏差，已修复**：详情更新/归档/恢复/彻底删除确认使用旧 ResourceDialog，缺统一图标、alertdialog、取消在左与确认在右，归档错误使用危险色。完整原型 `ui/app.js:100888` 使用 KitConfirmDialog。基线真实PDF新断言红证据 `red-confirmation`，候选复用共享 ConfirmDialog；真实更新取消的键盘环回、原件保留、重新更新、归档恢复删除通过 `green-confirmation-focus.log`。
- **EA-shared-02 的资源新消费者回归，已修复**：本轮将详情确认迁移为portal后，原外层ModulePresence仍保留旧组件180ms，实际portal跳出inert，取消后Tab/Enter可执行旧操作。独立审查固定 `a91cc0e0` 已真实复现归档POST。共享生命周期由总控修复，资源四类确认移除外层包装、始终渲染并传受控present。旧候选四条新回归均红；新候选四类关闭/淡出/快重开加原PDF流程5条通过，原始复现复制重跑无写请求。证据 `lifecycle-red.log`、`lifecycle-green.log`、`lifecycle-recheck/standards-confirm-lifecycle.json`。此共享根因由总控计一次，资源迁移引入的新消费面不再新增基线问题数。
- **测试缺陷，已修复**：确认文本迁移时曾误改批量Organize的按钮查询，导致green批量用例失败；还原批量的“确认 归档/恢复”后 `green-batch-recheck.log` 通过，不计产品问题。
- **排除项**：折叠层被裁切节点Playwright仍报可见、文件Buffer上传50MB上限、单文件明确拒绝不保留队列、FilterMenu无End/Home导航，均已按真实动作/源码修正审计判据；没有据此制造产品问题。

## 接续

69行均已记录实际结果或明确模拟差异，双端120个具名检查点通过；此前按缺口选择的35个不同现有资源E2E已实际通过；复审仅定点新增4类退场回归及重跑1条既有PDF流程，5例通过，未重跑全套。真实OCR运行1例依费用边界跳过。原型静态模拟与真实产品的转换/任务/持久性差异已在相应行明确，不用静态适配器代签真实服务。

本线源码冻结供集中审查：`apps/web/src/features/resources/index.jsx`、`apps/web/e2e/resources-ui.spec.js`，稳定行为同步 `docs/features/resources.md`，清单为本页。固定基线 `test-results/experience-audit/baseline-web`，当前复审候选 `test-results/experience-audit/resources/lifecycle-candidate-web`（复审基线 `a91cc0e0`，未提交）。回执及精确输入摘要见 `test-results/experience-audit/resources/receipt.md`，有效证据保留至总控集成收口。未提交Git，未触及50880、私人配置或付费模型；独立审查/完整CI/集成由总控执行。
