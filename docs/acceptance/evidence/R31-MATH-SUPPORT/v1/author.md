# R31-MATH-SUPPORT 作者回执

**R31-MATH-SUPPORT@1 / attempt 1：PASS / self。** 固定产品 `07aeddc3a15b332cc941a86c340147facdef1425` 已提供 M41 所需公共包/资源及页面身份入口。本任务范围内无未接输入；这不是完整 R31、M41 或 A12 PASS。交回后停止公共写入，由外层转交 M41 消费。

```yaml
task: R31-MATH-SUPPORT@1
revision: 1
attempt: 1
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T08:27:51Z"
session_id: "01a0c824-de0d-7793-922f-daa425d25963"
runner: "Codex / gpt-6-astra / low；实现及随任务回执；内部助手继承"
skills_used: [implement, diagnosing-bugs, code-review, writing-for-agents]
base_revision: "c85d073a9582b6aab19c5db66f83ec4fdc6ad355"
composition_base: "1e8ec794ec4a19e05f3ca43800d3c7bedfc79d51"
product_revision: "07aeddc3a15b332cc941a86c340147facdef1425"
result_revision: "本证据提交:docs/acceptance/evidence/R31-MATH-SUPPORT/v1/author.md；完整证据 SHA 随最终回执返回"
review_target:
  fixed_point: "1e8ec794ec4a19e05f3ca43800d3c7bedfc79d51"
  commit_range: "1e8ec794ec4a19e05f3ca43800d3c7bedfc79d51...07aeddc3a15b332cc941a86c340147facdef1425"
  standards: PASS
  spec: PASS
  aggregate: "本回执 Standards / Spec 两节，分别 0 项发现"
internal_reviewers:
  - "standards_review：只读叶子；继承 Codex gpt-6-astra low；无再委派"
  - "spec_review：只读叶子；继承 Codex gpt-6-astra low；无再委派"
inputs: "integration.md 固定组合表；均按完整 Git SHA 读取"
changed_files: "changed-files.json 为产品支持差异；composition-provenance.json 为原样固定依赖引入；本目录为新增证据"
artifacts: "本目录日志、脱敏 JSON、截图、构建资产摘要及 sha256.json"
checks: "下表所列实际命令、HTTPS、浏览器与保留数据重启"
identity_mode: "real-api/fake-mail；公共旧套件部分明确为 test-principal"
open_items:
  - "M41 自己消费本候选，完成 MC09 与全部作品/导出/持久性场景"
  - "完整 R31 的四 handler 和正式组合仍缺，production 继续拒绝"
  - "A10-EXT-001 真实邮件、A10-EXT-002 目标设备、A10-OPS-001 备份恢复撤销仍未关闭"
failure_owner: null
next_condition: "外层固定完整产品及证据 SHA 后转交 M41；公共支持已停写，M41 不获得公共目录写权"
authorization_used: "用户 R31-MATH-SUPPORT@1 / attempt 1：本 worktree 公共唯一写者；固定来源引入、必要公共接线/资产与自验、内部双轴审查、本分支候选提交；不合 main、不 push、不部署、不调用产品模型；唯一通知由外层负责"
```

## 实际交付边界

- API/Web manifests 精确固定 MathJax 3.2.2；Noto Sans SC 5.2.9 在两侧可解析。Web prebuild/predev 生成本地发行包、字体和许可证；Node 与禁网浏览器均实际渲染。math 三模块目录没有变更，没有增加数学业务渲染服务。
- A11 两端认证内部与 `9ecabbf60cbbaecce2e9be8191d270068eb675cf` 相同，见 [environment.json](environment.json)。公共 app 接入真实 files router，默认及预构造 workbench 都绑定 A11 principal；来源限制、存储错误映射与生产拒绝继续生效。
- 公共 `workbenchBlob` 复用已有页面 transport 与账户代次取消，材料 ControlledImage 用同一入口。没有自造页面凭据、认证持久层或转换 handler。旧 test-principal 材料 fixture 显式绑定自己的测试 transport，不冒充真实身份。
- 旧迁移断言按 R31 与 A11 的实际组合保留 materials ledger；用户/布局旧行仍通过 A11 对应存取检查。README 同步当前候选状态。根 run-state/编排文档、冻结契约和旧证据未修改，固定材料 schema 仅原样引入。

