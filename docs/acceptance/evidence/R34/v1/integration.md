# R34/v1 并行阶段接入

本候选提供备课 v2 与六输出；题目和资源输入使用冻结同版 ReferenceRead/HTTP Adapter。完整 R34 self PASS 仍需外层交付固定 R32/R33 及停止写入记录后完成真实材料链。本目录 author.md 汇总最终结果，不作为 R35 独立验收。

## 固定输入与组合

- main-based 起点：`d01ff0144fe98e1fdaaa61651b5c04f28d772c64`。独立分支 `feat/r34-material-lessons`。
- R31 完整输入：`2b6cbcda934057a89c0443437e03b2e30e850a8d`，产品 `6225fc07a895113a667b5a41092a7a69e2f2fefa`；author.md/integration.md 已随组合引入。
- R30 冻结：`8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1`；最终 independent PASS `88a89f00b78dd301ca9893a191277eb9970c4c18:docs/acceptance/evidence/R30/v1/final-review.md`。
- 组合 fixed point：`401e56d0e68de54891f2f0bda18d66a4407f043b`。保留本分支原 AGENTS.md、run-state.md 和描述 main 状态的 README.md。来源 worktree 只读，没有引入 R32/R33 活动分支。

## 一步启动隔离现场

Node 22.23.2；依赖沿 R31 锁文件，未增加产品依赖。系统需要 bubblewrap、Poppler、prlimit、Noto Sans CJK SC。Office 程序安装只读复用，转换目录和 profile 均隔离。

```bash
npm ci
npm run build
node apps/web/e2e/fixtures/materials-lessons/build.mjs
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 \
  node apps/web/e2e/fixtures/materials-lessons/server.mjs
```

打开 `http://localhost:48434/fixture/session`，从备课列表新建备课。运行身份为 **test-principal / r34-a**，另有隔离的 r34-b；fixture 的 session 路由不能用于 production。默认数据 `test-results/r34/data`，重启沿用原库与文件，不自动 reset。改现场用 `R34_DATA_DIR` 和 `R34_PORT`，浏览器也应独立 profile/context。

## 端口、注册和依赖

| 对象 | 当前接入 |
| --- | --- |
| 备课工厂 | `apps/api/src/modules/lessons/index.js#createLessonsModule({db,mutations,questions,resources,content,jobs,files,now})`，返回 router、port、jobHandlers。 |
| 引用依赖 | `questions.readForReferenceV2`、`resources.readForReferenceV2` 同步调用，和整课保存处于同一 mutations 事务；保留旧引用采用快照，只在显式采用当前版本时替换。B11 readForReference 仍供旧路径使用。 |
| v2 HTTP / 业务 operations | `/api/modules/lessons/v2/items`、`/{id}`、`/{id}/deletion`、`/{id}/exports`，以及 question-usages/resource-usages。`port.operations` 使用同版 operationId：listLessonsV2、createLessonV2、getLessonV2、updateLessonV2、setLessonDeletionV2、listQuestionUsagesV2、listResourceUsagesV2、createLessonExport、listLessonExports。 |
| 使用位置 | `port.listUsages(principal,{kind,id})`，活动备课按 updatedAt 降序；同课引用按 referenceId 升序，含 adoptedVersion。 |
| 导出 handler | `jobHandlers.export.run`；受理事务固定过滤后的内容树和选项，真实 DOCX 生成、沙箱 Office 转换/页校验后保存制品。失败保留旧成功输出，export 不使用 retryJob。 |
| 唯一任务装配 | `workbench/moduleLoader.js` 保留模块返回的 jobHandlers；`workbench/index.js` 在 jobs.start 中装配 lessons.export。extraction/question-asset 仍为 R31 未接入 fixture，production 保持拒启。最终装配待 R32/R33 固定输入。 |
| Web | lessons 内页面调用 v2，使用公共 DocumentEditor.value 接缝；取材 HTTP 路径按冻结契约；输出列表、真实页图预览、受控下载。最终资源来源页和题库 v2 外壳导航仍需固定 R32/R33 实现组合。 |
| 必要公共修正 | Job 不可重试错误按 schema 改为 409；Web workbench/problems.js 识别材料引用冲突及导出公式/选择错误，保留定位并进入正确恢复分支。没有改认证、题库、资源或数学业务内部。 |
| 公共迁移测试 | 三份既有迁移断言仅补 lessons_materials_001 的预期 ID，不改变旧数据断言。 |

