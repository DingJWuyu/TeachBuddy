# M41 隔离静态切片接续

M41 整体未完成，不能放行 M42。本候选提供真实 native 图形、服务端制作源、版本历史及 PNG/SVG/JSON 文件闭环；公式、页面身份和公共构建支持仍待固定输入。身份是 `test-principal`，不是正式生产或 real-auth 验收。

## 固定组合

- 起始分支：`c85d073a9582b6aab19c5db66f83ec4fdc6ad355`。
- 组合基线：`df376b214113c7476e524b68a19982ade1e0e642`。产品目录、manifest/锁、运行脚本和 Playwright 配置原样取 R31 `5f696b8ce611e67d940ce149ce13946a50b65510`；数学契约、UX、BDD、架构原样取 M40 `1a5dd015863d749e5244346f4eaad24ac506670d`。当前 AGENTS、README 和 docs/plans 均未覆盖。
- 依赖裁决：`2e67961b01f4ce90ab07dad1feb823b1f595266d`；作者 `76151489f28cfe1ccaddd8afa28db3c613f3c6a5`；限定 independent PASS `3783208100703efc6b00f14eaf9709ff501705a2`。固定 Git blob 只读消费。
- R31 运行交接：`c08fa62d434efffc89b471151faa73308e3ce716:docs/acceptance/evidence/R31-FOUNDATION/v1/integration.md` 和同目录 author.md。
- 实现与自验、内部 review 的实际 SHA 以本目录 author.md 为准。证据文档不是完整 M41 放行输入。

## 运行和重启

Node.js 22.23.2，在本 worktree 根目录执行：

```bash
npm ci
node apps/web/e2e/fixtures/math-static/build.mjs
M41_PORT=47411 M41_DATA_DIR=test-results/m41/data node apps/web/e2e/fixtures/math-static/server.mjs
```

访问 `http://localhost:47411/fixture/session`，进入账户 m41-a；`?account=b` 是独立账户 m41-b。该入口只用于隔离自验。它挂载真实 R31 File HTTP 和真实 math module，不使用内存业务替身。停止进程后用相同命令和 data-dir 重启，SQLite 与 files 均保留。没有 reset 命令，不删除已有目录。

`math_001` 位于 `apps/api/src/modules/math/migrations.js`，沿原 `workbench_migrations` ledger 建立 math_works、math_revisions、math_exports。启动顺序为发现模块、迁移、文件初始化、实例化。每版历史保存完整 Source 和固定 File ID；备份需同时保留 SQLite 与 files。文件落盘后复核作品版本，作品、revision 和用户请求成功回执同事务提交；冲突留下的未引用 File 不删除。

```bash
node --test apps/api/test/math-static*.test.js apps/api/test/math-contract*.test.js
npx playwright test --config apps/web/e2e/fixtures/math-static/playwright.config.mjs
npm run test:api
npm run build
```

独有 Playwright 配置启动 47413 和 `test-results/m41/browser`；HTTP 集成使用 47412 和 `test-results/m41/api`；数学输出核对使用 47414 和 `test-results/m41/output`；旧库迁移使用47415和独有migration目录。真实输出与截图的提交副本在 artifacts/；摘要与执行结论见 author.md。共同 build 当前因公共 catalog 缺 math 映射而失败，不能以独有 fixture build 代替共同检查。

## 消费接口

- `apps/api/src/modules/math/index.js#createMathModule({db,mutations,files,content})` 返回 router、port、migrations。工厂不注册公共目录，不修改生产拒绝逻辑。
- router 挂在 `/api/modules/math`，具体 `/v1/works` 操作从冻结 OpenAPI 读取并共用 `port.operations.<operationId>({principal,key,input,id,query})`。getWorkVersion 的 query.version 为整数。
- 同步 `port.readForReferenceV1(principal,id)` 返回当前快照，包含 tombstone；`port.readForTeachingLinkV1(principal,id)` 只返回 id/version/title/deletedAt。listWorks 是 port.operations 的实际操作。HTML/dynamic 当前明确 unsupported-work-version，不提供伪渲染。
- `apps/api/src/modules/math/contract.js` 直接读取唯一冻结 schema，解析其材料/首流外引；不另建 DTO 副本。Source 关系校验由同模块完成。
- `packages/shared/src/math/expression.js` 与 graphics.js 是 UI 和服务端共用的封闭数学求值及 SVG 路径。无 eval/Function、CDN 或产品模型。API render.js 使用当前仓库 sharp 将同源 SVG 栅格化。
- rendererVersion 当前为 `math-native-v1-svg-sharp`。字体资产尚未固定，因此本候选不能保证另一设备的文字度量与当前一致；公共字体到达后须更新真实发行标识并重验，旧 revision/文件不重画。
- File 下载真实路径为 `/api/workbench/files/{id}/content`，附件、nosniff、sandbox 由 R31 保持。SVG 以图片预览，不插入应用 DOM。生成文件实际 MIME 可能为 text/plain，按字节、文件名、format 三者核验。

## 待接支持和完成门槛

| 待接项 | 提供者及必须回归的行为 |
| --- | --- |
| MathJax 3.2.2 产品依赖与本地字体/构建资产 | R31-MATH-SUPPORT 固定 SHA。接入公式渲染、受限包和中文说明；执行 MC01、WB-MA001/002 的求根/分段式、invalid 保存恢复、透明输出。当前公式编辑只保留设备草稿，服务端明确 503 render-unavailable。 |
| 页面身份 adapter 与认证 transport | 公共支持固定交付。当前 fixture Cookie 不能证明无页面/过期身份拒绝；回归 MC09、身份切换与迟到响应、真实页面 File 下载，不自行新增认证服务。 |
| 公共 catalog/构建校验与正式组合 | 公共唯一写者提供支持或具体交接。当前共同构建拒绝未映射 math 目录；M41 没有公共 manifest、目录、App 或底座修改权。正式四 handler 未齐时仍拒绝 production。 |
| M41 全项证据 | 公共输入到齐后，补全制作、恢复、UI 及原包全项回归，固定完整候选并停止 math 写入，才可交 M42。当前 native 自验不替代 M44 independent 或目标 PPT/WPS/Windows 设备验收。 |

本切片保持 math 唯一写权，未合 main、push、部署，未调用产品模型，未修改或联系 T51。外层负责唯一通知和后续输入交付。
