# M43 集成与 M44 复跑入口

本候选的 **M43 数学切片 LOCAL_SELF_PASS**，不是完整 R35/M43/M44 或 T51/T54 PASS。当前产品 `909693a7cc67f50a523ea94864ef7b80a345d5df`，含 fixture 与测试清理修正的代码 `965f813626fc40ba5fb8c04f0495c825f825b469`。固定组合、全部来源及逐项结果以 [author.md](author.md) 为准；完整回执 SHA 由最终交回消息固定。

## 实际运行与身份

在本分支根目录运行，Node.js `22.23.2`：

```bash
npm ci
npm run build
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
M43_DATA_DIR=/tmp/teacher-m43-manual node apps/web/e2e/fixtures/math-integration/manual.mjs
```

地址由进程打印，真实认证 / fake-mail / 自签 HTTPS；测试账户 `m43@example.test`，密码 `math-password`。默认创建独立目录，重启复用原账户和作品。Office 路径是本机验证依赖，其他机器须指定自己的受支持安装。此入口没有模型 provider 或真实邮件。首次目录启动已实际验证 `/api/health`，检查目录 `/tmp/teacher-m43-manual-check`，服务已停止。

M43 主浏览器场景使用正式 App，绝非独立 math 页面冒充整合。继承 M42 回归仍使用其真实认证数学 fixture，用于确认数学算法/身份边界未回退。迁移测试标为 test-principal，不能代替上述真实认证浏览器结论。

## 可重复验证

```bash
node --test apps/api/test/math-integration*.test.js
TMPDIR=/home/liam_t/.cache/m43-validation npx playwright test -c apps/web/e2e/fixtures/math-integration/playwright.config.mjs
npm run build
```

本机浏览器最终使用磁盘 TMPDIR，两套套件串行执行；其他机器可选自己的充足空间临时目录。环境异常与控制条件见 [观察](browser-failures/observation.md)。

实际最终结果：集成 API 5/5；主集成浏览器 6/6（含长课滚动、干净原稿并发冲突及目标移除）；全 API 296/296；材料 E2E 7/7；M42 动态/隔离 6/6；数学静态真实认证 7/7。日志与对应范围见 author。E2E 不发送 AI 输入，下载按钮走实际导出与文件服务。

继承测试会写入 R33/R34 等旧证据路径。为保留原证据，本轮全 API、继承材料/数学 E2E 在 **独立验证副本 `/tmp/m43-suite`** 执行，独立 `npm ci`，没有共享数据库或 node_modules 写目录。API/shared 字节一致性见 [integrity.json](integrity.json)。M44 应在自己的隔离副本执行：

```bash
npm ci
npm run build
npm run test:api
npx playwright test -c apps/web/e2e/fixtures/materials-integration/playwright.config.mjs
node apps/web/e2e/fixtures/math-static/build.mjs
npx playwright test -c apps/web/e2e/fixtures/math-dynamic/playwright.config.mjs
npx playwright test -c apps/web/e2e/fixtures/math-static/real.config.mjs
```

本轮复制了 `apps/`、`packages/`、`docs/`、`scripts/` 与 manifest/lock；未复制 node_modules/dist/public，随后安装与构建。隔离副本须保留 Git 对象可读性，旧 T53 迁移测试需要 `git archive` 固定对象。需要的 R33/R34 证据父目录应存在，不能把缺目录或缺外部转换器算成产品结果。

## 迁移输入与保留现场

| 输入 | 源与结果 |
| --- | --- |
| 空库 | 每个主集成测试新建独立目录；真实目录 v3，11 条业务/底座迁移只运行一次；真实认证再使用原认证迁移 |
| P 保留库 | `/tmp/teacher-r34-attempt5` 停写源的完整副本；原库不写。结果与副本位置见 [migration-P.json](migration-P.json) |
| 已有 M 库 | 从完整固定 M `b0703907a7339513ed34bfed5c1e6787cc65d37d` 源运行真实数学 API，先建立公式、平面、动态及其持久文件，再复制到当前实现。结果见 [migration-M.json](migration-M.json) |

迁移测试在每份副本上重启两次。比较旧 lesson/question/resource/math 行、`materials_files`、幂等账本的内容 hash；逐文件核对字节；读回原 Work ID/version/render File IDs，并以原键原体重放原 M 创建请求。新增空表不算旧内容改变；不拿当前实现先建库冒充旧 M 输入。

本机已有 M 源库 `/tmp/m43-original-m-library`、固定源 `/tmp/m43-fixed-m-source`。从干净目录重建的直接步骤：

```bash
python3 docs/acceptance/evidence/M43/v1/prepare-fixed-m.py
cp docs/acceptance/evidence/M43/v1/seed-fixed-m.mjs /tmp/m43-fixed-m-source/seed.mjs
M43_M_LIBRARY=/tmp/m44-original-m-library node /tmp/m43-fixed-m-source/seed.mjs
M43_M_LIBRARY=/tmp/m44-original-m-library M43_P_LIBRARY=/tmp/teacher-r34-attempt5 node --test apps/api/test/math-integration-migrations.test.js
```

准备脚本只从具名 Git 对象取源并链接本次已装依赖；seed 拒绝向已有作品库再次写入。使用空闲端口 `49943`。P 的库必须来自固定交接保留物，不能重新空建。最新真实浏览器现场路径在 [roundtrip.json](browser/roundtrip.json)，旧未知请求在 [old-request-confirmed.json](browser/old-request-confirmed.json)，未知带回原键/原体在 [unknown-return.json](browser/unknown-return.json)。所有服务已经关闭，保留 SQLite/files 供 M44 检查。

