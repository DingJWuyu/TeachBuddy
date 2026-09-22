# 真人验收结论与接续入口

截至 2026-09-22。来源：本次用户在目标设备上的操作反馈及本 session 的连接检查。此文件供用户通知主编排者后读取，不是整体节点通过回执。工作分支 `experiment/c22-office-comparison`；记录和实验尚未提交、合入 main。未修改 M43/R35 候选或运行环境。

| 项目 | 已确认 | 剩余条件 |
| --- | --- | --- |
| C22 | Pandoc 替代路线固定样例在个人 Windows Word/WPS 的目标兼容性切片通过 | 正式产品输出未替换，原失败制品未修复；不能据此关闭完整 C22/R35 |
| C23 | 个人 Windows Edge、Chrome 均完成断网、关闭浏览器后冷启动，以及参数、拖动、步骤操作，用户反馈正常 | 实际课堂设备尚未验证 |
| A12 | QQ 真实发信、收件、验证码注册、找回密码成功；新密码可登录，旧密码不可登录 | iPad 跨设备认证未完成；备份恢复后旧会话撤销仍有工程缺口 |
| EHOST | 用户决定最终租云服务器和域名，当前先做本机开发 | 暂不购买或正式部署，无已部署成功结论 |

## C22/C23 制品

C22 详细来源、人工覆盖及未覆盖项见 [完整固定样例](office-comparison/full/README.md) 和 [路线对照](office-comparison/README.md)。Word/WPS 的具体版本、保存件与截图未收集。不要将小样例的一页结果套用于完整六稿。

C23 固定来源：`b01bc73954cbbc13e464738e0f6f8aa6c6f12084:docs/acceptance/evidence/M40/v1/correction-evidence/downloads/`。包含 M-D-offline.html、M-D-offline-ranges.html 及公式图片。

用户收件目录：`/home/liam_t/项目/TeacherWorkspace-human-acceptance-20260922/`，包含 `目标设备验收样例.zip`、`Office开源方案对比.zip`、`Pandoc完整固定样例.zip`。

## A12 真实邮件与跨设备边界

隔离候选：`9ecabbf60cbbaecce2e9be8191d270068eb675cf`，提取至上述收件目录下 `auth-candidate/`。用户通过该候选的真实认证 UI 发码，使用 QQ 邮箱完成注册与找回密码，反馈均迅速且正常；未记录精确延迟、收件截图或软件版本。独立 SMTP verify 已通过，verify 本身不发邮件。Clash Verge Rev 开启 TUN，用户为 smtp.qq.com 设置 DIRECT 后连接成功。

iPad 在学校 Wi-Fi 无法打开测试 HTTP 入口，Safari 显示“服务器停止响应”。本机 wlan0 为 `10.180.12.34/15`，用户报告 iPad 为 `10.181.249.34`。服务本机 HTTP 200，监听局域网地址；到 iPad 的路由走 wlan0，ping 无回复，邻居记录 INCOMPLETE。本机 UFW active、默认 deny incoming。用户按引导尝试仅对该 iPad 放行 TCP 44443/44444 后仍无法访问，未独立读取确认规则生效。学校设备隔离是可能原因，尚未确诊。用户没有可用手机流量，跨设备真人测试暂停。

iPad 尚未确认下载、安装或信任测试证书，未进行登录、记住我重开、跨设备退出隔离或密码重置撤销测试。此阻塞不构成产品故障判定，也不构成跨设备验收通过。

备份恢复后旧会话撤销属于独立工程缺口，真人邮件/设备测试不能替代修复。原本机 A12 报告入口：`aaa3d77accbfc743f47edfb1ffc385735b2bf3db:docs/acceptance/evidence/A12/v1/local-recheck.md`，接续时核对主编排者维护的最新固定回执。

本次运行文件、SQLite、SMTP 凭据及三天有效测试证书位于 `~/.config/teacherworkspace-acceptance/`；保留至验收完成，凭据、密码、验证码、Cookie、数据库均不进入 Git 或交接报告。局域网服务使用 TCP 44443，证书下载使用 TCP 44444，恢复操作前核对进程、地址和证书有效期。已告知用户删除两条临时 UFW 规则，尚未收到删除确认。若后续安装测试证书，完成后需引导移除。

## EHOST 决策与接续

用户无阿里云、腾讯云、华为云购买记录，无现有服务器或域名；实际大陆使用网络涵盖学校、家庭、手机和公共 Wi-Fi。腾讯实际看到的约 40 元/月超出预算，不能使用未经结算验证的促销价代替真实报价。

研究入口：[最低成本大陆方案](hosting-research/lowest-cost-mainland.md)、[免费托管大陆社区研究](hosting-research/free-hosting-mainland-community.md)。Cloudflare 大陆访问不能一概断言不可达，也未获得用户实际网络的稳定性验证。

当前授权：继续本机链路开发；暂不购买、付费或正式部署。后续在可互访网络恢复 iPad 测试，工程线另行处理旧会话撤销和正式输出集成。主编排者根据固定候选与本文件覆盖范围决定节点状态。
