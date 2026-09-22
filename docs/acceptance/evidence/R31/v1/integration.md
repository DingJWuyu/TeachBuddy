# R31/v1 公共底座接入

PASS / self。完整产品候选：`6225fc07a895113a667b5a41092a7a69e2f2fefa`。消费此候选及祖先；回执提交仅包含本目录证据。本候选交回后 R31 停止公共写入，R32/R33/R34 可按同版输入并行；共享文件下一写者是 R34。没有合 main、push 或部署。

## 固定输入

- 当前主干派生起点：`31471d4e880232666e05fc9c2c5ba2f139282ee9`。
- 固定代码组合：`5a767dbc66ed6efb5fca1bcfe0870b7561c433b5`；未消费活动 M42。
- R30 设计：`8b8656ae9f9b6c70303b11ec29fbcf70f3b2a8c1`；冻结依据 `88a89f00b78dd301ca9893a191277eb9970c4c18:docs/acceptance/evidence/R30/v1/final-review.md`。旧“待冻结/dsh”文字以该报告和当前执行协议为准。
- 原底座：`c08fa62d434efffc89b471151faa73308e3ce716:docs/acceptance/evidence/R31-FOUNDATION/v1/integration.md`；公共支持：`02340eb972d68221bde94976c0da5fa90648de89:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/integration2.md`。
- B16：`612f0a9868743a1d5eea7e6f236d3ff903752439`；独立依据 `d1ef0d5af8478677c04e6dd42bd3346f7883d1d0:docs/acceptance/evidence/B16/v1/attempt2.md` 和同目录 `attempt2/run-acceptance.mjs`。
- 组合 fixed point：`b1d2b283ab210994fab639f6d822a86b8a23693f`。引入时保留当前 AGENTS.md、run-state；实现只在其后发生。文件来源与哈希见 [inputs.json](inputs.json)。

## 运行

Node.js 22.23.2。原生依赖为 Linux bubblewrap、Poppler（pdfinfo/pdftoppm）、prlimit、LibreOffice；不允许无 sandbox 回退。`MATERIALS_OFFICE_ROOT` 指向含 `program/soffice` 的只读安装根。本机复用既有 LibreOffice 26.8 安装，仅只读挂载程序；不复用原实验 profile、目录、数据库或服务。

```bash
npm ci
npm run build
node scripts/materials/build.mjs
MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8 \
  node scripts/materials/start.mjs --data-dir test-results/r31-consumer/data --port 48331 --reset
```

进入 `http://localhost:48331/fixture/session` 后，`/` 为文稿编辑，`/?preview` 为上传、逐页预览、裁图。预览地址保留 file ID，重启后可继续读取。停止后原命令去掉 `--reset` 保留全部库和字节；reset 只接受 `.r31-fixture` 标记目录，不指向生产数据或原验收树。消费者分别指定自己的 data-dir/端口。

该页面入口明确为 **test-principal**，服务端身份 `r31-a`/`r31-b`。真实 A11 接入仍使用既有 `createApp` 的同源 HTTPS、Cookie 和页面绑定；材料路由不自行建立身份。真实身份验证使用 `apps/api/test/materials-foundation-auth.test.js` 的 A11 + fake-mail，未发送邮件或模型请求。

## 公共端口与唯一装配位置

