# Math 架构与交接

状态：M40/v1设计候选，外层 independent 冻结后实施。唯一语义与字段在[契约](../contracts/workbench/math.md)，实验消费在[math-evidence](math-evidence.md)，执行从[M41-M43任务包](../plans/tasks/math/README.md)进入。保留 React/Vite、Express、SQLite 单一后端和[静态模块目录](../adr/0001-use-a-single-static-module-catalog.md)，不增加服务、消息队列或运行时插件。

## 选择与数据归属

采用 C23 候选A的本地 MathJax 3.2.2 + 原生 SVG/JavaScript。公式路径已有可编辑源与PNG/SVG实证，静态/动态的受控数学源由本批明确化，不能把C23的硬编码按钮或localStorage迁作产品存储。JSXGraph候选B未运行，无证据要求引入第二套制图内核。函数用封闭表达式解析器和单一求值实现，UI、导出、Agent共用；无eval、服务端运行任意JS或通用脚本平台。

Math Module 吸收制作源、历史版本、数学校验、可信图形渲染、隔离预览包装与成果导出。调用者只使用小的业务Interface，不了解渲染步骤/临时文件。持久资产调用R31 File接缝；事务内只做同步归属/版本/快照检查，文件字节与重渲染在事务外准备。成功文件写入后再次校验当前版本，同一mutations事务保存Work/Revision/成功回执；冲突留下的File按材料规则保留，不回滚或删除用户原件。

| 所有者 | 数据与持久性 |
| --- | --- |
| math | accountKey、Work、完整WorkRevision、渲染标识/固定海报/隔离演示文件、导出记录/版本/选项/fileId；软删除；迁移 `math_*` |
| files | 原始HTML、编辑后的HTML、规范JSON下载、PNG/SVG/隔离HTML字节；不可变、授权读、fsync提交；不新增HTML执行权限 |
| lessons | v3含math引用的完整聚合、采用快照、本课备注、使用位置；迁移 `lessons_math_*`；旧question/resource语义不变 |
| classes | 教学记录和反向反馈链接；math只供读取和页面组合，不写该表 |
| Web feature | 按账户分区的未保存稿/未知请求/设备现场；无业务唯一数据只存在localStorage |

math源与revision保存JSON，但必须按唯一schema及跨字段规则校验。文件ID不作为可执行URL。源码下载JSON不携服务器私有标识；原版Source可以通过API读取，备份包含服务器关联。数学导出纯本地有界任务，同步响应足够；单用户体量不需要给材料Job枚举追加任意工作流。源码、海报和导出有明确所有者，避免两套“资源”和“作品”编辑状态。

## 公共接口与唯一写者

公共方法由 Module 工厂提供，DTO直接使用math.openapi.json命名类型；不再手写第二份JSON模型。业务异常仍为 `{status, problem}`，principal只从可信入口传入。提供方只读方法必须同步，供同一SQLite事务调用；绝不借HTTP回环或跨表访问。

| Interface | 结果 / 语义 | 提供 / 消费 |
| --- | --- | --- |
| `createMathModule({db, mutations, files, content}) -> {router, port, migrations}` | 仅声明式组合，构造时不读业务；renderer为math内部依赖 | M41共用骨架，M42顺序接续 |
| `math.port.operations.<operationId>({principal,key,input,id,query})` | Promise<{status,body}>；操作与HTTP逐一对应，读省key，无字段不传；version历史路径由query.version传入 | M41/M42实现；UI/Agent消费 |
| `math.readForReferenceV1(principal,id)` | 同步ReferenceReadWork，当前本账户含tombstone；只投影保存结果，不现场生成文件，invalid仍可读，调用者决定能否新引用 | M41提供基础，M42补完整Source；M43 lessons消费 |
| `math.readForTeachingLinkV1(principal,id)` | 同步TeachingWork，只投影id/version/title/deletedAt，不含源或文件 | M41提供；T51消费 |
| `lessons.listUsagesV3(principal,{kind,id})` | 同步UsageList，kind=question/resource/math；原listUsages不变 | M43提供，math使用位置消费 |
| `lessons.port.operations.<v3 operationId>(...)` | 同HTTP，完整聚合一次保存，新增/更新引用同一事务解析math | M43 |
| `classes.listSourceRecordsV2(principal,{kind,id})` | 教学时间新版的RecordList；math分支语义见扩展，不借用UsageList | T51后续扩展；math页面由M43的可选反馈容器消费 |

