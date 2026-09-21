# AUTH-CONTRACT/v1 作者自检

范围：设计结构、共享交换双向走查与写入边界。时间：2026-09-21 20:25:55 UTC。不是独立冻结、浏览器运行或正式认证验收。

## 实际执行

```bash
uvx --from openapi-spec-validator==0.9.0 openapi-spec-validator docs/contracts/auth.openapi.yaml
uvx --from openapi-spec-validator==0.9.0 openapi-spec-validator docs/contracts/workbench/first-flow.openapi.yaml
git diff --check
```

结果：两份 OpenAPI 均 `OK`，diff 空白检查通过。认证文件固定 OpenAPI 3.2.1，工作台规范仍能解析引用的 SessionCookie、BrowserRequestProtection、RequestOrigin、RequestReferer，未修改 B11。

使用一次性 Python 检查（PyYAML 6.0.3、jsonschema 4.26.0 的 Draft202012Validator/FormatChecker、gherkin-official 42.0.1）实际验证下列项目。临时生成/检查脚本在交付完成时清理，规范源是手工维护的三份契约，不依赖生成器。可从 OpenAPI 的 components.examples 与各操作附带样本重建同一检查，不需要真实账户或密钥。

| 检查 | 结果 |
| --- | --- |
| schema 自身合法性 | 64 个通过 |
| 内部 `$ref` | 398 处全部可解析 |
| 命名请求/响应/Problem样本 | 56 个通过对应schema |
| 操作绑定样本 | 8 个操作的42处样本通过各自请求/响应schema |
| 负例 | 73 项按预期拒绝，见下段 |
| 缓存/204/请求防护 | 每个响应有no-store，204无content，8个操作有页面头，7个POST有固定保护头 |
| CA映射 | CA01-CA120各一次，无遗漏或重复；CA53单列原型暂缺与A11归属 |
| Gherkin | 20个scenario/scenario outline及20个唯一WB-AUTH标签解析通过 |
| 文档路径 | 39个本地目标核验；作者回执目标在随后交付提交创建 |
| 源比较 | auth.md、auth-scenarios.md、auth-behavior-scenarios.md与c7420af字节一致 |

负例集合：10个完整请求样本增加未知属性与逐一删除必填字段；规范邮箱10种非法形状（含超长local/domain标签和结尾换行）、密码7/129边界、昵称空/41边界、5种验证码非法形状/类型、页面头31字符/结尾换行、空/换行标识、条款false/string/number、错码Problem剩余次数0、无字段Problem错误携带field、两种会话模式错误expiresAt，以及7个POST的422错误指向不存在字段。正例另外检查254字符邮箱、允许的local字符、40个emoji昵称、128个emoji密码及包含空白/非BMP的8字符密码。

规范化是服务端类型检查之后的共享语义，x-normalized-schema不能被普通JSON Schema自动执行。本次检查的是规范值schema与明确样本；实际trim/规范化流程必须由实现阶段的CC-BOUNDARY直连HTTP和前端零请求用例证明。

## 双向走查

- I01-I05均有完整输入、成功结果、作用时点、字段/非字段失败、重试及未知结果路径。正确码与账户写入同事务；外部邮件接受与内部挑战激活的不可原子性有失败语义。
- I06提供GET状态及bootstrap/activate/restore，显式区分Cookie载体、pending、当前页身份与记住我，补足S45-S47及迟到响应。Cookie被完全禁用不能冒充当前会话可用。
- I07提供定向目标、重复/无Cookie、撤销范围、条件清Cookie及退出未知恢复，设置入口留给A11。
- B11四处外部引用、resolvePrincipal同步/Promise兼容、稳定accountKey、工作台context及错误命名空间保持。前后端只写新目录，共享入口由现有写者结束后的指定集成者接手。

这些是作者设计走查结论，不是代码行为实测。没有运行产品、原型、浏览器、真实邮件、迁移或部署；没有读取活动B12/B14未提交实现或秘密。

## 给根的源事实

`auth-readiness.md` 将行为提交与当前集成prototype tree并列容易误读。实际 `c7420af:prototype` 是 `6f4a7d30c16a67b44af1e7a9c1157abb6d065b6b`，任务基线的prototype tree是 `1281d51665a740573a0a6f237b9e37d0335cf2c3`；本包分别记录，认证三份上游文件一致。没有因此改调查记录或原型。

本地可见Git引用中，三个认证契约路径最近固定提交仍为5757141；旧core/auth和LoginCard路径未见新目标认证交付。该检查不覆盖其他session未提交/外部材料，也不证明原认证session已消费归属通知。未发现需要覆盖其他候选的依据。
