# B11/v1 作者自检

时间：2026-09-21 19:15 UTC。检查对象为本目录 author.md 指定的设计候选；这是设计材料自检，不是独立冻结或产品测试。

| 检查 | 实际结果 |
| --- | --- |
| 固定输入 | 起始 HEAD `59a14e95bab667e0a01b8d62f6e87e018ddb1c5f`，分支 `design/b11-first-flow`，开始时工作区干净 |
| B10 外部交接 | 实际读取的 b10 工作区 execution-baseline.md 与 `git show 8e9b230c56c7384521b122a7a80b6b07e18c852c:docs/arch/execution-baseline.md` 字节一致 |
| OpenAPI | 用 openapi-spec-validator 校验 3.2.1 通过；解析所有本地引用和只读认证 YAML 引用通过；15 个操作 |
| JSON Schema | jsonschema Draft 2020-12 校验 47 个 schema 及 13 个规范样本、12 个错误样本通过，UUID/时间格式也校验 |
| 反例 | 未知 accountId、布尔字段传字符串、未知来源类型、文档 v2、HTML 节点等 5 个请求形状均被 schema 拒绝 |
| BDD | gherkin-official 解析通过，WB-001 至 WB-019 唯一且连续 |
| 文档目标 | 6 份设计入口中的 46 个本地链接目标存在；此项未把标题锚点计为自动验证 |
| 写入范围 | 只新增本批设计、契约、场景、任务包与 B11 证据；没有产品/认证/原型/台账/CHANGELOG 改动 |

校验运行方式：通过 `uv run --with PyYAML --with jsonschema --with openapi-spec-validator --with gherkin-official python` 的临时标准输入执行解析、schema/example 验证和本地目标存在检查，未向仓库增加验证工具或依赖；`git diff --cached --check` 检查提交内容空白错误。语义约束（例如有效题面、重复 ID、事务原子性）由后续真实 HTTP/E2E 验证，不能由形状校验宣称实现通过。

作者已按 C01-C18 对照两侧实现需要的信息：首次保存改编一次创建；既有引用保留快照、新引用读取指定当前版本；同键确认优先于旧基线冲突；响应丢失不追加创建；API 不可用时刷新保留本地记录但等待身份重新核实。该走查属于作者自检，交独立 reviewer 复核，不记 independent PASS。

没有启动产品、生成产品截图或运行产品构建/API/E2E；本批没有产品代码。UI 证据与真实重启/故障证据由 B12-B16 在各自固定候选上产生。
