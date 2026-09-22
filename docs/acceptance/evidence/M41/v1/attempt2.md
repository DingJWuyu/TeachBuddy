# M41 attempt 2 回执

**PASS / self，限定 M41 隔离数学模块。** 产品 `c3ab0dacd1ff172d8557117f028ebdd805235d41` 已完成公式、平面与空间静态作品的制作、修改、保存重开及真实文件下载。数学请求和下载消费真实 A11 页面身份，实际运行使用 fake-mail、自签 HTTPS。内部审查发现均已修复并回归；这不是 A12、M44、完整材料链或目标设备的独立验收。

完整组合来源、运行/迁移/端口、源码及公共接口位置由 [integration2.md](integration2.md) 拥有。旧 author.md/integration.md 及 artifacts/ 不覆盖。当前分支 `feat/m41-attempt2`，仅分支提交，交回后停止 math 写入。

```yaml
task: M41@1
revision: 1
attempt: 2
role: implement
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T09:52:45Z"
session_id: "01a0c869-2ebb-70b3-8489-66df3f146880"
runner: "Codex CLI / gpt-6-astra / low；内部助手继承"
skills_used: [implement, writing-for-agents, code-review]
base_revision: "309d62674e4ef26582932ad7578ab307a4d9423a"
composition_base: "97d466c307a5cd18063a5b78a047980a5b78720d"
product_revision: "c3ab0dacd1ff172d8557117f028ebdd805235d41"
result_revision: "本报告所在证据提交:docs/acceptance/evidence/M41/v1/attempt2.md；完整证据 SHA 由最终回复固定"
review_target:
  fixed_point: "97d466c307a5cd18063a5b78a047980a5b78720d"
  commit_range: "97d466c307a5cd18063a5b78a047980a5b78720d...bc39dd8e0b10e1facb364f24aa99ab7a794e4aa3"
  standards: "PASS after author fixes；原审查 1 硬违反、2 命名建议"
  spec: "PASS after author fixes；原审查 1 部分满足"
  aggregate: "本报告 Standards / Spec；修复提交 cff2f88，定向及全项回归"
internal_reviewers:
  - "/root/standards_review：只读叶子，Codex gpt-6-astra low，继承调用 session"
  - "/root/spec_review：只读叶子，Codex gpt-6-astra low，继承调用 session"
inputs: "integration2.md 固定版本表；attempt2/composition.json"
changed_files: "attempt2/changed-files.json"
artifacts: "attempt2/sha256.json；本报告验证表"
checks: "下表实际命令与 WB-MA001/002/003/004/015/016/017"
identity_mode: "real-auth / fake-mail / 自签 HTTPS；原生回归另为 test-principal"
open_items:
  - "A11 公共认证：最后会话退出后同页重登/注册缺 bootstrap；提示刷新，刷新可恢复"
  - "公共 README 状态同步，准确修改位置见 integration2.md；本次无新增写权"
  - "M42 动态/HTML；M43 正式目录、材料四 handler 与跨模块联动；R35 门槛保留"
  - "M44 independent、Windows/Edge、PPT/WPS、触屏与真实邮件仍待各自拥有者验收"
failure_owner: null
next_condition: "外层收完整产品/证据 SHA 并确认停写后，M42 顺序接手 math 骨架，回归本页入口；不放行 M43"
authorization_used: "用户 M41@1 / attempt 2：完整固定组合、新分支、原 M41 写权、self 验证、内部 skill 审查与分支提交；不合 main/push/部署、不读密钥、不调用产品模型、不改源树/根台账/冻结契约；唯一通知由外层负责"
```

日志仅规范化行尾空白，命令、结果及错误内容保留；文件摘要见 sha256.json。

## 实际能力与验证

