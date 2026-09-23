# 数学源、渲染与公共接缝

[数学契约](../contracts/workbench/math.md)拥有字段、版本及隔离语义；[功能规格](../features/math.md)拥有制作与返回行为。

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
| `classes.listSourceRecordsV2(principal,{kind,id})` | 教学时间新版的RecordList；math分支语义见扩展，不借用UsageList | classes 提供；math页面由M43的可选反馈容器消费 |

`files.store/read/open`、`content.validate`原样复用冻结[材料端口](materials.md#公共端口)。math无业务必需依赖；lessons工厂在原questions/resources外显式注入math；classes 通过 math 教学端口读取，schedule不因此反向依赖工坊。显示反馈只经组合层注入，不把classes注册成math的强制依赖。

返回过程由lessons拥有草稿与ReturnTarget，math拥有编辑并返回已保存id/version；不用URL携带全备课，不新建“跨模块事务”表。API/Agent写者也必须先保存作品再保存备课，并分别报告结果。

## 运行、迁移与验证

M41迁移保留R31全部File/Document/旧引用和认证表；M42增加源分支不重写M41 revision；M43新增引用类型读取，不批量改旧快照。空库、R31旧库、含M41作品库、含R35备课库分别迁移并重启两次，ID/版本/旧未确认请求不变。配置入口沿底座隔离DB/文件目录，无新模型凭据；MathJax与需要的字体/离线脚本跟应用构建，运行时不拉CDN。

验证分为：公开HTTP的事务/归属/版本；浏览器真实制作/重开/导出；数学结果与图形目视；最终下载物冷启动；目标PPT/WPS取用。源码结构测试不能替代图片检查，C23原件不能替代最终实现导出。自验结果均self，M44独立复现WB-MA001至017及019/020并按缺陷归属返回；WB-MA018归T51在M44提供方到达后实现、T54独立验收，不由M40作者代签。