原样引入与本轮变更分开固定：组合基线的每一变化文件均匹配至少一个固定来源 blob，见 [composition-provenance.json](composition-provenance.json)；本轮支持差异列于 [changed-files.json](changed-files.json)。内部审查只覆盖后者及其接线影响，未伪称重新审查整个 A11/R31 产品。

## 验证

| 场景和实际入口 | 结果及证据 |
| --- | --- |
| 干净 `npm ci`；`npm run build` | PASS。[install.log](install.log)、[build.log](build.log)。共享目录校验、API 隔离库/认证迁移、Web 构建通过。API build 不写用户库。 |
| 锁定依赖审计 `npm audit --json` | 0 项漏洞，[audit.json](audit.json)。MathJax 间接 XML 依赖通过 npm override 固定 0.9.12；MathJax 仍为 3.2.2。 |
| `node --test` 运行 `apps/api/test/*.test.js`，仅排除文件名以 `auth-contract` 开头的六份完整认证套件 | **89/89 PASS**，[common-api.log](common-api.log)。包含共同 HTTP/事务/首流/迁移、R31 文件内容、A11 组合六项和本轮四项。未重跑已有完整认证验收。 |
| `node --test apps/api/test/r31-math-support.test.js` | **4/4 PASS**，[support-api.log](support-api.log)。真实 Node SVG/透明 PNG、本地中文字体；真实 HTTPS 页面身份；文件/内容/幂等两次重启；预构造实例和 production 拒绝。 |
| 文件 HTTP 身份 | pending、缺 Cookie/页面头、未绑定页面均 401；错误来源/保护头 403；另账户 404；refresh 后需 restore；退出/过期 401；认证账户/会话表暂不可用为 503。请求经过真实 A11+R31 app，不是 auth 或文件 HTTP 替身。 |
| 文件公共持久存取 | 同键重放、异体 409；内容校验读取受控图片；真实字节/元数据/幂等回执/迁移记录经两次重启不变。R31 七项原文件测试也通过，含文件/SQLite 故障及 100 MiB 边界。 |
| 固定 R31 旧库升级 `R31_FIXED_ARCHIVE=.scratch/r31-math-old node scripts/math-support/verify-upgrade.mjs` | PASS，[upgrade.log](upgrade.log)。旧版真实 HTTP 保存文件和题目；当前版真实登录保留 accountKey，原文件字节、题目同键重放、旧账户/布局/业务/文件/幂等行、原 ledger 在两次重启后不变。归档来自固定 R31 SHA，未运行活动源树。 |
| `npx playwright test --config apps/web/e2e/r31-math-support.config.mjs` | **2/2 PASS**，[browser.log](browser.log)。禁网冷浏览器只加载本地 MathJax/字体，零 HTTP(S) 请求；真实注册、上传、图片显示、原件下载字节一致、刷新后新页面恢复、退出后旧绑定拒绝。 |
| 图片请求 red-capable 对照 | 单独恢复组合基线的原 `DocumentView.jsx` 后，同一真实浏览器流程在图片显示处失败；仅切回公共 transport 接线即通过。[browser-red.log](browser-red.log) 与 [page-files.json](page-files.json)。前者不是整版旧产品验收；后者只记录页面头存在性。 |
| 当前产品 App 冒烟 `A11_EVIDENCE_DIR=... npx playwright test --config apps/web/e2e/auth-integration.config.mjs --grep '真实注册、Cookie'` | **1/1 PASS**，[app-browser.log](app-browser.log)。真实注册、账号显示、remembered 刷新、退出、page 登录刷新；不是重复 10 项认证 UI 整套验收。 |
| `NODE_ENV=production AUTH_CODE_SECRET=isolated-refusal WORKBENCH_PUBLIC_ORIGIN=https://refusal.invalid node apps/api/src/server.js` | 预期拒绝，退出码 1，[production-refusal.log](production-refusal.log)。缺四 handler 的报错在打开数据库/监听前产生，development fixture 不作为部署。 |
| `git diff --check`；原样来源/冻结边界核对 | PASS。[environment.json](environment.json)、[composition-provenance.json](composition-provenance.json)。 |