| 检查 | 结果与证据 |
| --- | --- |
| `npm ci` | PASS，[install.log](attempt2/install.log)。独立安装固定锁中的依赖，没有借用源树 node_modules。 |
| 原公式空稿到保存 E2E | 原组合预期失败，保存停在结果待确认，[formula-red.log](attempt2/formula-red.log)；实现后同路径通过。 |
| `node --test apps/api/test/math-static*.test.js apps/api/test/math-contract*.test.js` | **5/5 PASS**，[math-api.log](attempt2/math-api.log)。原生独立数学预期、真实 HTTP、R31 迁移、公式真实身份及两次重启。 |
| 原生配置 `playwright.config.mjs` | **12/12 PASS**，[native-browser.log](attempt2/native-browser.log)。原有 8 项加公式成功、字体失败恢复、错误位置及定义域 4 项；身份仍为 test-principal。 |
| 真实身份配置 `real.config.mjs` | **2/2 PASS**，[real-browser-final.log](attempt2/real-browser-final.log)。从真实注册到公式制作、服务重启、修改、无效源、修正、下载、禁网新浏览器；同账户恢复及同文档异账户迟到下载隔离。 |
| `npm run test:api` | **159/159 PASS**，[common-api.log](attempt2/common-api.log)。包含继承公共、认证、File/content 和 math API 测试，不据此重签认证独立验收。 |
| `npm run build` | PASS，[common-build.log](attempt2/common-build.log)。默认及隔离 math 目录投影、API、Web 构建。存在继承的 >500kB bundle 提示，非失败；无独立 lint/typecheck 脚本。 |
| 审查发现的 red/green E2E | 2 项先失败再通过，[review-red.log](attempt2/review-red.log)、[review-green.log](attempt2/review-green.log)。 |
| 手动入口和保留数据重启 | PASS，[manual-entry.json](attempt2/manual-entry.json)。新目录可启动、重启后同账户可登录，未触及其他 worktree。 |
| 写入、冻结输入及 Git 检查 | `git diff --check` PASS；[composition.json](attempt2/composition.json) 记录完整引入和保护对象，[changed-files.json](attempt2/changed-files.json) 记录本次产品差异。 |

### 冻结场景

| 场景 | 本次实际覆盖 |
| --- | --- |
| WB-MA001 / MC01 | 求根公式由空稿输入；中文说明、颜色、字号修改并保存版本 2；真实服务重启后重开；API 保留版本 1/2 源与文件。PNG alpha 有 0/255，四边 3px 无不透明像素；SVG 有真实数学路径与内嵌本地字体。见 formula/root-browser 文件和 real-api.json。 |
| WB-MA002 / MC01 | 两行 cases 正确输出；未闭合 `\\frac{1` 保存为 invalid 且 poster=null，PNG 导出 422、JSON 保留原文；修正后 version=3、重开再导出。禁止 require/HTML 注入宏的 API 源也保存 invalid，不启用外部包。 |
| WB-MA003 / MC02 | 空平面添加/编辑函数、点、线、多边形和标签；Q2 常数改 -2，顶点 (1,-3)、零点 1±√3 以独立数学位置断言；1/x 极点断开、sqrt(x) 无定义处不绘制；Q5 顶点与 3/4 标签可编辑。截图及真实 output-Q2/Q5 PNG/SVG 已目检。 |
| WB-MA004 / MC02 | 正方体、棱锥起点仍为可编辑源；尺寸、顶点标签、投影与 AC1 虚实修改保存重开。真实 output-Q6 与 native-space/pyramid 图已检查。 |
| WB-MA015 / MC13 | port 与 HTTP 共用真实 service；公式 create/get/update/export/list、同步引用与教学读取有实际结果；客户端 accountId/snapshot 被拒。提供 [provider-fixtures.json](attempt2/provider-fixtures.json)，不调用产品模型。 |
| WB-MA016 / MC08 | 旧版写 409、同键异体 409；响应丢失原键确认，期间新草稿不丢；服务重启原键仍返回同一历史结果。SQLite 事务失败后恢复同键只创建一次，历史源与 File 保持。 |
| WB-MA017 / MC09 | 无页面、陌生页面、缺 Cookie 和过期会话 401；错误 Origin 在业务前 403；外账户 Work/历史/引用/File/导出 404；缺 File 为 503 且元数据保留。UI 身份失效锁稿、同账户恢复；异账户不见旧稿，迟到 File 回包不下载；返回原账户确认原导出。见 real-api.json、real-browser.json、identity-browser.json。 |

