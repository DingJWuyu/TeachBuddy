# MANUAL-MAIL@1 配置诊断回执

```yaml
task: MANUAL-MAIL@1
attempt: 1
role: implement
status: BLOCKED
verification_level: self
finished_at_utc: "2026-09-23T07:01:01Z"
session_id: unavailable
runner: Codex / gpt-6-astra / low
skills_used: [diagnosing-bugs, writing-for-agents]
base_revision: 66b81dfa2ccb5d65250f2f154fae7e1f0efab151
result_revision: 产品源码仍为 base_revision；本回执及两张隔离截图随本文件所属提交交付
review_target:
  fixed_point: 66b81dfa2ccb5d65250f2f154fae7e1f0efab151
  commit_range: not-applicable
  standards: not-applicable
  spec: not-applicable
  aggregate: 仅配置诊断和证据，无产品变更，不触发代码审查
internal_reviewers: []
identity_mode: real-auth
failure_owner: 主机网络配置维护者 / MANUAL-INTEGRATION
next_condition: 恢复 SMTP 直连后验证连接与认证，再由用户操作真实注册发码
```

## 原因与当前结论

**SMTP 被本机 Mihomo 的全局代理路径中断，TLS 握手尚未完成；同一凭据绕过该路径后连接及认证通过。** 无证据需要改认证业务代码或更换 SMTP 凭据。本 session 未修改主机代理、preview、数据库或运行服务，因此当前用户入口恢复尚待维护者接入，不能宣称已恢复或真实投递成功。

- 运行中的 preview SMTP 为 `smtp.qq.com:465`、`secure=true`；凭据只在本机内存读取。启动脚本、runtime.env 与 `.scratch/manual-integration-preview/20260923T062552Z/preview-runtime-before/` 中对应文件字节一致。
- Mihomo Unix controller `/tmp/verge/verge-mihomo.sock` 的只读 `/configs` 返回 `mode=global`、`tun.enable=true`。当前加载文件 `/home/liam_t/.local/share/io.github.clash-verge-rev.clash-verge-rev/clash-verge.yaml` 包含 `DOMAIN,smtp.qq.com,DIRECT` 和 25/465/587 直连规则，但 global 模式不按这些规则分流。
- 系统 DNS 返回代理虚拟 IP。默认连接、指定 IPv4/IPv6、587 STARTTLS、显式 HTTP 代理和公共 DNS 查询到的真实 QQ IP 均在认证前断开。465 报 `ESOCKET / CONN: Client network socket disconnected before secure TLS connection was established`。
- 对照探针保持同一账号密码、465/TLS 和证书校验，使用带中国 ECS 的公共 DNS 返回的 `183.47.101.192`、`183.47.120.204`，指定 `tls.servername=smtp.qq.com`，绑定本机 WLAN 地址绕过 TUN。两个地址 `nodemailer.verify()` 均成功。IP 与网卡地址仅为当时诊断输入，不能固化到产品或部署配置。

## 复现与验证

隔离工作树、临时数据库、文件目录、随机 HTTPS 端口与自有 `TMPDIR`；浏览器从登录页点击“创建账户”，填写注册表单，再点击“发送验证码”。真实前后端认证链和 SMTP 配置不变，**测试只将 Nodemailer 的 sendMail 替换为 verify，并在认证成功后返回内存中的接受结果**。因此不会执行邮件投递；成功截图不是收到真实验证码的证明。

| 检查 | 实际结果 |
| --- | --- |
| 默认网络路径，独立多次复现 | HTTP 503，`/problems/auth/code-delivery-unavailable`；精确出现“验证码发送失败，请稍后重试。”；断言 `503 !== 200`，退出 1 |
| 相同隔离页面，仅测试连接绕过 TUN | SMTP 认证成功，HTTP 200，失败提示消失、验证码输入和倒计时出现；断言通过，退出 0 |
| 真实 SMTP 认证，无投递 | 两个国内 QQ SMTP 地址均通过，TLS 证书校验保持启用 |
| `TMPDIR="$PWD/.scratch/manual-mail/tmp" npm run build` | 通过；已有前端大 chunk 警告 |
| `TMPDIR="$PWD/.scratch/manual-mail/tmp" node --test apps/api/test/auth-contract-accounts.test.js` | 21/21 通过，含投递失败不激活新挑战、重发冷却、注册与重置验证码生命周期 |

截图：[默认路径失败](registration-failure.png)、[绕过 TUN 的认证探针成功](registration-direct-probe.png)。

本树保留 `.scratch/manual-mail/repro.mjs` 与探针、隔离制品，供接入者立即复核，未提交临时脚本和测试库。默认复现命令为 `TMPDIR="$PWD/.scratch/manual-mail/tmp" node .scratch/manual-mail/repro.mjs`；仅诊断对照加 `MANUAL_MAIL_DIRECT=1`。脚本只读运行进程的 SMTP 环境；进程停止时只读原启动脚本引用的 `qq-mail.env`。本次最后复核时 preview unit 已由其他维护者停为 inactive，本 session 未停止或重启它，也不等待其状态。

## 维护者接入步骤

1. 在 **Clash Verge 的代理模式设置**将当前 `global` 恢复为 `rule`，使已有 QQ SMTP 的 `DIRECT` 规则生效。通过应用持久设置修改，避免只编辑可能被重写的运行 YAML。此操作影响主机网络，不属于本 session 写入权限，尚未执行。
2. 只读确认 controller 返回 `mode=rule`。用原始 `smtp.qq.com:465`、原凭据、正常解析执行 Nodemailer `verify()`，保持 TLS 校验；不使用本次诊断的固定 IP 或本地地址。必须以此成功作为网络修复确认，不能只检查配置字段。
3. 由 MANUAL-INTEGRATION 按其服务维护流程恢复/核对 50880；无需引入产品代码修复，无需修改认证契约、数据库或 SMTP 凭据。网络配置修正本身不要求应用重启。
4. 用户自行在真实页面重试一次注册发码并确认收信，再按需确认重置邮件。该真实投递验收未在本任务执行，不能以 verify 或隔离页面成功代替。

授权来源：MANUAL-MAIL@1 用户任务包，允许隔离复现、只读配置核查及 SMTP 连接/认证；禁止额外邮件、preview 写入、服务重启、其他树修改、合 main、push 和部署。注入 AGENTS 未纳入提交。待主机网络接入，保留临时材料与进度。
