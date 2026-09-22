# M43-MATERIALS-INTEGRATION@1 限定集成交接

限定结论：**self PASS**。固定 M43 数学/材料/教学组合已纳入 R33 的五个 questions 产品文件修复及其独立关闭证据，形成下游可直接使用的新候选。此次未新增产品行为、未修改契约、未合 main、未 push 或部署。

```yaml
task: M43-MATERIALS-INTEGRATION@1
attempt: 1
role: integration
status: PASS
verification_level: self
finished_at_utc: "2026-09-22T16:29:06Z"
session_id: unavailable
runner: "Codex / gpt-5.6-sol / medium"
skills_used: [writing-for-agents]
base_revision: "6c4f5a90377787186732eccf3cc34a32cd0f06db"
composition_revision: "d63c5eed4c3c6e3b5881197f8eda8941244e0204"
product_revision: "2bdb865d6923e6aedb744d2f631ee5b5ef106541"
result_revision: "由最终交回消息固定本文件所在完整提交"
review_target:
  fixed_point: not-applicable
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: not-applicable
internal_reviewers: []
identity_mode: "浏览器 real-auth/fake-mail；API test-principal"
product_model_calls: 0
product_key_reads: 0
failure_owner: null
authorization_used: "用户本轮指定限定 Git 集成、候选提交及本回执写入"
```

## 固定组合

| 输入 | 实际消费 |
| --- | --- |
| M43 完整候选 | `4b5c31e6e67543a2826f662ff07acc19a0de765f`，产品 `909693a7cc67f50a523ea94864ef7b80a345d5df`，测试生命周期代码 `965f813626fc40ba5fb8c04f0495c825f825b469`。完整历史作为祖先保留。 |
| R33 完整候选 | `42b0cde25f1f8602d25155b27620ac7da4289bd7`，产品 `331bd367df450522fb54982984c452c6bb8d4c52`，组合基线 `afdb8f96098e77cfac076179ea0fd2be05bb7c9c`。完整历史与 attempt5 证据保留。 |
| R35 独立结论 | `ed5c57c8069e2c47d5d7511a94f5dfe508be3a87`，002-005 全部 CLOSED、公共接线需求无。既有八项消费继续固定在 `55654c2d59f0130aeb31e24d5f52c04b4323f0a4` 的原范围。 |
| 根编排文档 | 交付树中的 `docs/plans/run-state.md` 与 `docs/plans/mvp-dag.md` 逐字同步本轮收口时 main `5999a2fa58d9702aebd70945cc7bf1b664476a11`，未由旧组合覆盖。 |

R33 完整分支与 M43 各自携带重复组合历史。合并时 54 个重复 add/add 或内容冲突统一保留 M43 侧，随后单独重放 `331bd367df450522fb54982984c452c6bb8d4c52` 的最小产品补丁。最终相对 M43 的产品源码变化只有下列五个 questions 文件，且其字节与 R33 产品提交一致：

- `apps/api/src/modules/questions/assets.js`
- `apps/api/src/modules/questions/extraction.js`
- `apps/web/src/features/questions/index.jsx`
- `apps/web/src/features/questions/MaterialsQuestionsPage.jsx`
- `apps/web/src/features/questions/questions-materials.css`

因此 M43 的 math、lessons、classes/教学接线及公共模块未被 R33 较旧组合覆盖。组合提交另含 R33 的三项定向测试文件和固定证据；其中两项测试做了必要集成适配：临时库尊重 `TMPDIR`，分类持久化浏览器复验从 M43 的 SPA 根入口完整重载后重新进入 `/questions`。该调整只改变测试运行方式，不改变产品或断言。

## 自验

所有运行均在隔离副本 `/home/liam_t/.cache/m43-materials-integration.VCd6nv/candidate` 完成，`TMPDIR`、SQLite、动态端口、浏览器上下文及证据目录独占。来源仓库、旧证据和本任务产品树未被测试写入。

| 检查 | 结果 |
| --- | --- |
| 来源与树一致性 | 三个完整输入均为当前候选祖先；相对 M43 的产品源码仅五个 questions 文件变化；五文件与 R33 产品逐字一致；根台账/DAG 与 main `5999a2f` 一致。 |
| 生产构建 | `npm run build` PASS。目录校验得到六个模块；隔离构建库应用 11 个迁移；Web 构建 PASS，保留既有大 chunk 提示。 |
| R33 HTTP 定向 | `materials-questions-local5.test.js` 8/8，覆盖空/空白/非法/截断/混合正文、长 PNG 和 2399/2400/2401 高度边界。 |
| R33 真实外壳浏览器 | `materials-questions-local5.spec.js` 2/2，覆盖分类入口、AI 草稿保留、三视口控件、保存刷新与删除。首次直接运行在 M43 `/questions` 深链刷新遇到该旧 auth fixture 的 404，完成上述测试集成适配后固定入口通过。 |
| M43 math/lessons | `math-integration.test.js` 3/3，覆盖快照、旧 v2 重放、重启、删除后引用、classes 反向链接及五类真实 DOCX/PDF。首轮未设置 Office 路径时转换项失败，按 M43 固定运行条件设置后通过。 |
| 教学数学接线 | `teaching-time-classes-math.test.js` 与 `teaching-time-classes-math-upgrade.test.js` 9/9，覆盖升级、真实链接、反向反馈、回滚、隔离及重启。 |

未重复完整材料/数学独立验收，也未运行同内容 code-review。M44 正在验证旧候选 `4b5c31e`，本交付不替换其输入或代签其结论。

## 下游运行入口

从本交付完整 SHA 建立独立 checkout，Node.js 22.23.2：

```bash
npm ci
export TMPDIR=/path/to/own-disk/tmp
mkdir -p "$TMPDIR"
npm run build

R33_LOCAL5_EVIDENCE="$TMPDIR/r33-api" \
  node --test apps/api/test/materials-questions-local5.test.js
R33_LOCAL5_EVIDENCE="$TMPDIR/r33-ui" \
  npx playwright test --config apps/web/e2e/fixtures/materials-questions/attempt5.config.mjs

MATERIALS_OFFICE_ROOT=/path/to/libreoffice-root \
  node --test apps/api/test/math-integration.test.js
node --test \
  apps/api/test/teaching-time-classes-math.test.js \
  apps/api/test/teaching-time-classes-math-upgrade.test.js
```

实际产品手工入口继续沿用 M43：

```bash
MATERIALS_OFFICE_ROOT=/path/to/libreoffice-root \
M43_DATA_DIR="$TMPDIR/m43-manual" \
  node apps/web/e2e/fixtures/math-integration/manual.mjs
```

进程会打印自签 HTTPS 地址，测试账户仍为 `m43@example.test` / `math-password`。使用者应换用自己的空闲目录和本机支持的 Office 安装。

## 保留边界

- R35 两项历史 fetch 观察继续 OPEN；本次没有关闭或重归因。
- 完整 R35、在线提取、Windows/PowerPoint/WPS、打印及物理设备门槛保持未完成。
- M43 已记录的丰富题目教学旧接口 422 不在本任务修复范围；其设计冻结与后继实现由外层按最新台账继续。
- R33 定向 auth fixture 只在 `/` 提供 SPA 入口，集成测试已从根入口完成全页重载；未把该 fixture 深链行为扩写成产品修复。
- 本轮零产品模型请求、零密钥读取。所有验证服务均已退出；临时副本在完整交付提交固定后删除。