直接重跑共同套件可用下列 Node 命令，不包含完整认证 contract 套件：

```bash
node --input-type=module -e 'import fs from "node:fs"; import {spawnSync} from "node:child_process"; const files=fs.readdirSync("apps/api/test").filter(n=>n.endsWith(".test.js")&&!n.startsWith("auth-contract")).sort().map(n=>"apps/api/test/"+n); process.exit(spawnSync(process.execPath,["--test",...files],{stdio:"inherit"}).status ?? 1);'
```

截图已目检：[本地数学资产](offline-assets.png) 的中文与根式/分式完整，无重复辅助 MathML 或边界裁切；[真实身份文件页](real-page-files.png) 图片可读；[真实产品设置页](app-settings.png) 账号与退出入口正常。前两页是有界公共验证 fixture，不表示 M41 工坊页面已实现。[offline-assets.json](offline-assets.json) 记录 MathJax 版本、字体加载、SVG paths 与零远程请求。

构建仍有已存在的单块大于 500 kB 提示；没有 lint/typecheck 独立脚本。本轮未为该体积提示重构业务打包。控制台 NO_COLOR/FORCE_COLOR 提示不影响验证结果。截图/JSON 不含 Cookie、验证码或完整页面选择器；数据库、profile、TLS 私钥及下载临时物不提交。

## Standards

**PASS，0 项硬性违规，0 项判断性 smell。** 内部 reviewer 对固定 diff 核对公共接线集中性、模块边界、真实 HTTPS/数据库/浏览器验证、production 拒绝与 README 完成边界，未发现违反仓库标准的改动。未重新执行测试，不构成独立验收。

## Spec

**PASS，0 项发现。** 内部 reviewer 确认固定 MathJax/本地字体/离线构建、真实文件路由和 A11 页面身份适配符合提案；math 三目录、冻结契约及认证内部不变；默认及注入组合均保留 production 拒绝。没有遗漏公共支持实现、越界转换能力或发现错误接线。author/integration 不纳入代码 diff 审查，由作者按实际结果编写。

两轴固定范围均为 `1e8ec794ec4a19e05f3ca43800d3c7bedfc79d51...07aeddc3a15b332cc941a86c340147facdef1425`。只读内部助手向本 session 聚合，没有业务 session 互聊或再委派；Standards 0 项、Spec 0 项，两个轴均无最严重项。

## 交接与未完成项

M41 的包路径、页面 transport、工厂装配及原目录保留重启方法由 [integration.md](integration.md) 唯一拥有。公共支持已可消费，但 M41 必须对自己的业务 HTTP/UI 路径重新验证 MC09、作品源/版本/导出/故障等全项。这里的库 smoke 与文件测试不代签数学作品质量或 M41 整体完成。

本地身份模式为真实 API + fake-mail、自签 HTTPS、隔离浏览器，不是外部真实认证验收。A10-EXT-001、A10-EXT-002、A10-OPS-001 沿原责任保留。Office/识别与四 handler、完整 R31、M42/M43/M44、目标 PPT/WPS/设备均未放行。没有公共契约冲突需要升级。

正式脱敏证据归档后清理本任务已知临时 archive、生成的验证页面/数据库和临时日志。未改其他工作树、根 run-state、旧证据或自动生成的源文件；锁由 npm、构建资产由脚本产生。仅本分支提交，无 main 合并、push、部署或产品模型调用；唯一外层通知不由本 session 发送。
