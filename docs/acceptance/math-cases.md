# 数学交换验收

核验[数学交换契约](../contracts/math.md)时读本页。本文拥有交换顺序与双侧断言，字段归机器契约；结果和未验条件归[运行台账](../plans/run-state.md)。协议或保护行为改变时同步用例，场景编号保持稳定。

与同提交 [schema](../../apps/api/src/contracts/math.openapi.json)、[样本](../../apps/api/test/fixtures/contracts/math-samples.json)一起消费。样本 UUID 是隔离 fixture 标识，不是生产种子。前端替身按下表返回已定义结果；后端从公开 HTTP 用相同顺序断言，均不需要另一侧猜字段。替身只能记 self。

| ID / BDD | 输入、结果与双侧断言 |
| --- | --- |
| MC01 / WB-MA001、002 | POST create-formula →201 saved-work；PUT update-formula →200 version=2，原version=1仍可GET；render海报非空。源改为错误TeX仍保存且invalid，只能导出source。公式说明选入时图中有中文，分段式条件逐行正确。 |
| MC02 / WB-MA003、004 | create-plane/triangle/space 保存；改Q2常数-2，顶点(1,-3)、零点1±sqrt(3)；改三角形标注位置颜色；改AC1线型；重新读取源、PNG/SVG，不能只检查文件扩展名。 |
| MC03 / WB-MA005、006 | create-dynamic 保存，改a范围[-3,3]、步长0.5、步骤标题后PUT；重启重读相同源。每步visibleIds及完整values决定图/点/标签，回到初步保持初态；自由探索不发写请求。 |
| MC04 / WB-MA007、008 | 用C23实际M-X字节POST files，得到F1；create-html使用F1两字段。编辑标题及range得到F2，PUT仅source.fileId=F2；originalFileId仍F1，取回逐字相等。上传F2成功、PUT响应丢失，同键重试只得同一revision。 |
| MC07 / WB-MA013、014 | export-transparent 返回File及固定workVersion；用透明度/像素、SVG结构和外部PPT实际插入核验。export-html 原生offline=self-contained，外部unverified；UI对应措辞。全新Chrome配置禁网、关闭服务，双击真实下载物，键盘/拖动/步骤仍工作。 |
| MC08 / WB-MA016 | 两客户端读version1，A写得2，B以1写409 version-conflict；B源保持。A响应丢失时先同键确认，再GET当前版本，不因超时再建作品。同键异体409；服务重启仍可确认。 |
| MC09 / WB-MA017 | 未绑页面/过期Cookie401；错误Origin403先于业务；另账户读作品/历史/File/导出/引用统一404。身份切换销毁iframe、锁原草稿；迟到回包不显示到新账户。缺文件503，元数据保持。 |
| MC12 / WB-MA020 | 在隔离测试中math缺提供方、目录重复ID/path或加入必需依赖环，拒绝装配；HTTP fixture 422 invalid-input，reason=invalid-reference或duplicate-id，field指向错误descriptor。材料+math与当前组合目录均检查。 |
| MC13 / WB-MA015 | 无模型直接经port调用list/get/create/update/export，结果同HTTP；传accountId或snapshot拒绝。Agent操作清单只暴露声明操作，不能访问SQL、磁盘路径、Cookie或执行HTML。真实模型制作归后续Agent验收，不由此用例代签。 |

### 结构与数学的反例

schema层反例在samples的valid=false中；业务层以下输入均可由合法样本单字段修改形成。前端定位同一字段，后端返回同一type；不能只靠JSON Schema通过。

| 变体 | 预期 |
| --- | --- |
| 参数name重复、min≥max、initial超界、step≤0、初值不在网格 | 422 invalid-math-source，field指第一个参数错误；原version不变 |
| steps少一个参数值、visibleIds缺对象、拖点绑定不对应坐标表达式 | 同上，分别定位steps/drags |
| view.xMin=xMax；edge引用不存在点；同source内重复element ID | 同上，不能部分保存 |
| 公式不闭合；expression为 `x+)`；椭圆rx为 `-1` | 结构合法，200保存且render=invalid/reason，poster=null；不可拿上次海报导出 |
| `1/x` | x=0处断开，两支不跨原点连线；可保存ready |
| `sqrt(x)` | x<0不绘制，不生成NaN坐标；可保存ready |
| `-2^2`、`2^3^2`；负数系数/零系数 | 分别-4、512；标签和有限坐标正确，零系数不得继续称抛物线顶点 |
| source.kind在更新时改变 | 422 invalid-math-source；另建作品承载另一种源 |
| 原件F1属于另一账户或F2不存在 | 404，不透露文件存在性；作品无变化 |

### 隔离反例与结果核验

M42建立小型测试HTML，分别尝试读parent.document/document.cookie/localStorage、伪造postMessage写作品、form/fetch/WebSocket、远程script/img、window.open、top导航、iframe/worker、`</script>`闭合和自导航。主账户数据与Cookie/PageContext始终不可读，主应用业务无变更；CSP/sandbox预期阻断的请求记录到网络证据。自导航不应被宣传为完全禁网，必须观察销毁/受限反馈。预览本身不得获得认证API能力。坏脚本停止后源和原文件仍能取回。

先用真实浏览器打开/运行按钮触发，再观察请求/DOM；不得用父页面直接eval代替验证隔离。C23的精确M-X、含CDN HTML、损坏HTML和大于1MiB的HTML分别覆盖可运行、受限、源码保留及大小上限。运行副本中CSP不能被源内meta覆盖。下载原始HTML与隔离包装器分别检验，不拿原始文件的行为冒充包装器行为。