`files.store/read/open`、`content.validate`原样复用冻结[材料端口](materials.md#公共端口)。math无业务必需依赖；lessons工厂在原questions/resources外显式注入math；classes未来增加math，schedule不因此反向依赖工坊。显示反馈只经组合层注入，不把classes注册成math的强制依赖。

返回过程由lessons拥有草稿与ReturnTarget，math拥有编辑并返回已保存id/version；不用URL携带全备课，不新建“跨模块事务”表。API/Agent写者也必须先保存作品再保存备课，并分别报告结果。

### 分阶段写权

以下表是本批唯一写入清单；阶段按M41→M42→M43串行交接，后继只接完整固定SHA并确认前继停止写入。R31/R34/T53拥有的公共文件不因本表而变成并行可写；跨批公共写权由外层串行交接。没有租用权时只在本节点integration.md列需求，不联系业务session或自行改共享入口。

| 写者 | 模块与测试独占路径 | 公共文件与接续 |
| --- | --- | --- |
| M41 | `apps/api/src/modules/math/`、`apps/web/src/features/math/`、`packages/shared/src/math/`；`apps/api/test/math-static*.test.js`、`math-contract*.test.js`；`apps/web/e2e/math-static*.spec.js`、独有`fixtures/math-static/`；`docs/acceptance/evidence/M41/v1/` | 拥有math聚合/迁移/端口/源校验/公式/平面/立体/静态导出，预留已定dynamic/html分支；不改lessons/files/认证。无公共装配写权，以独有fixture真实挂载Module进行自验，提交准确集成需求。 |
| M42 | 接手上述math三个目录中共用骨架，并新增动态/HTML内部实现；`apps/api/test/math-dynamic*.test.js`、`math-isolation*.test.js`；`apps/web/e2e/math-dynamic*.spec.js`、`math-isolation*.spec.js`及独有fixtures；`docs/acceptance/evidence/M42/v1/` | M41固定并停止后为math唯一写者，必须回归M41。不并行改共用源存储/schema；不扩材料Job，不自改公共锁/入口。 |
| M43 | math模块仅装配/往返/使用位置/可选反馈；`apps/api/src/modules/lessons/`中v3适配、迁移与输出投影；`apps/web/src/features/lessons/`中取作品/返回/引用；`apps/api/test/math-integration*.test.js`；`apps/web/e2e/math-integration*.spec.js`与独有fixtures；`docs/acceptance/evidence/M43/v1/`（含Agent操作清单） | 必须收M42、R35固定候选及共享写权；独占下表装配文件。模块缺陷回原节点修复后重新固定，不覆盖资源/题库/认证实现。 |

M43可接手的公共文件逐项为：根`package.json`、`package-lock.json`，`apps/api/package.json`、`apps/web/package.json`、`packages/shared/package.json`；`packages/shared/src/index.js`及R31回执明确的静态目录/校验文件；`apps/api/src/app.js`、`server.js`、`core/moduleRegistry.js`、`apps/api/src/workbench/`直接子级组合/迁移runner；`apps/web/src/App.jsx`、`main.jsx`、`features/modules/moduleRegistry.js`、`features/workbench/`外壳装配、`components/WorkspaceSidebar.jsx`、`store/useAppStore.js`、`hooks/useWorkspaceData.js`、`utils/api.js`、`styles/global.css`；`apps/web/vite.config.js`、`playwright.config.mjs`、`apps/web/e2e/helpers.js`、`api-server.mjs`；`README.md`仅同步真实状态。非上述路径不得借“集成”取得写权；实际固定底座若拆分入口，外层先固定替代路径。

M41/M42需要依赖变更时交integration.md给外层当前公共写者安排，只有显式独占交接后才能改列出的manifest/锁文件；不能手改自动生成锁内容。若依赖缺失阻止真实自验，就保留该片待接，不能用替身冒充生成PNG/持久文件。隔离测试fixture可组合真实R31底座和math，不注册生产虚模块。

T51独占classes实现教学math分支，T53独占教学时间装配。M43可预留接收反馈组件的容器，T53不得直接进math内部修行为；若M43后再装反馈，由外层把math页面装配的单一文件交给一个写者，固定新候选后回归。M43与T53也不能分别覆盖两套version=2目录，均消费本版version=3组合规则。

## 运行、迁移与验证

M41迁移保留R31全部File/Document/旧引用和认证表；M42增加源分支不重写M41 revision；M43新增引用类型读取，不批量改旧快照。空库、R31旧库、含M41作品库、含R35备课库分别迁移并重启两次，ID/版本/旧未确认请求不变。配置入口沿底座隔离DB/文件目录，无新模型凭据；MathJax与需要的字体/离线脚本跟应用构建，运行时不拉CDN。

验证分为：公开HTTP的事务/归属/版本；浏览器真实制作/重开/导出；数学结果与图形目视；最终下载物冷启动；目标PPT/WPS取用。源码结构测试不能替代图片检查，C23原件不能替代最终实现导出。自验结果均self，M44独立复现WB-MA001至017及019/020并按缺陷归属返回；WB-MA018归T51在M44提供方到达后实现、T54独立验收，不由M40作者代签。