| 对象 | 位置与调用 |
| --- | --- |
| 组合工厂 | `apps/api/src/workbench/index.js#createWorkbench`；返回 `{db, mutations, files, content, jobs}` 及原有入口。先 `await initialize()`，再监听端口。关闭用 `workbench.close()`，已有 `dataStore.close()` 同样先停任务。 |
| File | `apps/api/src/workbench/files/index.js`，原 `store/read/open` 接口原样复用；HTTP `/api/workbench/files`、`/{id}`、`/{id}/content`。 |
| Preview/crop | `apps/api/src/workbench/files/preview.js`；`files.preview(principal,id)`、`requestPreview(principal,id,mutation)`、`ensurePreview(principal,id)`、`crop(principal,{location},mutation)`。GET 无转换副作用，ensurePreview 直接受控转换，不嵌套排队。历史 rendition 链保留，可裁旧页。 |
| Job | `apps/api/src/workbench/jobs/index.js`；`enqueue({principal,kind,target,input},mutation)` 在调用方已有同步受理事务内调用，input 的持久化属于业务模块。`get/cancel/retry` 与冻结接口一致，HTTP `/api/workbench/jobs`。 |
| 四 handler | 唯一绑定在 `workbench/index.js#initialize` 的 `jobs.start({...})`。真实 preview 来自 `files.jobHandlers.preview`；其他三项来自 `jobs/fixtures.js#unconnectedHandlers`，可由显式 `env.workbench.jobHandlers` 按同形状替换。它是启动参数，不是 HTTP 注册入口。 |
| 未接入边界 | extraction/export/question-asset fixture 带 `fixture:true`，只返回 failed/provider-unavailable，绝不伪造业务成功。生产缺项、fixture 或 retry 形状缺失时拒启；R34 最终装配真实 handler。 |
| handler 形状 | `run({principal,job,signal,reportProgress}) -> {state,outputFileIds,issues}`；preview/extraction 另有同步 `retry({principal,job,unitIds,mutation}) -> Job`。retry 已在 mutations 事务中，内部调用 enqueue 不另开 mutations。业务保存/输出去重由所属模块完成。 |
| 内容校验 | `apps/api/src/workbench/content/index.js#content.validate`；使用固定 YAML 唯一 schema，v1/v2 源保存，未知版本拒写。 |
| 公共 Web | `apps/web/src/features/workbench/materials/index.js` 导出 `DocumentEditor/DocumentView`，props 沿冻结定义。模块拥有保存动作和 onPickImage，编辑器不拥有业务保存。 |
| 静态目录 | `packages/shared/src/moduleCatalog.js` 仍保留真实已实现目录与既有 math 隔离映射；材料 version=2 fixture 来自 `materials.openapi.yaml` 的 `components.examples.ModuleCatalog.value`，本轮测试按唯一 schema 验证。R34 真正装配 resources/v2 依赖后再替换运行目录，不注册空业务模块。 |

同版成功/失败样本：`apps/web/e2e/fixtures/materials/samples/{c22.pdf,c22.pptx,c22.ppt,w.doc}`，固定 C22 Git 对象来源见 inputs.json。真实 preview handler 提供成功路径；损坏/unsupported/超限/超时为失败路径。`materials-foundation-jobs.test.js` 中显式 extraction fixture 演示 partial、取消迟到、未知 Provider、重启和 retry 的完整形状，只证明 Job 调度，不证明收题。

内部文件键与用户受理键分离。所有原件、页图、PDF 和裁图经 files.store 持久保存；完整页清单最后原子提交。不同键同字节保留独立元数据，同键确认不新增裁图。没有无引用永久文件 GC。

## 验证与迁移

```bash
export MATERIALS_OFFICE_ROOT=/home/liam_t/项目/TeacherWorkspace-c22/experiments/C22/deps/libreoffice/opt/opt/libreoffice26.8
node --test apps/api/test/materials-foundation*.test.js
node scripts/materials/verify-migration.mjs
node scripts/materials/verify-browser.mjs
node scripts/materials/verify-preview.mjs
npm run test:api
npm run build
```

迁移命令默认从只读 `/home/liam_t/项目/TeacherWorkspace-b16-candidate2` 读取固定 B16；`B16_SOURCE` 可改为同 SHA 的只读检出，脚本严格核对 HEAD。所有新旧进程写本 worktree 的 `test-results/r31-complete/b16-upgrade`，端口 48334。真实 A11 测试使用随机 HTTPS 端口；编辑器 48331、预览浏览器 48335。不存在共享外部运行库。

迁移追加 `materials_jobs_001`（jobs、previews、历史 rendition 表），原 `materials_files_001` 及认证/业务旧迁移原样保留。旧库账户、布局、题目、备课、幂等行逐值不变，重复启动不重复迁移，A11 迁移后旧账户可真实登录和激活。三份既有公共迁移测试只机械加入新迁移 ID。

恢复：running 在服务重启后 interrupted；cancelling 变 cancelled；queued 顺序执行。Provider 结果未知不后台重发，只有明确用户 retry 产生新受理；付费授权仍由业务入口拥有。失败转换留在各自 files/conversions 下，含该输入及简短 failure.txt，不记录认证头/模型 reasoning。成功临时转换目录清理，字节与 SQLite 一起备份。

## 保留边界

- C21 在线窗口关闭。本轮无模型请求、无密钥读取；不把任何 fixture 或旧重放签为在线识别成功。R33 真实产品识别和预算另归原节点。
- C22 本机实验限定结论沿冻结证据；本轮只证明真实原件预览，未做 Word/OMML 导出、Office 编辑往返或目标 Windows/WPS 验收。
- 旧 DOC 为 limited，不能恢复已丢失公式；替换/补充 PDF 的业务语义归 R32。真实提取、六成果及四 handler 最终接线归 R34。
- README 与公共 Web 外壳本轮只读，最终状态同步归 R34；构建存在既有 500 kB chunk 提示，构建无失败。