已实际查看桌面、1024、390 截图及窄屏滚动后的预览。画布独立滚动、页面未横向溢出；[narrow-scroll.json](attempt2/narrow-scroll.json) 记录 bodyY=0 与画布滚动量。公式的分式、根式、上下标、两行条件和中文说明完整；Q2 顶点/零点、Q5 标签、Q6 棱线与保存源一致。root-offline/cases-offline 为关闭服务后禁网冷浏览器直接打开最终 SVG 的截图，不是服务器预览或旧实验样图。

公式和原生输出使用同一本地 Noto Sans SC，字体服务失败有可见错误与重试。服务器字体/worker 故障仍返回服务不可用，不冒充 invalid 用户源。现有 native 图形能力保留；无定义区间提前断开，避免耗尽采样预算，导出 alpha 和结构验证排除内嵌字体 base64 后检查 NaN/Infinity，避免把字体字节偶然含有该串误判为数学坐标。

补充定义域 E2E 在完整审查后实际复现 `sqrt(x)` 负半轴耗尽采样预算，保存成功但导出失败。最终产品修复全无定义采样格的提前断开；`1/x` 两支不跨极点、`sqrt(x)` 仅在非负半轴绘制，区间箭头和说明保存重开，均经真实 UI 下载及独立坐标断言通过。见 [domains-browser.log](attempt2/domains-browser.log)、[失败现场](attempt2/domains-red.txt)、[最终截图](attempt2/native-domains.png)。此有界补充由作者验证，不冒称进入先前 reviewer diff；之后上述全项回归重新通过。

## Standards

原审查 `97d466c...bc39dd8`：1 项硬违反、2 项判断性命名建议。

- `index.jsx` 本地字体失败被空回调吞掉，预览仍使用未嵌字体的 SVG，违反失败可观察要求。
- `font.js#localFont` 名称未体现注册字体副作用，属于 Mysterious Name。
- `real.mjs#exists` 实际是验证码请求响应，属于 Mysterious Name。

作者在 `cff2f88` 修复：字体失败阻止原生预览，显示错误和“重试字体”；公式重试也重新加载。函数改名 registerAndReadFont，响应改名 codeResponse。浏览器故障注入已先 red 后 green，随后完整 API/构建/浏览器回归通过。标准轴原 3 项全部关闭，当前 0 项未决。该关闭是调用者修复验证，不冒称 reviewer 再次审查了新 SHA。

## Spec

原审查 `97d466c...bc39dd8`：无阻断级缺陷，1 项 P3 部分满足。U-MA1 要求错误位置与源码同屏；原 FormulaPreview 只有 error.message。

作者在 `cff2f88` 修复：共享公式检查可定位未匹配花括号，界面显示行/列并选中对应源码；MathJax 无可靠位置时明确说明无法精确定位。E2E 验 `\\frac{1` 定位第 1 行第 6 列，实际选区 [5,6]。Spec 轴该项关闭，当前 0 项未决。修改未扩大至 M42/M43 或公共认证。

两轴仅进行一次并行内部 diff 审查。原 Standards 3 项、Spec 1 项；作者定向修复及实际验证后各 0 项未决。证据文档由作者核对，不声称进入原审查 diff；内部助手只读、不修改、不再委派，不单列业务节点。

## 未决归属与交回

数学写权内无未决阻断。公共 A11 的最后会话退出后同页重新登录/注册缺 bootstrap 已真实复现：409 `/problems/auth/browser-context-required`，页面提示刷新，刷新后恢复登录。归认证拥有者，见 [auth-bootstrap-boundary.json](attempt2/auth-bootstrap-boundary.json)；本次没有修改认证或提供身份替身。完整认证 PASS 不在本报告范围。

公共 README 仍沿固定输入的旧 M41 状态；按明确写权保持原样，在 integration2.md 给出下一公共写者的准确同步位置。真实邮件、Windows/Edge、PPT/WPS、触屏未验证，不把冷 Chrome 的静态图片结果推广到这些环境。

M42 可在外层收到完整候选、self 回执并确认停写后顺序接手。M43 的 R35 independent PASS 门槛保持，材料四 handler、正式目录 v3 与跨模块业务联动仍归后续节点。完成后清理本 worktree 的临时数据、构建产物与浏览器现场，保留本次正式日志/截图/下载物/摘要及所有旧证据；不清理其他 session 文件。