新增迁移 `lessons_materials_001` 给旧 lesson_references 增加 kind，旧行默认 question，并新增 lesson_exports 保存受理快照和成果记录。旧表、旧 ID、v1 文档、采用快照、版本和幂等账本继续使用。v2 GET 不写回；旧入口遇到 v2 文稿/资源引用拒绝有损读取或覆盖，原键仍先重放。

## 可复现验证

```bash
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
node --test apps/api/test/materials-lessons.test.js
npm run test:api
node apps/web/e2e/fixtures/materials-lessons/verify-outputs.mjs
npx playwright test --config apps/web/e2e/fixtures/materials-lessons/playwright.config.mjs
npm run build
```

浏览器测试要求上述 48434 fixture 已运行。输出验证自行启动 48435，写 `test-results/r34/outputs-data`，结束关闭自己的服务；24 份 DOCX/PDF、全部 PDF 页图和内容检查在 [outputs](outputs/manifest.json)。生成脚本将上一轮输出移动到本 worktree 的 test-results 下，不混用旧页图。真实/替身区分：SQLite、HTTP、File、Job、DOCX、OMML、LibreOffice/Poppler 均真实；题目和资源的生产者为同版 Adapter，没有实际收题 Provider 请求。

本机 Office 往返脚本 `apps/web/e2e/fixtures/materials-lessons/office.py` 通过 UNO 操作可见 Writer 窗口，修改中文与两类真实公式对象，保存关闭重开、导 PDF、三类实际打印预览。证据在 [office/gui.json](office/gui.json) 及同目录截图和编辑制品。运行环境是独立 Xvfb `:134`、UNO 49435、profile `/home/liam_t/r34-office-profile`；不是鼠标逐字输入，也不是靠 OOXML 数量代替操作。

```bash
# 本机 Xvfb 可用发行版包解到独立目录，不改系统或 R31 程序安装。
mkdir -p test-results/r34/tools
curl -fL https://mirror.nju.edu.cn/cachyos/repo/x86_64_v3/cachyos-extra-v3/xorg-server-xvfb-21.1.24-1.1-x86_64_v3.pkg.tar.zst -o test-results/r34/tools/xvfb.pkg.tar.zst
tar -xf test-results/r34/tools/xvfb.pkg.tar.zst -C test-results/r34/tools
test-results/r34/tools/usr/bin/Xvfb :134 -screen 0 1440x1000x24 -nolisten tcp
env -u WAYLAND_DISPLAY DISPLAY=:134 SAL_USE_VCLPLUGIN=gen \
  "$MATERIALS_OFFICE_ROOT/program/soffice" \
  -env:UserInstallation=file:///home/liam_t/r34-office-profile \
  --accept='socket,host=127.0.0.1,port=49435;urp;StarOffice.ServiceManager' \
  --norestore --nodefault --nofirststartwizard
DISPLAY=:134 "$MATERIALS_OFFICE_ROOT/program/python" \
  apps/web/e2e/fixtures/materials-lessons/office.py
```

命令中的长驻进程分别在独立终端执行。Xvfb 包本机只读来源为 CachyOS `xorg-server-xvfb-21.1.24-1.1-x86_64_v3.pkg.tar.zst`。文件哈希和应用版本由本目录最终证据索引记录。

## 未决归属

- 外层/R34 接续：固定 R32/R33 完整 SHA、自验缺口和停止写入记录；正式目录 version=2、资源/题库/认证外壳最终装配、四个真实 handler 及真实原件到六输出、全 WB-M001 至 M028 最终链。当前 Adapter 不能签此项通过。
- 外层/R35：Windows Word/WPS 的实际设备、版本与访问权限。Linux LibreOffice 26.8.0.3 的可编辑和打印证据不代签目标兼容。
- R35：基于最终完整候选执行独立验收，本 session 仅交 self。
