# R33 attempt5 固定候选与独立复验入口

限定结果：R35-LOCAL-002至005 self PASS，详见[回执](attempt5.md)。完整R33/R35未通过。八项既有消费 independent PASS保留，两项历史fetch观察OPEN保留。

## 固定版本

| 含义 | 完整SHA |
| --- | --- |
| 用户固定P | `3a10e0d5108a4950bba0851610bae7d8495dc8ff` |
| P产品 | `18a80073380116e1d30165f0001a86e5fdb2304c` |
| 当前根规则/台账 | `f5356029c6ab8e21b15569f338eeaf9c5941e2b7` |
| 组合fixed point | `afdb8f96098e77cfac076179ea0fd2be05bb7c9c` |
| 修复代码、API/E2E、独有配置 | `331bd367df450522fb54982984c452c6bb8d4c52` |
| 完整可复验产品与证据快照 | `de7ca7374f5645342b9ed87870270d9a3bcb5da2` |

回执文档提交只补交接元数据，不变更上述产品或原始证据；包含回执的交付提交由外层最终消息固定。独立复验应使用完整固定SHA，不能取浮动分支。

## 修改范围与公共接线

产品修改仅5个文件：

- `apps/web/src/features/questions/index.jsx`：把既有 `shell.openPanel("questions-classification")` 传给模块页面。
- `apps/web/src/features/questions/MaterialsQuestionsPage.jsx`：明确点击分类管理时进入管理并显示工具，工具根增加局部样式容器。
- `apps/web/src/features/questions/questions-materials.css`：工具内控件边界、输入收缩和单行按钮。
- `apps/api/src/modules/questions/assets.js`：PNG分片高度计算计入完整末尾间距，单块超界明确失败。
- `apps/api/src/modules/questions/extraction.js`：失败状态根据仍保留的内容区分failed/partial。

测试新增仅 `apps/api/test/materials-questions-local5.test.js`、`apps/web/e2e/materials-questions-local5.spec.js`、`apps/web/e2e/fixtures/materials-questions/attempt5.config.mjs`。其余为本次attempt5证据及回执。

**公共接线需求：无。** 不改App、外壳状态接口、公共渲染、目录/迁移runner、依赖锁、lessons/math装配。M43独占范围未写入。集成者可消费代码提交，公共变更不需要接管；组合基线保留根台账的5份文档不属于产品补丁。

## 独立复验

先在自己的新checkout/库/端口中固定上述候选并执行 `npm ci`，不要启动或写入来源现场。Node 22.23.2；Office路径为已存在的只读工具，不读取产品密钥。

```bash
npm run build
R33_LOCAL5_EVIDENCE="$PWD/test-results/independent-local5/api" \
  node --test apps/api/test/materials-questions-local5.test.js
R33_LOCAL5_EVIDENCE="$PWD/test-results/independent-local5/ui" \
  npx playwright test --config apps/web/e2e/fixtures/materials-questions/attempt5.config.mjs
```

HTTP测试自建独立库与动态端口，Provider只注入本地返回体；浏览器测试自建真实认证/fake-mail HTTPS服务及独立浏览器上下文。独立采集应写新输出目录，不能覆盖attempt5下原物。若系统tmp空间有限，先给 `TMPDIR` 指定自己的工作盘目录；当前测试fixture仍有具名`/tmp/r33-local5-*`库，测试完成后按自己的现场管理。

四项可手工复验入口：

1. 真实外壳题库，辅助栏关闭后点击分类管理；在AI页签有草稿时点击分类管理，再切回AI。普通搜索保持AI页签。
2. 采用[长题HTTP输入](attempt5/red/LOCAL003-long-png.json)中的题目请求，通过正式assets入口重新生成；检查每个原PNG宽1600、高不超过2400且有透明通道。高度边界输入由local5 API测试直接构造。
3. 默认辅助栏300px，创建题型和标签，1440×900、1280×800、1024×768截图并测删除文字，保存刷新删除。1024是冻结外壳覆盖式工具，返回主区先普通点击关闭。
4. PNG上传后单页Provider空正文应failed、0草稿、0片段且empty-response；非法正文原文片段、完整前缀、成功页混合空页仍partial，原件可读。相同输入脚本在local5 API测试，不要调用在线Provider。

实际外壳临时服务可使用既有入口，在自己的目录与空闲端口启动：

```bash
R34_PORT=50351 R34_DATA_DIR="$PWD/test-results/independent-local5/manual" \
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 \
  node apps/web/e2e/fixtures/materials-integration/server.mjs
```

访问 `https://127.0.0.1:50351`，真实注册登录；fake-mail只在新目录中查看，不提交验证码、Cookie或口令。需要自己的T/W/片段回归时复用原有questions fixture和三份E2E。全API入口仍为 `npm run test:api`，Office环境同上。

**原有回归测试会写硬编码证据路径。** 因此全API及原questions E2E只在独立临时副本执行，保存新产物时另建目录，不能对来源工作树或本次正式证据执行。此次已这样执行并校验185个产品文件与候选相同，见[composition](attempt5/composition.json)；测试本身没有修改以追绿。

## 停写与未决项

本次50251/50252/50253服务及 `r33-attempt5` axi浏览器已停止。保留库、隔离副本与原始日志位置见[runtime](attempt5/runtime.json)，独立验收若复用必须先复制后换端口。来源R35现场从未写入。

Standards与Spec内部审查各0 findings，不替代independent。历史fetch OPEN、真实在线提取、新教师材料、目标Office/打印/物理设备仍按既有归属等待，不因本候选新绿灯关闭。仅任务分支提交，不合main、不push、不部署、不跨session互聊；由外层唯一回调交回。