## 实际操作清单

数学契约唯一入口：[math.openapi.json](../../../../contracts/workbench/math/math.openapi.json)。身份/保护由现有 transport 持有，不把 Cookie、页面绑定或账户键放入模型输入。HTTP 实际存在；后端 Agent 可消费既有 `loader.get('math').port.operations` 与 `loader.get('lessons').port.operations`，不绕过 principal/版本/幂等。以下清单不是新的 Agent runtime，也不代表 Agent independent 通过。

| operationId | 实际 HTTP | 参数 / schema |
| --- | --- | --- |
| `getMathModuleCatalog` | GET `/api/modules` | 无 body；`ModuleCatalogV3`，六个真实模块及冻结依赖 |
| `listWorks` / `getWork` | GET `/api/modules/math/v1/works` / `/{id}` | 冻结 q/kind/state query 与 UUID 路径 |
| `createWork` / `updateWork` | POST `/works` / PUT `/works/{id}` | `CreateWork` / `UpdateWork`；Source schemaVersion=1，修改带 baseVersion |
| `copyWork` | POST `/works/{id}/copy` | `CopyWork`，当前 baseVersion；新 ID/version=1 |
| `setWorkDeletion` | POST `/works/{id}/deletion` | 冻结删除体；软删除/恢复均版本化 |
| `listWorkVersions` / `getWorkVersion` | GET `/works/{id}/versions` / `/{version}` | 不改写历史源和文件 |
| `readWorkForReference` | GET `/works/{id}/reference` | `ReferenceReadWork`；服务器生成快照，客户端不能提交 snapshot |
| `exportWork` | POST `/works/{id}/exports` | `ExportWork`；原生 PNG/SVG/source、动态 HTML、外部 HTML/source 按冻结种类约束 |
| `listLessonsV3` / `getLessonV3` | GET `/api/modules/lessons/v3` / `/{id}` | 原材料查询与完整 v3 对象 |
| `createLessonV3` / `updateLessonV3` | POST `/v3` / PUT `/v3/{id}` | `CreateLessonV3` / `UpdateLessonV3`；MathReferenceInput 只有 id/kind/workId/workVersion/note |
| `setLessonDeletionV3` | POST `/v3/{id}/deletion` | 原删除请求，不接受旧路径有损写 |
| `listUsagesV3` | GET `/v3/usages?kind=math&id=...` | 同时支持 question/resource，先验证本账户来源，返回实际环节和采用版本 |
| `exportLessonV3` / `listLessonExportsV3` | POST / GET `/v3/{id}/exports` | 复用材料 ExportInput/ExportRecord/Job；异步成功后下载真实 File |

数学表中 `/works` 缩写均以前述 `/api/modules/math/v1` 为前缀；备课 `/v3` 均以 `/api/modules/lessons` 为前缀。File 上传/下载与 Job 查询沿 P 契约，不新增伪造下载入口。

实际顺序：读取/制作 Source，`createWork` 或 `updateWork` 得到已确认 ID/version；需要独立修改时先 `copyWork` 再修改新作品。返回由 lessons 账户现场持有 ReturnTarget 和完整草稿，math 只交已确认 ID/version；lessons 插入引用后执行自己的 `updateLessonV3`。两次保存、两套键，没有跨模块事务或名为“returnWork”的虚构服务端操作。冲突先对照，环节删除必须显式转本课材料或取消；返回失败保留作品与原稿，未知结果在原方法/路径用原键原体确认。旧请求缺 apiVersion 时仍用旧 v2 路径；成功回执不降级服务器新版本。

classes v2 记录 CRUD/反向查询沿 [教学数学契约](../../../../contracts/teaching-time-math.md)，数学提供 `readForTeachingLinkV1`，不是备课快照。实际记录显示初次 labelAtLink 与当前名称，数学页装配 `SourceRecordsPanel`；去作品再返回原记录已浏览器验证。完整教学组合的旧题目接口冲突保留 OPEN，见 author。

## 成果与离线边界

- [真实页面下载的教案 DOCX](browser/math-lesson.docx)、[PDF](browser/math-lesson.pdf)；五类数学教案/讲义在 [output/](output/)。Word XML 中公式为 OMML，图形/立体/动态共三张固定 PNG，HTML仅标题及单独文件提示。学生输出没有引用私密备注。
- [透明公式 PNG](browser/formula.png)已实际放进 [PPTX](browser/formula-in-slide.pptx)，由 Linux LibreOffice Impress 转成 [PDF](browser/formula-in-slide.pdf)。这是静态图像，不是 PPT 中的动态 HTML。
- [动态成品](browser/dynamic.html)、[外部 HTML 成品](browser/external.html)及[取回源码](browser/external-source.html)均来自正式页面实际下载。停服务后另启浏览器进程/新 context，`offline=true`，`file://` 冷打开；浏览器与具体数学/交互断言见 [测试](../../../../../apps/web/e2e/math-integration.spec.js)及 [offline.json](browser/offline.json)。测试断网为浏览器网络层，没有冒称 OS 全局网络隔离。
- 冷启动检查动态完整式、滑杆 Home/End、数值、拖点和重置；外部成品包含真实源码修改后的标题与范围，离线滑杆显示 `y = -10x`、`y = 8x`。外部 HTML 的契约 offline 属性仍为 unverified，不将一次样本验证外推到任意 HTML。

本轮最终交接保留 [transport.md](transport.md) 的旧观察与 [question-link-open.json](question-link-open.json) 的冻结接口冲突。M44 应独立复验指定本地切片，再由根安排其余门槛，不能把本页 self 当作完整放行。
